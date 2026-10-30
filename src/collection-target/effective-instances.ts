// effective-instances — env 의 instance 정의와 등록된 CollectionTarget row 를 합쳐 실제 수집
// 대상을 계산하는 순수 함수 (ADR-0059 §Decision 3). 규칙 표는 T-2059 task 파일이 정본이다.
// 찾지 못한 credential 의 active row 는 instances 에서 빠지지만 listedKeys 에 남는다.
// rejected 진단에는 key 와 env 이름만 적고 값은 적지 않는다.
import type { CollectionTarget } from "@prisma/client";

import {
  CONFLUENCE_AUTH_USER_SUFFIX,
  CONFLUENCE_INSTANCES_ENV,
  CONFLUENCE_TOKEN_ENC_SUFFIX,
  confluenceEnvName,
  type ConfluenceInstanceConfig,
  resolveConfluenceInstances,
} from "../confluence/confluence-instance-config";
import {
  GITHUB_INSTANCES_ENV,
  GITHUB_TOKEN_ENC_SUFFIX,
  githubEnvName,
  type GithubInstanceConfig,
  resolveGithubInstances,
} from "../github/github-instance-config";

export type CollectionTargetRow = Omit<CollectionTarget, "id" | "updatedAt">;

export interface EffectiveInstances<T> {
  /** env 정의가 먼저, 그 뒤 등록 row 순서다. */
  instances: T[];
  rejected: string[];
  /** env 목록 ∪ active row 의 정규화 key. 수집할 수 없는 key 도 포함한다. */
  listedKeys: Set<string>;
}

export const normalizeInstanceKey = (key: string): string =>
  key.trim().toUpperCase();

const parseListedKeys = (raw: string | undefined): Set<string> =>
  new Set(
    (raw ?? "")
      .split(/[\s,]+/)
      .filter((key) => key.length > 0)
      .map(normalizeInstanceKey),
  );

const cleanList = (values: string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

function mergeRegistered<T>(
  type: string,
  base: { instances: T[]; rejected: string[] },
  listRaw: string | undefined,
  rows: CollectionTargetRow[],
  tokenEnvName: (key: string) => string,
  env: NodeJS.ProcessEnv,
  toConfig: (key: string, row: CollectionTargetRow, tokenEnc: string) => T,
): EffectiveInstances<T> {
  const envListed = parseListedKeys(listRaw);
  const listedKeys = new Set(envListed);
  const instances = [...base.instances];
  const rejected = [...base.rejected];

  // @@unique 는 대소문자를 구분하므로 같은 key 의 row 가 둘일 수 있다. 먼저 등록된 쪽이 이긴다.
  const ordered = rows
    .filter((row) => row.type === type && row.instanceKey.trim().length > 0)
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        (a.instanceKey < b.instanceKey ? -1 : 1),
    );
  const registered = new Set<string>();
  for (const row of ordered) {
    const key = row.instanceKey.trim();
    const normalized = normalizeInstanceKey(key);
    if (envListed.has(normalized)) {
      rejected.push(`${key}: env 정의 우선 (DB row 무시)`);
      continue;
    }
    if (!row.active) {
      continue;
    }
    if (registered.has(normalized)) {
      rejected.push(`${key}: 중복 key(먼저 등록된 row 만 활성)`);
      continue;
    }
    registered.add(normalized);
    listedKeys.add(normalized);

    const tokenEnc = env[tokenEnvName(key)]?.trim();
    if (!tokenEnc) {
      rejected.push(`${key}: 필수 env 부재 — ${tokenEnvName(key)}`);
      continue;
    }
    if (row.endpoint.trim().length === 0) {
      rejected.push(`${key}: endpoint 가 비어 있음`);
      continue;
    }
    instances.push(toConfig(key, row, tokenEnc));
  }
  return { instances, rejected, listedKeys };
}

/** env 와 등록 row 를 합친 GitHub 수집 대상을 계산한다. */
export function mergeGithubInstances(
  env: NodeJS.ProcessEnv,
  rows: CollectionTargetRow[],
): EffectiveInstances<GithubInstanceConfig> {
  return mergeRegistered(
    "GITHUB",
    resolveGithubInstances(env),
    env[GITHUB_INSTANCES_ENV],
    rows,
    (key) => githubEnvName(key, GITHUB_TOKEN_ENC_SUFFIX),
    env,
    (key, row, tokenEnc) => ({
      key,
      host: row.endpoint.trim(),
      orgs: cleanList(row.orgs),
      repos: cleanList(row.repos),
      tokenEnc,
    }),
  );
}

/** env 와 등록 row 를 합친 Confluence 수집 대상을 계산한다. */
export function mergeConfluenceInstances(
  env: NodeJS.ProcessEnv,
  rows: CollectionTargetRow[],
): EffectiveInstances<ConfluenceInstanceConfig> {
  return mergeRegistered(
    "CONFLUENCE",
    resolveConfluenceInstances(env),
    env[CONFLUENCE_INSTANCES_ENV],
    rows,
    (key) => confluenceEnvName(key, CONFLUENCE_TOKEN_ENC_SUFFIX),
    env,
    (key, row, tokenEnc) => ({
      key,
      baseUrl: row.endpoint.trim(),
      authUser:
        env[confluenceEnvName(key, CONFLUENCE_AUTH_USER_SUFFIX)]?.trim() ||
        null,
      tokenEnc,
      spaceAllowlist: cleanList(row.spaces),
    }),
  );
}

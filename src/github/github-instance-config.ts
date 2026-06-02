// github-instance-config — GithubModule 의 instance sub-config 를 process.env 에서
// 읽어 instance-keyed config 배열로 변환하는 부수효과 0 순수 함수 모듈
// (T-0178, ADR-0017 Decision §1·§2·§3). 어떤 instance 가 활성인지 열거하는
// GITHUB_INSTANCES key list 와 instance 별 접두 변수(_HOST / _ORG / _TOKEN_ENC)를
// 읽어 GithubInstanceConfig[] 로 변환한다. llm-live-test-gating.ts 의
// resolveLiveTestGating 순수 함수 + isPresent guard + missing 진단 패턴을 mirror 한다.
//
// 책임 경계:
//   - resolveGithubInstances: env(또는 임의 env map)를 읽어 활성 instance config
//     배열을 계산하는 부수효과 0 순수 함수. 실 네트워크 호출 0 / 실 credential 0 —
//     env 의 *존재·비어있지 않음* 만 검사한다(실값을 코드에 적지 않는다, CLAUDE.md §9).
//   - GITHUB_INSTANCES 가 comma/space-separated key list. env 에 열거된 key 만
//     활성 — 자동 발견 안 함(ADR-0016 §2 allowlist 순회 정합, REQ-044).
//   - 각 key 의 _HOST 또는 _TOKEN_ENC 가 부재/빈/공백-only 면 그 instance 를 reject
//     (skip + 진단) — 평문/빈 fallback 금지(ADR-0017 Decision §3 fail-fast).
//   - tokenEnc 는 encrypted-at-rest envelope 문자열 그대로 보관 — 본 task 는
//     decrypt 안 함(ADR-0017 chain row 2 = 별도 task).
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

// 활성 instance key 의 comma/space-separated 목록 env 이름. 실값 0 — 이름 상수만.
export const GITHUB_INSTANCES_ENV = "GITHUB_INSTANCES";

// per-key 접두 변수의 suffix 상수(ADR-0017 Decision §2). 실제 env 이름은
// `GITHUB_<KEY 대문자>_HOST` / `_ORG` / `_TOKEN_ENC` 로 조립한다(githubEnvName).
export const GITHUB_HOST_SUFFIX = "_HOST";
export const GITHUB_ORG_SUFFIX = "_ORG";
export const GITHUB_TOKEN_ENC_SUFFIX = "_TOKEN_ENC";

// resolveGithubInstances 의 반환 원소 — 한 instance 의 sub-config.
export interface GithubInstanceConfig {
  // GITHUB_INSTANCES 에 열거된 instance key(원형 그대로, 예: "public" / "sec").
  key: string;
  // 해당 instance 의 base host(예: github.com / github.sec.samsung.net). adapter 가
  // ADR-0016 §2 host→base URL 도출 규칙으로 API base 를 산출한다(trim 된 값).
  host: string;
  // 해당 instance 의 org(s). 다중 org 는 comma-separated 를 split + trim 한 배열.
  // org 미설정(부재/빈/공백)이면 빈 배열(ADR-0017 Decision §2 상 org 는 필수 아님 —
  // _HOST / _TOKEN_ENC 만 필수). 상위 orchestrator 가 org 0 개를 어떻게 다룰지는
  // 후속 slice 책임이며, 본 parser 는 org 부재를 reject 사유로 삼지 않는다.
  orgs: string[];
  // 해당 instance 의 encrypted-at-rest token envelope 문자열(ADR-0014 AES-256-GCM
  // base64). 본 task 는 decrypt 안 함 — 암호문 그대로 보관(JIT decrypt 는 chain row 2).
  tokenEnc: string;
}

// resolveGithubInstances 의 진단 정보 — 어느 key 가 어떤 사유로 reject 됐는지
// 사람이 읽을 수 있게 보고한다(실값 금지, env 이름만 박제 — CLAUDE.md §9).
export interface GithubInstanceResolution {
  // 활성 instance config 배열(필수 변수가 모두 present 한 key 만 포함).
  instances: GithubInstanceConfig[];
  // reject 된 key 와 사유(부재한 env 이름)를 사람이 읽을 수 있게 모은 진단 목록.
  // 정상(전 key 활성)이면 빈 배열.
  rejected: string[];
}

// env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다(부분-set·malformed 방어).
// llm-live-test-gating.ts 의 isPresent 와 동형.
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// githubEnvName — instance key 와 suffix 로 per-key env 이름을 조립한다(순수).
// key 는 대문자로 정규화한다(GITHUB_INSTANCES 의 key 대소문자 변형을 흡수 —
// "public" / "Public" 모두 GITHUB_PUBLIC_<suffix> 로 매핑). 실값 0 — 이름만 조립.
export function githubEnvName(key: string, suffix: string): string {
  return `GITHUB_${key.toUpperCase()}${suffix}`;
}

// resolveGithubInstances — env map 을 읽어 활성 GitHub instance config 배열을
// 계산한다(부수효과 0 순수 함수). GITHUB_INSTANCES 를 comma/space 로 split → 각 key
// 마다 _HOST / _ORG / _TOKEN_ENC 를 read → 필수(_HOST·_TOKEN_ENC) present 한 key 만
// config 로 변환한다. 필수 부재 key 는 reject(skip + 진단) — 평문/빈 fallback 안 함.
//   - GITHUB_INSTANCES 부재/빈/공백-only → 빈 instances + 빈 rejected(활성 0).
//   - key list 의 trailing comma / 연속 구분자 / 공백 토큰 → 무시(빈 key 미생성).
//   - 중복 key → 먼저 등장한 1 개만 처리(이후 중복은 skip, 진단에 기록).
//   - _ORG 부재/빈 → orgs 빈 배열(reject 사유 아님). 다중 org → comma-split + trim.
export function resolveGithubInstances(
  env: NodeJS.ProcessEnv,
): GithubInstanceResolution {
  const instances: GithubInstanceConfig[] = [];
  const rejected: string[] = [];

  const listRaw = env[GITHUB_INSTANCES_ENV];
  // GITHUB_INSTANCES 부재/빈/공백-only → 활성 instance 0(빈 결과). 이는 reject 가
  // 아니라 "활성 instance 미설정" 정상 분기다(환경별 부분 활성의 0 케이스).
  if (!isPresent(listRaw)) {
    return { instances, rejected };
  }

  // comma 와 whitespace 둘 다 구분자로 허용 — split 후 빈 토큰(trailing comma /
  // 연속 구분자 / 공백-only 토큰)은 제거한다. 중복 검출용 set 도 함께 유지.
  const keys = listRaw
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const seen = new Set<string>();
  for (const key of keys) {
    // 중복 key — 먼저 등장한 1 개만 처리하고 이후는 skip(진단에 이름만 박제).
    const dedupeKey = key.toUpperCase();
    if (seen.has(dedupeKey)) {
      rejected.push(`${key}: 중복 key(이전 등장분만 활성)`);
      continue;
    }
    seen.add(dedupeKey);

    const hostRaw = env[githubEnvName(key, GITHUB_HOST_SUFFIX)];
    const tokenEncRaw = env[githubEnvName(key, GITHUB_TOKEN_ENC_SUFFIX)];
    const orgRaw = env[githubEnvName(key, GITHUB_ORG_SUFFIX)];

    // 필수 변수(_HOST·_TOKEN_ENC) 부재/빈/공백 → 해당 instance reject(fail-fast).
    // 어느 env 가 부재했는지 이름만 진단에 박제한다(실값 금지, §9). isPresent type
    // guard 결과를 const 로 고정해 아래 push 단계에서 hostRaw/tokenEncRaw 가 string
    // 으로 narrowing 되도록 한다(둘 다 present 일 때만 진입).
    const hostOk = isPresent(hostRaw);
    const tokenEncOk = isPresent(tokenEncRaw);
    if (!hostOk || !tokenEncOk) {
      const missing: string[] = [];
      if (!hostOk) missing.push(githubEnvName(key, GITHUB_HOST_SUFFIX));
      if (!tokenEncOk) {
        missing.push(githubEnvName(key, GITHUB_TOKEN_ENC_SUFFIX));
      }
      rejected.push(`${key}: 필수 env 부재 — ${missing.join(", ")}`);
      continue;
    }

    // _ORG 는 필수 아님 — 부재/빈/공백이면 빈 배열. present 하면 comma-split + trim.
    const orgs = isPresent(orgRaw)
      ? orgRaw
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      : [];

    instances.push({
      key,
      // isPresent type guard 가 hostRaw / tokenEncRaw 를 string 으로 narrowing.
      host: hostRaw.trim(),
      orgs,
      tokenEnc: tokenEncRaw.trim(),
    });
  }

  return { instances, rejected };
}

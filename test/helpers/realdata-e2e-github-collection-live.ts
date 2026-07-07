// realdata-e2e-github-collection-live.ts — 실 평가 e2e github.com 수집 leg 의 실 round-trip
// 요청 plan 조립 순수 함수 모듈 (T-0806 박제, PLAN.md 109행 gate 2 collection leg).
//
// 배경:
//   - `realdata-e2e-live.smoke-spec.ts`(T-0610)의 LLM 평가 leg 은 이미 env-gated live 로
//     박제됐으나, 그 spec header 는 "실 github 네트워크 수집 배선은 후속 slice … 본 task 는
//     typed surface 만" 이라며 collection leg 를 synthetic Activity 1 건으로 stub 해 뒀다.
//     본 모듈은 그 deferred 된 collection leg 를 메운다 — 실 github.com 공개 활동(myungjoo/
//     leemgs)을 1 회 round-trip 수집하는 env-gated smoke 가 발화할 때 쓸 **요청 plan** 을
//     결정론적으로 조립하는 순수 함수를 제공한다.
//
// 책임:
//   - `resolveRealDataE2eLiveGating(env)`(T-0610, 변경 0)이 판정한 gating 결과와 seed
//     descriptor(myungjoo/leemgs)로부터, 실 github round-trip 이 어느 username 을 어떤
//     endpoint/헤더 모양으로 칠지의 **결정론적 구조**를 조립한다. 실 fetch 는 하지 않는다
//     (plan 만) — 실제 네트워크 호출은 실행 smoke 가 gating enabled 분기에서만 수행한다.
//   - gating enabled 여부를 plan 에 그대로 반영한다: enabled=false(공개 CI 기본)면 빈 plan
//     (entries 0)을 반환해 실행 smoke 가 describe.skip 으로 전 suite 를 건너뛰게 한다.
//
// 🔥 부수효과 0 순수 함수 (실 네트워크·실 credential 0, §9):
//   - env / seed 를 읽어 plan 을 계산할 뿐 실 네트워크 호출 0, DB 접근 0, mutation 0.
//   - 실 credential 값(github PAT)을 코드에 적지 않는다 — gating(env 출처)에서만 흘려받아
//     Authorization 헤더의 *존재 여부* 판정에 쓰고, 반환 plan 에는 raw PAT 값을 담지 않는다
//     (§9 — credential echo/log 0). plan 은 "Authorization 헤더를 실을 것인가(boolean)"
//     만 노출한다.
//   - raw 활동 데이터(commit/PR/issue 본문) 미보관(R-59): plan 은 대상 username·endpoint
//     path·헤더 모양 등 결정론적 요청 구조만 담는다. 수집 응답 본문은 plan scope 밖.
//
// 🔥 외부 dependency 0 — Node 내장 타입 + 기존 helper import 재사용만. 새 package 0.
//   production `src/` 변경 0 — `resolveGithubApiBaseUrl` / `RealDataE2eLiveGating` /
//   `RealDataSeedDescriptor` 를 전부 read-only import 로 재사용한다.
import { resolveGithubApiBaseUrl } from "../../src/github/github-request.builder";

import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// 수집 대상 github host — seed 는 전부 github.com 공개 사용자다(ADR-0006 표기 정합).
const GITHUB_COLLECTION_HOST = "github.com";

// 실 수집이 칠 REST endpoint path 형태 — 대상 username 의 공개 이벤트(활동) 목록.
// github-live.smoke 의 bounded single round-trip 정신 mirror: 한 username 당 정확히 1 개
// 요청 plan 만 만든다(다중 page cursor 순회는 plan scope 밖). raw 본문은 미보관(R-59) —
// plan 은 어느 path 를 칠지의 결정론 구조만 담는다.
function collectionPathForUsername(username: string): string {
  return `/users/${username}/events/public`;
}

// RealDataE2eGithubCollectionPlanEntry — 대상 username 1 명에 대한 실 round-trip 요청 plan
// 1 건. 실 fetch 인자로 쓸 수 있는 결정론 구조만 담고 raw credential/활동은 담지 않는다.
export interface RealDataE2eGithubCollectionPlanEntry {
  // 수집 대상 github.com username(seed 의 primary serviceIdentity externalId).
  username: string;
  // 요청이 칠 configured host — 전부 github.com(public API host 라우팅은 adapter/builder).
  host: string;
  // 도출된 REST API base URL(resolveGithubApiBaseUrl 재사용 — github.com → api.github.com).
  // 실행 smoke 가 실 endpoint 를 조립할 때 참조하는 결정론 값.
  apiBaseUrl: string;
  // 대상 REST path(공개 이벤트 목록 — bounded single round-trip 대상).
  path: string;
  // Authorization: Bearer 헤더를 실을 것인가 — gating.githubPat 존재 시 true. raw PAT 값은
  // 담지 않는다(§9 — 존재 여부 boolean 만). false 면 인증 헤더 없이 요청(공개 endpoint).
  hasAuthorizationHeader: boolean;
}

// RealDataE2eGithubCollectionPlan — gating 결과 + seed 로부터 조립한 전체 수집 요청 plan.
// enabled 가 실행 smoke 의 describe 분기 입력이고, entries 는 대상 username 당 요청 1 건이다.
export interface RealDataE2eGithubCollectionPlan {
  // gating enabled 여부 — false(공개 CI 기본)면 entries 는 빈 배열(실행 smoke skip).
  enabled: boolean;
  // 대상 username 당 요청 plan 1 건. enabled=false 면 빈 배열.
  entries: RealDataE2eGithubCollectionPlanEntry[];
}

// buildRealDataGithubCollectionPlan — gating 결과 + seed descriptor 배열로부터 실 github
// 수집 round-trip 요청 plan 을 조립하는 순수 함수. 실 fetch 는 하지 않는다(plan 만).
//
// 분기:
//   - gating.enabled === false → 빈 plan(entries 0) 반환. 실행 smoke 가 describe.skip
//     으로 전 suite 를 건너뛰게 한다(실 네트워크 0 / secret 0). seed 는 읽지 않는다.
//   - gating.enabled === true → 각 seed 의 primary(또는 첫) github.com identity 를 대상
//     username 으로 뽑아 요청 1 건씩 plan 에 담는다. Authorization 헤더 존재 여부는
//     gating.githubPat 의 존재로 판정(raw PAT 값 미보관, §9).
//   - 빈 seed 배열 → enabled 여도 빈 entries.
//
// error path(명시적 throw):
//   - gating 이 null/undefined/비객체 → 한국어 메시지 TypeError.
//   - seeds 가 배열이 아님(null/undefined/비배열) → 한국어 메시지 TypeError.
//   - enabled=true 인데 어느 seed 에 github.com serviceIdentity 가 없거나 externalId 가
//     비었음 → 한국어 메시지 throw(수집 대상 username 이 비면 round-trip 대상이 없으므로).
//
// 순수성:
//   - 입력 env(gating)·seed 배열을 mutate 하지 않는다. 매 호출마다 새 객체 트리 반환
//     (공유 mutable 노출 0). 반환값을 호출 측이 mutate 해도 입력·다음 호출에 영향 0.
export function buildRealDataGithubCollectionPlan(
  gating: RealDataE2eLiveGating,
  seeds: RealDataSeedDescriptor[],
): RealDataE2eGithubCollectionPlan {
  if (gating === null || typeof gating !== "object") {
    throw new TypeError(
      "buildRealDataGithubCollectionPlan: gating 이 null/undefined 이거나 객체가 아닙니다.",
    );
  }
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      "buildRealDataGithubCollectionPlan: seeds 가 배열이 아닙니다 (null/undefined/비배열).",
    );
  }

  // gating disabled(공개 CI 기본) → 빈 plan. seed 를 읽지 않고 실 네트워크 진입도 없다.
  if (gating.enabled !== true) {
    return { enabled: false, entries: [] };
  }

  // Authorization 헤더 존재 여부 — gating.githubPat(env 출처 평문) 의 *존재* 만 본다.
  // raw PAT 값은 plan 에 담지 않는다(§9 — boolean 만). gating enabled 라면 githubPat 은
  // resolveRealDataE2eLiveGating 계약상 non-blank string 이나, 방어적으로 존재만 검사.
  const hasAuthorizationHeader =
    typeof gating.githubPat === "string" && gating.githubPat.trim().length > 0;

  const entries = seeds.map((seed) => {
    const username = extractGithubUsername(seed);
    return {
      username,
      host: GITHUB_COLLECTION_HOST,
      // resolveGithubApiBaseUrl 재사용(github.com → https://api.github.com). production
      // builder 를 그대로 써 base URL 라우팅 규칙을 단일 원천으로 유지한다.
      apiBaseUrl: resolveGithubApiBaseUrl(GITHUB_COLLECTION_HOST),
      path: collectionPathForUsername(username),
      hasAuthorizationHeader,
    };
  });

  return { enabled: true, entries };
}

// extractGithubUsername — seed descriptor 1 개에서 실 수집 대상 github.com username 을
// 뽑는 내부 helper. primary github.com identity 를 우선하고, 없으면 첫 github.com
// identity 를 쓴다. 대상이 없거나 externalId 가 비면 명시적 throw(수집 author 귀속 key 가
// 비면 round-trip 대상이 없으므로 build-time 에 막는다).
function extractGithubUsername(seed: RealDataSeedDescriptor): string {
  if (
    seed === null ||
    typeof seed !== "object" ||
    !Array.isArray(seed.serviceIdentities)
  ) {
    throw new TypeError(
      "buildRealDataGithubCollectionPlan: seed 가 null/비객체이거나 serviceIdentities 가 배열이 아닙니다.",
    );
  }

  const githubIdentities = seed.serviceIdentities.filter(
    (identity) => identity.service === "github.com",
  );
  if (githubIdentities.length === 0) {
    throw new Error(
      `buildRealDataGithubCollectionPlan: seed(person=${seed.person?.fullName ?? "?"})에 github.com serviceIdentity 가 없습니다. 수집 대상 username 이 없습니다.`,
    );
  }

  const chosen =
    githubIdentities.find((identity) => identity.isPrimary === true) ??
    githubIdentities[0];
  const username = chosen.externalId;
  if (typeof username !== "string" || username.trim() === "") {
    throw new Error(
      "buildRealDataGithubCollectionPlan: 대상 github.com externalId(username)가 비어있거나 공백뿐입니다. 수집 author 귀속 key 가 비면 안 됩니다.",
    );
  }

  return username;
}

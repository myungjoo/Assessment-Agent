// realdata-e2e-github-collection-live-consistency.ts — 실 평가 e2e github 수집 leg 의
// 수집 plan 조립(`buildRealDataGithubCollectionPlan`, T-0806,
// `realdata-e2e-github-collection-live.ts`) ↔ 독립 oracle 재유도 byte-identical 정합 순수
// 가드 (T-0984 박제, PLAN.md 109행 collection leg 의 plan 조립 규칙 drift-guard).
//
// 책임:
//   - `buildRealDataGithubCollectionPlan(gating, seeds)`(T-0806)는 gating 결과 + seed
//     descriptor 배열로부터 (a) gating 미활성이면 빈 plan(entries 0), (b) 활성이면 각 seed
//     의 primary-우선 github.com identity 를 대상 username 으로 뽑아 host/apiBaseUrl/path/
//     hasAuthorizationHeader 를 담은 entry 1 건씩 조립하는 **결정론 producer** 다. 이
//     producer 는 이 스트림의 sibling 관례인 독립 `-consistency` drift-guard 를 아직 갖지
//     못했다 — 조립 규칙이 조용히 회귀(예: path 형태 변경, host 오타, primary-우선 선택
//     로직 파괴, gating.githubPat 존재 판정을 raw 값 유입으로 바꿔 §9 위반, enabled=false
//     인데 entries 를 채움)해도 colocated unit spec 만으로는 spec 이 함께 수정되면 통과할
//     수 있다. 본 가드가 그 빈칸을 **독립 재유도(oracle)** 로 채운다. 형제 collect-request
//     leg 은 T-0981 이, activity-map leg 은 T-0979 가, input descriptor leg 은 T-0976 이
//     같은 짝을 봉했다.
//
// 검증하는 불변식(single source — producer 를 호출하지 않고 규칙을 독립 재구현):
//   - expected = enabled 반영(false → {enabled:false, entries:[]}) / 활성이면 seed 당 entry
//     1 건(primary-우선 github.com username · host="github.com" · apiBaseUrl=
//     resolveGithubApiBaseUrl("github.com") · path=`/users/{username}/events/public` ·
//     hasAuthorizationHeader=(gating.githubPat 존재 boolean)) 규칙을 producer 와 무관하게
//     재유도해 산출한 `RealDataE2eGithubCollectionPlan`. 인자로 받은 `plan` 이 expected 와
//     필드별 정합(전체 deep-equal byte-identical)함.
//     `buildRealDataGithubCollectionPlan` 을 호출하지 **않는다**(그러면 자기 자신 대조라
//     무의미) — 조립 규칙을 재유도해 대조하므로, 어느 한쪽 규칙이 drift 하는 순간 fail 한다.
//   - 단 apiBaseUrl 은 producer 와 **동일 단일 원천** `resolveGithubApiBaseUrl` 을 재사용해
//     재유도한다(base URL 라우팅 규칙의 이중 정의 회피 — README/CLAUDE 단일 원천 원칙). 이
//     함수는 production `src/` 의 read-only import 로, producer 와 같은 값을 낳는다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan` 비-객체(null 포함) · `plan.enabled` 비-boolean · `plan.entries` 비-배열
//     → 한국어 TypeError. gating/seeds 가 재유도 불가한 형태(비-객체 gating · 비-배열
//     seeds · seed 에 github.com identity 부재/빈 externalId)여도 TypeError(oracle 재유도
//     불가).
//   - 재유도 expected 와 enabled / entries 길이 / entry 슬롯(username/host/apiBaseUrl/path/
//     hasAuthorizationHeader) / 전체 구조 drift → 한국어 RangeError(어긋난 슬롯명 + 기대/
//     실측 정보 포함).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 🔥 §9 / R-59 격리: gating.githubPat(github PAT 평문)은 **존재 여부 boolean** 만 재유도에
//   쓰고 그 실 값은 재유도·비교·throw 메시지 어디에도 담지 않는다. plan 은
//   hasAuthorizationHeader boolean 만 노출하므로 host/path/apiBaseUrl/username 등 비시크릿
//   구조값의 기대/실측은 메시지에 노출해도 무방하다. raw 활동 데이터(commit/PR/issue 본문)
//   미보관 — 결정론 요청 plan 구조만 참조한다.
//
// 비변형 / 순수: `gating` / `seeds` / `plan` 을 읽기·비교만 한다(쓰기 0). 네트워크/LLM/DB/
// env 읽기 0 · 부수효과 0 · `@Injectable` 0 · Prisma 0 · 새 외부 dependency 0. production
// `src/` 변경 0(`resolveGithubApiBaseUrl` value import + 타입 read-only import 재사용만).
// 동일 입력 → 동일 동작.
//
// Out of Scope(task T-0984):
//   - `realdata-e2e-github-collection-live.ts`(T-0806) producer 본문 수정 — 본 가드는
//     type-only import(+resolveGithubApiBaseUrl value import) · 재유도 비교 · throw 만
//     (재정의 0). 특히 조립 반환 직전 self-wire 배선은 별도 후속 slice.
//   - 자동 복구 / 재합성 / 기본값 채움 0 — 손상 plan 을 고치지 않고 fail-fast throw.
import { resolveGithubApiBaseUrl } from "../../src/github/github-request.builder";

import type {
  RealDataE2eGithubCollectionPlan,
  RealDataE2eGithubCollectionPlanEntry,
} from "./realdata-e2e-github-collection-live";
import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// 수집 대상 github host 상수의 **독립 재유도** — producer 의 GITHUB_COLLECTION_HOST 상수를
// import 하지 않고 값을 oracle 안에서 다시 표현한다. producer 가 이 값을 바꾸면 본 oracle
// 과 어긋나 fail 한다(drift 대조의 핵심).
const EXPECTED_GITHUB_COLLECTION_HOST = "github.com";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). githubPat 은 이 함수로 값을 노출하지 않는다(존재 boolean 만 사용).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. plan 은 scalar(string/boolean)만 담는
// 얕은 트리라 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// assertGatingStructure — 재유도 source(gating)의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함) → TypeError(oracle 을 재유도할 수 없다).
function assertGatingStructure(
  gating: RealDataE2eLiveGating | null | undefined,
  label: string,
): asserts gating is RealDataE2eLiveGating {
  if (gating === null || typeof gating !== "object") {
    throw new TypeError(
      `${label}: gating 이 객체가 아니다(타입: ${describe(gating)}) — 수집 plan 조립 규칙을 재유도할 수 없다.`,
    );
  }
}

// assertSeedsStructure — 재유도 source(seeds 배열)의 최소 형태를 fail-fast 검증. 비-배열
// (null/undefined 포함) → TypeError.
function assertSeedsStructure(
  seeds: RealDataSeedDescriptor[] | null | undefined,
  label: string,
): asserts seeds is RealDataSeedDescriptor[] {
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `${label}: seeds 가 배열이 아니다(타입: ${describe(seeds)}) — seed 당 entry 를 재유도할 수 없다.`,
    );
  }
}

// assertPlanStructure — 검증 대상 plan 의 최소 형태를 fail-fast 검증. 비-객체(null 포함) /
// enabled 비-boolean / entries 비-배열 → TypeError. 필드별 정합 비교 전 최소 형태 보장.
function assertPlanStructure(
  plan: RealDataE2eGithubCollectionPlan | null | undefined,
  label: string,
): asserts plan is RealDataE2eGithubCollectionPlan {
  if (plan === null || typeof plan !== "object") {
    throw new TypeError(
      `${label}: plan 이 객체가 아니다(타입: ${describe(plan)}) — 수집 plan 정합 비교를 진행할 수 없다.`,
    );
  }
  if (typeof plan.enabled !== "boolean") {
    throw new TypeError(
      `${label}: plan.enabled 가 boolean 이 아니다(타입: ${describe(plan.enabled)}) — enabled 반영 규칙을 대조할 수 없다.`,
    );
  }
  if (!Array.isArray(plan.entries)) {
    throw new TypeError(
      `${label}: plan.entries 가 배열이 아니다(타입: ${describe(plan.entries)}) — seed 당 entry 정합을 대조할 수 없다.`,
    );
  }
}

// deriveExpectedUsername — seed 1 개에서 실 수집 대상 github.com username 을 producer 와
// 무관하게 **독립 재유도**한다. primary github.com identity 를 우선하고, 없으면 첫 github.com
// identity 를 쓴다(producer extractGithubUsername 규칙의 독립 재구현). 대상이 없거나
// externalId 가 비면 oracle 을 재유도할 수 없으므로 TypeError(구조 결손).
function deriveExpectedUsername(
  seed: RealDataSeedDescriptor,
  index: number,
  label: string,
): string {
  if (
    seed === null ||
    typeof seed !== "object" ||
    !Array.isArray(seed.serviceIdentities)
  ) {
    throw new TypeError(
      `${label}: seeds[${index}] 가 비-객체이거나 serviceIdentities 가 배열이 아니다(타입: ${describe(seed)}) — 대상 username 을 재유도할 수 없다.`,
    );
  }

  const githubIdentities = seed.serviceIdentities.filter(
    (identity) => identity.service === "github.com",
  );
  if (githubIdentities.length === 0) {
    throw new TypeError(
      `${label}: seeds[${index}] 에 github.com serviceIdentity 가 없다 — 수집 대상 username 을 재유도할 수 없다.`,
    );
  }

  const chosen =
    githubIdentities.find((identity) => identity.isPrimary === true) ??
    githubIdentities[0];
  const username = chosen.externalId;
  if (typeof username !== "string" || username.trim() === "") {
    throw new TypeError(
      `${label}: seeds[${index}] 의 대상 github.com externalId(username)가 비어있거나 공백뿐이다 — 재유도 불가.`,
    );
  }

  return username;
}

// deriveExpectedPlan — gating + seeds 로부터 expected 수집 plan 을 producer 와 무관하게
// 독립 재유도한다(producer 를 호출하지 않는다 — 자기 자신 대조 방지).
//   - gating.enabled !== true → { enabled:false, entries:[] }(seed 를 읽지 않는다).
//   - 활성 → seed 당 entry 1 건(primary-우선 username · host="github.com" · apiBaseUrl=
//     resolveGithubApiBaseUrl("github.com") · path=`/users/{username}/events/public` ·
//     hasAuthorizationHeader=(gating.githubPat 존재 boolean)). 🔥 §9: githubPat 은 존재만
//     본다(raw 값 미참조).
function deriveExpectedPlan(
  gating: RealDataE2eLiveGating,
  seeds: RealDataSeedDescriptor[],
  label: string,
): RealDataE2eGithubCollectionPlan {
  if (gating.enabled !== true) {
    return { enabled: false, entries: [] };
  }

  // 🔥 §9: raw PAT 값이 아니라 *존재 여부* boolean 만 재유도에 쓴다(producer 와 동일 판정).
  const hasAuthorizationHeader =
    typeof gating.githubPat === "string" && gating.githubPat.trim().length > 0;

  const entries: RealDataE2eGithubCollectionPlanEntry[] = seeds.map(
    (seed, index) => {
      const username = deriveExpectedUsername(seed, index, label);
      return {
        username,
        host: EXPECTED_GITHUB_COLLECTION_HOST,
        // producer 와 동일 단일 원천 재사용(base URL 라우팅 규칙 이중 정의 회피).
        apiBaseUrl: resolveGithubApiBaseUrl(EXPECTED_GITHUB_COLLECTION_HOST),
        path: `/users/${username}/events/public`,
        hasAuthorizationHeader,
      };
    },
  );

  return { enabled: true, entries };
}

// assertEntryConsistent — plan.entries[i] 1 건이 재유도 expected entry 와 슬롯별 정합함을
// 검증한다. drift 슬롯(username/host/apiBaseUrl/path/hasAuthorizationHeader)을 식별해
// RangeError 로 보고한다. 🔥 §9: 여기 비교되는 슬롯은 전부 비시크릿 구조값이라 기대/실측
// 노출 무방(hasAuthorizationHeader 는 boolean, PAT 실 값 아님).
function assertEntryConsistent(
  actual: RealDataE2eGithubCollectionPlanEntry,
  expected: RealDataE2eGithubCollectionPlanEntry,
  index: number,
  label: string,
): void {
  if (actual === null || typeof actual !== "object") {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}] 가 객체가 아니다(타입: ${describe(actual)}) — entry 슬롯을 대조할 수 없다.`,
    );
  }
  if (actual.username !== expected.username) {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}].username 이 재유도 expected(primary-우선 github.com 선택)와 다르다 — 기대=${JSON.stringify(expected.username)}, 실측=${JSON.stringify(actual.username)}.`,
    );
  }
  if (actual.host !== expected.host) {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}].host 가 재유도 expected("github.com" 귀속)와 다르다 — 기대=${JSON.stringify(expected.host)}, 실측=${JSON.stringify(actual.host)}.`,
    );
  }
  if (actual.apiBaseUrl !== expected.apiBaseUrl) {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}].apiBaseUrl 이 재유도 expected(resolveGithubApiBaseUrl 단일 원천)와 다르다 — 기대=${JSON.stringify(expected.apiBaseUrl)}, 실측=${JSON.stringify(actual.apiBaseUrl)}.`,
    );
  }
  if (actual.path !== expected.path) {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}].path 가 재유도 expected(/users/{username}/events/public)와 다르다 — 기대=${JSON.stringify(expected.path)}, 실측=${JSON.stringify(actual.path)}.`,
    );
  }
  if (actual.hasAuthorizationHeader !== expected.hasAuthorizationHeader) {
    // 🔥 §9: boolean 만 비교·노출(raw PAT 값 미등장). githubPat 존재 판정 drift 를 catch.
    throw new RangeError(
      `${label}: 정합 위반: plan.entries[${index}].hasAuthorizationHeader 가 재유도 expected(gating.githubPat 존재 boolean)와 다르다 — 기대=${JSON.stringify(expected.hasAuthorizationHeader)}, 실측=${JSON.stringify(actual.hasAuthorizationHeader)}.`,
    );
  }
}

/**
 * 실 평가 e2e github 수집 leg 의 수집 plan 조립(`buildRealDataGithubCollectionPlan` 산출
 * `plan`)이, 동일 `gating` / `seeds` 로부터 enabled 반영 / seed 당 entry(primary-우선
 * username · host="github.com" · apiBaseUrl 단일 원천 · path 형태 · hasAuthorizationHeader
 * 존재 boolean) 규칙을 **독립 재유도(oracle)** 한 결과와 필드별 정합(전체 byte-identical)함을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 collection leg plan 조립 규칙 drift-guard).
 *
 * 형제 `assertRealDataE2eEvalChainCollectRequestConsistent`(T-0981)의 collection-plan-leg
 * mirror — 차이점: 재유도 source 가 요청 조립 규칙(host/path 귀속·per_page bound)이 아니라
 * plan 조립 규칙(enabled 반영·seed→entry 매핑·primary-우선 선택·apiBaseUrl 단일 원천)의
 * 독립 재구현이다(producer 를 호출하면 자기 자신 대조라 무의미). 단 apiBaseUrl 만 producer 와
 * 동일 단일 원천 `resolveGithubApiBaseUrl` 을 재사용한다(base URL 규칙 이중 정의 회피).
 *
 * 검증하는 불변식(single source — 규칙 독립 재유도):
 *   - gating.enabled=false → expected { enabled:false, entries:[] }.
 *   - gating.enabled=true → seed 당 entry 1 건: username=primary-우선 github.com externalId ·
 *     host="github.com" · apiBaseUrl=resolveGithubApiBaseUrl("github.com") ·
 *     path=`/users/{username}/events/public` · hasAuthorizationHeader=
 *     (typeof gating.githubPat==="string" && trim.length>0).
 *   가 `plan` 의 대응 필드와 정합(전체 deep-equal byte-identical).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `gating` 비-객체 · `seeds` 비-배열 · `plan` 비-객체/enabled 비-boolean/entries 비-배열
 *     · seed 재유도 불가(github.com identity 부재/빈 externalId) → 한국어 TypeError.
 *   - enabled / entries 길이 / entry 슬롯 / 전체 구조 drift → 한국어 RangeError(어긋난
 *     슬롯명 + 기대/실측 포함). 🔥 §9: githubPat 실 값은 메시지에 담지 않는다(존재 boolean만).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(gating · seeds · plan) → enabled 반영 → entries 길이 → entry 슬롯(순서대로
 * username → host → apiBaseUrl → path → hasAuthorizationHeader) → 전체 byte-identical.
 * 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: 세 인자를 읽기·비교만 한다(쓰기 0). 부수효과 0 · 네트워크/LLM/DB/env 읽기
 * 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 plan 이면 항상 void, drift 면 항상
 * 동일 지점에서 throw).
 *
 * @param gating plan 조립 시 사용한 gating 결과(enabled 반영·githubPat 존재 재유도 source).
 *   비-객체면 TypeError. 🔥 githubPat 실 값은 메시지에 노출하지 않는다(§9). 변형하지 않는다.
 * @param seeds plan 조립 시 사용한 seed descriptor 배열(seed→entry·username 재유도 source).
 *   비-배열이면 TypeError. 변형하지 않는다.
 * @param plan 검증 대상 `buildRealDataGithubCollectionPlan` 산출 plan. 재유도 expected 와
 *   모든 조립 필드가 정합해야 한다. 변형하지 않는다.
 * @param label 에러 메시지 접두 라벨(디버깅 문맥). 기본값 "githubCollectionPlan".
 * @returns 모든 조립 필드가 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `gating` 비-객체 · `seeds` 비-배열 · `plan` 구조/타입 결손 · seed
 *   재유도 불가(구조/타입 결손).
 * @throws {RangeError} enabled / entries 길이 / entry 슬롯 / 전체 구조 drift(값 정합 위반).
 *   메시지에 어긋난 슬롯명 + 기대/실측 포함(단 githubPat 실 값은 §9 로 미노출).
 */
export function assertRealDataGithubCollectionPlanConsistent(
  gating: RealDataE2eLiveGating,
  seeds: RealDataSeedDescriptor[],
  plan: RealDataE2eGithubCollectionPlan,
  label = "githubCollectionPlan",
): void {
  // 구조 검증(TypeError 분기) — gating 객체 + seeds 배열 + plan 객체/enabled boolean/entries 배열.
  assertGatingStructure(gating, label);
  assertSeedsStructure(seeds, label);
  assertPlanStructure(plan, label);

  // 기대값 독립 재유도 — producer 를 호출하지 않고 조립 규칙을 재구현한다(drift 대조의 핵심).
  const expected = deriveExpectedPlan(gating, seeds, label);

  // enabled 반영 정합(값 drift → RangeError). enabled 반영 규칙이 뒤집히면 차단된다.
  if (plan.enabled !== expected.enabled) {
    throw new RangeError(
      `${label}: 정합 위반: plan.enabled 가 재유도 expected(gating.enabled 반영)와 다르다 — 기대=${JSON.stringify(expected.enabled)}, 실측=${JSON.stringify(plan.enabled)}.`,
    );
  }

  // entries 길이 정합(seed 당 정확히 1 entry — 누락/과잉/enabled=false 인데 비어있지 않음 catch).
  if (plan.entries.length !== expected.entries.length) {
    throw new RangeError(
      `${label}: 정합 위반: plan.entries 길이가 재유도 expected(seed 당 entry 1 건)와 다르다 — 기대=${expected.entries.length}, 실측=${plan.entries.length}.`,
    );
  }

  // entry 슬롯별 정합(username/host/apiBaseUrl/path/hasAuthorizationHeader drift → RangeError).
  for (let index = 0; index < expected.entries.length; index += 1) {
    assertEntryConsistent(
      plan.entries[index],
      expected.entries[index],
      index,
      label,
    );
  }

  // 전체 byte-identical 정합(위 슬롯 검사가 놓친 잔여 key 유입 등 최종 그물). 정합이면 여기
  // 통과 후 void. 방어적 최종 대조 — 위 슬롯 검사가 모든 필드를 커버하지만 미래 필드 추가
  // 시에도 drift 를 catch 한다.
  if (!deepEqual(plan, expected)) {
    throw new RangeError(
      `${label}: 정합 위반: plan 이 재유도 expected 와 byte-identical 하지 않다(잔여 구조 drift) — 기대=${JSON.stringify(expected)}, 실측=${JSON.stringify(plan)}.`,
    );
  }
}

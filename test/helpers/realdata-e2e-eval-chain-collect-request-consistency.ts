// realdata-e2e-eval-chain-collect-request-consistency.ts — 실 평가 e2e full-chain 수집
// leg 의 github 수집 round-trip 요청 조립(`buildRealDataE2eEvalChainCollectRequest`,
// T-0980) ↔ 독립 oracle 재유도 byte-identical 정합 순수 가드 (T-0981 박제, PLAN.md
// 109행 수집 leg 의 요청 조립 규칙 drift-guard).
//
// 책임:
//   - `buildRealDataE2eEvalChainCollectRequest(entry, token)`(T-0980,
//     `realdata-e2e-eval-chain-collect-request.ts`)는 수집 plan entry(host/path)와 인증
//     token 을 `GithubRequestInput` 으로 조립하며 (a) host 귀속(host===entry.host),
//     (b) path 귀속(path===entry.path), (c) `query.per_page="1"` bounded single
//     round-trip(T-0245 상한), (d) token 을 반환 `.token` 필드로만 통과(§9 로그/메시지
//     노출 0)시키는 **결정론적 요청 조립 규칙의 단일 지점**이다. 이 helper 는 이 스트림의
//     sibling 관례인 독립 `-consistency` drift-guard 를 아직 갖지 못했다 — 조립 규칙이
//     조용히 회귀(예: per_page 를 "2"/무제한으로 확장, host/path 귀속 교체, token 을 host
//     필드로 오배선)해도 colocated unit spec 만으로는 spec 이 함께 수정되면 통과할 수 있다.
//     본 가드가 그 빈칸을 **독립 재유도(oracle)** 로 채운다. 형제 activity-map leg 은
//     T-0979 가, input descriptor leg 은 T-0976/T-0977 이 같은 짝을 봉했다.
//
// 검증하는 불변식(single source — helper 를 호출하지 않고 규칙을 독립 재구현):
//   - expected = host 귀속 / path 귀속 / per_page="1" bounded / token 필드-only 통과
//     규칙을 helper 와 무관하게 재유도해 산출한 `GithubRequestInput`. 인자로 받은 `result`
//     가 expected 와 필드별 정합(query 는 deep-equal byte-identical)함.
//     `buildRealDataE2eEvalChainCollectRequest` 를 호출하지 **않는다**(그러면 자기 자신
//     대조라 무의미) — 조립 규칙을 재유도해 대조하므로, 어느 한쪽 규칙이 drift 하는 순간
//     fail 한다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `entry` 비-객체(null 포함) · `token` 비-string · `result` 비-객체(null 포함)
//     → 한국어 TypeError.
//   - 재유도 expected 와 host / path / query.per_page / query 구조 / token 필드 drift
//     → 한국어 RangeError(어긋난 필드명 + 기대/실측 정보 포함).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 🔥 §9 / R-59 격리: token(github PAT)은 field 존재/동일성만 검증하고 그 **실 값은
//   throw 메시지에 절대 담지 않는다**(field 이름/형태만). host/path/per_page 는 비시크릿
//   구조값이라 기대/실측을 메시지에 노출해도 무방하다. raw 활동 데이터 미보관 — 결정론
//   요청 구조(host/path/query)만 참조한다.
//
// 비변형 / 순수: `entry` / `token` / `result` 를 읽기·비교만 한다(쓰기 0). 네트워크/LLM/
// DB/env 읽기 0 · 부수효과 0 · `@Injectable` 0 · Prisma 0 · 새 외부 dependency 0.
// production `src/` 변경 0(type-only import 재사용만). 동일 입력 → 동일 동작.
//
// Out of Scope(task T-0981):
//   - `realdata-e2e-eval-chain-collect-request.ts`(T-0980) 본문 수정 — 본 가드는 type-only
//     import · 재유도 비교 · throw 만(재정의 0). 특히 조립 반환 직전 self-wire 배선은 별도
//     후속 slice(T-0977 self-wire mirror).
//   - 자동 복구 / 재합성 / 기본값 채움 0 — 손상 요청을 고치지 않고 fail-fast throw.
import type { GithubRequestInput } from "../../src/github/github-request.builder";

import type { RealDataE2eGithubCollectionPlanEntry } from "./realdata-e2e-github-collection-live";

// bounded single round-trip 강제 상수의 **독립 재유도** — helper 의 상수를 import 하지
// 않고 규칙(per_page="1")을 oracle 안에서 다시 표현한다. helper 가 이 값을 바꾸면 본
// oracle 과 어긋나 fail 한다(drift 대조의 핵심).
const EXPECTED_BOUNDED_SINGLE_PER_PAGE = "1";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). token 은 이 함수로 값을 노출하지 않는다(typeof 라벨만).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// assertEntryStructure — 재유도 source(plan entry: host/path 귀속)의 최소 형태를 fail-fast
// 검증. 비-객체(null/undefined 포함)는 host/path 재유도 직전 TypeError 로 차단한다.
function assertEntryStructure(
  entry: RealDataE2eGithubCollectionPlanEntry | null | undefined,
  label: string,
): asserts entry is RealDataE2eGithubCollectionPlanEntry {
  if (entry === null || typeof entry !== "object") {
    throw new TypeError(
      `${label}: entry 가 객체가 아니다(타입: ${describe(entry)}) — 요청 조립 규칙을 재유도할 수 없다.`,
    );
  }
}

// assertTokenStructure — 재유도 입력 token(인증 field-only 통과 재유도 key)의 최소 형태를
// fail-fast 검증. 비-string 은 재유도 직전 TypeError 로 차단한다. 🔥 §9: token 실 값을
// 메시지에 담지 않는다(타입 라벨만).
function assertTokenStructure(
  token: string,
  label: string,
): asserts token is string {
  if (typeof token !== "string") {
    throw new TypeError(
      `${label}: token 이 string 이 아니다(타입: ${describe(token)}) — 인증 field 통과 규칙을 재유도할 수 없다.`,
    );
  }
}

// assertResultStructure — 검증 대상 result 의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함) → TypeError. 필드별 정합 비교 전 최소 형태 보장.
function assertResultStructure(
  result: GithubRequestInput | null | undefined,
  label: string,
): asserts result is GithubRequestInput {
  if (result === null || typeof result !== "object") {
    throw new TypeError(
      `${label}: result 가 객체가 아니다(타입: ${describe(result)}) — 요청 정합 비교를 진행할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. query 는 typed scalar(per_page)만
// 담는 얕은 map 이라 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e full-chain 수집 leg 의 요청 조립(`buildRealDataE2eEvalChainCollectRequest`
 * 산출 `result`)이, 동일 `entry` / `token` 으로부터 host 귀속 / path 귀속 / per_page="1"
 * bounded / token 필드-only 통과 규칙을 **독립 재유도(oracle)** 한 결과와 필드별 정합
 * (query 는 byte-identical)함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 수집 leg
 * 요청 조립 규칙 build-time drift-guard).
 *
 * 형제 `assertRealDataGithubEventActivityMappingConsistent`(T-0979)의 조립-leg mirror —
 * 차이점: 재유도 source 가 event→activity 매핑 규칙이 아니라 요청 조립 규칙(host/path
 * 귀속 · per_page bound · token field-only)의 독립 재구현이다(helper 를 호출하면 자기
 * 자신 대조라 무의미).
 *
 * 검증하는 불변식(single source — 규칙 독립 재유도):
 *   - hostExpected = entry.host
 *   - pathExpected = entry.path
 *   - queryExpected = { per_page: "1" }(bounded single, helper 상수 미import 재유도)
 *   - tokenExpected = 인자 token(반환 `.token` 필드로만 동일 값 통과)
 *   가 `result` 의 대응 필드와 정합(query 는 deep-equal byte-identical).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `entry` 비-객체 · `token` 비-string · `result` 비-객체 → 한국어 TypeError.
 *   - host / path / query.per_page / query 구조 / token 필드 drift → 한국어 RangeError
 *     (어긋난 필드명 + 기대/실측 정보 포함). 🔥 §9: token drift 는 field 존재/동일성만
 *     보고하고 token 실 값은 메시지에 담지 않는다(형태/field 이름만).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(entry · token · result) → host → path → query.per_page →
 * query byte-identical → token 필드 동일성. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: 세 인자를 읽기·비교만 한다(쓰기 0). 부수효과 0 · 네트워크/LLM/DB/env
 * 읽기 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 요청이면 항상 void, drift
 * 면 항상 동일 지점에서 throw).
 *
 * @param entry 조립 시 사용한 수집 plan entry(host/path 귀속 재유도 source — 비시크릿).
 *   비-객체면 TypeError. 변형하지 않는다.
 * @param token 조립 시 넘긴 평문 github PAT(반환 `.token` 필드-only 통과 재유도 key).
 *   비-string 이면 TypeError. 🔥 실 값은 메시지에 노출하지 않는다(§9). 변형하지 않는다.
 * @param result 검증 대상 `buildRealDataE2eEvalChainCollectRequest` 산출 `GithubRequestInput`.
 *   재유도 expected 와 모든 조립 필드가 정합해야 한다. 변형하지 않는다.
 * @param label 에러 메시지 접두 라벨(디버깅 문맥 — 다중 요청 검증 시 어느 건인지 구분).
 *   기본값 "collectRequest".
 * @returns 모든 조립 필드가 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `entry` 비-객체 · `token` 비-string · `result` 비-객체(구조/타입 결손).
 * @throws {RangeError} host / path / query.per_page / query 구조 / token 필드 drift(값
 *   정합 위반). 메시지에 어긋난 필드명 + 기대/실측 포함(단 token 실 값은 §9 로 미노출).
 */
export function assertRealDataE2eEvalChainCollectRequestConsistent(
  entry: RealDataE2eGithubCollectionPlanEntry,
  token: string,
  result: GithubRequestInput,
  label = "collectRequest",
): void {
  // 구조 검증(TypeError 분기) — entry 객체 + token string + result 객체 최소 형태.
  assertEntryStructure(entry, label);
  assertTokenStructure(token, label);
  assertResultStructure(result, label);

  // 기대값 독립 재유도 — helper 를 호출하지 않고 조립 규칙을 재구현한다(drift 대조의 핵심).
  // helper 의 귀속/bound/field 통과 규칙이 조용히 바뀌면 본 oracle 산출과 어긋나 아래
  // 비교에서 fail 한다.
  const hostExpected = entry.host;
  const pathExpected = entry.path;
  const queryExpected = { per_page: EXPECTED_BOUNDED_SINGLE_PER_PAGE };

  // host 귀속 정합(값 drift → RangeError). host===entry.host 규칙이 다른 값으로 교체되면
  // 차단된다. host 는 비시크릿이라 기대/실측 노출 무방.
  if (result.host !== hostExpected) {
    throw new RangeError(
      `${label}: 정합 위반: result.host 가 재유도 expected(entry.host 귀속)와 다르다 — 기대=${JSON.stringify(hostExpected)}, 실측=${JSON.stringify(result.host)}.`,
    );
  }

  // path 귀속 정합(값 drift → RangeError). path===entry.path 규칙이 교체되면 차단.
  if (result.path !== pathExpected) {
    throw new RangeError(
      `${label}: 정합 위반: result.path 가 재유도 expected(entry.path 귀속)와 다르다 — 기대=${JSON.stringify(pathExpected)}, 실측=${JSON.stringify(result.path)}.`,
    );
  }

  // query.per_page bounded single 정합(값 drift → RangeError). per_page="1" 이 "2"/무제한/
  // 누락으로 확장·변형되면 차단된다(T-0245 round-trip 1 회 상한 보호).
  const actualPerPage = result.query?.per_page;
  if (actualPerPage !== EXPECTED_BOUNDED_SINGLE_PER_PAGE) {
    throw new RangeError(
      `${label}: 정합 위반: result.query.per_page 가 재유도 expected(bounded single "1")와 다르다 — 기대=${JSON.stringify(EXPECTED_BOUNDED_SINGLE_PER_PAGE)}, 실측=${JSON.stringify(actualPerPage)}.`,
    );
  }

  // query 구조 byte-identical 정합(추가 key 유입 → RangeError). per_page 외 다른 query
  // 파라미터(무제한 확장 통로 등)가 조용히 유입되면 expected 와 어긋나 차단된다.
  if (!deepEqual(result.query, queryExpected)) {
    throw new RangeError(
      `${label}: 정합 위반: result.query 가 재유도 expected 와 byte-identical 하지 않다(bounded single per_page 만 허용) — 기대=${JSON.stringify(queryExpected)}, 실측=${JSON.stringify(result.query)}.`,
    );
  }

  // 🔥 §9: token 필드-only 통과 정합. 인자 token 과 result.token 이 동일 값이어야 한다.
  //   drift(다른 값/undefined/host 필드로 오배선 등) 시 RangeError 이되, 메시지에 token
  //   실 값(기대/실측 어느 쪽도)을 담지 않는다 — 동일성 boolean·field 존재/형태만 보고한다.
  if (result.token !== token) {
    throw new RangeError(
      `${label}: 정합 위반: result.token 이 재유도 expected(인자 token 과 field-only 동일 통과)와 다르다 — token 실 값은 §9 로 미노출(동일성 불일치, 실측 token 존재=${JSON.stringify(typeof result.token === "string")}).`,
    );
  }
}

// realdata-e2e-result-issue-search-parse-consistency.ts — 실 평가 e2e 결과 이슈
// 검색 파서 `parseRealDataResultIssueSearchOutput`(T-0587) 의 **산출**
// (`RealDataResultIssueSearchHit[]`) 이 raw `gh search issues --json
// number,title,body` stdout 으로부터 **독립 재유도**한 expected 배열과 deep-equal
// 정합한지 검증하는 순수 가드(T-0721 박제).
//
// 동기: NO-GUARD-value leaf 컴포저 `parseRealDataResultIssueSearchOutput`(T-0587,
// realdata-e2e-result-issue-search-parse.ts)은 현재 per-hit 키 집합 set-equality 가드
// `assertRealDataResultIssueSearchHitMatchesParseShape`(T-0659/T-0660, 각 hit 의 키
// 집합이 선언 parse-shape 와 set-equal 인지 **shape** 만 검증) 만 self-wire 한다. 그러나
// 파서 산출 `RealDataResultIssueSearchHit[]` **전체**가 raw stdout 으로부터 올바른
// 개수·순서·필드값으로 단조 재유도됐는지(추가 필드 drop·number/title/body 값·hit 개수·
// 정렬)를 검증하는 **값-정합 가드는 부재**였다 — set-equality 가드는 키 집합만 보므로
// number/title/body **값**이 drift 하거나 hit 이 누락·중복·재정렬돼도 통과한다. 본 가드는
// 컴포저 재호출 없이 stdout 만으로 expected 를 독립 재유도(JSON.parse → 배열 필터 → 각
// 원소 `{number,title,body}` 추출)한 뒤 산출 `hits` 와 deep-equal 대조해, 그 값 drift 가
// build-time fail-fast 로 차단되게 한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0
// — 파서가 silent 하게 추가 필드를 누설하거나 hit 을 누락/중복하면 손상 산출이 caller
// resolver(T-0584)로 새기 전 차단). T-0711(result-summary-line value-guard) mirror.
//
// 재유도 규칙(single-source 동형): 컴포저(T-0587)와 동일한 검증 규약을 **독립 재구현**한다
// — `JSON.parse(stdout)` 이 배열이어야 하고, 각 원소가 non-null 객체여야 하며,
// `number` 가 양의 정수, `title`/`body` 가 문자열이어야 한다. 통과 원소를 `{number,
// title, body}` 만 담은 새 객체로 정규화(추가 필드 drop)한다. 컴포저
// (`parseRealDataResultIssueSearchOutput`)는 **호출하지 않는다** — 재호출 deep-equal 은
// 양방향 drift 상쇄라 무의미하다(독립 재유도가 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `hits` 가 배열 아님·원소가 non-null 객체 아님·stdout 이 string 아님 등 입력 자체의
//     구조 결손 → 한국어 TypeError(재유도 자체를 진행할 수 없는 경우).
//   - stdout 이 비-JSON(SyntaxError) / JSON 이 비배열 / 원소가 비객체 / number 비양정수 /
//     title·body 비문자열 → 재유도 단계의 구조 결손 → 한국어 TypeError.
//   - 재유도 expected 와 산출 `hits` 가 개수·순서·필드값·추가필드 drop 면에서 어긋남 →
//     한국어 RangeError(값 정합 위반, 기대 vs 실측 노출).
//   - silent 통과 0, fail-fast. 공백·대소문자 민감(trim·case-fold 0).
//
// 비변형 / 순수: hits·stdout 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential·gh 실행 0. 동일 입력 → 동일 동작. raw
// narrative 미저장(R-59 / REQ-032) — number(식별자)·title/body 의 string 동치만 비교하며
// 에러 메시지에 raw 활동 본문·credential 을 누설하지 않는다(필드 타입·개수·index 만 노출).
//
// Out of Scope (T-0721): 컴포저 본문 수정 / self-wire 배선(후속 task — T-0711→T-0712
// 분리 패턴 동형) · per-hit set-equality 가드(T-0659/T-0660) 수정 · 자동 복구/재합성/
// 정규화 · zod·ajv 등 외부 validation 도입 · production `src/` 변경 — 전부 0.
import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";

// reDeriveExpectedHits — raw stdout 만으로 expected `RealDataResultIssueSearchHit[]` 를
// **독립 재유도**한다. 컴포저(T-0587)의 검증 규약(배열 → non-null 객체 → number 양정수 →
// title/body 문자열 → `{number,title,body}` 정규화)을 의도적으로 재구현
// (`parseRealDataResultIssueSearchOutput` 재호출 0 — 재호출은 양방향 drift 상쇄로
// 의미가 없다). 구조 결손은 TypeError 로 분기한다(값 정합 위반 RangeError 와 구분). 입력
// stdout 은 불변 문자열이라 mutate 불가.
function reDeriveExpectedHits(stdout: string): RealDataResultIssueSearchHit[] {
  if (typeof stdout !== "string") {
    throw new TypeError(
      `stdout 이 string 이 아니다 — raw gh 출력 재유도를 진행할 수 없다(타입: ${typeof stdout}, 값: ${String(stdout)}).`,
    );
  }

  // JSON.parse — 비-JSON 이면 SyntaxError 가 전파된다. 명세형 한국어 TypeError 로 감싸
  // 구조 결손임을 명시한다(silent 통과 0).
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (cause) {
    throw new TypeError(
      `stdout 이 유효한 JSON 이 아니다 — gh 출력 재유도를 진행할 수 없다(원인: ${
        cause instanceof Error ? cause.message : String(cause)
      }).`,
    );
  }

  // 배열 guard — gh `--json` 출력은 배열이어야 한다(object/string/number/null 차단).
  if (!Array.isArray(parsed)) {
    throw new TypeError(
      `stdout 의 JSON 이 배열이 아니다(${typeof parsed}) — \`gh search issues --json\` 은 배열을 산출해야 하므로 재유도를 진행할 수 없다.`,
    );
  }

  return parsed.map((element: unknown, index: number) => {
    // 원소 객체 guard — null / 숫자 / 문자열 등 비객체 차단(typeof null === "object" 라
    // null 을 별도 배제).
    if (typeof element !== "object" || element === null) {
      throw new TypeError(
        `stdout JSON 원소[${index}] 가 객체가 아니다(${String(element)}) — 각 hit 은 {number, title, body} 객체여야 한다.`,
      );
    }

    const record = element as Record<string, unknown>;

    // number 양의 정수 guard.
    if (
      typeof record.number !== "number" ||
      !Number.isInteger(record.number) ||
      record.number <= 0
    ) {
      throw new TypeError(
        `stdout JSON 원소[${index}].number 가 양의 정수가 아니다(${String(
          record.number,
        )}) — 0 이하/비정수/비숫자 number 는 재유도 대상이 아니다.`,
      );
    }

    // title / body 문자열 guard.
    if (typeof record.title !== "string") {
      throw new TypeError(
        `stdout JSON 원소[${index}].title 가 문자열이 아니다(${String(
          record.title,
        )}) — 비문자열 title 은 재유도 대상이 아니다.`,
      );
    }
    if (typeof record.body !== "string") {
      throw new TypeError(
        `stdout JSON 원소[${index}].body 가 문자열이 아니다(${String(
          record.body,
        )}) — 비문자열 body 는 재유도 대상이 아니다.`,
      );
    }

    // 정규화 — `{number, title, body}` 만 추출(추가 필드 drop). 새 객체(무공유).
    return {
      number: record.number,
      title: record.title,
      body: record.body,
    };
  });
}

// assertHitsStructure — 산출 `hits` 가 재유도 expected 와 deep-equal 비교를 진행하기 전
// 구조적으로 온전한지(배열·각 원소 non-null 객체) fail-fast 검증한다. 구조 결손은
// RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리). 본 함수는 deep-equal
// 비교가 비객체 원소 접근으로 모호하게 실패하기 전에 명세형 한국어 메시지로 먼저 차단하는
// 역할이다.
function assertHitsStructure(
  hits: RealDataResultIssueSearchHit[],
): asserts hits is RealDataResultIssueSearchHit[] {
  if (!Array.isArray(hits)) {
    throw new TypeError(
      `hits 가 배열이 아니다(${typeof hits}, 값: ${String(
        hits,
      )}) — 파서 산출은 RealDataResultIssueSearchHit[] 여야 한다.`,
    );
  }
  hits.forEach((hit, index) => {
    if (typeof hit !== "object" || hit === null) {
      throw new TypeError(
        `hits[${index}] 가 객체가 아니다(${String(
          hit,
        )}) — 각 hit 은 {number, title, body} 객체여야 한다.`,
      );
    }
  });
}

// areHitsDeepEqual — 두 `RealDataResultIssueSearchHit[]` 가 개수·순서·필드값(number ===,
// title ===, body ===) 면에서 deep-equal 인지 비교한다. 추가 필드 drop 정합은 산출 hit 의
// 키 집합이 정확히 `{number,title,body}` 인지 함께 검사해 누설을 잡는다(재유도 expected
// 는 항상 3 키만 가지므로 산출이 추가 키를 누설하면 불일치). 순수 비교(쓰기 0).
function areHitsDeepEqual(
  actual: RealDataResultIssueSearchHit[],
  expected: RealDataResultIssueSearchHit[],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  return actual.every((hit, index) => {
    const exp = expected[index];
    // 추가필드 drop 정합 — 산출 hit 이 정확히 3 키({number,title,body})만 가져야 한다.
    if (Object.keys(hit).length !== 3) {
      return false;
    }
    return (
      hit.number === exp.number &&
      hit.title === exp.title &&
      hit.body === exp.body
    );
  });
}

/**
 * 실 평가 e2e 결과 이슈 검색 파서 산출 `hits` 의 **값**이 raw `stdout` 으로부터 독립
 * 재유도한 expected 배열과 deep-equal 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5
 * 109행 step ④ 표현 surface 무결성 조각 / REQ-059·REQ-032).
 * `parseRealDataResultIssueSearchOutput`(T-0587) per-hit set-equality 가드(T-0660) 보완
 * mirror — 그 가드는 각 hit 의 키 집합만 검증하므로 number/title/body 값 drift·hit 누락/
 * 중복/재정렬을 놓치지만, 본 가드는 stdout 을 독립 재유도해 값 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: expected = `JSON.parse(stdout)` 을 배열 필터 → 각 원소 `{number,title,body}`
 * 추출로 독립 재유도한 배열. 산출 `hits` 와 개수·순서·필드값·키 집합(추가필드 drop)이
 * 전부 deep-equal(===) 이어야 한다. 컴포저 재호출 0(독립 재유도).
 *
 * 에러 정책: hits 비배열·원소 비객체·stdout 비-string/비-JSON/비배열·원소 number 비양정수·
 * title·body 비문자열 → TypeError(구조 결손). 재유도 expected 와 hits 가 개수·순서·필드값·
 * 추가필드 면에서 drift → RangeError(기대 vs 실측 노출, 값 정합 위반). silent 통과 0,
 * fail-fast. 공백·대소문자 민감(trim·case-fold 0).
 *
 * @param hits 검증 대상 파서 산출(`parseRealDataResultIssueSearchOutput` 결과). 변형하지
 *   않는다(읽기·비교만).
 * @param stdout 산출의 single source raw gh 출력. 변형하지 않는다(읽기·재유도만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} hits 비배열/원소 비객체 또는 stdout 비-string/비-JSON/비배열·원소
 *   number 비양정수·title/body 비문자열(구조 결손).
 * @throws {RangeError} 재유도 expected 와 hits 가 개수·순서·필드값·추가필드 drift(값 정합
 *   위반, 기대 vs 실측 포함).
 */
export function assertRealDataResultIssueSearchOutputConsistentWithStdout(
  hits: RealDataResultIssueSearchHit[],
  stdout: string,
): void {
  // 구조 검증(TypeError 분기) — hits 배열·원소 객체 + stdout 재유도(내부에서 stdout
  // string/JSON/배열/원소 구조 검증).
  assertHitsStructure(hits);
  const expected = reDeriveExpectedHits(stdout);

  // 값 정합 비교(RangeError 분기) — 개수·순서·필드값·추가필드 deep-equal.
  if (!areHitsDeepEqual(hits, expected)) {
    throw new RangeError(
      `정합 위반: 파서 산출 hits 가 stdout 으로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${JSON.stringify(
        expected,
      )}, 실측=${JSON.stringify(
        hits,
      )}. hit 개수·순서·number/title/body 값 또는 추가필드 drop 이 drift 했거나 stdout 과 어긋났다.`,
    );
  }
}

// realdata-e2e-result-issue-output-parse-consistency.ts — 실 평가 e2e 결과 이슈
// 출력 파서 `parseRealDataResultIssueCreateEditOutput`(T-0589) 의 **산출**
// (`RealDataResultIssueOutcome` = `{issueNumber, url}`) 이 raw `gh issue create` /
// `gh issue edit <n>` stdout(이슈 URL 을 포함한 문자열)으로부터 **독립 재유도**한
// expected 와 deep-equal 정합한지 검증하는 순수 가드(T-0723 박제).
//
// 동기: NO-GUARD-value leaf 컴포저 `parseRealDataResultIssueCreateEditOutput`(T-0589,
// realdata-e2e-result-issue-output-parse.ts)은 현재 outcome 키 집합 set-equality 가드
// `assertRealDataResultIssueOutcomeMatchesParseShape`(T-0661/T-0662, 산출 outcome 의 키
// 집합이 선언 parse-shape 와 set-equal 인지 **shape** 만 검증) 만 self-wire 한다. 그러나
// 파서 산출 `{issueNumber, url}` **전체**가 raw stdout 으로부터 올바른 값(issueNumber 값·
// url trim 정규화·첫 매칭 URL 결정론)으로 단조 재유도됐는지를 검증하는 **값-정합 가드는
// 부재**였다 — set-equality 가드는 키 집합만 보므로 issueNumber/url **값**이 drift 하거나
// 잘못된 매칭 URL 이 선택돼도 통과한다. 본 가드는 컴포저 재호출 없이 stdout 만으로 expected
// 를 독립 재유도(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim →
// `{issueNumber, url}` 정규화)한 뒤 산출 `outcome` 과 deep-equal 대조해, 그 값 drift 가
// build-time fail-fast 로 차단되게 한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0
// — 파서가 silent 하게 잘못된 issueNumber/url 을 산출하면 손상 outcome 이 caller live wiring
// 으로 새기 전 차단). T-0721 search-parse value-guard 의 post-execution mirror.
//
// 재유도 규칙(single-source 동형): 컴포저(T-0589)와 동일한 검증 규약을 **독립 재구현**한다
// — stdout 에서 `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭을 찾고
// (0건이면 throw), `<number>` 가 양의 정수여야 하며(0/선행 0/비정수 throw), 매칭된 URL
// 전체를 trim 한다. 통과분을 `{issueNumber, url}` 만 담은 새 객체로 정규화한다. 컴포저
// (`parseRealDataResultIssueCreateEditOutput`)는 **호출하지 않는다** — 재호출 deep-equal
// 은 양방향 drift 상쇄라 무의미하다(독립 재유도가 핵심). ISSUE_URL_PATTERN 정규식과
// 양정수 규약은 컴포저와 byte-identical 하게 본 모듈이 재선언한다(재호출 0 원칙 유지).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `outcome` 이 non-null 객체 아님·stdout 이 string 아님 등 입력 자체의 구조 결손 →
//     한국어 TypeError(재유도/비교 자체를 진행할 수 없는 경우).
//   - stdout 에 issue URL 매칭 0건(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로)·
//     `<number>` 비양정수(`/issues/0`·선행 0·`/issues/abc`) → 재유도 단계의 구조 결손 →
//     한국어 TypeError.
//   - 재유도 expected 와 산출 outcome 의 issueNumber/url 값이 어긋남 → 한국어 RangeError
//     (값 정합 위반, 기대 vs 실측 노출).
//   - silent 통과 0, fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0 — URL 전체 trim
//     은 컴포저 규약 그대로 재현).
//
// 비변형 / 순수: outcome·stdout 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential·gh 실행 0. 동일 입력 → 동일 동작. raw
// narrative 미저장(R-59 / REQ-032) — issueNumber(식별자)·url 의 string 동치만 비교하며
// 에러 메시지에 raw 활동 본문·credential 을 누설하지 않는다(issueNumber·url 값·키 집합만
// 노출, 비-issue 본문 미보유).
//
// Out of Scope (T-0723): 컴포저 본문 수정 / self-wire 배선(후속 task — T-0721→T-0722
// 분리 패턴 동형) · outcome set-equality 가드(T-0661/T-0662) 수정 · 자동 복구/재합성/
// 정규화 · zod·ajv 등 외부 validation 도입 · production `src/` 변경 — 전부 0.
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// GitHub issue URL 패턴 — 컴포저(realdata-e2e-result-issue-output-parse.ts line 79~80)와
// byte-identical 재선언. `https://github.com/<owner>/<repo>/issues/<number>`. 컴포저 상수는
// export 되지 않으므로 본 모듈이 동일 규약을 독립 재선언한다(재호출 0 원칙 유지 — 재호출
// deep-equal 은 양방향 drift 상쇄라 무의미). 정규식이 컴포저와 어긋나면 본 가드가 곧바로
// 값 정합 위반을 일으켜 drift 자체가 노출된다.
const ISSUE_URL_PATTERN =
  /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)(?![\w])/;

// reDeriveExpectedOutcome — raw stdout 만으로 expected `RealDataResultIssueOutcome` 를
// **독립 재유도**한다. 컴포저(T-0589)의 검증 규약(첫 매칭 URL → `<number>` 양의 정수 →
// URL 전체 trim → `{issueNumber, url}` 정규화)을 의도적으로 재구현
// (`parseRealDataResultIssueCreateEditOutput` 재호출 0 — 재호출은 양방향 drift 상쇄로
// 의미가 없다). 구조 결손(stdout 비-string·URL 미발견·number 비양정수)은 TypeError 로
// 분기한다(값 정합 위반 RangeError 와 구분). 입력 stdout 은 불변 문자열이라 mutate 불가.
function reDeriveExpectedOutcome(stdout: string): RealDataResultIssueOutcome {
  if (typeof stdout !== "string") {
    throw new TypeError(
      `stdout 이 string 이 아니다 — raw gh 출력 재유도를 진행할 수 없다(타입: ${typeof stdout}, 값: ${String(stdout)}).`,
    );
  }

  // URL 매칭 — 첫 매칭만 사용(결정론). 0건(빈/공백/무관 텍스트/비-github 호스트/`/pull/`
  // 경로 등)이면 구조 결손 TypeError.
  const match = ISSUE_URL_PATTERN.exec(stdout);
  if (match === null) {
    throw new TypeError(
      `stdout 에서 issue URL(https://github.com/<owner>/<repo>/issues/<number>)을 찾지 못했다 — 빈/무관 텍스트·비-github 호스트·비-issue 경로는 재유도 대상이 아니다.`,
    );
  }

  // `<number>` 양의 정수 검증 — 0/선행 0/비정수면 구조 결손 TypeError(정규 십진 양의 정수만
  // 허용, 컴포저 assertPositiveIssueNumber 규약 동형).
  const rawNumber = match[1];
  if (!/^[1-9]\d*$/.test(rawNumber)) {
    throw new TypeError(
      `stdout issue URL 의 number 가 양의 정수가 아니다(${rawNumber}) — 0/선행 0/비정수 번호는 재유도 대상이 아니다.`,
    );
  }

  // 정규화 — 매칭된 URL 전체를 trim, `{issueNumber, url}` 만 추출(추가 필드 0). 새 객체(무공유).
  return {
    issueNumber: Number(rawNumber),
    url: match[0].trim(),
  };
}

// assertOutcomeStructure — 산출 `outcome` 이 deep-equal 비교를 진행하기 전 구조적으로
// 온전한지(non-null 객체·비배열) fail-fast 검증한다. 구조 결손은 RangeError 가 아니라
// TypeError 로 구분한다(값 정합 위반과 분리). 본 함수는 deep-equal 비교가 비객체 접근으로
// 모호하게 실패하기 전에 명세형 한국어 메시지로 먼저 차단하는 역할이다.
function assertOutcomeStructure(
  outcome: RealDataResultIssueOutcome,
): asserts outcome is RealDataResultIssueOutcome {
  if (typeof outcome !== "object" || outcome === null) {
    throw new TypeError(
      `outcome 이 non-null 객체가 아니다(타입: ${typeof outcome}, 값: ${String(
        outcome,
      )}) — 파서 산출은 RealDataResultIssueOutcome({issueNumber, url}) 객체여야 한다.`,
    );
  }
  if (Array.isArray(outcome)) {
    throw new TypeError(
      "outcome 이 배열이다 — outcome 은 {issueNumber, url} 키-값 객체여야 하며 배열일 수 없다.",
    );
  }
}

// isOutcomeDeepEqual — 두 `RealDataResultIssueOutcome` 가 issueNumber(===)·url(===)·
// 추가필드 drop(키 정확히 2개) 면에서 deep-equal 인지 비교한다. 재유도 expected 는 항상
// `{issueNumber, url}` 2 키만 가지므로 산출이 추가 키를 누설하면 키 개수(≠2) 불일치로
// 잡는다. 순수 비교(쓰기 0).
function isOutcomeDeepEqual(
  actual: RealDataResultIssueOutcome,
  expected: RealDataResultIssueOutcome,
): boolean {
  // 추가필드 drop 정합 — 산출 outcome 이 정확히 2 키({issueNumber, url})만 가져야 한다.
  if (Object.keys(actual).length !== 2) {
    return false;
  }
  return (
    actual.issueNumber === expected.issueNumber && actual.url === expected.url
  );
}

/**
 * 실 평가 e2e 결과 이슈 출력 파서 산출 `outcome` 의 **값**이 raw `stdout` 으로부터 독립
 * 재유도한 expected 와 deep-equal 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5
 * 109행 step ④ 결과 박제 chain 의 표현 surface 무결성 조각 / REQ-059·REQ-032).
 * `parseRealDataResultIssueCreateEditOutput`(T-0589) outcome set-equality 가드(T-0662)
 * 보완 mirror — 그 가드는 outcome 의 키 집합만 검증하므로 issueNumber/url 값 drift·잘못된
 * 매칭 URL 선택을 놓치지만, 본 가드는 stdout 을 독립 재유도해 값 회귀를 fail-fast 로 잡는다.
 * T-0721 search-parse value-guard 의 post-execution mirror.
 *
 * 불변식: expected = stdout 에서 ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 →
 * URL 전체 trim → `{issueNumber, url}` 정규화로 독립 재유도한 객체. 산출 `outcome` 과
 * issueNumber·url 값·키 집합(추가필드 drop)이 전부 deep-equal(===) 이어야 한다. 컴포저
 * 재호출 0(독립 재유도).
 *
 * 에러 정책: outcome 비-non-null-객체/배열·stdout 비-string·stdout URL 미발견·`<number>`
 * 비양정수 → TypeError(구조 결손). 재유도 expected 와 outcome 이 issueNumber/url 값·추가
 * 필드 면에서 drift → RangeError(기대 vs 실측 노출, 값 정합 위반). silent 통과 0,
 * fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0).
 *
 * @param outcome 검증 대상 파서 산출(`parseRealDataResultIssueCreateEditOutput` 결과).
 *   변형하지 않는다(읽기·비교만).
 * @param stdout 산출의 single source raw gh 출력. 변형하지 않는다(읽기·재유도만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} outcome 비-non-null-객체/배열 또는 stdout 비-string·URL 미발견·
 *   `<number>` 비양정수(구조 결손).
 * @throws {RangeError} 재유도 expected 와 outcome 이 issueNumber/url 값·추가필드 drift(값
 *   정합 위반, 기대 vs 실측 포함).
 */
export function assertRealDataResultIssueOutputConsistentWithStdout(
  outcome: RealDataResultIssueOutcome,
  stdout: string,
): void {
  // 구조 검증(TypeError 분기) — outcome non-null 객체 + stdout 재유도(내부에서 stdout
  // string·URL 매칭·number 양정수 구조 검증).
  assertOutcomeStructure(outcome);
  const expected = reDeriveExpectedOutcome(stdout);

  // 값 정합 비교(RangeError 분기) — issueNumber·url 값·추가필드 deep-equal.
  if (!isOutcomeDeepEqual(outcome, expected)) {
    throw new RangeError(
      `정합 위반: 파서 산출 outcome 이 stdout 으로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${JSON.stringify(
        expected,
      )}, 실측=${JSON.stringify(
        outcome,
      )}. issueNumber/url 값 또는 추가필드 drop 이 drift 했거나 stdout 과 어긋났다(첫 매칭 URL·trim 정규화 포함).`,
    );
  }
}

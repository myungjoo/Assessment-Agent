// realdata-e2e-result-issue-output-parse.ts — 실 평가 e2e 결과 이슈
// `gh issue create` / `gh issue edit <n>` 의 stdout(이슈 URL 한 줄) →
// `RealDataResultIssueOutcome` 순수 파서·검증기 (T-0589 박제).
//
// 책임:
//   - build-time chain 의 **실행-후 해석(post-execution interpretation)** 측 누락 link
//     를 채운다. chain 의 양 끝은 이미 박제됨:
//     (a) T-0585 `buildRealDataResultIssueGhArgv` 가 `gh issue create` /
//         `gh issue edit <n>` 의 argv 를 합성하고,
//     (b) T-0588 `resolveRealDataResultIssueGhCommandPlan` 이 search stdout +
//         commandArgs → `{action, argv}` 종단 plan 을 산출한다.
//     그러나 caller(live wiring)가 `execFile('gh', argv)` 로 issue 를 실 박제한 뒤
//     **그 stdout(생성/수정된 이슈 URL) 을 `{issueNumber, url}` 로 파싱·검증하는
//     단계** 가 빠져있었다. 본 helper 가 그 (실행 후) 단계를 순수 함수로 박제한다.
//   - 본 파서는 T-0587 `parseRealDataResultIssueSearchOutput`(검색 응답 파싱, **실행
//     전** 측)의 정확한 대칭 — **실행 후** 측 stdout 파싱이다. 이 slice 가 박제되면
//     build-time chain 이 입력(search)부터 출력(create/edit 결과 확인)까지 round-trip
//     으로 닫힌다.
//
// 🔥 엄격 검증 (조용한 통과 금지):
//   - stdout 안에서 `https://github.com/<owner>/<repo>/issues/<number>` 패턴을 찾지
//     못하면 throw(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 등 다른 경로).
//     `<number>` 가 양의 정수로 파싱되지 않으면(`/issues/0`, `/issues/abc`) throw.
//     비정상 stdout 이 조용히 통과해 잘못된 outcome 으로 새는 것을 차단한다.
//   - issueNumber 규약은 T-0584 `assertPositiveNumber`(양의 정수)와 동형 — chain 의
//     다른 단계와 정합하도록 파싱 단계에서 선검증한다.
//
// 🔥 다중 줄 결정론 (첫 매칭 URL):
//   - gh 가 부가 메시지를 출력할 수 있어 stdout 은 여러 줄일 수 있다. issue URL 패턴을
//     포함한 첫 매칭을 사용해 결정론적으로 파싱한다(동일 stdout → byte-identical 결과).
//
// 🔥 raw 미저장 정합 (R-59 / REQ-059):
//   - 파서는 stdout 에서 issueNumber/url 만 추출하고 본문/narrative 는 보유하지 않는다.
//     출력 `RealDataResultIssueOutcome` 은 `{issueNumber, url}` 만 담는다.
//
// 🔥 결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 stdout 두 번 호출 → deep-equal 결과.
//     매 호출 새 객체를 반환 — 출력 객체 공유 0(입력 문자열은 불변이라 mutate 불가).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 라이브러리(zod 등) 0 — 내장 정규표현식 + 수동 검증만. 순수 함수.
//
// Out of Scope (task T-0589):
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행
//     (step ④ live wiring — credential gate). 본 파서는 stdout → outcome 만 산출(부수효과 0).
//   - argv 합성(T-0585 위임) · 종단 plan 합성(T-0588 위임) · search 응답 파싱(T-0587
//     위임) — 본 helper 는 create/edit stdout 파싱 단일 책임.
//   - 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 정규표현식 + 수동 검증만.
//   - production `src/` 코드 변경 — test helper 단독.
//   - raw issue 본문/narrative 보유·저장 — REQ-059 정합으로 issueNumber/url 만 추출.

// outcome↔parse-shape set-equality 가드(T-0661 신설)를 producer 산출 경로에 self-wire
// 한다(T-0662). 정규화한 `{issueNumber, url}` outcome 을 반환하기 직전에 self-assert 호출 —
// 파서가 선언 parse-shape 와 어긋난 키 집합의 outcome 을 산출하면 손상 outcome 을 caller 에
// 반환하기 전에 fail-fast throw(구조 결손=TypeError / set 불일치=RangeError). 가드 본문·상수
// 는 변경 0(T-0661 산출물 그대로 import 재사용). `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`
// 는 가드 모듈이 single-source 로 정의·export 한 것을 그대로 사용한다(search 측 re-export 와 달리
// post-execution 측엔 선행 상수가 없어 가드 모듈이 정의함).
import {
  assertRealDataResultIssueOutcomeMatchesParseShape,
  REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
} from "./realdata-e2e-result-issue-outcome-parse-shape";

// RealDataResultIssueOutcome — `gh issue create` / `gh issue edit` 실행 후 stdout 에서
// 추출한 박제 결과의 최소 shape.
//   - issueNumber: 생성/수정된 이슈 번호(양의 정수).
//   - url: 정규화된(trim 된) 이슈 URL.
export interface RealDataResultIssueOutcome {
  issueNumber: number;
  url: string;
}

// GitHub issue URL 패턴 — `https://github.com/<owner>/<repo>/issues/<number>`.
//   - owner/repo 는 `/` 를 포함하지 않는 segment(URL path 구조 보장).
//   - `<number>` 는 1+ 자리 숫자(양수 여부는 별도 검증 — `0`/선행 0 차단).
//   - 단어 경계로 capture 를 닫아 `/issues/42x` 같은 오염을 막는다(끝에 비숫자/끝).
// `/pull/` 등 다른 경로·비-github 호스트는 매칭되지 않아 자연히 throw 로 이어진다.
const ISSUE_URL_PATTERN =
  /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)(?![\w])/;

// issueNumber guard — gh 가 정상 URL 을 출력하면 number 는 항상 양의 정수다. `0` /
// 선행 0(`007`) / 비정상 값이면 파싱 사고로 간주하고 명시적 throw.
// T-0584 `assertPositiveNumber` 규약과 동형. 정규 십진 양의 정수(`[1-9]\d*`)만
// 허용하므로 통과 시 `Number(raw)` 는 항상 양의 정수 — 별도 재검증 불요.
function assertPositiveIssueNumber(raw: string): number {
  // 선행 0(`0`, `007`)은 비정상 issue 번호로 간주 — 정규 십진 양의 정수만 허용.
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(
      `gh issue stdout 의 issue 번호가 양의 정수가 아닙니다(${raw}) — gh 응답 파싱 사고 방지를 위해 0/선행 0/비정수 번호는 허용되지 않습니다.`,
    );
  }

  return Number(raw);
}

// parseRealDataResultIssueCreateEditOutput — `gh issue create` / `gh issue edit <n>`
// 의 stdout(이슈 URL 을 포함한 문자열)을 입력받아 `RealDataResultIssueOutcome` 로
// 파싱·검증하는 **순수 함수**.
//
// 동작:
//   - stdout 에서 `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭을 찾는다.
//     매칭 0건(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 등)이면 throw.
//   - 매칭된 `<number>` 를 양의 정수로 검증(0/선행 0/비정수 throw).
//   - 매칭된 URL 전체(trailing 개행/공백 trim)와 issueNumber 를 새 객체로 반환.
//
// 순수성·무공유:
//   - 입력 stdout(문자열)은 불변이라 mutate 불가. 매 호출이 새 객체를 반환 — 출력이
//     입력 / 다음 호출 결과와 무공유. 입력 외 상태 의존 0(결정론). 다중 줄 시 첫 매칭
//     URL 을 사용해 결정론적.
export function parseRealDataResultIssueCreateEditOutput(
  stdout: string,
): RealDataResultIssueOutcome {
  // URL 매칭 — 첫 매칭만 사용(결정론). 0건이면 throw(URL 미발견 분기).
  const match = ISSUE_URL_PATTERN.exec(stdout);
  if (match === null) {
    throw new Error(
      `gh issue stdout 에서 issue URL(https://github.com/<owner>/<repo>/issues/<number>)을 찾지 못했습니다 — 빈/무관 텍스트·비-github 호스트·비-issue 경로는 허용되지 않습니다.`,
    );
  }

  // number 검증(양의 정수 — 0/선행 0/비정수 throw).
  const issueNumber = assertPositiveIssueNumber(match[1]);

  // 매칭된 URL 전체를 정규화(trim). 새 객체 생성(무공유).
  const outcome: RealDataResultIssueOutcome = {
    issueNumber,
    url: match[0].trim(),
  };

  // self-wire(T-0662) — 정규화한 outcome 의 키 집합이 선언 parse-shape 와 set-equal 인지
  // 반환 직전 검증한다. 정상 파서 경로는 항상 `{issueNumber, url}` 만 산출하므로 throw 0
  // (검증만, 출력 비변형). 회귀로 키 집합이 어긋나면 손상 outcome 반환 전 fail-fast.
  assertRealDataResultIssueOutcomeMatchesParseShape(
    outcome,
    REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
  );

  return outcome;
}

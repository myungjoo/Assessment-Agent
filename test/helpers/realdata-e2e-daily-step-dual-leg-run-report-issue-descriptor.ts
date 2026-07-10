// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts — 실 평가 e2e
// daily-test 가 nightly 로 spawn 하는 eval leg + collect leg 두 jest run 의 dual-leg
// run report descriptor → daily-test 결과 rolling-issue 식별자/본문 descriptor 순수
// 빌더 (T-0896 박제).
//
// 책임:
//   - T-0894 의 `buildRealDataDailyStepDualLegRunReport` 가 두 leg 의 run outcome 을
//     하나의 `RealDataDailyStepDualLegRunReport` descriptor(gitSha/dateToken/per-leg
//     {action,status}/overallStatus/byte-identical summaryLine)로 묶고, T-0895 의
//     `renderRealDataDailyStepDualLegRunReportMarkdown` 가 그 descriptor 를 결정론적
//     마크다운 본문으로 렌더링한다. PLAN.md 109행 step ④ 는 그 결과를 "daily-test
//     result/rolling 이슈에 박제"하라 지시하므로, 실 gh issue wiring 직전에 **어떤
//     제목으로 / 어떤 멱등 marker 로 / 어떤 본문으로 박제할지**를 결정하는 순수
//     descriptor 빌더가 필요하다. 본 helper 가 그 식별 layer 다(T-0895 Out of Scope
//     "이슈 식별자 결정 / 기존 이슈 검색·갱신 / 멱등 박제 policy" 의 그 후속 slice).
//   - summary 축(T-0580 descriptor → T-0581 마크다운 렌더러 → **T-0582 이슈 식별자/본문
//     descriptor 빌더**)의 선례와 정확히 동형. dual-leg run outcome 축은 T-0894/T-0895
//     (컴포저+렌더러)까지만 있고 그 식별 layer(T-0582 mirror)가 없었다. 본 task 가 그
//     gap 을 순수 함수로 메운다. summary 축과의 유일한 shape 차이: report 가 run 식별자
//     (gitSha+dateToken)를 이미 보유하므로 별도 run ref 입력이 없다.
//
// 🔥 멱등 marker (later live wiring 의 search-or-update 기반):
//   - run 식별자(gitSha + dateToken)로부터 **안정 string 합성** marker 를 산출한다.
//     동일 run 이면 leg status/overallStatus 가 달라도 marker 가 동일하므로, later live
//     wiring slice 가 이슈 본문에서 marker 를 grep 해 동일 run 의 rolling-issue 를
//     검색→갱신(멱등)할 수 있다. 서로 다른 run 은 서로 다른 marker 를 산출한다. 외부
//     해시 라이브러리 0 — gitSha + dateToken 자체가 안정 식별 토큰이므로 string 합성으로
//     충분.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 descriptor 는 report 의 run 식별자(gitSha·dateToken)·leg status·overallStatus·
//     summaryLine(마크다운 렌더 위임)만 담는다. narrative 본문·raw 활동 본문은 입력
//     report 에 부재하므로(받지도 못함) rolling-issue 로 raw 본문이 새지 않는다(불변
//     보존). step ④ 박제 경계의 식별 layer.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. title / marker / body 전부 입력만의 함수.
//     동일 report 두 번 호출 → 동일 descriptor.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0(`process.env` 0), DB 접근 0, live-LLM 0,
//     credential 0. 외부 템플릿/해시 라이브러리 0 — 내장 template literal + string
//     합성만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 빌더는 입력 `report` 및 하위 `eval`/`collect` 객체를 변형하지 않는다(읽기만).
//     호출마다 새 descriptor 객체를 반환 — 공유 mutable 노출 0.
//
// 🔥 type 재사용 / 위임 (중복 정의 0):
//   - 입력 `RealDataDailyStepDualLegRunReport` 는 T-0894 컴포저에서 `import type`
//     재사용(중복 정의 0). 본문 렌더는 T-0895 `renderRealDataDailyStepDualLegRunReportMarkdown`
//     에 위임(마크다운 렌더 로직 중복 0). 신규 type 은 출력
//     `RealDataDailyStepDualLegRunReportIssueDescriptor`(`{ title; marker; body }`)만
//     정의. enum 토큰(pass/fail/skip/all-pass 등)은 영어 유지(§12), 본문 설명 문구는
//     한국어(§12).
//
// Out of Scope (task T-0896):
//   - gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 검색·갱신
//     (step ④ live wiring — credential gate).
//   - T-0894 컴포저 / T-0895 렌더러 수정 / leg outcome 재파생 / status·마크다운 재계산
//     (descriptor·마크다운은 이미 확정 — 본 빌더는 재계산 0, marker/title 합성 + 본문
//     위임만. import 재사용만).
//   - 실 run 식별자 도출(실 gitSha·실 timestamp 읽기 — 본 빌더는 report 가 이미 보유한
//     run 식별자를 사용; 식별자 source 는 upstream 컴포저 T-0894 책임).
//   - 마크다운 렌더 로직 자체(T-0895 위임만 — 중복 구현 금지).
//   - summary 축(T-0580/T-0581/T-0582) / 단일 issue-post outcome-report(T-0590) 수정.
//   - Person 별 / 기간 별 group-by 이슈 분해 / 마크다운 외 포맷(plain text/HTML/JSON) 본문.
//   - 외부 템플릿/해시 라이브러리 도입 — 내장 string 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·렌더 함수 import 재사용만).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";

// 이슈 제목 prefix — 결정론적 고정 문자열. run 식별 token 이 뒤에 붙는다.
const ISSUE_TITLE_PREFIX = "실 평가 e2e daily-step dual-leg run report";

// 멱등 marker prefix — 이슈 본문에 박을 안정 식별 토큰의 고정 머리. later live wiring
// slice 가 이 prefix 로 본문을 grep 해 동일 run 의 rolling-issue 를 검색한다.
const ISSUE_MARKER_PREFIX =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue:";

// RealDataDailyStepDualLegRunReportIssueDescriptor — daily-test dual-leg run report
// rolling-issue 박제 descriptor.
//   - title: 결정론적 이슈 제목(고정 prefix + run 식별 token).
//   - marker: 멱등 검색·갱신용 안정 식별 토큰(동일 run → 동일 marker).
//   - body: marker 라인 + `renderRealDataDailyStepDualLegRunReportMarkdown(report)`
//     본문. 두 블록은 빈 줄 1개로 구분되어 합성된다(marker → markdown). 사람이 이슈를
//     스캔할 때 marker 직후·markdown 본문 위에서 run 식별·leg status·overallStatus 를
//     즉시 파악할 수 있다.
export interface RealDataDailyStepDualLegRunReportIssueDescriptor {
  title: string;
  marker: string;
  body: string;
}

// run 식별 token — 제목·marker 에 공통으로 쓰는 안정 합성 토큰. dateToken + gitSha 를
// 결합해 동일 run 이면 동일, 서로 다른 run 이면 다름을 보장한다(T-0582 runToken 규약
// 동형).
function runToken(report: RealDataDailyStepDualLegRunReport): string {
  return `${report.dateToken}@${report.gitSha}`;
}

// 빈/공백-only 식별자 guard — 비식별 이슈 박제(잘못된 제목·marker)로 rolling-issue 를
// 오염시키지 않도록 gitSha / dateToken 이 빈 문자열·공백-only 면 명시적 throw
// 한다(조용한 통과 차단). T-0894 컴포저·T-0895 렌더러의 `assertNonBlank` 규약과 동형.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataDailyStepDualLegRunReport.${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 이슈 박제 방지를 위해 빈/공백-only 식별자는 허용되지 않습니다.`,
    );
  }
}

// buildRealDataDailyStepDualLegRunReportIssueDescriptor — dual-leg run report 를
// daily-test rolling-issue 의 (title / marker / body) descriptor 로 묶는 **순수 함수**.
//
// 분기:
//   - guard: report.gitSha 빈/공백 → throw, report.dateToken 빈/공백 → throw(각
//     필드별 분기).
//   - 정상: title(prefix + token) / marker(prefix + token) / body(marker 라인 + 렌더
//     위임 본문) 합성. leg status/overallStatus 가 달라도 동일 run 이면 title / marker
//     동일(멱등).
//
// 순수성·무공유:
//   - 입력 `report` 를 읽기만 한다(mutate 0). 매 호출이 새 descriptor 객체를 반환 —
//     입력 / 다음 호출 결과와 무공유. 본문 렌더는 T-0895 에 위임(중복 0).
export function buildRealDataDailyStepDualLegRunReportIssueDescriptor(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  // 식별자 guard — 필드별·빈/공백별 분기마다 명시적 throw(비식별 이슈 박제 차단).
  assertNonBlank(report.gitSha, "gitSha");
  assertNonBlank(report.dateToken, "dateToken");

  const token = runToken(report);
  const title = `${ISSUE_TITLE_PREFIX} ${token}`;
  // marker 는 동일 run → 동일(leg status/overallStatus 무관). 이슈 본문 첫 줄에 1 회만
  // 박힌다.
  const marker = `${ISSUE_MARKER_PREFIX} ${token} -->`;
  // body 합성 — marker 라인 + 마크다운 본문 2 블록을 빈 줄 1 개로 구분해 결합. 본문
  // 렌더는 T-0895 에 위임(마크다운 렌더 로직 중복 0). marker 는 정확히 1 회 등장(중복 0),
  // markdown 본문 직전에 위치.
  const body = [
    marker,
    "",
    renderRealDataDailyStepDualLegRunReportMarkdown(report),
  ].join("\n");

  return { title, marker, body };
}

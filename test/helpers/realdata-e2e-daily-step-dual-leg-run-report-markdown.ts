// realdata-e2e-daily-step-dual-leg-run-report-markdown.ts — 실 평가 e2e daily-test 가
// nightly 로 spawn 하는 eval leg + collect leg 두 jest run 의 dual-leg run report
// descriptor → rolling-issue 박제용 마크다운 본문 순수 렌더러 (T-0895 박제).
//
// 책임:
//   - T-0894 의 `buildRealDataDailyStepDualLegRunReport` 가 두 leg 의 run outcome 을
//     하나의 `RealDataDailyStepDualLegRunReport` descriptor(gitSha/dateToken/per-leg
//     {action,status}/overallStatus/byte-identical summaryLine)로 묶는다. PLAN.md 109행
//     step ④ 는 그 결과를 "daily-test result/rolling 이슈에 박제"하라 지시하므로, gh
//     issue 본문에 박제할 **결정론적 마크다운 문자열**로 그 descriptor 를 렌더링하는 순수
//     함수가 필요하다. 본 helper 가 그 표현 layer 다(T-0894 Out of Scope "마크다운 렌더링
//     / 이슈 본문 포맷 문자열 생성 — credential gate 별도 slice" 의 그 표현 layer).
//   - summary 축(T-0580 descriptor → T-0581 마크다운 렌더러)의 선례와 정확히 동형 —
//     summary 는 표현 layer 를 가졌으나 dual-leg run outcome 축은 descriptor(T-0894)만
//     있고 마크다운 렌더러가 없었다. 본 task 가 그 gap 을 순수 함수로 메운다.
//
// 🔥 엄격 검증: gitSha/dateToken/summaryLine 이 빈/공백-only 면 명시적 throw. mislabel 된
//   raw descriptor(비식별 리포트)가 이슈 본문으로 새기 전 fail-fast(조용한 통과 0).
// 🔥 결정론적 출력: 입력 외 상태(시각·난수·env) 의존 0. 슬롯 순서·공백·줄바꿈 전부 고정.
//   동일 descriptor 두 번 렌더 → byte-identical.
// 🔥 무공유 보장: 입력 `report` 와 하위 `eval`/`collect` 객체를 변형하지 않는다(읽기만).
//   반환은 매 호출 새 문자열 — 공유 mutable 노출 0.
// 🔥 build-time 완결 — dependency-free(cloud cron 자율 실행 가능): 실 네트워크 0, env 읽기
//   0, DB 0, live-LLM 0, credential 0, 외부 템플릿 엔진 0 — 내장 template literal 만.
// 🔥 type 재사용(중복 정의 0): `RealDataDailyStepDualLegRunReport` 는 T-0894
//   컴포저에서 `import type` 재사용한다. 새 type / enum 정의 0(SSOT). enum 토큰
//   (pass/fail/skip/all-pass 등)은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
//
// Out of Scope (task T-0895):
//   - gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 박제
//     (step ④ live wiring — credential gate).
//   - T-0894 컴포저 수정 / leg outcome 재파생 / status 재계산(descriptor 는 이미
//     status·overallStatus 확정 보유 — 본 렌더러는 재계산 0, 표현만. import type 재사용만).
//   - `deploy/daily-test.sh` 의 두 leg spawn wiring / 실 leg outcome 캡처(별도 slice).
//   - EvaluationResult[] 집계·렌더(T-0580/581) / 단일 issue-post outcome-report(T-0590) 수정.
//   - 마크다운 외 포맷(plain text / HTML / JSON) 출력.
//   - production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";

// 빈/공백-only 식별자 guard — mislabel 된 raw descriptor(비식별 리포트)를 렌더 시점에
// 재확인해 이슈 본문으로 새기 전 명시적 throw(조용한 통과 차단). T-0894 컴포저의
// `assertNonBlank` 규약과 동형 — descriptor 산출 정합을 표현 layer 에서 한 번 더 방어.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 마크다운 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// renderRealDataDailyStepDualLegRunReportMarkdown — dual-leg run report descriptor 를
// rolling-issue 박제용 **결정론적 마크다운 문자열**로 변환하는 순수 함수.
//
// 출력 구조(고정 순서):
//   1. 헤더 — `## 실 평가 e2e daily-step dual-leg run report`.
//   2. run 식별자 — `- git sha: <gitSha>` + `- date token: <dateToken>`.
//   3. per-leg 표기 표 — eval / collect 각 { action, status }(고정 행 순서 eval→collect).
//   4. overallStatus — `- overall status: <overallStatus>`.
//   5. summaryLine — `- summary: <summaryLine>`.
//
// 분기(본 렌더러의 추가 분기는 guard 3 종 외 없음):
//   - per-leg status(pass/fail/skip) / overallStatus(all-pass/some-fail/all-skip/partial)
//     는 descriptor 값 그대로 보간 — 값별 분기 없이 동일 경로(값만 다름).
//   - guard 3 종(gitSha/dateToken/summaryLine 빈-공백)만 throw 분기.
//
// 순수성·무공유:
//   - 입력 `report` 와 하위 `eval`/`collect` 객체를 읽기만 한다(mutate 0). 반환은 새 문자열.
export function renderRealDataDailyStepDualLegRunReportMarkdown(
  report: RealDataDailyStepDualLegRunReport,
): string {
  // run 식별자·요약 무결성 guard(비식별/손상 리포트의 이슈 leak 차단).
  assertNonBlank(report.gitSha, "RealDataDailyStepDualLegRunReport.gitSha");
  assertNonBlank(
    report.dateToken,
    "RealDataDailyStepDualLegRunReport.dateToken",
  );
  assertNonBlank(
    report.summaryLine,
    "RealDataDailyStepDualLegRunReport.summaryLine",
  );

  // per-leg 표기 행 — 반드시 eval→collect 고정 순서(입력 키 enumeration 순서 무관).
  const legRows = [
    `| eval | ${report.eval.action} | ${report.eval.status} |`,
    `| collect | ${report.collect.action} | ${report.collect.status} |`,
  ].join("\n");

  const markdown = [
    "## 실 평가 e2e daily-step dual-leg run report",
    "",
    `- git sha: ${report.gitSha}`,
    `- date token: ${report.dateToken}`,
    `- overall status: ${report.overallStatus}`,
    "",
    "### leg 별 run outcome",
    "",
    "| leg | action | status |",
    "| --- | --- | --- |",
    legRows,
    "",
    `- summary: ${report.summaryLine}`,
  ].join("\n");

  return markdown;
}

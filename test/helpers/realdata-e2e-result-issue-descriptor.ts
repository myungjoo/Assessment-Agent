// realdata-e2e-result-issue-descriptor.ts — 실 평가 e2e 결과 요약 descriptor +
// run 식별자 → daily-test 결과 이슈 식별자/본문 descriptor 순수 빌더 (T-0582 박제).
//
// 책임:
//   - T-0580 의 `buildRealDataResultSummary` 가 `EvaluationResult[]` 를 결과 요약
//     descriptor(`RealDataResultSummary`)로 집계하고, T-0581 의
//     `renderRealDataResultSummaryMarkdown` 가 그 descriptor 를 결정론적 마크다운
//     본문으로 렌더링한다. PLAN.md 109행 step ④ 는 그 결과를 "daily-test
//     result/rolling 이슈에 박제"하라 지시하므로, 실 gh issue wiring 직전에 **어떤
//     제목으로 / 어떤 멱등 marker 로 / 어떤 본문으로 박제할지**를 결정하는 순수
//     descriptor 빌더가 필요하다. 본 helper 가 그 식별 layer 다(T-0581 Out of Scope
//     "이슈 식별자 결정 / 기존 이슈 검색·갱신 / 멱등 박제 policy" 의 그 후속 slice).
//
// 🔥 멱등 marker (later live wiring 의 search-or-update 기반):
//   - run 식별자(gitSha + dateToken)로부터 **안정 string 합성** marker 를 산출한다.
//     동일 run 이면 summary 가 달라도 marker 가 동일하므로, later live wiring slice 가
//     이슈 본문에서 marker 를 grep 해 동일 run 의 이슈를 검색→갱신(멱등)할 수 있다.
//     서로 다른 run 은 서로 다른 marker 를 산출한다. 외부 해시 라이브러리 0 — gitSha +
//     dateToken 자체가 안정 식별 토큰이므로 string 합성으로 충분.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 descriptor 는 입력 summary 의 식별자 카운트·분류 enum 분포·정량 합산(렌더
//     위임)과 run 식별자(gitSha·dateToken)만 담는다. narrative 본문·raw 활동 본문은
//     입력에 부재하므로(받지도 못함) 이슈로 raw 본문이 새지 않는다(불변 보존). step ④
//     박제 경계의 식별 layer.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. title / marker / body 전부 입력만의 함수.
//     동일 (summary, run) 두 번 호출 → 동일 descriptor.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0. 외부 템플릿/
//     해시 라이브러리 0 — 내장 template literal + string 합성만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 빌더는 입력 `summary` / `run` 객체를 변형하지 않는다(읽기만). 호출마다 새
//     descriptor 객체를 반환 — 공유 mutable 노출 0.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultSummary` 는 `realdata-e2e-result-summary.ts`(T-0580)에서,
//     본문 렌더는 `renderRealDataResultSummaryMarkdown`(T-0581)에 위임한다(마크다운
//     렌더 로직 중복 0). 신규 type 은 입력 `RealDataResultIssueRunRef` + 출력
//     `RealDataResultIssueDescriptor` 만 정의.
//
// Out of Scope (task T-0582):
//   - gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 검색·갱신
//     (step ④ live wiring — credential gate).
//   - `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기
//     (step ④ live wiring, ADR-0045 LAN gate).
//   - 실 run 식별자 도출(실 gitSha·실 timestamp 읽기 — 본 helper 는 주어진 run 식별자를
//     받아 descriptor 만 산출; 식별자 source 는 caller 책임).
//   - 마크다운 렌더 로직 자체(T-0581 위임만 — 중복 구현 금지).
//   - Person 별 / 기간 별 group-by 이슈 분해(본 helper 는 단일 결과 1 이슈 descriptor 만).
//   - 외부 템플릿/해시 라이브러리 도입 — 내장 string 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·렌더 함수 import 재사용만).
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";

// 이슈 제목 prefix — 결정론적 고정 문자열. run 식별 token 이 뒤에 붙는다.
const ISSUE_TITLE_PREFIX = "실 평가 e2e 결과";

// 멱등 marker prefix — 이슈 본문에 박을 안정 식별 토큰의 고정 머리. later live wiring
// slice 가 이 prefix 로 본문을 grep 해 동일 run 의 이슈를 검색한다.
const ISSUE_MARKER_PREFIX = "<!-- realdata-e2e-result-issue:";

// RealDataResultIssueRunRef — 결과 이슈의 run 식별자. gitSha 와 dateToken 의 조합이
// 동일 run 을 결정론적으로 식별한다(멱등 marker·제목 token 의 source).
//   - gitSha: 평가 실행 시점의 git short sha(daily-test latest-result.json 의 gitSha 정합).
//   - dateToken: 실행 날짜 토큰(예: "2026-06-23" — daily-test ts 의 날짜 부분 정합).
export interface RealDataResultIssueRunRef {
  gitSha: string;
  dateToken: string;
}

// RealDataResultIssueDescriptor — daily-test 결과 이슈 박제 descriptor.
//   - title: 결정론적 이슈 제목(고정 prefix + run 식별 token).
//   - marker: 멱등 검색·갱신용 안정 식별 토큰(동일 run → 동일 marker).
//   - body: marker 라인 + `renderRealDataResultSummaryMarkdown(summary)` 본문.
export interface RealDataResultIssueDescriptor {
  title: string;
  marker: string;
  body: string;
}

// run 식별 token — 제목·marker 에 공통으로 쓰는 안정 합성 토큰. gitSha + dateToken 을
// 결합해 동일 run 이면 동일, 서로 다른 run 이면 다름을 보장한다.
function runToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 빈/공백-only 식별자 guard — 비식별 이슈 박제(잘못된 제목·marker)를 방지하기 위해
// gitSha / dateToken 이 빈 문자열·공백-only 면 명시적 throw 한다(조용한 통과 차단).
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataResultIssueRunRef.${fieldName} 가 비어있습니다 — 비식별 이슈 박제 방지를 위해 빈/공백-only 식별자는 허용되지 않습니다.`,
    );
  }
}

// buildRealDataResultIssueDescriptor — 결과 요약 descriptor + run 식별자를 daily-test
// 결과 이슈의 (title / marker / body) descriptor 로 묶는 **순수 함수**.
//
// 분기:
//   - guard: run.gitSha 빈/공백 → throw, run.dateToken 빈/공백 → throw(각 필드 별 분기).
//   - 정상: title(prefix + token) / marker(prefix + token) / body(marker 라인 + 렌더
//     위임 본문) 합성. summary 가 달라도 동일 run 이면 title / marker 동일.
//
// 순수성·무공유:
//   - 입력 `summary` / `run` 을 읽기만 한다(mutate 0). 매 호출이 새 descriptor 객체를
//     반환 — 입력 / 다음 호출 결과와 무공유. 본문 렌더는 T-0581 에 위임(중복 0).
export function buildRealDataResultIssueDescriptor(
  summary: RealDataResultSummary,
  run: RealDataResultIssueRunRef,
): RealDataResultIssueDescriptor {
  // 식별자 guard — 필드별·빈/공백별 분기마다 명시적 throw.
  assertNonBlank(run.gitSha, "gitSha");
  assertNonBlank(run.dateToken, "dateToken");

  const token = runToken(run);
  const title = `${ISSUE_TITLE_PREFIX} ${token}`;
  // marker 는 동일 run → 동일(summary 무관). 이슈 본문 첫 줄에 1 회만 박힌다.
  const marker = `${ISSUE_MARKER_PREFIX} ${token} -->`;
  const body = [marker, "", renderRealDataResultSummaryMarkdown(summary)].join(
    "\n",
  );

  return { title, marker, body };
}

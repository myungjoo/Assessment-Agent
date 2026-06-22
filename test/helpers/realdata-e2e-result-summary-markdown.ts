// realdata-e2e-result-summary-markdown.ts — 실 평가 e2e 결과 요약 descriptor →
// daily-test 이슈 마크다운 본문 순수 렌더러 (T-0581 박제).
//
// 책임:
//   - T-0580 의 `buildRealDataResultSummary` 가 `EvaluationResult[]` 를 결과 요약
//     descriptor(`RealDataResultSummary`: count / byDifficulty / byContribution /
//     totalVolume)로 집계한다. PLAN.md 109행 step ④ 는 그 결과를 "daily-test
//     result/rolling 이슈에 박제"하라 지시하므로, gh issue 본문에 박제할 **결정론적
//     마크다운 문자열**로 그 descriptor 를 렌더링하는 순수 함수가 필요하다. 본 helper
//     가 그 표현 layer 다(T-0580 Out of Scope "마크다운 렌더링 / 이슈 본문 포맷 문자열
//     생성 — 표현 layer 는 별도 후속 slice" 의 그 후속 slice).
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 렌더러는 입력 descriptor 가 가진 식별자 카운트(count)·분류 enum 분포
//     (byDifficulty / byContribution)·정량 합산(totalVolume)만 렌더링한다. narrative
//     본문·raw 활동 본문은 입력에 부재하므로(T-0580 descriptor 가 이미 카운트·합산만
//     보유) 이슈로 raw 본문이 새지 않는다(불변 보존). step ④ 박제 경계의 표현 layer.
//
// 🔥 슬롯 single source 정합 (고정 순서):
//   - difficulty 분포 행은 `DIFFICULTIES`(src/llm/difficulty.ts) 순서대로
//     (easy → medium → hard), contribution 분포 행은 `CONTRIBUTION_LEVELS`
//     (evaluation-result.ts) 순서대로(zero → low → medium → high) 렌더링한다. 슬롯
//     hard-code 0 — 반드시 single-source 배열을 순회한다. 미등장 슬롯도 descriptor 에
//     키 존재(값 0)가 보장되므로 누락 없이 0 으로 렌더링한다.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. 슬롯 순서·공백·줄바꿈 전부 고정. 동일
//     descriptor 두 번 렌더 → 동일 문자열.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0. 외부 템플릿
//     엔진 0 — 내장 template literal 만. 순수 문자열 렌더링.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 렌더러는 입력 `summary` / 하위 `byDifficulty` / `byContribution` 객체를
//     변형하지 않는다(읽기만). 반환은 새 문자열 — 공유 mutable 노출 0.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultSummary` 는 `realdata-e2e-result-summary.ts`(T-0580)에서,
//     `DIFFICULTIES` 는 `src/llm/difficulty.ts` 에서, `CONTRIBUTION_LEVELS` 는
//     `evaluation-result.ts` 에서 import 재사용한다. 새 type / 슬롯 배열 정의 0(SSOT).
//
// Out of Scope (task T-0581):
//   - gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 박제
//     (step ④ live wiring — credential gate).
//   - `deploy/daily-test.sh` 의 `step_eval` wiring(step ④ live wiring, ADR-0045 LAN gate).
//   - daily-test 이슈 식별자 결정 / 기존 이슈 검색·갱신 / 멱등 박제 policy(별도 후속 slice).
//   - Person 별 / 기간 별 group-by 렌더링(본 helper 는 전체 descriptor 1 회 렌더만).
//   - 마크다운 외 포맷(plain text / HTML / JSON) 출력.
//   - production `src/` 코드 변경 — test helper 단독(타입·슬롯 배열 import 재사용만).
import { CONTRIBUTION_LEVELS } from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// renderRealDataResultSummaryMarkdown — 결과 요약 descriptor 를 daily-test 이슈
// 본문용 **결정론적 마크다운 문자열**로 변환하는 순수 함수.
//
// 출력 구조(고정 순서):
//   1. 총 단위 수 헤더 — `## 실 평가 e2e 결과 요약` + `- 평가 단위 수: <count>`.
//   2. difficulty 분포 섹션 — DIFFICULTIES 순서대로 슬롯 + 카운트 마크다운 표.
//   3. contribution 분포 섹션 — CONTRIBUTION_LEVELS 순서대로 슬롯 + 카운트 마크다운 표.
//   4. 총 volume 합산 — `- 총 volume: <totalVolume>`.
//
// 분기(본 렌더러의 추가 분기는 슬롯 순회 외 없음):
//   - difficulty / contribution 슬롯은 항상 single-source 배열의 전 키를 순회하므로
//     "키 부재" 분기는 발생하지 않는다(미등장 슬롯도 descriptor 에 0 으로 키 존재).
//   - count / totalVolume 은 값 그대로 보간 — 0 / 양수 분기 모두 동일 경로.
//
// 순수성·무공유:
//   - 입력 `summary` 와 하위 분포 객체를 읽기만 한다(mutate 0). 반환은 새 문자열.
export function renderRealDataResultSummaryMarkdown(
  summary: RealDataResultSummary,
): string {
  // difficulty 분포 표 — 반드시 DIFFICULTIES 순서대로 순회(키 enumeration 순서 무관).
  const difficultyRows = DIFFICULTIES.map(
    (difficulty) => `| ${difficulty} | ${summary.byDifficulty[difficulty]} |`,
  ).join("\n");

  // contribution 분포 표 — 반드시 CONTRIBUTION_LEVELS 순서대로 순회.
  const contributionRows = CONTRIBUTION_LEVELS.map(
    (level) => `| ${level} | ${summary.byContribution[level]} |`,
  ).join("\n");

  return [
    "## 실 평가 e2e 결과 요약",
    "",
    `- 평가 단위 수: ${summary.count}`,
    `- 총 volume: ${summary.totalVolume}`,
    "",
    "### difficulty 분포",
    "",
    "| difficulty | count |",
    "| --- | --- |",
    difficultyRows,
    "",
    "### contribution 분포",
    "",
    "| contribution | count |",
    "| --- | --- |",
    contributionRows,
  ].join("\n");
}

// realdata-e2e-result-summary-line.ts — 실 평가 e2e 결과 요약 descriptor →
// 사람-친화 한 줄 요약 순수 formatter (T-0642 박제).
//
// 책임:
//   - T-0580 의 `buildRealDataResultSummary` 가 `EvaluationResult[]` 를 결과 요약
//     descriptor(`RealDataResultSummary`: count / byDifficulty / byContribution /
//     totalVolume)로 집계한다. T-0581 의 `renderRealDataResultSummaryMarkdown` 는 그
//     descriptor 를 daily-test 이슈 **본문**(다행 markdown 표)으로 렌더링한다.
//     그러나 이슈 **title**·rolling 이슈 본문 상단 한 줄·journal/log/notification
//     surface 한 줄·CI step_eval stdout 한 줄 등 "한 줄짜리 요약" 이 자연스러운 caller
//     surface 가 여럿이다. 본 helper 는 그 한 줄 표현 layer 다 — descriptor 를 **결정적
//     한국어 단일 라인** 으로 렌더하는 순수 함수.
//
// 🔥 패턴 mirror — summary-batch 의 `formatSummaryBatchOutcome`(T-0619):
//   - 분포 슬롯을 single-source 배열(`DIFFICULTIES` / `CONTRIBUTION_LEVELS`) 순회로
//     결정적 고정 순서 렌더. 미등장 슬롯도 0 으로 등장(descriptor 가 키 존재 보장).
//   - null/undefined·필드 누락 fail-fast 한국어 TypeError(silent 빈 문자열 위장 차단).
//   - 결정적 한국어 단일 라인(개행 0) / 입력 비변형 / referential transparency.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 formatter 는 입력 descriptor 가 가진 식별자 카운트(count)·분류 enum 분포
//     (byDifficulty / byContribution)·정량 합산(totalVolume)만 렌더링한다. narrative
//     본문·raw 활동 본문은 입력에 부재하므로 한 줄 요약으로 raw 본문이 새지 않는다.
//
// 🔥 슬롯 single source 정합 (고정 순서):
//   - difficulty slot 은 `DIFFICULTIES`(src/llm/difficulty.ts) 순서대로
//     (easy → medium → hard), contribution slot 은 `CONTRIBUTION_LEVELS`
//     (evaluation-result.ts) 순서대로(zero → low → medium → high) 순회. 슬롯
//     hard-code 0 — 반드시 import 한 single-source 배열을 순회.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. 슬롯 순서·공백·구분자 전부 고정. 개행 0.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0. 외부 템플릿
//     엔진 0 — 내장 template literal 만. 순수 문자열 렌더링.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 입력 `summary` / 하위 `byDifficulty` / `byContribution` 객체를 읽기만 한다.
//     반환은 새 문자열 — 공유 mutable 노출 0.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultSummary` 는 `realdata-e2e-result-summary.ts`(T-0580)에서,
//     `DIFFICULTIES` 는 `src/llm/difficulty.ts` 에서, `CONTRIBUTION_LEVELS` 는
//     `evaluation-result.ts` 에서 import 재사용. 새 type / 슬롯 배열 정의 0(SSOT).
//
// Out of Scope (task T-0642):
//   - shape 가드(`assertRealDataResultSummaryLineFormatShape`) — 후속 mirror slice.
//   - daily-test rolling 이슈 title/body·CI step_eval stdout·journal 실배선 — 후속.
//   - `RealDataResultSummary` 타입·`buildRealDataResultSummary`·markdown 렌더러 본문
//     변경 — 본 task 는 신규 한 줄 formatter helper 만(import 만, 본문 변경 0).
import { CONTRIBUTION_LEVELS } from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { assertRealDataResultSummaryLineFormatShape } from "./realdata-e2e-result-summary-line-format-shape";

// RESULT_LINE_PREFIX — 한 줄 요약의 라벨 prefix(라벨 + 공백 1개). single source 로
// export 해 후속 형태 검증 가드(realdata-e2e-result-summary-line-format-shape.ts,
// summary-batch 의 OUTCOME_LINE_PREFIX mirror)가 동일 상수를 import 소비하도록 한다
// (라벨 drift 방지). 아래 head template literal 이 본 상수를 소비할 뿐(출력 무변경).
export const RESULT_LINE_PREFIX = "실 평가 e2e 결과: ";

/**
 * 실 평가 e2e 결과 요약 descriptor 를 **사람-친화 결정적 한국어 단일 라인**으로
 * 렌더링한다(PLAN.md P5 109행 step ④ 표현 surface). `formatSummaryBatchOutcome`
 * (T-0619)의 realdata-e2e 측 mirror.
 *
 * 출력 형태(예시 — 정확한 문구는 본 함수가 single source):
 *   `실 평가 e2e 결과: count=5 · volume=42 · 난이도(easy/medium/hard)=2/2/1 · 기여도(zero/low/medium/high)=1/1/2/1`
 *
 * 필드 ↔ 문구 매핑(single source — JSDoc):
 *   - `summary.count`       → `count=N`(평가 단위 총 개수).
 *   - `summary.totalVolume` → `volume=V`(전 원소 volume 합산).
 *   - `summary.byDifficulty` → `난이도(easy/medium/hard)=a/b/c`. `DIFFICULTIES`
 *     (easy → medium → hard) single source 순회로 **결정적 고정 순서** 렌더. 값 0
 *     슬롯도 슬롯 누락 없이 등장(`.../0/...`).
 *   - `summary.byContribution` → `기여도(zero/low/medium/high)=p/q/r/s`.
 *     `CONTRIBUTION_LEVELS`(zero → low → medium → high) single source 순회.
 *
 * 결정성: 같은 summary → 항상 byte-identical 출력(개행 0, 단일 라인). `Object.keys`
 * 순서 의존 0 — 슬롯 순회는 single-source 고정 순서만 사용. 잔여 상태 누수 0(순수
 * 함수, 매 호출 독립).
 *
 * 비변형: `summary`·`byDifficulty`·`byContribution` 객체를 읽기만 한다(쓰기 0).
 * 부수효과 0. 반환은 새 문자열.
 *
 * @param summary T-0580 `buildRealDataResultSummary` 산출의 결과 요약 descriptor.
 *   변형하지 않는다(읽기만). count·totalVolume·byDifficulty 3 슬롯·byContribution
 *   4 슬롯이 모두 문자열에 등장한다.
 * @returns 결정적 한국어 단일 라인 요약 문자열(개행 0). 빈 batch(count 0)도 빈
 *   문자열이 아니라 `count=0` 을 명시한다.
 * @throws {TypeError} `summary` 가 null/undefined 이거나 `summary.byDifficulty` /
 *   `summary.byContribution` 가 누락(undefined)된 불완전 객체일 때(silent 손상 라인
 *   산출 차단 — 기본값 채움·정규화 없이 fail-fast).
 * @throws {RangeError} `assertRealDataResultSummaryLineFormatShape`(T-0643, 반환 직전
 *   self-guard)가 던지는 산출 라인 형태 불변식 위반(개행 혼입·prefix drift·count/volume
 *   토큰 누락·난이도/기여도 슬롯 누락·순서 뒤바뀜 — 이론상 formatter template 회귀 시).
 *   형태 가드 본문 single-source 참조 `realdata-e2e-result-summary-line-format-shape.ts`.
 */
export function formatRealDataResultSummaryLine(
  summary: RealDataResultSummary,
): string {
  if (summary === null || summary === undefined) {
    throw new TypeError(
      "summary 가 null 또는 undefined 입니다 — descriptor 객체가 필요합니다.",
    );
  }
  if (summary.byDifficulty === null || summary.byDifficulty === undefined) {
    throw new TypeError(
      "summary.byDifficulty 가 누락된 불완전 descriptor 일 수 없습니다.",
    );
  }
  if (summary.byContribution === null || summary.byContribution === undefined) {
    throw new TypeError(
      "summary.byContribution 가 누락된 불완전 descriptor 일 수 없습니다.",
    );
  }

  // 난이도 슬롯 — 반드시 DIFFICULTIES 순서대로 순회(키 enumeration 순서 무관).
  const difficultyValues = DIFFICULTIES.map(
    (difficulty) => summary.byDifficulty[difficulty],
  ).join("/");

  // 기여도 슬롯 — 반드시 CONTRIBUTION_LEVELS 순서대로 순회.
  const contributionValues = CONTRIBUTION_LEVELS.map(
    (level) => summary.byContribution[level],
  ).join("/");

  // 결정적 한 줄을 합성한다(출력 byte-identical 보존 — 라인 내용 변경 0).
  const line =
    `${RESULT_LINE_PREFIX}count=${summary.count}` +
    ` · volume=${summary.totalVolume}` +
    ` · 난이도(${DIFFICULTIES.join("/")})=${difficultyValues}` +
    ` · 기여도(${CONTRIBUTION_LEVELS.join("/")})=${contributionValues}`;

  // 반환 직전 self-guard(T-0639 summary-batch outcome wire 의 realdata-e2e mirror) —
  // 합성된 라인이 형태 불변식(① string · ② 개행 0 · ③ prefix · ④ count/volume 토큰 ·
  // ⑤ 난이도 슬롯 · ⑥ 기여도 슬롯)을 만족하는지 단언한다(single-source
  // `realdata-e2e-result-summary-line-format-shape.ts`). 정합이면 void(무회귀·라인
  // 비변형), 위반이면 RangeError(형태 위반)/TypeError(구조 결손)를 전파해 손상된 결과
  // 라인이 caller surface(이슈 title·rolling 이슈 한 줄·journal·CI stdout)로 silent leak
  // 하기 전 fail-fast 차단한다. 가드는 line 을 읽기만 하므로 출력은 무영향(byte-identical).
  assertRealDataResultSummaryLineFormatShape(line);

  return line;
}

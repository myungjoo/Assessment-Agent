// realdata-e2e-result-summary.ts — 실 평가 e2e EvaluationResult[] →
// daily-test 결과 요약 descriptor 순수 빌더 (T-0580 박제).
//
// 책임:
//   - step ③ runner 가 `scoreUnit` 를 호출하면 평가 단위마다 `EvaluationResult`
//     (unitId / narrative / difficulty / contribution / volume 5 필드)가 산출된다.
//     PLAN step ④ 는 그 결과를 "daily-test result/rolling 이슈에 박제"하라 지시하므로,
//     박제 직전에 `EvaluationResult[]` 를 **사람이 읽을 수 있는 결과 요약 descriptor**
//     (평가 단위 수 + difficulty 분포 + contribution 분포 + 총 volume 합산)로 집계하는
//     순수 projection 이 필요하다. 본 helper 가 그 결정론적 집계 함수다(직전 slice
//     `buildRealDataScoringCallArgs` 와 동형 — 경계 shape 의 build-time 박제).
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 요약 descriptor 는 `narrative` 본문·raw 활동 본문을 **필드로 보유하지 않는다**.
//     식별자 카운트(count)·분류 enum 분포(byDifficulty / byContribution)·정량 합산
//     (totalVolume) 만 담는다. step ④ 이슈 박제는 본 descriptor 만 렌더링하므로 raw
//     본문이 이슈로 새지 않는다(불변 보존).
//
// 🔥 분포 슬롯 single source 정합:
//   - byDifficulty 의 키는 `DIFFICULTIES`(src/llm/difficulty.ts)를, byContribution 의
//     키는 `CONTRIBUTION_LEVELS`(evaluation-result.ts)를 기준으로 모든 슬롯을 0 으로
//     초기화한 뒤 카운트한다. 입력에 미등장한 슬롯도 키 존재(값 0)를 보장한다 — 표현
//     layer 가 슬롯 누락 없이 전 분포를 렌더링할 수 있다.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 요약 객체(+ 새 byDifficulty /
//     byContribution 객체)를 반환(공유 mutable 노출 0).
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 매 호출이 새 요약 객체와 새 하위 분포 객체를 생성하고 입력 `results` 배열·원소를
//     변형하지 않는다. 반환 객체·하위 객체는 입력 / 다음 호출 결과와 무공유다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `EvaluationResult` / `ContributionLevel` / `CONTRIBUTION_LEVELS` 는
//     `evaluation-result.ts` 에서, `Difficulty` / `DIFFICULTIES` 는 `src/llm/difficulty.ts`
//     에서 import 재사용한다. 본 helper 는 새 type / 슬롯 배열을 정의하지 않는다(SSOT).
//
// Out of Scope (task T-0580):
//   - 실 EvaluationScoringService.scoreUnit 호출 / scoring 실행 / EvaluationResult 실 산출
//     (step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
//   - daily-test result/rolling 이슈 실 박제 / gh issue 호출 / 마크다운 렌더링 / 이슈
//     본문 포맷 문자열 생성(step ④ live wiring — 본 helper 는 집계 descriptor 만 산출).
//   - Person 별 / 기간 별 group-by 집계(본 helper 는 전체 result 집합 1 회 요약만).
//   - 난이도별 routing(R-97) / 점수 산출 공식 / 가중 합산 — 단순 카운트·volume 합산만.
//   - production `src/` 코드 변경 — test helper 단독(타입·슬롯 배열 import 재사용만).
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import { assertRealDataResultSummaryConsistentWithInputs } from "./realdata-e2e-result-summary-consistency";

// RealDataResultSummary — `EvaluationResult[]` 집계의 결과 요약 descriptor.
// raw 본문(narrative 등) 부재 — 식별자 카운트·분류 enum 분포·정량 합산만(R-59).
//   - count: 평가 단위 총 개수.
//   - byDifficulty: difficulty 3 슬롯(easy/medium/hard)별 카운트(DIFFICULTIES 정합,
//     미등장 슬롯도 0 보장).
//   - byContribution: contribution 4 등급(zero/low/medium/high)별 카운트
//     (CONTRIBUTION_LEVELS 정합, 미등장 슬롯도 0 보장).
//   - totalVolume: 전 원소 volume 합산.
export interface RealDataResultSummary {
  count: number;
  byDifficulty: Record<Difficulty, number>;
  byContribution: Record<ContributionLevel, number>;
  totalVolume: number;
}

// 모든 difficulty 슬롯을 0 으로 초기화한 새 Record 를 생성. DIFFICULTIES 를 single
// source 로 순회하므로 슬롯 누락/오타가 발생하지 않는다(미등장 슬롯도 키 존재 보장).
function zeroDifficultyCounts(): Record<Difficulty, number> {
  const counts = {} as Record<Difficulty, number>;
  for (const difficulty of DIFFICULTIES) {
    counts[difficulty] = 0;
  }
  return counts;
}

// 모든 contribution 등급 슬롯을 0 으로 초기화한 새 Record 를 생성. CONTRIBUTION_LEVELS
// 를 single source 로 순회하므로 슬롯 누락/오타가 발생하지 않는다.
function zeroContributionCounts(): Record<ContributionLevel, number> {
  const counts = {} as Record<ContributionLevel, number>;
  for (const level of CONTRIBUTION_LEVELS) {
    counts[level] = 0;
  }
  return counts;
}

// buildRealDataResultSummary — 평가 결과 `EvaluationResult[]` 를 결과 요약 descriptor
// 로 집계하는 **순수 함수**. 입력을 1 회 순회하며 count·difficulty 분포·contribution
// 분포·totalVolume 을 누적한다.
//
// 분기(본 helper 자체의 추가 분기는 reduce/순회 누적 외 없음):
//   - 빈 입력 배열 → count 0, 모든 슬롯 0, totalVolume 0(초기화값 그대로 반환).
//   - 단일 / 다수 원소 → 각 원소의 difficulty/contribution 슬롯 +1, volume 누적.
//   - 입력 difficulty/contribution 값은 production 타입(Difficulty / ContributionLevel)
//     으로 좁혀져 있으므로 슬롯은 항상 초기화된 키 집합 안에 있다(미정의 키 접근 0).
//
// 순수성:
//   - 매 호출마다 **새 요약 객체** + **새 byDifficulty / byContribution 객체**를 생성한다.
//     입력 `results` 배열·원소를 변형하지 않는다(읽기만). 반환 객체·하위 객체는 입력 /
//     다음 호출 결과와 무공유다.
export function buildRealDataResultSummary(
  results: EvaluationResult[],
): RealDataResultSummary {
  const byDifficulty = zeroDifficultyCounts();
  const byContribution = zeroContributionCounts();
  let totalVolume = 0;

  for (const result of results) {
    byDifficulty[result.difficulty] += 1;
    byContribution[result.contribution] += 1;
    totalVolume += result.volume;
  }

  // 산출 요약 객체 — 매 호출 새 객체(+ 새 byDifficulty / byContribution 하위 객체).
  const summary: RealDataResultSummary = {
    count: results.length,
    byDifficulty,
    byContribution,
    totalVolume,
  };

  // self-wire — 산출 요약(count / byDifficulty / byContribution / totalVolume)이
  // 입력 `results` 로부터 독립 재유도한 기대값과 정합한 한 묶음인지 반환 직전
  // self-assert (T-0706 self-wire — T-0705 신설 result-summary 가드 짝 닫기, T-0700
  // result-report-plan / T-0702 summary-line / T-0704 result-issue-action self-wire 의
  // mirror). 본 컴포저는 집계 결과와 그 입력 `results` 를 동시에 in-scope 로 갖는
  // 유일한 상위 지점이므로, 가드 안에서 `results` 만으로 expected 를 재유도해 산출
  // `summary` 와 deep-equal 대조함으로써 집계 drift(count off-by-one · difficulty/
  // contribution 슬롯 +1 누락 · volume 합산 누락 · 미등장 슬롯 임의 값)를 build-time
  // fail-fast 로 차단한다. 정상 집계면 가드는 void 반환하므로 반환값 byte-identical
  // 보존(관측 불가능하게 동일). 가드는 read-only 라 summary / results mutate 0. 가드
  // throw(구조 결손 TypeError · 값 정합 위반 RangeError)는 컴포저가 삼키지 않고 그대로
  // 호출부로 선전파한다(throw 전파 정책 동형).
  assertRealDataResultSummaryConsistentWithInputs(summary, results);

  return summary;
}

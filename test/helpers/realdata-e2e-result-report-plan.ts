// realdata-e2e-result-report-plan.ts — 실 평가 e2e EvaluationResult[] + run →
// 결과 이슈 descriptor 종단 순수 컴포저 (T-0593 박제).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출
//     → 결과 이슈 박제 직전) 측 build-time chain 은 현재 두 개의 분리된 순수 link 로
//     끊겨 있다 — (a) `buildRealDataResultSummary(results: EvaluationResult[])`
//     (T-0580) 가 step ③ scoreUnit 산출 `EvaluationResult[]` → `RealDataResultSummary`
//     (count + 분포 + totalVolume) 로 집계하고, (b) `buildRealDataResultIssueDescriptor(
//     summary, run)`(T-0582) 가 그 요약 + `RealDataResultIssueRunRef` → daily-test
//     결과 이슈 박제용 `RealDataResultIssueDescriptor`(title/marker/body) 로 묶는다.
//     step ④ live runner 가 `EvaluationResult[]` + run 식별자만 들고 와 이슈
//     descriptor 까지 한 번에 도출하려면 이 두 helper 를 수동으로 순서 조립해야 한다.
//   - 본 컴포저는 그 2 단계를 단일 순수 함수 `buildRealDataResultReportPlan(results,
//     run)` 로 합성해 step ③→④ 경계의 build-time round-trip 을 닫는다 — seed-side
//     진입 컴포저 `buildRealDataPipelinePlan`(T-0592) / evaluate-side
//     `buildRealDataEvaluationPlan`(T-0591) / step ④ 박제측
//     `resolveRealDataResultIssueGhCommandPlan`(T-0588) 과 동형의 "분리된 순수 link
//     들을 단일 plan 컴포저로 묶는" 박제다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - 요약 집계는 T-0580(`buildRealDataResultSummary`), 이슈 descriptor 합성은
//     T-0582(`buildRealDataResultIssueDescriptor`) 에 위임한다. 본 컴포저는 매핑 /
//     집계 / guard 로직을 재구현하지 않고 위임 호출만 순서대로 엮는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - run.gitSha / run.dateToken 빈/공백 의 하위 `assertNonBlank` throw(T-0582)는
//     자체 try/catch 없이 그대로 위로 흘려보낸다(조용한 통과 / 재포장 0).
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (results, run) 두 번 호출 →
//     deep-equal 결과. 입력 `results` 배열·원소 / `run` 객체 mutate 0 — 위임 helper
//     들이 이미 매 호출 새 객체를 반환하므로 본 컴포저도 매 호출 새 plan 객체(+ 새
//     summary / descriptor 트리) 를 반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동/narrative 본문 구조적 미포함):
//   - plan 은 위임 helper 들이 보유하지 않는 raw narrative / 원본 활동 본문을
//     구조적으로 보유할 수 없다 — `RealDataResultSummary`(식별자 카운트·분류 enum
//     분포·정량 합산만)와 `RealDataResultIssueDescriptor`(title/marker/body, body 는
//     요약 렌더만) 만 통과시킨다. 두 위임 helper 가 이미 raw 본문을 미보유하므로 본
//     컴포저도 구조적으로 raw 를 보유할 수 없다(불변 보존).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `EvaluationResult` / `RealDataResultSummary` / `RealDataResultIssueRunRef` /
//     `RealDataResultIssueDescriptor` 는 전부 import type 재사용한다. 신규 type
//     정의는 `RealDataResultReportPlan` 컨테이너 1 개뿐(SSOT).
//
// Out of Scope (task T-0593):
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama /
//     `EvaluationResult` 실 산출(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045).
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 박제(step ④ live wiring).
//   - run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short
//     sha — 인자로만 받음).
//   - 마크다운 렌더(T-0581 위임, descriptor 내부) / gh 명령-args 합성(T-0583/T-0588) /
//     종단 outcome 리포트(T-0590) — 본 helper 는 EvaluationResult[]+run → 이슈
//     descriptor 단일 책임.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";
import type {
  RealDataResultIssueDescriptor,
  RealDataResultIssueRunRef,
} from "./realdata-e2e-result-issue-descriptor";
import { assertRealDataResultIssueDescriptorBodyConsistent } from "./realdata-e2e-result-issue-descriptor-body-consistency";
import { assertRealDataResultReportPlanConsistentWithInputs } from "./realdata-e2e-result-report-plan-consistency";
import { buildRealDataResultSummary } from "./realdata-e2e-result-summary";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// RealDataResultReportPlan — post-evaluation interpretation 종단 plan 의 출력.
// step ④ live runner 가 `EvaluationResult[]` + run 식별자만 넘기면 받게 되는
// "요약 집계 + 이슈 박제 descriptor" 한 묶음.
//   - summary: EvaluationResult[] 집계 결과(count + difficulty/contribution 분포 +
//     totalVolume, T-0580 산출). 이슈 본문 렌더의 source.
//   - descriptor: daily-test 결과 이슈 박제 descriptor(title/marker/body, T-0582 산출).
//
// R-59: 두 필드 모두 식별자 카운트·분류 enum 분포·정량 합산 / 이슈 식별자·요약 렌더
// 본문만 보유 — raw narrative / 원본 활동 본문 구조적 미포함(위임 helper 들이 이미
// 미보유).
export interface RealDataResultReportPlan {
  summary: RealDataResultSummary;
  descriptor: RealDataResultIssueDescriptor;
}

// buildRealDataResultReportPlan — 평가 결과 `EvaluationResult[]` + run 식별자를 입력
// 받아 결과 리포트 plan({ summary, descriptor }) 을 산출하는 **순수 컴포저**.
//
// 합성(2 단계 위임, 재구현 0):
//   (1) buildRealDataResultSummary(results) → summary(T-0580 위임, count·분포·
//       totalVolume 집계).
//   (2) buildRealDataResultIssueDescriptor(summary, run) → descriptor(T-0582 위임,
//       title/marker/body 합성 + run.gitSha/dateToken 빈/공백 throw 전파).
//
// 분기:
//   - 빈 `results` 배열 + 유효 run → summary count 0·전 슬롯 0·totalVolume 0 +
//     descriptor 정상 합성(throw 0).
//   - 단일 / 다수 result → 위임 helper 가 집계(추가 분기 0).
//   - run.gitSha 빈/공백 → 위임 `assertNonBlank` 가 먼저 throw(descriptor 단계).
//   - run.dateToken 빈/공백 → 위임 `assertNonBlank` throw(descriptor 단계).
//
// 합성 순서: summary 집계는 run guard 와 무관하므로(빈 results 도 정상 집계) 먼저
// 수행하고, descriptor 합성에서 run guard 가 평가된다. 즉 잘못된 run 이라도 summary
// 는 산출되지만 descriptor 단계에서 throw 가 전파돼 plan 자체는 산출되지 않는다.
//
// 순수성·무공유:
//   - 입력 `results`(읽기만, mutate 0) / `run`(읽기만, mutate 0). 위임 helper 들이
//     매 호출 새 summary / descriptor 객체를 반환하므로 본 컴포저도 매 호출 새 plan
//     객체(+ 새 summary / descriptor 트리) 를 반환 — 출력이 입력 / 다음 호출 결과와
//     무공유. 결정론(입력만의 함수).
export function buildRealDataResultReportPlan(
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): RealDataResultReportPlan {
  // (1) EvaluationResult[] → 결과 요약 descriptor(T-0580 위임). 빈 배열도 정상 집계
  // (count 0·전 슬롯 0·totalVolume 0). 매 호출 새 summary 객체 반환.
  const summary = buildRealDataResultSummary(results);

  // (2) 요약 + run 식별자 → 결과 이슈 descriptor(T-0582 위임). run.gitSha /
  // dateToken 빈/공백 의 하위 assertNonBlank throw 는 자체 try/catch 없이 그대로
  // 전파된다. 매 호출 새 descriptor 객체 반환.
  const descriptor = buildRealDataResultIssueDescriptor(summary, run);

  // self-wire — 산출 plan 의 두 구성요소(`summary`·`descriptor`)가 body 구조상 정합한
  // 한 묶음인지 반환 직전 self-assert (T-0647 builder self-wire 의 composer-side
  // mirror). 본 컴포저는 `summary` 와 `descriptor` 를 동시에 in-scope 로 갖는 유일한
  // 상위 지점이므로, descriptor 의 실제 body 와 summary 로 재유도한 기대값을 대조해
  // 자기 반환 계약(둘이 서로 정합)을 스스로 강제한다. 정상 합성이면 가드는 void
  // 반환하므로 동작·반환값 byte-identical 보존. 미래에 합성 순서·위임 대상이 회귀
  // (summary·descriptor 가 서로 다른 입력에서 산출)하면 부정합 plan 을 반환하기 전에
  // 한국어 명세형 에러로 즉시 throw 한다(fail-fast).
  assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary);

  // 새 plan 객체 — summary / descriptor 는 위임 helper 가 이미 무공유로 반환하므로
  // 입력 보존·무공유.
  const plan: RealDataResultReportPlan = { summary, descriptor };

  // 산출 plan 반환 직전 self-assert(T-0700 self-wire — T-0699 신설 result-report-plan
  // 가드 짝 닫기, T-0697 result-issue command-plan self-wire 의 mirror). 컴포저가 위임
  // 합성 순서 뒤바뀜·summary 집계 drift·descriptor title/marker/body drift·summary↔
  // descriptor cross 어긋남·위임 호출 입력 축 뒤바뀜 같은 합성 회귀로 산출물을
  // 손상시키면, single-source((results, run) 의 2 위임 helper 재유도)와의 정합 검증으로
  // 호출 시점에 fail-fast throw 한다. 위 body-consistency self-wire 는 산출 plan 의 두
  // 구성요소(summary↔descriptor) 가 body 구조상 정합한지(plan 내부 cross)를 검사하고,
  // 본 가드는 plan↔inputs(results, run) 재유도 축으로 보완한다 — 두 self-wire 는
  // 상호 보완(대체 0). 정상 합성이면 가드는 void → 반환 plan 형태(summary/descriptor)
  // 보존(관측 불가능하게 동일). 가드는 read-only 라 plan/results/run mutate 0. 위임
  // 가드 throw(run.gitSha/dateToken 빈/공백 → descriptor 재유도 단계 throw)는 컴포저가
  // 삼키지 않고 그대로 선전파한다(throw 전파 정책 동형).
  assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);

  return plan;
}

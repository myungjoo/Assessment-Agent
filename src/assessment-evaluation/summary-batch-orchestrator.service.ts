// SummaryBatchOrchestratorService — R-61 요약 평가 batch orchestrator service
// (T-0618, PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 service-경계 진입점).
// p5-summary-aggregate stream 의 순수 layer 가 end-to-end 로 닫혔다:
//   - T-0613 `enumerateSummaryDueCoordinates`(PR #527) — 좌표 enumerate.
//   - T-0614 `buildSummaryBatchPlan`(PR #528) — 좌표 × results map → plan tuple.
//   - T-0616 `runSummaryBatchPlan`(PR #530) — plan 순회 sequential await.
//   - T-0615 `summarizeSummaryBatchOutcome`(PR #529) — outcomes → 결정적 리포트.
//   - T-0617 `runSummaryBatchPipeline`(PR #531) — 위 plan→run→outcome 을 evaluator
//     주입형 순수 async pipeline 으로 묶음.
// T-0617 이 명시했듯 순수 pipeline 이 닫히면 남는 잔여 경계는 두 가지뿐이다:
// (a) DI / `@Injectable` 박제(이 순수 pipeline 을 service 경계로 감싸 실
// `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 evaluator 로 bind),
// (b) `resultsByCoordinate` collection bridge(좌표 → collection → `Activity[]` →
// 단위 평가, cross-module/RBAC ADR 영역). 본 service 는 그중 (a) 만 닫는다 — (b)
// collection bridge 는 여전히 Out of Scope(별도 ADR/slice).
//
// 핵심 adapt 책임: pipeline 의 `evaluator` 는 plan 의 한 `entry`(= `{ context,
// results, mode, options }`)와 `now` 를 받지만, 주입된 per-coordinate orchestrator
// `evaluateAndPersist` 는 `(context, results, mode, options, now)` 5-인자를 받는다.
// 본 service 는 evaluator 를 `(entry, now) => this.aggregateOrchestrator
// .evaluateAndPersist(entry.context, entry.results, entry.mode, entry.options, now)`
// 로 합성한다 — entry 4 필드 분해 + 5-인자 전달, 재구현 0. service 자체는 순수
// pipeline 의 결정성·실패 전파 계약을 그대로 상속하며(swallow 0), 부수효과(LLM
// 호출·DB write)는 전적으로 주입된 orchestrator → SummaryPersistService 책임으로
// 위임된다.
//
// 진입점은 여섯이다(모두 public): (1) `evaluateBatch(input)` — caller 가 이미
// enumerate 해 넘긴 `coordinates` 입력을 받는 좌표-진입점. (2) `evaluateBatchForRoster(
// roster)` — roster(personIds) + granularities 를 직접 받아 T-0624 순수 composer
// `buildSummaryBatchOrchestratorInput` 으로 `SummaryBatchOrchestratorInput` 을 조립한
// 뒤 (1) 에 위임하는 roster 실행 진입점(T-0625). roster-진입점은 composer + 기존 메서드
// 합성만(재구현 0) — 좌표 enumerate 가 caller-facing service 경계에서 처음 소비된다
// (T-0624 가 닫은 composer 의 미소비 공백을 본 메서드가 배선). (3) `previewRosterPlan(
// roster)` — roster 의 pre-flight 평가 범위(어느 roster · granularity · 몇 개 좌표가
// 돌아갈 것인가)를 batch 실행 **전에** 사람-친화 결정적 한국어 단일 라인으로 노출하는
// roster 사전조회 진입점(T-0629). T-0628 가 닫은 순수 formatter `formatSummaryBatchRosterPlan`
// 을 service 경계로 외화한다(평가·영속화·DB write·LLM 호출 0 — 동기 위임 1줄). caller(로그·
// journal·향후 notification surface)가 service 모듈 하나만 import 해 pre-flight 요약을 받는다.
// T-0636 이 산출 직후·반환 전에 `assertSummaryBatchRosterPlanShape(plan)`(T-0635) 형태 가드
// 단언을 배선해, 손상 plan 라인(개행 혼입·prefix drift·person/총 좌표 토큰 누락·버킷 슬롯
// 누락·빈 라인 위장 미래 회귀)이 표현 surface 로 silent leak 하기 전 fail-fast 차단한다(가드
// 본문 single-source `summary-batch-roster-plan-shape.ts`). T-0634 합본 report-shape 배선의
// 입력측 mirror.
// (4) `reportBatch(roster, result)` — batch 를 실행한 **후** "무엇을 평가하려 했는가(계획)
// vs 무엇을 평가했는가(결과)" 를 한 블록(정확히 2 라인)으로 합친 사람-친화 결정적 한국어
// 합본 요약을 노출하는 계획-결과 합본 진입점(T-0631). T-0630 이 닫은 순수 formatter
// `formatSummaryBatchReport(roster, result)` 를 service 경계로 외화한다(평가·영속화·DB
// write·LLM 호출 0 — formatter 위임 + 형태 가드 단언). caller(로그·journal·향후 notification
// surface)가 service 모듈 하나만 import 해 pre-flight 라인 + 결과 라인을 한 블록으로 받는다.
// T-0634 가 산출 직후·반환 전에 `assertSummaryBatchReportShape(report)`(T-0633) 형태 가드
// 단언을 배선해, 손상 report(라벨 drift·라인 수 변형·후행 개행·빈 본문 미래 회귀)가 표현
// surface 로 silent leak 하기 전 fail-fast 차단한다(가드 본문 single-source
// `summary-batch-report-shape.ts`).
// 평가 경로(`evaluateBatch`/`evaluateBatchForRoster`/주입된 orchestrator)를 호출하지 않으며,
// batch 결과 `result` 는 caller 가 이미 보유한 산출을 인자로 받는다(service 가 재실행 0).
// (5) `evaluateAndReportForRoster(roster)` — roster 실행 후 합본 리포트까지 한 호출로
// 반환하는 합성 진입점(T-0632). 내부에서 (2) `evaluateBatchForRoster(roster)` 로 실행해
// `result` 를 얻은 뒤 (4) `reportBatch(roster, result)` 로 합본 리포트를 산출하고
// `{ result, report }` 를 반환한다 — 두 메서드 합성만(재구현 0, pipeline 실행·formatter
// 렌더 복제 0). caller 가 "roster batch 실행 + 그 계획·결과 합본 리포트" 를 두 메서드 수동
// chain 없이 한 호출로 받는다(호출 순서·인자 drift 구조적 차단).
// T-0641 이 `reportBatch` 호출 직후·`{ result, report }` 반환 직전에
// `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언을 추가해 standalone
// outcome surface(caller 가 반환 객체에서 직접 역참조하는 `result.summaryLine`)에 대한
// 형태 불변식 가드를 합성 진입점에 배선한다. 합본 `report` 의 outcome 라인은 T-0634
// report-shape 가드가 별도 입력으로 보호하지만, `result.summaryLine` 필드는 그 가드의 보호
// 밖이라 본 배선이 비대칭을 닫는다(`previewOutcomeLine` 의 가드와 동일 대상·동일 단언 지점
// 정책 상속, 별개 산출 지점이라 이중 단언 아님).
// (6) `previewOutcomeLine(result)` — batch 실행 산출 `result.summaryLine`(outcome 한 줄
// 요약, pipeline 이 `formatSummaryBatchOutcome` 으로 산출)을 산출 직후·반환 전에
// `assertSummaryBatchOutcomeFormatShape(result.summaryLine)`(T-0638) 형태 가드 단언으로
// 검증한 뒤 standalone 으로 외화하는 outcome 사후조회 진입점(T-0640). `previewRosterPlan`
// (계획측, T-0629/T-0636)의 outcome-side mirror — caller(로그·journal·notification surface)
// 가 outcome 한 줄 요약만 단독으로(합본 리포트의 계획 라인 동반 없이) 얻는다. `result.plan`/
// `outcomes`/`report` 미접촉 · `formatSummaryBatchOutcome` 재호출 0(pipeline 산출 재사용,
// 재렌더 0). 손상 outcome 라인(개행 혼입·prefix drift·카운트/버킷 슬롯 누락)은 표현 surface
// 도달 전 가드 throw 로 fail-fast 차단(가드 본문 single-source
// `summary-batch-outcome-format-shape.ts`). `formatSummaryBatchReport`/`reportBatch` 의
// 합본 2번째 라인 가드는 T-0639 가 도메인 formatter 측에 이미 배선했으므로 본 진입점은 별개
// 산출 지점(이중 단언 아님).
//
// 부수효과 0(직접) / 새 외부 dependency 0 / 새 Prisma model 0 / 새 migration 0 —
// service 는 산출(plan/outcomes/report/summaryLine)을 변형 없이 묶기만 한다.
// `summaryLine`(report 의 사람-친화 결정적 한국어 단일 라인 요약)은 pipeline 이
// `formatSummaryBatchOutcome` 으로 산출하는 presentation 산출이며(T-0622, PR #536),
// service 는 그것을 재구현·가공 없이 service 경계까지 그대로 통과·노출한다(자동
// 상속 — service caller 도 코드 변경 0 으로 이 산출을 받는다). 입력
// `coordinates`/`resultsByCoordinate`/`now` 비변형(pipeline 비변형 계약 상속).
// raw 미저장(R-59).
//
// 책임 경계(task Out of Scope):
//   - controller / HTTP endpoint / DTO 추가 금지 — manual-trigger 요약 batch 평가
//     endpoint(route/RBAC/request·response shape) 배선은 별도 후속 slice(Q-0030
//     RBAC ADR-gated). 본 service 는 호출 대상이 되나 controller 배선은 별도.
//   - 좌표 → `EvaluationResult[]` 도출(collection bridge) 금지 — caller 가 results
//     map 을 이미 넘긴다고 전제(pipeline 과 동형).
//   - 좌표 enumerate(`enumerateSummaryDueCoordinates`, T-0613) 흡수 금지 — coordinates
//     는 caller 가 미리 enumerate 해 넘기는 입력.
//   - scheduler 자동 trigger 금지(@nestjs/schedule cron, P7 새 dep) — caller 가
//     호출하는 수동 진입점.
//   - mode / options / now 결정 로직 금지 — caller 가 넘긴 값을 pipeline 에 그대로 전달만.
//   - `Promise.all` / 병렬 실행 금지 — pipeline → run 의 순차 await 계약 상속.
import { Injectable } from "@nestjs/common";

import type { EvaluationResult } from "./domain/evaluation-result";
import { assertSummaryBatchOutcomeFormatShape } from "./domain/summary-batch-outcome-format-shape";
import {
  runSummaryBatchPipeline,
  type SummaryBatchPipelineResult,
} from "./domain/summary-batch-pipeline";
import { formatSummaryBatchReport } from "./domain/summary-batch-report-format";
import { assertSummaryBatchReportShape } from "./domain/summary-batch-report-shape";
import { buildSummaryBatchOrchestratorInput } from "./domain/summary-batch-roster-input";
import type { SummaryBatchRosterInput } from "./domain/summary-batch-roster-input";
import { assertSummaryBatchRosterInputConsistent } from "./domain/summary-batch-roster-input-consistency";
import { formatSummaryBatchRosterPlan } from "./domain/summary-batch-roster-plan-format";
import { assertSummaryBatchRosterPlanShape } from "./domain/summary-batch-roster-plan-shape";
import type { SummaryDueCoordinate } from "./domain/summary-due-coordinates";
import type { PersistMode } from "./evaluation-result-persist.service";
import { SummaryAggregateOrchestratorService } from "./summary-aggregate-orchestrator.service";
import type { SummaryPersistOptions } from "./summary-persist.service";

// SummaryBatchPipelineResult 를 re-export 한다 — caller 가 본 service 모듈 하나만
// import 해도 반환 타입을 함께 얻는다(새 타입 발명 0, pipeline 타입 그대로 재사용).
export type { SummaryBatchPipelineResult } from "./domain/summary-batch-pipeline";

// SummaryBatchOrchestratorInput — service 진입점의 단일 입력 객체(인자 순서 혼동
// 차단, JSDoc single-source). pipeline 입력과의 핵심 차이는 `evaluator` 가 없다는
// 점 — evaluator 는 service 가 주입된 orchestrator 로 내부 합성하기 때문이다. 나머지
// 5 필드는 pipeline 입력 surface 를 그대로 mirror 한다(새 surface 발명 0).
export interface SummaryBatchOrchestratorInput {
  // 좌표 입력(`enumerateSummaryDueCoordinates` 산출). caller 가 미리 enumerate 해 넘긴다.
  coordinates: SummaryDueCoordinate[];
  // 좌표 key → 단위 평가 묶음 look-up map. key 부재 시 빈 배열 부착(buildSummaryBatchPlan 계약).
  resultsByCoordinate: Map<string, EvaluationResult[]>;
  // 공통 영속화 모드 — 좌표마다 동일 부착(caller 가 선택, service 는 전달만).
  mode: PersistMode;
  // 공통 narrative 옵션(modelId) — 좌표마다 동일 부착.
  options: SummaryPersistOptions;
  // 판정 기준 현재 시각 — pipeline·evaluator 전체가 동일 instance 를 thread
  //  (같은 batch fire 동일 판정 기준 — T-0616/T-0617 계약 상속).
  now: Date;
}

@Injectable()
export class SummaryBatchOrchestratorService {
  // SummaryAggregateOrchestratorService 를 생성자 주입(NestJS class provider) — 같은
  // module 내 DI resolve(assessment-evaluation.module.ts). test 는 이 자리에 mock
  // { evaluateAndPersist: jest.fn() } 를 주입해 실 LLM 호출 0 / 실 DB write 0 /
  // live credential 0 으로 compose 정합만 검증한다(orchestrator mock 주입 패턴 mirror).
  constructor(
    private readonly aggregateOrchestrator: SummaryAggregateOrchestratorService,
  ) {}

  /**
   * R-61 요약 평가 batch 를 좌표 + results map + mode/options + now 입력 하나로 단일
   * service 호출로 평가·영속화·집계한다(PLAN.md P5 bullet 97 / REQ-061). 주입된
   * per-coordinate orchestrator 의 `evaluateAndPersist` 를 pipeline 의 evaluator 로
   * 합성해 `runSummaryBatchPipeline` 에 위임한다 — pipeline index 정합·plan thread·
   * 실패 전파는 pipeline 내부가 보장(재구현 0).
   *
   * evaluator adapt 계약:
   *   - service 가 `runSummaryBatchPipeline({ ...input, evaluator })` 를 호출하되,
   *     `evaluator` 를 `(entry, now) => this.aggregateOrchestrator.evaluateAndPersist(
   *     entry.context, entry.results, entry.mode, entry.options, now)` 로 합성한다
   *     (entry 4 필드 분해 + 5-인자 전달, 재구현 0).
   *   - `input.now` 는 pipeline·evaluator 전체에 동일 instance 로 thread 된다
   *     (같은 batch fire 동일 판정 기준 — T-0616/T-0617 계약 상속).
   *   - 매 호출마다 evaluator 를 새로 합성한다 — 같은 service 인스턴스로 2 회 호출해도
   *     두 호출은 서로 독립(이전 호출 잔여 상태 누수 0).
   *
   * 실패 전파 계약 상속(swallow 0):
   *   - 주입된 orchestrator 의 `evaluateAndPersist` 가 reject/throw 하면(예:
   *     persistSummary reject, 알 수 없는 period TypeError, Invalid Date boundary
   *     TypeError) pipeline 이 그 error 를 전파하므로 본 service 도 그대로 전파한다.
   *   - 중간 reject 시 outcome 집계 미실행(부분 성공 위장 0 — pipeline 의 await 가
   *     즉시 전파, summarize 단계 미도달).
   *   - 빈 입력(`coordinates` 빈 배열) → 빈 plan/outcomes + report 전 카운트 0 +
   *     orchestrator 호출 0(throw 0, pipeline 정책 상속).
   *
   * @param input 좌표 / resultsByCoordinate / mode / options / now 를 묶은 단일 객체
   *   (`evaluator` 는 service 내부 합성이라 입력에 없음).
   * @returns pipeline 의 `{ plan, outcomes, report, summaryLine }` 4 산출을 가공 없이
   *   그대로 노출(`summaryLine` = report 의 사람-친화 한 줄 요약, pipeline 이
   *   `formatSummaryBatchOutcome` 으로 산출 — service 변형 0. presentation 산출이
   *   service 경계까지 자동 상속됨을 박제).
   * @throws 주입된 orchestrator / 하위 pipeline 조각이 던진 error 를 그대로 전파.
   */
  async evaluateBatch(
    input: SummaryBatchOrchestratorInput,
  ): Promise<SummaryBatchPipelineResult> {
    // 매 호출마다 evaluator 를 새로 합성한다(호출 간 독립성 보장 — 잔여 상태 누수 0).
    // entry 4 필드를 분해해 주입된 orchestrator 의 5-인자 evaluateAndPersist 에 전달한다
    //  (재구현 0). now 는 동일 instance 를 그대로 전달(pipeline 이 전 좌표에 thread).
    return runSummaryBatchPipeline({
      coordinates: input.coordinates,
      resultsByCoordinate: input.resultsByCoordinate,
      mode: input.mode,
      options: input.options,
      now: input.now,
      evaluator: (entry, now) =>
        this.aggregateOrchestrator.evaluateAndPersist(
          entry.context,
          entry.results,
          entry.mode,
          entry.options,
          now,
        ),
    });
  }

  /**
   * R-61 요약 평가 batch 를 roster(`personIds`) + granularities 를 직접 받는
   * roster-진입점으로 평가·영속화·집계한다(PLAN.md P5 bullet 97 / REQ-061). T-0624 가
   * 닫은 순수 composer `buildSummaryBatchOrchestratorInput(roster)` 로
   * `SummaryBatchOrchestratorInput`(좌표 enumerate 포함)을 결정적으로 조립한 뒤 기존
   * 좌표-진입점 `evaluateBatch(input)` 에 그대로 위임한다 — composer + 기존 메서드 합성만
   * (재구현 0). 본 메서드가 좌표 enumerate 를 caller-facing service 경계에서 처음 소비한다
   * (T-0624 composer 의 미소비 공백 배선).
   *
   * 흐름:
   *   0. `assertSummaryBatchRosterInputConsistent(roster)` — composer 조립 **직전** ·
   *      위임 전에 roster 의 `resultsByCoordinate` orphan key(enumerate 가 산출하지 않은
   *      stray 좌표)를 단언 지점에서 fail-fast 로 막는다(orphan-result 가 plan-building 에서
   *      silent drop 되기 전에 차단 — T-0621 가드 배선과 동형). 정합 roster 면 void(무회귀).
   *   1. `input = buildSummaryBatchOrchestratorInput(roster)` — roster × granularity 를
   *      `enumerateSummaryDueCoordinates` 로 좌표 enumerate(위임만) 후 resultsByCoordinate/
   *      mode/options/now 를 변형 0 으로 부착한 `SummaryBatchOrchestratorInput` 조립.
   *   2. `return this.evaluateBatch(input)` — 기존 좌표-진입점에 위임(pipeline 합성·실패
   *      전파·결정성은 그 메서드/하위 pipeline 이 보장).
   *
   * `now` instance thread: composer 가 `roster.now` 를 변형 0 으로 그대로 부착하고
   * `evaluateBatch` → pipeline 이 그 동일 instance 를 전 좌표 evaluator 에 thread 한다
   * (같은 batch fire 동일 판정 기준 — T-0616/T-0617/T-0624 계약 상속).
   *
   * 실패 전파 상속(swallow 0):
   *   - `roster` null/undefined → composer 직접 가드의 한국어 `TypeError` 전파.
   *   - `personIds`/`granularities` null/undefined · 알 수 없는 granularity · `now`
   *     Invalid Date → composer 가 위임한 `enumerateSummaryDueCoordinates` helper 의
   *     TypeError/RangeError 전파(fail-fast — 좌표 enumerate 단계, evaluator 미도달).
   *   - 주입된 orchestrator `evaluateAndPersist` reject/throw → `evaluateBatch` 위임 경로
   *     로 그대로 전파(부분 성공 위장 0 — summarize 단계 미도달).
   *   - 빈 roster(빈 `personIds` 또는 빈 `granularities`) → 빈 `coordinates` → 빈 plan/
   *     outcomes + report 전 카운트 0 + orchestrator 호출 0(throw 0, enumerate/pipeline 정책 상속).
   *
   * 매 호출마다 composer + evaluator 를 새로 합성한다 — 같은 service 인스턴스로 2 회
   * 호출해도 두 호출은 서로 독립(이전 호출 잔여 상태 누수 0). roster 입력 객체·배열·map·
   * `now` 비변형(composer 의 비변형 계약 상속 — service 가 추가 변형 0).
   *
   * @param roster `personIds` / `granularities` / `resultsByCoordinate` / `mode` /
   *   `options` / `now` 를 묶은 단일 객체(`SummaryBatchRosterInput`, positional 인자 혼동
   *   차단). 좌표는 service 가 내부 composer 로 enumerate 하므로 입력에 없다.
   * @returns `evaluateBatch` 위임이 반환하는 `{ plan, outcomes, report, summaryLine }`
   *   4 산출을 가공 없이 그대로 노출(좌표-진입점과 동일 산출 — composer 가 동일
   *   `SummaryBatchOrchestratorInput` 을 조립하므로 정합).
   * @throws roster 의 `resultsByCoordinate` 에 enumerate 가 산출하지 않은 orphan key 가
   *   있으면 `assertSummaryBatchRosterInputConsistent` 가 `RangeError` 로 fail-fast(silent
   *   drop 차단), roster null/undefined 면 `TypeError`. 그 외 composer /
   *   `enumerateSummaryDueCoordinates` / 하위 pipeline 조각 / 주입된 orchestrator 가 던진
   *   error 도 그대로 전파.
   */
  async evaluateBatchForRoster(
    roster: SummaryBatchRosterInput,
  ): Promise<SummaryBatchPipelineResult> {
    // composer 조립 **직전** orphan-result 가드 단언 — roster 의 resultsByCoordinate 에
    // enumerate 가 산출하지 않은 orphan 좌표 key 가 있으면 RangeError(roster null/undefined
    // 면 TypeError)로 fail-fast 해, 그 orphan 이 plan-building 단계에서 silent drop 되기
    // 전에 막는다(T-0621 outcome 가드 배선과 동형 — exists-but-unwired 가드를 산출 경로
    // 직전 단언 지점에 배선). 순수 가드(부수효과 0·입력 비변형)라 정합 roster 면 void.
    assertSummaryBatchRosterInputConsistent(roster);

    // roster → SummaryBatchOrchestratorInput 조립(좌표 enumerate 포함) 후 기존
    // 좌표-진입점에 위임한다 — composer + evaluateBatch 합성만(재구현 0). roster
    // null/undefined·필드 무결성·Invalid Date 의 fail-fast 는 위 가드/composer/enumerate 가 전파.
    const input = buildSummaryBatchOrchestratorInput(roster);
    return this.evaluateBatch(input);
  }

  /**
   * R-61 요약 평가 batch 의 roster pre-flight 평가 범위(어느 roster · 어느 granularity ·
   * 몇 개 좌표가 enumerate 될 것인가)를 batch 실행 **전에** 사람-친화 결정적 한국어 단일
   * 라인으로 산출하는 roster 사전조회 진입점(PLAN.md P5 bullet 97 / REQ-061). T-0628 가
   * 닫은 순수 formatter `formatSummaryBatchRosterPlan(roster)` 를 service 경계로 외화하고,
   * T-0635 가 닫은 순수 형태 가드 `assertSummaryBatchRosterPlanShape(plan)` 를 산출 직후·반환
   * 전에 단언해 손상 plan 라인이 표현 surface 로 새기 전 fail-fast 차단한다(T-0636 wiring).
   * 본문은 formatter 위임 + 형태 가드 단언. T-0623 이 outcome formatter(결과측)를 service
   * 경계로 외화한 패턴의 입력측 mirror, T-0634 합본 report-shape 배선의 입력측 mirror.
   *
   * 동기(`string` 반환, async 아님): formatter·가드 모두 순수 동기 함수이므로 평가·영속화·DB
   * write·LLM 호출 0. 평가 경로(`evaluateBatch`/`evaluateBatchForRoster`/주입된
   * orchestrator)를 호출하지 않는다 — pre-flight 요약은 실행 0(좌표 식별 축만 counting).
   *
   * 흐름:
   *   1. `const plan = formatSummaryBatchRosterPlan(roster)` — 순수 formatter 위임으로
   *      결정적 한국어 단일 라인 pre-flight 계획 라인 산출(재구현 0).
   *   2. `assertSummaryBatchRosterPlanShape(plan)` — 1 의 산출이 형태 불변식(① string ·
   *      ② 개행 0(단일 라인) · ③ prefix `요약 평가 batch 예정: ` · ④ `person N명` 토큰 ·
   *      ⑤ `· 총 N좌표 [` 토큰 · ⑥ `[day N · week N · month N · other N]` 4 버킷 슬롯 고정
   *      순서)을 만족하는지 단언. 정합이면 void 반환(무회귀), 위반이면 TypeError(구조 결손)/
   *      RangeError(형태 위반) 전파해 손상 plan 라인이 caller(로그·journal·notification
   *      surface)에 도달하기 전 차단(single-source `summary-batch-roster-plan-shape.ts`).
   *   3. `return plan` — 가드 통과한 정상 plan 라인을 변형 없이 반환.
   *
   * 실패 전파 상속(swallow 0):
   *   - `roster` null/undefined → formatter 직접 가드의 한국어 `TypeError` 전파(가드 단계 미도달).
   *   - `personIds`/`granularities` null/undefined · 알 수 없는 granularity · `now`
   *     Invalid Date → formatter 가 위임한 `enumerateSummaryDueCoordinates` helper 의
   *     TypeError/RangeError 전파(fail-fast — 가드 단계 미도달).
   *   - formatter 산출이 형태 불변식 위반(개행 혼입·prefix drift·person/총 좌표 토큰 누락·
   *     버킷 슬롯 누락·빈 라인 위장) → `assertSummaryBatchRosterPlanShape` 가 한국어
   *     TypeError(구조 결손)/RangeError(형태 위반) 전파(미래 회귀 차단 — 단언 지점 fail-fast).
   *   - 빈 roster(빈 `personIds` 또는 빈 `granularities`) → 좌표 0 의 pre-flight 요약
   *     문자열 정상 반환(throw 0, `총 0좌표` 명시 — formatter 정책 + 가드 통과 상속).
   *
   * 입력 비변형(roster·personIds·granularities·now·plan 읽기만 — formatter·가드 비변형 계약
   * 상속). 동일 roster → byte-identical 출력(formatter·가드 결정성 상속, 잔여 상태 누수 0).
   *
   * @param roster `personIds` / `granularities` / `now` 를 formatter 가 읽는 roster 입력
   *   (`SummaryBatchRosterInput`). 변형하지 않는다(읽기만).
   * @returns 결정적 한국어 단일 라인 pre-flight 요약 문자열(개행 0) — 형태 가드 단언을
   *   통과한 정상 plan 라인만 반환. 빈 roster 도 빈 문자열이 아니라 `총 0좌표` 를 명시.
   * @throws {TypeError} `roster` 가 null/undefined 일 때(formatter 직접 가드), 또는
   *   `personIds`/`granularities` null/undefined · `now` Invalid Date 의 enumerate 위임
   *   TypeError 전파, 또는 `assertSummaryBatchRosterPlanShape` 가 던지는 구조 결손
   *   TypeError(plan 이 string 이 아닌 미래 회귀 — 형태 가드 본문 single-source 참조
   *   `summary-batch-roster-plan-shape.ts`).
   * @throws {RangeError} `granularities` 에 알 수 없는 period 가 포함될 때 enumerate 위임
   *   helper 의 RangeError 전파, 또는 `assertSummaryBatchRosterPlanShape` 가 던지는 형태
   *   위반 RangeError(개행 혼입·prefix drift·person/총 좌표 토큰 누락·버킷 슬롯 누락 미래
   *   회귀 — 형태 가드 본문 single-source 참조 `summary-batch-roster-plan-shape.ts`).
   */
  previewRosterPlan(roster: SummaryBatchRosterInput): string {
    // 1. 순수 formatter 위임으로 pre-flight 계획 라인 산출(재구현 0).
    const plan = formatSummaryBatchRosterPlan(roster);
    // 2. 산출 직후·반환 전 단일 라인 형태 불변식 단언(T-0636 wiring) — 손상 plan 라인이
    //    표현 surface(로그·journal·notification)로 새기 전 fail-fast 차단. 정합이면 void
    //    반환(무회귀), 위반이면 한국어 TypeError(구조)/RangeError(형태) 전파(single-source
    //    가드 본문 `summary-batch-roster-plan-shape.ts`).
    assertSummaryBatchRosterPlanShape(plan);
    // 3. 가드 통과한 정상 plan 라인을 변형 없이 반환.
    return plan;
  }

  /**
   * R-61 요약 평가 batch 의 pre-flight 평가 범위(계획)와 outcome 결과(`result.summaryLine`)
   * 를 batch 실행 **후** "무엇을 평가하려 했는가(계획) vs 무엇을 평가했는가(결과)" 한 블록
   * (정확히 2 라인)으로 합친 사람-친화 결정적 한국어 합본 요약을 산출하는 계획-결과 합본
   * 진입점(PLAN.md P5 bullet 97 / REQ-061). T-0630 이 닫은 순수 formatter
   * `formatSummaryBatchReport(roster, result)` 를 service 경계로 외화하고, T-0633 가 닫은
   * 순수 형태 가드 `assertSummaryBatchReportShape(report)` 를 산출 직후·반환 전에 단언해
   * 손상 report 가 표현 surface 로 새기 전 fail-fast 차단한다(T-0634 wiring). 본문은
   * formatter 위임 + 형태 가드 단언. T-0629(`previewRosterPlan`, 계획측)·T-0623(outcome
   * formatter, 결과측) 외화 패턴의 합본 mirror.
   *
   * 동기(`string` 반환, async 아님): formatter·가드 모두 순수 동기 함수이므로 평가·영속화·
   * DB write·LLM 호출 0. 평가 경로(`evaluateBatch`/`evaluateBatchForRoster`/주입된
   * orchestrator)를 호출하지 않는다 — 합본 요약은 실행 0(caller 가 이미 보유한 `result` 를
   * 인자로 받아 계획 라인과 합성만, batch 재실행 0).
   *
   * 흐름:
   *   1. `const report = formatSummaryBatchReport(roster, result)` — 순수 formatter 위임으로
   *      계획 라인 + 결과 라인 2 라인 합본 한국어 리포트 블록 산출(재구현 0).
   *   2. `assertSummaryBatchReportShape(report)` — 1 의 산출이 형태 불변식(① string · ② 정확히
   *      2 라인(`\n` 1개) · ③ 후행 개행 0 · ④ 1번째 라인 `계획: ` 라벨 + 본문 non-empty ·
   *      ⑤ 2번째 라인 `결과: ` 라벨 + 본문 non-empty)을 만족하는지 단언. 정합이면 void
   *      반환(무회귀), 위반이면 TypeError(구조 결손)/RangeError(형태 위반) 전파해 손상
   *      report 가 caller(로그·journal·notification surface)에 도달하기 전 차단(T-0633 단일
   *      source 참조 — single-source `summary-batch-report-shape.ts`).
   *   3. `return report` — 가드 통과한 정상 report 를 변형 없이 반환.
   *
   * 실패 전파 상속(swallow 0):
   *   - `roster` null/undefined → formatter 가 위임한 `formatSummaryBatchRosterPlan`
   *     직접 가드의 한국어 `TypeError` 전파.
   *   - `result` null/undefined → formatter 직접 가드의 한국어 `TypeError` 전파
   *     (`result.summaryLine` 역참조 전 fail-fast).
   *   - `result.summaryLine` 누락/비-string → formatter 직접 가드의 한국어 `TypeError` 전파.
   *   - `personIds`/`granularities` null/undefined · 알 수 없는 granularity · `now`
   *     Invalid Date → formatter 가 위임한 enumerate helper 의 TypeError/RangeError 전파.
   *   - formatter 산출이 형태 불변식 위반(라벨 drift·라인 수·후행 개행·빈 본문) →
   *     `assertSummaryBatchReportShape` 가 한국어 TypeError(구조 결손)/RangeError(형태 위반)
   *     전파(미래 회귀 차단 — 단언 지점에서 fail-fast).
   *
   * 입력 비변형(roster·result·result.summaryLine 읽기만 — formatter·가드 비변형 계약 상속).
   * 동일 (roster, result) → byte-identical 출력(formatter·가드 결정성 상속, 잔여 상태 누수 0).
   *
   * @param roster pre-flight 계획 라인 위임(`formatSummaryBatchRosterPlan`)이 소비할 roster
   *   입력(`SummaryBatchRosterInput`). 변형하지 않는다(읽기만).
   * @param result caller 가 이미 보유한 batch pipeline 산출(`SummaryBatchPipelineResult`).
   *   본 메서드는 `result.summaryLine`(이미 렌더된 string) 만 읽는다(plan/outcomes/report
   *   미접촉). service 가 재실행하지 않는다(읽기만).
   * @returns 결정적 한국어 2 라인 블록 문자열(계획 라인 + 결과 라인, 개행 정확히 1개) —
   *   형태 가드 단언을 통과한 정상 report 만 반환.
   * @throws {TypeError} `result` 가 null/undefined 일 때(직접 가드), `result.summaryLine`
   *   이 string 이 아닐 때, `roster` null/undefined · enumerate 위임 TypeError 전파, 또는
   *   `assertSummaryBatchReportShape` 가 던지는 구조 결손 TypeError(report 가 string 이 아닌
   *   미래 회귀 — 형태 가드 본문 single-source 참조 `summary-batch-report-shape.ts`).
   * @throws {RangeError} `roster.granularities` 에 알 수 없는 period 가 포함될 때 enumerate
   *   위임 helper 의 RangeError 전파, 또는 `assertSummaryBatchReportShape` 가 던지는 형태
   *   위반 RangeError(라벨 drift·라인 수 ≠ 2·후행 개행·라벨 뒤 본문 빈 미래 회귀 — 형태
   *   가드 본문 single-source 참조 `summary-batch-report-shape.ts`).
   */
  reportBatch(
    roster: SummaryBatchRosterInput,
    result: SummaryBatchPipelineResult,
  ): string {
    // 1. 순수 formatter 위임으로 합본 리포트 산출(재구현 0).
    const report = formatSummaryBatchReport(roster, result);
    // 2. 산출 직후·반환 전 형태 불변식 단언(T-0634 wiring) — 손상 report 가 표현 surface
    //    (로그·journal·notification)로 새기 전 fail-fast 차단. 정합이면 void 반환(무회귀),
    //    위반이면 한국어 TypeError(구조)/RangeError(형태) 전파(single-source 가드 본문
    //    `summary-batch-report-shape.ts`).
    assertSummaryBatchReportShape(report);
    // 3. 가드 통과한 정상 report 를 변형 없이 반환.
    return report;
  }

  /**
   * R-61 요약 평가 batch 를 roster 로 실행한 **후** 그 계획·결과 합본 리포트까지 한 호출로
   * 반환하는 합성 진입점(PLAN.md P5 bullet 97 / REQ-061). roster 실행 진입점
   * `evaluateBatchForRoster(roster)`(T-0625)와 사후 합본 리포트 진입점
   * `reportBatch(roster, result)`(T-0631)가 두 메서드로 분리돼, caller(로그·journal·
   * notification·관측 surface)가 "roster batch 를 실행하고 그 계획+결과를 한 블록으로 받기"
   * 위해 두 호출을 손수 이어야 했던 공백을 닫는다. 본 메서드는 그 두 호출을 합성만 한다 —
   * pipeline 실행·formatter 렌더 로직을 복제하지 않는다(재구현 0).
   *
   * 흐름:
   *   1. `const result = await this.evaluateBatchForRoster(roster)` — roster 를 실행해
   *      `SummaryBatchPipelineResult`(`{ plan, outcomes, report, summaryLine }`)를 얻는다
   *      (orphan-result 가드·composer·pipeline 합성·실패 전파는 그 메서드가 보장).
   *   2. `const report = this.reportBatch(roster, result)` — 1 의 산출과 동일 `roster` 로
   *      계획 라인 + 결과 라인 2 라인 합본 한국어 리포트 블록을 산출한다(formatter 위임).
   *      `reportBatch` 가 T-0634 형태 가드 단언을 산출 직후 수행하므로 손상 report 는
   *      여기에서 fail-fast 전파되어 본 메서드의 반환·report 미생성으로 이어진다
   *      (별도 가드 호출 0 — 자동 상속).
   *   3. `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` — 2 가 통과한 뒤·반환
   *      전에 standalone outcome surface (`result.summaryLine`) 에 대해 형태 불변식 단언을
   *      1 회 추가한다(T-0641 wiring). 합본 `report` 는 step 2 가드가 보호하지만 caller 가
   *      `{ result, report }` 에서 `result.summaryLine` 을 직접 역참조하는 경로는 그 가드의
   *      보호 밖이라, 본 메서드가 그 비대칭을 닫는다(`previewOutcomeLine` 의 가드와 동일
   *      대상·동일 단언 지점 정책을 합성 진입점에 상속). 정합 라인이면 void(무회귀), 위반이면
   *      한국어 TypeError(구조)/RangeError(형태) 전파해 손상 `result.summaryLine` 이 caller
   *      (로그·journal·notification surface)에 도달하기 전 차단(single-source 가드 본문
   *      `summary-batch-outcome-format-shape.ts`). step 2 의 report-shape 가드와는 입력이
   *      다르므로 이중 단언 아님(서로 다른 불변식).
   *   4. `return { result, report }` — 실행 산출(동일 instance)과 합본 리포트 문자열을 묶어 반환.
   *
   * 합성만(재구현 0): pipeline 실행은 `evaluateBatchForRoster`, 리포트 렌더는 `reportBatch`
   * 가 전적으로 소유한다. 본 메서드는 두 호출의 순서·인자(같은 `roster`, 1 의 `result`)와
   * 반환 직전 outcome-line 형태 가드 단언 1 줄만 배선한다.
   *
   * 실패 전파 상속(swallow 0):
   *   - `roster` null/undefined → `evaluateBatchForRoster` 의 가드/composer TypeError 전파.
   *   - `resultsByCoordinate` orphan key → `evaluateBatchForRoster` 의 orphan 가드
   *     `RangeError` 전파(실행 미도달).
   *   - `personIds`/`granularities` null/undefined · 알 수 없는 granularity · `now`
   *     Invalid Date → enumerate 위임의 TypeError/RangeError 전파(좌표 단계 fail-fast).
   *   - 주입된 orchestrator `evaluateAndPersist` reject/throw → `evaluateBatchForRoster`
   *     경로로 그대로 전파되고, **`reportBatch` 에 도달하지 않는다**(report 미생성 —
   *     await 가 즉시 reject, step 2/3 미실행).
   *   - `reportBatch` 의 report-shape 가드 throw → step 3 outcome 가드 미도달(report 단계
   *     fail-fast, 반환 미도달).
   *   - step 3 outcome 가드가 형태 불변식 위반 → 한국어 TypeError/RangeError 전파, 반환
   *     미도달(손상 `result.summaryLine` caller 미반환).
   *   - 빈 roster(빈 `personIds` 또는 빈 `granularities`) → 빈 실행 산출 + report 빈 batch
   *     2 라인 블록(throw 0, 하위 정책 상속).
   *
   * 매 호출마다 `evaluateBatchForRoster` 가 evaluator·composer 를 새로 합성하므로 같은
   * service 인스턴스로 2 회 호출해도 두 호출은 서로 독립(잔여 상태 누수 0). roster 입력
   * 객체·배열·map·`now` 비변형(두 위임 메서드의 비변형 계약 상속 — service 추가 변형 0).
   * 동일 roster → 결정적 report(formatter 결정성 상속).
   *
   * @param roster `personIds` / `granularities` / `resultsByCoordinate` / `mode` /
   *   `options` / `now` 를 묶은 단일 객체(`SummaryBatchRosterInput`). 좌표는 service 가
   *   내부 composer 로 enumerate 하므로 입력에 없다. 변형하지 않는다.
   * @returns `{ result, report }` — `result` 는 `evaluateBatchForRoster` 가 반환한
   *   `SummaryBatchPipelineResult`(동일 instance), `report` 는 `reportBatch(roster, result)`
   *   가 반환한 결정적 한국어 2 라인 합본 리포트 블록 문자열(계획 라인 + 결과 라인).
   * @throws `evaluateBatchForRoster`(가드/composer/enumerate/하위 pipeline/주입된
   *   orchestrator)가 던진 error 를 그대로 전파(reject 시 `reportBatch` 미도달, report 미생성).
   *   `reportBatch` 가 자기 내부에서 던지는 `assertSummaryBatchReportShape` TypeError/
   *   RangeError 도 step 2 에서 전파되어 본 메서드 반환 미도달(T-0634 자동 상속).
   */
  async evaluateAndReportForRoster(
    roster: SummaryBatchRosterInput,
  ): Promise<{ result: SummaryBatchPipelineResult; report: string }> {
    // 1. roster 실행 — orphan-result 가드·composer·pipeline 합성·실패 전파는 위임 메서드가
    //    보장(재구현 0). reject 시 await 가 즉시 전파해 아래 reportBatch 에 도달하지 않는다.
    const result = await this.evaluateBatchForRoster(roster);
    // 2. 1 과 동일 roster + 그 result 로 계획·결과 합본 리포트 산출(formatter 위임, 재실행 0).
    //    reportBatch 내부의 T-0634 report-shape 가드가 합본 report 문자열 손상을 차단한다.
    const report = this.reportBatch(roster, result);
    // 3. 반환 직전 standalone outcome surface (result.summaryLine) 형태 불변식 단언(T-0641
    //    wiring) — step 2 report-shape 가드는 합본 report 문자열 대상이라 caller 가
    //    `{ result, report }` 에서 result.summaryLine 을 직접 역참조하는 경로(previewOutcomeLine
    //    의 단독 외화와 동일 surface)는 보호 밖이다. 본 단언이 그 비대칭을 닫는다 —
    //    `previewOutcomeLine`(T-0640) 의 가드와 동일 대상·동일 단언 지점 정책을 합성 진입점에
    //    상속. 정합이면 void(무회귀), 위반이면 한국어 TypeError(구조)/RangeError(형태) 전파해
    //    손상 라인이 caller(로그·journal·notification surface)에 도달하기 전 차단(single-source
    //    가드 본문 `summary-batch-outcome-format-shape.ts`). step 2 가드와는 입력이 다르므로
    //    이중 단언 아님(서로 다른 불변식).
    assertSummaryBatchOutcomeFormatShape(result.summaryLine);
    // 4. 두 가드 모두 통과 — 실행 산출(동일 instance)과 합본 리포트 문자열을 묶어 반환.
    return { result, report };
  }

  /**
   * R-61 요약 평가 batch 의 outcome 한 줄 요약(`result.summaryLine`)을 batch 실행 **후**
   * standalone 으로 외화하는 outcome 사후조회 진입점(PLAN.md P5 bullet 97 / REQ-061).
   * pipeline 이 `formatSummaryBatchOutcome` 으로 산출해 `result.summaryLine` 에 부착한
   * outcome 한 줄 요약을, 산출 직후·반환 전에 T-0638 순수 형태 가드
   * `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언으로 검증한 뒤 변형 없이
   * 반환한다. `previewRosterPlan`(계획측, T-0629/T-0636)의 정확한 outcome-side mirror —
   * 이번엔 결과측 outcome 라인을 단독으로 외화한다. 본 진입점이 닫히면 p5-summary-aggregate
   * stream 의 표현 양 반쪽이 모두 service 경계 standalone 진입점(계획 라인 `previewRosterPlan`
   * · outcome 라인 `previewOutcomeLine`) + 산출 직전 형태 가드까지 대칭으로 완결된다.
   *
   * 동기(`string` 반환, async 아님): 가드는 순수 동기 함수이고 본 메서드는 caller 가 이미
   * 보유한 `result.summaryLine`(이미 렌더된 string)만 읽는다 — 평가·영속화·DB write·LLM
   * 호출 0, `formatSummaryBatchOutcome` 재호출 0(pipeline 산출 재사용, 재렌더 0). 평가 경로
   * (`evaluateBatch`/`evaluateBatchForRoster`/주입된 orchestrator)를 호출하지 않는다.
   *
   * 흐름:
   *   1. `result` null/undefined 직접 가드 — `result.summaryLine` 역참조 전에 한국어
   *      `TypeError` 로 fail-fast(`reportBatch` 가 formatter 위임으로 동일 가드를 수행하는
   *      것과 동형의 직접 방어).
   *   2. `const line = result.summaryLine` — outcome 한 줄 요약을 읽는다(plan/outcomes/
   *      report 미접촉). `summaryLine` 이 비-string 이면 다음 가드가 TypeError 로 전파한다.
   *   3. `assertSummaryBatchOutcomeFormatShape(line)` — 2 의 라인이 형태 불변식(① string ·
   *      ② 개행 0(단일 라인) · ③ prefix `요약 평가 batch: 총 N건` · ④ 5 카운트 토큰
   *      (evaluated/skipped/created/existing) · ⑤ `[day N · week N · month N · other N]`
   *      4 버킷 고정 순서)을 만족하는지 단언. 정합이면 void(무회귀), 위반이면 TypeError
   *      (구조 결손)/RangeError(형태 위반)를 그대로 전파해 손상 outcome 라인이 caller
   *      (로그·journal·notification surface)에 도달하기 전 차단(single-source 가드 본문
   *      `summary-batch-outcome-format-shape.ts`).
   *   4. `return line` — 가드 통과한 정상 outcome 라인을 변형 없이 반환.
   *
   * 실패 전파 상속(swallow 0):
   *   - `result` null/undefined → 1 의 직접 가드 한국어 `TypeError` 전파(가드 단계 미도달).
   *   - `result.summaryLine` 비-string(undefined/number 등) → 3 의
   *     `assertSummaryBatchOutcomeFormatShape` ① TypeError 전파.
   *   - outcome 라인이 형태 불변식 위반(개행 혼입·prefix drift·카운트/버킷 슬롯 누락) →
   *     3 의 가드 RangeError 전파(미래 회귀 차단 — 단언 지점 fail-fast, 손상 라인 미반환).
   *
   * 입력 비변형(`result`·`result.summaryLine` 읽기만 — 가드 비변형 계약 상속). 동일
   * `result` → byte-identical 출력(가드 결정성 상속, 잔여 상태 누수 0). raw 미저장(R-59 —
   * 형태 검증만, 평가 본문·summaryId 미접촉).
   *
   * @param result caller 가 이미 보유한 batch pipeline 산출(`SummaryBatchPipelineResult`).
   *   본 메서드는 `result.summaryLine`(이미 렌더된 string) 만 읽는다(plan/outcomes/report
   *   미접촉). service 가 재실행하지 않는다(읽기만).
   * @returns 가드 단언을 통과한 정상 outcome 한 줄 요약 문자열(개행 0) — `result.summaryLine`
   *   과 byte-identical(가드가 정상 라인 변형·차단 0).
   * @throws {TypeError} `result` 가 null/undefined 일 때(직접 가드), 또는 `result.summaryLine`
   *   이 string 이 아닐 때 `assertSummaryBatchOutcomeFormatShape` 가 던지는 구조 결손 TypeError
   *   (형태 가드 본문 single-source 참조 `summary-batch-outcome-format-shape.ts`).
   * @throws {RangeError} `result.summaryLine` 이 형태 불변식을 위반할 때(개행 혼입·prefix
   *   drift·카운트 토큰 누락·버킷 슬롯 누락) `assertSummaryBatchOutcomeFormatShape` 가 던지는
   *   형태 위반 RangeError(형태 가드 본문 single-source 참조
   *   `summary-batch-outcome-format-shape.ts`).
   */
  previewOutcomeLine(result: SummaryBatchPipelineResult): string {
    // 1. result null/undefined 직접 가드 — summaryLine 역참조 전 한국어 TypeError 로
    //    fail-fast(reportBatch 의 formatter 위임 직접 가드와 동형 방어).
    if (result === null || result === undefined) {
      throw new TypeError(
        "result 가 null/undefined 다(outcome 라인 외화 불가 — summaryLine 역참조 전 차단).",
      );
    }
    // 2. outcome 한 줄 요약을 읽는다(plan/outcomes/report 미접촉, formatSummaryBatchOutcome
    //    재호출 0 — pipeline 산출 재사용). 비-string 이면 아래 가드가 TypeError 로 전파.
    const line = result.summaryLine;
    // 3. 산출 직후·반환 전 단일 라인 형태 불변식 단언(T-0640 wiring) — 손상 outcome 라인이
    //    표현 surface(로그·journal·notification)로 새기 전 fail-fast 차단. 정합이면 void
    //    반환(무회귀), 위반이면 한국어 TypeError(구조)/RangeError(형태) 전파(single-source
    //    가드 본문 `summary-batch-outcome-format-shape.ts`).
    assertSummaryBatchOutcomeFormatShape(line);
    // 4. 가드 통과한 정상 outcome 라인을 변형 없이 반환.
    return line;
  }
}

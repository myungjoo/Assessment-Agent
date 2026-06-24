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
// 진입점은 둘이다(둘 다 public): (1) `evaluateBatch(input)` — caller 가 이미
// enumerate 해 넘긴 `coordinates` 입력을 받는 좌표-진입점. (2) `evaluateBatchForRoster(
// roster)` — roster(personIds) + granularities 를 직접 받아 T-0624 순수 composer
// `buildSummaryBatchOrchestratorInput` 으로 `SummaryBatchOrchestratorInput` 을 조립한
// 뒤 (1) 에 위임하는 roster-진입점(T-0625, PR-pending). roster-진입점은 composer +
// 기존 메서드 합성만(재구현 0) — 좌표 enumerate 가 caller-facing service 경계에서 처음
// 소비된다(T-0624 가 닫은 composer 의 미소비 공백을 본 메서드가 배선).
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
import {
  runSummaryBatchPipeline,
  type SummaryBatchPipelineResult,
} from "./domain/summary-batch-pipeline";
import { buildSummaryBatchOrchestratorInput } from "./domain/summary-batch-roster-input";
import type { SummaryBatchRosterInput } from "./domain/summary-batch-roster-input";
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
   * @throws composer / `enumerateSummaryDueCoordinates` / 하위 pipeline 조각 /
   *   주입된 orchestrator 가 던진 error 를 그대로 전파.
   */
  async evaluateBatchForRoster(
    roster: SummaryBatchRosterInput,
  ): Promise<SummaryBatchPipelineResult> {
    // roster → SummaryBatchOrchestratorInput 조립(좌표 enumerate 포함) 후 기존
    // 좌표-진입점에 위임한다 — composer + evaluateBatch 합성만(재구현 0). roster
    // null/undefined·필드 무결성·Invalid Date 의 fail-fast 는 composer/enumerate 가 전파.
    const input = buildSummaryBatchOrchestratorInput(roster);
    return this.evaluateBatch(input);
  }
}

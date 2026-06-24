---
id: T-0618
title: R-61 요약 평가 batch orchestrator service — @Injectable 로 runSummaryBatchPipeline 를 감싸 SummaryAggregateOrchestratorService.evaluateAndPersist 를 evaluator 로 bind (collection bridge deferred)
phase: P5
status: DONE
prNumber: 532
mergedAs: ad20e3d
reviewRounds: 1
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0617 순수 pipeline(PR #531 cbb00fc) 닫은 후 deferred orchestrator 실배선. @Injectable service 가 evaluateAndPersist 를 evaluator 로 bind. collection bridge·endpoint 는 Out of Scope."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
  - src/assessment-evaluation/assessment-evaluation.module.ts
---

# T-0618 — R-61 요약 평가 batch orchestrator service

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 순수 layer
가 end-to-end 로 완결됐다:

- T-0613 `enumerateSummaryDueCoordinates`(PR #527) — 좌표 enumerate.
- T-0614 `buildSummaryBatchPlan`(PR #528) — 좌표 × results map → plan tuple.
- T-0616 `runSummaryBatchPlan`(PR #530) — plan 순회 sequential await.
- T-0615 `summarizeSummaryBatchOutcome`(PR #529) — outcomes → 결정적 리포트.
- T-0617 `runSummaryBatchPipeline`(PR #531 cbb00fc) — 위 plan→run→outcome 을 한
  흐름으로 묶는 evaluator 주입형 순수 async pipeline.

T-0617 task 가 명시했듯, 순수 pipeline 이 닫히면 남는 잔여 경계는 두 가지뿐이다:
(a) **DI / `@Injectable` 박제**(이 순수 pipeline 을 service 경계로 감싸 실
`SummaryAggregateOrchestratorService.evaluateAndPersist` 를 evaluator 로 bind),
(b) `resultsByCoordinate` collection bridge(좌표 → collection → `Activity[]` →
단위 평가, cross-module/RBAC ADR 영역). 본 task 는 그중 **(a) 만** 닫는다 — (b)
collection bridge 는 여전히 Out of Scope(별도 ADR/slice).

본 task 는 `@Injectable` batch orchestrator service `SummaryBatchOrchestratorService`
를 신설한다. 이 service 는 `SummaryAggregateOrchestratorService`(기존 per-coordinate
orchestrator, 같은 module DI resolve)를 생성자 주입받아, 그 인스턴스의
`evaluateAndPersist(context, results, mode, options, now)` 메서드를 pipeline 의
`SummaryBatchEvaluator` 시그니처(`(entry, now) => Promise<SummaryAggregateResult>`)
로 **adapt**해 `runSummaryBatchPipeline` 에 주입한다. 즉 batch 전 좌표를 단일
호출로 평가·영속화·집계하는 service-경계 진입점이 생긴다.

핵심 adapt 책임: pipeline evaluator 는 plan 의 한 `entry`(= `{ context, results,
mode, options }`)와 `now` 를 받지만, 기존 per-coordinate orchestrator 는
`(context, results, mode, options, now)` 5-인자를 받는다. service 는 evaluator 를
`(entry, now) => this.aggregateOrchestrator.evaluateAndPersist(entry.context,
entry.results, entry.mode, entry.options, now)` 로 풀어 넘긴다 — entry 분해만
하고 재구현 0. service 자체는 순수 pipeline 의 결정성·실패 전파 계약을 그대로
상속하며(swallow 0), 부수효과(LLM 호출·DB write)는 전적으로 주입된
orchestrator → `SummaryPersistService` 책임으로 위임된다.

본 service 가 닫히면 caller(향후 controller / manual-trigger endpoint, Q-0030
RBAC ADR-gated)는 좌표 + results map + mode/options + now 만 넘기면 batch 요약
평가 전체를 단일 service 호출로 받는다 — pipeline index 정합·plan thread·실패
전파는 service 내부가 보장. realdata-e2e/evaluation-adjustments stream 과 파일
disjoint 라 fineGrainedConcurrency 동시 claim 후보(touchesFiles 교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` 전문 —
  `runSummaryBatchPipeline(input)` 의 정확한 시그니처: 입력 `SummaryBatchPipelineInput`
  (`coordinates` / `resultsByCoordinate` / `mode` / `options` / `evaluator` / `now`),
  반환 `SummaryBatchPipelineResult`(`plan` / `outcomes` / `report`). 본 service 가
  그대로 호출(재구현 0). **변경 금지** — import + 호출만.
- `src/assessment-evaluation/domain/summary-batch-run.ts` L44~53 —
  `SummaryBatchEvaluator` callback 타입(`(entry: SummaryBatchPlanEntry, now: Date)
  => Promise<SummaryAggregateResult>`). 본 service 가 이 타입으로 adapt 한 evaluator
  를 pipeline 에 넘긴다(새 타입 발명 0). **변경 금지** — type import 만.
- `src/assessment-evaluation/domain/summary-batch-plan.ts` L49~62 —
  `SummaryBatchPlanEntry` 형태(`context` / `results` / `mode` / `options`). evaluator
  adapt 시 entry 를 이 4 필드로 분해해 5-인자 orchestrator 에 전달. **변경 금지**
  — type import 만.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` 전문 —
  주입받을 `SummaryAggregateOrchestratorService` 와 `evaluateAndPersist(context,
  results, mode, options, now): Promise<SummaryAggregateResult>` 시그니처 + 반환
  타입 `SummaryAggregateResult`. 본 service 가 이 인스턴스 메서드를 evaluator 로
  bind. reject 전파·skip(evaluated=false) 계약 상속을 확인. **변경 금지** — DI 주입
  + 메서드 호출만.
- `src/assessment-evaluation/assessment-evaluation.module.ts` L73~99, L153~155 —
  기존 `providers`/`exports` 배열에 `SummaryAggregateOrchestratorService` /
  `SummaryPersistService` 가 이미 등록·DI resolve 됨을 확인. 본 task 는 새 service
  를 providers(+ 필요 시 exports)에 추가. 기존 provider 순서·다른 등록 변경 금지
  — append 만.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/summary-batch-orchestrator.service.ts` 신설 —
  `@Injectable` `SummaryBatchOrchestratorService` 박제. 생성자에서
  `SummaryAggregateOrchestratorService` 를 주입받는다(class provider DI). 공개
  메서드 1 개:
  ```ts
  async evaluateBatch(
    input: SummaryBatchOrchestratorInput,
  ): Promise<SummaryBatchPipelineResult>;
  ```
  입력은 단일 객체(인자 순서 혼동 차단, JSDoc single-source):
  ```ts
  export interface SummaryBatchOrchestratorInput {
    coordinates: SummaryDueCoordinate[];
    resultsByCoordinate: Map<string, EvaluationResult[]>;
    mode: PersistMode;
    options: SummaryPersistOptions;
    now: Date;
  }
  ```
  (입력에 `evaluator` 가 없는 점이 pipeline 입력과의 핵심 차이 — evaluator 는
  service 가 주입된 orchestrator 로 내부 합성. 반환은 pipeline 의
  `SummaryBatchPipelineResult` 를 그대로 re-export/재사용 — 새 타입 발명 0.)
- [ ] **evaluator adapt 계약 박제**(JSDoc + 코드):
  - service 가 `runSummaryBatchPipeline({ ...input, evaluator })` 를 호출하되,
    `evaluator` 를 `(entry, now) => this.aggregateOrchestrator.evaluateAndPersist(
    entry.context, entry.results, entry.mode, entry.options, now)` 로 합성(entry
    4 필드 분해 + 5-인자 전달, 재구현 0).
  - `input.now` 는 pipeline·evaluator 전체에 동일 instance 로 thread(같은 batch
    fire 동일 판정 기준 — T-0616/T-0617 계약 상속).
  - 반환 `{ plan, outcomes, report }` 3 산출을 그대로 노출(가공 0).
- [ ] **실패 전파 계약 상속**: 주입된 orchestrator 의 `evaluateAndPersist` 가
  reject/throw 하면(예: `persistSummary` reject, 알 수 없는 period TypeError,
  Invalid Date boundary TypeError) pipeline 이 그 error 를 전파하므로 본 service
  도 **그대로 전파**(swallow 0). 중간 reject 시 outcome 집계 미실행(부분 성공
  위장 0). 빈 입력(`coordinates` 빈 배열) → 빈 plan/outcomes + report 전 카운트
  0 + orchestrator 호출 0(throw 0).
- [ ] `@Injectable` 1 개(생성자 DI 1 개) — 새 외부 dependency 0, 새 Prisma model
  0, 새 migration 0. service 자체는 LLM 호출·DB write 를 **직접** 하지 않는다
  (전적으로 주입된 orchestrator → SummaryPersistService 위임). 입력
  `coordinates`/`resultsByCoordinate`/`now` 비변형(pipeline 비변형 계약 상속).
  raw 미저장(R-59) — service 는 산출을 변형 없이 묶기만 한다.
- [ ] `src/assessment-evaluation/assessment-evaluation.module.ts` 의 `providers`
  배열에 `SummaryBatchOrchestratorService` append(+ caller 가 다른 module 에서
  쓸 가능성 고려 시 `exports` 에도 append — 단 본 task 는 같은 module 내 controller
  가 미정이므로 providers 만 필수, exports 는 선택). 기존 provider/export 순서·내용
  변경 금지(append only). DI 가 `SummaryAggregateOrchestratorService` 를 resolve 해
  생성자 주입됨을 module compile test 로 확인.
- [ ] **Happy-path test 1+**: mock `SummaryAggregateOrchestratorService`
  (`{ evaluateAndPersist: jest.fn() }`)를 주입한 service 인스턴스에 coordinates
  3개(day/week/month) + 각 좌표 results 2건 map + mode/options/now 를 넘겨
  `evaluateBatch` 호출 → 반환 `{ plan, outcomes, report }` 가 (a) plan 길이 3·좌표
  순서 보존, (b) report.total=3 + evaluated/skipped/created/existing 이 mock 결과와
  정합, (c) `evaluateAndPersist` 호출 횟수 === plan.length, (d) 각 호출 인자가
  `(entry.context, entry.results, entry.mode, entry.options, now)` 로 정확히 분해
  전달됨(특히 5번째 인자가 입력 now 와 동일 instance) 검증.
- [ ] **Error path test 1+**: 주입된 orchestrator 의 `evaluateAndPersist` 가 중간
  index 에서 reject → 그 error 전파 + 이후 호출 0 + outcome 집계 미실행(report
  미반환) 1+. 동기적으로 throw 하는 orchestrator → 그 error 전파 1+. 좌표 원소가
  personId/periodStart 누락 → pipeline 하위 조각의 TypeError 전파 1+.
- [ ] **Flow / branch 분기 cover**: (a) coordinates 빈 배열 → 빈 plan/outcomes +
  report 전 카운트 0 + `evaluateAndPersist` 호출 0, (b) orchestrator 전건
  `{ evaluated: true, result }` → report.evaluated=total·skipped=0, (c) 전건
  `{ evaluated: false }`(skip) → report.skipped=total·evaluated=0, 각 분기 1+ test
  분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) results map 비어 있음(좌표는 있으나 map 부재) → 각 entry 빈 results 부착 →
    orchestrator 가 빈 results 로 호출됨 1+ test,
  (2) 입력 `coordinates` 배열·`resultsByCoordinate` map·`now` 호출 후 비변형
    (length·원소 reference·`now.getTime()` 동일) 1+ test,
  (3) orchestrator 가 동기적으로 throw → 그 error 전파 + outcome 미실행 1+ test,
  (4) 좌표 중복(같은 person/period/periodStart 2회) → plan 2 entry·orchestrator
    2 호출·report.total 2 반영(de-dup 책임 본 service 밖) 1+ test,
  (5) `evaluateBatch` 가 새 evaluator 를 매 호출 합성함 — 같은 service 인스턴스로
    2 회 호출 시 두 호출이 서로 독립(이전 호출 잔여 상태 누수 0) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. `SummaryAggregateOrchestratorService`
  는 `{ evaluateAndPersist: jest.fn() }` mock 주입(`Test.createTestingModule` 또는
  직접 `new SummaryBatchOrchestratorService(mock)`), `SummaryDueCoordinate`/
  `EvaluationResult`/`SummaryPersistOptions` 는 최소 stub(형태만 충족), periodStart
  고정 Date instance 주입으로 결정성 확보. 실 LLM/DB/SummaryPersistService 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 service 는 thin adapt layer 라 100% 달성 목표.

## Out of Scope

- **controller / HTTP endpoint / DTO 추가 금지** — manual-trigger 요약 batch 평가
  endpoint(route/RBAC/request·response shape) 배선은 별도 후속 slice(새 RBAC 결정
  = Q-0030 ADR-gated). 본 task 는 service layer compose 까지(controller 가 본
  service 호출 대상이 되나 controller 배선은 별도).
- **좌표 → `EvaluationResult[]` 도출(collection bridge) 금지** — `resultsByCoordinate`
  map 을 채우는 경로(좌표 → collection → `Activity[]` → 단위 평가)는 cross-module/
  RBAC ADR 영역. 본 service 는 caller 가 results map 을 이미 넘긴다고 전제(pipeline
  과 동형).
- **좌표 enumerate(T-0613) 를 service 안에 흡수 금지** — `enumerateSummaryDueCoordinates`
  호출을 본 service 안에 넣지 않는다. coordinates 는 caller 가 미리 enumerate 해
  넘기는 입력(roster/granularity source 도출이 caller 책임). 본 service 는
  pipeline 호출 + evaluator 합성만.
- **scheduler 자동 trigger 금지** — `@nestjs/schedule` cron 으로 batch 를 주기
  발화하는 경로는 P7(새 dep). 본 service 는 caller 가 호출하는 수동 진입점.
- **`runSummaryBatchPipeline` / `summary-batch-*.ts` / `SummaryAggregateOrchestratorService`
  / `SummaryPersistService` 변경 금지** — import + 호출 + 패턴 mirror 만(하위 조각
  재구현·시그니처 변경 0).
- **`Promise.all` / 병렬 실행 금지** — pipeline → run 의 순차 await 계약 상속(병렬은
  별도 ADR). service 가 병렬화를 발명하지 않는다.
- **mode / options / now 결정 로직 금지** — `PersistMode` 선택·narrative `modelId`
  결정·`now` 산출은 caller 책임. service 는 caller 가 넘긴 값을 pipeline 에 그대로
  전달만.
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — Admin/User 가 요약 평가를 trigger 하는 controller 경계. 본 service 를 호출 대상
  으로.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — 좌표 →
  AssessmentCollectionModule(collectForPerson) → `Activity[]` → 단위 평가 →
  `resultsByCoordinate` map 채움. 본 service 입력의 results map 을 자동 도출.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).
- 진척 콜백 / AbortController cancel signal — pipeline + service surface 확장 후속.

---
id: T-0617
title: R-61 요약 평가 batch end-to-end 순수 pipeline composer — coordinates + results map + evaluator → buildSummaryBatchPlan → runSummaryBatchPlan → summarizeSummaryBatchOutcome 한 흐름 조립(orchestrator 실배선 deferred)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0614(plan)/T-0616(run)/T-0615(outcome) 3 순수 조각을 한 흐름으로 묶는 end-to-end 순수 async pipeline. evaluator 주입형(@Injectable 0·collection bridge 0). orchestrator 실배선은 deferred."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-pipeline.ts
  - src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts
---

# T-0617 — R-61 요약 평가 batch end-to-end 순수 pipeline composer

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 4 순수
조각이 모두 닫혔다:

- T-0613 `enumerateSummaryDueCoordinates`(PR #527 be77f86) — 좌표 enumerate.
- T-0614 `buildSummaryBatchPlan`(PR #528 2926747) — 좌표 × results map → plan tuple.
- T-0616 `runSummaryBatchPlan`(PR #530 squash 4f0343a) — plan 순회 sequential await.
- T-0615 `summarizeSummaryBatchOutcome`(PR #529 3c7ca4f) — outcomes → 결정적 리포트.

그러나 이 3 caller-facing 조각(plan → run → outcome)을 caller 가 매번 직접
손으로 엮어야 한다: `buildSummaryBatchPlan(...)` 으로 plan 을 만들고, 그 plan 을
`runSummaryBatchPlan(plan, evaluator, now)` 에 넘겨 outcomes 를 받고, 다시
`summarizeSummaryBatchOutcome(plan, outcomes)` 에 plan 과 outcomes 를 함께 넘겨야
한다 — 특히 **마지막 단계가 plan 과 outcomes 를 *둘 다* 같은 index 정합으로
받아야** 하므로(T-0615 길이 정합 fail-fast 계약), caller 가 plan 을 잃지 않고
끝까지 들고 가야 하는 미묘한 정합 책임이 caller 에 흩어져 있다.

본 task 는 그 3 단계 엮음을 **evaluator callback 을 주입받는 단일 순수 async
pipeline** `runSummaryBatchPipeline(input)` 로 외화한다. caller 는 좌표 +
results map + mode/options + evaluator + now 만 넘기면 plan/outcomes/report 를
한 번에 결정적으로 받는다 — plan↔outcomes index 정합은 pipeline 내부가 단일
plan 인스턴스로 보장하므로 caller 의 정합 누수가 원천 차단된다. helper 자체는
**부수효과 0**(외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 /
repository 0 / DB write 0) — 부수효과는 전적으로 주입된 evaluator 책임이고
pipeline 은 3 순수 조각의 결정적 조합 + 동일 plan/now thread 만 한다.

이 pipeline 이 외화되면 **batch orchestrator 의 핵심 흐름이 mock evaluator 1 개
로 end-to-end 단위 검증**된다(실 LLM/DB/service mock 0). orchestrator wiring 진입
시 남는 잔여 경계는 (a) DI / `@Injectable` 박제 (b) `resultsByCoordinate`
collection bridge 두 가지뿐(cross-module/RBAC ADR 영역, 본 task 밖) — 즉 본
task 가 닫히면 p5-summary-aggregate 의 **순수 layer 가 end-to-end 로 완결**되고,
이후는 순수하지 않은 DI/collection 경계만 남는다. T-0613~T-0616 이 확립한 순수
도메인 함수 패턴(부수효과 0 / `@Injectable` 0 / Prisma 0 / 결정적 출력 /
fail-fast 한국어 TypeError / 한국어 JSDoc)을 그대로 mirror 한다. realdata-e2e
스택과 파일 disjoint 라 fineGrainedConcurrency 동시 claim 후보(touchesFiles
교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-plan.ts` 전문 — pipeline 의 1
  단계 `buildSummaryBatchPlan(coordinates, resultsByCoordinate, mode, options)` 의
  정확한 시그니처·반환 타입 `SummaryBatchPlanEntry[]`·입력 타입(`SummaryDueCoordinate[]`
  / `Map<string, EvaluationResult[]>` / `PersistMode` / `SummaryPersistOptions`).
  본 pipeline 이 그대로 호출(재구현 0). **변경 금지** — import + 호출만.
- `src/assessment-evaluation/domain/summary-batch-run.ts` 전문 — pipeline 의 2
  단계 `runSummaryBatchPlan(plan, evaluator, now)` 와 `SummaryBatchEvaluator`
  callback 타입(`(entry, now) => Promise<SummaryAggregateResult>`). 본 pipeline 의
  evaluator 인자는 이 타입을 그대로 re-export/재사용한다(새 타입 발명 0). reject
  전파 계약(swallow 0)도 그대로 상속됨을 확인. **변경 금지** — import + 호출만.
- `src/assessment-evaluation/domain/summary-batch-outcome.ts` 전문 — pipeline 의
  3 단계 `summarizeSummaryBatchOutcome(plan, outcomes)` 와 반환 타입
  `SummaryBatchOutcomeReport`. 본 단계가 **plan 과 outcomes 를 *둘 다*** 받아야
  함(길이 정합 fail-fast)을 확인 — pipeline 이 단일 plan 인스턴스를 1·2·3 단계에
  관통 thread 함을 보장하는 근거. **변경 금지** — import + 호출만.
- `src/assessment-evaluation/domain/summary-due-coordinates.ts` L30~40 —
  `SummaryDueCoordinate` 입력 타입 형태 확인(pipeline 입력 surface). **변경 금지**
  — type import 만.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` L55~66 —
  `SummaryAggregateResult` 타입(outcomes 원소). pipeline 반환에 outcomes 를 함께
  노출할 때의 타입. **변경 금지** — type import 만.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-pipeline.ts` 신설 — 순수
  async pipeline `runSummaryBatchPipeline(input)` 박제. 입력은 단일 객체로 묶어
  인자 순서 혼동을 차단한다(JSDoc 으로 single-source):
  ```ts
  export interface SummaryBatchPipelineInput {
    coordinates: SummaryDueCoordinate[];
    resultsByCoordinate: Map<string, EvaluationResult[]>;
    mode: PersistMode;
    options: SummaryPersistOptions;
    evaluator: SummaryBatchEvaluator;
    now: Date;
  }
  export interface SummaryBatchPipelineResult {
    plan: SummaryBatchPlanEntry[];
    outcomes: SummaryAggregateResult[];
    report: SummaryBatchOutcomeReport;
  }
  export async function runSummaryBatchPipeline(
    input: SummaryBatchPipelineInput,
  ): Promise<SummaryBatchPipelineResult>;
  ```
- [ ] **3 단계 조립 계약 박제**(JSDoc + 코드):
  - (1) `plan = buildSummaryBatchPlan(coordinates, resultsByCoordinate, mode,
    options)` — 좌표 × results map join.
  - (2) `outcomes = await runSummaryBatchPlan(plan, evaluator, now)` — **(1) 의
    동일 plan 인스턴스**를 2 단계에 thread(plan 재생성·재정렬 0).
  - (3) `report = summarizeSummaryBatchOutcome(plan, outcomes)` — **(1)·(2) 와
    동일 plan 인스턴스 + (2) 의 outcomes** 를 함께 넘긴다 — index 1:1 정합이
    pipeline 내부에서 단일 plan 으로 구조적으로 보장됨(caller 정합 누수 차단).
  - 반환 `{ plan, outcomes, report }` 3 산출을 모두 노출 — caller 가 report 만
    아니라 plan/outcomes 까지 필요로 할 수 있으므로(예: 재시도 / 진척 로깅).
  - `now` 는 pipeline 전체에서 동일 instance 를 (2) 단계 evaluator 에 전달(같은
    batch fire 동일 판정 기준 — T-0616 계약 상속).
- [ ] **실패 전파 계약 상속**: (2) `runSummaryBatchPlan` 이 evaluator reject/throw
  를 전파하면 본 pipeline 도 그 error 를 **그대로 전파**(swallow 0, T-0616 /
  ADR-0032 §2 mirror). 중간 reject 시 (3) outcome 집계는 실행되지 않는다(부분
  성공 리포트 위장 0). (1) `buildSummaryBatchPlan` 의 좌표 무결성 TypeError 도
  그대로 전파(좌표 단계에서 fail-fast).
- [ ] **fail-fast 입력 검증**(한국어 `TypeError`, T-0614/T-0615/T-0616 관례
  mirror) — 모든 가드는 (1) 단계 진입 **전**에 평가:
  - `input` 이 null/undefined → 한국어 `TypeError`.
  - `input.coordinates` / `input.resultsByCoordinate` / `input.evaluator` /
    `input.now` 의 null/undefined·타입 불일치는 **하위 조각(buildSummaryBatchPlan
    / runSummaryBatchPlan)의 기존 가드에 위임**해도 무방(이중 검증 발명 0) —
    단 그 위임을 JSDoc 으로 명시하고, 위임된 TypeError 가 pipeline 밖으로 그대로
    전파됨을 1+ test 로 박제. `input` 자체의 null/undefined 만 pipeline 이 직접 가드.
- [ ] `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / DB write 0 / 새
  외부 dependency 0. 입력 `coordinates` 배열·`resultsByCoordinate` map·원소·`now`
  비변형(pipeline 이 mutate 0 — 하위 조각의 비변형 계약 상속). 동일 입력(같은
  coordinates/map/mode/options + 같은 결정적 evaluator + 같은 now) → 동일 출력
  (깊은 값 동일성, evaluator 결정성 전제). raw 미저장(R-59) — pipeline 은 하위
  조각 산출을 변형 없이 묶기만 한다.
- [ ] **Happy-path test 1+**: coordinates 3개(day/week/month) + 각 좌표 results
  2건 담긴 map + mock evaluator(plan entry 의 period 에 따라 결정적
  `{ evaluated, result? }` 반환) → 반환 `{ plan, outcomes, report }` 가 (a) plan
  길이 3·좌표 순서 보존, (b) outcomes 길이 3·plan index 1:1, (c) report.total=3
  + evaluated/skipped/created/existing 카운트가 mock evaluator 결과와 정확히 정합
  + byGranularity 분포 정확. evaluator 호출 횟수 === plan.length 검증.
- [ ] **Error path test 1+**: `input` 이 null/undefined → fail-fast 한국어
  `TypeError`(1+). evaluator 가 (2) 단계 중간 index 에서 reject → 그 error 전파 +
  (3) outcome 집계 미실행(report 미반환) + 이후 evaluator 호출 0 1+. 좌표 원소가
  personId/periodStart 누락 → (1) `buildSummaryBatchPlan` 의 TypeError 전파 1+.
- [ ] **Flow / branch 분기 cover**: (a) coordinates 빈 배열 → plan/outcomes 빈
  배열 + report 전 카운트 0 + evaluator 호출 0(throw 0), (b) evaluator 전건
  evaluated=true → report.evaluated=total·skipped=0, (c) evaluator 전건
  evaluated=false → report.skipped=total·evaluated=0, (d) evaluator 중간 reject →
  error 전파 + (3) 미실행, 각 분기 1+ test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) results map 비어 있음(좌표는 있으나 map 부재) → plan 의 각 entry 가 빈
    results 부착(T-0614 계약 상속) → evaluator 가 빈 results 로 호출됨 1+ test,
  (2) 입력 `coordinates` 배열·`resultsByCoordinate` map·`now` 호출 후 비변형
    (length·원소 reference·`now.getTime()` 동일) 1+ test,
  (3) 같은 plan 인스턴스가 (1)→(2)→(3) 에 thread 됨 — (3) `summarizeSummaryBatchOutcome`
    가 plan↔outcomes 길이 정합 TypeError 를 던지지 않음을 보장(내부 단일 plan 으로
    구조적 정합) — spy/모킹으로 (3) 에 넘어간 plan 이 (2) 에 넘어간 plan 과 동일
    reference 임을 검증 1+ test,
  (4) evaluator 가 동기적으로 throw → 그 error 전파 + (3) 미실행 1+ test,
  (5) 좌표 중복(같은 person/period/periodStart 2회) → plan 도 2 entry·evaluator
    2 호출·report.total 에 2 반영(de-dup 책임 본 pipeline 밖, T-0613/T-0614 경계
    동형) 1+ test.
- [ ] **결정성 invariant**: 같은 input(같은 결정적 evaluator + 같은 now)로 2 회
  호출 → 두 결과의 plan/outcomes/report 값이 깊은 동일성(매 호출 새 객체 반환,
  reference 동일성은 아님) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts`
  신설 — 위 happy/error/branch/negative/결정성 케이스 박제. `SummaryDueCoordinate`
  /`EvaluationResult`/`SummaryPersistOptions` 는 최소 stub(형태만 충족), periodStart
  는 고정 Date instance 주입으로 결정성 확보, evaluator 는 jest mock(또는 spy 부착
  async 함수). 실 LLM/DB/service 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 pipeline 은 순수 함수라 100% 달성 목표.

## Out of Scope

- **orchestrator / service / controller 실배선 금지** — `@Injectable` 박제 +
  DI 로 `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 bind 해 본
  pipeline 의 evaluator 로 주입하는 batch orchestrator service 는 별도 follow-up
  slice(service-경계, `@Injectable` + DI). 본 task 는 evaluator 주입형 순수
  pipeline 까지.
- **좌표 enumerate(T-0613) 를 pipeline 안에 흡수 금지** — `enumerateSummaryDueCoordinates`
  호출을 본 pipeline 안에 넣지 않는다. coordinates 는 caller 가 미리 enumerate 해
  넘기는 입력(roster/granularity source 도출이 caller/orchestrator 책임이라 좌표
  생성을 pipeline 에 묶으면 책임 경계가 흐려짐). 본 pipeline 은 plan→run→outcome
  3 단계 조립만.
- **좌표 → `EvaluationResult[]` 도출(collection bridge) 금지** — `resultsByCoordinate`
  map 을 채우는 경로(좌표 → collection → `Activity[]` → 단위 평가)는 cross-module/
  RBAC ADR 영역. 본 pipeline 은 caller 가 results map 을 이미 안다고 전제(T-0614 와
  동형).
- **로깅 / 진척 콜백 / cancel signal 금지** — 본 pipeline 은 3 순수 조각의 결정적
  조합만. per-entry 진척 알림·`AbortController` cancel 은 T-0616 Follow-up 의 별도
  task(본 pipeline 의 surface 확장 후속).
- **`Promise.all` / 병렬 실행 금지** — (2) `runSummaryBatchPlan` 의 순차 await
  계약을 그대로 상속(병렬은 별도 ADR 후속). pipeline 이 병렬화를 발명하지 않는다.
- **mode / options 결정 로직 금지** — `PersistMode` 선택·narrative `modelId` 결정은
  caller 책임. 본 pipeline 은 caller 가 넘긴 mode/options 를 (1) 단계에 그대로 전달만.
- **`summary-batch-plan.ts` / `summary-batch-run.ts` / `summary-batch-outcome.ts` /
  `summary-due-coordinates.ts` / `summary-aggregate-orchestrator.service.ts` 변경
  금지** — import + 호출 + 패턴 mirror 만(하위 조각 재구현·시그니처 변경 0).
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — 요약 batch 평가 endpoint
  배선은 Q-0030 ADR-gated(새 RBAC 결정). 본 task 는 새 endpoint·DTO·controller
  변경 0.
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: batch summary orchestrator(`@Injectable` + DI + async) — 본
  pipeline 을 service-경계로 감싸 `SummaryAggregateOrchestratorService.evaluateAndPersist`
  를 evaluator 로 bind 하고, coordinates 는 `enumerateSummaryDueCoordinates`(T-0613)
  산출을 받는다. 단 `resultsByCoordinate` map 을 채우는 좌표→`EvaluationResult[]`
  collection bridge 는 cross-module(별도 ADR/slice).
- manual-trigger 요약 batch 평가 endpoint(Q-0030 RBAC ADR-first) — Admin/User 가
  요약 평가를 trigger 하는 HTTP 경계.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).
- 진척 콜백 / AbortController cancel signal — 본 pipeline + runSummaryBatchPlan 의
  surface 확장 후속(별도 task).

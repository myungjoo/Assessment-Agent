---
id: T-0616
title: R-61 요약 평가 batch plan 순회 순수 async 실행 helper — plan + evaluator callback → outcomes[] index 1:1 zip (orchestrator 실배선 deferred)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0614 plan + T-0615 outcome composer 사이 빈 async loop 조각. evaluator callback 주입형 순수 async helper(@Injectable 0·Prisma 0·LLM 0). orchestrator 실배선·collection bridge 는 deferred."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-run.ts
  - src/assessment-evaluation/domain/summary-batch-run.spec.ts
---

# T-0616 — R-61 요약 평가 batch plan 순회 순수 async 실행 helper

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. T-0613(`enumerateSummaryDueCoordinates`,
PR #527 squash be77f86) → T-0614(`buildSummaryBatchPlan`, PR #528 squash 2926747)
→ T-0615(`summarizeSummaryBatchOutcome`, PR #529 squash 3c7ca4f) 로 **pre-실행
plan 조립** + **post-실행 outcome 집계** 두 끝이 모두 닫혔다. 그러나 그 둘
사이의 **plan 순회 실행 layer**(plan 의 각 entry 에 대해 `evaluateAndPersist`
계열 함수를 순차 await 한 뒤 결과를 plan 과 같은 순서의 `outcomes[]` 로
모으는 부분)가 여전히 inline 으로만 존재할 수 있고, 순수 단위 검증 가능한
형태로 외화되지 않았다. T-0615 Follow-up #1 의 "batch orchestrator
(`enumerate → buildSummaryBatchPlan → 순회 await evaluateAndPersist →
summarizeSummaryBatchOutcome`)" 중 **순회 await 부분**의 순수 半부다.

본 task 는 그 빈 자리를 **evaluator callback 을 주입받는 순수 async helper**
`runSummaryBatchPlan(plan, evaluator, now)` 로 채운다. evaluator 는
`(entry: SummaryBatchPlanEntry, now: Date) => Promise<SummaryAggregateResult>`
shape 의 callback — caller(향후 orchestrator)가
`SummaryAggregateOrchestratorService.evaluateAndPersist` 를 bound 메서드로
전달하거나, test 가 mock callback 을 전달한다. helper 자체는 **자기 부수효과
0**(외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / DB
write 0 / 입력 배열·원소 비변형) — 부수효과는 전적으로 evaluator 책임이고
helper 는 plan 등장 순서 보존 sequential await 결과 수집만 한다.

이 helper 가 외화되면 **batch orchestrator 의 async loop 가 mock callback
1 개로 단위 검증**된다(실 LLM/DB/service mock 0). 또한 T-0615 outcome
composer 의 입력 `SummaryAggregateResult[]` 가 본 helper 의 출력과 1:1
정합하므로, helper 출력을 outcome composer 에 그대로 spread 해 batch report
end-to-end pure pipeline 이 닫힌다 — orchestrator wiring 진입 시 남는 잔여
경계는 (a) DI / `@Injectable` 박제 (b) `resultsByCoordinate` collection
bridge 두 가지뿐(cross-module/RBAC ADR 영역, 본 task 밖). realdata-e2e
스택과 파일 disjoint 라 fineGrainedConcurrency 동시 claim 후보(touchesFiles
교집합 0). 본 task 는 순수 도메인 함수 패턴(부수효과 0 / `@Injectable` 0 /
Prisma 0 / 결정적 출력 / fail-fast 한국어 TypeError)을 그대로 mirror 한다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-plan.ts` 전문 — 본 helper
  입력 원소 타입 `SummaryBatchPlanEntry`(`{ context, results, mode, options }`)
  의 single source. **변경 금지** — type import 만.
- `src/assessment-evaluation/domain/summary-batch-outcome.ts` 전문 — 본 helper
  출력 원소 타입 `SummaryAggregateResult` 가 T-0615 outcome composer 의 두
  번째 인자 surface 와 1:1 정합함을 확인. **변경 금지** — 입력 타입 정합 확인만
  (의존 import 0).
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` L55~66
  + L104~125 — evaluator callback 의 reference 시그니처. 본 helper 의
  callback 타입은 `(entry, now) => Promise<SummaryAggregateResult>` 로 좁혀
  caller 가 `evaluateAndPersist` 를 partial application 으로 bind 한다. 본
  service 의 `SummaryAggregateResult` 타입을 import 재사용. **변경 금지** —
  type import + 시그니처 mirror.
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` L22~33 —
  `SummaryBatchContext` 의 필드 shape 확인(plan entry 안에 등장). **변경 금지**
  — read 만.
- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts`
  헤더(L1~25) — 순수 도메인 helper 의 책임/경계 박제 관례 mirror(부수효과 0 /
  Out of Scope 명시 / 한국어 JSDoc). **변경 금지** — 패턴 참조만(import 0).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-run.ts` 신설 — 순수 async
  helper `runSummaryBatchPlan(plan, evaluator, now)` 박제. 시그니처:
  ```ts
  type SummaryBatchEvaluator = (
    entry: SummaryBatchPlanEntry,
    now: Date,
  ) => Promise<SummaryAggregateResult>;

  export async function runSummaryBatchPlan(
    plan: SummaryBatchPlanEntry[],
    evaluator: SummaryBatchEvaluator,
    now: Date,
  ): Promise<SummaryAggregateResult[]>;
  ```
- [ ] **순회 순서·정합 계약 박제** (JSDoc + 코드):
  - plan 등장 순서 그대로 sequential await(`for...of` 또는 index loop, `Promise.all`
    **금지** — `evaluateAndPersist` 가 DB write 를 동반할 수 있어 결정적
    write 순서/충돌 격리를 위해 순차 실행).
  - 반환 `outcomes[]` 는 plan 과 정확히 동일 길이(index 1:1) — caller 가
    `summarizeSummaryBatchOutcome(plan, outcomes)` 에 그대로 spread 할 수 있다.
  - `evaluator` 가 reject 하면 그 error 를 **전파**(swallow 0 — 실패 격리,
    `summary-aggregate-orchestrator.service.ts` L22~26 / ADR-0032 §2 mirror).
    중간 reject 시 이미 collect 한 outcome 은 버려진다(부분 성공 결과 미반환).
  - `now` 는 helper 가 그대로 evaluator 에 전달(loop 동안 동일 `now` 사용 —
    "한 batch fire 의 모든 좌표는 같은 판정 기준"을 보장, evaluator 가 내부에서
    재계산 0).
- [ ] **fail-fast 입력 검증** (한국어 `TypeError`, period-select/T-0614/T-0615
  관례 mirror):
  - `plan` 이 null/undefined → 한국어 `TypeError`.
  - `evaluator` 가 `null`/`undefined`/typeof !== `"function"` → 한국어 `TypeError`.
  - `now` 가 `Date` instance 가 아니면 → 한국어 `TypeError`.
  - 위 가드는 모두 sequential await 진입 **전**에 평가(첫 reject 시 evaluator
    호출 0 으로 검증).
- [ ] `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / DB write 0 /
  새 외부 dependency 0. 입력 `plan` 배열·원소 비변형(helper 가 plan 을 mutate
  하지 않는다 — push/splice/sort 0). 동일 입력(같은 plan + 같은 결정적
  evaluator + 같은 now)은 항상 동일 출력 배열(reference 동일성은 아니라 깊은
  값 동일성, evaluator 결정성 전제). raw 미저장(R-59) — helper 자체는 evaluator
  반환값을 변형 없이 push 만 한다.
- [ ] **Happy-path test 1+**: plan 3 개(day/week/month 1 개씩) + mock evaluator
  가 plan entry 의 `context.period` 에 따라 결정적으로 `{evaluated, result?}`
  반환 → 반환 outcomes 가 plan 과 길이·순서 1:1 정합 + evaluator 호출 횟수
  === plan.length + 각 호출의 인자가 `(plan[i], now)` 와 정확히 일치.
- [ ] **Error path test 1+**: `plan` 또는 `evaluator` 또는 `now` 가
  null/undefined → fail-fast 한국어 `TypeError`(각 1+). `evaluator` 가 함수가
  아닌 값(`{}`, `0`, `"x"`) → 한국어 `TypeError` 1+.
- [ ] **Flow / branch 분기 cover**: (a) plan 빈 배열 + 어떤 evaluator → 빈
  outcomes 반환 + evaluator 호출 0(throw 0), (b) evaluator 가 모두 evaluated=true
  반환 → outcomes 전부 evaluated=true, (c) evaluator 가 모두 evaluated=false
  반환 → outcomes 전부 evaluated=false, (d) evaluator 가 중간(index N)에서
  reject → error 전파 + outcomes 미반환 + 이후 evaluator 호출 0(sequential
  중단 검증), 각 분기 1+ test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) evaluator 가 동기적으로 throw(`Promise.reject` 가 아닌 `throw`) → 그
    error 전파 + 이후 evaluator 호출 0 1+ test,
  (2) plan 배열 비변형 invariant — 호출 후 plan 의 length / 각 원소 reference
    가 호출 전과 동일(mutation 0) 1+ test,
  (3) `now` 가 helper 안에서 mutate 되지 않음 — 호출 후 `now.getTime()` 동일
    1+ test (helper 가 setMonth/setDate 등 mutate 0),
  (4) evaluator 가 plan 과 다른 길이의 결과를 반환할 수 없음(시그니처상 1 entry
    → 1 result)을 type 으로 보장 — runtime 검증 불필요하나, helper 가 한 entry
    당 정확히 1 번만 evaluator 를 호출함을 spy count 로 검증 1+ test,
  (5) evaluator 가 같은 plan entry 두 번 호출되지 않음(중복 호출 0) — spy 의
    호출 인자 sequence 가 plan 과 1:1 일치 1+ test.
- [ ] **결정성 / 비변형 invariant**: 같은 plan + 같은 결정적 evaluator + 같은
  `now` 로 2 회 호출 → 두 outcomes 배열의 값이 깊은 동일성 1+ test (reference
  동일성은 아님 — 새 배열 반환).
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-run.spec.ts`
  신설 — 위 happy/error/branch/negative/결정성 케이스 박제.
  `SummaryBatchPlanEntry` 는 최소 stub(`context`/`results`/`mode`/`options`
  필드 형태만 충족, periodStart 는 고정 Date instance), evaluator 는 jest mock
  함수(또는 spy 가 부착된 async function). 실 LLM/DB/service 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 helper 는 순수 함수라 100% 달성 목표.

## Out of Scope

- **orchestrator / service / controller 실배선 금지** — `@Injectable` 박제 +
  DI 로 `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 bind 해
  본 helper 의 evaluator 로 주입하는 batch orchestrator service 는 별도
  follow-up slice(service-경계, `@Injectable` + DI). 본 task 는 evaluator
  주입 surface 만 박제.
- **좌표 → `EvaluationResult[]` 도출(collection bridge) 금지** — cross-module/
  RBAC ADR 영역. 본 helper 의 입력 plan 은 caller 가 results 부착 완료된
  것으로 전제(T-0614 와 동형).
- **로깅 / 진척 콜백 / cancel signal 금지** — 본 helper 는 순수 await loop 만.
  로깅(per-entry 진척 알림)·`AbortController` 기반 cancel 은 향후 별도 task.
- **`Promise.all` / 병렬 실행 금지** — `evaluateAndPersist` 가 DB write 를
  동반할 수 있어 결정적 write 순서·충돌 격리를 위해 순차 await 만. 병렬
  실행은 별도 ADR 후속.
- **`summary-batch-plan.ts` / `summary-batch-outcome.ts` /
  `summary-aggregate-orchestrator.service.ts` / `summary-persist.service.ts` /
  `summary-batch-prompt.ts` 변경 금지** — type import + 패턴 mirror 만.
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — 요약 batch 평가
  endpoint 배선은 Q-0030 ADR-gated(새 RBAC 결정).
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: batch summary orchestrator(`@Injectable` + DI + async) —
  `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 본 helper 의
  evaluator 로 bind 해 `enumerate(T-0613) → buildSummaryBatchPlan(T-0614) →
  runSummaryBatchPlan(본 task) → summarizeSummaryBatchOutcome(T-0615)` 4 단계
  pure pipeline 을 service-경계로 묶음. 단 `resultsByCoordinate` map 을 채우는
  좌표→`EvaluationResult[]` collection bridge 는 cross-module(별도 ADR/slice).
- manual-trigger 요약 batch 평가 endpoint(Q-0030 RBAC ADR-first) — Admin/User
  가 요약 평가를 trigger 하는 HTTP 경계.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).
- 진척 콜백 / AbortController cancel signal — 본 helper 의 surface 확장 후속
  (별도 task, 본 task 의 단순 await loop 검증 후).

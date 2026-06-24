---
id: T-0615
title: R-61 요약 평가 batch outcome 집계 순수 composer — plan × evaluateAndPersist 결과 zip → 결정적 batch 리포트(평가/skip/created/existing + granularity별 분포)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0614 batch plan 의 다음 순수 slice. plan × evaluateAndPersist 결과(SummaryAggregateResult[]) zip → 결정적 batch outcome 리포트. orchestrator 실배선(async @Injectable)은 후속"
independentStream: p5-summary-aggregate
dependsOn: [T-0614]
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-outcome.ts
  - src/assessment-evaluation/domain/summary-batch-outcome.spec.ts
---

# T-0615 — R-61 요약 평가 batch outcome 집계 순수 composer

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. T-0613(`enumerateSummaryDueCoordinates`)
→ T-0614(`buildSummaryBatchPlan`, PR #528 squash 2926747) 으로 "좌표 enumerate →
좌표 × results map join → `evaluateAndPersist` 인자 tuple `SummaryBatchPlanEntry[]`"
까지의 **pre-실행** layer 가 닫혔다. 그러나 caller(batch orchestrator)가 그 plan 을
순회하며 `evaluateAndPersist` 를 좌표별로 호출한 **뒤** 받는 결과들
(`SummaryAggregateResult[]` = `{ evaluated, result?: { summaryId, created } }`)을
"몇 좌표가 평가됐고 / 시점 미도래로 skip 됐고 / 새로 생성됐고 / 이미 존재했는지" 를
한 결정적 리포트로 집계하는 **post-실행** 조각이 비어 있다.

T-0614 의 Follow-up #1("enumerate → buildSummaryBatchPlan → 순회 evaluateAndPersist
→ **결과 집계**")의 "결과 집계" 半부다. 이 집계를 순수 함수로 외화하면 batch
orchestrator 배선 시 async service mock 없이 "어떤 plan 좌표가 어떤 outcome 으로
귀결되고, granularity(day/week/month)별 분포가 어떻게 되는가" 를 단위 검증할 수
있다. realdata-e2e 측 `buildRealDataResultSummary`(T-0580)가 평가 결과를 결정적
분포 리포트로 집계한 것과 동형 — 본 task 는 그 요약-평가 batch 판이다.

좌표 → `EvaluationResult[]` 도출(collection bridge)·orchestrator 실배선(async
`@Injectable` 순회 호출)은 여전히 cross-module/RBAC ADR 또는 service-경계 영역이라
deferred. 본 task 는 caller 가 plan 과 그에 1:1 대응하는 outcome 배열을 이미
안다고 전제하고 **집계 리포트 조립까지만** 채운다. T-0613/T-0614 이 확립한 순수
도메인 함수 패턴(부수효과 0 / `@Injectable` 0 / Prisma 0 / 결정적 출력 / fail-fast
한국어 TypeError)을 그대로 mirror 한다. realdata-e2e 스택과 파일 disjoint 라
fineGrainedConcurrency 동시 claim 후보(touchesFiles 교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-plan.ts` 전문 — 본 집계의 입력
  원소 타입 `SummaryBatchPlanEntry`(`{ context, results, mode, options }`)와
  `buildSummaryBatchPlan` 산출 형태·결정적 순서·입력 비변형·fail-fast TypeError
  관례의 single source. **변경 금지** — `SummaryBatchPlanEntry` import + 패턴
  mirror 만.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` L55~66 +
  L104~125 — 본 집계의 두 번째 입력 타입 `SummaryAggregateResult`
  (`{ evaluated: boolean, result?: SummaryPersistResult }`)의 정확한 의미:
  `evaluated=false` = 시점 미도래 skip(write 0, result 부재), `evaluated=true` =
  평가·영속화 완료(result 존재). 본 집계가 evaluated/skip 을 이 surface 로 구별.
  **변경 금지** — type import + 의미 확인용 read.
- `src/assessment-evaluation/summary-persist.service.ts` L43~47 —
  `SummaryPersistResult`(`{ summaryId: string, created: boolean }`). `created=true`
  = 새 summary 생성, `created=false` = 기존 read-through(first-write-wins,
  ADR-0037). 본 집계가 created/existing 분류 시 이 필드 의미를 mirror. **변경 금지**
  — type import 만.
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` L22~33 —
  `SummaryBatchContext`(personId / period / periodStart). plan entry 의
  `context.period` 가 granularity 분류 축(day/week/month string)임을 확인. 본 집계가
  granularity별 분포 산출 시 이 period 문자열을 key 로 사용. **변경 금지** — read.
- `test/helpers/realdata-e2e-result-summary.ts`(T-0580 박제) 의 분포 집계 패턴 —
  슬롯 single-source 고정 순서·결정적 카운트·입력 비변형 관례. 본 집계가
  granularity별 분포를 결정적 고정 순서(day→week→month)로 산출하는 패턴 참조.
  **변경 금지** — 패턴 참조만(파일 disjoint, import 0).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-outcome.ts` 신설 — 순수 도메인
  함수 `summarizeSummaryBatchOutcome(plan, outcomes)` 박제. `plan:
  SummaryBatchPlanEntry[]` 와 `outcomes: SummaryAggregateResult[]` 를 **index 1:1
  zip**(같은 index 의 plan entry ↔ outcome)으로 순회하며, 결정적 batch outcome
  리포트(아래 shape)를 반환한다.
- [ ] **리포트 shape 박제**: `SummaryBatchOutcomeReport`
  `{ total, evaluated, skipped, created, existing, byGranularity }` interface 신설.
  - `total` = plan 길이(= outcomes 길이, 정합 전제).
  - `evaluated` = outcome.evaluated === true 인 개수.
  - `skipped` = outcome.evaluated === false 인 개수(시점 미도래).
  - `created` = outcome.evaluated && outcome.result?.created === true 인 개수.
  - `existing` = outcome.evaluated && outcome.result?.created === false 인 개수.
  - `byGranularity` = `{ day, week, month, other }` 각 granularity 별 `{ total,
    evaluated, skipped, created, existing }` 결정적 고정 순서 분포. plan entry 의
    `context.period` 문자열로 분류(`"day"`/`"week"`/`"month"` 외 값은 `other` 버킷).
  JSDoc 으로 각 필드 의미 single-source 화.
- [ ] **plan ↔ outcomes 길이 정합 계약 박제**: 두 배열 길이가 다르면 fail-fast
  TypeError(한국어 메시지, period-select/T-0614 관례 mirror) — index zip 의 silent
  누락·오매칭으로 인한 집계 왜곡 차단. 길이 정합을 JSDoc 으로 명시.
- [ ] `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / 부수효과 0 / 입력
  배열·원소 비변형. 동일 입력은 항상 동일 출력(referential transparency). 새 외부
  dependency 0. DB write·migration 0. raw 미저장(R-59) — 평가 결과 본문 미접촉,
  집계는 식별 축(period)·boolean flag(evaluated/created)만 소비, summaryId 는 카운트
  목적 미보유(개수만).
- [ ] **Happy-path test 1+**: plan 4개(day/day/week/month) + outcome 4개(평가 3건
  중 created 2/existing 1, skip 1건) → `total=4, evaluated=3, skipped=1, created=2,
  existing=1` + `byGranularity` 가 period별로 정확히 분배(day 버킷 2건, week 1건,
  month 1건) 검증.
- [ ] **Error path test 1+**: `plan` 또는 `outcomes` 가 null/undefined → fail-fast
  TypeError(한국어 메시지). plan.length ≠ outcomes.length → 길이 정합 TypeError 1+.
- [ ] **Flow / branch 분기 cover**: (a) plan 빈 배열 + outcome 빈 배열 → 모든
  카운트 0 + byGranularity 전 버킷 0(throw 0), (b) evaluated=true & result.created
  =true → created++ 분기, (c) evaluated=true & result.created=false → existing++
  분기, (d) evaluated=false → skipped++ 분기(result 미참조), 각 분기 1+ test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) evaluated=true 인데 result 가 undefined(비정상 outcome — 명세상 evaluated 면
    result 존재여야 하나 방어적으로 created/existing 어느 쪽에도 미집계함을 명시
    검증, 또는 결정한 처리대로 1+ test),
  (2) plan entry 의 `context.period` 가 `"day"/"week"/"month"` 외 값(예 `"year"`/
    빈 문자열) → `other` 버킷에 집계 + 분포 합산 정합 검증,
  (3) 전부 skip(outcome 전건 evaluated=false) → evaluated/created/existing 모두 0,
    skipped=total, byGranularity 도 skip 만 집계,
  (4) 전부 created(평가+생성) → existing=0, created=evaluated=total,
  (5) byGranularity 각 버킷의 합(total/evaluated/skipped/created/existing)이 전역
    합계와 일치(분포 보존 invariant) + 입력 배열·원소 비변형(호출 후 원본 동일)
    각 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-outcome.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. `SummaryBatchPlanEntry` /
  `SummaryAggregateResult` 는 최소 stub 으로 형태만 충족(실 LLM/DB 0, periodStart 는
  고정 Date instance 주입으로 결정성 확보).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 composer 는 순수 함수라 100% 달성 목표.

## Out of Scope

- **orchestrator / service / controller 실배선 금지** — plan 을 순회하며 async
  `evaluateAndPersist` 를 좌표별 호출하고 본 집계로 결과를 묶는 batch orchestrator
  (`enumerate → buildSummaryBatchPlan → 순회 await evaluateAndPersist →
  summarizeSummaryBatchOutcome`)는 별도 follow-up slice(`@Injectable` + DI +
  async, service-경계). 본 task 는 결과 집계 순수 함수까지.
- **좌표 → `EvaluationResult[]` 도출(collection bridge) 금지** — cross-module/RBAC
  ADR 영역. 본 집계는 caller 가 plan(=results 부착 완료)과 outcome 을 이미 안다고
  전제.
- **roster / granularity source 도출 금지** — T-0613 책임. 본 task 는 plan entry 의
  `context.period` 를 분류 축으로 소비만.
- **summaryId 본문 / narrative 접촉 금지** — 집계는 개수(count)와 식별 축(period)만.
  summaryId 문자열 자체를 리포트에 담지 않는다(R-59 정합, 카운트 목적만).
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — 요약 batch 평가 endpoint
  배선은 Q-0030 ADR-gated(새 RBAC 결정). 본 task 는 새 endpoint·DTO·controller
  변경 0.
- **`summary-batch-plan.ts` / `summary-aggregate-orchestrator.service.ts` /
  `summary-persist.service.ts` / `summary-batch-prompt.ts` 변경 금지** — type import
  + 패턴 mirror 만(plan 조립·게이트·persist 재구현 0).
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: `enumerate(T-0613) → buildSummaryBatchPlan(T-0614) → 순회 await
  evaluateAndPersist → summarizeSummaryBatchOutcome(본 task)` 를 한 흐름으로 묶는
  batch summary orchestrator(`@Injectable` + DI + async) — 단
  `resultsByCoordinate` map 을 채우는 좌표→`EvaluationResult[]` collection bridge 는
  cross-module(별도 ADR/slice).
- manual-trigger 요약 batch 평가 endpoint(Q-0030 RBAC ADR-first) — Admin/User 가
  요약 평가를 trigger 하는 HTTP 경계.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

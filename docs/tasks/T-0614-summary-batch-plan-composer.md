---
id: T-0614
title: R-61 요약 평가 batch plan 순수 composer — 좌표 + 좌표별 results map → evaluateAndPersist 인자 tuple 순서 plan 산출
phase: P5
status: DONE
completedAt: 2026-06-24T00:56:15Z
prNumber: 528
mergedAs: 2926747
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0613 좌표 enumeration 과 evaluateAndPersist 사이 빈 join 조각. 좌표 × results map → batch 인자 tuple 순서 plan 순수 함수(orchestrator 배선·collection bridge 제외)"
independentStream: p5-summary-aggregate
dependsOn: [T-0613]
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-plan.ts
  - src/assessment-evaluation/domain/summary-batch-plan.spec.ts
---

# T-0614 — R-61 요약 평가 batch plan 순수 composer

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. T-0613(`enumerateSummaryDueCoordinates`,
PR #527 be77f86)이 "방금 종료된 day/week/month periodStart 를 roster × granularity
로 enumerate" 하는 좌표 detection 조각을 채웠고, backbone
(`SummaryAggregateOrchestratorService.evaluateAndPersist`)은 한
`(personId, period, periodStart)` 좌표 + 그 좌표의 `EvaluationResult[]` 묶음을 받아
"시점 게이트 → 영속화" 를 한 흐름으로 묶는다.

그러나 그 둘 사이 — **enumerate 된 `SummaryDueCoordinate[]` 를, 좌표별로 이미
도출된 단위 평가 묶음(`results map`)과 join 해 `evaluateAndPersist` 가 한 번씩
받을 인자 tuple `(context, results, mode, options)` 의 순서 있는 plan 으로 조립**
하는 조각이 비어 있다. 현재는 caller 가 좌표 배열을 직접 순회하며 매번 results 를
look-up 하고 mode/options 를 손으로 묶어야 한다. 이 join 로직을 순수 plan 으로
외화하면 batch orchestration 배선 시 service mock 없이 "어떤 좌표가 어떤 results 와
어떤 순서로 evaluateAndPersist 에 thread 되는가" 를 단위 검증할 수 있다.

이는 T-0613 의 Follow-up #1(batch summary orchestrator) 진입 직전의 순수 join
slice 다 — 좌표→`EvaluationResult[]` 도출(collection 호출)은 cross-module/RBAC
ADR 영역으로 deferred 이므로, 본 task 는 caller 가 좌표별 results 를 in-memory
map 으로 이미 안다고 전제하고 **plan 조립까지만** 채운다. period-select / T-0613
이 확립한 순수 도메인 함수 패턴(부수효과 0 / `@Injectable` 0 / Prisma 0 / 결정적
출력 순서 / fail-fast 한국어 TypeError)을 그대로 mirror 한다. realdata-e2e 스택과
파일 disjoint 라 fineGrainedConcurrency 동시 claim 후보(touchesFiles 교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/summary-due-coordinates.ts` 전문 — 본 composer 의
  입력 원소 타입 `SummaryDueCoordinate`(`{ personId, period, periodStart }`)와
  `enumerateSummaryDueCoordinates` 산출 형태·결정적 순서·입력 비변형·fail-fast
  TypeError 관례의 single source. **변경 금지** — `SummaryDueCoordinate` import +
  패턴 mirror 만.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` L55~127 —
  본 composer 의 plan 원소가 thread 될 `evaluateAndPersist(context, results, mode,
  options, now)` 의 정확한 시그니처·인자 순서·타입(`SummaryBatchContext` /
  `EvaluationResult[]` / `PersistMode` / `SummaryPersistOptions`). plan 의 각
  tuple 이 그대로 spread 가능해야 한다(변환 0). **변경 금지** — 정합 확인용 read.
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` L22~33 —
  `SummaryBatchContext`(personId / period / periodStart 3-tuple). `SummaryDueCoordinate`
  가 이 형태와 정합(period 는 string 으로 widening)임을 확인. 본 composer 가 좌표를
  `context` 로 변환할 때 새 객체 발명 0(필드 그대로 mirror). **변경 금지** — read.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` 의 `PersistMode`
  정의 줄 + `summary-persist.service.ts` 의 `SummaryPersistOptions` 정의 줄 —
  plan tuple 의 `mode` / `options` 인자 타입. 본 composer 가 caller 가 넘긴
  공통 mode/options 를 좌표마다 동일하게 부착함을 확인. **변경 금지** — type import 만.
- `src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts` L1~30 +
  coordinateKey 산출부 — 좌표 식별 key(personId|period|periodStart.getTime())를
  results map look-up key 로 mirror. Invalid Date sentinel 처리·결정적 key 관례를
  따른다. **변경 금지** — 패턴 참조만.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-plan.ts` 신설 — 순수 도메인
  함수 `buildSummaryBatchPlan(coordinates, resultsByCoordinate, mode, options)` 박제.
  `coordinates: SummaryDueCoordinate[]` 를 입력 등장 순서대로 순회하며, 각 좌표를
  `evaluateAndPersist` 인자 tuple `{ context: { personId, period, periodStart },
  results, mode, options }` 로 조립한 **순서 있는 plan 배열**을 반환한다.
  `results` 는 `resultsByCoordinate` 에서 좌표 key(`personId|period|periodStart
  .getTime()`)로 look-up 한다.
- [ ] **results map 계약 박제**: `resultsByCoordinate` 는 `Map<string,
  EvaluationResult[]>` 또는 동형 look-up 구조(설계 결정을 JSDoc 으로 single-source
  화). 좌표 key 가 map 에 **없을 때의 동작을 명시적으로 박제** — 빈 배열 `[]` 기본
  부착(backbone 이 빈 results 를 reject 하지 않음, orchestrator L28~30 빈 묶음 경계
  정합) 또는 fail-fast TypeError 중 하나를 JSDoc 으로 single-source 화하고 그 결정대로
  1+ test. 본 task 는 **빈 배열 기본 부착**을 채택(좌표 enumerate 와 results 도출이
  분리된 slice 라 results 부재는 정상 — 빈 요약도 평가 가능).
- [ ] `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / 부수효과 0 / 입력
  배열·map·원소 비변형. 동일 입력은 항상 동일 출력(referential transparency). 새
  외부 dependency 0. DB write·migration 0. raw 미저장(R-59) — 평가 결과 본문
  미접촉, plan 구조(좌표 식별 축 + caller 가 넘긴 results 참조)만 조립.
- [ ] plan 의 각 tuple 은 `evaluateAndPersist(context, results, mode, options, now)`
  의 앞 4 인자와 정확히 정합(now 는 호출 시점 주입이라 plan 에 미포함 — JSDoc 명시).
  좌표 → `SummaryBatchContext` 변환은 필드 그대로 mirror(personId/period/periodStart),
  새 boundary 산술·새 좌표 발명 0.
- [ ] **Happy-path test 1+**: 좌표 3개(서로 다른 person/period) + 각 좌표 results
  2건이 담긴 map → 길이 3 plan 산출, 입력 좌표 순서대로 + 각 tuple 의 context 가
  해당 좌표와 일치 + results 가 map look-up 값과 동일 reference + mode/options 가
  caller 인자와 동일 검증.
- [ ] **Error path test 1+**: `coordinates` 또는 `resultsByCoordinate` 가
  null/undefined → fail-fast TypeError(한국어 메시지, period-select / T-0613 관례
  mirror). 좌표 원소가 `personId`/`period`/`periodStart` 누락 시 처리 동작을 1+ test
  로 박제(TypeError 전파 또는 명시적 검증).
- [ ] **Flow / branch 분기 cover**: (a) `coordinates` 빈 배열 → 빈 plan 반환(throw 0),
  (b) map 에 key 존재 → look-up results 부착, (c) map 에 key 부재 → 빈 배열 `[]`
  기본 부착(위 계약), 각 분기 1+ test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) map 이 비어 있음(좌표는 있으나 results 0) → 모든 tuple 이 빈 results 부착,
  (2) 좌표에 중복(같은 person/period/periodStart 2회) → plan 도 2 entry 산출(de-dup
    책임은 본 composer 밖 — T-0613 중복 좌표 책임 경계와 동형, 명시적 검증),
  (3) Invalid Date periodStart 를 가진 좌표 → key 산출 시 sentinel 처리(NaN
    비결정성 차단, period-select 관례 mirror) — look-up 일관성 1+ test,
  (4) results map 에 plan 좌표보다 많은 key(잉여 entry) → 잉여는 plan 에 미반영
    (좌표 driven, map 은 look-up source 일 뿐) 검증,
  (5) coordinates 순서가 plan 순서에 결정적으로 반영(비결정성 0) + 입력 배열·map
    비변형(호출 후 원본 동일) 각 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-plan.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. periodStart 는 고정 Date
  instance 주입으로 결정성 확보(시스템 시계 미사용). `EvaluationResult` /
  `SummaryPersistOptions` 는 최소 stub 으로 형태만 충족(실 LLM/DB 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 composer 는 순수 함수라 100% 달성 목표.

## Out of Scope

- **orchestrator / service / controller 실배선 금지** — 본 plan 을 순회하며
  `evaluateAndPersist` 를 좌표별로 호출하는 batch orchestrator(`enumerate → plan →
  순회 호출`) 배선은 별도 follow-up slice(dependsOn 보존). 본 task 는 plan 조립
  순수 함수까지.
- **좌표 → `EvaluationResult[]` 도출(collection bridge) 금지** — `resultsByCoordinate`
  map 을 채우는 경로(좌표 → collection → `Activity[]` → 단위 평가)는 cross-module/
  RBAC ADR 영역. 본 composer 는 caller 가 results map 을 이미 안다고 전제(T-0613 의
  roster source 도출을 caller 에 위임한 것과 동형).
- **roster(personIds) / granularity source 도출 금지** — 좌표 enumerate 는 T-0613
  `enumerateSummaryDueCoordinates` 책임. 본 task 는 그 산출 좌표를 소비만.
- **mode / options 결정 로직 금지** — `PersistMode`("fill"/"reeval") 선택과
  narrative `modelId` 결정은 caller(orchestrator/policy) 책임. 본 composer 는 caller
  가 넘긴 공통 mode/options 를 좌표마다 동일하게 부착만(per-coordinate 분기 0).
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — 요약 batch 평가 endpoint
  배선은 Q-0030 ADR-gated(새 RBAC 결정). 본 task 는 새 endpoint·DTO·controller
  변경 0.
- **`summary-due-coordinates.ts` / `summary-aggregate-orchestrator.service.ts` /
  `summary-batch-prompt.ts` / `period-boundary.ts` 변경 금지** — type import + 패턴
  mirror 만(좌표 산술·게이트·boundary 재구현 0).
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: 본 plan 을 순회하며 `SummaryAggregateOrchestratorService
  .evaluateAndPersist` 를 좌표별로 호출하는 batch summary orchestrator(`enumerate →
  buildSummaryBatchPlan → 순회 evaluateAndPersist → 결과 집계`) — 단
  `resultsByCoordinate` map 을 채우는 좌표→`EvaluationResult[]` collection bridge 는
  cross-module(별도 ADR/slice).
- manual-trigger 요약 batch 평가 endpoint(Q-0030 RBAC ADR-first) — Admin/User 가
  요약 평가를 trigger 하는 HTTP 경계.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

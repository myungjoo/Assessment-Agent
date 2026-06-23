---
id: T-0613
title: R-61 요약 평가 대상 좌표 enumeration 순수 composer — roster + now → just-closed (person, period, periodStart) 좌표 산출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 요약 평가 — period-select 의 'intended 좌표 생성' defer 를 닫는 순수 enumeration composer. 실 평가 e2e ④(T-0612) 닫힌 후 신규 독립 stream"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-due-coordinates.ts
  - src/assessment-evaluation/domain/summary-due-coordinates.spec.ts
---

# T-0613 — R-61 요약 평가 대상 좌표 enumeration 순수 composer

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. "당일 활동은 자정까지 평가 미실시,
주간은 다음주 시작 시, 월간은 다음달 시작 시" 가 핵심 시점 규칙이다.

요약 평가 backbone 은 시점 게이트(`isPeriodEvaluable`, period-evaluable.ts)·batch
prompt(summary-batch-prompt.ts)·persist(summary-persist.service.ts)·thin
orchestrator(`SummaryAggregateOrchestratorService.evaluateAndPersist`) 까지
머지됐다. 그러나 이들은 모두 **caller 가 어떤 `(personId, period, periodStart)`
좌표를 평가할지 이미 안다고 전제**한다. 그 "어떤 좌표가 지금 평가 대상인가"(=
방금 종료된 day/week/month 의 periodStart 를 roster × granularity 로 enumerate)
를 결정하는 **순수 detection 조각이 비어 있다**.

`evaluation-unevaluated-period-select.ts`(R-64 gap 선별)의 Out of Scope 가 명시적
으로 "intended 좌표 *생성*(기간 enumeration)은 본 함수 범위 밖" 으로 deferred 한
바로 그 조각이다. 본 task 는 그 빈자리를, 단위 평가 detection composer
(computeEvaluationAdjustmentSignals, T-0608)·gap 선별(period-select)이 확립한
**순수 도메인 함수 패턴**으로 채운다 — orchestrator/service/controller 배선·DB
read·실 LLM 호출 0, `now` 와 roster 만 주입받아 결정적으로 좌표 집합을 derive.

실 평가 e2e ④(T-0612, daily-test step_eval bash 배선)가 닫힌 후 신규 독립 stream
(`p5-summary-aggregate`) 의 첫 slice. realdata-e2e 스택과 파일 disjoint 라
fineGrainedConcurrency 동시 claim 후보(touchesFiles 교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/period-evaluable.ts` 전문 — 본 composer 가
  **재사용**할 시점 게이트·boundary 계약의 single source. `VALID_PERIODS`(=day/week/
  month literal union, `PeriodGranularity`)·`computePeriodEnd`·`isPeriodEvaluable`
  의 시그니처·throw 규약(알 수 없는 period TypeError 전파)을 본 composer 가 그대로
  따른다. **변경 금지** — import + 호출만.
- `src/common/period-boundary.ts` L73~166 — `startOfKstDay` / `startOfKstWeek` /
  `startOfKstMonth` / `getKstPeriodRange` / `getKstPeriodRangeByPeriod` /
  `PERIOD_TO_GRANULARITY`. 본 composer 가 "현재 `now` 가 속한 period 의 직전(방금
  종료된) period 의 periodStart" 를 산출할 때 위임할 KST boundary helper. **변경
  금지** — 새 boundary 로직 재구현 0, 기존 helper wrapper 호출만.
- `src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts` L1~30
  + coordinateKey 산출부 — 본 composer 가 mirror 할 순수 함수 패턴(부수효과 0 /
  `@Injectable` 0 / Prisma 0 / 입력 비변형 / null·undefined 입력 fail-fast TypeError /
  결정적 출력 순서 / 한국어 JSDoc). 특히 periodStart Date 의 `getTime()` 정규화 +
  Invalid Date sentinel 처리 관례를 그대로 따른다. **변경 금지** — 패턴 참조만.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` L32~40
  (책임 경계 주석) + `SummaryBatchContext`(domain/summary-batch-prompt.ts L26~33)
  — 본 composer 의 산출 원소 형태(`{ personId, period, periodStart }` 3-tuple)가
  downstream `evaluateAndPersist` / `SummaryBatchContext` 와 정합함을 확인. 산출
  좌표가 그대로 `evaluateAndPersist` 의 `context` 인자로 thread 가능해야 한다
  (변환 0). **변경 금지** — 정합 확인용 read.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-due-coordinates.ts` 신설 — 순수
  도메인 함수 `enumerateSummaryDueCoordinates(personIds, granularities, now)` 박제.
  roster(`personIds: string[]`) × 평가 granularity 집합(`granularities` — 기본
  day/week/month, `VALID_PERIODS` subset) 을 받아, 각 (person, granularity) 마다
  **`now` 시점에 방금 종료된 직전 period 의 `periodStart`** 를 boundary helper 로
  산출해 `{ personId, period, periodStart }[]` 를 반환한다. 산출된 모든 좌표는
  `isPeriodEvaluable(period, periodStart, now)` 가 true 임을 만족(직전 period 는
  `now ≥ periodEnd` 이므로) — composer 가 그 불변을 보장.
- [ ] **R-61 시점 규칙 정합**: day → 직전 KST 일(자정 종료된 어제), week → 직전
  KST 주(다음주 시작 = 이번주 월요일 자정 이후이면 지난주), month → 직전 KST 월
  (다음달 1일 자정 이후이면 지난달). 진행 중 period(아직 종료 안 됨)는 좌표에
  포함하지 않는다(미평가). 모든 boundary 산출은 `period-boundary.ts` helper 위임
  (재구현 0) — `Asia/Seoul` 자정 경계.
- [ ] `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 / 부수효과 0 / 입력
  배열·원소 비변형. 동일 입력은 항상 동일 출력(referential transparency). 새 외부
  dependency 0. DB write·migration 0. raw 미저장(R-59) — 평가 결과 본문 미접촉,
  좌표 식별 축(personId/period/periodStart)만 산출.
- [ ] **Happy-path test 1+**: roster 2명 × granularity 3종 + 특정 `now` 모의 →
  6 좌표 산출 + 각 좌표 `{personId, period, periodStart}` 가 직전 종료 period 의
  KST periodStart 와 정확히 일치 + 모두 `isPeriodEvaluable(...,now)` true 검증.
- [ ] **Error path test 1+**: `personIds` 또는 `granularities` 가 null/undefined →
  fail-fast TypeError(한국어 메시지, period-select 관례 mirror). 알 수 없는
  granularity 문자열(`VALID_PERIODS` 밖) 포함 시 `computePeriodEnd`/boundary helper
  의 throw 전파(silent-skip 0 — 게이트 우선).
- [ ] **Flow / branch 분기 cover**: (a) roster 비어 있음 → 빈 배열 반환(throw 0),
  (b) granularities 비어 있음 → 빈 배열 반환, (c) 정상 roster×granularity →
  좌표 산출 각 1+ test. day/week/month 각 분기의 periodStart 산출 경로를 분리 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) `now` 가 정확히 KST 자정(period 경계 instant) → 직전 period 가 방금 종료된
    것으로 일관 판정(반열림 `[start,end)` 경계 처리),
  (2) `now` 가 KST 월초 1일 00:00 → monthly 좌표 = 지난달, weekly/daily 도 직전
    종료분 일관,
  (3) roster 에 중복 personId → 좌표도 중복 산출(de-dup 책임은 본 composer 밖 —
    명시적 검증으로 책임 경계 박제) 또는 중복 제거(설계 결정을 JSDoc 으로 single-
    source 화하고 그 결정대로 1+ test),
  (4) Invalid Date 가 boundary helper 에 도달하는 경로(예: `now` 가 Invalid Date)
    → TypeError/RangeError 전파(NaN 비결정성 차단, period-select sentinel 관례),
  (5) granularity 순서·roster 순서가 산출 좌표 순서에 결정적으로 반영(비결정성 0)
    각 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-due-coordinates.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. `now`·periodStart 는 고정
  Date instance 주입으로 결정성 확보(시스템 시계 미사용).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 composer 는 순수 함수라 100% 달성 목표.

## Out of Scope

- **orchestrator / service / controller 실배선 금지** — 본 composer 산출 좌표를
  `SummaryAggregateOrchestratorService.evaluateAndPersist` 에 thread 하는 배선은
  별도 follow-up slice(dependsOn 보존). 본 task 는 좌표 enumeration 순수 함수까지.
- **roster(personIds) source 도출 금지** — 어떤 Person 을 평가 대상으로 삼을지(DB
  read / Person repository 조회)는 본 함수 범위 밖. caller 가 in-memory string[] 를
  넘긴다고 전제(period-select 가 intended/persisted 배열을 caller 에게서 받는 것과
  동형).
- **period→collection→evaluate bridge 금지** — 좌표 → 단위 평가 `EvaluationResult[]`
  도출(collection 호출)은 cross-module/RBAC ADR 영역. 본 composer 는 좌표 *식별*
  까지만.
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — 요약 batch 평가 endpoint
  배선은 Q-0030 ADR-gated(새 RBAC 결정). 본 task 는 새 endpoint·DTO·controller
  변경 0.
- **`period-evaluable.ts` / `period-boundary.ts` / `summary-batch-prompt.ts` 변경
  금지** — import + 호출 mirror 만(boundary·게이트 재구현 0). timezone = KST 확정
  (PLAN 110행)은 기존 helper 가 이미 박제 — 본 task 는 그 helper 소비만.
- DB write / Prisma migration 0. 새 외부 dependency 0. live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: 본 composer 산출 좌표를 `SummaryAggregateOrchestratorService.
  evaluateAndPersist` 로 thread 하는 batch summary orchestrator(좌표 enumerate →
  좌표별 단위 평가 묶음 도출 → evaluateAndPersist 순회) — 단 좌표→`EvaluationResult[]`
  도출은 cross-module bridge(별도 ADR/slice).
- manual-trigger 요약 batch 평가 endpoint(Q-0030 RBAC ADR-first) — Admin/User 가
  요약 평가를 trigger 하는 HTTP 경계.
- PLAN 97행 R-61 closure 후 P5 잔여: R-9 사용자 지정 기간 평가문(bullet 98).

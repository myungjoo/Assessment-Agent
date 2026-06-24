---
id: T-0628
title: R-61 요약 batch roster 입력의 pre-flight 평가 범위 사람-친화 한 줄 요약 순수 formatter formatSummaryBatchRosterPlan(roster) → string 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — roster-진입점 end-to-end(가드 T-0627 #541 배선) 닫힌 후, outcome 측 formatSummaryBatchOutcome(T-0622) 와 동형의 입력측 pre-flight 요약 조각. roster → person 수·granularity 버킷·enumerate 좌표 수 결정적 한국어 단일 라인. 순수·새 dep 0. endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts
  - src/assessment-evaluation/domain/summary-batch-roster-plan-format.spec.ts
---

# T-0628 — R-61 요약 batch roster 입력 pre-flight 평가 범위 한 줄 요약 순수 formatter

## Why

PLAN.md P5 bullet 97 (REQ-061 "일/주/월 요약 평가")의 presentation 조각이다.
p5-summary-aggregate stream 은 roster-진입점이 end-to-end 로 닫혔다 — 순수 layer
(enumerate / plan / run / outcome / pipeline) · `@Injectable` orchestrator service ·
roster-진입점 `evaluateBatchForRoster` · roster-input orphan 가드 배선(T-0627, PR #541
a5eeaea)이 모두 머지됐다.

**outcome(결과) 측에는 사람-친화 한 줄 요약이 있으나 input(입력) 측에는 없다.**
T-0615 `summarizeSummaryBatchOutcome` → T-0622 `formatSummaryBatchOutcome(report)`
체인이 batch 가 **무엇을 평가했는지**(총 N건 · 평가/생성/기존/skip · granularity 분포)를
결정적 한국어 단일 라인으로 렌더한다. 반면 batch 가 **무엇을 평가할 것인지**(어느 roster ·
어느 granularity · 몇 개 좌표가 enumerate 됐는지)를 사람이 한 눈에 보는 pre-flight 요약은
빈칸이다. 로그·journal·향후 notification surface 가 batch 실행 **전에** "지금 무엇이 돌아갈
것인가"를 외화할 표현 조각이 없다.

본 task 는 그 빈칸을 채운다 — 입력측 순수 formatter
`formatSummaryBatchRosterPlan(roster: SummaryBatchRosterInput): string` 을 추가한다.
roster 의 `personIds` · `granularities` · `now` 로부터 (재구현 0, 위임만)
`enumerateSummaryDueCoordinates` 를 호출해 산출될 좌표를 derive 한 뒤, person 수 ·
granularity 버킷별 좌표 수 · 총 좌표 수를 결정적 한국어 단일 라인으로 렌더한다. 이는
T-0622 `formatSummaryBatchOutcome` 이 **outcome report** 를 한 줄로 렌더한 것과 정확히
동형이다(입력측 mirror — outcome 은 결과 카운트, 본 formatter 는 pre-flight 범위).

순수성 — formatter 는 순수 함수(부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 ·
repository 0 · 입력 비변형 · 동일 입력 → byte-identical 출력 · 잔여 상태 누수 0). 좌표
산출은 `enumerateSummaryDueCoordinates` 위임(재구현 0) — 그 결정성·비변형 계약을 상속한다.
새 외부 dependency 0 · DB write/migration 0 · raw 미저장(R-59 — 좌표 식별 축만 counting,
평가 본문 미접촉). p5-summary-aggregate stream 내부 표현 layer 조각이며 realdata-e2e /
evaluation-adjustments stream 과 파일 disjoint(touchesFiles 교집합 0). manual-trigger
HTTP endpoint(Q-0030 RBAC) / collection bridge(cross-module RBAC) 같은 §5 ADR-gated
BLOCKED 영역은 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` — **mirror 패턴
  source**. `formatSummaryBatchOutcome(report): string` 의 관례: 순수 함수 / null·undefined
  입력 fail-fast 한국어 `TypeError` / 결정적 한국어 단일 라인(개행 0) / granularity 버킷을
  고정 순서 single-source 순회로 렌더(값 0 버킷도 슬롯 누락 없이 등장) / 한국어 JSDoc /
  책임 경계 주석. 본 formatter 는 이 파일을 import 하지 않으나 그 표현 관례·문구 톤을
  mirror 한다. (이 파일은 outcome report 를 렌더 — 본 task 는 roster 입력을 렌더, 역할 분리.)
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — 본 formatter 가
  받을 `SummaryBatchRosterInput` surface(`personIds`/`granularities`/`resultsByCoordinate`/
  `mode`/`options`/`now`). **import type 만** — composer `buildSummaryBatchOrchestratorInput`
  본문·계약 변경 0. formatter 는 composer 와 동일 roster 를 받되, 좌표 enumerate 만 공유
  하고 resultsByCoordinate/mode/options 는 pre-flight 요약 대상이 아니므로 미접촉.
- `src/assessment-evaluation/domain/summary-due-coordinates.ts` —
  `enumerateSummaryDueCoordinates(personIds, granularities, now)` + `SummaryDueCoordinate`
  (`{ personId, period, periodStart }`). 본 formatter 가 좌표 산출을 **위임**(재구현 0)할
  대상. `period` 는 `PeriodGranularity`(`day`/`week`/`month`). enumerate 의 null/undefined·
  Invalid Date·알 수 없는 granularity fail-fast 가 본 formatter 를 통해 전파된다. **변경 금지.**
- `src/assessment-evaluation/domain/summary-batch-outcome.ts` — `GRANULARITY_BUCKETS`
  const(day → week → month → other) single-source 고정 순서(이미 `export`). 본 formatter 는
  버킷 순회 순서를 이 single source 와 **동일 순서**로 맞춘다(`other` 버킷은 enumerate 가
  `day`/`week`/`month` 만 산출하므로 항상 0 — 슬롯 누락 없이 `other 0` 등장으로 outcome
  formatter 와 표현 정합). 이 파일 **import 가능 시 재사용, 변경 금지**(값/순서 무변경).
- `src/assessment-evaluation/domain/summary-batch-outcome-format.spec.ts` — colocated
  spec 구조·R-112 4종 케이스 배치 mirror.

## Acceptance Criteria

- [ ] 신규 순수 formatter `formatSummaryBatchRosterPlan(roster: SummaryBatchRosterInput):
  string` 를 `src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts` 에
  추가한다. 동작:
  - `roster` null/undefined → 한국어 `TypeError` fail-fast(직접 가드, outcome formatter
    mirror).
  - `enumerateSummaryDueCoordinates(roster.personIds, roster.granularities, roster.now)`
    로 산출될 좌표를 derive(재구현 0, 위임만 — personIds/granularities null·undefined·
    Invalid Date now·알 수 없는 granularity 의 TypeError/RangeError 는 이 위임에서 전파).
  - 좌표 수를 `GRANULARITY_BUCKETS`(day → week → month → other) 고정 순서로 버킷별
    counting 후, person 수(roster.personIds.length) · 총 좌표 수 · 버킷별 분포를 담은
    **결정적 한국어 단일 라인 문자열** 반환. 값 0 버킷도 슬롯 누락 없이 등장(`other 0`).
    개행 0(단일 라인). 문구의 정확한 형태는 본 함수가 single source(JSDoc 에 예시 박제).
- [ ] **순수성·계약 보존** — formatter 는 순수 함수: 부수효과 0 · `@Injectable` 0 ·
  Prisma 0 · LLM 0 · repository 0 · 입력 비변형(roster·personIds·granularities·now 읽기만,
  resultsByCoordinate/mode/options 미접촉) · 동일 입력 → byte-identical 출력 · 잔여 상태
  누수 0. 새 외부 dependency 0 · migration 0 · raw 미저장(R-59 — 좌표 식별 축만 counting).
- [ ] **Happy-path test 1+**: 정상 roster(예: personIds 2명 × granularities `[day, week,
  month]`)로 호출 시 (a) throw 0, (b) person 수 · 총 좌표 수(=2×3=6) · day/week/month 버킷
  각 2 · other 0 을 정확히 반영한 결정적 한국어 단일 라인 반환(예상 문자열과 정확 일치 또는
  핵심 토큰 substring 검증).
- [ ] **Error path test 1+**: (a) `roster` null → 한국어 `TypeError`, `roster` undefined →
  한국어 `TypeError`(직접 가드). (b) `personIds` null/undefined 또는 `granularities`
  null/undefined → `enumerateSummaryDueCoordinates` 위임 `TypeError` 전파(swallow 0).
  (c) `now` Invalid Date → 위임 helper 에서 throw 전파. (d) `granularities` 에 알 수 없는
  period(`year` 등) 포함 → 위임 `RangeError` 전파.
- [ ] **Flow / branch 분기 cover** — 분기마다 1+:
  - (a) 비어있지 않은 좌표(person·granularity 다수) → 버킷별 양수 카운트 라인,
  - (b) 빈 roster(빈 `personIds`) → enumerate 빈 좌표 → 총 0 · 전 버킷 0 라인(throw 0),
  - (c) 빈 `granularities` → enumerate 빈 좌표 → 총 0 라인(throw 0),
  - (d) 단일 granularity(예: `[day]` 만) → day 버킷만 양수 · week/month/other 0 슬롯 등장.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리(각 1+):
  (1) 빈 roster(personIds 빈 배열) → 총 0 · 전 버킷 0 슬롯 등장(누락 0) test,
  (2) 빈 granularities → 총 0 라인 test,
  (3) `roster` null/undefined → 한국어 `TypeError` 2종 test,
  (4) 중복 personId roster(같은 personId 2회) → enumerate de-dup 0 계약 상속으로 좌표
    중복 보존(person 수·좌표 수가 중복 반영) test — composer/enumerate 중복 보존 계약 정합,
  (5) 동일 roster 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0) test,
  (6) 호출 후 입력 비변형(`roster.personIds`/`granularities`/`now`/`resultsByCoordinate`
    deep 동일성 — formatter 가 입력을 변형하지 않음) test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-roster-plan-format.spec.ts`
  작성(NestJS convention + discoverability). 좌표는 실제 `enumerateSummaryDueCoordinates`
  를 통해 산출(고정 `now` 주입으로 결정성 확보) — 실 LLM/DB/Prisma 0, 순수 단위 격리.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 formatter 파일 line/branch/function 100% 목표.

## Out of Scope

- **`summary-batch-roster-input.ts` 변경 금지** — `SummaryBatchRosterInput` 을 import type
  로만 소비. composer `buildSummaryBatchOrchestratorInput` 본문·pass-through 계약 변경 0.
- **`summary-due-coordinates.ts` / `summary-batch-outcome.ts` 변경 금지** — enumerate /
  `GRANULARITY_BUCKETS` 는 import·위임만(값/순서/로직 무변경). `GRANULARITY_BUCKETS` 는
  이미 `export` 라 추가 amend 0.
- **orchestrator service / pipeline / 가드 변경 금지** — 본 task 는 순수 formatter 함수
  까지. formatter 를 service 나 로그에 배선(호출)하는 것은 별도 wiring follow-up(T-0622 →
  T-0623 가 outcome formatter 를 service 경계로 외화한 패턴과 동형). 생성자/DI/providers
  무변경.
- **resultsByCoordinate / mode / options 렌더 금지** — pre-flight 요약은 좌표 enumerate
  범위(person·granularity·좌표 수)만 표현. 결과(평가/생성/skip)는 outcome formatter
  (T-0622) 책임. resultsByCoordinate 의 orphan 검증은 T-0626/T-0627 가드 책임(본 formatter
  는 검증 0 — 표현만).
- **JSON 직렬화 / i18n / markdown 표 / 템플릿 엔진 금지** — 한국어 단일 라인 문자열 하나만.
- **manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 0** — Q-0030 RBAC
  ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → `EvaluationResult[]`) 0** — cross-module/RBAC ADR 영역(§5
  BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0 · raw 미저장
  (R-59 — 좌표 식별 축만 counting, 평가 본문 미접촉).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

후보 후속 slice(참고 — 본 task 범위 밖):
- pre-flight roster-plan 요약 formatter 를 `evaluateBatchForRoster` / 로그·journal surface
  에 배선(wiring) — T-0623 가 outcome summaryLine 을 service 경계로 외화한 패턴 동형.
- manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first) — **§5 BLOCKED**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5 BLOCKED**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

---
id: T-0619
title: R-61 요약 평가 batch outcome 리포트 사람-친화 한 줄 요약 순수 formatter — formatSummaryBatchOutcome(report) → string (logging/notification surface, pure)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0618 orchestrator service(PR #532 ad20e3d) 닫힌 후 post-outcome 표현 slice. report → 결정적 한 줄 요약 순수 formatter. 두 ADR-gated follow-up(endpoint/collection bridge)은 §5 BLOCKED 라 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-outcome-format.ts
  - src/assessment-evaluation/domain/summary-batch-outcome-format.spec.ts
---

# T-0619 — R-61 요약 평가 batch outcome 리포트 사람-친화 한 줄 요약 순수 formatter

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 순수 layer
와 `@Injectable` orchestrator service 가 모두 머지됐다:

- T-0613 `enumerateSummaryDueCoordinates`(PR #527) — 좌표 enumerate.
- T-0614 `buildSummaryBatchPlan`(PR #528) — 좌표 × results map → plan tuple.
- T-0616 `runSummaryBatchPlan`(PR #530) — plan 순회 sequential await.
- T-0615 `summarizeSummaryBatchOutcome`(PR #529) — outcomes → 결정적
  `SummaryBatchOutcomeReport`.
- T-0617 `runSummaryBatchPipeline`(PR #531 cbb00fc) — 위 plan→run→outcome 을 한
  흐름으로 묶는 순수 async pipeline.
- T-0618 `SummaryBatchOrchestratorService`(PR #532 ad20e3d) — `@Injectable` 로
  pipeline 을 감싸 `SummaryAggregateOrchestratorService.evaluateAndPersist` 를
  evaluator 로 bind. service-경계 진입점 완결.

T-0618 follow-up 의 두 자연스러운 후속(① manual-trigger HTTP endpoint, ② 좌표 →
`EvaluationResult[]` collection bridge)은 **둘 다 ADR-gated** 다 — ①은 Q-0030
RBAC ADR-first(controller/route/권한 모델), ②는 cross-module/RBAC ADR(collection
→ Activity 도출). CLAUDE.md §5 의 "Security/auth 관련 변경" · "외부/cross-module
RBAC" BLOCKED 트리거라 본 planner 가 임의로 큐잉하지 않는다(별도 사람 결정/ADR
선행).

대신 본 task 는 **이미 결정된 ADR 안에서, 새 dependency·새 ADR 0 인 순수/독립
slice** 를 잡는다: batch outcome 의 **표현(presentation) 조각**. 현재
`SummaryBatchOutcomeReport`(total/evaluated/skipped/created/existing +
byGranularity)는 머신리더블 객체일 뿐, **사람-친화 한 줄 요약**(로그·journal·향후
notification surface 가 그대로 흘려보낼 문자열)이 비어 있다. 본 composer 는 그
빈칸을 채운다 — report 를 결정적 단일 라인 문자열로 포맷하는 순수 함수.

순수(부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 입력 비변형 · 동일 입력 →
동일 출력). 새 외부 dependency 0 · DB write/migration 0 · raw 미저장(R-59 — report
는 이미 카운트만 보유, summaryId 본문 미접촉이라 formatter 도 카운트만 렌더링).
realdata-e2e / evaluation-adjustments stream 과 파일 disjoint 라
fineGrainedConcurrency 동시 claim 후보(touchesFiles 교집합 0).

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-outcome.ts` 전문 — 입력 타입
  `SummaryBatchOutcomeReport`(extends `SummaryBatchOutcomeCounts`:
  `total/evaluated/skipped/created/existing`) + `byGranularity:
  Record<"day"|"week"|"month"|"other", SummaryBatchOutcomeCounts>`, 그리고
  `GRANULARITY_BUCKETS = ["day","week","month","other"]` 결정적 고정 순서 슬롯.
  본 formatter 는 이 타입을 `import type` 으로 소비(재정의 0). **변경 금지** —
  type import 만. (단 `GRANULARITY_BUCKETS` 가 현재 `export` 안 돼 있으면 본
  task 에서 그 const 에 `export` 만 추가해 single-source 슬롯 순서를 재사용 —
  값/순서 변경 0. export 추가가 필요하면 touchesFiles 에 본 파일이 포함되며 그
  한 줄(`export const`)만 amend.)
- `docs/decisions/ADR-0037` 또는 관련 first-write-wins 주석(summary-batch-outcome.ts
  L58~60 내 ADR-0037 참조) — `existing` 의미(read-through, first-write-wins)를
  요약 문구에 정확히 반영하기 위함. 본 task 는 ADR 변경 0(읽기만).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` 신설 —
  순수 함수 1 개 박제:
  ```ts
  export function formatSummaryBatchOutcome(
    report: SummaryBatchOutcomeReport,
  ): string;
  ```
  반환은 결정적 단일 라인(개행 0) 한국어 요약 문자열. 전역 카운트 + granularity
  분포를 사람이 한 눈에 읽을 수 있는 형태로 렌더링. 예시 형태(정확한 문구는
  구현 재량이나 결정성·전 카운트 노출은 필수):
  `요약 평가 batch: 총 3건 · 평가 2 (생성 1 / 기존 1) · skip 1 [day 1(평가1) · week 1(평가1) · month 1(skip1) · other 0]`
  — total / evaluated / skipped / created / existing 5 카운트 + 4 granularity
  버킷이 모두 문자열에 등장해야 한다(누락 0). JSDoc(한국어)으로 필드↔문구 매핑을
  single-source 박제.
- [ ] **결정성 / 순서 고정 박제**(JSDoc + 코드):
  - granularity 버킷 렌더 순서는 `GRANULARITY_BUCKETS`(day → week → month →
    other) single source 를 순회 — 임의 `Object.keys` 순서 의존 0. 같은 report
    → 항상 byte-identical 출력.
  - 미등장(값 0) 버킷도 문자열에 등장(슬롯 누락 0 — report 의 "전 버킷 키 존재"
    invariant 상속).
- [ ] **입력 비변형 / 순수**: `report` 객체·`byGranularity`·하위 카운트 객체를
  변형하지 않는다(읽기만). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 ·
  새 외부 dependency 0. raw 미저장(R-59) — report 는 카운트만 보유하므로
  formatter 도 summaryId/narrative 본문을 렌더링하지 않는다(카운트만).
- [ ] **Happy-path test 1+**: total 3 (day evaluated+created / week evaluated+
  existing / month skipped) 인 완전한 report 를 넘겨 반환 문자열에 (a) 총 3 ·
  평가 2 · skip 1 · 생성 1 · 기존 1 5 카운트가 모두 정확히 등장, (b) 4 granularity
  버킷(day/week/month/other)이 고정 순서로 모두 등장, (c) 개행 0(단일 라인) 검증.
- [ ] **Error path test 1+**: `report` 가 null/undefined 면 한국어 `TypeError`
  throw 1+. `report.byGranularity` 가 누락(undefined)된 불완전 객체 → 한국어
  `TypeError`(또는 명시적 가드) 1+ (silent 빈 문자열 위장 0). 각 error 분기 1+.
- [ ] **Flow / branch 분기 cover**: (a) 전건 evaluated+created(skip 0) report →
  "skip 0" 문구 + created=total, (b) 전건 skip(evaluated 0) report →
  "평가 0 · skip=total", (c) evaluated 이나 result 미보유라 created/existing
  어느 쪽도 아닌 카운트(report 상 evaluated > created+existing) → 합 불일치
  문구가 깨지지 않고 5 카운트 그대로 렌더 — 각 분기 1+ test 분리.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) 빈 batch(total 0, 전 카운트 0, byGranularity 전 버킷 0) → 모든 카운트 0
    이 정상 렌더(throw 0 · 빈 문자열 아님 — "총 0건" 명시) 1+ test,
  (2) `report` 입력 객체·`byGranularity`·하위 카운트가 호출 후 비변형(deep 동일)
    1+ test,
  (3) `byGranularity` 에 `other` 버킷에만 카운트가 몰린 경우(미지원 granularity)
    → other 가 문자열에 정확히 반영 1+ test,
  (4) 큰 수(예: total 1000+) → 자릿수 truncation/오버플로 0, 정확히 렌더 1+ test,
  (5) 같은 함수를 같은 report 로 2 회 호출 → 두 반환이 byte-identical(결정성·
    잔여 상태 누수 0) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-outcome-format.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. report fixture 는 직접
  객체 리터럴로 구성(실 `summarizeSummaryBatchOutcome` 호출 의존 0 — 단위 격리),
  또는 가독성 위해 `summarizeSummaryBatchOutcome` 로 fixture 생성해도 무방하나
  formatter 자체의 단위 검증이 흐려지지 않게 분리. 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 순수 함수는 100% 달성 목표.

## Out of Scope

- **`summary-batch-outcome.ts` 의 report 구조·카운트 로직 변경 금지** — 본 task 는
  표현 layer 만. report 필드 추가/의미 변경은 별도 slice. (단 `GRANULARITY_BUCKETS`
  const 에 `export` 키워드 한 줄 추가는 허용 — single-source 슬롯 순서 재사용
  목적, 값/순서 무변경.)
- **JSON 직렬화 / 다국어 / 템플릿 엔진 금지** — 결정적 한국어 단일 라인 문자열
  하나만. i18n·구조화 로그(JSON)·markdown 표 등은 별도 후속.
- **service / orchestrator / controller 배선 금지** — formatter 를 어디서
  호출(로그·notification)할지 배선은 별도. 본 task 는 순수 함수까지.
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — Q-0030 ADR-gated(§5
  BLOCKED). 본 task 와 무관.
- **collection bridge(좌표 → EvaluationResult[]) 금지** — cross-module/RBAC ADR
  영역(§5 BLOCKED). 본 task 와 무관.
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**. Admin/User 가 요약 평가를
  trigger 하는 controller 경계.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**. 좌표 → AssessmentCollectionModule(collectForPerson) →
  `Activity[]` → 단위 평가 → `resultsByCoordinate` map 채움.
- 본 formatter 를 orchestrator service / 향후 notification surface 가 호출하도록
  배선(로그·알림) — endpoint slice 와 함께 또는 별도.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

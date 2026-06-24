---
id: T-0620
title: R-61 요약 평가 batch outcome 리포트 불변식 검증 순수 가드 — assertSummaryBatchOutcomeConsistent(report) → void (pure invariant check)
phase: P5
status: DONE
commitMode: pr
prNumber: 534
mergedAs: 970e630
reviewRounds: 1
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0619 formatter(PR #533 8420ae4) 닫힌 후 post-outcome 순수 검증 slice. report 의 문서화된 불변식(평가+skip=total / 생성+기존=평가 / 버킷합=전역)을 검증하는 가드. endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts
  - src/assessment-evaluation/domain/summary-batch-outcome-consistency.spec.ts
---

# T-0620 — R-61 요약 평가 batch outcome 리포트 불변식 검증 순수 가드

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 순수
layer · `@Injectable` orchestrator service · 한 줄 formatter 가 모두 머지됐다:

- T-0613 `enumerateSummaryDueCoordinates`(PR #527) — 좌표 enumerate.
- T-0614 `buildSummaryBatchPlan`(PR #528) — 좌표 × results map → plan tuple.
- T-0616 `runSummaryBatchPlan`(PR #530) — plan 순회 sequential await.
- T-0615 `summarizeSummaryBatchOutcome`(PR #529) — outcomes → 결정적
  `SummaryBatchOutcomeReport`.
- T-0617 `runSummaryBatchPipeline`(PR #531) — 순수 async pipeline.
- T-0618 `SummaryBatchOrchestratorService`(PR #532) — `@Injectable` service 경계.
- T-0619 `formatSummaryBatchOutcome`(PR #533 8420ae4) — report → 결정적 한 줄
  요약 문자열.

두 자연스러운 후속(① manual-trigger HTTP endpoint = Q-0030 RBAC ADR-gated, ②
좌표 → `EvaluationResult[]` collection bridge = cross-module/RBAC ADR)은 **둘 다
§5 BLOCKED 트리거**(Security/auth · cross-module RBAC)라 본 planner 가 임의로
큐잉하지 않는다(별도 사람 결정/ADR 선행).

대신 본 task 는 **이미 결정된 ADR 안에서, 새 dependency·새 ADR 0 인 순수/독립
slice** 를 잡는다: `SummaryBatchOutcomeReport` 가 JSDoc 으로 명시한 **불변식
(invariant)** 을 런타임에서 검증하는 순수 가드. 현재 그 불변식들은 JSDoc 주석
으로만 박제돼 있어(`summary-batch-outcome.ts` L46~83) 코드로 강제되지 않는다:

1. `evaluated + skipped === total` (전역 + 각 버킷).
2. `created + existing === evaluated` (전역 + 각 버킷).
3. `byGranularity` 4 버킷의 카운트 합 === 전역 카운트(분포 보존 invariant,
   L78 명시).

본 가드는 그 빈칸을 채운다 — report 가 위 불변식을 위반하면(예: 집계 버그·수동
조립 오류·향후 merge/diff 헬퍼의 산출 손상) **fail-fast** 로 한국어 명세형
에러를 던져 손상된 리포트가 로그·notification·관측 surface 로 새는 것을 차단한다.
향후 orchestrator/관측 layer 가 `summarizeSummaryBatchOutcome` 산출을
`formatSummaryBatchOutcome` 으로 흘려보내기 **전** 이 가드를 통과시켜 무결성을
보증하는 단언 지점으로 쓸 수 있다.

순수(부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 입력 비변형 · 동일 입력 →
동일 동작). 새 외부 dependency 0 · DB write/migration 0 · raw 미저장(R-59 — 카운트
필드만 읽고 비교, summaryId/narrative 본문 미접촉). realdata-e2e /
evaluation-adjustments stream 과 파일 disjoint 라 fineGrainedConcurrency 동시 claim
후보(touchesFiles 교집합 0). `summary-batch-outcome.ts` 변경 0 — `import type`
으로 타입만 소비, `GRANULARITY_BUCKETS` 는 T-0619 가 이미 `export` 해 둔 single
source 를 그대로 재사용한다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-outcome.ts` 전문 — 입력 타입
  `SummaryBatchOutcomeReport`(extends `SummaryBatchOutcomeCounts`:
  `total/evaluated/skipped/created/existing`) + `byGranularity:
  Record<"day"|"week"|"month"|"other", SummaryBatchOutcomeCounts>`, 그리고
  L46~83 JSDoc 의 불변식 3종(`evaluated+skipped=total` / `created+existing=evaluated`
  / 버킷합=전역). `GRANULARITY_BUCKETS = ["day","week","month","other"]` 결정적
  고정 순서 슬롯(이미 `export` 됨 — T-0619). 본 가드는 이 타입·const 를
  `import type` / `import` 로 소비(재정의 0). **변경 금지** — read·import 만.
- `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` — 동형 패턴
  참고(순수 함수 / null·undefined fail-fast 한국어 TypeError / `GRANULARITY_BUCKETS`
  single-source 순회 / 한국어 JSDoc). 본 가드는 이 파일을 import 하지 않으나
  에러 메시지·가드 관례를 mirror 한다. **변경 금지** — 패턴 참조만.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts` 신설
  — 순수 함수 1 개 박제:
  ```ts
  export function assertSummaryBatchOutcomeConsistent(
    report: SummaryBatchOutcomeReport,
  ): void;
  ```
  report 가 문서화된 불변식 3종을 모두 만족하면 아무 일도 하지 않고 정상 반환
  (void). 하나라도 위반하면 **어느 불변식·어느 스코프(전역/버킷명)** 가 깨졌는지
  명시한 한국어 에러를 던진다. JSDoc(한국어)으로 검증하는 불변식 3종과 각
  에러 조건을 single-source 박제.
- [ ] **불변식 3종 검증 박제**(코드 + JSDoc):
  - (1) `evaluated + skipped === total` — 전역 1회 + `GRANULARITY_BUCKETS` 4 버킷
    각 1회(총 5 스코프).
  - (2) `created + existing === evaluated` — 전역 1회 + 4 버킷 각 1회(총 5 스코프).
  - (3) 분포 보존: 4 버킷의 각 카운트 필드(total/evaluated/skipped/created/existing)
    합 === 전역 동일 필드(5 필드 × 합 비교). 버킷 순회는 `GRANULARITY_BUCKETS`
    single source 고정 순서만 사용(`Object.keys` 순서 의존 0).
- [ ] **에러 타입·메시지 정책**: 불변식 위반은 한국어 `RangeError`(논리적 값
  범위/정합 위반 — `TypeError` 는 구조/타입 결손에 사용) 1+ throw. 메시지에 어느
  불변식(번호 또는 식)·어느 스코프(`전역` 또는 버킷명 `day`/`week`/`month`/`other`)
  가 깨졌는지 포함(진단 가능성). silent 통과(위반인데 정상 반환) 0.
- [ ] **입력 비변형 / 순수**: `report`·`byGranularity`·하위 카운트 객체를 변형하지
  않는다(읽기·비교만). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부
  dependency 0. raw 미저장(R-59) — 카운트 필드만 읽고 비교(summaryId/narrative
  본문 미접촉). 동일 report → 동일 동작(정상 report 면 항상 정상 반환, 손상 report
  면 항상 동일 위치 throw).
- [ ] **Happy-path test 1+**: `summarizeSummaryBatchOutcome`(또는 직접 객체 리터럴)
  로 만든 **정합한** report(예: total 3, evaluated 2(created 1/existing 1), skip 1,
  버킷 분포가 전역과 일치)를 넘겨 (a) throw 0(정상 void 반환), (b) report 객체가
  호출 후 비변형(deep 동일) 검증.
- [ ] **Error path test 1+**: `report` 가 null/undefined 면 한국어 `TypeError`
  throw 1+. `report.byGranularity` 가 누락(undefined)된 불완전 객체 → 한국어
  `TypeError`(또는 명시 가드) 1+. (구조 결손 = TypeError, 값 정합 위반 = RangeError
  로 구분 — 각 분기 1+.)
- [ ] **Flow / branch 분기 cover** — 불변식 3종 위반을 각각 1+:
  - (a) `evaluated + skipped !== total` 인 report(예: 전역 evaluated 2 + skip 1 인데
    total 4) → 불변식(1) RangeError, 메시지에 `전역` + 식 등장 1+ test,
  - (b) `created + existing !== evaluated` 인 report(예: evaluated 2 인데 created 1
    + existing 0) → 불변식(2) RangeError 1+ test,
  - (c) 버킷합 !== 전역인 report(예: 전역 total 3 인데 4 버킷 total 합 2) → 불변식(3)
    RangeError, 메시지에 어느 필드/스코프 위반인지 등장 1+ test.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) 빈 batch(total 0, 전 카운트 0, byGranularity 전 버킷 0) → 모든 불변식 만족
    → throw 0(정상 반환) 1+ test,
  (2) 특정 **버킷 단위** 불변식 위반(전역은 정합하나 `week` 버킷에서
    `evaluated + skipped !== total`) → RangeError 메시지에 버킷명 `week` 등장 1+ test
    (전역만 검사하고 버킷을 건너뛰지 않음을 보증),
  (3) `other` 버킷에만 분포가 몰린 정합 report(미지원 granularity 누적) → 정합이면
    throw 0 1+ test(버킷 식별 정확성),
  (4) 큰 수(예: 전역 total 1000+, 버킷합도 1000+ 정합) → 정수 비교 정확(부동소수·
    오버플로 오판 0), 정합이면 throw 0 1+ test,
  (5) 같은 손상 report 로 2 회 호출 → 두 호출 모두 동일 위치에서 동일 메시지로 throw
    (결정성·잔여 상태 누수 0) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-outcome-consistency.spec.ts`
  신설 — 위 happy/error/branch/negative 케이스 박제. report fixture 는 직접 객체
  리터럴로 구성(단위 격리), 또는 가독성 위해 `summarizeSummaryBatchOutcome` 로
  정합 fixture 를 만든 뒤 의도적으로 카운트 1 필드만 손상시켜 위반 케이스를 구성
  해도 무방(가드 자체 단위 검증이 흐려지지 않게 분리). 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — 신규 순수 함수는 100% 달성 목표.

## Out of Scope

- **`summary-batch-outcome.ts` 의 report 구조·카운트 로직·`summarizeSummaryBatchOutcome`
  변경 금지** — 본 task 는 검증 가드만. report 필드 추가/의미 변경, 집계 로직 수정은
  별도 slice. (`GRANULARITY_BUCKETS` 는 이미 `export` 됨 — 추가 amend 0.)
- **`summarizeSummaryBatchOutcome` 산출 경로에 가드를 자동 주입(배선) 금지** — 본
  가드를 pipeline/orchestrator/formatter 안에서 호출하도록 배선하는 것은 별도
  follow-up. 본 task 는 순수 함수까지(호출처 배선 0 — 기존 파일 변경 0).
- **자동 복구 / report 정규화 금지** — 손상 report 를 고치거나 0 으로 clamp 하지
  않는다. 가드는 검증·throw 만(fail-fast). 복구는 호출처 책임.
- **JSON schema / 외부 validation 라이브러리 도입 금지** — 순수 산술 비교만. zod·
  ajv 등 새 dependency 0.
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — Q-0030 ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → EvaluationResult[]) 금지** — cross-module/RBAC ADR
  영역(§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드를 `runSummaryBatchPipeline` 또는 orchestrator service 의 report 산출 직후
  단언 지점으로 배선(무결성 보증) — 별도 slice(기존 파일 변경이라 분리).
- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

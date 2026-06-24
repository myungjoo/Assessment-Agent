---
id: T-0621
title: R-61 요약 평가 batch pipeline 에 outcome 불변식 가드 단언 지점 배선 — runSummaryBatchPipeline report 산출 직후 assertSummaryBatchOutcomeConsistent 호출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0620 가드(PR #534 970e630) 닫힌 후 그 첫 follow-up. pipeline report 산출 직후 assertSummaryBatchOutcomeConsistent 단언 배선(손상 report 누출 차단). endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-pipeline.ts
  - src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts
---

# T-0621 — R-61 요약 평가 batch pipeline 에 outcome 불변식 가드 단언 지점 배선

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 순수
layer · `@Injectable` orchestrator service · 한 줄 formatter · 불변식 검증 가드가
모두 머지됐다:

- T-0617 `runSummaryBatchPipeline`(PR #531) — plan → run → outcome 3 단계를 한
  흐름으로 엮는 순수 async pipeline. `{ plan, outcomes, report }` 반환.
- T-0620 `assertSummaryBatchOutcomeConsistent(report)`(PR #534 970e630) — report
  의 문서화된 불변식 3종(평가+skip=total / 생성+기존=평가 / 버킷합=전역)을 런타임
  fail-fast 로 검증하는 순수 가드.

지금 그 가드는 **존재하나 어디에도 호출되지 않는다** — T-0620 Out of Scope 가
"산출 경로 자동 배선 0(순수 함수까지)"으로 의도적으로 분리했고, T-0620
Follow-up 첫 항목이 본 task 다: "본 가드를 `runSummaryBatchPipeline` 또는
orchestrator service 의 report 산출 직후 단언 지점으로 배선(무결성 보증)".

본 task 는 그 빈칸을 채운다 — `runSummaryBatchPipeline` 이 `summarizeSummaryBatchOutcome`
으로 `report` 를 산출한 **직후**, 반환 전에 `assertSummaryBatchOutcomeConsistent(report)`
를 단언 지점으로 호출한다. 정상 흐름에서는 가드가 void 반환(무회귀)하고, 만약
집계 손상(미래 merge/diff 헬퍼 버그·수동 조립 오류)으로 report 불변식이 깨지면
pipeline 이 손상된 report 를 caller·로그·notification·관측 surface 로 흘려보내기
**전에** fail-fast 로 막는다. pipeline 의 단일 plan thread 가 구조적으로
plan↔outcomes index 정합을 보장하므로(T-0617 계약), 본 단언은 정상 경로에서는
절대 트리거되지 않는 안전망(방어적 단언)이며, 회귀 보호 역할을 한다.

순수성 보존 — `assertSummaryBatchOutcomeConsistent` 는 순수 가드(부수효과 0 ·
입력 비변형 · 동일 입력 → 동일 동작)이므로 pipeline 의 순수성(부수효과 0 ·
`@Injectable` 0 · Prisma 0 · LLM 0 · DB write 0)을 깨지 않는다. 새 외부 dependency
0 · DB write/migration 0 · raw 미저장(R-59). p5-summary-aggregate stream 내부 wiring
이며, realdata-e2e / evaluation-adjustments stream 과 파일 disjoint
(touchesFiles 교집합 0). endpoint(Q-0030 RBAC) / collection bridge(cross-module
RBAC) 같은 §5 ADR-gated BLOCKED 영역은 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` 전문 — 배선 대상.
  `runSummaryBatchPipeline(input)` 의 (3) 단계
  (`const report = summarizeSummaryBatchOutcome(plan, outcomes);`) 직후, `return
  { plan, outcomes, report };` 전에 가드 호출을 삽입한다. JSDoc 의 실패 전파 계약·
  순수성 서술과 정합하게 본 단언 배선을 JSDoc 에 한 줄 반영.
- `src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts` — import
  대상 가드. `export function assertSummaryBatchOutcomeConsistent(report:
  SummaryBatchOutcomeReport): void;` 시그니처·에러 정책(구조 결손 TypeError / 값
  정합 위반 RangeError) 확인. **변경 금지** — import·호출만.
- `src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts` — 기존 pipeline
  spec. 본 task 는 여기에 단언 배선 검증 케이스를 추가한다(기존 케이스 무회귀 유지).

## Acceptance Criteria

- [ ] `summary-batch-pipeline.ts` 의 `runSummaryBatchPipeline` 본문에서
  `summarizeSummaryBatchOutcome` 으로 `report` 를 산출한 **직후**, `return` 전에
  `assertSummaryBatchOutcomeConsistent(report)` 를 호출하는 한 줄(+ 한국어 주석)을
  삽입한다. import 문 1줄 추가
  (`import { assertSummaryBatchOutcomeConsistent } from "./summary-batch-outcome-consistency";`).
  단언 호출은 void(무회귀) — 정상 report 면 흐름이 그대로 `return` 으로 이어진다.
- [ ] JSDoc 갱신 — `runSummaryBatchPipeline` 의 JSDoc(또는 (3) 단계 인라인 주석)에
  "report 산출 직후 `assertSummaryBatchOutcomeConsistent` 로 불변식 단언(손상 report
  누출 차단, 정상 경로 무회귀)" 한 문장 박제. `@throws` 절에 가드가 던질 수 있는
  `RangeError`(불변식 위반) / `TypeError`(report 구조 결손) 전파를 한 줄 추가.
- [ ] **순수성 보존** — pipeline 은 여전히 부수효과 0 · `@Injectable` 0 · Prisma 0 ·
  LLM 0 · DB write 0. 가드는 순수 검증이므로 입력 비변형·결정성 계약 유지. 새 외부
  dependency 0 · migration 0 · raw 미저장(R-59).
- [ ] **Happy-path test 1+**: 정합한 입력(coordinates + results map + 결정적 evaluator
  + now)으로 `runSummaryBatchPipeline` 을 호출 시 (a) throw 0(정상 `{ plan, outcomes,
  report }` 반환), (b) 반환 report 가 `assertSummaryBatchOutcomeConsistent` 를 통과
  하는 정합 report 임을 검증(기존 happy 케이스 무회귀 보장 + 단언 통과 확인).
- [ ] **Error path test 1+**: 단언이 실제로 호출됨을 검증 — `summarizeSummaryBatchOutcome`
  또는 `assertSummaryBatchOutcomeConsistent` 를 `jest.spyOn` 으로 가로채(또는 jest
  module mock) (a) report 산출 직후 가드가 정확히 1회 호출됨, (b) 가드가 throw 하면
  그 error 가 pipeline 밖으로 그대로 전파됨(swallow 0)을 검증. 정상 경로에서는 가드
  호출이 실제 `report` 인자로 이뤄짐을 확인.
- [ ] **Flow / branch 분기 cover** — 단언 호출 위치 정합:
  - (a) evaluator 가 정상 resolve → 가드 호출 1회 + 정상 반환,
  - (b) evaluator 가 reject → (2) 단계에서 즉시 전파, (3) report 산출·가드 호출 **미도달**
    (가드 호출 0 — 부분 성공 리포트 위장 0). spy 로 가드 미호출 검증 1+.
  (분기 없음 항목은 생략 가능 — 위 2 분기는 await 전파 경계를 cover.)
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) `coordinates` 빈 배열 → 빈 plan/outcomes + 전 카운트 0 report → 가드 통과(빈
    batch 불변식 만족) → throw 0 1+ test,
  (2) `input` null/undefined → pipeline 자체 가드 TypeError(가드 미도달, 기존 계약
    무회귀) 1+ test,
  (3) 가드가 RangeError throw(주입한 손상 report 시뮬레이션 — spy 로
    `assertSummaryBatchOutcomeConsistent` 가 RangeError throw 하도록 설정) → pipeline
    이 그 RangeError 를 그대로 reject 전파 1+ test,
  (4) 정상 경로에서 입력 배열·map·now 비변형(가드 추가가 입력을 변형하지 않음) deep
    동일성 1+ test,
  (5) 같은 정합 입력 2회 호출 → 두 호출 모두 정상 반환·가드 통과(결정성·잔여 상태
    누수 0) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts`
  에 위 happy/error/branch/negative 케이스 추가 — 기존 케이스 무회귀 유지. report
  fixture·evaluator 는 mock 함수/객체 리터럴로 단위 격리. 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — pipeline 변경분·신규 분기 cover.

## Out of Scope

- **`summary-batch-outcome-consistency.ts` 변경 금지** — 본 task 는 가드를 호출(배선)만.
  가드 로직·에러 정책 수정은 별도 slice. (T-0620 가 이미 머지·검증됨.)
- **`summarizeSummaryBatchOutcome` / report 구조 / 카운트 로직 변경 금지** — 본 task 는
  pipeline 의 단언 배선만. report 의미 변경은 별도 slice.
- **orchestrator service(`SummaryBatchOrchestratorService`) 변경 금지** — 본 task 는
  순수 pipeline 단계에만 단언을 배선한다. service 경계 추가 단언은 (필요 시) 별도
  follow-up. pipeline 이 무결성 보증 지점이면 service 는 pipeline 위임만으로 충분.
- **자동 복구 / report 정규화 금지** — 손상 report 를 고치거나 clamp 하지 않는다
  (fail-fast). 가드가 throw 하면 그대로 전파.
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — Q-0030 ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → EvaluationResult[]) 금지** — cross-module/RBAC ADR
  영역(§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (선택) `SummaryBatchOrchestratorService` 산출 경로에도 동일 단언이 필요한지 검토 —
  pipeline 이 이미 단언 지점이면 service 는 위임만으로 무결성 상속(별도 task 불요
  가능성). 필요 판단 시 별도 slice.
- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

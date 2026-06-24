---
id: T-0623
title: R-61 요약 평가 batch orchestrator service 가 pipeline summaryLine 을 service 경계까지 외화함을 박제 — JSDoc/주석 drift 정정 + service-경계 summaryLine 통과 검증
phase: P5
status: DONE
completedAt: 2026-06-24T05:48:04Z
result: "PR #537 squash merge b49b1d2 — reviewer r1 APPROVE, 4-게이트 PASS, CI green. service 클래스 주석/evaluateBatch JSDoc 의 3산출→4산출(summaryLine 포함) drift 정정 + service-경계 summaryLine byte-identical 통과 검증 5케이스 추가. 코드 동작 변경 0(+9/-2 주석/JSDoc + spec). 새 dep 0·migration 0."
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0622(PR #536)가 pipeline 에 summaryLine 부착 후 service 는 자동 상속하나 JSDoc/주석이 여전히 '3 산출'로 drift + spec 미검증. service-경계 summaryLine 통과 박제. endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0623 — R-61 요약 평가 batch orchestrator service 의 summaryLine service-경계 외화 박제

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. T-0622(PR #536)가
`runSummaryBatchPipeline` 의 산출에 사람-친화 한 줄 요약 `summaryLine: string` 을
부착해 pipeline 산출이 `{ plan, outcomes, report, summaryLine }` 4 필드로 닫혔다.

`SummaryBatchOrchestratorService`(T-0618)는 `SummaryBatchPipelineResult` 타입을
re-export 하고 `runSummaryBatchPipeline` 산출을 가공 없이 그대로 반환하므로,
T-0622 가 pipeline result 에 `summaryLine` 을 추가하면서 service caller 도 코드
변경 0 으로 **자동으로** 새 필드를 상속한다(이게 T-0622 의 의도된 설계). 그러나
이 자동 상속에는 두 가지 잔여 drift 가 남는다:

1. **JSDoc / 주석 drift** — `summary-batch-orchestrator.service.ts` 의 클래스
   머리말 주석(L1~43)과 `evaluateBatch` JSDoc 의 `@returns` 절(L116)이 여전히
   "pipeline 의 `{ plan, outcomes, report }` 3 산출을 가공 없이 그대로 노출" 로
   적혀 있다. 실제 반환 surface 는 4 필드(`summaryLine` 포함)인데 문서가 3 필드만
   서술 — 코드와 문서가 어긋나 있다(grep `summaryLine` src/ 가 service 파일을
   매치하지 않음 = service 가 이 산출을 문서로 인지 박제하지 않은 상태).
2. **service-경계 검증 공백** — `summary-batch-orchestrator.service.spec.ts` 의
   기존 케이스(L122 등)는 `const { plan, outcomes, report } = await
   service.evaluateBatch(...)` 로 3 필드만 destructure 해 검증한다. service 가
   pipeline 의 `summaryLine` 을 **service 경계까지 변형 없이 통과**시킴을 검증하는
   테스트가 없다. 자동 상속이 의도대로 동작함(presentation 산출이 service caller
   에게도 도달함)을 박제하는 단언이 비어 있다.

본 task 는 이 두 잔여를 닫는다 — (1) 코드 동작 변경 0 으로 클래스 주석/JSDoc 의
"3 산출"을 "4 산출(`summaryLine` 포함, presentation 산출이 service 경계까지 자동
상속)" 로 정정하고, (2) service spec 에 "service.evaluateBatch 반환에
`summaryLine` 이 존재하며 string·비어있지 않은 값이고 반환된 report 를 직접
`formatSummaryBatchOutcome` 한 것과 byte-identical(= pipeline 이 산출한 그
summaryLine 을 service 가 변형 없이 통과)임" 을 검증하는 케이스를 추가한다.

T-0622 가 pipeline 산출 지점에 presentation 산출을 배선했다면, 본 task 는 그
산출이 **service 진입점까지 누수 없이 도달함을 문서·테스트로 박제**한다 — 이로써
"순수 pipeline → service 경계" 사이에서 summaryLine 이 사라지지 않음이 회귀
보호된다(향후 service 가 가공을 추가하면 본 테스트가 깨져 의도적 변경을 강제).

순수성·책임 보존 — service 는 여전히 직접 부수효과 0 · 새 외부 dependency 0 ·
Prisma 0 · migration 0. `summaryLine` 산출은 pipeline 내부 책임이고 service 는
그것을 변형 없이 노출만 한다(재구현 0 · 가공 0). raw 미저장(R-59 — report
카운트 렌더만, summaryId/narrative 본문 미접촉). p5-summary-aggregate stream
내부 wiring 이며 realdata-e2e / evaluation-adjustments stream 과 파일
disjoint(touchesFiles 교집합 0). endpoint(Q-0030 RBAC) / collection
bridge(cross-module RBAC) 같은 §5 ADR-gated BLOCKED 영역은 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` 전문 — 정정
  대상. 클래스 머리말 주석(L1~43, 특히 "산출(plan/outcomes/report)을 변형 없이
  묶기만 한다" L28~30)과 `evaluateBatch` JSDoc 의 `@returns` 절(L116 "pipeline 의
  `{ plan, outcomes, report }` 3 산출을 가공 없이 그대로 노출")을 4 산출
  서술로 정정한다. **코드(메서드 본문 L119~140) 변경 금지** — 주석/JSDoc 만 정정.
- `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts` 전문 —
  본 task 가 여기에 summaryLine service-경계 통과 검증 케이스를 추가한다. 기존
  케이스(happy/error/branch/negative/DI)는 무회귀 유지. 검증에
  `formatSummaryBatchOutcome` import 가 필요하다.
- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` L93~106 +
  L214~222 — `SummaryBatchPipelineResult` 의 `summaryLine` 필드 의미와
  pipeline 이 가드 통과 report 를 `formatSummaryBatchOutcome` 으로 산출함을
  확인(service 가 이를 그대로 통과시킴을 검증하기 위한 기준). **변경 금지** —
  read-only 참조.
- `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` —
  `formatSummaryBatchOutcome(report: SummaryBatchOutcomeReport): string` 시그니처
  확인(spec 의 byte-identical 검증에 import). **변경 금지** — import·호출만.

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 의 클래스 머리말 주석에서
  "산출(plan/outcomes/report)을 변형 없이 묶기만 한다" 류 서술을 "산출(plan/
  outcomes/report/summaryLine)" 로 정정하고, `summaryLine`(report 의 사람-친화
  결정적 한국어 단일 라인 요약)이 pipeline 산출이며 service 가 변형 없이 그대로
  노출함을 한 문장 박제한다. 코드 동작 변경 0.
- [ ] `evaluateBatch` JSDoc 의 `@returns` 절을 "pipeline 의 `{ plan, outcomes,
  report, summaryLine }` 4 산출을 가공 없이 그대로 노출(`summaryLine` = report
  의 사람-친화 한 줄 요약, pipeline 이 `formatSummaryBatchOutcome` 으로 산출 —
  service 변형 0)" 로 정정한다. 메서드 본문(`return runSummaryBatchPipeline({...})`)
  변경 0.
- [ ] **코드 동작 무변경 보증** — `evaluateBatch` 메서드 본문 · 생성자 · DI ·
  import 대상(spec 외)은 변경 0. 본 task 의 src 변경은 **주석/JSDoc 문자열 정정만**.
  새 외부 dependency 0 · Prisma 0 · migration 0 · 부수효과 0 · raw 미저장(R-59).
- [ ] **Happy-path test 1+**: 정합한 입력(coordinates + results map + 결정적
  orchestrator mock + now)으로 `service.evaluateBatch` 호출 시 반환 객체에서
  (a) `summaryLine` 필드가 존재하고 string 타입 비어있지 않은 값이며, (b)
  `summaryLine === formatSummaryBatchOutcome(report)`(반환된 report 를 직접
  format 한 것과 byte-identical = service 가 pipeline summaryLine 을 변형 없이
  통과)임을 검증. 기존 happy 케이스(L90~153) 무회귀.
- [ ] **Error path test 1+**: orchestrator mock 이 reject/throw 시 service 가 그
  error 를 그대로 전파(swallow 0)하며 `summaryLine` 을 포함한 부분 결과를 반환하지
  **않음**(reject 전파 — report·format 미도달)을 검증. (기존 error 케이스가 이미
  reject 전파를 cover 하나, 본 항목은 "summaryLine 부분 결과 위장 0" 관점을
  명시 — 기존 케이스 재사용 또는 1 케이스 추가로 충족 가능.)
- [ ] **Flow / branch 분기 cover**:
  - (a) evaluator 정상 resolve → report 산출 → `summaryLine` 부착된 정상 반환
    (summaryLine 존재 + byte-identical),
  - (b) coordinates 빈 배열 → 빈 plan/outcomes + 전 카운트 0 report → `summaryLine`
    이 빈 batch 요약 문자열(throw 0, string 비어있지 않음)을 service 경계까지
    통과함을 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) coordinates 빈 배열 → 빈 batch `summaryLine`(throw 0, string 비어있지 않음)
    service 경계 통과 1+ test,
  (2) orchestrator reject → service 가 그 error 그대로 전파 + summaryLine 포함
    부분 결과 미반환 1+ test,
  (3) 같은 service 인스턴스로 정합 입력 2회 호출 → 두 호출 모두 동일
    `summaryLine`(결정성 · byte-identical · 호출 간 잔여 상태 누수 0) 1+ test,
  (4) 좌표 원소 무결성 위반(personId 누락) → 하위 pipeline TypeError 전파 +
    summaryLine 미반환(좌표 단계 fail-fast) 1+ test,
  (5) 정상 경로에서 입력 coordinates 배열 · map · now 비변형(summaryLine 외화가
    입력을 변형하지 않음) 1+ test (기존 (2) 케이스 확장 또는 재사용 가능).
- [ ] colocated spec `summary-batch-orchestrator.service.spec.ts` 에 위
  happy/error/branch/negative 케이스 추가 — 기존 케이스 무회귀 유지.
  `formatSummaryBatchOutcome` import 추가. orchestrator 는 `{ evaluateAndPersist:
  jest.fn() }` mock 주입 · 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — service 변경분(주석만이라 신규 분기 0) +
  신규 spec 케이스 cover.

## Out of Scope

- **`summary-batch-orchestrator.service.ts` 메서드 본문 / 생성자 / DI 변경 금지** —
  본 task 는 주석/JSDoc 정정 + spec 케이스 추가만. service 가 `summaryLine` 을
  가공·재계산하는 로직 추가 금지(pipeline 이 산출한 그대로 통과만).
- **`summary-batch-pipeline.ts` / `summary-batch-outcome-format.ts` 변경 금지** —
  read-only 참조·import 만. summaryLine 산출 로직·formatter 변경은 별도 slice.
- **로그 / notification 실배선 금지** — 본 task 는 service 가 `summaryLine` 을
  노출함을 박제만. 실제 logger·notification surface 로 흘려보내는 부수효과 배선은
  별도 slice(부수효과 도입 → §5 재검토).
- **manual-trigger HTTP endpoint / controller / DTO / RBAC 금지** — Q-0030
  ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → EvaluationResult[]) 금지** — cross-module/RBAC ADR
  영역(§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (선택) `summaryLine` 을 실 logger/journal/notification surface 로 흘려보내는
  부수효과 배선 — 부수효과 도입이라 service 순수성 밖. 별도 slice(필요 시 §5 재검토).
- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

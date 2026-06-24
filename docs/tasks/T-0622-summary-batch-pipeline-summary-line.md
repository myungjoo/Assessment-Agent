---
id: T-0622
title: R-61 요약 평가 batch pipeline 산출에 사람-친화 한 줄 요약 배선 — runSummaryBatchPipeline report 산출 직후 formatSummaryBatchOutcome 으로 summaryLine 부착
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 — T-0621 가드 배선 닫힌 후 그 다음 wiring 조각. T-0619 formatter(PR #533)가 정의됐으나 미호출 — pipeline report 직후 summaryLine 부착(로그/notification surface 가 직접 소비). endpoint/collection bridge §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-pipeline.ts
  - src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts
---

# T-0622 — R-61 요약 평가 batch pipeline 산출에 사람-친화 한 줄 요약 배선

## Why

PLAN 97행(R-61) — **일/주/월 요약 평가**. p5-summary-aggregate stream 의 순수
layer · `@Injectable` orchestrator service · 한 줄 formatter · 불변식 가드 · 그
가드의 pipeline 배선(T-0621, PR #535)이 모두 머지됐다:

- T-0617 `runSummaryBatchPipeline`(PR #531) — plan → run → outcome 순수 async
  pipeline. `{ plan, outcomes, report }` 반환.
- T-0619 `formatSummaryBatchOutcome(report)`(PR #533 8420ae4) — report 를 로그·
  journal·notification surface 가 흘려보낼 **결정적 한국어 단일 라인 문자열**로
  렌더하는 순수 formatter.
- T-0621(PR #535) — `assertSummaryBatchOutcomeConsistent(report)` 를 pipeline 의
  report 산출 직후 단언 지점으로 배선(손상 report 누출 차단).

그런데 T-0619 `formatSummaryBatchOutcome` 은 **정의·검증만 됐고 어디에서도
호출되지 않는다** — `grep formatSummaryBatchOutcome src/` 가 자기 자신과 spec 두
파일만 매치한다. 이는 T-0621 직전 가드가 처해 있던 것과 동일한 "exists-but-unwired"
공백이다. 현재 pipeline 산출 `{ plan, outcomes, report }` 을 받은 caller(향후
orchestrator·로그·notification·관측 surface)가 사람-친화 요약을 얻으려면 매번 손으로
`formatSummaryBatchOutcome(report)` 를 호출해야 한다.

본 task 는 그 빈칸을 채운다 — `runSummaryBatchPipeline` 이 report 를 산출하고
T-0621 가드를 통과시킨 **직후**, 반환 전에 `formatSummaryBatchOutcome(report)` 로
사람-친화 한 줄 요약을 계산해 산출 객체에 `summaryLine: string` 필드로 부착한다.
caller 는 별도 import·호출 없이 pipeline 산출 하나로 `{ plan, outcomes, report,
summaryLine }` 을 받아 로그/journal/notification surface 로 바로 흘려보낼 수 있다
(presentation 누수가 단일 pipeline 산출로 원천 정리). T-0621 가 무결성 보증 지점을
배선했듯, 본 task 는 presentation 산출 지점을 배선한다 — 두 wiring 이 pipeline 을
"무결성 검증 + 사람-친화 요약을 모두 마친 완결된 batch 산출지"로 만든다.

순수성 보존 — `formatSummaryBatchOutcome` 은 순수 formatter(부수효과 0 · 입력
비변형 · 동일 report → byte-identical 문자열)이므로 pipeline 의 순수성(부수효과 0 ·
`@Injectable` 0 · Prisma 0 · LLM 0 · DB write 0)을 깨지 않는다. 새 외부 dependency
0 · DB write/migration 0 · raw 미저장(R-59 — report 카운트만 렌더, summaryId/narrative
본문 미접촉). p5-summary-aggregate stream 내부 wiring 이며, realdata-e2e /
evaluation-adjustments stream 과 파일 disjoint(touchesFiles 교집합 0).
endpoint(Q-0030 RBAC) / collection bridge(cross-module RBAC) 같은 §5 ADR-gated
BLOCKED 영역은 건드리지 않는다.

`SummaryBatchOrchestratorService`(T-0618)는 `SummaryBatchPipelineResult` 타입을
re-export 하고 pipeline 산출을 가공 없이 그대로 반환하므로, 본 task 가 pipeline
result 인터페이스에 `summaryLine` 을 추가하면 service caller 도 코드 변경 0 으로
자동으로 새 필드를 얻는다(service 파일 변경 0 — Out of Scope).

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` 전문 — 배선 대상.
  `SummaryBatchPipelineResult` 인터페이스(`{ plan, outcomes, report }`)에
  `summaryLine: string` 필드 1개를 추가하고, `runSummaryBatchPipeline` 본문에서
  `assertSummaryBatchOutcomeConsistent(report)` (4단계) **직후** ·
  `return { plan, outcomes, report }` 전에 `formatSummaryBatchOutcome(report)` 로
  요약을 계산해 반환 객체에 부착한다. import 1줄 + 계산 1줄 + 반환 객체 1필드
  + JSDoc/인터페이스 주석 갱신.
- `src/assessment-evaluation/domain/summary-batch-outcome-format.ts` — import 대상
  formatter. `export function formatSummaryBatchOutcome(report:
  SummaryBatchOutcomeReport): string;` 시그니처·결정성·입력 비변형·null/undefined
  fail-fast(한국어 TypeError) 확인. **변경 금지** — import·호출만.
- `src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts` — 기존 pipeline
  spec. 본 task 는 여기에 summaryLine 부착 검증 케이스를 추가한다(기존 케이스
  무회귀 유지).

## Acceptance Criteria

- [ ] `summary-batch-pipeline.ts` 의 `SummaryBatchPipelineResult` 인터페이스에
  `summaryLine: string` 필드 1개를 추가한다(한국어 주석 — "report 의 사람-친화
  결정적 한국어 단일 라인 요약. 로그·journal·notification surface 가 그대로
  흘려보내는 presentation 산출"). 기존 `plan`/`outcomes`/`report` 필드 의미 변경 0.
- [ ] `runSummaryBatchPipeline` 본문에서 `assertSummaryBatchOutcomeConsistent(report)`
  호출 **직후** · `return` 전에 `formatSummaryBatchOutcome(report)` 로
  `summaryLine` 을 계산하고 반환 객체에 부착한다(`return { plan, outcomes, report,
  summaryLine };`). import 문 1줄 추가(`import { formatSummaryBatchOutcome } from
  "./summary-batch-outcome-format";`). 가드를 통과한 report 만 format 하므로
  손상 report 의 요약 렌더링 위장 0(가드가 먼저 throw 하면 format 미도달).
- [ ] JSDoc 갱신 — `runSummaryBatchPipeline` JSDoc(또는 인라인 주석)에 "(5) 가드
  통과 직후 `formatSummaryBatchOutcome` 으로 사람-친화 한 줄 요약을 산출해
  `summaryLine` 으로 부착(로그/notification surface 직접 소비, presentation 누수
  차단)" 한 문장 박제. `@returns` 절을 `{ plan, outcomes, report, summaryLine }` 로
  갱신.
- [ ] **순수성 보존** — pipeline 은 여전히 부수효과 0 · `@Injectable` 0 · Prisma 0 ·
  LLM 0 · DB write 0. formatter 는 순수 렌더이므로 입력 비변형·결정성 계약 유지.
  새 외부 dependency 0 · migration 0 · raw 미저장(R-59 — 카운트만 렌더).
- [ ] **Happy-path test 1+**: 정합한 입력(coordinates + results map + 결정적
  evaluator + now)으로 `runSummaryBatchPipeline` 을 호출 시 (a) throw 0(정상
  `{ plan, outcomes, report, summaryLine }` 반환), (b) `summaryLine` 이 string 타입
  비어있지 않은 값이며, (c) `summaryLine` === `formatSummaryBatchOutcome(report)`
  (반환된 report 를 직접 format 한 것과 byte-identical — pipeline 이 동일 report 로
  format 했음을 보장)임을 검증. 기존 happy 케이스 무회귀.
- [ ] **Error path test 1+**: format 이 가드 **이후** 호출됨을 검증 —
  `jest.spyOn`(또는 module mock)으로 `assertSummaryBatchOutcomeConsistent` 가 throw
  하도록 설정 시 (a) `formatSummaryBatchOutcome` 가 호출되지 **않음**(가드 throw 가
  format 보다 먼저 — 손상 report format 위장 0), (b) 가드 error 가 pipeline 밖으로
  그대로 전파됨(swallow 0)을 검증. 또는 `formatSummaryBatchOutcome` spy 가 throw 시
  그 error 가 pipeline 밖으로 전파됨 1+.
- [ ] **Flow / branch 분기 cover** — format 호출 위치 정합:
  - (a) evaluator 정상 resolve → 가드 통과 → format 1회 호출 + `summaryLine` 부착된
    정상 반환,
  - (b) evaluator reject → (2) 단계에서 즉시 전파, (3)/(4)/(5) report·가드·format
    **미도달**(format 호출 0 — 부분 성공 요약 위장 0). spy 로 format 미호출 검증 1+.
  (위 2 분기는 await 전파 경계 + 가드/format 순서를 cover.)
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) `coordinates` 빈 배열 → 빈 plan/outcomes + 전 카운트 0 report → 가드 통과 →
    format 이 빈 batch 요약 문자열 산출(throw 0, `summaryLine` 비어있지 않은 string)
    1+ test,
  (2) `input` null/undefined → pipeline 자체 가드 TypeError(report·가드·format
    미도달, 기존 계약 무회귀) 1+ test,
  (3) format spy 가 throw(예: 주입한 손상 시뮬레이션) → pipeline 이 그 error 를
    그대로 reject 전파(swallow 0) 1+ test,
  (4) 정상 경로에서 입력 배열·map·now 비변형(summaryLine 부착이 입력을 변형하지
    않음) deep 동일성 1+ test,
  (5) 같은 정합 입력 2회 호출 → 두 호출 모두 동일 `summaryLine`(결정성·byte-identical·
    잔여 상태 누수 0) 1+ test.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-pipeline.spec.ts`
  에 위 happy/error/branch/negative 케이스 추가 — 기존 케이스 무회귀 유지. report
  fixture·evaluator 는 mock 함수/객체 리터럴로 단위 격리. 실 LLM/DB/Prisma 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%) — pipeline 변경분·신규 분기 cover.

## Out of Scope

- **`summary-batch-outcome-format.ts` 변경 금지** — 본 task 는 formatter 를 호출(배선)만.
  formatter 문구·로직 수정은 별도 slice. (T-0619 가 이미 머지·검증됨.)
- **`summarizeSummaryBatchOutcome` / `assertSummaryBatchOutcomeConsistent` / report
  구조 변경 금지** — 본 task 는 pipeline 의 format 배선만. report 의미·가드 정책
  변경은 별도 slice.
- **orchestrator service(`SummaryBatchOrchestratorService`) 변경 금지** — service 는
  `SummaryBatchPipelineResult` 를 re-export 하고 pipeline 산출을 그대로 반환하므로
  본 task 가 pipeline result 에 `summaryLine` 을 추가하면 service caller 도 코드
  변경 0 으로 자동 상속한다(service 파일 touch 0). service 경계 추가 가공이 필요하면
  별도 follow-up.
- **로그 / notification 실배선 금지** — 본 task 는 `summaryLine` 산출 지점까지만.
  실제 logger·notification surface 에 흘려보내는 부수효과 배선은 별도 slice(부수효과
  도입 → §5 재검토).
- **manual-trigger HTTP endpoint / DTO / RBAC 금지** — Q-0030 ADR-gated(§5 BLOCKED).
- **collection bridge(좌표 → EvaluationResult[]) 금지** — cross-module/RBAC ADR
  영역(§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (선택) `summaryLine` 을 실 logger/journal/notification surface 로 흘려보내는 부수효과
  배선 — 부수효과 도입이라 pipeline 순수성 밖. 별도 slice(필요 시 §5 재검토).
- 후속 slice: manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first)
  — **§5 BLOCKED 트리거, 사람 결정/ADR 선행 필요**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5
  BLOCKED 트리거**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

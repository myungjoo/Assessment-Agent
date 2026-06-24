---
id: T-0639
title: R-61 요약 batch 합본 리포트 2번째 라인의 outcome 형태 가드를 formatSummaryBatchReport 결과 라인 합성 직전에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0638(PR #552 fcd38e3)이 deferred 한 wiring: outcome-shape 가드(assertSummaryBatchOutcomeFormatShape) 정의·검증만 됐고 산출 지점 미배선. T-0637 plan-line mirror — formatSummaryBatchReport 2번째 라인(result.summaryLine) 합성 직전에 단언 배선. report-shape 가드(T-0633)는 블록 외형만 검증 → outcome 라인 6 불변식 미보호. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-report-format.ts
  - src/assessment-evaluation/domain/summary-batch-report-format.spec.ts
---

# T-0639 — R-61 요약 batch 합본 리포트 2번째 라인의 outcome 형태 가드를 formatSummaryBatchReport 결과 라인 합성 직전에 배선

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". T-0638(PR #552 squash fcd38e3)이 순수 가드 `assertSummaryBatchOutcomeFormatShape(line: string): void`(outcome 한 줄 요약 라인의 형태 불변식 — 개행 0 · prefix `요약 평가 batch: 총 ` · 카운트 토큰 · `[day · week · month · other]` 4 버킷 슬롯)를 정의·검증했으나, 그 Out of Scope·Follow-ups (a) 에서 **산출 지점(합본 formatter `formatSummaryBatchReport` 2번째 라인 · service 경계) 배선을 명시적으로 deferred** 했다("가드 정의·검증까지만 — 산출 경로 안에서 본 가드 자동 호출 0"). 즉 가드는 main 에 존재하되 아무 production site 에서도 호출되지 않는다(`git grep assertSummaryBatchOutcomeFormatShape` → 자체 정의 파일 외 0 hit).

`formatSummaryBatchReport(roster, result)`(T-0630)는 합본 리포트의 2번째 라인을 `${RESULT_LABEL}${result.summaryLine}`(summary-batch-report-format.ts:162)로 산출한다 — 즉 `formatSummaryBatchOutcome`(T-0622)이 이미 렌더한 outcome 한 줄(`result.summaryLine`)을 가공 0 으로 재사용한다. 그러나 formatter 가 이 라인에 대해 수행하는 검증은 L129 의 `typeof result.summaryLine !== "string"` 단순 타입 가드뿐이다 — 그 라인 **안의** 형태 불변식(개행 0 · prefix `요약 평가 batch: 총 ` · `평가 `/`(생성 `/` / 기존 `/`· skip ` 카운트 토큰 · `[day · week · month · other]` 4 버킷 슬롯 고정 순서)은 검증하지 않는다. T-0634 가 service `reportBatch` 에 배선한 `assertSummaryBatchReportShape`(T-0633)는 합본 2-라인 블록의 **외형**(2 라인 · 라벨 prefix · 단일 개행 · 후행 개행 0)만 검증하고 2번째 라인 내부 outcome 6 불변식은 검증하지 않는다(책임 경계 분리). 따라서 outcome 라인 산출 단계의 미래 회귀(prefix drift · 카운트 토큰 누락 · 버킷 슬롯 누락·순서 뒤바뀜 · 개행 혼입 · 빈 라인 위장)는 모든 기존 가드를 통과해 합본 리포트 2번째 라인·로그·journal 로 **silent leak** 할 수 있다.

본 task 는 그 잔여를 닫는다 — `formatSummaryBatchReport` 가 `${RESULT_LABEL}${result.summaryLine}` 합성 **직전**에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언을 배선해, outcome 라인 형태가 깨졌으면 합본 리포트가 만들어지기 전 fail-fast 차단한다. 이는 T-0637(합본 1번째 plan 라인에 `assertSummaryBatchRosterPlanShape` 배선)의 **정확한 outcome-side mirror** 다 — 같은 도메인 합본 formatter 안의 다른 산출 지점(2번째 라인)이 대상이고, 가드만 plan-shape → outcome-shape 로 다르다. service `reportBatch` 는 이미 `formatSummaryBatchReport` 에 위임하므로(별도 outcome 가드 직접 배선 불필요 — T-0637 이 service 를 중복 배선하지 않은 것과 동형) formatter 1 지점 배선으로 service 경로까지 보호된다. 본 task 닫히면 p5-summary-aggregate stream 의 두 표현 라인(plan · outcome)이 **정의·검증 + 모든 산출 지점 배선**까지 모두 완결된다.

## Required Reading

- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — `formatSummaryBatchReport`(L117~166) 의 L162 `const resultLine = ${RESULT_LABEL}${result.summaryLine}`. 본 task 는 `result.summaryLine` 의 형태를 `${RESULT_LABEL}` prepend·합성 **전**에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 로 단언하도록 배선(L162 직전). import 블록(L56~59)에 가드 import 1줄 추가. 함수 JSDoc(L70~116) 의 `@throws` 에 `assertSummaryBatchOutcomeFormatShape` 의 RangeError(outcome 라인 형태 위반)·TypeError(구조 결손) 한 줄 보강. **bare `result.summaryLine` 에 단언(RESULT_LABEL 부착 전)** — outcome-shape 가드의 prefix 불변식 ③ 은 bare outcome 라인이 `요약 평가 batch: 총 ` 으로 시작함을 요구하므로 `결과: 요약 평가 batch: ...` 합성 후 단언은 prefix 불일치 false-positive throw → 라벨 부착 전 단언 필수(T-0637 의 bare plan 라인 단언과 동형). 기존 L129 의 `typeof result.summaryLine !== "string"` TypeError 가드는 outcome-shape 가드의 ① 타입 검사와 중복이나 — 기존 한국어 메시지·동작 보존 위해 그대로 두고(L129 가드는 본 가드 호출 전 단계에서 이미 string 임을 보장), 본 가드는 string 형태 불변식(②~⑤)을 추가 검증. 만약 L129 가드를 outcome-shape 가드로 흡수하면 기존 spec 의 한국어 TypeError 메시지 회귀 → **L129 가드 본문 변경 0**(import + 가드 호출 1줄 + JSDoc 만).
- [src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts) — T-0638 `assertSummaryBatchOutcomeFormatShape(line: string): void` 의 throw 계약(구조 결손=한국어 TypeError / 형태 위반=한국어 RangeError 구분, 정상 형태=void·비변형) — 본 배선이 호출할 가드(본문 변경 0, import 만).
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts) — **참조만**: T-0637 이 `formatSummaryBatchReport` 1번째 라인(plan)에 동형 패턴으로 배선한 형태 가드. 본 task 는 그 wiring 패턴(bare 산출에 단언 → 라벨 부착 전 → 합성)을 mirror 하되 대상이 plan 라인이 아니라 outcome 라인이다.
- [src/assessment-evaluation/domain/summary-batch-report-format.spec.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.spec.ts) — 기존 happy/error/branch/negative describe 블록. 본 task 가 outcome 가드 호출 배선 케이스를 append 할 colocated spec. T-0637 이 append 한 plan-shape 가드-배선 spec 구조(가드 호출 1회 검증 · 정상 통과 위임 · throw 전파 · 호출 순서: bare summaryLine → assertOutcomeFormatShape → RESULT_LABEL prepend·합성)를 mirror.

## Acceptance Criteria

- [ ] `summary-batch-report-format.ts` 의 `formatSummaryBatchReport` 가 `${RESULT_LABEL}${result.summaryLine}`(L162) 합성 **직전**에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언을 호출하도록 배선 — import 1줄 + 단언 호출 1줄 + JSDoc `@throws` 갱신. 정상 형태면 가드 void 반환 후 기존과 byte-identical 한 합본 리포트(`${PLAN_LABEL}${plan}\n${RESULT_LABEL}${result.summaryLine}`)를 반환(동작 무회귀), 위반 형태면 가드 RangeError/TypeError 가 그대로 전파(합본 리포트 합성·반환 도달 전 차단).
- [ ] **bare `result.summaryLine` 에 단언(라벨 부착 전)** — `assertSummaryBatchOutcomeFormatShape` 는 `result.summaryLine`(bare outcome 라인)에 호출해야 한다(가드의 prefix 불변식 ③ `요약 평가 batch: 총 ` 는 bare outcome 라인 기준). `${RESULT_LABEL}${...}` 합성 결과(`결과: 요약 평가 batch: ...`)에 단언하면 prefix 불일치 false-positive throw → 금지.
- [ ] **기존 L129 타입 가드·plan 라인 가드 배선(T-0637) 무변경** — 본 task 는 outcome 가드 1 호출 배선만. `if (typeof result.summaryLine !== "string")` TypeError 가드(L129~133)·`result` null/undefined 가드(L125~127)·`assertSummaryBatchRosterPlanShape(plan)` 배선(L157)·`PLAN_LABEL`/`RESULT_LABEL` 정의 본문 변경 0. 가드 호출 순서: ① result null/undefined 가드 → ② summaryLine string 가드 → ③ plan 산출·plan-shape 가드(기존) → ④ outcome-shape 가드(신규, resultLine 합성 직전) → ⑤ 합본 합성·반환.
- [ ] service `reportBatch`·`evaluateBatchAndReport`·`assertSummaryBatchReportShape`·`assertSummaryBatchOutcomeFormatShape`·`formatSummaryBatchOutcome`·pipeline **본문 변경 0** — 본 task 는 도메인 formatter `formatSummaryBatchReport` 1 지점만 배선(service 는 이미 formatter 에 위임 → 별개 직접 배선 불필요·금지 — 이중 단언 회피, T-0637 service 미배선과 동형).
- [ ] 순수성·안전 보존: 직접 부수효과 0 · 새 dependency 0 · migration 0 · schema 변경 0 · raw 미저장(R-59 — 형태 검증만, 평가 본문·summaryId/narrative 미접촉) · 입력 비변형(`roster`·`result`·`result.summaryLine` 문자열 변형 0). 자동 복구·정규화·drop·재렌더 0 — 손상 outcome 라인은 fail-fast throw 전파만.
- [ ] **Happy-path test 1+**: `formatSummaryBatchReport(roster, result)` 가 정상 roster·정상 outcome `summaryLine`(실제 `formatSummaryBatchOutcome` 산출 또는 형태 정합 fixture — 빈 batch `총 0건`·혼합 카운트·전건 skip·일부 버킷 0)으로 호출되면 outcome 가드 단언이 통과하고 배선 전과 byte-identical 한 합본 리포트(2 라인 · 계획 라벨+plan 라인 · 결과 라벨+summaryLine)를 반환(가드가 정상 산출을 변형·차단하지 않음) 1+.
- [ ] **Error path test 1+**: 가드가 throw 하는 경로 1+ — `assertSummaryBatchOutcomeFormatShape` 를 jest mock 으로 RangeError throw 하도록 강제하거나, 형태 위반 `result.summaryLine`(prefix drift 라인 등)을 입력해 `formatSummaryBatchReport` 가 그 throw 를 그대로 전파하고 합본 리포트를 반환하지 않음을 assert. 추가로 기존 `result` null/undefined·`result.summaryLine` 비-string → 한국어 TypeError 전파(기존 동작 보존) 1+ 유지.
- [ ] **Flow/branch test**: 가드 통과(정상 outcome 형태 → 합본 반환) 분기 1 + 가드 throw(손상 outcome 라인 형태 → 전파·합본 반환 미도달) 분기 1 — 각 1+ test 로 분기 격리. 에러 종류(형태 위반 RangeError vs 구조 결손 TypeError) 분기별 assert.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 가드 throw 시 `formatSummaryBatchReport` 가 합본 문자열을 만들지 않음(전파만, 손상 합본 미반환) ② 가드 호출 순서·대상 — `result.summaryLine` bare 산출에 가드 호출·`RESULT_LABEL` prepend **전**(spy 호출 순서·인자 assert: 가드 인자가 bare outcome 라인이지 `결과: ` 부착 라인이 아님) ③ outcome 라인 prefix drift(`요약 평가: 총 ...` / `평가 batch: ...`) → RangeError 전파 ④ outcome 라인 개행 혼입(`...other 0]\n`) → RangeError 전파 ⑤ outcome 라인 버킷 슬롯 누락·순서 뒤바뀜 → RangeError 전파 ⑥ 같은 (roster, result) 2회 호출 독립·결정성(byte-identical 반환·입력 비변형) ⑦ `result` null/undefined·`result.summaryLine` 비-string → 한국어 TypeError 전파(outcome 가드 단계 미도달, 기존 L125~133 동작 보존) ⑧ 정상 형태 입력 비변형(가드가 outcome 라인·roster·result 변형 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 formatter 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- service `reportBatch`(T-0634 `assertSummaryBatchReportShape` 배선)·`evaluateBatchAndReport`·`previewRosterPlan`(T-0636) 에 본 outcome 가드 추가/중복 배선 — 본 task 는 도메인 formatter `formatSummaryBatchReport` 1 지점만(service 는 formatter 위임이므로 별개 직접 배선 불필요·금지, 이중 단언 회피).
- `assertSummaryBatchOutcomeFormatShape`/`assertSummaryBatchRosterPlanShape`/`assertSummaryBatchReportShape`/`formatSummaryBatchOutcome`/`formatSummaryBatchRosterPlan` 가드·formatter **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 `formatSummaryBatchReport` 의 import + 호출 1줄 + JSDoc/주석 갱신만.
- 기존 L129 `typeof result.summaryLine !== "string"` TypeError 가드를 outcome-shape 가드로 흡수·삭제 — 기존 한국어 TypeError 메시지·spec 회귀 방지 위해 본문 변경 0(outcome 가드는 그 가드 통과 후 형태 불변식만 추가 검증).
- `assertSummaryBatchReportShape` 가 2번째 라인 outcome 6 불변식까지 확장 검증하도록 가드 로직 변경 — 본 task 는 배선만(가드 책임 분리 유지: report-shape=블록 외형, outcome-format-shape=outcome 라인 내부 형태).
- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표 → EvaluationResult[] collection bridge(cross-module RBAC ADR) — §5 BLOCKED 회피.
- 자동 복구·정규화·drop·재렌더 — 손상 outcome 라인은 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 두 표현 라인(plan · outcome)이 정의·검증 + 모든 산출 지점 배선까지 모두 완결된다 — plan 라인(T-0635 정의 · T-0636 service · T-0637 합본 formatter), outcome 라인(T-0638 정의 · 본 task 합본 formatter), 합본 블록(T-0633 정의 · T-0634 service). 남는 자연 후보: (a) p5-summary-aggregate 표현측 가드·wiring 소진 시 인접 PLAN bullet 으로 stream 전환 — R-9 사용자 지정 기간 임의 평가문 생성(PLAN 98행) 또는 R-58 재수집 정책(PLAN 100행) 또는 R-21 시간적 중복 제거(PLAN 103행) 등 / (b) 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 다른 stream 으로 판단.)

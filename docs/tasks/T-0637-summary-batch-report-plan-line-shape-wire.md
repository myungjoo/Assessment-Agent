---
id: T-0637
title: R-61 요약 batch 합본 리포트 1번째 라인의 roster plan-shape 가드를 formatSummaryBatchReport 산출 직전에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0636(PR #550 729c7cd)이 deferred 한 잔여: 합본 리포트 1번째 라인(formatSummaryBatchRosterPlan 위임 산출)에 plan-shape 가드 미배선. assertSummaryBatchReportShape 는 2-라인 블록 외형만 검증 → plan 라인 6 불변식 미보호. report-format formatter 가 위임 산출 직후·합성 전 단언. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-report-format.ts
  - src/assessment-evaluation/domain/summary-batch-report-format.spec.ts
---

# T-0637 — R-61 요약 batch 합본 리포트 1번째 라인의 roster plan-shape 가드를 formatSummaryBatchReport 산출 직전에 배선

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". T-0636(PR #550 squash 729c7cd)이 `assertSummaryBatchRosterPlanShape`(T-0635) 를 service `previewRosterPlan` 산출 직전 1 지점에 배선하면서, 그 Out of Scope 와 Follow-ups (a) 에서 **합본 리포트 경로의 1번째 라인 가드 배선을 명시적으로 deferred** 했다("이중 단언·다중 배선 회피 — `reportBatch` 경로의 합본 1번째 라인 가드 배선은 별도 follow-up").

`formatSummaryBatchReport(roster, result)`(T-0630)는 합본 리포트의 1번째 라인을 `${PLAN_LABEL}${formatSummaryBatchRosterPlan(roster)}`(summary-batch-report-format.ts:121)로 산출한다 — 즉 **`previewRosterPlan` 과 완전히 별개의 production site** 에서 동일 순수 formatter `formatSummaryBatchRosterPlan` 을 재호출해 plan 라인을 만든다(서로 다른 caller — service 진입점 vs 도메인 합본 formatter). T-0634 가 `reportBatch` 에 배선한 `assertSummaryBatchReportShape`(T-0633)는 합본 2-라인 블록의 **외형**(2 라인 · 라벨 prefix · 단일 개행 · 후행 개행 0)만 검증하고, 그 1번째 라인 안의 roster plan 6 형태 불변식(① string · ② 개행 0 · ③ prefix `요약 평가 batch 예정: ` · ④ `person N명` 토큰 · ⑤ `· 총 N좌표 [` 토큰 · ⑥ `[day N · week N · month N · other N]` 4 버킷 슬롯)은 **검증하지 않는다**. 따라서 합본 리포트 경로에서 plan 라인 합성 단계의 미래 회귀(person/총 좌표 토큰 누락·버킷 슬롯 누락·prefix drift)는 report-shape 가드를 통과해 **silent leak** 할 수 있다.

본 task 는 그 잔여를 닫는다 — `formatSummaryBatchReport` 가 `formatSummaryBatchRosterPlan(roster)` 의 **bare 산출**(PLAN_LABEL prepend 전)을 받은 직후·합성(`${PLAN_LABEL}${...}`) 전에 `assertSummaryBatchRosterPlanShape(plan)` 단언을 배선해, plan 라인 형태가 깨졌으면 합본 리포트가 만들어지기 전 fail-fast 차단한다. PLAN_LABEL prepend **전** bare 산출을 단언하는 것이 핵심(가드의 prefix 불변식 ③ 은 bare plan 라인이 `요약 평가 batch 예정: ` 로 시작함을 요구하므로 라벨 부착 후 단언은 잘못). T-0636 service-boundary 배선과 동형이되, 이번엔 도메인 formatter 내부의 별개 산출 지점이 대상이다. 본 task 닫히면 p5-summary-aggregate stream 의 plan 라인 가드가 두 산출 지점(service `previewRosterPlan` · 합본 report formatter) 모두에서 배선 완결된다.

## Required Reading

- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — `formatSummaryBatchReport`(L100~129) 의 L121 `const planLine = ${PLAN_LABEL}${formatSummaryBatchRosterPlan(roster)}`. 본 task 는 bare 위임 산출을 지역 변수로 분리(`const plan = formatSummaryBatchRosterPlan(roster)`)한 뒤 `assertSummaryBatchRosterPlanShape(plan)` 단언, 그다음 `const planLine = ${PLAN_LABEL}${plan}` 으로 합성하도록 배선. import 블록(L46~48 부근)에 가드 import 1줄 추가. 함수 JSDoc(L62~99) 의 `@throws` 에 `assertSummaryBatchRosterPlanShape` 의 RangeError(형태 위반) 한 줄 보강.
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts) — T-0635 `assertSummaryBatchRosterPlanShape(plan: string): void` 의 throw 계약(구조 결손=한국어 TypeError / 형태 위반=한국어 RangeError 구분, 정상 형태=void·비변형) — 본 배선이 호출할 가드(본문 변경 0, import 만).
- [src/assessment-evaluation/domain/summary-batch-report-format.spec.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.spec.ts) — 기존 happy/error/branch/negative describe 블록(L45~333). 본 task 가 가드 호출 배선 케이스를 append 할 colocated spec. T-0636 의 가드-배선 spec 구조(가드 호출 1회 검증·정상 통과 위임·throw 전파·호출 순서: formatRosterPlan → assertRosterPlanShape → prepend·합성) mirror.

## Acceptance Criteria

- [ ] `summary-batch-report-format.ts` 의 `formatSummaryBatchReport` 가 `formatSummaryBatchRosterPlan(roster)` 로 bare plan 라인을 산출한 직후·`PLAN_LABEL` prepend 및 합성 전에 `assertSummaryBatchRosterPlanShape(plan)` 단언을 호출하도록 배선 — import 1줄 + bare 산출을 지역 변수로 분리 + 단언 호출 1줄 + JSDoc `@throws` 갱신. 정상 형태면 가드 void 반환 후 기존과 byte-identical 한 합본 리포트(`${PLAN_LABEL}${plan}\n${RESULT_LABEL}${result.summaryLine}`)를 반환(동작 무회귀), 위반 형태면 가드 RangeError 가 그대로 전파(합본 리포트 합성·반환 도달 전 차단).
- [ ] **bare 산출에 단언(라벨 부착 전)** — `assertSummaryBatchRosterPlanShape` 는 `formatSummaryBatchRosterPlan(roster)` 의 bare 결과에 호출해야 한다(가드의 prefix 불변식 ③ `요약 평가 batch 예정: ` 는 bare plan 라인 기준). `${PLAN_LABEL}${...}` 합성 결과(`계획: 요약 평가 batch 예정: ...`)에 단언하면 prefix 불일치로 false-positive throw 발생 — 금지.
- [ ] `previewRosterPlan`(T-0636 이미 배선)·`reportBatch`(T-0634 `assertSummaryBatchReportShape` 배선)·`assertSummaryBatchReportShape` 는 본 task 배선 대상이 **아니다** — 본 task 는 도메인 formatter `formatSummaryBatchReport` 의 plan 라인 산출 직전 1 지점만 배선. service 경계의 plan-shape 단언은 `previewRosterPlan` 에 이미 존재(이중 단언이 아님 — 별개 산출 지점이므로).
- [ ] `formatSummaryBatchRosterPlan`/`assertSummaryBatchRosterPlanShape`/`assertSummaryBatchReportShape`/pipeline/composer/enumerate/service **본문 변경 0** — 본 task 는 `formatSummaryBatchReport` formatter 의 import + bare 변수 분리 + 단언 호출 + JSDoc/주석 갱신만. `result` null/undefined 및 `result.summaryLine` 타입 가드(L108~116)·`RESULT_LABEL`/`PLAN_LABEL` 정의 무변경.
- [ ] 순수성·안전 보존: 직접 부수효과 0·새 dependency 0·migration 0·schema 변경 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉)·입력 비변형(`roster`·`result`·`plan` 문자열 변형 0).
- [ ] **Happy-path test 1+**: `formatSummaryBatchReport(roster, result)` 가 정상 roster·result 로 호출되면 가드 단언이 통과하고 배선 전과 byte-identical 한 합본 리포트(2 라인 · 계획 라벨 + plan 라인 · 결과 라벨 + summaryLine)를 반환(가드가 정상 산출을 변형·차단하지 않음). roster 빈/non-empty 둘 다 통과 1+.
- [ ] **Error path test 1+**: 가드가 throw 하는 경로 1+ — `formatSummaryBatchRosterPlan` 또는 `assertSummaryBatchRosterPlanShape` 를 jest mock 으로 손상 형태 반환/RangeError throw 하도록 강제해 `formatSummaryBatchReport` 가 그 throw 를 그대로 전파하고 합본 리포트를 반환하지 않음을 assert. 추가로 기존 `result` null/undefined → 한국어 TypeError 전파(기존 동작 보존) 1+ 유지.
- [ ] **Flow/branch test**: 가드 통과(정상 형태 → 합본 반환) 분기 1 + 가드 throw(손상 plan 형태 → 전파·합본 반환 미도달) 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 가드 throw 시 `formatSummaryBatchReport` 가 합본 문자열을 만들지 않음(전파만, 손상 합본 미반환) ② 가드 호출 순서·대상 — `formatSummaryBatchRosterPlan` bare 산출 **후**·`PLAN_LABEL` prepend **전** 에 가드 호출(spy 호출 순서·인자 assert: 가드 인자가 bare plan 라인이지 라벨 부착 라인이 아님) ③ 같은 (roster, result) 2회 호출 독립·결정성(byte-identical 반환·입력 비변형) ④ `result` null/undefined·`result.summaryLine` 비-string → 한국어 TypeError 전파(가드 단계 미도달, 기존 동작 보존) ⑤ 정상 형태 입력 비변형(가드가 plan 라인·roster·result 변형 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 formatter 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `assertSummaryBatchRosterPlanShape`/`formatSummaryBatchRosterPlan`/`assertSummaryBatchReportShape` 가드·formatter **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 `formatSummaryBatchReport` 의 import + bare 변수 분리 + 호출 1줄 + JSDoc/주석 갱신만.
- service `previewRosterPlan`(T-0636 배선)·`reportBatch`(T-0634 배선)에 본 가드 추가/중복 배선 — 본 task 는 도메인 formatter 1 지점만(별개 산출 지점이므로 이중 단언 아님).
- `assertSummaryBatchReportShape` 가 plan 라인 6 불변식까지 확장 검증하도록 가드 로직 변경 — 본 task 는 배선만(가드 책임 분리 유지: report-shape=블록 외형, roster-plan-shape=plan 라인 내부 형태).
- 자동 복구·정규화·drop·재렌더 — 손상 plan 라인은 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 roster plan 라인 형태 가드가 두 산출 지점(service `previewRosterPlan`·합본 report formatter `formatSummaryBatchReport`) 모두에서 배선 완결되어 p5-summary-aggregate stream 의 표현측 가드(plan 라인 · outcome 라인 · 합본 블록 · 합본 내 plan 라인)가 정의·검증 + 모든 산출 지점 배선까지 완결된다. 남는 자연 후보: (a) p5-summary-aggregate 표현측 wiring 소진 시 인접 PLAN bullet — R-9 사용자 지정 기간 임의 평가문 생성(PLAN 98행) 또는 R-58 재수집 정책(PLAN 100행) 또는 R-21 시간적 중복 제거(PLAN 103행) 등으로 stream 전환 / (b) 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 다른 stream 으로 판단.)

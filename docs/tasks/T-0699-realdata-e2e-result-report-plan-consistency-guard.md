---
id: T-0699
title: realdata-e2e result-report-plan 종단 컴포저 정합 가드 신설 (plan ↔ inputs single-source 재유도)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-021, REQ-022]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 realdata-e2e step③→④ consistency 사슬 — result-report-plan 종단 컴포저 plan↔inputs 재유도 가드 신설(현재 descriptor↔summary 내부 가드만 self-wire), 가드 신설 절반·self-wire 후속, dependsOn [] 독립"
independentStream: realdata-e2e-command-plan-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan-consistency.ts
  - test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts
---

# T-0699 — realdata-e2e result-report-plan 종단 컴포저 정합 가드 신설

## Why

`buildRealDataResultReportPlan(results, run)` (T-0593, step③→④ 경계 컴포저) 는 `buildRealDataResultSummary(results)` + `buildRealDataResultIssueDescriptor(summary, run)` 2 위임으로 `{summary, descriptor}` plan 을 합성한다. 현재 이 컴포저는 반환 직전 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` (T-0647) 만 self-wire 한다 — 이는 **산출된 두 구성요소끼리의 내부-shape 정합**만 검증할 뿐, plan 이 **원본 입력 `(results, run)` 에서 single-source 로 재유도되는지**(summary 가 정말 results 의 집계인지, descriptor 가 정말 그 summary+run 의 산물인지)는 대조하지 않는다. 이는 T-0695/T-0696/T-0588 이 종단 컴포저(gh-command-plan / command-plan)에 도입한 **plan ↔ inputs single-source 재유도 정합 가드** 패턴의 잔여 gap 이다. 본 task 는 그 짝 가드(`assertRealDataResultReportPlanConsistentWithInputs`)를 신설해 step③→④ build-time round-trip 을 닫는다. PLAN.md P5 realdata-e2e 강화 bullet 의 "build-time consistency 사슬 self-wire 잔여 sweep" 후속이다.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan.ts` — 본 가드의 대상 컴포저(`buildRealDataResultReportPlan(results, run)` L110, 산출 `RealDataResultReportPlan` interface L80, 두 위임 helper).
- `test/helpers/realdata-e2e-result-summary.ts` — `buildRealDataResultSummary(results)` (L103) 위임 1.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `buildRealDataResultIssueDescriptor(summary, run)` (L117), `RealDataResultIssueRunRef` shape(`gitSha`/`dateToken`, L72), run 식별자 blank → throw 분기.
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` — **구조 템플릿**. `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)` (L269) 의 재유도 대조 + deep-equal + 위반 시 한국어 명세형 throw 패턴을 그대로 mirror.
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` — **spec 템플릿**. happy / 각 위반 분기 / negative cases 구성 참고.

## Acceptance Criteria

신규 가드 파일 `test/helpers/realdata-e2e-result-report-plan-consistency.ts` 와 colocated spec `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 를 작성한다 (colocated 우선 — 두 파일 모두 `test/helpers/` 에 나란히).

- [ ] 신규 export 함수 `assertRealDataResultReportPlanConsistentWithInputs(plan: RealDataResultReportPlan, results: EvaluationResult[], run: RealDataResultIssueRunRef): void` 작성. 원본 입력 `(results, run)` 에서 `buildRealDataResultSummary` → `buildRealDataResultIssueDescriptor` 2 위임을 **재호출**해 기대 `{summary, descriptor}` 를 재유도하고, 인자로 받은 `plan.summary`/`plan.descriptor` 와 deep-equal 대조. 정합이면 void 반환, 불일치면 어느 구성요소가 왜 어긋났는지 명시하는 한국어 명세형 에러 throw(fail-fast).
- [ ] **Happy-path unit test 1+**: 정상 `(results, run)` 으로 만든 plan 에 대해 가드가 throw 없이 void 반환(정상 합성 plan 통과). 빈 `results` 배열(count 0 집계)도 정상 통과하는 happy case 1+.
- [ ] **Error path unit test 1+**: 위임 helper(`buildRealDataResultIssueDescriptor`)가 자체 전파하는 throw(예: `run.gitSha` 빈/공백, `run.dateToken` 빈/공백)가 가드 재유도 과정에서 그대로 선전파됨을 검증하는 test 1+ (각 blank 필드 분기별 1+).
- [ ] **Flow / branch coverage**: 가드 본문의 각 대조 분기(summary 불일치 / descriptor 불일치)마다 위반 plan 을 주입해 해당 분기에서 throw 하는 test 각 1+.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: (1) plan.summary 를 results 와 다른 입력의 산물로 위조 → throw, (2) plan.descriptor 를 다른 summary/run 의 산물로 위조 → throw, (3) plan.summary 는 맞으나 descriptor 만 어긋남 → throw, (4) deep-equal 경계(중첩 필드 1개만 변형) → throw, (5) 위임 throw 선전파(RangeError/TypeError 등 가드가 자체 try/catch 없이 그대로 전파) 1+. 단일 negative 만으로 부족 — 각 대조 분기·선전파마다 cover.
- [ ] 가드는 입력을 변형하지 않고(비변형) 결정론적(동일 입력 → 동일 판정)임을 검증하는 test 1+.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 cov 100% 목표.

## Out of Scope

- **컴포저 self-wire 금지** — `buildRealDataResultReportPlan` 반환 직전에 본 신규 가드를 호출하는 배선은 본 task 에 포함하지 않는다(가드 신설 절반만; self-wire 는 후속 task 의 "짝 닫기"). `realdata-e2e-result-report-plan.ts` 는 변경하지 않는다.
- production `src/` 코드 변경 금지 — test helper 단독(타입·위임 함수 import 재사용만).
- 기존 `assertRealDataResultIssueDescriptorBodyConsistent` (T-0647) 또는 다른 consistency 가드 변경 금지.
- 위임 helper(`buildRealDataResultSummary`/`buildRealDataResultIssueDescriptor`) 자체의 로직 변경 금지 — 재호출만.
- schema / package.json / CI workflow 변경 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (후속 task) `buildRealDataResultReportPlan` 반환 직전 `assertRealDataResultReportPlanConsistentWithInputs(plan, results, run)` self-wire 배선(본 가드의 짝 닫기). 단, 기존 `assertRealDataResultIssueDescriptorBodyConsistent` self-wire 와의 중복/순서 정합 검토 필요.

---
id: T-1066
title: realdata-e2e result-report-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 분기가 값 재유도(build 위임)보다 먼저 수행됨을 spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 1, T-1065 §D 후보 a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 test-hardening 새 축 leg 1 — T-1065 완료 audit §D 후보 (a) 구조-guard 선행성. 직전 delegate 재유도 순서-lock sweep(T-1054~T-1064) 소진 확정 후 전환. planner pre-check: result-report-plan 가드가 구조 검사 5종(assertPlanStructure/…/assertRunStructure)을 값 재유도(buildRealDataResultSummary→buildRealDataResultIssueDescriptor)보다 먼저 수행하나 spec(ico=7)은 값-재유도 상호 순서·위임-throw fail-fast 만 lock, 구조-검사 → build 선행성은 미lock. 구조 위반 시 build 위임 0-call spy 로 defense-in-depth 추가. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(direct-only 병렬 아님 — pr-mode 0-active claim 시 단독)."
---

# T-1066 — result-report-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e delegate 재유도/self-wire 순서-lock sweep(legs T-1054~T-1064)은 T-1065 완료 audit 으로 소진(full exhaustion)이 확정됐다. 그 audit 의 섹션 D 는 다음 축 후보 3종을 pre-check 지침과 함께 박제했고, 우선순위 최상단은 **(a) 구조-guard 선행성 order-lock** 이다 — 현 sweep 이 값 재유도(`build*`) helper 의 **상호** 호출 순서만 lock 했고, 각 consistency-guard 의 **구조 검사(`assertStructure`/TypeError)가 값 재유도보다 먼저 수행됨** 은 미lock 이라는 가능성.

본 task 는 그 새 축의 **leg 1** 로, 직전 sweep 의 leg 1 과 동일한 가드 `assertRealDataResultReportPlanConsistentWithInputs`(`test/helpers/realdata-e2e-result-report-plan-consistency.ts`)를 대상으로 삼는다(precedent-traceable mirror). planner pre-check 로 확인한 gap: 이 가드는 본문에서 구조 검사 5종(`assertPlanStructure` → `assertPlanSummaryStructure` → `assertPlanDescriptorStructure` → `assertResultsStructure` → `assertRunStructure`)을 값 재유도 위임(`buildRealDataResultSummary` → `buildRealDataResultIssueDescriptor`)보다 **먼저** 수행하나, 대응 spec(현 `invocationCallOrder`=7)은 값-재유도 상호 순서(summary → descriptor)와 위임-throw fail-fast 만 못박고 **구조 위반 발생 시 build 위임이 아예 호출되지 않는(선행 fail-fast) 선행성** 은 검증하지 않는다. 구조 결손 입력을 주면 build 위임 spy 가 `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 build 를 구조 검사 위로 끌어올림)로부터 방어한다(현 sweep 과 동형의 defense-in-depth). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `docs/progress/details/T-1065-order-lock-sweep-completion-audit.md` — 특히 **섹션 D 후보 (a)** (적격 판정용 grep + 예상 산출물 형태)와 섹션 A(값-재유도 순서-lock 확정표에서 result-report-plan = leg 1, ico=7). 본 leg 가 이행할 핸드오프 지침의 원본.
- `test/helpers/realdata-e2e-result-report-plan-consistency.ts` — 대상 가드. 특히 `assertRealDataResultReportPlanConsistentWithInputs` 본문의 구조 검사 5종(`assertPlanStructure`/`assertPlanSummaryStructure`/`assertPlanDescriptorStructure`/`assertResultsStructure`/`assertRunStructure`)이 값 재유도 위임(`buildRealDataResultSummary`·`buildRealDataResultIssueDescriptor`)보다 앞서 위치함을 확인(구조 검사 라인 < 첫 `buildRealData` 라인). **광범위 read 금지 — 해당 함수 본문만.**
- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 현 구조 결손 error-path 테스트(`describe("error path — 구조 결손(TypeError)")`)는 throw 여부만 assert 하고 build 위임 0-call 은 미검증임을 확인. 기존 `invocationCallOrder` 블록(값-재유도 순서 + 위임-throw fail-fast)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`results`/`run` 입력에서 가드가 void 반환하고, `buildRealDataResultSummary` spy 가 `buildRealDataResultIssueDescriptor` spy 보다 먼저(`invocationCallOrder` 부등식) 정확히 각 1회 호출됨을 재확인(기존 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan`=null/undefined/배열/원시, `plan.summary` 비-객체, `plan.descriptor` 비-객체, `results` 비-배열, `run` 비-객체)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataResultSummary` spy·`buildRealDataResultIssueDescriptor` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 spy 로 못박는다.
- [ ] **flow/branch cover**: 구조 검사 5분기(plan / plan.summary / plan.descriptor / results / run) 각각에 대해 위 "TypeError + build 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음).
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 배열 · 원시 · 비-객체/비-배열 mismatch) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: summary drift)은 구조 검사를 통과해 build 위임이 호출된 뒤 발생**함(즉 RangeError 경로에서는 build spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, build 0-call) vs 값(RangeError, build 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c invocationCallOrder test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 값이 기존(7) 이상으로 유지되고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 5분기 전량 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, 404 suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 result-report-plan **1개** 만(새 축 leg 1). 나머지 적격 가드(구조 검사 + 2+ build 위임 보유)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 값-재유도 `invocationCallOrder` 블록·error-path TypeError 테스트의 삭제·재작성 — 유지하고 새 describe 로 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — 기존 defense-in-depth 패턴의 구조-선행성 확장). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 5분기 build 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 2+) 본 leg 를 mirror 해 구조 검사 + 2+ build 위임을 보유한 다른 적격 가드(예: evaluation-plan / result-issue-command-plan / result-issue-gh-command-plan / step-args 등 T-1065 섹션 A 표의 값-재유도 order-locked 11종 중 구조 검사 선행 미lock 인 것)를 pre-check 로 재판정 후 순차 leg 화. 적격 grep: 각 spec 의 구조 결손 error-path 테스트에 build 위임 `toHaveBeenCalledTimes(0)` assert 부재면 적격.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.

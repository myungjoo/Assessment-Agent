---
id: T-1018
title: daily-step publish-plan 컴포저에 consistency 가드(T-1017) self-wire 배선 (buildRealDataDailyStepDualLegRunReportIssuePublishPlan 반환 직전 assertRealData...PublishPlanConsistentWithSource(plan, report) self-assert, 요약축 T-0666 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step publish-plan 컴포저(T-1016)에 consistency 가드(T-1017) self-wire, 요약축 T-0666 mirror(T-1017 Follow-up ①). pre-check grep origin/main: 컴포저·가드 둘 다 main 박제이나 컴포저 L64 주석 '가드 self-assert 미포함' + return 직전 assert 호출 0건(genuine gap). pr test-only 2파일(컴포저+colocated spec) file-disjoint dep[] stage5b 병렬-claimable, single-helper self-wire ×1.0."
---

# T-1018 — daily-step publish-plan 컴포저 consistency 가드 self-wire

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 보증 slice. 직전 T-1016 이 daily-step dual-leg run report issue seam 의 pre-실행 build-time chain 을 단일 진입점 순수 컴포저 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` → `{descriptor, commandArgs, searchArgv}`(요약축 T-0595 mirror)로 닫았고, T-1017 이 그 컴포저 산출 plan 이 single source(report)에서 3단 위임(descriptor→commandArgs→searchArgv)으로 정확히 재유도 가능한지 대조하는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)` 를 신설했다(요약축 T-0665 mirror). 그러나 그 가드는 아직 **컴포저 밖의 독립 helper 로만 존재** — 컴포저가 반환 직전 스스로 self-assert 하지 않아, 컴포저 리팩터·위임 오배선 시 drift 가 호출측이 별도로 가드를 부르지 않는 한 새어나갈 수 있다. 컴포저 원본 L64 주석도 "본 컴포저는 consistency 가드 self-assert 를 포함하지 않는다"고 명시(요약축 T-0595 창설 단계 대응 — self-wire 는 후속 slice).

본 task 는 그 self-wire 를 박제한다 — 컴포저 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan` 가 3단 위임으로 `descriptor`/`commandArgs`/`searchArgv` 를 합성한 뒤 `const plan = { descriptor, commandArgs, searchArgv }` 로 묶고, **반환 직전** `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)` 를 self-assert 호출한 다음 `return plan` 한다. 이는 요약축 종단 컴포저 self-wire `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`(T-0666 — 컴포저가 반환 직전 자기 산출 plan 을 single-source 에서 재유도해 self-assert)의 daily-step mirror 이며, T-1017 Follow-up ① 이 명시한 자연 후속이다.

가드는 컴포저와 동일한 세 위임 helper(descriptor→commandArgs→searchArgv)를 import 해 expected 를 재유도하므로, 정상 산출 plan 은 항상 통과한다(runtime cycle 위험 없음 — 가드는 컴포저를 import 하지 않고 하위 위임만 import). 위임 throw(descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백)는 컴포저 3단 위임 (1) 단계에서 이미 발생하므로 가드 도달 전 그대로 전파된다(self-assert 는 정상 합성 완료 후에만 실행).

issue-still-relevant pre-check(origin/main grep): 컴포저 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan`(T-1016)·가드 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(T-1017) 둘 다 main 박제 확인 + 컴포저 body(L132~152) 는 `return { descriptor, commandArgs, searchArgv }` 로 self-assert 호출 0건 + 컴포저 L64 주석이 "가드 self-assert 미포함" 명시 → genuine gap, self-wire 미배선. 요약축 T-0666 self-wire(`const plan = {...}` → `assertRealData...ConsistentWithSources(plan, results, run)` → `return plan`) 은 이미 존재 → daily-step mirror(중복 아님).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` (T-1016, **본 task 의 유일 편집 대상 컴포저**) — L64 주석("consistency 가드 self-assert 미포함")·import 블록(L83~88)·`buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)`(L132~152) 의 3단 위임 body + 현재 `return { descriptor, commandArgs, searchArgv }`(L152). 여기에 가드 import 1줄 + `const plan = {...}` + self-assert 호출 1지점 + `return plan` 을 배선한다. 3단 위임 body·위임 import 는 변경 0(byte-identical 보존).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` (T-1017, self-assert 할 가드 — 참조·import 만, 본문 변경 0) — `export function assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report): void` 시그니처·throw 계약(구조 결손 TypeError · 재유도 정합 위반 RangeError · 위임 throw 전파) 확인.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` (요약축 T-0666, **self-wire 패턴 직접 template** — 참조만, 본문 변경 0) — import(`assertRealDataResultIssuePublishPlanConsistentWithSources` L83) + `const plan = { report, commandArgs, searchArgv }`(L152) → `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`(L158) → `return plan`(L160) 배선. 헤더 주석의 "가드는 컴포저와 동일한 위임을 import 하므로 runtime cycle 위험 없음"(L81~82) 블록이 daily-step 에 mirror 된다(단 daily-step 은 single source `report` + 3단 위임).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts` (T-1016 colocated spec, **본 task 의 두번째 편집 대상**) — 기존 컴포저 describe 구조 확인. 여기에 self-wire 검증 describe 를 추가(가드가 실제 반환 경로에서 호출됨 · 정상 plan 통과 · drift 시 컴포저가 throw · throw 전파 · 결정성).
- `test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` (요약축 T-0666 spec, **테스트 패턴 참조만**) — self-wire describe: 컴포저가 반환 직전 가드를 호출함(`jest.spyOn` on 가드 module) · 정상 산출 plan self-assert 통과 · 위임 drift 주입 시 컴포저가 RangeError · 위임 throw 전파 · 결정성. daily-step spec 은 이 패턴을 mirror 하되 single source(report) + 3단 위임(descriptor throw 우선)에 맞춰 조정.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` 편집 — (1) 가드 import 1줄 추가: `import { assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency";`. (2) `buildRealDataDailyStepDualLegRunReportIssuePublishPlan` body 의 `return { descriptor, commandArgs, searchArgv };`(L152) 을 `const plan = { descriptor, commandArgs, searchArgv };` → `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report);` → `return plan;` 로 교체. (3) L64 의 "consistency 가드 self-assert 를 포함하지 않는다" 주석 및 return 부근 "self-wire 없음(요약축 T-0595 창설 단계 대응...)" 주석을 self-wire 반영으로 갱신(요약축 T-0666 톤 — "반환 직전 가드 self-assert · 가드는 하위 위임만 import 하므로 cycle 없음"). 3단 위임 body·위임 import·타입 import 는 byte-identical 보존(변경 0).
- [ ] **SSOT·재구현 0** — 컴포저는 가드를 import 해 호출만 한다(가드 본문 변경 0 · 재유도 로직 컴포저 내 재구현 0). 가드는 컴포저를 import 하지 않고 하위 위임 3helper 만 import → runtime import cycle 없음.
- [ ] **결정론·무공유·R-59 보존** — 컴포저는 여전히 순수 함수(부수효과 0 · 입력 `report` 비변형 · 매 호출 새 plan 트리 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). self-assert 는 read-only 대조라 산출 plan 비변형.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status 포함) → 컴포저가 throw 없이 `{descriptor, commandArgs, searchArgv}` plan 반환, 반환된 plan 이 가드 계약을 만족(별도 가드 재호출 시에도 통과). 1+.
- [ ] **Error path test 각 1+**: ① `report.gitSha` 빈/공백 → 3단 위임 (1) descriptor 단계 throw 가 self-assert 도달 전 그대로 전파(가드 RangeError 아닌 위임 throw). ② `report.dateToken` 빈/공백 → 위임 throw 전파. ③ (spy 기반) 위임 산출을 변조해 plan 이 재유도 expected 와 어긋나게 만든 시나리오 → 컴포저 반환 경로에서 가드 RangeError 전파. 각 1+.
- [ ] **Flow/branch test**: ① 정상 report → 3단 위임 성공 → self-assert 통과 → plan 반환 분기. ② descriptor 위임 throw → self-assert 미도달 분기(가드 module `jest.spyOn` 으로 가드 `not.toHaveBeenCalled` 검증). ③ 위임 drift 주입(예: search-argv 빌더를 `jest.spyOn` 으로 변조 반환) → self-assert RangeError 분기. 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **가드 실제 호출 검증** — 정상 경로에서 가드 module 을 `jest.spyOn` 해 컴포저가 반환 직전 가드를 정확히 1회, 산출 plan+원본 report 인자로 호출함을 검증(self-wire 가 실제 배선됐는지 — 요약축 T-0666 핵심 검증). (b) **입력 비변형** — 컴포저 호출 후 입력 `report` 객체 필드 변경 0. (c) **결정성** — 동일 report 로 컴포저 2회 호출 → 두 plan deep-equal(가드 self-assert 2회 다 통과). (d) **위임 순서 단락** — descriptor throw 시 command-args·search-argv 위임 및 가드 self-assert 미호출(spy). (e) **R-59** — 컴포저·가드가 raw narrative(원본 활동/issue payload 전문) 구조적 미접근·미저장. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 갱신** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts` 에 self-wire 검증 describe 추가(위 R-112 4종 + negative cases 충분 cover). 가드 호출 검증·순서 단락·drift 전파는 `jest.spyOn`(가드 module 및 위임 빌더 module) 사용. 기존 컴포저 describe(T-1016 산출)는 무회귀 보존.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. 가드(T-1017)·위임 3빌더 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 컴포저·가드 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 컴포저·가드·위임 3빌더 spec 무회귀).

## Out of Scope

- 가드(`assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`, T-1017)·위임 3빌더(`...Descriptor`/`...CommandArgs`/`...SearchGhArgv`) 본문 변경 — 본 task 는 컴포저에 가드 호출 배선만(가드는 import·재호출).
- daily-step `command-plan`(요약축 command-plan mirror) 등 다른 미미러 seam 신설 — 각 별도 slice.
- 종단 post-execution 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(stdout, commandArgs) 정합 가드·self-wire — 별도 helper(post-실행 leg).
- search seam(T-1012~T-1015 json-fields/hit-shape 가드·self-wire) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 컴포저는 정상 합성만, 가드는 drift 를 throw 로 보고만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step publish-plan seam 이 컴포저(T-1016) + 정합 가드(T-1017) + self-wire(본 task)로 완결 — 요약축 T-0595 → T-0665 → T-0666 의 daily-step mirror 완결.) 예상 후속 ①: §109 잔여 미미러 seam(command-plan / post-execution 종단 컴포저 정합 가드) mirror. ②: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

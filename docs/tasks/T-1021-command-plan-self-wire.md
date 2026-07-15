---
id: T-1021
title: daily-step command-plan 컴포저에 consistency 가드(T-1020) self-wire 배선 (buildRealDataDailyStepDualLegRunReportIssueCommandPlan 반환 직전 assertRealData...CommandPlanConsistentWithSource(plan, report) self-assert, 요약축 T-0697 mirror)
phase: P5
status: DONE
mergedAs: 7895b3ac
prNumber: 915
reviewRounds: 1
completedAt: 2026-07-15T04:40:00Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step command-plan 컴포저(T-1019)에 consistency 가드(T-1020) self-wire, 요약축 T-0697 mirror(T-1020 Follow-up). pre-check grep origin/main: 컴포저·가드 둘 다 main 박제이나 컴포저 L147~148 주석 '가드 self-wire 후속 slice' + return 직전 assert 호출 0건(genuine gap). pr test-only 2파일 file-disjoint dep[] stage5b 병렬-claimable, single-helper self-wire ×1.0."
---

# T-1021 — daily-step command-plan 컴포저 consistency 가드 self-wire

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 보증 slice. 직전 T-1019 가 daily-step dual-leg run report issue seam 의 command-plan build-time chain 을 단일 진입점 순수 컴포저 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` → `{descriptor, commandArgs}`(요약축 T-0594 mirror)로 닫았고, T-1020 이 그 컴포저 산출 plan 이 single source(report)에서 2단 위임(descriptor→commandArgs)으로 정확히 재유도 가능한지 대조하는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, report)` 를 신설했다(요약축 T-0696 mirror). 그러나 그 가드는 아직 **컴포저 밖의 독립 helper 로만 존재** — 컴포저가 반환 직전 스스로 self-assert 하지 않아, 컴포저 리팩터·위임 오배선 시 drift 가 호출측이 별도로 가드를 부르지 않는 한 새어나갈 수 있다. 컴포저 원본 L147~148 주석도 "consistency 가드 self-wire 는 후속 slice — 요약축 T-0594 의 self-assert 호출 라인은 본 task 에서 mirror 하지 않는다"고 명시(컴포저 창설 단계 대응 — self-wire 는 후속 slice).

본 task 는 그 self-wire 를 박제한다 — 컴포저 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 가 2단 위임으로 `descriptor`/`commandArgs` 를 합성한 뒤 `const plan = { descriptor, commandArgs }` 로 묶고(이미 존재), **반환 직전** `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, report)` 를 self-assert 호출한 다음 `return plan` 한다. 이는 요약축 command-plan 컴포저 self-wire(T-0697 — 컴포저가 반환 직전 자기 산출 plan 을 single-source 에서 재유도해 self-assert)의 daily-step mirror 이며, 형제 T-1018(publish-plan self-wire)과 동형이다.

가드는 컴포저와 동일한 두 위임 helper(descriptor→commandArgs)를 import 해 expected 를 재유도하므로, 정상 산출 plan 은 항상 통과한다(runtime cycle 위험 없음 — 가드는 컴포저를 import 하지 않고 하위 위임만 import). 위임 throw(descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백)는 컴포저 2단 위임 (1) 단계에서 이미 발생하므로 가드 도달 전 그대로 전파된다(self-assert 는 정상 합성 완료 후에만 실행).

issue-still-relevant pre-check(origin/main grep): 컴포저 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan`(T-1019)·가드 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`(T-1020) 둘 다 main 박제 확인 + 컴포저 body(L149) 는 `const plan = { descriptor, commandArgs }` → `return plan`(L151) 로 self-assert 호출 0건 + 컴포저 L147~148 주석이 "가드 self-wire 후속 slice" 명시 → genuine gap, self-wire 미배선. 형제 publish-plan self-wire(T-1018) 은 이미 존재 → command-plan mirror(중복 아님).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` (T-1019, **본 task 의 유일 편집 대상 컴포저**) — L68~71 주석("command-plan consistency 가드 self-wire 별도 후속 slice")·import 블록(L88~90)·`buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` 의 2단 위임 body(descriptor L?? → commandArgs L143~144) + `const plan = { descriptor, commandArgs }`(L149) + `return plan`(L151) + L147~148 self-wire 유예 주석. 여기에 가드 import 1줄 + self-assert 호출 1지점을 배선한다. 2단 위임 body·위임 import 는 변경 0(byte-identical 보존).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` (T-1020, self-assert 할 가드 — 참조·import 만, 본문 변경 0) — `export function assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, report): void`(L180) 시그니처·throw 계약(구조 결손 TypeError · 재유도 정합 위반 RangeError · 위임 throw 전파) 확인.
- `docs/tasks/T-1018-daily-step-publish-plan-selfwire.md` (**형제 self-wire — 직접 template**, 참조만) — publish-plan self-wire 의 Why/AC/Out-of-Scope 구조. 본 task 는 이 template 을 command-plan(2단 위임: descriptor→commandArgs)에 맞춰 mirror 한다(publish-plan 은 3단 위임: descriptor→commandArgs→searchArgv).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts` (T-1019 colocated spec, **본 task 의 두번째 편집 대상**) — 기존 컴포저 describe 구조 확인. 여기에 self-wire 검증 describe 를 추가(가드가 실제 반환 경로에서 호출됨 · 정상 plan 통과 · drift 시 컴포저가 throw · throw 전파 · 결정성).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` 편집 — (1) 가드 import 1줄 추가: `import { assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency";`. (2) `const plan = { descriptor, commandArgs };`(L149) 와 `return plan;`(L151) 사이에 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, report);` self-assert 호출 1줄 삽입. (3) L147~148 의 "consistency 가드 self-wire 는 후속 slice ... 본 task 에서 mirror 하지 않는다" 주석을 self-wire 반영으로 갱신(형제 T-1018 톤 — "반환 직전 가드 self-assert · 가드는 하위 위임만 import 하므로 cycle 없음"). L68~71 헤더 주석도 self-wire 배선 반영으로 갱신. 2단 위임 body·위임 import·타입 import 는 byte-identical 보존(변경 0).
- [ ] **SSOT·재구현 0** — 컴포저는 가드를 import 해 호출만 한다(가드 본문 변경 0 · 재유도 로직 컴포저 내 재구현 0). 가드는 컴포저를 import 하지 않고 하위 위임 2helper 만 import → runtime import cycle 없음.
- [ ] **결정론·무공유·R-59 보존** — 컴포저는 여전히 순수 함수(부수효과 0 · 입력 `report` 비변형 · 매 호출 새 plan 트리 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). self-assert 는 read-only 대조라 산출 plan 비변형.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status 포함) → 컴포저가 throw 없이 `{descriptor, commandArgs}` plan 반환, 반환된 plan 이 가드 계약을 만족(별도 가드 재호출 시에도 통과). 1+.
- [ ] **Error path test 각 1+**: ① `report.gitSha` 빈/공백 → 2단 위임 (1) descriptor 단계 throw 가 self-assert 도달 전 그대로 전파(가드 RangeError 아닌 위임 throw). ② `report.dateToken` 빈/공백 → 위임 throw 전파. ③ (spy 기반) 위임 산출을 변조해 plan 이 재유도 expected 와 어긋나게 만든 시나리오 → 컴포저 반환 경로에서 가드 RangeError 전파. 각 1+.
- [ ] **Flow/branch test**: ① 정상 report → 2단 위임 성공 → self-assert 통과 → plan 반환 분기. ② descriptor 위임 throw → self-assert 미도달 분기(가드 module `jest.spyOn` 으로 가드 `not.toHaveBeenCalled` 검증). ③ 위임 drift 주입(예: command-args 빌더를 `jest.spyOn` 으로 변조 반환) → self-assert RangeError 분기. 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **가드 실제 호출 검증** — 정상 경로에서 가드 module 을 `jest.spyOn` 해 컴포저가 반환 직전 가드를 정확히 1회, 산출 plan+원본 report 인자로 호출함을 검증(self-wire 가 실제 배선됐는지 — 형제 T-1018 핵심 검증). (b) **입력 비변형** — 컴포저 호출 후 입력 `report` 객체 필드 변경 0. (c) **결정성** — 동일 report 로 컴포저 2회 호출 → 두 plan deep-equal(가드 self-assert 2회 다 통과). (d) **위임 순서 단락** — descriptor throw 시 command-args 위임 및 가드 self-assert 미호출(spy). (e) **R-59** — 컴포저·가드가 raw narrative(원본 활동/issue payload 전문) 구조적 미접근·미저장. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 갱신** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts` 에 self-wire 검증 describe 추가(위 R-112 4종 + negative cases 충분 cover). 가드 호출 검증·순서 단락·drift 전파는 `jest.spyOn`(가드 module 및 위임 빌더 module) 사용. 기존 컴포저 describe(T-1019 산출)는 무회귀 보존.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. 가드(T-1020)·위임 2빌더 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 컴포저·가드 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 컴포저·가드·위임 2빌더 spec 무회귀).

## Out of Scope

- 가드(`assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`, T-1020)·위임 2빌더(`...Descriptor`/`...CommandArgs`) 본문 변경 — 본 task 는 컴포저에 가드 호출 배선만(가드는 import·재호출).
- daily-step post-execution 종단 컴포저(`resolveRealData...GhCommandPlan`, stdout·commandArgs) 정합 가드·self-wire — 별도 helper(post-실행 leg).
- publish-plan seam(T-1016~T-1018) 변경 0 — 별도 seam(형제, self-wire 이미 완결).
- search seam(T-1012~T-1015 json-fields/hit-shape 가드·self-wire) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 컴포저는 정상 합성만, 가드는 drift 를 throw 로 보고만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step command-plan seam 이 컴포저(T-1019) + 정합 가드(T-1020) + self-wire(본 task)로 완결 — 요약축 T-0594 → T-0696 → T-0697 의 daily-step mirror 완결.) 예상 후속 ①: §109 잔여 미미러 seam(post-execution 종단 컴포저 정합 가드·self-wire) mirror. ②: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

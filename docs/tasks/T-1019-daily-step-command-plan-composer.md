---
id: T-1019
title: daily-step dual-leg run report issue command-plan 중간 순수 컴포저 신설 (buildRealDataDailyStepDualLegRunReportIssueCommandPlan — report → descriptor → commandArgs 2단 위임 합성, 요약축 T-0594 mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 430
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
sizeExempt: true
exemptReason: "composer + colocated R-112 spec atomic — R-112 는 신규 public symbol(컴포저)과 그 spec 을 같은 pr task 에 요구하므로 분리 불가(분리 시 컴포저가 spec 없이 머지). 요약축 T-0594(command-plan composer) · daily-step T-1016 publish-plan composer(+153/+364=517) 선례와 동형 atomic 묶음. 2단 위임(3단 publish-plan 보다 단순) 예상 ~130 composer +~300 spec ≈ 430 LOC(cap 300 초과 pre-justified)."
plannerNote: "P5 §109 test-hardening — daily-step publish-plan seam 완결(T-1016~T-1018) 후 잔여 미미러 seam(command-plan 중간 컴포저) 착수(T-1018 Follow-up ①). report→descriptor→commandArgs 2단 위임 순수 컴포저 신설(요약축 T-0594 mirror). pre-check(grep origin/main): daily-step (non-gh) command-plan 심볼·issue-command-plan 파일 0건(genuine gap, gh-command-plan 은 post-exec 별개) + 위임 2빌더(descriptor T-0896/command-args T-0990) 전부 main 박제 확인. sizeExempt(composer+spec atomic ~430 LOC, T-0594/T-1016 선례)."
---

# T-1019 — daily-step command-plan 중간 순수 컴포저 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 mirror slice. 요약축(`result-issue-*`)은 pre-실행 build-time chain 을 두 층으로 박제한다 — (1) `buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}`(T-0594, report-plan + command-args 2단 위임 중간 컴포저), 그 위에 (2) `buildRealDataResultIssuePublishPlan(results, run) → {report, commandArgs, searchArgv}`(T-0595, command-plan + search-argv 위임 종단 컴포저)가 얹힌다. daily-step 축은 publish-plan 종단 컴포저(T-1016, `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report) → {descriptor, commandArgs, searchArgv}`)를 먼저 직접 3단 위임으로 박제했으나, 그 **중간 층인 command-plan(`{descriptor, commandArgs}`)이 아직 별도 seam 으로 부재**하다 — 요약축이 갖춘 `command-plan` ↔ `publish-plan` 2층 구조가 daily-step 에는 한 층(publish-plan)만 존재.

본 task 는 그 중간 층을 박제한다 — 순수 컴포저 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` 가 (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(T-0896) → `{title, marker, body}` descriptor, (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`(T-0990) → `RealDataDailyStepDualLegRunReportIssueCommandArgs` 2단을 순차 위임 합성해 `{descriptor, commandArgs}`(`RealDataDailyStepDualLegRunReportIssueCommandPlan`) plan 을 산출한다. 이는 요약축 T-0594 중간 컴포저의 daily-step mirror 이며, T-1018 Follow-up ① 이 명시한 자연 후속(잔여 미미러 command-plan seam)이다. 산출 `commandArgs` 는 정확히 post-실행 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`(T-0997)가 받는 두 번째 인자이고, 산출 `descriptor` 는 publish-plan(T-1016)이 이미 노출하는 것과 동일 구조다.

컴포저는 하위 위임 2빌더만 import 해 순서대로 엮으므로 집계/렌더/명령-args 합성 로직 재구현 0(SSOT 보존). 위임 throw(descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백 → descriptor 하위 guard throw, descriptor.title/marker 빈/공백 → command-args 하위 guard throw)는 자체 try/catch 없이 그대로 전파한다. 본 task 는 **컴포저 신설만** — consistency 가드(요약축 T-0696 mirror)·self-wire(요약축 T-0697 mirror)는 후속 slice(daily-step 축 discipline: 컴포저 → 가드 → self-wire 삼단).

issue-still-relevant pre-check(origin/main grep): daily-step (non-gh) `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 심볼 0건 + `...-issue-command-plan.ts` 파일 부재(`gh-command-plan`(post-실행, T-0997) 은 stdout+commandArgs→{action, argv} 로 별개 seam, `collect-command-plan`/`eval-command-plan` 은 다른 step) 확인 → genuine gap. 위임 2빌더(descriptor T-0896 / command-args T-0990) 둘 다 main 박제 확인.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.ts` (요약축 T-0594, **직접 template** — 참조만, 본문 변경 0) — `buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}` 의 2단 위임 body·throw 전파 정책·순수성/무공유 주석·`RealDataResultIssueCommandPlan` 컨테이너 type 정의 구조. daily-step 은 이 패턴을 mirror 하되 입력이 단일 `report`(RunReport)이고 위임이 descriptor→command-args 이며 report-plan wrapper 가 없어 산출이 `{descriptor, commandArgs}`(요약축의 `{report, commandArgs}` 대비 report 층 없음)인 점만 조정. **주의: 요약축 T-0594 는 이미 self-wire(T-0697 assert 호출)가 배선돼 있으나, daily-step 본 task 는 컴포저 신설만(self-wire 는 T-1021 후속) — 그 self-assert 호출 라인은 mirror 하지 않는다.**
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` (daily-step T-1016, **위임 빌더 호출 패턴·컨테이너 type 관용 참조** — 본문 변경 0) — publish-plan 의 `report → descriptor → commandArgs → searchArgv` 3단 위임 body 중 앞 2단(descriptor→commandArgs)이 본 command-plan 과 동일. import 블록·위임 호출·결정론/무공유/R-59 주석 톤을 그대로 차용(command-plan 은 searchArgv 위임 1단만 제거한 prefix).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896, 위임 빌더 ① — 참조·import 만, 본문 변경 0) — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report) → {title, marker, body}` 시그니처·throw 계약(`report.gitSha`/`report.dateToken` 빈/공백 → guard throw) 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0990, 위임 빌더 ② — 참조·import 만, 본문 변경 0) — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor) → RealDataDailyStepDualLegRunReportIssueCommandArgs` 시그니처·throw 계약(descriptor.title/marker 빈/공백 → guard throw)·산출 type(searchQuery/createArgs/updateArgs/labels) 확인.
- `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` (요약축 T-0594 spec, **테스트 패턴 참조만**) — 컴포저 describe(happy: 정상 산출 · error: 위임 throw 전파 · flow: 위임 순서 단락 · negative: 입력 비변형/결정성/무공유). daily-step spec 은 이 패턴을 mirror 하되 단일 source(report) + descriptor→command-args 2단 위임에 맞춰 조정.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` 신설 — (1) 컨테이너 type `RealDataDailyStepDualLegRunReportIssueCommandPlan = { descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor; commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs }` 1개 정의(위임 빌더 산출 type 은 import type 재사용, 중복 정의 0). (2) `export function buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` — `const descriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);` → `const commandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);` → `const plan = { descriptor, commandArgs };` → `return plan;`. (3) 파일 상단 책임/위임 재사용/throw 전파/결정론·무공유/R-59/type 재사용/Out of Scope 주석 블록(요약축 T-0594 톤 mirror).
- [ ] **SSOT·재구현 0** — 컴포저는 위임 2빌더를 import 해 순서대로 호출만(descriptor 합성·command-args 합성 로직 재구현 0). 신규 type 정의는 `RealDataDailyStepDualLegRunReportIssueCommandPlan` 컨테이너 1개뿐.
- [ ] **위임 throw 그대로 전파(자체 try/catch 0)** — descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백 → descriptor 하위 guard throw, descriptor.title/marker 빈/공백 → command-args 하위 guard throw 를 재포장 없이 그대로 위로 전파.
- [ ] **결정론·무공유·R-59 보존** — 컴포저는 순수 함수(부수효과 0 · 입력 `report` 비변형 · 위임 빌더가 이미 매 호출 새 객체 반환하므로 매 호출 새 plan 트리 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장).
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status·summaryLine 포함) → 컴포저가 throw 없이 `{descriptor, commandArgs}` plan 반환. descriptor 필드가 위임 descriptor 빌더 산출과 deep-equal · commandArgs 가 위임 command-args 빌더 산출과 deep-equal. 1+.
- [ ] **Error path test 각 1+**: ① `report.gitSha` 빈/공백 → descriptor 단계 위임 throw 가 command-args 단계 도달 전 그대로 전파. ② `report.dateToken` 빈/공백 → descriptor 단계 위임 throw 전파. ③ descriptor.title 또는 marker 를 빈 값으로 만드는 시나리오(예: report 필드 조작으로 token 이 빈 문자열이 되게) → command-args 단계 위임 throw 전파. 각 1+.
- [ ] **Flow/branch test**: ① 정상 report → descriptor 위임 성공 → command-args 위임 성공 → plan 반환 분기. ② descriptor 위임 throw → command-args 위임 미도달 분기(예: descriptor 빌더 module `jest.spyOn` 으로 throw 주입 시 command-args 빌더 spy `not.toHaveBeenCalled` 검증). 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **위임 순서 단락** — descriptor 위임 throw 시 command-args 위임 미호출(spy). (b) **입력 비변형** — 컴포저 호출 후 입력 `report` 객체 필드 변경 0. (c) **결정성** — 동일 report 로 컴포저 2회 호출 → 두 plan deep-equal. (d) **무공유** — 두 번 호출한 plan 의 descriptor/commandArgs(및 중첩 createArgs.labels 배열)가 참조 비공유(한쪽 mutate 가 다른쪽에 누출 안 됨). (e) **R-59** — 컴포저가 raw narrative(원본 활동/issue payload 전문) 구조적 미접근·미저장(plan 이 descriptor·commandArgs 구조만 통과). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 신설** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts` 에 위 R-112 4종 + negative cases 충분 cover describe. 위임 순서 단락·throw 전파는 `jest.spyOn`(위임 2빌더 module) 사용.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. 위임 2빌더(descriptor T-0896 / command-args T-0990)·publish-plan(T-1016) 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 신규 컴포저 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 위임 빌더·publish-plan spec 무회귀).

## Out of Scope

- command-plan consistency 가드 신설(요약축 T-0696 mirror — `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithInputs`) — 별도 후속 slice(본 task 는 컴포저 신설만).
- command-plan self-wire(요약축 T-0697 mirror — 컴포저 반환 직전 가드 self-assert) — 가드 신설 후 별도 slice.
- publish-plan(T-1016)을 command-plan 에 위임하도록 리팩터(publish-plan = command-plan + searchArgv) — publish-plan.ts 본문 변경 대상이라 별도 slice(현 publish-plan 은 3단 직접 위임 유지, 무회귀).
- 위임 2빌더(descriptor/command-args) 본문·spec 변경 — 본 task 는 그 산출을 합성만.
- gh-command-plan(post-실행 종단, T-0997)·outcome-report·search seam 변경 0 — 별개 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 컴포저는 정상 합성만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: daily-step command-plan consistency 순수 가드 신설(요약축 T-0696 mirror — 컴포저 산출 `{descriptor, commandArgs}` ↔ 입력 report single-source 2단 재유도 정합). ②: 그 가드를 command-plan 컴포저 반환 직전 self-wire(요약축 T-0697 mirror) → command-plan seam 삼단 완결. ③(선택): publish-plan(T-1016)을 command-plan 위임으로 리팩터해 요약축 2층 구조(command-plan ⊂ publish-plan) 완전 동형화.

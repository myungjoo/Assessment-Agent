---
id: T-1016
title: daily-step dual-leg run report issue publish-plan 종단 순수 컴포저 신설 (buildRealDataDailyStepDualLegRunReportIssuePublishPlan — report → descriptor → commandArgs → searchArgv 3단 위임 합성, 요약축 T-0595 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 490
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
sizeExempt: true
exemptReason: "composer + colocated R-112 spec atomic — R-112 는 신규 public symbol(컴포저) 과 그 spec 을 같은 pr task 에 요구하므로 분리 불가(분리 시 컴포저가 spec 없이 머지). 요약축 T-0595(161 composer +398 spec=559) · daily-step T-1005 from-output composer(+128/+549=677) 선례와 동형 atomic 묶음. 예상 ~140 composer +~350 spec ≈ 490 LOC(cap 300 초과 pre-justified)."
plannerNote: "P5 §109 test-hardening — daily-step search seam 완결(T-1012~T-1015) 후 잔여 미미러 seam(publish-plan) 착수. report→descriptor→commandArgs→searchArgv 3단 위임 순수 컴포저 신설(요약축 T-0595 mirror, T-1015 Follow-up ①). pre-check(grep origin/main): daily-step helpers 에 PublishPlan 어휘 0건(genuine gap) + 위임 3빌더(descriptor/command-args/search-argv) 전부 main 박제 확인. sizeExempt(composer+spec atomic ~490 LOC, T-0595/T-1005 선례)."
---

# T-1016 — daily-step publish-plan 종단 순수 컴포저 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 의 단일 진입점 slice. daily-step dual-leg run report issue seam 의 pre-실행 build-time chain 은 현재 세 개의 분리된 순수 link 로 존재한다 — (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(T-0896) → `{title, marker, body}` descriptor, (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`(T-0990) → `{searchQuery, createArgs, updateArgs}` commandArgs, (3) `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)`(T-1013 self-wire 대상 빌더) → `searchArgv: string[]`. 그러나 step ④ live runner 가 한 번에 받아야 하는 "박제할 이슈 descriptor + 멱등 search-or-update 명령-args + 실행할 첫 gh argv(search)" 묶음은 **아직 세 helper 를 caller 가 수동으로 엮어야** 산출된다.

본 task 는 그 세 단계를 단일 순수 함수 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` → `{descriptor, commandArgs, searchArgv}` 로 합성해 **pre-실행 build-time chain 의 단일 진입점**을 닫는다. 이는 요약축 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run)` → `{report, commandArgs, searchArgv}`(T-0595 — command-plan + search-argv 를 단일 plan 으로 묶는 박제)의 daily-step mirror 이며, T-1015 Follow-up ① 이 명시한 "§109 잔여 미미러 seam(publish-plan) mirror" 의 자연 후속이다. daily-step topology 는 요약축과 위임 형태가 상이하다 — 요약축 publish-plan 은 command-plan(results+run → report+commandArgs) + search-argv 2단 위임이지만, daily-step 은 descriptor(report → descriptor) → command-args(descriptor → commandArgs) → search-argv(commandArgs → searchArgv) **3단 순차 위임**이다(daily-step 의 descriptor 가 요약축의 report-plan 역할을 하는 rendered issue content). 반환 shape 도 이에 맞춰 `{descriptor, commandArgs, searchArgv}` — descriptor 가 요약축 publish-plan 의 `report` 필드(rendered 산출) 자리에 대응한다.

컴포저는 세 위임 helper 를 순서대로 호출만 하고 **집계·렌더·명령-args·search argv 합성 로직을 재구현하지 않는다**(중복 0 — 하위 helper 직접 재구현 0, SSOT 보존). 위임 helper 의 throw(descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백 → 비식별 박제 방지 throw)는 자체 try/catch 없이 그대로 위로 전파한다(descriptor 단계에서 throw 되면 command-args·search-argv 단계 미도달). 결정론·무공유(R-59 정합) — 위임 helper 가 이미 매 호출 새 객체(descriptor 트리 + commandArgs 트리 + 새 searchArgv 배열)를 반환하므로 본 컴포저도 매 호출 새 plan 객체를 반환한다(공유 mutable 노출 0, 입력 `report` mutate 0). raw narrative(원본 활동/issue payload 전문)는 세 위임 helper 가 모두 미보유하므로 본 컴포저도 구조적으로 미보유(R-59 raw-not-stored 보존).

**주의 — 본 task 는 컴포저 신설만**. 요약축 publish-plan-consistency 가드(T-0665) 및 그 self-wire(T-0666)의 daily-step mirror 는 **본 task 범위 밖**(별도 후속 slice). 요약축도 T-0595 는 컴포저만 신설했고 consistency 가드·self-wire 는 후속 T-0665/T-0666 에서 박제했다 — 본 task 는 그 T-0595 단계에 정확히 대응한다(컴포저는 self-wire 없이 순수 3단 위임만).

issue-still-relevant pre-check(origin/main grep): `git grep -l "PublishPlan" origin/main -- 'test/helpers/*daily-step*'` = 0건(daily-step publish-plan helper 부재 확인, genuine gap) + 위임 3빌더(`buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `...CommandArgs` / `...SearchGhArgv`)는 전부 main 박제 확인 + 요약축 `buildRealDataResultIssuePublishPlan`(T-0595)은 이미 동형 컴포저로 존재 → 중복 아님, daily-step mirror.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` (T-0595, 요약축 **직접 template** — 참조만, 본문 변경 0) — 종단 컴포저 구조: interface `RealDataResultIssuePublishPlan {report; commandArgs; searchArgv}`(L103~106) + `buildRealDataResultIssuePublishPlan(results, run)`(L135~) 의 2단 위임 body(L135~ `const {report, commandArgs} = buildRealDataResultIssueCommandPlan(...)` → `const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs)` → `return {report, commandArgs, searchArgv}`). 헤더 주석의 "위임 helper 재사용(재구현 0)" · "위임 throw 그대로 전파(자체 try/catch 0)" · "결정론·무공유(R-59)" · "raw narrative 미포함" · "type 재사용(신규 type 는 plan 컨테이너 1개)" 5 블록이 그대로 daily-step 에 mirror 된다. **단 요약축은 2단 위임 + self-wire 포함**이므로 daily-step 은 위임을 3단으로 바꾸고 self-wire 는 제외(본 task 범위 밖).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — 위임 (1). `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueDescriptor`(L136). `{title, marker, body}` 산출 + `report.gitSha`/`report.dateToken` 빈/공백 시 throw(비식별 박제 방지). 시그니처·입력 type(`RealDataDailyStepDualLegRunReport`)·throw 계약 확인만. **본문 변경 0** — 호출만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0990) — 위임 (2). `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor): RealDataDailyStepDualLegRunReportIssueCommandArgs`(L145). `{searchQuery, createArgs, updateArgs}` 산출. interface(L115). 시그니처·반환 type 확인만. **본문 변경 0** — 호출만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — 위임 (3). `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): string[]`(L139). `searchArgv` 산출(매 호출 새 배열). 시그니처 확인만. **본문 변경 0** — 호출만.
- `test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` (T-0595 요약축 spec, **테스트 패턴 참조만**) — 컴포저 위임·byte-identical·throw 전파·결정론·무공유·R-59 검증 describe 구조. daily-step spec 은 이 패턴을 mirror 하되 3단 위임(descriptor throw 우선) 에 맞춰 조정.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` **신규 파일** — (1) interface `RealDataDailyStepDualLegRunReportIssuePublishPlan { descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor; commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs; searchArgv: string[]; }`(신규 type 정의는 이 plan 컨테이너 1개뿐 — 나머지는 전부 `import type` 재사용, SSOT). (2) `export function buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssuePublishPlan` — 3단 순차 위임: `const descriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `const commandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `const searchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `return { descriptor, commandArgs, searchArgv }`. 집계·렌더·명령-args·search argv 합성 로직 재구현 0(위임 호출만). 자체 try/catch 0(위임 throw 그대로 전파). 요약축 T-0595 톤의 한국어 헤더 주석(책임·위임 재사용·throw 전파·결정론/무공유·R-59 raw 미포함·type 재사용) 박제.
- [ ] **위임 순서·throw 전파** — descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백 → descriptor 위임의 throw 가 자체 try/catch 없이 그대로 전파되고 command-args·search-argv 단계 미도달. (이후 단계 throw 도 동일하게 전파.)
- [ ] **결정론·무공유·R-59 보존** — 컴포저는 순수 함수(부수효과 0 · 입력 `report` 비변형 · 매 호출 새 plan 객체 + 새 descriptor/commandArgs/searchArgv 트리 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). 동일 `report` 두 번 호출 → deep-equal plan(결정론).
- [ ] **self-wire 없음(범위 확인)** — 본 컴포저는 consistency 가드 self-assert 를 **포함하지 않는다**(요약축 T-0595 창설 단계 대응 — 가드·self-wire 는 후속 slice). 반환 직전 추가 assert 호출 0.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status 포함) → `{descriptor, commandArgs, searchArgv}` 정상 반환. 각 필드가 위임 helper 직접 호출 결과와 deep-equal(descriptor = `buildDescriptor(report)`, commandArgs = `buildCommandArgs(descriptor)`, searchArgv = `buildSearchGhArgv(commandArgs)`)임을 검증(위임 정합). 1+.
- [ ] **Error path test 각 1+**: ① `report.gitSha` 빈/공백 → descriptor 단계 throw 전파(plan 미반환). ② `report.dateToken` 빈/공백 → descriptor 단계 throw 전파. ③ `jest.spyOn` 으로 command-args 위임 강제 throw → 컴포저가 그대로 전파(search-argv 단계 미도달) · search-argv 위임 강제 throw → 그대로 전파. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 3단 위임 전부 성공 → plan 반환 분기. ② descriptor throw 분기(gitSha/dateToken blank)는 command-args·search-argv 위임 도달 **전** 발생(순차 위임 순서 보존 — `jest.spyOn` 으로 후속 위임 `not.toHaveBeenCalled` 검증). ③ 세 위임이 각각 정확한 인자로 호출됨(`buildDescriptor(report)` → 산출 descriptor 로 `buildCommandArgs` → 산출 commandArgs 로 `buildSearchGhArgv`)을 spy 로 검증. 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **입력 비변형** — 컴포저 호출 후 입력 `report` 객체 필드 변경 0(불변). (b) **무공유** — 반환 plan 의 descriptor/commandArgs/searchArgv 를 mutate 해도 다음 호출·위임 상수에 누설 0(매 호출 새 트리). (c) **결정성** — 동일 `report` 2회 호출 → 두 plan deep-equal. (d) **위임 순서 단락(short-circuit)** — descriptor throw 시 command-args·search-argv 위임 미호출(spy). (e) **searchArgv 무공유 배열** — 반환 searchArgv 가 새 배열(mutate 격리). (f) **type 재사용** — 신규 type 정의는 plan 컨테이너 1개뿐(descriptor/commandArgs type 은 import 재사용 — 중복 정의 0, spec 아닌 tsc/lint 로 확인). (g) **R-59** — 반환 plan 이 raw narrative(원본 활동/issue payload 전문) 구조적 미보유. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 신설** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts` (신규 colocated spec). 위 R-112 4종 + negative cases 충분 cover. 위임 검증은 `jest.spyOn`(또는 실 위임 호출 결과 대조) 으로.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 신규 컴포저 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 위임 3빌더 spec 무회귀).

## Out of Scope

- daily-step publish-plan-consistency 가드 신설(요약축 T-0665 mirror) 또는 그 self-wire(요약축 T-0666 mirror) — 본 task 는 컴포저 신설만. 가드·self-wire 는 별도 후속 slice(T-0595 → T-0665/T-0666 순서와 동형).
- 위임 3빌더(`buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `...CommandArgs` / `...SearchGhArgv`) 본문 변경 — 본 task 는 세 빌더를 순서대로 호출만(재구현 0).
- daily-step `command-plan`(요약축 command-plan mirror) 등 다른 미미러 seam 신설 — 각 별도 slice. 본 task 는 publish-plan 만.
- 종단 post-execution 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(stdout, commandArgs) 변경 — 별도 helper(post-실행 leg).
- search seam(T-1012~T-1015 json-fields/hit-shape 가드·self-wire) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·필드 자동 보정 — 컴포저는 위임 throw 를 그대로 전파만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step dual-leg run report issue seam 의 pre-실행 build-time chain 이 단일 진입점 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` → `{descriptor, commandArgs, searchArgv}` 로 닫힌다 — 요약축 T-0595 의 daily-step mirror 완결.) 예상 후속 ①: daily-step publish-plan-consistency 순수 가드 신설(컴포저 산출 plan ↔ single-source(report) 재유도 정합 대조, 요약축 T-0665 mirror). ②: 그 가드의 컴포저 반환 직전 self-wire 배선(요약축 T-0666 mirror). ③: §109 잔여 미미러 seam(command-plan) mirror. ④: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

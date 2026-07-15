---
id: T-1017
title: daily-step dual-leg run report issue publish-plan consistency 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource — 컴포저 산출 plan ↔ single-source(report) 3단 재유도 정합 대조, 요약축 T-0665 mirror)
phase: P5
status: DONE
mergedAs: 0849643b
prNumber: 911
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 560
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
sizeExempt: true
exemptReason: "guard + colocated R-112 spec atomic — R-112 는 신규 public symbol(가드) 과 그 colocated spec 을 같은 pr task 에 요구하므로 분리 불가(분리 시 가드가 spec 없이 머지). 요약축 T-0665 consistency 가드(217 guard +412 spec=629) 선례와 동형 atomic 묶음. 예상 ~180 guard +~380 spec ≈ 560 LOC(cap 300 초과 pre-justified)."
plannerNote: "P5 §109 test-hardening — daily-step publish-plan 컴포저(T-1016) 후속 T-1016 Follow-up ①. 컴포저 산출 plan↔single-source(report) 3단 재유도(descriptor→commandArgs→searchArgv) 정합 가드 신설, 요약축 T-0665 mirror. pre-check(grep origin/main): daily-step publish-plan-consistency helper 부재(genuine gap) + 컴포저 T-1016 및 위임 3빌더 전부 main 박제 확인. sizeExempt(guard+spec atomic ~560 LOC, T-0665 선례)."
---

# T-1017 — daily-step publish-plan consistency 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 보증 slice. 직전 T-1016 이 daily-step dual-leg run report issue seam 의 pre-실행 build-time chain 을 단일 진입점 순수 컴포저 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` → `{descriptor, commandArgs, searchArgv}`(요약축 T-0595 mirror)로 닫았다. 그러나 컴포저가 산출한 plan 이 **single source(report)에서 정확히 재유도 가능한지** — 즉 세 필드가 위임 chain 을 같은 순서로 다시 밟았을 때와 byte-identical 한지 — 를 검증하는 순수 가드는 아직 없다. 향후 컴포저 리팩터·위임 순서 오배선·필드 누락 시 drift 를 fail-fast 로 잡을 그물이 부재하다.

본 task 는 그 그물을 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)` 순수 가드로 박제한다. 가드는 (1) plan 구조(존재 + descriptor/commandArgs object + searchArgv string[]) 를 fail-fast TypeError 로 검증하고, (2) **컴포저가 내부에서 엮는 세 위임 함수를 가드가 직접 같은 순서로 호출해 single-source expected 를 재유도**한 뒤, (3) plan.descriptor / plan.commandArgs / plan.searchArgv 를 각각 재유도 expected 와 deep-equal(byte-identical) 대조해 어긋나면 RangeError 로 throw 한다. 이는 요약축 종단 정합 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`(T-0665 — command-plan + search-argv 를 single-source 에서 재유도해 plan 3필드와 대조)의 daily-step mirror 이며, T-1016 Follow-up ① 이 명시한 자연 후속이다.

topology 차이 — 요약축 T-0665 는 source 가 `results` + `run` 2개이고 재유도가 command-plan(results+run → report+commandArgs) + search-argv 2단 위임이지만, daily-step 은 **single source `report`** 이고 재유도가 descriptor(report → descriptor) → command-args(descriptor → commandArgs) → search-argv(commandArgs → searchArgv) **3단 순차 위임**이다. 따라서 시그니처는 `(plan, report)` 단일 source 이고, plan 의 첫 필드는 요약축의 `report`(rendered) 자리에 대응하는 `descriptor` 다. 가드는 집계·렌더·명령-args·search argv 합성 로직을 재구현하지 않고 **위임 helper 를 그대로 다시 호출만** 한다(SSOT 보존, drift 0 — 위임 helper 가 정답의 유일 출처). 위임 helper 의 throw(descriptor 단계 `report.gitSha`/`report.dateToken` 빈/공백 → 비식별 박제 방지 throw)는 가드가 삼키지 않고 그대로 전파한다.

**주의 — 본 task 는 가드 신설만**. 컴포저 반환 직전 self-wire 배선(가드를 `buildRealData...PublishPlan` 안에서 self-assert 호출)은 **본 task 범위 밖**(요약축 T-0665 → T-0666 순서와 동형 — T-0665 도 가드만 신설했고 self-wire 는 후속 T-0666 에서 박제). 본 task 는 그 T-0665 단계에 정확히 대응한다.

issue-still-relevant pre-check(origin/main grep): `git ls-tree origin/main test/helpers/ | grep daily-step.*publish-plan-consistency` = 0건(daily-step publish-plan-consistency helper 부재, genuine gap) + 컴포저 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan`(T-1016)·위임 3빌더(`...Descriptor`/`...CommandArgs`/`...SearchGhArgv`) 전부 main 박제 확인 + 요약축 `assertRealDataResultIssuePublishPlanConsistentWithSources`(T-0665)은 이미 동형 가드로 존재 → 중복 아님, daily-step mirror.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` (T-0665, 요약축 **직접 template** — 참조만, 본문 변경 0) — 종단 정합 가드 구조: `assertPlanStructure(plan)` fail-fast TypeError 헬퍼(L72~) + `assertRunStructure`(daily-step 은 single source 라 이 run 검증 대신 report 검증으로 대체 또는 위임 throw 에 위임) + `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`(L179~217) 의 body: `assertPlanStructure` → 위임 재호출로 expected 재유도(`buildRealDataResultIssueCommandPlan` → `buildRealDataResultIssueSearchGhArgv`) → plan 3필드 deep-equal 대조(어긋나면 RangeError). 헤더 주석의 "위임 helper 직접 재호출(재구현 0)" · "위임 throw 그대로 전파" · "byte-identical deep-equal" 블록이 그대로 daily-step 에 mirror 된다. **단 daily-step 은 source 가 report 하나 + 재유도가 3단 위임**이므로 시그니처·재유도 순서를 조정.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` (T-1016, 대상 컴포저 — 참조만, 본문 변경 0) — interface `RealDataDailyStepDualLegRunReportIssuePublishPlan { descriptor; commandArgs; searchArgv }`(L105~108) + `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)`(L132~152) 의 3단 위임 body. 가드가 대조할 plan shape 과 재유도 순서의 정본. plan type 은 `import type` 재사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — 재유도 (1). `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report): RealDataDailyStepDualLegRunReportIssueDescriptor`. `report.gitSha`/`report.dateToken` 빈/공백 시 throw. 시그니처·throw 계약 확인만, 호출만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0990) — 재유도 (2). `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor): RealDataDailyStepDualLegRunReportIssueCommandArgs`. 시그니처·반환 type 확인만, 호출만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — 재유도 (3). `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs): string[]`(매 호출 새 배열). 시그니처 확인만, 호출만.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts` (T-0665 요약축 spec, **테스트 패턴 참조만**) — 구조 검증(TypeError)·재유도 정합(happy)·drift 주입 시 RangeError·위임 throw 전파·결정론 describe 구조. daily-step spec 은 이 패턴을 mirror 하되 single source(report) + 3단 위임(descriptor throw 우선) 에 맞춰 조정.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` **신규 파일** — `export function assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan: RealDataDailyStepDualLegRunReportIssuePublishPlan, report: RealDataDailyStepDualLegRunReport): void`. body: (1) plan 구조 fail-fast — plan 존재 + descriptor object + commandArgs object + searchArgv string[] 아니면 TypeError. (2) single-source expected 재유도 — `const expectedDescriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `const expectedCommandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)` → `const expectedSearchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs)`(위임 직접 재호출, 합성 로직 재구현 0). (3) `plan.descriptor` ↔ expectedDescriptor · `plan.commandArgs` ↔ expectedCommandArgs · `plan.searchArgv` ↔ expectedSearchArgv 각각 deep-equal(byte-identical) 대조, 어긋나면 RangeError(어느 필드·기대·실측 메시지). 위임 throw(gitSha/dateToken 빈/공백)는 자체 try/catch 없이 그대로 전파. plan/descriptor/commandArgs type 은 전부 `import type` 재사용(신규 type 정의 0). 요약축 T-0665 톤의 한국어 헤더 주석 박제.
- [ ] **type 재사용·SSOT** — 신규 type 정의 0(전부 import 재사용). 가드는 위임 helper 를 직접 재호출만 하고 집계·렌더·명령-args·search argv 합성 로직을 재구현하지 않는다(drift 0 — 위임 helper 가 정답 유일 출처).
- [ ] **결정론·무공유·R-59 보존** — 가드는 순수 함수(부수효과 0 · 입력 `plan`/`report` 비변형 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장 · 재유도 산출물은 로컬 대조 후 폐기, 노출 0).
- [ ] **self-wire 없음(범위 확인)** — 본 가드는 컴포저 내부에서 호출되지 **않는다**(요약축 T-0665 창설 단계 대응 — self-wire 배선은 후속 T-0666 mirror slice). 컴포저 파일 변경 0.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status 포함) 로 컴포저가 산출한 plan → 가드가 throw 없이 통과. 위임 직접 재호출 결과와 plan 3필드가 deep-equal 임을 가드가 확인함을 검증. 1+.
- [ ] **Error path test 각 1+**: ① plan 이 null/undefined → TypeError. ② plan.descriptor 가 object 아님(예: null) → TypeError. ③ plan.commandArgs 가 object 아님 → TypeError. ④ plan.searchArgv 가 string[] 아님(예: undefined/객체) → TypeError. ⑤ `report.gitSha` 빈/공백 → 재유도 descriptor 위임 throw 그대로 전파(RangeError 아닌 위임 throw). ⑥ `report.dateToken` 빈/공백 → 위임 throw 전파. 각 1+.
- [ ] **Flow/branch test**: ① 정상 plan+report → 3단 재유도 성공 → 3필드 전부 deep-equal → throw 없이 반환 분기. ② drift 주입 — plan.descriptor 를 변조(예: title 필드 mutate)한 뒤 가드 호출 → descriptor 정합 위반 RangeError 분기. ③ plan.commandArgs 변조 → commandArgs 정합 위반 RangeError 분기. ④ plan.searchArgv 변조(원소 추가/순서 변경/길이 변경) → searchArgv 정합 위반 RangeError 분기. ⑤ descriptor throw 는 command-args·search-argv 재유도 도달 **전** 발생(순차 위임 순서 보존 — `jest.spyOn` 으로 후속 위임 `not.toHaveBeenCalled` 검증). 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **입력 비변형** — 가드 호출 후 입력 `plan`·`report` 객체 필드 변경 0(가드는 read-only 대조). (b) **searchArgv drift 세분** — 원소 값 변경 / 순서 뒤바꿈 / 길이 증감 각각 RangeError(deep-equal 이 원소·순서·길이까지 검증). (c) **결정성** — 동일 plan/report 로 가드 2회 호출 → 동일 결과(정상은 2회 다 통과, drift 는 2회 다 throw). (d) **위임 순서 단락(short-circuit)** — descriptor 위임 throw 시 command-args·search-argv 재유도 미호출(spy). (e) **구조 검증 우선** — plan 구조 위반(TypeError)이 재유도(위임 호출) **전**에 발생해 위임 미호출(spy). (f) **R-59** — 가드가 raw narrative(원본 활동/issue payload 전문) 구조적 미접근·미저장. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 신설** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` (신규 colocated spec). 위 R-112 4종 + negative cases 충분 cover. drift 검증은 실 컴포저 산출 plan 을 복제·변조(clone 후 mutate)해 주입, 위임 순서 검증은 `jest.spyOn`.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. 컴포저·위임 3빌더 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 신규 가드 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 컴포저·위임 3빌더 spec 무회귀).

## Out of Scope

- 컴포저 반환 직전 self-wire 배선(가드를 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan` 안에서 self-assert 호출, 요약축 T-0666 mirror) — 본 task 는 가드 신설만. self-wire 는 별도 후속 slice(T-0665 → T-0666 순서와 동형).
- 컴포저(`buildRealData...PublishPlan`)·위임 3빌더(`...Descriptor`/`...CommandArgs`/`...SearchGhArgv`) 본문 변경 — 본 가드는 컴포저 shape 을 대조하고 위임 helper 를 재호출만(재구현 0).
- daily-step `command-plan`(요약축 command-plan mirror) 등 다른 미미러 seam 신설 — 각 별도 slice.
- 종단 post-execution 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(stdout, commandArgs) 정합 가드 — 별도 helper(post-실행 leg).
- search seam(T-1012~T-1015 json-fields/hit-shape 가드·self-wire) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·필드 자동 보정 — 가드는 drift 를 throw 로 보고만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step publish-plan seam 에 컴포저(T-1016) + 정합 가드(본 task)가 갖춰진다 — 요약축 T-0595 → T-0665 의 daily-step mirror 완결.) 예상 후속 ①: 그 가드의 컴포저 반환 직전 self-wire 배선(요약축 T-0666 mirror — 컴포저가 반환 직전 `assertRealData...PublishPlanConsistentWithSource(plan, report)` self-assert 호출). ②: §109 잔여 미미러 seam(command-plan) mirror. ③: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

---
id: T-1022
title: daily-step publish-plan 종단 컴포저를 command-plan 중간 컴포저(T-1019) 위임으로 리팩터 (publish-plan = command-plan + search-argv 2단 위임, 요약축 T-0595 2층 구조 동형화, byte-identical 산출 보존)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step publish-plan 을 command-plan(T-1019) 위임으로 리팩터해 요약축 2층 구조(command-plan ⊂ publish-plan, T-0595) 동형화(T-1019 Follow-up ③). pre-check grep origin/main: 요약축 publish-plan(T-0595)은 buildRealDataResultIssueCommandPlan 위임(L142)이나 daily-step publish-plan(T-1016)은 descriptor(L146)→command-args(L150)→search-argv 직접 3단 위임(command-plan 컴포저 T-1019 미사용) → genuine 미동형 gap. pr test-only 2파일 file-disjoint dep[] stage5b 병렬-claimable, single-helper refactor ×1.0."
---

# T-1022 — daily-step publish-plan 을 command-plan 위임으로 리팩터 (2층 구조 동형화)

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 구조를 요약축(`result-issue-*`)과 동형으로 맞추는 slice. 요약축은 pre-실행 build-time chain 을 2층으로 박제한다 — (1) `buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}`(T-0594) 중간 컴포저, (2) `buildRealDataResultIssuePublishPlan(results, run) → {report, commandArgs, searchArgv}`(T-0595) 종단 컴포저. 그리고 **종단 컴포저가 중간 컴포저에 위임**한다 — `buildRealDataResultIssuePublishPlan` body 는 `const { report, commandArgs } = buildRealDataResultIssueCommandPlan(results, run);` → `const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);` 의 **2단 위임**(command-plan + search-argv)으로 합성한다(요약축 publish-plan.ts L142·L148 origin/main 확인). 즉 `command-plan ⊂ publish-plan` 구조.

daily-step 축은 command-plan 중간 컴포저(T-1019, `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report) → {descriptor, commandArgs}`)와 publish-plan 종단 컴포저(T-1016, `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report) → {descriptor, commandArgs, searchArgv}`) **둘 다** 갖췄으나, 종단 publish-plan 이 여전히 **하위 위임 빌더 3개(descriptor T-0896 → command-args T-0990 → search-argv)를 직접 3단 위임**할 뿐 중간 command-plan 컴포저(T-1019)를 경유하지 않는다(publish-plan.ts L146·L150·L156 origin/main 확인 — descriptor·command-args 를 직접 호출). 요약축이 갖춘 `command-plan ⊂ publish-plan` 2층 위임 구조가 daily-step 에는 아직 부재 — 두 컴포저가 병렬로 descriptor→command-args 구간을 각자 재합성한다(SSOT 관점 중복 위임 경로).

본 task 는 그 종단 컴포저를 리팩터해 동형화한다 — `buildRealDataDailyStepDualLegRunReportIssuePublishPlan` body 의 앞 2단(descriptor 직접 위임 → command-args 직접 위임)을 **command-plan 컴포저 1회 위임**으로 대체한다: `const { descriptor, commandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);` → `const searchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);`. 산출 shape `{descriptor, commandArgs, searchArgv}` 는 **byte-identical 보존**(외부 계약 무변)하고, self-wire(T-1018 consistency 가드 self-assert)도 그대로 유지한다. 이는 요약축 T-0595 종단 컴포저의 daily-step mirror 완성이며 T-1019 Follow-up ③ 이 명시한 자연 후속이다.

동형화의 실익: (1) descriptor→command-args 위임 경로가 command-plan 단일 SSOT 로 수렴(publish-plan 이 그 구간을 독립 재합성하지 않음), (2) command-plan 이 이미 self-assert 하는 정합(T-1021)을 publish-plan 이 재사용, (3) 향후 command-plan 리팩터가 publish-plan 에 자동 전파. 참고: command-plan 컴포저는 T-1021 self-wire 로 반환 직전 자기 consistency 가드를 self-assert 하므로, publish-plan 이 command-plan 을 경유하면 그 가드가 publish-plan 경로에서도 자동 실행된다(중첩 self-assert — 무해, 정상 plan 은 항상 통과, runtime cycle 없음 — command-plan 가드는 하위 위임만 import).

issue-still-relevant pre-check(origin/main grep): 요약축 publish-plan(T-0595)은 `buildRealDataResultIssueCommandPlan` 위임(publish-plan.ts L142) 확인 vs daily-step publish-plan(T-1016)은 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(L146)·`...CommandArgs`(L150) 직접 3단 위임이고 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 미import·미호출 확인 → genuine 미동형 gap. command-plan 컴포저(T-1019)·self-wire(T-1021) 둘 다 main 박제 확인 → 위임 대상 준비됨(중복 아님).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` (T-1016/T-1018, **본 task 의 유일 편집 대상 종단 컴포저**) — import 블록(descriptor 빌더 value import L90·command-args 빌더 value import L88·둘의 `import type` L89/L91·search-argv 빌더 L100·consistency 가드 L99), `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` body 의 3단 직접 위임(descriptor L145~146 → command-args L149~150 → search-argv L155~156) + `const plan = { descriptor, commandArgs, searchArgv }` + self-assert(T-1018) + `return plan`. 여기서 앞 2단(descriptor·command-args 직접 위임)을 command-plan 컴포저 1회 위임으로 대체하고 관련 주석 블록을 갱신한다. search-argv 위임·self-assert·container type·산출 shape 은 불변.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` (T-1019/T-1021, 위임 대상 중간 컴포저 — 참조·import 만, 본문 변경 0) — `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report) → {descriptor, commandArgs}`(L147) 시그니처·산출 컨테이너 type `RealDataDailyStepDualLegRunReportIssueCommandPlan`·throw 계약(descriptor/command-args 하위 위임 throw 전파)·T-1021 self-wire(반환 직전 자기 가드 self-assert) 확인.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` (요약축 T-0595, **직접 template** — 참조만, 본문 변경 0) — 종단 컴포저가 중간 command-plan 컴포저에 위임하는 2단 구조(`const { report, commandArgs } = buildRealDataResultIssueCommandPlan(...)` L142 → `const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs)` L148)·주석 톤. daily-step 은 이 패턴을 mirror 하되 입력이 단일 `report` 이고 산출 앞부분이 `{descriptor, commandArgs}`(요약축 `{report, commandArgs}` 대비 report 층 없음)인 점만 조정.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts` (T-1016/T-1018 colocated spec, **본 task 의 두번째 편집 대상**) — 기존 컴포저 describe(happy·error·flow·negative·self-wire). 특히 **위임 빌더 호출 검증(delegate-count) test** — 현재 descriptor 빌더·command-args 빌더를 직접 `jest.spyOn` 으로 호출 검증하는 케이스는 command-plan 컴포저 위임으로 갱신 필요(descriptor·command-args 는 이제 command-plan 내부에서 호출됨 → publish-plan 직접 spy 로는 관측 안 됨). self-wire·산출 shape·search-argv 위임 test 는 무회귀 보존.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts` 리팩터 — (1) import: descriptor 빌더 value import(`buildRealDataDailyStepDualLegRunReportIssueDescriptor`)·command-args 빌더 value import(`buildRealDataDailyStepDualLegRunReportIssueCommandArgs`)를 제거하고 command-plan 컴포저 value import(`import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";`) 1줄 추가. **`import type` 은 유지** — descriptor/command-args type 은 container type `RealDataDailyStepDualLegRunReportIssuePublishPlan` 정의에 여전히 사용(제거 시 컴파일 fail). search-argv 빌더(L100)·consistency 가드(L99) import 는 불변. (2) body: 앞 2단(descriptor 직접 위임 + command-args 직접 위임)을 `const { descriptor, commandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);` 1줄로 대체. search-argv 위임(`const searchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);`)·`const plan = { descriptor, commandArgs, searchArgv };`·self-assert(T-1018)·`return plan` 은 불변. (3) 파일 상단·body 주석 블록을 2단 위임(command-plan + search-argv) 구조로 갱신(요약축 T-0595 톤 mirror — "종단 publish-plan 은 중간 command-plan 컴포저(T-1019)에 앞 2단을 위임하고 search-argv 만 얹는다").
- [ ] **산출 byte-identical 보존** — 리팩터 전후 `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` 산출 `{descriptor, commandArgs, searchArgv}` 가 동일 report 입력에 대해 deep-equal(외부 계약 무변 — 위임 경로만 command-plan 경유로 바뀔 뿐 결과 동일). command-plan 컴포저가 반환하는 `{descriptor, commandArgs}` 는 종전 descriptor→command-args 직접 위임 산출과 동형이므로 회귀 0.
- [ ] **SSOT·재구현 0** — publish-plan 은 command-plan 컴포저를 import 해 호출만(descriptor/command-args 합성 로직을 publish-plan 내에서 직접 재호출하지 않음 — command-plan 단일 경로로 수렴). container type 정의·산출 shape 변경 0.
- [ ] **결정론·무공유·R-59 보존** — 컴포저는 여전히 순수 함수(부수효과 0 · 입력 `report` 비변형 · command-plan/search-argv 위임이 매 호출 새 트리 반환하므로 매 호출 새 plan 트리 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). self-assert(T-1018)는 read-only 대조라 산출 plan 비변형.
- [ ] **위임 throw 그대로 전파(자체 try/catch 0)** — `report.gitSha`/`report.dateToken` 빈/공백 → command-plan 컴포저 내부 descriptor 단계 하위 guard throw 가 재포장 없이 그대로 위로 전파(search-argv·self-assert 단계 미도달, 단락 short-circuit). command-plan 컴포저의 T-1021 self-assert throw 도 그대로 전파.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, per-leg status 포함) → 컴포저가 throw 없이 `{descriptor, commandArgs, searchArgv}` plan 반환. 반환 plan 이 리팩터 전 산출(별도 3단 직접 위임으로 재계산한 expected)과 deep-equal(byte-identical 회귀 검증). 1+.
- [ ] **Error path test 각 1+**: ① `report.gitSha` 빈/공백 → command-plan 위임 내부 descriptor 단계 throw 가 search-argv·self-assert 도달 전 그대로 전파. ② `report.dateToken` 빈/공백 → 위임 throw 전파. ③ (spy 기반) command-plan 컴포저를 `jest.spyOn` 으로 throw 주입 → publish-plan 이 재포장 없이 그대로 전파하고 search-argv 위임 미호출. 각 1+.
- [ ] **Flow/branch test**: ① 정상 report → command-plan 위임 성공 → search-argv 위임 성공 → self-assert 통과 → plan 반환 분기. ② command-plan 위임 throw → search-argv 위임 미도달 분기(command-plan 컴포저 module `jest.spyOn` throw 주입 시 search-argv 빌더 spy `not.toHaveBeenCalled` 검증). 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **command-plan 실제 위임 검증** — 정상 경로에서 command-plan 컴포저 module 을 `jest.spyOn` 해 publish-plan 이 정확히 1회, 원본 report 인자로 호출함을 검증(위임 배선이 실제로 command-plan 경유인지 — 본 리팩터 핵심 검증). (b) **descriptor/command-args 직접 위임 부재** — publish-plan 이 descriptor 빌더·command-args 빌더를 **직접** 호출하지 않음을 검증(그 두 module 을 `jest.spyOn` 했을 때, command-plan spy 를 통짜 stub 으로 대체한 시나리오에서 직접 호출 0 — 위임 경로가 command-plan 내부로 이동했음 확인). (c) **입력 비변형** — 컴포저 호출 후 입력 `report` 객체 필드 변경 0. (d) **결정성** — 동일 report 로 2회 호출 → 두 plan deep-equal. (e) **무공유** — 두 plan 의 descriptor/commandArgs/searchArgv(및 중첩 createArgs.labels 배열)가 참조 비공유. (f) **R-59** — 컴포저가 raw narrative(원본 활동/issue payload 전문) 구조적 미접근·미저장. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 갱신** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts` 의 기존 delegate-count test(descriptor 빌더·command-args 빌더 직접 호출 검증)를 command-plan 위임 검증으로 갱신(위 negative (a)(b)). 위 R-112 4종 + negative cases 충분 cover. 기존 self-wire·산출 shape·search-argv 위임·byte-identical test 는 무회귀 보존. command-plan 위임 검증·순서 단락·throw 전파는 `jest.spyOn`(command-plan 컴포저 module 및 search-argv 빌더 module) 사용.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. command-plan 컴포저(T-1019/T-1021)·search-argv 빌더·consistency 가드(T-1017)·위임 빌더(descriptor/command-args) 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). publish-plan 컴포저 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 command-plan·publish-plan·위임 빌더 spec 무회귀).

## Out of Scope

- command-plan 컴포저(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`, T-1019/T-1021)·search-argv 빌더·consistency 가드(T-1017)·위임 빌더(descriptor T-0896/command-args T-0990) 본문 변경 — 본 task 는 publish-plan 의 위임 경로만 command-plan 경유로 바꾼다(대상 helper 는 import·호출만).
- publish-plan consistency 가드(T-1017)를 command-plan consistency 가드(T-1020) 위임으로 리팩터 — 가드 본문 변경 대상이라 별도 slice(현 publish-plan 가드는 3단 독립 재유도 유지, 무회귀).
- 종단 post-execution gh-command-plan(T-0997, stdout+commandArgs) seam 변경 0 — 별개 seam(post-실행 leg, 이미 consistency+self-wire 완결).
- outcome-report seam(T-1000~T-1007)·search seam(T-1012~T-1015) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 컴포저는 정상 합성만(silent 수선 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step build-time chain 이 요약축과 완전 동형 — command-plan(T-1019~T-1021) ⊂ publish-plan(T-1016~T-1018, 본 task 리팩터로 위임 수렴).) 예상 후속 ①: publish-plan consistency 가드(T-1017)를 command-plan consistency 가드(T-1020) 위임으로 리팩터해 가드 재유도 경로도 2층 동형화(가드 본문 변경 slice). ②: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

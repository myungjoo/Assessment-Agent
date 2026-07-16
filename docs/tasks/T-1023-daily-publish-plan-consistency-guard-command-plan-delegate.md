---
id: T-1023
title: daily-step publish-plan consistency 가드(T-1017) 재유도 경로를 command-plan 컴포저(T-1019) 위임으로 리팩터 (가드 재유도도 2층 구조 동형화, 요약축 T-0665 mirror, byte-identical 판정 보존)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step publish-plan consistency 가드(T-1017)의 재유도 경로를 command-plan 컴포저(T-1019) 위임으로 리팩터해 요약축 T-0665 의 2층 재유도(command-plan ⊂ publish-plan)와 동형화(T-1022 Follow-up ①). pre-check grep origin/main: 요약축 가드(T-0665)는 buildRealDataResultIssueCommandPlan 컴포저 위임 재유도(L192) vs daily-step 가드(T-1017)는 descriptor(L206)→command-args(L209)→search-argv 직접 3단 재유도 → genuine 미동형 gap. pr test-only 2파일 file-disjoint dep[] stage5b 병렬-claimable, single-helper refactor ×1.0."
---

# T-1023 — daily-step publish-plan consistency 가드 재유도를 command-plan 컴포저 위임으로 리팩터 (가드 2층 동형화)

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 구조를 요약축(`result-issue-*`)과 동형으로 맞추는 slice. 직전 T-1022 가 daily-step **publish-plan 컴포저** 를 command-plan 컴포저(T-1019) 위임으로 리팩터해 `command-plan ⊂ publish-plan` 2층 구조를 컴포저 축에서 완성했다. 본 task 는 그 **거울상 가드** — publish-plan **consistency 가드**(T-1017)의 재유도 경로도 같은 2층 위임으로 동형화한다(T-1022 Follow-up ①).

요약축 종단 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources`(T-0665)는 single-source 재유도를 **2층 위임**으로 엮는다 — `const { report, commandArgs } = buildRealDataResultIssueCommandPlan(results, run);`(command-plan 컴포저 T-0594 위임) → `const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);`(search-argv 위임). 즉 가드의 재유도도 `command-plan ⊂ publish-plan` 위임 구조를 그대로 반영한다(publish-plan-consistency.ts L192·L194 origin/main 확인).

daily-step 가드 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(T-1017)는 아직 재유도를 **하위 위임 빌더 3개(descriptor T-0896 → command-args T-0990 → search-argv)로 직접 3단** 엮는다(publish-plan-consistency.ts L206~213 origin/main 확인 — descriptor·command-args 를 직접 호출). 요약축이 가진 `command-plan ⊂ publish-plan` 2층 재유도 구조가 daily-step 가드에는 아직 부재 — 가드가 command-plan 컴포저(T-1019)를 경유하지 않고 descriptor→command-args 구간을 자체 재합성한다(SSOT 관점 중복 재유도 경로).

본 task 는 그 가드를 리팩터해 동형화한다 — 재유도 body 의 앞 2단(descriptor 직접 위임 → command-args 직접 위임)을 **command-plan 컴포저 1회 위임**으로 대체한다: `const { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);` → `const expectedSearchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs);`. 3 구성요소(descriptor/commandArgs/searchArgv) byte-identical 판정·구조 결손 TypeError / drift RangeError 정책·throw 전파·검사 순서(fail-fast)는 **전부 불변**. 이는 요약축 T-0665 가드의 daily-step mirror 완성이며, T-1022 컴포저 리팩터와 정확히 동형인 가드 축 짝이다.

동형화의 실익: (1) 가드의 descriptor→command-args 재유도 경로가 command-plan 컴포저 단일 SSOT 로 수렴(가드가 그 구간을 독립 재합성하지 않음 — 컴포저와 가드가 동일 위임 경로 공유), (2) command-plan 컴포저는 T-1021 self-wire 로 반환 직전 자기 consistency 가드(T-1020)를 self-assert 하므로, 가드가 command-plan 을 경유하면 그 command-plan consistency(T-1020)가 재유도 경로에서도 자동 실행된다(T-1022 Follow-up ① 이 지칭한 "command-plan consistency 가드 위임" 이 transitively 실현 — 중첩 self-assert, 무해, 정상 재유도는 항상 통과, runtime cycle 없음: command-plan 가드는 하위 위임만 import), (3) 향후 command-plan 리팩터가 가드 재유도에 자동 전파.

issue-still-relevant pre-check(origin/main grep): 요약축 publish-plan-consistency 가드(T-0665)는 `buildRealDataResultIssueCommandPlan` 컴포저 위임 재유도(publish-plan-consistency.ts L192) 확인 vs daily-step publish-plan-consistency 가드(T-1017)는 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(L206)·`...CommandArgs`(L208) 직접 3단 재유도이고 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 미import·미호출 확인 → genuine 미동형 gap. command-plan 컴포저(T-1019)·self-wire(T-1021)·컴포저 리팩터(T-1022) 전부 main 박제 확인 → 위임 대상 준비됨(중복 아님).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` (T-1017, **본 task 의 유일 편집 대상 가드**) — 상단 topology 주석(L21~28 "요약축 T-0665 2 source·2단 → daily-step single source·3단")·import 블록(descriptor 빌더 value import L79·command-args 빌더 value import L78·둘의 관련 type·search-argv 빌더 L81)·`assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)` body 의 재유도 3단(descriptor L206~207 → command-args L208~209 → search-argv L210~213) + descriptor/commandArgs/searchArgv 3 구성요소 순차 deep-equal 비교(L215~234) + `assertPlanStructure`(L106~136). 여기서 재유도 앞 2단(descriptor·command-args 직접 위임)을 command-plan 컴포저 1회 위임으로 대체하고 관련 주석 블록을 갱신한다. search-argv 재유도·3 구성요소 비교·구조 검증·throw 정책은 불변.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` (T-1019/T-1021, 위임 대상 중간 컴포저 — 참조·import 만, 본문 변경 0) — `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report) → {descriptor, commandArgs}` 시그니처·산출 컨테이너 type·throw 계약(descriptor/command-args 하위 위임 throw 전파)·T-1021 self-wire(반환 직전 자기 consistency 가드 self-assert) 확인.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` (요약축 T-0665, **직접 template** — 참조만, 본문 변경 0) — 가드가 중간 command-plan 컴포저에 위임하는 2층 재유도 구조(`const { report, commandArgs } = buildRealDataResultIssueCommandPlan(results, run)` L192 → `const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs)` L194)·주석 톤. daily-step 은 이 패턴을 mirror 하되 source 가 단일 `report` 이고 재유도 앞부분 산출이 `{descriptor, commandArgs}`(요약축 `{report, commandArgs}` 대비 report 렌더 층 대신 descriptor)인 점만 조정.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` (T-1017 colocated spec, **본 task 의 두번째 편집 대상**) — 기존 가드 describe(happy·TypeError·RangeError·throw 전파·flow·결정성·비변형). 특히 **"위임 순차 순서 / short-circuit (spyOn)" describe(L322~368)** — 현재 descriptor 빌더(`descriptorModule`)·command-args 빌더(`commandArgsModule`)를 직접 `jest.spyOn` 으로 재유도 호출/미호출 검증하는 케이스는 command-plan 컴포저 위임으로 갱신 필요(descriptor·command-args 는 이제 command-plan 컴포저 내부에서 호출됨). module-level spy 라 command-plan 경유 호출도 잡히지만, "가드가 직접 위임" 이라는 framing 을 "가드가 command-plan 컴포저 경유 위임" 으로 갱신하고 command-plan 컴포저 위임 검증 test 를 추가한다. happy·산출 판정·throw 전파 test 는 무회귀 보존.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` 리팩터 — (1) import: descriptor 빌더 value import(`buildRealDataDailyStepDualLegRunReportIssueDescriptor`)·command-args 빌더 value import(`buildRealDataDailyStepDualLegRunReportIssueCommandArgs`)를 제거하고 command-plan 컴포저 value import(`import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";`) 1줄 추가. search-argv 빌더 import·`RealDataDailyStepDualLegRunReport` type import·`RealDataDailyStepDualLegRunReportIssuePublishPlan` type import 는 불변. (2) body 재유도: 앞 2단(descriptor 직접 위임 `expectedDescriptor` + command-args 직접 위임 `expectedCommandArgs`)을 `const { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);` 1줄로 대체. search-argv 재유도(`const expectedSearchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs);`)·descriptor/commandArgs/searchArgv 3 구성요소 순차 deep-equal 비교·`assertPlanStructure`·RangeError/TypeError 메시지는 불변. (3) 파일 상단 topology 주석 블록·body 재유도 주석을 2층 위임(command-plan + search-argv) 구조로 갱신(요약축 T-0665 톤 mirror — "가드 재유도도 중간 command-plan 컴포저(T-1019)에 앞 2단을 위임하고 search-argv 만 얹는다"). 요약축 대비 남는 topology 차이(single source `report` + descriptor 첫 필드)는 주석에 명시 유지.
- [ ] **판정 byte-identical 보존** — 리팩터 전후 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)` 가 동일 (plan, report) 입력에 대해 동일 동작(정합 plan → void, 각 구성요소 drift → 동일 RangeError, 구조 결손 → 동일 TypeError). command-plan 컴포저가 반환하는 `{descriptor, commandArgs}` 는 종전 descriptor→command-args 직접 재유도 산출과 동형이므로 판정 회귀 0.
- [ ] **SSOT·재구현 0** — 가드는 command-plan 컴포저를 import 해 재유도 호출만(descriptor/command-args 합성 로직을 가드 내에서 직접 재호출하지 않음 — command-plan 단일 경로로 수렴). 3 구성요소 deep-equal 비교·구조 검증 로직·에러 정책 변경 0.
- [ ] **결정론·무변형·순수 보존** — 가드는 여전히 순수 함수(부수효과 0 · 입력 `report`/`plan` 비변형 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0). 재유도 산출물은 로컬 대조 후 폐기(노출 0). 동일 입력 → 동일 동작.
- [ ] **위임 throw 그대로 전파(자체 try/catch 0)** — `report.gitSha`/`report.dateToken` 빈/공백 → command-plan 컴포저 내부 descriptor 단계 하위 guard throw 가 재포장 없이 그대로 위로 전파(search-argv 재유도·구성요소 비교 미도달, 단락 short-circuit). command-plan 컴포저의 T-1021 self-assert throw 도 그대로 전파.
- [ ] **Happy-path test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, 다양한 per-leg status 조합) 로 컴포저가 산출한 plan → 가드가 throw 없이 정상 반환(void). round-trip 정합. 리팩터 전과 동일하게 통과. 1+.
- [ ] **Error path test 각 1+**: ① `plan` null/undefined 또는 descriptor/commandArgs 비-object 또는 searchArgv 비-배열·원소 비-string → TypeError(구조 결손). ② 각 구성요소(descriptor/commandArgs/searchArgv) drift → RangeError(값 정합 위반). ③ `report.gitSha`/`report.dateToken` 빈/공백 → command-plan 위임 내부 descriptor 단계 throw 가 재유도·비교 도달 전 그대로 전파(RangeError 아님). ④ (spy 기반) command-plan 컴포저를 `jest.spyOn` 으로 throw 주입 → 가드가 재포장 없이 그대로 전파하고 search-argv 재유도 미호출. 각 1+.
- [ ] **Flow/branch test**: ① 정합 → void 분기. ② 3 구성요소 각각 drift → RangeError 분기(구성요소별 1+). ③ 구조 결손 → TypeError 분기(재유도 위임 미도달). ④ 재유도 chain throw 전파 분기. ⑤ command-plan 위임 throw → search-argv 재유도 미도달 분기(command-plan 컴포저 module `jest.spyOn` throw 주입 시 search-argv 빌더 spy `not.toHaveBeenCalled` 검증). 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **command-plan 실제 재유도 위임 검증** — 정상 경로에서 command-plan 컴포저 module 을 `jest.spyOn` 해 가드가 정확히 1회, 원본 report 인자로 호출함을 검증(재유도 배선이 실제로 command-plan 경유인지 — 본 리팩터 핵심 검증). (b) **구조 위반 시 command-plan 재유도 미호출** — plan 구조 결손(TypeError) 시 command-plan 컴포저 spy `not.toHaveBeenCalled`(구조 검증이 재유도 전에 short-circuit 함을 보존). (c) **입력 비변형** — 가드 호출 후 `report`/`plan` 객체 필드 변경 0. (d) **결정성** — 동일 (plan, report) 로 2회 호출 → 두 번 다 동일 동작(정합이면 둘 다 void). (e) **재유도 산출 무노출** — 가드가 재유도 expected 를 반환/누출하지 않고 void(정합 시)만 반환. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 갱신** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` 의 기존 "위임 순차 순서 / short-circuit (spyOn)" describe(descriptor 빌더·command-args 빌더 직접 재유도 호출/미호출 검증)를 command-plan 컴포저 위임 검증으로 갱신(위 negative (a)(b) + error path ④ + flow ⑤). 위 R-112 4종 + negative cases 충분 cover. 기존 happy·산출 판정·throw 전파·결정성·비변형 test 는 무회귀 보존. command-plan 위임 검증·short-circuit·throw 전파는 `jest.spyOn`(command-plan 컴포저 module 및 search-argv 빌더 module) 사용.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. command-plan 컴포저(T-1019/T-1021)·search-argv 빌더·publish-plan 컴포저(T-1016/T-1018/T-1022)·위임 빌더(descriptor/command-args) 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). publish-plan-consistency 가드 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 command-plan·publish-plan·위임 빌더 spec 무회귀).

## Out of Scope

- command-plan 컴포저(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`, T-1019/T-1021)·search-argv 빌더·publish-plan 컴포저(T-1016/T-1018/T-1022)·위임 빌더(descriptor T-0896/command-args T-0990) 본문 변경 — 본 task 는 publish-plan-consistency 가드의 재유도 경로만 command-plan 경유로 바꾼다(대상 helper 는 import·호출만).
- publish-plan-consistency 가드를 command-plan-consistency 가드(T-1020)에 **직접** 위임하도록 재작성 — command-plan 컴포저는 T-1021 self-wire 로 이미 T-1020 을 self-assert 하므로 컴포저 경유로 transitively 실현된다. 가드→가드 직접 위임 재작성은 별개 설계 결정(요약축 T-0665 도 command-plan 컴포저 위임이지 consistency 가드 직접 위임 아님 — mirror 유지).
- 종단 post-execution gh-command-plan(T-0997) seam 변경 0 — 별개 seam(post-실행 leg).
- outcome-report seam(T-1000~T-1007)·search seam(T-1012~T-1015) 변경 0 — 별도 seam.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 가드는 정합 판정만(silent 수선 0, fail-fast).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step build-time chain 이 요약축과 컴포저·가드 양 축 모두 완전 동형 — 컴포저(T-1016~T-1018+T-1022 리팩터) + 가드(T-1017+본 task 리팩터) 둘 다 `command-plan ⊂ publish-plan` 2층 위임 구조로 수렴.) 예상 후속 ①: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉 — build-time chain 정합 봉합이 사실상 완결됐으므로 다음 자연 stream 은 live 도달.

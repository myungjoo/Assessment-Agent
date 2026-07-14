---
id: T-0997
title: daily-step dual-leg run report issue-gh-command-plan 종단 컴포저 반환 직전 consistency drift-guard self-wire (resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan 산출 plan 을 단일 반환 지점에서 즉시 자가 검증)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 115
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-gh-command-plan
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts
plannerNote: "P5 §109 test-hardening — T-0994(PR #888 3930ab80)으로 봉한 issue-gh-command-plan 종단 컴포저 consistency 가드를 producer(T-0902) 단일 반환 지점 직전 self-wire(T-0996/T-0993 mirror). issue-gh-command-plan leaf 삼단 완결. T-0994 이미 main 박제라 dep[]. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0997 — daily-step dual-leg run report issue-gh-command-plan 종단 컴포저 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈의 `gh search` stdout + 명령-args 묶음을 입력받아 (1) parse → (2) resolveAction → (3) buildGhArgv 3-단계를 합성해 `{action, argv}` gh 실행 plan 을 산출하는 **종단 순수 컴포저** `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts`, T-0902)을 T-0994 가 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`, PR #888 squash 3930ab80 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 컴포저에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 합성 drift 를 잡는다. 누군가 3-단계 합성 순서·분기 매핑·argv 전달을 편집(예: resolveAction↔buildGhArgv 순서 교란, action 분기 오매핑, marker(=searchQuery) 재합성, argv 잉여/누락 원소)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 손상 plan 이 step ④ live wiring(`execFile('gh', argv)`)으로 조용히 새어나가 잘못된 이슈에 갱신하거나 중복 이슈를 생성할 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 이 plan 을 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)` 를 스스로 호출해 산출 즉시 자가 검증하도록 한다. 이렇게 하면 합성 로직과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live wiring)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982~T-0996 로 이어진 issue 파이프라인 leaf 별 producer→consistency→self-wire 삼단 패턴의 issue-gh-command-plan 종단 컴포저 mirror 이자, T-0994 의 Follow-ups(그리고 T-0996 Follow-ups 의 "다음 slice 1순위")가 명시적으로 예고한 후속 slice 다. 이 배선으로 issue-gh-command-plan 종단 컴포저도 producer(T-0902)→consistency(T-0994)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void — 가드가 3 위임 helper 를 독립 재유도해 동일 plan 을 확인)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 컴포저 producer 를 import 하지 않고(oracle 독립성 — plan/action/command-args 타입만 `import type` 로 참조, consistency→gh-command-plan value 엣지 0) 재유도용 3 위임 helper 만 value import 하므로, 컴포저가 이 가드를 value import 해도 **런타임 순환 의존 없음**(consistency 파일 line 70–73 이 명시). T-0994 가 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

**주의 — 컴포저는 반환 지점이 1곳이다**: `return { action, argv };`(현재 88행) 단일 지점. issue-action leaf(T-0996)가 create/update 두 return 지점을 배선한 것과 달리, 본 컴포저는 3 위임 결과를 하나의 plan 으로 묶어 한 곳에서 반환하므로 그 단일 return 직전에 `const plan = { action, argv };` 로 묶고 self-assert 후 `return plan;` 하면 된다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` (T-0902) — self-wire 대상 producer. `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs): RealDataDailyStepDualLegRunReportIssueGhCommandPlan`. **단일 반환 지점**: 88행 `return { action, argv };`. 그 직전에 `const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = { action, argv };` 로 묶고 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)` 호출 후 `return plan;`. 3-단계 합성 로직(parse → resolveAction → buildGhArgv) 재정의 0 — 기존 그대로 두고 return 직전 self-assert 만 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` (T-0994, main 박제 3930ab80) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs): void` — 정합이면 void, plan/plan.argv/plan.action/stdout/commandArgs 구조 결손 = TypeError / action 분기 오매핑·update issueNumber drift·argv 길이·argv 원소 byte 불일치 = RangeError / 위임 helper(비JSON stdout·빈 marker·빈 title/body·비양수 issueNumber) throw 그대로 전파. 이 파일은 producer 를 import 하지 않으며 plan/action/command-args 타입만 `import type` 로 참조한다(oracle 독립성). 컴포저가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → gh-command-plan value 엣지 0, line 70–73).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts` (T-0902) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다(기존 case 회귀 없이).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0996 self-wire 완료본, PR #890 ac17df41 main 박제) — 반환 직전 self-wire 배선의 직접 선례(action 을 `const` 로 묶기 + self-assert + spy 검증 spec 관례). 배선 형태·spy 검증 spec 관례를 그대로 gh-command-plan 축으로(단일 return 지점으로) 옮긴다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency` 에서 value import 하고, `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 의 **단일 반환 지점**(88행)에서 산출된 plan 을 `const plan = { action, argv }` 로 묶은 뒤 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)` 를 호출하고 그 plan 을 반환한다. 정합이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 3-단계 합성 로직(parse → resolveAction → buildGhArgv) 자체는 재정의 0 — 기존 그대로 두고 return 직전 self-assert 만 추가.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 이 정합 plan 을 throw 0 으로 정상 반환함을 assert 1+ — create 분기(후보 0건: stdout `"[]"` / marker 미포함 hits)·update 분기(후보 1건, 후보 다수 → 최소 number) 각각. 반환 plan 이 기존 기대(`{action, argv}` deep-equal)와 유지 검증 1+.
  - **Error path**: 기존 위임 helper 방어 throw(비JSON stdout, 빈/공백 marker, 빈/공백 title/body, 비양수 issueNumber)가 self-wire 도입으로 가려지지 않음 — 각 입력이 여전히 컴포저(또는 self-assert)의 Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` 를 감싼 뒤, create 분기 입력·update 분기 입력 각각에서 그 spy 가 `(반환된 plan, stdout, commandArgs)` 인자로 정확히 호출됐음을 assert(배선 존재 증명 — self-wire 제거 시 이 test 가 fail = de-facto regression guard). 두 분기 각각 최소 1 case.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 컴포저 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 이 동일 RangeError 를 전파, silent 삼킴 0) — create 분기·update 분기 각각, (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 plan 이 여전히 기대와 deep-equal, 입력 commandArgs 객체·중첩 createArgs.labels 미변형, 매 호출 새 plan·새 argv 배열 무공유) assert 1+.
  - **§9 / §12 안전성**: fixture/plan/stdout/commandArgs/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 plan·stdout·commandArgs 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`(T-0994) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`(T-0994) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- 위임 helper(parse T-0901 / resolveAction T-0898 / buildGhArgv T-0899) 수정 0 — read-only. 3-단계 합성 순서·분기·argv 산출 재계산 0.
- issue-action leaf(T-0898/T-0995/T-0996) · issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) 의 재수정 0 — 이미 삼단 완결.
- 잔여 consistency-미봉 sibling(`-issue-search-argv` / `-issue-outcome-parse-shape`)의 consistency/self-wire 신설 0 — 별도 순차 slice.
- gh search response 의 실 JSON 파싱 / `--json` 옵션 합성 재현 0 — 컴포저가 이미 위임 parse helper 로 처리. 본 task 는 배선만.
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재유도/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-gh-command-plan 종단 컴포저도 producer(T-0902)→consistency(T-0994)→self-wire(본 task) 삼단 완결 — issue-action·issue-gh-argv·issue-command-args·issue-descriptor sub-helper 와 동형. §109 test-hardening 은 이후 잔여 sibling 으로 이동.
- daily-report issue-박제 vein 잔여(순차 mirror 후보): (1) consistency-미봉 sibling `-issue-search-argv` / `-issue-outcome-parse-shape` consistency 신설(다음 slice 1순위 — 본 vein 내 삼단 미착수 sibling), 이후 각 self-wire.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

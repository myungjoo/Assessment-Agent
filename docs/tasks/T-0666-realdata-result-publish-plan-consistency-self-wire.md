---
id: T-0666
title: publish-plan 종단 컴포저 산출 직전 publish-plan consistency 가드 self-wire 배선 (buildRealDataResultIssuePublishPlan)
phase: P5
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan.ts
  - test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — T-0665 신설 publish-plan consistency 가드를 종단 컴포저 반환 직전 self-wire (T-0664 outcome-report self-wire 의 종단-composer mirror)"
---

# T-0666 — publish-plan 종단 컴포저 산출 직전 consistency 가드 self-wire 배선

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 연속 slice. 직전 T-0665 가 `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)` 순수 가드를 **신설만** 했고(종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run) → {report, commandArgs, searchArgv}` 의 산출 경로에는 아직 미배선 — T-0665 Out of Scope + Follow-up). 본 task 는 그 가드를 **컴포저가 plan 을 반환하기 직전 self-assert** 배선해, 컴포저가 두 위임 layer(`buildRealDataResultIssueCommandPlan` → `buildRealDataResultIssueSearchGhArgv`) 사이에 끼어 결과를 변형/누락/순서 뒤바꾸는 합성 회귀를 호출 시점에 fail-fast 로 차단한다 (T-0664 outcome-report-from-output self-wire 의 종단-composer mirror, T-0647/T-0648 builder/composer self-wire 와 동형). 정상 합성이면 가드는 void → 컴포저 반환 plan byte-identical 보존, 회귀 시 컴포저가 손상 plan 을 caller 에 넘기기 전에 throw.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 배선 대상 종단 컴포저. `buildRealDataResultIssuePublishPlan(results, run)`(L128~146)이 (1) `buildRealDataResultIssueCommandPlan(results, run)` → `{report, commandArgs}` (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` → `searchArgv` 를 위임-체인으로 엮어 L145 에서 `return { report, commandArgs, searchArgv }` 한다. 본 task 는 이 함수가 `return` 하기 직전에 산출 plan 을 지역 변수로 받아 self-assert 후 반환하도록 배선.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` — self-wire 할 가드. `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run): void`(L179~) 시그니처 확인 — 인자 순서 `(plan, results, run)`. 가드는 내부에서 두 위임 함수를 같은 순서로 직접 재유도해 byte-identical expected 산출 후 plan 3 구성요소 정합 검증. import 원천.
- `test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` — 컴포저 colocated spec. 본 task 는 self-wire 배선 검증 describe/it 를 append (spyOn 으로 가드가 (산출 plan, results, run) 인자로 정확히 1회 호출됨 검증 + 정상 합성이면 throw 0, 가드가 throw 하면 컴포저도 throw 전파).
- 패턴 선례: `docs/tasks/T-0664-realdata-result-outcome-report-from-output-consistency-self-wire.md` (T-0663 신설 가드의 composer self-wire — import 1줄 + 호출 1지점, 반환 직전 self-assert, byte-identical 보존). 본 task 는 그 종단-composer 동형.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `buildRealDataResultIssuePublishPlan` 가 `return { report, commandArgs, searchArgv }` 하던 것을, 산출 plan 을 지역 변수(`const plan = { report, commandArgs, searchArgv }`)로 받아 `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)` 를 **반환 직전 1회 self-assert** 후 그 plan 을 반환하도록 배선. import 1줄(consistency 가드) + 호출 1지점만 추가 — 컴포저 합성 순서·위임 호출·주석 본문 변경 0, 반환 plan byte-identical 보존(무공유 유지).
- [ ] **비변형 / 순수**: 배선으로 부수효과 0·새 외부 dependency 0·credential/env/네트워크 0. 가드는 read-only 검증이라 plan/results/run mutate 0. 정상 합성이면 self-assert 가 void → 기존 동작과 관측 불가능하게 동일.
- [ ] **Happy-path unit test**: 정상 (results, run) — 빈 results·단일·다수 result 분기 각각 — 으로 컴포저 호출 시 throw 0(정상 plan 반환). 산출 plan 이 직전 가드를 통과함을 round-trip 으로 확인.
- [ ] **Error path unit test**: self-assert 가 throw 하는 경로 — 가드를 `jest.spyOn` 으로 throw 하도록 mock 했을 때 컴포저가 그 throw 를 삼키지 않고 caller 로 전파함 1+ test. 또한 위임 command-plan/search-argv 가 throw 하는 입력(예: run.gitSha/dateToken 빈/공백)에서는 가드 진입 전에 위임 throw 가 전파됨 1+ test.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 통과 → plan 반환 분기, (b) 가드 throw 전파 분기, (c) 위임(command-plan/search-argv) throw 가 가드 진입 전 전파되는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 가드가 (산출 plan, results, run) 정확한 인자·순서·1회로 호출됨을 spyOn 으로 검증, (b) 가드 throw 시 컴포저 throw 전파, (c) 위임 throw 입력(run.gitSha 빈/공백)에서 가드 미호출(위임 단계 종료), (d) 동일 입력 두 번 호출 deterministic(같은 plan·report/commandArgs/searchArgv byte-identical), (e) 입력 results/run 비변형(배열·원소·run mutate 0), (f) 반환 plan 무공유(반환값 mutate 가 후속 호출에 누출 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경 대상 컴포저 파일 `realdata-e2e-result-issue-publish-plan.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. consistency 가드 값 import 추가로 인한 runtime cycle 0 (tsc green 으로 확인 — 컴포저와 가드는 같은 위임 함수들을 import 하므로 순환 위험 없음).

## Out of Scope

- `assertRealDataResultIssuePublishPlanConsistentWithSources` 가드 본문·위임 함수(`buildRealDataResultIssueCommandPlan`/`buildRealDataResultIssueSearchGhArgv`) 본문 수정 — 본 task 는 self-wire 배선만, 가드·위임은 T-0665/T-0594/T-0586 산출물 그대로 사용.
- 컴포저 합성 로직·반환 형태 변경 — 반환 plan 은 byte-identical·무공유 보존, 본 task 는 반환 직전 검증 호출 1지점만 추가.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape/outcome-report)의 추가 가드 또는 self-wire — 본 task 는 publish-plan 종단 컴포저 consistency 가드 self-wire 1건만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 배선만.
- production `src/` 코드 변경 — test helper 단독.
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 로 publish-plan 종단 컴포저-seam consistency chain(가드신설 T-0665 → composer self-wire T-0666)이 완결됨. 이로써 realdata-e2e step④ build-time 정합 가드 사슬의 descriptor/command-args/gh-argv/parse-shape/outcome-report/publish-plan seam 이 모두 신설+self-wire 짝으로 닫힘. 다음 후보: step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토, 또는 잔여 seam 일제 점검.)

---
id: T-0670
title: outcome-step-args 컴포저 산출 직전 consistency 가드 self-wire 배선 (buildRealDataResultOutcomeStepArgs)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-outcome-step-args.ts
  - test/helpers/realdata-e2e-result-outcome-step-args.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — T-0669 신설 outcome-step-args consistency 가드를 컴포저 반환 직전 self-wire (T-0668 publish-step-args composer self-wire 의 post-실행 outcome layer mirror)"
---

# T-0670 — outcome-step-args 컴포저 산출 직전 consistency 가드 self-wire 배선

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 연속 slice. 직전 T-0669 가 `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout)` 순수 가드를 **신설만** 했고(outcome-step-args 컴포저 `buildRealDataResultOutcomeStepArgs(runPlan, stdout) → RealDataResultIssueOutcomeReport` 의 산출 경로에는 아직 미배선 — T-0669 Out of Scope + Follow-up). 본 task 는 그 가드를 **컴포저가 outcome report 를 반환하기 직전 self-assert** 배선해, 컴포저가 `runPlan.run` 추출·`buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 위임·산출 report 반환 과정에서 run 인자 위치를 뒤바꾸거나 report 를 변형/누락하는 합성 회귀를 호출 시점에 fail-fast 로 차단한다 (T-0668 publish-step-args composer self-wire 의 post-실행 outcome layer mirror, T-0666/T-0664 self-wire 와 동형). 정상 합성이면 가드는 void → 컴포저 반환 report byte-identical·무공유 보존, 회귀 시 컴포저가 손상 report 를 caller 에 넘기기 전에 throw. 이로써 outcome-step-args layer seam 의 가드신설(T-0669)+self-wire(T-0670) 짝이 닫힌다.

## Required Reading

- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — 배선 대상 컴포저. `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(L109~118)이 L117 에서 `return buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로 위임-반환한다. 본 task 는 이 함수가 `return` 하기 직전에 산출 report 를 지역 변수(`const report = buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`)로 받아 self-assert 후 반환하도록 배선.
- `test/helpers/realdata-e2e-result-outcome-step-args-consistency.ts` — self-wire 할 가드. `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout): void`(T-0669 신설) 시그니처 확인 — 인자 순서 `(report, runPlan, stdout)`. 가드는 내부에서 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로 single-source expected 직접 재유도해 byte-identical 정합 검증. import 원천.
- `test/helpers/realdata-e2e-result-outcome-step-args.spec.ts` — 컴포저 colocated spec(이미 존재). 본 task 는 self-wire 배선 검증 describe/it 를 append(spyOn 으로 가드가 (산출 report, runPlan, stdout) 인자로 정확히 1회 호출됨 검증 + 정상 합성이면 throw 0, 가드가 throw 하면 컴포저도 throw 전파).
- 패턴 선례: `docs/tasks/T-0668-realdata-result-publish-step-args-consistency-self-wire.md` (T-0667 신설 publish-step-args 가드의 composer self-wire — import 1줄 + 호출 1지점, 반환 직전 self-assert, byte-identical 보존). 본 task 는 그 post-실행 outcome layer 동형. 다른 점: 단일 report 객체(`{issueNumber,url,gitSha,dateToken,summaryLine}`) 반환, 가드 인자 순서 `(report, runPlan, stdout)`.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `buildRealDataResultOutcomeStepArgs` 가 `return buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 하던 것을, 산출 report 를 지역 변수(`const report = buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`)로 받아 `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout)` 를 **반환 직전 1회 self-assert** 후 그 report 를 반환하도록 배선. import 1줄(consistency 가드) + 호출 1지점만 추가 — 컴포저 위임 호출·인자 순서·주석 본문 변경 0, 반환 report byte-identical·무공유 보존.
- [ ] **비변형 / 순수**: 배선으로 부수효과 0·새 외부 dependency 0·credential/env/네트워크 0. 가드는 read-only 검증이라 report/runPlan/stdout mutate 0. 정상 합성이면 self-assert 가 void → 기존 동작과 관측 불가능하게 동일.
- [ ] **Happy-path unit test**: 정상 (runPlan, stdout) — create-URL stdout·edit-URL stdout 분기 각각 — 으로 컴포저 호출 시 throw 0(정상 outcome report 반환). 산출 report 가 직전 가드를 통과함을 round-trip 으로 확인.
- [ ] **Error path unit test**: self-assert 가 throw 하는 경로 — 가드를 `jest.spyOn` 으로 throw 하도록 mock 했을 때 컴포저가 그 throw 를 삼키지 않고 caller 로 전파함 1+ test. 또한 위임 `buildRealDataResultIssueOutcomeReportFromOutput` 가 throw 하는 입력(예: 잘못된 stdout — URL 미발견/비-github/`/pull/`, runPlan.run.gitSha/dateToken 빈/공백)에서는 가드 진입 전에 위임 throw 가 전파됨 1+ test.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 통과 → report 반환 분기, (b) 가드 throw 전파 분기, (c) 위임 throw 가 가드 진입 전 전파되는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 가드가 (산출 report, runPlan, stdout) 정확한 인자·순서·1회로 호출됨을 spyOn 으로 검증, (b) 가드 throw 시 컴포저 throw 전파, (c) 위임 throw 입력(잘못된 stdout 또는 runPlan.run.gitSha 빈/공백)에서 가드 미호출(위임 단계 종료), (d) 동일 입력 두 번 호출 deterministic(같은 report·issueNumber/url/gitSha/dateToken/summaryLine byte-identical), (e) 입력 runPlan/stdout 비변형(runPlan.run mutate 0), (f) 반환 report 무공유(반환값 mutate 가 후속 호출 결과에 누출 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경 대상 컴포저 파일 `realdata-e2e-result-outcome-step-args.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. consistency 가드 값 import 추가로 인한 runtime cycle 0 (tsc green 으로 확인 — 컴포저와 가드는 같은 위임 함수를 import 하므로 순환 위험 없음).

## Out of Scope

- `assertRealDataResultOutcomeStepArgsConsistentWithSources` 가드 본문·위임 함수(`buildRealDataResultIssueOutcomeReportFromOutput`) 본문 수정 — 본 task 는 self-wire 배선만, 가드·위임은 T-0669/T-0596 산출물 그대로 사용.
- 컴포저 합성 로직·반환 형태 변경 — 반환 report 는 byte-identical·무공유 보존, 본 task 는 반환 직전 검증 호출 1지점만 추가.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape/outcome-report/publish-plan/publish-step-args)의 추가 가드 또는 self-wire — 본 task 는 outcome-step-args 컴포저 consistency 가드 self-wire 1건만.
- 상위 `buildRealDataE2eStepArgs`/`realdata-e2e-run-plan` 컴포저용 가드 또는 self-wire — 별도 후속 slice.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 배선만.
- production `src/` 코드 변경 — test helper 단독.
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 로 outcome-step-args layer seam consistency chain(가드신설 T-0669 → composer self-wire T-0670)이 완결됨. 그로써 step④ 의 pre-실행 publish(T-0667/T-0668) + post-실행 outcome(T-0669/T-0670) 두 step-args layer seam 짝이 모두 닫힘. 다음 후보: 그 위 상위 `buildRealDataE2eStepArgs`/`realdata-e2e-run-plan` 컴포저 seam 의 가드신설+self-wire 짝, 또는 step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토.)

## Result

- **DONE** 2026-06-25T20:10Z (PR #585 squash merge `eb3d3eb`). reviewer r1 APPROVE + 4-게이트 PASS, CI green(양 job).
- `buildRealDataResultOutcomeStepArgs` 가 산출 outcome report 를 반환 직전 `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout)` self-assert 배선(import 1줄 + 호출 1지점, byte-identical·무공유 보존, +20/-1 1 file). colocated spec self-wire describe 7 it 추가(spyOn 인자·1회 / throw 전파 / 위임 throw 가드 진입 전 / deterministic / 비변형 / 무공유).
- 컴포저 파일 line/branch/func 100%, 전역 line 99.95%/func 100%, 7932 test green. 새 dep 0·src 변경 0·test-only.

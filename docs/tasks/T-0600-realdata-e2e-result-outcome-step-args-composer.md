---
id: T-0600
title: 실 평가 e2e run plan + gh stdout → 결과 이슈 실행 리포트(run 일관) 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-23
plannerNote: "P5 PLAN 109행 step④ post-실행 run-plan 연결 컴포저 buildRealDataResultOutcomeStepArgs(runPlan, stdout) — T-0599(pre-실행)의 post-실행 대칭, run 재전달 0"
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-outcome-step-args.ts
  - test/helpers/realdata-e2e-result-outcome-step-args.spec.ts
---

# T-0600 — 실 평가 e2e run plan + gh stdout → 결과 이슈 실행 리포트(run 일관) 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 build-time 순수 layer 는 step-level run-plan 연결 컴포저로 run/modelId 단일 source threading 을 구축해 왔다 — T-0598 `buildRealDataEvaluationStepArgs(runPlan, activities)`(평가 단계에 `runPlan.pipeline.modelId` thread), T-0599 `buildRealDataResultPublishStepArgs(runPlan, results)`(step④ **pre-실행** publish plan 에 `runPlan.run` thread). 그러나 step④의 **post-실행** 측 단일 진입 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596)은 `run`(`RealDataResultIssueRunRef` = gitSha + dateToken)을 **독립 인자로 다시 받는다** — live runner 가 step ① `buildRealDataE2eRunPlan` 에 넘겨 검증·보존한 `runPlan.run` 과, post-실행 outcome report 에 넘기는 `run` 이 build-time 에서 같은 값임을 보장하지 못한다(두 군데 수동 전달 — 잘못된 gitSha/dateToken 으로 실행 리포트가 어긋날 수 있는 사고 표면).

본 컴포저는 그 분리된 link 를 단일 순수 함수 `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport` 로 묶어, **검증된 run plan 의 단일 `runPlan.run` 만을** outcome report 로 thread 한다(run 재전달 0 → step ①↔step④ post-실행 run 식별자 일관 구조적 보장). 이는 **T-0599(pre-실행 publish plan threading)의 post-실행 대칭**이며, 이로써 step④의 두 sub-path(pre-실행 publish / post-실행 outcome)가 모두 단일 검증 `runPlan.run` 에서 thread 되어 run-plan threading layer 가 완결된다. DB/네트워크/env/live-LLM/credential/gh 실행 0(build-time 순수, cloud-safe·dependency-free·dependsOn []).

## Required Reading

- `test/helpers/realdata-e2e-result-publish-step-args.ts` — T-0599 박제. 본 task 의 pre-실행 대칭 패턴(검증된 `runPlan.run` 단일 source thread, 독립 run 인자 미수신, 위임 throw 전파, 무공유) 의 정확한 모델. 본 컴포저는 이 패턴을 post-실행 측에 그대로 적용한다.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — T-0596 박제. 본 컴포저가 위임할 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` 의 시그니처·throw 의미(파서 throw + 빌더 run guard throw)·반환 type.
- `test/helpers/realdata-e2e-run-plan.ts` — T-0597 박제. `RealDataE2eRunPlan` 컨테이너 type(`{ pipeline, run }`)과 `run` 필드(`RealDataResultIssueRunRef`)의 출처. 본 컴포저가 `runPlan.run` 을 추출한다.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef`·`RealDataResultIssueOutcomeReport` import type 출처 확인용(신규 type 정의 0 보장).
- `test/helpers/realdata-e2e-result-publish-step-args.spec.ts` — colocated spec 작성 시 ordering·describe/it 명명·R-112 4종 + negative cases 충분 cover 패턴 참고(본 spec 의 직접 대칭).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-outcome-step-args.ts` 신설. `buildRealDataResultOutcomeStepArgs(runPlan: RealDataE2eRunPlan, stdout: string): RealDataResultIssueOutcomeReport` export. 구현은 `runPlan.run` 을 추출해 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 위임 호출만 — outcome 파싱·리포트 합성·run guard 재구현 0.
- [ ] **독립 `run` 인자 미수신** — 시그니처가 `(runPlan, stdout)` 2 인자뿐. caller 가 step ① 과 post-실행에 run 을 따로 두 번 넘길 수 없음을 type 으로 강제(run 재전달 0).
- [ ] **신규 type 정의 0** — `RealDataE2eRunPlan` / `RealDataResultIssueOutcomeReport` / `RealDataResultIssueRunRef` 는 전부 `import type` 재사용. 컨테이너 type 도 위임 측 `RealDataResultIssueOutcomeReport` 재사용.
- [ ] **happy-path test 1+**: 유효 `runPlan`(검증된 run) + 유효 gh create stdout(github.com 이슈 URL) → 위임이 산출한 `RealDataResultIssueOutcomeReport`(issueNumber·url·summaryLine 등) 를 그대로 반환. gh edit stdout 케이스도 1+.
- [ ] **error path test 1+ (각 분기별)**:
  - `runPlan.run.gitSha` 빈/공백-only → 위임 하위 빌더(T-0590) run guard throw 가 자체 try/catch 없이 그대로 전파됨을 검증.
  - `runPlan.run.dateToken` 빈/공백-only → 동일하게 빌더 guard throw 전파.
  - 잘못된 stdout(URL 미발견 / 비-github 호스트 / `/pull/` PR URL / issueNumber 0·선행0·비정수) → 위임 파서(T-0589) throw 전파. 최소 2 종 이상 negative stdout 케이스.
- [ ] **flow / branch cover**: 본 컴포저 자체에 추가 분기는 없음(전부 위임이 담당) — "분기 없음, 위임 helper 가 전 분기 담당" 을 spec 본문 주석/describe 로 명시하고, 위임의 정상 / 파서-throw / 빌더-guard-throw 경로 각각을 본 컴포저 진입점에서 1+ test 로 실행해 통과 경로를 cover.
- [ ] **negative cases 충분 cover**: 빈 gitSha · 빈 dateToken · 공백-only(탭/개행 포함) gitSha · URL 미발견 stdout · 비-github 호스트 · PR URL · 비정수 issueNumber 각 1+ test. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유 test**: 동일 `(runPlan, stdout)` 두 번 호출 → deep-equal(`toEqual`) 결과 + 서로 다른 객체 참조(`not.toBe`). 입력 `runPlan` 객체 mutate 0 검증(호출 전후 deep-equal).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper 의 line/branch/func 전 분기 cover(colocated spec 가 위임 정상·throw 전파 경로 모두 실행).

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live).
- 실 `gh issue create` / `gh issue edit` / `execFile('gh', argv)` 실행 — `stdout: string` 는 인자로만 받음(step④ live wiring, credential gate).
- stdout 파싱 / outcome 추출 / 리포트 합성 / run guard 재구현 — 전부 `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596, 그 하위 T-0589/T-0590) 위임 안에서 처리(중복 0).
- `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
- pre-실행 publish plan 합성(`buildRealDataResultPublishStepArgs`, T-0599 — 본 컴포저는 post-실행 outcome report 만 책임).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
- daily-test.sh step_eval wiring / gh 이슈 실 박제(step④ live, deferred — LAN/credential gate).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

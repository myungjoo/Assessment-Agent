---
id: T-0599
title: 실 평가 e2e run plan + results → 결과 이슈 publish plan(run 일관) 순수 컴포저
phase: P5
status: DONE
commitMode: pr
mergedAs: 381190b
prNumber: 512
reviewRounds: 1
coversReq: [REQ-009, REQ-059]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-publish-step-args.ts
  - test/helpers/realdata-e2e-result-publish-step-args.spec.ts
plannerNote: P5 PLAN 109행 step④ run-plan 연결 컴포저 buildRealDataResultPublishStepArgs(runPlan, results)→publish plan; T-0597 검증 run plan 의 단일 run 을 T-0595 publish plan 으로 thread(재전달 0·step①↔step④ run 일관 구조적 보장), cloud-safe·dependency-free·dependsOn []
---

# T-0599 — 실 평가 e2e run plan + results → 결과 이슈 publish plan(run 일관) 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 build-time 순수 layer 는 양 끝이 단일 진입점으로 닫혀 있다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597) → `{pipeline, run}`, 평가 연결 `buildRealDataEvaluationStepArgs(runPlan, activities)`(T-0598)는 `runPlan.pipeline.modelId` 를 평가 plan 으로 thread 해 step①↔step③ 모델 정책 일관을 구조적으로 보장한다. 그러나 step④ 결과 이슈 박제의 pre-실행 단일 진입 `buildRealDataResultIssuePublishPlan(results, run)`(T-0595)는 `run`(`RealDataResultIssueRunRef` = gitSha + dateToken)을 **독립 인자로 다시 받는다** — live runner 가 step① `buildRealDataE2eRunPlan` 에 넘겨 검증·보존된 `runPlan.run` 과, step④ publish plan 에 넘기는 `run` 이 build-time 에서 같은 값임을 **보장하지 못한다**(두 군데 수동 전달 — run 식별자 불일치 사고 표면: 잘못된 gitSha/dateToken 로 결과 이슈가 박제되거나 멱등 marker 가 어긋날 수 있음).

본 컴포저는 그 분리된 두 link 를 단일 순수 함수 `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan` 로 묶어, **검증된 run plan 의 단일 `run` 만을 publish plan 으로 thread** 한다(run 재전달 0 → step①↔step④ run 일관 구조적 보장). T-0598(modelId threading)의 step④ 대칭이며, 스트림 전반의 "검증된 runPlan 필드를 단일 source 로 thread 해 caller 가 divergent 값을 재전달 못 하게 하는" 박제(T-0598)와 동형이다. `results` 는 인자로만 받으므로(실 LLM 산출 미호출) 여전히 build-time 순수·cloud-safe·dependency-free 다.

## Required Reading

- `docs/tasks/T-0598-realdata-e2e-evaluation-step-args-composer.md` — step②→③ run-plan 연결 컴포저 task 정의(modelId threading 패턴·Out of Scope 동형 참조 — 본 task 는 그 step④ 대칭).
- `test/helpers/realdata-e2e-run-plan.ts` — `RealDataE2eRunPlan { pipeline, run }` 출력과 `run`(`RealDataResultIssueRunRef`)의 위치/타입(import type 재사용 대상).
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 위임할 `buildRealDataResultIssuePublishPlan(results, run)` → `RealDataResultIssuePublishPlan { report, commandArgs, searchArgv }` 의 계약·run guard throw 전파.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` type(gitSha/dateToken) 정의 위치.
- colocated spec 위치(신규): `test/helpers/realdata-e2e-result-publish-step-args.spec.ts` (helper 와 같은 디렉토리, R-112 colocated 우선 룰).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-publish-step-args.ts` 신설 — 순수 함수 `buildRealDataResultPublishStepArgs(runPlan: RealDataE2eRunPlan, results: EvaluationResult[]): RealDataResultIssuePublishPlan` export. `runPlan.run` 을 추출해 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 위임 합성(report-plan·명령-args·search argv 합성 재구현 0 — T-0595 위임만). 신규 type 정의 0(`RealDataResultIssuePublishPlan` / `RealDataE2eRunPlan` / `EvaluationResult` import type 재사용).
- [ ] run 은 **runPlan 에서만** 도출(독립 run 인자 미수신) — caller 가 step① 과 step④ 에 run 을 따로 두 번 넘길 수 없게 해 run 식별자 일관을 구조적으로 보장.
- [ ] happy-path unit test 1+ — 유효 `runPlan`(검증된 run 보유) + 다수 `results` → `{report, commandArgs, searchArgv}` 정상 산출, `report.descriptor`/`commandArgs.searchQuery` 의 run 토큰 일관(예: marker/dateToken 이 `runPlan.run` 에서 유래) 검증.
- [ ] error path unit test 1+ — `runPlan.run.gitSha` 또는 `runPlan.run.dateToken` 이 빈/공백-only 인 경우 위임 `buildRealDataResultIssuePublishPlan` 하위 run guard throw 가 자체 try/catch 없이 그대로 전파됨을 검증(조용한 통과 0). (단, `buildRealDataE2eRunPlan` 이 이미 run 을 검증하므로 정상 경로의 `runPlan` 은 빈 run 을 갖지 않는다 — 본 test 는 위임 guard 가 방어선으로 살아있음을 직접 구성한 빈-run `runPlan` 으로 검증.)
- [ ] flow / branch coverage — 빈 `results` 배열 분기(→ report.summary count 0·전 슬롯 0·totalVolume 0 + commandArgs/searchArgv 정상 합성, run 유효 시 throw 0)와 단일/다수 `results` 분기 각 1+ test.
- [ ] negative cases 충분 cover — (1) run.gitSha 빈 문자열 throw, (2) run.gitSha 공백-only(스페이스/탭/개행) throw, (3) run.dateToken 빈/공백-only throw, (4) 빈 results + 유효 run 경계(throw 0, count 0 plan), (5) 입력 `runPlan`/`results` mutate 0(호출 후 입력 객체·배열 not-mutated 검증), (6) 무공유(동일 입력 두 번 호출 → deep-equal 이되 not-same-reference 산출 — report/commandArgs/searchArgv 트리 각각) 각 1+ test.
- [ ] 결정론 검증 test — 동일 `(runPlan, results)` 두 번 호출 시 deep-equal 결과.
- [ ] R-59 정합 — 산출 plan 은 식별자 카운트·분류 enum 분포·정량 합산 / 이슈 식별자·요약 렌더 본문 / 명령-args / search argv(marker 만 옮김) 만 보유하고 raw 활동 본문을 구조적으로 보유하지 않음을 주석으로 명시(위임 helper 들이 이미 raw 미보유라 본 컴포저도 미보유).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper line/branch/func 100% 목표.

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045) — `results: EvaluationResult[]` 는 인자로만 받음.
- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제(step ④ live wiring — credential gate). 본 컴포저는 (runPlan, results) → publish plan descriptor 만 산출(부수효과 0).
- 요약 집계 / 마크다운 렌더 / descriptor 합성 / 명령-args 합성 / report-plan 합성 / search argv 합성 — 전부 T-0595(`buildRealDataResultIssuePublishPlan`) 위임 안에서 처리(중복 0).
- gh create/edit stdout 파싱 → outcome report(post-실행 측 `buildRealDataResultIssueOutcomeReportFromOutput`, T-0596) — 본 컴포저는 pre-실행 publish plan 만 책임(stdout 미보유).
- `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
- `runPlan.run` 의 실 도출(daily-test `latest-result.json` / git short sha — 인자로만 받음).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시 비움)

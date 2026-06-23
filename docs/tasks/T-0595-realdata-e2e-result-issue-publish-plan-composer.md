---
id: T-0595
title: 실 평가 e2e EvaluationResult[] + run → 결과 이슈 publish plan (report + commandArgs + searchArgv) 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan.ts
  - test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts
plannerNote: "P5 PLAN 109행 step④ build-time chain pre-실행 단일 진입 컴포저 — (results,run)→{report,commandArgs,searchArgv}, T-0594+T-0586 위임 합성, cloud-safe·dependency-free"
---

# T-0595 — 실 평가 e2e EvaluationResult[] + run → 결과 이슈 publish plan (report + commandArgs + searchArgv) 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 post-evaluation interpretation(평가 산출 → 결과 이슈 박제) 측 build-time chain 은 T-0594 `buildRealDataResultIssueCommandPlan(results, run)` 로 `EvaluationResult[]` + run → `{report, commandArgs}` 까지 닫혔고, T-0586 `buildRealDataResultIssueSearchGhArgv(commandArgs)` 로 commandArgs → **첫 gh 호출(search) argv** 까지 닫혔다. 그러나 step ④ live runner 가 한 번에 받아야 하는 "결과 리포트 + 멱등 명령-args + **실행할 첫 gh argv(search)**" 묶음은 아직 두 helper(T-0594 + T-0586)를 caller 가 수동으로 엮어야 산출된다. 본 컴포저는 그 2 단계를 단일 순수 함수 `buildRealDataResultIssuePublishPlan(results, run)` → `{report, commandArgs, searchArgv}` 로 합성해 **pre-실행 build-time chain 의 단일 진입점**을 닫는다. 산출 `searchArgv` 는 runner 가 `execFile('gh', searchArgv)` 로 실행할 첫 명령이고, 산출 `commandArgs` 는 그 stdout 과 함께 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(T-0588)로 넘어간다 — 즉 본 plan 하나로 live runner 가 (results, run) → "무엇을 먼저 실행하고(searchArgv) · 그 결과로 무엇을 합성할지(commandArgs) · 무엇을 리포트할지(report)"를 전부 build-time 에 확정한다. seed-side `buildRealDataPipelinePlan`(T-0592) / evaluate-side `buildRealDataEvaluationPlan`(T-0591) / 박제 종단 `resolveRealDataResultIssueGhCommandPlan`(T-0588) / post-evaluation `buildRealDataResultIssueCommandPlan`(T-0594) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다. DB/네트워크/env/live-LLM/credential/gh 실행 0 — cloud cron 자율·dependency-free·dependsOn []. 실 수집·실 Ollama LLM round-trip·실 gh 박제·daily-test step_eval wiring 은 LAN/credential gate 로 deferred 유지(ADR-0045).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — T-0594 `buildRealDataResultIssueCommandPlan(results, run)` → `RealDataResultIssueCommandPlan {report, commandArgs}` (위임 대상 1).
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — T-0586 `buildRealDataResultIssueSearchGhArgv(commandArgs)` → `string[]` search argv (위임 대상 2). guard·결정론·무공유 정합 참조.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs` type 정의(import type 재사용 cross-check).
- `test/helpers/realdata-e2e-result-report-plan.ts` — `RealDataResultReportPlan` type 정의(import type 재사용).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` type 정의(import type 재사용).
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` type 정의(import type 재사용).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` (T-0588 colocated spec) — 종단 컴포저 spec 패턴 참조(위임 throw 전파·무공유 검증 스타일).

신규 spec 은 colocated: `test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` (NestJS/jest colocated convention, T-0594 동형).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-publish-plan.ts` 신규 — `buildRealDataResultIssuePublishPlan(results: EvaluationResult[], run: RealDataResultIssueRunRef): RealDataResultIssuePublishPlan` 순수 함수. 산출 `{report, commandArgs, searchArgv}` — (1) `buildRealDataResultIssueCommandPlan(results, run)`(T-0594) 위임 → `{report, commandArgs}`, (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)`(T-0586) 위임 → `searchArgv: string[]`. 신규 type 정의는 `RealDataResultIssuePublishPlan` 컨테이너 1 개뿐(report/commandArgs/searchArgv 필드 각 기존 type 또는 `string[]`).
- [ ] **위임 재구현 0** — 요약 집계·descriptor 합성·명령-args 합성·search argv 합성 로직을 본 helper 가 재구현하지 않는다(T-0594·T-0586 위임 호출만 순서대로 엮음). grep 으로 `buildRealDataResultSummary`/`buildRealDataResultIssueCommandArgs` 등 하위 helper 직접 호출이 없음(T-0594·T-0586 만 호출) 확인.
- [ ] **import type 재사용** — `EvaluationResult` / `RealDataResultIssueRunRef` / `RealDataResultReportPlan` / `RealDataResultIssueCommandArgs` 전부 `import type` 재사용(신규 중복 정의 0).
- [ ] **Happy-path unit test 1+** — 단일/다수 유효 `results` + 유효 run → `{report, commandArgs, searchArgv}` 모두 산출 검증: `report` 가 T-0594 산출과 deep-equal, `commandArgs` 가 T-0594 산출과 deep-equal, `searchArgv` 가 `buildRealDataResultIssueSearchGhArgv(commandArgs)` 산출과 deep-equal(=`["search","issues","--match","body",<searchQuery>,"--json","number,title,body","--limit","30"]`).
- [ ] **Error path unit test 1+** — run.gitSha 빈/공백 → 하위 report-plan guard throw 가 자체 try/catch 없이 전파(commandArgs/searchArgv 단계 미도달). run.dateToken 빈/공백 → throw 전파. (각 1+ test.)
- [ ] **Flow / branch 분기 cover** — (a) 빈 `results` 배열 + 유효 run → report.summary count 0·전 슬롯 0·totalVolume 0 + commandArgs/searchArgv 정상 합성(throw 0). (b) 단일 result. (c) 다수 result. 각 1+ test.
- [ ] **negative cases 충분 cover** — run.gitSha 빈문자열 / 공백-only / 탭·개행 each throw, run.dateToken 빈문자열 / 공백-only each throw (위임 `assertNonBlank` 동형), 그리고 산출 후 반환 plan 의 `searchArgv` mutate(push)가 입력 / 재호출 결과에 누설되지 않음(무공유) + `report`/`commandArgs` 가 재호출 결과와 not-same-ref(매 호출 새 트리) 검증. 단일 negative 만 작성 금지 — 각 guard 분기마다 cover.
- [ ] **결정론·무공유** — 동일 (results, run) 두 번 호출 → deep-equal 결과 + report/commandArgs/searchArgv 모두 not-same-ref(새 객체/배열). 입력 `results` 배열·원소 / `run` 객체 mutate 0 검증(호출 전후 deep-equal 스냅샷).
- [ ] **R-59 정합** — plan 이 raw narrative / 원본 활동 본문을 구조적으로 미보유(위임 helper 들이 이미 미보유 → 구조적으로 불가). report/commandArgs/searchArgv 필드만 보유 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (전체 line ≥ 80% / function ≥ 80%, 신규 helper line/branch/func 100% 목표).

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / `EvaluationResult` 실 산출(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045).
- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제(step ④ live wiring — credential gate). 본 컴포저는 (results, run) → publish plan descriptor 만 산출(부수효과 0).
- gh search stdout 파싱 → action 분기 → create/edit argv 합성(T-0587/T-0584/T-0585/T-0588 측 `resolveRealDataResultIssueGhCommandPlan`) — 본 helper 는 그 컴포저가 받는 `commandArgs` + 첫 gh `searchArgv` 까지만 책임(stdout 은 미보유).
- 요약 집계(T-0580) / 마크다운 렌더(T-0581) / descriptor 합성(T-0582) / 명령-args 합성(T-0583) / report-plan 합성(T-0593) — 전부 T-0594 / T-0586 위임 안에서 처리(재구현 금지).
- run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short sha — 인자로만 받음).
- `--repo owner/repo` / repo slug 결정 / gh auth — 실 wiring 의 환경 책임(T-0586 Out of Scope 그대로 상속).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 검증·배열 연산만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

---
id: T-0588
title: 실 평가 e2e 결과 이슈 search stdout + commandArgs → gh 실행 plan 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan.ts
  - test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts
plannerNote: P5 PLAN 109행 step④ build-time chain 종단 컴포저 — parse(T-0587)→resolve(T-0584)→gh argv(T-0585) 를 단일 순수 함수로 합성, 실 execFile 만 남김
---

# T-0588 — 실 평가 e2e 결과 이슈 search stdout + commandArgs → gh 실행 plan 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행 (🟢 실 평가 e2e — github.com 실 활동) step④ (daily-test 결과를 result/rolling 이슈에 박제) 박제 직전 build-time chain 의 **종단 컴포저** 를 박제한다.

T-0584 ~ T-0587 로 step④ 의 모든 단위 layer (descriptor → command-args → action resolver → gh argv → search argv → search stdout 파서) 가 순수 함수로 닫혔다. 그러나 caller (live wiring) 가 이들을 정확한 순서로 엮는 책임은 아직 여러 helper 호출로 흩어져 있다 — caller 가 (3) `parseRealDataResultIssueSearchOutput(stdout)` → (4) `resolveRealDataResultIssueAction(hits, marker)` → (5) `buildRealDataResultIssueGhArgv(action, commandArgs)` 를 손으로 연결해야 한다. 본 task 는 이 **3-단계 합성을 단일 순수 함수 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 로 박제** 해, build-time chain 을 종단까지 닫는다.

이로써 live wiring chain 은 (1) search argv (T-0586) → (2) `execFile('gh', searchArgv)` (deferred, credential gate) → (3~5) **search stdout + commandArgs → gh 실행 argv (본 컴포저)** → (6) `execFile('gh', argv)` (deferred) 로 줄어든다. 순수 함수 layer 가 모두 한 진입점으로 합성되고, 남는 외부 경계는 (2)·(6) 두 `execFile` 뿐이다 — LAN/credential gate 로 deferred 유지.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-search-parse.ts](../../test/helpers/realdata-e2e-result-issue-search-parse.ts) line 100~ — `parseRealDataResultIssueSearchOutput(stdout): RealDataResultIssueSearchHit[]` 시그니처 (본 컴포저의 1단계 위임 대상).
- [test/helpers/realdata-e2e-result-issue-action.ts](../../test/helpers/realdata-e2e-result-issue-action.ts) line 60~136 — `RealDataResultIssueSearchHit`, `RealDataResultIssueAction` (discriminated union: `{action:'create'}` | `{action:'update', issueNumber}`), `resolveRealDataResultIssueAction(hits, marker)` (2단계 위임 대상).
- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) line 82~136 — `RealDataResultIssueCommandArgs` ({searchQuery, createArgs, updateArgs}) 구조. `marker` 는 별도 입력이 아니라 `commandArgs.searchQuery` (= descriptor.marker) 를 그대로 resolver 의 marker 로 전달한다 (재합성 0).
- [test/helpers/realdata-e2e-result-issue-gh-argv.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv.ts) line 104~ — `buildRealDataResultIssueGhArgv(action, commandArgs): string[]` (3단계 위임 대상).
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-112 4종 + coverage 임계) · §12 (언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` 에 순수 함수 `resolveRealDataResultIssueGhCommandPlan(stdout: string, commandArgs: RealDataResultIssueCommandArgs): { action: RealDataResultIssueAction; argv: string[] }` 박제. 입력·출력 타입 (`RealDataResultIssueCommandArgs`, `RealDataResultIssueAction`) 은 기존 helper 에서 `import type` 재사용 (신규 type 정의 0 — 중복 금지).
- [ ] 동작: (1) `parseRealDataResultIssueSearchOutput(stdout)` 로 `RealDataResultIssueSearchHit[]` 산출 → (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` 로 action 결정 → (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` 로 argv 합성. 반환은 `{action, argv}` (caller 가 action 종류 로깅·argv 실행 모두 가능). marker 는 `commandArgs.searchQuery` 를 그대로 전달 (별도 marker 인자 없음 — 재합성 0).
- [ ] 위임 helper 의 throw 가 그대로 전파 (자체 try/catch 로 삼키지 않음): 잘못된 stdout (비JSON/비배열/원소 type 불일치/number 비양수) → 파서 throw 전파, 빈/공백 searchQuery → resolver throw 전파, create/update title·body 빈/공백 또는 issueNumber 비양수 → argv 빌더 throw 전파.
- [ ] 결정론·무공유: 동일 `(stdout, commandArgs)` 두 번 호출 → byte-identical 결과 (deep equal). 입력 `commandArgs` (중첩 createArgs.labels 포함) mutate 0, 매 호출 새 `{action, argv}` 객체·새 argv 배열 반환 (위임 helper 들이 이미 무공유 — 본 컴포저도 입력 보존).
- [ ] **Happy-path unit test 1+** (R-112 ①): (a) 후보 0건 stdout (`"[]"`) → `{action:{action:'create'}, argv: gh issue create ...}` 검증 (argv 에 `--title`/`--body`/`--label` 포함), (b) marker 포함 후보 1건 stdout → `{action:{action:'update', issueNumber:N}, argv: gh issue edit String(N) ...}` 검증, (c) 후보 2+ 건 → 최소 number update 로 합성됨 검증 (T-0584 멱등 회귀 보호가 컴포저 경유에서도 보존).
- [ ] **Error path unit test 1+** (R-112 ②): (a) 잘못된 JSON stdout (`"not json"`) → 파서 throw 전파, (b) 빈/공백 `searchQuery` → resolver throw 전파, (c) create 분기에서 createArgs.title 빈/공백 → argv 빌더 throw 전파 — 각 별도 case (어느 layer 의 throw 인지 분리 검증).
- [ ] **Flow/branch cover** (R-112 ③): create 분기 (후보 0건) + update 분기 (후보 1+건) 각 1+ test. 각 위임 helper throw 전파 분기도 cover.
- [ ] **Negative cases 충분 cover** (R-112 ④, 단일 negative 금지 — 분기마다): (a) stdout 이 비배열 JSON object, (b) hit number 0/음수/비정수, (c) searchQuery 공백-only, (d) update 분기 issueNumber 비양수 (resolver 가 정상이면 발생 안 하나, commandArgs.updateArgs.body 빈/공백 같은 빌더 guard) — 각 1+ throw 검증 (위임 helper 의 guard 가 컴포저 경유에서도 전파됨 확인).
- [ ] R-59 정합: 컴포저는 입력 외 데이터를 생성·저장하지 않는다 (위임 helper 들이 이미 raw narrative 미보유 — 본 컴포저도 hits 의 body 를 분기 판정에만 쓰고 반환 argv 에 descriptor.body (=marker 라인 포함) 만 전달, 추가 활동 본문 0).
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` 작성 (NestJS colocated convention — helper 옆). `describe`/`it` 문자열 한국어로 의도 명확화.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (신규 helper line ≥ 80% / function ≥ 80% — single-helper 라 100% 기대).
- [ ] DB/네트워크/env/live-LLM/credential/gh 실행 0 — build-time 순수 함수 (cloud cron 자율 실행 가능, dependency-free).

## Out of Scope

- 실 `execFile('gh', argv)` 실행 — search 든 create/edit 든 (step④ live wiring, credential gate, deferred). 본 컴포저는 stdout(이미 받은) + commandArgs → 실행할 argv 산출까지만.
- 단위 layer 자체 재구현 — parse(T-0587) / resolve(T-0584) / gh argv(T-0585) 는 import 재사용만, 로직 복제 0.
- search argv 합성 (T-0586 위임 — 본 컴포저는 search 결과 stdout 을 받는 시점부터).
- descriptor → command-args 합성 (T-0583 위임 — 본 컴포저 입력은 이미 합성된 commandArgs).
- 신규 type 정의 (`RealDataResultIssueCommandArgs`/`RealDataResultIssueAction`/`RealDataResultIssueSearchHit` 전부 import 재사용 — 중복 금지).
- daily-test.sh `step_eval` wiring·`latest-result.json` 연동·실 Ollama round-trip (step③④ live — ADR-0045 LAN=AKIHA gate, deferred).
- production `src/` 코드 변경 — test helper 단독 (타입·함수 import 재사용만).
- 새 외부 dependency (execa / zod 등) 도입 — 기존 helper import + 합성만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비움)

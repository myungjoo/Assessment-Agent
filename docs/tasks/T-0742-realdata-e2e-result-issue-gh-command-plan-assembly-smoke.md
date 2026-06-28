---
id: T-0742
title: realdata-e2e result-issue gh-command-plan 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T04:25:44Z
result: "DONE — PR #657 squash 235fb290, reviewer round1 APPROVE, 4-게이트 PASS, CI green. test-only +406/-0 1파일(신규 spec 25/25 pass). resolveRealDataResultIssueGhCommandPlan(stdout,commandArgs)→{action,argv} step④ search-side 종단 조립 smoke 박제 — step④ 두 절반 조립 smoke 쌍 닫음."
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 215
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step④ 종단 search-side 컴포저 resolveRealDataResultIssueGhCommandPlan(stdout,commandArgs)→{action,argv} 조립 smoke. T-0741 command-plan(results→commandArgs)의 stdout-side 후속 형제, test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-issue-gh-command-plan-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts]
---

# T-0742 — realdata-e2e result-issue gh-command-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 step④(결과 이슈 박제) 의 **종단** 컴포저는 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` (T-0588, self-wire T-0698) 가 닫는다 — gh issue search stdout + 명령-args 묶음(`RealDataResultIssueCommandArgs`) 을 (1) `parseRealDataResultIssueSearchOutput(stdout)` 로 `RealDataResultIssueSearchHit[]` 로, (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` 로 create/update action 으로, (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` 로 실 `gh` 인자-벡터로 합성해 `{action, argv}` 를 반환한다. 이 컴포저는 step④ live wiring 이 실제로 `execFile('gh', argv)` 에 넘기는 **마지막** plan 을 만든다 — 후보 0건(stdout `"[]"` 또는 marker 미포함)이면 `gh issue create`, 후보 1+ 건이면 최소 issueNumber 의 `gh issue edit`(멱등 갱신) 으로 분기한다. 이 컴포저는 unit (`realdata-e2e-result-issue-gh-command-plan.spec.ts`) + consistency (`...-gh-command-plan-consistency.spec.ts`) spec 으로 닫혀 있으나, **stdout→hits→action→argv 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다 (`git grep resolveRealDataResultIssueGhCommandPlan test/smoke/` = 0, gh-command-plan assembly smoke 파일 부재 확인). 즉 create↔update action 오매핑·argv↔action drift·marker(searchQuery) 재해석 drift·§9 credential 값 argv 누출·비JSON/비배열 stdout throw 전파·빈 marker throw 전파·빈 title/body·비양수 issueNumber throw 전파 회귀는 public CI 에서 한 번도 발화되지 않고 credential-gated live smoke set-up 시에만 잡힌다. 본 task 는 그 gap 을 메운다 — T-0741 result-issue-command-plan (results→report→commandArgs) 조립 smoke 의 **stdout-side 후속 형제** 로, step④ 의 search→argv 종단 조립 surface 회귀를 public CI 그물로 박제해 step④ 두 절반(commandArgs 산출 ↔ gh argv 해소)의 조립 smoke 쌍을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — 본 smoke 가 검증할 종단 컴포저 (`resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`, 3 위임 합성 parse→resolveAction→buildGhArgv·throw 선전파·self-wire 가드) 와 `RealDataResultIssueGhCommandPlan` interface (`{action, argv}`)
- `test/helpers/realdata-e2e-result-issue-action.ts` — 위임 (2) `resolveRealDataResultIssueAction(hits, searchQuery)` + `RealDataResultIssueAction` (`{action:'create'}` | `{action:'update', issueNumber}`) + `RealDataResultIssueSearchHit` (`{number, title, body}`) interface — action 분기·최소 issueNumber 멱등 검증 기준
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs` (`{searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body}}`) interface — fixture commandArgs 구성 + searchQuery=marker / labels 고정 결정론 상수
- `test/helpers/realdata-e2e-result-issue-gh-argv.ts` — 위임 (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` — argv 구조(`["issue","create",...]` / `["issue","edit",String(issueNumber),...]`)·빈/공백 title/body throw·비양수 issueNumber throw 출처
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — 위임 (1) `parseRealDataResultIssueSearchOutput(stdout)` — 비JSON SyntaxError·비배열/비객체원소/비양수 number/비문자열 title·body throw 출처 (negative fixture stdout 구성에 필요)
- `test/smoke/realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 단일 source 대조·throw 전파·결정론·무공유 패턴의 mirror 템플릿 (T-0741, command-plan-side 선행 형제 조립 smoke)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — 유효 `commandArgs` (`searchQuery` non-blank, `createArgs:{title,body,labels}` / `updateArgs:{title,body}` non-blank) fixture 구성. (a) `stdout = "[]"`(후보 0건) → `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` → `plan.action.action === 'create'` + `plan.argv` 가 `["issue","create",...]` (create 분기 argv shape, 첫 두 토큰 `"issue"`/`"create"`) 1+ test. (b) marker 를 포함하는 다수-hit stdout → `plan.action.action === 'update'` + `plan.action.issueNumber === 최소 number` + `plan.argv` 가 `["issue","edit",String(issueNumber),...]` 1+ test.
- [ ] **단일 source 조립 단언** — 동일 (stdout, commandArgs) 을 `buildRealDataResultIssueGhArgv(resolveRealDataResultIssueAction(parseRealDataResultIssueSearchOutput(stdout), commandArgs.searchQuery), commandArgs)` 3-위임 직접 재유도한 결과와 `plan.argv` 가 deep-equal 1+ test. 동일 재유도 action 과 `plan.action` 이 deep-equal 1+ test (조립 체인이 parse→resolveAction→buildGhArgv 를 commandArgs 단일 source 로 thread 함을 확인). update 분기에서 `plan.action.issueNumber` 가 hits 의 최소 number 임 1+ test (멱등 — 가장 오래된 이슈 갱신).
- [ ] **Error/negative path test** — (a) 비JSON stdout (예: `"not-json"`) → 파서 `SyntaxError`/throw 가 자체 try/catch 없이 그대로 전파 (`expect(() => ...).toThrow`) 1+ test. (b) 비배열 JSON stdout (예: `'{"number":1}'`) → 파서 throw 전파 1+ test. (c) 원소가 비양수 number 또는 비문자열 title/body → 파서 throw 전파 1+ test. (d) `commandArgs.searchQuery` 빈 문자열 → action resolver throw 전파 1+ test. (e) `commandArgs.searchQuery` 공백만 → resolver throw 전파 1+ test. (f) create 분기에서 `createArgs.title` 또는 `createArgs.body` 빈/공백 → gh-argv 빌더 throw 전파 1+ test. (g) update 분기(marker 포함 stdout)에서 비양수 issueNumber 또는 빈 `updateArgs.title`/`updateArgs.body` → 빌더 throw 전파 1+ test.
- [ ] **Flow / branch coverage** — create 분기(후보 0건: `"[]"` / marker 미포함 stdout 각각)·update 분기(후보 1+ 건) 각 1+ test. update 분기에서 hit 다수일 때 최소 number 선택 분기 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 비JSON stdout → 파서 throw, (b) 비배열 JSON → 파서 throw, (c) 비양수 number 원소 / 비문자열 title·body → 파서 throw, (d) searchQuery 빈 문자열 → resolver throw, (e) searchQuery 공백만 → resolver throw, (f) create 분기 빈/공백 title·body → 빌더 throw, (g) update 분기 빈/공백 title·body → 빌더 throw, (h) **credential 누출 0** — 산출 `plan.argv` 에 token/secret 어휘(예: `--token`, `GITHUB_TOKEN`, ghp_ 패턴) 미포함 (fixture 가 주입 안 했으므로 argv 어디에도 등장 0), (i) 결정론·무공유: 동일 (stdout, commandArgs) 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan 객체(참조 비동일, argv 배열도 참조 비동일), (j) 입력 stdout(문자열 불변)·commandArgs 객체·중첩 createArgs.labels mutate 0 (호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체·문자열 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / 실 github 수집 / 실 gh 호출·search·create·edit / execFile('gh', argv) 실 실행 / 실 jest spawn) 복제 0 — stdout→action→argv 조립 surface 만 검증 (synthetic stdout 문자열 + `commandArgs` literal 직접 주입).
- [ ] 새 외부 dependency 0 — 기존 `resolve*`/`build*`/`parse*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728~T-0741 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 기존 `realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` (T-0741, `buildRealDataResultIssueCommandPlan` 진입, results→commandArgs side) — 본 task 는 그 뒤(commandArgs + search stdout → 실 gh argv) 의 `resolveRealDataResultIssueGhCommandPlan` 종단 컴포저만 책임. 선행 smoke 수정·중복 0.
- `commandArgs` 의 실 산출 (`buildRealDataResultIssueCommandPlan` / `buildRealDataResultIssueCommandArgs`) — 본 task 는 그 산출을 synthetic fixture 로 직접 주입만. 중복·재검증 0 (그건 T-0741 smoke 책임).
- 실 `deploy/daily-test.sh` bash 배선 / 실 gh 이슈 search·create·edit / `execFile('gh', argv)` 실 실행 / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-result-issue-gh-command-plan.ts` / `realdata-e2e-result-issue-action.ts` / `realdata-e2e-result-issue-gh-argv.ts` / `realdata-e2e-result-issue-search-parse.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- 실 gh search 결과(stdout) 의 실 도출 / 실 issueNumber·실 marker 도출 — synthetic 문자열·literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)

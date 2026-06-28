---
id: T-0758
title: realdata-e2e search-then-resolve 멱등 round-trip dual-leg(searchArgv·resolve-gh-command-plan) single-source commandArgs convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ search-then-resolve 멱등 round-trip convergence — searchArgv leg(T-0746)·resolve leg(T-0742) 가 동일 commandArgs 단일 source 로 수렴함을 묶는 smoke 0 gap; git grep 확인"
independentStream: realdata-e2e-search-resolve-roundtrip-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts
---

# T-0758 — realdata-e2e search-then-resolve 멱등 round-trip dual-leg(searchArgv·resolve-gh-command-plan) single-source commandArgs convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) step ④(결과 이슈 박제)의 멱등 search-or-update 정책은 **두 leg 가 동일 `commandArgs` 를 단일 source 로 공유**할 때만 성립한다 — (1) **search leg**: `buildRealDataResultIssueSearchGhArgv(commandArgs)` 가 `commandArgs.searchQuery`(= descriptor.marker) 로 gh issue search argv 를 합성하고, (2) **resolve leg**: gh search 가 그 marker 로 찾은 결과(stdout)를 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 가 받아 `{action, argv}`(create/update 분기 + gh 실행 argv)로 투영한다. 두 leg 가 **같은 `commandArgs.searchQuery` 단일 source** 로 수렴해야 — search 가 쓴 marker 와 resolve 가 후보 매칭에 쓰는 marker 가 byte-identical — 멱등 search-or-update(동일 run 이면 갱신, 새 run 이면 생성)가 깨지지 않는다.

기존 sweep 은 두 leg 를 **각각 따로** 닫았다: search leg 는 T-0746(`descriptor→command-args→search-gh-argv` 단일 source chain), resolve leg 는 T-0742(`stdout→hits→action→argv` 3-위임 직접 재유도 deep-equal). 그러나 **두 leg 를 동일 `commandArgs` 단일 source 로 묶어 round-trip 수렴**(search argv 가 쓴 marker = resolve 가 매칭에 쓰는 searchQuery = update argv 가 박는 marker)을 박제한 smoke 는 NONE 이다 — 이 round-trip cross-leg 정합이야말로 멱등성의 핵심 불변식인데 public CI 그물에 외화돼 있지 않다. 본 task 가 그 gap 을 non-gated build-time smoke 로 닫는다. live leg(실 gh issue search·create·edit·`execFile('gh', argv)`·실 LLM·DB·네트워크) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (SearchGhArgv|searchArgv) AND (resolveRealDataResultIssueGhCommandPlan|GhCommandPlan) 동시 포함 여부; done` = **BOTH in 0 파일**. searchArgv leg 와 resolve-gh-command-plan leg 를 동일 commandArgs 로 묶은 smoke 부재 확인. T-0746 은 search-argv leg 만, T-0742 는 resolve leg 만 — round-trip 수렴 전용 smoke 0.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-args.ts` — round-trip 의 단일 source. `buildRealDataResultIssueCommandArgs(descriptor)` → `{ searchQuery, createArgs, updateArgs }`. `searchQuery`(= descriptor.marker) 가 두 leg 공유 source. `RESULT_ISSUE_LABELS` 고정 labels 상수.
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — search leg 컴포저. L114 `export function buildRealDataResultIssueSearchGhArgv(commandArgs)` → gh issue search argv(`['search','issues','--match','body', marker, '--json', ..., '--limit','30']`). marker = `commandArgs.searchQuery`.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve leg 컴포저. L61 `export function resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`. 합성 3-위임: parse(stdout)→resolveAction(hits, commandArgs.searchQuery)→buildGhArgv(action, commandArgs). 후보 0건→create, 후보 1+건→update(최소 number).
- `test/helpers/realdata-e2e-result-issue-action.ts` — L114 `resolveRealDataResultIssueAction(hits, searchQuery)`(분기 결정 leaf, create/update). L67 `interface RealDataResultIssueSearchHit`({number, title, body}) — synthetic stdout hit literal 합성용 shape.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — descriptor fixture 합성용. L85 `interface RealDataResultIssueDescriptor`({title, marker, body}), L118 `buildRealDataResultIssueDescriptor(summary, run)`. 단일 source descriptor 확보.
- `test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts` (T-0746) — search leg smoke. descriptor/commandArgs fixture 합성 패턴·canonical search argv shape·synthetic 입력 상수·import 위치 참고(중복 회피 — 본 task 는 search leg 단독 재단언 금지, round-trip 수렴만).
- `test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` (T-0742) — resolve leg smoke. synthetic gh search stdout(JSON 배열) 합성 패턴·create/update 분기 stdout literal·3-위임 직접 재유도 deep-equal 패턴·credential 누출 0 단언 참고(중복 회피 — resolve leg 자체 재유도 재단언 금지).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: 유효 synthetic descriptor → `commandArgs = buildRealDataResultIssueCommandArgs(descriptor)` → search leg `searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs)` 와 resolve leg `plan = resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 두 leg 모두 정상 산출(searchArgv: string[], plan: {action, argv}) happy test 1+.
- [ ] **round-trip 단일 source 수렴(branch — 핵심 불변식)**: search leg 가 argv 에 박은 marker(searchArgv 의 `--match body <marker>` 위치 값)와 resolve leg 가 후보 매칭·update argv 에 쓰는 `commandArgs.searchQuery` 가 **byte-identical**(`toBe`) — 동일 `commandArgs.searchQuery` 단일 source 로 두 leg 가 수렴함을 단언 1+ test. searchArgv 에서 marker 추출(예: `searchArgv[searchArgv.indexOf('--match') + 2]` 또는 canonical 위치) → `descriptor.marker` 와 `commandArgs.searchQuery` 3자 일치 `toBe`.
- [ ] **search→create round-trip(branch)**: synthetic 빈 search stdout(`"[]"` — 후보 0건) → resolve leg `plan.action.action === 'create'` AND `plan.argv` 가 gh issue create argv(title=`createArgs.title`·body=`createArgs.body` 포함, 새 run 은 미존재→생성). create 분기에서도 search 가 쓴 marker 와 resolve 가 받은 searchQuery 일치 1+ test.
- [ ] **search→update round-trip(branch — 멱등)**: synthetic search stdout(marker 를 body 에 포함한 hit 1+건 JSON 배열, 동일 run 이미 존재) → resolve leg `plan.action.action === 'update'` AND `plan.action.issueNumber` = 최소 hit number AND `plan.argv` 가 gh issue edit argv(updateArgs.title/body 포함). update argv 가 박는 marker(= updateArgs body 안 marker)와 search 가 찾은 marker 가 동일 source 임을 단언 1+ test — 멱등 갱신 정합.
- [ ] **partial-thread 격리(branch)**: 다른 `descriptor.marker`(같은 summary/run 외 marker만 변) → searchArgv 의 marker 와 resolve 가 매칭·update argv 에 쓰는 searchQuery 가 **함께** 동형 변화(두 leg 가 같은 source 따라 동시 이동, drift 0) 1+ test — 한 leg 만 stale marker 를 쓰면 멱등 깨짐을 회귀 그물로 박제.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(어느 leg 도 자체 try/catch 0 → throw 그대로 전파):
  - `commandArgs.searchQuery` 빈 문자열 → search leg(`buildRealDataResultIssueSearchGhArgv`) throw 전파 AND resolve leg(`resolveRealDataResultIssueAction` 경유) throw 전파(두 leg 모두 빈 marker 거부).
  - `commandArgs.searchQuery` 공백-only → 두 leg throw 전파.
  - resolve leg 에 잘못된 stdout(비JSON 문자열) → parse 단계 throw 전파.
  - resolve leg 에 비배열 JSON(예: `"{}"`) → parse throw 전파.
  - resolve leg hit 원소 `number` 비양수(예: 0·음수) → parse throw 전파.
  - update 분기에서 `commandArgs.updateArgs.title` 빈/공백 또는 `body` 빈/공백 → buildGhArgv throw 전파(손상 update argv 산출 0).
- [ ] **flow / branch — create vs update 분기 분리(branch)**: 후보 0건 → create / 후보 1+건 → update 두 분기를 각각 분리 단언(분기마다 별 it) 1+ test each.
- [ ] **credential 누출 0(branch)**: search argv·resolve argv 어느 쪽에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (descriptor, stdout) 으로 두 leg 각각 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(searchArgv 배열·plan·plan.argv 참조 각각 `not.toBe`) + 입력 `descriptor`/`commandArgs`(중첩 createArgs.labels 포함)/`stdout`(문자열 불변) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 컴포저/가드도 수정하지 않고 두 기존 leg(search·resolve)를 동일 `commandArgs` 단일 source 로 묶은 round-trip 수렴 불변식(marker 단일 source 일치·create/update 분기·partial-thread 격리·throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 round-trip/partial-thread/create-update/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-search-argv.ts`·`...-gh-command-plan.ts`·`...-command-args.ts`·`...-action.ts` 또는 어떤 컴포저/가드 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- search leg 자체의 canonical argv shape 전수 재단언(T-0746 이미 cover — 본 task 는 round-trip marker 단일 source 수렴만, search argv 의 fixed 토큰 전체 재검증 금지).
- resolve leg 자체의 3-위임 직접 재유도 deep-equal 재단언(T-0742 이미 cover — 본 task 는 두 leg 가 동일 source 로 수렴하는 cross-leg 정합만).
- 상위 plan(command-plan T-0741/publish-plan T-0755/gh-command-plan T-0742) convergence 재단언(이미 cover).
- 실 github.com 네트워크 fetch / 실 gh 호출 / `execFile('gh', argv)`(search·create·edit) / 실 이슈 search·create·edit wiring / 실 LLM round-trip(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 command-args/search-argv/gh-command-plan unit spec·consistency 가드 spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

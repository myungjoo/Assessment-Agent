---
id: T-0766
title: realdata-e2e step④ pre-execution publish-plan↔search-argv↔resolve↔descriptor marker 4자 cross-stage 수렴 — buildRealDataResultIssuePublishPlan.searchArgv ↔ buildRealDataResultIssueSearchGhArgv(commandArgs) ↔ resolveRealDataResultIssueGhCommandPlan.searchQuery ↔ descriptor.marker byte-identical 4자 수렴 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
completedAt: 2026-06-28T17:24:47Z
prNumber: 681
mergedAs: e6bf46467a2f72bb8ab81c3caed2e8ad7ffad541
reviewRounds: 1
plannerNote: "P5 §109 step④ pre-execution sweep 연장 — T-0758 search-argv↔resolve↔descriptor marker 3자 위에 publish-plan 진입 leg 합류로 4자 확장(publishPlan.searchArgv 가 marker single-source); git grep buildRealDataResultIssuePublishPlan AND resolveRealDataResultIssueGhCommandPlan 둘 다 실호출 smoke 0 확인(주석 외)"
independentStream: realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage 4-leg·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0765(320)/T-0764/T-0758(459) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과(T-0763 628·T-0759 461 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-assembly.smoke-spec.ts
---

# T-0766 — realdata-e2e step④ pre-execution publish-plan↔search-argv↔resolve↔descriptor marker 4자 cross-stage 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 **pre-execution 조립 chain** 에서 **marker 식별 토큰이 모든 조립 stage 를 통과해도 손실/swap 없이 동일 토큰으로 유지**됨이 핵심 불변식이다. issueNumber 축은 post-execution(T-0764 3자 → T-0765 4자) 으로 닫혔으나, marker 축은 **publish-plan 진입 composer 를 단일 source 로 한 pre-execution 4자 수렴이 아직 미봉**이다.

pre-execution marker chain 은 4 stage 로 나뉜다 — (1) descriptor(`buildRealDataResultIssueDescriptor(...).marker` = 결정론 멱등 marker 토큰, 결과 이슈 body 에 박히는 안정 식별자) → (2) command-args(`commandArgs.searchQuery` = descriptor.marker 를 그대로 옮긴 멱등 검색 토큰) → (3) **publish-plan 종단 composer**(`buildRealDataResultIssuePublishPlan(results, run).searchArgv` = runner 가 `execFile('gh', searchArgv)` 로 실행할 첫 gh 명령 argv, 그 안에 searchQuery=marker 가 단일 argv 원소로 박힘) → (4) resolver(`resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)` 가 `commandArgs.searchQuery` 를 marker 로 소비해 action 결정).

이 4 stage 가 동일 marker 토큰으로 byte-identical 수렴해야 — caller live wiring 의 어느 조립 단계에서도 marker drift 가 0 임이 박제되어 — **search-or-update 멱등성**(REQ-009 — 같은 run 의 결과 이슈가 항상 동일 marker 로 단일 issue 매칭) 과 **결과 리포트 재실행 정합**(REQ-037 — 같은 run 이 동일 marker 로 외화) 양쪽이 cross-stage 로 보호된다. 어느 한 leg 에서 marker drift(예: publish-plan 의 searchArgv 가 commandArgs.searchQuery 와 다른 토큰을 박거나, resolver 가 publishPlan.commandArgs 와 다른 searchQuery 를 소비)가 발생하면 검색 argv 와 resolver 가 서로 다른 marker 를 보고 멱등 매칭이 깨진다(stale marker swap drift).

기존 sweep 은 marker 축을 부분적으로만 닫았다:
- **T-0758**: marker 축 pre-execution roundtrip(`buildRealDataResultIssueSearchGhArgv(commandArgs)` 의 search-argv ↔ `resolveRealDataResultIssueGhCommandPlan` 의 searchQuery ↔ descriptor.marker 3자) — **그러나 `buildRealDataResultIssueSearchGhArgv(commandArgs)` 로 직접 진입**해 search-argv 를 만들 뿐, **publish-plan 종단 composer(`buildRealDataResultIssuePublishPlan`)를 통과시키지 않는다**. 즉 "publish-plan 이 산출하는 searchArgv 가 별도 search-argv 빌더의 산출과 동일 marker 로 수렴" 하는 cross-composer 단언 부재.
- **T-0764/T-0765**: issueNumber 축 post-execution roundtrip/4자 — marker 축 아님, publish-plan 진입 아님.
- **publish-plan-tri-leg(T-0617?)**: `buildRealDataResultIssuePublishPlan` ↔ `buildRealDataResultIssueCommandPlan` ↔ `buildRealDataResultIssueSearchGhArgv` 의 3-leg — **그러나 resolver leg(`resolveRealDataResultIssueGhCommandPlan`)를 참조하지 않는다**(조립 layer 안에서만, resolve 소비 단계 미합류).

본 task 는 T-0758 의 자연 후속 — **publish-plan 진입 leg 를 marker chain 에 합류시켜 descriptor.marker → commandArgs.searchQuery → publishPlan.searchArgv → resolve(publishPlan.commandArgs).searchQuery 의 4자 byte-identical cross-stage 수렴** 을 단일 smoke 안에서 묶어 박제한다. 이는 sweep 안에서 **publish-plan 종단 composer 와 resolver 를 동일 source(results + run)로 동시-호출** 해 marker 식별자가 cross-composer 로 손실 0 임을 박제하는 마지막 그물이다(pre-execution marker 축의 issueNumber 축 T-0765 대칭).

gap 확인(git grep, origin/main):
- `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultIssuePublishPlan AND resolveRealDataResultIssueGhCommandPlan 둘 다 실 호출 + 4자 cross-stage marker 수렴 단언) 여부; done` — **0 파일**. T-0764/T-0765 의 buildRealDataResultIssuePublishPlan 출현은 모두 Out-of-Scope 주석뿐(실 호출 0). T-0758 은 resolve 실 호출하나 publish-plan 미진입.
- T-0758(search-argv↔resolve↔descriptor 3자)·publish-plan-tri-leg(publish↔command-plan↔search-argv, resolve 미참조) 와 의도 중복 0 — 본 task 는 **publish-plan 진입 + resolve 소비 합류**가 새 결정 표면.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — pre-execution 종단 publish 컴포저. `interface RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. `buildRealDataResultIssuePublishPlan(results, run)` — `EvaluationResult[]` + run → `{report, commandArgs, searchArgv}`. 산출 `searchArgv` 는 runner 의 첫 gh 명령, 산출 `commandArgs` 는 그 다음 resolver 인자. 본 task 의 stage 3 source(publishPlan.searchArgv) + stage 4 입력(publishPlan.commandArgs).
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — L98+ `buildRealDataResultIssueSearchGhArgv(commandArgs)` — `["search","issues","--match","body", searchQuery, "--json", ...]` 형태 argv 산출(searchQuery 단일 argv 원소). L90 `assertSearchQueryNonBlank` guard. publishPlan.searchArgv 의 산출 위임처(= 동일 빌더) — 본 task 가 별도 직접 호출해 publishPlan.searchArgv 와 deep-equal 수렴 대조하는 reference.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — L61-79 `resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)` — `commandArgs.searchQuery`(= descriptor.marker)를 marker 로 소비. L48-49 주석 "marker 는 commandArgs.searchQuery(= descriptor.marker)". 본 task 의 stage 4 source — publishPlan.commandArgs 를 두 번째 인자로 받아 marker 소비.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}` shape. searchQuery == descriptor.marker.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueDescriptor {title, marker, body}`, `RealDataResultIssueRunRef {gitSha, dateToken}`. marker = 결정론 멱등 토큰(stage 1 source).
- `test/smoke/realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts` (T-0758) — 직전 sibling marker 축 3자 roundtrip smoke(search-argv↔resolve↔descriptor). 중복 회피 — 본 task 는 T-0758 의 3자 수렴 자체 재단언 금지, **publish-plan 진입 leg 1 단(stage 3 = publishPlan.searchArgv)을 더해 4자로 확장**하는 부분만 새로 단언(publishPlan.searchArgv === buildRealDataResultIssueSearchGhArgv(publishPlan.commandArgs) cross-composer 수렴 + publishPlan.commandArgs.searchQuery === resolve 소비 marker).
- `test/smoke/realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts` — sibling publish↔command-plan↔search-argv 3-leg smoke. 중복 회피 — 본 task 는 resolve leg 합류(resolver 가 publishPlan.commandArgs 를 소비해 동일 marker 매칭)만 새로 단언, publish↔command-plan↔search-argv 조립 정합 자체 재단언 금지(해당 smoke cover).
- `test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` (T-0729) — publishPlan 조립 산출 surface smoke(report/commandArgs/searchArgv shape). 중복 회피 — 본 task 는 publishPlan 의 개별 필드 shape 재단언 금지, marker 의 cross-stage 4자 수렴만.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path 4자 chain 합성**: 단일 source(`results: EvaluationResult[]` synthetic literal + `run: RealDataResultIssueRunRef {gitSha, dateToken}` 합성) → `publishPlan = buildRealDataResultIssuePublishPlan(results, run)` 호출. 그로부터 `publishPlan.searchArgv`(stage 3) / `publishPlan.commandArgs.searchQuery`(stage 2 marker = descriptor.marker) 를 추출하고, 별도 reference `refArgv = buildRealDataResultIssueSearchGhArgv(publishPlan.commandArgs)`(동일 빌더 직접 호출) + `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)`(synthetic searchStdout, marker 매칭 hit 1+건) 호출. 세 산출물이 모두 정상(publishPlan: `{report, commandArgs, searchArgv}`, refArgv: `string[]`, resolvePlan: `{action, argv}`) happy test 1+.
- [ ] **cross-stage marker single-source 4자 수렴(branch — 핵심 불변식)**: 단일 marker 토큰 M(= descriptor.marker = publishPlan.commandArgs.searchQuery)이 4 stage 전부 byte-identical 일치함을 묶어 단언 1+ test — `expect(publishPlan.commandArgs.searchQuery).toBe(M)`(stage 1→2, descriptor.marker→commandArgs.searchQuery) AND `expect(publishPlan.searchArgv).toContain(M)`(stage 2→3, commandArgs.searchQuery→publishPlan.searchArgv 의 단일 argv 원소) AND `expect(publishPlan.searchArgv).toEqual(refArgv)`(stage 3 cross-composer 수렴 — publishPlan 이 산출한 searchArgv 가 buildRealDataResultIssueSearchGhArgv(publishPlan.commandArgs) 직접 산출과 deep-equal) AND `expect(resolvePlan.searchQuery ?? publishPlan.commandArgs.searchQuery).toBe(M)` 또는 resolver 가 소비한 marker 가 M 임을 검증(stage 3→4, resolve 가 publishPlan.commandArgs.searchQuery=M 을 marker 로 소비함을 action 결정/argv 으로 박제). 즉 descriptor.marker → commandArgs.searchQuery → publishPlan.searchArgv → resolve 소비 marker 4 stage 가 **동일 M 식별 token single-source 4자 수렴**(어느 경로도 stale/swap drift 0).
- [ ] **searchArgv → resolve argv 매체-경유 marker 일치(branch — argv-mediated 수렴)**: 동일 M 이 모든 매체에 박힘을 단언 1+ test — `expect(publishPlan.searchArgv).toContain(M)`(첫 gh 명령 argv 안 M) AND `expect(refArgv).toContain(M)`(reference argv 안 M, 동일 위치) AND resolver 가 hits 를 M marker 로 매칭해 `resolvePlan.action.action === 'update'`(M 매칭 hit 존재 시 update 분기). 즉 publish-argv / reference-argv / resolve 소비의 3 매체에 박힌 M 식별 token 이 동일.
- [ ] **결과 분포 변별성(branch — marker source 박제, 다른 results→다른 marker→다른 4자 수렴 chain)**: 서로 다른 results source 두 개(예: results A → marker M_A, results B → marker M_B, M_A ≠ M_B — descriptor marker 합성이 results 식별자에 의존) → 각각 chain 호출(publishPlan + refArgv + resolve) → 두 chain 의 4 stage 가 **각각 M_A 4자 / M_B 4자 로 분리 수렴**(서로 다른 marker, 단 각 chain 안에서 4자 일치) 1+ test. "다른 results→다른 marker, 같은 results→4자 수렴" 의 결정론적 변별 박제. (만약 marker 가 run-axis 또는 고정 토큰이라 results 변경에 불변이면 본 항목은 run 또는 marker source 입력 변별로 대체 — Required Reading 의 descriptor.marker 합성 source 를 확인해 변별 입력 축을 정한다.)
- [ ] **run-axis 무관 — marker 4자 수렴 격리(branch — partial-thread 격리)**: 동일 results(= 동일 marker M)를 고정하고 `run` 의 gitSha/dateToken 만 다르게 두 chain 호출 → 두 chain 의 `publishPlan.commandArgs.searchQuery` / `publishPlan.searchArgv` 안 M / resolve 소비 marker 가 **두 경우 동일 M**(run 식별자 변경이 marker 축에 누설 0 — 결정론 박제, T-0759 의 run 축 cross-leg 격리 mirror). 단 publishPlan.report 의 run 파생 필드(gitSha/dateToken)는 두 경우 달라야 함(run leg 가 자기 영역에서는 정상 전파). 1+ test.
- [ ] **searchStdout 무관 — resolve 소비 marker 격리(branch — partial-thread 격리, 두 번째 축)**: 동일 publishPlan(= 동일 M)을 고정하고 `searchStdout` 의 hits 분포/부가 텍스트만 다르게(예: hit 0건 → create 분기, hit 2건 → update 분기) 두 chain 호출 → resolver 가 소비하는 marker 는 **두 경우 동일 M**(publishPlan.commandArgs.searchQuery 단일 의존, searchStdout 변경이 marker 축에 누설 0) — action 분기(create/update)는 달라질 수 있으나 marker token 자체는 불변 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(각 leg 의 marker 식별자 거부 대칭 박제):
  - 빈 `results = []` → publishPlan 합성 단계 throw 또는 marker 미산출 분기(helper 실제 동작 확인 후 — 빈 results 가 throw 면 throw 전파, 빈 report 산출이면 그 분기 박제).
  - `publishPlan.commandArgs.searchQuery` 가 빈/공백이 되도록 강제 합성(예: `{...publishPlan, commandArgs: {...publishPlan.commandArgs, searchQuery: "  "}}`) → `buildRealDataResultIssueSearchGhArgv` 의 `assertSearchQueryNonBlank` throw(stage 3 차단, marker 비식별).
  - 동일 빈/공백 searchQuery 강제 commandArgs → `resolveRealDataResultIssueGhCommandPlan` 의 빈/공백 marker throw 전파(stage 4 차단, resolver 비식별 — search-argv 빌더와 resolver 양쪽이 독립 guard 보유함을 박제, defense-in-depth).
  - `run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-29"}`) → publishPlan 의 하위 report-plan 측 throw 전파(stage 3 미도달 — searchArgv 단계 이전 차단됨을 helper 주석대로 박제).
  - `run.dateToken` 빈/공백 → publishPlan 측 throw 대칭.
  - `searchStdout` 비JSON(`"not-json"`) → resolve leg parse-search 위임 throw(stage 4 미진입, marker 매칭 불가).
- [ ] **결정론·무공유·no-mutation**: 동일 (results, run, searchStdout) 입력으로 chain 두 번 호출 → publishPlan/refArgv/resolvePlan 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(results, run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND `publishPlan.searchArgv` 와 `refArgv` 가 deep-equal 이지만 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 argv 배열).
- [ ] **credential argv 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 publishPlan.searchArgv / refArgv / resolvePlan.argv / publishPlan.commandArgs.searchQuery 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern publish-plan-search-argv-resolve-marker-4way` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 stdout 만.
- issueNumber 축 post-execution 수렴(search-hit.minNumber↔resolve↔parse↔outcome-report) 재단언 금지(T-0764/T-0765 cover). 본 task 는 marker 축 pre-execution 만.
- T-0758 의 search-argv↔resolve↔descriptor 3자 marker roundtrip 자체 재단언 금지(T-0758 cover). 본 task 는 publish-plan 진입 leg 합류로 4자 확장 부분(publishPlan.searchArgv === refArgv cross-composer 수렴 + resolve 가 publishPlan.commandArgs 소비)만 새로 단언.
- publish↔command-plan↔search-argv 조립 3-leg 정합 자체 재단언 금지(publish-plan-tri-leg smoke cover). 본 task 는 resolve leg 합류만.
- publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape 정합 재단언 금지(T-0729 cover). 본 task 는 marker 의 cross-stage 4자 수렴만.
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 4 helper(publish-plan, search-argv, gh-command-plan, descriptor/command-args)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 4자 cross-stage marker 수렴을 single-source(publishPlan)로 묶는 합성 smoke 작성. 단 descriptor.marker 의 합성 source 축이 results-dependent 인지 fixed-token 인지 helper 확인 후 변별성 test 입력 축을 정한다).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)

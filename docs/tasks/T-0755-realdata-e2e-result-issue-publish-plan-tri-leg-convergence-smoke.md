---
id: T-0755
title: realdata-e2e result-issue-publish-plan 컴포저 tri-leg(report·commandArgs·searchArgv) convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
mergedAs: a8f6540c
prNumber: 670
reviewRounds: 1
coversReq: [REQ-009]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e result-side post-eval publish 컴포저 buildRealDataResultIssuePublishPlan tri-leg convergence — T-0753/T-0754 seed-side dual-leg 의 result-side 대칭 sibling; gap git grep 확인됨"
independentStream: realdata-e2e-result-issue-publish-plan-tri-leg-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts
---

# T-0755 — realdata-e2e result-issue-publish-plan 컴포저 tri-leg(report·commandArgs·searchArgv) convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출 → 결과 이슈 박제 직전) 측 build-time 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run)` 은 **세 leg 를 단일 plan 으로 합류**시킨다 — (1) `report`·`commandArgs` leg(둘 다 `buildRealDataResultIssueCommandPlan(results, run)` 위임 산출)와 (2) `searchArgv` leg(`buildRealDataResultIssueSearchGhArgv(commandArgs)` 위임 산출)가 `{ report, commandArgs, searchArgv }` 로 동시 수렴한다. T-0753(run-plan dual-leg pipeline·run)·T-0754(pipeline-plan dual-leg collectCallArgs·modelId)가 **seed-side** 컴포저들의 dual-leg convergence 를 직접-체인 byte-identical 로 닫았다면, 본 task 는 그 **result-side** 대칭 sibling 으로 publish-plan 의 tri-leg(report·commandArgs·searchArgv) convergence 를 직접-체인 byte-identical 로 박제한다.

gap 확인(git grep, origin/main): 기존 `test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts`(T-0729)는 `plan.report`/`plan.commandArgs`/`plan.searchArgv` 를 `toBeDefined()` + `summary.count`/`totalVolume`/`searchArgv.length>0`/`searchArgv).toContain(commandArgs.searchQuery)` shape 단언과 결정론 `not.toBe` 만 한다. **세 leg 가 직접 sub-컴포저 호출 산출과 byte-identical(`toEqual`) 인지**(report·commandArgs 가 `buildRealDataResultIssueCommandPlan(results, run)` 의 단일 source·searchArgv 가 `buildRealDataResultIssueSearchGhArgv(commandArgs)` 의 단일 source)와 **partial-thread 격리**(다른 results→report·commandArgs·searchArgv 모두 변함이 정상이나 searchArgv 가 commandArgs.searchQuery 와 정합 유지)를 직접 단언하는 smoke 는 NONE 이다(`git grep` 결과 publish-plan tri-leg convergence smoke·`directCommandArgs`/`directSearchArgv` 패턴 0 — command-plan(T-0741)·run-plan(T-0753)·pipeline-plan(T-0754) 에만 leg-level deep-equal 존재). 본 smoke 가 그 회귀 그물을 public CI 에 박제한다. live leg(실 평가·실 LLM·실 gh·DB·jest spawn) 복제 0·non-gated.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` (L103 `interface RealDataResultIssuePublishPlan`, L135 `export function buildRealDataResultIssuePublishPlan`) — 본 task 가 검증할 result-side 종단 컴포저. 합성 순서((1) command-plan 위임 → report·commandArgs, (2) search-argv 위임 → searchArgv), run guard 우선(command-plan 단계), self-wire(`assertRealDataResultIssuePublishPlanConsistentWithSources`) 박제.
- `test/helpers/realdata-e2e-result-issue-command-plan.ts` (L89 `interface RealDataResultIssueCommandPlan`, L119 `export function buildRealDataResultIssueCommandPlan`) — report·commandArgs leg 직접 재유도용 위임 컴포저(run.gitSha/dateToken 빈/공백 throw 전파).
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` (L114 `export function buildRealDataResultIssueSearchGhArgv`) — searchArgv leg 직접 재유도용 위임 컴포저(commandArgs.searchQuery → 첫 gh search argv).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` (`interface RealDataResultIssueRunRef`) — run 식별자 타입(gitSha·dateToken).
- `test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` (T-0729 산출) — `syntheticResult(unitId, volume)` 결정론 EvaluationResult literal fixture·기존 shape-only 단언 패턴 참고(중복 회피용) + run literal·EvaluationResult import 위치 참고.
- `test/smoke/realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` (T-0753 산출) — seed-side convergence smoke 구조 — colocated spec 스타일·describe 골격·byte-identical(`toEqual`)/`not.toBe` 무공유/partial-thread/guard-ordering 단언 패턴 대칭 참고.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0). 다음을 모두 만족한다:

- [ ] **Happy-path**: `buildRealDataResultIssuePublishPlan(results, run)` 의 정상 합성 — 반환 `{ report, commandArgs, searchArgv }` 이 세 필드 모두 정의·shape 보유 happy test 1+(synthetic EvaluationResult literal·유효 run literal 입력).
- [ ] **report·commandArgs leg single-source byte-identical**: `plan.report` 와 `plan.commandArgs` 가 직접 호출 `buildRealDataResultIssueCommandPlan(results, run)` 결과의 각 `report`/`commandArgs` 와 `toEqual`(deep byte-identical) — 두 leg 가 command-plan 위임 단일 source 임을 단언. 동시에 새 객체(`not.toBe`)로 무공유 1+ test.
- [ ] **searchArgv leg single-source byte-identical**: `plan.searchArgv` 가 직접 호출 `buildRealDataResultIssueSearchGhArgv(plan.commandArgs)`(또는 `directCommandArgs`) 결과와 `toEqual`(전체 배열 deep-equal, element shallow 가 아닌) — searchArgv leg 가 search-argv 위임 단일 source 임을 단언. 동시에 새 배열(`not.toBe`)로 무공유 1+ test.
- [ ] **tri-leg cross 정합(branch)**: `plan.searchArgv` 가 `plan.commandArgs.searchQuery` 를 단일 원소로 포함(`toContain`) — searchArgv leg 가 commandArgs leg 의 산출(marker)을 단일 source 로 thread 함을 박제 1+ test.
- [ ] **partial-thread 격리(branch)**: 다른 `results`(같은 run) → 세 leg 모두 변할 수 있으나 `plan.report`/`plan.commandArgs`/`plan.searchArgv` 가 각각 직접 sub-컴포저 재유도와 여전히 `toEqual`(단일 source 정합 유지) 1+ test / 다른 `run`(같은 results) → report·commandArgs·searchArgv 가 run 변화를 반영하되 단일 source 정합 유지 1+ test(세 leg 가 동일 (results, run) 단일 source 로부터 합류함을 박제).
- [ ] **guard-ordering(branch)**: run guard 가 command-plan 단계(searchArgv 단계보다 먼저)에서 평가됨 — run.gitSha 또는 dateToken 빈/공백 시 command-plan 위임 throw 가 searchArgv 단계 도달 전에 우선 전파됨을 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test:
  - run.gitSha 빈 문자열 → 위임 `assertNonBlank` throw 전파(command-plan 단계).
  - run.gitSha 공백만 → 위임 throw 전파.
  - run.dateToken 빈 문자열 → 위임 throw 전파.
  - run.dateToken 공백만 → 위임 throw 전파.
  - 빈 results([]) + 빈/공백 run → run guard 가 우선 throw(빈 results 경계에서도 searchArgv 미도달).
- [ ] **flow / 빈·단일·다수 results 분기**: 빈 results + 유효 run → `plan.report.summary.count: 0`·전 슬롯 0·totalVolume 0 + commandArgs/searchArgv 정상 합성(throw 0) / 단일 result(count 1) / 다수 result(count = results 길이) 각 1+ test, 각 분기에서 세 leg 가 직접 sub-컴포저 재유도와 `toEqual` 유지.
- [ ] **결정론·무공유·no-mutation**: 동일 (results, run) 두 번 호출 → deep-equal 산출 + 새 plan 객체(`not.toBe`) + `plan.report`/`plan.commandArgs`/`plan.searchArgv` 참조 각각 비공유(`not.toBe`) + 입력 `results` 배열·원소·`run` 객체 mutate 0(호출 전후 deep-equal) 단언.
- [ ] **R-59 raw 본문 누출 0**: plan 이 commit/PR/issue raw narrative 본문을 구조적으로 포함하지 않음(식별자 카운트·분류 enum 분포·정량 합산·이슈 식별자·marker·title·body 렌더·search argv 토큰만) sentinel 단언 1+.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). local DB 부재 시 non-gated build-time smoke 라 DB 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 컴포저 자체를 수정하지 않고 기존 분기(guard 우선·tri-leg 격리·위임 전파)를 외부 smoke 로 박제하므로, 위 partial-thread/guard-ordering/cross/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` 또는 어떤 컴포저 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- 실 github.com 네트워크 fetch / 실 활동 수집 / 실 LLM round-trip / 실 gh 호출 wiring(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 `realdata-e2e-result-issue-publish-assembly.smoke-spec.ts`(T-0729)의 shape-only 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 파일만).
- seed-side run-plan(`buildRealDataE2eRunPlan`)/pipeline-plan(`buildRealDataPipelinePlan`) convergence 재단언(T-0753/T-0754 가 이미 cover — 본 task 는 result-side publish-plan tri-leg 합성만).
- step-args aggregator(`buildRealDataE2eStepArgs`) dual-leg 재단언(T-0752 가 이미 cover).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

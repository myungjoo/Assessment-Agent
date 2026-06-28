---
id: T-0746
title: realdata-e2e command-args-search-gh-argv 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step④ search-argv leg 직접 조립 buildRealDataResultIssueCommandArgs→buildRealDataResultIssueSearchGhArgv smoke. issue-still-relevant: git grep 결과 buildRealDataResultIssueSearchGhArgv 직접 chain smoke 0(publish-plan smoke 는 aggregator 진입뿐) 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-command-args-search-gh-argv-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts]
---

# T-0746 — realdata-e2e command-args-search-gh-argv 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(결과 이슈 박제) search-side** build-time 순수 layer 중 **search-argv leg** 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 가 결과 이슈 descriptor 를 멱등 search-or-update 명령-args 묶음 `RealDataResultIssueCommandArgs`(`{searchQuery, createArgs, updateArgs}`) 로 변환하고, (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` (T-0586) 가 그 `searchQuery` 를 받아 실 `gh search issues` 호출에 그대로 넘길 인자-벡터(`["search","issues","--match","body",searchQuery,"--json","number,title,body","--limit","30"]`, `gh` 실행 파일명 제외) 를 산출한다.

이 publish triad(결과 이슈 박제 3-leg: `{report, commandArgs, searchArgv}`) 의 다른 두 leg 는 이미 직접 2-컴포저 chain smoke 로 닫혀 있다 — **report leg** 은 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740, results→summary→descriptor), **commandArgs leg** 은 `realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` (T-0741, results→report→commandArgs) + `realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` (T-0742, parse→resolveAction→buildGhArgv). 그러나 **search-argv leg(descriptor→command-args→search-gh-argv) 를 직접 chain 으로 묶은 non-gated build-time smoke 는 부재**다. 기존 `realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` (T-0729) 는 **aggregator `buildRealDataResultIssuePublishPlan(results, run)`** 진입으로만 검증할 뿐, `descriptor → commandArgs → searchArgv` 중간 변환 산출(searchQuery=marker 전파·argv 동사 prefix·`--match body`·`--json` 필드 정합·`--limit` 값·searchQuery 단일 argv 원소 인젝션-안전)을 **두 helper 의 직접 chain 으로 묶은 단언은 0** 이다 (`git grep buildRealDataResultIssueSearchGhArgv test/smoke/` = NONE — 직접 chain smoke 파일 부재, 컴포저 unit + consistency spec 만 존재 확인).

즉 searchQuery shape drift(marker 전파 누락 / descriptor.marker 가 아닌 다른 값 주입)·search argv shape drift(동사 prefix drift·`--match body` 변형·searchQuery 위치 drift·`--json` 필드 누락·`--limit` 값 drift·잉여 인자 누출)·marker(searchQuery) 빈/공백 throw 전파·title 빈/공백 throw 전파(command-args 단계 선평가)·credential/raw 본문 argv 누출 0(R-59/REQ-032)·인젝션-안전(특수문자 searchQuery 단일 원소 유지) 분기는 public CI 에서 직접 발화되지 않고 publish aggregator 또는 step④ live gh-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — publish triad 의 commandArgs leg(T-0741/T-0742)·report leg(T-0740) 직접 조립 smoke 의 **search-argv leg 대칭 sibling** 으로, descriptor→command-args→search-gh-argv 종단 조립 surface 회귀를 public CI 그물로 박제해 publish triad 3-leg 직접-체인 smoke 를 모두 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 위임 (1) `buildRealDataResultIssueCommandArgs(descriptor)` → `RealDataResultIssueCommandArgs`(`{searchQuery, createArgs, updateArgs}`). searchQuery=descriptor.marker 전파·title/marker 빈/공백 throw(필드별 분기)·create/update body=descriptor.body 멱등·매 호출 새 객체+새 labels 배열(무공유) 규칙. 입력 `RealDataResultIssueDescriptor`(`{title, marker, body, ...}`) type 도 여기 cross-reference(정의는 `realdata-e2e-result-issue-descriptor.ts`)
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — 위임 (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` → `string[]`. 산출 argv = `["search","issues","--match","body",searchQuery,"--json","number,title,body","--limit","30"]`(`gh` 미포함)·searchQuery 단일 원소(인젝션 불가)·searchQuery 빈/공백 throw·`REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS`/`REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT` named 상수·매 호출 새 배열(무공유)·createArgs/updateArgs 읽지 않음 규칙
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueDescriptor`(`{title, marker, body, ...}`) 정의. synthetic descriptor literal 구성용 필드 집합 참고
- `test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` — step④ search-side 형제 smoke(T-0742). non-gated describe·argv 단언(동사 prefix·`--match body`·credential 누출 0)·deep-equal 단일 source 대조·throw 전파·결정론·무공유·no-mutation·non-gated 패턴의 mirror 템플릿
- `test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` — aggregator 진입 형제 smoke(T-0729). synthetic descriptor/MODEL_ID 상수 literal 빌더 패턴 참고용(본 task 는 aggregator 가 아닌 두 helper 직접 chain 으로 재작성)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic `RealDataResultIssueDescriptor` literal → `buildRealDataResultIssueCommandArgs(descriptor)` → `buildRealDataResultIssueSearchGhArgv(commandArgs)` 종단 chain 을 한 번에 실행. (a) 산출 argv 가 배열·정확히 9 원소·동사 prefix `["search","issues"]` 로 시작 1+ test. (b) argv 가 `["search","issues","--match","body",descriptor.marker,"--json","number,title,body","--limit","30"]` 와 deep-equal(canonical argv shape) 1+ test. (c) argv 의 searchQuery 위치 원소(index 4)가 `commandArgs.searchQuery`(=`descriptor.marker`)와 동일하고 단일 argv 원소로 유지(공백/특수문자 포함 시에도 split 0) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 `descriptor` 에 대해 `buildRealDataResultIssueSearchGhArgv(buildRealDataResultIssueCommandArgs(descriptor))[4]` 가 `buildRealDataResultIssueCommandArgs(descriptor).searchQuery`(=`descriptor.marker`)와 동일(searchQuery 단일 source 전파, 재합성 없이 위임 산출만 옮김) 1+ test. argv 가 `commandArgs.createArgs`/`commandArgs.updateArgs` 의 값(title/body/labels)을 일절 포함하지 않음(search-argv 는 searchQuery 단일 의존) 1+ test.
- [ ] **Error/negative path test** — (a) `descriptor.marker` 가 빈 문자열 → `buildRealDataResultIssueCommandArgs` 의 marker guard throw 를 자체 try/catch 없이 조립 경로로 그대로 전파 (`expect(() => buildRealDataResultIssueSearchGhArgv(buildRealDataResultIssueCommandArgs(descriptorWithBlankMarker))).toThrow`) 1+ test. (b) `descriptor.marker` 가 공백만 → throw 전파 1+ test. (c) `descriptor.title` 이 빈/공백 → command-args 단계 title guard 가 선평가되어 throw 전파(marker 유효해도 title guard 우선) 1+ test.
- [ ] **Flow / branch coverage** — (a) credential echo / raw 활동 본문 누출 0: argv 어느 원소에도 token/secret/raw narrative 패턴 미포함(searchQuery=marker 안정 토큰만, §9 정합) 1+ test. (b) 인젝션-안전: marker 에 공백·특수문자(예: `"x; rm -rf /"`)가 들어가도 argv 의 단일 원소로 보존(shell 미경유, argv 길이 9 불변) 1+ test. (c) `--json` 필드가 `"number,title,body"` 고정·`--limit` 가 `"30"` 고정 1+ test. 분기마다 test 분리. (search-gh-argv 는 create/update 분기 없는 단일 반환 — 그 점 본문 메모.)
- [ ] **Negative cases 충분 cover** — (a) marker 빈 → throw, (b) marker 공백 → throw, (c) title 빈/공백 → throw 전파, (d) **결정론·무공유**: 동일 `descriptor` 두 번 chain 호출 시 deep-equal argv + 매 호출 새 배열 객체(반환 argv 참조 비동일) 단언, (e) **no-mutation**: 입력 `descriptor` 객체(및 중첩 필드)가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic descriptor literal 직접 주입).
- [ ] live leg (실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 / 실 이슈 search·create·edit / 실 네트워크 / DB 접근 / 실 jest spawn) 복제 0 — descriptor→command-args→search-gh-argv 조립 surface 만 검증 (synthetic descriptor literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` (T-0729, `buildRealDataResultIssuePublishPlan(results, run)` aggregator 진입) 의 재검증 — 본 task 는 그 aggregator 아래 **command-args→search-gh-argv search-argv leg 직접 chain** 만 책임 (중복·재검증 0).
- 기존 `realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` (T-0741, results→report→commandArgs) / `realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` (T-0742, parse→resolveAction→create/edit buildGhArgv) — 본 task 는 search-argv leg(commandArgs.searchQuery→search argv) 만, 별개 절단면.
- 기존 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740, results→summary→descriptor report leg) — 본 task 는 search-argv leg 만, 별개 절단면.
- 실 gh search 실행 / `execFile('gh', searchArgv)` / gh search response JSON 파싱 / `RealDataResultIssueSearchHit[]` 산출 / 실 이슈 search·create·edit / 실 네트워크 / DB 접근 / 실 jest spawn.
- create/edit argv 합성(`buildRealDataResultIssueGhArgv`, T-0742 cover) / action resolver 분기(`resolveRealDataResultIssueAction`, T-0742 cover) / `--repo`·repo slug·gh auth wiring — 본 task 는 search argv 합성 surface 만.
- 컴포저 소스(`realdata-e2e-result-issue-command-args.ts` / `realdata-e2e-result-issue-search-argv.ts`) / 위임 consistency 가드 / descriptor 컴포저 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0745 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

---
id: T-0994
title: daily-step dual-leg run report issue gh-command-plan 종단 컴포저에 sibling -consistency drift-guard 신설 (resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan 산출 {action, argv} 을 (stdout, commandArgs) single-source 재유도 대조)
phase: P5
status: DONE
mergedAs: 3930ab80
prNumber: 888
reviewRounds: 1
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-gh-command-plan
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — issue-gh-argv triad(T-0899/T-0992/T-0993) 완결 뒤 T-0993 Follow-ups 잔여 sibling 1순위(-issue-gh-command-plan) consistency 짝 부재 봉합. 요약축 선례 T-0695(assertRealDataResultIssueGhCommandPlanConsistentWithInputs) mirror. producer 무변경(self-wire 후속). pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0994 — daily-step dual-leg run report issue gh-command-plan 종단 컴포저 sibling consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈 search stdout + 명령-args 묶음을 실 `gh` 실행 plan(`{action, argv}`)으로 합성하는 **종단 순수 컴포저** `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts`, T-0902)에는 **sibling 관례인 `-consistency` drift-guard 짝이 없다**. issue-gh-argv sub-helper 는 producer(T-0899)→consistency(T-0992)→self-wire(T-0993) 삼단이 방금 완결됐고(PR #887 squash 713376d9), T-0993 Follow-ups 가 명시적으로 잔여 consistency-미봉 sibling 목록(`-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`)을 예고했다. 본 task 는 그 목록의 **1순위** `-issue-gh-command-plan` 을 봉한다.

이 컴포저는 (1) `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` → hits, (2) `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, commandArgs.searchQuery)` → action, (3) `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)` → argv 의 **3-단계 합성**을 단일 순수 함수로 닫는다. 문제는 이 합성 배선(위임 순서·인자 전달·plan 조립)이 오직 자기 colocated spec 이 그 조합을 커버할 때만 검증된다는 점이다. 누군가 배선을 편집(예: parse→action 사이에 marker 를 잘못된 인자로 전달, action 분기 create/update 오매핑, argv 산출을 action 대신 잘못된 값으로, `{action, argv}` 조립 시 필드 뒤바꿈)하면서 spec 을 함께 고치지 않으면, 손상 plan 이 `execFile('gh', argv)` live wiring 으로 새어나가 잘못된 gh 명령이 실행될 수 있다.

본 task 는 요약축 선례 T-0695(`assertRealDataResultIssueGhCommandPlanConsistentWithInputs`, `realdata-e2e-result-issue-gh-command-plan-consistency.ts`)와 정확히 동형으로, 입력 `(stdout, commandArgs)` 를 single-source 로 삼아 **동일 3 위임 helper(parse → resolveAction → buildGhArgv)를 재호출**해 expected `{action, argv}` 를 독립 재유도하고, producer 컴포저가 산출한 plan 의 `action`(분기 종류 + update issueNumber deep equal)과 `argv`(길이 + 각 원소 byte-identical)를 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` + colocated R-112 spec 을 신설한다. 가드는 **합성 규칙을 재구현하지 않고 위임 helper 만 재호출**하므로(컴포저의 배선 회귀만 겨냥, 위임 helper 자체 버그는 대상 아님), 양방향 drift 상쇄 위험이 없다.

이는 T-0988(issue-descriptor consistency 신설)·T-0990(issue-command-args consistency 신설)·T-0992(issue-gh-argv consistency 신설) 패턴의 gh-command-plan-leg mirror 이자, 요약축(summary axis)의 T-0695 를 daily-step 축으로 옮긴 판이다. **producer(T-0902) 본문은 무변경** — self-wire(컴포저 반환 직전 자가 호출)는 후속 slice(T-0993 mirror)로 분리한다. 가드는 컴포저(producer, T-0902)를 import 하지 않고(oracle 독립성 — 3 위임 helper 만 재호출) plan/action/command-args 타입만 `import type` 로 참조하므로, 이 가드가 나중에 producer 에 value import 로 배선돼도 런타임 순환 의존이 생기지 않는다(consistency → gh-command-plan value 엣지 0). producer(T-0902)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` (T-0902) — 대조 대상 producer 컴포저. `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout: string, commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): RealDataDailyStepDualLegRunReportIssueGhCommandPlan`. 3-단계 합성((1) parse stdout→hits, (2) resolveAction(hits, searchQuery)→action, (3) buildGhArgv(action, commandArgs)→argv) 후 `{action, argv}` 반환. 자체 try/catch 0(위임 helper throw 그대로 전파). 출력 인터페이스 `RealDataDailyStepDualLegRunReportIssueGhCommandPlan { action, argv: string[] }`. **가드는 이 파일을 import 하지 않는다** — 3 위임 helper 를 재호출해 독립 재유도한다.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` (T-0695, 요약축 선례 — main 박제) — **신설 가드의 직접 형태 선례**. `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs): void` 의 재유도 방식(입력 `(stdout, commandArgs)` 로 동일 3 위임 helper 재호출해 expected `{action, argv}` single-source 재유도, 합성 규칙 재구현 0), 검증 불변식(plan.action ↔ 재유도 action 분기 종류 + update issueNumber deep equal, plan.argv ↔ 재유도 argv 길이 + byte-identical), 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError, 기대 vs 실측 노출, fail-fast), oracle 독립성(컴포저 import 0 — 위임만 재호출), 한국어 JSDoc·책임 경계 주석 스타일을 그대로 daily-step 축으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` (T-0901) — 재유도 (1)단계 위임 대상 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout): RealDataDailyStepDualLegRunReportIssueSearchHit[]`. read-only(가드는 호출만).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0898) — 재유도 (2)단계 위임 대상 `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker): RealDataDailyStepDualLegRunReportIssueAction`. 입력·출력 타입(`RealDataDailyStepDualLegRunReportIssueAction`, create/update 분기, update 시 issueNumber: number)을 `import type` 로 재사용. read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` (T-0899) — 재유도 (3)단계 위임 대상 `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs): string[]`. read-only(가드는 호출만).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueCommandArgs`(`{ searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }`)를 `import type` 로 재사용. read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts` (T-0902) — producer 기존 spec. fixture(stdout + commandArgs) 구성 형태·happy/error/negative 배치 관례를 참고해 신설 consistency spec 을 작성한다(가드 spec 은 별도 colocated 파일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs): void` export. 입력 `(stdout, commandArgs)` 로 **동일 3 위임 helper(parse → resolveAction → buildGhArgv)를 재호출**해 expected `{action, argv}` 를 single-source 재유도한 뒤: `plan.action` ↔ 재유도 action(분기 종류 create/update 일치 + update 시 issueNumber deep equal), `plan.argv` ↔ 재유도 argv(배열 길이 + 각 원소 byte-identical) 를 대조. **합성 규칙 재구현 0(위임 helper 재호출만)**. **컴포저 producer(T-0902) 를 import 하지 않는다**(재호출 금지 — 양방향 drift 상쇄 방지). action/command-args/plan 타입은 `import type` 재사용만.
- [ ] 에러 정책 — 구조 결손(plan null/undefined·비객체·배열; plan.action null/undefined·`'create'`/`'update'` 외 분기값; plan.argv null/undefined·비배열·원소 비-string; stdout 비-string; commandArgs null/undefined·비객체) = 한국어 `TypeError`(재유도 자체 불가 또는 구조 결손). 값 정합 위반(action 분기 오매핑 = create 인데 plan.action update 또는 반대, update issueNumber 재유도 최소 number 와 불일치, argv 길이 재유도와 상이, argv 임의 위치 원소 byte drift) = 한국어 `RangeError`(기대 vs 실측 노출, drift 위치 식별). silent 통과(위반인데 정상 void) 0, fail-fast(가장 먼저 위반한 지점에서 throw). 검사 순서 = 구조(plan → argv → stdout → commandArgs) → 재유도 → action 대조 → argv 대조.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: 정합 `(stdout, commandArgs)` → producer(T-0902) 실제 호출로 얻은 plan 을 가드가 throw 0 으로 통과시킴을 assert 1+(oracle ↔ producer 합성 배선 일치 증명하는 round-trip case). create 분기(후보 0건 stdout `[]`, labels 0개/1개/다수)·update 분기(marker 포함 후보 1+건) 각각.
  - **Error path**: 구조 결손 각 유형(plan null·비객체, plan.action 분기값 오류, plan.argv null·비배열·원소 비-string, stdout 비-string, commandArgs null) 이 각각 `TypeError` 를 던짐 1+.
  - **Flow/branch cover**: create 분기(후보 0건 → `issue create`)·update 분기(후보 1+건 → `issue edit`) 각각에 대해 정합 통과 + drift throw 를 각 1+ 로 분리 검증. 두 분기 모두 커버.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: drift mutant 각각이 `RangeError` 를 던짐 — (a) plan.action 을 create↔update 로 오매핑, (b) update plan.action.issueNumber 를 재유도 최소 number 와 다른 값으로 변조, (c) plan.argv 동사(`issue create`↔`issue edit`) drift, (d) plan.argv title 값↔body 값 위치 뒤바꿈, (e) plan.argv label flag-pair 순서/개수 변조, (f) plan.argv 길이 잉여/누락(원소 추가·삭제). 각 mutant 독립 case. 가드가 plan·stdout·commandArgs 입력을 mutate 하지 않음(비변형) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 plan·stdout·command-args 구조만 재유도) assert.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts`(T-0902) 및 3 위임 helper(T-0901/T-0898/T-0899) 본문 수정 0 — 신설 가드는 별도 파일. producer self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(T-0902) 반환 직전 가드 self-wire 배선 0 — 후속 slice(T-0993 mirror). 본 task 는 consistency 가드 **신설**만.
- 3 위임 helper(parse T-0901 / resolveAction T-0898 / buildGhArgv T-0899) 수정 0 — 가드는 재호출(재유도)만. 각 helper 의 합성 규칙·시그니처·throw 정책 불변.
- issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) 의 재수정 0 — 이미 삼단/짝 완결.
- 잔여 consistency-미봉 sibling(`-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- argv-leaf 가드(`gh-argv-consistency.ts`, T-0992)가 이미 cover 하는 argv↔commandArgs round-trip 의 내부 위치 정합 세부(C0~C3/U0~U4 단위 검증) 중복 재현 0 — 본 가드는 plan 전체(action + argv) 의 `(stdout, commandArgs)` single-source 재유도 정합에 집중(argv-leaf 가드는 stdout 을 입력으로 받지 않음).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드 신설 후 후속 slice: producer `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(T-0902) 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` self-wire(T-0993 mirror) — 배선으로 issue-gh-command-plan sub-helper 도 producer→consistency→self-wire 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

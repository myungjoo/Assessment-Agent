---
id: T-0996
title: daily-step dual-leg run report issue-action leaf resolver 반환 직전 consistency drift-guard self-wire (resolveRealDataDailyStepDualLegRunReportIssueAction 산출 action 을 create/update 두 반환 지점 모두 즉시 자가 검증)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 115
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-action
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts
plannerNote: "P5 §109 test-hardening — T-0995(PR #889 6c9fac13)으로 봉한 issue-action consistency 가드를 producer(T-0898) create/update 두 반환 지점 직전 self-wire(T-0993/T-0991/T-0989 mirror). issue-action leaf 삼단 완결. T-0995 이미 main 박제라 dep[]. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0996 — daily-step dual-leg run report issue-action leaf resolver 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈의 `gh search issues` 응답(hits) + 멱등 marker 를 입력받아 create-or-update 분기를 결정하는 **leaf resolver** `resolveRealDataDailyStepDualLegRunReportIssueAction`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts`, T-0898)을 T-0995 가 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts`, PR #889 squash 6c9fac13 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 resolver 에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 action drift 를 잡는다. 누군가 후보 필터링·최소 선택·create/update 경계를 편집(예: 최소 대신 최대 issueNumber 선택, `body.includes` 후보 판정 기준 변경, create↔update 경계 오류, number guard 완화)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 손상 action 이 step ④ live wiring 으로 조용히 새어나가 잘못된 이슈에 갱신하거나 중복 이슈를 생성할 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `resolveRealDataDailyStepDualLegRunReportIssueAction` 이 action 을 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action, searchHits, marker)` 를 스스로 호출해 산출 즉시 자가 검증하도록 한다. 이렇게 하면 로직 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · gh-command-plan 컴포저 위임 재사용 · live wiring)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire)·T-0985(collection-plan 조립 self-wire)·T-0987(daily-report markdown 렌더러 self-wire)·T-0989(issue-descriptor 빌더 self-wire)·T-0991(issue-command-args 빌더 self-wire)·T-0993(issue-gh-argv 빌더 self-wire) 패턴의 issue-action-leaf mirror 이자, T-0995 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. 이 배선으로 issue-action leaf resolver 도 producer(T-0898)→consistency(T-0995)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void — 가드가 로직을 독립 재유도해 동일 action 을 확인)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 resolver 를 import 하지 않고(oracle 독립성 — 로직 재구현, consistency→action value 엣지 0) hit/action 타입만 `import type` 로 참조하므로, resolver 가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0995 가 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

**주의 — resolver 는 반환 지점이 2곳이다**: create 분기(`return { action: "create" };`, 현재 139행)와 update 분기(`return { action: "update", issueNumber: Math.min(...) };`, 현재 143–146행). 두 분기 모두 반환 직전에 action 을 `const` 로 묶고 self-assert 를 삽입해야 한다 — 한 분기만 배선하면 다른 분기 action 은 여전히 트립와이어 미보호로 남으므로 반드시 **두 반환 지점 모두** 배선한다(T-0993 gh-argv create/update 두 return 지점 배선 mirror).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0898) — self-wire 대상 producer. `resolveRealDataDailyStepDualLegRunReportIssueAction(searchHits, marker): RealDataDailyStepDualLegRunReportIssueAction`. **두 반환 지점**: (1) create 분기(139행) `return { action: "create" };`, (2) update 분기(143–146행) `return { action: "update", issueNumber: Math.min(...candidateNumbers) };`. 상단 inline guard 는 `assertMarkerNonBlank`(marker 빈/공백)·`assertPositiveNumber`(각 hit.number 양의 정수)만 보유. 두 return 직전에 각각 action 을 `const action = ...` 로 묶고 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action, searchHits, marker)` 호출 후 `return action;`. 로직(후보 추출·`Math.min`·create/update 분기) 재정의 0 — 기존 그대로 두고 return 직전 self-assert 만 추가한다. 상단 기존 guard 도 유지.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts` (T-0995, main 박제 6c9fac13) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action, searchHits, marker): void` — 정합이면 void, action/searchHits/marker 구조 결손 = TypeError / create↔update 오매핑·update issueNumber 재유도 최소값 불일치·후보 다수 시 최소 아닌 값 = RangeError / marker 빈·공백·hit.number 비-양정수 등 input guard 동형 위반 = Error. 이 파일은 hit/action 타입만 `import type` 로 참조하며 **resolver 를 import 하지 않는다**(oracle 독립성 — 로직 독립 재구현). resolver 가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → action value 엣지 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts` (T-0898) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다(기존 case 회귀 없이).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` (T-0993 self-wire 완료본, main 박제) — 두 반환 지점 self-wire 배선의 직접 선례(create/update 각 return 직전 `const argv` 묶기 + self-assert). 배선 형태·spy 검증 spec 관례를 그대로 issue-action 축으로 옮긴다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency` 에서 value import 하고, `resolveRealDataDailyStepDualLegRunReportIssueAction` 의 **두 반환 지점 모두**(create 분기 · update 분기) 산출된 action 을 `const action = ...` 로 묶은 뒤 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action, searchHits, marker)` 를 호출하고 그 action 을 반환한다. 정합이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 로직(후보 추출·`Math.min`·create/update 분기) 자체는 재정의 0 — 기존 그대로 두고 return 직전 self-assert 만 추가. 상단 기존 `assertMarkerNonBlank`·`assertPositiveNumber` guard 는 유지.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `resolveRealDataDailyStepDualLegRunReportIssueAction` 이 정합 action 을 throw 0 으로 정상 반환함을 assert 1+ — create 분기(후보 0건: hits `[]` / marker 미포함 hits)·update 분기(후보 1건, 후보 다수 → 최소 number) 각각. 반환 action 이 기존 기대(`{action:'create'}` / `{action:'update', issueNumber}`)와 deep-equal 유지 검증 1+.
  - **Error path**: 기존 방어 guard(`assertMarkerNonBlank`·`assertPositiveNumber`)가 self-wire 도입으로 가려지지 않음 — marker 빈/공백, hit.number 0/음수/비정수 입력이 여전히 resolver 자체(또는 self-assert)의 Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증(두 분기 모두)**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs` 를 감싼 뒤, 후보 0건 입력(create 분기)·후보 1+건 입력(update 분기) 각각에서 그 spy 가 `(반환된 action, searchHits, marker)` 인자로 정확히 호출됐음을 assert(양 분기 배선 존재 증명 — self-wire 제거 시 이 test 가 fail = de-facto regression guard). 두 분기 각각 최소 1 case.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 resolver 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `resolveRealDataDailyStepDualLegRunReportIssueAction` 이 동일 RangeError 를 전파, silent 삼킴 0) — create 분기·update 분기 각각, (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 action 이 여전히 기대와 deep-equal, 입력 searchHits 배열·각 hit 객체 미변형, 매 호출 새 action 객체 무공유) assert 1+.
  - **§9 / §12 안전성**: fixture/action/hits/marker/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 action·hits·marker 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts`(T-0995) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts`(T-0995) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- gh-command-plan 컴포저(T-0902) · gh-argv 빌더(T-0899) · 명령-args 빌더(T-0897) · descriptor 빌더(T-0896) 수정 0 — read-only. 후보 추출·`Math.min`·create/update 분기 재계산 0.
- issue-gh-command-plan leg(T-0902/T-0994)의 self-wire 신설 0 — 별도 순차 slice(본 task 는 issue-action leaf 만 삼단 완결). 잔여 consistency-미봉 sibling(`-issue-search-argv` / `-issue-outcome-parse-shape`)의 consistency/self-wire 신설 0 — 별도 순차 slice.
- issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) 의 재수정 0 — 이미 삼단 완결.
- gh search response 의 실 JSON 파싱 / `--json` 옵션 합성 재현 0 — caller 가 `JSON.parse` 해 넘긴 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 구조만 다룬다.
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재유도/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-action leaf resolver 도 producer(T-0898)→consistency(T-0995)→self-wire(본 task) 삼단 완결 — issue-descriptor·issue-command-args·issue-gh-argv sub-helper 와 동형. §109 test-hardening 은 이후 잔여 sibling 으로 이동.
- daily-report issue-박제 vein 잔여(순차 mirror 후보): (1) issue-gh-command-plan self-wire — T-0994 consistency 는 박제됐으나 producer(T-0902) self-wire 미배선(본 vein 유일한 consistency-완결·self-wire-미완 sibling, 다음 slice 1순위), (2) consistency-미봉 sibling `-issue-search-argv` / `-issue-outcome-parse-shape` consistency 신설.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

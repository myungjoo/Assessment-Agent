---
id: T-0991
title: daily-step dual-leg run report issue 명령-args 빌더 반환 직전 consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueCommandArgs 산출을 즉시 자가 검증)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-command-args
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts
plannerNote: "P5 §109 test-hardening — T-0990(PR #884 58d0f347)으로 봉한 issue-command-args consistency 가드를 producer(T-0897) 반환 직전 self-wire(T-0989/T-0985/T-0987 mirror). issue-command-args 삼단 완결. T-0990 이미 main 박제라 dep[]. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0991 — daily-step dual-leg run report issue 명령-args 빌더 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈 descriptor `{ title, marker, body }` 를 gh issue 멱등 search-or-update 명령-args 묶음(`{ searchQuery, createArgs, updateArgs }`)으로 변환하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts`, T-0897)를 T-0990 이 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts`, PR #884 squash 58d0f347 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 빌더에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다. 누군가 조립 규칙을 편집(예: searchQuery 를 marker 아닌 title 로 바꾸기, createArgs.body 와 updateArgs.body 를 서로 다르게 만들어 멱등성 파괴, labels 상수 집합 변경·복제 누락, title/body 필드 pass-through 왜곡)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 mislabel/비멱등 명령-args 가 조용히 새어나갈 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 이 명령-args 를 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(descriptor, commandArgs)` 를 스스로 호출해 조립 즉시 자가 검증하도록 한다. 이렇게 하면 조립 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · 이슈 박제 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire)·T-0985(collection-plan 조립 self-wire)·T-0987(daily-report markdown 렌더러 self-wire)·T-0989(issue-descriptor 빌더 self-wire) 패턴의 issue-명령-args-leg mirror 이자, T-0990 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. 이 배선으로 issue-command-args sub-helper 도 producer(T-0897)→consistency(T-0990)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 빌더가 아니라 descriptor·command-args 타입만 `import type` 로 참조하므로(oracle 독립성 — consistency→command-args value 엣지 0), 빌더가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0990 이 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨). 빌더는 단일 return 지점(object literal `return { searchQuery, createArgs, updateArgs }`)이라 배선 지점 1곳(반환 직전 `const commandArgs = {...}` 로 묶고 self-assert 후 반환).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — self-wire 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor): { searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }` 는 함수 상단 `assertNonBlank` 2종(descriptor.title / descriptor.marker) 후 object literal 을 **단일 지점**으로 반환한다. 그 return 직전에 `const commandArgs = { ... }` 로 묶고 self-assert 를 삽입한다(조립 로직 재정의 0 — searchQuery=descriptor.marker, createArgs={title, body, labels 복제}, updateArgs={title, body} 그대로 두고 return 직전 가드 호출만 추가).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts` (T-0990, main 박제 58d0f347) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(descriptor, commandArgs, label?): void` — 정합이면 void, commandArgs 구조 결손(searchQuery/createArgs/updateArgs 필드 부재·비객체, createArgs.title/body/labels·updateArgs.title/body 타입 위배) = TypeError / 값 drift(searchQuery≠marker, createArgs/updateArgs title/body 불일치, labels 요소·순서·개수 불일치) = RangeError / descriptor.title·marker 빈-공백 = producer 동형 Error. 이 파일은 descriptor·command-args 타입만 `import type` 로 참조하며 **command-args 빌더를 import 하지 않는다**(oracle 독립성) — 빌더가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → command-args value 엣지 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` (T-0897) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — 입력 descriptor 타입 `RealDataDailyStepDualLegRunReportIssueDescriptor { title, marker, body }`(spec 정합 fixture 입력 재사용, read-only).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency` 에서 value import 하고, `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 의 `return` **직전** 조립된 명령-args(`const commandArgs = { searchQuery, createArgs, updateArgs };`)에 대해 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(descriptor, commandArgs)` 를 호출한 뒤 그 `commandArgs` 를 반환한다. 정합이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 조립 규칙(searchQuery=marker·createArgs·updateArgs·labels 상수 복제) 자체는 재정의 0 — 조립은 기존 그대로 두고 return 직전 self-assert 만 추가한다. 상단 기존 `assertNonBlank` 2종은 유지.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 이 정합 명령-args 를 throw 0 으로 정상 반환함을 assert 1+ — descriptor(title/marker/body) 조합 다중 fixture 각각. searchQuery=marker · createArgs.body===updateArgs.body(멱등) · labels===`["realdata-e2e", "daily-step-dual-leg-run-report"]` 유지 검증 1+.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — `descriptor.title`/`descriptor.marker` 빈-공백 입력이 여전히 빌더 자체(또는 self-assert)의 Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent` 를 감싼 뒤, `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 호출 시 그 spy 가 `(descriptor, 반환된 commandArgs)` 인자로 정확히 호출됐음을 assert(배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard). 서로 다른 descriptor fixture 각각에서도 호출됨 확인 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 빌더 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 이 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 명령-args 의 searchQuery/createArgs/updateArgs/labels 가 여전히 기대값과 byte-identical, 입력 descriptor 미변형, 반환 labels 무공유) assert 1+.
  - **§9 / §12 안전성**: fixture/descriptor/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 descriptor·command-args 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts`(T-0990) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts`(T-0990) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`(T-0896) 빌더 / `...-markdown.ts`(T-0895) 렌더러 / `...-report.ts`(T-0894) 컴포저 수정 0 — read-only. title/marker/body 재계산 0.
- issue-descriptor leg(T-0896/T-0988/T-0989) · daily-report markdown leg(T-0986/T-0987) · collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- daily-report issue-박제 vein 잔여 sub-helper(`-issue-gh-argv`/`-issue-gh-command-plan`/`-issue-action`/`-issue-search-argv`/`-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(해시/템플릿/CLI 라이브러리 포함) 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-명령-args sub-helper 도 producer(T-0897)→consistency(T-0990)→self-wire(본 task) 삼단 완결 — issue-descriptor·collection-plan·daily-report markdown·eval-chain 3 sub-leg 과 동형. §109 test-hardening 은 이후 daily-report issue-박제 vein 잔여 sibling 으로 이동.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape` — consistency 짝 부재, 다음 slice 는 `-issue-gh-argv` consistency 신설(T-0988/T-0990 mirror).
- §109 잔여(credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1회, (2) `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

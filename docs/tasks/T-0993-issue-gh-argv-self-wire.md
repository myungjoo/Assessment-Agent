---
id: T-0993
title: daily-step dual-leg run report issue gh argv 빌더 반환 직전 consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueGhArgv 산출 argv 를 create/update 두 반환 지점 모두 즉시 자가 검증)
phase: P5
status: DONE
prNumber: 887
completedAt: 2026-07-14T11:52:00Z
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-gh-argv
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts
plannerNote: "P5 §109 test-hardening — T-0992(PR #886 d8222deb)으로 봉한 issue-gh-argv consistency 가드를 producer(T-0899) create/update 두 반환 지점 직전 self-wire(T-0991/T-0989/T-0985 mirror). issue-gh-argv 삼단 완결. T-0992 이미 main 박제라 dep[]. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0993 — daily-step dual-leg run report issue gh argv 빌더 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈 action(create/update) + 명령-args 를 실 `gh` 명령에 그대로 넘길 인자-벡터(argv, `string[]`)로 합성하는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueGhArgv`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts`, T-0899)를 T-0992 가 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts`, PR #886 squash d8222deb 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 빌더에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 argv drift 를 잡는다. 누군가 argv 합성 규칙을 편집(예: `--title` 뒤 값과 body 뒤바꿈, label flag-pair 순서·개수 어긋남, create 분기인데 `issue edit` argv 산출, issueNumber 문자열화 정합 파괴)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 손상 argv 가 `execFile('gh', argv)` live wiring 으로 조용히 새어나가 잘못된 gh 명령이 실행될 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 이 argv 를 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 를 스스로 호출해 합성 즉시 자가 검증하도록 한다. 이렇게 하면 합성 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live wiring 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire)·T-0985(collection-plan 조립 self-wire)·T-0987(daily-report markdown 렌더러 self-wire)·T-0989(issue-descriptor 빌더 self-wire)·T-0991(issue-command-args 빌더 self-wire) 패턴의 issue-gh-argv-leg mirror 이자, T-0992 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. 이 배선으로 issue-gh-argv sub-helper 도 producer(T-0899)→consistency(T-0992)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 빌더가 아니라 action·command-args 타입만 `import type` 로 참조하므로(oracle 독립성 — consistency→gh-argv value 엣지 0), 빌더가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0992 가 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

**주의 — 빌더는 반환 지점이 2곳이다**: create 분기(`return argv;`, 현재 129행 부근)와 update 분기(`return ["issue", "edit", ...];`, 현재 141행 부근). 두 분기 모두 반환 직전에 argv 를 `const` 로 묶고 self-assert 를 삽입해야 한다 — 한 분기만 배선하면 다른 분기 argv 는 여전히 트립와이어 미보호로 남으므로 반드시 **두 반환 지점 모두** 배선한다(T-0985 collection-plan 의 disabled/enabled 두 return 지점 배선 mirror).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` (T-0899) — self-wire 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs): string[]`. **두 반환 지점**: (1) create 분기 = `const argv = ["issue", "create", "--title", title, "--body", body]` 후 labels flag-pair 전개 loop 뒤 `return argv;`, (2) update 분기 = `return ["issue", "edit", String(issueNumber), "--title", title, "--body", body];`. 상단 inline guard 는 `assertNonBlank`(title/body 빈-공백)·`assertPositiveIssueNumber`(update issueNumber 양의 정수)만 보유. 두 return 직전에 각각 argv 를 `const` 로 묶고(create 는 이미 `const argv` 존재, update 는 배열 리터럴을 `const argv` 로 추출) `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 호출 후 반환한다(합성 로직 재정의 0 — 동사·title/body/labels 위치 규칙은 기존 그대로 두고 return 직전 가드 호출만 추가).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts` (T-0992, main 박제 d8222deb) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv, action, commandArgs): void` — 정합이면 void, argv/action/commandArgs 구조 결손 = TypeError / 동사 분기 불일치·title/body 위치 drift·labels flag-pair 순서·개수·원소 불일치·issueNumber 문자열화 불일치·update argv 잉여 원소 = RangeError. 이 파일은 action·command-args 타입만 `import type` 로 참조하며 **gh-argv 빌더를 import 하지 않는다**(oracle 독립성) — 빌더가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → gh-argv value 엣지 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts` (T-0899) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0898) — 입력 action 타입 `RealDataDailyStepDualLegRunReportIssueAction`(create/update 분기, update 시 issueNumber: number)(spec fixture 입력 재사용, read-only).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` (T-0897) — 입력 command-args 타입 `RealDataDailyStepDualLegRunReportIssueCommandArgs`(`{ searchQuery, createArgs: { title, body, labels }, updateArgs: { title, body } }`)(spec fixture 입력 재사용, read-only).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency` 에서 value import 하고, `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 의 **두 반환 지점 모두**(create 분기 `return argv;` 직전 · update 분기 배열 리터럴 반환 직전) 합성된 argv 에 대해 `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 를 호출한 뒤 그 argv 를 반환한다. update 분기는 배열 리터럴을 `const argv = [...]` 로 추출한 뒤 self-assert 후 `return argv;`. 정합이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 합성 규칙(동사·title/body 위치·labels flag-pair 전개·issueNumber 문자열화) 자체는 재정의 0 — 합성은 기존 그대로 두고 return 직전 self-assert 만 추가한다. 상단 기존 `assertNonBlank`·`assertPositiveIssueNumber` guard 는 유지.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 이 정합 argv 를 throw 0 으로 정상 반환함을 assert 1+ — create 분기(labels 0개/1개/다수)·update 분기 각각. 반환 argv 가 기존 기대 벡터(`["issue", "create", "--title", ...]` / `["issue", "edit", String(issueNumber), ...]`)와 byte-identical 유지 검증 1+.
  - **Error path**: 기존 방어 guard(`assertNonBlank`·`assertPositiveIssueNumber`)가 self-wire 도입으로 가려지지 않음 — createArgs.title/body·updateArgs.title/body 빈-공백, update issueNumber 비-양의정수 입력이 여전히 빌더 자체(또는 self-assert)의 Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증(두 분기 모두)**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs` 를 감싼 뒤, create action 호출 시·update action 호출 시 **각각** 그 spy 가 `(반환된 argv, action, commandArgs)` 인자로 정확히 호출됐음을 assert(양 분기 배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard). 두 분기 각각 최소 1 case.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 빌더 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 이 동일 RangeError 를 전파, silent 삼킴 0) — create 분기·update 분기 각각, (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 argv 가 여전히 기대 벡터와 byte-identical, 입력 action·commandArgs·중첩 createArgs.labels 미변형, 매 호출 새 배열 무공유) assert 1+.
  - **§9 / §12 안전성**: fixture/action/command-args/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 argv·action·command-args 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts`(T-0992) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.ts`(T-0992) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- action 빌더(T-0898) · 명령-args 빌더(T-0897) · descriptor 빌더(T-0896) · 렌더러(T-0895) · 컴포저(T-0894) 수정 0 — read-only. title/body/labels/issueNumber 재계산 0.
- issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) · daily-report markdown leg(T-0986/T-0987) · collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- daily-report issue-박제 vein 잔여 sub-helper(`-issue-gh-command-plan`/`-issue-action`/`-issue-search-argv`/`-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- `--repo owner/repo` 인자 / repo slug 정합 검증 0 — 빌더가 issue create/edit 핵심 인자만 산출하고 repo 컨텍스트는 caller 책임.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(execa·zod·ajv·CLI 라이브러리 포함) 도입 0.
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-gh-argv sub-helper 도 producer(T-0899)→consistency(T-0992)→self-wire(본 task) 삼단 완결 — issue-command-args·issue-descriptor·collection-plan·daily-report markdown·eval-chain 3 sub-leg 과 동형. §109 test-hardening 은 이후 daily-report issue-박제 vein 잔여 sibling 으로 이동.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape` — consistency 짝 부재, 다음 slice 는 `-issue-gh-command-plan` consistency 신설(T-0988/T-0990/T-0992 mirror).
- §109 잔여(credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1회, (2) `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

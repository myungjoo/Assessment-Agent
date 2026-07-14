---
id: T-0989
title: daily-step dual-leg run report issue-박제 descriptor 빌더 반환 직전 consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueDescriptor 산출을 즉시 자가 검증)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-descriptor
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
plannerNote: "P5 §109 test-hardening — T-0988 로 봉한 issue-descriptor consistency 가드를 producer(T-0896) 반환 직전 self-wire(T-0985/T-0987 mirror). T-0988 이미 main 박제(bcf75de0)라 dep[]. 빌더 단일 return 지점. consistency→producer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0989 — daily-step dual-leg run report issue-박제 descriptor 빌더 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report descriptor 를 daily-test rolling-issue 박제용 `{ title, marker, body }` descriptor 로 묶는 순수 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`, T-0896)를 T-0988 이 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts`, PR #882 squash bcf75de0 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 빌더에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다. 누군가 조립 규칙을 편집(예: 제목 prefix 문구 변경, runToken 결합 순서 `gitSha@dateToken` 로 뒤집기, marker prefix·`-->` 종결 규약 변경, body 2블록 결합 순서/빈 줄 구분 파괴, gitSha/dateToken 빈-공백 guard 완화)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 mislabel/비멱등/손상된 이슈 박제 descriptor 가 조용히 새어나갈 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 이 `{ title, marker, body }` 를 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor)` 를 스스로 호출해 조립 즉시 자가 검증하도록 한다. 이렇게 하면 조립 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · 이슈 박제 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire)·T-0985(collection-plan 조립 self-wire)·T-0987(daily-report markdown 렌더러 self-wire) 패턴의 issue-박제-leg mirror 이자, T-0988 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. 이 배선으로 issue-descriptor sub-helper 도 producer(T-0896)→consistency(T-0988)→self-wire(본 task) 삼단이 완결된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 빌더가 아니라 descriptor 타입만 `import type` 로 참조하므로(oracle 독립성 — consistency→issue-descriptor value 엣지 0), 빌더가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0988 이 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨). 빌더는 단일 return 지점(`return { title, marker, body };`)이라 배선 지점 1곳.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — self-wire 대상 producer. `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report): { title; marker; body }` 는 함수 상단 `assertNonBlank` 2종(gitSha/dateToken) 후 `token`/`title`/`marker`/`body` 를 조립하고 `return { title, marker, body }` **단일 지점**으로 반환한다. 그 return 직전에 self-assert 를 삽입한다(조립 로직 재정의 0 — prefix 상수·runToken·body 2블록 결합 그대로 두고 return 직전 가드 호출만 추가). 이미 `renderRealDataDailyStepDualLegRunReportMarkdown` 를 value import 하므로 import 스타일 참조 가능.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` (T-0988, main 박제 bcf75de0) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor, label?): void` — 정합이면 void, descriptor 구조 결손(title/marker/body 필드 부재·비string) = TypeError / 값 drift(title prefix/token, marker prefix/token/`-->` 종결, body 의 marker 라인·빈 줄 구분·마크다운 블록) = RangeError. 이 파일은 report descriptor 로부터 `RealDataDailyStepDualLegRunReport` 타입만 `import type` 로 참조하며 **issue-descriptor 빌더를 import 하지 않는다**(oracle 독립성) — 빌더가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → issue-descriptor value 엣지 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` (T-0896) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport` descriptor 타입 + status/overallStatus enum(spec 정합 fixture 입력 재사용, read-only).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` 수정 — `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent` 를 `./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency` 에서 value import 하고, `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 의 `return { title, marker, body }` **직전** 조립된 descriptor(`const descriptor = { title, marker, body };`)에 대해 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor)` 를 호출한 뒤 그 descriptor 를 반환한다. 정합 descriptor 이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 조립 규칙(prefix 상수·runToken 결합·title/marker 합성·body 2블록 결합) 자체는 재정의 0 — 조립은 기존 그대로 두고 return 직전 self-assert 만 추가한다. 상단 기존 `assertNonBlank` 2종은 유지.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 이 정합 descriptor 를 throw 0 으로 정상 반환함을 assert 1+ — leg status 조합(예: eval=pass/collect=fail, eval=skip/collect=skip, all-pass) 다중 fixture 각각. 동일 run 이면 leg status 가 달라도 title/marker 동일(멱등) 유지 검증 1+.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — `report.gitSha`/`dateToken` 빈-공백 입력이 여전히 빌더 자체(또는 self-assert)의 Error/TypeError 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent` 를 감싼 뒤, `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 호출 시 그 spy 가 `(report, 반환된 descriptor)` 인자로 정확히 호출됐음을 assert(배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard). per-leg status·overallStatus 다른 fixture 각각에서도 호출됨 확인 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 빌더 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 이 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 descriptor 의 title/marker/body 가 여전히 기대 문자열과 byte-identical, 입력 report 미변형) assert 1+.
  - **§9 / §12 안전성**: fixture/report/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 report descriptor·issue descriptor 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts`(T-0988) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts`(T-0988) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`(T-0895) 렌더러 / `...-report.ts`(T-0894) 컴포저 수정 0 — read-only. 마크다운/status 재계산 0.
- collection-plan leg(T-0984/T-0985) · daily-report markdown leg(T-0986/T-0987) · eval-chain 3 sub-leg(input/activity-map/collect-request) 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- daily-report issue-박제 vein 잔여 sub-helper(`-issue-command-args`/`-issue-gh-argv`/`-issue-gh-command-plan`/`-issue-action`/`-issue-search-argv`/`-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 `deploy/daily-test.sh` step ④ 실 이슈 박제 / gh issue 실 호출 wiring 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(해시/템플릿 라이브러리 포함) 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) issue-박제 descriptor leg 도 producer(T-0896)→consistency(T-0988)→self-wire(본 task) 삼단 완결 — collection-plan·daily-report markdown·eval-chain 3 sub-leg 과 동형. §109 test-hardening 은 이후 daily-report issue-박제 sub-helper vein 잔여 또는 다른 vein 으로 이동 검토.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling): `-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` / `-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape` — `result-issue-*` 사촌과 달리 consistency 짝 부재, 순차 mirror 후보(별도 큐잉).
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1회(운영/env 층), (2) `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.

---

## Result (DONE — 2026-07-14)

- PR #883 round 1/7 reviewer APPROVE (0 BLOCKER / 0 MAJOR / 0 MINOR / 0 NIT), 4-게이트 PASS, squash **71d450a2** + feature branch delete.
- 변경: test-only 2파일 +222/-1 (helper self-wire +23/-1, colocated spec self-wire describe R-112 4종 +199). src·dep 0.
- `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 이 `{ title, marker, body }` 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor)` value import 후 self-assert — 조립·oracle drift 순간 모든 호출 경로에서 즉시 throw. consistency→producer 는 type-only import 라 런타임 순환 0, 정합 산출엔 tautology(void).
- 384 suites / 10152 tests green, All files line 99.95% / func 100% / branch 99.25% (threshold line≥80% AND func≥80% 충족).
- issue-descriptor sub-helper 삼단 완결: producer(T-0896) → consistency(T-0988) → self-wire(T-0989).
- 머지-커밋 main CI(71d450a2)는 push 시점 in_progress — 다음 fire 에서 conclusion 재확인(R-114).

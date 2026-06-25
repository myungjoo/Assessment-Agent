---
id: T-0669
title: outcome-step-args 컴포저 산출↔(runPlan.run, stdout) 재유도 정합 순수 가드 신설 (assertRealDataResultOutcomeStepArgsConsistentWithSources)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-outcome-step-args-consistency.ts
  - test/helpers/realdata-e2e-result-outcome-step-args-consistency.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — publish-step-args consistency 가드(T-0667)의 post-실행 outcome-step-args layer mirror, 가드신설만(self-wire 후속)"
---

# T-0669 — outcome-step-args 컴포저 산출↔(runPlan.run, stdout) 재유도 정합 순수 가드 신설

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 연속 slice. step④ 는 두 sub-path 를 갖는다 — **pre-실행** publish(`buildRealDataResultPublishStepArgs`)와 **post-실행** outcome(`buildRealDataResultOutcomeStepArgs`). pre-실행 측은 consistency 가드 신설(T-0667) + composer self-wire(T-0668) 짝이 이미 닫혔으나, **post-실행 측 outcome-step-args 컴포저에는 정합 가드가 아직 부재**하다. `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(T-0600)는 검증된 run plan 에서 단일 run 식별자 `runPlan.run` 을 추출해 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`(T-0596) 로 thread-위임한다 — 즉 컴포저가 (1) `runPlan.run` 을 올바른 인자 위치로 추출·재전달하고 (2) 위임 산출 outcome report 를 변형/누락 없이 그대로 반환하는지가 합성 무결성의 핵심 seam 이다. 본 task 는 그 합성이 single-source 재유도와 byte-identical 정합하는지 런타임에서 강제하는 독립 불변식 가드 `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout)` 를 **신설만** 한다 (publish-step-args consistency 가드 T-0667 의 post-실행 layer mirror). 합성 회귀로 손상된 outcome report 가 step④ live runner 로 새기 전 fail-fast throw 로 차단한다. 컴포저 self-wire(반환 직전 self-assert) 는 본 task Out of Scope — 후속 slice(T-0668-style self-wire mirror).

## Required Reading

- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — 가드 대상 컴포저. `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(L109~118)이 L117 에서 `return buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로 위임-반환한다. 본 가드는 이 컴포저가 `runPlan.run` 을 올바른 인자 위치로 추출·재전달하고 산출 outcome report 를 변형/누락 없이 반환하는지 검증.
- `test/helpers/realdata-e2e-result-publish-step-args-consistency.ts` — 1:1 mirror 선례(T-0667). 본 가드는 이 파일의 구조(`isPlainObject`/`describe`/`deepEqual` helper + `assertPlanStructure`/`assertRunPlanStructure` + 재유도 단일-source + 구조 결손=TypeError / 값 정합 위반=RangeError fail-fast)를 동형으로 따른다. 다른 점: (a) 검증 대상이 다중-구성요소 plan({report,commandArgs,searchArgv}) 이 아니라 **단일 outcome report 객체**(`{issueNumber, url, gitSha, dateToken, summaryLine}`)다 → 비교가 plan 전체 deep-equal 1회로 단순화(구성요소별 순회 불필요), (b) 위임 종단 함수가 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`(인자 순서 `stdout, runPlan.run`)다.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — outcome report 타입(L49~55 `RealDataResultIssueOutcomeReport` = issueNumber:number / url:string / gitSha:string / dateToken:string / summaryLine:string). 구조 검증의 형태 기준. import type 재사용(신규 type 정의 0).
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — 재유도 위임 종단 함수(`buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` L88~). 본 가드가 expected 를 재유도할 때 직접 호출하는 single-source(재구현 금지). 잘못된 stdout(URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/비정수) → 파서 throw, `runPlan.run.gitSha`/`dateToken` 빈/공백 → 빌더 guard throw 를 자체 try/catch 없이 전파함 확인.
- `test/helpers/realdata-e2e-run-plan.ts` — `RealDataE2eRunPlan` 타입(`runPlan.run` = `RealDataResultIssueRunRef` = gitSha + dateToken). import type 재사용.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `assertRealDataResultOutcomeStepArgsConsistentWithSources(report, runPlan, stdout): void` 순수 가드를 `test/helpers/realdata-e2e-result-outcome-step-args-consistency.ts` 에 신설. 검증 불변식: `expected = buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 를 single-source 직접 재유도(재구현 0 — 위임 종단 함수 호출만, 컴포저와 정확히 같은 인자 순서 `stdout, runPlan.run`) → `report` 가 expected 와 deep-equal byte-identical(전 필드 issueNumber/url/gitSha/dateToken/summaryLine).
- [ ] **에러 정책(구조 결손=TypeError / 값 정합 위반=RangeError)**: (a) `report`/`runPlan` null/undefined · `report` 비-object · 필수 필드(issueNumber 비-number / url·gitSha·dateToken·summaryLine 비-string) 결손 · `runPlan.run` 비-object → 한국어 TypeError. (b) 재유도 expected 와 `report` drift → 한국어 RangeError(메시지에 어느 필드/전체가 어긋났는지 포함). (c) 재유도 chain throw(`runPlan.run` 식별자 빈/공백, 잘못된 stdout 등)는 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). silent 통과 0.
- [ ] **비변형 / 순수**: `report`(읽기·비교만) / `runPlan`(읽기만 — run 추출, mutate 0) / `stdout`(문자열·불변). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 report 면 항상 void, drift 면 항상 동일 지점 throw).
- [ ] **Happy-path unit test**: 정상 (report, runPlan, stdout) — `buildRealDataResultOutcomeStepArgs` 산출 report 를 그대로 넘기면 throw 0(void). create-URL stdout·edit-URL stdout 분기 각각 통과 round-trip 확인.
- [ ] **Error path unit test**: (a) `report`/`runPlan` null/undefined → TypeError 1+, (b) `report` 필수 필드 결손(issueNumber 비-number, url/gitSha/dateToken/summaryLine 비-string 각) → TypeError 1+, (c) `runPlan.run` 비-object → TypeError 1+, (d) 재유도 expected 와 drift 한 손상 report(예: summaryLine 변형, issueNumber off-by-one) → RangeError 1+, (e) 위임 throw 입력(`runPlan.run.gitSha`/`dateToken` 빈/공백, 잘못된 stdout — URL 미발견/비-github/`/pull/`/issueNumber 0) → 위임 throw 그대로 전파 1+ (가드가 RangeError/TypeError 로 뒤바꾸지 않음).
- [ ] **Flow / branch cover**: (a) 구조 통과 → 재유도 → deep-equal 통과 → void 분기, (b) 구조 결손 TypeError 분기, (c) drift RangeError 분기, (d) 재유도 throw 전파 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 재유도가 위임 종단 함수를 정확한 인자(stdout, runPlan.run)·순서·1회로 호출함을 spyOn 으로 검증, (b) drift 의 각 필드별(issueNumber/url/gitSha/dateToken/summaryLine 변형) RangeError, (c) 동일 입력 두 번 호출 deterministic(같은 void/throw), (d) 입력 report/runPlan/stdout 비변형(필드·runPlan.run mutate 0), (e) 빈 stdout·whitespace-only stdout 위임 throw 전파, (f) 정상 report 의 byte-identical 사본(JSON round-trip)도 통과 — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신설 가드 파일 `realdata-e2e-result-outcome-step-args-consistency.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. 가드와 컴포저가 같은 위임 종단 함수를 import 하므로 runtime cycle 0 (tsc green 확인).

## Out of Scope

- 컴포저 self-wire 배선(`buildRealDataResultOutcomeStepArgs` 반환 직전 self-assert) — 별도 후속 slice(T-0668-style self-wire mirror). 본 task 는 가드 신설만.
- `buildRealDataResultOutcomeStepArgs` 컴포저 / 위임 종단 함수(`buildRealDataResultIssueOutcomeReportFromOutput`, 그 하위 T-0589/T-0590) 본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
- 자동 복구 / report 재합성 / 정규화 / 기본값 채움 0 — 손상 report 를 고치거나 silent 수선하지 않는다(fail-fast).
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape/outcome-report/publish-plan/publish-step-args)의 추가 가드 또는 self-wire — 본 task 는 outcome-step-args 컴포저 consistency 가드 1건만.
- 상위 `buildRealDataE2eStepArgs`/`realdata-e2e-run-plan` 컴포저용 가드 — 별도 후속 slice.
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 가드 신설 후 다음 후보: 본 가드를 `buildRealDataResultOutcomeStepArgs` 반환 직전 self-wire 하는 짝 slice(T-0668-style composer self-wire mirror) → 그로써 outcome-step-args layer seam 의 가드신설+self-wire 짝 닫힘. 그 위 상위 `buildRealDataE2eStepArgs`/`realdata-e2e-run-plan` 컴포저 seam 가드신설+self-wire 짝, 또는 step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토.)

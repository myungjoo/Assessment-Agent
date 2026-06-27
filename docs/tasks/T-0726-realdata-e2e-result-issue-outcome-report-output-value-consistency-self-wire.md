---
id: T-0726
title: realdata-e2e result-issue outcome-report 산출↔(outcome,run) 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: DONE
completedAt: 2026-06-27T17:25:00Z
mergedAs: 8482bbb73dae147e8be732e300ee937cbfae8655
prNumber: 642
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-28
independentStream: realdata-e2e-result-issue-outcome-report-output-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only self-wire — 컴포저 1 줄 배선 + colocated spec self-wire describe + (선택) 가드 spec 동기. T-0722/T-0724 self-wire sibling 선례 정합. src 무변경."
plannerNote: "P5 consistency sweep — T-0725 가드 짝 닫기. buildRealDataResultIssueOutcomeReport 단일 return(L126) 직전 기존 summary-line 가드 다음에 assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run) self-assert(report/outcome/run 셋 다 return site 가용). 가드 type-only import 라 순환 0·top-level import T-0724/T-0722 mirror. dependsOn [] 독립"
---

# T-0726 — realdata-e2e result-issue outcome-report 산출↔(outcome,run) 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 실 평가 e2e bullet 의 build-time consistency-guard sweep 짝 닫기 task 다. 직전 T-0725(PR #641)가 outcome-report 종단 NO-GUARD-value leaf 컴포저 `buildRealDataResultIssueOutcomeReport`(`test/helpers/realdata-e2e-result-issue-outcome-report.ts`, T-0590)의 **값-정합 가드** `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run)`(컴포저 재호출 없이 `(outcome, run)` 으로부터 expected 5 필드 `{issueNumber, url, gitSha, dateToken, summaryLine}` 를 독립 재유도해 deep-equal 대조, issueNumber/url/gitSha/dateToken **전파** 값 drift·url trim 정규화 누락·summaryLine 합성 drift·추가필드 drop drift fail-fast)를 신설했다. 그러나 컴포저 자신의 단일 return 사이트(현 L126 `return report;`)는 아직 **summaryLine 단일 필드 내부 정합 가드**(`assertRealDataResultIssueOutcomeReportSummaryLineConsistent`, T-0701/T-0702)만 self-wire 하고 있어, 본 신설 값-정합 가드는 spec 에서만 호출되고 컴포저 산출 객체에는 배선되지 않았다(origin/main grep 0 부재 확인). summary-line 가드는 summaryLine ↔ 구성 4 필드 내부 정합만 보므로 issueNumber/url/gitSha/dateToken **전파** drift·url trim 누락을 놓친다 — 그 gap 을 본 self-wire 가 컴포저 산출 경로에서 build-time fail-fast 로 닫는다. output-parse 의 T-0723→T-0724 self-wire, search-parse 의 T-0721→T-0722 self-wire 의 정확한 post-execution mirror. REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 마저 닫는다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run)` 로 **세 인자**(산출 `report` + 입력 `outcome` + 입력 `run`)를 받는다. 컴포저 `buildRealDataResultIssueOutcomeReport(outcome, run)` 의 단일 return 사이트(현 L126 `return report;`)에서 `outcome`·`run` 은 파라미터로, `report` 는 이미 `const report: RealDataResultIssueOutcomeReport = {...}`(L111~117)로 묶여 있어 **셋 다 가용**하므로 컴포저 단일 호출 안에서 self-wire 가능하다. 현 코드는 이미 `const report = {...}` → summary-line 가드 self-wire(L124) → `return report;`(L126) 구조라, 그 `return report;` 직전(summary-line 가드 호출 다음)에 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run);` 한 줄을 추가하면 된다(report 변수 재구성 불요 — T-0724 self-wire 동형, 인자 1 개만 더 받음).

**순환 의존 없음(top-level import)**: 값-정합 가드 `realdata-e2e-result-issue-outcome-report-output-consistency.ts`(T-0725) 는 `RealDataResultIssueOutcomeReport`·`RealDataResultIssueOutcome`·`RealDataResultIssueRunRef` 를 전부 `import type` only 로만 가져오고(L49~51) 컴포저로부터 **value 를 import 하지 않는다**(value import 0). 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0724/T-0722/T-0720 type-only top-level import mirror — lazy require 불요).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — self-wire 대상 컴포저 `buildRealDataResultIssueOutcomeReport(outcome, run): RealDataResultIssueOutcomeReport`. **단일 return 사이트**(L126 `return report;`, 직전 L124 에 이미 summary-line 가드 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` self-wire 가 있음). self-wire 는 그 summary-line 가드 호출 **다음**·`return report;` **직전**에 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run);` 한 줄을 추가. 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단(L40 summary-line 가드 import 인근)에 값-정합 가드 top-level import 1 줄 추가. 기존 summary-line self-wire 는 **유지**(대체·삭제 금지 — summaryLine 내부 정합 가드와 5 필드 전체 값 가드 공존).
- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts`(T-0725) — self-wire 할 가드. `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report: RealDataResultIssueOutcomeReport, outcome: RealDataResultIssueOutcome, run: RealDataResultIssueRunRef): void`(L237, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError). 세 type 을 전부 `import type` only 로 가져오고(L49~51) 컴포저 value import 0(순환 의존 0 근거).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts`(T-0724 self-wire 완료본) + 그 spec — **직전 sibling self-wire mirror**. type-only import 라 top-level import + 단일 return 직전 self-assert 패턴(lazy require 불요)을 그대로 따른다. 본 task 는 인자가 3 개(report, outcome, run)인 점만 다르다(T-0724 는 2 개 outcome, stdout).
- `docs/tasks/T-0724-realdata-e2e-result-issue-output-parse-value-consistency-self-wire.md` — **self-wire idiom 참조 task**. import 위치·return 직전 배선·jest.spyOn 검증·byte-identical 무변경·기존 set-equality self-wire 유지 패턴의 직접 template(본 task 는 set-equality 대신 summary-line 가드 유지, 인자 3 개).
- `test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts` — 기존 컴포저 spec(무회귀 대상 + self-wire describe 추가 위치). 본 task 의 self-wire 검증 test(jest.spyOn 1 회 호출·인자 순서 report+outcome+run·throw 선전파·산출 byte-identical 무변경)를 본 colocated spec 에 describe 로 추가.
- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts` — 가드 본체 spec(무회귀 대상). self-wire 호출수/경로 동기가 필요하면만 갱신, 불필요하면 무변경.

## Acceptance Criteria

`buildRealDataResultIssueOutcomeReport` 단일 return 사이트 직전(기존 summary-line 가드 호출 다음)에 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`realdata-e2e-result-issue-outcome-report-output-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-result-issue-outcome-report.ts` 상단에 `import { assertRealDataResultIssueOutcomeReportOutputConsistentWithInput } from "./realdata-e2e-result-issue-outcome-report-output-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `buildRealDataResultIssueOutcomeReport` 의 `return report;`(L126) 직전, 기존 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` 호출 **다음**에 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run);` self-assert 추가. 산출 `report` 객체 값·참조-무공유(매 호출 새 객체) 무변경. 인자 순서 `(report, outcome, run)` 준수(가드 시그니처와 동일).
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 report·outcome·run 을 읽기·재유도·비교만). 기존 summary-line self-wire(`assertRealDataResultIssueOutcomeReportSummaryLineConsistent`)는 **유지**(대체·삭제 금지) — summaryLine 내부 정합 가드와 5 필드 전체 값 가드 둘 다 호출.
- [ ] 가드 본체(`realdata-e2e-result-issue-outcome-report-output-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path test 1+**(`realdata-e2e-result-issue-outcome-report.spec.ts` self-wire describe) — `buildRealDataResultIssueOutcomeReport(outcome, run)` 가 정상 입력(issueNumber 양수·url 정상·gitSha/dateToken 비공백·url trailing 공백 trim happy-path)에 대해 throw 0 으로 기존과 동일한 5 필드 report 를 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 report + 입력 outcome + 입력 run 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 report 와 동일 참조·둘째 인자가 입력 outcome 과 동일·셋째 인자가 입력 run 과 동일·인자 순서 `(report, outcome, run)`.
- [ ] **Error path test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput` 가 RangeError(또는 TypeError)를 throw 하도록 강제하면 `buildRealDataResultIssueOutcomeReport(outcome, run)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError(값 정합 위반) 분기·TypeError(구조 결손) 분기 각 1+(가드 throw 선전파 negative).
- [ ] **Flow / branch coverage** — 정상(void → return report) 경로 1+ test. self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로를 cover. 기존 컴포저 분기(run.gitSha/dateToken 빈/공백 throw·outcome.url 빈/공백 throw·issueNumber 비양정수 throw)는 self-wire 도달 전 단계라 기존 spec 무회귀로 cover(self-wire 가 그 분기 동작을 바꾸지 않음 확인).
- [ ] **Negative cases 충분 cover** — 가드 throw 선전파(RangeError·TypeError 각 1+) + 결정성: self-wire 후에도 동일 입력 두 번 호출 산출이 deep-equal·참조-무공유 유지(매 호출 새 객체) test 1+. spy 가 매 호출 1 회씩 호출됨(두 번 호출 시 2 회). 기존 컴포저 자체 throw 경로(run.gitSha 빈 문자열·run.dateToken 공백·outcome.url 빈/공백·outcome.issueNumber 0/음수/비정수)가 self-wire 도달 전에 throw 돼 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음).
- [ ] **§9 정합** — self-wire 호출이 raw 활동 본문·credential 을 에러 메시지/산출에 노출하지 않음(가드는 issueNumber·url·gitSha·dateToken·summaryLine 값만 다룸 — T-0725 가드 본체 보장 그대로).
- [ ] (선택) `realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts` 에 self-wire 호출수/경로 동기가 필요하면 갱신(가드 본체 무변경 전제 — describe 문자열·호출 count assert 정도). 불필요하면 생략하고 touchesFiles 에서 빼도 무방.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), self-wire 후 컴포저 cov 100% 유지 목표.
- [ ] 전체 unit suite green(기존 result-issue-outcome-report spec·output-consistency spec 무회귀).

## Out of Scope

- 가드 본체(`realdata-e2e-result-issue-outcome-report-output-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `buildRealDataResultIssueOutcomeReport` 의 산출 규약(run.gitSha/dateToken·outcome.url 빈/공백 guard·issueNumber 양정수 guard·url trim 정규화·summaryLine 합성·`{issueNumber, url, gitSha, dateToken, summaryLine}` 정규화) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- 기존 summary-line self-wire(`assertRealDataResultIssueOutcomeReportSummaryLineConsistent`, T-0701/T-0702) 제거/대체 금지(summaryLine 내부 정합 가드와 5 필드 전체 값 가드 공존).
- 기존 `from-output` 래퍼 가드(`realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`, T-0663/T-0664) 변경 금지.
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0724/T-0722/T-0720 mirror). lazy require 는 value-import 가드 패턴이며 본 task 엔 부적합.
- 실 gh issue create/edit 호출 / `execFile` / live wiring(step ④ credential gate).
- 다른 NO-GUARD leaf(`result-issue-outcome-parse-shape`·command-args 등) 가드 신설·self-wire 는 별도 task — 본 task 는 result-issue outcome-report value-guard self-wire 단일.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0.
- 새 dependency 도입(zod 등 금지).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0724/T-0722 self-wire mirror 라 architect 불요).

## Follow-ups

- result-issue side stream 가드 사슬 진행도 점검 — search-parse(T-0721+T-0722)·output-parse(T-0723+T-0724)·outcome-report(가드 T-0725 + self-wire 본 task) 짝 닫힘 확인 후, 잔여 NO-GUARD parse-shape 류 leaf(`result-issue-outcome-parse-shape` 등)의 값-정합 가드 적용 여부 case-by-case 판정 후 별도 task.

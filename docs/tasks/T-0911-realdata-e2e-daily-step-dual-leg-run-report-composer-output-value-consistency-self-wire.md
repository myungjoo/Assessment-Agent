---
id: T-0911
title: dual-leg run report 종단 컴포저 산출 6필드↔(evalOutcome,collectOutcome,run) 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-composer-output-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report.spec.ts
sizeExempt: true
exemptReason: "test-only self-wire — 컴포저 return 객체 const 승격 + 가드 1줄 배선 + colocated spec self-wire describe(jest.spyOn 검증). T-0726(summary 축)/T-0907/T-0909(dual-leg sub-parse 축) self-wire sibling 선례 정합. src 무변경."
plannerNote: "P5 §109 step④ — T-0910 신설 가드 짝 닫기. buildRealDataDailyStepDualLegRunReport return 객체를 const report 로 승격 후 return 직전 assert...ConsistentWithInput(report,evalOutcome,collectOutcome,run) self-assert. 가드 type-only import 라 순환 0·top-level import(T-0909 mirror). dep0."
---

# T-0911 — dual-leg run report 종단 컴포저 산출 6필드↔(evalOutcome,collectOutcome,run) 값-정합 가드 컴포저 self-wire 배선

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ dual-leg run report 축 build-time consistency-guard sweep 의 **짝 닫기** task 다. 직전 T-0910(PR #804 squash aa0f1a65)이 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`, T-0894)의 **값-정합 가드** `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`)를 신설했다. 그 가드는 산출 6 필드 `{gitSha, dateToken, eval:{action,status}, collect:{action,status}, overallStatus, summaryLine}` 를 `(evalOutcome, collectOutcome, run)` 로부터 컴포저 재호출 없이 독립 재유도해 deep-equal 대조한다(구조결손 TypeError ↔ 값정합 위반 RangeError 분리).

그러나 현재 가드는 **spec 에서만 호출**되고 컴포저 자신의 return 사이트에는 배선되지 않았다(origin/main grep: 컴포저 파일에 `assertRealDataDailyStepDualLegRunReportConsistentWithInput` 0 확인). 즉 컴포저가 실제 조립 경로에서 per-leg status 파생·overallStatus 파생·gitSha/dateToken 전파·summaryLine 합성 중 값 drift 를 내도, 그 산출을 소비하는 하위 wiring(descriptor·markdown·command-args)에서는 build-time 에 잡히지 않는다. 본 self-wire 가 그 gap 을 컴포저 산출 경로에서 build-time fail-fast 로 닫는다.

이는 **summary 축 선례 T-0726**(`buildRealDataResultIssueOutcomeReport` 종단 컴포저 값-가드 self-wire) 및 같은 dual-leg 축의 하위 seam self-wire(output-parse T-0907·search-parse T-0909)의 정확한 종단 컴포저 mirror 다. REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 컴포저 산출 경로까지 마저 닫는다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 test helper 배선이라 cloud cron 에서 자율 실행 가능하다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)` 로 **네 인자**(산출 `report` + 입력 `evalOutcome`·`collectOutcome`·`run`)를 받는다. 컴포저 단일 return 사이트(현재 `return { gitSha, dateToken, eval, collect, overallStatus, summaryLine };`, 파일 L171~178)에서 `evalOutcome`·`collectOutcome`·`run` 은 파라미터로 가용하나 산출 객체는 아직 변수로 묶여있지 않다. 따라서 return 객체 리터럴을 `const report: RealDataDailyStepDualLegRunReport = {...}` 로 **승격**한 뒤 `return report;` 직전에 가드를 self-assert 한다(search-parse 축 T-0909 의 "return 객체를 const 로 묶고 return 직전 assert" 패턴 동형).

**순환 의존 없음(top-level import)**: 값-정합 가드(`realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`, T-0910)는 `RealDataDailyStepLegRunOutcome`·`RealDataDailyStepDualLegRunReport`·`RealDataDailyStepLegStatus`·`RealDataDailyStepDualLegOverallStatus` 를 컴포저 파일에서, `RealDataResultIssueRunRef` 를 `./realdata-e2e-result-issue-descriptor` 에서 전부 `import type` only 로만 가져온다(컴포저 value import 0). 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0907/T-0909/T-0726 type-only top-level import mirror — lazy require 불요).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — self-wire 대상 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run): RealDataDailyStepDualLegRunReport`. **단일 return 사이트**(현재 L171~178 `return { gitSha, dateToken, eval, collect, overallStatus, summaryLine };`). self-wire 는 그 return 객체 리터럴을 `const report: RealDataDailyStepDualLegRunReport = {...}` 로 승격 후, `return report;` 직전에 `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run);` 한 줄을 추가. 산출 객체의 값·shape·참조-무공유(매 호출 새 객체)·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단에 값-정합 가드 top-level import 1 줄 추가.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`(T-0910) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run): void`(L340, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError). 네 인자 순서 준수. 컴포저를 `import type` only 로만 참조(value import 0 → 순환 0 근거). **본 task 에서 이 파일은 무변경**(read 만).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-search-parse-consistency.ts` self-wire 완료본(T-0909) + 그 spec — **직전 sibling self-wire mirror**. return 값을 const 로 묶고 return 직전 self-assert + top-level value import(가드가 type-only) + jest.spyOn 호출수/인자 검증 패턴을 그대로 따른다. 본 task 는 인자가 4 개(report, evalOutcome, collectOutcome, run)인 점만 다르다.
- `docs/tasks/T-0726-realdata-e2e-result-issue-outcome-report-output-value-consistency-self-wire.md` — **self-wire idiom 참조 task**(summary 축 종단 컴포저 값-가드 self-wire). import 위치·return 직전 배선·jest.spyOn 검증·byte-identical 무변경·가드 throw 선전파 패턴의 직접 template(본 task 는 인자 4 개, return 객체 const 승격 동반).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.spec.ts` — 기존 컴포저 spec(무회귀 대상 + self-wire describe 추가 위치). self-wire 검증 test(jest.spyOn 1 회 호출·인자 순서 report+evalOutcome+collectOutcome+run·throw 선전파·산출 byte-identical 무변경)를 본 colocated spec 에 describe 로 추가.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계 line/func ≥ 80%) · §12(언어 정책).

## Acceptance Criteria

`buildRealDataDailyStepDualLegRunReport` 의 return 객체 리터럴을 `const report` 로 승격하고, `return report;` 직전에 `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`...dual-leg-run-report-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` 상단에 `import { assertRealDataDailyStepDualLegRunReportConsistentWithInput } from "./realdata-e2e-daily-step-dual-leg-run-report-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `buildRealDataDailyStepDualLegRunReport` 의 return 객체 리터럴(현 L171~178)을 `const report: RealDataDailyStepDualLegRunReport = { ... };` 로 승격하고, `return report;` 직전에 `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run);` self-assert 추가. 인자 순서 `(report, evalOutcome, collectOutcome, run)` 준수(가드 시그니처와 동일). 산출 `report` 객체 값·참조-무공유(매 호출 새 객체) 무변경.
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 report·evalOutcome·collectOutcome·run 을 읽기·재유도·비교만). 기존 컴포저 guard(run.gitSha/dateToken 빈/공백 assertNonBlank·assertLegLabel·resolveLegStatus action/passed 정합·deriveOverallStatus)는 **유지**(대체·삭제 금지).
- [ ] 가드 본체(`realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path test 1+**(`realdata-e2e-daily-step-dual-leg-run-report.spec.ts` self-wire describe) — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` 가 정상 입력(run+passed=true → all-pass·run+passed=false → some-fail·둘 다 skip → all-skip·혼합 → partial 대표 조합)에 대해 throw 0 으로 기존과 동일한 6 필드 report 를 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 report + 입력 evalOutcome + collectOutcome + run 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 report 와 동일 참조·둘째/셋째/넷째 인자가 각 입력과 동일·인자 순서 `(report, evalOutcome, collectOutcome, run)`.
- [ ] **Error path test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataDailyStepDualLegRunReportConsistentWithInput` 가 RangeError(또는 TypeError)를 throw 하도록 강제하면 `buildRealDataDailyStepDualLegRunReport(...)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError(값 정합 위반) 분기·TypeError(구조 결손) 분기 각 1+(가드 throw 선전파 negative).
- [ ] **Flow / branch coverage** — 정상(void → return report) 경로 1+ test. self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로를 cover. 기존 컴포저 분기(run.gitSha/dateToken 빈/공백 throw·leg 라벨 오류 throw·action="run"+passed=undefined throw·action="skip"+passed 정의 throw)는 self-wire 도달 전 단계라 기존 spec 무회귀로 cover(self-wire 가 그 분기 동작을 바꾸지 않음 확인).
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지: (a) 가드 throw 선전파(RangeError·TypeError 각 1+), (b) 결정성: self-wire 후에도 동일 입력 두 번 호출 산출이 deep-equal·참조-무공유 유지(매 호출 새 객체) test 1+(spy 가 두 번 호출 시 2 회), (c) 기존 컴포저 자체 throw 경로(run.gitSha 빈 문자열·run.dateToken 공백·leg 라벨 오류·action/passed 모순)가 self-wire 도달 전에 throw 돼 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음).
- [ ] **§9 / REQ-059 정합** — self-wire 호출이 raw 활동 본문·credential·specPath 를 에러 메시지/산출에 노출하지 않음(가드는 gitSha·dateToken·leg action/status·overallStatus·summaryLine 값만 다룸 — T-0910 가드 본체 보장 그대로).
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 새 외부 라이브러리(zod 등) 0. lazy require 사용 금지(가드 type-only import only 라 top-level import 가 정답 — T-0907/T-0909 mirror).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), self-wire 후 컴포저 cov 100% 유지 목표. 전체 unit suite green(기존 dual-leg run report spec·하위 seam 가드 spec 무회귀).

## Out of Scope

- 가드 본체(`realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`, T-0910) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `buildRealDataDailyStepDualLegRunReport` 의 산출 규약(run.gitSha/dateToken 빈/공백 guard·leg 라벨 정합·per-leg status 파생·overallStatus 파생·summaryLine 합성·6 필드 형상) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- 기존 컴포저 guard(assertNonBlank·assertLegLabel·resolveLegStatus·deriveOverallStatus) 제거/대체 금지.
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0907/T-0909/T-0726 mirror).
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / step ④ live wiring(credential gate, deferred).
- `deploy/daily-test.sh` step wiring / 실 jest spawn / 실 leg outcome 캡처 / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 dual-leg run report seam(descriptor·markdown·command-args·gh-argv·gh-command-plan·action)의 값-정합 가드 신설·self-wire — 본 task 는 종단 컴포저 값-가드 self-wire 단일.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0909/T-0726 self-wire mirror 라 architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 종단 컴포저 값-가드 짝(T-0910 신설 → T-0911 self-wire)이 닫히면, dual-leg run report 축의 잔여 NO-GUARD seam(descriptor·markdown·command-args·gh-argv·gh-command-plan·action)의 값-정합 가드 적용 여부는 다음 planner 가 case-by-case 판정.)

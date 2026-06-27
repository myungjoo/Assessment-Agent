---
id: T-0702
title: realdata-e2e outcome-report 종단 컴포저 self-wire 배선 (T-0701 가드 짝 닫기)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0701 신설 outcome-report summaryLine 정합 가드를 컴포저 반환 직전 self-assert 배선(T-0700 self-wire mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts
dependsOn: [T-0701]
independentStream: realdata-e2e-outcome-report-guard
---

# T-0702 — realdata-e2e outcome-report 종단 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ post-evaluation interpretation(평가 산출 → 결과 이슈 박제 → 실행 리포트 descriptor) 측 종단 컴포저 `buildRealDataResultIssueOutcomeReport(outcome, run)`(`realdata-e2e-result-issue-outcome-report.ts`, T-0590)는 직전 T-0701 이 독립 정합 가드 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)`(`realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts` L101)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(origin/main 컴포저 grep 0 확인 — L110 `return { issueNumber, url, gitSha, dateToken, summaryLine };` 직전에 이 가드 호출/import 부재). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 `summaryLine` 합성 회귀(템플릿 토큰 순서·구분자·접두 drift, 구성 필드(issueNumber/url/gitSha/dateToken)와 합성 결과의 어긋남)를 summaryLine↔구성필드 독립 재합성 축에서 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataResultIssueOutcomeReport` 를 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 report 가 step④ 박제/로그 emit wiring 으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0700 result-report-plan self-wire 의 outcome-report mirror — 가드 신설(T-0701)/self-wire 분리 패턴(T-0699→T-0700 동형)의 짝 닫기**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — self-wire 대상 종단 컴포저. **단일 return 사이트**(L110 `return { issueNumber, url, gitSha, dateToken, summaryLine };`). 본 task 는 그 반환 직전에 산출 report 를 const 로 받아 self-assert 후 반환하도록 배선한다(L110 부근). import 추가 1줄(T-0701 가드 helper) + 반환 직전 2줄(const report 선언 + 신규 가드 호출) 패턴. 입력 `outcome`·`run` mutate 0·매 호출 새 report 객체·기존 guard(`assertNonBlank`/`assertPositiveIssueNumber`) throw 그대로 전파 계약은 불변 유지.
- `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts` — 호출할 가드 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report: RealDataResultIssueOutcomeReport): void`(T-0701 신설, L101). 시그니처(단일 인자 `report`)·throw 정책(구조 결손/5 필드 type 위반 TypeError / summaryLine 독립 재합성 drift RangeError·한국어 명세형 메시지)·single-source 재합성(`report` 의 4 식별 필드만으로 컴포저 재호출 없이 expected summaryLine 직접 합성 후 byte-identical 대조)·read-only(입력 mutate 0) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts` — 컴포저 colocated spec(L37 `describe("buildRealDataResultIssueOutcomeReport — e2e 실행 리포트 컴포저")`, happy/error/negative/결정론 describe 4 블록). self-wire 배선 후 정상 합성(유효 outcome+run)이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다.
- `docs/tasks/T-0700-realdata-e2e-result-report-plan-consistency-self-wire.md` — **self-wire mirror 선례**(머지 a9e02c1f). 반환 직전 `const X = {...}; assert...(X); return X;` 호출 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명·spec self-wire 회귀 test(jest.spyOn(consistency 모듈) 호출 1회 검증) 패턴을 본 task 와 동형 차용. **차이 1점**: 본 task 의 가드는 단일 인자(`report`)라서 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` 형태(T-0700 의 `(plan, results, run)` 3 인자와 달리 1 인자) — 인자 순서 검증도 단일 인자 기준.
- `docs/tasks/T-0701-realdata-e2e-outcome-report-summary-line-consistency-guard.md` — 본 task 가 호출하는 가드의 신설 task. 가드의 회귀 유형(summaryLine 템플릿 drift / 구성필드↔합성 어긋남)·throw 분기(TypeError 구조·type / RangeError byte-identical 위반)·재합성 정책(컴포저 재호출 0, 4 필드 독립 합성) 확인(본 task 는 호출만 하므로 가드 본문 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-outcome-report.ts` 의 `buildRealDataResultIssueOutcomeReport` 가 산출 report 를 **반환하기 직전** `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` 를 호출하도록 배선한다(`import { assertRealDataResultIssueOutcomeReportSummaryLineConsistent } from "./realdata-e2e-result-issue-outcome-report-summary-line-consistency";` 추가 + 단일 return 사이트에서 `const report: RealDataResultIssueOutcomeReport = { issueNumber: outcome.issueNumber, url, gitSha: run.gitSha, dateToken: run.dateToken, summaryLine }; assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report); return report;` 형태로 배선). 정상 합성이면 가드는 void → 반환 report(5 필드)·형태 보존(관측 불가능하게 동일).
- [ ] 기존 guard(`assertNonBlank(run.gitSha/run.dateToken/outcome.url)`·`assertPositiveIssueNumber(outcome.issueNumber)`)는 **유지** — 본 task 는 신규 가드 호출을 합성 직후·반환 직전에 추가하며 기존 입력 guard 호출을 제거/변경하지 않는다.
- [ ] self-wire 배선 외 컴포저 로직(url trim 정규화·summaryLine 템플릿 합성·입력 mutate 0·매 호출 새 객체·결정론 계약)은 변경 0. 새 분기/정규화/복구 추가 0(신규 가드는 read-only fail-fast 만). 기존 guard throw 선전파 정책 불변.
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경(컴포저 본체 + colocated spec).
- [ ] happy-path unit test 1+ — colocated spec 에서 `buildRealDataResultIssueOutcomeReport(outcome, run)` 가 정상 입력(유효 outcome{issueNumber>0, url} + 유효 run{gitSha, dateToken})에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 검증. 반환 report 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)·구조 보존도 확인.
- [ ] error path unit test 1+ — 기존 입력 guard 가 비식별 입력(빈 gitSha/dateToken/url, 0/음수/비정수 issueNumber)에 throw 하는 정책은 기존 spec 이 cover. self-wire 가 **정상 산출물에 대해 신규 가드를 우회/중복 throw 시키지 않음**을 검증(유효 입력의 정상 report → throw 0). 신규 가드가 손상 summaryLine 에 throw 하는 정책은 T-0701 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 직선 경로, 기존 guard 통과 후 도달), 컴포저의 입력 분기(유효 outcome+run 정상 경로 · 각 입력 guard throw 경로)마다 정상/throw 를 test 1+ 로 cover. 정상 경로는 신규 가드 self-assert 통과(throw 0) 확인.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 빈 gitSha → 입력 guard throw(기존 cover, 신규 가드 미도달 — self-wire 가 기존 throw 정책을 깨지 않음), (2) 빈 url → 입력 guard throw, (3) 비양수 issueNumber → 입력 guard throw, (4) 유효 입력 → 신규 가드 self-assert 통과(throw 0)·반환 report 보존, (5) self-wire 발동 증명 회귀 test 1+(정상 산출물이 summaryLine 불변식을 만족해 void 임 — self-wire 경로가 실제로 신규 가드를 호출함을 jest.spyOn(consistency 모듈) 호출 1회 검증). self-wire 누락 시 fail 하도록.
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 신규 가드를 호출함을 입증하는 test. jest.spyOn 으로 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent` 호출이 정상 호출마다 정확히 1회 발생함을 검증, 인자(report — 반환되는 객체와 동일 참조 또는 deep-equal)도 확인. self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec 의 outcome/run fixture + T-0700 self-wire spec 패턴(jest.spyOn) 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책/재합성 로직은 T-0701 그대로 불변.
- **기존 입력 guard(`assertNonBlank`/`assertPositiveIssueNumber`) 제거/변경** — 유지. 본 task 는 신규 가드 호출 추가만(합성 후·반환 직전).
- **from-output 가드(`realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`, T-0663) self-wire/수정** — 별개 가드. 본 task 범위 밖.
- **production `src/` 코드 변경** — step④ 박제 wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — url trim·summaryLine 템플릿·throw 선전파·결정론·매 호출 새 객체 계약 불변. 자동 복구/정규화/기본값 채움 0.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 outcome-report self-wire 단일 짝만. 그 외 step④/step⑤ 확장·NO-GUARD leaf 가드 신설은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0700 거의 byte-동형 — architect 생략. 컴포저 1줄 import + 단일 return 사이트에서 const report 선언 + 반환 직전 신규 가드 self-assert 삽입(기존 입력 guard 호출 유지) + spec self-wire 회귀 test 추가).

## Follow-ups

- (본 task 머지 후) outcome-report 측 build-time consistency 사슬 완결 점검 — summaryLine 정합 가드(T-0701) 신설 + 종단 self-wire(본 task) 닫힘 후, step③/step⑤ build-time consistency 사슬 self-wire 잔여 sweep 으로 planner 가 다음 짝 큐잉.
- NO-GUARD 컴포저 중 상위 가드 미cover leaf(live-gating, result-summary, result-issue-{action,descriptor} 등) 가드 신설 여부 case-by-case survey 후 큐잉.

## 완료 기록

- **Status: DONE** (2026-06-27T04:50Z, cron@aa-cloud-2fb578)
- PR #618 squash 머지 `f4ab99df` — reviewer round1 APPROVE(0 BLOCKER/0 MAJOR/0 MINOR), 4-게이트 PASS, CI green(first-pass).
- 변경: +89/-2, 2 파일 test-only(`test/helpers/realdata-e2e-result-issue-outcome-report.ts` self-wire + `.spec.ts` self-wire describe). production `src/` 변경 0.
- `buildRealDataResultIssueOutcomeReport` 단일 return 직전 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` self-assert 배선 — 기존 입력 guard 유지, 컴포저 cov 100% 보존.

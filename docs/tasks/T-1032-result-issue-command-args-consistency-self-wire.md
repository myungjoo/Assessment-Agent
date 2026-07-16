---
id: T-1032
title: summary-axis command-args-consistency 가드 producer self-wire 배선 (daily T-1025 mirror)
phase: P5
status: DONE
completedAt: 2026-07-16T10:54:00Z
prNumber: 926
mergedSquash: 9d405b0f
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args.ts
  - test/helpers/realdata-e2e-result-issue-command-args.spec.ts
independentStream: realdata-e2e-result-issue-command-args
plannerNote: "P5 test-hardening — T-1031 신설 full-recomposition 가드를 요약축 producer 반환 직전 self-assert 로 배선(daily T-1024→T-1025 create→self-wire cadence mirror). pr test-only 2파일."
---

# T-1032 — summary-axis command-args-consistency 가드 producer self-wire 배선 (daily T-1025 mirror)

## Why

PLAN.md P5 line 109(🟢 실 평가 e2e = github.com myungjoo/leemgs 공개 활동, step ④ daily-test 결과 이슈 박제)의 결과-박제 surface 무결성 조각(REQ-059·REQ-032). T-1031 이 요약축(result-issue)에 daily 원본 T-0991 을 mirror 한 full-object independent recomposition 오라클 `assertRealDataResultIssueCommandArgsConsistent` **가드+colocated spec 을 신설**했으나, self-wire(producer 반환 직전 self-assert 배선)는 명시적으로 후속 task 로 남겼다(daily T-1024 create → T-1025 self-wire 2단 cadence).

pre-check(`git show origin/main:test/helpers/realdata-e2e-result-issue-command-args.ts`)로 확인한 현행 gap: 요약축 producer `buildRealDataResultIssueCommandArgs` 는 반환 직전 자매 가드 두 개(body-marker `...CommandArgsBodyPreservesDescriptor` L147, labels-title `...CommandArgsLabelsTitleConsistent` L156)만 self-assert 하고, T-1031 신설 full-recomposition 가드 `assertRealDataResultIssueCommandArgsConsistent` 는 배선되어 있지 않다(guard 파일·그 spec 에만 존재, producer import 0). 즉 신설 오라클이 live 산출 경로를 아직 지키지 못한다 — make-work 아님, 실 배선 gap.

본 task 는 daily T-1025(`assertRealData...IssueCommandArgsConsistent` producer self-wire) 를 요약축으로 mirror 해, producer 가 합성한 명령-args 를 caller(live wiring)로 반환하기 직전 신설 full-recomposition 가드로 self-assert 하도록 배선한다. 이로써 요약축도 daily 축과 동일하게 triple-oracle(full-recomposition + body-marker + labels-title) 세 가드 모두를 producer self-wire 로 강제하는 parity 를 완성한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 배선 대상 producer(163행). import 블록(L58~59 자매 가드 두 개) + `buildRealDataResultIssueCommandArgs` 반환 직전 self-wire 블록(L141~157: body-marker self-assert `(args, descriptor)` → labels-title self-assert `(args, descriptor, RESULT_ISSUE_LABELS)` → `return args`). 신설 가드 self-assert 를 이 두 self-assert 옆에 mirror 배치한다.
- `test/helpers/realdata-e2e-result-issue-command-args-consistency.ts` — 신설 가드(T-1031). 공개 signature `assertRealDataResultIssueCommandArgsConsistent(commandArgs, descriptor, label?)` — **artifact-first**(commandArgs 1번째, descriptor 2번째). 세 번째 `label?` 은 **error-message context prefix(문자열)** 이지 expectedLabels 가 아니다(labels 상수는 가드 내부 `RESULT_ISSUE_LABELS` 재현). 따라서 self-wire 호출은 자매 body-marker 처럼 `(args, descriptor)` 2-arg — label 생략.
- `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` — 배선 spec(547행). 기존 "body marker-first 가드 self-wire 배선 (T-0650)" describe 블록(L161~) 이 `jest.spyOn(module, "assert...")` 로 (a) 실제 호출 경로 배선 + (b) byte-identical 반환 보존 + (c) 회귀 모사 시 throw 를 검증하는 패턴. 이 패턴을 신설 가드용 describe 로 mirror.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts` — daily self-wire 원본(T-0991/T-1025) 참고(요약축과 이름·타입만 다름, 배선 구조 동형).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args.ts` 의 producer `buildRealDataResultIssueCommandArgs` 가 `return args` 직전에 신설 가드를 self-assert: `assertRealDataResultIssueCommandArgsConsistent(args, descriptor)` (artifact-first 2-arg, label 생략). 자매 가드 self-assert 두 개는 유지(제거·순서 파괴 금지) — 세 self-assert 가 나란히 존재.
- [ ] top-level import 1줄 추가: `import { assertRealDataResultIssueCommandArgsConsistent } from "./realdata-e2e-result-issue-command-args-consistency";` (기존 자매 import 옆). runtime cycle 0(같은 디렉토리 함수 호출).
- [ ] self-wire 블록에 한국어 명세형 주석(왜 self-assert 하는지 · 정상 합성이면 void 라 byte-identical 보존 · 회귀 시 fail-fast throw) 추가 — 자매 블록 톤 정합, T-1031/T-1025 참조 명시.
- [ ] **Happy-path test 1+**: self-wire 후에도 정상 descriptor 에 대해 producer 가 byte-identical 명령-args 를 반환(void 가드 통과)하는 test 1+.
- [ ] **Error-path test 1+ (각 분기)**: (a) `jest.spyOn` 으로 신설 가드가 회귀를 모사(throw)하도록 mock → producer 가 그 throw 를 전파하는 test 1+; (b) 가드가 실제 호출 경로에 배선됐음을 spy 호출-횟수/인자(`args, descriptor` 순서)로 검증하는 test 1+.
- [ ] **Flow/branch coverage**: 세 self-assert 가 모두 호출됨(신규 가드 spy + 기존 두 자매 회귀 0)을 cover — 신규 self-assert 배선 분기 1+ test.
- [ ] **Negative cases 충분 cover**: (a) self-wire 후 입력 descriptor 를 mutate 하지 않음(비변형) test 1+; (b) self-wire 추가가 정상 입력 반환값을 바꾸지 않음(byte-identical 회귀 0) test 1+; (c) 신설 가드 spy 호출 인자가 `(args, descriptor)` artifact-first 임을 명시 검증(arg-swap footgun 방지) test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 배선 spec 통과, 기존 요약축·daily 축 spec 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — producer 파일 100% 근접 보존, 전역 임계 무회귀.
- [ ] `git grep -n "assertRealDataResultIssueCommandArgsConsistent" -- 'test/**'` 결과가 가드 파일 + 그 spec + 본 producer + 그 spec 4곳에 존재(self-wire 완결).

## Out of Scope

- 신설 가드(`realdata-e2e-result-issue-command-args-consistency.ts`)·그 colocated spec 의 로직·signature 변경(T-1031 확정, read-only).
- 기존 자매 가드(body-marker / labels-title) self-wire·로직·signature 변경.
- daily 축(`daily-step-dual-leg-run-report-issue-*`) 파일 일체 변경(read-only mirror source).
- 요약축 producer 조립 규칙(searchQuery/createArgs/updateArgs 합성) 자체 변경 — self-assert 배선만 추가.
- 다른 가드 family(gh-argv / search-* / outcome-report-* / descriptor-*)의 self-wire 감사.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

---
id: T-1031
title: summary-axis command-args-consistency full-recomposition 가드 신설 (daily T-0991 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 900
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args-consistency.ts
  - test/helpers/realdata-e2e-result-issue-command-args-consistency.spec.ts
independentStream: realdata-e2e-result-issue-command-args
sizeExempt: true
exemptReason: "R-112 backbone 신규-가드 신설 — 순수 mirror 가드 1개 + colocated spec(happy/error/branch/negative 충분 cover). test-only, src·CI·dep 0. estimate-model R-112 backbone ×1.5 + 신규 full-object 가드 특성상 ~310 가드 + ~600 spec ≈ 900 LOC. 선례 T-1024(+683 LOC sizeExempt 신규 가드 2파일)·daily 원본 T-0991(310+636=946). 가드와 그 spec 은 R-112 상 분리 불가(spec 이 신규 심볼의 test)라 1 task."
plannerNote: "P5 test-hardening — 두 축 유일 구조 비대칭 해소: 요약축에 daily T-0991 command-args full-recomposition 오라클 mirror 신설(신규 가드+spec, self-wire 는 후속). pr sizeExempt."
---

# T-1031 — summary-axis command-args-consistency full-recomposition 가드 신설 (daily T-0991 mirror)

## Why

PLAN.md P5 line 109(🟢 실 평가 e2e = github.com myungjoo/leemgs 공개 활동, step ④ daily-test 결과 이슈 박제)의 결과-박제 surface 무결성 조각(REQ-059·REQ-032). T-1010~T-1030 이 daily-step(dual-leg run report) 축의 `command-args` 가드 3종(full-recomposition `...CommandArgsConsistent`(T-0991) + body-marker(T-1009) + labels-title(T-1011))을 arg-order·naming·self-wire 까지 완전 정합화하며 축 내부 hardening 을 완결했다.

그 과정에서 확인된 **두 축(daily-step ↔ 요약축 result-issue) 사이 유일하게 남은 구조 비대칭**: 요약축(`result-issue-*`)에는 body-marker(`...CommandArgsBodyPreservesDescriptor`)·labels-title(`...CommandArgsLabelsTitleConsistent`) 두 field-focused 가드만 있고, daily 축이 보유한 **full-object independent recomposition 오라클**(`...CommandArgsConsistent`, `composeExpectedCommandArgs` 로 expected 명령-args 전체를 descriptor 만으로 재조립해 field 별 byte-identical 대조)에 해당하는 mirror 가 **부재**하다 (`git grep assertRealDataResultIssueCommandArgsConsistent -- 'test/**'` 결과 0건 확인). 즉 요약축은 명령-args 를 field 별 invariant 로만 검증하고, "전체 객체를 독립 재합성해 통째로 대조" 하는 축(shape/구조 drift·잉여 필드·조립 규칙 회귀를 잡는 축)이 없다.

본 task 는 daily 원본 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`(T-0991)를 요약축으로 mirror 해 `assertRealDataResultIssueCommandArgsConsistent` 를 신설, 두 축이 동일한 triple-oracle(full-recomposition + body-marker + labels-title) defense-in-depth 를 갖도록 parity 를 복원한다. **가드 신설만** — 요약축 producer self-wire 배선은 후속 task(daily T-1024→T-1025 의 create→self-wire 2단 cadence mirror). arg-order 는 T-1030 이 확정한 artifact-first `(commandArgs, descriptor, label?)` 로 태어난다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts` — mirror 원본(T-0991, 310행). helper 구조(`contextPrefix` / `assertCommandArgsStructure` / `assertCreateArgsStructure` / `assertUpdateArgsStructure` / `assertNonBlank` / `composeExpectedCommandArgs` / `assertLabelsConsistent`) + 공개 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(commandArgs, descriptor, label?)` 의 검사 순서(구조 TypeError → 비식별 producer-동형 Error → 독립 재유도 → searchQuery/title/body/labels RangeError)를 그대로 요약축 이름·타입으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts` — spec 원본(636행). happy/error/branch/negative 케이스 구조(정합 통과 · 구조 결손 TypeError 분기별 · 비식별 Error · 각 필드 drift RangeError · labels 개수/요소/순서 drift)를 요약축으로 mirror.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 요약축 producer. 타입(`RealDataResultIssueCommandArgs` / `RealDataResultIssueCreateArgs` / `RealDataResultIssueUpdateArgs`) + label 상수 `RESULT_ISSUE_LABELS`(= `["realdata-e2e", "result"]`) + **조립 규칙**(searchQuery = descriptor.marker / createArgs = {title, body, labels 상수 복제} / updateArgs = {title, body})을 여기서 그대로 읽어 `composeExpectedCommandArgs` 를 재구현한다(producer 재호출 0). 요약축 라벨은 daily 의 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 와 다르니 반드시 이 파일값 사용.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueDescriptor`(title/marker/body) import source.
- `test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts` — 요약축 자매 가드의 에러 문구·구조검증 패턴 참고(문구 톤 정합용, 로직 복제 금지).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args-consistency.ts` 신설 — 공개 가드 `export function assertRealDataResultIssueCommandArgsConsistent(commandArgs: RealDataResultIssueCommandArgs, descriptor: RealDataResultIssueDescriptor, label?: string): void`. signature 는 artifact-first(`commandArgs` 1번째, `descriptor` 2번째, `label?` 3번째) — T-1030 이 daily 에서 확정한 convention 을 처음부터 준수.
- [ ] 내부 `composeExpectedCommandArgs(descriptor)` 는 **요약축 producer 조립 규칙**(searchQuery=descriptor.marker / createArgs={descriptor.title, descriptor.body, [...RESULT_ISSUE_LABELS]} / updateArgs={descriptor.title, descriptor.body})을 재구현 — producer(`buildRealDataResultIssueCommandArgs`) 재호출 0(양방향 상쇄 방지). label 상수는 요약축 `RESULT_ISSUE_LABELS` 사용(daily 값 금지).
- [ ] 에러 정책 daily 동형: commandArgs null/비-객체·searchQuery/createArgs/updateArgs 필드 부재/비-객체·title/body 비-string·labels 비-배열/요소 비-string → `TypeError`; descriptor.title/marker 빈/공백-only(비식별) → producer 동형 plain `Error`; 독립 재유도 expected 와 field drift(searchQuery·title·body·labels) → `RangeError`(기대 vs 실측 노출). silent 통과 0, fail-fast 순서(구조 → 비식별 → 재유도 → 대조) 보존. 정합 시 void.
- [ ] **Happy-path test 1+**: 정합 commandArgs(producer 산출 또는 fixture)가 통과(void)하는 test 1+.
- [ ] **Error-path test 1+ (각 분기)**: TypeError 분기(commandArgs null · searchQuery 비-string · createArgs 부재 · createArgs.title 비-string · createArgs.body 비-string · createArgs.labels 비-배열 · updateArgs.title/body 비-string) 각 1+; 비식별 Error 분기(descriptor.title 공백 · descriptor.marker 공백) 각 1+; RangeError 분기(searchQuery drift · createArgs.title drift · createArgs.body drift · updateArgs.title drift · updateArgs.body drift · labels 개수 불일치 · labels 요소/순서 drift) 각 1+.
- [ ] **Flow/branch coverage**: `composeExpectedCommandArgs` · `assertLabelsConsistent`(개수 분기 + 요소별 분기) · 각 필드 대조 분기 모두 1+ test.
- [ ] **Negative cases 충분 cover**: 위 예외 분기마다 최소 1 test(단일 negative 로 축소 금지) — 경계(빈 배열 labels · label prefix 인자 유무 both) 포함.
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-command-args-consistency.spec.ts` 에 위 test 전부 배치(helper fallback 추출 불요 — 단독 가드).
- [ ] `pnpm lint && pnpm build && pnpm test` green — 신규 가드 spec 통과, 기존 요약축·daily 축 spec 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — 신규 가드 파일 100% 근접, 전역 임계 무회귀.
- [ ] `git grep -n "assertRealDataResultIssueCommandArgsConsistent" -- 'test/**'` 결과가 신규 가드 파일 + 그 spec 에만 존재(producer self-wire 는 본 task 범위 밖 — 후속).

## Out of Scope

- **요약축 producer(`realdata-e2e-result-issue-command-args.ts`) self-wire 배선** — 신규 가드를 producer 반환 직전 self-assert 로 추가하는 것은 후속 task(daily T-1024→T-1025 mirror). 본 task 는 가드+spec 신설만.
- daily 축(`daily-step-dual-leg-run-report-issue-*`) 파일 일체 변경(원본은 read-only mirror source).
- 기존 요약축 자매 가드(body-marker / labels-title) 로직·signature·self-wire 변경.
- 요약축 producer 조립 규칙 자체 변경(가드는 현행 규칙을 독립 재구현만).
- 다른 가드 family(gh-argv / search-* / outcome-report-*)의 arg-order·naming 감사.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

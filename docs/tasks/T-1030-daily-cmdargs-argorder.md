---
id: T-1030
title: daily-step command-args-consistency 가드 인자 순서를 (commandArgs, descriptor) 로 정규화
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts
independentStream: realdata-e2e-daily-report-issue-command-args
plannerNote: "P5 test-hardening — daily command-args 가드 (descriptor,commandArgs) 를 (commandArgs,descriptor) 로 정규화, sibling 5개 consistency 가드의 artifact-first convention 동형화(T-1029 Out-of-Scope 명시 후속)."
---

# T-1030 — daily-step command-args-consistency 가드 인자 순서를 (commandArgs, descriptor) 로 정규화

## Why

T-1029 로 daily-step issue descriptor 축의 signature(인자 순서) 비동형이 해소되면서, T-1029 Out of Scope 가 "다른 daily 가드(action / command-args / command-plan / publish-plan 등) 의 signature 감사" 를 별도 task 로 명시 defer 했다. 그 감사 결과, daily-step 축의 6개 sibling consistency 가드 중 **`command-args-consistency` 만 유일하게 인자 순서 convention 을 위반**한다:

- `descriptor-body`: `(descriptor, report)` — 검증 대상 artifact(descriptor) first ✓
- `descriptor-identity`: `(descriptor, report)` — artifact first ✓
- `command-plan`: `(plan, report)` — artifact(plan) first ✓
- `publish-plan`: `(plan, report)` — artifact(plan) first ✓
- `action`: `(action, searchHits, marker)` — artifact(action) first ✓
- **`command-args`: `(descriptor, commandArgs, label?)`** — source(descriptor) first, 검증 대상 artifact(commandArgs) second ✗

즉 daily 축 나머지 5개 가드는 모두 "검증 대상 artifact 를 첫 인자로, 재유도 source 를 뒤 인자로" convention 을 따르는데, `command-args-consistency` 만 반대로 source(descriptor)-first 다. 이 가드는 `composeExpectedCommandArgs(descriptor)` 로 commandArgs 를 descriptor 로부터 독립 재유도해 실측 commandArgs 와 byte-identical 대조하므로 검증 대상 artifact 는 `commandArgs`, source 는 `descriptor` 다. `(commandArgs, descriptor, label?)` 로 정규화하면 6개 sibling 전부 artifact-first 로 통일 → self-wire·spy·향후 caller 의 arg swap footgun(T-1025 journal 이 경고한 class)을 제거한다. behavior 변경 0 순수 signature 정규화다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.ts` — 정규화 대상 가드. 256~260행 signature `(descriptor, commandArgs, label?)`. 내부는 named param 참조라 선언 순서만 swap 하면 로직·throw 정책 불변. 파일 상단 § 주석에 arg-order 서술이 있으면 함께 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts` — 가드를 직접 호출하는 happy/error/negative test 전부(40 call site)의 인자 순서 갱신 대상.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — producer self-wire 호출부(172~175행 `(descriptor, commandArgs)` → `(commandArgs, descriptor)`).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` — producer self-wire spy 검증 `toHaveBeenCalledWith(HAPPY_DESCRIPTOR, args)` / `(OTHER_DESCRIPTOR, args)`(343·357행 근처) → `(args, HAPPY_DESCRIPTOR)` 형태로 갱신 대상. (551·565행의 `(args, ...)` 검증은 다른 가드 대상일 수 있으니 심볼명 대조 후 command-args 가드 건만 손댄다.)

## Acceptance Criteria

- [ ] `...command-args-consistency.ts` 의 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent` signature 를 `(descriptor, commandArgs, label?)` → `(commandArgs, descriptor, label?)` 로 swap. 내부 로직(구조 검증·비식별 guard·`composeExpectedCommandArgs` 재유도·byte-identical 대조·TypeError/RangeError throw 정책·fail-fast 순서)은 named param 참조라 선언 순서만 바꾸고 100% 보존.
- [ ] producer `...command-args.ts` 의 self-wire 호출을 `...CommandArgsConsistent(commandArgs, descriptor)` 로 갱신. 산출 commandArgs 는 byte-identical 불변, tautology(정상 시 void) 성질 보존.
- [ ] `...command-args-consistency.spec.ts` 의 40개 가드 호출을 새 인자 순서로 갱신 — 기존 happy-path test 유지(정합 commandArgs 통과 검증 1+), 기존 error-path test 유지(commandArgs 구조 위반·비객체·필드 부재/타입 오류 → TypeError, descriptor.title/marker 공백 → producer 동형 Error, searchQuery/createArgs/updateArgs drift → RangeError 각 1+), 기존 negative/경계 test 유지(각 예외 분기별 1+ — 단일 negative 로 축소 금지). 분기 신규 추가 0.
- [ ] `...command-args.spec.ts` 의 command-args 가드 self-wire spy 검증을 `toHaveBeenCalledWith(args, descriptor)` 순서로 갱신(정확히 1회 호출·인자 순서 검증 유지). 다른 가드(gh-argv 등) 대상 spy 검증은 불변.
- [ ] `git grep -nE "CommandArgsConsistent\(\s*[a-zA-Z]*[Dd]escriptor" -- 'test/**'` 결과 0건 — daily command-args 가드를 descriptor-first 로 호출하는 잔존 site 없음 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` green — daily-step command-args 가드 spec 및 producer spec 전부 통과, 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — signature swap 이라 coverage 영향 0, command-args-consistency 가드 파일 100% 유지.

## Out of Scope

- 가드 로직·재유도 순서·비교 순서·throw 정책·에러 메시지 문구 변경 (인자 순서 정규화만).
- 이미 artifact-first convention 을 준수하는 5개 sibling 가드(descriptor-body / descriptor-identity / command-plan / publish-plan / action) 의 signature 변경.
- 요약축(`result-issue-*`) 파일 변경 — 본 정규화는 daily 축 intra-axis sibling convention 통일이 근거이며 (result-issue-command-args-consistency 는 부재), 요약축은 손대지 않는다.
- `command-args-body-marker` / `command-args-labels-title` 등 인접 sub-helper 의 signature 감사 — 본 task 는 command-args-consistency 1건만.
- optional 3rd arg `label?` 의 semantics 변경 (위치만 3번째로 유지).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

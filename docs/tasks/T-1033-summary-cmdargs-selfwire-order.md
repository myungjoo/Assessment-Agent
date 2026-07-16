---
id: T-1033
title: summary-axis command-args producer 3개 self-wire 호출 순서를 daily 정본(Consistent→Body→LabelsTitle)으로 정규화 + invocationCallOrder 순서-lock test 추가 (daily spec L832 mirror)
phase: P5
status: DONE
prNumber: 927
completedAt: 2026-07-16T11:18:26Z
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args.ts
  - test/helpers/realdata-e2e-result-issue-command-args.spec.ts
independentStream: realdata-e2e-result-issue-command-args
plannerNote: "P5 test-hardening — T-1032 가 full-recomp self-assert 를 맨 뒤에 붙여 요약축 self-wire 순서(Body→LabelsTitle→Consistent)가 daily 정본(Consistent→Body→LabelsTitle, spec L832 invocationCallOrder lock)과 역순. broad-first 로 재정렬 + 순서-lock test 추가. pr test-only 2파일."
---

# T-1033 — summary-axis command-args self-wire 호출 순서 daily 정본 정규화 + 순서-lock test

## Why

PLAN.md P5 line 109(🟢 실 평가 e2e = github.com myungjoo/leemgs 공개 활동, step ④ daily-test 결과 이슈 박제)의 결과-박제 surface 무결성 조각(REQ-059·REQ-032). T-1031(full-recomposition 오라클 신설)·T-1032(그 오라클 producer self-wire 배선)로 요약축 command-args 가 daily 축과 동일한 triple-oracle(full-recomposition + body-marker + labels-title) defense-in-depth parity 를 달성했다.

그 과정에서 **두 축 사이에 남은 마지막 self-wire 비대칭**이 드러났다: 세 가드의 producer 반환-직전 self-assert **호출 순서**가 축 간에 역순이다.

pre-check(`git show origin/main:...` grep, 본 planner 확인):

- **daily 정본** (`realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` L172/L187/L205): `...CommandArgsConsistent`(full-recomp) → `...BodyPreservesDescriptor`(body-marker) → `...LabelsTitleConsistent`(labels-title) — **broad-first**. 그리고 이 순서를 daily producer spec 이 `invocationCallOrder` 로 **명시 lock** 한다(daily spec L812 describe "(iii) 세 가드 모두 여전히 호출됨 + 순서 보존(Consistent→Body→LabelsTitle)" + L832~837 `consistentSpy.invocationCallOrder[0] < bodySpy < labelsTitleSpy`).
- **요약축 현행** (`realdata-e2e-result-issue-command-args.ts` L148/L157/L176): `...BodyPreservesDescriptor`(body-marker) → `...LabelsTitleConsistent`(labels-title) → `...CommandArgsConsistent`(full-recomp) — **broad-last**. T-1032 가 신설 full-recomp self-assert 를 기존 두 self-assert **뒤에** append 했기 때문이다. 그리고 요약축 producer spec 에는 세 self-wire 가드 간 상대 호출 순서를 lock 하는 `invocationCallOrder` assertion 이 **부재**(T-1032 는 배선 존재·인자·throw 전파만 검증, 상대 순서 미검증).

즉 (a) 호출 순서가 daily 와 역순이고 (b) 순서를 잠그는 test 가 없다 — make-work 아님, 실 비대칭.

본 task 는 요약축 self-wire 블록을 daily 정본 **broad-first 순서(full-recomp → body-marker → labels-title)로 재정렬**하고, daily spec L812/L832~837 을 mirror 한 `invocationCallOrder` **순서-lock test 를 추가**한다. 근거: full-recomposition 오라클은 전체 객체를 독립 재조립·대조하는 **가장 강한(broad) 오라클**로, drift 시 shape/구조/잉여 필드까지 가장 정보량 높은 에러를 낸다 — 이를 **먼저** 실행하면 회귀 시 가장 포괄적인 진단이 first-throw 로 나오고, 두 축의 fail-fast 의미가 동형이 된다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 재정렬 대상 producer. `buildRealDataResultIssueCommandArgs` 반환 직전 self-wire 블록(현행 L146~177): body-marker self-assert `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` → labels-title self-assert `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, RESULT_ISSUE_LABELS)` → full-recomp self-assert `assertRealDataResultIssueCommandArgsConsistent(args, descriptor)`. 이 세 블록(각 한국어 명세형 주석 포함)을 **full-recomp → body-marker → labels-title 순서**로 재배치한다. import 3줄·가드 호출 인자·`return args` 위치는 불변.
- `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` — 배선 spec(현행 ~781행). full-recomposition self-wire describe 블록(L560~ 근방, spy arg 검증 L581~585 `spy.mock.calls[0]` 2-arg)·body-marker·labels-title 각 describe 블록 구조. 여기에 daily spec 을 mirror 한 **"세 가드 모두 호출 + 순서 보존(Consistent→Body→LabelsTitle)"** invocationCallOrder assertion test 를 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` — mirror 원본 spec. L778 describe "flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재·순서·인자 증명)" + L812 "(iii) 세 가드(Consistent·Body·LabelsTitle) 모두 여전히 호출됨 + 순서 보존" + L832~837 `invocationCallOrder` 3자 부등식. 이 test 구조를 요약축 이름(`...CommandArgsConsistent`/`...BodyPreservesDescriptor`/`...LabelsTitleConsistent`)으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — daily 정본 producer(L172/187/205 self-wire 순서 참고, read-only).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args.ts` 의 self-wire 블록을 **full-recomp(`assertRealDataResultIssueCommandArgsConsistent`) → body-marker(`assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`) → labels-title(`assertRealDataResultIssueCommandArgsLabelsTitleConsistent`)** 순서로 재배치. daily 정본(L172/187/205)과 동형 broad-first. 세 self-assert 의 인자(`(args, descriptor)` / `(args, descriptor)` / `(args, descriptor, RESULT_ISSUE_LABELS)`)·import·`return args` 는 불변. 각 블록의 한국어 명세형 주석도 함께 이동(주석-코드 인접 보존).
- [ ] full-recomp self-assert 주석에 "가장 강한(full-object 독립 재조립) 오라클을 먼저 실행 → drift 시 최고 정보량 first-throw, daily 정본 broad-first 순서 mirror" 취지 1줄 반영(순서 재배치 이유 명시).
- [ ] `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` 에 daily spec L812/L832~837 을 mirror 한 순서-lock test 추가: 세 가드를 각각 `jest.spyOn` 으로 감싸 producer 1회 호출 후 (a) 셋 다 호출됨(각 `toHaveBeenCalledTimes(1)`) + (b) `consistentSpy.mock.invocationCallOrder[0] < bodySpy...[0] < labelsTitleSpy...[0]` 부등식으로 **Consistent→Body→LabelsTitle 순서 보존** 검증.
- [ ] **Happy-path test 1+**: 재정렬 후에도 정상 descriptor 에 대해 producer 가 byte-identical 명령-args 를 반환(세 가드 모두 void 통과)하는 test 1+(기존 통과 유지 확인).
- [ ] **Error-path test 1+ (각 분기)**: (a) full-recomp 가드가 회귀를 모사(throw)하도록 spy → producer 가 throw 전파(이제 **가장 먼저** 실행되므로 body-marker·labels-title 미도달까지 검증) test 1+; (b) body-marker spy throw → producer throw 전파 test 1+; (c) labels-title spy throw → producer throw 전파 test 1+. 기존 세 describe 블록의 throw-전파 test 는 재정렬 후에도 green 임을 확인.
- [ ] **Flow/branch coverage**: 순서-lock test(세 spy invocationCallOrder) + 재정렬 후 full-recomp-first fail-fast 분기(full-recomp throw 시 나머지 두 가드 미호출) 각 1+ test.
- [ ] **Negative cases 충분 cover**: (a) 재정렬이 정상 입력 반환값을 바꾸지 않음(byte-identical 회귀 0) test 1+; (b) 재정렬이 입력 descriptor 를 mutate 하지 않음(비변형) test 1+; (c) 순서-lock 부등식이 실제로 Consistent-first 를 강제함을 명시(daily 와 동일 순서) test 1+. 단일 negative 로 축소 금지.
- [ ] 재정렬로 인해 기존 spec 의 **세 self-wire 가드 간 상대 "미호출(미도달)" 가정이 깨지지 않는지 확인** — 현행 spec 의 "식별자 guard 가 먼저 throw → …가드 미도달" test(L221/L234/L416/L429/L650/L663 근방)는 producer 내부 식별자 guard(세 self-wire 블록 이전)에 관한 것으로 재정렬 무관함을 검증. 만약 self-wire 가드 상호 간 "먼저 throw → 뒤 가드 미호출" 가정에 의존하는 test 가 있으면 새 순서(Consistent→Body→LabelsTitle)에 맞게 정정.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 재정렬·순서-lock test 통과, 기존 요약축·daily 축 spec 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — producer 파일 cov 100% 근접 보존, 전역 임계 무회귀.
- [ ] 검증: `git show HEAD:test/helpers/realdata-e2e-result-issue-command-args.ts | grep -nE "assertRealDataResultIssueCommandArgs(Consistent|BodyPreservesDescriptor|LabelsTitleConsistent)\("` 결과의 등장 순서가 Consistent → BodyPreservesDescriptor → LabelsTitleConsistent(daily 정본과 동형).

## Out of Scope

- 세 가드 본체(`-consistency` / `-command-args-body-marker` / `-labels-title`) 로직·signature·에러 정책 변경(read-only). 본 task 는 producer self-wire **호출 순서만** 재배치 + spec 순서-lock 추가.
- 요약축 producer 조립 규칙(searchQuery/createArgs/updateArgs 합성) 변경.
- daily 축(`daily-step-dual-leg-run-report-issue-*`) 파일 일체 변경(read-only mirror source).
- 세 self-assert 의 인자 순서(artifact-first)·label 전달 방식 변경(T-1030/T-1031/T-1032 확정, 불변).
- descriptor 축(`result-issue-descriptor-*`) self-wire 순서 감사 — 별도 seam(원하면 Follow-up).
- 실 gh 호출 / `deploy/daily-test.sh` step ④ 배선 / live LLM — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code / package.json / CI workflow / 새 dependency 변경 — 전부 0(test helper 단독).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

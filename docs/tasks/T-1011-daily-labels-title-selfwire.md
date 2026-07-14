---
id: T-1011
title: buildRealDataDailyStepDualLegRunReportIssueCommandArgs 산출 직전 command-args labels·title 정합 가드(T-1010) self-wire 배선 (요약축 T-0652 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step 축 command-args labels·title 정합 가드(T-1010)를 빌더 산출 직전 self-assert. 요약축 T-0652 mirror(T-1010 Follow-up ①). issue-still-relevant pre-check(grep origin/main): 가드 helper 는 main 박제(assertRealData...LabelsTitleConsistent export 확인)이나 빌더에 self-wire 0건(command-args.ts 에 LabelsTitleConsistent grep=0 — 현재 Consistent(L171)+BodyPreservesDescriptor(L186) 두 가드만 배선) → genuine gap. single-helper-test ×1.0, dependsOn []."
---

# T-1011 — command-args labels·title 정합 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** consumer-side 가드 self-wire slice. daily-step 축은 요약축(realdata-e2e-result-*) 계열과 동형화 진행 중이며, command-args labels·title 정합 축의 **가드 신설**은 직전 T-1010 이 닫았다 — `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(args, descriptor, expectedLabels)` (`...command-args-labels-title.ts`, main 박제 확인). 그러나 이 가드는 **순수 helper 로만 존재**하며 빌더 산출 경로에 아직 배선되지 않았다.

빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` (`...command-args.ts`)는 산출 직전 두 가드만 self-assert 한다 — 구조 정합 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`(T-0991, L171)와 body marker-first 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor`(T-1009 self-wire, L186). T-1010 이 신설한 **create/update title byte-identical descriptor.title · createArgs.labels 고정-상수 exact match · labels 무공유** 4 불변식 가드는 산출 경로에 박혀있지 않아 호출되지 않는다 — 빌더가 title 전파에서 회귀(예: createArgs/updateArgs title 이 descriptor.title 과 갈라짐)하거나 labels 배선에서 회귀(상수와 어긋난 순서·원소, 또는 상수 자체 참조를 복제 없이 반환해 무공유 위반)해도 T-1010 가드는 그 회귀를 검출할 수 있으나 호출되지 않아 부정합 명령-args 가 gh issue 실배선 시 같은 run 을 두 제목으로 가르거나 label drift 로 rolling 이슈 surface 로 새 나간다.

본 task 는 그 빈칸을 채운다 — 빌더가 명령-args 를 반환하기 **직전에** `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(commandArgs, descriptor, DUAL_LEG_RUN_REPORT_ISSUE_LABELS)` 를 self-assert 한다(기존 Consistent·BodyPreservesDescriptor 가드 self-assert 옆에 나란히, `return commandArgs` 직전). 빌더는 이미 보유한 고정 labels 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS`(module-private, L83)를 expectedLabels 로 넘긴다. 정상 합성이면 세 가드 모두 void 이므로 byte-identical 보존(반환값·동작 불변), labels·title 정합 회귀 시 빌더가 손상 명령-args 를 반환하기 전에 fail-fast throw 한다. 이는 요약축 `buildRealDataResultIssueCommandArgs` 의 labels·title 가드 self-wire(T-0652, T-0651 Follow-up ①)의 daily-step mirror — T-1010 Follow-up ① 이 명시한 자연 후속 slice 다. 가드는 type-only 로 소비되던 출력 타입을 runtime 호출로 바꾸지만 같은 `test/helpers/` 모듈 함수 호출이라 runtime cycle 0.

issue-still-relevant pre-check(origin/main grep): `git grep -c LabelsTitleConsistent origin/main -- '...command-args.ts'` = 0건(빌더에 self-wire 부재 확인) + 가드 helper 는 main 에 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent` export 로 박제됨 + 빌더가 현재 Consistent(L171)·BodyPreservesDescriptor(L186) 두 가드만 self-assert 함 확인 → genuine gap, 중복 아님.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — self-wire 대상 빌더. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`. 현재 L186 의 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(commandArgs, descriptor)` self-assert 직후·`return commandArgs`(L191~) 직전에 labels·title 가드 self-assert 1지점 추가 배선. 빌더가 보유한 고정 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS`(L83, module-private readonly 배열)를 expectedLabels 인자로 넘긴다. 식별자 guard(`assertNonBlank`)·title 전파(`createArgs.title = descriptor.title`·`updateArgs.title = descriptor.title`)·labels 복제(`[...DUAL_LEG_RUN_REPORT_ISSUE_LABELS]`, L158)·기존 두 가드 호출·순수성/무공유 주석 본문 변경 0. body 가드 self-wire(T-1009, L186 주석 + 호출 1지점) 패턴 동형.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.ts` (T-1010) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(args: RealDataDailyStepDualLegRunReportIssueCommandArgs, descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor, expectedLabels: readonly string[]): void` — 정상이면 void, 불변식 위반(create/update title byte 불일치·labels 고정상수 exact 불일치·labels 무공유 위반)이면 fail-fast throw. **본문 변경 0** — 호출만. import 경로는 같은 `test/helpers/` 디렉토리.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` — 기존 빌더 colocated spec. 본 task 는 이 파일에 labels·title self-wire 검증 describe 를 append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). 기존 fixture·descriptor 생성 패턴 재사용. `jest.spyOn` 으로 가드가 빌더 반환 직전 `(commandArgs, descriptor, DUAL_LEG_RUN_REPORT_ISSUE_LABELS 와 동치 배열)` 인자로 호출됨을 검증하는 패턴 참조. T-1010 가드 helper 자체 spec(`...-labels-title.spec.ts`)은 본 task 에서 변경 0.
- **패턴 선례 (직접 template — 참조만, 본문 변경 0)**: `docs/tasks/T-0652-realdata-result-issue-command-args-labels-title-self-wire.md`(DONE) — 요약축 command-args labels·title 가드 self-wire. import 1줄 + 호출 1지점, 반환값/동작 불변, type-only import 가 runtime 호출로, 고정 labels 상수를 expectedLabels 로 전달. 본 task 는 그 daily-step mirror — 식별자·타입만 치환.
- **직전 daily-step 축 self-wire 선례 (동형 형태 참조만)**: `docs/tasks/T-1009-daily-step-command-args-body-marker-self-wire.md`(DONE, mergedAs 78b7fc61) — 같은 daily-step 빌더에 body marker 가드를 self-wire 한 직전 slice. 본 task 는 그 옆 labels·title-side 형제(비중복 세 번째 가드 배선).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 가 명령-args 객체를 반환하기 **직전에**(기존 BodyPreservesDescriptor 가드 self-assert L186 직후, `return commandArgs` 직전) `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(commandArgs, descriptor, DUAL_LEG_RUN_REPORT_ISSUE_LABELS)` 를 self-assert. import 1줄 추가 + 호출 1지점 배선. 반환 객체(`commandArgs`)를 그대로 넘겨 가드 통과 후 반환(T-0652 동형). 빌더 보유 고정 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 를 expectedLabels 로 전달. 식별자 guard(`assertNonBlank`)·title 전파 규칙·labels 복제·기존 두 가드(Consistent·BodyPreservesDescriptor) 호출·순수성/무공유 주석 본문 변경 0. 새 self-wire 지점에 요약축 T-0652·body 가드 self-wire(T-1009) 톤의 한국어 주석 1블록 박제(책임·tautology 보존·회귀 시 트립와이어·다른 두 가드와 축 비중복).
- [ ] **동작 불변 (byte-identical 보존)** — 정상 descriptor → 세 가드(Consistent + BodyPreservesDescriptor + LabelsTitleConsistent) 모두 void → 빌더가 기존과 byte-identical 명령-args 반환. self-wire 전후 정상 입력 반환값 변화 0(새 가드는 정상 경로에서 부수효과 0).
- [ ] **회귀 fail-fast** — 빌더 합성이 labels·title 정합 회귀(새 가드가 검출하는 불변식 위반: createArgs/updateArgs title 이 descriptor.title 과 drift·createArgs.labels 가 고정상수와 exact 불일치·labels 무공유 위반)하면 빌더가 손상 명령-args 를 반환하기 **전에** fail-fast throw. 손상 args 가 caller(live wiring)로 새 나가지 않음.
- [ ] **순수성·무공유·R-59 보존** — self-wire 후에도 빌더는 순수 함수 유지(부수효과 0 · 입력 mutate 0 · 매 호출 새 객체 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw 미저장). 가드 호출은 runtime cycle 0(같은 모듈 디렉토리 함수 호출). createArgs.labels 는 여전히 `[...DUAL_LEG_RUN_REPORT_ISSUE_LABELS]` 새 배열 복제로 상수와 무공유(가드가 이를 검증).
- [ ] **Happy-path test 1+**: 정상 descriptor(단일/다수 leg·다양한 gitSha/dateToken/leg status 조합·빈/변형) → 빌더가 세 가드 통과 후 정상 명령-args 반환(throw 0). 반환값이 self-wire 전과 byte-identical. 1+.
- [ ] **Error path test 각 1+**: ① 식별자 guard(title/marker 빈/공백) → 기존 throw 보존(새 가드 self-wire 가 기존 식별자 guard 동작을 깨지 않음). ② 새 가드가 검출하는 labels·title 정합 불변식 위반 시나리오(예: 빌더가 회귀해 createArgs/updateArgs title 이 descriptor.title 과 갈라지거나 labels 가 상수와 어긋나는 상황을 `jest.spyOn` 또는 가드 직접 호출로 모사) → fail-fast throw. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 세 가드 void → 정상 반환 분기. ② 식별자 guard throw 분기(title 빈 / marker 빈 각각). ③ 새 labels·title 가드 self-assert 가 빌더 반환 직전 `(commandArgs, descriptor, DUAL_LEG_RUN_REPORT_ISSUE_LABELS 와 동치)` 인자로 호출됨을 `jest.spyOn` 으로 검증(self-wire 가 실제 배선됐음 증명). ④ 기존 Consistent·BodyPreservesDescriptor 가드 self-assert 가 여전히 호출됨(회귀 0) 검증 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 descriptor 2회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음). ② **입력 비변형** — 빌드 후 입력 descriptor 변경 0 assert(호출 전후 deep-equal). ③ **self-wire 호출 인자 정합** — spyOn 으로 새 가드가 빌더 반환 직전 정확히 (반환할 commandArgs, 원본 descriptor, 고정 labels 상수) 인자로 1회 호출됨 검증. ④ **가드 순서 보존** — 식별자 guard → Consistent 가드 → BodyPreservesDescriptor 가드 → LabelsTitleConsistent 가드 순서 유지(분기 순서 보존). ⑤ **labels 무공유 보존** — self-wire 후에도 반환 createArgs.labels 가 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 상수 참조와 무공유(!==). ⑥ **R-59** — self-wire 후에도 빌더가 raw narrative(commit/PR/issue payload 전문) 미접촉. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` 에 labels·title self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). T-1010 가드 helper 자체 spec(`...-labels-title.spec.ts`)은 본 task 에서 변경 0.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 변경 대상 빌더·spec 커버리지 유지(빌더 line/branch/function 100% 목표). 전체 unit suite green(기존 빌더·가드·descriptor helper spec 무회귀).

## Out of Scope

- `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent` (T-1010) 가드 helper **본문 변경** — 본 task 는 그 가드를 빌더 산출 경로에 self-wire 만(호출 1지점 + import 1줄). 가드 로직 변경 0.
- 기존 Consistent 가드(T-0991)·BodyPreservesDescriptor 가드(T-1009) self-assert 변경·제거 — 본 task 는 labels·title 가드를 그 옆에 세 번째로 추가만.
- `RealDataDailyStepDualLegRunReportIssueCommandArgs`/`...CreateArgs`/`...UpdateArgs` 출력 타입 정의 변경 · `RealDataDailyStepDualLegRunReportIssueDescriptor` 타입 변경 · `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 상수 값 변경 — 본 task 는 self-wire 만.
- descriptor 합성 규칙·빌더 title/body/labels 전파 규칙 변경 — 본 task 는 command-args 빌더 self-wire 단독.
- 다른 realdata-e2e seam(publish-plan·search-hit-shape·search-json-fields 등)의 추가 가드 또는 mirror — 각 별도 slice.
- gh issue 실 호출 · `execFile('gh', argv)` · `gh issue create`/`edit`/`search` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·label 자동 보정·title 자동 교정·silent 수선·args 재합성 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step command-args consumer 경계의 labels·title 정합 불변식이 빌더 산출 직전 self-assert 로 박힌다 — 요약축 T-0651→T-0652 self-wire 의 daily-step mirror 완결. 이로써 daily-step command-args 는 구조(Consistent)·body marker-first(T-1009)·labels·title(본 task) 세 축 가드가 모두 빌더 산출 경로에 배선돼 요약축과 완전 동형화된다.) 예상 후속 ①: §109 잔여 미미러 seam(publish-plan·search-hit-shape·search-json-fields) mirror. ②: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

---
id: T-1051
title: result-issue(요약축) descriptor 컴포저 body 합성 위임 순서(formatSummaryLine → renderMarkdown)를 invocationCallOrder 순서-lock test 로 못박기 (descriptor 축 delegate 순서-lock leg)
phase: P5
status: DONE
mergedAs: 24c79ade
completedAt: 2026-07-16T20:45:00Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 95
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
independentStream: realdata-e2e-result-issue-descriptor
plannerNote: "P5 test-hardening — publish-plan 축(T-1049/T-1050) 완결 후 신규 인벤토리 감사. T-1050 Follow-up 이 지목한 resolve...GhCommandPlan 은 이미 T-1047/T-1048 이 lock(grep 13건) → stale, 대체 gap 채택. buildRealDataResultIssueDescriptor 는 body 배열 합성에서 두 distinct 위임(formatRealDataResultSummaryLine → renderRealDataResultSummaryMarkdown)을 순차 호출하나 spec 은 그 상대 호출 순서를 invocationCallOrder 로 못박지 않음(4건 전부 guard self-wire Body→Identity T-1035 용). daily descriptor 는 단일 render 위임뿐이라 daily counterpart 부재 — standalone summary leg. 2-delegate 한 부등식 lock. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1051 — result-issue(요약축) descriptor 컴포저 body 합성 위임 순서(formatSummaryLine → renderMarkdown) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리 2 축(T-1042/T-1043), from-output 컴포저(T-1044), command-plan 컴포저 daily·summary(T-1045/T-1046), gh-command-plan(resolve) 컴포저 daily·summary(T-1047/T-1048), publish-plan 컴포저 daily·summary(T-1049/T-1050)가 완료됐다.

T-1050 Follow-up 이 다음 감사 지점으로 지목한 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 계열은 **이미 T-1047/T-1048 이 순서-lock 완료**(pre-check: `git grep -c invocationCallOrder test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` = 13건, 동형 daily spec 도 13건 — resolve 컴포저의 parse→resolveAction→buildGhArgv 3-delegate lock 이 바로 그것)이므로 Follow-up 지목은 stale 이다. 대신 신규 인벤토리 감사로 **아직 delegate 순서-lock 이 없는 요약축 descriptor 컴포저**를 채택한다.

`buildRealDataResultIssueDescriptor(summary, run)` 컴포저는 body 배열 합성 지점에서 **두 distinct 위임을 순차 호출**한다 — (1) `formatRealDataResultSummaryLine(summary)`(body 3블록 중 한 줄 요약) → (2) `renderRealDataResultSummaryMarkdown(summary)`(markdown 본문 블록). 배열 리터럴이 좌→우로 평가되므로 실제 호출 순서는 formatSummaryLine 먼저 → renderMarkdown 나중이다. **현행 spec 은 각 위임 산출이 body 안에 byte-identical 로 박히는지(값 대조)는 검증하나, 두 위임의 상대 호출 순서(format → render)는 못박지 않는다** — spec 의 invocationCallOrder 4건은 전부 descriptor self-wire 가드 쌍(Body→Identity, T-1035)용이고 두 body-합성 위임의 module namespace 를 spyOn 하는 지점은 부재(pre-check 확인). 따라서 컴포저 본문에서 실수로 두 위임 평가 순서를 재정렬하는 회귀가 발생해도(값 대조는 순서 무관이라 통과) 순서 부등식 test 가 없다.

daily descriptor(`buildRealDataDailyStepDualLegRunReportIssueDescriptor`)는 body 를 marker + `renderRealDataDailyStepDualLegRunReportMarkdown(report)` 단일 render 위임으로만 합성하므로 format→render 2-delegate 구조가 **없다** — 따라서 본 leg 는 daily counterpart 가 없는 standalone 요약축 leg 다(daily-canonical → summary-mirror cadence 미적용). 2-delegate chain 이라 한 부등식으로 lock. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` — 본 task 가 수정할 유일 파일. 현행 import 는 두 위임을 **named import** 로 보유한다 — `import { formatRealDataResultSummaryLine } from "./realdata-e2e-result-summary-line"`(L30) · `import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown"`(L31). **`jest.spyOn` 을 위해 두 위임의 module namespace import 를 신규 추가**해야 한다(예: `import * as summaryLineModule from "./realdata-e2e-result-summary-line"` · `import * as summaryMarkdownModule from "./realdata-e2e-result-summary-markdown"`) — 기존 named import 는 그대로 두고 spyOn 은 namespace 객체 프로퍼티에 건다. 기존 fixture `makeSummary`(L34)·`HAPPY_RUN`(L56) 재사용. 기존 self-wire 순서-lock describe(L776 근처, bodyConsistencyModule/identityConsistencyModule spyOn + invocationCallOrder 부등식) 를 새 delegate 순서-lock describe 의 구조 선례로 삼되, spyOn 대상은 두 body-합성 위임 module 로 바꾼다.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataResultIssueDescriptor` 함수 L114~165: guard(gitSha/dateToken 빈·공백 → assertNonBlank throw, L123~124) → token/title/marker 합성 → **body 배열 합성 L134~140: `[marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")`** → self-wire 가드 Body(L147)·Identity(L159) → `return { title, marker, body }`. ⚠️ 두 위임은 데이터 의존이 없다(둘 다 `summary` 를 독립 입력받아 body 의 서로 다른 위치에 배치) — 순서-lock 은 배열 좌→우 평가 순서(format 먼저)를 못박는 defense-in-depth 다.
- `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` L776~806(T-1035 self-wire 가드 순서-lock 선례) — 두 module namespace 를 실 구현 pass-through `jest.spyOn`(mockImplementation 없이)으로 감싸고 `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식을 `toBeLessThan` 으로 검증한 구조를 delegate 축으로 mirror.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 body 합성 두 위임 순서를 못박는 test 1개 추가 — formatSummaryLine 위임(`summaryLineModule.formatRealDataResultSummaryLine`)·renderMarkdown 위임(`summaryMarkdownModule.renderRealDataResultSummaryMarkdown`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataResultIssueDescriptor(summary, HAPPY_RUN)`(재사용 fixture)을 1회 호출한 뒤 `summaryLineSpy.mock.invocationCallOrder[0] < summaryMarkdownSpy.mock.invocationCallOrder[0]` 부등식(formatSummaryLine → renderMarkdown 순서)을 `toBeLessThan` 으로 검증. 추가로 각 spy 가 정확히 `(summary)` 인자로 호출되고 호출 횟수(`toHaveBeenCalledTimes(N)` — self-wire 가드 재유도가 이들을 다시 호출하는지 실제 구조를 확인해 N 을 맞춤; 순서-lock 은 첫 호출 `invocationCallOrder[0]` 로 판정하므로 재유도 횟수와 무관하게 안정)를 assert.
- [ ] **error path/negative 보강**: guard-우선 분기 — descriptor guard 가 throw 하는 입력(`HAPPY_RUN` 의 `gitSha: ""` 또는 `dateToken: ""` — assertNonBlank throw, body 합성 미도달)일 때 `summaryLineSpy` 와 `summaryMarkdownSpy` 가 **둘 다 `toHaveBeenCalledTimes(0)`**(guard-먼저 순서로 인해 body 합성 위임 미도달)이고 컴포저 호출이 그 에러를 선전파(fail-fast)함을 검증하는 test 1개 추가. 단일 negative 만으로 부족하지 않도록 gitSha·dateToken 두 빈-입력 분기를 각각 cover(`it.each` 또는 별도 case 2개).
- [ ] **branch/negative 보강**: 순서-lock test 는 pass-through spy 이므로 산출 `descriptor` 가 순서-검증 전후 deep-equal(byte-identical·무공유; `title`/`marker`/`body` 필드만 보유)임을 재확인하는 assert 1개 추가. body 안 한 줄 요약·markdown 블록이 각 spy 반환값과 byte-identical(기존 값 대조 test 와 정합)임을 재확인. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-descriptor.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "summaryLineModule\|summaryMarkdownModule" test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` 가 1건 이상(이전 0건) — 두 body-합성 위임의 namespace spyOn 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(formatSummaryLine → renderMarkdown)를 lock 만 하고 바꾸지 않는다.
- formatSummaryLine / renderMarkdown 위임 helper·self-wire 가드(Body/Identity) 로직·인자·에러 정책 변경.
- descriptor self-wire 가드 쌍(Body→Identity) 순서-lock — 이미 T-1035 이 cover(본 task 는 body-합성 delegate 쌍만).
- daily descriptor spec 변경 — daily 는 body 를 단일 render 위임으로 합성해 2-delegate 구조 부재(counterpart 없음).
- resolve...GhCommandPlan / command-plan / publish-plan 컴포저 순서-lock — 이미 T-1045~T-1050 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) descriptor 축 delegate 순서-lock(본 task) 완결 후, 아직 delegate/guard 순서-lock 이 없는 상위 orchestrator 컴포저(`realdata-e2e-result-summary.ts` · `realdata-e2e-pipeline-plan.ts` · `realdata-e2e-run-plan.ts` · `realdata-e2e-evaluation-plan.ts` — pre-check: 각 spec invocationCallOrder 0건)를 감사해 2+ distinct delegate 순차 호출 여부를 확인하고 sweep 확장 지점 지목.

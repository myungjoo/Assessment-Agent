---
id: T-0987
title: daily-step dual-leg run report 마크다운 렌더러 반환 직전 consistency drift-guard self-wire (renderRealDataDailyStepDualLegRunReportMarkdown 산출을 즉시 자가 검증)
phase: P5
status: DONE
mergedAs: db98b679
prNumber: 881
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-markdown
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts
plannerNote: "P5 §109 test-hardening — T-0986 로 봉한 daily-report markdown consistency 가드를 renderer 반환 직전 self-wire(T-0985/T-0982/T-0983 self-wire mirror). T-0986 이미 main 박제라 dep[]. 렌더러 단일 return 지점. consistency→renderer 는 type-only import 라 런타임 순환 없음. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0987 — daily-step dual-leg run report 마크다운 렌더러 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report descriptor 를 rolling-issue 박제용 결정론적 마크다운 문자열로 변환하는 순수 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`, T-0895)을 T-0986 이 독립 oracle 재유도-대조 drift-guard `assertRealDataDailyStepDualLegRunReportMarkdownConsistent`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts`, PR #880 이미 main 박제)로 짝 지었다.

문제는 그 가드가 **아직 렌더러에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다. 누군가 렌더 규칙을 편집(예: 헤더 문구 변경, 슬롯 순서 재배치, `eval→collect` 고정 행 순서 파괴, `| leg | action | status |` 표 헤더/구분선 변형, `- git sha:`/`- date token:`/`- overall status:`/`- summary:` prefix 오타, 빈-공백 guard 완화)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 mislabel/손상된 리포트 본문이 조용히 이슈로 새어나갈 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `renderRealDataDailyStepDualLegRunReportMarkdown` 이 마크다운 문자열을 반환하기 **직전** `assertRealDataDailyStepDualLegRunReportMarkdownConsistent(report, markdown)` 를 스스로 호출해 렌더 즉시 자가 검증하도록 한다. 이렇게 하면 렌더 규칙과 oracle 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · 이슈 박제 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0982(activity-map 매핑 self-wire)·T-0983(collect-request 조립 self-wire)·T-0985(collection-plan 조립 self-wire) 패턴의 daily-report-leg mirror 이자, T-0986 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. consistency helper 는 렌더러가 아니라 descriptor 타입만 `import type` 로 참조하므로(확인됨 — consistency→renderer value 엣지 0), 렌더러가 이 가드를 value import 해도 **런타임 순환 의존 없음**. T-0986 이 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨). 렌더러는 단일 return 지점(`const markdown = [...].join("\n"); return markdown;`)이라 배선 지점 1곳.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` (T-0895) — self-wire 대상 producer. `renderRealDataDailyStepDualLegRunReportMarkdown(report): string` 는 함수 상단 `assertNonBlank` 3종 후 `const markdown = [...].join("\n")` 로 조립하고 `return markdown` **단일 지점**으로 반환한다. 그 return 직전에 self-assert 를 삽입한다(렌더 로직 재정의 0 — 조립 배열·슬롯 순서·표 리터럴 그대로 두고 return 직전 가드 호출만 추가).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts` (T-0986, main 박제) — 배선할 가드. `assertRealDataDailyStepDualLegRunReportMarkdownConsistent(report, markdown, label?): void` — 정합이면 void, 구조 결손 = TypeError / 값·문자열 drift(헤더·run 식별자 3행·overallStatus 행·leg 표 슬롯·`eval→collect` 순서·표 헤더/구분선·summary 행) = RangeError. 이 파일은 descriptor 로부터 `RealDataDailyStepDualLegRunReport` 타입만 `import type` 로 참조하며 **렌더러를 import 하지 않는다**(oracle 독립성) — 렌더러가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → renderer value 엣지 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts` (T-0895) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport` descriptor 타입 + status/overallStatus enum(spec 정합 fixture 입력 재사용, read-only).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` 수정 — `assertRealDataDailyStepDualLegRunReportMarkdownConsistent` 를 `./realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency` 에서 value import 하고, `renderRealDataDailyStepDualLegRunReportMarkdown` 의 `return markdown` **직전** `assertRealDataDailyStepDualLegRunReportMarkdownConsistent(report, markdown)` 를 호출한 뒤 반환한다. 정합 마크다운이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 렌더 규칙(헤더·run 식별자 3행·overallStatus 행·leg 표·`eval→collect` 고정 행·summary 행·슬롯 순서/공백) 자체는 재정의 0 — 조립은 기존 그대로 두고 return 직전 self-assert 만 추가한다. 상단 기존 `assertNonBlank` 3종은 유지.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `renderRealDataDailyStepDualLegRunReportMarkdown` 이 정합 마크다운을 throw 0 으로 정상 반환함을 assert 1+ — leg status 조합(예: eval=pass/collect=fail, eval=skip/collect=skip) 다중 fixture 각각.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — `report.gitSha`/`dateToken`/`summaryLine` 빈-공백 입력이 여전히 렌더러 자체(또는 self-assert)의 Error/TypeError 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataDailyStepDualLegRunReportMarkdownConsistent` 를 감싼 뒤, `renderRealDataDailyStepDualLegRunReportMarkdown` 호출 시 그 spy 가 `(report, 반환된 markdown)` 인자로 정확히 호출됐음을 assert(배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard). per-leg status·overallStatus 다른 fixture 각각에서도 호출됨 확인 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 렌더러 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `renderRealDataDailyStepDualLegRunReportMarkdown` 이 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 마크다운이 여전히 기대 문자열과 byte-identical, 입력 report 미변형) assert 1+.
  - **§9 / §12 안전성**: fixture/report/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 배선은 report descriptor·마크다운 구조만 다룸) assert 유지(기존 case 재사용 가능).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts`(T-0986) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts`(T-0986) 본문 수정 0 — value import·호출만(가드 재정의 0). 재유도 규칙 재구현 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`(T-0894) descriptor 컴포저 수정 0 — 타입 read-only. status/overallStatus 재계산 0.
- collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg(input/activity-map/collect-request) · gating(live-gating) · seed-fixture 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- daily-report vein 잔여 issue-박제 sub-helper(`-issue-descriptor`/`-issue-command-args`/`-issue-gh-argv`/`-issue-gh-command-plan`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 `deploy/daily-test.sh` step_eval wiring / 실 이슈 박제 / gh issue 실 호출 수정 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 배선으로 daily-report(step ④) markdown leg 도 렌더러(T-0895)→consistency(T-0986)→self-wire(본 task) 삼단 완결 — collection-plan·eval-chain 3 sub-leg 과 동형. §109 test-hardening 은 이후 daily-report issue-박제 sub-helper vein 또는 다른 vein 으로 이동 검토.
- daily-report vein 잔여(consistency 미봉 sibling): `daily-step-dual-leg-run-report-issue-descriptor` / `-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` 등 issue-박제 sub-helper 들도 `result-issue-*` 사촌과 달리 consistency 짝 부재 — 순차 mirror 후보(별도 큐잉).
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 재배선 + 결과 daily-test 이슈 박제.

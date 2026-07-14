---
id: T-0986
title: 실 평가 e2e daily-step dual-leg run report 마크다운 렌더러(renderRealDataDailyStepDualLegRunReportMarkdown) consistency drift-guard 순수 helper + colocated R-112 spec
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-markdown
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — collection-plan leg 삼단 완결(T-0985) 후 daily-report(step ④) vein 로 이동. T-0895 markdown 렌더러에 sibling -consistency 부재 표면(result-summary-markdown-consistency mirror). producer 무변경(self-wire 는 후속). pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0986 — daily-step dual-leg run report 마크다운 렌더러 consistency drift-guard 순수 helper + colocated R-112 spec

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, T-0895 가 dual-leg run report descriptor(`RealDataDailyStepDualLegRunReport` — gitSha/dateToken/eval{action,status}/collect{action,status}/overallStatus/summaryLine)를 rolling-issue 박제용 **결정론적 마크다운 문자열**로 변환하는 순수 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`)을 봉했다.

문제는 이 렌더러에 sibling 관례인 **`-consistency` drift-guard 짝이 부재**하다는 점이다. summary 축은 이미 descriptor(T-0580)→마크다운 렌더러(T-0581)→consistency 가드(`realdata-e2e-result-summary-markdown-consistency.ts`)를 갖춘 반면, dual-leg run report 축은 렌더러(T-0895)만 있고 그 산출을 독립 oracle 로 재유도-대조하는 drift-guard 가 없다. 누군가 렌더 규칙을 편집(예: 헤더 문구 변경, 슬롯 순서 재배치, `eval→collect` 고정 행 순서 파괴, `| leg | action | status |` 표 헤더/구분선 변형, `- git sha:`/`- date token:`/`- overall status:`/`- summary:` prefix 오타, 빈-공백 guard 완화)하면서 그 특정 조합을 렌더러 자신의 spec 이 커버하지 않으면, mislabel 되거나 손상된 리포트 본문이 조용히 이슈로 새어나갈 수 있다.

본 task 는 그 빈칸을 채운다 — 렌더 규칙(헤더 → run 식별자 2행 → overallStatus 행 → leg 표(고정 eval→collect 순서) → summaryLine 행, 슬롯 순서·공백·줄바꿈 고정, gitSha/dateToken/summaryLine 빈-공백 금지)을 **독립 oracle 로 재유도**해 `renderRealDataDailyStepDualLegRunReportMarkdown` 산출과 문자열 byte-identical 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportMarkdownConsistent` 를 신설한다. 이는 result-summary-markdown-consistency 패턴의 dual-leg-report-leg mirror 이자, collection-plan leg 삼단 완결(T-0985) 후 §109 test-hardening 의 다음 vein 이다. 본 task 는 consistency 짝만 봉하고(렌더러 파일 무변경), 후속 slice 가 self-wire 로 이어받는다(collection-plan / eval-chain 3 sub-leg 이 밟은 삼단의 daily-report 판). 렌더러(T-0895)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` (T-0895) — 가드 대상 producer. 렌더 규칙(고정 슬롯 순서·`assertNonBlank` 3종·`eval→collect` 고정 행·표 헤더/구분선 리터럴·각 라인 prefix)을 독립 재유도의 근거로 삼는다. **가드는 이 파일의 렌더 함수를 import 하지 않는다** — 규칙을 독립적으로 재구현해 대조해야 drift 를 잡는다(oracle 독립성).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport` descriptor 타입(gitSha/dateToken/eval{action,status}/collect{action,status}/overallStatus/summaryLine) + `RealDataDailyStepLegStatus`/`RealDataDailyStepDualLegOverallStatus` enum 확인용 `import type` 대상. read-only.
- `test/helpers/realdata-e2e-result-summary-markdown-consistency.ts` — 신설 가드가 따를 sibling 형태의 canonical precedent. 시그니처(`assert...Consistent(descriptor, markdown, label?): void`), 정합=void / 구조 결손=TypeError / 값·문자열 drift=RangeError, 독립 oracle 재유도 + byte-identical 대조, §9/§12 주석 관례를 그대로 mirror 한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts` (T-0895) — 렌더러의 기존 colocated spec. 정합 fixture(정상 report → 기대 마크다운) 배치 형태를 spec 정합 입력 재사용 근거로 삼는다. read-only.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts` 신설 — `assertRealDataDailyStepDualLegRunReportMarkdownConsistent(report: RealDataDailyStepDualLegRunReport, markdown: string, label?: string): void` export. 동작: (1) `markdown` 이 string 이 아니거나 `report` 구조(객체 · gitSha/dateToken/summaryLine string · eval/collect 객체 · overallStatus string) 결손 시 한국어 메시지 TypeError. (2) `report` 로부터 **독립 재유도**한 expected 마크다운 문자열을 조립 — 렌더러와 동일한 고정 슬롯 순서(헤더 → `- git sha:` → `- date token:` → `- overall status:` → 빈 줄 → `### leg 별 run outcome` → 빈 줄 → 표 헤더 → 구분선 → `eval`→`collect` 고정 행 → 빈 줄 → `- summary:`), gitSha/dateToken/summaryLine 빈-공백이면 렌더러 규약대로 재유도 단계에서 명시 throw. (3) 실제 `markdown` 과 expected 를 문자열 byte-identical 대조, 불일치 시 어느 슬롯이 drift 했는지 식별하는 한국어 메시지 RangeError. 가드는 `report`/`markdown` 을 **읽기만** 하고 mutate 0.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.spec.ts` 신설 — 신 가드에 대한 R-112 4종:
  - **Happy-path**: `renderRealDataDailyStepDualLegRunReportMarkdown` 를 producer 로 호출해 얻은 정합 마크다운(정상 report fixture)에 대해 `assertRealDataDailyStepDualLegRunReportMarkdownConsistent` 가 throw 0(void)임을 assert 1+. leg status 조합(예: eval=pass/collect=fail, eval=skip/collect=skip 등) 다중 fixture 각각.
  - **Error path**: `markdown` 비-문자열 / `report` 구조 결손(비-객체·null / gitSha 비-string / eval 결손 / overallStatus 결손) 입력에 대해 각각 TypeError 를 던짐을 각 1+ assert.
  - **Flow/branch cover — 분기마다 1+**: (a) per-leg status 3종(pass/fail/skip) 이 표 행에 정확히 반영된 정합 통과, (b) overallStatus 4종(all-pass/some-fail/all-skip/partial 등 실제 enum 값) 각 정합 통과, (c) `eval→collect` 고정 행 순서 정합 통과(입력 키 순서 무관). 각 경로 재유도 일치 검증.
  - **Negative 충분 cover — 문자열/구조 drift 유형마다 1+**: producer 정합 마크다운을 얕은 복제 후 한 조각만 손상시켜 각각 RangeError 를 던짐을 검증 — (a) 헤더 문구 변조, (b) `- git sha:` 값 변조, (c) `- date token:` 값 변조, (d) `- overall status:` 값 변조, (e) leg 표 행의 action/status 슬롯 변조, (f) `eval`↔`collect` 행 순서 뒤바꿈, (g) 표 헤더/구분선 리터럴 변형, (h) `- summary:` 값 변조. 각 1+ assert.
  - **§9 / §12 안전성**: fixture/report/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(모든 fixture 는 비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 report descriptor·마크다운 구조만 다룸) assert 1+.
- [ ] `renderRealDataDailyStepDualLegRunReportMarkdown` 파일 무변경 — 본 task 는 consistency 짝만 신설(self-wire 는 후속 slice). 렌더러에 가드 배선하지 않는다(순환 의존·행동 변경 회피).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신 가드·spec 모두 순수/결정론이라 완전 커버(신규 helper line/branch/func 100% 목표).

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`(T-0895) 렌더러 본문 수정 0 — consistency 짝만 신설. self-wire(렌더러 반환 직전 가드 자가 호출)는 본 task 밖(후속 slice).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`(T-0894) descriptor 컴포저 수정 0 — `import type` 재사용만. status/overallStatus 재계산 0.
- collection-plan leg(T-0984/T-0985) · eval-chain 3 sub-leg(input/activity-map/collect-request) · gating(live-gating) · seed-fixture 의 consistency/self-wire 재수정 0 — 이미 삼단 완결.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 `deploy/daily-test.sh` step_eval wiring / 실 이슈 박제 / gh issue 실 호출 수정 0(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드는 drift 감지 시 throw 만(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- daily-report markdown self-wire slice(후속): 본 가드를 `renderRealDataDailyStepDualLegRunReportMarkdown` 반환 직전에 self-wire 해 매 렌더 자가 검증 트립와이어화(T-0985/T-0977/T-0982/T-0983 self-wire mirror). 렌더러→guard type-only import 라 런타임 순환 없음 예상(구현 시 재확인). 본 consistency 짝이 main 박제된 뒤 dep 으로 큐잉.
- daily-report vein 잔여(consistency 미봉 sibling): `daily-step-dual-leg-run-report-issue-descriptor` / `-issue-command-args` / `-issue-gh-argv` / `-issue-gh-command-plan` 등 issue-박제 sub-helper 들도 `result-issue-*` 사촌과 달리 consistency 짝 부재 — 순차 mirror 후보(별도 큐잉).
- §109 잔여(변경 없음, credential/env 게이트라 별도 큐잉): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 재배선 + 결과 daily-test 이슈 박제.

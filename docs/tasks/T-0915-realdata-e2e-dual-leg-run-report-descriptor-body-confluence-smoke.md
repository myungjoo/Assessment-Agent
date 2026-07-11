---
id: T-0915
title: realdata-e2e dual-leg run report descriptor body 2-블록 confluence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-109]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly.smoke-spec.ts]
independentStream: realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — 형제 smoke T-0912(+357)·T-0913(+478)·T-0750(descriptor confluence) test-dominated 선례. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 PLAN §109 실 평가 e2e — dual-leg run report descriptor body(marker+markdown 2-블록) confluence smoke. 요약 축 T-0750 mirror. dependsOn [] file-disjoint stage5b 병렬.
---

# T-0915 — realdata-e2e dual-leg run report descriptor body 2-블록 confluence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 🟢 실 평가 e2e(P5)의 step ④(daily-test dual-leg run 결과 rolling-issue 박제) 경계에서, 종단 descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 는 `body` 를 **2 블록 confluence** 로 합성한다 — `marker 라인` + `renderRealDataDailyStepDualLegRunReportMarkdown(report)`(마크다운 본문), 빈 줄 1 개 구분(`[marker, "", markdown].join("\n")`). 즉 descriptor body 는 멱등 marker 와 마크다운 렌더(T-0895)가 **같은 report 로부터 합류**하는 confluence 지점이다. (요약 축 T-0750 은 marker+line+markdown 3-블록이었으나, dual-leg 축은 별도 line 렌더러가 없고 summaryLine 이 markdown 안에 내장돼 있어 2-블록이다.)

그러나 이 confluence 를 public 조립 레벨에서 cover 하는 smoke 가 부재다. `git grep` 확인: publish-assembly(T-0912)·publish-roundtrip(T-0913) smoke 는 descriptor 를 import 하지만 마크다운 렌더러를 **직접 import 하지 않고**(`renderRealDataDailyStepDualLegRunReportMarkdown` 참조 0) `descriptor.body` 를 쪼개 markdown 블록↔직접 렌더 결과 byte-identical 을 단언하지 않는다. 반대로 markdown-assembly(T-0914) smoke 는 렌더러를 import 하지만 descriptor 를 **import 하지 않아**(descriptor 참조 0) descriptor body 안 합류를 보지 못한다. 본 task 가 `buildRealDataDailyStepDualLegRunReport → buildRealDataDailyStepDualLegRunReportIssueDescriptor` 직접 2-컴포저 체인 smoke 로 그 confluence gap 을 public CI 그물로 박제해, dual-leg run report descriptor body 의 marker↔markdown 단일-source 합류를 종결한다(요약 축 T-0750 mirror).

issue-still-relevant 확인(2026-07-11): `git grep -l renderRealDataDailyStepDualLegRunReportMarkdown test/smoke/*` = markdown-assembly 1개(descriptor 미참조), `git grep -l buildRealDataDailyStepDualLegRunReportIssueDescriptor test/smoke/*` = publish-assembly·publish-roundtrip 2개(렌더러 미참조·body 미쪼갬) → descriptor body 블록 confluence 단언 부재 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (종단 descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor` — body 2-블록 합성 L141-145 `[marker, "", renderRealDataDailyStepDualLegRunReportMarkdown(report)].join("\n")`, 입력 `RealDataDailyStepDualLegRunReport`, 출력 `{ title; marker; body }`)
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (`buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` — 두 `RealDataDailyStepLegRunOutcome{leg,action,passed?,specPath?}` + `RealDataResultIssueRunRef{gitSha,dateToken}` → report. leg status 파생·overallStatus·summaryLine 규약 참조)
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` (`renderRealDataDailyStepDualLegRunReportMarkdown(report)` — markdown 블록 직접 비교용 렌더러)
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-markdown-assembly.smoke-spec.ts` (T-0914 — synthetic leg outcome literal 주입·non-gated·import 스타일 reference)
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts` (T-0912 — descriptor body 를 어디까지만 단언하는지 확인용, 본 task 가 채우는 gap 의 경계)
- `test/smoke/realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts` (T-0750 — 요약 축 3-블록 confluence smoke, 본 task 의 2-블록 mirror 원형)

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly.smoke-spec.ts` 1개만 추가. 모두 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / jest spawn / DB / 네트워크 0 복제), `process.env` 읽기 0, gating 0(non-gated 항상 실행, R-113). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12).

- [ ] **Happy-path**: `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 종단 조립 후 `descriptor.body` 가 string·non-empty 이고 `descriptor.marker` 라인을 정확히 1 회 포함(멱등 search-or-update 기반, 중복 0).
- [ ] **Confluence — markdown 블록 단일 source**: `descriptor.body` 를 줄/빈 줄로 쪼갰을 때 marker 라인 뒤 markdown 블록이 동일 report 의 직접 `renderRealDataDailyStepDualLegRunReportMarkdown(report)` 결과와 byte-identical(가공 0 합성·같은 report 단일 source thread).
- [ ] **블록 순서·구분 무결성**: body 가 `[marker, "", markdown].join("\n")` 구조 — marker 직후 빈 줄 1 개, 그 뒤 markdown(순서/구분자 회귀 가드). marker 는 body 최상단에 정확히 1 회.
- [ ] **단일 source 교차 단언**: 동일 `evalOutcome`·`collectOutcome`·`run` 으로 두 번 조립 시 `descriptor.body` 결정론 byte-identical, 그리고 report 를 한 번만 만들어 직접 렌더러에 통과시킨 markdown 과 descriptor body 내 markdown 블록이 일치(중간 report 단일 source).
- [ ] **Error path / negative — 충분 cover**(예외 분기마다 1+): (1) `run.gitSha` 빈/공백 throw 전파, (2) `run.dateToken` 빈/공백 throw 전파, (3) leg mislabel(evalOutcome.leg !== "eval" 또는 collectOutcome.leg !== "collect") throw 전파, (4) raw narrative / credential / specPath echo 류 누출 0(body 에 token/secret/실 specPath 어휘 미등장 단언, R-59 정합).
- [ ] **Flow / 분기**: overallStatus 분기(all-pass·some-fail·all-skip·partial) 를 각각 유발하는 leg status 조합에 대해 각각 confluence(markdown 블록 직접 렌더 일치) 성립.
- [ ] **결정론·무공유·no-mutation**: 동일 입력 반복 조립이 byte-identical, 조립이 입력 `evalOutcome`/`collectOutcome`/`run` 객체를 mutate 하지 않음(입력 deep-freeze 또는 before/after 스냅샷 비교).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green. 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — 신규 spec 자체가 기존 컴포저 line/function coverage 를 떨어뜨리지 않음을 `pnpm test:cov` 또는 smoke 격리 실행으로 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일).
- 새 컴포저·새 helper·새 type 신설 금지 — 기존 `buildRealDataDailyStepDualLegRunReport` / `buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `renderRealDataDailyStepDualLegRunReportMarkdown` import 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / 실 jest spawn / DB / 네트워크 호출 0 — synthetic literal 만.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).
- T-0914(markdown 고립)·T-0912/T-0913(publish 조립) 의 기존 단언 중복 복제 금지 — 본 task 는 descriptor body 안 **confluence**(marker↔markdown 합류·단일 source) 만 책임.
- title·marker identity 정합(별도 가드 영역)·command-args / search-argv / action resolver 후속 leg 는 본 task 범위 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

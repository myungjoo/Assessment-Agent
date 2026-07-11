---
id: T-0917
title: realdata-e2e dual-leg run report run-token(dateToken@gitSha) 단일 source cross-surface(descriptor.title·marker ↔ report.summaryLine ↔ markdown) 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-daily-step-dual-leg-run-report-run-identity-cross-surface-convergence-assembly.smoke-spec.ts]
independentStream: realdata-e2e-dual-leg-run-report-run-identity-cross-surface-convergence-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — run-identity cross-surface 수렴 sweep(happy·cross-surface 4-surface·run drift 분기·leg 독립·negative/결정론) test-dominated ~270 LOC. 요약 축 run-identity 수렴 선례 T-0766(300)·형제 descriptor 수렴 T-0915/T-0916(~300) 정당화. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 PLAN §109 실 평가 e2e step④ — dual-leg run report 의 run-token(dateToken@gitSha)이 descriptor.title·marker(식별/검색 표면)와 report.summaryLine(사람-표면)에 동일 단일 source 로 수렴함을 직접-체인 박제. T-0916(title↔marker)·T-0914(summaryLine→markdown) 이 각각 절반만 닫은 두 run-token 표면을 교차 봉합. 요약 축 T-0763/T-0768 run-identity 수렴 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0917 — realdata-e2e dual-leg run report run-token 단일 source cross-surface 수렴 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 박제)** 는 하나의 `run`(`RealDataResultIssueRunRef{gitSha, dateToken}`) 단일 source 로부터 **run 식별 토큰** `${run.dateToken}@${run.gitSha}` 를 파생해 **서로 다른 두 표면(surface)** 에 동시에 박는다:

1. **식별/검색 표면** — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` (T-0896) 의 `descriptor.title = ${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}` 와 `descriptor.marker = ${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->`. 이 run-token 은 **멱등 search-or-update 의 기반**(동일 run → 동일 marker → 같은 이슈 갱신)이다. T-0916 이 title↔marker 가 동일 run-token 을 공유함을 직접-체인으로 닫았다.
2. **사람-표면** — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` (T-0894) 산출 `report.summaryLine = [${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`. 이 한 줄 요약은 rolling 이슈 본문 상단·journal/log·CI stdout 에 노출되는 사람-친화 run 식별 라인이며, 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown(report)` (T-0895) 가 `- summary: ${summaryLine}` 로 본문에 내장한다. T-0914(markdown assembly) 가 summaryLine 이 markdown 본문에 byte-identical 전파됨을 닫았다.

그러나 이 **두 run-token 표면(식별/검색 표면 ↔ 사람-표면)이 같은 `run` 단일 source 로부터 동일 토큰으로 수렴**함을 직접-체인으로 묶은 non-gated build-time smoke 는 부재다. T-0916 은 title↔marker(식별 표면 내부)만, T-0914 는 summaryLine→markdown(사람 표면 내부)만 닫았을 뿐 — **descriptor.marker 의 run-token 과 report.summaryLine 의 run-token 이 동일 `${run.dateToken}@${run.gitSha}` 인지**·**두 표면이 run drift 에 대해 함께 이동하는지(어느 한 표면만 stale run-token 을 쥐지 않음)**·**run-token 순서(dateToken@gitSha, gitSha@dateToken 역전 아님)가 두 표면에서 일치하는지** 는 0 이다. `git grep` 확인(2026-07-11): `summaryLine` 을 참조하면서 동시에 `descriptor.marker`/`descriptor.title` 을 대조하는 smoke 파일 0 — identity 수렴 smoke(T-0916)는 summaryLine 미접촉, markdown assembly smoke(T-0914)는 descriptor.marker/title 미접촉.

즉 run-token drift(marker 는 올바른 토큰을 담는데 summaryLine 은 gitSha@dateToken 역전·다른 파생으로 어긋남)·표면-분열(사람이 이슈 본문 상단 summary 라인에서 본 run 과 검색 marker 가 가리키는 run 이 달라 재실행 상관(correlation) 실패)·부분-thread(한 표면만 run 변경 반영, 다른 표면은 stale) 회귀는 public CI 에서 직접 발화되지 않고, 컴포저/descriptor unit 또는 step④ live gh-gated runner set-up 시에만 잡힌다. 본 task 는 요약 축 run-identity cross-boundary 수렴(T-0763/T-0768)과 동형으로, `run → report → {descriptor, markdown}` 종단 조립에서 **run-token 이 식별/검색 표면과 사람-표면 양쪽에 동일 단일 source 로 수렴**함을 public CI 그물로 박제해, dual-leg run report 의 두 run-token 표면을 교차-봉합한다. 이는 **멱등 search-or-update**(REQ-009 — 같은 run 이 항상 동일 marker 로 단일 이슈 매칭)와 **결과 리포트 재실행 정합**(REQ-037 — 같은 run 이 동일 토큰으로 외화)을 cross-surface 로 보호하는 마지막 그물이다.

issue-still-relevant 확인(2026-07-11): `git grep -l summaryLine test/smoke/*dual-leg-run-report*` = body-confluence(T-0915)·markdown-assembly(T-0914) 2파일뿐 — 둘 다 descriptor.marker↔summaryLine run-token 대조 0. identity 수렴 smoke(T-0916)에 `summaryLine` 미등장 확인. → 두 run-token 표면 cross-surface 수렴 단언 부재 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → `RealDataDailyStepDualLegRunReport`(`{gitSha, dateToken, eval, collect, overallStatus, summaryLine}`). `summaryLine = [${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`(run-token 을 `[...]` 로 감싼 사람-표면 라인)·gitSha/dateToken 빈/공백 throw guard·입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}. 동일 run + 서로 다른 leg outcome literal 구성용
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `{title, marker, body}`. `runToken(report) = ${dateToken}@${gitSha}` 단일 source·`title = ${ISSUE_TITLE_PREFIX} ${token}`·`marker = ${ISSUE_MARKER_PREFIX} ${token} -->`. **ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 하드코딩이 아니라 **구조적 단언**(title·marker·summaryLine 이 모두 `${run.dateToken}@${run.gitSha}` substring 포함·표면 간 동일 token)으로 박제할 것
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` — 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown(report)`. `- git sha: ${gitSha}`·`- date token: ${dateToken}`·`- summary: ${summaryLine}` 라인 산출. markdown 본문에 run-token 이 summaryLine 경유로 전파됨 대조용
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-identity-confluence-assembly.smoke-spec.ts` — 식별 표면 내부(title↔marker) 수렴 sibling(T-0916). non-gated describe·synthetic leg outcome literal·validRun fixture·title.split(token)/marker.split(token) 구조적 단언·run 별 멱등/분리 패턴의 mirror 템플릿(본 task 는 여기에 summaryLine·markdown 표면을 교차 합류)
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-markdown-assembly.smoke-spec.ts` — 사람 표면 내부(summaryLine→markdown) sibling(T-0914). `- summary: ${report.summaryLine}` 전파·run drift·leg outcome 분기 패턴 참고
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-run-identity-cross-surface-convergence-assembly.smoke-spec.ts` 1개만 추가. 모두 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / jest spawn / DB / 네트워크 0 복제), `process.env` 읽기 0, gating 0(non-gated 항상 실행, R-113). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). run-token 은 literal prefix 하드코딩이 아니라 `${run.dateToken}@${run.gitSha}` 를 계산해 각 표면에서 `toContain`/`split` 으로 구조적으로 검증.

- [ ] **Happy-path test** — synthetic eval/collect leg outcome literal + 유효 `run`(`{gitSha, dateToken}` non-blank) → `buildRealDataDailyStepDualLegRunReport(...)` → `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` + `renderRealDataDailyStepDualLegRunReportMarkdown(report)` 종단 chain 을 한 번에 실행. `token = ${run.dateToken}@${run.gitSha}` 로 두고 (a) `descriptor.title`·`descriptor.marker`·`report.summaryLine` 이 모두 `token` 을 `toContain` 1+ test. (b) 세 표면이 **동일** `token` substring 을 공유(각 표면에서 `.split(token)` 결과 length 2 — token 이 정확히 1 회 등장) 1+ test.
- [ ] **cross-surface 단일 source 수렴 단언 (핵심)** — 동일 `run` 으로 식별 표면(`descriptor.marker`)의 run-token 과 사람 표면(`report.summaryLine`)의 run-token 이 **같은 단일 source `${run.dateToken}@${run.gitSha}` 로 수렴**함을 직접 대조: `descriptor.marker.split(token)` 와 `report.summaryLine.split(token)` 이 각각 token 을 정확히 1 회 담고, 두 표면에서 추출한 token 이 byte-identical(`===`) + 둘 다 `${run.dateToken}@${run.gitSha}` 와 일치 1+ test. `descriptor.title` 도 동일 token 을 담아 3-표면(title·marker·summaryLine) 수렴 1+ test.
- [ ] **run-token 순서 정합 단언** — 세 표면 모두에서 run-token 이 `dateToken@gitSha` 순서(gitSha@dateToken 역전 아님)임을 검증: `token.indexOf(run.dateToken) < token.indexOf(run.gitSha)` + 각 표면이 `${run.dateToken}@${run.gitSha}` 를 담고 `${run.gitSha}@${run.dateToken}`(역전) 은 담지 않음 1+ test. (gitSha·dateToken 이 서로 substring 이 아닌 구별 가능한 fixture 값으로 순서 오검출 회피.)
- [ ] **run drift 함께-이동 단언 (표면-분열 방지)** — (a) **다른 gitSha**(dateToken 동일) → 두 표면(marker·summaryLine)의 run-token 이 **함께** 새 `${dateToken}@${newGitSha}` 로 이동(어느 한 표면도 stale token 미보유) 1+ test. (b) **다른 dateToken**(gitSha 동일) → 두 표면이 함께 새 토큰으로 이동 1+ test. (c) 서로 다른 run 두 개의 descriptor.marker 와 summaryLine 를 교차 비교 — run A 의 marker run-token ≠ run B 의 summaryLine run-token(다른 run 의 표면이 섞이지 않음, 분리 보장) 1+ test.
- [ ] **leg outcome-독립성 vs 의존성 분리 단언** — 동일 run + 서로 다른 leg outcome 조합(예: eval pass/collect pass vs eval fail/collect skip): (a) `descriptor.title`·`descriptor.marker` 는 **동일**(식별 표면은 run 만의 함수, leg 무관 — T-0916 재확인 최소화) 1+ test. (b) `report.summaryLine` 은 **run-token 부분은 동일하나 eval=/collect=/overallStatus 부분은 달라짐**(사람 표면은 run-token + leg outcome 합성) — summaryLine 의 `token` substring 은 두 조합에서 동일하되 전체 문자열은 다름 1+ test. (identity 표면과 사람 표면의 leg 의존 분리를 cross-surface 로 박제.)
- [ ] **Error/negative path test** — (a) `run.gitSha` 빈 문자열/공백-only → 조립 경로에서 gitSha guard throw 전파(자체 try/catch 없이 `expect(() => assembleViaChain(...)).toThrow`) 1+ test. (b) `run.dateToken` 빈 문자열/공백-only → dateToken guard throw 전파(gitSha 유효해도 — 필드별 분기) 1+ test. (c) 두 guard 가 **각 필드 독립 분기**임을 별개 test 로 분리(단일 negative 금지).
- [ ] **Flow / branch coverage** — (a) raw 누출 0: synthetic leg outcome `specPath` 에 sentinel 문자열을 넣고 `descriptor.title`·`descriptor.marker`·`report.summaryLine` 어디에도 sentinel 미등장(run-token 표면들은 run 식별자 + status 파생만, specPath/narrative 무관 — R-59/REQ-059 정합) 1+ test. (b) overallStatus 각 분기(all-pass·some-fail·all-skip·partial) 를 유발하는 leg status 조합에 대해 동일 run 이면 세 표면의 run-token 불변(overallStatus 변화가 run-token 을 흔들지 않음) 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) gitSha 빈/공백 throw, (b) dateToken 빈/공백 throw, (c) 서로 다른 run → 표면 교차 시 run-token 불일치(분리), (d) run-token 순서 역전 미발생, (e) raw specPath 누출 0(sentinel 미등장), (f) **결정론·무공유**: 동일 (leg outcomes, run) 두 번 chain 호출 시 descriptor.title·marker·summaryLine byte-identical + 매 호출 새 report/descriptor 객체(반환 참조 비동일), (g) **no-mutation**: 입력 eval/collect outcome·run 객체가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0(synthetic leg outcome literal + run literal 직접 주입).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green. 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — 신규 spec 이 기존 컴포저/descriptor/렌더러 line/function coverage 를 떨어뜨리지 않음을 `pnpm test:cov` 또는 smoke 격리 실행으로 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일).
- 기존 descriptor-identity(T-0916, title↔marker 내부)·markdown-assembly(T-0914, summaryLine→markdown 내부)·body-confluence(T-0915, descriptor.body 2-블록)의 재검증 — 본 task 는 **식별 표면 ↔ 사람 표면의 run-token cross-surface 수렴**만 책임(각 표면 내부 정합은 이미 닫힘, 중복 단언 0).
- 새 컴포저·새 helper·새 type 신설 금지 — 기존 `buildRealDataDailyStepDualLegRunReport` / `buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `renderRealDataDailyStepDualLegRunReportMarkdown` import 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).
- `ISSUE_TITLE_PREFIX` / `ISSUE_MARKER_PREFIX` / `summaryLine` prefix 를 export 로 바꾸거나 import 해 literal 비교 — private/내부 유지, smoke 는 구조적(run-token substring split) 단언만.
- command-args(T-0897)·search-argv(T-0900)·action-resolver(T-0898)·output-parse(T-0903) 경유 marker 전파(pre/post-execution 검색 chain)는 이미 publish-assembly(T-0912)·round-trip(T-0913) 이 커버 — 본 task 는 descriptor·summaryLine 두 표면의 run-token 수렴만 책임(중복 0).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

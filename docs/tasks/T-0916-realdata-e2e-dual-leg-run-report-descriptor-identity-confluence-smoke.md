---
id: T-0916
title: realdata-e2e dual-leg run report descriptor title·marker run-token identity-confluence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 810
mergedAs: 9aa4fd1b
completedAt: 2026-07-11T09:45:00Z
coversReq: [REQ-109]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-identity-confluence-assembly.smoke-spec.ts]
independentStream: realdata-e2e-daily-step-dual-leg-run-report-descriptor-identity-confluence-assembly-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — 형제 body-side smoke T-0915·요약 축 identity-side T-0751(240 LOC) test-dominated 선례. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 PLAN §109 실 평가 e2e — dual-leg run report descriptor title·marker run-token identity-side confluence smoke. 요약 축 T-0751 mirror(2-블록 body-side T-0915 의 짝). dependsOn [] file-disjoint stage5b 병렬.
---

# T-0916 — realdata-e2e dual-leg run report descriptor title·marker run-token identity-confluence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step ④(daily-test dual-leg run 결과 rolling-issue 박제)** 종단 descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` (T-0896) 는 `RealDataDailyStepDualLegRunReport`(gitSha·dateToken·per-leg {action,status}·overallStatus·summaryLine 보유) 를 받아 `{title, marker, body}` 3 필드를 합성한다. 이 descriptor 는 **두 개의 독립 confluence 축**을 가진다:

1. **body-side confluence** — `body = [marker, "", renderRealDataDailyStepDualLegRunReportMarkdown(report)].join("\n")`. 이 marker↔markdown 2-블록 합류는 **T-0915** 가 직접-체인 smoke 로 박제 완결했다(marker 라인↔직접 렌더 markdown 블록 byte-identical·블록 순서/구분 무결성).
2. **identity-side confluence** — `title = ${ISSUE_TITLE_PREFIX} ${token}` 와 `marker = ${ISSUE_MARKER_PREFIX} ${token} -->` 가 **동일한 `runToken(report) = ${report.dateToken}@${report.gitSha}` 단일 source** 로부터 서로 다른 고정 prefix 로 합성된다. title 과 marker 는 **leg outcome 무관**(동일 run 식별자 + 다른 eval/collect outcome → 동일 title·marker, body 만 변함) 이며, 멱등 search-or-update 의 기반(동일 run → 동일 marker → 같은 이슈 갱신, 서로 다른 run → 다른 marker → 다른 이슈)이다.

그러나 이 **identity-side(title·marker 공유 run-token) confluence 를 직접-체인으로 묶은 non-gated build-time smoke 는 부재**다. T-0915 의 confluence smoke 는 `descriptor.body` 의 2-블록(marker 라인 포함)만 검증할 뿐, **title 과 marker 가 같은 `dateToken@gitSha` 토큰을 공유**한다는 단언·**title·marker 의 leg outcome-독립성**·**run-identifier 단일 source threading(서로 다른 run → 서로 다른 title·marker, 동일 run → 동일)** 은 0 이다. `git grep` 확인(2026-07-11): `descriptor.title.*toContain` / `runToken` / title↔marker run-token threading 단언이 `test/smoke/*dual-leg*` 에 부재 — T-0915 happy-path 도 title 미접촉, publish-assembly(T-0912)·publish-roundtrip(T-0913) smoke 는 title/marker non-empty 만 단언.

즉 run-token drift(title 은 token 을 담는데 marker 는 다른 token·prefix 변형으로 둘이 어긋남)·leg-누출(title·marker 가 leg outcome 에 의존해 멱등 marker 가 흔들림)·run 분리 실패(서로 다른 run 인데 동일 marker 산출 → 다른 run 의 이슈를 잘못 갱신)·동일-run 멱등 실패(동일 run 인데 호출마다 다른 marker) 회귀는 public CI 에서 직접 발화되지 않고, descriptor 컴포저 unit 또는 step ④ live gh-gated search-or-update runner set-up 시에만 잡힌다. 본 task 는 body-side(T-0915) 와 대칭인 **identity-side 직접-체인 smoke**(요약 축 T-0751 mirror) 로 `buildRealDataDailyStepDualLegRunReport → buildRealDataDailyStepDualLegRunReportIssueDescriptor` 종단 조립에서 **title·marker 가 동일 run-token 단일 source 로부터 합류**하고 **leg outcome 무관·run 별 멱등**임을 public CI 그물로 박제해, descriptor 의 두 confluence 축(body·identity)을 모두 직접-체인으로 닫는다.

issue-still-relevant 확인(2026-07-11): `git grep -l "\.title" test/smoke/*dual-leg-run-report*` = title 을 toContain/split 로 검증하는 dual-leg smoke 0, `git grep -l runToken test/smoke/*` = 요약 축(T-0751) 만 → dual-leg descriptor identity-side 단언 부재 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — 종단 descriptor 컴포저 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `{title, marker, body}`. `runToken(report) = ${dateToken}@${gitSha}` 단일 source(L98-100)·`title = ${ISSUE_TITLE_PREFIX} ${token}`(L134)·`marker = ${ISSUE_MARKER_PREFIX} ${token} -->`(L137)·gitSha/dateToken 빈/공백 throw guard(L105-111,130-131). **ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 가 아니라 **구조적 단언**(둘 다 `dateToken@gitSha` 토큰 포함·서로 다른 prefix·leg outcome-독립)으로 박제할 것
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` — 두 `RealDataDailyStepLegRunOutcome{leg,action,passed?,specPath?}` + `RealDataResultIssueRunRef{gitSha,dateToken}` → report. title·marker 가 leg outcome 무영향임을 보이려면 **동일 run + 서로 다른 leg outcome 조합**이 필요하므로 다른 eval/collect outcome literal 구성용
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly.smoke-spec.ts` — body-side 대칭 sibling smoke(T-0915). non-gated describe·synthetic leg outcome literal·validRun fixture·flow·결정론·무공유·no-mutation·run 결손 guard 전파·raw 누출 0 패턴의 mirror 템플릿
- `test/smoke/realdata-e2e-summary-descriptor-identity-confluence-assembly.smoke-spec.ts` — 요약 축 identity-side smoke(T-0751), 본 task 의 dual-leg mirror 원형(title.split(token)/marker.split(token) 구조적 단언·summary-독립성·run 별 멱등/분리 패턴 참조)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-identity-confluence-assembly.smoke-spec.ts` 1개만 추가. 모두 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / jest spawn / DB / 네트워크 0 복제), `process.env` 읽기 0, gating 0(non-gated 항상 실행, R-113). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12).

- [ ] **Happy-path test** — synthetic eval/collect leg outcome literal + 유효 `run`(`{gitSha, dateToken}` non-blank) → `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 종단 chain 을 한 번에 실행. (a) `descriptor.title`·`descriptor.marker` 가 string·non-empty 이고 둘 다 합성 run-token `${run.dateToken}@${run.gitSha}` 를 `toContain` 1+ test. (b) `descriptor.title !== descriptor.marker`(서로 다른 prefix·서로 다른 문자열)이면서 동일 token 공유(공유 substring `${run.dateToken}@${run.gitSha}` 가 양쪽에 등장) 1+ test. (c) `descriptor.marker` 가 `descriptor.body` 첫 줄로 정확히 1 회 등장(identity↔body 정합, run-token 정합 확인) 1+ test.
- [ ] **identity-confluence 단일 source 단언** — 동일 `run` 으로 title·marker 가 **`runToken` 단일 source 로부터 합류**: title 에서 공유 token 을 잘라낸 나머지(고정 title prefix)와 marker 에서 공유 token 을 잘라낸 나머지(고정 marker prefix·`-->` suffix)가 호출 간 불변(결정론적 고정 prefix) + 양쪽이 동일 `${run.dateToken}@${run.gitSha}` substring 을 thread 함을 단언 1+ test. (literal prefix 하드코딩 대신 `title.split(token)` / `marker.split(token)` 으로 token 경계를 구조적으로 검증.)
- [ ] **leg outcome-독립성 단언 (핵심)** — **동일 run + 서로 다른 leg outcome 조합**(예: eval pass/collect pass vs eval fail/collect skip → overallStatus·body 달라짐): 두 descriptor 의 `.title` === 동일, `.marker` === 동일(title·marker 는 leg outcome 무관·run 만의 함수) 1+ test. 같은 두 조립의 `.body` 는 **달라야** 함(leg outcome 은 body 에 반영 — title/marker 와 body 의 의존 분리 단언) 1+ test.
- [ ] **run-별 멱등·분리 단언** — (a) **동일 run 두 번**(leg outcome 무관) → `.title`·`.marker` byte-identical(멱등 search-or-update 토큰 안정) 1+ test. (b) **서로 다른 run**(다른 gitSha 또는 다른 dateToken) → `.title`·`.marker` 서로 다름(다른 run 의 이슈를 잘못 갱신하지 않음 — 분리 보장) 1+ test. gitSha 만 다른 경우·dateToken 만 다른 경우 분기마다 분리.
- [ ] **Error/negative path test** — (a) `run.gitSha` 빈 문자열/공백-only → 조립 경로에서 gitSha guard throw 전파(자체 try/catch 없이 `expect(() => assembleViaChain(...)).toThrow`) 1+ test. (b) `run.dateToken` 빈 문자열/공백-only → dateToken guard throw 전파(gitSha 유효해도 — 필드별 분기) 1+ test. (c) 두 guard 가 **각 필드 독립 분기**임을 별개 test 로 분리(단일 negative 금지).
- [ ] **Flow / branch coverage** — (a) raw 누출 0: synthetic leg outcome `specPath` 에 sentinel 문자열을 넣고 `descriptor.title`·`descriptor.marker` 에 sentinel 미등장(title·marker 는 run-token 만, specPath/narrative 무관 — R-59/REQ-059 정합) 1+ test. (b) overallStatus 각 분기(all-pass·some-fail·all-skip·partial) 를 유발하는 leg status 조합에 대해 동일 run 이면 title·marker 불변(overallStatus 무관) 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) gitSha 빈/공백 throw, (b) dateToken 빈/공백 throw, (c) 서로 다른 run → 서로 다른 marker(분리), (d) leg-누출 0(동일 run·다른 leg outcome → 동일 title·marker), (e) raw specPath 누출 0(sentinel 미등장), (f) **결정론·무공유**: 동일 (leg outcomes, run) 두 번 chain 호출 시 title·marker byte-identical + 매 호출 새 descriptor 객체(반환 참조 비동일), (g) **no-mutation**: 입력 eval/collect outcome·run 객체가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0(synthetic leg outcome literal + run literal 직접 주입).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green. 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — 신규 spec 이 기존 컴포저 line/function coverage 를 떨어뜨리지 않음을 `pnpm test:cov` 또는 smoke 격리 실행으로 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일).
- 기존 `realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly.smoke-spec.ts`(T-0915, descriptor.body 2-블록 confluence) 의 재검증 — 본 task 는 descriptor 의 **title·marker identity-side(run-token confluence)** 만 책임(body-side 와 별개 절단면, body 블록 byte-identical 단언 중복 0).
- 새 컴포저·새 helper·새 type 신설 금지 — 기존 `buildRealDataDailyStepDualLegRunReport` / `buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `renderRealDataDailyStepDualLegRunReportMarkdown` import 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).
- `ISSUE_TITLE_PREFIX` / `ISSUE_MARKER_PREFIX` 를 export 로 바꾸거나 import 해 literal 비교 — private const 유지, smoke 는 구조적(token 경계 split) 단언만.
- publish-assembly(T-0912)·publish-roundtrip(T-0913)·markdown-assembly(T-0914) 의 기존 단언 중복 복제 금지 — 본 task 는 descriptor 의 title·marker run-token threading 만 책임.
- command-args / search-argv / action resolver 후속 leg·title↔marker 외 identity 정합은 본 task 범위 밖.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

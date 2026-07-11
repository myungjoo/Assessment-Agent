---
id: T-0914
title: realdata-e2e dual-leg run report → markdown 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-07-11T09:05:00Z
mergedAs: 1565828f
prNumber: 808
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-markdown-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-markdown-assembly-smoke
sizeExempt: true
exemptReason: test-only smoke spec — happy/error/branch(create·update leg 표기·overallStatus 분기)/negative/결정론/무공유/no-mutation cover 로 test-dominated 230 LOC 예상. sibling markdown assembly smoke(summary 축 T-0748 230 LOC)+dual-leg 축 test-dominated 선례(T-0910 +610 spec·T-0912 +357·T-0913). production LOC 0.
plannerNote: P5 §109 step④ — publish round-trip(T-0912/T-0913) 종결 후 markdown 렌더러(T-0895) 가 어떤 smoke 도 미참조인 gap. summary 축 T-0748(summary→markdown assembly) mirror. test-only pr, dep0 file-disjoint stage5b 병렬.
---

# T-0914 — realdata-e2e dual-leg run report → markdown 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 dual-leg run report 이슈 publish 축은 **박제-전 forward 조립**(T-0912) 과 **박제-후 output-parse round-trip**(T-0913) 두 절단면을 non-gated smoke 로 닫았다. 그러나 그 report 를 **rolling-issue 본문용 결정론적 마크다운 문자열**로 렌더하는 표현 layer — `renderRealDataDailyStepDualLegRunReportMarkdown(report)` (T-0895) — 은 컴포저 unit spec(`...run-report-markdown.spec.ts`) 만 가질 뿐 **어떤 조립 smoke 에도 참조되지 않는다** (`git grep renderRealDataDailyStepDualLegRunReportMarkdown test/smoke/` = NONE).

이는 summary 축의 정확한 비대칭이다 — summary 축은 descriptor(T-0580)→마크다운 렌더러(T-0581) 의 종단 조립 chain 을 T-0748(`buildRealDataResultSummary`→`renderRealDataResultSummaryMarkdown`) 로 non-gated smoke 에 박제해 사람이 읽는 결과 요약 본문 렌더 side 를 닫았다. dual-leg run report 축은 두 leg run outcome 을 report descriptor 로 묶는 종단 컴포저(T-0894)와 그 descriptor 를 마크다운으로 렌더하는 표현 layer(T-0895)를 모두 갖췄으나, **둘을 직접 chain 으로 묶어 마크다운 골격·per-leg 표기·overallStatus·summaryLine 보간·집계↔렌더 정합을 단언하는 조립 smoke 는 부재**다.

즉 report 골격 drift(고정 헤더 리터럴·run 식별자 슬롯·per-leg 행 순서 eval→collect·overallStatus/summaryLine 토큰 보간)·per-leg action/status 조합 분기(pass/fail/skip × create/update)·overallStatus 분기(all-pass/일부-fail 등)·집계↔렌더 정합(동일 (evalOutcome, collectOutcome, run) → report → markdown 의 값이 byte-identical 전파)·결정론(동일 입력 → byte-identical markdown)·raw 누출 0(R-59/REQ-059) 분기는 public CI 에서 직접 발화되지 않고 step④ live gh-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — publish forward(T-0912)·round-trip(T-0913) 절단면과 직교하는 **마크다운-본문 렌더 side 직접-체인 smoke** 로, (evalOutcome, collectOutcome, run) → `buildRealDataDailyStepDualLegRunReport` → `renderRealDataDailyStepDualLegRunReportMarkdown` 종단 조립 surface 회귀를 public CI 그물로 박제해 dual-leg run report 의 표현 출력 경로(마크다운 본문)를 직접-체인으로 닫는다. 실 gh 실행·네트워크·DB·LLM 0(synthetic outcome/run literal 주입). 결과 이슈 본문 렌더(REQ-037 평가 결과 산출·REQ-059 raw 미저장)의 표현 layer 회귀를 CI 단계에서 잡는다.

## Required Reading

- `docs/tasks/T-0914-realdata-e2e-dual-leg-run-report-markdown-assembly-smoke.md` (본 파일)
- `docs/tasks/T-0748-realdata-e2e-result-summary-markdown-assembly-smoke.md` — summary 축 markdown assembly mirror 선례(non-gated·synthetic literal 직접 주입·deep-string toBe 단언·집계↔렌더 정합·결정론·무공유·no-mutation·raw 누출 0 패턴). 본 task 는 이 구조를 dual-leg run report 축으로 옮긴다(단 dual-leg 축은 EvaluationResult[] 집계 대신 두 leg outcome + run 진입).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 위임 (1) 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` (L158) → `RealDataDailyStepDualLegRunReport`(`{gitSha, dateToken, eval:{action,status}, collect:{action,status}, overallStatus, summaryLine}`, L78). `RealDataDailyStepLegRunOutcome`(L48)·`RealDataDailyStepLegStatus`(`"pass"|"fail"|"skip"`, L57)·`RealDataDailyStepDualLegOverallStatus`(L64) type 정의도 여기. run 식별자(gitSha/dateToken) 빈/공백 guard·leg label guard 규칙 참고.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts` — 위임 (2) `renderRealDataDailyStepDualLegRunReportMarkdown(report)` → 결정론 마크다운 문자열. 고정 헤더(`## 실 평가 e2e daily-step dual-leg run report`)·`- git sha: <gitSha>`·`- date token: <dateToken>`·per-leg 표(eval→collect 고정 행 순서 {action,status})·`- overall status: <overallStatus>`·`- summary: <summaryLine>` 골격. gitSha/dateToken/summaryLine 빈/공백 재확인 throw·report 비변형·byte-identical 반환 규칙.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef`(`{gitSha, dateToken}`) type 정의. 컴포저의 `run` 인자 synthetic literal 구성용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts` (T-0912) — 헤더 주석·describe 구조·synthetic outcome/run 입력 빌더·import 경로 규약 mirror 템플릿(본 task 는 마크다운-본문 렌더 절단면, forward publish 와 직교).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 수집·실행 규약(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts`).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-markdown-assembly.smoke-spec.ts` **1 개** 만 추가한다. `describe.skip`/gating 없이 항상 실행되는 일반 `describe` 로 작성한다(public CI 기본 green 경로 발화). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·DB 0·gh 실행 0·마크다운-본문 렌더 조립 절단면·forward publish T-0912 와 직교) 작성.

- [ ] **Happy-path test 1+**: 유효 두 leg outcome(각 `{action, status}`) + 유효 run(`{gitSha, dateToken}`) synthetic literal 로 `buildRealDataDailyStepDualLegRunReport` → `renderRealDataDailyStepDualLegRunReportMarkdown` 종단 chain 을 한 번에 실행. (a) 산출 markdown 이 고정 헤더(`## 실 평가 e2e daily-step dual-leg run report`)·`- git sha: <gitSha>`·`- date token: <dateToken>`·per-leg 표기(eval→collect 순서)·`- overall status: <overallStatus>`·`- summary: <summaryLine>` 골격을 보유 1+ test. (b) markdown 이 expected literal(gitSha/dateToken/각 leg action·status/overallStatus/summaryLine 이 report 값 그대로 보간)과 정확히 일치(`toBe` deep string) 1+ test.
- [ ] **집계↔렌더 정합 단언 1+**: 동일 입력에 대해 직접 chain 산출 markdown 이 `renderRealDataDailyStepDualLegRunReportMarkdown(buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run))` 와 `toBe` 동일(중간 report 단일 source 전파·재합성 없이 위임 산출만 옮김) 1+ test. markdown 의 `- git sha`·`- date token`·`- overall status`·`- summary` 토큰이 중간 report 의 gitSha/dateToken/overallStatus/summaryLine 과 정합(컴포저 산출↔렌더 토큰 정합) 1+ test.
- [ ] **분기 cover 각 1+ test**: (i) **per-leg status 조합** — eval=pass·collect=pass / eval=pass·collect=fail / eval=skip·collect=pass 등 서로 다른 status 조합이 per-leg 표에 정확히 보간되고 그에 따라 overallStatus 가 달라짐을 각 1+ test. (ii) **per-leg action 조합** — eval/collect 의 create vs update action 이 표기에 정확히 반영 1+ test. (iii) **overallStatus 분기** — all-pass vs 일부-fail(또는 skip 포함) 이 `- overall status` 토큰과 summaryLine 에 정확히 전파 각 1+ test. 분기마다 test 분리.
- [ ] **Error path test 1+**: (a) run.gitSha 또는 run.dateToken 이 빈/공백-only → `buildRealDataDailyStepDualLegRunReport` 진입 guard throw 를 자체 try/catch 없이 조립 경로로 전파(`expect(() => build(...)).toThrow`) 각 1+ test — report 미생성으로 markdown 렌더 미도달 단언. (b) mislabel 된 report(summaryLine 빈/공백)를 렌더러에 직접 넘기면 `renderRealDataDailyStepDualLegRunReportMarkdown` 재확인 guard throw 를 전파 1+ test.
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (i) gitSha 빈/공백 build throw, (ii) dateToken 빈/공백 build throw, (iii) summaryLine 빈/공백 render throw, (iv) 잘못된 leg label(eval 자리에 collect label 등, 컴포저 leg-label guard) throw, (v) 동일 (evalOutcome, collectOutcome, run) 2회 chain 시 산출 markdown deep-equal(문자열 동일) 이면서 중간 report 객체 참조 무공유(`not.toBe`) — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유·no-mutation test 1+**: 같은 입력으로 두 번 chain 조립한 두 markdown 문자열이 `toBe` 동일(결정론)이면서 중간 report 객체(및 하위 eval/collect 객체)가 매 호출 새 참조(`not.toBe`), 입력 evalOutcome/collectOutcome/run literal 이 조립 전후 mutate 0(deep-equal 검증)임을 확인.
- [ ] **raw 누출 0 test 1+**: 산출 markdown 에 token/secret/raw narrative 패턴 미포함(안정 식별 토큰·per-leg action/status enum·고정 골격 리터럴만, R-59/REQ-059 정합) 검증 — synthetic 입력에 sentinel 문자열을 넣고 markdown 에 미등장 단언.
- [ ] live-LLM·네트워크·DB·credential·gh 실행 사용 0 — 파일 내 fetch/gateway/Ollama/execFile/`gh` 실 실행/env-gating/`describe.skip`/`process.env` 읽기 배선 일절 없음(순수 build-time in-memory·synthetic literal 직접 주입). 신규 컴포저/가드/helper 신설 0(기존 import 재사용만 — value-consistency sweep 종결 T-0911).
- [ ] 신규 spec 의 `describe`/`it` 문자열은 한국어(§12).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green, gating 없이 발화). 전체 unit suite 무회귀(`pnpm test`).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- T-0912 forward publish 조립 smoke·T-0913 round-trip smoke 재검증·수정 0 — 본 task 는 마크다운-본문 렌더 절단면만(별개 파일, file-disjoint).
- 기존 dual-leg convergence smoke·descriptor/command-plan/output-parse 조립 smoke 파일은 건드리지 않는다(file-disjoint).
- 새 컴포저·consistency 가드·helper 신설 0(value-consistency 가드 sweep 은 T-0911 에서 종결). 본 task 는 기존 helper 를 조립·호출하는 smoke spec 추가만.
- 기존 dual-leg 축 컴포저/렌더러 소스(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts`) 수정 0 — read-only 검증 대상.
- 마크다운 외 포맷(plain text / HTML / JSON) 렌더 검증 / 실 gh issue 본문 박제 / `gh issue create`·`gh issue comment` 실행 (step④ live wiring — credential gate, 별도 slice).
- `src/`·`package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·schema.prisma 변경 0. 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

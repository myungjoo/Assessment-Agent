---
id: T-0913
title: realdata-e2e dual-leg run report 이슈 publish round-trip(박제-후 output-parse) 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-roundtrip.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-publish-roundtrip-smoke
sizeExempt: true
exemptReason: test-only smoke spec — happy/error/branch(create vs update)/negative/결정론 cover 로 test-dominated 230 LOC 예상. sibling round-trip smoke(summary 축 T-0747 275 LOC)+dual-leg 축 test-dominated 선례(T-0910 +610 spec·T-0912 +220 spec) 정당화. production LOC 0.
plannerNote: P5 §109 step④ — T-0912 forward publish assembly(박제-전) 종결 후 박제-후 output-parse leg round-trip smoke gap. summary 축 T-0742(forward)↔T-0747(post-exec) round-trip 대칭 mirror.
---

# T-0913 — realdata-e2e dual-leg run report 이슈 publish round-trip(박제-후 output-parse) 조립 체인 non-gated build-time smoke 신설

## Why

PLAN §109 "🟢 실 평가 e2e" 의 dual-leg run report 이슈 publish 축은 **박제-전(pre-execution) forward 조립 smoke** 가 T-0912 로 닫혔다 — `buildRealDataDailyStepDualLegRunReport`(두 leg outcome + run → report) → `...IssueDescriptor` → `...IssueCommandArgs` → `...IssueSearchGhArgv` + `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(search stdout + commandArgs → `{action, argv}`) 까지 build-time 조립·검증한다. 그러나 그 command-plan 이 실 `gh issue create` / `gh issue edit <n>` 을 실행한 뒤의 **박제-후(post-execution) stdout 해석 leg** — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)`(T-0903, → `RealDataDailyStepDualLegRunReportIssueOutcome` = `{issueNumber, url}`) — 은 컴포저 unit spec + self-wired consistency 가드(T-0904~T-0907)로는 닫혀 있으나 **어떤 조립 smoke 에도 참조되지 않는다**(`git grep parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput test/smoke/` = NONE).

이는 summary 축의 정확한 round-trip 비대칭이다 — summary 축은 forward leg(T-0742) 와 post-execution outcome leg(T-0747)을 둘 다 non-gated smoke 로 닫아 박제-전·박제-후 양 끝을 봉했다. 본 task 는 그 mirror 로, dual-leg run report 이슈 publish 의 **round-trip closure** 를 build-time 으로 박제한다: (1) report → descriptor → commandArgs → command-plan(create/update 분기 → `{action, argv}`) 로 "이슈 박제 전 명령" 을 합성하고, (2) 그 분기에 대응하는 synthetic `gh issue create` / `gh issue edit` stdout 을 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 로 해석해 `{issueNumber, url}` 을 산출한 뒤, (3) 두 끝의 issueNumber 정합(update 분기 → `action.issueNumber` == 파싱 issueNumber, create 분기 → stdout URL 의 양수 issueNumber)·url trim·github host·`/pull/` 오매칭 reject 를 조립 레벨에서 단언한다. 실 gh 실행·네트워크·DB·LLM 0(synthetic stdout literal 주입). 결과 이슈 publish round-trip(REQ-037 평가 결과 산출·REQ-059 raw 미저장)의 박제-후 해석 회귀를 CI 단계에서 잡는 그물이다.

## Required Reading

- `docs/tasks/T-0913-realdata-e2e-dual-leg-run-report-publish-roundtrip-smoke.md` (본 파일)
- `docs/tasks/T-0747-realdata-e2e-create-edit-output-outcome-report-assembly-smoke.md` — summary 축 박제-후 round-trip mirror 선례(non-gated·synthetic stdout literal·throw 전파·결정론·무공유·no-mutation·raw 누출 0 패턴). 본 task 는 이 구조를 dual-leg run report 축으로 옮긴다(단 dual-leg 축엔 outcome-report 하위 컴포저가 없어 parse leg + forward command-plan round-trip 로 재구성).
- `docs/tasks/T-0912-realdata-e2e-dual-leg-run-report-publish-assembly-smoke.md` — 박제-전 forward 조립 sibling. 본 task 는 그 forward chain 의 산출(`{action, argv}`)을 박제-후 output-parse 와 round-trip 로 잇는다(중복 재검증 아닌 별개 절단면 = 박제-후).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — forward 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`(L68) → `RealDataDailyStepDualLegRunReportIssueGhCommandPlan { action, argv }`(L43). 후보 0건(stdout `"[]"`/marker 미포함) → `action.create`, 1+건(marker 포함) → `action.update(최소 number)` 분기(L61~62).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` type — `{action:'create'} | {action:'update', issueNumber}`. update 분기 issueNumber 가 round-trip 정합 단언의 한 끝.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 박제-후 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)`(L126) → `RealDataDailyStepDualLegRunReportIssueOutcome { issueNumber, url }`(L84). `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`, 0/선행0/비정수 throw)·url trim 정규화·raw 미저장(R-59)·결정론·매 호출 새 객체(무공유).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` / `...issue-command-args.ts` / `...dual-leg-run-report.ts` — forward chain 진입(report→descriptor→commandArgs) helper. commandArgs·report·run·leg outcome 합성 입력 구성용(T-0912 Required Reading 과 동일 진입점 재사용).
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts` — 헤더 주석·describe 구조·synthetic 입력 빌더·import 경로 규약 mirror 템플릿(본 task 는 박제-후 round-trip 절단면).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 수집·실행 규약(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts`).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-roundtrip.smoke-spec.ts` **1 개** 만 추가한다. `describe.skip`/gating 없이 항상 실행되는 일반 `describe` 로 작성한다(public CI 기본 green 경로 발화). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·DB 0·gh 실행 0·박제-후 output-parse round-trip 조립 절단면·forward T-0912 와 직교) 작성.

- [ ] **Happy-path test 1+**: 유효 두 leg outcome + 유효 run 으로 report → descriptor → commandArgs 를 합성하고, marker 미포함 search stdout(`"[]"`)로 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 을 호출해 `action.create` + `gh issue create` argv 산출 → 그 create 를 흉내낸 synthetic stdout(유효 `https://github.com/<owner>/<repo>/issues/<n>`)을 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 로 파싱해 `{issueNumber, url}` 산출 → outcome 이 2필드 정확히 보유하고 issueNumber 가 stdout URL 의 양수 번호·url 이 trim 된 매칭 URL 임을 단언하는 test 1+.
- [ ] **분기 cover 2종 각 1+ test**: (i) **create 분기** — search stdout `"[]"` → `action.create` + argv 선두 토큰 `issue create`, create stdout 파싱 outcome 정합. (ii) **update 분기** — marker 를 포함한 1+ hit search stdout → `action.update(최소 number N)` + argv 선두 토큰 `issue edit`, 그 N 에 대응하는 synthetic `gh issue edit` stdout(`/issues/N`)을 파싱한 outcome.issueNumber === `action.issueNumber`(round-trip 정합) 단언.
- [ ] **Error path test 1+**: (a) create/edit stdout 에 issue URL 미발견(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로) → `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` throw 를 자체 try/catch 없이 조립 경로로 전파(`expect(() => parse(badStdout)).toThrow`) 각 케이스 1+ test. (b) issueNumber 비양수(`/issues/0`·선행 0·비정수) → parse throw 전파 1+ test. (c) forward 측 report 진입 guard(run.gitSha 또는 dateToken 빈/공백)로 report 합성이 throw 해 command-plan 미도달함을 단언하는 test 1+.
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (i) create stdout URL 미발견 throw, (ii) update stdout issueNumber 비양수 throw, (iii) update 분기에서 stdout 의 `/issues/M`(M≠action.issueNumber) 이면 round-trip 정합 단언이 불일치를 드러냄(의도적 mismatch fixture 로 `outcome.issueNumber !== action.issueNumber` 확인 = 회귀 감지 그물), (iv) 비-github 호스트/`/pull/` 오매칭 reject, (v) 동일 (report 입력, search stdout, create/edit stdout) 2회 round-trip 시 산출 deep-equal 이면서 참조 무공유 — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유·no-mutation test 1+**: 같은 입력으로 두 번 round-trip 조립한 두 결과(command-plan `{action, argv}` 및 output-parse `{issueNumber, url}`)가 deep-equal 이면서 최상위·중첩 객체(argv 배열 포함) 참조가 공유되지 않음(`not.toBe`), 입력 run/outcome/stdout literal 이 조립 전후 mutate 0 임을 검증.
- [ ] **raw 누출 0 test 1+**: 산출 outcome(issueNumber/url)·command-plan argv 에 token/secret/raw narrative 패턴 미포함(안정 식별 토큰만, R-59/REQ-059 정합) 검증.
- [ ] live-LLM·네트워크·DB·credential·gh 실행 사용 0 — 파일 내 fetch/gateway/Ollama/execFile/`gh` 실 실행/env-gating/`describe.skip`/`process.env` 읽기 배선 일절 없음(순수 build-time in-memory·synthetic stdout literal 주입). 신규 컴포저/가드/helper 신설 0(value-consistency sweep 종결 T-0911 — 기존 import 재사용만).
- [ ] 신규 spec 의 `describe`/`it` 문자열은 한국어(§12).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green, gating 없이 발화). 전체 unit suite 무회귀(`pnpm test`).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- T-0912 forward publish 조립 smoke(`test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts`) 재검증·수정 0 — 본 task 는 박제-후 output-parse round-trip 절단면만(별개 파일, file-disjoint).
- 기존 dual-leg convergence smoke(`realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts` 등 eval↔collect 수렴 축) 파일은 건드리지 않는다(file-disjoint).
- 새 컴포저·consistency 가드·helper 신설 0(value-consistency 가드 sweep 은 T-0911 에서 종결 — 추가 가드·self-wire 신설 금지). 본 task 는 기존 helper 를 조립·호출하는 smoke spec 추가만.
- 기존 dual-leg 축 컴포저/파서 소스(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts`) 수정 0 — read-only 검증 대상.
- 실 LLM round-trip·실 github 수집·실 `gh issue create`/`gh issue edit` 실행·`execFile('gh', argv)`·env-gated live 실행 leg(이는 §109 step④ daily-test bash 배선 후속 책임).
- `src/`·`package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·schema.prisma 변경 0. 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

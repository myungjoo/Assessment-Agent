---
id: T-0894
title: realdata-e2e daily-test eval↔collect 두 leg jest run outcome → dual-leg run report 순수 컴포저 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report.spec.ts
plannerNote: "P5 §109 step④ — daily-test 가 nightly 로 spawn 하는 eval leg + collect leg 두 jest run 의 outcome 을 하나의 rolling-issue 박제용 report 로 묶는 순수 컴포저 신설(두 leg command-plan 쌍 대칭·수렴 smoke 닫힌 후 결과-박제 측 gap). 기존 outcome-report(T-0590) 는 단일 issue-post 용·leg-agnostic — 두 leg run 결과를 한 이슈로 묶는 layer 부재. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0894 — realdata-e2e daily-test eval↔collect 두 leg jest run outcome → dual-leg run report 순수 컴포저 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg**(`step_eval` → `realdata-e2e-live.smoke-spec.ts`)와 **collect leg**(`step_collect` → `realdata-e2e-github-collection-live.smoke-spec.ts`)를 각 1 회 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

두 leg 를 "어떤 gating env 면 실행/skip 하고 어떤 argv 로 jest 를 spawn 하는가" 로 결정하는 **command-plan 측**은 두 leg 가 완전 대칭(컴포저 T-0611↔T-0887, bash T-0612↔T-0888, parity smoke T-0790↔T-0889, 가드 T-0693↔T-0890, self-wire T-0694↔T-0891, 조립 smoke T-0736↔T-0892)으로 닫혔고, 두 leg 의 수렴(공유 gating source·공유 config·spec-only 차이)까지 dual-leg convergence smoke(T-0893)로 박제됐다.

그러나 **두 leg 를 각각 실행한 뒤 나오는 run outcome(각 leg 의 jest spawn 이 run→pass / run→fail / skip 중 무엇이었는가)을 하나의 rolling-issue 박제용 report 로 묶는 layer 는 아직 부재**하다. 기존 결과-박제 측 컴포저:
- `buildRealDataResultIssueOutcomeReport`(T-0590) 는 **단일** `gh issue create/edit` 박제 결과(issueNumber/url) + run 식별자 → 사람-친화 리포트로, "이슈가 어디에 박제됐는가" 만 본다(leg 개념 없음).
- `buildRealDataResultSummary`/`renderRealDataResultSummaryMarkdown`(T-0580/T-0581) 는 **eval leg 의 `EvaluationResult[]`** 만 집계·렌더한다(collect leg 결과 미포함, leg-agnostic 하지 않고 eval-only).

즉 daily-test 가 한 nightly run 에서 **두 leg 를 모두 돌렸는데, 그 두 leg 의 run outcome(pass/fail/skip)을 한 이슈 본문으로 함께 박제할 순수 컴포저가 없다**. 향후 step④ live wiring(credential gate) 이 이슈 본문을 조립하려면 두 leg outcome 을 결정론적으로 묶는 build-time layer 가 선행돼야 한다. 본 task 는 그 gap 을 순수 함수로 메운다 — 두 leg 의 run outcome + run 식별자(gitSha/dateToken) → 결정론적 **dual-leg run report** descriptor(per-leg status + overall status + byte-identical summaryLine). 실 jest spawn / 실 gh 박제 / credential 은 일절 없이 build-time 완결(dependency-free, cloud cron 자율 실행 가능).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts`(T-0590) — 단일 outcome→report **컴포저 스타일 mirror 템플릿**. guard(`assertNonBlank`/`assertPositiveIssueNumber`)·결정론·무공유·입력 mutate 0·byte-identical summaryLine·순수 함수·dependency-free 서술 패턴을 그대로 차용(단, 본 task 는 두 leg 를 묶는다).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts`(T-0582) — `RealDataResultIssueRunRef {gitSha, dateToken}` 정의. 본 컴포저의 run 식별자 입력 type 을 **재사용**(중복 정의 0, `import type` 만).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts`(T-0611) + `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts`(T-0887) — 두 leg command-plan 컴포저. plan 의 `action: "run" | "skip"` 개념과 각 leg 가 가리키는 canonical spec 경로(eval=`test/smoke/realdata-e2e-live.smoke-spec.ts` / collect=`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`)를 확인해 leg 라벨·specPath 입력 형태의 근거로 삼는다(재구현/재호출 금지 — 개념 참조만).
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts`(T-0887 colocated spec) — colocated `.spec.ts` R-112 4 종(happy/skip/branch/negative) + 결정론·무공유·mutate 0·credential echo 0 단언 패턴을 그대로 차용.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`(순수 컴포저 + type) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.spec.ts`. production `src/`·기존 command-plan 컴포저·gating helper·result-issue helper 수정 0.
- [ ] **type/컨트랙트 신설** — leg run outcome 입력 type(예: `RealDataDailyStepLegRunOutcome { leg: "eval" | "collect"; action: "run" | "skip"; passed?: boolean; specPath?: string }`)와 산출 report type(예: `RealDataDailyStepDualLegRunReport { gitSha; dateToken; eval: { action; status: "pass" | "fail" | "skip" }; collect: { action; status: "pass" | "fail" | "skip" }; overallStatus: "all-pass" | "some-fail" | "all-skip" | "partial"; summaryLine: string }`)을 정의. `RealDataResultIssueRunRef` 는 T-0582 에서 `import type` 재사용(중복 정의 0). enum 토큰은 영어 유지(§12).
- [ ] **컴포저 신설** — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` 순수 함수. per-leg status 매핑(run+passed=true→"pass", run+passed=false→"fail", skip→"skip") + overallStatus 파생(둘 다 pass→"all-pass" / 하나라도 fail→"some-fail" / 둘 다 skip→"all-skip" / 그 외 혼합→"partial") + byte-identical summaryLine 합성.
- [ ] **Happy-path unit test 1+** — eval run+pass & collect run+pass 완전 입력 → overallStatus `"all-pass"`, per-leg status 정확, summaryLine 이 gitSha/dateToken/두 leg status 를 포함하고 동일 입력 재호출 시 byte-identical.
- [ ] **Error path unit test 1+** — 각 guard 별도 분기 test: (1) `run.gitSha` 빈/공백-only → throw, (2) `run.dateToken` 빈/공백-only → throw, (3) `evalOutcome.leg !== "eval"` 또는 `collectOutcome.leg !== "collect"`(leg 라벨 mislabel/cross-wiring) → throw, (4) `action === "run"` 인데 `passed === undefined`(불완전 run outcome) → throw, (5) `action === "skip"` 인데 `passed` 정의됨(모순 outcome) → throw. 조용한 통과 0(각 명시적 Error).
- [ ] **Flow / branch cover** — overallStatus 4 분기(`all-pass` / `some-fail` / `all-skip` / `partial`) 각 1+ test + per-leg status 3 분기(pass/fail/skip) 각 1+ test 로 분리. 각 guard 분기도 위 error path 로 각 1+.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) 두 leg 모두 skip → overallStatus `"all-skip"`, (b) eval run+fail & collect run+pass(혼합 실패) → `"some-fail"`, (c) eval run+pass & collect skip(혼합) → `"partial"`, (d) **credential echo 0**(§9) — 입력 outcome/run 에 token-like placeholder 값을 심어도 report/summaryLine 어디에도 등장하지 않음(정규식 단언 1+ — report 는 leg status·run 식별자만 보유), (e) **결정론·무공유** — 동일 입력 두 번 호출 시 deep-equal 산출 + 매 호출 새 report 객체(참조 비동일), (f) **입력 mutate 0** — `evalOutcome`/`collectOutcome`/`run` 이 호출 전후 deep-equal(읽기만) — 각 1+ test.
- [ ] **build-time 완결·dependency-free** — 실 jest spawn / 실 gh 박제 / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리(zod 등) 0. 순수 함수(내장 수동 검증만). `process.env` 읽기 0(입력 객체를 직접 주입).
- [ ] **새 외부 dependency 0** — `RealDataResultIssueRunRef` type 재사용 외 신규 import 없음(새 컴포저/가드/helper 신설은 본 파일 내부 type/함수 한정).
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 컴포저 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.spec.ts`(기존 command-plan 컴포저 spec 들과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 leg outcome 캡처 / 실 gh 이슈 박제 / credential wiring** — 본 task 는 (두 leg outcome, run) → report descriptor 순수 함수만. live wiring 은 credential gate 별도 slice.
- **eval leg 의 `EvaluationResult[]` 집계·마크다운 렌더(T-0580/T-0581)** — 본 report 는 leg 별 run status(pass/fail/skip)만 묶는다. 평가 narrative/정량 집계 본문은 미포함(REQ-059 raw 미저장 정합 — leg status·run 식별자만 보유).
- **단일 issue-post outcome-report(T-0590) / result-issue publish-plan(T-0595) / gh command-plan(T-0588) 수정** — 재구현/재호출 0. 본 task 는 두 leg run outcome 을 묶는 새 layer 신설만.
- **두 leg command-plan 컴포저(`realdata-e2e-daily-step-{eval,collect}-command-plan.ts`) / gating helper / consistency 가드 / 조립·수렴 smoke 수정** — 개념 참조만, import/호출 0.
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (단일 outcome-report 컴포저 선례(T-0590)와 command-plan 컴포저 spec 선례(T-0887)가 명확 — architect 생략. 두 leg run outcome + run 식별자를 결정론적 report 로 묶는 순수 함수 + colocated R-112 spec 를 신설.)

## Follow-ups

(없음 — 본 task 머지로 두 leg 의 run outcome 을 한 rolling-issue 박제용 report 로 묶는 build-time layer 가 닫힌다. 이후 P5 잔여 갭: 본 report 의 rolling-issue body 조립 실배선(step④ live wiring, credential gate) / daily-test bash 가 두 leg outcome 을 캡처해 본 컴포저로 넘기는 배선 재survey — 별도 슬라이스로 planner 가 큐잉.)

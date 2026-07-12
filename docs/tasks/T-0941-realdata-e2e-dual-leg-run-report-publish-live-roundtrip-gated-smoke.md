---
id: T-0941
title: realdata-e2e dual-leg run report 의 rolling-issue publish 를 **실 `gh` 실행-후(execute-side)** 로 1 회 round-trip 하는 env-gated skip-by-default live smoke 신설 — 지금까지 35 개 assembly smoke 가 순수 in-memory 로만 검증한 command-plan(search→create/edit argv)을 처음으로 실 `gh issue list/create/edit` 에 도달시켜 outcome 파서(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`)가 **실 gh stdout** 을 round-trip 하고, 같은 run 을 두 번 publish 할 때 1차 create·2차 edit 로 멱등하게 같은 rolling-issue(번호/url byte-identical)로 수렴함을 실증. gating env 부재(=public CI 기본) 시 `describe.skip` → 실 네트워크 0 / mutation 0 / secret 0 으로 green(R-113) — eval-live(T-0610)·collection-live(T-0806) 이 그 wiring(step_eval/step_collect) 보다 먼저 dormant 로 shipped 된 것과 동형. step④ live wiring(step_report 를 deploy/daily-test.sh 에 배선 + credential 주입)은 ADR-0045 credential gate deferred 로 본 task 밖(Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-live.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-publish-live-roundtrip-smoke
sizeExempt: true
exemptReason: test-only env-gated live smoke 1파일 — dormant skip-by-default(gating env 부재 시 describe.skip, CI 에서 실행 0 test·mutation 0·secret 0). production LOC 0, coverageThreshold 회귀 0. gating 활성(ops nightly) 시에만 실 gh 1 round-trip(search→create/edit) + output-parse round-trip + 멱등(2차 edit 수렴) 실증. collection-live(T-0806) 구조 mirror ~260 LOC.
plannerNote: P5 §109 step④ — cross-publish 5-medium 안정 quintet(T-0938/22/37/39/40) 봉합 + assembly smoke 35개 포화. 그 command-plan 을 처음으로 실 gh 실행-후에 도달시키는 live execute-side round-trip 이 미봉합(누구도 실 gh stdout 을 output-parse 에 넣은 적 없음). eval-live/collection-live 처럼 dormant gated 로 shipped(비-blocked). live 배선(step_report+credential)은 ADR-0045 deferred=Follow-up. dep[] file-disjoint stage5b 병렬.
---

# T-0941 — realdata-e2e dual-leg run report rolling-issue publish live round-trip (env-gated skip-by-default smoke)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 멱등 박제) 은 지금까지 **command-plan 조립(search argv → create/edit argv, output-parse, 멱등 재발견-재정규화)** 을 35 개 in-memory assembly smoke 로 남김없이 자산화했다(cross-publish 5-medium 안정 quintet — marker T-0938 / issueNumber T-0922 / url T-0937 / title T-0939 / body T-0940 봉합 완료). 그러나 그 35 개는 **전부 synthetic literal 을 컴포저에 주입해 argv 를 대조**할 뿐, 그 argv 를 **실제 `gh` 에 도달시켜 실행-후(execute-side) stdout 을 되받아 파싱한 적이 한 번도 없다**. 즉 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 는 오직 합성 URL literal 로만 검증됐고, **실 `gh issue create|edit` 이 뱉는 진짜 stdout** 을 round-trip 한 spec 이 0 개다.

REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")의 in-memory 근거는 완비됐으나, **그 멱등이 실 github 상에서 실제로 성립하는지**(1차 create → 2차 재발견 → edit 로 같은 이슈 번호/url 에 수렴)는 어떤 spec 도 실증하지 않는다. 본 task 는 그 **live execute-side round-trip seam** 을 닫는다 — 지금까지 조립만 하던 command-plan 을 처음으로 실 `gh` 에 도달시켜 (a) 실 gh stdout 을 output-parse 가 round-trip 하고 (b) 같은 run 을 두 번 publish 할 때 1차 create·2차 edit 로 멱등하게 같은 rolling-issue 로 수렴함을 실증한다.

이는 assembly smoke #36 이 **아니다** — 축이 in-memory 조립이 아니라 **실 gh 실행-후 round-trip** 이다. eval leg(T-0610 `realdata-e2e-live.smoke-spec.ts`)·collect leg(T-0806 `realdata-e2e-github-collection-live.smoke-spec.ts`)가 각각 실 Ollama·실 github 수집을 dormant env-gated live smoke 로 shipped 했듯, publish leg 도 실 gh publish 를 dormant env-gated live smoke 로 봉한다. 그 두 live smoke 는 각자의 daily-test.sh wiring(step_eval T-0612 / step_collect T-0888) **보다 먼저** dormant 로 머지됐다 — 본 task 도 같은 순서다(live spec 선행, step_report wiring 은 Follow-up).

**비-blocked 근거**: gating env(REALDATA_E2E_* 7 종) 부재 시 `describe.skip` → public CI 에서 실행되는 test 0, 실 네트워크 0, github mutation 0, secret 0(R-113 green 유지). 실 credential 주입·`step_report` 의 deploy/daily-test.sh 배선(=production nightly 에서 실제로 도는 것)은 ADR-0045 credential gate deferred 로 **본 task 밖**(Follow-up). 본 task 는 그 wiring 이 결국 호출할 **test-side 실 publish 스캐폴딩**을 dormant 로 박제할 뿐 — 아무 것도 activate 하지 않는다. 오너 승인(Q-0051, PLAN 109행)이 "결과를 daily-test result/rolling 이슈에 박제" capability 를 이미 승인했으므로 §5 재-BLOCKED 불요(eval-live·collection-live 도 dormant gated 로 비-blocked shipped 된 선례).

issue-still-relevant 확인(2026-07-12): `ls test/smoke | grep -iE "report.*live|publish.*live"` = 0개, `grep -rniE "step_report|issue create|issue edit" deploy/` = 0개 — live publish round-trip spec·daily-test.sh publish step 둘 다 부재 확정. `git log origin/main` 동일 영역(dual-leg run report **실 gh** publish round-trip smoke) 박제 commit 0. command-plan/output-parse 헬퍼(search-argv·gh-command-plan·output-parse)는 이미 main 에 박제됨 — 본 task 는 그 헬퍼를 **다시 만들지 않고** 실 gh 실행에 도달시켜 실 stdout round-trip + 멱등 수렴을 실증하는 **live smoke 1파일만** 신설.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ "결과를 daily-test result/rolling 이슈에 박제")
- `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` — **1순위 구조 템플릿(collect leg 의 dormant env-gated live smoke)**. `resolveRealDataE2eLiveGating(process.env)` → `gating.enabled ? describe : describe.skip` gating 분기·`jest.setTimeout`·비결정 본문 미-assert(식별자/메타 존재만)·raw 미보관(R-59)·실 credential 값 코드 기재 0(§9, env 출처만)·헤더 주석 규약·한국어 describe/it 문자열을 mirror. 단 collect 는 **read round-trip(GithubAdapter GET)**, 본 task 는 **write round-trip(실 `gh issue create|edit` execFile)** 이라 execution 수단·멱등(재발견 후 edit) 축이 다름. 구조·gating·격리 규약만 mirror, 수집 assert 재사용 금지.
- `test/smoke/realdata-e2e-live.smoke-spec.ts` — **2순위 참조(eval leg live smoke, step_eval 보다 먼저 dormant shipped 된 선례)**. dormant live spec 이 daily-test.sh wiring 보다 선행하는 순서·gating skip 규약 참조.
- `test/helpers/realdata-e2e-live-gating.ts` — **gating 판정(재사용, 신설 금지)**. `resolveRealDataE2eLiveGating(env)` → `{enabled, ...}`(REALDATA_E2E_* 7 종 완전성). `REALDATA_E2E_REQUIRED_ENV`. gating enable 결정에만 사용 — 새 gating 함수/env 신설 금지(write-scope 신규 credential 설계는 본 task 밖, 필요 시 Follow-up ADR).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 실 run 식별(gitSha=실 `git rev-parse --short HEAD`, dateToken=오늘 KST date)로 대표 leg outcome 을 넣어 report 조립(재단언 금지 — live 입력 조립에만).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` / `...-issue-command-args.ts` / `...-issue-search-argv.ts` / `...-issue-gh-command-plan.ts` — command-plan 조립 chain(재사용, 재단언 금지). `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)`(search argv), `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`(create/edit 분기). 내부 정합은 35 개 assembly smoke 가 이미 봉합 — 본 task 는 argv 를 실 gh 에 넘겨 실행에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — **본 task 핵심 대상(실 stdout round-trip)**. `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueOutcome{url, issueNumber}`. 지금까지 합성 URL literal 로만 검증됨 — 본 task 는 **실 gh create/edit stdout** 을 넣어 round-trip 실증.
- `test/jest-smoke.json` — smoke jest config(`testRegex` 가 본 신규 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-live.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0). gating env(REALDATA_E2E_* 7 종) 부재 시 **`describe.skip` 으로 전 suite skip** — public CI 는 gating 부재라 항상 skip → 실 gh 실행 0 / github mutation 0 / 실 네트워크 0 / secret 0 으로 green(R-113). gating 활성(ops nightly) 시에만 아래 live round-trip 이 실행된다. 실 credential 값(gh 토큰)은 본 파일 어디에도 기재 0 — `gh` CLI 의 ambient auth(환경 상속)만 사용(§9). 파일 상단에 한국어 헤더 주석(목적·dormant env-gated skip-by-default·gating 부재 시 side-effect 0·실 gh execFile write round-trip·collection-live/eval-live 와의 관계·step_report wiring 은 ADR-0045 deferred Follow-up·raw 미보관 R-59) 작성. describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). `jest.setTimeout` 넉넉히(live gh hang 대비, collection-live 동형).

- [ ] **gating skip-by-default 분기 (핵심 게이트)** — `const gating = resolveRealDataE2eLiveGating(process.env); const describeLive = gating.enabled ? describe : describe.skip;` 로 전 suite 를 gating 에 종속. gating env 부재(public CI 기본) 시 전 it skip → 실 gh 실행 0. `process.env` 는 gating 판정 외 직접 읽기 0(비-gating branch 로직 금지).
- [ ] **Happy-path live create round-trip test 1+ (gating 활성 시)** — 실 run 식별(gitSha=실 git short HEAD·dateToken=오늘 KST) + 대표 두 leg outcome 으로 report→descriptor→commandArgs 조립 → `buildRealData...IssueSearchGhArgv(commandArgs)` 로 `gh issue list/search` argv 산출 → 실 `gh` execFile → 실 searchStdout → `resolve...GhCommandPlan(searchStdout, commandArgs)` → plan.argv 를 실 `gh` execFile(create 또는 edit) → 실 execStdout → `parseRealData...CreateEditOutput(execStdout)` → `outcome.{url, issueNumber}`. `outcome.issueNumber` 가 양의 정수·`outcome.url` 이 `.../issues/${outcome.issueNumber}` 로 끝남(실 gh stdout round-trip 성립) 1+ test.
- [ ] **멱등 수렴 단언 (핵심 — 같은 run 2회 publish → 같은 이슈로 수렴) 1+** — 같은 run 으로 publish 를 **연속 2회** 실행 → 1차 outcome 과 2차 outcome 의 `issueNumber` 가 `===`(중복 이슈 생성 0, 재발견 후 edit 수렴)·`url` byte-identical 1+ test. 2차의 resolve 가 1차가 만든 이슈를 search 로 재발견해 `action.action === "edit"` 로 좁혀짐(1차는 "create" 또는 기존 rolling-issue 존재 시 "edit")을 실 stdout 으로 확인 1+. (rolling-issue 는 지워지지 않고 밤마다 edit 되는 것이 설계 — cleanup/삭제 하지 않는다.)
- [ ] **create/edit 두 분기 도달 확인 (branch) 1+** — search 결과가 빈/미매칭이면 plan.action==="create"(argv[1]="create"), 매칭 hit 이면 plan.action==="edit"(argv[1]="edit") 로 dispatch 됨을 실 gh 흐름에서 확인 1+(1차 실행 전 상태에 따라 최소 한 분기, 2차는 반드시 edit — 두 분기 중 실제 도달한 것 assert, 둘 다 강제 불가하면 edit 수렴만 필수).
- [ ] **Error path / negative cases 충분 cover (gating 활성 시) 1+** — 예외 분기마다 각 1+(단일 negative 금지):
  - (a) 실 gh 실행이 non-zero exit(예: 존재하지 않는 서브커맨드로 손상 argv 주입 시뮬 — 실 mutation 전 안전 경로)면 명확히 throw/reject 되어 조용한 성공-위장 0 1+ test.
  - (b) 실 gh stdout 이 예상 URL 형태가 아닐 때 `parseRealData...CreateEditOutput` 가 throw(url 미발견 상류 차단) — 손상 stdout literal 을 파서에 직접 주입해 확인 1+(파서 자체는 gating 무관 실행 가능하면 non-gated describe 로 분리 가능).
  - (c) `resolveRealDataE2eLiveGating` 가 env 불완전(7 종 중 일부 결여) 시 `enabled===false` → describeLive=describe.skip(활성 안 됨)임을 gating 판정 수준에서 최소 확인 1+(gating helper 자체 unit 은 realdata-e2e-live-gating.spec.ts 소관 — 재단언 아닌 skip 분기 성립 확인).
- [ ] **raw / credential 누출 0 test 1+** — publish 흐름 어디에서도 gh 토큰/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘가 조립된 search argv·plan.argv·descriptor/commandArgs 문자열·`outcome.{url}` 어느 곳에도 미등장(정규식/`not.toContain`, §9 / R-59 / REQ-059 정합) 1+ test. 실 leg outcome 의 raw 활동 본문이 이슈 body argv 에 요약/식별자 형태로만 실리고 raw 원문 그대로 누출 0(assembly smoke 가 봉한 성질의 live 확인) 1+. 실 credential 값은 코드/로그/변수에 기재 0 — gh ambient auth 만.
- [ ] **비결정 본문 미-assert (R-59 격리)** — 실 gh 응답의 비결정 본문(이슈 생성 시각, 서버 부여 필드 등)은 assert 하지 않고 구조적 invariant(issueNumber 양수·url↔issueNumber 정합·멱등 수렴)만 assert. raw 외부 응답을 파일/전역 변수로 보관 0(collection-live §(iii) mirror).
- [ ] **dormant 확인 — CI 에서 side-effect 0** — gating env 없이(=CI 기본) 본 suite 를 실행하면 전 it skip(실행 test 0), 실 gh 미발화, github mutation 0, exit 0. `pnpm test:smoke`(gating 부재) green.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(gating 부재 skip) green, 전체 unit suite 무회귀(`pnpm test`). production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`)·`deploy/*.sh` 변경 0. 새 외부 dependency 0(Node 내장·기존 `gh`·기존 헬퍼만).
- **`deploy/daily-test.sh` 에 `step_report` 배선 금지** — 이는 step④ live wiring(production nightly 에서 실제 실행 + credential 주입)으로 ADR-0045 credential gate **deferred**. 본 task 는 그 wiring 이 결국 호출할 **dormant test-side live spec** 만 박제(eval-live→step_eval, collection-live→step_collect 순서 mirror). step_report 배선은 Follow-up.
- **새 gating env / write-scope credential 설계 금지** — 기존 `resolveRealDataE2eLiveGating`(REALDATA_E2E_* 7 종) enable 판정 재사용 + `gh` ambient auth. 이슈 write 를 위한 별도 write-PAT gating env 신설이 필요하다고 판명되면 **Follow-up + ADR** 로(본 task 는 read PAT 승인 범위/ambient gh 로 진행, 신규 credential 클래스 도입 0 — 도입이 불가피하면 BLOCKED 후 오너 결정).
- command-plan 조립 chain(search-argv·descriptor·command-args·gh-command-plan·output-parse) **내부 정합 재단언 금지** — 35 개 assembly smoke 가 이미 봉합. import·호출·실 gh 도달·실 stdout round-trip 에만.
- collection-live(수집 GET round-trip)·eval-live(Ollama round-trip) 의 assert 재사용/재단언 금지 — 구조·gating·격리 규약만 mirror. 본 task 축은 **publish(실 gh write) round-trip + 멱등 수렴**.
- rolling-issue 삭제/cleanup 금지 — 밤마다 edit 되는 것이 설계(REQ-009 멱등). 테스트 종료 시 이슈를 지우지 않는다(2차 멱등 수렴이 1차 이슈를 재발견해야 하므로).
- gating 부재 시 실행되는 non-gated 로직에 실 gh 호출/네트워크/mutation 도입 금지 — non-gated 로 실행 가능한 것은 순수 파서 negative(손상 stdout literal)·gating skip 판정뿐.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 헬퍼 export 시그니처(`resolveRealDataE2eLiveGating`, `buildRealDataDailyStepDualLegRunReport`, descriptor/command-args/search-argv/gh-command-plan/output-parse 빌더)를 import 해, gating 활성 시에만 실 run 식별 + 대표 leg outcome → report → command-plan → 실 `gh` execFile(search→create/edit) → 실 stdout → output-parse round-trip → 멱등 수렴(같은 run 2회 → 같은 issueNumber/url)을 실증하는 dormant env-gated live smoke 작성. gating 부재 시 describe.skip 으로 CI side-effect 0. 구조·gating·격리는 collection-live(T-0806) mirror, execution 수단은 실 `gh` execFile(write). 실 credential 값 코드 기재 0(gh ambient auth·§9), 비결정 본문 미-assert·raw 미보관(R-59), credential 누출 0 정규식 확인. 축은 in-memory assembly 가 아니라 **실 gh 실행-후(execute-side) publish round-trip + 멱등 수렴** — assembly smoke #36 이 아님.)

## Follow-ups

- **step④ live wiring (credential gate deferred, ADR-0045)** — 본 dormant live spec 이 shipped 되면, 그것을 실제로 호출하는 `step_report` 를 `deploy/daily-test.sh` 에 배선(step_eval T-0612 / step_collect T-0888 패턴 — gating 활성 시 실행, 부재 시 SKIP no-op) + 대응 bash 단위 test(`deploy/daily-test-step-report.test.sh`, 부작용 0 gating/SKIP/ORDER/argv 분기 검증). 단 실 credential(github write/publish 토큰) 주입 + production nightly activation 은 ADR-0045 credential gate + 오너 ops 결정 소관 — 다음 turn planner 가 credential gate 상태 재확인 후 판단.
- **write-scope credential 설계** — 이슈 write(create/edit)에 read PAT/ambient gh 로 불충분하다고 실증되면 write-scope gating env(예: REALDATA_E2E_GITHUB_PUBLISH_TOKEN) 신설 + ADR(§5 신규 credential 클래스). 본 task 에서는 도입 0.

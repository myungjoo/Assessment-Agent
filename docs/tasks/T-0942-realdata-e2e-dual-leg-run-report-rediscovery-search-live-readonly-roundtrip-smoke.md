---
id: T-0942
title: realdata-e2e dual-leg run report 의 rolling-issue 재발견(re-discovery) 검색을 **실 `gh search issues` (read-only)** 로 1 회 round-trip 하는 env-gated skip-by-default live smoke 신설 — T-0941 이 봉한 write-side(create/edit) round-trip 의 **read-side 짝**. descriptor.marker → search-argv(`buildRealData...IssueSearchGhArgv`) → 실 `gh search issues --match body <marker> --json number,title,body --limit 30` execFile(**mutation 0 순수 read**) → 실 search stdout(JSON) → `parseRealData...IssueSearchOutput` round-trip → `resolve...GhCommandPlan(searchStdout, commandArgs)` 재발견 결정. fresh run 식별자(오늘 KST dateToken@실 git short HEAD)의 marker 는 아직 github 에 없어 `gh search` 가 빈 배열(`[]`) 을 산출 → 파서 `[]` round-trip → plan.action==="create"(재발견 미매칭 → 신규) 를 **결정론적으로** 실증. 이로써 (a) search argv 가 실 gh 에 accept 되는지(argv malformation 0·`--match body`/`--json`/`--limit` 유효 flag) (b) 실 gh `--json` 출력이 파서가 round-trip 하는 배열 schema 인지 (c) 실 github 상태로부터 재발견 결정이 유도되는지를 read-only 로 봉합. gating 부재(public CI) 시 `describe.skip` → 실 네트워크 0 / **mutation 0**(read-only) / secret 0 으로 green(R-113). write credential 불요(read-scope PAT/gh ambient read 로 충분)라 T-0941(write path) 보다 넓은 환경에서 실행 가능. step_report 배선은 ADR-0045 credential gate deferred 로 본 task 밖(Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 235
estimatedFiles: 1
created: 2026-07-13
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-rediscovery-search-live-readonly-roundtrip-smoke
sizeExempt: true
exemptReason: test-only env-gated live smoke 1파일 — dormant skip-by-default(gating env 부재 시 describe.skip, CI 에서 실행 0 test·mutation 0·secret 0). production LOC 0, coverageThreshold 회귀 0. gating 활성 시에만 실 `gh search issues`(read-only, mutation 0) 1 round-trip + search-output-parse round-trip + fresh-marker 미매칭 → create 결정 실증. publish-live(T-0941) 구조 mirror 하되 축은 write(create/edit) 이 아니라 read(재발견 검색) — ~235 LOC.
plannerNote: P5 §109 step④ — publish-live(T-0941) 가 write-side(create/edit) round-trip 을 봉한 뒤, 그 idempotency 가 의존하는 read-side(재발견 검색) 를 실 `gh search issues`(read-only) 로 독립 봉합. fresh marker 미매칭 → 빈 `[]` → create 결정 결정론 실증. mutation/write-credential 0 이라 T-0941 보다 넓은 환경 실행 가능. dep[] file-disjoint stage5b 병렬.
---

# T-0942 — realdata-e2e dual-leg run report rolling-issue 재발견 검색 live read-only round-trip (env-gated skip-by-default smoke)

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 멱등 박제) 의 **write-side round-trip** 은 T-0941 (publish-live) 이 봉했다 — 실 `gh issue create|edit` 실행-후 stdout 을 output-parse 가 round-trip 하고, 같은 run 을 두 번 publish 하면 1차 create·2차 edit 로 같은 rolling-issue 로 멱등 수렴함을 실증했다. 그러나 그 멱등의 **전제(prerequisite)** 인 **재발견(re-discovery) 검색** — 다음 밤 같은 run 의 기존 이슈를 `gh search issues` 로 되찾아 create/edit 를 가르는 read-side round-trip — 은 T-0941 안에서 idempotency 의 **부수 결과로만** 실행됐을 뿐, **실 `gh search`의 argv 수용성·실 `--json` 출력 schema round-trip·실 github 상태로부터의 재발견 결정** 을 그 자체 축으로 assert 한 spec 이 0 개다.

즉 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(search argv) + `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`(search stdout 파서) 는 지금까지 **오직 합성 stdout literal 로만** 검증됐고, 그 search argv 가 **실 `gh search issues`에 실제로 accept 되는지**(flag 조합 `--match body`/`--json number,title,body`/`--limit 30` 가 유효한지, argv malformation 0), 그리고 **실 gh 가 뱉는 진짜 `--json` 배열** 을 파서가 round-trip 하는지는 어떤 spec 도 실증하지 않는다.

REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")의 **찾아(find)** 절반 — 재발견 검색 — 의 live 근거가 빈 상태다. 본 task 는 그 **read-side round-trip seam** 을 read-only 로 닫는다: fresh run 식별자(오늘 KST dateToken@실 git short HEAD)로 descriptor→commandArgs→search-argv 를 조립해 실 `gh search issues`(순수 read, **mutation 0**)에 도달시키고, (a) 실 gh 가 그 argv 를 accept 해 valid JSON 을 산출하고 (b) 파서가 그 실 stdout 을 round-trip 하며 (c) fresh marker 는 아직 github 에 없으므로 빈 배열(`[]`) → `resolve...GhCommandPlan` 이 `plan.action === "create"`(재발견 미매칭 → 신규) 로 **결정론적으로** 수렴함을 실증한다.

이는 assembly smoke 도, T-0941 의 중복도 **아니다** — 축이 in-memory 조립이 아니라 **실 gh 실행-후 round-trip** 이고, T-0941 의 write(create/edit) 가 아니라 **read(재발견 검색)** 다. 또한 **mutation 0 순수 read** 라 write credential 불요(read-scope PAT / gh ambient read 로 충분) — T-0941(write path) 이 요구하는 write scope 없이도 돌 수 있어 **더 넓은 환경**(read-only nightly, restricted credential)에서 재발견 health check 를 단독 실행할 수 있는 운영 가치를 갖는다. eval-live(T-0610)·collect-live(T-0806)·publish-live(T-0941) 가 각 leg 을 dormant env-gated live smoke 로 봉했듯, 재발견 검색 leg 도 dormant env-gated live smoke 로 봉한다.

**비-blocked 근거**: gating env(REALDATA_E2E_* 7 종) 부재 시 `describe.skip` → public CI 에서 실행되는 test 0, 실 네트워크 0, github mutation 0(애초에 read-only), secret 0(R-113 green 유지). 실 credential 값은 본 파일 어디에도 기재 0 — `gh` CLI 의 ambient auth(환경 상속)만 사용(§9). step④ live wiring(step_report 를 deploy/daily-test.sh 에 배선 + write credential 주입)은 ADR-0045 credential gate deferred 로 **본 task 밖**(Follow-up). 오너 승인(Q-0051, PLAN 109행)이 실 github 공개 활동 e2e capability 를 이미 승인했으므로 §5 재-BLOCKED 불요(read-only 라 write-scope 신규 credential 도입 0).

issue-still-relevant 확인(2026-07-13): `ls test/smoke | grep -iE "rediscovery|search.*live|search-live"` = 0개 — 재발견 검색 live round-trip spec 부재 확정. `git log origin/main` 동일 영역(dual-leg run report **실 gh search** read-side round-trip smoke) 박제 commit 0. search-argv·search-parse·gh-command-plan 헬퍼는 이미 main 에 박제됨 — 본 task 는 그 헬퍼를 **다시 만들지 않고** 실 `gh search issues` 실행에 도달시켜 실 stdout round-trip + fresh-marker create 결정을 실증하는 **live smoke 1파일만** 신설.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만 — step④ "결과를 daily-test result/rolling 이슈에 박제")
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-live.smoke-spec.ts` — **1순위 구조 템플릿(publish-live, write-side 짝, T-0941)**. `resolveRealDataE2eLiveGating(process.env)` → `gating.enabled ? describe : describe.skip` gating 분기·`jest.setTimeout`·실 `gh` execFile 규약·비결정 본문 미-assert·raw 미보관(R-59)·실 credential 값 코드 기재 0(§9)·credential 누출 0 정규식·헤더 주석 규약·한국어 describe/it 문자열을 mirror. 단 T-0941 은 **write(create/edit) round-trip + 멱등 수렴**, 본 task 는 **read(재발견 검색) round-trip + fresh-marker create 결정** — execution 은 `gh search issues`(read-only, mutation 0)뿐. 구조·gating·격리 규약만 mirror, create/edit write 흐름·멱등 assert 재사용 금지.
- `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` — **2순위 참조(collect leg 의 read round-trip live smoke)**. read-only 실 github round-trip 의 dormant env-gated 규약·비결정 본문 미-assert·raw 미보관 참조. 단 collect 는 GithubAdapter GET, 본 task 는 `gh search issues` execFile — 수단 다름. 수집 assert 재사용 금지.
- `test/helpers/realdata-e2e-live-gating.ts` — **gating 판정(재사용, 신설 금지)**. `resolveRealDataE2eLiveGating(env)` → `{enabled, ...}`(REALDATA_E2E_* 7 종 완전성). `REALDATA_E2E_REQUIRED_ENV`. gating enable 결정에만 사용 — 새 gating 함수/env 신설 금지.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 실 run 식별(gitSha=실 `git rev-parse --short HEAD`, dateToken=오늘 KST date)로 대표 leg outcome 을 넣어 report 조립(재단언 금지 — live 입력 조립에만).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` / `...-issue-command-args.ts` — descriptor·commandArgs 조립 chain(재사용, 재단언 금지). `commandArgs.searchQuery`(=descriptor.marker) 가 search-argv 입력.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — **본 task 핵심 대상 ①(argv 수용성)**. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `["search", "issues", "--match", "body", searchQuery, "--json", "number,title,body", "--limit", "30"]`. 본 task 는 이 argv 를 **실 `gh` 에 넘겨 accept 되는지** 실증(read-only). `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS`/`..._SEARCH_LIMIT` 상수 참조.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — **본 task 핵심 대상 ②(실 stdout round-trip)**. `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueSearchHit[]`. 지금까지 합성 literal 로만 검증됨 — 본 task 는 **실 `gh search issues` stdout** 을 넣어 round-trip 실증(`"[]"` → `[]` 포함).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`(create/edit 분기). 재발견 미매칭 → `action==="create"`. 본 task 는 실 searchStdout 을 넣어 결정 유도만(내부 정합 재단언 금지 — assembly smoke 가 봉합).
- `test/jest-smoke.json` — smoke jest config(`testRegex` 가 본 신규 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0). gating env(REALDATA_E2E_* 7 종) 부재 시 **`describe.skip` 으로 전 suite skip** — public CI 는 gating 부재라 항상 skip → 실 gh 실행 0 / github mutation 0(애초에 read-only) / 실 네트워크 0 / secret 0 으로 green(R-113). gating 활성 시에만 아래 read-only round-trip 이 실행된다. 실 credential 값(gh 토큰)은 본 파일 어디에도 기재 0 — `gh` CLI 의 ambient auth(환경 상속)만 사용(§9). 파일 상단에 한국어 헤더 주석(목적·dormant env-gated skip-by-default·gating 부재 시 side-effect 0·실 `gh search issues` **read-only**(mutation 0) round-trip·publish-live(T-0941) write-side 의 read-side 짝·fresh marker 미매칭 → create 결정·step_report wiring 은 ADR-0045 deferred Follow-up·raw 미보관 R-59) 작성. describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). `jest.setTimeout` 넉넉히(live gh hang 대비, publish-live 동형).

- [ ] **gating skip-by-default 분기 (핵심 게이트)** — `const gating = resolveRealDataE2eLiveGating(process.env); const describeLive = gating.enabled ? describe : describe.skip;` 로 전 suite 를 gating 에 종속. gating env 부재(public CI 기본) 시 전 it skip → 실 gh 실행 0. `process.env` 는 gating 판정 외 직접 읽기 0.
- [ ] **Happy-path live re-discovery search round-trip test 1+ (gating 활성 시)** — 실 run 식별(gitSha=실 git short HEAD·dateToken=오늘 KST) + 대표 두 leg outcome 으로 report→descriptor→commandArgs 조립 → `buildRealData...IssueSearchGhArgv(commandArgs)` 로 `gh search issues` argv 산출 → 실 `gh` execFile(**read-only**, mutation 0) → 실 searchStdout → `parseRealData...IssueSearchOutput(searchStdout)` → hits 배열. hits 가 배열이고(파서 round-trip 성립) 각 원소가 `{number(양의 정수), title(string), body(string)}` 정규 형태임을 확인 1+ test. searchStdout 이 실 gh 의 valid JSON 임(파서가 throw 없이 round-trip)을 실증.
- [ ] **fresh-marker 미매칭 → create 결정 (핵심 — 결정론적) 1+** — 본 test run 의 fresh 식별자(오늘 dateToken@현재 git HEAD)로 만든 marker 는 아직 github 에 rolling-issue 로 존재하지 않으므로, 실 `gh search issues --match body <fresh-marker>` 결과가 그 marker 를 body 에 담은 hit 을 포함하지 않음(빈 `[]` 이거나, gh 느슨한 매칭으로 다른 hit 이 와도 **fresh-marker 를 body 에 정확히 포함한 hit 은 0건**) → `resolve...GhCommandPlan(searchStdout, commandArgs).action === "create"`(재발견 미매칭 → 신규 dispatch, `plan.argv[1] === "create"`) 임을 실 gh 흐름에서 결정론적으로 확인 1+ test. (rolling-issue 를 만들지 않으므로 이 결정은 안정적으로 create 로 수렴 — 본 test 는 write 하지 않는다.)
- [ ] **argv 수용성 (branch — search argv 가 실 gh 에 accept) 1+** — 산출 search argv(`["search","issues","--match","body",<marker>,"--json","number,title,body","--limit","30"]`)를 실 `gh` 에 넘겼을 때 non-zero exit / "unknown flag" / argv malformation 없이 정상 종료(exit 0)하고 파싱 가능한 JSON 을 산출함을 확인 1+ test. (flag 조합 `--match body`/`--json`/`--limit` 가 실 gh 에서 유효함을 실증 — assembly smoke 는 argv 문자열만 대조할 뿐 실 수용성은 검증 불가.)
- [ ] **Error path / negative cases 충분 cover (gating 활성 시) 1+** — 예외 분기마다 각 1+(단일 negative 금지):
  - (a) 실 gh search 가 non-zero exit(예: 손상 argv — 존재하지 않는 서브플래그 주입 시뮬)이면 명확히 throw/reject 되어 조용한 성공-위장 0 1+ test.
  - (b) 실 gh stdout 이 배열이 아니거나(비-JSON / object) 원소가 `{number,title,body}` 형태가 아닐 때 `parseRealData...IssueSearchOutput` 가 throw — 손상 stdout literal 을 파서에 직접 주입해 확인 1+(파서 자체는 gating 무관 실행 가능하면 non-gated describe 로 분리 가능).
  - (c) `resolveRealDataE2eLiveGating` 가 env 불완전(7 종 중 일부 결여) 시 `enabled===false` → describeLive=describe.skip(활성 안 됨)임을 gating 판정 수준에서 최소 확인 1+(gating helper 자체 unit 은 realdata-e2e-live-gating.spec.ts 소관 — 재단언 아닌 skip 분기 성립 확인).
- [ ] **raw / credential 누출 0 test 1+** — 재발견 흐름 어디에서도 gh 토큰/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘가 조립된 search argv·searchQuery·hits 문자열 어느 곳에도 미등장(정규식/`not.toContain`, §9 / R-59 / REQ-059 정합) 1+ test. 실 credential 값은 코드/로그/변수에 기재 0 — gh ambient auth 만.
- [ ] **비결정 본문 미-assert (R-59 격리)** — 실 gh search 응답의 비결정 본문(타 이슈 title/body, 서버 부여 필드 등)은 assert 하지 않고 구조적 invariant(hits 배열·원소 `{number 양수, title/body string}`·fresh-marker create 결정)만 assert. raw 외부 응답을 파일/전역 변수로 보관 0(collection-live mirror).
- [ ] **mutation 0 확인 (read-only)** — 본 suite 는 어떤 분기에서도 `gh issue create`/`gh issue edit` 등 write 명령을 실행하지 않음(오직 `gh search issues` read). 코드에 create/edit execFile 호출 0. (write-side round-trip 은 T-0941 소관.)
- [ ] **dormant 확인 — CI 에서 side-effect 0** — gating env 없이(=CI 기본) 본 suite 를 실행하면 전 it skip(실행 test 0), 실 gh 미발화, exit 0. `pnpm test:smoke`(gating 부재) green.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(gating 부재 skip) green, 전체 unit suite 무회귀(`pnpm test`). production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`)·`deploy/*.sh` 변경 0. 새 외부 dependency 0(Node 내장·기존 `gh`·기존 헬퍼만).
- **write 명령(`gh issue create`/`gh issue edit`) 실행 금지** — 본 task 는 read-only 재발견 검색만. write-side round-trip + 멱등 수렴은 T-0941(publish-live) 소관 — 재단언/재실행 금지.
- **`deploy/daily-test.sh` 에 `step_report` 배선 금지** — step④ live wiring(production nightly 실행 + credential 주입)으로 ADR-0045 credential gate **deferred**. 본 task 는 그 wiring 이 결국 호출할 dormant test-side read round-trip 만 박제. step_report 배선은 Follow-up.
- **새 gating env / credential 클래스 설계 금지** — 기존 `resolveRealDataE2eLiveGating`(REALDATA_E2E_* 7 종) enable 판정 재사용 + `gh` ambient auth(read). read-only 라 write-scope credential 도입 불요(0).
- command-plan 조립 chain(search-argv·descriptor·command-args·search-parse·gh-command-plan) **내부 정합 재단언 금지** — 기존 assembly smoke 가 이미 봉합. import·호출·실 gh 도달·실 stdout round-trip·create 결정 유도에만.
- collection-live(수집 GET round-trip)·eval-live(Ollama round-trip)·publish-live(create/edit write round-trip) 의 assert 재사용/재단언 금지 — 구조·gating·격리 규약만 mirror. 본 task 축은 **재발견 검색(실 `gh search issues` read) round-trip + fresh-marker create 결정**.
- rolling-issue 생성/삭제 금지 — 본 task 는 write 하지 않는다(read-only). fresh marker 가 미매칭이어야 create 결정이 결정론적으로 성립.
- gating 부재 시 실행되는 non-gated 로직에 실 gh 호출/네트워크/mutation 도입 금지 — non-gated 로 실행 가능한 것은 순수 파서 negative(손상 stdout literal)·gating skip 판정뿐.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 헬퍼 export 시그니처(`resolveRealDataE2eLiveGating`, `buildRealDataDailyStepDualLegRunReport`, descriptor/command-args builder, `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`, `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`, `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`)를 import 해, gating 활성 시에만 실 run 식별 + 대표 leg outcome → report → descriptor → commandArgs → search-argv → 실 `gh search issues`(read-only) execFile → 실 searchStdout → search-parse round-trip → fresh-marker 미매칭 → create 결정을 실증하는 dormant env-gated live smoke 작성. gating 부재 시 describe.skip 으로 CI side-effect 0. 구조·gating·격리는 publish-live(T-0941)/collection-live(T-0806) mirror, execution 수단은 실 `gh search issues`(read-only). 실 credential 값 코드 기재 0(gh ambient auth·§9), 비결정 본문 미-assert·raw 미보관(R-59), credential 누출 0 정규식 확인, write 명령 실행 0. 축은 write(create/edit) 이 아니라 **read(재발견 검색) round-trip** — T-0941 의 read-side 짝.)

## Follow-ups

- **step④ live wiring (credential gate deferred, ADR-0045)** — publish-live(T-0941) + 본 read-side re-discovery smoke 가 shipped 되면, 그것들을 실제로 호출하는 `step_report` 를 `deploy/daily-test.sh` 에 배선(step_eval T-0612 / step_collect T-0888 패턴) + 대응 bash 단위 test. 단 실 credential(github write/publish 토큰) 주입 + production nightly activation 은 ADR-0045 credential gate + 오너 ops 결정 소관 — 다음 turn planner 가 credential gate 상태 재확인 후 판단.
- **read-only 재발견 nightly health check** — 본 read-only smoke 는 write scope 없이 돌 수 있으므로, write-publish 를 아직 활성화하지 않은 단계에서도 "재발견 검색이 실 github 에서 정상 동작하는가" 를 read-scope credential 만으로 검증하는 경량 nightly health step 으로 분리 배선할 여지가 있다(write step_report 배선과 독립). 필요 판명 시 별도 task.

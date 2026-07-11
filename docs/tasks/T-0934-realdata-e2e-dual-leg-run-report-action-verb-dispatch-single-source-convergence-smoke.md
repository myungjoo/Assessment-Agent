---
id: T-0934
title: realdata-e2e dual-leg run report 의 create-or-update action 분기가 search stdout 의 marker-match 술어(body.includes(marker))로부터 단일 source 로 결정되고 argv[0]==="issue" 는 두 분기 불변·argv[1] 은 create action → "create" / update action → "edit"(update→edit 비대칭 verb 매핑)로 단일 discriminant 관통함을 박제하는 action-verb dispatch single-source convergence non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-032, REQ-059]
estimatedDiff: 340
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-action-verb-dispatch-single-source-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-action-verb-dispatch-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — create-or-update action **dispatch discriminant** sweep(happy: 유효 두 leg outcome + run → report → descriptor → commandArgs 통과 후, 종단 컴포저를 (1) 빈 search `"[]"` (2) marker-미매칭 hit(body 에 marker 미포함) (3) marker-매칭 hit 세 stdout 에 각각 적용 → (1)·(2)는 create action(plan.action.action==="create") + argv[1]==="create", (3)는 update action(plan.action.action==="update") + argv[1]==="edit" 로 dispatch·argv[0]==="issue" 는 세 경우 모두 불변·dispatch discriminant = body.includes(marker) 술어의 hit 존재 여부(응답 non-emptiness 아님)·plan.action.action↔argv[1] verb 매핑이 create→"create"/update→"edit" 비대칭(update action 이 argv[1]==="update" 로 매핑되지 **않음**)·leg outcome/run-token 무관 dispatch 안정(멱등 근거)·복수 marker-매칭 hit 여도 여전히 update 단일 dispatch·negative(dispatch drift·verb-name 혼동 update→"update" 오매핑 검출·marker guard blank 전체매칭·파서 guard 비JSON/비배열·number guard 비양수 hit·결정론/no-mutation/credential) 다수) test-dominated ~340 LOC. 형제 T-0930/T-0931(title/body cross-branch 대칭 field)·T-0932/T-0933(labels/issueNumber orthogonal asymmetric field)는 모두 **field 내용** medium 을 다뤘고, 본 task 는 그 field 들을 어느 분기로 보낼지 결정하는 **branch-selection(action→verb dispatch) discriminant** 를 field 와 독립된 축으로 봉합. T-0927(gh-command-plan argv single-source)은 고정 hit stdout 하 각 분기 argv byte-identical 만·dispatch **술어 경계**(empty vs 비매칭 hit vs 매칭 hit) sweep 및 action↔verb 비대칭 매핑 미단언. T-0922(republish create→update idempotency)는 두 publish cycle 걸친 create-output M threading 상태 전이만·단일 publish 안 dispatch 술어 경계 아님. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0930~T-0933(title/body cross-branch + labels/issueNumber orthogonal) 로 모든 field medium 종결 후, field 를 어느 분기로 보낼지 결정하는 action→verb dispatch discriminant 자체가 미봉합. argv[1]=create/edit 이 marker-match 술어로 단일 결정·argv[0]="issue" 불변·update→"edit" 비대칭 매핑. dep [] file-disjoint stage5b 병렬.
---

# T-0934 — realdata-e2e dual-leg run report action-verb dispatch single-source convergence non-gated smoke

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 멱등 박제) chain 의 **create-or-update 분기 선택(action→verb dispatch) 자체가 search stdout 의 marker-match 술어로부터 단일하게 결정되는 discriminant seam** 이 아직 어떤 smoke 에도 chain 그물로 묶이지 않았다.

지금까지 형제 chain 은 각 분기에 실리는 **field 내용** medium 을 하나씩 봉합했다:

- title / body — 두 분기 모두 등장하는 **대칭 field** cross-branch single-source (T-0930 / T-0931).
- labels — create 분기에만 붙는 **비대칭 field** (create-only ⊥ update, T-0932).
- issueNumber — update 분기에만 붙는 **비대칭 field** (update-only ⊥ create, T-0933).
- marker — searchArgv / body 선두 라인으로 관통하는 field (T-0928 / T-0929).

그러나 이 field 들을 **어느 분기(create argv vs edit argv)로 보낼지 결정하는 dispatch 판단** 은 field 와 독립된 별개의 축이다. 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` 는 3단계 위임(parse → resolveAction → buildGhArgv) 중 **resolveAction** 이 create/update 를 가르고, 그 action 이 buildGhArgv 에서 verb 로 매핑된다:

- **dispatch 술어** — `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker)` 는 `hits.filter((h) => h.body.includes(marker))` 의 후보 개수로 분기한다. 후보 0건 → `{action:"create"}`, 후보 1+건 → `{action:"update", issueNumber:최소 number}`. 즉 discriminant 는 **search 응답의 non-emptiness 가 아니라 body-marker 포함 술어의 매칭 hit 존재 여부** 다 — marker 미포함 hit 만 잔뜩 와도(비매칭) 여전히 create.
- **action→verb 매핑(비대칭)** — `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 는 create action → `["issue","create", ...]`, update action → `["issue","edit", ...]` 를 낸다. `argv[0]` 은 두 분기 모두 상수 `"issue"`(공유 base 명령 noun). `argv[1]` 이 유일한 discriminant 이며 **update action 은 `"update"` 가 아니라 `"edit"` verb 로 매핑**된다(gh CLI 는 `gh issue edit N` — 비대칭). `plan.action.action`("create"/"update") 과 `argv[1]`("create"/"edit") 은 이 매핑을 통해 단일 source 로 묶여야 한다.

만약 dispatch 가 어긋나면 — marker-매칭 hit 이 있는데도 create 로 새면 매 밤 새 이슈를 만들어 rolling-issue 멱등이 깨지고(REQ-009 — 동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함), 반대로 빈/비매칭 search 인데 update 로 새면 존재하지 않는 이슈를 `gh issue edit` 대상으로 지목해 명령이 실패한다. 또 update action 이 `argv[1]==="update"` 같은 잘못된 verb 로 매핑되면 gh CLI 가 그런 subcommand 를 모르므로 실행 자체가 실패한다.

그러나 이 **dispatch 술어 → verb 관통** 을 어느 smoke 도 chain 그물로 검증하지 않는다:

- 형제 T-0927(gh-command-plan argv single-source)은 **고정 hit stdout 하 각 분기 argv 가 buildGhArgv 산출과 byte-identical** 함만 자산화한다 — dispatch **술어 경계**(empty `"[]"` vs 비매칭 hit vs 매칭 hit 를 sweep 해 어느 조건이 create/update 를 낳는지)와 `plan.action.action ↔ argv[1] verb` 비대칭 매핑(update→"edit")은 미단언(주어진 분기 내부 argv 정합만).
- 형제 T-0932/T-0933(labels/issueNumber orthogonal)은 field 가 **자신의 분기에만** 붙고 상대 분기엔 없음(field 존재/부재)만 자산화한다 — 분기 선택 판단 자체(dispatch discriminant)는 다루지 않는다.
- 형제 T-0922(republish create→update idempotency)은 **두 publish cycle 에 걸친 create-output M threading 상태 전이**만 자산화한다 — 단일 publish 안에서 dispatch 술어 경계(empty vs 비매칭 vs 매칭)가 verb 를 어떻게 가르는지는 다른 축.
- 형제 T-0920(edit-argv issueNumber closure)은 **update 분기 내부** search-hit N → resolve → edit-argv 관통만 자산화한다 — create/update 분기 선택 자체는 update 분기 안이라 대조 대상 아님.

본 task 는 그 **action-verb dispatch single-source seam** 을 닫는다 — field medium(T-0930~T-0933) 종결 후 그 field 들을 어느 분기로 보낼지 결정하는 branch-selection 축. chain: 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, 종단 컴포저를 (1) 빈 search `"[]"` (2) marker-미매칭 hit stdout (3) marker-매칭 hit stdout 세 입력에 각각 적용해, (1)·(2)는 `plan.action.action==="create"` + `argv[0..1]===["issue","create"]`, (3)는 `plan.action.action==="update"` + `argv[0..1]===["issue","edit"]` 로 dispatch 되며 `argv[0]==="issue"` 는 세 경우 불변, dispatch discriminant 가 body-marker 술어(응답 non-emptiness 아님)임을 박제한다.

issue-still-relevant 확인(2026-07-12): `ls test/smoke | grep dual-leg | grep -iE "dispatch|verb|action-select"` = **0개**(dispatch 술어→verb 매핑 seam 미봉합 — T-0927 argv single-source / T-0922 republish threading / T-0920 update 내부 closure 뿐). resolveAction 술어 분기(T-0898) 및 buildGhArgv 의 create→"create"/update→"edit" 매핑(T-0899)·종단 컴포저 3단계 위임(T-0902) 배선은 이미 main 에 박제됨 — 본 task 는 그 배선을 **다시 만들지 않고** dispatch 술어 경계와 action↔verb 관통을 대조하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(action-verb dispatch smoke) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0933-realdata-e2e-dual-leg-run-report-update-branch-issuenumber-single-source-create-absence-orthogonal-smoke.md` — **직전 형제(1순위 템플릿)**. chain assembler(두 leg outcome + run → report → descriptor → commandArgs → 컴포저 분기 적용)·synthetic 빌더·import 경로 규약·describe 구조·한국어 헤더 주석·negative 접근·hit stdout literal 주입·빈 search 격리·argv 원소 추출·부재/존재 단언 패턴. 본 task 는 그 **issueNumber(update-only field)** 축 재단언 금지 — 초점을 field 존재/부재에서 **분기 선택 판단(action→verb dispatch discriminant)** 으로 이동.
- `docs/tasks/T-0927-realdata-e2e-dual-leg-run-report-gh-command-plan-argv-single-source-assembly-smoke.md`(파일명 유사 slug) — **gh-command-plan 형제(재단언 금지 대상)**. 고정 hit stdout 하 각 분기 argv byte-identical(buildGhArgv 산출 정합) 자체 재단언 금지 — 본 task 는 dispatch **술어 경계 sweep**(empty vs 비매칭 hit vs 매칭 hit)과 action↔verb 비대칭 매핑. describe 구조·argv 추출 참고만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — **본 task 핵심 대상(dispatch 술어)**. `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker)` → 후보(`hit.body.includes(marker)`) 0건 → `{action:"create"}`, 1+건 → `{action:"update", issueNumber:최소 number}`. **discriminant = body-marker 포함 술어의 매칭 hit 존재 여부**(응답 non-emptiness 아님 — 비매칭 hit 만 와도 create). guard: blank marker → throw(전체 매칭 사고), 비양수 number hit → throw. 최소 number 선택 규칙은 참고만(재단언 금지 — 본 task 는 dispatch 축).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` — **action→verb 매핑 대상**. create action → `argv[0..1]===["issue","create"]`, update action → `argv[0..1]===["issue","edit"]`(**update→"edit" 비대칭**, `"update"` 아님). `argv[0]==="issue"` 두 분기 불변. field 전개(title/body/labels/issueNumber) 형식 재단언 금지(T-0930~T-0933 cover) — verb(`argv[0..1]`) 추출·비대칭 매핑에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — **종단 컴포저**. `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`(3단계 위임 parse→resolveAction→buildGhArgv). marker-매칭 hit stdout → update plan, 빈/비매칭 stdout → create plan. 컴포저 본문·위임 배선 재단언 금지 — chain 통과 plan 산출·dispatch 대조에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `{searchQuery(=descriptor.marker), createArgs{title, body, labels}, updateArgs{title, body}}`. guard: title/marker 빈-공백 → throw. commandArgs 자체 재단언 금지 — chain 조립 입력·marker-매칭 hit 구성(hit.body 에 descriptor.marker 포함/미포함)에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `{title, marker, body}`. guard: gitSha/dateToken 빈-공백 → throw(chain 상류 차단 negative 용). descriptor 자체 재단언 금지 — chain 조립 입력·상류 guard 차단에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}(synthetic literal 원천). dispatch 는 search stdout 파생이라 run/leg outcome 무관 — run/leg 를 바꿔도 동일 stdout 이면 동일 dispatch(안정성) negative 조립용.
- `test/jest-smoke.json` — smoke jest config(`testRegex: ".*\\.smoke-spec\\.ts$"` 가 본 신규 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-action-verb-dispatch-single-source-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / search stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / `gh issue create|edit|search` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). verb·action.action 은 chain 산출물(plan.action / plan.argv)에서 추출해 대조 — literal 하드코딩 최소. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·`execFile` 0·네트워크 0·DB 0·dispatch discriminant = body-marker 술어 매칭 hit 존재 여부(응답 non-emptiness 아님)·argv[0]==="issue" 두 분기 불변·argv[1] 이 유일 discriminant·update action → "edit" 비대칭 verb 매핑(update→"update" 아님)·plan.action.action↔argv[1] single-source·REQ-009 멱등 근거(매칭 hit 있으면 갱신·없으면 생성)/REQ-032/REQ-059 raw 미저장·형제 T-0927 argv single-source 와의 차별=고정 stdout 내부 argv 정합이 아니라 술어 경계 sweep·형제 T-0932/T-0933 field orthogonal 과의 차별=field 존재/부재가 아니라 분기 선택 판단·형제 T-0922 republish 와의 차별=cross-cycle threading 이 아니라 단일 publish dispatch) 작성.

- [ ] **Happy-path dispatch 술어 → verb 관통 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: report → descriptor → commandArgs 통과. 세 stdout 각각에 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` 적용 — (1) 빈 `"[]"` → `plan.action.action==="create"` && `plan.argv[0]==="issue"` && `plan.argv[1]==="create"`, (3) marker-매칭 hit(`[{"number":N,"title":descriptor.title,"body":descriptor.body}]`, body 에 descriptor.marker 포함) → `plan.action.action==="update"` && `plan.argv[0]==="issue"` && `plan.argv[1]==="edit"` 각 1+ test. AND 세 경우 모두 `plan.argv[0]==="issue"`(base noun 두 분기 불변) 1+.
- [ ] **비매칭 hit → 여전히 create(술어 = body-marker 포함) test 1+** — (2) marker-**미포함** body 를 가진 hit 이 1+ 건 있는 stdout(`[{"number":7,"title":"x","body":"marker 를 담지 않는 본문"}]`, 응답은 non-empty)에 컴포저 → 그래도 `plan.action.action==="create"` && `plan.argv[1]==="create"` 1+ test(discriminant 이 응답 non-emptiness 가 아니라 `hit.body.includes(marker)` 술어의 매칭 hit 존재 여부임을 박제). AND 매칭 hit 을 하나 추가한 stdout(비매칭 + 매칭 혼재)에서는 update 로 전환(`plan.argv[1]==="edit"`) 1+.
- [ ] **action→verb 비대칭 매핑 test 1+** — update dispatch 시 `plan.argv[1]==="edit"` 이며 `plan.argv[1]!=="update"`(update action 이 `"update"` verb 로 매핑되지 **않음** — gh CLI 비대칭) 1+ test. AND `plan.action.action==="update"` 인데도 `argv[1]` 은 "edit" 임을 `plan.action.action` 과 `argv[1]` 을 나란히 대조(create action → "create" 는 동명, update action → "edit" 는 이명) 1+. AND create dispatch 시 `plan.argv[1]==="create"` && `plan.argv` 에 `"edit"` 부재(`not.toContain("edit")`), update dispatch 시 `plan.argv` 에 `"create"` 부재(`not.toContain("create")`) 각 1+(두 verb 상호 배타).
- [ ] **run/leg outcome 무관 dispatch 안정 test 1+** — 서로 다른 run(run A/B: 다른 gitSha 또는 dateToken)으로 각각 chain 을 돌리되 각 run 의 descriptor.marker 로 매칭 hit 을 구성하면(hit.body = 각 run 의 descriptor.body) 둘 다 update dispatch(`argv[1]==="edit"`) 1+ test — dispatch 는 술어 결과(매칭 존재) 파생이라 run-token 무관. AND 동일 run 으로 leg outcome(예: eval leg passed true→false, collect leg action 변경, overallStatus 변동)을 바꿔도 동일 stdout 이면 동일 dispatch(빈 search → create 불변) 1+ test — dispatch 는 leg 상태 무관 search-술어. AND 복수 marker-매칭 hit(예: `[{"number":9,...},{"number":4,...}]` 둘 다 매칭)에서도 여전히 단일 update dispatch(`argv[1]==="edit"`, 복수여도 create 로 분기 안 함) 1+.
- [ ] **single-source 독립 재유도 test 1+** — 컴포저 재호출 없이 `plan.action.action`(진실의 원천)을 삼아 예상 verb 를 매핑 함수(`action==="create" ? "create" : "edit"`)로 유도해 `plan.argv[1]` 과 일치 단언 1+ test(argv verb 가 하드코딩이 아니라 action.action 파생임 반영). **결정론** — 동일 입력(+ 동일 stdout) 두 번 chain → 두 plan(action, argv) deep-equal(byte-identical) 1+.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) dispatch drift 검출 — update plan.argv 를 복제해 `argv[1]` 을 `"create"` 로 변형한 synthetic argv 가 원래 update plan.argv 와 `not.toEqual` 이며 `plan.action.action`("update")↔변형 verb("create") 매핑 불일치가 검출 가능 1+ test.
  - (b) verb-name 혼동(update→"update" 오매핑) 검출 — update plan.argv 를 복제해 `argv[1]` 을 `"update"` 로 인위 주입한 synthetic argv 가 실제 chain 산출 update plan.argv(`argv[1]==="edit"`)와 `not.toEqual` 이며 그 synthetic argv 의 `argv[1]==="update"`(gh CLI 미지원 subcommand — 오매핑 시나리오가 검출 가능함을 박제) 1+ test.
  - (c) marker guard(전체 매칭 사고) 상류 차단 — blank/공백-only marker 를 낳는 commandArgs(또는 resolveAction 에 blank marker 직접) 로 컴포저 → resolver `assertMarkerNonBlank` throw 가 전파돼 plan(및 dispatch) 미산출 1+ test. `expect(() => ...).toThrow()`.
  - (d) 파서 guard 상류 차단(dispatch 이전 chain 차단) — 컴포저에 비-JSON(`"{"`)/비배열 JSON(`"{}"`) stdout 을 넣으면 파서 throw 가 컴포저로 전파돼 plan(및 그 verb) 미산출(손상 stdout 이 dispatch 로 새는 것 차단) 각 1+ test.
  - (e) number guard 상류 차단 — 비양수 number hit(`[{"number":0,...}]` 또는 `[{"number":-3,...}]`, marker 매칭이어도)를 넣으면 resolver `assertPositiveNumber` throw 가 전파돼 update dispatch(및 argv) 미산출(비정상 number 가 edit 대상으로 새는 것 차단) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (leg outcome, run, stdout) 로 chain 을 두 번 실행 → 두 plan.argv 가 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유) 1+ test. AND plan.argv 를 mutate(push/splice/`argv[1]` 변경) 해도 다음 chain 호출 결과·plan.action 에 누설 0 1+ test. AND chain 호출이 commandArgs(중첩 createArgs/updateArgs 포함)·run·stdout(문자열 불변) 을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(...))` snapshot deep-equal) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — create·update plan.argv 의 어느 원소도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘를 담지 않음(정규식/`not.toContain`, R-59 / REQ-059) 1+ test. `argv[0..1]`(verb) 원소가 순수 명령 토큰(`issue`/`create`/`edit`)만 담고 credential·raw github API 토큰·실 활동 본문 미포함 1+. resolver/파서 guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) 을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- descriptor / command-args 빌더 / action resolver(dispatch 술어·최소 number 선택 포함) / gh-argv 빌더(create→"create"/update→"edit" 매핑) / gh-command-plan 컴포저 **본문 변경 금지** — import·호출만. 각 배선(술어 분기·verb 매핑·컴포저 3단계 위임)은 **이미 main 에 T-0896~T-0902 로 박제됨** — 재배선 금지, chain 통과 산출물의 dispatch·verb 를 대조하는 smoke 그물만.
- 형제 T-0927 의 **고정 hit stdout 하 각 분기 argv byte-identical(buildGhArgv 산출 정합)** 축 재단언 금지 — 본 task 는 dispatch **술어 경계 sweep**(empty vs 비매칭 hit vs 매칭 hit)과 action↔verb 비대칭 매핑.
- 형제 T-0932/T-0933 의 **field 존재/부재(labels create-only / issueNumber update-only orthogonality)** 축 재단언 금지 — 본 task 는 field 를 어느 분기로 보낼지의 **branch-selection 판단**.
- 형제 T-0922 의 **cross-publish create→update 상태 전이(M threading)** 축 재단언 금지 — 본 task 는 단일 publish 안의 dispatch 술어→verb 관통.
- 형제 T-0930/T-0931 의 title·body cross-branch·T-0928/T-0929 의 marker cross-call·T-0920 의 issueNumber execute-side closure·T-0924/25/26 의 value-consistency 축 자체 재단언 금지.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github·실 gh `execFile('gh', argv)`·`gh issue create|edit`/`gh search issues`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). gitSha/dateToken·leg outcome·search stdout·N 은 synthetic literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, 종단 컴포저를 (1) 빈 search `"[]"` (2) marker-미매칭 hit stdout (3) marker-매칭 hit stdout 세 입력에 각각 적용한 뒤, `plan.action.action` 과 `plan.argv[0..1]` 을 추출해 (1)·(2)는 create/`["issue","create"]`, (3)는 update/`["issue","edit"]` 로 dispatch 됨을 대조하는 합성 smoke 작성. 핵심: argv[0]==="issue" 두 분기 불변·argv[1] 유일 discriminant·update→"edit" 비대칭 매핑(update→"update" 아님)·비매칭 hit → 여전히 create(술어 = body-marker 포함, 응답 non-emptiness 아님)·run/leg outcome 무관 dispatch 안정·복수 매칭 hit 여도 단일 update dispatch·single-source 독립 재유도(action.action → verb 매핑)·dispatch drift/verb-name 오매핑 `not.toEqual`·marker/파서/number guard 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. 축은 create-or-update action→verb dispatch 의 술어-단일-source 관통 + argv[1] discriminant 비대칭 매핑.)

## Follow-ups

(없음 — action-verb dispatch single-source 가 봉합되면 dual-leg run report step④ 의 두 축이 모두 chain 그물에 편입: field medium(title/body cross-branch T-0930/T-0931, labels/issueNumber orthogonal T-0932/T-0933)과 그 field 를 어느 분기로 보낼지 결정하는 branch-selection(dispatch T-0934). 잔여는 step④ live wiring(credential gate deferred, ADR-0045 LAN gate) — 다음 turn 의 planner 가 PLAN 재평가로 판단)

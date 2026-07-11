---
id: T-0922
title: realdata-e2e dual-leg run report 같은 run 을 두 번 publish 할 때 1차 publish(빈 검색→create)의 create-output issueNumber M 이 2차 publish 의 search-hit 로 다시 관통해 resolve 가 그 동일 M 을 update(신규 create 아님)로 좁힘을 박제하는 re-publish create→update state-transition idempotency non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-republish-create-update-idempotency-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-republish-idempotency-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — re-publish create→update state-transition idempotency sweep(1차 publish 빈 검색→create argv·create-output issueNumber M 파싱·M 을 2차 publish search-hit 로 threading·2차 resolve→update.issueNumber===M·editArgv[2]===String(M)·같은 marker 로 두 cycle 검색 매체 불변·1↔2 publish 산출 배열 격리·multi-cycle 멱등(3회째 재-publish 도 동일 M update)·negative 분기 다수·결정론/no-mutation/credential) test-dominated ~290 LOC. 형제 T-0921(dual-medium orthogonal, 단일 publish 내 두 매체 직교)/T-0920(execute-side issueNumber)/T-0919(search-side marker) 는 create/update 분기를 서로 독립 주입 — 본 task 는 1차 create-output 을 2차 search-input 으로 threading 하는 cross-publish 상태 전이. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0921 medium-convergence 캡스톤 후 REQ-009 멱등(동일 run→기존 이슈 찾아 갱신)의 create→update cross-publish 상태 전이가 미결합한 gap. dep [] file-disjoint stage5b 병렬.
---

# T-0922 — realdata-e2e dual-leg run report re-publish create→update state-transition idempotency non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)** 의 핵심 계약은 REQ-009 **멱등성** — "동일 run 의 기존 이슈를 찾아 갱신"(신규 이슈를 중복 생성하지 않음) 이다. 이 멱등은 한 번의 publish chain 안이 아니라 **두 번의 연속 publish cycle 에 걸친 상태 전이**로만 성립한다:

- **1차 publish** — 아직 이슈가 없으므로 marker 검색은 **빈 hit** 을 반환한다 → resolve 가 `create` 분기로 좁히고 `gh issue create ...` argv 를 낸다. 이 create 를 실행하면 github 이 새 이슈 번호 **M** 을 URL(`.../issues/M`)로 돌려주고, output-parse 가 그 M 을 `{issueNumber: M}` 로 뽑는다.
- **2차 publish (같은 run 재-publish)** — 1차가 만든 이슈(번호 M)는 **같은 marker 를 body 에 담고 있으므로**, 이번엔 marker 검색이 **번호 M 인 hit** 을 반환한다 → resolve 가 `update` 분기로 좁히고 `plan.action.update.issueNumber === M`, `plan.argv[2] === String(M)`(=`gh issue edit M ...`) 를 낸다. 즉 2차는 1차가 만든 **그 이슈 M 을 정확히 갱신**하며 새 이슈를 만들지 않는다.

이 **create→update 상태 전이** — 1차 create-output 의 issueNumber M 이 2차 search-input 으로 다시 관통해 2차가 동일 M 을 update 로 좁히는 threading — 이 REQ-009 멱등성의 실체다. 그런데 기존 형제 smoke 들은 create 분기와 update 분기를 **서로 독립적으로 주입**해 각 분기의 argv 구조만 닫았을 뿐, **1차 publish 의 산출을 2차 publish 의 입력으로 실제로 연결**한 cross-publish 상태 전이는 한 chain 에 결합되지 않았다:

- **T-0921** (dual-medium orthogonal convergence) — 단일 publish 안에서 marker(search 매체)·issueNumber(edit 매체)의 직교를 박제하고 create 분기 격리(빈 검색→create, issueNumber 원소 부재)를 단언했으나, create-output 의 M 을 후속 publish 의 search-hit 로 threading 하지는 않는다(create 와 update 를 같은 run 의 두 cycle 로 잇지 않음).
- **T-0920** (execute-side issueNumber medium) — 주어진 search-hit N 으로부터 update.issueNumber·editArgv[2] 수렴만. hit 의 N 이 **어디서 왔는지**(=1차 create-output)는 무관하게 synthetic 주입.
- **T-0913** (round-trip) — descriptor↔searchQuery round-trip 이지 create→update 상태 전이가 아님.

즉 **멱등성 회귀** — 같은 run 을 두 번 publish 했을 때 2차가 (a) 새 create 로 좁혀 이슈를 중복 생성하거나, (b) 1차와 **다른** 번호를 update 하는 — 는 public CI 에서 직접 발화되지 않고, 각 분기를 독립 통과하는 기존 smoke 로는 잡히지 않는다(1↔2 cycle 을 잇는 threading 이 어디에도 없으므로). 본 task 는 `report → descriptor → commandArgs → searchArgv → resolve → gh-argv → output-parse` chain 을 **같은 run 으로 두 번(그리고 멱등 확인용 3번째) 통과**시키되 1차 create-output 의 issueNumber M 을 **2차 search-input 의 hit number 로 연결**해, "1차 create → 2차 이후는 그 동일 이슈 M 을 update"라는 REQ-009 멱등 상태 전이를 public CI 그물로 박제한다.

issue-still-relevant 확인(2026-07-11): dual-leg-run-report smoke 10개 중 **1차 publish 의 create-output issueNumber 를 2차 publish 의 search-hit 로 threading 해 create→update 상태 전이 멱등**을 박제하는 파일 0 — 전부 create/update 를 독립 주입. `git log origin/main` 동일 영역(cross-publish 멱등 상태 전이) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0921-realdata-e2e-dual-leg-run-report-dual-medium-searchargv-marker-editargv-issuenumber-orthogonal-convergence-smoke.md` — 직전 형제(dual-medium orthogonal). chain assembler·synthetic 빌더(searchStdout·execStdout)·import 경로 규약·describe 구조 mirror 1순위 템플릿. 본 task 는 그 dual-medium 직교/create 분기 격리 **자체 재단언 금지** — 초점을 단일 publish 내 직교에서 **두 publish cycle 을 잇는 create→update 상태 전이**로 이동.
- `docs/tasks/T-0920-realdata-e2e-dual-leg-run-report-edit-argv-resolve-output-parse-issuenumber-medium-execute-side-single-source-closure-assembly.smoke-spec.ts` 소스 파일 경로 참고용(T-0920 task 문서) — issueNumber→editArgv[2]·output-parse 수렴 자체 재단언 금지(T-0920 cover). 본 task 는 그 M 의 **출처가 1차 create-output** 임을 threading.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}. 두 cycle 모두 **동일 run** 으로 report 합성.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary. `{title, marker, body}`, marker = private prefix + `${report.dateToken}@${report.gitSha}`(runToken). prefix 는 private const(export 0) — 구조적 단언(marker 안에 `${dateToken}@${gitSha}` 포함)만, literal 하드코딩 금지. gitSha/dateToken 빈/공백 → 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → searchQuery 운반 layer(`searchQuery === descriptor.marker`). chain 조립 입력으로만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — search-gh-argv `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `["search","issues",...,<searchQuery=marker>,...]`. 원소 순서/`--match body`/`--limit` 형식 재단언 금지 — 두 cycle 의 searchArgv 안 marker 원소 불변만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — searchStdout JSON 배열 형식(`[{"number": N, "title": ..., "body": <marker 포함>}]`) synthetic 합성용. **빈 hit(`"[]"`) = 1차, number=M hit = 2차** 합성의 핵심.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — resolve 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`. 빈 hit → `create` 분기(`argv=["issue","create",...]`), hit 1+ → `update` 분기(`argv=["issue","edit",String(issueNumber),...]`, `action.update.issueNumber`).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` — argv 빌더. update 분기 → `argv[2]===String(issueNumber)`, create 분기 → issueNumber 원소 부재. title/body/labels 형식 재단언 금지.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` = `{action:'create'} | {action:'update', issueNumber}`. narrowing 경로.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — post-boundary 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `{issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`) throw·raw 미저장(R-59). **1차 create-exec 의 URL 에서 뽑은 M 이 2차 search-hit number 로 재사용**되는 threading 축.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-republish-create-update-idempotency-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). issueNumber M 은 chain 산출(1차 create-output 파서 결과)에서 뽑아 2차 search-hit 로 threading — literal 하드코딩 금지. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·create→update cross-publish 상태 전이 절단면·REQ-009 멱등·형제 T-0921/T-0920/T-0919 와의 차별=cycle threading) 작성.

- [ ] **Happy-path 1차 publish create test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. 1차 chain: `report → descriptor → commandArgs → searchArgv → searchStdout1=빈 hit("[]") → plan1 = resolve(searchStdout1, commandArgs)` → `plan1.action.action === "create"` AND `plan1.argv[0]==="issue"` AND `plan1.argv[1]==="create"` AND **issueNumber 원소 부재**(argv 어느 원소도 뒤 단계 M 과 매칭 안 함) happy test 1+. create-exec output stdout(`https://github.com/owner/repo/issues/M`, M = 임의 양수)에 `parse...IssueCreateEditOutput` 적용 → `{issueNumber: M}` 정상 추출 test 1+.
- [ ] **핵심 threading — 2차 publish update test 1+ (state transition)** — 1차와 **동일 run·동일 leg outcome** 으로 chain 재조립하되, 2차 `searchStdout2` 를 **1차 create-output 의 M 을 number 로, descriptor.marker 를 body 에 담은 hit**(`[{"number": M, "title": ..., "body": <marker 포함>}]`)로 합성 → `plan2 = resolve(searchStdout2, commandArgs)` → (a) `plan2.action.action === "update"` AND (b) `plan2.action.update.issueNumber === M`(1차가 만든 그 번호) AND (c) `plan2.argv[2] === String(M)`(=`gh issue edit M`) 를 **한 test 안에서 동시에** 단언 1+ test. 즉 2차 publish 는 새 create 가 아니라 1차가 만든 이슈 M 을 정확히 update.
- [ ] **검색 매체 불변 단언 (idempotency — searchArgv 두 cycle 동일)** — 1차·2차 chain 의 `searchArgv` 는 서로 **deep-equal**(같은 marker 로 검색; 검색 매체는 hit 유무·상태 전이와 무관하게 불변) 1+ test. 즉 상태 전이(create→update)는 **검색 argv 를 바꾸지 않고** resolve 산출(action/edit-argv)만 바꾼다.
- [ ] **중복 생성 부재 단언 (idempotency 핵심 — 신규 create 아님)** — 2차 `plan2.argv[1] !== "create"`(즉 `plan2.argv` 는 `["issue","create",...]` 형태가 아님) AND `plan2.action.action !== "create"` 1+ test. 같은 run 재-publish 가 두 번째 이슈를 만들지 않음을 명시 박제.
- [ ] **multi-cycle 멱등 단언 (3회째도 동일 M)** — 2차와 동일하게 `searchStdout3`(number=M, 같은 marker hit)로 3차 chain 호출 → `plan3.action.update.issueNumber === M` AND `plan3.argv[2] === String(M)` AND `plan3.argv` 가 `plan2.argv` 와 deep-equal(같은 run·같은 M·같은 leg → editArgv byte-identical) 1+ test. N≥2 번째 이후 재-publish 는 모두 같은 M 을 향한 안정 fixed-point 임을 박제.
- [ ] **leg outcome 무관 — 상태 전이 축 격리 단언 (branch)** — 동일 run·동일 M 고정 + leg outcome 조합(eval pass/collect pass vs eval fail/collect skip)만 다르게 두 2차-publish chain 호출 → 두 chain 의 `plan.action.update.issueNumber === M` AND `plan.argv[2] === String(M)` 동일(상태 전이·타겟 이슈는 leg status 무관) 1+ test. (updateArgs.title/body 의 leg 반영 변별은 out-of-scope — 상태 전이 타겟 M 불변만.)
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) `run.gitSha` 빈/공백 → descriptor(stage 1) guard throw 로 1차 chain 시작 차단 1+ test.
  - (b) `run.dateToken` 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도) 1+ test.
  - (c) 1차 create-output stdout 이 issue URL 미발견(빈/무관/비-github/`/pull/`) 또는 issueNumber 비양수(`/issues/0`·선행0) → `parse...IssueCreateEditOutput` throw 각 1+ test(URL-미발견 분기와 비양수 분기 분리) — 잘못된 M 이 2차 search-hit 로 threading 되는 것 자체를 원천 차단.
  - (d) 2차 `searchStdout2` 가 비양수 number(`[{"number": 0, ...}]`) 또는 비JSON/비배열(`"not json"`) → resolve(stage 4) 위임 throw 각 1+ test(비정상 number 가 update.issueNumber/editArgv 원소로 새는 것 차단).
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout1/2, execStdout) 입력으로 1↔2차 threading chain 전체를 두 번 호출 → 두 번의 plan1/plan2(및 M) 가 deep-equal(byte-identical, `searchArgv`·`plan.argv` 배열 포함) 1+ test. AND 입력 객체(run, leg outcome)·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, `JSON.parse(JSON.stringify(...))` snapshot 대조) 1+ test. AND 1차·2차 `plan.argv`/`searchArgv` 배열이 서로 및 입력과 referential identity 분리(`not.toBe`).
- [ ] **raw / credential 누출 0 test 1+** — 두 cycle 어디에서도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘가 descriptor.{title,marker,body} / commandArgs.searchQuery / searchArgv(배열 전체) / plan1.argv·plan2.argv(배열 전체) / output.{url} 어느 문자열에도 미등장(정규식/`not.toContain`, R-59 / REQ-059). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 argv 표면에 sentinel 미누출 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma` 변경 0. 새 외부 dependency 0.
- 형제 dual-medium orthogonal smoke(T-0921)의 단일 publish 내 marker↛editArgv[2]·issueNumber↛searchArgv 직교/source 독립(run→marker변·hit→issueNumber변) **자체 재단언 금지** — 본 task 는 두 publish cycle 을 잇는 create→update 상태 전이만.
- 형제 execute-side smoke(T-0920)의 issueNumber→editArgv[2] byte-identical·4지점 수렴, search-side smoke(T-0919)의 marker→searchArgv 원소·검색 매체 관통 **자체 재단언 금지** — 본 task 는 M 의 출처가 1차 create-output 임을 threading 하는 축만.
- 형제 triple-boundary(T-0918)·round-trip(T-0913)·forward assembly(T-0912)·markdown(T-0914)·descriptor confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘. searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만. value-consistency 가드 sweep 은 T-0911 에서 종결.
- 실 github 재-publish 부작용(실제 이슈 생성/갱신)·실 gh `execFile('gh', argv)`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). create-exec 의 URL·M 은 synthetic stdout literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv → resolve → gh-argv → output-parse 를 **같은 run 으로 두(그리고 세) cycle** 호출하는 합성 smoke 작성. 핵심: 1차 빈 검색→create→create-output 파서로 M 추출 → M 을 2차 search-hit number 로 threading → 2차 resolve 가 update.issueNumber===M·editArgv[2]===String(M) 로 좁힘. 검색 매체 불변(searchArgv 두 cycle deep-equal)·중복-create 부재·multi-cycle fixed-point·leg 무관·negative(descriptor guard·create-output throw·2차 비정상 number)·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정.)

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)

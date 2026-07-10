---
id: T-0898
title: realdata-e2e daily-step dual-leg run report 이슈 search response → create-or-update action 순수 resolver 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts
plannerNote: "P5 §109 step④ — T-0897 명령-args 다음 자연 경계(분기 layer, T-0584 mirror). gh search hits+marker → create vs update action 순수 resolver. 실 gh 호출 deferred. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0898 — realdata-e2e daily-step dual-leg run report 이슈 search response → create-or-update action 순수 resolver 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

dual-leg run report 축의 build-time chain 은 이미 (1) 두 leg run outcome → `RealDataDailyStepDualLegRunReport` 순수 컴포저(T-0894) → (2) 그 report → 결정론적 마크다운 본문 렌더러(T-0895) → (3) 그 report → rolling-issue 식별자/본문 `RealDataDailyStepDualLegRunReportIssueDescriptor`{title, marker, body} 순수 빌더(T-0896) → (4) 그 descriptor → gh issue 멱등 명령-args `RealDataDailyStepDualLegRunReportIssueCommandArgs`{searchQuery, createArgs, updateArgs} 순수 빌더(T-0897)까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 분기 layer** — 를 순수 함수로 분해한다.

T-0897 의 Out of Scope 는 "search-or-update 의 실 분기 실행(기존 이슈 존재 여부 판단·실 issue number 해석 — 본 helper 는 create/update 양쪽 args 를 모두 산출만; 어느 쪽을 실행할지는 caller 의 live wiring 책임)" 을 명시했다. 본 task 는 그 분기 결정의 **순수 부분**을 분해한다 — 이는 summary 축의 선례와 정확히 동형이다: summary 축은 T-0583(명령-args) 다음에 **T-0584** 로 `resolveRealDataResultIssueAction(searchHits, marker)` 를 추가해 gh search 응답 + marker → create vs update action 분기를 순수 함수로 박제했다. dual-leg 축은 명령-args(T-0897)까지만 있고 그 분기 layer(T-0584 mirror)가 없다. 본 task 가 그 gap 을 메운다.

본 task 는 순수 함수 `resolveRealDataDailyStepDualLegRunReportIssueAction(searchHits: RealDataDailyStepDualLegRunReportIssueSearchHit[], marker: string): RealDataDailyStepDualLegRunReportIssueAction` 을 추가한다. 입력 `searchHits` 는 `gh search issues --json number,title,body` 응답의 최소 shape(`{number: number, title: string, body: string}[]`) 이고, `marker` 는 T-0896 descriptor 의 멱등 marker 다. 동작:

- 후보(`searchHits` 중 `body` 가 marker 문자열을 부분 문자열로 포함하는 hit) 0건 → `{action: 'create'}`(신규 생성).
- 후보 1건 → `{action: 'update', issueNumber: <그 hit 의 number>}`(기존 이슈 갱신).
- 후보 2건 이상 → `{action: 'update', issueNumber: <가장 작은 number — 가장 오래된 이슈>}`(멱등 회귀 보호 — gh search 가 우연히 marker 매칭 이슈 다수 반환했을 때도 최초 박제분에 누적 갱신, 이슈 중복 방지).

caller(live wiring)는 (1) `gh search issues --json number,title,body` 를 실 호출해 JSON 응답을 얻고, (2) 본 resolver 에 그 응답 + marker 를 입력해 action 을 받고, (3) action 에 따라 T-0897 의 createArgs / updateArgs 중 하나로 `gh issue create` 또는 `gh issue edit <issueNumber>` 를 실행한다. 본 helper 는 (2) 만 순수 함수로 박제한다 — 실 gh 호출은 여전히 deferred.

실 gh search issues 호출 / `deploy/daily-test.sh` step wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 분기 resolver 라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0897-realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.md` — 직전 chain slice(명령 layer)의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션. 본 task 가 그 Out of Scope "search-or-update 의 실 분기 실행" 의 **순수 분기 결정 slice** 임을 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts`(T-0897) — 명령 layer 의 createArgs / updateArgs / searchQuery shape(`RealDataDailyStepDualLegRunReportIssueCommandArgs` / `...IssueCreateArgs` / `...IssueUpdateArgs`) 확인. 본 resolver 의 action 이 caller 단에서 그 args 중 하나의 선택을 결정함을 mirror. 단 본 resolver 는 이 helper 를 import 하지 않는다(분리 책임 — marker 를 문자열로만 봄).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`(T-0896) — marker 의 생성 규칙(안정 합성) 확인. 본 resolver 는 marker 가 어떻게 만들어졌는지 알 필요 없이 **문자열로서의 marker** 만 보고 body 안 포함 여부로 매칭한다(분리 책임 — descriptor 타입 import 불요).
- `docs/tasks/T-0584-realdata-e2e-result-issue-action.md` — summary 축의 동형 선례(`resolveRealDataResultIssueAction(searchHits, marker)` → create-or-update action discriminated union). marker 부분 매칭·후보 0/1/다수 분기·최소 번호 멱등 회귀·빈/공백 marker guard·음수/0 number guard·결정론·무공유·mutate 0·R-59 정합·dependency-free 서술 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-result-issue-action.ts` + colocated spec(T-0584) — 분기 resolver + colocated `.spec.ts` R-112 4 종(happy/error/branch/negative) + 후보 0/1/다수·guard·결정론·무공유 단언 패턴의 mirror 템플릿.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 resolver 가 body 안의 marker 라인만 보고(narrative 본문·raw 미참조) 분기를 결정함을 확인.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts`(순수 resolver) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts`. production `src/`·T-0894 컴포저·T-0895 렌더러·T-0896 descriptor·T-0897 명령-args·기존 summary-축 helper 수정 0.
- [ ] **resolver 신설** — `resolveRealDataDailyStepDualLegRunReportIssueAction(searchHits: RealDataDailyStepDualLegRunReportIssueSearchHit[], marker: string): RealDataDailyStepDualLegRunReportIssueAction` 순수 함수. 산출 action 은 `{action: 'create'}` 또는 `{action: 'update', issueNumber: number}` 의 discriminated union. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **신규 타입 최소 정의** — 입력 `RealDataDailyStepDualLegRunReportIssueSearchHit`(`{number: number, title: string, body: string}` — `gh search issues --json number,title,body` 최소 shape) + 출력 `RealDataDailyStepDualLegRunReportIssueAction` discriminated union 만 정의. T-0896 descriptor / T-0897 명령-args 타입 import 불요(본 resolver 는 marker 를 문자열로만 봄 — 분리 책임 명시).
- [ ] **marker 매칭 정책 (정확 포함)** — hit 의 `body` 가 marker 문자열을 **부분 문자열로 포함**(`body.includes(marker)`)하면 후보로 분류. marker 가 빈/공백이면 명시적 throw(전체 매칭 사고 차단).
- [ ] **후보 0건 → create 분기** — `searchHits` 가 빈 배열이거나, 모든 hit 의 body 가 marker 미포함이면 `{action: 'create'}` 반환. spec 으로 (a) 빈 배열, (b) hit 1건이지만 body marker 미포함, (c) hit 다수지만 모두 marker 미포함 각각 검증.
- [ ] **후보 1건 → update 분기** — 매칭 hit 1건이면 `{action: 'update', issueNumber: <그 number>}` 반환. spec 으로 검증.
- [ ] **후보 다수 → 최소 번호 update (멱등 회귀 보호)** — 매칭 hit 2+ 면 `issueNumber = Math.min(...candidates.map(h => h.number))`(가장 오래된 이슈). 신규 만들지 않고 항상 최초 박제분에 누적 갱신. spec 으로 (a) 2건, (b) 3건 (순서 섞임) 각각 검증.
- [ ] **Happy-path unit test 1+** — (a) 빈 `searchHits` → create, (b) 매칭 hit 1건 → update(그 number), (c) 매칭 hit 2건 (number 200, 100) → update(100, 최소값), 각각 검증.
- [ ] **Error path unit test 1+** — 각 guard 분기 별도 case: (a) 빈 `marker` throw, (b) 공백-only `marker` throw, (c) hit `number` = 0 throw, (d) hit `number` = -1 throw. 조용한 통과 0. 단일 negative 만으로 부족(필드별·종류별 분기마다 cover).
- [ ] **Flow / branch cover** — guard 분기(marker 빈/공백, number 0 이하) + 후보 0 / 1 / 다수 정상 분기 각 1+ test. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) **결정론적 출력** — 동일 `searchHits`+`marker` 두 번 호출 시 결과 byte-identical(시각·랜덤·env 의존 0), (b) **입력 순서 불변** — 후보 다수 시 입력 배열 순서를 섞어도 동일 issueNumber(최소값) 산출, (c) **입력 mutate 0** — 호출 후 입력 `searchHits` 배열 길이·각 hit 의 키·값이 호출 전과 deep-equal(읽기만), (d) **무공유** — 반환 action 은 매번 새 객체, (e) **음수/0 number guard 회귀** — 정상 hit 사이에 number ≤ 0 인 hit 이 섞여도 throw — 각 1+ test.
- [ ] **R-59 정합** — 본 resolver 는 hit 의 body 를 marker 포함 여부 판정에만 쓰고 **반환하지 않는다**(action descriptor 에 body / title 보유 0 — issueNumber 만). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh search 는 deferred(본 helper 는 분기 결정만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh issue 호출(`gh issue create`/`edit`/`list`/`search`) / 실 JSON 파싱(`--json` 합성·stdout 디코딩) / 실 jest spawn / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리 0. 순수 배열/문자열 로직만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — 신규 import 없음(타입 자급).
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 resolver 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts`(T-0897 명령-args spec·summary-축 action spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 gh 이슈 호출(`gh search issues`/`gh issue list`/`create`/`edit` 실 실행) / credential wiring** — 본 task 는 (search hits + marker) → action 순수 함수만. live wiring 은 credential gate 별도 slice.
- **gh search response 의 실 JSON 파싱 / `--json` 옵션 합성 / stdout 디코딩** — caller(live wiring)가 `gh ... --json number,title,body` 결과를 `JSON.parse` 해서 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 로 본 resolver 에 전달하는 책임.
- **명령-args 합성 자체(T-0897 위임만 — searchQuery/createArgs/updateArgs 재합성 금지)** — 본 resolver 는 action 분기 + issueNumber 결정만.
- **title 매칭 / labels 매칭** — marker(body 안의 안정 문자열) 단일 기준만. 본 resolver 는 title/labels 를 참조하지 않는다(분리 책임 — 멱등은 marker 가 책임).
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor / T-0897 명령-args 수정 / marker·title·body 재계산·재렌더** — 이미 확정. 본 resolver 는 marker 문자열 매칭만.
- **summary 축(T-0580~T-0584) / 단일 issue-post outcome-report(T-0590) 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 분기 layer 신설만.
- **repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth** — 실 wiring 의 환경 책임.
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

## 완료 기록

- **DONE** 2026-07-10T22:52Z — PR #792 squash-merge `5100f201`. 순수 resolver `resolveRealDataDailyStepDualLegRunReportIssueAction`(search hits + marker → create/update action discriminated union) + colocated spec 19 test(신규 파일 line/branch/func/stmt 100%). 후보 0→create, 1+→최소 number update(멱등 회귀 보호). marker 빈/공백·number 0이하/비정수 guard throw. dep0, descriptor/명령-args import 0, process.env 0. reviewer APPROVE round 1/7(0 BLOCKER·0 MAJOR·1 MINOR), 4-게이트 PASS. CI: pull_request run 은 실 step(lint/build/test+cov/smoke/e2e/perf) 전원 green, reviewer-approval step 만 comment-전 race 로 red → issue_comment 재실행 green(benignRedNote case B). fineGrainedConcurrency ON(stage 5b) claim-pickup fire(cron@aa-local-90975d7b).

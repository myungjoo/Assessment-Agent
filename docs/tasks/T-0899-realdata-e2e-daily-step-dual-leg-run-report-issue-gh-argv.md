---
id: T-0899
title: realdata-e2e daily-step dual-leg run report 이슈 action + 명령-args → gh 인자-벡터 순수 빌더 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts
plannerNote: "P5 §109 step④ — T-0898 action resolver 다음 자연 경계(gh argv layer, T-0585 mirror). action+commandArgs → gh issue create/edit argv string[]. 실 gh 실행 deferred. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0899 — realdata-e2e daily-step dual-leg run report 이슈 action + 명령-args → gh 인자-벡터 순수 빌더 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

dual-leg run report 축의 build-time chain 은 이미 (1) 두 leg run outcome → `RealDataDailyStepDualLegRunReport` 순수 컴포저(T-0894) → (2) 그 report → 결정론적 마크다운 본문 렌더러(T-0895) → (3) 그 report → rolling-issue 식별자/본문 `...IssueDescriptor`{title, marker, body} 순수 빌더(T-0896) → (4) 그 descriptor → gh issue 멱등 명령-args `...IssueCommandArgs`{searchQuery, createArgs, updateArgs} 순수 빌더(T-0897) → (5) gh search hits + marker → create-or-update `...IssueAction` 순수 resolver(T-0898)까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 마지막 build-time layer** — 를 순수 함수로 분해한다.

이는 summary 축의 선례와 정확히 동형이다: summary 축은 T-0584(action resolver) 다음에 **T-0585** 로 `buildRealDataResultIssueGhArgv(action, commandArgs)` 를 추가해 action + 명령-args 를 결합한 **실제 `gh` 명령 인자-벡터(argv)** 를 순수 함수로 박제했다. dual-leg 축은 action resolver(T-0898)까지만 있고 그 argv layer(T-0585 mirror)가 없다. 본 task 가 그 gap 을 메운다.

본 task 는 순수 함수 `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action: RealDataDailyStepDualLegRunReportIssueAction, commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): string[]` 을 추가한다. 동작:

- `action.action === 'create'` → `gh issue create` argv: `["issue", "create", "--title", createArgs.title, "--body", createArgs.body, "--label", "<label1>", "--label", "<label2>", ...]`(labels 는 각각 별도 `--label` flag pair 로 순서 보존 전개).
- `action.action === 'update'` → `gh issue edit` argv: `["issue", "edit", String(issueNumber), "--title", updateArgs.title, "--body", updateArgs.body]`.

argv 는 `gh` 실행 파일 이름을 포함하지 않는다(caller 가 `execFile('gh', argv)` 형태로 분리 전달 — 인젝션 방지·인자 분리). 결정론적(동일 입력 → byte-identical argv), 입력 mutate 0·무공유, R-59 정합(body 는 descriptor 가 만든 본문 그대로 — narrative/raw 본문은 애초에 입력에 부재).

caller(live wiring)는 (1) T-0897 명령-args + (2) T-0898 action 을 본 빌더에 입력해 완성된 argv 를 받고, (3) 그 argv 를 `execFile('gh', argv)` 로 실 호출한다. 본 helper 는 (3) 직전의 argv 합성만 순수 함수로 박제한다 — 실 `gh` 실행 / `gh search issues` / `deploy/daily-test.sh` step wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 argv 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0898-realdata-e2e-daily-step-dual-leg-run-report-issue-action.md` — 직전 chain slice(분기 layer)의 패턴·범위 경계·Out of Scope 표기 컨벤션. 본 task 가 그 action 산출물의 **소비 slice** 임을 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` discriminated union(`{action:'create'}` | `{action:'update', issueNumber}`) 의 정확한 shape. 본 빌더가 이 타입을 `import type` 재사용(중복 정의 금지).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `RealDataDailyStepDualLegRunReportIssueCommandArgs`(`{searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body}}`) shape(`...IssueCreateArgs`/`...IssueUpdateArgs` 포함). 본 빌더가 이 타입을 `import type` 재사용하고, create argv 는 createArgs 를, update argv 는 updateArgs 를 소비함을 mirror.
- `docs/tasks/T-0585-realdata-e2e-result-issue-gh-argv.md` + `test/helpers/realdata-e2e-result-issue-gh-argv.ts`(+ colocated spec) — summary 축의 동형 선례(`buildRealDataResultIssueGhArgv(action, commandArgs) → string[]`). create/update 분기·labels flag-pair 전개·issueNumber/title/body guard·인자 분리(인젝션 방지)·결정론·무공유·R-59 정합·dependency-free 서술 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 빌더가 body/title 을 그대로 argv 로 전달할 뿐 raw 를 추가하지 않음을 확인.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts`(순수 빌더) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts`. production `src/`·T-0894 컴포저·T-0895 렌더러·T-0896 descriptor·T-0897 명령-args·T-0898 action·기존 summary-축 helper 수정 0.
- [ ] **빌더 신설** — `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action: RealDataDailyStepDualLegRunReportIssueAction, commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): string[]` 순수 함수. 반환은 `gh` 실행 파일명을 **제외한** 인자-벡터(`string[]`). enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataDailyStepDualLegRunReportIssueAction` 은 `./realdata-e2e-daily-step-dual-leg-run-report-issue-action` 에서, `RealDataDailyStepDualLegRunReportIssueCommandArgs` 는 `./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args` 에서 `import type` 재사용. 신규 타입 정의 없음(본 빌더는 두 기존 타입을 입력받아 `string[]` 만 산출).
- [ ] **create 분기 argv** — `action.action === 'create'` 면 `["issue", "create", "--title", <createArgs.title>, "--body", <createArgs.body>, ...labels 전개]` 반환. labels 는 각 원소를 `"--label", <label>` flag pair 로 순서 보존 전개(예: labels=["a","b"] → `..., "--label", "a", "--label", "b"`). spec 으로 (a) labels 2건, (b) labels 빈 배열(--label 0개), (c) labels 1건 각각 검증.
- [ ] **update 분기 argv** — `action.action === 'update'` 면 `["issue", "edit", String(issueNumber), "--title", <updateArgs.title>, "--body", <updateArgs.body>]` 반환. issueNumber 는 `String(...)` 으로 문자열화(argv 는 string[]). spec 으로 검증.
- [ ] **issueNumber guard(update 분기)** — update action 의 `issueNumber` 가 양의 정수가 아니면(0 이하·비정수) 명시적 throw(비정상 number 가 argv 로 새는 것 차단). spec 으로 0 / 음수 / 비정수(예: 1.5) 각각 별도 case 검증.
- [ ] **title/body 빈/공백 guard** — create / update 어느 분기든 사용되는 title 또는 body 가 빈 문자열·공백-only 면 명시적 throw(비식별 이슈 argv 생성 차단). spec 으로 create.title 빈, create.body 빈, update.title 빈, update.body 빈 각각 검증(필드별 분기마다 cover).
- [ ] **Happy-path unit test 1+** — (a) create action + labels 2건 → 올바른 create argv, (b) update action(issueNumber 42) → 올바른 edit argv, 각각 검증.
- [ ] **Error path unit test 1+** — (a) update issueNumber=0 throw, (b) update issueNumber=-1 throw, (c) update issueNumber=1.5 throw, (d) create title 빈 throw, (e) create body 공백-only throw, (f) update title 빈 throw — 각각 별도 case. 조용한 통과 0. 단일 negative 만으로 부족(필드별·종류별 분기마다 cover).
- [ ] **Flow / branch cover** — create 분기 / update 분기 + 각 guard 분기(issueNumber, title, body) 각 1+ test. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) **결정론적 출력** — 동일 `action`+`commandArgs` 두 번 호출 시 argv 가 원소·순서까지 byte-identical(시각·랜덤·env 의존 0), (b) **인자 분리 정합** — 반환 argv 에 `gh` 실행 파일명 미포함(argv[0] === "issue"), title/body 값에 공백·특수문자(예: body 에 `"; rm -rf"`)가 들어가도 단일 argv 원소로 유지(shell 문자열 합성 0 → 인젝션 불가), (c) **입력 mutate 0** — 호출 후 입력 `action`/`commandArgs`(중첩 createArgs.labels 배열 포함)가 호출 전과 deep-equal(읽기만), (d) **무공유** — 매 호출 새 argv 배열 반환(반환 배열 mutate 가 입력 labels 에 누설 안 됨) — 각 1+ test.
- [ ] **R-59 정합** — 본 빌더는 commandArgs 의 title/body 를 그대로 argv 로 옮길 뿐 raw 활동 본문·narrative 를 추가하지 않는다(애초에 입력에 부재). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh 실행은 deferred(본 helper 는 argv 합성만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행(`execFile('gh', ...)`/`gh issue create`/`edit`/`search`) / 실 JSON 파싱 / 실 jest spawn / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리 0. 순수 배열/문자열 로직만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — 신규 import 는 두 기존 helper 의 `import type` 만.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 빌더 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts`(T-0898 action spec·summary-축 gh-argv spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `gh` 실행 / `execFile('gh', argv)` / `gh issue create`/`edit`/`search` 실 실행 / credential wiring** — 본 task 는 (action + commandArgs) → argv 순수 합성만. live wiring 은 credential gate 별도 slice.
- **create vs update 분기 결정 자체(T-0898 resolver 위임만 — 본 빌더는 주어진 action 을 소비만; resolver 재구현 금지).**
- **명령-args 합성 자체(T-0897 위임만 — searchQuery/createArgs/updateArgs 재합성 금지)** — 본 빌더는 argv 전개만.
- **search argv 합성 / `gh search issues --json ...` 옵션 합성 / stdout 파싱** — 별도 slice(summary 축 T-0586/T-0587 mirror 후속).
- **`--repo owner/repo` 인자 / repo slug 결정 / gh auth** — 실 wiring 의 환경 책임(본 빌더는 issue create/edit 의 핵심 인자만).
- **shell 문자열 합성 / 따옴표 escape** — 본 빌더는 분리된 argv 배열만 산출(shell 미경유, escape 불요).
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor / T-0897 명령-args / T-0898 action 수정·재계산** — 이미 확정. 본 빌더는 두 산출물 결합만.
- **summary 축(T-0580~T-0590) / 단일 issue-post outcome-report 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 argv layer 신설만.
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

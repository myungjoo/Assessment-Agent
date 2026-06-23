---
id: T-0585
title: 실 평가 e2e 결과 이슈 action + 명령-args → gh 인자-벡터 순수 빌더
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-argv.ts
  - test/helpers/realdata-e2e-result-issue-gh-argv.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 마지막 build-time layer — action + 명령-args → gh issue create/edit 인자-벡터 순수 빌더. cloud-safe·dependency-free."
---

# T-0585 — 실 평가 e2e 결과 이슈 action + 명령-args → gh 인자-벡터 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 step ①(seed) → step ①→② → step ②(수집 호출-args) → step ②→③(`Activity[]` → `EvaluationInput[]`) → step ③(scoring 호출-args) → step ③→④ 경계(`RealDataResultSummary`, T-0580) → step ④ 표현 layer(마크다운, T-0581) → step ④ 식별 layer(`RealDataResultIssueDescriptor` {title, marker, body}, T-0582) → step ④ 명령 layer(`RealDataResultIssueCommandArgs` {searchQuery, createArgs, updateArgs}, T-0583) → step ④ 분기 layer(`RealDataResultIssueAction` {action:'create'} | {action:'update', issueNumber}, T-0584) 까지 박제됐다.

본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 마지막 build-time layer** — 를 순수 함수로 분해한다. T-0584 의 resolver 는 어느 분기(create/update)를 어느 이슈 번호에 실행할지 만 결정했고, T-0583 의 명령-args 는 create/update 양쪽 인자 묶음을 모두 산출했다. 두 산출물을 결합해 **실제 `gh` 명령에 그대로 넘길 인자-벡터(argv)** 를 만드는 단계가 아직 비어있다. caller(live wiring)는 (1) T-0583 명령-args + (2) T-0584 action 을 본 빌더에 입력해 완성된 argv 를 받고, (3) 그 argv 를 `execFile('gh', argv)` 로 실 호출한다. 본 helper 는 (3) 직전의 argv 합성만 순수 함수로 박제한다 — 실 `gh` 실행은 여전히 deferred(credential gate).

본 task 는 순수 함수 `buildRealDataResultIssueGhArgv(action: RealDataResultIssueAction, commandArgs: RealDataResultIssueCommandArgs): string[]` 을 추가한다. 동작:

- `action.action === 'create'` → `gh issue create` argv: `["issue", "create", "--title", createArgs.title, "--body", createArgs.body, "--label", "<label1>", "--label", "<label2>", ...]`(labels 는 각각 별도 `--label` flag pair 로 전개).
- `action.action === 'update'` → `gh issue edit` argv: `["issue", "edit", String(issueNumber), "--title", updateArgs.title, "--body", updateArgs.body]`.

argv 는 `gh` 실행 파일 이름을 포함하지 않는다(caller 가 `execFile('gh', argv)` 형태로 분리 전달 — 인젝션 방지·인자 분리). 결정론적(동일 입력 → byte-identical argv), 입력 mutate 0·무공유, R-59 정합(body 는 descriptor 가 만든 본문 그대로 — narrative/raw 본문은 애초에 입력에 부재).

실 `gh` 실행 / `gh search issues` / daily-test.sh step_eval wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 argv 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0584-realdata-e2e-result-issue-action-resolver.md` — 직전 chain slice(분기 layer)의 패턴·범위 경계·Out of Scope 표기 컨벤션. 본 task 가 그 action 산출물의 **소비 slice** 임을 확인.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `RealDataResultIssueAction` discriminated union(`{action:'create'}` | `{action:'update', issueNumber}`) 의 정확한 shape. 본 빌더가 이 타입을 import 재사용(중복 정의 금지).
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs`(`{searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body}}`) shape. 본 빌더가 이 타입을 import 재사용하고, create argv 는 createArgs 를, update argv 는 updateArgs 를 소비함을 mirror.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 빌더가 body/title 을 그대로 argv 로 전달할 뿐 raw 를 추가하지 않음을 확인.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-gh-argv.ts` 에 순수 함수 `buildRealDataResultIssueGhArgv(action: RealDataResultIssueAction, commandArgs: RealDataResultIssueCommandArgs): string[]` 추가. 반환은 `gh` 실행 파일명을 **제외한** 인자-벡터(`string[]`).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataResultIssueAction` 은 `./realdata-e2e-result-issue-action` 에서, `RealDataResultIssueCommandArgs` 는 `./realdata-e2e-result-issue-command-args` 에서 `import type` 재사용. 신규 타입 정의 없음(본 빌더는 두 기존 타입을 입력받아 `string[]` 만 산출).
- [ ] **create 분기 argv** — `action.action === 'create'` 면 `["issue", "create", "--title", <createArgs.title>, "--body", <createArgs.body>, ...labels 전개]` 반환. labels 는 각 원소를 `"--label", <label>` flag pair 로 순서 보존 전개(예: labels=["a","b"] → `..., "--label", "a", "--label", "b"`). spec 으로 (a) labels 2건, (b) labels 빈 배열(--label 0개), (c) labels 1건 각각 검증.
- [ ] **update 분기 argv** — `action.action === 'update'` 면 `["issue", "edit", String(issueNumber), "--title", <updateArgs.title>, "--body", <updateArgs.body>]` 반환. issueNumber 는 `String(...)` 으로 문자열화(argv 는 string[]). spec 으로 검증.
- [ ] **issueNumber guard(update 분기)** — update action 의 `issueNumber` 가 양의 정수가 아니면(0 이하·비정수) 명시적 throw(비정상 number 가 argv 로 새는 것 차단). spec 으로 0 / 음수 / 비정수(예: 1.5) 각각 별도 case 검증.
- [ ] **title/body 빈/공백 guard** — create / update 어느 분기든 사용되는 title 또는 body 가 빈 문자열·공백-only 면 명시적 throw(비식별 이슈 argv 생성 차단). spec 으로 create.title 빈, create.body 빈, update.title 빈, update.body 빈 각각 검증(필드별 분기마다 cover).
- [ ] **결정론적 출력(동일 입력 → byte-identical)** — 동일 `action` + `commandArgs` 입력에 대해 두 번 호출한 argv 가 원소·순서까지 동일함을 spec 으로 검증(시각·랜덤·env 의존 0).
- [ ] **인자 분리 정합** — 반환 argv 에 `gh` 실행 파일명이 **포함되지 않음**을 spec 으로 검증(argv[0] === "issue"). title/body 값에 공백·특수문자가 들어가도 별도 argv 원소로 분리되어(shell 문자열 합성 0) 인젝션이 불가함을 spec 으로 1+ 확인(예: body 에 `"; rm -rf"` 가 들어가도 단일 argv 원소로 유지).
- [ ] **입력 mutate 0 / 무공유 보장** — 본 빌더는 입력 `action` / `commandArgs`(중첩 createArgs.labels 배열 포함)를 변형하지 않는다(읽기만). 호출마다 새 argv 배열을 반환. spec 으로 입력 labels 배열 길이·원소 불변 + 반환 argv 가 입력과 무공유(반환 배열 mutate 가 입력에 누설 안 됨) 검증.
- [ ] **R-59 정합(raw 미추가)** — 본 빌더는 commandArgs 의 title/body 를 그대로 argv 로 옮길 뿐 raw 활동 본문·narrative 를 추가하지 않는다(애초에 입력에 부재). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh 실행은 deferred(본 helper 는 argv 합성만)" 명시.
- [ ] **Happy-path unit test 1+** — (a) create action + labels 2건 → 올바른 create argv, (b) update action(issueNumber 42) → 올바른 edit argv, 각각 검증.
- [ ] **Error/negative path test** — (a) update issueNumber=0 throw, (b) update issueNumber=-1 throw, (c) update issueNumber=1.5 throw, (d) create title 빈 throw, (e) create body 공백-only throw, (f) update title 빈 throw — 각각 별도 case. 단일 negative 만으로 부족(필드별·종류별 분기마다 cover).
- [ ] **Flow / branch coverage** — create 분기 / update 분기 + 각 guard 분기(issueNumber, title, body) 각 1+ test. 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 빌더만이므로 100% 지향.

## Out of Scope

- 실 `gh` 호출 / `execFile('gh', argv)` / `gh issue create` / `gh issue edit` / `gh search issues` 실 실행(step ④ live wiring — credential gate). 본 빌더는 argv 합성만 산출(부수효과 0).
- `--repo owner/repo` 인자 / repo slug 결정 / gh auth — 실 wiring 의 환경 책임(본 빌더는 issue create/edit 의 핵심 인자만; repo 컨텍스트는 caller 의 cwd/env 또는 별도 wiring slice).
- create vs update 분기 결정 자체(T-0584 resolver 위임만 — 본 빌더는 주어진 action 을 소비만; resolver 재구현 금지).
- 명령-args 합성 자체(T-0583 위임만 — searchQuery/createArgs/updateArgs 재합성 금지).
- `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기·연동(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / Ollama 실 LLM round-trip(step ③ live — LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- shell 문자열 합성 / 따옴표 escape / `gh ... --json` 옵션 합성 — 본 빌더는 분리된 argv 배열만 산출(shell 미경유, escape 불요).
- 외부 CLI 라이브러리(execa 등) 도입 — 새 dependency 0, 내장 배열 연산만.
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

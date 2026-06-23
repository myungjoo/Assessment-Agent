---
id: T-0586
title: 실 평가 e2e 결과 이슈 searchQuery → gh search issues 인자-벡터 순수 빌더
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-argv.ts
  - test/helpers/realdata-e2e-result-issue-search-argv.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 누락 first-step layer — T-0583 searchQuery → gh search issues argv 순수 빌더. cloud-safe·dependency-free."
---

# T-0586 — 실 평가 e2e 결과 이슈 searchQuery → gh search issues 인자-벡터 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 직전 6 슬라이스(T-0580 summary → T-0581 markdown → T-0582 descriptor → T-0583 command-args → T-0584 action resolver → T-0585 create/edit argv)로 step ④ 박제 직전 layer 가 거의 완결됐다. 그러나 **chain 의 첫 단계(gh search issues 호출의 argv 생성)** 는 여전히 비어있다.

T-0584 resolver 는 `searchHits: RealDataResultIssueSearchHit[]` 를 입력으로 받아 create/update 분기를 결정하지만, 그 searchHits 를 만들어내는 `gh search issues --json number,title,body` 호출의 argv 자체는 어디에도 합성돼 있지 않다. T-0583 command-args 가 `searchQuery: string`(= descriptor.marker) 을 산출하지만, 그 searchQuery 가 어떤 gh argv 로 변환돼 실 호출에 넘어가는지가 비어있어 caller(live wiring)는 argv 합성을 직접 해야 한다.

본 task 는 그 누락된 first-step build-time layer — **`buildRealDataResultIssueSearchGhArgv(commandArgs: RealDataResultIssueCommandArgs): string[]`** — 를 순수 함수로 박제한다. T-0585 가 create/edit 의 argv 를 박제했다면, 본 task 는 search 의 argv 를 박제해 **build-time chain 의 양 끝(search ↔ create/edit)을 모두 닫는다**. caller(live wiring)는 (1) command-args 로부터 본 빌더로 search argv 를 얻고, (2) `execFile('gh', searchArgv)` → JSON parse → searchHits[] 를 얻고, (3) T-0584 resolver 로 action 을 결정하고, (4) T-0585 빌더로 create/edit argv 를 얻고, (5) `execFile('gh', issueArgv)` 로 실 박제한다 — 본 task 의 박제로 (1)~(4) 가 전부 순수 함수로 완결된다.

본 빌더가 산출하는 argv: `["search", "issues", "--match", "body", commandArgs.searchQuery, "--json", "number,title,body", "--limit", "<N>"]` 형태. `gh` 실행 파일명은 미포함(caller 가 `execFile('gh', argv)` 로 분리 전달 — 인젝션 0). 결정론적(동일 입력 → byte-identical), 입력 mutate 0·무공유, R-59 정합(narrative/raw 본문은 애초에 입력 부재 — searchQuery 는 descriptor.marker = 안정 토큰만).

실 `gh search` 실행 / `JSON.parse` / daily-test.sh step_eval wiring / Ollama LAN round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 argv 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0585-realdata-e2e-result-issue-gh-argv.md` — 직전 chain slice(create/edit argv 빌더)의 패턴·범위 경계·argv shape 컨벤션·Out of Scope 표기. 본 task 가 그 대칭(search) argv 빌더 임을 확인.
- `test/helpers/realdata-e2e-result-issue-gh-argv.ts` — create/edit argv 빌더의 실 구현(타입 import 패턴, `--label`/`--title`/`--body` flag pair 전개 방식, gh 실행파일명 제외 정합). 본 빌더가 동형 패턴(`--match`/`--json`/`--limit` flag pair) 으로 search argv 를 합성함을 mirror.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs` shape(특히 `searchQuery: string`). 본 빌더가 이 타입을 import 재사용(중복 정의 금지). searchQuery 가 descriptor.marker 와 동일함을 확인(T-0583 본문 line 124~126 참조).
- `test/helpers/realdata-e2e-result-issue-action.ts` — `RealDataResultIssueSearchHit` shape({number, title, body}). 본 빌더가 산출하는 argv 가 `--json number,title,body` 필드를 정확히 요청해야 resolver 의 입력 shape 와 정합함을 확인(분리 책임이지만 cross-reference 1+).
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시. 본 빌더가 searchQuery 를 그대로 argv 로 옮길 뿐 raw 를 추가하지 않음을 확인.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-search-argv.ts` 에 순수 함수 `buildRealDataResultIssueSearchGhArgv(commandArgs: RealDataResultIssueCommandArgs): string[]` 추가. 반환은 `gh` 실행 파일명을 **제외한** 인자-벡터(`string[]`).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataResultIssueCommandArgs` 는 `./realdata-e2e-result-issue-command-args` 에서 `import type` 재사용. 신규 타입 정의 없음(본 빌더는 commandArgs 입력만 받아 `string[]` 만 산출).
- [ ] **search argv 정합** — 반환 argv 는 `["search", "issues", "--match", "body", <searchQuery>, "--json", "number,title,body", "--limit", "<N>"]` 형태(--match 의 value 는 `body` 고정 — marker 는 issue body 안에 박혀있음, T-0583 본문 line 124~126 정합). spec 으로 정확한 원소·순서·갯수 검증.
- [ ] **--json 필드 정합** — `--json` 인자가 `"number,title,body"`(세 필드 콤마 구분, 공백 0) 임을 spec 으로 검증. 이 세 필드가 T-0584 `RealDataResultIssueSearchHit` 의 모든 멤버와 일치함을 spec 본문 주석에 cross-reference(분리 책임 — type import 는 cross-check 만, 실행 의존 아님).
- [ ] **--limit 결정론** — `--limit` 은 결정론적 상수(예: `"30"` — 결과 이슈는 동일 marker 당 1건만 박제될 텐데 우연적 다중 매칭 대비 충분한 상한). spec 으로 상한 값 명시(매직 넘버 0 — 본 helper 내 named constant 로 박제 + spec 이 그 named constant 검증).
- [ ] **searchQuery 빈/공백 guard** — `commandArgs.searchQuery` 가 빈 문자열·공백-only 면 명시적 throw(전체 매칭 사고 차단, T-0584 marker guard 와 동형 정합). spec 으로 빈, 공백-only(`"   "`), 탭/개행 only 각각 별도 case 검증.
- [ ] **결정론적 출력(동일 입력 → byte-identical)** — 동일 `commandArgs` 입력에 대해 두 번 호출한 argv 가 원소·순서까지 동일함을 spec 으로 검증(시각·랜덤·env 의존 0).
- [ ] **인자 분리 정합** — 반환 argv 에 `gh` 실행 파일명이 **포함되지 않음**을 spec 으로 검증(argv[0] === "search"). searchQuery 값에 공백·특수문자가 들어가도 별도 argv 원소로 분리되어(shell 문자열 합성 0) 인젝션이 불가함을 spec 으로 1+ 확인(예: searchQuery 에 `"; rm -rf"` 가 들어가도 단일 argv 원소로 유지).
- [ ] **입력 mutate 0 / 무공유 보장** — 본 빌더는 입력 `commandArgs`(중첩 createArgs/updateArgs 포함)를 변형하지 않는다(읽기만). 호출마다 새 argv 배열을 반환. spec 으로 입력 commandArgs 의 모든 필드 불변 + 반환 argv 가 입력과 무공유(반환 배열 mutate 가 입력에 누설 안 됨) 검증.
- [ ] **R-59 정합(raw 미추가)** — 본 빌더는 commandArgs.searchQuery 를 그대로 argv 로 옮길 뿐 raw 활동 본문·narrative 를 추가하지 않는다(애초에 입력에 부재 — searchQuery 는 descriptor.marker = 안정 토큰). 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 first-step(search) layer + "실 gh search 실행은 deferred(본 helper 는 search argv 합성만)" 명시.
- [ ] **createArgs/updateArgs 미사용** — 본 빌더는 commandArgs 의 createArgs/updateArgs 를 읽지 않는다(searchQuery 단일 의존). spec 으로 createArgs.body/labels 를 변경해도 반환 argv 가 동일함을 1+ case 로 검증(분리 책임 박제).
- [ ] **Happy-path unit test 1+** — (a) 정상 searchQuery → 올바른 search argv(`["search", "issues", "--match", "body", "<query>", "--json", "number,title,body", "--limit", "30"]`), spec 으로 검증.
- [ ] **Error/negative path test** — (a) searchQuery 빈 throw, (b) searchQuery 공백-only(스페이스) throw, (c) searchQuery 탭/개행 only throw, (d) searchQuery 에 shell 메타문자(`"; rm -rf"`) → throw 0(단일 argv 원소로 유지), (e) createArgs.title 변경해도 search argv 불변 — 각각 별도 case. 단일 negative 만으로 부족(종류별 분기마다 cover).
- [ ] **Flow / branch coverage** — guard 분기(searchQuery 빈) + 정상 분기 + 무공유/결정론 각 1+ test. 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 빌더만이므로 100% 지향.

## Out of Scope

- 실 `gh` 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행(step ④ live wiring — credential gate). 본 빌더는 argv 합성만 산출(부수효과 0).
- gh search response 의 실 JSON 파싱 / `JSON.parse(stdout)` / `RealDataResultIssueSearchHit[]` 산출(caller 책임 — 본 빌더는 input argv 만).
- `--repo owner/repo` 인자 / repo slug 결정 / `--owner` 인자 / gh auth — 실 wiring 의 환경 책임(본 빌더는 search 의 핵심 인자만; repo 컨텍스트는 caller 의 cwd/env 또는 별도 wiring slice).
- create/edit argv 합성(T-0585 위임만 — 본 빌더는 search argv 단일 책임).
- 명령-args 합성 자체(T-0583 위임만 — searchQuery/createArgs/updateArgs 재합성 금지).
- action resolver 분기 결정(T-0584 위임만 — 본 빌더는 search 의 argv 만; searchHits 해석은 그 단계).
- `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기·연동(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / Ollama 실 LLM round-trip(step ③ live — LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- shell 문자열 합성 / 따옴표 escape / `gh search issues --json` 출력 파싱 — 본 빌더는 분리된 argv 배열만 산출(shell 미경유, escape 불요).
- 외부 CLI 라이브러리(execa 등) 도입 — 새 dependency 0, 내장 배열 연산만.
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

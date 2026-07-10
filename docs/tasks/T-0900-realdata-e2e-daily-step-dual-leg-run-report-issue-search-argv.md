---
id: T-0900
title: realdata-e2e daily-step dual-leg run report 이슈 명령-args → gh search issues 인자-벡터 순수 빌더 신설
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
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts
plannerNote: "P5 §109 step④ — T-0899 gh argv(create/edit) 다음 자연 경계(search argv layer, T-0586 mirror). commandArgs.searchQuery → gh search issues argv string[]. 실 gh search/JSON 파싱 deferred. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0900 — realdata-e2e daily-step dual-leg run report 이슈 명령-args → gh search issues 인자-벡터 순수 빌더 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다. 멱등 박제(create-or-update)를 위해서는 marker 로 기존 이슈를 **찾는** `gh search issues` 호출이 chain 의 첫 단계로 필요하다.

dual-leg run report 축의 build-time chain 은 이미 (1) 컴포저(T-0894) → (2) 마크다운 렌더러(T-0895) → (3) rolling-issue descriptor(T-0896) → (4) 명령-args `...IssueCommandArgs`{searchQuery, createArgs, updateArgs}(T-0897) → (5) create-or-update action resolver(T-0898) → (6) action+명령-args → `gh issue create/edit` 인자-벡터 빌더(T-0899)까지 박제됐다. 그러나 **chain 의 첫 단계 — `gh search issues` 호출의 argv 합성** — 은 여전히 비어있다. T-0899 Out of Scope 가 이를 명시적으로 "별도 slice(summary 축 T-0586/T-0587 mirror 후속)" 로 deferred 했다.

본 task 는 그 누락된 first-step build-time layer 를 순수 함수로 박제한다: **`buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): string[]`**. 이는 summary 축의 선례 **T-0586**(`buildRealDataResultIssueSearchGhArgv(commandArgs) → string[]`)과 정확히 동형이다. summary 축은 create/edit argv(T-0585) 다음에 T-0586 으로 search argv 를 박제해 build-time chain 의 양 끝(search ↔ create/edit)을 모두 닫았다. dual-leg 축은 create/edit argv(T-0899)까지만 있고 그 search argv layer(T-0586 mirror)가 없다 — 본 task 가 그 gap 을 메워 chain 의 양 끝을 닫는다.

본 빌더가 산출하는 argv: `["search", "issues", "--match", "body", commandArgs.searchQuery, "--json", "number,title,body", "--limit", "<N>"]`. `--match body` 고정(marker 는 issue body 안에 박혀있음), `--json` 필드는 `"number,title,body"` 고정(T-0898 `RealDataDailyStepDualLegRunReportIssueSearchHit`{number,title,body} 의 모든 멤버와 정합), `--limit` 은 결정론적 named constant. `gh` 실행 파일명은 미포함(caller 가 `execFile('gh', argv)` 로 분리 전달 — 인젝션 0). 결정론적(동일 입력 → byte-identical), 입력 mutate 0·무공유, R-59 정합(narrative/raw 본문 애초에 입력 부재 — searchQuery 는 descriptor.marker = 안정 토큰만).

caller(live wiring)는 (1) 본 빌더로 search argv 를 얻고, (2) `execFile('gh', searchArgv)` → JSON parse → searchHits[] 를 얻고, (3) T-0898 resolver 로 action 을 결정하고, (4) T-0899 빌더로 create/edit argv 를 얻고, (5) `execFile('gh', issueArgv)` 로 실 박제한다 — 본 task 로 (1)~(4) 가 전부 순수 함수로 완결된다. 실 `gh search` 실행 / `JSON.parse` / `deploy/daily-test.sh` step wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 argv 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0899-realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.md` — 직전 chain slice(create/edit argv 빌더)의 패턴·범위 경계·argv shape·Out of Scope 표기 컨벤션. 본 task 가 그 대칭(search) argv 빌더 임을 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `RealDataDailyStepDualLegRunReportIssueCommandArgs` shape(특히 `searchQuery: string` — descriptor.marker 를 그대로 담음). 본 빌더가 이 타입을 `import type` 재사용(중복 정의 금지)하고 searchQuery 단일 필드만 소비함을 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueSearchHit` shape({number, title, body}). 본 빌더가 산출하는 `--json number,title,body` 필드가 이 타입의 모든 멤버와 정합함을 spec 주석에 cross-reference(분리 책임 — type import 는 cross-check 만, 실행 의존 아님).
- `docs/tasks/T-0586-realdata-e2e-result-issue-search-argv.md` + `test/helpers/realdata-e2e-result-issue-search-argv.ts`(+ colocated spec) — summary 축의 동형 선례. named constant(`REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body"`, `REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT = "30"`)·`--match body` 고정·searchQuery 빈/공백 guard·인자 분리(인젝션 방지)·결정론·무공유·R-59 정합·createArgs/updateArgs 미사용 서술 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시. 본 빌더가 searchQuery 를 그대로 argv 로 옮길 뿐 raw 를 추가하지 않음을 확인.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts`(순수 빌더) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts`. production `src/`·T-0894~T-0899 helper·기존 summary-축 helper 수정 0.
- [ ] **빌더 신설** — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): string[]` 순수 함수. 반환은 `gh` 실행 파일명을 **제외한** 인자-벡터(`string[]`). enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataDailyStepDualLegRunReportIssueCommandArgs` 는 `./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args` 에서 `import type` 재사용. 신규 타입 정의 없음(본 빌더는 commandArgs 입력만 받아 `string[]` 만 산출).
- [ ] **search argv 정합** — 반환 argv 는 `["search", "issues", "--match", "body", <searchQuery>, "--json", "number,title,body", "--limit", "<N>"]` 형태(--match 의 value 는 `body` 고정 — marker 는 issue body 안에 박혀있음). spec 으로 정확한 원소·순서·갯수 검증.
- [ ] **named constant 박제(매직 넘버 0)** — `--json` 필드값(`"number,title,body"`)과 `--limit` 값(예: `"30"`)은 본 helper 내 named constant 로 박제(예: `..._SEARCH_JSON_FIELDS`, `..._SEARCH_LIMIT`) + spec 이 그 named constant 를 직접 검증. `--json` 필드가 공백 0 의 세 필드 콤마 구분(`"number,title,body"`)임을 spec 으로 검증하고, 이 세 필드가 `RealDataDailyStepDualLegRunReportIssueSearchHit` 의 모든 멤버와 일치함을 spec 주석에 cross-reference.
- [ ] **searchQuery 빈/공백 guard** — `commandArgs.searchQuery` 가 빈 문자열·공백-only 면 명시적 throw(전체 매칭 사고 차단). spec 으로 빈, 공백-only(`"   "`), 탭/개행 only 각각 별도 case 검증.
- [ ] **createArgs/updateArgs 미사용(분리 책임 박제)** — 본 빌더는 commandArgs 의 createArgs/updateArgs 를 읽지 않는다(searchQuery 단일 의존). spec 으로 createArgs.body/labels 또는 updateArgs 를 변경해도 반환 argv 가 동일함을 1+ case 로 검증.
- [ ] **Happy-path unit test 1+** — 정상 searchQuery → 올바른 search argv(`["search", "issues", "--match", "body", "<query>", "--json", "number,title,body", "--limit", "<N>"]`), spec 으로 검증.
- [ ] **Error path unit test 1+** — (a) searchQuery 빈 throw, (b) searchQuery 공백-only(스페이스) throw, (c) searchQuery 탭/개행 only throw — 각각 별도 case. 조용한 통과 0. 단일 negative 만으로 부족(종류별 분기마다 cover).
- [ ] **Flow / branch cover** — guard 분기(searchQuery 빈/공백) + 정상 분기 각 1+ test. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) **결정론적 출력** — 동일 `commandArgs` 두 번 호출 시 argv 가 원소·순서까지 byte-identical(시각·랜덤·env 의존 0), (b) **인자 분리 정합** — 반환 argv 에 `gh` 실행 파일명 미포함(argv[0] === "search"), searchQuery 에 공백·shell 메타문자(예: `"; rm -rf"`)가 들어가도 단일 argv 원소로 유지(shell 문자열 합성 0 → 인젝션 불가, throw 0), (c) **입력 mutate 0** — 호출 후 입력 `commandArgs`(중첩 createArgs/updateArgs 포함)가 호출 전과 deep-equal(읽기만), (d) **무공유** — 매 호출 새 argv 배열 반환(반환 배열 mutate 가 입력에 누설 안 됨) — 각 1+ test.
- [ ] **R-59 정합** — 본 빌더는 commandArgs.searchQuery 를 그대로 argv 로 옮길 뿐 raw 활동 본문·narrative 를 추가하지 않는다(애초에 입력 부재 — searchQuery 는 descriptor.marker = 안정 토큰). 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 first-step(search) layer + "실 gh search 실행은 deferred(본 helper 는 search argv 합성만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행(`execFile('gh', ...)`/`gh search issues`) / 실 JSON 파싱(`JSON.parse`) / 실 jest spawn / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리 0. 순수 배열/문자열 로직만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — 신규 import 는 command-args helper 의 `import type` 만(action helper 의 SearchHit 타입은 spec 주석 cross-reference 용 — 실행 의존 아님).
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 빌더 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts`(T-0899 gh-argv spec·summary-축 search-argv spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `gh` 실행 / `execFile('gh', argv)` / `gh search issues` 실 실행 / credential wiring** — 본 task 는 commandArgs → search argv 순수 합성만. live wiring 은 credential gate 별도 slice.
- **gh search response 실 JSON 파싱 / `JSON.parse(stdout)` → `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 산출** — 별도 slice(summary 축 T-0587 mirror 후속). 본 빌더는 input argv 만.
- **create/edit argv 합성(T-0899 위임만 — 본 빌더는 search argv 단일 책임).**
- **명령-args 합성 자체(T-0897 위임만 — searchQuery/createArgs/updateArgs 재합성 금지).**
- **action resolver 분기 결정(T-0898 위임만 — searchHits 해석은 그 단계).**
- **`--repo owner/repo` 인자 / repo slug 결정 / `--owner` 인자 / gh auth** — 실 wiring 의 환경 책임(본 빌더는 search 의 핵심 인자만).
- **shell 문자열 합성 / 따옴표 escape** — 본 빌더는 분리된 argv 배열만 산출(shell 미경유, escape 불요).
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor / T-0897 명령-args / T-0898 action / T-0899 gh argv 수정·재계산** — 이미 확정.
- **summary 축(T-0580~T-0590) / 단일 issue-post outcome-report 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 search argv layer 신설만.
- **`deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).**
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

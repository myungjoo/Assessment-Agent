---
id: T-0901
title: realdata-e2e daily-step dual-leg run report 이슈 gh search stdout → SearchHit[] 순수 파서 신설
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-07-11T00:28:00Z
resultSummary: "PR #795 머지(squash 2847ce39). parseRealDataDailyStepDualLegRunReportIssueSearchOutput 순수 파서 신설 — gh search stdout(JSON)→SearchHit[] 파싱·검증(배열 guard→{number,title,body} 정규화→양의 정수 number guard, 여분 절삭, \"[]\"→[]). test-only 2파일 dep0, 신규 파일 100% cov, R-112 26 case, reviewer round1 APPROVE·4-게이트 PASS."
coversReq: [REQ-032, REQ-037]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts
plannerNote: "P5 §109 step④ — T-0900 search argv 다음 자연 경계(search response parse layer, T-0587 mirror). gh search stdout(JSON) → RealDataDailyStepDualLegRunReportIssueSearchHit[]. 실 gh 실행 deferred. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0901 — realdata-e2e daily-step dual-leg run report 이슈 gh search stdout → SearchHit[] 순수 파서 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**(멱등 create-or-update)하라 지시한다. 멱등 박제를 위해서는 marker 로 기존 이슈를 찾는 `gh search issues` 호출의 **stdout(JSON 문자열)을 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 로 파싱·검증하는 단계**가 chain 에 필요하다.

dual-leg run report 축의 build-time chain 은 이미 (1) 컴포저(T-0894) → (2) 마크다운 렌더러(T-0895) → (3) rolling-issue descriptor(T-0896) → (4) 명령-args `...IssueCommandArgs`{searchQuery, createArgs, updateArgs}(T-0897) → (5) create-or-update action resolver(T-0898) → (6) action+명령-args → `gh issue create/edit` 인자-벡터 빌더(T-0899) → (7) `gh search issues` 인자-벡터 빌더(T-0900)까지 박제됐다. 그러나 chain 의 양 끝(search argv T-0900 ↔ resolver T-0898) **사이의 중간 link — `gh search issues --json number,title,body` 의 stdout 을 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 로 파싱하는 단계** — 은 여전히 비어있다. T-0900 Out of Scope 가 이를 명시적으로 "gh search response 실 JSON 파싱 → `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 산출(별도 slice, summary 축 T-0587 mirror 후속)" 로 deferred 했다.

본 task 는 그중 **실 execFile 호출과 무관한 순수 파싱·검증** 부분만 박제한다: **`parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout: string): RealDataDailyStepDualLegRunReportIssueSearchHit[]`**. 이는 summary 축의 선례 **T-0587**(`parseRealDataResultIssueSearchOutput(stdout) → RealDataResultIssueSearchHit[]`)과 정확히 동형이다.

이로써 dual-leg 축 live wiring chain 은 (1) command-args → search argv(T-0900) → (2) `execFile('gh', argv)`(deferred, credential gate) → (3) **stdout → SearchHit[](본 task)** → (4) resolver action(T-0898) → (5) create/edit argv(T-0899) → (6) `execFile`(deferred) 로 (3) 까지의 순수 함수 layer 가 모두 닫힌다. (2)·(6) 의 실 gh 실행만 LAN/credential gate(ADR-0045)로 남는다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 파서라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0587-realdata-e2e-result-issue-search-parse.md` — summary 축의 동형 선례(파서 동작·검증 규약·R-112 cover 구조·Out of Scope 표기). 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-result-issue-search-parse.ts`(+ colocated spec) — summary 축 파서 결과물. `JSON.parse` → 배열 검증 → `{number, title, body}` 정규화 → 양의 정수 number guard → 여분 필드 절삭 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` line 72~104 — `RealDataDailyStepDualLegRunReportIssueSearchHit` 인터페이스({number, title, body})와 `assertPositiveNumber`(양의 정수 규약). 본 파서 출력은 이 type 을 그대로 산출하고, 곧이어 resolver(T-0898)가 검증하는 number 규약(양의 정수)과 정합해야 한다. 신규 type 정의 금지 — `import type` 재사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts`(T-0900 결과물) — `--json number,title,body` 요청 필드(파서 출력 shape 의 source). 특히 named constant `..._SEARCH_JSON_FIELDS = "number,title,body"` 와 정합(파서가 이 세 필드만 추출).
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts`(순수 파서) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts`. production `src/`·T-0894~T-0900 helper·summary-축 helper 수정 0.
- [ ] **파서 신설** — `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout: string): RealDataDailyStepDualLegRunReportIssueSearchHit[]` 순수 함수. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataDailyStepDualLegRunReportIssueSearchHit` 는 `./realdata-e2e-daily-step-dual-leg-run-report-issue-action` 에서 `import type` 재사용. 신규 type 정의 없음.
- [ ] **동작 정합** — `JSON.parse(stdout)` 결과가 배열이어야 하고, 각 원소를 `{number, title, body}` 로 검증·정규화. `number` 는 양의 정수(T-0898 `assertPositiveNumber` 규약과 동형), `title`/`body` 는 문자열. 누락/타입 불일치 시 명시적 throw(조용한 통과 금지). 빈 배열 stdout(`"[]"`) → 빈 `SearchHit[]` 반환(정상 — 후보 0건). `--json` 요청 외 여분 필드가 섞여도(gh 미래 필드 추가) `{number, title, body}` 만 추출(resolver 가 받는 shape 최소화).
- [ ] **결정론·무공유** — 동일 stdout 두 번 호출 → byte-identical 결과(deep equal). 매 호출 새 배열·새 객체 반환(출력 객체 공유 금지 — 반환 배열/원소 mutate 가 다음 호출에 누설 안 됨).
- [ ] **Happy-path unit test 1+** — (a) 정상 1건 stdout → SearchHit 1개, (b) 정상 2+ 건 stdout → 순서 보존 SearchHit[], (c) `"[]"` → `[]` 각각 검증.
- [ ] **Error path unit test 1+** — (a) 잘못된 JSON 문자열(`"not json"`) → throw, (b) JSON 이 배열 아님(`'{"number":1}'` object / `'"str"'` / `"42"`) → throw 각 별도 case. 조용한 통과 0.
- [ ] **Flow / branch cover** — 정상 파싱 분기 + 각 guard throw 분기(JSON parse 실패 / 비배열 / 원소 비객체 / 원소 type 불일치 / number 비양수) 각 1+ test. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지(분기마다): (a) 원소에 `number` 누락, (b) `number` 가 0 / 음수 / 비정수(각 별도 case), (c) `title` 또는 `body` 가 문자열 아님(number/null/undefined 각), (d) 원소가 객체 아님(null / 숫자 / 문자열), (e) 여분 필드가 섞인 원소 → 여분 절삭되고 `{number, title, body}` 만 남음 — 각 1+ test.
- [ ] **R-59 정합** — 파서는 stdout 의 `{number, title, body}` 만 추출하며 raw 활동 본문·narrative 를 추가·저장하지 않는다(입력 외 데이터 생성 0). 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 중간(search response parse) layer + "실 gh search 실행/`execFile` 은 deferred(본 파서는 stdout → SearchHit[] 순수 파싱만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행(`execFile('gh', ...)`/`gh search issues`) / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리 0. 내장 `JSON.parse` + 수동 검증만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — 신규 import 는 action helper 의 `import type`(SearchHit) 만. execa/zod 등 도입 금지.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 파서 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달 — single-helper 라 100% 기대).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts`(T-0900 search-argv spec·summary-축 search-parse spec 과 동일 디렉토리·convention). `describe`/`it` 문자열 한국어로 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `gh search issues` 실행 / `execFile('gh', argv)` 호출** — step ④ live wiring(credential gate, deferred). 본 파서는 stdout 문자열 입력만.
- **search argv 합성(T-0900 위임 — 본 파서는 stdout → SearchHit[] 단일 책임).**
- **action 분기 결정(T-0898 `resolveRealDataDailyStepDualLegRunReportIssueAction` 위임 — 본 파서는 SearchHit[] 산출까지만).**
- **create/edit argv 합성 / issue create/edit 실행(T-0899 + deferred).**
- **명령-args 합성 자체(T-0897 위임 — searchQuery/createArgs/updateArgs 재합성 금지).**
- **`RealDataDailyStepDualLegRunReportIssueSearchHit` type 신규 정의(action helper import 재사용 — 중복 금지).**
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor / T-0897 명령-args / T-0898 action / T-0899 gh argv / T-0900 search argv 수정·재계산** — 이미 확정.
- **summary 축(T-0580~T-0590) / 단일 issue-post outcome-report 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 search response parse layer 신설만.
- **`deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).**
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

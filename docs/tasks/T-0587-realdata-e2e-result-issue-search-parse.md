---
id: T-0587
title: 실 평가 e2e 결과 이슈 gh search stdout → SearchHit[] 순수 파서
phase: P5
status: DONE
mergedAs: d616fd7
prNumber: 500
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-parse.ts
  - test/helpers/realdata-e2e-result-issue-search-parse.spec.ts
plannerNote: P5 PLAN 109행 step④ build-time chain — argv(T-0586)↔resolver(T-0584) 사이 누락 link: gh search stdout → SearchHit[] 순수 파서
---

# T-0587 — 실 평가 e2e 결과 이슈 gh search stdout → SearchHit[] 순수 파서

## Why

[PLAN.md](../PLAN.md) 109행 (🟢 실 평가 e2e — github.com 실 활동) step④ (daily-test 결과를 result/rolling 이슈에 박제) 박제 직전 build-time chain 의 **누락된 중간 link** 를 채운다.

현 chain 은 argv 합성 (T-0586 `buildRealDataResultIssueSearchGhArgv`) 과 분기 resolver (T-0584 `resolveRealDataResultIssueAction`) 가 양 끝에 있으나, 그 사이 — 즉 `gh search issues --json number,title,body` 의 **stdout(JSON 문자열) 을 `RealDataResultIssueSearchHit[]` 로 파싱·검증하는 단계** — 가 빠져있다. T-0586 helper 의 Out of Scope 가 "gh search response 의 실 JSON 파싱 / `JSON.parse(stdout)` / `RealDataResultIssueSearchHit[]` 산출 (caller 책임)" 으로 명시적으로 deferred 해 둔 부분이다. 본 task 는 그중 **실 execFile 호출과 무관한 순수 파싱·검증** 부분만 박제한다.

이로써 live wiring chain 은 (1) command-args → search argv (T-0586) → (2) `execFile('gh', argv)` (deferred, credential gate) → (3) **stdout → SearchHit[] (본 task)** → (4) resolver action (T-0584) → (5) create/edit argv (T-0585) → (6) `execFile` (deferred) 로 (3) 까지의 순수 함수 layer 가 모두 닫힌다. (2)·(6) 의 실 gh 실행만 LAN/credential gate 로 남는다.

## Required Reading

- [docs/tasks/T-0586 search-argv 결과물](../../test/helpers/realdata-e2e-result-issue-search-argv.ts) — `--json number,title,body` 요청 필드 정합 (파서 출력 shape 의 source). 특히 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS` 상수.
- [test/helpers/realdata-e2e-result-issue-action.ts](../../test/helpers/realdata-e2e-result-issue-action.ts) line 60~96 — `RealDataResultIssueSearchHit` 인터페이스 ({number, title, body}) 와 number guard (`assertPositiveNumber`). 본 파서 출력은 이 type 을 그대로 산출하고, resolver 가 곧이어 검증하는 number 규약 (양의 정수) 과 정합해야 한다.
- [test/helpers/realdata-e2e-result-issue-action.spec.ts](../../test/helpers/realdata-e2e-result-issue-action.spec.ts) line 1~15 — R-112 cover 구조 패턴 (happy/error/branch/negative 분리 작성) 참조.
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-112 4종 + coverage 임계) · §12 (언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-result-issue-search-parse.ts` 에 순수 함수 `parseRealDataResultIssueSearchOutput(stdout: string): RealDataResultIssueSearchHit[]` 박제. `RealDataResultIssueSearchHit` 는 `./realdata-e2e-result-issue-action` 에서 `import type` 재사용 (신규 type 정의 0 — 중복 정의 금지).
- [ ] 동작: `JSON.parse(stdout)` 결과가 배열이어야 하고, 각 원소를 `{number, title, body}` 로 검증·정규화. `number` 는 양의 정수 (T-0584 `assertPositiveNumber` 규약과 동형), `title`/`body` 는 문자열. 누락/타입 불일치 시 명시적 throw (조용한 통과 금지). 빈 배열 stdout (`"[]"`) → 빈 `SearchHit[]` 반환 (정상 — 후보 0건).
- [ ] 결정론·무공유: 동일 stdout 두 번 호출 → byte-identical 결과 (deep equal). 매 호출 새 배열·새 객체 반환 (입력 문자열 mutate 불가하나 출력 객체 공유 금지). `gh` 응답에 `--json` 요청 외 추가 필드가 섞여도 (gh 가 미래에 필드 추가) `{number, title, body}` 만 추출 (resolver 가 받는 shape 최소화).
- [ ] **Happy-path unit test 1+** (R-112 ①): (a) 정상 1건 stdout → SearchHit 1개, (b) 정상 2+ 건 stdout → 순서 보존 SearchHit[], (c) `"[]"` → `[]` 각각 검증.
- [ ] **Error path unit test 1+** (R-112 ②): (a) 잘못된 JSON 문자열 (`"not json"`) → throw, (b) JSON 이 배열 아님 (`'{"number":1}'` object / `'"str"'`) → throw 각 별도 case.
- [ ] **Flow/branch cover** (R-112 ③): 정상 파싱 분기 + 각 guard throw 분기 (JSON parse 실패 / 비배열 / 원소 type 불일치 / number 비양수) 각 1+ test.
- [ ] **Negative cases 충분 cover** (R-112 ④, 단일 negative 금지 — 분기마다): (a) 원소에 `number` 누락, (b) `number` 가 0 / 음수 / 비정수 (각 별도 case), (c) `title` 또는 `body` 가 문자열 아님 (number/null/undefined), (d) 원소가 객체 아님 (null / 숫자) — 각 1+ throw 검증.
- [ ] R-59 정합: 파서는 stdout 의 `{number, title, body}` 만 추출하며 raw 활동 본문·narrative 를 추가·저장하지 않는다 (입력 외 데이터 생성 0).
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-search-parse.spec.ts` 작성 (NestJS colocated convention — helper 옆). `describe`/`it` 문자열 한국어로 의도 명확화.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (신규 helper line ≥ 80% / function ≥ 80% — single-helper 라 100% 기대).
- [ ] DB/네트워크/env/live-LLM/credential/gh 실행 0 — build-time 순수 함수 (cloud cron 자율 실행 가능, dependency-free).

## Out of Scope

- 실 `gh search issues` 실행 / `execFile('gh', argv)` 호출 (step④ live wiring — credential gate, deferred).
- search argv 합성 (T-0586 위임 — 본 파서는 stdout → SearchHit[] 단일 책임).
- action 분기 결정 (T-0584 `resolveRealDataResultIssueAction` 위임 — 본 파서는 SearchHit[] 산출까지만).
- `RealDataResultIssueSearchHit` type 신규 정의 (T-0584 import 재사용 — 중복 금지).
- create/edit argv·issue create/edit 실행 (T-0585 + deferred).
- daily-test.sh `step_eval` wiring·실 Ollama round-trip (step③④ live — ADR-0045 LAN=AKIHA gate, deferred).
- production `src/` 코드 변경 — test helper 단독 (타입 import 재사용만).
- 새 외부 dependency (execa / zod 등) 도입 — 내장 `JSON.parse` + 수동 검증만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비움)

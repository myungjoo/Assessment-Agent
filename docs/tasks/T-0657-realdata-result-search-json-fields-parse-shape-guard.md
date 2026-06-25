---
id: T-0657
title: search argv --json 요청 필드 ↔ search-parse 추출 shape 정합 순수 가드 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 571
completedAt: 2026-06-25T07:34:00Z
coversReq: [REQ-009]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-json-fields.ts
  - test/helpers/realdata-e2e-result-issue-search-json-fields.spec.ts
plannerNote: "P5 PLAN 109행 step④ realdata-e2e stream — search-argv(--json 요청 필드)↔search-parse(추출 shape) seam 정합 가드 신설. argv 빌더·search-parse 양 끝이 닫힌 뒤 둘 사이 latent coupling 을 build-time 으로 봉인 (T-0655/T-0656 search-argv self-wire chain 의 downstream)"
---

# T-0657 — search argv --json 요청 필드 ↔ search-parse 추출 shape 정합 순수 가드 신설

## Why

PLAN 109행 step④ realdata-e2e 결과-이슈 표현/발행 surface chain 에서 search 경로 양 끝이 이제 모두 박제됐다: `buildRealDataResultIssueSearchGhArgv`(T-0586, self-wire T-0656)가 `--json number,title,body`(상수 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS`)로 gh 에 요청할 필드를 합성하고, `parseRealDataResultIssueSearchOutput`(T-0587)가 stdout 을 `{number, title, body}` 로 추출·검증한다. 그러나 이 **요청 필드 집합과 추출 shape 필드 집합이 서로 독립적으로 하드코딩**돼 있어, 한쪽이 회귀(예: argv 가 `body` 요청을 빠뜨리거나, parser 가 요청한 적 없는 필드를 추출)해도 잡히지 않는 latent coupling 이 남아있다. 본 task 는 이 seam 을 닫는 순수 build-time 가드 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape` 를 신설해, argv 빌더의 `--json` 요청 필드 집합이 search-parse 가 추출하는 `RealDataResultIssueSearchHit` shape 필드 집합과 정확히 일치함을 검증한다. 신설만 — builder self-wire 는 본 task Follow-up 으로 후속 slice 에 분리(cap·단일책임).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body"`(line 76) export 와 그 의도 주석(line 45~48 `--json 필드 정합`). 본 가드가 요청-측 입력으로 import 한다(상수만, 빌더 함수는 호출 안 함).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — `parseRealDataResultIssueSearchOutput`(line 100~)가 추출하는 정규화 shape `{number, title, body}`(line 131~135)와 그 검증 규약(`assertHitNumber`/`assertHitString`). 추출-측 진실의 원천.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `RealDataResultIssueSearchHit` interface(line 65~) 멤버 정의. 추출 shape 의 type-level 출처(가드가 type-import 로 cross-check 만, 실행 의존 아님).
- `docs/tasks/T-0653-realdata-result-issue-gh-argv-command-args-consistency-guard.md` — 동형 "신설 순수 round-trip 가드" 패턴 선례(argv↔commandArgs). 본 task 는 그 search-json-fields-side sibling(builder self-wire 없는 신설만).

## Acceptance Criteria

- [ ] 신규 helper `test/helpers/realdata-e2e-result-issue-search-json-fields.ts` 에 순수 함수 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(requestedFields: string, parseShapeKeys: readonly string[]): void` export. requestedFields(콤마 구분 `--json` 문자열)를 split·trim 해 얻은 필드 집합이 parseShapeKeys 집합과 **순서 무관·정확 일치**(누락 0·잉여 0·중복 0)함을 검증, 불일치 시 어떤 필드가 누락/잉여인지 명시한 한국어 에러로 throw. 정합이면 void.
- [ ] 모듈 안에 search-parse 추출 shape 의 정규 키 목록을 단일 출처 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number", "title", "body"] as const` 로 박제(parser 가 추출하는 `{number, title, body}` 와 동일 — `RealDataResultIssueSearchHit` 멤버와 type-level 정합을 주석으로 cross-reference). 매직 배열 대신 named constant.
- [ ] 순수성: 입력 외 상태(시각·난수·env·gh) 의존 0, 새 외부 dependency 0, `src/` 변경 0. 내장 문자열/배열/Set 연산만.
- [ ] Happy-path test: `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS`(실제 argv 상수)와 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(실제 parse shape 상수)를 그대로 넘겼을 때 throw 없이 통과 — 두 production 상수가 현재 정합임을 회귀 봉인.
- [ ] Error path test (필드 누락): requestedFields 가 `"number,title"`(body 누락)일 때 body 누락을 명시한 throw 검증. 반대로 requestedFields 가 `"number,title,body,labels"`(잉여 labels)일 때 잉여 필드를 명시한 throw 검증.
- [ ] 분기: 가드 안 분기마다 1+ test — (a) 정합(통과), (b) 누락 필드 존재(throw), (c) 잉여 필드 존재(throw), (d) 동일 개수지만 필드명 mismatch(예: `"number,title,summary"` vs shape) throw.
- [ ] Negative cases 충분 cover — 각 1+ test: (a) requestedFields 빈 문자열/공백-only → throw(전체 누락), (b) requestedFields 에 중복 필드(`"number,number,title,body"`) → throw 또는 명시적 거부, (c) 콤마 주변 공백(`"number, title , body"`)도 정상 trim 후 정합 통과, (d) parseShapeKeys 가 빈 배열 → throw(추출 shape 부재), (e) 순서만 다른 동일 집합(`"body,number,title"`) → 순서 무관이므로 통과(집합 비교임을 검증).
- [ ] 신규 spec `test/helpers/realdata-e2e-result-issue-search-json-fields.spec.ts`(colocated) 에 위 test 들 박제. helper 공유 mock 불필요(순수 함수) — fixture 는 spec 내 inline.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper 파일 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `buildRealDataResultIssueSearchGhArgv` 의 self-wire(반환 직전 본 가드 호출 배선) — 신설·정합 봉인은 본 task, self-wire 는 Follow-up ① 의 별도 slice(T-0654/T-0656 와 동형 분리, cap·단일책임).
- `parseRealDataResultIssueSearchOutput` / `buildRealDataResultIssueSearchGhArgv` 본문 변경 — 상수·shape 키만 읽기/import, 로직 수정 금지.
- `RealDataResultIssueSearchHit` interface 변경 / 신규 type 정의 — type-import cross-check 만.
- live `gh search issues` execFile wiring / 실 네트워크·JSON 파싱 실호출 — credential 게이트 deferred, 본 task 는 build-time 순수 가드만.
- 다른 layer(create/edit argv, command-args, descriptor, output-parse, publish-plan) 정합 가드.
- 새 외부 dependency / Prisma migration / STATE schema 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- ① (planner 가 후속 큐잉) `buildRealDataResultIssueSearchGhArgv` 가 search argv 를 반환하기 직전(또는 모듈 로드 시점)에 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` self-wire — T-0656 search-argv self-wire 와 동형 패턴.

## Result (DONE)

- 완료: 2026-06-25T07:34:00Z (KST 16:34)
- PR #571 squash merge `1a33f6d` — reviewer round1 APPROVE, 4-게이트 PASS (reviewer comment 외부 존재 + integrator self-check + CI green re-run), 외부 PR comment 존재.
- 변경: test-only 2 파일 +628/-0. 신규 helper `realdata-e2e-result-issue-search-json-fields.ts` (`assertRealDataResultIssueSearchJsonFieldsMatchParseShape` + `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`) + spec 30 test (happy 2 / 누락 2 / 잉여 1 / 동일 개수 mismatch 1 / 순서 무관 2 / 콤마 trim 2 / 빈 토큰 3 / 중복 토큰 2 / 빈 requested 2 / 빈 parseShape 1 / 구조 결손 7 / 순수성·무공유 3).
- 검증: 신규 helper line/branch/function/statement 100% (jest --collectCoverageFrom). pnpm lint autofix 후 0 error/warning, CI 두 job 모두 green (rerun 후).
- 환경 메모: 본 fire 는 Anthropic cloud cron 진입점 (`cron@cloud-vm-4c0a5c`) — prisma engines 다운로드 불가로 로컬 `pnpm build` 검증 skip, CI 게이트 위임. 첫 CI run 에서 4-게이트 (b) reviewer comment 미존재로 fail → reviewer comment post 후 rerun_failed_jobs 로 통과.

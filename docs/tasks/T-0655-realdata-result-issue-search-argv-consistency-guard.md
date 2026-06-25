---
id: T-0655
title: 실 평가 e2e 결과 이슈 search argv↔searchQuery round-trip 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — buildRealDataResultIssueSearchGhArgv(T-0586) 산출물의 argv-layer 구조 무결성 가드 신설. T-0653 create/edit argv 가드의 search-side mirror. build-time chain 의 다른 끝(search). single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts
  - test/helpers/realdata-e2e-result-issue-search-argv-consistency.spec.ts
---

# T-0655 — search argv↔searchQuery round-trip 정합 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 search-argv-layer 구조 무결성 가드 신설 slice. 직전까지 realdata-e2e-result-summary-line stream 은 결과 이슈의 **create/edit argv layer** 의 round-trip 정합을 가드 신설(T-0653, `assertRealDataResultIssueGhArgvPreservesCommandArgs`)·builder self-wire(T-0654)로 닫았다. 그러나 멱등 search-or-update 흐름의 **첫 단계인 search argv** — `buildRealDataResultIssueSearchGhArgv(commandArgs)` (T-0586, `realdata-e2e-result-issue-search-argv.ts`) 가 산출하는 `gh search issues` argv — 의 round-trip 정합을 검증하는 순수 가드는 아직 없다.

`buildRealDataResultIssueSearchGhArgv` 의 헤더 주석이 직접 명시하듯("T-0585 가 create/edit 의 argv 를 박제했다면, 본 helper 는 search 의 argv 를 박제해 build-time chain 의 양 끝(search ↔ create/edit)을 모두 닫는다"), search argv 는 chain 의 **다른 한 끝**이다. caller(live wiring)는 이 search argv 를 `execFile('gh', searchArgv)` 로 실행해 `searchHits[]` 를 얻고, 그 결과로 T-0584 resolver 가 create/update 분기를 결정한다. 따라서 search argv 가 회귀(예: `--match body` 위치가 어긋나거나, searchQuery 값이 다른 위치로 새거나, `--json` 필드 문자열이 `RealDataResultIssueSearchHit` 멤버와 어긋나거나, `--limit` 상수가 drift 하거나, `["search","issues"]` 동사 prefix 가 빠지면) 잘못된 gh 검색이 실행돼 분기 결정 자체가 오염된다 — create/edit argv 가드(T-0653)와 동형의 위험이 search 측에 존재하나 그 측 가드는 부재다.

본 task 는 그 빈칸을 메운다 — `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, commandArgs)` 순수 가드를 신설해, 빌더가 산출한 search argv 가 입력 `commandArgs.searchQuery` 를 argv 의 정확한 위치로 round-trip 보존하고 고정 인자(`["search","issues","--match","body", ..., "--json", FIELDS, "--limit", LIMIT]`) shape 를 정합 유지하는지 검증한다. T-0653 가 create/edit argv 측에서 한 것과 **동형 패턴의 search-side mirror** 다. 본 task 는 **가드 신설만** — 빌더 산출 경로 self-wire 는 별도 후속(T-0654 가 T-0653 가드를 self-wire 한 것과 동형, Follow-up). build-time 순수·dependency-free·credential 0 라 live execFile wiring deferred 와 독립이다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-search-argv.ts](../../test/helpers/realdata-e2e-result-issue-search-argv.ts) (T-0586) — 가드의 검증 대상. `buildRealDataResultIssueSearchGhArgv(commandArgs): string[]` 가 산출하는 argv shape: `["search","issues","--match","body", searchQuery, "--json", REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, "--limit", REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT]`. 두 named constant(`REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS="number,title,body"` · `REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT="30"`)는 가드가 정합 비교 시 **재사용 import** 한다(매직 스트링 재기입 금지 — single-source). `assertSearchQueryNonBlank` 동형 검증을 가드도 입력 단계에서 수행.
- [test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts) (T-0653) — **mirror 할 패턴 원본**. `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs): void` 의 구조: 정상이면 void, 구조 결손(argv 길이·타입 어긋남)=`TypeError` / 값 정합 위반(위치별 값 round-trip 실패)=`RangeError` 로 fail-fast throw 구분. 본 task 는 이 두-에러-종류 구분 컨벤션을 그대로 따른다. **본문 변경 0** — 패턴 참조만.
- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) (T-0583) — `RealDataResultIssueCommandArgs` type 정의. 가드는 이 type 을 `import type` 재사용(신규 type 정의 0). `searchQuery` 멤버가 round-trip 대상.
- [test/helpers/realdata-e2e-result-issue-action.ts](../../test/helpers/realdata-e2e-result-issue-action.ts) (T-0584) — `RealDataResultIssueSearchHit`({number, title, body}) 정의 — `--json` 필드 문자열이 이 멤버 집합과 정합해야 함을 cross-check(참조만, 본문 변경 0).
- [test/helpers/realdata-e2e-result-issue-gh-argv-consistency.spec.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv-consistency.spec.ts) (T-0653) — 가드 colocated spec 의 happy/TypeError/RangeError/negative 작성 패턴 참조(fixture 생성·throw 종류 검증). 본 task 의 신규 spec 작성 시 이 구조를 mirror.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts` 신규 — `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv: string[], commandArgs: RealDataResultIssueCommandArgs): void` 순수 가드 export. 정상이면 void, 위반이면 fail-fast throw. `RealDataResultIssueCommandArgs` 는 T-0583 에서 `import type` 재사용(신규 type 0). `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS` · `REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT` 두 named constant 는 T-0586 에서 import 재사용(매직 스트링 재기입 금지).
- [ ] **검증 불변식** — 가드는 다음을 모두 검증: ① argv 가 배열·모든 원소 string ② 동사 prefix `["search","issues"]` 정합 ③ `--match` 다음 원소 `"body"` 정합 ④ searchQuery 가 argv 의 정확한 위치(index 4)로 byte-identical round-trip(`commandArgs.searchQuery` 와 동일) ⑤ `--json` 다음 원소가 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS` 정합 ⑥ `--limit` 다음 원소가 `REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT` 정합 ⑦ argv 길이 정합(예상 9). 또한 입력 `commandArgs.searchQuery` 빈/공백-only 는 T-0586 동형으로 거부.
- [ ] **에러 종류 구분 (T-0653 컨벤션)** — 구조 결손(argv 비배열·원소 비string·길이 어긋남)=`TypeError`, 값 정합 위반(위치별 값 round-trip/고정 인자 불일치)=`RangeError` 로 구분 fail-fast throw. 자동 복구·정규화·기본값 채움 0(위반 검출 시 throw 만).
- [ ] **순수성·R-59 보존** — 가드는 순수 함수(부수효과 0 · 입력 argv/commandArgs mutate 0 · 매 호출 동일 결과). `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미접촉(searchQuery 토큰만 비교). build-time·dependency-free·credential 0(cloud cron 자율 실행 가능).
- [ ] **Happy-path test 1+**: T-0586 빌더가 산출한 정상 argv + 그 입력 commandArgs → 가드 void(throw 0). 다양한 searchQuery 값(marker 토큰 변형, 공백/특수문자 포함 토큰 — 단일 argv 원소 유지 확인) 각 1+.
- [ ] **Error path test 각 1+**: ① argv 비배열/원소 비string → `TypeError` ② argv 길이 어긋남(원소 추가/누락) → `TypeError` ③ searchQuery 위치 값이 commandArgs.searchQuery 와 불일치 → `RangeError` ④ 동사 prefix `["search","issues"]` 어긋남 → `RangeError` ⑤ `--match`/`body` 위치 어긋남 → `RangeError` ⑥ `--json` 필드 문자열이 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS` 와 불일치 → `RangeError` ⑦ `--limit` 값이 `REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT` 와 불일치 → `RangeError`. 각 1+.
- [ ] **Flow/branch test**: 가드 안의 각 검증 분기(구조 검사 분기 · 동사 prefix 분기 · match/body 분기 · searchQuery round-trip 분기 · json 필드 분기 · limit 분기 · searchQuery 빈/공백 거부 분기)마다 정상 통과 1 + 위반 throw 1 로 분기 격리. 각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 (argv, commandArgs) 2회 검증 → 둘 다 동일 결과(void 또는 동일 throw) ② **입력 비변형** — 검증 후 입력 argv/commandArgs 변경 0 assert ③ **searchQuery 인젝션 토큰** — searchQuery 가 `"; rm -rf"` 같은 특수문자 포함 시에도 단일 argv 원소로 round-trip(가드가 escape/분리 안 함을 확인) ④ **빈/공백 searchQuery** — commandArgs.searchQuery 빈/공백-only → 거부 throw(T-0586 동형) ⑤ **고정 인자 single-source** — 가드가 비교에 쓰는 `--json`/`--limit` 값이 T-0586 named constant 와 동일 참조(상수 변경 시 가드도 따라감 — 별도 spec assert) ⑥ **무관 commandArgs 멤버 무시** — createArgs/updateArgs 변형은 search argv 정합에 영향 0(가드는 searchQuery 만 본다). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec 신설** — `test/helpers/realdata-e2e-result-issue-search-argv-consistency.spec.ts` 신규(가드 helper 의 colocated spec, NestJS convention). T-0586 빌더를 import 해 실제 산출 argv 로 happy-path 검증(fixture round-trip), 위반 케이스는 산출 argv 를 변형해 throw 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 가드 helper line/branch/function 100% 커버.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `buildRealDataResultIssueSearchGhArgv` (T-0586) 빌더 **본문 변경** 및 산출 경로 self-wire — 본 task 는 가드 **신설만**. 빌더가 가드를 산출 직전 self-assert 하도록 배선하는 것은 별도 후속(T-0654 가 T-0653 가드를 self-wire 한 것과 동형, Follow-up).
- `assertRealDataResultIssueGhArgvPreservesCommandArgs` (T-0653, create/edit argv 가드) 본문 변경 — 본 task 는 search argv 측 가드 단독 신설. create/edit 측은 이미 신설·self-wire 완결.
- `RealDataResultIssueCommandArgs`/`RealDataResultIssueSearchHit`/`...CreateArgs`/`...UpdateArgs` 타입 정의 변경 — 본 task 는 type 재사용(import type)만.
- search argv 합성 규칙(`--match body` 위치·`--json` 필드·`--limit` 값) 자체 변경 — 가드는 기존 shape 를 **검증**할 뿐 shape 를 바꾸지 않음.
- gh search 실 호출 · `execFile('gh', searchArgv)` 실 실행 · `gh search issues --json` 실행 · gh response JSON 파싱 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·argv 재합성 — 가드는 위반 검출 시 fail-fast throw 만(부정합 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- create/edit argv·command-args·descriptor·summary-line surface 본문 변경 — 본 task 는 search argv 측 가드 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 멱등 search-or-update chain 의 **search argv layer** round-trip 정합 불변식이 순수 가드로 신설된다 — create/edit argv 측(T-0653 가드 + T-0654 self-wire)과 함께 build-time chain 의 양 끝(search ↔ create/edit)이 모두 정합 가드로 닫힌다. 자연 후속 후보: ① 본 search argv 가드의 빌더 self-wire — `buildRealDataResultIssueSearchGhArgv` 산출 직전 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs` self-assert (T-0654 가 create/edit 가드를 self-wire 한 것과 동형). ② gh issue/search 실배선 — `execFile('gh', argv)` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)

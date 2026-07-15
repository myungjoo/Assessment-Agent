---
id: T-1013
title: buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv 반환 직전 search --json 필드↔parse-shape 정합 가드(T-1012) self-wire 배선 (요약축 T-0658 mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step search-argv 빌더가 argv 반환 직전 search --json 필드↔parse-shape 정합 가드(T-1012)를 self-assert. 요약축 T-0658 mirror(T-1010 Follow-up ②). issue-still-relevant pre-check(grep origin/main): 가드 helper+PARSE_SHAPE_KEYS 상수는 main 박제이나 빌더에 self-wire 0건(search-argv.ts 에 JsonFieldsMatchParseShape grep=0 — 현재 SearchGhArgvPreservesCommandArgs 한 가드만 배선) → genuine gap. single-helper-test ×1.0, dependsOn []."
---

# T-1013 — search --json 필드↔parse-shape 정합 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time 가드 self-wire slice. daily-step 축은 요약축(realdata-e2e-result-*) 계열과 동형화 진행 중이며, search `--json` 요청 필드 ↔ search-parse 추출 shape 정합 축의 **가드 신설**은 직전 T-1012 가 닫았다 — `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(requestedFields, parseShapeKeys)` + 정규 키 목록 상수 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` (`...search-json-fields.ts`, main 박제 확인). 그러나 이 가드는 **순수 helper 로만 존재**하며 search-argv 빌더 산출 경로에 아직 배선되지 않았다.

빌더 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` (`...search-argv.ts`)는 argv 반환 직전 한 가드만 self-assert 한다 — argv↔command-args 보존 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs`(L163). T-1012 가 신설한 **`--json` 요청 필드 집합(`REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS` = "number,title,body")이 search-parse 추출 shape 키 집합(`...PARSE_SHAPE_KEYS`)과 set-equal 정합** 불변식 가드는 산출 경로에 박혀있지 않아 호출되지 않는다 — 빌더가 `--json` 필드 배선에서 회귀(예: 요청 필드 누락·요청한 적 없는 잉여 필드 추가 등 latent coupling drift)해도 T-1012 가드는 그 회귀를 검출할 수 있으나 호출되지 않아 부정합 argv 가 caller(live wiring, `execFile('gh', searchArgv)` → JSON parse → searchHits[])로 새 나가 search-parse 추출이 조용히 undefined 필드를 만나거나 잉여 필드를 낭비한다.

본 task 는 그 빈칸을 채운다 — 빌더가 `searchArgv` 를 반환하기 **직전에**(기존 `SearchGhArgvPreservesCommandArgs` 가드 self-assert L163 직후, `return searchArgv`(L168) 직전) `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 self-assert 한다. 두 production 상수가 현재 정합이라 정상 합성이면 두 가드 모두 void 이므로 byte-identical 보존(반환값·동작 불변), 미래 필드 정합 회귀 시 빌더가 손상 argv 를 반환하기 전에 fail-fast throw 한다. 이는 요약축 `buildRealDataResultIssueSearchGhArgv` 의 json-fields 가드 self-wire(T-0658, L157, T-0657 신설 가드의 builder self-wire)의 daily-step mirror — T-1010 Follow-up ② 가 명시한 자연 후속 slice 다. search 빌더는 단일 반환 지점(create/update 분기 없음)이라 self-assert 도 1지점. 가드는 같은 `test/helpers/` 모듈 함수 호출이라 runtime cycle 0.

issue-still-relevant pre-check(origin/main grep): `git grep -c JsonFieldsMatchParseShape origin/main -- '...search-argv.ts'` = 0건(빌더에 self-wire 부재 확인) + 가드 helper 는 main 에 `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape` export + `...PARSE_SHAPE_KEYS` 상수로 박제됨(T-1012 merge PR #906 squash 54c881b8) + 빌더가 현재 `SearchGhArgvPreservesCommandArgs`(L163) 한 가드만 self-assert 함 확인 + 요약축 builder(`realdata-e2e-result-issue-search-argv.ts` L157)는 이미 동형 가드 self-wire 완료 → genuine gap, 중복 아님.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — self-wire 대상 빌더. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)`. 현재 L163 의 `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` self-assert 직후·`return searchArgv`(L168) 직전에 json-fields 정합 가드 self-assert 1지점 추가 배선. 빌더가 보유한 named constant `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS`(L99, "number,title,body")를 requestedFields 인자로, T-1012 helper 의 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 를 parseShapeKeys 인자로 넘긴다. `assertSearchQueryNonBlank`(L111) 식별자 guard·argv 조립(`--match body <query> --json <fields> --limit 30`)·기존 `SearchGhArgvPreservesCommandArgs` 가드 호출·순수성 주석 본문 변경 0. argv↔command-args 가드 self-wire 패턴 동형(옆에 두 번째 가드 나란히).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.ts` (T-1012) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(requestedFields: string, parseShapeKeys: readonly string[]): void` — 정상(set-equal 정합)이면 void, 위반(필드 누락 J4·잉여 J5·개수 동일 이름 mismatch·빈/공백/중복 토큰 J3·빈 requestedFields J2·빈 parseShapeKeys J1·구조 결손 J0)이면 fail-fast throw(TypeError/RangeError). value export `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(L75) 도 이 모듈. **본문 변경 0** — 호출만. import 경로는 같은 `test/helpers/` 디렉토리.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` — 기존 빌더 colocated spec. 본 task 는 이 파일에 json-fields self-wire 검증 describe 를 append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). 기존 fixture·commandArgs 생성 패턴 재사용. `jest.spyOn` 으로 가드가 빌더 반환 직전 `(REAL_DATA_..._SEARCH_JSON_FIELDS, REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS)` 인자로 정확히 1회 호출됨을 검증하는 패턴 참조. T-1012 가드 helper 자체 spec(`...-search-json-fields.spec.ts`)은 본 task 에서 변경 0.
- **패턴 선례 (직접 template — 참조만, 본문 변경 0)**: `test/helpers/realdata-e2e-result-issue-search-argv.ts`(요약축, L157) + 그 colocated spec `realdata-e2e-result-issue-search-argv.spec.ts`(L412~ "self-wire: search --json↔parse-shape 정합 가드…(T-0658)" describe) — 요약축 search-argv json-fields 가드 self-wire. import 1줄 + 호출 1지점, 반환값/동작 불변, 단일 반환 지점이라 self-assert 도 1지점. 본 task 는 그 daily-step mirror — 식별자·상수만 치환.
- **직전 daily-step 축 self-wire 선례 (동형 형태 참조만)**: `docs/tasks/T-1011-daily-labels-title-selfwire.md`(DONE, mergedAs 29a5eaf0) — 같은 daily-step 축의 command-args 빌더에 labels·title 가드를 self-wire 한 직전 slice. 본 task 는 그 옆 search-argv-side 형제(다른 빌더·다른 가드).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 가 `searchArgv` 를 반환하기 **직전에**(기존 `SearchGhArgvPreservesCommandArgs` 가드 self-assert L163 직후, `return searchArgv` 직전) `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 self-assert. import 1줄 추가(가드 함수 + PARSE_SHAPE_KEYS 상수, 같은 `test/helpers/` 디렉토리) + 호출 1지점 배선. 가드 통과 후 기존 `searchArgv` 그대로 반환(T-0658 동형). `assertSearchQueryNonBlank` 식별자 guard·argv 조립·기존 `SearchGhArgvPreservesCommandArgs` 가드 호출·순수성 주석 본문 변경 0. 새 self-wire 지점에 요약축 T-0658 톤의 한국어 주석 1블록 박제(책임·tautology 보존·회귀 시 트립와이어·기존 가드와 축 비중복·단일 반환 지점이라 1지점).
- [ ] **동작 불변 (byte-identical 보존)** — 정상 commandArgs → 두 가드(SearchGhArgvPreservesCommandArgs + JsonFieldsMatchParseShape) 모두 void → 빌더가 기존과 byte-identical argv(`["search","issues","--match","body",<query>,"--json","number,title,body","--limit","30"]`) 반환. self-wire 전후 정상 입력 반환값 변화 0(새 가드는 정상 경로에서 부수효과 0).
- [ ] **회귀 fail-fast** — 빌더 합성이 `--json` 필드↔parse-shape 정합 회귀(새 가드가 검출: 필드 누락·잉여·이름 mismatch 등)하면 빌더가 손상 argv 를 반환하기 **전에** fail-fast throw. 손상 argv 가 caller(live wiring, `execFile('gh', searchArgv)`)로 새 나가지 않음. `jest.spyOn` 으로 가드 강제 throw 모사 → 빌더가 에러 propagate·argv 미반환 검증.
- [ ] **순수성·무공유·R-59 보존** — self-wire 후에도 빌더는 순수 함수 유지(부수효과 0 · 입력 mutate 0 · 매 호출 새 argv 배열 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). 가드 호출은 runtime cycle 0(같은 모듈 디렉토리 함수 호출).
- [ ] **Happy-path test 1+**: 정상 commandArgs(다양한 searchQuery marker·leg 조합) → 빌더가 두 가드 통과 후 정상 argv 반환(throw 0). 반환값이 self-wire 전과 byte-identical. 1+.
- [ ] **Error path test 각 1+**: ① 식별자 guard(searchQuery 빈/공백) → 기존 throw 보존(새 가드 self-wire 가 기존 식별자 guard 동작을 깨지 않음) + json-fields 가드 미호출(`spyOn` 으로 `not.toHaveBeenCalled` 검증 — searchQuery guard 우선). ② 새 가드가 검출하는 필드 정합 위반 시나리오를 `jest.spyOn` 으로 모사(강제 throw) → fail-fast throw propagate. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 두 가드 void → 정상 반환 분기. ② 식별자 guard throw 분기(searchQuery 빈/공백). ③ 새 json-fields 가드 self-assert 가 빌더 반환 직전 `(REAL_DATA_..._SEARCH_JSON_FIELDS, REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS)` 인자로 정확히 1회 호출됨을 `jest.spyOn` 으로 검증(self-wire 가 실제 배선됐음 증명). ④ 기존 `SearchGhArgvPreservesCommandArgs` 가드 self-assert 가 여전히 호출됨(회귀 0) 검증 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 commandArgs 2회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음). ② **입력 비변형** — 빌드 후 입력 commandArgs 변경 0 assert(호출 전후 deep-equal). ③ **self-wire 호출 인자 정합** — spyOn 으로 새 가드가 빌더 반환 직전 정확히 (`REAL_DATA_..._SEARCH_JSON_FIELDS` 문자열, `REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS` 배열) 인자로 1회 호출됨 검증. ④ **가드 순서 보존** — 식별자 guard → SearchGhArgvPreservesCommandArgs 가드 → JsonFieldsMatchParseShape 가드 순서 유지. ⑤ **두 production 상수 현재 정합** — 가드 미mock 실제 호출 시 정상 commandArgs 에서 throw 0(`not.toThrow`). ⑥ **R-59** — self-wire 후에도 빌더가 raw narrative(commit/PR/issue payload 전문) 미접촉. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` 에 json-fields self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). T-1012 가드 helper 자체 spec(`...-search-json-fields.spec.ts`)은 본 task 에서 변경 0.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 변경 대상 빌더·spec 커버리지 유지(빌더 line/branch/function 100% 목표). 전체 unit suite green(기존 빌더·가드·descriptor helper spec 무회귀).

## Out of Scope

- `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape` (T-1012) 가드 helper **본문 변경** 또는 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 상수 값 변경 — 본 task 는 그 가드를 빌더 산출 경로에 self-wire 만(호출 1지점 + import 1줄). 가드 로직·상수 값 변경 0.
- 기존 `SearchGhArgvPreservesCommandArgs` 가드(argv↔command-args 보존) self-assert 변경·제거 — 본 task 는 json-fields 가드를 그 옆에 두 번째로 추가만.
- `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS` 상수 값 변경 · argv 조립 규칙(`--match body`·`--limit 30`) 변경 · searchQuery 전파 규칙 변경 — 본 task 는 self-wire 만.
- 다른 realdata-e2e daily-step seam(publish-plan·search-hit-shape·search-parse·command-args 등)의 추가 가드 또는 mirror — 각 별도 slice.
- gh issue 실 호출 · `execFile('gh', argv)` · `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·필드 자동 보정·silent 수선·argv 재합성 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step search-argv 빌더의 `--json` 필드↔parse-shape 정합 불변식이 argv 반환 직전 self-assert 로 박힌다 — 요약축 T-0657→T-0658 self-wire 의 daily-step mirror 완결. 이로써 daily-step search-argv 는 argv↔command-args 보존(`SearchGhArgvPreservesCommandArgs`)·json-fields 정합(본 task) 두 축 가드가 모두 빌더 산출 경로에 배선돼 요약축과 동형화된다.) 예상 후속 ①: §109 잔여 미미러 seam(publish-plan·search-hit-shape) mirror. ②: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

## Result

Completed: 2026-07-14T23:37:31Z (cron fire, claim-pickup stage5b)
Merged as: PR #907 squash 2583a9aa (round 1 reviewer APPROVE, 4-게이트 PASS, CI green)
요약: daily-step search-argv 빌더가 argv 반환 직전 json-fields↔parse-shape set-equality 정합 가드(T-1012)를 self-assert 하도록 배선. test-only 2파일 +214 LOC, 397 suite/10712 test green, coverageThreshold(line·func ≥80%) 무회귀. 요약축 T-0658 mirror 완결.

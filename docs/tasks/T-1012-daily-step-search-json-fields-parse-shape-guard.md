---
id: T-1012
title: daily-step dual-leg run report issue search `--json` 요청 필드↔parse-shape 키 set-equality 정합 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape — SEARCH_JSON_FIELDS 가 파서 정규화 shape 키와 집합-동일 불변식, 요약축 T-0657 mirror)
phase: P5
status: DONE
mergedAs: 54c881b8
prNumber: 906
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 630
estimatedFiles: 2
created: 2026-07-15
sizeExempt: true
exemptReason: "순수 가드 helper + colocated R-112 spec 은 atomic(helper 는 spec 없이 merge 불가 — R-112). 요약축 선례(T-0657) 가드 254 LOC + spec 374 LOC = 628 LOC 를 daily-step 축으로 동형 이식. helper+spec 분리 불가라 T-1008/T-1010 처럼 atomic sizeExempt. base ~630 × 1.0(single-helper-test — set-equality 순수 가드, R-112 4-카테고리 backbone 아님). entity @unique 없음(test helper — P2002 sub-multiplier 무해당)."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step 축 search `--json` 요청 필드↔parse-shape 키 set-equality 가드 신설(요약축 T-0657 mirror, T-1010 Follow-up ② 명시 seam). issue-still-relevant pre-check(grep origin/main): daily-step helpers 에 SearchJsonFields/MatchParseShape 어휘 0건(genuine gap) + SEARCH_JSON_FIELDS 상수·parseRealDataDailyStepDualLegRunReportIssueSearchOutput 파서 둘 다 main 박제 확인. pr test-only 2파일 신설 file-disjoint dep[] stage5b 병렬."
---

# T-1012 — daily-step search `--json` 요청 필드↔parse-shape 키 set-equality 정합 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** search seam 구조 무결성 가드 사슬의 연속 slice. daily-step 축은 직전 T-1008/T-1009(command-args body marker-first)·T-1010/T-1011(command-args labels·title)로 command-args 두 축을 요약축과 완전 동형화했다. T-1010 Follow-up ② 가 명시한 잔여 미미러 seam 3개(publish-plan·search-hit-shape·**search-json-fields**) 중 **search-json-fields** 를 본 task 가 연다(가드 신설).

daily-step search 빌더 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` (`...issue-search-argv.ts`)는 `gh search issues ... --json <fields>` 의 요청 필드를 고정 상수 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body"` 로 박제하고, 파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` (`...issue-search-parse.ts`)는 gh 응답을 `{number, title, body}` shape 로 정규화(추가 필드 drop)한다. 그러나 이 **두 지점이 요청·추출하는 필드 집합이 서로 정확히 일치**한다는 불변식 — `--json` 이 요청하는 필드 집합이 파서가 정규화하는 parse-shape 키 집합과 set-equal(누락 필드도, 잉여 필드도 없음) — 은 두 파일의 주석 cross-reference 로만 박제돼 있고 **런타임에서 강제되는 독립 가드가 부재**하다. 요청 필드에서 하나가 빠지면(예: body 누락) 파서가 그 필드를 undefined 로 받아 throw 하거나 조용히 결손 hit 을 만들고, 잉여 필드를 요청하면 낭비·drift 의 씨앗이 된다.

본 task 는 그 불변식을 검증하는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(requestedFields, parseShapeKeys)` 를 신설한다 — `--json` 요청 필드 문자열(콤마 구분)을 집합으로 파싱해 parse-shape 키 집합과 set-equality 를 강제하고, 필드 누락·잉여·중복·빈 토큰이 gh search 실배선으로 새기 전 fail-fast throw 로 차단한다. 파서 정규화 shape 키는 본 가드 파일에 named constant `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"]` 로 single-source 박제한다(요약축 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 와 동형). 요약축 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape`(T-0657, `realdata-e2e-result-issue-search-json-fields.ts`, 254 LOC)의 daily-step mirror — 인자·타입·불변식·에러 정책(TypeError=구조 결손 / RangeError=값 정합 위반)·메시지 포맷을 동형으로 옮긴다. **가드 신설만** — 빌더 산출 직전 self-wire(`SEARCH_JSON_FIELDS` 를 requestedFields 로 self-assert) 배선은 후속 slice(요약축 T-0658 mirror).

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `SearchJsonFields`·`MatchParseShape`·`JsonFieldsMatch` 어휘 0건(`git grep -lE 'SearchJsonFields|MatchParseShape|JsonFieldsMatch' origin/main -- 'test/helpers/*daily-step*'` = empty) → genuine gap, 중복 아님. 검증 대상 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS`("number,title,body") 상수 및 파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`(`{number, title, body}` 정규화) 둘 다 main 박제. 요약축 template(T-0657 guard 254 + spec 374)도 main 박제.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `--json` 요청 필드 상수의 원천. `export const REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body"`(L99~100, 콤마 구분·공백 0). 본 가드의 requestedFields 검증 대상 값. **본 task 는 이 파일을 변경하지 않는다** — 상수 값의 의미만 참조(가드는 requestedFields 를 인자로 받아 임의 문자열 검증 가능하게 두고, spec 이 이 상수를 happy-path fixture 로 사용). 빌더 self-wire 는 본 task 범위 밖(Follow-up).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — 파서 정규화 shape 의 원천. `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 가 gh 응답을 `{number, title, body}` 만 담은 새 객체로 정규화(추가 필드 drop, L108~). `RealDataDailyStepDualLegRunReportIssueSearchHit` 멤버(`number: number; title: string; body: string`, T-0898)와 동일 키 집합. 본 가드 파일이 박제할 `PARSE_SHAPE_KEYS` 상수의 진실의 원천(주석 cross-reference 로 이 파일 지목). `import` 없음(파서를 value import 하지 않음 — 키 집합만 named constant 로 재선언, 요약축과 동형).
- **패턴 선례 (직접 template)**: `test/helpers/realdata-e2e-result-issue-search-json-fields.ts`(T-0657, 요약축 — main 박제, 254 LOC) 의 `export const REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"] as const` + `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(requestedFields: string, parseShapeKeys: readonly string[]): void`. 내부 helper `assertRequestedFieldsStructure`(string 구조 → TypeError)·`assertParseShapeKeysStructure`(배열 구조 → TypeError)·`splitRequestedFieldsIntoSet`(콤마 split·trim·빈/중복 토큰 거부). 검사 단계 (J0) 구조 → (J1) parseShapeKeys 빈 배열 거부(RangeError) → (J2) requestedFields 빈/공백-only 거부(RangeError) → (J3) split→set + 빈/중복 토큰 RangeError → (J4) set-equality(누락 필드·잉여 필드 RangeError, 메시지에 기대 집합·실측 집합·차집합 포함). 본 가드는 그 daily-step mirror — 상수·함수·에러 정책·메시지 포맷·JSDoc 톤을 동형으로 이식(어휘만 daily-step 축으로 치환).
- **패턴 선례 (spec template)**: `test/helpers/realdata-e2e-result-issue-search-json-fields.spec.ts`(T-0657, 요약축 — main 박제, 374 LOC) 의 describe 구조(정상 void·set-equality·필드 누락/잉여/순서무관/중복/빈 토큰/공백 민감 negative·결정성·비변형). daily-step 축으로 이식.
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.spec.ts` (가드 옆 colocated — R-112 spec).
- **직전 daily-step 축 선례 (동형 형태 참조만)**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.ts`(T-1010) — 같은 daily-step 축 순수 가드의 형태(정상 void·위반 fail-fast throw·구조 결손=TypeError/값 위반=RangeError 구분·한국어 명세형 에러·dependency-free·runtime cycle 0). **본문 변경 0**(참조만).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.ts` 신설 — (1) `export const REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number", "title", "body"] as const` (파서 정규화 shape 키의 single-source, 주석에 파서·SearchHit cross-reference 박제), (2) 순수 가드 `export function assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape(requestedFields: string, parseShapeKeys: readonly string[]): void`. `requestedFields`(`--json` 콤마 구분 문자열)를 집합으로 파싱해 `parseShapeKeys` 집합과 **set-equality**(순서 무관, 누락 필드·잉여 필드 모두 위반) 검증. 정합이면 void, 위반 시 throw. 파서·빌더를 value import 하지 않음(키 집합만 재선언 — 요약축과 동형, 순환 참조 0). 파일 상단 주석에 책임(`--json` 요청 필드↔parse-shape 키 정합 검증)·불변식·에러 정책·순수성·R-59 raw 미접촉·dependency-free 를 한국어로 박제.
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**(요약축 T-0657 mirror): (a) `requestedFields` 가 string 아님(null/undefined/숫자/배열 등), `parseShapeKeys` 가 배열 아님 또는 원소 비-string → 한국어 TypeError. (b) `parseShapeKeys` 빈 배열 / `requestedFields` 빈·공백-only / split 결과에 빈 토큰·중복 토큰 / set-equality 위반(누락 필드 또는 잉여 필드) → 한국어 RangeError(메시지에 기대 집합·실측 집합·차집합(누락/잉여) 노출). silent 통과(위반인데 void) 0. fail-fast. 검사 순서: 구조(TypeError) → parseShapeKeys 빈 배열 → requestedFields 빈/공백 → split 빈/중복 토큰 → set-equality.
- [ ] **비변형 / 순수**: `requestedFields`·`parseShapeKeys`(읽기·split·비교만) mutate 0. 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0·env/network/credential/gh 실행 0. 동일 입력 → 동일 동작(정합이면 항상 void, drift 면 항상 동일 사유에서 throw).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 실제 상수 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS`("number,title,body")를 requestedFields 로, `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 를 parseShapeKeys 로 가드에 넘기면 throw 0(void) — 실 상수쌍이 round-trip 통과 확인. 필드 순서를 바꾼 requestedFields("body,number,title")도 set-equal 이므로 void(순서 무관) 검증 1+.
  - **Error path 1+**: 필드 누락("number,title" — body 누락)·필드 잉여("number,title,body,labels")·중복 토큰("number,number,title,body")·빈 토큰("number,,body")·빈/공백-only requestedFields·parseShapeKeys 빈 배열 각 → RangeError(각 1+). 메시지에 기대·실측·차집합 노출 검증.
  - **Flow/branch cover**: 구조 결손 분기(TypeError: requestedFields null/숫자/배열, parseShapeKeys 비-배열, parseShapeKeys 원소 비-string)와 값 정합 위반 분기(RangeError: parseShapeKeys 빈 배열 / requestedFields 빈·공백 / 빈 토큰 / 중복 토큰 / 누락 필드 / 잉여 필드) 각 1+ test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 필드 누락·잉여·순서변경(순서는 void)·중복·빈 토큰 각 1+, (b) `requestedFields`/`parseShapeKeys` null/undefined → TypeError(각 1+), (c) parseShapeKeys 원소 비-string(숫자 섞임) → TypeError, (d) **빈 경계** — parseShapeKeys 빈 배열 → RangeError / requestedFields 빈·공백-only → RangeError, (e) **공백 민감** — requestedFields 토큰 앞뒤 공백은 trim 후 비교하되 필드 이름 자체의 대소문자·내부 문자는 byte-identical(예: "Number" ≠ "number" → 누락+잉여로 위반) 검증, (f) 동일 입력 두 번 호출 deterministic, (g) 입력 비변형(호출 전후 deep-equal) 각 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 미노출), raw 활동 본문 파일/전역 저장 0 assert(R-59).
- [ ] `src/` 무변경(test helper 단독 — 파서·빌더 상수 값 의미만 참조, value import 0). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 신규 가드 파일 line/branch/function 100% 목표. 전체 unit suite green(기존 search-argv·search-parse helper spec 무회귀).

## Out of Scope

- **가드의 빌더 self-wire 배선** — 본 task 는 가드 신설만. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 산출 직전 `SEARCH_JSON_FIELDS` 를 requestedFields 로 넘겨 self-assert 하는 배선은 별도 후속 slice(요약축 T-0658 mirror, Follow-up ①).
- search-argv 빌더 또는 search-parse 파서 본문·시그니처·상수 수정 0 — 본 task 는 가드 **신설만**, 두 파일은 참조만(value import 0, 키 집합 재선언).
- `--limit`·`--match` 등 다른 search argv 필드 정합 / search-hit 개별 원소 shape 검증(search-hit-shape 축은 T-0659 mirror 별도 slice) — 본 가드는 `--json` 요청 필드↔parse-shape 키 집합 정합만.
- 다른 realdata-e2e seam(publish-plan·descriptor-body-consistency·command-plan 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · 실 응답 파싱(step ④ live wiring — credential 게이트). 본 가드는 build-time 순수 검증만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- 자동 복구·정규화·기본값 채움·필드 자동 보정·silent 수선 — 가드는 위반 검출 시 fail-fast throw 만.
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지. JSON schema / zod·ajv 도입 0(순수 string·집합 비교만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step search seam 의 `--json` 요청 필드↔parse-shape 키 정합 불변식이 순수 가드로 박힌다 — 요약축 T-0657 mirror.) 예상 후속 ①: 본 가드를 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 산출 직전 self-wire 배선(`SEARCH_JSON_FIELDS` 를 requestedFields·`PARSE_SHAPE_KEYS` 를 parseShapeKeys 로 self-assert — 요약축 T-0658 mirror). ②: §109 잔여 미미러 seam(publish-plan·search-hit-shape) mirror. ③: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

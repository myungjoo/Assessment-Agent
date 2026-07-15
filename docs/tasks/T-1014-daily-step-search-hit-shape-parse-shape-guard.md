---
id: T-1014
title: daily-step dual-leg run report issue search 파싱 산출 hit 의 own 키 집합↔parse-shape 키 set-equality 정합 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys — 파서 produced-hit 키가 PARSE_SHAPE_KEYS 와 집합-동일 불변식, 요약축 T-0659 mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 690
estimatedFiles: 2
created: 2026-07-15
sizeExempt: true
exemptReason: "순수 가드 helper + colocated R-112 spec 은 atomic(helper 는 spec 없이 merge 불가 — R-112). 요약축 선례(T-0659) 가드 252 LOC + spec 432 LOC = 684 LOC 를 daily-step 축으로 동형 이식. helper+spec 분리 불가라 T-1012/T-1010/T-1008 처럼 atomic sizeExempt. base ~690 × 1.0(single-helper-test — set-equality 순수 가드, R-112 4-카테고리 backbone 아님). entity @unique 없음(test helper — P2002 sub-multiplier 무해당)."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step 축 search 파싱 산출 hit 키 집합↔PARSE_SHAPE_KEYS set-equality 가드 신설(요약축 T-0659 mirror, T-1013 Follow-up ① 잔여 seam). issue-still-relevant pre-check(grep origin/main): daily-step helpers 에 SearchHitShape/HitShapeMatchesParseShape 어휘 0건(genuine gap) + SearchHit interface(action.ts L85)·PARSE_SHAPE_KEYS 상수(T-1012)·파서 produced {number,title,body} shape 셋 다 main 박제 확인. pr test-only 2파일 신설 file-disjoint dep[] stage5b 병렬."
---

# T-1014 — daily-step search 파싱 산출 hit 키 집합↔parse-shape 키 set-equality 정합 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** search seam 구조 무결성 가드 사슬의 연속 slice. daily-step 축은 직전 T-1012(search json-fields 가드 신설)·T-1013(그 가드의 빌더 self-wire)으로 search `--json` **request-side** 정합 축을 요약축과 동형화했다. T-1013 Follow-up ① / T-1010 Follow-up ② 가 명시한 잔여 미미러 seam(publish-plan·search-hit-shape) 중 **search-hit-shape**(파서 **consumer-side** 정합)를 본 task 가 연다(가드 신설).

daily-step search 파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` (`...issue-search-parse.ts`, L121)는 `gh search issues ... --json <fields>` stdout JSON 을 정규화해 산출 hit 를 `{number, title, body}` 만 담은 새 객체로 추출한다(L153~155, 추가 필드 drop → `RealDataDailyStepDualLegRunReportIssueSearchHit`, action.ts L85). 그리고 그 추출 shape 의 정규 키 목록은 T-1012 가 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"]`(`...search-json-fields.ts` L75) 로 named constant 박제했다. 그러나 이 **두 끝 — 파서가 실제로 산출하는 hit 의 own enumerable 키 집합 ↔ 선언된 parse-shape 상수** — 은 서로 독립적으로 하드코딩돼 있어, 한쪽이 회귀(예: 누가 parse-shape 상수에 `author` 를 추가했으나 파서는 옛 3키만 계속 추출, 혹은 파서가 잉여 필드를 실수로 산출)해도 정합이 silently 깨진다. T-1012/T-1013 의 json-fields 가드는 상수를 `--json` **요청** 필드와만 묶지, 파서가 **실제 산출하는** hit 와는 묶지 않는다.

본 task 는 그 constant↔produced-hit seam 을 집합 동치 비교로 닫는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, parseShapeKeys)` 를 신설한다 — 파서 산출 hit 객체의 own enumerable 키 집합을 parse-shape 키 집합과 set-equality(순서 무관, 누락 키도 잉여 키도 위반) 로 강제하고, 부정합이 gh search 실배선 소비자로 새기 전 fail-fast throw 로 차단한다. 정규 키 목록은 신규 정의하지 않고 T-1012 single-source 상수를 그대로 re-export 만 한다(소비자가 한 곳에서 가드+상수를 함께 import 가능). 요약축 `assertRealDataResultIssueSearchHitShapeMatchesParseShapeKeys`(T-0659, `realdata-e2e-result-issue-search-hit-shape.ts`, 252 LOC)의 daily-step mirror — 인자·타입·불변식·에러 정책(구조 결손=TypeError / 값 정합 위반=RangeError)·메시지 포맷·JSDoc 톤을 동형으로 옮긴다(어휘만 daily-step 축으로 치환). 이는 T-1012 request-side 가드의 **parse-output consumer-side sibling** — **가드 신설만**이며, 파서 산출 직전 self-wire 배선은 후속 slice(요약축 T-0659 self-wire 동형).

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `SearchHitShape`·`HitShapeMatchesParseShape` 어휘 0건(`git grep -lE 'SearchHitShape|HitShapeMatchesParseShape' origin/main -- 'test/helpers/*daily-step*'` = empty) → genuine gap, 중복 아님. prereq 3종 main 박제 확인: `RealDataDailyStepDualLegRunReportIssueSearchHit` interface(action.ts L85) + `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 상수(T-1012 merge PR #906 squash 54c881b8, `...search-json-fields.ts` L75) + 파서 produced `{number,title,body}` shape(`...search-parse.ts` L153~155). 요약축 template(T-0659 guard 252 + spec 432)도 main 박제.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueSearchHit` interface 원천(L85~, `{number: number; title: string; body: string}`). 본 가드가 검증하는 산출 hit 의 타입. **본 task 는 이 파일을 변경하지 않는다** — `import type` 만(값 import 0). 요약축 hit-shape 가드가 `import type { RealDataResultIssueSearchHit }` 하는 것과 동형.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.ts` (T-1012) — parse-shape 정규 키 상수 원천. `export const REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"] as const`(L75). 본 가드는 이 상수를 **신규 정의하지 않고** 그대로 `import` + `export { ... }` re-export 만 한다(진실의 원천은 T-1012 파일 유지 — single-source). 요약축 hit-shape 가드가 json-fields 상수를 re-export 하는 패턴과 동형. **본문 변경 0**.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — 파서 원천. `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(L121)가 gh 응답을 `{number, title, body}` 만 담은 새 객체로 정규화(L153~155, 추가 필드 drop). 본 가드가 닫는 seam 의 produced-hit 쪽. **본 task 는 이 파일을 변경하지 않는다** — 산출 shape 의 의미만 참조(파서 value import 0, 가드는 hit 객체를 인자로 받아 임의 hit 검증 가능; spec 은 파서 산출 shape 를 happy-path fixture 로 재현). 파서 self-wire 는 본 task 범위 밖(Follow-up).
- **패턴 선례 (직접 template)**: `test/helpers/realdata-e2e-result-issue-search-hit-shape.ts`(T-0659, 요약축 — main 박제, 252 LOC) 의 `import type { RealDataResultIssueSearchHit }` + `export { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS }`(re-export) + `assertRealDataResultIssueSearchHitShapeMatchesParseShapeKeys(hit, parseShapeKeys): void`. 내부 helper `assertHitStructure`(hit 이 own enumerable 키를 가진 plain object 인지 — null/undefined/비객체/배열 거부, TypeError)·`assertParseShapeKeysStructure`(배열 구조·원소 string, TypeError)·own 키 집합 추출(`Object.keys`) → parseShapeKeys 집합과 set-equality(누락 키·잉여 키 RangeError, 메시지에 기대 집합·실측 집합·차집합 포함). 본 가드는 그 daily-step mirror — 상수·함수·에러 정책·메시지 포맷·JSDoc 톤을 동형 이식(어휘만 daily-step 축으로 치환).
- **패턴 선례 (spec template)**: `test/helpers/realdata-e2e-result-issue-search-hit-shape.spec.ts`(T-0659, 요약축 — main 박제, 432 LOC) 의 describe 구조(정상 void·set-equality·키 누락/잉여/순서무관/구조 결손 negative·결정성·비변형·re-export 동일성). daily-step 축으로 이식.
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.spec.ts` (가드 옆 colocated — R-112 spec).
- **직전 daily-step 축 선례 (동형 형태 참조만, 본문 변경 0)**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields.ts`(T-1012) — 같은 daily-step search seam 의 request-side sibling 가드. 정상 void·위반 fail-fast throw·구조 결손=TypeError/값 위반=RangeError 구분·한국어 명세형 에러·dependency-free·runtime cycle 0 형태. 본 task 는 그 consumer-side sibling(produced-hit 쪽).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.ts` 신설 — (1) T-1012 상수 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 를 `import` 후 그대로 `export { ... }` re-export(신규 정의 0 — single-source 유지, 주석에 진실의 원천이 `...search-json-fields.ts` 임 박제), (2) 순수 가드 `export function assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit: RealDataDailyStepDualLegRunReportIssueSearchHit, parseShapeKeys: readonly string[]): void`. `hit` 의 own enumerable 키 집합을 `parseShapeKeys` 집합과 **set-equality**(순서 무관, 누락 키·잉여 키 모두 위반) 검증. 정합이면 void, 위반 시 throw. `import type` 만 사용(파서·빌더 value import 0 — 순환 참조 0). 파일 상단 주석에 책임(파싱 산출 hit 키 집합↔parse-shape 키 정합 검증)·불변식·에러 정책·순수성·R-59 raw 미접촉·dependency-free 를 한국어로 박제.
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**(요약축 T-0659 mirror): (a) `hit` 이 own enumerable 키를 가진 plain object 아님(null/undefined/숫자/문자열/배열 등), `parseShapeKeys` 가 배열 아님 또는 원소 비-string → 한국어 TypeError. (b) `parseShapeKeys` 빈 배열 / set-equality 위반(hit 키에 없는 parse-shape 키 = 누락, hit 에만 있는 잉여 키) → 한국어 RangeError(메시지에 기대 집합·실측 집합·차집합(누락/잉여) 노출). silent 통과(위반인데 void) 0. fail-fast. 검사 순서: hit 구조(TypeError) → parseShapeKeys 구조(TypeError) → parseShapeKeys 빈 배열(RangeError) → set-equality(RangeError).
- [ ] **비변형 / 순수**: `hit`·`parseShapeKeys`(읽기·키 추출·비교만) mutate 0. 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0(zod·ajv 도입 0)·env/network/credential/gh 실행 0. 동일 입력 → 동일 동작(정합이면 항상 void, drift 면 항상 동일 사유에서 throw). 내부 Set/Array 생성은 모두 새 객체.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 파서 산출 shape 를 재현한 `{number, title, body}` hit 를 실제 상수 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 와 함께 가드에 넘기면 throw 0(void) — 실 shape/상수쌍이 round-trip 통과 확인. 키 순서를 바꾼 hit(`{body, number, title}`)도 own 키 집합이 set-equal 이므로 void(순서 무관) 검증 1+.
  - **Error path 1+**: 키 누락(hit 에 body 없음 → parse-shape 키 body 가 잉여)·키 잉여(hit 에 `labels` 추가 → hit-only 잉여)·parseShapeKeys 빈 배열 각 → RangeError(각 1+). 메시지에 기대·실측·차집합 노출 검증.
  - **Flow/branch cover**: 구조 결손 분기(TypeError: hit=null/숫자/문자열/배열, parseShapeKeys 비-배열, parseShapeKeys 원소 비-string)와 값 정합 위반 분기(RangeError: parseShapeKeys 빈 배열 / 키 누락 / 키 잉여) 각 1+ test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 키 누락·잉여·순서변경(순서는 void) 각 1+, (b) `hit`/`parseShapeKeys` null/undefined → TypeError(각 1+), (c) hit 이 배열 → TypeError(키-값 객체여야 함), (d) parseShapeKeys 원소 비-string(숫자 섞임) → TypeError, (e) **빈 경계** — parseShapeKeys 빈 배열 → RangeError / hit 이 빈 객체 `{}` → 누락 키 RangeError, (f) **키 이름 대소문자 민감** — hit 키 `Number`(대문자) ≠ `number` → 누락+잉여 위반 검증, (g) 동일 입력 두 번 호출 deterministic, (h) 입력 비변형(호출 전후 deep-equal) 각 1+. 단일 negative 만 작성 금지 — 위 분기마다 cover.
  - **re-export 동일성**: 본 모듈이 re-export 한 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 가 T-1012 원천 모듈의 상수와 참조/값 동일(single-source 확인) 1 test.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 미노출), raw 활동 본문 파일/전역 저장 0 assert(R-59).
- [ ] `src/` 무변경(test helper 단독 — action interface·상수·파서 shape 의미만 참조, value import 0[상수 re-export 제외]). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 신규 가드 파일 line/branch/function 100% 목표. 전체 unit suite green(기존 search-json-fields·search-parse·action helper spec 무회귀).

## Out of Scope

- **가드의 파서 self-wire 배선** — 본 task 는 가드 신설만. `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 산출 직전(또는 hit 조립 직후) 본 가드를 호출해 산출 hit shape 를 self-assert 하는 배선은 별도 후속 slice(요약축 T-0659 self-wire 동형).
- search json-fields 가드(T-1012, request-side) 또는 그 self-wire(T-1013) 변경 0 — 본 가드는 그 consumer-side sibling **신설**이지 기존 가드 수정 아님.
- 파서·SearchHit interface·PARSE_SHAPE_KEYS 상수 본문·시그니처·값 수정 0 — 본 task 는 가드 **신설만**, 세 파일은 참조만(상수는 re-export, 나머지는 `import type`/의미 참조).
- search-hit 개별 원소의 값 검증(number 가 양수인지·title 비어있지 않은지 등) — 본 가드는 **키 집합** set-equality 만(값 검증 별도 seam).
- 다른 realdata-e2e daily-step seam(publish-plan·descriptor-body-consistency·command-plan 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · 실 응답 파싱(step ④ live wiring — credential 게이트). 본 가드는 build-time 순수 검증만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- 자동 복구·정규화·기본값 채움·필드 자동 보정·silent 수선 — 가드는 위반 검출 시 fail-fast throw 만.
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지. JSON schema / zod·ajv 도입 0(순수 객체 키·집합 비교만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step search seam 의 파싱 산출 hit 키 집합↔parse-shape 키 정합 불변식이 순수 가드로 박힌다 — 요약축 T-0659 mirror. 이로써 daily-step search seam 은 request-side(T-1012/T-1013 json-fields)·consumer-side(본 task hit-shape) 양끝 정합 가드가 모두 갖춰져 요약축과 동형화된다.) 예상 후속 ①: 본 가드를 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 산출 직전 self-wire 배선(요약축 T-0659 self-wire mirror). ②: §109 잔여 미미러 seam(publish-plan) mirror. ③: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

## Result

- **Status: DONE** (2026-07-15T00:22:47.000Z) — PR [#908](https://github.com/myungjoo/Assessment-Agent/pull/908) squash-merged (82617c3e), branch deleted.
- 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys` + parse-shape 상수 re-export 신설(요약축 T-0659 daily-step mirror). 파서 산출 hit own 키 집합↔parse-shape 키 set-equality fail-fast(구조=TypeError/값=RangeError).
- test-only 2파일(+728 LOC), `src/`·`package.json`·CI·새 dep 0. 398 suite/10744 test green, coverage(line·func ≥80%) 무회귀.
- reviewer round1 APPROVE(0 BLOCKER/0 MAJOR/0 MINOR), 4-게이트 PASS(reviewer comment external Round 1/7, CI run 29378494484 success). fineGrainedConcurrency ON(stage5b) claim-pickup fire, dup-PR 0.

---
id: T-1015
title: daily-step search 파서 산출 hit 키 집합↔parse-shape 키 set-equality 가드(T-1014) producer self-wire (parseRealDataDailyStepDualLegRunReportIssueSearchOutput map 콜백 per-hit self-assert, 요약축 T-0660 mirror)
phase: P5
status: DONE
prNumber: 909
mergedAs: b4335809
reviewRounds: 1
completedAt: 2026-07-15T01:01:47Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-15
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
plannerNote: "P5 §109 test-hardening — daily-step search 파서가 각 정규화 hit 반환 직전 hit-shape↔parse-shape set-equality 가드(T-1014)를 per-hit self-assert. 요약축 T-0660 mirror(T-1014 Follow-up ①). pre-check(grep origin/main): 가드+PARSE_SHAPE_KEYS 상수 main 박제이나 파서에 HitShapeMatchesParseShapeKeys self-wire 0건(파서는 whole-batch ConsistentWithStdout T-0909 한 가드만 배선) → genuine gap. single-helper-test ×1.0, dep[]."
---

# T-1015 — search 파서 산출 hit 키 집합↔parse-shape 키 set-equality 가드 producer self-wire

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time 가드 self-wire slice. daily-step search seam 은 request-side(T-1012/T-1013 json-fields 가드 신설·self-wire)를 요약축과 동형화했고, consumer-side **가드 신설**은 직전 T-1014 가 닫았다 — `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, parseShapeKeys)`(파서 산출 hit own 키 집합 ↔ `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` set-equality) + parse-shape 상수 re-export (`...search-hit-shape.ts`, main 박제 확인). 그러나 이 가드는 **순수 helper 로만 존재**하며 파서 산출 경로에는 아직 배선되지 않았다.

파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(`...search-parse.ts`, L121)는 `parsed.map(...)` 안에서 각 원소를 검증(number 양의 정수·title/body 문자열)한 뒤 `{number, title, body}` 만 담은 **새 객체**(L152~156)로 정규화해 반환한다(추가 필드 drop). 반환 직전 파서는 이미 한 가드를 self-assert 한다 — whole-batch `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout)`(T-0909, L167). 그러나 이 가드는 산출 배열 전체가 raw stdout 으로부터 올바른 **개수·순서·필드값**으로 재유도됐는지를 대조할 뿐, **각 hit 의 own enumerable 키 집합이 선언된 parse-shape 키 집합과 set-equal 인지**(T-1014 가드가 검출하는 축)는 강제하지 않는다. 그래서 정규화 객체 literal(L152~156)이 회귀(예: 누가 parse-shape 상수에 `author` 를 추가했으나 파서 literal 은 옛 3키만 계속 산출, 혹은 파서 literal 에 잉여 필드를 실수로 추가)해도 T-1014 가드는 그 drift 를 검출할 수 있으나 호출되지 않아, shape 부정합 hit 이 caller(live wiring, `execFile('gh', searchArgv)` → JSON parse → searchHits[] 소비자)로 조용히 새 나간다.

본 task 는 그 빈칸을 채운다 — 파서의 `parsed.map(...)` 콜백이 정규화 `hit` 객체를 `return` 하기 **직전에**(L156 의 literal 조립 직후, `return hit`(L158) 직전) `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 per-hit self-assert 한다. 두 상수·literal 이 현재 정합이라 정상 파싱이면 가드는 매 hit 마다 void 이므로 산출 배열 byte-identical 보존(반환값·필드 순서·무공유 불변), 미래 shape 정합 회귀 시 파서가 손상 hit 을 반환하기 전에 fail-fast throw 한다. 이는 요약축 `parseRealDataResultIssueSearchOutput` 의 hit-shape 가드 producer self-wire(T-0660 — T-0659 신설 가드의 map-콜백 per-hit self-assert)의 daily-step mirror — T-1014 Follow-up ① 이 명시한 자연 후속 slice 다. import 는 같은 `test/helpers/` 디렉토리 값 import(가드 함수 + re-export 상수), 파서가 이미 T-0909 consistency 가드를 값 import 하므로 새 import 도 runtime cycle 0(tsc green 확인).

issue-still-relevant pre-check(origin/main grep): `git grep -c HitShapeMatchesParseShapeKeys origin/main -- '...search-parse.ts'` = 0건(파서에 self-wire 부재 확인) + 가드 helper 는 main 에 `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys`(hit-shape.ts L201) export + `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` re-export(hit-shape.ts L61)로 박제됨(T-1014 merge PR #908 squash 82617c3e) + 파서는 현재 whole-batch `ConsistentWithStdout`(L167) 한 가드만 self-assert 함 확인 + 요약축 파서(`realdata-e2e-result-issue-search-parse.ts`)는 이미 동형 per-hit self-wire 완료(T-0660) → genuine gap, 중복 아님.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — self-wire 대상 파서(producer). `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`. `parsed.map((element, index) => { ... })` 콜백 안에서 검증(`assertHitNumber`/`assertHitString` L147~149) 후 `{number, title, body}` literal(L152~156)을 조립해 `return hit`(L158) 한다. **본 task 는 그 `return hit` 직전에** `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 per-hit self-assert 로 배선(import 1줄 + 호출 1지점). 기존 whole-batch `ConsistentWithStdout` self-assert(L167)·배열 guard·원소 객체 guard·number/title/body 검증·정규화 literal·순수성 주석 본문 변경 0. import 경로는 같은 `test/helpers/` 디렉토리(`./realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape`).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape.ts` (T-1014) — self-wire 할 가드 원천. `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, parseShapeKeys: readonly string[]): void`(L201, 정상 set-equal 정합이면 void, 위반 시 throw — 구조 결손=TypeError / 값 정합 위반(키 누락·잉여)=RangeError) + re-export 된 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(L61, 진실의 원천은 T-1012 `...search-json-fields.ts`). 가드 시그니처·throw 계약 확인만. **본문 변경 0** — 호출만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts` — 파서 colocated spec. self-wire 검증 describe 를 **append**(신규 spec 파일 신설 아님 — 기존 파서 colocated spec 확장). 기존 stdout fixture 생성 패턴 재사용. `jest.spyOn` 으로 가드가 매 정규화 hit 마다 `(hit, REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS)` 인자로 호출됨을 검증하는 패턴 참조. T-1014 가드 helper 자체 spec(`...-search-hit-shape.spec.ts`)은 본 task 에서 변경 0.
- **패턴 선례 (직접 template — 참조만, 본문 변경 0)**: `docs/tasks/T-0660-realdata-result-search-hit-parse-shape-self-wire.md`(DONE, 요약축) + `test/helpers/realdata-e2e-result-issue-search-parse.ts`(요약축 파서의 `parsed.map(...)` per-hit self-assert 지점) + 그 colocated spec 의 self-wire describe. import 1줄 + 호출 1지점(map 콜백 안 per-hit), byte-identical 보존, 매 원소 self-assert / 빈 배열 시 미호출 룰. 본 task 는 그 daily-step mirror — 식별자·상수만 치환.
- **직전 daily-step 축 self-wire 선례 (동형 형태 참조만)**: `docs/tasks/T-1013-daily-search-json-fields-selfwire.md`(DONE, mergedAs 2583a9aa) — 같은 daily-step search seam 의 request-side self-wire(빌더 반환 직전 1지점). 본 task 는 그 consumer-side 형제(파서 map 콜백 per-hit self-assert — 단, 빌더는 단일 반환 1지점인 반면 파서는 **매 hit 마다** self-assert 라는 점이 상이).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 의 `parsed.map(...)` 콜백 안에서, 정규화 `{number, title, body}` literal(L152~156) 조립 직후·`return hit`(L158) 직전에 `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys(hit, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 per-hit self-assert. import 1줄 추가(가드 함수 + re-export 된 PARSE_SHAPE_KEYS 상수, 같은 `test/helpers/` 디렉토리 `./realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape`) + 호출 1지점 배선. 가드 void 반환 시 기존 `hit` 그대로 반환(T-0660 동형). 배열 guard·원소 객체 guard·number/title/body 검증·정규화 literal·기존 whole-batch `ConsistentWithStdout` self-assert(L167)·순수성 주석 본문 변경 0. 새 self-wire 지점에 요약축 T-0660 톤의 한국어 주석 1블록 박제(책임·tautology 보존·회귀 시 트립와이어·기존 whole-batch 가드와 축 비중복(per-hit shape vs whole-batch value)·정규화 후에만 호출됨).
- [ ] **동작 불변 (byte-identical 보존)** — 정상 stdout(1건 이상 hit) → 매 hit 가드 void → 파서가 self-wire 전과 **byte-identical** 산출 배열(`{number, title, body}` 필드 순서·무공유(추가 필드 drop, 새 객체)·개수·순서) 반환. self-assert 는 검증만 하고 출력 변형 0. `"[]"` → `[]`(빈 배열 — 가드 미호출) 정상.
- [ ] **회귀 fail-fast** — 파서 정규화 literal 이 shape 정합 회귀(새 가드가 검출: 키 누락·잉여 등)하면 파서가 손상 hit 을 반환하기 **전에** fail-fast throw. 손상 hit 이 caller(live wiring, `execFile('gh', searchArgv)` → 소비자)로 새 나가지 않음. `jest.spyOn` 으로 가드 강제 throw 모사 → 파서가 에러 propagate·hit 미반환 검증.
- [ ] **순수성·무공유·R-59 보존** — self-wire 후에도 파서는 순수 함수 유지(부수효과 0 · 입력 stdout 비변형 · 매 호출 새 배열·새 객체 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw narrative 미저장). 가드 호출은 runtime cycle 0(같은 `test/helpers/` 디렉토리 함수 값 import — tsc green 으로 import graph cycle 부재 확인).
- [ ] **Happy-path test 1+**: 정상 stdout(1건 이상 hit, 잉여 필드 포함 원본 → 정규화로 drop) → 파서가 매 hit 가드 통과 후 정상 `{number, title, body}[]` 반환(throw 0). 반환값이 self-wire 전과 byte-identical. `"[]"` → `[]`. 1+.
- [ ] **Error path test 각 1+**: ① 파서 기존 분기 throw 보존 — 비배열 stdout / 비객체 원소 / number 누락·비정수 / title·body 비문자열 각각이 self-wire 전과 동일하게 throw(새 가드 self-wire 가 기존 검증 순서를 깨지 않음 — 가드는 검증 통과 후 정규화 hit 에 대해서만 호출됨). ② 새 가드가 검출하는 shape 위반 시나리오를 `jest.spyOn` 으로 모사(강제 throw) → fail-fast throw propagate. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 매 hit 가드 void → 정상 반환 분기. ② 파서 기존 검증 throw 분기(비배열·비객체 원소·number/title/body 검증)는 가드 도달 **전에** 발생(정규화 후에만 self-assert — 검증 순서 보존) 각 1+. ③ 새 hit-shape 가드가 정규화 hit 조립 직후 `(hit, REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS)` 인자로 **매 원소마다** 호출됨을 `jest.spyOn` 으로 검증(self-wire 가 실제 배선됐음 증명). ④ 기존 whole-batch `ConsistentWithStdout` self-assert(L167)가 여전히 호출됨(회귀 0) 검증 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) **다건 hit** — 2건 이상 hit 모두에 대해 가드가 각각 호출됨(매 원소 self-assert — spy 호출 횟수 = hit 개수). (b) **빈 배열** — `"[]"` 일 때 가드 미호출(반복 0, spy `not.toHaveBeenCalled`). (c) **검증 순서 보존** — 파서 기존 number 누락·title 비문자열·body 누락 throw 가 가드 도달 **전에** 발생(정규화 전 검증 단계). (d) **정상 hit throw 0** — 실제 상수·정규화 shape 쌍에서 가드 미mock 실호출 시 throw 0(`not.toThrow`). (e) **입력 비변형** — 파싱 후 입력 stdout 문자열 변경 0(불변). (f) **결정성** — 동일 stdout 2회 파싱 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음). (g) **self-wire 인자 정합** — spy 로 가드가 각 정규화 hit(`{number, title, body}`)과 re-export 상수 `REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS` 인자로 호출됨 검증. (h) **R-59** — self-wire 후에도 파서가 raw narrative(issue payload 전문) 미저장. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts` 에 hit-shape self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 파서 colocated spec 확장). T-1014 가드 helper 자체 spec(`...-search-hit-shape.spec.ts`)은 본 task 에서 변경 0.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 변경 대상 파서 커버리지 유지(파서 line/branch/function 100% 목표). 전체 unit suite green(기존 파서·hit-shape 가드·consistency 가드 spec 무회귀).

## Out of Scope

- `assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys` (T-1014) 가드 helper **본문 변경** 또는 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 상수 값 변경 — 본 task 는 그 가드를 파서 산출 경로에 self-wire 만(호출 1지점 + import 1줄). 가드 로직·상수 값 변경 0.
- 기존 whole-batch `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout` self-assert(T-0909, L167) 변경·제거 — 본 task 는 per-hit hit-shape 가드를 map 콜백 안에 추가만(다른 축).
- 파서 정규화 로직·필드 집합(`{number, title, body}`)·number/title/body 검증 순서·배열/원소 guard 변경 — 본 task 는 self-wire 만.
- search json-fields 가드(T-1012, request-side) 또는 그 self-wire(T-1013) 변경 0 — 별도 seam.
- 다른 realdata-e2e daily-step seam(publish-plan·descriptor-body-consistency·command-plan 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·필드 자동 보정·silent 수선 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step search seam 의 파싱 산출 hit 키 집합↔parse-shape 키 정합 불변식이 파서 산출 경로에 per-hit self-assert 로 박힌다 — 요약축 T-0659→T-0660 self-wire 의 daily-step mirror 완결. 이로써 daily-step search seam 은 request-side(T-1012 신설/T-1013 self-wire json-fields)·consumer-side(T-1014 신설/본 task self-wire hit-shape) 양끝 정합 가드가 모두 산출 경로에 배선돼 요약축과 완전 동형화된다.) 예상 후속 ①: §109 잔여 미미러 seam(publish-plan) mirror. ②: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.

---
id: T-0904
title: realdata-e2e daily-step dual-leg run report 이슈 outcome 산출 키 집합 ↔ parse-shape 정합 순수 가드 신설
phase: P5
status: DONE
prNumber: 798
mergedAs: 1bc706a6
reviewRounds: 1
completedAt: 2026-07-11T01:58:52Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 480
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-outcome-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.spec.ts
sizeExempt: true
exemptReason: "test-only set-equality 가드 — 가드 본체 + colocated R-112 spec 두 신규 파일이라 cap 초과 가능. summary 축 정확 mirror T-0661(실측 690 LOC) 및 dual-leg 형제 T-0899(+514)/T-0900(+455)/T-0901(+395) test-dominated 선례 정합. src 무변경."
plannerNote: "P5 §109 step④ — T-0903 base output 파서 다음 자연 경계(post-execution parse-shape 가드, T-0661 mirror). 산출 outcome 키 집합↔선언 parse-shape set-equality. cap-bend pre-justified: 형제 T-0661/T-0899 test-dominated 선례. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0904 — realdata-e2e daily-step dual-leg run report 이슈 outcome 산출 키 집합 ↔ parse-shape 정합 순수 가드 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 dual-leg run report 축 build-time chain 은 입력(search argv/parse)부터 출력(create/edit 결과 파싱)까지 순수 함수로 round-trip 이 닫혔다 — (1) 컴포저(T-0894) → (2) 마크다운 렌더러(T-0895) → (3) descriptor(T-0896) → (4) 명령-args(T-0897) → (5) action resolver(T-0898) → (6) gh create/edit argv 빌더(T-0899) → (7) gh search argv 빌더(T-0900) → (8) search stdout 파서(T-0901) → (9) gh command-plan 종단 컴포저(T-0902) → (10) create/edit stdout → `{issueNumber, url}` 파서(T-0903, `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`).

그러나 T-0903 은 그 base 파서만 박제했고, **파서가 실제로 산출하는 outcome 객체의 키 집합**(`{issueNumber, url}`, 파서 본문에 하드코딩)과 **선언된 outcome shape**(interface `RealDataDailyStepDualLegRunReportIssueOutcome` 의 키 집합) 사이의 어떤 set-equality 가드도 없다. 누가 outcome interface 에 키를 추가(예: `htmlUrl`)하거나 파서가 추가 필드를 흘려도 producer↔declared-shape 정합이 silently 깨질 수 있다. 이는 summary 축의 선례 **T-0661**(`assertRealDataResultIssueOutcomeMatchesParseShape` + single-source `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`)가 이미 닫은 seam 이며, 본 task 는 그 정확한 dual-leg 축 mirror 다.

T-0903 이 Required Reading 에서 명시했듯 summary 축이 base 파서 뒤에 붙인 parse-shape/consistency 가드(T-0661/T-0662/T-0723/T-0724)가 dual-leg 축의 자연스러운 후속 slice 이며, 본 task 는 그 첫 슬라이스(T-0661 mirror = parse-shape set-equality 가드 신설)다. self-wire(T-0662 mirror)와 값-정합 가드(T-0723/T-0724 mirror)는 후속 slice 로 분리한다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 가드라 cloud cron 에서 자율 실행 가능하다(REQ-059 raw 미저장 정합 — 가드는 키 집합만 비교, 이슈 본문/narrative 미보유).

## Required Reading

- `docs/tasks/T-0661-realdata-result-outcome-parse-shape-guard.md` — summary 축의 **정확한 동형 선례**. single-source 정규 키 목록 상수 신규 정의(post-execution 측엔 선행 상수가 없으므로 re-export 아닌 신규 정의가 정당) + set-equality 순수 가드 + TypeError(구조 결손)/RangeError(키 집합 불일치) 구분 + fail-fast + 한국어 JSDoc + Acceptance/Out-of-Scope 구성. 본 task 는 그 검증 대상을 summary outcome `{issueNumber,url}` 에서 dual-leg outcome `{issueNumber,url}` 로 바꾼 mirror.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 가드가 검증할 producer(본 task 는 **read-only**, 변경 금지). `RealDataDailyStepDualLegRunReportIssueOutcome` interface(line 66~)와 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`(line 108~)의 정규화 반환 지점(`{issueNumber, url}` 만 산출). interface 는 `import type` 만(신규 type 정의 금지).
- `test/helpers/realdata-e2e-result-issue-outcome-parse-shape.ts`(있으면) — T-0661 산출물. single-source 상수 `as const` 패턴·`assertHitStructure` 스타일 구조 검사·set-equality 비교·한국어 JSDoc·책임 경계 주석을 본 helper 가 동형으로 따른다(**import 금지, 패턴 참고만** — summary 축 파일 수정 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — dual-leg 축의 엄격 검증·무공유·결정론·dependency-free 패턴 참고(형제 helper 스타일 정합).
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts`(가드+상수) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.spec.ts`. production `src/`·T-0894~T-0903 helper·summary-축 helper 수정 0.
- [ ] **single-source 정규 키 목록 상수 신설** — `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber", "url"] as const`(또는 `readonly string[]` 동형) 을 본 모듈에서 정의·export. post-execution 측엔 선행 상수(search 의 `--json` json-fields 같은)가 없으므로 신규 정의가 진실의 원천으로 정당(T-0661 동형 근거).
- [ ] **가드 순수 함수 신설** — `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome: RealDataDailyStepDualLegRunReportIssueOutcome, parseShapeKeys: readonly string[]): void`. 산출 outcome 의 **자기 own enumerable 키 집합**(`Object.keys(outcome)`)이 `parseShapeKeys` 집합과 set-equal 이면 void, 어긋나면 fail-fast throw. `RealDataDailyStepDualLegRunReportIssueOutcome` 은 `./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse` 에서 `import type` 재사용(신규 type 정의 금지).
- [ ] **비변형** — 가드는 `outcome` 인자 자체를 변형하지 않는다(읽기·키 비교만). `parseShapeKeys` 도 읽기만(정렬·mutate 금지).
- [ ] **에러 분기 구분** — 구조 결손(null/undefined/비객체/배열)은 `TypeError`, 의미 위반(키 집합 불일치: 누락·잉여·중복·빈 배열)은 `RangeError` 로 구분(T-0661 convention 동형). 메시지에 위반 키 이름·기대 집합·실측 집합 포함(한국어 명세형).
- [ ] **Happy-path unit test 1+** — (a) 정상 outcome(`{issueNumber:42, url:"https://github.com/o/r/issues/42"}`)과 정규 키 상수 입력 시 throw 없이 통과, (b) **회귀-검증 test 1+** — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 를 정상 stdout 으로 호출해 얻은 실 outcome 을 본 가드에 통과시켜 상수↔파서 산출 정합 확인(파서 산출 키가 상수와 실제로 set-equal 임을 회귀로 고정).
- [ ] **Error path unit test 1+** — (a) `outcome` null/undefined/비객체 → `TypeError`, (b) `outcome` 배열 → `TypeError`, (c) `parseShapeKeys` 비배열/비-string 원소 포함 → `TypeError`, (d) `parseShapeKeys` 빈 배열 → `RangeError` — 각 별도 case.
- [ ] **Flow / branch cover** — 키 비교 분기마다 1+ test: (i) outcome 에 parse-shape 키 누락(`{issueNumber}` 만, url 누락) → `RangeError`(누락 키 메시지), (ii) outcome 에 잉여 키(`{issueNumber, url, htmlUrl}`) → `RangeError`(잉여 키 메시지), (iii) 정확히 일치 → void. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(분기마다): (a) 키 순서만 다르고 집합 동일(`{url, issueNumber}`) → 통과(set-equality 순서 무관), (b) parseShapeKeys 중복 키 → `RangeError`, (c) outcome 이 빈/공백 키 포함 → `RangeError`, (d) 입력 outcome 비변형 확인(가드 호출 후 own keys/값 unchanged), (e) 부분 교집합(일부 누락 + 일부 잉여 동시) → `RangeError`(둘 다 보고 또는 fail-fast 우선순위 명시), (f) 대/소문자 차이 키(`IssueNumber` vs `issueNumber`) → 불일치 거부(대소문자 민감).
- [ ] **결정성·무공유** — 동일 입력 두 번 호출 시 동형 결과(에러 여부·메시지 결정론), 매 호출 새 비교(입력 불변). test 1+.
- [ ] **R-59 정합** — 가드는 outcome 키 집합만 다루고 이슈 본문/narrative/credential 은 보유·노출하지 않는다. 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 producer↔declared-shape seam(post-execution parse-shape) 단계 + "실 `execFile('gh', ...)` deferred" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리(zod 등) 0. 내장 `Object.keys` + 수동 set 비교만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — execa/zod 등 도입 금지.
- [ ] **type/함수 import 라 runtime import cycle 0** — `pnpm build`(tsc) green 으로 확인.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 가드 파일 branch/func/line 100% 목표.
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.spec.ts`(T-0903 output-parse spec·형제 helper 와 동일 디렉토리·convention). `describe`/`it` 문자열 한국어로 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **가드의 producer self-wire**(파서 산출 직전 `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, ...)` self-assert 배선) — 본 task 는 가드+상수 신설만. self-wire 는 후속 slice(summary 축 T-0662 mirror).
- **outcome 값-정합 재유도 가드**(산출 `{issueNumber,url}` 전체를 raw stdout 으로부터 독립 재유도해 deep-equal 대조 — summary 축 T-0723/T-0724 mirror) — 본 task 는 키 집합 set-equality(shape)만. 값-drift 가드는 별도 후속 slice.
- **파서 본체 `realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` / `RealDataDailyStepDualLegRunReportIssueOutcome` interface 변경** — import·read 만, 출력 byte-identical 보존.
- **search-side parse-shape 가드 / summary 축(T-0580~T-0661) helper 변경·재호출** — 재구현 0. 본 task 는 dual-leg 축 outcome producer↔declared-shape seam 신설 1건.
- **실 `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행**(step ④ live wiring — credential gate, deferred).
- **`deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).**
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. self-wire(T-0662 mirror)·값-정합 가드(T-0723/T-0724 mirror)는 다음 planner 가 후속 slice 로 큐잉 후보.)

---
id: T-0908
title: dual-leg run report 이슈 search-parse 산출 ↔ raw stdout single-source 재유도 값-정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-search-parse-consistency-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated spec 두 신규 파일이라 cap 초과 가능. summary 축 T-0721(search-parse value-guard) 및 dual-leg output 축 T-0906(+642) sibling 선례 정합. src 무변경."
plannerNote: "P5 §109 step④ — dual-leg run report search-parse 산출↔stdout single-source 재유도 값-정합 가드 신설(summary 축 T-0721 mirror). output-parse 값-가드 짝(T-0906/T-0907) 다음, search 축 값-drift cover gap. self-wire 는 후속 slice."
---

# T-0908 — dual-leg run report 이슈 search-parse 산출 ↔ raw stdout single-source 재유도 값-정합 가드 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 dual-leg run report 축 build-time consistency-guard sweep 은 직전에 output-parse 축(`{issueNumber, url}` 산출)의 값-정합 짝 — T-0906(값-가드 신설, PR #800 squash 2468effd) + T-0907(컴포저 self-wire, PR #801 squash 9713a211) — 을 완결했다. 그러나 dual-leg chain 의 **입력측** search leg 는 아직 값-정합 가드가 없다: `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(T-0901, `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts`)이 `gh search issues --json number,title,body` 의 stdout(JSON 문자열)을 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 로 파싱·검증하지만, 그 산출 배열 **전체**가 raw stdout 으로부터 올바른 개수·순서·필드값(number/title/body)·추가필드 drop 으로 단조 재유도됐는지 build-time 에 확인하는 **값-정합 가드는 부재**다.

본 task 는 그 gap 을 메우는 **값-정합 가드**를 신설한다 — 산출 `hits`(`RealDataDailyStepDualLegRunReportIssueSearchHit[]`)와 raw `stdout` 을 입력받아, 컴포저 재호출 없이 stdout 을 독립 재유도(`JSON.parse` → 배열 guard → 각 원소 non-null 객체 → number 양의 정수 → title/body 문자열 → `{number, title, body}` 정규화)한 expected 배열과 deep-equal 대조해, 파서가 silent 하게 잘못된 개수·순서·값·추가필드를 산출하면 build-time fail-fast 로 차단한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 정합 — 손상 hits 가 caller action resolver 로 새기 전 차단). 이는 summary 축 선례 **T-0721**(`assertRealDataResultIssueSearchOutputConsistentWithStdout`, `realdata-e2e-result-issue-search-parse-consistency.ts`)의 정확한 dual-leg 축 mirror 다. self-wire 짝은 후속 slice(summary 축 T-0721→T-0722 신설/self-wire 분리 패턴 동형, dual-leg output 축 T-0906→T-0907 동형)로 분리한다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 test helper 신설이라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — 가드 대상 컴포저(`parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout): RealDataDailyStepDualLegRunReportIssueSearchHit[]`, L111)와 재유도 single-source 규칙: `JSON.parse(stdout)` 배열 guard(L118) → 각 원소 non-null 객체 guard(L128) → `assertHitNumber`(number 양의 정수, L72) → `assertHitString`(title/body 문자열, L85) → `{number, title, body}` 정규화(추가 필드 drop, L142). `RealDataDailyStepDualLegRunReportIssueSearchHit` type 은 `./realdata-e2e-daily-step-dual-leg-run-report-issue-action`(T-0898)에서 `import type` 재사용(L67).
- `test/helpers/realdata-e2e-result-issue-search-parse-consistency.ts`(T-0721 산출물, main 박제) — **summary 축 동형 값-정합 가드 신설의 직접 참조 원본**. `reDeriveExpectedHits`(독립 재유도, 컴포저 재호출 0) + `assertHitsStructure`(구조 결손 TypeError) + `areHitsDeepEqual`(개수·순서·필드값·추가필드 drop 정합 — `Object.keys(hit).length !== 3` 키집합 체크 포함) + `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)`(구조결손 TypeError ↔ 값정합 위반 RangeError 분리). 본 helper 는 이를 dual-leg 축 심볼명으로 mirror(검증 대상만 result→dual-leg 로 변경).
- `test/helpers/realdata-e2e-result-issue-search-parse-consistency.spec.ts`(T-0721 spec) — colocated spec 구성·negative case 커버 폭·에러 분기(TypeError/RangeError) 검증 패턴의 직접 참조.
- `docs/tasks/T-0906-realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-value-consistency.md`(직전 sibling, 같은 dual-leg 축 값-가드 신설 선례) — Acceptance Criteria 구성·구조결손/값정합 분리·결정성/비변형 검증 룰·spec 위치 ordering 참고.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts` 추가. `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout)`(또는 동형 명세) export — 산출 `hits`(`RealDataDailyStepDualLegRunReportIssueSearchHit[]`)와 raw `stdout` 을 입력받아, stdout 을 컴포저 재호출 없이 독립 재유도(`JSON.parse` → 배열 guard → 각 원소 non-null 객체 → number 양의 정수 → title/body 문자열 → `{number, title, body}` 정규화, 추가 필드 drop)한 expected 배열과 개수·순서·필드값·키집합(3 키) 면에서 deep-equal 대조한다. 컴포저(`parseRealDataDailyStepDualLegRunReportIssueSearchOutput`)는 **호출하지 않는다**(재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심).
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — `hits` 가 배열 아님·원소가 non-null 객체 아님·stdout 이 string 아님·stdout 이 비-JSON(SyntaxError)·JSON 이 비배열·원소가 비객체·number 비양정수·title/body 비문자열 → TypeError(재유도 자체 불가·구조 결손). 재유도 expected 와 산출 `hits` 가 개수·순서·필드값·추가필드 drop 면에서 어긋남 → RangeError(값 정합 위반, 기대 vs 실측 노출). 한국어 명세형 에러 메시지.
- [ ] **Happy-path unit test 1+** — 정상 stdout(단일 hit · 다중 hit 순서 보존 · `"[]"` 0건 · gh 미래 추가 필드가 섞인 원소가 `{number,title,body}` 로 drop 정합)에 대해 컴포저 산출이 가드를 void 통과하는 test 1+.
- [ ] **Error path unit test 1+** — number 값 drift(산출 number ≠ stdout 원소 number)·title/body 값 drift·hit 누락/중복·순서 재정렬·추가필드 누설(산출 hit 이 3 키 초과) 각각에 대해 가드가 throw(값-정합 위반 RangeError)하는 test.
- [ ] **Flow / branch cover** — 각 재유도·비교 분기 1+ test: stdout 비-string / 비-JSON(SyntaxError) / JSON 비배열(object/string/number/null) / 원소 비객체(null/숫자/문자열) / number 비양정수(0·음수·비정수·비숫자) / title·body 비문자열 / hits 비배열 / hits 원소 비객체 / 개수 불일치 / 값 불일치 / 키집합(3 키) 위반.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(예외 분기마다): 구조결손(hits 비배열·hits 원소 비객체·stdout 비-string·stdout 비-JSON·JSON 비배열·원소 비객체·number 비양정수·title/body 비문자열) TypeError 경로 각 1+, 값정합 위반(number 값·title 값·body 값·hit 개수·순서·추가필드 drop) RangeError 경로 각 1+.
- [ ] **결정성·비변형 검증** — 동일 입력 두 번 호출 결과 동형(다중 hit 순서 결정론 포함), 입력 `hits`/`stdout` 비변형(가드가 입력 mutate 0) test 1+.
- [ ] **R-59 / REQ-059 정합** — raw 활동 본문·narrative·credential 이 에러 메시지/산출에 노출되지 않음 단언(가드는 number 식별자·title/body string 동치·개수·index·필드 타입만 다룸 — 비-issue 본문 미보유).
- [ ] `RealDataDailyStepDualLegRunReportIssueSearchHit` 는 `realdata-e2e-daily-step-dual-leg-run-report-issue-action` 에서 `import type` 재사용(신규 type 정의 금지). 재유도 검증 규약(배열 → non-null 객체 → number 양정수 → title/body 문자열 → 정규화)은 컴포저와 동형으로 **독립 재구현**(컴포저 재호출 0 원칙 유지).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.spec.ts` 에 위 test 박제(colocated 우선 — NestJS/discoverability convention). `describe`/`it` 문자열 한국어로 가드 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — 신규 가드 파일은 line/branch/func/stmt 100% 목표).

## Out of Scope

- 컴포저 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 의 self-wire 배선(본 task 는 가드 **신설만** — self-wire 짝은 후속 slice, summary 축 T-0721→T-0722·dual-leg output 축 T-0906→T-0907 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` 로직 변경(가드 신설 단독, 출력 byte-identical 보존).
- output-parse 축 값-정합 가드(`...output-parse-consistency.ts`, T-0906/T-0907) 및 outcome-parse-shape set-equality 가드(T-0904/T-0905) 변경 — 본 task 는 search-parse 값-정합 가드 단일.
- 실 gh search 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행(step ④ live wiring — credential gate, deferred).
- `deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 realdata-e2e seam(search-argv/descriptor/command-args/gh-argv/gh-command-plan/action) 가드 또는 self-wire.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency(zod/ajv/execa 등 금지 — 내장 `JSON.parse` + 수동 재유도만) / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (test-only 값-정합 가드 신설 — 아키텍처 결정 없음, summary 축 T-0721 직접 mirror 라 architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 값-정합 가드 producer self-wire(summary 축 T-0722 mirror)는 다음 planner 가 후속 slice 로 큐잉 후보.)

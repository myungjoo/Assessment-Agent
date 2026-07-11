---
id: T-0903
title: realdata-e2e daily-step dual-leg run report 이슈 gh create/edit stdout → 박제 결과 순수 파서 신설
phase: P5
status: DONE
mergedAs: 10577060
prNumber: 797
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 185
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts
plannerNote: "P5 §109 step④ — T-0902 gh-command-plan 종단 컴포저 다음 자연 경계(post-execution 해석 측, T-0589 mirror). gh issue create/edit stdout → {issueNumber,url} 순수 파서. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0903 — realdata-e2e daily-step dual-leg run report 이슈 gh create/edit stdout → 박제 결과 순수 파서 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 멱등 박제**(create-or-update)하라 지시한다. dual-leg run report 축의 build-time chain 은 이미 (1) 컴포저(T-0894) → (2) 마크다운 렌더러(T-0895) → (3) descriptor(T-0896) → (4) 명령-args(T-0897) → (5) action resolver(T-0898) → (6) gh create/edit argv 빌더(T-0899) → (7) gh search argv 빌더(T-0900) → (8) search stdout 파서(T-0901) → (9) gh command plan 종단 컴포저(T-0902, `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs): {action, argv}`)까지 순수 함수로 닫혔다.

그러나 caller(live wiring)가 `execFile('gh', argv)` 로 이슈를 실 박제한 뒤 **그 stdout(생성/수정된 이슈 URL — 예: `https://github.com/owner/repo/issues/42`) 을 구조화된 결과 `{issueNumber, url}` 로 파싱·검증하는 실행-후(post-execution) 단계** 가 빠져 있다. 이는 search 응답 파서(T-0901, 실행 **전** 측)의 정확한 대칭 — 실행 **후** 측 stdout 파싱이며, summary 축의 선례 **T-0589**(`parseRealDataResultIssueCreateEditOutput(stdout): {issueNumber, url}`)의 dual-leg 축 mirror 다.

본 slice 가 박제되면 dual-leg build-time chain 이 입력(search argv/parse)부터 출력(create/edit 결과 확인)까지 round-trip 으로 닫힌다. REQ-059(raw 미저장) 정합: 파서는 stdout 에서 issueNumber/url 만 추출하고 본문/narrative 는 보유하지 않는다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 파서라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0589-realdata-e2e-result-issue-output-parse.md` — summary 축의 동형 선례(파서 동작·URL 패턴 추출·다중 줄 첫-매칭 결정론·throw 규약·R-112 cover 구조·Out of Scope 표기). 본 task 는 그 dual-leg 축 mirror. **주의: 본 slice 는 T-0589 의 base 파서만 mirror 한다 — 이후 summary 축이 붙인 parse-shape/consistency 가드(T-0661/T-0662/T-0723/T-0724)는 본 task 범위 밖(별도 후속 slice).**
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — T-0901 대칭 파서(실행 **전** 측). 엄격 검증·무공유·결정론·dependency-free 패턴을 본 helper 가 동형으로 따른다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts` — colocated spec 구조(happy/error/negative case 묶음) 참고.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` line 82~135 — `RealDataDailyStepDualLegRunReportIssueAction` discriminated union·`assertPositiveNumber`(양의 정수 number 규약, 비-export private). issueNumber 검증을 동형 규약(양의 정수)으로 정합하되, private 이므로 본 helper 는 자체 inline 검증으로 동형 규약을 재현한다(복제 최소·중복 정의 금지 원칙 하에 number guard 는 정규표현식 매칭 + 양의 정수 확인).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — chain 종단 컴포저(T-0902). 본 파서가 그 후속 단계(execFile 결과 해석)임을 확인.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts`(순수 파서) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts`. production `src/`·T-0894~T-0902 helper·summary-축 helper 수정 0.
- [ ] **파서 신설** — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout: string): RealDataDailyStepDualLegRunReportIssueOutcome` 순수 함수. `gh issue create` / `gh issue edit <n>` 의 stdout(이슈 URL 을 포함한 줄)에서 `https://github.com/<owner>/<repo>/issues/<number>` 패턴을 찾아 `{ issueNumber: number, url: string }` 로 파싱·검증. `<number>`(양의 정수) + 정규화된 `url`(trailing whitespace/개행 trim) 추출. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **outcome type 신설** — `export interface RealDataDailyStepDualLegRunReportIssueOutcome { issueNumber: number; url: string }`. (summary 축 `RealDataResultIssueOutcome` 의 dual-leg mirror — 별도 축이라 신규 정의가 맞다. 기존 dual-leg helper 에는 outcome type 이 없으므로 중복 아님.)
- [ ] **다중 줄 첫-매칭 결정론** — gh 가 부가 메시지를 출력할 수 있어 stdout 은 여러 줄일 수 있다. issue URL 패턴을 포함한 **첫 매칭** 을 사용해 결정론적으로 파싱(동일 stdout → byte-identical 결과).
- [ ] **엄격 검증(조용한 통과 금지)** — URL 패턴 미포함 stdout(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 등 다른 경로) → throw. `<number>` 가 양의 정수로 파싱 안 됨(`/issues/0`, `/issues/abc`, 음수) → throw. 비정상 stdout 이 조용히 통과해 잘못된 outcome 으로 새는 것을 차단.
- [ ] **Happy-path unit test 1+** — (a) 단일 URL 줄, (b) trailing 개행 포함 URL 줄, (c) 여러 줄 중 URL 줄 포함(gh 부가 메시지 + URL) → 각 `{issueNumber, url}` 정확 추출 검증.
- [ ] **Error path unit test 1+** — (a) URL 패턴 미포함(빈 문자열/무관 텍스트) → throw, (b) 비-github 호스트 URL → throw, (c) `/issues/` 가 아닌 `/pull/` 경로 → throw, (d) issueNumber 양의 정수 아님(`/issues/0`, `/issues/abc`) → throw — 각 별도 case.
- [ ] **Flow / branch cover** — URL 발견/미발견 분기, number 검증 통과/실패 분기, 다중 줄 vs 단일 줄 분기 각 1+ test. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지(분기마다): 빈 stdout / 공백-only stdout / URL 형식 깨짐(번호 누락 `…/issues/`) / number 0·음수·비정수 / 비-github 호스트 / `/pull/` 경로 / 앞뒤 공백·탭·개행 혼입 → 각 1+ 검증.
- [ ] **결정론·무공유** — 동일 stdout 두 번 호출 → deep-equal 결과(매 호출 새 객체 반환·입력 문자열 불변). test 1+.
- [ ] **R-59 정합** — 파서는 stdout 에서 issueNumber/url 만 추출하고 본문/narrative 는 보유하지 않는다. 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 실행-후 해석(post-execution) 단계 + "실 `execFile('gh', ...)` 은 deferred(본 파서는 이미 받은 stdout → outcome 산출까지만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리(zod 등) 0. 내장 정규표현식 + 수동 검증만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — execa/zod 등 도입 금지.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 파서 파일 branch/func/line 100% 목표(single-helper 라 100% 기대).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts`(T-0901 search-parse spec·summary-축 T-0589 output-parse spec 과 동일 디렉토리·convention). `describe`/`it` 문자열 한국어로 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `execFile('gh', argv)` 실행 / `gh issue create`·`gh issue edit` 실 실행**(step ④ live wiring — credential gate, deferred). 본 파서는 이미 받은 stdout → outcome 만 산출(부수효과 0).
- **parse-shape / outcome-consistency 값-정합 가드**(summary 축 T-0661/T-0662/T-0723/T-0724 후속 slice) — 본 task 는 base 파서만. 가드 self-wire 는 후속 task 로 분리.
- **argv 합성(T-0899 위임) · search argv 합성(T-0900 위임) · search 응답 파싱(T-0901 위임) · 종단 command-plan 합성(T-0902 위임)** — 본 helper 는 create/edit stdout 파싱 단일 책임.
- **`RealDataDailyStepDualLegRunReportIssueAction`/`...SearchHit`/`...CommandArgs` 등 기존 type 수정·재정의** — 본 task 는 outcome type 신규만.
- **summary 축(T-0580~T-0595) 수정·재호출** — 재구현 0. 본 task 는 dual-leg 축의 실행-후 outcome 파서 신설만.
- **`deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).**
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

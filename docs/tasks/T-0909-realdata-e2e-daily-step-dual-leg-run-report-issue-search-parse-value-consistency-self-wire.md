---
id: T-0909
title: dual-leg run report 이슈 search-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선 (parseRealDataDailyStepDualLegRunReportIssueSearchOutput)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-search-parse-consistency-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts
plannerNote: "P5 §109 step④ — T-0908 신설 search-parse 값-정합 가드의 컴포저 self-wire (summary 축 T-0722·output 축 T-0907 mirror). return parsed.map(...) 을 const hits 로 묶고 return 직전 assertSearchOutputConsistentWithStdout(hits, stdout) 1줄. type-only import 라 순환 0·top-level import. 가드 신설→self-wire 2-slice 마감."
---

# T-0909 — dual-leg run report 이슈 search-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ dual-leg run report 축 build-time consistency-guard sweep 의 search leg 값-정합 짝 닫기 task 다. 직전 T-0908(PR #802, squash)이 컴포저 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts`)의 **값-정합 가드** `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout)`(main 박제 L217 — stdout 만으로 expected `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 을 컴포저 재호출 없이 독립 재유도해 deep-equal 대조 — hit 개수·순서·number/title/body 값 drift·추가필드 누설 fail-fast)를 **신설만** 했다. 그러나 컴포저 자신의 단일 return 사이트(main L125 `return parsed.map(...)`)는 아직 그 신설 값-정합 가드를 배선하지 않아, 본 가드는 spec 에서만 호출되고 컴포저 산출 배열 경로에는 미배선이다(origin/main grep 0 부재 확인 — `ConsistentWithStdout` 참조 컴포저 내 0).

본 self-wire 가 그 gap 을 컴포저 산출 경로에서 build-time fail-fast 로 닫는다. 이는 **summary 축 선례 T-0722**(`parseRealDataResultIssueSearchOutput` 의 값-정합 가드 self-wire, T-0721 신설 가드의 컴포저 배선)와 **dual-leg output 축 선례 T-0907**(output-parse 축 self-wire)의 정확한 dual-leg search 축 mirror 이며, dual-leg search 축 값-가드의 "가드 신설(T-0908) → self-wire(T-0909)" 2-slice 패턴 후반이다(summary 축 T-0721→T-0722, output 축 T-0906→T-0907 분리 패턴 동형). REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 마저 닫는다 — 손상 hits 가 caller action resolver 로 새기 전 컴포저 산출 지점에서 차단. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 배선이라 cloud cron 에서 자율 실행 가능하다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout)`(main L217~220) 로 **두 인자**(산출 `hits` + raw `stdout`)를 받는다. 컴포저 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 의 단일 return 사이트(main L125 `return parsed.map((element, index) => {...})`)에서 `stdout` 은 파라미터로, `hits` 는 `parsed.map(...)` 산출로 **둘 다 한 호출 안에서 가용**하다. 현 `return parsed.map(...)` 식을 `const hits = parsed.map(...)` 로 묶고, 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout);` self-assert 후 `return hits;` 로 전환하면 된다(T-0722 와 동형). **주의**: 본 컴포저는 summary 축 T-0722 컴포저와 달리 기존 per-hit set-equality self-wire 가 **없다**(main grep `MatchesParseShape` 컴포저 내 0) — 본 self-wire 가 이 컴포저의 **최초** self-wire 다. 따라서 "기존 set-equality self-wire 유지" 요건은 본 task 에 없다(제거할 대상이 애초에 없음).

**순환 의존 없음(top-level import)**: 값-정합 가드 `realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts`(T-0908) 는 `RealDataDailyStepDualLegRunReportIssueSearchHit` 를 `import type` only 로 `./realdata-e2e-daily-step-dual-leg-run-report-issue-action`(T-0898)에서 가져오고(main L50 확인) **컴포저로부터 value 를 import 하지 않는다**. 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0722/T-0907 type-only top-level import mirror — lazy require 불요).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — self-wire 대상 컴포저 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout): RealDataDailyStepDualLegRunReportIssueSearchHit[]`(main L111). **단일 return 사이트**(L125 `return parsed.map((element, index) => {...})`, map 콜백은 원소 객체 guard·`assertHitNumber`·`assertHitString`·`{number, title, body}` 정규화 후 `return hit;`(L148)). self-wire 는 그 `return parsed.map(...)` 식을 `const hits = parsed.map(...)` 로 묶고, 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout);` self-assert 후 `return hits;` 로 전환. 산출 배열의 값·shape·결정성 byte-identical 무변경(검증 1 줄만 추가). 파일 상단(기존 `import type` 블록 L67 인근)에 값-정합 가드 top-level value import 1 줄 추가. **본 컴포저에는 기존 per-hit set-equality self-wire 가 없음**(제거·유지 대상 없음 — 최초 self-wire).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts`(T-0908 산출물, main 박제) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout): void`(L217, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError — `assertHitsStructure` + `reDeriveExpectedHits(stdout)` + `areHitsDeepEqual`). `RealDataDailyStepDualLegRunReportIssueSearchHit` 를 `import type` only 로 가져오고(L50) 컴포저 value import 0(순환 의존 0 근거). 본 task 는 이 파일을 **변경하지 않는다**(호출만 추가).
- `docs/tasks/T-0722-realdata-e2e-result-issue-search-parse-value-consistency-self-wire.md` + `test/helpers/realdata-e2e-result-issue-search-parse.ts`(T-0722 self-wire 완료본) + 그 spec — **summary 축 동형 self-wire mirror**. `return parsed.map(...)` → `const hits = parsed.map(...); assert(hits, stdout); return hits;` 전환 + top-level import 패턴(lazy require 불요)·jest.spyOn 검증(호출 1회·인자 순서 `(hits, stdout)`·throw 선전파·산출 byte-identical) 구성을 그대로 따른다. 검증 대상만 result→dual-leg 로 바꾼 mirror.
- `docs/tasks/T-0907-realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-value-consistency-self-wire.md`(직전 sibling) — 같은 dual-leg 축 output leg 값-가드 self-wire 선례. spec describe append 위치·byte-identical 보존 룰·negative case 커버 폭 참고. (단 output 축 컴포저는 set-equality self-wire 가 있었고 본 search 축 컴포저는 없음 — 그 차이 유의.)
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

`parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 단일 return 사이트 직전에 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 배열의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`...search-parse-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` 상단(기존 `import type` 블록 인근)에 `import { assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 의 `return parsed.map(...)` 식(L125)을 `const hits = parsed.map(...)` 로 묶고, 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout);` self-assert 후 `return hits;`. 산출 배열·각 원소 값·참조-무공유(매 호출 새 배열·새 객체) 무변경. 인자 순서 `(hits, stdout)` 준수(가드 시그니처와 동일).
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 hits·stdout 을 읽기·재유도·비교만 — 산출 값·순서·필드 무변경).
- [ ] 가드 본체(`...search-parse-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path unit test 1+**(`...search-parse.spec.ts` self-wire describe) — `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 가 정상 stdout(단일 hit·다중 hit 순서 보존·`"[]"` 0건·gh 미래 추가 필드가 섞인 원소가 `{number,title,body}` 로 drop 정합)에 대해 throw 0 으로 기존과 동일한 hits 배열을 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 hits + 원본 stdout 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 hits 와 동일 참조·둘째 인자가 입력 stdout 과 동일·인자 순서 `(hits, stdout)`.
- [ ] **Error path unit test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout` 가 RangeError(값 정합 위반) 또는 TypeError(구조 결손)를 throw 하도록 강제하면 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError 분기·TypeError 분기 각 1+.
- [ ] **Flow / branch cover** — 정상(void → return hits) 경로 1+ test. self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로 cover. 기존 컴포저 자체 분기(stdout 비-JSON throw·비배열 throw·원소 비객체 throw·number 비양정수 throw·title/body 비문자열 throw)는 self-wire 도달 전 단계라 self-wire 가 그 분기 동작을 바꾸지 않음을 무회귀로 확인.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(분기·예외 상황마다): (a) 가드 throw 선전파 RangeError·TypeError 각 1+, (b) 기존 컴포저 자체 throw 경로(비-JSON stdout·비배열 JSON·원소 비객체·number 비양정수·title/body 비문자열)가 self-wire 도달 **전**에 throw 돼 값-정합 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음), (c) 정상 hits 에 대해 가드 throw 0, (d) 입력 stdout 비변형(순수성 보존) test 1+, (e) 동일 stdout 두 번 호출 시 산출 deep-equal·참조-무공유(매 호출 새 배열·새 객체)·spy 2 회 호출(결정론) — 각 1+ test.
- [ ] **R-59 / REQ-059 정합** — self-wire 후에도 파서는 `{number, title, body}` hit 만 산출하고 이슈 본문/narrative/credential 을 별도 보유·노출하지 않는다(가드는 number·title/body 값·개수·index·타입만 다룸 — T-0908 가드 본체 보장 그대로).
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 새 외부 라이브러리(zod/execa 등) 0. import 는 값 import(가드)이며 `process.env` 읽기 0. import 추가로 인한 runtime cycle 0(값 import 이므로 import graph 가 cycle 을 만들지 않는지 tsc green 으로 확인).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts` 에 self-wire describe **append**(신규 spec 파일 신설 금지, 기존 colocated 에 추가). `describe`/`it` 문자열 한국어로 self-wire 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — 변경한 `search-parse.ts` line/branch/function 100% 유지 목표). 전체 unit suite green(기존 search-parse spec·consistency spec 무회귀).

## Out of Scope

- 가드 본체(`...search-parse-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 의 파싱·검증 규약(`JSON.parse`·배열 guard·원소 객체 guard·`assertHitNumber`·`assertHitString`·`{number, title, body}` 정규화·추가필드 drop) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0722/T-0907 mirror). lazy require 는 value-import 가드 패턴이며 본 task 엔 부적합.
- output-parse 축 값-가드(T-0906/T-0907) 및 outcome-parse-shape set-equality 가드(T-0904/T-0905) 변경 — 본 task 는 search-parse 값-정합 가드 self-wire 단일.
- 실 gh search 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행(step ④ live wiring — credential gate, deferred).
- `deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 realdata-e2e seam(search-argv/descriptor/command-args/gh-argv/gh-command-plan/action/output-parse/outcome-parse-shape)의 추가 가드 또는 self-wire — 본 task 는 search-parse 값-정합 가드 self-wire 단일.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0722/T-0907 self-wire mirror 라 architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. search-parse 값-가드 짝(T-0908 신설 + 본 self-wire) 닫힘 후, 잔여 dual-leg run report seam(search-argv/descriptor/command-args/gh-argv/gh-command-plan/action)의 값-정합 가드 적용 여부는 다음 planner 가 case-by-case 판정 후 별도 task.)

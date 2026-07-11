---
id: T-0910
title: dual-leg run report 종단 컴포저 산출 6필드 ↔ (evalOutcome, collectOutcome, run) single-source 재유도 값-정합 가드 신설
phase: P5
status: DONE
completedAt: 2026-07-11T05:05Z
result: "PR #804 merged (squash aa0f1a65). 종단 컴포저 buildRealDataDailyStepDualLegRunReport 산출 6필드 값-정합 가드+spec 신설(+361/+610, test-only 2 files). reviewer round1 APPROVE(0/0/2 MINOR non-blocking), 4-게이트 PASS, 375 suite/9838 test green. self-wire 는 후속 T-0911."
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-composer-output-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated R-112 spec 두 신규 파일이라 cap 초과 가능. T-0725(+320)/T-0906/T-0908 test-dominated 값-가드 sibling 선례 정합. src 무변경."
plannerNote: "P5 §109 step④ — 서브-parse 값-가드(search T-0908/09·output T-0906/07) 다음, 종단 컴포저 buildRealDataDailyStepDualLegRunReport 6필드 독립 재유도 값-가드 신설(summary 축 T-0725 mirror). self-wire 는 후속. pr-mode test-only 2파일 dep0."
---

# T-0910 — dual-leg run report 종단 컴포저 산출 6필드 ↔ (evalOutcome, collectOutcome, run) single-source 재유도 값-정합 가드 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ dual-leg run report 축 build-time consistency-guard sweep 을 잇는 task 다. 직전까지 이 축의 값-정합 가드는 **하위 parse seam** 두 곳 — output-parse(T-0906 신설 → T-0907 self-wire)와 search-parse(T-0908 신설 → T-0909 self-wire) — 에만 박제됐다. 그러나 이 축의 **종단 컴포저** `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)`(T-0894, `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`)는 `(evalOutcome, collectOutcome, run)` 3 입력을 6 필드 report `{gitSha, dateToken, eval:{action,status}, collect:{action,status}, overallStatus, summaryLine}` 로 묶는 결정론적 컴포저인데, **산출 6 필드 전체를 입력으로부터 컴포저 재호출 없이 독립 재유도해 deep-equal 대조하는 값-정합 가드는 부재**다(main grep `dual-leg-run-report-consistency.ts` 0 — 하위 seam 의 `...output-parse-consistency`/`...search-parse-consistency` 만 존재).

이 종단 컴포저에는 현재 가드가 아예 없어, per-leg status 파생(run+passed→pass/fail, skip→skip)·overallStatus 파생(fail 최우선 → some-fail/all-pass/all-skip/partial)·gitSha/dateToken 전파·summaryLine 템플릿 합성 중 어느 하나라도 값 drift 가 생겨도 build-time 에 잡히지 않는다. 본 가드가 그 gap 을 종단 산출 지점에서 build-time fail-fast 로 닫는다.

이는 **summary 축 선례 T-0725**(`buildRealDataResultIssueOutcomeReport` 종단 컴포저의 5 필드 산출 ↔ `(outcome, run)` 독립 재유도 값-가드 신설, self-wire 짝은 T-0726)의 정확한 dual-leg 축 mirror 다. summary 축이 하위 parse 값-가드(T-0721~T-0724) 다음 종단 컴포저 값-가드(T-0725/26)로 확장한 순서를, dual-leg 축이 하위 parse 값-가드(T-0906~T-0909) 다음 종단 컴포저 값-가드(본 T-0910 신설 → 후속 self-wire)로 동형 확장한다. REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 종단 컴포저까지 마저 닫는다 — 손상 report 가 하위 descriptor/markdown/command-args wiring 으로 새기 전 컴포저 산출 지점에서 차단. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 test helper 라 cloud cron 에서 자율 실행 가능하다.

**독립 재유도 원칙(재호출 0)**: 가드는 컴포저 `buildRealDataDailyStepDualLegRunReport` 를 **호출하지 않는다**. 컴포저 재호출 deep-equal 은 컴포저 자체 버그를 양방향으로 상쇄해 무의미하므로, 가드는 `(evalOutcome, collectOutcome, run)` 로부터 per-leg status·overallStatus·summaryLine 을 **독립 재구현**해 expected 6 필드를 만든 뒤 산출 `report` 와 deep-equal 대조한다(T-0725 와 동형). leg 라벨 정합(eval 자리 eval·collect 자리 collect)·action/passed 정합(run+passed 필수·skip+passed 금지)도 재유도 단계에서 검증한다.

**순환 의존 없음(향후 self-wire top-level import 근거)**: 본 가드는 입력·출력 type(`RealDataDailyStepLegRunOutcome`, `RealDataDailyStepDualLegRunReport`, `RealDataDailyStepLegStatus`, `RealDataDailyStepDualLegOverallStatus`)을 컴포저 파일에서 `import type` only 로, `RealDataResultIssueRunRef` 를 `./realdata-e2e-result-issue-descriptor` 에서 `import type` 로 가져온다(value import 0). 따라서 후속 self-wire task 에서 컴포저가 본 가드를 top-level value import 해도 CommonJS 순환 의존이 생기지 않는다(T-0725→T-0726, T-0906→T-0907 mirror — 본 task 는 가드 신설만, self-wire 는 후속).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 가드 대상 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)`. 재유도해야 할 single-source 규칙: (1) run.gitSha/dateToken 빈/공백 guard, (2) leg 라벨 정합(`assertLegLabel` — eval 자리 eval·collect 자리 collect, cross-wiring throw), (3) per-leg status 파생(`resolveLegStatus` — action="run"+passed=undefined throw, action="skip"+passed 정의 throw, run+passed=true→"pass"·false→"fail"·skip→"skip"), (4) overallStatus 파생(`deriveOverallStatus` — fail 최우선 some-fail, 둘 다 pass→all-pass, 둘 다 skip→all-skip, 그 외 partial), (5) summaryLine 합성 템플릿 `` `[${run.dateToken}@${run.gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}` ``, (6) 산출 6 필드 `{gitSha, dateToken, eval:{action,status}, collect:{action,status}, overallStatus, summaryLine}` 형상. 입력·출력 type 이 모두 이 파일에 정의됨(가드가 `import type` 재사용 대상).
- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts`(T-0725 산출물) — **summary 축 종단 컴포저 값-가드 직접 mirror**. 독립 재유도(컴포저 재호출 0) + expected 6/5 필드 deep-equal + **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** + 어느 필드가 drift 했는지 메시지 노출 패턴을 그대로 따른다(5필드 outcome-report → 6필드 dual-leg run report 로 대상만 변형).
- `docs/tasks/T-0725-realdata-e2e-result-issue-outcome-report-output-value-consistency.md` — mirror task 정의서. Acceptance Criteria 분기 커버 폭·negative cases 구성·§9 정합 단언 항목을 dual-leg 6필드로 옮겨 적용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-output-parse-consistency.ts` + 그 spec(T-0906) — 같은 dual-leg 축 하위 seam 값-가드 선례. TypeError↔RangeError 분리·독립 재유도·colocated spec 구성·describe/it 한국어 명세 패턴 참고.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계 line/func ≥ 80%) · §12(언어 정책).

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts` 추가. `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)`(또는 동형 명세) export — 산출 `report`(`RealDataDailyStepDualLegRunReport`)와 입력 `evalOutcome`/`collectOutcome`(`RealDataDailyStepLegRunOutcome`)·`run`(`RealDataResultIssueRunRef`)을 받아, `(evalOutcome, collectOutcome, run)` 로부터 컴포저 재호출 없이 독립 재유도(leg 라벨 정합 → per-leg status 파생 → overallStatus 파생 → gitSha/dateToken 전파 → summaryLine 동형 합성)한 expected 6 필드와 deep-equal 대조한다. 컴포저(`buildRealDataDailyStepDualLegRunReport`)는 **호출하지 않는다**.
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — 입력 자체가 비정상(report/evalOutcome/collectOutcome/run 이 non-null 객체 아님·필드 type 위반·run.gitSha/dateToken 빈/공백·leg 라벨 오류·action="run"+passed=undefined·action="skip"+passed 정의 등 재유도 자체 불가)이면 TypeError, 재유도 expected 와 산출 report 의 어느 6 필드(gitSha·dateToken·eval.action·eval.status·collect.action·collect.status·overallStatus·summaryLine)라도 값이 어긋나면 RangeError(어느 필드가 expected vs actual 로 drift 했는지 메시지에 노출)로 분기. 한국어 명세형 에러 메시지.
- [ ] **Happy-path unit test 1+**(colocated `...run-report-consistency.spec.ts`) — 정상 입력(run+passed=true → all-pass·run+passed=false → some-fail·둘 다 skip → all-skip·pass/skip 혼합 → partial 각 대표 조합)에 대해 컴포저 산출 report 가 가드를 void 통과. overallStatus 4 값 각각을 만드는 입력 조합 happy-path 최소 1+.
- [ ] **Error path unit test 1+** — gitSha/dateToken 전파 drift·eval.status 파생 drift(예: report 는 pass 인데 재유도는 fail)·collect.status drift·overallStatus 파생 drift·summaryLine 합성 drift(템플릿 토큰 순서·구분자·접두 어긋남·leg 라벨 문자열) 각각에 대해 가드가 RangeError throw. 구조결손 TypeError 경로(입력 비객체·필드 type 위반·run.gitSha 공백·leg 라벨 오류·action/passed 모순) 각 1+.
- [ ] **Flow / branch cover** — 재유도·비교 분기마다 test branch 분리: gitSha 비교 / dateToken 비교 / eval.action·eval.status 비교 / collect.action·collect.status 비교 / overallStatus 비교 / summaryLine 합성·비교 / report 비객체 / evalOutcome·collectOutcome·run 비객체 / report 필드 type 위반 / leg 라벨 오류 / action="run"+passed=undefined / action="skip"+passed 정의 각 1+.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(예외 분기마다): (a) 구조결손 TypeError 경로(report/evalOutcome/collectOutcome/run 이 null/숫자/문자열·report 필드 type 위반·run.gitSha/dateToken 빈/공백·eval 자리 collect 라벨(cross-wiring)·action="run"인데 passed undefined·action="skip"인데 passed 정의) 각 1+, (b) 값정합 위반 RangeError 경로(gitSha·dateToken·eval.status·collect.status·overallStatus·summaryLine 각 필드 drift) 각 1+, (c) 정상 report 에 대해 throw 0, (d) 입력 report/evalOutcome/collectOutcome/run 비변형(가드 mutate 0) 1+, (e) 동일 입력 두 번 호출 결정성(deep-equal·동일 판정) 1+ test.
- [ ] **§9 / REQ-059 정합** — raw 활동 본문·credential·specPath 가 에러 메시지/산출에 노출되지 않음 단언(가드는 gitSha·dateToken·leg action/status·overallStatus·summaryLine 값만 다루고, outcome.specPath 는 report 로 전파되지 않으므로 재유도 대상도 아님을 확인).
- [ ] **결정론·독립 재구현** — summaryLine 템플릿·overallStatus 파생·per-leg status 파생 규약은 컴포저와 동형으로 **독립 재구현**(재호출 0 원칙 유지). `RealDataDailyStepLegRunOutcome`/`RealDataDailyStepDualLegRunReport`/`RealDataDailyStepLegStatus`/`RealDataDailyStepDualLegOverallStatus` 는 `./realdata-e2e-daily-step-dual-leg-run-report` 에서, `RealDataResultIssueRunRef` 는 `./realdata-e2e-result-issue-descriptor` 에서 각각 `import type` 재사용(신규 type 정의 금지, value import 0 → 후속 self-wire 순환 0 근거).
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 새 외부 라이브러리(zod 등) 0. 내장 수동 재유도·비교만.
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.spec.ts` 에 박제(colocated 우선 — NestJS/discoverability convention). `describe`/`it` 문자열 한국어로 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — 신규 가드 파일 line/branch/function 100% 목표). 전체 unit suite green(기존 dual-leg run report spec·하위 seam 가드 spec 무회귀).

## Out of Scope

- 컴포저 `buildRealDataDailyStepDualLegRunReport` 의 self-wire 배선(본 task 는 가드 신설만 — self-wire 짝은 후속 task, summary 축 T-0725→T-0726 / dual-leg output 축 T-0906→T-0907 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-daily-step-dual-leg-run-report.ts` 로직 변경(가드 신설 단독, 산출 byte-identical 보존).
- 하위 seam 값-가드(output-parse T-0906/07·search-parse T-0908/09) 및 outcome parse-shape set-equality 가드(T-0904/05) 변경 — 본 task 는 종단 컴포저 값-가드 단일.
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / step ④ live wiring(credential gate, deferred).
- `deploy/daily-test.sh` step wiring / 실 jest spawn / 실 leg outcome 캡처 / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 dual-leg run report seam(descriptor·markdown·command-args·gh-argv·gh-command-plan·action)의 값-정합 가드 — 본 task 는 종단 컴포저 산출 단일.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (test-only 값-정합 가드 신설 — 아키텍처 결정 없음, type-only import 재사용·독립 재유도라 순환 0, summary 축 T-0725 mirror 라 architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 본 가드 신설 후 종단 컴포저 self-wire 배선은 후속 task 로 planner 가 큐잉(T-0725→T-0726 분리 패턴 동형). 잔여 dual-leg run report seam(descriptor·markdown·command-args·gh-argv·gh-command-plan·action)의 값-정합 가드 적용 여부는 다음 planner 가 case-by-case 판정.)

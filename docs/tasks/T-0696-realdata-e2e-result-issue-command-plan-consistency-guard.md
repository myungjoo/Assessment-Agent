---
id: T-0696
title: realdata-e2e result-issue command-plan 종단 컴포저 산출 ↔ (results, run) single-source 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — result-issue command-plan 종단 컴포저(T-0594) 정합 가드 신설(plan↔(results,run) 재유도 대조). guard category × 1.5 × 1.0. T-0695 와 파일 disjoint 독립 stream.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts
  - test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-command-plan-guard
---

# T-0696 — realdata-e2e result-issue command-plan 종단 컴포저 산출 ↔ (results, run) single-source 재유도 정합 순수 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ post-evaluation interpretation(평가 산출 → 결과 이슈 박제) 측 종단 컴포저 `buildRealDataResultIssueCommandPlan(results, run)`(`realdata-e2e-result-issue-command-plan.ts`, T-0594)는 `EvaluationResult[]` + run 식별자를 입력 받아 (1) `buildRealDataResultReportPlan(results, run)`(T-0593) → `{summary, descriptor}`, (2) `buildRealDataResultIssueCommandArgs(report.descriptor)`(T-0583) → `RealDataResultIssueCommandArgs` 2-단계를 합성해 `{report, commandArgs}` plan 을 산출하는데, 이 종단 컴포저에는 **독립 정합 가드가 없다**(origin/main grep 0 확인 — `assertRealDataResultIssueCommandPlan*` 심볼·`*-command-plan-consistency.ts` 파일 부재, 컴포저 본문에 종단 plan 정합 self-wire 부재 — 컴포저 안의 assert 언급은 위임 helper 의 throw 전파 설명 주석일 뿐 plan 종단 정합 가드 호출 아님). command-args 빌더(T-0583)는 자체 sub-leaf self-wire(body-marker / labels-title 가드)를 갖지만, 그것은 한 단계 downstream(descriptor → command-args)만 검증할 뿐, **종단 컴포저의 산출 plan 전체(`report` + `commandArgs`)가 입력 `(results, run)` 으로부터 single-source 재유도한 plan 과 정합하는지**(2-단계 합성 순서·report→descriptor→commandArgs 위임 연결이 어긋나지 않았는지)를 강제하는 장치는 없다. 따라서 합성 회귀(report 와 commandArgs 의 descriptor 어긋남, report.descriptor ≠ commandArgs source descriptor, 위임 호출 순서 뒤바뀜, summary 집계 drift, §9 raw narrative 본문 누출)를 build-time 에 잡지 못한다. 본 task 는 그 짝의 **앞 절반(가드 신설)** 을 박제한다 — 산출 plan 을 입력 `(results, run)` 으로 동일 2 위임 helper 를 재호출해 single-source 재유도한 expected plan 과 대조하는 read-only fail-fast 순수 가드를 신설한다. self-wire(컴포저 반환 직전 배선)는 후속 task 로 짝을 닫는다. **T-0695 result-issue gh-command-plan(stdout-side 종단) 가드 신설과 동형이되 입력 축이 다른(`(results, run)` evaluation-side 종단) mirror — 두 task 는 파일·심볼·stream 모두 disjoint 독립**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — 가드 대상 종단 컴포저. 산출 타입 `RealDataResultIssueCommandPlan`({report, commandArgs}) + 2-단계 합성 순서(buildRealDataResultReportPlan → buildRealDataResultIssueCommandArgs) + 위임 helper throw 전파 정책 확인. 가드는 이 컴포저가 import 하는 동일 2 위임 helper(`buildRealDataResultReportPlan`, `buildRealDataResultIssueCommandArgs`)와 출력 type 을 import 재사용해 expected plan 을 single-source 재유도한다(합성 규칙 재구현 0 — 위임 재호출만, 중복 정의 0). **본 task 는 이 컴포저 파일을 수정하지 않는다**(self-wire 는 후속).
- `test/helpers/realdata-e2e-result-report-plan.ts` (origin/main, T-0593) — 재유도 위임 helper `buildRealDataResultReportPlan(results, run)`({summary, descriptor}) 시그니처 + `RealDataResultReportPlan` type. 가드는 입력 `(results, run)` 으로 이 helper 를 재호출해 expected report 를 single-source 재유도한다(집계·descriptor 규칙 재구현 0 — 위임만).
- `test/helpers/realdata-e2e-result-issue-command-args.ts` (origin/main, T-0583) — 재유도 위임 helper `buildRealDataResultIssueCommandArgs(descriptor)`({searchQuery, createArgs, updateArgs}) 시그니처 + `RealDataResultIssueCommandArgs` type. 가드는 재유도 report 의 descriptor 로 이 helper 를 재호출해 expected commandArgs 를 single-source 재유도한다(명령-args 합성 규칙 재구현 0 — 위임만).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` (T-0695 머지 후 origin/main; 미머지 시 `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts`/`.spec.ts` 를 대체 선례로) — **종단 컴포저 정합 가드 mirror 선례**. plan 산출물을 입력으로 helper 재호출해 single-source 재유도 후 대조하는 구조·throw 분기(구조 결손 TypeError / 값 정합 위반 RangeError·한국어 명세형 메시지)·read-only(입력 mutate 0)·결정론·colocated spec 패턴을 본 task 와 동형 차용. **단 본 task 는 그 가드의 dependsOn 이 아니며 파일·심볼 disjoint — 패턴 차용만**.
- `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` (origin/main, T-0594) — 컴포저 colocated spec 의 R-112 cover 구조 + `EvaluationResult[]` fixture(빈/단일/다수 result) + run-ref fixture(gitSha/dateToken) 재사용 참고. 가드 spec 의 정상/회귀 plan fixture 구성에 차용.

## Acceptance Criteria

- [ ] 신설 가드 파일 `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` 에 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)`(또는 동형 시그니처 — 산출 plan + 입력 `(results, run)` 을 받아 입력으로 expected plan 재유도) 를 export 한다. 가드는 입력 `(results, run)` 으로 동일 2 위임 helper(`buildRealDataResultReportPlan(results, run)` → 그 `report.descriptor` 로 `buildRealDataResultIssueCommandArgs(descriptor)`)를 재호출해 expected `{report, commandArgs}` 를 single-source 재유도한 뒤, 산출 plan 과 정합하는지 대조한다: (a) `plan.report` 가 재유도 report 와 deep equal(summary 집계 분포 + descriptor title/marker/body 일치), (b) `plan.commandArgs` 가 재유도 commandArgs 와 deep equal(searchQuery + createArgs{title, body, labels} + updateArgs{title, body} 까지 정합), (c) plan 의 두 필드 간 내부 정합(plan.commandArgs 가 plan.report.descriptor 로부터 합성된 것과 일관 — 재유도 축으로 자동 cover). 불일치 시 한국어 명세형 에러로 fail-fast throw(구조 결손 = TypeError / 값 정합 위반 = RangeError, 기대값 vs 실측값 노출). 합성 규칙(report 집계·descriptor·command-args 로직)은 위임 재호출로만 재유도(중복 정의 0).
- [ ] 가드는 **read-only fail-fast** 만 — 입력 `plan`/`results`/`run` 을 mutate 0, 자동 복구/정규화/기본값 채움/재합성 0. 정상 정합이면 void 반환(부수효과 0). 가드는 결정론(입력만의 함수, 시각/난수/전역 env 의존 0). raw 미저장(R-59) — descriptor.body / commandArgs body string 만 비교(narrative 원본 활동 본문은 plan 에 구조적 부재 — 미접촉).
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0 · 컴포저 파일(`realdata-e2e-result-issue-command-plan.ts`) 수정 0(self-wire 는 후속). test helper 단독 신설.
- [ ] happy-path unit test 1+ — colocated spec 에서 정상 plan(빈 `results` 배열 + 유효 run → count 0 report + 정상 commandArgs / 단일 result + 유효 run → 집계 report + commandArgs / 다수 result + 유효 run → 집계 report + commandArgs)에 대해 가드가 void(throw 0) 임을 검증. 정상 입력의 빈/단일/다수 분기 모두 통과 확인.
- [ ] error path unit test 1+ — 손상 plan(예: plan.report.summary 가 재유도 집계와 다름 / plan.commandArgs.searchQuery 가 재유도 marker 와 다름 / plan.report.descriptor 와 plan.commandArgs source descriptor 어긋남 / plan.commandArgs.createArgs.body 가 재유도와 불일치)에 대해 가드가 throw 함을 각 1+ test 로 검증. 추가로 구조 결손(plan null/undefined·plan.report 부재·plan.commandArgs 부재·plan.commandArgs.createArgs 비객체) → TypeError 분기 검증.
- [ ] flow / branch cover — 가드의 모든 대조 분기(report 대조 분기 + commandArgs.searchQuery 대조 + createArgs 대조 + updateArgs 대조 + 구조 검증 분기)마다 통과 case 와 실패 case 각 1+ test.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지, 각 회귀 유형마다 분리: (1) report summary 집계 drift(재유도 분포와 count/분류 분포 불일치), (2) descriptor title/marker drift(재유도 descriptor 와 plan.report.descriptor 불일치), (3) commandArgs.searchQuery ≠ 재유도 marker(멱등 검색 토큰 어긋남), (4) createArgs.body ↔ updateArgs.body drift(재유도와 byte 불일치 — marker 라인 누락), (5) createArgs.labels 길이/순서/원소 어긋남(고정 labels 상수 drift), (6) report↔commandArgs cross 어긋남(plan.commandArgs 가 plan.report.descriptor 가 아닌 다른 descriptor 로 합성된 듯 — 재유도 대조로 검출) — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 가드 helper 의 line/branch/func/stmt 높은 cover(가능하면 100%), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts`(가드와 colocated, 신설). 새 공용 mock helper 추출 불요 — 컴포저 기존 spec(`realdata-e2e-result-issue-command-plan.spec.ts`)의 `EvaluationResult[]` fixture + run-ref fixture + T-0695/T-0693 가드 spec 패턴 재사용.

## Out of Scope

- **컴포저 self-wire(반환 직전 가드 호출 배선)** — 본 task 는 가드 신설만. 컴포저 `buildRealDataResultIssueCommandPlan` 본문 반환 직전(`return { report, commandArgs }` 직전)에 가드 호출을 삽입하는 self-wire 는 후속 task(짝 닫기, T-0694 패턴).
- **위임 helper(`buildRealDataResultReportPlan` / `buildRealDataResultIssueCommandArgs`) 수정** — 본 task 는 호출(재유도)만. 각 helper 의 합성 규칙·시그니처 불변.
- **command-args 빌더의 sub-leaf 가드(body-marker / labels-title, T-0646/T-0649)가 이미 cover 하는 descriptor→command-args round-trip 재검증** — 본 가드는 종단 plan 전체(report + commandArgs) 의 `(results, run)` single-source 재유도 정합에 집중. command-args 내부 marker-first / labels 세부는 sub-leaf 가드 책임(중복 회피 — 단 재유도 commandArgs 와 plan.commandArgs 의 deep equal 대조는 본 가드가 수행).
- **stdout-side 종단 가드(gh-command-plan-consistency, T-0695)** — 본 task 는 evaluation-side 입력 축(`(results, run)`)의 종단 컴포저 가드. T-0695 는 stdout-side 입력 축(`(stdout, commandArgs)`)의 별도 종단 컴포저 가드 — 파일·심볼·stream 모두 disjoint. 본 task 는 T-0695 와 의존 관계 0.
- **production `src/` 코드 변경** — 타입·위임 helper import 재사용만(`EvaluationResult` import type 만, 값 변경 0).
- **다른 leaf 가드 신설/배선** — 본 task 는 command-plan 종단 컴포저 가드 단일 신설만. 그 외 step④ 확장은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 신설만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (가드 신설 선례 T-0695/T-0693 명확 — architect 생략. 신설 가드 파일 1개 + colocated spec 1개. single-source 재유도(2 위임 helper 재호출) 대조 + 분기별 throw + R-112 4종 + negative 충분 cover).

## Follow-ups

- (본 task 머지 후) command-plan 종단 컴포저 **self-wire** 짝 닫기 task — 컴포저 `buildRealDataResultIssueCommandPlan` 반환 직전 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)` 호출 배선(T-0694 self-wire 패턴). 가드가 build-time 경로에 자동 발동되도록.
- step④ result-issue 측 build-time consistency 사슬의 잔여 leaf(descriptor 종단 / command-args 종단 등 이미 가드 존재 여부 재survey) 완결 점검 후 planner 가 다음 짝 큐잉.

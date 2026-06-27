---
id: T-0697
title: realdata-e2e result-issue command-plan 컴포저 self-wire 배선 (T-0696 가드 짝 닫기)
phase: P5
status: DONE
completedAt: 2026-06-27T00:30:00Z
prNumber: 613
mergeCommit: 93bc3c6f616b8bcb4aaf5ee432f99f14d577e626
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0696 신설 result-issue command-plan 가드를 컴포저 반환 직전 self-assert 배선(T-0694 self-wire mirror, evaluation-side). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan.ts
  - test/helpers/realdata-e2e-result-issue-command-plan.spec.ts
dependsOn: [T-0696]
independentStream: realdata-e2e-command-plan-guard
---

# T-0697 — realdata-e2e result-issue command-plan 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ post-evaluation interpretation(평가 산출 → 결과 이슈 박제) 측 종단 컴포저 `buildRealDataResultIssueCommandPlan(results, run)`(`realdata-e2e-result-issue-command-plan.ts`, T-0594)는 직전 T-0696 이 독립 정합 가드 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)`(`realdata-e2e-result-issue-command-plan-consistency.ts` L269)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(origin/main 컴포저 grep 0 확인 — L134 `return { report, commandArgs };` 직전에 가드 호출/import 부재). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(report 와 commandArgs 의 descriptor 어긋남, report.descriptor ≠ commandArgs source descriptor, 위임 호출 순서 뒤바뀜, summary 집계 drift, §9 raw narrative 본문 누출)를 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataResultIssueCommandPlan` 을 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 plan 이 step④ 박제 wiring 으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0694 daily-step-eval-command-plan self-wire 의 evaluation-side(result-issue) mirror — T-0695 stdout-side self-wire 짝(미큐잉)은 별도**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — self-wire 대상 종단 컴포저. **단일 return 사이트**(L134 `return { report, commandArgs };`). 본 task 는 그 반환 직전에 산출 plan 을 const 로 받아 self-assert 후 반환하도록 배선한다. 입력 `results`·`run` mutate 0·매 호출 새 plan 객체·위임 helper throw 그대로 전파 계약은 불변 유지. import 추가 1줄(가드 helper) + 반환 직전 2줄(const plan 선언 + 가드 호출) 패턴.
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` — 호출할 가드 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan: RealDataResultIssueCommandPlan, results: EvaluationResult[], run: RealDataResultIssueRunRef): void`(T-0696 신설, L269). 시그니처·throw 정책(구조 결손 TypeError / 값 정합 위반 RangeError·한국어 명세형 메시지)·read-only(입력 mutate 0) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` — 컴포저 colocated spec. self-wire 배선 후 정상 합성(빈/단일/다수 results)이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다.
- `docs/tasks/T-0694-realdata-e2e-daily-step-eval-command-plan-consistency-self-wire.md` — **self-wire mirror 선례**(머지 82c0853). 반환 직전 `assert...(plan, env);` 호출 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명·spec self-wire 회귀 test(jest.spyOn 으로 호출 1회 검증) 패턴을 본 task 와 동형 차용. **본 task 는 단일 return 사이트 + `(results, run)` 입력 축**(T-0694 는 양 분기 return + `env` 입력 축).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts` (origin/main, T-0694 self-wire spec 박제본) — self-wire 회귀 spec 선례. 정상 산출 self-assert 통과·반환 형태 보존·self-wire 발동 증명(jest.spyOn(consistency 모듈) 호출 1회 검증) test 패턴 차용.
- `docs/tasks/T-0696-realdata-e2e-result-issue-command-plan-consistency-guard.md` — 본 task 가 호출하는 가드의 신설 task. 가드의 6 회귀 유형(report summary drift / descriptor drift / searchQuery drift / createArgs↔updateArgs body drift / labels drift / report↔commandArgs cross drift)·throw 분기·R-59 raw 미저장 정책 확인(본 task 는 호출만 하므로 가드 본문 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-plan.ts` 의 `buildRealDataResultIssueCommandPlan` 가 산출 plan 을 **반환하기 직전** `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)` 를 호출하도록 배선한다(`import { assertRealDataResultIssueCommandPlanConsistentWithInputs } from "./realdata-e2e-result-issue-command-plan-consistency";` 추가 + 단일 return 사이트에서 `const plan: RealDataResultIssueCommandPlan = { report, commandArgs }; assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run); return plan;` 형태로 배선). 정상 합성이면 가드는 void → 반환 plan(report/commandArgs)·형태 보존(관측 불가능하게 동일).
- [ ] self-wire 배선 외 컴포저 로직(2-단계 위임 합성 순서·report 위임·commandArgs 위임·입력 mutate 0·매 호출 새 객체·결정론·R-59 raw 미보유 계약)은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만). 위임 helper throw 선전파 정책 불변.
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경(컴포저 본체 + colocated spec).
- [ ] happy-path unit test 1+ — colocated spec 에서 `buildRealDataResultIssueCommandPlan(results, run)` 가 정상 입력(빈 `results` 배열 + 유효 run / 단일 result + 유효 run / 다수 result + 유효 run)에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 모든 분기 검증. 반환 plan 형태(report.summary/descriptor + commandArgs.searchQuery/createArgs/updateArgs)·구조 보존도 확인.
- [ ] error path unit test 1+ — 위임 helper 가 잘못된 run(빈 gitSha/dateToken)에 throw 하는 정책은 기존 spec 이 cover. self-wire 가 **정상 산출물에 대해 가드를 우회/중복 throw 시키지 않음**을 검증(빈/단일/다수 results 의 정상 plan 모두 throw 0). 가드가 손상 plan 에 throw 하는 정책은 T-0696 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 직선 경로), 컴포저의 입력 분기(빈/단일/다수 results · 유효 run)마다 throw 0 정상 반환을 test 1+ 로 cover.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 빈 results + 유효 run → plan self-assert 통과(throw 0), (2) 단일 result + 유효 run → plan self-assert 통과(throw 0) + 반환 plan 보존, (3) 다수 result + 유효 run → plan self-assert 통과(throw 0) + 집계 plan 보존, (4) self-wire 발동 증명 회귀 test 1+(정상 산출물이 가드 불변식을 만족해 void 임 — self-wire 경로가 실제로 가드를 호출함을 jest.spyOn(consistency 모듈) 호출 1회 검증). self-wire 누락 시 fail 하도록.
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 가드를 호출함을 입증하는 test. jest.spyOn 으로 `assertRealDataResultIssueCommandPlanConsistentWithInputs` 호출이 정상 호출마다 정확히 1회 발생함을 검증, 인자 순서(plan, results, run) 도 확인. self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec `EvaluationResult[]` fixture + run-ref fixture + T-0694 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-result-issue-command-plan-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책/회귀 유형 6종은 T-0696 그대로 불변.
- **위임 helper(`buildRealDataResultReportPlan` / `buildRealDataResultIssueCommandArgs`) 수정** — 컴포저가 이미 호출하는 위임 helper. 본 task 에서 변경 0.
- **production `src/` 코드 변경** — step④ 박제 wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — 2-단계 위임 합성 순서·throw 선전파·결정론·매 호출 새 객체·R-59 raw 미보유 계약 불변. 자동 복구/정규화/기본값 채움 0.
- **stdout-side gh-command-plan self-wire(T-0695 가드 짝)** — 본 task 는 evaluation-side `(results, run)` 입력 축의 종단 컴포저 self-wire. T-0695 stdout-side `(stdout, commandArgs)` 입력 축의 self-wire 는 별도 task(짝 닫기 — 본 task 머지 후 큐잉).
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 result-issue command-plan self-wire 단일 짝만. 그 외 step④ 확장은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0694 명확 — architect 생략. 컴포저 1줄 import + 단일 return 사이트에서 const plan 선언 + 반환 직전 self-assert 삽입 + spec self-wire 회귀 test 추가).

## Follow-ups

- (본 task 머지 후) **T-0695 stdout-side self-wire 짝 닫기** task 큐잉 — `resolveRealDataResultIssueGhCommandPlan` 컴포저 반환 직전 T-0695 신설 가드 호출 배선(동형 self-wire 패턴). 본 task 는 evaluation-side 종단, T-0695 self-wire 는 stdout-side 종단 — 두 짝 모두 닫혀야 result-issue 측 build-time consistency 사슬 완결.
- step④ result-issue 측 build-time consistency 사슬의 잔여 leaf(descriptor 종단 / command-args 종단 등) 완결 점검 후 planner 가 다음 짝 큐잉.

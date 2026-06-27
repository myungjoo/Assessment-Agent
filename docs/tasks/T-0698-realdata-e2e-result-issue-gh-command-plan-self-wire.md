---
id: T-0698
title: realdata-e2e result-issue gh-command-plan 컴포저 self-wire 배선 (T-0695 가드 짝 닫기)
phase: P5
status: DONE
commitMode: pr
mergedAs: 86e8826
prNumber: 614
reviewRounds: 1
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0695 신설 gh-command-plan 가드를 컴포저 반환 직전 self-assert 배선(T-0697 self-wire 의 stdout-side mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan.ts
  - test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts
dependsOn: [T-0695]
independentStream: realdata-e2e-command-plan-guard
---

# T-0698 — realdata-e2e result-issue gh-command-plan 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ 결과 박제 측 **stdout-side 종단 합성 컴포저** `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(`realdata-e2e-result-issue-gh-command-plan.ts`, T-0588)는 직전 T-0695 가 독립 정합 가드 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`(`realdata-e2e-result-issue-gh-command-plan-consistency.ts` L207)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(origin/main 컴포저 grep 0 확인 — L60 `return { action, argv };` 직전에 가드 호출/import 부재). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(parse→resolveAction→buildGhArgv 3-단계 합성 순서 어긋남, action 분기 오매핑 create↔update, argv↔action drift, marker 재해석 drift, §9 credential 값 argv 누출)를 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataResultIssueGhCommandPlan` 을 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 plan 이 step④ live wiring 으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0697 result-issue command-plan(evaluation-side) self-wire 의 stdout-side(gh-command-plan) mirror — result-issue 측 build-time consistency 사슬의 두 종단 self-wire 짝(evaluation-side + stdout-side) 완결**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — self-wire 대상 종단 컴포저. **단일 return 사이트**(L60 `return { action, argv };`). 본 task 는 그 반환 직전에 산출 plan 을 const 로 받아 self-assert 후 반환하도록 배선한다. 입력 `stdout`·`commandArgs` mutate 0·매 호출 새 plan 객체·위임 helper throw 그대로 전파 계약은 불변 유지. import 추가 1줄(가드 helper) + 반환 직전 2줄(const plan 선언 + 가드 호출) 패턴.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` — 호출할 가드 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`(T-0695 신설, L207). 시그니처·throw 정책(구조 결손 TypeError / 값 정합 위반 RangeError·한국어 명세형 메시지)·read-only(입력 mutate 0)·single-source 재유도(3 위임 helper parse→resolveAction→buildGhArgv 재호출) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` — 컴포저 colocated spec. self-wire 배선 후 정상 합성(stdout="[]" create / marker 포함 hit 배열 update / multi-hit 최소 number update)이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다.
- `docs/tasks/T-0697-realdata-e2e-result-issue-command-plan-self-wire.md` — **self-wire mirror 선례**(머지 93bc3c6f, evaluation-side). 반환 직전 `const plan = {...}; assert...(plan, results, run); return plan;` 패턴 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명·spec self-wire 회귀 test(jest.spyOn 호출 1회 검증) 패턴을 본 task 와 동형 차용. **본 task 는 단일 return 사이트 + `(stdout, commandArgs)` 입력 축**(T-0697 은 단일 return 사이트 + `(results, run)` 입력 축).
- `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` (origin/main, T-0697 self-wire spec 박제본) — self-wire 회귀 spec 선례. 정상 산출 self-assert 통과·반환 형태 보존·self-wire 발동 증명(jest.spyOn(consistency 모듈) 호출 1회 검증) test 패턴 차용.
- `docs/tasks/T-0695-realdata-e2e-result-issue-gh-command-plan-consistency-guard.md` — 본 task 가 호출하는 가드의 신설 task. 가드의 6 회귀 유형(action 분기 오매핑 / update issueNumber drift / argv 동사 drift / argv title-body 위치 drift / argv label flag-pair 어긋남 / argv 잉여·누락)·throw 분기·R-59 raw 미저장 정책 확인(본 task 는 호출만 하므로 가드 본문 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` 의 `resolveRealDataResultIssueGhCommandPlan` 가 산출 plan 을 **반환하기 직전** `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)` 를 호출하도록 배선한다(`import { assertRealDataResultIssueGhCommandPlanConsistentWithInputs } from "./realdata-e2e-result-issue-gh-command-plan-consistency";` 추가 + 단일 return 사이트에서 `const plan: RealDataResultIssueGhCommandPlan = { action, argv }; assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs); return plan;` 형태로 배선). 정상 합성이면 가드는 void → 반환 plan(action/argv)·형태 보존(관측 불가능하게 동일).
- [ ] self-wire 배선 외 컴포저 로직(3-단계 위임 합성 순서 parse→resolveAction→buildGhArgv·입력 mutate 0·매 호출 새 객체+새 argv 배열·결정론·R-59 raw 미보유 계약)은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만). 위임 helper throw 선전파 정책 불변.
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경(컴포저 본체 + colocated spec).
- [ ] happy-path unit test 1+ — colocated spec 에서 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 가 정상 입력(stdout="[]" + 유효 commandArgs → create plan / marker 포함 단일 hit + 유효 commandArgs → update plan / 다수 hit + 유효 commandArgs → 최소 number update plan) 모든 분기에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 검증. 반환 plan 형태(action.create | action.update+issueNumber + argv 배열)·구조 보존도 확인.
- [ ] error path unit test 1+ — 위임 helper 가 잘못된 stdout(비JSON/비배열) 또는 잘못된 commandArgs(빈 searchQuery / 빈 title/body / 비양수 issueNumber)에 throw 하는 정책은 기존 spec 이 cover. self-wire 가 **정상 산출물에 대해 가드를 우회/중복 throw 시키지 않음**을 검증(stdout="[]" / marker 단일 hit / multi-hit 최소 number 의 정상 plan 모두 throw 0). 가드가 손상 plan 에 throw 하는 정책은 T-0695 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 직선 경로), 컴포저의 입력 분기(create 경로 stdout="[]" · update 경로 marker 포함 hit 배열 · multi-hit 최소 number)마다 throw 0 정상 반환을 test 1+ 로 cover.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) stdout="[]" + 유효 commandArgs → create plan self-assert 통과(throw 0), (2) marker 포함 단일 hit + 유효 commandArgs → update plan self-assert 통과(throw 0) + 반환 plan 보존, (3) marker 포함 다수 hit + 유효 commandArgs → 최소 number update plan self-assert 통과(throw 0) + 멱등 합성 보존, (4) self-wire 발동 증명 회귀 test 1+(정상 산출물이 가드 불변식을 만족해 void 임 — self-wire 경로가 실제로 가드를 호출함을 jest.spyOn(consistency 모듈) 호출 1회 검증). self-wire 누락 시 fail 하도록.
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 가드를 호출함을 입증하는 test. jest.spyOn 으로 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs` 호출이 정상 호출마다 정확히 1회 발생함을 검증, 인자 순서(plan, stdout, commandArgs) 도 확인. self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec `makeCommandArgs()` fixture + create/update stdout fixture + T-0697 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-result-issue-gh-command-plan-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책/회귀 유형 6종은 T-0695 그대로 불변.
- **위임 helper(`parseRealDataResultIssueSearchOutput` / `resolveRealDataResultIssueAction` / `buildRealDataResultIssueGhArgv`) 수정** — 컴포저가 이미 호출하는 위임 helper. 본 task 에서 변경 0.
- **production `src/` 코드 변경** — step④ live wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — 3-단계 위임 합성 순서·throw 선전파·결정론·매 호출 새 객체+새 argv 배열·R-59 raw 미보유 계약 불변. 자동 복구/정규화/기본값 채움 0.
- **evaluation-side result-issue command-plan self-wire(T-0697 짝)** — 이미 머지(93bc3c6f). 본 task 는 stdout-side `(stdout, commandArgs)` 입력 축의 self-wire — 두 짝 모두 닫혀야 result-issue 측 build-time consistency 사슬 완결.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 result-issue gh-command-plan self-wire 단일 짝만. 그 외 step④ 확장(publish-plan / outcome-report-from-output 등)은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0697/T-0694 명확 — architect 생략. 컴포저 1줄 import + 단일 return 사이트에서 const plan 선언 + 반환 직전 self-assert 삽입 + spec self-wire 회귀 test 추가).

## Follow-ups

- (본 task 머지 후) **result-issue 측 build-time consistency 사슬 완결 점검** — 두 종단(evaluation-side T-0697 + stdout-side T-0698) self-wire 짝이 모두 닫힌 뒤 step④ result-issue 측 잔여 leaf(publish-plan / outcome-report-from-output 등 이미 가드 존재 여부 재survey) 점검 후 planner 가 다음 짝 큐잉.
- step④ 외 step③/step⑤ build-time consistency 사슬의 self-wire 잔여 점검(독립 stream).

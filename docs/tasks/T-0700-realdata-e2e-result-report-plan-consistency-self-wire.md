---
id: T-0700
title: realdata-e2e result-report-plan 종단 컴포저 self-wire 배선 (T-0699 가드 짝 닫기)
phase: P5
status: DONE
completedAt: 2026-06-27T03:52:05Z
prNumber: 616
mergedAs: a9e02c1f46de21dec41c1ea5ba1a98439226dbee
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0699 신설 result-report-plan 정합 가드를 컴포저 반환 직전 self-assert 배선(T-0697 self-wire mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan.ts
  - test/helpers/realdata-e2e-result-report-plan.spec.ts
dependsOn: [T-0699]
independentStream: realdata-e2e-result-report-plan-guard
---

# T-0700 — realdata-e2e result-report-plan 종단 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ post-evaluation interpretation(평가 산출 → 결과 리포트 plan 박제) 측 종단 컴포저 `buildRealDataResultReportPlan(results, run)`(`realdata-e2e-result-report-plan.ts`, T-0593)는 직전 T-0699 가 독립 정합 가드 `assertRealDataResultReportPlanConsistentWithInputs(plan, results, run)`(`realdata-e2e-result-report-plan-consistency.ts` L221)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(origin/main 컴포저 grep 0 확인 — L135 `return { summary, descriptor };` 직전에 이 가드 호출/import 부재. 컴포저는 별개 가드 `assertRealDataResultIssueDescriptorBodyConsistent` 만 self-wire 중). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(summary 집계 drift, descriptor title/marker/body drift, summary↔descriptor cross 어긋남, 위임 호출 입력 축 뒤바뀜)를 plan↔inputs(`results`, `run`) 재유도 축에서 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataResultReportPlan` 을 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 plan 이 step④ 박제 wiring 으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0697 command-plan self-wire 의 result-report-plan mirror — 가드 신설(T-0699)/self-wire 분리 패턴(T-0695→T-0697 동형)의 짝 닫기**.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan.ts` — self-wire 대상 종단 컴포저. **단일 return 사이트**(L135 `return { summary, descriptor };`). 본 task 는 그 반환 직전에 산출 plan 을 const 로 받아 self-assert 후 반환하도록 배선한다. **주의**: 컴포저는 이미 별개 가드 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)`(L130 부근)를 self-wire 중 — 본 task 의 신규 가드 호출은 그 호출을 **대체하지 않고 보완**(plan↔inputs 재유도 축의 추가 self-assert). import 추가 1줄(T-0699 가드 helper) + 반환 직전 2줄(const plan 선언 + 신규 가드 호출) 패턴. 입력 `results`·`run` mutate 0·매 호출 새 plan 객체·위임 helper throw 그대로 전파 계약은 불변 유지.
- `test/helpers/realdata-e2e-result-report-plan-consistency.ts` — 호출할 가드 `assertRealDataResultReportPlanConsistentWithInputs(plan: RealDataResultReportPlan, results: EvaluationResult[], run: RealDataResultIssueRunRef): void`(T-0699 신설, L221). 시그니처·throw 정책(구조 결손 TypeError / 값 정합 위반 RangeError·한국어 명세형 메시지)·single-source 재유도(`buildRealDataResultSummary` → `buildRealDataResultIssueDescriptor` 2 위임 재호출 후 deep-equal 대조)·read-only(입력 mutate 0) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-result-report-plan.spec.ts` — 컴포저 colocated spec. self-wire 배선 후 정상 합성(빈/단일/다수 results)이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다.
- `docs/tasks/T-0697-realdata-e2e-result-issue-command-plan-composer-self-wire.md` — **self-wire mirror 선례**(머지 93bc3c6f). 반환 직전 `const plan = {...}; assert...(plan, results, run); return plan;` 호출 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명·spec self-wire 회귀 test(jest.spyOn 으로 호출 1회 검증) 패턴을 본 task 와 동형 차용. **본 task 는 동일 `(results, run)` 입력 축 + 단일 return 사이트** — 거의 byte-동형 mirror.
- `docs/tasks/T-0699-realdata-e2e-result-report-plan-consistency-guard.md` — 본 task 가 호출하는 가드의 신설 task. 가드의 회귀 유형(summary 집계 drift / descriptor title·marker·body drift / summary↔descriptor cross drift)·throw 분기(TypeError 구조 / RangeError 값)·재유도 정책(2 위임 재호출) 확인(본 task 는 호출만 하므로 가드 본문 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-report-plan.ts` 의 `buildRealDataResultReportPlan` 가 산출 plan 을 **반환하기 직전** `assertRealDataResultReportPlanConsistentWithInputs(plan, results, run)` 를 호출하도록 배선한다(`import { assertRealDataResultReportPlanConsistentWithInputs } from "./realdata-e2e-result-report-plan-consistency";` 추가 + 단일 return 사이트에서 `const plan: RealDataResultReportPlan = { summary, descriptor }; assertRealDataResultReportPlanConsistentWithInputs(plan, results, run); return plan;` 형태로 배선). 정상 합성이면 가드는 void → 반환 plan(summary/descriptor)·형태 보존(관측 불가능하게 동일).
- [ ] 기존 self-wire(`assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)`)는 **유지** — 본 task 는 신규 가드 호출을 그 뒤에 추가(plan↔inputs 재유도 축 보완)하며 기존 가드 호출을 제거하지 않는다.
- [ ] self-wire 배선 외 컴포저 로직(2-단계 위임 합성 순서·summary 위임·descriptor 위임·입력 mutate 0·매 호출 새 객체·결정론 계약)은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만). 위임 helper throw 선전파 정책 불변.
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경(컴포저 본체 + colocated spec).
- [ ] happy-path unit test 1+ — colocated spec 에서 `buildRealDataResultReportPlan(results, run)` 가 정상 입력(빈 `results` 배열 + 유효 run / 단일 result + 유효 run / 다수 result + 유효 run)에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 모든 분기 검증. 반환 plan 형태(summary + descriptor.title/marker/body)·구조 보존도 확인.
- [ ] error path unit test 1+ — 위임 helper 가 잘못된 run(빈 gitSha/dateToken)에 throw 하는 정책은 기존 spec 이 cover. self-wire 가 **정상 산출물에 대해 가드를 우회/중복 throw 시키지 않음**을 검증(빈/단일/다수 results 의 정상 plan 모두 throw 0). 가드가 손상 plan 에 throw 하는 정책은 T-0699 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 직선 경로), 컴포저의 입력 분기(빈/단일/다수 results · 유효 run)마다 throw 0 정상 반환을 test 1+ 로 cover.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 빈 results + 유효 run → plan self-assert 통과(throw 0), (2) 단일 result + 유효 run → plan self-assert 통과(throw 0) + 반환 plan 보존, (3) 다수 result + 유효 run → plan self-assert 통과(throw 0) + 집계 plan 보존, (4) self-wire 발동 증명 회귀 test 1+(정상 산출물이 가드 불변식을 만족해 void 임 — self-wire 경로가 실제로 신규 가드를 호출함을 jest.spyOn(consistency 모듈) 호출 1회 검증). self-wire 누락 시 fail 하도록.
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 신규 가드를 호출함을 입증하는 test. jest.spyOn 으로 `assertRealDataResultReportPlanConsistentWithInputs` 호출이 정상 호출마다 정확히 1회 발생함을 검증, 인자 순서(plan, results, run) 도 확인. self-wire 가 누락되면 fail 하도록. (기존 `assertRealDataResultIssueDescriptorBodyConsistent` self-wire 회귀 test 가 있으면 보존.)
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-report-plan.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec `EvaluationResult[]` fixture + run-ref fixture + T-0697 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-result-report-plan-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책/회귀 유형은 T-0699 그대로 불변.
- **기존 self-wire(`assertRealDataResultIssueDescriptorBodyConsistent`) 제거/변경** — 유지. 본 task 는 신규 가드 호출 추가만.
- **위임 helper(`buildRealDataResultSummary` / `buildRealDataResultIssueDescriptor`) 수정** — 컴포저가 이미 호출하는 위임 helper. 본 task 에서 변경 0.
- **production `src/` 코드 변경** — step④ 박제 wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — 2-단계 위임 합성 순서·throw 선전파·결정론·매 호출 새 객체 계약 불변. 자동 복구/정규화/기본값 채움 0.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 result-report-plan self-wire 단일 짝만. 그 외 step④/step⑤ 확장은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0697 거의 byte-동형 — architect 생략. 컴포저 1줄 import + 단일 return 사이트에서 const plan 선언 + 반환 직전 신규 가드 self-assert 삽입(기존 가드 호출 유지) + spec self-wire 회귀 test 추가).

## Follow-ups

- (본 task 머지 후) result-report-plan 측 build-time consistency 사슬 완결 점검 — result-issue 측(command-plan T-0697 / gh-command-plan T-0698) 두 종단 self-wire 짝 닫힘 + result-report-plan 종단 self-wire(본 task) 닫힘 후, step③/step⑤ build-time consistency 사슬 self-wire 잔여 sweep 으로 planner 가 다음 짝 큐잉.
- NO-GUARD 컴포저 중 상위 가드 미cover leaf(live-gating, result-summary, seed-{fixture,resolve-person-id,upsert} 등) 가드 신설 여부 case-by-case survey 후 큐잉.

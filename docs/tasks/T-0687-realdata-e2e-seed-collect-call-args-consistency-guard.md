---
id: T-0687
title: realdata-e2e seed-side seed-collect-call-args leaf 컴포저 산출↔single-source 재유도 정합 순수 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts
  - test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-consistency-guard
plannerNote: P5 109행 step① — evaluation-inputs leaf 가드 T-0685 의 seed-side mirror, seed-collect-call-args leaf 컴포저 seam 가드신설(self-wire 후속)
---

# T-0687 — realdata-e2e seed-side seed-collect-call-args leaf 컴포저 정합 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬은 evaluate-side leaf(`evaluation-inputs`, T-0685)까지 닫혔고, seed-side 는 pipeline-plan(T-0679) / run-plan(T-0677) 까지 가드가 있다. 그러나 pipeline-plan 가드는 `collectCallArgs` 를 `buildRealDataCollectCallArgs(seeds)` leaf 위임 **재호출**로 재유도하므로, 그 leaf 컴포저 자체가 자신의 더 깊은 single source(`buildRealDataCollectInput(seeds)` 로 산출되는 `person` + 신규-인원 `since=undefined` / `assessmentId=ASSESSMENT_ID_PLACEHOLDER` 정책 상수)와 정합한지 검증하는 **독립 가드는 부재**하다. 본 가드가 그 빈칸을 채운다 — evaluation-inputs leaf 가드(T-0685)의 seed-side mirror로, leaf 컴포저가 person 매핑을 변형/누락하거나 since/assessmentId 정책을 어긋나게 합성하는 회귀를 build-time에 fail-fast로 차단한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — 가드 대상 leaf 컴포저 `buildRealDataCollectCallArgs(seeds)` (산출 `{ person, since, assessmentId }[]`, person 은 `buildRealDataCollectInput` 위임, since=undefined, assessmentId=ASSESSMENT_ID_PLACEHOLDER)
- `test/helpers/realdata-e2e-seed-collect-input.ts` — single source 재유도에 직접 호출할 production-위임 person 매퍼 `buildRealDataCollectInput(seeds)`
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` 타입 + 테스트 fixture
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` — mirror 패턴 참조 (leaf 가드의 책임/불변식/에러 정책 구조)
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` — mirror spec 구조 (happy/error/negative 분기 구성 참조)
- `test/helpers/realdata-e2e-pipeline-plan-consistency.ts` — 한 layer 위 상위 가드가 leaf 를 어떻게 위임 재유도하는지 참조 (중복 재구현 회피 기준)

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts` 신설 — 순수 가드 함수 `assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds)` export. single source 재유도는 `buildRealDataCollectInput(seeds)` 직접 재호출로 `person` 배열을 산출하고, 각 원소의 `since === undefined` + `assessmentId === ASSESSMENT_ID_PLACEHOLDER` 정책 상수를 대조한다. 재유도 chain(person 매핑)은 일절 재구현하지 않고 leaf 가 쓰는 동일 production-위임 매퍼 호출만 한다(drift 0).
- [ ] 에러 정책: 구조 결손(`callArgs` 비-배열 / `seeds` 비-배열 / 원소가 객체 아님) = 한국어 TypeError, 값 정합 위반(길이 불일치 · person deep-equal 실패 · since 정책 위반 · assessmentId 정책 위반) = 한국어 RangeError(메시지에 어긋난 index/필드 정보 포함). 위임 매퍼(`buildRealDataCollectInput`)가 throw하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0).
- [ ] 가드는 read-only — `callArgs`/`seeds` mutate 0. 정상 합성이면 가드는 void 반환.
- [ ] happy-path unit test 1+ — 단일/다수 seed에 대해 leaf 산출이 single-source 재유도와 byte-identical일 때 throw 0 (`assertRealDataCollectCallArgsConsistentWithSources` happy path).
- [ ] error path unit test 1+ — `callArgs` 비-배열(null/undefined 포함) → TypeError, `seeds` 비-배열 → TypeError.
- [ ] flow / branch cover — 각 분기(길이 불일치 / person drift / since 정책 위반 / assessmentId 정책 위반 / 위임 throw 전파)마다 test 1+ 로 분리.
- [ ] negative cases 충분 cover — 다음 예외 상황 각 1+ test: ① callArgs 길이가 seeds보다 짧음/김 ② person 필드 변조(deep-equal 실패) ③ since가 undefined 아님(잘못된 값 주입) ④ assessmentId가 placeholder 아님 ⑤ externalId 빈/공백 seed로 위임 매퍼 throw 전파 ⑥ callArgs 원소가 객체 아닌 타입(type mismatch). 단일 negative만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 가드 파일 cov 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- self-wire(`buildRealDataCollectCallArgs` 반환 직전 self-assert 배선) — 별도 후속 task(T-0685→T-0686 짝 패턴 mirror). 본 task는 가드 신설만.
- leaf 컴포저 `realdata-e2e-seed-collect-call-args.ts` 자체 로직 변경 (가드는 외부 독립 검증만).
- production `src/` 코드 변경 — test helper 단독.
- 실 github.com 네트워크 fetch / 실 수집 / live-LLM / DB 접근.
- 상위 pipeline-plan 가드(T-0679) 변경 — 그 가드는 leaf 를 위임 재호출로 다루며 본 가드와 책임 분리.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 신설 시점)

---

## 결과 (DONE 2026-06-26)

- PR #603 squash merge `4112873`, branch delete. reviewer round1 APPROVE(0 blocking findings), 4-게이트 PASS.
- 가드 `assertRealDataCollectCallArgsConsistentWithSources` 신설 — person 은 `buildRealDataCollectInput` 위임 재유도 deep-equal, since=undefined / assessmentId=ASSESSMENT_ID_PLACEHOLDER 정책 상수 대조. 구조 결손=TypeError, 값 위반=RangeError, read-only, fail-fast.
- test/helpers 2파일 +185 LOC, 신설 파일 stmts 96.87 / branch 90.9 / funcs 100 / lines 96.66 (line·function ≥80 충족). full suite 8165 tests green, lint·build green.
- 머지 후 main CI(4112873) in_progress — 다음 fire 에서 conclusion 재확인.

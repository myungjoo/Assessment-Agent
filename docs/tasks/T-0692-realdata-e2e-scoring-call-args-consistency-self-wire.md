---
id: T-0692
title: realdata-e2e evaluate-side scoring-call-args leaf 컴포저 self-wire 배선 (T-0691 가드 짝 닫기)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step③ — T-0691 신설 scoring-call-args 가드를 buildRealDataScoringCallArgs 반환 직전 self-assert 배선(T-0688 seed-collect self-wire 의 evaluate-side mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-scoring-call-args.ts
  - test/helpers/realdata-e2e-scoring-call-args.spec.ts
dependsOn: [T-0691]
independentStream: realdata-e2e-consistency-guard
---

# T-0692 — realdata-e2e evaluate-side scoring-call-args leaf 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬에서 **seed-side** leaf 컴포저는 가드 신설→self-wire 짝이 모두 닫혔다(T-0687→T-0688, T-0689→T-0690 등). evaluate-side 에서는 직전 T-0691 이 가장 깊은 호출-args 컴포저 `buildRealDataScoringCallArgs(inputs, modelId)`(`realdata-e2e-scoring-call-args.ts`)의 독립 정합 가드 `assertRealDataScoringCallArgsConsistentWithInputs`(`realdata-e2e-scoring-call-args-consistency.ts`)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(self-wire 부재 — origin/main grep 0 확인). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(input reference 누락/뒤섞임, modelId 정책 어긋남, 원소 drop/추가, options 잉여 필드 누출)를 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataScoringCallArgs[]` 를 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 scoring 호출-args 가 step ③ live runner(scoreUnit 호출)로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0688 seed-collect-call-args self-wire 의 evaluate-side mirror**.

## Required Reading

- `test/helpers/realdata-e2e-scoring-call-args.ts` — self-wire 대상 evaluate-side leaf 컴포저. 현재 `return inputs.map((input) => ({ input, options: { modelId } }));` 로 끝난다(L91). 본 task 는 이 반환 직전에 가드 호출을 삽입한다(반환 전 const 변수로 산출물을 받아 self-assert 후 반환). modelId 빈/공백 guard(L84) 는 이미 존재 — 컴포저의 그 throw 가 가드 도달 전에 선행되므로 정합.
- `test/helpers/realdata-e2e-scoring-call-args-consistency.ts` — 호출할 가드 `assertRealDataScoringCallArgsConsistentWithInputs(callArgs, inputs, modelId)`(T-0691 신설). 시그니처·throw 정책(구조 TypeError / 값 RangeError / modelId 빈-공백 throw) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-scoring-call-args.spec.ts` — 컴포저 colocated spec. self-wire 배선 후 정상 합성이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 회귀 test 를 본 spec 에 추가한다.
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` (origin/main, L93~L103) — **self-wire mirror 선례**(T-0688). 반환 직전 `assert...(callArgs, seeds);` 호출 + 책임 주석 구조·정상 시 byte-identical 반환·가드 read-only(mutate 0)·위임 매퍼 throw 선전파 설명을 본 task 와 동형으로 차용(여기선 modelId 인자 동반).
- `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` (origin/main) — self-wire 회귀 spec 선례. 정상 산출 self-assert 통과·반환 형태 보존 test 패턴 차용.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-scoring-call-args.ts` 의 `buildRealDataScoringCallArgs` 가 산출 `RealDataScoringCallArgs[]` 를 **반환하기 직전** `assertRealDataScoringCallArgsConsistentWithInputs(callArgs, inputs, modelId)` 를 호출하도록 배선한다(`import { assertRealDataScoringCallArgsConsistentWithInputs } from "./realdata-e2e-scoring-call-args-consistency";` 추가 + 산출물을 const 로 받아 self-assert 후 반환). modelId 빈/공백 throw(L84)는 가드 도달 전에 선행되므로 그대로 유지. 정상 합성이면 가드는 void → 반환 배열·원소·options 무공유/형태 보존(관측 불가능하게 동일).
- [ ] self-wire 배선 외 컴포저 매핑 로직(`inputs.map((input) => ({ input, options: { modelId } }))`)·modelId guard·순수성·무공유 계약은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만).
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경.
- [ ] happy-path unit test 1+ — colocated spec 에서 `buildRealDataScoringCallArgs(inputs, modelId)` 가 정상 입력(단일 input / 다수 input / 빈 inputs 배열)에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 검증. 반환 배열 길이/원소 형태(`{ input, options: { modelId } }`)·input reference 보존(`result[i].input === inputs[i]`)도 확인.
- [ ] error path unit test 1+ — 컴포저의 modelId 빈/공백 guard 가 가드 self-assert 도달 전에 선행 throw 함을 검증(빈 문자열·공백만 modelId 각 1+ test). self-wire 가 기존 throw 정책을 우회/중복시키지 않음 확인.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 직선 경로), 컴포저의 기존 분기(modelId guard throw 분기 · 빈 배열 분기 · 다수 원소 매핑 분기)마다 self-assert 통과/선행 throw 가 정합함을 test 1+ 로 cover.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) modelId 빈 문자열 → throw, (2) modelId 공백만 → throw, (3) 빈 inputs 배열 → 빈 배열 반환(self-assert void, throw 0) — 각 1+ test. self-wire 가 정상 산출물의 무결성 검증을 실제로 수행함을 증명하는 회귀 test 1+(예: 정상 합성 산출물이 가드 불변식을 모두 만족해 void 인지 — self-wire 발동 경로 증명).
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 가드를 호출함을 입증하는 test. (예: 정상 산출물에 대해 throw 0 으로 통과하되, 가드 호출 경로가 spec coverage 에 잡히도록 하거나 jest.spyOn 으로 self-assert 호출 1회를 검증). self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-scoring-call-args.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec fixture + T-0688 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-scoring-call-args-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책은 T-0691 그대로 불변.
- **production `src/` 코드 변경** — `EvaluationInput` / `ScoringOptions` 타입·evaluation-scoring.service.ts 등 변경 0.
- **컴포저 매핑 정책 변경** — modelId 동형 적용·input reference 페어링·무공유 계약은 불변. 자동 복구/정규화/기본값 채움 0.
- **seed-side 가드/컴포저(T-0687/T-0688 등) 변경** — evaluate-side scoring-call-args seam 만.
- **다른 evaluate-side leaf 가드 신설/배선** — 본 task 는 scoring-call-args self-wire 단일 짝만. 그 외 evaluate-side 확장은 후속.
- **live execFile / 실 scoreUnit / Ollama / live-LLM(ADR-0045) / 실 modelId resolver(ADR-0048) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0688 명확 — architect 생략. 컴포저 1줄 import + 반환 직전 self-assert 삽입 + spec self-wire 회귀 test 추가).

## Follow-ups

- (있다면) evaluate-side 의 다른 leaf 컴포저(상위 pipeline-plan / run-plan 레벨)로 build-time consistency 가드 사슬 확장 — seed-side 사슬(run-plan→pipeline-plan→collect-call-args→collect-input)의 evaluate-side mirror 완결 여부 점검 후 planner 가 다음 짝 큐잉.

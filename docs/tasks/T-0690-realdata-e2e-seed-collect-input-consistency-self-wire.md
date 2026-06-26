---
id: T-0690
title: realdata-e2e seed-side seed-collect-input leaf 컴포저 산출 직전 consistency 가드 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-27
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-input.ts
  - test/helpers/realdata-e2e-seed-collect-input.spec.ts
dependsOn: [T-0689]
independentStream: realdata-e2e-consistency-guard
plannerNote: P5 109행 step① — T-0689 신설 seed-collect-input leaf 가드의 composer self-wire·짝 닫기, T-0688 seed-collect-call-args self-wire 의 더 깊은 leaf mirror
---

# T-0690 — realdata-e2e seed-side seed-collect-input leaf 컴포저 consistency 가드 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬에서 seed-side 는 run-plan(T-0677/T-0678)→pipeline-plan(T-0679/T-0680)→seed-collect-call-args leaf(T-0687/T-0688)까지 가드 신설→self-wire 짝이 닫혔다. 가장 깊은 seed-side leaf 컴포저 `buildRealDataCollectInput` 의 정합 가드 `assertRealDataCollectInputConsistentWithSeeds`(T-0689, merged ba0b39e)는 신설됐으나 아직 그 leaf 컴포저에 self-wire 되지 않아, 컴포저가 seed identity 투영(`service`+`externalId` 만 추리고 `isPrimary` 제외)을 변형/누락하거나 externalId 빈-가드 정책을 어긋나게 합성하는 회귀가 build-time 에 fail-fast 로 잡히지 않는다. 본 task 는 T-0689 신설 가드를 컴포저 반환 직전에 self-assert 로 배선해 짝을 닫는다 — T-0688(seed-collect-call-args self-wire)의 한 layer 더 깊은 leaf mirror 로 seed-side leaf 가드 사슬을 완결한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-input.ts` — self-wire 대상 가장 깊은 leaf 컴포저 `buildRealDataCollectInput(seeds)`. 현재 `seeds.map(...)` 결과를 직접 `return` 한다(별도 const 추출 없음). 반환 직전 self-assert 배선이 본 task 목표.
- `test/helpers/realdata-e2e-seed-collect-input-consistency.ts` — T-0689 신설 가드 `assertRealDataCollectInputConsistentWithSeeds(collectInputs, seeds)` (import 하여 호출만 — 본문 불변).
- `test/helpers/realdata-e2e-seed-collect-input.spec.ts` — 컴포저 colocated spec(기존 describe 에 self-wire describe append).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` 타입 + 테스트 fixture(`buildRealDataE2eSeed`).
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — 한 layer 위 self-wire 선례(T-0688). 반환 직전 self-assert 배선 패턴(const 추출 후 가드 호출 → 반환) 참조 — 본 task 와 동형 구조.
- `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` — self-wire spec 선례(self-wire describe 구성·spyOn 으로 가드 호출 검증·정상 합성 시 throw 0 패턴 참조).

## Acceptance Criteria

- [ ] `buildRealDataCollectInput(seeds)` 의 본문에서 `seeds.map(...)` 산출을 `const collectInputs` 로 추출하고, `return` 직전에 `assertRealDataCollectInputConsistentWithSeeds(collectInputs, seeds)` 를 self-assert 로 호출한 뒤 `collectInputs` 를 반환한다. import 1줄 추가 + 단일 반환 지점 const 분리 + self-assert 1 호출 외 본문·식별자·합성 순서·산출 객체 트리 변경 0(byte-identical 산출물 보존). 정상 합성이면 가드는 void(부수효과 0), 회귀 시 손상 collectInputs 가 호출 측(seed-collect-call-args 위임처)에 도달하기 전 fail-fast throw.
- [ ] happy-path unit test 1+ — 단일/다수 seed(다중 identity descriptor 포함) 및 빈 seeds 배열에 대해 `buildRealDataCollectInput` 가 종전과 동일 산출을 throw 0 로 반환(self-wire 가 정상 경로를 깨지 않음). 기존 컴포저 happy-path 회귀 보존.
- [ ] error path unit test 1+ — self-wire 된 가드가 손상 경로에서 throw 함을 검증한다: 예) `assertRealDataCollectInputConsistentWithSeeds` 를 `jest.spyOn`/모듈 mock 으로 throw 하도록 만든 뒤 `buildRealDataCollectInput` 호출 시 그 throw 가 그대로 전파되는지(가드가 self-wire 됐다는 사실 자체) 검증. externalId 빈/공백 seed 입력 시 컴포저 자체 throw 가 가드 self-wire 와 무관하게 그대로 발생함도 검증(self-wire 가 기존 빈-가드 throw 를 삼키지 않음).
- [ ] flow / branch cover — self-wire 분기(정상 합성 → void → 산출 반환 / 가드 throw → 전파 / 컴포저 자체 빈-externalId throw → 전파)마다 test 1+ 로 분리.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 가드가 RangeError throw 하도록 mock → `buildRealDataCollectInput` 가 그 RangeError 전파, (2) 가드가 TypeError throw 하도록 mock → 전파, (3) externalId 빈/공백 seed → 컴포저 자체 throw 가 self-wire 후에도 발생, (4) 가드가 정상(void) 일 때 산출이 mutate 되지 않고 종전과 byte-identical — 각 1+ test.
- [ ] 가드 호출은 read-only 계약 보존 — self-wire 가 `seeds`/산출 collectInputs 를 mutate 하지 않음을 검증(반환 객체 트리가 종전과 deep-equal).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경 helper line/branch/func/stmt 100% 목표(self-wire mirror-family 선례대로), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-seed-collect-input.spec.ts`(컴포저와 colocated, 기존 spec 에 self-wire describe append). 새 mock helper 추출 불요 — 기존 seed fixture + 선례(T-0688) spec 패턴 재사용.

## Out of Scope

- **가드 함수 `assertRealDataCollectInputConsistentWithSeeds` 자체 로직 변경** — T-0689 신설분 본문 불변(import 하여 호출만).
- **leaf 컴포저의 투영 규칙·throw 정책·합성 순서 변경** — self-assert 배선 외 behavioral 변경 0(byte-identical 산출물 보존).
- **한 layer 위 seed-collect-call-args 컴포저/가드(T-0687/T-0688) 변경** — 본 task 는 그 위임처인 더 깊은 collect-input leaf 의 self-wire 만.
- **production `src/` 코드 변경** — test/helpers 단독(`CollectForPersonInput` 타입은 import 재사용만, 본문 불변).
- **live execFile / 실 github.com 네트워크 fetch / 실 수집 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 self-wire 만. 실 nightly 실행·실 수집은 본 task 와 직교.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — seed-side leaf 가드 사슬 완결. 가드 사슬의 다음 미커버 seam 이 있으면 후속 planner 가 surface.)

---
id: T-0688
title: realdata-e2e seed-side seed-collect-call-args 컴포저 산출 직전 consistency 가드 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-26
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args.ts
  - test/helpers/realdata-e2e-seed-collect-call-args.spec.ts
dependsOn: [T-0687]
independentStream: realdata-e2e-consistency-guard
plannerNote: P5 109행 step① — T-0687 신설 seed-collect-call-args 가드의 composer self-wire·짝 닫기, T-0686 evaluation-inputs self-wire 의 seed-side mirror
---

# T-0688 — realdata-e2e seed-side seed-collect-call-args 컴포저 consistency 가드 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬에서 evaluate-side leaf(`evaluation-inputs`)는 가드 신설(T-0685)→self-wire(T-0686)로 짝이 닫혔다. seed-side leaf 가드 `assertRealDataCollectCallArgsConsistentWithSources`(T-0687)는 신설됐으나 아직 leaf 컴포저 `buildRealDataCollectCallArgs` 에 self-wire 되지 않아, 컴포저가 person 매핑을 변형/누락하거나 `since`/`assessmentId` 정책 상수를 어긋나게 합성하는 회귀가 build-time에 fail-fast로 잡히지 않는다. 본 task는 T-0687 신설 가드를 컴포저 반환 직전에 self-assert로 배선해 짝을 닫는다 — T-0686(evaluation-inputs self-wire)의 seed-side mirror.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — self-wire 대상 leaf 컴포저 `buildRealDataCollectCallArgs(seeds)`. 현재 `buildRealDataCollectInput(seeds).map(...)` 결과를 직접 `return` 한다(별도 const 추출 없음). 반환 직전 self-assert 배선이 본 task 목표.
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts` — T-0687 신설 가드 `assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds)` (import 하여 호출만 — 본문 불변).
- `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` — 컴포저 colocated spec(기존 describe 에 self-wire describe append).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` 타입 + 테스트 fixture.
- `test/helpers/realdata-e2e-seed-collect-input.ts` — 위임 person 매퍼 `buildRealDataCollectInput`(externalId 빈/공백 시 throw 경로 — map 단계 throw 전파 검증용).
- `docs/tasks/T-0686-realdata-e2e-evaluation-inputs-consistency-self-wire.md` — mirror self-wire 선례(배선 형태·spec 구조·negative 분기 구성 참조).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-collect-call-args.ts` 의 `buildRealDataCollectCallArgs` 반환 직전에 `assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds)` self-assert 1 호출 배선. 현 단일 반환 지점(`return persons.map((person) => ({...}));`)을 `const callArgs: RealDataCollectCallArgs[] = persons.map((person) => ({ ... }));` 로 분리 → self-assert → `return callArgs;`. import 1줄 추가 외 기존 본문(주석·위임 호출·합성 순서·`since: undefined`/`assessmentId: ASSESSMENT_ID_PLACEHOLDER`) 변경 0. byte-identical 산출물 보존.
- [ ] happy-path unit test 1+ — 유효 `seeds`(단일/다수 seed)로 컴포저 호출 시 산출 `RealDataCollectCallArgs[]` 이 self-wire 전과 byte-identical(원소·순서·길이·`person`/`since`/`assessmentId` 필드) 이고 throw 0. 빈 `seeds` 배열(빈 `RealDataCollectCallArgs[]` 반환) 정합 시 void. self-wire 후에도 출력이 입력/다음 호출과 무공유(배열·중첩 person 차원 새 객체) 임을 검증.
- [ ] error path unit test 1+ — (a) 가드가 컴포저 산출 직전 `(callArgs, seeds)` 인자로 1회 호출되는지 `jest.spyOn`(또는 모듈 mock)으로 검증(호출 횟수·인자 정합). (b) 컴포저 회귀를 모사해 가드가 throw 하면 그 throw 가 컴포저 밖으로 그대로 전파되는지 검증(손상 산출물 반환 차단).
- [ ] flow / branch coverage — 컴포저의 분기(위임 매퍼 `buildRealDataCollectInput` throw 분기 vs 정상 합성 분기) 각 1+ test. 위임 throw 분기에서는 가드 미호출(map 단계 throw 가 가드 도달 전 우선 동작), 정상 분기에서는 가드 1회 호출.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) externalId 빈/공백 seed → 위임 매퍼 throw 가 map 단계에서 전파(가드 미도달), (2) 가드가 RangeError throw 하는 길이 불일치(원소 drop) 회귀 모사 전파, (3) 가드가 RangeError throw 하는 특정 index `person` 필드 drift 회귀 모사 전파, (4) 가드가 RangeError throw 하는 `since` 정책 위반(undefined 아닌 값 주입) 회귀 모사 전파, (5) 가드가 RangeError throw 하는 `assessmentId` 정책 위반(placeholder 아님) 회귀 모사 전파, (6) 가드가 TypeError throw 하는 구조결손(산출이 비-배열로 모사) 전파 — 각 1+ test.
- [ ] 입력 비변형 — 전달받은 `seeds` 배열 및 그 원소를 mutate 하지 않음(self-wire 후에도 비변형 유지, 테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(변경 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 변경 helper 100% 목표).
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts`(컴포저와 colocated, 기존 describe 에 self-wire describe append). 새 mock helper 추출 불요 — 기존 spec 의 mock/spyOn 패턴 + realdata-e2e seed fixture 재사용.

## Out of Scope

- **가드 본문 변경** — `realdata-e2e-seed-collect-call-args-consistency.ts`(T-0687 신설 가드) 의 로직·시그니처·throw 분류 불변. 본 task 는 import 하여 호출만.
- **새 가드 / 다른 seam 가드 추가** — 본 task 는 T-0687 짝 닫기만. 다른 layer/seam 의 신규 consistency 가드 신설은 본 task 밖(Follow-up 또는 별도 task).
- **위임 매퍼 동작 변경** — `buildRealDataCollectInput` 위임 호출·순서 보존·빈 배열 분기·`since=undefined`/`assessmentId=ASSESSMENT_ID_PLACEHOLDER` 정책·무공유 계약 불변. self-wire 1 지점 추가 외 0 LOC behavioral 변경.
- **상위 pipeline-plan 가드(T-0679) 변경** — 그 가드는 leaf 컴포저를 위임 재호출로 다루며 본 self-wire 와 책임 분리.
- **live execFile / 실 네트워크 / 실 수집 / Ollama / credential wiring** — build-time 순수 가드 self-wire 만. 실 nightly 실행·live-LLM(ADR-0045)·credential 주입은 본 task 와 직교.
- **schema / migration / 새 dependency / auth / src 변경** — 없음(test/helpers 2 파일만). 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 신설 시점)

## 결과

- Status: DONE (2026-06-26T14:18:46Z)
- PR #604 squash merge 1cac5a0 — reviewer round 1 APPROVE, 4-게이트 통과, CI green(unit/smoke/e2e).
- 컴포저 `buildRealDataCollectCallArgs` 반환 직전에 T-0687 가드 self-assert 배선(byte-identical 보존). spec self-wire 11 케이스(+217 LOC), 컴포저 cov 100%.

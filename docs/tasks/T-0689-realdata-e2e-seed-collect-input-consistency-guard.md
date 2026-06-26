---
id: T-0689
title: realdata-e2e seed-side seed-collect-input leaf 컴포저 산출↔(seeds) single-source 재유도 정합 순수 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-input-consistency.ts
  - test/helpers/realdata-e2e-seed-collect-input-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-consistency-guard
plannerNote: P5 109행 step① — seed-collect-call-args leaf 가드 T-0687 한 layer 아래 가장 깊은 seed-side leaf(collect-input) seam mirror, 가드신설만(self-wire 후속)
---

# T-0689 — realdata-e2e seed-side seed-collect-input leaf 컴포저 정합 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬에서 seed-side 는 run-plan(T-0677)→pipeline-plan(T-0679)→seed-collect-call-args leaf(T-0687) 까지 가드+self-wire 짝이 닫혔다. 그러나 seed-collect-call-args 가드(T-0687)는 그 person 산출을 `buildRealDataCollectInput(seeds)` leaf **위임 재호출**로 재유도하므로, 그 **가장 깊은 leaf 컴포저** `buildRealDataCollectInput` 자체가 자신의 single source(seed descriptor 의 `serviceIdentities` 에서 `service`+`externalId` 만 추리고 `isPrimary` 등 불필요 필드는 제외, externalId 빈/공백 시 throw)와 정합한지 검증하는 **독립 가드는 부재**하다. 본 가드가 그 빈칸을 채운다 — evaluation-inputs leaf 가드(T-0685)·seed-collect-call-args leaf 가드(T-0687)의 한 layer 더 깊은 seed-side mirror 로, leaf 컴포저가 identity 투영을 변형/누락하거나 externalId 빈-가드 정책을 어긋나게 합성하는 회귀를 build-time 에 fail-fast 로 차단한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-input.ts` — 가드 대상 가장 깊은 seed-side leaf 컴포저 `buildRealDataCollectInput(seeds)` (산출 `CollectForPersonInput[]`, 각 원소 `serviceIdentities: { service, externalId }[]`, `isPrimary` 제외, externalId 빈/공백 시 throw).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` 타입 + 테스트 fixture(`buildRealDataE2eSeed`), 각 descriptor 의 `serviceIdentities` shape(`service`/`externalId`/`isPrimary`).
- `src/assessment-collection/collection-entry.service.ts` — 출력 element 타입 `CollectForPersonInput` 정의(가드 시그니처 타입 재사용 — 별도 복제 금지, drift 방지).
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts` — 한 layer 위 mirror 가드(T-0687). leaf 가드의 책임/single-source 재유도/throw 분류(TypeError/RangeError)/read-only 정책 구조 참조 (중복 재구현 회피 기준 — 본 가드는 그 위임처인 collect-input 의 더 깊은 seam).
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` — mirror spec 구조(happy/error/negative 분기 구성·spyOn/모듈 mock 패턴 참조).
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` — evaluate-side leaf 가드(T-0685) mirror — leaf 가드의 byte-identical 재유도 + 에러 정책 선례.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-collect-input-consistency.ts` 신설 — 순수 가드 함수 `assertRealDataCollectInputConsistentWithSeeds(collectInputs, seeds)` export. single source 재유도는 `seeds` 의 각 descriptor `serviceIdentities` 를 직접 순회해 `{ service, externalId }` 만 추린 기대 투영(`isPrimary` 제외)을 산출하고, leaf 컴포저 산출 `collectInputs` 와 byte-identical(원소·순서·길이·중첩 identity 순서·`service`/`externalId` 값) 대조한다. externalId 가 빈/공백인 seed identity 가 있으면 컴포저와 **동일하게** throw 가 발생해야 함을 검증(가드의 재유도도 컴포저와 같은 빈-가드 정책을 적용 — leaf 와 정책 drift 0). 매핑 로직은 leaf 가 쓰는 동일 투영 규칙만 재유도하고 그 외 재구현 0.
- [ ] 에러 정책: 구조 결손(`collectInputs` 비-배열 / `seeds` 비-배열 / 원소가 객체 아님 / `serviceIdentities` 가 배열 아님) = 한국어 TypeError, 값 정합 위반(원소 길이 불일치 · identity 길이 불일치 · `service` 또는 `externalId` 값 drift · `isPrimary` 같은 잉여 필드 누출) = 한국어 RangeError(메시지에 어긋난 index/필드 정보 포함). seed 의 빈/공백 externalId 로 컴포저가 throw 하는 경로를 가드가 삼키지 않고 그대로 전파(자체 try/catch 0).
- [ ] 가드는 read-only — `collectInputs`/`seeds` mutate 0. 정상 합성이면 가드는 void 반환.
- [ ] happy-path unit test 1+ — 단일/다수 seed(다중 identity descriptor 포함)에 대해 leaf 산출이 single-source 재유도와 byte-identical 일 때 throw 0 (`assertRealDataCollectInputConsistentWithSeeds` happy path). 빈 `seeds` 배열(빈 산출) 정합 시 void.
- [ ] error path unit test 1+ — `collectInputs` 비-배열(null/undefined 포함) → TypeError, `seeds` 비-배열 → TypeError.
- [ ] flow / branch cover — 각 분기(원소 길이 불일치 / identity 길이 불일치 / service drift / externalId drift / 잉여 필드 누출 / 빈-공백 externalId throw 전파 / 빈 seeds 정상)마다 test 1+ 로 분리.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) collectInputs 길이가 seeds 보다 짧음/김 → RangeError, (2) 특정 index 의 identity 길이 불일치(identity drop/추가) → RangeError, (3) identity `service` 값 변조(deep-equal 실패) → RangeError, (4) identity `externalId` 값 변조 → RangeError, (5) collectInputs 원소에 `isPrimary` 같은 잉여 필드 누출(투영 위반) → RangeError, (6) externalId 빈/공백 seed → 컴포저/재유도 throw 전파, (7) collectInputs 원소가 객체 아닌 타입 또는 `serviceIdentities` 가 배열 아님 → TypeError — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 가드 파일 cov 100% 목표(mirror-family 선례대로).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-seed-collect-input-consistency.spec.ts`(가드와 colocated). 새 mock helper 추출 불요 — realdata-e2e seed fixture + 기존 mirror spec 의 패턴 재사용.

## Out of Scope

- **self-wire**(`buildRealDataCollectInput` 반환 직전 self-assert 배선) — 별도 후속 task(T-0685→T-0686 / T-0687→T-0688 짝 패턴 mirror). 본 task 는 가드 신설만.
- **leaf 컴포저 `realdata-e2e-seed-collect-input.ts` 자체 로직 변경** — 가드는 외부 독립 검증만(투영 규칙·throw 정책·무공유 계약 불변).
- **한 layer 위 seed-collect-call-args 가드(T-0687) 변경** — 그 가드는 본 leaf 를 위임 재호출로 다루며 본 가드(더 깊은 seam)와 책임 분리.
- **production `src/` 코드 변경** — test/helpers 단독(`CollectForPersonInput` 타입은 import 재사용만, 본문 불변).
- **live execFile / 실 github.com 네트워크 fetch / 실 수집 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 신설만. 실 nightly 실행·실 수집은 본 task 와 직교.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 신설 시점. self-wire 짝 닫기는 후속 T-0690 으로 큐잉 예정.)

## Result (DONE — 2026-06-26)

- **STATUS: DONE / MERGED** — PR #605 squash→main `ba0b39e`, feature branch 삭제.
- 신설 `assertRealDataCollectInputConsistentWithSeeds` 순수 가드: seed serviceIdentities {service,externalId} 직접 투영 재유도와 buildRealDataCollectInput 산출을 byte-identical 대조. 구조결손=TypeError / 값drift·잉여필드=RangeError, read-only.
- tester: 신설 가드 파일 line/branch/func/stmt 100%, happy(빈/단일/다수/다중 identity)+error+negative ①~⑦+비변형 총 28 케이스, 전체 스위트 8205 pass.
- reviewer round1 APPROVE·외부 comment 존재, 4-게이트 PASS, PR CI green(양 job). 머지커밋 ba0b39e main CI in_progress — 다음 fire 재확인.
- self-wire 짝 닫기는 후속 task(T-0690 예정)로 planner 큐잉 대상.

---
id: T-0679
title: realdata-e2e seed-side pipeline-plan 컴포저 산출↔(seeds, modelId) 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
independentStream: p5-realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-pipeline-plan-consistency.ts
  - test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts
plannerNote: P5 PLAN 109행 step① realdata-e2e — run-plan 가드(T-0677)의 한 layer 아래 seed-side pipeline-plan sub-composer seam mirror, 가드신설만
---

# T-0679 — realdata-e2e seed-side pipeline-plan 컴포저 산출↔(seeds, modelId) 재유도 정합 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) 109행(🟢 실 평가 e2e, P5) build-time chain 의 consistency 가드 사슬을 한 layer 아래로 확장한다. 최외곽 run-plan 컴포저는 가드 신설(T-0677)+self-wire(T-0678)로 닫혔고, step-args aggregator(T-0671/T-0672)·sub-composer(T-0667~T-0670)도 가드를 갖췄으나, run-plan 이 직접 위임 호출하는 **seed-side sub-composer `buildRealDataPipelinePlan(seeds, modelId)`** (T-0592, [realdata-e2e-pipeline-plan.ts](../../test/helpers/realdata-e2e-pipeline-plan.ts))는 아직 산출↔재유도 정합 가드가 부재하다(그 파일은 `assert*Consistent` import 0). 본 task 는 그 빈칸을 채우는 순수 가드를 신설해, 합성 회귀로 손상된 pipeline plan 이 step ① live runner 로 새기 전 fail-fast 차단한다. self-wire(반환 직전 self-assert)는 T-0678-style 후속 slice.

## Required Reading

- [test/helpers/realdata-e2e-pipeline-plan.ts](../../test/helpers/realdata-e2e-pipeline-plan.ts) — 가드 대상 컴포저 `buildRealDataPipelinePlan` + `RealDataPipelinePlan` type (collectCallArgs + modelId).
- [test/helpers/realdata-e2e-run-plan-consistency.ts](../../test/helpers/realdata-e2e-run-plan-consistency.ts) — 한 layer 위 mirror 패턴(single-source 재유도 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast). 본 가드의 직접 템플릿.
- [test/helpers/realdata-e2e-run-plan-consistency.spec.ts](../../test/helpers/realdata-e2e-run-plan-consistency.spec.ts) — colocated spec 구조 + describe/it 어휘 + negative case 망 참조.
- [test/helpers/realdata-e2e-seed-collect-call-args.ts](../../test/helpers/realdata-e2e-seed-collect-call-args.ts) — 재유도 single source 위임 `buildRealDataCollectCallArgs` (재구현 금지, 호출만).

## Acceptance Criteria

- [ ] 신설 `test/helpers/realdata-e2e-pipeline-plan-consistency.ts` 에 순수 가드 `assertRealDataPipelinePlanConsistentWithSources(pipelinePlan, seeds, modelId)` export. 검증 불변식: (a) `expectedCollectCallArgs = buildRealDataCollectCallArgs(seeds)` 재유도 → `pipelinePlan.collectCallArgs` 와 deep-equal byte-identical(원소·순서·길이까지), (b) `pipelinePlan.modelId === modelId`(modelId 는 컴포저가 원시값 그대로 보존 — 입력 modelId 자체가 expected). 재유도 chain(collect 호출-args 매핑)은 위임 호출만, 일절 재구현 금지(drift 0).
- [ ] 에러 정책: `pipelinePlan` null/undefined · `pipelinePlan.collectCallArgs` 비-배열 · `seeds` 비-배열 · `modelId` 비-string → 한국어 TypeError(구조 결손). 재유도 expected 와 `collectCallArgs` drift 또는 `modelId` 불일치 → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — collectCallArgs 인지 modelId 인지 — 포함). 재유도 위임이 throw(externalId 빈/공백 seed)하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0).
- [ ] **Happy-path test**: 정합 pipelinePlan(빈 seeds + 유효 modelId / 단일 seed / 다수 seed) → 가드 void(throw 0) 1+.
- [ ] **Error path test**: 각 분기마다 — `pipelinePlan` null/undefined·비-object, `collectCallArgs` 비-배열, `seeds` 비-배열, `modelId` 비-string → TypeError 1+. collectCallArgs drift(원소 변형/순서 뒤바뀜/길이 불일치), modelId 불일치 → RangeError 1+.
- [ ] **Flow / branch coverage**: collectCallArgs deep-equal 분기 / modelId 일치 분기 / 각 구조 결손 분기 / 각 값 위반 분기마다 test branch 분리. 어느 구성요소(collectCallArgs vs modelId)에서 먼저 throw 하는지 fail-fast 순서도 1+ test 로 고정.
- [ ] **Negative cases 충분 cover**: 위임 throw 전파(externalId 빈/공백 seed → 가드가 삼키지 않고 전파) · 빈 배열 경계(빈 seeds → collectCallArgs `[]` 정합) · 입력 비변형(가드 호출 후 `pipelinePlan`/`seeds`/`modelId` mutate 0 — 객체 deep-equal 전후 동일) 각 1+ test. 단일 negative 만 금지 — 예외 분기마다 cover.
- [ ] colocated spec `test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts` 에 위 test 배치(helper fallback 아닌 colocated default). `pnpm test:cov` 통과 (신설 파일 line ≥ 80% / function ≥ 80%, 가드는 단순 순수 함수라 100% 목표).
- [ ] `pnpm lint && pnpm build && pnpm test` green (전체 suite 회귀 0). src/web 무변경.

## Out of Scope

- `buildRealDataPipelinePlan` 컴포저 / `buildRealDataCollectCallArgs` 위임 본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
- self-wire 배선(`buildRealDataPipelinePlan` 반환 직전 self-assert) — 별도 후속 slice(T-0678-style self-wire mirror, Follow-ups 박제).
- 자동 복구 / pipeline plan 재합성 / 정규화 / 기본값 채움 — 손상 plan 을 고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 — 순수 비교만, 새 외부 dependency 0.
- 재유도 chain 의 collect 호출-args 매핑 재구현 — 전부 위임 종단 helper 호출로 재유도(재구현 금지).
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예정) pipeline-plan self-wire — `buildRealDataPipelinePlan` 반환 직전 `assertRealDataPipelinePlanConsistentWithSources(plan, seeds, modelId)` self-assert 배선(T-0678-style, 가드신설+self-wire 짝 닫기).

---
id: T-0805
title: overwrite/재평가 reset-and-recreate plan 순수 도메인 helper (ADR-0053 slice 1)
phase: P5
status: DONE
completedAt: 2026-07-07T06:40:00Z
prNumber: 719
mergedAs: 063df611
reviewRounds: 1
result: computeOverwriteReevalPlan 순수 helper + spec (ADR-0053 slice1 — mode-gated reset-and-recreate plan, 무플래그=first-write-wins 보존). 신규 파일 100% cov, 9055 tests green. PR #719 round1 4-게이트 PASS, squash merge 063df611.
commitMode: pr
coversReq: [REQ-037, REQ-041, REQ-064]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-07
dependsOn: [T-0804]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts
  - src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.spec.ts
independentStream: p5-overwrite-reeval
plannerNote: "P5 option5 — ADR-0053 slice1: mode-gated reset-and-recreate plan 순수 helper(무플래그=first-write-wins 보존, 명시 mode=reeval). dependency-free, cap 내."
---

# T-0805 — overwrite/재평가 reset-and-recreate plan 순수 도메인 helper (ADR-0053 slice 1)

## Why

오너가 [Q-0051](../STATE.json) 옵션 5 로 PLAN line 107 의 overwrite/재평가 DEFERRED 를 해제하고 재개를 승인(권장 착수 1순위)했고, 그 mechanism 을 박제한 [ADR-0053](../decisions/ADR-0053-overwrite-reeval-mechanism.md) 이 ACCEPTED 됐다(T-0804, PR #718). 본 task 는 ADR-0053 구현 chain 의 **첫 slice** 로, ADR-0053 §Decision 1/2/3/4 가 결정한 overwrite/재평가 semantics 의 핵심 — "명시 mode 하에서 target 좌표 집합에 대한 reset-and-recreate plan(어느 좌표가 delete→create 되고 어느 좌표가 보존/신규 생성되는지) + 무플래그/unknown mode 시 first-write-wins fail-safe" — 을 **의존성 0 순수 도메인 함수**로 표현한다. controller route / orchestrator 배선 / DB migration 은 후속 slice(§Follow-ups)로 미루고, 본 slice 는 순수 함수 + colocated unit spec 만 추가해 cap(≤300 LOC / ≤5 파일) 안에서 file-disjoint 하게 진행한다. write-layer(`persist(..., "reeval")`) 는 이미 main 에 존재하므로(ADR-0033 §D3), 본 helper 는 "그 reeval 경로를 언제 태울지의 plan" 을 순수 계산으로 outsource 하는 detection 사슬 진입점이다.

## Required Reading

- `docs/decisions/ADR-0053-overwrite-reeval-mechanism.md` — 특히 §Decision 1(명시 mode 진입 시 reset-and-recreate 재사용), §Decision 2(idempotency 경계 — 좌표당 row 1 수렴, last-writer-wins within overwrite), §Decision 3(partial-reset — prefix 부분 재평가 시 다른 좌표 보존, "wiping others" 미발생), §Decision 4(조건분기 supersede — 무플래그 default=first-write-wins 보존, unknown mode → fail-closed default), §Follow-ups slice 1
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` §Decision 3 — reset-and-recreate(delete-if-exists → create, 단일 `$transaction`) + fill/reeval 모드 분기 + partial-reset(`@@unique` leading-edge) — 본 helper 가 표현할 plan 의 write-layer semantics source (본 task 는 write 안 함 — plan 만 계산)
- `src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts` — **shape mirror**(순수 함수 + 입력 등장 순서 보존 + 입력 비변형 + 명시적 null/undefined 한국어 메시지 `TypeError` + 한국어 JSDoc + colocated spec). 좌표 타입 `EvaluationPersistContext` 재사용 방식 참고
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` (47–52행) — `EvaluationPersistContext` 4-tuple(`personId / period / scope / periodStart`) 타입 정의(재사용, 새 좌표 타입 발명 0)
- `src/assessment-evaluation/evaluation-result-persist.service.ts` (44–45행 부근) — `PersistMode = "fill" | "reeval"` literal(재사용 참고 — 본 helper 는 이 mode 를 입력으로 받아 plan 을 계산)

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts` 에 의존성 0 순수 함수를 추가한다. `@Injectable` 0 / Prisma 0 / LLM 0 / repository 0 / 시계 비의존 / 입력 비변형.

- [ ] **함수 signature + 동작(ADR-0053 §Decision 1/4)**: `computeOverwriteReevalPlan(mode: string | undefined, targets: EvaluationPersistContext[], persisted: EvaluationPersistContext[]): OverwriteReevalPlan` 형태의 순수 함수를 export 한다. 반환 plan 은 최소 다음을 결정론적으로 구분해 담는다 — (a) `toReset`(mode 가 명시 reeval/overwrite 이고 target 좌표가 persisted 에 이미 존재 → delete→create 대상), (b) `toCreate`(target 좌표가 persisted 에 없음 → 신규 create 대상), (c) `preserved`(persisted 에 있으나 target 이 아니거나, 무플래그 default 에서 이미 존재 → first-write-wins read-through 로 보존). 좌표 비교 key 는 4-tuple(`personId / period / scope / periodStart` instant)로 exact match 한다.
- [ ] **무플래그 default 보존(ADR-0053 §Decision 4, 회귀 0)**: `mode` 가 `undefined`/빈 문자열/`"fill"` 이면 first-write-wins — 이미 persisted 에 존재하는 target 좌표는 `toReset` 이 아니라 `preserved`(read-through) 로 분류되고 `toReset` 은 빈 배열이다(overwrite 미발생). persisted 에 없는 target 만 `toCreate`.
- [ ] **fail-closed unknown mode(ADR-0053 §Decision 4)**: `mode` 가 정의 외 값(예: `"REEVAL"` 대소문자 불일치·`"delete"`·임의 문자열)이면 절대 overwrite 를 유발하지 않고 default(first-write-wins) 경로로 분류한다(`toReset` 빈 배열). 우발적 데이터 파괴 차단.
- [ ] **partial-reset 다른 좌표 보존(ADR-0053 §Decision 3)**: reeval mode 에서 target 이 persisted 의 **부분집합**(예: 한 person 의 한 period 만)일 때, target 에 없는 persisted 좌표(다른 period/scope/periodStart)는 `toReset` 에 포함되지 않고 `preserved` 로 유지된다("wiping others" 미발생). 즉 `toReset ⊆ (targets ∩ persisted)`.
- [ ] **row 수 idempotency 구조(ADR-0053 §Decision 2)**: 같은 입력으로 재호출 시 동일 plan 을 반환하고(결정론), reeval mode 에서 같은 좌표는 `toReset` 에 정확히 1 회만 등장한다(중복 축적 0 — delete→create 로 좌표당 row 1 수렴을 plan 레벨에서 보장). targets 에 같은 좌표가 중복 등장해도 reset 대상 좌표는 dedup 되어 1 회(또는 plan 이 dedup 를 명시적으로 표현) — 정확한 dedup 정책은 helper JSDoc 에 박제하고 spec 로 강제.
- [ ] **Happy-path unit test 1+**: (1) reeval mode + target 이 persisted 에 존재 → `toReset` 에 해당 좌표 포함·`toCreate` 빈 배열, (2) reeval mode + target 이 persisted 에 부재 → `toCreate` 에 포함·`toReset` 빈 배열, (3) 무플래그(undefined) + target 존재 → `preserved`·`toReset` 빈 배열, 각 happy-path 1+.
- [ ] **Error path unit test 1+**: `targets`/`persisted` 가 `null`/`undefined`/non-array 이거나, 원소가 `null`/`undefined` 이거나, 좌표 4-field 중 `personId`/`period`/`scope` 가 non-string(누락 포함)·`periodStart` 가 Date 아님/Invalid Date 일 때 한국어 메시지 `TypeError` throw(mirror: `evaluation-persisted-period-coordinates.ts` 방어). 각 축 1+.
- [ ] **Flow/branch coverage**: mode 분기(reeval/overwrite → reset 경로 / fill·undefined·unknown → default 경로) 각 분기 1+ test. 좌표 존재/부재 분기 각 1+. partial subset 분기 1+.
- [ ] **Negative cases 충분 cover(각 1+)**: (a) unknown mode → overwrite 미발생(`toReset` 빈 배열), (b) 빈 mode 문자열 → default 경로, (c) target 이 persisted 부분집합 → 다른 좌표 `preserved`(delete 대상에 미포함), (d) empty targets → 빈 plan(모두 빈 배열), (e) empty persisted + reeval → 모두 `toCreate`(reset 대상 0), (f) 같은 좌표 중복 target → reset 1 회 수렴, (g) periodStart 만 다른 두 좌표는 서로 다른 좌표로 취급(instant exact match), 각 1+.
- [ ] **입력 비변형 검증**: 함수 호출 후 `targets`/`persisted` 배열과 그 원소 좌표가 mutate 되지 않음을 spec 로 확인(부수효과 0).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 helper 파일은 순수 함수라 100% 근접 목표.

## Out of Scope

- **controller route / endpoint 신설·수정** — bridge 요청 DTO 의 mode 인자 수신(ADR-0053 §Follow-ups slice 1 의 DTO)·`POST /period` 표면 변경은 본 slice 밖. 후속 slice.
- **orchestrator/service 실배선** — `period-bridge-admin-persist.service` 등이 본 helper 를 호출해 mode 분기 → `persist(..., "reeval")` 를 실제로 부르는 배선은 ADR-0053 §Follow-ups slice 2. 본 slice 는 plan 계산 순수 함수만.
- **DB migration / schema 변경** — ADR-0053 §5 게이트 처리대로 새 migration 0. 기존 `@@unique` + reset-and-recreate 재사용이므로 schema 손대지 않음.
- **e2e / 실 PostgreSQL round-trip** — overwrite idempotency·partial-reset 보존·무플래그 회귀·동시 overwrite 수렴 e2e 는 §Follow-ups slice 3.
- **`EvaluationResultPersistService.persist` / `PersistMode` / repository 시그니처 변경** — 전부 read-only 재사용(변경 0). 본 helper 는 이들을 import 하지 않고 mode 를 순수 문자열 입력으로 받는다.
- **modelId 재해석(ADR-0048 resolver) 배선** — ADR-0053 §Decision 5 상호작용은 orchestrator slice(slice 2) 책임. 본 helper 는 modelId 를 다루지 않음.
- **평가 이력 보존 / versioning** — ADR-0053 §Follow-ups (deferred). 본 v1 은 reset-and-recreate(immutable 정합), 이력 미보존.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **slice 2 — bridge orchestration overwrite 분기** (`commitMode: pr`): orchestration service 가 mode 를 받아 본 helper 로 plan 계산 → (부재/fill → first-write-wins read-through 무변경 / reeval·overwrite → fresh collect → evaluate → `persist(..., "reeval")`) 분기 + mocked-LLM/mocked-collection unit(R-112 4 종 + negative: unknown mode → overwrite 미발생 / User ephemeral 경로 overwrite 무관 / partial-reset 다른 좌표 보존 / 동시 overwrite last-writer-wins row 1 수렴). modelId 재해석은 ADR-0048 resolver 재사용(ADR-0053 §Decision 5).
- **slice 1b — overwrite mode DTO** (`commitMode: pr`): bridge 요청 DTO 에 명시 mode 인자(`mode?: "reeval" | "overwrite"`) + class-validator(`@IsOptional`/`@IsEnum`/whitelist) + colocated spec. slice 2 배선의 요청 표면(slice 2 와 순서 조정 — DTO 먼저 또는 orchestration 먼저 중 의존성에 맞게).
- **slice 3 — e2e overwrite idempotency** (`commitMode: pr`, ADR-0004 실 PostgreSQL): overwrite round-trip(값 교체) + row 수 idempotency(재실행 row 1 불변) + partial-reset 다른 좌표 보존 + 무플래그 회귀 0 + 동시 overwrite 수렴(last-writer-wins).
- **slice 4 — PLAN line 107 status sync** (`commitMode: direct`): PLAN.md line 107 `(DEFERRED)` 표기를 구현 chain 진입/완결로 갱신 + ADR-0037 §Follow-ups unblock 반영. pr-mode 코드 chain 과 mixed chain 금지 — 별도 direct commit.

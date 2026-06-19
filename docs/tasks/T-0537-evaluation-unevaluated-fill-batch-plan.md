---
id: T-0537
title: 미평가 gap 좌표를 person 별 일괄 평가 batch plan 으로 요약하는 순수 helper buildUnevaluatedFillBatchPlan 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) — T-0536 gap 선별 helper 의 consume 짝. gap 좌표를 person 별 일괄 평가 batch plan 으로 요약하는 dependency-free 순수 helper
---

# T-0537 — 미평가 gap 좌표를 person 별 일괄 평가 batch plan 으로 요약하는 순수 helper buildUnevaluatedFillBatchPlan 추가

## Why

PLAN.md P5 bullet 106(R-64) "평가 재실행·부분 reset" / [README REQ-037](../requirements.md) "평가 없는 부분 일괄 평가 + Reset & Reeval" 의 detection→consume 패턴에서 **consume 조각**을 박제한다. 직전 T-0536 이 신설한 `selectUnevaluatedPeriods`([evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts)) 는 미평가(gap) 좌표 `EvaluationPersistContext[]` 를 **flat 배열**로 derive 하지만, 그 좌표들을 실제 "일괄 평가" 흐름에 흘리려면 **어느 person 의 어떤 좌표들을 한 batch 로 묶을지** 결정적으로 요약하는 단계가 필요하다. 본 task 는 gap 좌표 배열을 받아 **person 별로 그룹핑한 일괄 평가 batch plan**(person 별 미평가 좌표 묶음 + 총 gap 수 요약)을 derive 하는 dependency-free 순수 domain helper 1개를 신설한다 — orchestrator/DB-read 실배선(T-0536 Out of Scope) 전의, abuse/quality/notable layer 와 동형인 detection→consume 사슬의 consume 짝이다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts) — T-0536 산출 helper. 본 함수의 **입력**(gap 좌표 `EvaluationPersistContext[]`)을 만드는 상류. 좌표 동일성 키(`personId/period/scope/periodStart` 4-tuple, `getTime()` 정규화, Invalid Date sentinel, NUL 구분자, 정규화 안 함=exact match) 규약을 그대로 따른다(키 합성 로직 재발명 0 — 동일 정신).
- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — `EvaluationPersistContext { personId, period, scope, periodStart: Date }` 좌표 타입 (L47~52). 본 helper 의 입력 element 타입으로 `import type` 재사용한다 (새 좌표 타입 발명 금지).
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — 순수 도메인 helper 의 mirror 패턴 (Map 누적 + firstSeenOrder 안정적 반환 순서 + 입력 비변형 + 한국어 JSDoc). 본 helper 의 그룹핑 구조 정합 기준 — person 별 묶음을 **person 최초 등장 순서**로, 묶음 내부 좌표는 **gap 입력 등장 순서**로 안정 정렬.
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) §Decision3 — `"fill"`(평가 없는 부분만 채움) semantics. 본 batch plan 이 그 fill 대상을 person 단위로 묶은 일괄 평가 계획임을 확인 (재구현 0, single-source 정신).

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts` (colocated spec `evaluation-unevaluated-fill-batch-plan.spec.ts`):

- [ ] 순수 함수 `buildUnevaluatedFillBatchPlan(gaps: EvaluationPersistContext[]): UnevaluatedFillBatchPlan` export. 의존성 0 (NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0). `EvaluationPersistContext` 는 persist.mapper.ts 에서 `import type` 으로 재사용 (새 좌표 타입 발명 0).
- [ ] 반환 타입 `UnevaluatedFillBatchPlan` 신설 export — 최소 `{ batches: UnevaluatedFillBatch[]; totalGapCount: number; personCount: number }` 형태. `UnevaluatedFillBatch` = `{ personId: string; periods: EvaluationPersistContext[] }` (한 person 의 미평가 좌표 묶음). `totalGapCount` = 입력 gap 총 수, `personCount` = 고유 person 수 = `batches.length` (불변식: `totalGapCount === batches.reduce((s, b) => s + b.periods.length, 0)`).
- [ ] 그룹핑 — gap 좌표를 `personId` 기준으로 그룹핑. **person 묶음 순서 = person 최초 등장 순서**(firstSeenOrder, Map 누적), **묶음 내부 좌표 순서 = gap 입력 등장 순서** 둘 다 안정 보존. dedup 안 함(같은 좌표가 gap 에 중복 등장하면 해당 person 묶음에 중복 그대로 — 차집합 멤버십은 T-0536 책임, 본 helper 는 그룹핑만, JSDoc 명시).
- [ ] 비변형 — 입력 배열·원소 모두 mutate 0 (반환은 새 배열/객체, 좌표 원소는 입력 참조 그대로 또는 방어 복제 중 택1을 JSDoc 명시). `personId` 가 string 이 아니거나 원소가 null/undefined 면 한국어 메시지 `TypeError`(T-0536 / evaluation-dedup.ts 의 방어 패턴 mirror — fail-fast).
- [ ] **Happy-path test 1+** — 여러 person 의 gap 이 섞인 입력에서 person 별 묶음으로 그룹핑되는지(person 등장 순서 + 묶음 내부 좌표 순서 둘 다 검증). `totalGapCount`/`personCount` 수치 + 불변식(합 일치) 검증. 단일 person 다수 좌표, 다수 person 단일 좌표 각각.
- [ ] **Error path test 1+** — `gaps` 가 명시적 `null`/`undefined` 일 때 한국어 메시지 `TypeError`. 원소가 null/undefined 또는 `personId` 누락/타입 불일치 시 `TypeError`(T-0536 의 방어 정신 mirror).
- [ ] **Flow / branch coverage** — 각 분기 1+ test: (a) gap 비어있음(→ `batches []`, `totalGapCount 0`, `personCount 0`) (b) 단일 person (c) 다수 person (d) 같은 person 좌표가 비연속 등장(중간에 다른 person 끼어듦 → 같은 묶음으로 흡수, person 묶음 순서는 최초 등장 기준) (e) 같은 좌표 중복 등장(dedup 안 함, 묶음 내 중복 보존).
- [ ] **Negative cases 충분 cover** — 각 1+ test: ① null/undefined 입력 ② 원소 null/undefined ③ `personId` 빈 문자열(유효 person key 로 허용 — 정규화 안 함, 경계) ④ `personId` 대소문자/공백 차이가 별도 person 묶음으로 취급되는지(exact match, 정규화 안 함) ⑤ `personId` non-string(number 등) → `TypeError` ⑥ 입력 배열을 반환 후 외부에서 mutate 해도 반환 plan 이 영향받지 않는지(비변형 격리) — 또는 반환 plan mutate 시 입력 불변 검증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/function/stmt 100% 목표.
- [ ] `pnpm lint && pnpm build` clean.

## Out of Scope

- T-0536 `selectUnevaluatedPeriods` 변경 — 본 helper 는 그 출력을 소비만 한다(상류 불변).
- orchestrator / service / controller 실배선 (gap 선별 → batch plan → 실제 일괄 평가 실행을 `EvaluationOrchestratorService` 나 period bridge 에 compose 하는 것) — 별도 후속 wiring slice.
- DB read (실제 persisted/intended 좌표를 Prisma 로 조회) — 본 helper 는 순수 함수, 입력으로 받은 gap 배열만 다룬다. repository read 배선은 후속 task.
- 좌표 *생성* 로직(기간 enumeration 등) — 본 helper 는 주어진 gap 좌표의 그룹핑만 한다.
- `reeval`/overwrite 경로 변경 (ADR-0038 완료분) — 본 helper 와 직교, 건드리지 않는다.
- 새 좌표 타입/DTO 신설(단 `UnevaluatedFillBatchPlan`/`UnevaluatedFillBatch` 반환 wrapper 타입 신설은 본 task 범위 — 좌표 element 타입 발명만 금지), schema/migration, 새 dependency — 전부 금지 (§5 게이트 미발화 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

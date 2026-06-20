---
id: T-0540
title: 미평가 fill 계획 순수 compose helper composeUnevaluatedFillPlan 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) — 4 순수 조각(enumerate/project/select/batch-plan)을 1 deterministic detection 으로 잇는 dependency-free compose helper, impure DB-read 배선과 분리
---

# T-0540 — 미평가 fill 계획 순수 compose helper composeUnevaluatedFillPlan 추가

## Why

PLAN.md P5 bullet 106(R-64) "평가 재실행·부분 reset" / [README REQ-037](../requirements.md) "평가 없는 부분 일괄 평가 + Reset & Reeval" 의 detection 사슬을 구성하는 **4 개 순수 조각이 모두 박제됐으나 아직 하나로 묶이지 않았다**:

- T-0538 `enumerateIntendedPeriodCoordinates`([evaluation-intended-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts)) → `intended` 좌표 산출
- T-0539 `projectPersistedPeriodCoordinates`([evaluation-persisted-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts)) → `persisted` 좌표 투영
- T-0536 `selectUnevaluatedPeriods`([evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts)) → `(intended, persisted)` 차집합으로 gap 좌표 derive
- T-0537 `buildUnevaluatedFillBatchPlan`([evaluation-unevaluated-fill-batch-plan.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts)) → gap 좌표를 person 별 일괄 batch plan 으로 요약

현재 이 4 함수는 각각 독립 export 만 돼 있고, **"의도 좌표 입력 + 이미 읽어온 영속 레코드 배열 → 미평가 fill batch plan"** 의 단일 detection 단계로 묶는 조립부가 없다. 본 task 는 그 조립을 **순수 함수 1 개**(`composeUnevaluatedFillPlan`)로 닫는다 — enumerate → project → select → batch-plan 의 4 단계 호출을 결정적으로 잇는다. 이는 의존성 0 의 도메인 함수라 file-disjoint·credential 0 으로 cron 자율 진행 가능하며, 실제 Prisma `findByPerson` DB-read 배선(user module 경계·REQ-032/REQ-038 query 표면 결정 동반)은 본 helper 의 후속 impure wiring slice 로 깔끔히 분리된다. 본 helper 가 닫히면 detection 사슬의 **순수-도메인 측이 완전히 완결**되어, 남은 일은 impure 입력 source(DB-read) 배선 + orchestrator compose 뿐이다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts) — `enumerateIntendedPeriodCoordinates(input: IntendedPeriodCoordinatesInput): EvaluationPersistContext[]` 시그니처와 `IntendedPeriodCoordinatesInput { personIds; period; scope; rangeStart; rangeEnd }` 입력 타입. 본 helper 의 첫 단계 호출 대상이자 입력 wrapper 의 일부.
- [src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts) — `projectPersistedPeriodCoordinates(records: PersistedAssessmentRecord[]): EvaluationPersistContext[]` 시그니처와 `PersistedAssessmentRecord` 입력 타입(index signature 로 추가 컬럼 허용). 본 helper 의 두 번째 단계 호출 대상이자 입력 wrapper 의 일부.
- [src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts) — `selectUnevaluatedPeriods(intended, persisted): EvaluationPersistContext[]` 시그니처. 본 helper 의 세 번째 단계 — 위 두 단계 출력의 차집합으로 gap 좌표 derive. 좌표 동일성 키 4-tuple 의미.
- [src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts) — `buildUnevaluatedFillBatchPlan(gaps): UnevaluatedFillBatchPlan` 시그니처와 `UnevaluatedFillBatch` / `UnevaluatedFillBatchPlan` 반환 타입(L36~62). 본 helper 의 네 번째 단계이자 최종 반환 타입(재사용 — 새 plan 타입 발명 금지).
- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — `EvaluationPersistContext { personId, period, scope, periodStart: Date }` 좌표 타입(L47~52). 중간 단계 좌표 타입(직접 신설 금지 — 4 조각이 이미 import 재사용).
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — 순수 도메인 helper 의 mirror 패턴(부수효과 0 + 입력 비변형 + 한국어 JSDoc + 명시적 null/undefined `TypeError`). 본 helper 의 구조 정합 기준.

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts` (colocated spec `evaluation-unevaluated-fill-plan.spec.ts`):

- [ ] 순수 함수 `composeUnevaluatedFillPlan(input: UnevaluatedFillPlanInput): UnevaluatedFillBatchPlan` export. 의존성 0(NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0). 4 조각 함수(`enumerateIntendedPeriodCoordinates` / `projectPersistedPeriodCoordinates` / `selectUnevaluatedPeriods` / `buildUnevaluatedFillBatchPlan`)를 도메인 내 import 로 호출만 한다(재구현 0). 반환 타입 `UnevaluatedFillBatchPlan` 은 batch-plan helper 에서 `import type` 재사용(새 plan 타입 발명 0).
- [ ] 본 task 가 신설하는 타입은 입력 wrapper `UnevaluatedFillPlanInput` 1 종만 — 최소 `{ intended: IntendedPeriodCoordinatesInput; persisted: PersistedAssessmentRecord[] }` 형태(두 입력 타입은 각 조각 파일에서 `import type` 재사용 — 발명 0). JSDoc 으로 두 field 의 책임(`intended` = 의도 좌표 enumeration 입력, `persisted` = 이미 읽어온 영속 레코드 배열)을 명시.
- [ ] 조립 순서 — (1) `enumerateIntendedPeriodCoordinates(input.intended)` → intended 좌표, (2) `projectPersistedPeriodCoordinates(input.persisted)` → persisted 좌표, (3) `selectUnevaluatedPeriods(intended, persisted)` → gap 좌표, (4) `buildUnevaluatedFillBatchPlan(gaps)` → 최종 plan. 4 단계 결과를 그대로 흘려보내며 중간 가공/필터/정렬 추가 0(compose-only — 각 조각의 결정성·순서 정책을 그대로 보존, JSDoc 명시).
- [ ] 방어적 입력 처리 — `input` null/undefined → 한국어 메시지 `TypeError`. `input.intended` / `input.persisted` 가 누락(undefined)이면 한국어 메시지 `TypeError`로 조기 노출(각 조각의 내부 방어로 위임하기 전 wrapper level 1 차 fail-fast — evaluation-dedup.ts / T-0536~T-0539 방어 패턴 mirror). 각 조각 내부 방어(원소 타입 / Date / period 등)는 그대로 자연 전파(재던지지 않음 — single-source 방어, JSDoc 명시).
- [ ] 비변형 + 결정성 — `input` 객체 및 `intended` / `persisted` 내부 배열·원소 mutate 0. 같은 입력이면 같은 출력(시계 비의존 — 각 조각이 이미 시계 비의존). 본 helper 자체는 새 상태를 만들지 않고 4 조각 결과만 전달.
- [ ] **Happy-path test 1+** — 정상 `intended`(다수 person × 다수 anchor) + 일부 겹치는 `persisted` 레코드 입력 시, 최종 `UnevaluatedFillBatchPlan` 이 gap 좌표만 person 별 batch 로 요약돼 반환되는지 검증(end-to-end 사슬 1+ 통과). `persisted` 빈 배열이면 intended 전체가 gap 으로 plan 에 포함되는지 검증 1+.
- [ ] **Error path test 1+** — `input` null/undefined → `TypeError`. `input.intended` 누락 → `TypeError`. `input.persisted` 누락 → `TypeError`. 각 조각 내부 방어가 전파되는 case 1+(예: `input.intended.personIds` 원소 non-string → 조각의 `TypeError` 가 compose 를 통해 전파되는지, 또는 `input.persisted` 원소 `periodStart` 가 Invalid Date → 전파).
- [ ] **Flow / branch coverage** — 각 분기 1+ test: (a) gap 존재(intended ⊋ persisted) → 비어있지 않은 plan (b) gap 부재(persisted 가 intended 전부 cover) → 빈 batch plan(빈 좌표 → batch-plan helper 의 빈 결과) (c) `persisted` 빈 배열 → intended 전체가 gap (d) `intended.personIds` 빈 배열 → intended 좌표 0 → 빈 plan (e) input null/undefined 방어 분기 (f) `input.intended` 또는 `input.persisted` 누락 방어 분기.
- [ ] **Negative cases 충분 cover** — 각 1+ test: ① `input` 이 null ② `input` 이 undefined ③ `input.intended` 누락(undefined) → `TypeError` ④ `input.persisted` 누락(undefined) → `TypeError` ⑤ 조각 내부 방어 전파 — `input.persisted` 원소 `personId` non-string → `TypeError` 전파 ⑥ 조각 내부 방어 전파 — `input.intended.rangeStart` 가 Invalid Date → `TypeError` 전파 ⑦ 입력 객체/배열을 호출 후 외부에서 mutate 해도 반환 plan 이 영향받지 않는지(비변형 격리) 또는 동일 입력 2 회 호출 시 동일 plan(결정성 + 격리) ⑧ `persisted` 가 intended 와 무관한 좌표만 보유(차집합에서 누출 0 → intended 전체가 gap) 검증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/function/stmt 100% 목표.
- [ ] `pnpm lint && pnpm build` clean.

## Out of Scope

- T-0536 `selectUnevaluatedPeriods` / T-0537 `buildUnevaluatedFillBatchPlan` / T-0538 `enumerateIntendedPeriodCoordinates` / T-0539 `projectPersistedPeriodCoordinates` 변경 — 본 helper 는 그 4 조각을 **호출만** 한다(상류·하류 불변, 재구현 0).
- 실제 DB read(`AssessmentRepository.findByPerson` 를 Prisma 로 호출해 `persisted` 입력 배열을 산출, `intended` 의 person/range 결정) — 본 helper 책임 아님. 본 helper 는 **이미 결정된 input wrapper** 만 받아 4 조각을 잇는다. repository read 배선은 후속 impure wiring slice(user module 경계·REQ-038 query 표면 결정 동반).
- orchestrator / service / controller 실배선(본 compose helper 를 `EvaluationOrchestratorService` 나 period bridge 에 연결해 실제 일괄 평가를 트리거하는 것) — 별도 후속 wiring slice. 본 helper 는 순수 함수만(plan 산출까지).
- 평가 가능 시점 필터(`isPeriodEvaluable`) 적용 — 본 compose 는 순수 enumeration→차집합→plan 만. 진행 중 미완료 period 제외는 호출자가 별도 적용(분리된 책임, T-0538 Out of Scope 정합).
- 좌표 정규화 / dedup / 차집합 키 합성 로직 — 전부 호출되는 조각(T-0536) 책임. 본 helper 는 조립만(중복 책임 0).
- `reeval` / overwrite 경로 변경(ADR-0038 완료분) — 본 helper 와 직교, 건드리지 않는다.
- 새 좌표 타입 / 새 plan 타입 / DTO 신설(입력 wrapper `UnevaluatedFillPlanInput` 1 종만 신설 허용 — 나머지 타입은 전부 조각 파일에서 `import type` 재사용), schema / migration, 새 dependency — 전부 금지(§5 게이트 미발화 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

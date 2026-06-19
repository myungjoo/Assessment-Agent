---
id: T-0539
title: 영속 평가 레코드를 좌표로 투영하는 순수 helper projectPersistedPeriodCoordinates 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts
  - src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) — T-0538 intended 짝의 대칭 persisted 좌표 투영 순수 helper, selectUnevaluatedPeriods 의 두 번째 입력을 닫는 조각
---

# T-0539 — 영속 평가 레코드를 좌표로 투영하는 순수 helper projectPersistedPeriodCoordinates 추가

## Why

PLAN.md P5 bullet 106(R-64) "평가 재실행·부분 reset" / [README REQ-037](../requirements.md) "평가 없는 부분 일괄 평가 + Reset & Reeval" detection→consume 사슬의 **마지막 남은 입력 짝**을 박제한다. T-0536 `selectUnevaluatedPeriods`([evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts)) 는 두 좌표 집합 `(intended, persisted)` 의 차집합으로 미평가 gap 을 derive 하고, 직전 T-0538 `enumerateIntendedPeriodCoordinates`([evaluation-intended-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts)) 가 `intended` 입력을 산출했다. **그러나 두 번째 입력인 `persisted` 좌표 집합을 어디서 어떻게 만들지** 는 아직 박제되지 않았다 — T-0536/T-0537/T-0538 의 Out of Scope 가 일관되게 "DB read(영속화된 좌표를 Prisma 로 조회)" 를 분리해뒀다. 본 task 는 그 분리된 책임 중 **순수-함수 측 조각**만 닫는다: `AssessmentRepository.findByPerson`([assessment.repository.ts L131](../../src/user/assessment.repository.ts)) 이 반환하는 영속 Assessment 레코드 배열을, 좌표 4-tuple(`personId / period / scope / periodStart`) 만 투영한 `EvaluationPersistContext[]` 로 변환하는 dependency-free 순수 domain helper 1 개를 신설한다. 이는 T-0538 의 정확한 대칭 짝 — T-0538 은 `intended` 를 enumerate, 본 helper 는 `persisted` 를 project — 둘 다 T-0536 의 차집합으로 흘러 들어가 REQ-037 detection 사슬의 두 입력을 모두 닫는다. 실제 Prisma `findByPerson` 호출 배선은 여전히 후속 wiring slice 의 책임이다(본 helper 는 이미 읽어온 레코드 배열만 다룬다).

## Required Reading

- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — `EvaluationPersistContext { personId, period, scope, periodStart: Date }` 좌표 타입 (L47~52). 본 helper 의 **출력** element 타입으로 `import type` 재사용한다(새 좌표 타입 발명 금지).
- [src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts](../../src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts) — T-0538 산출 helper(본 task 의 대칭 짝). 두 helper 의 출력(`EvaluationPersistContext[]`)이 T-0536 의 `intended` / `persisted` 두 인자로 각각 흘러간다. 입력 wrapper 타입 신설 / 방어적 입력 처리 / 비변형 / 결정성 구조 정합 기준을 그대로 mirror 한다.
- [src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts) — T-0536 산출 helper. 본 helper 의 출력이 그 `persisted` 입력으로 흘러간다. 좌표 동일성 키 4-tuple(`personId / period / scope / periodStart`) 의미와 `periodStart` `getTime()` instant 정규화 정신을 따라야 한다(키 합성은 본 helper 책임 아님 — 좌표 element 투영만).
- [src/user/assessment.repository.ts](../../src/user/assessment.repository.ts) — `AssessmentRepository.findByPerson`(L131) 의 반환 레코드가 본 helper 의 입력 source. 영속 Assessment 레코드는 좌표 4-field(`personId / period / scope / periodStart`) 외에 `difficulty / contributionScore / volume / narrative` 등 추가 컬럼을 보유하지만(L47~63 `AssessmentCreateInput` 동형) 본 helper 는 **좌표 4-field 만 투영**한다(추가 컬럼 무시). 본 module 의 `AssessmentCoordinate`(L70~75) 는 user module 소속이라 역방향 import 금지 — 본 helper 는 `EvaluationPersistContext` 만 출력 타입으로 쓴다.
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — 순수 도메인 helper 의 mirror 패턴(Map / 배열 누적 + 입력 등장 순서 보존 + 비변형 + 한국어 JSDoc + 명시적 null/undefined `TypeError`). 본 helper 의 구조 정합 기준.
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) §Decision 1 / §51 — 좌표 4-tuple(`personId / period / scope / periodStart`)이 영속 식별 축임을 확인(`@@unique([personId, period, scope, periodStart])`). 본 helper 가 그 영속 레코드에서 좌표 축만 추출함을 정합 검증(재구현 0, single-source 정신).

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts` (colocated spec `evaluation-persisted-period-coordinates.spec.ts`):

- [ ] 순수 함수 `projectPersistedPeriodCoordinates(records: PersistedAssessmentRecord[]): EvaluationPersistContext[]` export. 의존성 0(NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0). `EvaluationPersistContext` 는 persist.mapper.ts 에서 `import type` 으로 재사용(새 좌표 타입 발명 0). 본 task 가 신설하는 타입은 입력 element wrapper `PersistedAssessmentRecord` 1 종만 — 최소 `{ personId: string; period: string; scope: string; periodStart: Date }` 형태(영속 레코드의 좌표 축 부분집합, 추가 컬럼은 구조적 무시를 위해 인터페이스에 포함하지 않거나 optional index 로 허용 — JSDoc 명시).
- [ ] 투영 규칙 — 입력 레코드 각각에서 **좌표 4-field 만 추출**해 `{ personId, period, scope, periodStart }` 좌표 1 개를 생성. 추가 컬럼(`difficulty / contributionScore / volume / narrative / id` 등)이 입력 객체에 함께 있어도 출력에 누출 0(좌표 4-field 만). **입력 등장 순서 보존**(stable, JSDoc 명시 — 별도 정렬 0, 차집합 매칭은 T-0536 책임).
- [ ] 좌표 `periodStart` 처리 — 입력 레코드의 `periodStart`(Date instance)를 그대로 또는 방어 복제 중 택1을 JSDoc 명시. 입력 객체/배열 mutate 0(반환은 새 배열, 좌표 element 는 새 객체). `personId / period / scope` 는 string 참조 그대로(string immutable).
- [ ] 비변형 + 결정성 — 입력 객체/배열 mutate 0, 같은 입력이면 같은 출력(시계 비의존). 빈 `records` → 빈 배열. dedup 안 함(같은 좌표가 입력에 중복 등장하면 출력도 중복 그대로 — 멤버십/차집합은 T-0536 책임, JSDoc 명시).
- [ ] 방어적 입력 처리 — `records` null/undefined → 한국어 메시지 `TypeError`. 원소가 null/undefined → `TypeError`. 원소의 `personId / period / scope` 가 string 아니거나 누락 → `TypeError`. `periodStart` 가 `Date` 가 아니거나 Invalid Date → `TypeError`(evaluation-dedup.ts + T-0536 + T-0538 방어 패턴 mirror, fail-fast).
- [ ] **Happy-path test 1+** — 여러 영속 레코드(좌표 4-field + 추가 컬럼 혼재)가 좌표 4-field 만 투영돼 입력 등장 순서로 반환되는지 검증. 추가 컬럼(`difficulty` / `narrative` 등)이 출력 좌표 element 에 누출 0 인지 검증 1+. 단일 레코드 / 다수 레코드 각각.
- [ ] **Error path test 1+** — `records` null/undefined → `TypeError`. 원소 null/undefined → `TypeError`. 원소 `personId` / `period` / `scope` 누락 또는 non-string → `TypeError`. `periodStart` 가 Date 아님 / Invalid Date → `TypeError`.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: (a) 빈 `records` → 빈 배열 (b) 단일 레코드 (c) 다수 레코드(순서 보존 검증) (d) 추가 컬럼 포함 레코드(좌표 4-field 만 투영, 추가 컬럼 누출 0) (e) 같은 좌표 중복 등장(dedup 안 함, 중복 보존) (f) `periodStart` 가 서로 다른 Date 객체지만 동일 instant 인 두 레코드가 각각 독립 투영되는지(정규화/병합 안 함 — 본 helper 는 투영만, instant 정규화는 T-0536 차집합 키 책임).
- [ ] **Negative cases 충분 cover** — 각 1+ test: ① 원소 `personId` non-string(number 등) → `TypeError` ② 원소 `personId` 빈 문자열("") 허용(정규화 안 함, exact match — T-0536/T-0538 정신) ③ 원소 `scope` / `period` 빈 문자열 허용(exact match) ④ 입력 배열을 반환 후 외부에서 mutate 해도 반환 좌표가 영향받지 않는지(비변형 격리) — 또는 반환 좌표 mutate 시 입력 레코드 불변 검증 ⑤ 출력 좌표 element 의 `periodStart.getTime()` 이 입력 레코드 instant 와 정확히 일치(투영 충실성) ⑥ 입력 내부 중복 좌표(예: 동일 4-tuple 2 건) → 출력도 2 건(dedup 안 함, 호출자/T-0536 책임 JSDoc 명시) ⑦ 추가 컬럼만 다르고 좌표 4-field 동일한 두 레코드 → 출력 좌표 2 건 동일(추가 컬럼 무시 확인).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/function/stmt 100% 목표.
- [ ] `pnpm lint && pnpm build` clean.

## Out of Scope

- T-0536 `selectUnevaluatedPeriods` / T-0537 `buildUnevaluatedFillBatchPlan` / T-0538 `enumerateIntendedPeriodCoordinates` 변경 — 본 helper 는 그 입력 측 짝으로 추가만 한다(상류·하류 불변).
- 실제 DB read(`AssessmentRepository.findByPerson` 를 Prisma 로 호출해 영속 레코드 배열을 산출) — 본 helper 책임 아님. 본 helper 는 **이미 읽어온 레코드 배열**만 좌표로 투영한다. repository read 배선은 후속 wiring slice.
- orchestrator / service / controller 실배선(enumerate(intended) + project(persisted) → 차집합(T-0536) → batch plan(T-0537) → 실제 일괄 평가 실행을 `EvaluationOrchestratorService` / period bridge 에 compose 하는 것) — 별도 후속 wiring slice. 본 helper 는 순수 함수만.
- 좌표 정규화 / dedup / 차집합 매칭 — 본 helper 는 **투영(projection)** 만. instant 정규화·중복 제거·멤버십 판정은 전부 T-0536 차집합 helper 책임(중복 책임 0).
- 평가 가능 시점 필터(`isPeriodEvaluable`) / period granularity 확장 — 본 helper 와 직교, 건드리지 않는다.
- `reeval` / overwrite 경로 변경(ADR-0038 완료분) — 본 helper 와 직교, 건드리지 않는다.
- 새 좌표 타입 / DTO 신설(`EvaluationPersistContext` 재사용, 입력 wrapper `PersistedAssessmentRecord` 1 종만 신설 허용), `AssessmentCoordinate` import(역방향 의존 금지), schema / migration, 새 dependency — 전부 금지(§5 게이트 미발화 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

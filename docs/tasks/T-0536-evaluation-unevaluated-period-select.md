---
id: T-0536
title: 평가 없는 부분(미평가 좌표) 선별 순수 helper selectUnevaluatedPeriods 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts
  - src/assessment-evaluation/domain/evaluation-unevaluated-period-select.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) "평가 없는 부분 일괄 평가" — 미평가 좌표 gap 선별 dependency-free 순수 helper, fill-mode 의 upfront detection 짝
---

# T-0536 — 평가 없는 부분(미평가 좌표) 선별 순수 helper selectUnevaluatedPeriods 추가

## Why

PLAN.md P5 bullet 106(R-64) "평가 재실행·부분 reset" / [README REQ-037](../requirements.md) "평가 없는 부분 일괄 평가 + Reset & Reeval" 의 잔여 capability 인 **"평가 없는 부분(미평가 좌표) 선별"** 을 박제한다. 현재 persist layer 의 `"fill"` mode 는 좌표 존재 시 reactive 하게 no-op 으로 건너뛰지만([evaluation-result-persist.service.ts L43](../../src/assessment-evaluation/evaluation-result-persist.service.ts) "fill = 평가 없는 부분만 채움"), **batch caller 가 미리 어느 좌표가 미평가인지 알 수 있는 upfront 선별 helper 는 없다**. 본 task 는 의도된 좌표 집합과 이미 영속화된 좌표 집합을 받아 **미평가(gap) 좌표 subset 만 결정적으로 derive** 하는 dependency-free 순수 domain helper 1개를 신설한다 — `"reeval"`(이미 평가된 것을 덮어쓰기, ADR-0038 완료)와 직교한 "아직 평가 안 된 것만 골라 일괄 평가" 경로의 detection 조각이다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — `EvaluationPersistContext { personId, period, scope, periodStart: Date }` 좌표 타입 (L47~52). 본 helper 의 입출력 element 타입으로 재사용한다 (새 좌표 타입 발명 금지).
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — 순수 도메인 helper 의 mirror 패턴 (Map 누적 + firstSeenOrder 안정적 반환 순서 + 입력 비변형 + throw 0 흡수 경계 + 한국어 JSDoc). 본 helper 의 구조 정합 기준.
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) §Decision3 — `"fill"`(평가 없는 부분만 채움) / partial-reset semantics. 본 helper 가 그 fill-skip 을 upfront 로 끌어올린 detection 짝임을 확인 (재구현 0, single-source 정신).
- [docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) §Decision3 — `reevaluate`(overwrite, 완료) 와 본 미평가-선별이 **직교** 함을 확인. 본 helper 는 reeval 경로를 건드리지 않는다.

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts` (colocated spec `evaluation-unevaluated-period-select.spec.ts`):

- [ ] 순수 함수 `selectUnevaluatedPeriods(intended: EvaluationPersistContext[], persisted: EvaluationPersistContext[]): EvaluationPersistContext[]` export. 의존성 0 (NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0). `EvaluationPersistContext` 는 persist.mapper.ts 에서 `import type` 으로 재사용 (새 좌표 타입 발명 0).
- [ ] 좌표 동일성 키 = `(personId, period, scope, periodStart)` 4-tuple 의 결정적 합성 (periodStart 는 `Date` → `getTime()` 또는 ISO 정규화로 stable key, 동일 instant 의 서로 다른 Date 객체가 같은 key 로 매칭되도록). `persisted` 에 같은 key 가 존재하는 `intended` 원소는 제외하고, 존재하지 않는(미평가 gap) 원소만 **`intended` 입력 등장 순서 보존** 으로 반환.
- [ ] 비변형 — 입력 배열·원소 모두 mutate 0 (반환은 새 배열, 원소는 입력 참조 그대로 또는 방어 복제 중 택1을 JSDoc 명시).
- [ ] **Happy-path test 1+** — intended 일부가 persisted 와 겹치는 경우 gap subset 만 반환 (순서 보존 검증 포함). persisted 빈 배열이면 intended 전체 반환. persisted 가 intended 를 전부 cover 하면 빈 배열 반환.
- [ ] **Error path test 1+** — `intended`/`persisted` 가 명시적 `null`/`undefined` 일 때 한국어 메시지 `TypeError` (evaluation-dedup.ts 의 방어 패턴 mirror). 원소가 좌표 4-field 중 하나라도 누락/타입 불일치 시 처리 정책을 JSDoc 명시 후 그 분기 test.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: (a) gap 존재 (b) gap 부재(전부 cover) (c) persisted 빈 배열 (d) intended 빈 배열(→빈 배열) (e) periodStart 동일 instant 다른 Date 객체 매칭 (f) 4-tuple 중 1개만 달라 미매칭(별도 좌표로 gap 유지).
- [ ] **Negative cases 충분 cover** — 각 1+ test: ① null/undefined 입력 ② intended 내부 중복 좌표(dedup 여부 정책 JSDoc 명시 후 검증) ③ persisted 에만 있고 intended 에 없는 좌표(반환에 누출 0) ④ periodStart Invalid Date ⑤ 빈 문자열 personId/period/scope 경계 ⑥ 대소문자/공백 차이가 별도 좌표로 취급되는지(정규화 안 함 — exact match) 검증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/function/stmt 100% 목표.
- [ ] `pnpm lint && pnpm build` clean.

## Out of Scope

- orchestrator / service / controller 실배선 (본 helper 를 `EvaluationOrchestratorService` 나 period bridge 에 compose 하는 것) — 별도 후속 wiring slice.
- DB read (실제 persisted 좌표를 Prisma 로 조회) — 본 helper 는 순수 함수, 입력으로 받은 두 배열만 다룬다. repository read 배선은 후속 task.
- `reeval`/overwrite 경로 변경 (ADR-0038 완료분) — 본 helper 와 직교, 건드리지 않는다.
- 새 좌표 타입/DTO 신설, schema/migration, 새 dependency — 전부 금지 (§5 게이트 미발화 유지).
- `intended` 좌표 집합을 *생성* 하는 로직(기간 enumeration 등) — 본 helper 는 주어진 두 집합의 차집합만 derive.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

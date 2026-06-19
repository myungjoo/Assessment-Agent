---
id: T-0524
title: 문서 update 횟수 중립화 detection 순수 helper computeUpdateCountNeutralization 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-022]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-19
independentStream: evaluation-abuse
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-update-count-neutral.ts
  - src/assessment-evaluation/domain/evaluation-update-count-neutral.spec.ts
plannerNote: P5 bullet 102(R-41/REQ-022 문서 update 횟수 중립화) detection slice — T-0521 computeAbuseSignal 패턴 mirror, 순수 domain helper(배선 0)
---

# T-0524 — 문서 update 횟수 중립화 detection 순수 helper computeUpdateCountNeutralization 추가

## Why

PLAN.md Phase P5 bullet 102 (R-41 / REQ-022) — "습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage/disadvantage **둘 다 없어야**" 를 구현하는 첫 slice 다. 문서(Confluence page) 의 `version`(update 횟수) 이 부풀어도 그것이 평가 양/점수에 **유리하게도 불리하게도 작용하지 않도록(중립)** 결정적으로 식별하는 detection 신호를 산출한다. 본 task 는 T-0521 `computeAbuseSignal`(detection) → T-0522 소비 → T-0523 배선 으로 검증된 granularity 를 따라, **detection layer 만**(orchestrator 배선·volume 조정은 후속 task) 박제한다. R-41 은 R-26/R-40 abusing(감점)과 의미가 다르다 — abusing 은 감점, R-41 은 **중립(net 0, 보너스도 페널티도 없음)** 이라 별도 신호로 분리한다.

## Required Reading

- `docs/PLAN.md` (L94~109, Phase P5 bullet 102 R-41 맥락)
- `src/assessment-evaluation/domain/evaluation-abuse-signal.ts` (mirror 대상 — 순수 함수 구조 / author 그룹핑 / 입력 비변형 / throw 0 방어 / 결정성)
- `src/assessment-evaluation/domain/evaluation-input.ts` (`EvaluationInput` / `ContributionKind` 타입)
- `src/assessment-evaluation/domain/evaluation-volume.ts` (volume 산출 규칙 — version metadata 가 현재 volume 에 미반영임을 확인, 중복 카운트 방지 근거)
- `src/assessment-collection/domain/activity.ts` (L73~79 — Confluence `version`(page update 횟수) 필드 위치 / `ActivityMetadata` scalar 정책)
- 신규 spec colocated 위치 (의무): `src/assessment-evaluation/domain/evaluation-update-count-neutral.spec.ts`

## Acceptance Criteria

- [ ] 신규 순수 함수 `computeUpdateCountNeutralization(inputs: EvaluationInput[])` 를 `src/assessment-evaluation/domain/evaluation-update-count-neutral.ts` 에 추가. NestJS `@Injectable` / Prisma / LLM gateway import 0, throw 0(명시적 null/undefined 입력 계약 위반 외), 부수효과 0(입력 비변형), 동일 입력 동일 출력(결정적, LLM 무관). `evaluation-abuse-signal.ts` 구조를 mirror.
- [ ] 산출 신호 타입(예: `UpdateCountNeutralization` + author 별 `UpdateCountNeutralEntry`) 을 export. author 별로 update 횟수(Confluence `version`, document kind) 가 임계 이상 부풀려진 단위를 식별하고 `neutralized` 플래그 + 대상 `unitId` 목록을 결정적으로 산출. 임계 상수(예: `UPDATE_COUNT_NEUTRAL_THRESHOLD`)는 `export const` 로 두고 JSDoc 에 v1 baseline 근거 명시.
- [ ] **Happy-path test 1+**: document 단위의 `version`(metadata) 이 임계 이상이면 해당 단위가 `neutralized` 로 식별됨을 단언. code 단위(version 무관)는 식별 대상이 아님을 단언.
- [ ] **Error path test 1+**: 명시적 입력 계약 위반(`inputs` 가 null/undefined) 시 한국어 `TypeError` throw 단언 + `version` metadata 누락/비-number(string/boolean/null) 단위가 throw 없이 0(중립 미식별) 으로 흡수됨 단언.
- [ ] **Flow / branch coverage** (각 분기 1+): (a) version 임계 이상 document 단위(neutralized=true), (b) version 임계 미만 document 단위(neutralized=false), (c) code 단위(contributionKind 분기로 미대상), (d) version 이 비유한 number(NaN/Infinity) → 방어적 0 처리 분기.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `inputs` 배열 → 빈 신호(neutralized 없음), (ii) version 필드 부재 metadata, (iii) version=0 / 음수(방어 절하), (iv) 동일 author 다수 document 단위 일부만 임계 초과(부분 식별 정합), (v) 다수 author 혼합 batch 에서 author 별 독립 집계(최초 등장 순서 보존 결정성), (vi) 비-Confluence document(github issue 등 version 부재) 단위가 식별 대상이 아님. 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 `toEqual` 동일 출력. **비변형 단언**: 입력 `inputs` / 원소가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-update-count-neutral.ts` line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- orchestrator 배선 0 — `EvaluationOrchestratorService` / scoring service 변경 금지. 본 신호를 소비해 volume/점수를 중립화하는 것은 **후속 task** (T-0522/T-0523 가 abuse 신호에 했던 소비·배선 패턴 mirror).
- `evaluation-volume.ts` 변경 0 — volume 산출 규칙에 version 을 새로 더하지 않는다(R-41 은 "유리하지도 불리하지도 않게" 이므로 volume 가산이 아니라 중립 식별이 목적). version 을 volume 에 반영하는 변경은 R-41 정신 위반.
- `computeAbuseSignal`(R-26/R-40 감점) 신호와의 통합/우선순위 결정 0 — 두 신호의 합성·충돌 해소는 별도 task.
- `EvaluationInput` / `ContributionKind` / `ActivityMetadata` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0 (detection deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

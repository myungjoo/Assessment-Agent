---
id: T-0525
title: update 횟수 중립화 신호 소비 volume 중립 보존 순수 helper applyUpdateCountNeutralizationToVolume 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-022]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
completedAt: 2026-06-19T15:20:50Z
prNumber: 438
mergedAs: 2f70aa6
reviewRounds: 1
independentStream: evaluation-abuse
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-update-count-adjust.ts
  - src/assessment-evaluation/domain/evaluation-update-count-adjust.spec.ts
plannerNote: P5 bullet 102(R-41/REQ-022 update 횟수 중립화) 소비 slice — T-0522 applyAbuseSignalToVolume 패턴 mirror, 순수 domain helper(배선 0), net 0 중립 보존(감점 아님)
---

# T-0525 — update 횟수 중립화 신호 소비 volume 중립 보존 순수 helper applyUpdateCountNeutralizationToVolume 추가

## Why

PLAN.md Phase P5 bullet 102 (R-41 / REQ-022) — "습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage/disadvantage **둘 다 없어야**" 의 **소비(consumption) slice** 다. T-0524 `computeUpdateCountNeutralization`(detection, merge 9306bf5) 이 산출한 `UpdateCountNeutralization` 신호를 소비해, 중립 대상으로 식별된 author/unit 의 평가 단위 `volume` 이 **유리하게도 불리하게도 작용하지 않도록(net 0, 중립 보존)** 결정적으로 처리하는 순수 domain helper 를 박제한다.

이 task 는 abusing 스트림의 검증된 granularity 를 그대로 따른다 — T-0521 detection → **T-0522 소비(`applyAbuseSignalToVolume`)** → T-0523 orchestrator 배선. 본 task 는 그 중 **소비 layer(T-0522 mirror)** 에 대응한다. 단 **의미가 다르다**: T-0522 는 abusing 을 **감점(penalty)** 하지만, R-41 은 **중립(net 0 — 보너스도 페널티도 없음)** 이다. 따라서 본 helper 는 "version 으로 부푼 만큼의 잉여 기여를 advantage 로 쳐주지 않고(상한 보존), 동시에 페널티로 깎지도 않는" 중립 보존 규칙을 구현한다. orchestrator 실배선은 후속 task (T-0523 mirror) 로 분리한다.

## Required Reading

- `docs/PLAN.md` (L94~109, Phase P5 bullet 102 R-41 맥락 — "advantage/disadvantage 둘 다 없어야")
- `src/assessment-evaluation/domain/evaluation-update-count-neutral.ts` (소비 대상 detection 신호 — `UpdateCountNeutralization` / `UpdateCountNeutralEntry` / `neutralized` / `neutralizedUnitIds` / `byAuthor` shape)
- `src/assessment-evaluation/domain/evaluation-abuse-adjust.ts` (mirror 대상 — 소비 helper 구조: `{ author, result }[]` entries signature / author Map 색인 / 입력 비변형 / 새 배열·새 객체 반환 / throw 0 흡수 정책 / 명시적 null·undefined 계약 위반만 한국어 TypeError)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult` — `volume` / `unitId` 필드, author 미보유 확인 → caller 가 author 매핑 동반 전달 근거)
- 신규 spec colocated 위치 (의무): `src/assessment-evaluation/domain/evaluation-update-count-adjust.spec.ts`

## Acceptance Criteria

- [ ] 신규 순수 함수 `applyUpdateCountNeutralizationToVolume(entries, neutralization)` 를 `src/assessment-evaluation/domain/evaluation-update-count-adjust.ts` 에 추가. 입력 entries 는 `{ author, result }[]`(T-0522 `AbuseAdjustEntry` 와 동형 shape, 본 파일 전용 타입 export — 예: `UpdateCountAdjustEntry`), 두 번째 인자는 T-0524 산출 `UpdateCountNeutralization`. NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 동일 출력(결정적, LLM 무관). `evaluation-abuse-adjust.ts` 구조를 mirror.
- [ ] **중립 보존 규칙(R-41 net 0)을 명확히 구현**: `neutralization.byAuthor` 를 author → entry 로 색인하고, **중립 대상(neutralized=true / unitId ∈ neutralizedUnitIds)** 인 단위의 `volume` 을 "update 횟수 부풀림이 advantage 로 작용하지 않도록" 처리하되 **페널티(감점)도 가하지 않는다**. 규칙은 결정적·단조여야 하며, 그 v1 baseline 근거(예: 중립 대상 단위는 version 부풀림과 무관한 기준 volume 으로 보존 — net 0)를 JSDoc 과 `export const` 상수(예: `UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR`)에 명시. abusing 감점 공식(`floor(volume*(1-ratio))`)을 그대로 베끼지 말 것 — R-41 은 감점이 아니라 중립.
- [ ] 미대상(중립 대상 아님) 단위는 **volume 무변경 passthrough** (단 항상 새 객체로 복제해 입력 비변형 보장). 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열(caller 매핑 재사용 보장).
- [ ] **Happy-path test 1+**: `neutralization` 에서 neutralized=true 로 식별된 author/unit 의 `result.volume` 이 중립 규칙대로 보존됨(advantage 도 penalty 도 없음)을 단언. 미대상 단위는 volume 그대로 전사됨을 단언.
- [ ] **Error path test 1+**: 명시적 입력 계약 위반(`entries` 가 null/undefined → 한국어 `TypeError`, `neutralization` 이 null/undefined → 한국어 `TypeError`) 단언. 그 외 결함(빈 entries · 빈 byAuthor · author 미매칭 · volume 이 이미 0)은 throw 없이 흡수됨 단언.
- [ ] **Flow / branch coverage** (각 분기 1+): (a) author 가 신호에 존재 + 해당 unit 이 중립 대상 → 중립 보존 분기, (b) author 존재하나 unit 이 neutralizedUnitIds 에 없음 → 무변경, (c) author 미매칭 → 무변경, (d) volume 이 비유한/음수 layer-경계 입력 → 방어 절하 분기.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `entries` 배열 → 빈 배열 반환, (ii) `neutralization.byAuthor` 빈 배열 → 전 단위 무변경 복제, (iii) author 미매칭 단위, (iv) 동일 author 다수 단위 중 일부만 unitId 가 중립 대상(부분 적용 정합), (v) 다수 author 혼합 entries(독립 처리·순서 보존), (vi) volume 이 0 / 음수 / NaN/Infinity layer 경계(방어 절하, throw 0). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 `toEqual` 동일 출력. **비변형 단언**: 입력 `entries` / 원소 / `result` / `neutralization` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-update-count-adjust.ts` line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- orchestrator 배선 0 — `EvaluationOrchestratorService` / scoring service 변경 금지. 본 신호 소비를 실 evaluation 흐름에 import 하는 것은 **후속 task** (T-0523 가 abuse 신호에 한 배선 패턴 mirror).
- detection 재구현 0 — `evaluation-update-count-neutral.ts`(T-0524) 변경 금지. 본 helper 는 그 산출 `UpdateCountNeutralization` 신호만 **소비**한다(single-source).
- abuse 신호(`applyAbuseSignalToVolume`)와의 합성/우선순위 결정 0 — 감점 신호와 중립 신호의 적용 순서·충돌 해소는 별도 task.
- `evaluation-volume.ts` 변경 0 — volume 산출 규칙에 version 을 새로 더하지 않는다(R-41 정신: version 가산이 아니라 중립).
- `EvaluationResult` / `EvaluationInput` / `UpdateCountNeutralization` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0 (소비 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

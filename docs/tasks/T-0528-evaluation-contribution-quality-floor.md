---
id: T-0528
title: 기여 품질 신호 소비 contribution floor 강등 순수 helper applyContributionQualityFloor 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: p5-evaluation-quality-class
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-quality-adjust.ts
  - src/assessment-evaluation/domain/evaluation-quality-adjust.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 103(R-37/R-38 품질 분류) 소비 slice — T-0527 ContributionQualitySignal 소비해 contribution 을 zero 로 floor 강등하는 순수 helper, T-0525 mirror, pr ~240 LOC 2 파일 disjoint
---

# T-0528 — 기여 품질 신호 소비 contribution floor 강등 순수 helper applyContributionQualityFloor 추가

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 103 (R-37 / R-38: "단순 보고·copy-paste 로그 = zero-contribution / 새 알고리즘 설계·외부 연구 도입 = 높은 contribution") 의 **소비(consumption) slice** 다. T-0527 `computeContributionQualitySignal`(detection, merge cbd5232) 이 산출한 `ContributionQualitySignal` 신호를 소비해, zero-contribution 후보로 식별된 author/unit 의 `EvaluationResult.contribution` 을 **결정적으로 `"zero"` 로 floor 강등**(LLM 정성 평가가 zero 보다 높게 매겼더라도 하한 강제)하는 순수 domain helper 를 박제한다.

이 task 는 검증된 detection → consume → orchestrator 3-slice 패턴(abuse: T-0521 → T-0522 → T-0523, update-count: T-0524 → T-0525 → T-0526)의 **소비 layer** 에 대응하며, 형제 소비 helper [applyUpdateCountNeutralizationToVolume](../../src/assessment-evaluation/domain/evaluation-update-count-adjust.ts)(T-0525) 의 구조를 충실히 mirror 한다. 단 **소비 대상 필드가 다르다**: abuse/update-count 는 `volume`(정량 수치)을 조정하지만, R-37/R-38 은 **`contribution`(품질 등급 enum)** 을 다룬다 — 신호 대상 단위의 `contribution` 을 `"zero"` 로 강등하는 결정적 하한(floor)이다. orchestrator 실배선은 후속 task(T-0526 mirror)로 분리한다. `git grep -E "applyContributionQualityFloor|ContributionQualityFloor|ContributionQualityAdjust" origin/main -- 'src/**'` 0 매칭 — issue-still-relevant pre-check 통과.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` (소비 대상 detection 신호, T-0527 산출 — `ContributionQualitySignal` / `ContributionQualityEntry` / `byAuthor` / `zeroContributionUnitIds` / `zeroContribution` shape. 본 helper 가 색인·조회할 신호 구조)
- `src/assessment-evaluation/domain/evaluation-update-count-adjust.ts` (mirror 원형 — 소비 helper 구조: `{ author, result }[]` entries signature / author Map 색인 / 입력 비변형(새 배열·새 객체만 반환) / 같은 길이·같은 순서 보존 / throw 0 흡수 정책 / 명시적 null·undefined 계약 위반만 한국어 TypeError / 결정성)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult` — `contribution`(`ContributionLevel` = zero/low/medium/high union, L24~42) / `unitId` 필드, author 미보유 확인 → caller 가 author 매핑 동반 전달 근거. `ContributionLevel`/`CONTRIBUTION_LEVELS`/`isContributionLevel` 도 본 파일에 박제)
- 신규 spec colocated 위치 (의무): `src/assessment-evaluation/domain/evaluation-quality-adjust.spec.ts`

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` 에 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 → 항상 동일 출력(결정적, LLM 무관). `evaluation-update-count-adjust.ts` 구조를 mirror.
- 입력 contract(권장 shape — 자유 재량): 첫 인자 entries 는 `{ author: string; result: EvaluationResult }[]`(T-0525 `UpdateCountAdjustEntry` 와 동형, 본 파일 전용 타입 export — 예: `ContributionQualityAdjustEntry`). 둘째 인자는 T-0527 산출 `ContributionQualitySignal`.
- **floor 강등 규칙(R-37/R-38)을 명확히 구현**: `signal.byAuthor` 를 author → entry 로 색인하고, 해당 author 의 `zeroContributionUnitIds` 에 `result.unitId` 가 포함된 단위의 `result.contribution` 을 `"zero"` 로 강등한다. 이미 `"zero"` 인 단위는 멱등(변화 없음, 새 객체 복제는 유지). 신호 미대상 단위는 `contribution` 무변경 passthrough(단 항상 새 객체로 복제해 입력 비변형 보장).
- **floor 는 단조·하한**: contribution 을 올리지 않는다(상향은 LLM 정성 평가 영역 — Out of Scope). 오직 신호 대상 단위를 zero 로 내리는 하한만. `"zero"` 가 등급 최하임을 JSDoc 에 명문화(`CONTRIBUTION_LEVELS` single-source 참조).
- 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열(caller 매핑 재사용 보장).
- 임계/상수가 필요하면(예: floor 대상 등급 = `"zero"`) named const 로 single-source(예: `export const CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"`) + JSDoc 으로 근거 명문화.
- author 미매칭 / 빈 entries / 빈 byAuthor / contribution 이 비정상 값 layer 경계는 throw 없이 흡수(미대상으로 passthrough). 명시적 null/undefined 입력 계약 위반만 한국어 `TypeError`.
- **detection 재구현 0**: `evaluation-quality-signal.ts`(T-0527) 변경 금지 — 본 helper 는 그 산출 신호만 소비(single-source).

## Acceptance Criteria

- [ ] 신규 순수 함수 `applyContributionQualityFloor(entries, signal)` 를 `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` 에 추가. 입력 entries 는 `{ author, result }[]`(본 파일 전용 타입 export — 예: `ContributionQualityAdjustEntry`), 둘째 인자는 T-0527 산출 `ContributionQualitySignal`. NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 동일 출력(결정적, LLM 무관). `evaluation-update-count-adjust.ts` 구조를 mirror.
- [ ] **floor 강등 규칙을 명확히 구현**: `signal.byAuthor` 를 author → entry 로 색인하고, 해당 author 의 `zeroContributionUnitIds` 에 `result.unitId` 가 든 단위의 `result.contribution` 을 `"zero"` 로 강등(이미 zero 면 멱등). floor 대상 등급은 named `export const`(예: `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"`) single-source + JSDoc 근거. contribution 을 절대 상향하지 않음(하한 단조).
- [ ] 신호 미대상(zero-contribution 후보 아님) 단위는 `contribution` **무변경 passthrough**(단 항상 새 객체로 복제해 입력 비변형 보장). 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열.
- [ ] **Happy-path test 1+**: `signal` 에서 zeroContribution=true 로 식별된 author/unit 의 `result.contribution`(예: LLM 이 "high" 로 매긴 단위)이 `"zero"` 로 강등됨을 단언. 미대상 단위는 contribution 그대로 전사됨을 단언.
- [ ] **Error path test 1+**: 명시적 입력 계약 위반(`entries` 가 null/undefined → 한국어 `TypeError`, `signal` 이 null/undefined → 한국어 `TypeError`) 단언. 그 외 결함(빈 entries · 빈 byAuthor · author 미매칭 · 이미 zero)은 throw 없이 흡수됨 단언.
- [ ] **Flow / branch coverage** (각 분기 1+): (a) author 가 신호에 존재 + 해당 unit 이 zeroContributionUnitIds 대상 → zero 강등 분기, (b) author 존재하나 unit 이 zeroContributionUnitIds 에 없음 → 무변경, (c) author 미매칭 → 무변경, (d) 대상 단위의 contribution 이 이미 "zero" → 멱등(변화 없음) 분기.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `entries` 배열 → 빈 배열 반환, (ii) `signal.byAuthor` 빈 배열 → 전 단위 무변경 복제, (iii) author 미매칭 단위, (iv) 동일 author 다수 단위 중 일부만 unitId 가 zero-contribution 대상(부분 적용 정합), (v) 다수 author 혼합 entries(독립 처리·순서 보존), (vi) 동일 unitId 가 다수 entries 에 등장 시 각각 일관 강등(결정적 처리). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 `toEqual` 동일 출력. **비변형 단언**: 입력 `entries` / 원소 / `result` / `signal` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] colocated spec `src/assessment-evaluation/domain/evaluation-quality-adjust.spec.ts` 에 위 test 박제(NestJS convention + discoverability).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-quality-adjust.ts` line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- orchestrator 배선 0 — `EvaluationOrchestratorService` / `EvaluationScoringService` 변경 금지. 본 신호 소비를 실 evaluation 흐름에 import 하는 것은 **후속 task**(T-0526 가 abuse·update-count 신호에 한 배선 패턴 mirror).
- detection 재구현 0 — `evaluation-quality-signal.ts`(T-0527) 변경 금지. 본 helper 는 그 산출 `ContributionQualitySignal` 신호만 **소비**한다(single-source).
- contribution **상향**(R-37 후반 "새 알고리즘 설계·외부 연구 도입 = high")의 식별/적용 0 — 본 helper 는 zero-contribution **하한** floor 강등만(상향은 LLM 정성 평가 영역 + 별도 task).
- abuse(`applyAbuseSignalToVolume`) / update-count(`applyUpdateCountNeutralizationToVolume`) 소비 helper 와의 합성/우선순위 결정 0 — 신호 간 적용 순서·충돌 해소는 orchestrator 배선 task 영역.
- `volume` 필드 변경 0 — 본 helper 는 `contribution` 만 다룬다(품질 분류축).
- `EvaluationResult` / `EvaluationInput` / `ContributionLevel` / `ContributionQualitySignal` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0 (소비 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) contribution quality floor 소비 helper 의 `EvaluationOrchestratorService` 배선(T-0526 mirror) — detection(T-0527) + consume(본 task) 후 실 evaluation 흐름 배선.
- (예정) R-37 후반 high-contribution 상향 식별(새 알고리즘/외부 연구 도입) — LLM 정성 평가 보강 영역, 별도 task.
- (예정) abuse·update-count·contribution-quality 세 신호의 적용 순서·우선순위 합성 규칙 정합 검토(orchestrator 배선 task 에서).

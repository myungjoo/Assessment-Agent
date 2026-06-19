---
id: T-0534
title: 중요·어려운 기여 신호 소비 notable 결정적 annotation 순수 helper applyNotableContributionAnnotation 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-011]
dependsOn: [T-0533]
independentStream: p5-evaluation-notable-contribution
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts
  - src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 104(R-25/REQ-011 중요·어려운 기여 식별) 소비 slice — T-0533 NotableContributionSignal 소비해 notable author 단위를 결정적 annotation 하는 순수 helper, T-0531 mirror, pr ~240 LOC 2 파일 disjoint
---

# T-0534 — 중요·어려운 기여 신호 소비 notable 결정적 annotation 순수 helper applyNotableContributionAnnotation 추가

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 104 (R-25 / REQ-011: "중요·어려운 기여 → 높은 점수 — 어렵고 남이 못할 일") 의 **소비(consumption) slice** 다. T-0533 `computeNotableContributionSignal`(detection, merge ee1ef0b, PR #447) 이 산출한 author-level `NotableContributionSignal`(`byAuthor[*].notable` / `notableDetected` / `meanCodeUnitCount`) 신호를 소비해, notable(동료 평균 × CEILING 초과)로 식별된 author 의 평가 단위 결과를 **결정적으로 annotation**(중요 기여 사실의 외화 — `narrative` 에 표준 한국어 marker 접두) 하는 순수 domain helper 를 박제한다.

이 task 는 검증된 detection → consume → orchestrator 3-slice 패턴(abuse: T-0521 → T-0522 → T-0523, update-count: T-0524 → T-0525 → T-0526, contribution-quality: T-0527 → T-0528 → T-0529, underperformer: T-0530 → T-0531 → T-0532)의 **소비 layer** 에 대응하며, 직접 mirror 원형은 저성과자 소비 helper [applyUnderPerformerAnnotation](../../src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts)(T-0531) 의 **대칭(inverse)** 이다. T-0531 이 `underPerformer === true` author 에 `[저성과자]` marker 를 접두하듯, 본 helper 는 `notable === true` author 에 `[중요기여]` marker 를 접두한다(R-25 "높은 점수" 의 결정적 외화 1 차 신호). 신호 차원도 동일 — T-0533 `NotableContributionSignal` 은 author-level 판정(`byAuthor[*].notable` boolean — 해당 author 의 전 단위가 notable 대상)이므로 author 매칭만으로 그 author 의 모든 단위를 annotation 한다. orchestrator 실배선은 후속 task(T-0532 mirror)로 분리한다.

`git grep -lE "applyNotableContribution|NotableContributionAnnotation|NotableContributionAdjust|evaluation-notable-contribution-adjust" origin/main -- 'src/**'` 0 매칭(exit 1) + T-0533 detection 신호 파일(`evaluation-notable-contribution-signal.ts`)은 origin/main 박제 확인 — issue-still-relevant pre-check 통과(consume slice 미박제).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` (소비 대상 detection 신호, T-0533 산출 — `NotableContributionSignal` / `NotableContributionEntry` / `byAuthor`(author·codeUnitCount·notable) / `notableDetected` / `meanCodeUnitCount` shape. 본 helper 가 author → entry 로 색인할 신호 구조. **author-level 판정** — unitId 목록 없음에 유의)
- `src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts` (**본 task 의 직접 mirror 원형(대칭 inverse)**, T-0531 — 소비 helper 구조: `{ author, result }[]` entries signature / author Map 색인 / named 한국어 marker `export const` single-source + 멱등 `startsWith` 검사 접두 / 입력 비변형(새 배열·새 객체만 반환) / 같은 길이·같은 순서 보존 / throw 흡수 정책(미대상·멱등 passthrough) / 명시적 null·undefined 계약 위반만 한국어 TypeError / 결정성. 본 task 는 "저성과(underPerformer)" 대신 "중요기여(notable)" 방향으로 동형 구조를 재사용)
- `src/assessment-evaluation/domain/evaluation-underperformer-adjust.spec.ts` (mirror spec 구조 — happy/error/branch/negative 분기 박제 패턴 참조)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult` — `narrative`(string, 본 helper 가 marker 접두할 필드) / `unitId` / `contribution` / `volume` 필드. author 미보유 확인 → caller 가 author 매핑 동반 전달 근거)
- 신규 spec colocated 위치 (의무): `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts`

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` 에 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 → 항상 동일 출력(결정적, LLM 무관). `evaluation-underperformer-adjust.ts`(T-0531) 구조를 대칭으로 mirror.
- 입력 contract(권장 shape — 자유 재량): 첫 인자 entries 는 `{ author: string; result: EvaluationResult }[]`(T-0531 `UnderPerformerAdjustEntry` 동형, 본 파일 전용 타입 export — 예: `NotableContributionAdjustEntry`). 둘째 인자는 T-0533 산출 `NotableContributionSignal`.
- **annotation 규칙(R-25/REQ-011)을 명확히 구현**: `signal.byAuthor` 를 author → `NotableContributionEntry` 로 색인하고, 해당 author 의 `notable === true` 인 경우 그 author 의 **모든** 평가 단위 `result.narrative` 앞에 표준 한국어 marker 를 접두한다(예: `export const NOTABLE_CONTRIBUTION_NARRATIVE_MARKER = "[중요기여]"`). marker 가 이미 접두돼 있으면 멱등(중복 접두 금지 — `narrative.startsWith(marker)` 검사). author 가 신호에 없거나 `notable === false` 면 narrative 무변경 passthrough(단 항상 새 객체로 복제).
- **annotation 은 비파괴·멱등·단조**: 기존 narrative 본문을 손상하지 않고 marker 만 접두한다. 동일 입력 반복 적용이 marker 를 한 번만 남긴다(멱등). 중요기여 표시를 해제하는 역방향 0(소비는 상향 marker 만).
- 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열(caller 매핑 재사용 보장).
- marker 상수는 named `export const` single-source + JSDoc 으로 근거 명문화(R-25 / REQ-011 중요·어려운 기여 외화). marker 문자열은 §12 한국어.
- author 미매칭 / 빈 entries / 빈 byAuthor / 이미 marker 접두 layer 경계는 throw 없이 흡수(미대상·멱등 passthrough). 명시적 null/undefined 입력 계약 위반만 한국어 `TypeError`.
- **detection 재구현 0**: `evaluation-notable-contribution-signal.ts`(T-0533) 변경 금지 — 본 helper 는 그 산출 신호만 소비(single-source).

## Acceptance Criteria

- [ ] 신규 순수 함수 `applyNotableContributionAnnotation(entries, signal)` 를 `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` 에 추가. 입력 entries 는 `{ author, result }[]`(본 파일 전용 타입 export — 예: `NotableContributionAdjustEntry`), 둘째 인자는 T-0533 산출 `NotableContributionSignal`. NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 동일 출력(결정적, LLM 무관). `evaluation-underperformer-adjust.ts` 구조를 mirror.
- [ ] **annotation 규칙을 명확히 구현**: `signal.byAuthor` 를 author → `NotableContributionEntry` 로 색인하고, 해당 author 의 `notable === true` 인 단위의 `result.narrative` 앞에 named 한국어 marker(예: `export const NOTABLE_CONTRIBUTION_NARRATIVE_MARKER = "[중요기여]"`) single-source + JSDoc 근거를 접두. 이미 marker 접두면 멱등(중복 0). notable=false / author 미매칭 단위는 narrative **무변경 passthrough**(단 항상 새 객체 복제). 중요기여 marker 를 해제하는 역방향 0.
- [ ] 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열.
- [ ] **Happy-path test 1+**: `signal` 에서 notable=true 로 식별된 author 의 모든 단위 `result.narrative` 가 marker 접두됨을 단언. notable=false author / 미매칭 author 단위는 narrative 그대로 전사됨을 단언.
- [ ] **Error path test 1+**: 명시적 입력 계약 위반(`entries` 가 null/undefined → 한국어 `TypeError`, `signal` 이 null/undefined → 한국어 `TypeError`) 단언. 그 외 결함(빈 entries · 빈 byAuthor · author 미매칭 · 이미 marker 접두)은 throw 없이 흡수됨 단언.
- [ ] **Flow / branch coverage** (각 분기 1+): (a) author 가 신호에 존재 + notable=true → marker 접두 분기, (b) author 존재하나 notable=false → 무변경, (c) author 미매칭 → 무변경, (d) notable 대상 단위의 narrative 가 이미 marker 접두 → 멱등(중복 접두 없음) 분기.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `entries` 배열 → 빈 배열 반환, (ii) `signal.byAuthor` 빈 배열 → 전 단위 무변경 복제, (iii) author 미매칭 단위, (iv) notable=true author 의 다수 단위 전부 일관 marker 접두(author-level 전파 정합), (v) 다수 author 혼합 entries(notable/정상 혼재 — 독립 처리·순서 보존), (vi) 빈 narrative("") 단위가 notable 대상일 때도 marker 만 접두(본문 손상 없음). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 `toEqual` 동일 출력(멱등 — 2회 적용도 marker 1 회만). **비변형 단언**: 입력 `entries` / 원소 / `result` / `signal` 가 호출 후 변경되지 않음(deep-equal 또는 `Object.freeze` 입력 통과).
- [ ] colocated spec `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts` 에 위 test 박제(NestJS convention + discoverability).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-notable-contribution-adjust.ts` line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- orchestrator 배선 0 — `EvaluationOrchestratorService` / `EvaluationScoringService` 변경 금지. 본 신호 소비를 실 evaluation 흐름에 import 하는 것은 **후속 task**(T-0532 가 underperformer 신호에 한 배선 패턴 mirror).
- detection 재구현 0 — `evaluation-notable-contribution-signal.ts`(T-0533) 변경 금지. 본 helper 는 그 산출 `NotableContributionSignal` 신호만 **소비**한다(single-source).
- `volume` / `contribution` / `difficulty` 필드 변경 0 — 본 helper 는 중요기여 외화 marker 를 `narrative` 에만 접두한다. 중요기여 사실이 점수에 반영되는 가중치/가점 적용은 별도 task(orchestrator 또는 scoring 영역).
- abuse / update-count / contribution-quality / underperformer 소비 helper 와의 합성/우선순위 결정 0 — 신호 간 적용 순서·충돌 해소는 orchestrator 배선 task 영역.
- author-level 판정을 unit-level 로 세분화(특정 단위만 annotation)하는 것 0 — T-0533 신호가 author-level 이므로 본 task 도 author 단위로 전파한다. unit 차원 enrich 는 detection layer Follow-up.
- `EvaluationResult` / `EvaluationInput` / `NotableContributionSignal` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0 (소비 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) notable annotation 소비 helper 의 `EvaluationOrchestratorService` 배선(T-0532 mirror) — detection(T-0533) + consume(본 task) 후 실 evaluation 흐름 배선. detection → consume → orchestrator 3-slice 완결.
- (예정) 중요기여 사실의 scoring 반영(가중치/가점) — 본 task 는 narrative 외화 marker 만, 점수 영향은 별도 task 검토(R-25 "높은 점수").
- (예정) notable detection 의 metadata enrich(난이도 메타·변경 라인 수 등 가중 신호) 후 unit-level 세분화 — "남이 못할 일" 의미 강화(detection layer Follow-up, T-0533 산출 §보수성 원칙 참조).
- (예정) abuse·update-count·contribution-quality·underperformer·notable 다섯 신호의 적용 순서·우선순위 합성 규칙 정합 검토(orchestrator 배선 task 에서).

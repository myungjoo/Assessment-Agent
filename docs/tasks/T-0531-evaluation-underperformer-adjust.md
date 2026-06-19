---
id: T-0531
title: 저성과자 신호 소비 underPerformer 결정적 annotation 순수 helper applyUnderPerformerAnnotation 추가
phase: P5
commitMode: pr
status: DONE
completedAt: 2026-06-20
mergedAs: 40c73f8
prNumber: 445
reviewRounds: 1
coversReq: [REQ-013]
dependsOn: [T-0530]
independentStream: p5-evaluation-underperformer
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts
  - src/assessment-evaluation/domain/evaluation-underperformer-adjust.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 105(R-27/REQ-013 저성과자 식별) 소비 slice — T-0530 UnderPerformerSignal 소비해 저성과 author 단위를 결정적 annotation 하는 순수 helper, T-0528/T-0525 mirror, pr ~240 LOC 2 파일 disjoint
---

# T-0531 — 저성과자 신호 소비 underPerformer 결정적 annotation 순수 helper applyUnderPerformerAnnotation 추가

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 105 (R-27 / REQ-013: "저성과자 식별 — 코드 기여가 현격히 떨어지는 인원 식별") 의 **소비(consumption) slice** 다. T-0530 `computeUnderPerformerSignal`(detection, merge cbd5232 후속 PR #444) 이 산출한 author-level `UnderPerformerSignal`(`byAuthor[*].underPerformer` / `underPerformerDetected` / `meanCodeUnitCount`) 신호를 소비해, 저성과자로 식별된 author 의 평가 단위 결과를 **결정적으로 annotation**(저성과 사실의 외화 — `narrative` 에 표준 한국어 marker 접두 + 명시 boolean 필드성 신호 보존) 하는 순수 domain helper 를 박제한다.

이 task 는 검증된 detection → consume → orchestrator 3-slice 패턴(abuse: T-0521 → T-0522 → T-0523, update-count: T-0524 → T-0525 → T-0526, contribution-quality: T-0527 → T-0528 → T-0529)의 **소비 layer** 에 대응하며, 형제 소비 helper [applyContributionQualityFloor](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts)(T-0528) / [applyUpdateCountNeutralizationToVolume](../../src/assessment-evaluation/domain/evaluation-update-count-adjust.ts)(T-0525) 의 구조를 충실히 mirror 한다. 단 **신호 차원이 다르다**: abuse/update-count/quality 는 unitId 목록까지 내려가지만, T-0530 `UnderPerformerSignal` 은 **author-level 판정**(`byAuthor[*].underPerformer` boolean — 해당 author 의 전 단위가 저성과 대상) 이다. 따라서 본 helper 는 author 매칭만으로 그 author 의 모든 단위를 annotation 한다. orchestrator 실배선은 후속 task(T-0529/T-0526 mirror)로 분리한다.

`git grep -lE "evaluation-underperformer-adjust|applyUnderPerformer|UnderPerformerAdjust|UnderPerformerAnnotation" origin/main -- 'src/**'` 0 매칭 + T-0530 detection 신호 파일은 origin/main 박제 확인 — issue-still-relevant pre-check 통과(consume slice 미박제).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` (소비 대상 detection 신호, T-0530 산출 — `UnderPerformerSignal` / `UnderPerformerEntry` / `byAuthor`(author·codeUnitCount·underPerformer) / `underPerformerDetected` / `meanCodeUnitCount` shape. 본 helper 가 author → entry 로 색인할 신호 구조. **author-level 판정** — unitId 목록 없음에 유의)
- `src/assessment-evaluation/domain/evaluation-update-count-adjust.ts` (mirror 원형 — 소비 helper 구조: `{ author, result }[]` entries signature / author Map 색인 / 입력 비변형(새 배열·새 객체만 반환) / 같은 길이·같은 순서 보존 / throw 0 흡수 정책 / 명시적 null·undefined 계약 위반만 한국어 TypeError / 결정성)
- `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` (형제 소비 helper T-0528 — `ContributionQualityAdjustEntry` shape / floor 강등 단조성 / 멱등 분기 패턴. 본 task 의 annotation 멱등성 참조)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult` — `narrative`(string, 본 helper 가 marker 접두할 필드, L58~60) / `unitId` / `contribution` / `volume` 필드. author 미보유 확인 → caller 가 author 매핑 동반 전달 근거)
- 신규 spec colocated 위치 (의무): `src/assessment-evaluation/domain/evaluation-underperformer-adjust.spec.ts`

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts` 에 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 → 항상 동일 출력(결정적, LLM 무관). `evaluation-update-count-adjust.ts` / `evaluation-quality-adjust.ts` 구조를 mirror.
- 입력 contract(권장 shape — 자유 재량): 첫 인자 entries 는 `{ author: string; result: EvaluationResult }[]`(T-0525 `UpdateCountAdjustEntry` / T-0528 동형, 본 파일 전용 타입 export — 예: `UnderPerformerAdjustEntry`). 둘째 인자는 T-0530 산출 `UnderPerformerSignal`.
- **annotation 규칙(R-27/REQ-013)을 명확히 구현**: `signal.byAuthor` 를 author → `UnderPerformerEntry` 로 색인하고, 해당 author 의 `underPerformer === true` 인 경우 그 author 의 **모든** 평가 단위 `result.narrative` 앞에 표준 한국어 marker 를 접두한다(예: `export const UNDERPERFORMER_NARRATIVE_MARKER = "[저성과자]"`). marker 가 이미 접두돼 있으면 멱등(중복 접두 금지 — `narrative.startsWith(marker)` 검사). author 가 신호에 없거나 `underPerformer === false` 면 narrative 무변경 passthrough(단 항상 새 객체로 복제).
- **annotation 은 비파괴·멱등·단조**: 기존 narrative 본문을 손상하지 않고 marker 만 접두한다. 동일 입력 반복 적용이 marker 를 한 번만 남긴다(멱등). 저성과 표시를 해제하는 역방향 0(소비는 하한 marker 만).
- 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열(caller 매핑 재사용 보장).
- marker 상수는 named `export const` single-source + JSDoc 으로 근거 명문화(R-27 / REQ-013 저성과자 외화). marker 문자열은 §12 한국어.
- author 미매칭 / 빈 entries / 빈 byAuthor / 이미 marker 접두 layer 경계는 throw 없이 흡수(미대상·멱등 passthrough). 명시적 null/undefined 입력 계약 위반만 한국어 `TypeError`.
- **detection 재구현 0**: `evaluation-underperformer-signal.ts`(T-0530) 변경 금지 — 본 helper 는 그 산출 신호만 소비(single-source).

## Acceptance Criteria

- [ ] 신규 순수 함수 `applyUnderPerformerAnnotation(entries, signal)` 를 `src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts` 에 추가. 입력 entries 는 `{ author, result }[]`(본 파일 전용 타입 export — 예: `UnderPerformerAdjustEntry`), 둘째 인자는 T-0530 산출 `UnderPerformerSignal`. NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형 — 새 배열·새 객체만 반환), 동일 입력 동일 출력(결정적, LLM 무관). `evaluation-update-count-adjust.ts` / `evaluation-quality-adjust.ts` 구조를 mirror.
- [ ] **annotation 규칙을 명확히 구현**: `signal.byAuthor` 를 author → `UnderPerformerEntry` 로 색인하고, 해당 author 의 `underPerformer === true` 인 단위의 `result.narrative` 앞에 named 한국어 marker(예: `export const UNDERPERFORMER_NARRATIVE_MARKER = "[저성과자]"`) single-source + JSDoc 근거를 접두. 이미 marker 접두면 멱등(중복 0). underPerformer=false / author 미매칭 단위는 narrative **무변경 passthrough**(단 항상 새 객체 복제). 저성과 marker 를 해제하는 역방향 0.
- [ ] 반환은 입력과 **같은 길이·같은 순서**의 새 entries 배열.
- [ ] **Happy-path test 1+**: `signal` 에서 underPerformer=true 로 식별된 author 의 모든 단위 `result.narrative` 가 marker 접두됨을 단언. underPerformer=false author / 미매칭 author 단위는 narrative 그대로 전사됨을 단언.
- [ ] **Error path test 1+**: 명시적 입력 계약 위반(`entries` 가 null/undefined → 한국어 `TypeError`, `signal` 이 null/undefined → 한국어 `TypeError`) 단언. 그 외 결함(빈 entries · 빈 byAuthor · author 미매칭 · 이미 marker 접두)은 throw 없이 흡수됨 단언.
- [ ] **Flow / branch coverage** (각 분기 1+): (a) author 가 신호에 존재 + underPerformer=true → marker 접두 분기, (b) author 존재하나 underPerformer=false → 무변경, (c) author 미매칭 → 무변경, (d) underPerformer 대상 단위의 narrative 가 이미 marker 접두 → 멱등(중복 접두 없음) 분기.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `entries` 배열 → 빈 배열 반환, (ii) `signal.byAuthor` 빈 배열 → 전 단위 무변경 복제, (iii) author 미매칭 단위, (iv) underPerformer=true author 의 다수 단위 전부 일관 marker 접두(author-level 전파 정합), (v) 다수 author 혼합 entries(underPerformer/정상 혼재 — 독립 처리·순서 보존), (vi) 빈 narrative("") 단위가 underPerformer 대상일 때도 marker 만 접두(본문 손상 없음). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 `toEqual` 동일 출력(멱등 — 2회 적용도 marker 1 회만). **비변형 단언**: 입력 `entries` / 원소 / `result` / `signal` 가 호출 후 변경되지 않음(deep-equal 또는 `Object.freeze` 입력 통과).
- [ ] colocated spec `src/assessment-evaluation/domain/evaluation-underperformer-adjust.spec.ts` 에 위 test 박제(NestJS convention + discoverability).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-underperformer-adjust.ts` line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- orchestrator 배선 0 — `EvaluationOrchestratorService` / `EvaluationScoringService` 변경 금지. 본 신호 소비를 실 evaluation 흐름에 import 하는 것은 **후속 task**(T-0529 / T-0526 가 contribution-quality·abuse·update-count 신호에 한 배선 패턴 mirror).
- detection 재구현 0 — `evaluation-underperformer-signal.ts`(T-0530) 변경 금지. 본 helper 는 그 산출 `UnderPerformerSignal` 신호만 **소비**한다(single-source).
- `volume` / `contribution` / `difficulty` 필드 변경 0 — 본 helper 는 저성과자 외화 marker 를 `narrative` 에만 접두한다. 저성과 사실이 점수에 반영되는 가중치/감점 적용은 별도 task(orchestrator 또는 scoring 영역).
- abuse / update-count / contribution-quality 소비 helper 와의 합성/우선순위 결정 0 — 신호 간 적용 순서·충돌 해소는 orchestrator 배선 task 영역.
- author-level 판정을 unit-level 로 세분화(특정 단위만 annotation)하는 것 0 — T-0530 신호가 author-level 이므로 본 task 도 author 단위로 전파한다. unit 차원 enrich 는 detection layer Follow-up.
- `EvaluationResult` / `EvaluationInput` / `UnderPerformerSignal` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0 (소비 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) under-performer annotation 소비 helper 의 `EvaluationOrchestratorService` 배선(T-0529 / T-0526 mirror) — detection(T-0530) + consume(본 task) 후 실 evaluation 흐름 배선. detection → consume → orchestrator 3-slice 완결.
- (예정) 저성과 사실의 scoring 반영(가중치/감점) — 본 task 는 narrative 외화 marker 만, 점수 영향은 별도 task 검토.
- (예정) under-performer detection 의 metadata enrich(변경 라인 수 등 가중 신호) 후 unit-level 세분화 — detection layer Follow-up(T-0530 산출 §보수성 원칙 참조).
- (예정) abuse·update-count·contribution-quality·under-performer 네 신호의 적용 순서·우선순위 합성 규칙 정합 검토(orchestrator 배선 task 에서).

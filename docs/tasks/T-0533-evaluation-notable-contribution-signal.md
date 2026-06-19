---
id: T-0533
title: 중요·어려운 기여 식별 detection 순수 helper computeNotableContributionSignal 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-011]
dependsOn: []
independentStream: p5-evaluation-notable-contribution
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts
  - src/assessment-evaluation/domain/evaluation-notable-contribution-signal.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
completedAt: 2026-06-19T20:21:30Z
prNumber: 447
mergedAs: ee1ef0b5d62134eaafa4c03404ddec1cef03dfb2
reviewRounds: 1
plannerNote: P5 bullet 104(R-25/REQ-011 중요·어려운 기여 식별) 새 vein 의 detection slice — computeNotableContributionSignal 순수 helper, underperformer/abuse signal mirror, pr ~240 LOC 2 파일 disjoint
---

# T-0533 — 중요·어려운 기여 식별 detection 순수 helper computeNotableContributionSignal 추가

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 104 (R-25 / REQ-011: "중요·어려운 기여 → 높은 점수 — 어렵고 남이 못할 일") 을 시작하는 새 evaluation vein 의 **detection slice** 다. 기존 evaluation 신호 vein 은 abuse(T-0521→T-0522→T-0523), update-count(T-0524→T-0525→T-0526), contribution-quality(T-0527→T-0528→T-0529), underperformer(T-0530→T-0531→T-0532) 4 종으로 모두 detection→consume→orchestrator 3-slice 패턴이 완결됐으나, R-25 "어렵고 남이 못할 일" (중요·난이도 높은 기여 식별) 은 전용 detection 신호가 아직 없다 — `git grep -lE "computeNotableContribution|NotableContribution" origin/main -- src/` 0 매칭(issue-still-relevant pre-check 통과, main 미박제). 본 task 는 저성과자 식별(T-0530, underperformer)의 **대칭(inverse) mirror** 로, 한 batch 동료 평균 대비 코드 기여 단위 수가 **현격히 높은** author 를 LLM 무관 결정적으로 식별하는 순수 domain helper `computeNotableContributionSignal` 를 신설한다. ADR-0032 §3 정신("metric 수치 신호는 LLM 정성과 분리해 결정적으로") 정합. 본 detection slice 가 박제되면 후속 consume(narrative annotation) + orchestrator 배선 2 slice 가 동형 패턴으로 이어진다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-underperformer-signal.ts](../../src/assessment-evaluation/domain/evaluation-underperformer-signal.ts) — **본 task 의 직접 mirror 원형(대칭 inverse)**. author 그룹핑(최초 등장 순서 보존) + `contributionKind === "code"` 단위 수 집계 + batch 평균(mean) 산출 + `meanCodeUnitCount × FLOOR` 임계 비교 + 단독/평균0 경계 보수적 분류 + 빈 배열 throw 0 + null/undefined 한국어 TypeError + 입력 비변형(순수). 본 task 는 "미만(underPerformer)" 대신 "초과(notable)" 방향으로 동형 구조를 재사용한다.
- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) — author 별 정량 집계 + 임계 비교 + batch 차원 boolean 패턴(`AbuseSignal` 의 `byAuthor` + 집계 차원 `suspected` 형태). 본 task 의 산출 타입 shape 참고.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput` shape(`author` / `contributionKind` = "code"|"document" / `metadata` scalar). R-25 의 "코드 기여" 정량은 `contributionKind === "code"` 단위 수로 센다(document 제외 — underperformer signal 동형). raw 본문 없음(REQ-032).
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §1/§3 — `EvaluationInput` 정규화 축 + "metric 수치 신호는 LLM 정성 평가와 분리해 결정적으로" 정신(본 helper 의 LLM 무관 결정성 근거).

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` 에 의존성 0 의 순수 함수 `computeNotableContributionSignal(inputs: EvaluationInput[]): NotableContributionSignal` 1 개만 둔다. NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0(입력 비변형), throw 는 명시적 null/undefined 계약 위반 1 경로만.
- 판정 알고리즘(결정적·LLM 무관, v1 — underperformer signal 의 대칭):
  1. 입력을 author 별로 그룹핑하되(최초 등장 순서 보존) 각 author 의 `contributionKind === "code"` 단위 수(`codeUnitCount`)를 센다(document / 예상 외 kind 제외 — throw 0).
  2. 전 author codeUnitCount 의 **평균(mean)** 을 결정적으로 산출한다(`meanCodeUnitCount`). author 0 명이면 0(분모 보호). mean 채택 근거는 underperformer signal 과 동일(1 줄 결정적 산출, spec 명료).
  3. 비교가 의미 있는 batch(author ≥ 2 명 AND 평균 > 0)에서만 `codeUnitCount` 가 `meanCodeUnitCount × NOTABLE_RELATIVE_CEILING` **초과(strictly greater)** 인 author 를 `notable` 로 식별한다. 단독 author(비교 대상 없음) / 평균 0(전원 동일) batch 는 보수적으로 `notable` 0(false-positive 회피 — underperformer 보수성 정신 mirror).
  4. author 별 `notable`(boolean) / `codeUnitCount` 를 축약하고 batch 차원 `notableDetected`(1 명 이상) / `totalAuthorCount` / `meanCodeUnitCount` 를 산출한다.
- 임계 상수 `NOTABLE_RELATIVE_CEILING` (v1 권장 baseline = 1.5 — 동료 평균의 1.5 배 초과를 "현격히 높은" 의 보수적 경계로). 근거는 주석으로 박제(평균 근처 정상 변동을 notable 로 오분류하지 않는 보수성, dogfood 실측 후 calibration 가능, 0 이상 비율 deterministic 상수). 정확한 값/방향(strict `>` vs `>=`)은 구현자 재량이되 v1 결정을 spec 으로 명시 박제.
- 산출 타입 박제(underperformer signal 의 shape mirror):
  - `NotableContributionEntry { author: string; codeUnitCount: number; notable: boolean }`
  - `NotableContributionSignal { totalAuthorCount: number; meanCodeUnitCount: number; byAuthor: NotableContributionEntry[]; notableDetected: boolean }`
- 보수성 원칙(휴리스틱 과확장 금지): v1 은 동료 평균 대비 상대 비교 1 신호로 한정. metadata enrich(난이도 메타·변경 라인 수 등) 후 가중 신호는 Follow-up(R-25 의 "남이 못할 일" 의미 강화는 후속).
- 방어(underperformer signal 동형): 빈 배열 → `totalAuthorCount` 0, `byAuthor` [], `notableDetected` false, `meanCodeUnitCount` 0(throw 0). `inputs` 자체가 null/undefined → 명시적 한국어 `TypeError`(유일 throw 경로). 입력 배열·원소 비변형(새 객체만 반환).
- 책임 경계(본 task = detection layer 만): 본 helper 는 **신호만** 산출한다. notable author 의 평가 결과/narrative 반영(소비) / orchestrator 배선은 후속 task 가 본 신호를 소비해 처리한다(T-0531/T-0532 consume → orchestrator mirror). `EvaluationInput` / `EvaluationResult` / `ContributionKind` 타입 변경 0.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` 신설 — `computeNotableContributionSignal(inputs)` 순수 함수 + `NotableContributionEntry` / `NotableContributionSignal` 타입 + `NOTABLE_RELATIVE_CEILING` 임계 상수 export. NestJS/Prisma/LLM import 0, 부수효과 0(입력 비변형), 결정적(동일 입력 동일 출력).
- [ ] **Happy-path test 1+**: 한 batch 에서 동료 평균 × CEILING 을 초과하는 코드 기여 author 가 `notable=true` 로, 평균 이하 author 가 `notable=false` 로 식별되고 batch 차원 `notableDetected=true` 임을 단언(혼합 batch). `meanCodeUnitCount` / `totalAuthorCount` 값도 단언.
- [ ] **Error path test 1+**: `inputs` 가 null / undefined 일 때 한국어 메시지 `TypeError` throw 단언(유일 throw 경로) + 빈 배열 입력 시 `{ totalAuthorCount: 0, meanCodeUnitCount: 0, byAuthor: [], notableDetected: false }` 반환 단언(throw 0).
- [ ] **Flow / branch coverage** (각 분기 1+ test): (a) notable author 존재 batch, (b) 전 author 평균 이하(notable 미식별) batch(`notableDetected=false`), (c) 단독 author batch(비교 대상 없음 → 보수적 notable 0), (d) 평균 0 batch(전원 code 기여 0 → notable 0), (e) `contributionKind === "document"` 단위가 codeUnitCount 에 포함되지 않음(document 제외 분기).
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) null inputs / (ii) undefined inputs(각 한국어 TypeError) / (iii) 빈 배열 / (iv) 전원 동률(평균과 동일 → strict 비교로 notable 0, 경계 false-positive 회피) / (v) 임계 정확히 경계값(`mean × CEILING` 와 정확히 같은 codeUnitCount → strict `>` 면 notable 아님 — 경계 동작 명시 단언) / (vi) `contributionKind` 가 예상 외 값(throw 0, code 아니면 제외) / (vii) author 등장 순서 보존(`byAuthor` 가 최초 등장 순서대로) 단언. 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic 확인).
- [ ] **비변형 단언**: 입력 배열·원소가 호출 후 변경되지 않음(deep-equal 보존 또는 `Object.freeze` 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% AND function ≥ 80%(신규 순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- notable 신호의 **소비**(notable author narrative 강조 marker / 점수 가중) 0 — 본 task 는 detection layer 만. consume slice 는 후속 task(T-0531 `applyUnderPerformerAnnotation` mirror).
- `EvaluationOrchestratorService.evaluateActivities` 배선 0 — orchestrator slice 는 detection + consume 박제 후 별도 task(T-0532 mirror).
- abuse / update-count / contribution-quality / underperformer 신호의 알고리즘 / 타입 변경 0 — 본 task 는 새 파일만 추가(ADD-only), 기존 vein 무변경.
- `EvaluationInput` / `EvaluationResult` / `ContributionKind` / `ActivityMetadata` 타입 자체 변경 0.
- metadata enrich(난이도 메타·변경 라인 수 등 가중 신호) 후 unit-level 세분화 0 — v1 은 author-level code 단위 수 상대 비교 1 신호로 한정(Follow-up).
- `NOTABLE_RELATIVE_CEILING` calibration(실 data 관측 후 임계 튜닝) 0 — v1 baseline 박제만.
- LLM gateway 호출 변경 0(detection 은 deterministic, LLM 무관). controller / DTO / endpoint / persistence / Prisma migration 변경 0. 새 외부 dep / 새 ADR / 새 module provider 변경 0(ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) notable 신호 소비 slice — notable author 단위의 `EvaluationResult.narrative` 에 결정적 강조 marker 접두 또는 점수 가중(R-25 "높은 점수") 순수 helper(T-0531 `applyUnderPerformerAnnotation` mirror).
- (예정) notable 신호 orchestrator 배선 — `evaluateActivities` 에 5 번째 detection + adjust 로 compose(T-0532 mirror, 필드 직교 확인).
- (예정) notable detection 의 metadata enrich(난이도 메타·변경 라인 수 등 가중 신호) 후 unit-level 세분화 — "남이 못할 일" 의미 강화(detection layer Follow-up).
- (예정) `NOTABLE_RELATIVE_CEILING`(현 v1=1.5) tuning — 임계 calibration 은 실 data 관측 후 별도 task.
- (예정) R-25 의 "어렵고 남이 못할 일" 정성 축(LLM 정성 평가) 과 본 결정적 metric 신호의 결합 정책 — 정성·정량 신호 net 결과 규칙 명문화(별도 task).

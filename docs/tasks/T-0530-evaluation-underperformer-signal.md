---
id: T-0530
title: 저성과자 식별 detection 순수 도메인 helper 신설 (computeUnderPerformerSignal)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013]
dependsOn: []
independentStream: p5-evaluation-underperformer
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-underperformer-signal.ts
  - src/assessment-evaluation/domain/evaluation-underperformer-signal.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 105(R-27 저성과자 식별) 3-slice 패턴 detection slice — abuse/quality signal mirror 순수 helper, pr ~240 LOC 2 파일 disjoint
---

# T-0530 — 저성과자 식별 detection 순수 도메인 helper 신설 (computeUnderPerformerSignal)

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 105 (R-27 / REQ-013: "저성과자 식별 — 코드 기여 현격히 떨어지는 인원 식별") 의 첫 조각(detection layer)이다. 직전에 완결된 bullet 103 (R-37/R-38 기여 품질 분류) 이 detection → consume → orchestrator 3-slice 패턴(T-0527 → T-0528 → T-0529)으로 박제됐고, 그 직전 update-count 중립화(T-0524 → T-0525 → T-0526) · abuse 방지(T-0521 → T-0522 → T-0523) 도 동일 패턴이었다. 본 task 는 그 검증된 패턴의 새 detection slice — 한 batch 의 `EvaluationInput[]` 에서 **코드 기여 단위 수가 batch 동료 대비 현격히 낮은 author** 를 LLM 무관하게 결정적으로 식별하는 순수 domain helper 를 신설한다.

`git grep -E "computeUnderPerformerSignal|UnderPerformerSignal|underPerform" src/` 0 매칭(main 미박제, issue-still-relevant pre-check 통과). 새 알고리즘이지만 abuse-signal(T-0521 `computeAbuseSignal`) · contribution-quality signal(T-0527 `computeContributionQualitySignal`) 의 author-그룹핑 + 결정적 임계 + 입력 비변형 + detection-only 책임 경계 구조를 그대로 mirror 한다. ADR-0032 §3 정신(metric 수치 신호는 LLM 정성과 분리해 결정적으로) 정합 — 새 dep / 새 ADR / schema 변경 0. 본 helper 가 산출하는 신호의 소비(저성과 author 의 평가 결과/summary 표식) 와 orchestrator 배선은 후속 task(consume → orchestrator)로 분리한다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) — **mirror 원형 1**. author-그룹핑(Map + 최초 등장 순서 보존) + 임계 상수 + 빈 배열/비유한 number 방어 + null/undefined 입력 계약 위반 TypeError + detection-only 책임 경계 + 입력 비변형 + signal 산출 타입(byAuthor 배열 + batch 차원 boolean) 구조를 그대로 따른다.
- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) — **mirror 원형 2**. abuse(R-26/R-40) detection 의 author 별 정량 집계 + 임계 비교 + suspected boolean 패턴. 본 task 의 "코드 기여 현격히 낮음" 판정 구조의 참고.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput` shape(`author` / `contributionKind` = `"code" | "document"` / `unitId` / `metadata`). 본 detection 은 `contributionKind === "code"` 단위만 코드 기여 정량 base 로 센다. raw 본문 부재(REQ-032) 정합 — typed surface 만 참조.
- [src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts) — **colocated spec 패턴 원형**. 본 task 의 신규 spec 은 `src/assessment-evaluation/domain/evaluation-underperformer-signal.spec.ts` (colocated) 에 동형 구조로 작성한다(happy/error/branch/negative + 결정성 + 비변형 단언).
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §3 — "metric 수치 신호는 LLM 정성과 분리해 결정적으로" 박제 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신설 파일 `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` 에 **순수 함수 + 산출 타입 + 임계 상수** 만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0, 입력 비변형, 동일 입력 동일 출력(referential transparency). quality-signal.ts 의 의존성-0 순수 도메인 helper 구조를 그대로 mirror.
- **판정 알고리즘(권장 v1, 결정적·LLM 무관)** — "코드 기여 현격히 떨어지는 인원":
  1. 입력을 author 별로 그룹핑하되(최초 등장 순서 보존), 각 author 의 **`contributionKind === "code"` 단위 수**(codeUnitCount)를 센다. document 단위는 code 기여 정량에서 제외(R-27 은 "코드 기여" 명시).
  2. batch 차원 기준값을 결정적으로 산출한다 — 권장 v1: 전 author 의 codeUnitCount 의 **평균(mean)** 을 base 로, base × `UNDERPERFORMER_RELATIVE_FLOOR`(권장 v1 = 0.5, 동료 평균의 절반 미만) 미만인 author 를 underPerformer 후보로 식별. (mean 대신 median 채택 가능 — 구현자 재량, 단 결정적이고 spec 명료한 1 방식 고정. 선택 근거를 파일 머리 주석에 박제.)
  3. **단독 author batch / 동률 batch 등 base 가 무의미한 경계** 는 보수적으로 underPerformer 0 으로 분류(false-positive 회피 — 비교 대상 없음). 평균이 0(전원 code 기여 0)인 batch 도 underPerformer 0(전원 동일하므로 "현격히 떨어지는" 대상 없음).
  4. author 별 `underPerformer`(boolean) / `codeUnitCount` 를 축약하고, batch 차원 `underPerformerDetected`(1 명 이상) / `totalAuthorCount` / 기준값(예: `meanCodeUnitCount`) 을 산출.
- **보수성 원칙(휴리스틱 과확장 금지)**: v1 은 동료 평균 대비 상대 비교 1 신호로 한정한다. metadata enrich(변경 라인 수 등) 후 가중치 신호는 Follow-up. 정상 기여자를 저성과로 오분류하는 false-positive 위험을 최소화하는 보수적 임계를 택한다(quality-signal 의 보수성 정신 mirror).
- **방어(quality-signal 와 동형)**:
  - 빈 배열 → totalAuthorCount 0, byAuthor [], underPerformerDetected false(throw 0).
  - `inputs` 자체가 null/undefined → 명시적 한국어 `TypeError`(유일 throw 경로, 조용한 오작동 차단).
  - codeUnitCount 산출은 정수 카운트라 비유한 number 위험 없음 — 단 `contributionKind` 가 예상 외 값이어도 code 가 아니면 단순 제외(throw 0).
- **산출 타입**(권장 — quality-signal mirror): `UnderPerformerSignal { totalAuthorCount, meanCodeUnitCount, byAuthor: UnderPerformerEntry[], underPerformerDetected }` + `UnderPerformerEntry { author, codeUnitCount, underPerformer }`. 타입명/필드명은 구현자 재량(grep 가능한 명료한 영어 식별자).
- **책임 경계(본 task = detection layer 만, Out of Scope)**: 본 helper 는 신호만 산출한다. 저성과 author 의 평가 결과/summary 반영(소비) 과 orchestrator 배선은 후속 task(consume → orchestrator 3-slice 잔여)가 처리한다 — T-0528/T-0529 mirror.
- 파일 머리 주석에 알고리즘·v1 임계 근거·보수성·책임 경계·mirror 원형(quality-signal/abuse-signal)을 quality-signal.ts 수준으로 박제.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` 에 `computeUnderPerformerSignal(inputs: EvaluationInput[]): UnderPerformerSignal`(또는 동등 시그니처) 순수 함수 + 산출 타입 + 임계 상수(`UNDERPERFORMER_RELATIVE_FLOOR` 등)를 export. NestJS/Prisma/LLM import 0, 입력 비변형, 결정적.
- [ ] **Happy-path test 1+**: 동료 평균 대비 코드 기여가 현격히 낮은 author 1 명이 포함된 batch 에서 그 author 의 `underPerformer=true`, 정상 기여 author 들의 `underPerformer=false`, batch `underPerformerDetected=true` 가 결정적으로 산출됨을 단언(입력 codeUnitCount 분포를 통제해 입출력 비교).
- [ ] **Error path test 1+**: `inputs` 가 null/undefined 일 때 한국어 `TypeError` throw 단언 + `inputs` 가 빈 배열일 때 `totalAuthorCount=0` / `byAuthor=[]` / `underPerformerDetected=false`(throw 0) 단언.
- [ ] **Flow / branch coverage** (각 분기 1+ test): (a) underPerformer 대상 + 비대상 혼합 batch 분기, (b) 전원 동률 codeUnitCount batch(현격 차 없음 → underPerformer 0), (c) document 단위만 있는 author / document 단위가 섞인 author 의 code 기여 정량에서 document 제외 검증, (d) 단독 author batch(비교 대상 없음 → underPerformer 0).
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `inputs` 배열, (ii) 전원 code 기여 0(전 author codeUnitCount=0 → underPerformer 0, "현격히 떨어지는" 대상 없음), (iii) `contributionKind` 가 `"code"`/`"document"` 외 예상치 못한 값일 때 code 제외 동작(throw 0), (iv) 동일 author 의 code+document 혼합 단위에서 code 단위만 카운트, (v) 임계 경계값(평균 × FLOOR 정확히 / 그 미만 / 그 초과)에서 분류 정확성, (vi) 입력 등장 순서가 byAuthor 정렬에 보존됨(결정적 순서) 단언. 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic 확인).
- [ ] **비변형 단언**: 입력 `inputs` 배열·원소가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과) 단언.
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% AND function ≥ 80%(순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- 저성과 신호의 소비(저성과 author 의 `EvaluationResult` / summary 반영·표식·감점) 0 — 본 task 는 detection layer 만(소비는 후속 consume slice, T-0528 mirror).
- `EvaluationOrchestratorService` / scoring service 배선 0 — orchestrator 배선은 후속 slice(T-0529 mirror).
- `EvaluationInput` / `EvaluationResult` / `ContributionKind` 타입 변경 0.
- `UNDERPERFORMER_RELATIVE_FLOOR` 등 임계 calibration(실 data 관측 후 tuning) 은 별도 task — 본 task 는 보수적 v1 상수 박제만.
- metadata enrich 기반 가중 신호(변경 라인 수 등) 0 — 현 `ActivityMetadata` 의 가용 신호로 한정(v1 = code 단위 수 상대 비교).
- mean vs median 외 정교한 통계 모델(분산·표준편차·IQR 등) 0 — v1 은 단일 결정적 상대 비교만.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0.
- LLM gateway 호출 변경 0(detection 은 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) 저성과 신호 consume slice — underPerformer author 의 평가 결과/summary 반영(T-0528 contribution-quality floor consume 패턴 mirror, 결정적 소비 helper 신설).
- (예정) 저성과 신호 orchestrator 배선 slice — `EvaluationOrchestratorService.evaluateActivities` 에 detection + consume compose(T-0529 mirror, 3-slice 완결).
- (예정) `UNDERPERFORMER_RELATIVE_FLOOR` (현 v1=0.5) 및 base 산출 방식(mean/median) tuning — 실 data 관측 후 calibration 별도 task.
- (예정) metadata enrich(변경 라인 수 등) 후 code 기여 정량을 단위 수에서 변경량 가중으로 강화 — 휴리스틱 보강 별도 task.

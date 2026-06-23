---
id: T-0606
title: 평가 후처리 5-adjuster 단일 진입 순수 composer applyEvaluationAdjustments 추출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-040, REQ-037, REQ-041, REQ-027, REQ-025]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 abuse/quality/underperformer/notable/update-count 후처리 chain 을 orchestrator inline 5-step 에서 순수 composer 1개로 추출 — 독립 stream, dependsOn []"
independentStream: p5-evaluation-adjustments
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
---

# T-0606 — 평가 후처리 5-adjuster 단일 진입 순수 composer applyEvaluationAdjustments 추출

## Why

P5(Evaluation pipeline)의 평가 후처리(post-scoring adjustment) 5종 — abuse 감점(R-26
PLAN 101행) · update-count 중립화(R-41 PLAN 102행) · 기여 품질 floor(R-37/38 PLAN 103행) ·
저성과자 annotation(R-27 PLAN 105행) · 중요기여 annotation(R-25 PLAN 104행) — 은 각각
순수 helper(`applyAbuseSignalToVolume` / `applyUpdateCountNeutralizationToVolume` /
`applyContributionQualityFloor` / `applyUnderPerformerAnnotation` /
`applyNotableContributionAnnotation`)로 박제돼 있으나, 이들을 **v1 고정 순서로 thread 하는
로직이 `EvaluationOrchestratorService` 메서드 본문 안에 inline(L258~315)** 으로만 존재한다.
이 inline 5-step chain 은 `@Injectable` service 안에 묶여 있어 LLM scoring mock 주입 없이는
순수 단위로 검증하기 어렵다.

본 slice 는 realdata-e2e stream 이 반복 적용한 "단일 진입 순수 composer 추출" 패턴을 그대로
가져와, `entries: EvaluationAdjustEntry[]` + 5개 signal 을 받아 orchestrator 와 **byte-identical**
한 순서로 thread 하는 순수 함수 `applyEvaluationAdjustments(entries, signals)` 를 신규 도메인
파일로 추출한다. 본 task 는 **composer + colocated spec 신설만** — orchestrator 가 본 composer 를
호출하도록 배선하는 것은 별도 follow-up(파일 disjoint·동시성 보존). 추출로 5-step thread
순서·필드 직교성·entries↔result flatten 계약이 service mock 없이 단위 검증 가능해진다.

## Required Reading

- `src/assessment-evaluation/evaluation-orchestrator.service.ts` L255~316 — 추출 대상 inline
  5-step chain(abuse → update-count → quality → underperformer → notable → flatten). **변경 금지 —
  순서·계약을 그대로 mirror 하는 source-of-truth**. 본 task 는 이 파일 미변경(배선은 follow-up).
- `src/assessment-evaluation/domain/evaluation-abuse-adjust.ts` L43~106 — `AbuseAdjustEntry`
  shape({author, result}) + `applyAbuseSignalToVolume(entries, AbuseSignal)` 시그니처. 5종 entry
  type 이 구조적으로 동일함을 확인(공통 `EvaluationAdjustEntry` 정의 근거).
- `src/assessment-evaluation/domain/evaluation-update-count-adjust.ts` L48~120 —
  `applyUpdateCountNeutralizationToVolume(entries, neutralization)` 시그니처 + signal type import 경로.
- `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` L62~130 —
  `applyContributionQualityFloor(entries, ContributionQualitySignal)`.
- `src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts` L68~135 —
  `applyUnderPerformerAnnotation(entries, UnderPerformerSignal)`.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` L78~140 —
  `applyNotableContributionAnnotation(entries, NotableContributionSignal)`.
- `test/helpers/` 디렉토리(공유 fixture 패턴 참조 — 신규 helper 추출은 본 task 밖, colocated spec 내 inline fixture 우선).

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` 추가:
  - 공통 entry type `EvaluationAdjustEntry`(또는 기존 5종 중 1개 import-재사용)와 5 signal 을
    묶는 입력 container type(예: `EvaluationAdjustmentSignals { abuse, updateCount, quality, underPerformer, notableContribution }`)
    정의 — 5 signal type 은 각 도메인 모듈에서 `import type` 재사용(신규 signal 정의 0).
  - 순수 함수 `applyEvaluationAdjustments(entries, signals): EvaluationResult[]` — orchestrator
    L262~315 와 **동일 순서**(abuse → update-count → quality → underperformer → notable)로 5개
    위임 helper 를 thread 한 뒤 마지막에 `.map((e) => e.result)` flatten. **위임만 — 감점·중립·
    floor·annotation 로직 재구현 0**.
  - `entries` / `signals` / `signals` 의 각 필드 null/undefined guard throw(`TypeError`, 위임 helper
    가 throw 하면 자체 try/catch 없이 전파). 한국어 주석(§12)으로 v1 순서·필드 직교성 명시.
- [ ] **Happy-path unit test**: 5 signal 이 모두 정상일 때 `applyEvaluationAdjustments` 가
  orchestrator inline chain 과 동일한 최종 `EvaluationResult[]` 를 산출(abuse 감점·update-count
  중립·quality floor·두 narrative marker 가 모두 반영된 fixture 1+)을 검증.
- [ ] **Error path unit test**: `entries` 또는 `signals` 가 null/undefined → `TypeError` throw;
  위임 helper(예: `applyAbuseSignalToVolume`)가 throw 하는 입력에서 composer 가 잡지 않고 전파.
- [ ] **Flow / branch 분기 cover**: (a) 빈 `entries: []` → `[]` 반환(전 위임 무변경 통과)
  경로, (b) 모든 signal 이 "무대상"(빈 byAuthor 등)일 때 entries 의 result 가 무변경 복제되는 경로,
  (c) 일부 author 만 abuse/underperformer/notable 대상인 혼합 경로 각 1+ test.
- [ ] **Negative cases 충분 cover**: `signals` 의 개별 필드 누락(abuse 만 undefined 등) · entries 가
  배열 아님 · result 필드 비정상 등 예외 입력 각 1+ — 위임 guard throw 전파 또는 방어 동작 검증.
  단일 negative 금지 — 각 위임 경계마다 cover.
- [ ] **무변형·결정론·무공유 검증**: 동일 입력 2회 호출 시 deep-equal(byte-identical) 산출 +
  입력 `entries`/`signals` mutate 0(not-same-ref) + 산출 배열이 입력과 not-same-ref.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 composer 전 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `evaluation-orchestrator.service.ts` 변경 금지 — orchestrator 가 본 composer 를 호출하도록 하는
  배선은 별도 follow-up slice(파일 disjoint 유지·동시성 보존). 본 task 는 composer 신설만.
- 5종 adjuster helper(`evaluation-*-adjust.ts`) 변경 금지 — 위임만(재구현 0).
- 5종 signal detection helper(`evaluation-*-signal.ts`) 변경 금지 — composer 는 신호를 인자로만 받음.
- adjuster 적용 **순서 정책 변경** 금지 — orchestrator 의 v1 고정 순서를 그대로 mirror(순서 변경은
  별도 ADR 책임 — narrative marker 동시 발생 edge case 의 결정성 계약 유지).
- DB / 네트워크 / LLM / env 접근 0 — build-time 순수 함수(cloud-safe·dependency-free).
- 새 외부 dependency 0(기존 도메인 type import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- orchestrator 배선: `EvaluationOrchestratorService` 의 inline 5-step(L258~315)을 본 composer
  `applyEvaluationAdjustments(entries, signals)` 단일 호출로 교체(별도 pr-mode slice — 본 task
  머지 후 dependsOn: [T-0606], orchestrator service + spec touch).

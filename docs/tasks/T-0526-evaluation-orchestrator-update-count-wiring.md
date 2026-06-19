---
id: T-0526
title: EvaluationOrchestratorService 에 update 횟수 중립화 소비 배선 (computeUpdateCountNeutralization→applyUpdateCountNeutralizationToVolume)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-022]
dependsOn: []
independentStream: p5-evaluation-update-count
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
estimatedDiff: 225
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 102(R-41/REQ-022 update 횟수 중립화) — T-0524 detection + T-0525 소비 helper 를 orchestrator 에 실배선(impure service-layer), T-0523 mirror, pr, ~225 LOC 2 파일
---

# T-0526 — EvaluationOrchestratorService 에 update 횟수 중립화 소비 배선

## Why

[docs/PLAN.md](../PLAN.md) P5 bullet 102 (R-41 / REQ-022: "습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage / disadvantage 둘 다 없어야") 의 마무리 조각이다. T-0524(`computeUpdateCountNeutralization`, merge 9306bf5 — detection layer) 와 T-0525(`applyUpdateCountNeutralizationToVolume`, merge 2f70aa6 — 소비 helper) 가 박제됐으나 둘 다 domain 순수 helper 일 뿐 실 evaluation 흐름에 import 0 — `git grep -E "computeUpdateCountNeutralization|applyUpdateCountNeutralizationToVolume" src/` 가 domain 4 파일(helper 2 + spec 2) 외 0 매칭으로 issue-still-relevant pre-check 통과. 본 task 는 T-0523 (abuse 신호 orchestrator 배선) 의 **충실한 mirror** — 검증된 두 순수 helper(detection + 소비)를 `EvaluationOrchestratorService.evaluateActivities` 에 compose 한다. 새 알고리즘 0 — abuse 배선이 박제한 자리에 update-count 배선을 동형으로 끼우는 것만 담당한다. ADR-0032 §3 정신(양은 deterministic 수치, LLM 무관) 정합.

## Required Reading

- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — 현 compose 흐름(정규화 → dedup 2 종 → abuse detection → 단위별 scoreUnit → abuse adjust). T-0523 이 박제한 abuse 배선 패턴이 본 task 의 mirror 원형. update-count 배선을 끼울 자리(abuse detection 옆 / abuse adjust 옆).
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — colocated spec. T-0523 이 추가한 abuse 배선 R-112 cover 패턴(mock scoreUnit 주입 + 매핑·dedup·순서·error 전파 검증). 본 task 의 신규 test 도 같은 패턴 mirror.
- [src/assessment-evaluation/domain/evaluation-update-count-neutral.ts](../../src/assessment-evaluation/domain/evaluation-update-count-neutral.ts) — `computeUpdateCountNeutralization(inputs: EvaluationInput[]): UpdateCountNeutralization` 입력/출력 shape + UPDATE_COUNT_NEUTRAL_THRESHOLD=5 + author 별 `neutralized` / `neutralizedUnitIds`.
- [src/assessment-evaluation/domain/evaluation-update-count-adjust.ts](../../src/assessment-evaluation/domain/evaluation-update-count-adjust.ts) — `applyUpdateCountNeutralizationToVolume(entries: UpdateCountAdjustEntry[], neutralization): UpdateCountAdjustEntry[]` signature + `UpdateCountAdjustEntry { author, result }` shape + throw 0(흡수 정책) + net 0 중립 보존(감점 공식 미사용) + FLOOR 0.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput.author: string` / `contributionKind` / `metadata.version` 필드 정합(entries 조립 + detection 동작 근거).
- [docs/tasks/T-0523-evaluation-orchestrator-abuse-wiring.md](T-0523-evaluation-orchestrator-abuse-wiring.md) — mirror 원형(배선 순서·실패 격리·비변형·결정성 박제). 본 task 는 R-26/R-40 감점 대신 R-41 중립 net 0 의미로 동형 배선.
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §1/§2/§3/§4 — compose 순서 박제 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- `EvaluationOrchestratorService.evaluateActivities` 의 기존 abuse 배선과 동형으로 update-count 배선을 끼운다. 신규 알고리즘 0 — 두 순수 helper 의 compose 만.
- 배선 순서(권장 v1, 결정적 — abuse 배선과 동형):
  1. 기존: `deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` (§4 dedup)
  2. 기존: `signal = computeAbuseSignal(deduped)` (R-26/R-40 detection)
  3. **신규**: `neutralization = computeUpdateCountNeutralization(deduped)` — dedup 후 입력에 대한 R-41 detection(중복 부풀림 제거 후 update 횟수 measure).
  4. 기존: 단위별 순차 `scoreUnit(input, options)` → `EvaluationResult[]` 수집(§2).
  5. 기존: `adjusted = applyAbuseSignalToVolume(entries, signal)` (abuse 감점).
  6. **신규**: abuse adjust 산출물을 다시 entries 로 재조립 → `applyUpdateCountNeutralizationToVolume(entries2, neutralization)` 로 중립 대상 author/unit 의 volume 을 net 0(중립 보존)으로 처리해 반환.
- **적용 순서 결정(구현자 재량, 권장 v1)**: abuse 감점(R-26/R-40) → update-count 중립(R-41) 순서를 권장한다. 근거 — abuse 는 감점(penalty), update-count 중립은 net 0 보존이라, 중립 대상 단위는 마지막에 base 보존되어야 "advantage 도 penalty 도 없음"(R-41 명문)이 최종 보장된다. 단 한 단위가 abuse suspected 이면서 동시에 update-count 중립 대상인 교차 경우는 흔치 않으므로 **본 v1 의 두 helper 적용 순서가 만드는 결과 차이를 spec 으로 명시 박제**하면 충분(교차 우선순위 튜닝은 Follow-ups).
- 빈 입력 경계: `deduped` 가 빈 배열이면 `computeUpdateCountNeutralization([])` 가 빈 신호(throw 0), `applyUpdateCountNeutralizationToVolume([], neutralization)` 가 빈 배열 — 기존 빈 입력 동작(빈 `EvaluationResult[]`) 보존.
- 실패 격리(§2): scoring reject 는 기존대로 await 전파. 두 adjust(abuse + update-count) 는 scoring 전량 성공 후에만 실행 — 부분 결과 위장 0 정합.
- 비변형: 두 helper 모두 입력 비변형이라 `deduped` / `results` / abuse adjust 산출물이 후속 호출에서도 안전. orchestrator 자체도 부수효과 0 유지.
- import 추가: `computeUpdateCountNeutralization` from `./domain/evaluation-update-count-neutral`, `applyUpdateCountNeutralizationToVolume` from `./domain/evaluation-update-count-adjust`. 새 외부 dep 0, 새 ADR 0 (ADR-0032 §3 정신 그대로).
- 파일 머리 주석의 흐름 박제(현재 5 단계)를 update-count 배선 반영해 갱신(detection/소비 단계 추가).

## Acceptance Criteria

- [ ] `EvaluationOrchestratorService.evaluateActivities` 가 dedup 후 `computeUpdateCountNeutralization(deduped)` 를 호출하고, scoring + abuse adjust 완료 후 `applyUpdateCountNeutralizationToVolume(entries, neutralization)` 로 중립 대상 단위의 volume 을 net 0 보존 처리해 결과 반환. 새 알고리즘 0 (두 helper 의 compose 만, 기존 abuse 배선 보존).
- [ ] **Happy-path test 1+**: update 횟수 임계 이상(≥5)으로 식별된 author/unit 의 단위 `volume` 이 결정적으로 base 보존(net 0 — 감점도 가산도 없음)되고, 비대상 author/unit 의 단위 `volume` 이 무변경임을 단언하는 compose 검증 test 각 1+ (mock scoreUnit 으로 scoring 결과 + 입력 `metadata.version` 을 통제해 입출력 비교).
- [ ] **Error path test 1+**: scoring reject 시 두 adjust(abuse + update-count) 가 호출되지 않고 error 가 전파됨(§2 실패 격리 유지) 단언 + 입력 `activities` 가 빈 배열일 때 빈 `EvaluationResult[]` 반환 단언.
- [ ] **Flow / branch coverage**: (a) 중립 대상 + 비대상 혼합 batch 분기, (b) 전 단위 비대상(version < 임계 또는 code 단위)인 batch 분기(전 단위 volume 무변경), (c) dedup 으로 일부 제거된 batch(detection 이 dedup 후 입력 위에서 동작 확인), (d) `version` 경계(임계값 5 정확히 / 4 / 비-number / 누락) 동작 — 각 1+ test.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `activities` 배열, (ii) 단일 author 단일 단위(비대상), (iii) 동일 author 다수 단위(일부만 중립 대상 — 부분 적용 정합), (iv) 중립 대상 단위의 volume 이 이미 0 또는 음수/비유한 layer 경계(FLOOR 동작), (v) code 단위(contributionKind !== "document")는 version 무관 비대상 단언(R-41 문서 한정), (vi) scoring 결과 순서와 entries 순서 정합 단언(매핑 misalignment 회귀 방어). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **abuse + update-count 공존 단언**: 기존 abuse 감점 배선이 보존되고(회귀 0), 두 배선이 함께 동작하는 batch(한 단위는 abuse suspected, 다른 단위는 update-count 중립 대상) 의 결정적 결과를 단언.
- [ ] **결정성 단언**: 동일 입력으로 2회 `evaluateActivities` 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic adjust 확인).
- [ ] **비변형 단언**: 입력 `activities` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-orchestrator.service.ts` line ≥ 80% AND function ≥ 80% (배선만이라 100% 목표 권장). 전체 jest green.

## Out of Scope

- `computeUpdateCountNeutralization` / `applyUpdateCountNeutralizationToVolume` 의 알고리즘 변경 0 (본 task 는 배선만 — UPDATE_COUNT_NEUTRAL_THRESHOLD / FLOOR 튜닝은 별도 task).
- abuse 배선(`computeAbuseSignal` / `applyAbuseSignalToVolume`) 의 알고리즘 / 순서 변경 0 — 기존 배선은 보존만, update-count 배선을 옆에 추가.
- abuse suspected ∩ update-count 중립 대상 교차 단위의 우선순위 정책 튜닝(본 v1 은 적용 순서 결과를 spec 으로 박제만) — 별도 task.
- `EvaluationScoringService.scoreUnit` 변경 0 (단위 scoring 의 입력/출력 contract 유지).
- `UpdateCountNeutralization` / `UpdateCountAdjustEntry` / `EvaluationResult` / `EvaluationInput` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0 (in-memory orchestrator 만).
- LLM gateway 호출 변경 0 (detection·adjust 둘 다 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) abuse suspected ∩ update-count 중립 대상 교차 단위 우선순위 정책 — 두 신호가 한 단위에 동시 작용할 때 net 결과 규칙 명문화(실 data 관측 후 별도 task).
- (예정) update 횟수 중립화 v1 baseline (UPDATE_COUNT_NEUTRAL_THRESHOLD=5 · FLOOR 0) tuning — 임계 calibration 은 실 data 관측 후 별도 task.
- (예정) update-count 중립 신호의 evaluation 결과 영속화 — Assessment row 의 중립화 메모/근거 필드 (§5 schema 게이트 사람 결정 후).

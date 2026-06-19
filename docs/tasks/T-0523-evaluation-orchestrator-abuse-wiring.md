---
id: T-0523
title: EvaluationOrchestratorService 에 abuse signal 소비 배선 (computeAbuseSignal→applyAbuseSignalToVolume)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-012, REQ-021, REQ-026, REQ-040]
dependsOn: []
independentStream: p5-evaluation-abuse
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
estimatedDiff: 225
estimatedFiles: 2
created: 2026-06-19
plannerNote: P5 bullet 101(abusing 방지 metric) — T-0521 detection + T-0522 소비 helper 를 orchestrator 에 실배선(impure service-layer), pr, ~225 LOC 2 파일
---

# T-0523 — EvaluationOrchestratorService 에 abuse signal 소비 배선

## Why

[docs/PLAN.md](../PLAN.md) P5 bullet 101 ("Abusing 방지 metric — 코드 abusing R-26 + 문서 abusing R-40") 의 마무리 조각이다. T-0521(`computeAbuseSignal`, merge f2d76a3 — detection layer) 과 T-0522(`applyAbuseSignalToVolume`, merge eb3c73f — 소비 helper) 가 박제됐으나 둘 다 domain 순수 helper 일 뿐 실 evaluation 흐름에 import 0 — `git grep -E "computeAbuseSignal|applyAbuseSignalToVolume" src/ origin/main` 가 domain 4 파일(helper 2 + spec 2) 외 0 매칭으로 issue-still-relevant pre-check 통과. T-0522 의 Follow-ups[1] 가 명시한 "이 helper 를 `EvaluationOrchestratorService.evaluateActivities` 에 배선 — `computeAbuseSignal(inputs)` 산출 후 scoring 결과 volume 에 적용하는 impure service-layer slice" 를 본 task 가 박제한다. ADR-0032 §3 정신(양은 deterministic 수치, LLM 무관) + ADR-0032 §1/§2/§4 compose 흐름 정합 — 새 알고리즘 0, 이미 검증된 두 순수 helper 의 compose + 순서 결정만 담당한다.

## Required Reading

- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — 현 compose 흐름(정규화 → dedup 2 종 → 단위별 scoreUnit). 본 task 가 배선을 끼울 자리(scoring 후, 결과 반환 전).
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — 기존 R-112 4 종 cover 패턴(mock scoreUnit 주입 + 매핑·dedup·순서·error 전파 검증). 본 task 의 신규 test 도 같은 패턴 mirror.
- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) — `computeAbuseSignal(inputs: EvaluationInput[]): AbuseSignal` 입력/출력 shape.
- [src/assessment-evaluation/domain/evaluation-abuse-adjust.ts](../../src/assessment-evaluation/domain/evaluation-abuse-adjust.ts) — `applyAbuseSignalToVolume(entries: AbuseAdjustEntry[], signal): AbuseAdjustEntry[]` signature + `AbuseAdjustEntry { author, result }` shape + throw 0(흡수 정책) + FLOOR 0 단조 감점.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput.author: string` 필드 정합(entries 조립 시 input.author 사용).
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §1/§2/§3/§4 — compose 순서 박제 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- `EvaluationOrchestratorService.evaluateActivities` 의 dedup 직후 / scoring 직후 자리에 배선을 끼운다. 신규 알고리즘 0 — 두 순수 helper 의 compose 만.
- 배선 순서(권장 v1, 결정적):
  1. 기존: `inputs = activities.map(mapActivityToEvaluationInput)` (§1 정규화)
  2. 기존: `deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` (§4 dedup)
  3. **신규**: `signal = computeAbuseSignal(deduped)` — dedup 후 입력에 대한 detection (중복으로 부풀린 신호 제거 후 measure, R-26/R-40 정합).
  4. 기존: 단위별 순차 `scoreUnit(input, options)` → `EvaluationResult[]` 수집.
  5. **신규**: scoring 후 `entries = deduped.map((input, i) => ({ author: input.author, result: results[i] }))` 조립 → `adjusted = applyAbuseSignalToVolume(entries, signal)` → `return adjusted.map(e => e.result)`.
- 빈 입력 경계: `deduped` 가 빈 배열이면 `computeAbuseSignal([])` 가 빈 신호(throw 0), `applyAbuseSignalToVolume([], signal)` 가 빈 배열 — 기존 빈 입력 동작(빈 `EvaluationResult[]`) 보존.
- 실패 격리(§2): scoring reject 는 기존대로 await 전파. abuse adjust 는 scoring 성공 후에만 실행 — 부분 결과 위장 0 정합.
- 비변형: 두 helper 모두 입력 비변형이라 `deduped` / `results` 가 후속 호출에서도 안전. orchestrator 자체도 부수효과 0 유지.
- import 추가: `computeAbuseSignal` from `./domain/evaluation-abuse-signal`, `applyAbuseSignalToVolume` from `./domain/evaluation-abuse-adjust`. 새 외부 dep 0, 새 ADR 0 (ADR-0032 §3 정신 그대로).

## Acceptance Criteria

- [ ] `EvaluationOrchestratorService.evaluateActivities` 가 dedup 후 `computeAbuseSignal(deduped)` 를 호출하고, 단위별 scoring 완료 후 `applyAbuseSignalToVolume(entries, signal)` 로 volume 을 조정해 결과 반환. 새 알고리즘 0 (두 helper 의 compose 만).
- [ ] **Happy-path test 1+**: suspected author 의 단위 `volume` 이 결정적으로 감점되고, non-suspected author 의 단위 `volume` 이 무변경임을 단언하는 compose 검증 test 각 1+ (mock scoreUnit 으로 scoring 결과를 통제해 입출력 비교).
- [ ] **Error path test 1+**: scoring reject 시 abuse adjust 가 호출되지 않고 error 가 전파됨(§2 실패 격리 유지) 단언 + 입력 `activities` 가 빈 배열일 때 빈 `EvaluationResult[]` 반환(helper 호출 0회 또는 빈 입력 통과) 단언.
- [ ] **Flow / branch coverage**: (a) suspected author + non-suspected author 혼합 batch 분기, (b) 전 author 가 non-suspected 인 batch 분기(전 단위 volume 무변경), (c) dedup 으로 일부 제거된 batch(detection 이 dedup 후 입력 위에서 동작 확인), (d) `repetitionRatio` 경계(0 / 1.0) 동작 — 각 1+ test.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `activities` 배열, (ii) 단일 author 단일 단위(suspected=false), (iii) 동일 author 다수 단위(전부 동일 규칙 적용), (iv) suspected author 의 volume 이 이미 0(FLOOR 동작), (v) scoring 결과 순서와 entries 순서 정합 단언(매핑 misalignment 회귀 방어). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 `evaluateActivities` 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic adjust 확인).
- [ ] **비변형 단언**: 입력 `activities` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-orchestrator.service.ts` line ≥ 80% AND function ≥ 80% (배선만이라 100% 목표 권장). 전체 jest green.

## Out of Scope

- `computeAbuseSignal` / `applyAbuseSignalToVolume` 의 알고리즘 변경 0 (본 task 는 배선만 — 알고리즘 튜닝은 별도 task).
- `EvaluationScoringService.scoreUnit` 변경 0 (단위 scoring 의 입력/출력 contract 유지).
- `AbuseSignal` / `AbuseAdjustEntry` / `EvaluationResult` / `EvaluationInput` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0 (in-memory orchestrator 만).
- R-41 (REQ-022) 문서 update 횟수 중립화 / advantage·disadvantage 양면 0 처리 — 별도 신호/규칙, 본 task 범위 밖.
- LLM gateway 호출 변경 0 (detection·adjust 둘 다 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) abusing v1 baseline (clampRatio · FLOOR 0 · floor(volume * (1-ratio))) tuning — repetitionRatio 임계 / 감점 곡선 calibration 은 실 data 관측 후 별도 task.
- (예정) R-41 (REQ-022) 문서 update 횟수 중립화 규칙 — advantage/disadvantage 둘 다 0 처리 별도 신호/helper + orchestrator 배선.
- (예정) abuse signal 의 evaluation 결과 영속화 — Assessment row 의 abusing 메모/근거 필드 (§5 schema 게이트 사람 결정 후).

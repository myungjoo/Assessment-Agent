---
id: T-0522
title: applyAbuseSignalToVolume — abuse 신호 소비 volume 중립화/감점 순수 helper
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-012, REQ-021]
dependsOn: []
independentStream: p5-evaluation-abuse
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-abuse-adjust.ts
  - src/assessment-evaluation/domain/evaluation-abuse-adjust.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
plannerNote: P5 PLAN bullet 101(abusing 방지 metric) — T-0521 detection 신호를 소비해 volume 중립화/감점 순수 helper, pr, ~240 LOC 2 파일
---

# T-0522 — applyAbuseSignalToVolume: abuse 신호 소비 volume 중립화/감점 순수 helper

## Why

[docs/PLAN.md](../PLAN.md) P5 bullet 101("Abusing 방지 metric — 코드 abusing R-26 + 문서 abusing R-40")의 다음 조각이다. T-0521(`computeAbuseSignal`, merge f2d76a3)이 R-26/R-40 반복 부풀리기 **detection layer**(author 별 `suspected` / `repetitionRatio` 신호)를 박제했으나, 그 신호를 실제 점수에 **반영**(advantage 중립화/감점)하는 소비측이 0이다. STATE.backlogNote 가 명시한 "이 신호를 소비해 advantage 중립화/감점에 반영하는 scoring 배선"의 dependency-free 첫 조각으로, `AbuseSignal` 을 받아 `EvaluationResult[]` 의 `volume`(REQ-012/REQ-021 의 정량 기반)을 suspected author 단위에서 결정적으로 조정하는 **순수 domain helper** 1개를 박제한다. impure orchestrator/service 실배선은 후속 task 로 분리한다(Follow-ups).

## Required Reading

- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) — `AbuseSignal` / `AuthorAbuseSignal` 입력 shape(`byAuthor`, `suspected`, `repetitionRatio`, `unitCount`, `lowVolumeUnitCount`, `byKind`).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `EvaluationResult`(`unitId`/`narrative`/`difficulty`/`contribution`/`volume`) 조정 대상 타입.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `author`/`unitId` 정합(결과 ↔ 입력 trace) + `ContributionKind`.
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) — volume 산출 규칙(중립화/감점이 어떤 수치를 건드리는지 정합 확인, 변경 0).
- colocated spec 경로(신규): `src/assessment-evaluation/domain/evaluation-abuse-adjust.spec.ts` (NestJS convention — domain 순수 helper 는 colocated spec).

## 설계 의도(구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-abuse-adjust.ts` 에 **dependency-free 순수 함수** `applyAbuseSignalToVolume(results: EvaluationResult[], signal: AbuseSignal): EvaluationResult[]` 1종 박제. NestJS `@Injectable` / Prisma / LLM gateway import 0 — `evaluation-abuse-signal.ts` / `evaluation-volume.ts` 의 순수 함수 패턴 mirror.
- 입력 `results` 의 각 단위를 `unitId` → author 매핑이 아니라, **caller 가 author 를 함께 전달**해야 매핑 가능하므로: 본 helper 는 `EvaluationResult` 가 `author` 를 보유하지 않는 현 shape 를 존중해, signature 를 `applyAbuseSignalToVolume(results, signal, resultAuthor: (r) => string)` 또는 `applyAbuseSignalToVolume(entries: { author: string; result: EvaluationResult }[], signal)` 중 **구현자가 단순·결정적인 쪽을 선택**한다(파일 머리 주석에 선택 근거 박제). `EvaluationResult` 타입 자체는 변경 금지(Out of Scope).
- 조정 규칙(v1 baseline, 결정적·LLM 무관):
  - signal.byAuthor 의 `suspected === false` author → volume 무변경(중립).
  - `suspected === true` author 의 단위 → volume 을 `repetitionRatio` 비례로 **감점**(예: `adjusted = round(volume * (1 - repetitionRatio))`, 0 미만 방지). 정확한 공식은 구현자가 결정하되 결정적이고 단조(ratio↑ → 감점↑)여야 하며, 상수는 named export 로 박제(`ABUSE_VOLUME_PENALTY_*` 등) + 파일 머리 주석에 v1 근거.
  - 입력 `results` / 원소 / signal 비변형 — 새 배열·새 객체만 반환(referential transparency).
- throw 정책: 입력 결함(빈 배열·signal.byAuthor 빈·author 미매칭)은 **방어적으로 흡수**(무변경 passthrough) 하거나, 명시적 입력 계약 위반(예: null/undefined results)만 한국어 `TypeError`. `computeAbuseSignal`(throw 0)과 layer 정합 — 구현자가 파일 머리 주석에 throw 경계 박제.

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-abuse-adjust.ts` 에 `applyAbuseSignalToVolume` 순수 함수 + 조정 상수 named export 박제. NestJS/Prisma/LLM import 0(dependency-free 확인).
- [ ] **Happy-path test 1+**: suspected author 의 volume 이 결정적으로 감점되고, non-suspected author 의 volume 이 무변경(중립)임을 단언하는 test 각 1+.
- [ ] **Error path test 1+**: 입력 계약 위반(null/undefined `results` 또는 `signal`, 또는 helper 가 정한 명시적 위반)에서 한국어 메시지로 throw 하거나 방어적 passthrough 함을 단언(helper 의 throw 경계 정책대로).
- [ ] **Flow / branch coverage**: `suspected` true/false 분기, `repetitionRatio` 경계(0 / 0.5 / 1.0), volume 0 입력, author 미매칭(signal.byAuthor 에 없는 author) 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**(예외 상황 분기마다 1+): 빈 `results` 배열, 빈 `signal.byAuthor`, volume 이 이미 0 인 단위(감점 후 음수 방지 단언), `repetitionRatio === 1` 인 author(전량 감점 경계), 동일 author 다수 단위(모두 동일 규칙 적용) 등 — 단일 negative 만으로 부족, 각 예외 분기마다 test.
- [ ] **비변형 단언**: 입력 `results`/원소/`signal` 이 호출 후 변경되지 않음(`Object.freeze` 입력으로 호출 통과 또는 deep-equal 단언).
- [ ] **결정성 단언**: 동일 입력 2회 호출이 동일 출력(`toEqual`) 임을 단언.
- [ ] `pnpm lint && pnpm build` 통과(clean).
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% AND function ≥ 80%(순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- `EvaluationResult` / `EvaluationInput` / `AbuseSignal` 타입 자체 변경 금지(본 helper 는 소비만 — shape 변경은 별도 task).
- impure 배선 금지: `EvaluationOrchestratorService` / `EvaluationScoringService` 에 본 helper 호출을 끼워넣는 service-layer 변경은 후속 task(아래 Follow-ups). 본 task 는 domain 순수 helper + spec 2 파일만.
- R-41(문서 update 횟수 중립화, REQ-022)의 "advantage/disadvantage 둘 다 없음" 규칙은 별도 신호/규칙 — 본 task 는 R-26/R-40 의 suspected 감점만.
- DB/Prisma/migration/controller/DTO/endpoint 변경 0.
- LLM gateway 호출 0(detection·adjust 둘 다 deterministic, LLM 무관).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) `applyAbuseSignalToVolume` 를 `EvaluationOrchestratorService.evaluateActivities` 에 배선 — `computeAbuseSignal(inputs)` 산출 후 scoring 결과 volume 에 적용하는 impure service-layer slice(별도 pr task, `evaluation-orchestrator.service.ts` touch).
- (예정) R-41(REQ-022) 문서 update 횟수 중립화 규칙 — advantage/disadvantage 둘 다 0 처리 별도 신호/helper.

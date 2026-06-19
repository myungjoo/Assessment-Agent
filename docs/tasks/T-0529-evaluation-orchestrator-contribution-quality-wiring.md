---
id: T-0529
title: EvaluationOrchestratorService 에 기여 품질 floor 강등 소비 배선 (computeContributionQualitySignal→applyContributionQualityFloor)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: p5-evaluation-quality-class
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 103(R-37/R-38 zero-contribution 품질 분류) — T-0527 detection + T-0528 소비 helper 를 orchestrator 에 실배선(impure service-layer), T-0526 mirror, pr ~240 LOC 2 파일
---

# T-0529 — EvaluationOrchestratorService 에 기여 품질 floor 강등 소비 배선

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 103 (R-37 / R-38 / REQ-037 / REQ-038: "단순 보고·copy-paste 로그 = **zero-contribution** / 새 알고리즘 설계·외부 연구 도입 소개자료 = **높은 contribution**") 의 마무리 조각이다. T-0527 (`computeContributionQualitySignal`, merge cbd5232 — detection layer, metadata.titleLength ≤ CONTRIBUTION_QUALITY_TITLE_FLOOR 휴리스틱) 과 T-0528 (`applyContributionQualityFloor`, merge 5dbdc70 — 소비 helper, contribution 을 `"zero"` 로 결정적 floor 강등) 가 박제됐으나 둘 다 domain 순수 helper 일 뿐 실 evaluation 흐름에 import 0 — `git grep -E "computeContributionQualitySignal|applyContributionQualityFloor" src/assessment-evaluation/evaluation-orchestrator.service.ts` 0 매칭(issue-still-relevant pre-check 통과, main 미배선). 본 task 는 T-0526 (update-count 신호 orchestrator 배선) 의 **충실한 mirror** — 검증된 두 순수 helper(detection + 소비) 를 `EvaluationOrchestratorService.evaluateActivities` 에 compose 한다. 새 알고리즘 0 — update-count 배선이 박제한 자리에 contribution-quality 배선을 동형으로 끼우는 것만 담당한다. ADR-0032 §3 정신(결정적, LLM 무관) 정합. 본 배선으로 R-37/R-38 zero-contribution layer 가 detection → consume → orchestrator 3-slice 패턴(abuse: T-0521→T-0522→T-0523, update-count: T-0524→T-0525→T-0526, contribution-quality: T-0527→T-0528→**T-0529**)으로 완결된다.

## Required Reading

- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — 현 compose 흐름 (정규화 → dedup 2 종 → abuse detection → update-count detection → 단위별 scoreUnit → abuse adjust → update-count adjust). T-0523/T-0526 가 박제한 두 배선 패턴이 본 task 의 mirror 원형. contribution-quality 배선을 끼울 자리(update-count detection 옆 / update-count adjust 옆).
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — colocated spec. T-0523/T-0526 이 추가한 두 배선의 R-112 cover 패턴(mock scoreUnit 주입 + 매핑·dedup·순서·error 전파 검증). 본 task 의 신규 test 도 같은 패턴 mirror.
- [src/assessment-evaluation/domain/evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) — `computeContributionQualitySignal(inputs: EvaluationInput[]): ContributionQualitySignal` 입력/출력 shape + `ContributionQualityEntry` (author / `zeroContributionUnitIds` / `zeroContribution`) + `CONTRIBUTION_QUALITY_TITLE_FLOOR` 휴리스틱 임계.
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) — `applyContributionQualityFloor(entries: ContributionQualityAdjustEntry[], signal): ContributionQualityAdjustEntry[]` signature + `ContributionQualityAdjustEntry { author, result }` shape + `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"` 단조 하한 + throw 0 흡수 정책.
- [docs/tasks/T-0526-evaluation-orchestrator-update-count-wiring.md](T-0526-evaluation-orchestrator-update-count-wiring.md) — mirror 원형(배선 순서·실패 격리·비변형·결정성·교차 단위 spec 박제). 본 task 는 R-41 update-count 중립 net 0 대신 R-37/R-38 contribution floor 강등 의미로 동형 배선.
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §1/§2/§3/§4 — compose 순서 박제 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- `EvaluationOrchestratorService.evaluateActivities` 의 기존 abuse + update-count 배선과 동형으로 contribution-quality 배선을 끼운다. 신규 알고리즘 0 — 두 순수 helper 의 compose 만.
- 배선 순서(권장 v1, 결정적 — update-count 배선과 동형):
  1. 기존: `inputs = activities.map(mapActivityToEvaluationInput)` (§1)
  2. 기존: `deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` (§4 dedup)
  3. 기존: `signal = computeAbuseSignal(deduped)` (R-26/R-40 detection)
  4. 기존: `neutralization = computeUpdateCountNeutralization(deduped)` (R-41 detection)
  5. **신규**: `qualitySignal = computeContributionQualitySignal(deduped)` — dedup 후 입력에 대한 R-37/R-38 detection(중복 부풀림 제거 후 titleLength 휴리스틱으로 zero-contribution 후보 식별). LLM 무관 결정적 순수 helper.
  6. 기존: 단위별 순차 `scoreUnit(input, options)` → `EvaluationResult[]` 수집(§2)
  7. 기존: `abuseAdjusted = applyAbuseSignalToVolume(entries, signal)` (abuse 감점)
  8. 기존: `updateCountAdjusted = applyUpdateCountNeutralizationToVolume(entries2, neutralization).map(e => e.result)` 후 다시 entries 재조립 — 단, 본 task 에서는 6→7→8 후 quality 배선까지 가야 하므로 entries 보존을 재구조화 (mid-pipe 에서 `.map(e => e.result)` flatten 을 미루고 마지막 단계에만 flatten).
  9. **신규**: update-count adjust 산출물 (entries 형태) 을 그대로 받아 `applyContributionQualityFloor(entries3, qualitySignal)` 로 zero-contribution 대상 단위의 `contribution` 을 `"zero"` 로 결정적 floor 강등해 최종 반환 (마지막에 `.map(e => e.result)` flatten).
- **적용 순서 결정(구현자 재량, 권장 v1)**: abuse 감점(volume) → update-count 중립(volume) → contribution-quality floor(contribution) 순서를 권장한다. 근거 — 앞 두 배선은 `volume` 필드 (정량 수치) 를 다루고 본 배선은 `contribution` 필드 (품질 등급 enum) 를 다뤄 **필드 직교** 라 적용 순서가 결과에 무관하지만, 결정성과 spec 명료성을 위해 v1 순서 고정. 한 단위가 동시에 abuse suspected + update-count 중립 + contribution-quality floor 대상인 교차 경우의 결과 (volume 감점·중립 + contribution "zero" 강등) 를 spec 으로 명시 박제하면 충분 — 교차 우선순위 튜닝은 Follow-ups.
- 빈 입력 경계: `deduped` 가 빈 배열이면 `computeContributionQualitySignal([])` 가 빈 신호(throw 0), `applyContributionQualityFloor([], qualitySignal)` 가 빈 배열 — 기존 빈 입력 동작(빈 `EvaluationResult[]`) 보존.
- 실패 격리(§2): scoring reject 는 기존대로 await 전파. 세 adjust(abuse + update-count + contribution-quality) 는 scoring 전량 성공 후에만 실행 — 부분 결과 위장 0 정합.
- 비변형: 세 helper 모두 입력 비변형이라 `deduped` / `results` / 두 adjust 산출물이 후속 호출에서도 안전. orchestrator 자체도 부수효과 0 유지.
- import 추가: `computeContributionQualitySignal` from `./domain/evaluation-quality-signal`, `applyContributionQualityFloor` from `./domain/evaluation-quality-adjust`. 새 외부 dep 0, 새 ADR 0 (ADR-0032 §3 정신 그대로).
- 파일 머리 주석의 흐름 박제(현재 6 단계 — abuse + update-count)를 contribution-quality 배선 반영해 갱신(detection/소비 단계 추가). 파일 머리 주석의 "abuse / update-count 배선 박제(T-0523/T-0526, ADR-0032 §3 정신)" 단락도 contribution-quality 포함으로 동기.

## Acceptance Criteria

- [ ] `EvaluationOrchestratorService.evaluateActivities` 가 dedup 후 `computeContributionQualitySignal(deduped)` 를 호출하고, scoring + abuse adjust + update-count adjust 완료 후 `applyContributionQualityFloor(entries, qualitySignal)` 로 zero-contribution 대상 단위의 `contribution` 을 `"zero"` 로 결정적 floor 강등해 최종 결과 반환. 새 알고리즘 0 (두 helper 의 compose 만, 기존 두 배선 보존).
- [ ] **Happy-path test 1+**: contribution-quality 신호에서 zeroContribution=true 로 식별된 author/unit 의 단위 `contribution` 이 결정적으로 `"zero"` 로 강등되고 (mock scoreUnit 이 "high" 로 매겨도 floor 강등), 비대상 author/unit 의 단위 `contribution` 이 mock scoreUnit 반환값 그대로 보존됨을 단언하는 compose 검증 test 각 1+ (mock scoreUnit 으로 scoring 결과 + 입력 `metadata.titleLength` 를 통제해 입출력 비교).
- [ ] **Error path test 1+**: scoring reject 시 세 adjust(abuse + update-count + contribution-quality) 가 호출되지 않고 error 가 전파됨(§2 실패 격리 유지) 단언 + 입력 `activities` 가 빈 배열일 때 빈 `EvaluationResult[]` 반환 단언.
- [ ] **Flow / branch coverage** (각 분기 1+ test): (a) contribution-quality 대상 + 비대상 혼합 batch 분기, (b) 전 단위 비대상(titleLength > 임계)인 batch 분기(전 단위 contribution 무변경), (c) dedup 으로 일부 제거된 batch (detection 이 dedup 후 입력 위에서 동작 확인), (d) `metadata.titleLength` 경계(임계값 정확히 / 임계+1 / 누락) 동작.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `activities` 배열, (ii) 단일 author 단일 단위(비대상), (iii) 동일 author 다수 단위(일부만 contribution-quality 대상 — 부분 적용 정합), (iv) 대상 단위의 contribution 이 이미 `"zero"` 인 경우(멱등 동작), (v) titleLength 가 비-number/누락/Infinity layer 경계, (vi) scoring 결과 순서와 entries 순서 정합 단언(매핑 misalignment 회귀 방어). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **3 배선 공존 단언**: 기존 abuse 감점 + update-count 중립 배선이 보존되고(회귀 0), 세 배선이 함께 동작하는 batch (한 단위는 abuse suspected, 다른 단위는 update-count 중립 대상, 또 다른 단위는 contribution-quality floor 대상) 의 결정적 결과를 단언. 한 단위가 동시에 세 배선 모두 대상인 교차 경우의 결과 (volume 감점·중립 + contribution "zero") 도 spec 으로 명시 박제.
- [ ] **결정성 단언**: 동일 입력으로 2회 `evaluateActivities` 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic adjust 확인).
- [ ] **비변형 단언**: 입력 `activities` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-orchestrator.service.ts` line ≥ 80% AND function ≥ 80% (배선만이라 100% 목표 권장). 전체 jest green.

## Out of Scope

- `computeContributionQualitySignal` / `applyContributionQualityFloor` 의 알고리즘 변경 0 (본 task 는 배선만 — `CONTRIBUTION_QUALITY_TITLE_FLOOR` / `CONTRIBUTION_QUALITY_FLOOR_LEVEL` 튜닝은 별도 task).
- abuse 배선(`computeAbuseSignal` / `applyAbuseSignalToVolume`) / update-count 배선(`computeUpdateCountNeutralization` / `applyUpdateCountNeutralizationToVolume`) 의 알고리즘 / 순서 변경 0 — 기존 두 배선은 보존만, contribution-quality 배선을 옆에 추가.
- abuse suspected ∩ update-count 중립 ∩ contribution-quality floor 교차 단위의 우선순위 정책 튜닝(본 v1 은 적용 순서 결과를 spec 으로 박제만 — 필드 직교라 순서 무관하지만 명시) — 별도 task.
- contribution **상향**(R-37 후반 "새 알고리즘 설계·외부 연구 도입 = high") 의 식별/적용 0 — 본 배선은 zero-contribution **하한** floor 강등만(상향은 LLM 정성 평가 영역 + 별도 task).
- `EvaluationScoringService.scoreUnit` 변경 0 (단위 scoring 의 입력/출력 contract 유지).
- `ContributionQualitySignal` / `ContributionQualityAdjustEntry` / `EvaluationResult` / `EvaluationInput` / `ContributionLevel` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0 (in-memory orchestrator 만).
- LLM gateway 호출 변경 0 (detection·adjust 둘 다 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) abuse suspected ∩ update-count 중립 ∩ contribution-quality floor 교차 단위 우선순위 정책 — 세 신호가 한 단위에 동시 작용할 때 net 결과 규칙 명문화(실 data 관측 후 별도 task — 필드 직교라 본 v1 은 spec 박제만).
- (예정) R-37 후반 high-contribution 상향 식별(새 알고리즘·외부 연구 도입 소개자료) — LLM 정성 평가 보강 영역, 별도 task.
- (예정) contribution-quality 신호의 evaluation 결과 영속화 — Assessment row 의 floor 강등 메모/근거 필드 (§5 schema 게이트 사람 결정 후).
- (예정) `CONTRIBUTION_QUALITY_TITLE_FLOOR` (현 v1=1) tuning — 임계 calibration 은 실 data 관측 후 별도 task.

---
id: T-0535
title: EvaluationOrchestratorService 에 중요·어려운 기여 narrative annotation 소비 배선 (computeNotableContributionSignal→applyNotableContributionAnnotation)
phase: P5
status: DONE
mergedAs: 6095cb6
prNumber: 449
reviewRounds: 1
completedAt: 2026-06-19T21:58:00Z
commitMode: pr
coversReq: [REQ-011]
dependsOn: [T-0533, T-0534]
independentStream: p5-evaluation-notable-contribution
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
plannerNote: P5 bullet 104(R-25/REQ-011 중요·어려운 기여 식별) — T-0533 detection + T-0534 소비 helper 를 orchestrator 에 실배선(impure service-layer), T-0532 mirror, pr ~240 LOC 2 파일
---

# T-0535 — EvaluationOrchestratorService 에 중요·어려운 기여 narrative annotation 소비 배선

## Why

[docs/PLAN.md](../PLAN.md) Phase P5 bullet 104 (R-25 / REQ-011: "중요·어려운 기여 → 높은 점수 — 어렵고 남이 못할 일") 의 마무리 조각이다. T-0533 (`computeNotableContributionSignal`, merge ee1ef0b — detection layer, author 별 code 단위 수를 batch 동료 평균 대비 `NOTABLE_RELATIVE_CEILING` 상대 비교로 중요·어려운 기여 식별) 과 T-0534 (`applyNotableContributionAnnotation`, merge 1479bc3 — 소비 helper, notable author 의 모든 단위 `result.narrative` 앞에 표준 한국어 marker `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER` 결정적 접두) 가 박제됐으나 둘 다 domain 순수 helper 일 뿐 실 evaluation 흐름에 import 0 — `git grep -lE "computeNotableContributionSignal|applyNotableContributionAnnotation" origin/main -- src/assessment-evaluation/evaluation-orchestrator.service.ts` 0 매칭(issue-still-relevant pre-check 통과, main 미배선). 본 task 는 T-0532 (저성과자 narrative annotation orchestrator 배선) 의 **충실한 대칭(inverse) mirror** — 검증된 두 순수 helper(detection + 소비) 를 `EvaluationOrchestratorService.evaluateActivities` 에 compose 한다. 새 알고리즘 0 — 저성과(underPerformer) 배선이 박제한 자리에 중요기여(notable) 배선을 동형으로 끼우는 것만 담당한다. ADR-0032 §3 정신(결정적, LLM 무관) 정합. 본 배선으로 R-25 중요·어려운 기여 layer 가 detection → consume → orchestrator 3-slice 패턴(abuse: T-0521→T-0522→T-0523, update-count: T-0524→T-0525→T-0526, contribution-quality: T-0527→T-0528→T-0529, underperformer: T-0530→T-0531→T-0532, notable: T-0533→T-0534→**T-0535**)으로 완결된다.

## Required Reading

- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — 현 compose 흐름 (정규화 → dedup 2 종 → abuse detection → update-count detection → contribution-quality detection → underperformer detection → 단위별 scoreUnit → abuse adjust → update-count adjust → contribution-quality floor → underperformer annotation). 네 detection 은 dedup 직후, 네 adjust 는 scoring 성공 후 entries 연쇄(mid-pipe flatten 미루기 — 마지막 `.map((e) => e.result)`). 본 task 의 notable 배선을 끼울 자리(underperformer detection 옆 / underperformer annotation 옆). T-0523/T-0526/T-0529/T-0532 가 박제한 네 배선 패턴이 본 task 의 mirror 원형.
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — colocated spec. T-0523/T-0526/T-0529/T-0532 이 추가한 네 배선의 R-112 cover 패턴(mock scoreUnit 주입 + 매핑·dedup·순서·error 전파 검증). 본 task 의 신규 test 도 같은 패턴 mirror.
- [src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts) — `computeNotableContributionSignal(inputs: EvaluationInput[]): NotableContributionSignal` 입력/출력 shape + `NotableContributionEntry` (author / `codeUnitCount` / `notable`) + `NotableContributionSignal` (`totalAuthorCount` / `meanCodeUnitCount` / `byAuthor` / `notableDetected`) + `NOTABLE_RELATIVE_CEILING` 임계. **author-level 판정** — unitId 목록 없음에 유의.
- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) — `applyNotableContributionAnnotation(entries: NotableContributionAdjustEntry[], signal: NotableContributionSignal): NotableContributionAdjustEntry[]` signature + `NotableContributionAdjustEntry { author, result }` shape + `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER = "[중요기여] "` 비파괴·멱등·단조(상향 marker) 접두 + throw 0 흡수 정책(명시적 null/undefined 만 한국어 TypeError).
- [docs/tasks/T-0532-evaluation-orchestrator-underperformer-wiring.md](T-0532-evaluation-orchestrator-underperformer-wiring.md) — 직접 mirror 원형(배선 순서·실패 격리·비변형·결정성·교차 단위 spec 박제). 본 task 는 R-27 저성과자 narrative annotation 대신 R-25 중요·어려운 기여 narrative annotation 의미로 동형 배선(저성과 marker → 중요기여 marker, 단조 하한 → 단조 상향).
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §1/§2/§3/§4 — compose 순서 박제 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- `EvaluationOrchestratorService.evaluateActivities` 의 기존 abuse + update-count + contribution-quality + underperformer 배선과 동형으로 notable 배선을 끼운다. 신규 알고리즘 0 — 두 순수 helper 의 compose 만.
- 배선 순서(권장 v1, 결정적 — underperformer 배선과 동형):
  1. 기존: `inputs = activities.map(mapActivityToEvaluationInput)` (§1)
  2. 기존: `deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` (§4 dedup)
  3. 기존: `signal = computeAbuseSignal(deduped)` (R-26/R-40 detection)
  4. 기존: `neutralization = computeUpdateCountNeutralization(deduped)` (R-41 detection)
  5. 기존: `qualitySignal = computeContributionQualitySignal(deduped)` (R-37/R-38 detection)
  6. 기존: `underPerformerSignal = computeUnderPerformerSignal(deduped)` (R-27 detection)
  7. **신규**: `notableContributionSignal = computeNotableContributionSignal(deduped)` — dedup 후 입력에 대한 R-25 detection(중복 부풀림 제거 후 author 별 code 단위 수를 동료 평균 대비 상대 비교로 중요·어려운 기여 식별). LLM 무관 결정적 순수 helper. 빈 deduped → 빈 신호(throw 0).
  8. 기존: 단위별 순차 `scoreUnit(input, options)` → `EvaluationResult[]` 수집(§2)
  9. 기존: abuse adjust → update-count adjust → contribution-quality floor → underperformer annotation 를 entries 형태로 연쇄(mid-pipe flatten 미루기).
  10. **신규**: underperformer annotation 산출물(entries 형태)을 그대로 받아 `applyNotableContributionAnnotation(entries5, notableContributionSignal)` 로 notable author 의 모든 단위 `narrative` 앞에 marker 를 결정적으로 접두한 뒤 마지막에 `.map((e) => e.result)` flatten 해 최종 반환(R-25 v1).
- **적용 순서 결정(구현자 재량, 권장 v1)**: abuse 감점(volume) → update-count 중립(volume) → contribution-quality floor(contribution) → underperformer annotation(narrative — 단조 하한 marker) → notable annotation(narrative — 단조 상향 marker) 순서를 권장한다. 근거 — 앞 셋은 각각 `volume` / `contribution` 필드를 다루고, underperformer/notable 두 배선은 **같은 `narrative` 필드** 를 다루지만 marker 가 서로 다른 접두(`[저성과자] ` / `[중요기여] `)라 한 author 가 동시에 underperformer 와 notable 일 수 없는 의미(저성과↔중요기여 inverse)인 한 적용 순서가 결과에 무관하다. 결정성과 spec 명료성을 위해 v1 순서 고정 — underperformer 먼저, notable 다음.
- **edge: 동일 author 에 underperformer + notable 동시 적용 시나리오**: T-0530 (`UNDERPERFORMER_RELATIVE_FLOOR=0.5`)과 T-0533 (`NOTABLE_RELATIVE_CEILING=1.5`) 의 임계 분리로 한 author 가 동시에 둘 다 일 수 없다(평균 × 0.5 ↓ vs 평균 × 1.5 ↑ 는 disjoint). 단 실 입력 데이터 / 미래 임계 변화로 일어날 경우의 결과는 두 marker 모두 narrative 앞에 접두된 형태(underperformer 먼저 적용 후 notable 추가 접두, 순서대로) 가 v1 spec — 별도 정책 결정 없이 적용 순서 그대로 박제하고 그 결과를 test 로 명시 단언. 향후 정책 튜닝은 Follow-ups.
- **author-level 전파 유의**: T-0533 신호는 unitId 목록이 없는 **author-level 판정**(`byAuthor[*].notable`)이다. T-0534 helper 가 이미 author 매칭으로 그 author 의 **모든** 단위를 annotation 하므로, 본 배선은 underperformer 배선과 동일한 `entries` (`deduped[i].author` + `results[i]` 짝) 를 그대로 넘기면 된다. 새 매핑 0.
- 빈 입력 경계: `deduped` 가 빈 배열이면 `computeNotableContributionSignal([])` 가 빈 신호(throw 0), `applyNotableContributionAnnotation([], notableContributionSignal)` 가 빈 배열 — 기존 빈 입력 동작(빈 `EvaluationResult[]`) 보존.
- 실패 격리(§2): scoring reject 는 기존대로 await 전파. 다섯 adjust(abuse + update-count + contribution-quality + underperformer + notable) 는 scoring 전량 성공 후에만 실행 — 부분 결과 위장 0 정합.
- 비변형: 다섯 helper 모두 입력 비변형이라 `deduped` / `results` / 네 adjust 산출물이 후속 호출에서도 안전. orchestrator 자체도 부수효과 0 유지.
- import 추가: `computeNotableContributionSignal` from `./domain/evaluation-notable-contribution-signal`, `applyNotableContributionAnnotation` from `./domain/evaluation-notable-contribution-adjust`. 새 외부 dep 0, 새 ADR 0 (ADR-0032 §3 정신 그대로).
- 파일 머리 주석의 흐름 박제(현재 underperformer 까지 — 네 detection / 네 adjust)를 notable 배선 반영해 갱신(다섯 번째 detection/소비 단계 추가). 파일 머리 주석의 "abuse / update-count / contribution-quality / underperformer 배선 박제(T-0523/T-0526/T-0529/T-0532, ADR-0032 §3 정신)" 단락도 notable 포함으로 동기.

## Acceptance Criteria

- [ ] `EvaluationOrchestratorService.evaluateActivities` 가 dedup 후 `computeNotableContributionSignal(deduped)` 를 호출하고, scoring + abuse adjust + update-count adjust + contribution-quality floor + underperformer annotation 완료 후 `applyNotableContributionAnnotation(entries, notableContributionSignal)` 로 notable author 의 모든 단위 `narrative` 앞에 marker 를 결정적으로 접두해 최종 결과 반환. 새 알고리즘 0 (두 helper 의 compose 만, 기존 네 배선 보존).
- [ ] **Happy-path test 1+**: notable 신호에서 notable=true 로 식별된 author 의 모든 단위 `narrative` 가 `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER` 접두로 시작하고(mock scoreUnit 이 임의 narrative 를 반환해도 marker 접두), 비대상 author 의 단위 `narrative` 가 mock scoreUnit 반환값 그대로(혹은 underperformer marker 만 접두된 형태) 보존됨을 단언하는 compose 검증 test 각 1+ (mock scoreUnit 으로 scoring 결과 + 입력 `contributionKind`/code 단위 수를 통제해 중요기여 식별을 유발).
- [ ] **Error path test 1+**: scoring reject 시 다섯 adjust(abuse + update-count + contribution-quality + underperformer + notable) 가 호출되지 않고 error 가 전파됨(§2 실패 격리 유지) 단언 + 입력 `activities` 가 빈 배열일 때 빈 `EvaluationResult[]` 반환 단언.
- [ ] **Flow / branch coverage** (각 분기 1+ test): (a) notable 대상 + 비대상 author 혼합 batch 분기, (b) 전 author 비대상(notable 미식별)인 batch 분기(전 단위 narrative 무변경 또는 underperformer marker 만 잔존), (c) dedup 으로 일부 제거된 batch (detection 이 dedup 후 입력 위에서 동작 확인 — code 단위 수가 dedup 으로 줄어 식별에 반영), (d) 단독 author / 동률 / 평균 0 경계(T-0533 보수적 notable=false 동작이 orchestrator 에서 무변경으로 흡수되는지).
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 `activities` 배열, (ii) 단일 author 단일 단위(비대상 — 동료 부재), (iii) 동일 author 다수 단위(notable 식별 시 그 author 의 **모든** 단위가 일관 marker 접두 — author-level 전파 정합), (iv) 대상 author 의 narrative 가 이미 marker 접두인 경우(멱등 — 중복 접두 0), (v) 빈 narrative("") 단위가 notable 대상일 때도 marker 만 접두(본문 손상 없음), (vi) scoring 결과 순서와 entries 순서 정합 단언(매핑 misalignment 회귀 방어). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **5 배선 공존 단언**: 기존 abuse 감점 + update-count 중립 + contribution-quality floor + underperformer annotation 배선이 보존되고(회귀 0), 다섯 배선이 함께 동작하는 batch (한 단위는 abuse suspected, 다른 단위는 update-count 중립 대상, 또 다른 단위는 contribution-quality floor 대상, 저성과 author 단위는 underperformer marker 대상, notable author 단위는 notable marker 대상) 의 결정적 결과를 단언. underperformer 와 notable 두 marker 의 임계 분리(0.5↓ vs 1.5↑) 로 한 author 가 동시 적용은 일반적으로 불가하지만, edge case 로 발생 시 v1 적용 순서대로 두 marker 가 narrative 앞에 순차 접두되는 결과(underperformer 먼저, notable 다음)도 spec 으로 명시 박제.
- [ ] **결정성 단언**: 동일 입력으로 2회 `evaluateActivities` 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic adjust 확인 — marker 도 2 회 적용해 1 회만 남는 멱등 포함).
- [ ] **비변형 단언**: 입력 `activities` 가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — `evaluation-orchestrator.service.ts` line ≥ 80% AND function ≥ 80% (배선만이라 100% 목표 권장). 전체 jest green.

## Out of Scope

- `computeNotableContributionSignal` / `applyNotableContributionAnnotation` 의 알고리즘 변경 0 (본 task 는 배선만 — `NOTABLE_RELATIVE_CEILING` / `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER` 튜닝은 별도 task).
- abuse 배선 / update-count 배선 / contribution-quality 배선 / underperformer 배선의 알고리즘 / 순서 변경 0 — 기존 네 배선은 보존만, notable 배선을 옆에 추가.
- abuse suspected ∩ update-count 중립 ∩ contribution-quality floor ∩ underperformer ∩ notable 교차 단위의 우선순위 정책 튜닝(본 v1 은 적용 순서 결과를 spec 으로 박제만 — underperformer/notable 두 narrative marker 의 임계 분리로 일반적 동시 적용 불가하나 edge case 결과만 명시) — 별도 task.
- 중요기여 사실의 scoring 반영(가중치/가점) 0 — 본 배선은 narrative 외화 marker 만(R-25 "높은 점수" 의 점수 영향은 별도 task).
- author-level 판정을 unit-level 로 세분화(특정 단위만 annotation)하는 것 0 — T-0533 신호가 author-level 이므로 본 배선도 author 단위로 전파한다. unit 차원 enrich 는 detection layer Follow-up.
- `EvaluationScoringService.scoreUnit` 변경 0 (단위 scoring 의 입력/출력 contract 유지).
- `NotableContributionSignal` / `NotableContributionAdjustEntry` / `EvaluationResult` / `EvaluationInput` 타입 자체 변경 0.
- controller / DTO / endpoint / persistence / Prisma migration 변경 0 (in-memory orchestrator 만).
- LLM gateway 호출 변경 0 (detection·adjust 둘 다 deterministic, LLM 무관).
- 새 외부 dep / 새 ADR / 새 module provider 변경 0 (ADR-0032 §3 정신 그대로).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) abuse suspected ∩ update-count 중립 ∩ contribution-quality floor ∩ underperformer ∩ notable 교차 단위 우선순위 정책 — 다섯 신호가 한 단위에 동시 작용할 때 net 결과 규칙 명문화(실 data 관측 후 별도 task — 특히 underperformer/notable 두 narrative marker 의 의미 충돌 edge case).
- (예정) 중요기여 사실의 scoring 반영(가중치/가점) — 본 배선은 narrative 외화 marker 만, R-25 "높은 점수" 의 점수 영향은 별도 task 검토.
- (예정) notable detection 의 metadata enrich(난이도 메타·변경 라인 수 등 가중 신호) 후 unit-level 세분화 — "남이 못할 일" 의미 강화(detection layer Follow-up, T-0533 산출 §보수성 원칙 참조).
- (예정) notable 신호의 evaluation 결과 영속화 — Assessment row 의 중요기여 marker/근거 필드 (§5 schema 게이트 사람 결정 후).
- (예정) `NOTABLE_RELATIVE_CEILING` (현 v1=1.5) tuning — 임계 calibration 은 실 data 관측 후 별도 task.

---
id: T-0527
title: 기여 품질 분류 detection 순수 helper computeContributionQualitySignal 추가 (R-37/R-38 zero-contribution 식별)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: p5-evaluation-quality-class
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-quality-signal.ts
  - src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 103(R-37/R-38 품질 분류) detection slice — zero-contribution 결정적 식별 순수 helper, abuse-signal mirror, pr, ~240 LOC 2 파일 disjoint
---

# T-0527 — 기여 품질 분류 detection 순수 helper computeContributionQualitySignal 추가

## Why

[docs/PLAN.md](../PLAN.md) P5 bullet 103 (R-37 / R-38: "단순 보고·copy-paste 로그 = zero-contribution / 새 알고리즘 설계·외부 연구 도입 소개자료 = 높은 contribution") 의 첫 dependency-free 조각이다. 현재 `EvaluationResult.contribution`(ContributionLevel = zero/low/medium/high, [evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) L24~31 박제) 은 **LLM 정성 평가** 결과로만 채워진다(evaluation-prompt.ts 의 `contribution:` marker 파싱). 그러나 R-37 의 "단순 보고·copy-paste 로그 = zero-contribution" 은 LLM 환각·관대 평가에 좌우되면 안 되는 **결정적 하한(floor) 신호** — metadata 휴리스틱으로 식별 가능한 zero-contribution 후보를 LLM 무관하게 deterministic 하게 잡아내는 방어선이 필요하다.

본 task 는 그 detection layer 만 담당한다 — `computeContributionQualitySignal(inputs: EvaluationInput[]): ContributionQualitySignal` 순수 helper 를 신설해 단위별 zero-contribution 후보를 결정적으로 식별한다. 검증된 detection→consume→orchestrator 3-slice 패턴([computeAbuseSignal](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) R-26/R-40 + [computeUpdateCountNeutralization](../../src/assessment-evaluation/domain/evaluation-update-count-neutral.ts) R-41) 의 detection slice 를 충실히 mirror 한다. `git grep -E "computeContributionQualitySignal|ContributionQualitySignal" origin/main src/` 0 매칭 — issue-still-relevant pre-check 통과. ADR-0032 §3 정신(품질 분류축은 별도 신호로 분리) 정합.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-update-count-neutral.ts](../../src/assessment-evaluation/domain/evaluation-update-count-neutral.ts) — mirror 원형(순수 함수 + author 그룹핑 + 최초 등장 순서 보존 결정성 + 입력 비변형 + Map 누적 + 임계 상수 + 비유한 number 방어 + detection-only 책임 경계). 본 task 의 구조를 거의 동형으로 따른다(neutralized 자리를 zeroContribution 으로 대체).
- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) — 형제 detection helper(R-26/R-40). 신호 산출 패턴·타입 shape 참조.
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `ContributionLevel`("zero"/"low"/"medium"/"high") union + L24~31 등급 의미 박제. 본 helper 의 zero-contribution 식별이 향후 이 union 의 "zero" 하한과 연결됨(소비는 별도 task).
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput` shape(`unitId`/`contributionKind`/`author`/`metadata`). metadata 가 scalar-only typed surface(REQ-032 raw 미보유) 임을 확인 — 휴리스틱은 raw 본문이 아닌 typed metadata 신호만 사용.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) — `ActivityMetadata` 의 실 필드 목록(휴리스틱이 참조할 수 있는 scalar 신호 확인 — title 길이·변경 라인 수 등 존재 여부 점검 후 사용 가능한 것만 채택).
- [docs/decisions/ADR-0032-evaluation-pipeline-input-and-batch.md](../decisions/ADR-0032-evaluation-pipeline-input-and-batch.md) §3 — 품질 분류축이 LLM 정성 + 결정적 신호로 분리되는 근거.

## 설계 의도 (구현자 가이드, 자유 재량 여지 있음)

- 신규 파일 `src/assessment-evaluation/domain/evaluation-quality-signal.ts` 에 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, throw 0(명시적 null/undefined 계약 위반 외), 부수효과 0(referential transparency, 입력 비변형). 동일 입력 → 항상 동일 출력.
- 산출 타입(권장 shape — 자유 재량):
  - `ContributionQualityEntry { author: string; zeroContributionCount: number; zeroContributionUnitIds: string[]; zeroContribution: boolean }` (author 별 집계).
  - `ContributionQualitySignal { totalUnitCount: number; totalZeroContributionCount: number; byAuthor: ContributionQualityEntry[]; zeroContributionDetected: boolean }` (batch 차원).
- **휴리스틱 결정(구현자 재량, 권장 v1, 보수적)**: zero-contribution 후보는 **명백히 기계적인 신호** 만으로 식별한다 — false-positive 가 실 기여를 zero 로 깎는 위험이 크므로 보수적으로. 권장 v1 후보(metadata 실 필드 확인 후 가용한 것만 채택):
  - (a) 변경 규모가 0 또는 trivial(예: 변경 라인/추가량 0, 또는 title 만 있고 본문 신호 부재) — copy-paste/단순 보고의 metadata 흔적.
  - (b) Required Reading 의 `ActivityMetadata` 에 위 신호가 없으면, 가용한 가장 보수적인 scalar 신호 1~2 종으로 한정(휴리스틱 과확장 금지 — Out of Scope). 사용 가능한 신호가 사실상 없으면 helper 는 "신호 0(모두 비대상)" 을 결정적으로 반환하고, 그 한계를 파일 머리 주석에 명문화(향후 metadata enrich 후 휴리스틱 강화는 Follow-up).
- 임계/상수는 named const 로 single-source(예: `CONTRIBUTION_QUALITY_*` 상수) + JSDoc 으로 v1 baseline 근거 명문화 — dogfood 실측 후 조정 가능(LLM 무관 deterministic).
- author 그룹핑은 최초 등장 순서 보존(Map 누적), unitIds 도 입력 등장 순서 보존(결정성). update-count-neutral helper 와 동형.
- 비유한 number(NaN/Infinity) / 누락 metadata 필드 / 빈 입력 배열 layer 경계 방어 — throw 없이 흡수(비대상 분류).
- **detection-only 책임 경계**: 본 helper 는 신호만 산출한다. zero-contribution 단위의 `contribution` 하한 적용(LLM 산출이 zero 보다 높게 나와도 floor 로 강등) / orchestrator 배선은 후속 task(T-0522/T-0523, T-0525/T-0526 가 abuse·update-count 에 했던 consume·wiring 패턴 mirror). 본 task 에서 `EvaluationResult`/`EvaluationInput`/`ContributionLevel` 타입 변경 0, orchestrator/scoring service 변경 0.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-quality-signal.ts` 신설 — `computeContributionQualitySignal(inputs: EvaluationInput[]): ContributionQualitySignal` 순수 함수 + 산출 타입 export. 의존성 0(NestJS/Prisma/LLM import 0), 입력 비변형, throw 0(계약 위반 외).
- [ ] **Happy-path test 1+**: zero-contribution 휴리스틱에 해당하는 단위가 `zeroContribution`/`zeroContributionUnitIds` 에 결정적으로 식별되고, 정상 기여 단위는 비대상으로 분류됨을 단언하는 test 각 1+.
- [ ] **Error path test 1+**: `null`/`undefined` 입력 시 명시적 계약(throw 또는 명세된 방어 동작) 단언 + 빈 배열 입력 시 빈 신호(`totalUnitCount=0`, `byAuthor=[]`, `zeroContributionDetected=false`) 반환 단언.
- [ ] **Flow / branch coverage**: (a) 전 단위 zero-contribution 대상 batch, (b) 전 단위 비대상 batch, (c) 혼합 batch(일부만 대상 — 부분 식별 정합), (d) 휴리스틱 경계값(임계 정확히 / 임계-1 / 임계+1, 또는 채택한 신호의 경계) 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (i) 빈 입력 배열, (ii) 단일 author 단일 단위, (iii) 동일 author 다수 단위(일부만 대상 — 부분 집계 정합), (iv) metadata 의 휴리스틱 필드 누락/비-number/NaN/Infinity layer 경계(throw 없이 비대상 흡수), (v) 동일 unitId 중복 등장 시 결정적 처리, (vi) author 별 집계가 입력 최초 등장 순서를 보존함(정렬 안정성 회귀 방어). 단일 negative 만으로 부족 — 각 예외 분기마다 cover.
- [ ] **결정성 단언**: 동일 입력으로 2회 호출이 동일 출력(`toEqual`) 임을 단언(LLM 무관 deterministic 확인).
- [ ] **비변형 단언**: 입력 배열/원소가 호출 후 변경되지 않음(deep-equal 또는 freeze 입력 통과).
- [ ] colocated spec `src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts` 에 위 test 박제(NestJS convention + discoverability).
- [ ] `pnpm lint && pnpm build` 통과 (clean).
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% AND function ≥ 80% (순수 helper 라 100% 목표 권장). 전체 jest green.

## Out of Scope

- zero-contribution 신호의 **소비**(LLM 산출 `contribution` 을 zero 로 floor 강등) — 별도 후속 task(T-0525 가 update-count 에 했던 consume helper 패턴 mirror).
- `EvaluationOrchestratorService` / `EvaluationScoringService` 배선 변경 0 — 본 task 는 detection helper 만(T-0526 가 한 orchestrator 배선은 후속 task).
- `EvaluationResult` / `EvaluationInput` / `ContributionLevel` 타입 자체 변경 0.
- 높은 contribution(R-37 후반 "새 알고리즘 설계·외부 연구 도입 = high") 의 **상향** 식별 — 본 task 는 zero-contribution **하한** 식별만(상향은 LLM 정성 평가 영역 + 별도 task).
- 휴리스틱 과확장 — 권장 v1 보수적 신호 1~2 종만. 신호 calibration/추가 휴리스틱은 dogfood 실측 후 별도 task(Follow-ups).
- abuse(R-26/R-40) / update-count(R-41) detection helper 변경 0 — 형제 신호 보존.
- controller / DTO / endpoint / persistence / Prisma migration / LLM gateway 변경 0.
- 새 외부 dep / 새 ADR / 새 module provider 변경 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (예정) zero-contribution 신호 소비 helper — LLM 산출 `contribution` 이 신호 대상 단위에서 zero 로 floor 강등되는 순수 consume helper(T-0525 mirror).
- (예정) zero-contribution 소비 helper 의 EvaluationOrchestratorService 배선(T-0526 mirror).
- (예정) 휴리스틱 v1 baseline calibration — 채택 신호/임계의 실 data 관측 후 tuning(별도 task).
- (예정) ActivityMetadata enrich 후 휴리스틱 강화 — copy-paste/단순 보고의 추가 결정적 신호 도입 가능성 검토.
- (예정) R-37 후반 high-contribution 상향 식별(새 알고리즘/외부 연구 도입) — LLM 정성 평가 보강 영역, 별도 task.

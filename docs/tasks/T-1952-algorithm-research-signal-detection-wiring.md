---
id: T-1952
title: 알고리즘·연구 소개 detection 신호를 signals container 7 번째 필드로 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-019]
estimatedDiff: 210
estimatedFiles: 5
created: 2026-09-07
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1951]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
plannerNote: "P5 · ADR-0064 § Follow-ups (b) 잔여 — T-1951 detection helper 의 소비처 배선(6 신호 → 7 신호), T-1924 5 파일 구조 mirror"
---

# T-1952 — 알고리즘·연구 소개 detection 신호를 signals container 7 번째 필드로 배선

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (b)` 의 **잔여 절반**(소비처 배선)이다. 직전 slice T-1951 이 detection helper `computeAlgorithmResearchSignal` 을 신설했지만 **호출자가 0** 이라, 현재 그 helper 는 spec 에서만 실행되고 실제 평가 파이프라인에는 참여하지 못한다. 본 slice 가 detection composer 에 7 번째 위임을 붙여 신호를 실제 흐름에 올리고, 그다음 `§ Follow-ups (c)` 의 uplift adjuster 가 그 신호를 소비해 R-38 상향([requirements.md](../requirements.md) `38 행` REQ-019 `IN_PROGRESS`)을 닫는다.

**issue-still-relevant pre-check (origin/main `3716682c` 실측)** — 배선 안착 **0** 확인:

- `git grep -i "algorithmResearch" origin/main -- src/assessment-evaluation` → 매칭이 전부 `evaluation-algorithm-research-signal.ts` / `.spec.ts` **2 파일 안에만** 존재. pipeline · orchestrator 어느 파일에도 매칭 **0** → 소비자 0 이 실측으로 확정.
- container [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `131~146 행` `EvaluationAdjustmentSignals` 는 여전히 6 필드(`abuse` / `updateCount` / `quality` / `underPerformer` / `notableContribution` / `documentContribution`)뿐이다.
- composer [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `114~122 행` `computeEvaluationAdjustmentSignals` 의 return 도 위임 **6 개**뿐이다.
- 반대로 **입력 helper 는 전량 안착** — [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `36 행`(`ALGORITHM_RESEARCH_UPLIFT_MIN_HITS`) · `39 행`(`AlgorithmResearchEntry`) · `51 행`(`AlgorithmResearchSignal`) · `89 행`(`computeAlgorithmResearchSignal`). 즉 본 task 는 신규 판정 로직 0, 배선만이다.
- 동일 의도 task 부재 — `docs/tasks/` 에 `T-1952*` 0 개, ADR-0064 참조 task 는 T-1948~T-1951 뿐이고 그 넷은 모두 `status: DONE`.

**소비처 동반 의무 (CLAUDE.md `§ 3`) — 충족**: 본 slice 는 helper 신설이 아니라 **소비처 그 자체**이며, container 필드 추가와 composer 위임을 같은 PR 에 함께 넣는다. 파일 5 개(구현 2 + spec 3)로 cap 정확히 소진 — [T-1924](T-1924-document-contribution-signal-wiring.md)(문서 축 6 번째 필드 배선, 동일 5 파일 / 180 LOC)와 **동형 선례**다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — `§ Follow-ups (b)`(본 slice 의 파일 목록 · R-112 축 선박제) · `§ Decision 3`(신호를 소비할 step (9) 위치 — 본 slice 범위 **밖**임을 확인하는 용도)
- [src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `36 행`(임계 상수) · `39~48 행`(`AlgorithmResearchEntry` 3 필드) · `51~60 행`(`AlgorithmResearchSignal` 4 필드 — 빈 신호 shape 판단 근거) · `89 행`(함수 시그니처)
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `120~130 행`(container 서술 주석 — 6 → 7 갱신 대상) · `131~146 행`(6 필드 정의 · 필드별 한국어 주석 관용구) · `148~180 행`(8-step 서술 주석 — **본 slice 에서 step 은 늘지 않음**)
- [src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `1~40 행`(import 블록 · alphabetical 정렬 관용구) · `95~113 행`(JSDoc `@returns` 의 "6 detection" 서술) · `114~122 행`(return 위임 6 개 — append 지점)
- [src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts) `176~190 행` · `285~296 행` — 6 위임 산출을 `computeXxx(deduped)` 로 재계산해 대조하는 기대값 관용구 2 곳
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) `88~107 행`(`makeEmptySignals` 빈 신호 fixture — 7 번째 필드 추가 지점) · `200~215 행`(inline signals 리터럴 — 6 번째 필드 주석 관용구)
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) `3419~3440 행` — "6-signal 단일 container" 단언(`objectContaining` + `Object.keys().sort()` 정확 키 집합) 2 곳
- [docs/tasks/T-1924-document-contribution-signal-wiring.md](T-1924-document-contribution-signal-wiring.md) — 동형 선례(5 → 6 배선)의 AC · Out of Scope 구성

## Acceptance Criteria

- [ ] `EvaluationAdjustmentSignals`([evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `131~146 행`)에 **7 번째 필수 필드** `algorithmResearch: AlgorithmResearchSignal` 을 추가한다. 타입은 helper 산출 타입을 `import type` 으로 재사용하며 **재정의 0**. 기존 6 필드의 이름 · 타입 · 순서는 무변경.
- [ ] 새 필드에 한국어 주석 1~2 줄 — 축 표기(`R-38 / REQ-019 알고리즘·연구 소개 상향 식별 신호`) + 산출 함수명 + "소비는 ADR-0064 `§ Follow-ups (c)` adjuster" 라는 책임 경계. container 머리 주석의 "detection 6 신호" 서술도 7 로 갱신한다.
- [ ] `computeEvaluationAdjustmentSignals`([evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `114~122 행`)의 return 에 `algorithmResearch: computeAlgorithmResearchSignal(deduped)` 를 **append-only** 로 덧붙인다. 기존 6 위임의 호출 순서 · 인자 · 산출 매핑은 무변경이고, composer 는 변환 0 의 투명한 위임을 유지한다(래핑 · 조건 분기 · try/catch 추가 금지). JSDoc 의 "6 detection" 서술도 7 로 갱신.
- [ ] **happy-path unit test 1+** — [evaluation-detection-signals-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts): 임계 이상 `algorithmResearchHits` 를 가진 document 입력이 섞인 batch 에서 composer 산출의 `algorithmResearch` 가 `computeAlgorithmResearchSignal(deduped)` 직접 호출 결과와 `toEqual` 로 일치하고, `algorithmResearchDetected === true` · `byAuthor` 가 비어 있지 않음을 박제한다. 산출 키 집합이 **정확히 7 개**임도 단언.
- [ ] **error path unit test 1+** — composer 에 `null` / `undefined` 를 넘기면 기존과 동일한 한국어 `TypeError`(`deduped` 토큰 포함)가 그대로 던져지고, 7 번째 위임 추가로 **새 throw 경로가 생기지 않음**을 검증(정상 입력에서 throw 0).
- [ ] **분기별 test 1+** — (a) 대상 0 건 batch(모두 code kind 또는 임계 미달)에서 `algorithmResearch.algorithmResearchDetected === false` 이고 나머지 6 필드는 기존 기대값 그대로 유지, (b) 빈 배열 `[]` 입력에서 7 필드 전부 빈 신호로 산출, (c) 혼합 batch 에서 7 번째 필드 추가가 기존 6 필드 산출을 **바꾸지 않음**(6 필드 대조 단언 유지).
- [ ] **negative case 를 예외 분기마다 1+** — 입력 배열 · 원소 **비변형**(호출 전후 deep-equal 스냅샷) / 동일 입력 2 회 호출 산출 deep-equal(결정성) / 산출 container 가 입력과 not-same-ref / `algorithmResearch` 필드가 `undefined` 로 새지 않음(항상 객체).
- [ ] [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) 의 signals fixture 를 7 필드로 맞춘다 — `makeEmptySignals`(`88~107 행`)에 빈 `AlgorithmResearchSignal`(`totalUnitCount: 0` · `totalAlgorithmResearchCount: 0` · `byAuthor: []` · `algorithmResearchDetected: false`) 추가 + inline signals 리터럴(`200~215 행`)에도 동일 빈 신호 추가. **기존 기대값 · 단언은 1 건도 바꾸지 않는다**(빈 신호라 소비 step 이 아직 없어 산출 무변경이어야 하고, 그 무변경 자체가 회귀 방어다).
- [ ] [evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) `3419~3440 행` 계열의 container 키 집합 단언을 **7 키**로 갱신한다(`objectContaining` 에 `algorithmResearch: expect.anything()` 추가 + `Object.keys().sort()` 기대 배열에 `algorithmResearch` 를 알파벳 순서 맞춰 삽입). 주석의 "6-signal" 서술도 7 로 갱신. 그 외 orchestrator spec 의 어떤 단언도 건드리지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%(`package.json` `coverageThreshold.global`). 배선 대상 2 개 구현 파일의 신규 라인은 line · function 100% 지향.
- [ ] `touchesFiles` 5 개 **외 파일 변경 0**. 5 파일 cap 이 정확히 소진돼 있으므로 추가 파일이 필요하다고 판단되면 그 사실을 `## Follow-ups` 에 적고 범위를 줄인다.

## Out of Scope

- uplift adjuster `applyAlgorithmResearchUplift` 신설 · `applyEvaluationAdjustments` step (9) 삽입 · flatten 재번호 — ADR-0064 `§ Follow-ups (c)` 의 책임. 본 slice 는 **신호를 흘려보내기만** 하고 소비자는 만들지 않는다(따라서 평가 산출 값은 1 건도 바뀌지 않아야 한다).
- 상향 건수 관측 로그 · 발동 계측 — `§ Follow-ups (c)`.
- ADR-0064 status `PROPOSED` → `ACCEPTED` flip, [requirements.md](../requirements.md) `38 행` REQ-019 재판정, [PLAN.md](../PLAN.md) 서술 갱신 — `§ Follow-ups (d)` doc-sync 1 회로 유예(PLAN `183 행` once-rule).
- `evaluation-algorithm-research-signal.ts` / 그 spec 의 판정식 · 임계 · 타입 shape 변경 **0**(T-1951 머지분 그대로 사용).
- collection-side helper · 두 mapper · marker 어휘 · `ALGORITHM_RESEARCH_MIN_HITS` 변경 **0**.
- 기존 6 detection 신호 · 8 adjust step 의 로직 · 순서 · 상수 · 주석 오기(REQ-037 / REQ-038 drift) 정정 — ADR-0064 `## Consequences` 경계 밖.
- `prisma/schema.prisma` · `package.json` · `.github/workflows/` · `web/` 변경 0, 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(c) uplift adjuster slice** (본 task 직후): 신설 `src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts`(`ALGORITHM_RESEARCH_UPLIFT_LEVEL = "high"` · `applyAlgorithmResearchUplift`) · 그 colocated spec · `evaluation-adjustments-pipeline.ts` step (9) 배선(flatten → (10)) · `evaluation-adjustments-pipeline.spec.ts`. **4 파일 / ~250 LOC**(ADR-0064 `§ Follow-ups (c)` 선박제 수치).

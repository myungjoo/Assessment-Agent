---
id: T-1953
title: 알고리즘·연구 소개 기여 등급 상향 helper applyAlgorithmResearchUplift 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-019]
estimatedDiff: 360
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1951, T-1952]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts
  - src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 360 LOC — mirror 정본 evaluation-notable-contribution-adjust.ts `185~236 행` uplift 절 + evaluation-document-contribution-adjust.ts 183 행 실측 대비 압축 목표치이며, 파일 수 cap(≤ 5)은 2 파일로 준수. T-1951 패턴 정당화"
plannerNote: "P5 · ADR-0064 § Follow-ups (c) 앞 절반 — T-1952 가 container 7 번째 필드로 배선한 detection 신호를 소비하는 부여 축 helper 신설"
---

# T-1953 — 알고리즘·연구 소개 기여 등급 상향 helper applyAlgorithmResearchUplift 신설

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (c)` 의 앞 절반이다. (a) 는 T-1949 · T-1950 으로 수집 경계의 `metadata.algorithmResearchHits` 파생 scalar 를 채웠고, (b) 는 T-1951 (detection helper `computeAlgorithmResearchSignal`) · T-1952 (signals container 7 번째 필드 + composer 위임) 로 **식별 축** 을 닫았다. 그러나 그 신호를 읽어 실제로 등급을 올리는 **부여 축** 이 여전히 0 이라 R-38 상향은 아직 LLM 산출에만 의존한다 ([requirements.md](../requirements.md) `38 행` REQ-019 `IN_PROGRESS` — "상향을 결정하는 결정적 식별 축 · 부여 축 부재"). 본 slice 는 그 부여 축의 순수 domain helper 1 개를 신설한다.

**issue-still-relevant pre-check (origin/main `90e79e7b` 실측)** — 안착 **0** 확인:

- `git grep -l "applyAlgorithmResearchUplift\|ALGORITHM_RESEARCH_UPLIFT_LEVEL\|algorithm-research-adjust" origin/main -- src test` → 매칭 **0**. `evaluation-algorithm-research-adjust.ts` 파일 부재 (`ls src/assessment-evaluation/domain/` 에 `-signal.ts` / `-signal.spec.ts` 2 개만 존재).
- 소비 부재가 코드에 자백돼 있다 — [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `130 행` 주석 "7 번째 `algorithmResearch`(T-1951 detection)는 아직 소비 step 이 없고", `209 행` "소비하는 필드는 앞 6 개이고 `algorithmResearch` 는 소비 step 이 (없다)". 현행 step 은 (1)~(8) + `(9) flatten` 이라 상향 step 자리가 비어 있다.
- 반면 입력 계약은 이미 머지돼 있다 — [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `39~59 행` 이 `AlgorithmResearchEntry` (`author` / `algorithmResearchUnitCount` / `algorithmResearchUnitIds` / `algorithmResearch`) · `AlgorithmResearchSignal` (`byAuthor` / `algorithmResearchDetected`) 를 export 하고, 같은 파일 `152 행` 계약이 container `algorithmResearch` 필드로 이미 흐른다. 즉 본 slice 는 **중복 신설이 아니라 미소비 신호의 첫 소비자** 다.

**소비처 동반 의무 판정 (CLAUDE.md `§ 3` · [PLAN.md](../PLAN.md) `182 행` 오너 지시)** — 본 slice 는 helper 단독이며 **예외 조항(“cap 초과가 수치로 제시된 경우”)으로 분리** 한다. 실측 근거: helper 본문 ~115 LOC + colocated spec ~245 LOC = **~360 LOC / 2 파일** 이고, 여기에 소비처 배선 (pipeline `.ts` step (9) 삽입 + flatten 재번호 ~25 LOC, [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) ~90 LOC, [evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) ~5 LOC) 를 합치면 **~470 LOC / 5 파일** 로 `§ 3` cap (≤ 300 LOC) 을 **170 LOC 초과** 한다. 직전 동형 선례가 이 수치를 뒷받침한다 — T-1951 helper 단독 실측 +395/2 파일, T-1952 배선 실측 +260/5 파일, T-1926 배선 실측 +272/3 파일. 따라서 소비처 slice 를 아래 `## Follow-ups` 에 파일 · 배선 단위로 명시하고 분리한다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (c)` — 본 slice 의 산출물 · R-112 4 축 요구 원문.
- [src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `36~59 행` — 소비할 신호 계약 (`ALGORITHM_RESEARCH_UPLIFT_MIN_HITS` 상수는 detection 쪽 소유이므로 재정의 금지).
- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) `185~236 행` — **mirror 정본**. `NOTABLE_CONTRIBUTION_UPLIFT_LEVEL` 상수 방식 · `Map` 조회 · 6 규칙 · 입력 비변형 복제 패턴을 그대로 따른다.
- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts) — colocated spec 의 fixture · describe 구성 참고 (신규 spec 위치는 **colocated** `src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.spec.ts` 로 고정).
- [src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) `1~45 행` — mirror 파일의 header 서술 압축 방식 (정본 재진술 금지, 역할 차이만 명시).
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `62 행` — `CONTRIBUTION_QUALITY_FLOOR_LEVEL` (`"zero"` 하한 우선 규칙의 single-source).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `ContributionLevel` · `isContributionLevel` · `EvaluationResult`.

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts` 가 (1) `ALGORITHM_RESEARCH_UPLIFT_LEVEL: ContributionLevel = "high"` 상수, (2) `AlgorithmResearchAdjustEntry` (`author` + `result`) 인터페이스, (3) `applyAlgorithmResearchUplift(entries, signal)` 함수를 export 한다. NestJS / Prisma / LLM import 0, 부수효과 0 의 순수 함수만 둔다.
- [ ] 동작이 mirror 정본 `applyNotableContributionUplift` 와 동형이다 — author 미매칭 / `algorithmResearch === false` → passthrough, `true` 라도 현재 등급이 `CONTRIBUTION_QUALITY_FLOOR_LEVEL`(`"zero"`) 이면 무변경, `"low"` / `"medium"` → `"high"`, 이미 `"high"` 면 동일(멱등), enum 외 값 무변경. `narrative` / `difficulty` / `volume` / `unitId` 는 전사한다.
- [ ] detection layer 재구현 0 — `ALGORITHM_RESEARCH_UPLIFT_MIN_HITS` 임계 비교나 `metadata.algorithmResearchHits` 읽기를 본 파일에서 다시 하지 않고 `AlgorithmResearchSignal` 만 소비한다 (`git grep "algorithmResearchHits" src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts` 결과 0).
- [ ] **happy-path** — colocated spec `evaluation-algorithm-research-adjust.spec.ts` 에서 대상 author 의 `contribution: "low"` / `"medium"` 단위가 `"high"` 로 상향됨을 검증하는 test 1+ (public symbol 3 개 각각 cover — 상수 값 · 인터페이스 사용 · 함수 산출).
- [ ] **error path** — `entries` 가 `null` / `undefined` 일 때, `signal` 이 `null` / `undefined` 일 때 각각 한국어 메시지의 `TypeError` 를 throw 하는 test 1+ (총 4 케이스).
- [ ] **분기별** — (a) author 미매칭 passthrough, (b) `algorithmResearch === false` passthrough, (c) `"zero"` 하한 보존, (d) `"low"` → `"high"`, (e) `"medium"` → `"high"`, (f) 이미 `"high"` 멱등, (g) enum 외 등급 무변경 — 각 분기 1+ test.
- [ ] **negative case (예외 분기마다 1+)** — 빈 `entries` → 빈 배열, 빈 `byAuthor` → 전건 무변경, 입력 `entries` 배열 · 원소 객체 **비변형**(호출 전후 deep equal), 반환 길이 · 순서 보존, 같은 입력 2 회 적용 시 산출 동일(멱등), `narrative` 등 비대상 필드 훼손 0.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% / function ≥ 80% 이며, 신규 파일 2 개는 line · function 100%.

## Out of Scope

- [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 의 step (9) 배선 · flatten 재번호 · 그 spec 수정 — 본 slice 는 helper 신설만이며 배선은 아래 `## Follow-ups` 의 후속 slice 가 진다 (위 `## Why` 의 cap 수치 근거).
- [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) 및 그 spec 변경.
- `narrative` marker 접두 (`[연구소개] ` 계열) — ADR-0064 `§ Follow-ups (확장 지점)` 이 후속 ADR 선행을 요구한다.
- detection layer (`evaluation-algorithm-research-signal.ts`) · mapper (`github-activity.mapper.ts` / `confluence-activity.mapper.ts`) 본문 수정.
- ADR-0064 status 승격 · [requirements.md](../requirements.md) REQ-019 재판정 · PLAN 서술 갱신 — ADR-0064 `§ Follow-ups (d)` doc-sync slice 가 (a)~(c) 전량 머지 후 **1 회만** 수행한다 ([PLAN.md](../PLAN.md) `183 행` once-rule).
- prisma schema / migration / 새 dependency 일체.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **소비처 배선 slice (본 slice 직후 큐잉 대상)** — [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 에 `applyAlgorithmResearchUplift` 를 step (9) 로 삽입 (현행 `(9) flatten` → `(10)` 재번호, step (3) quality floor 뒤 · step (6)(7) `"high"` 수렴 주석 갱신, `130 행` · `209 행` 의 "소비 step 이 없다" 주석 제거) + [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) 순서 · 수렴 · passthrough test + [evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) fixture 정합. 예상 ~250 LOC / 3~5 파일.

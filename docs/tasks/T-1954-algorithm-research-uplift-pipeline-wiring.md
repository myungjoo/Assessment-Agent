---
id: T-1954
title: 알고리즘·연구 기여 등급 상향 helper 를 adjustments pipeline step (9) 로 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-019]
estimatedDiff: 310
estimatedFiles: 3
created: 2026-09-07
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1953]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 310 LOC — 동형 선례 실측 T-1926 배선 +272/-59 (3 파일) · T-1928 배선 +301/-70 (3 파일) 이 300 LOC 을 straddle 한다. 분할 불가 — step 삽입과 그 spec 을 쪼개면 R-112 (배선된 step 의 spec 부재) 위반이고 중간 commit 이 red 가 된다. 파일 수는 3 으로 cap (≤ 5) 준수. T-1926 패턴 정당화"
plannerNote: "P5 · ADR-0064 § Follow-ups (c) 뒷 절반 — T-1953 helper 의 유일한 소비처 배선 (§ 3 소비처 동반 의무 잔여분 상환)"
---

# T-1954 — 알고리즘·연구 기여 등급 상향 helper 를 adjustments pipeline step (9) 로 배선

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (c)` 의 **뒷 절반** 이자, T-1953 이 CLAUDE.md `§ 3` 소비처 동반 의무의 예외 조항 (cap 초과 수치 제시) 으로 분리해 둔 **잔여 상환분** 이다. T-1953 이 신설한 `applyAlgorithmResearchUplift` 는 현재 **소비처가 0** 이라 평가 산출 값을 1 건도 바꾸지 못한다 — R-38 / REQ-019 의 상향은 여전히 LLM 산출에만 의존한다. 본 slice 가 그 helper 를 실제 파이프라인에 꽂아 축을 닫는다.

**issue-still-relevant pre-check (origin/main `3ae71454` 실측)** — 안착 **0** 확인:

- `git grep -n "applyAlgorithmResearchUplift" origin/main -- src test` → 매칭은 전부 T-1953 이 신설한 `evaluation-algorithm-research-adjust.ts` / `.spec.ts` 자기 자신 + `evaluation-algorithm-research-signal.ts` `18 행` 주석뿐이다. **소비처 파일 (`evaluation-adjustments-pipeline.ts`) 의 매칭 0**.
- 미소비가 코드에 자백돼 있다 — [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `130 행` "7 번째 `algorithmResearch`(T-1951 detection)는 아직 소비 step 이 없고", `151 행` "본 container 는 전달만 한다(소비 step 0)", `209 행` "소비하는 필드는 앞 6 개". 본문 `323 행` 은 여전히 `(9) flatten` 이라 상향 step 자리가 비어 있다.
- 반면 소비 대상 계약은 이미 머지돼 있다 — [evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) `44 행` `ALGORITHM_RESEARCH_UPLIFT_LEVEL` · `51 행` `AlgorithmResearchAdjustEntry` · `87 행` `applyAlgorithmResearchUplift(entries, signal)` 3 심볼 export 완료. 즉 본 slice 는 **중복 신설이 아니라 미소비 helper 의 첫 소비자** 다.
- 파이프라인은 production 경로에 살아 있다 — [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `71 행` 이 `applyEvaluationAdjustments` 를 import 한다. 따라서 본 배선은 주석 정리가 아니라 **실제 평가 산출 변경** 이다.

**소비처 동반 의무 (CLAUDE.md `§ 3`)** — 본 slice 자체가 그 상환이며 helper 신설분은 이미 머지돼 있다. 새 미소비 심볼을 만들지 않는다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (c)` (`108 행`) — 본 slice 산출물 (step (9) 배선 + signals 계약 guard + spec) 과 R-112 4 축 요구 원문. 같은 문서 `§ Decision 3` (`84 행`) — `"zero"` floor 우선 규칙.
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 전체 (`325 행`) — 특히 `4 행` header 요약, `30~72 행` step 목록 주석 (필드 직교성 · throw 경계 포함), `126~133 행` container 주석, `148~152 행` `algorithmResearch` 필드 주석, `161~212 행` JSDoc, `240~260 행` 필드 guard 군, `280~324 행` step (4)~(9) 본문.
- [src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) `44~123 행` — 소비할 3 심볼의 시그니처 · 6 규칙 · throw 계약 (재구현 금지, 위임만).
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) `47~64 행` `makeResult` · `65 행` `makeEmptySignals` — 신규 test 가 재사용할 fixture helper (중복 정의 금지). `120 행` 이후 describe 구성.
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) `3420~3440 행` · `3495~3510 행` — composer 인자 `signals` 7 필드 검증 지점 (배선 후 정합 필요 여부 확인용).
- **직전 동형 선례 (mirror 정본)**: T-1926 배선 commit `d8d9fc57` 의 pipeline step (7) 삽입 + 재번호 방식. 본 slice 는 그 패턴을 알고리즘·연구 축으로 그대로 mirror 한다.

## Acceptance Criteria

- [ ] [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 가 `applyAlgorithmResearchUplift` 를 import 해 **step (9) 알고리즘·연구 축 등급 상향** 으로 삽입하고, 기존 `(9) flatten` 을 `(10) flatten` 으로 재번호한다. 삽입 위치는 step (3) quality floor **뒤** (하한 우선 보존) 이며 v1 고정 순서를 유지한다.
- [ ] `signals.algorithmResearch` 의 null / undefined guard 를 기존 6 필드 guard 군 (`240~260 행` 계열) 과 같은 형식 · 한국어 메시지로 추가한다 — 현재 이 필드만 guard 가 없다.
- [ ] 주석 정합: `4 행` header · `30~72 행` step 목록 (필드 직교성 절의 `contribution` 그룹에 step (9) 추가, throw 경계 절에 `algorithmResearch` 추가) · `126~133 행` · `148~152 행` · `161~212 행` JSDoc 의 "소비 step 이 없다 / 전달만 한다 / 소비하는 필드는 앞 6 개 / 8-step" 서술을 **전부** 갱신한다 (`git grep -n "소비 step" src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` 결과 0).
- [ ] 상향 규칙 재구현 0 — `"zero"` 하한 판정 · `"high"` 대입 · `byAuthor` 조회를 pipeline 에서 다시 하지 않고 helper 에 위임만 한다 (`git grep -n "ALGORITHM_RESEARCH_UPLIFT_LEVEL\|algorithmResearchHits" src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` 결과 0).
- [ ] **happy-path** — [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) 에서 알고리즘·연구 축 대상 author 의 `contribution: "low"` / `"medium"` 단위가 최종 산출에서 `"high"` 로 나오는 test 1+ (public symbol `applyEvaluationAdjustments` 의 새 경로 cover).
- [ ] **error path** — `signals.algorithmResearch` 가 `null` 일 때와 `undefined` 일 때 각각 한국어 `TypeError` 를 throw 하는 test 1+ (총 2 케이스), 그리고 그 throw 가 **step 진입 전** 에 발생해 앞 step 산출이 남지 않음을 검증하는 test 1+.
- [ ] **분기별** — (a) 미대상 author passthrough, (b) `algorithmResearch === false` passthrough, (c) step (3) floor 로 `"zero"` 가 된 단위는 step (9) 후에도 `"zero"` 유지, (d) step (6) 코드 축 · (e) step (7) 문서 축 상향과 동시 대상일 때 `"high"` 로 수렴 (순서 무관 · 멱등), (f) 알고리즘·연구 축 **단독** 대상이 `"high"` 로 상향 — 각 분기 1+ test.
- [ ] **negative case (예외 분기마다 1+)** — 빈 `entries` → 빈 배열, `makeEmptySignals()` (빈 `byAuthor`) → 전건 무변경, 입력 `entries` 배열 · 원소 **비변형** (호출 전후 deep equal), 산출 길이 · 순서 보존, 같은 입력 2 회 호출 시 산출 동일 (멱등), `narrative` / `volume` / `difficulty` / `unitId` 훼손 0 (step (4)(5)(8) marker 접두와 직교).
- [ ] [evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) 의 composer 관련 fixture · 기대값을 배선 후 산출과 정합시킨다 (`3420~3440 행` · `3495~3510 행` 계열). 변경이 불필요하면 task `## Follow-ups` 에 "정합 변경 0 — 기존 기대값 그대로 green" 한 줄로 기록한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% / function ≥ 80%, `evaluation-adjustments-pipeline.ts` 는 line · function 100% 유지.

## Out of Scope

- [evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) · [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) 본문 수정 — 본 slice 는 **소비만** 한다.
- [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) 의 production 코드 변경 — 파이프라인 composer 안에서 완결되므로 orchestrator 는 손대지 않는다 (spec fixture 정합만 허용).
- [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) · mapper (`github-activity.mapper.ts` / `confluence-activity.mapper.ts`) 변경.
- `narrative` marker 접두 (`[연구소개] ` 계열) — ADR-0064 `§ Follow-ups (확장 지점)` 이 후속 ADR 선행을 요구한다. 본 slice 는 점수 축만 닫는다.
- ADR-0064 status PROPOSED → ACCEPTED 승격 · [requirements.md](../requirements.md) `38 행` REQ-019 재판정 · PLAN 서술 갱신 — ADR-0064 `§ Follow-ups (d)` doc-sync slice 가 (a)~(c) 전량 머지 후 **1 회만** 수행한다 ([PLAN.md](../PLAN.md) `183 행` once-rule).
- prisma schema / migration / 새 dependency / e2e · smoke spec 신설 일체.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)

---
id: T-1951
title: 알고리즘·연구 소개 상향 detection 신호 computeAlgorithmResearchSignal 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-019]
estimatedDiff: 380
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1949, T-1950]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts
  - src/assessment-evaluation/domain/evaluation-algorithm-research-signal.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 380 LOC — mirror 원본 evaluation-quality-signal.ts 195 행 · evaluation-document-contribution-signal.ts 173 행 + colocated spec 317~353 행 실측 대비 압축 목표치이며, 파일 수 cap(≤ 5)은 2 파일로 준수. T-1923 패턴 정당화"
plannerNote: "P5 · ADR-0064 § Follow-ups (b) 앞 절반 — 수집 layer 파생 신호(T-1949/T-1950)를 읽는 평가-side detection 신호 신설"
---

# T-1951 — 알고리즘·연구 소개 상향 detection 신호 computeAlgorithmResearchSignal 신설

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (b)` 의 앞 절반이다. (a) 가 T-1949(helper + Confluence mapper) · T-1950(github mapper)으로 닫히면서 `metadata.algorithmResearchHits` 파생 scalar 가 **수집 경계에서 실제로 채워지기 시작**했지만, 이를 읽는 소비자가 평가 layer 에 아직 0 이라 R-38 상향은 여전히 LLM 산출에만 의존한다 ([requirements.md](../requirements.md) `38 행` REQ-019 `IN_PROGRESS` — "결정적 식별 축 · 부여 축 부재"). 본 slice 는 그 중 **식별 축** 을 detection helper 1 개로 연다 (부여 축 adjuster 는 `§ Follow-ups (c)`).

**issue-still-relevant pre-check (origin/main `c3a1783e` 실측)** — 안착 **0** 확인:

- `git grep -i "algorithmResearch" origin/main -- src/assessment-evaluation` → 매칭 **0**. `evaluation-algorithm-research-signal.ts` 파일 부재(`git ls-tree origin/main src/assessment-evaluation/domain/`).
- detection 신호 container [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `130~145 행` 은 여전히 6 필드(abuse / updateCount / quality / underPerformer / notableContribution / documentContribution)뿐이고 R-38 축이 없다. detection composer [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `115~122 행` 도 6 위임뿐이다.
- 반대로 **upstream 은 전량 안착** — collection helper [algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) `16 행`(`ALGORITHM_RESEARCH_MIN_HITS`) · `64 행`(`computeAlgorithmResearchHits`), [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `109~112 행`, [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `150~155 행`. 즉 본 task 의 입력은 이미 존재하고 소비자만 없다.
- 동일 의도 task 부재 — `docs/tasks/` 에 `T-1951*` 0 개, ADR-0064 를 참조하는 task 는 T-1948~T-1950 뿐.

**소비처 동반 의무 (CLAUDE.md `§ 3`) 예외 — 파일 수 cap 초과 수치**: 배선(container 필드 + detection composer + 두 pipeline spec + orchestrator spec)을 같은 PR 에 넣으면 T-1924 실측(**5 파일**) 이 그대로 더해져 **총 7 파일 / ~463 LOC** 이 되어 `≤ 5 파일` 자체를 초과한다. 따라서 detection helper + colocated spec 만 본 slice 로 하고, 소비처 배선은 아래 `## Follow-ups` 에 파일 단위로 명시한다. 이는 REQ-020 문서 축 arc 의 T-1923(식별 신호 2 파일) → T-1924(배선 5 파일) 분해와 **동형 선례**다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — `§ Decision 1`(파생 scalar 경계 · number 인 이유 = 평가 layer 가 임계 소유) · `§ Decision 2`(대상 kind = document 한정, 임계 2, 보수 편향) · `§ Follow-ups (b)`(본 slice 의 R-112 축 선박제)
- [src/assessment-evaluation/domain/evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) `52 행`(임계 상수 서술 톤) · `55~79 행`(Entry / Signal 두 타입 shape) · `115~123 행`(null/undefined 한국어 `TypeError` guard) · `124~140 행`(author 최초 등장 순서 보존 누적) — **본 helper 가 mirror 할 1 차 원본**
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) `135 행`(`contributionKind === "document"` 필터 관용구) · 파일 머리 주석의 "detection layer 만 — 소비는 후속 task" 책임 경계 서술
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `56~90 행` — `EvaluationInput` 7 필드(`unitId` / `contributionKind` / `author` / `metadata`)와 `ActivityMetadata` scalar 계약
- [src/assessment-collection/domain/algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) `12~16 행` · `55~64 행` — 수집-side 파생 scalar 의 의미(matched marker 그룹 수 0~3)와 `ALGORITHM_RESEARCH_MIN_HITS` 의 위치
- [src/assessment-collection/domain/confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `98~112 행` — hits 0 이면 **키 자체를 담지 않는** 산출 계약(= 평가 layer 는 키 부재를 미대상으로 읽어야 한다)
- **colocated spec 위치(신설)**: `src/assessment-evaluation/domain/evaluation-algorithm-research-signal.spec.ts` — 같은 디렉토리 colocated 가 default. 참고 spec 은 [evaluation-document-contribution-signal.spec.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts)(317 행, `makeInput` stub 빌더 패턴)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts` 신설 — 의존성 0 의 순수 domain helper(NestJS `@Injectable` / Prisma / LLM gateway import **0**, `EvaluationInput` type import 만).
- [ ] 임계 상수 `ALGORITHM_RESEARCH_UPLIFT_MIN_HITS = 2` 를 **평가 layer 안에** 정의한다. collection 의 `ALGORITHM_RESEARCH_MIN_HITS` 를 import 하지 않으며, 그 근거(ADR-0064 `§ Decision 1` — "mapper 는 사실 수집기, 평가 layer 가 판정자·임계 소유자") 를 상수 주석에 한국어로 남긴다.
- [ ] `computeAlgorithmResearchSignal(inputs: EvaluationInput[]): AlgorithmResearchSignal` 을 export 한다. 판정은 **(i) `contributionKind === "document"` ∧ (ii) `metadata.algorithmResearchHits` 가 유한 number ∧ (iii) 그 값이 `ALGORITHM_RESEARCH_UPLIFT_MIN_HITS` 이상** 3 조건 동시 충족 단위만 대상으로 삼는다.
- [ ] 산출 타입 2 종을 export 한다 — author 별 `AlgorithmResearchEntry`(author · 대상 단위 수 · 대상 `unitId[]`(입력 등장 순서 보존) · boolean 축약) + batch 차원 `AlgorithmResearchSignal`(전체 단위 수 · 대상 총 수 · `byAuthor`(author 최초 등장 순서) · `algorithmResearchDetected`). shape 은 `ContributionQualitySignal`(`evaluation-quality-signal.ts` `55~79 행`) 을 mirror 한다.
- [ ] **happy-path unit test 1+** — 임계 이상 hits 를 가진 document 단위가 대상으로 잡히고 해당 author entry 의 `unitId` 목록 · 카운트 · `algorithmResearchDetected === true` 가 박제된다. author 2 명 이상 batch 1 건 포함.
- [ ] **error path unit test 1+** — `inputs` 가 `null` / `undefined` 이면 한국어 `TypeError` 를 throw 한다(메시지에 `inputs` 토큰 포함). 그 외 입력에서는 throw **0** 임을 검증.
- [ ] **분기별 test 1+** — (a) `contributionKind === "code"` 단위는 hits 가 임계 이상이어도 제외, (b) hits 가 임계 미만(1)이면 제외, (c) `metadata.algorithmResearchHits` **키 부재** 면 제외, (d) 값이 비-number(string / boolean / null) 또는 비유한(NaN / Infinity) 이면 **0 으로 흡수**해 제외(throw 0), (e) 임계 **정확히 2** 는 포함(경계 inclusive).
- [ ] **negative case 를 예외 분기마다 1+** — 빈 배열 입력 → `byAuthor: []` · `algorithmResearchDetected === false` · 카운트 0 / 입력 배열 · 원소 **비변형**(deep-equal 스냅샷 비교) / 동일 입력 2 회 호출 산출 deep-equal(결정성) / 산출 container 가 입력과 not-same-ref / 대상 0 건 batch 에서 `detected === false`.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%(`package.json` `coverageThreshold.global`), 신규 2 파일은 line · function 100% 지향.
- [ ] 파일 머리 주석에 **책임 경계** 를 한국어로 명시 — "본 slice 는 detection 신호 산출만. container 필드 추가 · detection composer 배선 · uplift adjuster 는 ADR-0064 `§ Follow-ups (b) 잔여` / `(c)` 의 책임". 서술은 ADR 을 **경로 + § 좌표로 참조** 하고 정책 본문을 재서술하지 않는다(중복 서술이 T-1923 의 490 LOC 초과 원인이었다 — 목표 압축선 helper ≤ 170 행 · spec ≤ 210 행).

## Out of Scope

- `EvaluationAdjustmentSignals` container(`evaluation-adjustments-pipeline.ts` `130~145 행`) 에 7 번째 필드 추가 — 배선 slice 의 책임.
- `evaluation-detection-signals-pipeline.ts` 위임 추가 · `evaluation-orchestrator.service.ts` 배선 — 배선 slice 의 책임.
- uplift adjuster(`applyAlgorithmResearchUplift`) · adjustments pipeline step (9) 삽입 — ADR-0064 `§ Follow-ups (c)`.
- ADR-0064 status `PROPOSED` → `ACCEPTED` flip, [requirements.md](../requirements.md) `38 행` REQ-019 재판정, PLAN 서술 갱신 — `§ Follow-ups (d)` doc-sync 1 회로 유예(PLAN `183 행` once-rule).
- collection-side helper · 두 mapper · marker 어휘 · `ALGORITHM_RESEARCH_MIN_HITS` 값 변경 **0**.
- 기존 하향 축(`evaluation-quality-signal.ts` / `evaluation-quality-adjust.ts`)의 판정식 · 상수 · 주석 오기(REQ-037 / REQ-038 drift) 수정 — ADR-0064 `## Consequences` 경계 밖.
- `prisma/schema.prisma` · `package.json` · `.github/workflows/` 변경 0, 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(b) 잔여 — detection 배선 slice** (본 task 직후, T-1924 5 파일 구조 mirror): `evaluation-adjustments-pipeline.ts`(container 7 번째 필드 + 서술) · `evaluation-detection-signals-pipeline.ts`(7 번째 위임, append-only) · `evaluation-detection-signals-pipeline.spec.ts` · `evaluation-adjustments-pipeline.spec.ts`(`makeEmptySignals` 등 fixture 3 곳) · `evaluation-orchestrator.service.spec.ts`.

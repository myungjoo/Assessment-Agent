---
id: T-1923
title: 문서 축 조직 기여 식별 신호 computeDocumentContributionSignal 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts
  - src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 340 LOC — mirror 원본 evaluation-notable-contribution-signal.ts 187 행 + colocated spec 310 행 실측 대비 압축 목표치이며, 파일 수 cap(≤ 5)은 2 파일로 준수. T-1921 패턴 정당화"
plannerNote: "P5 · PLAN 103 행 품질 분류 계열 · REQ-020 의 미충족 축 1 개(문서 축 조직 기여 식별) — detection layer 만 신설"
---

# T-1923 — 문서 축 조직 기여 식별 신호 computeDocumentContributionSignal 신설

## Why

README `39 행` 은 "조직에 큰 기여를 **문서를 통해** 한 인원에게 더 높은 점수와 더 높은 평가 코멘트" 를 요구하는데, 그 판정의 출발점인 **문서 축 식별 신호가 main 에 없다**. 실측 근거(origin/main `3c40ca91` 기준): ① 최근접 후보 [`evaluation-notable-contribution-signal.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts) 는 `150 행` 이 `contributionKind === "code"` 단위만 세고 `21 행`·`77 행`·`108 행` 주석이 "document 제외 … document 축은 별도 신호" 로 경계를 자인한다, ② detection 진입점 [`evaluation-detection-signals-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `106~110 행` 의 5 신호(abuse / updateCount / quality / underPerformer / notableContribution) 어디에도 문서 축이 없다, ③ `src/` 전수에서 `documentUnitCount` · `DocumentContribution` · `computeDocument` 심볼 매칭 **0 행**. 본 task 는 [docs/requirements.md](../requirements.md) `39 행` REQ-020 이 "문서 축 조직 기여 식별 축 부재" 로 지목한 그 구멍만 detection layer 로 채운다 — 상향(점수·코멘트) 배선은 후속 slice 다.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` — `67~130 행`(상수 · 두 interface · JSDoc · 함수 시그니처) + `140~187 행`(누적 → 평균 → comparable 경계 → 반환). 본 task 가 그대로 mirror 할 구조·방어 계약의 정본.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.spec.ts` — colocated spec 의 describe / it 조직과 케이스 축 구성(happy · TypeError · 경계 · 부수효과 0).
- `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` — `67 행` `UNDERPERFORMER_RELATIVE_FLOOR = 0.5` 와 그 대칭 근거 주석(임계 상수 서술 톤의 기준).
- `src/assessment-evaluation/domain/evaluation-input.ts` — `34 행` `ContributionKind` union + `60~74 행` `EvaluationInput` 필드.
- `README.md` `39 행` — 문서를 통한 조직 기여 → 더 높은 점수·코멘트 (본 신호가 서빙하는 요구 문장).

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts` 가 다음 public symbol 을 정확히 4 개 export 한다 — 상수 `DOCUMENT_CONTRIBUTION_RELATIVE_CEILING`(v1 = `1.5`, notable code 축과 동일 보수 경계), `interface DocumentContributionEntry`(`author` / `documentUnitCount` / `notable`), `interface DocumentContributionSignal`(`totalAuthorCount` / `meanDocumentUnitCount` / `byAuthor` / `notableDetected`), 함수 `computeDocumentContributionSignal(inputs: EvaluationInput[]): DocumentContributionSignal`.
- [ ] 알고리즘은 LLM 무관 **결정적** 순수 함수다 — author 별 `contributionKind === "document"` 단위 수 누적(최초 등장 순서 보존) → 전 author 평균 산출 → `totalAuthorCount >= 2 && meanDocumentUnitCount > 0` 일 때만 `documentUnitCount > mean × CEILING`(엄격히 초과) 인 author 를 `notable = true` 로 식별 → `notableDetected` 는 `byAuthor` 중 1 명이라도 true 면 true.
- [ ] 입력 배열·원소를 변형하지 않는다(부수효과 0). `inputs` 가 `null`/`undefined` 면 한국어 메시지의 `TypeError` 를 throw 하며, 그 외 throw 경로는 두지 않는다.
- [ ] **happy-path unit test 1+** — public symbol 4 개 각각에 대해: 다수 author document 단위가 섞인 batch 에서 `byAuthor` 4 필드 · `meanDocumentUnitCount` · `notableDetected` 가 기대값과 일치, 상수 값이 `1.5` 임을 직접 단언.
- [ ] **error path unit test 1+** — `computeDocumentContributionSignal(null as never)` / `(undefined as never)` 각각이 `TypeError` 를 던지고 메시지에 함수명이 포함됨을 검증.
- [ ] **분기별 test 1+** — (a) author 1 명 단독 batch → 비교 불가라 `notable` 전원 false, (b) 평균 0 batch(전원 document 0) → `notable` 전원 false, (c) comparable batch 에서 임계 **정확히 같은 값** → false(엄격 초과), (d) 임계 초과 → true, (e) 빈 배열 → `totalAuthorCount` 0 · `byAuthor` `[]` · `meanDocumentUnitCount` 0 · `notableDetected` false.
- [ ] **negative case 를 예외 분기마다 1+** — `contributionKind === "code"` 단위만 있는 batch 는 document 카운트 0 유지(code 오염 없음), 같은 author 가 여러 번 등장해도 entry 1 개로 축약, `byAuthor` 순서가 author 최초 등장 순서와 일치(비결정성 0), 호출 전후 입력 배열 deep-equal 불변(원본 비변형).
- [ ] colocated spec 위치는 `src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts` 다(신규 파일 옆, `test/` 아래 아님).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% / function ≥ 80% (`package.json` `coverageThreshold.global`).

## Out of Scope

- **소비처 배선 금지** — `evaluation-detection-signals-pipeline.ts` 의 6 번째 신호 추가, `evaluation-adjustments-pipeline.ts` 의 `EvaluationAdjustmentSignals` container 필드 추가, orchestrator / 그 spec 기대값 갱신은 전부 본 task 밖이다. 근거(CLAUDE.md §3 소비처 동반 의무의 cap 예외): 소비처를 같은 PR 에 넣으면 파일 6 개(≥ 5 초과) · 총 diff 약 470 LOC(≥ 300 초과)로 cap 이중 초과다. 잔여 배선은 아래 Follow-ups 에 파일·배선 단위로 명시한다.
- `evaluation-notable-contribution-signal.ts` / `evaluation-underperformer-signal.ts` 본문 수정 금지(주석의 "document 축은 별도 신호" 경계 서술도 그대로 둔다).
- 점수·코멘트 **상향**(`contribution` 등급 조정 · narrative 문구 변경) 구현 금지 — 본 task 는 detection 전용이다.
- `docs/requirements.md` REQ-020 재판정 · `docs/PLAN.md` checkbox 변경 금지 (PLAN `183 행` 오너 지시 — 재판정은 구현 chain 머지 후 1 회만, 별도 direct task).
- 새 외부 dependency · prisma schema · ADR 신설 금지. 기존 detection 신호 패턴(underperformer FLOOR / notable CEILING) 범위 안의 구현이라 새 ADR 불요이며, 설계 판단이 그 범위를 벗어난다고 보이면 즉시 BLOCKED 로 escalate 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 소비처 배선 slice — `evaluation-adjustments-pipeline.ts` `101~112 행` `EvaluationAdjustmentSignals` 에 `documentContribution: DocumentContributionSignal` 필드 추가 + `evaluation-detection-signals-pipeline.ts` `106~110 행` 반환 객체에 `documentContribution: computeDocumentContributionSignal(deduped)` 추가 + 두 파일의 colocated spec 기대값 갱신.
- (b) 상향 slice — 문서 축 notable author 의 `contribution` 등급·narrative 코멘트 상향(README `39 행` 뒷절), `evaluation-notable-contribution-adjust.ts` 의 uplift 패턴 mirror.
- (c) (a)·(b) 전량 머지 후 REQ-020 재판정 1 회(direct) — `docs/requirements.md` `39 행` + PLAN 해당 bullet.

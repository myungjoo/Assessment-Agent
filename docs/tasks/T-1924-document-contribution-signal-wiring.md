---
id: T-1924
title: 문서 축 기여 신호 detection pipeline 배선 (6 번째 신호)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 180
estimatedFiles: 5
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: [T-1923]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
plannerNote: "P5 · PLAN 103 행 품질 분류 계열 · T-1923 Follow-up (a) 소비처 배선 — detection 5 신호 → 6 신호"
---

# T-1924 — 문서 축 기여 신호 detection pipeline 배선 (6 번째 신호)

## Why

T-1923 (PR #1509) 이 문서 축 조직 기여 식별 신호 `computeDocumentContributionSignal` 을 신설했지만 **아무도 호출하지 않는다** — CLAUDE.md §3 소비처 동반 의무의 cap 예외로 배선을 다음 slice 로 미뤘고, 그 slice 가 본 task 다. issue-still-relevant pre-check 실측 (origin/main `daea51cb`): ① `git grep documentContribution -- src` 결과가 신규 2 파일 (`evaluation-document-contribution-signal.ts` / 그 colocated spec) 안에서만 매칭되고 **다른 어떤 파일도 이 심볼을 import 하지 않는다**, ② [`evaluation-detection-signals-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `104~111 행` 반환 객체가 여전히 abuse / updateCount / quality / underPerformer / notableContribution 5 필드뿐, ③ [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `98~112 행` `EvaluationAdjustmentSignals` container 도 5 필드뿐이다. 즉 배선 구멍은 그대로다. 본 task 는 [docs/requirements.md](../requirements.md) `39 행` REQ-020 의 "문서 축 조직 기여 식별 축" 을 **본류 파이프라인 위로 올리는 것** 까지만 하고, 점수·코멘트 상향은 후속 slice (T-1923 Follow-up (b)) 로 남긴다.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts` — `54 행` 상수 · `57~76 행` 두 interface · `113~114 행` 함수 시그니처. 본 task 가 호출·매핑할 대상.
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` — 파일 전체 (112 행). 특히 `56~62 행` import 군 · `104~111 행` 반환 객체 · 헤더 주석의 "v1 고정 순서" 서술 (본 task 가 6 번째 항목을 덧붙일 자리).
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` — `72~86 행` import 군 + `95~112 행` `EvaluationAdjustmentSignals` 정의 (필드 1 개 추가 지점). `applyEvaluationAdjustments` 본문은 **읽기만** — 본 task 는 손대지 않는다.
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts` — `67~113 행` (happy-path deep-equal + `Object.keys` 정확히 5 필드 단언) · `115~145 행` (byte-identical direct 비교) · `146~210 행` (분기 cover). 5 → 6 으로 갱신할 좌표.
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts` — `53 행` `makeEmptySignals()` 및 `116 행` · `176 행` · `472 행` 의 signals 객체 리터럴 4 곳 (필수 필드 1 개 추가로 컴파일이 깨지는 지점).
- `src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` — `3406~3425 행` · `3652 행` 근처 · `3744 행` 근처의 `Object.keys(signals).sort()` 5-필드 단언 3 곳 + `3414 행` `objectContaining` 매처.

## Acceptance Criteria

- [ ] `EvaluationAdjustmentSignals` (`evaluation-adjustments-pipeline.ts`) 에 필수 필드 `documentContribution: DocumentContributionSignal` 을 6 번째로 추가하고, 타입은 `evaluation-document-contribution-signal` 에서 `import type` 으로 재사용한다 (타입 재정의 0). 필드 주석은 기존 5 필드 톤을 따라 "REQ-020 문서 축 조직 기여 식별 신호" 를 한 줄로 밝힌다.
- [ ] `computeEvaluationAdjustmentSignals` (`evaluation-detection-signals-pipeline.ts`) 가 반환 객체에 `documentContribution: computeDocumentContributionSignal(deduped)` 를 **6 번째 (notableContribution 다음)** 로 추가한다. 기존 5 호출의 순서·인자는 무변경이며, 위임 외 변환 0 (산출을 그대로 동명 매핑).
- [ ] 헤더/JSDoc 주석의 "5 detection" · "v1 고정 순서" 서술을 6 신호로 갱신한다 (6 번 항목 = document — R-39 / REQ-020 문서 축 상대 비교). 주석과 코드의 개수 불일치 0.
- [ ] `applyEvaluationAdjustments` 본문 · 기존 5 adjuster · orchestrator production 코드는 **무변경** 이다 (`git diff --stat` 상 `evaluation-orchestrator.service.ts` 미포함).
- [ ] **happy-path unit test 1+** — `evaluation-detection-signals-pipeline.spec.ts` 에서 다수 author document 단위 fixture 로 `signals.documentContribution` 이 `computeDocumentContributionSignal(deduped)` 직접 호출 결과와 deep-equal 임을 단언.
- [ ] **error path unit test 1+** — `deduped` 가 `null` / `undefined` 일 때 기존과 동일한 한국어 `TypeError` (메시지에 `deduped` 포함) 가 그대로 유지됨을 검증 (6 번째 신호 추가가 guard 를 앞지르지 않음).
- [ ] **분기별 test 1+** — (a) 빈 `deduped []` → `documentContribution` 이 빈 신호 (`totalAuthorCount` 0 · `byAuthor` `[]` · `notableDetected` false), (b) code 단위만 있는 batch → `documentContribution.notableDetected` false 이면서 기존 5 필드는 종전 기대값 유지, (c) document 단위가 평균 × 1.5 를 초과하는 author 가 있는 batch → `notableDetected` true.
- [ ] **negative case 를 예외 분기마다 1+** — ① `Object.keys(signals).sort()` 단언이 **정확히 6 필드** 로 갱신돼 7 번째 필드 유입 시 fail, ② 같은 입력 2 회 호출 산출이 deep-equal (결정성 유지), ③ 호출 전후 `deduped` 배열·원소 deep-equal 불변 (입력 비변형), ④ document 신호 추가가 기존 `notableContribution` 값을 오염시키지 않음 (code 축 기대값 종전 그대로).
- [ ] `evaluation-adjustments-pipeline.spec.ts` 의 `makeEmptySignals()` 와 signals 객체 리터럴 3 곳에 `documentContribution` 빈 신호를 채워 타입 오류 0 으로 통과하며, 기존 it 의 기대값은 변경하지 않는다 (adjuster 동작 무변경 확인).
- [ ] `evaluation-orchestrator.service.spec.ts` 의 `Object.keys(signalsArg).sort()` 5-필드 단언 3 곳과 `objectContaining` 매처를 6 필드로 갱신한다 (production 코드 무변경이므로 spec 만 조정).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 — line >= 80% / function >= 80% (`package.json` `coverageThreshold.global`).

## Out of Scope

- **상향 (uplift) 구현 금지** — `applyEvaluationAdjustments` 에 6 번째 adjuster (`applyDocumentContributionUplift` 류) 추가, `contribution` 등급 조정, narrative marker 접두는 전부 본 task 밖이다 (T-1923 Follow-up (b) 의 별도 slice). 본 task 는 signals container 까지만 올린다.
- `evaluation-document-contribution-signal.ts` 본문 수정 금지 — 호출만 한다.
- 기존 5 detection helper (`evaluation-abuse-signal.ts` / `evaluation-update-count-neutral.ts` / `evaluation-quality-signal.ts` / `evaluation-underperformer-signal.ts` / `evaluation-notable-contribution-signal.ts`) 및 5 adjuster 파일 수정 금지.
- `evaluation-orchestrator.service.ts` production 수정 금지 — composer 를 이미 호출 중이라 배선이 자동 전파된다.
- `docs/requirements.md` REQ-020 재판정 · `docs/PLAN.md` checkbox 변경 금지 (PLAN `183 행` 오너 지시 — 재판정은 구현 chain 머지 후 REQ 당 1 회, 별도 direct task).
- prisma schema · 새 외부 dependency · 새 ADR 금지. 기존 detection composer 패턴 안의 필드 1 개 추가라 새 ADR 불요이며, 설계 판단이 그 범위를 벗어난다고 보이면 즉시 BLOCKED 로 escalate 한다.
- 파일 5 개 cap 이 정확히 소진돼 있다 — 위 `touchesFiles` 외 어떤 파일도 건드리지 말 것. 추가 파일이 필요하다고 판단되면 그 사실을 Follow-ups 에 적고 범위를 줄인다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (b) 상향 slice — 문서 축 notable author 의 `contribution` 등급·narrative 코멘트 상향 (`evaluation-notable-contribution-adjust.ts` 의 uplift·marker 패턴 mirror + `applyEvaluationAdjustments` 순서 편입).
- (c) (b) 머지 후 REQ-020 재판정 1 회 (direct) — `docs/requirements.md` `39 행` + PLAN 해당 bullet.

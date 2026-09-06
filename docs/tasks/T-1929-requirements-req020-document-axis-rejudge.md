---
id: T-1929
title: 문서 축 3 축 배선 실측으로 REQ-020 재판정 (requirements.md 39 행)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-020]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-09-06
independentStream: p5-req020-document-axis
dependsOn: [T-1928]
touchesFiles:
  - docs/requirements.md
plannerNote: "P5 REQ-020 arc closeout — T-1923·T-1925/1926·T-1927/1928 머지로 미충족 3 축이 닫혀 39 행 재판정 1 회 (doc-only, PLAN 183 행 once-rule)"
---

# T-1929 — 문서 축 3 축 배선 실측으로 REQ-020 재판정 (requirements.md 39 행)

## Why

[docs/requirements.md](../requirements.md) `39 행` REQ-020 (조직 기여 큰 인원 → 높은 점수, README `39 행`) 은 `IN_PROGRESS` 이고 그 판정 본문이 미충족 근거로 **문서 축 조직 기여 식별 축 · 결정적 점수 상향 축 · 문서 기반 코멘트 상향 축 3 개의 부재**를 든다. 그 3 축을 닫는 구현 arc 가 [T-1923](T-1923-document-contribution-signal.md) (식별 신호) → [T-1925](T-1925-document-contribution-score-uplift.md) · [T-1926](T-1926-document-contribution-uplift-pipeline-wiring.md) (등급 상향 helper + pipeline step (7) 배선) → [T-1927](T-1927-document-contribution-narrative-annotation.md) · [T-1928](T-1928-document-contribution-annotation-pipeline-wiring.md) (코멘트 marker helper + step (8) 배선) 으로 전량 머지됐다. 본 slice 는 그 실측을 근거로 REQ-020 을 **한 번** 재판정한다 — [T-1928](T-1928-document-contribution-annotation-pipeline-wiring.md) `Follow-ups (a)` 가 지목한 바로 그 작업이다.

**오너 지시 게이트 확인** (세 건 모두 회피 근거 있음):

- [PLAN](../PLAN.md) `183 행` (REQ 재판정 왕복 제거 — 구현 후 1 회만): 본 arc 에는 **구현 전 재판정이 없다** (`git log origin/main --grep=REQ-020` 결과가 T-1923 · T-1925 ~ T-1928 구현 commit 과 그 bookkeeping 뿐, 재판정 task 0). 따라서 본 slice 가 arc 의 **유일한 · 구현 직후 1 회** 재판정으로 once-rule 을 정확히 따른다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 금지): 본 slice 는 perf-spec 을 만들지 않는다 — `test/perf/` 미접촉. 금지 대상 밖.
- [PLAN](../PLAN.md) `157 행` (R-91 k6 부하검증 최우선): chain ① k6 도입은 이미 main 에 안착했다 (`package.json` `23~26 행` `test:load` / `test:load:s1~s3`, [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) 별도 job). 잔여는 ② 실 scale harness 실행 축이고 그것은 pr-mode 대형 chain 이라, cap 40 LOC · 1 파일짜리 본 doc closeout 과 자원 경합이 없다 — 오히려 REQ-020 arc 를 여기서 닫지 않으면 미충족 서술이 stale 로 남는다.

**issue-still-relevant pre-check (origin/main `54fab1e5` 실측)**: `git show origin/main:docs/requirements.md` `39 행` 은 여전히 `IN_PROGRESS (… 문서 축 조직 기여 식별 축 · 결정적 점수 상향 축 · 문서 기반 코멘트 상향 축 부재: 식별 축부터 부재다 …)` 로 3 축 부재를 단언한다 — 재판정 미반영. 반면 구현측은 `evaluation-document-contribution-signal.ts` `113 행` `computeDocumentContributionSignal`, `evaluation-document-contribution-adjust.ts` `78 행` `applyDocumentContributionUplift` · `141 행` `applyDocumentContributionAnnotation`, `evaluation-adjustments-pipeline.ts` `300 행` (step 7) · `308 행` (step 8), `evaluation-detection-signals-pipeline.ts` `121 행` `documentContribution: computeDocumentContributionSignal(deduped)`, `evaluation-orchestrator.service.ts` `177 행` `return applyEvaluationAdjustments(entries, signals)` 로 orchestrator 까지 end-to-end 배선돼 있다. 즉 문서(판정) 와 코드(사실) 의 drift 가 실재하고 본 slice 는 중복이 아니다. PLAN 쪽은 `grep -nE "REQ-020|R-39" docs/PLAN.md` 결과 `0 행` — REQ-020 전용 bullet 이 없어 PLAN 승격 대상이 없다 (아래 Out of Scope 참조).

## Required Reading

- [docs/requirements.md](../requirements.md) `39 행` — REQ-020 row. 재판정 대상. 인접 row 는 판정 본문 서술 형식 참고용 read-only.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) — 식별 축. `54 행` `DOCUMENT_CONTRIBUTION_RELATIVE_CEILING`, `68 행` `DocumentContributionSignal`, `113 행` `computeDocumentContributionSignal` (기준값 · 판정식 · 경계는 파일에서 실측 — 행 좌표는 편집 시점 재확인).
- [src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) — 점수 상향 축 + 코멘트 축. `39 행` `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL = "high"`, `78 행` `applyDocumentContributionUplift`, `121 행` `DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER = "[문서기여] "`, `141 행` `applyDocumentContributionAnnotation`.
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — 배선 사실. `300 행` step (7) document uplift 호출 · `308 행` step (8) document annotation 호출 · `314 행` flatten, 그리고 `144 행` `documentContribution: DocumentContributionSignal` 입력 계약.
- [src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `121 행` — `documentContribution` 신호가 detection 단계에서 실제로 산출되는 근거.
- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `154~177 행` — detection composer → `applyEvaluationAdjustments` 로 이어지는 운영 경로 (helper 가 caller 0 이 아님을 확인하는 근거).
- [src/assessment-evaluation/domain/summary-aggregate.ts](../../src/assessment-evaluation/domain/summary-aggregate.ts) `84~113 행` — 기존 판정 본문이 인용한 집계 좌표 (`aggregateMetricScore`, `EvaluationResult` 에 `contributionKind` 부재). 이 서술이 **여전히 사실인지** 확인해 판정에 반영한다.
- [src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts) — 기존 판정 본문이 "code 단위만 센다" 로 인용한 코드 축 신호. 문서 축이 별도 신호로 분리됐다는 사실과 대조.
- 검증 위치 열 재확인용 spec 3 종 — [evaluation-document-contribution-signal.spec.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts) · [evaluation-document-contribution-adjust.spec.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts) · [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts).
- [docs/tasks/T-1928-document-contribution-annotation-pipeline-wiring.md](T-1928-document-contribution-annotation-pipeline-wiring.md) `Follow-ups (a)` — 본 slice 를 지목한 원 지시.
- [docs/PLAN.md](../PLAN.md) `183 행` — REQ 재판정 once-rule (판정 본문에 "본 arc 1 회 재판정" 근거를 남길 때 참조).

## Acceptance Criteria

- [x] [requirements.md](../requirements.md) `39 행` REQ-020 의 status 를 **실측 후** 재판정한다. 판정 분기: 문서 축 3 축(식별 · 결정적 점수 상향 · 코멘트 상향) 이 모두 orchestrator 경로까지 배선됐고 REQ 문언("조직 기여 큰 인원 → 높은 점수") 을 충족하면 `DONE`, 잔여 축(예: 집계 층 `metricScore` 가 문서 축을 직접 가중하지 않는 문제) 이 REQ 문언상 실질 미충족으로 남으면 `IN_PROGRESS` 를 유지하되 **잔여 축을 정확히 1 개 이상 구체 좌표(파일 · 행 · 심볼)로** 적는다. 판정을 미리 정하지 말고 파일 실측이 결론을 만들게 한다.
- [x] 기존 판정 본문에서 **이미 거짓이 된 서술을 걷어낸다** — 최소한 (a) "식별 축부터 부재" (b) "`src` 전수에서 `R-39` · `REQ-020` 문자열 0 행" (c) "상대 비교 신호 2 종이 모두 code 축 전용이고 문서 기여 단위를 author 간 비교하는 신호는 0" (d) "5-adjuster 중 상향이 0" (e) "notable 소비측이 narrative marker 만 손대고 점수 반영은 별도 task" 다섯 문장이 현재 사실과 어긋나는지 각각 확인하고, 어긋나면 현재 사실로 교체한다.
- [x] 판정 본문에 문서 축 3 축의 **근거 좌표**를 심볼 단위로 남긴다 — `computeDocumentContributionSignal` (식별) · `applyDocumentContributionUplift` + `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL = "high"` (점수 상향) · `applyDocumentContributionAnnotation` + `DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER` (코멘트 상향) · pipeline step (7)(8) 배선 · orchestrator 호출. 행 좌표는 편집 시점 실측값을 쓴다.
- [x] 같은 row 의 근거 열에 shipped slice `T-1923` · `T-1925` · `T-1926` · `T-1927` · `T-1928` 을 인접 row 와 같은 표기로 추가한다.
- [x] 검증 위치 열(현재 `manual + unit`) 을 실측으로 재확인한다 — 문서 축 3 축의 실 검증체가 colocated spec 3 종인지 확인하고 그 파일명을 판정 본문에 적는다. e2e harness 가 본 REQ 문언을 직접 검증하지 않으면 열 값을 임의로 올리지 않는다.
- [x] 집계 층 처리 방침을 한 문장 이상으로 명시한다 — `aggregateMetricScore` 의 입력 타입 `EvaluationResult` 에 `contributionKind` 가 없어 일·주·월 집계가 code/document 를 구분하지 않는 점이 (가) REQ 문언상 잔여인지 (나) 단위 평가 등급 상향으로 이미 간접 반영돼 REQ 밖인지 판정 본문에서 결론을 낸다.
- [x] 좌표 표기는 CLAUDE.md §12 (정본 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.76` R1~R7) 를 따른다 — 구분자 `~` 하나, 단일 행은 `39 행`, `L` prefix 금지.
- [x] 코드 변경 0 — `git diff --stat` 결과가 [docs/requirements.md](../requirements.md) 1 파일뿐임을 확인한다 (task status · STATE · journal 은 driver bookkeeping 소관).

## Out of Scope

- **코드 변경 일절 금지** — `src/` · `web/` · `test/` 미접촉. 집계 층 `contributionKind` 확장이 잔여로 판정돼도 본 slice 에서 배선하지 않는다 (Follow-ups 에만 적는다).
- **[PLAN.md](../PLAN.md) 수정 금지** — `grep -nE "REQ-020|R-39" docs/PLAN.md` 가 `0 행` 이라 승격할 REQ-020 전용 bullet 이 없다 (P5 `104 행` bullet 은 R-25 코드 축 소관이며 이미 `[x]`). T-1928 Follow-up (a) 의 "PLAN bullet 승격" 은 대상 부재로 소멸 — 그 사실을 Follow-ups 에 한 줄로 남기고 PLAN 은 건드리지 않는다.
- REQ-020 외 다른 REQ row 수정 금지. 인접 row 는 형식 참고용 read-only.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `54 행` 동기 갱신 금지 (필요 시 Follow-ups).
- 새 ADR · architecture 문서 · spec 작성 금지. 문서 축 임계값(`DOCUMENT_CONTRIBUTION_RELATIVE_CEILING`) 재조정 논의도 본 slice 밖.
- 본 재판정 이후 REQ-020 을 **다시** 판정하는 후속 task 큐잉 금지 (PLAN `183 행` once-rule).

## Suggested Sub-agents

`implementer` (doc-only 편집). commitMode 가 `direct` 라 reviewer · integrator 경로 없음. 코드 변경 0 이므로 CLAUDE.md §3.2 R-110 의 tester 의무는 면제 대상이나, 편집 후 `git diff --stat` 으로 1 파일만 바뀌었는지 확인한다.

## Follow-ups

(a) **집계 층 `contributionKind` 분리는 본 REQ 밖으로 판정** — `aggregateMetricScore` 입력 타입 `EvaluationResult` (`src/assessment-evaluation/domain/evaluation-result.ts` 54~70 행) 와 `prisma/schema.prisma` `Contribution` 모두 `contributionKind` 컬럼이 없어 일·주·월 집계가 code/document 를 분해 보고하지 못한다. 문서 축 상향은 집계 이전 step (7) 에서 이미 반영되므로 REQ-020 문언은 충족되나, "문서 기여 비중 축별 분해 보고" 가 필요해지면 **새 REQ 채번 + 별도 arc** 로 간다 (본 재판정 이후 REQ-020 재판정 금지 — PLAN `183 행` once-rule).

(b) **T-1928 Follow-up (a) 의 "PLAN bullet 승격" 은 대상 부재로 소멸** — `grep -nE "REQ-020|R-39" docs/PLAN.md` 가 `0 행` 이라 승격할 REQ-020 전용 bullet 이 없다. P5 `104 행` bullet 은 R-25 코드 축 소관이며 이미 `[x]` 다. PLAN 미접촉으로 종결한다.

(c) **문서 축 e2e / smoke 0** — `test/` 전수에서 `문서기여` · `DocumentContribution` · `documentContribution` 참조가 0 이라 검증 위치 열을 `unit` 위로 올릴 근거가 없다. e2e harness 에 문서 축 notable 시나리오를 붙이면 열 상향 가능 (별도 pr-mode slice).

(d) **`DOCUMENT_CONTRIBUTION_RELATIVE_CEILING = 1.5` calibration 미실측** — dogfood 데이터 확보 후 임계 재조정 논의 (본 slice 밖, 상수 주석 `46~53 행` 이 자인).

(e) **[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `54 행` 동기 미갱신** — 본 slice Out of Scope 로 남긴 REQ-020 status drift. 필요 시 doc-only direct slice 1 개.

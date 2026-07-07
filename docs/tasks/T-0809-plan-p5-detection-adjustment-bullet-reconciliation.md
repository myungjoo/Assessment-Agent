---
id: T-0809
title: PLAN.md P5 detection/adjustment bullet 6종(R-21/R-58/R-26·R-40/R-37·R-38/R-25/R-27) 을 implemented-on-main 으로 checkbox 정합 — bullet 102 precedent mirror
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-011, REQ-013, REQ-021, REQ-026, REQ-037, REQ-040, REQ-058]
estimatedDiff: 55
estimatedFiles: 1
created: 2026-07-07
plannerNote: "P5 gate5 cleanup(T-0807/0808) 완결 + deploy-parity smoke sweep 소진(T-0797 Follow-up) 후, 정직한 다음 방향=P5 도메인 실측. 실측 결과 bullet 99/100/101/103/104/105 는 implemented-on-main 인데 checkbox 미정합(drift). bullet 102 precedent mirror 로 `[x]`+task/file 참조 flip. doc-only direct."
independentStream: plan-p5-bookkeeping-reconciliation
dependsOn: []
touchesFiles:
  - docs/PLAN.md
---

# T-0809 — PLAN.md P5 detection/adjustment bullet 6종 implemented-on-main checkbox 정합 (bullet 102 precedent mirror)

## Why

P5 gate5 cleanup(T-0807 ADR-0053 SUPERSEDED + T-0808 dead helper 제거) 로 overwrite/재평가 canonical source 가 ADR-0038 chain 하나로 수렴 완결됐고, deploy build-time parity smoke sweep(T-0790~0797)도 T-0797 Follow-up 이 명시적으로 "deploy 계열 마지막 genuine seam — 세 번째 parity smoke 변형 추가 금지" 로 정직 소진을 선언했다. T-0797 Follow-up 은 다음 방향으로 **(ii) P5 도메인 로직 심화 — `src/` 도메인 모듈을 genuine gap 으로 실측(추정 금지·실측 우선)** 을 지시했다.

본 planner 가 그 실측을 수행한 결과: `docs/PLAN.md` P5 phase(94~110행)의 detection/adjustment 계열 bullet 6종이 **이미 main 에 구현·배선돼 있는데 checkbox 가 `[ ]` 로 미정합(stale drift)** 임을 확인했다. 이는 make-work 가 아니라 **실재하는 PLAN↔shipped-code drift 를 교정**하는 dependency-free bookkeeping 이며 — 미교정 시 미래 planner fire 가 이미 done 인 bullet 을 genuine open work 로 오인해 재큐잉할 risk(정확히 make-work 양산의 원인)를 만든다. 같은 phase 의 bullet 102(R-41 update-count 중립화)가 이미 **`[x]` + "implemented-on-main" + 구현 task/file/PR 참조** 형식으로 정합돼 있으므로(Q-0046 옵션1 precedent), 본 task 는 그 precedent 를 mirror 해 나머지 6종을 동일 형식으로 flip 한다.

실측 확인된 implemented-on-main 매핑(각 domain 파일·구현 task·orchestrator 배선 실존 grep 확인):

1. **bullet 99 중복 제거(R-21)** — evaluation-side 시간적 중복 `evaluation-dedup.ts` `dedupTemporalDuplicates`(earlier-date 우선, T-0289, PR #241) + collection-side 구조적 중복(fork/rebase/meld) `assessment-collection/domain/commit-dedup.ts`.
2. **bullet 100 재수집 정책(R-58)** — 최근 1주 재수집·중복 방지 window `assessment-collection/domain/recollection-window.ts` + scheduling `recent-deletion-window.ts`(T-0424).
3. **bullet 101 Abusing 방지 metric(R-26/R-40)** — `evaluation-abuse-signal.ts`(신호) + `evaluation-abuse-adjust.ts` `applyAbuseSignalToVolume`(volume 중립화/감점, T-0522, PR #435).
4. **bullet 103 품질 분류(R-37/R-38)** — `evaluation-quality-signal.ts` + `evaluation-quality-adjust.ts` `applyContributionQualityFloor`(contribution floor 강등, T-0528).
5. **bullet 104 정성 평가·어렵고 남이 못할 일(R-25)** — `evaluation-notable-contribution-signal.ts` + `evaluation-notable-contribution-adjust.ts`(notable annotation, T-0534).
6. **bullet 105 저성과자 식별(R-27)** — `evaluation-underperformer-signal.ts` + `evaluation-underperformer-adjust.ts` `applyUnderPerformerAnnotation`(T-0531, PR #445).

6종 모두 `evaluation-orchestrator.service.ts` 의 `applyEvaluationAdjustments`(5-adjuster 단일 진입 composer, T-0606) + detection-signals pipeline(T-0608)으로 v1 고정 순서(abuse → update-count → quality → underperformer → notable) 배선 실존 확인. 즉 shipped·wired 이며 checkbox 만 stale 다.

## Required Reading

- `docs/PLAN.md` 94~110행 (P5 phase) — 특히:
  - 99행(R-21 중복 제거), 100행(R-58 재수집 정책), 101행(R-26/R-40 abuse), 103행(R-37/R-38 품질), 104행(R-25 정성), 105행(R-27 저성과자) = **flip 대상 6 bullet**.
  - 102행(R-41 update-count 중립화) = **format precedent 정본** — `[x]` + "**implemented-on-main**": `<task-id>` [`symbol`](../src/.../file.ts) (PR #NN, 설명) 형식을 그대로 mirror. 링크 상대경로(`../src/...`)·task/PR 참조 스타일 준수.
- (참고 — 실측 근거 재확인용, 본 task 는 이 파일들을 **읽기만**·수정 0): `src/assessment-evaluation/domain/evaluation-dedup.ts` / `evaluation-abuse-adjust.ts` / `evaluation-quality-adjust.ts` / `evaluation-notable-contribution-adjust.ts` / `evaluation-underperformer-adjust.ts` / `src/assessment-collection/domain/recollection-window.ts` / `src/assessment-evaluation/evaluation-orchestrator.service.ts`(applyEvaluationAdjustments 배선). implementer 는 링크 경로/symbol 명이 실존하는지 flip 전 grep 재확인.

## Acceptance Criteria

`docs/PLAN.md` 1개 파일만 수정한다(doc-only, direct commit — src/test/CI/schema 변경 0). 다음을 모두 만족한다:

- [ ] **6 bullet checkbox flip**: 99·100·101·103·104·105 행의 `- [ ]` 를 `- [x]` 로 바꾸고, 각 bullet 끝에 bullet 102 형식을 mirror 한 **`**implemented-on-main**:`** 절 추가 — 구현 domain 파일 상대링크(`../src/assessment-evaluation/domain/<file>.ts` 등) + 구현 task ID + (있으면) PR 번호 + 배선 위치(`applyEvaluationAdjustments`/orchestrator) 한 줄. Why 절의 6종 매핑을 근거로 정확히 박제.
- [ ] **링크/symbol 실존 검증**: 추가하는 각 상대링크 경로(`../src/...`)와 참조 symbol(`dedupTemporalDuplicates`·`applyAbuseSignalToVolume`·`applyContributionQualityFloor`·`applyUnderPerformerAnnotation` 등)이 실존함을 flip 전 `git grep`/`ls` 로 확인(존재하지 않는 경로/symbol 을 링크로 박제 금지). 확인 결과 실측 매핑과 다르면 그 bullet 은 flip 하지 말고 Follow-ups 에 불일치를 기록.
- [ ] **checkbox 상태 외 본문 보존**: 각 bullet 의 기존 REQ 참조·설명 본문은 유지하고 append-only 로 implemented-on-main 절만 추가(기존 문구 삭제/의미 변경 0). bullet 102 가 기존 본문 뒤에 절을 붙인 것과 동일 패턴.
- [ ] **P5 phase 외 라인 무변경**: 96·97·98(단위/요약/R-9 기간 평가)·107·108·109·110 등 다른 P5 bullet 과 P6/P7 섹션은 건드리지 않는다(본 task 는 detection/adjustment 6종만 — 나머지는 timezone/live-LLM/gate 얽힘으로 별도 판정 필요, 아래 Out of Scope).
- [ ] **분기 없음** — 본 task 는 순수 doc 텍스트 편집이라 코드 분기 test 항목 없음(direct doc-only commit 은 R-110 tester 면제 — CLAUDE.md §3.2). markdown 렌더 깨짐 0(링크 문법·bullet 들여쓰기 정합) 육안 확인.

## Out of Scope

- `src/`·`test/`·CI·schema·package.json 변경 0 — 순수 `docs/PLAN.md` 텍스트 편집. 코드를 새로 짜거나 고치지 않는다(구현은 이미 main 에 있음 — 본 task 는 checkbox 정합만).
- **P5 bullet 96(단위 commit/document 평가)·97(일/주/월 요약 R-61)·98(R-9 사용자 지정 기간)** flip 0 — 이 3종은 timezone(bullet 110, ADR-0052 배선 stream)·요약 경계·period 해석과 얽혀 있어 "완결" 판정에 별도 실측이 필요하다. 본 task 는 detection/adjustment 계열 6종(신호→adjust→pipeline 단일 lineage)만 다룬다. 96~98 은 다음 planner 가 별도 판정.
- **bullet 106(R-64 재실행·부분 reset)·107(overwrite/재평가)·108(live-LLM)·109(실 github e2e)·110(timezone)** checkbox 변경 0 — 106/107 은 "부분 완료"/canonical 수렴 nuance 가 있어 checkbox 유지가 의도적이고, 108/109/110 은 §5 게이트(credential/ops)·배선 stream 진행 상태가 별도라 본 bookkeeping 범위 밖.
- 새 ADR·새 architecture doc·새 REQ ID 생성 0. 기존 매핑 참조만.
- 구현이 실제로 미완이거나 링크가 실존하지 않는 bullet 을 발견하면 — 그 bullet 은 flip 하지 말고(over-claim 금지) Follow-ups 에 정확한 gap 을 기록하고 나머지만 flip.

## Suggested Sub-agents

`implementer` (doc-only direct — architect/tester 불요. `docs/PLAN.md` 6 bullet flip + implemented-on-main 절 append. flip 전 각 domain 파일 경로/symbol `git grep`/`ls` 실존 재확인이 유일한 검증 — 실존하지 않으면 그 bullet flip 보류 + Follow-up 기록. bullet 102 형식을 정확히 mirror, 기존 본문 append-only 보존, P5 외 라인·96~98·106~110 무변경. src/test/CI 변경 0 이라 tester 면제(direct doc-only R-110 예외).)

## Follow-ups

(없음 — 단, implementer 가 flip 전 실측 재확인 중 어떤 bullet 의 구현이 실제로 미완이거나 참조 domain 파일/symbol 이 실존하지 않으면(Why 절 매핑과 불일치): 그 bullet 은 flip 하지 말고 본 Follow-up 에 정확한 불일치 토큰(bullet 행번호·기대 경로·실측 결과)을 기록해 driver 에 보고 — over-claim 금지. 정상(6종 전부 실존 확인)이면 Follow-up 무변. 또한 P5 bullet 96~98 의 "완결" 판정(timezone/요약 경계/R-9 period 얽힘 실측)은 다음 planner 가 별도 task 로 다룬다 — 본 task 범위 밖.)

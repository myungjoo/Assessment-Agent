---
id: T-0572
slug: doc-update-count-neutralization-adr
title: ADR-0049 신설 — 문서 update 횟수 중립화 정책 (REQ-022 / R-41, advantage·disadvantage 둘 다 없음)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-022]
estimatedDiff: 280
estimatedFiles: 1
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0049-doc-update-count-neutralization.md
independentStream: p5-evaluation-policy-adr
blocks: []
hqOrigin: null
links:
  - docs/PLAN.md#phase-p5--evaluation-pipeline (bullet 102)
  - docs/requirements.md (REQ-022)
  - README.md (R-41)
  - docs/decisions/ADR-0029-assessment-collection-orchestrator.md (인접 — collection dedup)
  - docs/decisions/ADR-0033-evaluation-result-persistence.md (인접 — Assessment persist 키)
created: 2026-06-21
plannerNote: P5 bullet102/REQ-022 ADR-0049 신설 — update 횟수 중립화 design-level 박제(pr-mode, architect-led, dep 0)
---

# T-0572 — ADR-0049 신설: 문서 update 횟수 중립화 정책 (REQ-022 / R-41)

## Why

- [PLAN.md](../PLAN.md) Phase P5 bullet 102 ("문서 update 횟수 중립화 (R-41) — 습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage/disadvantage **둘 다 없어야**") 가 P5 evaluation pipeline 의 평가 metric 정책 중 가장 작은 독립 결정 surface 다. [requirements.md](../requirements.md) [REQ-022](../requirements.md) (line 41) 가 이를 P5 PLANNED 로 표기한다.
- 현재 어느 ADR 도 본 정책을 박제하지 않았다 — [ADR-0029](../decisions/ADR-0029-assessment-collection-orchestrator.md) 의 collection-layer dedup (commit SHA 기반) 와 [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) 의 평가 persist 키 정책은 **수집·저장 layer** 책임이고, 본 ADR 은 **평가 metric layer** 의 정성·정량 점수 도출 정책 (advantage·disadvantage 둘 다 없음 = neutralization) 을 결정한다. 직교 결정.
- Q-0045 옵션1 run-side 사슬 (T-0556 ~ T-0571) 이 닫혀 chain 이 비었고 standing 게이트 (live-LLM 검증 / P6 frontend / timezone Q-0026 / ADR-0036 stage5c / import upload) 가 모두 외부 의존 또는 미승인 상태이므로, cron 자율 진행이 가능한 forward-looking P5 정책 ADR 박제를 우선한다. 새 dependency·schema·credential 0 — [CLAUDE.md §5](../../CLAUDE.md) 게이트 어느 축도 발화 0.

## Required Reading

- [docs/PLAN.md](../PLAN.md) — Phase P5 bullet 102 (R-41 인용) 및 bullet 99 (중복 제거 R-21) / 101 (abusing 방지 R-26 + R-40) 의 인접 정책 set 위치 확인.
- [docs/requirements.md](../requirements.md) line 31 / 40 / 41 — REQ-012 (코드 abusing) / REQ-021 (문서 abusing) / REQ-022 (update 횟수 중립화) 의 매핑·이웃 관계.
- [README.md](../../README.md) line 40~41 — R-40 / R-41 의 원 표현 (raw 한국어 요구사항 본문) 인용.
- [docs/decisions/ADR-0029-assessment-collection-orchestrator.md](../decisions/ADR-0029-assessment-collection-orchestrator.md) line 27 / 64 — collection-layer dedup 결정의 surface 확인 (본 ADR 과의 직교 단언 근거).
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) — Assessment persist 키 `(period, periodStart, periodEnd)` 형태가 update 횟수 metric 과 어떻게 연결되는지 (영속 시점 vs 수집 시점) 확인.
- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](../decisions/ADR-0035-aggregate-summary-evaluation.md) — 일/주/월 요약 평가의 시간 boundary 결정 surface 가 update 횟수 합산 단위에 영향. 인접 단언.
- [docs/decisions/ADR-0048-default-model-id-source.md](../decisions/ADR-0048-default-model-id-source.md) — 가장 최근 채택된 평가-layer ADR — 본 ADR 의 frontmatter / Decision 분해 / Alternatives 표기 스타일 참고.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0049-doc-update-count-neutralization.md` 1 파일 신설. frontmatter id=ADR-0049 / title (한국어, REQ-022 명시) / status=PROPOSED (본 task 머지 후 별도 ACCEPTED flip task 또는 PR 안 단일 flip 둘 다 허용) / date=2026-06-21 / relatedTask=[T-0572] / relatedReq=[REQ-022, REQ-021, REQ-012] / supersedes=null / augments=[ADR-0029, ADR-0033] 박제.
- [ ] **Context §**: (1) trigger — README L41 인용 + REQ-022 PLANNED 위치, (2) Q (질문) — "advantage·disadvantage 둘 다 없음 = 어떻게 metric 산출 단계에서 update 횟수 영향을 제거하는가", (3) 인접 ADR-0029 (collection dedup) 와의 직교 단언 — 본 ADR 은 평가 metric layer 책임이고 수집 layer 와 직교, (4) 인접 abusing 방지 set (REQ-012 코드 abusing / REQ-021 문서 abusing) 와 본 REQ-022 의 위치 차이 — 본 REQ 는 "악의 없는 습관적 중간 저장" 까지 cover (악의 abusing 의 부분집합 아닌 더 넓은 surface).
- [ ] **Decision §1 — neutralization 단위 결정**: 한 문서 (Confluence page 또는 GitHub document 변경) 의 update 횟수가 metric 산출에 advantage / disadvantage 어느 쪽으로도 작용하지 않도록 **점수 산출 alg 단계에서 update 횟수 축을 제거** 한다. 구체 형태 (예: 최종 snapshot 1 회만 metric 계산 / 동일 author + 동일 page 의 N 회 update 를 1 event 로 합산 / update interval 임계 무관 등) 1 종 채택 + Alternatives 3 종 trade-off.
- [ ] **Decision §2 — boundary 명시**: 본 정책의 적용 surface = "동일 author + 동일 document (= 동일 Confluence page / 동일 GitHub document path) 의 N 회 update event" 1 종에 한정. 다른 author 의 같은 page update 는 별도 contribution event 로 cover (REQ-022 의 "습관적 중간 저장" 의 자연 해석).
- [ ] **Decision §3 — REQ-021 (문서 abusing) 과의 경계**: REQ-021 은 "의미 없는 기여 단순 반복" (예: 동일 내용 paste-only 반복 commit) 의 악의 abusing detect 책임. 본 REQ-022 는 악의 무관한 update 횟수 중립화 책임. 두 결정의 cover 범위는 부분 overlap 가능하나 metric 산출 단계에서 본 §1 의 neutralization 이 먼저 적용된 뒤 REQ-021 의 abusing detect 가 나중에 적용되는 순서로 박제.
- [ ] **Decision §4 — impl chain 위임 / Out of scope**: 본 ADR 은 design-level 박제만 — impl chain (어느 helper / DTO / service 가 §1 의 합산 logic 을 가지는가) 은 별도 후속 task 분해. ADR 머지 후 첫 impl slice 의 candidate (예: `src/assessment-evaluation/dto/aggregate-document-updates.ts` 같은 순수 helper) 1 줄 명시.
- [ ] **Alternatives §**: 최소 3 종 — (A) 채택안 (§1) / (B) update 횟수 = positive metric (현 default, 명시 기각) / (C) update 횟수 = penalty (의도된 disadvantage, REQ-022 위반이라 기각) — 각각 trade-off + 기각 사유 박제.
- [ ] **Consequences §**: positive 2 항 + negative 1 항 (예: positive — REQ-022 명시 cover / impl chain 의 명확한 boundary; negative — impl 시 author + page 키 join logic 의 정합 비용 1 항).
- [ ] **doc-only ADR** — 본 task 에서는 ADR 1 파일 신설 외 production code / spec / schema / config / dependency 변경 0. R-110 / R-111 / R-112 / R-113 / R-114 의 test·CI 의무는 **본 task 적용 0** (production code 변경 0 doc-only). PR CI 의 lint/build/test 는 spec 변경 0 으로 통상 green 통과 — reviewer 가 CI green + ADR 본문 정합성 + 인접 ADR (0029/0033/0035) 와의 직교 단언 확인.
- [ ] 분기 없음 — 본 task 는 doc-only ADR 신설로 production code 변경 0 이라 R-112 (4) negative cases 충분 cover 항목 적용 0 (분기 없음 명시).

## Out of Scope

- impl chain (helper / DTO / service / spec / module 등록) 은 본 task 범위 밖 — 별도 후속 task 분해.
- REQ-021 (문서 abusing detect) 의 결정 자체 — 본 ADR 은 경계 (§Decision3) 만 명시하고 REQ-021 본 결정은 별도 ADR.
- REQ-012 (코드 abusing) 의 결정 — 본 ADR 은 인접 augments 표기만, 본 결정은 별도 ADR.
- PLAN.md / requirements.md / STATE.json doc-sync (PLANNED → ADR-0049 PROPOSED 링크) — 본 task 머지 후 별도 doc-only direct task.
- ADR status PROPOSED → ACCEPTED flip — 본 task 는 PROPOSED 신설까지만 (impl chain 첫 slice 머지 시 별도 direct task 가 ACCEPTED flip).
- 새 dependency 추가 0. 새 schema migration 0. 새 credential / env 0.

## Suggested Sub-agents

`architect → reviewer → integrator`

## Follow-ups

(empty at creation — sub-agents append here when they spot related work)

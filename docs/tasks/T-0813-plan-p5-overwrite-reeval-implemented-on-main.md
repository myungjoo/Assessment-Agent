---
id: T-0813
title: PLAN.md P5 overwrite/재평가 bullet(107) implemented-on-main checkbox 정합 (ADR-0038 chain 반영, ADR-0053 SUPERSEDED 갱신)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-009, REQ-040, REQ-045, REQ-064]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-reconciliation
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: "P5 line107 overwrite/재평가 = ADR-0038 T-0333~T-0337 로 implemented-on-main. ADR-0053 SUPERSEDED 판명 후 남은 drift. T-0812 mirror, direct doc-only."
---

# T-0813 — PLAN.md P5 overwrite/재평가 bullet(107) implemented-on-main checkbox 정합

## Why

PLAN.md P5 line 107 "(DEFERRED) overwrite / 이미 영속화된 평가문 재평가" bullet 은 아직 `[ ]` 로 표기돼 있고 **SUPERSEDED 된 ADR-0053** 을 "ACCEPTED, 구현 chain 은 §Follow-ups 대기" 인 것처럼 참조한다. 그러나 실제로는 동일 mechanism 이 **선행 ADR-0038 (ACCEPTED 2026-06-10) 의 구현 chain T-0333~T-0337 로 이미 main 에 안착**했다 — DTO `reevaluate` flag (T-0333), controller mode dispatch (`assessment-evaluation.controller.ts` L241 `dto.mode === "reeval" ? "reeval" : "fill"` → `persist(context, results, mode)`, T-0336), orchestration first-write-wins opt-out (T-0335), e2e (`test/e2e/period-bridge-reevaluate.e2e-spec.ts`, T-0337). T-0807 이 ADR-0053 을 ADR-0038 의 중복 재결정으로 SUPERSEDED 표기했고 T-0808 이 dead helper 를 제거했으므로, ADR-0053 §Follow-ups chain 은 착수 대상이 아니다. 본 task 는 line 107 을 implemented-on-main 상태로 정합해 이 drift 를 닫는다 (T-0809/T-0812 checkbox 정합 패턴 mirror). PLAN.md P5 phase (line 94~110) 정합.

## Required Reading

- `docs/PLAN.md` line 106~108 (P5 overwrite/재평가 bullet + 인접 context)
- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` (canonical ACCEPTED mechanism — line 1~40 frontmatter/Status/Context)
- `docs/decisions/ADR-0053-overwrite-reeval-mechanism.md` line 1~18 (SUPERSEDED frontmatter + supersededBy: ADR-0038 표기)

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 107 의 checkbox 를 `[ ]` → `[x]` 로 변경 (overwrite/재평가 mechanism 이 implemented-on-main 임을 반영).
- [ ] 본문에 **implemented-on-main** 절 추가 — canonical source = ADR-0038 (ACCEPTED 2026-06-10), 구현 chain = T-0333~T-0337, 실제 배선 지점 명시: DTO `reevaluate` flag (period-bridge.dto.ts) + controller mode dispatch (`assessment-evaluation.controller.ts` `persist(context, results, mode)`) + orchestration first-write-wins opt-out + e2e (`test/e2e/period-bridge-reevaluate.e2e-spec.ts`). 참조 경로/식별자는 영어 유지 (§12).
- [ ] ADR-0053 참조를 SUPERSEDED 상태로 갱신 — "ADR-0053 은 ADR-0038 중복 재결정으로 SUPERSEDED (T-0807), canonical = ADR-0038" 한 줄 명시. 기존의 "ADR-0053 ACCEPTED, 구현 chain 은 §Follow-ups 대기" 오정보 제거.
- [ ] `(DEFERRED)` 라벨은 R-64 잔여 semantics 에 맞게 처리 — line 106 (unevaluated-fill-run 부분 완료) 과 line 107 (overwrite/재평가) 의 관계를 유지하되, line 107 자체의 overwrite/재평가 mechanism 은 완결됐음을 명확히. 과잉 서술 금지 (bullet 1개 ≤ 8 줄 유지, T-0812 mirror).
- [ ] 변경은 line 107 bullet 본문에 국한 — 다른 P5 bullet·다른 phase 미변경 (git diff 로 line 107 영역만 변경 확인).
- [ ] origin/main 실측 재확인 — 본 정합이 이미 반영되지 않았음(현재 line 107 `[ ]` + ADR-0053 참조)을 커밋 전 확인 (issue-still-relevant).

## Out of Scope

- 코드 변경 일절 금지 (doc-only). `src/`·`test/`·ADR 파일 미변경.
- ADR-0053 frontmatter/본문 재편집 금지 (이미 T-0807 이 SUPERSEDED 표기 완료 — 재차 손대지 않는다).
- ADR-0038 편집 금지 (canonical, 이미 ACCEPTED).
- line 106 (unevaluated-fill-run) / line 108~110 (live-LLM / 실 e2e / timezone) 의 checkbox·본문 변경 금지 — 본 task 는 line 107 국한.
- 새 use case / requirements.md 편집 금지.
- ADR-0053 §Follow-ups slice 1~4 를 신규 task 로 큐잉 금지 (SUPERSEDED chain — 착수 대상 아님).

## Suggested Sub-agents

`implementer` 없이 driver 직접 direct doc-only 처리 가능 (T-0812 와 동일 경로). doc-only direct commit 이라 tester 불요 (§3.2 R-110 doc-only 면제).

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)

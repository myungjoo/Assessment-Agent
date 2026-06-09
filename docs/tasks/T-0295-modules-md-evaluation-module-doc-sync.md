---
id: T-0295
title: modules.md 에 11번째 shipped module AssessmentEvaluationModule 정합 (P5 평가 backbone doc-sync)
phase: P5
status: DONE
completedAt: 2026-06-09T02:55:00Z
commitMode: direct
coversReq: [REQ-038, REQ-049]
estimatedDiff: 65
estimatedFiles: 1
created: 2026-06-09
plannerNote: P5 — T-0294 Out of Scope 분리분. 머지된 AssessmentEvaluationModule(controller+orchestrator+scoring+LlmModule)이 modules.md 에 미박제(10→11 module). doc-only direct.
---

# T-0295 — modules.md 에 11번째 shipped module AssessmentEvaluationModule 정합 (P5 평가 backbone doc-sync)

## Why

P5 평가 chain (T-0287~T-0293) 이 머지되면서 `src/assessment-evaluation/` 에 **실제로 shipped 된 11번째 module** `AssessmentEvaluationModule` (controller 1 + service 2 + LlmModule import) 이 존재한다. 그러나 `docs/architecture/modules.md` 는 이 module 을 전혀 박제하지 않았고, P5 평가 책임을 여전히 P1 placeholder 인 legacy `AssessmentModule` row (현 line 39) 에 귀속시키고 있어 doc ↔ shipped reality 가 불일치다. T-0294 의 Out of Scope 가 본 정합을 별도 task 로 분리했다 (cap / concern 격리). 본 task 는 modules.md 한 파일만 머지된 코드 기준으로 정합한다 (REQ-038 평가 조회/REQ-049 LLM 사용 backbone 의 문서화).

## Required Reading

- `docs/architecture/modules.md` — 정합 대상. 특히 line 3 (머리말 chain 이력), line 22/44/126/146/183/196/234 ("10 module" 카운트 표현 8 site), line 39 (legacy `AssessmentModule` row), line 40 (`AssessmentCollectionModule` row — 신규 row 작성 시 동형 패턴 참조), line 55~110 부근 (mermaid graph — `assessmentCollection` 노드 정의/edge 참조), line 188~196 (component↔module N:N mapping, 특히 line 189 Worker mapping)
- `src/assessment-evaluation/assessment-evaluation.module.ts` (origin/main) — 박제할 module 의 정확한 구성: `imports: [LlmModule]`, `controllers: [AssessmentEvaluationController]`, `providers: [EvaluationScoringService, EvaluationOrchestratorService, {provide: LLM_GATEWAY, useExisting: LlmHttpGateway}]`, `exports: [EvaluationScoringService, EvaluationOrchestratorService]`
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (origin/main) — `@Controller("api/assessment-evaluation")` + `@Post("evaluate")`
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` (origin/main) — 평가 계약 ADR (cross-ref 링크 대상; status flip 은 본 task 밖)
- `docs/tasks/T-0276-collection-manual-trigger-doc-sync.md` — 직전 module doc-sync 패턴(머리말 chain 추가 + row 정합) mirror 참조

## Acceptance Criteria

- [ ] modules.md 의 module table 에 `AssessmentEvaluationModule` row 1개 신규 추가 — 책임(P5 평가 backbone: `EvaluationOrchestratorService` 가 `Activity[]`→매퍼→dedup→`scoreUnit`→`EvaluationResult[]`, `EvaluationScoringService` 가 prompt 조립→`LlmGateway.generate`→classify+volume), 구성(controller `AssessmentEvaluationController` POST `/api/assessment-evaluation/evaluate` Admin RBAC + service 2 `EvaluationOrchestratorService`/`EvaluationScoringService` + `LLM_GATEWAY` useExisting `LlmHttpGateway` 바인딩), 의존(LlmModule import 단방향), component mapping, REQ, ADR-0032 cross-ref 를 line 40 `AssessmentCollectionModule` row 와 동형으로 박제.
- [ ] legacy `AssessmentModule` row (line 39) 를 머지된 reality 와 정합 — P5 평가가 실제로는 별도 `AssessmentEvaluationModule` 로 shipped 되었음을 명시 (legacy row 가 평가 책임을 독점하는 stale 서술 정정). 단 legacy `AssessmentModule` 의 잔여 책임(결과 조회·sort·filter·시계열 controller 등 미shipped 부분)은 보존.
- [ ] "10 module" 카운트 표현 전 site (line 22/44/126/146/183/196/234 등 grep 으로 전수) 를 "11 module" 로 정합. 누락 site 0 (`git grep -n "10 module" docs/architecture/modules.md` 결과 0건이어야 함).
- [ ] line 189 Worker N:N mapping 정정 — P5 평가 service layer 를 `AssessmentModule` 이 아니라 `AssessmentEvaluationModule` 로 귀속 (또는 두 module 의 평가 책임 경계 명시). line 196 요약 문장의 module 카운트/분할 서술도 동기.
- [ ] mermaid graph (line 55~110 부근) 에 `assessmentEvaluation["AssessmentEvaluationModule"]` 노드 + `assessmentEvaluation --> llm` edge (LlmModule 의존) 추가. 노드 색상 분류(domain modules 회색 박스, line 128) 도 동기.
- [ ] 머리말 chain 이력 (line 3) 끝에 본 task (T-0295) 가 11번째 shipped module `AssessmentEvaluationModule` (T-0291 신설/T-0293 controller / ADR-0032, P5 평가 backbone) 을 정합했다는 한 문장 append — T-0276 패턴 mirror.
- [ ] 분기 없음 — 순수 문서 정합 task 라 unit test / coverage 항목 비적용 (doc-only direct, CLAUDE.md §3.2 코드 test 규칙 면제 대상). 검증은 `git grep -n "AssessmentEvaluationModule" docs/architecture/modules.md` 가 신규 row + mermaid 노드 + 머리말 + Worker mapping 에서 매칭되고, `git grep -n "10 module" docs/architecture/modules.md` 가 0건임으로 갈음.

## Out of Scope

- ADR-0032 (`ADR-0032-p5-evaluation-contract.md`) 의 `status: PROPOSED → ACCEPTED` flip + relatedTask append — 별도 task (T-0296 후보) 로 분리. 본 task 는 modules.md 만.
- `docs/architecture/api.md` 추가 변경 — T-0294 에서 평가 endpoint row 이미 박제됨.
- `src/` 코드 변경 일절 금지 — 본 task 는 modules.md doc-sync 만 (shipped reality 를 따라가는 문서 정합이지 코드 수정 아님).
- 다른 architecture doc (data-model.md / directory.md / components) 정합 — 필요 시 Follow-ups 에 적고 별도 task.
- legacy `AssessmentModule` 의 미shipped 평가 결과 조회/시계열 controller 를 신규 박제하거나 구현하는 일 (아직 코드 없음 — stale row 정정만, 신규 기능 서술 추가 금지).

## Suggested Sub-agents

`architect → (driver direct commit)` — doc-only direct commit 이므로 implementer/tester 불요. architect 가 modules.md 정합 초안을 작성하고 driver 가 direct commit. (executor 가 doc-only 판단 시 architect 도 생략하고 driver 직접 편집 가능 — modules.md 단일 파일 정합이라 경량.)

## Follow-ups

(작성 시 비어있음. sub-agent 가 관련 작업 발견 시 여기에 append.)

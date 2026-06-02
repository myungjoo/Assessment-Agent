---
id: T-0166
title: modules.md LlmModule 행에 T-0165 난이도 기반 config routing 박제 doc-sync
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-097]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 dependency-free 잔여 — T-0165(난이도 routing wiring) 머지 후 modules.md LlmModule 행이 resolve hop·REQ-097 미반영. doc-only inline-amend, §5 미발화.
---

# T-0166 — modules.md LlmModule 행에 T-0165 난이도 기반 config routing 박제 doc-sync

## Why

[PLAN.md](../PLAN.md) Phase P4 L86 "**3가지 난이도 모델 할당** (R-97)" 의 런타임 wiring (T-0165, PR-153, 머지 commit `78fa7e7`) 이 main 에 박제됐다. `LlmHttpGateway.generate()` 가 이제 `options.difficulty` 가 주어지면 `DifficultyMappingService.resolveModel(difficulty)` 로 그 난이도 슬롯의 `configId` 를 얻어 config 를 조회하고, 미제공 시 종전대로 `options.modelId` 를 직접 사용하는 routing 분기를 갖는다.

그러나 [modules.md](../architecture/modules.md) 의 LlmModule 행 (L37) 은 gateway 의 runtime path 를 여전히 "config lookup → `LlmApiKeyCipher` decrypt → provider 별 adapter dispatch → fetch → `LlmGenerateResult`" 로만 기술하고, **그 앞단의 난이도 기반 config 선택 resolve hop (T-0165)** 을 반영하지 않는다. REQ 컬럼에도 REQ-097 (난이도별 모델 라우팅) 이 누락돼 있다. modules.md 는 planner / sub-agent 가 코드 진입 전 가장 먼저 읽는 architecture 인덱스 (CLAUDE.md §7) 이므로 실제와의 drift 가 후속 task 오독을 유발한다. 본 task 는 T-0163 (gateway orchestration doc-sync) / T-0164 (ADR-0006 ACCEPTED) 와 동일 패턴의 순수 문서 정합이다.

이 작업은 **dependency-free** — doc-only inline-amend, 새 외부 dependency 0 / 외부 credential 0 / schema 변경 0 / 코드 변경 0 / §5 미발화.

## Required Reading

- `docs/architecture/modules.md` L37 — 수정 대상 LlmModule 행. "milestone-1 구현 박제" 문장과 REQ 컬럼 (현재 `REQ-049 (Admin 모델 지정), REQ-051~055 (5 provider)`).
- `src/llm/llm-http-gateway.service.ts` (머지된 reality, commit `78fa7e7`) — `generate()` 의 config id 결정 분기 (`options.difficulty === undefined ? options.modelId : resolveModel(...).configId`) 와 생성자의 `DifficultyMappingService` 주입. 박제 문구의 정확성 근거.
- `docs/tasks/T-0165-llm-gateway-difficulty-routing.md` — T-0165 의 정확한 변경 범위 (resolve hop 연결만, interface 불변).

## Acceptance Criteria

- [ ] modules.md L37 LlmModule 행의 "milestone-1 구현 박제" 문장에 **난이도 기반 config routing 의 resolve hop** 을 1 절로 추가: gateway 가 `options.difficulty` 제공 시 `DifficultyMappingService.resolveModel(difficulty)` 로 난이도 슬롯의 `configId` 를 해석해 config 를 조회하고, 미제공 시 `options.modelId` 직접 사용 (T-0165, PR-153) 임을 명시.
- [ ] 같은 행 REQ 컬럼에 `REQ-097` (난이도별 모델 라우팅) 추가.
- [ ] 기존 "실 endpoint 호출의 평가 파이프라인 연결 ... §5 HITL 게이트로 미착수" 문구는 유지 (실 통합은 여전히 미승인 — drift 금지).
- [ ] 코드 / spec / schema / 다른 doc 파일 변경 0 (modules.md 1 파일만 수정).
- [ ] 변경이 inline-amend 범위 (LlmModule 행 1 곳 + REQ 컬럼) 를 벗어나지 않음 — 행 전면 재작성 금지.

## Out of Scope

- api.md / data-model.md 등 다른 architecture doc 수정 (그쪽은 난이도 routing 이 endpoint/entity 레벨 변경을 동반하지 않으므로 현 시점 drift 아님 — 필요 시 별도 follow-up).
- 코드 / spec 변경 (T-0165 가 이미 머지 — 본 task 는 문서 정합만).
- LlmModule 행의 다른 부분 (provider 목록 · adapter 목록 · write CRUD) 재서술 — 이미 T-0163 에서 정합. 본 task 는 difficulty routing 절 + REQ-097 추가만.
- 실 LLM HTTP 통합 / credential / env 주입 관련 문구 추가 (§5 게이트, 미승인 유지).
- PLAN.md L86 체크박스 변경 (난이도 routing 은 P4 milestone-1 의 일부일 뿐 P4 전체 완료 아님 — 별도 판단).

## Suggested Sub-agents

(direct doc-only — sub-agent 불요. driver 가 executor 없이 직접 Edit 후 main commit. tester 면제 — R-110 direct doc-only.)

## Follow-ups

(생성 시 비어 있음. sub-agent 가 발견 시 append:)

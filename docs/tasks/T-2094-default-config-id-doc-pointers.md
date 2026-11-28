---
id: T-2094
title: ADR-0062 §Decision 4 와 REQ-049 근거 셀이 가리키는 삭제된 resolveDefaultModelId 를 resolveDefaultConfigId 로 정정한다
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-049]
estimatedDiff: 6
estimatedFiles: 2
created: 2026-11-28
independentStream: evaluation-tick-llm-config
dependsOn: [T-2093]
touchesFiles: [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md, docs/requirements.md]
plannerNote: P7 · T-2093 Follow-up — 삭제된 resolveDefaultModelId 를 가리키는 ADR-0062 · REQ-049 근거 2 곳 pointer 정정 (doc-only)
---

# T-2094 — ADR-0062 §Decision 4 와 REQ-049 근거 셀이 가리키는 삭제된 resolveDefaultModelId 를 resolveDefaultConfigId 로 정정한다

## Why

T-2093 (PR #1653, `9a801c8f`) 이 소비처 0 인 `LlmProviderConfigResolver.resolveDefaultModelId` 를 지웠다. 그런데 문서 2 곳이 아직 그 symbol 을 현재 판정 지점으로 가리킨다.
- `docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md` `99 행` §Decision 4 채택문 — T-2093 §Follow-ups 가 pointer 한 줄을 달라고 남겼다.
- `docs/requirements.md` `68 행` REQ-049 근거 셀 — "`src/llm/llm-provider-config-resolver.service.ts` 45 행 `resolveDefaultModelId()`" 로 적혀 있다. 이 symbol 은 이제 없고, 지금 판정은 같은 파일 `49 행` `resolveDefaultConfigId()` (private `resolveDefaultRow` 의 (0)/(b)/(c) 분기를 거쳐 config id 를 반환) 가 한다.

이 task 는 구현 arc 가 끝난 뒤의 drift 정정이다 (CLAUDE.md §3.1 예외). REQ-049 status 는 다시 판정하지 않는다. ADR 정정은 결정 내용을 바꾸지 않는 pointer 수정이라 `direct` 다. issue-still-relevant 확인: origin/main `430317d3` 에서 두 곳 모두 옛 symbol 을 그대로 가리킨다.

## Required Reading

- `docs/tasks/T-2093-remove-resolve-default-model-id.md` §Follow-ups
- `src/llm/llm-provider-config-resolver.service.ts` `38~90 행` (`resolveDefaultConfigId` / `resolveDefaultRow` 의 실제 행 번호와 분기)
- `docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md` `97~105 행` (§Decision 4)
- `docs/requirements.md` `68 행` (REQ-049 행 — 셀 안에서 `resolveDefaultModelId` 가 나오는 구간만)

## Acceptance Criteria

- [ ] ADR-0062 §Decision 4 채택문 (`99 행`) 바로 아래에 pointer 한 줄을 단다. 내용은 "T-2093 이후 이 판정은 `resolveDefaultConfigId` 가 맡고 modelId 가 아니라 config id 를 반환한다 (판정 순서는 그대로)" 이다. 채택문 원문과 1~4 번 목록은 고치지 않는다.
- [ ] `docs/requirements.md` REQ-049 셀의 "45 행 `resolveDefaultModelId()`" 를 실제 행 번호의 `resolveDefaultConfigId()` 로 바꾼다. 행 번호는 Required Reading 의 resolver 파일에서 다시 확인하고, (0)/(b)/(c) 판정 서술은 그대로 둔다. REQ-049 의 status 값과 셀의 다른 근거는 고치지 않는다.
- [ ] `git grep -n "resolveDefaultModelId" -- docs ':!docs/tasks' ':!docs/progress'` 의 결과로 `ADR-0057` `136 행` (당시 기록) 과 ADR-0062 의 원문 채택문만 남는다.
- [ ] 행 범위 표기는 CLAUDE.md §12 규칙을 따른다 (`49 행`, `L` prefix 금지).
- [ ] 변경 파일은 위 2 개뿐이다 (`git diff --stat`).

## Out of Scope

- `docs/decisions/ADR-0057-s1-batch-load-io-isolation.md` `136 행` — 당시 기록이라 손대지 않는다 (T-2093 Follow-up 지시).
- REQ-049 의 status 재판정, 그리고 다른 REQ 행 수정.
- `src/` 의 주석과 spec. spec 안의 "T-2093 에서 지워져" 주석은 의도된 기록이다.
- ADR-0062 의 Status 줄과 결정 내용 변경.

## Suggested Sub-agents

`implementer` 하나 (doc-only direct). tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct doc-only 면제).

## Follow-ups

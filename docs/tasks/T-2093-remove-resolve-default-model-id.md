---
id: T-2093
title: 소비처가 0 이 된 LlmProviderConfigResolver.resolveDefaultModelId 를 지워 config id 자리에 modelId 를 넘기는 결함을 구조적으로 막는다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-041]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-11-26
independentStream: evaluation-tick-llm-config
dependsOn: [T-2092]
touchesFiles: [src/llm/llm-provider-config-resolver.service.ts, src/llm/llm-provider-config-resolver.service.spec.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts, src/scheduling/evaluation-tick-runner.service.spec.ts]
plannerNote: P7 · T-2092 Out-of-Scope 후속 — 소비처 0 이 된 resolveDefaultModelId 삭제, 같은 결함 3 회 재발 구조 차단
---

# T-2093 — resolveDefaultModelId 삭제

## Why

같은 결함이 세 번 나왔다. 재수집 runner (T-2073), 자동 평가 tick (T-2091), `POST /unevaluated-fill-run` (T-2092) 이 모두 `resolveDefaultModelId()` 가 돌려준 **modelId** 를 gateway 의 **config id** 자리에 넘겼다. `LlmHttpGateway.generate` 는 difficulty 가 없으면 `options.modelId` 를 config id 로 조회한다 (`src/llm/llm-http-gateway.service.ts` `109 행` ~ `114 행`). 그래서 세 경로 모두 "LLM provider config 를 찾을 수 없습니다" 로 평가가 실패했다. 세 곳을 모두 `resolveDefaultConfigId()` 로 고친 지금 `resolveDefaultModelId` 의 production 소비처는 0 이다. T-2092 Out of Scope 가 "소비처가 0 이 되면 별도 task 로 판단" 이라고 남긴 그 판단이 본 task 다. 메서드가 남아 있으면 새 호출처가 같은 실수를 반복할 수 있다. 지우면 잘못 부르는 코드가 compile 단계에서 막힌다.

동작 변경은 없다 (호출처 0). 기본 provider 판정 규칙 (ADR-0062 §Decision 4 의 4 분기: 슬롯 → row 1 개 → row 0 fail-fast → row ≥ 2 fail-fast) 은 `resolveDefaultRow()` 와 `resolveDefaultConfigId()` 에 그대로 남는다. 기존 ADR 범위 안의 refactor 이고 새 dependency · schema · auth 변경이 없어 §5 자동 진행 대상이다.

issue-still-relevant 확인 (origin/main `090c4a8f`):

- `git grep -n "resolveDefaultModelId" -- src test web` 의 non-spec hit 는 정의부뿐이다 — `src/llm/llm-provider-config-resolver.service.ts` `37 행` (주석) · `45 행` (메서드) · `53 행` (`resolveDefaultConfigId` JSDoc 의 `@throws`). 호출처는 0 이다.
- spec hit 는 3 파일이다. `src/llm/llm-provider-config-resolver.service.spec.ts` (`123 행` test 이름, `146 행` ~ `371 행` describe 전체), `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` (`3524 행` ~ `3543 행` `modelIdSpy`, `3628 행`, `3741 행` ~ `3753 행`), `src/scheduling/evaluation-tick-runner.service.spec.ts` (`22 행` mock 키, `131 행` not-called 단언).
- `test/` · `web/` · `docs/architecture/` 에는 hit 가 없다. `docs/decisions/ADR-0057` `136 행` · `ADR-0062` `99 행` 은 결정 당시 기록이라 본 task 에서 고치지 않는다 (Follow-ups 참고).

## Required Reading

- `src/llm/llm-provider-config-resolver.service.ts` 전체 (119 줄) — 고칠 곳. 머리 주석 `1 행` ~ `20 행`, `resolveDefaultModelId` `37 행` ~ `47 행`, `resolveDefaultConfigId` `49 행` ~ `59 행`, `normalizeModelId`.
- `src/llm/llm-provider-config-resolver.service.spec.ts` (colocated spec, 371 줄) — 고칠 곳. `70 행` ~ `144 행` `resolveDefaultConfigId()` describe 와 `146 행` ~ `371 행` `resolveDefaultModelId()` describe.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `3510 행` ~ `3545 행` (`makeRunController`), `3620 행` ~ `3632 행`, `3738 행` ~ `3756 행` (T-2092 regression test) — 고칠 곳.
- `src/scheduling/evaluation-tick-runner.service.spec.ts` `18 행` ~ `25 행` (`setup` 의 resolver mock), `120 행` ~ `132 행` — 고칠 곳.
- `src/llm/llm-http-gateway.service.ts` `96 행` ~ `125 행` — gateway 가 `options.modelId` 를 config id 로 조회하는 근거 (읽기만).

## Acceptance Criteria

- [ ] `LlmProviderConfigResolver` 에서 `resolveDefaultModelId()` 메서드를 지운다. `resolveDefaultConfigId()` 의 반환 · 오류 계약은 바꾸지 않는다 — 고른 row 의 `id` 를 반환하고, 슬롯 깨짐 · row 0 · row ≥ 2 는 기존 한국어 `Error`, 고른 row 의 modelId 형식 위반 (빈 · 공백 · non-string) 은 `TypeError` 다.
- [ ] resolver 주석을 고친다. 머리 주석의 "row 의 `modelId` 또는 config `id` 를 반환" · "(0) … config 의 modelId" 서술을 "config `id` 를 반환" 으로 바꾸고, 4 분기 판정 규칙 설명과 ADR-0048 · ADR-0062 · T-1864 같은 역사 사실은 남긴다. `resolveDefaultConfigId` JSDoc 의 `@throws resolveDefaultModelId 와 같은 오류` 를 오류 목록으로 직접 적는다. "modelId 를 반환하는 메서드를 두지 않는다 — gateway 가 config id 로 조회하므로 (T-2073 · T-2091 · T-2092)" 한 줄을 더한다.
- [ ] (happy-path) colocated spec `src/llm/llm-provider-config-resolver.service.spec.ts` 의 `resolveDefaultModelId()` describe 를 `resolveDefaultConfigId()` 대상으로 옮긴다. 기대값은 modelId 가 아니라 config id 다. (0) 슬롯 hit (row 3 개여도 슬롯의 id) 와 (a) 단일 row 의 id 반환 test 가 각 1+ 있다. 앞뒤 공백 modelId test 는 "형식 검증을 통과하고 id 를 반환한다" 로 바꾼다.
- [ ] (error path) (0) 깨진 슬롯 FK · (b) row 0 · (c) row 2 · (c) row 3 의 한국어 메시지 test 가 `resolveDefaultConfigId()` 대상으로 각 1+ 남는다.
- [ ] (분기) 4 분기 (0)/(a)/(b)/(c) 각각에 test 1+ 가 있다. 첫 describe 와 겹치는 test 는 하나로 합친다. 분기 단언이 줄어들면 안 된다.
- [ ] (negative) 의존성 실패 (`findSlot` reject · `findMany` reject 를 그대로 전파) 와 type mismatch (modelId 가 빈 문자열 · whitespace · number · null · undefined → `TypeError`) test 를 `resolveDefaultConfigId()` 대상으로 모두 남긴다. 슬롯 경로의 modelId 형식 위반 test 도 남긴다. 예외 분기마다 1+ 다.
- [ ] (regression) controller spec 의 `makeRunController` 에서 `modelIdSpy` 와 `resolveDefaultModelId` mock 키를 지운다. T-2092 regression test 는 "orchestrator 3 번째 인자가 `resolveDefaultConfigId` 반환값이다" 단언을 유지한다 (`resolveDefaultModelId` not-called 단언은 메서드가 없어져 compile 로 보장된다는 주석으로 바꾼다). tick runner spec 의 `resolveDefaultModelId` mock 키와 `not.toHaveBeenCalled` 단언도 같은 방식으로 정리하고, `{ modelId: "cfg" }` 단언은 유지한다.
- [ ] 검증 명령: `git grep -n "resolveDefaultModelId" -- src test web` 결과에 새로 쓴 "메서드가 없어 compile 로 막힌다" 류 주석 외 hit 가 없다.
- [ ] R-110 — tester 가 `pnpm lint && pnpm build && pnpm test` 를 돌려 green 을 확인한다 (`pnpm build` 가 삭제된 메서드를 부르는 남은 코드가 없음을 보장한다).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] PR CI 의 unit · smoke · e2e 가 모두 green (R-113).
- [ ] 4 파일 외 변경 0. 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 주석에만 적용한다.

## Out of Scope

- `normalizeModelId` · `resolveDefaultRow` 의 이름 · 동작 변경. modelId 형식 검증은 그대로 둔다.
- orchestrator · core · `buildFillRunScoringOptions` 의 `defaultModelId` 매개변수 이름 변경, `ScoringOptions.modelId` · `LlmGenerateOptions.modelId` 필드 이름 변경 (API · 다수 소비처로 번지는 별도 판단).
- `LlmHttpGateway` 변경.
- `docs/decisions/ADR-0057` · `ADR-0062` 의 `resolveDefaultModelId` 서술 수정 (docs 라 `direct` 로 따로 간다 — mixed 금지).
- `test/e2e/*` 변경 (hit 0).

## Suggested Sub-agents

implementer → tester (기존 ADR 범위 안의 dead code 제거라 architect 불필요).

## Follow-ups

- (planner) 머지 후 `direct` task 후보: `docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md` `99 행` §Decision 4 에 "T-2093 이후 판정은 `resolveDefaultConfigId` (config id 반환) 가 맡는다" pointer 한 줄을 단다. ADR-0057 `136 행` 은 당시 기록이라 손대지 않는다.

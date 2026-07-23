---
id: T-1133
title: LlmProviderConfigList presentational 컴포넌트 (LLM provider 설정 목록 읽기 전용 렌더)
phase: P6
status: DONE
completedAt: 2026-07-23T04:54Z
prNumber: 1025
mergeCommit: 956a9c02
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-composition
dependsOn: []
touchesFiles:
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
plannerNote: P6 line87 R-96 LLM provider 관리 UI 잔여 — backend GET/POST/PATCH/DELETE 완결, 관리 목록 UI 부재. presentational-first slice(T-0361~T-0375 관례)로 착수.
---

# T-1133 — LlmProviderConfigList presentational 컴포넌트

## Why

PLAN.md line 87 은 R-96(Admin 이 LLM 모델 지정) 의 backend 는 완결(`GET /api/llm/providers` + `POST/PATCH/DELETE`)이나 **UI 는 P6 frontend phase 잔여**임을 명시한다. 현재 provider 목록은 DifficultyModelSelector 의 `<option>` 으로만 소비될 뿐, provider 설정 자체를 목록으로 열람·관리하는 UI 가 없다. 본 slice 는 그 관리 UI 의 첫 building block 으로, sanitized provider view(`LlmProviderConfigView` — apiKey 제외 6 필드)를 읽기 전용으로 렌더하는 순수 presentational 컴포넌트를 신설한다. AdminView 배선·생성/수정/삭제 mutation 은 후속 slice(Follow-ups)로 분리해 cap 을 지킨다 — presentational 을 먼저 만들고 나중에 배선하는 것은 P6 의 확립된 관례(T-0361~T-0375 → T-0378~T-0394)다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — presentational controlled list 의 props/분기(loading·error·empty·populated)/named+default export convention 참조(1:1 mirror 대상).
- `web/src/components/DifficultyModelSelector.tsx` (상단 `ProviderOption` interface 부분) — provider row 표시 필드(id/provider/modelId) 참조.
- `src/llm/llm-provider-config.service.ts` (72~76행 `LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">`) — 노출 가능 view shape(id / provider / endpointUrl / modelId / createdAt / updatedAt). **apiKey 는 view 에 없음 — 절대 렌더 대상 아님**.
- `web/src/components/GroupMemberList.test.tsx` — colocated spec 의 describe/it 구조·렌더 검증 패턴 참조.

## Acceptance Criteria

- [ ] `web/src/components/LlmProviderConfigList.tsx` 신설 — sanitized provider view 배열(`{ id, provider, endpointUrl, modelId }` 이상)을 props 로 받아 각 행을 렌더하는 순수 presentational controlled 컴포넌트. GroupMemberList 와 동일하게 `loading` 우선 → `error`(role="alert") → 빈 배열(빈 상태 문구, `emptyMessage` fallback) → 목록 렌더의 분기 정책을 따른다. named export type + default export convention 준수.
- [ ] apiKey 등 secret 필드는 props 타입에도 렌더에도 포함하지 않는다(view 타입 자체에 없음).
- [ ] Happy-path unit test 1+ — provider 배열 주입 시 각 행의 provider/modelId/endpointUrl 이 렌더되는지 검증.
- [ ] Error path unit test 1+ — `error` truthy 시 role="alert" 렌더 + 목록 미렌더 검증.
- [ ] Flow / branch coverage — loading 우선 분기 / error 분기 / 빈 배열(빈 상태 문구 + `emptyMessage` fallback) 분기 / 정상 목록 분기 각 1+ test.
- [ ] Negative cases 충분 cover — 빈 배열, `emptyMessage` 빈 문자열(기본 문구 fallback), 빈 문자열 `error`(falsy → 목록 렌더 유지 경계값), 선택 필드(`endpointUrl`/`modelId`) 누락 시 throw 없이 렌더 등 예외 상황을 각 1+ test.
- [ ] `pnpm --filter web test`(vitest) 통과 + `tsc`/`vite build` green. web 에 `coverageThreshold` 가 설정돼 있으면 line ≥ 80% / function ≥ 80% 통과.
- [ ] 코드 주석·describe/it 문자열은 한국어(§12), 식별자/경로/HTTP 토큰은 영어 유지.

## Out of Scope

- AdminView 로의 mount·fetch(GET /api/llm/providers) 배선 — 별도 후속 slice.
- provider 생성(POST)/수정(PATCH)/삭제(DELETE) mutation UI 및 콜백 — 별도 후속 slice.
- `web/src/api/apiClient.ts`·`useApiResource.ts`·backend 코드 수정(0 LOC).
- DifficultyModelSelector·기존 컴포넌트 수정.
- EvaluationGuardBanner 자동 polling(별도 backend 계약 필요 — line 123 잔여).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비움 — sub-agent 가 관련 작업 발견 시 append)

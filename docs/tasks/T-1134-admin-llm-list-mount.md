---
id: T-1134
title: AdminView 에 LlmProviderConfigList 마운트 + provider view 파생 (읽기 전용 표시 배선)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-composition
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line87 R-96 LLM provider 관리 UI — T-1133 presentational 신설 완료. 후속 slice 로 AdminView 에 마운트(기존 providerData fetch 재사용, mutation 은 제외).
---

# T-1134 — AdminView 에 LlmProviderConfigList 마운트

## Why

PLAN.md line 87(R-96, Admin 이 LLM 모델 지정)의 backend 는 완결이고, 직전 slice(T-1133)가 sanitized provider view 를 읽기 전용으로 렌더하는 순수 presentational 컴포넌트 `LlmProviderConfigList` 를 신설했다. 그러나 이 컴포넌트는 아직 어느 화면에도 마운트되지 않아 사용자에게 노출되지 않는다. 본 slice 는 P6 의 확립된 관례(presentational 신설 → AdminView 배선)에 따라, `AdminView` 의 Admin+ gated 패널 영역에 `LlmProviderConfigList` 를 마운트한다. AdminView 는 **이미 `GET /api/llm/providers` 를 `useApiResource<LlmProviderRow[]>(LLM_PROVIDERS_PATH)` 로 조회**하고 있으므로(1198행), 새 fetch 호출은 추가하지 않고 그 `providerData`/`providersLoading`/`providersError` 를 순수 helper 로 sanitized view(`LlmProviderConfigRow[]`)에 파생해 props 로만 내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 생성/수정/삭제 mutation UI 는 후속 slice(Follow-ups)로 분리해 cap 을 지킨다.

## Required Reading

- `web/src/views/AdminView.tsx` — 다음 부분만: (a) 284~295행 `LlmProviderRow` 타입 + 434~470행 `deriveProviders` 순수 helper(파생 helper 작성 패턴 mirror 대상), (b) 1191~1198행 `providerData`/`providersLoading`/`providersError` 조회부(재사용 대상 — 새 fetch 금지), (c) 1596~1620행 `isAdmin` gated 패널 렌더부 + `<DifficultyModelSelector>` 마운트(마운트 위치·props 전달 패턴 mirror 대상).
- `web/src/components/LlmProviderConfigList.tsx` — props 계약(`providers: LlmProviderConfigRow[]`, `loading`, `error`, `emptyMessage`)과 named export type `LlmProviderConfigListProps`/row 타입, default export. import 방식 확인.
- `web/src/views/AdminView.test.tsx` — 마운트/렌더 검증용 기존 테스트의 mock(useApiResource stub) 및 render 패턴 참조.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `LlmProviderConfigList`(default) + 그 named type 을 import 하고, Admin+ gated 영역(`isAdmin ?` 블록 내부, `<DifficultyModelSelector>` 인접)에 `<LlmProviderConfigList>` 를 마운트한다.
- [ ] 이미 존재하는 `providerData`/`providersLoading`/`providersError` 를 재사용한다 — **새 `useApiResource` 호출·새 endpoint path 추가 금지**(fetch 는 한 번만).
- [ ] `providerData`(`LlmProviderRow[] | undefined`) → `LlmProviderConfigRow[]` 로 매핑하는 **순수 helper**(예: `deriveProviderConfigs`)를 `deriveProviders` 와 동형으로 신설한다. `id`/`provider` 는 필수 매핑, `modelId`/`endpointUrl` 은 있으면 매핑·없으면 생략(secret `apiKey` 는 매핑 대상 아님 — view 타입에 없음). `undefined`/빈 배열/누락 필드 row 도 throw 없이 안전 처리.
- [ ] `providersLoading`/`providersError` 는 `loading`/`error` props 로 그대로 내려보낸다(컴포넌트가 loading 우선 → error → empty → populated 분기 처리).
- [ ] Happy-path unit test 1+ — provider 배열이 주입된 상태에서 AdminView 렌더 시 각 provider 행(provider/modelId 등)이 화면에 표시되는지 검증.
- [ ] Error path unit test 1+ — provider 조회가 error(예: Admin 아님 403 파생 문구/network 실패) 일 때 `LlmProviderConfigList` 가 error 상태(role="alert")를 렌더하는지 검증.
- [ ] Flow / branch coverage — `deriveProviderConfigs` 의 각 분기(정상 매핑 / `undefined` 입력 / 빈 배열 / `modelId`·`endpointUrl` 누락 row) 각 1+ test.
- [ ] Negative cases 충분 cover — `providerData === undefined`(빈 목록 파생), 빈 배열(빈 상태 문구), 선택 필드 누락 row(throw 없이 provider 만 표시), 비-Admin(isAdmin false → 패널 미마운트 경계) 등 예외 상황을 각 1+ test.
- [ ] `pnpm --filter web test`(vitest) 통과 + `tsc`/`vite build` green. web 에 `coverageThreshold` 가 설정돼 있으면 line ≥ 80% / function ≥ 80% 통과.
- [ ] 코드 주석·describe/it 문자열은 한국어(§12), 식별자/경로/HTTP 토큰은 영어 유지.

## Out of Scope

- provider 생성(POST)/수정(PATCH)/삭제(DELETE) mutation UI 및 콜백 배선 — 별도 후속 slice.
- `LlmProviderConfigList.tsx` 컴포넌트 자체 수정(props 계약 불변 — 마운트만).
- `web/src/api/apiClient.ts`·`useApiResource.ts`·backend 코드 수정(0 LOC).
- `DifficultyModelSelector` 및 기존 패널의 동작 변경.
- 새 `useApiResource`/새 endpoint 조회 추가(기존 `providerData` 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비움 — sub-agent 가 관련 작업 발견 시 append)

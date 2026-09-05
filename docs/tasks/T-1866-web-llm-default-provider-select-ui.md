---
id: T-1866
title: Web UI — LLM provider 목록에 기본 배지 + "기본으로 지정" 버튼 + PUT 배선
phase: P6
status: SUPERSEDED
supersededBy: [T-1897]
supersededAt: 2026-09-05T03:47:00Z
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865]
touchesFiles:
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
  - web/src/views/useAdminLlmProviders.ts
  - web/src/views/useAdminLlmProviders.test.ts
  - web/src/views/AdminView.tsx
estimatedDiff: 280
estimatedFiles: 7
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 5/7 — '웹 UI 로 선택할 수 있어야 한다' 의 실체. AdminView 는 배선 약 25 줄만 (god component 부채 PLAN 183 행 — 신규 로직은 runners 모듈에). **2026-09-05 재스코핑 의무 — 착수 전 planner 가 반드시 split 판정**: 작성 시점(09-03) 이후 T-1887(PR #1474)이 provider 배선 37 선언을 useAdminLlmProviders.ts 로 순수 추출해, 본 slice 의 state/handler 가 AdminView 가 아니라 그 hook 에 들어간다. 실측 필요 파일이 7 개(+ 소스 텍스트 guard AdminView.llm-provider-list-contract.test.ts 가 깨지면 8)로 CLAUDE.md §3 파일 cap(≤ 5) 을 초과하므로, T-1865 머지 직후 planner 가 현 head 로 재실측해 읽기 축(isDefault 배지)/쓰기 축(기본 지정 버튼 + PUT) 등으로 split 하거나 경계를 좁힌다. Q-0054(drift-guard parity 가 5 파일 cap 을 busting 해 BLOCKED) 와 동형 사고 차단."
---

# T-1866 — Web UI — LLM provider 목록에 기본 배지 + "기본으로 지정" 버튼 + PUT 배선

## Why

오너 지시 (2026-09-03) — "Web UI 에서 선택할 수 있어야 하고, 사용자가 명시적으로 선택한 것이 언제나 우선이다." backend (T-1863 ~ T-1865) 가 닫힌 뒤 Admin 이 실제로 기본 provider 를 고르는 화면이 본 slice 다. 이 slice 가 머지되기 전까지 다중-row 상태의 default 경로는 API 를 직접 호출하지 않는 한 되살릴 수 없다.

[LlmProviderConfigList](../../web/src/components/LlmProviderConfigList.tsx) 는 controlled presentational 컴포넌트 (`onDelete` / `onEdit` 콜백만) 라 같은 계약으로 `onSetDefault` 를 추가하고, 실 PUT 은 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 의 순수 러너로 둔다. [AdminView.tsx](../../web/src/views/AdminView.tsx) 는 PLAN `183 행` god-component 부채 대상이므로 **배선만** (state 2 + handler 1 + props 2) 넣고 신규 로직은 넣지 않는다.

## Required Reading

- [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 전체 (약 120 행) — `LlmProviderConfigRow` · `onDelete` / `onEdit` 계약 · 라벨 상수 규약.
- [web/src/components/LlmProviderConfigList.test.tsx](../../web/src/components/LlmProviderConfigList.test.tsx) — 버튼 조건부 렌더 / 콜백 인자 검증 패턴.
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — `runDeleteProvider` / `runUpdateProvider` 의 deps 타입 · fetch 발사 · nonce bump · error 문구 규약. `runSetDefaultProvider` 를 같은 형식으로.
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) — fetch mock + deps spy 패턴.
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) — **본 slice 의 state · handler 가 들어갈 실제 목적지**(T-1887 이 AdminView 에서 순수 추출). `providersRefreshNonce` · `deletingProvider` · `deleteProviderError` 선언과 `handleDeleteProvider`(`81 행`) 의 `runDeleteProvider(id, { setBusy, setError, bumpRefresh })` 주입 규약을 그대로 mirror 해 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` 를 추가하고, 반환 object(`339 행`)에 노출한다.
- [web/src/views/useAdminLlmProviders.test.ts](../../web/src/views/useAdminLlmProviders.test.ts) — hook 단위 test 패턴(`renderHook` + fetch mock).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — **행 좌표를 쓰지 않는다**(PLAN `183 행` 리팩터 arc 진행 중이라 매 slice 마다 이동한다 — 착수 시 심볼로 재탐색). 읽을 지점은 `useAdminLlmProviders()` destructure 블록(현재 `885 행` 부근에서 끝남)과 `<LlmProviderConfigList` JSX(현재 `1111 행` 부근) 둘뿐이고, 본 slice 가 AdminView 에 넣는 것은 destructure 키 추가 + props 2 개뿐이다(신규 로직 0).
- [docs/architecture/api.md](../architecture/api.md) UC-05 표 — T-1865 가 박제한 `PUT /api/llm/providers/default` 계약 (body · 200 · 404 · 409).

## Acceptance Criteria

- [ ] `LlmProviderConfigRow` 에 `isDefault?: boolean` 추가. true 인 행은 라벨 옆에 `기본` 배지 (`data-testid="llm-provider-default-badge"` 또는 role 로 조회 가능) 렌더. `onSetDefault?: (id: string) => void` 추가 — 주어졌을 때만 **isDefault 가 아닌 행** 에 "기본으로 지정" 버튼 렌더 (이미 기본인 행은 버튼 대신 배지). 미전달 시 버튼 미렌더 (읽기 전용 하위 호환).
- [ ] `runSetDefaultProvider(deps, id)` — `PUT /api/llm/providers/default` body `{ llmProviderConfigId: id }` (credentials include, JSON), 성공 시 `providersRefreshNonce` bump (권위 재조회 — 낙관 반영 없음), 실패 시 한국어 error (404 "설정을 찾을 수 없다" · 그 외 status 문구) 를 `setError` 로. 진행 중 플래그 (`settingDefault`) set/clear.
- [ ] 배선 — `settingDefault` state · `setDefaultError` · `handleSetDefaultProvider`(러너 호출) 는 [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) 에 두고 반환 object 로 노출한다(T-1887 이후 실제 목적지 — AdminView 아님). provider 응답 row → `LlmProviderConfigRow.isDefault` 보수 매핑 (`typeof === "boolean"` 만) 도 같은 hook 에서. AdminView 는 destructure 키 추가 + `<LlmProviderConfigList onSetDefault=… loading={… || settingDefault} error={setDefaultError ?? deleteProviderError ?? providersError}>`. **DifficultyModelSelector 는 무변경**.
- [ ] 컴포넌트 happy-path 1+ — isDefault 행에 배지 · 비-default 행에 버튼 · 클릭 시 `onSetDefault(row.id)` 1 회.
- [ ] 컴포넌트 negative 각 1+ — `onSetDefault` 미전달 시 버튼 0 · 전부 `isDefault` 없음이면 배지 0 · loading 시 버튼 미렌더 · 기본 행에는 버튼 없음 (경계).
- [ ] 러너 happy/error/분기/negative — 200 → nonce bump + error null · 404 → 한국어 문구 · 500 → 문구 · fetch reject (network) → 문구 + 플래그 clear · 빈 id 는 요청 없이 차단 · 진행 중 재진입 시 두 번째 요청 없음.
- [ ] `AdminView.llm-provider-list-contract.test.ts` 등 기존 계약 spec 이 새 props 로 깨지면 본 PR 에서 갱신 (다른 주제 수정 금지).
- [ ] web coverage line ≥ 80% / function ≥ 80% (repo 의 web coverage 스크립트). `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- 새 페이지 / 라우트 / 전역 상태. 기본 provider 조회 전용 GET 호출 (목록 `isDefault` 로 충분).
- 삭제 409 (기본 row) 의 별도 UI 안내 문구 개선 — 기존 delete error 경로가 status 문구를 그대로 노출하면 충분. 필요 시 follow-up.
- AdminView 의 다른 섹션 정리 (PLAN 183 행 별도 chain).

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- (선택) 삭제 409 시 "먼저 다른 provider 를 기본으로 지정하라" 안내를 목록 error 영역에 한국어로 매핑 — 별도 slice.

## Resolution — 2026-09-05 split (planner)

착수 전 `origin/main` 436ff65b 로 재실측한 결과 본 slice 는 **파일 7 개** (`AdminView.llm-provider-list-contract.test.ts` 가 깨지면 8) 로 CLAUDE.md §3 파일 cap (≤ 5) 을 초과한다 — T-1887 (PR #1474) 이 provider 배선을 `useAdminLlmProviders.ts` 로 순수 추출한 결과다. 2026-09-05 03:42 저널의 planner 재실측 지시대로 읽기 축 / 쓰기 축으로 split 했고, 본 task 는 SUPERSEDED 로 닫는다.

- **1/3 — [T-1897](T-1897-web-llm-default-provider-badge-read-axis.md)** (읽기 축, 4 파일): `LlmProviderRow.isDefault` + `deriveProviderConfigs` 보수 매핑 + `LlmProviderConfigList` `기본` 배지. `AdminView.tsx` · `useAdminLlmProviders.ts` 무수정 — 파생 결과가 이미 props 로 흐르므로 소비처 배선은 코드 0 줄로 충족된다.
- **2/3 (예정, 쓰기 축 A, 2 파일)**: `runSetDefaultProvider(deps, id)` 러너 + spec — `PUT /api/llm/providers/default` body `{ llmProviderConfigId }`, 성공 시 `providersRefreshNonce` bump, 404 / 500 / network 한국어 문구, 진행 중 재진입 차단.
- **3/3 (예정, 쓰기 축 B, 5 파일)**: `LlmProviderConfigList` 의 `onSetDefault` + "기본으로 지정" 버튼 (배지 행에는 미렌더) + spec, `useAdminLlmProviders.ts` 의 `settingDefault` · `setDefaultError` · `handleSetDefaultProvider` + spec, `AdminView.tsx` 배선 (destructure 키 + props 2).

위 AC 본문은 2/3 · 3/3 slice 의 사양 원본으로 남겨둔다 (재작성 금지 — 해당 slice task 가 이 파일의 § 좌표를 인용한다). Q-0054 (drift-guard parity 가 5 파일 cap 을 busting 해 BLOCKED) 동형 사고를 착수 전에 차단했다.

---
id: T-1135
title: AdminView LLM provider 삭제 mutation 배선 (DELETE /api/llm/providers/:id)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-07-23
independentStream: web-admin-llm
dependsOn: []
touchesFiles:
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 R-96(Admin LLM 모델 지정 UI) 잔여 mutation slice — provider 삭제 배선. T-1134(read-only 마운트) 후속, T-1130 member remove 패턴 mirror, pr-mode.
---

# T-1135 — AdminView LLM provider 삭제 mutation 배선

## Why

PLAN.md line87 R-96 (Admin 이 LLM 모델 지정 UI) 는 backend (GET/POST/PATCH/DELETE /api/llm/providers) 완결 후 UI 배선이 P6 잔여다. T-1133 이 presentational `LlmProviderConfigList` 를 신설하고 T-1134 가 AdminView 에 읽기 전용으로 마운트했다. 본 slice 는 그 위에 **삭제 mutation** 을 배선한다 — provider 관리 3 mutation (생성/수정/삭제) 중 가장 작고, T-1130 (멤버 제거 `runRemove`/`handleRemove`) 패턴을 1:1 mirror 한다. 생성/수정 mutation UI 는 후속 slice (Out of Scope).

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 `runRemove` (line ~981) / `handleRemove` / `membersRefreshNonce` (line ~1140) / `buildGroupMembersPath` (nonce 재조회 path 빌더, line ~388) / `deriveProviderConfigs` (line ~465) / `LLM_PROVIDERS_PATH` (line ~69) + provider `useApiResource` 호출 (line ~1233) + `LlmProviderConfigList` 마운트 (line ~1666). 삭제 러너·핸들러·nonce 재조회를 이들 패턴에 정합시켜 추가.
- `web/src/components/LlmProviderConfigList.tsx` — 현재 순수 presentational 목록. `onDelete?` 콜백 + 행별 삭제 버튼을 추가한다 (loading 우선 분기 유지, apiKey 미노출 정책 유지).
- `web/src/components/LlmProviderConfigList.test.tsx` — 기존 colocated spec. onDelete/삭제 버튼 test 추가.
- `web/src/api/apiClient.ts` — `request` 시그니처 (mutation 발사 primitive 주입 대상). 수정 0 — DELETE 는 `request` 재사용.
- `web/src/api/useApiResource.ts` — path 변경 시에만 재조회하는 read-only hook (수정 0). nonce 부착 path 로 재조회를 유발하는 convention 확인.

## Acceptance Criteria

- [ ] `LlmProviderConfigList.tsx` 에 optional `onDelete?: (id: string) => void` prop 추가 + 각 행에 삭제 버튼 렌더. `onDelete` 미전달 시 버튼 미렌더 (읽기 전용 하위 호환 — T-1134 마운트 깨지 않음). apiKey 는 여전히 타입·렌더 어디에도 미노출.
- [ ] `AdminView.tsx` 에 삭제 러너 (예: `runDeleteProvider`) 추가 — `apiClient.request` 주입, DELETE `/api/llm/providers/:id` 발사, 성공 시 provider 재조회 nonce 를 +1 하여 목록 재조회 유발, 실패 시 setState 로 error 문구 보관 (throw 없음). `runRemove` 의 deps 주입 구조를 mirror.
- [ ] provider 재조회를 위해 `LLM_PROVIDERS_PATH` 를 nonce-aware path 빌더로 전환 (예: `buildProvidersPath(nonce)`) — `buildGroupMembersPath` / `buildMappingsPath` 동형. nonce 0 이면 query 없이 base path, 1+ 면 `?_r=<nonce>` 부착. `useApiResource` 수정 0.
- [ ] 삭제 in-flight 플래그 + 삭제 error state 추가. in-flight 중 재발사 차단 가드 (이중 DELETE 방지 — `removing` 가드 동형), 빈/falsy id 가드.
- [ ] `LlmProviderConfigList` 마운트에 `onDelete={handleDeleteProvider}` 연결. 삭제 error 는 기존 provider error 와 안전 합성 (mutation error 우선 or 별도 표시).
- [ ] **happy-path unit test**: `runDeleteProvider` 정상 DELETE 성공 시 nonce bump·재조회 트리거 검증 test 1+; `LlmProviderConfigList` 에 onDelete 전달 시 버튼 렌더 + 클릭 시 해당 id 로 콜백 호출 test 1+.
- [ ] **error-path unit test**: DELETE 실패 (404 id 부재 / 409 in-use / 403 권한 / network) 각각에 대해 error state 설정·throw 없음·재조회 미유발 검증 test 1+ (예외 상황 분기마다).
- [ ] **branch coverage**: in-flight 가드 (진행 중 재발사 미발사) / 빈 id 가드 / onDelete 미전달 시 버튼 미렌더 / 성공 후 nonce 증가 등 각 분기 test 분리.
- [ ] **negative cases 충분 cover**: 빈/공백 id, 이미 삭제 진행 중 재클릭, 의존성 (request) reject, 잘못된 응답 shape, onDelete undefined — 각 1+ test.
- [ ] `pnpm --dir web test` (vitest) 전체 통과 + `pnpm --dir web build` (tsc/vite) green. (web 은 coverageThreshold 미설정 — line/function 80% 게이트는 N/A, PR 본문에 명시.)

## Out of Scope

- provider **생성 (POST)** / **수정 (PATCH)** mutation UI — 각각 후속 slice.
- `apiClient.ts` / `useApiResource.ts` / backend (`src/llm/**`) 수정. 삭제는 기존 `request` + nonce 재조회 convention 재사용.
- 새 외부 dependency (axios/react-query 등) 도입 — ADR-0040 §5 게이트 유지.
- 삭제 확인 다이얼로그·낙관적 제거·토스트 등 UX 고도화 (본 slice 는 mutation 배선 + 재조회까지만).
- 라우팅·전역 상태 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

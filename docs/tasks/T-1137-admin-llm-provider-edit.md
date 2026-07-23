---
id: T-1137
title: AdminView LLM provider 수정 mutation 배선 (PATCH /api/llm/providers/:id)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-07-23
independentStream: web-admin-llm
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
  - web/src/components/LlmProviderConfigList.tsx
  - web/src/components/LlmProviderConfigList.test.tsx
plannerNote: P6 line87 R-96 잔여 mutation slice — provider 수정(PATCH) 폼·러너 배선. T-1136(생성) 후속, 마지막 CRUD slice, pr-mode.
---

# T-1137 — AdminView LLM provider 수정 mutation 배선

## Why

PLAN.md line87 R-96 (Admin 이 LLM 모델 지정 UI) 는 backend (GET/POST/PATCH/DELETE `/api/llm/providers`) 완결 후 UI 배선이 P6 잔여다. T-1133 이 presentational `LlmProviderConfigList` 신설, T-1134 가 읽기 전용 마운트, T-1135 가 삭제(DELETE), T-1136 이 생성(POST) mutation 을 배선했다. T-1136 의 Out of Scope 가 명시적으로 defer 한 **수정(PATCH)** mutation 을 본 slice 가 배선해 R-96 provider CRUD UI 를 완결한다. backend `PATCH /api/llm/providers/:id` (T-0151) 는 `UpdateLlmProviderConfigDto` (4 필드 `provider` / `endpointUrl` / `apiKey` / `modelId` **전부 optional** — 부재는 미변경·명시는 교체 semantics) 로 이미 shipped 다. `apiKey` 는 read never-back (응답·목록에 미노출) 이므로 수정 폼의 apiKey 는 빈 값으로 시작하고, 사용자가 입력했을 때만 PATCH body 에 포함(부재 시 기존 ciphertext 유지)한다.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 `runCreateProvider` (T-1136 생성 러너, POST body 발사 + 성공 nonce bump 재조회 + 입력 초기화 + in-flight/빈값 가드 패턴 — **mirror 대상**) / `runDeleteProvider` (T-1135, provider mutation deps 주입 + in-flight 이중 발사 가드 구조) / `buildProvidersPath` (nonce-aware provider path 빌더, **재사용 — 수정 0**) / `providersRefreshNonce`·`setProvidersRefreshNonce` (provider 재조회 nonce, **재사용**) / 생성 폼 controlled input JSX (4 필드 + 버튼 배치 패턴) / `LlmProviderConfigList` 마운트. 수정 러너·인라인 수정 폼·수정 대상 row 상태를 이들 패턴에 정합시켜 추가.
- `web/src/views/AdminView.test.tsx` — 기존 colocated spec. `runCreateProvider` / `runDeleteProvider` test 배치를 참고해 수정 러너·폼 test 추가.
- `web/src/components/LlmProviderConfigList.tsx` — 읽기 전용 목록 + 삭제 버튼(`onDelete` prop, T-1135). 행별 "수정" 버튼(`onEdit?` prop)을 `onDelete` 와 동형으로 추가할 대상.
- `web/src/components/LlmProviderConfigList.test.tsx` — 기존 colocated spec. `onDelete` 버튼 test 를 참고해 `onEdit` 버튼 test 추가.
- `web/src/api/apiClient.ts` — `request` 시그니처 (PATCH method 발사 primitive 재사용 대상, 수정 0). `web/src/api/useApiResource.ts` — path 변경(`buildProvidersPath(nonce)`) 시에만 재조회하는 read-only hook (수정 0).

## Why 이 slice 가 4 파일인가

행별 "수정" 버튼은 삭제 버튼과 동일하게 `LlmProviderConfigList.tsx` 의 각 row 에 위치해야 하므로 `onEdit` prop + 버튼을 목록 컴포넌트에 추가한다(+ colocated spec). 수정 폼(controlled input + PATCH 러너)과 편집 대상 row 상태는 `AdminView.tsx` 안에 배치한다(생성 폼과 동형)(+ colocated spec). 따라서 touchesFiles 는 AdminView.tsx / LlmProviderConfigList.tsx + 각 colocated spec 2 개 = 4 파일. `apiClient` / `useApiResource` / backend 수정 0.

## Acceptance Criteria

- [ ] `LlmProviderConfigList.tsx` 에 optional `onEdit?: (id: string) => void` prop + 행별 "수정" 버튼 추가 (`onDelete` 버튼과 동형 배치). `onEdit` 미제공 시 버튼 미렌더(또는 disabled) — 읽기 전용 마운트(T-1134) 호환 유지. apiKey 는 여전히 목록 어디에도 미노출.
- [ ] `AdminView.tsx` 에 수정 러너 (예: `runUpdateProvider`) 추가 — `apiClient.request` 주입, PATCH `/api/llm/providers/:id` 에 **명시된 필드만** 담은 body 발사 (빈 apiKey 는 body 에서 제외해 기존 ciphertext 유지 — 부분 갱신 semantics), 성공 시 `setProvidersRefreshNonce` +1 으로 목록 재조회 유발 + 편집 상태 종료, 실패 시 setState 로 error 문구 보관 (throw 없음). `runCreateProvider` deps 주입 구조 mirror.
- [ ] 편집 대상 row id 상태 + 인라인 수정 폼 (controlled input: `provider` / `endpointUrl` / `apiKey` / `modelId`) 배치. "수정" 버튼 클릭 시 해당 row 의 현재 값으로 폼 prefill (apiKey 는 read never-back 이므로 빈 값으로 시작, placeholder 로 "변경 시에만 입력" 안내). 수정 in-flight 플래그 + 수정 error state 추가. in-flight 중 재발사 차단 가드(이중 PATCH 방지), 편집 취소(폼 닫기) 가드.
- [ ] provider 재조회는 기존 `buildProvidersPath(providersRefreshNonce)` + `providersRefreshNonce` 재사용 (신규 nonce/빌더 도입 0). `useApiResource` / `apiClient` / backend 수정 0.
- [ ] 수정 error 는 기존 provider error (`providersError`) / 삭제 error / 생성 error 와 안전 합성 (mutation error 우선 표시 or 별도 문구). apiKey 는 error 문구·재조회 응답 어디에도 미노출.
- [ ] **happy-path unit test**: `runUpdateProvider` 정상 PATCH 성공 시 올바른 `:id` path·body(변경 필드만) 발사·nonce bump·재조회 트리거·편집 상태 종료 검증 test 1+; "수정" 버튼 클릭 시 폼 prefill·러너 호출 test 1+. `LlmProviderConfigList` 의 `onEdit` 버튼 클릭 시 콜백 호출 test 1+.
- [ ] **error-path unit test**: PATCH 실패 (400 검증 실패 / 403 권한 / 404 미존재 / network) 각각에 대해 error state 설정·throw 없음·nonce 미증가(재조회 미유발)·편집 상태 유지 검증 test 1+ (예외 상황 분기마다).
- [ ] **branch coverage**: apiKey 빈값 → body 에서 제외 vs apiKey 입력 → body 포함 / in-flight 가드(진행 중 재발사 미발사) / 성공 후 nonce 증가·편집 종료 / 실패 후 편집 유지 / `onEdit` 제공 vs 미제공(버튼 렌더 분기) — 각 분기 test 분리.
- [ ] **negative cases 충분 cover**: 빈/공백 필드(각 필드별 변경 시), 이미 수정 진행 중 재클릭, 의존성 (`request`) reject, 잘못된 응답 shape, 존재하지 않는 row id — 각 1+ test.
- [ ] `pnpm --dir web test` (vitest) 전체 통과 + `pnpm --dir web build` (tsc/vite) green. (web 은 coverageThreshold 미설정 — line/function 80% 게이트는 N/A, PR 본문에 명시.)

## Out of Scope

- provider 생성(POST) / 삭제(DELETE) mutation — 각각 T-1136 / T-1135 에서 이미 완결.
- `apiClient.ts` / `useApiResource.ts` / backend (`src/llm/**`) 수정. PATCH 는 기존 `request` primitive + `buildProvidersPath` nonce 재조회 convention 재사용.
- provider 값 허용 집합 (5 provider) client-side 검증 고도화 — backend service 의 `isLlmProvider` 가 미지원 provider → 400 변환하므로 본 slice 는 형식(빈값) 가드만. select/dropdown UX 는 후속.
- 새 외부 dependency (react-query/form 라이브러리 등) 도입 — ADR-0040 §5 게이트 유지.
- 수정 확인 다이얼로그·낙관적 갱신·토스트 등 UX 고도화 (본 slice 는 mutation 배선 + 재조회까지만).
- 라우팅·전역 상태 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

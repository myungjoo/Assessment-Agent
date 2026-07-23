---
id: T-1136
title: AdminView LLM provider 생성 mutation 배선 (POST /api/llm/providers)
phase: P6
status: DONE
commitMode: pr
prNumber: 1028
mergedAs: 06934d89
reviewRounds: 1
completedAt: 2026-07-23T07:56:30Z
coversReq: [REQ-096]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-23
independentStream: web-admin-llm
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line87 R-96 잔여 mutation slice — provider 생성(POST) 폼·러너 배선. T-1135(삭제) 후속, T-1131 runAdd 패턴 mirror, pr-mode.
---

# T-1136 — AdminView LLM provider 생성 mutation 배선

## Why

PLAN.md line87 R-96 (Admin 이 LLM 모델 지정 UI) 는 backend (GET/POST/PATCH/DELETE `/api/llm/providers`) 완결 후 UI 배선이 P6 잔여다. T-1133 이 presentational `LlmProviderConfigList` 를 신설, T-1134 가 읽기 전용 마운트, T-1135 가 삭제(DELETE) mutation 을 배선했다. T-1135 의 Out of Scope 가 명시적으로 defer 한 **생성(POST) / 수정(PATCH)** 중 본 slice 는 **생성(POST)** 을 배선한다. backend `POST /api/llm/providers` (T-0149) 는 4 필드 (`provider` / `endpointUrl` / `apiKey` / `modelId`) DTO 로 이미 shipped 이며, 본 slice 는 T-1131 (멤버 추가 `runAdd` + 입력 폼) 패턴을 mirror 한다. 수정(PATCH) mutation UI 는 후속 slice (Out of Scope).

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 `runAdd` (line ~1120, 멤버 추가 러너 + no-op 가드 패턴) / `buildProvidersPath` (nonce-aware provider path 빌더, line ~532, **재사용 — 수정 0**) / `providersRefreshNonce`·`setProvidersRefreshNonce` (line ~1305, provider 재조회 nonce, **재사용**) / `runDeleteProvider` (line ~1055, provider mutation deps 주입 구조) / `LLM_PROVIDERS_PATH`·provider `useApiResource` 호출 (line ~1310) / `LlmProviderConfigList` 마운트 (line ~1770) + 멤버 추가 입력 폼 JSX (line ~1730, `personIdInput` + "추가" 버튼 controlled 패턴). 생성 러너·입력 폼·nonce 재조회를 이들 패턴에 정합시켜 추가.
- `web/src/views/AdminView.test.tsx` — 기존 colocated spec. runAdd / runDeleteProvider test 배치를 참고해 생성 러너·폼 test 추가.
- `web/src/api/apiClient.ts` — `request` 시그니처 (POST body 발사 primitive 주입 대상). 수정 0 — POST 는 `request` 재사용.
- `web/src/api/useApiResource.ts` — path 변경 시에만 재조회하는 read-only hook (수정 0). `buildProvidersPath(nonce)` path 변화로 재조회를 유발하는 convention 확인.

## Why 이 slice 가 2 파일인가

생성 폼(4 controlled input + 버튼)은 AdminView.tsx 안에 직접 배치한다 (T-1131 멤버 추가 폼과 동형). `LlmProviderConfigList.tsx` (읽기 전용 목록 + 삭제 버튼) 는 건드리지 않으므로 touchesFiles 는 AdminView.tsx + colocated spec 2 개다. apiKey 는 secret input 이나 생성 시점 평문 전송만 담당 — 응답·목록·재조회 어디에도 apiKey 미노출 정책 유지 (backend view 가 이미 제거).

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 생성 러너 (예: `runCreateProvider`) 추가 — `apiClient.request` 주입, POST `/api/llm/providers` 에 `{ provider, endpointUrl, apiKey, modelId }` body 발사, 성공 시 `setProvidersRefreshNonce` 를 +1 하여 목록 재조회 유발 + 입력 필드 초기화, 실패 시 setState 로 error 문구 보관 (throw 없음). `runAdd` 의 deps 주입 구조를 mirror.
- [ ] 4 controlled input (`provider` / `endpointUrl` / `apiKey` / `modelId`) + "추가" 버튼을 `LlmProviderConfigList` 마운트 인접에 배치. 생성 in-flight 플래그 + 생성 error state 추가. in-flight 중 재발사 차단 가드 (이중 POST 방지 — `runAdd` no-op 가드 동형), 필수 필드 빈/공백(trim) 가드 (4 필드 중 하나라도 비면 미발사).
- [ ] provider 재조회는 기존 `buildProvidersPath(providersRefreshNonce)` + `providersRefreshNonce` 를 재사용 (신규 nonce/빌더 도입 0). `useApiResource` / `apiClient` / backend 수정 0.
- [ ] 생성 error 는 기존 provider error (`providersError`) 및 삭제 error (`deleteProviderError`) 와 안전 합성 (mutation error 우선 표시 or 별도 문구). apiKey 는 error 문구·재조회 응답 어디에도 미노출.
- [ ] **happy-path unit test**: `runCreateProvider` 정상 POST 성공 시 올바른 body 발사·nonce bump·재조회 트리거·입력 초기화 검증 test 1+; 4 필드 정상 입력 후 "추가" 클릭 시 러너 호출 test 1+.
- [ ] **error-path unit test**: POST 실패 (400 검증 실패 / 403 권한 / 409 중복 / network) 각각에 대해 error state 설정·throw 없음·nonce 미증가(재조회 미유발) 검증 test 1+ (예외 상황 분기마다).
- [ ] **branch coverage**: in-flight 가드 (진행 중 재발사 미발사) / 필수 필드 빈값 가드 (미발사) / 성공 후 nonce 증가·입력 초기화 / 실패 후 입력 유지 등 각 분기 test 분리.
- [ ] **negative cases 충분 cover**: 빈/공백 필드 (각 필드별), 이미 생성 진행 중 재클릭, 의존성 (`request`) reject, 잘못된 응답 shape — 각 1+ test.
- [ ] `pnpm --dir web test` (vitest) 전체 통과 + `pnpm --dir web build` (tsc/vite) green. (web 은 coverageThreshold 미설정 — line/function 80% 게이트는 N/A, PR 본문에 명시.)

## Out of Scope

- provider **수정 (PATCH)** mutation UI — 후속 slice.
- `LlmProviderConfigList.tsx` / `apiClient.ts` / `useApiResource.ts` / backend (`src/llm/**`) 수정. 생성은 기존 `request` + `buildProvidersPath` nonce 재조회 convention 재사용.
- provider 값 허용 집합 (5 provider) client-side 검증 고도화 — backend service 의 `isLlmProvider` 가 미지원 provider → 400 변환하므로 본 slice 는 형식(빈값) 가드만. select/dropdown UX 는 후속.
- 새 외부 dependency (axios/react-query/form 라이브러리 등) 도입 — ADR-0040 §5 게이트 유지.
- 생성 확인 다이얼로그·낙관적 추가·토스트 등 UX 고도화 (본 slice 는 mutation 배선 + 재조회까지만).
- 라우팅·전역 상태 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

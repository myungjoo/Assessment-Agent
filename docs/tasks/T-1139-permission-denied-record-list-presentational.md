---
id: T-1139
title: PermissionDeniedRecordList presentational 컴포넌트 신설 (권한 부족 audit 표면화)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-008, REQ-016]
estimatedDiff: 260
estimatedFiles: 2
independentStream: p6-frontend-permission-denied
dependsOn: []
touchesFiles:
  - web/src/components/PermissionDeniedRecordList.tsx
  - web/src/components/PermissionDeniedRecordList.test.tsx
created: 2026-07-23
plannerNote: P6 R-33/R-20 잔여 — 권한 부족 audit(GET /api/permission-denied-records) 을 UI 로 표면화할 presentational 첫 slice(pr, T-1133 패턴 mirror)
---

# T-1139 — PermissionDeniedRecordList presentational 컴포넌트 신설 (권한 부족 audit 표면화)

## Why

README R-20·R-33 (권한 부족 감지·통지 — **사용자 + 관리자 모두 인식 가능**) 의 backend 는
`GET /api/permission-denied-records` (User+, service-layer audience 차등) 로 이미 완결됐으나
([api.md](../architecture/api.md) line 131, ADR-0022/0023), 이 audit record 를 사람이 볼 수 있는
**frontend surface 가 아직 없다** — "인식 가능" 요건이 UI 층에서 미충족이다. PLAN [P6 line 123](../PLAN.md)
의 backend-계약-shipped 후 배선 잔여 중 하나. 직전 LLM provider CRUD slice(T-1133~T-1138) 와 동일한
presentational-first 방식으로, 본 task 는 그 첫 building block 인 읽기 전용 목록 컴포넌트만 신설한다
(마운트·실 fetch·필터 배선은 후속 slice — Out of Scope). REQ-008(user audience)·REQ-016(admin audience) cover.

## Required Reading

- `web/src/components/LlmProviderConfigList.tsx` — 그대로 mirror 할 presentational 패턴(loading→error→empty→populated 4분기, controlled props, named+default export convention).
- `web/src/components/LlmProviderConfigList.test.tsx` — colocated test 구조·convention 참조(본 컴포넌트 test 도 동형 colocated).
- `docs/architecture/api.md` line 131 — `GET /api/permission-denied-records` 응답 record view shape (provider / instanceRef / resourceRef / principal / httpStatus / reason / createdAt) 확인.

## Acceptance Criteria

- [ ] `web/src/components/PermissionDeniedRecordList.tsx` 신설 — controlled presentational component. props: `records` (권한 부족 record 배열), `loading?`, `error?`, `emptyMessage?`. 실 fetch·필터·전역 상태·라우팅 배선은 하지 않는다(순수 렌더).
- [ ] record 행 타입은 backend view 와 정합: `id`(React key) + `provider` + `instanceRef` + `resourceRef` + `httpStatus`(number) + `reason` + `createdAt`, `principal?`(nullable — 현 이벤트는 항상 null/생략, ADR-0022 §1). secret 컬럼은 view 에 없으므로 props·렌더 어디에도 미포함.
- [ ] 분기 렌더: (1) `loading===true` → `role="status"` 로딩 문구 우선, (2) `error` truthy → `role="alert"`, (3) `records.length===0` → 빈 상태 문구(`emptyMessage` 미전달/빈 문자열 시 기본 한국어 문구 fallback), (4) populated → 각 record 를 목록 항목으로 렌더. 문구는 §12 한국어.
- [ ] `PermissionDeniedRecordRow` / `PermissionDeniedRecordListProps` 타입을 named export + 컴포넌트 default export (LlmProviderConfigList export convention 동형).
- [ ] **Happy-path test**: records 1+ 전달 시 각 record 의 provider/instanceRef/resourceRef/httpStatus/reason/createdAt 가 렌더되는지 1+ test. colocated `web/src/components/PermissionDeniedRecordList.test.tsx` 에 작성.
- [ ] **Error path test**: `error` truthy 시 `role="alert"` 렌더 + 목록 미렌더 1+ test.
- [ ] **분기 test**: loading 우선(loading=true 면 error·records 무관 로딩만) / 빈 배열(빈 상태 문구, emptyMessage 빈 문자열 → 기본 문구 fallback) / populated 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `principal` null/생략 시 throw 없이 렌더, `reason` null 시 안전 처리, 빈 문자열 `error`(falsy) 는 alert 분기 미진입, 빈 문자열 `emptyMessage` → 기본 문구, records 미정렬/다건 key 중복 없음. 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green. web 커버리지 게이트(line ≥ 80% / function ≥ 80%) 통과.

## Out of Scope

- AdminView/DashboardView 마운트 배선(후속 slice — R-33 "사용자+관리자 모두" 라 마운트 위치는 후속에서 결정, User+ 가시성 고려).
- 실 `GET /api/permission-denied-records` fetch hook·필터(instanceRef/provider/httpStatus query param)·재조회 nonce 배선.
- backend(`src/permission-denied/*`)·`apiClient`·`useApiResource` 수정 (0 — 본 task 는 web 컴포넌트 2파일만).
- api.md 갱신(endpoint 이미 박제됨).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---
id: T-1140
title: DashboardView 에 PermissionDeniedRecordList 마운트 + GET /api/permission-denied-records 실 fetch 배선
phase: P6
status: DONE
commitMode: pr
prNumber: 1032
mergedAs: cf0c8572
reviewRounds: 1
coversReq: [REQ-008, REQ-016]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-permission-denied
dependsOn: []
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
plannerNote: P6 R-33/R-20 잔여 — T-1139 presentational 을 DashboardView(User+ 랜딩)에 마운트 + 실 fetch 배선(pr, T-1134 mount 패턴 mirror)
---

# T-1140 — DashboardView 에 PermissionDeniedRecordList 마운트 + 실 fetch 배선

## Why

README R-20·R-33 (권한 부족 감지·통지 — **사용자 + 관리자 모두 인식 가능**) 의 backend
`GET /api/permission-denied-records` (User+, service-layer audience 차등 — Admin 전체 / non-Admin own-instance)
와 읽기 전용 presentational 컴포넌트(T-1139, `PermissionDeniedRecordList`)는 완결됐으나, 아직 **어느 화면에도
마운트되지 않아 사람이 볼 수 없다** — "인식 가능" 요건이 UI 층에서 미충족이다. 본 slice 는 T-1134 (LLM provider
목록 마운트) 와 동일한 mount + 실 fetch 방식으로, DashboardView(모든 authenticated 사용자가 착지하는 User+
랜딩 컨테이너 — 사용자·관리자 모두 이 화면을 본다)에 `useApiResource` 로 record 목록을 조회해 컴포넌트에 전달한다.
audience 차등은 backend service-layer 가 담당하므로 단일 User+ surface 마운트로 "사용자+관리자 모두" 를 충족한다.
REQ-008(user audience)·REQ-016(admin audience) cover.

## Required Reading

- `web/src/views/DashboardView.tsx` — 마운트 대상 컨테이너. `useApiResource` 로 데이터 소유 + presentational 컴포넌트에 props 전달하는 기존 배선 패턴(MetricSummaryCards / EvaluationResultTable 등) 을 그대로 mirror.
- `web/src/components/PermissionDeniedRecordList.tsx` — 마운트할 컴포넌트. props(`records`, `loading?`, `error?`, `emptyMessage?`) + named export `PermissionDeniedRecordRow` 타입 확인. 컴포넌트 수정 0.
- `web/src/api/useApiResource.ts` — fetch hook 계약(`useApiResource<T>(path)` → `{ data, loading, error }`, `path` falsy 면 미조회). 수정 0.
- `web/src/views/AdminView.tsx` 의 T-1134 주석 블록(line 34~37, deriveProviderConfigs 부근) — presentational 컴포넌트 마운트 시 default import + named type import 만 쓰는 convention 참조.
- `docs/architecture/api.md` `GET /api/permission-denied-records` 행 — 응답 record view shape(provider / instanceRef / resourceRef / principal / httpStatus / reason / createdAt) 재확인.

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 에 `PermissionDeniedRecordList` 를 default import + `PermissionDeniedRecordRow` 를 named type import 로 추가(컴포넌트 파일 수정 0).
- [ ] 새 `useApiResource<PermissionDeniedRecordRow[]>('/api/permission-denied-records')` 호출을 추가해 record 목록을 조회하고, 그 `data`/`loading`/`error` 를 `PermissionDeniedRecordList` 의 `records`/`loading`/`error` props 로 전달(마운트). path 상수는 파일 상단에 `const PERMISSION_DENIED_RECORDS_PATH = '/api/permission-denied-records'` 형태로 박제.
- [ ] `data` 가 `undefined`(미조회/진행 중/실패) 일 때 `records` 로 빈 배열을 안전하게 넘겨 컴포넌트가 throw 없이 렌더되도록 처리(예: `data ?? []`).
- [ ] 마운트 위치는 기존 패널들과 시각적으로 구분되는 별도 섹션(예: heading + 컴포넌트). 문구는 §12 한국어. 필터/재조회/mutation/query param 배선은 하지 않는다(읽기 전용 마운트).
- [ ] backend(`src/permission-denied/*`)·`apiClient`·`useApiResource`·`PermissionDeniedRecordList` 컴포넌트 수정 0 — 본 task 는 DashboardView 2파일(컨테이너 + colocated test)만.
- [ ] **Happy-path test**: fetch 가 record 1+ 를 반환하면 DashboardView 렌더에 각 record 의 provider/instanceRef/httpStatus/reason 등이 표면화되는지 1+ test(`useApiResource` 또는 `apiClient.request` mock).
- [ ] **Error path test**: fetch 가 error 를 반환(예: 401/네트워크)하면 record 섹션이 `role="alert"` 에러 표면을 렌더하고 목록은 미렌더하는지 1+ test.
- [ ] **분기 test**: loading 중(로딩 표면 우선) / 빈 배열(빈 상태 문구) / populated 각 분기 1+ test. 기존 DashboardView 다른 패널 test 는 회귀 없이 유지.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `data` undefined 시 `data ?? []` 로 throw 없이 렌더, record 의 `principal` null/생략 시 안전 처리(컴포넌트 위임이지만 컨테이너 전달 경로 검증), 다건 key 중복 없음, 빈 배열 → 기본 빈 문구. 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green. web 커버리지 게이트(line ≥ 80% / function ≥ 80%) 통과.

## Out of Scope

- 필터(instanceRef / provider / httpStatus query param) UI 및 그 배선 — 후속 slice.
- 재조회 nonce / mutation(권한 부족 record 는 read-only audit 이라 생성·수정·삭제 없음).
- AdminView 에도 별도 마운트하는 작업(단일 User+ surface = DashboardView 로 충분; 필요 시 후속에서 판단).
- `PermissionDeniedRecordList` 컴포넌트 자체 수정, `useApiResource`/`apiClient`/backend 수정.
- api.md 갱신(endpoint 이미 박제됨).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

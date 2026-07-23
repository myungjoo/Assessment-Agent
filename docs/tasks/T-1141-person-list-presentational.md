---
id: T-1141
title: PersonList presentational 컴포넌트 신설 (Admin 인원 관리 UI 첫 slice)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-023]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-person
dependsOn: []
touchesFiles: [web/src/components/PersonList.tsx, web/src/components/PersonList.test.tsx]
plannerNote: P6 line120 Admin 패널 "인원" fragment — 현재 Person UI 부재(select 옵션만). presentational-first 첫 slice, T-1133/T-1139 패턴 mirror, pr-mode web 2파일
---

# T-1141 — PersonList presentational 컴포넌트 신설 (Admin 인원 관리 UI 첫 slice)

## Why

P6 line 120 Admin 패널 bullet 은 관리 대상으로 "인원·그룹·재평가·import/export·스케줄" 을 명시하지만, 현재 web 에는 **인원(Person) 관리 UI 가 전혀 없다** — Person 은 재평가 패널의 `<select>` 옵션으로만 등장한다. backend 는 이미 `GET /api/persons`(+ POST/PATCH/DELETE, `PersonService` CRUD + deactivate/reactivate, PLAN P3 line53) 로 완결돼 있다. 본 task 는 그 위에 올라가는 첫 building block 으로, Person 목록을 읽기 전용으로 렌더하는 순수 presentational 컴포넌트를 신설한다. 직전 LlmProviderConfigList(T-1133)·PermissionDeniedRecordList(T-1139) 와 동일한 presentational-first 패턴 — 다음 slice 가 이를 AdminView 에 마운트 + 실 fetch 배선(T-1134/T-1140 mount 패턴)한다.

## Required Reading

- `web/src/components/PermissionDeniedRecordList.tsx` — 직전 presentational 컴포넌트. props/분기 순서(loading 우선 → error → empty → populated)·named+default export·행 렌더 convention 을 그대로 차용한다.
- `web/src/components/LlmProviderConfigList.tsx` — 동일 presentational-first 패턴의 또 다른 참조(읽기 전용 목록·secret 미노출).
- `web/src/components/PermissionDeniedRecordList.test.tsx` — colocated spec 의 test 구성(happy/loading/error/empty/negative)·render 방식을 mirror 한다.
- `src/user/person.controller.ts` (L52~63) — `GET /api/persons` 계약(active 인원 `Person[]` 배열 반환). 응답 shape 확인용(수정 금지 — 읽기 참조).
- `prisma/schema.prisma` (model Person, L55~75) — Person 필드(id / fullName / email / active / createdAt / updatedAt / partId). PersonRow 타입 설계 근거.

## Acceptance Criteria

- [ ] `web/src/components/PersonList.tsx` 신설 — 순수 presentational controlled component. 실 fetch·필터·전역 상태·라우팅 배선은 **하지 않는다**(후속 mount slice 책임).
  - `PersonRow` interface (named export) — 최소한 `id: string` / `fullName: string` / `email: string` / `active: boolean` 을 포함하고, `partId?: string | null` / `createdAt?: string` 는 선택적으로 두어 backend 응답 shape 다양성을 보수적으로 수용한다.
  - `PersonListProps` interface — `persons: PersonRow[]` + `loading?: boolean` + `error?: string` + `emptyMessage?: string`(빈 문자열 시 기본 문구 fallback).
  - 분기 순서는 참조 컴포넌트와 동일: `loading` 우선 → `error`(loading 아니고 truthy 면 `role="alert"`) → 빈 배열(emptyMessage 또는 기본 문구) → populated 목록.
  - 각 행은 `id` 를 React key 로 쓰고 fullName·email 을 항상 표시, active 여부를 사람-친화 한국어(예: "활성"/"휴직")로 표시한다. email 외 secret 성 필드는 없음(Person 은 민감 컬럼 부재).
  - named export(`PersonRow`, `PersonListProps`) + default export(`PersonList`) convention 준수.
- [ ] `web/src/components/PersonList.test.tsx` colocated spec 신설(R-112):
  - happy-path: 인원 목록이 주어졌을 때 각 행의 fullName·email 이 렌더된다(1+).
  - error path: `error` truthy + `loading` false 일 때 `role="alert"` 로 error 문구만 렌더된다(1+).
  - 분기 cover: `loading=true` 시 로딩 문구 우선(persons 유무 무관), 빈 배열 시 emptyMessage/기본 문구 렌더 — 각 분기 1+ test.
  - negative cases 충분 cover: 빈 문자열 `emptyMessage` → 기본 문구 fallback / active=false 행의 상태 표시 / `partId` 없는 행이 throw 없이 렌더 / loading 이 error 보다 우선(둘 다 truthy) — 각 1+ test.
- [ ] `pnpm --dir web test` (또는 web 워크스페이스 vitest) 통과 — 신규 spec 포함 green.
- [ ] `pnpm --dir web build`(tsc + vite build) 통과.
- [ ] web coverage threshold 유지(line ≥ 80% / function ≥ 80%) — 신규 컴포넌트가 threshold 를 깨지 않는다.

## Out of Scope

- AdminView 에 PersonList 마운트 / `GET /api/persons` 실 fetch 배선(후속 slice — T-1134/T-1140 mount 패턴).
- Person 생성/수정/삭제/deactivate/reactivate mutation UI(각각 별도 후속 slice).
- ServiceIdentity·Part·Group 표시(본 컴포넌트는 Person 스칼라 필드만).
- backend(`src/`)·apiClient·useApiResource 수정(컴포넌트는 fetch 를 모른다 — ADR-0041 Decision 1).
- 필터/정렬/페이지네이션(상위 컨테이너 책임).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)

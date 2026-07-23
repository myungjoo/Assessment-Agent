---
id: T-1147
title: GroupList presentational 컴포넌트 신설 (Admin 그룹 관리 목록 카드 UI 첫 slice)
phase: P6
status: DONE
completedAt: 2026-07-24T00:50:27+09:00
mergedAs: 1bd73d74ae732455cd353caf8bfca3cca3cae720
prNumber: 1039
reviewRounds: 1
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-23
independentStream: web-admin-group
dependsOn: []
touchesFiles:
  - web/src/components/GroupList.tsx
  - web/src/components/GroupList.test.tsx
plannerNote: P6 line120 Admin 그룹 관리 — 그룹은 select+생성폼(T-1146)만, 목록 카드 UI 부재. presentational-first 첫 slice, T-1141 PersonList / T-1133 LlmProviderConfigList mirror, pr web 2파일
---

# T-1147 — GroupList presentational 컴포넌트 신설 (Admin 그룹 관리 목록 카드 UI 첫 slice)

## Why

P6 PLAN.md line120 Admin 패널 bullet 은 관리 대상으로 "인원·그룹·재평가·import/export·스케줄" 을 명시한다. 인원(Person) 관리는 presentational-first 패턴(T-1141 PersonList → T-1142 mount → T-1143~T-1145 CRUD)으로 완결됐으나, **그룹(Group) 관리 UI 는 아직 목록 카드가 없다** — 그룹은 재평가/멤버 관리용 `<select>` 드롭다운과 생성 폼(T-1146)으로만 등장한다. 본 task 는 그 위에 올라가는 첫 building block 으로, Group 목록을 읽기 전용으로 렌더하는 순수 presentational 컴포넌트를 신설한다(T-1146 Out of Scope 가 명시적으로 "별도 GroupList presentational 컴포넌트 신설 — 별도 slice" 로 이연한 슬라이스). 직전 PersonList(T-1141)·LlmProviderConfigList(T-1133) 와 동일한 presentational-first 패턴이며, 후속 slice 가 이를 AdminView 에 마운트하고 그룹 삭제(DELETE /api/groups/:id)·수정(PATCH /api/groups/:id) mutation 을 행별 버튼으로 배선한다(REQ-028 임의 Group 등록 / REQ-049 Admin 패널).

## Required Reading

- `web/src/components/PersonList.tsx` — 직전 presentational 컴포넌트. props/분기 순서(loading 우선 → error → empty → populated)·named+default export·행 렌더 convention 을 그대로 차용한다.
- `web/src/components/LlmProviderConfigList.tsx` — 동일 presentational-first 패턴의 또 다른 참조. 특히 후속 slice 를 위해 optional `onEdit?`/`onDelete?` prop 을 두어 행별 버튼을 미제공 시 미렌더하는 convention(본 task 는 prop signature 만 열어두고 실 버튼 렌더는 후속 slice 로 이연할지, 아니면 present 시에만 렌더할지 결정 — 아래 Acceptance 참조).
- `web/src/components/PersonList.test.tsx` — colocated spec 의 test 구성(happy/loading/error/empty/negative)·render 방식을 mirror 한다.
- `web/src/views/AdminView.tsx` (line 327~332) — 기존 `GroupRow` interface(`id?` / `name?` / `members?` / `persons?`). 신 컴포넌트의 `GroupRow` 타입 설계 정합 근거(중복 정의 시 필드 shape 를 이 기존 interface 와 호환되게 둔다).
- `src/user/group.controller.ts` (L92~98 `@Get()`) — `GET /api/groups` 계약(그룹 배열 반환). 응답 shape 확인용(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `web/src/components/GroupList.tsx` 신설 — 순수 presentational controlled component. 실 fetch·필터·전역 상태·라우팅·mutation 배선은 **하지 않는다**(후속 mount / delete / edit slice 책임).
  - `GroupRow` interface (named export) — 최소한 `id?: string` / `name?: string` 를 포함하고, `members?` / `persons?` 는 선택적으로 두어 기존 AdminView `GroupRow`(멤버 배열 포함) 및 backend 응답 shape 다양성을 보수적으로 수용한다. `id`/`name` 누락 row 도 throw 없이 안전 렌더.
  - `GroupListProps` interface — `groups: GroupRow[]` + `loading?: boolean` + `error?: string` + `emptyMessage?: string`(빈 문자열 시 기본 문구 fallback). 후속 삭제/수정 slice 를 위한 optional `onDelete?: (id: string) => void` / `onEdit?: (id: string) => void` prop 도 signature 에 포함하되, **제공된 경우에만** 해당 행 버튼을 렌더한다(미제공 시 버튼 미렌더 — LlmProviderConfigList mirror).
  - 분기 순서는 참조 컴포넌트와 동일: `loading` 우선 → `error`(loading 아니고 truthy 면 `role="alert"`) → 빈 배열(emptyMessage 또는 기본 문구) → populated 목록.
  - 각 행은 `id`(없으면 index fallback)를 React key 로 쓰고 group name 을 항상 표시(name 누락 시 사람-친화 placeholder 예: "(이름 없음)"). 멤버 수 등 부가 정보 표시는 선택 — 과도한 로직 금지(presentational only). secret 성 필드 없음.
  - named export(`GroupRow`, `GroupListProps`) + default export(`GroupList`) convention 준수.
- [ ] `web/src/components/GroupList.test.tsx` colocated spec 신설(R-112):
  - happy-path: 그룹 목록이 주어졌을 때 각 행의 name 이 렌더된다(1+).
  - error path: `error` truthy + `loading` false 일 때 `role="alert"` 로 error 문구만 렌더된다(1+).
  - 분기 cover: `loading=true` 시 로딩 문구 우선(groups 유무 무관), 빈 배열 시 emptyMessage/기본 문구 렌더, `onDelete`/`onEdit` 제공 시 버튼 렌더 vs 미제공 시 미렌더 — 각 분기 1+ test.
  - negative cases 충분 cover: 빈 문자열 `emptyMessage` → 기본 문구 fallback / `name` 없는 row 가 placeholder 로 throw 없이 렌더 / `id` 없는 row 가 index key 로 안전 렌더 / loading 이 error 보다 우선(둘 다 truthy) / `onDelete` 버튼 클릭 시 정확한 `id` 로 콜백 호출 — 각 1+ test.
- [ ] backend(`src/`)·apiClient·useApiResource 수정 0(컴포넌트는 fetch 를 모른다 — ADR-0041 Decision 1).
- [ ] `pnpm --dir web test` (vitest) 통과 — 신규 spec 포함 green.
- [ ] `pnpm --dir web build`(tsc --noEmit + vite build) 통과, lint clean.
- [ ] web coverage threshold 유지(line ≥ 80% / function ≥ 80%) — 신규 컴포넌트가 threshold 를 깨지 않는다.

## Out of Scope

- AdminView 에 GroupList 마운트 / `GET /api/groups` 실 fetch 배선(후속 mount slice — T-1142/T-1134 mount 패턴). 본 task 는 기존 select 조회부·생성 폼을 손대지 않는다.
- 그룹 삭제(DELETE /api/groups/:id)·수정(PATCH /api/groups/:id) mutation 러너 배선(각각 별도 후속 slice — 본 task 는 `onDelete`/`onEdit` prop signature 와 버튼 렌더까지만, 실 fetch 러너는 후속).
- 그룹 멤버 관리 UI(GroupMemberList 이미 존재 — 본 컴포넌트는 그룹 스칼라 목록만).
- 필터/정렬/페이지네이션(상위 컨테이너 책임).
- 다른 stream(인원·LLM provider·permission-denied) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)

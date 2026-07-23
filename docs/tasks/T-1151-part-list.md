---
id: T-1151
title: PartList presentational 컴포넌트 신설 (Admin 파트 관리 UI 첫 slice)
phase: P6
status: DONE
mergedAs: 2ee621b3
prNumber: 1043
reviewRounds: 1
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-part
dependsOn: []
touchesFiles:
  - web/src/components/PartList.tsx
  - web/src/components/PartList.test.tsx
plannerNote: "P6 line120/README85 Admin 파트 관리 — Part(조직도 단일소속) CRUD backend 완결이나 web UI 부재. GroupList(T-1147) mirror presentational-first 첫 slice. pr web 2파일."
---

# T-1151 — PartList presentational 컴포넌트 신설 (Admin 파트 관리 UI 첫 slice)

## Why

README 85행("Admin은 … 인원 Group/파트 편집 등을 할 수 있다")·REQ-028("Group 정책 — 다중 임의 group + **단일 조직도 파트**")가 요구하는 Admin 파트(Part) 관리 UI 는 현재 web 에 부재하다. backend `PartController`(`src/user/part.controller.ts`)는 `@Get()`/`@Get(":id")`/`@Get(":id/persons")`/`@Post()`/`@Patch(":id")`/`@Delete(":id")` 로 Part CRUD 를 이미 완결했고 `Part` 모델은 `id`·`name`(`@unique`)·`persons[]` 를 갖는다(`prisma/schema.prisma` L114~122). 직전 그룹 관리 UI(presentational T-1147 → mount T-1148 → create T-1146 → delete T-1149 → update T-1150)로 Group CRUD UI 를 완결한 것과 동형으로, 본 slice 는 Part 관리 UI 의 첫 building block 인 `PartList` presentational 컴포넌트를 신설한다. Group 과 달리 Part 는 인원이 **1개 파트에만 속하는 조직도 분류**라는 도메인 차이는 있으나, 목록 카드 UI 관점에서는 `GroupList`(T-1147)·`PersonList`(T-1141)·`LlmProviderConfigList`(T-1133)와 동일한 순수 controlled component 형태(loading→error→empty→populated 분기, named/default export, `onDelete?`/`onEdit?` prop signature)를 그대로 차용한다. 실 fetch(GET /api/parts)·전역 상태·라우팅·mutation 배선은 후속 mount/create/delete/edit slice 책임(Out of Scope). 본 slice 로 REQ-028(파트 분류)·REQ-049(Admin 관리 패널)의 파트 관리 UI 착수점을 만든다.

## Required Reading

- `web/src/components/GroupList.tsx` — 본 slice 의 1:1 mirror 원본. `GroupRow`(id?/name?/members?/persons? 선택적, 누락 row 안전 렌더)·`LOADING_TEXT`/`DEFAULT_EMPTY_MESSAGE`/`NAME_PLACEHOLDER`/`DELETE_LABEL`/`EDIT_LABEL` 상수·`GroupListProps`(groups/loading?/error?/emptyMessage?/onDelete?/onEdit?)·loading 우선 → error(role="alert") → empty(role 없는 빈 메시지) → populated 분기 순서·named export + default export convention 을 차용한다. Part 는 그룹의 `members`(멤버 배열 후보 2키) 대신 `persons?: unknown[]` 하나만 부가(소속 인원 수 표시)로 두면 된다.
- `web/src/components/GroupList.test.tsx` — spec 컨벤션(happy/error/loading/empty/populated + onDelete/onEdit 미전달 시 버튼 미렌더 + name 누락 placeholder + id 없는 row key fallback) 참조. 본 slice 의 `PartList.test.tsx` colocated spec 을 이 패턴으로 작성한다.
- `src/user/part.controller.ts`(L58~131, `@Get()`~`@Delete(":id")`) + `prisma/schema.prisma`(L114~122 `model Part`) — Part 응답 shape(id/name/persons) 확인만(수정 금지). 실 fetch 는 본 slice 밖.

## Acceptance Criteria

- [ ] `web/src/components/PartList.tsx` 신설 — 순수 presentational controlled component. `PartRow`(id?: string·name?: string·persons?: unknown[] 모두 선택적, 누락 row throw 없이 안전 렌더) + `PartListProps`(parts: PartRow[]·loading?·error?·emptyMessage?·onDelete?·onEdit?) named export + `PartList` default export. `GroupList` 의 분기 순서(loading 우선 → error `role="alert"` → empty(빈 문자열 emptyMessage 는 기본 문구 fallback) → populated) 를 동형 차용. name 누락 시 `(이름 없음)` placeholder, id 없는 row 는 index key fallback + onDelete/onEdit 버튼 미렌더. `onDelete?`/`onEdit?` 는 주어졌을 때만 각 행에 "삭제"/"수정" 버튼 렌더하고 클릭 시 `row.id` 로 호출(미전달 시 읽기 전용 하위 호환).
- [ ] backend·apiClient·useApiResource·AdminView·다른 컴포넌트 파일 수정 0 (신규 파일 2개만 — 컴포넌트 + colocated spec). 실 GET /api/parts fetch·전역 상태·mount·mutation 배선은 후속 slice.
- [ ] happy-path unit test 1+ — parts 배열이 주어지면 각 파트 name·소속 인원 수(있으면)가 렌더되고, `onDelete`/`onEdit` 전달 시 각 행 삭제/수정 버튼 클릭이 `row.id` 인자로 콜백을 호출함을 검증.
- [ ] error path unit test 1+ — `error` truthy 시 목록 대신 `role="alert"` 영역만 렌더(populated 목록 미렌더). loading===true 이면 error·parts 유무와 무관하게 로딩 표시만 렌더(loading 우선).
- [ ] 분기/flow test — loading → error → empty → populated 각 분기 1+, `onDelete`/`onEdit` 미전달 시 각 버튼 미렌더 분기, 빈 문자열 `emptyMessage` 가 기본 문구로 fallback 하는 분기 각 1+.
- [ ] negative cases 충분 cover — parts=[] 빈 배열 empty 메시지·name 누락 row placeholder·id 없는 row 버튼 미렌더 + index key fallback(throw 없음)·빈 문자열 error(falsy) 는 alert 미진입·persons 미제공 시 인원 수 부가 미표시 등 예외 분기마다 1+.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 실 GET /api/parts fetch·AdminView 마운트·전역 상태·라우팅 — 후속 mount slice.
- Part 생성/삭제/수정 mutation(POST/DELETE/PATCH `/api/parts`) 배선 — 후속 create/delete/edit slice.
- Part 소속 인원(persons) 관리 UI(`GET /api/parts/:id/persons` 조회·재배정) — 별도 후속 slice.
- 정렬·필터·페이지네이션·확인 다이얼로그.
- backend part.controller / service / DTO / prisma schema 변경.
- 다른 stream(인원·그룹·LLM provider·permission-denied·스케줄·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

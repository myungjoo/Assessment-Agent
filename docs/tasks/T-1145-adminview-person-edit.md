---
id: T-1145
title: AdminView 인원 수정 mutation 배선 (PATCH /api/persons/:id)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049]
estimatedDiff: 240
estimatedFiles: 4
created: 2026-07-23
independentStream: web-admin-person
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
  - web/src/components/PersonList.tsx
  - web/src/components/PersonList.test.tsx
plannerNote: P6 PLAN line120 Admin 인원관리 update slice — read(T-1142)/create(T-1143)/delete(T-1144) 후 CRUD 완결, T-1137 provider-edit 패턴 mirror
---

# T-1145 — AdminView 인원 수정 mutation 배선 (PATCH /api/persons/:id)

## Why

P6 frontend Admin 패널 인원 관리 UI CRUD 시퀀스(PLAN.md line120, REQ-049)의 마지막 조각이다. read(T-1142 마운트) → create(T-1143 POST) → delete(T-1144 DELETE) 까지 배선됐고, **수정(update)** 만 남았다. backend `PATCH /api/persons/:id`(`src/user/person.controller.ts` `@Patch(":id")` + `UpdatePersonDto` fullName/email/active partial)는 이미 shipped 이므로, UI 에서 인원 행별 수정 폼을 배선해 CRUD 를 완결한다. 이미 머지된 T-1137(LLM provider 수정, PATCH /api/llm/providers/:id)의 `onEdit` prop + 인라인 수정 폼 + `runUpdateProvider` 패턴을 그대로 mirror 한다.

## Required Reading

- `web/src/views/AdminView.tsx` — 기존 인원 read/create/delete 배선 위치(`runCreatePerson`·`runDeletePerson`·`buildPersonsPath`·`personsRefreshNonce`). 여기에 `runUpdatePerson` + 인라인 수정 폼을 추가한다.
- `web/src/views/AdminView.test.tsx` — 기존 인원 mutation 테스트 패턴(happy/error/분기/negative).
- `web/src/components/PersonList.tsx` — `PersonListProps`(현재 `onDelete?` 만 optional). 여기에 `onEdit?` prop + 행별 수정 버튼(미전달 시 미렌더, 하위 호환)을 추가한다. named/default export convention 유지.
- `web/src/components/PersonList.test.tsx` — `onDelete` 버튼 렌더·콜백 테스트 패턴(renderToStaticMarkup + 함수 직접 호출 element 트리 순회). `onEdit` 도 동형으로 커버.
- `web/src/views/AdminView.tsx` 내 `runUpdateProvider`(T-1137)와 형제인 LLM provider 수정 폼 — 폼 상태·변경 필드만 body·가드 구조를 참고(같은 파일이라 별도 read 불요).
- `src/user/dto/update-person.dto.ts` — 수정 가능 필드 계약(fullName?/email?/active?)만 확인. 폼 입력 3종을 이 계약에 맞춘다.

## Acceptance Criteria

- [ ] `PersonList` 에 `onEdit?: (id: string) => void` prop 추가. 전달 시 각 행에 수정 버튼 렌더, 클릭 시 `row.id` 로 `onEdit` 호출. 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — T-1142 마운트·T-1144 삭제 버튼 보존).
- [ ] `AdminView` 에 인라인 인원 수정 폼(fullName·email·active 3 controlled input) + `runUpdatePerson(id, patch, deps)` 순수 async 러너 추가. 러너는 (1) 빈/공백 id 가드, (2) 변경 없는 빈 body 가드(no-op — 불필요 PATCH 미발사), (3) updating in-flight 이중 PATCH 가드, (4) `encodeURIComponent(id)` 안전 인코딩, (5) 성공 시 `personsRefreshNonce` bump 재조회 + 편집 종료, (6) 실패 시 사람-친화 error state 표면화(throw 없음, no-throw), (7) finally 진행 off 를 수행한다. 변경된 필드만 body 에 포함(T-1137 runUpdateProvider mirror).
- [ ] `buildPersonsPath`·`personsRefreshNonce` 재사용(신규 path 빌더 0). `apiClient`/`useApiResource`/backend 수정 0(ADR-0041 Decision 1).
- [ ] happy-path unit test 1+: `runUpdatePerson` 정상 PATCH(올바른 path·method·변경 필드 body·성공 시 nonce bump 재조회), `PersonList` `onEdit` 전달 시 수정 버튼 렌더 + 클릭 시 `row.id` 콜백.
- [ ] error path unit test 1+: PATCH 404/409/403/network 실패 시 error state 표면화(setUpdateError)·nonce 미bump·throw 없음.
- [ ] flow / 분기 test: 빈/공백 id 가드, 변경 없는 빈 body no-op(PATCH 미발사), updating in-flight 재발사 차단, `onEdit` 미전달 시 버튼 미렌더, nonce 0/>0 분기 각각 test.
- [ ] negative cases 충분 cover: 특수문자 id `encodeURIComponent` 인코딩, 재클릭 이중 PATCH 차단, reject 시 finally 복구, email 미변경 시 body 미포함, 공백-only 입력 처리 — 각 1+ test.
- [ ] `web/` 테스트 전체 통과(`pnpm --dir web test`), `pnpm --dir web build`(tsc --noEmit + vite build) green, lint clean. (web 은 vitest — jest `coverageThreshold` 무관, 기존 web 테스트 관행 준수: 신규 심볼 happy/error/분기/negative 충분 cover.)

## Out of Scope

- backend `src/` 변경(PATCH /api/persons/:id 이미 shipped — 서버 계약 손대지 않음).
- `apiClient.ts`·`useApiResource.ts` 수정(ADR-0041 D1 — 기존 fetch hook 재사용만).
- Group member add/remove·재평가·스케줄 등 다른 Admin slice(별도 task).
- `serviceIdentity`/`partId` 등 person 의 관계 필드 편집(본 task 는 UpdatePersonDto 의 fullName/email/active 3 필드만).
- 인원 조회 필터/정렬 UI(별도 slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)

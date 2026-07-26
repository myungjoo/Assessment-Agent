---
id: T-1237
title: GroupMemberList 에 멤버 추가(onAdd) presentational UI slice 신설 — 후보 select + 추가 버튼
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-group-member-add
dependsOn: []
touchesFiles: [web/src/components/GroupMemberList.tsx, web/src/components/GroupMemberList.test.tsx]
plannerNote: P6 deferred-wiring — GroupMember add mutation 재개. T-1130(remove) 짝. presentational-first slice(onAdd prop + 후보 select + 추가 버튼), 컨테이너 배선(AdminView runAssign POST)은 Follow-up. backend POST :id/members 이미 shipped.
---

# T-1237 — GroupMemberList 에 멤버 추가(onAdd) presentational UI slice 신설

## Why

PLAN.md line 123 의 **deferred 잔여**(backend 계약 확정 후 배선) 중 "GroupMember add·remove mutation" 는 remove 쪽만 T-1130(PR #1022)으로 배선됐고 **add 쪽은 여전히 미배선**이다. backend 는 `POST /api/groups/:id/members`(`group.controller.ts` L140 `addMember`, `add-member.dto.ts` = `personId`, T-0057)가 이미 shipped 이므로 계약 gap 은 없고 web 배선만 남았다.

본 task 는 ADR-0041 의 presentational↔container 분리 원칙과 T-1129(membershipId 노출)/T-1130(remove mutation 배선) 슬라이싱 선례를 따라 **presentational-first slice** 로 진행한다 — `GroupMemberList`(현재 87 LOC, `onRemove` 만 보유하는 순수 controlled component)에 **`onAdd` 콜백 prop + 추가 후보(select) + 추가 버튼** 을 추가한다. 실제 `POST` 요청·낙관적 업데이트·재조회 nonce·후보 파생(persons − 현재 members)은 **컨테이너(AdminView) 책임**이므로 본 slice 의 Out of Scope 이며 후속 slice(Follow-up)가 배선한다. 이렇게 잘라 cap(≤300 LOC / ≤5 파일)을 안전하게 지킨다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` (87 LOC 전체) — 현재 props(`members`·`loading`·`error`·`emptyMessage`·`onRemove`)·loading/error/empty 조기 반환 분기·`Member` 타입(`id`·`name`·`role?`)·named+default export convention. 본 task 는 이 convention 을 그대로 이어 `onAdd`·후보 select 를 추가한다.
- `web/src/components/GroupMemberList.test.tsx` — 기존 vitest spec 구조(render·onRemove 콜백·loading/error/empty 분기 테스트 관례). 본 task 의 신규 test 를 이 파일에 mirror 형태로 확장한다.
- `web/src/components/SuperAdminSetupForm.tsx` 또는 `web/src/components/LoginForm.tsx` — presentational form 이 로컬 `useState` 로 입력값(선택/텍스트)을 controlled 하게 다루는 관례 참고(본 task 의 select 선택값도 동형 로컬 state). fetch·전역 state 는 쓰지 않는다.
- `src/user/dto/add-member.dto.ts` (참고용, 변경 불요) — backend add 계약이 `personId` 단일 필드임을 확인. `onAdd` 시그니처(`(personId: string) => void`)의 근거.

## Acceptance Criteria

- [ ] `GroupMemberList` 에 다음 두 prop 을 **optional** 로 추가한다(기존 props·기본 렌더 무회귀): (1) `onAdd?: (personId: string) => void` — 추가 버튼 클릭 시 선택된 후보의 `personId` 로 호출. (2) `addCandidates?: Member[]` — 추가 가능한 인원 후보 목록(컨테이너가 persons − 현재 members 로 파생해 주입, 본 slice 는 받기만). 두 prop 타입/JSDoc 주석은 §12 한국어로 기존 prop 주석 style 을 mirror.
- [ ] `onAdd` 가 주어졌을 때만 멤버 목록과 함께 **추가 form 영역**(후보 `<select>` + "추가" 버튼)을 렌더한다. `onAdd` 미전달 시 기존 렌더와 byte 수준 동등(추가 UI 0 — 후회귀 방지).
- [ ] 추가 form 은 **members 가 빈 배열일 때도** 노출돼야 한다(첫 멤버 추가 가능) — 즉 `members.length === 0` 조기 반환을 재구성해, `onAdd` 존재 시 빈 상태 메시지와 추가 form 을 함께 렌더한다. 단 `loading===true` / `error` 분기에서는 추가 form 을 렌더하지 않는다(전이 상태 우선 정책 유지).
- [ ] 선택값은 로컬 `useState` 로 controlled — 초기값은 미선택(placeholder option). 후보 미선택 상태에서는 추가 버튼이 **disabled**(또는 클릭해도 `onAdd` 미호출)로 잘못된 빈 personId 전송을 차단한다.
- [ ] `addCandidates` 가 빈 배열(또는 미전달)이고 `onAdd` 가 있으면 "추가할 인원이 없습니다" 류 한국어 안내를 렌더하거나 select 를 disabled 로 두어 빈 후보 상태를 안전 표시(throw 없이).
- [ ] **Happy-path test 1+**: `onAdd` + `addCandidates` 주입 시 후보 select 렌더 → 후보 선택 → "추가" 버튼 클릭 시 `onAdd` 가 선택한 `personId` 인자로 정확히 1회 호출됨을 검증.
- [ ] **Error/negative test 각 1+**: (a) `onAdd` 미전달 시 추가 form 이 렌더되지 않음(추가 UI 부재). (b) 후보 미선택 상태에서 추가 버튼 클릭 시 `onAdd` 가 호출되지 않음(빈 personId 전송 차단). (c) `addCandidates` 빈 배열 시 안내/ disabled 표시 + `onAdd` 미호출. (d) `loading===true` 및 `error` 분기에서 추가 form 이 렌더되지 않음(전이 상태 우선).
- [ ] **Flow/branch cover**: (1) `members` 빈 배열 + `onAdd` 있음 → 빈 상태 메시지 **와** 추가 form 이 함께 렌더되는 분기 test. (2) `members` 1+ + `onAdd` 있음 → 목록 + 추가 form 이 함께 렌더되는 분기 test. (3) 후보 선택/미선택에 따른 추가 버튼 활성/비활성 각 1+.
- [ ] 기존 `onRemove` 콜백·loading/error/empty 분기 test 무회귀(기존 test 유지, 제거 금지).
- [ ] production 코드 변경은 `GroupMemberList.tsx` 1개로 한정 — AdminView.tsx / apiClient / useApiResource / backend 는 **읽기만**, 수정 금지(컨테이너 배선은 Follow-up).
- [ ] `pnpm --dir web test`(vitest) green — 신규 test 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused import/prop 0). 신규 `GroupMemberList.tsx` 라인/분기가 신규 test 로 충분 cover(web coverageThreshold 는 T-1165 게이트로 미강제이나 컴포넌트 전 분기 test 로 사실상 100% 지향).

## Out of Scope

- **AdminView.tsx 컨테이너 배선 금지** — `runAssign`/`handleAdd` POST(`POST /api/groups/:id/members`, body `{personId}`)·낙관적 업데이트·`membersRefreshNonce` bump 재조회·후보 파생(persons − 현재 members)·성공/실패 문구 표면화는 **후속 slice(Follow-up T-1238 후보)** 책임. 본 task 는 presentational prop 접점만.
- 실 fetch / apiClient / useApiResource 호출 0 — `GroupMemberList` 는 순수 controlled component 유지(ADR-0041 §5, ADR-0040 §1). 로컬 select 선택값 `useState` 만 허용(폼 입력 controlled), 데이터 fetch state 금지.
- backend group.controller/service/add-member.dto/api.md 변경 0 — 이미 shipped 계약(POST :id/members)을 web 이 소비할 접점만 마련.
- GroupMemberList 의 기존 remove(onRemove) 동작·문구·마크업 리팩터 금지 — 추가(add) 접점만 신설.
- 후보 정렬/검색/페이지네이션·중복 추가 방지 로직(persons − members diff)은 컨테이너 책임이므로 본 slice 미포함(select 는 주입받은 `addCandidates` 를 그대로 렌더).
- **cap 유의**: presentational 1 파일 + spec 1 파일 ≈ 190 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **T-1238 후보(컨테이너 배선)**: AdminView.tsx 에 멤버 추가 mutation 배선 — `POST /api/groups/:id/members`(body `{personId}`) `runAssign` 순수 러너(빈 personId 가드·중복 발사 가드·성공 시 `membersRefreshNonce` bump 재조회·실패 시 사람-친화 문구) + persons − 현재 members 로 `addCandidates` 파생 + `GroupMemberList` 에 `onAdd`/`addCandidates` 주입. T-1130(remove) 의 정확한 add 거울상.
- 후보: 추가 성공 후 select 선택값 초기화(재선택 UX) — presentational 로컬 처리 여지 검토(본 slice 에서 이미 처리했으면 삭제).

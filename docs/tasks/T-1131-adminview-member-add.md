---
id: T-1131
title: AdminView 멤버 추가 mutation 배선 POST :id/members (personId 입력)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-23
independentStream: group-membership-mutation
dependsOn: []
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: P6 deferred-wiring(PLAN line123) — GroupMember add·remove 중 remove(T-1130) 완결, 짝인 add mutation 배선. backend POST :id/members 존재.
---

# T-1131 — AdminView 멤버 추가 mutation 배선 (POST /api/groups/:id/members)

## Why

PLAN.md line 123 의 P6 deferred 잔여 항목 "GroupMember **add**·remove mutation" 중 remove 는 T-1130 (④c) 으로 이미 배선됐으나, 짝인 **멤버 추가(add) mutation 은 아직 프론트엔드에 없다**. backend 계약 `POST /api/groups/:id/members`(body `{ personId }`, 201, `addMember` — `@@unique([personId, groupId])` 위반 시 409)는 이미 존재하고(`src/user/group.controller.ts`), `AddMemberDto` 도 shipped 상태다. 프론트엔드 AdminView 에 그 add 경로만 배선하면 GroupMember add/remove 한 쌍의 deferred 항목이 완결된다.

본 task 는 AdminView 의 멤버 패널에 personId 입력 + 추가 버튼을 두고, `POST /api/groups/:id/members` 를 발사하는 순수 async 러너(`runAdd`)와 컨테이너 핸들러(`handleAdd`)를 T-1130 의 `runRemove`/`handleRemove` 패턴 1:1 mirror 로 배선한다. 성공 시 `membersRefreshNonce` bump 로 권위 멤버십을 재조회해 새 멤버가 목록에 나타난다. 새 dependency 0, backend/schema 변경 0.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 (1) `runRemove`/`RemoveDeps`/`handleRemove`(L887~1057 부근) 를 그대로 mirror 할 것, (2) `buildGroupMembersPath` + `membersRefreshNonce`(L349~372, L1001~1018) 재조회 nonce 메커니즘, (3) `removing`/`removeError` state 선언 패턴(L1007~1011), (4) 멤버 패널(GroupMemberList 렌더 영역)에 add 입력·버튼을 둘 위치.
- `web/src/views/AdminView.test.tsx` — 기존 `runRemove`/`handleRemove` 단위 테스트 패턴(deps 주입, jsdom 없이 러너 본체 검증) 을 확장.
- `src/user/group.controller.ts` L1~55 — `POST /api/groups/:id/members → addMember`(201) 계약 + `AddMemberDto`(body `{ personId }`) + P2002→409 변환 경계(controller 주석).
- `src/user/dto/add-member.dto.ts` — body shape(`personId!: string`, `@IsString`/`@IsNotEmpty`) — 빈/공백 personId 는 400.
- `docs/architecture/api.md` L82~85 — `/api/groups` endpoint 표(POST `:id/members` row 확인, 새 row 추가 불요 — 이미 존재하는 계약).

## Acceptance Criteria

- [ ] AdminView 멤버 패널에 personId 입력(text input) + "추가" 버튼을 배선한다 — 버튼 클릭 시 `POST /api/groups/:id/members`(body `{ personId }`) 를 발사하는 `handleAdd` 핸들러 연결. 선택 그룹(`selectedGroupId`) 미선택 시 add 미발사(입력 비활성 또는 no-op 가드).
- [ ] `runAdd` 순수 async 러너를 `runRemove` mirror 로 추가 — deps 주입(`add`/`describeError`/`groupId`/`adding`/`setAdding`/`setAddError`/`bumpRefresh`), 성공 시 `bumpRefresh()`(멤버십 재조회 트리거) + 입력 초기화, 실패 시 `setAddError(describeError(e))`(throw 없이 사람-친화 문구 표면화), `finally` 로 진행 off.
- [ ] **happy-path unit test 1+**: `runAdd` 가 정상 personId + 미in-flight 상태에서 `POST /api/groups/<groupId>/members`(body `{ personId }`) 를 정확한 path·method·body 로 발사하고 성공 시 `bumpRefresh` 를 호출함을 검증.
- [ ] **error path unit test 1+**: `add` primitive 가 reject(ApiError) 할 때 `setAddError` 가 사람-친화 문구로 설정되고 `bumpRefresh` 는 호출되지 않으며 throw 하지 않음을 검증(409 중복 멤버 / 403 Admin+ 미만 / 404 group 부재 / 네트워크 0 중 대표 케이스).
- [ ] **flow/branch cover**: (a) 빈/falsy personId → 미발사 가드, (b) `adding`(이전 mutation 미완) → 미발사(이중 POST·경합 차단), (c) 정상 발사 각 분기 1+ test.
- [ ] **negative cases 충분 cover** — 각 1+ test: 빈 personId 미발사 / 공백만 personId 처리 / 이전 add 미완 중 재호출 미발사 / groupId encodeURIComponent 안전 인코딩(비정상 문자 포함) / 409(중복) error 표면화 / 403 error 표면화 / 성공 후 입력 초기화.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build`(tsc + vite) green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — web 커버리지 게이트 준수(변경분 R-112 4종 cover).

## Out of Scope

- **GroupMemberList presentational 컴포넌트 변경 금지** — add 입력·버튼은 AdminView(컨테이너)가 소유한다(controlled lift-up, ADR-0041 Decision 1). GroupMemberList 는 display + onRemove 책임만 유지.
- **person 선택 드롭다운(available persons 필터) 도입 금지** — 본 slice 는 backend 계약(personId string)에 맞춘 최소 text-input 배선만. person picker 는 Follow-up.
- backend controller/service/DTO/schema 변경 0 — 이미 shipped 계약 재사용.
- api.md 변경 0 — POST `:id/members` row 는 이미 존재.
- ReEvaluationTriggerPanel·SchedulePanel·polling 등 다른 deferred 항목 손대지 않음.
- 낙관적 업데이트(optimistic list mutation) 도입 금지 — remove(T-1130)와 동형으로 성공 후 권위 재조회(nonce bump)만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 여기 append. 후보: person 선택 드롭다운으로 add UX 개선.)

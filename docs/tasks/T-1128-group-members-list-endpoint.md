---
id: T-1128
title: GroupController 에 GET /api/groups/:id/members 조회 endpoint 추가 (membership id 포함)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-046]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-07-22
independentStream: group-membership-list-endpoint
dependsOn: []
touchesFiles: [src/user/group.controller.ts, src/user/group.service.ts, src/user/group.controller.spec.ts, src/user/group.service.spec.ts, docs/architecture/api.md]
plannerNote: P6 deferred-wiring(PLAN line123) 언블록 — DELETE :id/members/:membershipId 의 짝 GET 부재 API gap 채움. Q-0051 opt3(4/5/2 완료 후 P6) 사슬.
---

# T-1128 — GroupController 에 GET /api/groups/:id/members 조회 endpoint 추가

## Why

`GroupController` 에는 이미 멤버십 제거 endpoint `@Delete(":id/members/:membershipId")` 가 있으나, 그 짝인 **멤버십 목록 조회 endpoint 가 없다**. 현존 `@Get(":id/persons")` 는 `Person[]` 만 반환해 `membershipId`(= `PersonGroupMembership.id`) 를 노출하지 않으므로, 프론트엔드가 멤버 제거를 배선하려 해도 DELETE 에 넘길 `membershipId` 를 알 방법이 없다. 이 API gap 이 PLAN.md line 123 의 P6 deferred 잔여 항목 "GroupMember add·remove mutation" 배선을 막고 있다.

본 task 는 그 gap 을 메우는 backend 계약 한 조각이다 — `@Get(":id/members")` 가 해당 group 의 `PersonGroupMembership[]`(각 row 의 `id`/`personId`/`groupId`/`createdAt` 포함)을 반환한다. 오너가 Q-0051 옵션 3 으로 P6 진입(React+Vite)을 승인했고 상위 우선순위(옵션 5·4·2)가 모두 완료돼, 본 backend 계약 보강은 P6 deferred 프론트엔드 배선을 여는 정당한 forward 작업이다(make-work 아님 — 실제 API gap 채움). 새 dependency 0, schema 변경 0(기존 `PersonGroupMembership` + `PersonGroupMembershipRepository.findByGroupId` 재사용).

## Required Reading

- `src/user/group.controller.ts` — 기존 route (`@Get(":id/persons")`, `@Post(":id/members")`, `@Delete(":id/members/:membershipId")`) 배선 패턴 + controller-scope `@UsePipes`.
- `src/user/group.service.ts` — `findPersonsByGroupId` 메서드(Group 사전 존재 검증 → NotFoundException, membership 0 시 빈 배열)의 error 정책을 그대로 mirror 할 것.
- `src/user/person-group-membership.repository.ts` — `findByGroupId(groupId): Promise<PersonGroupMembership[]>` 가 이미 존재하며 membership row(`id` 포함)를 반환한다(재사용 — 새 repo 메서드 신설 불요).
- `prisma/schema.prisma` L131–141 — `PersonGroupMembership` 필드 shape(`id`/`personId`/`groupId`/`createdAt`, `@@unique([personId, groupId])`).
- `src/user/group.controller.spec.ts` — 기존 controller spec 패턴(모킹/route 검증)을 확장.
- `src/user/group.service.spec.ts` — 기존 service spec 패턴(repository 모킹, error 분기 검증)을 확장.
- `docs/architecture/api.md` L82–85 — `/api/groups` endpoint 표. 새 row 1개 추가.

## Acceptance Criteria

- [ ] `GroupService` 에 `findMembershipsByGroupId(groupId: string): Promise<PersonGroupMembership[]>` 추가 — `findPersonsByGroupId` 와 동일하게 (a) `findById(groupId)` 로 Group 사전 존재 검증(부재 시 `NotFoundException`), (b) 통과 시 `membershipRepository.findByGroupId(groupId)` 결과 반환. membership 0 이면 빈 배열.
- [ ] `GroupController` 에 `@Get(":id/members")` route 추가 — `service.findMembershipsByGroupId(id)` 를 forward, 200 OK + `PersonGroupMembership[]` 반환. 기존 `@Get(":id/persons")` 배선 패턴 정합.
- [ ] Happy-path unit test: service `findMembershipsByGroupId`(멤버 있는 group → row 배열 반환) + controller `@Get(":id/members")`(service 결과 그대로 forward) 각 1+.
- [ ] Error path unit test: 존재하지 않는 group id → `findById` null → `NotFoundException`(404) 전파를 service·controller 각 1+ 로 검증.
- [ ] Flow / branch: (분기 1) membership 0 건 → 빈 배열 `[]` 반환 / (분기 2) membership 1+ 건 → row 배열 반환 각 1+ test. (분기 3) group 부재 → 404. 세 분기 모두 cover.
- [ ] Negative cases 충분 cover: 존재하지 않는 group id(404) · membership 빈 배열 경계값 · repository 가 throw(의존성 실패) 시 raw 전파 · id 가 빈 문자열/비정상 값일 때 안전 처리 등 예외 분기마다 1+ test(단일 negative 만 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `docs/architecture/api.md` `/api/groups` 표에 `GET /api/groups/:id/members` row 1개 추가(권한 User+, membership 목록 조회 — REQ-028).

## Out of Scope

- 프론트엔드 배선(`web/src/views/AdminView.tsx` 의 멤버 remove mutation·`GroupMemberList.onRemove` 실호출) — 본 backend 계약 머지 후 별도 pr-mode follow-up task.
- 응답에 joined `Person`(이름 등) 포함 — 본 task 는 raw `PersonGroupMembership[]` 만 반환(프론트가 GET `:id/persons` 와 personId 로 조인). person-include shape 는 후속 결정.
- 새 repository 메서드 신설 — 기존 `findByGroupId` 재사용(변경 0).
- AuthGuard / 권한 강제 — 기존 group route 와 동일하게 미적용(후속 auth task 책임).
- pagination / sorting / 필터 — 단순 전체 목록 반환.
- `@Get(":id/persons")` 를 api.md 에 소급 추가 — 본 task 의 새 row 1개만(파일 cap 보호).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
- (planner note) 본 endpoint 머지 후: `web/src/views/AdminView.tsx` 멤버 remove mutation 배선(DELETE `:id/members/:membershipId`, membershipId 는 본 endpoint 로 조회) + `GroupMemberList` 실 members fetch 전환 — P6 deferred 잔여 후속.

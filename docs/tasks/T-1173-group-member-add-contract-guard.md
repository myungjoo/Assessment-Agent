---
id: T-1173
title: 그룹 멤버 추가 endpoint web↔backend 계약 drift-guard spec (api/groups base·:id/members 합성·personId body)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 275
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.group-member-add-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1171/T-1172 Out of Scope 가 예약한 "그룹/인원 mutation" 확산 첫 대상(멤버 추가). api/groups 신규 base·:id/members 합성·personId 단일 body 축, test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1173 — 그룹 멤버 추가 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) 4 slice 를 거쳐 안정됐다. T-1171 Out of Scope 는 "다른 endpoint(사용자 생성 · **그룹/인원 mutation** · LLM provider)로 guard 추가 확산" 을, T-1172 Out of Scope 는 "그룹/인원 mutation · LLM provider 로 guard 추가 확산 — 이후 대상은 별도 slice" 를 명시적으로 예약했다. 본 task 는 그 확산의 세 번째 대상이자 **그룹/인원 mutation 도메인의 첫 대상**으로 **그룹 멤버 추가 endpoint(`POST /api/groups/:id/members`)** 를 택한다.

그룹 멤버 추가는 web `runAdd` 러너가 발사하고 backend `GroupController.addMember`(`@Post(":id/members")`, `@HttpCode(201)`, `@Param("id") groupId` + `@Body() AddMemberDto {personId}`)가 받는다. 이 경로는 앞선 3 slice 와 같은 silent-drift 위험(backend 가 route/method/body-key 를 바꿔도 web unit test 가 green 유지 → 런타임 404/400)을 가지며, 사용자 관리 arc 에 **없던 새 축** 두 개를 도입한다:

1. **신규 base route 도메인** — 앞선 guard 는 모두 `@Controller("api/users")` 또는 `@Controller("api/users/:id/...")` 계열이었으나, 본 endpoint 는 `@Controller("api/groups")` base 다. base route 자체를 파싱·합성 대조하는 첫 그룹 도메인 guard 로, backend 가 base 를 `api/group`(오타)·`api/teams` 로 바꾸면 fail 한다.
2. **단일 required body key `personId`** — `AddMemberDto` 는 `personId!`(`@IsString`+`@IsNotEmpty`) 단일 required, optional 0. web 이 `personId` 정확히 하나만 발사하는지(`fired ⊆ declared` 초과 키 없음 + `required ⊆ fired` 누락 없음)를 대조해, backend 가 body 키를 `memberId`/`userId` 로 rename 하거나 web 이 `groupId` 를 body 로 잘못 발사(groupId 는 path param 이라 body 부재해야 함)하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 guard 파일들과도 disjoint → fineGrainedConcurrency 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.create-user-contract.test.ts`(= T-1172 이 만든 직전 선례 guard spec) 전체 — method decorator 인자 합성 대조 · DTO `{required, optional}` 부분집합 대조 · `options.body` 부재 → 빈 키 집합 매핑 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 아직 use site 4 곳이지만 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 T-1172 머지 결과를 `git show` 로 확인해 정확히 참조(현 디스크의 `AdminView.role-change-contract.test.ts` 도 동형 선례).
- `web/src/views/AdminView.tsx` 1322~1370행 `runAdd` — mock deps(`add`/`describeError`/`adding`/setter/`bumpRefresh`/`resetInput`)로 호출해 실 발사 `path`(`/api/groups/${groupId}/members`)/`method`(`POST`)/`init.body`(`{personId}`)/`init.headers`(`Content-Type: application/json`) 를 캡처하는 대상. `deps.groupId` 로 `:id` 를 채우고 `personId` 는 trim 후 발사 — body 키 대조 시 `personId` 단일 키만 발사됨을 확인.
- `src/user/group.controller.ts` 79행 `@Controller("api/groups")` + 134~148행 `@Post(":id/members")` + `@HttpCode(201)` + `@Param("id") groupId` + `@Body() AddMemberDto`. base route(`api/groups`) 와 method decorator 인자(`:id/members`)를 합성해 최종 template `/api/groups/:id/members` 로 정규화하는 것이 route 대조의 핵심.
- `src/user/dto/add-member.dto.ts` 40~45행 — `personId!`(`@IsString`+`@IsNotEmpty`) 단일 required, optional 0. `groupId` 필드 **부재**(URL path param 으로 추출, REST 정합)도 확인 — web 이 `groupId` 를 body 로 발사하면 안 됨(초과 키). required 단일 필드 부분집합 대조의 backend-side 입력.

## Acceptance Criteria

- [ ] **base route + method 합성 대조 (그룹 도메인 신규 축)**: backend 소스에서 `@Controller("api/groups")` base route 와 `@Post(":id/members")` decorator 인자를 파싱·합성해 최종 template `/api/groups/:id/members` 로 정규화하고, web `runAdd` 발사 path(`/api/groups/<groupId>/members`, `:id` 자리에 실 groupId 치환)/method(`POST`)와 대조한다. backend 가 base 를 `api/group`/`api/teams` 로 바꾸거나 method 인자를 `:id/persons` 등으로 바꾸면 route 불일치로 fail. `:id` path param 은 template 위치(base 다음 세그먼트) + 뒤따르는 static `members` 세그먼트를 함께 검증.
- [ ] **body 키 부분집합 대조 (단일 required)**: `AddMemberDto` 필드 추출기가 `{required: [personId], optional: []}` 를 반환하고, web 발사 body 키에 대해 `fired ⊆ declared`(초과 키 없음 — `groupId`/기타 초과 키 없음, forbidNonWhitelisted 근거) AND `required ⊆ fired`(필수 누락 없음 — `personId` 발사됨) 로 대조한다.
- [ ] **Happy-path test 1+**: 현재 backend(`@Post(":id/members")`, base `api/groups`, `personId` 단일 required, optional 0) 상태에서 web `runAdd` 발사가 정밀화된 route/method/body 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/groups")` → `/api/groups`) 1 test, (2) method decorator 인자 있음(`:id/members`) 합성분기 1 test(param + trailing static 조합), (3) `fired ⊄ declared`(초과 키) 실패분기 · `required ⊄ fired`(필수 누락) 실패분기 각 1 test, (4) `options.body` 부재 → 빈 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/group`(오타)/`api/teams` 로 바꿈 → base route 불일치 fail, (b) backend 가 method 인자를 `:id/persons`/`:id` 로 바꿈 → route 세그먼트 불일치 fail, (c) backend 가 method 를 `@Put()`/`@Delete()` 로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (d) web 이 DTO 에 없는 초과 키(`groupId` body 발사/`memberId` 오타) 발사 → `fired ⊆ declared` 위반 fail, (e) web 이 required `personId` 를 누락 → `required ⊆ fired` 위반 fail, (f) backend DTO 가 `personId` 를 `memberId` 로 rename 했는데 web 은 여전히 `personId` 발사 → 초과 키 fail(DTO rename drift 감지), (g) `options.body` 부재 시 `SyntaxError` 없이 "body 키 불일치"(빈 집합 ≠ required)로 판정, (h) 주석 줄에만 `@Post(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`@Controller("api/groups")` → `api/group`) 또는 method 인자(`:id/members` → `:id/persons`) 를 임시로 바꾸거나 DTO 의 `personId` 를 `memberId` 로 임시 rename 해 정밀화된 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1172) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 4 곳(인스턴스 접근 + 역할 변경 + 사용자 생성 + 그룹 멤버 추가)이 되지만, 각 파일이 로컬 함수를 compact 하게 두는 현 패턴이 아직 유지 가능하므로 YAGNI. 공용 helper 추출은 로컬 중복이 실제 비용이 될 때 별도 slice 로 검토(본 task Follow-ups 에 추출 후보 박제).
- 다른 그룹/인원 mutation(멤버 제거 `DELETE /api/groups/:id/members/:membershipId` — **two path param 합성이라는 신규 축** · 그룹 생성 `POST /api/groups` · 인원 CRUD)로 guard 추가 확산 — 본 slice 로 그룹 멤버 추가까지만. 이후 대상(특히 멤버 제거의 다중 param 축)은 별도 slice.
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(201/400/404/409) 대조 · `@HttpCode(201)` 성공 코드 대조 · P2002(중복 멤버 @@unique) 409 응답 대조 · 응답 shape(PersonGroupMembership) 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- backend 의 forbidNonWhitelisted `groupId` reject 동작 자체를 e2e 로 검증 — 본 guard 는 web 이 초과 키를 발사하지 않는지(`fired ⊆ declared`)만 정적 대조. 실 400 응답 검증은 backend e2e 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가.)

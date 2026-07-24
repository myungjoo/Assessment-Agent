---
id: T-1174
title: 그룹 멤버 제거 endpoint web↔backend 계약 drift-guard spec (DELETE :id/members/:membershipId two-path-param 합성·body 부재·membershipId 축)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.group-member-remove-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1173 Out of Scope 가 명시 예약한 "멤버 제거 DELETE two-path-param 합성 신규 축" 확산 slice. api/groups base + :id + static members + :membershipId 합성·DELETE body 부재·membershipId(≠personId) 축, test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1174 — 그룹 멤버 제거 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가(T-1173) 5 slice 를 거쳐 안정됐다. T-1173 Out of Scope 는 "다른 그룹/인원 mutation(멤버 제거 `DELETE /api/groups/:id/members/:membershipId` — **two path param 합성이라는 신규 축**)로 guard 추가 확산 … 이후 대상(특히 멤버 제거의 다중 param 축)은 별도 slice" 를 **명시적으로 예약**했다. 본 task 는 그 예약의 첫 대상인 **그룹 멤버 제거 endpoint(`DELETE /api/groups/:id/members/:membershipId`)** 를 택한다.

그룹 멤버 제거는 web `runRemove` 러너(`AdminView.tsx` 1206~1239)가 발사하고 backend `GroupController.removeMember`(`@Delete(":id/members/:membershipId")`, `@HttpCode(204)`, `@Param("id") _groupId` + `@Param("membershipId") membershipId`, DTO/body 부재)가 받는다. 이 경로는 앞선 4 slice 와 같은 silent-drift 위험(backend 가 route/method/param 을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 그룹/인원 mutation 도메인에 **없던 새 축** 세 개를 도입한다:

1. **Two path param 합성 (신규 축)** — 앞선 guard 는 path param 이 0개(`POST /api/users`)·1개(`PATCH /api/users/:id/role`, `POST /api/groups/:id/members`) 였으나, 본 endpoint 는 `:id` + static `members` + `:membershipId` 로 **두 path param 을 static 세그먼트가 사이에 낀 채 합성**한다. base(`api/groups`) + `:id` + static(`members`) + `:membershipId` 4 세그먼트 template `/api/groups/:id/members/:membershipId` 를 정규화·대조하는 첫 다중-param guard 다. backend 가 param 순서·static 세그먼트를 바꾸면 fail 한다.
2. **DELETE + body 완전 부재 (신규 축)** — 앞선 mutation guard 는 모두 body 를 발사(POST/PATCH + JSON body)했으나, 본 endpoint 는 body 도 Content-Type 헤더도 없다(`{ method: 'DELETE' }` 만). web 발사 `init` 에 `body` 키가 **부재**하고(빈 집합) method 가 정확히 `DELETE` 임을 대조해, web 이 불필요한 body/헤더를 실수로 붙이거나 backend 가 method 를 `@Post`/`@Patch` 로 바꾸면 fail 한다.
3. **`:membershipId`(≠`:personId`) param 명 대조** — controller 헤더 주석(197행)이 박제하듯 이 endpoint 는 driver 원안 `:personId` 를 **`:membershipId` 로 정정**했다(service `removeMember(membershipId)` 시그니처 정합). web 이 path 마지막 세그먼트에 실 membershipId 를 발사하는지, backend param 명이 `:membershipId` 로 유지되는지를 대조한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 guard 파일들과도 disjoint → fineGrainedConcurrency 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.group-member-add-contract.test.ts`(= T-1173 이 만든 직전 선례 guard spec) 전체 — base route + method decorator 인자 합성 대조 · DTO `{required, optional}` 부분집합 대조 · `options.body` 부재 → 빈 키 집합 매핑 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인(현 디스크 존재 확인됨).
- `web/src/views/AdminView.tsx` 1206~1239행 `runRemove` — mock deps(`remove`/`describeError`/`groupId`/`removing`/`setRemoving`/`setRemoveError`/`bumpRefresh`)로 호출해 실 발사 `path`(`/api/groups/${groupId}/members/${membershipId}`, 두 param 모두 `encodeURIComponent`)/`method`(`DELETE`)/`init` 에 **body 키 부재**를 캡처하는 대상. 빈/falsy `membershipId` 는 미발사(가드) — happy-path 는 유효 membershipId 발사 케이스로 캡처.
- `src/user/group.controller.ts` 79행 `@Controller("api/groups")` base + 198~205행 `@Delete(":id/members/:membershipId")` + `@HttpCode(204)` + `@Param("id") _groupId` + `@Param("membershipId") membershipId`. base(`api/groups`) 와 method decorator 인자(`:id/members/:membershipId`)를 합성해 최종 template `/api/groups/:id/members/:membershipId` 로 정규화하는 것이 route 대조의 핵심. DTO/`@Body()` **부재**(body 없음)도 확인 — web 이 body 를 발사하면 안 됨.

## Acceptance Criteria

- [ ] **base + two-path-param + static 세그먼트 합성 대조 (신규 축)**: backend 소스에서 `@Controller("api/groups")` base 와 `@Delete(":id/members/:membershipId")` decorator 인자를 파싱·합성해 최종 template `/api/groups/:id/members/:membershipId` 로 정규화하고, web `runRemove` 발사 path(`:id`·`:membershipId` 자리에 실 groupId·membershipId 치환)/method(`DELETE`)와 대조한다. 세그먼트 구조 — base(`api/groups`) → `:id`(param) → `members`(static) → `:membershipId`(param) 4 세그먼트 순서 — 를 함께 검증한다. backend 가 param 순서를 바꾸거나(`:membershipId/members/:id`) static 세그먼트를 바꾸면(`:id/persons/:membershipId`) fail.
- [ ] **body 부재 대조 (신규 축, DELETE)**: web 발사 `init` 에 `body` 키가 **부재**함(빈 키 집합)을 대조한다. backend 에 DTO/`@Body()` 가 없으므로 web 이 body 를 붙이면 초과이며 fail. Content-Type 헤더도 없음을 함께 확인(선택 — body 부재로 충분하면 생략 가능).
- [ ] **Happy-path test 1+**: 현재 backend(`@Delete(":id/members/:membershipId")`, base `api/groups`, body 없음) 상태에서 web `runRemove` 발사가 정밀화된 route/method/body-부재 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/groups")` → `/api/groups`) 1 test, (2) 다중 param + static 세그먼트 합성분기(`:id/members/:membershipId` → 4 세그먼트 순서) 1 test, (3) method 인자(`DELETE`) 대조분기 1 test, (4) `init.body` 부재 → 빈 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/group`(오타)/`api/teams` 로 바꿈 → base route 불일치 fail, (b) backend 가 static 세그먼트를 `members`→`persons` 로 바꿈 → 세그먼트 불일치 fail, (c) backend 가 param 순서를 뒤집음(`:membershipId/members/:id`) → 세그먼트 순서 불일치 fail, (d) backend 가 method 를 `@Post()`/`@Patch()` 로 바꿨는데 web 은 DELETE 발사 → method 불일치 fail, (e) web 이 불필요한 `body` 를 발사(`{ method: 'DELETE', body: '...' }`) → body 부재 위반 fail, (f) backend param 명이 `:membershipId`→`:personId` 로 되돌아감(원안 회귀) → param 명/세그먼트 대조 fail, (g) `init.body` 부재 시 `SyntaxError`/`undefined` 접근 없이 "body 없음"으로 정상 판정, (h) 주석 줄에만 `@Delete(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/groups`→`api/group`) 또는 method 인자(`:id/members/:membershipId`→`:id/persons/:membershipId`) 를 임시로 바꾸거나 method decorator 를 `@Post` 로 임시 변경해 정밀화된 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1173) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 5 곳(인스턴스 접근 + 역할 변경 + 사용자 생성 + 그룹 멤버 추가 + 그룹 멤버 제거)이 되지만, 각 파일이 로컬 함수를 compact 하게 두는 현 패턴이 아직 유지 가능하므로 YAGNI. 공용 helper 추출은 로컬 중복이 실제 비용이 될 때 별도 slice 로 검토(본 task Follow-ups 에 추출 후보 박제). 특히 5 use site 도달로 추출 ROI 가 임계에 근접했으므로 Follow-up 으로 명시 검토.
- 다른 그룹/인원 mutation(그룹 생성 `POST /api/groups` · 인원 CRUD)로 guard 추가 확산 — 본 slice 로 그룹 멤버 제거까지만. 이후 대상은 별도 slice.
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(204/404) 대조 · `@HttpCode(204)` No Content 코드 대조 · P2025(row 부재) 404 응답 대조 · 응답 body 부재(No Content) 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runRemove` 의 빈/falsy membershipId 미발사 가드 · `removing` 이중발사 가드 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 5 곳 도달 — 공용 helper 추출 ROI 검토를 별도 slice 후보로 박제할 것.)

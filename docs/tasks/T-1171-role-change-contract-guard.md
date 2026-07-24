---
id: T-1171
title: 역할 변경 endpoint web↔backend 계약 drift-guard spec (route·method·body·role enum 부분집합)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.role-change-contract.test.ts
plannerNote: P6 line120 사용자 관리 arc — T-1170 Out of Scope 가 예약한 "guard 확산(패턴 안정 후)" 첫 적용. 역할 변경 endpoint 계약 guard 신규 파일(test-only, pr, 파일-disjoint)
---

# T-1171 — 역할 변경 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 후속 slice 다. T-1169 가 인스턴스 접근 endpoint 에 web↔backend 계약 drift-guard 를 도입하고 T-1170 이 그 추출·대조 로직을 정밀화(decorator 인자 합성 · required/optional 부분집합 · body 미전송 진단)하면서, T-1170 Out of Scope(파일 56행)는 "다른 endpoint(사용자 생성/역할 변경/그룹/인원/LLM provider)로 계약 guard 확산 — **패턴 안정 후 별도 slice**"를 명시적으로 예약했다. 인스턴스 접근 guard 가 두 slice(T-1169 도입 + T-1170 정밀화)를 거쳐 안정됐으므로, 본 task 는 그 확산의 첫 대상으로 **역할 변경 endpoint(`PATCH /api/users/:id/role`)** 를 택한다.

역할 변경은 web `runChangeRole` 러너가 발사하고 backend `UserController.changeRole`(`@Patch(":id/role")`, `ChangeRoleDto {role}`, `@Roles("SuperAdmin")`)가 받는다. 이 경로는 인스턴스 접근과 같은 silent-drift 위험(backend 가 route/method/body-key 를 바꿔도 web unit test 가 green 유지 → 런타임 404/400)을 가지며, **추가로 인스턴스 접근에는 없는 drift 축**이 하나 더 있다: `ChangeRoleDto` 의 `@IsIn(VALID_ROLE_VALUES)` enum 제약. web 이 발사하는 role 값 집합("SuperAdmin"/"Admin"/"User")이 backend enum 의 부분집합이 아니면 정상 폼인데도 런타임 400 이 난다. 본 guard 는 이 **role enum 부분집합 대조**를 endpoint-특화 차원으로 추가해 make-work 가 아닌 실효 검증을 만든다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 인스턴스 접근 guard 파일과도 disjoint → fineGrainedConcurrency 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.instance-access-contract.test.ts` 전체 — T-1169+T-1170 이 만든 **선례 guard spec**. 특히 method decorator 인자 합성 대조 · DTO `{required, optional}` 부분집합 대조 · `options.body` 부재 → 빈 키 집합 매핑 로직. 본 task 는 이 파일을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 아직 2 use site 라 공용 helper 추출 안 함, 아래 Out of Scope).
- `web/src/views/AdminView.tsx` 1855~1920행 부근 `runChangeRole` — mock deps 로 호출해 실 발사 `path`/`method`/`init.body` 를 캡처하는 대상. 발사 shape 는 `PATCH /api/users/:id/role` + `body {role}`. web 이 제시하는 role 후보 상수(예: 역할 select 옵션)도 이 파일에서 확인해 enum 부분집합 대조의 web-side 입력으로 삼는다.
- `src/user/user.controller.ts` 105~145행 — `@Controller` base route + `@Patch(":id/role")` decorator 인자 + `@Roles("SuperAdmin")` + `@Body() ChangeRoleDto`. decorator 인자(`":id/role"`)를 base route 와 합성해 최종 route shape 를 재구성하는 것이 route 대조의 핵심(인스턴스 접근 guard 의 인자 합성 로직 그대로).
- `src/user/dto/change-role.dto.ts` 전체 — `role!: string`(단일 required, optional 0) + `VALID_ROLE_VALUES = ["SuperAdmin","Admin","User"]` enum + `@IsIn`. required 부분집합 대조 입력 + **role enum 부분집합 대조**의 backend-side 입력.

## Acceptance Criteria

- [ ] **route/method 합성 대조**: backend 소스에서 `@Controller(...)` base route 와 `@Patch(...)`/`@Post(...)`/`@Delete(...)` decorator 인자를 파싱·합성해 최종 route shape(`.../api/users/:id/role`)와 HTTP method(`PATCH`)를 재구성하고, web `runChangeRole` 발사 path/method 와 대조한다. `:id` 같은 path param 은 web 이 실제 id 로 치환하므로 param 위치를 정규화(placeholder ↔ 실값)해 비교한다.
- [ ] **body 키 부분집합 대조**: `ChangeRoleDto` 필드 추출기가 `{required: [role], optional: []}` 를 반환하고, web 발사 body 키에 대해 `fired ⊆ declared`(초과 키 없음, forbidNonWhitelisted 근거) AND `required ⊆ fired`(필수 누락 없음) 로 대조한다.
- [ ] **role enum 부분집합 대조 (endpoint-특화 신규 축)**: backend `change-role.dto.ts` 에서 `VALID_ROLE_VALUES` 배열 리터럴을 파싱해 백엔드 enum 집합을 얻고, web 이 발사/제시하는 role 값 집합이 그 **부분집합**임을 단언한다(`webRoles ⊆ backendEnum`). backend 가 role 값을 rename/축소하거나 web 이 enum 밖 role 을 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Patch(":id/role")`, `role` 단일 required, `["SuperAdmin","Admin","User"]` enum) 상태에서 web `runChangeRole` 발사가 정밀화된 route/method/body/enum 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) decorator 인자 있음(`":id/role"` 합성) 대조 1 test, (2) `fired ⊄ declared`(초과 키) 실패분기 · `required ⊄ fired`(필수 누락) 실패분기 각 1 test, (3) role enum `webRoles ⊆ backendEnum` 통과분기 · 위반분기 각 1 test, (4) `options.body` 부재 → 빈 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 route 를 `":id/change-role"` 로 바꿨는데 web 은 `.../role` 발사 → route 불일치 fail, (b) backend 가 method 를 `@Put` 으로 바꿨는데 web 은 PATCH 발사 → method 불일치 fail, (c) web 이 DTO 에 없는 초과 키(`newRole` 오타 등) 발사 → `fired ⊆ declared` 위반 fail, (d) web 이 required `role` 을 누락 → `required ⊆ fired` 위반 fail, (e) backend enum 이 `["Owner","Member"]` 로 rename 됐는데 web 은 여전히 "Admin" 발사 → enum 부분집합 위반 fail, (f) `options.body` 부재 시 `SyntaxError` 없이 "body 키 불일치"(빈 집합 ≠ required)로 판정, (g) 주석 줄에만 `@Patch(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend decorator 를 임시로 `@Put(":id/role")` 또는 enum 을 임시 rename 해 정밀화된 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1170) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · `web/src/views/AdminView.instance-access-contract.test.ts` · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 아직 2 곳(인스턴스 접근 + 역할 변경)뿐이라 로컬 함수로 둔다(YAGNI). 3+ use site 로 늘면 그때 공용 helper 추출을 별도 slice 로 검토.
- 다른 endpoint(사용자 생성 · 그룹/인원 mutation · LLM provider)로 guard 추가 확산 — 본 slice 로 역할 변경까지만. 이후 대상은 별도 slice.
- 응답 status code(200/400/403/404) 대조 · UserResponseDto 응답 shape 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가.)

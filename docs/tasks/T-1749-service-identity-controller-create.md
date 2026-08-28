---
id: T-1749
title: Add the POST create route to ServiceIdentityController
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-073]
independentStream: service-identity-backend
dependsOn: [T-1748]
touchesFiles:
  - src/user/service-identity.controller.ts
  - src/user/service-identity.controller.spec.ts
  - src/user/user.module.ts
estimatedDiff: 210
estimatedFiles: 3
created: 2026-08-28
plannerNote: P5 / PLAN 132 행 오너 지시 chain — ADR-0058 §Follow-ups (b) 잔여 4 route 중 POST 생성 1 개만 절단
---

# T-1749 — ServiceIdentityController 에 POST 생성 route 1 개 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(인원별 ServiceIdentity 관리 API·UI, R-182~R-183) chain 에서
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (a)`(DTO · service ·
repository)는 T-1739~T-1747 로 마감됐고, `§Follow-ups (b)`(controller + RBAC 배선)는
[T-1748](T-1748-service-identity-controller-list.md) 이 controller 골격 + GET 목록 1 route 까지만
절단해 **POST · PATCH · DELETE · primary 지정 4 route 가 미노출**이다. 그래서 UI 로 추가한 인원에게
서비스 ID 를 붙일 HTTP 경로가 아직 0 이다.

본 slice 는 그 잔여 4 route 중 **POST 생성 1 개만** 가져간다. 직전 controller slice 실적이
`+300/-1`(route 1 개 + spec)이라 2 route 이상을 한 commit 에 담으면
[CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 확실히 넘기 때문이다. service 쪽
`ServiceIdentityService.create`(첫 row 자동 primary 승격 · `P2002` → 409 변환)는
[T-1740](T-1740-service-identity-service-create.md) 이 이미 박제했으므로 본 task 는 **HTTP 노출만**
한다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 1`(route 표의 POST 행 · 201 status), `§Decision 2`(create DTO 가 `isPrimary` 를 받지
  않는 이유), `§Decision 4`(RBAC — 편집은 Admin+), `§Decision 5`(오류 계약 · controller 는 추가 변환 0)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 확장 대상.
  헤더 주석의 route 목록 · 책임 경계 · controller-scope `ValidationPipe` 설정
- [src/user/service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) —
  colocated spec. fixture(`buildIdentityFixture`) · service mock(`buildServiceMock`) · metadata 검증
  관례를 그대로 재사용한다
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `96~135 행` —
  `create(personId, dto)` 시그니처와 오류 계약(404 · 409 · 그 외 propagate)
- [src/user/dto/create-service-identity.dto.ts](../../src/user/dto/create-service-identity.dto.ts) —
  body DTO(`service` · `externalId` 2 필드)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `1~60 행` — 기존 POST route 의
  `@Roles("Admin")` · body DTO 배선 관례(mirror 대상)
- [src/user/user.module.ts](../../src/user/user.module.ts) `24~33 행` — 헤더 주석의 endpoint 목록
  (본 task 에서 문구 1 줄만 갱신, `controllers` 배열 diff 0)

## Acceptance Criteria

- [ ] [service-identity.controller.ts](../../src/user/service-identity.controller.ts) 에 POST handler
      1 개 추가 — path 는 controller prefix 그대로(`@Post()`), body 는 `CreateServiceIdentityDto`,
      `@Param("personId")` 와 함께 `service.create(personId, dto)` 로 **1 회 위임하고 반환값을 가공
      없이** 돌려준다. handler 안 `try`/`catch` 0 · 자체 분기 0 · 새 dependency 0.
- [ ] 성공 status 는 **201** — NestJS 의 POST 기본값이므로 `@HttpCode` 를 붙이지 않는다
      (ADR-0058 `§Decision 1` 의 POST 행).
- [ ] RBAC 은 `@UseGuards(JwtAuthGuard, RolesGuard)` + **`@Roles("Admin")`**(GET 의 `"User"` 와 다름 —
      ADR-0058 `§Decision 4`). guard 순서는 GET route 와 동일.
- [ ] controller 헤더 주석의 route 목록 · 책임 경계(미노출 route 목록)를 POST 배선 사실에 맞게
      갱신한다. [user.module.ts](../../src/user/user.module.ts) 헤더 주석의 endpoint 문구도 같은
      사실로 1 줄 갱신하되 `controllers` · `providers` · `exports` 배열 diff 는 0.
- [ ] **happy-path unit test 1+** — colocated
      [service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) 에 POST
      describe 추가: `service.create` 가 1 회, 인자가 `(personId, dto)` 로 정확히 전달되고, 반환된
      row 가 **동일 참조로** 그대로 나온다.
- [ ] **error path unit test 1+** — service 가 `ConflictException`(409, `P2002` 변환) ·
      `NotFoundException`(404, person 부재) · 일반 `Error` 를 던질 때 controller 가 **동일 인스턴스를
      그대로 전파**하고 상태를 변형하지 않는다(각 1+).
- [ ] **분기 cover** — POST handler 는 순수 위임이라 코드 분기가 없다. 그 사실을 spec 주석으로 명시하고,
      분기 축은 metadata 검증으로 대체한다: (i) route method 가 `RequestMethod.POST`,
      (ii) `@HttpCode` 미부착(기본 201 유지), (iii) `@Roles` 값이 `"Admin"` 이며 GET 의 `"User"` 와
      독립적으로 박제됨, (iv) guard stack 이 `JwtAuthGuard` → `RolesGuard` 순서.
- [ ] **negative cases 충분 cover** — 최소 4 종 각 1+: (i) 빈 문자열 `personId` 도 controller 가
      가공·차단 없이 그대로 위임(검증 책임은 service · pipe), (ii) service 가 throw 하면 이후 로직이
      단락되어 반환값이 없고, (iii) POST 호출 시 `findByPersonId` 등 **다른 collaborator 호출 0 회**,
      (iv) controller 가 응답 body 를 감싸거나 필드를 덧붙이지 않음(반환 객체 키 집합 불변).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 전체 green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 변경 대상
      controller 파일은 line · branch · function 100% 유지.

## Out of Scope

- PATCH 수정 · DELETE 삭제 · POST primary 지정 3 route 배선 — 각각 후속 slice(ADR-0058
  `§Follow-ups (b)` 잔여).
- `ServiceIdentityService` · `ServiceIdentityRepository` · DTO 본문 로직 변경 0 — 본 task 는 HTTP
  노출만 한다.
- e2e · smoke spec 신설 0 (ADR-0058 `§Follow-ups (c)`).
- [docs/architecture/api.md](../architecture/api.md) doc-sync 0 (ADR-0058 `§Follow-ups (e)` — 5 route
  가 다 배선된 뒤 한 번에).
- [src/user/service-identity-primary-order.ts](../../src/user/service-identity-primary-order.ts) 헤더
  주석의 "소비처는 현재 0" stale 문구 정정 — 별도 slice(reviewer 가 PR #1377 에 MINOR 로 외화).
- web / AdminView 패널 변경 0 (ADR-0058 `§Follow-ups (d)`).
- 응답 envelope · pagination · 정렬 query param 도입 0.
- `prisma/schema.prisma` · `package.json` 변경 0 (새 dependency 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

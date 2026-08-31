---
id: T-1817
title: Add the DELETE route to CollectionTargetController
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-backend
dependsOn: [T-1816]
touchesFiles:
  - src/assessment-collection/collection-target.controller.ts
  - src/assessment-collection/collection-target.controller.spec.ts
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-31
plannerNote: ADR-0059 Follow-ups (c) 여섯째 조각 — 편집 tier 잔여 DELETE 1 route 로 5 route 표 완결
---

# T-1817 — Add the DELETE route to CollectionTargetController

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (c)` 의 **여섯째이자
마지막 route 조각**이다. `§Decision 5` route 표 5 행 중 4 행(GET 목록 · GET 단건 · POST · PATCH)이
T-1814 ~ T-1816 으로 배선됐고, 잔여는 **DELETE 등록 해제 1 route** 뿐이다 — `origin/main` 의
[collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) 에
`@Delete` 가 **0 건**임을 issue-still-relevant pre-check 로 실측했고, 그 controller 주석도 "남은 편집
1 route(DELETE ... 성공 status 204)는 후속 slice 로 남긴다" 로 본 조각을 명시적으로 예고한다.
소비처 0 인 채 방치된 `CollectionTargetService.delete`(T-1811 이 `P2025` → 404 변환까지 박제)의
유일한 HTTP 진입점이 본 route 이며, 이 route 가 붙어야 `§Follow-ups (d)` e2e 와 `(f)` doc-sync 가
5 route 전량을 대상으로 착수할 수 있다.

route 1 개 = slice 1 개 절단은 [ServiceIdentityController](../../src/user/service-identity.controller.ts)
선례(T-1749 POST → T-1750 PATCH → T-1751 DELETE)와 본 controller 의 T-1814 → T-1815 → T-1816
승계다.

## Required Reading

- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — 배선 대상. 헤더 주석의 route 목록 · 책임 경계 · `@Patch(":id")` handler 형태.
- [src/assessment-collection/collection-target.controller.spec.ts](../../src/assessment-collection/collection-target.controller.spec.ts) — **colocated spec**(본 task 가 확장할 파일). 특히 말미의 `negative (f)` prototype 핸들러 목록 test 와 `negative (d-5)` / `(d-6)` metadata drift guard.
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) `105 행` 이하 — `delete(id)` 계약(`P2025` → `NotFoundException`, 그 외 raw propagate, 삭제된 row 반환).
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `151 행` 이하 — `@Delete` + `@HttpCode(204)` + `Promise<void>` 선례(handler 이름 `remove`).
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` — route 표 DELETE 행(204 · body 없음 · 일시 제외는 `active=false` PATCH) · 권한 열(`Admin+`) · 오류 표 a / b / d 행.

## Acceptance Criteria

- [ ] `CollectionTargetController` 에 `@Delete(":id")` handler 1 개를 추가한다 — `@HttpCode(204)` **명시 부착**(NestJS `@Delete` 기본값은 200 이라 204 는 반드시 선언해야 한다, `ServiceIdentityController.remove` 선례), `@UseGuards(JwtAuthGuard, RolesGuard)` 를 기존 4 route 와 **같은 순서**로, `@Roles("Admin")` 편집 tier.
- [ ] handler 는 **순수 위임 + body 없음** — `@Param("id") id: string` 만 받아 `await this.service.delete(id)` 를 정확히 1 회 호출하고 반환 타입은 `Promise<void>`(삭제된 row 를 응답 body 로 흘리지 않는다, `§Decision 5` DELETE 행 "body 없음"). try/catch 0 · 오류 변환 0 · `id` 가공(trim · 형식 검증 · 기본값) 0.
- [ ] service · repository · DTO · module · prisma schema 는 **1 LOC 도 바뀌지 않는다** (`git diff --stat` 이 controller + colocated spec 2 파일만 보여야 한다).
- [ ] **happy-path unit test 1+** — colocated spec [collection-target.controller.spec.ts](../../src/assessment-collection/collection-target.controller.spec.ts) 에 DELETE handler 가 `service.delete` 를 주어진 `id` 로 1 회 호출하고 `undefined` 를 반환함(삭제 row 를 되돌리지 않음)을 고정하는 test.
- [ ] **error path unit test 1+** — service 가 `NotFoundException`(부재 `:id`) 을 던질 때 handler 가 **흡수 · 변환 없이 그대로 전파**함을 고정. 추가로 `NotFoundException` 이 아닌 일반 `Error`(raw propagate 축) 1 종도 그대로 전파됨을 고정.
- [ ] **분기 cover** — 본 handler 에는 조건 분기가 없다(순수 위임). 따라서 분기 축은 기존 4 route spec 의 관례대로 **입력 경로 고정 + route/guard metadata 케이스**로 대체 배치한다: `@Delete` method · path `":id"` · `@Roles(["Admin"])` · `@HttpCode(204)` 부착을 각각 assert.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (1) DELETE handler 가 자기 위임 대상 외 service 메서드(`findAll` · `findById` · `create` · `update`)를 **전혀 호출하지 않음**, (2) 빈 문자열 · 공백 `id` 도 가공 없이 그대로 service 에 전달됨(검증을 controller 가 재구현하지 않음), (3) `@Roles` tier 가 조회 tier `"User"` 로 미끄러지지 않음(편집 권한 회귀 guard), (4) `@HttpCode(204)` 가 실제로 박혀 있음(기본값 200 으로 미끄러지면 fail), (5) 기존 4 handler 의 `@Roles` tier · guard 순서 · `@HttpCode` 부재가 **회귀하지 않음**.
- [ ] **`negative (f)` prototype 핸들러 목록 test 갱신 (4 → 5 handler)** — spec 말미의 `it("negative (f): public 핸들러가 정확히 ... 4 개뿐이다 (DELETE 미배선)")` 를 5 handler(`create` · `findAll` · `findById` · `remove` · `update`) 로 갱신하고, `not.toContain(RequestMethod.DELETE)` 단언을 `toContain` 축으로 뒤집는다. describe 문자열 · 주석의 "DELETE 미배선" 표현도 함께 정정한다.
- [ ] controller 헤더 주석의 route 목록(현재 4 행) · "남은 편집 1 route(DELETE)" 문단 · `Out of Scope` 의 "DELETE route 0" 표현을 **5 route 전량 배선 완료** 사실로 갱신한다(§12 — 주석 한국어).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `collection-target.controller.ts` 는 기존 slice 와 동일하게 line · branch · function coverage 100% 를 유지한다.

## Out of Scope

- `collection-target.service.ts` · `collection-target.repository.ts` · DTO 2 종 · `assessment-collection.module.ts` · `prisma/schema.prisma` 변경 (본 slice 는 controller + colocated spec 2 파일뿐).
- `{ "endpoint": null }` 오류 계약 정정 (T-1813 reviewer MINOR M2 — `@IsOptional` → `@ValidateIf` DTO decorator 축 변경). DTO + DTO spec 2 파일 **독립 slice** 로 이월돼 있으며 본 route slice 와 합치면 cap 초과다.
- e2e / smoke spec 추가 — `§Follow-ups (d)` 소관 (5 route 전량 배선 후 오류 표 5 행을 실 HTTP 로 고정).
- [api.md](../architecture/api.md) · [requirements.md](../requirements.md) doc-sync 와 REQ-070 / REQ-072 / REQ-073 status 재판정 — `§Follow-ups (f)` 소관(direct doc slice).
- AdminView 등록·편집 패널 (`§Follow-ups (e)`), env 병합 배선 (`§Follow-ups (g)`).
- soft delete · cascade · `active=false` 자동 전환 등 삭제 semantics 변경 — `§Decision 5` 는 hard delete 를 확정했다.
- pagination / 정렬 / 필터 query param, 커스텀 오류 envelope 도입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 인접 작업을 여기에 append)

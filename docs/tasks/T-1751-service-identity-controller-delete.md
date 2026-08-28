---
id: T-1751
title: Add the DELETE route to ServiceIdentityController
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-073]
independentStream: service-identity-backend
dependsOn: [T-1750]
touchesFiles:
  - src/user/service-identity.controller.ts
  - src/user/service-identity.controller.spec.ts
  - src/user/user.module.ts
estimatedDiff: 240
estimatedFiles: 3
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (b) 잔여 2 route 중 DELETE 삭제 1 개만 절단 — 300 LOC 상한
---

# T-1751 — ServiceIdentityController 에 DELETE 삭제 route 배선

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (b)` 의 controller 배선 chain (T-1748 GET → T-1749 POST → T-1750 PATCH) 을 잇는 네 번째 slice 다. `§Decision 1` 의 route 표 5 행 중 현재 main 에 GET · POST · PATCH 3 개가 노출돼 있고 남은 것은 **DELETE 삭제**와 **primary 지정** 2 개인데, 직전 slice 실적 (route 1 개 = `+245/-24` · `+243/-17`) 상 2 route 를 한 commit 에 담으면 [CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 확실히 넘긴다. 그래서 본 task 는 **DELETE 1 route 만** 노출한다.

service `delete` (Person 선검사 404 · 소유 아님 404 · `P2025` → 404 · 삭제 대상이 primary 였을 때만 잔여 row 재승격) 는 T-1746 · T-1747 에서 이미 완결돼 있어 본 slice 에 도메인 로직 변경이 0 이고 HTTP 노출만 남았다. primary 지정 route 와도 의존이 없다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 DELETE 행 (204 · body 없음 · Admin+), `§Decision 2` 의 재승격 계약, `§Decision 4` RBAC, `§Decision 5` 오류 변환표 (b · c 행)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 확장 대상. 헤더 주석의 route 목록 · 3 route 배선 패턴 · 순수 위임 관례
- [src/user/service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) — 기존 GET · POST · PATCH describe 구조와 mock service 패턴 (colocated spec — 신규 케이스는 이 파일에 추가한다, 새 spec 파일 신설 금지)
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `255 행` 이후 `delete(personId, identityId)` — 시그니처와 반환 계약 (**삭제된 row 반환**)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `91~94 행` — 기존 DELETE 선례 (`@Delete(":id")` + `@HttpCode(204)` + `Promise<void>` 반환)
- [src/user/user.module.ts](../../src/user/user.module.ts) — 헤더 주석의 endpoint 목록 갱신만 (배열 diff 0 이어야 함)

## Acceptance Criteria

- [ ] `ServiceIdentityController` 에 `@Delete(":identityId")` handler 1 개 추가 — `service.delete(personId, identityId)` 를 **정확히 1 회** 호출하고, `PersonController.remove` 선례대로 `@HttpCode(204)` + `Promise<void>` 반환 (service 가 돌려주는 삭제 row 는 body 로 내보내지 않는다 — ADR `§Decision 1` DELETE 행 "body 없음").
- [ ] guard stack 은 `@UseGuards(JwtAuthGuard, RolesGuard)` 순서 + `@Roles("Admin")` (편집 tier — GET 목록의 `"User"` 와 독립, ADR `§Decision 4`).
- [ ] controller 안 `try`/`catch` 0 — 404 (Person 부재 · 소유 아님 · `P2025`) 는 service 가 이미 `NotFoundException` 으로 만들므로 raw forward. 재승격 단계 오류도 흡수하지 않는다.
- [ ] happy-path unit test 1+ — DELETE handler 가 `service.delete` 를 1 회 호출하고 인자 2 종 (`personId` · `identityId`) 이 그대로 전달되며 handler 가 `undefined` 로 resolve 하는지 검증.
- [ ] error path unit test 1+ — service 가 `NotFoundException` 을 던지는 경우와 일반 `Error` 를 던지는 경우 각각 **동일 인스턴스가 변환 없이 전파**되는지 검증.
- [ ] 분기 test — handler 에 코드 분기가 없으므로 (순수 위임) 그 근거를 주석으로 명시하고, 대신 route metadata 축 (`@Delete` path `":identityId"` · `@HttpCode(204)` 부착 · `@Roles` tier 가 `"Admin"` · guard 순서 `JwtAuthGuard` → `RolesGuard`) 을 각각 1+ 케이스로 대체 검증.
- [ ] negative cases 충분 cover — 빈 `identityId` 도 가공 없이 위임 / service throw 시 다른 collaborator 호출 0 회 (단락) / 삭제 성공 시 응답 body 로 삭제 row 를 노출하지 않음 (반환값 `undefined`) / GET · POST · PATCH 3 route 의 기존 metadata 가 본 변경으로 회귀하지 않음 — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `service-identity.controller.ts` 는 line · branch · function 100% 유지.
- [ ] `user.module.ts` 는 헤더 주석의 endpoint 목록만 4 route 기준으로 갱신 — `controllers` · `providers` · `exports` 배열 diff 0.
- [ ] `service-identity.controller.ts` 헤더 주석의 "현재 3 route 배선 / 나머지 2 route 후속" 서술을 4 route 기준으로 갱신하고, 잔여는 primary 지정 1 개임을 명시.

## Out of Scope

- primary 지정 route (`POST /api/persons/:personId/identities/:identityId/primary`) 배선 — 다음 slice 책임.
- service · repository · DTO 로직 변경 (T-1739 ~ T-1747 에서 이미 완결).
- e2e / smoke spec 추가 — ADR-0058 `§Follow-ups (c)` 의 별도 slice.
- [docs/architecture/api.md](../architecture/api.md) 의 route 표 doc-sync — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- 응답 envelope · pagination · 정렬 query param 도입.
- `service-identity-primary-order.ts` 헤더 주석 stale 정정 등 직전 reviewer MINOR 건.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음)

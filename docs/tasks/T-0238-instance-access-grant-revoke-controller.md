---
id: T-0238
title: UserInstanceAccess grant/revoke controller (@Roles Admin POST 201 / DELETE 204)
phase: P4
status: DONE
commitMode: pr
prNumber: 206
reviewRounds: 1
mergedAs: 620a4f2
completedAt: 2026-06-05T09:24:00+09:00
coversReq: [REQ-016, REQ-044]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-06-05
plannerNote: P4 ADR-0027 grant chain slice 2 — controller @Roles(Admin) endpoint. service(T-0237) 위 HTTP layer. R-112 backbone ×1.5.
---

# T-0238 — UserInstanceAccess grant/revoke controller (@Roles Admin POST 201 / DELETE 204)

## Why

[ADR-0027](../decisions/ADR-0027-instance-access-grant-rbac-contract.md) 가 binding WRITE 의 grant/revoke RBAC 계약을 박제했고, 후속 chain 의 slice 1(T-0237)이 `GrantInstanceAccessDto` + `UserInstanceAccessService.grant/revoke`(self-grant 403 / P2002→409 / P2003→404 / revoke idempotent) 를 머지했다. 그러나 **HTTP-facing controller 가 없어 grant/revoke 가 외부에서 호출 불가** — non-Admin 운영자가 자기 instance 를 부여받을 경로가 여전히 없어 [ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md) 의 "safe but useless"(non-Admin 영구 빈 audit) 가 미해소 상태다. 본 task 는 ADR-0027 후속 chain **row (2)** — `POST`/`DELETE /api/users/{id}/instance-access` controller 를 `@Roles("Admin")` + 기존 service 위에 신설해 REQ-016/REQ-044(권한 분리 + audit 가시화)의 binding 관리 경로를 활성한다.

## Required Reading

- [docs/decisions/ADR-0027-instance-access-grant-rbac-contract.md](../decisions/ADR-0027-instance-access-grant-rbac-contract.md) — Decision §1(endpoint surface) / §3(self-grant 판별 위치) / §4(status·idempotency 계약). 본 controller 의 단일 source.
- [src/user-instance-access/user-instance-access.service.ts](../../src/user-instance-access/user-instance-access.service.ts) — `grant(actorId, targetUserId, instanceRef)` / `revoke(...)` 시그니처. **self-grant 403 + P2002→409 + P2003→404 + revoke idempotency 는 이미 service 가 처리** — controller 는 raw forward 만(중복 판별 신설 금지, ADR-0027 §3 "단일 판별 지점").
- [src/user-instance-access/grant-instance-access.dto.ts](../../src/user-instance-access/grant-instance-access.dto.ts) — grant/revoke 양쪽 `@Body()` 로 재사용할 DTO(`{ instanceRef }`).
- [src/user-instance-access/user-instance-access.module.ts](../../src/user-instance-access/user-instance-access.module.ts) — controller 등록 대상 module(현재 controller 0). guard 사용 위해 `AuthModule` import 필요.
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — controller RBAC stack 1:1 mirror reference(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + controller-scope `ValidationPipe` + `@HttpCode(204)` DELETE + service raw forward).
- [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) — `@CurrentUser("sub")` 로 actor.sub 추출(grant/revoke 의 actorId 인자).
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — `JwtAuthGuard` / `RolesGuard` export 출처(controller module 이 `AuthModule` import 해야 guard 주입 가능, LlmModule 동형).

## Acceptance Criteria

신규 production 파일: `src/user-instance-access/user-instance-access.controller.ts` + colocated spec `src/user-instance-access/user-instance-access.controller.spec.ts`. module 1 줄 수정(controller 등록 + AuthModule import).

- [ ] `UserInstanceAccessController` 신설 — `@Controller("api/users/:id/instance-access")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`(llm-provider-config mirror).
- [ ] `POST` handler(grant) — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `@Param("id")` + `@Body() dto: GrantInstanceAccessDto` + `@CurrentUser("sub")` 로 actor.sub 수신 → `service.grant(actorSub, id, dto.instanceRef)` raw forward. NestJS POST 기본 201 Created(ADR-0027 §4).
- [ ] `DELETE` handler(revoke) — `@HttpCode(204)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `@Param("id")` + `@Body() dto: GrantInstanceAccessDto` + `@CurrentUser("sub")` → `service.revoke(actorSub, id, dto.instanceRef)` raw forward. 204 No Content(ADR-0027 §4).
- [ ] controller 자체 분기 0 — self-grant 403 / P2002→409 / P2003→404 / revoke idempotency 는 전부 service 책임. controller 는 추가 try/catch·판별 신설 금지(ADR-0027 §3 단일 판별 지점, double-guard 회피). spec 본문에 "controller 자체 분기 없음 — service raw forward" 명시.
- [ ] `user-instance-access.module.ts` 수정 — `controllers: [UserInstanceAccessController]` 등록 + `imports: [AuthModule]`(JwtAuthGuard/RolesGuard 주입). 기존 providers/exports 유지.
- [ ] **Happy-path unit test** — (1) Admin actor 의 grant 가 `service.grant(actorSub, id, instanceRef)` 를 정확한 인자로 호출하고 service 반환을 그대로 forward(201 의미). (2) Admin actor 의 revoke 가 `service.revoke(...)` 를 호출하고 void 반환(204 의미).
- [ ] **Error path unit test** — service 가 throw 하는 예외(`ConflictException`/`NotFoundException`/`ForbiddenException`)를 controller 가 추가 변환 없이 raw propagate 함을 검증(각 1+: grant 시 ConflictException(409=중복)·NotFoundException(404=unknown user)·ForbiddenException(403=self-grant), revoke 시 NotFoundException(404=unknown user)·ForbiddenException(403=self-revoke)).
- [ ] **Flow / branch coverage** — controller 핸들러에 분기 없음(service raw forward) → "분기 없음" spec 본문 명시. 단 grant 와 revoke 두 핸들러 각각 happy + error test 분리.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: (a) grant 중복 → service ConflictException propagate(409), (b) grant unknown user → NotFoundException propagate(404), (c) self-grant → ForbiddenException propagate(403), (d) revoke unknown user → NotFoundException propagate(404), (e) self-revoke → ForbiddenException propagate(403), (f) revoke 부재 binding → service 가 정상 resolve(idempotent, controller 가 204 의미로 통과). RBAC 게이트(non-Admin 403 / 미인증 401)는 guard metadata 가 핸들러에 부착됐는지 검증(`@Roles`/`@UseGuards` reflect metadata 단언 — guard 실행 자체는 e2e slice 책임).
- [ ] guard/RBAC metadata 단언 — `Reflect.getMetadata`(또는 NestJS `Reflector`)로 POST/DELETE 핸들러에 `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` 가 부착됐음을 검증(llm-provider-config.controller.spec 의 metadata 단언 패턴 참고).
- [ ] `pnpm lint && pnpm build` 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 controller 파일은 100% 목표).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 결과 확인(R-110).

## Out of Scope

- **api.md doc-sync** — ADR-0027 후속 chain row (3). 별도 task(grant/revoke endpoint 2 row 추가).
- **e2e/smoke spec** — ADR-0027 후속 chain row (4). grant→READ 필터 round-trip e2e(Admin grant → non-Admin 이 그 instance audit 조회 → 보임 / revoke → 안 보임) + guard 실행 401/403 live 검증은 별도 task. 본 task 의 RBAC 검증은 metadata 단언 수준까지만.
- self-grant 판별을 controller 로 이전(service → controller move) — service 의 단일 판별 지점을 유지(ADR-0027 §3 double-guard 회피). controller 는 actor.sub 를 service 에 넘기기만.
- service / DTO / repository 로직 변경 — T-0237 에서 머지 완료. 본 task 는 controller wiring 만.
- `UserInstanceAccess` schema / migration / `JwtPayload` 변경 0(전부 재결정 0, ADR-0024/0027 박제).
- 응답 envelope(`{ data, meta }`) 표준화 / bulk grant / audit log — ADR-0027 §Consequences negative / Alternatives 재검토 대상.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append. ADR-0027 후속 chain row (3) api.md doc-sync / row (4) e2e 는 본 task 머지 후 planner 가 큐잉.)

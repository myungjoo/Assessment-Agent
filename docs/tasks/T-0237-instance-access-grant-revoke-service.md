---
id: T-0237
title: GrantInstanceAccessDto + UserInstanceAccessService grant/revoke 메서드 (ADR-0027 slice 1)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 200
estimatedFiles: 5
created: 2026-06-05
plannerNote: P4 ADR-0027 grant chain slice 1 — DTO+service grant/revoke (repo.create 재사용+P2002→409/P2003→404+revoke 정규화 delete). R-112 backbone×1.5×P2002 1.2
---

# T-0237 — GrantInstanceAccessDto + UserInstanceAccessService grant/revoke 메서드 (ADR-0027 slice 1)

## Why

[ADR-0027](../decisions/ADR-0027-instance-access-grant-rbac-contract.md) 이 `UserInstanceAccess` binding 의 grant/revoke Admin-only RBAC 계약을 박제했고(T-0236 merged), 그 §후속 task chain row (1) 이 본 task 다. 이 slice 는 controller 결선 전 단계로 **DTO + service grant/revoke 메서드 + repository revoke 메서드**를 박제한다 — controller(`@Roles(Admin)` + self-grant 거부)는 본 task 머지 후 별도 slice. ADR-0024 가 만든 "safe but useless"(non-Admin 영구 빈 audit) 상태를 해소하는 WRITE 경로(REQ-016/REQ-044)의 첫 코드 slice다.

## Required Reading

- `docs/decisions/ADR-0027-instance-access-grant-rbac-contract.md` — Decision §2(DTO/validation + repo.create() 재사용 강제) + §4(status·idempotency: grant 409 / revoke 204 / P2003→404) + 후속 task chain row (1)
- `src/user-instance-access/user-instance-access.repository.ts` — 재사용 대상 `create()` + named export `normalizeInstanceRef()`. 본 task 는 여기에 revoke 용 `deleteByUserIdAndInstanceRef` 메서드를 추가
- `src/user-instance-access/user-instance-access.repository.spec.ts` — repository colocated spec (revoke 메서드 test 추가 위치)
- `src/user-instance-access/user-instance-access.module.ts` — 새 service 를 providers/exports 에 등록
- `src/user/user.service.ts` (L77~95, L249~262) — `getPrismaErrorCode` helper + P2002→`ConflictException` 변환 패턴(본 service 가 1:1 mirror). P2003→`NotFoundException` 변환도 동형으로
- `src/user/user.service.spec.ts` — service spec 구조 참고(Prisma error mock 으로 P2002/P2003 분기 test 하는 패턴)

## Acceptance Criteria

신규 파일: `src/user-instance-access/grant-instance-access.dto.ts` + `src/user-instance-access/user-instance-access.service.ts` 와 각 colocated spec(`grant-instance-access.dto.spec.ts` + `user-instance-access.service.spec.ts`). repository + module 은 기존 파일 수정.

- [ ] `GrantInstanceAccessDto` 클래스: `{ instanceRef: string }` + class-validator `@IsString()` + `@IsNotEmpty()` + `@MaxLength(<상한>)`(상한은 record schema 와 정합, ADR-0027 §2). grant/revoke 양쪽이 동일 DTO shape 를 쓰므로 단일 DTO 재사용(또는 명확히 분리하되 사유 주석).
- [ ] `UserInstanceAccessService.grant(actorId, targetUserId, instanceRef)`: `repository.create({ userId: targetUserId, instanceRef })` **재사용**(중복 정규화/insert 로직 신설 금지, ADR-0027 §2). P2002 → `ConflictException`(409), P2003 → `NotFoundException`(404) 변환. 그 외 raw propagate. **self-grant 판별(actor === target)은 본 service 또는 controller 단일 지점 — 본 task 에서 service 에 둘 경우 `actorId === targetUserId` → `ForbiddenException`(403) 박제**(controller slice 와 중복 방지 위해 위치 명시 주석).
- [ ] `UserInstanceAccessService.revoke(actorId, targetUserId, instanceRef)`: `normalizeInstanceRef(instanceRef)` 정규화 후 `repository.deleteByUserIdAndInstanceRef(targetUserId, normalized)` 호출. 부재 binding 은 idempotent no-op(에러 없이 성공 — 204 semantic, ADR-0027 §4). P2003/unknown user 는 `NotFoundException`(404). self-revoke(actor === target) → `ForbiddenException`(403).
- [ ] `UserInstanceAccessRepository.deleteByUserIdAndInstanceRef(userId, instanceRef)`: `@@unique([userId, instanceRef])` row delete. Prisma `deleteMany`(부재 시 count 0, idempotent) 또는 `delete`+P2025 catch 중 idempotent 보장 방식 택1(주석으로 사유). PrismaService reject 는 raw propagate.
- [ ] `UserInstanceAccessModule` 에 `UserInstanceAccessService` providers 등록(controller slice 가 inject 가능하도록 필요 시 exports).
- [ ] **Happy-path unit test**: grant 성공(repo.create 호출 인자 정합) + revoke 성공(정규화 후 deleteByUserIdAndInstanceRef 호출) + DTO valid 입력 통과 + repository.deleteByUserIdAndInstanceRef happy-path 각 1+.
- [ ] **Error path unit test**: grant 시 repo P2002 reject → `ConflictException`(409) / P2003 reject → `NotFoundException`(404) / generic Error → raw propagate. revoke 시 P2003 → `NotFoundException`.
- [ ] **Flow / branch coverage**: getPrismaErrorCode 의 P2002 분기 / P2003 분기 / 그 외(undefined code) 분기 각 1+. self-grant 분기 true/false 각 1+.
- [ ] **Negative cases 충분 cover**: self-grant(actor === target) → 403 / self-revoke → 403 / DTO 빈 instanceRef → validation 실패 / 공백-only instanceRef → 실패 / `@MaxLength` 초과 → 실패 / revoke 부재 binding → idempotent no-op(에러 없음) / instanceRef 정규화 후 빈 문자열(repo.create Error) → 호출자 propagate — **각 1+**.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 현 floor 는 ADR-0026 ratchet 으로 더 높을 수 있음 — 실측 100% 유지).
- [ ] tester 가 unit + smoke + e2e 가 CI 에서 green 임을 확인(R-110/R-113).

## Out of Scope

- **controller** (`POST`/`DELETE /api/users/{id}/instance-access` + `@Roles(Admin)` + `@UseGuards` + `@CurrentUser` self-grant 게이트 + 201/204 status) — ADR-0027 후속 chain row (2), 별도 task. 단 self-grant 판별을 본 service 에 둘 경우 그 위치를 controller slice 와 중복 안 되게 주석으로 명시.
- **api.md doc-sync** — row (3), 별도 direct task.
- **e2e grant→READ 필터 round-trip** — row (4), 별도 task(본 task 의 e2e 는 기존 suite green 확인까지).
- schema / migration 변경 — ADR-0024 entity 재사용, 변경 0.
- `normalizeInstanceRef` 로직 수정 — 재사용만, 신규 정규화 규칙 0.
- audit log(누가 누구에게 grant/revoke 했는가 기록) — ADR-0027 §Consequences negative 5 의 후속 ADR 사안.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

---
id: ADR-0027
title: UserInstanceAccess grant/revoke Admin-only RBAC 계약 — binding WRITE endpoint 의 누가-무엇을-쓰는가 / grant·revoke endpoint surface / @Roles(Admin) + self-grant 금지 / instanceRef DTO·validation / 201·204·400·403·404·409 status 계약 + idempotency 결정 / repo.create()·normalizeInstanceRef() 재사용 경계 / ADR-0023·0024 와의 READ↔WRITE 책임 경계
status: ACCEPTED (2026-06-05)
date: 2026-06-05
relatedTask: T-0236
supersedes: null
---

# ADR-0027 — UserInstanceAccess grant/revoke Admin-only RBAC 계약 박제

> [ADR-0024](ADR-0024-user-instance-binding-data-model.md)(T-0220) 가 `UserInstanceAccess` join table(User↔instance binding) 데이터 모델 + own-instance **READ 필터** 계약을 박제했고, 후속 slice(T-0221~T-0225)가 prisma schema + migration / `UserInstanceAccessRepository`(`create()` + `findInstanceRefsByUserId()` + `normalizeInstanceRef()`) / module DI / audit 조회 own-instance 필터 결선을 모두 머지했다. 그러나 ADR-0024 §5 가 **"누가 User 에 instance 를 부여하는가"(binding WRITE 경로)를 명시 deferred** 했다 — binding 부여 경로가 없어 모든 `User` 는 binding 0(빈 allowlist) 으로 남고, non-Admin 은 own-instance 필터가 결선됐어도 **항상 빈 결과** 만 받는다(ADR-0024 가 "safe but useless" 로 자체 기록). 본 ADR 은 그 deferred WRITE 경로를 **grant/revoke Admin-only RBAC 계약** 으로 박제한다. [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)/[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)/[ADR-0024](ADR-0024-user-instance-binding-data-model.md) 의 ADR-first 패턴(계약을 controller 코드보다 먼저 박제 → reviewer 선행 점검 → 후속 slice 가 단일 source mirror)을 mirror 한다. 본 ADR 은 grant/revoke RBAC·endpoint surface·DTO·status·idempotency **결정** 만 기술하며 production code 0 LOC — DTO / service grant·revoke 메서드 / controller `@Roles(Admin)` / e2e·smoke test 는 후속 slice 가 본 ADR 을 단일 source 로 mirror 한다.

## Context

[ADR-0024](ADR-0024-user-instance-binding-data-model.md) 가 `UserInstanceAccess` join table(`{ id / userId / instanceRef / createdAt }` + `@@unique([userId, instanceRef])` + `onDelete: Cascade`) 데이터 모델과 non-Admin audit 조회의 own-instance **READ 필터**(`actor.sub` → allowlist server-side lookup → `instanceRef in (allowlist)`)를 박제했고, 후속 slice 가 다음을 머지했다:

- [prisma/schema.prisma](../../prisma/schema.prisma) `UserInstanceAccess` model + migration(binding 0 시작, breaking change 0)
- [src/user-instance-access/user-instance-access.repository.ts](../../src/user-instance-access/user-instance-access.repository.ts) — `UserInstanceAccessRepository.create(input)`(insert 전 `normalizeInstanceRef()` 적용 + 정규화 후 빈 문자열이면 Error throw) + `findInstanceRefsByUserId(userId): string[]`(allowlist lookup) + `normalizeInstanceRef(raw): string` named export(host lowercase / trailing slash 제거 / scheme·path 보존, ADR-0024 §4)
- [src/user-instance-access/user-instance-access.module.ts](../../src/user-instance-access/user-instance-access.module.ts) — `UserInstanceAccessRepository` providers + exports 등록(controller 0 — binding HTTP endpoint 는 별도 task 로 명시)
- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) non-Admin 분기의 own-instance 필터 결선(allowlist lookup → set membership 필터)

그러나 **binding row 를 채우는 WRITE 경로가 없다** — [ADR-0024 §5](ADR-0024-user-instance-binding-data-model.md)("binding seed 책임 경계")가 "누가 User 에 instance 를 부여하는가" 를 명시 범위 밖으로 두고 후보 3 종(① Admin endpoint `POST /api/users/{id}/instance-access` / ② seed script / ③ env 자동 부여)만 나열한 채 별도 task 로 deferred 했다. 그 결과:

- 모든 기존 `User` row 는 binding 0(빈 allowlist)으로 시작([ADR-0024 §5](ADR-0024-user-instance-binding-data-model.md) breaking-change 0 migration). non-Admin 은 own-instance 필터가 결선됐어도 allowlist 공집합 → **200 빈 배열** 만 받는다([ADR-0024 §4](ADR-0024-user-instance-binding-data-model.md) fallback).
- ADR-0024 가 이 상태를 자체 기록 — "own-instance 필터 slice 와 binding 부여 경로 slice 는 **함께 운영 가치가 발생**(둘 중 하나만으로는 non-Admin 실 조회 미완)"(§5). 즉 현 상태는 **safe but useless** — 격리는 안전하나 non-Admin 이 영구히 빈 결과라 audit 가시화(REQ-044)가 non-Admin 측에서 무용.

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0023]` 에서 **binding-grant path 를 승인** 했다 — runtime dynamic grant/revoke 를 `@Roles(Admin)` Admin-only endpoint 로 제공하고 self-grant 는 금지([ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)→controller 패턴과 동형으로 ADR-first). 그 decision 의 제약:

1. **endpoint** — grant `POST /api/users/{id}/instance-access` + revoke(`DELETE`) 둘 다 `@Roles(Admin)` 제한, runtime dynamic grant/revoke.
2. **self-grant 금지** — 요청자(actor) 가 자기 자신(`{id}` == `actor.sub`)에게 부여/회수하는 것을 거부(privilege 자가 확장 차단).
3. **ADR-first** — DTO/service/controller/e2e 의 실 구현 전에 grant/revoke RBAC 계약을 ADR-0027 로 선행 박제(ADR-0023→controller 패턴 mirror).
4. **새 외부 dependency 0 / 외부 credential 0** — 기존 NestJS controller + auth stack(`JwtAuthGuard` / `RolesGuard` / `@Roles` / `@CurrentUser`) + 기존 `UserInstanceAccessRepository.create()` / `normalizeInstanceRef()` 재사용([CLAUDE.md §5](../../CLAUDE.md) security(auth) 게이트는 본 RBAC 결정으로 충족, DB schema 변경 0 — `UserInstanceAccess` entity 는 ADR-0024 에서 이미 박제).
5. **negative/boundary cover** — 타 instance / non-Admin 차단 / 중복 binding / 미인증 / 잘못된 instanceRef 를 계약에 박제(후속 slice 의 R-112 negative cases source).

따라서 Q-0023 위임대로 **DTO/service/controller/e2e 코드보다 먼저 ADR 로 grant/revoke RBAC 계약을 박제** 한다([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)/[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)/[ADR-0024](ADR-0024-user-instance-binding-data-model.md) ADR-first 패턴 mirror) — reviewer 가 구현 전 RBAC·self-grant·status·idempotency 계약을 점검하고 후속 slice 가 단일 source 를 mirror 하도록. 본 task 는 ADR doc(+ modules.md doc-sync) 만 — production code 0.

### REQ 외력

- **REQ-016** ([README.md](../../README.md) L33) — 권한 부족의 user/admin audience 분리. 본 ADR 의 grant/revoke 가 그 audience 의 binding 관리 기반(누가 어느 instance 의 audit 를 보는가)을 Admin 이 runtime 에 관리하도록 한다 — [ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)/[ADR-0024](ADR-0024-user-instance-binding-data-model.md) 가 READ audience 를 박제했고 본 ADR 이 그 audience 를 채우는 WRITE 경로를 박제한다.
- **REQ-044** ([README.md](../../README.md) L19~22, L33) — instance / SPACE 별 권한 분리 + 권한 거부 가시화. 본 ADR 의 grant 가 non-Admin 운영자에게 자기 instance 를 부여해 ADR-0024 의 "safe but useless"(non-Admin 영구 빈 결과) 를 실 가시화로 전환한다 — binding 0 시작이 안전 기본값이고, 본 grant 경로가 운영 가치를 활성한다.

### 기존 RBAC stack / repository (본 ADR 이 따를 source)

- **controller RBAC 패턴** — [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + service raw forward + NestJS 자동 4xx 매핑의 write controller 골격을 박제했다([ADR-0023 §5](ADR-0023-permission-denied-audit-query-rbac-contract.md) 가 READ 측에서 mirror). 후속 controller slice 가 이 패턴을 mirror 한다.
- **`@CurrentUser()`** — [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) 가 `req.user`(`JwtPayload` = `sub`+`role`)를 controller param 으로 추출한다. 본 ADR 의 self-grant 판별(`actor.sub` vs path `{id}`)이 이를 재사용한다.
- **`RolesGuard` / `ROLE_HIERARCHY`** — [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) 가 `ROLE_HIERARCHY`(SuperAdmin ⊇ Admin ⊇ User) escalation + 401/403 throw 를 제공한다. `@Roles("Admin")` 은 Admin/SuperAdmin escalation 만 통과(non-Admin 403). 본 ADR 의 Admin-only 게이트가 이를 재사용한다.
- **`UserInstanceAccessRepository`** — [src/user-instance-access/user-instance-access.repository.ts](../../src/user-instance-access/user-instance-access.repository.ts) `create(input)`(정규화 + insert, 정규화 후 빈 문자열 Error) + `findInstanceRefsByUserId(userId)`(allowlist lookup) + `normalizeInstanceRef(raw)` named export. **본 ADR 은 grant/revoke 가 이 repository 의 `create()` + `normalizeInstanceRef()` 를 재사용함을 박제** — 중복 정규화/insert 로직 신설 금지(Decision §2).

### ADR cross-reference

- **다음 free 번호 ADR-0027** — `docs/decisions/` 에 ADR-0001 ~ ADR-0026 점유(ADR-0007 만 미신설 — 번호 gap). 본 ADR 은 다음 free 번호 ADR-0027 을 사용.
- **[ADR-0024](ADR-0024-user-instance-binding-data-model.md)** — 본 ADR 의 직속 선행. binding 데이터 모델(`UserInstanceAccess` join, exact-match, host case·trailing-slash 정규화) + own-instance **READ 필터** 는 **재결정 0**. 본 ADR 은 그 §5 가 deferred 한 binding **WRITE 경로**(grant/revoke)만 추가 박제한다. 데이터 모델 변경 0 / migration 0.
- **[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)** — audit 조회(READ) RBAC/audience 계약 source. 본 ADR 은 그 READ 계약을 재결정하지 않고 **WRITE 측 책임 경계**(본 ADR=binding WRITE, ADR-0023/0024=binding READ 필터)를 명시 박제한다(Decision §4).
- **[ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)** — ADR-first TEMPLATE(Decision enumerated section / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 task chain 구조 mirror).
- **[ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md)** — strict equal(subdomain 불허) + 정보 노출 최소화 invariant. 본 ADR 의 grant 입력 instanceRef 정규화/검증이 `normalizeInstanceRef()`(ADR-0024 §4 = ADR-0019 정합)를 재사용한다(Decision §2).
- **[ADR-0008](ADR-0008-auth-credential-type.md)** — `JwtPayload`(`sub`+`role`) claim 계약. 본 ADR 의 self-grant 판별이 `actor.sub` 를 쓰며 **JwtPayload 를 확장하지 않는다**.

## Decision

본 ADR 은 다음 5 결정을 박제한다. **본 ADR 은 grant/revoke RBAC·endpoint surface·DTO·status·idempotency 계약을 기술하되 DTO 클래스 / service grant·revoke 메서드 / controller `@Roles(Admin)` / e2e·smoke test 코드는 신설/변경하지 않는다(production code 0 LOC — 후속 slice 책임). `UserInstanceAccess` schema / migration / `JwtPayload` 도 본 ADR 범위 밖(모두 재결정 0).**

### Decision §1 — endpoint surface (grant / revoke)

binding WRITE 의 두 endpoint 를 박제한다([llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) write controller RBAC stack mirror):

| 동작 | method + path | RBAC | 의미 |
| --- | --- | --- | --- |
| **grant** | `POST /api/users/{id}/instance-access` | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` | path `{id}` 사용자에게 request body 의 `instanceRef` binding 1 개를 runtime 부여 |
| **revoke** | `DELETE /api/users/{id}/instance-access` + `instanceRef` 본문 | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` | path `{id}` 사용자의 `instanceRef` binding 1 개를 runtime 회수 |

- **path shape 결정 — collection sub-resource `/api/users/{id}/instance-access` (채택)** — binding 을 user 의 sub-resource 로 표현한다(`{id}` = 대상 user). grant 는 그 collection 에 `POST`, revoke 는 회수 대상 `instanceRef` 를 본문으로 받는 `DELETE`. 사유:
  1. **REST 정합** — binding 은 user 에 종속된 collection(한 user 가 여러 instance 부여)이라 `users/{id}/instance-access` sub-resource 가 자연. [UserController](../../docs/architecture/modules.md) 의 `PATCH /api/users/:id/role`(user sub-mutation) 컨벤션 정합.
  2. **`{id}` 가 self-grant 판별 축** — path 의 `{id}`(대상 user)와 `actor.sub`(요청자)를 controller 가 비교해 self-grant 거부(Decision §3). path 에 대상 user 가 명시되어야 self ≠ target 판별이 명료.
- **revoke 의 `instanceRef` 전달 — `DELETE` + body (채택, 사유 명시)** — revoke 대상 `instanceRef` 는 GitHub host / Confluence 풀 base URL 의 free-form 문자열(슬래시·콜론 포함)이라 path segment 로 두면 URL 인코딩이 번거롭다. 따라서 `DELETE /api/users/{id}/instance-access` 본문에 `{ instanceRef }` 를 싣는다(HTTP `DELETE` body 는 RFC 9110 상 허용 — NestJS `@Body()` 지원). 대안(path segment `DELETE .../instance-access/{encodedInstanceRef}`)은 free-form URL 의 이중 인코딩 취약성으로 기각(Alternatives (c)).
- **runtime dynamic** — grant/revoke 는 runtime API 라 재시작/재배포 없이 binding 을 변경한다(seed script / env 자동 부여 대안 대비 운영 유연, Alternatives (d)).

### Decision §2 — Request DTO + validation (instanceRef shape, class-validator)

grant 의 request body DTO + 검증 규칙을 박제한다([llm-provider-config](../../src/llm/llm-provider-config.controller.ts) DTO + class-validator 패턴 mirror):

- **DTO shape** — grant body = `{ instanceRef: string }`(단일 binding 부여). revoke body = `{ instanceRef: string }`(회수 대상). 후속 slice 가 `GrantInstanceAccessDto` 클래스로 박제(본 ADR 은 shape 만, 클래스 신설은 slice).
- **`instanceRef` 의미 (재결정 0)** — `instanceRef` 는 [ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md)/[ADR-0024 §1](ADR-0024-user-instance-binding-data-model.md) 정의 그대로 — GitHub 의 configured host(예: `github.sec.samsung.net`) 또는 Confluence 의 풀 REST base URL(예: `https://acme.atlassian.net/wiki/rest/api`). 신규 식별자 개념 도입 0.
- **class-validator 규칙** — `instanceRef`: `@IsString()` + `@IsNotEmpty()`(빈/공백 거부) + `@MaxLength(<상한>)`(과대 입력 방어, 상한은 slice 가 record schema 와 정합 확정). 추가 형식 검증(host/URL well-formedness)은 **`normalizeInstanceRef()` 의 정규화 결과로 위임** — 정규화 후 빈 문자열이면 무효(아래).
- **정규화/insert 로직 재사용 (강제 — 신설 금지)** — grant 의 binding 부여는 **[`UserInstanceAccessRepository.create()`](../../src/user-instance-access/user-instance-access.repository.ts) 를 그대로 재사용** 한다. 그 `create()` 는 이미 (i) 입력 `instanceRef` 에 `normalizeInstanceRef()`([ADR-0024 §4](ADR-0024-user-instance-binding-data-model.md) host lowercase / trailing slash 제거 / scheme·path 보존) 적용, (ii) 정규화 후 빈 문자열이면 Error throw(§4(iv) 유효 binding 아님), (iii) `@@unique([userId, instanceRef])` 정규화값 기준 중복 차단을 수행한다. **service 의 grant 메서드는 중복 정규화/insert 로직을 신설하지 않고** `repository.create({ userId: id, instanceRef })` 만 호출한다(DTO validation → service → `repository.create()` 위임 체인). 사유: 정규화 규칙(ADR-0024 §4)을 단일 source(`normalizeInstanceRef()`)로 유지해 grant 측과 READ 필터 측의 정규화 divergence 0.
- **revoke 의 정규화** — revoke 도 회수 전 `normalizeInstanceRef(input.instanceRef)` 로 정규화한 값으로 `@@unique([userId, instanceRef])` row 를 찾아 delete 해야 한다(grant 가 정규화값으로 저장하므로 회수도 정규화값 기준 — round-trip 일관, ADR-0024 §4(v)). 후속 slice 는 `normalizeInstanceRef()` named export 를 재사용(repository 에 `deleteByUserIdAndInstanceRef` 류 메서드 추가는 slice 책임 — 본 ADR 은 정규화 재사용 계약만 박제).

### Decision §3 — self-grant 금지 (privilege 자가 확장 차단)

- **self-grant/self-revoke 거부 (명시 채택)** — 요청자(`actor.sub`)와 path 의 대상 user(`{id}`)가 **동일하면** grant·revoke 둘 다 거부한다(`actor.sub === id` → 403, Decision §4). 사유:
  1. **privilege 자가 확장 차단** — Admin 이 자기 자신에게 instance 를 부여하면 자기가 보는 audit 범위를 스스로 넓히는 자가 권한 상승이 된다. self-grant 금지는 "권한 부여는 타인에게만(separation of duties)" 원칙을 강제 — Admin 도 자기 binding 은 다른 Admin 이 부여해야 한다.
  2. **Admin 은 이미 bypass — self-grant 무의미** — [ADR-0023 §1](ADR-0023-permission-denied-audit-query-rbac-contract.md)/[ADR-0024 §3](ADR-0024-user-instance-binding-data-model.md) 상 Admin/SuperAdmin 은 own-instance 필터를 **bypass** 해 전체 audit 를 본다. 따라서 Admin 이 자기에게 binding 을 부여해도 조회 결과가 바뀌지 않는다(이미 전체 조회) — self-grant 는 기능상 no-op 인데 audit 흔적만 남기는 무의미 동작. 거부가 일관.
  3. **non-Admin 은 endpoint 도달 불가** — `@Roles("Admin")` 게이트로 non-Admin actor 는 403(Decision §4) — non-Admin 이 자기에게 self-grant 하려는 시나리오는 RBAC 게이트에서 이미 차단된다. self-grant 금지는 **Admin actor 가 자기에게** 부여하려는 경로를 추가 차단하는 layer.
- **판별 위치 — controller (명시)** — self-grant 판별은 controller 가 `@CurrentUser("sub")`(actor.sub) vs `@Param("id")`(대상) 비교로 수행([current-user.decorator.ts](../../src/auth/current-user.decorator.ts) 재사용). RBAC role 게이트(`RolesGuard`)는 role tier 만 보므로 self ≠ target 의 row-level 판별은 controller/service 책임(신규 guard 미신설 — 새 외부 dependency 0). 후속 slice 가 controller 진입 직후 또는 service 진입 직후 1 곳에서 강제(단일 판별 지점).

### Decision §4 — status-code 계약 (idempotency 결정 포함)

grant/revoke 의 HTTP status 경계를 박제한다([llm-provider-config](../../src/llm/llm-provider-config.controller.ts) NestJS 자동 매핑 + 명시 status 정합):

| 상황 | status | 적용 동작 | 사유 |
| --- | --- | --- | --- |
| **grant 성공** | **201 Created** | grant | binding row 1 개 생성 — collection 에 resource 추가의 REST 정합. |
| **revoke 성공** | **204 No Content** | revoke | binding row 삭제 — 응답 본문 불요(택1 박제, 200+body 대비 204 채택, 아래). |
| **미인증 (JWT 부재/무효)** | **401** | grant·revoke | [`JwtAuthGuard`](../../src/auth/jwt-auth.guard.ts) 차단 — RBAC·self-grant 판별 도달 전. |
| **non-Admin actor** | **403** | grant·revoke | [`RolesGuard`](../../src/auth/roles.guard.ts) `@Roles("Admin")` 게이트 — non-Admin escalation 미충족(자기 자신/타 instance 무관 우선 차단). |
| **self-grant/self-revoke (`actor.sub === {id}`)** | **403** | grant·revoke | Decision §3 — privilege 자가 확장 차단. role 게이트 통과 후 self ≠ target 판별에서 거부. |
| **invalid instanceRef (정규화 후 빈 문자열 / DTO validation 실패)** | **400 Bad Request** | grant·revoke | DTO `@IsNotEmpty()` 실패 또는 `normalizeInstanceRef()` 후 빈 문자열([repository.create()](../../src/user-instance-access/user-instance-access.repository.ts) Error, ADR-0024 §4(iv)) → service 가 400 으로 매핑. |
| **unknown user (`{id}` 부재)** | **404 Not Found** | grant·revoke | 존재하지 않는 user 에 부여/회수 — FK(`userId @relation`) 위반은 Prisma P2003 → service 가 404 매핑(또는 부여 전 user 존재 lookup → 404). |
| **duplicate-binding (이미 존재하는 (user, instanceRef))** | **§4 idempotency 결정 참조** | grant | `@@unique([userId, instanceRef])` 위반(P2002) — 아래 idempotency 결정. |
| **revoke 대상 binding 부재** | **§4 idempotency 결정 참조** | revoke | 회수할 row 가 없음 — 아래 idempotency 결정. |

**revoke 성공 = 204 vs 200 결정 → 204 채택 (택1 박제)** — revoke 는 응답 본문에 돌려줄 의미 있는 resource 가 없다(삭제된 binding 의 echo 불요). 204 No Content 가 "삭제 성공, 본문 없음" 의 REST 정합 — [llm-provider-config DELETE](../../src/llm/llm-provider-config.controller.ts) 동형. 200+body(삭제된 row echo)는 정보 노출 최소화([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md))·단순성 측면에서 기각.

**duplicate-binding = idempotent-vs-409 결정 → grant 는 409, revoke 는 idempotent 204 (명시 채택 + 사유)**:

- **grant 중복 → 409 Conflict (채택)** — 이미 존재하는 (user, instanceRef) 에 다시 grant 하면 `@@unique([userId, instanceRef])` 위반(Prisma P2002) → service 가 **P2002 → 409 Conflict** 로 매핑한다([UserService.signup](../../docs/architecture/modules.md) 의 `P2002 → 409` 컨벤션 정합 — T-0092 박제). 사유: (i) grant 는 "binding 을 생성한다" 는 의도라 이미 있으면 "충돌"(409)이 의미 정확 — 201 을 반환하면 "새로 만들었다" 는 거짓 신호, (ii) 기존 `UserService.signup` 의 P2002→409 컨벤션과 동형이라 매핑 일관, (iii) Admin 에게 "이미 부여됨" 을 명시 신호(409)로 알려 중복 부여 의도를 드러냄.
- **revoke 부재 → idempotent 204 (채택)** — 존재하지 않는 binding 을 revoke 하면 **404 아닌 204**(idempotent delete) 로 처리한다. 사유: (i) DELETE 는 RFC 9110 상 idempotent semantic — "그 binding 이 없는 상태" 가 목표이고 호출 후 그 상태가 보장되면 성공, (ii) "없는 걸 지우려 함" 을 404 로 거부하면 retry/동시성 시 불필요한 에러(이미 다른 호출이 지웠을 수 있음), (iii) revoke 의 부재는 정보 노출(존재 여부)을 피하는 측면([ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) 노출 최소화 정합)에서도 204 가 안전. 단 **unknown user(`{id}` 부재)는 여전히 404** — user 자체가 없는 것과 user 의 binding 이 없는 것을 구분(전자는 path resource 부재, 후자는 idempotent no-op).
- **비대칭의 근거** — grant 는 "생성" semantic 이라 중복이 충돌(409)이고, revoke 는 "삭제" semantic 이라 부재가 idempotent no-op(204). HTTP method semantic(POST 비-idempotent / DELETE idempotent)과 정합. 후속 slice 가 이 비대칭을 R-112 negative case 로 cover(중복 grant 409 / 부재 revoke 204).

### Decision §5 — 책임 경계 (READ vs WRITE) + status

- **본 ADR = binding WRITE 만** — 본 ADR 은 `UserInstanceAccess` 의 **grant/revoke(WRITE)** RBAC 계약만 박제한다. binding 을 읽어 audit 를 필터링하는 **READ 필터**(`actor.sub` → allowlist lookup → `instanceRef in (allowlist)`)는 [ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)(audience 계약) + [ADR-0024](ADR-0024-user-instance-binding-data-model.md)(필터 결선) 소관이며 본 ADR 이 **재결정하지 않는다**. 즉:
  - **WRITE(본 ADR-0027)**: 누가 binding 을 부여/회수하는가 = Admin-only, self-grant 금지, `POST`/`DELETE /api/users/{id}/instance-access`.
  - **READ(ADR-0023/0024)**: 부여된 binding 을 누가 어떻게 읽어 audit 를 필터하는가 = `GET /api/permission-denied-records` 의 own-instance 필터(Admin bypass / non-Admin allowlist).
- **데이터 모델·정규화 = ADR-0024 재사용** — `UserInstanceAccess` join table 구조 / `@@unique([userId, instanceRef])` / `onDelete: Cascade` / instanceRef 정규화(host case / trailing slash)는 [ADR-0024](ADR-0024-user-instance-binding-data-model.md) 박제 그대로. 본 ADR 은 그 위 WRITE endpoint 만 — schema 변경 0 / migration 0 / 정규화 규칙 재결정 0(`normalizeInstanceRef()` 재사용).
- **status (본 ADR)** — architect 가 PROPOSED 로 작성 후 같은 slice 안에서 ACCEPTED flip(ADR-first 자율 승인 패턴 — [CLAUDE.md §5](../../CLAUDE.md) 미발화 dependency-free 결정: 새 외부 dependency 0 / 외부 credential 0 / DB schema 변경 0 — ADR-0024 가 이미 schema 게이트 통과, 본 ADR 은 그 위 endpoint 계약만). front-matter `status: ACCEPTED (2026-06-05)`.

## Consequences

### 양의 (positive)

1. **ADR-first 로 reviewer 선행 점검** — DTO/service/controller 코드 전에 grant/revoke RBAC·self-grant·status·idempotency 를 reviewer 가 점검 → 후속 slice 가 단일 source 를 mirror, 설계 divergence 0([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)~[ADR-0024](ADR-0024-user-instance-binding-data-model.md) ADR-first 패턴 정합).
2. **dependency-free** — Decision §1/§2 가 기존 NestJS controller + auth stack + `UserInstanceAccessRepository.create()` / `normalizeInstanceRef()` 재사용을 박제 → 후속 slice 가 `pnpm add` 0 / 외부 credential 0 / DB schema 변경 0(ADR-0024 entity 재사용)으로 진입([CLAUDE.md §5](../../CLAUDE.md) Q-0023 승인).
3. **"safe but useless" 해소** — Decision §1 grant 가 non-Admin 에게 instance 를 부여해 [ADR-0024](ADR-0024-user-instance-binding-data-model.md) 의 영구 빈 결과(safe but useless)를 실 audit 가시화(REQ-044)로 전환한다 — binding 0 시작 안전 기본값 위에 runtime 부여 경로를 활성.
4. **privilege 자가 확장 차단** — Decision §3 self-grant 금지가 Admin 의 자가 권한 상승(separation of duties 위배)을 차단 → RBAC 무결성.
5. **정규화 단일 source** — Decision §2 가 `normalizeInstanceRef()` 재사용을 강제 → grant 측과 READ 필터 측의 정규화 divergence 0(중복 정규화 로직 신설 금지).
6. **idempotency 명시** — Decision §4 가 grant 409(생성 충돌) / revoke 204(idempotent 삭제) 비대칭을 HTTP method semantic 정합으로 박제 → 후속 slice 의 R-112 negative case(중복 grant / 부재 revoke) source 명확.

### 음의 (negative) / trade-off

1. **self-grant 금지의 운영 마찰** — Decision §3 상 Admin 이 자기 binding 을 부여하려면 다른 Admin 이 해야 한다(self ≠ target). 단일 Admin 환경에서는 자기 binding 부여 경로가 없다. mitigation: Admin 은 bypass 라 자기 binding 무관하게 전체 audit 조회 가능(Decision §3 (2)) — self-grant 금지의 실 마찰은 거의 없음(self-grant 자체가 기능상 no-op).
2. **`DELETE` + body 관례 마찰** — Decision §1 revoke 의 `DELETE` body 가 일부 HTTP client/proxy 에서 body 를 무시할 수 있다(RFC 9110 상 허용이나 관례적 비주류). mitigation: NestJS `@Body()` 가 지원하고 e2e(supertest)가 검증. 문제 시 후속 ADR 로 query param(`?instanceRef=`) 전환 여지(Alternatives (c) 재검토).
3. **404 vs 409 매핑의 Prisma error 의존** — Decision §4 의 P2002→409 / P2003→404 매핑이 Prisma error code 에 의존한다(서비스 layer 의 try/catch 변환). mitigation: [UserService.signup](../../docs/architecture/modules.md) 의 P2002→409 컨벤션이 이미 존재(T-0092) — 동형 재사용이라 신규 패턴 0. 후속 slice 가 R-112 error path 로 cover.
4. **grant 단위 = 단일 binding** — Decision §1/§2 가 grant 를 한 번에 instanceRef 1 개로 박제(bulk 부여 미지원). mitigation: 운영 instance 수가 적어(수십 단위, ADR-0024 §Consequences) 단일 부여 반복으로 충분 — bulk 가 필요해지면 별도 ADR(Alternatives 재검토).
5. **revoke idempotent 의 audit 흔적** — Decision §4 revoke 부재 204(idempotent)가 "없는 걸 지움" 을 성공으로 처리해 잘못된 instanceRef revoke 시도가 silent 성공으로 보인다. mitigation: revoke 도 정규화(Decision §2) 후 처리하므로 오타는 정규화 단계에서 다른 값이 되어 no-op — 그러나 명시 신호는 없음. 필요 시 후속 slice 가 audit log(별도 ADR) 로 grant/revoke 행위를 기록.

### 후속 task chain

본 ADR(doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md)(ADR + 코드 split) 정합. 각 ≤ 300 LOC / 5 파일. **본 task 에서 큐잉하지 않음**(planner 1-task 원칙 — Follow-ups 에 나열만):

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **(1) GrantInstanceAccessDto + service grant/revoke 메서드** | `GrantInstanceAccessDto`(`{ instanceRef }` + class-validator, Decision §2) + service `grant(actorId, targetUserId, instanceRef)` / `revoke(...)` (`repository.create()` 재사용 + P2002→409 / P2003→404 매핑 + revoke `normalizeInstanceRef()` 정규화 후 delete, Decision §2/§4) + repository revoke 메서드(`deleteByUserIdAndInstanceRef`) 추가 + **R-112 4종 + negative cases 충분 cover** | 본 ADR-0027 머지 후 | 없음 — dep 0, schema 변경 0(ADR-0024 entity 재사용) |
| **(2) controller `@Roles(Admin)` + self-grant 거부** | `POST`/`DELETE /api/users/{id}/instance-access` controller(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@CurrentUser("sub")` vs `@Param("id")` self-grant 거부, Decision §1/§3) + 201 grant / 204 revoke status + **R-112 4종 + negative**: non-Admin 403 / self-grant 403 / 미인증 401 / invalid instanceRef 400 / unknown user 404 / 중복 grant 409 / 부재 revoke 204 **각 1+** | (1) 머지 후 | 없음 |
| **(3) api.md doc-sync** | [docs/architecture/api.md](../architecture/api.md) 에 grant/revoke endpoint 2 row 추가(method/path/RBAC/status, 있으면) | (2) 머지 후 | 없음 |
| **(4) e2e/smoke spec** | grant→READ 필터 round-trip e2e(Admin grant → non-Admin 이 그 instance audit 조회 → 보임 / revoke → 안 보임) + 미인증/403/409 negative e2e | (2) 머지 후 | 없음 |

> **R-112 4종 + negative-case test 는 본 ADR(코드 symbol 0)에 적용 대상이 아니다** — 위 (1)/(2) slice 로 **명시 deferred**. 본 ADR-0027 task 는 grant/revoke RBAC·status·idempotency 계약 결정 + modules.md doc-sync 만(production code 0 / spec 0).

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) Admin-only `POST`/`DELETE /api/users/{id}/instance-access` + self-grant 금지 + `repository.create()`/`normalizeInstanceRef()` 재사용 + grant 409 / revoke idempotent 204 + READ↔WRITE 책임 경계 박제** (채택) | REQ-016/044 binding 관리 기반 / "safe but useless" 해소 / dependency-free(auth stack + repo 재사용) / privilege 자가 확장 차단 / 정규화 단일 source / idempotency HTTP semantic 정합 / ADR-first reviewer 선행 점검 | self-grant 금지 운영 마찰(단일 Admin) / `DELETE`+body 관례 마찰 / Prisma error 매핑 의존 / 단일 binding 단위 | **✓ 채택** (Q-0023 grant-path 승인 + ADR-0023→controller 패턴 + ADR-0024 entity/정규화 직접 정합) |
| **(b) self-grant 허용 (Admin 이 자기에게도 부여 가능)** | 단일 Admin 환경 자기 binding 부여 가능 / 판별 로직 불요 | privilege 자가 권한 상승(separation of duties 위배) / Admin 은 이미 bypass 라 self-grant 기능상 no-op(audit 흔적만) / Q-0023 self-grant 금지 정면 위배 | 기각 — Q-0023 self-grant 금지 + RBAC 무결성(Decision §3) |
| **(c) revoke 대상 instanceRef 를 path segment (`DELETE .../instance-access/{encodedInstanceRef}`)** | URL 만으로 회수 대상 명시(body 불요) / `DELETE` body 관례 마찰 회피 | free-form URL(슬래시·콜론) 이중 인코딩 취약성 / `https://...` instanceRef 의 path segment 인코딩 복잡 / 오인코딩 시 잘못된 binding 회수 risk | 기각 — body 전달이 free-form instanceRef 안전(Decision §1) |
| **(d) seed script / env 자동 부여 (runtime endpoint 없이 binding 채움)** | endpoint 신설 0 / 부팅 시 일괄 부여 | runtime 변경 불가(재배포/재시작 요구) / Admin 이 운영 중 동적 부여/회수 불가 / Q-0023 runtime dynamic grant/revoke 승인 정면 위배 | 기각 — Q-0023 runtime dynamic 명시(Decision §1) |
| **(e) grant 중복 → idempotent 200 (409 대신)** | 재시도 안전(이미 있으면 그냥 성공) | "생성" semantic 인 POST 가 중복을 숨김 → Admin 이 "이미 부여됨" 을 모름 / `UserService.signup` P2002→409 컨벤션 이탈(매핑 비일관) | 기각 — grant 는 생성 충돌(409)이 의미 정확 + 기존 컨벤션 정합(Decision §4) |
| **(f) revoke 부재 → 404 (idempotent 204 대신)** | "없는 걸 지움" 을 명시 거부 | DELETE idempotent semantic(RFC 9110) 위배 / 동시성·retry 시 불필요 에러(이미 지워졌을 수 있음) / 존재 여부 노출([ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) 최소화 위배) | 기각 — DELETE idempotent + 노출 최소화(Decision §4), 단 unknown user 는 여전히 404 |
| **(g) 신규 InstanceAccessGuard 신설 (self-grant 판별을 guard 로)** | 판별 로직 guard 캡슐화 | guard 는 요청 차단 yes/no(role tier)용이라 self ≠ target 의 actor↔param 비교는 guard 책임 모델과 다름 / 신규 guard = 추가 표면 / [ADR-0023 §3](ADR-0023-permission-denied-audit-query-rbac-contract.md) "신규 guard 미신설" 정합 이탈 | 기각 — controller/service 1 곳 판별이 단일 지점 + guard 신설 0(Decision §3) |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) bulk 부여/회수가 빈번해지면 batch endpoint ADR(Alternatives 단일 binding 단위 (d)). (ii) `DELETE` body 가 실 client/proxy 에서 문제되면 query param(`?instanceRef=`) 전환 ADR((c) 재검토). (iii) grant/revoke 행위 자체의 audit(누가 누구에게 부여했는가) 가 필요해지면 audit log ADR(§Consequences negative 5). (iv) self-grant 금지가 단일 Admin 운영을 막으면(실측) bootstrap seed 예외 ADR((b) 부분 재검토).

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0023]` — binding-grant path 승인(`POST`/`DELETE /api/users/{id}/instance-access` Admin-only / runtime dynamic / self-grant 금지 / ADR-first / 새 외부 dependency 0 / 외부 credential 0) — 본 ADR 의 직접 motivation
- [docs/decisions/ADR-0024-user-instance-binding-data-model.md](ADR-0024-user-instance-binding-data-model.md) — 직속 선행. `UserInstanceAccess` 데이터 모델 + own-instance READ 필터 + instanceRef 정규화(§4) + §5 binding seed 책임 deferred(본 ADR 이 채움) — 데이터 모델/정규화/READ 필터 재결정 0
- [docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md](ADR-0023-permission-denied-audit-query-rbac-contract.md) — audit 조회(READ) RBAC/audience 계약 — READ↔WRITE 책임 경계 source(Decision §5), controller RBAC 패턴 mirror
- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](ADR-0022-permission-denied-record-data-model.md) — `instanceRef`(GitHub host / Confluence 풀 base URL free-form) 정의 source(재결정 0)
- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](ADR-0021-github-confluence-live-integration-test-contract.md) — ADR-first TEMPLATE(Decision enumerated / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 task chain 구조 mirror)
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](ADR-0019-same-host-auth-restriction-for-pagination.md) — strict equal + 정보 노출 최소화(Decision §2 정규화 재사용 / §4 204·idempotency 노출 최소화 정합)
- [docs/decisions/ADR-0008-auth-credential-type.md](ADR-0008-auth-credential-type.md) — JWT / JwtPayload(`sub`+`role`) claim 계약(Decision §3 self-grant `actor.sub` 판별, JwtPayload 비확장)
- [src/user-instance-access/user-instance-access.repository.ts](../../src/user-instance-access/user-instance-access.repository.ts) — `UserInstanceAccessRepository.create()` + `normalizeInstanceRef()` 재사용 대상(Decision §2 — 중복 정규화/insert 신설 금지)
- [src/user-instance-access/user-instance-access.module.ts](../../src/user-instance-access/user-instance-access.module.ts) — repository providers/exports 등록 현황(controller 0 — 본 ADR 의 grant/revoke controller 는 후속 slice)
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — write controller RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) mirror 대상(Decision §1)
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) / [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) — `RolesGuard`(401/403 throw) + `@CurrentUser()`(self-grant `actor.sub` 추출, Decision §3)
- [docs/architecture/modules.md](../architecture/modules.md) — PermissionDeniedRecordModule row(binding 관련 서술 doc-sync 대상)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다"(ADR-first split 정당화) / [§3.1 rule 4](../../CLAUDE.md) 새 ADR = pr-mode / [§5](../../CLAUDE.md) security(auth) 게이트(Q-0023 충족, DB schema 변경 0) / [§9](../../CLAUDE.md) secret 미기재

Refs: T-0236, Q-0023, ADR-0008, ADR-0019, ADR-0021, ADR-0022, ADR-0023, ADR-0024, REQ-016, REQ-044

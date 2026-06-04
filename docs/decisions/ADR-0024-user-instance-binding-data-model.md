---
id: ADR-0024
title: User↔instance binding 데이터 모델 + own-instance 필터 계약 — non-Admin audit 조회의 사용자↔허용 instance 영속 모델 (UserInstanceAccess join table) / identity → allowlist → instanceRef WHERE 변환 / Admin bypass / 401·빈결과·경계 정규화 / migration 접근
status: ACCEPTED (2026-06-04)
date: 2026-06-04
relatedTask: T-0220
supersedes: null
---

# ADR-0024 — User↔instance binding 데이터 모델 + own-instance 필터 계약 박제

> [ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)(T-0213) 가 audit 조회 audience 계약을 박제하면서 **non-Admin 의 own-instance 필터를 "User↔instance binding schema 부재" 이유로 deferred** 했다(ADR-0023 §2(b) — 현재 `PermissionDeniedRecordService.list` 의 non-Admin 분기는 **항상 빈 배열** 을 반환하는 deliberate placeholder). 본 ADR 은 그 deferred row 를 **구체 데이터 모델(User↔instance binding) + 매핑 규칙(identity → allowlist → WHERE) + migration 접근** 으로 박제한다. [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)/[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) 의 ADR-first 패턴(계약을 코드보다 먼저 박제 → reviewer 선행 점검 → 후속 slice 가 단일 source mirror)을 mirror 한다. 본 ADR 은 binding 모델 + 필터 계약 **결정** 만 기술하며 production code 0 LOC / prisma schema 변경 0 / migration 0 — prisma schema + migration / binding repository / service 필터 결선 / R-112 test 는 후속 slice 가 본 ADR 을 단일 source 로 mirror 한다.

## Context

[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) 가 `GET /api/permission-denied-records` 의 audience 계약을 박제했고(Admin·SuperAdmin 전체 bypass / non-Admin authenticated 자기 instance 범위 / 미인증 401 / binding 부재 시 빈 결과), 후속 controller slice(T-0214~T-0216)가 endpoint + service-layer actor-aware 분기를 머지했다. 그러나 그 분기의 **non-Admin 절반은 아직 placeholder** 다:

- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) L133~144 `list(actor, query?)` 는 (i) Admin escalation tier 면 `repository.findMany(query)` forward, (ii) non-Admin 이면 **항상 빈 배열** 을 반환한다. 후자는 ADR-0023 §1 fallback("허용 instance 집합이 비어 있으면 200 빈 배열")의 deliberate placeholder 다 — User↔instance binding schema 가 부재해 **허용 instance 집합이 항상 공집합** 이기 때문이다.

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0021]` 에서 **option (1) audit own-instance 실 필터를 승인** 했다 — non-Admin 운영자가 자기 instance 범위 record 를 실제 조회하도록 placeholder 를 실 필터로 대체한다([Q-0020](../STATE.json) 의 'Admin 전체 + 자기 instance' audience 차등 중 non-Admin 절반 완성). 그 decision 은 (i) **§5 DB-schema 게이트를 본 승인으로 충족**(prisma schema migration 허용, [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) migrate-deploy 준수), (ii) **새 외부 dependency 0**(내장 prisma), (iii) binding-schema 설계를 **ADR-first 로 architect 에 위임**(architect 가 ADR 제안 → 사용자가 ADR PR 검토 — milestone-3 동형), (iv) 후속 slice 의 R-112 4종 + negative cases + regression 을 제약으로 명시했다.

ADR-0023 §2 가 **방향(server-side User lookup, JwtPayload 비확장, exact match)** 은 이미 박제했으나, binding 의 **구체 데이터 모델**(join table vs allowed-instances 컬럼 vs group membership 파생)·매핑 규칙·정규화 규칙·migration 접근은 미결정이다. ADR-0023 §2(b) 가 이를 "선행 schema 확장 task" 로 deferred 했고, 본 ADR 이 그 deferred row 를 구체화한다.

따라서 Q-0021 위임대로 **prisma schema 변경 / migration / repository / service 필터 결선 코드보다 먼저 ADR 로 binding 모델 + 필터 계약을 박제** 한다([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)/[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) ADR-first 패턴 mirror) — reviewer 가 schema 변경 전 binding 모델·필터 경계를 점검하고 후속 slice 가 단일 source 를 mirror 하도록. 본 task 는 ADR doc + INDEX 1 row 만 — production code 0 / prisma schema 변경 0 / migration 0.

### REQ 외력

- **REQ-016** ([README.md](../../README.md) L33) — 권한 부족의 user/admin audience 분리. 본 ADR 이 그 분리의 **non-Admin(user) 절반** 을 binding 데이터 모델 + own-instance 필터로 완성한다 — [ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) 이 audience 계약을 박제했고 본 ADR 이 non-Admin 의 실 조회 경로를 결선 가능하게 한다.
- **REQ-044** ([README.md](../../README.md) L19~22, L33) — instance / SPACE 별 권한 분리 + 권한 거부 가시화. 본 ADR 의 binding 이 "어느 운영자가 어느 instance 의 거부 이력을 볼 수 있는가" 의 instance 별 권한 분리를 조회 측에서 실 강제한다.

### 기존 schema / stack (본 ADR 이 따를 source)

- **`User` model** ([prisma/schema.prisma](../../prisma/schema.prisma) L170~177) — `id` / `email @unique` / `hashedPassword` / `role`(String literal "SuperAdmin"/"Admin"/"User") / `createdAt` / `updatedAt`. **instance 연계 컬럼/테이블 부재** — 본 ADR 이 binding 을 어느 구조로 붙일지 결정한다.
- **`PersonGroupMembership` join model** ([prisma/schema.prisma](../../prisma/schema.prisma) L131~141) — `id` / `personId` / `groupId` / `createdAt` + `@@unique([personId, groupId])` + `@relation(... onDelete: Cascade)`. 다대다 join entity 의 reference 패턴 — 본 ADR 의 User↔instance join 이 이를 mirror 한다.
- **`PermissionDeniedRecord` model** ([prisma/schema.prisma](../../prisma/schema.prisma) L432~444) — `instanceRef String`(L435) + `@@index([instanceRef, createdAt])`. binding 이 매핑할 대상 식별자(본 ADR Decision §1).
- **`AuditQueryActor` + `isAdminBypass`** ([service](../../src/permission-denied/permission-denied-record.service.ts) L37~53) — `sub?`+`role?` actor view + Admin escalation 판별. 본 ADR 의 identity → allowlist 매핑이 `actor.sub`(=`JwtPayload.sub`=userId)를 lookup key 로 쓴다.
- **`PermissionDeniedRecordFilter`** ([repository](../../src/permission-denied/permission-denied-record.repository.ts) L47~51) — `instanceRef?`(단일 exact) / `provider?` / `httpStatus?`. 본 ADR 이 own-instance 의 `instanceRef in (allowlist)`(set membership) 필터가 이 기존 단일 필터와 어떻게 공존하는지 결정한다.

### ADR cross-reference

- **다음 free 번호 ADR-0024** — `docs/decisions/` 에 ADR-0001 ~ ADR-0023 점유(ADR-0007 만 미신설). 본 ADR 은 다음 free 번호 ADR-0024 를 사용.
- **[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)** — 본 ADR 의 직속 선행. audience/RBAC/응답 경계(§1/§3/§4) + server-side lookup 방향(§2) + exact match(§2)는 **재결정 0**. 본 ADR 은 그 §2(b) 가 deferred 한 binding 의 구체 데이터 모델 + 매핑 규칙 + 정규화 + migration 만 추가 박제한다.
- **[ADR-0022](ADR-0022-permission-denied-record-data-model.md)** — `instanceRef`(GitHub configured host / Confluence 풀 REST base URL free-form 문자열, §1) 정의 source. 본 ADR 은 그 정의를 **재결정하지 않고** binding 의 매핑 대상으로 참조만 한다.
- **[ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md)** — strict equal(subdomain 불허) + 정보 노출 최소화 invariant. 본 ADR 의 exact-match 정규화(Decision §4)가 정합.
- **[ADR-0008](ADR-0008-auth-credential-type.md)** — `JwtPayload`(`sub`+`role`) claim 계약. 본 ADR 은 `sub` → server-side lookup 으로 도출 가능함을 확인하고 **claim 을 확장하지 않는다**(ADR-0023 §2 정합).
- **[ADR-0004](ADR-0004-smoke-e2e-db-mode.md)** — CI 실 PostgreSQL + `prisma migrate deploy`. 후속 migration slice 가 따를 절차 source(Decision §5).

## Decision

본 ADR 은 다음 5 결정을 박제한다. **본 ADR 은 binding 데이터 모델 + 필터 계약을 기술하되 prisma schema model / migration / binding repository / service 필터 결선 / R-112 test 코드는 신설/변경하지 않는다(production code 0 LOC + prisma schema 변경 0 — 후속 slice 책임). `JwtPayload` 확장도 본 ADR 범위 밖([ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) §2 server-side lookup 재확인).**

### Decision §1 — "instance" 식별자 정의 (무엇에 binding 하는가)

- **binding 대상 = record 의 `instanceRef` (신규 식별자 개념 도입 0)** — User↔instance binding 의 "instance" 는 [`PermissionDeniedRecord.instanceRef`](../../prisma/schema.prisma)(L435, `String`) 와 **동일한 식별자** 다. [ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md) 상 `instanceRef` 는 GitHub 의 configured host(예: `github.sec.samsung.net`) 또는 Confluence 의 풀 REST API base URL(예: `https://acme.atlassian.net/wiki/rest/api`)을 담는 **free-form 문자열** 이다. binding 은 사용자별로 이 `instanceRef` 값들의 집합(허용 instance allowlist)을 보유한다 — 새 식별자 체계(예: instance UUID / FK)를 도입하지 않고 `instanceRef` 문자열을 그대로 binding 단위로 쓴다.
- **binding 단위 = exact match (ADR-0023 §2 정합)** — binding 의 instanceRef 와 record 의 instanceRef 는 **exact match**(정규화 후 정확 일치)로 비교한다(prefix / substring 아님). [ADR-0023 §2](ADR-0023-permission-denied-audit-query-rbac-contract.md) 가 박제한 exact-match 결정을 재확인한다 — host-spoofing 차단([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) strict equal 정합). 정규화 규칙은 Decision §4 가 명시 채택한다.
- **provider scope 비포함 (명시)** — binding 은 `instanceRef` 단위로만 잡고 `provider`(github/confluence) 를 별도 차원으로 두지 않는다. 사유: `instanceRef` 자체가 provider 별로 disjoint(GitHub host 와 Confluence base URL 은 형태가 달라 충돌 0)라 instanceRef 단일 차원이 instance 를 유일 식별한다. provider 별 추가 scope 가 필요해지면 후속 ADR(Alternatives 재검토).

### Decision §2 — User↔instance binding 데이터 모델 (어떻게 묶는가)

사용자가 읽을 수 있는 instance 집합을 어떻게 영속할지를 3 option 으로 검토 후 **(a) `UserInstanceAccess` join table 을 default 채택** 한다.

| option | 모델 | 장점 | 단점 / trade-off |
| --- | --- | --- | --- |
| **(a) `User`↔instance join table** (채택) | 신규 model `UserInstanceAccess { id / userId / instanceRef / createdAt }` + `@@unique([userId, instanceRef])` + `userId @relation(... onDelete: Cascade)` ([PersonGroupMembership](../../prisma/schema.prisma) L131~141 mirror) | 정규화(1NF — instanceRef 가 별 row) / 다대다 자연 표현 / `instanceRef in (SELECT instanceRef WHERE userId=?)` query 직접 / 중복 차단(`@@unique`) / User 삭제 시 Cascade 정리 / 기존 join 패턴 재사용(컨벤션 정합) | join model 1 개 신설(migration 1 회) / lookup 에 1 query(또는 join) — 단 instance 수가 적어(운영 instance 수십 단위) 비용 미미 |
| **(b) `User` 에 array/JSON 컬럼** | `User.allowedInstances String[]`(Postgres array) | migration 단순(컬럼 1 추가) / User 1 row 로 lookup(join 0) | **정규화 위배** — 다대다를 array 로 표현 / `instanceRef in (...)` 를 array 연산(`@> / ANY`)으로 — Prisma string[] 필터 표현력 제약 / 중복/순서 invariant 를 app-layer 가 별도 강제 / array 변경 시 row-level lock 경합 / 기존 schema 에 array 컬럼 선례 0(컨벤션 이탈) |
| **(c) 기존 group membership / ServiceIdentity 파생** | binding 을 신설하지 않고 `PersonGroupMembership` 또는 `ServiceIdentity.service`(host) 에서 사용자의 instance 접근을 파생 | 신규 model 0(migration 0) | **User ↔ Person ↔ ServiceIdentity relation 부재** — [User](../../prisma/schema.prisma) L149~151 가 `User↔Person` relation 을 명시 Out of Scope 로 deferred. 파생 경로 자체가 미존재 schema 에 의존 / Group 은 평가 도메인(Person)용이라 audit 운영자 권한과 semantic 불일치 / 파생 규칙이 암묵적이라 binding 의도가 불투명 |

**채택: (a) `UserInstanceAccess` join table.** 사유:

1. **정규화 + 다대다 표현력** — 한 사용자가 여러 instance, 한 instance 를 여러 사용자가 운영하는 다대다를 join row 로 자연 표현한다([PersonGroupMembership](../../prisma/schema.prisma) 다대다 패턴 정합). array 컬럼(b)은 정규화 위배 + Prisma 필터 표현력 제약 + 컨벤션 이탈.
2. **query 직접성** — own-instance 필터의 `instanceRef in (allowlist)` 가 `SELECT instanceRef FROM UserInstanceAccess WHERE userId = ?` 의 직접 결과집합이라 lookup → 필터 변환이 명료(Decision §3).
3. **기존 컨벤션 재사용** — cuid PK / `createdAt @default(now())` / `@@unique` / `onDelete: Cascade` 가 [PersonGroupMembership](../../prisma/schema.prisma) L131~141 패턴 그대로라 신규 컨벤션 0.
4. **파생(c) 불가** — `User↔Person` relation 이 현 schema 에 부재([User](../../prisma/schema.prisma) L149~151 deferred)라 group/ServiceIdentity 파생 경로 자체가 없다 + Group 의 평가 도메인 semantic 이 audit 운영자 권한과 불일치.

**채택 모델 (후속 slice 가 박제할 schema — 본 ADR 은 결정만, schema.prisma 미접촉):**

```prisma
model UserInstanceAccess {
  id          String   @id @default(cuid())
  userId      String
  instanceRef String
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, instanceRef])
  @@index([userId])
}
```

- **`@@unique([userId, instanceRef])`** — 동일 (user, instance) 중복 binding 차단([PersonGroupMembership](../../prisma/schema.prisma) `@@unique([personId, groupId])` 정합). 중복 binding 입력은 P2002 — 후속 repository slice 의 책임 경계.
- **`@@index([userId])`** — allowlist lookup(`WHERE userId = ?`)의 조회 경로. `@@unique([userId, instanceRef])` 의 leading-edge(userId)로도 부분 cover 되나 명시 index 후보로 박제 — 채택 여부는 후속 schema slice 가 실 조회로 확정.
- **`onDelete: Cascade`** — User 삭제 시 binding row 동반 정리(고아 binding 0, [PersonGroupMembership](../../prisma/schema.prisma) Cascade 정합). audit record(`PermissionDeniedRecord`)는 standalone([ADR-0022 §5](ADR-0022-permission-denied-record-data-model.md))이라 본 Cascade 와 무관 — binding 삭제는 record 를 건드리지 않는다.
- **`User` 측 relation 필드** — `User` model 에 `instanceAccess UserInstanceAccess[]` back-relation 1 줄 추가(Prisma relation 양방향 요구). 이는 후속 schema slice 의 `User` model 1 줄 변경.

### Decision §3 — own-instance 필터 계약 (identity → allowlist → WHERE)

[ADR-0023 §3](ADR-0023-permission-denied-audit-query-rbac-contract.md)(service-layer actor-aware 분기, 단일 강제 지점, 신규 guard 0) 결정을 **그대로 따른다** — 본 ADR 은 그 분기 안의 'binding lookup → set membership 필터' 구체화만 추가한다.

- **identity 추출** — controller 가 [`@CurrentUser()`](../../src/auth/current-user.decorator.ts) 로 `JwtPayload`(`sub`+`role`)를 추출해 service 에 [`AuditQueryActor`](../../src/permission-denied/permission-denied-record.service.ts)(`{ sub, role }`, L37~40) 로 전달한다(기존 shape — 변경 0). `actor.sub` = userId 가 binding lookup key.
- **Admin bypass (재확인)** — [`isAdminBypass(actor.role)`](../../src/permission-denied/permission-denied-record.service.ts)(L47~53, [`ROLE_HIERARCHY.Admin`](../../src/auth/roles.guard.ts) escalation `["Admin","SuperAdmin"]`) true 면 필터 없이 `repository.findMany(query)` forward(전체 조회). [ADR-0023 §3](ADR-0023-permission-denied-audit-query-rbac-contract.md) Admin bypass 그대로 — 변경 0.
- **non-Admin allowlist lookup** — `isAdminBypass` false 면, **현 placeholder("빈 배열 즉시 반환")를 binding lookup 으로 대체** 한다:
  1. `actor.sub` 로 `UserInstanceAccess` 에서 허용 instance 집합 `allowlist: string[]`(= `SELECT instanceRef WHERE userId = actor.sub`)을 server-side lookup(Decision §2 source). `actor.sub` 가 undefined/빈 문자열이면 lookup 0 → 빈 allowlist(Decision §4 경계).
  2. `allowlist` 가 **공집합** 이면 → **빈 배열 반환**(repository 미호출, [ADR-0023 §1](ADR-0023-permission-denied-audit-query-rbac-contract.md) fallback 정합 — placeholder 와 동일 결과지만 사유가 "binding 0" 으로 명확화).
  3. `allowlist` 가 비어있지 않으면 → `repository.findMany` 에 **`instanceRef in (allowlist)` set membership 필터를 강제 주입** 해 forward.
- **사용자 제공 `query.instanceRef`(exact) 와 allowlist(set)의 합성 = 교집합 (명시 채택)** — non-Admin 이 query param 으로 단일 `instanceRef` 를 지정하면([repository](../../src/permission-denied/permission-denied-record.repository.ts) `PermissionDeniedRecordFilter.instanceRef`), 그 값과 allowlist 를 **AND(교집합)** 한다:
  - `query.instanceRef` 가 allowlist 에 **속하면** → 그 단일 instanceRef 로 좁힌 결과(사용자 의도 + own-instance 둘 다 만족).
  - `query.instanceRef` 가 allowlist 에 **없으면** → **빈 결과**([ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) 빈-필터 — 타 instance 를 query 해도 보이지 않음, 403 아님).
  - `query.instanceRef` 부재면 → allowlist 전체로 `instanceRef in (allowlist)`.
  - 이는 own-instance 필터가 사용자 필터 **위에 AND** 로 얹히는 [ADR-0023 §5](ADR-0023-permission-denied-audit-query-rbac-contract.md) 결정 정합 — 사용자가 own-instance 범위를 query param 으로 넓힐 수 없다(allowlist 가 상한).
- **`findMany` 의 set membership 필터 표현** — 현 [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts)(L47~51) 는 `instanceRef?: string`(단일 exact)만 보유한다. own-instance 의 `instanceRef in (...)` set 필터를 표현하려면 repository 의 필터 shape 를 `instanceRef in (allowlist)` 를 받도록 확장해야 한다(예: `instanceRefIn?: string[]` 추가 또는 `instanceRef` 를 `string | string[]` union). **구체 signature 확정은 후속 repository slice 책임** — 본 ADR 은 "단일 exact 필터와 set membership 필터가 AND 공존해야 한다" 는 계약만 박제. 기존 단일 `instanceRef`(exact) 필터는 그대로 유지(Admin path / 다른 호출자 호환).

### Decision §4 — 경계 (boundaries) + instanceRef 정규화

audit own-instance 필터의 경계를 박제한다([ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) 응답 경계 정합):

| 상황 | 응답 | 사유 |
| --- | --- | --- |
| **미인증 (JWT 부재/무효)** | **401** | [`JwtAuthGuard`](../../src/auth/roles.guard.ts) 가 차단(인증 부재). binding lookup 도달 전. [ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) 정합. |
| **authenticated 이나 allowlist 공집합 (binding 0)** | **200 빈 배열** (403 아님) | role tier 통과(authenticated)했고 허용 instance 0 개 → 매칭 record 0 개. [ADR-0023 §1](ADR-0023-permission-denied-audit-query-rbac-contract.md) fallback 그대로 — 기존 placeholder 와 동일 결과. |
| **타 instance record (allowlist 밖)** | **빈-필터 (보이지 않음, 200)** | `instanceRef in (allowlist)` 에서 where 매칭 0 — "차단" 아닌 "범위 밖". [ADR-0023 §4](ADR-0023-permission-denied-audit-query-rbac-contract.md) audit 노출 최소화 정합(403 아님 — 존재 여부 비노출). |
| **자기 instance record (allowlist 안)** | **200 + 해당 record** | own-instance 정상 조회. createdAt desc 정렬(repository 고정). |

**instanceRef 정규화 규칙 (ADR-0023 §2 가 "후속 slice 가 source 박제 시 확정" 으로 deferred 한 부분을 본 ADR 이 명시 채택):**

- **(i) case 정규화 — host 부분 lowercase** — `instanceRef` 비교는 **host 부분을 case-insensitive(lowercase 정규화 후 비교)** 로 한다. 사유: DNS host 는 대소문자 무관(RFC 4343)이라 `GitHub.SEC.samsung.net` 과 `github.sec.samsung.net` 은 동일 instance([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) host case-insensitive 정합). Confluence base URL 의 host 부분도 동일. binding 입력 시점과 비교 시점 양쪽에서 동일 정규화 적용(round-trip 일관).
- **(ii) trailing slash 정규화 — 제거** — Confluence 풀 REST base URL(예: `.../wiki/rest/api`)의 **trailing slash 를 제거** 후 비교한다(`.../api/` 와 `.../api` 동일). 사유: base URL 표기 변형이 동일 instance 를 다르게 오인하지 않도록([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) URL 정규화 정합).
- **(iii) path/scheme — 그대로 비교** — host·trailing-slash 외 path·scheme 부분은 정규화하지 않고 그대로 exact 비교한다(record 의 instanceRef 가 adapter 박제 정규화값, [ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md))이라 변형 표면이 작음. scheme(`https`)까지 일치 요구 — [ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) scheme+host+port strict equal 정합.
- **(iv) 빈/null instanceRef** — binding 의 instanceRef 가 빈 문자열/null 인 row 는 **유효 binding 아님**(allowlist 에서 제외). record 의 instanceRef 는 NOT NULL([schema](../../prisma/schema.prisma) L435 `String`)이라 빈 instanceRef record 는 정상 입력에서 발생 0이나, 방어적으로 빈 instanceRef 는 어느 binding 과도 매칭 0(보이지 않음).
- **(v) 중복 binding row** — `@@unique([userId, instanceRef])`(Decision §2)가 schema 차원에서 중복을 차단하나, 정규화 전 변형(case 차이)으로 우회될 수 있으므로 **binding 입력 시점에 (i)(ii) 정규화 후 저장** 한다(후속 repository slice 책임). 정규화 저장으로 `@@unique` 가 정규화값 기준 중복을 강제.

### Decision §5 — migration 접근 (ADR-0004 migrate-deploy 준수)

- **본 ADR 은 schema 변경 0** — Decision §2 채택 모델(`UserInstanceAccess` join + `User` back-relation 1 줄)의 prisma schema 변경 + migration 은 **후속 slice** 다. 본 ADR 은 데이터 모델 **결정** 만 박제([prisma/schema.prisma](../../prisma/schema.prisma) 미접촉).
- **migration 절차 = ADR-0004 migrate-deploy** — 후속 schema slice 는 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 의 **`prisma migrate deploy` 패턴** 을 따른다 — `prisma/schema.prisma` 가 source of truth, CI 가 test 직전 실 PostgreSQL 16 container 에 `pnpm prisma migrate deploy` 로 적용([ADR-0022 §migration 절차](ADR-0022-permission-denied-record-data-model.md) 동형). 외부 credential 0(CI 실 PostgreSQL 이미 존재).
- **§5 DB-schema 게이트 충족** — [Q-0021](../STATE.json) 가 본 binding-schema migration 을 **명시 승인**([CLAUDE.md §5](../../CLAUDE.md) DB-schema 게이트 OPEN, 새 외부 dependency 0). 후속 schema slice 는 게이트를 **재발화하지 않고** 진행 가능.
- **기존 User row backfill = binding 0 시작 (breaking change 0)** — 기존 모든 `User` row 는 binding 0(빈 allowlist)으로 시작한다 — `UserInstanceAccess` 가 빈 table 로 생성되므로 non-Admin 사용자의 allowlist 가 공집합 → Decision §4 의 "빈 배열 fallback"(현 placeholder 와 동일 결과). 따라서 **migration 자체는 동작 변경 0**(non-Admin 은 여전히 빈 배열) — binding row 가 채워진 사용자만 실 조회가 활성. backfill SQL / seed 불요(빈 시작이 안전 기본값).
- **binding seed 책임 경계 (명시 — 본 ADR 은 경계만, 구현 별도 task)** — "누가 User 에 instance 를 부여하는가"(binding row 생성)는 본 ADR 범위 밖이다. 후보: (i) Admin endpoint(`POST /api/users/{id}/instance-access`), (ii) seed script, (iii) GITHUB_INSTANCES env 기반 자동 부여. 운영상 필요해지면 별도 task(후속 chain (조건부) row / Follow-up). binding 부여 경로가 없으면 non-Admin 은 영구 빈 배열(안전하나 무용) — 따라서 own-instance 필터 결선 slice 와 binding 부여 경로 slice 는 **함께 운영 가치가 발생**(둘 중 하나만으로는 non-Admin 실 조회 미완).

## Consequences

### 양의 (positive)

1. **ADR-first 로 reviewer 선행 점검** — prisma schema 변경 전에 binding 데이터 모델(join table) + 필터 계약(identity→allowlist→WHERE) + 정규화 + migration 경계를 reviewer 가 점검 → 후속 schema/filter slice 가 단일 source 를 mirror, 설계 divergence 0([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md)/[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) ADR-first 패턴 정합).
2. **dependency-free** — Decision §2 채택 모델이 기존 Prisma + 실 PostgreSQL([ADR-0004](ADR-0004-smoke-e2e-db-mode.md)) 위 join model 1 개 추가일 뿐 — 후속 slice 가 `pnpm add` 0 / 외부 credential 0 으로 진입([CLAUDE.md §5](../../CLAUDE.md) Q-0021 승인).
3. **REQ-016 non-Admin audience 완성** — binding + own-instance 필터가 [ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md) audience 계약의 non-Admin(user) 절반(현재 placeholder 빈 배열)을 실 조회로 완성한다.
4. **단일 강제 지점 유지** — Decision §3 가 [ADR-0023 §3](ADR-0023-permission-denied-audit-query-rbac-contract.md) service-layer 단일 강제 지점을 그대로 따름 → own-instance 강제 우회 경로 0(controller 누락에도 service 강제).
5. **정규화 규칙 명시** — Decision §4 가 ADR-0023 §2 deferred 정규화(case/trailing slash)를 명시 채택 → exact-match 정확도 확보([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 정합).
6. **breaking change 0 migration** — Decision §5 의 binding 0 시작이 기존 User 동작을 바꾸지 않음(non-Admin 여전히 빈 배열) → migration 안전, backfill 불요.
7. **JwtPayload 비확장** — Decision §3 가 [ADR-0023 §2](ADR-0023-permission-denied-audit-query-rbac-contract.md) server-side lookup(claim 비대화 / 토큰 재발급 cost / JwtPayload 확장 ADR 회피) 재확인.

### 음의 (negative) / trade-off

1. **binding seed 책임 미정** — Decision §5 상 "누가 User 에 instance 를 부여하는가" 가 본 ADR 범위 밖이다. binding 부여 경로(Admin endpoint / seed)가 별도 task 로 구현되기 전까지 non-Admin 은 영구 빈 배열(own-instance 필터가 결선돼도 보여줄 record 0). mitigation: 후속 chain 에 (조건부) binding 부여 slice 박제 — own-instance 필터 slice 와 함께 운영 가치 발생.
2. **join table lookup cost** — Decision §2 (a)가 list 마다 allowlist lookup 1 query(또는 record query 와 join) 를 추가한다. mitigation: instance 수가 적어(운영 instance 수십 단위) lookup 결과집합이 작음 + `@@index([userId])`(Decision §2) 가 조회 경로 cover. 부담 시 user-level cache(별도 task).
3. **set membership 필터 표현 확장** — Decision §3 상 현 [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts)(단일 `instanceRef` exact)를 `instanceRef in (...)` set 를 받도록 확장해야 한다 — repository signature 변경이 후속 slice 의 코드 변경. mitigation: 기존 단일 필터는 유지(Admin path / 다른 호출자 호환), set 필터를 additive 로 추가.
4. **정규화 정확도(host alias)** — Decision §4 정규화(case/trailing slash)에도 host alias(같은 instance 의 다른 DNS 이름) 는 다른 instanceRef 로 오인된다. mitigation: record 의 instanceRef 가 adapter 박제 정규화값([ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md))이라 alias 표면이 작음 + binding 입력 시 동일 정규화 적용. alias 통합이 필요해지면 별도 ADR.
5. **빈 시작의 운영 cost** — Decision §5 상 기존 User binding 0 시작이라, own-instance 필터가 의미 있으려면 운영자가 binding 을 수동/자동 부여해야 한다. mitigation: Admin 은 bypass 라 즉시 전체 조회 가능(binding 무관) — non-Admin 조회만 binding 의존.

### 후속 task chain

본 ADR(doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md)(ADR + 코드 split) 정합. 각 ≤ 300 LOC / 5 파일. **본 task 에서 큐잉하지 않음**(planner 1-task 원칙 — Follow-ups 에 나열만):

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **(1) prisma schema + migration** | [prisma/schema.prisma](../../prisma/schema.prisma) 에 `UserInstanceAccess` model 추가(Decision §2 필드 + `@@unique([userId, instanceRef])` + `@@index([userId])` + `onDelete: Cascade`) + `User` 에 back-relation 1 줄 + `prisma migrate` 생성([ADR-0004](ADR-0004-smoke-e2e-db-mode.md) migrate-deploy) | 본 ADR-0024 머지 후 | **없음** — §5 DB-schema 게이트 Q-0021 로 OPEN, dep 0 |
| **(2) binding repository + allowlist lookup** | `UserInstanceAccess` repository(`findInstanceRefsByUserId(userId): string[]` allowlist lookup + binding 입력 시 Decision §4 정규화 + create) + R-112 4종(happy/error/flow/negative) | (1) 머지 후 | 없음(entity 로직) |
| **(3) service own-instance 필터 결선** | [`PermissionDeniedRecordService.list`](../../src/permission-denied/permission-denied-record.service.ts) non-Admin 분기에 allowlist lookup → `instanceRef in (allowlist)` 필터 강제 주입(Decision §3, [ADR-0023 §3](ADR-0023-permission-denied-audit-query-rbac-contract.md) service-layer) + [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts) set membership 필터 확장 + query.instanceRef ∩ allowlist 교집합(Decision §3) | (2) 머지 후 | 없음 |
| **(4) R-112 test block (3 동반) + regression** | happy(Admin 전체 / non-Admin 자기 instance) + error + flow + **negative**: 타 instance record 차단(빈-필터) / non-Admin Admin-route 차단 / 빈 결과 200 / 미인증 401 / 경계 instance 식별자(case/trailing-slash 정규화 / 빈 instanceRef) **각 1+** + **regression**(현 non-Admin "항상 빈 배열" placeholder → 실 필터 전환 회귀 방어 — binding 있는 사용자가 자기 record 를 실제로 받는지) | (3) 와 동일 PR | 없음 |
| **(조건부) binding 부여 경로** | Decision §5 seed 책임 — Admin endpoint / seed script(누가 binding 을 채우는가). 운영 필요 시 별도 task | (1)~(4) 후, 필요 시 | dep 0(코드) |

> **R-112 4종 + negative-case test 는 본 ADR(코드 symbol 0)에 적용 대상이 아니다** — 위 (4) slice 로 **명시 deferred**. 본 ADR-0024 task 는 binding 모델 + 필터 계약 결정 + INDEX row 만(production code 0 / prisma schema 변경 0 / spec 0).

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) `UserInstanceAccess` join table + identity→allowlist→`instanceRef in (...)` service-layer 필터 + query∩allowlist 교집합 + host case/trailing-slash 정규화 exact-match + binding 0 시작 migration** (채택) | 정규화 다대다 표현 / query 직접성 / 기존 join 컨벤션 재사용 / 단일 강제 지점(ADR-0023 §3) / breaking change 0 / dependency-free / JwtPayload 비확장 / ADR-first reviewer 선행 점검 | binding seed 책임 미정 / lookup 1 query / set 필터 표현 확장 / host alias 오인 | **✓ 채택** (Q-0021 binding-schema ADR-first 위임 + 현 schema/stack 직접 정합) |
| **(b) `User.allowedInstances String[]` array/JSON 컬럼** | migration 단순(컬럼 1) / join 0 lookup(User 1 row) | 정규화 위배(다대다를 array) / Prisma string[] 필터 표현력 제약(`in` ↔ array 연산 mismatch) / 중복·순서 invariant app-layer 강제 / array 변경 row-lock 경합 / 기존 schema array 선례 0(컨벤션 이탈) | 기각 — join table 이 정규화 + 컨벤션 정합(Decision §2) |
| **(c) 기존 group membership / ServiceIdentity 파생** | 신규 model 0(migration 0) | `User↔Person` relation 부재([User](../../prisma/schema.prisma) L149~151 deferred)로 파생 경로 자체 미존재 / Group 은 평가 도메인(Person)용이라 audit 운영자 권한과 semantic 불일치 / 파생 규칙 암묵적(binding 의도 불투명) | 기각 — 파생 source schema 부재 + semantic 불일치(Decision §2) |
| **(d) JwtPayload 에 instance allowlist claim 확장 (토큰에 binding 박제)** | server-side lookup 불요(claim 즉시 도출) | JwtPayload 확장은 별도 ADR/migration([ADR-0008](ADR-0008-auth-credential-type.md) amendment) / claim 비대화 / instance 권한 변경 시 토큰 재발급 / [ADR-0023 §2](ADR-0023-permission-denied-audit-query-rbac-contract.md) 가 이미 server-side lookup 채택 | 기각 — server-side User lookup 이 claim 비확장(ADR-0023 §2 재확인) |
| **(e) own-instance 필터를 query.instanceRef ∪ allowlist 합집합 (사용자가 범위 확장)** | 사용자 query 유연 | 사용자가 query param 으로 타 instance 를 추가해 own-instance 격리 우회 → audit 누출 / [ADR-0023 §4/§5](ADR-0023-permission-denied-audit-query-rbac-contract.md) 빈-필터·allowlist 상한 위배 | 기각 — 교집합(allowlist 상한)이 격리 보장(Decision §3) |
| **(f) prefix / substring instanceRef 매칭** | host alias / 하위 경로 유연 매칭 | `github.sec.samsung.net` 이 `...evil.com` 류 포함 host-spoofing risk / record instanceRef 가 정규화값이라 prefix 불요 / [ADR-0023 §2](ADR-0023-permission-denied-audit-query-rbac-contract.md)·[ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) exact/strict-equal 위배 | 기각 — exact match(정규화 후) 가 spoofing 차단(Decision §1/§4) |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) binding 부여가 빈번/대량이면 binding 부여 endpoint·bulk import ADR. (ii) host alias 통합이 필요해지면 instance canonical-id 도입 ADR. (iii) provider 별 추가 scope(같은 host 의 github vs 다른 권한) 가 필요해지면 binding 에 provider 차원 추가 ADR. (iv) lookup 부담이 실측되면 user-level allowlist cache ADR.

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0021]` — option (1) audit own-instance 필터 승인(§5 DB-schema 게이트 충족 / 새 외부 dependency 0 / binding-schema ADR-first 위임 / R-112 4종 + negative + regression 제약) + `humanQuestions[Q-0020]`(RBAC scope = Admin + 자기 instance audience 차등) — 본 ADR 의 직접 motivation
- [docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md](ADR-0023-permission-denied-audit-query-rbac-contract.md) — 직속 선행. audience/RBAC/응답 경계(§1/§3/§4) + server-side lookup·exact-match 방향(§2) 재결정 0 — 본 ADR 이 §2(b) deferred binding 을 구체 데이터 모델 + 매핑 + 정규화 + migration 으로 박제
- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](ADR-0022-permission-denied-record-data-model.md) — `instanceRef`(GitHub host / Confluence 풀 base URL free-form) 정의 source — binding 의 매핑 대상(재결정 0)
- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](ADR-0021-github-confluence-live-integration-test-contract.md) — ADR-first TEMPLATE(Decision enumerated / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 task chain 구조 mirror)
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](ADR-0019-same-host-auth-restriction-for-pagination.md) — scheme+host(case-insensitive)+port strict equal + 정보 노출 최소화(Decision §1 exact-match / §4 정규화 정합)
- [docs/decisions/ADR-0008-auth-credential-type.md](ADR-0008-auth-credential-type.md) — JWT / JwtPayload(`sub`+`role`) claim 계약(Decision §3 claim 비확장 경계)
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](ADR-0004-smoke-e2e-db-mode.md) — CI 실 PostgreSQL + `prisma migrate deploy`(Decision §5 migration 절차 source)
- [prisma/schema.prisma](../../prisma/schema.prisma) — `User`(L170~177 instance 연계 부재) + `PersonGroupMembership`(L131~141 join + `@@unique` + Cascade 패턴 mirror) + `PermissionDeniedRecord.instanceRef`(L435) — binding 모델·매핑 대상 source
- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) L37~53/L133~144 — `AuditQueryActor` / `isAdminBypass` / `list` non-Admin placeholder(Decision §3 결선 대상)
- [src/permission-denied/permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) L47~51 — `PermissionDeniedRecordFilter`(단일 `instanceRef` exact, Decision §3 set membership 확장 대상)
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — `ROLE_HIERARCHY` escalation(Decision §3 Admin bypass) / [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) — `@CurrentUser()` identity 추출
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상(본 ADR-0024 row)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다"(ADR-first split 정당화) / [§3.1 rule 4](../../CLAUDE.md) 새 ADR = pr-mode / [§5](../../CLAUDE.md) DB-schema 게이트(Q-0021 OPEN) / [§9](../../CLAUDE.md) secret 미기재

Refs: T-0220, Q-0020, Q-0021, ADR-0004, ADR-0008, ADR-0019, ADR-0021, ADR-0022, ADR-0023, REQ-016, REQ-044

---
id: ADR-0023
title: PermissionDeniedRecord audit 조회 RBAC/audience 모델 + instance-scoping 필터 계약 — audit 조회 endpoint 의 누가-무엇을-읽는가 / 자기 instance 판별 / Admin bypass / 401·403·빈결과 경계 / endpoint shape
status: ACCEPTED (2026-06-04)
date: 2026-06-04
relatedTask: T-0213
supersedes: null
---

# ADR-0023 — PermissionDeniedRecord audit 조회 RBAC/audience 모델 + instance-scoping 필터 계약 박제

> [ADR-0022](ADR-0022-permission-denied-record-data-model.md)(T-0207) 가 박제한 `PermissionDeniedRecord` audit entity 위에, 그 record 를 **운영자가 조회하는 REST endpoint 의 audience(누가 무엇을 읽는가) / instance-scoping 필터 / Admin bypass / 401·403·빈결과 응답 경계 / endpoint shape** 계약을, [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)(T-0203) 의 **ADR-first 패턴**(계약을 controller 코드보다 먼저 박제 → reviewer 선행 점검 → 후속 slice 가 단일 source mirror)을 mirror 해 **단일 ADR-0023 으로 선행 박제**한다. 본 ADR 은 조회 audience·필터 **결정** 만 기술하며 production code 0 LOC — controller / own-instance 필터 / RBAC 결선 / R-112 test 는 후속 controller slice 가 본 ADR 을 단일 source 로 mirror 한다.

## Context

[ADR-0022](ADR-0022-permission-denied-record-data-model.md) 가 GitHub / Confluence adapter 의 권한 거부 이벤트를 영속화하는 `PermissionDeniedRecord` entity(데이터 모델 + 영속화 흐름)를 박제했고, 후속 6 slice(T-0207~T-0212)가 prisma schema + migration / repository + service / module DI / GitHub·Confluence emitter wiring 을 모두 머지해 양 adapter 의 권한 거부가 실 PostgreSQL 에 end-to-end 영속화된다. 그러나 그 record 를 **운영자가 조회하는 경로는 아직 없다** — `PermissionDeniedRecordService.list(query?)` / `repository.findMany(filter?)`(instanceRef / provider / httpStatus 필터 + createdAt desc 정렬)는 존재하나 HTTP endpoint 가 부재하고, 따라서 "누가 audit 를 읽을 수 있는가" 의 audience 계약이 미정의다.

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0020]`(session #53 AskUserQuestion)에서 **option (1) audit 조회 HTTP endpoint 를 승인**했다 — `GET /api/permission-denied-records` audit 조회 REST endpoint 추가, **RBAC scope = Admin + 자기 instance**: Admin role 은 전체 record 조회(bypass), 일반 운영자(non-Admin authenticated)는 자기 instance(record 의 `instanceRef` source 식별자) 범위 record 만 조회 — [README.md](../../README.md) REQ-016 의 user/admin audience 분리를 audit 조회 경로에 매핑한다. 새 외부 dependency 0(기존 NestJS controller + `@Roles`/guard 패턴 재사용) / 외부 credential 0 → [CLAUDE.md §5](../../CLAUDE.md) security(auth) 게이트는 본 RBAC scope 결정으로 충족.

이 audience 모델은 **기존 코드에 없는 cross-cutting 계약**이다:

- **`RolesGuard`/`@Roles`**([src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) / [roles.decorator.ts](../../src/auth/roles.decorator.ts)) — `ROLE_HIERARCHY`(SuperAdmin ⊇ Admin ⊇ User) escalation 매핑으로 **role tier 검사만** 제공한다. "자기 instance" scoping 개념이 없다 — guard 는 미인증 시 401, role 부족 시 403 throw 하나 instance 단위 row-level 필터는 책임 밖.
- **`JwtPayload`**([src/auth/auth.service.ts](../../src/auth/auth.service.ts) L36~42) — `sub`(userId) + `role`(String literal) **2 claim 만** 보유한다. 사용자를 어느 instance 에 묶는 binding(어느 GitHub host / Confluence baseUrl 을 운영하는가)이 **없다**.
- **`PermissionDeniedRecord.instanceRef`**([ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md)) — GitHub configured host(예: `github.sec.samsung.net`) / Confluence 풀 REST base URL(예: `https://acme.atlassian.net/wiki/rest/api`)의 **free-form 문자열**이다. "사용자 identity → 허용 instance 집합" 매핑 규칙이 미정의다.

따라서 Q-0020 recommendation 대로 **controller 코드보다 먼저 ADR 로 audience/필터 계약을 박제**한다([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md) ADR-first 패턴 mirror) — reviewer 가 구현 전 계약을 점검하고 후속 controller slice 가 단일 source 를 mirror 하도록. 본 task 는 ADR doc + INDEX 1 row 만 — production code 0.

### REQ 외력

- **REQ-016** ([README.md](../../README.md) L33) — 권한 부족의 **user/admin audience 분리**. 본 ADR 이 그 분리를 audit 조회 경로의 RBAC scope(Admin 전체 vs non-Admin 자기 instance)로 매핑한다. [ADR-0022 §REQ 외력](ADR-0022-permission-denied-record-data-model.md)이 record 를 "audience 분리 view 의 data source" 로 박제했고, 본 ADR 이 그 view 의 조회 audience 계약을 박제한다.
- **REQ-044** ([README.md](../../README.md) L19~22, L33) — instance / SPACE 별 권한 분리 + 권한 거부 가시화. 본 ADR 의 조회 endpoint 가 그 "가시화" 를 운영자 조회 경로로 완성한다 — record 영속화([ADR-0022](ADR-0022-permission-denied-record-data-model.md))는 audit 를 저장만 했고, 본 endpoint 가 instance 별 권한 분리를 조회 측에서 강제한다.

### 기존 RBAC stack (본 ADR 이 따를 source)

- **controller RBAC 패턴** — [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + service raw forward + NestJS 자동 4xx 매핑의 controller 골격을 박제했다. 후속 controller slice 가 이 패턴을 mirror 한다.
- **`@CurrentUser()`** — [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) 가 `req.user`(JwtStrategy 박제 `JwtPayload`)를 controller param 으로 추출한다. 본 ADR 의 actor identity 추출이 이를 재사용한다.
- **service / repository 필터** — [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) `list(query?)` + [permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) `findMany(filter?)` 가 instanceRef / provider / httpStatus 필터 + createdAt desc 를 제공한다. 본 ADR 이 own-instance scoping 을 이 기존 필터 위에 어떻게 얹을지 결정한다.

### ADR cross-reference

- **다음 free 번호 ADR-0023** — `docs/decisions/` 에 ADR-0001 ~ ADR-0022 점유(ADR-0007 만 미신설). 본 ADR 은 다음 free 번호 ADR-0023 을 사용.
- **[ADR-0022](ADR-0022-permission-denied-record-data-model.md)** — record 데이터 모델 source. 본 ADR 은 그 entity 위의 **조회 audience 계약만** 추가 박제하며 instanceRef / provider / principal 정의를 **재결정하지 않는다**(데이터 모델 변경 0).
- **[ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)** — ADR-first TEMPLATE(Decision enumerated section / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 task chain 구조 mirror).
- **[ADR-0008](ADR-0008-auth-credential-type.md)** — JWT / `JwtPayload`(`sub`+`role`) claim 계약 source. 본 ADR 의 Decision §2 가 instance-binding claim 확장 필요성을 경계 박제하되 **JwtPayload 를 본 slice 에서 확장하지 않는다**(별도 선행 ADR 여지).

## Decision

본 ADR 은 다음 5 결정을 박제한다. **본 ADR 은 audience/필터 계약을 기술하되 controller / own-instance 필터 / 신규 guard / RBAC 결선 코드는 신설/변경하지 않는다(production code 0 LOC — 후속 controller slice 책임). `JwtPayload` 확장도 본 ADR 범위 밖(Decision §2 가 필요성만 경계 박제).**

### Decision §1 — audience 모델 (누가 무엇을 읽는가)

audit 조회의 audience 를 3 tier 로 박제한다([README.md](../../README.md) REQ-016 user/admin 분리 매핑):

| actor | 조회 범위 | 근거 |
| --- | --- | --- |
| **미인증 (no JWT)** | 401 — 조회 불가 | `JwtAuthGuard` 가 차단. audit 는 운영 정보라 익명 노출 0. |
| **Admin / SuperAdmin** | **전체 record (bypass)** | `ROLE_HIERARCHY` 상 Admin 이상은 전 instance audit 를 본다 — 운영 전반의 권한 거부 가시성(REQ-044). instance 필터 우회(Decision §3). |
| **non-Admin authenticated (User)** | **자기 instance 범위 record 만** | REQ-016 user audience — 운영자는 자기가 운영하는 instance 의 거부 이력만. own-instance 필터(Decision §2/§3) 강제 주입. |

**instance binding 부재 fallback (명시 채택)** — non-Admin authenticated 이나 사용자의 **허용 instance 집합이 비어 있으면(binding 부재)** → **빈 결과(200 빈 배열)** 를 반환한다(403 아님). 사유: (i) authenticated 사용자는 endpoint 접근 권한 자체는 있다(role tier 통과) — 403 은 role 부적합 신호라 의미 혼동, (ii) "허용 instance 0 개 → 매칭 record 0 개" 는 필터의 자연 결과(빈 where 매칭)라 빈 배열이 일관, (iii) audit 정보 노출 최소화(Decision §4) — 어느 instance 도 안 보이는 것과 동일. 이는 Decision §4 의 "타 instance = 빈-필터(보이지 않음)" 와 동형 trade-off.

### Decision §2 — "자기 instance" 판별 규칙

사용자 identity(`JwtPayload`)를 record `instanceRef`(GitHub host / Confluence baseUrl)에 매핑하는 규칙을 박제한다:

- **현 `JwtPayload`(`sub`+`role`)에 instance binding 부재 (명시)** — [src/auth/auth.service.ts](../../src/auth/auth.service.ts) L36~42 상 `JwtPayload` 는 `sub`(userId) + `role` 2 claim 만 보유한다. "이 사용자가 어느 instance 를 운영하는가" 를 도출할 claim 이 없다. 따라서 own-instance 필터를 **현 JwtPayload 만으로 도출할 수 없다**.
- **(a) 매핑 데이터 source 결정 — User entity 의 instance 연계 (allowed instance set)** — 사용자 → 허용 instance 집합 매핑은 **User entity(또는 User↔instance 연계 테이블)에 보유하는 allowed-instance 데이터** 를 source 로 한다. controller 가 `@CurrentUser("sub")` 로 userId 를 받아 그 사용자의 허용 instance 집합(`instanceRef[]`)을 조회하고, 그 집합으로 `findMany` 의 `instanceRef in (...)` 필터를 강제 주입한다(Decision §3). JWT claim 에 instance 를 싣지 않고 server-side lookup 으로 도출하는 이유: (i) claim 비대화 회피, (ii) instance 권한 변경 시 토큰 재발급 불요(server-side 최신값 반영), (iii) JwtPayload 확장(별도 ADR/migration) 회피.
- **(b) 그 source 가 현 schema 에 부재 — 별도 선행 task 경계 (명시)** — **현 `User` entity 에는 instance 연계 컬럼/테이블이 존재하지 않는다**. 따라서 own-instance 필터의 실 결선은 **선행 schema 확장(User↔instance allowed-set 컬럼/테이블 + migration)을 요구**한다. 이는 [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 대상이므로 **별도 선행 task/ADR 로 박제**한다(본 ADR 의 후속 chain 에 선행 task 로 나열). 본 controller slice 는 그 선행 task 머지 후 own-instance 필터를 결선한다 — **JwtPayload 를 본 slice 에서 확장하지 않는다**(Decision §2 결론: server-side User lookup, claim 확장 회피).
- **free-form `instanceRef` 매칭 경계 — exact match (명시 채택)** — `instanceRef` 문자열 매칭은 **exact match**(허용 집합의 정규화된 instanceRef 와 record 의 instanceRef 가 정확히 일치)로 한다(prefix / substring 아님). 사유: (i) prefix 매칭은 `github.sec.samsung.net` 이 `github.sec.samsung.net.evil.com` 류를 의도치 않게 포함할 host-spoofing risk, (ii) record 의 instanceRef 는 adapter 가 박제한 정규화된 configured host / 풀 base URL([ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md))이라 exact 비교가 정확, (iii) [ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 의 same-host strict equal(subdomain 불허) 정합. 매칭 정규화(case / trailing slash)는 후속 slice 가 source 박제 시 확정.

### Decision §3 — Admin bypass 경로 + own-instance 필터 layer

- **Admin bypass (명시) — `ROLE_HIERARCHY` escalation 재사용** — Admin / SuperAdmin actor 는 own-instance 필터를 **우회해 전체 조회** 한다. 기존 `RolesGuard` 의 `ROLE_HIERARCHY`(Admin ⊇ User)를 재사용해 actor.role 이 Admin escalation 에 속하면 bypass 분기. 신규 role 정의 0.
- **own-instance 필터 layer — service-layer actor-aware 분기 (명시 채택)** — non-Admin 의 own-instance 필터는 **service-layer 가 actor(role + 허용 instance 집합)로 분기** 해 얹는다. controller 는 `@CurrentUser()` 로 actor 를 추출해 service 에 **actor 를 명시 전달**하고, service 가 (i) actor.role 이 Admin 이상이면 필터 없이 `repository.findMany(query)` forward, (ii) non-Admin 이면 사용자의 허용 instance 집합으로 `instanceRef` 필터를 **강제 주입**해 forward. 사유:
  1. **단일 강제 지점** — own-instance 강제를 service 1 곳에 두면 우회 경로 0(controller 가 깜빡 누락해도 service 가 강제). controller-only 필터는 다른 호출자(향후 다른 controller / job)가 우회할 risk.
  2. **신규 guard 미신설** — instance scoping 은 row-level 필터(어느 row 를 보여줄지)라 guard(요청 차단 yes/no)의 책임 모델과 다르다. `RolesGuard` 는 role tier(401/403 throw)만 유지하고, instance 필터는 데이터 layer(service)에서. 신규 guard / interceptor **신설 안 함** — 새 외부 dependency 0.
  3. **기존 service signature 확장** — 현 `list(query?)` 를 actor-aware 하게 확장(예: `list(actor, query?)`)하는 것은 후속 slice 의 코드 변경(본 ADR 은 layer 결정만, signature 확정은 slice 책임). repository(`findMany`)는 actor 개념 없이 raw 필터만 — actor → 필터 변환은 service 책임.

### Decision §4 — 401 / 403 / 빈결과 응답 경계

audit 조회의 응답 경계를 박제한다:

| 상황 | 응답 | 사유 |
| --- | --- | --- |
| **미인증 (JWT 부재/무효)** | **401** | `JwtAuthGuard` 가 차단(인증 부재). |
| **authenticated 이나 role 부적합** | **403** | `RolesGuard` 가 차단 — 단 본 endpoint 는 `@Roles("User")`(User 이상 모두 허용)라 authenticated 면 role 게이트는 통과(Decision §5). 403 은 향후 endpoint 가 더 높은 tier 를 요구할 때의 경계로 박제. |
| **authorized 이나 타 instance record 접근** | **빈-필터 (보이지 않음, 200)** | **403 아님** — 타 instance record 는 own-instance 필터에서 where 매칭 0 이라 **결과에 안 나타난다**(빈 배열 또는 자기 instance 만). |
| **authorized 이나 매칭 record 0** | **200 빈 배열** | 컬렉션 조회의 정상 결과(404 변환 0, [service.list](../../src/permission-denied/permission-denied-record.service.ts) 정합). |

**"타 instance record 접근" = 403 vs 빈-필터 결정 → 빈-필터 채택 (명시 + 사유)** — non-Admin 이 타 instance record 를 보려 해도 **403 이 아니라 그냥 안 보인다(빈-필터)**. 사유(audit 정보 노출 최소화 trade-off): (i) 403 은 "그 instance record 가 존재한다" 는 사실 자체를 노출한다 — audit enumeration 측면에서 정보 누출. 빈-필터는 존재 여부조차 비노출, (ii) own-instance 필터는 where 절 강제 주입이라 타 instance row 가 애초에 query 결과에 포함되지 않는다 — "차단" 이 아니라 "범위 밖", (iii) [ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 의 "정보 노출 최소화" invariant 정합. trade-off: 사용자가 "왜 안 보이는지" 명시 신호(403)를 못 받는다 — 그러나 audit 노출 최소화가 우선.

### Decision §5 — endpoint shape

- **경로 (확정)** — `GET /api/permission-denied-records`. 컬렉션 조회 REST 관례(복수형 명사 + GET) 정합.
- **query param** — 기존 `PermissionDeniedRecordFilter`([repository](../../src/permission-denied/permission-denied-record.repository.ts)) 위: `instanceRef` / `provider`(`github`/`confluence`) / `httpStatus`. non-Admin 의 경우 사용자 제공 `instanceRef` 는 **허용 instance 집합과 교집합**으로 좁혀진다(service 가 own-instance 필터를 사용자 필터 위에 AND, Decision §3) — 사용자가 타 instance 를 query param 으로 지정해도 빈-필터(Decision §4).
- **응답 shape** — record view(`provider` / `instanceRef` / `resourceRef` / `principal` / `httpStatus` / `reason` / `createdAt`). **redaction 불요** — record schema 에 token / secret 컬럼 자체가 부재([ADR-0022 §1](ADR-0022-permission-denied-record-data-model.md) schema-level secret-at-rest)라 그대로 노출해도 평문 token 누출 0. 정렬 createdAt desc(repository 고정).
- **RBAC stack** — `@UseGuards(JwtAuthGuard, RolesGuard)` + **`@Roles("User")`**(User 이상 모두 허용 — authenticated 면 endpoint 접근, audience 차등은 service-layer own-instance 필터로, Decision §3). [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) RBAC stack mirror. **dependency 0** — 기존 NestJS controller + auth stack(`JwtAuthGuard` / `RolesGuard` / `@CurrentUser`) 재사용, 새 외부 package 0.

## Consequences

### 양의 (positive)

1. **ADR-first 로 reviewer 선행 점검** — controller 코드 전에 audience / instance-scoping / 응답 경계를 reviewer 가 점검 → 후속 controller slice 가 단일 source 를 mirror, 설계 divergence 0([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)/[ADR-0022](ADR-0022-permission-denied-record-data-model.md) ADR-first 패턴 정합).
2. **dependency-free** — Decision §5 가 기존 NestJS controller + auth stack 재사용을 박제 → 후속 slice 가 `pnpm add` 0 / 외부 credential 0 으로 진입([CLAUDE.md §5](../../CLAUDE.md) security 게이트 Q-0020 충족).
3. **REQ-016 audience 완성** — Admin 전체 / non-Admin 자기 instance 분리가 권한 거부 가시화(REQ-044)의 user/admin audience(REQ-016)를 조회 경로에서 완성한다.
4. **단일 강제 지점** — Decision §3 의 service-layer own-instance 필터가 우회 경로 0(controller 누락에도 service 강제) → audit 격리 신뢰성.
5. **audit 노출 최소화** — Decision §4 의 빈-필터(403 아님)가 타 instance record 의 존재 여부조차 비노출 → enumeration 누출 0([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 정보 노출 최소화 정합).
6. **JwtPayload 비확장** — Decision §2 의 server-side User lookup 이 claim 비대화 / 토큰 재발급 cost / JwtPayload 확장 ADR 을 회피.

### 음의 (negative) / trade-off

1. **instance-binding schema 선행 cost** — Decision §2 (b) 상 현 `User` entity 에 instance 연계가 부재해 own-instance 필터의 실 결선이 **선행 schema 확장(migration, [CLAUDE.md §5](../../CLAUDE.md) 게이트)을 요구**한다. mitigation: 후속 chain 에 선행 task 로 박제 — controller slice 는 그 머지 후 진입. binding 부재 동안 non-Admin 은 빈 결과(Decision §1 fallback)라 endpoint 자체는 Admin-only 로 먼저 동작 가능.
2. **own-instance 필터 정확도(exact match)** — Decision §2 의 exact match 가 host alias / 동일 instance 의 표기 변형(trailing slash / case)을 다른 instance 로 오인할 risk. mitigation: 매칭 전 정규화(case / trailing slash)를 후속 slice 가 source 박제 시 확정 — record 의 instanceRef 가 adapter 정규화값이라 변형 표면이 작음.
3. **빈-필터 trade-off(명시 신호 부재)** — Decision §4 상 non-Admin 이 타 instance 를 query 해도 403 명시 신호 없이 빈 결과 → "왜 안 보이는지" 사용자 혼동 가능. mitigation: audit 노출 최소화가 우선 trade-off(존재 노출 회피), 운영 문서로 audience 규칙 안내.
4. **service signature 확장 파급** — Decision §3 상 `list(query?)` → actor-aware `list(actor, query?)` 확장이 기존 호출자(있으면)에 파급. mitigation: 현 `list` 호출자는 service-internal 뿐이라 파급 표면이 작음 — 후속 slice 가 signature 확정 시 호출부 동기.

### 후속 task chain

본 ADR(doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md)(ADR + 코드 split) 정합. **본 task 에서 큐잉하지 않음**(planner 1-task 원칙 — Follow-ups 에 나열만):

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **(선행, 조건부) User↔instance binding schema** | `User` entity(또는 User↔instance 연계 테이블)에 allowed-instance 컬럼/테이블 추가 + migration(Decision §2 (b)). [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 **재확인**(Q-0019 는 PermissionDeniedRecord migration 만 승인 — instance-binding 은 별도 게이트). | 본 ADR-0023 머지 후 | **§5 DB schema 게이트 재발화 가능** — binding 컬럼/테이블이 새 schema 라 사용자 승인 필요 |
| **audit 조회 controller slice** | `GET /api/permission-denied-records` controller 신설 + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`(Decision §5) + Admin bypass / non-Admin own-instance 필터(Decision §3 service-layer actor-aware 분기) + `list(actor, query?)` service signature 확장 + **R-112 4종 + negative cases 충분 cover** | binding schema 후(non-Admin 필터 결선 시) — 또는 Admin-only 부분 동작은 binding 전 가능 | dependency-free(코드), 단 non-Admin 결선은 binding 선행 |
| **R-112 test block (controller slice 동반)** | happy(Admin 전체 / User 자기 instance) + error + flow + **negative**: 타 instance record 접근 차단(빈-필터) / non-Admin Admin-scope 차단 / 빈 결과(200 빈 배열) / 미인증 401 / 경계 instance 식별자(exact-match 경계) **각 1+** | controller slice 와 동일 PR | 없음 |

> **R-112 4종 + negative-case test 는 본 ADR(코드 symbol 0)에 적용 대상이 아니다** — 위 controller slice PR 로 **명시 deferred**. 본 ADR-0023 task 는 계약 결정 + INDEX row 만(production code 0 / spec 0).

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) Admin 전체 + non-Admin own-instance(service-layer 필터, exact match, 타 instance = 빈-필터, JwtPayload 비확장 server-side lookup)** (채택) | REQ-016 audience 완성 / dependency-free / 단일 강제 지점(service) / audit 노출 최소화 / JwtPayload 비확장 / ADR-first reviewer 선행 점검 | instance-binding schema 선행 cost / exact-match 정확도 / 빈-필터 명시 신호 부재 | **✓ 채택** (Q-0020 RBAC=Admin+자기 instance 결정 + 현 auth stack 직접 정합) |
| **(b) Admin-only 단순화 (non-Admin 조회 불가, 403)** | instance-binding schema 불요 / 구현 단순 | Q-0020 결정(Admin **+ 자기 instance**) 정면 위배 — non-Admin 운영자의 자기 instance 가시성(REQ-016 user audience) 소실 / 운영자가 자기 거부 이력도 못 봄 | 기각 — Q-0020 RBAC scope 미준수 |
| **(c) own-instance 필터를 controller-layer 에서 처리** | guard/service 변경 최소(controller 단일 위치) | 다른 호출자(향후 controller / job)가 service 직접 호출 시 필터 우회 → audit 격리 누출 / 강제 지점 분산 | 기각 — service-layer 단일 강제가 우회 0(Decision §3) |
| **(d) 타 instance 접근 시 403 (빈-필터 대신 명시 거부)** | 사용자에게 "권한 없음" 명시 신호 | record **존재 자체를 403 으로 노출** → audit enumeration 정보 누출 / own-instance 는 "범위 밖" 이지 "차단" 이 아님([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 노출 최소화 위배) | 기각 — 빈-필터가 노출 최소화 정합(Decision §4) |
| **(e) JwtPayload 에 instance claim 확장 (토큰에 allowed-instance 박제)** | server-side lookup 불요(claim 으로 즉시 도출) | JwtPayload 확장은 별도 ADR/migration([ADR-0008](ADR-0008-auth-credential-type.md) amendment) / claim 비대화 / instance 권한 변경 시 토큰 재발급 필요 / 본 slice 범위 확대 | 기각 — server-side User lookup 이 claim 비확장(Decision §2), 확장은 별도 ADR 여지 |
| **(f) prefix / substring instanceRef 매칭** | host alias / 하위 경로 유연 매칭 | `github.sec.samsung.net` 이 `...evil.com` 류 포함 host-spoofing risk / record instanceRef 가 정규화값이라 prefix 불요 | 기각 — exact match 가 spoofing 차단([ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) strict equal 정합) |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) instance-binding schema 가 비대해지면(다대다 권한 모델) 별도 RBAC ADR. (ii) audit 조회가 instance enumeration 공격 대상이 되면 rate-limit / audit-of-audit ADR. (iii) JwtPayload 에 instance claim 이 다른 use-case 로도 필요해지면 [ADR-0008](ADR-0008-auth-credential-type.md) amendment 로 claim 확장 재검토(§(e)).

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0020]` — audit 조회 HTTP endpoint 승인(RBAC scope=Admin+자기 instance / dependency 0 / credential 0 / §5 security 게이트 충족) — 본 ADR 의 직접 motivation
- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](ADR-0022-permission-denied-record-data-model.md) — PermissionDeniedRecord 데이터 모델(instanceRef / provider / principal / secret-at-rest schema-level) — 본 ADR 이 그 entity 위 조회 audience 계약 추가(데이터 모델 재결정 0)
- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](ADR-0021-github-confluence-live-integration-test-contract.md) — ADR-first TEMPLATE(Decision enumerated / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 chain 구조 mirror)
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](ADR-0019-same-host-auth-restriction-for-pagination.md) — strict equal(subdomain 불허) + 정보 노출 최소화 invariant(Decision §2 exact match / Decision §4 빈-필터 정합)
- [docs/decisions/ADR-0008-auth-credential-type.md](ADR-0008-auth-credential-type.md) — JWT / JwtPayload(`sub`+`role`) claim 계약(Decision §2 claim 비확장 경계)
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) / [roles.decorator.ts](../../src/auth/roles.decorator.ts) — `ROLE_HIERARCHY` escalation + 401/403 throw 위상(Decision §1/§3/§4 정합 source)
- [src/auth/auth.service.ts](../../src/auth/auth.service.ts) L36~42 / [current-user.decorator.ts](../../src/auth/current-user.decorator.ts) — `JwtPayload`(`sub`+`role`) + `@CurrentUser()` 추출(Decision §2 instance binding 부재 근거)
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — controller RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles`) mirror 대상(Decision §5)
- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) / [permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) — 기존 `list(query?)` / `findMany(filter?)` 필터(Decision §3 own-instance 필터 layer 근거)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상(본 ADR-0023 row)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다"(ADR-first split 정당화) / [§3.1 rule 4](../../CLAUDE.md) 새 ADR = pr-mode / [§5](../../CLAUDE.md) security(auth) 게이트(Q-0020 충족) / [§9](../../CLAUDE.md) secret 미기재

Refs: T-0213, Q-0020, ADR-0008, ADR-0019, ADR-0021, ADR-0022, REQ-016, REQ-044

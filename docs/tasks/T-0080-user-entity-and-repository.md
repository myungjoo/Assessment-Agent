---
id: T-0080
title: User entity Prisma 박제 + UserRepository (create + findByEmail) — ADR-0008 후속 chain 첫 task
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-044]
estimatedDiff: 280
actualDiff: 353
estimatedFiles: 5
actualFiles: 4
sizeExempt: true
exemptReason: R-112 4-카테고리 backbone (entity Prisma model + migration.sql + UserRepository + repository spec) × 1.5 multiplier + P2002 sub-multiplier × 1.2 (User.email `@unique` 박제로 unique constraint 분기 spec 추가 의무) = effective × 1.8. 단 본 task scope = create + findByEmail 의 **2 메서드만** (full CRUD 가 아닌 AuthModule consumption-driven minimal surface — PersonRepository 의 6 메서드 precedent 대비 1/3 scope). base ~155 LOC × 1.8 = ~280 LOC envelope. T-0069 (Part.name @unique P2002 분기 추가 effective × 1.8 첫 사용 -10% accurate-pass) precedent 정합. split 시 schema/migration 과 repository/spec 의 의존성이 1 commit 안에서 자연 — Prisma generate 후 type 이 repository import 필요.
estimateOutcome: +26% over (envelope 280 actual 353 — R-112 × 1.5 × P2002 × 1.2 = effective × 1.8 패턴 2 회차 누적 / T-0069 -10% accurate-pass + 본 T-0080 +26% over → range 36pp). User.role 컬럼 + spec 변종 3 종 (role 변종) 이 envelope 추가 — role 컬럼은 ADR-0008 후속 T-0083 RBAC chain 의 prerequisite, scope 자연 확장.
completedAt: 2026-05-28T01:44:00+09:00
dependsOn: [T-0079, T-0036, T-0039]
prNumber: 72
prUrl: https://github.com/myungjoo/Assessment-Agent/pull/72
mergedAs: 881cc51
reviewRounds: 1
plannerNote: ADR-0008 후속 chain 첫 task — User entity Prisma + UserRepository (create + findByEmail) backbone, Person 1:1 mirror 패턴, R-112 × 1.5 × 1.2 P2002 sub = × 1.8 effective, dep install 0 (bcrypt 는 T-0081 deferred — hashedPassword 컬럼은 String 박제, hashing 책임은 AuthService layer), BLOCKED risk 0.
---

# T-0080 — User entity Prisma 박제 + UserRepository (ADR-0008 후속 chain 첫 task)

## Why

[docs/decisions/ADR-0008-auth-credential-type.md §6 후속 task chain](../decisions/ADR-0008-auth-credential-type.md) 박제 — ADR-0008 머지 직후 자연 progression 의 **첫 task**. ADR-0008 §6 표가 T-0080 = "User entity + UserRole + Prisma model + repository / dependency 없음 / BLOCKED risk 없음" 박제. 본 task 는 AuthModule scaffold (T-0081, **새 dep install BLOCKED 게이트**) 의 prerequisite — User row 존재 없이 login endpoint 신설 불가.

[docs/architecture/data-model.md §2 row "User"](../architecture/data-model.md) — "로그인 계정 (서비스 사용자). 등급 SuperAdmin / Admin / User. Person 과 conceptual 분리 — User 는 시스템 인증 식별자, Person 은 평가 대상자". cover REQ-043 (ID/Password) + REQ-044 (3 등급 + SuperAdmin 첫 로긴 + self-demote 차단). [docs/architecture/data-model.md §3 관계 7 (User ↔ Person 0..1:0..1)](../architecture/data-model.md) — 선택적 매핑, AuthModule 책임으로 deferred (본 task 의 Out of Scope).

[docs/architecture/p3-to-p4-transition.md §2.6](../architecture/p3-to-p4-transition.md) — entity backbone 8/11 fully closed (Group + Part CRUD-U 4-layer) → 본 task 머지 시 **9/11 backbone** 진척. REQ-043 + REQ-044 의 schema-level 기반 박제 = AuthModule 의사결정 backbone 의 마지막 missing piece.

[CLAUDE.md §5](../../CLAUDE.md) HITL 정합 — 본 task 안에서 **새 외부 dependency 추가 0** (Prisma 이미 박제 T-0033, `bcrypt`/`argon2` 같은 password hashing lib 는 T-0081 의 AuthModule scaffold 와 함께 BLOCKED 게이트 발화). `hashedPassword` 컬럼은 단순 `String` 으로 박제 — hashing 로직 자체는 AuthService 책임 (T-0081), 본 repository 는 raw row CRUD primitive 만.

본 task scope **narrow** — `create` + `findByEmail` **2 메서드만** (AuthModule consumption-driven minimal surface). PersonRepository 의 6 메서드 (findMany/findById/create/update/softDelete/restore) 전부 박제 안 함 — 후속 task (T-0082 endpoint 시점) 에서 필요한 메서드만 점진 추가 (CRUD-U full chain 의 자연 progression 패턴).

## Required Reading

- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) §6 후속 task chain (본 task 의 dependency / scope 박제 source).
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) Decision §5 (환경변수 박제) — User 의 `hashedPassword` 컬럼이 향후 `AUTH_JWT_SECRET` 으로 sign 되는 JWT payload 의 `sub` 의 source.
- [prisma/schema.prisma](../../prisma/schema.prisma) L36-83 (Person model) + L84-97 (Group model) + L99-114 (Part model) — entity 박제 정공법 (id cuid / createdAt / updatedAt / @unique 패턴) precedent.
- [prisma/migrations/20260526000000_group_part/migration.sql](../../prisma/migrations/20260526000000_group_part/migration.sql) — 최근 migration 파일 format precedent (`CREATE TABLE` + PK constraint + `@unique` index 박제 패턴).
- [src/user/person.repository.ts](../../src/user/person.repository.ts) L1-60 (헤더 + create primitive) — UserRepository 의 1:1 mirror precedent. **`PrismaService` 의 delegate forwarding 패턴**.
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — R-112 4 카테고리 (happy / error / branch / negative) 박제 패턴 precedent.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — colocated spec 의 shared mock helper (PrismaService 의 jest mock factory).
- [docs/architecture/data-model.md §2 row "User"](../architecture/data-model.md) — User entity 의 conceptual 정의 source.
- [docs/architecture/data-model.md §3 관계 7](../architecture/data-model.md) — User ↔ Person 0..1:0..1 (선택적 매핑, **본 task 의 Out of Scope**).
- [docs/architecture/modules.md](../architecture/modules.md) AuthModule row — User entity 의 책임 module 매핑.
- [CLAUDE.md §3.2 R-112](../../CLAUDE.md) — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80%.
- [CLAUDE.md §5](../../CLAUDE.md) — 새 외부 dependency 추가 BLOCKED 게이트 (본 task 의 dep install 0 박제 정당화).
- [docs/architecture/estimate-model.md §3.2](../architecture/estimate-model.md) — R-112 backbone × 1.5 + P2002 × 1.2 sub-multiplier (User.email @unique 분기) 박제.
- [docs/tasks/T-0069-part-update-dto-and-repository.md](T-0069-part-update-dto-and-repository.md) — P2002 sub-multiplier × 1.8 effective 첫 사용 precedent.

## Acceptance Criteria

### A. `prisma/schema.prisma` 의 User model 신설

- [ ] `User` model 1 개 추가 — 컬럼: `id String @id @default(cuid())`, `email String @unique` (REQ-043 의 로그인 identifier), `hashedPassword String` (raw String — hashing logic 자체는 T-0081 AuthService 책임), `role String` (enum 도입 보류, "SuperAdmin"/"Admin"/"User" string literal 박제 — Prisma enum 도입은 별도 ADR 발화 회피 / 단순 string + service-layer validate 패턴 = Person model 의 정공법 정합), `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
- [ ] **Person 과의 관계는 본 task 의 Out of Scope** — `User ↔ Person 0..1:0..1` relation 필드 0 (data-model.md §3 관계 7 의 AuthModule 책임 deferral 정합). 향후 추가 시 별도 task.
- [ ] schema 파일 안에 model 위 주석 박제 — model 의 책임 / cascade 정책 / role 의 string literal 박제 / hashedPassword 의 hashing layer 분리 의도 / Person relation 의 Out of Scope marker (PersonRepository / Group / Part model 의 주석 정공법 정합).
- [ ] `pnpm exec prisma format` 통과 (schema syntax 검증).
- [ ] `pnpm exec prisma generate` 가 PrismaClient 의 `User` delegate type 생성 (`@prisma/client` 에서 `User` import 가능).

### B. Prisma migration 파일 신설

- [ ] `prisma/migrations/20260528000000_user/migration.sql` 신설. naming convention = `YYYYMMDDhhmmss_<label>` (기존 `20260525000000_init` / `20260525000001_service_identity` / `20260526000000_group_part` precedent 정합).
- [ ] migration.sql 내용 — `CREATE TABLE "User"` + PK constraint + `email @unique` index. `prisma/migrations/20260526000000_group_part/migration.sql` format 1:1 mirror.
- [ ] `pnpm exec prisma migrate dev --name user --create-only` 명령으로 생성 (실 DB apply 는 CI / 사용자 환경 책임, 본 task 는 migration 파일 박제만).
- [ ] migration 파일 안에 SQL comment 0 — Prisma 의 auto-generate 결과 1:1 박제 (수정 0 = drift 0 invariant).

### C. `src/user/user.repository.ts` 신설 — create + findByEmail 2 메서드만

- [ ] `UserRepository` class — `@Injectable()` decorator + constructor `(private readonly prisma: PrismaService)`.
- [ ] `create(input: UserCreateInput): Promise<User>` — `this.prisma.user.create({ data: input })` 의 1:1 forwarding. `UserCreateInput` interface = `{ email: string; hashedPassword: string; role: string }` (signature 의 source 는 본 repository 파일에 export, T-0081 AuthService 가 직접 import).
- [ ] `findByEmail(email: string): Promise<User | null>` — `this.prisma.user.findUnique({ where: { email } })` 의 1:1 forwarding. null-safe (row 부재 시 null 반환, throw 0).
- [ ] 파일 헤더 주석 박제 — PersonRepository 의 헤더 정공법 (책임 경계 / Prisma error 정책 / 본 layer 가 invariant 검증 안 함 명시) 정합. **본 task scope = create + findByEmail 2 메서드만, 후속 task 가 update / softDelete / role 갱신 등 점진 추가** 명시.
- [ ] Prisma error 정책 박제 — `P2002` (email unique constraint 위반 시) 가 그대로 propagate (catch 0 — caller 책임). PersonRepository L19-24 정공법 정합.

### D. `src/user/user.repository.spec.ts` 신설 — colocated, R-112 4 카테고리 충분 cover

R-112 의 happy / error / branch / negative + P2002 분기 cover 의무.

- [ ] **`create` happy-path** — 정상 input (email + hashedPassword + role) 에서 PrismaService 의 mock 이 expect 된 인자로 호출 + return 된 User row 가 그대로 반환.
- [ ] **`create` P2002 error path (negative case 1)** — 동일 email 의 두 번째 create 시도 시 PrismaService mock 이 `P2002` (PrismaClientKnownRequestError) throw → UserRepository 가 그대로 propagate (catch 0 검증). User.email @unique invariant 의 schema-level cover.
- [ ] **`create` negative case 2** — PrismaService 의 mock 이 generic error throw 시 그대로 propagate.
- [ ] **`create` branch — role enum value 변종 3 종 happy** — "SuperAdmin" / "Admin" / "User" 각 1 회 호출 → 모두 PrismaService mock 으로 그대로 forwarding (role 값 invariant 검증은 service-layer 책임 — 본 layer 는 forward 만).
- [ ] **`findByEmail` happy-path** — 존재하는 email 로 호출 시 PrismaService mock 이 User row 반환 + repository 가 그대로 반환.
- [ ] **`findByEmail` null branch (negative case 3)** — 부재 email 로 호출 시 PrismaService mock 이 null 반환 + repository 가 null 반환 (throw 0, null-safe API 검증).
- [ ] **`findByEmail` negative case 4** — empty string email 으로 호출 시 PrismaService mock 으로 forwarding (input validation 은 service-layer 책임). 호출 인자만 검증.
- [ ] spec 위치 = `src/user/user.repository.spec.ts` **colocated** (R-112 colocated-spec ordering hint 의 default 정합). shared PrismaService mock 은 `test/helpers/prisma-mock.ts` (T-0047 박제) import.
- [ ] `pnpm test src/user/user.repository.spec.ts` 통과.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (R-112 coverage threshold).

### E. 전 layer CI green (R-110 + R-111 + R-113 + R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과 (TypeScript strict, PrismaClient 의 User delegate type import resolve).
- [ ] `pnpm test` 통과 (unit, 본 task spec 포함 전 spec green).
- [ ] `pnpm test:cov` 통과 (coverage threshold).
- [ ] `pnpm test:smoke` 통과 (기존 smoke spec 이 User 박제 후에도 회귀 0 — User 신설 자체는 smoke scope 외, 단순 회귀 검증).
- [ ] `pnpm test:e2e` 통과 (기존 e2e spec — Person/Group/Part endpoint 회귀 0).

### F. 4-게이트 + PR housekeeping

- [ ] feature branch `claude/T-0080-user-entity-and-repository` push (`source=feature, target=feature` hard rule).
- [ ] PR open — title 한국어 ("User entity Prisma 박제 + UserRepository (T-0080) — ADR-0008 후속 chain 첫 task") + body 한국어 (T-0080 link + Acceptance checklist + 본 task 의 dep 0 invariant 박제).
- [ ] reviewer round 1 dispatch — 8-check 박제, **special check 항목**: (i) schema.prisma User model 의 `@unique` 박제 검증, (ii) UserRepository scope = create + findByEmail 2 메서드만 검증 (update / softDelete 등 추가 박제 시 scope-creep finding), (iii) bcrypt / argon2 등 password hashing lib import 0 검증 (T-0081 deferral 정합).
- [ ] reviewer VERDICT=APPROVE + PR comment 외부 post (게이트 #2).
- [ ] integrator self-check 6/6.
- [ ] CI 6-step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-gate) 전부 green (게이트 #4).
- [ ] 4-게이트 all PASS 시 `gh pr merge --squash --delete-branch` 또는 `mcp__github__merge_pull_request` (ADR-0005 Path A 정합).

## Out of Scope

- **`@nestjs/jwt` / `@nestjs/passport` / `passport-jwt` install** — T-0081 의 책임 (BLOCKED 게이트 발화 task). 본 task 는 `package.json` 변경 0 / lockfile 변경 0.
- **`bcrypt` / `argon2` install** — password hashing lib 도 T-0081 (또는 별도 BLOCKED 게이트 task) 의 책임. 본 task 의 `hashedPassword` 컬럼은 raw String 박제만, hashing logic 자체는 AuthService layer.
- **`AuthModule` / `AuthService` / `AuthController` / `JwtStrategy` / `JwtAuthGuard` / `RolesGuard` scaffold** — T-0081 의 책임.
- **`POST /api/auth/login` / `POST /api/auth/logout` / `POST /api/auth/refresh` / `GET /api/me` endpoint** — T-0082 의 책임.
- **RBAC self-demote invariant (REQ-044 본인 Admin→User 차단)** — T-0083 의 책임.
- **User ↔ Person 0..1:0..1 relation 필드** — data-model.md §3 관계 7 의 AuthModule 책임 deferral 정합. 향후 별도 task.
- **UserRole entity 분리 / role enum table 격상** — 현 박제는 단순 string literal (Person model 의 정공법 정합). enum 격상 시 별도 ADR 발화 의무.
- **User CRUD-U full chain (update / softDelete / restore / findMany / findById)** — 후속 task 가 AuthModule consumption 시점에 점진 추가. 본 task = create + findByEmail 2 메서드만.
- **RefreshToken table 박제** — ADR-0008 Decision §3 의 refresh rotation backbone 이 후속 schema 추가 task 의 책임.
- **SuperAdmin 첫 로긴 자동 박제 seed** — T-0082 (login endpoint) 또는 별도 seed task 의 책임.
- **e2e spec for User endpoint** — endpoint 자체가 T-0082 책임이므로 본 task 의 e2e scope 0.

## Suggested Sub-agents

`architect (skip) → implementer → tester → reviewer → integrator`

- **architect**: skip — ADR-0008 가 결정 박제 source, 본 task 는 ADR 의 후속 task 첫 단계로 결정 추가 없음. Person/Group/Part 박제 precedent + ADR-0008 §6 chain 박제로 implementer 가 직접 진행 가능.
- **implementer**: schema.prisma + migration.sql + user.repository.ts 3 파일 박제. Person model + PersonRepository 의 1:1 mirror.
- **tester**: user.repository.spec.ts 신설 (colocated) + `pnpm test:cov` 검증.
- **reviewer**: 8-check + special check 3 항목 (위 §F).
- **integrator**: 4-게이트 평가 + merge.

## Follow-ups

(none at creation)

---
id: T-0091
taskId: T-0091
title: auth-e2e-helper.ts 추출 — JWT issue + SuperAdmin/Admin/User 3종 token 발급 utility
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-057, REQ-058]
estimatedDiff: 260
estimatedFiles: 5
estimatedLoc: 260
dependsOn: [T-0090]
sizeExempt: false
created: 2026-05-29
createdAt: 2026-05-29T12:15:00+09:00
plannerNote: "T-0090 createE2EApp 위에 JWT issue + 3종 token 발급 helper 추출 — users.e2e inline 패턴 외화 + 후속 auth/signup e2e 의 선행 의존. partial-backbone × 1.3 envelope 260 LOC / 5 파일."
---

# T-0091 — auth-e2e-helper.ts 추출 (JWT issue + SuperAdmin/Admin/User 3종 token 발급 utility)

## Why

[T-0090](T-0090-e2e-app-factory-cookie-parser-helper.md) (MERGED `59d1a26`) 의 Follow-ups 첫 항목 — `test/helpers/e2e-app-factory.ts` 의 `createE2EApp()` 위에 쌓이는 **higher-level auth helper** 박제. 현재 [test/e2e/users.e2e-spec.ts L36 + L59-61 + L109](../../test/e2e/users.e2e-spec.ts) 에 `process.env.AUTH_JWT_SECRET = "test-auth-jwt-secret-e2e-users"` + `function issueAccessToken(jwt, sub, role)` + cookie 형식 (`access_token=<token>`) 셋팅이 **inline 박제**되어 있어, 후속 e2e (`auth.e2e-spec.ts` signup/login/logout/refresh flow, signup endpoint e2e, 향후 Admin-tier endpoint e2e 등) 신설 시 동일 패턴 N 회 복제 발생 위험 — single source of truth 박제 필요.

본 task 가 [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) 신설:

1. **`AUTH_JWT_SECRET` 단일 source 박제** — helper 가 `process.env.AUTH_JWT_SECRET` 의 셋업/검증을 hold (호출 측 spec 은 import 만으로 secret 박제).
2. **`createAuthenticatedE2EApp({ users: [{ role: "SuperAdmin" | "Admin" | "User", email? }] }) → { app, moduleRef, prisma, jwtService, tokens: { [email]: string }, users: { [email]: User } }`** — `createE2EApp()` 호출 + 지정된 user record(s) 의 실 DB seed (bcrypt hashed password) + 각 user 의 access_token 발급을 atomic 박제.
3. **`issueAccessTokenFor(jwtService, user)`** — single-shot helper. role claim + sub claim + 15m TTL 박제.
4. **`buildAuthCookie(token)`** — `${ACCESS_TOKEN_COOKIE}=${token}` 형식 박제 (cookie 형식 변경 시 1곳만 수정).

본 task 가 [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 의 inline `issueAccessToken` + `process.env.AUTH_JWT_SECRET` + `${ACCESS_TOKEN_COOKIE}=${token}` 패턴 → helper 호출로 mechanical 변환 — 7 it 보존 (test count + green 결과 동일), 추가 분리 0.

[PLAN.md L65 P3 test-quality bullet](../PLAN.md) — *"e2e test domain endpoint 확장 — R-113 e2e 의무 이행"* — 본 task 가 e2e 인프라 강화 두 번째 단계 (첫 단계 T-0090 = 부트스트랩 단일 source, 본 단계 = 인증 단일 source). 후속 T-0093 (POST /api/users signup + 첫 로그인 SuperAdmin 분기 e2e) / Auth flow e2e 의 **선행 의존 박제**.

## Required Reading

- [test/e2e/users.e2e-spec.ts L33-49](../../test/e2e/users.e2e-spec.ts) — inline `process.env.AUTH_JWT_SECRET` 박제 + `import { ACCESS_TOKEN_COOKIE }` 박제 + `createE2EApp` 호출. 본 task 가 추출 대상.
- [test/e2e/users.e2e-spec.ts L59-61](../../test/e2e/users.e2e-spec.ts) — `function issueAccessToken(jwt: JwtService, sub: string, role: string): string` inline. 본 task 가 helper 외화 대상.
- [test/e2e/users.e2e-spec.ts L92-125](../../test/e2e/users.e2e-spec.ts) — happy path it 의 seed + token + cookie set 패턴 박제. helper 호출 패턴 reference.
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) — T-0090 박제. `createE2EApp()` 반환 `{ app, moduleRef }`. 본 helper 가 위 호출 + 추가 seed/token utility 박제.
- [test/helpers/e2e-app-factory.e2e-spec.ts](../../test/helpers/e2e-app-factory.e2e-spec.ts) — T-0090 spec precedent. 본 task 의 colocated e2e spec 박제 패턴 reference (R-112 4 카테고리 + afterAll close).
- [src/auth/auth.controller.ts L68-69](../../src/auth/auth.controller.ts) — `export const ACCESS_TOKEN_COOKIE = "access_token"` + `REFRESH_TOKEN_COOKIE = "refresh_token"` 박제. helper 가 import 후 cookie 형식 박제.
- [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) — T-0083 박제. `process.env.AUTH_JWT_SECRET ?? PLACEHOLDER_SECRET` secret bind 박제. 본 helper 의 `process.env.AUTH_JWT_SECRET` 박제와 정합 (module init 전 셋업 의무).
- [src/auth/jwt.strategy.ts L20-40](../../src/auth/jwt.strategy.ts) — `cookieExtractor` 가 `req.cookies?.[ACCESS_TOKEN_COOKIE]` 추출 박제. cookie-parser middleware (T-0090 `applyGlobalMiddleware`) 가 req.cookies 채워야 동작.
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — JwtModule providers + JwtService export. helper 가 `moduleRef.get(JwtService)` 로 inject.
- [src/user/user.service.ts](../../src/user/user.service.ts) — UserService.changeRole 박제 (T-0086). 본 helper 가 seed 한 user 들이 후속 e2e 의 actor/target 으로 흘러감.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` 박제. 호출 측 spec 의 afterEach 책임 — helper scope 외.
- [docs/decisions/ADR-0008-auth-credential-type.md §2](../decisions/ADR-0008-auth-credential-type.md) — JWT in HttpOnly cookie 박제. helper 의 cookie 형식 박제 정합 의무.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — e2e real DB cutover 정책. seed 패턴 (prisma.user.create) 의 정합 의무.
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier (단일 helper + 1 e2e spec 변환 + colocated spec).

## Acceptance Criteria

### A. `test/helpers/auth-e2e-helper.ts` 신설

- [ ] [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) 신설. 다음 export 박제:
  - `export const TEST_AUTH_JWT_SECRET = "test-auth-jwt-secret-e2e"` const + module load 시점에 `process.env.AUTH_JWT_SECRET ??= TEST_AUTH_JWT_SECRET` 셋팅 (이미 셋되어 있으면 보존).
  - `export type SeedUserRole = "SuperAdmin" | "Admin" | "User"` literal union.
  - `export interface SeedUserInput { role: SeedUserRole; email?: string }` — email 미지정 시 helper 가 `<role>-<random>@e2e.test` 형식으로 자동 생성.
  - `export interface AuthenticatedE2EContext { app, moduleRef, prisma, jwtService, users: Record<string, User>, tokens: Record<string, string> }` — key = email.
  - `export async function createAuthenticatedE2EApp(seed: SeedUserInput[]): Promise<AuthenticatedE2EContext>` — createE2EApp + bcrypt 4-round password hash + prisma.user.create N 회 + JwtService inject + 각 user 의 access_token 발급. **호출 측 spec 의 beforeAll 1 줄 호출로 부트스트랩 + seed + token 발급 atomic 박제**.
  - `export function issueAccessTokenFor(jwtService: JwtService, user: { id: string; role: SeedUserRole }): string` — `jwt.sign({ sub: user.id, role: user.role }, { expiresIn: "15m" })` 박제.
  - `export function buildAuthCookie(token: string): string` — `${ACCESS_TOKEN_COOKIE}=${token}` 형식 반환.
- [ ] 파일 상단 한국어 주석 10-15 줄 — 책임 (e2e 인증 패턴 단일 source) + Out of Scope (login flow bypass 정공법, POST /api/auth/login 통한 cookie 획득 0, refresh token 발급 0 — auth.e2e-spec.ts 책임) + T-0090 cross-ref + ADR-0008 §2 cookie 형식 정합 박제 + AUTH_JWT_SECRET 박제 시점 (module load 이전, JwtStrategy.constructor 박제와 정합).
- [ ] import 정합 — `INestApplication` type-only / `TestingModule` type-only / `JwtService` from `@nestjs/jwt` / `User` from `@prisma/client` / `bcrypt` / `ACCESS_TOKEN_COOKIE` from `../../src/auth/auth.controller` / `PrismaService` from `../../src/persistence/prisma.service` / `createE2EApp` from `./e2e-app-factory`.

### B. `test/e2e/users.e2e-spec.ts` 의 inline 패턴 → helper 호출 변환

- [ ] L36 의 inline `process.env.AUTH_JWT_SECRET = "test-auth-jwt-secret-e2e-users"` 제거. `import "../helpers/auth-e2e-helper"` 의 side-effect 박제로 대체 (또는 `import { TEST_AUTH_JWT_SECRET } from "../helpers/auth-e2e-helper"` 도 OK — 일관성).
- [ ] L59-61 의 inline `function issueAccessToken(...)` 제거. helper 의 `issueAccessTokenFor` 호출로 대체.
- [ ] L109 / L188 / L211 / L237 / L264 의 `issueAccessToken(jwtService, X.id, "Y")` 호출 → `issueAccessTokenFor(jwtService, { id: X.id, role: "Y" })` 변환.
- [ ] L113 / L162 / L192 / L215 / L241 / L268 의 `\`${ACCESS_TOKEN_COOKIE}=${token}\`` → `buildAuthCookie(token)` 변환.
- [ ] **happy path it 의 seed + token 패턴은 inline 유지 가능** — `createAuthenticatedE2EApp` 호출은 beforeAll 가 아닌 it scope 에서도 OK (변환 권장 안 함, 기존 7 it 의 it 내 seed 패턴 보존). 단 L36/L59-61 의 module-scope 박제는 helper 외화 의무.
- [ ] 변환 후 기존 7 it 모두 보존 (test count 변경 0) + 모두 green.

### C. `test/helpers/auth-e2e-helper.spec.ts` colocated spec (R-112 4 카테고리)

- [ ] [test/helpers/auth-e2e-helper.spec.ts](../../test/helpers/auth-e2e-helper.spec.ts) 신설 (colocated unit spec — jest unit config 안에서 실행). 다음 it 박제 (≥ 8 it):
  - **happy — `issueAccessTokenFor`**: mock JwtService 의 `sign` 을 jest spy. `issueAccessTokenFor(mockJwt, { id: "user-1", role: "SuperAdmin" })` 호출 → `mockJwt.sign` 이 `{ sub: "user-1", role: "SuperAdmin" }` + `{ expiresIn: "15m" }` 인자로 호출됨 검증.
  - **happy — `buildAuthCookie`**: `buildAuthCookie("test-token-123")` 호출 → `"access_token=test-token-123"` 반환 검증.
  - **branch — `buildAuthCookie` role 3 종**: SuperAdmin/Admin/User 각 role 의 token 발급 시 동일 cookie prefix (`access_token=`) 박제 — role 무관 cookie 형식 일관성.
  - **error — `issueAccessTokenFor` jwtService null**: `issueAccessTokenFor(null as any, ...)` 호출 시 TypeError throw.
  - **error — `issueAccessTokenFor` user null**: `issueAccessTokenFor(mockJwt, null as any)` 호출 시 TypeError throw.
  - **negative — `buildAuthCookie` empty token**: `buildAuthCookie("")` → `"access_token="` (helper 가 empty string 도 허용하나, 호출 측 spec 의 contract 박제용).
  - **negative — `buildAuthCookie` special characters**: token 에 `=` / `;` / 공백 포함 시 helper 가 raw concat 박제 (encoding 책임 호출 측 — RFC 6265 cookie 값은 일반적으로 base64url JWT 라 issue 0).
  - **negative — TEST_AUTH_JWT_SECRET 부재 검증**: `process.env.AUTH_JWT_SECRET` 가 helper module load 후 정의됨 검증 (`typeof process.env.AUTH_JWT_SECRET === "string"` + 길이 > 0).
- [ ] mock 패턴: `const mockJwt = { sign: jest.fn() } as unknown as JwtService`.
- [ ] 본 spec 은 unit config 안에서 실행 (jest.config 의 default testRegex `.spec.ts` 매칭, e2e 와 분리). `createAuthenticatedE2EApp` 자체의 happy path 는 unit 으로 cover 어려움 (실 DB 의존) — 본 spec 은 stateless 3 helper (issueAccessTokenFor / buildAuthCookie / TEST_AUTH_JWT_SECRET) 만 cover. **`createAuthenticatedE2EApp` 의 e2e 검증은 D 항목**.

### D. `test/helpers/auth-e2e-helper.e2e-spec.ts` colocated e2e spec (실 DB 호출)

- [ ] [test/helpers/auth-e2e-helper.e2e-spec.ts](../../test/helpers/auth-e2e-helper.e2e-spec.ts) 신설 (colocated e2e — testRegex `.*\.e2e-spec\.ts$` 매칭, jest-e2e 안). 다음 it 박제 (≥ 4 it):
  - **happy — `createAuthenticatedE2EApp` 단일 user seed**: `createAuthenticatedE2EApp([{ role: "SuperAdmin", email: "sa@e2e.test" }])` 호출 → 반환 `{ app, moduleRef, prisma, jwtService, users, tokens }` 검증. users["sa@e2e.test"] 의 role === "SuperAdmin" + tokens["sa@e2e.test"] 가 string + 길이 > 0. 실 DB 의 user row 1개 존재 검증.
  - **happy — `createAuthenticatedE2EApp` 3 user seed (SuperAdmin/Admin/User)**: 3 종 role 의 user seed + 3 token 발급 검증. users / tokens 각각 3 key.
  - **branch — email 미지정 시 자동 생성**: `createAuthenticatedE2EApp([{ role: "Admin" }])` 호출 → 자동 email `admin-<random>@e2e.test` 형식 검증 (regex `/admin-[a-z0-9]+@e2e\.test/` 매칭).
  - **negative — 빈 seed array**: `createAuthenticatedE2EApp([])` 호출 → users/tokens 빈 object + app/moduleRef/prisma/jwtService 정상 반환 (createE2EApp 만 호출된 형태). seed array 가 비어도 helper 가 정상 동작.
- [ ] afterAll 박제: `await app.close(); await prisma.$disconnect();` — connection 누수 0. afterEach `truncateAll(prisma)` — 실 DB state 격리.

### E. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — auth-e2e-helper.ts 의 line ≥ 80% AND function ≥ 80% (helper 가 3 작은 함수 + 1 createAuthenticatedE2EApp, 본 spec 의 C/D 항목으로 cover).
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — 변환된 users.e2e-spec.ts 7/7 보존 + auth-e2e-helper.e2e-spec.ts 4+/4+ 신규 green.
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **POST /api/users (signup) endpoint 신설 + 첫 로그인 SuperAdmin 자동 지정** — T-0093 candidate. 본 task helper 가 의존성 (signup e2e 가 helper 사용).
- **POST /api/auth/login flow 통한 cookie 획득** — login flow bypass 정공법 채택, 본 helper 는 JwtService 직접 sign. login flow 통과 e2e 는 별도 `auth.e2e-spec.ts` 책임 (별도 task).
- **RefreshToken DB table + revocation + helper 의 refresh_token 발급** — T-0092 candidate, ADR-0008 §6 박제. 본 helper 는 access_token 만.
- **GlobalValidationPipe / Helmet / Cors 의 applyGlobalMiddleware 통합** — T-0090 Follow-up. 본 task 와 직교.
- **persons.e2e-spec.ts / groups.e2e-spec.ts / parts.e2e-spec.ts 의 helper 적용** — 현재 위 3 spec 은 인증 무관 (RBAC guard 0 적용), 본 helper 호출 불요. 향후 위 3 endpoint 에 RBAC 적용 시 별도 task 로 helper 호출 변환.
- **ConfigModule fail-fast (Joi schema)** — 본 helper 의 `process.env.AUTH_JWT_SECRET` 박제 패턴은 ConfigModule 도입 시 재검토 — 별도 task.
- **TEST_AUTH_JWT_SECRET 의 .env.test 외화** — 현 시점은 helper 의 const 박제 충분. 향후 secret 회전 요구 시 외화.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — 신규 결정 0, T-0090 helper 위에 쌓이는 단순 확장 + ADR-0008 §2 정합 유지).

## Follow-ups

- **T-0092 candidate** — RefreshToken DB table + revocation path (ADR-0008 §6 박제). 본 helper 의 issueRefreshTokenFor 확장 후보.
- **T-0093 candidate** — POST /api/users (signup) + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반). 본 helper 가 e2e 의 seed/token 박제.
- **auth.e2e-spec.ts 신설** — POST /api/auth/login + logout + refresh flow e2e. 본 helper 의 `createAuthenticatedE2EApp` + 실 login flow 통한 cookie 획득 비교 검증.
- **ConfigModule + Joi schema 도입** — `process.env.AUTH_JWT_SECRET` 의 fail-fast 검증. 본 helper 의 박제 패턴 재검토.
- **persons/groups/parts 에 RBAC 적용** — Admin tier endpoint 박제 시 본 helper 의 Admin token 발급 사용.
- **estimate-model.md 17 회차 milestone refinement** — 본 task 의 partial-backbone × 1.3 multiplier (helper 추출 + 1 e2e 변환 + 2 colocated spec) variance 박제.

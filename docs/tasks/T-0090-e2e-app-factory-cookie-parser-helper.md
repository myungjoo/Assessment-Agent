---
id: T-0090
taskId: T-0090
title: e2e-app-factory helper 추출 + cookie-parser middleware test-path wire 영구 일관성 박제
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046, REQ-057, REQ-058]
estimatedDiff: 220
estimatedFiles: 5
estimatedLoc: 220
dependsOn: [T-0087]
sizeExempt: false
created: 2026-05-29
createdAt: 2026-05-29T04:25:00+09:00
plannerNote: "cron fire 후속 — T-0087 within-round 2 fix push 의 cookie-parser test-path 격차 lesson 영구 fix. partial-backbone × 1.3 envelope 220 LOC / 5 파일. T-0091 helper 추출의 선행 의존."
---

# T-0090 — e2e-app-factory helper 추출 + cookie-parser middleware test-path wire 영구 일관성 박제

## Why

[T-0087](T-0087-user-controller-change-role-endpoint.md) (MERGED fabeb40) 의 **within-round 2 fix push lesson** 박제: `cookie-parser` middleware 가 [src/main.ts L23](../../src/main.ts) 의 production boot path 에만 wire 되어 있어 `Test.createTestingModule({ imports: [AppModule] }).compile() → moduleRef.createNestApplication()` 의 e2e 부트스트랩 path 에서 누락 → users.e2e-spec.ts 의 모든 authenticated request (`Cookie: access_token=...`) 가 401 fail. 1 라인 inline wire ([test/e2e/users.e2e-spec.ts L82](../../test/e2e/users.e2e-spec.ts) `app.use(cookieParser())`) 추가로 7/7 green 회복했으나 **본질적 결함은 production code path / test path 양쪽 의 middleware setup 이 분리되어 있어 다음 e2e (Auth e2e, signup e2e 등) 신설 시 동일 forgetting-cookie-parser regression 이 자동 catch 안 됨**.

본 task 가 두 path 의 middleware setup 을 **단일 source 로 외화** — `src/bootstrap.ts` (또는 `src/app-bootstrap.ts`) 의 `applyGlobalMiddleware(app: INestApplication): void` helper 신설 + main.ts boot path 와 test/helpers/e2e-app-factory.ts 양쪽이 helper 호출. helper 가 cookie-parser + 향후 추가될 모든 global middleware (CorsMiddleware / Helmet / GlobalValidationPipe 등) 의 단일 source 박제 → middleware 추가 시 한 곳만 갱신하면 production + e2e 양쪽 자동 동기.

본 task 가 **T-0091 (auth-e2e-helper 추출)** 의 선행 의존 — helper 추출 시 본 e2e-app-factory 위에 `createAuthenticatedE2EApp({ role: "SuperAdmin" })` 같은 higher-level helper 가 쌓이는 자연 chain. 본 task 머지 후 T-0091 가 진입 가능.

[PLAN.md L65 P3 test-quality bullet](../PLAN.md) — *"e2e test domain endpoint 확장 — R-113 e2e 의무 이행"* — 본 task 가 e2e 인프라 강화 (regression catch backbone 박제). R-113 (smoke + e2e CI 강제) 의 의무 이행 도구.

## Required Reading

- [src/main.ts](../../src/main.ts) — production boot path. L23 `app.use(cookieParser())` 박제 — 본 task 가 추출 대상.
- [test/e2e/users.e2e-spec.ts L70-83](../../test/e2e/users.e2e-spec.ts) — T-0087 박제. inline `app.use(cookieParser())` wire 패턴 — 본 task 가 helper 호출로 대체 대상. 본 spec 의 70-76 줄 주석 ("CI 의 e2e fail 박제 — auth-e2e-helper (T-0091 candidate) 추출 시 본 wire 도 함께 외화 의무") 이 본 task 의 직접 정당화.
- [test/e2e/persons.e2e-spec.ts L62-76](../../test/e2e/persons.e2e-spec.ts) — e2e backbone precedent (T-0054). `Test.createTestingModule({imports:[AppModule]}).compile()` + `moduleRef.createNestApplication()` + `app.init()` 표준 패턴 — cookie-parser 불요 (인증 무관 endpoint) 이나 본 task 의 helper 가 호출되어도 무해 (cookie-parser middleware 가 인증 무관 endpoint 의 req 처리에 영향 0).
- [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) — e2e precedent. 동일 부트스트랩 패턴.
- [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts) — e2e precedent. 동일 부트스트랩 패턴.
- [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — minimal e2e (GET /). 동일 패턴.
- [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) — T-0083 박제. `cookieExtractor` 가 `req.cookies?.[ACCESS_TOKEN_COOKIE]` 로 token 추출 — cookie-parser middleware 가 req.cookies 채워야 동작.
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — T-0082 박제. ACCESS_TOKEN_COOKIE / REFRESH_TOKEN_COOKIE const + login/refresh/logout 의 res.cookie / res.clearCookie / req.cookies 사용 패턴.
- [docs/decisions/ADR-0008-auth-credential-type.md §2](../decisions/ADR-0008-auth-credential-type.md) — JWT in HttpOnly cookie 박제. cookie-parser middleware 가 read-side backbone.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — e2e 의 real DB cutover 정책 (truncateAll afterEach + app.close + prisma.$disconnect). 본 task 의 helper 가 이 패턴과 정합 박제 의무.
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [CLAUDE.md §3.2 R-112 entrypoint 예외](../../CLAUDE.md) — `src/main.ts` 같은 부트스트랩 entrypoint 는 직접 unit-test 가 까다로워 coverage / spec-presence 제외이나, **분기 있는 helper 로직** 은 별도 함수로 분리해 unit-testable 하게 만들고 spec 추가 의무. 본 task 의 `applyGlobalMiddleware` helper 가 이 정책 정합 (main.ts entrypoint 에서 호출만, helper 자체는 spec cover).
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier (단일 helper 추출 + 2 path 갱신 + colocated spec).

## Acceptance Criteria

### A. `src/bootstrap.ts` helper 신설

- [ ] [src/bootstrap.ts](../../src/bootstrap.ts) 신설. `export function applyGlobalMiddleware(app: INestApplication): void` 박제.
- [ ] helper 본문: `app.use(cookieParser())` 1 라인 + 향후 추가 위치 주석 1 줄 (`// 향후 추가 middleware (Helmet / Cors / GlobalValidationPipe 등) 는 본 함수 내부에 1:1 박제 — production + e2e 양쪽 자동 동기`).
- [ ] 파일 상단 한국어 주석 8-12 줄 — 책임 (production boot path + e2e Test.createTestingModule path 의 단일 middleware source) + Out of Scope (NestFactory.create / app.listen / port parsing 0 — main.ts 책임 유지) + T-0087 lesson 박제 cross-ref + ADR-0008 §2 cookie-parser 위상 박제.
- [ ] import: `import type { INestApplication } from "@nestjs/common";` + `import cookieParser from "cookie-parser";`.

### B. `src/main.ts` 의 inline wire → helper 호출 변환

- [ ] [src/main.ts](../../src/main.ts) L21-23 의 inline `app.use(cookieParser())` 제거 + `applyGlobalMiddleware(app)` 호출로 대체.
- [ ] import 갱신 — `cookieParser` import 제거 + `import { applyGlobalMiddleware } from "./bootstrap";` 추가.
- [ ] 기존 한국어 주석 (L7-12 의 T-0082 cookie-parser middleware 박제 설명) 의 사실 1 줄 amend — "T-0090 추가 — applyGlobalMiddleware 로 외화. production + e2e 양쪽 동일 helper 호출 박제 (test/helpers/e2e-app-factory.ts)."

### C. `test/helpers/e2e-app-factory.ts` 신설

- [ ] [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) 신설. `export async function createE2EApp(): Promise<{ app: INestApplication; moduleRef: TestingModule }>` 박제.
- [ ] helper 본문:
  ```typescript
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  applyGlobalMiddleware(app);
  await app.init();
  return { app, moduleRef };
  ```
- [ ] 파일 상단 한국어 주석 8-12 줄 — 책임 (e2e 부트스트랩 + applyGlobalMiddleware 호출 + Test.createTestingModule path 의 production boot path 정합 박제) + T-0087 lesson cross-ref + Out of Scope (JWT issue / seed / truncate 0 — auth-e2e-helper T-0091 candidate 책임).
- [ ] import 정합 — `INestApplication` type-only / `Test, TestingModule` from `@nestjs/testing` / `AppModule` from `../../src/app.module` / `applyGlobalMiddleware` from `../../src/bootstrap`.

### D. e2e spec 5종의 helper 호출 변환

- [ ] [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — beforeAll 의 5-라인 부트스트랩 (Test.createTestingModule → createNestApplication → app.use(cookieParser()) → app.init() → moduleRef.get) 을 `const { app: a, moduleRef } = await createE2EApp(); app = a; ...` 패턴으로 변환. inline `cookieParser` import 제거. L70-83 의 inline 주석 (T-0087 박제) 은 본 task 후 1 줄로 축약 — "cookie-parser wire 는 createE2EApp 의 applyGlobalMiddleware 책임 (T-0090 박제)".
- [ ] [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — 동일 패턴 변환. cookie-parser middleware 가 인증 무관 endpoint 의 req 에도 무해 (req.cookies 가 빈 object 로 채워질 뿐) — 정합 유지.
- [ ] [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) — 동일 변환.
- [ ] [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts) — 동일 변환.
- [ ] [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — 동일 변환.

### E. `src/bootstrap.spec.ts` colocated spec (R-112 4 카테고리)

- [ ] [src/bootstrap.spec.ts](../../src/bootstrap.spec.ts) 신설 (colocated). `applyGlobalMiddleware` 의 R-112 4 카테고리 cover:
  - **happy** — `app.use` 를 jest mock 으로 spy. `applyGlobalMiddleware(mockApp)` 호출 → `mockApp.use` 가 cookie-parser middleware function 1 회 호출 검증.
  - **branch** — `app.use` 호출 인자 type 검증 (express middleware function signature `(req, res, next) => void` 정합) — `typeof callArg === "function"` assertion.
  - **error path** — `app` 가 null / undefined 인 경우 — TypeError throw 검증 (typescript type 강제로 runtime 0 이나 강제 cast 로 negative case 박제).
  - **negative — middleware 호출 횟수** — `applyGlobalMiddleware` 가 정확히 1 회만 `app.use` 호출 (향후 middleware 추가 시 본 spec 의 it 가 fail 하여 누락 catch — spec 이 source of truth).
- [ ] 본 spec 은 4+ it. `INestApplication` mock 은 `{ use: jest.fn() } as unknown as INestApplication` 패턴.

### F. `test/helpers/e2e-app-factory.spec.ts` colocated spec (R-112 4 카테고리)

- [ ] [test/helpers/e2e-app-factory.spec.ts](../../test/helpers/e2e-app-factory.spec.ts) 신설 (colocated). `createE2EApp` 의 R-112 cover:
  - **happy** — `createE2EApp()` 호출 → 반환 `{app, moduleRef}` 가 truthy + app 이 INestApplication shape (init / close / use 메서드 존재) + moduleRef.get(PrismaService) resolve.
  - **branch** — app.init() 가 호출되었음 검증 (이미 init 된 상태 — 두 번째 init 시 NestJS error throw 패턴).
  - **error path** — AppModule import 실패 시나리오 — 본 spec 은 실 DB 의존 (jest-e2e-setup) — happy path 만 cover, error path 는 본 spec scope 외 1 줄 주석 박제.
  - **negative — applyGlobalMiddleware 호출 검증** — 반환된 app 에 cookie-parser middleware 가 wire 되어 있는지 supertest 로 검증 — `request(app.getHttpServer()).get("/non-existent").set("Cookie", "test=1")` 호출 → 응답 status 404 이나 req.cookies 가 server 에서 parsed 되었음을 간접 검증 (e2e factory 자체의 contract 만 검증, 404 status 자체가 helper 의 정합 증거).
- [ ] 본 spec 은 jest-e2e config 안에서 실행 — testRegex `.*\.e2e-spec\.ts$` 매칭 위해 `e2e-app-factory.e2e-spec.ts` 로 명명 또는 jest-e2e.json testRegex 갱신. **간소 정공법**: `e2e-app-factory.e2e-spec.ts` 명명 (test/helpers/ 디렉토리 안에 위치, jest-e2e.json roots 가 `test` 전체이므로 자동 매칭).
- [ ] 본 spec 은 afterAll(app.close + prisma.$disconnect) 박제 — connection 누수 0.

### G. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — bootstrap.ts 의 line / function 모두 ≥ 80% (helper 가 1 함수 1 라인이라 100% 목표).
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음 (smoke 는 별도 부트스트랩, e2e factory 영향 0).
- [ ] `pnpm test:e2e` 통과 — 변환된 5 e2e spec 모두 기존 동일 test count + 동일 green (users.e2e-spec.ts 7/7 + persons / groups / parts / app 의 기존 test 보존).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **auth-e2e-helper.ts (JWT issue / cookie 형식 박제 / SuperAdmin / Admin / User 3 종 token 발급 utility)** — **T-0091 candidate**. 본 task 머지 후 진입. 본 task 의 e2e-app-factory 위에 쌓이는 higher-level helper.
- **GlobalValidationPipe 의 main.ts/e2e 외화** — 현재 ValidationPipe 는 controller-scope `@UsePipes(...)` 박제 (PersonController / GroupController / PartController / UserController / AuthController 각각). global 박제 전환은 별도 task chain — 본 task 는 cookie-parser 만.
- **CorsMiddleware / Helmet 도입** — P6 또는 P8 hardening phase 책임. 본 task 의 helper 는 향후 추가 hook point 만 박제.
- **ConfigModule fail-fast (Joi schema)** — T-0090.5 또는 별도 candidate. 본 task 와 직교.
- **RefreshToken DB table + revocation** — T-0092 candidate, ADR-0008 §6 박제.
- **POST /api/users signup + 첫 로그인 SuperAdmin 분기** — T-0093 candidate. 본 task helper 가 의존성 (signup e2e 가 createE2EApp 사용).
- **bootstrap.ts 에 NestFactory.create + app.listen 의 외화** — main.ts 의 부트스트랩 책임은 그대로 유지, 본 task 는 middleware setup 만 추출. NestFactory 외화는 R-112 entrypoint 예외 정책 의 의미적 경계 변경 — 별도 ADR 필요.
- **smoke 부트스트랩 helper 추출** — smoke 는 별도 부트스트랩 (test/helpers/jest-smoke-setup.ts) — 본 task scope 외. 향후 동일 helper 가 smoke 도 cover 가능하면 별도 task.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — 신규 결정 0, T-0087 lesson 박제 정공법 mirror + ADR-0008 §2 정합 유지).

## Follow-ups

- **T-0091 candidate** — test/helpers/auth-e2e-helper.ts 추출 (createE2EApp 위에 JWT issue / SuperAdmin/Admin/User 3 token 발급 / cookie 형식 박제 utility). users.e2e-spec.ts 의 inline `issueAccessToken` + `process.env.AUTH_JWT_SECRET` 박제 패턴 → helper 외화.
- **T-0092 candidate** — RefreshToken DB table + revocation path (ADR-0008 §6 박제).
- **T-0093 candidate** — POST /api/users (signup) + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반).
- **GlobalValidationPipe 외화** — 모든 controller 의 `@UsePipes(new ValidationPipe(...))` 를 applyGlobalMiddleware 의 ValidationPipe 박제로 통합. trade-off (controller-scope vs global) ADR 필요.
- **smoke-app-factory 추출** — smoke 가 본 helper 와 정합되도록 별도 helper (또는 createE2EApp 의 smoke variant 통합). smoke 의 부트스트랩 책임은 jest-smoke-setup.ts 가 cover — 본 task 머지 후 검토.
- **estimate-model.md 16 회차 milestone refinement** — 본 task 의 partial-backbone × 1.3 multiplier (helper 추출 + 2 path 갱신 + colocated spec) variance 박제.
- **NestFactory factory 외화** — main.ts 의 NestFactory.create / app.listen 책임도 helper 로 추출 — R-112 entrypoint 정책 재검토 (별도 ADR).

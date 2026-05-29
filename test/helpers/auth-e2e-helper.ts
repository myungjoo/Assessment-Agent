// auth-e2e-helper.ts — e2e 인증 패턴 단일 source (T-0091 박제).
//
// 책임:
//   - `process.env.AUTH_JWT_SECRET` 의 셋업 박제 — module load 시점에 ??= 로 박제,
//     호출 측 spec 은 import 만으로 secret 박제 (T-0087/users.e2e 의 inline
//     `process.env.AUTH_JWT_SECRET = "..."` 패턴 외화).
//   - `createAuthenticatedE2EApp({ users })` 호출 → createE2EApp + bcrypt password hash
//     + prisma.user.create N 회 + JwtService inject + 각 user 의 access_token 발급을
//     atomic 박제. 호출 측 spec 의 beforeAll 1 줄 호출로 부트스트랩 + seed + token
//     발급 양쪽 정합 자동 보장.
//   - `issueAccessTokenFor(jwtService, user)` — single-shot helper. role claim + sub
//     claim + 15m TTL 박제. T-0087 의 inline `issueAccessToken(jwt, sub, role)` 외화.
//   - `buildAuthCookie(token)` — `${ACCESS_TOKEN_COOKIE}=${token}` 형식 박제 (cookie
//     형식 변경 시 본 helper 1곳 만 수정).
//
// Out of Scope:
//   - POST /api/auth/login flow 통한 cookie 획득 — 본 helper 는 JwtService.sign 직접
//     호출 (login flow bypass 정공법). login flow 통과 e2e 는 별도 `auth.e2e-spec.ts`
//     책임 (별도 task).
//   - refresh_token 발급 — 본 helper 는 access_token 만 (T-0092 candidate 의
//     RefreshToken DB table + revocation path 박제 후 확장).
//   - seed 한 user 의 cleanup — afterEach `truncateAll(prisma)` 는 호출 측 spec 책임,
//     본 helper scope 외.
//
// AUTH_JWT_SECRET 박제 시점 (module load 이전):
//   - JwtStrategy.constructor (src/auth/jwt.strategy.ts L57-67) 가 super({ secretOrKey:
//     process.env.AUTH_JWT_SECRET ?? PLACEHOLDER_SECRET }) 으로 module init 시점에
//     secret bind. 본 helper 의 import 가 호출 측 spec 보다 먼저 evaluation 되어야
//     module init 시점에 secret 이 정상 박제됨 (호출 측 spec 의 top-level import 가
//     자연 처리). 이미 셋된 secret (예: globalSetup) 은 ??= 가 보존.
//
// T-0090 cross-ref:
//   - createE2EApp (test/helpers/e2e-app-factory.ts) 가 부트스트랩 단일 source 박제 —
//     본 helper 가 위에 인증 layer 박제. middleware (cookie-parser 등) wire 정합은
//     T-0090 의 applyGlobalMiddleware 책임.
//
// ADR-0008 §2 정합:
//   - cookie 형식 `access_token=<token>` 박제 — ADR-0008 Decision §2 의 HttpOnly cookie
//     박제 정합. supertest 의 `Cookie:` header 로 직접 박제 (login flow bypass).
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { ACCESS_TOKEN_COOKIE } from "../../src/auth/auth.controller";
import { PrismaService } from "../../src/persistence/prisma.service";

import { createE2EApp } from "./e2e-app-factory";

// TEST_AUTH_JWT_SECRET — e2e 단일 source secret. const 박제 — 향후 secret 회전 요구
// 시 본 const 만 변경 (호출 측 spec 의 영향 0). T-0091 acceptance §A 박제.
export const TEST_AUTH_JWT_SECRET = "test-auth-jwt-secret-e2e";

// module load 시점 박제 — ??= 로 이미 셋된 값 보존 (globalSetup 의 별도 secret 등).
// JwtStrategy.constructor 의 module init 보다 먼저 evaluation 되어야 정상 secret bind.
process.env.AUTH_JWT_SECRET ??= TEST_AUTH_JWT_SECRET;

// SeedUserRole — RBAC 3 종 role literal union. UserService.changeRole 의 5 invariant
// (T-0086) 정합 — "SuperAdmin" / "Admin" / "User" 외 role 은 본 helper scope 외.
export type SeedUserRole = "SuperAdmin" | "Admin" | "User";

// SeedUserInput — createAuthenticatedE2EApp 의 user seed 입력 1 개. email 미지정 시
// helper 가 `<role-lower>-<random>@e2e.test` 형식으로 자동 생성.
export interface SeedUserInput {
  role: SeedUserRole;
  email?: string;
}

// AuthenticatedE2EContext — createAuthenticatedE2EApp 반환 surface. users / tokens
// 의 key 는 email (auto-generate 시 helper 가 채운 email).
export interface AuthenticatedE2EContext {
  app: INestApplication;
  moduleRef: TestingModule;
  prisma: PrismaService;
  jwtService: JwtService;
  users: Record<string, User>;
  tokens: Record<string, string>;
}

// issueAccessTokenFor — JwtService.sign 으로 access_token 1 개 발급. sub + role claim
// 박제 + 15m TTL (ADR-0008 §3 정합). T-0087 의 inline issueAccessToken 외화.
//
// jwtService / user 의 null 검증은 명시 — error path 박제 (R-112 error 카테고리 cover).
export function issueAccessTokenFor(
  jwtService: JwtService,
  user: { id: string; role: SeedUserRole },
): string {
  if (jwtService === null || jwtService === undefined) {
    throw new TypeError("jwtService is required");
  }
  if (user === null || user === undefined) {
    throw new TypeError("user is required");
  }
  return jwtService.sign(
    { sub: user.id, role: user.role },
    { expiresIn: "15m" },
  );
}

// buildAuthCookie — supertest 의 `Cookie:` header 값 박제. cookie 형식 변경 시 본
// 함수 1곳만 수정 (T-0087 의 inline `${ACCESS_TOKEN_COOKIE}=${token}` 외화).
//
// empty string / special chars 도 raw concat — encoding 책임은 호출 측 (실제로는
// base64url JWT 라 encoding issue 0).
export function buildAuthCookie(token: string): string {
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

// generateAutoEmail — email 미지정 시 helper 가 자동 생성. 형식
// `<role-lower>-<random>@e2e.test` — afterEach truncate 가 격리하므로 충돌 가능성 0.
function generateAutoEmail(role: SeedUserRole): string {
  // Math.random().toString(36) 의 [2..] slice — `0.xxxx` 의 `xxxx` 부분만, lowercase
  // alphanumeric. 8 char 면 e2e 격리 spec 안에서 충돌 0 (afterEach truncate).
  const random = Math.random().toString(36).slice(2, 10);
  return `${role.toLowerCase()}-${random}@e2e.test`;
}

// createAuthenticatedE2EApp — createE2EApp + seed N user + token N 발급 atomic.
// 호출 측 spec 의 beforeAll 1 줄로 부트스트랩 + seed + token 발급 양쪽 정합 자동 보장.
//
// 흐름:
//   1. createE2EApp() — { app, moduleRef } 부트스트랩 (T-0090 helper).
//   2. PrismaService + JwtService inject — moduleRef.get.
//   3. bcrypt password hash 1 회 — 모든 seed user 공유 (test scope, security 무관).
//   4. seed N user: email auto-generate (미지정 시) + prisma.user.create.
//   5. 각 user 의 access_token 발급 — issueAccessTokenFor.
//   6. users / tokens record 박제 (key = email).
//
// 빈 seed array 도 정상 — users / tokens 빈 object + app/moduleRef/prisma/jwtService
// 만 반환 (createE2EApp 만 호출된 형태).
export async function createAuthenticatedE2EApp(
  seed: SeedUserInput[],
): Promise<AuthenticatedE2EContext> {
  const { app, moduleRef } = await createE2EApp();
  const prisma = moduleRef.get<PrismaService>(PrismaService);
  const jwtService = moduleRef.get<JwtService>(JwtService);

  // bcrypt 4-round — test scope, security 무관 (production 은 별도 round). password
  // column 의 not-null 충족용 placeholder.
  const hashedPassword = await bcrypt.hash("password", 4);

  const users: Record<string, User> = {};
  const tokens: Record<string, string> = {};

  for (const input of seed) {
    const email = input.email ?? generateAutoEmail(input.role);
    const created = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        role: input.role,
      },
    });
    users[email] = created;
    tokens[email] = issueAccessTokenFor(jwtService, {
      id: created.id,
      role: input.role,
    });
  }

  return { app, moduleRef, prisma, jwtService, users, tokens };
}

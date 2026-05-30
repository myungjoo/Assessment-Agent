// auth.e2e-spec.ts — `/api/auth/*` 3 endpoint 의 end-to-end 검증 (T-0094
// acceptance §A-§E 박제).
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 POST /api/auth/login + /logout + /refresh 3 endpoint 의 HTTP
//     round-trip + 실 PostgreSQL persistence + cookie set/clear/rotation 양쪽
//     정합 박제. ADR-0008 Decision §2 (cookie attributes) + §3 (TTL access 15m
//     / refresh 7d) + §5 (AUTH_JWT_REFRESH_SECRET 분리) contract 의 e2e 검증.
//   - unit (auth.controller.spec.ts / auth.service.spec.ts / login.dto.spec.ts)
//     이 각 layer 의 정밀 cover, 본 spec 은 HTTP layer + DB persistence + cookie
//     round-trip 의 통합 검증. unit 과 중복되는 분기는 1+ canary 로 압축.
//   - smoke 는 본 task scope 외 — `/api/auth` smoke spec 신설은 별도 follow-up.
//
// 실 DB 전략 (ADR-0004 §Decision — users.e2e / parts.e2e / persons.e2e 1:1 mirror):
//   - mock override 제거 — createE2EApp 의 AppModule.compile() 만으로 부트스트랩,
//     PrismaService 가 services.postgres 의 localhost:5432 로 실 connection 발화.
//   - arrange 단계 prisma.user.create + bcrypt password hash 실 seed → endpoint
//     호출 → 응답 + cookie + 실 DB state 검증.
//   - afterEach(truncateAll) + afterAll(app.close + prisma.$disconnect) 박제.
//
// JWT 발급 setup (본 spec 은 login flow 자체를 검증 — helper bypass 0 패턴):
//   - createE2EApp 직접 호출 (createAuthenticatedE2EApp 미사용) — login endpoint
//     가 cookie 를 직접 set, helper 의 issueAccessTokenFor 는 본 spec 에서 미사용.
//   - refresh negative branch (signature invalid / 만료 / role 부재) 검증 시
//     JwtService.sign 으로 forged token 박제 — module-level JwtService inject.
//
// AUTH_JWT_REFRESH_SECRET 박제 시점 (module load 이전):
//   - AuthController.refresh 의 `process.env[REFRESH_SECRET_ENV] ?? ""` path 정합
//     의무. 본 spec 의 top-level (import 후 describe 이전) 에서 ??= 로 박제 — 이미
//     셋된 값 (예: globalSetup) 은 보존. 셋업 안 하면 refresh 가 빈 secret 으로
//     verify 시도 → 모든 refresh test 가 401 = 정상 동작 검증 불가.
//   - AUTH_JWT_SECRET 박제는 auth-e2e-helper 의 module-load side-effect 가 담당
//     (helper import 로 보장). T-0091 박제 패턴 reuse.
//
// 책임 경계 (Out of Scope, task §Out of Scope 박제):
//   - RefreshToken DB table + revocation path — ADR-0008 §6 후속 chain candidate.
//     본 spec 의 refresh rotation 은 cookie 단순 재발급 (revocation gap 인지).
//   - POST /api/users signup → login round-trip — 별도 task (signup endpoint 의
//     생성 직후 즉시 login 정상 flow 의 cross-endpoint round-trip 박제).
//   - JwtAuthGuard 통과 e2e (인증 필요 endpoint) — users.e2e-spec.ts 가 이미 cover.
//   - rate limiting / brute-force 차단 / CSRF token / email 검증 — 별도 task.

/* eslint-disable import/first */
// AUTH_JWT_REFRESH_SECRET 박제 — module-load 이전, import 후 즉시 ??= 로 박제
// (이미 셋된 값 보존). AuthController.refresh 의 verify path 가 본 secret 으로
// JwtService.verify(token, { secret: refreshSecret }) 호출. 셋업 안 하면 모든
// refresh test 가 401 → 정상 동작 검증 불가.
process.env.AUTH_JWT_REFRESH_SECRET ??= "test-auth-jwt-refresh-secret-e2e";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import request from "supertest";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../src/auth/auth.controller";
import { PrismaService } from "../../src/persistence/prisma.service";
// auth-e2e-helper module-load side-effect — AUTH_JWT_SECRET 박제 (T-0091).
// 본 import 가 helper 의 top-level `process.env.AUTH_JWT_SECRET ??= ...` 를
// evaluation → JwtStrategy.constructor 의 module init 시점에 정상 secret bind.
// T-0106 — GET /api/auth/me describe block 이 createAuthenticatedE2EApp +
// buildAuthCookie + issueAccessTokenFor 3 helper 직접 사용 (users.e2e 패턴 정합).
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  issueAccessTokenFor,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";
/* eslint-enable import/first */

// REFRESH_SECRET — 본 spec 안에서 forged token / 만료 token 생성 시 사용. top-level
// 박제와 동일 값 — refresh negative branch 의 sign 측 secret 정합.
const REFRESH_SECRET = "test-auth-jwt-refresh-secret-e2e";

// AuthController.refresh 의 응답 메시지 정합 — enumeration 차단 박제.
const REFRESH_INVALID_MESSAGE = "Invalid refresh token";
const LOGIN_INVALID_MESSAGE = "Invalid credentials";

// Set-Cookie header 의 cookie value parser — supertest 응답의 raw Set-Cookie
// header 배열에서 특정 cookie name 의 value 만 추출. cookie value 자체 (";" 앞
// 부분) 를 반환 — attribute 검증은 별도 (raw 라인 substring).
function extractCookieValue(
  setCookieHeaders: string[],
  cookieName: string,
): string | undefined {
  const line = setCookieHeaders.find((l) => l.startsWith(`${cookieName}=`));
  if (line === undefined) {
    return undefined;
  }
  // `<name>=<value>; attr1; attr2` → `<value>` 추출.
  const valuePart = line.slice(cookieName.length + 1).split(";")[0];
  return valuePart;
}

// Set-Cookie raw 라인 검색 — 특정 cookie name 의 전체 라인 (attribute 포함) 반환.
function findCookieLine(
  setCookieHeaders: string[],
  cookieName: string,
): string | undefined {
  return setCookieHeaders.find((l) => l.startsWith(`${cookieName}=`));
}

describe("E2E: /api/auth/* — login + logout + refresh end-to-end (ADR-0008 §2/§3/§5)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    // cookie-parser wire 는 createE2EApp 의 applyGlobalMiddleware 책임 (T-0090 박제).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    jwtService = created.moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup — afterEach truncate 로 test 간 state leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // bcrypt hash 4-round — test scope, security 무관. password column 의 not-null
  // 충족 + verifyPassword round-trip 검증용 실 hash.
  async function seedUser(
    email: string,
    plainPassword: string,
    role: "SuperAdmin" | "Admin" | "User" = "User",
  ): Promise<{ id: string; email: string; role: string }> {
    const hashedPassword = await bcrypt.hash(plainPassword, 4);
    const created = await prisma.user.create({
      data: { email, hashedPassword, role },
    });
    return { id: created.id, email: created.email, role: created.role };
  }

  // -- B. POST /api/auth/login (≥ 5 it — happy / error / branch / negative) --
  describe("POST /api/auth/login", () => {
    it("happy — 정상 credentials 시 200 + body.userId === seedUser.id (round-trip)", async () => {
      const seed = await seedUser("login-happy@e2e.test", "correct-password");

      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ userId: seed.id });
      // Set-Cookie 가 정확히 2 종 (access + refresh) 박제 — cookie attribute
      // 정밀 검증은 별도 it (branch).
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];
      expect(cookies).toHaveLength(2);
    });

    it("branch — login 응답의 cookie 2 종 set + ADR-0008 §2 attributes (HttpOnly + Secure + SameSite=Strict + Path=/)", async () => {
      const seed = await seedUser("login-attr@e2e.test", "correct-password");

      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });

      expect(response.status).toBe(200);
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];

      // access_token + refresh_token 두 cookie line 각각 박제.
      const accessLine = findCookieLine(cookies, ACCESS_TOKEN_COOKIE);
      const refreshLine = findCookieLine(cookies, REFRESH_TOKEN_COOKIE);
      expect(accessLine).toBeDefined();
      expect(refreshLine).toBeDefined();

      // ADR-0008 §2 attributes — 두 cookie 양쪽 모두 동일 박제 검증.
      [accessLine, refreshLine].forEach((line) => {
        expect(line).toBeDefined();
        if (line === undefined) {
          return;
        }
        // express cookie() 는 attribute 를 raw "HttpOnly", "Secure", "SameSite=Strict",
        // "Path=/" 형태로 박제. case 는 express 의 표준 박제 — 대소문자 정합.
        expect(line).toMatch(/HttpOnly/);
        expect(line).toMatch(/Secure/);
        expect(line).toMatch(/SameSite=Strict/);
        expect(line).toMatch(/Path=\//);
      });
    });

    it("error — 존재하지 않는 email 시 401 + 'Invalid credentials' (enumeration 차단)", async () => {
      // seed 0 — User 테이블 빈 상태에서 login 호출.
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: "non-existent@e2e.test",
          password: "any-password",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(LOGIN_INVALID_MESSAGE);
      // Set-Cookie 가 박제되지 않음 — 401 분기에서 cookie set 0.
      expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("error — password 불일치 시 401 + 동일 'Invalid credentials' (enumeration 차단 — error message 정합)", async () => {
      const seed = await seedUser(
        "login-wrong-pw@e2e.test",
        "correct-password",
      );

      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "wrong-password" });

      expect(response.status).toBe(401);
      // email 부재 분기와 동일 message — enumeration 차단 정합.
      expect(response.body.message).toBe(LOGIN_INVALID_MESSAGE);
      expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("negative — invalid email format (ValidationPipe @IsEmail 위반) → 400", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "not-an-email", password: "any-password" });

      expect(response.status).toBe(400);
    });

    it("negative — 빈 password (ValidationPipe @IsNotEmpty 위반) → 400", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "valid@e2e.test", password: "" });

      expect(response.status).toBe(400);
    });

    it("negative — whitelist 위반 (forbidNonWhitelisted, 추가 필드 role) → 400", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: "valid@e2e.test",
          password: "any-password",
          role: "SuperAdmin",
        });

      expect(response.status).toBe(400);
    });
  });

  // -- C. POST /api/auth/logout (≥ 3 it — happy / branch / negative) --------
  describe("POST /api/auth/logout", () => {
    it("happy — cookie 2 종 clear → 204 No Content (Set-Cookie Max-Age=0 또는 Expires=Thu, 01 Jan 1970)", async () => {
      // 먼저 login 으로 cookie 획득 — 정상 flow round-trip.
      const seed = await seedUser("logout-happy@e2e.test", "correct-password");
      const loginRes = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });
      expect(loginRes.status).toBe(200);
      const loginCookies = loginRes.headers["set-cookie"];
      const loginCookieArr = Array.isArray(loginCookies)
        ? loginCookies
        : loginCookies === undefined
          ? []
          : [loginCookies];

      // 획득한 cookie 를 logout 호출에 첨부.
      const cookieHeader = loginCookieArr
        .map((c) => c.split(";")[0])
        .join("; ");
      const response = await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Cookie", cookieHeader);

      expect(response.status).toBe(204);
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];

      // access_token + refresh_token 각각 clear (Max-Age=0 또는 Expires 과거).
      const accessLine = findCookieLine(cookies, ACCESS_TOKEN_COOKIE);
      const refreshLine = findCookieLine(cookies, REFRESH_TOKEN_COOKIE);
      expect(accessLine).toBeDefined();
      expect(refreshLine).toBeDefined();
      // express clearCookie 는 Expires=Thu, 01 Jan 1970 박제. (Max-Age=0 fallback
      // 도 있을 수 있으나 express 4.x default 는 Expires past date.)
      [accessLine, refreshLine].forEach((line) => {
        expect(line).toBeDefined();
        if (line === undefined) {
          return;
        }
        // 두 박제 중 하나 (Expires 과거 또는 Max-Age=0) 매칭.
        expect(line).toMatch(/(Expires=Thu, 01 Jan 1970|Max-Age=0)/);
      });
    });

    it("branch — idempotent: cookie 없이 호출 시에도 204 (guard 0 박제 — public endpoint)", async () => {
      const response = await request(app.getHttpServer()).post(
        "/api/auth/logout",
      );

      // guard 0 — cookie 부재 / 인증 부재 무관 정상 204.
      expect(response.status).toBe(204);
      // clearCookie 는 호출되므로 Set-Cookie 헤더는 박제됨.
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];
      expect(cookies.length).toBeGreaterThanOrEqual(2);
    });

    it("negative — clearCookie attributes 가 set 시점과 동일 (HttpOnly + Secure + SameSite=Strict + Path=/) — 브라우저 cookie 매칭 박제", async () => {
      const response = await request(app.getHttpServer()).post(
        "/api/auth/logout",
      );
      expect(response.status).toBe(204);
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];

      const accessLine = findCookieLine(cookies, ACCESS_TOKEN_COOKIE);
      const refreshLine = findCookieLine(cookies, REFRESH_TOKEN_COOKIE);
      expect(accessLine).toBeDefined();
      expect(refreshLine).toBeDefined();

      // ADR-0008 §2 정합 — clearCookie 가 set 시점과 동일 attribute 박제 안 하면
      // 브라우저가 다른 cookie 로 인식하여 제거 실패 가능.
      [accessLine, refreshLine].forEach((line) => {
        expect(line).toBeDefined();
        if (line === undefined) {
          return;
        }
        expect(line).toMatch(/HttpOnly/);
        expect(line).toMatch(/Secure/);
        expect(line).toMatch(/SameSite=Strict/);
        expect(line).toMatch(/Path=\//);
      });
    });
  });

  // -- D. POST /api/auth/refresh (≥ 5 it — happy / error / branch / negative) -
  describe("POST /api/auth/refresh", () => {
    it("happy — login → refresh cookie → rotation → 200 + 신규 access + refresh 2 종 박제", async () => {
      const seed = await seedUser("refresh-happy@e2e.test", "correct-password");
      const loginRes = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });
      expect(loginRes.status).toBe(200);

      const loginCookies = loginRes.headers["set-cookie"];
      const loginCookieArr = Array.isArray(loginCookies)
        ? loginCookies
        : loginCookies === undefined
          ? []
          : [loginCookies];
      const refreshCookieValue = extractCookieValue(
        loginCookieArr,
        REFRESH_TOKEN_COOKIE,
      );
      expect(refreshCookieValue).toBeDefined();

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshCookieValue}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ userId: seed.id });
      // 신규 cookie 2 종 박제 — rotation 정합.
      const rawSetCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie === undefined
          ? []
          : [rawSetCookie];
      expect(cookies).toHaveLength(2);
      expect(findCookieLine(cookies, ACCESS_TOKEN_COOKIE)).toBeDefined();
      expect(findCookieLine(cookies, REFRESH_TOKEN_COOKIE)).toBeDefined();
    });

    it("happy — role claim 보존 (SuperAdmin seed → login → refresh → 신규 access token payload.role === 'SuperAdmin')", async () => {
      const seed = await seedUser(
        "refresh-role@e2e.test",
        "correct-password",
        "SuperAdmin",
      );
      const loginRes = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });
      expect(loginRes.status).toBe(200);

      const loginCookies = loginRes.headers["set-cookie"];
      const loginCookieArr = Array.isArray(loginCookies)
        ? loginCookies
        : loginCookies === undefined
          ? []
          : [loginCookies];
      const refreshCookieValue = extractCookieValue(
        loginCookieArr,
        REFRESH_TOKEN_COOKIE,
      );
      expect(refreshCookieValue).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${refreshCookieValue}`);
      expect(refreshRes.status).toBe(200);

      const refreshSetCookie = refreshRes.headers["set-cookie"];
      const refreshCookieArr = Array.isArray(refreshSetCookie)
        ? refreshSetCookie
        : refreshSetCookie === undefined
          ? []
          : [refreshSetCookie];
      const newAccessToken = extractCookieValue(
        refreshCookieArr,
        ACCESS_TOKEN_COOKIE,
      );
      expect(newAccessToken).toBeDefined();

      // 신규 access token 의 payload.role 검증 — JwtService.verify (default secret).
      const payload = jwtService.verify<{ sub: string; role: string }>(
        newAccessToken ?? "",
      );
      expect(payload.sub).toBe(seed.id);
      expect(payload.role).toBe("SuperAdmin");
    });

    it("branch — rotation: refresh 후 신규 refresh_token 이 기존 refresh_token 과 다름 (rotation 정합)", async () => {
      const seed = await seedUser(
        "refresh-rotation@e2e.test",
        "correct-password",
      );
      const loginRes = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: seed.email, password: "correct-password" });
      const loginCookies = loginRes.headers["set-cookie"];
      const loginCookieArr = Array.isArray(loginCookies)
        ? loginCookies
        : loginCookies === undefined
          ? []
          : [loginCookies];
      const originalRefreshToken = extractCookieValue(
        loginCookieArr,
        REFRESH_TOKEN_COOKIE,
      );
      expect(originalRefreshToken).toBeDefined();

      // refresh 호출 — jsonwebtoken iat 의 초 단위 동일성으로 token 이 같아질 수
      // 있어, 1 초 대기 후 호출 (iat ≠ 이전 iat 보장).
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const refreshRes = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${originalRefreshToken}`);
      expect(refreshRes.status).toBe(200);

      const refreshSetCookie = refreshRes.headers["set-cookie"];
      const refreshCookieArr = Array.isArray(refreshSetCookie)
        ? refreshSetCookie
        : refreshSetCookie === undefined
          ? []
          : [refreshSetCookie];
      const newRefreshToken = extractCookieValue(
        refreshCookieArr,
        REFRESH_TOKEN_COOKIE,
      );
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(originalRefreshToken);
    });

    it("error — cookie 부재 시 401 + 'Invalid refresh token'", async () => {
      const response = await request(app.getHttpServer()).post(
        "/api/auth/refresh",
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
      expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("error — signature invalid (다른 secret 으로 sign) 시 401 + 동일 'Invalid refresh token' (enumeration 차단)", async () => {
      // 다른 secret 으로 sign 한 forged refresh token — refresh secret 과 mismatch.
      const forgedToken = jwtService.sign(
        { sub: "forged-user", role: "User" },
        {
          secret: "forged-different-secret-32bytes-min-1234567890",
          expiresIn: "7d",
        },
      );

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${forgedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
    });

    it("error — refresh token 만료 (TTL 1ms) 시 401 + 동일 'Invalid refresh token'", async () => {
      // 1ms TTL — sign 직후 즉시 만료. jsonwebtoken 표준 TokenExpiredError 분기 cover.
      const expiredToken = jwtService.sign(
        { sub: "expired-user", role: "User" },
        { secret: REFRESH_SECRET, expiresIn: "1ms" },
      );
      // exp 박제 완전 보장 위해 10ms 대기.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
    });

    it("negative — role claim 부재 시 401 (AuthController.refresh L227 분기 cover — payload 변조 차단)", async () => {
      // role 부재 payload — refresh secret 으로 sign (signature 는 valid). controller
      // 의 `payload.role === undefined || payload.role === ""` 분기에서 401 변환.
      const noRoleToken = jwtService.sign(
        { sub: "no-role-user" },
        { secret: REFRESH_SECRET, expiresIn: "7d" },
      );

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${noRoleToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
    });

    it("negative — sub claim 부재 시 401 (AuthController.refresh L224 분기 cover — payload 변조 차단)", async () => {
      // sub 부재 payload — refresh secret 으로 sign (signature 는 valid). controller
      // 의 `payload.sub === undefined || payload.sub === ""` 분기에서 401 변환.
      const noSubToken = jwtService.sign(
        { role: "User" },
        { secret: REFRESH_SECRET, expiresIn: "7d" },
      );

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${noSubToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
    });

    it("negative — 빈 cookie value 시 401 (cookie 부재와 동일 분기)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(REFRESH_INVALID_MESSAGE);
    });
  });
});

// -----------------------------------------------------------------------
// GET /api/auth/me — T-0106 acceptance §D 박제. User+ tier (JwtAuthGuard 만
// 적용, RolesGuard 미적용 — User/Admin/SuperAdmin 모두 동일 응답). e2e 책임:
// JwtAuthGuard 통과 검증 (cookie/token 박제) + UserResponseDto body shape
// regression (5 필드 + hashedPassword 누출 차단) + race window 404 (token 의 sub
// 가 가리키는 user row 가 동시 삭제됨).
//
// describe block 분리 이유 — 본 spec 의 위쪽 describe 는 login/logout/refresh
// 의 단일 createE2EApp 부트스트랩 + seedUser helper 패턴. 본 describe 는
// createAuthenticatedE2EApp 의 N user seed + token 발급 atomic 패턴 (users.e2e
// 의 GET /api/users/:id 박제와 1:1 정공법 정합). 두 패턴 mixed 시 lifecycle
// 충돌 가능 → 별도 describe 로 격리.
// -----------------------------------------------------------------------
describe("E2E: GET /api/auth/me — T-0106 User+ tier self-detail", () => {
  it("happy — User actor 가 /api/auth/me 호출 시 200 + UserResponseDto 5 필드 + hashedPassword 부재", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-user@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-user@e2e.test"];
      const token = ctx.tokens["me-user@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      // T-0095 UserResponseDto whitelist — 정확히 5 키 (id/email/role/
      // createdAt/updatedAt), hashedPassword 누출 차단.
      expect(response.body).toMatchObject({
        id: self.id,
        email: "me-user@e2e.test",
        role: "User",
      });
      expect(response.body).not.toHaveProperty("hashedPassword");
      expect(Object.keys(response.body).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("happy — Admin actor 도 동일 응답 (RolesGuard 미적용, User+ 동일 path)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "me-admin@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-admin@e2e.test"];
      const token = ctx.tokens["me-admin@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(self.id);
      expect(response.body.role).toBe("Admin");
      expect(response.body).not.toHaveProperty("hashedPassword");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("happy — SuperAdmin actor 도 동일 응답 (User+ tier escalation 자연 통과)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "me-super@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-super@e2e.test"];
      const token = ctx.tokens["me-super@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(self.id);
      expect(response.body.role).toBe("SuperAdmin");
      expect(response.body).not.toHaveProperty("hashedPassword");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — cookie 부재 시 401 (JwtAuthGuard 차단)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-no-cookie@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer()).get(
        "/api/auth/me",
      );

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — invalid JWT cookie 시 401 (JwtAuthGuard verify fail)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-invalid@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie("garbage.token.invalid"));

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — race window: valid token 이지만 DB user row 삭제됨 → 404 (UserService.findById NotFoundException 변환)", async () => {
    // seed 1 user → token 발급 → user row 삭제 → me 호출.
    // token 의 sub 는 valid (JwtAuthGuard 통과), 그러나 service.findById 가
    // null 반환 → NotFoundException (404) 자동 mapping. T-0101 패턴 정합.
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-race@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-race@e2e.test"];
      const token = ctx.tokens["me-race@e2e.test"];
      // user row 삭제 — stale token simulation.
      await ctx.prisma.user.delete({ where: { id: self.id } });

      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(404);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — expired token 시 401 (JwtStrategy verify TokenExpiredError)", async () => {
    // ctx 의 issueAccessTokenFor 는 15m TTL — 만료 token 직접 발급 위해
    // jwtService.sign 호출. 본 it 는 expired token 시 JwtAuthGuard 가 401 변환을
    // 확인 (T-0083 박제 — passport-jwt 의 standard behavior).
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-expired@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-expired@e2e.test"];
      // 1ms TTL — sign 직후 즉시 만료.
      const expiredToken = ctx.jwtService.sign(
        { sub: self.id, role: "User" },
        { expiresIn: "1ms" },
      );
      // exp 박제 보장 위해 50ms 대기.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(expiredToken));

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — 다른 secret 으로 sign 한 token 시 401 (signature mismatch)", async () => {
    // forged token — 다른 secret 으로 sign. JwtStrategy.verify 가 signature
    // mismatch 로 401 변환. issueAccessTokenFor 와 동일 helper 사용 패턴 — 단
    // secret override 로 forge 시뮬레이션.
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "me-forged@e2e.test" },
    ]);
    try {
      const self = ctx.users["me-forged@e2e.test"];
      // 다른 secret 으로 sign — JwtStrategy.secret 와 mismatch.
      const forgedToken = ctx.jwtService.sign(
        { sub: self.id, role: "User" },
        {
          secret: "different-forged-secret-32bytes-1234567890abcdef",
          expiresIn: "15m",
        },
      );

      const response = await request(ctx.app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", buildAuthCookie(forgedToken));

      expect(response.status).toBe(401);
      // issueAccessTokenFor import 사용 — helper API import lint 보호.
      expect(typeof issueAccessTokenFor).toBe("function");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });
});

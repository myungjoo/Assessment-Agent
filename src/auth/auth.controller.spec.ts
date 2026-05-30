// AuthController spec — T-0082 acceptance §E 박제. R-112 4 카테고리 (happy /
// error / branch / negative) + negative cases 충분 cover (6+ negative branch).
//
// 본 spec 은 두 부분으로 구성:
//   1. Unit-level (controller-only with mocked AuthService / UserRepository /
//      JwtService) — 3 endpoint 의 cookie set/clear / service 호출 인자 / 예외
//      propagation 검증. cookie attribute (HttpOnly/Secure/SameSite/Path) 4 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope
//      자동 활성화 + supertest + cookie-parser middleware) — DTO decorator 위반
//      negative + cookie round-trip + refresh negative branch.
//
// PrismaService 는 import path 가 등장하지 않으나 UserRepository → PrismaService chain
// 의 dep 안전성을 위해 jest.mock 으로 회피 (group.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
      create: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  NotFoundException,
  UnauthorizedException,
  type INestApplication,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import request from "supertest";

import { UserResponseDto } from "../user/dto/user-response.dto";
import { UserRepository } from "../user/user.repository";

import {
  ACCESS_TOKEN_COOKIE,
  AuthController,
  COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE,
} from "./auth.controller";
import { AuthService, REFRESH_SECRET_ENV } from "./auth.service";
/* eslint-enable import/first */

// Stable secret fixture — spec 안에서 동일 const 재사용 → isolation + 의도 명시.
const ACCESS_SECRET = "test-access-secret-32bytes-min-length-1234567890";
const REFRESH_SECRET = "test-refresh-secret-32bytes-min-length-9876543210";

// User fixture — schema.prisma User entity (T-0080 박제) shape 정합.
// password 컬럼은 bcrypt hash 가정 — verifyPassword mock 으로 분기 control.
function buildUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: "user-default",
    email: "hong@example.com",
    // 본 spec 안 verifyPassword 가 mock 이라 실제 hash 값은 무관 — placeholder.
    hashedPassword: "$2b$10$placeholder.hash.for.spec.fixture.purpose.only",
    role: "User",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Service / repository mock factory — 각 describe 마다 fresh.
// T-0106 — userRepositoryMock 에 findById 추가 (`me()` endpoint 가 직접 호출).
// UserService inject 추가는 AuthModule↔UserModule forwardRef circular chain race
// (user.module.spec NestJS injector unhandledPromiseRejection) 회피 위해 채택
// 안 함 — UserRepository.findById null-safe API 직접 호출 + controller-layer
// inline null → NotFoundException 변환 패턴 (T-0101 UserService.findById 1:1 mirror).
function buildControllerWithMocks(): {
  controller: AuthController;
  authServiceMock: {
    verifyPassword: jest.Mock;
    issueAccessToken: jest.Mock;
    issueRefreshToken: jest.Mock;
  };
  userRepositoryMock: { findByEmail: jest.Mock; findById: jest.Mock };
  jwtServiceMock: { verify: jest.Mock };
} {
  const authServiceMock = {
    verifyPassword: jest.fn(),
    issueAccessToken: jest.fn(),
    issueRefreshToken: jest.fn(),
  };
  const userRepositoryMock = { findByEmail: jest.fn(), findById: jest.fn() };
  const jwtServiceMock = { verify: jest.fn() };
  const controller = new AuthController(
    authServiceMock as unknown as AuthService,
    userRepositoryMock as unknown as UserRepository,
    jwtServiceMock as unknown as JwtService,
  );
  return {
    controller,
    authServiceMock,
    userRepositoryMock,
    jwtServiceMock,
  };
}

// res mock factory — express Response 의 cookie / clearCookie 호출 추적용.
function buildResMock(): {
  res: Response;
  cookieMock: jest.Mock;
  clearCookieMock: jest.Mock;
} {
  const cookieMock = jest.fn();
  const clearCookieMock = jest.fn();
  const res = {
    cookie: cookieMock,
    clearCookie: clearCookieMock,
  } as unknown as Response;
  return { res, cookieMock, clearCookieMock };
}

describe("AuthController (unit)", () => {
  // env 백업 / 복원 — refresh secret 이 process.env 직접 read 의존성.
  let originalRefreshSecret: string | undefined;

  beforeEach(() => {
    originalRefreshSecret = process.env[REFRESH_SECRET_ENV];
    process.env[REFRESH_SECRET_ENV] = REFRESH_SECRET;
  });

  afterEach(() => {
    if (originalRefreshSecret === undefined) {
      delete process.env[REFRESH_SECRET_ENV];
    } else {
      process.env[REFRESH_SECRET_ENV] = originalRefreshSecret;
    }
  });

  // -----------------------------------------------------------------------
  // login — happy + 분기 user 존재 vs 부재 + password 일치 vs 불일치.
  // -----------------------------------------------------------------------
  describe("login() (POST /api/auth/login)", () => {
    it("정상 email + password → 200 + cookie set 2 종 + { userId } 반환 (happy)", async () => {
      const { controller, authServiceMock, userRepositoryMock } =
        buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const user = buildUserFixture({ id: "u-1" });
      userRepositoryMock.findByEmail.mockResolvedValueOnce(user);
      authServiceMock.verifyPassword.mockResolvedValueOnce(true);
      authServiceMock.issueAccessToken.mockReturnValueOnce("access.jwt.token");
      authServiceMock.issueRefreshToken.mockReturnValueOnce(
        "refresh.jwt.token",
      );

      const result = await controller.login(
        { email: "hong@example.com", password: "pw" },
        res,
      );

      // service / repository 호출 인자 1:1 검증.
      expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith(
        "hong@example.com",
      );
      expect(authServiceMock.verifyPassword).toHaveBeenCalledWith(
        "pw",
        user.hashedPassword,
      );
      // T-0083 §A — issueAccessToken/issueRefreshToken 의 2 번째 인자 = user.role.
      expect(authServiceMock.issueAccessToken).toHaveBeenCalledWith(
        "u-1",
        user.role,
      );
      expect(authServiceMock.issueRefreshToken).toHaveBeenCalledWith(
        "u-1",
        user.role,
      );
      // cookie set 2 종 — name / token / 4 attribute 모두 검증.
      expect(cookieMock).toHaveBeenCalledTimes(2);
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        ACCESS_TOKEN_COOKIE,
        "access.jwt.token",
        COOKIE_OPTIONS,
      );
      expect(cookieMock).toHaveBeenNthCalledWith(
        2,
        REFRESH_TOKEN_COOKIE,
        "refresh.jwt.token",
        COOKIE_OPTIONS,
      );
      // COOKIE_OPTIONS 의 4 attribute (HttpOnly/Secure/SameSite/Path) 정확 박제.
      expect(COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS.secure).toBe(true);
      expect(COOKIE_OPTIONS.sameSite).toBe("strict");
      expect(COOKIE_OPTIONS.path).toBe("/");
      expect(result).toEqual({ userId: "u-1" });
    });

    it("email 부재 (findByEmail null) → 401 + cookie set 안 됨 (error/negative #1)", async () => {
      const { controller, authServiceMock, userRepositoryMock } =
        buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      userRepositoryMock.findByEmail.mockResolvedValueOnce(null);

      await expect(
        controller.login({ email: "nobody@example.com", password: "pw" }, res),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // password verify 호출 안 됨 — short-circuit.
      expect(authServiceMock.verifyPassword).not.toHaveBeenCalled();
      // cookie 호출 0.
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("password 불일치 (verifyPassword false) → 401 + cookie set 안 됨 (error/negative #2)", async () => {
      const { controller, authServiceMock, userRepositoryMock } =
        buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const user = buildUserFixture();
      userRepositoryMock.findByEmail.mockResolvedValueOnce(user);
      authServiceMock.verifyPassword.mockResolvedValueOnce(false);

      await expect(
        controller.login({ email: user.email, password: "wrong-pw" }, res),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // issueAccessToken / issueRefreshToken 호출 안 됨 — short-circuit.
      expect(authServiceMock.issueAccessToken).not.toHaveBeenCalled();
      expect(authServiceMock.issueRefreshToken).not.toHaveBeenCalled();
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("UserRepository.findByEmail throw → 그대로 propagate (negative #3 — raw error)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      const rawError = new Error("unexpected DB outage");
      userRepositoryMock.findByEmail.mockRejectedValueOnce(rawError);

      // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e 차원.
      await expect(
        controller.login({ email: "a@b.com", password: "pw" }, res),
      ).rejects.toBe(rawError);
    });

    it("verifyPassword throw → 그대로 propagate (negative #4 — bcrypt corrupt hash)", async () => {
      const { controller, authServiceMock, userRepositoryMock } =
        buildControllerWithMocks();
      const { res } = buildResMock();
      const user = buildUserFixture();
      userRepositoryMock.findByEmail.mockResolvedValueOnce(user);
      const corruptError = new Error("bcrypt: corrupt hash");
      authServiceMock.verifyPassword.mockRejectedValueOnce(corruptError);

      await expect(
        controller.login({ email: user.email, password: "pw" }, res),
      ).rejects.toBe(corruptError);
    });

    it("enumeration attack 차단 — email 부재와 password 불일치의 응답 메시지 동일 (branch — same error)", async () => {
      // email 부재 분기
      const { controller: c1, userRepositoryMock: u1 } =
        buildControllerWithMocks();
      const { res: res1 } = buildResMock();
      u1.findByEmail.mockResolvedValueOnce(null);
      let err1: UnauthorizedException | null = null;
      try {
        await c1.login({ email: "x@y.com", password: "pw" }, res1);
      } catch (e) {
        err1 = e as UnauthorizedException;
      }
      // password 불일치 분기
      const {
        controller: c2,
        authServiceMock: a2,
        userRepositoryMock: u2,
      } = buildControllerWithMocks();
      const { res: res2 } = buildResMock();
      u2.findByEmail.mockResolvedValueOnce(buildUserFixture());
      a2.verifyPassword.mockResolvedValueOnce(false);
      let err2: UnauthorizedException | null = null;
      try {
        await c2.login({ email: "x@y.com", password: "pw" }, res2);
      } catch (e) {
        err2 = e as UnauthorizedException;
      }
      // 두 응답의 message 가 동일 (enumeration 차단).
      expect(err1?.message).toBe("Invalid credentials");
      expect(err2?.message).toBe("Invalid credentials");
    });
  });

  // -----------------------------------------------------------------------
  // logout — happy + idempotent (cookie 부재 상태에서도 정상).
  // -----------------------------------------------------------------------
  describe("logout() (POST /api/auth/logout)", () => {
    it("clearCookie 2 종 호출 (access + refresh) + 응답 void (happy)", () => {
      const { controller } = buildControllerWithMocks();
      const { res, clearCookieMock } = buildResMock();

      const result = controller.logout(res);

      expect(clearCookieMock).toHaveBeenCalledTimes(2);
      expect(clearCookieMock).toHaveBeenNthCalledWith(
        1,
        ACCESS_TOKEN_COOKIE,
        COOKIE_OPTIONS,
      );
      expect(clearCookieMock).toHaveBeenNthCalledWith(
        2,
        REFRESH_TOKEN_COOKIE,
        COOKIE_OPTIONS,
      );
      expect(result).toBeUndefined();
    });

    it("cookie 미존재 상태에서도 clearCookie 정상 호출 (negative — idempotent)", () => {
      // logout 은 인증 상태와 무관하게 호출 가능 — clearCookie 의 idempotent
      // semantic 박제. unit-level 은 controller 가 cookie 존재 여부 검사 0 임을 검증.
      const { controller } = buildControllerWithMocks();
      const { res, clearCookieMock } = buildResMock();

      // 2 회 연속 호출도 정상 (실 사용 사례 — refresh 후 즉시 logout 같은 sequence).
      controller.logout(res);
      controller.logout(res);

      expect(clearCookieMock).toHaveBeenCalledTimes(4);
    });
  });

  // -----------------------------------------------------------------------
  // refresh — happy + negative 6+ (cookie 부재 / 빈 / expired / signature
  // invalid / payload sub 부재 / refresh secret env 미설정 fallback).
  // -----------------------------------------------------------------------
  describe("refresh() (POST /api/auth/refresh)", () => {
    // req mock helper — cookies 객체만 박제 (express Request 의 다른 path 는 미사용).
    function buildReqMock(
      cookies: Record<string, string | undefined>,
    ): Request {
      return { cookies } as unknown as Request;
    }

    it("정상 refresh cookie → JwtService.verify (refresh secret override) → 신규 access + refresh 발급 + cookie set + { userId } (happy)", () => {
      const { controller, authServiceMock, jwtServiceMock } =
        buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "old.refresh.jwt" });
      // T-0083 §A — payload 에 role claim 박제, rotation 이 role 보존.
      jwtServiceMock.verify.mockReturnValueOnce({
        sub: "u-1",
        role: "Admin",
        iat: 1,
        exp: 2,
      });
      authServiceMock.issueAccessToken.mockReturnValueOnce("new.access.jwt");
      authServiceMock.issueRefreshToken.mockReturnValueOnce("new.refresh.jwt");

      const result = controller.refresh(req, res);

      // JwtService.verify 호출 인자 검증 — refresh secret override.
      expect(jwtServiceMock.verify).toHaveBeenCalledWith("old.refresh.jwt", {
        secret: REFRESH_SECRET,
      });
      // rotation — 신규 token 2 종 발급 + cookie set 2 종. role 보존 (payload.role → 신규 token).
      expect(authServiceMock.issueAccessToken).toHaveBeenCalledWith(
        "u-1",
        "Admin",
      );
      expect(authServiceMock.issueRefreshToken).toHaveBeenCalledWith(
        "u-1",
        "Admin",
      );
      expect(cookieMock).toHaveBeenCalledTimes(2);
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        ACCESS_TOKEN_COOKIE,
        "new.access.jwt",
        COOKIE_OPTIONS,
      );
      expect(cookieMock).toHaveBeenNthCalledWith(
        2,
        REFRESH_TOKEN_COOKIE,
        "new.refresh.jwt",
        COOKIE_OPTIONS,
      );
      expect(result).toEqual({ userId: "u-1" });
    });

    it("refresh cookie 부재 (cookies 객체에 없음) → 401 + verify 호출 안 됨 (negative #1)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const req = buildReqMock({});

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("refresh cookie 빈 문자열 → 401 (negative #2)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "" });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
    });

    it("req.cookies 자체가 undefined → 401 (negative #3 — cookie-parser middleware 미장착 hypothetical)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      // cookies 가 undefined 인 가설 — controller 가 optional chaining 으로 안전 가드.
      const req = { cookies: undefined } as unknown as Request;

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
    });

    it("JwtService.verify throw TokenExpiredError → 401 (negative #4)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "expired.jwt" });
      // jsonwebtoken 의 TokenExpiredError 를 모사 (실 class 미import — generic Error).
      const expiredError = new Error("jwt expired");
      expiredError.name = "TokenExpiredError";
      jwtServiceMock.verify.mockImplementationOnce(() => {
        throw expiredError;
      });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      // rotation 호출 안 됨.
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("JwtService.verify throw JsonWebTokenError (signature invalid) → 401 (negative #5)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "tampered.jwt" });
      const signatureError = new Error("invalid signature");
      signatureError.name = "JsonWebTokenError";
      jwtServiceMock.verify.mockImplementationOnce(() => {
        throw signatureError;
      });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
    });

    it("verify payload 의 sub 부재 (sub === undefined) → 401 (negative #6)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "valid.jwt" });
      jwtServiceMock.verify.mockReturnValueOnce({
        role: "User",
        iat: 1,
        exp: 2,
      });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("verify payload 의 sub 가 빈 문자열 → 401 (negative #7)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "valid.jwt" });
      jwtServiceMock.verify.mockReturnValueOnce({ sub: "", role: "User" });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
    });

    it("verify payload 의 role 부재 (role === undefined) → 401 (negative #7b — T-0083 §A)", () => {
      // T-0083 §A — payload.role 부재 시 401. legacy token 또는 forged token 차단.
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res, cookieMock } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "valid.jwt" });
      jwtServiceMock.verify.mockReturnValueOnce({ sub: "u-1", iat: 1, exp: 2 });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      expect(cookieMock).not.toHaveBeenCalled();
    });

    it("verify payload 의 role 이 빈 문자열 → 401 (negative #7c — T-0083 §A)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "valid.jwt" });
      jwtServiceMock.verify.mockReturnValueOnce({ sub: "u-1", role: "" });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
    });

    it("refresh secret env 미설정 시 빈 문자열 fallback → verify 가 자동 fail → 401 (negative #8 — env fallback path)", () => {
      const { controller, jwtServiceMock } = buildControllerWithMocks();
      const { res } = buildResMock();
      delete process.env[REFRESH_SECRET_ENV];
      const req = buildReqMock({ [REFRESH_TOKEN_COOKIE]: "some.jwt" });
      // 빈 secret 으로 verify → jsonwebtoken signature mismatch fail.
      jwtServiceMock.verify.mockImplementationOnce(() => {
        const err = new Error("invalid signature");
        err.name = "JsonWebTokenError";
        throw err;
      });

      expect(() => controller.refresh(req, res)).toThrow(UnauthorizedException);
      // verify 호출 인자 의 secret 이 빈 문자열인지 검증 — fallback path 박제.
      expect(jwtServiceMock.verify).toHaveBeenCalledWith("some.jwt", {
        secret: "",
      });
    });
  });

  // -----------------------------------------------------------------------
  // me — GET /api/auth/me (T-0106). happy + error + negative 6+ cover.
  // 본 endpoint 는 JwtAuthGuard 통과 후 req.user.sub 추출 → UserRepository.findById
  // 호출 + null → NotFoundException 변환 → UserResponseDto.fromEntity 변환. R-112
  // 4 카테고리 + negative 충분.
  // -----------------------------------------------------------------------
  describe("me() (GET /api/auth/me)", () => {
    // req mock helper — JwtAuthGuard 통과 후 req.user 박제 가정.
    function buildReqMockWithUser(
      user: { sub?: string; role?: string } | undefined,
    ): Request {
      return { user } as unknown as Request;
    }

    it("happy — req.user.sub valid + userRepository.findById User 반환 → UserResponseDto shape (5 필드, hashedPassword 부재)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const fixture = buildUserFixture({ id: "u-me-1", role: "User" });
      userRepositoryMock.findById.mockResolvedValueOnce(fixture);
      const req = buildReqMockWithUser({ sub: "u-me-1", role: "User" });

      const result = await controller.me(req);

      // repository.findById 호출 인자 — req.user.sub 정합.
      expect(userRepositoryMock.findById).toHaveBeenCalledWith("u-me-1");
      // 반환은 UserResponseDto instance — 5 readonly 필드 (id/email/role/
      // createdAt/updatedAt) 모두 fixture 정합.
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe("u-me-1");
      expect(result.email).toBe(fixture.email);
      expect(result.role).toBe("User");
      expect(result.createdAt).toBe(fixture.createdAt);
      expect(result.updatedAt).toBe(fixture.updatedAt);
      // T-0095 hashedPassword 차단 invariant — 응답 객체에 hashedPassword 키 부재.
      expect(result).not.toHaveProperty("hashedPassword");
    });

    it("error — userRepository.findById null 반환 시 NotFoundException 변환 (race window stale token / DB row 동시 삭제)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      userRepositoryMock.findById.mockResolvedValueOnce(null);
      const req = buildReqMockWithUser({ sub: "u-missing", role: "User" });

      // controller 가 null → NotFoundException 변환. T-0101 UserService.findById
      // 패턴 1:1 mirror. NestJS exception filter 가 404 status 자동 mapping.
      await expect(controller.me(req)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userRepositoryMock.findById).toHaveBeenCalledWith("u-missing");
    });

    it("negative #1 — req.user 자체가 undefined 시 UnauthorizedException (defence in depth)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const req = buildReqMockWithUser(undefined);

      await expect(controller.me(req)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // repository 호출 0 — short-circuit.
      expect(userRepositoryMock.findById).not.toHaveBeenCalled();
    });

    it("negative #2 — req.user.sub === undefined 시 UnauthorizedException", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const req = buildReqMockWithUser({ role: "User" });

      await expect(controller.me(req)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userRepositoryMock.findById).not.toHaveBeenCalled();
    });

    it("negative #3 — req.user.sub === '' (빈 문자열) 시 UnauthorizedException", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const req = buildReqMockWithUser({ sub: "", role: "User" });

      await expect(controller.me(req)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userRepositoryMock.findById).not.toHaveBeenCalled();
    });

    it("negative #4 — userRepository.findById throw raw Error (DB outage 등 unexpected) → 그대로 propagate (500 변환)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const rawError = new Error("unexpected DB outage");
      userRepositoryMock.findById.mockRejectedValueOnce(rawError);
      const req = buildReqMockWithUser({ sub: "u-1", role: "User" });

      // controller 가 raw Error 변환 0 — NestJS default 500 자동 mapping (e2e 차원).
      await expect(controller.me(req)).rejects.toBe(rawError);
    });

    it("negative #5 — User entity 의 hashedPassword 컬럼 응답 누출 차단 (T-0095 fromEntity whitelist)", async () => {
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      // fixture 의 hashedPassword 컬럼 — fromEntity 의 whitelist 가 차단해야 함.
      const fixture = buildUserFixture({
        id: "u-leak-check",
        hashedPassword: "$2b$10$SHOULD-NEVER-LEAK",
      });
      userRepositoryMock.findById.mockResolvedValueOnce(fixture);
      const req = buildReqMockWithUser({ sub: "u-leak-check", role: "User" });

      const result = await controller.me(req);

      // T-0095 invariant — fromEntity whitelist 가 hashedPassword 컬럼 차단.
      expect(result).not.toHaveProperty("hashedPassword");
      // 응답 키 정확히 5 종 (id/email/role/createdAt/updatedAt).
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    });

    it("branch — Admin role token 의 me 호출도 동일 흐름 (role 분기 0, User+ tier)", async () => {
      // 본 endpoint 는 RolesGuard 미적용 — Admin / SuperAdmin / User 모두 동일 path.
      // 본 unit-level 검증은 controller 자체에 role 분기 0 임을 명시 박제.
      const { controller, userRepositoryMock } = buildControllerWithMocks();
      const fixture = buildUserFixture({ id: "u-admin", role: "Admin" });
      userRepositoryMock.findById.mockResolvedValueOnce(fixture);
      const req = buildReqMockWithUser({ sub: "u-admin", role: "Admin" });

      const result = await controller.me(req);

      expect(userRepositoryMock.findById).toHaveBeenCalledWith("u-admin");
      expect(result.role).toBe("Admin");
    });
  });
});

// -----------------------------------------------------------------------
// Integration — controller-scope @UsePipes(ValidationPipe) + cookie-parser
// middleware. supertest 로 실제 HTTP status / Set-Cookie header 검증.
// AuthService / UserRepository / JwtService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — ValidationPipe negative 6 case + cookie
// round-trip 1 case + refresh negative 1 case.
// -----------------------------------------------------------------------
describe("AuthController (ValidationPipe + cookie integration)", () => {
  let app: INestApplication;
  let authServiceMock: {
    verifyPassword: jest.Mock;
    issueAccessToken: jest.Mock;
    issueRefreshToken: jest.Mock;
  };
  // T-0106 — findById 추가 (`me()` endpoint 의 단일 호출).
  let userRepositoryMock: { findByEmail: jest.Mock; findById: jest.Mock };
  let jwtServiceMock: { verify: jest.Mock };
  let originalRefreshSecret: string | undefined;

  beforeEach(async () => {
    originalRefreshSecret = process.env[REFRESH_SECRET_ENV];
    process.env[REFRESH_SECRET_ENV] = REFRESH_SECRET;
    process.env.AUTH_JWT_SECRET = ACCESS_SECRET;

    authServiceMock = {
      verifyPassword: jest.fn(),
      issueAccessToken: jest.fn(),
      issueRefreshToken: jest.fn(),
    };
    userRepositoryMock = { findByEmail: jest.fn(), findById: jest.fn() };
    jwtServiceMock = { verify: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UserRepository, useValue: userRepositoryMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // cookie-parser middleware — refresh endpoint 의 req.cookies 자동 parsing.
    app.use(cookieParser());
    // Controller-scope @UsePipes 가 자동 활성화.
    await app.init();
  });

  afterEach(async () => {
    if (originalRefreshSecret === undefined) {
      delete process.env[REFRESH_SECRET_ENV];
    } else {
      process.env[REFRESH_SECRET_ENV] = originalRefreshSecret;
    }
    await app.close();
  });

  // ---- LoginDto ValidationPipe negative cases (6 case) -----------------

  it("정상 payload 통과 후 200 + Set-Cookie 2 종 (HttpOnly/Secure/SameSite=Strict/Path=/) (sanity)", async () => {
    const user = buildUserFixture({ id: "u-99" });
    userRepositoryMock.findByEmail.mockResolvedValueOnce(user);
    authServiceMock.verifyPassword.mockResolvedValueOnce(true);
    authServiceMock.issueAccessToken.mockReturnValueOnce("a.j.t");
    authServiceMock.issueRefreshToken.mockReturnValueOnce("r.j.t");

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "hong@example.com", password: "pw" })
      .expect(200);

    expect(res.body).toEqual({ userId: "u-99" });
    // Set-Cookie header 2 종 (string 또는 string[]) — supertest 가 string[] 으로
    // 반환. cookie attribute 4 종 (HttpOnly/Secure/SameSite=Strict/Path=/) 정합.
    const setCookieRaw = res.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieRaw)
      ? setCookieRaw
      : [setCookieRaw];
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("access_token=a.j.t");
    expect(setCookies[0]).toContain("HttpOnly");
    expect(setCookies[0]).toContain("Secure");
    expect(setCookies[0]).toContain("SameSite=Strict");
    expect(setCookies[0]).toContain("Path=/");
    expect(setCookies[1]).toContain("refresh_token=r.j.t");
    expect(setCookies[1]).toContain("HttpOnly");
    expect(setCookies[1]).toContain("Secure");
    expect(setCookies[1]).toContain("SameSite=Strict");
  });

  it("email 누락 시 400 (ValidationPipe negative #1)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ password: "pw" })
      .expect(400);

    expect(userRepositoryMock.findByEmail).not.toHaveBeenCalled();
  });

  it("password 누락 시 400 (ValidationPipe negative #2)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "a@b.com" })
      .expect(400);
  });

  it("email 형식 RFC 위반 시 400 (ValidationPipe negative #3)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "not-email", password: "pw" })
      .expect(400);
  });

  it("password 빈 문자열 시 400 (ValidationPipe negative #4)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "" })
      .expect(400);
  });

  it("정의되지 않은 필드 (`foo`) 포함 시 400 (ValidationPipe negative #5 — forbidNonWhitelisted)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "pw", foo: "bar" })
      .expect(400);
  });

  it("password 가 number 시 400 (ValidationPipe negative #6 — wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: 12345 })
      .expect(400);
  });

  // ---- login 인증 실패 → 401 (supertest integration error path) ---------

  it("email 부재 (findByEmail null) → 401 + Set-Cookie 없음 (integration error #1)", async () => {
    userRepositoryMock.findByEmail.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "pw" })
      .expect(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("password 불일치 → 401 + Set-Cookie 없음 (integration error #2)", async () => {
    userRepositoryMock.findByEmail.mockResolvedValueOnce(buildUserFixture());
    authServiceMock.verifyPassword.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "hong@example.com", password: "wrong" })
      .expect(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  // ---- logout — 204 + Set-Cookie (clear) 2 종 ---------------------------

  it("POST /api/auth/logout → 204 + Set-Cookie clear 2 종 (Max-Age=0 or Expires past)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .expect(204);

    const setCookieRaw = res.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieRaw)
      ? setCookieRaw
      : [setCookieRaw];
    expect(setCookies).toHaveLength(2);
    // clearCookie 의 결과 — Expires 가 과거 시점 또는 Max-Age=0.
    expect(setCookies[0]).toContain("access_token=;");
    expect(setCookies[1]).toContain("refresh_token=;");
  });

  // ---- refresh — happy + negative (cookie 부재 / verify fail) -----------

  it("POST /api/auth/refresh + 유효 refresh cookie → 200 + 신규 cookie set 2 종 + { userId }", async () => {
    jwtServiceMock.verify.mockReturnValueOnce({ sub: "u-77", role: "User" });
    authServiceMock.issueAccessToken.mockReturnValueOnce("new.a.j.t");
    authServiceMock.issueRefreshToken.mockReturnValueOnce("new.r.j.t");

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=old.refresh.jwt`)
      .expect(200);

    expect(res.body).toEqual({ userId: "u-77" });
    expect(jwtServiceMock.verify).toHaveBeenCalledWith("old.refresh.jwt", {
      secret: REFRESH_SECRET,
    });
    const setCookieRaw = res.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieRaw)
      ? setCookieRaw
      : [setCookieRaw];
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("access_token=new.a.j.t");
    expect(setCookies[1]).toContain("refresh_token=new.r.j.t");
  });

  it("POST /api/auth/refresh — refresh cookie 부재 → 401 (integration negative)", async () => {
    await request(app.getHttpServer()).post("/api/auth/refresh").expect(401);

    expect(jwtServiceMock.verify).not.toHaveBeenCalled();
  });

  it("POST /api/auth/refresh — verify throw → 401 + 신규 cookie set 안 됨 (integration negative)", async () => {
    const err = new Error("jwt expired");
    err.name = "TokenExpiredError";
    jwtServiceMock.verify.mockImplementationOnce(() => {
      throw err;
    });

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=expired.jwt`)
      .expect(401);

    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

// auth-e2e-helper.spec.ts — auth-e2e-helper.ts 의 stateless 3 helper R-112 cover
// (T-0091 박제). colocated unit spec — jest 의 default testRegex `.*\.spec\.ts$` 가
// 본 파일을 picking, package.json 의 testPathIgnorePatterns 가 test/e2e/ 만 제외하므로
// test/helpers/ 의 `.spec.ts` 는 unit config 안에서 정상 실행.
//
// 책임:
//   - issueAccessTokenFor / buildAuthCookie / TEST_AUTH_JWT_SECRET 3 helper 의 4 카테고리
//     (happy / branch / error / negative) cover.
//   - createAuthenticatedE2EApp 의 실 DB 의존 happy path 는 본 spec scope 외 —
//     auth-e2e-helper.e2e-spec.ts (D 항목) 책임.
//   - mock JwtService 패턴: `const mockJwt = { sign: jest.fn() } as unknown as JwtService`.
//     실 JwtService 의 sign 만 사용 — 다른 메서드 mock 불요.
import { JwtService } from "@nestjs/jwt";

import {
  TEST_AUTH_JWT_SECRET,
  buildAuthCookie,
  issueAccessTokenFor,
} from "./auth-e2e-helper";

describe("auth-e2e-helper (T-0091)", () => {
  // -- issueAccessTokenFor --------------------------------------------------
  describe("issueAccessTokenFor", () => {
    it("happy — JwtService.sign 이 { sub, role } payload + { expiresIn: '15m' } 으로 호출", () => {
      const signMock = jest.fn().mockReturnValue("mock-token-abc");
      const mockJwt = { sign: signMock } as unknown as JwtService;

      const token = issueAccessTokenFor(mockJwt, {
        id: "user-1",
        role: "SuperAdmin",
      });

      expect(signMock).toHaveBeenCalledTimes(1);
      expect(signMock).toHaveBeenCalledWith(
        { sub: "user-1", role: "SuperAdmin" },
        { expiresIn: "15m" },
      );
      expect(token).toBe("mock-token-abc");
    });

    it("branch — Admin role 도 동일 contract 로 호출 (role 값만 차이)", () => {
      const signMock = jest.fn().mockReturnValue("admin-token");
      const mockJwt = { sign: signMock } as unknown as JwtService;

      issueAccessTokenFor(mockJwt, { id: "user-2", role: "Admin" });

      expect(signMock).toHaveBeenCalledWith(
        { sub: "user-2", role: "Admin" },
        { expiresIn: "15m" },
      );
    });

    it("branch — User role 도 동일 contract 로 호출 (3 종 role 분기 cover)", () => {
      const signMock = jest.fn().mockReturnValue("user-token");
      const mockJwt = { sign: signMock } as unknown as JwtService;

      issueAccessTokenFor(mockJwt, { id: "user-3", role: "User" });

      expect(signMock).toHaveBeenCalledWith(
        { sub: "user-3", role: "User" },
        { expiresIn: "15m" },
      );
    });

    it("error — jwtService null 시 TypeError throw (R-112 error 카테고리)", () => {
      expect(() =>
        issueAccessTokenFor(null as unknown as JwtService, {
          id: "x",
          role: "User",
        }),
      ).toThrow(TypeError);
    });

    it("error — jwtService undefined 시 TypeError throw (negative 분기)", () => {
      expect(() =>
        issueAccessTokenFor(undefined as unknown as JwtService, {
          id: "x",
          role: "User",
        }),
      ).toThrow(TypeError);
    });

    it("error — user null 시 TypeError throw (R-112 error 카테고리)", () => {
      const mockJwt = { sign: jest.fn() } as unknown as JwtService;
      expect(() =>
        issueAccessTokenFor(
          mockJwt,
          null as unknown as { id: string; role: "User" },
        ),
      ).toThrow(TypeError);
    });

    it("negative — user undefined 시 TypeError throw (negative 분기 cover)", () => {
      const mockJwt = { sign: jest.fn() } as unknown as JwtService;
      expect(() =>
        issueAccessTokenFor(
          mockJwt,
          undefined as unknown as { id: string; role: "User" },
        ),
      ).toThrow(TypeError);
    });
  });

  // -- buildAuthCookie ------------------------------------------------------
  describe("buildAuthCookie", () => {
    it("happy — token 을 `access_token=<token>` 형식으로 반환", () => {
      expect(buildAuthCookie("test-token-123")).toBe(
        "access_token=test-token-123",
      );
    });

    it("branch — SuperAdmin/Admin/User 3 종 role 의 token 모두 동일 prefix `access_token=`", () => {
      // role 무관 cookie 형식 일관성 박제 — cookie 형식은 token 의 role claim 과 무관.
      const superToken = "super.token.xxx";
      const adminToken = "admin.token.yyy";
      const userToken = "user.token.zzz";

      expect(buildAuthCookie(superToken).startsWith("access_token=")).toBe(
        true,
      );
      expect(buildAuthCookie(adminToken).startsWith("access_token=")).toBe(
        true,
      );
      expect(buildAuthCookie(userToken).startsWith("access_token=")).toBe(true);
    });

    it("negative — empty token 시 `access_token=` (raw concat 박제)", () => {
      // helper 가 empty string 도 허용 — 호출 측 contract 박제용 (실 사용 시점에서
      // empty token 은 401 로 자연 reject, helper 책임 외).
      expect(buildAuthCookie("")).toBe("access_token=");
    });

    it("negative — token 에 special chars (=, ;, 공백) 포함 시 raw concat (encoding 책임 호출 측)", () => {
      // RFC 6265 cookie 값은 일반적으로 base64url JWT 라 encoding issue 0. 본 spec 은
      // helper 의 raw concat contract 박제 — encoding 책임은 호출 측.
      const weirdToken = "abc=def;ghi jkl";
      expect(buildAuthCookie(weirdToken)).toBe("access_token=abc=def;ghi jkl");
    });
  });

  // -- TEST_AUTH_JWT_SECRET / process.env.AUTH_JWT_SECRET ------------------
  describe("TEST_AUTH_JWT_SECRET / process.env.AUTH_JWT_SECRET", () => {
    it("happy — TEST_AUTH_JWT_SECRET const 가 non-empty string", () => {
      expect(typeof TEST_AUTH_JWT_SECRET).toBe("string");
      expect(TEST_AUTH_JWT_SECRET.length).toBeGreaterThan(0);
    });

    it("negative — helper module load 후 process.env.AUTH_JWT_SECRET 정의됨 (??= 박제 검증)", () => {
      // helper 의 `process.env.AUTH_JWT_SECRET ??= TEST_AUTH_JWT_SECRET` 박제 검증.
      // import 만으로 process.env 가 채워짐 — JwtStrategy.constructor (src/auth/
      // jwt.strategy.ts L57-67) 의 module init 시점 secret bind 정합 보장.
      expect(typeof process.env.AUTH_JWT_SECRET).toBe("string");
      expect((process.env.AUTH_JWT_SECRET ?? "").length).toBeGreaterThan(0);
    });
  });
});

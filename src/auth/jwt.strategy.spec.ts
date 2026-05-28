// JwtStrategy spec — T-0083 acceptance §B 박제. R-112 4 카테고리 (happy / error /
// branch / negative) + negative cases 충분 cover (cookie 부재 / 빈 cookie / payload
// sub 부재 / payload role 부재 / payload 자체 부재 / 정상 payload happy / strategy
// name "jwt" 박제 검증).
//
// 본 spec 의 격리 전략:
//   - cookieExtractor 는 pure function — 직접 호출로 검증 (Request mock 의 cookies).
//   - JwtStrategy.validate 는 instance method — instantiation 후 직접 호출.
//   - passport-jwt 의 verify path 자체는 본 spec scope 외 — strategy 의 wiring 만 검증.
import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { ACCESS_TOKEN_COOKIE } from "./auth.controller";
import type { JwtPayload } from "./auth.service";
import { JwtStrategy, cookieExtractor } from "./jwt.strategy";

describe("cookieExtractor()", () => {
  it("cookies 의 access_token 추출 (happy)", () => {
    const req = {
      cookies: { [ACCESS_TOKEN_COOKIE]: "abc.def.ghi" },
    } as unknown as Request;
    expect(cookieExtractor(req)).toBe("abc.def.ghi");
  });

  it("cookies 객체에 access_token 부재 시 null 반환 (negative #1)", () => {
    const req = { cookies: {} } as unknown as Request;
    expect(cookieExtractor(req)).toBeNull();
  });

  it("cookies 의 access_token 이 빈 문자열 시 null 반환 (negative #2)", () => {
    const req = {
      cookies: { [ACCESS_TOKEN_COOKIE]: "" },
    } as unknown as Request;
    expect(cookieExtractor(req)).toBeNull();
  });

  it("req.cookies 자체가 undefined 시 null 반환 (negative #3 — cookie-parser 미장착)", () => {
    const req = { cookies: undefined } as unknown as Request;
    expect(cookieExtractor(req)).toBeNull();
  });

  it("req 자체가 null 시 null 반환 (negative #4 — defensive)", () => {
    // 가설적 edge case — passport-jwt 가 호출 시 req 가 null 인 시나리오.
    expect(cookieExtractor(null as unknown as Request)).toBeNull();
  });

  it("다른 cookie 와 함께 있어도 access_token 만 추출 (branch — multi-cookie)", () => {
    const req = {
      cookies: {
        [ACCESS_TOKEN_COOKIE]: "the.access.token",
        refresh_token: "the.refresh.token",
        unrelated: "noise",
      },
    } as unknown as Request;
    expect(cookieExtractor(req)).toBe("the.access.token");
  });
});

describe("JwtStrategy", () => {
  let originalAccessSecret: string | undefined;

  beforeEach(() => {
    originalAccessSecret = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET =
      "spec-access-secret-32bytes-min-length-abcdef";
  });

  afterEach(() => {
    if (originalAccessSecret === undefined) {
      delete process.env.AUTH_JWT_SECRET;
    } else {
      process.env.AUTH_JWT_SECRET = originalAccessSecret;
    }
  });

  it("instantiation 시 throw 하지 않는다 (happy — constructor wiring)", () => {
    expect(() => new JwtStrategy()).not.toThrow();
  });

  it('strategy name 이 "jwt" 로 박제된다 (branch — defaultStrategy 정합)', () => {
    // passport-jwt 의 strategy 는 PassportStrategy(Strategy, "jwt") 의 두 번째 인자가
    // strategy name. AuthModule 의 PassportModule.register({ defaultStrategy: "jwt" })
    // 와 round-trip 정합.
    const strategy = new JwtStrategy();
    // @nestjs/passport 의 PassportStrategy 가 instance 의 `name` prop 으로 노출.
    expect((strategy as unknown as { name: string }).name).toBe("jwt");
  });

  it("AUTH_JWT_SECRET 미설정 시에도 instantiation 정상 (negative — env missing fallback)", () => {
    // module-level fallback `?? ""` 박제 검증 — boot 단계 fail-fast 는 T-0087.
    delete process.env.AUTH_JWT_SECRET;
    expect(() => new JwtStrategy()).not.toThrow();
  });

  describe("validate()", () => {
    it("정상 payload (sub + role 모두 존재) 를 그대로 반환 (happy)", () => {
      const strategy = new JwtStrategy();
      const payload: JwtPayload = { sub: "u-1", role: "User" };
      expect(strategy.validate(payload)).toEqual(payload);
    });

    it("role 이 Admin 인 payload 도 정상 반환 (branch — role 값 분기)", () => {
      const strategy = new JwtStrategy();
      const payload: JwtPayload = { sub: "u-2", role: "Admin" };
      expect(strategy.validate(payload)).toEqual(payload);
    });

    it("role 이 SuperAdmin 인 payload 도 정상 반환 (branch — role 값 분기)", () => {
      const strategy = new JwtStrategy();
      const payload: JwtPayload = { sub: "u-3", role: "SuperAdmin" };
      expect(strategy.validate(payload)).toEqual(payload);
    });

    it("sub 부재 시 UnauthorizedException (negative #1)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate({ role: "User" } as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("sub 가 빈 문자열 시 UnauthorizedException (negative #2)", () => {
      const strategy = new JwtStrategy();
      expect(() => strategy.validate({ sub: "", role: "User" })).toThrow(
        UnauthorizedException,
      );
    });

    it("role 부재 시 UnauthorizedException (negative #3)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate({ sub: "u-1" } as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("role 이 빈 문자열 시 UnauthorizedException (negative #4)", () => {
      const strategy = new JwtStrategy();
      expect(() => strategy.validate({ sub: "u-1", role: "" })).toThrow(
        UnauthorizedException,
      );
    });

    it("payload 가 null 시 UnauthorizedException (negative #5)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate(null as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("payload 가 undefined 시 UnauthorizedException (negative #6)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate(undefined as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("payload 가 string (object 아님) 시 UnauthorizedException (negative #7 — wrong type)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate("not-object" as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("payload 가 number 시 UnauthorizedException (negative #8 — wrong type)", () => {
      const strategy = new JwtStrategy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => strategy.validate(12345 as any)).toThrow(
        UnauthorizedException,
      );
    });

    it("payload 에 iat/exp 추가 claim 이 있어도 반환값에 그대로 보존 (branch — payload integrity)", () => {
      const strategy = new JwtStrategy();
      const payload: JwtPayload = {
        sub: "u-iat",
        role: "User",
        iat: 100,
        exp: 200,
      };
      const result = strategy.validate(payload);
      expect(result.iat).toBe(100);
      expect(result.exp).toBe(200);
    });
  });
});

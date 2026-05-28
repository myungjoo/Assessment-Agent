// RolesGuard spec — T-0083 acceptance §D 박제. R-112 4 카테고리 (happy / error /
// branch / negative) + negative cases 충분 cover (Reflector undefined / 빈 배열 /
// user undefined / role 부재 / unknown role / 단일 role / 다중 role / escalation
// 매핑 SuperAdmin/Admin/User 분기 각 1+ test).
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_METADATA_KEY } from "./roles.decorator";
import { ROLE_HIERARCHY, RolesGuard } from "./roles.guard";

// ExecutionContext mock — required role 목록 + user.role 분기 control.
function buildContext(opts: {
  required?: string[];
  user?: { sub?: string; role?: string };
}): ExecutionContext {
  const handler = jest.fn();
  const klass = jest.fn();
  const request = { user: opts.user };
  const ctx = {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return ctx;
}

// Reflector mock — getAllAndOverride 가 required 값 반환.
function buildReflector(required: string[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
}

describe("RolesGuard", () => {
  describe("ROLE_HIERARCHY invariant (api.md §3 정합)", () => {
    it("SuperAdmin escalation = [SuperAdmin]", () => {
      expect(ROLE_HIERARCHY.SuperAdmin).toEqual(["SuperAdmin"]);
    });

    it("Admin escalation = [Admin, SuperAdmin]", () => {
      expect(ROLE_HIERARCHY.Admin).toEqual(["Admin", "SuperAdmin"]);
    });

    it("User escalation = [User, Admin, SuperAdmin]", () => {
      expect(ROLE_HIERARCHY.User).toEqual(["User", "Admin", "SuperAdmin"]);
    });
  });

  describe("canActivate — decorator 미적용 / 빈 배열 (public endpoint)", () => {
    it("Reflector 가 undefined 반환 시 true (branch — decorator 미적용 endpoint)", () => {
      const guard = new RolesGuard(buildReflector(undefined));
      const ctx = buildContext({ required: undefined });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("Reflector 가 빈 배열 반환 시 true (branch — @Roles() 빈 인자)", () => {
      const guard = new RolesGuard(buildReflector([]));
      const ctx = buildContext({ required: [] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("decorator 미적용 + user 부재 도 true (branch — public endpoint)", () => {
      // public endpoint 는 인증 자체 무관 — JwtAuthGuard 가 별도 적용된 경우만 401.
      const guard = new RolesGuard(buildReflector(undefined));
      const ctx = buildContext({ required: undefined, user: undefined });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("canActivate — request.user 부재 (인증 자체 부재)", () => {
    it("required 존재 + user undefined → UnauthorizedException (negative #1)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({ required: ["Admin"], user: undefined });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it("required 존재 + user.role 부재 → UnauthorizedException (negative #2)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-1" }, // role 부재
      });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it("required 존재 + user.role 빈 문자열 → UnauthorizedException (negative #3)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-1", role: "" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });

  describe("canActivate — happy 매치 (role 정확 매치)", () => {
    it("@Roles('Admin') + user.role='Admin' → true (happy)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-1", role: "Admin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('User') + user.role='User' → true (happy)", () => {
      const guard = new RolesGuard(buildReflector(["User"]));
      const ctx = buildContext({
        required: ["User"],
        user: { sub: "u-2", role: "User" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('SuperAdmin') + user.role='SuperAdmin' → true (happy)", () => {
      const guard = new RolesGuard(buildReflector(["SuperAdmin"]));
      const ctx = buildContext({
        required: ["SuperAdmin"],
        user: { sub: "u-3", role: "SuperAdmin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("canActivate — escalation 매핑 (상위 role 의 하위 권한 cover)", () => {
    it("@Roles('User') + user.role='Admin' → true (escalation — Admin ⊇ User)", () => {
      const guard = new RolesGuard(buildReflector(["User"]));
      const ctx = buildContext({
        required: ["User"],
        user: { sub: "u-a", role: "Admin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('User') + user.role='SuperAdmin' → true (escalation — SuperAdmin ⊇ User)", () => {
      const guard = new RolesGuard(buildReflector(["User"]));
      const ctx = buildContext({
        required: ["User"],
        user: { sub: "u-sa", role: "SuperAdmin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('Admin') + user.role='SuperAdmin' → true (escalation — SuperAdmin ⊇ Admin)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-sa-a", role: "SuperAdmin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("canActivate — 권한 부족 (negative escalation)", () => {
    it("@Roles('Admin') + user.role='User' → ForbiddenException (negative — User < Admin)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-x", role: "User" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("@Roles('SuperAdmin') + user.role='Admin' → ForbiddenException (negative — Admin < SuperAdmin)", () => {
      const guard = new RolesGuard(buildReflector(["SuperAdmin"]));
      const ctx = buildContext({
        required: ["SuperAdmin"],
        user: { sub: "u-y", role: "Admin" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("@Roles('SuperAdmin') + user.role='User' → ForbiddenException (negative — User < SuperAdmin)", () => {
      const guard = new RolesGuard(buildReflector(["SuperAdmin"]));
      const ctx = buildContext({
        required: ["SuperAdmin"],
        user: { sub: "u-z", role: "User" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe("canActivate — 다중 required (OR semantic)", () => {
    it("@Roles('Admin','SuperAdmin') + user.role='Admin' → true (OR — Admin 매치)", () => {
      const guard = new RolesGuard(buildReflector(["Admin", "SuperAdmin"]));
      const ctx = buildContext({
        required: ["Admin", "SuperAdmin"],
        user: { sub: "u-or-1", role: "Admin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('Admin','SuperAdmin') + user.role='SuperAdmin' → true (OR — SuperAdmin 매치)", () => {
      const guard = new RolesGuard(buildReflector(["Admin", "SuperAdmin"]));
      const ctx = buildContext({
        required: ["Admin", "SuperAdmin"],
        user: { sub: "u-or-2", role: "SuperAdmin" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("@Roles('Admin','SuperAdmin') + user.role='User' → ForbiddenException (OR negative — 어느 것도 매치 안 됨)", () => {
      const guard = new RolesGuard(buildReflector(["Admin", "SuperAdmin"]));
      const ctx = buildContext({
        required: ["Admin", "SuperAdmin"],
        user: { sub: "u-or-3", role: "User" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe("canActivate — unknown role 값 (ROLE_HIERARCHY 미박제)", () => {
    it("@Roles('Admin') + user.role='Unknown' → ForbiddenException (negative — unknown role)", () => {
      const guard = new RolesGuard(buildReflector(["Admin"]));
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-un", role: "Unknown" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("@Roles('Unknown') (decorator 의 임의 값) + user.role='User' → ForbiddenException (negative — unknown required)", () => {
      // required role 이 ROLE_HIERARCHY 에 없을 때 — allowed = undefined → 매치 0.
      const guard = new RolesGuard(buildReflector(["Unknown"]));
      const ctx = buildContext({
        required: ["Unknown"],
        user: { sub: "u-ur", role: "User" },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe("Reflector wiring 검증", () => {
    it("Reflector.getAllAndOverride 가 ROLES_METADATA_KEY + [handler, class] 인자로 호출된다 (branch — wiring)", () => {
      const reflector = buildReflector(["Admin"]);
      const guard = new RolesGuard(reflector);
      const ctx = buildContext({
        required: ["Admin"],
        user: { sub: "u-r", role: "Admin" },
      });
      guard.canActivate(ctx);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        ROLES_METADATA_KEY,
        expect.arrayContaining([expect.any(Function)]),
      );
    });
  });
});

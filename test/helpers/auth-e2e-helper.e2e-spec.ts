// auth-e2e-helper.e2e-spec.ts — createAuthenticatedE2EApp 의 실 DB 의존 happy/branch/
// negative cover (T-0091 박제). jest-e2e config 의 testRegex `.*\.e2e-spec\.ts$` 가
// 본 파일을 picking, 실 DB (globalSetup 의 PrismaPg connect + truncateAll) 의존.
// test/jest-e2e.json 의 maxWorkers:1 위에서 다른 e2e suite 와 직렬 실행 — cross-file
// afterEach race 0.
//
// 책임:
//   - happy — 단일 user seed (SuperAdmin) 호출 → { app, moduleRef, prisma, jwtService,
//     users, tokens } shape 정합 + 실 DB row 존재 + token non-empty.
//   - happy — 3 종 role (SuperAdmin/Admin/User) seed → 3 user + 3 token 정합.
//   - branch — email 미지정 시 helper 가 `<role-lower>-<random>@e2e.test` 자동 생성.
//   - negative — 빈 seed array → users/tokens 빈 object + app/moduleRef/prisma/jwtService
//     정상 반환 (createE2EApp 만 호출된 형태).
//
// Out of Scope:
//   - issueAccessTokenFor / buildAuthCookie 의 stateless unit cover — auth-e2e-helper.
//     spec.ts (C 항목) 책임.
//   - login flow 통과 (POST /api/auth/login → cookie) — auth.e2e-spec.ts 별도 task.
import type { INestApplication } from "@nestjs/common";

import { PrismaService } from "../../src/persistence/prisma.service";

import {
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "./auth-e2e-helper";
import { truncateAll } from "./db-truncate";

describe("E2E: createAuthenticatedE2EApp helper (T-0091)", () => {
  // 각 it 마다 신선한 context 박제 — beforeEach 가 부트스트랩, afterEach 가 truncate
  // + close. cross-it state leak 0 (ADR-0004 §Cleanup).
  let context: AuthenticatedE2EContext;

  afterEach(async () => {
    if (context !== undefined && context.app !== undefined) {
      // afterEach truncate — 다음 it 전에 DB state 격리.
      await truncateAll(context.prisma);
      await context.app.close();
      await context.prisma.$disconnect();
    }
  });

  // -- happy — 단일 SuperAdmin seed -----------------------------------------
  it("happy — 단일 SuperAdmin seed → { app, moduleRef, prisma, jwtService, users, tokens } 정합", async () => {
    context = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "sa@e2e.test" },
    ]);

    // 반환 shape 정합 — 6 field 모두 truthy.
    expect(context.app).toBeDefined();
    expect(context.moduleRef).toBeDefined();
    expect(context.prisma).toBeDefined();
    expect(context.jwtService).toBeDefined();

    // app 이 INestApplication shape — getHttpServer / close 메서드 존재.
    const appAsTyped = context.app as INestApplication;
    expect(typeof appAsTyped.getHttpServer).toBe("function");
    expect(typeof appAsTyped.close).toBe("function");

    // users record — key=email, value=User. role 정합 + id 존재.
    expect(Object.keys(context.users)).toEqual(["sa@e2e.test"]);
    const seededUser = context.users["sa@e2e.test"];
    expect(seededUser.email).toBe("sa@e2e.test");
    expect(seededUser.role).toBe("SuperAdmin");
    expect(typeof seededUser.id).toBe("string");
    expect(seededUser.id.length).toBeGreaterThan(0);

    // tokens record — key=email, value=string non-empty.
    expect(Object.keys(context.tokens)).toEqual(["sa@e2e.test"]);
    const token = context.tokens["sa@e2e.test"];
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // 실 DB row 존재 — prisma 로 직접 조회.
    const dbRow = await context.prisma.user.findUnique({
      where: { email: "sa@e2e.test" },
    });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.role).toBe("SuperAdmin");
  });

  // -- happy — 3 종 role seed -----------------------------------------------
  it("happy — 3 종 role (SuperAdmin/Admin/User) seed → 3 user + 3 token 정합", async () => {
    context = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "super-3role@e2e.test" },
      { role: "Admin", email: "admin-3role@e2e.test" },
      { role: "User", email: "user-3role@e2e.test" },
    ]);

    expect(Object.keys(context.users).sort()).toEqual(
      [
        "super-3role@e2e.test",
        "admin-3role@e2e.test",
        "user-3role@e2e.test",
      ].sort(),
    );
    expect(Object.keys(context.tokens).sort()).toEqual(
      [
        "super-3role@e2e.test",
        "admin-3role@e2e.test",
        "user-3role@e2e.test",
      ].sort(),
    );

    expect(context.users["super-3role@e2e.test"].role).toBe("SuperAdmin");
    expect(context.users["admin-3role@e2e.test"].role).toBe("Admin");
    expect(context.users["user-3role@e2e.test"].role).toBe("User");

    // 3 token 모두 non-empty string + 서로 다름 (sub claim 차이).
    expect(context.tokens["super-3role@e2e.test"].length).toBeGreaterThan(0);
    expect(context.tokens["admin-3role@e2e.test"].length).toBeGreaterThan(0);
    expect(context.tokens["user-3role@e2e.test"].length).toBeGreaterThan(0);
    expect(context.tokens["super-3role@e2e.test"]).not.toBe(
      context.tokens["admin-3role@e2e.test"],
    );
  });

  // -- branch — email 미지정 시 자동 생성 -----------------------------------
  it("branch — email 미지정 시 helper 가 `<role-lower>-<random>@e2e.test` 자동 생성", async () => {
    context = await createAuthenticatedE2EApp([{ role: "Admin" }]);

    const keys = Object.keys(context.users);
    expect(keys.length).toBe(1);
    const autoEmail = keys[0];
    // regex `/^admin-[a-z0-9]+@e2e\.test$/` 매칭 — role lowercase + random alnum
    // 8 char + @e2e.test domain.
    expect(autoEmail).toMatch(/^admin-[a-z0-9]+@e2e\.test$/);
    expect(context.users[autoEmail].role).toBe("Admin");
    expect(context.tokens[autoEmail].length).toBeGreaterThan(0);

    // 실 DB row 존재 — auto-email 로 정상 seed.
    const dbRow = await context.prisma.user.findUnique({
      where: { email: autoEmail },
    });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.role).toBe("Admin");
  });

  // -- negative — 빈 seed array ---------------------------------------------
  it("negative — 빈 seed array → users/tokens 빈 object + app/moduleRef/prisma/jwtService 정상 반환", async () => {
    context = await createAuthenticatedE2EApp([]);

    // 6 field 모두 정상 반환 — createE2EApp 만 호출된 형태.
    expect(context.app).toBeDefined();
    expect(context.moduleRef).toBeDefined();
    expect(context.prisma).toBeDefined();
    expect(context.jwtService).toBeDefined();

    // users / tokens 빈 object.
    expect(Object.keys(context.users)).toEqual([]);
    expect(Object.keys(context.tokens)).toEqual([]);

    // 실 DB 의 User row 0 (afterEach truncate 가 직전 it 의 state 격리하므로 fresh state).
    // PrismaService inject 정합 검증 — count 호출이 정상 동작.
    const userCount = await (context.prisma as PrismaService).user.count();
    expect(userCount).toBe(0);
  });
});

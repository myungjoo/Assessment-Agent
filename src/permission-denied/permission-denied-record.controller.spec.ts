// PermissionDeniedRecordController spec — T-0214 acceptance 박제 (1 endpoint, R-112:
// happy / error / branch / negative cases 충분 cover + RBAC guard wire). ADR-0023 §1/
// §3/§4/§5 계약을 mirror. llm-provider-config.controller.spec.ts (T-0140) 의 3-block
// 구조 (unit / RBAC guard integration / real RolesGuard escalation) 를 mirror 하되 본
// controller 의 차이 반영:
//   - 1 endpoint (GET list) — config CRUD 부재 (audit 는 read-only).
//   - @Roles("User") tier (Admin+ 아님, ADR-0023 §5) — authenticated 면 endpoint 접근,
//     audience 차등은 service-layer.
//   - service 가 audience 차등 (Admin bypass / non-Admin 빈 배열) 책임 — controller 는
//     @CurrentUser() actor + query param 을 service 로 forward 만 (controller 분기 0).
//   - query param 3 종 (instanceRef / provider / httpStatus) 의 filter 매핑 + httpStatus
//     숫자 변환 / 비정상값 무시 (negative case #6).
//
// PrismaService 는 Controller → Service → Repository chain 의 dep 안전성을 위해
// jest.mock 으로 회피 (llm-provider-config.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    permissionDeniedRecord = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { PermissionDeniedRecord } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import type { JwtPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { PermissionDeniedRecordController } from "./permission-denied-record.controller";
import { PermissionDeniedRecordService } from "./permission-denied-record.service";
/* eslint-enable import/first */

// PermissionDeniedRecord fixture — schema.prisma 8 컬럼 default row (record view).
// redaction 불요 — secret 컬럼 자체가 schema 에 부재 (ADR-0022 §1 / ADR-0023 §5).
function buildRecordFixture(
  overrides: Partial<PermissionDeniedRecord> = {},
): PermissionDeniedRecord {
  return {
    id: "pdr-default",
    provider: "github",
    instanceRef: "github.sec.samsung.net",
    resourceRef: "/repos/acme/widget/commits",
    principal: null,
    httpStatus: 403,
    reason: "permission-denied",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PermissionDeniedRecordService mock factory — list 메서드 jest.fn(). 각 test 마다
// 새 mock (호출 카운터 격리).
function buildServiceMock(): {
  service: PermissionDeniedRecordService;
  serviceMock: { list: jest.Mock };
} {
  const serviceMock = { list: jest.fn() };
  return {
    service: serviceMock as unknown as PermissionDeniedRecordService,
    serviceMock,
  };
}

const ADMIN_ACTOR: JwtPayload = { sub: "admin-1", role: "Admin" };
const USER_ACTOR: JwtPayload = { sub: "user-1", role: "User" };

describe("PermissionDeniedRecordController (unit)", () => {
  // -----------------------------------------------------------------------
  // list (GET /api/permission-denied-records) — happy + branch + negative.
  // controller 자체 audience 분기 없음 — actor + filter forward 검증 + service throw
  // propagation 으로 cover.
  // -----------------------------------------------------------------------

  // Happy (a/d): Admin actor → service.list(actor, {}) forward, 전체 record 반환 +
  // @CurrentUser() actor 가 service 로 전달됨.
  it("GET — Admin actor 전달 + service.list 결과 (전체 record) 를 그대로 반환 (happy — actor forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [
      buildRecordFixture({ id: "r-1" }),
      buildRecordFixture({ id: "r-2", provider: "confluence" }),
    ];
    serviceMock.list.mockResolvedValueOnce(fixture);

    const controller = new PermissionDeniedRecordController(service);
    const result = await controller.list(ADMIN_ACTOR);

    expect(serviceMock.list).toHaveBeenCalledTimes(1);
    expect(serviceMock.list).toHaveBeenCalledWith(ADMIN_ACTOR, {});
    expect(result).toBe(fixture);
  });

  // Happy (c): non-Admin (User) actor → service 가 빈 배열 반환 (binding-부재 fallback),
  // controller 는 그대로 forward (404 변환 0).
  it("GET — User actor → service 가 빈 배열 반환 시 그대로 forward (happy — non-Admin fallback)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockResolvedValueOnce([]);

    const controller = new PermissionDeniedRecordController(service);
    const result = await controller.list(USER_ACTOR);

    expect(serviceMock.list).toHaveBeenCalledWith(USER_ACTOR, {});
    expect(result).toEqual([]);
  });

  // Branch (d): query param 3 종이 filter 로 매핑되어 service 로 전달됨. httpStatus 는
  // 문자열 → 숫자 변환.
  it("GET — query param (instanceRef/provider/httpStatus) 가 filter 로 매핑되어 service 로 전달 (branch — query 매핑 + httpStatus 숫자 변환)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockResolvedValueOnce([]);

    const controller = new PermissionDeniedRecordController(service);
    await controller.list(
      ADMIN_ACTOR,
      "github.sec.samsung.net",
      "github",
      "403",
    );

    expect(serviceMock.list).toHaveBeenCalledWith(ADMIN_ACTOR, {
      instanceRef: "github.sec.samsung.net",
      provider: "github",
      httpStatus: 403,
    });
  });

  // Negative (#6): httpStatus 비정상값 (non-numeric) → undefined 처리 (filter 에서 omit,
  // throw 0). instanceRef / provider 는 정상 매핑.
  it("GET — httpStatus 가 non-numeric 이면 무시하고 나머지 filter 만 전달 (negative #6 — query param 비정상값)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockResolvedValueOnce([]);

    const controller = new PermissionDeniedRecordController(service);
    await controller.list(ADMIN_ACTOR, undefined, "confluence", "not-a-number");

    expect(serviceMock.list).toHaveBeenCalledWith(ADMIN_ACTOR, {
      provider: "confluence",
    });
  });

  // Negative: 모든 query param 미제공 / 빈 문자열 → 빈 filter ({}). 빈 문자열 instanceRef
  // 도 omit (where 매칭 0 회피).
  it("GET — query param 전부 미제공/빈 문자열이면 빈 filter ({}) 로 전달 (negative — 빈 query 경계)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockResolvedValueOnce([]);

    const controller = new PermissionDeniedRecordController(service);
    await controller.list(ADMIN_ACTOR, "", "", "");

    expect(serviceMock.list).toHaveBeenCalledWith(ADMIN_ACTOR, {});
  });

  // Negative: actor undefined (방어 — guard 통과 path 에선 발생 0) 도 service 로 그대로
  // 전달 (service 가 non-Admin 취급). controller throw 0.
  it("GET — actor 가 undefined 여도 service 로 그대로 전달 (negative — actor 부재 방어, throw 0)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockResolvedValueOnce([]);

    const controller = new PermissionDeniedRecordController(service);
    const result = await controller.list(undefined);

    expect(serviceMock.list).toHaveBeenCalledWith(undefined, {});
    expect(result).toEqual([]);
  });

  // Error path (a): service.list reject (DB 장애) 를 삼키지 않고 그대로 propagate
  // (404/4xx 변환 0).
  it("GET — service.list 가 던진 raw Error (DB 장애) 를 삼키지 않고 그대로 propagate (error — 의존성 fail)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.list.mockRejectedValueOnce(rawError);

    const controller = new PermissionDeniedRecordController(service);
    await expect(controller.list(ADMIN_ACTOR)).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0214). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. llm-provider-config.controller.spec 의 "RBAC guard
// integration" mirror. 본 block 은 GET endpoint 에 guard 가 wire 됐는지 + 거부 시
// service 미호출 + 통과 시 service 위임 검증.
// -----------------------------------------------------------------------
describe("PermissionDeniedRecordController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: { list: jest.Mock };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환.
  function makeAllowingJwtGuard(sub: string, role: string) {
    return {
      canActivate: (ctx: ExecutionContext): boolean => {
        const req = ctx.switchToHttp().getRequest<Request>();
        (req as Request & { user?: { sub: string; role: string } }).user = {
          sub,
          role,
        };
        return true;
      },
    };
  }

  const ALLOW_ALL_ROLES = { canActivate: (): boolean => true };

  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = { list: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PermissionDeniedRecordController],
      providers: [
        { provide: PermissionDeniedRecordService, useValue: serviceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(opts.jwt)
      .overrideGuard(RolesGuard)
      .useValue(opts.roles)
      .compile();

    const a = moduleRef.createNestApplication();
    await a.init();
    return a;
  }

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  // -- happy — User role 통과 시 200 + service.list 위임 (actor + filter 전달) --------
  it("GET — User role 통과 시 200 + service.list 위임 (happy — @Roles('User') tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(200);

    expect(serviceMock.list).toHaveBeenCalledTimes(1);
    // actor (req.user 박제) 가 첫 인자로 전달됨.
    expect(serviceMock.list).toHaveBeenCalledWith(
      { sub: "user-1", role: "User" },
      {},
    );
    expect(Array.isArray(res.body)).toBe(true);
  });

  // -- happy — Admin actor → 전체 record (service 가 bypass 결과 반환) ---------------
  it("GET — Admin actor 통과 시 200 + service 가 전체 record 반환 (happy — Admin bypass via service)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockResolvedValueOnce([buildRecordFixture()]);

    const res = await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].provider).toBe("github");
  });

  // -- branch — query param 이 filter 로 매핑되어 service 로 전달 -------------------
  it("GET — query param (provider/httpStatus) 이 filter 로 매핑되어 service 로 전달 (branch — query 매핑)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get("/api/permission-denied-records?provider=github&httpStatus=403")
      .expect(200);

    expect(serviceMock.list).toHaveBeenCalledWith(
      { sub: "admin-1", role: "Admin" },
      { provider: "github", httpStatus: 403 },
    );
  });

  // -- negative (#6) — httpStatus non-numeric query param → 무시 (200, 400 아님) -----
  it("GET — httpStatus non-numeric query param 은 무시하고 200 반환 (negative #6 — 비정상 query 값)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get("/api/permission-denied-records?httpStatus=abc")
      .expect(200);

    // httpStatus 가 filter 에서 omit 됨 (throw 0).
    expect(serviceMock.list).toHaveBeenCalledWith(
      { sub: "admin-1", role: "Admin" },
      {},
    );
  });

  // -- negative — non-Admin 이 타 instanceRef query 지정 → 빈 배열 (403 아님, ADR-0023 §4)
  it("GET — non-Admin 이 타 instanceRef query 를 지정해도 200 빈 배열 (negative — 빈-필터, 403 아님)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    // service 가 non-Admin fallback 으로 빈 배열 반환 (실 분기는 service spec 이 cover).
    serviceMock.list.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer())
      .get("/api/permission-denied-records?instanceRef=github.sec.samsung.net")
      .expect(200);

    expect(res.body).toEqual([]);
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) + service 미호출 -------------
  it("GET — JwtAuthGuard reject 시 401 + service 미호출 (negative — 미인증)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(401);

    expect(serviceMock.list).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — tier 미달) + service 미호출 --------------
  // @Roles("User") 라 실 escalation 에선 authenticated 면 통과하나, 향후 더 높은 tier
  // 요구 시의 403 경계를 mock reject 로 박제 (ADR-0023 §4).
  it("GET — RolesGuard reject 시 403 + service 미호출 (negative — role tier 미달 경계)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("nobody-1", "Nobody"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(403);

    expect(serviceMock.list).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ------------------
  it("GET — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(500);
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 @Roles("User") tier 분기 박제
// (mock 이 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제),
// RolesGuard 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). @Roles("User") 라
// User / Admin / SuperAdmin 모두 통과 (authenticated 면 endpoint 접근, ADR-0023 §5).
// -----------------------------------------------------------------------
describe("PermissionDeniedRecordController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: { list: jest.Mock };

  function makeAllowingJwtGuard(sub: string, role: string) {
    return {
      canActivate: (ctx: ExecutionContext): boolean => {
        const req = ctx.switchToHttp().getRequest<Request>();
        (req as Request & { user?: { sub: string; role: string } }).user = {
          sub,
          role,
        };
        return true;
      },
    };
  }

  // 실 RolesGuard 사용 — JwtAuthGuard 만 override (req.user 박제). RolesGuard 는 실
  // provider (Reflector 자동 주입) 그대로.
  async function buildAppWithRealRolesGuard(
    actorRole: string,
  ): Promise<INestApplication> {
    serviceMock = { list: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PermissionDeniedRecordController],
      providers: [
        { provide: PermissionDeniedRecordService, useValue: serviceMock },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAllowingJwtGuard("actor-1", actorRole))
      .compile();

    const a = moduleRef.createNestApplication();
    await a.init();
    return a;
  }

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  // @Roles("User") tier — User / Admin / SuperAdmin 모두 통과 (escalation hierarchy).
  it.each(["User", "Admin", "SuperAdmin"])(
    "GET — %s actor 는 @Roles('User') tier 통과 (200, escalation hierarchy)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.list.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get("/api/permission-denied-records")
        .expect(200);

      expect(serviceMock.list).toHaveBeenCalledTimes(1);
    },
  );

  // @Roles("User") tier — unknown role (escalation 매핑 부재) → 403 (실 RolesGuard).
  it("GET — unknown role (escalation 매핑 부재) 은 403 차단 (실 RolesGuard, exact 매칭)", async () => {
    app = await buildAppWithRealRolesGuard("Auditor");

    await request(app.getHttpServer())
      .get("/api/permission-denied-records")
      .expect(403);

    expect(serviceMock.list).not.toHaveBeenCalled();
  });
});

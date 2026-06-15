// CronScheduleController spec — T-0414 acceptance 박제 (3 endpoint, R-112:
// happy / error / branch / negative + ValidationPipe negative + RBAC guard wire).
// difficulty-mapping.controller.spec.ts (T-0139) 1:1 mirror, 단 CronSchedule 의 차이 반영:
//   - 3 endpoint (GET list / PUT upsert / DELETE remove).
//   - DTO 2 키 (name / cronExpression) — UpsertCronScheduleDto.
//   - 3 endpoint 모두 Admin+ tier (cron 주기 지정은 administrative concern, REQ-039).
//   - service 가 모든 4xx 변환 책임 (controller raw forward) — controller 분기 없음,
//     forward 검증 + service-throw propagation 으로 cover.
//   - CRON_TICK_HANDLER 주입 — upsert 가 주입된 handler 를 registerOrReplace 에 전달하는지 검증.
//
// 본 spec 은 4 부분으로 구성 (difficulty-mapping.controller.spec mirror):
//   1. Unit-level (controller-only with mocked CronScheduleService) — 3 endpoint 의
//      routing / service 호출 인자 / 예외 propagation + GET 빈/비어있지 않은 배열 분기
//      + upsert 가 주입 tickHandler 를 전달하는지.
//   2. Integration-level (createNestApplication + controller-scope ValidationPipe + supertest)
//      — UpsertCronScheduleDto decorator 위반 negative case + non-whitelisted reject + status code.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 의 통과/거부 분기 overrideGuard.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// CronScheduleService 는 jest.fn() mock 으로 주입하므로 실 cron 라이브러리·실 timer 가
// 동작하지 않는다 (service 의 registerOrReplace 가 CronJob.start() 로 띄우는 실타이머
// 누수 0 — leaked timer 방지). 따라서 cron-schedule.service.spec 의 jest.mock("cron")
// stub 은 본 spec 에서 불필요하다 (service 자체가 mock).
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import {
  CRON_TICK_HANDLER,
  CronScheduleController,
} from "./cron-schedule.controller";
import { CronScheduleService } from "./cron-schedule.service";

const VALID_CRON = "0 0 2 * * *";

// CronScheduleService mock factory — 3 메서드 (list / registerOrReplace / remove)
// jest.fn(). exists 는 controller 가 직접 호출하지 않으므로 미포함.
function buildServiceMock(): {
  service: CronScheduleService;
  serviceMock: {
    list: jest.Mock;
    registerOrReplace: jest.Mock;
    remove: jest.Mock;
  };
} {
  const serviceMock = {
    list: jest.fn(),
    registerOrReplace: jest.fn(),
    remove: jest.fn(),
  };
  return {
    service: serviceMock as unknown as CronScheduleService,
    serviceMock,
  };
}

describe("CronScheduleController (unit)", () => {
  // 주입용 stub tick handler — upsert 가 이 함수를 registerOrReplace 에 전달하는지 검증.
  const tickHandler = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // list (GET /api/schedules) — happy + branch (빈/비어있지 않은 배열)
  // -----------------------------------------------------------------------
  it("GET — list 결과 (등록 이름 배열) 를 그대로 반환 (happy + branch — 비어있지 않은 배열)", () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockReturnValueOnce(["daily", "weekly"]);

    const controller = new CronScheduleController(service, tickHandler);
    const result = controller.list();

    expect(serviceMock.list).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["daily", "weekly"]);
  });

  it("GET — 등록 전 빈 배열도 그대로 반환 (branch — empty propagate, 404 변환 안 함)", () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.list.mockReturnValueOnce([]);

    const controller = new CronScheduleController(service, tickHandler);
    expect(controller.list()).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // upsert (PUT) — happy + 주입 handler 전달 + error (service 4xx propagate)
  // -----------------------------------------------------------------------
  it("PUT — registerOrReplace 를 (name, cronExpression, 주입 tickHandler) 인자로 호출 (happy)", () => {
    const { service, serviceMock } = buildServiceMock();

    const controller = new CronScheduleController(service, tickHandler);
    controller.upsert({ name: "daily", cronExpression: VALID_CRON });

    expect(serviceMock.registerOrReplace).toHaveBeenCalledTimes(1);
    expect(serviceMock.registerOrReplace).toHaveBeenCalledWith(
      "daily",
      VALID_CRON,
      tickHandler,
    );
  });

  it("PUT — service 의 BadRequestException (유효하지 않은 cron 식) 그대로 propagate (error / negative)", () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.registerOrReplace.mockImplementationOnce(() => {
      throw new BadRequestException("유효하지 않은 cron 표현식");
    });

    const controller = new CronScheduleController(service, tickHandler);
    expect(() =>
      controller.upsert({ name: "bad", cronExpression: "nonsense" }),
    ).toThrow(BadRequestException);
  });

  it("PUT — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — unknown error)", () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected registry failure");
    serviceMock.registerOrReplace.mockImplementationOnce(() => {
      throw rawError;
    });

    const controller = new CronScheduleController(service, tickHandler);
    expect(() =>
      controller.upsert({ name: "daily", cronExpression: VALID_CRON }),
    ).toThrow(rawError);
  });

  // -----------------------------------------------------------------------
  // remove (DELETE /:name) — happy + error (service NotFound propagate)
  // -----------------------------------------------------------------------
  it("DELETE — remove 를 name 인자로 호출 (happy)", () => {
    const { service, serviceMock } = buildServiceMock();

    const controller = new CronScheduleController(service, tickHandler);
    controller.remove("daily");

    expect(serviceMock.remove).toHaveBeenCalledWith("daily");
    expect(serviceMock.remove).toHaveBeenCalledTimes(1);
  });

  it("DELETE — service 의 NotFoundException (부재 name) 그대로 propagate (error / negative)", () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.remove.mockImplementationOnce(() => {
      throw new NotFoundException("등록되지 않은 cron job: ghost");
    });

    const controller = new CronScheduleController(service, tickHandler);
    expect(() => controller.remove("ghost")).toThrow(NotFoundException);
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. CronScheduleService 는 mocked.
// R-112 "negative cases 충분 cover" — UpsertCronScheduleDto reject branch 각 1+
// + non-whitelisted 키 reject + status code (200/204) wire + service 4xx propagate.
// -----------------------------------------------------------------------
describe("CronScheduleController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    list: jest.Mock;
    registerOrReplace: jest.Mock;
    remove: jest.Mock;
  };

  const validUpsertBody = { name: "daily", cronExpression: VALID_CRON };

  beforeEach(async () => {
    serviceMock = {
      list: jest.fn(),
      registerOrReplace: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CronScheduleController],
      providers: [
        { provide: CronScheduleService, useValue: serviceMock },
        { provide: CRON_TICK_HANDLER, useValue: jest.fn() },
      ],
    })
      // RBAC guard 는 통과 mock 으로 override — 본 block 은 ValidationPipe 분기가 책임.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Happy reference — ValidationPipe 가 정상 payload 는 통과 → 200.
  it("정상 PUT payload 는 ValidationPipe 통과 후 200 (sanity)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send(validUpsertBody)
      .expect(200);

    expect(serviceMock.registerOrReplace).toHaveBeenCalledTimes(1);
  });

  // Negative 1: 필수 field 누락 (빈 body) → @IsNotEmpty/@IsString 위반 → 400.
  it("PUT 빈 body 시 400 (negative #1: missing name + cronExpression)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({})
      .expect(400);

    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // Negative 2: name 만 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("PUT name 이 빈 문자열 시 400 (negative #2: empty name)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ name: "", cronExpression: VALID_CRON })
      .expect(400);

    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // Negative 3: cronExpression 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("PUT cronExpression 이 빈 문자열 시 400 (negative #3: empty cronExpression)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ name: "daily", cronExpression: "" })
      .expect(400);

    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // Negative 4: 정의되지 않은 raw 본문 키 → forbidNonWhitelisted → 400.
  it("PUT 에 정의되지 않은 키 (extra) 포함 시 400 (negative #4: non-whitelisted field reject)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ ...validUpsertBody, extra: "x" })
      .expect(400);

    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // Negative 5: name 이 number → @IsString 위반 → 400.
  it("PUT name 이 비-string 시 400 (negative #5: wrong type)", async () => {
    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ name: 12345, cronExpression: VALID_CRON })
      .expect(400);

    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // Negative 6: ValidationPipe 통과 후 service 가 유효하지 않은 cron 식 → 400 propagate.
  it("PUT — ValidationPipe 통과해도 service BadRequestException (유효하지 않은 cron 식) → 400 propagate (negative #6)", async () => {
    serviceMock.registerOrReplace.mockImplementationOnce(() => {
      throw new BadRequestException("유효하지 않은 cron 표현식");
    });

    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ name: "bad", cronExpression: "0 0" })
      .expect(400);
  });

  // DELETE happy — 204 No Content + service.remove 위임.
  it("DELETE 정상 시 204 + service.remove 위임 (status code wire)", async () => {
    await request(app.getHttpServer())
      .delete("/api/schedules/daily")
      .expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("daily");
  });

  // DELETE error path — service NotFoundException (부재) → 404 자동 mapping.
  it("DELETE — service NotFoundException (부재 name) 시 404 (error path)", async () => {
    serviceMock.remove.mockImplementationOnce(() => {
      throw new NotFoundException("등록되지 않은 cron job: ghost");
    });

    await request(app.getHttpServer())
      .delete("/api/schedules/ghost")
      .expect(404);
  });

  // GET happy — 200 + 배열 반환 (integration-level routing 검산).
  it("GET 시 200 + service.list 결과 반환", async () => {
    serviceMock.list.mockReturnValueOnce(["daily"]);

    const res = await request(app.getHttpServer())
      .get("/api/schedules")
      .expect(200);

    expect(serviceMock.list).toHaveBeenCalledTimes(1);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0414). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. difficulty-mapping.controller.spec 1:1 mirror.
// -----------------------------------------------------------------------
describe("CronScheduleController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    list: jest.Mock;
    registerOrReplace: jest.Mock;
    remove: jest.Mock;
  };

  const validUpsertBody = { name: "daily", cronExpression: VALID_CRON };

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
    serviceMock = {
      list: jest.fn(),
      registerOrReplace: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CronScheduleController],
      providers: [
        { provide: CronScheduleService, useValue: serviceMock },
        { provide: CRON_TICK_HANDLER, useValue: jest.fn() },
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

  // -- happy — Admin role 통과 + service 위임 (3 endpoint) ---------------------
  it("GET — Admin role 통과 시 200 + service.list 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.list.mockReturnValueOnce([]);

    await request(app.getHttpServer()).get("/api/schedules").expect(200);
    expect(serviceMock.list).toHaveBeenCalledTimes(1);
  });

  it("PUT — Admin role 통과 시 200 + service.registerOrReplace 위임 (happy)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .put("/api/schedules")
      .send(validUpsertBody)
      .expect(200);
    expect(serviceMock.registerOrReplace).toHaveBeenCalledTimes(1);
  });

  it("DELETE — Admin role 통과 시 204 + service.remove 위임 (happy)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .delete("/api/schedules/daily")
      .expect(204);
    expect(serviceMock.remove).toHaveBeenCalledWith("daily");
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) ----------------------
  it("GET — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer()).get("/api/schedules").expect(401);
    expect(serviceMock.list).not.toHaveBeenCalled();
  });

  it("PUT — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .put("/api/schedules")
      .send(validUpsertBody)
      .expect(401);
    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ------
  it("DELETE — RolesGuard reject 시 403 + service 미호출 (negative — User actor 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .delete("/api/schedules/daily")
      .expect(403);
    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제 (mock 이 아닌 실
// escalation 매핑 cover). JwtAuthGuard 는 통과 mock, RolesGuard 는 실 instance.
// User 403 / Admin·SuperAdmin 통과 (escalation hierarchy descent).
// -----------------------------------------------------------------------
describe("CronScheduleController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    list: jest.Mock;
    registerOrReplace: jest.Mock;
    remove: jest.Mock;
  };

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

  async function buildAppWithRealRolesGuard(
    actorRole: string,
  ): Promise<INestApplication> {
    serviceMock = {
      list: jest.fn(),
      registerOrReplace: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CronScheduleController],
      providers: [
        { provide: CronScheduleService, useValue: serviceMock },
        { provide: CRON_TICK_HANDLER, useValue: jest.fn() },
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

  // GET — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation).
  it("GET — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer()).get("/api/schedules").expect(403);
    expect(serviceMock.list).not.toHaveBeenCalled();
  });

  // GET — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "GET — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.list.mockReturnValueOnce([]);

      await request(app.getHttpServer()).get("/api/schedules").expect(200);
      expect(serviceMock.list).toHaveBeenCalledTimes(1);
    },
  );

  // PUT — User actor 403 차단.
  it("PUT — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .put("/api/schedules")
      .send({ name: "daily", cronExpression: VALID_CRON })
      .expect(403);
    expect(serviceMock.registerOrReplace).not.toHaveBeenCalled();
  });
});

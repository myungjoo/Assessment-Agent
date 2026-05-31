// SummaryController spec — T-0119 acceptance 박제 (4 endpoint, R-112: happy / error
// / branch / negative + ValidationPipe negative integration via supertest).
// assessment.controller.spec.ts (T-0117) 1:1 mirror, 단 Summary 의 차이점 반영:
//   - DTO 5 키 (personId / period / periodStart / narrative / metricScore) — scope /
//     difficulty / volume / contributionScore field 부재.
//   - `@@unique` 부재 → ConflictException(409) 분기 없음 (P2002 변환 미박제).
//   - create 의 error path 는 period literal 위반 + personId FK 위반 (P2003) 2 종
//     BadRequestException propagate (둘 다 400).
//
// 본 spec 은 두 부분으로 구성 (assessment.controller.spec.ts 1:1 mirror):
//   1. Unit-level (controller-only with mocked SummaryService) — 4 endpoint 의 routing
//      / service 호출 인자 / 예외 propagation 검증 + period query 분기.
//   2. Integration-level (createNestApplication + controller-scope ValidationPipe 자동
//      활성화 + supertest) — CreateSummaryDto decorator 위반 negative case + raw
//      미저장 (R-59) whitelist reject 검증.
//
// PrismaService 는 SummaryController → SummaryService → SummaryRepository chain 의 dep
// 안전성을 위해 jest.mock 으로 회피 (assessment.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    summary = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Summary } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { SummaryController } from "./summary.controller";
import { SummaryService } from "./summary.service";
/* eslint-enable import/first */

// Summary fixture — schema.prisma 의 6 컬럼 (id / personId / period / periodStart /
// narrative / metricScore / createdAt) default 채움. metricScore 는 Prisma.Decimal
// (Decimal 컬럼 정합).
function buildSummaryFixture(overrides: Partial<Summary> = {}): Summary {
  return {
    id: "summary-default",
    personId: "person-default",
    period: "week",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    narrative: "이번 주 요약",
    metricScore: new Prisma.Decimal("0.75"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Summary;
}

// SummaryService mock factory — 4 메서드 모두 jest.fn() (create / findById /
// findByPerson / remove 1:1). 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildSummaryServiceMock(): {
  summaryService: SummaryService;
  serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    remove: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findByPerson: jest.fn(),
    remove: jest.fn(),
  };
  return {
    summaryService: serviceMock as unknown as SummaryService,
    serviceMock,
  };
}

describe("SummaryController (unit)", () => {
  // -----------------------------------------------------------------------
  // findByPerson (GET /api/summaries) — happy + branch (period 분기) + negative
  // -----------------------------------------------------------------------
  it("GET /api/summaries — personId 만 지정 시 (personId, undefined) 를 service.findByPerson 로 forward (happy + branch — period 미지정)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    const fixture = [
      buildSummaryFixture({ id: "s-1" }),
      buildSummaryFixture({ id: "s-2" }),
    ];
    serviceMock.findByPerson.mockResolvedValueOnce(fixture);

    const controller = new SummaryController(summaryService);
    const result = await controller.findByPerson("p-1", undefined);

    // period 미지정 → options 인자는 undefined forward.
    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", undefined);
    expect(serviceMock.findByPerson).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(2);
  });

  it("GET /api/summaries — period 지정 시 (personId, { period }) options 결합 forward (branch — period 지정)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    const fixture = [buildSummaryFixture({ id: "s-1", period: "day" })];
    serviceMock.findByPerson.mockResolvedValueOnce(fixture);

    const controller = new SummaryController(summaryService);
    const result = await controller.findByPerson("p-1", "day");

    // period 지정 → `{ period }` options 로 결합 forward.
    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", {
      period: "day",
    });
    expect(result).toBe(fixture);
  });

  it("GET /api/summaries — 매칭 row 0 시 빈 배열 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.findByPerson.mockResolvedValueOnce([]);

    const controller = new SummaryController(summaryService);
    const result = await controller.findByPerson("p-empty", undefined);

    expect(result).toEqual([]);
  });

  it("GET /api/summaries — personId 누락 (undefined) 시 BadRequestException (negative — 필수 query)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();

    const controller = new SummaryController(summaryService);
    await expect(
      controller.findByPerson(undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 검증 실패 시 service 미호출.
    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("GET /api/summaries — personId 빈 문자열 시 BadRequestException (negative — 빈 query)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();

    const controller = new SummaryController(summaryService);
    await expect(controller.findByPerson("", undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("GET /api/summaries — service 의 BadRequestException (잘못된 period literal) 그대로 propagate (negative — service literal 검증)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.findByPerson.mockRejectedValueOnce(
      new BadRequestException("invalid period: yearly"),
    );

    const controller = new SummaryController(summaryService);
    await expect(
      controller.findByPerson("p-1", "yearly"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // -----------------------------------------------------------------------
  // findOne (GET /:id) — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/summaries/:id — id 를 service.findById 로 forward (happy)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    const fixture = buildSummaryFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new SummaryController(summaryService);
    const result = await controller.findOne("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/summaries/:id — service 의 NotFoundException 을 그대로 propagate (error — 404 의미, 변환·삼킴 없음)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("summary not found: missing"),
    );

    const controller = new SummaryController(summaryService);
    await expect(controller.findOne("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create (POST) — happy + error (BadRequestException period literal 위반 / FK 위반
  // P2003 / unknown error propagate). Summary 는 `@@unique` 부재 → 409 분기 없음.
  // -----------------------------------------------------------------------
  it("POST /api/summaries — dto 를 service.create 로 forward + row 반환 (happy)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    const fixture = buildSummaryFixture({ id: "new" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new SummaryController(summaryService);
    const dto = {
      personId: "p-1",
      period: "week",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      narrative: "요약",
      metricScore: 0.5,
    };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("POST /api/summaries — service 의 BadRequestException (period literal 위반) 그대로 propagate (error)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid period: yearly"),
    );

    const controller = new SummaryController(summaryService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("POST /api/summaries — service 의 BadRequestException (personId FK 위반 P2003) 그대로 propagate (negative — FK)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid personId reference: ghost"),
    );

    const controller = new SummaryController(summaryService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("POST /api/summaries — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — unknown error)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.create.mockRejectedValueOnce(rawError);

    const controller = new SummaryController(summaryService);
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(controller.create({} as never)).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // remove (DELETE /:id) — happy + error (NotFoundException P2025 propagate)
  // -----------------------------------------------------------------------
  it("DELETE /api/summaries/:id — id 를 service.remove 로 forward (happy)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.remove.mockResolvedValueOnce(undefined);

    const controller = new SummaryController(summaryService);
    await controller.remove("s-1");

    expect(serviceMock.remove).toHaveBeenCalledWith("s-1");
    expect(serviceMock.remove).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/summaries/:id — service 의 NotFoundException (P2025) 그대로 propagate (error / negative)", async () => {
    const { summaryService, serviceMock } = buildSummaryServiceMock();
    serviceMock.remove.mockRejectedValueOnce(
      new NotFoundException("summary not found: missing"),
    );

    const controller = new SummaryController(summaryService);
    await expect(controller.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. SummaryService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — CreateSummaryDto reject branch 각 1+ test
// + raw 미저장 (R-59) whitelist reject + status code (201 / 204 / 400) wire 검증.
// -----------------------------------------------------------------------
describe("SummaryController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    remove: jest.Mock;
  };

  // 정상 POST payload — 각 negative test 가 단일 field 만 변형해 격리.
  const validCreateBody = {
    personId: "p-1",
    period: "week",
    periodStart: "2026-02-01T00:00:00.000Z",
    narrative: "요약",
    metricScore: 0.5,
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPerson: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SummaryController],
      providers: [{ provide: SummaryService, useValue: serviceMock }],
    })
      // T-0123 RBAC — JwtAuthGuard / RolesGuard 를 통과 mock 으로 override (실 verify
      // path 는 별도 layer 책임, T-0083 의 roles.guard.spec / jwt.strategy.spec 이 cover).
      // 본 integration block 은 ValidationPipe negative case 가 책임 — guard 는 통과시켜
      // ValidationPipe 분기에 도달하게 함. contribution.controller.spec 의 overrideGuard 패턴 mirror.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    // Controller-scope @UsePipes 가 자동 활성화 — global wire 안 함 (별도 후속 책임).
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Happy reference — ValidationPipe 가 정상 payload 는 통과시킴 → 201.
  it("정상 payload 는 ValidationPipe 통과 후 201 응답 (sanity)", async () => {
    serviceMock.create.mockResolvedValueOnce(buildSummaryFixture());

    await request(app.getHttpServer())
      .post("/api/summaries")
      .send(validCreateBody)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: 필수 field 누락 (빈 body) → 다수 decorator 위반 → 400.
  it("POST 빈 body 시 400 (negative #1: missing required fields)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({})
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: 정의되지 않은 raw 본문 키 (rawBody) → forbidNonWhitelisted → 400.
  // R-59 raw 미저장 invariant 의 integration-level 정합 — DTO 에 raw 키 부재 +
  // whitelist 가 정의 외 필드를 400 으로 reject.
  it("POST 에 raw 본문 키 (rawBody) 포함 시 400 (negative #2 / R-59: non-whitelisted raw field reject)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({ ...validCreateBody, rawBody: "전체 commit diff 본문" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: metricScore 가 number 아닌 string → @IsNumber 위반 → 400.
  it("POST metricScore 가 비-숫자 string 시 400 (negative #3: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({ ...validCreateBody, metricScore: "high" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: periodStart 가 잘못된 date 형식 → @Type+@IsDate 위반 → 400.
  it("POST periodStart 가 잘못된 date 형식 시 400 (negative #4: invalid date)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({ ...validCreateBody, periodStart: "not-a-date" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 5: personId 가 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("POST personId 가 빈 문자열 시 400 (negative #5: empty required field)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({ ...validCreateBody, personId: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 6: narrative 가 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("POST narrative 가 빈 문자열 시 400 (negative #6: empty required field)", async () => {
    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({ ...validCreateBody, narrative: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // GET 필수 query negative — personId 누락 시 400 (controller-layer 명시 검증).
  it("GET /api/summaries personId query 누락 시 400 (negative: 필수 query)", async () => {
    await request(app.getHttpServer()).get("/api/summaries").expect(400);

    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  // GET happy + period query 분기 (integration-level routing 검산).
  it("GET /api/summaries?personId=&period= 시 200 + service 에 { period } forward", async () => {
    serviceMock.findByPerson.mockResolvedValueOnce([buildSummaryFixture()]);

    const res = await request(app.getHttpServer())
      .get("/api/summaries?personId=p-1&period=day")
      .expect(200);

    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", {
      period: "day",
    });
    expect(Array.isArray(res.body)).toBe(true);
  });

  // DELETE 204 status code 검증 — @HttpCode(204) decorator 의 wire 검산.
  it("DELETE /api/summaries/:id 정상 시 204 No Content", async () => {
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer()).delete("/api/summaries/s-1").expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("s-1");
  });

  // GET :id error path — service NotFoundException → 404 자동 (HttpException mapping).
  it("GET /api/summaries/:id — service NotFoundException 시 404 (error path)", async () => {
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("summary not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/summaries/missing")
      .expect(404);

    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0123). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. contribution.controller.spec (T-0122) 의 "RBAC guard
// integration" 1:1 mirror. 실 verify path (cookie → JWT verify / escalation 매핑) 는
// 별도 layer spec (T-0083) 책임 — 본 block 은 controller 의 4 endpoint 에 guard 가
// wire 됐는지 + 거부 시 service 미호출 + 통과 시 service 위임을 검증.
// e2e (summaries.e2e-spec.ts) 가 실 verify path round-trip 박제.
// -----------------------------------------------------------------------
describe("SummaryController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    remove: jest.Mock;
  };

  // 정상 POST payload — happy Admin+ 검증에서 ValidationPipe 통과용.
  const validCreateBody = {
    personId: "p-1",
    period: "week",
    periodStart: "2026-02-01T00:00:00.000Z",
    narrative: "요약",
    metricScore: 0.5,
  };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환 (contribution.controller.spec 의
  // makeAllowingJwtGuard 1:1 mirror).
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

  // buildApp — guard override 분기 주입 후 app 부트스트랩. contribution.controller.spec
  // buildApp 패턴 mirror (SummaryService mock + 2 guard override).
  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPerson: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SummaryController],
      providers: [{ provide: SummaryService, useValue: serviceMock }],
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

  // -- happy — User+ tier (GET) : User role token 으로 GET 통과 + service 위임 ----
  it("GET /api/summaries — User role 통과 시 200 + service.findByPerson 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findByPerson.mockResolvedValueOnce([buildSummaryFixture()]);

    await request(app.getHttpServer())
      .get("/api/summaries?personId=p-1")
      .expect(200);

    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", undefined);
  });

  it("GET /api/summaries/:id — User role 통과 시 200 + service.findById 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockResolvedValueOnce(buildSummaryFixture());

    await request(app.getHttpServer()).get("/api/summaries/s-1").expect(200);

    expect(serviceMock.findById).toHaveBeenCalledWith("s-1");
  });

  // -- happy — Admin+ tier (POST/DELETE) : Admin role 통과 + service 위임 --------
  it("POST /api/summaries — Admin role 통과 시 201 + service.create 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockResolvedValueOnce(buildSummaryFixture());

    await request(app.getHttpServer())
      .post("/api/summaries")
      .send(validCreateBody)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/summaries/:id — Admin role 통과 시 204 + service.remove 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer()).delete("/api/summaries/s-1").expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("s-1");
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재 / verify fail) -----------
  // NestJS AuthGuard 의 canActivate=false → 통상 UnauthorizedException(401).
  // override mock 이 UnauthorizedException 을 throw 하여 실 JwtAuthGuard 의 401 분기 mirror.
  it("GET /api/summaries — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/summaries?personId=p-1")
      .expect(401);

    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("POST /api/summaries — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/summaries")
      .send({})
      .expect(401);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) --------
  it("POST /api/summaries — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/summaries")
      .send(validCreateBody)
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it("DELETE /api/summaries/:id — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer()).delete("/api/summaries/s-1").expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 User+ / Admin+ tier 분기 박제
// (mock 이 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제),
// RolesGuard 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). contribution.controller.spec
// 의 동일 describe 1:1 mirror.
// -----------------------------------------------------------------------
describe("SummaryController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    remove: jest.Mock;
  };

  // 정상 POST payload — Admin+ happy 검증용 (ValidationPipe 통과).
  const validCreateBody = {
    personId: "p-1",
    period: "week",
    periodStart: "2026-02-01T00:00:00.000Z",
    narrative: "요약",
    metricScore: 0.5,
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

  // 실 RolesGuard 사용 — JwtAuthGuard 만 override (req.user 박제). RolesGuard 는
  // module 의 실 provider (Reflector 자동 주입) 그대로.
  async function buildAppWithRealRolesGuard(
    actorRole: string,
  ): Promise<INestApplication> {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPerson: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SummaryController],
      providers: [
        { provide: SummaryService, useValue: serviceMock },
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

  // User+ tier (GET) — User / Admin / SuperAdmin 모두 통과.
  it.each(["User", "Admin", "SuperAdmin"])(
    "GET /api/summaries — %s actor 는 User+ tier 통과 (200, escalation)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findByPerson.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get("/api/summaries?personId=p-1")
        .expect(200);

      expect(serviceMock.findByPerson).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (POST) — User actor 는 403 차단.
  it("POST /api/summaries — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post("/api/summaries")
      .send(validCreateBody)
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Admin+ tier (POST) — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "POST /api/summaries — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.create.mockResolvedValueOnce(buildSummaryFixture());

      await request(app.getHttpServer())
        .post("/api/summaries")
        .send(validCreateBody)
        .expect(201);

      expect(serviceMock.create).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (DELETE) — User actor 403 차단.
  it("DELETE /api/summaries/:id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer()).delete("/api/summaries/s-1").expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

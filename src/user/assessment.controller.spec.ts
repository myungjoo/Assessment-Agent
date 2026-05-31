// AssessmentController spec — T-0117 acceptance 박제 (4 endpoint, R-112: happy / error
// / branch / negative + ValidationPipe negative integration via supertest).
// GroupController spec (T-0055/T-0057/T-0068) 1:1 mirror, 단 Assessment 는 immutable
// (update endpoint 부재) + period query 분기 + Decimal contributionScore field.
//
// 본 spec 은 두 부분으로 구성 (group.controller.spec.ts 1:1 mirror):
//   1. Unit-level (controller-only with mocked AssessmentService) — 4 endpoint 의
//      routing / service 호출 인자 / 예외 propagation 검증 + period query 분기.
//   2. Integration-level (createNestApplication + controller-scope ValidationPipe 자동
//      활성화 + supertest) — CreateAssessmentDto decorator 위반 negative case + raw
//      미저장 (R-59) whitelist reject 검증.
//
// PrismaService 는 AssessmentController → AssessmentService → AssessmentRepository chain
// 의 dep 안전성을 위해 jest.mock 으로 회피 (group.controller.spec 패턴 동일).
//
// GroupController spec 과의 차이점:
//   - findByPerson 의 period query 분기 (지정 → `{ period }` / 미지정 → undefined) cover.
//   - personId 필수 query 누락 → 400 (controller-layer 명시 검증, BadRequestException).
//   - create 의 P2002 → ConflictException + literal 위반 → BadRequestException 2 종
//     error propagate cover (Assessment 는 `@@unique` 정의 + service literal 검증 존재).
//   - update / PATCH endpoint 부재 (Assessment 는 immutable).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    assessment = {
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
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Assessment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";
/* eslint-enable import/first */

// Assessment fixture — schema.prisma 의 9 컬럼 (id / personId / period / scope /
// periodStart / difficulty / contributionScore / volume / narrative / createdAt) default
// 채움. contributionScore 는 Prisma.Decimal (Decimal 컬럼 정합).
function buildAssessmentFixture(
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    id: "assessment-default",
    personId: "person-default",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    difficulty: "medium",
    contributionScore: new Prisma.Decimal("0.75"),
    volume: 10,
    narrative: "이번 주 기여 요약",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Assessment;
}

// AssessmentService mock factory — 4 메서드 모두 jest.fn() (create / findById /
// findByPerson / remove 1:1). 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildAssessmentServiceMock(): {
  assessmentService: AssessmentService;
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
    assessmentService: serviceMock as unknown as AssessmentService,
    serviceMock,
  };
}

describe("AssessmentController (unit)", () => {
  // -----------------------------------------------------------------------
  // findByPerson (GET /api/assessments) — happy + branch (period 분기) + negative
  // -----------------------------------------------------------------------
  it("GET /api/assessments — personId 만 지정 시 (personId, undefined) 를 service.findByPerson 로 forward (happy + branch — period 미지정)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    const fixture = [
      buildAssessmentFixture({ id: "a-1" }),
      buildAssessmentFixture({ id: "a-2" }),
    ];
    serviceMock.findByPerson.mockResolvedValueOnce(fixture);

    const controller = new AssessmentController(assessmentService);
    const result = await controller.findByPerson("p-1", undefined);

    // period 미지정 → options 인자는 undefined forward.
    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", undefined);
    expect(serviceMock.findByPerson).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(2);
  });

  it("GET /api/assessments — period 지정 시 (personId, { period }) options 결합 forward (branch — period 지정)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    const fixture = [buildAssessmentFixture({ id: "a-1", period: "day" })];
    serviceMock.findByPerson.mockResolvedValueOnce(fixture);

    const controller = new AssessmentController(assessmentService);
    const result = await controller.findByPerson("p-1", "day");

    // period 지정 → `{ period }` options 로 결합 forward.
    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", {
      period: "day",
    });
    expect(result).toBe(fixture);
  });

  it("GET /api/assessments — 매칭 row 0 시 빈 배열 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.findByPerson.mockResolvedValueOnce([]);

    const controller = new AssessmentController(assessmentService);
    const result = await controller.findByPerson("p-empty", undefined);

    expect(result).toEqual([]);
  });

  it("GET /api/assessments — personId 누락 (undefined) 시 BadRequestException (negative — 필수 query)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();

    const controller = new AssessmentController(assessmentService);
    await expect(
      controller.findByPerson(undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 검증 실패 시 service 미호출.
    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("GET /api/assessments — personId 빈 문자열 시 BadRequestException (negative — 빈 query)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();

    const controller = new AssessmentController(assessmentService);
    await expect(controller.findByPerson("", undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("GET /api/assessments — service 의 BadRequestException (잘못된 period literal) 그대로 propagate (negative — service literal 검증)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.findByPerson.mockRejectedValueOnce(
      new BadRequestException("invalid period: yearly"),
    );

    const controller = new AssessmentController(assessmentService);
    await expect(
      controller.findByPerson("p-1", "yearly"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // -----------------------------------------------------------------------
  // findOne (GET /:id) — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/assessments/:id — id 를 service.findById 로 forward (happy)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    const fixture = buildAssessmentFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new AssessmentController(assessmentService);
    const result = await controller.findOne("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/assessments/:id — service 의 NotFoundException 을 그대로 propagate (error — 404 의미, 변환·삼킴 없음)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("assessment not found: missing"),
    );

    const controller = new AssessmentController(assessmentService);
    await expect(controller.findOne("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create (POST) — happy + error (ConflictException P2002 / BadRequestException
  // literal 위반 / unknown error propagate)
  // -----------------------------------------------------------------------
  it("POST /api/assessments — dto 를 service.create 로 forward + row 반환 (happy)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    const fixture = buildAssessmentFixture({ id: "new" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new AssessmentController(assessmentService);
    const dto = {
      personId: "p-1",
      period: "week",
      scope: "commit",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      difficulty: "medium",
      contributionScore: 0.5,
      volume: 5,
      narrative: "요약",
    };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("POST /api/assessments — service 의 ConflictException (P2002 중복) 그대로 propagate (error)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new ConflictException("assessment already exists"),
    );

    const controller = new AssessmentController(assessmentService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("POST /api/assessments — service 의 BadRequestException (literal 위반) 그대로 propagate (error)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid scope: foo"),
    );

    const controller = new AssessmentController(assessmentService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("POST /api/assessments — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — unknown error)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.create.mockRejectedValueOnce(rawError);

    const controller = new AssessmentController(assessmentService);
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(controller.create({} as never)).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // remove (DELETE /:id) — happy + error (NotFoundException P2025 propagate)
  // -----------------------------------------------------------------------
  it("DELETE /api/assessments/:id — id 를 service.remove 로 forward (happy)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.remove.mockResolvedValueOnce(undefined);

    const controller = new AssessmentController(assessmentService);
    await controller.remove("a-1");

    expect(serviceMock.remove).toHaveBeenCalledWith("a-1");
    expect(serviceMock.remove).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/assessments/:id — service 의 NotFoundException (P2025) 그대로 propagate (error / negative)", async () => {
    const { assessmentService, serviceMock } = buildAssessmentServiceMock();
    serviceMock.remove.mockRejectedValueOnce(
      new NotFoundException("assessment not found: missing"),
    );

    const controller = new AssessmentController(assessmentService);
    await expect(controller.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. AssessmentService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — CreateAssessmentDto reject branch 각 1+ test
// + raw 미저장 (R-59) whitelist reject + status code (201 / 204 / 400) wire 검증.
// -----------------------------------------------------------------------
describe("AssessmentController (ValidationPipe integration)", () => {
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
    scope: "commit",
    periodStart: "2026-02-01T00:00:00.000Z",
    difficulty: "medium",
    contributionScore: 0.5,
    volume: 5,
    narrative: "요약",
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPerson: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [{ provide: AssessmentService, useValue: serviceMock }],
    })
      // T-0121 RBAC — JwtAuthGuard / RolesGuard 를 통과 mock 으로 override (실 verify
      // path 는 별도 layer 책임, T-0083 의 roles.guard.spec / jwt.strategy.spec 이 cover).
      // 본 integration block 은 ValidationPipe negative case 가 책임 — guard 는 통과시켜
      // ValidationPipe 분기에 도달하게 함. user.controller.spec 의 overrideGuard 패턴 mirror.
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
    serviceMock.create.mockResolvedValueOnce(buildAssessmentFixture());

    await request(app.getHttpServer())
      .post("/api/assessments")
      .send(validCreateBody)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: 필수 field 누락 (빈 body) → 다수 decorator 위반 → 400.
  it("POST 빈 body 시 400 (negative #1: missing required fields)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({})
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: 정의되지 않은 raw 본문 키 (rawBody) → forbidNonWhitelisted → 400.
  // R-59 raw 미저장 invariant 의 e2e/integration-level 정합 — DTO 에 raw 키 부재 +
  // whitelist 가 정의 외 필드를 400 으로 reject.
  it("POST 에 raw 본문 키 (rawBody) 포함 시 400 (negative #2 / R-59: non-whitelisted raw field reject)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({ ...validCreateBody, rawBody: "전체 commit diff 본문" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: volume 이 음수 → @Min(0) 위반 → 400.
  it("POST volume 음수 시 400 (negative #3: @Min(0) violation)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({ ...validCreateBody, volume: -1 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: periodStart 가 잘못된 date 형식 → @Type+@IsDate 위반 → 400.
  it("POST periodStart 가 잘못된 date 형식 시 400 (negative #4: invalid date)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({ ...validCreateBody, periodStart: "not-a-date" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 5: contributionScore 가 number 아닌 string → @IsNumber 위반 → 400.
  it("POST contributionScore 가 비-숫자 string 시 400 (negative #5: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({ ...validCreateBody, contributionScore: "high" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 6: personId 가 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("POST personId 가 빈 문자열 시 400 (negative #6: empty required field)", async () => {
    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({ ...validCreateBody, personId: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // GET 필수 query negative — personId 누락 시 400 (controller-layer 명시 검증).
  it("GET /api/assessments personId query 누락 시 400 (negative: 필수 query)", async () => {
    await request(app.getHttpServer()).get("/api/assessments").expect(400);

    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  // GET happy + period query 분기 (integration-level routing 검산).
  it("GET /api/assessments?personId=&period= 시 200 + service 에 { period } forward", async () => {
    serviceMock.findByPerson.mockResolvedValueOnce([buildAssessmentFixture()]);

    const res = await request(app.getHttpServer())
      .get("/api/assessments?personId=p-1&period=day")
      .expect(200);

    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", {
      period: "day",
    });
    expect(Array.isArray(res.body)).toBe(true);
  });

  // DELETE 204 status code 검증 — @HttpCode(204) decorator 의 wire 검산.
  it("DELETE /api/assessments/:id 정상 시 204 No Content", async () => {
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/assessments/a-1")
      .expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("a-1");
  });

  // GET :id error path — service NotFoundException → 404 자동 (HttpException mapping).
  it("GET /api/assessments/:id — service NotFoundException 시 404 (error path)", async () => {
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("assessment not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/assessments/missing")
      .expect(404);

    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0121). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. user.controller.spec 의 "Guard integration" 1:1 mirror.
// 실 verify path (cookie → JWT verify / escalation 매핑) 는 별도 layer spec (T-0083)
// 책임 — 본 block 은 controller 의 4 endpoint 에 guard 가 wire 됐는지 + 거부 시
// service 미호출 + 통과 시 service 위임을 검증. e2e (assessments.e2e-spec.ts) 가
// 실 verify path round-trip 박제.
// -----------------------------------------------------------------------
describe("AssessmentController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    remove: jest.Mock;
  };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환 (user.controller.spec 의
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

  // buildApp — guard override 분기 주입 후 app 부트스트랩. user.controller.spec
  // buildApp 패턴 mirror (AssessmentService mock + 2 guard override).
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
      controllers: [AssessmentController],
      providers: [{ provide: AssessmentService, useValue: serviceMock }],
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
  it("GET /api/assessments — User role 통과 시 200 + service.findByPerson 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findByPerson.mockResolvedValueOnce([buildAssessmentFixture()]);

    await request(app.getHttpServer())
      .get("/api/assessments?personId=p-1")
      .expect(200);

    expect(serviceMock.findByPerson).toHaveBeenCalledWith("p-1", undefined);
  });

  it("GET /api/assessments/:id — User role 통과 시 200 + service.findById 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockResolvedValueOnce(buildAssessmentFixture());

    await request(app.getHttpServer()).get("/api/assessments/a-1").expect(200);

    expect(serviceMock.findById).toHaveBeenCalledWith("a-1");
  });

  // -- happy — Admin+ tier (POST/DELETE) : Admin role 통과 + service 위임 --------
  it("POST /api/assessments — Admin role 통과 시 201 + service.create 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockResolvedValueOnce(buildAssessmentFixture());

    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({
        personId: "p-1",
        period: "week",
        scope: "commit",
        periodStart: "2026-02-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      })
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/assessments/:id — Admin role 통과 시 204 + service.remove 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/assessments/a-1")
      .expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("a-1");
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재 / verify fail) -----------
  // NestJS AuthGuard 의 canActivate=false → 통상 UnauthorizedException(401).
  // override mock 이 UnauthorizedException 을 throw 하여 실 JwtAuthGuard 의 401 분기 mirror.
  it("GET /api/assessments — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/assessments?personId=p-1")
      .expect(401);

    expect(serviceMock.findByPerson).not.toHaveBeenCalled();
  });

  it("POST /api/assessments — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({})
      .expect(401);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) --------
  it("POST /api/assessments — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({
        personId: "p-1",
        period: "week",
        scope: "commit",
        periodStart: "2026-02-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      })
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it("DELETE /api/assessments/:id — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .delete("/api/assessments/a-1")
      .expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 User+ / Admin+ tier 분기 박제
// (mock 이 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제),
// RolesGuard 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). users.e2e 의
// escalation hierarchy descent 박제를 unit/integration 차원에서 보강.
// -----------------------------------------------------------------------
describe("AssessmentController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
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
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentService, useValue: serviceMock },
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
    "GET /api/assessments — %s actor 는 User+ tier 통과 (200, escalation)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findByPerson.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get("/api/assessments?personId=p-1")
        .expect(200);

      expect(serviceMock.findByPerson).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (POST) — User actor 는 403 차단.
  it("POST /api/assessments — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post("/api/assessments")
      .send({
        personId: "p-1",
        period: "week",
        scope: "commit",
        periodStart: "2026-02-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      })
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Admin+ tier (POST) — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "POST /api/assessments — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      await request(app.getHttpServer())
        .post("/api/assessments")
        .send({
          personId: "p-1",
          period: "week",
          scope: "commit",
          periodStart: "2026-02-01T00:00:00.000Z",
          difficulty: "medium",
          contributionScore: 0.5,
          volume: 5,
          narrative: "요약",
        })
        .expect(201);

      expect(serviceMock.create).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (DELETE) — User actor 403 차단.
  it("DELETE /api/assessments/:id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .delete("/api/assessments/a-1")
      .expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

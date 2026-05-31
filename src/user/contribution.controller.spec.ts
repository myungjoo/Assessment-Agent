// ContributionController spec — T-0118 acceptance 박제 (4 endpoint, R-112: happy / error
// / branch / negative + ValidationPipe negative integration via supertest).
// assessment.controller.spec.ts (T-0117) 1:1 mirror, 단 Contribution 은:
//   - findByAssessment 의 assessmentId 필수 query (period query 분기 부재).
//   - `@@unique` 부재 → ConflictException (409) 분기 없음. 대신 assessmentId FK 위반
//     (P2003) → service BadRequestException (400) propagate.
//   - update / PATCH endpoint 부재 (Contribution 은 immutable, ADR-0006 §2).
//   - periodStart / narrative field 부재 (Contribution payload 는 7 키).
//
// 본 spec 은 두 부분으로 구성 (assessment.controller.spec.ts mirror):
//   1. Unit-level (controller-only with mocked ContributionService) — 4 endpoint 의
//      routing / service 호출 인자 / 예외 propagation 검증 + assessmentId 필수 query 분기.
//   2. Integration-level (createNestApplication + controller-scope ValidationPipe 자동
//      활성화 + supertest) — CreateContributionDto decorator 위반 negative case + raw
//      미저장 (R-59) whitelist reject 검증.
//
// PrismaService 는 ContributionController → ContributionService → ContributionRepository
// chain 의 dep 안전성을 위해 jest.mock 으로 회피 (assessment.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    contribution = {
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
import type { Contribution } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { ContributionController } from "./contribution.controller";
import { ContributionService } from "./contribution.service";
/* eslint-enable import/first */

// Contribution fixture — schema.prisma 의 8 컬럼 (id / assessmentId / sourceType /
// sourceUrl / sourceRef / difficulty / contributionScore / volume / createdAt) default
// 채움. contributionScore 는 Prisma.Decimal (Decimal 컬럼 정합).
function buildContributionFixture(
  overrides: Partial<Contribution> = {},
): Contribution {
  return {
    id: "contribution-default",
    assessmentId: "assessment-default",
    sourceType: "commit",
    sourceUrl: "https://github.com/org/repo/commit/abc123",
    sourceRef: "abc123",
    difficulty: "medium",
    contributionScore: new Prisma.Decimal("0.75"),
    volume: 10,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Contribution;
}

// ContributionService mock factory — 4 메서드 모두 jest.fn() (create / findById /
// findByAssessment / remove 1:1). 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildContributionServiceMock(): {
  contributionService: ContributionService;
  serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessment: jest.Mock;
    remove: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findByAssessment: jest.fn(),
    remove: jest.fn(),
  };
  return {
    contributionService: serviceMock as unknown as ContributionService,
    serviceMock,
  };
}

describe("ContributionController (unit)", () => {
  // -----------------------------------------------------------------------
  // findByAssessment (GET /api/contributions) — happy + branch (assessmentId 분기)
  // + negative
  // -----------------------------------------------------------------------
  it("GET /api/contributions — assessmentId 지정 시 service.findByAssessment 로 forward (happy + branch — assessmentId 존재)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    const fixture = [
      buildContributionFixture({ id: "c-1" }),
      buildContributionFixture({ id: "c-2" }),
    ];
    serviceMock.findByAssessment.mockResolvedValueOnce(fixture);

    const controller = new ContributionController(contributionService);
    const result = await controller.findByAssessment("a-1");

    expect(serviceMock.findByAssessment).toHaveBeenCalledWith("a-1");
    expect(serviceMock.findByAssessment).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(2);
  });

  it("GET /api/contributions — 매칭 row 0 시 빈 배열 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.findByAssessment.mockResolvedValueOnce([]);

    const controller = new ContributionController(contributionService);
    const result = await controller.findByAssessment("a-empty");

    expect(result).toEqual([]);
  });

  it("GET /api/contributions — assessmentId 누락 (undefined) 시 BadRequestException (negative — 필수 query)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();

    const controller = new ContributionController(contributionService);
    await expect(controller.findByAssessment(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // 검증 실패 시 service 미호출.
    expect(serviceMock.findByAssessment).not.toHaveBeenCalled();
  });

  it("GET /api/contributions — assessmentId 빈 문자열 시 BadRequestException (negative — 빈 query)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();

    const controller = new ContributionController(contributionService);
    await expect(controller.findByAssessment("")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(serviceMock.findByAssessment).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // findOne (GET /:id) — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/contributions/:id — id 를 service.findById 로 forward (happy)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    const fixture = buildContributionFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new ContributionController(contributionService);
    const result = await controller.findOne("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/contributions/:id — service 의 NotFoundException 을 그대로 propagate (error — 404 의미, 변환·삼킴 없음)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("contribution not found: missing"),
    );

    const controller = new ContributionController(contributionService);
    await expect(controller.findOne("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create (POST) — happy + error (BadRequestException literal·FK 위반 /
  // unknown error propagate). Contribution 은 `@@unique` 부재 → ConflictException 없음.
  // -----------------------------------------------------------------------
  it("POST /api/contributions — dto 를 service.create 로 forward + row 반환 (happy)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    const fixture = buildContributionFixture({ id: "new" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new ContributionController(contributionService);
    const dto = {
      assessmentId: "a-1",
      sourceType: "commit",
      sourceUrl: "https://github.com/org/repo/commit/def456",
      sourceRef: "def456",
      difficulty: "medium",
      contributionScore: 0.5,
      volume: 5,
    };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("POST /api/contributions — service 의 BadRequestException (literal 위반) 그대로 propagate (error)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid sourceType: foo"),
    );

    const controller = new ContributionController(contributionService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("POST /api/contributions — service 의 BadRequestException (assessmentId FK 위반 P2003) 그대로 propagate (error / negative)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid assessmentId reference: missing-fk"),
    );

    const controller = new ContributionController(contributionService);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("POST /api/contributions — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — unknown error)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.create.mockRejectedValueOnce(rawError);

    const controller = new ContributionController(contributionService);
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(controller.create({} as never)).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // remove (DELETE /:id) — happy + error (NotFoundException P2025 propagate)
  // -----------------------------------------------------------------------
  it("DELETE /api/contributions/:id — id 를 service.remove 로 forward (happy)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.remove.mockResolvedValueOnce(undefined);

    const controller = new ContributionController(contributionService);
    await controller.remove("c-1");

    expect(serviceMock.remove).toHaveBeenCalledWith("c-1");
    expect(serviceMock.remove).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/contributions/:id — service 의 NotFoundException (P2025) 그대로 propagate (error / negative)", async () => {
    const { contributionService, serviceMock } = buildContributionServiceMock();
    serviceMock.remove.mockRejectedValueOnce(
      new NotFoundException("contribution not found: missing"),
    );

    const controller = new ContributionController(contributionService);
    await expect(controller.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. ContributionService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — CreateContributionDto reject branch 각 1+ test
// + raw 미저장 (R-59) whitelist reject + status code (201 / 204 / 400) wire 검증.
// -----------------------------------------------------------------------
describe("ContributionController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessment: jest.Mock;
    remove: jest.Mock;
  };

  // 정상 POST payload — 각 negative test 가 단일 field 만 변형해 격리.
  const validCreateBody = {
    assessmentId: "a-1",
    sourceType: "commit",
    sourceUrl: "https://github.com/org/repo/commit/abc123",
    sourceRef: "abc123",
    difficulty: "medium",
    contributionScore: 0.5,
    volume: 5,
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByAssessment: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ContributionController],
      providers: [{ provide: ContributionService, useValue: serviceMock }],
    })
      // T-0122 RBAC — JwtAuthGuard / RolesGuard 를 통과 mock 으로 override (실 verify
      // path 는 별도 layer 책임, T-0083 의 roles.guard.spec / jwt.strategy.spec 이 cover).
      // 본 integration block 은 ValidationPipe negative case 가 책임 — guard 는 통과시켜
      // ValidationPipe 분기에 도달하게 함. assessment.controller.spec 의 overrideGuard 패턴 mirror.
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
    serviceMock.create.mockResolvedValueOnce(buildContributionFixture());

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send(validCreateBody)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: 필수 field 누락 (빈 body) → 다수 decorator 위반 → 400.
  it("POST 빈 body 시 400 (negative #1: missing required fields)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({})
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: 정의되지 않은 raw 본문 키 (rawBody) → forbidNonWhitelisted → 400.
  // R-59 raw 미저장 invariant 의 e2e/integration-level 정합 — DTO 에 raw 키 부재 +
  // whitelist 가 정의 외 필드를 400 으로 reject.
  it("POST 에 raw 본문 키 (rawBody) 포함 시 400 (negative #2 / R-59: non-whitelisted raw field reject)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({ ...validCreateBody, rawBody: "전체 commit diff 본문" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: volume 이 음수 → @Min(0) 위반 → 400.
  it("POST volume 음수 시 400 (negative #3: @Min(0) violation)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({ ...validCreateBody, volume: -1 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: contributionScore 가 number 아닌 string → @IsNumber 위반 → 400.
  it("POST contributionScore 가 비-숫자 string 시 400 (negative #4: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({ ...validCreateBody, contributionScore: "high" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 5: assessmentId 가 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("POST assessmentId 가 빈 문자열 시 400 (negative #5: empty required field)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({ ...validCreateBody, assessmentId: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 6: sourceUrl 이 number → @IsString 위반 → 400.
  it("POST sourceUrl 이 number 시 400 (negative #6: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({ ...validCreateBody, sourceUrl: 12345 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // GET 필수 query negative — assessmentId 누락 시 400 (controller-layer 명시 검증).
  it("GET /api/contributions assessmentId query 누락 시 400 (negative: 필수 query)", async () => {
    await request(app.getHttpServer()).get("/api/contributions").expect(400);

    expect(serviceMock.findByAssessment).not.toHaveBeenCalled();
  });

  // GET happy + assessmentId query (integration-level routing 검산).
  it("GET /api/contributions?assessmentId= 시 200 + service 에 assessmentId forward", async () => {
    serviceMock.findByAssessment.mockResolvedValueOnce([
      buildContributionFixture(),
    ]);

    const res = await request(app.getHttpServer())
      .get("/api/contributions?assessmentId=a-1")
      .expect(200);

    expect(serviceMock.findByAssessment).toHaveBeenCalledWith("a-1");
    expect(Array.isArray(res.body)).toBe(true);
  });

  // DELETE 204 status code 검증 — @HttpCode(204) decorator 의 wire 검산.
  it("DELETE /api/contributions/:id 정상 시 204 No Content", async () => {
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/contributions/c-1")
      .expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("c-1");
  });

  // GET :id error path — service NotFoundException → 404 자동 (HttpException mapping).
  it("GET /api/contributions/:id — service NotFoundException 시 404 (error path)", async () => {
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("contribution not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/contributions/missing")
      .expect(404);

    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
  });

  // POST error path — service BadRequestException (FK/literal 위반) → 400 자동.
  it("POST /api/contributions — service BadRequestException 시 400 (error path)", async () => {
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("invalid assessmentId reference: missing-fk"),
    );

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send(validCreateBody)
      .expect(400);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0122). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. assessment.controller.spec (T-0121) 의 "RBAC guard
// integration" 1:1 mirror. 실 verify path (cookie → JWT verify / escalation 매핑) 는
// 별도 layer spec (T-0083) 책임 — 본 block 은 controller 의 4 endpoint 에 guard 가
// wire 됐는지 + 거부 시 service 미호출 + 통과 시 service 위임을 검증.
// e2e (contributions.e2e-spec.ts) 가 실 verify path round-trip 박제.
// -----------------------------------------------------------------------
describe("ContributionController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessment: jest.Mock;
    remove: jest.Mock;
  };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환 (assessment.controller.spec 의
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

  // buildApp — guard override 분기 주입 후 app 부트스트랩. assessment.controller.spec
  // buildApp 패턴 mirror (ContributionService mock + 2 guard override).
  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByAssessment: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ContributionController],
      providers: [{ provide: ContributionService, useValue: serviceMock }],
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
  it("GET /api/contributions — User role 통과 시 200 + service.findByAssessment 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findByAssessment.mockResolvedValueOnce([
      buildContributionFixture(),
    ]);

    await request(app.getHttpServer())
      .get("/api/contributions?assessmentId=a-1")
      .expect(200);

    expect(serviceMock.findByAssessment).toHaveBeenCalledWith("a-1");
  });

  it("GET /api/contributions/:id — User role 통과 시 200 + service.findById 위임 (happy — User+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockResolvedValueOnce(buildContributionFixture());

    await request(app.getHttpServer())
      .get("/api/contributions/c-1")
      .expect(200);

    expect(serviceMock.findById).toHaveBeenCalledWith("c-1");
  });

  // -- happy — Admin+ tier (POST/DELETE) : Admin role 통과 + service 위임 --------
  it("POST /api/contributions — Admin role 통과 시 201 + service.create 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockResolvedValueOnce(buildContributionFixture());

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({
        assessmentId: "a-1",
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      })
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  it("DELETE /api/contributions/:id — Admin role 통과 시 204 + service.remove 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/contributions/c-1")
      .expect(204);

    expect(serviceMock.remove).toHaveBeenCalledWith("c-1");
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재 / verify fail) -----------
  // NestJS AuthGuard 의 canActivate=false → 통상 UnauthorizedException(401).
  // override mock 이 UnauthorizedException 을 throw 하여 실 JwtAuthGuard 의 401 분기 mirror.
  it("GET /api/contributions — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/contributions?assessmentId=a-1")
      .expect(401);

    expect(serviceMock.findByAssessment).not.toHaveBeenCalled();
  });

  it("POST /api/contributions — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({})
      .expect(401);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) --------
  it("POST /api/contributions — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({
        assessmentId: "a-1",
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      })
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it("DELETE /api/contributions/:id — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .delete("/api/contributions/c-1")
      .expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 User+ / Admin+ tier 분기 박제
// (mock 이 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제),
// RolesGuard 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). assessment.controller.spec
// 의 동일 describe 1:1 mirror.
// -----------------------------------------------------------------------
describe("ContributionController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessment: jest.Mock;
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
      findByAssessment: jest.fn(),
      remove: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ContributionController],
      providers: [
        { provide: ContributionService, useValue: serviceMock },
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
    "GET /api/contributions — %s actor 는 User+ tier 통과 (200, escalation)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findByAssessment.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get("/api/contributions?assessmentId=a-1")
        .expect(200);

      expect(serviceMock.findByAssessment).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (POST) — User actor 는 403 차단.
  it("POST /api/contributions — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post("/api/contributions")
      .send({
        assessmentId: "a-1",
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      })
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Admin+ tier (POST) — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "POST /api/contributions — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.create.mockResolvedValueOnce(buildContributionFixture());

      await request(app.getHttpServer())
        .post("/api/contributions")
        .send({
          assessmentId: "a-1",
          sourceType: "commit",
          sourceUrl: "https://github.com/org/repo/commit/abc123",
          sourceRef: "abc123",
          difficulty: "medium",
          contributionScore: 0.5,
          volume: 5,
        })
        .expect(201);

      expect(serviceMock.create).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (DELETE) — User actor 403 차단.
  it("DELETE /api/contributions/:id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .delete("/api/contributions/c-1")
      .expect(403);

    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

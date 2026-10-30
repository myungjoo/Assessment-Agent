// RecentDeletionController spec (POST /api/schedules/recent-deletion/:personId). runner 는 mock 이고
// 실 삭제 · 재수집은 동작하지 않는다. 라우팅 · 인자 · 202 · ValidationPipe · 예외 매핑 · RBAC 를 본다.
import {
  BadRequestException,
  ConflictException,
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

import { RecentDeletionInputExceptionFilter } from "./recent-deletion-input-exception.filter";
import {
  RecentDeletionRunnerService,
  type RecentRefreshStatus,
} from "./recent-deletion-runner.service";
import { RecentDeletionController } from "./recent-deletion.controller";

const PERSON_ID = "person-1";
const ISO_A = "2026-06-16T00:00:00.000Z";
const ISO_B = "2026-06-15T12:30:00.000Z";

const RUN_RESULT: RecentRefreshStatus = {
  personId: PERSON_ID,
  running: true,
  result: null,
};

// RecentDeletionRunnerService mock factory.
function buildRunnerMock(): {
  runner: RecentDeletionRunnerService;
  runnerMock: { startRefresh: jest.Mock; refreshStatus: jest.Mock };
} {
  const runnerMock = {
    startRefresh: jest.fn(),
    refreshStatus: jest.fn(),
  };
  return {
    runner: runnerMock as unknown as RecentDeletionRunnerService,
    runnerMock,
  };
}

describe("RecentDeletionController (unit)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST recent-deletion — startRefresh 를 (personId, days) 로 1회 호출하고 상태를 반환한다", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

    const controller = new RecentDeletionController(runner);
    const result = await controller.recentDeletion(PERSON_ID, {
      instants: [],
      days: 7,
    });

    expect(runnerMock.startRefresh).toHaveBeenCalledTimes(1);
    expect(runnerMock.startRefresh).toHaveBeenCalledWith(PERSON_ID, 7);
    expect(result).toEqual(RUN_RESULT);
  });

  it("POST recent-deletion — days 미지정 시 undefined 를 전달한다", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

    await new RecentDeletionController(runner).recentDeletion(PERSON_ID, {
      instants: [],
    });

    expect(runnerMock.startRefresh).toHaveBeenCalledWith(PERSON_ID, undefined);
  });

  it("POST recent-deletion — client 의 instants 는 runner 로 전달되지 않는다_n", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

    await new RecentDeletionController(runner).recentDeletion(PERSON_ID, {
      instants: [ISO_A, ISO_B],
      days: 1,
    });

    expect(runnerMock.startRefresh.mock.calls[0]).toEqual([PERSON_ID, 1]);
  });

  it("GET recent-deletion — refreshStatus 를 그대로 반환한다", () => {
    const { runner, runnerMock } = buildRunnerMock();
    const status = {
      personId: PERSON_ID,
      running: false,
      result: { deletedCount: 1 },
    };
    runnerMock.refreshStatus.mockReturnValueOnce(status);

    expect(
      new RecentDeletionController(runner).recentDeletionStatus(PERSON_ID),
    ).toEqual(status);
    expect(runnerMock.refreshStatus).toHaveBeenCalledWith(PERSON_ID);
  });

  it("POST recent-deletion — startRefresh 의 reject 를 삼키지 않는다_n", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    const rawError = new Error("실행 시작 실패");
    runnerMock.startRefresh.mockRejectedValueOnce(rawError);

    await expect(
      new RecentDeletionController(runner).recentDeletion(PERSON_ID, {
        instants: [],
      }),
    ).rejects.toThrow(rawError);
  });
});

// -----------------------------------------------------------------------
// HTTP integration — supertest 로 실제 HTTP status / body wire + DTO ValidationPipe
// negative 검증. RecentDeletionRunnerService 는 mocked, RBAC guard 는 통과 mock override.
// app 에 controller-scope ValidationPipe 가 붙어있어 본문 검증이 실제로 동작한다.
// -----------------------------------------------------------------------
describe("RecentDeletionController (HTTP integration)", () => {
  let app: INestApplication;
  let runnerMock: { startRefresh: jest.Mock };

  beforeEach(async () => {
    runnerMock = { startRefresh: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecentDeletionController],
      providers: [
        { provide: RecentDeletionRunnerService, useValue: runnerMock },
      ],
    })
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

  it("POST recent-deletion 정상 시 202 + result body wire + 위임(personId / days 일치)", async () => {
    runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A, ISO_B], days: 7 })
      .expect(202);

    expect(res.body).toEqual(RUN_RESULT);
    expect(runnerMock.startRefresh).toHaveBeenCalledWith(PERSON_ID, 7);
  });

  it("POST recent-deletion — path param :personId 가 그대로 startRefresh 인자로 전달 (path param wire)", async () => {
    runnerMock.startRefresh.mockResolvedValueOnce({
      ...RUN_RESULT,
      personId: "other-99",
    });

    await request(app.getHttpServer())
      .post("/api/schedules/recent-deletion/other-99")
      .send({ instants: [ISO_A] })
      .expect(202);

    expect(runnerMock.startRefresh).toHaveBeenCalledWith("other-99", undefined);
  });

  // -- ValidationPipe negative — DTO 검증이 실제 HTTP 400 으로 표면화 --------
  it("POST recent-deletion — 정의 외 본문 키 포함 시 400 (forbidNonWhitelisted) + runner 미호출", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], reference: ISO_B })
      .expect(400);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — instants 누락 시 400 + runner 미호출 (negative)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ days: 7 })
      .expect(400);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — instants 원소가 비-ISO 시 400 + runner 미호출 (negative — @IsISO8601 each)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: ["not-a-date"] })
      .expect(400);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — days 음수 시 400 + runner 미호출 (negative — @IsPositive)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: -1 })
      .expect(400);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — days 비-정수 시 400 + runner 미호출 (negative — @IsInt)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: 1.5 })
      .expect(400);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  // -- service-throw status mapping ----------------------------------------
  it("POST recent-deletion — startRefresh NotFoundException 시 404 자동 mapping (error path)", async () => {
    runnerMock.startRefresh.mockRejectedValueOnce(
      new NotFoundException("존재하지 않는 인원"),
    );

    await request(app.getHttpServer())
      .post("/api/schedules/recent-deletion/ghost")
      .send({ instants: [ISO_A] })
      .expect(404);
  });

  it("POST recent-deletion — startRefresh BadRequestException 시 400 자동 mapping (error path)", async () => {
    runnerMock.startRefresh.mockRejectedValueOnce(
      new BadRequestException("잘못된 days"),
    );

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: 7 })
      .expect(400);
  });

  it("POST recent-deletion — 다른 실행 중 ConflictException 시 409 다_n", async () => {
    runnerMock.startRefresh.mockRejectedValueOnce(
      new ConflictException("다른 평가 실행 중"),
    );

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [] })
      .expect(409);
  });

  it("POST recent-deletion — startRefresh 일반 reject 시 500 으로 표면화 (negative — 삼키지 않음)", async () => {
    runnerMock.startRefresh.mockRejectedValueOnce(new Error("재수집 실패"));

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(500);
  });
});

// -----------------------------------------------------------------------
// RBAC guard integration — JwtAuthGuard / RolesGuard 통과/거부 분기 overrideGuard.
// backfill.controller.spec mirror.
// -----------------------------------------------------------------------
describe("RecentDeletionController (RBAC guard integration)", () => {
  let app: INestApplication;
  let runnerMock: { startRefresh: jest.Mock };

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
    runnerMock = { startRefresh: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecentDeletionController],
      providers: [
        { provide: RecentDeletionRunnerService, useValue: runnerMock },
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

  it("POST recent-deletion — Admin role 통과 시 202 + startRefresh 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(202);
    expect(runnerMock.startRefresh).toHaveBeenCalledTimes(1);
  });

  it("POST recent-deletion — JwtAuthGuard reject 시 401 + startRefresh 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(401);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — RolesGuard reject 시 403 + startRefresh 미호출 (negative — User actor 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(403);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// real RolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제. JwtAuthGuard 는
// 통과 mock, RolesGuard 는 실 instance. User 403 / Admin·SuperAdmin 202.
// -----------------------------------------------------------------------
describe("RecentDeletionController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let runnerMock: { startRefresh: jest.Mock };

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
    runnerMock = { startRefresh: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecentDeletionController],
      providers: [
        { provide: RecentDeletionRunnerService, useValue: runnerMock },
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

  it("POST recent-deletion — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(403);
    expect(runnerMock.startRefresh).not.toHaveBeenCalled();
  });

  it.each(["Admin", "SuperAdmin"])(
    "POST recent-deletion — %s actor 는 Admin+ tier 통과 (202, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      runnerMock.startRefresh.mockResolvedValueOnce(RUN_RESULT);

      await request(app.getHttpServer())
        .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
        .send({ instants: [ISO_A] })
        .expect(202);
      expect(runnerMock.startRefresh).toHaveBeenCalledTimes(1);
    },
  );
});

// -----------------------------------------------------------------------
// T-1965 — recent-deletion endpoint 입력 결함 400 매핑 필터 배선 (T-1963 Follow-up ① 회수).
// recentDeletion 핸들러에 @UseFilters(RecentDeletionInputExceptionFilter) 가 부착됐음을
// metadata 수준에서 단언하고, negative 로 클래스 레벨 미부착(전역·controller-scope 확산 0
// — task §Out of Scope)을 확인한다. 실 매핑 분기(passthrough/400/500)는 colocated
// recent-deletion-input-exception.filter.spec.ts 가 cover 한다.
// -----------------------------------------------------------------------
describe("RecentDeletionController (T-1965 입력 결함 400 매핑 필터 배선)", () => {
  it("recentDeletion 핸들러에 @UseFilters(RecentDeletionInputExceptionFilter) 부착 (입력 결함 400 매핑 gate)", () => {
    const filters = Reflect.getMetadata(
      "__exceptionFilters__",
      RecentDeletionController.prototype.recentDeletion,
    ) as unknown[];

    expect(filters).toContain(RecentDeletionInputExceptionFilter);
  });

  it("negative — controller 클래스 레벨에는 필터 미부착 (전역·controller-scope 확산 0)", () => {
    const classFilters = Reflect.getMetadata(
      "__exceptionFilters__",
      RecentDeletionController,
    ) as unknown[] | undefined;

    expect(classFilters ?? []).not.toContain(
      RecentDeletionInputExceptionFilter,
    );
  });
});

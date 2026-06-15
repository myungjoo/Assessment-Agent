// BackfillController spec — T-0421 acceptance 박제 (POST /api/schedules/backfill/:personId,
// R-112: happy / error / branch / negative + RBAC guard wire).
// cron-schedule.controller.spec.ts (T-0414) 의 4 describe block 구조를 mirror 하되
// backfill endpoint 의 차이 반영:
//   - endpoint 1개 (POST /api/schedules/backfill/:personId).
//   - 요청 본문 없음 — :personId path param 만. DTO/ValidationPipe 없음(파라미터화
//     Out of Scope)이라 cron spec 의 ValidationPipe negative block 대신 path param
//     pass-through + status/body wire 검증으로 갈음.
//   - controller 자체 분기 없음 — runBackfill 결과(skipped:false / skipped:true) 두
//     반환 형상 pass-through + service-throw propagation 으로 cover.
//
// 4 describe block:
//   1. Unit-level (controller-only, mocked BackfillRunnerService) — routing /
//      runBackfill 호출 인자(personId) / 두 결과(skipped false/true) pass-through /
//      예외(NotFoundException + 일반 reject) propagation.
//   2. Integration-level (createNestApplication + supertest) — 202 + body wire +
//      runBackfill 위임(personId 일치) + path param pass-through + service 4xx/5xx propagate.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 의 통과/거부 분기 overrideGuard.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 202).
//
// BackfillRunnerService 는 jest.fn() mock 으로 주입하므로 실 triggerCollection·실
// buildBackfillPlan·실 timer 가 동작하지 않는다(runner 자체가 mock).
import {
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
  BackfillRunnerService,
  type BackfillRunResult,
} from "./backfill-runner.service";
import { BackfillController } from "./backfill.controller";

const PERSON_ID = "person-1";

// 신규 인원 결과 — backfill 실행됨(skipped:false, triggeredCount>0).
const FRESH_RESULT: BackfillRunResult = {
  personId: PERSON_ID,
  totalWindows: 52,
  triggeredCount: 52,
  skipped: false,
};

// 기존 인원 결과 — idempotency 게이트로 skip(skipped:true, triggeredCount=0).
const SKIPPED_RESULT: BackfillRunResult = {
  personId: PERSON_ID,
  totalWindows: 0,
  triggeredCount: 0,
  skipped: true,
};

// BackfillRunnerService mock factory — runBackfill jest.fn() 1개.
function buildRunnerMock(): {
  runner: BackfillRunnerService;
  runnerMock: { runBackfill: jest.Mock };
} {
  const runnerMock = {
    runBackfill: jest.fn(),
  };
  return {
    runner: runnerMock as unknown as BackfillRunnerService,
    runnerMock,
  };
}

describe("BackfillController (unit)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // happy + branch — runBackfill 결과(skipped false/true) 두 형상 pass-through
  // -----------------------------------------------------------------------
  it("POST backfill — runBackfill 을 정확히 1회 :personId 인자로 호출하고 신규 인원 결과를 그대로 반환 (happy + branch — skipped:false)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runBackfill.mockResolvedValueOnce(FRESH_RESULT);

    const controller = new BackfillController(runner);
    const result = await controller.backfill(PERSON_ID);

    expect(runnerMock.runBackfill).toHaveBeenCalledTimes(1);
    expect(runnerMock.runBackfill).toHaveBeenCalledWith(PERSON_ID);
    expect(result).toEqual(FRESH_RESULT);
  });

  it("POST backfill — 기존 인원(idempotency skip) 결과도 그대로 반환 (branch — skipped:true pass-through)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runBackfill.mockResolvedValueOnce(SKIPPED_RESULT);

    const controller = new BackfillController(runner);
    const result = await controller.backfill(PERSON_ID);

    expect(runnerMock.runBackfill).toHaveBeenCalledWith(PERSON_ID);
    expect(result).toEqual(SKIPPED_RESULT);
  });

  // -----------------------------------------------------------------------
  // negative — path param pass-through (controller 는 검증 책임 없음)
  // -----------------------------------------------------------------------
  it("POST backfill — 빈/비정상 personId 도 검증 없이 runBackfill 로 그대로 전달 (negative — controller 검증 책임 0)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runBackfill.mockResolvedValueOnce({
      ...SKIPPED_RESULT,
      personId: "",
    });

    const controller = new BackfillController(runner);
    await controller.backfill("");

    // controller 는 빈 문자열도 거부하지 않고 그대로 위임 — service/하위가 거부 책임.
    expect(runnerMock.runBackfill).toHaveBeenCalledWith("");
  });

  // -----------------------------------------------------------------------
  // error — service-throw propagation (삼키지 않음)
  // -----------------------------------------------------------------------
  it("POST backfill — runBackfill 의 NotFoundException(Person 404) 을 삼키지 않고 그대로 propagate (error / negative)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runBackfill.mockRejectedValueOnce(
      new NotFoundException("존재하지 않는 인원: ghost"),
    );

    const controller = new BackfillController(runner);
    await expect(controller.backfill("ghost")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("POST backfill — runBackfill 의 일반 reject(collect/P2002 등)도 그대로 propagate (negative — unknown error)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    const rawError = new Error("triggerCollection 중간 window 실패");
    runnerMock.runBackfill.mockRejectedValueOnce(rawError);

    const controller = new BackfillController(runner);
    await expect(controller.backfill(PERSON_ID)).rejects.toThrow(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — supertest 로 실제 HTTP 응답 status / body wire 검증.
// BackfillRunnerService 는 mocked, RBAC guard 는 통과 mock override.
// R-112 — 202 + body wire + 위임(personId 일치) + path param pass-through +
// service 4xx/5xx propagate.
// -----------------------------------------------------------------------
describe("BackfillController (HTTP integration)", () => {
  let app: INestApplication;
  let runnerMock: { runBackfill: jest.Mock };

  beforeEach(async () => {
    runnerMock = { runBackfill: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BackfillController],
      providers: [{ provide: BackfillRunnerService, useValue: runnerMock }],
    })
      // RBAC guard 는 통과 mock override — 본 block 은 status/body wire 가 책임.
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

  it("POST backfill 정상(신규 인원) 시 202 + result body wire + runBackfill 위임(personId 일치)", async () => {
    runnerMock.runBackfill.mockResolvedValueOnce(FRESH_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(202);

    expect(res.body).toEqual(FRESH_RESULT);
    expect(runnerMock.runBackfill).toHaveBeenCalledWith(PERSON_ID);
  });

  it("POST backfill 기존 인원(skip) 시도 202 + skipped body wire (branch — skipped:true)", async () => {
    runnerMock.runBackfill.mockResolvedValueOnce(SKIPPED_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(202);

    expect(res.body.skipped).toBe(true);
    expect(res.body.triggeredCount).toBe(0);
  });

  it("POST backfill — path param :personId 가 그대로 runBackfill 인자로 전달 (path param wire)", async () => {
    runnerMock.runBackfill.mockResolvedValueOnce({
      ...FRESH_RESULT,
      personId: "other-99",
    });

    await request(app.getHttpServer())
      .post("/api/schedules/backfill/other-99")
      .expect(202);

    expect(runnerMock.runBackfill).toHaveBeenCalledWith("other-99");
  });

  it("POST backfill — runBackfill NotFoundException 시 404 자동 mapping (error path)", async () => {
    runnerMock.runBackfill.mockRejectedValueOnce(
      new NotFoundException("존재하지 않는 인원"),
    );

    await request(app.getHttpServer())
      .post("/api/schedules/backfill/ghost")
      .expect(404);
  });

  it("POST backfill — runBackfill 일반 reject 시 500 으로 표면화 (negative — 삼키지 않음)", async () => {
    runnerMock.runBackfill.mockRejectedValueOnce(new Error("backfill 실패"));

    await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(500);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire. JwtAuthGuard / RolesGuard 의 통과/거부 분기를
// overrideGuard 로 박제. cron-schedule.controller.spec mirror.
// -----------------------------------------------------------------------
describe("BackfillController (RBAC guard integration)", () => {
  let app: INestApplication;
  let runnerMock: { runBackfill: jest.Mock };

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
    runnerMock = { runBackfill: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BackfillController],
      providers: [{ provide: BackfillRunnerService, useValue: runnerMock }],
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

  it("POST backfill — Admin role 통과 시 202 + runBackfill 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    runnerMock.runBackfill.mockResolvedValueOnce(FRESH_RESULT);

    await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(202);
    expect(runnerMock.runBackfill).toHaveBeenCalledTimes(1);
  });

  it("POST backfill — JwtAuthGuard reject 시 401 + runBackfill 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(401);
    expect(runnerMock.runBackfill).not.toHaveBeenCalled();
  });

  it("POST backfill — RolesGuard reject 시 403 + runBackfill 미호출 (negative — User actor 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(403);
    expect(runnerMock.runBackfill).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// real RolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제. JwtAuthGuard
// 는 통과 mock, RolesGuard 는 실 instance. User 403 / Admin·SuperAdmin 202.
// -----------------------------------------------------------------------
describe("BackfillController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let runnerMock: { runBackfill: jest.Mock };

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
    runnerMock = { runBackfill: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BackfillController],
      providers: [
        { provide: BackfillRunnerService, useValue: runnerMock },
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

  it("POST backfill — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post(`/api/schedules/backfill/${PERSON_ID}`)
      .expect(403);
    expect(runnerMock.runBackfill).not.toHaveBeenCalled();
  });

  it.each(["Admin", "SuperAdmin"])(
    "POST backfill — %s actor 는 Admin+ tier 통과 (202, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      runnerMock.runBackfill.mockResolvedValueOnce(FRESH_RESULT);

      await request(app.getHttpServer())
        .post(`/api/schedules/backfill/${PERSON_ID}`)
        .expect(202);
      expect(runnerMock.runBackfill).toHaveBeenCalledTimes(1);
    },
  );
});

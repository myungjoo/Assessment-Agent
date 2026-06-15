// RecentDeletionController spec — T-0428 acceptance 박제 (POST
// /api/schedules/recent-deletion/:personId, R-112: happy / error / branch / negative
// + RBAC guard wire + DTO ValidationPipe negative). backfill.controller.spec.ts(T-0421)
// 의 4 describe block 구조를 mirror 하되 본 endpoint 의 차이 반영:
//   - 요청 본문(RecentDeletionDto) 있음 — instants(ISO string[]) + 선택적 days. 따라서
//     controller-scope ValidationPipe 의 negative(정의 외 키 / 비-ISO / days 음수 →
//     400)를 HTTP integration block 에서 supertest 로 추가 cover.
//   - controller 가 dto.instants(ISO string[])를 Date 배열로 매핑해 runner 에 전달하는
//     단언(매핑 정확성) 포함.
//
// 4 describe block:
//   1. Unit-level (controller-only, mocked RecentDeletionRunnerService) — routing /
//      runRecentDeletion 호출 인자(personId / Date 매핑 instants / undefined reference /
//      days) / days 미지정·명시·빈 instants 분기 / 예외 propagation.
//   2. HTTP integration (createNestApplication + supertest) — 202 + body wire + 위임 +
//      ValidationPipe negative(forbidNonWhitelisted / 비-ISO / days 음수 400) + service
//      4xx/5xx propagate.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 통과/거부 분기 overrideGuard.
//   4. real RolesGuard escalation — 실 escalation 매핑(User 403 / Admin·SuperAdmin 202).
//
// RecentDeletionRunnerService 는 jest.fn() mock 으로 주입하므로 실 삭제·실 재수집·실
// buildRecentDeletionPlan 이 동작하지 않는다(runner 자체가 mock).
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
  RecentDeletionRunnerService,
  type RecentDeletionRunResult,
} from "./recent-deletion-runner.service";
import { RecentDeletionController } from "./recent-deletion.controller";

const PERSON_ID = "person-1";
const ISO_A = "2026-06-16T00:00:00.000Z";
const ISO_B = "2026-06-15T12:30:00.000Z";

// 삭제 실행 결과 — toDelete 가 있어 실 삭제·재수집 1회(deletedCount>0, recollected:true).
const RUN_RESULT: RecentDeletionRunResult = {
  personId: PERSON_ID,
  deletedCount: 3,
  recollected: true,
};

// no-op 결과 — toDelete 가 비어 삭제/재수집 없음(deletedCount:0, recollected:false).
const NOOP_RESULT: RecentDeletionRunResult = {
  personId: PERSON_ID,
  deletedCount: 0,
  recollected: false,
};

// RecentDeletionRunnerService mock factory — runRecentDeletion jest.fn() 1개.
function buildRunnerMock(): {
  runner: RecentDeletionRunnerService;
  runnerMock: { runRecentDeletion: jest.Mock };
} {
  const runnerMock = {
    runRecentDeletion: jest.fn(),
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

  // -----------------------------------------------------------------------
  // happy — instants(ISO) Date 매핑 + days 전달 + 결과 pass-through
  // -----------------------------------------------------------------------
  it("POST recent-deletion — instants 를 Date 로 매핑해 runRecentDeletion 을 1회 (personId, Date[], undefined, days) 인자로 호출하고 결과를 반환 (happy)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runRecentDeletion.mockResolvedValueOnce(RUN_RESULT);

    const controller = new RecentDeletionController(runner);
    const result = await controller.recentDeletion(PERSON_ID, {
      instants: [ISO_A, ISO_B],
      days: 7,
    });

    expect(runnerMock.runRecentDeletion).toHaveBeenCalledTimes(1);
    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      PERSON_ID,
      [new Date(ISO_A), new Date(ISO_B)],
      undefined,
      7,
    );
    // 매핑된 instants 가 실 Date instance 인지 확인.
    const passedInstants = runnerMock.runRecentDeletion.mock.calls[0][1];
    expect(passedInstants[0]).toBeInstanceOf(Date);
    expect(passedInstants[0].toISOString()).toBe(ISO_A);
    expect(result).toEqual(RUN_RESULT);
  });

  // -----------------------------------------------------------------------
  // branch — days 미지정(undefined 전달)
  // -----------------------------------------------------------------------
  it("POST recent-deletion — days 미지정 시 undefined 를 days 인자로 전달 (branch — days 미지정)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runRecentDeletion.mockResolvedValueOnce(RUN_RESULT);

    const controller = new RecentDeletionController(runner);
    await controller.recentDeletion(PERSON_ID, { instants: [ISO_A] });

    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      PERSON_ID,
      [new Date(ISO_A)],
      undefined,
      undefined,
    );
  });

  // -----------------------------------------------------------------------
  // branch — 빈 instants(no-op 결과 pass-through)
  // -----------------------------------------------------------------------
  it("POST recent-deletion — 빈 instants 시 빈 Date 배열 전달 + no-op 결과 그대로 반환 (branch — no-op)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runRecentDeletion.mockResolvedValueOnce(NOOP_RESULT);

    const controller = new RecentDeletionController(runner);
    const result = await controller.recentDeletion(PERSON_ID, {
      instants: [],
    });

    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      PERSON_ID,
      [],
      undefined,
      undefined,
    );
    expect(result).toEqual(NOOP_RESULT);
  });

  // -----------------------------------------------------------------------
  // negative — personId pass-through (controller 검증 책임 0)
  // -----------------------------------------------------------------------
  it("POST recent-deletion — 빈/비정상 personId 도 검증 없이 runRecentDeletion 로 그대로 전달 (negative — controller 검증 책임 0)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runRecentDeletion.mockResolvedValueOnce({
      ...NOOP_RESULT,
      personId: "",
    });

    const controller = new RecentDeletionController(runner);
    await controller.recentDeletion("", { instants: [ISO_A] });

    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      "",
      [new Date(ISO_A)],
      undefined,
      undefined,
    );
  });

  // -----------------------------------------------------------------------
  // error — service-throw propagation (삼키지 않음)
  // -----------------------------------------------------------------------
  it("POST recent-deletion — runRecentDeletion 의 BadRequestException 을 삼키지 않고 그대로 propagate (error / negative)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    runnerMock.runRecentDeletion.mockRejectedValueOnce(
      new BadRequestException("잘못된 days"),
    );

    const controller = new RecentDeletionController(runner);
    await expect(
      controller.recentDeletion(PERSON_ID, { instants: [ISO_A] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("POST recent-deletion — runRecentDeletion 의 일반 reject(삭제/재수집 실패)도 그대로 propagate (negative — unknown error)", async () => {
    const { runner, runnerMock } = buildRunnerMock();
    const rawError = new Error("triggerCollection 재수집 실패");
    runnerMock.runRecentDeletion.mockRejectedValueOnce(rawError);

    const controller = new RecentDeletionController(runner);
    await expect(
      controller.recentDeletion(PERSON_ID, { instants: [ISO_A] }),
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
  let runnerMock: { runRecentDeletion: jest.Mock };

  beforeEach(async () => {
    runnerMock = { runRecentDeletion: jest.fn() };

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
    runnerMock.runRecentDeletion.mockResolvedValueOnce(RUN_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A, ISO_B], days: 7 })
      .expect(202);

    expect(res.body).toEqual(RUN_RESULT);
    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      PERSON_ID,
      [new Date(ISO_A), new Date(ISO_B)],
      undefined,
      7,
    );
  });

  it("POST recent-deletion — 빈 instants(no-op) 시 202 + no-op body wire (branch)", async () => {
    runnerMock.runRecentDeletion.mockResolvedValueOnce(NOOP_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [] })
      .expect(202);

    expect(res.body.recollected).toBe(false);
    expect(res.body.deletedCount).toBe(0);
  });

  it("POST recent-deletion — path param :personId 가 그대로 runRecentDeletion 인자로 전달 (path param wire)", async () => {
    runnerMock.runRecentDeletion.mockResolvedValueOnce({
      ...RUN_RESULT,
      personId: "other-99",
    });

    await request(app.getHttpServer())
      .post("/api/schedules/recent-deletion/other-99")
      .send({ instants: [ISO_A] })
      .expect(202);

    expect(runnerMock.runRecentDeletion).toHaveBeenCalledWith(
      "other-99",
      [new Date(ISO_A)],
      undefined,
      undefined,
    );
  });

  // -- ValidationPipe negative — DTO 검증이 실제 HTTP 400 으로 표면화 --------
  it("POST recent-deletion — 정의 외 본문 키 포함 시 400 (forbidNonWhitelisted) + runner 미호출", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], reference: ISO_B })
      .expect(400);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — instants 누락 시 400 + runner 미호출 (negative)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ days: 7 })
      .expect(400);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — instants 원소가 비-ISO 시 400 + runner 미호출 (negative — @IsISO8601 each)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: ["not-a-date"] })
      .expect(400);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — days 음수 시 400 + runner 미호출 (negative — @IsPositive)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: -1 })
      .expect(400);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — days 비-정수 시 400 + runner 미호출 (negative — @IsInt)", async () => {
    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: 1.5 })
      .expect(400);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  // -- service-throw status mapping ----------------------------------------
  it("POST recent-deletion — runRecentDeletion NotFoundException 시 404 자동 mapping (error path)", async () => {
    runnerMock.runRecentDeletion.mockRejectedValueOnce(
      new NotFoundException("존재하지 않는 인원"),
    );

    await request(app.getHttpServer())
      .post("/api/schedules/recent-deletion/ghost")
      .send({ instants: [ISO_A] })
      .expect(404);
  });

  it("POST recent-deletion — runRecentDeletion BadRequestException 시 400 자동 mapping (error path — plan TypeError/RangeError)", async () => {
    runnerMock.runRecentDeletion.mockRejectedValueOnce(
      new BadRequestException("잘못된 days"),
    );

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A], days: 7 })
      .expect(400);
  });

  it("POST recent-deletion — runRecentDeletion 일반 reject 시 500 으로 표면화 (negative — 삼키지 않음)", async () => {
    runnerMock.runRecentDeletion.mockRejectedValueOnce(
      new Error("재수집 실패"),
    );

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
  let runnerMock: { runRecentDeletion: jest.Mock };

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
    runnerMock = { runRecentDeletion: jest.fn() };
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

  it("POST recent-deletion — Admin role 통과 시 202 + runRecentDeletion 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    runnerMock.runRecentDeletion.mockResolvedValueOnce(RUN_RESULT);

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(202);
    expect(runnerMock.runRecentDeletion).toHaveBeenCalledTimes(1);
  });

  it("POST recent-deletion — JwtAuthGuard reject 시 401 + runRecentDeletion 미호출 (negative — 인증 부재)", async () => {
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
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it("POST recent-deletion — RolesGuard reject 시 403 + runRecentDeletion 미호출 (negative — User actor 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
      .send({ instants: [ISO_A] })
      .expect(403);
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// real RolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제. JwtAuthGuard 는
// 통과 mock, RolesGuard 는 실 instance. User 403 / Admin·SuperAdmin 202.
// -----------------------------------------------------------------------
describe("RecentDeletionController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let runnerMock: { runRecentDeletion: jest.Mock };

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
    runnerMock = { runRecentDeletion: jest.fn() };
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
    expect(runnerMock.runRecentDeletion).not.toHaveBeenCalled();
  });

  it.each(["Admin", "SuperAdmin"])(
    "POST recent-deletion — %s actor 는 Admin+ tier 통과 (202, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      runnerMock.runRecentDeletion.mockResolvedValueOnce(RUN_RESULT);

      await request(app.getHttpServer())
        .post(`/api/schedules/recent-deletion/${PERSON_ID}`)
        .send({ instants: [ISO_A] })
        .expect(202);
      expect(runnerMock.runRecentDeletion).toHaveBeenCalledTimes(1);
    },
  );
});

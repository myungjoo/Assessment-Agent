// export-job-status-read.e2e-spec.ts — export job 진행 조회(status polling) 3 route
// (`GET /running` · `GET /:id/status-view` · `GET /:id`) 의 **조회 계약 · RBAC** e2e
// (T-1980. PLAN 166 행 "E2E 시나리오 커버리지" 축 / REQ-030 · REQ-043 · REQ-045).
// 이미 머지된 route 의 계약 고정 전용 — production 0 LOC.
// 왜 e2e 인가 (mock service · guard override 로 route 1 개만 부팅하는 기존 perf-spec 이 못
// 잡는 3 개): ① route ordering — `running` · `:id/status-view` 가 `:id` 보다 먼저 선언돼야
// 하고(export.controller.ts 178~180 · 459~461 행), 뒤집히면 `GET /running` 이
// `findJob("running")` 으로 흘러 404 다. ② Date 직렬화 — `createdAt` 등은 `DateTime` 이라 실
// HTTP 왕복에서만 ISO 문자열로 관찰된다. ③ 실 DB 결합 — service 296~300 행
// `where: { status: "RUNNING" }` 과 JOB_STATUS_TO_VIEW → describeExportJobStatus 파생값의
// 실 row 정합은 실 row 가 있어야 관찰된다.
// 실 DB 전략 (ADR-0004): mock override 0. 정리 순서는 export-download.e2e-spec.ts 118~135
// 행 패턴 그대로 — `ExportJob → User` 가 `onDelete: Restrict` 라 truncate **앞** 에
// exportJob 을 비우고, truncate **뒤**에 원 id 로 actor 를 재-seed 한다(JWT sub 유지).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  reseedAuthenticatedActors,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const BASE = "/api/admin/export";

// raw job 응답의 최소 투영 — 본 spec 이 직접 읽는 field 만 선언한다.
interface RawJobBody {
  id: string;
  status: string;
}

describe("E2E: export job 진행 조회 3 route 계약 + RBAC (T-1980)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // actor 3 종 — Admin(정상 tier) / SuperAdmin(과차단 0) / User(tier 미달 403).
  let adminCookie: string;
  let superAdminCookie: string;
  let userCookie: string;
  // ExportJob.requestedById FK 대상 — Admin actor 의 원 User id.
  let adminId: string;

  const ADMIN_EMAIL = "export-poll-admin@e2e.test";
  const SUPER_EMAIL = "export-poll-superadmin@e2e.test";
  const USER_EMAIL = "export-poll-user@e2e.test";

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "SuperAdmin", email: SUPER_EMAIL },
      { role: "User", email: USER_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    superAdminCookie = buildAuthCookie(ctx.tokens[SUPER_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    adminId = ctx.users[ADMIN_EMAIL].id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Restrict FK 때문에 exportJob 을 먼저 비우고, truncate 뒤 actor 를 복원한다.
  afterEach(async () => {
    await prisma.exportJob.deleteMany();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // seedJob — ExportJob 1 행을 실 DB 에 직접 적재(생성 route 무관 — 조회 계약만 대상).
  // finishedAt 은 종단 status 에서만 채워 read-only 단언의 비교축으로 쓴다.
  async function seedJob(
    status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED",
    scope: "FULL" | "RANGE" | "PARTIAL" = "FULL",
  ): Promise<{ id: string; finishedAt: Date | null }> {
    const terminal = status === "SUCCEEDED" || status === "FAILED";
    const job = await prisma.exportJob.create({
      data: {
        status,
        scope,
        requestedById: adminId,
        startedAt: status === "PENDING" ? null : new Date(),
        finishedAt: terminal ? new Date() : null,
      },
    });
    return { id: job.id, finishedAt: job.finishedAt };
  }

  // cookie 미지정이면 헤더 자체를 붙이지 않는다(= 인증 부재 축).
  const send = (path: string, cookie?: string): request.Test => {
    const req = request(app.getHttpServer()).get(`${BASE}${path}`);
    return cookie ? req.set("Cookie", cookie) : req;
  };
  const getRunning = (cookie?: string) => send("/running", cookie);
  const getStatusView = (id: string, cookie?: string) =>
    send(`/${id}/status-view`, cookie);
  const getJob = (id: string, cookie?: string) => send(`/${id}`, cookie);

  it("3 route 모두 200 — running 배열 · status-view 파생 · raw job (happy-path)", async () => {
    const seeded = await seedJob("RUNNING", "RANGE");

    const running = await getRunning(adminCookie);
    const view = await getStatusView(seeded.id, adminCookie);
    const raw = await getJob(seeded.id, adminCookie);

    expect(running.status).toBe(200);
    expect((running.body as RawJobBody[]).map((j) => j.id)).toEqual([
      seeded.id,
    ]);

    expect(view.status).toBe(200);
    expect(view.body).toEqual({
      status: "running",
      phaseLabel: expect.any(String),
      stepIndex: 1,
      totalSteps: 3,
      nextStatus: "ready",
      terminal: false,
      downloadable: false,
      message: expect.any(String),
    });

    expect(raw.status).toBe(200);
    expect(raw.body).toMatchObject({
      id: seeded.id,
      status: "RUNNING",
      scope: "RANGE",
      requestedById: adminId,
      // DateTime 컬럼은 실 HTTP 왕복에서 ISO 문자열로 관찰된다(nullable 은 null 유지).
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      finishedAt: null,
    });
  });

  it("running 은 RUNNING 만 반환하고 다른 3 status 는 제외 (분기 · status 필터)", async () => {
    const runningJob = await seedJob("RUNNING");
    await seedJob("PENDING");
    await seedJob("SUCCEEDED");
    await seedJob("FAILED");

    const response = await getRunning(adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect((response.body as RawJobBody[])[0]).toMatchObject({
      id: runningJob.id,
      status: "RUNNING",
    });
  });

  it("RUNNING 0 건이면 404 가 아니라 200 + 빈 배열 (분기 · 빈 목록은 오류 아님)", async () => {
    // 다른 status row 는 존재 — "DB 공백" 이 아니라 "필터 미매칭" 임을 구분한다.
    await seedJob("SUCCEEDED");

    const response = await getRunning(adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("RUNNING 2 건이면 2 건 전부 반환 (분기 · 다건)", async () => {
    const seeded = [await seedJob("RUNNING"), await seedJob("RUNNING")];
    const ids = seeded.map((job) => job.id).sort();

    const response = await getRunning(adminCookie);

    expect(response.status).toBe(200);
    expect((response.body as RawJobBody[]).map((job) => job.id).sort()).toEqual(
      ids,
    );
  });

  it("SUCCEEDED job 의 status-view 는 ready · terminal · downloadable (분기 · 파생 불변식)", async () => {
    const seeded = await seedJob("SUCCEEDED");

    const response = await getStatusView(seeded.id, adminCookie);

    expect(response.status).toBe(200);
    // 불변식(export-job-status-view.ts 26~29 행)이 실 왕복에서 성립함을 확인 —
    // downloadable ⟹ ready, terminal ⟺ ready|failed, nextStatus===null ⟺ terminal.
    expect(response.body).toMatchObject({
      status: "ready",
      stepIndex: 2,
      totalSteps: 3,
      nextStatus: null,
      terminal: true,
      downloadable: true,
    });
  });

  it("running 은 :id 로 포착되지 않고 :id/status-view 는 raw job 이 아니다 (route ordering)", async () => {
    const seeded = await seedJob("RUNNING");

    const running = await getRunning(adminCookie);
    const view = await getStatusView(seeded.id, adminCookie);

    // `:id` 가 먼저 선언됐다면 findJob("running") → 404 였을 것이다.
    expect(running.status).toBe(200);
    expect(Array.isArray(running.body)).toBe(true);
    // `:id` 가 먼저 잡았다면 raw job(scope/requestedById)이 돌아왔을 것이다.
    expect(view.status).toBe(200);
    expect(view.body).toHaveProperty("stepIndex");
    expect(view.body).not.toHaveProperty("scope");
    expect(view.body).not.toHaveProperty("requestedById");
  });

  it.each([
    { label: ":id", call: getJob },
    { label: ":id/status-view", call: getStatusView },
  ])(
    "존재하지 않는 id 의 $label 은 404 이고 내부 정보를 노출하지 않는다 (error path · P2025)",
    async ({ call }) => {
      await seedJob("RUNNING");

      const response = await call("clzzz000000000000000nope", adminCookie);

      expect(response.status).toBe(404);
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toMatch(/apiKey|SELECT |prisma\.|at Object\./i);
      expect(response.body).not.toHaveProperty("scope");
    },
  );

  const authNegatives: Array<{
    label: string;
    cookie: () => string | undefined;
    expected: number;
  }> = [
    { label: "cookie 부재", cookie: () => undefined, expected: 401 },
    {
      label: "변조 JWT",
      cookie: () => buildAuthCookie("garbage.token.invalid"),
      expected: 401,
    },
    { label: "User role", cookie: () => userCookie, expected: 403 },
  ];

  const routes: Array<{
    route: string;
    call: (id: string, cookie?: string) => request.Test;
  }> = [
    { route: "running", call: (_id, cookie) => getRunning(cookie) },
    { route: ":id/status-view", call: getStatusView },
    { route: ":id", call: getJob },
  ];

  it.each(
    routes.flatMap(({ route, call }) =>
      authNegatives.map((negative) => ({ route, call, ...negative })),
    ),
  )(
    "$route 를 $label 로 호출하면 $expected 이고 job 데이터가 실리지 않는다 (negative · guard 선행)",
    async ({ call, cookie, expected }) => {
      const seeded = await seedJob("RUNNING");

      const response = await call(seeded.id, cookie());

      expect(response.status).toBe(expected);
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(seeded.id);
      expect(serialized).not.toContain(adminId);
      expect(response.body).not.toHaveProperty("stepIndex");
    },
  );

  it("SuperAdmin 은 3 route 전부 200 (negative · RolesGuard escalation 과차단 0)", async () => {
    const seeded = await seedJob("RUNNING");

    const running = await getRunning(superAdminCookie);
    const view = await getStatusView(seeded.id, superAdminCookie);
    const raw = await getJob(seeded.id, superAdminCookie);

    expect([running.status, view.status, raw.status]).toEqual([200, 200, 200]);
    expect((running.body as RawJobBody[])[0].id).toBe(seeded.id);
    expect((view.body as { status: string }).status).toBe("running");
    expect((raw.body as RawJobBody).id).toBe(seeded.id);
  });

  it("3 route 조회는 DB 를 변경하지 않는다 (read-only 계약)", async () => {
    const seeded = await seedJob("SUCCEEDED");
    const before = await prisma.exportJob.count();

    await getRunning(adminCookie);
    await getStatusView(seeded.id, adminCookie);
    await getJob(seeded.id, adminCookie);

    expect(await prisma.exportJob.count()).toBe(before);
    const after = await prisma.exportJob.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    expect(after.status).toBe("SUCCEEDED");
    expect(after.finishedAt).toEqual(seeded.finishedAt);
  });
});

// import-job-read.e2e-spec.ts — import 조회 2 route (`GET /api/admin/import/running` ·
// `GET /api/admin/import/modes`) 의 **조회 계약 · RBAC** e2e (T-1989. PLAN 166 행 "E2E 시나리오
// 커버리지" 축 / REQ-030 · REQ-043 · REQ-045). 이미 머지된 route 의 계약 고정 전용 —
// production(`src/`) 0 LOC.
// 왜 e2e 인가 (service mock + guard override 로 route 1 개만 부팅하는 기존
// test/perf/import-detail-read-realdb.perf-spec.ts 가 못 잡는 3 가지): ① route ordering —
// `running` · `modes` 가 `:id` 보다 먼저 선언돼야 하고(import.controller.ts 344~377 행),
// 뒤집히면 `GET /running` 이 `findJob("running")` 으로 흘러 404 다. ② 실 guard 결합 —
// `JwtAuthGuard + RolesGuard + @Roles("Admin")` 가 override 없이 서는지는 실 쿠키 왕복으로만
// 관찰된다. ③ 실 DB 결합 · 직렬화 — `findRunning` 의 `where: { status: "RUNNING" }` 필터와
// `createdAt`(DateTime) 의 ISO 문자열화는 실 row + 실 HTTP 왕복에서만 드러난다.
// 실 DB 전략 (ADR-0004): mock override 0 · guard override 0. 정리 순서는
// export-job-status-read.e2e-spec.ts 패턴 그대로 — `ImportJob → User` 가 `onDelete: Restrict`
// 라 truncate **앞** 에 importJob 을 비우고 **뒤**에 원 id 로 actor 를 재-seed 한다(JWT sub 유지).
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

const BASE = "/api/admin/import";

// 응답의 최소 투영 — 본 spec 이 직접 읽는 field 만 선언한다.
interface RawImportJobBody {
  id: string;
  status: string;
  createdAt: string;
}
interface ModeDescriptionBody {
  destructive: boolean;
  mergeStrategy: string | null;
  reason: string;
}

type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

// 401/403 body 에 job row 가 새지 않았음을 판정하는 sentinel — 실 row 의 artifactRef 에 심는다.
const ARTIFACT_SENTINEL = "s3://import-e2e/never-leak.dump";

describe("E2E: import 조회 2 route 계약 + RBAC (T-1989)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // actor 3 종 — Admin(정상 tier) / SuperAdmin(과차단 0) / User(tier 미달 403).
  let adminCookie: string;
  let superAdminCookie: string;
  let userCookie: string;
  // ImportJob.requestedById FK 대상 — Admin actor 의 원 User id.
  let adminId: string;

  const ADMIN_EMAIL = "import-read-admin@e2e.test";
  const SUPER_EMAIL = "import-read-superadmin@e2e.test";
  const USER_EMAIL = "import-read-user@e2e.test";

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

  // Restrict FK 때문에 importJob 을 먼저 비우고, truncate 뒤 actor 를 원 id 로 복원한다.
  // 순서가 어긋나면 FK 위반(`ImportJob_requestedById_fkey`) 으로 red 가 된다.
  afterEach(async () => {
    await prisma.importJob.deleteMany();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // seedJob — ImportJob 1 행을 실 DB 에 직접 적재(생성 route 무관 — 조회 계약만 대상).
  async function seedJob(status: JobStatus): Promise<{ id: string }> {
    const terminal = status === "SUCCEEDED" || status === "FAILED";
    const job = await prisma.importJob.create({
      data: {
        status,
        requestedById: adminId,
        artifactRef: ARTIFACT_SENTINEL,
        startedAt: status === "PENDING" ? null : new Date(),
        finishedAt: terminal ? new Date() : null,
      },
    });
    return { id: job.id };
  }

  // cookie 미지정이면 헤더 자체를 붙이지 않는다(= 인증 부재 축).
  const send = (path: string, cookie?: string): request.Test => {
    const req = request(app.getHttpServer()).get(`${BASE}${path}`);
    return cookie ? req.set("Cookie", cookie) : req;
  };
  const getRunning = (cookie?: string) => send("/running", cookie);
  const getModes = (cookie?: string) => send("/modes", cookie);

  it("Admin · SuperAdmin 모두 2 route 200 — running 배열 · modes 2 원소 · ISO 직렬화 (happy-path)", async () => {
    const seeded = await seedJob("RUNNING");

    const running = await getRunning(adminCookie);
    const modes = await getModes(adminCookie);
    // 상위 tier 과차단 0 — 같은 요청을 SuperAdmin 쿠키로도 한 번씩.
    const superRunning = await getRunning(superAdminCookie);
    const superModes = await getModes(superAdminCookie);

    expect([running.status, modes.status]).toEqual([200, 200]);
    expect([superRunning.status, superModes.status]).toEqual([200, 200]);

    const [job] = running.body as RawImportJobBody[];
    expect(job).toMatchObject({ id: seeded.id, status: "RUNNING" });
    expect((superRunning.body as RawImportJobBody[])[0].id).toBe(seeded.id);
    // DateTime 컬럼은 실 HTTP 왕복에서만 ISO 문자열로 관찰된다(Date 객체 아님).
    expect(typeof job.createdAt).toBe("string");
    expect(job.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    // REPLACE 축은 파괴적(mergeStrategy 없음) / MERGE 축은 보존적(정책 문자열 있음).
    const body = modes.body as ModeDescriptionBody[];
    expect(body).toHaveLength(2);
    expect(superModes.body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      destructive: true,
      mergeStrategy: null,
      reason: "replace",
    });
    expect(body[1]).toMatchObject({ destructive: false, reason: "merge" });
    expect(typeof body[1].mergeStrategy).toBe("string");
  });

  // findRunning 의 실 DB 분기 3 종 — seed 구성만 바꿔 같은 단언 축으로 본다.
  const BRANCHES: Array<{ case: string; seed: JobStatus[] }> = [
    { case: "(a) ImportJob 0 건 → 200 + 빈 배열(404 변환 0)", seed: [] },
    { case: "(b) RUNNING 1 건 → 그 1 건만", seed: ["RUNNING"] },
    {
      case: "(c) RUNNING + PENDING · SUCCEEDED · FAILED 혼재 → RUNNING 만",
      seed: ["RUNNING", "PENDING", "SUCCEEDED", "FAILED"],
    },
  ];

  it.each(BRANCHES)("findRunning 실 DB 분기 $case", async ({ seed }) => {
    const runningIds: string[] = [];
    for (const status of seed) {
      const job = await seedJob(status);
      if (status === "RUNNING") runningIds.push(job.id);
    }

    const response = await getRunning(adminCookie);

    expect(response.status).toBe(200);
    expect((response.body as RawImportJobBody[]).map((j) => j.id)).toEqual(
      runningIds,
    );
    // "DB 공백" 과 "필터 미매칭" 을 구분한다 — 전체 row 수는 seed 그대로.
    expect(await prisma.importJob.count()).toBe(seed.length);
  });

  it("running · modes 는 :id 로 포착되지 않는다 — 404 아님 (error path · route ordering)", async () => {
    await seedJob("RUNNING");

    const running = await getRunning(adminCookie);
    const modes = await getModes(adminCookie);

    // `:id` 가 먼저 선언됐다면 findJob("running") / findJob("modes") → 404 였을 것이다.
    expect([running.status, modes.status]).toEqual([200, 200]);
    expect(Array.isArray(running.body)).toBe(true);
    // raw job 이 아니라 mode 설명이 돌아왔음을 형태로 고정한다.
    expect(modes.body).not.toHaveProperty("requestedById");
    expect((modes.body as ModeDescriptionBody[])[0]).toHaveProperty(
      "destructive",
    );
  });

  // RBAC 예외 분기 3 종 × route 2 종 = 6 케이스. 각 분기가 guard 선행(핸들러 미도달)임을
  // job 데이터 부재로 함께 고정한다.
  const authNegatives: Array<{
    label: string;
    cookie: () => string | undefined;
    expected: number;
  }> = [
    { label: "쿠키 부재", cookie: () => undefined, expected: 401 },
    {
      label: "변조 JWT 쿠키",
      cookie: () => buildAuthCookie("garbage.token.invalid"),
      expected: 401,
    },
    { label: "User role", cookie: () => userCookie, expected: 403 },
  ];

  const routes: Array<{ route: string; call: (c?: string) => request.Test }> = [
    { route: "running", call: getRunning },
    { route: "modes", call: getModes },
  ];

  it.each(
    routes.flatMap(({ route, call }) =>
      authNegatives.map((negative) => ({ route, call, ...negative })),
    ),
  )(
    "$route 를 $label 로 호출하면 $expected 이고 job 데이터가 실리지 않는다 (negative · guard 선행)",
    async ({ call, cookie, expected }) => {
      const seeded = await seedJob("RUNNING");

      const response = await call(cookie());

      expect(response.status).toBe(expected);
      // ImportJob 필드(artifactRef · id · FK) 가 어느 것도 새지 않는다.
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(ARTIFACT_SENTINEL);
      expect(serialized).not.toContain(seeded.id);
      expect(serialized).not.toContain(adminId);
      expect(response.body).not.toHaveProperty("destructive");
    },
  );

  it("2 route 조회는 DB 를 변경하지 않는다 (read-only 계약)", async () => {
    const seeded = await seedJob("RUNNING");

    await getRunning(adminCookie);
    await getModes(adminCookie);

    expect(await prisma.importJob.count()).toBe(1);
    const after = await prisma.importJob.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    expect(after.status).toBe("RUNNING");
    expect(after.artifactRef).toBe(ARTIFACT_SENTINEL);
  });
});

// schedules-recent-deletion.e2e-spec.ts — POST /api/schedules/recent-deletion/:personId 의 HTTP 계약
// · RBAC · ValidationPipe e2e (REQ-041). 식별자 없는 인원을 seed 하므로 외부 호출이 없다.
// 실 수집 · 교체는 별도 spec 이 검증한다. 실 DB 를 쓰며 CI 의 pnpm test:e2e 에서 실행된다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { RunStatusService } from "../../src/run-status/run-status.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// days 상한 축(T-1966) — recent-deletion-window.ts 의 MAX_DAYS 와 짝. 상한 정확히(366)
// 는 통과, 초과(400)는 assertValidDays 가 RangeError → controller filter 가 400 매핑.
const MAX_DAYS = 366;
const OVER_MAX_DAYS = 400;
// filter 의 400 안내 prefix (recent-deletion-input-exception.filter.ts 의
// RECENT_DELETION_INPUT_GUIDE) — pipe 400 과 filter 400 을 body 로 구별하는 축.
const INPUT_GUIDE_PREFIX = "최근 N일 삭제 요청 입력이 올바르지 않습니다";
// 응답 body 에 절대 새면 안 되는 내부 노출 흔적(§9) — stack frame · 소스 경로.
const LEAK_MARKERS = ["at Object.", "node_modules", "src/scheduling", ".ts:"];

const recentDeletionUrl = (personId: string): string =>
  `/api/schedules/recent-deletion/${personId}`;

const STARTED = { running: true, result: null };

const anyInstant = (): string => new Date().toISOString();

describe("E2E: POST /api/schedules/recent-deletion/:personId (T-1963, REQ-041)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User(403 tier 미달) / Admin(202 · 400 · 404) / SuperAdmin(escalation).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "recent-deletion-user-actor@e2e.test" },
      { role: "Admin", email: "recent-deletion-admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "recent-deletion-super-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(
      ctx.tokens["recent-deletion-user-actor@e2e.test"],
    );
    adminCookie = buildAuthCookie(
      ctx.tokens["recent-deletion-admin-actor@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["recent-deletion-super-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function waitIdle(): Promise<void> {
    const status = app.get(RunStatusService, { strict: false });
    const deadline = Date.now() + 4_000;
    while (status.snapshot().evaluation.active) {
      if (Date.now() > deadline) {
        throw new Error("재수집 실행이 4 초 안에 끝나지 않았다");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  afterEach(async () => {
    await waitIdle();
    await truncateAll(prisma);
  });

  // 삭제/재수집 대상 Person seed — serviceIdentities 없이(빈 relation) 생성해 no-network
  // 경로를 만든다. "Person" TRUNCATE ... CASCADE 가 Assessment 까지 함께 비운다.
  async function seedPerson(): Promise<{ id: string }> {
    return prisma.person.create({
      data: {
        fullName: "최근삭제대상",
        email: `recent-deletion-${Date.now()}-${Math.random()}@example.test`,
      },
    });
  }

  it("Admin 요청은 202 와 시작 상태를 돌려주고 row 를 만들지 않는다", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [anyInstant()], days: 7 });

    expect(response.status).toBe(202);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ personId: person.id, ...STARTED });
    await waitIdle();
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 404 (Person 부재) error --

  it("존재하지 않는 personId 는 404 + envelope + Assessment 미생성 (error)", async () => {
    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl("nonexistent-person-id"))
      .set("Cookie", adminCookie)
      .send({ instants: [anyInstant()] });

    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe("Not Found");
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 401 (인증 부재) error / negative --

  it("cookie 부재 시 401 + Assessment 미생성 (error — JwtAuthGuard, 재수집 미발화)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .send({ instants: [anyInstant()] });

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 분기: controller-scope ValidationPipe 거부 5 종(각 400) --
  // 같은 400 이라도 layer 가 다르다 — 아래 table 은 **ValidationPipe**(DTO decorator) 가
  // 거부하는 400 이고, 그 뒤의 days 상한 케이스는 pipe 를 통과한 뒤 controller 의
  // @UseFilters(RecentDeletionInputExceptionFilter) 가 매핑하는 400 이다(T-1965/T-1966).

  const invalidPayloads: ReadonlyArray<[string, Record<string, unknown>]> = [
    [
      "instants 원소가 비-ISO 문자열(@IsISO8601 each)",
      {
        instants: ["not-an-iso-datetime"],
      },
    ],
    [
      "instants 가 배열 아님(@IsArray)",
      {
        instants: "2026-09-08T00:00:00.000Z",
      },
    ],
    ["days 가 0(@IsPositive)", { instants: [], days: 0 }],
    ["days 가 음수(@IsPositive)", { instants: [], days: -3 }],
    [
      "정의되지 않은 키 포함(forbidNonWhitelisted)",
      {
        instants: [],
        reference: "2026-09-08T00:00:00.000Z",
      },
    ],
  ];

  it.each(invalidPayloads)(
    "%s 요청 시 400 + Assessment 미생성 (branch — controller-scope ValidationPipe 거부)",
    async (_label, payload) => {
      const person = await seedPerson();

      const response = await request(app.getHttpServer())
        .post(recentDeletionUrl(person.id))
        .set("Cookie", adminCookie)
        .send(payload);

      expect(response.status).toBe(400);
      expect(await prisma.assessment.count()).toBe(0);
    },
  );

  // -- 분기: controller filter 의 days 상한 400 매핑(T-1966, T-1965 Follow-up (a)) --
  // pipe 를 통과한 뒤 assertValidDays 의 RangeError 가 500 이 아니라 400 으로 나가는
  // 실 HTTP 왕복을 고정한다 — @UseFilters 배선이 풀리면 여기서 500 으로 red 가 된다.

  it(`days: ${OVER_MAX_DAYS}(상한 ${MAX_DAYS} 초과) 요청 시 500 이 아니라 400 + 안내 prefix·상한 원문 결합 message + Assessment 미생성 (branch — controller filter 매핑, pipe 400 과 다른 body)`, async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [anyInstant()], days: OVER_MAX_DAYS });

    // 500 이 아님을 status 로 직접 단언 — 입력 결함이 서버 장애로 보고되지 않는다.
    expect(response.status).not.toBe(500);
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    // filter 400 만의 식별 축: 안내 prefix + assertValidDays 상한 원문(366)이 함께.
    expect(response.body.message).toContain(INPUT_GUIDE_PREFIX);
    expect(response.body.message).toContain(String(MAX_DAYS));
    expect(response.body.message).toContain(String(OVER_MAX_DAYS));
    // 재수집 미발화 — window 산출 단계에서 끊겨 adapter/trigger 에 도달하지 않는다.
    expect(await prisma.assessment.count()).toBe(0);
    // negative ③ — stack trace · 내부 소스 경로 미노출.
    const serialized = JSON.stringify(response.body);
    LEAK_MARKERS.forEach((marker) => expect(serialized).not.toContain(marker));
  });

  it(`days: ${MAX_DAYS}(상한 정확히) 시 202 (negative — filter 가 정상 요청을 400 으로 downgrade 하지 않는 경계 통과)`, async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [anyInstant()], days: MAX_DAYS });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ personId: person.id, ...STARTED });
  });

  it(`User role 쿠키 + days: ${OVER_MAX_DAYS} 시 400 이 아니라 403 + Assessment 미생성 (negative — RolesGuard 가 filter 보다 먼저, 입력 결함이 tier 미달을 가리지 않음)`, async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", userCookie)
      .send({ instants: [anyInstant()], days: OVER_MAX_DAYS });

    expect(response.status).toBe(403);
    // 403 body 는 filter 의 (1) HttpException passthrough — 안내 prefix 가 붙지 않는다.
    expect(JSON.stringify(response.body)).not.toContain(INPUT_GUIDE_PREFIX);
    expect(await prisma.assessment.count()).toBe(0);
    const serialized = JSON.stringify(response.body);
    LEAK_MARKERS.forEach((marker) => expect(serialized).not.toContain(marker));
  });

  // -- negative: RBAC tier(User 403 / SuperAdmin escalation 202) --

  it("User role 쿠키 시 403 + Assessment 미생성 (negative — Admin+ tier 미달, RolesGuard, 재수집 미발화)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", userCookie)
      .send({ instants: [anyInstant()] });

    expect(response.status).toBe(403);
    expect(await prisma.assessment.count()).toBe(0);
  });

  it("SuperAdmin role 쿠키 시 202 (negative 짝 — RolesGuard escalation 통과)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", superAdminCookie)
      .send({ instants: [anyInstant()] });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ personId: person.id, ...STARTED });
  });

  // -- GET 상태 조회 --

  it("Admin 상태 조회는 200 + 실행 중 아님 + 결과 없음이다", async () => {
    const response = await request(app.getHttpServer())
      .get(recentDeletionUrl("never-ran"))
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      personId: "never-ran",
      running: false,
      result: null,
    });
  });

  it("상태 조회는 User 403 · 무인증 401 이다_n", async () => {
    const url = recentDeletionUrl("anyone");
    const asUser = await request(app.getHttpServer())
      .get(url)
      .set("Cookie", userCookie);
    const anonymous = await request(app.getHttpServer()).get(url);

    expect([asUser.status, anonymous.status]).toEqual([403, 401]);
  });
});

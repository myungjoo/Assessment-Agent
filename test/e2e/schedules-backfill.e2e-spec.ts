// schedules-backfill.e2e-spec.ts — POST /api/schedules/backfill/:personId 의 HTTP contract
// + RBAC tier enforce + idempotency 분기 e2e (T-1958, REQ-027 "신규 인원 1년치 평가 1회").
// assessment-collection-trigger.e2e-spec.ts(T-0275) 패턴 1:1 mirror.
//
// 책임: BackfillController(202 pass-through) → BackfillRunnerService(skip 단축 회로 · 52
// window 순차 · fail-fast) → AssessmentBackfillChecker(직전 Assessment 존재 proxy) 의 실
// 배선(scheduling.module.ts)을 end-to-end 로 고정한다. 단위 분기는 각 service spec 책임.
//
// no-network 전략(ADR-0031 §3/§5 — 실 token·실 네트워크 0):
//   - 202 happy 는 **빈 serviceIdentities Person** 으로 seed → 각 window 의 triggerCollection
//     이 빈 spec 을 만들어 GithubAdapter/ConfluenceAdapter fetch 가 0 회 호출된다.
//   - skip / 401 / 403 / 404 는 adapter 도달 전(단축 회로·guard·404 throw)에 종료 → 역시 0.
//   - 따라서 mock override 를 도입하지 않는다(현행 계약 고정만).
//
// 실 DB 전략(ADR-0004): createAuthenticatedE2EApp 가 AppModule 부트스트랩 + actor seed,
// PrismaService 가 실 connection. afterEach(truncateAll) + afterAll(close + $disconnect).
// 로컬 DATABASE_URL 부재 시 CI 의 pnpm test:e2e(R-113) 에서만 실행된다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// BackfillRunResult 4 필수 key — 202 응답이 모두 노출(skip / 정상 양쪽 동일 shape).
const RESULT_FIELDS = [
  "personId",
  "totalWindows",
  "triggeredCount",
  "skipped",
] as const;

// runner 기본 window 수(DEFAULT_WEEKS = 52, 1년치).
const EXPECTED_WINDOWS = 52;

// 52 window 순차 처리(각 window 당 Person 조회 + since 도출 + Assessment 생성)는 jest
// 기본 5s 를 넘긴다. 실 DB round trip 여유를 둔 명시 timeout.
const BACKFILL_TIMEOUT_MS = 120_000;

const backfillUrl = (personId: string): string =>
  `/api/schedules/backfill/${personId}`;

describe("E2E: POST /api/schedules/backfill/:personId (T-1958, REQ-027)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User(403 tier 미달 검증) / Admin(202 · skip · 404 검증).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "backfill-user-actor@e2e.test" },
      { role: "Admin", email: "backfill-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["backfill-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(ctx.tokens["backfill-admin-actor@e2e.test"]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // 평가 대상 Person seed — serviceIdentities 없이(빈 relation) 생성해 no-network 경로를
  // 만든다. "Person" TRUNCATE ... CASCADE 가 Assessment 까지 함께 비운다(db-truncate).
  async function seedPerson(): Promise<{ id: string }> {
    return prisma.person.create({
      data: {
        fullName: "백필대상",
        email: `backfill-${Date.now()}-${Math.random()}@example.test`,
      },
    });
  }

  // -- happy 202 (Admin, 신규 인원 → 52 window 전수 실행) --

  it(
    "Admin 쿠키 + 신규 Person 시 202 + BackfillRunResult 4 key(skipped false, 52/52) + Assessment 52 건(week/aggregate) 영속 (authed happy)",
    async () => {
      const person = await seedPerson();

      const response = await request(app.getHttpServer())
        .post(backfillUrl(person.id))
        .set("Cookie", adminCookie)
        .send();

      expect(response.status).toBe(202);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      RESULT_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
      expect(response.body.personId).toBe(person.id);
      expect(response.body.skipped).toBe(false);
      expect(response.body.totalWindows).toBe(EXPECTED_WINDOWS);
      expect(response.body.triggeredCount).toBe(EXPECTED_WINDOWS);

      // 실 DB 에 주 단위 Assessment 가 52 건 생성되고 전부 week/aggregate 계약을 따른다.
      const created = await prisma.assessment.findMany({
        where: { personId: person.id },
      });
      expect(created).toHaveLength(EXPECTED_WINDOWS);
      expect(created.every((a) => a.period === "week")).toBe(true);
      expect(created.every((a) => a.scope === "aggregate")).toBe(true);
    },
    BACKFILL_TIMEOUT_MS,
  );

  // -- 분기 cover: idempotency skip(직전 Assessment 존재 → 단축 회로) --

  it("직전 Assessment 1 건 존재 시 202 + skipped true(0/0) + Assessment 건수 불변 (branch — AssessmentBackfillChecker skip)", async () => {
    const person = await seedPerson();
    // AssessmentBackfillChecker 가 true 판정하도록 직전 Assessment 를 직접 1 건 seed
    // (52 건 재실행 대신 최소 seed 로 러닝타임 절약).
    await prisma.assessment.create({
      data: {
        personId: person.id,
        period: "week",
        scope: "aggregate",
        periodStart: new Date("2026-01-05T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: 0,
        volume: 0,
        narrative: "",
      },
    });

    const response = await request(app.getHttpServer())
      .post(backfillUrl(person.id))
      .set("Cookie", adminCookie)
      .send();

    expect(response.status).toBe(202);
    RESULT_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
    expect(response.body.skipped).toBe(true);
    // skip 응답이 triggeredCount 를 부풀리지 않는다(0 이 아닌 값 금지, negative (iii)).
    expect(response.body.triggeredCount).toBe(0);
    expect(response.body.totalWindows).toBe(0);
    // 추가 생성 0 — 기존 1 건 그대로.
    expect(await prisma.assessment.count()).toBe(1);
  });

  // -- 401 (인증 부재) negative --

  it("cookie 부재 시 401 + Assessment 미생성 (negative — JwtAuthGuard)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(backfillUrl(person.id))
      .send();

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 403 (tier 미달) negative --

  it("User role 쿠키 시 403 + Assessment 미생성 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(backfillUrl(person.id))
      .set("Cookie", userCookie)
      .send();

    expect(response.status).toBe(403);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 404 (Person 부재) negative — runner fail-fast 전파 --

  it("존재하지 않는 personId 시 404 + envelope + Assessment 미생성 (negative — findByIdWithIdentities NotFoundException raw forward)", async () => {
    const response = await request(app.getHttpServer())
      .post(backfillUrl("nonexistent-person-id"))
      .set("Cookie", adminCookie)
      .send();

    expect(response.status).toBe(404);
    // 응답 body 를 삼키지 않고 그대로 전파하는지 확인.
    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe("Not Found");
    expect(await prisma.assessment.count()).toBe(0);
  });
});

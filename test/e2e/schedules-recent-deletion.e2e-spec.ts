// schedules-recent-deletion.e2e-spec.ts — POST /api/schedules/recent-deletion/:personId 의
// HTTP contract + RBAC tier enforce + ValidationPipe 거부 + no-op 단축 회로 분기 e2e
// (T-1963, REQ-041 "Admin 최근 N일 결과 manual delete → 재수집").
// schedules-backfill.e2e-spec.ts(T-1958) 패턴 1:1 mirror.
//
// 책임: RecentDeletionController(202 pass-through · controller-scope ValidationPipe ·
// Admin+ tier) → RecentDeletionRunnerService(toDelete 빈 케이스 no-op · deleter 미주입
// 삭제 0 · 재수집 fail-fast 전파) → CollectionTriggerService 의 실 배선
// (scheduling.module.ts)을 end-to-end 로 고정한다. 단위 분기(window 산술 · plan 분류)는
// 각 helper spec 책임이고 본 spec 은 HTTP 계약만 본다.
//
// no-network 전략(ADR-0031 §3/§5 — 실 token·실 네트워크 0):
//   - 202 happy 는 **빈 serviceIdentities Person** 으로 seed → 재수집의 triggerCollection
//     이 빈 spec 을 만들어 GithubAdapter/ConfluenceAdapter fetch 가 0 회 호출된다.
//   - no-op / 400 / 401 / 403 / 404 는 adapter 도달 전(단축 회로 · pipe · guard · 404
//     throw)에 종료 → 역시 0. 따라서 mock override 를 도입하지 않는다(현행 계약 고정만).
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

// RecentDeletionRunResult 3 필수 key — 202 응답이 모두 노출(no-op / 정상 양쪽 동일 shape).
const RESULT_FIELDS = ["personId", "deletedCount", "recollected"] as const;

// 재수집(triggerCollection) 이 남기는 Assessment 의 도메인 계약 — runner 의
// RECOLLECT_PERIOD / RECOLLECT_SCOPE 상수와 짝을 이룬다.
const RECOLLECT_PERIOD = "day";
const RECOLLECT_SCOPE = "aggregate";

// window 밖 instant — 기본 days=1(오늘 KST 하루) 기준으로 확실히 벗어난 30 일 전.
const OUT_OF_WINDOW_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

// window 안 instant 1 건 — 현재 시각(오늘 KST 일 안)이라 days 미지정(기본 1) 에서도,
// days: 7 명시에서도 항상 toDelete 로 분류된다.
const inWindowInstant = (): string => new Date().toISOString();

const outOfWindowInstant = (): string =>
  new Date(Date.now() - OUT_OF_WINDOW_DAYS * ONE_DAY_MS).toISOString();

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

  afterEach(async () => {
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

  // -- happy 202 (Admin, days 미지정 = 기본 1 일 window) --

  it("Admin 쿠키 + in-window instant 1 건(days 미지정) 시 202 + RecentDeletionRunResult 3 key(deletedCount 0 · recollected true) + 재수집 Assessment 1 건 (authed happy)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [inWindowInstant()] });

    expect(response.status).toBe(202);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    RESULT_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
    expect(response.body.personId).toBe(person.id);
    // RECENT_DELETION_DELETER 미주입(scheduling.module 기본) → 실 삭제 0.
    expect(response.body.deletedCount).toBe(0);
    expect(response.body.recollected).toBe(true);

    // 삭제 후 같은 기간 재수집이 실제로 1 회 발화해 day/aggregate Assessment 를 남긴다.
    const created = await prisma.assessment.findMany({
      where: { personId: person.id },
    });
    expect(created).toHaveLength(1);
    expect(created[0].period).toBe(RECOLLECT_PERIOD);
    expect(created[0].scope).toBe(RECOLLECT_SCOPE);
  });

  // -- happy 202 (days 명시 축 — 선택 필드가 계약대로 통과) --

  it("days: 7 명시 요청도 202 + 동일 3 key shape(recollected true) (authed happy — 선택 필드 통과)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [inWindowInstant()], days: 7 });

    expect(response.status).toBe(202);
    RESULT_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
    expect(response.body.personId).toBe(person.id);
    expect(response.body.deletedCount).toBe(0);
    expect(response.body.recollected).toBe(true);
    expect(await prisma.assessment.count()).toBe(1);
  });

  // -- 404 (Person 부재) error — runner fail-fast raw forward --

  it("존재하지 않는 personId + in-window instant 시 404 + envelope + Assessment 미생성 (error — 재수집 NotFoundException 이 삼켜지지 않음)", async () => {
    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl("nonexistent-person-id"))
      .set("Cookie", adminCookie)
      .send({ instants: [inWindowInstant()] });

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
      .send({ instants: [inWindowInstant()] });

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 분기: no-op 단축 회로(runner 의 toDelete.length === 0) --

  it("instants 가 전부 window 밖(30 일 전)일 때 202 + recollected false + deletedCount 0 + Assessment 미생성 (branch — toDelete 빈 단축 회로)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [outOfWindowInstant()] });

    expect(response.status).toBe(202);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.deletedCount).toBe(0);
    expect(response.body.recollected).toBe(false);
    expect(await prisma.assessment.count()).toBe(0);
  });

  it("instants 가 빈 배열일 때 202 + recollected false + deletedCount 0 + Assessment 미생성 (branch — 빈 배열은 error 아닌 no-op)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [] });

    expect(response.status).toBe(202);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.deletedCount).toBe(0);
    expect(response.body.recollected).toBe(false);
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
      .send({ instants: [inWindowInstant()], days: OVER_MAX_DAYS });

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

  it(`days: ${MAX_DAYS}(상한 정확히) + in-window instant 시 202 + recollected true (negative — filter 가 정상 요청을 400 으로 downgrade 하지 않는 경계 통과)`, async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", adminCookie)
      .send({ instants: [inWindowInstant()], days: MAX_DAYS });

    expect(response.status).toBe(202);
    RESULT_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
    expect(response.body.personId).toBe(person.id);
    expect(response.body.deletedCount).toBe(0);
    expect(response.body.recollected).toBe(true);
    expect(await prisma.assessment.count()).toBe(1);
  });

  it(`User role 쿠키 + days: ${OVER_MAX_DAYS} 시 400 이 아니라 403 + Assessment 미생성 (negative — RolesGuard 가 filter 보다 먼저, 입력 결함이 tier 미달을 가리지 않음)`, async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", userCookie)
      .send({ instants: [inWindowInstant()], days: OVER_MAX_DAYS });

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
      .send({ instants: [inWindowInstant()] });

    expect(response.status).toBe(403);
    expect(await prisma.assessment.count()).toBe(0);
  });

  it("SuperAdmin role 쿠키 시 202 + recollected true (negative 짝 — RolesGuard escalation 통과)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(recentDeletionUrl(person.id))
      .set("Cookie", superAdminCookie)
      .send({ instants: [inWindowInstant()] });

    expect(response.status).toBe(202);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.recollected).toBe(true);
    expect(await prisma.assessment.count()).toBe(1);
  });
});

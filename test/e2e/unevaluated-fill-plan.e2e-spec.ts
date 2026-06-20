// unevaluated-fill-plan.e2e-spec.ts — POST /api/assessment-evaluation/unevaluated-fill-plan
// 의 **실 DB round-trip + RBAC negative** e2e (T-0548, PLAN.md P5 bullet 106 / R-64 /
// REQ-037 "평가 없는 부분 일괄 평가" / REQ-038). T-0547 이 배선한 controller route 는
// controller unit spec 만 있고 e2e 가 없었다 — README 113행(R-113)은 unit 외에 e2e 도
// CI 에서 수행할 것을 요구하므로, 새로 배선된 HTTP 엔드포인트의 실 round-trip(인증 +
// 실 PostgreSQL 좌표 read + 응답 shape)을 추가해 detection 사슬을 닫는다.
//
// 책임(task Acceptance Criteria 정합 — period-bridge-admin-persist.e2e-spec.ts mirror):
//   - **happy-path round-trip**: Admin 토큰 + 유효한 5축 body 로 POST → 200 +
//     `{ batches, totalGapCount, personCount }` shape. 영속 Assessment row 0 인 person
//     의 의도 좌표 전부가 미평가 gap 으로 잡혀 `totalGapCount > 0` + periodStart 가
//     offset-명시 ISO-8601 string 인지 검증.
//   - **flow / branch (gap 차집합)**: 의도 범위 중 일부 좌표에 해당하는 Assessment row 를
//     미리 seed → 그 좌표는 gap 에서 제외되고 totalGapCount 가 seed 만큼 줄어드는지 assert
//     (intended ∖ persisted 차집합 분기 cover).
//   - **negative(예외 분기마다 1+)**: 401(쿠키 부재) / 403(User tier) / 400(필수 누락·
//     wrong-type·비-ISO range) / 빈 personIds → 200 + 빈 plan(@ArrayNotEmpty 미적용 박제).
//
// 좌표 산술(load-bearing — periodStart 가 좌표 키의 한 축이라 정확한 instant 가 필수):
//   route 는 planner 의 reader.readForPersons(영속 좌표 read)만 수행하므로 mock override 0
//   (실 DB read). intended enumeration 은 `[rangeStart, rangeEnd)` 를 KST week anchor 단위로
//   순회하는데, rangeStart="2026-06-01T00:00:00+09:00"(KST 월요일) / rangeEnd=
//   "2026-06-08T00:00:00+09:00"(다음 KST 월요일)는 정확히 1 KST 주 → anchor 1개 =
//   2026-06-01 00:00 KST = 2026-05-31T15:00:00.000Z(UTC). 응답 periodStart 는 formatKstIso
//   산출 offset-명시 string "2026-06-01T00:00:00+09:00". gap 차집합 매칭은 좌표 키
//   (personId/period/scope/getTime())로 이뤄지므로, 좌표를 영속화해 gap 에서 빼려면 seed
//   Assessment 의 periodStart 가 정확히 이 UTC instant 여야 한다(아래 SEED_PERIOD_START).
//
// 실 DB 전략(ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
//   AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection.
//   afterEach(truncateAll) — "Person" CASCADE 가 Assessment 동반 truncate. afterAll(close +
//   $disconnect). 로컬 DATABASE_URL 부재 시 CI 전용(test:e2e step).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const ROUTE = "/api/assessment-evaluation/unevaluated-fill-plan";

// 단일 KST 주 범위 — rangeStart = KST 월요일 2026-06-01 00:00, rangeEnd = 다음 KST 월요일
// 2026-06-08 00:00. intended enumeration 은 이 반열림 구간에서 anchor 1개만 생성한다
// (week granularity → 좌표 personId 당 1개).
const RANGE_START = "2026-06-01T00:00:00+09:00";
const RANGE_END = "2026-06-08T00:00:00+09:00";

// 위 범위가 enumerate 하는 유일 anchor 의 영속 좌표(UTC instant). KST 2026-06-01 00:00 =
// 2026-05-31T15:00:00.000Z. seed Assessment 의 periodStart 가 정확히 이 instant 여야 좌표
// 키(getTime() 정규화)로 gap 차집합에서 제외된다.
const SEED_PERIOD_START = "2026-05-31T15:00:00.000Z";

// 응답 periodStart 의 기대 직렬화 값(formatKstIso = offset-명시 ISO-8601). 위 UTC instant
// 를 KST 로 표시 → "2026-06-01T00:00:00+09:00". raw .toISOString()("...Z") 가 아님을 검증.
const EXPECTED_RESPONSE_PERIOD_START = "2026-06-01T00:00:00+09:00";

// 유효한 5축 body(personIds 는 호출자가 채움). period/scope 는 domain helper 가 검증하는
// valid literal("week"/"commit") — DTO 는 @IsIn 미적용이나 enumeration helper 가 week 를
// 요구하므로 valid 값을 쓴다.
const validBody = (personIds: string[]) => ({
  personIds,
  period: "week",
  scope: "commit",
  rangeStart: RANGE_START,
  rangeEnd: RANGE_END,
});

describe("E2E: POST /api/assessment-evaluation/unevaluated-fill-plan — Admin detection round-trip (T-0548, R-113)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — 미평가 fill 계획 detection 진입(evaluate route 와 동형 Admin+ gate).
  const adminEmail = "fill-plan-admin@e2e.test";
  let adminCookie: string;

  // User actor — 403 negative(비-Admin tier 가 detection 진입을 트리거할 수 없음) 검증용.
  const userEmail = "fill-plan-user@e2e.test";
  let userCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: adminEmail },
      { role: "User", email: userEmail },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[adminEmail]);
    userCookie = buildAuthCookie(ctx.tokens[userEmail]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // target Person seed — detection 이 좌표를 enumerate 할 임의 personId. Assessment 의
  // FK 는 Person(User 아님)을 참조하므로, 좌표를 seed 하려면 그 personId 가 유효한 Person
  // row 여야 한다("Person" truncate 가 Assessment 를 CASCADE 동반 정리).
  async function seedTargetPerson(label: string): Promise<string> {
    const person = await prisma.person.create({
      data: {
        fullName: label,
        email: `fill-plan-target-${label}-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    return person.id;
  }

  // 단일 KST 주 anchor 좌표를 영속화 — gap 차집합에서 이 좌표를 빼기 위한 seed. periodStart
  // 가 SEED_PERIOD_START(=enumeration 산출 anchor instant)와 정확히 일치해야 매칭된다.
  async function seedAssessmentAtAnchor(personId: string): Promise<void> {
    await prisma.assessment.create({
      data: {
        personId,
        period: "week",
        scope: "commit",
        periodStart: new Date(SEED_PERIOD_START),
        difficulty: "easy",
        contributionScore: 0,
        volume: 0,
        narrative: "seed",
      },
    });
  }

  // -- happy-path round-trip (영속 0 → 의도 좌표 전부 gap) --

  it("Admin 토큰 + 유효 5축 body 시 200 + UnevaluatedFillPlanResponse shape + 영속 0 → 의도 좌표 전부 gap (round-trip)", async () => {
    const personId = await seedTargetPerson("happy");
    // 사전: 해당 person 의 Assessment 0 → 의도 좌표(week anchor 1개)가 전부 gap.
    expect(await prisma.assessment.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody([personId]));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    // 응답 shape — UnevaluatedFillPlanResponse(batches + totalGapCount + personCount).
    expect(Array.isArray(response.body.batches)).toBe(true);
    expect(typeof response.body.totalGapCount).toBe("number");
    expect(typeof response.body.personCount).toBe("number");

    // 영속 0 → 단일 week anchor × 1 person = gap 1개. personCount 1.
    expect(response.body.totalGapCount).toBe(1);
    expect(response.body.totalGapCount).toBeGreaterThan(0);
    expect(response.body.personCount).toBe(1);
    expect(response.body.batches).toHaveLength(1);

    const batch = response.body.batches[0];
    expect(batch.personId).toBe(personId);
    expect(Array.isArray(batch.periods)).toBe(true);
    expect(batch.periods).toHaveLength(1);

    const period = batch.periods[0];
    expect(period.personId).toBe(personId);
    expect(period.period).toBe("week");
    expect(period.scope).toBe("commit");
    // periodStart 는 raw .toISOString()("...Z") 가 아니라 formatKstIso 산출 offset-명시
    // ISO-8601 string. ADR-0039 §Decision4 offset-명시 경로(raw pass-through 회귀 차단).
    expect(period.periodStart).toBe(EXPECTED_RESPONSE_PERIOD_START);
    // ISO-8601 string + 명시 offset(Z 또는 ±hh:mm) 형식 검증(빈 string / Invalid 회귀 차단).
    expect(typeof period.periodStart).toBe("string");
    expect(period.periodStart).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    expect(Number.isNaN(new Date(period.periodStart).getTime())).toBe(false);
  });

  // -- flow / branch (intended ∖ persisted 차집합) --

  it("의도 범위 중 일부 좌표를 미리 seed 시 그 좌표는 gap 제외 + totalGapCount 가 seed 만큼 감소 (차집합 분기)", async () => {
    // 2 person — 단일 week anchor × 2 person = 의도 좌표 2개. 한 명의 좌표만 seed → gap 1개.
    const personSeeded = await seedTargetPerson("seeded");
    const personEmpty = await seedTargetPerson("empty");

    // personSeeded 의 anchor 좌표만 영속화 → 그 person 의 gap 은 제외(차집합).
    await seedAssessmentAtAnchor(personSeeded);
    expect(await prisma.assessment.count()).toBe(1);

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody([personSeeded, personEmpty]));

    expect(response.status).toBe(200);
    // 의도 좌표 2개 중 seed 1개 제외 → totalGapCount 2→1(seed 만큼 감소).
    expect(response.body.totalGapCount).toBe(1);
    // gap 인 person(personEmpty)만 batch 로 남는다(personSeeded 는 gap 0 → batch 제외).
    expect(response.body.batches).toHaveLength(1);
    expect(response.body.batches[0].personId).toBe(personEmpty);
    expect(response.body.batches[0].periods).toHaveLength(1);
    expect(response.body.batches[0].periods[0].personId).toBe(personEmpty);
    // seed 한 person 의 좌표는 응답 어느 batch 에도 누출되지 않는다(차집합은 intended subset).
    const seededLeak = response.body.batches.some(
      (b: { personId: string }) => b.personId === personSeeded,
    );
    expect(seededLeak).toBe(false);
  });

  // -- negative: 401 인증 부재 --

  it("cookie 부재 시 401 (negative — JwtAuthGuard)", async () => {
    const personId = await seedTargetPerson("noauth");

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send(validBody([personId]));

    expect(response.status).toBe(401);
  });

  // -- negative: 403 비-Admin tier --

  it('User tier 토큰 시 403 (negative — RolesGuard @Roles("Admin"))', async () => {
    const personId = await seedTargetPerson("usertier");

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", userCookie)
      .send(validBody([personId]));

    expect(response.status).toBe(403);
  });

  // -- negative: 400 validation ×3 (필수 누락 / wrong-type / 비-ISO range) --

  it("Admin 토큰 + 빈 body 시 400 (negative — 필수 축 누락 ValidationPipe)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body).length).toBeGreaterThan(0);
  });

  it("Admin 토큰 + personIds 가 배열 아님(wrong-type) 시 400 (negative — @IsArray)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody([]), personIds: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/personIds/);
  });

  it("Admin 토큰 + 비-ISO rangeStart 시 400 (negative — @IsISO8601)", async () => {
    const personId = await seedTargetPerson("badrange");

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody([personId]), rangeStart: "2026-13-99" });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rangeStart/);
  });

  // -- negative: 빈 personIds → 200 + 빈 plan (도메인 결정성, @ArrayNotEmpty 미적용 박제) --

  it("Admin 토큰 + 빈 personIds 시 200 + 빈 plan(batches: [] / totalGapCount 0) (도메인 빈 plan 결정성, 400 아님)", async () => {
    // T-0544 가 @ArrayNotEmpty 미적용을 박제 — 빈 personIds 는 person 축 공집합 → 빈 plan.
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody([]));

    expect(response.status).toBe(200);
    expect(response.body.batches).toEqual([]);
    expect(response.body.totalGapCount).toBe(0);
    expect(response.body.personCount).toBe(0);
  });
});

// assessment-evaluation-reset.e2e-spec.ts — POST /api/assessment-evaluation/reset 의
// **RBAC · 계약 왕복** e2e (T-1917, e2e 1/2. PLAN P5 bullet 106 / R-64 / REQ-037
// "Reset & Reeval"). T-1916 이 배선한 route 는 controller unit spec 만 있었고 e2e 가 0
// 이었다 — requirements.md 56 행의 REQ-037 검증 수단이 `e2e` 라 실 부팅 왕복이 필요하다.
//
// 책임 (task Acceptance Criteria 정합 — unevaluated-fill-plan.e2e-spec.ts mirror):
//   - happy-path: Admin 쿠키 + 유효 2 축 body → 200 + `{ personId, period,
//     deletedAssessments, deletedSummaries }` 4 필드 shape + 요청 2 축 echo. 좌표를
//     seed 하지 않으므로 삭제 건수는 둘 다 0 (삭제 대상 부재 = 오류 아님).
//   - 멱등: 같은 body 2 연속 호출 모두 200 + 0/0.
//   - error path: 허용 외 period literal → service `assertValidPeriod` 의 plain Error
//     가 controller 자체 매핑 없이 전파돼 500 (400 이 **아님** = DTO 가 literal 을
//     검증하지 않는다는 책임 경계 박제).
//   - negative (예외 분기마다 1+): 401(쿠키 부재) / 403(User tier) / 400 ×4 (빈 body ·
//     period 누락 · 정의 외 필드 forbidNonWhitelisted · personId wrong-type).
//   - 분기 분리: 인증 실패 · 인가 실패 · 검증 실패 · 성공 분기를 각각 별도 `it` 으로.
//
// coverage 게이트 (task AC): e2e 는 unit coverage 집계 대상이 아니고 본 slice 의 신규
// production symbol 이 0 이라 line/function ≥ 80% 게이트는 기존 unit spec 으로 유지된다.
//
// 실 DB 전략 (ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
// AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection.
// afterEach(truncateAll) → reseedAuthenticatedActors (actor User 재-seed 회귀 차단).
// afterAll(close + $disconnect). 로컬 DATABASE_URL 부재 시 CI 전용(test:e2e step).
//
// 2/2 책임 (T-1918 — 위 1/2 계약 위에 증축. "실 삭제 왕복은 2/2" 였던 Out of Scope 를
// 본 slice 가 닫는다):
//   - 실 삭제 왕복: Person 1 건 + Assessment · Summary 를 지정 좌표에 seed 한 뒤 reset →
//     응답 건수뿐 아니라 **잔존 row 실 조회** 로 삭제가 실제로 일어남을 단언.
//   - 좌표 격리: 같은 Person 의 다른 period(month) row 와 다른 Person 의 같은 좌표 row 가
//     보존됨 — `deleteMany({ where: { personId, period } })` 의 2 축 한정 계약.
//   - scope 무관 전삭제: where 에 scope 가 없어 같은 period 의 서로 다른 scope Assessment
//     가 한 번에 모두 지워짐 (새 `it` 7 개 cap 이라 별도 case 대신 happy-path 안에서 직접
//     단언 — task AC 의 cap 조항 적용).
//   - 오삭제 방지 negative: 허용 외 period(500) · User tier(403) 어느 쪽도 seed row 를 한
//     건도 지우지 않는다 (검증 · 인가 실패가 부분 삭제를 남기지 않음).
// Out of Scope (2/2 에서도 유지): Contribution cascade 실 조회 — 별도 slice.
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

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const ROUTE = "/api/assessment-evaluation/reset";

// 삭제 대상 좌표 — Person row 를 seed 하지 않는다. `deleteMany({ where: { personId,
// period } })` 는 미존재 personId 에도 FK 오류 없이 count 0 을 반환하므로, 본 slice 의
// 계약 왕복에는 좌표 seed 가 불필요하다(실 삭제 왕복은 2/2).
const TARGET_PERSON_ID = "t1917-reset-target-person";
const VALID_PERIOD = "week";

const validBody = () => ({
  personId: TARGET_PERSON_ID,
  period: VALID_PERIOD,
});

// 실 삭제 왕복(T-1918)용 좌표 축. Assessment 는 `@@unique([personId, period, scope,
// periodStart])`, Summary 는 `@@unique([personId, period, periodStart])` 이므로 같은
// Person 안에서 week / month 두 period 를 쓰면 P2002 없이 "좌표 밖 보존" 을 검증할 수
// 있다. month 는 src/user/assessment.service.ts 40 행 VALID_PERIODS 의 두 번째 literal.
const OTHER_PERIOD = "month";
const WEEK_START = new Date("2026-01-05T00:00:00.000Z");
const MONTH_START = new Date("2026-01-01T00:00:00.000Z");

// seed 좌표 1 건의 기술 — periodStart 생략 시 WEEK_START, scope 생략 시 "commit".
type SeedCoordinate = {
  period: string;
  scope?: string;
  periodStart?: Date;
};

describe("E2E: POST /api/assessment-evaluation/reset — Admin partial-reset RBAC · 계약 왕복 (T-1917, R-113)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — reset 은 파괴적 연산이라 @Roles("Admin") gate.
  const adminEmail = "reset-admin@e2e.test";
  let adminCookie: string;

  // User actor — 403 negative(비-Admin tier 가 삭제를 트리거할 수 없음) 검증용.
  const userEmail = "reset-user@e2e.test";
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
    // truncateAll 이 "User" 를 비우면 후속 case 의 요청 principal(JWT sub)에 해당하는
    // actor User row 가 사라진다. 원본 id 그대로 재-seed 해 존재를 복원한다
    // ("e2e truncate actor FK re-seed" 선례 T-0520/T-0802/T-0803 동형).
    await reseedAuthenticatedActors(ctx);
  });

  // -- 좌표 seed helper (T-1918) --
  // Person 1 건을 만들고 그 실 id 로 Assessment · Summary 를 지정 좌표에 생성한다.
  // 반환값은 요청 body 의 personId 로 그대로 쓰는 Person id. 좌표 축(period · scope ·
  // periodStart)은 호출자가 case 마다 달리 줘서 @@unique 충돌을 피한다. Person 이 실재
  // 해야 Assessment · Summary 의 FK(personId) 가 성립한다.
  const seedPersonWithRows = async (
    label: string,
    rows: { assessments?: SeedCoordinate[]; summaries?: SeedCoordinate[] },
  ): Promise<string> => {
    const person = await prisma.person.create({
      data: {
        fullName: `리셋대상-${label}`,
        email: `t1918-${label}-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    for (const coordinate of rows.assessments ?? []) {
      await prisma.assessment.create({
        data: {
          personId: person.id,
          period: coordinate.period,
          scope: coordinate.scope ?? "commit",
          periodStart: coordinate.periodStart ?? WEEK_START,
          difficulty: "medium",
          contributionScore: "0.75",
          volume: 10,
          narrative: `${label} 기여 요약`,
        },
      });
    }
    for (const coordinate of rows.summaries ?? []) {
      await prisma.summary.create({
        data: {
          personId: person.id,
          period: coordinate.period,
          periodStart: coordinate.periodStart ?? WEEK_START,
          narrative: `${label} 구간 요약`,
          metricScore: "0.75",
        },
      });
    }
    return person.id;
  };

  // reset 요청 1 회 — 좌표 2 축만 바꿔 보내는 공용 호출부.
  const postReset = (personId: string, period: string, cookie: string) =>
    request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", cookie)
      .send({ personId, period });

  // -- 성공 분기: 부팅 왕복 + 4 필드 계약 --

  it("Admin 쿠키 + 유효 2 축 body 시 200 + 4 필드 shape + 요청 2 축 echo + 삭제 0/0 (happy-path 왕복)", async () => {
    // 사전: 좌표 seed 0 → 삭제 대상 부재.
    expect(await prisma.assessment.count()).toBe(0);
    expect(await prisma.summary.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    // 응답 shape — ResetByPeriodResponse 4 필드 정확히.
    expect(Object.keys(response.body).sort()).toEqual([
      "deletedAssessments",
      "deletedSummaries",
      "period",
      "personId",
    ]);
    // 요청 2 축이 그대로 echo — 어떤 좌표를 지웠는지 호출자가 확인 가능해야 한다.
    expect(response.body.personId).toBe(TARGET_PERSON_ID);
    expect(response.body.period).toBe(VALID_PERIOD);
    expect(typeof response.body.deletedAssessments).toBe("number");
    expect(typeof response.body.deletedSummaries).toBe("number");
    // 좌표 seed 0 → 두 위임 대상 모두 0 건 삭제.
    expect(response.body.deletedAssessments).toBe(0);
    expect(response.body.deletedSummaries).toBe(0);
  });

  // -- 성공 분기: 멱등 계약 (삭제 대상 부재를 오류로 만들지 않는다) --

  it("같은 body 로 연속 2 회 호출해도 두 번 다 200 + 0/0 (멱등 계약)", async () => {
    const first = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());
    const second = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    for (const response of [first, second]) {
      expect(response.status).toBe(200);
      expect(response.body.deletedAssessments).toBe(0);
      expect(response.body.deletedSummaries).toBe(0);
      expect(response.body.personId).toBe(TARGET_PERSON_ID);
      expect(response.body.period).toBe(VALID_PERIOD);
    }
  });

  // -- error path: 허용 외 period literal → service plain Error 전파 (500, 400 아님) --

  it('허용 외 period("quarter") 시 500 + 400 이 아님 (service assertValidPeriod plain Error 전파 · DTO 책임 경계)', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ personId: TARGET_PERSON_ID, period: "quarter" });

    // DTO 는 @IsIn 미적용이라 형식 검증을 통과 → service 의 assertValidPeriod 가 plain
    // Error 를 던지고 controller 는 자체 status 매핑 0 → NestJS 기본 500.
    expect(response.status).toBe(500);
    // 400 이 아님을 명시 — literal 검증이 DTO 가 아닌 service 책임이라는 경계 박제.
    // (400 으로 바꾸려면 새 결정이 필요하므로 본 slice 는 현 계약을 그대로 박제한다.)
    expect(response.status).not.toBe(400);
    expect(response.body.statusCode).toBe(500);
  });

  // -- 인증 실패 분기: 401 --

  it("쿠키 부재 시 401 (negative — JwtAuthGuard)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send(validBody());

    expect(response.status).toBe(401);
  });

  // -- 인가 실패 분기: 403 --

  it('User tier 쿠키 시 403 (negative — RolesGuard @Roles("Admin"))', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", userCookie)
      .send(validBody());

    expect(response.status).toBe(403);
  });

  // -- 검증 실패 분기: 400 ×4 --

  it("Admin 쿠키 + 빈 body 시 400 (negative — 필수 2 축 누락 ValidationPipe)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body)).toMatch(/personId/);
    expect(messageText(response.body)).toMatch(/period/);
  });

  it("Admin 쿠키 + period 만 누락 시 400 (negative — 부분 누락도 통과시키지 않는다)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ personId: TARGET_PERSON_ID });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/period/);
  });

  it("Admin 쿠키 + DTO 정의 외 필드 혼입 시 400 (negative — forbidNonWhitelisted 로 오타 필드 차단)", async () => {
    // reset 은 파괴적 연산이라 오타 필드(예: scope)를 조용히 무시하면 "의도보다 넓은
    // 삭제" 로 이어진다 — boundary 에서 거부하는 것이 계약.
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody(), scope: "commit" });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/scope/);
  });

  it("Admin 쿠키 + personId 가 문자열 아님(wrong-type) 시 400 (negative — @IsString)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody(), personId: 12345 });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/personId/);
  });

  // -- actor-present 회귀 (T-0803 동형) — afterEach truncate 후 재-seed 검증 --

  it("직전 case truncate 후에도 Admin actor 재존재 + reset 왕복 200 (actor-present 회귀)", async () => {
    const adminActor = await prisma.user.findFirst({
      where: { email: adminEmail },
    });
    expect(adminActor).not.toBeNull();
    expect(adminActor?.role).toBe("Admin");

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBe(0);
    expect(response.body.deletedSummaries).toBe(0);
  });

  // == T-1918 (e2e 2/2) — 실 삭제 왕복 · 좌표 격리 ==

  // -- 성공 분기: seed 된 좌표만 실제로 사라진다 (+ scope 무관 전삭제) --

  it("seed 된 week 좌표의 Assessment 2 건(scope 상이) + Summary 1 건이 실제로 삭제되고 month 좌표 row 는 보존 (happy-path 실 삭제 왕복 · scope 무관 전삭제)", async () => {
    const personId = await seedPersonWithRows("roundtrip", {
      assessments: [
        { period: VALID_PERIOD, scope: "commit" },
        { period: VALID_PERIOD, scope: "document" },
        { period: OTHER_PERIOD, scope: "commit", periodStart: MONTH_START },
      ],
      summaries: [
        { period: VALID_PERIOD },
        { period: OTHER_PERIOD, periodStart: MONTH_START },
      ],
    });

    const response = await postReset(personId, VALID_PERIOD, adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBe(2);
    expect(response.body.deletedSummaries).toBe(1);

    // 응답 숫자만이 아니라 실 DB 조회로 확인 — week 좌표가 비었다.
    expect(
      await prisma.assessment.count({
        where: { personId, period: VALID_PERIOD },
      }),
    ).toBe(0);
    expect(
      await prisma.summary.count({ where: { personId, period: VALID_PERIOD } }),
    ).toBe(0);
    // scope 무관: deleteMany where 에 scope 가 없으므로 commit · document 둘 다 사라진다.
    expect(
      await prisma.assessment.findFirst({
        where: { personId, scope: "document" },
      }),
    ).toBeNull();

    // 좌표 격리: 같은 Person 의 다른 period row 는 건드리지 않는다.
    expect(
      await prisma.assessment.count({
        where: { personId, period: OTHER_PERIOD },
      }),
    ).toBe(1);
    expect(
      await prisma.summary.count({ where: { personId, period: OTHER_PERIOD } }),
    ).toBe(1);
  });

  // -- 분기별 cover: 두 위임 중 한쪽이 0 건이어도 나머지가 정상 진행 --

  it("Assessment 만 있는 좌표 reset 시 200 + deletedAssessments >= 1 · deletedSummaries === 0 (비대칭 존재 — Summary 위임 0)", async () => {
    const personId = await seedPersonWithRows("assess-only", {
      assessments: [{ period: VALID_PERIOD, scope: "commit" }],
    });

    const response = await postReset(personId, VALID_PERIOD, adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBeGreaterThanOrEqual(1);
    expect(response.body.deletedSummaries).toBe(0);
    expect(await prisma.assessment.count({ where: { personId } })).toBe(0);
  });

  it("Summary 만 있는 좌표 reset 시 200 + deletedAssessments === 0 · deletedSummaries >= 1 (비대칭 존재 — Assessment 위임 0)", async () => {
    const personId = await seedPersonWithRows("summary-only", {
      summaries: [{ period: VALID_PERIOD }],
    });

    const response = await postReset(personId, VALID_PERIOD, adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBe(0);
    expect(response.body.deletedSummaries).toBeGreaterThanOrEqual(1);
    expect(await prisma.summary.count({ where: { personId } })).toBe(0);
  });

  // -- negative: personId 축 격리 (다른 Person 의 같은 좌표는 남는다) --

  it("대상 Person 만 reset 하면 같은 week 좌표를 가진 다른 Person 의 row 는 건수 그대로 보존 (negative — person 격리)", async () => {
    const targetId = await seedPersonWithRows("isolation-target", {
      assessments: [{ period: VALID_PERIOD, scope: "commit" }],
      summaries: [{ period: VALID_PERIOD }],
    });
    const otherId = await seedPersonWithRows("isolation-other", {
      assessments: [
        { period: VALID_PERIOD, scope: "commit" },
        { period: VALID_PERIOD, scope: "document" },
      ],
      summaries: [{ period: VALID_PERIOD }],
    });

    const response = await postReset(targetId, VALID_PERIOD, adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBe(1);
    expect(response.body.deletedSummaries).toBe(1);
    // 다른 Person 은 무손실 — where 의 personId 축이 실제로 좁힌다.
    expect(
      await prisma.assessment.count({ where: { personId: otherId } }),
    ).toBe(2);
    expect(await prisma.summary.count({ where: { personId: otherId } })).toBe(
      1,
    );
  });

  // -- negative: 검증 실패가 부분 삭제를 남기지 않는다 --

  it('seed 된 상태에서 허용 외 period("quarter") 요청 시 500 이고 seed row 가 한 건도 지워지지 않음 (negative — 오삭제 방지 회귀)', async () => {
    const personId = await seedPersonWithRows("invalid-period", {
      assessments: [{ period: VALID_PERIOD, scope: "commit" }],
      summaries: [{ period: VALID_PERIOD }],
    });

    const response = await postReset(personId, "quarter", adminCookie);

    expect(response.status).toBe(500);
    // assertValidPeriod 가 deleteMany 앞에서 던지므로 부분 삭제가 남지 않는다.
    expect(await prisma.assessment.count({ where: { personId } })).toBe(1);
    expect(await prisma.summary.count({ where: { personId } })).toBe(1);
  });

  // -- negative: 인가 실패가 삭제 전에 차단한다 --

  it("seed 된 상태에서 User tier 쿠키로 요청 시 403 이고 seed row 가 전부 보존 (negative — RBAC 가 삭제 전 차단)", async () => {
    const personId = await seedPersonWithRows("rbac-guard", {
      assessments: [{ period: VALID_PERIOD, scope: "commit" }],
      summaries: [{ period: VALID_PERIOD }],
    });

    const response = await postReset(personId, VALID_PERIOD, userCookie);

    expect(response.status).toBe(403);
    // RolesGuard 는 handler 진입 전이라 두 위임 중 어느 것도 실행되지 않는다.
    expect(await prisma.assessment.count({ where: { personId } })).toBe(1);
    expect(await prisma.summary.count({ where: { personId } })).toBe(1);
  });

  // -- 멱등: 1 회차 N 건 삭제 후 2 회차는 0/0, 그 사이 좌표 밖 row 는 불변 --

  it("seed 후 1 회차 reset 이 N 건을 지우면 2 회차는 200 + 0/0 이고 다른 좌표 row 는 추가로 줄지 않음 (멱등 재호출)", async () => {
    const personId = await seedPersonWithRows("idempotent", {
      assessments: [
        { period: VALID_PERIOD, scope: "commit" },
        { period: OTHER_PERIOD, scope: "commit", periodStart: MONTH_START },
      ],
      summaries: [
        { period: VALID_PERIOD },
        { period: OTHER_PERIOD, periodStart: MONTH_START },
      ],
    });

    const first = await postReset(personId, VALID_PERIOD, adminCookie);
    expect(first.status).toBe(200);
    expect(first.body.deletedAssessments).toBe(1);
    expect(first.body.deletedSummaries).toBe(1);

    const second = await postReset(personId, VALID_PERIOD, adminCookie);
    expect(second.status).toBe(200);
    expect(second.body.deletedAssessments).toBe(0);
    expect(second.body.deletedSummaries).toBe(0);

    // 2 회차가 좌표 밖 row 를 추가로 갉아먹지 않았다.
    expect(
      await prisma.assessment.count({
        where: { personId, period: OTHER_PERIOD },
      }),
    ).toBe(1);
    expect(
      await prisma.summary.count({ where: { personId, period: OTHER_PERIOD } }),
    ).toBe(1);
  });
});

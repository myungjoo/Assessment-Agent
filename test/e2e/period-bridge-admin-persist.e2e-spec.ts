// period-bridge-admin-persist.e2e-spec.ts — POST /api/assessment-evaluation/period 의
// **Admin full-persist round-trip + first-write-wins read-through idempotency** e2e
// (T-0323, ADR-0037 slice 5 의 Admin 부분). User ephemeral e2e(T-0318,
// period-bridge-ephemeral.e2e-spec.ts)의 lifecycle/no-network/실 DB 전략을 1:1 mirror
// 하되, **Admin 분기(임의 personId 허용 + 영속화)** 에 집중한다(User ephemeral 중복 0).
//
// 책임(ADR-0037 §Decision1 Admin full-persist + amended §Decision3 first-write-wins):
//   - **round-trip 영속 검증(가장 중요)**: Admin 토큰으로 POST /period → 실 PostgreSQL
//     (ADR-0004)에 Assessment row 가 0→1 로 증가하고, 응답 assessmentId 가 실 Assessment
//     row 와 일치함을 prisma count + findUnique read-back 으로 assert.
//   - **first-write-wins idempotency**: 같은 좌표(personId/period/scope/periodStart)로
//     2번째 Admin 호출 → 200(409 아님) + row 증가 0(여전히 1) + 동일 assessmentId 반환.
//     2번째 write 미발생을 count 불변으로 assert(amended §Decision3 read-through).
//   - **negative**(slice 4 흡수 잔여 live 케이스 + Admin-write-0 회귀 차단): 401/403/404/400.
//
// **`created` 플래그에 관한 정직한 박제(load-bearing — PR 본문/TESTER trail 명시)**:
//   service(period-bridge-admin-persist.service.ts L148-151)는 `created` 를
//   `persistResult.contributionCount > 0` 로 도출한다. 본 e2e 는 **no-network(빈
//   serviceIdentities)** 전략을 따르므로 수집·평가 결과가 빈 배열 → Contribution 0 건 →
//   **genuine 첫 create 라도 `created === false`** 로 반환된다(service 가 명시한 v1 한계:
//   "빈 결과 create 도 contributionCount 0 이라 no-op 과의 구분은 보조적, 정확한 created
//   판정이 필요한 slice 3/5 는 e2e 에서 row 증가로 검증"). 따라서 본 spec 은 **첫 create
//   의 authoritative 신호를 `prisma.assessment.count()` 0→1 로 assert**하고, `created`
//   필드는 코드의 실제 동작(빈 수집 → false)을 그대로 assert 한다. 이는 결함이 아니라
//   service 가 slice 5 e2e 에 위임한 검증 방식이다.
//
// no-network 전략(template 동일): target Person 은 **빈 serviceIdentities** 로 seed →
//   Admin generateAndPersist 의 fresh collect 가 빈 spec → fetch 0 / LLM 호출 0 → 빈
//   수집 → 빈 EvaluationResult[]. 빈 결과는 매퍼가 valid Assessment(difficulty="easy",
//   contributions 0)로 처리(throw 0) → persist 가 1 row create. negative(401/403/404/400)
//   는 generateAndPersist 도달 전(guard/self-only/404/validation) 종료 → 역시 네트워크 0.
//
// 실 DB 전략(ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
//   AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection.
//   afterEach(truncateAll) — "Person" CASCADE 가 Assessment/Contribution/Summary 동반
//   truncate. afterAll(close + $disconnect). 로컬 DATABASE_URL 부재 시 CI 전용(test:e2e step).
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

const PERIOD = "/api/assessment-evaluation/period";

// 좌표 base — idempotency 검증은 같은 (personId, period, scope, periodStart) 를 재사용한다.
// period/scope 는 DTO @IsIn 미적용이나, persist service 의 assertValidAggregate 가
// VALID_PERIODS/VALID_SCOPES literal 을 검증하므로 valid 값("week"/"commit")을 쓴다.
const validBody = (personId: string) => ({
  personId,
  period: "week",
  scope: "commit",
  periodStart: "2026-05-01T00:00:00.000Z",
});

// ADR-0039 KST boundary snap 의 canonical 좌표 — controller 의 normalizeKstPeriodStart
// 가 raw 입력 instant 를 요청 period(week) granularity 의 KST period start(KST 월요일
// 00:00)로 snap 한다. 입력 "2026-05-01T00:00:00.000Z" = KST 2026-05-01 09:00(금) →
// 그 주의 KST 월요일 = 2026-04-27 00:00 KST = "2026-04-26T15:00:00.000Z"(UTC). 영속/
// 응답 periodStart 는 raw pass-through 가 아니라 이 snap 좌표여야 한다(period-boundary.ts
// getKstPeriodRangeByPeriod 실코드로 산출 — 본 e2e 가 그 배선의 외부 round-trip 검증).
const SNAPPED_WEEK_PERIOD_START = "2026-04-26T15:00:00.000Z";

// Admin persist 가 실 row 를 0 건 만들었음을 검증 — negative case 의 회귀 차단.
// "Person" CASCADE truncate 가 셋을 모두 정리하므로 매 case 직후 0 이어야 한다.
async function expectNoPersistedRows(prisma: PrismaService): Promise<void> {
  expect(await prisma.assessment.count()).toBe(0);
  expect(await prisma.contribution.count()).toBe(0);
}

describe("E2E: POST /api/assessment-evaluation/period — Admin full-persist (T-0323, ADR-0037 §Decision1/3)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — 임의 personId 를 target 할 수 있다(self-only 미적용).
  const adminEmail = "period-admin@e2e.test";
  let adminCookie: string;

  // User actor — 403 negative(User 가 Admin persist 를 트리거할 수 없음) 검증용.
  const userEmail = "period-user@e2e.test";
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

  // target Person seed — Admin 이 평가를 요청할 임의 personId. 빈 serviceIdentities →
  // fresh collect 가 빈 spec → no-network → 빈 EvaluationResult[]. User/Person 은 별개
  // model 이라 Admin 은 이 Person.id 를 자유롭게 target(self-only 동등성 미적용).
  async function seedTargetPerson(): Promise<string> {
    const person = await prisma.person.create({
      data: {
        fullName: "평가대상",
        email: `period-target-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    return person.id;
  }

  // -- happy-path round-trip (Admin full-persist, 빈 serviceIdentities → no-network) --

  it("Admin 토큰 + 임의 personId 시 200 + PeriodBridgeAdminResponse + 실 Assessment row 0→1 (full-persist round-trip)", async () => {
    const personId = await seedTargetPerson();
    // 사전: 좌표 부재 → row 0.
    expect(await prisma.assessment.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(validBody(personId));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    // 응답 shape — PeriodBridgeAdminResponse(영속 식별자 + 좌표 + created 플래그).
    expect(typeof response.body.assessmentId).toBe("string");
    expect(response.body.assessmentId.length).toBeGreaterThan(0);
    expect(response.body.personId).toBe(personId);
    expect(response.body.period).toBe("week");
    expect(response.body.scope).toBe("commit");
    // periodStart 는 raw 입력이 아니라 KST week boundary 로 snap 된 canonical 좌표
    // (ADR-0039 §Decision3 — getKstPeriodRangeByPeriod 경유). raw pass-through 회귀 차단.
    expect(response.body.periodStart).toBe(SNAPPED_WEEK_PERIOD_START);
    // no-network(빈 serviceIdentities) → 빈 수집 → contributionCount 0 → created=false
    // (genuine 첫 create 라도; service v1 한계 — authoritative 첫-create 신호는 아래 count 0→1).
    expect(response.body.created).toBe(false);

    // **authoritative 영속 검증**: Assessment row 0→1 증가(genuine 첫 create).
    expect(await prisma.assessment.count()).toBe(1);
    // 반환 assessmentId 가 실 Assessment row 와 일치(read-back).
    const persisted = await prisma.assessment.findUnique({
      where: { id: response.body.assessmentId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.personId).toBe(personId);
    expect(persisted?.period).toBe("week");
    expect(persisted?.scope).toBe("commit");
    // 영속 좌표 periodStart 도 KST snap 된 canonical 값(응답과 동일 source).
    expect(persisted?.periodStart.toISOString()).toBe(
      SNAPPED_WEEK_PERIOD_START,
    );
    // 빈 수집 → component Contribution 0 건(빈 평가 결과).
    expect(await prisma.contribution.count()).toBe(0);
  });

  // -- R-112 reinforcement: KST snap round-trip 수렴 (regression layer) --
  //    이번 회귀(raw pass-through 가 e2e 를 통과해 버린)를 사전에 잡았을 layer:
  //    같은 KST 주의 서로 다른 요일/시각 입력 2개가 endpoint 를 통해 **동일 persist 좌표**
  //    (personId/period/scope/periodStart)로 수렴함을 실 DB round-trip 으로 실증한다.
  //    raw pass-through 라면 두 입력이 서로 다른 좌표로 갈려 두 row(count 2)가 생겨 fail.

  it("같은 KST 주 안의 서로 다른 요일/시각 입력 2개가 동일 persist 좌표로 수렴 + count 1 (KST snap round-trip 수렴, R-112)", async () => {
    const personId = await seedTargetPerson();

    // 입력 A — KST 월요일 2026-04-27 00:00(주 시작 자체). UTC 로는 2026-04-26T15:00Z.
    const inputMon = {
      ...validBody(personId),
      periodStart: "2026-04-27T00:00:00+09:00",
    };
    // 입력 B — 같은 KST 주의 금요일 2026-05-01 23:00(요일/시각 모두 다름).
    const inputFri = {
      ...validBody(personId),
      periodStart: "2026-05-01T23:00:00+09:00",
    };

    const first = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(inputMon);
    expect(first.status).toBe(200);
    // snap 좌표는 KST 주 시작(월요일 00:00 KST = 2026-04-26T15:00:00.000Z).
    expect(first.body.periodStart).toBe(SNAPPED_WEEK_PERIOD_START);
    expect(await prisma.assessment.count()).toBe(1);
    const firstId = first.body.assessmentId;

    const second = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(inputFri);
    expect(second.status).toBe(200);
    // 다른 요일/시각 입력이지만 같은 KST 주 → 동일 snap 좌표로 수렴.
    expect(second.body.periodStart).toBe(SNAPPED_WEEK_PERIOD_START);
    // **수렴의 authoritative 신호**: 두 입력이 같은 좌표 → first-write-wins read-through
    // → 동일 assessmentId + row 증가 0(여전히 1). raw pass-through 면 count 2 로 fail.
    expect(second.body.assessmentId).toBe(firstId);
    expect(await prisma.assessment.count()).toBe(1);
  });

  // -- first-write-wins read-through idempotency (§Decision3 핵심) --

  it("같은 좌표 2번째 Admin 호출 시 200 + 409 아님 + row 증가 0(여전히 1) + 동일 assessmentId (first-write-wins read-through)", async () => {
    const personId = await seedTargetPerson();
    const body = validBody(personId);

    // 1번째 호출 — genuine create.
    const first = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(body);
    expect(first.status).toBe(200);
    const firstId = first.body.assessmentId;
    expect(typeof firstId).toBe("string");
    // 1번째 호출 후 count == 1.
    expect(await prisma.assessment.count()).toBe(1);

    // 2번째 호출 — 같은 좌표 → read-through(409 아님, 2번째 write 미발생).
    const second = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.status).not.toBe(409);
    // 기존 저장본 반환 — read-through 이므로 created=false.
    expect(second.body.created).toBe(false);
    // 반환 assessmentId 가 1번째와 동일(같은 영속본 수렴).
    expect(second.body.assessmentId).toBe(firstId);
    // **2번째 write 미발생** — count 여전히 1(row 증가 0).
    expect(await prisma.assessment.count()).toBe(1);
  });

  // -- 401 인증 부재 negative (slice 4 가 요구한 live 401) --

  it("cookie 부재 시 401 + Admin persist row 0 (negative — JwtAuthGuard)", async () => {
    const personId = await seedTargetPerson();

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .send(validBody(personId));

    expect(response.status).toBe(401);
    await expectNoPersistedRows(prisma);
  });

  // -- 403 role 미달 negative (User 토큰 + 타인 personId → self-only fail-closed) --
  //    User 는 Admin persist 분기에 도달하지 못한다(User 분기 self-only → 403). Admin
  //    persist write-0 회귀 차단: User 가 임의 personId 영속화를 트리거할 수 없음.

  it("User 토큰 + 타인 personId 시 403 + Admin persist row 0 (negative — User self-only fail-closed, Admin write-0 회귀 차단)", async () => {
    const personId = await seedTargetPerson();
    // personId != userId(sub) → User 분기 self-only 차단(Admin persist 미트리거).

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", userCookie)
      .send(validBody(personId));

    expect(response.status).toBe(403);
    await expectNoPersistedRows(prisma);
  });

  // -- 404 Person 부재 negative (Admin 토큰 + 미존재 personId → PersonService 404 전파) --

  it("Admin 토큰 + 미존재 personId 시 404 + DB row 0 (negative — findByIdWithIdentities NotFoundException 전파)", async () => {
    // Person 을 seed 하지 않음 → Admin 분기는 self-only 우회 후 바로 resolve → 404.
    const missingPersonId = "nonexistent-person-id-cuid";

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send(validBody(missingPersonId));

    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe("Not Found");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    await expectNoPersistedRows(prisma);
  });

  // -- 400 validation negative ×2 (Admin 토큰) --

  it("Admin 토큰 + 빈 body 시 400 + envelope + DB row 0 (negative — 필수 필드 누락)", async () => {
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    await expectNoPersistedRows(prisma);
  });

  it("Admin 토큰 + 정의 외 raw 필드 포함 시 400 + whitelist reject + DB row 0 (negative — forbidNonWhitelisted)", async () => {
    const personId = await seedTargetPerson();

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", adminCookie)
      .send({ ...validBody(personId), rawBody: "정의 외 필드" });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rawBody/);
    await expectNoPersistedRows(prisma);
  });
});

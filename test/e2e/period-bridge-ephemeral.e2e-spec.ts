// period-bridge-ephemeral.e2e-spec.ts — POST /api/assessment-evaluation/period 의
// User self-only ephemeral round-trip + DB-write-0 e2e (T-0318, ADR-0037 slice 5
// ephemeral 부분). assessment-collection-trigger.e2e-spec.ts(T-0275) RBAC + contract +
// DB-row-assertion 패턴 1:1 mirror.
//
// 책임:
//   - 머지된 endpoint(T-0317, ADR-0037 §Decision1 User self-only ephemeral + §Decision4
//     fresh in-memory collect)를 실 guard stack(JwtAuthGuard→RolesGuard) + ValidationPipe
//     + self-only fail-closed(403) + PersonService 404 전파 위에서 end-to-end round-trip
//     검증한다. controller/service unit(T-0317)은 위임 단위만 cover 했다.
//   - **가장 중요: DB-write-0** — ephemeral 호출이 Assessment/Contribution/Summary row 를
//     0 건 생성함을 prisma count 로 assert(§Decision1 ephemeral write-0 의 회귀 차단).
//     README R-9 의 User 경로가 보안 모델(User read-only)을 위반하지 않음을 spec 으로 닫는다.
//
// 핵심 wiring nuance(task Required Reading 박제):
//   - JWT `sub` = User.id(auth-e2e-helper issueAccessTokenFor). controller 의 self-only
//     검사는 `sub` 와 `dto.personId` 동등성을 본다. 그런데 PersonService.
//     findByIdWithIdentities 는 별개 model 인 Person 테이블을 query 한다(User 와 Person 은
//     FK 연결 없는 distinct model, 각자 cuid id). 따라서 self-only happy-path 는
//     **Person.id 를 seed User.id 와 동일하게 명시 생성**해야 한다(아래 seedSelfPerson).
//
// no-network 전략(template 동일): happy-path Person 은 **빈 serviceIdentities** 로 seed →
//   generateEphemeral 의 fresh collect 가 빈 spec → fetch 0 / LLM 호출 0 → 빈 수집 → 빈
//   EvaluationResult[]. negative(403/401/404/400)는 generateEphemeral 도달 전(guard/
//   self-only/404/validation)에 종료 → 역시 실 네트워크 0.
//
// 실 DB 전략(ADR-0004 — template 동일): mock override 없음, createAuthenticatedE2EApp 가
//   AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection.
//   afterEach(truncateAll) — "Person" CASCADE 가 Assessment/Summary/Contribution 동반
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

// 정상 형식 body 의 base — negative 케이스가 personId 만 바꿔 재사용한다. period/scope 는
// DTO 가 @IsIn 미적용이라 형식(비어있지 않은 string)만 통과시키면 된다.
const validBody = (personId: string) => ({
  personId,
  period: "week",
  scope: "commit",
  periodStart: "2026-05-01T00:00:00.000Z",
});

// ephemeral 호출이 어떤 영속 row 도 만들지 않았음을 검증 — 본 spec 의 핵심 assertion.
// "Person" CASCADE truncate 가 셋을 모두 정리하므로 매 case 직후 0 이어야 한다.
async function expectNoPersistedRows(prisma: PrismaService): Promise<void> {
  expect(await prisma.assessment.count()).toBe(0);
  expect(await prisma.contribution.count()).toBe(0);
  expect(await prisma.summary.count()).toBe(0);
}

describe("E2E: POST /api/assessment-evaluation/period (T-0318, ADR-0037 §Decision1/4 ephemeral)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // self-only happy + 404 의 주체. JWT sub = 이 User.id.
  const selfEmail = "period-self-user@e2e.test";
  let selfCookie: string;
  let selfUserId: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([{ role: "User", email: selfEmail }]);
    app = ctx.app;
    prisma = ctx.prisma;
    selfCookie = buildAuthCookie(ctx.tokens[selfEmail]);
    selfUserId = ctx.users[selfEmail].id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // self-only happy-path 전제 seed — Person.id 를 인증 User.id 와 **동일하게 명시 생성**
  // (User/Person 은 별개 model·FK 없음). 빈 serviceIdentities → fresh collect 가 빈 spec →
  // no-network. selfUserId 가 dto.personId(== sub)와 일치해 self-only 통과.
  async function seedSelfPerson(): Promise<void> {
    await prisma.person.create({
      data: {
        id: selfUserId,
        fullName: "본인평가대상",
        email: `period-self-${Date.now()}-${Math.random()}@example.test`,
      },
    });
  }

  // -- happy-path round-trip (User self-only, 빈 serviceIdentities → no-network) --

  it("User 토큰 + dto.personId == sub + 동일 id Person seed 시 200 + EvaluationResult[] (빈 배열) (authed self-only happy)", async () => {
    await seedSelfPerson();

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send(validBody(selfUserId));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    // 빈 serviceIdentities → fresh collect 빈 수집 → 빈 EvaluationResult[].
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });

  // -- DB-write-0 (가장 중요) — happy 호출 직후 영속 row 0 --

  it("happy 호출 직후 Assessment/Contribution/Summary count 모두 0 (DB-write-0, §Decision1 ephemeral write-0)", async () => {
    await seedSelfPerson();

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send(validBody(selfUserId));

    expect(response.status).toBe(200);
    // ephemeral 경로는 persist 호출 0 — 어떤 영속 row 도 생성하지 않는다.
    await expectNoPersistedRows(prisma);
  });

  // -- 403 self-only (User 토큰 + dto.personId != sub) negative --

  it("User 토큰 + dto.personId 가 타인 Person id 시 403 + DB row 0 (negative — self-only fail-closed)", async () => {
    // 타인 Person — id 가 selfUserId 와 다르므로 self-only 검사에서 차단(person resolve 전).
    const other = await prisma.person.create({
      data: {
        fullName: "타인",
        email: `period-other-${Date.now()}-${Math.random()}@example.test`,
      },
    });

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send(validBody(other.id));

    expect(response.status).toBe(403);
    await expectNoPersistedRows(prisma);
  });

  // -- 401 인증 부재 negative ×2 --

  it("cookie 부재 시 401 + DB row 0 (negative — JwtAuthGuard)", async () => {
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .send(validBody(selfUserId));

    expect(response.status).toBe(401);
    await expectNoPersistedRows(prisma);
  });

  it("invalid JWT cookie 시 401 + DB row 0 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send(validBody(selfUserId));

    expect(response.status).toBe(401);
    await expectNoPersistedRows(prisma);
  });

  // -- 404 Person 부재 negative (self-only 통과 후 person resolve 단계) --

  it("User 토큰 + dto.personId == sub 이되 Person row 미존재 시 404 + DB row 0 (negative — findByIdWithIdentities NotFoundException 전파)", async () => {
    // Person 을 seed 하지 않음 → self-only(sub == personId) 통과 후 person resolve 가 404.
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send(validBody(selfUserId));

    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe("Not Found");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    await expectNoPersistedRows(prisma);
  });

  // -- 400 validation negative ×2 --

  it("빈 body 시 400 + envelope + DB row 0 (negative — 필수 필드 누락)", async () => {
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    await expectNoPersistedRows(prisma);
  });

  it("정의 외 raw 필드 포함 시 400 + whitelist reject + DB row 0 (negative — forbidNonWhitelisted)", async () => {
    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", selfCookie)
      .send({ ...validBody(selfUserId), rawBody: "정의 외 필드" });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rawBody/);
    await expectNoPersistedRows(prisma);
  });
});

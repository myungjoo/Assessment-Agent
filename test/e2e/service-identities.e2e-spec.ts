// service-identities.e2e-spec.ts — `GET/POST /api/persons/:personId/identities` 의
// HTTP + guard stack + ValidationPipe + 실 PostgreSQL round-trip e2e
// (ADR-0058 §Follow-ups (c) e2e chain 의 1 번째 slice, T-1753).
//
// 책임 (smoke 대 e2e 책임 경계):
//   - 본 spec 은 **실 DB · 실 guard · 실 ValidationPipe 를 통과하는 HTTP 계약** 의
//     anchor — status + body shape + 4xx envelope + DB 잔여 상태까지 검증한다.
//   - smoke 는 부트스트랩 · DI wiring 의 빠른 회귀 안전망이고, mock service 를 쓰는
//     `service-identity.controller.spec.ts` 는 위임 배선의 unit 책임이다. 두 layer 모두
//     실 DB 를 타지 않으므로 §Decision 2 의 자동 승격과 §Decision 5 의 오류 변환이
//     실제 Postgres constraint 위에서 성립하는지는 본 spec 만이 발화한다.
//
// slice 경계 (§Follow-ups (c) 절단):
//   - 본 slice 는 **GET 목록 · POST 생성 두 축만** 덮는다. `PATCH` · `DELETE` ·
//     primary 지정 3 route 의 e2e 는 **후속 slice** 소관이며, 그 slice 는 본 파일이
//     지불한 harness (인증 actor seed · truncate · re-seed · Person seed helper) 를
//     그대로 재사용한다. 5 route 를 한 commit 에 담으면 CLAUDE.md §3 의 300 LOC 상한을
//     확실히 넘기므로 미리 케이스를 추가하지 않는다.
//   - production code 변경 0 — controller · service · repository · DTO 는 T-1739 ~
//     T-1752 에서 완결됐다.
//
// 실 DB 전략 (ADR-0004 §Decision — user-instance-access.e2e 동일):
//   - mock override 없음. `createAuthenticatedE2EApp` 이 AppModule 부트스트랩 + actor
//     User seed + token 발급을 하고 PrismaService 가 실 connection 을 연다.
//   - `afterEach(truncateAll)` 가 "Person" 을 비우면 "ServiceIdentity" 는 `onDelete:
//     Cascade` 로 동반 정리된다. 다만 truncate 명단에 "User" 가 있어 **인증 actor
//     User row 까지 사라지므로** 반드시 `reseedAuthenticatedActors(ctx)` 로 원본 id 를
//     보존해 재삽입한다 (누락 시 후속 요청이 엉뚱한 404 를 낸다 — T-0520 선례).
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수를 막는다.
//   - 로컬 (DATABASE_URL 부재) 에서는 실행되지 않고 CI 의 `pnpm test:e2e` step 에서만
//     발화한다.
//
// R-113 cover:
//   - test/jest-e2e.json 의 testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 자동 picking
//     하므로 설정 파일 수정 0 으로 CI 의 e2e leg 에 편입된다.
//   - 11 test = happy 2 (GET 목록 · POST 생성) + 분기 3 (자동 승격 2 분기 · 빈 목록) +
//     error path 1 (미존재 personId 404) + negative 5 (401 · 403 · 409 · 400 두 종).
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

// endpoint path builder — `:personId` 자리에 대상 Person id 치환.
const endpointFor = (personId: string): string =>
  `/api/persons/${personId}/identities`;

// actor email — afterEach truncate + re-seed 로 격리되므로 충돌 0.
const ADMIN_EMAIL = "si-admin-actor@e2e.test";
const USER_EMAIL = "si-user-actor@e2e.test";

// ServiceIdentity 응답이 노출해야 하는 5 필드 (ADR-0058 §Decision 1 GET 행).
const IDENTITY_FIELDS = [
  "id",
  "personId",
  "service",
  "externalId",
  "isPrimary",
];

describe("E2E: GET/POST /api/persons/:personId/identities 목록·생성 계약 (T-1753)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // 조회 tier (User+) 통과용 쿠키와 편집 tier (Admin+) 통과용 쿠키.
  let adminCookie: string;
  let userCookie: string;

  // Person 1 명 seed — 각 test 의 arrange 단계에서 호출 (afterEach truncate 로 매번 소멸).
  const seedPerson = async (): Promise<string> => {
    const person = await prisma.person.create({
      data: { fullName: "식별자 대상 인원", email: "si-target@e2e.test" },
    });
    return person.id;
  };

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
  });

  // truncate 가 "User" 까지 비우므로 원본 id 그대로 actor 를 복원한다 (순서 고정).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // -- A. Happy path (R-112 #1) -------------------------------------------------

  // A.1 GET happy — seed 된 2 row 를 200 + 배열로 반환하고 각 element 가 5 필드 노출.
  it("GET — seed 된 identity 2 row 를 200 + 배열로 반환하고 5 필드를 노출 (happy)", async () => {
    const personId = await seedPerson();
    await prisma.serviceIdentity.createMany({
      data: [
        { personId, service: "github", externalId: "octo", isPrimary: true },
        { personId, service: "jira", externalId: "octo.j" },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(endpointFor(personId))
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    for (const row of response.body) {
      IDENTITY_FIELDS.forEach((f) => expect(row).toHaveProperty(f));
      expect(row.personId).toBe(personId);
    }
  });

  // A.2 POST happy — 201 + 생성 row 응답, DB 직접 조회로 실 영속 확인.
  it("POST — Admin 생성 시 201 + 생성 row 응답 + DB 실 영속 (happy)", async () => {
    const personId = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      personId,
      service: "github",
      externalId: "octo",
    });

    const row = await prisma.serviceIdentity.findFirst({
      where: { personId, service: "github" },
    });
    expect(row).not.toBeNull();
    expect(row?.externalId).toBe("octo");
  });

  // -- B. 분기 (R-112 #3) --------------------------------------------------------

  // B.1 자동 승격 분기 ① — identity 0 개인 Person 의 첫 row 는 DB 에서 isPrimary=true.
  it("POST — identity 0 개 Person 의 첫 생성 row 는 DB 에서 isPrimary=true (자동 승격 분기 ①)", async () => {
    const personId = await seedPerson();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(201);

    const rows = await prisma.serviceIdentity.findMany({ where: { personId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].isPrimary).toBe(true);
  });

  // B.2 자동 승격 분기 ② — 이미 primary 가 있으면 두 번째 row 는 isPrimary=false 이고
  // 기존 primary 가 그대로 유지된다 (응답이 아니라 DB 조회로 확인).
  it("POST — 이미 primary 가 있으면 두 번째 row 는 isPrimary=false 이고 기존 primary 유지 (자동 승격 분기 ②)", async () => {
    const personId = await seedPerson();
    const first = await prisma.serviceIdentity.create({
      data: {
        personId,
        service: "github",
        externalId: "octo",
        isPrimary: true,
      },
    });

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "jira", externalId: "octo.j" })
      .expect(201);

    const rows = await prisma.serviceIdentity.findMany({ where: { personId } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === first.id)?.isPrimary).toBe(true);
    expect(rows.find((r) => r.service === "jira")?.isPrimary).toBe(false);
  });

  // B.3 빈 목록 분기 — identity 0 row 인 Person 은 404 가 아니라 200 + 빈 배열.
  it("GET — identity 0 row 인 Person 은 404 가 아니라 200 + 빈 배열 (빈 목록 분기)", async () => {
    const personId = await seedPerson();

    const response = await request(app.getHttpServer())
      .get(endpointFor(personId))
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // -- C. Error path (R-112 #2) --------------------------------------------------

  // C.1 미존재 personId 로 POST → 404 + envelope (statusCode · message).
  it("POST — 미존재 personId 는 404 이고 envelope 에 statusCode·message 포함 (error path)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor("nonexistent-person-id"))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("statusCode", 404);
    expect(response.body).toHaveProperty("message");
  });

  // -- D. Negative cases (R-112 #4) — 예외 분기마다 1+ ---------------------------

  // D.1 인증 쿠키 없이 GET → JwtAuthGuard 가 401.
  it("GET — 인증 쿠키 없으면 401 (negative)", async () => {
    const personId = await seedPerson();

    await request(app.getHttpServer()).get(endpointFor(personId)).expect(401);
  });

  // D.2 User role 쿠키로 POST → 편집 tier (Admin+) 미달이라 RolesGuard 가 403.
  it("POST — User role 은 편집 tier 미달이라 403 (negative)", async () => {
    const personId = await seedPerson();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", userCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(403);
  });

  // D.3 같은 personId + 같은 service 재생성 → @@unique 위반 P2002 가 409 로 변환.
  it("POST — 같은 personId·service 재생성은 409 (P2002 변환, negative)", async () => {
    const personId = await seedPerson();
    await prisma.serviceIdentity.create({
      data: {
        personId,
        service: "github",
        externalId: "octo",
        isPrimary: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo-dup" });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty("statusCode", 409);
  });

  // D.4 화이트리스트 밖 필드 (`isPrimary`) 포함 → forbidNonWhitelisted 가 400.
  it("POST — 화이트리스트 밖 필드 isPrimary 는 400 (forbidNonWhitelisted, negative)", async () => {
    const personId = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo", isPrimary: true });

    expect(response.status).toBe(400);
    // 생성이 차단됐으므로 DB 잔여 0.
    expect(await prisma.serviceIdentity.count({ where: { personId } })).toBe(0);
  });

  // D.5 필수 필드 (`externalId`) 누락 → DTO decorator 위반으로 400.
  it("POST — 필수 필드 externalId 누락은 400 (negative)", async () => {
    const personId = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("statusCode", 400);
  });
});

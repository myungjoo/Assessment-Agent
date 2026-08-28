// service-identities.e2e-spec.ts — `GET/POST /api/persons/:personId/identities` 와
// `PATCH/DELETE /api/persons/:personId/identities/:identityId` 의 HTTP + guard stack +
// ValidationPipe + 실 PostgreSQL round-trip e2e
// (ADR-0058 §Follow-ups (c) e2e chain 의 1 번째 slice T-1753 + 2 번째 slice T-1754 +
//  3 번째 slice T-1755).
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
//   - 1 번째 slice (T-1753) 가 **GET 목록 · POST 생성** 두 축을, 2 번째 slice (T-1754)
//     가 **PATCH 수정** 축을, 3 번째 slice (T-1755) 가 **DELETE 삭제** 축을 덮는다.
//     남은 축은 **primary 지정 1 route** (`POST /:identityId/primary`) 뿐이며 그 e2e 는
//     **마지막 slice** 소관이다. 그 slice 도 본 파일이 지불한 harness (인증 actor seed ·
//     truncate · re-seed · Person seed helper · identity seed helper) 를 그대로
//     재사용한다. 5 route 를 한 commit 에 담으면 CLAUDE.md §3 의 300 LOC 상한을 확실히
//     넘기므로 미리 케이스를 추가하지 않는다.
//   - production code 변경 0 — controller · service · repository · DTO 는 T-1739 ~
//     T-1752 에서 완결됐다.
//
// PATCH 축이 지는 계약 (T-1754 가 고정하는 지점):
//   - **금지 축 400 게이트** (§Decision 3) — `UpdateServiceIdentityDto` 는 `externalId?`
//     단일 필드라 `isPrimary` · `service` 는 화이트리스트 밖이고 controller-scope
//     ValidationPipe 의 `forbidNonWhitelisted` 가 400 을 낸다. 명시적 `null` 도
//     `@ValidateIf((_o, v) => v !== undefined)` 가 skip 하지 않아 400 이다.
//   - **3 단 404 가 403 이 아닌 이유** (§Decision 5 b · e) — Person 부재 · 타 Person 소유
//     identity · `P2025` 세 경로가 **전부 404** 다. 타 Person 소유 건에 403 을 주면 "그
//     id 의 row 가 존재한다" 는 사실이 응답만으로 새어 나가므로, 존재 여부 자체를 숨기는
//     404 로 통일한다 (소유자 personId 도 메시지에 넣지 않는다).
//   - **미전달 보존 분기** (§Decision 3 + service `externalId === undefined` 단락) —
//     빈 body `{}` 는 repository 미호출로 현재 row 를 그대로 반환하는 200 이다.
//
// DELETE 축이 지는 계약 (T-1755 가 고정하는 지점):
//   - **204 + body 없음** (§Decision 1 DELETE 행) — service 는 삭제된 row 를 돌려주지만
//     controller 가 `@HttpCode(204)` + `Promise<void>` 로 버리므로 응답 body 는 비어야
//     한다. "지워졌다" 는 사실은 응답이 아니라 DB 재조회로만 확인된다.
//   - **primary 재승격** (§Decision 2 마지막 항) — DELETE 는 재승격을 지는 **유일한
//     route** 다. 지운 row 가 primary 면 잔여 중 `createdAt` 오름차순 첫 row 가 승격되고,
//     잔여 0 이면 승격 없이 끝나며, 비-primary 를 지우면 기존 primary 가 유지된다. 세
//     분기 모두 **응답(204 + 빈 body)이 완전히 동일** 해 HTTP 응답만으로는 구분이 불가능
//     하다 — 실 Postgres 의 **잔여 row 상태를 직접 조회** 해야만 성립을 발화시킬 수 있고
//     mock service 를 쓰는 unit spec 이나 smoke 로는 발화하지 않는다. 그래서 본 축의 분기
//     케이스는 전부 `prisma.serviceIdentity` 재조회를 assert 로 삼는다.
//   - **3 단 404** (§Decision 5 b · c · e) — Person 부재 · 타 Person 소유 · `P2025` 가
//     전부 404 이고, 실패한 DELETE 는 DB 를 전혀 건드리지 않는다. 같은 id 로 두 번째
//     DELETE 는 소유 검사에서 걸려 404 — **멱등이 아니다**.
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
//   - 35 test = 목록·생성 축 11 + PATCH 수정 축 12 + DELETE 삭제 축 12.
//   - 목록·생성 축 11 = happy 2 (GET 목록 · POST 생성) + 분기 3 (자동 승격 2 분기 ·
//     빈 목록) + error path 1 (미존재 personId 404) + negative 5 (401 · 403 · 409 ·
//     400 두 종).
//   - PATCH 수정 축 12 = happy 1 (200 + DB 실 반영) + 분기 4 (빈 body 보존 · 3 단 404
//     각 1) + error path 1 (404 시 대상 row 의 externalId 보존) + negative 6 (401 ·
//     403 · isPrimary 400 · service 400 · null 400 · 빈 문자열 400).
//   - DELETE 삭제 축 12 = happy 1 (204 + 빈 body + DB row 소멸) + 분기 6 (재승격 3 분기 ·
//     3 단 404 각 1) + error path 1 (404 후 대상 row · primary 배치 보존) + negative 4
//     (401 · 403 + row 보존 · 두 번째 DELETE 404 · 비정상 path 파라미터 404).
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

// 단일 identity path builder — PATCH/DELETE/primary 축이 쓰는 `:identityId` 까지 치환.
const identityEndpointFor = (personId: string, identityId: string): string =>
  `${endpointFor(personId)}/${identityId}`;

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

describe("E2E: /api/persons/:personId/identities 목록·생성·수정·삭제 계약 (T-1753/T-1754/T-1755)", () => {
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

  // identity 1 row seed — PATCH · DELETE 축이 공유한다 (T-1755 가 PATCH describe 안의
  // helper 를 이 scope 로 hoist — 두 벌 복제 금지). 앞 2 인자는 hoist 전 호출부와 동일
  // 하고, DELETE 축이 필요한 축 (`service` 분리 · 비-primary · 결정론적 `createdAt`) 만
  // options 로 덧붙인다. `@@unique([personId, service])` 때문에 같은 Person 에 2 row
  // 이상을 seed 할 때는 `service` 를 반드시 다르게 준다.
  const seedIdentity = async (
    personId: string,
    externalId = "octo",
    options: { service?: string; isPrimary?: boolean; createdAt?: Date } = {},
  ): Promise<string> => {
    const row = await prisma.serviceIdentity.create({
      data: {
        personId,
        service: options.service ?? "github",
        externalId,
        isPrimary: options.isPrimary ?? true,
        ...(options.createdAt === undefined
          ? {}
          : { createdAt: options.createdAt }),
      },
    });
    return row.id;
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

  // -- E. PATCH 수정 축 (T-1754) -------------------------------------------------
  //
  // 위 harness (beforeAll actor seed · afterEach truncate + re-seed · afterAll close ·
  // seedPerson) 를 그대로 상속하는 nested describe 다 — 중복 정의 0.
  describe("PATCH /:identityId — 수정 계약 (T-1754)", () => {
    // 대상 identity 1 row seed 는 공용 scope 의 `seedIdentity` 를 그대로 쓴다 (T-1755
    // hoist). PATCH 는 항상 기존 row 를 전제로 하므로 각 test 의 arrange 가 이 helper 로
    // 시작한다 (afterEach truncate 로 매번 소멸).

    // E.1 happy — 200 + 갱신된 row 응답, DB 직접 조회로 실 반영 확인 (R-112 #1).
    it("PATCH — Admin 이 externalId 를 바꾸면 200 + 갱신 row 응답 + DB 실 반영 (happy)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({ externalId: "octo-renamed" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: identityId,
        personId,
        service: "github",
        externalId: "octo-renamed",
      });

      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row?.externalId).toBe("octo-renamed");
    });

    // E.2 분기 — 빈 body `{}` 는 service 의 `externalId === undefined` 단락을 타고
    // repository 미호출로 현재 row 를 그대로 반환한다 (§Decision 3 보존 semantic).
    it("PATCH — 빈 body 는 200 이고 externalId·isPrimary·service 가 모두 보존 (미전달 분기)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: identityId,
        externalId: "octo",
      });

      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row?.externalId).toBe("octo");
      expect(row?.isPrimary).toBe(true);
      expect(row?.service).toBe("github");
    });

    // E.3 3 단 404 ① — Person 선검사 단계에서 404 (§Decision 5 c).
    it("PATCH — 미존재 personId 는 404 (3 단 404 ①)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .patch(identityEndpointFor("nonexistent-person-id", identityId))
        .set("Cookie", adminCookie)
        .send({ externalId: "octo-renamed" })
        .expect(404);
    });

    // E.4 3 단 404 ② — 타 Person 소유 identity 는 **403 이 아니라 404** (§Decision 5 e).
    // row 의 존재 사실 자체를 숨겨야 하므로 소유 위반을 권한 오류로 표현하지 않는다.
    it("PATCH — 타 Person 소유 identity 는 403 이 아니라 404 (3 단 404 ②)", async () => {
      const personId = await seedPerson();
      // 두 번째 Person 은 email @unique 때문에 seedPerson 재사용이 불가해 inline seed.
      const other = await prisma.person.create({
        data: { fullName: "타 인원", email: "si-other@e2e.test" },
      });
      const foreignId = await seedIdentity(other.id, "foreign");

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, foreignId))
        .set("Cookie", adminCookie)
        .send({ externalId: "hijacked" });

      expect(response.status).toBe(404);
      // 404 로 감춘 이상 응답 어디에도 타 Person 의 id 가 새면 안 된다 (§Decision 5 e).
      expect(JSON.stringify(response.body)).not.toContain(other.id);
    });

    // E.5 3 단 404 ③ — Person 은 있고 identityId 만 미존재. envelope 검증도 여기서.
    it("PATCH — 존재하는 Person + 미존재 identityId 는 404 이고 envelope 에 statusCode·message 포함 (3 단 404 ③)", async () => {
      const personId = await seedPerson();
      await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, "nonexistent-identity-id"))
        .set("Cookie", adminCookie)
        .send({ externalId: "octo-renamed" });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("statusCode", 404);
      expect(response.body).toHaveProperty("message");
    });

    // E.6 error path — 404 로 끝난 요청은 DB 를 건드리지 않는다. E.4 의 타 Person 소유
    // 케이스에서 대상 row 의 externalId 가 보존됐는지 직접 조회로 확인 (R-112 #2).
    it("PATCH — 타 Person 소유 404 후 대상 row 의 externalId 는 보존 (error path)", async () => {
      const personId = await seedPerson();
      const other = await prisma.person.create({
        data: { fullName: "타 인원", email: "si-other@e2e.test" },
      });
      const foreignId = await seedIdentity(other.id, "foreign");

      await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, foreignId))
        .set("Cookie", adminCookie)
        .send({ externalId: "hijacked" })
        .expect(404);

      const row = await prisma.serviceIdentity.findUnique({
        where: { id: foreignId },
      });
      expect(row?.externalId).toBe("foreign");
    });

    // E.7 negative ① — 인증 쿠키 없으면 JwtAuthGuard 가 401.
    it("PATCH — 인증 쿠키 없으면 401 (negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .send({ externalId: "octo-renamed" })
        .expect(401);
    });

    // E.8 negative ② — User role 은 편집 tier (Admin+) 미달이라 RolesGuard 가 403.
    it("PATCH — User role 은 편집 tier 미달이라 403 (negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", userCookie)
        .send({ externalId: "octo-renamed" })
        .expect(403);
    });

    // E.9 negative ③ — 금지 축 `isPrimary` 는 DTO 필드가 없어 forbidNonWhitelisted 400.
    // 차단 후 DB 가 그대로인지도 함께 확인한다.
    it("PATCH — 금지 축 isPrimary 는 400 이고 DB 무변경 (forbidNonWhitelisted, negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({ isPrimary: false });

      expect(response.status).toBe(400);
      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row?.isPrimary).toBe(true);
    });

    // E.10 negative ④ — 금지 축 `service` 도 같은 400 게이트 (§Decision 3).
    it("PATCH — 금지 축 service 는 400 (forbidNonWhitelisted, negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({ service: "jira" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("statusCode", 400);
    });

    // E.11 negative ⑤ — 명시적 `null` 은 @ValidateIf 가 skip 하지 않아 @IsString 위반 400.
    it("PATCH — externalId: null 은 skip 되지 않고 400 (@ValidateIf, negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({ externalId: null });

      expect(response.status).toBe(400);
      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row?.externalId).toBe("octo");
    });

    // E.12 negative ⑥ — 빈 문자열은 @IsNotEmpty 위반 400 (경계값).
    it("PATCH — externalId 빈 문자열은 400 (@IsNotEmpty, negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .patch(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .send({ externalId: "" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("statusCode", 400);
    });
  });

  // -- F. DELETE 삭제 축 (T-1755) ------------------------------------------------
  //
  // 위 harness (actor seed · truncate + re-seed · seedPerson · seedIdentity) 를 그대로
  // 상속하는 nested describe — 중복 정의 0. 재승격 3 분기는 응답이 모두 같은 204 라서
  // assert 를 전부 DB 재조회로 세운다.
  describe("DELETE /:identityId — 삭제 계약 (T-1755)", () => {
    // F.1 happy — 204 + 빈 body 이고 대상 row 가 DB 에서 실제로 사라진다 (R-112 #1).
    it("DELETE — Admin 이 삭제하면 204 + 빈 body 이고 DB row 가 사라짐 (happy)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(response.text ?? "").toBe("");

      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row).toBeNull();
    });

    // F.2 재승격 분기 ① — primary 를 지우고 잔여가 2 면 `createdAt` 오름차순 첫 row 만
    // 승격된다 (§Decision 2). `createdAt` 을 명시 seed 해 순서를 결정론적으로 고정한다.
    it("DELETE — primary 삭제 + 잔여 2 면 createdAt 오름차순 첫 row 가 승격 (분기 ①)", async () => {
      const personId = await seedPerson();
      const oldest = await seedIdentity(personId, "octo.j", {
        service: "jira",
        isPrimary: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const primary = await seedIdentity(personId, "octo", {
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      const newest = await seedIdentity(personId, "octo.s", {
        service: "slack",
        isPrimary: false,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      });

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, primary))
        .set("Cookie", adminCookie)
        .expect(204);

      const rows = await prisma.serviceIdentity.findMany({
        where: { personId },
      });
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.id === oldest)?.isPrimary).toBe(true);
      expect(rows.find((row) => row.id === newest)?.isPrimary).toBe(false);
    });

    // F.3 재승격 분기 ② — 잔여 0 이면 승격 대상이 없어 그대로 끝난다 (`N = 0` 정상 상태).
    it("DELETE — 마지막 primary 를 지우면 잔여 0 이고 승격도 없음 (분기 ②)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .expect(204);

      const remaining = await prisma.serviceIdentity.count({
        where: { personId },
      });
      expect(remaining).toBe(0);
    });

    // F.4 재승격 분기 ③ — 비-primary 삭제는 재승격 자체가 발동하지 않는다.
    it("DELETE — 비-primary 삭제는 기존 primary 를 그대로 유지 (분기 ③)", async () => {
      const personId = await seedPerson();
      const primary = await seedIdentity(personId, "octo", {
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      const secondary = await seedIdentity(personId, "octo.j", {
        service: "jira",
        isPrimary: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, secondary))
        .set("Cookie", adminCookie)
        .expect(204);

      const rows = await prisma.serviceIdentity.findMany({
        where: { personId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(primary);
      expect(rows[0]?.isPrimary).toBe(true);
    });

    // F.5 3 단 404 ① — Person 선검사 단계에서 404 (§Decision 5 c).
    it("DELETE — 미존재 personId 는 404 (3 단 404 ①)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .delete(identityEndpointFor("nonexistent-person-id", identityId))
        .set("Cookie", adminCookie)
        .expect(404);
    });

    // F.6 3 단 404 ② — 타 Person 소유 identity 는 **403 이 아니라 404** (§Decision 5 e).
    it("DELETE — 타 Person 소유 identity 는 403 이 아니라 404 (3 단 404 ②)", async () => {
      const personId = await seedPerson();
      const other = await prisma.person.create({
        data: { fullName: "타 인원", email: "si-other@e2e.test" },
      });
      const foreignId = await seedIdentity(other.id, "foreign");

      const response = await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, foreignId))
        .set("Cookie", adminCookie);

      expect(response.status).toBe(404);
      // 404 로 감춘 이상 응답 어디에도 타 Person 의 id 가 새면 안 된다 (§Decision 5 e).
      expect(JSON.stringify(response.body)).not.toContain(other.id);
    });

    // F.7 3 단 404 ③ — Person 은 있고 identityId 만 미존재. envelope 검증도 여기서.
    it("DELETE — 존재하는 Person + 미존재 identityId 는 404 이고 envelope 에 statusCode·message 포함 (3 단 404 ③)", async () => {
      const personId = await seedPerson();
      await seedIdentity(personId);

      const response = await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, "nonexistent-identity-id"))
        .set("Cookie", adminCookie);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("statusCode", 404);
      expect(response.body).toHaveProperty("message");
    });

    // F.8 error path — 404 로 끝난 DELETE 후 대상 row 존속 + primary 배치 불변 (R-112 #2).
    it("DELETE — 타 Person 소유 404 후 대상 row 와 primary 배치가 모두 보존 (error path)", async () => {
      const personId = await seedPerson();
      const other = await prisma.person.create({
        data: { fullName: "타 인원", email: "si-other@e2e.test" },
      });
      const foreignPrimary = await seedIdentity(other.id, "foreign");
      const foreignSecondary = await seedIdentity(other.id, "foreign.j", {
        service: "jira",
        isPrimary: false,
      });

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, foreignPrimary))
        .set("Cookie", adminCookie)
        .expect(404);

      const rows = await prisma.serviceIdentity.findMany({
        where: { personId: other.id },
      });
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.id === foreignPrimary)?.isPrimary).toBe(
        true,
      );
      expect(rows.find((row) => row.id === foreignSecondary)?.isPrimary).toBe(
        false,
      );
    });

    // F.9 negative ① — 인증 쿠키 없으면 JwtAuthGuard 가 401.
    it("DELETE — 인증 쿠키 없으면 401 (negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .expect(401);
    });

    // F.10 negative ② — User role 은 편집 tier 미달 403, guard 단계라 row 보존 (§Decision 4).
    it("DELETE — User role 은 편집 tier 미달이라 403 이고 row 보존 (negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .set("Cookie", userCookie)
        .expect(403);

      const row = await prisma.serviceIdentity.findUnique({
        where: { id: identityId },
      });
      expect(row?.isPrimary).toBe(true);
    });

    // F.11 negative ③ — 두 번째 DELETE 는 소유 검사에서 404. **멱등이 아니다**.
    it("DELETE — 같은 id 로 두 번째 삭제는 404 (멱등 아님, negative)", async () => {
      const personId = await seedPerson();
      const identityId = await seedIdentity(personId);

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .expect(204);

      await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, identityId))
        .set("Cookie", adminCookie)
        .expect(404);
    });

    // F.12 negative ④ — 비정상 path 파라미터는 404 계열이어야 하고 5xx 로 새면 안 된다.
    it("DELETE — 빈 문자열·형식 이상 identityId 는 404 계열이고 5xx 가 아님 (negative)", async () => {
      const personId = await seedPerson();
      await seedIdentity(personId);

      const empty = await request(app.getHttpServer())
        .delete(identityEndpointFor(personId, ""))
        .set("Cookie", adminCookie);
      expect(empty.status).toBe(404);
      expect(empty.status).toBeLessThan(500);

      const malformed = await request(app.getHttpServer())
        .delete(
          identityEndpointFor(personId, encodeURIComponent("not-a-cuid #1")),
        )
        .set("Cookie", adminCookie);
      expect(malformed.status).toBe(404);
      expect(malformed.status).toBeLessThan(500);
    });
  });
});

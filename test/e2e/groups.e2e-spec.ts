// groups.e2e-spec.ts — `/api/groups` 7 endpoint HTTP contract depth e2e (T-0062 —
// T-0054 persons.e2e + T-0060 parts.e2e + T-0061 groups.smoke 패턴 1:1 mirror).
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 GroupController 7 endpoint (CRUD 4 + N:M 3) 의 status + content-type
//     + body shape + 4xx envelope (statusCode / error / message) + multi-step N:M
//     branch flow + REQ-051 다중 group 소속 invariant 의 HTTP contract depth cover.
//   - unit (group.{controller,service}.spec) 은 정확한 message text 책임, smoke
//     (groups.smoke-spec, T-0061) 는 부트스트랩 + status 1-level 책임.
//
// 실 DB 전략 (ADR-0004 §Decision — persons.e2e / parts.e2e 패턴 mirror):
//   - mock override 제거 — AppModule.compile() 만으로 부트스트랩, PrismaService 가
//     services.postgres 의 localhost:5432 로 실 connection 발화. REQ-029 durability
//     path + Prisma adapter / pg unique + FK constraint 실 동작 e2e contract depth.
//   - arrange 단계 prisma.{group,person,personGroupMembership}.create 실 seed →
//     endpoint 호출 → 응답 + 실 DB state 양쪽 검증. afterEach(truncateAll)
//     (ADR-0004 §Cleanup) + afterAll(app.close + prisma.$disconnect) 박제.
//   - test/jest-e2e.json 의 maxWorkers:1 (T-0060) 위에서 groups.e2e + persons.e2e
//     + parts.e2e 직렬 실행 — cross-file afterEach race 차단.
//
// 인증 cookie 선탑재 (T-2031, Q-0056 ① groups guard 배선 선행): B~D 요청 16 곳 전부에 tier
// cookie 를 싣는다 — GET 은 `userCookie`, 그 외는 `adminCookie` (api.md `89~93 행`).
//
// 인가 단언 (T-2040, Q-0056 ⑤c): E 절이 실 `JwtAuthGuard` · `RolesGuard` 의 거부 경로를
// 닫는다 — 무 cookie 401 × 9 · User mutation 403 × 5 · invalid JWT 401 × 2 · guard 가
// pipe / handler 보다 먼저 끊는 순서 2 건 · 상위 role escalation 허용 2 건 (E 절 20 test).
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

const ADMIN_EMAIL = "groups-admin-actor@e2e.test";
const USER_EMAIL = "groups-user-actor@e2e.test";
const SUPERADMIN_EMAIL = "groups-superadmin-actor@e2e.test";

// 인가 단언 (E 절) 의 seed — group 1 · person 2 (member 1 + 비-member 1) · membership 1.
type AuthzSeed = {
  groupId: string;
  groupName: string;
  membershipId: string;
  outsiderId: string;
};

// E 절 route 표 — [제목, method, seed → path, seed → body]. body 는 guard 를 통과했다면
// handler 가 실제로 반영했을 유효 payload 다 (validation 400 이 아니라 guard 거부임을 보인다).
type RouteMethod = "get" | "post" | "patch" | "delete";
type RouteCase = [
  string,
  RouteMethod,
  (s: AuthzSeed) => string,
  ((s: AuthzSeed) => object)?,
];

const READ_ROUTES: RouteCase[] = [
  ["GET /api/groups", "get", () => "/api/groups"],
  ["GET /api/groups/:id", "get", (s) => `/api/groups/${s.groupId}`],
  [
    "GET /api/groups/:id/persons",
    "get",
    (s) => `/api/groups/${s.groupId}/persons`,
  ],
  [
    "GET /api/groups/:id/members",
    "get",
    (s) => `/api/groups/${s.groupId}/members`,
  ],
];
const WRITE_ROUTES: RouteCase[] = [
  [
    "POST /api/groups",
    "post",
    () => "/api/groups",
    () => ({ name: "거부대상" }),
  ],
  [
    "POST /api/groups/:id/members",
    "post",
    (s) => `/api/groups/${s.groupId}/members`,
    (s) => ({ personId: s.outsiderId }),
  ],
  [
    "PATCH /api/groups/:id",
    "patch",
    (s) => `/api/groups/${s.groupId}`,
    () => ({ name: "변경시도" }),
  ],
  ["DELETE /api/groups/:id", "delete", (s) => `/api/groups/${s.groupId}`],
  [
    "DELETE /api/groups/:id/members/:membershipId",
    "delete",
    (s) => `/api/groups/${s.groupId}/members/${s.membershipId}`,
  ],
];

// Group DTO 필수 2 field — happy endpoint (GET list / GET :id / POST) 공통.
const GROUP_DTO_FIELDS = ["id", "name"] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const expectDtoFields = (body: object): void => {
  GROUP_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/groups HTTP contract", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    // 부트스트랩 + applyGlobalMiddleware wire 는 createE2EApp 책임 (T-0090 박제) —
    // createAuthenticatedE2EApp 이 그 위에 actor seed + token 발급을 얹는다.
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
      { role: "SuperAdmin", email: SUPERADMIN_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    superAdminCookie = buildAuthCookie(ctx.tokens[SUPERADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup — afterEach truncate 로 test 간 state leak 0. truncate 가 "User"
  // 까지 비우므로 원본 id 그대로 actor 를 복원한다 (순서 고정 — T-0520 선례).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // -- B. Happy path (7 endpoint × status + header + body shape) -----------
  // B.1 POST /api/groups — 201 + json + 생성된 Group + 실 DB row 재조회.
  it("POST /api/groups returns 201 with created Group and persists to DB", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", adminCookie)
      .send({ name: "신규그룹" });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.name).toBe("신규그룹");
    expect(typeof response.body.id).toBe("string");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — mock 의 calls 검증을 실 DB 의
    // findUnique 재조회로 mechanical 변환.
    const created = await prisma.group.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.name).toBe("신규그룹");
  });

  // B.2 GET /api/groups — 200 + json + array + body[0] DTO 2 field.
  it("GET /api/groups returns 200 with application/json array of Group DTOs", async () => {
    const seed = await prisma.group.create({ data: { name: "그룹A" } });

    const response = await request(app.getHttpServer())
      .get("/api/groups")
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].name).toBe(seed.name);
  });

  // B.3 GET /api/groups/:id — 200 + json + 단일 object + 2 field + 값 일치.
  it("GET /api/groups/:id returns 200 with application/json single Group DTO", async () => {
    const seed = await prisma.group.create({ data: { name: "그룹B" } });

    const response = await request(app.getHttpServer())
      .get(`/api/groups/${seed.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.name).toBe(seed.name);
  });

  // B.4 DELETE /api/groups/:id — 204 + body empty + 실 DB 에서 row 사라짐.
  // GroupService.delete = hard delete (PersonGroupMembership cascade 동반 삭제).
  it("DELETE /api/groups/:id returns 204 with empty body", async () => {
    const seed = await prisma.group.create({ data: { name: "삭제대상그룹" } });

    const response = await request(app.getHttpServer())
      .delete(`/api/groups/${seed.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const deleted = await prisma.group.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // B.5 POST /api/groups/:id/members — 201 + json + (id, personId, groupId) +
  // 실 DB membership row 재조회 (REQ-028 N:M middle table add path).
  it("POST /api/groups/:id/members returns 201 with created membership", async () => {
    const group = await prisma.group.create({
      data: { name: "멤버등록대상그룹" },
    });
    const person = await prisma.person.create({
      data: { fullName: "이순신", email: "member@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .set("Cookie", adminCookie)
      .send({ personId: person.id });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toHaveProperty("id");
    expect(response.body.personId).toBe(person.id);
    expect(response.body.groupId).toBe(group.id);

    const created = await prisma.personGroupMembership.findUnique({
      where: {
        personId_groupId: { personId: person.id, groupId: group.id },
      },
    });
    expect(created).not.toBeNull();
    expect(created?.id).toBe(response.body.id);
  });

  // B.6 DELETE /api/groups/:id/members/:membershipId — 204 + body empty +
  // 실 DB membership row 사라짐 + Group/Person 자체는 보존.
  it("DELETE /api/groups/:id/members/:membershipId returns 204 with empty body", async () => {
    const group = await prisma.group.create({
      data: { name: "멤버삭제대상그룹" },
    });
    const person = await prisma.person.create({
      data: { fullName: "강감찬", email: "remove@example.test" },
    });
    const membership = await prisma.personGroupMembership.create({
      data: { personId: person.id, groupId: group.id },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/groups/${group.id}/members/${membership.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const deletedMembership = await prisma.personGroupMembership.findUnique({
      where: { id: membership.id },
    });
    expect(deletedMembership).toBeNull();

    const stillGroup = await prisma.group.findUnique({
      where: { id: group.id },
    });
    expect(stillGroup).not.toBeNull();
    const stillPerson = await prisma.person.findUnique({
      where: { id: person.id },
    });
    expect(stillPerson).not.toBeNull();
  });

  // B.7 GET /api/groups/:id/persons — 200 + json + array (Group 1 + Person 2 +
  // Membership 2 seed). REQ-028 N:M middle table indirect navigation reverse
  // query path 의 e2e HTTP contract depth 첫 박제.
  it("GET /api/groups/:id/persons returns 200 with application/json array of assigned Persons", async () => {
    const group = await prisma.group.create({ data: { name: "그룹C" } });
    const personA = await prisma.person.create({
      data: { fullName: "홍길동", email: "a@example.test" },
    });
    const personB = await prisma.person.create({
      data: { fullName: "김철수", email: "b@example.test" },
    });
    await prisma.personGroupMembership.create({
      data: { personId: personA.id, groupId: group.id },
    });
    await prisma.personGroupMembership.create({
      data: { personId: personB.id, groupId: group.id },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/groups/${group.id}/persons`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    // 각 item 이 Person DTO 핵심 field 보유 (REQ-028 reverse query contract shape).
    response.body.forEach((p: object) => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("fullName");
      expect(p).toHaveProperty("email");
      expect(p).toHaveProperty("active");
    });

    // id 기준 set 비교 — Prisma default 순서 미보장.
    const returnedIds = response.body.map((p: { id: string }) => p.id).sort();
    expect(returnedIds).toEqual([personA.id, personB.id].sort());
  });

  // B.8 REQ-051 박제 — 한 Person 의 임의 group 다중 소속 invariant 의 e2e 첫 박제.
  // Group 2 + Person 1 + Membership 2 (동일 personId, 다른 groupId) seed → GET
  // /api/groups/{A,B}/persons → 두 응답 모두 동일 personId 1 row 포함.
  it("GET /api/groups/:id/persons reflects REQ-051 — one person can belong to multiple groups", async () => {
    const groupA = await prisma.group.create({ data: { name: "그룹가" } });
    const groupB = await prisma.group.create({ data: { name: "그룹나" } });
    const person = await prisma.person.create({
      data: { fullName: "유관순", email: "multi@example.test" },
    });
    await prisma.personGroupMembership.create({
      data: { personId: person.id, groupId: groupA.id },
    });
    await prisma.personGroupMembership.create({
      data: { personId: person.id, groupId: groupB.id },
    });

    const responseA = await request(app.getHttpServer())
      .get(`/api/groups/${groupA.id}/persons`)
      .set("Cookie", userCookie);
    const responseB = await request(app.getHttpServer())
      .get(`/api/groups/${groupB.id}/persons`)
      .set("Cookie", userCookie);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(Array.isArray(responseA.body)).toBe(true);
    expect(Array.isArray(responseB.body)).toBe(true);
    expect(responseA.body).toHaveLength(1);
    expect(responseB.body).toHaveLength(1);
    // 동일 personId 가 양쪽 group 응답에 모두 포함 — REQ-051 invariant 박제.
    expect(responseA.body[0].id).toBe(person.id);
    expect(responseB.body[0].id).toBe(person.id);
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) -------
  // C.1 GET /api/groups/missing-id → 404 envelope (findUnique null → NFE).
  it("GET /api/groups/:id with missing id returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/groups/missing-id")
      .set("Cookie", userCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST /api/groups {} → 400 envelope + validation message (name 누락).
  it("POST /api/groups with empty body returns 400 with envelope and validation message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/name/);
    expect(await prisma.group.count()).toBe(0);
  });

  // C.3 POST /api/groups/:id/members {} → 400 envelope + validation message
  // (personId 누락 — AddMemberDto ValidationPipe 발화 path 박제).
  it("POST /api/groups/:id/members with empty body returns 400 with envelope and validation message", async () => {
    const group = await prisma.group.create({
      data: { name: "검증대상그룹" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/personid/);
    expect(await prisma.personGroupMembership.count()).toBe(0);
  });

  // C.4 POST /api/groups non-whitelisted field → 400 envelope + whitelist message
  // (ValidationPipe forbidNonWhitelisted reject — parts.e2e §C.3 패턴 mirror).
  it("POST /api/groups with non-whitelisted field returns 400 with envelope and whitelist message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", adminCookie)
      .send({ name: "그룹X", extra: "forbidden" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/extra|property/);
    expect(await prisma.group.count()).toBe(0);
  });

  // -- D. Branch (N:M service-layer HttpException → status + envelope) -----
  // D.1 POST /api/groups/:id/members duplicate (personId, groupId) → 409 envelope.
  // 실 PostgreSQL `@@unique([personId, groupId])` P2002 → ConflictException 변환.
  // T-0061 smoke 의 1-level status 검증 위에 envelope shape 검증 추가.
  it("POST /api/groups/:id/members duplicate (personId, groupId) returns 409 with envelope", async () => {
    const group = await prisma.group.create({
      data: { name: "중복방지그룹" },
    });
    const person = await prisma.person.create({
      data: { fullName: "정약용", email: "duplicate@example.test" },
    });
    await prisma.personGroupMembership.create({
      data: { personId: person.id, groupId: group.id },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .set("Cookie", adminCookie)
      .send({ personId: person.id });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();
    expect(await prisma.personGroupMembership.count()).toBe(1);
  });

  // D.2 POST /api/groups/:id/members nonexistent personId → 404 envelope.
  // ValidationPipe 통과 → GroupService.addMember 사전 검증 (personRepository.findById
  // null) → NotFoundException → GroupService N:M ops 의 사전 검증 분기 e2e 박제.
  it("POST /api/groups/:id/members with nonexistent personId returns 404 with envelope", async () => {
    const group = await prisma.group.create({
      data: { name: "사전검증대상그룹" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .set("Cookie", adminCookie)
      .send({ personId: "cuid-e2e-missing-person" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
    expect(await prisma.personGroupMembership.count()).toBe(0);
  });

  // D.3 DELETE /api/groups/:id/members/:membershipId missing id → 404 envelope.
  // 실 PostgreSQL P2025 → GroupService.removeMember NotFoundException 변환.
  it("DELETE /api/groups/:id/members/:membershipId with missing id returns 404 with envelope", async () => {
    const group = await prisma.group.create({
      data: { name: "삭제검증대상그룹" },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/groups/${group.id}/members/cuid-e2e-missing-membership`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // -- E. 인증·인가 (T-2040, Q-0056 ⑤c) — 실 JwtAuthGuard · RolesGuard 거부 / 허용 경로 --
  // `GroupController` 의 `@UseGuards` 를 떼거나 write 축 `@Roles` 를 "User" 로 느슨하게
  // 바꾸면 E.1 · E.2 가 red 가 된다 (regression 가드). persons.e2e-spec E 절 mirror.
  const seedAuthz = async (): Promise<AuthzSeed> => {
    const group = await prisma.group.create({ data: { name: "인가대상그룹" } });
    const member = await prisma.person.create({
      data: { fullName: "인가멤버", email: "authz-member@example.test" },
    });
    const outsider = await prisma.person.create({
      data: { fullName: "인가외부", email: "authz-outsider@example.test" },
    });
    const membership = await prisma.personGroupMembership.create({
      data: { personId: member.id, groupId: group.id },
    });
    return {
      groupId: group.id,
      groupName: group.name,
      membershipId: membership.id,
      outsiderId: outsider.id,
    };
  };

  // cookie 가 undefined 면 `Cookie` header 자체를 싣지 않는다 (무 cookie 요청).
  const send = (
    [, method, pathOf, bodyOf]: RouteCase,
    seed: AuthzSeed,
    cookie?: string,
  ) => {
    const req = request(app.getHttpServer())[method](pathOf(seed));
    if (cookie !== undefined) req.set("Cookie", cookie);
    return bodyOf === undefined ? req : req.send(bodyOf(seed));
  };

  // 거부 시 부수효과 0 — group 은 seed 1 건 그대로 (POST 미생성 · DELETE 미삭제 · PATCH
  // 미반영), membership 도 seed 1 건 그대로 (POST :id/members 미생성 · DELETE 미삭제).
  const expectUntouched = async (seed: AuthzSeed): Promise<void> => {
    expect(await prisma.group.count()).toBe(1);
    const group = await prisma.group.findUnique({
      where: { id: seed.groupId },
    });
    expect(group?.name).toBe(seed.groupName);
    expect(await prisma.personGroupMembership.count()).toBe(1);
    const membership = await prisma.personGroupMembership.findUnique({
      where: { id: seed.membershipId },
    });
    expect(membership).not.toBeNull();
  };

  // E.1 무 cookie 401 × 9 route. `:id` · `:membershipId` 는 실존 id — 404 가 아니라 guard
  // 거부임을 보인다.
  it.each([...READ_ROUTES, ...WRITE_ROUTES])(
    "Q-0056 %s — cookie 부재 시 401 (negative — 인증 부재, JwtAuthGuard)",
    async (...route) => {
      const seed = await seedAuthz();

      const response = await send(route, seed);

      expect(response.status).toBe(401);
      await expectUntouched(seed);
    },
  );

  // E.2 User token 의 write 축 403 × 5 route. 반대 분기 (같은 `userCookie` 의 read 축 200)
  // 는 B 절의 GET happy test 4 건이 이미 cover 한다.
  it.each(WRITE_ROUTES)(
    "Q-0056 %s — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)",
    async (...route) => {
      const seed = await seedAuthz();

      const response = await send(route, seed, userCookie);

      expect(response.status).toBe(403);
      await expectUntouched(seed);
    },
  );

  // E.3 invalid JWT cookie 401 — read 1 + write 1 (JwtAuthGuard verify fail).
  it("Q-0056 GET /api/groups — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/groups")
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    expect(response.status).toBe(401);
  });

  it("Q-0056 POST /api/groups — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({ name: "invalid-jwt" });

    expect(response.status).toBe(401);
    // 유효 body 였지만 인증 차단으로 row 0.
    expect(await prisma.group.count()).toBe(0);
  });

  // E.4 403 이 validation 보다 먼저 — C 절과 같은 빈 body 가 User token 이면 400 이 아니다
  // (RolesGuard 가 ValidationPipe 앞에서 끊는다).
  it("Q-0056 POST /api/groups — User role token + 빈 body 는 400 이 아니라 403 (negative — guard 가 ValidationPipe 보다 먼저)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", userCookie)
      .send({});

    expect(response.status).toBe(403);
    expect(await prisma.group.count()).toBe(0);
  });

  // E.5 401 이 404 보다 먼저 — C 절과 같은 부재 id 가 무 cookie 면 404 가 아니다
  // (미인증 요청에 존재 여부를 노출하지 않는다).
  it("Q-0056 GET /api/groups/:id — cookie 부재 + 부재 id 는 404 가 아니라 401 (negative — 존재 여부 비노출)", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/groups/cuid-e2e-missing-group",
    );

    expect(response.status).toBe(401);
  });

  // E.6 escalation 허용 — SuperAdmin 이 Admin+ tier (write 축) 를 통과한다.
  it("Q-0056 POST /api/groups — SuperAdmin token 은 Admin+ tier 를 통과해 201 (happy — role escalation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .set("Cookie", superAdminCookie)
      .send({ name: "상위권한그룹" });

    expect(response.status).toBe(201);
    const created = await prisma.group.findUnique({
      where: { id: response.body.id },
    });
    expect(created?.name).toBe("상위권한그룹");
  });

  // E.7 escalation 허용 — Admin 이 User+ tier (read 축) 를 통과한다.
  it("Q-0056 GET /api/groups — Admin token 은 User+ tier 를 통과해 200 (happy — role escalation)", async () => {
    const seed = await seedAuthz();

    const response = await request(app.getHttpServer())
      .get("/api/groups")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(seed.groupId);
  });
});

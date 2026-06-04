// groups.smoke-spec.ts — `/api/groups` 7 endpoint 의 bootstrap smoke (T-0061 — T-0055
// GroupController CRUD + T-0057 N:M 3 endpoint 박제 위에 T-0059 parts.smoke 패턴 1:1 mirror).
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 AppModule 부트스트랩 + DI wiring + HTTP routing + status code +
//     ValidationPipe (whitelist / forbidNonWhitelisted / transform) 동작 +
//     PrismaService 의 실 DB 연동 (services.postgres / local postgres) path 를 cover.
//     GroupController 7 endpoint (GET / GET :id / GET :id/persons / POST 201 /
//     POST :id/members 201 / DELETE :id 204 / DELETE :id/members/:membershipId 204)
//     를 real PostgreSQL 위에서 발화 검증. PersonGroupMembership N:M middle table
//     의 `@@unique([personId, groupId])` constraint P2002 실 발화도 본 spec 의 책임.
//   - business logic (P2002 → 409 / P2025 → 404 / P2003 → 404 의 정확한 message text,
//     findPersonsByGroupId 의 N+1 loop 분기 등) 은 group.service.spec.ts 의 unit test 책임.
//   - HTTP contract 정밀 검증 / 4xx error shape 의 envelope / multi-step flow 는
//     e2e (T-0062 책임 — test/e2e/groups.e2e-spec.ts) 의 책임.
//
// 실 DB 전략 (ADR-0004 §Decision):
//   - mock override 제거 — Test.createTestingModule({imports: [AppModule]}).compile()
//     만으로 부트스트랩, PrismaService 가 services.postgres 의 localhost:5432 로 실
//     connection 발화. ADR-0004 §Decision 근거 1 (REQ-029 평가 자료 non-volatile
//     durability path 발화 — Group 도메인 확장) + 근거 2 (Prisma adapter / pg connection
//     pool / unique constraint / FK cascade 실 동작 검증) cover.
//   - 각 test 의 arrange 단계에서 `await prisma.group.create({data: {...}})` /
//     `await prisma.person.create({data: {...}})` / `await prisma.personGroupMembership.create({...})`
//     로 실 row seed, assertion 은 실 DB query 결과 검증.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제 — test 간 state leak 0.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex (`.*\.spec\.ts$`)
// 와 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns 에 `test/smoke/` 가
// 추가돼 있어 `pnpm test` / `pnpm test:cov` 실행 시에는 본 파일이 picking 되지 않는다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";

describe("Smoke: /api/groups CRUD + N:M bootstrap", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 실 PrismaService 인스턴스를 DI container 에서 획득 — seed / truncate / disconnect 용.
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // app.close() 가 NestJS lifecycle 의 onModuleDestroy 발화 → PrismaService 의
    // beforeExit hook 도 동반 → connection 정리. 명시적 $disconnect 으로 누수 방지.
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup 정책 박제 — 각 test 후 7 도메인 테이블 TRUNCATE ... RESTART
  // IDENTITY CASCADE 로 초기화. test 간 state leak 0 보장.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // ---------------------------------------------------------------------------
  // Happy path 7 — GroupController 의 7 endpoint 각 1 test.
  // 각 test 는 arrange 단계에서 prisma.group.create / prisma.person.create /
  // prisma.personGroupMembership.create 로 실 row seed → endpoint 호출 → 응답 + 실
  // DB state 검증.
  // ---------------------------------------------------------------------------

  // GET /api/groups → 200 + body[0].id === seed.id + body[0].name === "그룹A".
  // GroupService.findAll() → GroupRepository.findMany() → 실 prisma.group.findMany() 발화.
  it("GET /api/groups returns 200 with full list", async () => {
    const seed = await prisma.group.create({
      data: { name: "그룹A" },
    });

    const response = await request(app.getHttpServer()).get("/api/groups");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].name).toBe("그룹A");
  });

  // GET /api/groups/:id → 200 + body.id === seed.id.
  // GroupService.findById() → GroupRepository.findById() → prisma.group.findUnique() 발화.
  it("GET /api/groups/:id returns 200 with the group", async () => {
    const seed = await prisma.group.create({
      data: { name: "그룹B" },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/groups/${seed.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.name).toBe("그룹B");
  });

  // GET /api/groups/:id/persons → 200 + 실 DB 의 Group 소속 Person 목록 검증.
  // arrange — Group 1 seed + Person 2 seed + Membership 2 seed (personId 별 1 row) →
  // 응답 body 가 2 Person 박제. REQ-028 N:M middle table indirect navigation 의 reverse
  // query path 박제. GroupService.findPersonsByGroupId() → PersonGroupMembershipRepository
  // .findByGroupId() + PersonRepository.findById() loop → 실 prisma multi-query 발화.
  it("GET /api/groups/:id/persons returns 200 with persons assigned to group", async () => {
    const group = await prisma.group.create({
      data: { name: "그룹C" },
    });
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

    const response = await request(app.getHttpServer()).get(
      `/api/groups/${group.id}/persons`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    // id 기준 set 비교 — Prisma default 순서가 createdAt/id 정렬 보장이 없으므로
    // 순서 무관 검증으로 flakiness 회피.
    const returnedIds = response.body.map((p: { id: string }) => p.id).sort();
    expect(returnedIds).toEqual([personA.id, personB.id].sort());
  });

  // POST /api/groups → 201 + body.name === "신규그룹" + 실 DB 에 row 존재 확인.
  // ValidationPipe 가 {name} 통과 → GroupService.create() → GroupRepository.create() →
  // prisma.group.create() 실 발화 + @HttpCode(201).
  it("POST /api/groups returns 201 with created group", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .send({ name: "신규그룹" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("신규그룹");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — 실 query 발화 검증.
    const created = await prisma.group.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.name).toBe("신규그룹");
  });

  // POST /api/groups/:id/members → 201 + body.personId + body.groupId === path id +
  // 실 DB 에 membership row 존재. arrange — Group 1 + Person 1 seed → POST
  // {personId: <person.id>} → GroupService.addMember(groupId, personId) → Group/Person
  // 존재 사전 검증 + prisma.personGroupMembership.create() 실 발화 + @HttpCode(201).
  it("POST /api/groups/:id/members returns 201 with created membership", async () => {
    const group = await prisma.group.create({
      data: { name: "멤버등록대상그룹" },
    });
    const person = await prisma.person.create({
      data: { fullName: "이순신", email: "member@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .send({ personId: person.id });

    expect(response.status).toBe(201);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.groupId).toBe(group.id);

    // 실 DB 에 membership row 존재 확인 — prisma.personGroupMembership.create 실 발화 검증.
    const created = await prisma.personGroupMembership.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.personId).toBe(person.id);
    expect(created?.groupId).toBe(group.id);
  });

  // DELETE /api/groups/:id → 204 + body empty + 실 DB 에서 row 사라짐 확인.
  // 소속 membership 0 인 Group 만 seed → GroupService.delete() → prisma.group.delete()
  // 실 발화 + @HttpCode(204). PersonGroupMembership cascade 가 schema 차원 처리 —
  // assigned persons 시 409 분기 없음, 단순 delete.
  it("DELETE /api/groups/:id returns 204 with empty body", async () => {
    const seed = await prisma.group.create({
      data: { name: "삭제대상그룹" },
    });

    const response = await request(app.getHttpServer()).delete(
      `/api/groups/${seed.id}`,
    );

    expect(response.status).toBe(204);
    // 204 No Content 는 body 가 없어야 함 — supertest 는 빈 객체 {} 로 표현.
    expect(response.body).toEqual({});

    // 실 DB 에서 row 가 hard delete 됐는지 확인 — prisma.group.delete 실 발화 검증.
    const deleted = await prisma.group.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // DELETE /api/groups/:id/members/:membershipId → 204 + body empty + 실 DB 에서
  // membership row 사라짐 + Group/Person 자체는 보존 확인. arrange — Group 1 + Person 1
  // + Membership 1 seed → DELETE membership id → GroupService.removeMember(membershipId)
  // → prisma.personGroupMembership.delete() 실 발화 + @HttpCode(204).
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

    const response = await request(app.getHttpServer()).delete(
      `/api/groups/${group.id}/members/${membership.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 membership row 만 hard delete 확인 — Group/Person 자체는 보존.
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

  // ---------------------------------------------------------------------------
  // Negative path 3 — 예외 처리 분기 cover (R-112 negative 항목).
  // ValidationPipe 위반 2 종 (group empty body / member empty body) + missing id 404.
  // ---------------------------------------------------------------------------

  // GET /api/groups/missing-id → 404. 실 DB 의 prisma.group.findUnique 가 null 반환 →
  // GroupService.findById() 가 NotFoundException throw → Nest 의 404 mapping.
  it("GET /api/groups/missing-id returns 404", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/groups/missing-id",
    );

    expect(response.status).toBe(404);
  });

  // POST /api/groups with empty body → 400. ValidationPipe 가 name 누락
  // (@IsString / @IsNotEmpty 위반) 에서 reject — 400 BadRequest.
  // DB query 미발화 (validation 이 controller 진입 전 차단) — 실 DB count 0 검증.
  it("POST /api/groups with empty body returns 400 (validation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/groups")
      .send({});

    expect(response.status).toBe(400);

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.group.create 미호출.
    const count = await prisma.group.count();
    expect(count).toBe(0);
  });

  // POST /api/groups/:id/members with empty body → 400. ValidationPipe 가 personId
  // 누락 (@IsString / @IsNotEmpty 위반) 에서 reject — 400 BadRequest. AddMemberDto 의
  // ValidationPipe 발화 path 박제. DB query 미발화 (validation 이 controller 진입 전
  // 차단) — 실 DB membership count 0 검증.
  it("POST /api/groups/:id/members with empty body returns 400 (validation)", async () => {
    const group = await prisma.group.create({
      data: { name: "검증대상그룹" },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .send({});

    expect(response.status).toBe(400);

    // 실 DB 에 membership row 0 확인 — validation 차단으로 prisma.personGroupMembership.create
    // 미호출.
    const count = await prisma.personGroupMembership.count();
    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Branch coverage — GroupService.addMember 의 P2002 (N:M `@@unique([personId,
  // groupId])`) error 변환 분기 (smoke 차원). 실 PostgreSQL 의 PersonGroupMembership
  // `@@unique([personId, groupId])` constraint 가 P2002 발화 → GroupService.addMember()
  // ConflictException 변환 → 409 Conflict 자동 mapping.
  // 본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 Group N:M 도메인
  // 첫 실 검증 (ADR-0004 §Decision 근거 2 의 Group 도메인 확장 + REQ-028 N:M invariant
  // 의 schema-level enforce).
  // business logic 의 정확한 message text 는 unit (group.service.spec.ts) 책임.
  // ---------------------------------------------------------------------------

  // POST /api/groups/:id/members with duplicate (personId, groupId) pair → 409.
  // arrange — Group 1 + Person 1 + Membership 1 seed (동일 personId + groupId 1 회) →
  // 두번째 POST 같은 personId 로 → 실 PostgreSQL 의 PersonGroupMembership
  // `@@unique([personId, groupId])` constraint 가 P2002 발화 → GroupService.addMember()
  // ConflictException 변환 → 409 Conflict 자동 mapping.
  it("POST /api/groups/:id/members with duplicate (personId, groupId) returns 409", async () => {
    const group = await prisma.group.create({
      data: { name: "중복방지그룹" },
    });
    const person = await prisma.person.create({
      data: { fullName: "정약용", email: "duplicate@example.test" },
    });
    // 첫 membership seed — 두번째 POST 가 P2002 발화 대상.
    await prisma.personGroupMembership.create({
      data: { personId: person.id, groupId: group.id },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/groups/${group.id}/members`)
      .send({ personId: person.id });

    expect(response.status).toBe(409);

    // 실 DB 에 membership row 가 여전히 1 개 — 두번째 create 가 P2002 로 reject 확인.
    const count = await prisma.personGroupMembership.count();
    expect(count).toBe(1);
  });
});

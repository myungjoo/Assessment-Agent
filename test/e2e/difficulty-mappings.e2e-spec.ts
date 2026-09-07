// difficulty-mappings.e2e-spec.ts — GET /api/llm/difficulty-mappings 의 HTTP contract
// + RBAC tier enforce + 빈 슬롯 / null FK 분기 e2e (T-1960, REQ-050/REQ-049).
// schedules-backfill.e2e-spec.ts(T-1958) 패턴 1:1 mirror.
//
// 책임: DifficultyMappingController(@Get, Admin+ tier) → DifficultyMappingService
// .findAllMappings(raw forward — 정렬·건수 보정 0) → repository.findMany 의 실 배선을
// end-to-end 로 고정한다. 단위 분기는 각 service / controller spec 책임.
//
// 고정하는 계약 4 가지:
//   - seed 전 0 건 조회는 200 + [] 이며 404 가 아니다(ADR-0011 §3 fail-fast 는 슬롯
//     조회가 아니라 resolveModel 경로의 계약이다).
//   - llmProviderConfigId 가 null 인 미설정 슬롯도 응답에서 걸러지지 않는다.
//   - User tier 는 403, SuperAdmin 은 RolesGuard escalation 으로 200(과차단 없음).
//   - 401 / 403 body 에 슬롯 데이터가 새지 않는다.
//
// 실 DB 전략(ADR-0004): mock override 0. createAuthenticatedE2EApp 가 AppModule
// 부트스트랩 + actor seed, PrismaService 가 실 connection. DifficultyMapping 과
// LlmProviderConfig 는 test/helpers/db-truncate.ts 의 TRUNCATE_TABLES 8 테이블 명단에
// 없으므로(unevaluated-fill-run.e2e-spec.ts 선례) afterEach 에서 자식→부모 순으로
// 직접 deleteMany 한다(FK onDelete: Restrict 라 역순은 실패). 로컬 DATABASE_URL
// 부재 시 CI 의 pnpm test:e2e(R-113) 에서만 실행된다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { DIFFICULTIES } from "../../src/llm/difficulty";
import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const MAPPINGS_URL = "/api/llm/difficulty-mappings";

// DifficultyMapping row 가 응답에 노출하는 5 key(prisma model 그대로 raw forward).
const MAPPING_FIELDS = [
  "id",
  "difficulty",
  "llmProviderConfigId",
  "createdAt",
  "updatedAt",
] as const;

// LlmProviderConfig 필수 4 필드 — 실 LLM 호출 0(본 spec 은 DB + HTTP 계약만 다룬다).
const SEED_LLM_CONFIG = {
  provider: "openai",
  endpointUrl: "https://example.test/v1",
  apiKey: "e2e-dummy-key",
  modelId: "gpt-test",
};

describe("E2E: GET /api/llm/difficulty-mappings (T-1960, REQ-050)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User(403 tier 미달) / Admin(200) / SuperAdmin(escalation 200).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "difficulty-user-actor@e2e.test" },
      { role: "Admin", email: "difficulty-admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "difficulty-super-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["difficulty-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(
      ctx.tokens["difficulty-admin-actor@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["difficulty-super-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // 자식(DifficultyMapping) → 부모(LlmProviderConfig) 순서 고정 — 역순은 FK
    // onDelete: Restrict 에 걸려 실패한다.
    await prisma.difficultyMapping.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  });

  // 3 슬롯 seed — easy/medium 은 config FK 지정, hard 는 미설정(null) 상태로 둔다.
  async function seedThreeSlots(): Promise<{ configId: string }> {
    const config = await prisma.llmProviderConfig.create({
      data: SEED_LLM_CONFIG,
    });
    await prisma.difficultyMapping.createMany({
      data: [
        { difficulty: "easy", llmProviderConfigId: config.id },
        { difficulty: "medium", llmProviderConfigId: config.id },
        { difficulty: "hard", llmProviderConfigId: null },
      ],
    });
    return { configId: config.id };
  }

  // -- happy 200 (Admin, 3 슬롯 seed 후 전수 조회) --

  it("Admin 쿠키 + 3 슬롯 seed 시 200 + 배열 길이 3 + difficulty 집합 일치 + row 5 key 노출 (authed happy)", async () => {
    const { configId } = await seedThreeSlots();

    const response = await request(app.getHttpServer())
      .get(MAPPINGS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(3);
    // 정렬 보장이 없는 raw forward 계약이므로 집합으로 비교한다.
    expect(
      [
        ...response.body.map((m: { difficulty: string }) => m.difficulty),
      ].sort(),
    ).toEqual([...DIFFICULTIES].sort());
    response.body.forEach((mapping: Record<string, unknown>) => {
      MAPPING_FIELDS.forEach((f) => expect(mapping).toHaveProperty(f));
    });
    // FK 지정 슬롯 2 건은 seed 한 config 를 그대로 가리킨다.
    expect(
      response.body.filter(
        (m: { llmProviderConfigId: string | null }) =>
          m.llmProviderConfigId === configId,
      ),
    ).toHaveLength(2);
  });

  // -- 분기 cover (i): 슬롯 0 건 → 200 + [] (404 아님) --

  it("슬롯 row 0 건 상태에서 Admin 호출 시 200 + 빈 배열이고 404 가 아님 (branch — seed 전 조회도 정상 결과)", async () => {
    expect(await prisma.difficultyMapping.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .get(MAPPINGS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual([]);
  });

  // -- 분기 cover (ii): FK null 슬롯도 그대로 노출 --

  it("llmProviderConfigId 가 null 인 미설정 슬롯도 200 응답에 포함되어 null 그대로 노출 (branch — service 가 필터링하지 않음)", async () => {
    await seedThreeSlots();

    const response = await request(app.getHttpServer())
      .get(MAPPINGS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    const hard = response.body.find(
      (m: { difficulty: string }) => m.difficulty === "hard",
    );
    expect(hard).toBeDefined();
    expect(hard.llmProviderConfigId).toBeNull();
  });

  // -- negative (ii): SuperAdmin escalation → 200 (과차단 없음) --

  it("SuperAdmin 쿠키 시 200 + 3 슬롯 전수 반환 (negative — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    await seedThreeSlots();

    const response = await request(app.getHttpServer())
      .get(MAPPINGS_URL)
      .set("Cookie", superAdminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
  });

  // -- error path 401 (인증 부재) + 데이터 누출 0 --

  it("cookie 부재 시 401 이고 body 에 슬롯 데이터(difficulty 문자열) 미노출 (negative — JwtAuthGuard, 빈 배열 200 으로 뭉개지지 않음)", async () => {
    await seedThreeSlots();

    const response = await request(app.getHttpServer()).get(MAPPINGS_URL);

    expect(response.status).toBe(401);
    expect(Array.isArray(response.body)).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain("difficulty");
    // seed 한 3 슬롯은 그대로 남아 있다(조회 실패가 데이터를 건드리지 않는다).
    expect(await prisma.difficultyMapping.count()).toBe(3);
  });

  // -- negative (i): User tier 미달 403 + 데이터 누출 0 --

  it("User role 쿠키 시 403 이고 body 에 슬롯 데이터(difficulty 문자열) 미노출 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    await seedThreeSlots();

    const response = await request(app.getHttpServer())
      .get(MAPPINGS_URL)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
    expect(Array.isArray(response.body)).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain("difficulty");
    expect(await prisma.difficultyMapping.count()).toBe(3);
  });
});

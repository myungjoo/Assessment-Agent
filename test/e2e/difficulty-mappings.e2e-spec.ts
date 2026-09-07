// difficulty-mappings.e2e-spec.ts — GET /api/llm/difficulty-mappings 의 HTTP contract
// + RBAC tier enforce + 빈 슬롯 / null FK 분기 e2e (T-1960, REQ-050/REQ-049) 와
// PATCH /api/llm/difficulty-mappings/:difficulty 의 슬롯 재지정 계약 (T-1961).
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
// PATCH 축(T-1961)이 추가로 고정하는 계약:
//   - 실 config 지정은 200 + 갱신 body + DB 반영이고, 이미 FK 가 있는 슬롯의 재지정도
//     200 으로 덮어쓴다(409 아님).
//   - ADR-0011 §3 fail-fast — 미지원 난이도 400 / config 부재 404 / 슬롯 row 부재는
//     P2025 → 404 이며 upsert 로 새 슬롯을 만들지 않는다.
//   - 401 / 403 / 400 / 404 어느 실패 경로도 슬롯 FK 를 바꾸지 않는다(write 누출 0).
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

  // ==========================================================================
  // PATCH 축 (T-1961, REQ-050/REQ-049) — 같은 app 부트스트랩 / actor 쿠키 /
  // afterEach 정리를 그대로 쓰기 위해 GET describe 안에 중첩한다. beforeAll ·
  // afterEach · seedThreeSlots() 는 한 줄도 수정하지 않는 add-only 확장이다.
  // ==========================================================================
  describe("E2E: PATCH /api/llm/difficulty-mappings/:difficulty (T-1961, REQ-050/REQ-049)", () => {
    // 실재하지 않는 cuid 형태 id — service 의 config 사전 존재 검증(null) → 404 유도용.
    const MISSING_CONFIG_ID = "ckzzzzzzzzzzzzzzzzzzzzzzz";

    const patchUrl = (difficulty: string): string =>
      `${MAPPINGS_URL}/${difficulty}`;

    // 슬롯 FK 를 DB 에서 직접 재조회 — 실패 응답이 write 로 새지 않았음을 확인한다.
    // 슬롯 row 자체가 없으면 undefined(= FK null 상태와 구분) 를 돌려준다.
    async function readSlotFk(
      difficulty: string,
    ): Promise<string | null | undefined> {
      const row = await prisma.difficultyMapping.findFirst({
        where: { difficulty },
      });
      return row === null ? undefined : row.llmProviderConfigId;
    }

    // -- happy 200 (Admin, FK null 인 hard 슬롯에 실 config 지정) --

    it("Admin 쿠키로 FK null 인 hard 슬롯에 실 config id 지정 시 200 + 갱신 body + DB 반영 (authed happy)", async () => {
      const { configId } = await seedThreeSlots();
      expect(await readSlotFk("hard")).toBeNull();

      const response = await request(app.getHttpServer())
        .patch(patchUrl("hard"))
        .set("Cookie", adminCookie)
        .send({ llmProviderConfigId: configId });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body.difficulty).toBe("hard");
      expect(response.body.llmProviderConfigId).toBe(configId);
      MAPPING_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
      expect(await readSlotFk("hard")).toBe(configId);
    });

    // -- error path (i): 지정 config 부재 → 404 (ADR-0011 §3 fail-fast) --

    it("존재하지 않는 llmProviderConfigId 지정 시 404 이고 hard 슬롯 FK 는 null 유지 (error — config 사전 존재 검증)", async () => {
      await seedThreeSlots();

      const response = await request(app.getHttpServer())
        .patch(patchUrl("hard"))
        .set("Cookie", adminCookie)
        .send({ llmProviderConfigId: MISSING_CONFIG_ID });

      expect(response.status).toBe(404);
      expect(await readSlotFk("hard")).toBeNull();
    });

    // -- error path (ii): 슬롯 row 부재 → P2025 → 404 (upsert 아님) --

    it("슬롯 row 가 없는 상태에서 실 config 지정 시 P2025 가 404 로 전파되고 슬롯이 새로 생기지 않음 (error — upsert 아님)", async () => {
      const config = await prisma.llmProviderConfig.create({
        data: SEED_LLM_CONFIG,
      });
      expect(await prisma.difficultyMapping.count()).toBe(0);

      const response = await request(app.getHttpServer())
        .patch(patchUrl("medium"))
        .set("Cookie", adminCookie)
        .send({ llmProviderConfigId: config.id });

      expect(response.status).toBe(404);
      expect(await prisma.difficultyMapping.count()).toBe(0);
    });

    // -- 분기 cover (i): 미지원 난이도 path param → 400 --

    it("미지원 난이도 path param(대문자 Easy / trivial) 은 각각 400 이고 easy 슬롯 FK 불변 (branch — isDifficulty 400 변환)", async () => {
      const { configId } = await seedThreeSlots();

      for (const unsupported of ["Easy", "trivial"]) {
        const response = await request(app.getHttpServer())
          .patch(patchUrl(unsupported))
          .set("Cookie", adminCookie)
          .send({ llmProviderConfigId: configId });

        expect(response.status).toBe(400);
      }

      expect(await readSlotFk("easy")).toBe(configId);
    });

    // -- 분기 cover (ii): DTO 위반 3 종 → 400 (ValidationPipe) --

    it("DTO 위반 3 종(필드 누락 / 빈 문자열 / whitelist 밖 extra 키)은 모두 400 이고 hard 슬롯 FK 는 null 유지 (branch — ValidationPipe)", async () => {
      const { configId } = await seedThreeSlots();

      const invalidBodies: Record<string, unknown>[] = [
        {},
        { llmProviderConfigId: "" },
        { llmProviderConfigId: configId, provider: "openai" },
      ];

      for (const body of invalidBodies) {
        const response = await request(app.getHttpServer())
          .patch(patchUrl("hard"))
          .set("Cookie", adminCookie)
          .send(body);

        expect(response.status).toBe(400);
      }

      expect(await readSlotFk("hard")).toBeNull();
    });

    // -- 분기 cover (iii): 이미 FK 가 설정된 슬롯의 재지정도 200 (overwrite) --

    it("이미 FK 가 설정된 easy 슬롯에 다른 config 를 재지정해도 200 이고 같은 값 재전송도 200 (branch — idempotent overwrite)", async () => {
      const { configId } = await seedThreeSlots();
      const other = await prisma.llmProviderConfig.create({
        data: { ...SEED_LLM_CONFIG, modelId: "gpt-test-2" },
      });
      expect(await readSlotFk("easy")).toBe(configId);

      const response = await request(app.getHttpServer())
        .patch(patchUrl("easy"))
        .set("Cookie", adminCookie)
        .send({ llmProviderConfigId: other.id });

      expect(response.status).toBe(200);
      expect(response.body.llmProviderConfigId).toBe(other.id);
      expect(await readSlotFk("easy")).toBe(other.id);

      const again = await request(app.getHttpServer())
        .patch(patchUrl("easy"))
        .set("Cookie", adminCookie)
        .send({ llmProviderConfigId: other.id });

      expect(again.status).toBe(200);
      expect(await readSlotFk("easy")).toBe(other.id);
    });

    // -- negative (i): 인증 부재 401 + write 누출 0 --

    it("cookie 부재 시 401 이고 hard 슬롯 FK 가 null 그대로 (negative — JwtAuthGuard 가 write 앞에서 차단)", async () => {
      const { configId } = await seedThreeSlots();

      const response = await request(app.getHttpServer())
        .patch(patchUrl("hard"))
        .send({ llmProviderConfigId: configId });

      expect(response.status).toBe(401);
      expect(await readSlotFk("hard")).toBeNull();
    });

    // -- negative (ii): User tier 미달 403 + write 누출 0 --

    it("User role 쿠키 시 403 이고 body 에 FK 미노출 + hard 슬롯 FK 가 null 그대로 (negative — Admin+ tier 미달)", async () => {
      const { configId } = await seedThreeSlots();

      const response = await request(app.getHttpServer())
        .patch(patchUrl("hard"))
        .set("Cookie", userCookie)
        .send({ llmProviderConfigId: configId });

      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(
        "llmProviderConfigId",
      );
      expect(await readSlotFk("hard")).toBeNull();
    });

    // -- negative (iii): SuperAdmin escalation → 200 (과차단 없음) --

    it("SuperAdmin 쿠키 시 200 + DB 반영 (negative — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
      const { configId } = await seedThreeSlots();

      const response = await request(app.getHttpServer())
        .patch(patchUrl("hard"))
        .set("Cookie", superAdminCookie)
        .send({ llmProviderConfigId: configId });

      expect(response.status).toBe(200);
      expect(await readSlotFk("hard")).toBe(configId);
    });
  });
});

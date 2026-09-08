// llm-provider-configs.e2e-spec.ts — GET /api/llm/providers 목록 조회의 HTTP
// contract + apiKey 미노출 invariant + RBAC tier enforce e2e (T-1967, REQ-051/REQ-043).
// difficulty-mappings.e2e-spec.ts(T-1960) 패턴 1:1 mirror.
//
// 책임: LlmProviderConfigController(@Get(), Admin+ tier) → LlmProviderConfigService
// .findAll(sanitize 명시 pick + isDefault 파생) → repository.findMany 의 실 배선을
// end-to-end 로 고정한다. 단위 분기는 각 service / controller spec 책임.
//
// 고정하는 계약 4 가지:
//   - 등록 row 가 있으면 200 + view 7 key(id / provider / endpointUrl / modelId /
//     createdAt / updatedAt / isDefault)를 모두 노출한다.
//   - **ADR-0014 §3 never-read-back** — 응답 어느 row 에도 `apiKey` 키가 없고, 실
//     응답 본문 문자열에 seed 한 apiKey 원문이 등장하지 않는다. service 의 sanitize
//     가 명시 pick 에서 전체 row spread 로 회귀하면 여기서 red 가 된다.
//   - 등록 0 건 조회는 200 + [] 이며 404 가 아니다(컬렉션 조회의 정상 결과).
//   - User tier 는 403, SuperAdmin 은 RolesGuard escalation 으로 200(과차단 없음),
//     cookie 부재 · 변조 JWT 는 401 이며 어느 실패 경로도 config 데이터를 흘리지 않는다.
//
// 실 DB 전략(ADR-0004): mock override 0. createAuthenticatedE2EApp 가 AppModule
// 부트스트랩 + actor seed, PrismaService 가 실 connection. LlmProviderConfig 와
// LlmDefaultProvider 는 test/helpers/db-truncate.ts 의 TRUNCATE_TABLES 8 테이블
// 명단에 없으므로 afterEach 에서 자식→부모 순으로 직접 deleteMany 한다(FK
// onDelete: Restrict 라 역순은 실패). 로컬 DATABASE_URL 부재 시 CI 의
// pnpm test:e2e(R-113) 에서만 실행된다.
//
// apiKey seed 는 평문 문자열이다 — 본 spec 은 prisma 직접 create 로 row 를 넣으므로
// service 의 암호화 경로(ADR-0014 §1)를 거치지 않는다. 읽기 경로는 never-decrypt 라
// 저장 형식과 무관하게 "원문이 응답에 없음" 만 검증하면 invariant 가 성립한다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const PROVIDERS_URL = "/api/llm/providers";

// LlmProviderConfigView 가 노출하는 7 key — apiKey 를 제외한 6 컬럼 + 파생 isDefault.
const VIEW_FIELDS = [
  "id",
  "provider",
  "endpointUrl",
  "modelId",
  "createdAt",
  "updatedAt",
  "isDefault",
] as const;

// seed 한 apiKey 원문 2 개 — 응답 본문 문자열에 이 값이 등장하면 누출이다.
// 다른 필드 값과 겹치지 않는 고유 토큰으로 둬서 오탐 0.
const SECRET_A = "e2e-secret-apikey-alpha-8f21";
const SECRET_B = "e2e-secret-apikey-bravo-4c07";

describe("E2E: GET /api/llm/providers (T-1967, REQ-051/REQ-043)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User(403 tier 미달) / Admin(200) / SuperAdmin(escalation 200).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "llm-provider-user-actor@e2e.test" },
      { role: "Admin", email: "llm-provider-admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "llm-provider-super-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(
      ctx.tokens["llm-provider-user-actor@e2e.test"],
    );
    adminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-admin-actor@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-super-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // 자식(LlmDefaultProvider) → 부모(LlmProviderConfig) 순서 고정 — 역순은 FK
    // onDelete: Restrict 에 걸려 실패한다.
    await prisma.llmDefaultProvider.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  });

  // config 2 건 seed — provider / endpointUrl / modelId 는 서로 다른 값으로 둬서
  // 목록이 특정 row 만 흘리는 회귀도 잡는다.
  async function seedTwoConfigs(): Promise<{ idA: string; idB: string }> {
    const a = await prisma.llmProviderConfig.create({
      data: {
        provider: "openai",
        endpointUrl: "https://alpha.example.test/v1",
        apiKey: SECRET_A,
        modelId: "gpt-alpha",
      },
    });
    const b = await prisma.llmProviderConfig.create({
      data: {
        provider: "anthropic",
        endpointUrl: "https://bravo.example.test/v1",
        apiKey: SECRET_B,
        modelId: "claude-bravo",
      },
    });
    return { idA: a.id, idB: b.id };
  }

  // -- happy 200 (Admin, config 2 건 seed 후 전수 조회) --

  it("Admin 쿠키 + config 2 건 seed 시 200 + JSON + 배열 길이 2 + row 7 key 전수 노출 (authed happy)", async () => {
    const { idA, idB } = await seedTwoConfigs();

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    // 정렬 보장이 없는 raw forward 계약이므로 id 는 집합으로 비교한다.
    expect([...response.body.map((c: { id: string }) => c.id)].sort()).toEqual(
      [idA, idB].sort(),
    );
    response.body.forEach((config: Record<string, unknown>) => {
      VIEW_FIELDS.forEach((f) => expect(config).toHaveProperty(f));
      // 기본 슬롯을 seed 하지 않았으므로 파생 isDefault 는 전부 false.
      expect(config.isDefault).toBe(false);
    });
  });

  // -- 보안 invariant (본 slice 의 핵심): apiKey 미노출 (ADR-0014 §3) --

  it("200 응답의 모든 row 에 apiKey 키가 없고 본문 문자열에 seed 한 apiKey 원문이 없음 (security — never-read-back, sanitize 명시 pick 회귀 감지)", async () => {
    await seedTwoConfigs();

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    response.body.forEach((config: Record<string, unknown>) => {
      expect(config).not.toHaveProperty("apiKey");
      // view 7 key 정확히 — 미래에 새 secret 컬럼이 spread 로 새어도 red.
      expect(Object.keys(config).sort()).toEqual([...VIEW_FIELDS].sort());
    });
    // 직렬화 본문 전수 검사 — 중첩 위치에 숨어도 잡는다.
    expect(response.text).not.toContain(SECRET_A);
    expect(response.text).not.toContain(SECRET_B);
    expect(JSON.stringify(response.body)).not.toContain("apiKey");
  });

  // -- 분기 cover (i): config 0 건 → 200 + [] (404 아님) --

  it("config row 0 건 상태에서 Admin 호출 시 200 + 빈 배열이고 404 가 아님 (branch — seed 전 조회도 정상 결과)", async () => {
    expect(await prisma.llmProviderConfig.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual([]);
  });

  // -- 분기 cover (ii): SuperAdmin escalation → 200 (과차단 없음) --

  it("SuperAdmin 쿠키 시 200 + config 2 건 전수 반환 (branch — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    await seedTwoConfigs();

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", superAdminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.text).not.toContain(SECRET_A);
  });

  // -- negative (i): User tier 미달 403 + 데이터 누출 0 --

  it("User role 쿠키 시 403 이고 body 에 config 데이터 · apiKey 미노출 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    await seedTwoConfigs();

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
    expect(Array.isArray(response.body)).toBe(false);
    expect(response.text).not.toContain(SECRET_A);
    expect(response.text).not.toContain("endpointUrl");
    // 조회 실패가 데이터를 건드리지 않는다.
    expect(await prisma.llmProviderConfig.count()).toBe(2);
  });

  // -- negative (ii): 인증 부재 401 --

  it("cookie 부재 시 401 이고 빈 배열 200 으로 뭉개지지 않음 (negative — JwtAuthGuard 인증 부재 분기)", async () => {
    await seedTwoConfigs();

    const response = await request(app.getHttpServer()).get(PROVIDERS_URL);

    expect(response.status).toBe(401);
    expect(Array.isArray(response.body)).toBe(false);
    expect(response.text).not.toContain(SECRET_A);
    expect(await prisma.llmProviderConfig.count()).toBe(2);
  });

  // -- negative (iii): 변조 자격증명 401 --

  it("유효하지 않은 JWT 문자열 쿠키 시 401 (negative — JwtAuthGuard 검증 실패 분기, 쿠키 존재 != 통과)", async () => {
    await seedTwoConfigs();

    const response = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", buildAuthCookie("not-a-valid-jwt.tampered.signature"));

    expect(response.status).toBe(401);
    expect(Array.isArray(response.body)).toBe(false);
    expect(response.text).not.toContain(SECRET_A);
  });
});

// -- T-1970: 단건 조회 · 삭제 (:id) 축 ---------------------------------------
// 위 목록 describe(T-1967) 는 무수정으로 두고 같은 파일에 `:id` 2 route 의 실 HTTP
// 왕복을 잇는다. users.e2e-spec.ts 선례대로 top-level describe 마다 자기 app 을
// 부트스트랩한다(앞 describe 의 afterAll 이 app 을 닫은 뒤 실행되므로 안전).
//
// 고정하는 계약 5 가지:
//   - GET :id 200 은 view 7 key 를 정확히 노출하고 값이 seed 값과 일치한다.
//   - DELETE :id 는 204 + body 0 이며 실제로 row 가 사라진다(직후 GET 404 + count 0).
//   - **ADR-0014 §3 never-read-back** — 단건 200 에 `apiKey` 키가 없고 응답 본문에
//     seed apiKey 원문이 없으며, 204 삭제 응답 본문에도 config 필드가 0 개다.
//   - 부재 id 는 GET(null→404) · DELETE(P2025→404) 모두 404 이며 다른 config 를
//     흘리지 않고, DELETE 404 뒤에도 기존 row 는 잔존한다.
//   - **기본 슬롯이 가리키는 config 의 DELETE 는 409**(P2003→ConflictException) 이며
//     config 와 슬롯이 둘 다 잔존한다 — schema 의 `onDelete: Restrict`(ADR-0062
//     §Decision 2)가 Cascade / SetNull 로 회귀하면 여기서 red 가 된다.
describe("E2E: GET/DELETE /api/llm/providers/:id (T-1970, REQ-051/REQ-043)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "llm-provider-byid-user@e2e.test" },
      { role: "Admin", email: "llm-provider-byid-admin@e2e.test" },
      { role: "SuperAdmin", email: "llm-provider-byid-super@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["llm-provider-byid-user@e2e.test"]);
    adminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-byid-admin@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-byid-super@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // 자식(LlmDefaultProvider) → 부모(LlmProviderConfig) 순서 고정.
    await prisma.llmDefaultProvider.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  });

  // 단건 축은 대상 row 1 개면 충분하다 — id 를 돌려받아 경로에 끼운다.
  async function seedConfig(): Promise<string> {
    const row = await prisma.llmProviderConfig.create({
      data: {
        provider: "openai",
        endpointUrl: "https://alpha.example.test/v1",
        apiKey: SECRET_A,
        modelId: "gpt-alpha",
      },
    });
    return row.id;
  }

  // 어떤 seed row 와도 겹치지 않는 부재 id — 404 분기 입력.
  const ABSENT_ID = "cle2eabsent000000000000000";

  // -- happy (i): 단건 조회 200 --

  it("Admin 쿠키 + seed 한 id 로 GET 시 200 + view 7 key 정확히 + 값이 seed 와 일치 (authed happy)", async () => {
    const id = await seedConfig();

    const response = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Object.keys(response.body).sort()).toEqual([...VIEW_FIELDS].sort());
    expect(response.body).toMatchObject({
      id,
      provider: "openai",
      endpointUrl: "https://alpha.example.test/v1",
      modelId: "gpt-alpha",
    });
  });

  // -- happy (ii): 삭제 204 + 실 삭제 확인 --

  it("Admin 쿠키로 DELETE 시 204 + 빈 body 이고 직후 GET 이 404 · count 0 (authed happy — 실 삭제 확인)", async () => {
    const id = await seedConfig();

    const deleted = await request(app.getHttpServer())
      .delete(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const after = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(after.status).toBe(404);
    expect(await prisma.llmProviderConfig.count()).toBe(0);
  });

  // -- 보안 invariant: never-read-back (ADR-0014 §3) --

  it("200 단건 응답에 apiKey 키·원문이 없고 204 삭제 응답 본문에도 config 필드가 0 개 (security — never-read-back)", async () => {
    const id = await seedConfig();

    const view = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(view.status).toBe(200);
    expect(view.body).not.toHaveProperty("apiKey");
    expect(view.text).not.toContain(SECRET_A);
    expect(JSON.stringify(view.body)).not.toContain("apiKey");

    const deleted = await request(app.getHttpServer())
      .delete(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(deleted.status).toBe(204);
    expect(deleted.text).not.toContain(SECRET_A);
    expect(Object.keys(deleted.body)).toHaveLength(0);
  });

  // -- 분기 (i): 파생 isDefault 2 종 (ADR-0062 §Decision 2) --

  it("기본 슬롯 미지정 GET :id 는 isDefault:false, 같은 config 를 가리키는 슬롯 seed 후엔 true (branch — 파생 2 종)", async () => {
    const id = await seedConfig();

    const before = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(before.status).toBe(200);
    expect(before.body.isDefault).toBe(false);

    await prisma.llmDefaultProvider.create({
      data: { llmProviderConfigId: id },
    });

    const after = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(after.status).toBe(200);
    expect(after.body.isDefault).toBe(true);
  });

  // -- error path: 404 2 종 (GET null→404 / DELETE P2025→404) --

  it("부재 id 의 GET·DELETE 는 모두 404 이고 다른 config 를 흘리지 않으며 기존 row 는 잔존 (error path)", async () => {
    await seedConfig();

    const getMissing = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${ABSENT_ID}`)
      .set("Cookie", adminCookie);

    expect(getMissing.status).toBe(404);
    expect(getMissing.text).not.toContain(SECRET_A);
    expect(getMissing.text).not.toContain("alpha.example.test");

    const deleteMissing = await request(app.getHttpServer())
      .delete(`${PROVIDERS_URL}/${ABSENT_ID}`)
      .set("Cookie", adminCookie);

    expect(deleteMissing.status).toBe(404);
    expect(deleteMissing.text).not.toContain(SECRET_A);
    // 실패한 삭제가 다른 row 를 지우지 않는다.
    expect(await prisma.llmProviderConfig.count()).toBe(1);
  });

  // -- 분기 (ii, 핵심): 기본 슬롯 점유 config 삭제 → 409 (P2003, Restrict 회귀 감지) --

  it("기본 슬롯이 가리키는 config 를 DELETE 하면 409 이고 config·슬롯이 둘 다 잔존 (branch — P2003→409, onDelete: Restrict)", async () => {
    const id = await seedConfig();
    await prisma.llmDefaultProvider.create({
      data: { llmProviderConfigId: id },
    });

    const response = await request(app.getHttpServer())
      .delete(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(response.text).not.toContain(SECRET_A);
    expect(await prisma.llmProviderConfig.count()).toBe(1);
    expect(await prisma.llmDefaultProvider.count()).toBe(1);
  });

  // -- 분기 (iii): SuperAdmin escalation (과차단 0) --

  it("SuperAdmin 쿠키의 GET :id 는 200 (branch — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    const id = await seedConfig();

    const response = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${id}`)
      .set("Cookie", superAdminCookie);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(id);
    expect(response.text).not.toContain(SECRET_A);
  });

  // -- negative: 2 route × 3 인증 조건 = 6 케이스 (객체 표 + $routeLabel) --

  const ID_ROUTES: { routeLabel: string; method: "get" | "delete" }[] = [
    { routeLabel: "GET :id", method: "get" },
    { routeLabel: "DELETE :id", method: "delete" },
  ];

  const AUTH_CONDS: {
    condLabel: string;
    kind: "user" | "none" | "tampered";
    expected: number;
  }[] = [
    { condLabel: "User 쿠키(tier 미달)", kind: "user", expected: 403 },
    { condLabel: "쿠키 부재", kind: "none", expected: 401 },
    { condLabel: "변조 JWT 쿠키", kind: "tampered", expected: 401 },
  ];

  const RBAC_CASES = ID_ROUTES.flatMap((route) =>
    AUTH_CONDS.map((cond) => ({ ...route, ...cond })),
  );

  it.each(RBAC_CASES)(
    "$routeLabel 를 $condLabel 로 호출하면 $expected 이고 config 데이터 미노출 · row 잔존 (negative — JwtAuthGuard/RolesGuard)",
    async ({ method, kind, expected }) => {
      const id = await seedConfig();
      const cookie =
        kind === "user"
          ? userCookie
          : kind === "tampered"
            ? buildAuthCookie("not-a-valid-jwt.tampered.signature")
            : undefined;

      const pending = request(app.getHttpServer())[method](
        `${PROVIDERS_URL}/${id}`,
      );
      const response = await (cookie ? pending.set("Cookie", cookie) : pending);

      expect(response.status).toBe(expected);
      expect(response.text).not.toContain(SECRET_A);
      expect(response.text).not.toContain("endpointUrl");
      // 실패 경로는 데이터를 건드리지 않는다 — DELETE 실패 뒤에도 row 잔존.
      expect(await prisma.llmProviderConfig.count()).toBe(1);
    },
  );
});

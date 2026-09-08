// llm-provider-configs.e2e-spec.ts — GET /api/llm/providers 목록 조회의 HTTP
// contract + apiKey 미노출 invariant + RBAC tier enforce e2e (T-1967, REQ-051/REQ-043).
// difficulty-mappings.e2e-spec.ts(T-1960) 패턴 1:1 mirror.
// 파일 하단에 T-1970 이 같은 controller 의 `:id` 단건 조회 · 삭제 축 describe 를,
// T-1972 가 생성(POST) · T-1973 이 부분 갱신(PATCH) 축 describe 를 잇는다 (top-level
// describe 4 개, 각자 app 부트스트랩). 쓰기 축만 spec-local 일회용 키를 env 에 주입해
// 실 암호화 저장 왕복(ADR-0014 §1)까지 검증한다.
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
import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
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

// -- T-1972: 생성(POST) 축 상수 (기존 describe 의 상수는 무수정) --------------
// 암호화 키 env var 이름 — 실 secret 값 0 (ADR-0014 §2 / CLAUDE.md §9).
const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";

// POST 로 보내는 apiKey 원문 — 응답 · 목록 · DB 컬럼 어디서 보여도 누출 또는 평문
// 저장이다. 위 seed 토큰(SECRET_A/B)과 겹치지 않는 고유 값.
const SECRET_CREATE = "e2e-secret-apikey-create-9d13";

// 4 필드 allow-list 를 채운 유효 payload — negative 케이스들의 baseline.
const VALID_CREATE_PAYLOAD = {
  provider: "openai",
  endpointUrl: "https://create.example.test/v1",
  apiKey: SECRET_CREATE,
  modelId: "gpt-create",
} as const;

// ValidationPipe(whitelist + forbidNonWhitelisted) 가 400 으로 막아야 하는 4 종 —
// 라벨만 test 이름에 쓰고 본문 객체는 덤프하지 않는다.
const INVALID_CREATE_BODIES: {
  caseLabel: string;
  body: Record<string, unknown>;
}[] = [
  {
    caseLabel: "provider 필드 누락",
    body: {
      endpointUrl: VALID_CREATE_PAYLOAD.endpointUrl,
      apiKey: SECRET_CREATE,
      modelId: VALID_CREATE_PAYLOAD.modelId,
    },
  },
  {
    caseLabel: "apiKey 가 빈 문자열",
    body: { ...VALID_CREATE_PAYLOAD, apiKey: "" },
  },
  {
    caseLabel: "modelId 가 wrong type(number)",
    body: { ...VALID_CREATE_PAYLOAD, modelId: 123 },
  },
  {
    caseLabel: "allow-list 밖 키 포함(unexpectedField)",
    body: { ...VALID_CREATE_PAYLOAD, unexpectedField: "x" },
  },
];

// 인증 3 조건 — 기대 status 를 표로 박제한다.
const CREATE_RBAC_CASES: {
  condLabel: string;
  kind: "user" | "none" | "tampered";
  expected: number;
}[] = [
  { condLabel: "User 쿠키(tier 미달)", kind: "user", expected: 403 },
  { condLabel: "쿠키 부재", kind: "none", expected: 401 },
  { condLabel: "변조 JWT 쿠키", kind: "tampered", expected: 401 },
];

// -- T-1972: 생성(POST) 축 ----------------------------------------------------
// 위 두 describe(T-1967 목록 · T-1970 `:id`) 는 무수정으로 두고 쓰기 축의 첫 route
// 인 POST 의 실 HTTP 왕복을 잇는다(자기 app 부트스트랩).
//
// 키 주입 전략(ADR-0014 §2): resolveKey 는 **호출 시점마다** process.env 를 읽으므로
// (부트스트랩 캡처 아님) beforeAll 이 randomBytes(32) 일회용 키를 env 에 넣고
// afterAll 이 원값(부재였으면 부재)으로 복원한다. confluence-token-decrypt.spec.ts
// 의 withEnvKey 패턴 mirror — 리터럴 키 0, CI env · 워크플로 · .env 변경 0.
//
// 고정하는 계약 4 가지:
//   - Admin POST 는 201 + view 7 key + isDefault false (자동 기본 승격 0, ADR-0062).
//   - **ADR-0014 §3 never-read-back** — 201 응답과 직후 목록 GET 어디에도 `apiKey`
//     키 · 요청 원문이 없다.
//   - **ADR-0014 §1 암호화 저장** — 영속 row 의 apiKey 가 평문과 다르고 decrypt
//     왕복이 평문과 일치한다. 평문 저장으로 회귀하면 red.
//   - 미지원 provider · ValidationPipe 위반 4 종 · 키 부재(500) · User 403 · 쿠키
//     부재/변조 401 은 모두 row 생성 0 이고, SuperAdmin 은 escalation 201.
describe("E2E: POST /api/llm/providers (T-1972, REQ-049/REQ-051/REQ-043)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cipher: LlmApiKeyCipher;
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;
  // beforeAll 시점 env 원값 — afterAll 이 복원한다(부재였으면 삭제).
  let previousEncKey: string | undefined;

  beforeAll(async () => {
    previousEncKey = process.env[ENC_KEY_ENV];
    // 일회용 32-byte AES-256 키(base64) — 리포지토리에 남는 secret 0.
    process.env[ENC_KEY_ENV] = randomBytes(32).toString("base64");

    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "llm-provider-post-user@e2e.test" },
      { role: "Admin", email: "llm-provider-post-admin@e2e.test" },
      { role: "SuperAdmin", email: "llm-provider-post-super@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    cipher = app.get(LlmApiKeyCipher); // 배선과 같은 env 키로 왕복 검증.
    userCookie = buildAuthCookie(ctx.tokens["llm-provider-post-user@e2e.test"]);
    adminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-post-admin@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-post-super@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    if (previousEncKey === undefined) {
      delete process.env[ENC_KEY_ENV];
    } else {
      process.env[ENC_KEY_ENV] = previousEncKey;
    }
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // 자식(LlmDefaultProvider) → 부모(LlmProviderConfig) 순서 고정.
    await prisma.llmDefaultProvider.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  });

  // -- happy (i): 201 + view 7 key + isDefault false --

  it("Admin 쿠키로 POST 시 201 + view 7 key 정확히 + isDefault:false (authed happy)", async () => {
    const response = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", adminCookie)
      .send(VALID_CREATE_PAYLOAD);

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Object.keys(response.body).sort()).toEqual([...VIEW_FIELDS].sort());
    expect(response.body).toMatchObject({
      provider: "openai",
      endpointUrl: VALID_CREATE_PAYLOAD.endpointUrl,
      modelId: VALID_CREATE_PAYLOAD.modelId,
      isDefault: false,
    });
    expect(await prisma.llmProviderConfig.count()).toBe(1);
  });

  // -- 보안 invariant (i): never-read-back (ADR-0014 §3) --

  it("201 응답에 apiKey 키가 없고 본문 문자열에도 요청한 apiKey 원문이 없음 (security — never-read-back)", async () => {
    const response = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", adminCookie)
      .send(VALID_CREATE_PAYLOAD);

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("apiKey");
    expect(JSON.stringify(response.body)).not.toContain("apiKey");
    // ciphertext 조차 흘리지 않는다 — 직렬화 본문 전수 검사.
    expect(response.text).not.toContain(SECRET_CREATE);
  });

  // -- 보안 invariant (ii): 암호화 저장 왕복 (ADR-0014 §1) --
  it("영속된 row 의 apiKey 가 평문과 다르고 cipher.decrypt 왕복이 평문과 일치 (security — 평문 저장 회귀 감지)", async () => {
    const response = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", adminCookie)
      .send(VALID_CREATE_PAYLOAD);

    expect(response.status).toBe(201);

    const row = await prisma.llmProviderConfig.findUnique({
      where: { id: response.body.id as string },
    });

    expect(row).not.toBeNull();
    // 평문 그대로 저장되면 여기서 red — encrypt 배선 우회 회귀 감지 지점.
    expect(row?.apiKey).not.toBe(SECRET_CREATE);
    expect(cipher.decrypt(row?.apiKey ?? "")).toBe(SECRET_CREATE);
  });

  // -- happy (ii): 소비처 연결 — 생성 직후 목록 조회 --
  it("생성 직후 같은 Admin 쿠키의 목록 GET 이 200 + 정확히 1 건이고 본문에 apiKey 원문 없음 (happy — 쓰기→읽기 연결)", async () => {
    const created = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", adminCookie)
      .send(VALID_CREATE_PAYLOAD);

    expect(created.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get(PROVIDERS_URL)
      .set("Cookie", adminCookie);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]).not.toHaveProperty("apiKey");
    expect(list.text).not.toContain(SECRET_CREATE);
  });

  // -- error path (i): 미지원 provider → 400 (service isLlmProvider) --
  it("허용 집합 밖 provider literal 은 400 이고 row 가 생성되지 않음 (error path — service isLlmProvider)", async () => {
    const response = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", adminCookie)
      .send({ ...VALID_CREATE_PAYLOAD, provider: "not_a_provider" });

    expect(response.status).toBe(400);
    expect(response.text).not.toContain(SECRET_CREATE);
    expect(await prisma.llmProviderConfig.count()).toBe(0);
  });

  // -- 분기: ValidationPipe negative 4 종 (whitelist + forbidNonWhitelisted) --
  it.each(INVALID_CREATE_BODIES)(
    "$caseLabel 인 본문은 400 이고 row 가 생성되지 않음 (branch — controller-scope ValidationPipe)",
    async ({ body }) => {
      const response = await request(app.getHttpServer())
        .post(PROVIDERS_URL)
        .set("Cookie", adminCookie)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.text).not.toContain(SECRET_CREATE);
      expect(await prisma.llmProviderConfig.count()).toBe(0);
    },
  );

  // -- error path (ii): 암호화 키 부재 fail-fast (ADR-0014 §2) --

  it("LLM_APIKEY_ENC_KEY 부재 상태의 POST 는 500 이고 평문 fallback 저장이 0 (error path — cipher fail-fast)", async () => {
    const held = process.env[ENC_KEY_ENV];
    delete process.env[ENC_KEY_ENV];
    try {
      const response = await request(app.getHttpServer())
        .post(PROVIDERS_URL)
        .set("Cookie", adminCookie)
        .send(VALID_CREATE_PAYLOAD);

      expect(response.status).toBe(500);
      expect(response.text).not.toContain(SECRET_CREATE);
      // encrypt throw 가 swallow 되어 평문이 영속되면 여기서 red.
      expect(await prisma.llmProviderConfig.count()).toBe(0);
    } finally {
      // 키를 즉시 복원 — 단언이 실패해도 후속 케이스로 새지 않는다.
      if (held === undefined) {
        delete process.env[ENC_KEY_ENV];
      } else {
        process.env[ENC_KEY_ENV] = held;
      }
    }
  });

  // -- negative: 인증 3 조건 (User 403 / 쿠키 부재 401 / 변조 JWT 401) --

  it.each(CREATE_RBAC_CASES)(
    "$condLabel 의 POST 는 $expected 이고 row 생성 0 · apiKey 원문 미노출 (negative — JwtAuthGuard/RolesGuard)",
    async ({ kind, expected }) => {
      const cookie =
        kind === "user"
          ? userCookie
          : kind === "tampered"
            ? buildAuthCookie("not-a-valid-jwt.tampered.signature")
            : undefined;

      const pending = request(app.getHttpServer()).post(PROVIDERS_URL);
      const response = await (
        cookie ? pending.set("Cookie", cookie) : pending
      ).send(VALID_CREATE_PAYLOAD);

      expect(response.status).toBe(expected);
      expect(response.text).not.toContain(SECRET_CREATE);
      expect(await prisma.llmProviderConfig.count()).toBe(0);
    },
  );

  // -- negative: 과차단 없음 — SuperAdmin escalation 201 --

  it("SuperAdmin 쿠키의 POST 는 201 (negative — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    const response = await request(app.getHttpServer())
      .post(PROVIDERS_URL)
      .set("Cookie", superAdminCookie)
      .send(VALID_CREATE_PAYLOAD);

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("apiKey");
    expect(await prisma.llmProviderConfig.count()).toBe(1);
  });
});

// -- T-1973: 부분 갱신(PATCH) 축 상수 (위 세 describe 의 상수는 무수정) ---------
// seed row 에 심는 apiKey 원문과 PATCH 로 새로 보내는 원문 — 둘 다 다른 값 · 다른
// 토큰이라 "재암호화됐다 / 기존 것이 유지됐다" 를 오탐 0 으로 갈라 볼 수 있다.
const SECRET_PATCH_SEED = "e2e-secret-apikey-patchseed-2a55";
const SECRET_PATCH_NEW = "e2e-secret-apikey-patchnew-7b90";

// seed row 의 초기 필드 — 미명시 필드 불변 단언의 기준값.
const PATCH_SEED_FIELDS = {
  provider: "openai",
  endpointUrl: "https://patch-seed.example.test/v1",
  modelId: "gpt-patch-seed",
} as const;

// ValidationPipe(whitelist + forbidNonWhitelisted + DTO decorator) 가 400 으로
// 막아야 하는 3 종 — 명시 필드 빈 문자열 / wrong type / allow-list 밖 키.
const INVALID_PATCH_BODIES: {
  caseLabel: string;
  body: Record<string, unknown>;
}[] = [
  { caseLabel: "명시한 modelId 가 빈 문자열", body: { modelId: "" } },
  { caseLabel: "endpointUrl 이 wrong type(number)", body: { endpointUrl: 42 } },
  {
    caseLabel: "allow-list 밖 키 포함(unexpectedField)",
    body: { modelId: "gpt-patched", unexpectedField: "x" },
  },
];

// 인증 3 조건 — 기대 status 를 표로 박제한다(POST 축 표 mirror).
const PATCH_RBAC_CASES: {
  condLabel: string;
  kind: "user" | "none" | "tampered";
  expected: number;
}[] = [
  { condLabel: "User 쿠키(tier 미달)", kind: "user", expected: 403 },
  { condLabel: "쿠키 부재", kind: "none", expected: 401 },
  { condLabel: "변조 JWT 쿠키", kind: "tampered", expected: 401 },
];

// 어떤 seed row 와도 겹치지 않는 부재 id — P2025→404 분기 입력.
const ABSENT_PATCH_ID = "cle2eabsentpatch0000000000";

// -- T-1973: 부분 갱신(PATCH) 축 ----------------------------------------------
// 위 세 describe(T-1967 목록 · T-1970 `:id` 조회·삭제 · T-1972 생성) 는 무수정으로
// 두고 쓰기 축의 두 번째 route 인 PATCH /:id 의 실 HTTP 왕복을 잇는다(자기 app
// 부트스트랩 + POST 축과 같은 spec-local 일회용 LLM_APIKEY_ENC_KEY 주입/복원).
//
// seed 는 POST route 를 거치지 않고 prisma.create + cipher.encrypt 로 직접 넣는다 —
// POST 가 깨져도 PATCH 축이 단독으로 red/green 을 판정하게 유지하기 위함.
//
// 고정하는 계약 5 가지:
//   - Admin PATCH 는 200 + view 7 key + 명시 필드만 교체, 미명시 필드 불변.
//   - **ADR-0014 §1 재암호화** — apiKey 를 명시하면 저장 ciphertext 가 새 평문과
//     다르고 decrypt 왕복이 새 평문과 일치한다(평문 저장 회귀 감지).
//   - **ADR-0014 §3 never-read-back** — apiKey 를 미명시하면 저장 ciphertext 가
//     바이트 동일하게 유지되고, 응답 어디에도 apiKey 키·원문이 없다.
//   - 미지원 provider 400 · 부재 id 404 · ValidationPipe 위반 3 종 400 은 모두 row
//     필드 불변이다.
//   - User 403 · 쿠키 부재/변조 401 도 row 불변이고, SuperAdmin 은 escalation 200.
describe("E2E: PATCH /api/llm/providers/:id (T-1973, REQ-049/REQ-051/REQ-043)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cipher: LlmApiKeyCipher;
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;
  let previousEncKey: string | undefined;
  // beforeEach 가 새로 심는 대상 row 의 id 와 그 시점 ciphertext 원본.
  let seedId: string;
  let seedCipherText: string;

  beforeAll(async () => {
    previousEncKey = process.env[ENC_KEY_ENV];
    process.env[ENC_KEY_ENV] = randomBytes(32).toString("base64");

    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "llm-provider-patch-user@e2e.test" },
      { role: "Admin", email: "llm-provider-patch-admin@e2e.test" },
      { role: "SuperAdmin", email: "llm-provider-patch-super@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    cipher = app.get(LlmApiKeyCipher);
    userCookie = buildAuthCookie(
      ctx.tokens["llm-provider-patch-user@e2e.test"],
    );
    adminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-patch-admin@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["llm-provider-patch-super@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    if (previousEncKey === undefined) {
      delete process.env[ENC_KEY_ENV];
    } else {
      process.env[ENC_KEY_ENV] = previousEncKey;
    }
  });

  // 갱신 대상 row 1 건 — POST route 경유 0, 실 배선과 같은 cipher 로 암호화한다.
  beforeEach(async () => {
    seedCipherText = cipher.encrypt(SECRET_PATCH_SEED);
    const row = await prisma.llmProviderConfig.create({
      data: { ...PATCH_SEED_FIELDS, apiKey: seedCipherText },
    });
    seedId = row.id;
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // 자식(LlmDefaultProvider) → 부모(LlmProviderConfig) 순서 고정.
    await prisma.llmDefaultProvider.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  });

  // 실패 경로 공통 단언 — 4 컬럼이 seed 시점 그대로여야 한다(부분 반영 0).
  async function expectSeedRowUnchanged(): Promise<void> {
    const row = await prisma.llmProviderConfig.findUnique({
      where: { id: seedId },
    });
    expect(row).toMatchObject(PATCH_SEED_FIELDS);
    expect(row?.apiKey).toBe(seedCipherText);
  }

  // -- happy (i): 200 + view 7 key + 명시 필드 교체 + 미명시 필드 불변 --

  it("Admin 쿠키로 modelId·endpointUrl 만 PATCH 하면 200 + view 7 key 정확히 + 미명시 provider 불변 (authed happy)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie)
      .send({
        modelId: "gpt-patched",
        endpointUrl: "https://patched.example.test/v1",
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Object.keys(response.body).sort()).toEqual([...VIEW_FIELDS].sort());
    expect(response.body).toMatchObject({
      id: seedId,
      modelId: "gpt-patched",
      endpointUrl: "https://patched.example.test/v1",
      // 요청에 없던 필드는 그대로 — partial data 구성이 전체 덮어쓰기로 회귀하면 red.
      provider: PATCH_SEED_FIELDS.provider,
    });
    expect(response.body).not.toHaveProperty("apiKey");
  });

  // -- happy (ii): 소비처 연결 — PATCH 직후 단건 GET 이 갱신값 반영 --

  it("PATCH 직후 같은 Admin 쿠키의 단건 GET 이 200 + 갱신값 반영이고 본문에 apiKey 원문 없음 (happy — 쓰기→읽기 연결)", async () => {
    const patched = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie)
      .send({ modelId: "gpt-patched-read" });

    expect(patched.status).toBe(200);

    const fetched = await request(app.getHttpServer())
      .get(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie);

    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({
      id: seedId,
      modelId: "gpt-patched-read",
    });
    expect(fetched.body).not.toHaveProperty("apiKey");
    expect(fetched.text).not.toContain(SECRET_PATCH_SEED);
  });

  // -- 분기 (i): apiKey 명시 → 재암호화 (ADR-0014 §1) --

  it("apiKey 를 명시한 PATCH 는 저장 ciphertext 를 새 평문으로 재암호화하고 응답에 평문이 없음 (branch — apiKey 명시)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie)
      .send({ apiKey: SECRET_PATCH_NEW });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("apiKey");
    expect(response.text).not.toContain(SECRET_PATCH_NEW);

    const row = await prisma.llmProviderConfig.findUnique({
      where: { id: seedId },
    });

    // 평문 그대로 저장되면 여기서 red — encrypt 배선 우회 회귀 감지 지점.
    expect(row?.apiKey).not.toBe(SECRET_PATCH_NEW);
    expect(row?.apiKey).not.toBe(seedCipherText);
    expect(cipher.decrypt(row?.apiKey ?? "")).toBe(SECRET_PATCH_NEW);
  });

  // -- 분기 (ii): apiKey 미명시 → 기존 ciphertext 유지 (ADR-0014 §3) --

  it("apiKey 미명시 PATCH 는 저장 ciphertext 를 바이트 동일하게 유지하고 다른 필드만 갱신 (branch — apiKey 부재)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie)
      .send({ modelId: "gpt-keep-key" });

    expect(response.status).toBe(200);

    const row = await prisma.llmProviderConfig.findUnique({
      where: { id: seedId },
    });

    // 재암호화도 평문 덮어쓰기도 없어야 한다 — 문자열 바이트 동일.
    expect(row?.apiKey).toBe(seedCipherText);
    expect(cipher.decrypt(row?.apiKey ?? "")).toBe(SECRET_PATCH_SEED);
    expect(row?.modelId).toBe("gpt-keep-key");
  });

  // -- error path (i): 미지원 provider → 400 (service isLlmProvider) --

  it("허용 집합 밖 provider literal 은 400 이고 row 필드가 불변 (error path — service isLlmProvider)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", adminCookie)
      .send({ provider: "not_a_provider", modelId: "gpt-should-not-apply" });

    expect(response.status).toBe(400);
    await expectSeedRowUnchanged();
  });

  // -- error path (ii): 부재 id → 404 (P2025 변환) --

  it("부재 id 로 PATCH 하면 404 이고 기존 row 가 불변 (error path — P2025→404)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${ABSENT_PATCH_ID}`)
      .set("Cookie", adminCookie)
      .send({ modelId: "gpt-absent" });

    expect(response.status).toBe(404);
    await expectSeedRowUnchanged();
  });

  // -- negative: ValidationPipe 3 종 (whitelist + forbidNonWhitelisted + DTO) --

  it.each(INVALID_PATCH_BODIES)(
    "$caseLabel 인 본문은 400 이고 row 필드가 불변 (negative — controller-scope ValidationPipe)",
    async ({ body }) => {
      const response = await request(app.getHttpServer())
        .patch(`${PROVIDERS_URL}/${seedId}`)
        .set("Cookie", adminCookie)
        .send(body);

      expect(response.status).toBe(400);
      await expectSeedRowUnchanged();
    },
  );

  // -- negative: 인증 3 조건 (User 403 / 쿠키 부재 401 / 변조 JWT 401) --

  it.each(PATCH_RBAC_CASES)(
    "$condLabel 의 PATCH 는 $expected 이고 row 필드 불변 · apiKey 원문 미노출 (negative — JwtAuthGuard/RolesGuard)",
    async ({ kind, expected }) => {
      const cookie =
        kind === "user"
          ? userCookie
          : kind === "tampered"
            ? buildAuthCookie("not-a-valid-jwt.tampered.signature")
            : undefined;

      const pending = request(app.getHttpServer()).patch(
        `${PROVIDERS_URL}/${seedId}`,
      );
      const response = await (
        cookie ? pending.set("Cookie", cookie) : pending
      ).send({ modelId: "gpt-should-not-apply" });

      expect(response.status).toBe(expected);
      expect(response.text).not.toContain(SECRET_PATCH_SEED);
      await expectSeedRowUnchanged();
    },
  );

  // -- negative: 과차단 없음 — SuperAdmin escalation 200 --

  it("SuperAdmin 쿠키의 PATCH 는 200 (negative — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${PROVIDERS_URL}/${seedId}`)
      .set("Cookie", superAdminCookie)
      .send({ modelId: "gpt-super-patched" });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("apiKey");
    expect(response.body.modelId).toBe("gpt-super-patched");
  });
});

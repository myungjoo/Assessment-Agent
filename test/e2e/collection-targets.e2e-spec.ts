// collection-targets.e2e-spec.ts — `/api/collection-targets` 5 route 의 HTTP round-trip
// e2e (T-1823 — ADR-0059 §Follow-ups (d)).
//
// 무엇을 assert 하는가 (책임 경계 — 본 spec 의 assert 범위는 아래 두 표가 전부다):
//   - ADR-0059 §Decision 5 **route 표 5 행** 의 성공 status — GET 목록 200 / GET 단건 200 /
//     POST 201 / PATCH 200 / DELETE 204(body 없음).
//   - 같은 §Decision 5 **오류 표 a~e 5 행** — a 401(인증 부재 · invalid JWT) ·
//     b 403(User 등급의 편집 시도) · c 409(`@@unique([type, instanceKey])` 재등록 →
//     `P2002` 변환) · d 404(`:id` row 부재 → `P2025` / null 변환) ·
//     e 400(controller-scope ValidationPipe 의 형식 검증 실패).
//
// 무엇을 assert 하지 않는가 (Out of Scope):
//   - `src/` 의 어떤 동작 변경도 본 slice 의 산출물이 아니다. 본 spec 이 red 를 내면 그
//     자체가 결함 발견이며 고치지 않고 별도 slice 로 분리한다(task §Out of Scope).
//   - `type` 별 조건부 필수성(GITHUB 은 `orgs`, CONFLUENCE 는 `spaces`) — ADR-0059
//     §Consequences (c) 가 "본 model 은 강제하지 않는다" 로 박제한 축이라 assert 0.
//   - `active=false` 의 수집 파이프라인 반영 — 배선 자체가 §Follow-ups (g) 소관이라 본
//     spec 은 row 의 저장 / 조회까지만 본다.
//   - 응답 body 형태의 커스텀 envelope — §Decision 5 말미가 NestJS 기본 `HttpException`
//     body 유지를 못박았으므로 status 중심으로 assert 하고 message 문자열은 고정하지 않는다.
//   - pagination · 정렬 · 필터 query param(현 route 에 부재) · credential 노출(그런 컬럼이
//     schema 에 없다 — §Decision 2).
//
// 왜 unit 이 아니라 e2e 인가: 지금까지의 검증은 전부 unit layer(controller spec 은 service 를
// mock)라 오류 표 5 행이 **실 guard stack(JwtAuthGuard + RolesGuard) + 실 ValidationPipe +
// 실 PostgreSQL(`@@unique` · `P2002` / `P2025`)** 위에서 실제로 그 status 를 내는지는 확인된
// 적이 없다. 본 spec 이 그 5 행을 실 HTTP 로 못박아 REQ-070 / REQ-072 / REQ-073 의 API 축
// 회귀를 red 로 잡는다.
//
// 실 DB 전략(ADR-0004 §Decision — permission-denied-records.e2e 와 동일):
//   - mock override 0. `createAuthenticatedE2EApp()` 가 AppModule 부트스트랩 + actor seed +
//     token 발급을 담당하고 PrismaService 가 실 connection 을 잡는다.
//   - `CollectionTarget` 은 relation 0 인 독립 table 이라 선행 seed 가 불요하다.
//   - `afterEach(truncateAll)` 가 `"CollectionTarget"` + `"User"` 를 함께 정리한다(T-1819 가
//     TRUNCATE_TABLES 에 넣어 둔 격리 전제). JWT 는 sub claim 만 쓰고 actor User row 를
//     조회하지 않으므로(JwtStrategy.validate 가 payload 를 그대로 반환) token 재사용이 안전
//     하며 actor re-seed 가 필요 없다.
//   - 로컬에 `DATABASE_URL` 이 없으면 실행되지 않는다 — CI 의 `test:e2e` step 결과로 확인한다
//     (permission-denied-records.e2e-spec.ts 헤더의 관례와 동일).
//
// R-113 cover: 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행된다
// (test/jest-e2e.json 의 testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 picking).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const ENDPOINT = "/api/collection-targets";

// 존재하지 않는 id — `id` 는 cuid(TEXT 컬럼)라 임의 문자열도 형식 오류가 아니라 단순 부재로
// 취급된다(조회는 null, update / delete 는 `P2025`) → 오류 표 d 행 404.
const MISSING_ID = "clmissingtarget000000000";

// 등록 payload 기본형 — 각 test 가 필요한 축만 override 한다.
function payload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "GITHUB",
    instanceKey: "github-sec",
    endpoint: "github.sec.samsung.net",
    orgs: ["acme"],
    ...overrides,
  };
}

describe("E2E: /api/collection-targets 오류 계약 5 행 (T-1823)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // 등급 경계를 조회 tier(User+) 와 편집 tier(Admin+) 로 가르는 actor 2 종.
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "ct-user-actor@e2e.test" },
      { role: "Admin", email: "ct-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["ct-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(ctx.tokens["ct-admin-actor@e2e.test"]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // createTarget — Admin cookie 로 1 row 등록하고 생성된 id 를 돌려주는 헬퍼. 실 route 를
  // 통과시켜 seed 하므로 DB 직접 주입과 달리 POST 계약 자체도 매번 함께 exercise 된다.
  async function createTarget(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload(overrides));
    expect(response.status).toBe(201);
    return response.body as { id: string };
  }

  // -- A. Happy path — route 표 5 행의 성공 status ---------------------------------

  // A.1 목록 0 row 분기 — 빈 배열 200 이며 404 가 아니다(§Decision 5 GET 행).
  it("GET /api/collection-targets — User cookie 로 200 + 빈 배열 (0 row 분기)", async () => {
    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual([]);
  });

  // A.2 POST 201 — 생성된 row 에 요청한 `type` · `instanceKey` 가 반영되고, 미전달 축은
  // DB default(`repos` / `spaces` 빈 배열, `active` true)로 채워진다.
  it("POST /api/collection-targets — Admin cookie 로 201 + 생성 row 반영", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ instanceKey: "github-created" }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: "GITHUB",
      instanceKey: "github-created",
      endpoint: "github.sec.samsung.net",
      orgs: ["acme"],
      repos: [],
      spaces: [],
      active: true,
    });
    expect(typeof response.body.id).toBe("string");
  });

  // A.3 목록 N row 분기 — 등록 후 같은 목록 route 가 그 row 를 돌려준다(0 row 대비 분기).
  it("GET /api/collection-targets — 등록 후 200 + N row (N row 분기)", async () => {
    await createTarget({ instanceKey: "github-list" });

    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].instanceKey).toBe("github-list");
  });

  // A.4 GET 단건 200 — 존재 id 분기(부재 id 는 E 절).
  it("GET /api/collection-targets/:id — 존재 id 로 200 + 단건 상세", async () => {
    const created = await createTarget({ instanceKey: "github-detail" });

    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}/${created.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.id);
    expect(response.body.instanceKey).toBe("github-detail");
  });

  // A.5 PATCH 200 — 전달한 축만 바뀌고 미전달 축은 보존된다(RFC-7396 merge patch).
  it("PATCH /api/collection-targets/:id — Admin cookie 로 200 + 부분 수정 반영", async () => {
    const created = await createTarget({ instanceKey: "github-patch" });

    const response = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie)
      .send({ active: false, repos: ["only-this"] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: created.id,
      active: false,
      repos: ["only-this"],
      // 미전달 축 보존 — 정체성 축과 endpoint 는 그대로.
      instanceKey: "github-patch",
      endpoint: "github.sec.samsung.net",
    });
  });

  // A.6 DELETE 204 — body 가 없어야 한다(`@HttpCode(204)` 가 빠지면 200 + body 로 미끄러짐).
  it("DELETE /api/collection-targets/:id — Admin cookie 로 204 + body 없음", async () => {
    const created = await createTarget({ instanceKey: "github-delete" });

    const response = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(response.text).toBe("");
  });

  // -- B. 오류 행 a (401) — 인증 부재 / invalid JWT, 조회 tier + 편집 tier 양쪽 ---------

  it("GET /api/collection-targets — cookie 부재 시 401 (조회 route 의 guard 실증)", async () => {
    const response = await request(app.getHttpServer()).get(ENDPOINT);

    expect(response.status).toBe(401);
  });

  it("GET /api/collection-targets — invalid JWT cookie 시 401 (verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    expect(response.status).toBe(401);
  });

  it("POST /api/collection-targets — cookie 부재 시 401 (편집 route 의 guard 실증)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .send(payload());

    expect(response.status).toBe(401);
  });

  it("DELETE /api/collection-targets/:id — invalid JWT cookie 시 401", async () => {
    const response = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${MISSING_ID}`)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    // 401 이 404 보다 먼저다 — guard layer 가 도메인 변환보다 앞선다.
    expect(response.status).toBe(401);
  });

  // -- C. 오류 행 b (403) — User 등급의 편집 시도 3 route + 조회 2 route 대비 ---------

  it("POST /api/collection-targets — User 등급 cookie 시 403 (편집 tier 미달)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", userCookie)
      .send(payload());

    expect(response.status).toBe(403);
  });

  it("PATCH /api/collection-targets/:id — User 등급 cookie 시 403 (편집 tier 미달)", async () => {
    const created = await createTarget({ instanceKey: "github-403-patch" });

    const response = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", userCookie)
      .send({ active: false });

    expect(response.status).toBe(403);
  });

  it("DELETE /api/collection-targets/:id — User 등급 cookie 시 403 (편집 tier 미달)", async () => {
    const created = await createTarget({ instanceKey: "github-403-delete" });

    const response = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${created.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
  });

  it("GET 2 route — 같은 User 등급 cookie 로 200 (등급 경계가 조회/편집으로 갈리는 분기)", async () => {
    const created = await createTarget({ instanceKey: "github-user-read" });

    const list = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", userCookie);
    const detail = await request(app.getHttpServer())
      .get(`${ENDPOINT}/${created.id}`)
      .set("Cookie", userCookie);

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
  });

  // -- D. 오류 행 c (409) — 동일 (type, instanceKey) 재등록 (`P2002` 변환) -------------

  it("POST /api/collection-targets — 동일 (type, instanceKey) 재등록 시 첫 201 후 둘째만 409", async () => {
    const first = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ instanceKey: "github-dup" }));
    const second = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      // endpoint 가 달라도 정체성 축이 같으면 충돌한다(`@@unique([type, instanceKey])`).
      .send(payload({ instanceKey: "github-dup", endpoint: "github.com" }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("POST /api/collection-targets — type 이 다르면 같은 instanceKey 도 201 (unique 는 복합 축)", async () => {
    await createTarget({ instanceKey: "shared-key" });

    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(
        payload({
          type: "CONFLUENCE",
          instanceKey: "shared-key",
          endpoint: "https://acme.atlassian.net/wiki/rest/api",
          orgs: undefined,
          spaces: ["ENG"],
        }),
      );

    expect(response.status).toBe(201);
  });

  // -- E. 오류 행 d (404) — `:id` row 부재 3 route + DELETE 후 재요청 회귀 -------------

  it("GET /api/collection-targets/:id — 부재 id 시 404", async () => {
    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}/${MISSING_ID}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(404);
  });

  it("PATCH /api/collection-targets/:id — 부재 id 시 404 (P2025 변환)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${MISSING_ID}`)
      .set("Cookie", adminCookie)
      .send({ active: false });

    expect(response.status).toBe(404);
  });

  it("DELETE /api/collection-targets/:id — 부재 id 시 404 (P2025 변환)", async () => {
    const response = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${MISSING_ID}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });

  it("DELETE 직후 같은 id 재요청 — GET · PATCH · DELETE 모두 404 (hard delete 회귀)", async () => {
    const created = await createTarget({ instanceKey: "github-gone" });
    const removed = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie);
    expect(removed.status).toBe(204);

    const get = await request(app.getHttpServer())
      .get(`${ENDPOINT}/${created.id}`)
      .set("Cookie", userCookie);
    const patch = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie)
      .send({ active: false });
    const again = await request(app.getHttpServer())
      .delete(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie);

    // soft delete 가 아니라 hard delete 이므로 세 route 모두 부재로 본다.
    expect(get.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(again.status).toBe(404);
  });

  // -- F. 오류 행 e (400) — negative 충분 cover (ValidationPipe 분기마다 1+) -----------

  it("POST /api/collection-targets — type 미허용 값 시 400 (@IsIn)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ type: "GITLAB" }));

    expect(response.status).toBe(400);
  });

  it("POST /api/collection-targets — instanceKey 빈 문자열 시 400 (@IsNotEmpty)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ instanceKey: "" }));

    expect(response.status).toBe(400);
  });

  it("POST /api/collection-targets — instanceKey 256 자 시 400 / 255 자 는 201 (@MaxLength 경계)", async () => {
    const over = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ instanceKey: "k".repeat(256) }));
    const boundary = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ instanceKey: "k".repeat(255) }));

    expect(over.status).toBe(400);
    expect(boundary.status).toBe(201);
  });

  it("POST /api/collection-targets — 미정의 필드 포함 시 400 (forbidNonWhitelisted)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      // `id` 는 서버 생성 축이라 body 로 받지 않는다 — 위조 경로 차단.
      .send(payload({ id: "forged-id" }));

    expect(response.status).toBe(400);
  });

  it("POST /api/collection-targets — 배열 필드 원소가 문자열이 아니면 400 (@IsString each)", async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set("Cookie", adminCookie)
      .send(payload({ orgs: [123] }));

    expect(response.status).toBe(400);
  });

  it("PATCH /api/collection-targets/:id — 정체성 축(type · instanceKey) 전달 시 400", async () => {
    const created = await createTarget({ instanceKey: "github-identity" });

    const response = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie)
      .send({ instanceKey: "renamed" });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/collection-targets/:id — 명시적 null 은 400 / 키 미전달({}) 은 200 (@ValidateIf 계약)", async () => {
    const created = await createTarget({ instanceKey: "github-null" });

    const explicitNull = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie)
      .send({ endpoint: null });
    const empty = await request(app.getHttpServer())
      .patch(`${ENDPOINT}/${created.id}`)
      .set("Cookie", adminCookie)
      .send({});

    // @IsOptional 이었다면 null 이 그대로 통과했을 지점 — @ValidateIf 라 400 이다.
    expect(explicitNull.status).toBe(400);
    // 미전달은 skip — 빈 merge patch 는 valid 하다.
    expect(empty.status).toBe(200);
  });
});

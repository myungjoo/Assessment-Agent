// person-identity-continuation.e2e-spec.ts — "인원 추가·수정 → 그 id 로 곧바로
// ServiceIdentity 매핑" 이라는 **연속 동선** 을 실 PostgreSQL · 실 guard stack ·
// 실 ValidationPipe 위에서 HTTP 계약으로 고정하는 e2e (T-1783).
//
// REQ-079 와의 연결 (docs/requirements.md `98 행`):
//   - T-1782 가 REQ-079 를 재판정하며 남긴 **유일한 잔여 (2)** 가 본 연속 동선의
//     backend 축 고정이다. shipped 검증 실체는 web colocated spec 2 개
//     (`AdminView.person-create-identity-autoselect.test.tsx` ·
//     `AdminView.person-update-identity-autoselect.test.tsx`) 뿐이었고, backend 는
//     `service-identities.e2e-spec.ts` 가 identity 5 route 를 **개별로만** 덮어
//     `POST /api/persons` 응답 `id` 를 그대로 `:personId` 로 이어 쓰는 계약은 어디에서도
//     발화하지 않았다. 본 spec 이 그 한 칸을 채워 ADR-0058 `§Follow-ups (d)` 의
//     "이름 / email 만 입력 가능한 상태 금지" 를 backend 회귀 안전망에 넣는다.
//
// 책임 경계 (중복 재검증 금지):
//   - 본 spec 은 **연속 동선 anchor** 다 — "인원을 만들거나 고친 직후 그 id 로 매핑이
//     성립한다 / 성립하지 않는다" 만 발화한다. 두 endpoint 를 잇는 지점 (응답 id 의
//     재사용 가능성 · 인원 부재화 후의 동선 차단) 이 검증 대상이다.
//   - identity **개별 route 계약** (PATCH 금지 축 400 · DELETE 재승격 3 분기 ·
//     primary 지정 route · 목록 shape) 은 `service-identities.e2e-spec.ts` 의 책임이며
//     본 파일에서 재검증하지 않는다. `/api/persons` 단일 route 계약 (envelope shape ·
//     P2002 · P2025) 은 `persons.e2e-spec.ts` 책임이다.
//   - production code 변경 0 — controller · service · repository · DTO 는 T-1739 ~
//     T-1752 에서 완결됐다. 본 slice 는 test-only.
//
// 실 DB 전략 (ADR-0004 §Decision — service-identities.e2e 동일 harness 재사용):
//   - `createAuthenticatedE2EApp` (Admin + User 2 actor) 로 부트스트랩 + actor seed +
//     token 발급. mock override 없음.
//   - `afterEach` 는 `truncateAll` → `reseedAuthenticatedActors` 순서 고정 — truncate
//     명단에 "User" 가 있어 인증 actor row 까지 사라지므로 원본 id 로 재삽입해야 후속
//     요청이 엉뚱한 404 를 내지 않는다 (T-0520 선례).
//   - `/api/persons` 는 guard 미적용이라 인원 생성·수정·삭제는 쿠키 없이 호출하고,
//     identity 축만 조회 tier (User+) · 편집 tier (Admin+) 쿠키를 싣는다.
//
// R-113 cover:
//   - test/jest-e2e.json 의 testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 자동 picking
//     하므로 설정 변경 0 으로 CI 의 e2e leg 에 편입된다.
//   - 10 test = happy 2 (생성 축 · 수정 축) + 분기 2 (자동 승격 ① · ②) + error path 2
//     (빈 body 400 · 잘못된 email 400) + negative 4 (401 · 403 · 삭제된 id 404 ·
//     같은 service 재매핑 409).
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

// identity 목록·생성 path builder — `:personId` 자리에 직전 응답의 실 id 를 치환한다.
const endpointFor = (personId: string): string =>
  `/api/persons/${personId}/identities`;

// actor email — 기존 spec (`si-*@e2e.test`) 과 겹치지 않는 새 값.
const ADMIN_EMAIL = "pic-admin-actor@e2e.test";
const USER_EMAIL = "pic-user-actor@e2e.test";

describe("E2E: 인원 추가·수정 → ServiceIdentity 매핑 연속 동선 (T-1783)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;

  // 동선의 **첫 걸음** — HTTP 로 인원을 만들고 응답 body 의 실 id 를 돌려준다.
  // prisma 직접 seed 가 아니라 `POST /api/persons` 를 타는 것이 본 spec 의 핵심이다.
  const createPersonViaApi = async (
    email = "pic-target@e2e.test",
  ): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "연속 동선 대상", email });

    expect(response.status).toBe(201);
    expect(typeof response.body.id).toBe("string");
    return response.body.id as string;
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

  // A.1 생성 축 — POST 인원 201 → 그 id 로 POST identity 201 → GET 목록 1 row 를
  // 한 test 안에서 **연속** 으로 통과한다 (동선이 끊기면 여기서 먼저 깨진다).
  it("생성 축 — POST 인원 응답 id 로 곧바로 매핑 201 + 목록 1 row (happy)", async () => {
    const personId = await createPersonViaApi();

    const created = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" });

    expect(created.status).toBe(201);
    expect(created.body.personId).toBe(personId);

    const listed = await request(app.getHttpServer())
      .get(endpointFor(personId))
      .set("Cookie", adminCookie);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({
      personId,
      service: "github",
      externalId: "octo",
    });
  });

  // A.2 수정 축 — POST 인원 → PATCH 로 fullName 변경 200 → **같은 id** 로 매핑 201 →
  // 목록 1 row. 수정이 id 를 바꾸지 않으므로 동선이 이어진다는 계약이다.
  it("수정 축 — PATCH 로 인원을 고친 뒤에도 같은 id 로 매핑 201 + 목록 1 row (happy)", async () => {
    const personId = await createPersonViaApi();

    const patched = await request(app.getHttpServer())
      .patch(`/api/persons/${personId}`)
      .send({ fullName: "수정된 이름" });

    expect(patched.status).toBe(200);
    expect(patched.body.id).toBe(personId);
    expect(patched.body.fullName).toBe("수정된 이름");

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "jira", externalId: "octo.j" })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get(endpointFor(personId))
      .set("Cookie", adminCookie);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].personId).toBe(personId);
  });

  // -- B. 분기 (R-112 #3) --------------------------------------------------------

  // B.1 자동 승격 ① — 연속 동선으로 붙인 **첫** identity 는 DB 재조회에서 isPrimary=true.
  // 응답 body 만으로도 보이지만, 실 Postgres 잔여 상태를 anchor 로 삼는다.
  it("분기 ① — 연속 동선의 첫 identity 는 DB 재조회에서 isPrimary=true", async () => {
    const personId = await createPersonViaApi();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(201);

    const rows = await prisma.serviceIdentity.findMany({ where: { personId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].isPrimary).toBe(true);
  });

  // B.2 자동 승격 ② — 같은 인원에 `service` 가 다른 **두 번째** identity 를 이어 붙이면
  // isPrimary=false 이고 첫 row 의 primary 가 유지된다 (응답이 아니라 DB 로만 확인 가능).
  it("분기 ② — 이어 붙인 두 번째 identity 는 isPrimary=false 이고 첫 row primary 유지", async () => {
    const personId = await createPersonViaApi();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(201);
    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "jira", externalId: "octo.j" })
      .expect(201);

    const rows = await prisma.serviceIdentity.findMany({ where: { personId } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.service === "github")?.isPrimary).toBe(true);
    expect(rows.find((r) => r.service === "jira")?.isPrimary).toBe(false);
  });

  // -- C. Error path (R-112 #2) --------------------------------------------------

  // C.1 빈 body 400 — 동선의 첫 걸음이 막히면 Person row 가 0 이라 매핑이 **시작조차**
  // 되지 않는다 (이어 쓸 id 자체가 없다).
  it("error path — 빈 body 로 인원 생성이 400 이면 person row 0 이라 동선이 시작되지 않음", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("statusCode", 400);
    expect(response.body.message).toBeTruthy();
    expect(await prisma.person.count()).toBe(0);
  });

  // C.2 잘못된 email 400 — 같은 차단이 형식 위반 축에서도 성립한다.
  it("error path — 잘못된 email 로 인원 생성이 400 이면 person row 0 (형식 위반 축)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "연속 동선 대상", email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("statusCode", 400);
    expect(response.body.message).toBeTruthy();
    expect(await prisma.person.count()).toBe(0);
  });

  // -- D. Negative cases (R-112 #4) — 예외 분기마다 1+ ---------------------------

  // D.1 인원은 생겼지만 인증 쿠키 없이 매핑 → JwtAuthGuard 가 401 이고 identity row 0.
  it("negative — 인원 생성 후 인증 쿠키 없이 매핑하면 401 이고 identity row 0", async () => {
    const personId = await createPersonViaApi();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .send({ service: "github", externalId: "octo" })
      .expect(401);

    expect(await prisma.serviceIdentity.count({ where: { personId } })).toBe(0);
  });

  // D.2 User role 쿠키는 편집 tier (Admin+) 미달 → RolesGuard 가 403 이고 identity row 0.
  it("negative — User role 쿠키로 매핑하면 편집 tier 미달이라 403 이고 identity row 0", async () => {
    const personId = await createPersonViaApi();

    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", userCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(403);

    expect(await prisma.serviceIdentity.count({ where: { personId } })).toBe(0);
  });

  // D.3 생성 후 DELETE 로 사라진 id 는 더 이상 동선의 출발점이 아니다 → 404.
  it("negative — DELETE 로 사라진 인원 id 로 매핑하면 404", async () => {
    const personId = await createPersonViaApi();

    await request(app.getHttpServer())
      .delete(`/api/persons/${personId}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("statusCode", 404);
  });

  // D.4 같은 personId + 같은 service 재매핑 → @@unique 위반 P2002 가 409 로 변환되고
  // 기존 row 는 1 개로 보존된다 (중복 생성도 삭제도 일어나지 않는다).
  it("negative — 같은 personId·service 재매핑은 409 이고 기존 row 1 개 보존", async () => {
    const personId = await createPersonViaApi();
    await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(endpointFor(personId))
      .set("Cookie", adminCookie)
      .send({ service: "github", externalId: "octo-dup" });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty("statusCode", 409);

    const rows = await prisma.serviceIdentity.findMany({ where: { personId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].externalId).toBe("octo");
  });
});

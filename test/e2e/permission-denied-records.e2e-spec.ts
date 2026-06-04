// permission-denied-records.e2e-spec.ts — `GET /api/permission-denied-records`
// audit 조회 endpoint 의 HTTP + RBAC round-trip e2e (T-0216 — R-113 gap closeout).
// summaries.e2e-spec.ts (T-0119/T-0123) 의 RBAC e2e 패턴 1:1 mirror — T-0214 가
// ship 한 audit endpoint (ADR-0023 §5) 에 다른 9 RBAC controller 와 달리 부재했던
// HTTP layer + guard stack 실 네트워크 exercise 를 신설한다.
//
// 책임 (smoke vs e2e 책임 경계 — permission-denied-record.smoke-spec.ts 와 분리):
//   - smoke (T-0208) 는 prisma 모델 create/read round-trip 만 (HTTP 무관).
//   - 본 e2e 는 실 guard stack (JwtAuthGuard + RolesGuard + @Roles("User")) + actor-
//     aware service-layer (Admin bypass / non-Admin 빈 배열 fallback) 를 실 PostgreSQL
//     위에서 supertest 로 exercise — ADR-0023 §1/§4 의 박제된 동작만 검증.
//
// ADR-0023 박제 동작 (본 e2e assert 범위):
//   - §1 audience: Admin/SuperAdmin → 전체 record (full read bypass) / non-Admin
//     authenticated → binding-부재 fallback 으로 200 빈 배열 (403 아님).
//   - §4 응답 경계: 미인증 → 401 (cookie 부재 / invalid JWT) / 빈 결과 → 200 빈 배열.
//   - §5 query param: instanceRef / provider / httpStatus 필터 + parseHttpStatus
//     경계 (non-numeric → filter omit → 전체 반환).
//
// Out of Scope (task §Out of Scope / ADR-0023 §2(b)·§5 게이트):
//   - non-Admin own-instance 실 필터 — User↔instance binding schema 선행 요구
//     (deferred). 본 e2e 는 non-Admin → 빈 배열 fallback 까지만 assert, "User 가 자기
//     instance record 만 본다" 의 positive 필터는 가정 0.
//   - 403 tier 미달 케이스 — @Roles("User") 라 authenticated 면 role 게이트 통과
//     (ADR-0023 §4 — 403 은 향후 higher-tier endpoint 경계). 인위적 403 케이스 0.
//
// 실 DB 전략 (ADR-0004 §Decision — summaries.e2e 동일):
//   - mock override 없음 — createAuthenticatedE2EApp() 가 AppModule 부트스트랩 + actor
//     user seed + token 발급, PrismaService 가 services.postgres 로 실 connection.
//   - PermissionDeniedRecord 는 FK / relation 부재 (ADR-0022 §5) standalone audit
//     테이블 — 선행 seed 불요, prisma.permissionDeniedRecord.create 로 직접 seed.
//   - `afterEach(truncateAll)` 가 "PermissionDeniedRecord" + "User" 동반 정리 (db-
//     truncate.ts TRUNCATE_TABLES). actor user 도 truncate 되나 JWT sub claim 은 DB
//     lookup 불요 (controller 가 actor user row 조회 안 함) → token 재사용 OK.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// 실 DB 미가용 환경 (로컬 — DATABASE_URL 부재) 에서는 CI 에서만 실행 (summaries.e2e 동일).
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행 (test/jest-e2e.json 의
//     testRegex `.*\.e2e-spec\.ts$` 가 본 파일 picking).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const ENDPOINT = "/api/permission-denied-records";

// PermissionDeniedRecord view 필수 field — Admin happy 응답이 raw record 를 그대로
// 노출 (ADR-0023 §5 redaction 불요).
const RECORD_FIELDS = [
  "id",
  "provider",
  "instanceRef",
  "resourceRef",
  "httpStatus",
  "reason",
  "createdAt",
] as const;

describe("E2E: GET /api/permission-denied-records audit RBAC (T-0216)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User (non-Admin 빈 배열 fallback) / Admin (full bypass).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // actor 2 종 seed (User / Admin) — non-Admin fallback 과 Admin bypass 분기를 각
    // 적정 role token 으로 exercise. audit record 는 각 test 가 별도 seed (도메인 분리).
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "pdr-user-actor@e2e.test" },
      { role: "Admin", email: "pdr-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["pdr-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(ctx.tokens["pdr-admin-actor@e2e.test"]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — "PermissionDeniedRecord" + "User" 정리. test 간 state
  // leak 0. actor user 도 truncate 되지만 JWT sub claim 은 DB lookup 불요 → token 재사용 OK.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // seedRecord — PermissionDeniedRecord 1 row 직접 seed (FK 부재 standalone). 후속
  // assert 에 활용할 created row 반환. overrides 로 instanceRef/provider/httpStatus 분기.
  async function seedRecord(
    overrides: Partial<{
      provider: string;
      instanceRef: string;
      resourceRef: string;
      principal: string | null;
      httpStatus: number;
      reason: string | null;
    }> = {},
  ): Promise<{ id: string }> {
    return prisma.permissionDeniedRecord.create({
      data: {
        provider: overrides.provider ?? "github",
        instanceRef: overrides.instanceRef ?? "github.sec.samsung.net",
        resourceRef: overrides.resourceRef ?? "/repos/o/r/commits",
        principal:
          overrides.principal === undefined ? null : overrides.principal,
        httpStatus: overrides.httpStatus ?? 403,
        reason:
          overrides.reason === undefined
            ? "permission-denied"
            : overrides.reason,
      },
    });
  }

  // -- A. RBAC negative — 미인증 401 (cookie 부재 / invalid JWT) -------------------
  // ADR-0023 §4 미인증 경계. summaries.e2e A.1/A.4 mirror. 본 endpoint 는 @Roles("User")
  // 라 403 tier 미달 분기 부재 (task §Out of Scope) — 401 negative 만 cover.

  // A.1 cookie 부재 시 401 (JwtAuthGuard reject) — negative case (b).
  it("GET /api/permission-denied-records — cookie 부재 시 401 (negative — 인증 부재)", async () => {
    await seedRecord();

    const response = await request(app.getHttpServer()).get(ENDPOINT);

    expect(response.status).toBe(401);
  });

  // A.2 invalid JWT cookie 시 401 (JwtAuthGuard verify fail) — negative case (c).
  it("GET /api/permission-denied-records — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    await seedRecord();

    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    expect(response.status).toBe(401);
  });

  // -- B. Happy path (Admin bypass — 전체 record 조회, ADR-0023 §1/§3) -------------

  // B.1 Admin token → 200 + json array + 전체 record 노출 (full read bypass). 서로
  // 다른 instanceRef/provider 의 2 record seed 후 Admin 이 둘 다 본다.
  it("GET /api/permission-denied-records — Admin token 통과 시 200 with application/json array (Admin bypass 전체 조회)", async () => {
    await seedRecord({
      provider: "github",
      instanceRef: "github.sec.samsung.net",
      httpStatus: 403,
    });
    await seedRecord({
      provider: "confluence",
      instanceRef: "https://acme.atlassian.net/wiki/rest/api",
      resourceRef: "/content",
      httpStatus: 401,
      reason: null,
    });

    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    // Admin bypass — seed 한 2 record 전체를 본다 (ADR-0023 §1).
    expect(response.body).toHaveLength(2);
    RECORD_FIELDS.forEach((f) => expect(response.body[0]).toHaveProperty(f));
    const providers = (response.body as Array<{ provider: string }>).map(
      (r) => r.provider,
    );
    expect(providers).toEqual(expect.arrayContaining(["github", "confluence"]));
  });

  // B.2 SuperAdmin token → 200 + 전체 record (escalation hierarchy descent — Admin
  // tier 에 SuperAdmin 포함). 별도 actor seed (beforeAll 2 actor 외).
  it("GET /api/permission-denied-records — SuperAdmin token 으로 Admin bypass 통과 (escalation hierarchy descent)", async () => {
    const superCtx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "pdr-super-actor@e2e.test" },
    ]);
    try {
      await superCtx.prisma.permissionDeniedRecord.create({
        data: {
          provider: "github",
          instanceRef: "github.com",
          resourceRef: "/repos/o/r/pulls",
          httpStatus: 403,
          reason: "permission-denied",
        },
      });
      const superCookie = buildAuthCookie(
        superCtx.tokens["pdr-super-actor@e2e.test"],
      );

      const response = await request(superCtx.app.getHttpServer())
        .get(ENDPOINT)
        .set("Cookie", superCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    } finally {
      await truncateAll(superCtx.prisma);
      await superCtx.app.close();
      await superCtx.prisma.$disconnect();
    }
  });

  // B.3 Admin 이지만 매칭 record 0 → 200 빈 배열 (404 변환 0, ADR-0023 §4 빈 결과).
  // negative case (e) — 빈 결과 경계.
  it("GET /api/permission-denied-records — Admin token + record 0 시 200 빈 배열 (negative — 빈 결과, 404 아님)", async () => {
    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // -- C. non-Admin authenticated → 빈 배열 fallback (ADR-0023 §1, 403 아님) --------

  // C.1 User token → 200 + 빈 배열 (binding-부재 fallback). record 가 DB 에 존재해도
  // non-Admin 은 빈 배열 — 403 아님 (status 200 명시 assert). negative case (a).
  it("GET /api/permission-denied-records — User token 시 200 빈 배열 (non-Admin fallback, 403 아님)", async () => {
    // record 가 DB 에 존재해도 non-Admin 은 빈 배열 fallback (binding 부재).
    await seedRecord({ provider: "github", httpStatus: 403 });
    await seedRecord({ provider: "confluence", httpStatus: 401, reason: null });

    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set("Cookie", userCookie);

    // 403 아님 — authenticated 면 role 게이트 통과, audience 차등은 빈 배열로 (ADR-0023 §1).
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // -- D. Flow / branch — query param 필터 (ADR-0023 §5, Admin token) --------------

  // D.1 provider 필터 — `?provider=github` 시 매칭 record 만 반환. 비매칭 confluence
  // record 미포함 assert (필터 일치 1 row + 비일치 제외).
  it("GET /api/permission-denied-records?provider=github — provider 필터 시 매칭 record 만 반환 (branch — query 필터)", async () => {
    await seedRecord({
      provider: "github",
      instanceRef: "github.sec.samsung.net",
      httpStatus: 403,
    });
    await seedRecord({
      provider: "confluence",
      instanceRef: "https://acme.atlassian.net/wiki/rest/api",
      resourceRef: "/content",
      httpStatus: 401,
      reason: null,
    });

    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}?provider=github`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].provider).toBe("github");
    // 비매칭 confluence 미포함.
    const providers = (response.body as Array<{ provider: string }>).map(
      (r) => r.provider,
    );
    expect(providers).not.toContain("confluence");
  });

  // D.2 httpStatus 필터 — `?httpStatus=403` 시 숫자 변환 (parseHttpStatus) 후 매칭
  // record 만. 403 1 row + 401 record 제외.
  it("GET /api/permission-denied-records?httpStatus=403 — httpStatus 필터 시 숫자 변환 후 매칭 record 만 (branch — parseHttpStatus 정상 경로)", async () => {
    await seedRecord({ provider: "github", httpStatus: 403 });
    await seedRecord({
      provider: "github",
      resourceRef: "/repos/o/r/pulls",
      httpStatus: 401,
      reason: null,
    });

    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}?httpStatus=403`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].httpStatus).toBe(403);
  });

  // D.3 non-numeric httpStatus query → parseHttpStatus 가 undefined 반환 → filter omit
  // → 전체 반환 (throw 0, 500 아님). controller negative case #6 / negative case (d).
  it("GET /api/permission-denied-records?httpStatus=abc — non-numeric httpStatus 는 filter omit 후 전체 반환 (negative — parseHttpStatus 경계, 500 아님)", async () => {
    await seedRecord({ provider: "github", httpStatus: 403 });
    await seedRecord({
      provider: "github",
      resourceRef: "/repos/o/r/pulls",
      httpStatus: 401,
      reason: null,
    });

    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}?httpStatus=abc`)
      .set("Cookie", adminCookie);

    // non-numeric → throw 0, filter omit → 전체 2 record 반환.
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  // D.4 instanceRef 필터 — `?instanceRef=` 매칭 record 만. provider 필터와 다른 컬럼
  // 분기를 cover (ADR-0023 §5 instanceRef query param).
  it("GET /api/permission-denied-records?instanceRef= — instanceRef 필터 시 매칭 record 만 반환 (branch — instanceRef query)", async () => {
    await seedRecord({
      provider: "github",
      instanceRef: "github.sec.samsung.net",
      httpStatus: 403,
    });
    await seedRecord({
      provider: "github",
      instanceRef: "github.com",
      resourceRef: "/repos/o/r/pulls",
      httpStatus: 403,
    });

    const response = await request(app.getHttpServer())
      .get(`${ENDPOINT}?instanceRef=github.com`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].instanceRef).toBe("github.com");
  });
});

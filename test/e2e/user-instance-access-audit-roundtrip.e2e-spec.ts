// user-instance-access-audit-roundtrip.e2e-spec.ts — grant→own-instance audit READ
// 필터 round-trip cross-chain e2e (ADR-0027 Follow-up 4, T-0241 — R-113 통합 검증).
//
// 목적 (ADR-0024→ADR-0027 grant chain 의 단 하나의 존재 이유를 닫는 통합 검증):
//   "Admin 이 non-Admin user 에게 instance 를 grant 하면 그 user 가 자기 instance 의
//    permission-denied audit record 를 조회할 수 있다" — 이 round-trip 을 처음으로
//   end-to-end 로 검증. ADR-0027 §Consequences (4)(line 156) 가 deferred 한 Follow-up.
//
// 기존 e2e 와의 책임 경계 (중복 금지 — task §Out of Scope):
//   - permission-denied-records.e2e (T-0216): audit READ endpoint 의 RBAC/query 필터.
//     non-Admin 은 binding write 경로 부재로 "빈 배열 fallback" 까지만 assert.
//   - user-instance-access.e2e (T-0240): grant/revoke endpoint 의 격리 RBAC
//     (201/204/403/409/404/400/401). grant 후 audit 가시성 cross-chain 은 cover 0.
//   - 본 e2e: 위 둘을 합성 — grant 를 setup step 으로 실 호출(POST 201)한 뒤 그 결과로
//     audit GET 가시성이 바뀌는 cross-chain round-trip 만. grant endpoint 자체의
//     negative(403/409 등) 는 재작성 0, audit query param(provider/httpStatus) 도 0.
//
// 검증 분기 (own-instance 필터 — ADR-0024 §3 allowlist 교집합):
//   A. happy: grant → 그 instance record 보임.
//   B. revoke: grant→revoke → 빈 배열 복귀(403 아님).
//   C. 타 instance 격리: A 만 grant 받으면 B(allowlist 밖) record 안 보임, A 만 보임.
//   D. grant 없음: binding 0 user 는 record 존재해도 빈 배열(기존 fallback 회귀 보호).
//   E. Admin bypass 불변: 위 전반에서 Admin 은 grant 무관 전체 조회.
//   F. 미인증 401: cookie 부재 audit 조회 401(인증 경계 회귀 보호).
//
// 정규화 분기(ADR-0024 §4 host case/trailing-slash) 주의:
//   - grant 입력 instanceRef 와 record instanceRef 의 정규화 매칭은 service 단
//     (normalizeInstanceRef)에서 적용 — e2e 표면(POST body→DB 저장값)에서 trailing-
//     slash 변형의 매칭을 재현하려면 저장값 자체가 정규화되어야 하나, grant write 가
//     정규화 저장하므로 입력 변형 host-case 만으로 1 test 재현 가능(C.2). audit record
//     의 instanceRef 는 정규화 저장값과 동일해야 매칭 — 이미 정규화된 ref 로 seed.
//
// 실 DB 전략 (ADR-0004 §Decision — 위 두 e2e 동일):
//   - mock override 없음. createAuthenticatedE2EApp 가 AppModule 부트스트랩 + actor
//     seed + token 발급. PrismaService 가 services.postgres 실 connection.
//   - grant 는 POST endpoint 실 호출(cross-chain), record 는 prisma 직접 seed
//     (PermissionDeniedRecord 는 FK 부재 standalone — ADR-0022 §5).
//   - afterEach(truncateAll) 가 "User" 정리 + UserInstanceAccess CASCADE(schema L221)
//     동반 정리 + "PermissionDeniedRecord" 정리. test 간 state leak 0. actor/target
//     user 는 동일 id 로 재seed(token sub claim round-trip 정합 — T-0240 패턴).
//   - afterAll(app.close + prisma.$disconnect) connection 누수 방지.
//
// 실 DB 미가용 환경(로컬 — DATABASE_URL 부재)에서는 CI 에서만 실행(위 두 e2e 동일).
// CI 의 `pnpm test:e2e` step 이 test/jest-e2e.json 의 testRegex `.*\.e2e-spec\.ts$`
// 로 본 파일 picking (R-113).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const AUDIT_ENDPOINT = "/api/permission-denied-records";

// grant/revoke endpoint path builder — `:id` 자리에 target user id 치환.
const grantEndpointFor = (userId: string): string =>
  `/api/users/${userId}/instance-access`;

// 정규화 no-op 한 instanceRef 2 종(소문자 host) — grant 입력값 == 저장값 보장하여
// allowlist 매칭/응답 assert 가 정규화 변환에 흔들리지 않음. INSTANCE_A 는 grant 대상,
// INSTANCE_B 는 grant 받지 않은 타 instance(격리 분기 C).
const INSTANCE_A = "github.sec.samsung.net";
const INSTANCE_B = "github.com";

const ADMIN_EMAIL = "uiar-admin-actor@e2e.test";
const TARGET_EMAIL = "uiar-target@e2e.test";

describe("E2E: grant→own-instance audit READ 필터 round-trip (T-0241)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // Admin actor — grant/revoke 수행(@Roles(Admin)) + audit Admin bypass 검증.
  let adminCookie: string;
  // target non-Admin user — grant 수혜자이자 audit own-instance 조회 주체. token 으로
  // 자기 cookie 발급(actor 로도 audit GET 호출).
  let targetCookie: string;
  // 재seed 정합용 id (afterEach truncate 후 동일 id 로 복원 — token sub claim round-trip).
  let adminId: string;
  let targetId: string;

  beforeAll(async () => {
    // Admin(grant 수행) + target non-Admin(grant 수혜 + audit own-instance 조회) seed.
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: TARGET_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    targetCookie = buildAuthCookie(ctx.tokens[TARGET_EMAIL]);
    adminId = ctx.users[ADMIN_EMAIL].id;
    targetId = ctx.users[TARGET_EMAIL].id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — "User"/"PermissionDeniedRecord" 정리 + UserInstanceAccess
  // CASCADE 동반 정리(schema L221). actor/target user 는 동일 id 로 재seed 하여 기존
  // token 의 sub claim 과 정합(JWT 는 DB lookup 불요라 token 재사용 OK — T-0240 패턴).
  afterEach(async () => {
    await truncateAll(prisma);
    await prisma.user.createMany({
      data: [
        { id: adminId, email: ADMIN_EMAIL, hashedPassword: "x", role: "Admin" },
        {
          id: targetId,
          email: TARGET_EMAIL,
          hashedPassword: "x",
          role: "User",
        },
      ],
    });
  });

  // seedRecord — PermissionDeniedRecord 1 row 직접 seed(FK 부재 standalone).
  // instanceRef override 로 own-instance 필터 분기를 exercise.
  async function seedRecord(
    instanceRef: string,
    overrides: Partial<{
      provider: string;
      resourceRef: string;
      httpStatus: number;
    }> = {},
  ): Promise<{ id: string; instanceRef: string }> {
    return prisma.permissionDeniedRecord.create({
      data: {
        provider: overrides.provider ?? "github",
        instanceRef,
        resourceRef: overrides.resourceRef ?? "/repos/o/r/commits",
        principal: null,
        httpStatus: overrides.httpStatus ?? 403,
        reason: "permission-denied",
      },
    });
  }

  // grant — Admin 이 target 에게 instance grant(POST 201, cross-chain setup step).
  // T-0240 이 격리 검증한 endpoint 를 본 task 는 setup 으로만 재사용.
  async function grant(instanceRef: string): Promise<void> {
    await request(app.getHttpServer())
      .post(grantEndpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef })
      .expect(201);
  }

  // revoke — Admin 이 target 의 instance binding 회수(DELETE 204).
  async function revoke(instanceRef: string): Promise<void> {
    await request(app.getHttpServer())
      .delete(grantEndpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef })
      .expect(204);
  }

  // audit GET — instanceRef array 추출 helper.
  async function auditInstanceRefs(cookie: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(AUDIT_ENDPOINT)
      .set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    return (response.body as Array<{ instanceRef: string }>).map(
      (r) => r.instanceRef,
    );
  }

  // -- A. Happy round-trip (핵심) — grant → own-instance record 보임 -----------------

  // A.1 grant(POST 201) → 그 instance record seed → target non-Admin 이 audit GET 시
  // 200 + 그 record 가 보임(T-0240 격리 e2e 와 달리 grant→audit 가시성 cross-chain 을
  // 1 test 로 닫음). grant 전 빈 배열 → grant 후 보임의 전후 대비를 한 test 안에서.
  it("grant 후 non-Admin 이 자기 instance 의 audit record 를 본다 (happy round-trip 핵심)", async () => {
    const record = await seedRecord(INSTANCE_A);

    // grant 이전 — own-instance allowlist 공집합 → 빈 배열(보이지 않음).
    expect(await auditInstanceRefs(targetCookie)).toEqual([]);

    // Admin grant(cross-chain setup) → allowlist 에 INSTANCE_A 진입.
    await grant(INSTANCE_A);

    // grant 이후 — 그 instance record 가 보임(가시성 전환).
    const response = await request(app.getHttpServer())
      .get(AUDIT_ENDPOINT)
      .set("Cookie", targetCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(record.id);
    expect(response.body[0].instanceRef).toBe(INSTANCE_A);
  });

  // -- B. Revoke round-trip (핵심) — grant→revoke → 빈 배열 복귀 ---------------------

  // B.1 grant→record 보임 상태에서 revoke(DELETE 204) → 동일 non-Admin 이 다시 audit
  // GET 시 200 + 빈 배열(binding 제거 후 own-instance fallback 복귀, 403 아님).
  it("revoke 후 non-Admin 이 다시 빈 배열 fallback 으로 복귀한다 (revoke round-trip 핵심, 403 아님)", async () => {
    await seedRecord(INSTANCE_A);
    await grant(INSTANCE_A);
    // grant 후 보임을 선행 확인.
    expect(await auditInstanceRefs(targetCookie)).toEqual([INSTANCE_A]);

    // revoke → binding 제거.
    await revoke(INSTANCE_A);

    // revoke 후 — record 는 DB 에 남아있어도 allowlist 공집합 → 빈 배열(403 아님).
    const response = await request(app.getHttpServer())
      .get(AUDIT_ENDPOINT)
      .set("Cookie", targetCookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // -- C. 분기 — 타 instance 비노출 (allowlist 교집합, ADR-0024 §3) -----------------

  // C.1 instance A 만 grant 받은 상태에서 instance B(allowlist 밖) record 는 안 보이고
  // A 의 record 만 반환(분기 양쪽 — 격리 + 노출). 권한 밖 instance 격리.
  it("instance A 만 grant 받으면 B(allowlist 밖) record 는 안 보이고 A 만 보인다 (분기 — 타 instance 격리)", async () => {
    const recordA = await seedRecord(INSTANCE_A);
    await seedRecord(INSTANCE_B); // allowlist 밖 — 안 보여야 함.
    await grant(INSTANCE_A);

    const refs = await auditInstanceRefs(targetCookie);
    // A 만 노출, B 격리.
    expect(refs).toEqual([INSTANCE_A]);
    expect(refs).not.toContain(INSTANCE_B);

    const response = await request(app.getHttpServer())
      .get(AUDIT_ENDPOINT)
      .set("Cookie", targetCookie);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(recordA.id);
  });

  // C.2 분기 — 정규화 정합: grant 입력 instanceRef 가 host 대문자 변형이어도 ADR-0024 §4
  // 정규화(host lowercase)로 저장되어, 정규화된 record(소문자 host)와 매칭되어 보임.
  // grant write 가 정규화 저장하므로 e2e 표면에서 host-case 변형 1 test 재현 가능.
  it("grant 입력의 host 대문자 변형이 정규화되어 record 와 매칭된다 (분기 — 정규화 정합)", async () => {
    // record 는 정규화 저장값(소문자 host) 으로 seed.
    await seedRecord(INSTANCE_A);
    // grant 입력은 host 대문자 변형 — 정규화 후 INSTANCE_A 와 동일 allowlist 진입.
    await grant("GitHub.SEC.Samsung.NET");

    const refs = await auditInstanceRefs(targetCookie);
    expect(refs).toEqual([INSTANCE_A]);
  });

  // -- D. Negative — grant 없는 user 는 빈 배열 (기존 fallback 회귀 보호) ------------

  // D.1 grant 를 전혀 받지 않은 non-Admin 은 record 가 DB 에 존재해도 200 + 빈 배열
  // (binding 0 fallback — 본 task 가 그 동작을 깨지 않음 확인).
  it("grant 없는 non-Admin 은 record 가 존재해도 빈 배열 (negative — fallback 회귀 보호)", async () => {
    await seedRecord(INSTANCE_A);
    await seedRecord(INSTANCE_B);

    const response = await request(app.getHttpServer())
      .get(AUDIT_ENDPOINT)
      .set("Cookie", targetCookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // -- E. Negative — Admin bypass 불변 (non-Admin 필터가 Admin 경로 미오염) ----------

  // E.1 grant 여부와 무관하게 Admin cookie 는 전체 record 조회(bypass). target 에게
  // INSTANCE_A 만 grant 한 상태에서도 Admin 은 A+B 전체를 본다.
  it("Admin 은 grant 여부 무관하게 전체 record 를 조회한다 (negative — Admin bypass 불변)", async () => {
    await seedRecord(INSTANCE_A);
    await seedRecord(INSTANCE_B);
    await grant(INSTANCE_A); // non-Admin 에 한정된 grant — Admin 가시성에 영향 0.

    const refs = await auditInstanceRefs(adminCookie);
    // Admin bypass — allowlist 무시, A+B 전체.
    expect(refs).toHaveLength(2);
    expect(refs).toEqual(expect.arrayContaining([INSTANCE_A, INSTANCE_B]));
  });

  // -- F. Negative — 미인증 401 (인증 경계 회귀 보호) -------------------------------

  // F.1 grant→audit 시나리오의 audit 조회를 cookie 부재로 호출 시 401(JwtAuthGuard).
  it("grant 후라도 cookie 부재 audit 조회는 401 (negative — 인증 경계)", async () => {
    await seedRecord(INSTANCE_A);
    await grant(INSTANCE_A);

    const response = await request(app.getHttpServer()).get(AUDIT_ENDPOINT);
    expect(response.status).toBe(401);
  });
});

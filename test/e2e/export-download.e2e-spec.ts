// export-download.e2e-spec.ts — `GET /api/admin/export/:id/download` full-record
// download endpoint 의 HTTP + RBAC + 실 PostgreSQL roundtrip e2e (T-0520 — ADR-0047
// §Follow-ups 잔여 live-DB 조각). permission-denied-records.e2e-spec.ts (T-0216) 의
// Admin RBAC e2e 패턴 1:1 mirror — export full-record download chain 은 순수 helper
// (T-0507~T-0517) → service 배선 (T-0518 materializeFullExportDownload) → HTTP
// streaming controller (T-0519) 까지 완결됐으나, 지금까지의 검증은 unit + supertest
// (in-memory mock) 수준이었다. 본 e2e 는 5 entity 를 실 DB 에 seed → export job 생성 →
// download 호출 → full-record dump 본문을 실 PostgreSQL roundtrip 으로 검증한다.
//
// 책임 (R-113 — unit 외 end-to-end CI 수행):
//   - 실 guard stack (JwtAuthGuard + RolesGuard + @Roles("Admin")) + service-layer
//     (findJob → materializeFullExportDownload → serializeExportDownloadHeaders →
//     StreamableFile) 를 실 PostgreSQL 위에서 supertest 로 exercise.
//   - controller download() (export.controller.ts L379~411) 의 3 단계 배선이 실 DB
//     read 경로로 동작함을 확인 — happy 200 + 다운로드 헤더 + full-record dump 본문.
//
// 본 e2e assert 범위 (ADR-0047 박제 동작):
//   - §Decision1·§Decision2 secret deny: LlmProviderConfig.apiKey 가 실 DB-read
//     경로 (collectFullExportRecords) 를 통과해도 다운로드 본문에 누출되지 않음.
//     EXPORT_ENTITY_FULL_RECORD_SELECT 의 LlmConfig select 에 apiKey key 가 애초에
//     없어 query 단계에서 read 자체가 안 되며, buildFullExportRecord 의 allow-list
//     단언이 조립 단계 2 차 그물. 본 e2e 가 이 secret deny 를 실 DB 로 실증 (REQ-032).
//   - §Decision3(i) descriptor single-source: download() 가 Content-Type /
//     Content-Disposition / Content-Length 다운로드 헤더를 응답에 설정.
//   - findJob 부재 404 raw propagate / 빈 DB 0-record 경계 / RBAC 401·403.
//
// 실 DB 전략 (ADR-0004 §Decision — 다른 e2e 동일):
//   - mock override 없음 — createAuthenticatedE2EApp() 가 AppModule 부트스트랩 + actor
//     user seed + token 발급, PrismaService 가 services.postgres 로 실 connection.
//   - export job 은 controller 가 발화자 (actor.sub) 를 requestedById 로 결합하므로
//     POST /api/admin/export 로 생성 — Admin token actor 의 User row 가 FK 대상.
//   - cleanup: truncateAll (Person/User CASCADE) 는 LlmProviderConfig / ExportJob 를
//     truncate 하지 않으므로 (TRUNCATE_TABLES 미포함), afterEach 가 먼저
//     exportJob/llmProviderConfig 를 deleteMany 한 뒤 truncateAll 을 호출한다.
//     ExportJob → User 는 onDelete: Restrict 라 User truncate 전에 ExportJob 를 먼저
//     비워야 CASCADE 충돌이 없다.
//   - 🔥 actor re-seed (T-0520 round 2 — FK seed 순서 결함 수정): permission-denied
//     e2e 와 달리 본 endpoint 는 ExportJob.requestedById → User.id (onDelete: Restrict)
//     FK 가 actor User row 의 실 존재를 요구한다. truncateAll 이 "User" 테이블을 동반
//     truncate 하므로 첫 test 후 actor User 가 사라져, 다음 test 의 POST /api/admin/export
//     (createExportJob) 가 FK 위반 (ExportJob_requestedById_fkey) 으로 500. 따라서
//     afterEach 는 truncate 후 beforeAll 의 actor User 2종을 동일 id/email/role 로 재
//     seed 한다 — JWT sub claim (= 원 User id) 이 그대로 유효하고 FK 대상이 매 test 직전
//     존재한다 (token 재발급 불요).
//
// 실 DB 미가용 환경 (로컬 — DATABASE_URL 부재) 에서는 CI 에서만 실행 (다른 e2e 동일).
// 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행 (test/jest-e2e.json 의 testRegex
// `.*\.e2e-spec\.ts$` 가 본 파일 picking — 설정 변경 불요).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const BASE = "/api/admin/export";

// seed apiKey — LlmProviderConfig 에 실 DB 로 저장할 secret. 본 문자열이 다운로드
// 본문에 부재함을 단언 (REQ-032 핵심 회귀). 충분히 고유한 sentinel 이라 우연 매칭 0.
const SEED_API_KEY = "sk-secret-EXPORT-DOWNLOAD-E2E-must-not-leak-7f3a9c";

describe("E2E: GET /api/admin/export/:id/download full-record download (T-0520)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — Admin (full-record download 통과) / User (403 tier 미달).
  let adminCookie: string;
  let userCookie: string;
  // actor User row snapshot (id/email/role) — afterEach 의 truncate 후 동일 id 로 재
  // seed 하기 위해 보관 (ExportJob.requestedById FK 대상이 매 test 직전 존재해야 함).
  const ADMIN_EMAIL = "export-dl-admin@e2e.test";
  const USER_EMAIL = "export-dl-user@e2e.test";
  let actorSnapshots: Array<{
    id: string;
    email: string;
    role: string;
    hashedPassword: string;
  }>;

  beforeAll(async () => {
    // actor 2 종 seed (Admin / User) — Admin bypass 와 non-Admin 403 분기를 각
    // 적정 role token 으로 exercise. export entity 는 각 test 가 별도 seed.
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    // 원 actor User row 보존 — truncate 후 동일 id/email/role 로 재 seed 할 snapshot.
    // hashedPassword 는 not-null 컬럼 충족용 placeholder 재사용 (token 은 sub claim 만
    // 검증, password 무관).
    actorSnapshots = [ctx.users[ADMIN_EMAIL], ctx.users[USER_EMAIL]].map(
      (u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        hashedPassword: u.hashedPassword,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // reseedActors — truncate 가 비운 actor User 2종을 동일 id/email/role 로 재 seed.
  // JWT sub claim (= 원 User id) 이 그대로 유효하므로 token 재발급 불요. createMany 는
  // 단일 round-trip 으로 2 row 동시 삽입 (FK 대상 복원).
  async function reseedActors(): Promise<void> {
    await prisma.user.createMany({ data: actorSnapshots });
  }

  // 각 test 후 정리 — ExportJob 는 User onDelete: Restrict 라 truncateAll (User
  // CASCADE) 전에 먼저 비워야 한다. LlmProviderConfig 는 TRUNCATE_TABLES 미포함이라
  // 명시 deleteMany. Assessment 는 Person CASCADE 로 truncateAll 이 동반 정리. 마지막에
  // reseedActors 로 actor User 를 복원해 다음 test 의 createExportJob FK 를 충족시킨다.
  afterEach(async () => {
    await prisma.exportJob.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
    await prisma.assessment.deleteMany();
    await truncateAll(prisma);
    await reseedActors();
  });

  // seedFiveEntities — 5 export entity (Assessment / Person / Group /
  // LlmProviderConfig / PermissionDeniedRecord) 를 실 DB 에 각 1+ row seed. Assessment
  // 는 Person FK 선행 seed 필요. LlmProviderConfig 는 apiKey secret 포함 (download 에
  // 부재함을 단언할 sentinel). 반환: 후속 assert 에 활용할 식별 값들.
  async function seedFiveEntities(): Promise<{
    personId: string;
    personEmail: string;
    groupName: string;
  }> {
    const personEmail = `export-dl-person-${Date.now()}@e2e.test`;
    const person = await prisma.person.create({
      data: { fullName: "다운로드대상", email: personEmail },
    });
    await prisma.assessment.create({
      data: {
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: "0.75",
        volume: 10,
        narrative: "이번 주 기여 요약",
      },
    });
    const groupName = "다운로드그룹";
    await prisma.group.create({ data: { name: groupName } });
    // 🔥 secret 보유 entity — apiKey 를 실 DB 에 저장한다. download 본문에 부재함을
    // 단언할 sentinel (REQ-032 핵심 회귀).
    await prisma.llmProviderConfig.create({
      data: {
        provider: "openai",
        endpointUrl: "https://api.openai.com/v1",
        apiKey: SEED_API_KEY,
        modelId: "gpt-4o",
      },
    });
    await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/o/r/commits",
        httpStatus: 403,
        reason: "permission-denied",
      },
    });
    return { personId: person.id, personEmail, groupName };
  }

  // createExportJob — POST /api/admin/export 로 FULL scope export job 생성 후 그 id 반환.
  // controller 가 actor.sub (Admin) 를 requestedById 로 결합 — 실 User FK 충족.
  async function createExportJob(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(BASE)
      .set("Cookie", adminCookie)
      .send({ scope: "FULL" });
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    return response.body.id as string;
  }

  // -- A. Happy path (Admin full-record download — 200 + 헤더 + full dump) ----------

  // A.1 5 entity seed → export job 생성 → download → 200 + 다운로드 헤더 + 파싱 가능한
  // full-record dump (records/meta 구조). 최소 1 entity 의 fields 가 instant 외 실 컬럼
  // 을 보존함을 확인.
  it("GET :id/download — Admin 토큰 + 5 entity seed 시 200 + 다운로드 헤더 + full-record dump 본문 (happy)", async () => {
    await seedFiveEntities();
    const jobId = await createExportJob();

    const response = await request(app.getHttpServer())
      .get(`${BASE}/${jobId}/download`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((res, callback) => {
        // StreamableFile 응답은 octet-stream 이라 supertest 기본 json parse 가 안 됨 —
        // raw body 를 직접 모아 문자열로 받는다 (본문 byte 검증 + JSON.parse 용).
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => callback(null, data));
      });

    expect(response.status).toBe(200);
    // 다운로드 헤더 3종 존재 (descriptor single-source — ADR-0047 §Decision3(i)).
    expect(response.headers["content-type"]).toBeDefined();
    expect(response.headers["content-disposition"]).toMatch(/attachment/);
    expect(response.headers["content-length"]).toBeDefined();

    // 본문은 파싱 가능한 full-record dump (records / meta 구조).
    const bodyText = response.body as string;
    const dump = JSON.parse(bodyText) as {
      schemaVersion: string;
      generatedAt: string;
      entityCounts: Record<string, number>;
      recordCount: number;
      records: Array<{ entity: string; fields: Record<string, unknown> }>;
    };
    expect(dump.schemaVersion).toBeDefined();
    expect(dump.generatedAt).toBeDefined();
    expect(dump.entityCounts).toBeDefined();
    // 5 entity seed → recordCount 1+ (entity 당 1 row 이상).
    expect(dump.recordCount).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(dump.records)).toBe(true);

    // 최소 1 entity 의 fields 가 instant (createdAt) 외 실 컬럼을 보존. Person record
    // 의 fields 에 fullName / email 이 담겨야 한다 (allow-list 컬럼).
    const personRecord = dump.records.find((r) => r.entity === "Person");
    expect(personRecord).toBeDefined();
    expect(personRecord?.fields).toHaveProperty("fullName");
    expect(personRecord?.fields).toHaveProperty("email");
  });

  // -- B. Error path (findJob 부재 → 404 raw propagate) ------------------------------

  // B.1 존재하지 않는 export job id 로 download → 404 (findJob NotFoundException raw
  // propagate — controller 자체 분기 0).
  it("GET :id/download — 존재하지 않는 job id 시 404 (error — findJob NotFoundException raw propagate)", async () => {
    const response = await request(app.getHttpServer())
      .get(`${BASE}/nonexistent-job-id-404/download`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
  });

  // -- C. Flow / branch — 0-record (빈 DB) vs 1+record dump 의 두 분기 ----------------

  // C.1 seed 데이터 0건 (빈 DB) 의 export job download → 200 + 빈/0-record dump 경계
  // (collectFullExportRecords 가 빈 배열 → buildFullExportDump 가 recordCount 0 정상
  // 반환, throw 0). export job 자체는 actor User 만 있는 빈 DB 위에서 생성.
  it("GET :id/download — seed 0건 빈 DB 시 200 + 0-record dump (branch — 빈 결과 경계)", async () => {
    // entity seed 없이 export job 만 생성 (actor User row 외 도메인 데이터 0).
    const jobId = await createExportJob();

    const response = await request(app.getHttpServer())
      .get(`${BASE}/${jobId}/download`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => callback(null, data));
      });

    expect(response.status).toBe(200);
    const dump = JSON.parse(response.body as string) as {
      recordCount: number;
      records: unknown[];
    };
    // 빈 DB → 0-record dump 경계 (404 아님, throw 아님).
    expect(dump.recordCount).toBe(0);
    expect(dump.records).toEqual([]);
  });

  // -- D. Negative cases 충분 cover (RBAC + secret deny) ----------------------------

  // D.1 인증 없음 (cookie 부재) → 401 (JwtAuthGuard reject). negative — 인증 부재.
  it("GET :id/download — cookie 부재 시 401 (negative — 인증 부재)", async () => {
    await seedFiveEntities();
    const jobId = await createExportJob();

    const response = await request(app.getHttpServer()).get(
      `${BASE}/${jobId}/download`,
    );

    expect(response.status).toBe(401);
  });

  // D.2 non-Admin (User 역할) 토큰 → 403 (RolesGuard tier 미달). negative — 권한 부족.
  it("GET :id/download — User 역할 토큰 시 403 (negative — RolesGuard tier 미달)", async () => {
    await seedFiveEntities();
    const jobId = await createExportJob();

    const response = await request(app.getHttpServer())
      .get(`${BASE}/${jobId}/download`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
  });

  // D.3 🔥 핵심 회귀 (REQ-032) — LlmProviderConfig 를 apiKey 값과 함께 실 DB 에 seed 한
  // 뒤 download → 응답 본문 JSON 전체에 그 apiKey secret 문자열이 부재함을 단언
  // (not.toContain) + 파싱된 LlmConfig record 의 fields 에 apiKey key 부재. secret 이
  // 실 DB-read 경로 (collectFullExportRecords) 를 통과해도 다운로드에 누출 0 임을 실증.
  it("GET :id/download — seed apiKey secret 이 download 본문에 부재 (negative — REQ-032 핵심 회귀)", async () => {
    await seedFiveEntities();
    const jobId = await createExportJob();

    const response = await request(app.getHttpServer())
      .get(`${BASE}/${jobId}/download`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => callback(null, data));
      });

    expect(response.status).toBe(200);
    const bodyText = response.body as string;

    // (1) 응답 본문 byte 전체에 seed apiKey secret 문자열 부재 — query projection-only
    //     (select 에 apiKey 부재) + builder allow-list 단언이 secret 을 dump 에서 차단.
    expect(bodyText).not.toContain(SEED_API_KEY);

    // (2) 파싱된 LlmConfig record 의 fields 에 apiKey key 부재 — secret deny projection.
    const dump = JSON.parse(bodyText) as {
      records: Array<{ entity: string; fields: Record<string, unknown> }>;
    };
    const llmRecord = dump.records.find((r) => r.entity === "LlmConfig");
    expect(llmRecord).toBeDefined();
    expect(llmRecord?.fields).not.toHaveProperty("apiKey");
    // allow-list 컬럼은 보존 — provider / endpointUrl / modelId 는 fields 에 존재.
    expect(llmRecord?.fields).toHaveProperty("provider");
    expect(llmRecord?.fields).toHaveProperty("endpointUrl");
    expect(llmRecord?.fields).toHaveProperty("modelId");

    // seed 한 LlmProviderConfig 가 실제로 apiKey 를 DB 에 보유했음을 재확인 (secret 이
    // DB-read 경로를 통과했음에도 누출 0 임을 보강 — false-negative 방지).
    const stored = await prisma.llmProviderConfig.findFirst();
    expect(stored?.apiKey).toBe(SEED_API_KEY);
  });
});

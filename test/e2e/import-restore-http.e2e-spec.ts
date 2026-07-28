// import-restore-http.e2e-spec — `POST /api/admin/import` multipart 업로드 → 실 PostgreSQL
// 복원 왕복 e2e (T-1287, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행
// slice **3c-3d1**. T-1286 (PR #1177) 이 controller 의 interim guard 를
// `ImportJobRunnerService.runJob` 실 호출로 바꿔 배선 자체는 닫혔지만, 그때까지의 검증은 전부
// mock 경계였다 — `ImportJobService` · `ImportRestoreService` · `PrismaService` 가 모두 mock 인
// unit / supertest 뿐이고 **업로드된 dump 가 실 DB 위에서 실제로 row 를 되살리는지** 를 왕복으로
// 증명한 test 는 0 이었다 (T-1276 e2e 는 `$transaction` 원자성만, HTTP 경계 밖).
//
// 책임 (R-113 — unit 외 end-to-end CI 수행):
//   - 실 guard stack (JwtAuthGuard + RolesGuard + @Roles("Admin")) + `FileInterceptor("file")`
//     multipart 수신 + `create()` 3 단계 (파일 검증 → createJob → runJob) 를 실 PostgreSQL 위에서
//     supertest 로 exercise 한다.
//   - 왕복 경로: 실 DB seed → `POST /api/admin/export` + `GET /api/admin/export/:id/download` 로
//     **실제 dump 본문** 획득 → row 1 건 삭제 → 그 dump 를 `POST /api/admin/import` 에 업로드 →
//     응답 `status=SUCCEEDED` + `restoredRowCount` + **삭제된 row 부활** 을 실 DB 로 확인.
//   - 실패 경로에서도 업로드 raw 본문이 job row · 응답 어디에도 저장되지 않음 (REQ-032) 을
//     sentinel 문자열로 확인하고, 거부가 `$transaction` **시작 전** 이라 DB 변경이 0 임을 본다
//     (UC-07 §7.4).
//
// 실 DB 전략 (ADR-0004 §Decision — 다른 e2e 동일):
//   - mock override 없음 — `createAuthenticatedE2EApp()` 가 AppModule 부트스트랩 + actor user
//     seed + token 발급을 맡고, PrismaService 는 services.postgres 로 실 connection 을 쓴다.
//   - export / import job 은 controller 가 발화자 (actor.sub) 를 `requestedById` 로 결합하므로
//     반드시 HTTP 경계로 생성한다 — Admin token actor 의 User row 가 그 FK 대상이다.
//   - seed 제약 (본 slice 의 의도적 좁힘): `seedRestorableEntities` 는 **Group 1 + Person 1** 만
//     넣는다. `LlmProviderConfig` 는 full-record select 가 `apiKey` 를 명시 deny (ADR-0047
//     §Decision2) 해 dump 에 그 컬럼이 없고, REPLACE 재삽입이 not-null 위반으로 깨질 것이 예상
//     된다 — 본 slice 밖 표면이라 seed 하지 않는다 (그 entity 왕복 정책은 task Follow-ups).
//     `Assessment` · `PermissionDeniedRecord` 도 같은 이유로 범위 밖.
//   - 정리 순서: `ImportJob`/`ExportJob` 의 `requestedById → User` 는 `onDelete: Restrict` 라
//     job row 를 먼저 비워야 `truncateAll` (User 포함) 이 통과한다.
//   - 🔥 actor re-seed (선례 T-0520 round 2): `truncateAll` 이 actor User row 를 지우므로 다음
//     test 의 job 생성이 FK 위반 (`ImportJob_requestedById_fkey`) 으로 500 난다. 그래서 매
//     afterEach 마지막에 `reseedAuthenticatedActors` 로 **원본 id / email / role** 그대로 재
//     삽입한다 — JWT 의 sub claim (= 원 User id) 이 그대로 유효해 token 재발급이 불필요하다.
//
// 실 DB 미가용 환경 (로컬 — `DATABASE_URL` 부재) 에서는 globalSetup 이 fail-fast 하며 CI 의
// `pnpm test:e2e` step 에서만 실행된다 (다른 e2e 동일, 본 spec 만의 skip 분기 0). 파일은
// test/jest-e2e.json 의 `testRegex` 가 자동 picking 하므로 config 변경이 없다.
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

const IMPORT_BASE = "/api/admin/import";
const EXPORT_BASE = "/api/admin/export";
const ADMIN_EMAIL = "import-http-admin@e2e.test";

// 손상 dump 의 업로드 raw 본문 sentinel (REQ-032 핵심 회귀). 앞 글자가 `n` 이라 `JSON.parse` 가
// `null` 파싱을 시도하다 실패하므로 acceptance 의 "not-json" 과 같은 deserialize 실패 경로를 타되,
// 꼬리를 고유하게 두어 우연 매칭 없이 "job row · 응답에 raw 가 실렸는가" 만 정확히 잡는다.
const CORRUPT_DUMP_BODY = "not-json-T1287-raw-must-not-be-stored";
// 구조 위반 dump 의 payload sentinel — 유효 JSON 이지만 `records` 키가 없다.
const STRUCTURE_DUMP_SENTINEL = "T1287-structure-raw-must-not-be-stored";

describe("E2E: POST /api/admin/import 업로드 → 실 복원 왕복 (T-1287)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;

  beforeAll(async () => {
    // 본 slice 는 성공 경로 + 파싱 실패만 다루므로 actor 는 Admin 1 종이면 충분하다 (401 / 403
    // 거부 경계는 실행 slice 3c-3d2 의 책임 — task §Out of Scope).
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 정리 규율 — job row (User FK Restrict) → truncateAll → actor 재 seed 순서를 반드시 지킨다.
  afterEach(async () => {
    await prisma.importJob.deleteMany();
    await prisma.exportJob.deleteMany();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // seedRestorableEntities — 복원 왕복 대상 최소 seed (Group 1 + Person 1). 위 머리 주석의 seed
  // 제약대로 secret 보유 entity 는 넣지 않는다. DB 가 돌려준 row 를 그대로 반환하므로 후속
  // 단언이 실 `id` / `name` / `createdAt` 을 그대로 쓴다.
  async function seedRestorableEntities() {
    const group = await prisma.group.create({ data: { name: "복원대상그룹" } });
    const person = await prisma.person.create({
      data: {
        fullName: "복원대상",
        email: `import-http-person-${Date.now()}@e2e.test`,
      },
    });
    return { group, person };
  }

  // createExportJob — POST /api/admin/export 로 FULL scope job 을 만들고 그 id 를 돌려준다.
  async function createExportJob(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(EXPORT_BASE)
      .set("Cookie", adminCookie)
      .send({ scope: "FULL" });
    expect(response.status).toBe(201);
    return response.body.id as string;
  }

  // downloadDump — GET :id/download 응답 본문을 Buffer 로 돌려준다. StreamableFile 응답은
  // octet-stream 이라 supertest 기본 json parse 가 걸리지 않으므로 raw 본문을 직접 모은다
  // (export-download.e2e-spec 과 동일 parser — 본문 재가공 · 재직렬화 0).
  async function downloadDump(jobId: string): Promise<Buffer> {
    const response = await request(app.getHttpServer())
      .get(`${EXPORT_BASE}/${jobId}/download`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => callback(null, data));
      });
    expect(response.status).toBe(200);
    return Buffer.from(response.body as string, "utf-8");
  }

  // uploadDump — multipart 업로드 1 회. `mode` 는 form field 이며 미지정 시 field 자체를 보내지
  // 않는다 (schema `@default(REPLACE)` 분기를 실제로 타게 하려면 빈 문자열도 보내면 안 된다).
  function uploadDump(dump: Buffer, mode?: "REPLACE" | "MERGE") {
    const pending = request(app.getHttpServer())
      .post(IMPORT_BASE)
      .set("Cookie", adminCookie);
    if (mode !== undefined) {
      pending.field("mode", mode);
    }
    return pending.attach("file", dump, "dump.json");
  }

  // dump 본문의 record 수 — `restoredRowCount` 단언의 근거값 (assert 전용 파싱).
  function recordCountOf(dump: Buffer): number {
    return (JSON.parse(dump.toString("utf-8")) as { recordCount: number })
      .recordCount;
  }

  const counts = async () => ({
    group: await prisma.group.count(),
    person: await prisma.person.count(),
  });

  // -- A. Happy path (업로드 → REPLACE 복원 → 삭제된 row 부활) ------------------------

  it("dump 업로드 시 201 + SUCCEEDED + 삭제됐던 Group row 가 실 DB 에 부활한다 (happy)", async () => {
    const { group, person } = await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());
    // seed 는 Group 1 + Person 1 뿐 — dump record 수도 정확히 2 여야 한다.
    const recordCount = recordCountOf(dump);
    expect(recordCount).toBe(2);

    // 복원 대상 만들기 — Group row 1 건을 실제로 지운다.
    await prisma.group.delete({ where: { id: group.id } });
    expect(await prisma.group.count()).toBe(0);

    const response = await uploadDump(dump, "REPLACE");

    // (a)(b) HTTP 201 + job status.
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    // (c) restoredRowCount 는 dump record 수 = runner 의 `inserted` 와 일치한다.
    expect(response.body.restoredRowCount).toBe(recordCount);
    // negative (b) — REPLACE 의 선삭제분 (기존 Person 1 건) 이 합산되지 않는다 (초과 0).
    expect(response.body.restoredRowCount).toBeLessThanOrEqual(recordCount);
    // (d)(e) artifactRef 는 업로드 파일명 그대로, error 는 비어 있다.
    expect(response.body.artifactRef).toBe("dump.json");
    expect(response.body.error).toBeNull();

    // (f) 삭제됐던 Group 이 **동일 id** 로 되살아나고 name 도 seed 값 그대로다.
    const restored = await prisma.group.findUnique({ where: { id: group.id } });
    expect(restored?.name).toBe(group.name);
    // (g) Person 은 중복 없이 정확히 1 건 (id 보존 — 삭제 후 재삽입이라도 dump 의 id 를 쓴다).
    expect(await prisma.person.count()).toBe(1);
    expect((await prisma.person.findFirst())?.id).toBe(person.id);
    // negative (d) — 요청 1 회당 ImportJob row 도 정확히 1 건 (중복 job 0).
    expect(await prisma.importJob.count()).toBe(1);
  });

  // -- B. Error path (손상 dump → 400 + FAILED + raw 미저장 + DB 무변화) ---------------

  it("손상된 dump 업로드 시 400 + job FAILED + 업로드 raw 미저장 + DB 변경 0 (error)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadDump(
      Buffer.from(CORRUPT_DUMP_BODY, "utf-8"),
      "REPLACE",
    );

    // (a) 파싱 실패는 `$transaction` 을 열기 전에 400 으로 거부된다.
    expect(response.status).toBe(400);
    // (b) 실 DB 의 job row 는 FAILED + 사유 기록 + restoredRowCount 미기록.
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.error).toEqual(expect.any(String));
    expect(job.error?.length).toBeGreaterThan(0);
    expect(job.restoredRowCount).toBeNull();
    // (c) REQ-032 — 업로드 raw 본문이 job row 에도 응답 body 에도 실리지 않는다.
    expect(job.error).not.toContain(CORRUPT_DUMP_BODY);
    // negative (c) — 응답은 사람-친화 message 만이며 stack trace 조각이 없다.
    expect(JSON.stringify(response.body)).not.toContain(CORRUPT_DUMP_BODY);
    expect(response.body).not.toHaveProperty("stack");
    // (d) transaction 시작 전 거부 → row 수 불변 (UC-07 §7.4).
    expect(await counts()).toEqual(before);
  });

  // -- C. 분기 cover (mode form field 생략 → schema @default(REPLACE)) -----------------

  it("mode form field 를 생략하면 201 + SUCCEEDED + job.mode 가 REPLACE 확정값이다 (branch)", async () => {
    await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());

    const response = await uploadDump(dump);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    // schema `@default(REPLACE)` 로 확정된 job row 의 mode 가 runner 로 전달돼 복원이 완주한다.
    expect(response.body.mode).toBe("REPLACE");
    expect(response.body.restoredRowCount).toBe(recordCountOf(dump));
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.mode).toBe("REPLACE");
  });

  // -- D. negative — 구조 위반 dump (유효 JSON 이지만 records 키 없음) ------------------

  it("records 키가 없는 dump 업로드 시 400 + job FAILED + DB 변경 0 (negative)", async () => {
    await seedRestorableEntities();
    const before = await counts();
    const malformed = Buffer.from(
      JSON.stringify({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        note: STRUCTURE_DUMP_SENTINEL,
      }),
      "utf-8",
    );

    const response = await uploadDump(malformed, "REPLACE");

    expect(response.status).toBe(400);
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.restoredRowCount).toBeNull();
    // 구조 위반 안내에도 dump payload 는 실리지 않는다 (종류 이름만 — REQ-032).
    expect(job.error).not.toContain(STRUCTURE_DUMP_SENTINEL);
    expect(JSON.stringify(response.body)).not.toContain(
      STRUCTURE_DUMP_SENTINEL,
    );
    // 구조 검증 역시 transaction 이전 단락이라 row 수가 그대로다.
    expect(await counts()).toEqual(before);
  });
});

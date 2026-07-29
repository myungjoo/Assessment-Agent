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
// T-1289 (실행 slice **3c-3d4**) — 위 A~D 는 전부 `mode = REPLACE` 만 지난다. 아래 **section E**
// 가 `ImportMode.MERGE` 경로 (plan 의 merge 분기 → `buildImportRestoreDeleteWhere` 의 targeted
// delete → 실 `$transaction`) 를 실 DB 위에서 닫는다. 책임 3 가지:
//   - MERGE 는 dump 에 없는 **비충돌 기존 row 를 보존** 하면서 dump 의 row 를 추가한다 (UC-07
//     §6.2 — merge = 기존 보존 + file row 추가, conflict 시 file 우선).
//   - **같은 seed · 같은 dump 에 mode 만 바꾼** REPLACE test 를 나란히 두어 두 결과가 실제로
//     다름을 증거로 남긴다 — targeted delete 가 전면 삭제로 흘러 REPLACE 와 같아지는 회귀의 그물.
//   - 보존 대상 row 의 `createdAt` 은 **명시 고정 상수** 로 심는다. 충돌 판정 key 가
//     `(entity, instant)` 라, dump 안 어떤 record 와 같은 밀리초로 태어나면 보존이 삭제로 뒤집혀
//     test 가 간헐 실패한다 — 상수 지정이 그 경로를 원천 차단한다.
//
// T-1293 (실행 slice **3c-3d5**) — 아래 **section F** 가 UC-07 §6.2 의 나머지 절반, 곧 **부분
// dump (§6.1 PARTIAL) 와 mode 의 조합** (staging seed / cross-instance migration) 을 닫는다.
// 전제: T-1291 이 다운로드 경로에 scope 선별을 배선하고 T-1292 가 "PARTIAL dump 는 실제로 부분"
// 을 실 사실로 닫기 전까지 dump 는 scope 와 무관하게 늘 5 entity 전부여서 이 조합을 관측할 실
// 경로 자체가 없었다. 대조 축은 복원 service 가 기존 record 를 `collectFullExportRecords` 로
// **DB 전체** 에서 읽는다는 점이다 — dump 가 Group 만 담아도 REPLACE 의 삭제 범위는 기존 전부라
// 비선별 Person 까지 지우고, MERGE 만이 그것을 보존한다. 그래서 **같은 부분 dump 에 mode 만
// 바꾸는** 구성이 §6.2 문장을 실 사실로 박제하는 동시에, 보존이 전면 삭제로 흐르는 회귀의 그물이
// 된다.
//
// T-1300 (실행 slice **3c-5c**) — 아래 **section H** 가 T-1299 이 배선한 `POST /api/admin/
// import/preview` (복원을 **실행하지 않고** 영향 요약만 내는 dry-run) 의 계약을 실 HTTP 왕복으로
// 닫는다. 그때까지 그 endpoint 의 증거는 controller unit + mock 경계 supertest 뿐이었고 실
// PostgreSQL 위의 export → download → preview → 실행 왕복은 한 번도 돌지 않았다. 책임 2 가지:
//   - **preview 수치 ↔ 실행 후 `restoreSummary` 정확 일치** — 같은 dump 를 preview 로 한 번,
//     실행으로 한 번 올려 두 요약을 `toEqual` 로 맞춘다. preview 가 DB 를 바꿨다면 실행 시 plan
//     이 달라져 이 단언이 깨지므로 두 계약이 한 단언에 함께 묶인다.
//   - **DB write 0** — preview 뒤 entity row 수 무변화 + `ImportJob` row **0 건** + `ExportJob`
//     row 는 dump 생성분 그대로임을 실 DB 조회로 확인한다. 이것이 UC-07 §5 sequence 64 행
//     confirmation 의 "영향 범위" 가 실사용에서 신뢰 가능한 수치라는 마지막 증거다.
// 명명 주의 — task 정의서는 새 구간을 "section G" 로 적었으나 그 이름은 T-1296 (restoreSummary
// envelope) 이 이미 쓰고 있어 **section H** 로 이어 붙인다 (기존 A~G 는 한 줄도 수정 0).
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

// -- section E (T-1289, MERGE mode) 전용 상수 -----------------------------------------
// 보존 대상 Group 의 이름 · 생성 시각. `createdAt` 은 dump 생성 시각보다 확실히 이전인 **고정
// 상수** 다 — 충돌 판정 key 가 `(entity, instant)` 라 dump 안 record 와 같은 밀리초로 태어나면
// 보존 대상이 충돌로 분류돼 삭제된다 (머리 주석 T-1289 참조).
const PRESERVED_GROUP_NAME = "머지보존그룹";
const PRESERVED_GROUP_CREATED_AT = new Date("2020-01-02T03:04:05.678Z");
// MERGE 거부 경로의 sentinel 2 종 — 위 REPLACE 용과 같은 형식이되 값을 분리해 두 경로의 누출을
// 서로 구분해 잡는다.
const MERGE_CORRUPT_DUMP_BODY = "not-json-T1289-merge-raw-must-not-be-stored";
const MERGE_STRUCTURE_SENTINEL = "T1289-merge-structure-raw-must-not-be-stored";

// -- section F (T-1293, 부분 dump + mode 조합) 전용 상수 --------------------------------
// PARTIAL 선별 job 의 생성 body — entity 축 하나 (`Group`) 로 좁힌 부분 dump 를 만든다
// (T-1292 가 export e2e 에서 쓴 body shape 그대로).
const PARTIAL_GROUP_ONLY_BODY = {
  scope: "PARTIAL",
  entitySelector: ["Group"],
};
// 부분 dump 거부 경로의 sentinel — 위 두 종과 같은 형식이되 값을 분리해 경로별 누출을 구분한다.
const PARTIAL_CORRUPT_DUMP_BODY =
  "not-json-T1293-partial-raw-must-not-be-stored";

// -- section H (T-1300, preview dry-run) 전용 상수 --------------------------------------
// whitelist 밖 form field 의 값 — DTO 에 없는 키가 400 으로 막히는지만 보므로 본문 의미는 없다.
const PREVIEW_NON_WHITELISTED_SENTINEL = "T1300-preview-non-whitelisted";

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

  // createExportJob — POST /api/admin/export 로 job 을 만들고 그 id 를 돌려준다. 인자를 생략하면
  // 기존 그대로 FULL scope 이며 (section A~E 호출부 무변경), section F 만 PARTIAL scope body 를
  // 넘겨 부분 dump 를 얻는다 (T-1293 — T-1292 가 export e2e 에서 쓴 선택 인자화 형식 그대로).
  async function createExportJob(
    body: Record<string, unknown> = { scope: "FULL" },
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(EXPORT_BASE)
      .set("Cookie", adminCookie)
      .send(body);
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
    // (c) + negative (b) — restoredRowCount 는 runner 계약대로 `inserted` 만이며 REPLACE 의
    // 선삭제분 (남아 있던 Person 1 건) 이 합산되지 않는다. 합산했다면 recordCount + 1 (= 3) 이
    // 되므로 아래 정확 일치 단언 하나가 그 회귀를 그대로 잡는다 (별도 상한 단언은 동어반복).
    expect(response.body.restoredRowCount).toBe(recordCount);
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
    // (c) REQ-032 — 업로드 raw 본문이 job row 에도 응답 body 에도 실리지 않는다. 전체 sentinel
    // 만 보면 `JSON.parse` 가 앞부분만 잘라 실은 message (예: `"not-json-T"...`) 를 통과시키므로
    // **접두 조각** 도 함께 막는다 (reviewer round 1 MINOR — 절단 누출 회귀).
    expect(job.error).not.toContain(CORRUPT_DUMP_BODY);
    expect(job.error).not.toContain("not-json");
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

  // -- E. MERGE mode (보존 vs 전면교체 분기, T-1289) ------------------------------------

  // seedGroupAbsentFromDump — dump 에 **들어가지 않은** 기존 Group 1 건을 심는다. `createdAt` 을
  // 고정 상수로 지정해 dump 안 어떤 record 의 instant 와도 겹치지 않게 한다 (밀리초 충돌로 보존이
  // 삭제로 뒤집히는 간헐 실패 차단). DB 가 돌려준 row 를 그대로 반환한다.
  async function seedGroupAbsentFromDump() {
    return prisma.group.create({
      data: {
        name: PRESERVED_GROUP_NAME,
        createdAt: PRESERVED_GROUP_CREATED_AT,
      },
    });
  }

  // arrangeMergeFixture — MERGE / REPLACE 두 test 가 공유하는 **동일 출발 상태** 를 만든다:
  // (1) Group G1 + Person P1 seed → (2) 실 export 왕복으로 dump 획득 (record 2 건) → (3) G1 삭제 +
  // dump 에 없는 Group G2 생성. 이후 두 test 는 mode 만 다르게 업로드하므로, 결과 차이가 곧 mode
  // 분기의 증거가 된다.
  async function arrangeMergeFixture() {
    const { group, person } = await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());
    expect(recordCountOf(dump)).toBe(2);

    await prisma.group.delete({ where: { id: group.id } });
    const preserved = await seedGroupAbsentFromDump();
    // 출발 상태 확정 — Group 은 보존 대상 G2 1 건뿐이고 dump 의 G1 은 부재다.
    expect(await prisma.group.count()).toBe(1);
    return { dump, group, person, preserved };
  }

  it("MERGE 업로드 시 201 + SUCCEEDED + 비충돌 기존 Group 보존 + dump 의 Group 부활 (happy)", async () => {
    const { dump, group, person, preserved } = await arrangeMergeFixture();

    const response = await uploadDump(dump, "MERGE");

    // (a)(b)(c) HTTP 201 + job status + mode 가 요청대로 MERGE 다.
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("MERGE");
    // negative (b) — restoredRowCount 는 dump 의 record 수와 **정확히 일치** 한다 (보존된 G2 를
    // 합산하지 않는다 — 합산했다면 3 이 되므로 이 정확 일치 단언이 그대로 잡는다).
    expect(response.body.restoredRowCount).toBe(recordCountOf(dump));

    // (d) 삭제됐던 G1 이 동일 id 로 부활한다 (merge 는 incoming 전부 삽입).
    const restored = await prisma.group.findUnique({ where: { id: group.id } });
    expect(restored?.name).toBe(group.name);
    // (e) 보존 대상 G2 는 id · name 그대로 살아 있다 (targeted delete 가 건드리지 않았다).
    const kept = await prisma.group.findUnique({
      where: { id: preserved.id },
    });
    expect(kept?.name).toBe(PRESERVED_GROUP_NAME);
    // negative (c) — createdAt 이 seed 값과 동일: 보존이 "삭제 후 재삽입" 이 아니라 무손상이다.
    expect(kept?.createdAt.toISOString()).toBe(
      PRESERVED_GROUP_CREATED_AT.toISOString(),
    );
    // (f) 결과 집계 — Group 은 부활분 + 보존분 2 건, Person 은 중복 없이 1 건 (id 보존).
    expect(await prisma.group.count()).toBe(2);
    expect(await prisma.person.count()).toBe(1);
    expect((await prisma.person.findFirst())?.id).toBe(person.id);
    // (g) 실 DB 의 ImportJob row 도 MERGE 이며, negative (d) — 요청 1 회당 job 은 정확히 1 건.
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.mode).toBe("MERGE");
    expect(await prisma.importJob.count()).toBe(1);
  });

  it("같은 dump·같은 상태에 REPLACE 를 보내면 보존 대상 Group 이 사라진다 (branch)", async () => {
    const { dump, group, preserved } = await arrangeMergeFixture();

    const response = await uploadDump(dump, "REPLACE");

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("REPLACE");
    // 위 happy test 와 **입력이 같고 mode 만 다르다** — 그런데 G2 는 사라지고 dump 의 G1 만 남는다.
    // 이 대비가 mode 분기를 DB 결과로 구분하는 증거다.
    expect(
      await prisma.group.findUnique({ where: { id: preserved.id } }),
    ).toBeNull();
    expect(await prisma.group.count()).toBe(1);
    expect((await prisma.group.findFirst())?.id).toBe(group.id);
  });

  it("MERGE 로 손상 dump 업로드 시 400 + FAILED + raw 미저장 + 보존분 포함 DB 변경 0 (error)", async () => {
    const { preserved } = await arrangeMergeFixture();
    const before = await counts();

    const response = await uploadDump(
      Buffer.from(MERGE_CORRUPT_DUMP_BODY, "utf-8"),
      "MERGE",
    );

    // (a) 파싱 실패는 mode 와 무관하게 `$transaction` 이전에 400 으로 거부된다.
    expect(response.status).toBe(400);
    // (b) job row 는 FAILED + restoredRowCount 미기록 + mode 는 요청대로 MERGE 다.
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.mode).toBe("MERGE");
    expect(job.restoredRowCount).toBeNull();
    // negative (a) — REQ-032: 업로드 raw 도 그 **접두 조각** 도 job row · 응답에 실리지 않는다.
    expect(job.error).not.toContain(MERGE_CORRUPT_DUMP_BODY);
    expect(job.error).not.toContain("not-json");
    expect(JSON.stringify(response.body)).not.toContain(
      MERGE_CORRUPT_DUMP_BODY,
    );
    // (c) 거부는 transaction 이전 단락 — 보존 대상 G2 를 포함해 row 수가 그대로다.
    expect(await counts()).toEqual(before);
    const kept = await prisma.group.findUnique({
      where: { id: preserved.id },
    });
    expect(kept?.createdAt.toISOString()).toBe(
      PRESERVED_GROUP_CREATED_AT.toISOString(),
    );
    // negative (d) — 거부 요청도 job row 는 정확히 1 건이다.
    expect(await prisma.importJob.count()).toBe(1);
  });

  it("MERGE 로 records 키 없는 dump 업로드 시 400 + FAILED + 보존 대상 무손상 (negative)", async () => {
    const { preserved } = await arrangeMergeFixture();
    const before = await counts();
    const malformed = Buffer.from(
      JSON.stringify({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        note: MERGE_STRUCTURE_SENTINEL,
      }),
      "utf-8",
    );

    const response = await uploadDump(malformed, "MERGE");

    // 구조 위반은 파싱 실패와 다른 stage 지만 거부 지점은 같다 (transaction 이전 단락).
    expect(response.status).toBe(400);
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.mode).toBe("MERGE");
    expect(job.restoredRowCount).toBeNull();
    // 구조 위반 안내에도 dump payload 는 실리지 않는다 (종류 이름만 — REQ-032).
    expect(job.error).not.toContain(MERGE_STRUCTURE_SENTINEL);
    expect(JSON.stringify(response.body)).not.toContain(
      MERGE_STRUCTURE_SENTINEL,
    );
    expect(await counts()).toEqual(before);
    expect(
      await prisma.group.findUnique({ where: { id: preserved.id } }),
    ).not.toBeNull();
  });

  // -- F. 부분 dump + mode 조합 (UC-07 §6.2 migration 계약, T-1293) ---------------------

  // dump 본문의 entity 목록 — 부분성 (선별이 실제로 반영됐는가) 단언 전용 파싱.
  function recordEntitiesOf(dump: Buffer): string[] {
    return (
      JSON.parse(dump.toString("utf-8")) as {
        records: Array<{ entity: string }>;
      }
    ).records.map((record) => record.entity);
  }

  // arrangePartialDumpFixture — F 의 MERGE / REPLACE 두 test 가 공유하는 **동일 출발 상태**:
  // (1) Group G1 + Person P1 seed → (2) PARTIAL([Group]) job 으로 **부분 dump** 획득 → (3) 부분성
  // 확정 (record 1 건이고 전부 Group) → (4) G1 만 삭제하고 **P1 은 그대로 둔다**. dump 에 없는
  // 비선별 entity 의 운명이 본 section 의 관측 대상이라, 두 test 는 여기서 mode 만 달리한다.
  async function arrangePartialDumpFixture() {
    const { group, person } = await seedRestorableEntities();
    const dump = await downloadDump(
      await createExportJob(PARTIAL_GROUP_ONLY_BODY),
    );
    expect(recordCountOf(dump)).toBe(1);
    expect(recordEntitiesOf(dump)).toEqual(["Group"]);

    await prisma.group.delete({ where: { id: group.id } });
    // 출발 상태 확정 — dump 의 G1 은 부재이고 dump 에 없는 P1 만 남아 있다.
    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.person.count()).toBe(1);
    return { dump, group, person };
  }

  it("부분 dump + MERGE 는 비선별 Person 을 보존한 채 Group 만 복원한다 (happy — §6.2 조합)", async () => {
    const { dump, group, person } = await arrangePartialDumpFixture();

    const response = await uploadDump(dump, "MERGE");

    // (a)(b)(c) HTTP 201 + job status + mode 가 요청대로 MERGE 다.
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("MERGE");
    // negative (b) — restoredRowCount 는 **부분 dump 의 record 수 (= 1) 와 정확히 일치** 하며
    // 보존된 P1 을 합산하지 않는다 (합산했다면 2 — 이 정확 일치 단언이 그 회귀를 그대로 잡는다).
    expect(response.body.restoredRowCount).toBe(recordCountOf(dump));
    expect(response.body.restoredRowCount).toBe(1);

    // (d) 부분 dump 의 G1 이 **동일 id** 로 부활하고 name 도 seed 값 그대로다.
    const restored = await prisma.group.findUnique({ where: { id: group.id } });
    expect(restored?.name).toBe(group.name);
    // (e) dump 에 없던 P1 이 무손상으로 남는다 — id · email 그대로. negative (c) — createdAt 도
    // 요청 전후 동일해, 보존이 "삭제 후 재삽입" 이 아니라 진짜 손대지 않음을 확인한다.
    const kept = await prisma.person.findUnique({ where: { id: person.id } });
    expect(kept?.email).toBe(person.email);
    expect(kept?.createdAt.toISOString()).toBe(person.createdAt.toISOString());
    // (f) 결과 집계 — 부활한 Group 1 건 + 보존된 Person 1 건.
    expect(await prisma.group.count()).toBe(1);
    expect(await prisma.person.count()).toBe(1);
    // (g) 실 DB 의 job row 도 MERGE 이며, negative (d) — 요청 1 회당 job 은 정확히 1 건.
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.mode).toBe("MERGE");
    expect(await prisma.importJob.count()).toBe(1);
  });

  it("같은 부분 dump 에 REPLACE 를 보내면 비선별 Person 이 사라진다 (branch — 현행 계약 박제)", async () => {
    const { dump, group } = await arrangePartialDumpFixture();

    const response = await uploadDump(dump, "REPLACE");

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("REPLACE");
    // 위 happy 와 **입력이 같고 mode 만 다르다** — 그런데 dump 에 없던 P1 까지 사라진다. 복원
    // service 가 기존 record 를 DB 전체에서 읽어 REPLACE 의 삭제 범위가 "기존 전부" 이기 때문이다.
    // 본 test 는 현행 계약을 박제할 뿐 그것이 바람직하다고 주장하지 않는다 (부분 dump 에 REPLACE
    // 를 막을지 · 경고할지는 제품 결정이라 task Follow-ups 의 사람 판단 대상).
    expect(await prisma.person.count()).toBe(0);
    expect(await prisma.group.count()).toBe(1);
    expect((await prisma.group.findFirst())?.id).toBe(group.id);
  });

  it("Group row 0 상태의 빈 부분 dump 를 MERGE 해도 복원 0 + Person 무손상 (branch — 빈 선별)", async () => {
    const person = await prisma.person.create({
      data: {
        fullName: "비선별보존",
        email: `import-http-partial-${Date.now()}@e2e.test`,
      },
    });
    const dump = await downloadDump(
      await createExportJob(PARTIAL_GROUP_ONLY_BODY),
    );
    // Group row 가 하나도 없으니 선별 결과가 빈 dump — 그 자체는 정상 dump 다 (T-1292 가 export
    // 측에서 닫은 사실).
    expect(recordCountOf(dump)).toBe(0);

    const response = await uploadDump(dump, "MERGE");

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.restoredRowCount).toBe(0);
    // 빈 dump 가 wipe 로 흐르지 않는다 — MERGE 의 삭제 대상은 충돌분뿐이라 P1 이 그대로 남는다.
    expect(await prisma.person.count()).toBe(1);
    expect((await prisma.person.findFirst())?.id).toBe(person.id);
  });

  it("부분 dump 자리에 손상 본문을 MERGE 로 올리면 400 + FAILED + raw 미저장 + DB 변경 0 (error)", async () => {
    await arrangePartialDumpFixture();
    const before = await counts();

    const response = await uploadDump(
      Buffer.from(PARTIAL_CORRUPT_DUMP_BODY, "utf-8"),
      "MERGE",
    );

    // (a) 파싱 실패는 dump 의 부분성과 무관하게 `$transaction` 이전에 400 으로 거부된다.
    expect(response.status).toBe(400);
    // (b) job row 는 FAILED + mode MERGE + restoredRowCount 미기록.
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.mode).toBe("MERGE");
    expect(job.restoredRowCount).toBeNull();
    // negative (a) — REQ-032: 업로드 raw 도 그 **접두 조각** 도 job row · 응답에 실리지 않는다.
    expect(job.error).not.toContain(PARTIAL_CORRUPT_DUMP_BODY);
    expect(job.error).not.toContain("not-json");
    expect(JSON.stringify(response.body)).not.toContain(
      PARTIAL_CORRUPT_DUMP_BODY,
    );
    // (c) 거부는 transaction 이전 단락 — Group / Person row 수가 요청 전과 동일하다.
    expect(await counts()).toEqual(before);
    // negative (d) — 거부 요청도 job row 는 정확히 1 건이다 (중복 job 0).
    expect(await prisma.importJob.count()).toBe(1);
  });

  // -- G. 응답 envelope 의 복원 영향 요약 (restoreSummary, T-1296) -----------------------
  //
  // 여기까지의 A~F 는 응답의 `status` / `mode` / `restoredRowCount` 만 관측했다. T-1296 이
  // `create` 를 `{ ...job, restoreSummary }` spread 로 넓혔으므로, 그 요약이 **실 HTTP 왕복
  // body 로 관측된다** 는 사실을 여기서 박제한다. 두 case 는 `arrangeMergeFixture` 의 동일
  // 출발 상태에 mode 만 달리해, 요약 수치가 mode 분기를 그대로 반영함을 대비로 보인다.
  //
  // 출발 상태 (arrangeMergeFixture): 기존 DB = 보존 대상 Group G2 + Person P1, dump = 삭제된
  // Group G1 + Person P1 (record 2 건). 충돌 판정 key 는 (entity, instant) 라 —
  //   - MERGE: P1 만 충돌 → deleted = Person 1, kept = Group 1 (G2 보존), inserted = 2.
  //   - REPLACE: 기존 전부 삭제 → deleted = Group 1 + Person 1, kept = 0, inserted = 2.

  it("MERGE 응답 body 에 restoreSummary 가 실려 보존·삽입 수치가 관측된다 (happy — envelope 확장)", async () => {
    const { dump, preserved } = await arrangeMergeFixture();

    const response = await uploadDump(dump, "MERGE");

    // (a) 기존 필드는 종전 그대로다 — 요약은 additive 로만 얹혔다 (무변화의 실 왕복 증거).
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("MERGE");
    expect(response.body.restoredRowCount).toBe(recordCountOf(dump));
    // (b) 보존된 Group G2 가 kept 수치로 관측된다 (MERGE 가 비충돌 기존을 지우지 않음).
    expect(response.body.restoreSummary.kept.total).toBe(1);
    expect(response.body.restoreSummary.kept.perEntity.Group).toBe(1);
    // (c) 삽입 수치는 dump 의 record 수와 정합한다 (incoming 전부 삽입).
    expect(response.body.restoreSummary.inserted.total).toBe(
      recordCountOf(dump),
    );
    // (d) MERGE 의 삭제는 **충돌분뿐** — dump 와 같은 (entity, instant) 인 Person 1 건이며
    //     비충돌 Group 은 0 이다 (전면 삭제로 흐르면 여기서 잡힌다).
    expect(response.body.restoreSummary.deleted.perEntity.Group).toBe(0);
    expect(response.body.restoreSummary.deleted.perEntity.Person).toBe(1);
    expect(response.body.restoreSummary.deleted.total).toBe(1);
    // (e) 요약 수치는 실 DB 결과와 정합하다 — 보존분 G2 가 실제로 남아 있다.
    expect(
      await prisma.group.findUnique({ where: { id: preserved.id } }),
    ).not.toBeNull();
    // negative — 중첩 envelope 가 아니라 spread 다 (`summary` / `job` key 부재).
    expect(response.body).not.toHaveProperty("summary");
    expect(response.body).not.toHaveProperty("job");
  });

  it("같은 dump 를 REPLACE 로 올리면 restoreSummary.deleted 에 entity 별 삭제 수치가 잡히고 kept 가 0 이다 (branch)", async () => {
    const { dump } = await arrangeMergeFixture();

    const response = await uploadDump(dump, "REPLACE");

    // 기존 필드 무변화 — 위 MERGE case 와 입력이 같고 mode 만 다르다.
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("SUCCEEDED");
    expect(response.body.mode).toBe("REPLACE");
    expect(response.body.restoredRowCount).toBe(recordCountOf(dump));
    // REPLACE 는 기존 전부 삭제 — 보존 대상 Group G2 + Person P1 이 entity 별로 잡힌다.
    expect(response.body.restoreSummary.deleted.perEntity.Group).toBe(1);
    expect(response.body.restoreSummary.deleted.perEntity.Person).toBe(1);
    expect(response.body.restoreSummary.deleted.total).toBe(2);
    // 보존은 0 — 위 MERGE 의 kept 1 과의 대비가 mode 분기를 요약 수치로 구분하는 증거다.
    expect(response.body.restoreSummary.kept.total).toBe(0);
    expect(response.body.restoreSummary.inserted.total).toBe(
      recordCountOf(dump),
    );
    // negative — 0 값 entity key 도 직렬화 왕복에서 보존된다 (key 누락 0).
    expect(
      Object.keys(response.body.restoreSummary.kept.perEntity).sort(),
    ).toEqual(["Assessment", "AuditLog", "Group", "LlmConfig", "Person"]);
    expect(response.body.restoreSummary.deleted.perEntity.Assessment).toBe(0);
  });

  // -- H. preview dry-run (복원 미실행 + 영향 요약만, T-1300) ---------------------------
  //
  // A~G 는 전부 실행 경로 (`POST /api/admin/import`) 다. 아래는 T-1299 이 연 dry-run
  // (`POST ${IMPORT_BASE}/preview`) 을 같은 harness 위에서 닫는다. 관측 축 2 개 — 수치 일치
  // (preview ↔ 실행) 와 DB 무변화 (entity row · ImportJob row 0 · ExportJob row) 이며, 둘은
  // 서로를 보강한다: preview 가 DB 를 건드렸다면 이어지는 실행의 plan 이 달라져 `toEqual` 이
  // 깨진다. 성공 응답이 200 이 아니라 **201** 인 것은 handler 가 `@Post` 이고 `@HttpCode` 를
  // 쓰지 않기 때문이다 (controller 계약 그대로 박제).

  // uploadPreview — preview multipart 업로드 1 회. `uploadDump` 와 같은 형식이며 (mode 미지정
  // 시 form field 자체를 보내지 않는다 — controller 의 `?? ImportMode.REPLACE` fallback 을 실제로
  // 타게 하려면 빈 문자열도 보내면 안 된다) 목적지만 `${IMPORT_BASE}/preview` 다.
  function uploadPreview(dump: Buffer, mode?: "REPLACE" | "MERGE") {
    const pending = request(app.getHttpServer())
      .post(`${IMPORT_BASE}/preview`)
      .set("Cookie", adminCookie);
    if (mode !== undefined) {
      pending.field("mode", mode);
    }
    return pending.attach("file", dump, "dump.json");
  }

  it("preview 는 201 + 요약 3 그룹을 내고 DB 를 한 row 도 바꾸지 않으며 이어진 실행의 restoreSummary 와 정확히 일치한다 (happy)", async () => {
    const { group } = await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());
    await prisma.group.delete({ where: { id: group.id } });
    const before = await counts();
    const exportJobsBefore = await prisma.exportJob.count();

    const preview = await uploadPreview(dump, "REPLACE");

    // (a) 201 + body 는 `RestorePlanSummary` **그대로** 다 — 3 그룹 각각 `{total, perEntity}` 이고
    //     wrapper key 가 없다 (아래 toEqual 이 key 집합까지 정확히 고정한다).
    expect(preview.status).toBe(201);
    const breakdownShape = {
      total: expect.any(Number),
      perEntity: expect.any(Object),
    };
    expect(preview.body).toEqual({
      deleted: breakdownShape,
      inserted: breakdownShape,
      kept: breakdownShape,
    });
    // (b) 삽입 수치는 dump 의 record 수와 정합 — 실행 **전** 에 이미 관측된다.
    expect(preview.body.inserted.total).toBe(recordCountOf(dump));
    // (c) REPLACE 라 남아 있던 Person 1 건이 삭제 대상으로 잡히고 보존은 0 이다.
    expect(preview.body.deleted.perEntity.Person).toBe(1);
    expect(preview.body.kept.total).toBe(0);

    // (d) DB write 0 — entity row 수 무변화 + ImportJob row **0 건** (dry-run 이 job 을 남기지
    //     않는다는 것이 본 slice 의 핵심 계약) + ExportJob 은 dump 생성분 그대로다.
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);
    expect(await prisma.exportJob.count()).toBe(exportJobsBefore);

    // (e) 이제 **같은 dump** 를 실행하면 그 restoreSummary 가 preview body 와 정확히 같다.
    //     preview 가 DB 를 바꿨다면 plan 이 달라져 여기서 깨진다 — 수치 일치와 DB 무변화가 한
    //     단언에 함께 묶이는 지점이다.
    const executed = await uploadDump(dump, "REPLACE");
    expect(executed.status).toBe(201);
    expect(executed.body.status).toBe("SUCCEEDED");
    expect(executed.body.restoreSummary).toEqual(preview.body);
  });

  it("MERGE preview 도 실행 후 restoreSummary 와 일치하며 보존 수치가 0 이 아니다 (happy — mode 반영)", async () => {
    const { dump } = await arrangeMergeFixture();
    const before = await counts();

    const preview = await uploadPreview(dump, "MERGE");

    expect(preview.status).toBe(201);
    // 보존 대상 G2 가 실행 **전** 에 kept 수치로 보인다 — MERGE 가 비충돌 기존을 지우지 않는다는
    // 사실이 confirmation 시점에 이미 관측 가능하다는 뜻이다 (kept 가 늘 0 이면 여기서 깨진다).
    expect(preview.body.kept.total).toBe(1);
    expect(preview.body.kept.perEntity.Group).toBe(1);
    expect(preview.body.inserted.total).toBe(recordCountOf(dump));
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);

    const executed = await uploadDump(dump, "MERGE");
    expect(executed.status).toBe(201);
    expect(executed.body.status).toBe("SUCCEEDED");
    expect(executed.body.restoreSummary).toEqual(preview.body);
  });

  it("mode form field 를 생략한 preview 는 REPLACE preview 와 완전히 동일한 요약을 낸다 (branch — default mirror)", async () => {
    const { dump } = await arrangeMergeFixture();

    const implicit = await uploadPreview(dump);
    const explicit = await uploadPreview(dump, "REPLACE");
    const merged = await uploadPreview(dump, "MERGE");

    expect(implicit.status).toBe(201);
    // controller 의 `dto.mode ?? ImportMode.REPLACE` 가 실행 경로가 타는 schema `@default(REPLACE)`
    // 를 실제로 mirror 한다는 **실 HTTP 증거** 다. 한쪽 default 만 바뀌면 두 경로가 조용히 어긋
    // 나는데 (controller 주석이 지목한 drift 지점), 그때 본 단언이 깨져 그것을 잡는다.
    expect(implicit.body).toEqual(explicit.body);
    // 대비 — 같은 출발 상태에서 MERGE 는 다른 수치를 낸다 (보존 대상 G2 가 kept 로 잡힘). 그래서
    // 위 일치가 "mode 를 아예 안 보는" 동어반복이 아니다.
    expect(merged.body).not.toEqual(implicit.body);
    expect(implicit.body.kept.total).toBe(0);
    // preview 를 세 번 보내도 job row 는 0 이다 (반복 호출이 흔적을 남기지 않는다).
    expect(await prisma.importJob.count()).toBe(0);
  });

  it("파싱 불가 본문을 preview 로 올리면 400 + raw 미노출 + DB 변경 0 + job row 0 (error)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadPreview(
      Buffer.from(CORRUPT_DUMP_BODY, "utf-8"),
      "REPLACE",
    );

    // (a) 거부 verdict 는 400 이며 `$transaction` 은 애초에 열리지 않는다 (previewFromDump 계약).
    expect(response.status).toBe(400);
    // (b) REQ-032 — 업로드 raw 도 그 **접두 조각** 도 응답에 실리지 않는다. 실행 경로와 달리
    //     저장될 job row 자체가 없어 누출 표면은 응답 body 하나뿐이다.
    expect(JSON.stringify(response.body)).not.toContain(CORRUPT_DUMP_BODY);
    expect(JSON.stringify(response.body)).not.toContain("not-json");
    expect(response.body).not.toHaveProperty("stack");
    // (c) 거부 요청도 DB 를 바꾸지 않고 job row 를 남기지 않는다.
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);
  });

  it("파일 미첨부 preview 는 400 + DB 변경 0 + job row 0 (negative — 파일 누락)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await request(app.getHttpServer())
      .post(`${IMPORT_BASE}/preview`)
      .set("Cookie", adminCookie)
      .field("mode", "REPLACE");

    expect(response.status).toBe(400);
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);
  });

  it("미인증 preview 는 401 이고 요약이 새지 않는다 (negative — guard 가 파일 파싱보다 먼저)", async () => {
    await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());
    const before = await counts();

    const response = await request(app.getHttpServer())
      .post(`${IMPORT_BASE}/preview`)
      .field("mode", "REPLACE")
      .attach("file", dump, "dump.json");

    // 유효한 dump 를 실어 보내도 guard 가 먼저 차단하므로 요약 필드가 응답에 없다.
    expect(response.status).toBe(401);
    expect(response.body).not.toHaveProperty("inserted");
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);
  });

  it("DTO 에 없는 form field 를 실은 preview 는 400 (negative — forbidNonWhitelisted)", async () => {
    await seedRestorableEntities();
    const dump = await downloadDump(await createExportJob());
    const before = await counts();

    const response = await request(app.getHttpServer())
      .post(`${IMPORT_BASE}/preview`)
      .set("Cookie", adminCookie)
      .field("mode", "REPLACE")
      .field("rawBody", PREVIEW_NON_WHITELISTED_SENTINEL)
      .attach("file", dump, "dump.json");

    // whitelist 차단이라 dry-run 조차 시작되지 않는다 — 요약도 job row 도 생기지 않는다.
    expect(response.status).toBe(400);
    expect(response.body).not.toHaveProperty("inserted");
    expect(await counts()).toEqual(before);
    expect(await prisma.importJob.count()).toBe(0);
  });
});

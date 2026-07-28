// import-restore-rejection.e2e-spec — `POST /api/admin/import` 의 **거부 경계** e2e
// (T-1288, REQ-030 / REQ-032 / REQ-045). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행
// slice **3c-3d2**. T-1287 (PR #1178) 이 slice 3c-3d1 로 성공 경로 + dump 파싱 실패를 실
// PostgreSQL 왕복으로 박제했지만, 그 spec 은 actor 를 Admin 1 종만 seed 하고 항상 파일을
// 첨부하므로 controller 가 실제로 **거부해야 하는 경계** — 미인증 401 · User actor 403 ·
// 파일 누락 400 · 진행 중 import 충돌 409 — 는 mock 경계(import.controller.spec.ts)에만
// 남아 있었다. 본 spec 이 그 구멍을 실 HTTP + 실 DB 사실로 닫는다.
//
// 책임 (R-113 — unit 외 end-to-end CI 수행):
//   - 실 guard stack (JwtAuthGuard + RolesGuard + @Roles("Admin")) 이 `FileInterceptor`
//     **보다 먼저** 동작해 미인증 / 권한 미달 요청이 파일 파싱 전에 차단됨을 증명한다.
//   - 거부 경로의 두 계약을 실 DB 로 단언한다: (a) `ImportJob` row 가 생성되지 않거나(guard /
//     파일 검증 단계) 새 row 가 추가되지 않고(409), (b) 어떤 거부 경로에서도 Group / Person
//     row 수가 불변이다 (복원 `$transaction` 미도달 — UC-07 §7.4).
//   - 거부 응답 body 에 업로드 raw 본문(sentinel)·stack trace 가 실리지 않음을 확인한다
//     (REQ-032 회귀).
//
// 실 DB 전략 (ADR-0004 §Decision — 다른 e2e 동일):
//   - mock override 없음 — `createAuthenticatedE2EApp()` 가 AppModule 부트스트랩 + actor
//     seed + token 발급을 맡고, PrismaService 는 services.postgres 로 실 connection 을 쓴다.
//   - **actor 2 종 seed 근거**: 본 slice 의 핵심이 tier 경계라 통과 tier(Admin)와 미달
//     tier(User)가 동시에 필요하다. SuperAdmin 은 RolesGuard escalation 으로 Admin 과 같은
//     결과라 추가해도 새 분기를 사지 못해 seed 하지 않는다.
//   - **업로드 본문은 작은 고정 Buffer 1 개** — 거부 경로는 dump 내용을 읽지 않으므로
//     export→download 왕복 helper 를 복제하지 않는다 (그 왕복은 T-1287 소유). 대신 본문을
//     의도적으로 손상 JSON sentinel 로 두어, 권한이 통과하는 경로에서는 400(파싱 실패)이
//     되고 그 400 이 "guard + 파일 검증을 지나 createJob 까지 도달했다" 는 외부 증거가 된다.
//   - **RUNNING job 직접 seed 근거**: 409 는 `ImportJobService.createJob` 의 race guard
//     (`deriveRaceState` → `evaluateImportRaceGuard`) 가 만들며, 판정 기준은 가장 오래된
//     RUNNING job 의 `startedAt ?? createdAt` 이다. 실 import 를 병렬로 돌려 RUNNING 상태를
//     만드는 것은 요청-응답 동기 실행(controller)상 불가능하므로 job row 를 직접 seed 한다.
//     이때 `startedAt` 을 **현재 시각**으로 둬야 경과 ≤ DEFAULT_TIMEOUT_MS(5분) 인 defer
//     분기를 타 blocking=true → 409 가 된다 (오래된 값은 timeout 분기로 흘러 message 가
//     달라진다).
//   - 정리 순서: `ImportJob`/`ExportJob` 의 `requestedById → User` 는 `onDelete: Restrict`
//     라 job row 를 먼저 비워야 `truncateAll`(User 포함)이 통과한다. 그리고 truncate 가 actor
//     User 를 지우므로 매 afterEach 마지막에 `reseedAuthenticatedActors` 로 **원본 id / email
//     / role** 그대로 재삽입한다 (선례 T-0520 round 2 — JWT 의 sub claim 이 그대로 유효).
//   - **413 제외 사유**: `MAX_IMPORT_FILE_SIZE_BYTES`(50 MiB) 초과 업로드는 대용량 버퍼 전송
//     비용 + multer 가 상한 도달 시 stream 을 끊어 supertest 가 ECONNRESET/EPIPE 로 깨질 수
//     있는 알려진 flakiness 표면이라 별도 slice 3c-3d3 으로 분리했다 (task §Out of Scope).
//
// 실 DB 미가용 환경(로컬 — `DATABASE_URL` 부재)에서는 globalSetup 이 fail-fast 하며 CI 의
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
const ADMIN_EMAIL = "import-reject-admin@e2e.test";
const USER_EMAIL = "import-reject-user@e2e.test";

// 업로드 raw 본문 sentinel (REQ-032 핵심 회귀). 앞 글자가 `n` 이라 `JSON.parse` 가 `null`
// 파싱을 시도하다 실패하므로 권한 통과 경로에서는 dump 파싱 실패(400)로 이어지고, 꼬리를
// 고유하게 둬 우연 매칭 없이 "거부 응답에 raw 가 실렸는가" 만 정확히 잡는다.
const UPLOAD_SENTINEL = "not-json-T1288-raw-must-not-be-stored";
const UPLOAD_BODY = Buffer.from(UPLOAD_SENTINEL, "utf-8");

describe("E2E: POST /api/admin/import 거부 경계 (T-1288)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;

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

  // uploadAs — 업로드 요청 1 회. cookie 미지정 = 미인증 요청, `attachFile: false` = 파일 누락
  // 요청. 파일 본문은 항상 고정 sentinel Buffer 다 (거부 경로는 내용을 읽지 않는다).
  function uploadAs(
    cookie: string | undefined,
    opts: { attachFile?: boolean; mode?: "REPLACE" | "MERGE" } = {},
  ) {
    const pending = request(app.getHttpServer()).post(IMPORT_BASE);
    if (cookie !== undefined) {
      pending.set("Cookie", cookie);
    }
    if (opts.mode !== undefined) {
      pending.field("mode", opts.mode);
    }
    return opts.attachFile === false
      ? pending
      : pending.attach("file", UPLOAD_BODY, "dump.json");
  }

  // seedRestorableEntities — 거부 시 "DB 변경 0" 을 볼 대상 row (Group 1 + Person 1).
  async function seedRestorableEntities() {
    await prisma.group.create({ data: { name: "거부경계그룹" } });
    await prisma.person.create({
      data: {
        fullName: "거부경계",
        email: `import-reject-person-${Date.now()}@e2e.test`,
      },
    });
  }

  // seedRunningImportJob — 진행 중(RUNNING) import job 1 건 직접 seed. `startedAt` 은 현재
  // 시각 (위 머리 주석의 defer 분기 근거). `requestedById` 는 Admin actor 의 실 User id.
  async function seedRunningImportJob() {
    return prisma.importJob.create({
      data: {
        status: "RUNNING",
        mode: "REPLACE",
        startedAt: new Date(),
        requestedById: ctx.users[ADMIN_EMAIL].id,
      },
    });
  }

  const counts = async () => ({
    group: await prisma.group.count(),
    person: await prisma.person.count(),
  });

  // expectNoRawLeak — 거부 응답 body 에 업로드 raw sentinel · stack trace 조각이 없음을
  // 단언한다 (REQ-032). 전체 sentinel 뿐 아니라 `JSON.parse` 가 잘라 실을 수 있는 **접두
  // 조각**(`not-json`) 도 함께 막는다 (T-1287 reviewer round 1 MINOR 회수).
  function expectNoRawLeak(body: unknown) {
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(UPLOAD_SENTINEL);
    expect(serialized).not.toContain("not-json");
    expect(body).not.toHaveProperty("stack");
  }

  // -- A. happy 항목 (권한 통과 경로가 실제로 controller 본문에 도달한다) ----------------

  it("Admin + 파일 첨부 요청은 401/403/400 으로 막히지 않고 createJob 에 도달한다 (happy)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadAs(adminCookie, { mode: "REPLACE" });

    // guard + 파일 검증을 모두 통과했으므로 거부 코드가 아니라 **dump 파싱 실패 400** 이다.
    expect(response.status).toBe(400);
    // 외부 증거 — job row 가 정확히 1 건 생성됐고 runner 가 실패를 기록했다 (createJob 도달).
    expect(await prisma.importJob.count()).toBe(1);
    const job = await prisma.importJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.requestedById).toBe(ctx.users[ADMIN_EMAIL].id);
    // 사유는 기록되되 업로드 raw 는 실리지 않는다 (REQ-032).
    expect(job.error).toEqual(expect.any(String));
    expect(job.error).not.toContain(UPLOAD_SENTINEL);
    // 접두 조각도 막는다 — `JSON.parse` SyntaxError message 는 입력 앞부분만 잘라 싣기
    // 때문에 전체 sentinel 단언만으로는 절단 누출 회귀를 놓친다 (T-1287 reviewer MINOR-1).
    expect(job.error).not.toContain("not-json");
    expectNoRawLeak(response.body);
    // 파싱 실패는 `$transaction` 이전 단락이라 도메인 row 수가 그대로다.
    expect(await counts()).toEqual(before);
  });

  // -- B. error path — 미인증 401 -----------------------------------------------------

  it("cookie 없이 업로드하면 401 + ImportJob row 0 + DB 변경 0 (error)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadAs(undefined, { mode: "REPLACE" });

    expect(response.status).toBe(401);
    // JwtAuthGuard 가 FileInterceptor 보다 먼저 차단 → createJob 미도달.
    expect(await prisma.importJob.count()).toBe(0);
    expect(await counts()).toEqual(before);
    expectNoRawLeak(response.body);
  });

  // -- C. error path — User actor 403 (REQ-045 Admin 전용) -----------------------------

  it("User actor 가 업로드하면 403 + ImportJob row 0 + DB 변경 0 (error)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadAs(userCookie, { mode: "REPLACE" });

    expect(response.status).toBe(403);
    expect(await prisma.importJob.count()).toBe(0);
    expect(await counts()).toEqual(before);
    expectNoRawLeak(response.body);
  });

  // -- D. 분기 cover — 409 진행 중 충돌 양쪽 --------------------------------------------

  it("진행 중 RUNNING job 이 있으면 409 + 새 job 미생성, 없으면 400 + job 1 건 생성 (branch)", async () => {
    await seedRestorableEntities();
    const before = await counts();
    const running = await seedRunningImportJob();

    // (i) blocking 분기 — race guard 가 createJob 의 `importJob.create` 이전에 차단한다.
    const blocked = await uploadAs(adminCookie, { mode: "REPLACE" });

    expect(blocked.status).toBe(409);
    // 새 row 미생성 — seed 한 RUNNING 1 건뿐.
    expect(await prisma.importJob.count()).toBe(1);
    expect(await counts()).toEqual(before);
    // 사람-친화 message 만 (headline + detailLines) — raw / stack 미포함.
    expectNoRawLeak(blocked.body);
    // negative (d) — 거부가 기존 job 을 건드리지 않는다.
    const untouched = await prisma.importJob.findUniqueOrThrow({
      where: { id: running.id },
    });
    expect(untouched.status).toBe("RUNNING");
    expect(untouched.startedAt?.getTime()).toBe(running.startedAt?.getTime());

    // (ii) 반대편 — RUNNING job 을 치우고 **같은 요청**을 보내면 409 가 아니라 (dump 가
    // 손상돼) 400 이고 job row 가 실제로 1 건 생성된다.
    await prisma.importJob.delete({ where: { id: running.id } });
    const passed = await uploadAs(adminCookie, { mode: "REPLACE" });

    expect(passed.status).toBe(400);
    expect(await prisma.importJob.count()).toBe(1);
    expect((await prisma.importJob.findFirstOrThrow()).status).toBe("FAILED");
    expect(await counts()).toEqual(before);
  });

  // -- E. negative — 파일 누락 400 (controller 자체 분기) --------------------------------

  it("Admin 이 파일 없이 mode 만 보내면 400 + ImportJob row 0 + DB 변경 0 (negative)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadAs(adminCookie, {
      attachFile: false,
      mode: "REPLACE",
    });

    expect(response.status).toBe(400);
    // controller 의 파일 검증 분기라 createJob · runJob 둘 다 미호출 → job row 0.
    expect(await prisma.importJob.count()).toBe(0);
    expect(await counts()).toEqual(before);
  });

  // -- F. negative — guard 가 파일 검증보다 먼저다 (미인증 + 파일 누락 → 400 아닌 401) ----

  it("cookie 도 파일도 없는 요청은 400 이 아니라 401 이다 (negative)", async () => {
    await seedRestorableEntities();
    const before = await counts();

    const response = await uploadAs(undefined, {
      attachFile: false,
      mode: "REPLACE",
    });

    // guard stack 이 FileInterceptor · 파일 검증 분기보다 먼저 실행된다는 실 HTTP 사실.
    expect(response.status).toBe(401);
    expect(await prisma.importJob.count()).toBe(0);
    expect(await counts()).toEqual(before);
  });
});

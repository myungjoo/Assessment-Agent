// import-detail-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 21**.
// (T-1541, load-resilience-test-plan §5 item 5 / REQ-048 조회 p95 < 3s)
//
// ① 위치 — slice 1~20 에 이은 실 DB round-trip **slice 21**. 부트스트랩·seed·정리 **구조는 slice 12
//    (`import-read-realdb.perf-spec.ts`, T-1522) 를 그대로 승계** 한다(문구 복제 대신 cross-ref —
//    `createAuthenticatedE2EApp` · actor 2 명 · `JOB_SEEDS` 4 row · `afterEach` 의 `truncateAll` +
//    `reseedAuthenticatedActors`). slice 12 는 같은 `ImportController` 의 정적 route 2 개(`modes` ·
//    `running`) 만 재고 단건 `:id` 는 `no-such-job-id` **404 negative** 로만 두드려, T-1536 잔여
//    인벤토리가 이 route 를 (B) 후보로 **보수 분류** 해 뒀다 — 본 spec 이 그 유보를 **happy-path
//    실측으로 해소** 한다("보수 분류는 happy-path 실측으로 푼다" 선례는 slice 19 가 세웠고 본 slice 가
//    두 번째 사례다). 계수: `ImportController` 는 slice 12 에서 **이미 실측 도메인** 이라 실측 endpoint
//    도메인 **14 는 불변** 이고 **조회 route 만 29 → 30** 으로 늘어난다(slice 15·17·18·19·20 과 같은
//    셈법 — 도메인·route 가 함께 늘던 slice 16 셈법이 아니다).
// ② mock 짝 — `import-detail-read.perf-spec.ts`. 그 spec 은 `ImportJobService` 를 `useValue` mock 으로
//    대체해 **controller ↔ collector 배선 latency** 만 쟀고 검증도 service 호출 횟수였다. 본 spec 은
//    **mock override 0** 으로 AppModule 을 실 부트스트랩하고 `ctx.prisma` 의 실 client 로 seed 해 **DB
//    round-trip 포함 latency** 를 재며, 검증은 **응답 body 가 seed row 값과 일치** 함으로 한다. mock 짝
//    자체는 수정하지 않는다(그 spec 의 retire·통합 판단은 T-1536 이 명시 유보한 별도 주제 — mock 잔존
//    계수 불변).
// ③ 새 구조 축 — **같은 depth 의 정적 세그먼트 2 종과 동적 `:id` 의 라우팅 우선순위 실측**.
//    `ImportController` 는 `@Get("running")` · `@Get("modes")` 를 `@Get(":id")` **앞에** 선언해, 문자열
//    `"modes"` / `"running"` 을 id 자리에 넣어도 404 가 아니라 **정적 route 가 이겨 200** 이 된다 — 즉
//    **`:id` 로는 도달 불가능한 id 공간이 존재** 한다. slice 10 의 `ExportController` 는 같은 depth 정적이
//    `running` **1 종** 이고 나머지 정적(`status-view` · `download`)은 `:id` **하위** 라, 같은 depth 정적이
//    **2 종** 인 대상은 본 slice 가 처음이다. 세 route(단건 `:id` · `modes` · `running`)의 p95 를 모두
//    임계 미만으로 단언하되 **대소 관계는 assert 하지 않는다**(slice 3 선례 — wall-clock 비결정성).
// ④ 새 축으로 **주장하지 않는** 항목(중복 주장 금지 검산) — `findUniqueOrThrow` 의 P2025 →
//    `NotFoundException` 변환은 slice 10 의 `ExportJobService.findJob` 과 동일, job status enum 4 상태
//    표본도 slice 10 과 동일, `JwtAuthGuard + RolesGuard` + `@Roles("Admin")` 의 401 / 403 layer 는
//    slice 10·11·12 와 동일, PK 직행 단건 조회 자체는 slice 11·14·19·20 과 동일하다. 한 controller 의
//    조회 route 전량 실측 도달도 Group slice 18 · Person slice 19 · Part slice 20 선례가 있어 새 축이
//    아니다. 본 slice 의 신규성은 ③ 하나뿐이다.
// ⑤ 결정론 전략 — seed 는 고정 4 row, `afterEach` 가 `truncateAll`(ADR-0004 §Cleanup) 후 actor 를
//    **원본 id 그대로** 재삽입한다(`ImportJob.requestedById` 는 `User` 로의 `Restrict` FK 라 재seed 를
//    빠뜨리면 다음 seed 가 FK 위반으로 깨진다). latency 는 wall-clock 이라 비결정적이므로 세 route 의
//    대소도, nullable 채움 정도가 반대인 두 표본의 대소도 관찰 기록에만 남긴다. pass 분기는 단일
//    클라이언트 · 4 row 라 3000ms 훨씬 아래로 결정론적 도달하고, fail 분기는 **미존재 id 의 404** 또는
//    비현실적 임계 주입(`p95MaxMs: 0`)이라 실 측정 시간에 무의존이다. 본 파일은
//    `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고
//    기본 `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres + migrate 전제는 CI 충족).
// ⑥ Out of Scope — production code 변경 0(특히 `ImportJobService.findJob` 에 필터 · `include` 추가 ·
//    route 선언 순서 변경 · guard 조정 · 404 메시지 변경 금지) / `prisma/schema.prisma` 수정 ·
//    migration(`ImportJob` index 추가 판단은 실측 근거 후 별도 task) / slice 12 spec 수정(정적 route 는
//    본 spec 안에서 **호출만** 한다) / mock 짝 수정·retire / write·trigger route(`POST /api/admin/import` ·
//    `preview`)의 latency 측정(seed 는 Prisma 직접 write) / 임계값 변경 · baseline 파일 확정
//    (`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` · `confirmOrCompareBaseline` 미사용 — 관찰
//    전용, 디스크 write 0) / 동시성 S3(`concurrency: 1` 고정) / 남은 (B) 1 route(`GET /api`) 측정 /
//    doc-sync(PLAN · load-resilience-test-plan · requirements 반영은 머지 후 별도 `direct` task).
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

import {
  buildBaselineReport,
  formatBaselineLine,
  type BaselineReport,
} from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
  type S2Assertion,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청 + 라우팅 우선순위 대조군이라 여유를 둔다.
jest.setTimeout(120_000);

const BASE = "/api/admin/import";
const RUNNING = `${BASE}/running`;
const MODES = `${BASE}/modes`;
const USER_ACTOR_EMAIL = "realdb-import-detail-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-import-detail-admin-actor@e2e.test";
// 표본별 반복 측정 횟수.
const ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;

// 단건 응답의 기대 shape — `include` 0 이라 관계(`requestedBy`)가 붙지 않는 ImportJob row 원형.
const JOB_KEYS = [
  "artifactRef",
  "createdAt",
  "error",
  "finishedAt",
  "id",
  "mode",
  "requestedById",
  "restoredRowCount",
  "startedAt",
  "status",
];

type JobKey = "pending" | "running" | "succeeded" | "failed";
type Row = Record<string, unknown>;

// seed 표본 4 row — `JobStatus` 4 값을 모두 채워 단건 조회가 status 에 무관하게 같은 shape 을 내는지
// 본다(이 4 상태 표본 자체는 slice 10 과 동일해 새 축이 아니다). 분기 ③ 의 대조 쌍은 nullable scalar 3 개
// (`error`/`artifactRef`/`restoredRowCount`)가 **모두 NULL** 인 `pending` 과 **셋 다 채워진** `failed` 다
// (값 없는 필드는 생략해 DB NULL 로 남긴다). `createdAt` 은 index 후행 컬럼이라 하루씩 벌려 고정한다.
const FAILED_ERROR = "부분 복원 후 중단 — 재시도 대기";
const FAILED_ARTIFACT = "artifact/realdb-import-detail-perf-1";
const FAILED_ROWS = 4242;
const JOB_SEEDS: {
  key: JobKey;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  mode: "REPLACE" | "MERGE";
  error?: string;
  artifactRef?: string;
  restoredRowCount?: number;
}[] = [
  { key: "pending", status: "PENDING", mode: "REPLACE" },
  { key: "running", status: "RUNNING", mode: "REPLACE" },
  {
    key: "succeeded",
    status: "SUCCEEDED",
    mode: "MERGE",
    artifactRef: "artifact/realdb-import-detail-perf-0",
    restoredRowCount: 17,
  },
  {
    key: "failed",
    status: "FAILED",
    mode: "MERGE",
    error: FAILED_ERROR,
    artifactRef: FAILED_ARTIFACT,
    restoredRowCount: FAILED_ROWS,
  },
];
const ALL: JobKey[] = ["pending", "running", "succeeded", "failed"];
const DATA_SCALE = `${JOB_SEEDS.length} import jobs`;

describe("S2 조회 latency perf-spec — 실 DB import 단건 상세 조회 (GET /api/admin/import/:id, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  let tamperedCookie: string;
  let adminActorId: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;
  // 관찰 기록 축적(대소 관계 assert 금지, 디스크 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User 2 명 seed + 실 JWT 발급.
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_ACTOR_EMAIL },
      { role: "Admin", email: ADMIN_ACTOR_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens[USER_ACTOR_EMAIL]);
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_ACTOR_EMAIL]);
    tamperedCookie = buildAuthCookie(`${ctx.tokens[ADMIN_ACTOR_EMAIL]}tam`);
    adminActorId = ctx.users[ADMIN_ACTOR_EMAIL].id;
    // 앞선 스위트가 남긴 row 가 첫 test 의 seed 검증을 오염시키지 않도록 시작 시점에도 비운다.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 의 `"User"` 가 JWT `sub` actor row 를 지우므로 **원본 id 그대로**
  // 재삽입한다(누락 시 `ImportJob.requestedById` FK 가 다음 seed 에서 깨진다). `ImportJob` 은 명단에
  // 없지만 `"User"` CASCADE 로 함께 비워져 `db-truncate.ts` 수정 0.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    console.log(`[T-1541 관찰] ${observations.map((o) => o.line).join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // job seed — FK `requestedById` 는 **Admin actor id**(Restrict FK 충족). key → 생성 id 표 반환.
  const seedJobs = async (keys: JobKey[]): Promise<Record<string, string>> => {
    const ids: Record<string, string> = {};
    for (const [i, s] of JOB_SEEDS.entries()) {
      if (!keys.includes(s.key)) continue;
      const { key, ...rest } = s;
      const created = await prisma.importJob.create({
        data: {
          ...rest,
          requestedById: adminActorId,
          createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
        },
      });
      ids[key] = created.id;
    }
    return ids;
  };

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (path: string, cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(path);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  // 측정 대상 — `findJob` → `findUniqueOrThrow` 의 PK 직행 단건 조회(필터 0 · include 0).
  const detailRequest = (id: string, cookie: string | null = adminCookie) =>
    getRequest(`${BASE}/${id}`, cookie);
  const measure = (path: string, cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path, cookie), n);
  const measureDetail = (
    id: string,
    n = SHORT_ITERATIONS,
    cookie: string | null = adminCookie,
  ) => collectLatencySamples(detailRequest(id, cookie), n);

  const row = (): Row => lastBody as Row;
  const rows = (): Row[] => lastBody as Row[];
  const nullables = (r: Row) => [r.error, r.artifactRef, r.restoredRowCount];

  // baseline 한 줄 관찰 조립 — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    assertion: S2Assertion,
  ): { line: string; report: BaselineReport } => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const report = buildBaselineReport(env, assertion);
    const entry = { line: formatBaselineLine(report), report };
    observations.push(entry);
    return entry;
  };

  // happy path + 분기 ① — row 존재 → 200 + seed 값과 일치하는 ImportJob row 반환.
  it("happy / 분기 ①(200): 단건 job 을 반복 조회 → 200 + seed id·status·mode 일치 + p95 < 3000ms pass", async () => {
    const ids = await seedJobs(ALL);

    const result = await measureDetail(ids.running, ITERATIONS);

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(result.samplesMs).toHaveLength(ITERATIONS);
    expect(lastStatus).toBe(200);

    // mock 배선이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const body = row();
    expect(body.id).toBe(ids.running);
    expect(body.status).toBe("RUNNING");
    expect(body.mode).toBe("REPLACE");
    expect(body.requestedById).toBe(adminActorId);
    expect(typeof body.createdAt).toBe("string");
    expect(Object.keys(body).sort()).toEqual(JOB_KEYS);

    // REQ-048 임계 — 실 DB round-trip 을 포함한 단건 경로에서의 판정.
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.reasons).toHaveLength(0);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
    observe("ci-realdb-import-detail-200", assertion);
  });

  // error path + 분기 ② — row 부재 → `findUniqueOrThrow` P2025 → `NotFoundException` → 404.
  it("error / 분기 ②(404): 미존재 id 반복 조회 → 전부 404 failures, 표본 0 · 500 아님 · raw stack 미노출", async () => {
    await seedJobs(ALL);
    const missingId = "realdb-missing-import-job-id";

    const result = await measureDetail(missingId, SHORT_ITERATIONS);

    expect(result.total).toBe(SHORT_ITERATIONS);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(result.samplesMs).toHaveLength(0);
    expect(lastStatus).toBe(404);
    expect(lastStatus).not.toBe(500);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);

    // 404 이지 500 이 아니고, body 에 raw stack / Prisma 내부 메시지가 새지 않는다(REQ-032 계열).
    const res = await request(app.getHttpServer())
      .get(`${BASE}/${missingId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  // 분기 ③ — nullable scalar 채움 정도가 **반대** 인 두 표본. 단건 응답이 각각 null / 실값으로 갈리고
  // 두 p95 가 모두 임계 미만이다(대소 관계는 관찰만 — wall-clock 비결정성).
  it("분기 ③: nullable 3 개가 전부 NULL 인 job vs 전부 채워진 job → 각각 null/실값 + 두 p95 모두 < 3000ms", async () => {
    const ids = await seedJobs(ALL);

    const emptyResult = await measureDetail(ids.pending, ITERATIONS);
    expect(emptyResult.failures).toBe(0);
    const emptyRow = row();
    expect(emptyRow.id).toBe(ids.pending);
    expect(nullables(emptyRow)).toEqual([null, null, null]);
    const emptyAssertion = assertS2Threshold(emptyResult);
    expect(emptyAssertion.pass).toBe(true);
    expect(emptyAssertion.summary.p95).toBeLessThan(3000);

    const filledResult = await measureDetail(ids.failed, ITERATIONS);
    expect(filledResult.failures).toBe(0);
    const filledRow = row();
    expect(filledRow.id).toBe(ids.failed);
    expect(nullables(filledRow)).toEqual([
      FAILED_ERROR,
      FAILED_ARTIFACT,
      FAILED_ROWS,
    ]);
    const filledAssertion = assertS2Threshold(filledResult);
    expect(filledAssertion.pass).toBe(true);
    expect(filledAssertion.summary.p95).toBeLessThan(3000);

    // 채움 정도가 달라도 응답 shape 은 같은 10 컬럼 — payload 는 NULL 여부에 반응하지 않는다.
    expect(Object.keys(emptyRow).sort()).toEqual(JOB_KEYS);
    expect(Object.keys(filledRow).sort()).toEqual(JOB_KEYS);

    const emptyObs = observe("ci-realdb-import-detail-nulls", emptyAssertion);
    const filledObs = observe(
      "ci-realdb-import-detail-filled",
      filledAssertion,
    );
    // 관찰 기록만 — 두 표본의 대소는 단언 금지.
    for (const { line, report } of [emptyObs, filledObs]) {
      expect(line).toContain("p95=");
      expect(line).toContain(`dataScale=${DATA_SCALE}`);
      expect(Number.isFinite(report.p95)).toBe(true);
      expect(report.count).toBe(ITERATIONS);
    }
    expect(emptyObs.report.env.label).not.toBe(filledObs.report.env.label);
  });

  // 새 축 — 라우팅 우선순위. `:id` 자리의 `"modes"` / `"running"` 은 404 가 아니라 **정적 route 가 이겨**
  // 200 이 된다(선언 순서가 `running` · `modes` → `:id`). 즉 `:id` 로 도달 불가능한 id 공간이 존재한다.
  // 세 route 의 p95 는 모두 임계 미만으로 단언하되 **대소 관계는 assert 하지 않는다**(slice 3 선례).
  it("새 축: :id 자리의 'modes'·'running' 은 404 가 아니라 정적 route 200 — 세 route p95 모두 < 3000ms", async () => {
    const ids = await seedJobs(ALL);

    // (1) 진짜 동적 :id — 실 job 단건.
    const detailResult = await measureDetail(ids.succeeded, ITERATIONS);
    expect(detailResult.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(row().id).toBe(ids.succeeded);
    const detailAssertion = assertS2Threshold(detailResult);
    expect(detailAssertion.pass).toBe(true);
    expect(detailAssertion.summary.p95).toBeLessThan(3000);

    // (2) "modes" — `:id` 로 포착되면 404 여야 하지만 정적 route 가 이겨 고정 2 원소 200.
    const modesResult = await measure(MODES, adminCookie, ITERATIONS);
    expect(modesResult.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastStatus).not.toBe(404);
    expect(rows()).toHaveLength(2);
    expect(rows().map((r) => r.reason)).toEqual(["replace", "merge"]);
    expect(rows().map((r) => r.destructive)).toEqual([true, false]);
    // 정적 응답이라 job row 형태가 아니다 — `:id` 핸들러를 타지 않았다는 증거.
    expect(rows()[0]).not.toHaveProperty("requestedById");
    const modesAssertion = assertS2Threshold(modesResult);
    expect(modesAssertion.pass).toBe(true);
    expect(modesAssertion.summary.p95).toBeLessThan(3000);

    // (3) "running" — 마찬가지로 정적 route 가 이겨 RUNNING 목록(배열) 200.
    const runningResult = await measure(RUNNING, adminCookie, ITERATIONS);
    expect(runningResult.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(rows().map((r) => r.id)).toEqual([ids.running]);
    expect(rows().every((r) => r.status === "RUNNING")).toBe(true);
    const runningAssertion = assertS2Threshold(runningResult);
    expect(runningAssertion.pass).toBe(true);
    expect(runningAssertion.summary.p95).toBeLessThan(3000);

    // 도달 불가능한 id 공간의 직접 증거 — 두 문자열을 id 로 갖는 job 은 DB 에 아예 없는데도 200 이다.
    expect(await prisma.importJob.count({ where: { id: "modes" } })).toBe(0);
    expect(await prisma.importJob.count({ where: { id: "running" } })).toBe(0);

    const observed = [
      observe("ci-realdb-import-detail-dynamic", detailAssertion),
      observe("ci-realdb-import-static-modes", modesAssertion),
      observe("ci-realdb-import-static-running", runningAssertion),
    ];
    // 관찰 기록만 — 세 route 의 대소 관계는 단언 금지.
    for (const { line, report } of observed) {
      expect(line).toContain("count=");
      expect(report.count).toBe(ITERATIONS);
      expect(report.p95).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(observed.map((o) => o.report.env.label)).size).toBe(3);
  });

  describe("negative cases 충분 cover", () => {
    // (a)(b) 인증 layer 2 종 — Cookie 미부착은 `JwtAuthGuard` 401, 변조 토큰은 서명 검증 실패로 401
    // (403 아님). 둘 다 DB 미도달이라 표본 0 이고 job 값이 새지 않는다.
    it("(a)(b) cookie 부재 401 · 변조 토큰 401(403 아님) — 표본 0 · job 값 미노출", async () => {
      const ids = await seedJobs(ALL);

      const noCookie = await measureDetail(ids.failed, SHORT_ITERATIONS, null);
      expect(noCookie.failures).toBe(SHORT_ITERATIONS);
      expect(noCookie.samplesMs).toHaveLength(0);
      expect(lastStatus).toBe(401);
      expect(JSON.stringify(lastBody)).not.toContain(FAILED_ERROR);

      const tampered = await measureDetail(
        ids.failed,
        SHORT_ITERATIONS,
        tamperedCookie,
      );
      expect(tampered.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(lastStatus).not.toBe(403);
      expect(assertS2Threshold(tampered, { p95MaxMs: 0 }).pass).toBe(false);
    });

    // (c) `@Roles("Admin")` — User tier 는 `RolesGuard` 단계 403 이라 DB 에 도달하지 못한다.
    it("(c) User tier actor 단건 조회 → guard 레벨 403(DB 미도달 · job 값 미노출)", async () => {
      const ids = await seedJobs(ALL);

      const result = await measureDetail(
        ids.failed,
        SHORT_ITERATIONS,
        userCookie,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(result.samplesMs).toHaveLength(0);
      expect(lastStatus).toBe(403);
      expect(lastStatus).not.toBe(404);
      const serialized = JSON.stringify(lastBody);
      expect(serialized).not.toContain(ids.failed);
      expect(serialized).not.toContain(FAILED_ARTIFACT);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });

    // (d) 404 만 반복 → errorRate 임계 위반으로 pass=false. 200 과 섞으면 0 < er < 1 중간값.
    it("(d) 미존재 id 반복 → pass === false, 200 혼합 표본은 0 < errorRate < 1", async () => {
      const ids = await seedJobs(ALL);

      const failed = await measureDetail(
        "realdb-import-detail-missing-neg",
        SHORT_ITERATIONS,
      );
      const assertion = assertS2Threshold(failed);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(assertion.reasons.join()).toContain("error rate 임계 초과");

      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실 job 단건(200), 짝수 번째는 미존재 id(404).
        return call % 2 === 1
          ? detailRequest(ids.pending)()
          : detailRequest("realdb-import-detail-missing-mixed")();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const mixedAssertion = assertS2Threshold(result);
      expect(mixedAssertion.errorRate).toBeGreaterThan(0);
      expect(mixedAssertion.errorRate).toBeLessThan(1);
      expect(mixedAssertion.errorRate).toBeCloseTo(0.5);
      expect(mixedAssertion.pass).toBe(false);
    });

    // (e) 비현실적 임계 주입 — 실 측정값이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    //     실 latency 값에 무의존한 결정론적 fail 분기.
    it("(e) p95MaxMs: 0 주입 → 실 측정값이라도 pass === false + p95 사유", async () => {
      const ids = await seedJobs(ALL);
      const result = await measureDetail(ids.succeeded, SHORT_ITERATIONS);

      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });

    // (f) 빈 DB — ImportJob 0 인 상태의 임의 id 조회는 500 이 아니라 404 로 수렴한다.
    it("(f) 빈 DB 에서 임의 id 단건 조회 → 500 이 아니라 404 로 수렴", async () => {
      expect(await prisma.importJob.count()).toBe(0);

      const result = await measureDetail(
        "realdb-import-detail-empty-db",
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(result.samplesMs).toHaveLength(0);
      expect(lastStatus).toBe(404);
      expect(lastStatus).not.toBe(500);
    });

    // (g) 형식이 유효하지 않은 id — cuid 가 아니어도 Prisma 는 단순 문자열 조회라 500 이 아니라
    //     `findUniqueOrThrow` 의 P2025 → 404 로 결정론적으로 갈린다.
    it("(g) 빈 대체 토큰 · 비-cuid 문자열 id → 500 이 아니라 404", async () => {
      await seedJobs(ALL);
      for (const token of ["%20", "not-a-cuid-9999", "0"]) {
        const res = await request(app.getHttpServer())
          .get(`${BASE}/${token}`)
          .set("Cookie", adminCookie);
        expect(res.status).toBe(404);
        expect(res.status).not.toBe(500);
        expect(res.body).not.toHaveProperty("stack");
      }
    });

    // (h) 격리 — 대조군 job 이 함께 존재해도 응답에 다른 job 의 id / mode 가 섞이지 않고,
    //     관계 키(`requestedBy`)도 응답에 없다(미조인 SELECT 증거 — FK 스칼라만 노출).
    it("(h) 대조군 job 공존 → 다른 job 의 id·mode 혼입 0 + requestedBy 키 부재", async () => {
      const ids = await seedJobs(ALL);
      expect(await prisma.importJob.count()).toBe(4);

      const first = await measureDetail(ids.pending, 1);
      expect(first.failures).toBe(0);
      const firstRow = row();
      const second = await measureDetail(ids.failed, 1);
      expect(second.failures).toBe(0);
      const secondRow = row();

      expect(firstRow.id).toBe(ids.pending);
      expect(firstRow.mode).toBe("REPLACE");
      const firstSerialized = JSON.stringify(firstRow);
      expect(firstSerialized).not.toContain(ids.failed);
      expect(firstSerialized).not.toContain(FAILED_ARTIFACT);

      expect(secondRow.id).toBe(ids.failed);
      expect(secondRow.mode).toBe("MERGE");
      expect(JSON.stringify(secondRow)).not.toContain(ids.pending);

      // 관계는 조인하지 않는다 — FK 스칼라 `requestedById` 만 있고 `requestedBy` 객체는 없다.
      expect(firstRow).not.toHaveProperty("requestedBy");
      expect(secondRow).not.toHaveProperty("requestedBy");
      expect(Object.keys(secondRow).sort()).toEqual(JOB_KEYS);
    });
  });
});

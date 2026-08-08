// export-status-view-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip
// **slice 15** (T-1528, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 이미 실측한
// `ExportController` 의 파생 route(`GET /api/admin/export/:id/status-view`)를 실 Postgres 위에서
// 처음 잰다(구조 slice 10 harness 승계, 앞 slice 수정 0). 새 축 셋 — (a) **파생 view 반환**(앞 14
// slice 는 raw record 또는 필드 **제거** sanitize 뿐이었으나 본 경로는 8 필드를 **신설** 해 반환해
// `ExportJob` row 의 어떤 컬럼도 그대로 나오지 않는다), (b) **DB enum 1 컬럼이 응답 전체를 결정**
// (slice 10 은 같은 `JobStatus` 를 **필터 축**, 본 slice 는 **payload 결정 축**), (c) **같은 row 를
// 읽는 두 route 가 각각 별도 slice 로 실측되는 첫 페어**(slice 10 의 `GET :id` raw record 와 본
// slice 의 derived view — slice 13 의 부모–자식 페어와 달리 **동일 테이블·동일 row**).
// `@Roles("Admin")` guard 레벨 403 · P2025 → 404 는 slice 10 과 동일해 **새 축으로 주장하지 않고**
// negative cover 로만 유지한다. mock 0 · override 0, production code · schema · 임계값 불변이며
// 소규모 표본이라 REQ-047 실 scale 부하가 아니다.
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

import { buildBaselineReport, formatBaselineLine } from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
  type S2Assertion,
} from "./latency-collector";

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 10·14 와 동등한 여유.
jest.setTimeout(120_000);

const BASE = "/api/admin/export";
const USER_ACTOR_EMAIL = "realdb-statusview-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-statusview-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;
// 파생 view 의 전체 키 8 개(정렬) — DB 컬럼이 아니라 helper 가 신설한 필드뿐임의 대조 anchor(축 (a)).
// 이 집합과의 완전 일치가 곧 `ExportJob` 컬럼(id·scope·requestedById·createdAt·…) 부재의 증거다.
const VIEW_KEYS =
  "downloadable,message,nextStatus,phaseLabel,status,stepIndex,terminal,totalSteps".split(
    ",",
  );

type JobKey = "pending" | "running" | "succeeded" | "failed";
type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
type Row = Record<string, unknown>;

// seed 표본 4 row — `JobStatus` 4 값을 모두 깔아 status 별 4 view 분기를 각각 밟는다. view 는
// status 만으로 derive 되므로 scope 는 고정하고 `createdAt` 만 하루씩 벌린다(slice 10 선례).
const JOB_SEEDS: [JobKey, JobStatus][] = [
  ["pending", "PENDING"],
  ["running", "RUNNING"],
  ["succeeded", "SUCCEEDED"],
  ["failed", "FAILED"],
];

describe("S2 조회 latency perf-spec — 실 DB export 진행 view 파생 조회 (GET /api/admin/export/:id/status-view, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 서명 변조 cookie — `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  let adminActorId: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;
  const observed: string[] = [];

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
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 **원본 id
  // 그대로** 재삽입한다(재발급 금지 — slice 10·14 선례). `ExportJob` 은 명단에 없지만 `"User"` 의
  // TRUNCATE ... CASCADE 가 함께 비운다 — `db-truncate.ts` 수정 0.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() lifecycle hook + 명시적 $disconnect. 관찰 기록은 두 route
  // 표본의 대소 관계를 단언하지 않고 로그로만 남긴다(slice 3 선례).
  afterAll(async () => {
    console.log(`[T-1528 관찰] ${observed.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // job seed — FK `requestedById` 는 **Admin actor id**(Restrict FK 충족). 반환은 key → 생성 id 표.
  const seedJobs = async (): Promise<Record<string, string>> => {
    const ids: Record<string, string> = {};
    for (const [i, [key, status]] of JOB_SEEDS.entries()) {
      const created = await prisma.exportJob.create({
        data: {
          status,
          scope: "FULL",
          requestedById: adminActorId,
          createdAt: new Date(`2026-03-0${i + 1}T00:00:00.000Z`),
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
  const measure = (path: string, cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path, cookie), n);
  // 본 slice 측정 대상 route — `:id/status-view` 를 Admin cookie 로 친다.
  const measureView = (id: string, n = SHORT_ITERATIONS) =>
    measure(`${BASE}/${id}/status-view`, adminCookie, n);
  const view = (): Row => lastBody as Row;
  // baseline 한 줄 관찰 기록(확정 write 0 — `buildBaselineReport`/`formatBaselineLine` 관찰 전용).
  const observe = (label: string, assertion: S2Assertion): void => {
    const scale = "job row 1 -> derived view 1 (seed 4)";
    const env = { label, concurrency: 1, dataScale: scale };
    observed.push(formatBaselineLine(buildBaselineReport(env, assertion)));
  };
  // 분기별 기대 view + helper 불변식(`downloadable === true ⟹ status === "ready"`,
  // `nextStatus === null ⟺ terminal === true`) 동시 단언 — 조건 분기 없이 boolean 등가로 본다.
  const expectView = (status: string, terminal: boolean, dl: boolean): void => {
    const v = view();
    expect([v.status, v.terminal, v.downloadable, v.totalSteps]).toEqual([
      status,
      terminal,
      dl,
      3,
    ]);
    expect(v.downloadable === true && v.status !== "ready").toBe(false);
    expect(v.nextStatus === null).toBe(v.terminal);
    expect(typeof v.message).toBe("string");
  };
  // AC happy — Admin actor 의 파생 view 조회. 응답 키가 helper 신설 8 필드뿐(축 (a) 증거)이다.
  it("happy(Admin :id/status-view): 200 + 파생 view 8 필드 + p95 < 3000ms pass", async () => {
    const ids = await seedJobs();
    const result = await measureView(ids.succeeded, ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(Object.keys(view()).sort()).toEqual(VIEW_KEYS);
    expect(view().phaseLabel).toBe("다운로드 가능");
    expectView("ready", true, true);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    observe("ci-realdb-export-status-view", assertion);
    expect(observed.join()).toContain("p95=");
  });
  // AC error path — 미존재 id 는 `findUniqueOrThrow` 의 P2025 가 helper 도달 전에 404 로 raw
  // propagate. body 에 raw stack / Prisma 내부 메시지가 새지 않음도 함께 단언(REQ-032).
  it("error path(미존재 id): 404 전량 failures + raw stack·Prisma 메시지 미노출", async () => {
    await seedJobs();
    const result = await measureView("realdb-missing-status-view-id");
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    const serialized = JSON.stringify(lastBody);
    expect(serialized).not.toContain("P2025");
    expect(serialized).not.toContain("prisma");
    expect(serialized).not.toContain("findUniqueOrThrow");
    expect(view()).not.toHaveProperty("stack");
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
  });
  describe("JobStatus 4 값 → 4 view 분기 cover", () => {
    // (a) PENDING → queued. 정상 흐름 1 단계라 terminal/downloadable 이 모두 false 다.
    it("(a) PENDING → queued · terminal false · downloadable false · nextStatus 비-null", async () => {
      const ids = await seedJobs();
      const result = await measureView(ids.pending);
      expect(result.failures).toBe(0);
      expectView("queued", false, false);
      expect(view().nextStatus).not.toBeNull();
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (b) RUNNING → running. 같은 정상 흐름의 다음 단계라 stepIndex 가 (a) 보다 뒤다.
    it("(b) RUNNING → running · stepIndex 가 (a) queued 보다 뒤", async () => {
      const ids = await seedJobs();
      await measureView(ids.pending, 1);
      const queuedStep = view().stepIndex as number;
      const result = await measureView(ids.running);
      expect(result.failures).toBe(0);
      expectView("running", false, false);
      expect(view().nextStatus).toBe("ready");
      expect(view().stepIndex as number).toBeGreaterThan(queuedStep);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (c) SUCCEEDED → ready. enum 어휘 자체가 바뀌는 유일한 매핑이다.
    it("(c) SUCCEEDED → ready · terminal true · downloadable true", async () => {
      const ids = await seedJobs();
      const result = await measureView(ids.succeeded);
      expect(result.failures).toBe(0);
      expectView("ready", true, true);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (d) FAILED → failed. 정상 흐름 밖 종단이라 stepIndex 가 -1 이고 nextStatus 가 null 이다.
    it("(d) FAILED → failed · terminal true · downloadable false · nextStatus null", async () => {
      const ids = await seedJobs();
      const result = await measureView(ids.failed);
      expect(result.failures).toBe(0);
      expectView("failed", true, false);
      expect([view().nextStatus, view().stepIndex]).toEqual([null, -1]);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
  });
  // 축 (c) 증거 — 같은 row 를 두 route 로 각각 측정. 두 p95 모두 3000ms 미만만 단언하고 **대소
  // 관계는 단언하지 않는다**(wall-clock 비결정성, slice 3 선례).
  it("동일 row 두 route: :id(raw record) 와 :id/status-view(파생 view) 모두 p95 < 3000ms", async () => {
    const ids = await seedJobs();
    const rawResult = await measure(`${BASE}/${ids.running}`, adminCookie);
    expect(rawResult.failures).toBe(0);
    // raw record 는 DB 컬럼 그대로 — status 도 uppercase enum 값이다.
    expect([view().id, view().status]).toEqual([ids.running, "RUNNING"]);
    const viewResult = await measureView(ids.running);
    expect(viewResult.failures).toBe(0);
    // 같은 row 인데 응답 shape 가 완전히 다르다 — id 조차 없고 status 는 lowercase 파생값.
    expect(view()).not.toHaveProperty("id");
    expect(view().status).toBe("running");
    const rawAssertion = assertS2Threshold(rawResult);
    const viewAssertion = assertS2Threshold(viewResult);
    expect(rawAssertion.summary.p95).toBeLessThan(3000);
    expect(viewAssertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-export-detail-raw", rawAssertion);
    observe("ci-realdb-export-detail-view", viewAssertion);
  });
  describe("negative cases 충분 cover", () => {
    // (a) Cookie 미부착 → `JwtAuthGuard` 401. 표본 0 이라 측정 시간 무의존 단언.
    it("(a) 인증 없음(Cookie 미부착): 401 전량 failures, 표본 0", async () => {
      const ids = await seedJobs();
      const result = await measure(`${BASE}/${ids.running}/status-view`, null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // (b) 서명 변조 토큰 — cookie 는 있으나 검증 실패라 401(403 아님).
    it("(b) 서명 변조 cookie: 401(403 아님) + view 필드 미노출", async () => {
      const ids = await seedJobs();
      const path = `${BASE}/${ids.running}/status-view`;
      const result = await measure(path, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(JSON.stringify(lastBody)).not.toContain("phaseLabel");
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // (c) `@Roles("Admin")` 이라 User tier 는 **RolesGuard 단계** 에서 DB 미도달 403.
    it("(c) User tier actor: guard 레벨 403(DB 미도달)", async () => {
      const ids = await seedJobs();
      const path = `${BASE}/${ids.succeeded}/status-view`;
      const result = await measure(path, userCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(result.samplesMs).toHaveLength(0);
      expect(JSON.stringify(lastBody)).not.toContain("downloadable");
      // 같은 row 를 Admin 이 치면 여전히 200 — 403 원인이 tier 임을 못박는다.
      await measureView(ids.succeeded, 1);
      expect(lastStatus).toBe(200);
    });
    // (d) 미존재 id → 404. 같은 시점의 실재 id 가 200 임을 대조해 원인이 id 부재임을 못박는다.
    it("(d) 미존재 id: 404(같은 시점 실재 id 는 200)", async () => {
      const ids = await seedJobs();
      const result = await measureView("realdb-absent-job");
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      await measureView(ids.pending, 1);
      expect([lastStatus, view().status]).toEqual([200, "queued"]);
    });
    // (e) `:id` 자리에 형제 route 토큰(`running`)을 넣은 path 변형 — 500 으로 새지 않고 4xx 로
    // 갈린다(`:id/status-view` 가 id="running" 으로 매칭 → 부재 404).
    it("(e) path 변형(:id 자리에 형제 route 토큰): 500 아닌 4xx", async () => {
      await seedJobs();
      const result = await measure(`${BASE}/running/status-view`, adminCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBeGreaterThanOrEqual(400);
      expect(lastStatus).toBeLessThan(500);
      // 형제 route 자체(`/running` 목록)는 같은 cookie 로 여전히 200 — 원인이 인증이 아님.
      await measure(`${BASE}/running`, adminCookie, 1);
      expect(lastStatus).toBe(200);
    });
  });
});

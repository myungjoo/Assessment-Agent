// export-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 10**
// (T-1518, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 아홉 번째 endpoint
// 도메인(`ExportController` 의 `GET /api/admin/export/running` · `/:id`)을 실 Postgres 위에서
// 잰다(구조 slice 9 승계, 앞 slice 수정 0). 새 축 셋 — (a) **Prisma enum 필터 + index 선두
// 컬럼**: `where: { status: "RUNNING" }` 이 `@@index([status, createdAt])` 의 leading-edge 1
// 컬럼만 타고 필터 타입이 enum(`JobStatus`)인 첫 실측. (b) **`Json?` 2 컬럼**(`dateRange` ·
// `entitySelector`)의 JSONB 역직렬화를 NULL/비-NULL 혼재 표본으로 처음 잰다(두 표본의 대소
// 관계는 단언 0 — slice 3 선례). (c) **guard 레벨 403**: `@Roles("Admin")` 이라 User tier 는
// RolesGuard 에서 DB 미도달 거절 — slice 8 의 controller 레벨 403 과 layer 가 다르다. 부수로
// 운영 job 테이블 · `findUniqueOrThrow` 의 P2025 → 404 · FK `onDelete: Restrict` 가 처음
// 등장한다. mock 0 · override 0 로 실 JWT 가 guard 를 통과하고 검증은 **응답 body 의 seed 값
// 대조** 다(401/403 은 DB 미도달이라 `p95MaxMs: 0` 단언). production code · schema · 임계값
// 불변, 소규모 표본이라 REQ-047 부하가 아니다.
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
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 8·9 와 동등한 여유.
jest.setTimeout(120_000);

const BASE = "/api/admin/export";
const RUNNING = `${BASE}/running`;
const USER_ACTOR_EMAIL = "realdb-export-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-export-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

type JobKey = "pending" | "running" | "succeeded" | "failed";
type Row = Record<string, unknown>;

// seed 표본 4 row — status 4 값을 모두 섞어 enum 필터가 `RUNNING` 만 고르는지 본다.
// `running` 은 `Json?` 2 컬럼이 **모두 채워진** 표본, `pending` 은 **모두 NULL** 표본이다
// (Json 축 대조군). `createdAt` 은 index 후행 컬럼이라 하루씩 벌려 고정한다.
const JOB_SEEDS: {
  key: JobKey;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  scope: "FULL" | "RANGE" | "PARTIAL";
  dateRange?: { start: string; end: string };
  entitySelector?: { persons: string[] };
}[] = [
  { key: "pending", status: "PENDING", scope: "FULL" },
  {
    key: "running",
    status: "RUNNING",
    scope: "RANGE",
    dateRange: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
    },
    entitySelector: { persons: ["p-1", "p-2"] },
  },
  { key: "succeeded", status: "SUCCEEDED", scope: "PARTIAL" },
  { key: "failed", status: "FAILED", scope: "FULL" },
];

describe("S2 조회 latency perf-spec — 실 DB export job polling 조회 (GET /api/admin/export/running · :id, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 변조 토큰 cookie — 서명이 깨진 JWT 라 `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  let adminActorId: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

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

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로
  // **원본 id 그대로** 재삽입한다(재발급 금지). `ExportJob` 은 명단에 없지만 `"User"` 의
  // TRUNCATE ... CASCADE 가 함께 비운다(`Restrict` 는 DELETE 에만 적용) — helper 수정 0.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // job seed — FK `requestedById` 는 **Admin actor id**(Restrict FK 충족). `Json?` 은
  // 값이 없으면 필드 자체를 생략해 DB NULL 로 둔다. 반환은 key → 생성 id 표.
  const seedJobs = async (keys: JobKey[]): Promise<Record<string, string>> => {
    const ids: Record<string, string> = {};
    for (const [i, seed] of JOB_SEEDS.entries()) {
      if (!keys.includes(seed.key)) continue;
      const { dateRange, entitySelector } = seed;
      const created = await prisma.exportJob.create({
        data: {
          status: seed.status,
          scope: seed.scope,
          requestedById: adminActorId,
          createdAt: new Date(`2026-03-0${i + 1}T00:00:00.000Z`),
          ...(dateRange ? { dateRange } : {}),
          ...(entitySelector ? { entitySelector } : {}),
        },
      });
      ids[seed.key] = created.id;
    }
    return ids;
  };
  const ALL_KEYS: JobKey[] = ["pending", "running", "succeeded", "failed"];

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
  // Admin 의 `:id` 단건 측정 shorthand — 경로 조립 + cookie 고정.
  const measureDetail = (id: string, n = ITERATIONS) =>
    measure(`${BASE}/${id}`, adminCookie, n);
  const rows = (): Row[] => lastBody as Row[];
  const one = (): Row => lastBody as Row;
  // AC happy ① — Admin actor 의 진행 중 job 목록(enum 필터 + index 선두 컬럼 경로).
  it("happy ①(Admin running 목록): 200 + RUNNING job 만 + p95 < 3000ms pass", async () => {
    const ids = await seedJobs(ALL_KEYS);
    const result = await measure(RUNNING, adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    // 값 대조로 실 query 발화 입증 — id/scope 가 seed 한 RUNNING row 와 일치.
    expect(rows().map((r) => r.id)).toEqual([ids.running]);
    expect(rows()[0].scope).toBe("RANGE");
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });
  // AC happy ② — 단건 polling(`findUniqueOrThrow` 성공 경로).
  it("happy ②(Admin :id 단건): 200 + seed status/scope 일치 + p95 < 3000ms pass", async () => {
    const ids = await seedJobs(ALL_KEYS);
    const result = await measureDetail(ids.succeeded);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect([one().id, one().status, one().scope]).toEqual([
      ids.succeeded,
      "SUCCEEDED",
      "PARTIAL",
    ]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });
  describe("enum 필터 · Json 역직렬화 분기", () => {
    // (a) 4 status 혼재 표본에서 다른 status 가 새어 들어오지 않는지 — enum 필터 축.
    it("(a) 4 status 혼재: running 이 RUNNING row 만 반환(비혼입)", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const result = await measure(RUNNING, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(1);
      expect(rows().every((r) => r.status === "RUNNING")).toBe(true);
      expect(rows().map((r) => r.id)).not.toContain(ids.pending);
      expect(rows().map((r) => r.id)).not.toContain(ids.failed);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (b) 매칭 0 — 404 변환 없이 200 + 빈 배열(findMany native 동작).
    it("(b) RUNNING row 0 개: 200 + 빈 배열", async () => {
      await seedJobs(["pending", "succeeded", "failed"]);
      const result = await measure(RUNNING, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (c-1) `Json?` 2 컬럼이 모두 채워진 job — JSONB 역직렬화가 객체 그대로.
    it("(c-1) Json 2 컬럼 비-NULL job :id: 구조화 payload 그대로 역직렬화", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const result = await measureDetail(ids.running);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(one().dateRange).toEqual(JOB_SEEDS[1].dateRange);
      expect(one().entitySelector).toEqual(JOB_SEEDS[1].entitySelector);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (c-2) 같은 컬럼이 모두 NULL 인 job — 대소 관계는 단언 0(slice 3 선례).
    it("(c-2) Json 2 컬럼 NULL job :id: 두 필드 모두 null", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const result = await measureDetail(ids.pending);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(one().dateRange).toBeNull();
      expect(one().entitySelector).toBeNull();
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
  });
  describe("negative cases 충분 cover", () => {
    // Cookie 미부착 → `JwtAuthGuard` 401. 표본 0 이라 측정 시간 무의존 단언.
    it("(a) 인증 없음(Cookie 미부착): 두 route 모두 401 failures, 표본 0", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const result = await measure(RUNNING, null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      await measure(`${BASE}/${ids.running}`, null, 1);
      expect(lastStatus).toBe(401);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패(200·403 아님).
    it("(b) 변조 토큰 cookie: 401 failures(403 아님)", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const result = await measure(RUNNING, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      await measure(`${BASE}/${ids.running}`, tamperedCookie, 1);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // 본 slice 핵심 축 — `@Roles("Admin")` 이라 User tier 는 **RolesGuard 단계** 에서
    // DB 미도달 403(slice 8 의 controller 레벨 403 과 발생 layer 가 다르다).
    it("(c) User tier actor: 두 route 모두 guard 레벨 403(DB 미도달)", async () => {
      const ids = await seedJobs(ALL_KEYS);
      const listResult = await measure(RUNNING, userCookie);
      expect(listResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(listResult.samplesMs).toHaveLength(0);
      const detailResult = await measure(`${BASE}/${ids.running}`, userCookie);
      expect(detailResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(assertS2Threshold(detailResult, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // 미존재 id — `findUniqueOrThrow` 의 P2025 를 `mapNotFound` 가 404 로 변환.
    it("(d) 미존재 id :id 조회: 404(P2025 → NotFoundException)", async () => {
      await seedJobs(ALL_KEYS);
      const result = await measureDetail(
        "realdb-missing-job-id",
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
  });
});

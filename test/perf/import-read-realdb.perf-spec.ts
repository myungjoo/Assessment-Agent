// import-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 12**
// (T-1522, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 열한 번째 endpoint
// 도메인(`ImportController` 의 `GET /api/admin/import/modes` · `/running`)을 실 Postgres 위에서
// 잰다(구조 slice 10·11 승계, 앞 slice 수정 0). 새 축 셋 — (a) **DB 미도달 0-query route 의 첫
// 실측**: `modes` 는 `async` 도 아닌 동기 반환 · service 미경유 · Prisma 호출 **0** 이라 **guard
// stack + 라우팅 + 직렬화만의 배선 latency floor** 를 처음 분리 관측한다. (b) **같은 controller ·
// 같은 fixture 안에서 0-query 와 DB round-trip 을 나란히 측정**: `running` 은 실 `ImportJob` 을
// `RUNNING` 으로 거르는 실 query 라 **두 성분의 상대 관측 기록** 이 처음 남는다(대소 관계는
// slice 3 선례대로 **단언하지 않고 관찰만**). (c) **한 요청에 Prisma enum 2 종(필터 축 + payload
// 축) 혼재**: slice 10 `ExportJob` 의 정합 쌍이라 `@@index([status, createdAt])` leading-edge ·
// `JobStatus` 필터 · `Restrict` FK 는 같지만 payload 축이 `mode`(`ImportMode`) **두 번째 enum
// 컬럼** + `restoredRowCount`(`Int?`) + `error`/`artifactRef`(`String?`)의 **nullable scalar 혼재**
// 다. 403 layer 는 slice 10·11 과 같아 **새 축 주장 없이** negative cover 로만 둔다. mock 0 ·
// override 0, production code · schema · 임계값 불변이며 소규모 표본이라 REQ-047 부하가 아니다.
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

jest.setTimeout(120_000);

const BASE = "/api/admin/import";
const RUNNING = `${BASE}/running`;
const MODES = `${BASE}/modes`;
const USER_ACTOR_EMAIL = "realdb-import-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-import-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

type JobKey = "pending" | "runReplace" | "runMerge" | "succeeded";
type Row = Record<string, unknown>;

// seed 표본 4 row — status 3 값을 섞어 enum 필터가 `RUNNING` 만 고르는지 본다. RUNNING 은 **2 row**
// 이고 payload 축이 서로 반대다: `runReplace` 는 mode=REPLACE + nullable scalar 3 개가 **모두 NULL**,
// `runMerge` 는 mode=MERGE + 셋 **모두 채워진** 표본(축 (c) 대조군 — 값 없는 필드는 생략해 DB NULL).
// `createdAt` 은 index 후행 컬럼이라 하루씩 벌려 고정한다.
const MERGE_ERROR = "부분 row 재시도 대기 중";
const MERGE_ARTIFACT = "artifact/realdb-import-perf-1";
const JOB_SEEDS: {
  key: JobKey;
  status: "PENDING" | "RUNNING" | "SUCCEEDED";
  mode: "REPLACE" | "MERGE";
  error?: string;
  artifactRef?: string;
  restoredRowCount?: number;
}[] = [
  { key: "pending", status: "PENDING", mode: "REPLACE" },
  { key: "runReplace", status: "RUNNING", mode: "REPLACE" },
  {
    key: "runMerge",
    status: "RUNNING",
    mode: "MERGE",
    error: MERGE_ERROR,
    artifactRef: MERGE_ARTIFACT,
    restoredRowCount: 4242,
  },
  { key: "succeeded", status: "SUCCEEDED", mode: "MERGE" },
];
const ALL: JobKey[] = ["pending", "runReplace", "runMerge", "succeeded"];
const DATA_SCALE = `${JOB_SEEDS.length} import jobs`;

describe("S2 조회 latency perf-spec — 실 DB import 조회 (GET /api/admin/import/modes · running, REQ-048)", () => {
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
  afterAll(async () => {
    // 관찰 기록 — 두 성분의 상대 크기는 wall-clock 비결정성이라 단언하지 않는다.
    console.log(`[T-1522 관찰] ${observed.join(" | ")}`);
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
          createdAt: new Date(`2026-04-0${i + 1}T00:00:00.000Z`),
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
  const rows = (): Row[] => lastBody as Row[];
  const byMode = (mode: string): Row =>
    rows().find((r) => r.mode === mode) as Row;
  const nullables = (r: Row) => [r.error, r.artifactRef, r.restoredRowCount];
  // baseline 한 줄 관찰 기록 — 두 route 의 대소 관계는 단언하지 않는다(slice 3 선례).
  const observe = (label: string, assertion: S2Assertion): void => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const line = formatBaselineLine(buildBaselineReport(env, assertion));
    expect(line).toContain("p95=");
    observed.push(line);
  };

  // AC happy ① — 0-query route. 고정 2 원소(REPLACE destructive / MERGE non-destructive).
  it("happy ①(Admin modes): 200 + 고정 2 원소 + p95 < 3000ms pass", async () => {
    await seedJobs(ALL);
    const result = await measure(MODES, adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(2);
    expect(rows().map((r) => r.reason)).toEqual(["replace", "merge"]);
    expect(rows().map((r) => r.destructive)).toEqual([true, false]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-import-modes", assertion);
  });
  // AC happy ② — 실 query route(enum 필터 + index 선두 컬럼). 값 대조로 실 query 발화 입증.
  it("happy ②(Admin running): 200 + RUNNING job 만 + p95 < 3000ms pass", async () => {
    const ids = await seedJobs(ALL);
    const result = await measure(RUNNING, adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const seen = rows().map((r) => r.id) as string[];
    expect(seen.sort()).toEqual([ids.runReplace, ids.runMerge].sort());
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-import-running", assertion);
  });

  describe("enum 필터 · payload enum/nullable 분기", () => {
    // (a) 매칭 0 — 404 변환 없이 200 + 빈 배열(findMany native 동작).
    it("(a) RUNNING row 0 개: 200 + 빈 배열(404 아님)", async () => {
      await seedJobs(["pending", "succeeded"]);
      const result = await measure(RUNNING, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (b) 비혼입(enum 필터 축) + payload 축 — 응답에 `ImportMode` 2 값이 공존하고 nullable
    // scalar 3 개가 NULL / 비-NULL 로 갈린다(축 (c) 의 직접 증거).
    it("(b) status 혼재: RUNNING 만 반환 + mode enum 2 값 · nullable 혼재", async () => {
      const ids = await seedJobs(ALL);
      const result = await measure(RUNNING, adminCookie);
      expect(result.failures).toBe(0);
      expect(rows().every((r) => r.status === "RUNNING")).toBe(true);
      const seen = rows().map((r) => r.id);
      expect(seen).not.toContain(ids.pending);
      expect(seen).not.toContain(ids.succeeded);
      const modes = rows().map((r) => r.mode);
      expect(modes.sort()).toEqual(["MERGE", "REPLACE"]);
      expect(nullables(byMode("REPLACE"))).toEqual([null, null, null]);
      const merged = [MERGE_ERROR, MERGE_ARTIFACT, 4242];
      expect(nullables(byMode("MERGE"))).toEqual(merged);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (c) 0-query 축의 직접 증거 — seed 0 건과 혼재 다건에서 `modes` 응답이 완전히 동일.
    it("(c) modes 응답: seed 0 건 / 혼재 다건에서 동일한 2 원소(DB 상태 무관)", async () => {
      await measure(MODES, adminCookie, 1);
      expect(lastStatus).toBe(200);
      const emptyDbBody = JSON.stringify(lastBody);
      await seedJobs(ALL);
      expect(await prisma.importJob.count()).toBe(4);
      const result = await measure(MODES, adminCookie);
      expect(result.failures).toBe(0);
      expect(JSON.stringify(lastBody)).toBe(emptyDbBody);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) Cookie 미부착 → `JwtAuthGuard` 401(표본 0). (b) 변조 토큰 → 서명 검증 실패로 401
    // (200·403 아님). 둘 다 DB 미도달이라 `p95MaxMs: 0` 로 pass=false 를 못박는다.
    it("(a)(b) 인증 실패 2 종: modes cookie 부재 401 · running 변조 토큰 401", async () => {
      await seedJobs(ALL);
      const noCookie = await measure(MODES, null);
      expect(noCookie.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(noCookie.samplesMs).toHaveLength(0);
      const strict = assertS2Threshold(noCookie, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
      const tampered = await measure(RUNNING, tamperedCookie);
      expect(tampered.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(tampered, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // (c)(d) `@Roles("Admin")` — User tier 는 RolesGuard 단계 403. `modes` 는 원래 DB 미도달이라
    // **handler 미도달**(2 원소 없음)이, `running` 은 **DB 미도달**(job 미노출)이 관찰점이다.
    it("(c)(d) User tier actor: 두 route 모두 guard 레벨 403", async () => {
      const ids = await seedJobs(ALL);
      const modesResult = await measure(MODES, userCookie);
      expect(modesResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(modesResult.samplesMs).toHaveLength(0);
      expect(JSON.stringify(lastBody)).not.toContain("destructive");
      const runResult = await measure(RUNNING, userCookie);
      expect(runResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(JSON.stringify(lastBody)).not.toContain(ids.runMerge);
      expect(assertS2Threshold(runResult, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // error path — 미존재 id 의 `:id` 는 `findUniqueOrThrow` 의 P2025 → 404. 측정 대상
    // 2 route 의 경로 오인 방지용 최소 1 case 이며 p95 표본에는 넣지 않는다.
    it("(e) 미존재 id :id 조회: 404(P2025 → NotFoundException)", async () => {
      await seedJobs(ALL);
      const result = await measure(`${BASE}/no-such-job-id`, adminCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
  });
});

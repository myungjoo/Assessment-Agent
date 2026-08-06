// summary-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 6**.
// (T-1510, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치와 새 축 — slice 1~5(`*-realdb`)에 이은 **slice 6**(구조는 slice 5 승계, 앞 slice 수정 0). 새 축
//    둘: (a) **동일 tuple 중복 index** — `Summary` 는 `@@unique([personId, period, periodStart])` 와
//    `@@index(...)` 가 같은 tuple 인 유일 entity 라 optimizer 가 어느 index 를 타든 REQ-048 임계가
//    성립하는지의 첫 증거다. (b) **payload 크기** — `narrative` 가 서술형 long text.
// ② 실행 경로 — `jest-perf.json` 매칭이라 `pnpm test:perf` 로만 실행되고 기본 `pnpm test` 에는 picking
//    되지 않는다(실 Postgres 전제는 CI 의 `perf test` step 이 충족).
// ③ mock 0 · override 0 — 실 `JwtAuthGuard`/`RolesGuard`(`@Roles("User")`)를 **실 JWT 로 통과** 하고,
//    검증도 `toHaveBeenCalledTimes` 대신 **응답 body 가 seed row 값과 일치** 함으로 실 query 발화를
//    입증한다(fail 분기는 404 · 400/401 · `p95MaxMs: 0` 라 측정 시간 무의존). production code · write
//    route · mock 짝 · 임계값 · baseline write 불변이며 REQ-047 실 scale 부하가 아니다.
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
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 5 와 동등한 여유.
jest.setTimeout(120_000);

// seed 규모(period 별 row 수) + 반복 횟수(SHORT 는 분기 도달용 짧은 반복).
const WEEK_ROWS = 4;
const MONTH_ROWS = 2;
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB 인증 경유 summary 시계열 조회 (GET /api/summaries, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  // 변조 토큰 cookie — 서명이 깨진 JWT 라 `JwtAuthGuard` 가 401(negative ④).
  let tamperedCookie: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User seed + 실 JWT 발급을 한 번에.
    ctx = await createAuthenticatedE2EApp([{ role: "User" }]);
    app = ctx.app;
    prisma = ctx.prisma;
    const token = Object.values(ctx.tokens)[0];
    cookie = buildAuthCookie(token);
    tamperedCookie = buildAuthCookie(`${token}tampered`);
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 **원본 id
  // 그대로** 재삽입해야 sub 매칭이 유지된다(새 id·token 재발급 금지).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 응답 대조 anchor. `narrative` 는 long text 축 — 한 줄 문장을 반복해 payload 를 키운다.
  const narrativeOf = (period: string, i: number): string =>
    `실DB요약서술-${period}-${i}: ${"이 기간의 기여는 정량·정성 양면에서 안정적으로 관측됐다. ".repeat(4)}`;

  // 시계열 seed — Person → Summary(week 4 + month 2). `@@unique([personId, period, periodStart])`
  // 충돌(P2002) 회피로 period 안에서 periodStart 를 row 마다 다르게 주고, 그 명시값이
  // `orderBy: { periodStart: "desc" }` 결정론도 보장한다. Person 없이 자식 생성 금지(P2003).
  const seedSummaries = async (): Promise<string> => {
    const person = await prisma.person.create({
      data: {
        fullName: "실DB요약대상",
        email: "realdb-summary-perf@example.test",
      },
    });
    const rowsOf = (period: string, count: number, baseDay: number) =>
      Array.from({ length: count }, (_, i) => ({
        personId: person.id,
        period,
        // baseDay 부터 7 일 간격 — period 안에서 좌표가 겹치지 않는다.
        periodStart: new Date(Date.UTC(2026, 0, baseDay + i * 7)),
        narrative: narrativeOf(period, i),
        metricScore: 60 + i,
      }));
    await prisma.summary.createMany({
      data: [
        ...rowsOf("week", WEEK_ROWS, 5),
        ...rowsOf("month", MONTH_ROWS, 1),
      ],
    });
    return person.id;
  };

  // 조회 1회 — 목록·상세 공용. `authCookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (path: string, authCookie: string | null = cookie): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/summaries${path}`);
      const res = await (authCookie === null
        ? req
        : req.set("Cookie", authCookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  const measure = (
    path: string,
    n = SHORT_ITERATIONS,
    authCookie: string | null = cookie,
  ) => collectLatencySamples(getRequest(path, authCookie), n);

  // AC happy ① — 다중 row 시계열 목록. 동일 tuple 중복 index 경로의 첫 실 DB 측정이자, 응답이 seed 의
  // narrative(long text)·periodStart 최신순과 일치함으로 실 query 발화를 입증한다.
  it("happy ①(시계열 목록): ?personId=&period=week → 200 + narrative·periodStart 최신순 일치 + p95 < 3000ms pass", async () => {
    const personId = await seedSummaries();
    const path = `?personId=${personId}&period=week`;
    const result = await measure(path, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as { narrative: string; periodStart: string }[];
    expect(body).toHaveLength(WEEK_ROWS);
    // desc 정렬이므로 seed 역순 — long text narrative 까지 그대로 일치해야 한다.
    expect(body.map((s) => s.narrative)).toEqual(
      Array.from({ length: WEEK_ROWS }, (_, i) =>
        narrativeOf("week", WEEK_ROWS - 1 - i),
      ),
    );
    const times = body.map((s) => new Date(s.periodStart).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    const strict = assertS2Threshold(result, { p95MaxMs: 0 });
    expect(strict.pass).toBe(false);
    expect(strict.reasons.join()).toContain("p95 임계 초과");
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC happy ② — 상세 route. `metricScore` 는 `Decimal` 이라 직렬화 형태를 못박지 않고 문자열화 비교.
  it("happy ②(상세): 실 row id 반복 조회 → 200 + id·period·narrative 일치 + p95 pass", async () => {
    const personId = await seedSummaries();
    const row = await prisma.summary.findFirstOrThrow({
      where: { personId, period: "week" },
    });
    const result = await measure(`/${row.id}`, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body.period).toBe("week");
    expect(body.narrative).toBe(row.narrative);
    expect(String(body.metricScore)).toBe(String(row.metricScore));
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 분기 ① — period 지정 = `where: { personId, period }` 2 컬럼 경로. 다른 period row 격리.
  it("분기 ①(period 지정): ?period=month → month row 만, week row 0", async () => {
    const personId = await seedSummaries();
    const result = await measure(`?personId=${personId}&period=month`);
    expect(result.failures).toBe(0);
    const body = lastBody as { period: string }[];
    expect(body).toHaveLength(MONTH_ROWS);
    expect(body.every((s) => s.period === "month")).toBe(true);
  });

  // AC 분기 ② — period 미지정 = `where: { personId }` leftmost prefix 경로(전체 period 반환).
  it("분기 ②(period 미지정): ?personId= 만 → 전체 period row + 전체 최신순 정렬", async () => {
    const personId = await seedSummaries();
    const result = await measure(`?personId=${personId}`);
    expect(result.failures).toBe(0);
    const body = lastBody as { period: string; periodStart: string }[];
    expect(body).toHaveLength(WEEK_ROWS + MONTH_ROWS);
    expect(new Set(body.map((s) => s.period))).toEqual(
      new Set(["week", "month"]),
    );
    const times = body.map((s) => new Date(s.periodStart).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 분기 ③ — 매칭 0 → **404 아닌** 200 + 빈 배열(summary.service.ts findByPerson 주석).
  it("분기 ③(매칭 0): summary 없는 Person id → 404 가 아니라 200 + 빈 배열", async () => {
    await seedSummaries();
    const empty = await prisma.person.create({
      data: {
        fullName: "실DB요약없음",
        email: "realdb-summary-empty@example.test",
      },
    });
    const result = await measure(`?personId=${empty.id}`);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastBody as unknown[]).toHaveLength(0);
    // 미존재 personId 도 존재 검증이 없어 동일하게 200 + 빈 배열(service pass-through).
    await measure("?personId=realdb-no-such", 1);
    expect(lastBody as unknown[]).toHaveLength(0);
  });

  // AC error path — 실 DB row 부재의 404 는 실 측정 시간에 무의존한 결정론적 fail 분기.
  it("error path: 미존재 :id → 전부 404 failures, pass === false + errorRate 사유", async () => {
    expect(await prisma.summary.count()).toBe(0);
    const result = await measure("/realdb-summary-missing");
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(assertion.reasons.join()).toContain("error rate 임계 초과");
  });

  describe("negative cases 충분 cover", () => {
    // (a) personId query 누락(undefined 조건) — controller 가 BadRequestException(400) 강제.
    it("(a) personId 누락 → 전부 400 failures, pass === false", async () => {
      await seedSummaries();
      const result = await measure("");
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) `VALID_PERIODS` 밖 period — service 가 400. 200 과 번갈아 호출해 errorRate 중간값도 확인.
    it("(b) period=year → 400, 200 과 혼합 시 errorRate 가 0 < er < 1", async () => {
      const personId = await seedSummaries();
      const invalid = await measure(`?personId=${personId}&period=year`);
      expect(invalid.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 허용 period(200), 짝수 번째는 허용 밖 period(400).
        const period = call % 2 === 1 ? "week" : "year";
        return getRequest(`?personId=${personId}&period=${period}`)();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.pass).toBe(false);
    });

    // (c) Cookie 미부착 → `JwtAuthGuard` 401. guard 가 실제로 살아 있음의 증거.
    it("(c) 인증 없음(Cookie 미부착) → 전부 401 failures, pass === false", async () => {
      const q = `?personId=${await seedSummaries()}`;
      const result = await measure(q, SHORT_ITERATIONS, null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (d) 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패. (c) 의 "부재" 와 별개 조건의 401.
    it("(d) 변조/무효 토큰 cookie → 전부 401 failures, 상세 route 도 동일", async () => {
      const q = `?personId=${await seedSummaries()}`;
      const result = await measure(q, SHORT_ITERATIONS, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      // 상세 route 도 guard 가 먼저라 row 존재 여부와 무관하게 401(404 아님).
      await measure("/realdb-summary-missing", 1, tamperedCookie);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });
  });
});

// assessment-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 4**.
// (T-1506, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치와 새 축 — slice 1(`person-read-realdb.perf-spec.ts`) · slice 2(`group-read-realdb.perf-spec.ts`)
//    · slice 3(`group-persons-scale-realdb.perf-spec.ts`) 에 이은 **slice 4**(부트스트랩·seed·정리
//    **구조는 slice 3 승계**, 앞 slice 파일 수정 0). 앞 세 slice 가 못 건드린 두 축을 처음 실측한다 —
//    (a) **인증·RBAC guard 경유**: `AssessmentController` 는 `@UseGuards(JwtAuthGuard, RolesGuard)` +
//    `@Roles("User")` 가 붙은 첫 측정 대상이라, REQ-048 임계가 **인증 layer + DB round-trip 을 모두
//    포함한** 경로에서도 성립하는지의 첫 증거다. (b) **index 필터 경로**: `GET /api/assessments`
//    (REQ-038) 는 `@@index([personId, period, periodStart])` 를 타는 필터 + 다중 row 조회라 slice 1 의
//    flat 목록·slice 2·3 의 N+1 loop 와 구조가 다르다.
// ② 실행 경로 — `jest-perf.json`(`testRegex: .*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만
//    실행되고 기본 `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres 전제는 CI 의
//    `perf test` step 이 충족).
// ③ mock 0 · override 0 — service mock 0(`AssessmentService`/`PrismaService` 어느 것도 useValue 로
//    대체하지 않음) + **guard override 0**: 앞 slice 의 "override 0" 은 곧 "guard 없음" 이었지만 본
//    slice 는 실 `JwtAuthGuard`/`RolesGuard` 를 **실 JWT 로 통과** 한다. 검증도 mock 의
//    `toHaveBeenCalledTimes` 대신 **응답 body 가 seed 한 row 값과 일치** 함으로 실 query 발화를 입증하고,
//    fail 분기는 미존재 row 의 404 · 400/401 · 비현실적 임계(`p95MaxMs: 0`) 라 측정 시간에 무의존이다.
// ④ Out of Scope — production code 변경 0 / mock 짝(`assessment-read.perf-spec.ts` ·
//    `assessment-detail-read.perf-spec.ts`) 불변(대체 아닌 보완) / write route / 임계값 변경 · baseline
//    파일 write / 규모 민감도 / 동시성 S3. 본 seed 규모는 상대 비교용 표본일 뿐 **REQ-047 의 실 scale
//    부하 검증이 아니다**.
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

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 3 와 동등한 여유를 둔다.
jest.setTimeout(120_000);

// seed 규모(고정 소규모, period 별 row 수) + 반복 횟수(SHORT 는 분기 도달용 짧은 반복).
const WEEK_ROWS = 4;
const MONTH_ROWS = 3;
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB 인증 경유 시계열 조회 (GET /api/assessments, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User seed + 실 JWT 발급을 한 번에.
    ctx = await createAuthenticatedE2EApp([{ role: "User" }]);
    app = ctx.app;
    prisma = ctx.prisma;
    cookie = buildAuthCookie(Object.values(ctx.tokens)[0]);
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 때문에 afterEach 마다 JWT 의 `sub` 가 가리키는
  // actor row 가 사라진다 → **원본 id 그대로** 재삽입해야 sub 매칭이 유지된다(새 id·token 재발급 금지).
  // Assessment 는 Person CASCADE 로 동반 truncate.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // seed row 의 결정론적 식별 값 — 응답 body 대조(실 query 발화 입증) anchor. 앞 WEEK_ROWS 개가 week.
  const narrativeOf = (i: number): string =>
    `실DB평가서술-${i < WEEK_ROWS ? "week" : "month"}-${i}`;

  // Person 1 + Assessment (WEEK_ROWS + MONTH_ROWS) seed. create loop 이 아니라 `createMany` 로 일괄
  // 조립하고, `@@unique([personId, period, scope, periodStart])` 충돌(P2002) 회피용으로 `periodStart`
  // 를 row 마다 다르게 준다.
  const seedAssessments = async (): Promise<string> => {
    const person = await prisma.person.create({
      data: {
        fullName: "실DB평가대상",
        email: "realdb-assessment-perf@example.test",
      },
    });
    await prisma.assessment.createMany({
      data: Array.from({ length: WEEK_ROWS + MONTH_ROWS }, (_, i) => ({
        personId: person.id,
        period: i < WEEK_ROWS ? "week" : "month",
        scope: "aggregate",
        periodStart: new Date(Date.UTC(2026, 0, 1 + i)),
        difficulty: "medium",
        contributionScore: 42,
        volume: 10 + i,
        narrative: narrativeOf(i),
      })),
    });
    return person.id;
  };

  // 조회 1회 — 목록·상세 공용. `authed=false` 면 Cookie 미부착이라 `JwtAuthGuard` 401 분기로 간다.
  const getRequest =
    (path: string, authed = true): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/assessments${path}`);
      const res = await (authed ? req.set("Cookie", cookie) : req);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  // AC 2 + AC 4 분기 ① — period 지정. 인증 guard 를 실제로 통과한 경로의 첫 실 DB 측정.
  it("happy ①(목록/period 지정): 인증 경유 ?personId=&period=week → 200 + seed 와 일치 + p95 < 3000ms pass", async () => {
    const personId = await seedAssessments();
    const result = await collectLatencySamples(
      getRequest(`?personId=${personId}&period=week`),
      ITERATIONS,
    );
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    // mock 이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const body = lastBody as { narrative: string; period: string }[];
    expect(body).toHaveLength(WEEK_ROWS);
    expect(body.every((a) => a.period === "week")).toBe(true);
    expect(body.map((a) => a.narrative).sort()).toEqual(
      Array.from({ length: WEEK_ROWS }, (_, i) => narrativeOf(i)).sort(),
    );
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 4 분기 ② — period 미지정 → 전체 period row(week + month) 반환.
  it("분기 ②(목록/period 미지정): ?personId= 만 → 전체 period row 반환(① 이상) + p95 pass", async () => {
    const personId = await seedAssessments();
    const result = await collectLatencySamples(
      getRequest(`?personId=${personId}`),
      ITERATIONS,
    );
    expect(result.failures).toBe(0);
    const body = lastBody as { period: string }[];
    expect(body).toHaveLength(WEEK_ROWS + MONTH_ROWS);
    expect(body.length).toBeGreaterThanOrEqual(WEEK_ROWS);
    expect(body.filter((a) => a.period === "month")).toHaveLength(MONTH_ROWS);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 4 분기 ③ — 매칭 row 0 → **404 아닌** 200 + 빈 배열(assessment.service.ts `95 행` ~ `107 행`).
  it("분기 ③(매칭 0): assessment 없는 Person id → 404 가 아니라 200 + 빈 배열, count === 요청 수", async () => {
    const empty = await prisma.person.create({
      data: { fullName: "실DB무평가", email: "realdb-empty-perf@example.test" },
    });
    const result = await collectLatencySamples(
      getRequest(`?personId=${empty.id}`),
      SHORT_ITERATIONS,
    );
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 3 — 상세 route. `contributionScore` 는 `Decimal` 이라 직렬화 형태를 못박지 않고 문자열화 비교.
  it("happy ②(상세): 인증 경유 :id 반복 조회 → 200 + id·period·scope 일치 + p95 pass", async () => {
    const personId = await seedAssessments();
    const where = { personId };
    const row = await prisma.assessment.findFirstOrThrow({ where });
    const result = await collectLatencySamples(
      getRequest(`/${row.id}`),
      ITERATIONS,
    );
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body.period).toBe(row.period);
    expect(body.scope).toBe("aggregate");
    expect(body.narrative).toBe(row.narrative);
    expect(String(body.contributionScore)).toBe(String(row.contributionScore));
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 5 — error path. 실 DB row 부재의 404 는 실 측정 시간에 무의존한 결정론적 fail 분기.
  it("error path: 미존재 :id → 전부 404 failures, pass === false + errorRate 사유", async () => {
    expect(await prisma.assessment.count()).toBe(0);
    const result = await collectLatencySamples(
      getRequest("/realdb-assessment-missing"),
      SHORT_ITERATIONS,
    );
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);
  });

  describe("negative cases 충분 cover(AC 6)", () => {
    // (a) personId query 누락 — controller 가 BadRequestException(400) 강제.
    it("(a) personId 누락 → 전부 400 failures, pass === false", async () => {
      await seedAssessments();
      const result = await collectLatencySamples(
        getRequest(""),
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 허용 집합(day/week/month) 밖 period → service 검증 400. 200 과 번갈아 호출해 errorRate 가
    //     중간값(0 < er < 1)으로 산출되는 것도 확인한다.
    it("(b) period=year → 400, 200 과 혼합 시 errorRate 가 0 < er < 1", async () => {
      const personId = await seedAssessments();
      const invalid = await collectLatencySamples(
        getRequest(`?personId=${personId}&period=year`),
        SHORT_ITERATIONS,
      );
      expect(invalid.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 허용 period(200), 짝수 번째는 허용 집합 밖(400).
        const period = call % 2 === 1 ? "week" : "year";
        return getRequest(`?personId=${personId}&period=${period}`)();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (c) Cookie 미부착 → `JwtAuthGuard` 401. guard 가 실제로 살아 있음의 증거(앞 slice 는 불가 분기).
    it("(c) 인증 없음(Cookie 미부착) → 전부 401 failures, pass === false", async () => {
      const personId = await seedAssessments();
      const result = await collectLatencySamples(
        getRequest(`?personId=${personId}&period=week`, false),
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (d) 비현실적 임계 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 fail(측정 시간 무의존).
    it("(d) 실측이 빨라도 p95MaxMs: 0 을 주면 pass === false + p95 사유", async () => {
      const personId = await seedAssessments();
      const result = await collectLatencySamples(
        getRequest(`?personId=${personId}&period=week`),
        SHORT_ITERATIONS,
      );
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });
  });
});

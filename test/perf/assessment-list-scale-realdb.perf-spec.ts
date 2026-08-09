// assessment-list-scale-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 24**.
// (T-1547, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — 규모 축 구조는 slice 23(`person-list-scale-realdb.perf-spec.ts`, T-1545), 인증 경유
//    부트스트랩·seed·정리는 slice 4(`assessment-read-realdb.perf-spec.ts`, T-1506) 승계(산문 복제 대신
//    cross-ref, 앞 slice 수정 0). route 는 slice 4 와 **같은** `GET /api/assessments` 이고 그 고정
//    소규모 한 표본을 규모 축으로 넓힌다.
// ② 고유 축 — ⓐ guard(`JwtAuthGuard` + `RolesGuard` + `@Roles("User")`, controller `93~107 행`) 경유
//    **첫 규모 축 slice** 라 guard 비용이 결과 집합 규모와 무관한 상수인지가 처음 관찰되고, ⓑ 필터가
//    `@@index([personId, period, periodStart])` 의 prefix **2 단**(personId → period)이라 "테이블 총
//    row 는 크고 응답은 작다" 를 index 경유로 만드는 첫 표본이다(slice 23 의 선택도 축은 무-index
//    boolean `active` 라 스캔 대상이 줄지 않았다).
// ③ 결정론 — 고정 행 수 seed + `afterEach(truncateAll)`(ADR-0004 §Cleanup) 직후
//    `reseedAuthenticatedActors`(원본 id 그대로 — 새 id·token 재발급 금지), `@@unique` 충돌은 row 별
//    `periodStart` 로 회피. latency 는 wall-clock 이라 **어떤 두 측정값의 대소도 단언하지 않고**
//    (`large > small` 금지) 관찰 줄로만 남긴다 — 허용 단언은 임계 3000ms pass 와 `p95MaxMs: 0` fail.
// ④ Out of Scope — production code·schema 변경 0(index 추가·쿼리 최적화·페이지네이션 포함) / 기존
//    perf-spec·helper·primitive 수정 0 / mock 짝 불변 / 임계값·baseline write 0 / 동시성 S3. "대규모"
//    는 상대 비교용 표본일 뿐 **REQ-047 실 scale 부하 검증이 아니다**.
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
import { summarizeLatency } from "./latency-metrics";

jest.setTimeout(120_000);

// 두 규모 표본 + 타 person 혼입 + 대규모의 week 몫 + 반복 횟수(대규모는 직렬화 비용이 커 줄이고
// SHORT 는 분기 도달용 — slice 3·23 선례). 아래 상수는 전부 상대 비교용 소규모 표본이다.
const SMALL_ROWS = 10;
const LARGE_ROWS = 200;
const OTHER_PERSON_ROWS = 150;
const LARGE_WEEK_ROWS = 60;
const SMALL_ITERATIONS = 8;
const LARGE_ITERATIONS = 5;
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB 인증 경유 목록 규모 민감도 (GET /api/assessments, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;
  // AC 6 — 표본별 baseline 한 줄 관찰을 선언 순서대로 축적(대소 assert 금지, 디스크 write 0).
  const observations: string[] = [];

  beforeAll(async () => {
    // mock override 0 · guard override 0 — 실 AppModule + actor User seed + 실 JWT 발급.
    ctx = await createAuthenticatedE2EApp([{ role: "User" }]);
    app = ctx.app;
    prisma = ctx.prisma;
    cookie = buildAuthCookie(Object.values(ctx.tokens)[0]);
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 곧바로 원본 id 로 재삽입한다.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Person 1 + Assessment `count` 건 seed(앞 `weekRows` 개가 week, 나머지 month). `periodStart` 를 row
  // 마다 다르게 줘 `@@unique` 충돌(P2002)을 회피하고 createMany 1 round-trip 으로 조립한다.
  const seedPerson = async (
    label: string,
    count: number,
    weekRows: number,
  ): Promise<string> => {
    const { id } = await prisma.person.create({
      data: {
        fullName: `실DB목록평가대상-${label}`,
        email: `realdb-assessment-list-${label}@example.test`,
      },
    });
    await prisma.assessment.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        personId: id,
        period: i < weekRows ? "week" : "month",
        scope: "aggregate",
        periodStart: new Date(Date.UTC(2026, 0, 1 + i)),
        difficulty: "medium",
        contributionScore: 42,
        volume: 10 + i,
        narrative: `실DB목록평가-${label}-${i}`,
      })),
    });
    return id;
  };

  // 목록 조회 1회. `authed=false` 면 Cookie 미부착이라 `JwtAuthGuard` 401 분기로 간다.
  const listRequest =
    (query: string, authed = true): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/assessments${query}`);
      const res = await (authed ? req.set("Cookie", cookie) : req);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  const sample = (query: string, iterations: number, authed = true) =>
    collectLatencySamples(listRequest(query, authed), iterations);

  const rows = (): { personId: string; period: string }[] =>
    lastBody as { personId: string; period: string }[];

  // AC 6 관찰 한 줄 — 파일 write 없이 배열에만 쌓는다.
  const observe = (label: string, scale: number, a: S2Assertion): string => {
    const env = { label, concurrency: 1, dataScale: `${scale} assessments` };
    const line = formatBaselineLine(buildBaselineReport(env, a));
    observations.push(line);
    return line;
  };

  // AC 2 ① — 소규모. 응답 길이가 seed 행 수와 정확히 일치함으로 실 query 발화를 입증.
  it("happy ①(소규모): 인증 경유 10 row 반복 조회 → 200 + 응답 길이 10 + p95 < 3000ms pass", async () => {
    const id = await seedPerson("small", SMALL_ROWS, 4);
    const result = await sample(`?personId=${id}`, SMALL_ITERATIONS);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(SMALL_ROWS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(SMALL_ITERATIONS);
    expect(observe("realdb-alist-small", SMALL_ROWS, assertion)).toContain(
      "p95",
    );
  });

  // AC 2 ② — 대규모(본 slice 핵심). 같은 guard stack 을 20 배 결과 집합으로 통과시키고, AC 4 의
  // fail 분기도 같은 실측 표본에 비현실적 임계를 주입해 함께 도달한다(측정 시간 무의존).
  it("happy ②(대규모): 200 row 반복 조회 → 200 + 길이 200 + p95 pass, p95MaxMs:0 주입은 fail", async () => {
    const id = await seedPerson("large", LARGE_ROWS, LARGE_WEEK_ROWS);
    const result = await sample(`?personId=${id}`, LARGE_ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(LARGE_ROWS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    observe("realdb-alist-large", LARGE_ROWS, assertion);
    const strict = assertS2Threshold(result, { p95MaxMs: 0 });
    expect(strict.pass).toBe(false);
    expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(true);
    // AC 6 — 두 줄의 관찰. **대소 관계는 assert 하지 않는다**(wall-clock 비결정성).
    expect(observations[0]).toContain(`dataScale=${SMALL_ROWS} `);
    expect(observations[1]).toContain(`dataScale=${LARGE_ROWS} `);
  });

  // AC 3 — index prefix 2 단 선택도. 테이블 총 row(200 + 150)와 응답 크기(200 → 60)가 분리되는
  // 표본: ⓐ personId 가 타인 150 row 를 배제하고 ⓑ period 가 그 안을 다시 60 으로 좁힌다.
  it("분기: 타 person 150 row 혼입 → ⓐ 200 건 · ⓑ week 60 건 · 혼입 0 · 둘 다 p95 pass", async () => {
    const id = await seedPerson("target", LARGE_ROWS, LARGE_WEEK_ROWS);
    await seedPerson("other", OTHER_PERSON_ROWS, 40);
    const total = LARGE_ROWS + OTHER_PERSON_ROWS;
    expect(await prisma.assessment.count()).toBe(total);
    const onlyPerson = await sample(`?personId=${id}`, SHORT_ITERATIONS);
    expect(onlyPerson.failures).toBe(0);
    expect(rows()).toHaveLength(LARGE_ROWS);
    expect(rows().filter((a) => a.personId !== id)).toHaveLength(0);
    const assertionA = assertS2Threshold(onlyPerson);
    expect(assertionA.pass).toBe(true);
    observe("realdb-alist-mixed", LARGE_ROWS, assertionA);
    const week = await sample(`?personId=${id}&period=week`, SHORT_ITERATIONS);
    expect(week.failures).toBe(0);
    expect(rows()).toHaveLength(LARGE_WEEK_ROWS);
    expect(rows().every((a) => a.period === "week" && a.personId === id)).toBe(
      true,
    );
    const assertionB = assertS2Threshold(week);
    expect(assertionB.pass).toBe(true);
    observe("realdb-alist-week", LARGE_WEEK_ROWS, assertionB);
    expect(observations).toHaveLength(4);
  });

  describe("negative cases 충분 cover(AC 5)", () => {
    // (a) personId query 누락 — controller 가 BadRequestException(400) 강제.
    it("(a) personId 누락 → 전부 400 failures, pass === false", async () => {
      await seedPerson("missing-query", SMALL_ROWS, 4);
      const result = await sample("", SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 경계값 — 매칭 0 건은 404 가 아니라 200 + 빈 배열이고 테이블 row 는 잔존한다(빈 컬렉션 ≠ 오류).
    it("(b) 전량 month seed 에 period=week → 404 아닌 200 + 빈 배열, row 는 잔존", async () => {
      const id = await seedPerson("month-only", SMALL_ROWS, 0);
      const q = `?personId=${id}&period=week`;
      const result = await sample(q, SHORT_ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
      expect(await prisma.assessment.count()).toBe(SMALL_ROWS);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (c) Cookie 미부착 → `JwtAuthGuard` 401. 규모와 무관하게 guard 가 살아 있음의 증거.
    it("(c) 인증 없음(Cookie 미부착) → 대규모 표본에서도 전부 401, pass === false", async () => {
      const id = await seedPerson("unauth", LARGE_ROWS, LARGE_WEEK_ROWS);
      const result = await sample(`?personId=${id}`, SHORT_ITERATIONS, false);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (d) 인위 non-2xx 주입 → errorRate 1 위반, 실 200 과 혼합하면 0 < er < 1.
    it("(d) 인위 non-2xx 주입 → errorRate 1 위반, 200 혼합 표본은 0 < er < 1", async () => {
      const id = await seedPerson("errorrate", SMALL_ROWS, 4);
      const allFail = await collectLatencySamples(
        async () => ({ status: 503 }),
        SHORT_ITERATIONS,
      );
      expect(allFail.failures).toBe(SHORT_ITERATIONS);
      const failed = assertS2Threshold(allFail);
      expect(failed.pass).toBe(false);
      expect(failed.errorRate).toBe(1);
      expect(failed.reasons.join()).toContain("error rate 임계 초과");
      let call = 0;
      // 홀수 번째는 실 목록 조회(200), 짝수 번째는 인위 500.
      const mixed: RequestFn = async () =>
        (call += 1) % 2 === 1
          ? listRequest(`?personId=${id}`)()
          : { status: 500 };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.pass).toBe(false);
    });

    // (e) truncate 전/후 대조 쌍 — 응답 200 → 0 건, 둘 다 200. truncate 가 actor `User` 도 지우므로
    //     원본 id 그대로 재삽입해야 후속 요청이 401 이 되지 않는다.
    it("(e) 대규모 seed → truncate 전/후 대조 쌍: 응답 200 건 → 0 건, 둘 다 status 200", async () => {
      const id = await seedPerson("trunc", LARGE_ROWS, LARGE_WEEK_ROWS);
      const before = await sample(`?personId=${id}`, 1);
      expect(before.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(LARGE_ROWS);
      await truncateAll(prisma);
      await reseedAuthenticatedActors(ctx);
      const after = await sample(`?personId=${id}`, SHORT_ITERATIONS);
      expect(after.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
      expect(assertS2Threshold(after).pass).toBe(true);
    });
  });
});

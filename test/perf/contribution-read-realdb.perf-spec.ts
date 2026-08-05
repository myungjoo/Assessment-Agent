// contribution-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 5**.
// (T-1508, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치와 새 축 — slice 1~4(person · group · group-persons-scale · assessment 의 `*-realdb`)에 이은
//    **slice 5**(부트스트랩·seed·정리 구조는 slice 4 승계, 앞 slice 파일 수정 0). 새 축은 **조회 구조**
//    다 — (a) **부모→자식 FK fan-out**: `ContributionRepository.findByAssessment` 는 부모
//    (`Assessment`) id 로 자식 다중 row 를 `createdAt` 오름차순으로 긁고, 그 필터는 slice 4 의 명시
//    `@@index` 가 아니라 **`@@unique([assessmentId, sourceRef])` composite unique index 의 prefix** 를
//    탄다. (b) **3-level FK chain seed**: `Person → Assessment → Contribution` 로 앞 slice(2-level)
//    보다 한 단계 깊다. 즉 REQ-048 임계가 fan-out 경로에서도 성립하는지의 첫 증거다.
// ② 실행 경로 — `jest-perf.json`(`testRegex: .*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만
//    실행되고 기본 `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres 전제는 CI 의
//    `perf test` step 이 충족).
// ③ mock 0 · override 0 — service mock 0 + **guard override 0**: 실 `JwtAuthGuard`/`RolesGuard`
//    (`@Roles("User")`)를 **실 JWT 로 통과** 하고, 검증도 mock 의 `toHaveBeenCalledTimes` 대신 **응답
//    body 가 seed row 값과 일치** 함으로 실 query 발화를 입증한다(fail 분기는 404 · 400/401 ·
//    `p95MaxMs: 0` 라 측정 시간 무의존). production code · write route · mock 짝 spec · 임계값 ·
//    baseline write 불변, 본 seed 는 **REQ-047 실 scale 부하 검증이 아니다**.
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

// 실 DB 부트스트랩 + 인증 seed + 3-level FK chain seed + 반복 요청 — slice 4 와 동등한 여유.
jest.setTimeout(120_000);

// seed 규모(부모 Assessment 별 자식 row 수) + 반복 횟수(SHORT 는 분기 도달용 짧은 반복).
const PRIMARY_CHILDREN = 5;
const OTHER_CHILDREN = 3;
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB 인증 경유 fan-out 조회 (GET /api/contributions, REQ-048)", () => {
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
  // actor row 가 사라진다 → **원본 id 그대로** 재삽입해야 sub 매칭 유지(새 id·token 재발급 금지).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 응답 body 대조(실 query 발화 입증) anchor 이자 `@@unique` 충돌(P2002) 회피용 고유 sourceRef.
  const refOf = (label: string, i: number): string =>
    `실DB기여참조-${label}-${i}`;
  const refsOf = (label: string, n: number): string[] =>
    Array.from({ length: n }, (_, i) => refOf(label, i));

  // 3-level FK chain seed — Person → Assessment 3 개(자식 있는 둘 + 자식 0 인 `empty`) → 각 부모의
  // 자식 Contribution. seed 함정 3 종: (1) Assessment 는 `@@unique([personId, period, scope,
  // periodStart])` 회피로 periodStart 를 다르게, (2) 자식은 sourceRef 를 row 마다 다르게(P2002 회피),
  // (3) `createMany` 의 `createdAt` 기본값이 한 순간으로 몰려 `orderBy asc` 가 비결정적이 되지 않도록
  // createdAt 명시. 상위 row 없이 자식을 만들지 않는다(P2003).
  const seedFanout = async () => {
    const person = await prisma.person.create({
      data: {
        fullName: "실DB기여대상",
        email: "realdb-contribution-perf@example.test",
      },
    });
    const makeAssessment = async (day: number): Promise<string> => {
      const row = await prisma.assessment.create({
        data: {
          personId: person.id,
          period: "week",
          scope: "aggregate",
          periodStart: new Date(Date.UTC(2026, 0, day)),
          difficulty: "medium",
          contributionScore: 42,
          volume: 10,
          narrative: `실DB기여부모-${day}`,
        },
      });
      return row.id;
    };
    const primary = await makeAssessment(1);
    const other = await makeAssessment(8);
    const empty = await makeAssessment(15);
    const childrenOf = (assessmentId: string, label: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        assessmentId,
        sourceType: "commit",
        sourceUrl: `https://example.test/${label}/${i}`,
        sourceRef: refOf(label, i),
        difficulty: "easy",
        contributionScore: 1 + i,
        volume: 2 + i,
        createdAt: new Date(Date.UTC(2026, 1, 1, 0, 0, i)),
      }));
    await prisma.contribution.createMany({
      data: [
        ...childrenOf(primary, "primary", PRIMARY_CHILDREN),
        ...childrenOf(other, "other", OTHER_CHILDREN),
      ],
    });
    return { primary, other, empty };
  };

  // 조회 1회 — 목록·상세 공용. `authed=false` 면 Cookie 미부착이라 `JwtAuthGuard` 401 분기로 간다.
  const getRequest =
    (path: string, authed = true): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/contributions${path}`);
      const res = await (authed ? req.set("Cookie", cookie) : req);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  // 반복 측정 1묶음 — 모든 test 가 공유해 중복을 줄인다(AC 12 cap 준수).
  const measure = (path: string, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path), n);

  // AC 2 — fan-out 목록. 부모 id 필터가 `@@unique` prefix 를 타는 경로의 첫 실 DB 측정.
  it("happy ①(fan-out 목록): ?assessmentId= → 200 + seed 자식 수·sourceRef 일치 + p95 < 3000ms pass", async () => {
    const { primary } = await seedFanout();
    const result = await measure(`?assessmentId=${primary}`, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as { sourceRef: string }[];
    expect(body).toHaveLength(PRIMARY_CHILDREN);
    const refs = refsOf("primary", PRIMARY_CHILDREN);
    expect(body.map((c) => c.sourceRef).sort()).toEqual(refs.sort());
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 3 — 상세 route. `contributionScore` 는 `Decimal` 이라 직렬화 형태를 못박지 않고 문자열화 비교.
  it("happy ②(상세): 실 row id 반복 조회 → 200 + id·sourceType·sourceRef 일치 + p95 pass", async () => {
    const { primary } = await seedFanout();
    const row = await prisma.contribution.findFirstOrThrow({
      where: { assessmentId: primary, sourceRef: refOf("primary", 0) },
    });
    const result = await measure(`/${row.id}`, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body.sourceType).toBe("commit");
    expect(body.sourceRef).toBe(row.sourceRef);
    expect(String(body.contributionScore)).toBe(String(row.contributionScore));
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 4 분기 ① — FK 격리. 다른 Assessment 의 자식이 섞이지 않음(부모 필터의 정확성).
  it("분기 ①(FK 격리): 한쪽 부모 id 로 조회 → 그 부모의 자식만, 다른 부모 자식 0", async () => {
    const { primary, other } = await seedFanout();
    const result = await measure(`?assessmentId=${primary}`);
    expect(result.failures).toBe(0);
    const body = lastBody as { assessmentId: string }[];
    expect(body).toHaveLength(PRIMARY_CHILDREN);
    expect(body.every((c) => c.assessmentId === primary)).toBe(true);
    // 반대편 부모도 자기 자식 수만 돌려받는다(두 부모의 자식이 섞이지 않음).
    await measure(`?assessmentId=${other}`, 1);
    expect(lastBody as unknown[]).toHaveLength(OTHER_CHILDREN);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 4 분기 ② — 매칭 0 → **404 아닌** 200 + 빈 배열(contribution.service.ts `105 행` ~ `111 행`).
  it("분기 ②(매칭 0): 자식 없는 Assessment id → 404 가 아니라 200 + 빈 배열, count === 요청 수", async () => {
    const { empty } = await seedFanout();
    const result = await measure(`?assessmentId=${empty}`);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastBody as unknown[]).toHaveLength(0);
    // 미존재 부모 id 도 존재 검증이 없어 동일하게 200 + 빈 배열(service pass-through).
    await measure("?assessmentId=realdb-no-such", 1);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 4 분기 ③ — 정렬. `orderBy: { createdAt: "asc" }` 가 명시 seed 순서와 일치(결정론).
  it("분기 ③(정렬): 응답이 createdAt 오름차순 = seed 순서와 일치, count === 요청 수", async () => {
    const { primary } = await seedFanout();
    const result = await measure(`?assessmentId=${primary}`);
    const body = lastBody as { sourceRef: string; createdAt: string }[];
    expect(body.map((c) => c.sourceRef)).toEqual(
      refsOf("primary", PRIMARY_CHILDREN),
    );
    const times = body.map((c) => new Date(c.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 5 — error path. 실 DB row 부재의 404 는 실 측정 시간에 무의존한 결정론적 fail 분기.
  it("error path: 미존재 :id → 전부 404 failures, pass === false + errorRate 사유", async () => {
    expect(await prisma.contribution.count()).toBe(0);
    const result = await measure("/realdb-contribution-missing");
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(assertion.reasons.join()).toContain("error rate 임계 초과");
  });

  describe("negative cases 충분 cover(AC 6)", () => {
    // (a) assessmentId query 누락(undefined 조건) — controller 가 BadRequestException(400) 강제.
    it("(a) assessmentId 누락 → 전부 400 failures, pass === false", async () => {
      await seedFanout();
      const result = await measure("");
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 빈 string — undefined 와 **별개 조건** 의 같은 400 분기. 200 과 번갈아 호출해 errorRate 가
    //     중간값(0 < er < 1)으로 산출되는 것도 여기서 확인한다.
    it("(b) assessmentId 빈 string → 400, 200 과 혼합 시 errorRate 가 0 < er < 1", async () => {
      const { primary } = await seedFanout();
      const blank = await measure("?assessmentId=");
      expect(blank.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(400);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 seed 한 부모 id(200), 짝수 번째는 빈 string(400).
        const q = call % 2 === 1 ? primary : "";
        return getRequest(`?assessmentId=${q}`)();
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
      const { primary } = await seedFanout();
      const unauthed = getRequest(`?assessmentId=${primary}`, false);
      const result = await collectLatencySamples(unauthed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (d) 비현실적 임계 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 fail(측정 시간 무의존).
    it("(d) 실측이 빨라도 p95MaxMs: 0 을 주면 pass === false + p95 사유", async () => {
      const { primary } = await seedFanout();
      const result = await measure(`?assessmentId=${primary}`);
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.join()).toContain("p95 임계 초과");
    });
  });
});

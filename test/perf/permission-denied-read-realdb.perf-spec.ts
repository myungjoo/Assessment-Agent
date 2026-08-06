// permission-denied-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip
// **slice 9** (T-1516, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). slice
// 1~8 에 이어 여덟 번째 endpoint 도메인(`GET /api/permission-denied-records`)을 실 Postgres
// 위에서 잰다(구조 slice 8 승계, 앞 slice 수정 0). 새 축 셋 — (a) **거부 대신 결과 집합 축소
// (audience 차등)**: 같은 200 인데 actor 에 따라 발화 query 수가 1(Admin bypass) / 2(allowlist
// 조회 + findMany) / 1(공집합 early return) 로 갈린다. (b) **index 후보 2 개 + 정렬 축 공유**:
// `@@index([instanceRef, createdAt])` · `@@index([provider, httpStatus, createdAt])` 둘에
// `@unique` 0 인 유일 대상이고 `orderBy: createdAt desc` 가 두 index 의 후행 컬럼과 축을
// 공유한다(표본 대소 관계는 단언 0 — slice 3 선례). (c) **다축 query param 조합 + `IN` 절**.
// 첫 `src/user/` 외부 module · append-only audit 테이블이며 mock 0 · override 0 로 실 JWT 가
// guard 를 통과하고 검증은 **응답 body 의 seed 값 대조** 다(401 은 DB 미도달이라 `p95MaxMs: 0`
// 단언). production code · schema · 임계값 불변, 소규모 표본이라 REQ-047 부하가 아니다.
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

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 7·8 과 동등한 여유.
jest.setTimeout(120_000);

const ENDPOINT = "/api/permission-denied-records";
const USER_ACTOR_EMAIL = "realdb-pdr-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-pdr-admin-actor@e2e.test";
// 정규화 no-op 한 instanceRef 2 종(소문자 host) — binding 저장값 == seed 값이라 allowlist
// 매칭이 정규화에 흔들리지 않는다. A 는 binding 대상, B 는 대조군(비혼입 검증).
const INSTANCE_A = "github.sec.samsung.net";
const INSTANCE_B = "github.com";
const PROVIDER_GH = "github";
const PROVIDER_CF = "confluence";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

// seed 표본 5 row — [instanceRef, provider, httpStatus, resourceRef]. `createdAt` 은 index
// 순 하루씩 늘려 `createdAt desc` 선두가 **배열 마지막 row** 가 되도록 고정한다.
const SEED_ROWS = (
  [
    [INSTANCE_A, PROVIDER_GH, 403, "/repos/o/a1/commits"],
    [INSTANCE_A, PROVIDER_GH, 404, "/repos/o/a2/commits"],
    [INSTANCE_A, PROVIDER_CF, 403, "/wiki/a3"],
    [INSTANCE_B, PROVIDER_GH, 403, "/repos/o/b1/commits"],
    [INSTANCE_B, PROVIDER_CF, 401, "/wiki/b2"],
  ] as const
).map(([instanceRef, provider, httpStatus, resourceRef], i) => ({
  instanceRef,
  provider,
  httpStatus,
  resourceRef,
  createdAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
}));

const refsOf = (pred: (row: (typeof SEED_ROWS)[number]) => boolean): string[] =>
  SEED_ROWS.filter(pred)
    .map((r) => r.resourceRef)
    .sort();
const A_REFS_DESC = ["/wiki/a3", "/repos/o/a2/commits", "/repos/o/a1/commits"];

describe("S2 조회 latency perf-spec — 실 DB audience 차등 audit 조회 (GET /api/permission-denied-records, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 변조 토큰 cookie — 서명이 깨진 JWT 라 `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  let userActorId: string;
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
    userActorId = ctx.users[USER_ACTOR_EMAIL].id;
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로
  // **원본 id 그대로** 재삽입한다(재발급 금지). binding 은 `"User"` CASCADE 로 함께 사라져
  // 각 test 안에서 필요한 것만 seed 한다.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // audit record seed — FK 부재 standalone 테이블이라 직접 insert(ADR-0022 §5).
  const seedRecords = async (): Promise<void> => {
    for (const row of SEED_ROWS) {
      await prisma.permissionDeniedRecord.create({
        data: { ...row, principal: null, reason: "permission-denied" },
      });
    }
  };

  // non-Admin actor 의 own-instance allowlist binding 1 건(ADR-0024 §3).
  const grant = async (instanceRef: string): Promise<void> => {
    await prisma.userInstanceAccess.create({
      data: { userId: userActorId, instanceRef },
    });
  };

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (query: string, cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`${ENDPOINT}${query}`);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (q: string, cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(q, cookie), n);
  const bodyRefs = (): string[] =>
    (lastBody as { resourceRef: string }[]).map((r) => r.resourceRef).sort();
  // AC happy ① — Admin actor 무필터 조회(bypass 경로, 요청당 1 query).
  it("happy ①(Admin 무필터): 200 + seed record 전량 + p95 < 3000ms pass", async () => {
    await seedRecords();
    const result = await measure("", adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(bodyRefs()).toEqual(refsOf(() => true));
    // 값 대조로 실 query 발화 입증 — createdAt desc 선두 row 의 3 축 일치.
    const head = (lastBody as Record<string, unknown>[])[0];
    const axes = [head.instanceRef, head.provider, head.httpStatus];
    expect(axes).toEqual([INSTANCE_B, PROVIDER_CF, 401]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });
  // AC happy ② — binding 보유 User actor(allowlist 조회 + findMany, 요청당 2 query).
  it("happy ②(binding 보유 User): 200 + binding instance row 만 + 대조군 비혼입", async () => {
    await seedRecords();
    await grant(INSTANCE_A);
    const result = await measure("", userCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(bodyRefs()).toEqual(refsOf((r) => r.instanceRef === INSTANCE_A));
    expect(bodyRefs()).not.toContain("/wiki/b2"); // 대조군 비혼입
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });
  describe("audience 차등 4 갈래", () => {
    it("(a) Admin bypass: binding 0 이어도 provider 필터가 두 instance 를 모두 포함", async () => {
      await seedRecords();
      const result = await measure(`?provider=${PROVIDER_GH}`, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(bodyRefs()).toEqual(refsOf((r) => r.provider === PROVIDER_GH));
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // binding 0 인 User actor 는 findMany 미호출 early return(403 아님).
    it("(b) allowlist 공집합(binding 0 User): 200 + 빈 배열", async () => {
      await seedRecords();
      const result = await measure("", userCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // allowlist 밖 instanceRef 요청 — 타 instance 비노출(findMany 미호출).
    it("(c) allowlist 밖 instanceRef 요청: 200 + 빈 배열", async () => {
      await seedRecords();
      await grant(INSTANCE_A);
      const result = await measure(`?instanceRef=${INSTANCE_B}`, userCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // allowlist 안 instanceRef — `IN` 절 ∩ exact 교집합으로 단일 instance 축소.
    it("(d) allowlist 안 instanceRef 요청(binding 2): 그 instance 로만 축소", async () => {
      await seedRecords();
      await grant(INSTANCE_A);
      await grant(INSTANCE_B);
      const result = await measure(`?instanceRef=${INSTANCE_A}`, userCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(bodyRefs()).toEqual(refsOf((r) => r.instanceRef === INSTANCE_A));
      expect(assertS2Threshold(result).pass).toBe(true);
    });
  });
  // 두 후보의 표본 대소 관계는 단언하지 않고 각 표본의 REQ-048 임계만 본다(slice 3 선례).
  describe("index 후보 2 개 축", () => {
    it("후보 ①([instanceRef, createdAt]): 200 + createdAt desc 정렬 유지", async () => {
      await seedRecords();
      const q = `?instanceRef=${INSTANCE_A}`;
      const result = await measure(q, adminCookie, ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      const rows = lastBody as { resourceRef: string }[];
      // 정렬 축 공유 — 응답이 createdAt desc 순서를 유지한다.
      expect(rows.map((r) => r.resourceRef)).toEqual(A_REFS_DESC);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    it("후보 ②([provider, httpStatus, createdAt]): 조합 필터 200 + p95 pass", async () => {
      await seedRecords();
      const q = `?provider=${PROVIDER_GH}&httpStatus=403`;
      const result = await measure(q, adminCookie, ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(bodyRefs()).toEqual(
        refsOf((r) => r.provider === PROVIDER_GH && r.httpStatus === 403),
      );
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.summary.p95).toBeLessThan(3000);
    });
  });
  describe("negative cases 충분 cover", () => {
    // Cookie 미부착 → `JwtAuthGuard` 401. 표본 0 이라 측정 시간 무의존 단언.
    it("(a) 인증 없음(Cookie 미부착): 전부 401 failures, 표본 0", async () => {
      await seedRecords();
      const result = await measure("", null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패(200·403 아님).
    it("(b) 변조 토큰 cookie: 전부 401 failures, 필터 유무와 무관", async () => {
      await seedRecords();
      const result = await measure("", tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      await measure(`?instanceRef=${INSTANCE_A}`, tamperedCookie, 1);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // non-numeric httpStatus — `parseHttpStatus` 가 omit 해 400 이 아니라 200.
    it("(c) httpStatus=abc: 400 이 아니라 필터 없이 200 + 전량", async () => {
      await seedRecords();
      const result = await measure("?httpStatus=abc", adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(bodyRefs()).toEqual(refsOf(() => true));
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // 매칭 0 인 필터 — 빈 결과는 404 변환 없이 200 + 빈 배열(정상 결과).
    it("(d) 미존재 provider 필터: 200 + 빈 배열", async () => {
      await seedRecords();
      const result = await measure("?provider=realdb-missing", adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
  });
});

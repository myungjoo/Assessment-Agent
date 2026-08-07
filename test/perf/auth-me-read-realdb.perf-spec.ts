// auth-me-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 14**
// (T-1526, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 열세 번째 endpoint
// 도메인(`AuthController` 의 `GET /api/auth/me`)을 실 Postgres 위에서 잰다(구조 slice 8·13 승계,
// 앞 slice 수정 0). 새 축 셋 — (a) **조회 키가 요청 표면이 아니라 인증 토큰 payload(`req.user.sub`)
// 에서 나오는 첫 경로**(path param 0 · query 0 → 요청 표면은 cookie 뿐, 결과는 actor 자신 1 row
// 고정. 앞 13 slice 의 필터 입력은 예외 없이 path param 또는 query 였다). (b) **`JwtAuthGuard`
// 단독 — `RolesGuard` 미부착으로 403 분기가 구조적으로 부재**(slice 10~13 은 `@Roles("Admin")`
// 403, slice 7 은 guard 0 — **인증만 있고 인가 0** 은 본 slice 가 처음이라 401 만 존재).
// (c) **stale token 404 — 인증 통과 + DB 도달 + principal row 부재 조합의 첫 실측**(서명 유효
// 토큰인데 `User` row 가 삭제되면 `findById(sub)` 가 `NotFoundException` → 404. slice 10 의 404 는
// 임의 path param id 의 부재였다). 부수로 `UserResponseDto.fromEntity` 의 **단건 sanitize** 를
// 덮되 PK 직행 조회 자체는 slice 11 과 같아 **새 축으로 주장하지 않는다**. mock 0 · override 0,
// production code · schema · 임계값 불변이며 소규모 표본이라 REQ-047 실 scale 부하가 아니다.
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

const BASE = "/api/auth/me";
const USER_ACTOR_EMAIL = "realdb-authme-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-authme-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;
// `UserResponseDto` whitelist 5 필드 — hashedPassword 차단 invariant 의 대조 anchor(T-0095).
const DTO_KEYS = ["createdAt", "email", "id", "role", "updatedAt"];
// 결과 집합이 구조적으로 actor 자신 1 row 로 고정된다(축 (a)).
const DATA_SCALE = "self row 1 (actor 2)";

describe("S2 조회 latency perf-spec — 실 DB self 조회 (GET /api/auth/me, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 서명 변조 cookie — `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  // 이미 만료된 토큰 cookie — 서명은 유효하나 exp 초과라 401(negative (c)).
  let expiredCookie: string;
  let userActorId: string;
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
    tamperedCookie = buildAuthCookie(`${ctx.tokens[USER_ACTOR_EMAIL]}tam`);
    userActorId = ctx.users[USER_ACTOR_EMAIL].id;
    adminActorId = ctx.users[ADMIN_ACTOR_EMAIL].id;
    // 만료 토큰 — 같은 secret 으로 서명하되 exp 를 과거로 둔다(형식·서명 정상, 검증만 실패).
    expiredCookie = buildAuthCookie(
      ctx.jwtService.sign(
        { sub: userActorId, role: "User" },
        { expiresIn: "-10s" },
      ),
    );
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 **원본 id
  // 그대로** 재삽입해야 sub 매칭이 유지된다(새 id·token 재발급 금지 — slice 8 선례). stale token
  // test 가 지운 actor row 도 본 재-seed 가 복원한다.
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  afterAll(async () => {
    // 관찰 기록 — 두 표본의 대소 관계는 wall-clock 비결정성이라 단언하지 않는다(slice 3 선례).
    console.log(`[T-1526 관찰] ${observed.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다. path 는 기본 `me`.
  const getRequest =
    (cookie: string | null, path = BASE): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(path);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (cookie: string | null, n = SHORT_ITERATIONS, path = BASE) =>
    collectLatencySamples(getRequest(cookie, path), n);
  const body = (): Record<string, unknown> =>
    lastBody as Record<string, unknown>;
  // baseline 한 줄 관찰 기록 — 표본 간 대소 관계는 단언하지 않는다(slice 3 선례).
  const observe = (label: string, assertion: S2Assertion): void => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const line = formatBaselineLine(buildBaselineReport(env, assertion));
    expect(line).toContain("p95=");
    observed.push(line);
  };

  // AC happy — 인증된 actor 의 self 조회. 응답 id/email 이 seed actor 와 일치함으로 실 query 발화를
  // 입증한다(토큰 payload sub 가 그대로 조회 키로 쓰였다는 직접 증거).
  it("happy(User actor self 조회): 200 + seed actor id·email 일치 + p95 < 3000ms pass", async () => {
    const result = await measure(userCookie, ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(body().id).toBe(userActorId);
    expect(body().email).toBe(USER_ACTOR_EMAIL);
    expect(body().role).toBe("User");
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    const strict = assertS2Threshold(result, { p95MaxMs: 0 });
    expect(strict.pass).toBe(false);
    expect(strict.reasons.join()).toContain("p95 임계 초과");
    observe("ci-realdb-auth-me-self", assertion);
  });

  // AC error path — 인증 실패(401) 표본이 성공으로 집계되지 않고 전량 `failures` 로 분류됨.
  it("error path(인증 실패): 401 전량 failures, 성공 표본 0, errorRate 1", async () => {
    const result = await measure(null);
    expect(result.total).toBe(SHORT_ITERATIONS);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(401);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(assertion.reasons.join()).toContain("error rate 임계 초과");
  });

  describe("토큰 payload 조회 키 · 인가 0 · stale token 분기", () => {
    // (a) 단건 sanitize invariant — 응답 키가 `UserResponseDto` whitelist 5 개뿐이고
    // `hashedPassword` 가 어디에도 없다(DB row 에는 실재함을 함께 확인해 차단이 HTTP layer 임을 못박음).
    it("(a) 응답 body 에 hashedPassword 키 부재 — whitelist 5 필드만", async () => {
      await measure(userCookie, 1);
      expect(lastStatus).toBe(200);
      expect(Object.keys(body()).sort()).toEqual(DTO_KEYS);
      expect(body()).not.toHaveProperty("hashedPassword");
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: userActorId },
      });
      // DB 에는 존재하는 컬럼이 응답에서만 잘린다 — 차단 지점이 DTO 임의 증거.
      expect(row.hashedPassword.length).toBeGreaterThan(0);
      expect(JSON.stringify(lastBody)).not.toContain(row.hashedPassword);
    });

    // (b) 축 (b) 증거 — `RolesGuard` 미부착이라 role 이 다른 두 actor 모두 403 없이 200 이고
    // 각자 **자기 row** 만 돌려받는다(조회 키가 요청 표면이 아니라 토큰 payload 이므로).
    it("(b) User tier·Admin tier 두 actor 모두 403 없이 200 + 각자 자기 row", async () => {
      const asUser = await measure(userCookie);
      expect(asUser.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(body().id).toBe(userActorId);
      const seenAsUser = body().email;
      const asAdmin = await measure(adminCookie);
      expect(asAdmin.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(body().id).toBe(adminActorId);
      expect(body().email).toBe(ADMIN_ACTOR_EMAIL);
      expect(body().role).toBe("Admin");
      // 같은 route·같은 요청 표면인데 응답 row 가 갈린다 = 토큰 payload 가 조회 키.
      expect(seenAsUser).not.toBe(body().email);
      const userAssertion = assertS2Threshold(asUser);
      const adminAssertion = assertS2Threshold(asAdmin);
      expect(userAssertion.pass).toBe(true);
      expect(adminAssertion.pass).toBe(true);
      // 두 표본의 대소 관계는 단언하지 않는다 — 관찰 기록만(slice 3 선례).
      observe("ci-realdb-auth-me-user-tier", userAssertion);
      observe("ci-realdb-auth-me-admin-tier", adminAssertion);
    });

    // (c) 축 (c) 증거 — 서명 유효 토큰 + principal row 삭제 = 401 이 아니라 404(guard 는 통과하고
    // service 의 `findById` 가 P2025/부재를 404 로 변환). 그 표본도 전량 `failures` 로 분류된다.
    it("(c) stale token(actor row 삭제): 401 이 아니라 404 전량 failures", async () => {
      await prisma.user.delete({ where: { id: userActorId } });
      const result = await measure(userCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(result.samplesMs).toHaveLength(0);
      // 같은 cookie 가 row 복원 전에는 404, 그 사이 Admin actor 는 여전히 200 — 인증 layer 는 무사.
      await measure(adminCookie, 1);
      expect(lastStatus).toBe(200);
      const assertion = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) Cookie 미부착 401 을 200 과 번갈아 호출 — 부분 집계 정확성(0 < er < 1)까지 확인.
    it("(a) Cookie 미부착: 401 + 200 혼합 시 failures 절반, 0 < errorRate < 1", async () => {
      const denied = await measure(null);
      expect(denied.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 인증 actor(200), 짝수 번째는 Cookie 미부착(401).
        return getRequest(call % 2 === 1 ? userCookie : null)();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (b) 서명 변조 토큰 — cookie 는 있으나 검증 실패. 404(row 부재) 아닌 401 로 갈린다.
    it("(b) 서명 변조 토큰 cookie: 401 전량(404 아님)", async () => {
      const result = await measure(tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      expect(JSON.stringify(lastBody)).not.toContain(USER_ACTOR_EMAIL);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });

    // (c) 만료 토큰 · 형식 불량 cookie 값 — 둘 다 200 이 아니라 401(guard 가 exp·형식 모두 거절).
    it("(c) 만료 토큰·형식 불량 cookie 값: 둘 다 401(200 아님)", async () => {
      const expired = await measure(expiredCookie);
      expect(expired.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      const malformed = await measure(buildAuthCookie("not-a-jwt-value"), 1);
      expect(malformed.failures).toBe(1);
      expect(lastStatus).toBe(401);
      // 빈 cookie 값도 미부착과 동일하게 401.
      await measure(buildAuthCookie(""), 1);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(expired, { p95MaxMs: 0 }).pass).toBe(false);
    });

    // (d) 측정 대상 route 가 path param 을 받지 않음의 negative 증거 — 하위 경로는 매칭 route 가
    // 없어 404 이고, 인증 여부와 무관하게 me 핸들러에 도달하지 않는다.
    it("(d) path 변형 GET /api/auth/me/extra: 매칭 route 부재로 404", async () => {
      const extra = `${BASE}/extra`;
      const result = await measure(userCookie, SHORT_ITERATIONS, extra);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(JSON.stringify(lastBody)).not.toContain(USER_ACTOR_EMAIL);
      // 정상 경로는 같은 cookie 로 여전히 200 — 404 원인이 인증이 아님을 못박는다.
      await measure(userCookie, 1);
      expect(lastStatus).toBe(200);
      expect(body().id).toBe(userActorId);
    });
  });
});

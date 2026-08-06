// user-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 8**.
// (T-1514, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — slice 1~7(`*-realdb`)에 이은 slice 8(구조는 slice 6 승계, 앞 slice 수정 0). 새 축 셋:
//    (a) **403 인가 분기의 첫 실측** — `GET /api/users/:id` 의 `isSelf || isAdminPlus` OR 분기를
//    controller 가 판정해 **권한 부족 403**(`service.findById` 호출 0 — DB 미도달) 과 **존재 부재
//    404** 가 의미상 분리된 유일한 경로다. (b) **route 별 상이 guard tier** — 목록은
//    `JwtAuthGuard + RolesGuard @Roles("Admin")`, 상세는 `JwtAuthGuard` 만 + controller 분기라
//    guard stack 깊이가 다른 두 route 를 나란히 잰다. (c) **인증 principal 테이블 자체가 측정
//    대상** — 결과 집합이 곧 actor 가 속한 `User` 이고 필터 축도 **단일 컬럼 `@unique`(email)** +
//    목록의 **무필터 전량 SELECT** 다.
// ② 실행 경로 — `jest-perf.json` 매칭이라 `pnpm test:perf` 로만 실행된다(기본 `pnpm test` 미picking).
// ③ mock 0 · override 0 — 실 `JwtAuthGuard`/`RolesGuard` 를 **실 JWT 로 통과** 하고, 검증은
//    `toHaveBeenCalledTimes` 대신 **응답 body 가 seed row 값(email / role) 과 일치** 함으로 실 query
//    발화를 입증한다(fail 분기는 401 · 403 · 404 · `p95MaxMs: 0` 라 측정 시간 무의존). production
//    code · mock 짝 · schema · 임계값 · baseline write 불변이며 REQ-047 실 scale 부하가 아니다.
import type { INestApplication } from "@nestjs/common";
import type { User } from "@prisma/client";
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

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 6·7 과 동등한 여유.
jest.setTimeout(120_000);

// actor email 고정 — `User.email` 이 단일 컬럼 `@unique` 라 응답 대조 anchor 로 쓴다.
const USER_ACTOR_EMAIL = "realdb-user-perf-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-admin-perf-actor@e2e.test";
// actor 외 seed 대상 user 수 + 반복 횟수(SHORT 는 분기 도달용 짧은 반복).
const TARGET_USERS = 3;
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;
// `UserResponseDto` whitelist 5 필드 — hashedPassword 차단 invariant 의 대조 anchor(T-0095).
const DTO_KEYS = ["createdAt", "email", "id", "role", "updatedAt"];

describe("S2 조회 latency perf-spec — 실 DB self-OR-Admin 분기 User 조회 (GET /api/users · :id, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 변조 토큰 cookie — 서명이 깨진 JWT 라 `JwtAuthGuard` 가 401(negative (c)).
  let tamperedCookie: string;
  let userActorId: string;
  let adminActorId: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User 2 명 seed + 실 JWT 발급을 한 번에.
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
    adminActorId = ctx.users[ADMIN_ACTOR_EMAIL].id;
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

  // actor 외 대상 User seed. `email`(단일 컬럼 `@unique`) 값이 곧 응답 대조 anchor 다.
  const seedTargets = async (): Promise<User[]> => {
    const created: User[] = [];
    for (let i = 0; i < TARGET_USERS; i++) {
      // hashedPassword 는 not-null 충족용 placeholder(측정 대상 밖).
      const row = await prisma.user.create({
        data: {
          email: `realdb-user-perf-target-${i}@example.test`,
          hashedPassword: "not-a-real-hash",
          role: "User",
        },
      });
      created.push(row);
    }
    return created;
  };

  // 조회 1회 — 목록·상세 공용. `authCookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (path: string, authCookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/users${path}`);
      const res = await (authCookie === null
        ? req
        : req.set("Cookie", authCookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  const measure = (
    path: string,
    authCookie: string | null,
    n = SHORT_ITERATIONS,
  ) => collectLatencySamples(getRequest(path, authCookie), n);

  // AC happy ① — 목록 route(guard stack 2 단 + 무필터 전량 SELECT). 응답에 seed 대상과 actor 2 명이
  // 그대로 담김으로 실 query 발화를 입증한다.
  it("happy ①(목록, Admin actor): GET /api/users → 200 + seed email 전량 일치 + p95 < 3000ms pass", async () => {
    const seeded = await seedTargets();
    const result = await measure("", adminCookie, ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as { email: string }[];
    // 무필터 전량 SELECT — seed 대상 3 명 + actor 2 명이 모두 담긴다.
    const expected = seeded
      .map((u) => u.email)
      .concat(USER_ACTOR_EMAIL, ADMIN_ACTOR_EMAIL);
    expect(body.map((u) => u.email).sort()).toEqual(expected.sort());
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC happy ② — 상세 route(guard stack 1 단 + controller OR 분기)의 단일 컬럼 unique 축 실측.
  it("happy ②(상세, Admin actor 의 타 user): :id 반복 조회 → 200 + email·role 일치 + p95 pass", async () => {
    const seeded = await seedTargets();
    const result = await measure(`/${seeded[0].id}`, adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    expect(body.id).toBe(seeded[0].id);
    expect(body.email).toBe(seeded[0].email);
    expect(body.role).toBe("User");
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    const strict = assertS2Threshold(result, { p95MaxMs: 0 });
    expect(strict.pass).toBe(false);
    expect(strict.reasons.join()).toContain("p95 임계 초과");
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 분기 ① — `isSelf` 통과. User tier actor 도 본인 id 는 role 검증 skip 으로 200(REQ-046).
  it("분기 ①(isSelf): User actor 가 본인 id 조회 → 200 + 본인 email·role 일치", async () => {
    await seedTargets();
    const result = await measure(`/${userActorId}`, userCookie);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    expect(body.id).toBe(userActorId);
    expect(body.email).toBe(USER_ACTOR_EMAIL);
    expect(body.role).toBe("User");
    expect(assertS2Threshold(result).pass).toBe(true);
  });

  // AC 분기 ② — `isAdminPlus` 통과. isSelf=false 인데도 Admin actor 라 타 user 조회 200.
  it("분기 ②(isAdminPlus): Admin actor 가 타 user(User actor) 조회 → 200 + 대상 email 일치", async () => {
    const result = await measure(`/${userActorId}`, adminCookie);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as Record<string, unknown>;
    // 조회 대상이 actor 본인이 아님 — isSelf=false + isAdminPlus=true 조합의 증거.
    expect(body.id).not.toBe(adminActorId);
    expect(body.email).toBe(USER_ACTOR_EMAIL);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 분기 ③ — 둘 다 false → controller 가 403. `service.findById` 호출 0 이라 **DB 미도달 거절
  // 경로** 의 첫 실측이다. 표본 0 이라 판정은 errorRate 기반(측정 시간 무의존).
  it("분기 ③(권한 부족): User actor 가 타 user 조회 → 전부 403 failures, 표본 0", async () => {
    const seeded = await seedTargets();
    const result = await measure(`/${seeded[0].id}`, userCookie);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(403);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(assertion.reasons.join()).toContain("error rate 임계 초과");
  });

  // AC error path — 미존재 id 는 `service.findById` 의 404. 403(권한 부족) 과 status 로 의미 분리.
  it("error path: 미존재 id 상세 조회(Admin actor) → 403 이 아니라 전부 404 failures", async () => {
    await seedTargets();
    const result = await measure("/realdb-user-missing", adminCookie);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(false);
  });

  describe("negative cases 충분 cover", () => {
    // (a) 목록은 `RolesGuard` + `@Roles("Admin")` — User tier actor 는 escalation 목록 밖 403.
    // 200(Admin) 과 번갈아 호출해 errorRate 중간값도 확인한다.
    it("(a) 목록 route 를 User tier actor 로 호출 → 403, Admin 과 혼합 시 0 < er < 1", async () => {
      await seedTargets();
      const denied = await measure("", userCookie);
      expect(denied.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 Admin actor(200), 짝수 번째는 User tier actor(403).
        return getRequest("", call % 2 === 1 ? adminCookie : userCookie)();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (b) Cookie 미부착 → `JwtAuthGuard` 401. guard 생존의 증거(403 과 별개 조건).
    it("(b) 인증 없음(Cookie 미부착, 목록) → 전부 401 failures, pass === false", async () => {
      await seedTargets();
      const result = await measure("", null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (c) 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패. 상세도 guard 가 controller 분기보다
    // 먼저라 self 여부·row 존재와 무관하게 401(403·404 아님).
    it("(c) 변조 토큰 cookie(상세) → 전부 401 failures, 본인 id·미존재 id 모두 401", async () => {
      const seeded = await seedTargets();
      const result = await measure(`/${seeded[0].id}`, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      await measure(`/${userActorId}`, tamperedCookie, 1);
      expect(lastStatus).toBe(401);
      await measure("/realdb-user-missing", tamperedCookie, 1);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (d) `UserResponseDto` whitelist — 어느 route 응답에도 `hashedPassword` 키가 없다(T-0095).
    it("(d) 응답 body 에 hashedPassword 키 부재 — 목록·상세·self 세 경로 모두", async () => {
      const seeded = await seedTargets();
      await measure("", adminCookie, 1);
      const list = lastBody as Record<string, unknown>[];
      expect(list).toHaveLength(TARGET_USERS + 2);
      for (const row of list) {
        expect(Object.keys(row).sort()).toEqual(DTO_KEYS);
      }
      await measure(`/${seeded[0].id}`, adminCookie, 1);
      expect(Object.keys(lastBody as object).sort()).toEqual(DTO_KEYS);
      await measure(`/${userActorId}`, userCookie, 1);
      expect(Object.keys(lastBody as object).sort()).toEqual(DTO_KEYS);
    });
  });
});

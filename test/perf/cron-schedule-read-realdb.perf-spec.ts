// cron-schedule-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 16**
// (T-1530, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 열네 번째 endpoint
// 도메인이자 **첫 `src/scheduling/` 모듈 route** 인 `CronScheduleController` 의 `GET /api/schedules`
// (등록된 cron job 이름 배열 — REQ-096 Admin 가시성) 를 실 부트스트랩으로 측정한다(구조 slice 14
// 승계, 앞 15 slice 수정 0). 새 축 셋 — (a) **결과 집합이 DB row 가 아니라 in-process 상태인 첫
// 경로**(앞 15 slice 의 응답은 예외 없이 Prisma delegate 가 읽은 row 이거나 그 파생 view 였다.
// 본 route 는 `SchedulerRegistry.getCronJobs()` Map 의 key 배열이라 어떤 테이블도 읽지 않는다 —
// slice 12 의 `GET /api/admin/import/modes` 도 0-query 였으나 그것은 고정 2 원소 **상수** 였고
// 본 응답은 선행 write 로 변하는 **가변 상태** 다). (b) **같은 spec 안의 write(PUT/DELETE) 가 read
// 결과를 바꾸는 첫 페어**(앞 15 slice 는 seed 를 Prisma 로 직접 심고 read 만 쟀다 — HTTP write 가
// read 표본을 만드는 구조는 본 slice 가 처음). (c) **규모 축이 DB row 수가 아니라 registry 등록
// 수인 첫 slice**(등록 0 건 vs N 건 두 표본. slice 3 은 membership row 수, slice 13 은 schema 로
// 3 슬롯 bounded, slice 14·15 는 결과 1 row 고정이었다 — 두 표본의 대소 관계는 wall-clock
// 비결정성 때문에 단언하지 않고 관찰 기록만, slice 3 선례). `@Roles("Admin")` 403 · 401 두 종은
// slice 10~13 과 같아 **새 축으로 주장하지 않고** negative cover 로만 유지한다. mock 0 · override 0,
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

const BASE = "/api/schedules";
const USER_ACTOR_EMAIL = "realdb-cronsched-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-cronsched-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;
// 본 spec 이 등록하는 job 의 name prefix — baseline 대비 **자기 몫만** 골라내는 delta 기준
// (부트스트랩 시점 registry 에 다른 job 이 있어도 깨지지 않게 한다).
const JOB_PREFIX = "realdb-perf-slice16-";
// 드문 주기(6-field: 초 분 시 일 월 요일 = 1월 1일 05:00:00) — 테스트 실행 중 tick 발화 0.
const RARE_CRON = "0 0 5 1 1 *";
const RARE_CRON_ALT = "0 30 5 1 1 *";
// 규모 축 표본 크기 — 등록 0 건 vs N 건(AC N >= 4).
const SCALE_N = 4;
// 결과 집합이 DB row 가 아니라 registry 등록 수에 비례한다(축 (a)·(c)).
const DATA_SCALE = "registry 등록 0~4 (DB row 0 — in-process 상태)";

describe("S2 조회 latency perf-spec — 실 DB cron registry 조회 (GET /api/schedules, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;
  // 서명 변조 cookie — `JwtAuthGuard` 가 401(negative (b), 403 아님).
  let tamperedCookie: string;
  let lastBody: unknown;
  let lastStatus = 0;
  // 본 spec 이 등록한 job — afterEach 에서 전량 제거해 timer 누수 0 을 보장한다.
  const registered = new Set<string>();
  const observed: string[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(실 ScheduleModule.forRoot() · 실 SchedulerRegistry
    // · 실 PrismaService) + actor User 2 명 seed + 실 JWT 발급.
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_ACTOR_EMAIL },
      { role: "Admin", email: ADMIN_ACTOR_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_ACTOR_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_ACTOR_EMAIL]);
    tamperedCookie = buildAuthCookie(`${ctx.tokens[ADMIN_ACTOR_EMAIL]}tam`);
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // registry 누수 0 — 본 spec 이 등록한 job 을 DELETE 로 전량 회수한 뒤 DB 를 정리한다.
  // ADR-0004 §Cleanup 의 `truncateAll` 명단에 `"User"` 가 있어 actor row 가 지워지므로
  // **원본 id 그대로** 재-seed 해야 JWT sub 매칭이 유지된다(slice 10·14·15 선례).
  afterEach(async () => {
    for (const name of registered) {
      // 이미 지워진 name 의 404 는 무해 — 상태만 되돌리면 되므로 status 를 보지 않는다.
      await request(app.getHttpServer())
        .delete(`${BASE}/${name}`)
        .set("Cookie", adminCookie);
    }
    registered.clear();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  afterAll(async () => {
    // 관찰 기록 — 두 표본의 대소 관계는 wall-clock 비결정성이라 단언하지 않는다(slice 3 선례).
    console.log(`[T-1530 관찰] ${observed.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(BASE);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(cookie), n);
  const names = (): string[] => lastBody as string[];
  // 본 spec 이 등록한 name 만 — baseline 절대값이 아니라 delta 로만 단언하기 위한 필터.
  const own = (list: string[]): string[] =>
    list.filter((n) => n.startsWith(JOB_PREFIX));
  // Admin 으로 현재 배열 snapshot 1 회(측정과 무관한 상태 확인용).
  const snapshot = async (): Promise<string[]> => {
    await measure(adminCookie, 1);
    expect(lastStatus).toBe(200);
    return names();
  };
  const upsert = (name: string, cronExpression: string) =>
    request(app.getHttpServer())
      .put(BASE)
      .set("Cookie", adminCookie)
      .send({ name, cronExpression });
  // 등록 성공한 name 만 회수 목록에 넣는다(400 실패 건은 registry 에 없음).
  const register = async (name: string, expr = RARE_CRON): Promise<number> => {
    const res = await upsert(name, expr);
    if (res.status === 200) {
      registered.add(name);
    }
    return res.status;
  };
  const remove = async (name: string): Promise<number> => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${name}`)
      .set("Cookie", adminCookie);
    if (res.status === 204) {
      registered.delete(name);
    }
    return res.status;
  };
  // baseline 한 줄 관찰 기록 — 표본 간 대소 관계는 단언하지 않는다(slice 3 선례).
  const observe = (label: string, assertion: S2Assertion): void => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const line = formatBaselineLine(buildBaselineReport(env, assertion));
    expect(line).toContain("p95=");
    observed.push(line);
  };

  // AC happy — Admin actor 의 registry 조회. body 가 `string[]` 이고 p95 < 3000ms.
  it("happy(Admin actor registry 조회): 200 + string[] + p95 < 3000ms pass", async () => {
    const jobName = `${JOB_PREFIX}happy`;
    expect(await register(jobName)).toBe(200);
    const result = await measure(adminCookie, ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(names().every((n) => typeof n === "string")).toBe(true);
    // 방금 등록한 name 이 그대로 보인다 = 실 registry 를 읽었다는 직접 증거.
    expect(names()).toContain(jobName);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    const strict = assertS2Threshold(result, { p95MaxMs: 0 });
    expect(strict.pass).toBe(false);
    expect(strict.reasons.join()).toContain("p95 임계 초과");
    observe("ci-realdb-cron-schedule-list", assertion);
  });

  // AC error path — 부재 name 삭제는 service 의 NotFoundException 이 raw propagate 해 404 이고,
  // 그 실패가 직후 조회 배열을 바꾸지 않는다(REQ-032 — body 에 raw stack 미노출).
  it("error path(부재 name DELETE): 404 + 배열 불변 + raw stack 미노출", async () => {
    const before = await snapshot();
    const missing = `${JOB_PREFIX}absent`;
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${missing}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toContain("node_modules");
    const after = await snapshot();
    // 실패한 삭제는 상태를 건드리지 않는다 — 길이 delta 0 + 자기 몫 0.
    expect(after).toHaveLength(before.length);
    expect(own(after)).toHaveLength(0);
    const result = await measure(adminCookie);
    expect(assertS2Threshold(result).pass).toBe(true);
  });

  describe("상태 전이 분기 cover (등록 0 → PUT → 교체 → DELETE)", () => {
    // (a) 등록 0 건 — 자기 몫 0 이고 200(빈 배열을 404 로 변환하지 않음).
    it("(a) 등록 0 건: 200 + 자기 몫 0 + p95 < 3000ms", async () => {
      const result = await measure(adminCookie, ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(Array.isArray(lastBody)).toBe(true);
      expect(own(names())).toHaveLength(0);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.summary.p95).toBeLessThan(3000);
      observe("ci-realdb-cron-schedule-empty", assertion);
    });

    // (b) PUT 1 건 후 — 그 name 포함 + 길이 delta +1.
    it("(b) PUT 1 건 후: 그 name 포함 + 길이 delta +1 + p95 < 3000ms", async () => {
      const before = await snapshot();
      const jobName = `${JOB_PREFIX}b`;
      expect(await register(jobName)).toBe(200);
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      expect(names()).toContain(jobName);
      expect(names()).toHaveLength(before.length + 1);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });

    // (c) 같은 name 을 다른 cron 식으로 PUT — 교체 분기라 길이가 늘지 않는다(delta +1 유지).
    it("(c) 같은 name 다른 cron 식 PUT(교체): 배열 길이 불변 + p95 < 3000ms", async () => {
      const before = await snapshot();
      const jobName = `${JOB_PREFIX}c`;
      expect(await register(jobName, RARE_CRON)).toBe(200);
      const afterFirst = await snapshot();
      expect(afterFirst).toHaveLength(before.length + 1);
      expect(await register(jobName, RARE_CRON_ALT)).toBe(200);
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      // 교체이므로 중복 등록되지 않는다 — 길이는 그대로, name 은 여전히 1 회만 등장.
      expect(names()).toHaveLength(afterFirst.length);
      expect(names().filter((n) => n === jobName)).toHaveLength(1);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });

    // (d) DELETE 후 — 그 name 미포함 + 길이 delta 0 으로 복귀(204).
    it("(d) DELETE 후: 그 name 미포함 + 길이 delta 0 + p95 < 3000ms", async () => {
      const before = await snapshot();
      const jobName = `${JOB_PREFIX}d`;
      expect(await register(jobName)).toBe(200);
      expect(await remove(jobName)).toBe(204);
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      expect(names()).not.toContain(jobName);
      expect(names()).toHaveLength(before.length);
      expect(own(names())).toHaveLength(0);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) Cookie 미부착 — 표본 0 + errorRate 1(guard 레벨 401).
    it("(a) Cookie 미부착 GET: 401 전량 failures, 표본 0, errorRate 1", async () => {
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

    // (b) 서명 변조 cookie — 인증 실패라 401 이며 인가 실패(403) 로 갈리지 않는다.
    it("(b) 서명 변조 cookie GET: 401(403 아님)", async () => {
      const result = await measure(tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(lastStatus).not.toBe(403);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });

    // (c) User tier actor — 인증은 통과하고 `RolesGuard` 가 403(registry 미도달 — 응답에
    //     job 이름이 하나도 실리지 않는다).
    it("(c) User tier actor GET: guard 레벨 403 + registry 미도달", async () => {
      const jobName = `${JOB_PREFIX}forbidden`;
      expect(await register(jobName)).toBe(200);
      const result = await measure(userCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(JSON.stringify(lastBody)).not.toContain(jobName);
      // 같은 시점 Admin 은 여전히 200 — 403 원인이 인증이 아니라 인가임을 못박는다.
      await measure(adminCookie, 1);
      expect(lastStatus).toBe(200);
      expect(names()).toContain(jobName);
    });

    // (d) 빈 name — DTO `@IsNotEmpty` 가 400, 공백만 name 은 DTO 를 통과하고 service 가 400.
    it("(d) PUT 빈 name·공백 name: 둘 다 400", async () => {
      expect(await register("", RARE_CRON)).toBe(400);
      expect(await register("   ", RARE_CRON)).toBe(400);
    });

    // (e) 유효하지 않은 cron 식 — service 의 `isValidCronExpression` 이 400 으로 변환.
    //     빈 문자열(DTO 400) 과 형식 위반(service 400) 두 분기를 모두 덮는다.
    it("(e) PUT 유효하지 않은 cron 식: 400", async () => {
      expect(await register(`${JOB_PREFIX}bad`, "not-a-cron")).toBe(400);
      expect(await register(`${JOB_PREFIX}bad2`, "99 99 99 99 99")).toBe(400);
      expect(await register(`${JOB_PREFIX}bad3`, "")).toBe(400);
    });

    // (f) (d)·(e) 의 실패가 부분 등록을 남기지 않는다 — 자기 몫 0, 길이 delta 0.
    it("(f) PUT 400 실패는 부분 등록 0: 자기 몫 0 + 길이 delta 0", async () => {
      const before = await snapshot();
      expect(await register("", RARE_CRON)).toBe(400);
      expect(await register(`${JOB_PREFIX}f`, "not-a-cron")).toBe(400);
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      expect(own(names())).toHaveLength(0);
      expect(names()).toHaveLength(before.length);
    });
  });

  // AC 규모 관찰 — 등록 0 건과 N 건 두 표본의 p95 를 모두 3000ms 미만으로 단언하되
  // **대소 관계는 assert 하지 않고 관찰 기록만** 남긴다(slice 3 선례).
  it("규모 관찰: 등록 0 건 vs N 건 두 표본 모두 p95 < 3000ms(대소 관계 미단언)", async () => {
    const empty = await measure(adminCookie, ITERATIONS);
    expect(empty.failures).toBe(0);
    expect(own(names())).toHaveLength(0);
    const emptyAssertion = assertS2Threshold(empty);
    expect(emptyAssertion.pass).toBe(true);
    expect(emptyAssertion.summary.p95).toBeLessThan(3000);

    for (let i = 0; i < SCALE_N; i++) {
      expect(await register(`${JOB_PREFIX}scale-${i}`)).toBe(200);
    }
    const loaded = await measure(adminCookie, ITERATIONS);
    expect(loaded.failures).toBe(0);
    expect(own(names())).toHaveLength(SCALE_N);
    const loadedAssertion = assertS2Threshold(loaded);
    expect(loadedAssertion.pass).toBe(true);
    expect(loadedAssertion.summary.p95).toBeLessThan(3000);

    observe("ci-realdb-cron-schedule-scale-0", emptyAssertion);
    observe(`ci-realdb-cron-schedule-scale-${SCALE_N}`, loadedAssertion);
  });
});

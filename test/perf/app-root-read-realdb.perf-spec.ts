// app-root-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 22**.
// (T-1543, load-resilience-test-plan §5 item 5 / REQ-048 조회 p95 < 3s)
//
// ① 위치 — slice 1~21 에 이은 실 DB round-trip **slice 22**. 부트스트랩 구조는 slice 21
//    (`import-detail-read-realdb.perf-spec.ts`, T-1541) 을 그대로 승계한다(문구 복제 대신 cross-ref —
//    `createAuthenticatedE2EApp` · actor 2 명 · `afterEach` 의 `truncateAll` +
//    `reseedAuthenticatedActors`). 측정 대상은 `AppController` 의 root health read `GET /api` 로,
//    T-1536 잔여 인벤토리(load-resilience-test-plan `569 행`)가 남긴 **(B) 후보 마지막 1 건** 이다.
//    계수: `AppController` 는 실측 endpoint 도메인 14 개에 **없던 새 도메인** 이라 도메인 **14 → 15**,
//    조회 route **30 → 31** 로 **둘 다 +1** 이다(도메인·route 가 함께 늘던 **slice 16 과 같은 셈법** —
//    "도메인 불변 · route 만 +1" 이던 slice 15·17·18·19·20·21 셈법이 아니다).
// ② mock 짝 — `app-root-read.perf-spec.ts`(T-0859). 그 spec 은 `AppController` + `AppService` 만
//    담은 최소 TestingModule 에 `AppService` 를 `useValue` mock 으로 주입해 **collector 배선 floor** 를
//    쟀다. 본 spec 은 **mock override 0** 으로 `AppModule` 전체를 실 부트스트랩하고 실 Prisma 연결이
//    살아 있는 상태에서 같은 route 를 재므로, 재는 대상이 "배선 floor" 가 아니라 **실 부트스트랩
//    floor** 다. mock 짝 자체는 수정·삭제하지 않는다(그 spec 과 `app-root-measure-confirm.perf-spec.ts`
//    의 retire·통합 판단은 T-1536 이 명시 유보한 별도 주제 — mock 잔존 계수 불변).
// ③ 새 축 (2 종) —
//    (가) **DB 미접촉 route 의 latency floor**. slice 1~21 은 전부 요청 경로가 실 Prisma round-trip 을
//    최소 1 회 수행했다. 반면 `getRoot()` 는 `AppService.getStatus()` 의 **고정 상수**
//    `APP_STATUS_MESSAGE` 를 동기 반환할 뿐이라, 실 `AppModule` + 실 Prisma 연결이 살아 있어도 요청
//    경로는 DB 를 **전혀 건드리지 않는다**. 따라서 본 실측값은 같은 harness · 같은 부트스트랩 조건
//    에서의 **framework + HTTP 왕복만의 하한** 이며, 앞선 21 slice 의 p95 를 읽을 때 "얼마가 DB 몫
//    인가" 를 가늠할 대조 기준선이 된다. DB 미접촉이라는 사실 자체는 **전량 truncate 전 / 후 응답
//    불변** 으로 실증한다.
//    (나) **guard layer 가 아예 없는 첫 실 DB slice**. slice 1~21 은 모두 `JwtAuthGuard`(+ 상당수는
//    `RolesGuard` + `@Roles("Admin")`)를 통과하는 route 라 cookie 발급이 전제였다. `AppController` 는
//    guard 미적용이라 인증 없이 200 이고, 변조 쿠키를 붙여도 401 이 아니며 User tier actor 도 403 이
//    아니다 — **다른 slice 와 정반대의 negative** 를 실 부트스트랩에서 실증한다.
// ④ 새 축으로 **주장하지 않는** 항목(중복 주장 금지 검산) — collector / assert 배선 재사용은
//    slice 1~21 과 동일, `p95MaxMs: 0` 주입 fail 분기와 인위 non-2xx 주입 errorRate 분기는 mock slice
//    시절부터의 관용 수단이며, `buildBaselineReport` 관찰 전용(디스크 write 0) 도 전 slice 공통이다.
//    guard 미부착 controller 자체도 slice 1·2·7·19·20 선례가 있다(본 slice 의 신규성은 ③ 두 축뿐).
// ⑤ 결정론 전략 — 요청 경로가 DB 를 타지 않으므로 seed 가 **불요** 하고, 응답은 항상 같은 상수
//    문자열이라 body 단언이 완전 결정론적이다. `afterEach` 는 slice 21 과 같은 `truncateAll` +
//    actor 원본 id 재삽입을 유지한다(AC 4 가 test 중간에 전량 truncate 를 수행하므로 다음 test 의
//    actor 존재 전제를 복원해야 한다). latency 는 wall-clock 이라 비결정적이므로 **어떤 값끼리도
//    대소를 단언하지 않는다** — 다른 route · 다른 slice · 같은 spec 안의 두 측정 구간끼리도
//    마찬가지다(T-0877 이 `app-root-measure-confirm.perf-spec.ts` 에서 wall-clock 대소를 단언해
//    T-0880 의 PR CI 를 2 회 연속 red 로 만들고 T-0881 이 주입 clock 으로 결정론화해야 했던 이력 —
//    "floor 이므로 더 빠르다" 류 단언의 유혹이 본 slice 에서 구조적으로 크기에 명시 금지한다).
//    허용되는 latency 단언은 **고정 임계 3000ms 대비 pass** 와 **주입 임계 0 대비 fail** 뿐이고,
//    floor 성격은 주석과 README 서술로만 표현한다. 본 파일은 `jest-perf.json`
//    (`testRegex: test/perf/.*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고 기본
//    `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres 전제는 CI 가 충족).
// ⑥ Out of Scope — production code 변경 0(`src/app.controller.ts` · `src/app.service.ts` ·
//    `APP_STATUS_MESSAGE` 값 · guard 부착 여부 불변, "health endpoint 에 guard 가 없다" 를 보안 결함
//    으로 재판정하지 않는다 — 본 slice 는 현재 동작을 판단 없이 **측정만** 한다) / 기존 app-root
//    spec 2 개 수정·삭제·통합 0 / `latency-collector` · `latency-metrics` · `latency-baseline` 순수
//    primitive 변경 0(호출·배선만) / 임계값 변경 · baseline 파일 확정 0(`DEFAULT_P95_MAX_MS = 3000`
//    불변, `writeBaselineFile` · `confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write 0) /
//    write · trigger route 측정 0 / doc-sync(PLAN · load-resilience-test-plan · requirements 반영은
//    머지 후 별도 `direct` task).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { APP_STATUS_MESSAGE } from "../../src/app.service";
import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  reseedAuthenticatedActors,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

import {
  buildBaselineReport,
  formatBaselineLine,
  type BaselineReport,
} from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
  type S2Assertion,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩(AppModule 전체) + 반복 요청 + truncate 대조 쌍이라 여유를 둔다.
jest.setTimeout(120_000);

const ROOT = "/api";
// 인접 미매칭 경로 — `getRoot()` 자체에 예외 경로가 없어 error path 를 여기서 커버한다.
const MISSING = "/api/no-such-route";
// param 0 route 실증용 — query string 을 붙여도 응답이 같아야 한다.
const WITH_QUERY = "/api?x=1";
const USER_ACTOR_EMAIL = "realdb-app-root-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-app-root-admin-actor@e2e.test";
// 표본별 반복 측정 횟수(다른 slice 와 조건을 비교할 수 있도록 spec 상수로 노출).
const ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;
// 데이터 규모 — 요청 경로가 DB 를 타지 않으므로 row 수가 아니라 "미접촉" 자체가 규모 설명이다.
// 반복 수도 함께 노출해 관찰 라인만으로 다른 slice 와 조건 비교가 가능하게 둔다.
const DATA_SCALE = `0 rows (요청 경로 DB 미접촉) / iterations=${ITERATIONS}`;

describe("S2 조회 latency perf-spec — 실 DB 부트스트랩 하 app root health read (GET /api, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  let tamperedCookie: string;
  // 마지막 응답 — 상수 문자열 body 는 `res.text` 로, 404 JSON body 는 `res.body` 로 본다.
  let lastText = "";
  let lastBody: unknown;
  let lastStatus = 0;
  // 관찰 기록 축적(대소 관계 assert 금지, 디스크 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User 2 명 seed + 실 JWT 발급.
    // 본 route 는 guard 가 없어 cookie 가 happy-path 에는 불요하지만, negative (b)(c) 에서
    // "쿠키가 있어도 / 변조돼도 200" 을 보이기 위해 발급해 둔다.
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_ACTOR_EMAIL },
      { role: "Admin", email: ADMIN_ACTOR_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens[USER_ACTOR_EMAIL]);
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_ACTOR_EMAIL]);
    tamperedCookie = buildAuthCookie(`${ctx.tokens[ADMIN_ACTOR_EMAIL]}tam`);
    // 앞선 스위트가 남긴 row 가 actor 계수 단언을 오염시키지 않도록 시작 시점에도 비운다.
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. 본 route 는 DB 를 쓰지 않지만 AC 4 의 대조 쌍이 test 중간에 전량
  // truncate 를 수행하므로, 다음 test 가 actor 2 명 존재를 전제할 수 있도록 **원본 id 그대로**
  // 재삽입한다(`db-truncate.ts` 수정 0).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    console.log(`[T-1543 관찰] ${observations.map((o) => o.line).join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착(본 route 는 guard 가 없어 결과가 같아야 한다).
  const getRequest =
    (path: string, cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(path);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastText = res.text;
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (
    path: string,
    cookie: string | null = null,
    n = SHORT_ITERATIONS,
  ) => collectLatencySamples(getRequest(path, cookie), n);

  // 인위 non-2xx 를 주입하는 요청 wrapper — `getRoot()` 는 예외 경로가 없어(항상 200) collector 의
  // 실패 분기를 실증하려면 요청 함수 레벨에서 non-2xx status 를 직접 반환해야 한다(controller 를
  // 실제로 호출하지 않고 status 만 fabricate). mock slice 시절부터의 관용 수단이라 새 축이 아니다.
  const injectStatus =
    (status: number): RequestFn =>
    async () => ({ status });

  // baseline 한 줄 관찰 조립 — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    assertion: S2Assertion,
  ): { line: string; report: BaselineReport } => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const report = buildBaselineReport(env, assertion);
    const entry = { line: formatBaselineLine(report), report };
    observations.push(entry);
    return entry;
  };

  // happy path — 상수 문자열 200. 상수는 `src/app.service.ts` 에서 import 해 쓰고 리터럴을
  // 복제하지 않는다(값이 바뀌면 본 spec 이 자동으로 따라간다).
  it("happy: GET /api 반복 조회 → 매 응답 200 + 상수 문자열 일치 + 표본 수 == 반복 수 + p95 < 3000ms pass", async () => {
    const result = await measure(ROOT, null, ITERATIONS);

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(result.samplesMs).toHaveLength(ITERATIONS);
    expect(lastStatus).toBe(200);
    // 상수 문자열을 그대로 forward — mock 판과 달리 실 `AppService` 인스턴스가 응답한 값이다.
    expect(lastText).toBe(APP_STATUS_MESSAGE);
    // 실 Prisma 연결이 살아 있는 부트스트랩임을 actor row 로 확인(요청 경로는 이를 타지 않는다).
    expect(await prisma.user.count()).toBe(2);

    // REQ-048 임계 — DB 미접촉 route 에서의 판정.
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.reasons).toHaveLength(0);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
    observe("ci-realdb-app-root-200", assertion);
  });

  // error path — `getRoot()` 자체에는 예외 경로가 **없다**(항상 200 상수 반환). 그래서 error path 는
  // 인접 미매칭 경로의 404 로 커버한다(routing layer 가 내는 4xx 이지 5xx 가 아니다).
  it("error: 인접 미매칭 경로 반복 조회 → 전부 404(500 아님) · 성공 표본 0 · raw stack·내부 경로 미노출", async () => {
    const result = await measure(MISSING, null, SHORT_ITERATIONS);

    expect(result.total).toBe(SHORT_ITERATIONS);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(result.samplesMs).toHaveLength(0);
    expect(lastStatus).toBe(404);
    expect(lastStatus).not.toBe(500);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);

    // 404 body 에 raw stack / 내부 경로가 새지 않는다(REQ-032 계열).
    expect(lastBody).not.toHaveProperty("stack");
    const serialized = JSON.stringify(lastBody);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
    expect(serialized).not.toMatch(/node_modules/);
    expect(serialized).not.toMatch(/app\.controller/);
  });

  // 분기 cover — `getRoot()` 는 **분기가 0** 이다(param 0 · 조건 0 · 상수 반환). 그래서 분기 cover 는
  // (a) `assertS2Threshold` 의 pass 분기(위 happy)와 fail 분기(negative (d)(e)) 양쪽 도달,
  // (b) DB 전량 truncate **전 / 후** 응답이 불변임을 보이는 대조 쌍으로 채운다. 후자가 곧 본 route 가
  // DB 를 접촉하지 않는다는 실증이다(접촉한다면 빈 테이블에서 형태가 달라지거나 5xx 가 났을 것).
  it("분기: 분기 0 인 getRoot — DB 전량 truncate 전/후 모두 200 + 동일 상수 문자열로 불변", async () => {
    const before = await measure(ROOT, null, SHORT_ITERATIONS);
    expect(before.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const beforeText = lastText;
    expect(beforeText).toBe(APP_STATUS_MESSAGE);
    expect(await prisma.user.count()).toBe(2);

    // 도메인 테이블 전량 비우기 — actor User 까지 사라진다(afterEach 가 재삽입한다).
    await truncateAll(prisma);
    expect(await prisma.user.count()).toBe(0);

    const after = await measure(ROOT, null, SHORT_ITERATIONS);
    expect(after.failures).toBe(0);
    expect(after.samplesMs).toHaveLength(SHORT_ITERATIONS);
    expect(lastStatus).toBe(200);
    expect(lastStatus).not.toBe(500);
    // 빈 DB 에서도 같은 상수 문자열 — 요청 경로가 DB 를 타지 않는다는 직접 증거.
    expect(lastText).toBe(beforeText);
    expect(lastText).toBe(APP_STATUS_MESSAGE);

    const afterAssertion = assertS2Threshold(after);
    expect(afterAssertion.pass).toBe(true);
    expect(afterAssertion.errorRate).toBe(0);
    expect(afterAssertion.summary.p95).toBeLessThan(3000);
    // 두 구간의 p95 대소는 **단언하지 않는다**(AC 6 — wall-clock 비결정성).
  });

  // 새 축 (가) — 실 Prisma 가 연결된 부트스트랩에서 DB 미접촉 route 의 p95 를 재고, 관찰 라인만
  // 남긴다. 단언은 고정 임계 3000ms 대비 pass 뿐이며, 이 값을 다른 route 의 값과 비교하지 않는다.
  it("새 축: 실 부트스트랩 하 DB 미접촉 floor 측정 → p95 < 3000ms + 관찰 라인만(디스크 write 0)", async () => {
    const result = await measure(ROOT, null, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastText).toBe(APP_STATUS_MESSAGE);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(assertion.summary.count).toBe(ITERATIONS);

    const { line, report } = observe("ci-realdb-app-root-floor", assertion);
    // 관찰 라인에 표본 규모·반복 수가 실려 다른 slice 와 조건 비교가 가능하다.
    expect(line).toContain("p95=");
    expect(line).toContain("count=");
    expect(line).toContain(`dataScale=${DATA_SCALE}`);
    expect(line).toContain(`iterations=${ITERATIONS}`);
    expect(Number.isFinite(report.p95)).toBe(true);
    expect(report.count).toBe(ITERATIONS);
    expect(report.pass).toBe(true);
    expect(report.env.concurrency).toBe(1);
    // baseline 은 관찰 전용 — 파일로 확정하지 않는다(`writeBaselineFile` 미사용).
  });

  describe("negative cases 충분 cover", () => {
    // (a) slice 1~21 과 **정반대** — 인증 쿠키가 없어도 401 이 아니라 200 이다(guard 미적용 실증).
    it("(a) 인증 쿠키 없이 반복 조회 → 401 이 아니라 200 + 표본 정상 수집", async () => {
      const result = await measure(ROOT, null, SHORT_ITERATIONS);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(SHORT_ITERATIONS);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(401);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) 서명이 깨진 변조 토큰 쿠키를 붙여도 검증 자체가 일어나지 않아 401/403 이 아니라 200 이다.
    it("(b) 변조 토큰 쿠키 부착 → 401/403 이 아니라 200 + 표본 정상 수집", async () => {
      const result = await measure(ROOT, tamperedCookie, SHORT_ITERATIONS);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(SHORT_ITERATIONS);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(401);
      expect(lastStatus).not.toBe(403);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
    });

    // (c) `RolesGuard` + `@Roles("Admin")` 부재 실증 — User tier actor 도 403 이 아니라 200 이고,
    //     Admin tier 와 응답이 완전히 동일하다(role 이 응답에 반영되지 않는다).
    it("(c) User tier actor cookie → 403 이 아니라 200 (Admin tier 와 동일 응답)", async () => {
      const asUser = await measure(ROOT, userCookie, SHORT_ITERATIONS);
      expect(asUser.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(403);
      const userText = lastText;

      const asAdmin = await measure(ROOT, adminCookie, SHORT_ITERATIONS);
      expect(asAdmin.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastText).toBe(userText);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
    });

    // (d) 비현실적 임계 주입 — 실 측정값이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    //     실 latency 값에 무의존한 결정론적 fail 분기(허용된 두 latency 단언 중 하나).
    it("(d) p95MaxMs: 0 주입 → 실 측정값이라도 pass === false + p95 임계 사유", async () => {
      const result = await measure(ROOT, null, SHORT_ITERATIONS);

      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });

    // (e) `getRoot()` 는 예외 경로가 없어 요청 wrapper 레벨에서 non-2xx 를 주입해 errorRate 위반
    //     분기에 도달한다. 200 과 섞으면 `0 < errorRate < 1` 중간값이 나온다.
    it("(e) 인위 non-2xx(500·503) 주입 → errorRate 위반 fail, 200 혼합 표본은 0 < errorRate < 1", async () => {
      const injected = await collectLatencySamples(
        injectStatus(500),
        SHORT_ITERATIONS,
      );
      expect(injected.failures).toBe(SHORT_ITERATIONS);
      expect(injected.samplesMs).toHaveLength(0);
      const assertion = assertS2Threshold(injected);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(assertion.reasons.join()).toContain("error rate 임계 초과");

      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실 `GET /api`(200), 짝수 번째는 인위 503.
        return call % 2 === 1 ? getRequest(ROOT, null)() : injectStatus(503)();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const mixedAssertion = assertS2Threshold(result);
      expect(mixedAssertion.errorRate).toBeGreaterThan(0);
      expect(mixedAssertion.errorRate).toBeLessThan(1);
      expect(mixedAssertion.errorRate).toBeCloseTo(0.5);
      expect(mixedAssertion.pass).toBe(false);
    });

    // (f) param 0 route 실증 — query string 을 붙여도 핸들러가 이를 읽지 않아 응답이 동일하다.
    it("(f) query string 부착(GET /api?x=1) → 200 + 동일 상수 문자열", async () => {
      const plain = await measure(ROOT, null, 1);
      expect(plain.failures).toBe(0);
      const plainText = lastText;

      const queried = await measure(WITH_QUERY, null, SHORT_ITERATIONS);
      expect(queried.failures).toBe(0);
      expect(queried.samplesMs).toHaveLength(SHORT_ITERATIONS);
      expect(lastStatus).toBe(200);
      expect(lastText).toBe(plainText);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
    });

    // (g) method 불일치 — `@Get()` 만 선언돼 있어 `POST /api` 는 405 가 아니라 **404** 로 수렴한다
    //     (Nest 기본 라우팅상 미매칭 경로와 같은 처리이며 5xx 가 아니다).
    it("(g) POST /api → 405 가 아니라 404 로 수렴하고 500 이 아님", async () => {
      const res = await request(app.getHttpServer()).post(ROOT).send({});

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(405);
      expect(res.status).not.toBe(500);
      expect(res.body).not.toHaveProperty("stack");
      // 미매칭이라 상수 문자열이 새지 않는다.
      expect(res.text).not.toBe(APP_STATUS_MESSAGE);
    });
  });
});

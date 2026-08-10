// app-root-measure-confirm-realdb.perf-spec.ts — S2 measure→confirm-or-compare loop 의 실 DB
// round-trip **slice 28**. (T-1555, load-resilience-test-plan §5 item 5 / REQ-048 p95 < 3s)
// 고유 축 ① **DB 미접촉 route 위의 첫 baseline 확정** — `getRoot()` 는 `AppService.getStatus()` 의
// 고정 상수를 동기 반환할 뿐이라 실 `AppModule` + 실 Prisma 연결이 살아 있어도 요청 경로가 DB 를
// 전혀 타지 않는다. 그래서 established / compared 두 국면의 baseline 은 **framework + HTTP 왕복만의
// 하한** 이고, 이를 **전량 truncate 전 / 후 응답 불변** 으로 실증한다. 고유 축 ② **guard layer 가
// 없는 첫 measure→confirm 실 DB slice** — cookie 미부착도 변조 쿠키도 401/403 이 아니라 200 이다
// (slice 25~27 과 정반대의 negative). 구조 골격 · helper 는 slice 27
// (`contribution-measure-confirm-realdb.perf-spec.ts`) 을 cross-ref 로 승계한다(문구 복제 0).
// 값끼리의 **wall-clock 대소도 `comparison.regressed` 값도 단언하지 않는다**(T-0877/T-0880 flaky
// 사고 재발 차단 — 관찰 기록만). baseline 은 **임시 디렉토리 1 회성** 이라 저장소 오염 0 이며
// 체크인 기준 baseline · CI job 편입 · 임계 fix 는 **미착수 그대로** 다. 계수·범위 경계는
// test/perf/README.md 의 slice 28 bullet 참조.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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
  formatBaselineLine,
  parseBaselineReport,
  resolveBaselinePath,
  type BaselineEnvMeta,
  type BaselineReport,
} from "./latency-baseline";
import type { ConfirmOrCompareResult } from "./latency-baseline-io";
import {
  measureAndConfirmBaseline,
  type MeasureBaselineOpts,
  type RequestFn,
} from "./latency-collector";

jest.setTimeout(120_000);

const ROOT = "/api";
const MISSING = "/api/no-such-route"; // 인접 미매칭 경로 — `getRoot()` 자체엔 예외 경로가 없다.
const ITER = { iterations: 4 }; // 실 부트스트랩 반복이라 소규모(4 회) 고정.

describe("S2 measure→confirm-or-compare perf-spec — 실 DB 부트스트랩 하 baseline 확정·비교 (GET /api, DB 미접촉 floor, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let tamperedCookie: string;
  let lastText = "";
  let lastBody: unknown;
  let lastStatus = 0;
  let tmpRoot: string; // 매 test 격리 임시 baseline 루트(afterEach 재귀 삭제 — repo 오염 0).
  const env: BaselineEnvMeta = { label: "realdb-app-root-mc", concurrency: 1 };

  beforeAll(async () => {
    // mock override 0 · guard override 0 — 실 AppModule 부트스트랩. 본 route 는 guard 가 없어
    // happy path 에 cookie 가 불요하지만 negative (a)(b) 대조를 위해 실 JWT 를 발급해 둔다.
    ctx = await createAuthenticatedE2EApp([{ role: "User" }]);
    app = ctx.app;
    prisma = ctx.prisma;
    const token = Object.values(ctx.tokens)[0];
    cookie = buildAuthCookie(token);
    tamperedCookie = buildAuthCookie(`${token}tam`);
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-approot-mc-realdb-"));
  });
  // `truncateAll` 명단의 `"User"` 가 actor row 를 지우므로 곧바로 원본 id 로 재삽입(FK 전제 복원).
  afterEach(async () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  /** tmpRoot 하위 POSIX 결합 baseDir(`resolveBaselinePath` 와 동일 정규화). */
  const dirOf = (seg: string): string =>
    path.posix.join(tmpRoot.split(path.sep).join("/"), seg);

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착(guard 가 없어 결과가 같아야 한다).
  const read =
    (target = ROOT, jar: string | null = null): RequestFn =>
    async () => {
      const r = request(app.getHttpServer()).get(target);
      const res = await (jar === null ? r : r.set("Cookie", jar));
      lastText = res.text;
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  /** measure→confirm loop 1 회 — env 고정, measure 옵션만 주입(재구현 0, 조립만). */
  const run = (req: RequestFn, dir: string, m: MeasureBaselineOpts = ITER) =>
    measureAndConfirmBaseline(req, env, dir, { measure: m });

  /** established 단언 + 확정 파일 실 존재·round-trip 로드 + 관찰 한 줄 적재. */
  const established = (
    r: ConfirmOrCompareResult,
    dir: string,
  ): BaselineReport => {
    expect(r.outcome).toBe("established");
    if (r.outcome !== "established") throw new Error("established 분기 아님");
    expect(r.path).toBe(resolveBaselinePath(env, dir));
    expect(fs.existsSync(r.path)).toBe(true);
    const report = parseBaselineReport(fs.readFileSync(r.path, "utf-8"));
    console.log(`[T-1555 관찰] ${formatBaselineLine(report)}`); // 관찰 기록만(단언 0).
    return report;
  };

  it("happy ①(established): 기준 부재 baseDir → 확정 write + count=반복수·errorRate=0·pass, 매 응답 200 + 상수 문자열", async () => {
    const dir = dirOf("baselines");
    const b = established(await run(read(), dir), dir);
    expect(b.count).toBe(ITER.iterations);
    expect(b.errorRate).toBe(0);
    expect(b.pass).toBe(true);
    expect(b.p95).toBeLessThan(3000); // REQ-048 임계 — 기본 표본 pass.
    expect(lastStatus).toBe(200);
    expect(lastText).toBe(APP_STATUS_MESSAGE); // 리터럴 복제 0 — 상수를 import 해 쓴다.
    // 실 Prisma 연결이 살아 있는 부트스트랩임을 actor row 로 확인(요청 경로는 이를 타지 않는다).
    expect(await prisma.user.count()).toBe(1);
  });
  it("happy ②(compared): 같은 baseDir 재호출 → 지표 5 키·report 산출(regressed 값은 미단언)", async () => {
    const dir = dirOf("baselines");
    established(await run(read(), dir), dir);
    const r = await run(read(), dir);
    expect(r.outcome).toBe("compared");
    if (r.outcome !== "compared") return;
    for (const k of ["p50", "p95", "p99", "errorRate", "throughput"] as const) {
      expect(typeof r.comparison[k].baseline).toBe("number");
      expect(typeof r.comparison[k].candidate).toBe("number");
    }
    expect(typeof r.comparison.regressed).toBe("boolean"); // 값은 단언하지 않는다.
    expect(lastStatus).toBe(200);
  });
  // 본 slice 고유 축 ① — DB 를 전량 비운 전 / 후 양쪽에서 established · compared 두 국면 모두를
  // 태우고 응답이 불변임을 보인다. 분기 판정은 baseline 파일 존재 여부라 latency 무의존이다.
  it("분기 ⓐ(DB 미접촉 실증): truncate 전/후 모두 established → compared 도달 + 200·상수 문자열 불변", async () => {
    for (const [seg, emptyDb] of [
      ["before", false],
      ["after", true],
    ] as const) {
      if (emptyDb) {
        await truncateAll(prisma); // actor 까지 사라진다(afterEach 가 복원).
        expect(await prisma.user.count()).toBe(0);
      }
      const dir = dirOf(seg);
      const b = established(await run(read(), dir), dir);
      expect(b.errorRate).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
      expect((await run(read(), dir)).outcome).toBe("compared");
      expect(lastStatus).toBe(200);
      expect(lastText).toBe(APP_STATUS_MESSAGE); // 빈 DB 에서도 동일 — DB 미접촉의 직접 증거.
    }
  });
  // 주입 임계 `p95MaxMs: 0` 은 실 측정 시간에 무의존한 결정론적 fail 분기(임계값 자체는 불변).
  it("분기 ⓑ(임계 fail 주입): p95MaxMs=0 → pass=false candidate 도 throw 없이 확정 write", async () => {
    const dir = dirOf("strict");
    const o = { ...ITER, thresholds: { p95MaxMs: 0 } };
    const b = established(await run(read(), dir, o), dir);
    expect(b.pass).toBe(false);
    expect(b.errorRate).toBe(0);
  });
  // measure→confirm 순서 계약상 measure 실패 시 write 부작용 0(임시 루트 파일 0 개).
  it("error path (a): baseDir 공백-only → RangeError, 임시 루트에 파일 0 개 생성", async () => {
    await expect(run(read(), "   ")).rejects.toThrow(RangeError);
    expect(fs.readdirSync(tmpRoot)).toHaveLength(0);
  });
  it("error path (b): 확정된 baseline JSON 손상 후 재호출 → SyntaxError 전파", async () => {
    const dir = dirOf("baselines");
    established(await run(read(), dir), dir);
    fs.writeFileSync(resolveBaselinePath(env, dir), "{not-json", "utf-8");
    await expect(run(read(), dir)).rejects.toThrow(SyntaxError);
  });

  describe("negative cases 충분 cover", () => {
    // (a) slice 25~27 과 **정반대** — cookie 가 없어도 401 이 아니라 200 이다(guard 미적용 실증).
    it("(a) cookie 미부착 → 401 이 아니라 200, 표본 정상 수집(errorRate=0·count=반복수)", async () => {
      const dir = dirOf("baselines");
      const b = established(await run(read(ROOT, null), dir), dir);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(401);
      expect(b.errorRate).toBe(0);
      expect(b.count).toBe(ITER.iterations);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
    });
    // (b) 서명이 깨진 변조 토큰을 붙여도 검증 자체가 일어나지 않아 401/403 이 아니다.
    it("(b) 변조 토큰 쿠키 부착 → 401/403 이 아니라 200 + 정상 cookie 와 동일 응답", async () => {
      const dir = dirOf("tampered");
      const b = established(await run(read(ROOT, tamperedCookie), dir), dir);
      expect(b.errorRate).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(403);
      const tamperedText = lastText;
      await run(read(ROOT, cookie), dirOf("valid"));
      expect(lastText).toBe(tamperedText);
      expect(lastText).toBe(APP_STATUS_MESSAGE);
    });
    it("(c) 인접 미매칭 경로 반복 조회 → 전부 404(500 아님) · 성공 표본 0 · raw stack·내부 경로 미노출", async () => {
      const dir = dirOf("missing");
      const b = established(await run(read(MISSING), dir), dir);
      expect(lastStatus).toBe(404);
      expect(lastStatus).not.toBe(500);
      expect(b.errorRate).toBe(1);
      expect(b.count).toBe(0);
      expect(b.pass).toBe(false);
      expect(lastBody).not.toHaveProperty("stack");
      const serialized = JSON.stringify(lastBody);
      expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
      expect(serialized).not.toMatch(/node_modules/);
      expect(serialized).not.toMatch(/app\.controller/);
    });
    it("(d) 인위 503 전량 → errorRate=1, 실 200 혼합 → 0 < errorRate < 1", async () => {
      const fd = dirOf("fail");
      const fail503 = () => Promise.resolve({ status: 503 });
      expect(established(await run(fail503, fd), fd).errorRate).toBe(1);
      let call = 0; // 홀수 번째는 실 200, 짝수 번째는 인위 503 → errorRate 0.5.
      const mixed: RequestFn = async () =>
        (call += 1) % 2 === 1 ? read()() : { status: 503 };
      const dir = dirOf("mixed");
      const half = established(await run(mixed, dir), dir);
      expect(half.errorRate).toBeGreaterThan(0);
      expect(half.errorRate).toBeLessThan(1);
    });
    // (e) `@Get()` 만 선언돼 있어 `POST /api` 는 405 가 아니라 404 로 수렴한다(5xx 아님).
    it("(e) POST /api → 405 가 아니라 404 로 수렴하고 500 이 아님", async () => {
      const res = await request(app.getHttpServer()).post(ROOT).send({});
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(405);
      expect(res.status).not.toBe(500);
      expect(res.body).not.toHaveProperty("stack");
      expect(res.text).not.toBe(APP_STATUS_MESSAGE); // 미매칭이라 상수가 새지 않는다.
    });
  });
});

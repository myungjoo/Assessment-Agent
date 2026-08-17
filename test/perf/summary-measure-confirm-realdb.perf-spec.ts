// summary-measure-confirm-realdb.perf-spec.ts — S2 measure→confirm-or-compare loop 의 실 DB
// round-trip **slice 25**. (T-1549, load-resilience-test-plan §5 item 5 / REQ-048 p95 < 3s)
// ① 고유 축 — `measureAndConfirmBaseline`(measure→확정/비교 top loop)의 **첫 실 DB 배선**. 기존
//    measure→confirm spec 4 개(T-0877 · T-0880 · assessment · contribution)는 전부 service mock +
//    `overrideGuard` 라 established / compared 두 국면이 **실 query 지연을 포함한 표본** 에서
//    성립하는지는 미관측이었다. slice 6(`summary-read-realdb`, T-1510)은 같은 route 를 실 DB 로
//    쟀지만 관찰 전용이라 baseline 미확정 — 본 spec 이 그 경계를 route 하나에 한해 처음 넘는다.
// ② mock 0 · guard override 0 — 실 JWT 로 guard 통과, **응답 길이 = seed row 수** 로 실 query 발화
//    입증. wall-clock 대소·`comparison.regressed` 는 **미단언**(slice 3·23·24 선례) — 단언은 분기
//    도달 · 응답 길이 · 임계 pass / 주입 임계 fail 뿐이다.
// ③ baseline 은 **임시 디렉토리 1 회성**(repo 오염 0) — 체크인 기준 baseline(§5 #5) · CI job 편입
//    (§5 #4) · 임계 fix 미착수. mock 짝 · slice 6 · production code · schema · 임계값 불변이며
//    REQ-047 실 scale 부하가 아니다.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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

import { registerCheckinBaselineWiringSuite } from "./checkin-baseline-spec-suite";
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
  measureBaselineCandidate,
  type MeasureBaselineOpts,
  type RequestFn,
} from "./latency-collector";
// 주입 monotonic clock 은 공유 helper 위임(T-1581 승격) — 실 query 지연이 섞여도 표본이
// 결정론적이라 배선 국면에 wall-clock 대소 단언이 0 이다.
import { createStepClock } from "./step-clock";

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 6 과 동등한 여유.
jest.setTimeout(120_000);

const WEEK_ROWS = 3;
const MONTH_ROWS = 2;
const TOTAL_ROWS = WEEK_ROWS + MONTH_ROWS;
// 기본 measure 옵션 — 실 DB 반복이라 소규모(4 회)로 고정한다.
const ITER = { iterations: 4 };
// 체크인 배선 국면용 반복수 — 국면 10 개가 각각 측정을 태우므로 실 DB 비용을 감안해 2 회로 더
// 줄인다(표본은 주입 clock 으로 결정론화하므로 반복수는 비용 변수일 뿐이다).
const WIRING_ITER = 2;

describe("S2 measure→confirm-or-compare perf-spec — 실 DB round-trip baseline 확정·비교 (GET /api/summaries, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;
  // 매 test 격리 임시 baseline 루트(afterEach 재귀 삭제 — repo 오염 0).
  let tmpRoot: string;
  // 관찰 기록 전용(수치 대소·regressed assert 금지).
  const observations: string[] = [];
  // 결정론 env-meta — label 이 baseline 파일명 slug 를 결정한다.
  const env: BaselineEnvMeta = { label: "realdb-summary-mc", concurrency: 1 };

  beforeAll(async () => {
    // mock override 0 · guard override 0 — 실 AppModule + actor User seed + 실 JWT 발급.
    ctx = await createAuthenticatedE2EApp([{ role: "User" }]);
    app = ctx.app;
    prisma = ctx.prisma;
    cookie = buildAuthCookie(Object.values(ctx.tokens)[0]);
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-summary-mc-realdb-"));
  });
  // `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 곧바로 원본 id 로 재삽입.
  afterEach(async () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });
  afterAll(async () => {
    console.log(`[T-1549 관찰] ${observations.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  /** tmpRoot 하위 POSIX 결합 baseDir(`resolveBaselinePath` 와 동일 정규화). */
  const dirOf = (seg: string): string =>
    path.posix.join(tmpRoot.split(path.sep).join("/"), seg);

  // Person 1 + Summary(week 3 + month 2) seed. `@@unique([personId, period, periodStart])`
  // 충돌(P2002) 회피로 period 안에서 periodStart 를 row 마다 다르게 준다.
  const seed = async (): Promise<string> => {
    const { id } = await prisma.person.create({
      data: { fullName: "실DB요약대상", email: "realdb-smc@example.test" },
    });
    const rowsOf = (period: string, count: number, base: number) =>
      Array.from({ length: count }, (_, i) => ({
        personId: id,
        period,
        periodStart: new Date(Date.UTC(2026, 0, base + i * 7)),
        narrative: `실DB요약서술-${period}-${i}`,
        metricScore: 60 + i,
      }));
    const week = rowsOf("week", WEEK_ROWS, 5);
    await prisma.summary.createMany({
      data: week.concat(rowsOf("month", MONTH_ROWS, 1)),
    });
    return id;
  };

  // 조회 1회. `authed=false` 면 Cookie 미부착이라 `JwtAuthGuard` 401 분기로 간다.
  const read =
    (query: string, authed = true): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(`/api/summaries${query}`);
      const res = await (authed ? req.set("Cookie", cookie) : req);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const rows = (): unknown[] => lastBody as unknown[];

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
    observations.push(formatBaselineLine(report));
    return report;
  };

  // happy ① = 최초 확정 write + period 미지정 분기 + 고정 임계 3000ms pass 분기.
  it("happy ①(established): 기준 부재 baseDir → 확정 write + count=반복수·errorRate=0·pass, 응답 길이 5", async () => {
    const id = await seed();
    const dir = dirOf("baselines");
    const b = established(await run(read(`?personId=${id}`), dir), dir);
    expect(b.count).toBe(ITER.iterations);
    expect(b.errorRate).toBe(0);
    expect(b.pass).toBe(true);
    expect(b.env).toEqual(env);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(TOTAL_ROWS);
  });
  it("happy ②(compared): 같은 baseDir 재호출 → 지표 5 키·report 산출(regressed 값은 미단언)", async () => {
    const id = await seed();
    const dir = dirOf("baselines");
    established(await run(read(`?personId=${id}`), dir), dir);
    const r = await run(read(`?personId=${id}`), dir);
    expect(r.outcome).toBe("compared");
    if (r.outcome !== "compared") return;
    for (const k of ["p50", "p95", "p99", "errorRate", "throughput"] as const) {
      expect(typeof r.comparison[k].baseline).toBe("number");
      expect(typeof r.comparison[k].candidate).toBe("number");
    }
    expect(typeof r.comparison.regressed).toBe("boolean");
    expect(r.report).toContain("regressed=");
    observations.push(`compared:${r.report}`);
    expect(lastStatus).toBe(200);
  });
  it("분기 ⓑ(period 지정): ?period=week → 3 건, ?period=month → 2 건(둘 다 established)", async () => {
    const id = await seed();
    for (const p of ["week", "month"] as const) {
      const dir = dirOf(p);
      established(await run(read(`?personId=${id}&period=${p}`), dir), dir);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(p === "week" ? WEEK_ROWS : MONTH_ROWS);
    }
  });
  // 주입 임계 `p95MaxMs: 0` 은 실 측정 시간에 무의존한 결정론적 fail 분기.
  it("분기 ⓒ(임계 fail 주입): p95MaxMs=0 → pass=false candidate 도 throw 없이 확정 write", async () => {
    const id = await seed();
    const dir = dirOf("strict");
    const o = { ...ITER, thresholds: { p95MaxMs: 0 } };
    const b = established(await run(read(`?personId=${id}`), dir, o), dir);
    expect(b.pass).toBe(false);
    expect(b.errorRate).toBe(0);
  });
  // error path (a) — measure→confirm 순서 계약상 write 부작용 0(파일 0 개).
  it("error path (a): baseDir 공백-only → RangeError, 임시 루트에 파일 0 개 생성", async () => {
    const call = run(read(`?personId=${await seed()}`), "   ");
    await expect(call).rejects.toThrow(RangeError);
    expect(fs.readdirSync(tmpRoot)).toHaveLength(0);
  });
  it("error path (b): 확정된 baseline JSON 손상 후 재호출 → SyntaxError 전파", async () => {
    const id = await seed();
    const dir = dirOf("baselines");
    established(await run(read(`?personId=${id}`), dir), dir);
    fs.writeFileSync(resolveBaselinePath(env, dir), "{not-json", "utf-8");
    const call = run(read(`?personId=${id}`), dir);
    await expect(call).rejects.toThrow(SyntaxError);
  });

  describe("negative cases 충분 cover", () => {
    it("(a) personId 누락 → 400, errorRate=1 candidate 도 established write 수행", async () => {
      await seed();
      const dir = dirOf("baselines");
      const b = established(await run(read(""), dir), dir);
      expect(lastStatus).toBe(400);
      expect(b.errorRate).toBe(1);
      expect(b.count).toBe(0);
      expect(b.pass).toBe(false);
    });
    // 경계값 — 매칭 0 건은 404 가 아니라 200 + 빈 배열(service pass-through).
    it("(b) 매칭 0 건 personId → 404 아닌 200 + 빈 배열, errorRate=0", async () => {
      await seed();
      const dir = dirOf("baselines");
      const b = established(await run(read("?personId=no-such"), dir), dir);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
      expect(b.errorRate).toBe(0);
    });
    it("(c) 인증 없음(Cookie 미부착) → 전부 401, errorRate=1", async () => {
      const dir = dirOf("baselines");
      const req = read(`?personId=${await seed()}`, false);
      expect(established(await run(req, dir), dir).errorRate).toBe(1);
      expect(lastStatus).toBe(401);
    });
    it("(d) 인위 503 전량 → errorRate=1, 실 200 혼합 → 0 < errorRate < 1", async () => {
      const id = await seed();
      const fd = dirOf("fail");
      const fail503 = () => Promise.resolve({ status: 503 });
      expect(established(await run(fail503, fd), fd).errorRate).toBe(1);
      let call = 0;
      // 홀수 번째는 실 200 요청, 짝수 번째는 인위 503 → errorRate 0.5.
      const mixed: RequestFn = async () => {
        call += 1;
        return call % 2 === 1 ? read(`?personId=${id}`)() : { status: 503 };
      };
      const dir = dirOf("mixed");
      const half = established(await run(mixed, dir), dir);
      expect(half.errorRate).toBeGreaterThan(0);
      expect(half.errorRate).toBeLessThan(1);
    });
    // truncate 는 actor User row 도 지우므로 원본 id 그대로 재삽입한다.
    it("(e) truncate 전/후 대조 쌍 → 5 건 → 0 건, 두 요청 모두 200", async () => {
      const id = await seed();
      const dir = dirOf("baselines");
      const short = { iterations: 2 };
      established(await run(read(`?personId=${id}`), dir, short), dir);
      expect(rows()).toHaveLength(TOTAL_ROWS);
      await truncateAll(prisma);
      await reseedAuthenticatedActors(ctx);
      // 같은 baseDir 이라 존재 분기(compared)로 간다 — regressed 값은 단언하지 않는다.
      const after = await run(read(`?personId=${id}`), dir, short);
      expect(after.outcome).toBe("compared");
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
    });
  });

  // 체크인(repo 안 commit) baseline 확인 배선 — ADR-0056 §Follow-ups (b) 의 **첫 실 DB 소비자**.
  // 배선 국면 10 개(happy 3 · error 2 · 분기 2 · negative 3)는 **공유 suite factory 호출 1 회**로
  // 등록하고 spec 은 고유분(`envMeta` · 측정 조립 · 임시 디렉토리)만 주입한다 — 지역 사본 0 이고
  // 국면 본문 · 판정 · 경로 문자열 · 로그 형식 · seed 재구현도 0 이다(전량 helper 위임). 전역
  // 토글 저장 · 원복도 factory 의 beforeEach / afterEach 소관이라 지역 savedFlag 처리를 두지
  // 않는다(이중 원복 0). 토글 off 기본 상태에서는 `fs` 조회 0 · write 0 이라 기존 `perf test`
  // step 동작이 그대로고, 회귀는 관찰만 하며 exit code 를 바꾸지 않는다. 잘못된 options
  // (non-object · non-function)로 인한 **등록 시점 TypeError** 국면은 factory colocated spec
  // (`checkin-baseline-spec-suite.spec.ts`)의 책임이라 여기서 중복 작성하지 않는다.
  registerCheckinBaselineWiringSuite({
    envMeta: env,
    // 측정은 collector 위임(주입 clock 으로 결정론화) — 실 JWT 로 GET /api/summaries 를 태워
    // 실 query 지연이 섞인 표본에서 배선을 관찰한다(매칭 0 건이라 200 + 빈 배열, errorRate 0).
    measure: (stepMs) =>
      measureBaselineCandidate(read("?personId=checkin-wiring-probe"), env, {
        iterations: WIRING_ITER,
        now: createStepClock(stepMs),
      }),
    // 임시 repo root — 체크인 baseline 파일은 매 test 격리 tmpRoot 아래에만 만든다(실경로 무오염).
    tempDir: (name) => dirOf(name),
  });
});

// contribution-measure-confirm-realdb.perf-spec.ts — S2 measure→confirm-or-compare loop 의 실 DB
// round-trip **slice 27**. (T-1553, load-resilience-test-plan §5 item 5 / REQ-048 p95 < 3s)
// 고유 축은 **`Person → Assessment → Contribution` 3-level FK chain 의 첫 실 DB baseline 배선** —
// **부모 id 로 자식 컬렉션을 긁는** 구조의 established(최초 확정 write) · compared(로드·비교) 양 국면
// 도달이 미관측이었다. mock 0 · guard 우회 0 이라 **응답 길이 = 그 부모의 seed 자식 수**(5 vs 3)로 실
// query 발화를 입증하고, wall-clock 대소도 `comparison.regressed` 도 **미단언** 이며 baseline 은 **임시
// 디렉토리 1 회성**(repo 오염 0). 위치·계수·범위 경계는 test/perf/README.md 의 slice 27 bullet 참조.
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

jest.setTimeout(120_000);

// 부모별 자식 수 — **서로 다른 개수** 여야 부모 필터가 자식 집합을 가르는 게 보인다.
const PRIMARY_CHILDREN = 5;
const OTHER_CHILDREN = 3;
const ITER = { iterations: 4 }; // 실 DB 반복이라 소규모(4 회) 고정.
// 체크인 배선 국면용 반복수 — 국면 10 개가 각각 측정을 태우므로 실 DB 비용을 감안해 2 회로 더
// 줄인다(표본은 주입 clock 으로 결정론화하므로 반복수는 비용 변수일 뿐이다).
const WIRING_ITER = 2;

describe("S2 measure→confirm-or-compare perf-spec — 실 DB round-trip baseline 확정·비교 (GET /api/contributions, 3-level FK chain, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let lastBody: unknown;
  let lastStatus = 0;
  let tmpRoot: string; // 매 test 격리 임시 baseline 루트(afterEach 재귀 삭제 — repo 오염 0).
  const env: BaselineEnvMeta = { label: "realdb-contrib-mc", concurrency: 1 };

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
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-cmc-realdb-"));
  });
  // `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 곧바로 원본 id 로 재삽입.
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
  const qOf = (id: string): string => `?assessmentId=${id}`;

  // 3-level FK chain seed — Person 1 → Assessment 2 → 각 부모의 자식(`@@unique` 회피로 periodStart ·
  // sourceRef 를 row 마다 다르게).
  const seed = async (): Promise<{ primary: string; other: string }> => {
    const person = await prisma.person.create({
      data: { fullName: "실DB기여대상", email: "realdb-cmc@example.test" },
    });
    await prisma.assessment.createMany({
      data: [1, 8].map((day) => ({
        personId: person.id,
        period: "week",
        scope: "aggregate",
        periodStart: new Date(Date.UTC(2026, 0, day)),
        difficulty: "medium",
        contributionScore: 42,
        volume: 10,
        narrative: `실DB기여부모-${day}`,
      })),
    });
    const [primary, other] = (
      await prisma.assessment.findMany({ orderBy: { periodStart: "asc" } })
    ).map((a) => a.id);
    const childrenOf = (assessmentId: string, label: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        assessmentId,
        sourceType: "commit",
        sourceUrl: `https://example.test/${label}/${i}`,
        sourceRef: `실DB기여참조-${label}-${i}`,
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
    return { primary, other };
  };

  // 조회 1회. `authed=false` 면 Cookie 미부착이라 `JwtAuthGuard` 401 분기로 간다.
  const read =
    (query: string, authed = true): RequestFn =>
    async () => {
      const r = request(app.getHttpServer()).get(`/api/contributions${query}`);
      const res = await (authed ? r.set("Cookie", cookie) : r);
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
    console.log(`[T-1553 관찰] ${formatBaselineLine(report)}`); // 관찰 기록만(단언 0).
    return report;
  };

  it("happy ①(established): 기준 부재 baseDir → 확정 write + count=반복수·errorRate=0·pass, 자식 5 건", async () => {
    const dir = dirOf("baselines");
    const req = read(qOf((await seed()).primary));
    const b = established(await run(req, dir), dir);
    expect(b.count).toBe(ITER.iterations);
    expect(b.errorRate).toBe(0);
    expect(b.pass).toBe(true);
    expect(b.p95).toBeLessThan(3000);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(PRIMARY_CHILDREN);
  });
  it("happy ②(compared): 같은 baseDir 재호출 → 지표 5 키·report 산출(regressed 값은 미단언)", async () => {
    const dir = dirOf("baselines");
    const req = read(qOf((await seed()).primary));
    established(await run(req, dir), dir);
    const r = await run(req, dir);
    expect(r.outcome).toBe("compared");
    if (r.outcome !== "compared") return;
    for (const k of ["p50", "p95", "p99", "errorRate", "throughput"] as const) {
      expect(typeof r.comparison[k].baseline).toBe("number");
      expect(typeof r.comparison[k].candidate).toBe("number");
    }
    expect(typeof r.comparison.regressed).toBe("boolean");
  });
  // 본 slice 고유 축 — 부모 id 두 개가 established·compared 양 국면 도달 + 길이 5 vs 3(서로 다름).
  it("분기 ⓐ(3-level FK 부모 선택): 부모 A 5 건 · 부모 B 3 건이 established → compared 양 국면 도달", async () => {
    const { primary, other } = await seed();
    expect(PRIMARY_CHILDREN).not.toBe(OTHER_CHILDREN);
    for (const [seg, id, len] of [
      ["primary", primary, PRIMARY_CHILDREN],
      ["other", other, OTHER_CHILDREN],
    ] as const) {
      const dir = dirOf(seg);
      const req = read(qOf(id));
      established(await run(req, dir), dir);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(len);
      expect((await run(req, dir)).outcome).toBe("compared");
      expect(rows()).toHaveLength(len);
    }
  });
  // 주입 임계 `p95MaxMs: 0` 은 실 측정 시간에 무의존한 결정론적 fail 분기.
  it("분기 ⓑ(임계 fail 주입): p95MaxMs=0 → pass=false candidate 도 throw 없이 확정 write", async () => {
    const dir = dirOf("strict");
    const req = read(qOf((await seed()).primary));
    const o = { ...ITER, thresholds: { p95MaxMs: 0 } };
    const b = established(await run(req, dir, o), dir);
    expect(b.pass).toBe(false);
    expect(b.errorRate).toBe(0);
  });
  // measure→confirm 순서 계약상 measure 실패 시 write 부작용 0(임시 루트 파일 0 개).
  it("error path (a): baseDir 공백-only → RangeError, 임시 루트에 파일 0 개 생성", async () => {
    const call = run(read(qOf((await seed()).primary)), "   ");
    await expect(call).rejects.toThrow(RangeError);
    expect(fs.readdirSync(tmpRoot)).toHaveLength(0);
  });
  it("error path (b): 확정된 baseline JSON 손상 후 재호출 → SyntaxError 전파", async () => {
    const dir = dirOf("baselines");
    const req = read(qOf((await seed()).primary));
    established(await run(req, dir), dir);
    fs.writeFileSync(resolveBaselinePath(env, dir), "{not-json", "utf-8");
    await expect(run(req, dir)).rejects.toThrow(SyntaxError);
  });

  describe("negative cases 충분 cover", () => {
    it("(a) assessmentId 누락 → 400, errorRate=1 candidate 도 established write 수행", async () => {
      await seed();
      const dir = dirOf("baselines");
      const b = established(await run(read(""), dir), dir);
      expect(lastStatus).toBe(400);
      expect(b.errorRate).toBe(1);
      expect(b.count).toBe(0);
      expect(b.pass).toBe(false);
    });
    it("(b) 존재하지 않는 assessmentId → 404 아닌 200 + 빈 배열, errorRate=0", async () => {
      await seed();
      const dir = dirOf("baselines");
      const b = established(await run(read(qOf("no-such")), dir), dir);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
      expect(b.errorRate).toBe(0);
    });
    it("(c) 인증 없음(Cookie 미부착) → 전부 401, errorRate=1", async () => {
      const dir = dirOf("baselines");
      const req = read(qOf((await seed()).primary), false);
      expect(established(await run(req, dir), dir).errorRate).toBe(1);
      expect(lastStatus).toBe(401);
    });
    it("(d) 인위 503 전량 → errorRate=1, 실 200 혼합 → 0 < errorRate < 1", async () => {
      const { primary } = await seed();
      const fd = dirOf("fail");
      const fail503 = () => Promise.resolve({ status: 503 });
      expect(established(await run(fail503, fd), fd).errorRate).toBe(1);
      let call = 0; // 홀수 번째는 실 200, 짝수 번째는 인위 503 → errorRate 0.5.
      const mixed: RequestFn = async () =>
        (call += 1) % 2 === 1 ? read(qOf(primary))() : { status: 503 };
      const dir = dirOf("mixed");
      const half = established(await run(mixed, dir), dir);
      expect(half.errorRate).toBeGreaterThan(0);
      expect(half.errorRate).toBeLessThan(1);
    });
    it("(e) truncate 전/후 대조 쌍 → 5 건 → 0 건, 두 요청 모두 200", async () => {
      const dir = dirOf("baselines");
      const short = { iterations: 2 };
      const req = read(qOf((await seed()).primary));
      established(await run(req, dir, short), dir);
      expect(rows()).toHaveLength(PRIMARY_CHILDREN);
      await truncateAll(prisma);
      await reseedAuthenticatedActors(ctx);
      // 같은 baseDir 이라 존재 분기(compared)로 간다 — regressed 값은 단언하지 않는다.
      const after = await run(req, dir, short);
      expect(after.outcome).toBe("compared");
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
    });
  });

  // 체크인(repo 안 commit) baseline 확인 배선 — ADR-0056 §Follow-ups (b) 의 실 DB **세 번째**
  // 소비자(T-1576 summary · T-1577 assessment realdb 에 이어 `Person → Assessment →
  // Contribution` 3-level FK chain route 로 확산). 배선 국면 10 개(happy 3 · error 2 · 분기 2 ·
  // negative 3)는 **공유 suite factory 호출 1 회**로 등록하고 spec 은 고유분(`envMeta` · 측정
  // 조립 · 임시 디렉토리)만 주입한다 — 지역 사본 0 이고 국면 본문 · 판정 · 경로 문자열 · 로그
  // 형식 · seed 재구현도 0 이다(전량 helper 위임). 전역 토글 저장 · 원복도 factory 의
  // beforeEach / afterEach 소관이라 지역 savedFlag 처리를 두지 않는다(이중 원복 0). 토글 off
  // 기본 상태에서는 `fs` 조회 0 · write 0 이라 기존 `perf test` step 동작이 그대로고, 회귀는
  // 관찰만 하며 exit code 를 바꾸지 않는다. 잘못된 options(non-object · non-function)로 인한
  // **등록 시점 TypeError** 국면은 factory colocated spec(`checkin-baseline-spec-suite.spec.ts`)
  // 의 책임이라 여기서 중복 작성하지 않는다.
  registerCheckinBaselineWiringSuite({
    envMeta: env,
    // 측정은 collector 위임(주입 clock 으로 결정론화) — 실 JWT 로 GET /api/contributions 를 태워
    // 3-level FK chain 의 실 query 지연이 섞인 표본에서 배선을 관찰한다. 조회는 seed 와 무관한
    // 매칭 0 건 부모 query 라 200 + 빈 배열(errorRate 0)이고 기존 국면의 자식 수량 단언
    // (`PRIMARY_CHILDREN` · `OTHER_CHILDREN`)에 간섭하지 않는다.
    measure: (stepMs) =>
      measureBaselineCandidate(read(qOf("checkin-wiring-probe")), env, {
        iterations: WIRING_ITER,
        now: createStepClock(stepMs),
      }),
    // 임시 repo root — 체크인 baseline 파일은 매 test 격리 tmpRoot 아래에만 만든다(실경로 무오염).
    tempDir: (name) => dirOf(name),
  });
});

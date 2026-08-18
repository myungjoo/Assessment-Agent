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

import { CHECKIN_BASELINE_ENV_FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX } from "./checkin-baseline-report";
import type { CheckinBaselineRunOutcome } from "./checkin-baseline-run";
import { registerCheckinBaselineWiringSuite } from "./checkin-baseline-spec-suite";
import { checkCheckinBaselineForSpec } from "./checkin-baseline-spec-wiring";
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

  // 체크인 baseline 확인 경로의 **실측 clock 관찰 국면**(T-1602, ADR-0056 §Consequences (d) ·
  // §Follow-ups (a) 의 "나머지 route 체크인 baseline" 축을 **세 번째 실 DB route** 로 확산).
  // T-1593(person) → T-1600(assessment) 이 박제한 정본 패턴을 승계하되 route 고유분만 갈아끼운다.
  // 위 배선 suite 의 국면은 전부 `createStepClock` 합성 표본이라 CI 로그의 candidate 수치가 실
  // latency 가 아니다. 본 describe 는 **주입 clock 없이**(= `measureBaselineCandidate` 에 `now`
  // 미주입) 측정한 candidate 를 같은 확인 경로에 태워, 다음 slice 가 체크인할 baseline 의 승인
  // 입력(실 p50/p95/p99)을 로그로 처음 노출한다. 본 route 고유 축은 **`Person → Assessment →
  // Contribution` 3-level FK chain 의 부모 id 필터**(부모 A 5 건 · 부모 B 3 건)와 **`assessmentId`
  // 필수 파라미터**(부재 → 전량 400)로, 앞선 두 route 에는 없던 국면이다.
  // `repoRoot` 를 **생략**해 저장소 실경로 바인딩을 타지만 이 경로에는 write 국면이 아예 없어
  // (§Decision 2) `test/perf/baselines/` 는 오염되지 않고, 회귀도 관찰만 하므로 exit code 가
  // 바뀌지 않는다(§Decision 3 (b) — wall-clock 대소 단언 0). 토글은 `processEnv` 주입으로만
  // 제어해 전역 `process.env` 를 읽지도 쓰지도 않는다. 실경로 무오염 · 전역 토글 누출 0 ·
  // 연속 2 회 호출 부작용 0 국면은 배선 suite 가 같은 코드 경로로 이미 cover 하므로 여기서
  // 재작성하지 않는다(T-1575 중복 국면 삭제 선례).
  describe("체크인 baseline 실측 clock 관찰(ci-realdb-contribution-read)", () => {
    // 실측 축 전용 반복수 — `ITER` · `WIRING_ITER` 재사용 금지(비용 축과 의미가 다른 상수다,
    // T-1591). T-1593 → T-1600 이 박제한 3 → 20 상향 근거·한계·비용을 본 route 로 승계한다:
    //  (1) 근거 — 표본 3 개에서는 p95 · p99 가 상위 순위 표본이 없어 사실상 **최댓값 1 개와
    //      동일**해지고, 공유 runner 의 wall-clock 비결정성(ADR-0056 §Decision 3 (b))이 그대로
    //      지표에 실려 회귀 관찰이 잡음에 지배된다.
    //  (2) 한계 — 20 표본에서도 p99 는 상위 1 개 표본 근방이라 **여전히 최댓값에 가깝다**.
    //      p99 안정화에는 다중 run 분포(§Decision 5)가 필요하며 본 상수만으로는 p50 · p95 의
    //      순위 기반 의미 회복까지가 한계다.
    //  (3) 비용 — 20 회 실 DB 왕복은 guard 통과 + 3-level FK chain 의 소량 자식 조회 기준 합계
    //      수십 ms 규모라 §Decision 4 가 못 박은 "CI 비용 증가 사실상 0" 을 그대로 유지한다.
    const REAL_CLOCK_ITER = 20;
    // 표본 수 하한(회귀 가드 기준) — 아래 가드 `it` 이 이 값 미만으로의 되돌림을 fail 시킨다.
    const REAL_CLOCK_ITER_MIN = 20;
    // `dataScale` 표기는 seed 상수에서 **유도**한다(리터럴 손코딩 0) — 자식 수를 바꾸면 표기가
    // 자동으로 따라와 다음 slice 의 `CHECKIN_BASELINES` 정규식(`^1 person / \d+ contributions$`)
    // 입력이 어긋나지 않는다.
    const SEED_CONTRIBUTIONS = PRIMARY_CHILDREN + OTHER_CHILDREN;
    // 실측 label — 기존 배선/확정 국면의 `env`(`realdb-contrib-mc`)와 **분리**돼 있어, 향후
    // 체크인될 `baseline-ci-realdb-contribution-read.json` 은 실측 축에만 매달리고 배선/확정
    // 국면의 임시 baseline 파일과 경로가 겹치지 않는다(파일명이 label 에서 파생되기 때문).
    const realClockEnv: BaselineEnvMeta = {
      label: "ci-realdb-contribution-read",
      concurrency: 1,
      dataScale: `1 person / ${SEED_CONTRIBUTIONS} contributions`,
    };
    // candidate 지표 줄의 수치 키(포매터가 고정한 grep 축) — on/off 분기 단언에서 공유한다.
    const METRIC_KEYS = [
      "p50=",
      "p95=",
      "p99=",
      "throughput=",
      "errorRate=",
      "count=",
      "pass=",
    ] as const;

    /** 실 clock 측정(= `now` 미주입) candidate 생산 — 합성 clock 을 쓰지 않는 유일한 국면. */
    const measureRealClock = (
      requestFn: RequestFn,
      iterations: number,
    ): Promise<BaselineReport> =>
      measureBaselineCandidate(requestFn, realClockEnv, { iterations });

    /** 확인 경로 1 회 위임 + 주입 로거 수집(`repoRoot` 생략 — 저장소 실경로 바인딩). */
    const checkWithLogs = (
      candidate: BaselineReport,
      processEnv: Record<string, string | undefined>,
      sink: string[] = [],
    ): { outcome: CheckinBaselineRunOutcome; logs: string[] } => {
      const outcome = checkCheckinBaselineForSpec({
        envMeta: realClockEnv,
        candidate,
        processEnv,
        log: (message) => sink.push(message),
      });
      return { outcome, logs: sink };
    };

    /** 토글 on 주입 record — 전역 환경변수를 세팅/삭제하지 않는다. */
    const enabledEnv = (): Record<string, string | undefined> => ({
      [CHECKIN_BASELINE_ENV_FLAG]: "1",
    });

    // 토글 on 국면의 status 는 **실행 시점 파일 존재 여부**에 달렸다 — baseline 이 체크인되면
    // `compared`, 아직 없으면 `skipped`/`absent` 다. 어느 쪽도 하드코딩하지 않는다.
    const expectEnabledOutcome = (outcome: CheckinBaselineRunOutcome): void => {
      if (outcome.status === "skipped") {
        expect(outcome.reason).toBe("absent");
        return;
      }
      expect(outcome.status).toBe("compared");
    };

    /** `absent` 국면에서만 존재하는 candidate 지표 줄(2 번째 줄)을 꺼낸다. */
    const metricsLineOf = (log: string): string => {
      const lines = log.split("\n");
      expect(lines).toHaveLength(2);
      return lines[1];
    };

    // happy — 실 clock 표본이 확인 경로를 그대로 통과하고 로그가 정확히 1 회 나간다.
    it("happy: 실 clock 측정 candidate 를 토글 on 으로 태우면 예외 0 + 로그 1 회(prefix 고정)", async () => {
      const { primary } = await seed();

      const candidate = await measureRealClock(
        read(qOf(primary)),
        REAL_CLOCK_ITER,
      );
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(logs).toHaveLength(1);
      expect(logs[0].startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      expectEnabledOutcome(outcome);
      // 실 clock 값 자체는 비결정적이라 대소 비교를 하지 않고 표본 수·실 query 발화만 확인한다.
      expect(candidate.count).toBe(REAL_CLOCK_ITER);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(PRIMARY_CHILDREN);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        for (const key of METRIC_KEYS) {
          expect(metrics).toContain(key);
        }
        expect(metrics).toContain(`count=${REAL_CLOCK_ITER}`);
      }
      // 관찰 목적 — 실측 수치 줄을 CI 로그에 남긴다(§Consequences (d) 승인 입력).
      console.log(logs[0]);
      // baseline 이 체크인된 뒤(`compared`)에는 위 로그가 비교 본문만 담아 표본 수가 드러나지
      // 않는다. 다음 slice 의 승인 입력이 되도록 candidate 지표 줄(`count=` 포함)을 분기와
      // 무관하게 한 줄 더 남긴다(T-1593 선례).
      const candidateLine = formatBaselineLine(candidate);
      expect(candidateLine).toContain(`count=${REAL_CLOCK_ITER}`);
      console.log(candidateLine);
    });

    // error (a) — 전량 reject 요청. 실 DB 를 건드리지 않으므로 seed 없이 성립한다.
    it("error (a): 전량 reject 요청의 실측 candidate 도 throw 0 + errorRate=1 · pass=false 전사", async () => {
      const rejecting: RequestFn = async () => {
        throw new Error("realdb-contrib-real-clock-checkin-reject");
      };

      const candidate = await measureRealClock(rejecting, REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      // 임계 위반이 exit code 를 바꾸지 않는다 — 판정은 pass 플래그로만 실린다.
      expect(candidate.errorRate).toBe(1);
      expect(candidate.pass).toBe(false);
      // 전량 실패라 성공 표본은 0 이지만 **시도 표본 수는 20 으로 유지**된다.
      expect(candidate.count).toBe(0);
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        expect(metrics).toContain("errorRate=1");
        expect(metrics).toContain("pass=false");
      }
    });

    // error (b) — **본 route 고유 필수 파라미터 축**. `assessmentId` 가 없으면 전량 400 이라
    // 성공 표본이 0(count=0 · errorRate=1)이지만 확인 경로는 여전히 throw 0 이다.
    it("error (b): assessmentId 누락 실측 candidate 는 전량 400 → count=0 · errorRate=1 이어도 throw 0", async () => {
      await seed();

      const candidate = await measureRealClock(read(""), REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(lastStatus).toBe(400);
      expect(candidate.errorRate).toBe(1);
      expect(candidate.count).toBe(0);
      expect(candidate.pass).toBe(false);
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
    });

    // 분기 (1) — 같은 실측 candidate 를 토글 on / off 로 각각 태워 두 분기를 모두 태운다.
    it("분기 (1): 같은 실측 candidate 가 토글 on 은 다중 줄, off 는 수치 0 개의 한 줄", async () => {
      const { primary } = await seed();
      const candidate = await measureRealClock(
        read(qOf(primary)),
        REAL_CLOCK_ITER,
      );
      // 두 분기 모두 20 표본 candidate 위에서 판정된다(표본 수는 분기와 무관한 축).
      expect(candidate.count).toBe(REAL_CLOCK_ITER);

      const on = checkWithLogs(candidate, enabledEnv());
      expectEnabledOutcome(on.outcome);
      // on 국면은 부재면 candidate 지표 줄, 존재면 비교 본문이 붙어 늘 2 줄 이상이다.
      expect(on.logs[0].split("\n").length).toBeGreaterThanOrEqual(2);

      const off = checkWithLogs(candidate, {});
      expect(off.outcome).toEqual({
        status: "skipped",
        reason: "disabled",
        log: off.logs[0],
      });
      expect(off.logs).toHaveLength(1);
      expect(off.logs[0].split("\n")).toHaveLength(1);
      for (const key of METRIC_KEYS) {
        expect(off.logs[0]).not.toContain(key);
      }
    });

    // 분기 (2) — **3-level FK 부모 선택**(본 slice 고유 축). 부모 A · B 두 실측 candidate 가
    // 둘 다 예외 0 으로 확인 경로를 통과하고, 응답 길이가 5 vs 3 으로 갈려 실 query 발화를
    // 입증한다(합성 표본에서는 관측할 수 없던 축).
    it("분기 (2): 부모 A 5 건 · 부모 B 3 건 두 실측 candidate 가 모두 예외 0 통과", async () => {
      const { primary, other } = await seed();
      expect(PRIMARY_CHILDREN).not.toBe(OTHER_CHILDREN);
      for (const [id, len] of [
        [primary, PRIMARY_CHILDREN],
        [other, OTHER_CHILDREN],
      ] as const) {
        const candidate = await measureRealClock(
          read(qOf(id)),
          REAL_CLOCK_ITER,
        );
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(lastStatus).toBe(200);
        expect(rows()).toHaveLength(len);
        expect(candidate.count).toBe(REAL_CLOCK_ITER);
        expect(candidate.errorRate).toBe(0);
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
      }
    });

    // 표본 수 하한 회귀 가드(T-1593 → T-1600 승계) — REAL_CLOCK_ITER 가 20 미만으로 되돌아가면
    // 여기서 fail 한다. 3 표본 시절의 degenerate p95/p99(= 최댓값 1 개)로의 회귀를 코드 리뷰가
    // 아니라 test 가 막는다(ADR-0056 §Follow-ups (c) 선행 조건 보전).
    it("가드: REAL_CLOCK_ITER 가 하한 20 미만으로 되돌아가면 fail", () => {
      expect(REAL_CLOCK_ITER).toBeGreaterThanOrEqual(REAL_CLOCK_ITER_MIN);
      expect(REAL_CLOCK_ITER_MIN).toBe(20);
      // 반복수는 정수여야 collectLatencySamples 가 RangeError 없이 소비한다.
      expect(Number.isInteger(REAL_CLOCK_ITER)).toBe(true);
    });

    describe("negative cases 충분 cover", () => {
      // (a) 표본 0 — 포매터의 NaN 무가공 전사 계약이 실경로 바인딩 축에서도 성립한다.
      it("(a) iterations: 0 실측 candidate 도 throw 0 + count=0 · NaN 무가공 전사", async () => {
        const { primary } = await seed();
        const candidate = await measureRealClock(read(qOf(primary)), 0);
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(candidate.count).toBe(0);
        expect(Number.isNaN(candidate.p95)).toBe(true);
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
        if (outcome.status === "skipped") {
          const metrics = metricsLineOf(logs[0]);
          expect(metrics).toContain("count=0");
          expect(metrics).toContain("NaN");
        }
      });

      // (b) 반복수 음수 — 측정 helper 가 `RangeError` 를 그대로 전파(재래핑 0)하므로 확인
      // 경로에 **도달하지 못하고** 주입 로거 호출이 0 회다.
      it("(b) iterations: 음수 실측 요청은 RangeError 전파 + 확인 경로 미도달(로거 0 회)", async () => {
        const { primary } = await seed();
        const sink: string[] = [];
        let candidate: BaselineReport | undefined;

        await expect(
          (async () => {
            candidate = await measureRealClock(read(qOf(primary)), -1);
            checkWithLogs(candidate, enabledEnv(), sink);
          })(),
        ).rejects.toBeInstanceOf(RangeError);

        expect(candidate).toBeUndefined();
        expect(sink).toHaveLength(0);
      });

      // (c) **부모 필터의 무-매칭 축** — 존재하지 않는 부모 id 는 404 가 아니라 200 + 빈 배열이라
      // 실패 표본이 0 이다(errorRate=0 · count 는 반복 수 그대로). 400 인 error (b) 와 대조된다.
      it("(c) 존재하지 않는 부모 id 실측 candidate → 200 + 빈 배열, errorRate=0 · count=반복수", async () => {
        await seed();
        const candidate = await measureRealClock(
          read(qOf("no-such-parent")),
          REAL_CLOCK_ITER,
        );
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(lastStatus).toBe(200);
        expect(rows()).toHaveLength(0);
        expect(candidate.errorRate).toBe(0);
        expect(candidate.count).toBe(REAL_CLOCK_ITER);
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
      });
    });
  });
});

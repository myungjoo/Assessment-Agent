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

  // 체크인 baseline 확인 경로의 **실측 clock 관찰 국면**(T-1604, ADR-0056 §Consequences (d) ·
  // §Follow-ups (a) 의 "나머지 route 체크인 baseline" 축을 **네 번째 실 DB route** 로 확산).
  // T-1593(person) → T-1600(assessment) → T-1602(contribution) 의 정본 패턴을 승계하되 route
  // 고유분만 갈아끼운다. 위 배선 suite 는 전부 `createStepClock` 합성 표본이라 CI 로그의
  // candidate 수치가 실 latency 가 아니다. 본 describe 는 **주입 clock 없이**(`now` 미주입)
  // 측정한 candidate 를 같은 확인 경로에 태워, 다음 slice 가 체크인할 baseline 의 승인
  // 입력(실 p50/p95/p99)을 로그로 처음 노출한다. 고유 축은 **`personId` + `period` 2 차
  // 필터** — 앞선 세 route(무-파라미터 목록 · 단일 필터 · 부모 id FK chain)와 달리 같은 부모의
  // 부분집합을 week 3 · month 2 로 잘라 필터 조합의 실 query 영향이 처음 관측된다.
  // `repoRoot` 를 **생략**해 저장소 실경로 바인딩을 타지만 write 국면이 아예 없어(§Decision 2)
  // `test/perf/baselines/` 는 오염되지 않고, 회귀도 관찰만이라 exit code 가 바뀌지 않는다
  // (§Decision 3 (b) — wall-clock 대소 단언 0). 토글은 `processEnv` 주입으로만 제어해 전역
  // `process.env` 를 읽지도 쓰지도 않는다. 실경로 무오염 · 전역 토글 누출 0 · 연속 2 회 호출
  // 부작용 0 · 인증 미부착 401 국면은 배선 suite 와 기존 `negative cases 충분 cover` describe
  // 가 같은 코드 경로로 이미 cover 하므로 재작성하지 않는다(T-1575 선례).
  describe("체크인 baseline 실측 clock 관찰(ci-realdb-summary-read)", () => {
    // 실측 축 전용 반복수 — `ITER` · `WIRING_ITER` 재사용 금지(비용 축과 의미가 다른 상수다,
    // T-1591). T-1593 → T-1600 → T-1602 의 3 → 20 상향 근거·한계·비용을 본 route 로 승계:
    //  (1) 근거 — 표본 3 개면 p95 · p99 가 상위 순위 표본 부재로 사실상 **최댓값 1 개와 동일**
    //      해지고, 공유 runner 의 wall-clock 비결정성(§Decision 3 (b))이 지표를 지배한다.
    //  (2) 한계 — 20 표본에서도 p99 는 상위 1 개 표본 근방이라 **여전히 최댓값에 가깝다**.
    //      p99 안정화에는 다중 run 분포(§Decision 5)가 필요하고, 본 상수는 p50 · p95 의 순위
    //      기반 의미 회복까지가 한계다.
    //  (3) 비용 — 20 회 실 DB 왕복은 guard 통과 + 단일 부모의 소량 row(2 차 필터 포함) 조회
    //      기준 합계 수십 ms 규모라 §Decision 4 의 "CI 비용 증가 사실상 0" 을 유지한다.
    const REAL_CLOCK_ITER = 20;
    // 표본 수 하한(회귀 가드 기준) — 아래 가드 `it` 이 이 값 미만으로의 되돌림을 fail 시킨다.
    const REAL_CLOCK_ITER_MIN = 20;
    // `dataScale` 은 seed 상수에서 **유도**한다(리터럴 손코딩 0) — row 수를 바꿔도 다음 slice
    // 의 `CHECKIN_BASELINES` 정규식(`^1 person / \d+ summaries$`) 입력이 어긋나지 않는다.
    const SEED_SUMMARIES = TOTAL_ROWS;
    // 실측 label — 기존 배선/확정 국면의 `env`(`realdb-summary-mc`)와 **분리**돼 있어 향후
    // 체크인될 `baseline-ci-realdb-summary-read.json` 이 그 임시 baseline 파일과 경로가 겹치지
    // 않는다(파일명이 label 에서 파생되기 때문).
    const realClockEnv: BaselineEnvMeta = {
      label: "ci-realdb-summary-read",
      concurrency: 1,
      dataScale: `1 person / ${SEED_SUMMARIES} summaries`,
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
      const id = await seed();

      const candidate = await measureRealClock(
        read(`?personId=${id}`),
        REAL_CLOCK_ITER,
      );
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(logs).toHaveLength(1);
      expect(logs[0].startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      expectEnabledOutcome(outcome);
      // 실 clock 값 자체는 비결정적이라 대소 비교를 하지 않고 표본 수·실 query 발화만 확인한다.
      expect(candidate.count).toBe(REAL_CLOCK_ITER);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(TOTAL_ROWS);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        for (const key of METRIC_KEYS) {
          expect(metrics).toContain(key);
        }
        expect(metrics).toContain(`count=${REAL_CLOCK_ITER}`);
      }
      // 관찰 목적 — 실측 수치 줄을 CI 로그에 남긴다(§Consequences (d) 승인 입력).
      console.log(logs[0]);
      // 체크인 뒤(`compared`)에는 위 로그가 비교 본문만 담아 표본 수가 안 드러나므로, 분기와
      // 무관하게 candidate 지표 줄(`count=` 포함)을 한 줄 더 남긴다(T-1593 선례).
      const candidateLine = formatBaselineLine(candidate);
      expect(candidateLine).toContain(`count=${REAL_CLOCK_ITER}`);
      console.log(candidateLine);
    });

    // error (a) — 전량 reject 요청. 실 DB 를 건드리지 않으므로 seed 없이 성립한다.
    it("error (a): 전량 reject 요청의 실측 candidate 도 throw 0 + errorRate=1 · pass=false 전사", async () => {
      const rejecting: RequestFn = async () => {
        throw new Error("realdb-summary-real-clock-checkin-reject");
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

    // error (b) — **본 route 고유 필수 파라미터 축**. `personId` 가 없으면 전량 400 이라
    // 성공 표본이 0(count=0 · errorRate=1)이지만 확인 경로는 여전히 throw 0 이다.
    it("error (b): personId 누락 실측 candidate 는 전량 400 → count=0 · errorRate=1 이어도 throw 0", async () => {
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
      const id = await seed();
      const candidate = await measureRealClock(
        read(`?personId=${id}`),
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

    // 분기 (2) — **`period` 2 차 필터**(본 slice 고유 축). 같은 부모의 부분집합을 자르는 두
    // 실측 candidate 가 둘 다 예외 0 으로 통과하고 응답 길이가 3 vs 2 로 갈려 필터의 실 query
    // 발화를 입증한다(합성 표본에서는 관측할 수 없던 축).
    it("분기 (2): period=week 3 건 · period=month 2 건 두 실측 candidate 가 모두 예외 0 통과", async () => {
      const id = await seed();
      expect(WEEK_ROWS).not.toBe(MONTH_ROWS);
      for (const [period, len] of [
        ["week", WEEK_ROWS],
        ["month", MONTH_ROWS],
      ] as const) {
        const candidate = await measureRealClock(
          read(`?personId=${id}&period=${period}`),
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

    // 표본 수 하한 회귀 가드(T-1593 → T-1600 → T-1602 승계) — 20 미만으로의 되돌림을 여기서
    // fail 시켜 3 표본 시절의 degenerate p95/p99(= 최댓값 1 개) 회귀를 코드 리뷰가 아니라
    // test 가 막는다(ADR-0056 §Follow-ups (c) 선행 조건 보전).
    it("가드: REAL_CLOCK_ITER 가 하한 20 미만으로 되돌아가면 fail", () => {
      expect(REAL_CLOCK_ITER).toBeGreaterThanOrEqual(REAL_CLOCK_ITER_MIN);
      expect(REAL_CLOCK_ITER_MIN).toBe(20);
      // 반복수는 정수여야 collectLatencySamples 가 RangeError 없이 소비한다.
      expect(Number.isInteger(REAL_CLOCK_ITER)).toBe(true);
    });

    describe("negative cases 충분 cover", () => {
      // (a) 표본 0 — 포매터의 NaN 무가공 전사 계약이 실경로 바인딩 축에서도 성립한다.
      it("(a) iterations: 0 실측 candidate 도 throw 0 + count=0 · NaN 무가공 전사", async () => {
        const id = await seed();
        const candidate = await measureRealClock(read(`?personId=${id}`), 0);
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
        const id = await seed();
        const sink: string[] = [];
        let candidate: BaselineReport | undefined;

        await expect(
          (async () => {
            candidate = await measureRealClock(read(`?personId=${id}`), -1);
            checkWithLogs(candidate, enabledEnv(), sink);
          })(),
        ).rejects.toBeInstanceOf(RangeError);

        expect(candidate).toBeUndefined();
        expect(sink).toHaveLength(0);
      });

      // (c) **2 차 필터 이전 단계의 무-매칭 축** — 존재하지 않는 personId 는 404 가 아니라
      // 200 + 빈 배열이라 실패 표본이 0 이다(errorRate=0 · count=반복수). 400 인 (b) 와 대조.
      it("(c) 매칭 0 건 personId 실측 candidate → 200 + 빈 배열, errorRate=0 · count=반복수", async () => {
        await seed();
        const candidate = await measureRealClock(
          read("?personId=no-such-person"),
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

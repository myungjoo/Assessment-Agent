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
// 주입 monotonic clock 은 공유 helper 위임(T-1581 승격) — 실 HTTP 왕복 지연이 섞여도 표본이
// 결정론적이라 배선 국면에 wall-clock 대소 단언이 0 이다.
import { createStepClock } from "./step-clock";

jest.setTimeout(120_000);

const ROOT = "/api";
const MISSING = "/api/no-such-route"; // 인접 미매칭 경로 — `getRoot()` 자체엔 예외 경로가 없다.
const ITER = { iterations: 4 }; // 실 부트스트랩 반복이라 소규모(4 회) 고정.
// 체크인 배선 국면용 반복수 — 국면 10 개가 각각 측정을 태우므로 실 부트스트랩 비용을 감안해 2 회로
// 더 줄인다(표본은 주입 clock 으로 결정론화하므로 반복수는 비용 변수일 뿐이다).
const WIRING_ITER = 2;

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

  // 체크인(repo 안 commit) baseline 확인 배선 — ADR-0056 §Follow-ups (b) 의 실 DB **네 번째**
  // 소비자(T-1576 summary · T-1577 assessment · T-1578 contribution realdb 에 이어 **guard 0 ·
  // DB 미접촉** route 로 확산 — seed · 인증 쿠키에 의존하지 않는 환경에서도 배선이 동일하게
  // 동작함을 본 slice 가 처음 관측한다). 배선 국면 10 개(happy 3 · error 2 · 분기 2 ·
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
    // 측정은 collector 위임(주입 clock 으로 결정론화) — 본 route 는 guard 0 · DB 미접촉이라
    // cookie 미부착 `GET /api` 를 그대로 태운다(200 + 상수 문자열 · errorRate 0). DB 를 타지
    // 않으므로 기존 국면의 `prisma.user.count()` · truncate 대조 단언에 간섭하지 않는다.
    measure: (stepMs) =>
      measureBaselineCandidate(read(), env, {
        iterations: WIRING_ITER,
        now: createStepClock(stepMs),
      }),
    // 임시 repo root — 체크인 baseline 파일은 매 test 격리 tmpRoot 아래에만 만든다(실경로 무오염).
    tempDir: (name) => dirOf(name),
  });

  // 체크인 baseline 확인 경로의 **실측 clock 관찰 국면**(T-1606, ADR-0056 §Consequences (d) ·
  // §Follow-ups (a) 의 "나머지 route 체크인 baseline" 축을 **다섯 번째이자 마지막
  // measure→confirm 실 DB route** 로 확산). T-1593(person) → T-1600(assessment) →
  // T-1602(contribution) → T-1604(summary) 의 정본 패턴을 승계하되 route 고유분만 갈아끼운다.
  // 위 배선 suite 는 전부 `createStepClock` 합성 표본이라 CI 로그의 candidate 수치가 실 latency 가
  // 아니다. 본 describe 는 **주입 clock 없이**(`now` 미주입) 측정한 candidate 를 같은 확인 경로에
  // 태워, 다음 slice 가 체크인할 baseline 의 승인 입력(실 p50/p95/p99)을 로그로 처음 노출한다.
  // 고유 축은 **DB 미접촉 floor** — 앞선 네 route 가 전부 DB 조회인 반면 `GET /api` 는 고정 상수를
  // 동기 반환하므로 본 국면의 실측 줄은 framework + HTTP 왕복만의 하한이고, 사람이 앞선 네 route
  // 의 실측 p95 에서 인프라 하한을 빼서 읽는 유일한 기준선이 된다. 부수적으로 guard 가 없는
  // route(쿠키 미부착도 변조 쿠키도 200)에서 확인 경로가 동일하게 동작함을 처음 관측한다.
  // `repoRoot` 를 **생략**해 저장소 실경로 바인딩을 타지만 write 국면이 아예 없어(§Decision 2)
  // `test/perf/baselines/` 는 오염되지 않고, 회귀도 관찰만이라 exit code 가 바뀌지 않는다
  // (§Decision 3 (b) — wall-clock 대소 단언 0). 토글은 `processEnv` 주입으로만 제어해 전역
  // `process.env` 를 읽지도 쓰지도 않는다. 실경로 무오염 · 전역 토글 누출 0 · 연속 2 회 호출
  // 부작용 0 · `POST /api` 404 국면은 배선 suite 와 기존 `negative cases 충분 cover` describe 가
  // 같은 코드 경로로 이미 cover 하므로 재작성하지 않는다(T-1575 선례).
  describe("체크인 baseline 실측 clock 관찰(ci-realdb-app-root-read)", () => {
    // 실측 축 전용 반복수 — `ITER`(4) · `WIRING_ITER`(2) 재사용 금지(비용 축과 의미가 다른
    // 상수다, T-1591). T-1593 → T-1600 → T-1602 → T-1604 의 3 → 20 상향 근거·한계·비용 승계:
    //  (1) 근거 — 표본 3 개면 p95 · p99 가 상위 순위 표본 부재로 사실상 **최댓값 1 개와 동일**
    //      해지고, 공유 runner 의 wall-clock 비결정성(§Decision 3 (b))이 지표를 지배한다.
    //  (2) 한계 — 20 표본에서도 p99 는 상위 1 개 표본 근방이라 **여전히 최댓값에 가깝다**.
    //      p99 안정화에는 다중 run 분포(§Decision 5)가 필요하고, 본 상수는 p50 · p95 의 순위
    //      기반 의미 회복까지가 한계다.
    //  (3) 비용 — 본 route 는 DB 를 전혀 타지 않아 20 회 왕복이 앞선 네 route 보다도 싸다(합계
    //      수 ms~수십 ms 규모) — §Decision 4 의 "CI 비용 증가 사실상 0" 을 그대로 유지한다.
    const REAL_CLOCK_ITER = 20;
    // 표본 수 하한(회귀 가드 기준) — 아래 가드 `it` 이 이 값 미만으로의 되돌림을 fail 시킨다.
    const REAL_CLOCK_ITER_MIN = 20;
    // 본 route 가 조회로 건드리는 도메인 row 수 — 요청 경로가 DB 를 전혀 타지 않아 **0** 이다.
    // 같은 표기를 국면마다 손으로 반복하지 않도록 이 상수 1 개에서 `dataScale` 을 조립한다.
    const DB_ROWS_TOUCHED = 0;
    // 실측 label — 기존 배선/확정 국면의 `env`(`realdb-app-root-mc`)와 **분리**돼 있어 향후
    // 체크인될 `baseline-ci-realdb-app-root-read.json` 이 그 임시 baseline 파일과 경로가 겹치지
    // 않는다(파일명이 label 에서 파생되기 때문).
    const realClockEnv: BaselineEnvMeta = {
      label: "ci-realdb-app-root-read",
      concurrency: 1,
      dataScale: `${DB_ROWS_TOUCHED} rows / no db access`,
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
      const candidate = await measureRealClock(read(), REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(logs).toHaveLength(1);
      expect(logs[0].startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      expectEnabledOutcome(outcome);
      // 실 clock 값 자체는 비결정적이라 대소 비교를 하지 않고 표본 수·실 HTTP 왕복만 확인한다.
      expect(candidate.count).toBe(REAL_CLOCK_ITER);
      expect(lastStatus).toBe(200);
      expect(lastText).toBe(APP_STATUS_MESSAGE); // 리터럴 복제 0 — 상수를 import 해 쓴다.
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

    // error (a) — 전량 reject 요청. 실 DB 도 실 route 도 건드리지 않는 순수 실패 축이다.
    it("error (a): 전량 reject 요청의 실측 candidate 도 throw 0 + errorRate=1 · pass=false 전사", async () => {
      const rejecting: RequestFn = async () => {
        throw new Error("realdb-app-root-real-clock-checkin-reject");
      };

      const candidate = await measureRealClock(rejecting, REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      // 임계 위반이 exit code 를 바꾸지 않는다 — 판정은 pass 플래그로만 실린다.
      expect(candidate.errorRate).toBe(1);
      expect(candidate.pass).toBe(false);
      expect(candidate.count).toBe(0); // 전량 실패라 성공 표본 0.
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        expect(metrics).toContain("errorRate=1");
        expect(metrics).toContain("pass=false");
      }
    });

    // error (b) — **본 route 의 유일한 오류 축**. `getRoot()` 자체엔 예외 경로가 없어 인접
    // 미매칭 경로(전량 404)가 실패 표본을 만드는 유일한 수단이다.
    it("error (b): 인접 미매칭 경로 실측 candidate 는 전량 404 → count=0 · errorRate=1 이어도 throw 0", async () => {
      const candidate = await measureRealClock(read(MISSING), REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(lastStatus).toBe(404);
      expect(candidate.errorRate).toBe(1);
      expect(candidate.count).toBe(0);
      expect(candidate.pass).toBe(false);
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
      if (outcome.status === "skipped") {
        expect(metricsLineOf(logs[0])).toContain("count=0"); // 무가공 전사.
      }
    });

    // 분기 (1) — 같은 실측 candidate 를 토글 on / off 로 각각 태워 두 분기를 모두 태운다.
    it("분기 (1): 같은 실측 candidate 가 토글 on 은 다중 줄, off 는 수치 0 개의 한 줄", async () => {
      const candidate = await measureRealClock(read(), REAL_CLOCK_ITER);
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

    // 분기 (2) — **DB 미접촉 floor 축**(본 slice 고유). actor 까지 전량 비운 상태와 비우기 전
    // 상태 양쪽에서 실측 candidate 를 태워, 실측 표본이 DB 상태에 무의존함을 직접 보인다.
    // wall-clock 값끼리의 대소는 단언하지 않는다(§Decision 3 (b)).
    it("분기 (2): truncate 전/후 두 실측 candidate 가 모두 예외 0 · errorRate=0 · 응답 불변", async () => {
      for (const emptyDb of [false, true] as const) {
        if (emptyDb) {
          await truncateAll(prisma); // actor 까지 사라진다(afterEach 가 복원).
          expect(await prisma.user.count()).toBe(0);
        }
        const candidate = await measureRealClock(read(), REAL_CLOCK_ITER);
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(candidate.count).toBe(REAL_CLOCK_ITER);
        expect(candidate.errorRate).toBe(0);
        expect(lastStatus).toBe(200);
        expect(lastText).toBe(APP_STATUS_MESSAGE); // 빈 DB 에서도 불변.
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
      }
    });

    // 표본 수 하한 회귀 가드(T-1593 → T-1600 → T-1602 → T-1604 승계) — 20 미만으로의 되돌림을
    // 여기서 fail 시켜 3 표본 시절의 degenerate p95/p99(= 최댓값 1 개) 회귀를 코드 리뷰가
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
        const candidate = await measureRealClock(read(), 0);
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
        const sink: string[] = [];
        let candidate: BaselineReport | undefined;

        await expect(
          (async () => {
            candidate = await measureRealClock(read(), -1);
            checkWithLogs(candidate, enabledEnv(), sink);
          })(),
        ).rejects.toBeInstanceOf(RangeError);

        expect(candidate).toBeUndefined();
        expect(sink).toHaveLength(0);
      });

      // (c) **guard 0 route 의 정반대 negative** — 변조 토큰 쿠키를 붙여도 검증 자체가 일어나지
      // 않아 401/403 이 아니라 200 이고, 확인 경로도 cookie 미부착 국면과 동일하게 통과한다.
      it("(c) 변조 토큰 쿠키 실측 candidate → 401/403 이 아니라 200, errorRate=0 · count=반복수", async () => {
        const candidate = await measureRealClock(
          read(ROOT, tamperedCookie),
          REAL_CLOCK_ITER,
        );
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(lastStatus).toBe(200);
        expect(lastStatus).not.toBe(401);
        expect(lastStatus).not.toBe(403);
        expect(lastText).toBe(APP_STATUS_MESSAGE);
        expect(candidate.errorRate).toBe(0);
        expect(candidate.count).toBe(REAL_CLOCK_ITER);
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
      });
    });
  });
});

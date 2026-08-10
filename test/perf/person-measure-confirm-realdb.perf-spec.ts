// person-measure-confirm-realdb.perf-spec.ts — S2 measure→confirm-or-compare loop 의 실 DB
// round-trip **slice 29**. (T-1557, load-resilience-test-plan §5 item 5 / REQ-048 p95 < 3s)
// 고유 축 ① **guard 미부착 × DB 접촉 조합의 첫 baseline 확정** — slice 25~27 은 guard 통과 + 실
// Prisma 왕복, slice 28 은 guard 미부착 + **DB 미접촉** 이었다. `PersonController` 는 guard 가
// 없으면서 `findActive()` 가 실 SELECT 를 발화하므로 본 baseline 은 **인증 layer 노이즈 0 인
// 상태의 순수 DB 왕복 몫** 을 담아 slice 28 의 framework-only 하한과 대조된다. 고유 축 ②
// **soft-delete 필터가 결과 집합을 좁히는 route 위의 첫 measure→confirm** — active 와 inactive 를
// **서로 다른 개수** 로 섞어 seed 하고 established · compared 두 국면 모두에서 응답 길이가
// **active 수와 정확히 일치** 함으로 실 query 발화와 필터 분해력을 함께 입증한다. 고유 축 ③
// **mock measure→confirm 짝이 없는 첫 실 DB baseline** — 본 route 에는 top loop 을 태운 판본이
// mock 에도 실 DB 에도 없었다(축은 mock 짝 개수에 종속되지 않는다). 구조 골격 · helper 는 slice
// 28 · 25 를 cross-ref 로 승계하며(문구 복제 0) **wall-clock 대소도 `comparison.regressed` 값도
// 단언하지 않는다**(T-0877/T-0880 flaky 사고 재발 차단 — 관찰 기록만). baseline 은 **임시
// 디렉토리 1 회성** 이라 저장소 오염 0 이며 체크인 기준 baseline · CI job 편입 · 임계 fix 는
// **미착수 그대로** 다. 계수·범위 경계는 README 의 slice 29 bullet 참조.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { buildAuthCookie } from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

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

const LIST = "/api/persons";
const MISSING = "/api/persons/no-such-person-id"; // findById null → NotFoundException(404).
const ACTIVE_ROWS = 3; // active 와 inactive 를 **서로 다른 개수** 로 둬 필터 분해력을 노출한다.
const INACTIVE_ROWS = 2;
const ITER = { iterations: 4 }; // 실 부트스트랩 반복이라 소규모(4 회) 고정.
// 서명이 깨진 변조 토큰 — guard 가 없어 검증 자체가 일어나지 않음을 보이는 negative 재료.
const TAMPERED = buildAuthCookie("tampered.jwt.value");

describe("S2 measure→confirm-or-compare perf-spec — 실 DB baseline 확정·비교 (GET /api/persons, guard 미부착 + soft-delete 필터, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lastBody: unknown;
  let lastStatus = 0;
  let tmpRoot: string; // 매 test 격리 임시 baseline 루트(afterEach 재귀 삭제 — repo 오염 0).
  const env: BaselineEnvMeta = { label: "realdb-person-mc", concurrency: 1 };

  beforeAll(async () => {
    // mock override 0 · guard override 0 — 실 AppModule 부트스트랩. 본 route 는 guard 가 없어
    // 인증 helper 부트스트랩이 불요하다(slice 1 과 동일한 `createE2EApp` 경로).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    await truncateAll(prisma);
  });
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-person-mc-realdb-"));
  });
  afterEach(async () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  /** tmpRoot 하위 POSIX 결합 baseDir(`resolveBaselinePath` 와 동일 정규화). */
  const dirOf = (seg: string): string =>
    path.posix.join(tmpRoot.split(path.sep).join("/"), seg);

  // active / inactive 를 한 번에 seed. `active:false` 는 `findActive()` 가 배제한다(REQ-026).
  const seed = async (
    active = ACTIVE_ROWS,
    inactive = INACTIVE_ROWS,
  ): Promise<void> => {
    const make = (n: number, on: boolean) =>
      Array.from({ length: n }, (_, i) => ({
        fullName: `실DB인원-${on ? "A" : "I"}-${i}`,
        email: `pmc-${on ? "a" : "i"}-${i}@example.test`,
        active: on,
      }));
    const data = make(active, true).concat(make(inactive, false));
    if (data.length > 0) await prisma.person.createMany({ data });
  };

  // 조회 1 회. `jar` 가 null 이면 Cookie 미부착(guard 가 없어 결과가 같아야 한다).
  const read =
    (target = LIST, jar: string | null = null): RequestFn =>
    async () => {
      const r = request(app.getHttpServer()).get(target);
      const res = await (jar === null ? r : r.set("Cookie", jar));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const rows = (): unknown[] => lastBody as unknown[];

  /** measure→confirm loop 1 회 — env 고정, measure 옵션만 주입(재구현 0, 조립만). */
  const run = (req: RequestFn, dir: string, m: MeasureBaselineOpts = ITER) =>
    measureAndConfirmBaseline(req, env, dir, { measure: m });

  /** established 단언 + 확정 파일 실 존재·round-trip 로드 + 관찰 한 줄 기록. */
  const established = (
    r: ConfirmOrCompareResult,
    dir: string,
  ): BaselineReport => {
    expect(r.outcome).toBe("established");
    if (r.outcome !== "established") throw new Error("established 분기 아님");
    expect(r.path).toBe(resolveBaselinePath(env, dir));
    expect(fs.existsSync(r.path)).toBe(true);
    const report = parseBaselineReport(fs.readFileSync(r.path, "utf-8"));
    console.log(`[T-1557 관찰] ${formatBaselineLine(report)}`); // 관찰 기록만(단언 0).
    return report;
  };

  it("happy ①(established): 기준 부재 baseDir → 확정 write + count=반복수·errorRate=0·pass, 200 + 길이=active 수", async () => {
    await seed();
    const dir = dirOf("baselines");
    const b = established(await run(read(), dir), dir);
    expect(b.count).toBe(ITER.iterations);
    expect(b.errorRate).toBe(0);
    expect(b.pass).toBe(true);
    expect(b.p95).toBeLessThan(3000); // REQ-048 임계 — 기본 표본 pass.
    expect(b.env).toEqual(env);
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(ACTIVE_ROWS); // 실 SELECT 발화의 증거.
  });
  it("happy ②(compared): 같은 baseDir 재호출 → 지표 5 키·report 산출(regressed 값은 미단언)", async () => {
    await seed();
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
    expect(r.report).toContain("regressed=");
    expect(lastStatus).toBe(200);
  });
  // 본 slice 고유 축 ② — 국면 분기 판정은 baseline 파일 존재 여부라 latency 무의존이다.
  it("분기 ⓐ(soft-delete 필터 대조): established·compared 두 국면 모두 길이=active 수, DB 에는 inactive 잔존", async () => {
    await seed();
    const dir = dirOf("baselines");
    established(await run(read(), dir), dir);
    expect(rows()).toHaveLength(ACTIVE_ROWS);
    expect((await run(read(), dir)).outcome).toBe("compared");
    expect(lastStatus).toBe(200);
    expect(rows()).toHaveLength(ACTIVE_ROWS); // inactive 는 두 국면 모두 0 건 노출.
    // 응답이 좁은 것은 삭제가 아니라 `active` 필터 때문임을 실 row 수로 확인.
    expect(await prisma.person.count()).toBe(ACTIVE_ROWS + INACTIVE_ROWS);
  });
  // 주입 임계 `p95MaxMs: 0` 은 실 측정 시간에 무의존한 결정론적 fail 분기(임계값 자체는 불변).
  it("분기 ⓑ(임계 fail 주입): p95MaxMs=0 → pass=false candidate 도 throw 없이 확정 write", async () => {
    await seed();
    const dir = dirOf("strict");
    const o = { ...ITER, thresholds: { p95MaxMs: 0 } };
    const b = established(await run(read(), dir, o), dir);
    expect(b.pass).toBe(false);
    expect(b.errorRate).toBe(0);
  });
  // measure→confirm 순서 계약상 measure 실패 시 write 부작용 0(임시 루트 파일 0 개).
  it("error path (a): baseDir 공백-only → RangeError, 임시 루트에 파일 0 개 생성", async () => {
    await seed();
    await expect(run(read(), "   ")).rejects.toThrow(RangeError);
    expect(fs.readdirSync(tmpRoot)).toHaveLength(0);
  });
  it("error path (b): 확정된 baseline JSON 손상 후 재호출 → SyntaxError 전파", async () => {
    await seed();
    const dir = dirOf("baselines");
    established(await run(read(), dir), dir);
    fs.writeFileSync(resolveBaselinePath(env, dir), "{not-json", "utf-8");
    await expect(run(read(), dir)).rejects.toThrow(SyntaxError);
  });

  describe("negative cases 충분 cover", () => {
    // (a) slice 25~27 과 **정반대** — cookie 가 없어도 401 이 아니라 200 이다(guard 미부착).
    //     단 slice 28 과 달리 요청 경로가 실 DB 를 탄다.
    it("(a) cookie 미부착 → 401 이 아니라 200, 표본 정상 수집(errorRate=0·count=반복수)", async () => {
      await seed();
      const dir = dirOf("baselines");
      const b = established(await run(read(LIST, null), dir), dir);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(401);
      expect(b.errorRate).toBe(0);
      expect(b.count).toBe(ITER.iterations);
      expect(rows()).toHaveLength(ACTIVE_ROWS);
    });
    it("(b) 변조 토큰 쿠키 부착 → 401/403 이 아니라 200 + 응답 길이 불변", async () => {
      await seed();
      const dir = dirOf("tampered");
      const b = established(await run(read(LIST, TAMPERED), dir), dir);
      expect(b.errorRate).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(403);
      expect(rows()).toHaveLength(ACTIVE_ROWS); // 무-cookie 판본과 같은 길이.
    });
    // (c) 경계값 — 전량 inactive 면 404 가 아니라 200 + 빈 배열(필터가 전량 배제).
    it("(c) 전량 inactive seed → 404 가 아니라 200 + 빈 배열, DB row 는 잔존", async () => {
      await seed(0, 4);
      const dir = dirOf("inactive");
      const b = established(await run(read(), dir), dir);
      expect(lastStatus).toBe(200);
      expect(lastStatus).not.toBe(404);
      expect(rows()).toHaveLength(0);
      expect(b.errorRate).toBe(0);
      expect(await prisma.person.count()).toBe(4);
    });
    it("(d) 미존재 id 상세 반복 → 전부 404(500 아님)·성공 표본 0·errorRate=1, 200 혼합 → 0<er<1", async () => {
      await seed();
      const nd = dirOf("missing");
      const b = established(await run(read(MISSING), nd), nd);
      expect(lastStatus).toBe(404);
      expect(lastStatus).not.toBe(500);
      expect(b.errorRate).toBe(1);
      expect(b.count).toBe(0);
      expect(b.pass).toBe(false);
      let call = 0; // 홀수 번째는 실 200 목록, 짝수 번째는 404 상세 → errorRate 0.5.
      const mixed: RequestFn = async () =>
        (call += 1) % 2 === 1 ? read()() : read(MISSING)();
      const dir = dirOf("mixed");
      const half = established(await run(mixed, dir), dir);
      expect(half.errorRate).toBeGreaterThan(0);
      expect(half.errorRate).toBeLessThan(1);
    });
    // (e) 빈 결과 집합이 국면 도달을 막지 않음 — truncate 직후에도 compared 로 간다.
    it("(e) truncateAll 직후 재측정 → 빈 배열인데도 compared 도달 + 200 유지", async () => {
      await seed();
      const dir = dirOf("baselines");
      const short = { iterations: 2 };
      established(await run(read(), dir, short), dir);
      expect(rows()).toHaveLength(ACTIVE_ROWS);
      await truncateAll(prisma);
      const after = await run(read(), dir, short);
      expect(after.outcome).toBe("compared");
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(0);
    });
  });
});

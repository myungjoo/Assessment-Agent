// app-root-measure-confirm.perf-spec.ts — S2 measure→confirm-or-compare top-of-pyramid
// loop(`measureAndConfirmBaseline`)를 **실 NestJS supertest 요청 + 실 파일시스템 baseline
// round-trip** 에 배선한 *첫 fs+HTTP 통합 perf-spec*.
// (T-0877, load-resilience-test-plan §5 follow-up #2 / REQ-048 조회 p95 < 3s)
//
// 목적: T-0828~T-0876 slice 들이 순수 primitive(percentile/summarizeLatency/errorRate)·
// collector orchestration(collectLatencySamples/assertS2Threshold)·candidate 생산
// (measureBaselineCandidate)·candidate 소비(confirmOrCompareBaseline)·top loop
// (measureAndConfirmBaseline)의 pyramid 를 모두 main 에 안착시켰다. 그러나 그 pyramid 는
// 지금까지 **전부 주입 fake RequestFn + 임시-dir 격리 단위 spec** 으로만 검증됐다 —
// top loop `measureAndConfirmBaseline` 을 **실 NestJS supertest app 요청**
// (`() => request(app.getHttpServer()).get("/api")`)과 **실 파일시스템 baseline round-trip**
// 에 배선한 통합 perf-spec 이 아직 하나도 없다. §5 #2 가 요구하는 "실 supertest measure
// harness" 의 첫 fs+HTTP 통합 조각이 바로 본 spec 이다.
//
// floor case 선택 근거(가장 단순한 read — collector 배선의 하한):
//   - `AppController` health-read(`GET /api`)는 guard 미적용·path/query param 0·service 는
//     `getStatus()` 동기 상수(200 고정 문자열)만 forward 하며 예외 경로가 없다(기존
//     app-root-read.perf-spec.ts T-0859 가 배선한 최단 read). 실 latency 표본은 wall-clock
//     이라 값 자체는 비결정적이지만, 상수 동기 반환은 즉시 반환하므로 p95 는 항상 임계
//     (3000ms) 훨씬 아래 → established/compared 기본 경로는 결정론적으로 도달한다.
//
// 앞선 app-root-read.perf-spec.ts(T-0859)와의 결정적 차이(본 spec 고유 특성):
//   - T-0859 는 `collectLatencySamples`/`assertS2Threshold` 를 **개별 배선**해 in-memory
//     표본만 검증했다. 본 spec 은 그 둘 위에 얹힌 **top loop `measureAndConfirmBaseline`**
//     한 줄로 measure→(최초 확정 write | 로드·비교) 전체 loop 를 실 실행하며, **임시
//     baseDir 에 baseline JSON 을 실 write/read 하는 fs round-trip** 을 처음으로 태운다.
//   - established(1회차 write) / compared(2회차 read·compare) **두 국면 양쪽**을 실 HTTP
//     요청·실 fs 위에서 실증한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `AppService` 는 mock(`useValue`) — `getStatus` 는 mockReturnValue 로 고정 문자열을
//     결정론적으로 반환한다. guard 미적용 controller 라 `overrideGuard` 불요.
//   - 실 latency 는 wall-clock 이라 비결정적이므로, established/compared **분기 도달 판정**
//     자체는 요청 결과(2xx errorRate 0)·baseline 존재 여부로 결정론적이며, 회귀 판정
//     비교 동치는 주입 monotonic clock(`opts.measure.now`)으로 결정론화한다.
//   - 실패(non-2xx) 분기는 요청 wrapper 레벨에서 인위 non-2xx status(503)를 주입해
//     `measureAndConfirmBaseline` 이 errorRate 위반 candidate 를 established write 하는
//     (throw 없이) 경로를 커버한다(getRoot 자체는 예외 경로가 없음).
//
// 위임·부작용 격리(DRY):
//   - measure·확정·비교·write·로드·round-trip 로직은 전적으로 `measureAndConfirmBaseline`
//     (→ `measureBaselineCandidate` + `confirmOrCompareBaseline`)에 위임한다(재구현 0).
//     collector/io/baseline 모듈 `.ts` 파일은 수정하지 않고 import·호출만 한다.
//   - baseDir 는 테스트 격리 임시 디렉토리(`fs.mkdtemp` beforeEach 생성 + afterEach
//     `fs.rm(recursive)` 정리)라 실 repo 파일을 오염시키지 않는다.
//   - `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
//     로만 실행된다(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0).
//
// 관찰·리포트 전용:
//   - `measureAndConfirmBaseline` 자체는 회귀/임계를 throw 하지 않고 `ConfirmOrCompareResult`
//     판별 union 만 반환한다. S2 pass/fail·회귀 강제는 본 spec 의 `expect` 가 반환 union 을
//     검사해 수행한다(harness 는 관찰만).
//
// Out of Scope (task §Out of Scope 정합):
//   - 다른 endpoint(person/group/assessment 등) 배선 / write route perf / CI job 편입(§5 #4) /
//     실 baseline JSON repo 체크인(§5 #5) / 실 Postgres·LLM round-trip / 병렬·동시성 request /
//     collector·io·baseline 모듈 함수 재수정. 본 spec 은 floor case `GET /api` 1개만 top loop
//     에 태운 첫 통합 배선이며, 실 app 부트스트랩 + 임시 baseDir 격리 + loop 호출 + expect 만
//     책임진다.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppController } from "../../src/app.controller";
import { AppService } from "../../src/app.service";

import {
  type BaselineEnvMeta,
  parseBaselineReport,
  resolveBaselinePath,
} from "./latency-baseline";
import {
  measureAndConfirmBaseline,
  measureBaselineCandidate,
  type RequestFn,
} from "./latency-collector";

// mock AppService — getRoot 경로가 실제 호출하는 것은 `getStatus` 뿐. 예외 경로가 없는 순수
// 동기 반환이라 mockReturnValue 로 고정 문자열을 결정론적으로 돌려준다.
type MockAppService = {
  getStatus: jest.Mock;
};

describe("S2 measure→confirm-or-compare perf-spec — AppController health-read(GET /api) 실 supertest + fs baseline round-trip 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockAppService;

  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  /** 결정론 env-meta fixture(label/concurrency 고정 → 파일명 slug 결정적). */
  const env: BaselineEnvMeta = { label: "ci-app-root", concurrency: 1 };

  beforeAll(async () => {
    service = {
      getStatus: jest.fn(),
    };

    // AppController 는 guard 미적용 controller 라 `overrideGuard` 가 불요하다
    // (person-read/group-read 처럼 순수 부트스트랩 — 벗길 인증/인가 layer 자체가 없다).
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 기본 정상 반환 — 실 GET /api 요청이 200 고정 문자열을 받도록.
    service.getStatus.mockReturnValue("Assessment-Agent");
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-app-root-mc-"));
  });

  afterEach(() => {
    // 임시 baseDir 를 재귀 삭제해 spec 간 격리·실 repo 미오염 보장.
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  // 실 health endpoint(`GET /api`)를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로
  // 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api");
    return { status: res.status };
  };

  // 인위 non-2xx 를 주입하는 요청 wrapper — getRoot 는 예외 경로가 없는 순수 동기 반환이라
  // (항상 200), errorRate 위반(pass=false) candidate 경로를 실증하려면 요청 함수 레벨에서
  // non-2xx status 를 직접 반환해야 한다(controller 를 실제로 호출하지 않고 status 만 fabricate).
  const injectStatus =
    (status: number): RequestFn =>
    async () => ({ status });

  // 주입 monotonic clock — 회귀 판정 비교 동치를 결정론화한다(수동 조립과 대조용). 홀수번째
  // (start)는 값만, 짝수번째(end)에서 stepMs 만큼 진행(collector spec 의 stepClock 관용구).
  function stepClock(stepMs: number): () => number {
    let t = 0;
    let call = 0;
    return () => {
      const v = t;
      call++;
      if (call % 2 === 1) {
        return v;
      }
      t += stepMs;
      return t;
    };
  }

  describe("happy path — established(최초 확정 write) / compared(로드·비교) 양 분기 실 실행", () => {
    it("(a) established — 빈 baseDir 첫 호출 → outcome=established + path, baseline JSON 실 write(round-trip 동치, 실 GET /api 200 반영)", async () => {
      const baseDir = baselineDir("baselines");
      const req = jest.fn(readRequest);
      const iterations = 3;

      const result = await measureAndConfirmBaseline(req, env, baseDir, {
        measure: { iterations },
      });

      // 실 GET /api 200 응답이 iterations 만큼 measure 에 반영됨(errorRate 0, count>0).
      expect(req).toHaveBeenCalledTimes(iterations);
      expect(service.getStatus).toHaveBeenCalledTimes(iterations);

      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        // established 분기는 임시 baseDir 에 baseline JSON 을 실제로 write 한다.
        expect(result.path).toBe(resolveBaselinePath(env, baseDir));
        expect(fs.existsSync(result.path)).toBe(true);
        // 디스크 파일을 parseBaselineReport 로 로드하면 유효 candidate 이고, 실 200 응답이
        // 반영돼 errorRate 0·count>0·pass=true(p95 상수 반환이라 임계 훨씬 아래).
        const persisted = parseBaselineReport(
          fs.readFileSync(result.path, "utf-8"),
        );
        expect(persisted.errorRate).toBe(0);
        expect(persisted.count).toBe(iterations);
        expect(persisted.pass).toBe(true);
        expect(persisted.env).toEqual(env);
      }
    });

    it("(b) compared — 같은 baseDir 재호출 → outcome=compared + comparison·report, 동일 endpoint 라 기본 tolerance 에서 regressed=false(실 GET /api 200 반영)", async () => {
      const baseDir = baselineDir("baselines");

      // 1차 — 최초 확정 write(established).
      const first = await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 3 },
      });
      expect(first.outcome).toBe("established");

      // 2차 — baseline 이 존재하므로 로드·비교(compared). 동일 endpoint(즉시 200 상수) 특성상
      // 기본 tolerance 에서 회귀 없음. 실 200 응답이 measure 에 반영됨(errorRate 0, count>0).
      const req = jest.fn(readRequest);
      const second = await measureAndConfirmBaseline(req, env, baseDir, {
        measure: { iterations: 3 },
      });

      expect(req).toHaveBeenCalledTimes(3);
      expect(second.outcome).toBe("compared");
      if (second.outcome === "compared") {
        expect(second.comparison.regressed).toBe(false);
        // errorRate 회귀도 없음(양쪽 다 실 200, errorRate 0).
        expect(second.comparison.errorRate.regressed).toBe(false);
        expect(typeof second.report).toBe("string");
        expect(second.report).toContain("regressed=false");
      }
    });
  });

  describe("error path — 하위 예외가 부작용 없이 그대로 전파", () => {
    it("(1) request 가 함수 아님(null) → measure TypeError 전파, confirm 미도달(파일 미생성)", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(null as unknown as RequestFn, env, baseDir),
      ).rejects.toThrow(TypeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(2) opts.measure.iterations 음수 → measure RangeError 전파(파일 미생성)", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(readRequest, env, baseDir, {
          measure: { iterations: -1 },
        }),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(2b) opts.measure.iterations NaN → measure RangeError 전파", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(readRequest, env, baseDir, {
          measure: { iterations: NaN },
        }),
      ).rejects.toThrow(RangeError);
    });

    it("(3) env.label 빈 문자열 → measure(build) RangeError 전파(파일 미생성)", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(
          readRequest,
          { label: "", concurrency: 1 },
          baseDir,
          { measure: { iterations: 2 } },
        ),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(4a) baseDir non-string → confirmOrCompareBaseline TypeError 전파", async () => {
      await expect(
        measureAndConfirmBaseline(readRequest, env, 123 as unknown as string, {
          measure: { iterations: 2 },
        }),
      ).rejects.toThrow(TypeError);
    });

    it("(4b) baseDir 공백-only → confirmOrCompareBaseline RangeError 전파", async () => {
      await expect(
        measureAndConfirmBaseline(readRequest, env, "   ", {
          measure: { iterations: 2 },
        }),
      ).rejects.toThrow(RangeError);
    });

    it("(5) compared 분기 저장 파일 내용이 유효 JSON 아님(사전 손상) → SyntaxError 전파", async () => {
      const baseDir = baselineDir("baselines");
      // 먼저 정상 확정해 파일을 만든 뒤 내용을 손상시킨다(존재 분기 유도).
      const first = await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 3 },
      });
      expect(first.outcome).toBe("established");
      fs.writeFileSync(resolveBaselinePath(env, baseDir), "{not-json", {
        encoding: "utf-8",
      });
      await expect(
        measureAndConfirmBaseline(readRequest, env, baseDir, {
          measure: { iterations: 3 },
        }),
      ).rejects.toThrow(SyntaxError);
    });
  });

  describe("flow / branch coverage — 부재→established vs 존재→compared, 옵션 위임", () => {
    it("baseline 부재 → established(write 발생) vs 존재 → compared(write 없이 read·compare, mtime 불변)", async () => {
      const baseDir = baselineDir("baselines");
      const first = await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 3 },
      });
      expect(first.outcome).toBe("established");
      // mtime 을 기록해 두 번째 호출이 write 하지 않음을 확인.
      const target = resolveBaselinePath(env, baseDir);
      const firstMtime = fs.statSync(target).mtimeMs;

      const second = await measureAndConfirmBaseline(
        readRequest,
        env,
        baseDir,
        {
          measure: { iterations: 3 },
        },
      );
      expect(second.outcome).toBe("compared");
      // 존재 분기는 read-only — 파일이 재기록되지 않음.
      expect(fs.statSync(target).mtimeMs).toBe(firstMtime);
    });

    it("opts.measure.iterations 지정 시 실 GET /api 요청 횟수가 그 값과 일치(요청 wrapper 호출 카운터)", async () => {
      const baseDir = baselineDir("baselines");
      const req = jest.fn(readRequest);
      await measureAndConfirmBaseline(req, env, baseDir, {
        measure: { iterations: 5 },
      });
      // iterations=5 → GET /api 5회 도달(measure 위임 검증). getStatus 도 5회 실호출.
      expect(req).toHaveBeenCalledTimes(5);
      expect(service.getStatus).toHaveBeenCalledTimes(5);
    });

    it("opts.compare tolerance 좁힘 → compared 분기 comparison.regressed=true 유도(회귀-검출 경로)", async () => {
      const baseDir = baselineDir("baselines");
      // 1차 — 빠른 baseline 확정(주입 clock 표본 10ms)으로 결정론적 기준을 만든다.
      await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 5, now: stepClock(10) },
      });
      // 2차 — 인위로 느린 candidate(주입 clock 표본 100ms) + tolerance 0 → 회귀.
      const result = await measureAndConfirmBaseline(
        readRequest,
        env,
        baseDir,
        {
          measure: { iterations: 5, now: stepClock(100) },
          compare: { latencyTolerance: 0 },
        },
      );
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        expect(result.comparison.regressed).toBe(true);
      }
    });

    it("opts.compare 기본 tolerance(+10%) → 소폭 증가는 회귀 아님(무회귀 경로)", async () => {
      const baseDir = baselineDir("baselines");
      await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 5, now: stepClock(100) },
      });
      // candidate 105ms(+5%) < 기본 tolerance 10% → 회귀 아님.
      const result = await measureAndConfirmBaseline(
        readRequest,
        env,
        baseDir,
        {
          measure: { iterations: 5, now: stepClock(105) },
        },
      );
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        expect(result.comparison.regressed).toBe(false);
      }
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) opts 미지정(undefined) → 기본 iterations 30·기본 compare tolerance 로 established 정상(기본치 경로 도달)", async () => {
      const baseDir = baselineDir("baselines");
      const req = jest.fn(readRequest);
      // 기본 iterations 30 이 measure 로 위임됨을 호출 횟수로 확인(실 GET /api 30회).
      const result = await measureAndConfirmBaseline(req, env, baseDir);
      expect(req).toHaveBeenCalledTimes(30);
      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        expect(fs.existsSync(result.path)).toBe(true);
      }
    });

    it("(b) 요청 wrapper 가 인위 503 반환 → errorRate 위반(pass=false) candidate 가 throw 없이 established write(관찰 전용, 파일 존재)", async () => {
      const baseDir = baselineDir("baselines");
      // 전부 503 → errorRate 100% → pass=false. established 분기라 관찰 전용으로 write 는 수행.
      const result = await measureAndConfirmBaseline(
        injectStatus(503),
        env,
        baseDir,
        { measure: { iterations: 4 } },
      );
      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        expect(fs.existsSync(result.path)).toBe(true);
        const persisted = parseBaselineReport(
          fs.readFileSync(result.path, "utf-8"),
        );
        // errorRate 위반이라 pass=false candidate 가 그대로 파일에 저장됨(관찰 전용).
        expect(persisted.pass).toBe(false);
        expect(persisted.errorRate).toBe(1);
        expect(persisted.count).toBe(0);
      }
    });

    it("(c) compared 분기 회귀(tolerance 좁힘)는 comparison.regressed=true 로만 노출·함수는 throw 안 함(resolve)", async () => {
      const baseDir = baselineDir("baselines");
      await measureAndConfirmBaseline(readRequest, env, baseDir, {
        measure: { iterations: 5, now: stepClock(10) },
      });
      // 회귀해도 reject 아닌 resolve 임을 확인(관찰 전용).
      const result = await measureAndConfirmBaseline(
        readRequest,
        env,
        baseDir,
        {
          measure: { iterations: 5, now: stepClock(100) },
          compare: { latencyTolerance: 0 },
        },
      );
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        expect(result.comparison.regressed).toBe(true);
      }
    });

    it("(d) measure 가 reject(요청 wrapper throw) → confirm 미도달로 임시 baseDir 에 파일 미생성(부작용 0)", async () => {
      const baseDir = baselineDir("baselines");
      const throwingRequest: RequestFn = async () => {
        throw new Error("요청 자체가 던짐");
      };
      // 요청 wrapper 가 throw 해도 collectLatencySamples 는 failure 로 흡수해 candidate 를
      // 생산한다(reject 아님) — 다만 전부 실패라 established write 는 수행되되 파일은 생성된다.
      // 반면 build 단계 자체가 reject 하면 confirm 미도달이다. 여기서는 measure 자체가 reject
      // 하는 경로(env 형태 불량)로 confirm 미도달·파일 미생성을 검증한다.
      await expect(
        measureAndConfirmBaseline(
          throwingRequest,
          { label: "  ", concurrency: 1 },
          baseDir,
          { measure: { iterations: 3 } },
        ),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(e) 수동 조립(measureBaselineCandidate)과 established candidate 가 round-trip 동치(주입 clock 결정론)", async () => {
      const baseDir = baselineDir("baselines");
      const result = await measureAndConfirmBaseline(
        readRequest,
        env,
        baseDir,
        {
          measure: { iterations: 4, now: stepClock(10) },
        },
      );
      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        // 동일 입력(주입 clock)으로 수동 조립한 candidate 와 디스크 파일이 동치여야 한다.
        const expectedCandidate = await measureBaselineCandidate(
          readRequest,
          env,
          { iterations: 4, now: stepClock(10) },
        );
        const persisted = parseBaselineReport(
          fs.readFileSync(result.path, "utf-8"),
        );
        expect(persisted).toEqual(expectedCandidate);
      }
    });
  });
});

// summary-measure-confirm.perf-spec.ts — S2 measure→confirm-or-compare 를 실 조회 endpoint
// (`SummaryController` `GET /api/summaries?personId=<id>`)에 배선한 *두 번째 fs+HTTP 통합
// perf-spec*.
// (T-0880, load-resilience-test-plan §5 follow-up #2 / REQ-048 조회 p95 < 3s)
//
// 목적: 직전 T-0877(app-root-measure-confirm.perf-spec.ts)이 top loop
// `measureAndConfirmBaseline` 을 **실 NestJS supertest + 실 fs baseline round-trip** 에 처음
// 배선했지만, 대상은 guard·param·예외경로가 전무한 floor-case `GET /api` health-read 하나뿐이
// 었고 §Out of Scope 가 "다른 endpoint(person/group/assessment 등) 배선" 을 명시적으로
// 이월했다. 본 spec 은 그 이월분을 이어받아, S2 시나리오가 실제로 겨냥하는 "평가 결과 조회
// 경로"(load-resilience-test-plan §2 S2 "요약·평가 결과 조회 read API")의 대표 endpoint 인
// **`SummaryController` `GET /api/summaries?personId=<id>`** 를 `measureAndConfirmBaseline`
// loop 에 배선한다 — guard stack(JwtAuthGuard/RolesGuard) override + query-param 분기
// (personId 부재→400)를 태워 floor-case 보다 실전에 가까운 established/compared round-trip 을
// 실증한다.
//
// endpoint 선택 근거(S2 조회 경로의 대표 read — floor-case 대비 실전성):
//   - `SummaryController` `GET /api/summaries?personId=<id>` 는 (1) `JwtAuthGuard`/`RolesGuard`
//     두 가드가 부착된 인증/인가 read 이고, (2) `@Query("personId")` 가 필수라 부재/빈 string
//     시 controller 가 `BadRequestException`(400)을 강제하는 **고유 query-param 예외 분기**를
//     가진다(floor-case `GET /api` 에는 없던 실 예외경로). 두 특성이 본 spec 을 T-0877 보다
//     실전에 가깝게 만든다.
//   - `SummaryService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector 배선만
//     측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up. mock 은 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → established/compared 기본 경로는 결정론적
//     으로 도달한다.
//
// 직전 T-0877(app-root-measure-confirm.perf-spec.ts)와의 결정적 차이(본 spec 고유 특성):
//   - T-0877 은 guard 미적용 floor-case `GET /api` 라 `overrideGuard` 가 불요했다. 본 spec 은
//     `JwtAuthGuard`/`RolesGuard` 두 가드를 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과시켜 인증/인가 layer 를 벗긴 뒤 순수 harness 배선만 측정한다
//     (summaries.e2e-spec.ts 는 실 guard stack 을 검증하는 별개 책임).
//   - T-0877 은 예외 경로가 없는 floor-case 라 실패(non-2xx) 분기를 요청 wrapper 레벨 fabricate
//     status 로만 커버했지만, 본 spec 은 **personId 부재 요청(실 400)** 이라는 SummaryController
//     고유 실 예외경로를 `measureAndConfirmBaseline` 이 errorRate 위반 candidate 로 established
//     write 하는 경로로 추가 실증한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·실 LLM·외부 I/O 무의존):
//   - `SummaryService` 는 mock(`useValue`) — `findByPerson` 은 mockResolvedValue 로 결정론적
//     배열을 반환한다. guard 는 `overrideGuard` 로 통과.
//   - 실 latency 는 wall-clock 이라 비결정적이므로, established/compared **분기 도달 판정**
//     자체는 요청 결과(2xx errorRate 0)·baseline 존재 여부로 결정론적이며, 회귀 판정 비교
//     동치는 주입 monotonic clock(`opts.measure.now`)으로 결정론화한다.
//   - 실패(non-2xx) 분기는 (1) 요청 wrapper 레벨 인위 503 주입, (2) **personId 부재 실 400**
//     두 경로로 커버한다. errorRate 위반 candidate 도 established write 는 수행(관찰 전용).
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
//   - 또 다른 endpoint(person/group/assessment/contribution 등) 동시 배선 / write route
//     perf(POST/PATCH/DELETE) / 실 Postgres·Prisma·LLM round-trip / 병렬·동시성 request(S3) /
//     실 baseline JSON repo 체크인(§5 #5) / CI perf job 재구성(§5 #4 — T-0878/T-0879 로 완료) /
//     collector·io·baseline 모듈 함수 재수정. 본 spec 은 SummaryController 조회 endpoint 1개만
//     top loop 에 태운 두 번째 통합 배선이며, 실 app 부트스트랩 + guard override + 임시 baseDir
//     격리 + loop 호출 + expect 만 책임진다.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { SummaryController } from "../../src/user/summary.controller";
import { SummaryService } from "../../src/user/summary.service";

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

// mock SummaryService — 조회(findByPerson) 경로가 실제 호출하는 것은 findByPerson 뿐. 나머지
// 3 primitive 는 controller 부트스트랩에 필요해 형식적으로 채운다(조회 경로에서 미호출).
type MockSummaryService = {
  findByPerson: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  remove: jest.Mock;
};

describe("S2 measure→confirm-or-compare perf-spec — SummaryController 조회(GET /api/summaries?personId) 실 supertest + guard override + fs baseline round-trip 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockSummaryService;

  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  /** 결정론 env-meta fixture(label/concurrency 고정 → 파일명 slug 결정적). */
  const env: BaselineEnvMeta = { label: "ci-summary-read", concurrency: 1 };

  /** 고정 personId — 실 200 조회 경로가 결정론적으로 도달하도록 test 전반에 재사용. */
  const FIXED_PERSON_ID = "p-1";

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정
  // (summaries.e2e-spec.ts 는 실 guard stack 을 검증하는 별개 책임).
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findByPerson: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    // JwtAuthGuard/RolesGuard 두 가드를 override 로 통과시켜 인증/인가 layer 를 벗긴다
    // (summary-read.perf-spec.ts 의 passGuard·overrideGuard 패턴 mirror).
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SummaryController],
      providers: [{ provide: SummaryService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passGuard)
      .overrideGuard(RolesGuard)
      .useValue(passGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 기본 정상 반환 — 실 GET /api/summaries 요청이 200 + JSON 배열을 받도록.
    service.findByPerson.mockResolvedValue([
      { id: "s-1", personId: FIXED_PERSON_ID, period: "week" },
    ]);
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-summary-mc-"));
  });

  afterEach(() => {
    // 임시 baseDir 를 재귀 삭제해 spec 간 격리·실 repo 미오염 보장.
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  // 실 조회 endpoint(`GET /api/summaries?personId=<id>`)를 1회 호출하고 collector 가 소비할
  // { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를
  // resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest =
    (personId: string = FIXED_PERSON_ID): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/summaries?personId=${personId}`,
      );
      return { status: res.status };
    };

  // personId query 자체를 뺀 요청 함수 — SummaryController 가 controller 레벨에서
  // BadRequestException(400)을 강제하는 고유 실 예외경로(floor-case 에 없던 경로)를 태운다.
  const readRequestMissingPersonId: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/summaries");
    return { status: res.status };
  };

  // 인위 non-2xx 를 주입하는 요청 wrapper — controller 를 실제로 호출하지 않고 status 만
  // fabricate 해 errorRate 위반(pass=false) candidate 경로를 실증한다.
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
    it("(a) established — 빈 baseDir 첫 호출 → outcome=established + path, baseline JSON 실 write(round-trip 동치, 실 GET /api/summaries 200 반영)", async () => {
      const baseDir = baselineDir("baselines");
      const req = jest.fn(readRequest());
      const iterations = 3;

      const result = await measureAndConfirmBaseline(req, env, baseDir, {
        measure: { iterations },
      });

      // 실 GET /api/summaries 200 응답이 iterations 만큼 measure 에 반영됨(errorRate 0, count>0).
      expect(req).toHaveBeenCalledTimes(iterations);
      expect(service.findByPerson).toHaveBeenCalledTimes(iterations);

      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        // established 분기는 임시 baseDir 에 baseline JSON 을 실제로 write 한다.
        expect(result.path).toBe(resolveBaselinePath(env, baseDir));
        expect(fs.existsSync(result.path)).toBe(true);
        // 디스크 파일을 parseBaselineReport 로 로드하면 유효 candidate 이고, 실 200 응답이
        // 반영돼 errorRate 0·count>0·pass=true(mock 즉시 반환이라 p95 임계 훨씬 아래).
        const persisted = parseBaselineReport(
          fs.readFileSync(result.path, "utf-8"),
        );
        expect(persisted.errorRate).toBe(0);
        expect(persisted.count).toBe(iterations);
        expect(persisted.pass).toBe(true);
        expect(persisted.env).toEqual(env);
      }
    });

    it("(b) compared — 같은 baseDir 재호출 → outcome=compared + comparison·report, 동일 endpoint 라 기본 tolerance 에서 regressed=false(실 GET /api/summaries 200 반영)", async () => {
      const baseDir = baselineDir("baselines");

      // 1차 — 최초 확정 write(established).
      const first = await measureAndConfirmBaseline(
        readRequest(),
        env,
        baseDir,
        { measure: { iterations: 3 } },
      );
      expect(first.outcome).toBe("established");

      // 2차 — baseline 이 존재하므로 로드·비교(compared). 동일 endpoint(즉시 mock 반환) 특성상
      // 기본 tolerance 에서 회귀 없음. 실 200 응답이 measure 에 반영됨(errorRate 0, count>0).
      const req = jest.fn(readRequest());
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
        measureAndConfirmBaseline(readRequest(), env, baseDir, {
          measure: { iterations: -1 },
        }),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(2b) opts.measure.iterations NaN → measure RangeError 전파", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(readRequest(), env, baseDir, {
          measure: { iterations: NaN },
        }),
      ).rejects.toThrow(RangeError);
    });

    it("(3) env.label 빈 문자열 → measure(build) RangeError 전파(파일 미생성)", async () => {
      const baseDir = baselineDir("baselines");
      await expect(
        measureAndConfirmBaseline(
          readRequest(),
          { label: "", concurrency: 1 },
          baseDir,
          { measure: { iterations: 2 } },
        ),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(4a) baseDir non-string → confirmOrCompareBaseline TypeError 전파", async () => {
      await expect(
        measureAndConfirmBaseline(
          readRequest(),
          env,
          123 as unknown as string,
          {
            measure: { iterations: 2 },
          },
        ),
      ).rejects.toThrow(TypeError);
    });

    it("(4b) baseDir 공백-only → confirmOrCompareBaseline RangeError 전파", async () => {
      await expect(
        measureAndConfirmBaseline(readRequest(), env, "   ", {
          measure: { iterations: 2 },
        }),
      ).rejects.toThrow(RangeError);
    });

    it("(5) compared 분기 저장 파일 내용이 유효 JSON 아님(사전 손상) → SyntaxError 전파", async () => {
      const baseDir = baselineDir("baselines");
      // 먼저 정상 확정해 파일을 만든 뒤 내용을 손상시킨다(존재 분기 유도).
      const first = await measureAndConfirmBaseline(
        readRequest(),
        env,
        baseDir,
        { measure: { iterations: 3 } },
      );
      expect(first.outcome).toBe("established");
      fs.writeFileSync(resolveBaselinePath(env, baseDir), "{not-json", {
        encoding: "utf-8",
      });
      await expect(
        measureAndConfirmBaseline(readRequest(), env, baseDir, {
          measure: { iterations: 3 },
        }),
      ).rejects.toThrow(SyntaxError);
    });
  });

  describe("flow / branch coverage — 부재→established vs 존재→compared, 옵션 위임", () => {
    it("baseline 부재 → established(write 발생) vs 존재 → compared(write 없이 read·compare, mtime 불변)", async () => {
      const baseDir = baselineDir("baselines");
      const first = await measureAndConfirmBaseline(
        readRequest(),
        env,
        baseDir,
        { measure: { iterations: 3 } },
      );
      expect(first.outcome).toBe("established");
      // mtime 을 기록해 두 번째 호출이 write 하지 않음을 확인.
      const target = resolveBaselinePath(env, baseDir);
      const firstMtime = fs.statSync(target).mtimeMs;

      const second = await measureAndConfirmBaseline(
        readRequest(),
        env,
        baseDir,
        { measure: { iterations: 3 } },
      );
      expect(second.outcome).toBe("compared");
      // 존재 분기는 read-only — 파일이 재기록되지 않음.
      expect(fs.statSync(target).mtimeMs).toBe(firstMtime);
    });

    it("opts.measure.iterations 지정 시 실 GET /api/summaries 요청 횟수가 그 값과 일치(요청 wrapper 호출 카운터)", async () => {
      const baseDir = baselineDir("baselines");
      const req = jest.fn(readRequest());
      await measureAndConfirmBaseline(req, env, baseDir, {
        measure: { iterations: 5 },
      });
      // iterations=5 → GET /api/summaries 5회 도달(measure 위임 검증). findByPerson 도 5회 실호출.
      expect(req).toHaveBeenCalledTimes(5);
      expect(service.findByPerson).toHaveBeenCalledTimes(5);
    });

    it("opts.compare tolerance 좁힘 → compared 분기 comparison.regressed=true 유도(회귀-검출 경로)", async () => {
      const baseDir = baselineDir("baselines");
      // 1차 — 빠른 baseline 확정(주입 clock 표본 10ms)으로 결정론적 기준을 만든다.
      await measureAndConfirmBaseline(readRequest(), env, baseDir, {
        measure: { iterations: 5, now: stepClock(10) },
      });
      // 2차 — 인위로 느린 candidate(주입 clock 표본 100ms) + tolerance 0 → 회귀.
      const result = await measureAndConfirmBaseline(
        readRequest(),
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
      await measureAndConfirmBaseline(readRequest(), env, baseDir, {
        measure: { iterations: 5, now: stepClock(100) },
      });
      // candidate 105ms(+5%) < 기본 tolerance 10% → 회귀 아님.
      const result = await measureAndConfirmBaseline(
        readRequest(),
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
      const req = jest.fn(readRequest());
      // 기본 iterations 30 이 measure 로 위임됨을 호출 횟수로 확인(실 GET /api/summaries 30회).
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
        {
          measure: { iterations: 4 },
        },
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

    it("(c) personId 부재 요청(실 400) → errorRate 위반 candidate 가 throw 없이 established write(SummaryController 고유 query-param 예외경로, floor-case 에 없던 실 400)", async () => {
      const baseDir = baselineDir("baselines");
      // personId query 를 뺀 실 요청 → controller 가 BadRequestException(400) 강제. collector 는
      // non-2xx(400)를 failure 로 분류 → errorRate 100% → pass=false. established 라 write 는 수행.
      const result = await measureAndConfirmBaseline(
        readRequestMissingPersonId,
        env,
        baseDir,
        { measure: { iterations: 4 } },
      );
      // 실 400 이 controller 레벨에서 강제됨(service 는 호출조차 안 됨 — 사전 분기).
      expect(service.findByPerson).not.toHaveBeenCalled();
      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        expect(fs.existsSync(result.path)).toBe(true);
        const persisted = parseBaselineReport(
          fs.readFileSync(result.path, "utf-8"),
        );
        expect(persisted.pass).toBe(false);
        expect(persisted.errorRate).toBe(1);
        expect(persisted.count).toBe(0);
      }
    });

    it("(d) compared 분기 회귀(tolerance 좁힘)는 comparison.regressed=true 로만 노출·함수는 throw 안 함(resolve)", async () => {
      const baseDir = baselineDir("baselines");
      await measureAndConfirmBaseline(readRequest(), env, baseDir, {
        measure: { iterations: 5, now: stepClock(10) },
      });
      // 회귀해도 reject 아닌 resolve 임을 확인(관찰 전용).
      const result = await measureAndConfirmBaseline(
        readRequest(),
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

    it("(e) measure 가 reject(env 형태 불량) → confirm 미도달로 임시 baseDir 에 파일 미생성(부작용 0)", async () => {
      const baseDir = baselineDir("baselines");
      // build 단계 자체가 reject(env.label 공백-only)하면 confirm 미도달 → 파일 미생성.
      await expect(
        measureAndConfirmBaseline(
          readRequest(),
          { label: "  ", concurrency: 1 },
          baseDir,
          { measure: { iterations: 3 } },
        ),
      ).rejects.toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(f) 수동 조립(measureBaselineCandidate)과 established candidate 가 round-trip 동치(주입 clock 결정론)", async () => {
      const baseDir = baselineDir("baselines");
      const result = await measureAndConfirmBaseline(
        readRequest(),
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
          readRequest(),
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

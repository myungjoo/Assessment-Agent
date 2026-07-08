// import-running-read.perf-spec.ts — S2 조회 latency harness 의 *열세 번째 실 perf-spec*.
// (T-0842, load-resilience-test-plan §5 follow-up #13 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831~T-0841 이 순서대로 Assessment·Contribution·Person·
// Group·Part·User·PermissionDeniedRecord·LlmProviderConfig·DifficultyMapping·
// CronSchedule·ExportController 에 배선한 collector 를, **열세 번째 조회 endpoint** 인
// `ImportController` 의 `GET /api/admin/import/running`(findRunning →
// `service.findRunning()` — status=RUNNING 인 ImportJob 목록 조회, UC-07 §8 status
// polling / REQ-030 Import / REQ-045 Admin 전용 / REQ-048 조회 back)에 배선한다.
// harness 가 요약·평가·기여·인원·그룹·파트·사용자·권한거부·LLM설정·난이도매핑·
// cron스케줄·export러닝·import러닝 13 read 경로 전반에 재사용됨을 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 열두
// perf-spec 과 함께 열세 다 실행된다.
//
// 직전 export-running slice(T-0841)와의 관계(export↔import counterpart 대칭): 본
// endpoint 도 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가
// 부착된 Admin list read** 다. 따라서 본 perf-spec 은 `export-running-read.perf-spec.ts`
// (가드 부착 + `overrideGuard` 사용, 부가 provider 불요, T-0841) 패턴을 mirror 해
// `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화하고
// controller 를 결정론적으로 부트스트랩한다. findRunning 핸들러는 query param 도
// `@CurrentUser()` actor 도 읽지 않고 mocked `service.findRunning()` 를 raw forward
// (RUNNING job 배열을 순서 그대로 반환, controller 자체 분기 없음, 빈 배열도 404 로
// 변환 안 함)하므로 req.user 박제가 불요하다(canActivate 가 true 만 반환하면 충분).
//
// export slice 와 동형으로 **단순**: ImportController 의 생성자는 `ImportJobService`
// 하나만 주입받으므로(cron-schedule 의 `@Inject(CRON_TICK_HANDLER)` 같은 부가 provider
// 불요), 테스트 모듈은 `ImportJobService` mock 만 `useValue` 로 제공하면 부트스트랩이
// 성립한다. Import 정책(job 생명주기·restore/preview·descriptor 정합) 검증은 out of
// scope — controller/service spec 책임, 본 spec 은 latency 배선만.
//
// non-2xx 분류 실증은 mocked `service.findRunning` 이 예외를 던져 endpoint 가 500
// (InternalServerError) 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `ImportJobService` 는 mock(`useValue`) — 실 Postgres round-trip·실 Prisma 없이
//     controller ↔ collector 배선만 측정. baseline 실측(실 DB round-trip)은 §5 item 5
//     별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...)` 로 무력화 — 인증/인가 layer
//     를 벗겨 순수 harness 배선만 측정(실 guard stack 검증은 별개 e2e/controller 책임).
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 예외(500)로 도달(errorRate 위반) — 실 latency 에 무의존한
//     결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - Import job 생명주기·restore/preview·descriptor 정합 자체 검증 — 본 spec 은
//     latency 배선만(정책은 기존 controller/service spec).
//   - POST /api/admin/import(create)·GET /modes·GET :id endpoint 배선 — 본 spec 은
//     running list read(findRunning) 만 배선. write/modes/:id 경로는 필요 시 별도 slice.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { ImportJob } from "@prisma/client";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { ImportJobService } from "../../src/import/import-job.service";
import { ImportController } from "../../src/import/import.controller";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock ImportJobService — controller 가 주입받는 메서드 중 진행 중 목록 조회(findRunning)
// 만 harness 에 필요. 각 test 가 mockResolvedValue / mockImplementation 으로 응답을
// 제어해 endpoint status(200 / 500)를 결정론적으로 만든다. createJob / findJob 등 다른
// 메서드는 본 조회 경로가 호출하지 않지만, service shape 정합을 위해 jest.fn 으로 함께
// 둔다(호출 안 됨).
type MockImportJobService = {
  findRunning: jest.Mock;
  createJob: jest.Mock;
  findJob: jest.Mock;
};

// 결정론적 RUNNING ImportJob 한 건 — mock findRunning 의 정상 반환값 원소. findRunning()
// 은 저장된 RUNNING job 배열을 순서 그대로 raw forward 하므로 fixture 는 JSON 직렬화만
// 되면 충분(실 DB row 가 아니어도 latency 배선 측정에 충분). ImportJob 은 ExportJob 대비
// mode(REPLACE/MERGE) + restoredRowCount 필드가 고유(prisma/schema.prisma model ImportJob).
function buildRunningJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: "import-job-running",
    status: "RUNNING",
    mode: "REPLACE",
    requestedById: "admin-actor",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    startedAt: new Date("2026-07-09T00:00:01.000Z"),
    finishedAt: null,
    error: null,
    artifactRef: null,
    restoredRowCount: null,
    ...overrides,
  } as ImportJob;
}

describe("S2 조회 latency perf-spec — ImportController running-read 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockImportJobService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // findRunning 핸들러는 query param 도 actor 도 읽지 않고 mocked service 로 raw forward
  // 하므로 req.user 박제가 불요하다(canActivate true 만으로 충분).
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findRunning: jest.fn(),
      createJob: jest.fn(),
      findJob: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [{ provide: ImportJobService, useValue: service }],
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
  });

  // 진행 중 import job 목록 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status
  // 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/admin/import/running",
    );
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 RUNNING job 배열 반환 → controller 가 200 + JSON array.
      service.findRunning.mockResolvedValue([buildRunningJob()]);
      const N = 5;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // mock service 는 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
      // 실제로 controller → mocked service 배선이 발화했는지 확인.
      expect(service.findRunning).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(500)", () => {
    it("service 예외로 500 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 reject → Nest 기본 500(InternalServerError). collector 는 non-2xx 를 failure.
      service.findRunning.mockRejectedValue(new Error("mocked service 장애"));
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      // 성공 표본 0 → p95 NaN(측정 불가) + errorRate 100% → 둘 다 fail 사유.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) 빈 결과([]) 에서도 latency 수집이 정상 — 200 이므로 성공 표본으로 수집.
    //     진행 중 job 0 인 빈 배열은 목록 조회의 정상 결과(404 아님 — raw forward).
    it("(a) service 가 빈 배열([]) 반환(진행 중 job 0) → 200 성공 수집, pass===true", async () => {
      service.findRunning.mockResolvedValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) mixed — 일부만 실패. failures 부분 집계 정확성(=1)을 검증.
    it("(b) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 reject(500), 나머지는 200.
      service.findRunning.mockImplementation(() => {
        call += 1;
        if (call === 2) {
          return Promise.reject(new Error("mocked 간헐 장애"));
        }
        return Promise.resolve([buildRunningJob()]);
      });
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(1);
      expect(result.samplesMs).toHaveLength(3);
      // 기본 errorRateMax(0.01) 는 25% 실패라 fail. 무관용(0) 로도 fail — 둘 다 확인.
      expect(assertS2Threshold(result).pass).toBe(false);
      expect(assertS2Threshold(result, { errorRateMax: 0 }).pass).toBe(false);
    });

    // (c) iterations 경계(1회) 에서 harness 가 깨지지 않음.
    it("(c) iterations===1 경계 → 단일 호출로도 harness 정상 동작", async () => {
      service.findRunning.mockResolvedValue([buildRunningJob()]);

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findRunning).toHaveBeenCalledTimes(1);
    });

    // (d) 다건 결과 — findRunning 이 다수 RUNNING job 배열을 반환해도 latency 수집이 정상
    //     동작(200, failures===0)함을 실증(단건·빈 배열 외 다건 경로 커버). mode 는
    //     REPLACE/MERGE 혼재해도 latency 배선 측정에 영향 없음(controller raw forward).
    it("(d) service 가 다건 RUNNING job 배열 반환 → 200 성공 수집, failures===0, pass===true", async () => {
      service.findRunning.mockResolvedValue([
        buildRunningJob({ id: "ij-r1", mode: "REPLACE" }),
        buildRunningJob({ id: "ij-r2", mode: "MERGE" }),
        buildRunningJob({ id: "ij-r3", mode: "REPLACE" }),
      ]);
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findRunning).toHaveBeenCalledTimes(N);
    });
  });
});

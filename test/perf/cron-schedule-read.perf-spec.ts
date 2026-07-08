// cron-schedule-read.perf-spec.ts — S2 조회 latency harness 의 *열한 번째 실 perf-spec*.
// (T-0840, load-resilience-test-plan §5 follow-up #11 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831~T-0839 이 순서대로 Assessment·Contribution·Person·
// Group·Part·User·PermissionDeniedRecord·LlmProviderConfig·DifficultyMappingController
// 에 배선한 collector 를, **열한 번째 조회 endpoint** 인 `CronScheduleController` 의
// `GET /api/schedules`(list → `service.list()` — 현재 등록된 cron job 이름 배열 조회,
// REQ-096 Admin 가시성 / REQ-048 조회 back)에 배선한다. harness 가 요약·평가·기여·
// 인원·그룹·파트·사용자·권한거부·LLM설정·난이도매핑·cron스케줄 11 read 경로 전반에
// 재사용됨을 실증한다. jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에
// 매칭돼 `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 →
// picking 0), 앞선 열 perf-spec 과 함께 열한 다 실행된다.
//
// 앞선 slice 와의 차이(본 spec 고유 특성): 본 endpoint 는
// `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
// list read** 다. 따라서 본 perf-spec 은 `difficulty-mapping-read.perf-spec.ts`(가드 부착 +
// `overrideGuard` 사용, T-0839) 패턴을 mirror 해 `overrideGuard(JwtAuthGuard)`·
// `overrideGuard(RolesGuard)` 로 가드를 무력화하고 controller 를 결정론적으로
// 부트스트랩한다. list 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고
// mocked `service.list()` 를 raw forward(등록 job 이름 `string[]` 을 순서 그대로 반환,
// controller 자체 분기 없음, 빈 배열도 404 로 변환 안 함)하므로 req.user 박제가 불요하다
// (canActivate 가 true 만 반환하면 충분). cron 등록/발화 정책·SchedulerRegistry 상호작용·
// CronTickHandler 실 결선 검증은 out of scope — controller/service spec 책임, 본 spec 은
// latency 배선만.
//
// CronScheduleController 는 `service` 외에 `@Inject(CRON_TICK_HANDLER)` 로
// `CronTickHandler` callback 을 주입받으므로, 본 perf-spec 의 테스트 모듈은
// `CronScheduleService` mock 과 함께 `CRON_TICK_HANDLER` provider(no-op
// `() => undefined`)도 `useValue` 로 제공해야 부트스트랩이 성립한다(list 경로는
// tickHandler 를 호출하지 않으므로 no-op 로 충분).
//
// non-2xx 분류 실증은 mocked `service.list` 이 예외를 던져 endpoint 가 500
// (InternalServerError) 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 스케줄러·외부 I/O 무의존):
//   - `CronScheduleService` 는 mock(`useValue`) — 실 SchedulerRegistry·실 timer 없이
//     controller ↔ collector 배선만 측정. baseline 실측(실 스케줄러 round-trip)은 §5
//     item 5 별도 follow-up.
//   - `CRON_TICK_HANDLER` 는 no-op `useValue` provider — list 경로 미호출이라 no-op
//     로 부트스트랩 성립. 실 tick callback 결선은 별개 책임(Out of Scope).
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...)` 로 무력화 — 인증/인가 layer
//     를 벗겨 순수 harness 배선만 측정(실 guard stack 검증은 별개 e2e/controller 책임).
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 예외(500)로 도달(errorRate 위반) — 실 latency 에 무의존한
//     결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 스케줄러 round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - cron 등록/발화 정책·CronTickHandler 실 결선·SchedulerRegistry 상호작용 검증 —
//     본 spec 은 latency 배선만(정책은 기존 controller/service spec, tickHandler no-op).
//   - PUT /api/schedules(upsert — write)·DELETE /api/schedules/:name·
//     POST /api/schedules/trigger endpoint 배선 — 본 spec 은 list read(list) 만 배선.
//     write/trigger 경로는 필요 시 별도 slice.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import {
  CRON_TICK_HANDLER,
  CronScheduleController,
} from "../../src/scheduling/cron-schedule.controller";
import { CronScheduleService } from "../../src/scheduling/cron-schedule.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock CronScheduleService — controller 가 주입받는 메서드 중 목록 조회(list) 만
// harness 에 필요. 각 test 가 mockReturnValue / mockImplementation 으로 응답을 제어해
// endpoint status(200 / 500)를 결정론적으로 만든다. registerOrReplace / remove 는 본
// 조회 경로가 호출하지 않지만, service shape 정합을 위해 jest.fn 으로 함께 둔다(호출 안 됨).
type MockCronScheduleService = {
  list: jest.Mock;
  registerOrReplace: jest.Mock;
  remove: jest.Mock;
};

// 결정론적 cron job 이름 한 건 — mock list 의 정상 반환값 원소. list() 는 등록된 job
// 이름 `string[]` 을 순서 그대로 raw forward 하므로 단순 문자열이면 충분(실제
// SchedulerRegistry key 가 아니어도 JSON 직렬화만 되면 latency 배선 측정에 충분).
const SAMPLE_JOB = "nightly-evaluation";

describe("S2 조회 latency perf-spec — CronScheduleController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockCronScheduleService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // list 핸들러는 query param 도 actor 도 읽지 않고 mocked service 로 raw forward
  // 하므로 req.user 박제가 불요하다(canActivate true 만으로 충분).
  const passGuard = { canActivate: () => true };

  // no-op CronTickHandler — list 경로는 tickHandler 를 호출하지 않으므로 부트스트랩
  // 성립만을 위한 stub(호출 안 됨).
  const noopTickHandler = (): undefined => undefined;

  beforeAll(async () => {
    service = {
      list: jest.fn(),
      registerOrReplace: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CronScheduleController],
      providers: [
        { provide: CronScheduleService, useValue: service },
        { provide: CRON_TICK_HANDLER, useValue: noopTickHandler },
      ],
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

  // cron job 이름 목록 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status
  // 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/schedules");
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 job 이름 배열 반환 → controller 가 200 + JSON array.
      service.list.mockReturnValue([SAMPLE_JOB]);
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
      expect(service.list).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(500)", () => {
    it("service 예외로 500 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 예외 → Nest 기본 500(InternalServerError). collector 는 non-2xx 를 failure.
      service.list.mockImplementation(() => {
        throw new Error("mocked service 장애");
      });
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
    //     등록 job 0 인 빈 배열은 목록 조회의 정상 결과(404 아님 — raw forward).
    it("(a) service 가 빈 배열([]) 반환(등록 job 0) → 200 성공 수집, pass===true", async () => {
      service.list.mockReturnValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) mixed — 일부만 실패. failures 부분 집계 정확성(=1)을 검증.
    it("(b) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 예외(500), 나머지는 200.
      service.list.mockImplementation(() => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [SAMPLE_JOB];
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
      service.list.mockReturnValue([SAMPLE_JOB]);

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.list).toHaveBeenCalledTimes(1);
    });

    // (d) 다건 결과 — list 이 다수 cron job 이름 배열을 반환해도 latency 수집이 정상
    //     동작(200, failures===0)함을 실증(단건·빈 배열 외 다건 경로 커버).
    it("(d) service 가 다건 job 이름 배열 반환 → 200 성공 수집, failures===0, pass===true", async () => {
      service.list.mockReturnValue([
        SAMPLE_JOB,
        "weekly-report",
        "hourly-sync",
      ]);
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.list).toHaveBeenCalledTimes(N);
    });
  });
});

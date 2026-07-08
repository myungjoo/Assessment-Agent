// assessment-read.perf-spec.ts — S2 조회 latency harness 의 *두 번째 실 perf-spec*.
// (T-0831, load-resilience-test-plan §5 follow-up #2 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에 처음 배선한 collector 를, **두 번째 조회 endpoint** 인
// `AssessmentController` 의 `GET /api/assessments?personId=&period=`(REQ-038 시계열 조회)
// 에 배선한다. harness 가 단일 controller 에 국한되지 않고 재사용됨을 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), summary-read 와
// 함께 둘 다 실행된다.
//
// SummaryController 와의 차이(본 spec 고유 검증): AssessmentController.findByPerson 은
// `personId` query 누락 시 controller 자체가 `BadRequestException`(400) 을 강제하는 분기를
// 갖는다. harness 가 이 non-2xx(400) 응답도 `failures` 로 정확히 분류하는지 추가 검증한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `AssessmentService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector
//     배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과 — 인증/인가 layer 를 벗겨 순수 harness 배선만 측정.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 예외(500) 또는 personId 누락(400) 으로 도달(errorRate 위반) —
//     실 latency 에 의존하지 않는 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - `@Get(":id")` findOne·POST/DELETE 등 다른 route perf 배선 — 본 spec 은 조회 시계열
//     findByPerson 하나에 집중(추가 route 는 후속 slice).
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { AssessmentController } from "../../src/user/assessment.controller";
import { AssessmentService } from "../../src/user/assessment.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock AssessmentService — controller 가 주입받는 4 primitive 중 조회(findByPerson)만
// harness 에 필요. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 500)를 결정론적으로 만든다. (personId 누락 400 은 controller
// 자체 분기라 service 호출 전에 발생 — mock 무관.)
type MockAssessmentService = {
  findByPerson: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  remove: jest.Mock;
};

describe("S2 조회 latency perf-spec — AssessmentController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockAssessmentService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findByPerson: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [{ provide: AssessmentService, useValue: service }],
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

  // 조회 endpoint 를 1회 호출하고 collector 가 소비할 { status } 를 반환하는 요청 함수.
  // supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로 성공
  // 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest =
    (personId = "p-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/assessments?personId=${personId}`,
      );
      return { status: res.status };
    };

  // personId query 를 아예 누락한 요청 — controller 의 400 BadRequestException 분기 도달.
  const missingPersonIdRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/assessments");
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 평가 배열 반환 → controller 가 200 + JSON array.
      service.findByPerson.mockResolvedValue([
        { id: "a-1", personId: "p-1", period: "week" },
      ]);
      const N = 5;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // mock service 는 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
      // 실제로 controller → mocked service 배선이 발화했는지 확인.
      expect(service.findByPerson).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(500)", () => {
    it("service 예외로 500 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 예외 → Nest 기본 500(InternalServerError). collector 는 non-2xx 를 failure.
      service.findByPerson.mockRejectedValue(new Error("mocked service 장애"));
      const N = 4;

      const result = await collectLatencySamples(readRequest(), N);

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
    // (a) personId query 누락 → controller 의 BadRequestException(400) 분기 도달.
    //     SummaryController 에는 없는 이 endpoint 고유 400 분기를 collector 가 failures
    //     로 정확히 분류하는지 검증(본 spec 의 핵심 추가 검증).
    it("(a) personId 누락 요청 → controller 400 을 collector 가 failures 로 분류, pass===false", async () => {
      const N = 3;

      const result = await collectLatencySamples(missingPersonIdRequest, N);

      // 400 은 non-2xx → 전부 failure, 성공 표본 0.
      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      // controller-layer 에서 막히므로 service.findByPerson 은 호출조차 안 됨.
      expect(service.findByPerson).not.toHaveBeenCalled();
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });

    // (b) 빈 결과([]) 에서도 latency 수집이 정상 — 200 이므로 성공 표본으로 수집.
    it("(b) service 가 빈 배열([]) 반환 → 200 성공 수집, pass===true", async () => {
      service.findByPerson.mockResolvedValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (c) mixed — 일부만 실패. failures 부분 집계 정확성(=1)을 검증.
    it("(c) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 예외(500), 나머지는 200.
      service.findByPerson.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [{ id: "a-1" }];
      });
      const N = 4;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(1);
      expect(result.samplesMs).toHaveLength(3);
      // 기본 errorRateMax(0.01) 는 25% 실패라 fail. 무관용(0) 로도 fail — 둘 다 확인.
      expect(assertS2Threshold(result).pass).toBe(false);
      expect(assertS2Threshold(result, { errorRateMax: 0 }).pass).toBe(false);
    });

    // (d) iterations 경계(1회) 에서 harness 가 깨지지 않음.
    it("(d) iterations===1 경계 → 단일 호출로도 harness 정상 동작", async () => {
      service.findByPerson.mockResolvedValue([{ id: "a-1" }]);

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findByPerson).toHaveBeenCalledTimes(1);
    });
  });
});

// summary-read.perf-spec.ts — S2 조회 latency harness 의 *첫 실 perf-spec*.
// (T-0830, load-resilience-test-plan §5 follow-up #2 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설한 collector 를
// **실제 Nest 조회 controller(SummaryController) + supertest** 에 배선하는 첫
// `*.perf-spec.ts`. jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼
// `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0),
// 이 파일이 채워지면서 `passWithNoTests` scaffold 가 실 검증으로 전환된다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `SummaryService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector
//     배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과 — 인증/인가 layer 를 벗겨 순수 harness 배선만 측정
//     (summaries.e2e-spec.ts 는 실 guard stack 을 검증하는 별개 책임).
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 이 예외를 던져 endpoint 가 500 을 반환하게 만들어 도달(errorRate
//     100% → assertS2Threshold fail) — 실 latency 에 의존하지 않는 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { SummaryController } from "../../src/user/summary.controller";
import { SummaryService } from "../../src/user/summary.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock SummaryService — controller 가 주입받는 4 primitive 중 조회(findByPerson)만
// harness 에 필요. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 500)를 결정론적으로 만든다.
type MockSummaryService = {
  findByPerson: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  remove: jest.Mock;
};

describe("S2 조회 latency perf-spec — SummaryController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockSummaryService;

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
  });

  // 조회 endpoint 를 1회 호출하고 collector 가 소비할 { status } 를 반환하는 요청 함수.
  // supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로 성공
  // 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest =
    (personId = "p-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/summaries?personId=${personId}`,
      );
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 요약 배열 반환 → controller 가 200 + JSON array.
      service.findByPerson.mockResolvedValue([
        { id: "s-1", personId: "p-1", period: "week" },
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
    // (a) 빈 결과([]) 에서도 latency 수집이 정상 — 200 이므로 성공 표본으로 수집.
    it("(a) service 가 빈 배열([]) 반환 → 200 성공 수집, pass===true", async () => {
      service.findByPerson.mockResolvedValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) mixed — 일부만 실패. errorRateMax=0(무관용) 로 부분 실패도 fail 판정하되,
    // failures 부분 집계 정확성(=1)을 검증.
    it("(b) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 예외(500), 나머지는 200.
      service.findByPerson.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [{ id: "s-1" }];
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

    // (c) iterations 경계(1회) 에서 harness 가 깨지지 않음.
    it("(c) iterations===1 경계 → 단일 호출로도 harness 정상 동작", async () => {
      service.findByPerson.mockResolvedValue([{ id: "s-1" }]);

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findByPerson).toHaveBeenCalledTimes(1);
    });
  });
});

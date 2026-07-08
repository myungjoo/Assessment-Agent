// summary-detail-read.perf-spec.ts — S2 조회 latency harness 의 *열다섯 번째 실 perf-spec*
// 이자 **첫 path-param detail(:id) read** 배선.
// (T-0844, load-resilience-test-plan §5 follow-up #15 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 의 **list** endpoint(`GET /api/summaries?personId=`)에 배선한
// collector 를, 같은 controller 의 **detail** endpoint 인 `GET /api/summaries/:id`
// (`findOne` → `service.findById(id)` — 단일 Summary 상세, row 부재 시 service 가
// `NotFoundException` throw → 404 자동 mapping)에 배선한다. 앞선 14 slice(summary-read
// (list)~auth-me-read)는 전부 list/query/self-read 경로였고, 본 spec 은 **첫 path-param
// `:id` detail read** 라 harness 가 단일 상세 조회(404 분기 있는 detail) 경로까지
// 재사용됨을 실증한다. jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼
// `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0),
// 앞선 14 perf-spec 과 함께 열다섯 다 실행된다.
//
// 앞선 summary-read(list) spec 과의 차이(본 spec 고유 특성): 요청 URL 이
// `?personId=` → `/:id` 로, 배선 대상 메서드가 `findByPerson` → `findById` 로 바뀐다.
// `SummaryController` 의 detail 핸들러는 `@Param("id")` 로 받은 id 를 `service.findById(id)`
// 로 raw forward 하고(controller 자체 분기 없음), row 존재 시 200(단일 Summary), row
// 부재 시 service 가 `NotFoundException`(404)을 던진다. list endpoint 와 같은 가드 스택
// (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`)을 공유하나 self-read 가
// 아니므로 req.user 박제는 불요하다(auth-me-read 의 sub 박제 패턴과 대비 — canActivate
// true 만으로 충분). non-2xx 분류 실증은 mocked `findById` 가 `NotFoundException`(404)/
// 일반 예외(500)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `SummaryService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector
//     배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과 — 인증/인가 layer 를 벗겨 순수 harness 배선만 측정.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 이 `NotFoundException`(404) 또는 일반 예외(500)를 던져 endpoint
//     가 non-2xx 를 반환하게 만들어 도달(errorRate 위반) — 실 latency 에 의존하지 않는
//     결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST/DELETE 등 write route perf 배선 — 본 spec 은 detail 조회(findById)에 집중.
import type { INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
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

// mock SummaryService — controller 가 주입받는 4 primitive 중 detail 경로가 실제로
// 호출하는 것은 `findById` 뿐(나머지 3 은 shape 정합용 jest.fn). 각 test 가
// mockResolvedValue / mockRejectedValue 로 응답을 제어해 endpoint status(200 / 404 /
// 500)를 결정론적으로 만든다.
type MockSummaryService = {
  findByPerson: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  remove: jest.Mock;
};

describe("S2 조회 latency perf-spec — SummaryController detail(:id) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockSummaryService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // detail 은 self-read 가 아니라 findById(id) raw forward 라 req.user 박제 불요.
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

  // 상세 조회 endpoint(`GET /api/summaries/:id`)를 1회 호출하고 collector 가 소비할
  // { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response
  // 를 resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를
  // 성공으로 분류).
  const readRequest =
    (id = "s-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/summaries/${id}`,
      );
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 단일 Summary 반환 → controller 가 200 + JSON object.
      service.findById.mockResolvedValue({
        id: "s-1",
        personId: "p-1",
        period: "week",
      });
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
      // 실제로 controller → mocked service.findById 배선이 발화했는지 확인.
      expect(service.findById).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx", () => {
    // (404) row 부재 — findById 가 NotFoundException 을 던져 endpoint 가 404.
    it("findById 가 NotFoundException → 404 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 NotFoundException → Nest 가 404 로 mapping. collector 는 non-2xx 를 failure.
      service.findById.mockRejectedValue(
        new NotFoundException("Summary not found"),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest("s-missing"), N);

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
    // (a) row 부재(404) — findById 가 NotFoundException. error path 와 동일 사유를
    // detail 관점(존재하지 않는 id 조회)에서 명시적으로 별도 커버.
    it("(a) 존재하지 않는 id 조회 → findById NotFoundException(404) → failures 로 분류, pass===false", async () => {
      service.findById.mockRejectedValue(
        new NotFoundException("Summary not found"),
      );
      const N = 3;

      const result = await collectLatencySamples(
        readRequest("s-does-not-exist"),
        N,
      );

      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 일반 예외(500) — findById 가 NotFound 아닌 일반 Error(장애)를 던지면 Nest
    // 기본 500. 404 와 500 두 non-2xx 를 구분해 최소 1개는 500 도 커버.
    it("(b) findById 가 일반 Error → 500 응답 → failures 로 분류(404 와 구분되는 500)", async () => {
      service.findById.mockRejectedValue(new Error("mocked service 장애"));
      const N = 3;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });

    // (c) mixed 부분 실패 — 4회 중 1회만 404 → failures 부분 집계 정확성(=1).
    it("(c) mixed — 4회 중 1회만 404(NotFound) → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 NotFoundException(404), 나머지는 정상 Summary(200).
      service.findById.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new NotFoundException("Summary not found");
        }
        return { id: "s-1", personId: "p-1", period: "week" };
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
    it("(d) iterations===1 경계 → 단일 상세 조회로도 harness 정상 동작", async () => {
      service.findById.mockResolvedValue({
        id: "s-1",
        personId: "p-1",
        period: "week",
      });

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findById).toHaveBeenCalledTimes(1);
    });
  });
});

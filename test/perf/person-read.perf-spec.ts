// person-read.perf-spec.ts — S2 조회 latency harness 의 *네 번째 실 perf-spec*.
// (T-0833, load-resilience-test-plan §5 follow-up #4 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831 이 AssessmentController 에, T-0832 가
// ContributionController 에 배선한 collector 를, **네 번째 조회 endpoint** 인
// `PersonController` 의 `GET /api/persons`(REQ-048 active 인원 목록 조회)에 배선한다.
// harness 가 요약·평가·기여·인원 4 read 경로 전반에 재사용됨을 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), summary-read /
// assessment-read / contribution-read 와 함께 넷 다 실행된다.
//
// 앞선 세 spec 과의 차이(본 spec 고유 특성): PersonController 는 `@UseGuards`/`@Roles`
// 를 부착하지 않는다(person.controller.ts — T-0036 시점 auth 미박제 정책). 따라서 본
// spec 은 `overrideGuard` 없이 controller 를 순수 부트스트랩한다(적용해도 no-op). 또한
// `GET /api/persons` 는 query-param 필수 분기(400)가 없는 단순 list read 라, non-2xx
// 분류 실증은 400 query 대신 **`GET /api/persons/:id` 의 404 분기**(mocked `findById` 이
// `NotFoundException` throw)로 이어간다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `PersonService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector
//     배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - guard 미적용 controller 라 `overrideGuard` 불요 — 순수 부트스트랩.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 예외(500) 또는 상세 조회 404(NotFoundException)로 도달
//     (errorRate 위반) — 실 latency 에 의존하지 않는 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 조회 findActive(+ 404
//     실증용 findById)에 집중(추가 route 는 후속 slice).
import type { INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { PersonController } from "../../src/user/person.controller";
import { PersonService } from "../../src/user/person.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock PersonService — controller 가 주입받는 메서드 중 조회(findActive/findById)만
// harness 에 필요. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 500 / 404)를 결정론적으로 만든다. (PersonController 는 guard
// 미적용이라 인증/인가 분기 노이즈가 없다.)
type MockPersonService = {
  findActive: jest.Mock;
  findById: jest.Mock;
};

describe("S2 조회 latency perf-spec — PersonController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockPersonService;

  beforeAll(async () => {
    service = {
      findActive: jest.fn(),
      findById: jest.fn(),
    };

    // PersonController 는 guard 미적용 — overrideGuard 없이 순수 부트스트랩.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PersonController],
      providers: [{ provide: PersonService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // active 인원 목록 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는 요청
  // 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로
  // 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/persons");
    return { status: res.status };
  };

  // 단일 인원 상세 조회 요청 — mocked findById 이 NotFoundException 을 던지면 404 분기 도달.
  const readOneRequest =
    (id = "p-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/persons/${id}`);
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 active 인원 배열 반환 → controller 가 200 + JSON array.
      service.findActive.mockResolvedValue([
        { id: "p-1", fullName: "홍길동", active: true },
      ]);
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
      expect(service.findActive).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(500)", () => {
    it("service 예외로 500 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 예외 → Nest 기본 500(InternalServerError). collector 는 non-2xx 를 failure.
      service.findActive.mockRejectedValue(new Error("mocked service 장애"));
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
    //     active 인원 0 은 목록 조회의 정상 결과(404 아님).
    it("(a) service 가 빈 배열([]) 반환(active 인원 0) → 200 성공 수집, pass===true", async () => {
      service.findActive.mockResolvedValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) 404 분기 배선 — GET /api/persons/:id 에서 mocked findById 이 NotFoundException
    //     을 던져 404 를 유발. harness 가 이 non-2xx(404) 를 failures 로 정확히 분류하는지
    //     검증(query-param 400 이 없는 대신 상세 조회 404 로 non-2xx 분류 실증).
    it("(b) GET /:id 에서 findById 이 404(NotFoundException) → collector 가 failures 로 분류, pass===false", async () => {
      service.findById.mockRejectedValue(
        new NotFoundException("person not found: p-1"),
      );
      const N = 3;

      const result = await collectLatencySamples(readOneRequest(), N);

      // 404 는 non-2xx → 전부 failure, 성공 표본 0.
      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(service.findById).toHaveBeenCalledTimes(N);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });

    // (c) mixed — 일부만 실패. failures 부분 집계 정확성(=1)을 검증.
    it("(c) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 예외(500), 나머지는 200.
      service.findActive.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [{ id: "p-1" }];
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

    // (d) iterations 경계(1회) 에서 harness 가 깨지지 않음.
    it("(d) iterations===1 경계 → 단일 호출로도 harness 정상 동작", async () => {
      service.findActive.mockResolvedValue([{ id: "p-1" }]);

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findActive).toHaveBeenCalledTimes(1);
    });
  });
});

// person-detail-read.perf-spec.ts — S2 조회 latency harness 의 *열여덟 번째 실 perf-spec*
// 이자 **네 번째 path-param detail(:id) read** 배선(첫 Person entity 상세 조회 경로).
// (T-0847, load-resilience-test-plan §5 follow-up #18 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0846
// 이 17 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment :id detail 3)에
// 배선한 collector 를, `PersonController` 의 **detail** endpoint 인 `GET /api/persons/:id`
// (`findOne` → `service.findById(id)` — 단일 Person 상세, row 부재 시 service 가
// `NotFoundException` throw → 404 자동 mapping)에 배선한다. 직전 T-0846(assessment :id)
// 이 **세 번째 path-param `:id` detail read** 였고, 본 spec 은 **네 번째 detail(:id) read**
// 이자 **첫 Person entity 상세 조회** 경로라, harness 가 단일 상세 조회(404 분기 있는
// detail) 경로에서 재사용됨을 한 slice 더 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 17 perf-spec
// 과 함께 열여덟 다 실행된다.
//
// 앞선 spec 과의 차이(본 spec 고유 특성): (1) 배선 대상이 person-read(list, T-0833) 의
// `findActive`(`GET /api/persons`) → `findById`(`GET /api/persons/:id`) 로, list read 에서
// detail(:id) read 로 바뀐다. (2) group-detail-read(T-0845) 와 배선 형태(findById(:id))
// 는 같으나, 대상 controller/entity 가 Group → Person 으로 바뀐다. `PersonController` 는
// group 과 마찬가지로 `@UseGuards`/`@Roles` 를 부착하지 않는다(person.controller.ts —
// T-0036 시점 auth 미박제 정책). 따라서 본 spec 은 `overrideGuard` 없이 controller 를
// 순수 부트스트랩한다(person-read(list) / group-detail-read 와 동일 패턴 — 적용해도 no-op).
// `PersonController.findOne` 은 `@Param("id")` 로 받은 id 를 `service.findById(id)` 로 raw
// forward 하고(controller 자체 분기 없음), row 존재 시 200(단일 Person), row 부재 시
// service 가 `NotFoundException`(404)을 던진다. non-2xx 분류 실증은 mocked `findById` 가
// `NotFoundException`(404)/일반 예외(500)를 던져 endpoint 가 404/500 을 반환하는 error
// path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `PersonService` 는 mock(`useValue`) — DB round-trip 없이 controller ↔ collector
//     배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - guard 미적용 controller 라 `overrideGuard` 불요 — 순수 부트스트랩.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 이 `NotFoundException`(404) 또는 일반 예외(500)를 던져 endpoint
//     가 non-2xx 를 반환하게 만들어 도달(errorRate 위반) — 실 latency 에 의존하지 않는
//     결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findById)에 집중.
//   - 다른 미배선 detail(:id) endpoint(part/user/contribution/import/export/llm-config :id)
//     및 sub-resource read 배선 — 각각 별도 후속 slice.
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

// mock PersonService — controller 가 주입받는 메서드 중 detail 경로가 실제로 호출하는
// 것은 `findById` 뿐. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 404 / 500)를 결정론적으로 만든다. (PersonController 는 guard
// 미적용이라 인증/인가 분기 노이즈가 없다.)
type MockPersonService = {
  findById: jest.Mock;
};

describe("S2 조회 latency perf-spec — PersonController detail(:id) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockPersonService;

  beforeAll(async () => {
    service = {
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

  // 단일 Person 상세 조회 endpoint(`GET /api/persons/:id`)를 1회 호출하고 collector 가
  // 소비할 { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고
  // response 를 resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가
  // 200~299 를 성공으로 분류).
  const readRequest =
    (id = "p-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/persons/${id}`);
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 단일 Person 반환 → controller 가 200 + JSON object.
      service.findById.mockResolvedValue({
        id: "p-1",
        fullName: "홍길동",
        active: true,
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
        new NotFoundException("person not found: p-missing"),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest("p-missing"), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      // 성공 표본 0 → p95 NaN(측정 불가) + errorRate 100% → 둘 다 fail 사유.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) row 부재(404) — findById 가 NotFoundException. detail 관점(존재하지 않는 id
    // 조회)에서 404 failures 분류를 명시적으로 별도 커버.
    it("(a) 존재하지 않는 id 조회 → findById NotFoundException(404) → failures 로 분류, pass===false", async () => {
      service.findById.mockRejectedValue(
        new NotFoundException("person not found: p-does-not-exist"),
      );
      const N = 3;

      const result = await collectLatencySamples(
        readRequest("p-does-not-exist"),
        N,
      );

      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(service.findById).toHaveBeenCalledTimes(N);
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
      // 2번째 호출만 NotFoundException(404), 나머지는 정상 Person(200).
      service.findById.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new NotFoundException("person not found: p-1");
        }
        return { id: "p-1", fullName: "홍길동", active: true };
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
        id: "p-1",
        fullName: "홍길동",
        active: true,
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

// group-persons-read.perf-spec.ts — S2 조회 latency harness 의 *스물다섯 번째 실 perf-spec*
// 이자 **첫 sub-resource(:id/persons) read** 배선(단건 detail(:id)을 넘어 지정 Group 소속
// Person 목록이라는 하위 리소스 조회 경로).
// (T-0854, load-resilience-test-plan §5 follow-up #25 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0853
// 이 24 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·
// contribution·user·llm-config·export·import :id detail 10)에 배선한 collector 를,
// `GroupController` 의 **sub-resource** endpoint 인 `GET /api/groups/:id/persons`
// (`findPersons` → `service.findPersonsByGroupId(id)` — 지정 Group 소속 Person 목록)에
// 배선한다. 직전 T-0844~T-0853 이 모두 **단건 detail(:id)** read 였고, 본 spec 은
// **첫 sub-resource read** 라, harness 가 단건 detail 을 넘어 하위 리소스 목록(:id/persons)
// 조회 경로에서도 재사용됨을 한 slice 더 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 24 perf-spec
// 과 함께 스물다섯 다 실행된다.
//
// 앞선 spec 과의 차이(본 spec 고유 특성): (1) 배선 대상이 group-detail(T-0845) 의
// `findById`(`GET /api/groups/:id`) → `findPersonsByGroupId`(`GET /api/groups/:id/persons`)
// 로, 단건 상세(:id) read 에서 sub-resource 목록(:id/persons) read 로 바뀐다. (2) 반환
// 형태가 단건 object 가 아니라 **Person[] 목록**이라 정상 응답이 배열이며, membership 0
// 이면 200 + 빈 배열(404 아님)이라 이 empty-list 성공 분기를 별도로 커버한다. (3)
// `GroupController` 는 `@UseGuards`/`@Roles` 를 부착하지 않으므로(group.controller.ts —
// auth credential 미박제 정책), group-detail(T-0845)·group-read(list) 와 동일하게
// `overrideGuard` 없이 controller 를 순수 부트스트랩한다(적용해도 no-op).
// `GroupController.findPersons` 는 `@Param("id")` 로 받은 id 를
// `service.findPersonsByGroupId(id)` 로 raw forward 하고(controller 자체 분기 없음),
// Group 존재 시 200(Person[]), Group 부재 시 service 가 사전 검증에서
// `NotFoundException`(404)을 던진다. non-2xx 분류 실증은 mocked `findPersonsByGroupId`
// 가 `NotFoundException`(404 — Group 부재)/일반 예외(500 — 장애)를 던져 endpoint 가
// 404/500 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `GroupService` 는 mock(`useValue`) — DB round-trip(membership middle table
//     N:M navigation 포함) 없이 controller ↔ collector 배선만 측정. baseline 실측(실
//     Postgres round-trip)은 §5 item 5 별도 follow-up.
//   - guard 미적용 controller 라 `overrideGuard` 불요 — 순수 부트스트랩.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 이 `NotFoundException`(404) 또는 일반 예외(500)를 던져 endpoint
//     가 non-2xx 를 반환하게 만들어 도달(errorRate 위반) — 실 latency 에 의존하지 않는
//     결정론적 fail.
//
// Flow / branch coverage 명시: `GroupController.findPersons` 는 자체 분기가 없고
// service 결과를 raw forward 하므로, collector 의 성공(2xx)/실패(non-2xx) 분기는 service
// 반환(200 — Person[] 또는 빈 배열)과 예외(404 — Group 부재 / 500 — 장애)로 각각 커버한다.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 sub-resource 조회에 집중.
//   - `PartController` 의 `GET /api/parts/:id/persons` sub-resource 배선 — 별도 후속 slice.
//   - 실 PersonGroupMembership N:M 네비게이션·RBAC 검증 — service/e2e spec 소관(본 spec 은 mock).
import type { INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GroupController } from "../../src/user/group.controller";
import { GroupService } from "../../src/user/group.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock GroupService — controller 가 주입받는 메서드 중 sub-resource(:id/persons) 경로가
// 실제로 호출하는 것은 `findPersonsByGroupId` 뿐. 각 test 가 mockResolvedValue /
// mockRejectedValue 로 응답을 제어해 endpoint status(200 / 404 / 500)를 결정론적으로
// 만든다. (GroupController 는 guard 미적용이라 인증/인가 분기 노이즈가 없다.)
type MockGroupService = {
  findPersonsByGroupId: jest.Mock;
};

describe("S2 조회 latency perf-spec — GroupController sub-resource(:id/persons) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockGroupService;

  beforeAll(async () => {
    service = {
      findPersonsByGroupId: jest.fn(),
    };

    // GroupController 는 guard 미적용 — overrideGuard 없이 순수 부트스트랩.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [{ provide: GroupService, useValue: service }],
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

  // 지정 Group 소속 Person 목록 endpoint(`GET /api/groups/:id/persons`)를 1회 호출하고
  // collector 가 소비할 { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도
  // reject 하지 않고 response 를 resolve 하므로 status 로 성공 여부를 판정(collector 의
  // isSuccess 가 200~299 를 성공으로 분류).
  const readRequest =
    (id = "g-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/groups/${id}/persons`,
      );
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass, id raw forward", async () => {
      // mock 이 Person[] 반환 → controller 가 200 + JSON array.
      service.findPersonsByGroupId.mockResolvedValue([
        { id: "p-1", name: "김철수" },
        { id: "p-2", name: "이영희" },
      ]);
      const N = 5;

      const result = await collectLatencySamples(readRequest("g-1"), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // mock service 는 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
      // 실제로 controller → mocked service.findPersonsByGroupId 배선이 발화했고,
      // @Param("id") 로 받은 id 가 raw forward 됐는지(g-1) 확인.
      expect(service.findPersonsByGroupId).toHaveBeenCalledTimes(N);
      expect(service.findPersonsByGroupId).toHaveBeenCalledWith("g-1");
    });

    // sub-resource 고유 특성 — Group 은 있으나 membership 0 이면 빈 배열(200, 404 아님).
    it("empty-list — membership 0 → 빈 배열 반환도 200 성공 분류 → failures===0, pass===true", async () => {
      // mock 이 빈 배열 → 여전히 200(빈 배열은 404 로 변환하지 않음).
      service.findPersonsByGroupId.mockResolvedValue([]);
      const N = 4;

      const result = await collectLatencySamples(readRequest("g-empty"), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.errorRate).toBe(0);
      expect(service.findPersonsByGroupId).toHaveBeenCalledWith("g-empty");
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx", () => {
    // (404) Group 부재 — findPersonsByGroupId 가 사전 검증에서 NotFoundException 을 던져
    // endpoint 가 404.
    it("findPersonsByGroupId 가 NotFoundException(Group 부재) → 404 N회 → 전부 failures, pass===false + errorRate 사유", async () => {
      // mock 이 NotFoundException → Nest 가 404 로 mapping. collector 는 non-2xx 를 failure.
      service.findPersonsByGroupId.mockRejectedValue(
        new NotFoundException("group not found: g-missing"),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest("g-missing"), N);

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
    // (a) 존재하지 않는 groupId 조회(404) — findPersonsByGroupId 가 NotFoundException.
    // sub-resource 관점(존재하지 않는 Group 의 persons 조회)에서 404 failures 분류를
    // 명시적으로 별도 커버.
    it("(a) 존재하지 않는 groupId 조회 → NotFoundException(404) → failures 로 분류, pass===false", async () => {
      service.findPersonsByGroupId.mockRejectedValue(
        new NotFoundException("group not found: g-does-not-exist"),
      );
      const N = 3;

      const result = await collectLatencySamples(
        readRequest("g-does-not-exist"),
        N,
      );

      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(service.findPersonsByGroupId).toHaveBeenCalledTimes(N);
      expect(service.findPersonsByGroupId).toHaveBeenCalledWith(
        "g-does-not-exist",
      );
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 일반 예외(500) — findPersonsByGroupId 가 NotFound 아닌 일반 Error(장애)를
    // 던지면 Nest 기본 500. 404 와 500 두 non-2xx 를 구분해 최소 1개는 500 도 커버.
    it("(b) findPersonsByGroupId 가 일반 Error → 500 응답 → failures 로 분류(404 와 구분되는 500)", async () => {
      service.findPersonsByGroupId.mockRejectedValue(
        new Error("mocked service 장애"),
      );
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
      // 2번째 호출만 NotFoundException(404), 나머지는 정상 Person[](200).
      service.findPersonsByGroupId.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new NotFoundException("group not found: g-1");
        }
        return [{ id: "p-1", name: "김철수" }];
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
    it("(d) iterations===1 경계 → 단일 sub-resource 조회로도 harness 정상 동작", async () => {
      service.findPersonsByGroupId.mockResolvedValue([
        { id: "p-1", name: "김철수" },
      ]);

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findPersonsByGroupId).toHaveBeenCalledTimes(1);
    });
  });
});

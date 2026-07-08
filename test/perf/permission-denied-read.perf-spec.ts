// permission-denied-read.perf-spec.ts — S2 조회 latency harness 의 *여덟 번째 실 perf-spec*.
// (T-0837, load-resilience-test-plan §5 follow-up #8 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831~T-0836 가 순서대로 Assessment·Contribution·Person·
// Group·Part·UserController 에 배선한 collector 를, **여덟 번째 조회 endpoint** 인
// `PermissionDeniedRecordController` 의 `GET /api/permission-denied-records`(list —
// 권한 거부 audit 조회, REQ-033 audit read-only / REQ-048 조회 back)에 배선한다.
// harness 가 요약·평가·기여·인원·그룹·파트·사용자·권한거부 8 read 경로 전반에
// 재사용됨을 실증한다. jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에
// 매칭돼 `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 →
// picking 0), 앞선 일곱 perf-spec 과 함께 여덟 다 실행된다.
//
// 앞선 slice 와의 차이(본 spec 고유 특성): 본 endpoint 는
// `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 로 **가드가 부착된 audit
// 조회** 다(ADR-0023 §5). 따라서 본 perf-spec 은 `user-read.perf-spec.ts`(가드 부착 +
// `overrideGuard` 사용, T-0836) 패턴을 mirror 해 `overrideGuard(JwtAuthGuard)`·
// `overrideGuard(RolesGuard)` 로 가드를 무력화하고 controller 를 결정론적으로
// 부트스트랩한다. 또한 이 endpoint 는 `instanceRef`/`provider`/`httpStatus`
// **query param 필터 분기**(`parseHttpStatus` 숫자 변환 포함)를 가지므로, query param
// 이 붙은 audit list read 경로까지 harness 가 재사용됨을 negative case (b) 로 실증한다.
//
// list 핸들러는 `@CurrentUser() actor` 를 읽어 mocked `service.list(actor, filter)` 로
// 명시 전달하지만(audience 차등은 service-layer 책임), service 가 mock 이라 actor 값에
// 무의존이다 — 따라서 UserController detail 처럼 req.user 를 박제할 필요가 없다
// (canActivate 가 true 만 반환하면 충분). 접근 정책/parseHttpStatus 파싱/audience 차등
// 검증은 out of scope — controller/service spec 책임, 본 spec 은 latency 배선만.
//
// non-2xx 분류 실증은 mocked `service.list` 가 예외를 던져 endpoint 가 500
// (InternalServerError) 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `PermissionDeniedRecordService` 는 mock(`useValue`) — DB round-trip 없이
//     controller ↔ collector 배선만 측정. baseline 실측(실 Postgres round-trip)은 §5
//     item 5 별도 follow-up.
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
//   - `parseHttpStatus` 파싱·audience 차등(Admin/non-Admin) service-layer 분기 정책
//     검증 — 본 spec 은 latency 배선만(파싱·audience 정책은 기존 controller/service spec).
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { PermissionDeniedRecordController } from "../../src/permission-denied/permission-denied-record.controller";
import { PermissionDeniedRecordService } from "../../src/permission-denied/permission-denied-record.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock PermissionDeniedRecordService — controller 가 주입받는 메서드 중 audit 조회(list)
// 만 harness 에 필요. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 500)를 결정론적으로 만든다. record 는 본 조회 경로가 호출하지
// 않지만, service shape 정합을 위해 jest.fn 으로 함께 둔다(호출은 안 됨).
type MockPermissionDeniedRecordService = {
  list: jest.Mock;
  record: jest.Mock;
};

// 결정론적 audit record view 한 건 — mock list 의 정상 반환값. schema 컬럼 shape 만
// 흉내(실제 Prisma row 가 아니어도 JSON 직렬화만 되면 latency 배선 측정에 충분).
const SAMPLE_RECORD = {
  id: "pdr-1",
  provider: "github",
  instanceRef: "acme/repo",
  resourceRef: "issue/1",
  principal: null,
  httpStatus: 403,
  reason: "permission-denied",
  createdAt: new Date(),
};

describe("S2 조회 latency perf-spec — PermissionDeniedRecordController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockPermissionDeniedRecordService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // list 핸들러는 actor 를 mocked service 로만 forward 하므로 req.user 박제가 불요하다.
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      list: jest.fn(),
      record: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PermissionDeniedRecordController],
      providers: [
        { provide: PermissionDeniedRecordService, useValue: service },
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

  // 권한 거부 audit 목록 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status
  // 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/permission-denied-records",
    );
    return { status: res.status };
  };

  // query param 이 붙은 audit list read — query-param 분기가 배선된 controller 도 collector
  // 가 커버함을 실증하기 위한 요청 함수(provider + httpStatus 필터).
  const readWithQueryRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/permission-denied-records?provider=github&httpStatus=403",
    );
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 record 배열 반환 → controller 가 200 + JSON array.
      service.list.mockResolvedValue([SAMPLE_RECORD]);
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
      service.list.mockRejectedValue(new Error("mocked service 장애"));
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
    //     record 0 은 audit 조회의 정상 결과(404 아님 — 빈 배열 반환, ADR-0023 §4).
    it("(a) service 가 빈 배열([]) 반환(record 0) → 200 성공 수집, pass===true", async () => {
      service.list.mockResolvedValue([]);
      const N = 3;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) query param 붙은 경로 — GET /api/permission-denied-records?provider=github&
    //     httpStatus=403 처럼 query param 이 붙은 요청에서도 harness 가 latency 를 정상
    //     수집(200, failures===0)함을 검증. query-param 분기가 배선된 controller 도
    //     collector 가 커버함을 실증(parseHttpStatus 숫자 변환 경로 포함).
    it("(b) query param(provider+httpStatus) 붙은 경로 → 200 성공 수집, failures===0, pass===true", async () => {
      service.list.mockResolvedValue([SAMPLE_RECORD]);
      const N = 4;

      const result = await collectLatencySamples(readWithQueryRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.list).toHaveBeenCalledTimes(N);
    });

    // (c) mixed — 일부만 실패. failures 부분 집계 정확성(=1)을 검증.
    it("(c) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 예외(500), 나머지는 200.
      service.list.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [SAMPLE_RECORD];
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
      service.list.mockResolvedValue([SAMPLE_RECORD]);

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.list).toHaveBeenCalledTimes(1);
    });
  });
});

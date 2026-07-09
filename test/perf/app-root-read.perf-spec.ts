// app-root-read.perf-spec.ts — S2 조회 latency harness 의 *서른 번째 실 perf-spec*
// 이자 **최단 health/sanity read(GET /api) 배선** (collector 배선 floor case).
// (T-0859, load-resilience-test-plan §5 follow-up #2 / REQ-048 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0858
// 이 29 개 조회 endpoint(list/query/self-read 14 + :id detail 10 + group·part :id/persons 2 +
// export :id/status-view derived-detail 1 + import /modes derived-list 1 + export :id/download
// artifact-stream 1)에 배선한 collector 를, `AppController` 의 **health/sanity read** 인
// `GET /api`(`getRoot` → `appService.getStatus()` 가 반환하는 고정 문자열 `APP_STATUS_MESSAGE`
// ("Assessment-Agent")를 그대로 200 반환 — path/query param 0, guard 미적용, service 는 동기
// `getStatus()` 1개만 호출하며 예외 경로가 없음)에 배선한다.
//
// 앞선 slice 들과의 결정적 차이(본 spec 고유 특성 — collector 배선의 floor case):
//   - 배선 대상 route 가 지금까지 배선한 모든 read 중 **가장 단순한 형태**다: (1) guard
//     미적용(가드 override 불요 — person-read/group-read/part-read 처럼 순수 부트스트랩),
//     (2) path/query param 없음, (3) service 는 `getStatus()` 동기 함수 1개만 호출하며
//     예외 경로가 없음(항상 200 고정 문자열). import /modes(T-0857) 의 순수-helper derive
//     보다도 단순하다 — helper derive 조차 없이 상수 문자열을 forward 한다. 따라서 harness
//     재사용이 복잡한 detail·derive·stream read 뿐 아니라 **최단 health-check read 에서도
//     유효함**을 실증하며, collector 배선 정확성 검증의 하한(floor) case 를 채운다.
//   - import /modes(T-0857) 는 service 를 전혀 호출하지 않는 service-무의존 derive 였지만,
//     본 endpoint 는 `getStatus()` 동기 반환을 **실호출**한다(단, 예외 없는 순수 상수 반환).
//     따라서 happy-path 에서 mocked `getStatus` 가 실호출됨을 assert 한다.
//   - `getStatus` 는 예외 경로가 없는 순수 동기 반환이므로(항상 200), collector 의 실패
//     (non-2xx) 분기 정상 동작 실증은 앞선 순수-helper slice(import /modes T-0857) 처럼
//     **요청 wrapper 레벨에서 인위 non-2xx status(500/503)를 주입**해 커버한다(controller
//     자체는 error path 가 없음 — 이 차이를 error path·negative 주석에 명시).
//   jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만
//   실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 29 perf-spec 과 함께
//   서른 다 실행된다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `AppService` 는 mock(`useValue`) — `getStatus` 는 부트스트랩 주입 + getRoot 경로에서
//     실호출되지만 mockReturnValue 로 고정 문자열을 결정론적으로 반환한다. 실 Postgres
//     round-trip·외부 I/O 없이 controller ↔ service ↔ collector 배선만 측정.
//   - guard 미적용 controller 라 `overrideGuard` 불요(person-read/group-read 처럼 순수
//     부트스트랩) — 인증/인가 layer 자체가 없어 벗길 것이 없다.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, 상수 문자열 동기 반환은 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달. fail 분기는
//     요청 wrapper 가 인위 non-2xx status 를 반환하게 만들어 도달(errorRate 위반) — 실
//     latency 에 의존하지 않는 결정론적 fail. getRoot 자체는 예외 경로가 없으므로 collector
//     실패 분기는 요청 wrapper 레벨에서 non-2xx 를 주입해 커버한다.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - `AppService.getStatus`/`APP_STATUS_MESSAGE` 상수 자체 로직·값 검증 — app.service.spec.ts
//     / app.controller.spec.ts 소관. 본 spec 은 정상 200 경로만 배선한다.
//   - POST/PATCH/DELETE write route perf 배선 — 본 spec 은 조회에 집중.
//   - 실 부트스트랩 health-probe(liveness/readiness) endpoint 신설 / e2e health smoke —
//     본 spec 은 기존 `GET /api` sanity read 에 collector 를 배선만.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppController } from "../../src/app.controller";
import { AppService } from "../../src/app.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock AppService — getRoot 경로가 실제 호출하는 것은 `getStatus` 뿐. 예외 경로가 없는 순수
// 동기 반환이라 mockReturnValue 로 고정 문자열을 결정론적으로 돌려준다.
type MockAppService = {
  getStatus: jest.Mock;
};

describe("S2 조회 latency perf-spec — AppController health-read(GET /api) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockAppService;

  beforeAll(async () => {
    service = {
      getStatus: jest.fn(),
    };

    // AppController 는 guard 미적용 controller 라 `overrideGuard` 가 불요하다
    // (person-read/group-read/part-read 처럼 순수 부트스트랩 — 벗길 인증/인가 layer 자체가
    // 없다). service 는 useValue mock 으로 주입한다.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 기본 정상 반환 — happy-path·negative (c) 의 실 요청이 200 고정 문자열을 받도록.
    service.getStatus.mockReturnValue("Assessment-Agent");
  });

  // health endpoint(`GET /api`)를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로
  // 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류). getRoot 는 항상 200
  // 만 반환하므로 이 실 요청은 happy-path·negative (c)~(d) 에서만 쓰이고, 실패(non-2xx)
  // 분기는 아래 injectStatus wrapper 로 커버한다.
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api");
    return { status: res.status };
  };

  // 인위 non-2xx 를 주입하는 요청 wrapper — getRoot 는 예외 경로가 없는 순수 동기 반환이라
  // (항상 200), collector 의 실패(non-2xx) 분기가 정상 동작함을 실증하려면 요청 함수
  // 레벨에서 non-2xx status 를 직접 반환해야 한다(controller 를 실제로 호출하지 않고 status
  // 만 fabricate). isSuccess(200~299) 판정 기준상 이 status 는 failures 로 분류된다.
  const injectStatus =
    (status: number): RequestFn =>
    async () => ({ status });

  describe("happy path — getRoot 정상 응답(200) + 고정 상태 문자열", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      const N = 5;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // 상수 문자열 동기 반환은 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
    });

    it("응답 body 가 고정 상태 문자열(Assessment-Agent)이고 getStatus 가 실호출됨을 확인", async () => {
      const res = await request(app.getHttpServer()).get("/api");

      expect(res.status).toBe(200);
      // getRoot 는 getStatus() 결과(고정 상수 문자열)를 그대로 200 반환한다.
      expect(res.text).toBe("Assessment-Agent");
      // import /modes(T-0857) 의 service-무의존 derive 와 달리, getRoot 는 getStatus 를
      // 실호출한다(단, 예외 없는 순수 상수 반환) — mock 발화 확인.
      expect(service.getStatus).toHaveBeenCalled();
    });
  });

  describe("error path — 요청 wrapper 가 인위 non-2xx 반환", () => {
    // getRoot 는 예외 경로가 없는 순수 동기 반환이므로(항상 200), collector 의 실패 분기는
    // 요청 wrapper 레벨에서 non-2xx 를 주입해 커버한다(controller 자체는 error path 가 없음 —
    // 이 차이가 앞선 findJob/findRunning mock-예외 slice 들과의 고유 차이이며 import /modes
    // (T-0857) 순수-helper 패턴을 mirror 한다).
    it("요청 wrapper 가 500 을 N회 반환 → 전부 failures, samplesMs.length===0, assertS2Threshold pass===false + errorRate 사유", async () => {
      const N = 4;

      const result = await collectLatencySamples(injectStatus(500), N);

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

  // Flow / branch coverage: getRoot 는 controller 자체 client 입력 분기가 없다(param 0,
  // 항상 고정 문자열 forward). 따라서 collector 의 성공(2xx)/실패(non-2xx) 분기는 정상
  // 응답(실 getRoot 200) vs 인위 non-2xx(injectStatus)로 각각 커버한다(controller 분기 부재).
  describe("negative cases 충분 cover", () => {
    // (a) 요청 wrapper 가 503(서비스 불가 성격의 non-2xx)을 반환 → failures 분류(2xx 아님,
    //     samplesMs 미집계). getRoot 자체는 항상 200 이지만 collector 의 non-2xx 분류가
    //     5xx service-unavailable 에도 정상 동작함을 실증(500 과 구분되는 503).
    it("(a) 요청 wrapper 가 503 반환 → failures 로 분류, samplesMs 미집계", async () => {
      const N = 3;

      const result = await collectLatencySamples(injectStatus(503), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) mixed 부분 실패 — N회 중 1회만 non-2xx → failures 부분 집계 정확성(=1). 2번째
    //     호출만 503 을 반환하고 나머지는 실 getRoot(200)를 호출.
    it("(b) mixed — 4회 중 1회만 503 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      const mixedRequest: RequestFn = async () => {
        call += 1;
        if (call === 2) {
          return { status: 503 };
        }
        const res = await request(app.getHttpServer()).get("/api");
        return { status: res.status };
      };
      const N = 4;

      const result = await collectLatencySamples(mixedRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(1);
      expect(result.samplesMs).toHaveLength(3);
      // 기본 errorRateMax(0.01) 는 25% 실패라 fail. 무관용(0) 로도 fail — 둘 다 확인.
      expect(assertS2Threshold(result).pass).toBe(false);
      expect(assertS2Threshold(result, { errorRateMax: 0 }).pass).toBe(false);
    });

    // (c) iterations 경계(1회) 에서 harness 가 깨지지 않음 — 단일 실 getRoot 호출로도 정상
    //     200 성공 집계.
    it("(c) iterations===1 경계 → 단일 health-read 조회로도 harness 정상 동작", async () => {
      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (d) harness 는 body 형태에 무관(관심사 분리) — getRoot 는 고정 문자열 body 를
    //     반환하지만, harness 자체는 2xx 만 성공으로 집계하고 body 문자열 shape 는 보지
    //     않음을 실증한다. 요청 wrapper 가 status 만 성공(200)으로 반환하면(body 부재) harness
    //     는 그것도 성공으로 정상 집계 — collector 의 성공 판정이 body shape 에 독립임을 증명.
    it("(d) 요청 wrapper 가 body 없이 status 200 만 반환해도 harness 는 성공으로 정상 집계(body 형태 무관)", async () => {
      const N = 4;

      const result = await collectLatencySamples(injectStatus(200), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
  });
});

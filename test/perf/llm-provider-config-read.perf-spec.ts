// llm-provider-config-read.perf-spec.ts — S2 조회 latency harness 의 *아홉 번째 실 perf-spec*.
// (T-0838, load-resilience-test-plan §5 follow-up #9 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831~T-0837 가 순서대로 Assessment·Contribution·Person·
// Group·Part·User·PermissionDeniedRecordController 에 배선한 collector 를, **아홉 번째
// 조회 endpoint** 인 `LlmProviderConfigController` 의 `GET /api/llm/providers`
// (findAll — 등록된 LLM provider config 목록 조회, REQ-096 Admin 가시성 / REQ-048 조회
// back)에 배선한다. harness 가 요약·평가·기여·인원·그룹·파트·사용자·권한거부·LLM설정
// 9 read 경로 전반에 재사용됨을 실증한다. jest-perf.json(`testRegex:
// test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만 실행되며(기본
// `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 여덟 perf-spec 과 함께 아홉 다
// 실행된다.
//
// 앞선 slice 와의 차이(본 spec 고유 특성): 본 endpoint 는
// `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
// list read** 다. 따라서 본 perf-spec 은 `permission-denied-read.perf-spec.ts`(가드 부착 +
// `overrideGuard` 사용, T-0837) 패턴을 mirror 해 `overrideGuard(JwtAuthGuard)`·
// `overrideGuard(RolesGuard)` 로 가드를 무력화하고 controller 를 결정론적으로
// 부트스트랩한다. findAll 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고
// mocked `service.findAll()` 를 raw forward(apiKey 제거 view 배열 반환, controller 자체
// 분기 없음)하므로 req.user 박제가 불요하다(canActivate 가 true 만 반환하면 충분).
// apiKey redaction·allow-list sanitize·RBAC escalation 정책 검증은 out of scope —
// controller/service spec 책임, 본 spec 은 latency 배선만.
//
// non-2xx 분류 실증은 mocked `service.findAll` 이 예외를 던져 endpoint 가 500
// (InternalServerError) 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 LLM·외부 I/O 무의존):
//   - `LlmProviderConfigService` 는 mock(`useValue`) — DB round-trip·실 LLM·apiKey
//     암복호화 없이 controller ↔ collector 배선만 측정. baseline 실측(실 Postgres
//     round-trip)은 §5 item 5 별도 follow-up.
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
//   - apiKey redaction·allow-list sanitize·RBAC escalation(Admin/non-Admin) 정책 검증 —
//     본 spec 은 latency 배선만(sanitize·audience 정책은 기존 controller/service spec).
//   - findById(단건 GET) / create / update / delete endpoint 배선 — 본 spec 은 list
//     read(findAll) 만 배선. 단건·write 경로는 필요 시 별도 slice.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { LlmProviderConfigController } from "../../src/llm/llm-provider-config.controller";
import { LlmProviderConfigService } from "../../src/llm/llm-provider-config.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock LlmProviderConfigService — controller 가 주입받는 메서드 중 목록 조회(findAll)
// 만 harness 에 필요. 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해
// endpoint status(200 / 500)를 결정론적으로 만든다. findById/create/update/delete 는 본
// 조회 경로가 호출하지 않지만, service shape 정합을 위해 jest.fn 으로 함께 둔다(호출 안 됨).
type MockLlmProviderConfigService = {
  findAll: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

// 결정론적 LLM provider config view 한 건 — mock findAll 의 정상 반환값. apiKey 제거
// view shape(LlmProviderConfigView) 만 흉내(실제 Prisma row 가 아니어도 JSON 직렬화만
// 되면 latency 배선 측정에 충분). apiKey 는 view 에서 제외돼 있음(secret redaction).
const SAMPLE_VIEW = {
  id: "llm-1",
  provider: "openai",
  endpointUrl: "https://api.openai.com/v1",
  modelId: "gpt-4o",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("S2 조회 latency perf-spec — LlmProviderConfigController 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockLlmProviderConfigService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // findAll 핸들러는 query param 도 actor 도 읽지 않고 mocked service 로 raw forward
  // 하므로 req.user 박제가 불요하다(canActivate true 만으로 충분).
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LlmProviderConfigController],
      providers: [{ provide: LlmProviderConfigService, useValue: service }],
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

  // LLM provider config 목록 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는
  // 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status
  // 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/llm/providers");
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 config view 배열 반환 → controller 가 200 + JSON array.
      service.findAll.mockResolvedValue([SAMPLE_VIEW]);
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
      expect(service.findAll).toHaveBeenCalledTimes(N);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(500)", () => {
    it("service 예외로 500 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 예외 → Nest 기본 500(InternalServerError). collector 는 non-2xx 를 failure.
      service.findAll.mockRejectedValue(new Error("mocked service 장애"));
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
    //     등록 config 0 은 목록 조회의 정상 결과(404 아님 — 빈 배열 raw forward).
    it("(a) service 가 빈 배열([]) 반환(등록 config 0) → 200 성공 수집, pass===true", async () => {
      service.findAll.mockResolvedValue([]);
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
      service.findAll.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new Error("mocked 간헐 장애");
        }
        return [SAMPLE_VIEW];
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
      service.findAll.mockResolvedValue([SAMPLE_VIEW]);

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    // (d) 다건 결과 — findAll 이 여러 config view 배열을 반환해도 latency 수집이 정상
    //     동작(200, failures===0)함을 실증(단건·빈 배열 외 다건 경로 커버).
    it("(d) service 가 다건 배열 반환 → 200 성공 수집, failures===0, pass===true", async () => {
      service.findAll.mockResolvedValue([
        SAMPLE_VIEW,
        { ...SAMPLE_VIEW, id: "llm-2", provider: "anthropic" },
        { ...SAMPLE_VIEW, id: "llm-3", provider: "google" },
      ]);
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findAll).toHaveBeenCalledTimes(N);
    });
  });
});

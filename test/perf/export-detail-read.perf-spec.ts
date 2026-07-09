// export-detail-read.perf-spec.ts — S2 조회 latency harness 의 *스물세 번째
// 실 perf-spec* 이자 **아홉 번째 path-param detail(:id) read** 배선.
// (T-0852, load-resilience-test-plan §5 follow-up #23 / REQ-048 조회 p95 < 3s, REQ-096
// Admin export/import 가시성)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0851
// 이 22 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·
// contribution·user·llm-provider-config :id detail 8)에 배선한 collector 를,
// `ExportController` 의 **detail** endpoint 인 `GET /api/admin/export/:id` (`findJob` →
// `service.findJob(id)` — 단건 status polling 조회, row 부재 시 service 의
// `findUniqueOrThrow` 가 P2025 → `NotFoundException`(404) 변환, 정상 시 단건 `ExportJob`
// (200)) 에 배선한다. 앞선 detail slice(llm-provider-config :id, T-0851)에 이어 harness
// 가 export 상세 조회 경로에서 재사용됨을 실증한다. jest-perf.json
// (`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만 실행되며
// (기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 22 perf-spec 과 함께 스물세
// 다 실행된다.
//
// 앞선 detail(:id) spec 과의 차이(본 spec 고유 특성):
//   - 배선 대상 controller 가 `ExportController`, 배선 대상 메서드가 `service.findJob`
//     으로 바뀐다. detail 핸들러(`@Get(":id") findJob`)는 `@Param("id")` 로 받은 id 를
//     `service.findJob(id)` 로 raw forward 하고(controller 자체 분기 없음), row 존재 시
//     200(단건 ExportJob), row 부재 시 service 가 P2025 → `NotFoundException`(404)로 변환.
//   - detail 핸들러는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가
//     부착된 Admin :id detail** 이라 llm-provider-config-detail(T-0851)·assessment-detail
//     (T-0846) 의 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 무력화 +
//     `findJob` mock 패턴을 mirror 한다(user :id 는 controller 자체 403 분기였던 반면, 본
//     endpoint 는 RolesGuard 가 가드하는 것을 override 로 통과 — controller 자체
//     authorization 분기가 없어 req.user 박제 불요, canActivate true 만으로 충분).
//   - 같은 export 모듈 sibling spec(export-running-read.perf-spec.ts, T-0841)의 부트스트랩
//     (ExportController + `ExportJobService` mock 단일 주입, mock type 에 `findJob:
//     jest.Mock` 이미 선언)을 재사용한다.
//   non-2xx 분류 실증은 mocked `findJob` 이 `NotFoundException`(404 — row 부재)/일반
//   예외(500 — 장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `ExportJobService` 는 mock(`useValue`) — DB round-trip·실 Prisma 없이 controller ↔
//     collector 배선만 측정. baseline 실측(실 Postgres round-trip)은 §5 item 5 별도
//     follow-up.
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
//   - POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findJob)에 집중.
//   - `GET /api/admin/export/running` list read 배선(별도 export-running-read.perf-spec.ts
//     이미 존재) — 본 spec 은 `:id` detail 만.
//   - `GET /api/admin/export/:id/download`·`:id/status-view` 등 파생 detail route 배선 —
//     본 spec 은 순수 `:id` findJob 만(다른 route 는 필요 시 별도 slice).
//   - 다른 미배선 detail(:id) endpoint(import :id) 배선 — 별도 slice(import.controller findJob).
//   - 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를
//     override 로 무력화한 뒤 detail latency 배선만(인증 정책은 기존 controller/service
//     spec / roles.guard.spec / e2e).
import type { INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { ExportJob } from "@prisma/client";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { ExportJobService } from "../../src/export/export-job.service";
import { ExportController } from "../../src/export/export.controller";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock ExportJobService — controller 가 주입받는 메서드 중 detail 경로가 실제로 호출하는
// 것은 `findJob` 뿐(나머지 4 는 shape 정합용 jest.fn). 각 test 가 mockResolvedValue /
// mockRejectedValue 로 응답을 제어해 endpoint status(200 / 404 / 500)를 결정론적으로
// 만든다. findRunning/createJob/previewSelection/materializeFullExportDownload 는 본
// detail 경로가 호출하지 않지만, service shape 정합을 위해 jest.fn 으로 함께 둔다(호출
// 안 됨). sibling export-running spec 의 mock type 에 이미 `findJob: jest.Mock` 선언.
type MockExportJobService = {
  findRunning: jest.Mock;
  createJob: jest.Mock;
  findJob: jest.Mock;
  previewSelection: jest.Mock;
  materializeFullExportDownload: jest.Mock;
};

// 결정론적 ExportJob 한 건 — mock findJob 의 정상 반환값. findJob(id) 는 저장된 단건 job
// 을 raw forward 하므로 fixture 는 JSON 직렬화만 되면 충분(실 DB row 가 아니어도 latency
// 배선 측정에 충분).
function buildExportJob(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "export-job-1",
    status: "SUCCEEDED",
    scope: "FULL",
    dateRange: null,
    entitySelector: null,
    requestedById: "admin-actor",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    startedAt: new Date("2026-07-09T00:00:01.000Z"),
    finishedAt: new Date("2026-07-09T00:00:05.000Z"),
    error: null,
    artifactRef: "artifact://export-job-1",
    ...overrides,
  } as ExportJob;
}

describe("S2 조회 latency perf-spec — ExportController detail(:id) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockExportJobService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // detail 은 self-read 가 아니라 findJob(id) raw forward 라 req.user 박제 불요(RolesGuard
  // 가 가드하는 것을 override 로 통과 — controller 자체 authorization 분기 없음).
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findRunning: jest.fn(),
      createJob: jest.fn(),
      findJob: jest.fn(),
      previewSelection: jest.fn(),
      materializeFullExportDownload: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportJobService, useValue: service }],
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

  // 상세 조회 endpoint(`GET /api/admin/export/:id`)를 1회 호출하고 collector 가 소비할
  // { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response
  // 를 resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를
  // 성공으로 분류).
  const readRequest =
    (id = "export-job-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/admin/export/${id}`,
      );
      return { status: res.status };
    };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass, findJob 가 요청 id 로 호출", async () => {
      // mock 이 단일 ExportJob 반환 → controller 가 200 + JSON object.
      service.findJob.mockResolvedValue(buildExportJob());
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
      // 실제로 controller → mocked service.findJob 배선이 발화했는지 + 요청 id 로
      // 호출됐는지 확인(@Param("id") raw forward).
      expect(service.findJob).toHaveBeenCalledTimes(N);
      expect(service.findJob).toHaveBeenCalledWith("export-job-1");
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx", () => {
    // (404) row 부재 — findJob 이 NotFoundException 을 던져 endpoint 가 404.
    it("findJob 이 NotFoundException → 404 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // mock 이 NotFoundException → Nest 가 404 로 mapping. collector 는 non-2xx 를 failure.
      service.findJob.mockRejectedValue(
        new NotFoundException("export job not found: export-missing"),
      );
      const N = 4;

      const result = await collectLatencySamples(
        readRequest("export-missing"),
        N,
      );

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

  // Flow / branch coverage: controller 자체 분기 없음 — controller 는 service 결과
  // forward 만(raw forward). 따라서 collector 성공(2xx)/실패(non-2xx) 분기는 service
  // 반환(200) vs 예외(404·500)로 커버한다.
  describe("negative cases 충분 cover", () => {
    // (a) 존재하지 않는 id 조회(404) — findJob 이 NotFoundException. error path 와 동일
    // 사유를 detail 관점(존재하지 않는 id 조회)에서 명시적으로 별도 커버.
    it("(a) 존재하지 않는 id 조회 → findJob NotFoundException(404) → failures 로 분류, pass===false", async () => {
      service.findJob.mockRejectedValue(
        new NotFoundException("export job not found: export-does-not-exist"),
      );
      const N = 3;

      const result = await collectLatencySamples(
        readRequest("export-does-not-exist"),
        N,
      );

      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) 일반 예외(500) — findJob 이 NotFound 아닌 일반 Error(DB 장애 등)를 던지면 Nest
    // 기본 500. 404 와 500 두 non-2xx 를 구분해 최소 1개는 500 도 커버.
    it("(b) findJob 이 일반 Error → 500 응답 → failures 로 분류(404 와 구분되는 500)", async () => {
      service.findJob.mockRejectedValue(new Error("mocked service 장애"));
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
      // 2번째 호출만 NotFoundException(404), 나머지는 정상 ExportJob(200).
      service.findJob.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new NotFoundException("export job not found: export-job-1");
        }
        return buildExportJob();
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
      service.findJob.mockResolvedValue(buildExportJob());

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findJob).toHaveBeenCalledTimes(1);
    });
  });
});

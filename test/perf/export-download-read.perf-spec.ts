// export-download-read.perf-spec.ts — S2 조회 latency harness 의 *스물아홉 번째 실 perf-spec*
// 이자 **첫 artifact-stream(:id/download) read** 배선(첫 dual-service-call read).
// (T-0858, load-resilience-test-plan §5 follow-up #2 / REQ-048 조회 p95 < 3s,
// REQ-030 Export, REQ-032 raw 미저장·미노출, REQ-045 Admin 전용)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0857
// 이 28 개 조회 endpoint(list/query/self-read 14 + :id detail 10 + group·part :id/persons 2 +
// export :id/status-view derived-detail 1 + import /modes derived-list 1)에 배선한 collector
// 를, `ExportController` 의 **artifact-stream sub-resource** endpoint 인
// `GET /api/admin/export/:id/download`(`download` → `service.findJob(id)` 로 job 조회 →
// `buildScopePayload(job)` 로 scope 합성 → `service.materializeFullExportDownload(scope)` 로
// `Readable` 획득 → `collectStream` 으로 Buffer 화 → descriptor 로 다운로드 header
// (Content-Type/Content-Disposition/Content-Length) set 후 `StreamableFile`(byte body) 200
// 반환 — job 부재 시 findJob 의 `NotFoundException`(404) raw propagate, materialize 실패 시
// service reject(500) raw propagate, controller 자체 client 입력 분기 0)에 배선한다.
//
// 앞선 slice(export :id/status-view T-0856, import /modes T-0857)와의 결정적 차이(본 spec
// 고유 특성):
//   - 배선 대상 route 가 순수 findJob 단건 read 또는 순수 helper-derive 가 아니라 **두 개의
//     service 호출을 연쇄**(findJob → materializeFullExportDownload)하고 **StreamableFile
//     (byte body)을 흘려보내는 artifact-stream read** 다 — collector 가 단건 detail·derived
//     read 뿐 아니라 dual-service-call + stream body read 에서도 유효함을 실증하는 첫 slice.
//   - 앞선 derived-detail(status-view) 이 mocked service 예외 1 지점(findJob)만 non-2xx 로
//     도달했다면, 본 endpoint 는 **두 service 호출 각각이 실패 지점**이라 (1) findJob 이
//     `NotFoundException`(404) → 두 번째 호출 도달 전 propagate, (2) materializeFullExportDownload
//     reject(500) → 첫 호출 성공 후 두 번째에서 실패, 두 error path 를 각각 커버한다.
//   - happy-path 는 `findJob` 이 job 을, `materializeFullExportDownload` 가
//     `Readable.from(...)` 을 반환하게 mock 해 controller 가 stream 을 Buffer 화하고
//     StreamableFile + download header 로 200 을 내는 전체 dual-call 경로를 실측한다.
//   - `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가 부착된 Admin-tier read 라
//     sibling(export-status-view T-0856 / export-detail T-0852)의 `overrideGuard(JwtAuthGuard)`·
//     `overrideGuard(RolesGuard)` useValue(passGuard) 무력화 + `findJob` mock 패턴을 mirror 한다
//     (controller 자체 authorization 분기 없음 — RolesGuard 가 가드하는 것을 override 로 통과,
//     req.user 박제 불요, canActivate true 만으로 충분).
//   - sibling(export-status-view / export-detail / export-running)의 부트스트랩(ExportController
//     + `ExportJobService` mock 단일 주입, 5-메서드 mock shape)을 그대로 재사용한다.
//   jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만
//   실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 28 perf-spec 과 함께
//   스물아홉 다 실행된다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `ExportJobService` 는 mock(`useValue`) — DB round-trip·실 Prisma 없이 controller ↔
//     helper(collectStream/descriptor) ↔ collector 배선만 측정. findJob·
//     materializeFullExportDownload 의 반환/예외를 mock 으로 제어해 endpoint status(200 /
//     404 / 500)를 결정론적으로 만든다. baseline 실측(실 Postgres round-trip)은 §5 item 5
//     별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과 — 인증/인가 layer 를 벗겨 순수 harness 배선만 측정.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service + in-memory
//     Readable + 순수 helper 는 즉시 반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass
//     분기 결정론적 도달. fail 분기는 mock 이 `NotFoundException`(404) 또는 일반 예외(500)를
//     던져 endpoint 가 non-2xx 를 반환하게 만들어 도달(errorRate 위반) — 실 latency 에
//     의존하지 않는 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - `materializeFullExportDownload`/`buildExportArtifactDescriptor`/
//     `serializeExportDownloadHeaders`/`collectStream` helper 자체 로직·직렬화 포맷 단위
//     검증 — helper 전용 unit spec / controller unit spec 소관. 본 spec 은 정상 stream derive
//     경로만 배선한다.
//   - `ExportController.findJob`(:id detail)·`statusView`(:id/status-view)·`findRunning`
//     (running) 재배선 — 본 spec 은 `:id/download` artifact-stream read 만.
//   - POST/PATCH/DELETE write route perf 배선 — 본 spec 은 조회에 집중.
//   - 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를
//     override 로 무력화한 뒤 latency 배선만(인증 정책은 기존 controller/service spec /
//     roles.guard.spec / e2e).
import { Readable } from "stream";

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

// mock ExportJobService — controller 가 주입받는 메서드 중 artifact-stream(:id/download)
// 경로가 실제로 호출하는 것은 `findJob` + `materializeFullExportDownload` 두 개다(dual-service-
// call). 각 test 가 mockResolvedValue / mockRejectedValue 로 응답을 제어해 endpoint status
// (200 / 404 / 500)를 결정론적으로 만든다. findRunning/createJob/previewSelection 은 본
// download 경로가 호출하지 않지만, service shape 정합을 위해 jest.fn 으로 함께 둔다(호출 안 됨).
// sibling export-status-view/export-detail spec 의 mock type 을 그대로 재사용.
type MockExportJobService = {
  findRunning: jest.Mock;
  createJob: jest.Mock;
  findJob: jest.Mock;
  previewSelection: jest.Mock;
  materializeFullExportDownload: jest.Mock;
};

// 결정론적 ExportJob 한 건 — mock findJob 의 정상 반환값. download(id) 는 findJob 이 준 job
// 으로 buildScopePayload → materializeFullExportDownload → collectStream → StreamableFile 을
// 조립하므로 fixture 는 scope 합성에 필요한 필드만 유효하면 충분(실 DB row 가 아니어도 latency
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

// materializeFullExportDownload 의 정상 반환값 — in-memory Node Readable 한 건. controller 가
// collectStream 으로 Buffer 화 후 StreamableFile(byte body)로 흘려보낸다. 매 test 마다 새
// Readable 을 만들어야 함(stream 은 1회 소비되면 재사용 불가) — 그래서 factory 함수로 둔다.
function buildDownloadStream(): Readable {
  return Readable.from([
    Buffer.from(JSON.stringify({ schemaVersion: 1, records: [] }), "utf8"),
  ]);
}

describe("S2 조회 latency perf-spec — ExportController artifact-stream(:id/download) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockExportJobService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // download 는 self-read 가 아니라 findJob(id) → materialize raw forward 라 req.user 박제
  // 불요(RolesGuard 가 가드하는 것을 override 로 통과 — controller 자체 authorization 분기 없음).
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

  // artifact-stream endpoint(`GET /api/admin/export/:id/download`)를 1회 호출하고 collector 가
  // 소비할 { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response
  // 를 resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로
  // 분류). happy-path 마다 materialize 가 새 Readable 을 반환하도록 mockImplementation(factory)
  // 을 재설정한 뒤 이 요청 함수를 collector 에 넘긴다. 본문 body/header 검증이 필요한 happy-path
  // 는 별도로 직접 호출한다.
  const readRequest =
    (id = "export-job-1"): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/admin/export/${id}/download`,
      );
      return { status: res.status };
    };

  // 인위 non-2xx 를 주입하는 요청 wrapper — 요청 함수 레벨에서 status 만 fabricate(controller 를
  // 실제로 호출하지 않음). isSuccess(200~299) 판정 기준상 이 status 는 failures 로 분류된다.
  // negative (a) 403 등 collector 실패 분기의 status-code 독립성 실증에 쓴다.
  const injectStatus =
    (status: number): RequestFn =>
    async () => ({ status });

  describe("happy path — mock service 정상 응답(200) + artifact-stream body", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass, findJob+materialize 실호출", async () => {
      // findJob 이 단일 ExportJob 반환 + materialize 가 매 호출 새 Readable 반환 →
      // controller 가 stream 을 Buffer 화해 StreamableFile 200 을 낸다. stream 은 1회 소비되면
      // 재사용 불가라 mockImplementation(factory)로 매 호출 새 Readable 을 만든다.
      service.findJob.mockResolvedValue(
        buildExportJob({ status: "SUCCEEDED" }),
      );
      service.materializeFullExportDownload.mockImplementation(async () =>
        buildDownloadStream(),
      );
      const N = 5;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // mock service + in-memory Readable + 순수 helper 는 즉시 반환 → p95 는 임계(3000ms)
      // 훨씬 아래 → pass.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
      // dual-service-call 두 지점이 모두 발화했는지 + findJob 이 요청 id 로 호출됐는지 확인.
      expect(service.findJob).toHaveBeenCalledTimes(N);
      expect(service.findJob).toHaveBeenCalledWith("export-job-1");
      expect(service.materializeFullExportDownload).toHaveBeenCalledTimes(N);
    });

    it("실 응답 body(StreamableFile byte body)와 download header(Content-Type/Content-Disposition/Content-Length) 존재 + dual-call 실호출 확인", async () => {
      service.findJob.mockResolvedValue(
        buildExportJob({ status: "SUCCEEDED" }),
      );
      service.materializeFullExportDownload.mockImplementation(async () =>
        buildDownloadStream(),
      );

      const res = await request(app.getHttpServer())
        .get("/api/admin/export/export-job-1/download")
        .buffer(true)
        .parse((r, cb) => {
          // supertest 는 stream body 를 기본 파싱하지 않으므로 raw buffer 로 모은다.
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      // 다운로드 header 3 종이 descriptor 로부터 set 됐는지 확인(header 존재 — 값 포맷은 helper
      // unit spec 소관, 본 spec 은 배선 실증만).
      expect(res.headers["content-type"]).toBeDefined();
      expect(res.headers["content-disposition"]).toBeDefined();
      expect(res.headers["content-length"]).toBeDefined();
      // StreamableFile byte body 가 실제로 흘러왔는지(비어 있지 않은 buffer).
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect((res.body as Buffer).byteLength).toBeGreaterThan(0);
      // dual-service-call 두 지점 실호출 — findJob(id) → materialize(scope).
      expect(service.findJob).toHaveBeenCalledWith("export-job-1");
      expect(service.materializeFullExportDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx (dual-call 두 실패 지점)", () => {
    // (404) job 부재 — findJob 이 NotFoundException 을 던져 두 번째 호출(materialize) 도달 전
    // 404. dual-call 의 첫 지점 실패.
    it("findJob 이 NotFoundException → 404 응답 N회 → 전부 failures, samplesMs===0, pass===false + errorRate 사유, materialize 미도달", async () => {
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
      // findJob 이 첫 지점에서 던졌으므로 두 번째 service 호출은 도달하지 않음(dual-call 순차성).
      expect(service.materializeFullExportDownload).not.toHaveBeenCalled();
    });

    // (500) 의존성 실패 — findJob 은 성공(job 반환)했으나 materializeFullExportDownload 가 일반
    // Error(dump 생성 장애 등)를 던져 Nest 기본 500. dual-call 의 두 번째 지점 실패.
    it("materializeFullExportDownload reject → 500 응답 → failures 분류(첫 지점 성공 후 두 번째 실패)", async () => {
      service.findJob.mockResolvedValue(
        buildExportJob({ status: "SUCCEEDED" }),
      );
      service.materializeFullExportDownload.mockRejectedValue(
        new Error("mocked materialize 장애"),
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
      // 첫 지점(findJob)은 도달·성공, 두 번째 지점(materialize)에서 실패 — dual-call 순차성.
      expect(service.findJob).toHaveBeenCalledTimes(N);
      expect(service.materializeFullExportDownload).toHaveBeenCalledTimes(N);
    });
  });

  // Flow / branch coverage: download 는 controller 자체 client 입력 분기가 없다(findJob →
  // materialize raw forward). 따라서 collector 의 성공(2xx)/실패(non-2xx) 분기는 실 응답(200)
  // vs mock reject(404/500)로 커버한다(dual-call 두 실패 지점 각각 위 error path 에서 도달).
  describe("negative cases 충분 cover", () => {
    // (a) 요청 wrapper 가 403(권한 거부 성격의 non-2xx)을 반환 → failures 분류(2xx 아님,
    //     samplesMs 미집계). collector 의 non-2xx 분류가 404/500 뿐 아니라 4xx(403)에도 정상
    //     동작함을 실증(권한 거부 성격 status).
    it("(a) 요청 wrapper 가 403 반환(권한 거부 성격) → failures 로 분류, samplesMs 미집계", async () => {
      const N = 3;

      const result = await collectLatencySamples(injectStatus(403), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) mixed 부분 실패 — 4회 중 1회만 non-2xx(404) → failures 부분 집계 정확성(=1). 2번째
    //     호출만 findJob 이 NotFoundException 을 던지고, 나머지는 정상 download(200).
    it("(b) mixed — 4회 중 1회만 404(NotFound) → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      service.findJob.mockImplementation(async () => {
        call += 1;
        if (call === 2) {
          throw new NotFoundException("export job not found: export-job-1");
        }
        return buildExportJob({ status: "SUCCEEDED" });
      });
      // 성공 호출들에서 collectStream 이 소비할 새 Readable 을 매번 공급.
      service.materializeFullExportDownload.mockImplementation(async () =>
        buildDownloadStream(),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest(), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(1);
      expect(result.samplesMs).toHaveLength(3);
      // 기본 errorRateMax(0.01) 는 25% 실패라 fail. 무관용(0) 로도 fail — 둘 다 확인.
      expect(assertS2Threshold(result).pass).toBe(false);
      expect(assertS2Threshold(result, { errorRateMax: 0 }).pass).toBe(false);
    });

    // (c) iterations 경계(1회) 에서 harness 가 깨지지 않음 — 단일 download 조회로도 정상 200
    //     성공 집계.
    it("(c) iterations===1 경계 → 단일 artifact-stream 조회로도 harness 정상 동작", async () => {
      service.findJob.mockResolvedValue(
        buildExportJob({ status: "SUCCEEDED" }),
      );
      service.materializeFullExportDownload.mockImplementation(async () =>
        buildDownloadStream(),
      );

      const result = await collectLatencySamples(readRequest(), 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findJob).toHaveBeenCalledTimes(1);
      expect(service.materializeFullExportDownload).toHaveBeenCalledTimes(1);
    });

    // (d) harness 는 body 형태에 무관(관심사 분리) — download 는 StreamableFile byte body 를
    //     반환하지만, harness 자체는 2xx 만 성공으로 집계하고 body(stream) shape 는 보지 않음을
    //     실증한다. 요청 wrapper 가 status 만 성공(200)으로 반환하면(body 부재) harness 는 그것도
    //     성공으로 정상 집계 — collector 의 성공 판정이 stream body shape 에 독립임을 증명.
    it("(d) 요청 wrapper 가 body 없이 status 200 만 반환해도 harness 는 성공으로 정상 집계(stream body shape 무관)", async () => {
      const N = 4;

      const result = await collectLatencySamples(injectStatus(200), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
  });
});

// import-modes-read.perf-spec.ts — S2 조회 latency harness 의 *스물여덟 번째 실 perf-spec*
// 이자 **첫 derived-list(/modes) read** 배선.
// (T-0857, load-resilience-test-plan §5 follow-up #2 / REQ-048 조회 p95 < 3s,
// REQ-030 Import mode 선택 / REQ-032 raw 미저장·미노출)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0856
// 가 27 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·
// contribution·user·llm-provider-config·export·import :id detail 10 + group·part
// :id/persons sub-resource 2 + export :id/status-view derived-detail 1)에 배선한 collector
// 를, `ImportController` 의 **derived-list** endpoint 인 `GET /api/admin/import/modes`
// (`describeModes` → 고정 2 mode(Prisma `ImportMode.REPLACE`/`MERGE`)를 lowercase
// `ImportRestoreMode` 로 변환해 `describeImportMode` helper 에 넘겨 각 mode 의
// `ImportModeDescription`(2 원소: REPLACE→destructive=true / MERGE→destructive=false)를 200
// 반환 — client 입력 분기 0, 항상 알려진 2 종 mode 만 helper 로 forward, service 호출 0,
// persistence 0) 에 배선한다. 직전 export :id/status-view slice(T-0856)가 **derived-detail**
// (단건 status 를 view 로 derive)이었다면 본 endpoint 는 고정 목록을 helper 로 derive 하는
// **derived-list** read 라 harness 재사용이 pass-through·조합 detail 뿐 아니라 파생 목록
// read 에서도 유효함을 실증한다. jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)
// 에 매칭돼 `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 →
// picking 0), 앞선 27 perf-spec 과 함께 스물여덟 다 실행된다.
//
// 앞선 running(T-0842)·detail(T-0853)·status-view(T-0856) import/export spec 과의 차이
// (본 spec 고유 특성):
//   - 배선 대상 route 가 running(findRunning)·detail(:id findJob)·status-view
//     (:id/status-view statusView) 가 아니라 `/modes`(describeModes)로 치환된다.
//   - describeModes 핸들러는 **service 를 전혀 호출하지 않는 동기 helper-derive** 다:
//     고정 `[ImportMode.REPLACE, ImportMode.MERGE]` 를 `IMPORT_MODE_ENUM_TO_PAYLOAD` 로
//     lowercase 변환한 뒤 `describeImportMode` 를 실호출해 파생된 `ImportModeDescription[]`
//     (항상 길이 2)를 200 반환한다. 앞선 slice 들의 `findJob`/`findRunning` mock 배선과
//     달리 본 endpoint 는 `ImportJobService` mock 을 부트스트랩 주입만 할 뿐 **호출하지
//     않는다**(service-무의존 read — describeModes 는 mocked service 의 어떤 메서드도
//     touch 하지 않음).
//   - describeModes 는 client 입력 분기가 0(항상 고정 2 mode helper forward)이고 순수
//     helper 라 **자체 예외 경로가 없다**. 따라서 앞선 spec 들이 mocked service 예외로
//     도달하던 non-2xx(error path) 를, 본 spec 은 controller 를 우회할 수 없으므로 **요청
//     wrapper 레벨에서 인위 non-2xx status 를 반환**해 collector 의 실패 분기를 커버한다
//     (describeModes 자체는 항상 200 만 나옴 — 이 차이를 아래 error path·negative (a)~(b)
//     주석에 명시).
//   - `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가 부착된 Admin-tier read
//     라 import-running(T-0842) 의 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
//     useValue(passGuard) 무력화 패턴을 mirror 한다(controller 자체 authorization 분기가
//     없어 RolesGuard 가 가드하는 것을 override 로 통과 — req.user 박제 불요, canActivate
//     true 만으로 충분).
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `ImportJobService` 는 mock(`useValue`) — 부트스트랩 주입만 존재(describeModes 는 이
//     mock 을 호출하지 않음). 실 Postgres round-trip·실 Prisma 없이 controller ↔ helper ↔
//     collector 배선만 측정. baseline 실측(실 DB round-trip)은 §5 item 5 별도 follow-up.
//   - `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () =>
//     true })` 로 통과 — 인증/인가 layer 를 벗겨 순수 harness 배선만 측정.
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, 순수 helper derive 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 요청 wrapper 가 인위 non-2xx status 를 반환하게 만들어 도달(errorRate
//     위반) — 실 latency 에 의존하지 않는 결정론적 fail. describeModes 는 순수-helper 라
//     자체 예외 경로가 없으므로 collector 실패 분기는 요청 wrapper 레벨에서 non-2xx 를
//     주입해 커버한다.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - `describeImportMode`/`IMPORT_MODE_ENUM_TO_PAYLOAD` helper 자체 로직·mode 설명 문자열
//     단위 검증 — helper 전용 unit spec(import-mode-description.spec.ts) 소관. 본 spec 은
//     정상 derive 경로(REPLACE→destructive=true / MERGE→destructive=false)만 배선한다.
//   - `ImportController.findJob`(:id detail, import-detail T-0853)·`findRunning`(running
//     list, import-running T-0842) 재배선 — 본 spec 은 `modes` derived-list 만.
//   - POST/PATCH/DELETE write route perf 배선 — 본 spec 은 조회에 집중.
//   - 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를
//     override 로 무력화한 뒤 latency 배선만(인증 정책은 기존 controller/service spec /
//     roles.guard.spec / e2e).
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/roles.guard";
import { ImportJobService } from "../../src/import/import-job.service";
import { ImportController } from "../../src/import/import.controller";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock ImportJobService — controller 생성자 정합(부트스트랩)용. describeModes 는 순수
// helper-derive 라 이 mock 의 어떤 메서드도 호출하지 않는다(service-무의존 read). service
// shape 정합을 위해 jest.fn 으로 둘 뿐(호출 안 됨) — findRunning/createJob/findJob 모두
// describeModes 경로에서는 발화하지 않는다.
type MockImportJobService = {
  findRunning: jest.Mock;
  createJob: jest.Mock;
  findJob: jest.Mock;
};

describe("S2 조회 latency perf-spec — ImportController derived-list(/modes) 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockImportJobService;

  // 통과 guard — canActivate 가 항상 true. 인증/인가 layer 를 벗겨 harness 배선만 측정.
  // describeModes 는 self-read 가 아니라 고정 2 mode 를 helper 로 derive 하는 순수 핸들러라
  // req.user 박제 불요(RolesGuard 가 가드하는 것을 override 로 통과 — controller 자체
  // authorization 분기 없음).
  const passGuard = { canActivate: () => true };

  beforeAll(async () => {
    service = {
      findRunning: jest.fn(),
      createJob: jest.fn(),
      findJob: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [{ provide: ImportJobService, useValue: service }],
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

  // derived-list endpoint(`GET /api/admin/import/modes`)를 1회 호출하고 collector 가 소비할
  // { status } 를 반환하는 요청 함수. supertest 는 non-2xx 에도 reject 하지 않고 response 를
  // resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로
  // 분류). describeModes 는 항상 200 만 반환하므로 이 실 요청은 happy-path·negative (c)~(d)
  // 에서만 쓰이고, 실패(non-2xx) 분기는 아래 injectStatus wrapper 로 커버한다.
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/admin/import/modes",
    );
    return { status: res.status };
  };

  // 인위 non-2xx 를 주입하는 요청 wrapper — describeModes 는 순수-helper 라 자체 예외 경로가
  // 없으므로(항상 200), collector 의 실패(non-2xx) 분기가 정상 동작함을 실증하려면 요청
  // 함수 레벨에서 non-2xx status 를 직접 반환해야 한다(controller 를 실제로 호출하지 않고
  // status 만 fabricate). isSuccess(200~299) 판정 기준상 이 status 는 failures 로 분류된다.
  const injectStatus =
    (status: number): RequestFn =>
    async () => ({ status });

  describe("happy path — describeModes 정상 응답(200) + derived list", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      const N = 5;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // 순수 helper derive 는 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
    });

    it("응답 body 가 helper derive 결과 ImportModeDescription[](길이 2, REPLACE→destructive=true / MERGE→destructive=false)임을 확인", async () => {
      const res = await request(app.getHttpServer()).get(
        "/api/admin/import/modes",
      );

      expect(res.status).toBe(200);
      // 고정 2 mode helper derive 결과 — REPLACE(destructive=true) → MERGE(destructive=false).
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        destructive: true,
        reason: "replace",
      });
      expect(res.body[1]).toMatchObject({
        destructive: false,
        reason: "merge",
      });
      // describeModes 는 service 를 호출하지 않는다(service-무의존 derive) — mock 미발화 확인.
      expect(service.findRunning).not.toHaveBeenCalled();
      expect(service.findJob).not.toHaveBeenCalled();
      expect(service.createJob).not.toHaveBeenCalled();
    });
  });

  describe("error path — 요청 wrapper 가 인위 non-2xx 반환", () => {
    // describeModes 는 순수-helper 라 자체 예외 경로가 없으므로(항상 200), collector 의 실패
    // 분기는 요청 wrapper 레벨에서 non-2xx 를 주입해 커버한다(controller 자체는 error path 가
    // 없음 — 이 차이가 앞선 findJob/findRunning mock-예외 slice 들과의 고유 차이).
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

  // Flow / branch coverage: describeModes 는 controller 자체 client 입력 분기가 없다(항상
  // 고정 2 mode helper forward). 따라서 collector 의 성공(2xx)/실패(non-2xx) 분기는 정상
  // 응답(실 describeModes 200) vs 인위 non-2xx(injectStatus)로 커버한다(controller 분기 부재).
  describe("negative cases 충분 cover", () => {
    // (a) 요청 wrapper 가 403(권한 거부 성격의 non-2xx)을 반환 → failures 분류(2xx 아님,
    //     samplesMs 미집계). describeModes 자체는 항상 200 이지만 collector 의 non-2xx 분류가
    //     4xx 에도 정상 동작함을 실증(500 과 구분되는 403).
    it("(a) 요청 wrapper 가 403 반환 → failures 로 분류, samplesMs 미집계", async () => {
      const N = 3;

      const result = await collectLatencySamples(injectStatus(403), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(false);
    });

    // (b) mixed 부분 실패 — N회 중 1회만 non-2xx → failures 부분 집계 정확성(=1). 2번째
    //     호출만 500 을 반환하고 나머지는 실 describeModes(200)를 호출.
    it("(b) mixed — 4회 중 1회만 500 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      const mixedRequest: RequestFn = async () => {
        call += 1;
        if (call === 2) {
          return { status: 500 };
        }
        const res = await request(app.getHttpServer()).get(
          "/api/admin/import/modes",
        );
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

    // (c) iterations 경계(1회) 에서 harness 가 깨지지 않음 — 단일 실 describeModes 호출로도
    //     정상 200 성공 집계.
    it("(c) iterations===1 경계 → 단일 derived-list 조회로도 harness 정상 동작", async () => {
      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (d) harness 는 body 형태에 무관(관심사 분리) — describeModes 는 항상 길이 2 배열을
    //     반환하지만, harness 자체는 2xx 만 성공으로 집계하고 body 배열 길이·형태는 보지
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

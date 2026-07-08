// auth-me-read.perf-spec.ts — S2 조회 latency harness 의 *열네 번째 실 perf-spec*.
// (T-0843, load-resilience-test-plan §5 follow-up #14 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830 이
// SummaryController 에, T-0831~T-0842 가 순서대로 Assessment·Contribution·Person·
// Group·Part·User·PermissionDeniedRecord·LlmProviderConfig·DifficultyMapping·
// CronSchedule·Export·ImportController 에 배선한 collector 를, **열네 번째 조회
// endpoint** 인 `AuthController` 의 `GET /api/auth/me`(me → `userService.findById
// (req.user.sub)` → `UserResponseDto.fromEntity` — 인증된 사용자 자기 자신 조회,
// ADR-0008 §6 / REQ-048 조회 back)에 배선한다. harness 가 요약·평가·기여·인원·그룹·
// 파트·사용자·권한거부·LLM설정·난이도매핑·cron스케줄·export러닝·import러닝·auth-me
// 14 read 경로 전반에 재사용됨을 실증한다. jest-perf.json(`testRegex: test/perf/.*\
// .perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만 실행되며(기본 `pnpm test` 는
// `.spec.ts$` 만 매칭 → picking 0), 앞선 열세 perf-spec 과 함께 열네 다 실행된다.
//
// 앞선 slice 와의 차이(본 spec 고유 특성): 앞선 12·13 slice(Export/Import 의 Admin
// 가드 부착 raw-forward list)와 달리 `GET /api/auth/me` 는 (1) `@UseGuards(JwtAuthGuard)`
// **만** 부착(RolesGuard 미적용)된 self-read 이고, (2) **controller 자체 분기가 있는**
// 경로다: req.user.sub 추출 후 부재 시 401(defence in depth), `userService.findById(sub)`
// 가 stale token(DB row 삭제) 시 `NotFoundException`(404), 정상 시 `UserResponseDto
// .fromEntity` 로 5 필드(hashedPassword 제외) 200 반환. 따라서 본 perf-spec 은
// `user-read.perf-spec.ts`(T-0836) 의 passGuard 패턴을 mirror 하되 RolesGuard override
// 부분만 제거한다: `overrideGuard(JwtAuthGuard)` 의 `canActivate` 가 `req.user = { sub }`
// 를 박제해야 me 핸들러가 sub 를 읽어 200/404 분기에 도달한다(req.user 미박제 시 me
// 핸들러가 sub 를 못 읽어 401 분기로 빠져 200/404 미도달).
//
// `AuthController` 생성자는 `AuthService`·`UserRepository`·`JwtService`·`UserService`
// 4 개를 주입받으므로 테스트 모듈은 4 mock 을 `useValue` 로 제공한다. 단 `GET /api/auth/me`
// 경로가 실제로 호출하는 것은 `userService.findById` 뿐이므로 나머지 3 mock 은 shape
// 정합용 jest.fn 만 두면 부트스트랩이 성립한다(RolesGuard 는 미부착 — override 불요).
//
// non-2xx 분류 실증은 mocked `userService.findById` 이 `NotFoundException` 을 던져
// endpoint 가 404 를 반환하는 error path(stale token) 로, 그리고 req.user 미박제 guard
// 를 쓰는 별도 module 의 401 defence-in-depth 분기로 커버한다.
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `UserService` 등 4 provider 는 mock(`useValue`) — 실 Postgres round-trip·실
//     Prisma 없이 controller ↔ collector 배선만 측정. baseline 실측(실 DB round-trip)은
//     §5 item 5 별도 follow-up.
//   - `JwtAuthGuard` 는 `overrideGuard(...)` 로 무력화 — 인증 layer 를 벗겨 순수 harness
//     배선만 측정(실 guard stack / JWT 검증은 별개 auth.controller.spec / jwt.strategy
//     .spec / e2e 책임).
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 mock 예외(404 NotFoundException) 또는 req.user 미박제 401 로 도달
//     (errorRate 위반) — 실 latency 에 무의존한 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST /api/auth/login·logout·refresh 등 write/auth-flow 경로 배선 — 본 spec 은
//     read(GET /api/auth/me) 만 배선.
//   - JWT 발급/검증·cookie rotation·RBAC escalation 자체 검증 — 본 spec 은 me self-read
//     의 latency 배선만(인증 정책은 기존 auth.controller.spec / jwt.strategy.spec / e2e).
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import request from "supertest";

import { AuthController } from "../../src/auth/auth.controller";
import { AuthService } from "../../src/auth/auth.service";
import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { UserRepository } from "../../src/user/user.repository";
import { UserService } from "../../src/user/user.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock UserService — me 경로가 실제로 호출하는 것은 findById 뿐. 각 test 가
// mockResolvedValue / mockRejectedValue 로 응답을 제어해 endpoint status(200 / 404)를
// 결정론적으로 만든다.
type MockUserService = {
  findById: jest.Mock;
};

// self-read actor 의 sub — passGuard 가 req.user 에 박제해 me 핸들러가 이 sub 를 읽어
// userService.findById(sub) 분기(200/404)에 도달하게 하는 최소 payload.
const SELF_SUB = "user-self-1";

// findById 가 반환할 정상 User fixture — UserResponseDto.fromEntity 가 whitelist 하는
// 5 필드(id/email/role/createdAt/updatedAt)에 더해 hashedPassword 도 포함한 shape.
// fromEntity 가 hashedPassword 를 명시적 제외하므로 응답 body 에는 노출되지 않는다
// (아래 happy-path 가 그 whitelist 를 assert).
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: SELF_SUB,
    email: "self@example.com",
    role: "User",
    hashedPassword: "secret-hash-should-not-leak",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    updatedAt: new Date("2026-07-09T00:00:01.000Z"),
    ...overrides,
  } as User;
}

// 4 mock provider 를 useValue 로 제공하고 JwtAuthGuard 를 주어진 guard 로 override 한
// 테스트 앱을 부트스트랩한다. passGuard 의 canActivate 가 req.user 를 박제하는지에 따라
// me 핸들러의 도달 분기(200/404 vs 401)가 갈린다.
async function buildApp(guard: {
  canActivate: (ctx: ExecutionContext) => boolean;
}): Promise<{ app: INestApplication; service: MockUserService }> {
  const service: MockUserService = { findById: jest.fn() };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      // me 경로 미호출 3 provider — shape 정합용 jest.fn 만 둔다(부트스트랩 성립용).
      { provide: AuthService, useValue: { verifyPassword: jest.fn() } },
      { provide: UserRepository, useValue: { findByEmail: jest.fn() } },
      { provide: JwtService, useValue: { verify: jest.fn() } },
      // me 경로가 실제로 호출하는 유일한 provider.
      { provide: UserService, useValue: service },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guard)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, service };
}

describe("S2 조회 latency perf-spec — AuthController me-read 배선 (REQ-048)", () => {
  let app: INestApplication;
  let service: MockUserService;

  // JwtAuthGuard 통과 guard — canActivate 가 항상 true 를 반환하되, req.user 를
  // { sub } payload 로 박제한다. me 핸들러가 actor.sub 를 읽어 userService.findById(sub)
  // 분기(200/404)에 도달하려면 req.user 박제가 필수다(미박제 시 401 defence-in-depth
  // 분기로 빠져 200/404 미도달). RolesGuard 는 본 endpoint 미부착이라 override 불요.
  const passAuthGuard = {
    canActivate: (ctx: ExecutionContext): boolean => {
      const req = ctx.switchToHttp().getRequest<{ user?: { sub: string } }>();
      req.user = { sub: SELF_SUB };
      return true;
    },
  };

  beforeAll(async () => {
    ({ app, service } = await buildApp(passAuthGuard));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 자기 자신 조회를 1회 호출하고 collector 가 소비할 { status } 를 반환하는 요청 함수.
  // supertest 는 non-2xx 에도 reject 하지 않고 response 를 resolve 하므로 status 로 성공
  // 여부를 판정(collector 의 isSuccess 가 200~299 를 성공으로 분류).
  const readRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/me");
    return { status: res.status };
  };

  describe("happy path — mock service 정상 응답(200)", () => {
    it("정상 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass", async () => {
      // mock 이 정상 User 반환 → controller 가 fromEntity 로 200 + JSON object.
      service.findById.mockResolvedValue(buildUser());
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
      // 실제로 controller → mocked service 배선이 발화했는지 확인. me 핸들러가 박제된
      // req.user.sub 를 findById 에 전달했는지도 함께 검증.
      expect(service.findById).toHaveBeenCalledTimes(N);
      expect(service.findById).toHaveBeenCalledWith(SELF_SUB);
    });

    it("응답 body 에 hashedPassword 미노출(UserResponseDto whitelist) — 5 필드만 반환", async () => {
      // fromEntity 가 hashedPassword 를 명시적 제외하므로 응답 body 에는 노출 0.
      service.findById.mockResolvedValue(buildUser());

      const res = await request(app.getHttpServer())
        .get("/api/auth/me")
        .expect(200);

      expect(res.body).toMatchObject({
        id: SELF_SUB,
        email: "self@example.com",
        role: "User",
      });
      // hashedPassword 컬럼 차단 invariant(T-0095) 자동 propagate 검증.
      expect(res.body).not.toHaveProperty("hashedPassword");
    });
  });

  describe("error path — mock service 예외 → endpoint non-2xx(404)", () => {
    it("stale token(findById NotFoundException) 로 404 응답 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // valid signature 이지만 DB row 삭제된 stale token — findById 가 404 throw.
      // Nest 가 NotFoundException 을 404 로 매핑. collector 는 non-2xx 를 failure.
      service.findById.mockRejectedValue(
        new NotFoundException("user not found: user-self-1"),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest, N);

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
    // (a) stale token(404) — error path 로 이미 실증. 여기서는 별도 fixture 로 재확인.
    //     findById 가 NotFoundException 을 던질 때 collector 가 실패로 분류하고
    //     assertS2Threshold 가 fail 임을 재확인(예외 상황 분기 커버).
    it("(a) stale token — findById 가 404(NotFoundException) → collector failures, pass===false", async () => {
      service.findById.mockRejectedValue(new NotFoundException("stale token"));
      const N = 3;

      const result = await collectLatencySamples(readRequest, N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(N);
      expect(result.samplesMs).toHaveLength(0);
      expect(service.findById).toHaveBeenCalledTimes(N);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
    });

    // (b) 인증 컨텍스트 부재(401) — passGuard 가 req.user 를 박제하지 않는 별도 module 로
    //     me 핸들러의 defence-in-depth 분기(sub undefined → 401)를 실증. canActivate 는
    //     true 를 반환하되 req.user 미박제라 me 가 sub 를 못 읽어 401. collector 는 non-2xx
    //     (401)를 failure 로 분류.
    it("(b) 인증 컨텍스트 부재 — req.user 미박제 guard → me 가 401 반환, collector failures, pass===false", async () => {
      // req.user 를 박제하지 않는 guard — canActivate true 지만 user 미설정.
      const noUserGuard = { canActivate: () => true };
      const { app: noUserApp, service: noUserService } =
        await buildApp(noUserGuard);
      try {
        const N = 3;
        const noUserRequest: RequestFn = async () => {
          const res = await request(noUserApp.getHttpServer()).get(
            "/api/auth/me",
          );
          return { status: res.status };
        };

        const result = await collectLatencySamples(noUserRequest, N);

        // req.user 미박제 → me 의 defence-in-depth 분기가 401 반환 → 전부 failure.
        expect(result.total).toBe(N);
        expect(result.failures).toBe(N);
        expect(result.samplesMs).toHaveLength(0);
        // sub 를 못 읽어 findById 에 도달조차 못 함(401 이 앞선 분기).
        expect(noUserService.findById).not.toHaveBeenCalled();
        const assertion = assertS2Threshold(result);
        expect(assertion.pass).toBe(false);
        expect(assertion.errorRate).toBe(1);
      } finally {
        await noUserApp.close();
      }
    });

    // (c) mixed — 다수 호출 중 일부만 404. failures 부분 집계 정확성(=1)을 검증.
    it("(c) mixed — 4회 중 1회만 404 → failures===1 부분 집계 정확, samplesMs===3", async () => {
      let call = 0;
      // 2번째 호출만 404, 나머지는 정상 200.
      service.findById.mockImplementation(() => {
        call += 1;
        if (call === 2) {
          return Promise.reject(new NotFoundException("mocked 간헐 stale"));
        }
        return Promise.resolve(buildUser());
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
      service.findById.mockResolvedValue(buildUser());

      const result = await collectLatencySamples(readRequest, 1);

      expect(result.total).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(1);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(service.findById).toHaveBeenCalledTimes(1);
    });
  });
});

// user-detail-read.perf-spec.ts — S2 조회 latency harness 의 *스물한 번째 실 perf-spec*
// 이자 **일곱 번째 path-param detail(:id) read** 배선(첫 controller 자체 403 분기 detail).
// (T-0850, load-resilience-test-plan §5 follow-up #21 / REQ-048, 조회 p95 < 3s)
//
// 목적: T-0828(percentile/summarizeLatency/errorRate 순수 primitive) + T-0829
// (collectLatencySamples/assertS2Threshold 순수 orchestration)가 신설하고 T-0830~T-0849
// 이 20 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·
// contribution :id detail 6)에 배선한 collector 를, `UserController` 의 **detail** endpoint 인
// `GET /api/users/:id`(`detail` → controller 자체 authorization 분기: isSelf(actor.sub===id)
// 또는 isAdminPlus(actor.role==="Admin"||"SuperAdmin") 통과 시 `userService.findById(id)`
// → `UserResponseDto.fromEntity`(200), 둘 다 false 시 `ForbiddenException`(403 — service
// 미도달), row 부재 시 `NotFoundException`(404))에 배선한다. 직전 T-0849(contribution :id)
// 이 **여섯 번째 path-param `:id` detail read** 였고, 본 spec 은 **일곱 번째 detail(:id) read**
// 이자 **controller 자체 403 분기가 있는 첫 detail(:id)** 라, harness 가 self/Admin+ 인가
// 분기(200/403/404)가 controller 층에 있는 detail 경로에서도 재사용됨을 실증한다.
// jest-perf.json(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf`
// 로만 실행되며(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0), 앞선 20 perf-spec
// 과 함께 스물한 다 실행된다.
//
// 앞선 detail slice 와의 차이(본 spec 고유 특성): person/part/contribution :id detail 은
// controller 가 `findById(id)` 를 raw forward(controller 자체 분기 0)했으나, 본 endpoint 는
// **controller 자체 authorization 분기(isSelf / isAdminPlus)** 가 있다. `@UseGuards
// (JwtAuthGuard)` **만** 부착(RolesGuard 미적용)이라 auth-me-read(T-0843) 의 `overrideGuard
// (JwtAuthGuard)` + `req.user` 박제 패턴을 mirror 하되, me 의 sub-only 박제와 달리
// `req.user = { sub, role }` 를 박제해 detail 핸들러가 self(sub 일치)/Admin+(role) 분기에
// 도달하게 한다(role 박제 없으면 isAdminPlus 분기 미도달). passGuard 의 payload 를 test 별로
// 달리해(User-self / Admin-other / User-other) 200(self)·200(admin)·403(forbidden) 분기를
// 각각 실증하고, mocked `findById` 의 `NotFoundException` 으로 404(not-found) 를 실증한다.
//
// `UserController` 생성자는 `UserService` 하나만 주입받으므로 테스트 모듈은 1 mock 을
// `useValue` 로 제공한다. detail 경로가 실제로 호출하는 것은 `findById` 뿐이므로 나머지
// service 메서드(findAll/changeRole/signup)는 shape 정합용 jest.fn 만 두면 부트스트랩이
// 성립한다. 403 분기는 controller 가 service 도달 전 차단하므로 `findById` 미호출을 함께
// 검증한다(controller layer 분기 차단 — 불필요 DB 조회 회피).
//
// 결정론 전략 (Acceptance — 실 DB·실 Prisma·외부 I/O 무의존):
//   - `UserService` 는 mock(`useValue`) — 실 Postgres round-trip·실 Prisma 없이 controller
//     ↔ collector 배선만 측정. baseline 실측(실 DB round-trip)은 §5 item 5 별도 follow-up.
//   - `JwtAuthGuard` 는 `overrideGuard(...)` 로 무력화 — 인증 layer 를 벗겨 순수 harness
//     배선 + controller 자체 인가 분기만 측정(실 guard stack / JWT 검증은 별개
//     user.controller.spec / jwt.strategy.spec / e2e 책임).
//   - latency 표본 자체는 wall-clock 이라 값은 비결정적이지만, mock service 는 즉시
//     반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달.
//     fail 분기는 passGuard payload(User-other → 403) 또는 mock 예외(404
//     NotFoundException)로 도달(errorRate 위반) — 실 latency 에 무의존한 결정론적 fail.
//
// Out of Scope (task §Out of Scope 정합):
//   - 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 /
//     collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
//   - POST/PATCH 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findById)에 집중.
//   - `GET /api/users` list read 배선(별도 user-read.perf-spec.ts 이미 존재) — 본 spec 은
//     `:id` detail 만.
//   - 다른 미배선 detail(:id) endpoint(import/export/llm-config :id) 배선 — 각각 별도 slice.
//   - 실 JWT 발급·검증·RBAC escalation 자체 검증 — 본 spec 은 detail self/Admin 분기의
//     latency 배선만(인증 정책은 기존 user.controller.spec / jwt.strategy.spec / e2e).
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import request from "supertest";

import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard";
import { UserController } from "../../src/user/user.controller";
import { UserService } from "../../src/user/user.service";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// mock UserService — detail 경로가 실제로 호출하는 것은 findById 뿐. 나머지 메서드는 shape
// 정합용 jest.fn(부트스트랩 성립용). 각 test 가 mockResolvedValue / mockRejectedValue 로
// 응답을 제어해 endpoint status(200 / 404)를 결정론적으로 만든다.
type MockUserService = {
  findById: jest.Mock;
  findAll: jest.Mock;
  changeRole: jest.Mock;
  signup: jest.Mock;
};

// req.user 박제 payload — passGuard 의 canActivate 가 이 값을 req.user 에 심어 detail
// 핸들러가 isSelf(actor.sub===id)/isAdminPlus(actor.role) 분기에 도달하게 한다.
interface ActorPayload {
  sub: string;
  role: string;
}

// self actor 의 sub — 조회 대상 :id 와 동일하게 두면 isSelf true 분기(본인 조회).
const SELF_ID = "user-self-1";
// 타인 조회 대상 :id — SELF_ID 와 다르면 isSelf false(권한 분기 진입).
const OTHER_ID = "user-other-9";

// findById 가 반환할 정상 User fixture — UserResponseDto.fromEntity 가 whitelist 하는 5
// 필드(id/email/role/createdAt/updatedAt)에 더해 hashedPassword 도 포함한 shape. fromEntity
// 가 hashedPassword 를 명시적 제외하므로 응답 body 에는 노출되지 않는다(happy-path 가 assert).
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: SELF_ID,
    email: "self@example.com",
    role: "User",
    hashedPassword: "secret-hash-should-not-leak",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    updatedAt: new Date("2026-07-09T00:00:01.000Z"),
    ...overrides,
  } as User;
}

// UserService mock 을 useValue 로 제공하고 JwtAuthGuard 를 주어진 payload 를 박제하는
// guard 로 override 한 테스트 앱을 부트스트랩한다. actor payload 에 따라 detail 핸들러의
// 도달 분기(200 self / 200 admin / 403 forbidden)가 갈린다.
async function buildApp(
  actor: ActorPayload,
): Promise<{ app: INestApplication; service: MockUserService }> {
  const service: MockUserService = {
    findById: jest.fn(),
    findAll: jest.fn(),
    changeRole: jest.fn(),
    signup: jest.fn(),
  };

  // canActivate 가 항상 true 를 반환하되 req.user 를 { sub, role } 로 박제한다. detail
  // 핸들러가 actor.sub(isSelf)·actor.role(isAdminPlus)를 읽어 인가 분기에 도달하려면 이
  // 박제가 필수다(role 미박제 시 isAdminPlus 분기 미도달).
  const guard = {
    canActivate: (ctx: ExecutionContext): boolean => {
      const req = ctx.switchToHttp().getRequest<{ user?: ActorPayload }>();
      req.user = { ...actor };
      return true;
    },
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [UserController],
    providers: [{ provide: UserService, useValue: service }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guard)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, service };
}

describe("S2 조회 latency perf-spec — UserController detail(:id) 배선 (REQ-048)", () => {
  // 단일 User 상세 조회 endpoint(`GET /api/users/:id`)를 1회 호출하고 collector 가 소비할
  // { status } 를 반환하는 요청 함수 factory. supertest 는 non-2xx 에도 reject 하지 않고
  // response 를 resolve 하므로 status 로 성공 여부를 판정(collector 의 isSuccess 가 200~299
  // 를 성공으로 분류).
  const readRequest =
    (app: INestApplication, id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/users/${id}`);
      return { status: res.status };
    };

  describe("happy path — self actor 정상 응답(200)", () => {
    let app: INestApplication;
    let service: MockUserService;

    beforeAll(async () => {
      // actor.sub === 조회 대상 id → isSelf true(본인 조회 path).
      ({ app, service } = await buildApp({ sub: SELF_ID, role: "User" }));
    });
    afterAll(async () => {
      await app.close();
    });
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("self 본인 조회 200 응답 N회 → total===N, failures===0, samplesMs.length===N, assertS2Threshold pass, findById N회 SELF 호출", async () => {
      // mock 이 정상 User 반환 → controller 가 fromEntity 로 200 + JSON object.
      service.findById.mockResolvedValue(buildUser());
      const N = 5;

      const result = await collectLatencySamples(readRequest(app, SELF_ID), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      // mock service 는 즉시 반환 → p95 는 임계(3000ms) 훨씬 아래 → pass 분기 도달.
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.reasons).toHaveLength(0);
      expect(assertion.errorRate).toBe(0);
      // isSelf 분기 통과 후 controller → mocked service 배선이 발화했는지 확인. detail
      // 핸들러가 :id 를 findById 에 그대로 전달했는지도 함께 검증.
      expect(service.findById).toHaveBeenCalledTimes(N);
      expect(service.findById).toHaveBeenCalledWith(SELF_ID);
    });

    it("응답 body 에 hashedPassword 미노출(UserResponseDto whitelist) — 5 필드만 반환", async () => {
      // fromEntity 가 hashedPassword 를 명시적 제외하므로 응답 body 에는 노출 0.
      service.findById.mockResolvedValue(buildUser());

      const res = await request(app.getHttpServer())
        .get(`/api/users/${SELF_ID}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: SELF_ID,
        email: "self@example.com",
        role: "User",
      });
      // hashedPassword 컬럼 차단 invariant(T-0095) 자동 propagate 검증.
      expect(res.body).not.toHaveProperty("hashedPassword");
    });
  });

  describe("branch coverage — Admin+ actor 타인 조회 통과(200)", () => {
    let app: INestApplication;
    let service: MockUserService;

    beforeAll(async () => {
      // actor.role === "Admin" → isAdminPlus true → 타인(OTHER_ID) 조회도 통과.
      ({ app, service } = await buildApp({
        sub: "admin-actor-1",
        role: "Admin",
      }));
    });
    afterAll(async () => {
      await app.close();
    });
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("Admin actor 가 타인 조회 → isAdminPlus 통과, 200 N회, findById N회 OTHER 호출", async () => {
      // isSelf false(sub!==id) 이지만 isAdminPlus true(role="Admin") → service 도달.
      service.findById.mockResolvedValue(buildUser({ id: OTHER_ID }));
      const N = 4;

      const result = await collectLatencySamples(readRequest(app, OTHER_ID), N);

      expect(result.total).toBe(N);
      expect(result.failures).toBe(0);
      expect(result.samplesMs).toHaveLength(N);
      expect(assertS2Threshold(result).pass).toBe(true);
      // Admin+ 분기로 통과했으므로 controller 가 findById(OTHER_ID) 를 호출.
      expect(service.findById).toHaveBeenCalledTimes(N);
      expect(service.findById).toHaveBeenCalledWith(OTHER_ID);
    });
  });

  describe("error path — self actor + findById NotFoundException → 404", () => {
    let app: INestApplication;
    let service: MockUserService;

    beforeAll(async () => {
      ({ app, service } = await buildApp({ sub: SELF_ID, role: "User" }));
    });
    afterAll(async () => {
      await app.close();
    });
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("isSelf 통과 + findById NotFoundException → 404 N회 → 전부 failures, assertS2Threshold pass===false + errorRate 사유", async () => {
      // 인가는 통과(isSelf true)했으나 row 부재 — findById 가 404 throw. Nest 가
      // NotFoundException 을 404 로 매핑. collector 는 non-2xx 를 failure.
      service.findById.mockRejectedValue(
        new NotFoundException(`user not found: ${SELF_ID}`),
      );
      const N = 4;

      const result = await collectLatencySamples(readRequest(app, SELF_ID), N);

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
    // (a) User actor 가 타인 조회 → isSelf false + isAdminPlus false → 403 ForbiddenException.
    //     controller 가 service 도달 전 차단하므로 findById 미호출을 함께 검증.
    it("(a) User actor 가 타인 조회 → 403(Forbidden) failures 분류 + findById 미호출(service 도달 전 차단)", async () => {
      // sub!==id(isSelf false) + role="User"(isAdminPlus false) → 403.
      const { app, service } = await buildApp({ sub: SELF_ID, role: "User" });
      try {
        const N = 3;

        const result = await collectLatencySamples(
          readRequest(app, OTHER_ID),
          N,
        );

        // 403 은 non-2xx → 전부 failures.
        expect(result.total).toBe(N);
        expect(result.failures).toBe(N);
        expect(result.samplesMs).toHaveLength(0);
        // controller 자체 분기가 service 도달 전 차단 — findById 호출 0.
        expect(service.findById).not.toHaveBeenCalled();
        const assertion = assertS2Threshold(result);
        expect(assertion.pass).toBe(false);
        expect(assertion.errorRate).toBe(1);
      } finally {
        await app.close();
      }
    });

    // (b) 존재하지 않는 id 조회(인가 통과) → 404 NotFoundException. 403 과 구분되는 non-2xx
    //     (권한 부족 vs 존재 부재)를 명시적으로 별도 커버.
    it("(b) 존재하지 않는 id 조회(self) → 404(NotFound) failures 분류(403 과 구분되는 non-2xx)", async () => {
      const { app, service } = await buildApp({ sub: SELF_ID, role: "User" });
      try {
        service.findById.mockRejectedValue(
          new NotFoundException("user not found: user-self-1"),
        );
        const N = 3;

        const result = await collectLatencySamples(
          readRequest(app, SELF_ID),
          N,
        );

        expect(result.failures).toBe(N);
        expect(result.samplesMs).toHaveLength(0);
        // 403 과 달리 인가는 통과했으므로 findById 는 호출됨(그 뒤 404).
        expect(service.findById).toHaveBeenCalledTimes(N);
        expect(assertS2Threshold(result).pass).toBe(false);
      } finally {
        await app.close();
      }
    });

    // (c) mixed 부분 실패 — self 인가 통과 상태에서 4회 중 1회만 404 → failures 부분 집계
    //     정확성(=1). errorRateMax:0 로도 fail.
    it("(c) mixed — 4회 중 1회만 404 → failures===1 부분 집계 정확, samplesMs===3, errorRateMax:0 로도 fail", async () => {
      const { app, service } = await buildApp({ sub: SELF_ID, role: "User" });
      try {
        let call = 0;
        // 2번째 호출만 404, 나머지는 정상 200.
        service.findById.mockImplementation(async () => {
          call += 1;
          if (call === 2) {
            throw new NotFoundException("user not found: user-self-1");
          }
          return buildUser();
        });
        const N = 4;

        const result = await collectLatencySamples(
          readRequest(app, SELF_ID),
          N,
        );

        expect(result.total).toBe(N);
        expect(result.failures).toBe(1);
        expect(result.samplesMs).toHaveLength(3);
        // 기본 errorRateMax(0.01) 는 25% 실패라 fail. 무관용(0) 로도 fail — 둘 다 확인.
        expect(assertS2Threshold(result).pass).toBe(false);
        expect(assertS2Threshold(result, { errorRateMax: 0 }).pass).toBe(false);
      } finally {
        await app.close();
      }
    });

    // (d) iterations 경계(1회) 에서 harness 가 깨지지 않음.
    it("(d) iterations===1 경계 → 단일 상세 조회로도 harness 정상 동작", async () => {
      const { app, service } = await buildApp({ sub: SELF_ID, role: "User" });
      try {
        service.findById.mockResolvedValue(buildUser());

        const result = await collectLatencySamples(
          readRequest(app, SELF_ID),
          1,
        );

        expect(result.total).toBe(1);
        expect(result.failures).toBe(0);
        expect(result.samplesMs).toHaveLength(1);
        expect(assertS2Threshold(result).pass).toBe(true);
        expect(service.findById).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });
  });
});

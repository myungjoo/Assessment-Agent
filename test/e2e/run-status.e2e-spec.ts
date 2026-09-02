// run-status.e2e-spec.ts — `GET /api/run-status` 의 실 HTTP 계약 고정 e2e
// (T-1847, ADR-0060 §Follow-ups (d)).
//
// 책임:
//   - (a)~(c) slice 가 이미 서빙 중인 route 를 **실 요청으로** 고정한다. controller unit
//     spec 은 service 위임 단위만 보고 `app.module.spec.ts` 는 DI 등록만 보므로, 실
//     guard stack(JwtAuthGuard → RolesGuard) · HTTP status · JSON 직렬화 결과를 확인하는
//     층이 본 spec 이다(CLAUDE.md §3.2 R-113 — unit 외에 e2e 도 CI 에서 수행).
//   - ADR-0060 §Decision 2 응답 표의 8 필드 · 두 불변식 · `observedAt` 갱신, §Decision 3
//     의 RBAC(User+ 인증 200 · 미인증 401 · 인증된 사용자에게 403 경로 없음)을 계약으로 박제.
//   - production 코드 변경 0 — 본 slice 는 검증층만 추가한다.
//
// 실 DB 전략(ADR-0004 — 다른 인증 e2e 와 동일): mock override 없이
// `createAuthenticatedE2EApp` 가 AppModule 을 부트스트랩하고 PrismaService 가 실
// connection 을 쓴다. 로컬 `DATABASE_URL` 부재 시 CI 의 `test:e2e` step 에서만 green.
//
// DB 격리: 본 endpoint 는 DB write 가 **0** 이므로 `afterEach(truncateAll)` 을 두지 않는다.
// truncate 를 넣으면 actor `User` row 가 지워져 `reseedAuthenticatedActors` 동반이
// 강제되는데(선례 T-0802), 지울 것이 없는 spec 에서 그 비용을 낼 이유가 없다. 대신
// `afterAll` 에서 `truncateAll` 1 회로 seed 한 actor 를 정리한 뒤 `app.close()` +
// `$disconnect()` 한다 — 본 spec 이 남긴 `User` row 가 뒤따르는 e2e 파일(maxWorkers: 1
// 순차 실행)의 첫 test 로 새지 않게 하기 위한 최소 정리다.
//
// 상태 조작 방식: 실행 상태는 프로세스 in-memory 카운터(ADR-0060 §Decision 1)라
// HTTP 로 켤 방법이 없다(켜는 진입점은 전부 비용 있는 실행이다). 그래서
// `ctx.moduleRef.get(RunStatusService)` 로 **부트스트랩된 바로 그 인스턴스**를 잡아
// `begin` / `end` 로 직접 조작한다. 조작한 test 는 `try/finally` 로 원복하고, 그래도
// 새는 경우를 막기 위해 `afterEach` 가 두 축을 0 까지 배수(drain)한다 — 축 상태가
// test 사이로 새면 다른 test 의 기대값이 조용히 깨지기 때문이다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  RUN_AXES,
  RunStatusService,
  type RunAxis,
} from "../../src/run-status/run-status.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const RUN_STATUS = "/api/run-status";

// ADR-0060 §Decision 2 응답 표의 top-level key 집합(정확히 이것뿐이어야 한다).
const TOP_LEVEL_KEYS = ["active", "evaluation", "collection", "observedAt"];
// 각 축 객체의 key 집합(정확히 이것뿐이어야 한다). top-level 4 + 축 2 × 3 = 8 필드.
const AXIS_KEYS = ["active", "runningCount", "startedAt"];

const USER_EMAIL = "run-status-user-actor@e2e.test";
const ADMIN_EMAIL = "run-status-admin-actor@e2e.test";

describe("E2E: GET /api/run-status (T-1847, ADR-0060 §Decision 2/§Decision 3)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let runStatus: RunStatusService;
  // RBAC actor — User(최소 tier 200 검증) / Admin(ROLE_HIERARCHY 통과 검증).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_EMAIL },
      { role: "Admin", email: ADMIN_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    // 부트스트랩된 AppModule 의 실제 singleton — controller 가 주입받은 것과 같은 인스턴스.
    runStatus = ctx.moduleRef.get<RunStatusService>(RunStatusService);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
  });

  afterAll(async () => {
    // seed 한 actor `User` 2 명을 정리 — 본 spec 은 DB write 가 0 이라 이것이 유일한 잔여물.
    await truncateAll(prisma);
    await app.close();
    await prisma.$disconnect();
  });

  // 축 상태 누수 방지 — 조작을 남긴 test 가 있어도 다음 test 는 항상 비실행에서 시작한다.
  afterEach(() => {
    RUN_AXES.forEach((axis: RunAxis) => {
      let guard = 0;
      while (runStatus.snapshot()[axis].runningCount > 0 && guard < 100) {
        runStatus.end(axis);
        guard += 1;
      }
    });
  });

  // 인증된 GET 1 회 — 반복되는 supertest 호출 형태를 한 곳에 모은다.
  const getStatus = (cookie: string, path: string = RUN_STATUS) =>
    request(app.getHttpServer()).get(path).set("Cookie", cookie);

  // ADR-0060 §Decision 2 표의 타입 계약 + 두 불변식을 한 번에 검사한다.
  const expectContract = (body: Record<string, unknown>): void => {
    expect(typeof body.active).toBe("boolean");
    expect(typeof body.observedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(body.observedAt)))).toBe(false);

    RUN_AXES.forEach((axis: RunAxis) => {
      const status = body[axis] as Record<string, unknown>;
      expect(typeof status.active).toBe("boolean");
      expect(Number.isInteger(status.runningCount)).toBe(true);
      expect(status.runningCount as number).toBeGreaterThanOrEqual(0);
      // 축 불변식: active === (runningCount > 0).
      expect(status.active).toBe((status.runningCount as number) > 0);
      // startedAt 은 실행 중이면 파싱 가능한 ISO-8601 string, 비실행이면 정확히 null.
      if (status.active === true) {
        expect(typeof status.startedAt).toBe("string");
        expect(Number.isNaN(Date.parse(String(status.startedAt)))).toBe(false);
      } else {
        expect(status.startedAt).toBeNull();
      }
    });

    // 전역 불변식: active === (evaluation.active || collection.active).
    const evaluation = body.evaluation as Record<string, unknown>;
    const collection = body.collection as Record<string, unknown>;
    expect(body.active).toBe(
      evaluation.active === true || collection.active === true,
    );
  };

  // -- happy 200 --

  it("User cookie 로 호출 시 200 + ADR-0060 §Decision 2 의 8 필드 전부와 타입 계약 (authed happy)", async () => {
    const response = await getStatus(userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    TOP_LEVEL_KEYS.forEach((key) => expect(response.body).toHaveProperty(key));
    AXIS_KEYS.forEach((key) => {
      expect(response.body.evaluation).toHaveProperty(key);
      expect(response.body.collection).toHaveProperty(key);
    });
    expectContract(response.body);
  });

  it("Admin cookie 로도 200 — ROLE_HIERARCHY 통과라 인증된 사용자에게 403 경로가 없다 (§Decision 3)", async () => {
    const response = await getStatus(adminCookie);

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(403);
    expectContract(response.body);
  });

  it("비실행 상태의 startedAt 은 두 축 모두 정확히 null 이다 (undefined · 빈 문자열 금지)", async () => {
    const response = await getStatus(userCookie);

    expect(response.status).toBe(200);
    RUN_AXES.forEach((axis: RunAxis) => {
      expect(response.body[axis].startedAt).toBeNull();
      expect(response.body[axis].startedAt).not.toBeUndefined();
      expect(response.body[axis]).toHaveProperty("startedAt");
    });
  });

  // -- error path 401 ×2 --

  it("cookie 부재 시 401 이고 body 에 실행 상태 필드가 새지 않는다 (error — JwtAuthGuard)", async () => {
    const response = await request(app.getHttpServer()).get(RUN_STATUS);

    expect(response.status).toBe(401);
    TOP_LEVEL_KEYS.forEach((key) =>
      expect(response.body).not.toHaveProperty(key),
    );
  });

  it("위조 문자열 · 만료 토큰 cookie 로 호출해도 401 이다 (error — JWT verify fail)", async () => {
    const forged = await request(app.getHttpServer())
      .get(RUN_STATUS)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));
    expect(forged.status).toBe(401);
    expect(forged.body).not.toHaveProperty("active");

    // 서명은 유효하나 이미 만료된 토큰 — verify 단계에서 401.
    const expiredToken = ctx.jwtService.sign(
      { sub: ctx.users[USER_EMAIL].id, role: "User" },
      { expiresIn: "-1s" },
    );
    const expired = await getStatus(buildAuthCookie(expiredToken));
    expect(expired.status).toBe(401);
    expect(expired.body).not.toHaveProperty("active");
  });

  // -- 분기 cover: 축 조합 4 종 --

  it("분기 ① 비실행 — active false, 두 축 runningCount 0 · startedAt null", async () => {
    const response = await getStatus(userCookie);

    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);
    expect(response.body.evaluation.runningCount).toBe(0);
    expect(response.body.collection.runningCount).toBe(0);
    expect(response.body.evaluation.startedAt).toBeNull();
    expect(response.body.collection.startedAt).toBeNull();
    expectContract(response.body);
  });

  it("분기 ② 평가 축만 실행 — evaluation.active true · collection.active false · active true", async () => {
    runStatus.begin("evaluation");
    try {
      const response = await getStatus(userCookie);

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      expect(response.body.evaluation.active).toBe(true);
      expect(response.body.evaluation.runningCount).toBe(1);
      expect(typeof response.body.evaluation.startedAt).toBe("string");
      expect(Number.isNaN(Date.parse(response.body.evaluation.startedAt))).toBe(
        false,
      );
      expect(response.body.collection.active).toBe(false);
      expect(response.body.collection.startedAt).toBeNull();
      expectContract(response.body);
    } finally {
      runStatus.end("evaluation");
    }
  });

  it("분기 ③ 수집 축만 실행 — collection.active true · evaluation.active false · active true", async () => {
    runStatus.begin("collection");
    try {
      const response = await getStatus(userCookie);

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      expect(response.body.collection.active).toBe(true);
      expect(response.body.collection.runningCount).toBe(1);
      expect(typeof response.body.collection.startedAt).toBe("string");
      expect(response.body.evaluation.active).toBe(false);
      expect(response.body.evaluation.runningCount).toBe(0);
      expect(response.body.evaluation.startedAt).toBeNull();
      expectContract(response.body);
    } finally {
      runStatus.end("collection");
    }
  });

  it("분기 ④ 두 축 동시 실행 — 양쪽 active true · startedAt 둘 다 ISO-8601 string", async () => {
    runStatus.begin("evaluation");
    runStatus.begin("collection");
    try {
      const response = await getStatus(userCookie);

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      RUN_AXES.forEach((axis: RunAxis) => {
        expect(response.body[axis].active).toBe(true);
        expect(response.body[axis].runningCount).toBe(1);
        expect(typeof response.body[axis].startedAt).toBe("string");
        expect(Number.isNaN(Date.parse(response.body[axis].startedAt))).toBe(
          false,
        );
      });
      expectContract(response.body);
    } finally {
      runStatus.end("evaluation");
      runStatus.end("collection");
    }
  });

  // -- negative cases --

  it("negative (1) 응답 key 집합이 정확히 8 필드뿐이라 내부 구현 필드가 새지 않는다", async () => {
    const response = await getStatus(userCookie);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(
      [...TOP_LEVEL_KEYS].sort(),
    );
    RUN_AXES.forEach((axis: RunAxis) => {
      expect(Object.keys(response.body[axis]).sort()).toEqual(
        [...AXIS_KEYS].sort(),
      );
    });
  });

  it("negative (2) 두 불변식이 실행 · 비실행 양쪽에서 성립한다", async () => {
    const idle = await getStatus(userCookie);
    expect(idle.status).toBe(200);
    expect(idle.body.active).toBe(false);
    expectContract(idle.body);

    runStatus.begin("evaluation");
    try {
      const running = await getStatus(userCookie);
      expect(running.status).toBe(200);
      expect(running.body.active).toBe(true);
      expectContract(running.body);
    } finally {
      runStatus.end("evaluation");
    }
  });

  it("negative (3) 같은 축 begin 2 회 후 end 1 회면 여전히 active true 이고 runningCount 만 2 → 1", async () => {
    runStatus.begin("evaluation");
    runStatus.begin("evaluation");
    try {
      const two = await getStatus(userCookie);
      expect(two.status).toBe(200);
      expect(two.body.evaluation.runningCount).toBe(2);
      expect(two.body.evaluation.active).toBe(true);
      const earliest = two.body.evaluation.startedAt;

      runStatus.end("evaluation");

      const one = await getStatus(userCookie);
      expect(one.status).toBe(200);
      expect(one.body.evaluation.runningCount).toBe(1);
      expect(one.body.evaluation.active).toBe(true);
      expect(one.body.active).toBe(true);
      // end 는 가장 늦게 시작한 것을 제거하므로 가장 이른 startedAt 은 그대로다.
      expect(one.body.evaluation.startedAt).toBe(earliest);
    } finally {
      runStatus.end("evaluation");
    }
  });

  it("negative (4) 연속 2 회 조회 시 observedAt 은 갱신되고 조회 자체는 카운터를 바꾸지 않는다 (부수효과 0)", async () => {
    runStatus.begin("collection");
    try {
      const first = await getStatus(userCookie);
      expect(first.status).toBe(200);
      expect(first.body.collection.runningCount).toBe(1);

      // observedAt 은 ms 해상도라 두 요청이 같은 ms 에 들어오면 값이 같을 수 있다.
      // 갱신 여부를 결정적으로 보기 위해 최소 간격을 둔다.
      await new Promise((resolve) => setTimeout(resolve, 20));

      const second = await getStatus(userCookie);
      expect(second.status).toBe(200);
      expect(Date.parse(second.body.observedAt)).toBeGreaterThan(
        Date.parse(first.body.observedAt),
      );
      // 조회는 begin / end 를 부르지 않으므로 카운터와 startedAt 이 불변이다.
      expect(second.body.collection.runningCount).toBe(1);
      expect(second.body.collection.startedAt).toBe(
        first.body.collection.startedAt,
      );
      expect(second.body.evaluation.runningCount).toBe(0);
    } finally {
      runStatus.end("collection");
    }
  });

  it("negative (5) POST /api/run-status 는 404 — route 는 @Get() 하나뿐이다", async () => {
    const response = await request(app.getHttpServer())
      .post(RUN_STATUS)
      .set("Cookie", userCookie)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("active");
  });

  it("negative (6) 계약에 없는 query parameter 를 붙여도 200 + 동일 shape 이다 (query 0 계약)", async () => {
    const response = await getStatus(userCookie, `${RUN_STATUS}?foo=bar`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(
      [...TOP_LEVEL_KEYS].sort(),
    );
    expectContract(response.body);
  });
});

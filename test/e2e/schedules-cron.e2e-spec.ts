// schedules-cron.e2e-spec.ts — /api/schedules cron 스케줄 REST 4 route 의 HTTP
// contract + 등록·조회·삭제 lifecycle + RBAC tier enforce e2e (T-1968, REQ-039/REQ-043).
// llm-provider-configs.e2e-spec.ts(T-1967) 패턴 1:1 mirror.
//
// 책임: CronScheduleController(`api/schedules`, 4 route 모두 Admin+ tier) →
// CronScheduleService(SchedulerRegistry wrapper) 의 실 배선을 end-to-end 로 고정한다.
// isValidCronExpression / registerOrReplace 의 단위 분기는 각 service · controller
// spec 책임이고, 본 spec 은 실 HTTP 왕복에서만 드러나는 계약만 박제한다.
//
// 고정하는 계약 5 가지:
//   - PUT → GET → DELETE → GET lifecycle 왕복. PUT 200 직후 GET 이 등록 name 을 포함
//     하고, DELETE 204 직후 GET 이 그 name 을 더는 포함하지 않는다.
//   - 등록 0 건 GET 은 200 + [] 이며 404 가 아니다(컬렉션 조회의 정상 결과).
//   - 동일 name 재등록(PUT 2 회)은 200 이고 GET 결과에 그 name 이 1 개만 남는다 —
//     중복 등록이 아니라 교체다(registerOrReplace 의 delete-then-add 분기).
//   - 부재 name DELETE 404 · 유효하지 않은 cron 식 PUT 400 · 공백만 name PUT 400
//     (DTO 의 @IsNotEmpty 는 trim 하지 않아 통과하고 service 가 거부하는 경계) 이
//     controller 변환 없이 raw forward 된다. ValidationPipe 거부 축(누락 · 빈 문자열 ·
//     wrong type · 정의되지 않은 extra 키)도 모두 400.
//   - User tier 는 403, cookie 부재 · 변조 JWT 는 401 이며(4 route 전수) 어느 실패
//     경로도 cron registry 상태를 바꾸지 않는다. SuperAdmin 은 RolesGuard escalation
//     으로 통과(과차단 없음).
//
// 실 DB 전략(ADR-0004): mock override 0. createAuthenticatedE2EApp 가 AppModule
// 부트스트랩 + actor seed, PrismaService 가 실 connection. 본 endpoint 군은 DB row 를
// 만들지 않으므로 truncateAll 은 쓰지 않는다(actor seed 를 지우고 재-seed 를 강요할
// 뿐 얻는 격리가 없다). 대신 afterEach 가 등록된 cron name 을 전수 삭제해 살아 있는
// CronJob 이 jest open handle 로 남지 않게 한다.
//
// cron 식은 매일 03:00 / 04:00 이라 실행 중 발화 · 타이머 sleep 0. 로컬 DATABASE_URL
// 부재 시 본 spec 은 CI 의 pnpm test:e2e(R-113) 에서만 실행된다.
import type { INestApplication } from "@nestjs/common";
import request, { type Test } from "supertest";

import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";

const SCHEDULES_URL = "/api/schedules";
const TRIGGER_URL = `${SCHEDULES_URL}/trigger`;

// 발화하지 않는 cron 식 2 개(매일 03:00 / 04:00) — 교체 분기용 서로 다른 주기.
const DAILY_3AM = "0 3 * * *";
const DAILY_4AM = "0 4 * * *";

const JOB_NAME = "e2e-cron-job-alpha";

type RouteMethod = "get" | "put" | "delete" | "post";

// 인증 실패 3 조건 — User tier 미달 / 쿠키 부재 / 변조 JWT.
type AuthKind = "user" | "none" | "tampered";

interface RouteCase {
  label: string;
  method: RouteMethod;
  url: string;
  body?: Record<string, unknown>;
}

// 4 route 전수 — RBAC/인증 negative 축을 route × 조건 표로 압축하기 위한 목록.
const ROUTES: RouteCase[] = [
  { label: "GET /api/schedules", method: "get", url: SCHEDULES_URL },
  {
    label: "PUT /api/schedules",
    method: "put",
    url: SCHEDULES_URL,
    body: { name: JOB_NAME, cronExpression: DAILY_3AM },
  },
  {
    label: "DELETE /api/schedules/:name",
    method: "delete",
    url: `${SCHEDULES_URL}/${JOB_NAME}`,
  },
  { label: "POST /api/schedules/trigger", method: "post", url: TRIGGER_URL },
];

describe("E2E: /api/schedules cron 스케줄 REST (T-1968, REQ-039/REQ-043)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  // RBAC actor token — User(403 tier 미달) / Admin(통과) / SuperAdmin(escalation 통과).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  // send — route 표 1 행을 실 요청으로 변환한다. cookie 미지정 = 인증 부재 분기.
  function send(route: RouteCase, cookie?: string): Test {
    const req = request(app.getHttpServer())[route.method](route.url);
    if (cookie !== undefined) {
      req.set("Cookie", cookie);
    }
    return route.body === undefined ? req : req.send(route.body);
  }

  // listNames — Admin 으로 현재 등록 name 배열 조회(200 전제).
  async function listNames(cookie: string = adminCookie): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(SCHEDULES_URL)
      .set("Cookie", cookie);
    expect(response.status).toBe(200);
    return response.body as string[];
  }

  // upsert — PUT 1 회. 호출 측이 status 를 단언한다.
  function upsert(name: string, cronExpression: string, cookie = adminCookie) {
    return request(app.getHttpServer())
      .put(SCHEDULES_URL)
      .set("Cookie", cookie)
      .send({ name, cronExpression });
  }

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "cron-schedule-user-actor@e2e.test" },
      { role: "Admin", email: "cron-schedule-admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "cron-schedule-super-actor@e2e.test" },
    ]);
    app = ctx.app;
    userCookie = buildAuthCookie(
      ctx.tokens["cron-schedule-user-actor@e2e.test"],
    );
    adminCookie = buildAuthCookie(
      ctx.tokens["cron-schedule-admin-actor@e2e.test"],
    );
    superAdminCookie = buildAuthCookie(
      ctx.tokens["cron-schedule-super-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await ctx.prisma.$disconnect();
  });

  // 등록된 cron job 전수 삭제 — 살아 있는 CronJob 이 다음 it 로 새거나 jest open
  // handle 로 남지 않게 한다(DB row 를 만들지 않으므로 truncate 는 불요).
  afterEach(async () => {
    for (const name of await listNames()) {
      await request(app.getHttpServer())
        .delete(`${SCHEDULES_URL}/${encodeURIComponent(name)}`)
        .set("Cookie", adminCookie);
    }
  });

  // -- happy path: PUT → GET → DELETE → GET lifecycle 왕복 --

  it("Admin 으로 PUT 200 → GET 이 name 포함 → DELETE 204 → GET 이 name 미포함 (happy — 등록·조회·삭제 lifecycle 왕복)", async () => {
    const created = await upsert(JOB_NAME, DAILY_3AM);
    expect(created.status).toBe(200);

    const afterPut = await listNames();
    expect(afterPut).toContain(JOB_NAME);

    const deleted = await request(app.getHttpServer())
      .delete(`${SCHEDULES_URL}/${JOB_NAME}`)
      .set("Cookie", adminCookie);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const afterDelete = await listNames();
    expect(afterDelete).not.toContain(JOB_NAME);
  });

  it("Admin 으로 POST /api/schedules/trigger 시 202 (happy — manual trigger 수락, tick handler 는 module 기본 stub)", async () => {
    const response = await request(app.getHttpServer())
      .post(TRIGGER_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(202);
    // fire-and-forget — trigger 는 registry 를 건드리지 않는다.
    expect(await listNames()).toEqual([]);
  });

  // -- 분기 (i): 등록 0 건 GET → 200 + [] (404 아님) --

  it("등록 0 건 상태의 Admin GET 이 200 + 빈 배열이고 404 가 아님 (branch — 부트스트랩 자동 등록 job 0 인 기준선)", async () => {
    const response = await request(app.getHttpServer())
      .get(SCHEDULES_URL)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual([]);
  });

  // -- 분기 (ii): 동일 name 재등록 = 교체(중복 등록 아님) --

  it("동일 name 을 다른 cron 식으로 PUT 2 회 시 둘 다 200 이고 GET 결과에 그 name 이 1 개만 (branch — registerOrReplace 의 교체 분기)", async () => {
    expect((await upsert(JOB_NAME, DAILY_3AM)).status).toBe(200);
    expect((await upsert(JOB_NAME, DAILY_4AM)).status).toBe(200);

    const names = await listNames();
    expect(names.filter((n) => n === JOB_NAME)).toHaveLength(1);
    expect(names).toHaveLength(1);
  });

  // -- 분기 (iii): SuperAdmin escalation (과차단 없음) --

  it("SuperAdmin 쿠키로 PUT 200 + GET 200 (branch — RolesGuard escalation 이 403 으로 과차단되지 않음)", async () => {
    expect((await upsert(JOB_NAME, DAILY_3AM, superAdminCookie)).status).toBe(
      200,
    );
    expect(await listNames(superAdminCookie)).toContain(JOB_NAME);
  });

  // -- error path: service 예외 raw forward --

  it("등록되지 않은 name 을 DELETE 하면 404 (error — service NotFoundException raw forward, 204 로 뭉개지지 않음)", async () => {
    const response = await request(app.getHttpServer())
      .delete(`${SCHEDULES_URL}/absent-cron-job-name`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(204);
    expect(await listNames()).toEqual([]);
  });

  it("유효하지 않은 cron 식으로 PUT 하면 400 이고 등록되지 않음 (error — isValidCronExpression 거부 후 addCronJob 미호출)", async () => {
    const response = await upsert(JOB_NAME, "매일 세시");

    expect(response.status).toBe(400);
    expect(await listNames()).toEqual([]);
  });

  it("공백만 name 으로 PUT 하면 400 (error — DTO @IsNotEmpty 는 통과하고 service 가 거부하는 경계)", async () => {
    const response = await upsert("   ", DAILY_3AM);

    expect(response.status).toBe(400);
    expect(await listNames()).toEqual([]);
  });

  // -- 분기 (iv): ValidationPipe 거부 축 표 압축 --

  // 표는 object 형태 — `$label` 주입이라 route 객체가 test 이름에 덤프되지 않는다.
  const INVALID_BODIES: { label: string; body: Record<string, unknown> }[] = [
    { label: "name 필드 누락", body: { cronExpression: DAILY_3AM } },
    { label: "cronExpression 필드 누락", body: { name: JOB_NAME } },
    { label: "name 빈 문자열", body: { name: "", cronExpression: DAILY_3AM } },
    {
      label: "cronExpression 빈 문자열",
      body: { name: JOB_NAME, cronExpression: "" },
    },
    {
      label: "name wrong type(number)",
      body: { name: 42, cronExpression: DAILY_3AM },
    },
    {
      label: "정의되지 않은 extra 키",
      body: { name: JOB_NAME, cronExpression: DAILY_3AM, callback: "x" },
    },
  ];

  it.each(INVALID_BODIES)(
    "PUT 본문이 $label 이면 400 이고 registry 불변 (branch — controller-scope ValidationPipe whitelist/forbidNonWhitelisted)",
    async ({ body }) => {
      const response = await request(app.getHttpServer())
        .put(SCHEDULES_URL)
        .set("Cookie", adminCookie)
        .send(body);

      expect(response.status).toBe(400);
      expect(await listNames()).toEqual([]);
    },
  );

  // -- negative: RBAC · 인증 실패 4 route × 3 조건 표 압축 --

  const AUTH_CONDS: { condLabel: string; kind: AuthKind; expected: number }[] =
    [
      { condLabel: "User 쿠키(tier 미달)", kind: "user", expected: 403 },
      { condLabel: "쿠키 부재", kind: "none", expected: 401 },
      { condLabel: "변조 JWT 쿠키", kind: "tampered", expected: 401 },
    ];

  // 4 route × 3 조건 = 12 케이스 cross product.
  const RBAC_CASES = ROUTES.flatMap((route) =>
    AUTH_CONDS.map((cond) => ({ routeLabel: route.label, route, ...cond })),
  );

  it.each(RBAC_CASES)(
    "$routeLabel 를 $condLabel 로 호출하면 거부되고 registry 가 변하지 않음 (negative — JwtAuthGuard/RolesGuard)",
    async ({ route, kind, expected }) => {
      const cookie =
        kind === "user"
          ? userCookie
          : kind === "tampered"
            ? buildAuthCookie("not-a-valid-jwt.tampered.signature")
            : undefined;

      const response = await send(route, cookie);

      expect(response.status).toBe(expected);
      // 실패 경로는 registry 를 건드리지 않는다 — 직후 Admin GET 이 빈 배열 그대로.
      expect(await listNames()).toEqual([]);
    },
  );
});

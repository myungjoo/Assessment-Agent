// export-scope-preview.e2e-spec.ts — export scope preview 2 종(`POST /api/admin/export/
// describe-scope` · `POST /api/admin/export/preview-selection`)의 **400 매핑**을 실 HTTP
// 왕복으로 실증하는 e2e (T-1330 — T-1328 Follow-ups 의 미큐잉 e2e slice 회수).
//
// 배경: T-1328(PR #1206) 이 `ScopeInputExceptionFilter` 를 두 핸들러에 `@UseFilters` 로
// 배선해 호출자 입력 결함(RangeError / TypeError)을 500 → 400 으로 매핑했으나, 검증은
// 필터 unit spec + controller metadata 단언까지였다. `@UseFilters` 는 **핸들러 단위
// metadata** 라 실 요청 경로에서 guard(401/403) · ValidationPipe(400) · 필터가 어떤
// 순서로 맞물리는지는 metadata 단언만으로 증명되지 않는다. 본 spec 이 R-113(unit 외
// e2e 를 CI 에서 함께 수행) 관점에서 그 배선을 실 guard stack + 실 PostgreSQL 위에서
// 확증한다.
//
// 본 e2e 가 단언하는 계약 (필터 4 분기 중 실 요청으로 도달 가능한 3 종):
//   (1) HttpException passthrough — JwtAuthGuard 401 / RolesGuard 403 / ValidationPipe
//       400 이 **400 으로 오분류되거나 안내 문구로 덮어써지지 않는다**(재매핑 0).
//   (2) RangeError(RANGE + dateRange 누락 / start >= end / PARTIAL + 빈 entitySelector /
//       허용 외 entity) → 400 + 한국어 안내 prefix.
//   (3) TypeError(dateRange.start/end 가 Invalid Date) → 400 + 동일 안내 prefix.
// 분기 (4) unknown → 500 은 실 요청으로 인위 유발하려면 service mock override 가 필요해
// e2e 성격에 맞지 않으므로 제외 — `scope-input-exception.filter.spec.ts` unit 이 cover.
//
// 두 endpoint 를 각각 확인하는 이유: `describe-scope` 는 순수 합성(describeExportScope
// helper 직접 호출)이고 `preview-selection` 은 실 DB read 후 selectExportRecords 를 거치는
// service 경로라 throw 지점이 다르다. 같은 필터를 공유한다는 사실은 두 경로 각각에서
// 확인해야 실증된다.
//
// 실 DB 전략 (ADR-0004 §Decision — 다른 e2e 동일): mock override 없음.
// `createAuthenticatedE2EApp` 가 AppModule 부트스트랩 + actor user seed + token 발급을
// 담당하고 PrismaService 가 실 connection 을 잡는다. 본 spec 은 **어떤 row 도 쓰지
// 않으므로**(read-only 계약) `afterEach` truncate 를 두지 않고 `afterAll` 에서 1 회만
// 정리한다 — JWT 검증은 DB lookup 이 없어(`src/auth/jwt.strategy.ts` 의 validate 는
// payload claim 만 검사) actor re-seed 도 불요하다.
//
// 실 DB 미가용 환경(로컬 — DATABASE_URL 부재)에서는 CI 에서만 실행(다른 e2e 동일).
// `test/jest-e2e.json` 의 testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 자동 picking 하므로
// 설정 변경 0.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const BASE = "/api/admin/export";
const DESCRIBE_PATH = `${BASE}/describe-scope`;
const PREVIEW_PATH = `${BASE}/preview-selection`;

// 필터가 400 응답 message 앞에 붙이는 한국어 안내 prefix — `ScopeInputExceptionFilter`
// 의 SCOPE_INPUT_GUIDE 와 동일 문자열(정본은 필터 쪽, 본 상수는 단언용 사본).
const SCOPE_INPUT_GUIDE = "Export scope 입력이 올바르지 않습니다";

// spec 고유 actor email — 다른 e2e 와 충돌하지 않도록 endpoint 이름을 접두어로 쓴다.
const ADMIN_EMAIL = "export-scope-admin@e2e.test";
const USER_EMAIL = "export-scope-user@e2e.test";

// flattenMessage — 응답 body 의 message 를 단일 문자열로 평탄화한다. 필터의
// BadRequestException(string) 은 message 가 string 이지만 ValidationPipe 400 은
// string[] 이라 두 형태를 같은 방식으로 단언하기 위함.
function flattenMessage(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return Array.isArray(message) ? message.join(" | ") : String(message ?? "");
}

describe("E2E: export scope preview 2 종의 400 매핑 (T-1330)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor cookie — Admin(두 endpoint 통과) / User(Admin tier 미달 403).
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
  });

  afterAll(async () => {
    // 본 spec 은 row 를 쓰지 않으나 actor user 2 종은 seed 했으므로 1 회만 정리한다.
    await truncateAll(prisma);
    await app.close();
    await prisma.$disconnect();
  });

  // 성공 status 가 200 인 이유: 두 handler 는 DB write 0 인 read-only 조회라
  // `@HttpCode(HttpStatus.OK)` 를 부착했다(T-1331 — @Post 기본값 201 Created 는 새 resource
  // 생성을 뜻해 부적합). api.md 132·133 행의 "응답 200" 계약과 실 동작이 이로써 일치하며,
  // 아래 happy 2 개가 실 HTTP 왕복으로 200 수신을 실증한다.
  const OK_STATUS = 200;

  describe("happy-path — Admin 이 정상 scope 로 호출하면 성공 응답", () => {
    it("describe-scope 는 scope 설명 모델을 성공 status 로 반환한다", async () => {
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "FULL" })
        .expect(OK_STATUS);

      // 사람-친화 설명 필드(headline / scopeLine / entityLines) + read-only 표식.
      expect(response.body.scopeKind).toBe("full");
      expect(typeof response.body.headline).toBe("string");
      expect(response.body.headline.length).toBeGreaterThan(0);
      expect(typeof response.body.scopeLine).toBe("string");
      expect(Array.isArray(response.body.entityLines)).toBe(true);
      expect(response.body.readOnly).toBe(true);
    });

    it("preview-selection 은 count 요약 3 키를 성공 status 로 반환한다", async () => {
      const response = await request(app.getHttpServer())
        .post(PREVIEW_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "FULL" })
        .expect(OK_STATUS);

      // 빈 DB 라 count 값 자체는 0 이어도 무방 — 키 존재 + 타입만 단언한다.
      expect(typeof response.body.selectedCount).toBe("number");
      expect(typeof response.body.excludedCount).toBe("number");
      expect(typeof response.body.perEntitySelected).toBe("object");
      expect(response.body.perEntitySelected).not.toBeNull();
    });
  });

  describe("error path — describe-scope 의 RangeError 가 400 으로 매핑된다", () => {
    it.each([
      ["RANGE + dateRange 누락", { scope: "RANGE" }],
      [
        "RANGE + start >= end (역전 구간)",
        {
          scope: "RANGE",
          dateRange: {
            start: "2026-02-02T00:00:00.000Z",
            end: "2026-01-01T00:00:00.000Z",
          },
        },
      ],
      ["PARTIAL + 빈 entitySelector", { scope: "PARTIAL", entitySelector: [] }],
      [
        "PARTIAL + 허용 외 entity",
        { scope: "PARTIAL", entitySelector: ["Bogus"] },
      ],
    ])("%s → 400 + 안내 prefix", async (_label, body) => {
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send(body)
        .expect(400);

      expect(flattenMessage(response.body)).toContain(SCOPE_INPUT_GUIDE);
    });

    it("start == end 경계는 빈 반열림 구간이라 400 이다", async () => {
      // start < end 가 배타 경계임을 확인 — 동일 시각은 아무 record 도 담지 못한다.
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({
          scope: "RANGE",
          dateRange: {
            start: "2026-01-01T00:00:00.000Z",
            end: "2026-01-01T00:00:00.000Z",
          },
        })
        .expect(400);

      expect(flattenMessage(response.body)).toContain(SCOPE_INPUT_GUIDE);
    });
  });

  describe("error path — describe-scope 의 TypeError 가 400 으로 매핑된다", () => {
    it("dateRange.start 가 Invalid Date 면 400 + 안내 prefix (필터 분기 3)", async () => {
      // controller 의 coerceDateRange 가 문자열을 new Date(...) 로 변환 → Invalid Date →
      // helper 의 assertValidDate 가 TypeError. 실 요청 경로로 분기 (3) 을 cover 한다.
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({
          scope: "RANGE",
          dateRange: { start: "not-a-date", end: "2026-01-02T00:00:00.000Z" },
        })
        .expect(400);

      expect(flattenMessage(response.body)).toContain(SCOPE_INPUT_GUIDE);
    });
  });

  describe("branch — preview-selection 도 같은 필터를 공유한다", () => {
    it.each([
      ["RangeError 계열 (dateRange 누락)", { scope: "RANGE" }],
      [
        "TypeError 계열 (Invalid Date)",
        {
          scope: "RANGE",
          dateRange: { start: "2026-01-01T00:00:00.000Z", end: "nope" },
        },
      ],
    ])("%s → 400 + 안내 prefix (실 DB read 경로)", async (_label, body) => {
      const response = await request(app.getHttpServer())
        .post(PREVIEW_PATH)
        .set("Cookie", adminCookie)
        .send(body)
        .expect(400);

      expect(flattenMessage(response.body)).toContain(SCOPE_INPUT_GUIDE);
    });
  });

  describe("negative — 인증/권한 결함이 400 으로 오분류되지 않는다", () => {
    it("cookie 없이 describe-scope 호출 → 401 (400 아님)", async () => {
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .send({ scope: "FULL" });

      expect(response.status).toBe(401);
      expect(response.status).not.toBe(400);
      expect(flattenMessage(response.body)).not.toContain(SCOPE_INPUT_GUIDE);
    });

    it("User role cookie 로 describe-scope 호출 → 403 (400 아님)", async () => {
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", userCookie)
        .send({ scope: "FULL" });

      expect(response.status).toBe(403);
      expect(response.status).not.toBe(400);
      expect(flattenMessage(response.body)).not.toContain(SCOPE_INPUT_GUIDE);
    });

    it("User role cookie 로 preview-selection 호출 → 403 (400 아님)", async () => {
      const response = await request(app.getHttpServer())
        .post(PREVIEW_PATH)
        .set("Cookie", userCookie)
        .send({ scope: "FULL" });

      expect(response.status).toBe(403);
      expect(response.status).not.toBe(400);
      expect(flattenMessage(response.body)).not.toContain(SCOPE_INPUT_GUIDE);
    });
  });

  describe("negative — ValidationPipe 400 은 필터가 message 를 덮어쓰지 않는다", () => {
    it("enum 아닌 scope 값 → 400 이되 class-validator 원 message 를 보존한다", async () => {
      // ValidationPipe 가 던지는 BadRequestException 은 HttpException 이라 필터 분기 (1)
      // passthrough — 안내 prefix 가 붙지 않아야 "어느 계층이 거부했는지" 가 구분된다.
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "BOGUS" })
        .expect(400);

      const message = flattenMessage(response.body);
      expect(message).not.toContain(SCOPE_INPUT_GUIDE);
      expect(message).toContain("scope");
    });

    it("정의되지 않은 키가 섞이면 forbidNonWhitelisted 로 400", async () => {
      const response = await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "FULL", bogusKey: 1 })
        .expect(400);

      expect(flattenMessage(response.body)).not.toContain(SCOPE_INPUT_GUIDE);
    });
  });

  describe("read-only 계약 — 두 endpoint 는 DB 에 쓰지 않는다", () => {
    it("호출 전후로 exportJob row 수가 변하지 않는다 (REQ-032 raw 미저장 정합)", async () => {
      // 절대값 0 대신 호출 전후 delta 0 을 단언한다 — `truncateAll` 은 ExportJob 를
      // 비우지 않아(TRUNCATE_TABLES 미포함) 선행 e2e 의 잔여 row 에 영향받지 않기 위함.
      const countBefore = await prisma.exportJob.count();

      await request(app.getHttpServer())
        .post(DESCRIBE_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "FULL" })
        .expect(OK_STATUS);
      await request(app.getHttpServer())
        .post(PREVIEW_PATH)
        .set("Cookie", adminCookie)
        .send({ scope: "FULL" })
        .expect(OK_STATUS);

      expect(await prisma.exportJob.count()).toBe(countBefore);
    });
  });
});

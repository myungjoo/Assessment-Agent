// unevaluated-fill-run.e2e-spec.ts — POST /api/assessment-evaluation/unevaluated-fill-run
// 의 **실 부팅 round-trip + RBAC negative + fail-fast** e2e (T-0566, PLAN.md P5 bullet 106 /
// R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038). T-0565(merge 372a287, PR #480)이
// 배선한 controller route 는 controller unit spec(orchestrator mock)만 있고 e2e 가 없었다 —
// README 113행(R-113)은 unit 외에 e2e 도 CI 에서 수행할 것을 요구하므로, 새로 배선된 HTTP
// 엔드포인트의 실 부팅 round-trip(인증 가드 + ValidationPipe + 라우트 마운트 + 응답 직렬화)을
// 추가해 run-side 사슬을 닫는다. plan-side 의 `unevaluated-fill-plan.e2e-spec.ts`(T-0548)와
// 동형 1:1 mirror.
//
// production code(`src/`) 변경 0 / coverage 영향 0:
//   본 spec 은 e2e spec 1 파일 추가만이며 신규 production symbol 0 이다. e2e 는 `pnpm test:cov`
//   (unit) 의 coverage 집계 대상이 아니므로(jest e2e config 분리) `coverageThreshold`
//   (line/function ≥ 80%)는 기존 unit 으로 그대로 통과한다. 본 spec 내부 helper(messageText /
//   validBody 등)는 단순 assertion 보조라 별도 분기 test 불요.
//
// live-LLM 경계(load-bearing — 본 spec 의 scope 결정 근거):
//   비어있지 않은 `rawBridges` 로 진짜 round-trip 을 하면 orchestrator 가
//   `PeriodBridgeAdminPersistService.generateAndPersist`(collect→filter→evaluate→persist)를
//   호출 → **실 LLM round-trip** 이 발생한다. 본 spec 을 실행하는 cloud cron 은 LAN
//   (192.168.0.5 Ollama, ADR-0045)에 무경로라 live-LLM 자율 수행 불가다. 따라서 본 spec 의
//   **모든 케이스는 LLM 에 도달하지 않는다** — (1) RBAC 가드(401/403, 가드는 handler 진입 전
//   동작), (2) ValidationPipe(400, handler 진입 전), (3) fail-fast 경로(빈 좌표 + 무효 modelId
//   조합이 core 의 한국어 `TypeError` 로 좌표를 흘리기 전 차단), (4) 빈 `rawBridges` + 유효
//   modelId → 200 + 빈 outcomes(좌표 0 → orchestrator 가 좌표 순회 0 → `generateAndPersist`
//   호출 0 → LLM 0 인 진짜 부팅 round-trip). 비어있지 않은 좌표의 live-LLM round-trip 1 회
//   검증은 task Follow-ups 의 수동/로컬(LAN) 후속이다(cloud cron 미수행).
//
// 실 DB 전략(ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
//   AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection. 단 본 spec 의
//   모든 케이스는 빈 좌표(rawBridges: [])라 DB write/read 0 — afterEach(truncateAll) 는 seed 한
//   actor user 만 정리한다(좌표 영속 0). afterAll(close + $disconnect). 로컬 DATABASE_URL
//   부재 시 CI 전용(test:e2e step).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover(T-0548 mirror).
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const ROUTE = "/api/assessment-evaluation/unevaluated-fill-run";

// 유효 modelId — 좌표가 비어있어 LLM 에 도달하지 않으므로 임의 non-empty literal 이면 충분
// (허용 modelId set 검증은 좌표를 흘릴 때만 발생, 본 spec 은 좌표 0). DTO 형식(@IsNotEmpty)만
// 충족하면 된다.
const VALID_MODEL_ID = "test-model";

// 유효한 빈-좌표 body — rawBridges 빈 배열(형식 유효, @ArrayNotEmpty 미적용 박제) + 유효
// modelId/defaultModelId. 좌표 0 → orchestrator 좌표 순회 0 → generateAndPersist 호출 0 →
// LLM 무도달. happy-path round-trip + 결정성 케이스가 공유한다.
const validEmptyBody = () => ({
  rawBridges: [],
  modelId: VALID_MODEL_ID,
  defaultModelId: VALID_MODEL_ID,
});

describe("E2E: POST /api/assessment-evaluation/unevaluated-fill-run — Admin run round-trip (T-0566, R-113)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — 미평가 fill **실행** 진입(evaluate / plan route 와 동형 Admin+ gate).
  const adminEmail = "fill-run-admin@e2e.test";
  let adminCookie: string;

  // User actor — 403 negative(비-Admin tier 가 실행 진입을 트리거할 수 없음) 검증용.
  const userEmail = "fill-run-user@e2e.test";
  let userCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: adminEmail },
      { role: "User", email: userEmail },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[adminEmail]);
    userCookie = buildAuthCookie(ctx.tokens[userEmail]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // -- happy-path round-trip (빈 좌표, LLM 무도달) --

  it("Admin 토큰 + 유효 빈-좌표 body 시 200 + UnevaluatedFillRunResult shape + 빈 outcomes (round-trip, LLM 무도달)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validEmptyBody());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    // 응답 shape — UnevaluatedFillRunResult(outcomes + 4 count 축 + totalEvaluatedRecords).
    // 좌표 0 → orchestrator 가 좌표 순회 0 → generateAndPersist 호출 0 → 실 LLM/네트워크 0 인
    // 진짜 부팅 round-trip(라우트 마운트 · DI · 응답 직렬화 검증).
    expect(Array.isArray(response.body.outcomes)).toBe(true);
    expect(response.body.outcomes).toEqual([]);
    expect(response.body.totalCount).toBe(0);
    expect(response.body.evaluatedCount).toBe(0);
    expect(response.body.skippedCount).toBe(0);
    expect(response.body.failedCount).toBe(0);
    // totalEvaluatedRecords 는 evaluated outcome 의 evaluatedCount 합 — 빈 좌표라 0.
    expect(response.body.totalEvaluatedRecords).toBe(0);
  });

  // -- negative: 401 인증 부재 --

  it("cookie 부재 시 401 (negative — JwtAuthGuard, handler 진입 전)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send(validEmptyBody());

    expect(response.status).toBe(401);
  });

  // -- negative: 403 비-Admin tier --

  it('User tier 토큰 시 403 (negative — RolesGuard @Roles("Admin"), handler 진입 전)', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", userCookie)
      .send(validEmptyBody());

    expect(response.status).toBe(403);
  });

  // -- negative: 400 ValidationPipe ×4 (예외 분기마다 1+) --

  it("Admin 토큰 + defaultModelId 누락 시 400 (negative — @IsString/@IsNotEmpty 필수 축)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: [], modelId: VALID_MODEL_ID });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body)).toMatch(/defaultModelId/);
  });

  it("Admin 토큰 + rawBridges 가 배열 아님(non-array) 시 400 (negative — @IsArray)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: "not-an-array", defaultModelId: VALID_MODEL_ID });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rawBridges/);
  });

  it("Admin 토큰 + modelId 빈 문자열 시 400 (negative — @IsNotEmpty, 제공 시 비어있지 않아야)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: [], modelId: "", defaultModelId: VALID_MODEL_ID });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/modelId/);
  });

  it("Admin 토큰 + nested PeriodBridgeDto 필수 축 위반(형식상 잘못된 1 원소 배열) 시 400 (negative — @ValidateNested)", async () => {
    // rawBridges 의 1 원소가 PeriodBridgeDto 필수 축(personId/period/scope/periodStart)을
    // 누락한 빈 객체 → @ValidateNested({each:true}) + @Type 이 재귀 검증해 400. nested 검증
    // 동작(원소 단위 PeriodBridgeDto decorator 전파) 검증.
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: [{}], defaultModelId: VALID_MODEL_ID });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    // nested 검증 message 는 누락된 PeriodBridgeDto 축(personId 등)을 언급한다.
    expect(messageText(response.body).length).toBeGreaterThan(0);
  });

  // -- flow / branch: fail-fast 경로 (빈 좌표 + 무효 modelId 조합, LLM 무도달) --

  it("Admin 토큰 + 빈 좌표 + request·default modelId 모두 무효(whitespace) 시 core fail-fast → 500 (flow — ValidationPipe 통과 후 core TypeError)", async () => {
    // 설계 근거(load-bearing): @IsNotEmpty 는 class-validator 정의상 빈 문자열 "" / null /
    // undefined 만 거부하고 whitespace-only " " 는 **통과**시킨다(non-empty string). 따라서
    // { modelId: undefined(미제공), defaultModelId: " " } 는 ValidationPipe 400 을 통과한 뒤
    // orchestrator → core 의 buildFillRunScoringOptions 에 도달한다. 거기서 request 는 비어
    // (undefined) default " " 는 trim 후 빈 문자열로 수렴 → 둘 다 채택 불가 → 한국어 TypeError
    // 가 좌표를 단 1 개도 흘리기 전(영속/LLM 부수효과 0) fail-fast 로 전파된다. 이 TypeError 는
    // controller 가 흡수하지 않으므로(swallow 0) NestJS 기본 unhandled 매핑 → 500.
    // 실제 status 는 `pnpm test:e2e` 관측으로 확정(추측 금지) — whitespace 가 @IsNotEmpty 를
    // 통과해 core fail-fast 가 e2e 로 도달함을 본 케이스가 박제한다(만약 향후 DTO 가
    // @IsNotEmpty 를 trim-aware 로 강화해 400 으로 선제 차단하면 본 assert 를 400 으로 갱신).
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: [], defaultModelId: " " });

    expect(response.status).toBe(500);
  });

  // -- negative: thin delegate 비변형 / 빈-좌표 결정성 --

  it("Admin 토큰 + 빈 rawBridges 시 200 + 명시적 빈 결과(silent 비정상 진행 아님) + envelope 없는 result shape 그대로 (도메인 결정성)", async () => {
    // 빈 좌표 → 200 + 빈 outcomes 의 명시적 빈 run 결과(T-0548 의 빈 personIds → 빈 plan 정책
    // 동형). 응답이 envelope({ data: ... } 등) 없이 UnevaluatedFillRunResult shape 그대로(가공
    // 0)임을 assert — controller 가 service 반환을 pass-through 만 함을 박제.
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validEmptyBody());

    expect(response.status).toBe(200);
    // result shape 그대로 — envelope 키 부재(top-level 이 곧 result).
    expect(response.body).toHaveProperty("outcomes");
    expect(response.body).toHaveProperty("totalCount");
    expect(response.body).toHaveProperty("evaluatedCount");
    expect(response.body).toHaveProperty("skippedCount");
    expect(response.body).toHaveProperty("failedCount");
    expect(response.body).not.toHaveProperty("data");
    // silent 비정상 진행이 아니라 명시적 빈 결과.
    expect(response.body.outcomes).toEqual([]);
    expect(response.body.totalCount).toBe(0);
  });
});

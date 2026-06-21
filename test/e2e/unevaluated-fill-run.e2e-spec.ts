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
//   동작), (2) ValidationPipe(400, handler 진입 전), (3) resolver fail-fast 경로(LlmProviderConfig
//   row 0 → controller 가 503 으로 매핑, 좌표를 흘리기 전 차단), (4) 빈 `rawBridges` + 유효
//   modelId + 단일 LlmProviderConfig row → 200 + 빈 outcomes(좌표 0 → orchestrator 가 좌표
//   순회 0 → `generateAndPersist` 호출 0 → LLM 0 인 진짜 부팅 round-trip). 비어있지 않은
//   좌표의 live-LLM round-trip 1 회 검증은 task Follow-ups 의 수동/로컬(LAN) 후속이다.
//
// server-side default model 해석 계약(T-0569, ADR-0048 §Decision 1·2 — 본 spec 정합 근거):
//   controller 의 `runUnevaluatedFill` 은 더 이상 `dto.defaultModelId` 를 읽지 않고,
//   `LlmProviderConfigResolver.resolveDefaultModelId()` 로 LlmProviderConfig DB row 의
//   modelId 를 단일-row 해석해 default modelId 를 server-side 에서 권위 있게 결정한다.
//   row 가 0(또는 2+)이면 resolver 가 throw → controller 가 **503 ServiceUnavailable** 로
//   매핑한다(평가 사슬 미진입). 따라서 본 e2e 는:
//     - 200 happy-path 케이스를 위해 beforeEach 에서 **단일 LlmProviderConfig row 를 seed**
//       해 resolver success path 를 복원한다(이 seed 없이는 모든 200 케이스가 503 으로 깨진다).
//     - row 부재 → 503 케이스를 새 계약(server-side fail-fast)의 e2e round-trip 으로 박제한다
//       (구 "whitespace defaultModelId → 500" 케이스는 controller 가 dto.defaultModelId 를
//       더 이상 읽지 않으므로 obsolete — 이 503 케이스로 재정의).
//
// 실 DB 전략(ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
//   AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection. 좌표는
//   빈 배열(rawBridges: [])이라 좌표 영속 0 이지만, resolver 가 `llmProviderConfig.findMany()`
//   를 실 read 하므로 LlmProviderConfig row 의 seed/cleanup 을 본 spec 이 직접 관리한다
//   (truncateAll 명단에 LlmProviderConfig 미포함 → beforeEach 에서 deleteMany 후 단일 row
//   create 로 결정성 보장, afterAll 에서 deleteMany 로 정리). afterEach(truncateAll) 는 seed 한
//   actor user 만 정리한다. afterAll(close + $disconnect). 로컬 DATABASE_URL 부재 시
//   CI 전용(test:e2e step) — e2e 의 실 DB round-trip 검증은 CI 에 위임한다.
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

// seed 할 단일 LlmProviderConfig row 의 필드(schema: provider/endpointUrl/apiKey/modelId 4
// 컬럼 — id/createdAt/updatedAt 은 @default/@updatedAt). resolver 는 이 row 의 modelId 를
// trim 해 default modelId 로 반환한다(ADR-0048 §Decision 2 (a) 분기). 좌표 0 이라 이 modelId
// 가 실제 LLM 으로 흘러가지 않으므로 endpointUrl/apiKey 는 형식 충족용 placeholder.
const SEED_LLM_CONFIG = {
  provider: "openai-compatible",
  endpointUrl: "http://llm.e2e.test/v1",
  apiKey: "e2e-placeholder-key",
  modelId: VALID_MODEL_ID,
};

// 유효한 빈-좌표 body — rawBridges 빈 배열(형식 유효, @ArrayNotEmpty 미적용 박제) + 유효
// modelId. 좌표 0 → orchestrator 좌표 순회 0 → generateAndPersist 호출 0 → LLM 무도달.
// happy-path round-trip + 결정성 케이스가 공유한다.
//
// defaultModelId 박제 근거(T-0570, ADR-0048 §Decision 3): request body 의 defaultModelId
// 필드가 **제거**됐다 — default 의 source 는 server-side resolver(LlmProviderConfig DB row)다.
// body 에 defaultModelId 를 넣으면 controller-scope ValidationPipe(forbidNonWhitelisted)가
// unknown 필드로 거부하므로, 모든 유효 fixture 는 rawBridges + modelId 2 축만 보낸다.
const validEmptyBody = () => ({
  rawBridges: [],
  modelId: VALID_MODEL_ID,
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
    // LlmProviderConfig 는 truncateAll 명단 밖이라 본 spec 이 직접 정리한다(다른 spec 으로
    // row leak 방지).
    await prisma.llmProviderConfig.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 전 LlmProviderConfig 를 정확히 단일 row 로 결정성 셋업 — resolver 의 (a) 단일-row
  // success path 를 복원해 happy-path 200 케이스가 503 으로 깨지지 않게 한다. deleteMany 선행은
  // truncateAll 이 본 테이블을 비우지 않아 직전 test 의 row 가 누적되는 것(→ 2+row → resolver
  // 가 503 throw)을 차단한다. row 부재 → 503 케이스는 it 내부에서 deleteMany 로 단독 제거한다.
  beforeEach(async () => {
    await prisma.llmProviderConfig.deleteMany();
    await prisma.llmProviderConfig.create({ data: SEED_LLM_CONFIG });
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

  // -- negative: 400 ValidationPipe (예외 분기마다 1+) --
  //
  // defaultModelId 누락 → 400 케이스는 제거됐다 — ADR-0048 §Decision 3 으로 필드가
  // 사라져 그 400 분기 자체가 소멸했다. 대신 제거된 defaultModelId 를 보내면
  // forbidNonWhitelisted 가 거부하는 case 로 재정의(아래 unknown 필드 negative).

  it("Admin 토큰 + 제거된 defaultModelId 를 보내면 400 (negative — forbidNonWhitelisted, 제거된 필드 unknown 처리)", async () => {
    // ADR-0048 §Decision 3: request body 의 defaultModelId 필드가 제거됐으므로, 옛 caller 가
    // 그 값을 계속 보내면 controller-scope ValidationPipe(forbidNonWhitelisted)가 unknown
    // 필드로 거부한다(silent 무시 아님 — 정책 명시성 보존).
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({
        rawBridges: [],
        modelId: VALID_MODEL_ID,
        defaultModelId: "gpt-4o",
      });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body)).toMatch(/defaultModelId/);
  });

  it("Admin 토큰 + rawBridges 가 배열 아님(non-array) 시 400 (negative — @IsArray)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rawBridges/);
  });

  it("Admin 토큰 + modelId 빈 문자열 시 400 (negative — @IsNotEmpty, 제공 시 비어있지 않아야)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ rawBridges: [], modelId: "" });

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
      .send({ rawBridges: [{}] });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    // nested 검증 message 는 누락된 PeriodBridgeDto 축(personId 등)을 언급한다.
    expect(messageText(response.body).length).toBeGreaterThan(0);
  });

  // -- flow / branch: resolver fail-fast 경로 (LlmProviderConfig row 0 → 503, LLM 무도달) --

  it("Admin 토큰 + LlmProviderConfig row 부재 시 503 (flow — resolver 0-row fail-fast → ServiceUnavailable, 평가 사슬 미진입)", async () => {
    // server-side default model 해석 계약(T-0569, ADR-0048 §Decision 1·2)의 fail-fast e2e
    // round-trip. 구 "whitespace defaultModelId → 500" 케이스를 재정의한 것 — controller 는
    // 더 이상 dto.defaultModelId 를 읽지 않으므로 그 계약은 obsolete 다. 대신 운영자가 LLM
    // provider 를 한 번도 설정하지 않은 상태(LlmProviderConfig row 0)에서 resolver 가 한국어
    // fail-fast throw → controller 가 503 ServiceUnavailable 로 매핑함을 실 DB round-trip 으로
    // 박제한다(좌표를 단 1 개도 흘리기 전 차단 — 영속/LLM 부수효과 0).
    //
    // beforeEach 가 단일 row 를 seed 하므로 본 케이스만 deleteMany 로 row 를 단독 제거해
    // 0-row 상태를 만든다(afterEach truncateAll 은 LlmProviderConfig 미포함이라 다음 test 의
    // beforeEach 가 다시 단일 row 를 복원한다).
    await prisma.llmProviderConfig.deleteMany();

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validEmptyBody());

    expect(response.status).toBe(503);
    // resolver 의 한국어 진단 메시지가 503 응답에 보존된다(controller 가 error.message 를 담음).
    expect(messageText(response.body)).toMatch(/LLM provider/);
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

// llm-provider-config-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB
// round-trip **slice 11** (T-1520, load-resilience-test-plan §5 item 5 / REQ-048,
// 조회 p95 < 3s). 열 번째 endpoint 도메인(`LlmProviderConfigController` 의
// `GET /api/llm/providers` · `/:id`)을 실 Postgres 위에서 잰다(slice 10 구조 승계,
// 앞 slice 수정 0). 새 축 셋 — (a) **secondary index 0 테이블**: `@id` 외 `@unique` ·
// `@@unique` · `@@index` 가 하나도 없는 첫 대상이고 목록은 무필터 전량 `findMany()`,
// 단건은 PK 직행 `findUnique` 다. (b) **service per-row sanitize**: row 마다 명시
// field pick 으로 `apiKey`(envelope ciphertext 모사)를 버린 새 view 를 만들어 **DB
// 에서 읽는 payload 가 응답 payload 보다 크고** row 수 비례 변환 CPU 가 섞인다.
// (c) **null 분기 404**: slice 10 의 P2025 예외 기반과 달리 `findUnique` 가 준 null
// 을 service 가 분기해 던지는 application 분기다. 부수로 truncate helper 미커버
// (→ spec-local `deleteMany`) · 역방향 relation 보유하나 미조인 SELECT · 운영 secret
// 보관 config 테이블이 처음 등장한다(403 layer 는 slice 10 과 동일 — 새 축 아님).
// mock 0 · override 0, 검증은 **응답 body 의 seed 값 대조** 다(401/403 은 DB 미도달
// 이라 `p95MaxMs: 0` 단언). production code · schema · 임계값 불변, 소규모 표본이라
// REQ-047 부하가 아니다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  reseedAuthenticatedActors,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";

// 실 DB 부트스트랩 + 인증 seed + 반복 요청 — slice 9·10 과 동등한 여유.
jest.setTimeout(120_000);

const BASE = "/api/llm/providers";
const USER_ACTOR_EMAIL = "realdb-llmcfg-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-llmcfg-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

// envelope ciphertext 모사 문자열 — 실 `LlmApiKeyCipher` 를 호출하지 않고(암호화
// key env 의존 회피) **읽고 버리는 컬럼** 축만 만든다. 길이를 키워 DB payload 가
// 응답 payload 보다 크다는 조건을 실제로 성립시킨다.
const CIPHERTEXT = `v1:${"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5".repeat(6)}`;

type ConfigKey = "openai" | "anthropic" | "custom";
type Row = Record<string, unknown>;

// seed 표본 3 row — tuple 순서는 [key, provider, endpointUrl, modelId]. 무필터 전량
// SELECT 라 필터 축이 없어 다건 / 0 건 대비만 만든다(apiKey 는 세 row 공통).
const CONFIG_SEEDS: [ConfigKey, string, string, string][] = [
  ["openai", "openai", "https://api.openai.test/v1", "gpt-perf-1"],
  ["anthropic", "anthropic", "https://api.anthropic.test/v1", "claude-perf-1"],
  ["custom", "custom", "https://llm.internal.test/v1", "custom-perf-1"],
];

describe("S2 조회 latency perf-spec — 실 DB LLM provider config 조회 (GET /api/llm/providers · :id, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 변조 토큰 cookie — 서명이 깨진 JWT 라 `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + actor User 2 명 seed + 실 JWT 발급.
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_ACTOR_EMAIL },
      { role: "Admin", email: ADMIN_ACTOR_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens[USER_ACTOR_EMAIL]);
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_ACTOR_EMAIL]);
    tamperedCookie = buildAuthCookie(`${ctx.tokens[ADMIN_ACTOR_EMAIL]}tam`);
    // 앞선 스위트 잔여 row 배제 — truncate 가 actor User 도 지우므로 곧바로 재-seed.
    await prisma.llmProviderConfig.deleteMany();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단의 `"User"` 가 JWT `sub` 의 actor row 를
  // 지우므로 **원본 id 그대로** 재삽입한다(재발급 금지). `LlmProviderConfig` 는
  // 명단에 없고 `"User"` 를 참조하지도 않아 CASCADE 로 지워지지 않으므로 helper 를
  // 고치지 않고 **spec-local `deleteMany`** 로 흡수한다(`DifficultyMapping` 은 seed
  // 0 이라 `onDelete: Restrict` 위반 없음).
  afterEach(async () => {
    await prisma.llmProviderConfig.deleteMany();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // config seed — POST endpoint · 실 cipher 미사용, Prisma 직접 insert.
  // 반환은 key → 생성 id 표.
  const seedConfigs = async (
    keys: ConfigKey[],
  ): Promise<Record<string, string>> => {
    const ids: Record<string, string> = {};
    for (const [key, provider, endpointUrl, modelId] of CONFIG_SEEDS) {
      if (!keys.includes(key)) continue;
      const created = await prisma.llmProviderConfig.create({
        data: { provider, endpointUrl, modelId, apiKey: CIPHERTEXT },
      });
      ids[key] = created.id;
    }
    return ids;
  };
  const ALL_KEYS: ConfigKey[] = ["openai", "anthropic", "custom"];

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (path: string, cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(path);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (path: string, cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path, cookie), n);
  // Admin 의 `:id` 단건 측정 shorthand — 경로 조립 + cookie 고정.
  const measureDetail = (id: string, n = ITERATIONS) =>
    measure(`${BASE}/${id}`, adminCookie, n);
  const rows = (): Row[] => lastBody as Row[];
  const one = (): Row => lastBody as Row;

  // AC happy ① — Admin actor 의 config 목록(무필터 전량 SELECT + per-row sanitize).
  it("happy ①(Admin 목록): 200 + seed config 전량 + p95 < 3000ms pass", async () => {
    const ids = await seedConfigs(ALL_KEYS);
    const result = await measure(BASE, adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    // 값 대조로 실 query 발화 입증 — id/provider/modelId 가 seed 와 일치.
    const list = rows();
    expect(list.map((r) => r.id).sort()).toEqual(Object.values(ids).sort());
    expect(list.map((r) => `${r.provider}/${r.modelId}`).sort()).toEqual(
      CONFIG_SEEDS.map(([, p, , m]) => `${p}/${m}`).sort(),
    );
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });

  // AC happy ② — 단건 조회(PK 직행 `findUnique` 성공 경로).
  it("happy ②(Admin :id 단건): 200 + seed 값 일치 + p95 < 3000ms pass", async () => {
    const ids = await seedConfigs(ALL_KEYS);
    const result = await measureDetail(ids.anthropic);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(one().id).toBe(ids.anthropic);
    expect([one().provider, one().endpointUrl, one().modelId]).toEqual([
      "anthropic",
      "https://api.anthropic.test/v1",
      "claude-perf-1",
    ]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });

  describe("전량 SELECT · sanitize 분기", () => {
    // (a) 등록 0 — 404 변환 없이 200 + 빈 배열(findMany native 동작).
    it("(a) config 0 건: 200 + 빈 배열(404 아님)", async () => {
      const result = await measure(BASE, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (b) 다건(3) — 무필터 전량이라 seed row 가 빠짐없이 나온다. 0 건 표본과의
    // latency 대소 관계는 단언 0(slice 3 선례 — wall-clock 비결정성).
    it("(b) config 3 건: 전량 SELECT 가 seed row 를 빠짐없이 반환", async () => {
      const ids = await seedConfigs(ALL_KEYS);
      const result = await measure(BASE, adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(rows()).toHaveLength(3);
      const seen = rows().map((r) => r.id);
      for (const id of Object.values(ids)) expect(seen).toContain(id);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (c) 본 slice 핵심 축 — service 의 per-row sanitize 가 `apiKey` 를 제거하므로
    // 목록·단건 양쪽 body 에 키 자체가 없다(읽고 버리는 컬럼의 직접 증거).
    it("(c) 목록·단건 응답 body 에 apiKey 키 부재(per-row sanitize)", async () => {
      const ids = await seedConfigs(ALL_KEYS);
      await measure(BASE, adminCookie, 1);
      expect(lastStatus).toBe(200);
      expect(rows().every((r) => !("apiKey" in r))).toBe(true);
      expect(JSON.stringify(lastBody)).not.toContain(CIPHERTEXT);
      await measureDetail(ids.openai, 1);
      expect(lastStatus).toBe(200);
      expect("apiKey" in one()).toBe(false);
      expect(JSON.stringify(lastBody)).not.toContain(CIPHERTEXT);
    });
  });

  describe("negative cases 충분 cover", () => {
    // Cookie 미부착 → `JwtAuthGuard` 401. 표본 0 이라 측정 시간 무의존 단언.
    it("(a) 인증 없음(Cookie 미부착): 두 route 모두 401 failures, 표본 0", async () => {
      const ids = await seedConfigs(ALL_KEYS);
      const result = await measure(BASE, null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      await measure(`${BASE}/${ids.openai}`, null, 1);
      expect(lastStatus).toBe(401);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패(200·403 아님).
    it("(b) 변조 토큰 cookie: 401 failures(403 아님)", async () => {
      const ids = await seedConfigs(ALL_KEYS);
      const result = await measure(BASE, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      await measure(`${BASE}/${ids.openai}`, tamperedCookie, 1);
      expect(lastStatus).toBe(401);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // `@Roles("Admin")` 이라 User tier 는 RolesGuard 단계에서 DB 미도달 403
    // (slice 10 과 같은 layer — 새 축으로 주장하지 않고 cover 만 유지).
    it("(c) User tier actor: 두 route 모두 guard 레벨 403(DB 미도달)", async () => {
      const ids = await seedConfigs(ALL_KEYS);
      const listResult = await measure(BASE, userCookie);
      expect(listResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(listResult.samplesMs).toHaveLength(0);
      const detailResult = await measure(`${BASE}/${ids.openai}`, userCookie);
      expect(detailResult.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(assertS2Threshold(detailResult, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // 미존재 id — `findUnique` 의 **null 을 service 가 분기** 해 NotFoundException
    // (slice 10 의 P2025 예외 기반 404 와 발생 메커니즘이 다르다).
    it("(d) 미존재 id :id 조회: 404(null 분기 → NotFoundException)", async () => {
      await seedConfigs(ALL_KEYS);
      const missing = "realdb-missing-llm-config-id";
      const result = await measureDetail(missing, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(result.samplesMs).toHaveLength(0);
      expect(JSON.stringify(lastBody)).not.toContain(CIPHERTEXT);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
  });
});

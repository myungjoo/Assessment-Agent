// difficulty-mapping-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip
// **slice 13** (T-1524, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 열두 번째
// endpoint 도메인(`DifficultyMappingController` 의 `GET /api/llm/difficulty-mappings`)을 실
// Postgres 위에서 잰다(구조 slice 11·12 승계, 앞 slice 수정 0). 새 축 셋 — (a) **nullable 관계형
// FK(`llmProviderConfigId String?`)의 NULL / 비-NULL 혼재 + `include` 0 미조인 조회**: 앞 12 slice
// 의 payload 축에는 관계형 FK 자체가 nullable 인 경로가 없었고(slice 10 `Json?` 은 구조화 scalar,
// slice 12 `Int?`/`String?` 은 비-관계 scalar), 부모 row 가 실재해도 join 0 · FK 는 문자열 컬럼으로만
// 직렬화된다. (b) **부모–자식이 각각 별도 slice 로 실측되는 첫 페어 + `onDelete: Restrict` 로 정리
// 순서가 강제되는 첫 실 DB slice**: 부모 `LlmProviderConfig` 는 slice 11(T-1520)이 쟀고 본 slice 는
// 그 자식을 잰다 — 두 테이블 모두 `truncateAll` 명단 밖이라 spec-local `deleteMany` 를 **자식 먼저**
// 호출해야 한다(역순은 `Restrict` 위반 — negative (d)). (c) **schema 로 카디널리티가 상한된 고정
// 슬롯 테이블**: `@@unique([difficulty])` + easy/medium/hard 3 슬롯 고정(ADR-0011 §1)이라 결과가
// 구조적으로 3 을 넘을 수 없는 첫 실측 경로다. `@Roles("Admin")` guard 레벨 403 은 slice 10·11·12 와
// 동일해 **새 축으로 주장하지 않고** negative cover 로만 둔다(무필터 전량 `findMany()` 도 slice 11 과
// 같아 새 축 아님). mock 0 · override 0, production code · schema · 임계값 불변이며 소규모 표본이라
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

import { buildBaselineReport, formatBaselineLine } from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
  type S2Assertion,
} from "./latency-collector";

jest.setTimeout(120_000);

const BASE = "/api/llm/difficulty-mappings";
const USER_ACTOR_EMAIL = "realdb-diffmap-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-diffmap-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

// 부모 config seed 값 — 실 `LlmApiKeyCipher` 미사용(암호화 key env 의존 0), Prisma 직접 insert.
const PARENT_PROVIDER = "custom";
const PARENT_ENDPOINT = "https://llm.internal.test/v1";
const PARENT_MODEL = "diffmap-perf-1";
const PARENT_API_KEY = "v1:realdb-diffmap-ciphertext";

// 3 고정 슬롯(ADR-0011 §1). easy/hard 는 부모 config 를 가리키고 medium 은 미설정이라 **NULL 슬롯과
// 비-NULL 슬롯이 한 응답에 공존** 한다(축 (a) 의 직접 증거).
const SLOT_SEEDS: { difficulty: string; linked: boolean }[] = [
  { difficulty: "easy", linked: true },
  { difficulty: "medium", linked: false },
  { difficulty: "hard", linked: true },
];
const DATA_SCALE = `${SLOT_SEEDS.length} difficulty slots`;

type Row = Record<string, unknown>;

describe("S2 조회 latency perf-spec — 실 DB 난이도 매핑 조회 (GET /api/llm/difficulty-mappings, REQ-048)", () => {
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
  const observed: string[] = [];

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
    await cleanDomainRows();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. 두 대상 테이블 모두 `truncateAll` 명단 밖이고 `"User"` 도 참조하지 않아
  // CASCADE 로 지워지지 않으므로 helper 수정 0 으로 **spec-local `deleteMany`** 가 흡수한다(slice 11
  // 선례). 순서는 **자식 → 부모** — 역순은 `onDelete: Restrict` 위반이다(negative (d) 가 그 증거).
  // 이어지는 `truncateAll` 이 `"User"` 를 지우므로 actor 를 **원본 id 그대로** 재-seed 한다.
  afterEach(async () => {
    await cleanDomainRows();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  afterAll(async () => {
    // 관찰 기록 — 두 표본의 대소 관계는 wall-clock 비결정성이라 단언하지 않는다(slice 3 선례).
    console.log(`[T-1524 관찰] ${observed.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  async function cleanDomainRows(): Promise<void> {
    await prisma.difficultyMapping.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
  }

  // 부모 config 1 건 + 3 슬롯 seed. 반환 `{ configId, slotIds }` 로 응답 FK 값을 대조한다.
  const seedSlots = async (): Promise<{
    configId: string;
    slotIds: Record<string, string>;
  }> => {
    const parent = await prisma.llmProviderConfig.create({
      data: {
        provider: PARENT_PROVIDER,
        endpointUrl: PARENT_ENDPOINT,
        modelId: PARENT_MODEL,
        apiKey: PARENT_API_KEY,
      },
    });
    const slotIds: Record<string, string> = {};
    for (const seed of SLOT_SEEDS) {
      const created = await prisma.difficultyMapping.create({
        data: {
          difficulty: seed.difficulty,
          llmProviderConfigId: seed.linked ? parent.id : null,
        },
      });
      slotIds[seed.difficulty] = created.id;
    }
    return { configId: parent.id, slotIds };
  };

  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (cookie: string | null): RequestFn =>
    async () => {
      const req = request(app.getHttpServer()).get(BASE);
      const res = await (cookie === null ? req : req.set("Cookie", cookie));
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };
  const measure = (cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(cookie), n);
  const rows = (): Row[] => lastBody as Row[];
  const bySlot = (difficulty: string): Row =>
    rows().find((r) => r.difficulty === difficulty) as Row;
  // baseline 한 줄 관찰 기록 — 표본 간 대소 관계는 단언하지 않는다(slice 3 선례).
  const observe = (label: string, assertion: S2Assertion): void => {
    const env = { label, concurrency: 1, dataScale: DATA_SCALE };
    const line = formatBaselineLine(buildBaselineReport(env, assertion));
    expect(line).toContain("p95=");
    observed.push(line);
  };

  // AC happy — Admin actor 의 3 슬롯 전량 조회(무필터 전량 `findMany()`, `include` 0).
  it("happy(Admin 목록): 200 + seed 3 슬롯 전량 + p95 < 3000ms pass", async () => {
    const { slotIds } = await seedSlots();
    const result = await measure(adminCookie, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    // 값 대조로 실 query 발화 입증 — id / difficulty 가 seed 와 일치.
    expect(rows()).toHaveLength(3);
    expect((rows().map((r) => r.id) as string[]).sort()).toEqual(
      Object.values(slotIds).sort(),
    );
    const seen = rows().map((r) => r.difficulty) as string[];
    expect(seen.sort()).toEqual(["easy", "hard", "medium"]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-difficulty-mapping-list", assertion);
  });

  describe("nullable FK · 미조인 SELECT 분기", () => {
    // (a) 슬롯 0 건 — 404 변환 없이 200 + 빈 배열(findMany native 동작, service raw forward).
    it("(a) 슬롯 0 건: 200 + 빈 배열(404 아님)", async () => {
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody).toEqual([]);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(true);
      expect(assertion.summary.p95).toBeLessThan(3000);
      observe("ci-realdb-difficulty-mapping-empty", assertion);
    });
    // (b) 축 (a) 증거 — NULL 슬롯과 비-NULL 슬롯 공존 + 비-NULL 값이 부모 id 와 정확히 일치.
    it("(b) FK NULL 슬롯과 비-NULL 슬롯 공존 + 비-NULL 값이 부모 config id 와 일치", async () => {
      const { configId } = await seedSlots();
      const result = await measure(adminCookie);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(bySlot("medium").llmProviderConfigId).toBeNull();
      expect(bySlot("easy").llmProviderConfigId).toBe(configId);
      expect(bySlot("hard").llmProviderConfigId).toBe(configId);
      // NULL 1 · 비-NULL 2 혼재 — 한쪽만 있는 표본이 아님을 못박는다.
      const fks = rows().map((r) => r.llmProviderConfigId);
      expect(fks.filter((v) => v === null)).toHaveLength(1);
      expect(fks.filter((v) => v === configId)).toHaveLength(2);
      expect(assertS2Threshold(result).pass).toBe(true);
    });
    // (c) 미조인 SELECT 증거 — 부모 실재해도 중첩 관계 키 부재 + 부모 payload 미유출.
    it("(c) 부모 row 실재해도 응답에 중첩 관계 객체 키 부재(include 0)", async () => {
      const { configId } = await seedSlots();
      expect(await prisma.llmProviderConfig.count()).toBe(1);
      await measure(adminCookie, 1);
      expect(lastStatus).toBe(200);
      expect(rows().every((r) => !("llmProviderConfig" in r))).toBe(true);
      // FK 문자열 컬럼만 직렬화 — 부모 본문은 어디에도 섞이지 않는다.
      const body = JSON.stringify(lastBody);
      expect(body).toContain(configId);
      expect(body).not.toContain(PARENT_MODEL);
      expect(body).not.toContain(PARENT_API_KEY);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) error path — Cookie 미부착 → `JwtAuthGuard` 401. 표본이 성공으로 집계되지 않고
    // 전량 `failures` 로 분류됨을 못박는다(DB 미도달이라 `p95MaxMs: 0` 로 측정 시간 무의존).
    it("(a) 인증 없음(Cookie 미부착): 401 failures 전량, 성공 표본 0", async () => {
      await seedSlots();
      const result = await measure(null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(result.total).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // (b) 변조 토큰 — cookie 는 있으나 서명이 깨져 검증 실패(200·403 아님).
    it("(b) 변조 토큰 cookie: 401 failures(403 아님)", async () => {
      await seedSlots();
      const result = await measure(tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // (c) `@Roles("Admin")` 이라 User tier 는 RolesGuard 단계에서 DB 미도달 403
    // (slice 10·11·12 와 같은 layer — 새 축 주장 없이 cover 만 유지).
    it("(c) User tier actor: guard 레벨 403(DB 미도달 — 슬롯 미노출)", async () => {
      const { slotIds } = await seedSlots();
      const result = await measure(userCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(result.samplesMs).toHaveLength(0);
      expect(JSON.stringify(lastBody)).not.toContain(slotIds.easy);
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // (d) 축 (b) 정리 순서 계약의 negative 증거 — 자식 잔존 상태의 부모 선삭제는
    // `onDelete: Restrict` 가 거부(Prisma `P2xxx`)하고, 자식 먼저 지우면 성공한다.
    it("(d) 자식 잔존 상태의 부모 deleteMany: Restrict 로 거부 + 자식 선삭제 후 성공", async () => {
      await seedSlots();
      const error: unknown = await prisma.llmProviderConfig
        .deleteMany()
        .then(() => null)
        .catch((e: unknown) => e);
      expect(error).not.toBeNull();
      expect(String((error as { code?: string }).code)).toMatch(/^P2\d{3}$/);
      expect(await prisma.difficultyMapping.count()).toBe(3);
      expect(await prisma.llmProviderConfig.count()).toBe(1);
      // 자식 먼저 → 부모 순서면 정상 정리(afterEach 가 쓰는 순서와 동일).
      await prisma.difficultyMapping.deleteMany();
      const removed = await prisma.llmProviderConfig.deleteMany();
      expect(removed.count).toBe(1);
    });
  });
});

// export-download-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip
// **slice 17** (T-1532, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s). 이미 실측
// 도메인인 `ExportController`(slice 10·15) 의 `GET /api/admin/export/:id/download` 를 실
// Postgres 위에서 처음 잰다 — 도메인 계수 14 불변, 조회 route 25 → 26. 새 축 셋 —
// (a) **한 요청이 서로 무관한 5 테이블을 병렬로 읽는 첫 실측 경로**(`collectFullExportRecords`
// 의 `Promise.all` fan-out; 앞 16 slice 의 최대 fan-out 은 같은 chain 안 navigation 이었다),
// (b) **응답이 JSON body 가 아니라 stream artifact 인 첫 slice**(`StreamableFile` + 직렬화 +
// Buffer 수집 + header 산출 비용이 latency 에 포함되고 응답 크기가 byte 로 관측된다),
// (c) **DB 읽기량과 응답 크기가 분리되는 첫 경로**(scope 선별이 DB 가 아니라 in-process 라
// RANGE / PARTIAL 이어도 읽는 row 수는 FULL 과 같다 — 규모 축이 "응답 크기" 가 아니라 "총 DB
// row 수" 다). `@Roles("Admin")` 403 · cookie 미부착/변조 401 · 부재 id 404 는 slice 10~16 과
// 동일해 **새 축으로 주장하지 않고** negative cover 로만 유지한다. mock 0 · override 0,
// production code · schema · 임계값 불변이며 소규모 표본이라 REQ-047 실 scale 부하가 아니다.
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

// 실 DB 부트스트랩 + 5 entity seed + 반복 다운로드 — slice 10·15 와 동등한 여유.
jest.setTimeout(120_000);

const BASE = "/api/admin/export";
const USER_ACTOR_EMAIL = "realdb-download-user-actor@e2e.test";
const ADMIN_ACTOR_EMAIL = "realdb-download-admin-actor@e2e.test";
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;
// dump envelope 의 entityCounts 가 항상 key 로 갖는 5 entity(정렬) — fan-out 5 의 대조 anchor.
const ENTITY_KEYS = ["Assessment", "AuditLog", "Group", "LlmConfig", "Person"];
// LlmProviderConfig 에 심는 secret sentinel — dump 본문 부재를 단언한다(REQ-032 회귀).
const SEED_API_KEY = "sk-secret-REALDB-SLICE17-must-not-leak-4b2e";
// 기본 seed instant — RANGE window 밖(창은 2026-05 한 달)이라 FULL 만 이 row 를 담는다.
const DEFAULT_INSTANT = new Date("2026-02-01T00:00:00.000Z");
// RANGE 창 [start, end) — end 정각 row 가 **배타** 임을 경계 seed 로 확증한다.
const RANGE_START = new Date("2026-05-01T00:00:00.000Z");
const RANGE_END = new Date("2026-06-01T00:00:00.000Z");
const BEFORE_START = new Date("2026-04-30T23:00:00.000Z");
// 상대적 대규모 seed 규모(AC 규모 관찰) — Person / Assessment 각 20 row.
const LARGE_PERSONS = 20;
const LARGE_ASSESSMENTS = 20;
// Assessment 복합 unique(personId, period, scope, periodStart) 회피용 periodStart 간격(1 일).
const DAY_MS = 24 * 60 * 60 * 1000;

// dump envelope 의 최소 형태 — e2e(T-0520/T-1292) 의 인라인 타입과 동형.
interface Dump {
  schemaVersion: string;
  generatedAt: string;
  scope: { scope: string; entitySelector?: string[] };
  entityCounts: Record<string, number>;
  recordCount: number;
  records: Array<{ entity: string; fields: Record<string, unknown> }>;
}

describe("S2 조회 latency perf-spec — 실 DB export dump 다운로드 (GET /api/admin/export/:id/download, REQ-048)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  // 서명 변조 cookie — `JwtAuthGuard` 가 401(negative (b)).
  let tamperedCookie: string;
  let adminActorId: string;
  // 마지막 응답 — stream artifact 라 body 는 raw 문자열로 받는다(byte 길이 대조용).
  let lastText = "";
  let lastStatus = 0;
  let lastHeaders: Record<string, string> = {};
  // seed email 충돌 방지용 단조 증가 seq(같은 ms 안 다중 seed 대비).
  let seedSeq = 0;
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
    adminActorId = ctx.users[ADMIN_ACTOR_EMAIL].id;
    await cleanDomainRows();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // ADR-0004 §Cleanup. `truncateAll` 명단에 없는 테이블은 spec-local `deleteMany` 로 흡수한다
  // (slice 11·13 선례, `db-truncate.ts` 수정 0) — `ExportJob` 은 `User` onDelete: Restrict 라
  // truncate 보다 먼저 비우고, `LlmProviderConfig` 는 명단의 어떤 테이블도 참조하지 않아
  // CASCADE 로 안 지워지며(다음 test 로 row 가 샌다), 그 자식 `DifficultyMapping`(Restrict)은
  // 앞 spec 잔여 방어로 부모보다 먼저 비운다. `Assessment` 는 Person CASCADE 로 함께 지워지지만
  // 순서 의존을 없애려 명시한다.
  const cleanDomainRows = async (): Promise<void> => {
    await prisma.exportJob.deleteMany();
    await prisma.difficultyMapping.deleteMany();
    await prisma.llmProviderConfig.deleteMany();
    await prisma.assessment.deleteMany();
  };

  // `truncateAll` 의 `"User"` 가 JWT `sub` 의 actor row 를 지우므로 **원본 id 그대로** 재삽입
  // 한다(재발급 금지 — slice 10·15 선례). `ExportJob.requestedById` FK 대상이 이 actor 다.
  afterEach(async () => {
    await cleanDomainRows();
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // connection 누수 0 — app.close() lifecycle hook + 명시적 $disconnect. 관찰 기록은 표본
  // 간 대소 관계를 단언하지 않고 로그로만 남긴다(slice 3 선례).
  afterAll(async () => {
    console.log(`[T-1532 관찰] ${observed.join(" | ")}`);
    await app.close();
    await prisma.$disconnect();
  });

  // 5 entity seed — 모든 row 의 instant(createdAt) 를 같은 시각으로 맞춰 RANGE 판정을
  // 결정론적으로 만든다. 반환은 entity 별 기대 count(= 선별 전 총 row 수).
  const seedEntities = async (
    options: { instant?: Date; persons?: number; assessments?: number } = {},
  ): Promise<Record<string, number>> => {
    const instant = options.instant ?? DEFAULT_INSTANT;
    const persons = options.persons ?? 1;
    const assessments = options.assessments ?? 1;
    const stamp = `${Date.now()}-${(seedSeq += 1)}`;
    const personIds: string[] = [];
    for (let i = 0; i < persons; i += 1) {
      const created = await prisma.person.create({
        data: {
          fullName: `다운로드대상${i}`,
          email: `dl-person-${stamp}-${i}@e2e.test`,
          createdAt: instant,
        },
      });
      personIds.push(created.id);
    }
    // `Assessment` 는 (personId, period, scope, periodStart) 복합 unique 라 person 을 돌려쓰면
    // 같은 조합이 재발한다(persons < assessments 인 seed). `periodStart` 를 i 일씩 벌려 조합을
    // 유일하게 만든다 — 선별 축은 `createdAt`(instant) 이라 RANGE 판정에는 영향이 없다.
    for (let i = 0; i < assessments; i += 1) {
      await prisma.assessment.create({
        data: {
          personId: personIds[i % personIds.length],
          period: "week",
          scope: "commit",
          periodStart: new Date(instant.getTime() + i * DAY_MS),
          difficulty: "medium",
          contributionScore: "0.75",
          volume: 10,
          narrative: "이번 주 기여 요약",
          createdAt: instant,
        },
      });
    }
    await prisma.group.create({
      data: { name: `다운로드그룹-${stamp}`, createdAt: instant },
    });
    // 🔥 secret 보유 entity — apiKey 가 dump 에 부재함을 단언할 sentinel(REQ-032).
    await prisma.llmProviderConfig.create({
      data: {
        provider: "openai",
        endpointUrl: "https://api.openai.com/v1",
        apiKey: SEED_API_KEY,
        modelId: "gpt-4o",
        createdAt: instant,
      },
    });
    await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.example.net",
        resourceRef: "/repos/o/r/commits",
        httpStatus: 403,
        reason: "permission-denied",
        createdAt: instant,
      },
    });
    return {
      Assessment: assessments,
      Person: persons,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 1,
    };
  };

  // export job seed — Prisma 직접 write(POST 계열 latency 는 범위 밖). FK `requestedById` 는
  // Admin actor id(Restrict FK 충족). dateRange / entitySelector 미지정은 DB NULL 이다.
  const seedJob = async (job: {
    scope: "FULL" | "RANGE" | "PARTIAL";
    dateRange?: { start: string; end: string };
    entitySelector?: string[];
  }): Promise<string> => {
    const created = await prisma.exportJob.create({
      data: {
        status: "SUCCEEDED",
        scope: job.scope,
        requestedById: adminActorId,
        dateRange: job.dateRange,
        entitySelector: job.entitySelector,
      },
    });
    return created.id;
  };

  // stream artifact 응답을 raw 문자열로 받는다 — Content-Length 와 실 body byte 를 대조해야
  // 하므로 supertest 기본 파서 대신 chunk 를 직접 모은다(e2e T-0520 과 동일 방식).
  const downloadRaw = (path: string, cookie: string | null) => {
    const req = request(app.getHttpServer())
      .get(path)
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => callback(null, data));
      });
    return cookie === null ? req : req.set("Cookie", cookie);
  };
  // 조회 1 회. `cookie: null` 이면 Cookie 미부착이라 401 분기로 간다.
  const getRequest =
    (path: string, cookie: string | null): RequestFn =>
    async () => {
      const res = await downloadRaw(path, cookie);
      lastText = typeof res.body === "string" ? res.body : "";
      lastStatus = res.status;
      lastHeaders = res.headers as Record<string, string>;
      return { status: res.status };
    };
  const measure = (path: string, cookie: string | null, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path, cookie), n);
  // 본 slice 측정 대상 route — `:id/download` 를 Admin cookie 로 친다.
  const measureDownload = (id: string, n = SHORT_ITERATIONS) =>
    measure(`${BASE}/${id}/download`, adminCookie, n);
  const dump = (): Dump => JSON.parse(lastText) as Dump;
  // baseline 한 줄 관찰 기록(확정 write 0 — `buildBaselineReport`/`formatBaselineLine` 관찰 전용).
  const observe = (
    label: string,
    assertion: S2Assertion,
    scale: string,
  ): void => {
    const env = { label, concurrency: 1, dataScale: scale };
    observed.push(formatBaselineLine(buildBaselineReport(env, assertion)));
  };
  // envelope 메타 일관성 — recordCount === records.length === entityCounts 5 값의 합.
  const expectConsistentDump = (): Dump => {
    const parsed = dump();
    expect(Object.keys(parsed.entityCounts).sort()).toEqual(ENTITY_KEYS);
    expect(parsed.recordCount).toBe(parsed.records.length);
    expect(
      Object.values(parsed.entityCounts).reduce((sum, n) => sum + n, 0),
    ).toBe(parsed.recordCount);
    return parsed;
  };
  // 기대 count 표와 dump 의 entityCounts 를 entity 단위로 비교(미지정 entity 는 0 기대).
  const expectCounts = (expected: Record<string, number>): void => {
    const parsed = expectConsistentDump();
    for (const entity of ENTITY_KEYS) {
      expect([entity, parsed.entityCounts[entity]]).toEqual([
        entity,
        expected[entity] ?? 0,
      ]);
    }
  };

  // AC happy — Admin actor 의 FULL scope 다운로드. 5 테이블 fan-out 이 한 artifact 로 합쳐진다.
  it("happy(Admin FULL :id/download): 200 + dump envelope + p95 < 3000ms pass", async () => {
    const expected = await seedEntities();
    const jobId = await seedJob({ scope: "FULL" });
    const result = await measureDownload(jobId, ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const parsed = expectConsistentDump();
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.scope.scope).toBe("full");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(parsed.recordCount).toBe(5);
    expect(parsed.records.map((r) => r.entity).sort()).toEqual(ENTITY_KEYS);
    expectCounts(expected);
    // secret 은 5 entity fan-out 을 통과해도 artifact 로 새지 않는다(REQ-032 회귀).
    expect(lastText).not.toContain(SEED_API_KEY);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    // 측정 시간 무의존 fail 분기 — 실측이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    observe(
      "ci-realdb-export-download-full",
      assertion,
      "5 entity 각 1 row -> artifact 1",
    );
    expect(observed.join()).toContain("p95=");
  });

  // AC artifact 계약 — header 3 종 + Content-Length 가 실 body byte 와 일치(byteSizeHint 를
  // 합성 dump 값이 아니라 실 buffer 길이로 보정하는 경로의 증거).
  it("artifact 계약: Content-Type/Disposition/Length + Length 가 실 body byte 와 일치", async () => {
    await seedEntities();
    const jobId = await seedJob({ scope: "FULL" });
    const result = await measureDownload(jobId, 1);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastHeaders["content-type"]).toContain("application/json");
    expect(lastHeaders["content-disposition"]).toContain(
      'attachment; filename="export-full-',
    );
    expect(lastHeaders["content-disposition"]).toContain('.json"');
    // 실 byte 길이 일치 — 불일치면 응답이 잘리거나 hang 한다(합성 seed 길이면 어긋난다).
    expect(Number(lastHeaders["content-length"])).toBe(
      Buffer.byteLength(lastText, "utf8"),
    );
    expect(Number(lastHeaders["content-length"])).toBeGreaterThan(0);
    // recordCount === entityCounts 합 은 expectConsistentDump 가 단언한다.
    expect(expectConsistentDump().recordCount).toBe(5);
  });

  // AC error path — 미존재 job id 는 `findJob` 의 NotFoundException 이 dump 산출 전에 404 로
  // raw propagate. body 에 raw stack / Prisma 내부 메시지가 새지 않음도 단언(REQ-032).
  it("error path(미존재 id): 404 전량 failures + raw stack·Prisma 메시지 미노출", async () => {
    await seedEntities();
    const result = await measureDownload("realdb-missing-download-id");
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
    expect(lastText).not.toContain("P2025");
    expect(lastText).not.toContain("prisma");
    expect(lastText).not.toContain("stack");
    expect(lastText).not.toContain("schemaVersion");
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
  });

  describe("저장 scope 3 분기 cover", () => {
    // (a) FULL — seed 한 5 entity row 가 모두 dump 에 담긴다(선별 없음).
    it("(a) FULL: seed 한 5 entity row 전량 포함 + p95 < 3000ms", async () => {
      const expected = await seedEntities({ persons: 2, assessments: 3 });
      const jobId = await seedJob({ scope: "FULL" });
      const result = await measureDownload(jobId);
      expect(result.failures).toBe(0);
      expectCounts(expected);
      expect(expectConsistentDump().recordCount).toBe(8);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (b) RANGE — [start, end) 반열림. end 정각 row 는 **제외**, start 정각 row 는 포함.
    // 나머지 4 entity 는 창 이전 시각이라 전부 탈락한다(읽기는 하되 선별에서 빠진다).
    it("(b) RANGE: end 정각 row 제외 · start 정각 row 포함 + p95 < 3000ms", async () => {
      await seedEntities({ instant: BEFORE_START });
      const stamp = `${Date.now()}-${(seedSeq += 1)}`;
      await prisma.person.createMany({
        data: [
          {
            fullName: "경계시작",
            email: `range-start-${stamp}@e2e.test`,
            createdAt: RANGE_START,
          },
          {
            fullName: "경계끝",
            email: `range-end-${stamp}@e2e.test`,
            createdAt: RANGE_END,
          },
        ],
      });
      const jobId = await seedJob({
        scope: "RANGE",
        dateRange: {
          start: RANGE_START.toISOString(),
          end: RANGE_END.toISOString(),
        },
      });
      const result = await measureDownload(jobId);
      expect(result.failures).toBe(0);
      const parsed = expectConsistentDump();
      expect(parsed.scope.scope).toBe("range");
      // 창 안은 start 정각 Person 1 건뿐 — end 정각은 배타 경계라 빠진다.
      expectCounts({ Person: 1 });
      expect(parsed.records[0].fields.fullName).toBe("경계시작");
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
    // (c) PARTIAL — entitySelector 멤버십. Person 외 4 entity 의 count 가 0 이다.
    it("(c) PARTIAL([Person]): Person 외 entity count 0 + p95 < 3000ms", async () => {
      await seedEntities({ persons: 3, assessments: 2 });
      const jobId = await seedJob({
        scope: "PARTIAL",
        entitySelector: ["Person"],
      });
      const result = await measureDownload(jobId);
      expect(result.failures).toBe(0);
      const parsed = expectConsistentDump();
      expect(parsed.scope.scope).toBe("partial");
      expectCounts({ Person: 3 });
      expect(parsed.records.every((r) => r.entity === "Person")).toBe(true);
      expect(assertS2Threshold(result).summary.p95).toBeLessThan(3000);
    });
  });

  // AC 규모 관찰 — 같은 FULL scope 를 소규모 / 상대적 대규모 두 seed 상태에서 측정한다.
  // 두 p95 모두 3000ms 미만만 단언하고 **대소 관계와 byte 증가량은 단언하지 않는다**(slice 3
  // 선례 — wall-clock 비결정성). 축 (c) 대로 규모 축은 총 DB row 수다.
  it("규모 관찰: 소규모 seed 와 대규모 seed 의 p95 를 각각 3000ms 미만으로 단언", async () => {
    const smallExpected = await seedEntities();
    const smallJob = await seedJob({ scope: "FULL" });
    const smallResult = await measureDownload(smallJob);
    expect(smallResult.failures).toBe(0);
    const smallBytes = Buffer.byteLength(lastText, "utf8");
    const smallAssertion = assertS2Threshold(smallResult);

    const largeExpected = await seedEntities({
      persons: LARGE_PERSONS,
      assessments: LARGE_ASSESSMENTS,
    });
    const largeJob = await seedJob({ scope: "FULL" });
    const largeResult = await measureDownload(largeJob);
    expect(largeResult.failures).toBe(0);
    const largeParsed = expectConsistentDump();
    // 대규모 표본은 소규모 seed 분까지 **함께** 읽는다(두 seed 누적 — 축 (c) 의 규모 축은
    // 응답 크기가 아니라 총 DB row 수다). 기대치는 두 seed 반환 표의 합으로 산출한다.
    const totalRows = ENTITY_KEYS.reduce(
      (sum, entity) =>
        sum + (smallExpected[entity] ?? 0) + (largeExpected[entity] ?? 0),
      0,
    );
    expect(largeParsed.recordCount).toBe(totalRows);
    const largeAssertion = assertS2Threshold(largeResult);
    expect(smallAssertion.summary.p95).toBeLessThan(3000);
    expect(largeAssertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-export-download-small", smallAssertion, "총 5 row");
    observe(
      "ci-realdb-export-download-large",
      largeAssertion,
      `총 ${largeParsed.recordCount} row`,
    );
    // 관찰 기록만 — 대소 관계 assert 0.
    console.log(
      `[T-1532 규모 관찰] small=${smallBytes}B p95=${smallAssertion.summary.p95}ms | ` +
        `large=${Buffer.byteLength(lastText, "utf8")}B p95=${largeAssertion.summary.p95}ms`,
    );
  });

  describe("negative cases 충분 cover", () => {
    // (a) Cookie 미부착 → `JwtAuthGuard` 401. 표본 0 이라 측정 시간 무의존 단언.
    it("(a) 인증 없음(Cookie 미부착): 401 전량 failures, 표본 0", async () => {
      await seedEntities();
      const jobId = await seedJob({ scope: "FULL" });
      const result = await measure(`${BASE}/${jobId}/download`, null);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(result.samplesMs).toHaveLength(0);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.errorRate).toBe(1);
    });
    // (b) 서명 변조 토큰 — cookie 는 있으나 검증 실패라 401(403 아님).
    it("(b) 서명 변조 cookie: 401(403 아님) + dump 필드 미노출", async () => {
      await seedEntities();
      const jobId = await seedJob({ scope: "FULL" });
      const result = await measure(`${BASE}/${jobId}/download`, tamperedCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(401);
      expect(lastText).not.toContain("entityCounts");
      expect(assertS2Threshold(result, { p95MaxMs: 0 }).pass).toBe(false);
    });
    // (c) `@Roles("Admin")` 이라 User tier 는 **RolesGuard 단계** 에서 DB 미도달 403.
    it("(c) User tier actor: guard 레벨 403(service·DB 미도달)", async () => {
      await seedEntities();
      const jobId = await seedJob({ scope: "FULL" });
      const result = await measure(`${BASE}/${jobId}/download`, userCookie);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(403);
      expect(result.samplesMs).toHaveLength(0);
      expect(lastText).not.toContain("recordCount");
      // 같은 job 을 Admin 이 치면 여전히 200 — 403 원인이 tier 임을 못박는다.
      await measureDownload(jobId, 1);
      expect(lastStatus).toBe(200);
    });
    // (d) 미존재 id → 404. 같은 시점의 실재 id 가 200 임을 대조해 원인이 id 부재임을 못박는다.
    it("(d) 미존재 id: 404(같은 시점 실재 id 는 200)", async () => {
      await seedEntities();
      const jobId = await seedJob({ scope: "FULL" });
      const result = await measureDownload("realdb-absent-download-job");
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      await measureDownload(jobId, 1);
      expect([lastStatus, dump().scope.scope]).toEqual([200, "full"]);
    });
    // (e) 저장 scope 손상(RANGE 인데 dateRange NULL) — `selectExportRecords` 의 RangeError 가
    // **`@UseFilters(ScopeInputExceptionFilter)` 미부착 경로** 라 400 이 아닌 5xx 로 나타난다.
    // 현재 동작의 박제일 뿐이며 400 매핑 판단은 별도 task(task §Out of Scope).
    it("(e) 저장 scope 손상(RANGE + dateRange NULL): 5xx + raw stack 미노출", async () => {
      await seedEntities();
      const brokenJob = await seedJob({ scope: "RANGE" });
      const result = await measureDownload(brokenJob);
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBeGreaterThanOrEqual(500);
      expect(result.samplesMs).toHaveLength(0);
      // 내부 helper 이름 · stack · scope 값이 응답으로 새지 않는다(REQ-032).
      expect(lastText).not.toContain("selectExportRecords");
      expect(lastText).not.toContain("RangeError");
      expect(lastText).not.toContain("stack");
      // 같은 시점의 정상 FULL job 은 200 — 5xx 원인이 저장 scope 손상임을 못박는다.
      const healthyJob = await seedJob({ scope: "FULL" });
      await measureDownload(healthyJob, 1);
      expect(lastStatus).toBe(200);
    });
    // (f) 두 job 의 응답이 섞이지 않는다 — 연달아 호출해도 각 dump 가 자기 scope 기준이다.
    it("(f) FULL job 과 PARTIAL job 을 연달아 호출: entityCounts 가 각각 자기 scope 기준", async () => {
      const expected = await seedEntities({ persons: 2 });
      const fullJob = await seedJob({ scope: "FULL" });
      const partialJob = await seedJob({
        scope: "PARTIAL",
        entitySelector: ["Group"],
      });
      await measureDownload(fullJob, 1);
      expect(lastStatus).toBe(200);
      expectCounts(expected);
      await measureDownload(partialJob, 1);
      expect(lastStatus).toBe(200);
      expectCounts({ Group: 1 });
      // 다시 FULL 을 치면 원래 계수로 돌아온다(응답 캐시·상태 오염 0).
      await measureDownload(fullJob, 1);
      expectCounts(expected);
    });
  });
});

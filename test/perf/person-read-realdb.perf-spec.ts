// person-read-realdb.perf-spec.ts — S2 조회 latency harness 의 *첫 실 DB round-trip
// perf-spec*. (T-1500, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// 목적: 기존 30+ perf-spec 은 전부 `useValue` mock service 라 **Prisma round-trip 이 0**
// 이었다. 그래서 REQ-048(p95 < 3000ms) 판정이 "controller ↔ collector 배선 latency" 위에서만
// 성립했고 실 Postgres 왕복 경로는 미실측으로 남았다(§5 item 5 / requirements.md REQ-048
// 재판정의 유일 잔여 서버측 한계). 본 spec 은 그 vein 을 **endpoint 1 개**(`GET /api/persons`)
// 만 실 DB 로 cutover 해, 임계가 실 query 포함 경로에서도 성립함을 최초로 실측한다.
//
// mock 짝(`person-read.perf-spec.ts`, T-0833)과의 차이:
//   - 부트스트랩: mock 짝은 controller + mock provider 만 띄운다. 본 spec 은 `createE2EApp()`
//     로 **AppModule 전체를 mock override 0**(PersonService·PrismaService 미대체) 으로 띄우고
//     `moduleRef.get(PrismaService)` 로 얻은 실 client 로 seed 한다.
//   - 측정 대상: mock 짝 = 배선 latency(즉시 반환) / 본 spec = **DB round-trip 포함** latency.
//   - 검증 방식: mock 짝은 `service.findActive` 호출 횟수를, 본 spec 은 **응답 body 가 seed 한
//     row 값과 일치**함을 확인해 실 query 발화를 입증한다.
//   - 대상 선정: `PersonController` 는 guard 미부착 + query-param 필수 분기(400) 없는 단순 list
//     read 라 인증·권한 노이즈 0 에서 DB 왕복 비용만 분리 측정된다. mock 짝의 "실 DB round-trip
//     baseline 은 §5 item 5 별도 follow-up" 주석이 가리키는 follow-up 이 본 spec 이다(그 주석
//     자체는 변경하지 않고 여기서 cross-ref 만 한다).
//
// 결정론 전략: seed 는 `prisma.person.createMany` 로 고정 행 수, `afterEach(truncateAll)`
// (ADR-0004 §Cleanup) 가 매 test 후 도메인 테이블을 비워 각 test 는 자기 seed 만 본다. latency
// 표본은 wall-clock 이라 값은 비결정적이나 단일 클라이언트 · 소량 row 라 p95 는 임계(3000ms)
// 훨씬 아래 → pass 분기 결정론적 도달. fail 분기는 latency 가 아니라 **실 DB 미존재 row 의
// 404**(errorRate 위반) 또는 비현실적 임계 주입(`p95MaxMs: 0`)으로 도달해 실 측정 시간에
// 의존하지 않는다. 실행 전제인 실 Postgres + migrate 적용 schema 는 CI 의 `perf test` step 이
// `services.postgres` + migrate deploy + e2e 이후라 자동 충족된다(로컬 실행은 README 참조).
//
// 실행 스위트(AC 7): 본 파일은 `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)
// 에만 매칭돼 `pnpm test:perf` 로만 실행된다. 기본 `pnpm test`(`.*\.spec\.ts$`)는
// "perf-spec.ts"(`.` 아닌 `-` 구분자)를 매칭하지 못해 **picking 되지 않는다**(coverage gate 분리).
//
// Out of Scope: production code 변경 0(test-only) / 나머지 mock perf-spec 의 실 DB cutover /
// 임계값 변경·baseline 파일 확정(`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile`·
// `confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write 0) / 부하 발생기 도입 · S1 · S3
// harness — 전부 별도 slice.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

import { buildBaselineReport, formatBaselineLine } from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청이라 mock spec 보다 느리다.
// 기본 5s 로는 CI 의 cold connection pool 에서 flaky 할 수 있어 여유를 둔다.
jest.setTimeout(60_000);

// 다건 seed 기본 행 수(AC 2/AC 4 ②) — 단일 클라이언트 경량 스모크 수준(§4.1).
const SEED_ROWS = 20;
// 반복 측정 횟수 — 표본 20 개면 p95 가 상위 표본 구간에서 산출된다.
const ITERATIONS = 20;

describe("S2 조회 latency perf-spec — 실 DB round-trip (GET /api/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + applyGlobalMiddleware(T-0090 helper).
    const created = await createE2EApp();
    app = created.app;
    // 실 PrismaService 인스턴스를 DI container 에서 획득 — seed / truncate / disconnect 용.
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    // 앞선 스위트(e2e 등)가 남긴 row 가 있으면 첫 test 의 seed 수 검증이 오염되므로
    // 시작 시점에도 한 번 비운다(afterEach 와 동일 helper — 격리 전제 확정).
    await truncateAll(prisma);
  });

  afterEach(async () => {
    // ADR-0004 §Cleanup — 매 test 후 도메인 테이블 TRUNCATE 로 row leak 0.
    await truncateAll(prisma);
  });

  afterAll(async () => {
    // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
    await app.close();
    await prisma.$disconnect();
  });

  // 실 Person row 를 다건 seed 한다(1 round-trip). active 는 schema default true.
  const seedPersons = async (
    count: number,
    active = true,
  ): Promise<{ fullName: string; email: string }[]> => {
    const rows = Array.from({ length: count }, (_, i) => ({
      fullName: `실DB인원-${i}`,
      email: `realdb-perf-${i}@example.test`,
      active,
    }));
    if (rows.length > 0) {
      await prisma.person.createMany({ data: rows });
    }
    return rows.map(({ fullName, email }) => ({ fullName, email }));
  };

  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastListBody: unknown;

  // 목록 조회 1회 — collector 가 소비할 { status } 반환(supertest 는 non-2xx 도 resolve).
  const listRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/persons");
    lastListBody = res.body;
    return { status: res.status };
  };

  // 단건 상세 조회 — 실 DB 에 없는 id 면 service 의 findById 가 NotFoundException → 404.
  const detailRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/persons/${id}`);
      return { status: res.status };
    };

  // AC 2 — happy path. 다건 seed → 실 round-trip 반복 측정 → REQ-048 p95 판정.
  it("happy: 다건 seed 후 N회 반복 조회 → 전부 200 + 응답이 seed 와 일치 + p95 < 3000ms pass", async () => {
    const seeded = await seedPersons(SEED_ROWS);

    const result = await collectLatencySamples(listRequest, ITERATIONS);

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(result.samplesMs).toHaveLength(ITERATIONS);

    // mock 이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    expect(Array.isArray(lastListBody)).toBe(true);
    const body = lastListBody as { fullName: string; email: string }[];
    expect(body).toHaveLength(SEED_ROWS);
    expect(body.map((p) => p.email).sort()).toEqual(
      seeded.map((p) => p.email).sort(),
    );
    expect(body.every((p) => typeof p.fullName === "string")).toBe(true);

    // REQ-048 임계 — 실 DB round-trip 을 포함한 경로에서의 첫 실측 판정.
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.reasons).toHaveLength(0);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });

  // AC 3 / AC 5 (a) — error path. seed 0 상태의 실 DB 에서 findUnique 가 null →
  // service 가 NotFoundException(404) → collector 가 non-2xx 로 분류.
  it("error: 미존재 id 로 N회 상세 조회 → 전부 404 failures, pass===false + errorRate 사유", async () => {
    const result = await collectLatencySamples(
      detailRequest("realdb-missing-id"),
      4,
    );

    expect(result.total).toBe(4);
    expect(result.failures).toBe(4);
    expect(result.samplesMs).toHaveLength(0);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);
  });

  // AC 4 ① — seed 0행(truncate 직후). active 인원 0 은 목록 조회의 정상 결과(404 아님).
  it("분기 ①: seed 0행 → 200 + 빈 배열 + p95 pass, summarizeLatency.count === 요청 수", async () => {
    const result = await collectLatencySamples(listRequest, ITERATIONS);

    expect(result.failures).toBe(0);
    expect(Array.isArray(lastListBody)).toBe(true);
    expect(lastListBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 4 ② — seed 다건. 같은 harness 가 목록 반환 분기에서도 동일 표본 수를 낸다.
  it("분기 ②: seed 다건 → 200 + 목록 + p95 pass, summarizeLatency.count === 요청 수", async () => {
    await seedPersons(SEED_ROWS);

    const result = await collectLatencySamples(listRequest, ITERATIONS);

    expect(result.failures).toBe(0);
    expect(lastListBody as unknown[]).toHaveLength(SEED_ROWS);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  describe("negative cases 충분 cover(AC 5)", () => {
    // (b) 경계값 — active:false row 만 있으면 findActive(activeOnly:true) 필터가 전부
    //     걸러내 200 + 빈 배열. 실 DB WHERE 절 분기가 발화했음을 body 로 확인.
    it("(b) active:false row 만 seed → GET /api/persons 는 200 + 빈 배열(목록 필터 분기)", async () => {
      await seedPersons(5, false);

      const result = await collectLatencySamples(listRequest, 4);

      expect(result.failures).toBe(0);
      expect(Array.isArray(lastListBody)).toBe(true);
      expect(lastListBody as unknown[]).toHaveLength(0);
      // 실 DB 에는 row 가 남아 있다 — 응답이 빈 것은 삭제가 아니라 active 필터 때문.
      expect(await prisma.person.count()).toBe(5);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (c) 표본 혼합 — 200(목록)과 404(미존재 상세)를 번갈아 호출해 errorRate 가
    //     0 < er < 1 로 산출되는지 확인(전부 성공/전부 실패의 양극단이 아닌 중간값).
    it("(c) 200 + 404 혼합 표본 → errorRate 가 0 < er < 1 로 산출, pass===false", async () => {
      await seedPersons(3);
      let call = 0;
      const mixedRequest: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 목록(200), 짝수 번째는 미존재 상세(404).
        return call % 2 === 1
          ? listRequest()
          : detailRequest("realdb-missing-mixed")();
      };

      const result = await collectLatencySamples(mixedRequest, 4);

      expect(result.total).toBe(4);
      expect(result.failures).toBe(2);
      expect(result.samplesMs).toHaveLength(2);

      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (d) 비현실적 임계 — 실 측정값이라도 p95MaxMs: 0 이면 반드시 fail(임계 주입이
    //     실제로 판정에 반영되는지 확인. 실 latency 값에 의존하지 않는 결정론적 fail).
    it("(d) p95MaxMs: 0 을 주면 실 측정값이라도 pass===false + p95 사유", async () => {
      await seedPersons(3);

      const result = await collectLatencySamples(listRequest, 4);

      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });
  });

  // AC 6 — baseline 리포트 관찰 1 건. 관찰 전용이라 writeBaselineFile /
  // confirmOrCompareBaseline 미사용(디스크 write 0, baseline 확정 없음).
  it("baseline: 실 DB 측정 결과로 한 줄 리포트 조립 → p95= / count= 키 포함(파일 write 0)", async () => {
    await seedPersons(SEED_ROWS);

    const result = await collectLatencySamples(listRequest, ITERATIONS);
    const assertion = assertS2Threshold(result);

    const report = buildBaselineReport(
      {
        label: "ci-realdb-person-read",
        concurrency: 1,
        dataScale: `${SEED_ROWS} persons`,
      },
      assertion,
    );
    const line = formatBaselineLine(report);

    expect(line).toContain("p95=");
    expect(line).toContain("count=");
    expect(line).toContain("[ci-realdb-person-read]");
    expect(line).toContain(`dataScale=${SEED_ROWS} persons`);
    expect(report.count).toBe(ITERATIONS);
    expect(report.pass).toBe(true);
  });
});

// person-list-scale-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 23**.
// (T-1545, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — 부트스트랩·seed·정리·관찰 **구조는 slice 3**(`group-persons-scale-realdb.perf-spec.ts`,
//    T-1504)**을 그대로 승계**한다(산문 복제 대신 cross-ref — 그 파일의 헤더 ①~⑤ 참조). 대상 route 는
//    slice 1(`person-read-realdb.perf-spec.ts`, T-1500)과 **같은** `GET /api/persons` 이며, slice 1 의
//    고정 20 row 한 표본을 **규모 축** 으로 넓힌다. slice 1·3 파일은 수정하지 않는다.
// ② slice 3 과의 셈법 차이 — slice 3 은 membership 수 = **요청당 query 수** 인 N+1 축이었다. 본 spec 의
//    `findActive` 는 단일 SELECT 라 query 수가 1 로 고정이고 **결과 집합 크기(직렬화·전송 비용)** 만
//    커진다 — 같은 "규모" 가 가리키는 비용 항목이 서로 다르다.
// ③ 측정 의도 — `PersonController.findActive`(guard 미부착 · 필수 query-param 분기 0)는 인증·권한
//    노이즈 0 이라 **row 수 → latency** 만 분리 관측된다. 여기에 `active: false` 를 섞어 **응답 row
//    수(120)와 스캔 대상(200)이 분리** 되는 필터 선택도 축을 처음 증거화한다. **측정만 한다** — index
//    추가 · 쿼리 최적화 · 페이지네이션은 production / schema 변경이라 범위 밖.
// ④ 결정론 전략 — 고정 행 수 seed + `afterEach(truncateAll)`(ADR-0004 §Cleanup), `Person.email` 은
//    `@unique` 라 index 접미로 충돌 회피. latency 는 wall-clock 이라 **어떤 두 측정값의 대소도 단언하지
//    않고**(large > small 도 금지) 관찰 줄로만 남긴다 — 허용 단언은 고정 임계 3000ms 대비 pass 와 주입
//    임계 `p95MaxMs: 0` 대비 fail 뿐이다. 본 route 는 에러 경로가 구조적으로 부재(항상 200)하므로
//    errorRate 위반 분기는 **인위 non-2xx 주입** 으로 도달시킨다. 본 파일은
//    `jest-perf.json`(`test/perf/.*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고 기본
//    `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**.
// ⑤ Out of Scope — production code · schema 변경 0 / 기존 perf-spec · helper · primitive 수정 0 / 임계값
//    변경 · baseline 확정(`writeBaselineFile`·`confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크
//    write 0) / 동시성 S3(`concurrency: 1` 고정). "대규모" 는 **상대 비교용 표본** 일 뿐
//    **REQ-047 의 실 scale 부하 검증이 아니다**.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

import {
  buildBaselineReport,
  formatBaselineLine,
  type BaselineReport,
} from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
  type S2Assertion,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩 + 200 row seed + 반복 요청이라 slice 3 과 같은 수준의 여유를 둔다.
jest.setTimeout(120_000);

// 두 규모 표본(소규모는 slice 1 과 같은 20 row 라 대조 기준) + 필터 선택도 표본(응답 120 / 스캔 200).
const SMALL_ROWS = 20;
const LARGE_ROWS = 200;
const MIXED_ACTIVE_ROWS = 120;
const MIXED_INACTIVE_ROWS = 80;
// 반복 횟수 — 대규모는 응답 직렬화 비용이 커 줄이고(slice 3 선례), SHORT 는 분기 도달용.
const SMALL_ITERATIONS = 10;
const LARGE_ITERATIONS = 6;
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB 목록 규모 민감도 (GET /api/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  // AC 6 — 표본별 baseline 한 줄 관찰을 선언 순서대로 축적(대소 assert 금지, 파일 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(PersonService·PrismaService 미대체).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    // 앞선 스위트가 남긴 row 가 첫 test 의 seed 수 검증을 오염시키지 않게 시작 시점에도 비운다.
    await truncateAll(prisma);
  });

  // ADR-0004 §Cleanup — 매 test 후 도메인 테이블을 비워 row leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Person N 건 seed — 대규모도 create loop 이 아니라 `createMany` 1 round-trip 으로 조립한다.
  const seedPersons = async (count: number, active = true): Promise<void> => {
    if (count === 0) {
      return;
    }
    const prefix = active ? "active" : "inactive";
    await prisma.person.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        fullName: `실DB목록-${prefix}-${i}`,
        email: `realdb-list-scale-${prefix}-${i}@example.test`,
        active,
      })),
    });
  };

  // 목록 조회 1회 — 단일 SELECT 가 결과 집합 전체를 직렬화해 반환하는 경로.
  const listRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/persons");
    lastBody = res.body;
    return { status: res.status };
  };

  // baseline 한 줄 관찰 조립(AC 6) — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    rows: number,
    assertion: S2Assertion,
  ): BaselineReport => {
    const env = { label, concurrency: 1, dataScale: `${rows} persons` };
    const report = buildBaselineReport(env, assertion);
    observations.push({ line: formatBaselineLine(report), report });
    return report;
  };

  // AC 2 ① — 소규모 표본. 응답 배열 길이가 seed 행 수와 정확히 일치함으로 실 query 발화를 입증.
  it("happy ①(소규모): 20 row 반복 조회 → 200 + 응답 길이 20 + p95 < 3000ms pass", async () => {
    await seedPersons(SMALL_ROWS);
    const result = await collectLatencySamples(listRequest, SMALL_ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(SMALL_ROWS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(SMALL_ITERATIONS);
    expect(
      observe("ci-realdb-person-list-small", SMALL_ROWS, assertion).count,
    ).toBe(SMALL_ITERATIONS);
  });

  // AC 2 ② — 대규모 표본(본 slice 핵심). query 수는 1 로 고정이고 **결과 집합 크기만** 10 배다.
  it("happy ②(대규모): 200 row 반복 조회 → 단일 query 의 결과 집합 10 배에도 200 + p95 pass", async () => {
    await seedPersons(LARGE_ROWS);
    const result = await collectLatencySamples(listRequest, LARGE_ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(LARGE_ROWS);
    expect(await prisma.person.count()).toBe(LARGE_ROWS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    observe("ci-realdb-person-list-large", LARGE_ROWS, assertion);
    // AC 6 — 두 줄의 관찰. **대소 관계는 assert 하지 않는다**(wall-clock 비결정성).
    expect(observations).toHaveLength(2);
    for (const o of observations) {
      expect(o.line).toContain("p95=");
      expect(o.line).toContain("count=");
    }
    expect(observations[0].line).toContain(`dataScale=${SMALL_ROWS} persons`);
    expect(observations[1].line).toContain(`dataScale=${LARGE_ROWS} persons`);
  });

  // AC 3 — 필터 선택도. 스캔 대상 200 row 는 그대로인데 응답만 120 row 로 줄어 **응답 크기와 스캔
  // 비용이 분리** 되는 표본이다(같은 200 row 를 스캔한 대규모 표본과 대조 가능).
  it("분기: active 120 + inactive 80 → 응답 120 · inactive 0 건 · p95 pass", async () => {
    await seedPersons(MIXED_ACTIVE_ROWS, true);
    await seedPersons(MIXED_INACTIVE_ROWS, false);
    const result = await collectLatencySamples(listRequest, SHORT_ITERATIONS);
    expect(result.failures).toBe(0);
    const body = lastBody as { active: boolean }[];
    expect(body).toHaveLength(MIXED_ACTIVE_ROWS);
    expect(body.filter((p) => p.active === false)).toHaveLength(0);
    // 응답에서 걸러졌을 뿐 테이블에는 200 row 가 그대로 남아 있다(스캔 대상 ≠ 응답 크기).
    expect(await prisma.person.count()).toBe(
      MIXED_ACTIVE_ROWS + MIXED_INACTIVE_ROWS,
    );
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    observe("ci-realdb-person-list-filtered", MIXED_ACTIVE_ROWS, assertion);
    expect(observations).toHaveLength(3);
  });

  describe("negative cases 충분 cover(AC 5)", () => {
    // (a) 경계값 — 빈 테이블(0 row) 요청은 404 가 아니라 200 + 빈 배열이다.
    it("(a) 빈 테이블(0 row) → 404 가 아니라 200 + 빈 배열 + p95 pass", async () => {
      expect(await prisma.person.count()).toBe(0);
      const result = await collectLatencySamples(listRequest, SHORT_ITERATIONS);
      expect(result.failures).toBe(0);
      expect(Array.isArray(lastBody)).toBe(true);
      expect(lastBody as unknown[]).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (b) 전량 inactive — 응답은 비지만 오류가 아니다(빈 응답 ≠ 404). (a) 와 달리 테이블에는 row 가 있다.
    it("(b) 전량 inactive seed → 200 + 빈 배열, 테이블 row 는 잔존", async () => {
      await seedPersons(LARGE_ROWS, false);
      const result = await collectLatencySamples(listRequest, SHORT_ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastBody as unknown[]).toHaveLength(0);
      expect(await prisma.person.count()).toBe(LARGE_ROWS);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (c) 에러 경로가 구조적으로 부재하므로 non-2xx 를 **인위 주입** 해 errorRate 분기에 도달한다.
    it("(c) 인위 non-2xx 주입 → errorRate 1 위반, 200 혼합 표본은 0 < er < 1", async () => {
      await seedPersons(SMALL_ROWS);
      const failing: RequestFn = async () => ({ status: 503 });
      const allFail = await collectLatencySamples(failing, SHORT_ITERATIONS);
      expect(allFail.failures).toBe(SHORT_ITERATIONS);
      const failAssertion = assertS2Threshold(allFail);
      expect(failAssertion.pass).toBe(false);
      expect(failAssertion.errorRate).toBe(1);
      expect(
        failAssertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실 목록 조회(200), 짝수 번째는 인위 500.
        return call % 2 === 1 ? listRequest() : { status: 500 };
      };
      const mixedResult = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(mixedResult.failures).toBe(SHORT_ITERATIONS / 2);
      const mixedAssertion = assertS2Threshold(mixedResult);
      expect(mixedAssertion.errorRate).toBeGreaterThan(0);
      expect(mixedAssertion.errorRate).toBeLessThan(1);
      expect(mixedAssertion.errorRate).toBeCloseTo(0.5);
      expect(mixedAssertion.pass).toBe(false);
    });

    // (d) 대규모 표본의 truncate 전/후 대조 쌍 — 응답 길이가 200 → 0 으로 바뀌고 두 요청 모두 200.
    //     본 route 는 guard 미부착이라 actor row 재-seed 가 불요하다(`db-truncate.ts` 수정 0).
    it("(d) 대규모 seed → truncate 전/후 대조 쌍: 응답 200 건 → 0 건, 둘 다 status 200", async () => {
      await seedPersons(LARGE_ROWS);
      const before = await collectLatencySamples(listRequest, 1);
      expect(before.failures).toBe(0);
      expect(lastBody as unknown[]).toHaveLength(LARGE_ROWS);
      await truncateAll(prisma);
      const after = await collectLatencySamples(listRequest, SHORT_ITERATIONS);
      expect(after.failures).toBe(0);
      expect(lastBody as unknown[]).toHaveLength(0);
      expect(assertS2Threshold(after).pass).toBe(true);
    });

    // AC 4 fail 분기 — 실 측정값이라도 `p95MaxMs: 0` 이면 반드시 fail(측정 시간 무의존 결정론).
    it("(e) 대규모 실측이라도 p95MaxMs: 0 을 주면 pass===false + p95 사유", async () => {
      await seedPersons(LARGE_ROWS);
      const result = await collectLatencySamples(listRequest, SHORT_ITERATIONS);
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });
  });
});

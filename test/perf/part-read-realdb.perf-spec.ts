// part-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 7**.
// (T-1512, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — slice 1~6(`*-realdb`)에 이은 slice 7(구조는 slice 2 승계, 앞 slice 수정 0). 새 축 셋:
//    (a) **비-index FK 역방향** — `GET /api/parts/:id/persons` 의 필터 컬럼 `Person.partId` 는
//    `@unique` 도 `@@index` 도 없는 유일한 실측 필터라 index 미보장 경로의 첫 증거다.
//    (b) **요청당 상수 2 query** — `PartService.findPersonsByPartId` 는 부모 존재 검증(`findById`)
//    후 자식 조회(`findByPartId`)라 slice 2 의 membership 비례 N+1 과도 다르다.
//    (c) **soft-delete 필터** — `activeOnly` 기본값이 `where: { partId, active: true }`(REQ-026).
// ② 실행 경로 — `jest-perf.json` 매칭이라 `pnpm test:perf` 로만 실행된다(기본 `pnpm test` 미picking).
// ③ mock 0 · override 0 — `PartController` 는 guard 미부착이라 인증 노이즈 0 이고, 검증은
//    `toHaveBeenCalledTimes` 대신 **응답 body 가 seed row 값과 일치** 함으로 실 query 발화를
//    입증한다(fail 분기는 404 · `p95MaxMs: 0` 라 측정 시간 무의존). production code · mock 짝 ·
//    임계값 · baseline write 불변이며 REQ-047 실 scale 부하가 아니다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

import {
  assertS2Threshold,
  collectLatencySamples,
  type RequestFn,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청이라 mock spec 보다 느리다.
jest.setTimeout(120_000);

// 대상 Part 의 활성/비활성 소속 인원 수 + 대조군 Part 소속 인원 수.
const ACTIVE_PERSONS = 5;
const INACTIVE_PERSONS = 2;
const OTHER_PERSONS = 3;
// 반복 측정 횟수(SHORT 는 분기 도달용 짧은 반복).
const ITERATIONS = 8;
const SHORT_ITERATIONS = 4;

interface Seeded {
  targetId: string;
  otherId: string;
  activeNames: string[];
  inactiveNames: string[];
  otherNames: string[];
}

describe("S2 조회 latency perf-spec — 실 DB 비-index FK 역방향 Part 소속 조회 (GET /api/parts · :id/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩 + applyGlobalMiddleware(T-0090 helper).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    // 앞선 스위트 잔여 row 가 첫 test 의 seed 수 검증을 오염시키지 않도록 시작 시점에도 비운다.
    await truncateAll(prisma);
  });

  // ADR-0004 §Cleanup — Part · Person 전부 row leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Part 2 개(대상 · 대조군) + 소속 Person seed. 대상 Part 에는 `active: false` 를 섞어
  // soft-delete 필터가 실제로 걸러내는지 관측 가능하게 한다. `Person.email` 은 `@unique` 라
  // 접미로 충돌을 피하고, `Part.name` 도 `@unique` 라 고정 이름 2 개만 쓴다.
  const seedParts = async (): Promise<Seeded> => {
    const target = await prisma.part.create({
      data: { name: "실DB파트-대상" },
    });
    const other = await prisma.part.create({ data: { name: "실DB파트-대조" } });
    const rows = (
      prefix: string,
      count: number,
      partId: string,
      active: boolean,
    ) =>
      Array.from({ length: count }, (_, i) => ({
        fullName: `${prefix}-${i}`,
        email: `realdb-part-perf-${prefix}-${i}@example.test`,
        partId,
        active,
      }));
    const activeRows = rows("실DB대상활성", ACTIVE_PERSONS, target.id, true);
    const inactiveRows = rows(
      "실DB대상비활성",
      INACTIVE_PERSONS,
      target.id,
      false,
    );
    const otherRows = rows("실DB대조소속", OTHER_PERSONS, other.id, true);
    await prisma.person.createMany({
      data: [...activeRows, ...inactiveRows, ...otherRows],
    });
    return {
      targetId: target.id,
      otherId: other.id,
      activeNames: activeRows.map((r) => r.fullName),
      inactiveNames: inactiveRows.map((r) => r.fullName),
      otherNames: otherRows.map((r) => r.fullName),
    };
  };

  // 조회 1회 — 목록·소속 인원 공용. supertest 는 non-2xx 도 resolve 하므로 status 만 넘긴다.
  const getRequest =
    (path: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/parts${path}`);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  const measure = (path: string, n = SHORT_ITERATIONS) =>
    collectLatencySamples(getRequest(path), n);

  const namesOf = (): string[] =>
    (lastBody as { fullName: string }[]).map((p) => p.fullName).sort();

  // AC happy ① — Part 목록. seed 한 두 Part 이름이 그대로 돌아옴으로 실 query 발화를 입증한다.
  it("happy ①(목록): GET /api/parts → 200 + seed Part 이름 일치 + p95 < 3000ms pass", async () => {
    await seedParts();
    const result = await measure("", ITERATIONS);
    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    const body = lastBody as { name: string }[];
    expect(body.map((p) => p.name).sort()).toEqual([
      "실DB파트-대상",
      "실DB파트-대조",
    ]);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC happy ② — 비-index FK 역방향(`Person.partId` equality) + 상수 2 query 경로의 첫 실측.
  it("happy ②(비-index FK 역방향): :id/persons 반복 조회 → 200 + 활성 소속 fullName 집합 일치 + p95 pass", async () => {
    const seeded = await seedParts();
    const result = await measure(`/${seeded.targetId}/persons`, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(namesOf()).toEqual([...seeded.activeNames].sort());
    // 부모 존재 검증 + 자식 조회의 상수 2 query — 소속 row 는 비활성 포함 그대로 남아 있다.
    expect(
      await prisma.person.count({ where: { partId: seeded.targetId } }),
    ).toBe(ACTIVE_PERSONS + INACTIVE_PERSONS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 분기 ① — `activeOnly` 기본 true → `where: { partId, active: true }`(REQ-026 soft-delete).
  it("분기 ①(activeOnly 기본): 응답에 active:false Person 이 포함되지 않는다", async () => {
    const seeded = await seedParts();
    const result = await measure(`/${seeded.targetId}/persons`);
    expect(result.failures).toBe(0);
    const body = lastBody as { fullName: string; active: boolean }[];
    expect(body).toHaveLength(ACTIVE_PERSONS);
    expect(body.every((p) => p.active === true)).toBe(true);
    for (const hidden of seeded.inactiveNames) {
      expect(namesOf()).not.toContain(hidden);
    }
  });

  // AC 분기 ② — 소속 Person 0 인 Part 는 **404 가 아니라** 200 + 빈 배열(controller 주석 분기).
  it("분기 ②(소속 0): 소속 Person 없는 Part 의 :id/persons → 404 가 아니라 200 + 빈 배열", async () => {
    await seedParts();
    const empty = await prisma.part.create({
      data: { name: "실DB파트-무소속" },
    });
    const result = await measure(`/${empty.id}/persons`);
    expect(result.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 분기 ③ — partId equality 필터 정확성. 대조군 소속이 대상 응답에 섞이지 않는다.
  it("분기 ③(partId equality): 대조군 Part 소속 Person 이 대상 Part 응답에 섞이지 않는다", async () => {
    const seeded = await seedParts();
    await measure(`/${seeded.targetId}/persons`);
    const targetNames = namesOf();
    for (const outsider of seeded.otherNames) {
      expect(targetNames).not.toContain(outsider);
    }
    // 대조군 쪽도 자기 소속만 — 필터가 양방향으로 정확함.
    await measure(`/${seeded.otherId}/persons`);
    expect(namesOf()).toEqual([...seeded.otherNames].sort());
  });

  // AC error path — 미존재 Part id 는 부모 존재 검증 단계의 404. 측정 시간에 무의존한 결정론적 분기.
  it("error path: 미존재 id 의 :id/persons → 전부 404 failures, 표본 0", async () => {
    await seedParts();
    const result = await measure("/realdb-part-missing/persons");
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);
    expect(result.samplesMs).toHaveLength(0);
  });

  describe("negative cases 충분 cover", () => {
    // (a) 404 만 반복 → errorRate 임계 위반으로 pass=false + 사유 축적. 200 과 섞으면 중간값.
    it("(a) 미존재 id 반복 → errorRate 임계 위반 pass === false, 200 혼합 시 0 < er < 1", async () => {
      const seeded = await seedParts();
      const failed = await measure("/realdb-part-missing-neg/persons");
      const assertion = assertS2Threshold(failed);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(assertion.reasons.join()).toContain("error rate 임계 초과");
      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실 소속 조회(200), 짝수 번째는 미존재 id(404).
        return call % 2 === 1
          ? getRequest(`/${seeded.targetId}/persons`)()
          : getRequest("/realdb-part-missing-mixed/persons")();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const mixedAssertion = assertS2Threshold(result);
      expect(mixedAssertion.errorRate).toBeCloseTo(0.5);
      expect(mixedAssertion.pass).toBe(false);
    });

    // (b) 비현실적 임계 주입 — 실 측정값이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    it("(b) p95MaxMs: 0 주입 → 실 측정값이라도 pass === false + p95 사유", async () => {
      const seeded = await seedParts();
      const result = await measure(`/${seeded.targetId}/persons`);
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.join()).toContain("p95 임계 초과");
    });

    // (c) 빈 DB(모든 row truncate 후) — Part 0 은 목록 조회의 정상 결과(404 아님).
    it("(c) 빈 DB → GET /api/parts 가 200 + 빈 배열, p95 pass", async () => {
      expect(await prisma.part.count()).toBe(0);
      const result = await measure("", SHORT_ITERATIONS);
      expect(result.failures).toBe(0);
      expect(lastStatus).toBe(200);
      expect(lastBody as unknown[]).toHaveLength(0);
      expect(assertS2Threshold(result).pass).toBe(true);
    });

    // (d) cuid 형태이지만 미존재인 id — 형식이 그럴듯해도 500 이 아니라 404 로 수렴한다.
    it("(d) 미존재 cuid 형태 id → 500 이 아니라 404 로 수렴(목록·소속 양쪽 무영향)", async () => {
      await seedParts();
      const result = await measure("/cjld2cjxh0000qzrmn831i7rn/persons");
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(lastStatus).toBe(404);
      expect(assertS2Threshold(result).pass).toBe(false);
      // 목록 조회는 같은 스위트에서 여전히 정상 — 404 가 부모 검증 단계 국소 분기임을 확인.
      await measure("", 1);
      expect(lastStatus).toBe(200);
    });
  });
});

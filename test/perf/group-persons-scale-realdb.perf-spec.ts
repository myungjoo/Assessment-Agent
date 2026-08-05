// group-persons-scale-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 3**.
// (T-1504, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — slice 1(`person-read-realdb.perf-spec.ts`, T-1500) · slice 2(`group-read-realdb.perf-spec.ts`,
//    T-1502) 에 이은 실 DB round-trip **slice 3**. 부트스트랩·seed·정리 **구조는 slice 2 를 승계**하되
//    (문구 복제 대신 cross-ref) slice 2 와 **같은 route**(`GET /api/groups/:id/persons`)를 **다른 규모**
//    로 측정한다. slice 1·2 파일은 수정하지 않는다.
// ② slice 2 와의 책임 경계 — slice 2 = `GroupController` 조회 **route 폭**(목록·상세·소속 인원)을 고정된
//    소규모 seed 로 훑는 축, 본 spec = 단일 route 의 **규모 축**(소규모 vs 대규모 membership).
// ③ 측정 의도 — `GroupService.findPersonsByGroupId` 는 `PersonGroupMembership` 에서 personId[] 를 뽑은 뒤
//    `PersonRepository.findById` 를 loop 호출하므로(service 헤더 주석의 "N+1 query 의 P0 acceptable 패턴")
//    **membership 수 = 요청당 query 수** 다. 규모가 커질수록 query 가 선형으로 늘어나는 이 경로의 **규모
//    민감도**(REQ-048 임계 유지 여부)를 실 Postgres 위에서 처음 증거화한다. **측정만 한다** — N+1 최적화
//    (`findManyByIds` 신설 등)는 production code 변경이라 범위 밖.
// ④ 결정론 전략 — 두 표본 모두 고정 행 수 seed, `afterEach(truncateAll)`(ADR-0004 §Cleanup)가 매 test 후
//    도메인 테이블을 비운다(`Person.email` 은 `@unique` 라 index 접미로 충돌 회피). latency 는 wall-clock
//    이라 비결정적이므로 두 표본의 **대소 관계(large.p95 > small.p95)는 assert 하지 않고** 관찰 기록에만
//    남긴다(flaky 회피). 임계 pass 는 단일 클라이언트·수십 row 라 3000ms 훨씬 아래로 결정론적 도달, fail
//    분기는 **미존재/삭제된 row 의 404** 또는 비현실적 임계 주입(`p95MaxMs: 0`)이라 실 측정 시간에 무의존.
//    본 파일은 `jest-perf.json`(`testRegex: .*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고
//    기본 `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres 전제는 CI 가 충족).
// ⑤ Out of Scope — production code 변경 0 / 기존 perf-spec 수정 / write route · `:id/members` / 임계값 변경
//    · baseline 파일 확정(`writeBaselineFile`·`confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write
//    0) / 동시성 S3(`concurrency: 1` 고정). 특히 본 spec 의 "대규모" 는 단일 route 의 **상대 비교용 표본**
//    일 뿐 **REQ-047 의 실 scale 부하 검증이 아니다**(100~200명 / 50~100 repo / 배치 부하 축은 미착수).
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

// 실 DB 부트스트랩 + 대규모 seed + N+1 반복 요청이라 slice 2 보다 더 여유를 둔다.
jest.setTimeout(120_000);

// 소규모 표본의 membership 수(AC 2) — 요청당 findById 발화 수와 같다.
const SMALL_MEMBERS = 5;
// 대규모 표본의 membership 수(AC 3) — 소규모의 10 배 이상(5 → 60).
const LARGE_MEMBERS = 60;
// 표본별 반복 측정 횟수 — 대규모는 요청당 query 가 12 배라 반복을 줄인다.
const SMALL_ITERATIONS = 10;
const LARGE_ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;

describe("S2 조회 latency perf-spec — 실 DB N+1 규모 민감도 (GET /api/groups/:id/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  // AC 4 — 두 표본의 baseline 한 줄 관찰을 선언 순서대로 축적(대소 assert 금지, 파일 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(GroupService·PersonService·PrismaService
    // 어느 것도 useValue 로 대체하지 않는다) + applyGlobalMiddleware(T-0090 helper).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    // 앞선 스위트가 남긴 row 가 첫 test 의 seed 수 검증을 오염시키지 않도록 시작 시점에도 비운다.
    await truncateAll(prisma);
  });

  // ADR-0004 §Cleanup — Group · Person · PersonGroupMembership 전부 row leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Group 1 + Person N + membership N seed. 대규모도 개별 create loop 이 아니라 `createMany` 로
  // 일괄 조립해 seed 비용이 행 수만큼의 왕복으로 불어나지 않게 한다(AC 7).
  const seedGroupWithMembers = async (
    memberCount: number,
  ): Promise<{ groupId: string; names: string[] }> => {
    const group = await prisma.group.create({
      data: { name: "실DB그룹-규모" },
    });
    const names = Array.from(
      { length: memberCount },
      (_, i) => `실DB규모인원-${i}`,
    );
    if (memberCount > 0) {
      await prisma.person.createMany({
        data: names.map((fullName, i) => ({
          fullName,
          email: `realdb-scale-perf-${i}@example.test`,
        })),
      });
      const persons = await prisma.person.findMany({ select: { id: true } });
      await prisma.personGroupMembership.createMany({
        data: persons.map((p) => ({ personId: p.id, groupId: group.id })),
      });
    }
    return { groupId: group.id, names };
  };

  // 소속 인원 조회 1회 — membership 수만큼 findById 가 발화하는 N+1 경로.
  const personsRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/groups/${id}/persons`,
      );
      lastBody = res.body;
      return { status: res.status };
    };

  // baseline 한 줄 관찰 조립(AC 4) — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    members: number,
    assertion: S2Assertion,
  ): BaselineReport => {
    const env = { label, concurrency: 1, dataScale: `${members} memberships` };
    const report = buildBaselineReport(env, assertion);
    observations.push({ line: formatBaselineLine(report), report });
    return report;
  };

  // AC 5 분기 ① — membership 0 인 Group 의 `:id/persons` 는 **404 가 아니라** 200 + 빈 배열
  // (group.controller.ts `104 행` ~ `106 행` 주석의 분기).
  it("분기 ①: membership 0 인 Group → 404 가 아니라 200 + 빈 배열 + p95 pass, count === 요청 수", async () => {
    const { groupId } = await seedGroupWithMembers(0);
    const result = await collectLatencySamples(
      personsRequest(groupId),
      SHORT_ITERATIONS,
    );
    expect(result.failures).toBe(0);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  // AC 2 + AC 5 분기 ② — 소규모 표본. 응답 body 가 seed 값과 일치함으로 실 query 발화를 입증.
  it("happy ①(소규모): membership 5건 반복 조회 → 200 + 응답이 seed 와 일치 + p95 < 3000ms pass", async () => {
    const { groupId, names } = await seedGroupWithMembers(SMALL_MEMBERS);
    const result = await collectLatencySamples(
      personsRequest(groupId),
      SMALL_ITERATIONS,
    );
    expect(result.total).toBe(SMALL_ITERATIONS);
    expect(result.failures).toBe(0);
    // mock 이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const body = lastBody as { fullName: string }[];
    expect(body).toHaveLength(SMALL_MEMBERS);
    expect(body.map((p) => p.fullName).sort()).toEqual([...names].sort());
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(SMALL_ITERATIONS);
    expect(
      observe("ci-realdb-group-persons-small", SMALL_MEMBERS, assertion).count,
    ).toBe(SMALL_ITERATIONS);
  });

  // AC 3 + AC 5 분기 ③ — 대규모 표본(본 slice 핵심). 요청 1 건이 **membership 수(60)에 비례한
  // findById** 를 발화해도 REQ-048 임계가 성립하는지 실측한다(**측정만** — service 최적화 금지).
  // AC 4 의 규모 비교 관찰도 cap(AC 10) 준수를 위해 본 test 로 흡수한다.
  it("happy ②(대규모): membership 60건 → 요청당 membership 수에 비례한 query 발화에도 200 + p95 pass", async () => {
    const { groupId } = await seedGroupWithMembers(LARGE_MEMBERS);
    const result = await collectLatencySamples(
      personsRequest(groupId),
      LARGE_ITERATIONS,
    );
    expect(result.total).toBe(LARGE_ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(LARGE_MEMBERS);
    // 실 membership row 수 = 요청 1 건이 발화한 loop findById 횟수의 근거.
    expect(await prisma.personGroupMembership.count()).toBe(LARGE_MEMBERS);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(LARGE_ITERATIONS);
    observe("ci-realdb-group-persons-large", LARGE_MEMBERS, assertion);

    // AC 4 — 소규모(선행 test)·대규모 두 줄의 관찰. **대소 관계는 assert 하지 않는다**.
    const [small, large] = observations;
    expect(observations).toHaveLength(2);
    for (const o of observations) {
      expect(o.line).toContain("p95=");
      expect(o.line).toContain("count=");
      expect(Number.isFinite(o.report.p95)).toBe(true);
      expect(o.report.p95).toBeGreaterThanOrEqual(0);
    }
    expect(small.line).toContain(`dataScale=${SMALL_MEMBERS} memberships`);
    expect(large.line).toContain(`dataScale=${LARGE_MEMBERS} memberships`);
    expect(small.report.env.dataScale).not.toBe(large.report.env.dataScale);
  });

  describe("negative cases 충분 cover(AC 6)", () => {
    // (a) 처음부터 없던 Group id — `findPersonsByGroupId` 의 사전 존재 검증이 404 를 던진다
    //     (분기 ① 의 "200 + 빈 배열" 과 갈리는 지점).
    it("(a) 미존재 Group id 의 :id/persons → 전부 404 failures, pass===false + errorRate 사유", async () => {
      // 직전 test 들의 seed 가 afterEach(truncateAll)로 전부 비워졌음(row leak 0, AC 7).
      expect(await prisma.group.count()).toBe(0);
      expect(await prisma.person.count()).toBe(0);
      expect(await prisma.personGroupMembership.count()).toBe(0);
      const result = await collectLatencySamples(
        personsRequest("realdb-scale-missing"),
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(result.samplesMs).toHaveLength(0);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(
        assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
      ).toBe(true);
    });

    // (b) 존재했다가 **삭제된** Group — (a) 의 "처음부터 없던 id" 와 달리 살아있던 row 가 사라지는
    //     시퀀스. Group 삭제가 membership 을 `onDelete: Cascade` 로 동반 삭제하므로
    //     `findPersonsByGroupId` 의 **Person null 필터링 분기는 도달 불가** 다(membership 만 남고
    //     Person 이 사라진 race window 전용 분기라 본 spec 범위 밖).
    it("(b) 대규모 seed 후 Group 삭제 → membership cascade 동반 + 재조회는 404 로 전락", async () => {
      const { groupId } = await seedGroupWithMembers(LARGE_MEMBERS);
      const before = await collectLatencySamples(personsRequest(groupId), 1);
      expect(before.failures).toBe(0);
      await prisma.group.delete({ where: { id: groupId } });
      expect(await prisma.personGroupMembership.count()).toBe(0);
      const after = await collectLatencySamples(
        personsRequest(groupId),
        SHORT_ITERATIONS,
      );
      expect(after.failures).toBe(SHORT_ITERATIONS);
      expect(assertS2Threshold(after).pass).toBe(false);
    });

    // (c) 표본 혼합 — 실존 Group(200)·미존재 id(404)를 번갈아 호출해 errorRate 가 양극단 아닌 중간값인지.
    it("(c) 200 + 404 혼합 표본 → errorRate 가 0 < er < 1 로 산출, pass===false", async () => {
      const { groupId } = await seedGroupWithMembers(SMALL_MEMBERS);
      let call = 0;
      const mixedRequest: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실존 Group(200), 짝수 번째는 미존재 id(404).
        return call % 2 === 1
          ? personsRequest(groupId)()
          : personsRequest("realdb-scale-mixed")();
      };
      const result = await collectLatencySamples(
        mixedRequest,
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (d) 비현실적 임계 — 대규모 실측값이라도 `p95MaxMs: 0` 이면 fail(실 측정 시간 무의존 결정론 분기).
    it("(d) 대규모 실측이라도 p95MaxMs: 0 을 주면 pass===false + p95 사유", async () => {
      const { groupId } = await seedGroupWithMembers(LARGE_MEMBERS);
      const result = await collectLatencySamples(
        personsRequest(groupId),
        SHORT_ITERATIONS,
      );
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });
  });
});

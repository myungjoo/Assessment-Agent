// group-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 2**.
// (T-1502, load-resilience-test-plan §5 item 5 / REQ-048, 조회 p95 < 3s)
//
// ① 위치 — T-1500 이 `person-read-realdb.perf-spec.ts` 로 실 DB round-trip 첫 사례를 박제했고
//    (endpoint 1 개), 그 §Follow-ups 2 번이 "나머지 mock perf-spec 실 DB cutover 확대 — endpoint
//    단위로 쪼개 cap 준수" 를 이월했다. 본 spec 이 그 slice 2 로 `GroupController` 조회 3 route
//    (`GET /api/groups` · `:id` · `:id/persons`)를 측정하며, 부트스트랩·seed·정리 **구조는
//    T-1500 spec 을 그대로 승계**한다(문구 복제 대신 cross-ref).
// ② mock 짝(`group-read.perf-spec.ts`)과의 경계 — mock 짝 = `GroupService` 를 `useValue` 로
//    대체한 **배선 latency**(DB 왕복 0) 검증, 본 spec = mock override 0 의 **round-trip 포함**
//    latency 실측(mock 짝은 **수정하지 않는다**). 검증도 호출 횟수 대신 **응답 body 가 seed 한
//    row 값과 일치**함으로 실 query 발화를 입증한다. `GroupController` 는 guard 미부착이라
//    인증·인가 노이즈 0(mock 짝의 `overrideGuard` 불요 서술이 실 DB 에서도 유효).
// ③ T-1500 과의 차이 = **N+1 indirect navigation 경로 측정** — T-1500 은 flat 단일 SELECT 라 row
//     가 늘어도 query 1 개지만, `GET /api/groups/:id/persons` 는 `findPersonsByGroupId` 가
//    `PersonGroupMembership` 에서 personId[] 를 뽑은 뒤 `PersonRepository.findById` 를 loop
//    호출한다(service 주석의 "N+1 query 의 P0 acceptable 패턴"). 즉 **membership 수에 비례해
//    query 가 늘어나는 경로** 의 REQ-048 충족을 실 Postgres 위에서 처음 증거화한다. **측정만
//    한다** — N+1 최적화는 production code 변경이라 범위 밖.
// ④ 결정론 전략 — seed 는 고정 행 수, `afterEach(truncateAll)`(ADR-0004 §Cleanup)가 매 test 후
//    도메인 테이블을 비워 각 test 는 자기 seed 만 본다(`Person.email` 은 `@unique` 라 index 접미로
//    충돌 회피). latency 값은 wall-clock 이라 비결정적이나 단일 클라이언트 · 소량 row 라 p95 는
//    임계(3000ms) 훨씬 아래 → pass 분기 결정론적 도달. fail 분기는 **실 DB 미존재 row 의 404**
//    또는 비현실적 임계 주입(`p95MaxMs: 0`)이라 실 측정 시간에 무의존. 본 파일은 `jest-perf.json`
//    (`testRegex: .*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고 기본 `pnpm test`
//    (`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres + migrate 전제는 CI 가 충족).
// ⑤ Out of Scope — production code 변경 0(특히 N+1 최적화 금지) / 기존 mock perf-spec 수정 /
//    write route · `:id/members` 측정 / 나머지 endpoint 의 실 DB cutover / 임계값 변경 · baseline
//    파일 확정(`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` · `confirmOrCompareBaseline`
//    미사용 — 관찰 전용, 디스크 write 0).
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
// N+1 경로는 membership 수만큼 query 를 더 쏘므로 여유를 더 둔다.
jest.setTimeout(60_000);

// 다건 Group seed 행 수(AC 2 / 분기 ②).
const SEED_GROUPS = 15;
// N+1 경로 seed 의 membership 수 = 1 요청당 findById 발화 수(AC 3) — 경량 스모크(§4.1).
const SEED_MEMBERS = 10;
// 반복 측정 횟수 — 표본 20 개면 p95 가 상위 표본 구간에서 산출된다.
const ITERATIONS = 20;

describe("S2 조회 latency perf-spec — 실 DB round-trip (GET /api/groups · :id/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;

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

  // Group 다건 seed(1 round-trip). Group.name 은 `@unique` 미정의라 충돌 걱정 없음.
  const seedGroups = async (count: number): Promise<string[]> => {
    const names = Array.from({ length: count }, (_, i) => `실DB그룹-${i}`);
    await prisma.group.createMany({ data: names.map((name) => ({ name })) });
    return names;
  };

  // Group 1 + Person N + membership N seed — N+1 indirect navigation 경로의 입력.
  // Person.email 은 `@unique` 라 index 접미로 test 간·행 간 충돌을 피한다.
  const seedGroupWithMembers = async (memberCount: number): Promise<string> => {
    const group = await prisma.group.create({
      data: { name: "실DB그룹-멤버" },
    });
    if (memberCount > 0) {
      await prisma.person.createMany({
        data: Array.from({ length: memberCount }, (_, i) => ({
          fullName: `실DB소속인원-${i}`,
          email: `realdb-group-perf-${i}@example.test`,
        })),
      });
      const persons = await prisma.person.findMany();
      await prisma.personGroupMembership.createMany({
        data: persons.map((p) => ({ personId: p.id, groupId: group.id })),
      });
    }
    return group.id;
  };

  // 목록 조회 1회 — collector 가 소비할 { status } 반환(supertest 는 non-2xx 도 resolve).
  const listRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/groups");
    lastBody = res.body;
    return { status: res.status };
  };

  // 단건 상세 — 실 DB 에 row 가 없으면 service.findById 가 NotFoundException → 404.
  const detailRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/groups/${id}`);
      return { status: res.status };
    };

  // 소속 인원 조회 — membership 수만큼 findById 가 발화하는 N+1 경로.
  const personsRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/groups/${id}/persons`,
      );
      lastBody = res.body;
      return { status: res.status };
    };

  // AC 2 / 분기 ② — happy path. 다건 seed → 실 round-trip 반복 측정 → REQ-048 p95 판정.
  it("happy: Group 다건 seed 후 N회 목록 조회 → 전부 200 + 응답이 seed 와 일치 + p95 < 3000ms pass", async () => {
    const names = await seedGroups(SEED_GROUPS);

    const result = await collectLatencySamples(listRequest, ITERATIONS);

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    // mock 이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const body = lastBody as { name: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(SEED_GROUPS);
    expect(body.map((g) => g.name).sort()).toEqual([...names].sort());

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // AC 3 + AC 7 — N+1 indirect navigation happy path. 1 요청이 membership 수에 비례한
  // findById 를 발화해도 임계가 성립하는지 실측한다(측정만 — service 최적화 금지).
  // baseline 관찰(AC 7)은 cap(AC 11) 준수를 위해 본 test 에 흡수 — 관찰 전용이라
  // writeBaselineFile / confirmOrCompareBaseline 미사용(디스크 write 0).
  it("happy(N+1): membership 10건 seed 후 :id/persons 반복 조회 → query 가 membership 수에 비례해도 200 + p95 pass + baseline 한 줄 관찰", async () => {
    const groupId = await seedGroupWithMembers(SEED_MEMBERS);

    const result = await collectLatencySamples(
      personsRequest(groupId),
      ITERATIONS,
    );

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(SEED_MEMBERS);
    // 실 membership row 가 남아 있음 = loop findById 가 그만큼 발화했음의 근거.
    expect(await prisma.personGroupMembership.count()).toBe(SEED_MEMBERS);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);

    const report = buildBaselineReport(
      {
        label: "ci-realdb-group-persons",
        concurrency: 1,
        dataScale: `${SEED_MEMBERS} memberships`,
      },
      assertion,
    );
    const line = formatBaselineLine(report);
    expect(line).toContain("p95=");
    expect(line).toContain("count=");
    expect(line).toContain("[ci-realdb-group-persons]");
    expect(line).toContain(`dataScale=${SEED_MEMBERS} memberships`);
    expect(report.count).toBe(ITERATIONS);
    expect(report.pass).toBe(true);
  });

  // AC 4 / negative (a) — error path. seed 0 상태의 실 DB 에서 findById 가 null →
  // service 가 NotFoundException(404) → collector 가 non-2xx failure 로 분류.
  it("error: 미존재 Group id 로 N회 상세 조회 → 전부 404 failures, pass===false + errorRate 사유", async () => {
    const result = await collectLatencySamples(
      detailRequest("realdb-missing-group"),
      4,
    );
    expect(result.failures).toBe(4);
    expect(result.samplesMs).toHaveLength(0);
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);
  });

  // 분기 ① — seed 0행(truncate 직후). Group 0 은 목록 조회의 정상 결과(404 아님).
  it("분기 ①: seed 0행 → 200 + 빈 배열 + p95 pass, summarizeLatency.count === 요청 수", async () => {
    const result = await collectLatencySamples(listRequest, ITERATIONS);
    expect(result.failures).toBe(0);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // 분기 ③ — membership 0 인 Group 의 `:id/persons` 는 **404 가 아니라** 200 + 빈 배열
  // (group.controller.ts 의 "Group 은 있으나 membership 0 이면 404 변환 안 함" 주석 분기).
  it("분기 ③: membership 0 인 Group 의 :id/persons → 404 가 아니라 200 + 빈 배열, count === 요청 수", async () => {
    const groupId = await seedGroupWithMembers(0);
    const result = await collectLatencySamples(personsRequest(groupId), 4);
    expect(result.failures).toBe(0);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(4);
  });

  describe("negative cases 충분 cover(AC 6)", () => {
    // (b) 미존재 Group id 의 `:id/persons` — 분기 ③(200 + 빈 배열)과 갈리는 지점.
    //     findPersonsByGroupId 의 **사전 Group 존재 검증** 이 먼저 404 를 던진다.
    it("(b) 미존재 Group id 의 :id/persons → 사전 존재 검증이 404(빈 배열 아님)", async () => {
      const result = await collectLatencySamples(
        personsRequest("realdb-missing-group-persons"),
        4,
      );
      expect(result.failures).toBe(4);
      expect(result.samplesMs).toHaveLength(0);
      const assertion = assertS2Threshold(result);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
    });

    // (c) 표본 혼합 — 200(목록)과 404(미존재 상세)를 번갈아 호출해 errorRate 가
    //     0 < er < 1 의 중간값으로 산출되는지 확인(양극단이 아님).
    it("(c) 200 + 404 혼합 표본 → errorRate 가 0 < er < 1 로 산출, pass===false", async () => {
      await seedGroups(3);
      let call = 0;
      const mixedRequest: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 목록(200), 짝수 번째는 미존재 상세(404).
        return call % 2 === 1
          ? listRequest()
          : detailRequest("realdb-missing-mixed")();
      };

      const result = await collectLatencySamples(mixedRequest, 4);
      expect(result.failures).toBe(2);
      const assertion = assertS2Threshold(result);
      expect(assertion.errorRate).toBeGreaterThan(0);
      expect(assertion.errorRate).toBeLessThan(1);
      expect(assertion.errorRate).toBeCloseTo(0.5);
      expect(assertion.pass).toBe(false);
    });

    // (d) 비현실적 임계 — 실 측정값이라도 p95MaxMs: 0 이면 반드시 fail(임계 주입이
    //     실제 판정에 반영되는지 확인. 실 latency 값에 의존하지 않는 결정론적 fail).
    it("(d) p95MaxMs: 0 을 주면 실 측정값이라도 pass===false + p95 사유", async () => {
      await seedGroups(3);
      const result = await collectLatencySamples(listRequest, 4);
      expect(assertS2Threshold(result).pass).toBe(true);
      const strict = assertS2Threshold(result, { p95MaxMs: 0 });
      expect(strict.pass).toBe(false);
      expect(strict.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(
        true,
      );
    });
  });
});

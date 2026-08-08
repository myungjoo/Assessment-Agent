// group-members-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 18**.
// (T-1534, load-resilience-test-plan §5 item 5 / REQ-048 조회 p95 < 3s, REQ-028 N:M 다중 소속)
//
// ① 위치 — slice 1~17 에 이은 실 DB round-trip **slice 18**. 부트스트랩·seed·정리 **구조는 slice 2
//    (`group-read-realdb.perf-spec.ts`, T-1502) 를 그대로 승계** 한다(문구 복제 대신 cross-ref).
//    slice 2 헤더 `⑤ Out of Scope` 는 `:id/members` 측정을 **명시적으로 제외** 했고 slice 17(T-1532)
//    도 본 route 를 다음 slice 후보로 이월했다 — 본 spec 이 그 이월을 닫는다. slice 1~17 파일은
//    수정하지 않는다. 계수: `GroupController` 는 slice 2·3 에서 **이미 실측 도메인** 이라 실측
//    endpoint 도메인 **14 는 불변** 이고 **조회 route 만 26 → 27** 로 늘어난다(slice 15·17 과 같은
//    셈법 — 도메인·route 가 함께 늘었던 slice 16 셈법이 아니다).
// ② mock 짝 부재 — 앞 slice 들은 예외 없이 mock perf-spec 짝(`X-read.perf-spec.ts`)과의 경계를
//    서술했지만, 본 route 에는 **mock 짝이 존재하지 않는다**(`test/perf/` 의 group 계열은
//    `group-read` · `group-detail-read` · `group-persons-read` 3 개뿐 — `group-members-read.perf-spec.ts`
//    없음). 따라서 본 spec 은 **mock 짝이 없는 첫 실 DB slice** 이며 mock spec 수 변화도 0 이다.
// ③ 새 구조 축 3 개 —
//    (1) **N:M 중간 테이블 row 자체가 응답 payload 인 첫 실 DB 경로**. `GroupService.findMembershipsByGroupId`
//        는 `membershipRepository.findByGroupId` 결과를 **가공 0 으로 그대로** 반환하므로 응답 원소가
//        `PersonGroupMembership`(`id`/`personId`/`groupId`/`createdAt` 4 컬럼) 이다. 앞 17 slice 의 응답은
//        도메인 entity row · sanitize view · 파생 view · in-process 상태 · stream artifact 였을 뿐
//        **관계(join table) row 를 1 급 payload 로 내리는 경로는 없었다**. 부수적으로 `updatedAt` 조차
//        없는 **가장 좁은 row shape** 다.
//    (2) **같은 부모 row 를 조인 경로와 비조인 경로로 나란히 재는 첫 페어**. `:id/persons` 는
//        `findPersonsByGroupId` 가 membership 추출 후 `PersonRepository.findById` 를 loop 호출해
//        query 가 membership 수에 비례(1 + 1 + N)하지만, `:id/members` 는 부모 검증 + `findMany` 의
//        **상수 2 query** 다. 같은 group id · 같은 seed 상태에서 두 route 를 한 spec 안에서 측정해
//        구조 차이를 관측 기록으로 남긴다. **"요청당 상수 2 query" 자체는 slice 7 과 같아 새 축으로
//        주장하지 않는다** — 새 축은 **동일 부모·동일 데이터의 두 접근 경로를 페어로 측정** 한다는 점.
//    (3) **복합 unique tuple 의 후행(non-prefix) 컬럼 단독 필터**. 필터 컬럼은 `groupId` 인데
//        `PersonGroupMembership` 의 유일한 선언 index 는 `@@unique([personId, groupId])` 이고 `groupId`
//        는 그 **두 번째 컬럼** 이라 prefix 를 탈 수 없다. slice 5 는 composite unique 의 **prefix**,
//        slice 6 은 unique·index 중복 tuple, slice 7 은 **선언 자체가 0** 인 컬럼이었다 — 선언된 unique
//        index 가 있는데도 필터가 그 prefix 를 못 타는 경로는 본 slice 가 처음이다.
// ④ 인증·인가 negative 부재(구조적) — `GroupController` 는 **guard 미부착** 이라(slice 2 헤더 ② 박제)
//    401 / 403 분기가 **구조적으로 존재하지 않는다**. slice 4~17 의 cookie 미부착 401 · 서명 변조 401 ·
//    tier 403 negative 를 본 spec 에 복사하면 **없는 분기를 가리키는 거짓 test** 가 된다. 대신 404 ·
//    빈 배열 · 격리 · 다중 소속 · cascade · path 변형 · 임계 주입 축으로 negative 를 채운다.
// ⑤ 결정론 전략 — seed 는 고정 행 수, `afterEach(truncateAll)`(ADR-0004 §Cleanup)가 매 test 후 도메인
//    테이블을 비워 각 test 는 자기 seed 만 본다(`PersonGroupMembership` 은 `Person`/`Group` CASCADE 로
//    정리 — `db-truncate.ts` 수정 0. `Person.email` 은 `@unique` 라 seed 호출별 index 접미로 충돌 회피).
//    latency 는 wall-clock 이라 비결정적이므로 **두 route 의 대소 관계도, 두 규모 표본의 대소·증가율도
//    assert 하지 않고 관찰 기록에만** 남긴다(slice 3 선례 — flaky 회피). pass 분기는 단일 클라이언트 ·
//    수십 row 라 3000ms 훨씬 아래로 결정론적 도달하고, fail 분기는 **미존재 row 의 404** 또는 비현실적
//    임계 주입(`p95MaxMs: 0`)이라 실 측정 시간에 무의존이다. 본 파일은 `jest-perf.json`
//    (`testRegex: .*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고 기본 `pnpm test`
//    (`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres + migrate 전제는 CI 가 충족).
// ⑥ Out of Scope — production code 변경 0(특히 `findPersonsByGroupId` 의 N+1 최적화 · `:id/members` 의
//    `include` 추가 · guard 부착 · pagination 금지) / `prisma/schema.prisma` 수정(`@@index([groupId])`
//    추가 판단은 실측 근거 후 별도 task) / 기존 perf-spec · `test/helpers/*` 수정 / write route 의
//    latency 측정(seed·삭제는 Prisma 직접 write, membershipId 계약도 HTTP DELETE 가 아니라 Prisma 조회로
//    확인) / 임계값 변경 · baseline 파일 확정(`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` ·
//    `confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write 0) / 동시성 S3(`concurrency: 1` 고정) /
//    doc-sync(PLAN · load-resilience-test-plan · requirements 반영은 머지 후 별도 `direct` task).
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

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청 + 페어 대조군(N+1 경로)이라 여유를 둔다.
jest.setTimeout(120_000);

// 소규모 표본의 membership 수(규모 관찰 ①) — `:id/members` 는 이 수와 무관하게 상수 2 query.
const SMALL_MEMBERS = 5;
// 상대적 대규모 표본의 membership 수(규모 관찰 ②) — 소규모의 10 배.
const LARGE_MEMBERS = 50;
// 표본별 반복 측정 횟수. 대규모·N+1 대조군은 요청당 비용이 커 반복을 줄인다.
const ITERATIONS = 12;
const LARGE_ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;

// 응답 원소의 기대 shape — join table row 원형(가공 0). `updatedAt` 은 schema 에 없다.
const MEMBERSHIP_KEYS = ["createdAt", "groupId", "id", "personId"];

interface MembershipRow {
  id: string;
  personId: string;
  groupId: string;
  createdAt: string;
}

describe("S2 조회 latency perf-spec — 실 DB N:M membership row 조회 (GET /api/groups/:id/members, REQ-048/REQ-028)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  // Person.email 은 `@unique` — seed 호출마다 접미를 갈아 test 내·간 충돌을 원천 차단.
  let seedSeq = 0;
  // 관찰 기록 축적(대소 관계 assert 금지, 디스크 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(GroupService·PersonService·PrismaService 어느 것도
    // useValue 로 대체하지 않는다) + applyGlobalMiddleware(T-0090 helper). guard 미부착 controller
    // 라 `createAuthenticatedE2EApp` 불요(slice 2 와 동일).
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

  // Person N 명 seed 후 id[] 반환. 개별 create loop 대신 `createMany` 1 왕복.
  const seedPersons = async (count: number): Promise<string[]> => {
    const tag = seedSeq;
    seedSeq += 1;
    const prefix = `realdb-members-perf-${tag}-`;
    await prisma.person.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        fullName: `실DB멤버인원-${tag}-${i}`,
        email: `${prefix}${i}@example.test`,
      })),
    });
    const persons = await prisma.person.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    return persons.map((p) => p.id);
  };

  // Group 1 + Person N + membership N seed. Group.name 은 `@unique` 미정의라 동명 허용.
  const seedGroupWithMembers = async (
    memberCount: number,
    name = "실DB그룹-멤버",
  ): Promise<{ groupId: string; personIds: string[] }> => {
    const group = await prisma.group.create({ data: { name } });
    const personIds = memberCount > 0 ? await seedPersons(memberCount) : [];
    if (personIds.length > 0) {
      await prisma.personGroupMembership.createMany({
        data: personIds.map((personId) => ({ personId, groupId: group.id })),
      });
    }
    return { groupId: group.id, personIds };
  };

  // 측정 대상 — 부모 검증 + findMany 의 **상수 2 query** 경로(join 0).
  const membersRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/groups/${id}/members`,
      );
      lastBody = res.body;
      return { status: res.status };
    };

  // 페어 대조군 — membership 수에 비례해 findById 가 발화하는 **1 + 1 + N** 경로.
  const personsRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/groups/${id}/persons`,
      );
      lastBody = res.body;
      return { status: res.status };
    };

  // baseline 한 줄 관찰 조립 — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    members: number,
    assertion: S2Assertion,
  ): { line: string; report: BaselineReport } => {
    const env = { label, concurrency: 1, dataScale: `${members} memberships` };
    const report = buildBaselineReport(env, assertion);
    const entry = { line: formatBaselineLine(report), report };
    observations.push(entry);
    return entry;
  };

  const bodyRows = (): MembershipRow[] => lastBody as MembershipRow[];

  // happy path + 분기 (b) membership 1+ → 전량 반환.
  it("happy / 분기 (b): membership 5건 Group 을 반복 조회 → 200 + seed 와 일치 + p95 < 3000ms pass", async () => {
    const { groupId, personIds } = await seedGroupWithMembers(SMALL_MEMBERS);

    const result = await collectLatencySamples(
      membersRequest(groupId),
      ITERATIONS,
    );

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    // mock 이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const rows = bodyRows();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(SMALL_MEMBERS);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(MEMBERSHIP_KEYS);
      expect(row.groupId).toBe(groupId);
    }
    expect(rows.map((r) => r.personId).sort()).toEqual([...personIds].sort());

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // 새 축 (1) — join 0 · 중간 테이블 row 원형임을 payload 로 직접 증거화한다.
  // 아울러 응답 `id` 가 `DELETE :id/members/:membershipId` 계약이 요구하는
  // `PersonGroupMembership.id` 와 같은 값임을 Prisma 직접 조회로 확증(HTTP DELETE 는 범위 밖).
  it("새 축 (1): 응답 원소가 Person payload · 중첩 관계 키 없는 join table row 원형이고 id 가 membershipId 계약과 일치", async () => {
    const { groupId, personIds } = await seedGroupWithMembers(2);

    const result = await collectLatencySamples(membersRequest(groupId), 1);
    expect(result.failures).toBe(0);
    const rows = bodyRows();
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      // `:id/persons` 가 내려주는 Person payload 키가 **없어야** join 0 의 증거.
      expect(row).not.toHaveProperty("fullName");
      expect(row).not.toHaveProperty("email");
      expect(row).not.toHaveProperty("partId");
      // 중첩 관계 객체(`include`) 부재 — service 가 repository 결과를 가공 0 으로 forward.
      expect(row).not.toHaveProperty("person");
      expect(row).not.toHaveProperty("group");
      // schema 상 `updatedAt` 자체가 없는 가장 좁은 row shape.
      expect(row).not.toHaveProperty("updatedAt");
      expect(Object.keys(row)).toHaveLength(MEMBERSHIP_KEYS.length);
    }

    // membershipId 계약 — 같은 id 로 Prisma 직접 조회 시 동일 row 가 나온다.
    const target = rows[0];
    const stored = await prisma.personGroupMembership.findUnique({
      where: { id: target.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.personId).toBe(target.personId);
    expect(stored?.groupId).toBe(groupId);
    expect(personIds).toContain(stored?.personId);
  });

  // 새 축 (2) 페어 측정 — **같은 group id · 같은 seed 상태** 에서 두 접근 경로를 나란히 측정.
  // 두 p95 를 모두 3000ms 미만으로 단언하되 **대소 관계는 assert 하지 않는다**(slice 3 선례).
  it("새 축 (2): 같은 group·seed 에서 :id/members(상수 2 query) 와 :id/persons(1+1+N) 를 페어 측정 → 둘 다 p95 < 3000ms, 대소는 관찰만", async () => {
    const { groupId } = await seedGroupWithMembers(SMALL_MEMBERS);

    const membersResult = await collectLatencySamples(
      membersRequest(groupId),
      ITERATIONS,
    );
    expect(membersResult.failures).toBe(0);
    expect(bodyRows()).toHaveLength(SMALL_MEMBERS);
    const membersAssertion = assertS2Threshold(membersResult);
    expect(membersAssertion.pass).toBe(true);
    expect(membersAssertion.summary.p95).toBeLessThan(3000);

    // 대조군 — seed 를 새로 심지 않고 **같은 상태** 를 그대로 다시 읽는다.
    const personsResult = await collectLatencySamples(
      personsRequest(groupId),
      ITERATIONS,
    );
    expect(personsResult.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(SMALL_MEMBERS);
    const personsAssertion = assertS2Threshold(personsResult);
    expect(personsAssertion.pass).toBe(true);
    expect(personsAssertion.summary.p95).toBeLessThan(3000);

    const pairMembers = observe(
      "ci-realdb-group-members-pair",
      SMALL_MEMBERS,
      membersAssertion,
    );
    const pairPersons = observe(
      "ci-realdb-group-persons-pair",
      SMALL_MEMBERS,
      personsAssertion,
    );
    // 관찰 기록만 — `pairPersons.p95 > pairMembers.p95` 는 wall-clock 비결정성 때문에 단언 금지.
    for (const { line, report } of [pairMembers, pairPersons]) {
      expect(line).toContain("p95=");
      expect(line).toContain("count=");
      expect(line).toContain(`dataScale=${SMALL_MEMBERS} memberships`);
      expect(Number.isFinite(report.p95)).toBe(true);
      expect(report.p95).toBeGreaterThanOrEqual(0);
    }
    expect(pairMembers.report.count).toBe(ITERATIONS);
    expect(pairPersons.report.count).toBe(ITERATIONS);
    expect(pairMembers.report.env.label).not.toBe(pairPersons.report.env.label);
    // 두 줄이 축적됐음 — 관찰 전용이라 파일로 확정하지 않는다(디스크 write 0).
    expect(observations.length).toBeGreaterThanOrEqual(2);
  });

  // 규모 관찰 — 소규모 vs 상대적 대규모. 두 p95 모두 임계 미만만 단언하고
  // **대소 관계·증가율은 단언하지 않는다**(관찰 기록만).
  it("규모 관찰: membership 5건 / 50건 두 상태의 :id/members p95 를 모두 3000ms 미만으로 단언, 증가율은 관찰만", async () => {
    const small = await seedGroupWithMembers(SMALL_MEMBERS, "실DB그룹-소규모");
    const smallResult = await collectLatencySamples(
      membersRequest(small.groupId),
      ITERATIONS,
    );
    expect(smallResult.failures).toBe(0);
    expect(bodyRows()).toHaveLength(SMALL_MEMBERS);
    const smallAssertion = assertS2Threshold(smallResult);
    expect(smallAssertion.pass).toBe(true);
    expect(smallAssertion.summary.p95).toBeLessThan(3000);

    const large = await seedGroupWithMembers(LARGE_MEMBERS, "실DB그룹-대규모");
    const largeResult = await collectLatencySamples(
      membersRequest(large.groupId),
      LARGE_ITERATIONS,
    );
    expect(largeResult.failures).toBe(0);
    expect(bodyRows()).toHaveLength(LARGE_MEMBERS);
    // 두 Group 이 공존해도 응답은 자기 groupId row 만 — 필터가 실제로 걸렸다는 근거.
    expect(await prisma.personGroupMembership.count()).toBe(
      SMALL_MEMBERS + LARGE_MEMBERS,
    );
    const largeAssertion = assertS2Threshold(largeResult);
    expect(largeAssertion.pass).toBe(true);
    expect(largeAssertion.summary.p95).toBeLessThan(3000);

    const smallReport = observe(
      "ci-realdb-group-members-small",
      SMALL_MEMBERS,
      smallAssertion,
    );
    const largeReport = observe(
      "ci-realdb-group-members-large",
      LARGE_MEMBERS,
      largeAssertion,
    );
    expect(smallReport.report.count).toBe(ITERATIONS);
    expect(largeReport.report.count).toBe(LARGE_ITERATIONS);
    expect(smallReport.line).toContain(
      `dataScale=${SMALL_MEMBERS} memberships`,
    );
    expect(largeReport.line).toContain(
      `dataScale=${LARGE_MEMBERS} memberships`,
    );
    expect(smallReport.report.env.dataScale).not.toBe(
      largeReport.report.env.dataScale,
    );
  });

  // error path + 분기 (c) 부모 Group 부재 → 404.
  it("error / 분기 (c): 미존재 group id 로 반복 조회 → 전부 404 failures, 표본 0 · errorRate 1 + raw stack 미노출", async () => {
    const missingId = "realdb-missing-members-group";
    const result = await collectLatencySamples(
      membersRequest(missingId),
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

    // 404 body 에 raw stack / Prisma 내부 메시지가 새지 않는다(REQ-032 계열 확인).
    const res = await request(app.getHttpServer()).get(
      `/api/groups/${missingId}/members`,
    );
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  // 분기 (a) — membership 0 인 Group 은 **404 가 아니라** 200 + 빈 배열
  // (group.controller.ts 의 "membership 0 이면 404 변환 안 함" 분기).
  it("분기 (a): membership 0건 Group → 404 가 아니라 200 + 빈 배열 + p95 pass, count === 요청 수", async () => {
    const { groupId } = await seedGroupWithMembers(0);
    const result = await collectLatencySamples(
      membersRequest(groupId),
      SHORT_ITERATIONS,
    );
    expect(result.failures).toBe(0);
    expect(Array.isArray(lastBody)).toBe(true);
    expect(lastBody as unknown[]).toHaveLength(0);
    expect(assertS2Threshold(result).pass).toBe(true);
    expect(summarizeLatency(result.samplesMs).count).toBe(SHORT_ITERATIONS);
  });

  describe("negative cases 충분 cover", () => {
    // (a) 격리 — Group 2 개가 공존해도 각 응답에 상대 Group 의 membership 이 혼입되지 않는다.
    //     새 축 (3) 의 후행 컬럼 단독 필터(`where: { groupId }`)가 실제로 갈라내는지의 증거.
    it("(a) Group 2개 공존 → 각 조회 응답에 상대 Group 의 membership 혼입 0", async () => {
      const a = await seedGroupWithMembers(3, "실DB그룹-A");
      const b = await seedGroupWithMembers(4, "실DB그룹-B");

      const resA = await collectLatencySamples(membersRequest(a.groupId), 1);
      expect(resA.failures).toBe(0);
      const rowsA = bodyRows();
      const resB = await collectLatencySamples(membersRequest(b.groupId), 1);
      expect(resB.failures).toBe(0);
      const rowsB = bodyRows();

      expect(rowsA).toHaveLength(3);
      expect(rowsB).toHaveLength(4);
      expect(rowsA.every((r) => r.groupId === a.groupId)).toBe(true);
      expect(rowsB.every((r) => r.groupId === b.groupId)).toBe(true);
      // membership id 집합이 서로 배타적 — 전체 7 건이 두 응답으로 정확히 분할된다.
      const idsA = new Set(rowsA.map((r) => r.id));
      expect(rowsB.some((r) => idsA.has(r.id))).toBe(false);
      expect(await prisma.personGroupMembership.count()).toBe(7);
    });

    // (b) REQ-028 다중 소속 — 한 Person 이 2 Group 에 동시 소속이면 각 응답에 **각각 1 건씩만** 나온다.
    it("(b) 한 Person 이 2 Group 동시 소속 → 각 group 응답에 각각 1건씩만 등장", async () => {
      const [personId] = await seedPersons(1);
      const g1 = await prisma.group.create({
        data: { name: "실DB그룹-다중1" },
      });
      const g2 = await prisma.group.create({
        data: { name: "실DB그룹-다중2" },
      });
      await prisma.personGroupMembership.createMany({
        data: [
          { personId, groupId: g1.id },
          { personId, groupId: g2.id },
        ],
      });

      const r1 = await collectLatencySamples(membersRequest(g1.id), 1);
      expect(r1.failures).toBe(0);
      const rows1 = bodyRows();
      const r2 = await collectLatencySamples(membersRequest(g2.id), 1);
      expect(r2.failures).toBe(0);
      const rows2 = bodyRows();

      expect(rows1).toHaveLength(1);
      expect(rows2).toHaveLength(1);
      expect(rows1[0].personId).toBe(personId);
      expect(rows2[0].personId).toBe(personId);
      // 같은 Person 이라도 membership row 는 별개 — `@@unique([personId, groupId])` 가 쌍 단위.
      expect(rows1[0].id).not.toBe(rows2[0].id);
    });

    // (c) `onDelete: Cascade` — Person row 삭제가 membership row 를 동반 소멸시켜 응답 길이가 준다.
    //     같은 시점 `:id/persons` 결과와 길이가 일치함도 함께 확인(두 경로의 데이터 정합).
    it("(c) Person 삭제 → cascade 로 membership 동반 소멸, 응답 길이 감소 + :id/persons 와 길이 일치", async () => {
      const { groupId, personIds } = await seedGroupWithMembers(4);

      const before = await collectLatencySamples(membersRequest(groupId), 1);
      expect(before.failures).toBe(0);
      expect(bodyRows()).toHaveLength(4);

      await prisma.person.delete({ where: { id: personIds[0] } });
      expect(await prisma.personGroupMembership.count()).toBe(3);

      const after = await collectLatencySamples(membersRequest(groupId), 1);
      expect(after.failures).toBe(0);
      const rowsAfter = bodyRows();
      expect(rowsAfter).toHaveLength(3);
      expect(rowsAfter.some((r) => r.personId === personIds[0])).toBe(false);

      const personsRes = await collectLatencySamples(
        personsRequest(groupId),
        1,
      );
      expect(personsRes.failures).toBe(0);
      expect(lastBody as unknown[]).toHaveLength(rowsAfter.length);
    });

    // (d) path 변형 — 라우팅이 없는 경로는 200 이 아니라 4xx 로 결정론적으로 갈린다.
    it("(d) path 변형(:id/members/extra · :id/member) → 200 이 아닌 4xx", async () => {
      const { groupId } = await seedGroupWithMembers(2);
      for (const path of [
        `/api/groups/${groupId}/members/extra`,
        `/api/groups/${groupId}/member`,
      ]) {
        const res = await request(app.getHttpServer()).get(path);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      }
      // 정상 경로는 그대로 200 — 위 4xx 가 서버 고장이 아님의 대조군.
      const ok = await request(app.getHttpServer()).get(
        `/api/groups/${groupId}/members`,
      );
      expect(ok.status).toBe(200);
    });

    // (e) 형식이 유효하지 않은 group id — cuid 가 아니어도 Prisma 는 단순 문자열 조회라
    //     500 이 아니라 부모 존재 검증의 **404** 로 결정론적으로 갈린다.
    it("(e) 빈 문자열 대체 토큰 · 비-cuid 문자열 group id → 500 이 아니라 404", async () => {
      for (const token of ["%20", "not-a-cuid-9999", "0"]) {
        const res = await request(app.getHttpServer()).get(
          `/api/groups/${token}/members`,
        );
        expect(res.status).toBe(404);
        expect(res.body).not.toHaveProperty("stack");
      }
    });

    // (f) 비현실적 임계 주입 — 실 측정값이라도 `p95MaxMs: 0` 이면 반드시 fail
    //     (임계가 판정에 반영되는지 확인. 실 latency 값에 무의존한 결정론적 fail 분기).
    it("(f) p95MaxMs: 0 을 주면 실 측정값이라도 pass===false + p95 사유", async () => {
      const { groupId } = await seedGroupWithMembers(SMALL_MEMBERS);
      const result = await collectLatencySamples(
        membersRequest(groupId),
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

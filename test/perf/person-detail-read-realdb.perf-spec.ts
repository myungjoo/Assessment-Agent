// person-detail-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 19**.
// (T-1537, load-resilience-test-plan §5 item 5 / REQ-048 조회 p95 < 3s, REQ-026 soft-delete)
//
// ① 위치 — slice 1~18 에 이은 실 DB round-trip **slice 19**. 부트스트랩·seed·정리 **구조는 slice 1
//    (`person-read-realdb.perf-spec.ts`, T-1500) 을 그대로 승계** 한다(문구 복제 대신 cross-ref).
//    slice 1 은 같은 controller 의 목록 route(`GET /api/persons`)를 실측하면서 `:id` 는 **부재 id 의
//    404 negative 로만** 두드리고 happy-path 를 남겨뒀다 — 본 spec 이 그 가장 오래된 미해소 짝을 닫는다.
//    직전 T-1536 의 잔여 read route 인벤토리는 본 route 를 "보수 분류"로 (B) 후보에 넣어뒀는데, 본
//    slice 의 실측이 그 **유보를 측정으로 해소** 한다. 계수: `PersonController` 는 slice 1 에서 **이미
//    실측 도메인** 이라 실측 endpoint 도메인 **14 는 불변** 이고 **조회 route 만 27 → 28** 로 늘어난다
//    (slice 15·17·18 과 같은 셈법 — 도메인·route 가 함께 늘었던 slice 16 셈법이 아니다).
// ② mock 짝 — `person-detail-read.perf-spec.ts`(T-0847, "열여덟 번째 실 perf-spec" 이자 네 번째
//    path-param detail read). 그 spec 은 `PersonService` 를 `useValue` mock 으로 대체해 **controller ↔
//    collector 배선 latency** 만 쟀고 검증도 `findById` 호출 횟수였다. 본 spec 은 **mock override 0**
//    으로 AppModule 을 실 부트스트랩하고 `moduleRef.get(PrismaService)` 의 실 client 로 seed 해 **DB
//    round-trip 포함 latency** 를 재며, 검증은 **응답 body 가 seed row 값과 일치** 함으로 한다. mock 짝
//    자체는 수정하지 않는다(그 spec 의 retire·통합 판단은 T-1536 이 명시 유보한 별도 주제).
// ③ 새 구조 축 3 개 —
//    (1) **한 테이블의 목록 route 와 단건 route 가 서로 다른 가시성 규칙을 갖는 첫 실측**.
//        `PersonService.findActive` 는 `findMany({ activeOnly: true })` 로 REQ-026 soft-delete
//        invariant 를 강제하지만 `findById` 는 `prisma.person.findUnique({ where: { id } })` 를 그대로
//        태워 **필터가 없어 `active: false` row 도 200 으로 반환** 한다. 즉 같은 시점 같은 row 가
//        목록에는 **없고** 단건에는 **있다**. 이 비대칭은 REQ-026 위반이 아니라 **route 별 가시성
//        규칙 차이** 다 — 목록은 "기본 노출 집합"을 좁히는 것이고 단건은 id 를 이미 아는 호출자의
//        직접 지목이라 soft-delete 된 row 의 상태 확인 경로를 남겨둔다. slice 7 의 soft-delete 는
//        자식 목록에만 걸렸고 대응하는 단건 경로가 없었다.
//    (2) **같은 seed 상태에서 목록과 단건을 나란히 재는 첫 페어**. slice 18 의 페어는 같은 부모의
//        두 자식 route(`:id/members` ↔ `:id/persons`)였지만, 본 slice 는 **같은 테이블의 집합 route 와
//        단일 row route** 를 한 spec 안에서 잰다(목록은 slice 1 대조군). 두 p95 를 모두 임계 미만으로
//        단언하되 **대소 관계는 assert 하지 않는다**(slice 3 선례 — wall-clock 비결정성).
//    (3) **규모 축의 의미가 route 마다 갈린다는 관찰**. 목록은 결과 집합이 테이블 규모에 비례하지만
//        단건은 총 row 수와 무관하게 **응답이 1 row 고정** 이다. 총 row 수가 소규모(5 건)·상대적
//        대규모(105 건 — 같은 테이블에 100 건 추가 seed)인
//        두 상태에서 **같은 `:id`** 를 조회해 두 p95 를 모두 임계 미만으로 단언하고 **대소·증가율은
//        단언하지 않고 관찰 기록만** 남긴다.
// ④ 새 축으로 **주장하지 않는** 항목(중복 주장 금지 검산) — PK 직행 `findUnique` 자체는 slice 11·14 와
//    동일, repository 의 null 분기를 service 가 `NotFoundException` 으로 변환하는 404 는 slice 11 과
//    동일, `PersonController` 의 guard 부재는 slice 1·2·7 과 동일, `include` 0 의 미조인 SELECT 는
//    slice 11 과 동일하다. 본 slice 의 신규성은 ③ 의 3 개뿐이다.
// ⑤ 인증·인가 negative 부재(구조적) — `PersonController` 는 **guard 미부착** 이라 401 / 403 분기가
//    구조적으로 존재하지 않는다. slice 4~17 의 cookie 미부착 401 · 서명 변조 401 · tier 403 negative 를
//    복사하면 **없는 분기를 가리키는 거짓 test** 가 된다. 대신 404 · 격리 · soft-delete 전이 · 비노출
//    컬럼 · path 변형 · 임계 주입 축으로 negative 를 채운다.
// ⑥ 결정론 전략 — seed 는 고정 행 수, `afterEach(truncateAll)`(ADR-0004 §Cleanup)가 매 test 후 도메인
//    테이블을 비워 각 test 는 자기 seed 만 본다(`Person.email` 은 `@unique` 라 seed 호출별 index 접미로
//    충돌 회피, `db-truncate.ts` 수정 0). latency 는 wall-clock 이라 비결정적이므로 두 route 의 대소도,
//    두 규모 표본의 대소·증가율도 관찰 기록에만 남긴다. pass 분기는 단일 클라이언트 · 수백 row 이하라
//    3000ms 훨씬 아래로 결정론적 도달하고, fail 분기는 **미존재 row 의 404** 또는 비현실적 임계 주입
//    (`p95MaxMs: 0`)이라 실 측정 시간에 무의존이다. 본 파일은 `jest-perf.json`
//    (`testRegex: test/perf/.*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고 기본
//    `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres + migrate 전제는 CI 가 충족).
// ⑦ Out of Scope — production code 변경 0(특히 `findById` 에 active 필터 추가 · `include` 추가 · guard
//    부착 · 404 메시지 변경 금지) / `prisma/schema.prisma` 수정 · migration(index 추가 판단은 실측 근거
//    후 별도 task) / slice 1 spec 수정(목록 route 는 본 spec 안에서 **페어 대조군으로만** 호출) / mock 짝
//    수정·retire / write route(`POST`·`PATCH`·`DELETE`)의 latency 측정(seed·삭제는 Prisma 직접 write) /
//    임계값 변경 · baseline 파일 확정(`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` ·
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

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청 + 페어/규모 대조군이라 여유를 둔다.
jest.setTimeout(120_000);

// 소규모 표본의 테이블 총 row 수(규모 관찰 ①) — 단건은 이 수와 무관하게 응답 1 row 고정.
const SMALL_ROWS = 5;
// 규모 관찰 ② 에서 같은 테이블에 **추가로** 심는 row 수 — 총 row 는 5 + 100 = 105 건(21 배).
const LARGE_ROWS = 100;
// 표본별 반복 측정 횟수.
const ITERATIONS = 12;
const LARGE_ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;

// 단건 응답의 기대 shape — `include` 0 이라 관계 객체 키가 붙지 않는 Person row 원형.
const PERSON_KEYS = [
  "active",
  "createdAt",
  "email",
  "fullName",
  "id",
  "partId",
  "updatedAt",
];

interface PersonRow {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  partId: string | null;
}

describe("S2 조회 latency perf-spec — 실 DB 단건 상세 조회 (GET /api/persons/:id, REQ-048/REQ-026)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  // Person.email 은 `@unique` — seed 호출마다 접미를 갈아 test 내·간 충돌을 원천 차단.
  let seedSeq = 0;
  // 관찰 기록 축적(대소 관계 assert 금지, 디스크 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(PersonService·PrismaService 어느 것도 useValue 로
    // 대체하지 않는다) + applyGlobalMiddleware(T-0090 helper). guard 미부착 controller 라
    // `createAuthenticatedE2EApp` 불요(slice 1 과 동일).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    // 앞선 스위트가 남긴 row 가 첫 test 의 seed 수 검증을 오염시키지 않도록 시작 시점에도 비운다.
    await truncateAll(prisma);
  });

  // ADR-0004 §Cleanup — 매 test 후 도메인 테이블 TRUNCATE 로 row leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // connection 누수 0 — app.close() 의 lifecycle hook + 명시적 $disconnect.
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Person N 명 seed 후 실 row 목록 반환(`createMany` 1 왕복 + id 회수 1 왕복).
  const seedPersons = async (
    count: number,
    active = true,
  ): Promise<PersonRow[]> => {
    const tag = seedSeq;
    seedSeq += 1;
    const prefix = `realdb-detail-perf-${tag}-`;
    await prisma.person.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        fullName: `실DB상세인원-${tag}-${i}`,
        email: `${prefix}${i}@example.test`,
        active,
      })),
    });
    const rows = await prisma.person.findMany({
      where: { email: { startsWith: prefix } },
      orderBy: { email: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      active: r.active,
      partId: r.partId,
    }));
  };

  // 측정 대상 — `findById` → `findUnique` 의 PK 직행 단건 조회(active 필터 0 · include 0).
  const detailRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/persons/${id}`);
      lastBody = res.body;
      return { status: res.status };
    };

  // 페어 대조군 — slice 1 이 이미 잰 목록 route(`findActive` — active 필터 O).
  const listRequest: RequestFn = async () => {
    const res = await request(app.getHttpServer()).get("/api/persons");
    lastBody = res.body;
    return { status: res.status };
  };

  // baseline 한 줄 관찰 조립 — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    rows: number,
    assertion: S2Assertion,
  ): { line: string; report: BaselineReport } => {
    const env = { label, concurrency: 1, dataScale: `${rows} persons` };
    const report = buildBaselineReport(env, assertion);
    const entry = { line: formatBaselineLine(report), report };
    observations.push(entry);
    return entry;
  };

  const bodyRow = (): PersonRow => lastBody as PersonRow;

  // happy path + 분기 (a) row 존재 → 200 + row 반환.
  it("happy / 분기 (a): 활성 Person 을 반복 단건 조회 → 200 + seed 값과 일치 + p95 < 3000ms pass", async () => {
    const [target] = await seedPersons(1);

    const result = await collectLatencySamples(
      detailRequest(target.id),
      ITERATIONS,
    );

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(result.samplesMs).toHaveLength(ITERATIONS);

    // mock 배선이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const row = bodyRow();
    expect(row.id).toBe(target.id);
    expect(row.fullName).toBe(target.fullName);
    expect(row.email).toBe(target.email);
    expect(row.active).toBe(true);

    // REQ-048 임계 — 실 DB round-trip 을 포함한 단건 경로에서의 판정.
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.reasons).toHaveLength(0);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // 새 축 (1) + 분기 (c) — soft-delete 가시성 비대칭. 같은 시점 같은 row 가 목록에는 없고
  // 단건에는 200 으로 있다. REQ-026 위반이 아니라 route 별 가시성 규칙 차이(헤더 ③ (1)).
  it("새 축 (1) / 분기 (c): active:false Person 은 목록에서 사라지지만 단건은 404 가 아니라 200 + active:false, p95 < 3000ms", async () => {
    const [inactive] = await seedPersons(1, false);
    const [activeRow] = await seedPersons(1, true);

    // (a) 목록 — active 필터가 비활성 row 를 걸러낸다.
    const listResult = await collectLatencySamples(
      listRequest,
      SHORT_ITERATIONS,
    );
    expect(listResult.failures).toBe(0);
    const listBody = lastBody as PersonRow[];
    expect(Array.isArray(listBody)).toBe(true);
    expect(listBody).toHaveLength(1);
    expect(listBody[0].id).toBe(activeRow.id);
    expect(listBody.some((p) => p.id === inactive.id)).toBe(false);

    // (b) 같은 시점 단건 — 필터가 없어 비활성 row 가 그대로 200 으로 나온다.
    const detailResult = await collectLatencySamples(
      detailRequest(inactive.id),
      ITERATIONS,
    );
    expect(detailResult.failures).toBe(0);
    const row = bodyRow();
    expect(row.id).toBe(inactive.id);
    expect(row.active).toBe(false);
    expect(row.email).toBe(inactive.email);

    // 실 DB 에는 두 row 가 모두 남아 있다 — 목록에서 빠진 것은 삭제가 아니라 필터 때문.
    expect(await prisma.person.count()).toBe(2);

    const assertion = assertS2Threshold(detailResult);
    expect(assertion.pass).toBe(true);
    expect(assertion.summary.p95).toBeLessThan(3000);
  });

  // 새 축 (2) 페어 측정 — **같은 seed 상태** 에서 집합 route 와 단일 row route 를 나란히 측정.
  // 두 p95 를 모두 3000ms 미만으로 단언하되 **대소 관계는 assert 하지 않는다**(slice 3 선례).
  it("새 축 (2): 같은 seed 에서 목록(GET /api/persons) 과 단건(:id) 을 페어 측정 → 둘 다 p95 < 3000ms, 대소는 관찰만", async () => {
    const seeded = await seedPersons(SMALL_ROWS);
    const target = seeded[0];

    const listResult = await collectLatencySamples(listRequest, ITERATIONS);
    expect(listResult.failures).toBe(0);
    expect(lastBody as unknown[]).toHaveLength(SMALL_ROWS);
    const listAssertion = assertS2Threshold(listResult);
    expect(listAssertion.pass).toBe(true);
    expect(listAssertion.summary.p95).toBeLessThan(3000);

    // 대조군 — seed 를 새로 심지 않고 **같은 상태** 를 단건 경로로 다시 읽는다.
    const detailResult = await collectLatencySamples(
      detailRequest(target.id),
      ITERATIONS,
    );
    expect(detailResult.failures).toBe(0);
    expect(bodyRow().id).toBe(target.id);
    const detailAssertion = assertS2Threshold(detailResult);
    expect(detailAssertion.pass).toBe(true);
    expect(detailAssertion.summary.p95).toBeLessThan(3000);

    const pairList = observe(
      "ci-realdb-person-list-pair",
      SMALL_ROWS,
      listAssertion,
    );
    const pairDetail = observe(
      "ci-realdb-person-detail-pair",
      SMALL_ROWS,
      detailAssertion,
    );
    // 관찰 기록만 — `list.p95 > detail.p95` 는 wall-clock 비결정성 때문에 단언 금지.
    for (const { line, report } of [pairList, pairDetail]) {
      expect(line).toContain("p95=");
      expect(line).toContain("count=");
      expect(line).toContain(`dataScale=${SMALL_ROWS} persons`);
      expect(Number.isFinite(report.p95)).toBe(true);
      expect(report.p95).toBeGreaterThanOrEqual(0);
      expect(report.count).toBe(ITERATIONS);
    }
    expect(pairList.report.env.label).not.toBe(pairDetail.report.env.label);
    expect(observations.length).toBeGreaterThanOrEqual(2);
  });

  // 새 축 (3) 규모 관찰 — 테이블 총 row 수만 바꾸고 **같은 :id** 를 조회한다. 목록은 결과 집합이
  // 규모에 비례하지만 단건은 응답이 1 row 고정이라 규모 축의 의미가 route 마다 갈린다.
  // 두 p95 모두 임계 미만만 단언하고 **대소 관계·증가율은 단언하지 않는다**(관찰 기록만).
  it("새 축 (3): 총 5건 / 105건 두 상태에서 같은 :id 조회 → 둘 다 p95 < 3000ms, 응답은 1 row 고정, 증가율은 관찰만", async () => {
    const seeded = await seedPersons(SMALL_ROWS);
    const target = seeded[0];

    const smallResult = await collectLatencySamples(
      detailRequest(target.id),
      ITERATIONS,
    );
    expect(smallResult.failures).toBe(0);
    expect(bodyRow().id).toBe(target.id);
    const smallAssertion = assertS2Threshold(smallResult);
    expect(smallAssertion.pass).toBe(true);
    expect(smallAssertion.summary.p95).toBeLessThan(3000);
    const smallCount = await prisma.person.count();
    expect(smallCount).toBe(SMALL_ROWS);

    // 같은 테이블을 상대적 대규모로 키운다 — 대상 :id 는 그대로.
    await seedPersons(LARGE_ROWS);
    const largeCount = await prisma.person.count();
    expect(largeCount).toBe(SMALL_ROWS + LARGE_ROWS);

    const largeResult = await collectLatencySamples(
      detailRequest(target.id),
      LARGE_ITERATIONS,
    );
    expect(largeResult.failures).toBe(0);
    // 규모가 21 배가 돼도 응답은 여전히 그 1 row — 배열이 아니다.
    const row = bodyRow();
    expect(Array.isArray(row)).toBe(false);
    expect(row.id).toBe(target.id);
    expect(row.email).toBe(target.email);
    const largeAssertion = assertS2Threshold(largeResult);
    expect(largeAssertion.pass).toBe(true);
    expect(largeAssertion.summary.p95).toBeLessThan(3000);

    const smallReport = observe(
      "ci-realdb-person-detail-small",
      smallCount,
      smallAssertion,
    );
    const largeReport = observe(
      "ci-realdb-person-detail-large",
      largeCount,
      largeAssertion,
    );
    expect(smallReport.report.count).toBe(ITERATIONS);
    expect(largeReport.report.count).toBe(LARGE_ITERATIONS);
    expect(smallReport.line).toContain(`dataScale=${smallCount} persons`);
    expect(largeReport.line).toContain(`dataScale=${largeCount} persons`);
    expect(smallReport.report.env.dataScale).not.toBe(
      largeReport.report.env.dataScale,
    );
  });

  // error path + 분기 (b) row 부재 → repository null → service 의 NotFoundException → 404.
  it("error / 분기 (b): 미존재 id 로 반복 조회 → 전부 404 failures, 표본 0 · errorRate 1 + raw stack 미노출", async () => {
    const missingId = "realdb-missing-person-detail";
    const result = await collectLatencySamples(
      detailRequest(missingId),
      SHORT_ITERATIONS,
    );

    expect(result.total).toBe(SHORT_ITERATIONS);
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
      `/api/persons/${missingId}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  describe("negative cases 충분 cover", () => {
    // (a) 격리 — Person 2 건이 공존해도 각 응답에 상대 row 가 혼입되지 않는다.
    it("(a) Person 2건 공존 → 각 :id 응답에 상대 row 혼입 0", async () => {
      const [first, second] = await seedPersons(2);

      const r1 = await collectLatencySamples(detailRequest(first.id), 1);
      expect(r1.failures).toBe(0);
      const row1 = bodyRow();
      const r2 = await collectLatencySamples(detailRequest(second.id), 1);
      expect(r2.failures).toBe(0);
      const row2 = bodyRow();

      expect(row1.id).toBe(first.id);
      expect(row2.id).toBe(second.id);
      expect(row1.email).toBe(first.email);
      expect(row2.email).toBe(second.email);
      expect(row1.id).not.toBe(row2.id);
      expect(await prisma.person.count()).toBe(2);
    });

    // (b) 형식이 유효하지 않은 id — cuid 가 아니어도 Prisma 는 단순 문자열 조회라
    //     500 이 아니라 findUnique null 분기의 **404** 로 결정론적으로 갈린다.
    it("(b) 빈 문자열 대체 토큰 · 비-cuid 문자열 id → 500 이 아니라 404", async () => {
      await seedPersons(1);
      for (const token of ["%20", "not-a-cuid-9999", "0"]) {
        const res = await request(app.getHttpServer()).get(
          `/api/persons/${token}`,
        );
        expect(res.status).toBe(404);
        expect(res.body).not.toHaveProperty("stack");
      }
    });

    // (c) 비정상 시퀀스 — 같은 id 가 두 시점에 200 → 404 로 전이한다(hard delete 는 seed
    //     정리용 Prisma 직접 write. HTTP DELETE 는 측정 범위 밖).
    it("(c) 삭제된 Person 의 id 재조회 → 같은 id 가 200 에서 404 로 전이", async () => {
      const [target] = await seedPersons(1);

      const before = await collectLatencySamples(detailRequest(target.id), 1);
      expect(before.failures).toBe(0);
      expect(bodyRow().id).toBe(target.id);

      await prisma.person.delete({ where: { id: target.id } });
      expect(await prisma.person.count()).toBe(0);

      const after = await collectLatencySamples(
        detailRequest(target.id),
        SHORT_ITERATIONS,
      );
      expect(after.failures).toBe(SHORT_ITERATIONS);
      expect(after.samplesMs).toHaveLength(0);
      expect(assertS2Threshold(after).errorRate).toBe(1);
    });

    // (d) 비노출 컬럼 — `include` 0 의 증거. 관계 객체 키가 응답에 새지 않는다.
    it("(d) 응답에 serviceIdentities · memberships 등 관계 키 부재(include 0 증거)", async () => {
      const [target] = await seedPersons(1);

      const result = await collectLatencySamples(detailRequest(target.id), 1);
      expect(result.failures).toBe(0);

      const row = bodyRow();
      for (const key of [
        "serviceIdentities",
        "memberships",
        "groups",
        "assessments",
        "summaries",
        "part",
      ]) {
        expect(row).not.toHaveProperty(key);
      }
      // 응답 shape 은 Person row 원형 그대로(FK 스칼라 `partId` 는 남고 관계 객체만 없다).
      expect(Object.keys(row).sort()).toEqual(PERSON_KEYS);
      expect(row.partId).toBeNull();
    });

    // (e) path 변형 — 라우팅이 없는 경로는 200 이 아니라 4xx 로 결정론적으로 갈린다.
    it("(e) path 변형(:id/extra) → 200 이 아닌 4xx, 정상 경로는 그대로 200", async () => {
      const [target] = await seedPersons(1);

      for (const path of [
        `/api/persons/${target.id}/extra`,
        `/api/persons/${target.id}/extra/deeper`,
      ]) {
        const res = await request(app.getHttpServer()).get(path);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      }
      // 정상 경로는 그대로 200 — 위 4xx 가 서버 고장이 아님의 대조군.
      const ok = await request(app.getHttpServer()).get(
        `/api/persons/${target.id}`,
      );
      expect(ok.status).toBe(200);
    });

    // (f) 비현실적 임계 주입 — 실 측정값이라도 `p95MaxMs: 0` 이면 반드시 fail
    //     (임계가 판정에 반영되는지 확인. 실 latency 값에 무의존한 결정론적 fail 분기).
    it("(f) p95MaxMs: 0 을 주면 실 측정값이라도 pass===false + p95 사유", async () => {
      const [target] = await seedPersons(1);
      const result = await collectLatencySamples(
        detailRequest(target.id),
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

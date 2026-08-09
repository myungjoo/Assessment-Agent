// part-detail-read-realdb.perf-spec.ts — S2 조회 latency harness 의 실 DB round-trip **slice 20**.
// (T-1539, load-resilience-test-plan §5 item 5 / REQ-048 조회 p95 < 3s)
//
// ① 위치 — slice 1~19 에 이은 실 DB round-trip **slice 20**. 부트스트랩·seed·정리 **구조는 slice 7
//    (`part-read-realdb.perf-spec.ts`, T-1512) 을 그대로 승계** 한다(문구 복제 대신 cross-ref).
//    slice 7 은 같은 `PartController` 의 목록(`GET /api/parts`) 과 자식 목록(`GET /api/parts/:id/persons`)
//    만 재고 단건 `:id` 는 남겨뒀다 — 본 spec 이 그 **가장 오래된 미해소 짝** 을 닫는다(slice 12 가 남긴
//    import-detail 짝보다 오래됐고, "가장 오래된 짝부터" 라는 선례는 slice 19 가 세웠다). T-1536 의 잔여
//    read route 인벤토리가 (B) 후보로 유보해 둔 3 route 중 하나이며 본 slice 의 실측이 그 **유보를 측정으로
//    해소** 한다. 계수: `PartController` 는 slice 7 에서 **이미 실측 도메인** 이라 실측 endpoint 도메인
//    **14 는 불변** 이고 **조회 route 만 28 → 29** 로 늘어난다(slice 15·17·18·19 와 같은 셈법 —
//    도메인·route 가 함께 늘었던 slice 16 셈법이 아니다).
// ② mock 짝 — `part-detail-read.perf-spec.ts`(T-0848, "열아홉 번째 실 perf-spec" 이자 다섯 번째
//    path-param detail read). 그 spec 은 `PartService` 를 `useValue` mock 으로 대체해 **controller ↔
//    collector 배선 latency** 만 쟀고 검증도 `findById` 호출 횟수였다. 본 spec 은 **mock override 0**
//    으로 AppModule 을 실 부트스트랩하고 `moduleRef.get(PrismaService)` 의 실 client 로 seed 해 **DB
//    round-trip 포함 latency** 를 재며, 검증은 **응답 body 가 seed row 값과 일치** 함으로 한다. mock 짝
//    자체는 수정하지 않는다(그 spec 의 retire·통합 판단은 T-1536 이 명시 유보한 별도 주제).
// ③ 새 구조 축 3 개 —
//    (1) **합성 route 의 구성 성분 query 를 분리해 재는 첫 페어**. slice 7 이 잰
//        `GET /api/parts/:id/persons` 는 `PartService.findPersonsByPartId` 가 **내부에서
//        `this.findById(partId)` 를 먼저 호출** 한 뒤 자식 `findByPartId` 를 태우는 요청당 상수 2 query
//        경로였다. 본 route 는 **그 첫 query 만 단독으로 노출된 route** 다 — 즉 앞 slice 가 합성으로 잰
//        경로의 구성 성분을 떼어 재는 첫 사례다. slice 19 의 페어는 같은 테이블의 **집합 ↔ 단일 row**
//        였지만 본 slice 의 페어는 **합성 경로 ↔ 그 부분 경로** 다.
//    (2) **404 를 공유하는 두 route 의 거절 경로 관측**. 두 route 의 404 는 같은 `findById` 의 null 분기
//        한 곳에서 나온다 — 자식 목록 route 의 404 도 자식 조회가 아니라 **부모 검증 query** 가 낸다.
//        같은 미존재 id 를 두 route 에 주입해 둘 다 404 로 수렴함을 관찰한다(대소 관계는 관찰만).
//    (3) **규모 축이 "자식 row 수" 인 단건 무반응 관찰**. slice 19 의 규모 축은 **같은 테이블의 총 row
//        수** 였지만, 본 route 의 규모 축은 **자식 `Person` 의 수** 다. `findById` 는 `include` 0 이라
//        자식이 0 건이든 다수든 응답이 **같은 4 scalar 컬럼 형태** 로 고정된다. 자식 0 Part 와 자식 다수
//        Part 의 두 p95 를 모두 임계 미만으로 단언하되 **대소·증가율은 단언하지 않는다**.
// ④ 새 축으로 **주장하지 않는** 항목(중복 주장 금지 검산) — PK 직행 `findUnique` 자체는 slice 11·14·19 와
//    동일, repository 의 null 분기를 service 가 `NotFoundException` 으로 변환하는 404 는 slice 11·19 와
//    동일, `include` 0 의 미조인 SELECT 는 slice 11·19 와 동일, `PartController` 의 guard 부재로 인한
//    **401 / 403 분기의 구조적 부재** 는 slice 1·2·7·19 와 동일하다. 한 controller 의 조회 route 전량
//    실측 도달도 Group slice 18 · Person slice 19 선례가 있어 새 축이 아니다. 본 slice 의 신규성은
//    ③ 의 3 개뿐이다.
// ⑤ 인증·인가 negative 부재(구조적) — `PartController` 는 **guard 미부착** 이라 401 / 403 분기가
//    구조적으로 존재하지 않는다. 다른 slice 의 cookie 미부착 401 · tier 403 negative 를 복사하면
//    **없는 분기를 가리키는 거짓 test** 가 된다. 대신 404 수렴 · 격리(혼입 0) · 삭제 후 전이 · 비노출
//    관계 키 · path 토큰 변형 · 임계 주입 축으로 negative 를 채운다.
// ⑥ 결정론 전략 — seed 는 고정 행 수, `afterEach(truncateAll)`(ADR-0004 §Cleanup)가 매 test 후 도메인
//    테이블을 비워 각 test 는 자기 seed 만 본다(`Part.name` 과 `Person.email` 이 모두 `@unique` 라 seed
//    호출별 index 접미로 충돌 회피, `db-truncate.ts` 수정 0). latency 는 wall-clock 이라 비결정적이므로
//    두 route 의 대소도, 자식 규모 두 표본의 대소·증가율도 관찰 기록에만 남긴다(slice 3 선례). pass 분기는
//    단일 클라이언트 · 수백 row 이하라 3000ms 훨씬 아래로 결정론적 도달하고, fail 분기는 **미존재 row 의
//    404** 또는 비현실적 임계 주입(`p95MaxMs: 0`)이라 실 측정 시간에 무의존이다. 본 파일은
//    `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)에만 매칭돼 `pnpm test:perf` 로만 실행되고
//    기본 `pnpm test`(`.*\.spec\.ts$`)에는 **picking 되지 않는다**(실 Postgres + migrate 전제는 CI 충족).
// ⑦ Out of Scope — production code 변경 0(특히 `PartService.findById` 에 필터 · `include` 추가 · guard
//    부착 · 404 메시지 변경 금지) / `prisma/schema.prisma` 수정 · migration(`Part` index 추가 판단은 실측
//    근거 후 별도 task) / slice 7 spec 수정(자식 목록 route 는 본 spec 안에서 **페어 대조군으로만** 호출) /
//    mock 짝 수정·retire / write route(`POST`·`PATCH`·`DELETE`)의 latency 측정(seed·삭제는 Prisma 직접
//    write) / 임계값 변경 · baseline 파일 확정(`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` ·
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

// 규모 관찰 — 자식 Person 이 다수인 Part 의 자식 수(자식 0 Part 와의 대조군).
const MANY_CHILDREN = 40;
// 표본별 반복 측정 횟수.
const ITERATIONS = 12;
const PAIR_ITERATIONS = 8;
// error·경계 분기용 짧은 반복(측정값이 아니라 분기 도달이 목적).
const SHORT_ITERATIONS = 4;

// 단건 응답의 기대 shape — `include` 0 이라 관계 배열(`persons`)이 붙지 않는 Part row 원형.
const PART_KEYS = ["createdAt", "id", "name", "updatedAt"];

interface PartRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

describe("S2 조회 latency perf-spec — 실 DB 단건 상세 조회 (GET /api/parts/:id, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 마지막 응답 body/status 보관 — mock spec 의 `toHaveBeenCalledTimes(N)` 의 실 DB 등가 검증용.
  let lastBody: unknown;
  let lastStatus = 0;
  // `Part.name` · `Person.email` 은 `@unique` — seed 호출마다 접미를 갈아 test 내·간 충돌 차단.
  let seedSeq = 0;
  // 관찰 기록 축적(대소 관계 assert 금지, 디스크 write 0).
  const observations: { line: string; report: BaselineReport }[] = [];

  beforeAll(async () => {
    // mock override 0 — AppModule 실 부트스트랩(PartService·PrismaService 어느 것도 useValue 로
    // 대체하지 않는다) + applyGlobalMiddleware(T-0090 helper). guard 미부착 controller 라
    // `createAuthenticatedE2EApp` 불요(slice 7 과 동일).
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

  // Part 1 개 + 자식 Person `children` 명 seed 후 실 Part row 반환.
  const seedPart = async (
    children = 0,
  ): Promise<{ id: string; name: string }> => {
    const tag = seedSeq;
    seedSeq += 1;
    const part = await prisma.part.create({
      data: { name: `실DB파트상세-${tag}` },
    });
    if (children > 0) {
      await prisma.person.createMany({
        data: Array.from({ length: children }, (_, i) => ({
          fullName: `실DB파트상세소속-${tag}-${i}`,
          email: `realdb-part-detail-perf-${tag}-${i}@example.test`,
          partId: part.id,
          active: true,
        })),
      });
    }
    return { id: part.id, name: part.name };
  };

  // 측정 대상 — `findById` → `findUnique` 의 PK 직행 단건 조회(필터 0 · include 0).
  const detailRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(`/api/parts/${id}`);
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  // 페어 대조군 — slice 7 이 이미 잰 자식 목록 route(`findById` 선행 + 자식 조회의 상수 2 query).
  const childrenRequest =
    (id: string): RequestFn =>
    async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/parts/${id}/persons`,
      );
      lastBody = res.body;
      lastStatus = res.status;
      return { status: res.status };
    };

  // baseline 한 줄 관찰 조립 — 관찰 전용이라 디스크 write 0.
  const observe = (
    label: string,
    children: number,
    assertion: S2Assertion,
  ): { line: string; report: BaselineReport } => {
    const env = { label, concurrency: 1, dataScale: `${children} children` };
    const report = buildBaselineReport(env, assertion);
    const entry = { line: formatBaselineLine(report), report };
    observations.push(entry);
    return entry;
  };

  const bodyRow = (): PartRow => lastBody as PartRow;

  // happy path + 분기 ① — row 존재 → 200 + seed 값과 일치하는 Part row 반환.
  it("happy / 분기 ①(200): Part 를 반복 단건 조회 → 200 + seed name 일치 + p95 < 3000ms pass", async () => {
    const target = await seedPart();

    const result = await collectLatencySamples(
      detailRequest(target.id),
      ITERATIONS,
    );

    expect(result.total).toBe(ITERATIONS);
    expect(result.failures).toBe(0);
    expect(result.samplesMs).toHaveLength(ITERATIONS);
    expect(lastStatus).toBe(200);

    // mock 배선이 아니라 실 Prisma query 가 발화했음을 응답 body 값으로 검증.
    const row = bodyRow();
    expect(row.id).toBe(target.id);
    expect(row.name).toBe(target.name);
    expect(typeof row.createdAt).toBe("string");

    // REQ-048 임계 — 실 DB round-trip 을 포함한 단건 경로에서의 판정.
    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(true);
    expect(assertion.reasons).toHaveLength(0);
    expect(assertion.errorRate).toBe(0);
    expect(assertion.summary.p95).toBeLessThan(3000);
    expect(summarizeLatency(result.samplesMs).count).toBe(ITERATIONS);
  });

  // 새 축 (1) 페어 측정 — 같은 seed 상태에서 **합성 route(:id/persons)** 와 **그 구성 성분
  // route(:id)** 를 나란히 잰다. 두 p95 를 모두 임계 미만으로 단언하되 **대소 관계는 assert 하지
  // 않는다**(slice 3 선례 — wall-clock 비결정성). slice 7 spec 파일 자체는 수정하지 않는다.
  it("새 축 (1): 같은 seed 에서 :id 와 :id/persons 를 페어 측정 → 둘 다 p95 < 3000ms, 대소는 관찰만", async () => {
    const target = await seedPart(3);

    const detailResult = await collectLatencySamples(
      detailRequest(target.id),
      PAIR_ITERATIONS,
    );
    expect(detailResult.failures).toBe(0);
    expect(bodyRow().id).toBe(target.id);
    const detailAssertion = assertS2Threshold(detailResult);
    expect(detailAssertion.pass).toBe(true);
    expect(detailAssertion.summary.p95).toBeLessThan(3000);

    // 대조군 — seed 를 새로 심지 않고 **같은 상태** 를 합성 route 로 다시 읽는다.
    const childrenResult = await collectLatencySamples(
      childrenRequest(target.id),
      PAIR_ITERATIONS,
    );
    expect(childrenResult.failures).toBe(0);
    expect(lastStatus).toBe(200);
    expect(lastBody as unknown[]).toHaveLength(3);
    const childrenAssertion = assertS2Threshold(childrenResult);
    expect(childrenAssertion.pass).toBe(true);
    expect(childrenAssertion.summary.p95).toBeLessThan(3000);

    const pairDetail = observe(
      "ci-realdb-part-detail-pair",
      3,
      detailAssertion,
    );
    const pairChildren = observe(
      "ci-realdb-part-children-pair",
      3,
      childrenAssertion,
    );
    // 관찰 기록만 — `children.p95 > detail.p95` 는 wall-clock 비결정성 때문에 단언 금지.
    for (const { line, report } of [pairDetail, pairChildren]) {
      expect(line).toContain("p95=");
      expect(line).toContain("count=");
      expect(line).toContain("dataScale=3 children");
      expect(Number.isFinite(report.p95)).toBe(true);
      expect(report.p95).toBeGreaterThanOrEqual(0);
      expect(report.count).toBe(PAIR_ITERATIONS);
    }
    expect(pairDetail.report.env.label).not.toBe(pairChildren.report.env.label);
    expect(observations.length).toBeGreaterThanOrEqual(2);
  });

  // 새 축 (2) — 두 route 의 404 는 같은 `findById` 의 null 분기 **한 곳** 에서 나온다.
  // 자식 목록 route 의 404 도 자식 조회가 아니라 **부모 검증 query** 가 내는 것이다. 관찰만 한다.
  it("새 축 (2): 같은 미존재 id 를 :id 와 :id/persons 에 주입 → 둘 다 404 로 수렴(대소는 관찰만)", async () => {
    await seedPart(2);
    const missingId = "realdb-missing-part-detail";

    const detailResult = await collectLatencySamples(
      detailRequest(missingId),
      SHORT_ITERATIONS,
    );
    expect(detailResult.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);

    const childrenResult = await collectLatencySamples(
      childrenRequest(missingId),
      SHORT_ITERATIONS,
    );
    expect(childrenResult.failures).toBe(SHORT_ITERATIONS);
    expect(lastStatus).toBe(404);

    // 두 route 모두 표본 0 · errorRate 1 — 거절 경로가 공유됨의 관측.
    expect(detailResult.samplesMs).toHaveLength(0);
    expect(childrenResult.samplesMs).toHaveLength(0);
    expect(assertS2Threshold(detailResult).errorRate).toBe(1);
    expect(assertS2Threshold(childrenResult).errorRate).toBe(1);

    // 같은 스위트의 정상 id 는 여전히 200 — 404 가 국소 분기임의 대조군.
    const alive = await prisma.part.findFirst();
    expect(alive).not.toBeNull();
    const ok = await request(app.getHttpServer()).get(
      `/api/parts/${alive?.id ?? ""}`,
    );
    expect(ok.status).toBe(200);
  });

  // 새 축 (3) + 분기 ③ — 규모 축이 **자식 row 수**. `include` 0 이라 자식 0 Part 와 자식 다수 Part 의
  // 단건 응답이 **동일한 4 scalar 컬럼 형태** 이고 payload 가 자식 fan-out 에 반응하지 않는다.
  // 두 p95 모두 임계 미만만 단언하고 **대소·증가율은 단언하지 않는다**(관찰 기록만).
  it("새 축 (3) / 분기 ③: 자식 0건 · 다수 Part 의 단건 응답이 동일 4 컬럼 형태 + 두 p95 모두 < 3000ms", async () => {
    const empty = await seedPart(0);
    const crowded = await seedPart(MANY_CHILDREN);
    expect(await prisma.person.count({ where: { partId: crowded.id } })).toBe(
      MANY_CHILDREN,
    );

    const emptyResult = await collectLatencySamples(
      detailRequest(empty.id),
      ITERATIONS,
    );
    expect(emptyResult.failures).toBe(0);
    const emptyRow = bodyRow();
    expect(emptyRow.id).toBe(empty.id);
    const emptyAssertion = assertS2Threshold(emptyResult);
    expect(emptyAssertion.pass).toBe(true);
    expect(emptyAssertion.summary.p95).toBeLessThan(3000);

    const crowdedResult = await collectLatencySamples(
      detailRequest(crowded.id),
      ITERATIONS,
    );
    expect(crowdedResult.failures).toBe(0);
    const crowdedRow = bodyRow();
    expect(crowdedRow.id).toBe(crowded.id);
    const crowdedAssertion = assertS2Threshold(crowdedResult);
    expect(crowdedAssertion.pass).toBe(true);
    expect(crowdedAssertion.summary.p95).toBeLessThan(3000);

    // 자식 수가 0 → 40 으로 벌어져도 응답 shape 은 같은 4 scalar 컬럼 — payload 무반응.
    expect(Object.keys(emptyRow).sort()).toEqual(PART_KEYS);
    expect(Object.keys(crowdedRow).sort()).toEqual(PART_KEYS);
    expect(Array.isArray(crowdedRow)).toBe(false);

    const emptyReport = observe(
      "ci-realdb-part-detail-no-children",
      0,
      emptyAssertion,
    );
    const crowdedReport = observe(
      "ci-realdb-part-detail-many-children",
      MANY_CHILDREN,
      crowdedAssertion,
    );
    expect(emptyReport.report.count).toBe(ITERATIONS);
    expect(crowdedReport.report.count).toBe(ITERATIONS);
    expect(emptyReport.line).toContain("dataScale=0 children");
    expect(crowdedReport.line).toContain(`dataScale=${MANY_CHILDREN} children`);
    expect(emptyReport.report.env.dataScale).not.toBe(
      crowdedReport.report.env.dataScale,
    );
  });

  // error path + 분기 ② — row 부재 → repository null → service 의 NotFoundException → 404.
  it("error / 분기 ②(404): 미존재 id 반복 조회 → 전부 404 failures, 표본 0 · 500 아님 · raw stack 미노출", async () => {
    const missingId = "realdb-missing-part-detail-error";
    const result = await collectLatencySamples(
      detailRequest(missingId),
      SHORT_ITERATIONS,
    );

    expect(result.total).toBe(SHORT_ITERATIONS);
    expect(result.failures).toBe(SHORT_ITERATIONS);
    expect(result.samplesMs).toHaveLength(0);
    expect(lastStatus).toBe(404);

    const assertion = assertS2Threshold(result);
    expect(assertion.pass).toBe(false);
    expect(assertion.errorRate).toBe(1);
    expect(
      assertion.reasons.some((r) => r.includes("error rate 임계 초과")),
    ).toBe(true);

    // 404 이지 500 이 아니고, body 에 raw stack / Prisma 내부 메시지가 새지 않는다(REQ-032 계열).
    const res = await request(app.getHttpServer()).get(
      `/api/parts/${missingId}`,
    );
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
    expect(res.body).not.toHaveProperty("stack");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  describe("negative cases 충분 cover", () => {
    // (a) 404 만 반복 → errorRate 임계 위반으로 pass=false. 200 과 섞으면 0 < er < 1 중간값.
    it("(a) 미존재 id 반복 → pass === false, 200 혼합 표본은 0 < errorRate < 1", async () => {
      const target = await seedPart();

      const failed = await collectLatencySamples(
        detailRequest("realdb-part-detail-missing-neg"),
        SHORT_ITERATIONS,
      );
      const assertion = assertS2Threshold(failed);
      expect(assertion.pass).toBe(false);
      expect(assertion.errorRate).toBe(1);
      expect(assertion.reasons.join()).toContain("error rate 임계 초과");

      let call = 0;
      const mixed: RequestFn = async () => {
        call += 1;
        // 홀수 번째는 실 Part 단건(200), 짝수 번째는 미존재 id(404).
        return call % 2 === 1
          ? detailRequest(target.id)()
          : detailRequest("realdb-part-detail-missing-mixed")();
      };
      const result = await collectLatencySamples(mixed, SHORT_ITERATIONS);
      expect(result.failures).toBe(SHORT_ITERATIONS / 2);
      const mixedAssertion = assertS2Threshold(result);
      expect(mixedAssertion.errorRate).toBeGreaterThan(0);
      expect(mixedAssertion.errorRate).toBeLessThan(1);
      expect(mixedAssertion.errorRate).toBeCloseTo(0.5);
      expect(mixedAssertion.pass).toBe(false);
    });

    // (b) 비현실적 임계 주입 — 실 측정값이 아무리 빨라도 `p95MaxMs: 0` 이면 pass === false.
    //     실 latency 값에 무의존한 결정론적 fail 분기.
    it("(b) p95MaxMs: 0 주입 → 실 측정값이라도 pass === false + p95 사유", async () => {
      const target = await seedPart();
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

    // (c) 빈 DB — Part 0 인 상태의 임의 id 조회는 500 이 아니라 404 로 수렴한다.
    it("(c) 빈 DB 에서 임의 id 단건 조회 → 500 이 아니라 404 로 수렴", async () => {
      expect(await prisma.part.count()).toBe(0);

      const result = await collectLatencySamples(
        detailRequest("realdb-part-detail-empty-db"),
        SHORT_ITERATIONS,
      );
      expect(result.failures).toBe(SHORT_ITERATIONS);
      expect(result.samplesMs).toHaveLength(0);
      expect(lastStatus).toBe(404);
      expect(lastStatus).not.toBe(500);
    });

    // (d) 형식이 유효하지 않은 id — cuid 가 아니어도 Prisma 는 단순 문자열 조회라
    //     500 이 아니라 findUnique null 분기의 **404** 로 결정론적으로 갈린다.
    it("(d) 빈 대체 토큰 · 비-cuid 문자열 id → 500 이 아니라 404", async () => {
      await seedPart();
      for (const token of ["%20", "not-a-cuid-9999", "0"]) {
        const res = await request(app.getHttpServer()).get(
          `/api/parts/${token}`,
        );
        expect(res.status).toBe(404);
        expect(res.body).not.toHaveProperty("stack");
      }
    });

    // (e) 비정상 시퀀스 — 같은 id 가 두 시점에 200 → 404 로 전이한다(자식 0 Part 라 FK Restrict
    //     (P2003) 에 걸리지 않는다. 삭제는 seed 정리용 Prisma 직접 write — HTTP DELETE 는 범위 밖).
    it("(e) 삭제된 Part 의 id 재조회 → 같은 id 가 200 에서 404 로 전이", async () => {
      const target = await seedPart(0);

      const before = await collectLatencySamples(detailRequest(target.id), 1);
      expect(before.failures).toBe(0);
      expect(bodyRow().id).toBe(target.id);

      await prisma.part.delete({ where: { id: target.id } });
      expect(await prisma.part.count()).toBe(0);

      const after = await collectLatencySamples(
        detailRequest(target.id),
        SHORT_ITERATIONS,
      );
      expect(after.failures).toBe(SHORT_ITERATIONS);
      expect(after.samplesMs).toHaveLength(0);
      expect(lastStatus).toBe(404);
      expect(assertS2Threshold(after).errorRate).toBe(1);
    });

    // (f) 격리 — 대조군 Part 가 함께 존재해도 각 응답에 상대 Part 의 `name` 이 섞이지 않는다.
    it("(f) 대조군 Part 공존 → 각 :id 응답에 다른 Part 의 name 혼입 0", async () => {
      const first = await seedPart(1);
      const second = await seedPart(2);

      const r1 = await collectLatencySamples(detailRequest(first.id), 1);
      expect(r1.failures).toBe(0);
      const row1 = bodyRow();
      const r2 = await collectLatencySamples(detailRequest(second.id), 1);
      expect(r2.failures).toBe(0);
      const row2 = bodyRow();

      expect(row1.id).toBe(first.id);
      expect(row1.name).toBe(first.name);
      expect(row1.name).not.toBe(second.name);
      expect(row2.id).toBe(second.id);
      expect(row2.name).toBe(second.name);
      expect(row2.name).not.toBe(first.name);
      expect(await prisma.part.count()).toBe(2);
    });

    // (g) 비노출 관계 키 — `include` 0 의 증거. 자식이 있어도 `persons` 키가 응답에 새지 않는다.
    it("(g) 자식 Person 이 있어도 응답에 persons 키 부재(미조인 SELECT 증거)", async () => {
      const target = await seedPart(3);

      const result = await collectLatencySamples(detailRequest(target.id), 1);
      expect(result.failures).toBe(0);

      const row = bodyRow();
      expect(row).not.toHaveProperty("persons");
      expect(Object.keys(row).sort()).toEqual(PART_KEYS);
      // 자식 row 는 DB 에 분명히 존재한다 — 응답에 없는 것은 삭제가 아니라 미조인 때문.
      expect(await prisma.person.count({ where: { partId: target.id } })).toBe(
        3,
      );
    });
  });
});

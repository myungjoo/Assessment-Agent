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
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

import { CHECKIN_BASELINE_ENV_FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX } from "./checkin-baseline-report";
import type { CheckinBaselineRunOutcome } from "./checkin-baseline-run";
import { registerCheckinBaselineWiringSuite } from "./checkin-baseline-spec-suite";
import { checkCheckinBaselineForSpec } from "./checkin-baseline-spec-wiring";
import {
  buildBaselineReport,
  formatBaselineLine,
  type BaselineEnvMeta,
  type BaselineReport,
} from "./latency-baseline";
import {
  assertS2Threshold,
  collectLatencySamples,
  measureBaselineCandidate,
  type RequestFn,
} from "./latency-collector";
import { summarizeLatency } from "./latency-metrics";
// 주입 monotonic clock 은 공유 helper 위임(T-1581 승격) — 실 DB 왕복 지연이 섞여도 배선 국면의
// 표본이 결정론적이라 wall-clock 대소 단언이 0 이다.
import { createStepClock } from "./step-clock";

// 실 DB 부트스트랩(AppModule 전체) + seed + 반복 요청이라 mock spec 보다 느리다.
// 기본 5s 로는 CI 의 cold connection pool 에서 flaky 할 수 있어 여유를 둔다.
jest.setTimeout(60_000);

// 다건 seed 기본 행 수(AC 2/AC 4 ②) — 단일 클라이언트 경량 스모크 수준(§4.1).
const SEED_ROWS = 20;
// 반복 측정 횟수 — 표본 20 개면 p95 가 상위 표본 구간에서 산출된다.
const ITERATIONS = 20;
// 배선 국면 전용 반복수 — 표본은 주입 clock 으로 결정론화되므로 반복수는 비용 변수일 뿐이라
// 실 DB 왕복이 섞이는 본 spec 에서는 최소로 둔다(기존 국면의 ITERATIONS 는 불변).
const WIRING_ITER = 2;

describe("S2 조회 latency perf-spec — 실 DB round-trip (GET /api/persons, REQ-048)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // 매 test 격리 임시 baseline 루트(afterEach 재귀 삭제 — 저장소 실경로 오염 0).
  let tmpRoot: string;
  // 배선 전용 label — 아래 baseline 리포트 국면의 `ci-realdb-person-read` 와 겹치지 않게 분리해
  // 체크인 baseline 파일 경로가 기존 관찰 국면과 충돌하지 않는다.
  const wiringEnv: BaselineEnvMeta = {
    label: "realdb-person-read-wiring",
    concurrency: 1,
  };

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

  beforeEach(() => {
    // 배선 국면이 쓸 임시 repo root — 저장소 밖(OS temp)에 매 test 새로 만든다.
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-person-read-realdb-"));
  });

  afterEach(async () => {
    // 임시 baseline 트리 재귀 삭제 — `test/perf/baselines/` 실경로에는 아무것도 남지 않는다.
    fs.rmSync(tmpRoot, { recursive: true, force: true });
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

  /** tmpRoot 하위 POSIX 결합 baseDir(`resolveCheckinBaselineDir` 와 동일 정규화). */
  const dirOf = (seg: string): string =>
    path.posix.join(tmpRoot.split(path.sep).join("/"), seg);

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

  // 체크인(repo 안 commit) baseline 확인 배선 — ADR-0056 §Follow-ups (b) 확산의 다음 소비자.
  // T-1576 ~ T-1580 이 measure→confirm 계열 9 개를, T-1586 이 `*-read` 계열 첫 소비자(mock)를
  // 배선했고 본 slice 는 **실 DB round-trip × measure→confirm top loop 부재**(순수 관찰형)
  // 조합을 처음 관측한다. 국면 10 개(happy 3 · error 2 · 분기 2 · negative 3)는 **공유 suite
  // factory 호출 1 회**로 등록하고 spec 은 고유분(`envMeta` · 측정 조립 · 임시 디렉토리)만
  // 주입한다 — 판정 · baseline 경로 조립 · 로그 형식 · 토글 저장/원복의 지역 재구현 0(전량
  // helper 위임, 토글 원복도 factory 의 beforeEach / afterEach 소관이라 지역 savedFlag 를 두지
  // 않는다). 토글 off 기본 상태에서는 `fs` 조회 0 · write 0 이라 기존 `perf test` step 동작이
  // 그대로고, 회귀는 관찰만 하며 exit code 를 바꾸지 않는다. 무효 options(non-object ·
  // non-function)의 등록 시점 TypeError 국면은 factory colocated
  // spec(`checkin-baseline-spec-suite.spec.ts`) 책임이라 여기서 중복 작성하지 않는다.
  registerCheckinBaselineWiringSuite({
    envMeta: wiringEnv,
    // 측정은 collector 위임(주입 clock 으로 결정론화). `GET /api/persons` 는 guard 미부착이라
    // cookie 없이 200 이고, `afterEach(truncateAll)` 로 seed 가 비어도 빈 배열 200 · errorRate 0
    // 이므로 배선 국면은 seed 무의존이다 — 기존 국면의 `lastListBody` 대조 단언과 `truncateAll`
    // 순서에 간섭하지 않는다. `listRequest` 는 `RequestFn` **값**이라 호출하지 않고 그대로 넘긴다.
    measure: (stepMs) =>
      measureBaselineCandidate(listRequest, wiringEnv, {
        iterations: WIRING_ITER,
        now: createStepClock(stepMs),
      }),
    // 임시 repo root — 체크인 baseline 파일은 매 test 격리 tmpRoot 아래에만 만든다(실경로 무오염).
    tempDir: (name) => dirOf(name),
  });

  // 체크인 baseline 확인 경로의 **실측 clock 관찰 국면**(T-1591, ADR-0056 §Consequences (d) ·
  // §Follow-ups (a) 선행). 위 배선 suite 의 국면은 전부 `createStepClock` 합성 표본이라 CI 로그에
  // 찍히는 candidate 수치가 실 latency 가 아니다. 본 describe 는 **주입 clock 없이**
  // (= `measureBaselineCandidate` 에 `now` 미주입) 측정한 candidate 를 같은 확인 경로에 태워,
  // §Follow-ups (a) 가 체크인할 baseline 의 승인 입력(실 p50/p95/p99)을 로그로 처음 노출한다.
  // `repoRoot` 를 **생략**해 저장소 실경로 바인딩을 타지만 이 경로에는 write 국면이 아예 없어
  // (§Decision 2) `test/perf/baselines/` 는 오염되지 않고, 회귀도 관찰만 하므로 exit code 가
  // 바뀌지 않는다(§Decision 3 (b) — wall-clock 대소 단언 0). 토글은 `processEnv` 주입으로만
  // 제어해 전역 `process.env` 를 읽지도 쓰지도 않는다. 실경로 무오염 · 전역 토글 누출 0 국면은
  // 배선 suite 의 `error (2)` · `negative (c)` 가 같은 코드 경로로 이미 cover 하므로 여기서
  // 재작성하지 않는다(T-1575 중복 국면 삭제 선례).
  describe("체크인 baseline 실측 clock 관찰(ci-realdb-person-read)", () => {
    // 실측 축 전용 반복수 — ITERATIONS · WIRING_ITER 재사용 금지(비용 축과 의미가 다른
    // 상수다, T-1591). T-1593 이 3 → 20 으로 상향했고 근거·한계·비용은 각각 다음과 같다:
    //  (1) 근거 — 표본 3 개에서는 p95 · p99 가 상위 순위 표본이 없어 사실상 **최댓값 1 개와
    //      동일**해지고, 공유 runner 의 wall-clock 비결정성(ADR-0056 §Decision 3 (b))이
    //      그대로 지표에 실려 회귀 관찰이 잡음에 지배된다.
    //  (2) 한계 — 20 표본에서도 p99 는 상위 1 개 표본 근방이라 **여전히 최댓값에 가깝다**.
    //      p99 를 안정화하려면 다중 run 분포(§Decision 5)가 필요하며 본 상수 상향만으로는
    //      p50 · p95 의 순위 기반 의미 회복까지가 한계다.
    //  (3) 비용 — 20 회 실 DB 왕복은 경량 list read 기준 합계 수십 ms 규모라
    //      §Decision 4 가 못 박은 "CI 비용 증가 사실상 0" 을 그대로 유지한다.
    const REAL_CLOCK_ITER = 20;
    // 표본 수 하한(회귀 가드 기준) — 아래 negative (a) 가 이 값 미만으로의 되돌림을 fail 시킨다.
    const REAL_CLOCK_ITER_MIN = 20;
    // 실측 label — 위 baseline 리포트 관찰 국면과 **같은 축**이고 배선 fixture label
    // (`realdb-person-read-wiring`)과는 이미 분리돼 있어, 체크인될 baseline 파일은 실측 축에만
    // 매달린다. `dataScale` 표기도 기존 관찰 국면과 동일하게 맞춘다.
    const realClockEnv: BaselineEnvMeta = {
      label: "ci-realdb-person-read",
      concurrency: 1,
      dataScale: `${SEED_ROWS} persons`,
    };
    // candidate 지표 줄의 수치 키(포매터가 고정한 grep 축) — on/off 분기 단언에서 공유한다.
    const METRIC_KEYS = [
      "p50=",
      "p95=",
      "p99=",
      "throughput=",
      "errorRate=",
      "count=",
      "pass=",
    ] as const;

    /** 실 clock 측정(= `now` 미주입) candidate 생산 — 합성 clock 을 쓰지 않는 유일한 국면. */
    const measureRealClock = (
      requestFn: RequestFn,
      iterations: number,
    ): Promise<BaselineReport> =>
      measureBaselineCandidate(requestFn, realClockEnv, { iterations });

    /** 확인 경로 1 회 위임 + 주입 로거 수집(`repoRoot` 생략 — 저장소 실경로 바인딩). */
    const checkWithLogs = (
      candidate: BaselineReport,
      processEnv: Record<string, string | undefined>,
      sink: string[] = [],
    ): { outcome: CheckinBaselineRunOutcome; logs: string[] } => {
      const outcome = checkCheckinBaselineForSpec({
        envMeta: realClockEnv,
        candidate,
        processEnv,
        log: (message) => sink.push(message),
      });
      return { outcome, logs: sink };
    };

    /** 토글 on 주입 record — 전역 환경변수를 세팅/삭제하지 않는다. */
    const enabledEnv = (): Record<string, string | undefined> => ({
      [CHECKIN_BASELINE_ENV_FLAG]: "1",
    });

    // 토글 on 국면의 status 는 **실행 시점 파일 존재 여부**에 달렸다 — baseline 이 체크인되면
    // `compared`, 아직 없으면 `skipped`/`absent` 다. 어느 쪽도 하드코딩하지 않는다.
    const expectEnabledOutcome = (outcome: CheckinBaselineRunOutcome): void => {
      if (outcome.status === "skipped") {
        expect(outcome.reason).toBe("absent");
        return;
      }
      expect(outcome.status).toBe("compared");
    };

    /** `absent` 국면에서만 존재하는 candidate 지표 줄(2 번째 줄)을 꺼낸다. */
    const metricsLineOf = (log: string): string => {
      const lines = log.split("\n");
      expect(lines).toHaveLength(2);
      return lines[1];
    };

    // happy — 실 clock 표본이 확인 경로를 그대로 통과하고 로그가 정확히 1 회 나간다.
    it("happy: 실 clock 측정 candidate 를 토글 on 으로 태우면 예외 0 + 로그 1 회(prefix 고정)", async () => {
      await seedPersons(SEED_ROWS);

      const candidate = await measureRealClock(listRequest, REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(logs).toHaveLength(1);
      expect(logs[0].startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      expectEnabledOutcome(outcome);
      // 실 clock 값 자체는 비결정적이라 대소 비교를 하지 않고 표본 수만 확인한다.
      expect(candidate.count).toBe(REAL_CLOCK_ITER);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        for (const key of METRIC_KEYS) {
          expect(metrics).toContain(key);
        }
        expect(metrics).toContain(`count=${REAL_CLOCK_ITER}`);
      }
      // 관찰 목적 — 실측 수치 줄을 CI 로그에 남긴다(§Consequences (d) 승인 입력).
      // eslint-disable-next-line no-console
      console.log(logs[0]);
      // baseline 이 체크인된 뒤(`compared`)에는 위 로그가 비교 본문만 담아 표본 수가
      // 드러나지 않는다. 다음 baseline 갱신 task 의 승인 입력이 되도록 candidate 지표 줄
      // (`count=` 포함)을 분기와 무관하게 한 줄 더 남긴다(T-1593).
      const candidateLine = formatBaselineLine(candidate);
      expect(candidateLine).toContain(`count=${REAL_CLOCK_ITER}`);
      // eslint-disable-next-line no-console
      console.log(candidateLine);
    });

    // error — 전량 reject 요청. 실 DB 를 건드리지 않으므로 seed 없이 성립한다.
    it("error: 전량 reject 요청의 실측 candidate 도 throw 0 + errorRate=1 · pass=false 전사", async () => {
      const rejecting: RequestFn = async () => {
        throw new Error("realdb-real-clock-checkin-reject");
      };

      const candidate = await measureRealClock(rejecting, REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      // 임계 위반이 exit code 를 바꾸지 않는다 — 판정은 pass 플래그로만 실린다.
      expect(candidate.errorRate).toBe(1);
      expect(candidate.pass).toBe(false);
      // 전량 실패라 성공 표본은 0 이지만 **시도 표본 수는 20 으로 유지**된다
      // (errorRate 는 성공/실패가 아니라 시도 대비 실패 비율이므로 1).
      expect(candidate.count).toBe(0);
      expect(candidate.errorRate * REAL_CLOCK_ITER).toBe(REAL_CLOCK_ITER);
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
      if (outcome.status === "skipped") {
        const metrics = metricsLineOf(logs[0]);
        expect(metrics).toContain("errorRate=1");
        expect(metrics).toContain("pass=false");
      }
    });

    // error(확장, T-1593) — 절반만 reject. 실패가 섞여도 **시도 표본 수 20 이 유지**되고
    // errorRate 가 실패 비율(10/20)을 그대로 반영함을 상수 기준으로 단언한다.
    it("error: 절반 reject 실측 candidate 도 시도 표본 20 유지 + errorRate 가 실패 비율 전사", async () => {
      await seedPersons(SEED_ROWS);
      let calls = 0;
      // 홀수 번째 호출만 reject — 20 회 중 정확히 10 회 실패(비율 결정론적).
      const halfRejecting: RequestFn = async () => {
        const index = calls++;
        if (index % 2 === 1) {
          throw new Error("realdb-real-clock-checkin-half-reject");
        }
        return listRequest();
      };

      const candidate = await measureRealClock(halfRejecting, REAL_CLOCK_ITER);
      const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

      expect(calls).toBe(REAL_CLOCK_ITER);
      expect(candidate.count).toBe(REAL_CLOCK_ITER / 2);
      expect(candidate.errorRate).toBe(0.5);
      // 성공 표본 + 실패 표본 = 시도 표본 수(20). 표본 수가 실패로 줄지 않는다.
      expect(candidate.count + candidate.errorRate * REAL_CLOCK_ITER).toBe(
        REAL_CLOCK_ITER,
      );
      expect(candidate.pass).toBe(false);
      expect(logs).toHaveLength(1);
      expectEnabledOutcome(outcome);
      if (outcome.status === "skipped") {
        expect(metricsLineOf(logs[0])).toContain(
          `count=${REAL_CLOCK_ITER / 2}`,
        );
      }
    });

    // 분기 — 같은 실측 candidate 를 토글 on / off 로 각각 태워 두 분기를 모두 태운다.
    it("분기: 같은 실측 candidate 가 토글 on 은 다중 줄, off 는 수치 0 개의 한 줄", async () => {
      await seedPersons(SEED_ROWS);
      const candidate = await measureRealClock(listRequest, REAL_CLOCK_ITER);
      // 두 분기 모두 20 표본 candidate 위에서 판정된다(표본 수는 분기와 무관한 축).
      expect(candidate.count).toBe(REAL_CLOCK_ITER);

      const on = checkWithLogs(candidate, enabledEnv());
      expectEnabledOutcome(on.outcome);
      // on 국면은 부재면 candidate 지표 줄, 존재면 비교 본문이 붙어 늘 2 줄 이상이다.
      expect(on.logs[0].split("\n").length).toBeGreaterThanOrEqual(2);

      const off = checkWithLogs(candidate, {});
      expect(off.outcome).toEqual({
        status: "skipped",
        reason: "disabled",
        log: off.logs[0],
      });
      expect(off.logs).toHaveLength(1);
      expect(off.logs[0].split("\n")).toHaveLength(1);
      for (const key of METRIC_KEYS) {
        expect(off.logs[0]).not.toContain(key);
      }
    });

    describe("negative cases 충분 cover", () => {
      // (a) 표본 수 하한 회귀 가드(T-1593) — REAL_CLOCK_ITER 가 20 미만으로 되돌아가면
      // 여기서 fail 한다. 3 표본 시절의 degenerate p95/p99(= 최댓값 1 개)로 회귀하는
      // 것을 코드 리뷰가 아니라 test 가 막는다(ADR-0056 §Follow-ups (c) 선행 조건 보전).
      it("(a) 표본 수 하한 회귀 가드 — REAL_CLOCK_ITER 가 20 미만으로 되돌아가면 fail", () => {
        expect(REAL_CLOCK_ITER).toBeGreaterThanOrEqual(REAL_CLOCK_ITER_MIN);
        expect(REAL_CLOCK_ITER_MIN).toBe(20);
        // 반복수는 정수여야 collectLatencySamples 가 RangeError 없이 소비한다.
        expect(Number.isInteger(REAL_CLOCK_ITER)).toBe(true);
      });

      // (b-1) 반복수 음수 — 측정 helper 는 candidate 를 만들지 않고 RangeError 를 그대로
      // 전파한다(재래핑 0). 상향된 상수와 무관하게 기존 계약이 유지됨을 못 박는다.
      it("(b-1) iterations: 음수 실측 요청은 RangeError 전파 + 확인 경로 미도달", async () => {
        const sink: string[] = [];
        let candidate: BaselineReport | undefined;

        await expect(
          (async () => {
            candidate = await measureRealClock(listRequest, -1);
            checkWithLogs(candidate, enabledEnv(), sink);
          })(),
        ).rejects.toBeInstanceOf(RangeError);

        // 측정 단계에서 throw 했으므로 candidate 도, 확인 경로 로그도 생기지 않는다.
        expect(candidate).toBeUndefined();
        expect(sink).toHaveLength(0);
      });

      // (b-2) 표본 0 — 포매터의 NaN 무가공 전사 계약이 실경로 바인딩 축에서도 성립한다.
      it("(b-2) iterations: 0 실측 candidate 도 throw 0 + count=0 · NaN 무가공 전사", async () => {
        const candidate = await measureRealClock(listRequest, 0);
        const { outcome, logs } = checkWithLogs(candidate, enabledEnv());

        expect(candidate.count).toBe(0);
        expect(Number.isNaN(candidate.p95)).toBe(true);
        expect(logs).toHaveLength(1);
        expectEnabledOutcome(outcome);
        if (outcome.status === "skipped") {
          const metrics = metricsLineOf(logs[0]);
          expect(metrics).toContain("count=0");
          expect(metrics).toContain("NaN");
        }
      });

      // (c) 순서 계약 — 실측 값은 비결정적이지만 percentile 은 정렬된 표본에서 뽑히므로
      // `p50 <= p95 <= p99` 가 20 표본에서도 깨지지 않는다(wall-clock 대소 단언 0 —
      // 절대값이 아니라 지표 간 순서만 본다, ADR-0056 §Decision 3 (b) 준수).
      it("(c) 실측 값이 비결정적이어도 p50 <= p95 <= p99 순서 계약이 유지된다", async () => {
        await seedPersons(SEED_ROWS);

        const candidate = await measureRealClock(listRequest, REAL_CLOCK_ITER);

        expect(candidate.count).toBe(REAL_CLOCK_ITER);
        expect(Number.isFinite(candidate.p50)).toBe(true);
        expect(candidate.p50).toBeLessThanOrEqual(candidate.p95);
        expect(candidate.p95).toBeLessThanOrEqual(candidate.p99);
      });

      // (d) 반복 호출 부작용 0 — 같은 국면을 연속 2 회 태워도 로그가 정확히 2 회다.
      it("(d) 실측 국면 연속 2 회 → 예외 0 + 로그 정확히 2 회 + status 동일", async () => {
        await seedPersons(SEED_ROWS);
        const sink: string[] = [];

        const first = checkWithLogs(
          await measureRealClock(listRequest, REAL_CLOCK_ITER),
          enabledEnv(),
          sink,
        );
        const second = checkWithLogs(
          await measureRealClock(listRequest, REAL_CLOCK_ITER),
          enabledEnv(),
          sink,
        );

        expect(sink).toHaveLength(2);
        expectEnabledOutcome(first.outcome);
        expectEnabledOutcome(second.outcome);
        // 같은 입력 축이라 두 번의 판정 국면이 갈리지 않는다(부작용 0 의 관찰 가능한 표현).
        expect(second.outcome.status).toBe(first.outcome.status);
      });
    });
  });
});

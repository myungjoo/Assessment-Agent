/**
 * 체크인(repo 안 commit) baseline 파일 **정본 가드** (REQ-048, ADR-0056 §Decision 1 ·
 * §Decision 2 · §Decision 3 (b) · §Consequences (a) · §Follow-ups (a)).
 *
 * 체크인된 baseline 이 정본 규약 — **경로**(`resolveCheckinBaselinePath` 유도값과 일치) ·
 * **직렬화 형태**(`serializeBaselineReport` 출력과 문자열 동일한 단일 행 JSON) · **값 범위**
 * (유한수 · `count` 표본 수 · `dataScale` 표기) — 를 지키는지 감시한다.
 *
 * **다중 label 표 기반**(T-1601). T-1592 이후 한동안 체크인 파일이 `ci-realdb-person-read`
 * 1 건뿐이라 본 spec 은 그 label 하나를 하드코딩했지만, T-1601 이 두 번째 route
 * (`ci-realdb-assessment-read`, T-1600 실측 20 표본 전사)를 체크인하면서 **"체크인 파일은 정확히
 * 1 개" 전제를 해체** 했다. 이제 label · 표본 수 · `dataScale` 정규식을 담은 표
 * (`CHECKIN_BASELINES`) 1 개가 유일한 갱신 지점이고, 국면은 전부 그 표를 순회한다 — 세 번째
 * route 가 체크인되면 표에 행 1 개를 더하는 것으로 끝난다.
 *
 * **가드 대상은 20 표본 실측값으로 전사된 baseline** 이다(T-1594 이전 person 레코드는 `count=3`).
 * 3 표본에서는 p95 · p99 가 사실상 최댓값 1 개와 같아 baseline 쪽 분포가 degenerate 해진다 — 그래서
 * negative (d) 가 `count >= CHECKIN_SAMPLE_MIN` 표본 수 하한을, (e) 가 `p50<=p95<=p99` 단조성과
 * 값 범위를 단언해 그런 baseline 의 조용한 재체크인을 차단한다(ADR-0056 §Decision 3 (b) 의 "측정
 * 반복 수를 늘리는 쪽을 먼저" · §Decision 5 의 연속 20 run 표본 축적이 갖는 신호 대 잡음비 보호).
 * negative (c) 는 디렉토리의 `.json` 목록이 **표에서 유도한 파일명 집합과 정확히 같음** 을 단언해
 * 파일 누락(표에 있는데 파일 없음)과 미등록 stale 파일(파일 있는데 표에 없음) 양방향을 모두
 * fail 시킨다(§Consequences (a) 의 stale label 파일 누적 방지).
 *
 * **실 DB · 앱 부트스트랩 무의존**이라 `pnpm test`(unit) 스위트에서 돈다. **부작용 0** — 파일
 * write · mkdir · 전역 `process.env` 변경을 0 회 하고 read-only 조회만 한다(§Decision 2 의
 * "write 국면 부재"를 spec 쪽에서도 지킨다). **wall-clock 실측 0** — 회귀 분기 확인은 in-memory
 * 리포트 조작만으로 태운다(공유 runner 비결정성 회피).
 */

import * as fs from "fs";
import * as path from "path";

import { defaultCheckinRepoRoot } from "./checkin-baseline-adapter";
import {
  resolveCheckinBaselineDir,
  resolveCheckinBaselinePath,
} from "./checkin-baseline-store";
import {
  BaselineEnvMeta,
  BaselineReport,
  compareBaselineReports,
  parseBaselineReport,
  serializeBaselineReport,
} from "./latency-baseline";
import { baselineFileExists, readBaselineFile } from "./latency-baseline-io";

/** 체크인 허용 표본 수 하한 — 이 아래는 degenerate 분포라 baseline 자격이 없다(모든 label 공통). */
const CHECKIN_SAMPLE_MIN = 20;

/** 표 1 행 — 체크인된 label 하나의 고유분(파일명 축 · 표본 수 · `dataScale` 표기)만 담는다. */
interface CheckinBaselineCase {
  /** 파일명 slug 이 매달리는 축. `dataScale` 은 파일 내용 축이라 파일명에 영향을 주지 않는다. */
  label: string;
  /** 전사된 실측 표본 수 — 리터럴을 국면마다 적지 않기 위한 행 단위 상수. */
  sampleCount: number;
  /** route 별로 서로 다른 `dataScale` 표기 형태 — 실측 spec 의 유도 문자열과 어긋나면 fail. */
  dataScalePattern: RegExp;
  /** 표기 형태를 사람이 읽는 근거(불일치 시 어떤 spec 을 봐야 하는지). */
  dataScaleOrigin: string;
}

/**
 * 체크인된 baseline 목록 — **본 spec 의 유일한 갱신 지점**.
 * 새 route 를 체크인하면 여기에 행 1 개를 추가한다(파일을 넣고 표를 안 고치면 negative (c) 의
 * 집합 일치가 즉시 fail 해서 누락이 조용히 지나가지 않는다).
 */
const CHECKIN_BASELINES: readonly CheckinBaselineCase[] = [
  {
    // T-1592 체크인 → T-1594 가 20 표본 실측으로 전사 교체. slice 1 `GET /api/persons` 표본.
    label: "ci-realdb-person-read",
    sampleCount: 20,
    dataScalePattern: /^\d+ persons$/,
    dataScaleOrigin:
      "person-measure-confirm-realdb.perf-spec.ts 의 SEED_ROWS 표기",
  },
  {
    // T-1601 체크인 — T-1600 이 연 실측 clock 관찰 국면의 20 표본 줄 전사.
    label: "ci-realdb-assessment-read",
    sampleCount: 20,
    dataScalePattern: /^1 person \/ \d+ assessments$/,
    dataScaleOrigin:
      "assessment-measure-confirm-realdb.perf-spec.ts 의 TOTAL_ROWS 유도 표기",
  },
];

/** 표 1 행 → 조회용 env-meta. `concurrency` 는 두 실측 축 모두 1 이다. */
const envOf = (checkin: CheckinBaselineCase): BaselineEnvMeta => ({
  label: checkin.label,
  concurrency: 1,
});

describe("체크인 baseline 파일 가드(다중 label 표 기반)", () => {
  /** 체크인 파일이 없는 label — error path · 존재 조회 false 국면 전용(표 밖 고정 축). */
  const MISSING_ENV: BaselineEnvMeta = {
    label: "ci-realdb-does-not-exist",
    concurrency: 1,
  };
  /** repo root 는 모듈 위치 기반(cwd 무의존) — 경로 문자열을 손으로 새로 적지 않는다. */
  const repoRoot = defaultCheckinRepoRoot();
  const baselineDir = resolveCheckinBaselineDir(repoRoot);

  /** 파일 원문(UTF-8) 을 읽되 후행 개행 **1 개까지만** 흡수한다(정본 비교용 본문). */
  const readBody = (filePath: string): string => {
    const raw = fs.readFileSync(filePath, { encoding: "utf-8" });
    return raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  };

  // 표는 비어 있으면 아래 순회 국면이 통째로 증발한다 — 그 조용한 무력화부터 막는다.
  it("표(CHECKIN_BASELINES)가 체크인 label 2 개 이상을 담고 label 중복이 0", () => {
    expect(CHECKIN_BASELINES.length).toBeGreaterThanOrEqual(2);
    const labels = CHECKIN_BASELINES.map((checkin) => checkin.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // error — 체크인되지 않은 label 은 ENOENT 계열 오류를 래핑 없이 전파한다.
  // 이 국면은 **체크인 label 축과 무관** 하다(표 순회로 태우면 같은 단언을 label 수만큼 반복할
  // 뿐 새 정보가 0 이다) — 그래서 표 밖 고정 label 1 개로만 태운다.
  it("error: 미체크인 label 은 readBaselineFile 이 ENOENT 를 래핑 없이 전파 + exists=false", () => {
    let caught: NodeJS.ErrnoException | undefined;
    try {
      readBaselineFile(MISSING_ENV, baselineDir);
    } catch (error) {
      caught = error as NodeJS.ErrnoException;
    }

    expect(caught).toBeDefined();
    // fs 가 던진 원본 오류 그대로 — 친절한 래핑 메시지로 감싸지 않는다.
    expect(caught?.code).toBe("ENOENT");
    // 체크인 파일이 label 축에만 매달린다는 사실의 관찰.
    expect(baselineFileExists(MISSING_ENV, baselineDir)).toBe(false);
    // 표의 어떤 행도 이 label 을 쓰지 않는다(= 진짜 미체크인 축이다).
    expect(
      CHECKIN_BASELINES.some((checkin) => checkin.label === MISSING_ENV.label),
    ).toBe(false);
  });

  // (c) stale label 파일 누적 방지(§Consequences (a)) — 1 파일 전제가 아니라 **집합 일치** 다.
  // 표에서 유도한 파일명 집합과 디렉토리 실물이 정확히 같아야 하므로, 파일 누락과 미등록 stale
  // 파일 양방향이 모두 fail 한다.
  it("(c) 체크인 디렉토리의 .json 집합이 표에서 유도한 파일명 집합과 정확히 동일", () => {
    const expected = CHECKIN_BASELINES.map((checkin) =>
      path.posix.basename(resolveCheckinBaselinePath(envOf(checkin), repoRoot)),
    ).sort();
    // 서로 다른 label 이 같은 파일명으로 접히면(= slug 충돌) 집합 크기가 줄어 여기서 걸린다.
    expect(new Set(expected).size).toBe(CHECKIN_BASELINES.length);

    const entries = fs
      .readdirSync(baselineDir)
      .filter((name) => name.endsWith(".json"))
      .sort();

    expect(entries).toEqual(expected);
  });

  for (const checkin of CHECKIN_BASELINES) {
    describe(`체크인 label ${checkin.label}`, () => {
      const env = envOf(checkin);
      const baselinePath = resolveCheckinBaselinePath(env, repoRoot);

      // happy — 체크인 파일이 예외 0 으로 리포트로 복원되고, 원문이 정본 직렬화 형태와 동일하다.
      it("happy: 체크인 파일이 예외 0 으로 복원되고 원문이 정본 직렬화 형태와 문자열 동일", () => {
        const report = readBaselineFile(env, baselineDir);

        expect(report.env.label).toBe(env.label);
        expect(report.env.concurrency).toBe(1);
        expect(report.count).toBe(checkin.sampleCount);
        expect(report.pass).toBe(true);
        expect(report.errorRate).toBe(0);
        for (const metric of [
          report.p50,
          report.p95,
          report.p99,
          report.throughput,
        ]) {
          expect(Number.isFinite(metric)).toBe(true);
        }

        // 정본 직렬화 형태 고정 — 키 순서 · 단일 행. 후행 개행은 0 또는 1 개만 허용된다.
        const body = readBody(baselinePath);
        expect(body.includes("\n")).toBe(false);
        expect(body).toBe(serializeBaselineReport(parseBaselineReport(body)));
        // 경로도 정본 유도값 그대로다(경로 문자열을 손으로 조립하지 않았음의 관찰).
        expect(baselineFileExists(env, baselineDir)).toBe(true);
      });

      // 분기 — 체크인 기준 대비 동일 수치 / tolerance 초과 두 방향을 모두 태운다(throw 0).
      it("분기: 동일 수치 candidate 는 무회귀, p95 를 10 배로 키운 candidate 는 회귀 표기", () => {
        const baseline = readBaselineFile(env, baselineDir);

        const same: BaselineReport = { ...baseline };
        const sameComparison = compareBaselineReports(baseline, same);
        expect(sameComparison.p50.regressed).toBe(false);
        expect(sameComparison.p95.regressed).toBe(false);
        expect(sameComparison.p99.regressed).toBe(false);
        expect(sameComparison.regressed).toBe(false);

        // 기본 tolerance(+10%)를 확실히 넘도록 p95 만 10 배로 — wall-clock 실측 0.
        const worse: BaselineReport = { ...baseline, p95: baseline.p95 * 10 };
        const worseComparison = compareBaselineReports(baseline, worse);
        expect(worseComparison.p95.regressed).toBe(true);
        expect(worseComparison.regressed).toBe(true);
        // 다른 지표는 그대로라 회귀로 번지지 않는다.
        expect(worseComparison.p50.regressed).toBe(false);
        expect(worseComparison.p99.regressed).toBe(false);
      });

      describe("negative cases 충분 cover", () => {
        // (a) 표본 0 candidate — throw 0 이고 candidate-only NaN 이라 회귀로 표기된다.
        it("(a) 표본 0(NaN) candidate 를 체크인 기준과 비교해도 throw 0 + 회귀 표기", () => {
          const baseline = readBaselineFile(env, baselineDir);
          const empty: BaselineReport = {
            ...baseline,
            p50: NaN,
            p95: NaN,
            p99: NaN,
            count: 0,
            pass: false,
          };

          const comparison = compareBaselineReports(baseline, empty);

          // §Decision 3 (b) — 회귀 관찰이 exit code 를 바꾸지 않는다(throw 0).
          expect(comparison.p50.regressed).toBe(true);
          expect(comparison.p95.regressed).toBe(true);
          expect(comparison.p99.regressed).toBe(true);
          expect(Number.isNaN(comparison.p95.delta)).toBe(true);
          expect(comparison.regressed).toBe(true);
        });

        // (b) dataScale 표기 — route 별 실측 spec 의 유도 표기와 어긋나지 않는다.
        it(`(b) 체크인 파일의 env.dataScale 이 route 표기 형태(${checkin.dataScaleOrigin})의 비어있지 않은 string`, () => {
          const report = readBaselineFile(env, baselineDir);

          expect(typeof report.env.dataScale).toBe("string");
          expect(report.env.dataScale).not.toBe("");
          expect(report.env.dataScale).toMatch(checkin.dataScalePattern);
        });

        // (d) 표본 수 하한 — degenerate 표본(예: 갱신 전 count=3) baseline 의 재체크인 차단.
        it("(d) 체크인 파일의 report.count 가 표본 수 하한(CHECKIN_SAMPLE_MIN) 이상", () => {
          /** 하한 판정 술어 — 아래 두 단언이 리터럴 비교가 아니라 같은 술어를 태우게 한다. */
          const meetsSampleFloor = (count: number): boolean =>
            Number.isInteger(count) && count >= CHECKIN_SAMPLE_MIN;
          const report = readBaselineFile(env, baselineDir);

          expect(Number.isInteger(report.count)).toBe(true);
          expect(report.count).toBeGreaterThanOrEqual(CHECKIN_SAMPLE_MIN);
          expect(meetsSampleFloor(report.count)).toBe(true);
          // 표에 적힌 표본 수도 같은 하한을 통과해야 한다(표 자체의 되돌림 방지).
          expect(meetsSampleFloor(checkin.sampleCount)).toBe(true);
          // 하한이 장식이 아님의 관찰 — 갱신 전 레코드와 같은 표본 수(3)는 같은 술어에서 떨어진다.
          expect(meetsSampleFloor(3)).toBe(false);
          // 소수 표본 수 같은 불량 값도 하한을 통과하지 못한다.
          expect(meetsSampleFloor(20.5)).toBe(false);
        });

        // (e) 값 범위 · 단조성 — 전사 과정에서 자리 뒤바뀜 · 부호 오류가 섞이면 여기서 걸린다.
        it("(e) p50 <= p95 <= p99 단조성 + throughput > 0 + 0 <= errorRate <= 1", () => {
          const report = readBaselineFile(env, baselineDir);

          expect(report.p50).toBeLessThanOrEqual(report.p95);
          expect(report.p95).toBeLessThanOrEqual(report.p99);
          expect(report.p50).toBeGreaterThan(0);
          expect(report.throughput).toBeGreaterThan(0);
          expect(report.errorRate).toBeGreaterThanOrEqual(0);
          expect(report.errorRate).toBeLessThanOrEqual(1);
        });
      });
    });
  }
});

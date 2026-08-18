/**
 * 체크인(repo 안 commit) baseline 파일 **정본 가드** (REQ-048, ADR-0056 §Decision 1 ·
 * §Decision 2 · §Decision 3 (b) · §Consequences (a) · §Follow-ups (a)).
 *
 * T-1592 가 확정한 첫 체크인 baseline(`test/perf/baselines/baseline-ci-realdb-person-read.json`)이
 * 이후에도 정본 규약 — **경로**(`resolveCheckinBaselinePath` 유도값과 일치) · **직렬화 형태**
 * (`serializeBaselineReport` 출력과 문자열 동일한 단일 행 JSON) · **값 범위**(유한수 · `count`
 * 표본 수 · `dataScale` 표기) — 를 지키는지 감시한다.
 *
 * **가드 대상은 T-1594 가 20 표본 실측값으로 전사 교체한 baseline** 이다(이전 레코드는 `count=3`).
 * 3 표본에서는 p95 · p99 가 사실상 최댓값 1 개와 같아 baseline 쪽 분포가 degenerate 해진다 — 그래서
 * negative (d) 가 `count >= CHECKIN_SAMPLE_MIN` 표본 수 하한을, (e) 가 `p50<=p95<=p99` 단조성과
 * 값 범위를 단언해 그런 baseline 의 조용한 재체크인을 차단한다(ADR-0056 §Decision 3 (b) 의 "측정
 * 반복 수를 늘리는 쪽을 먼저" · §Decision 5 의 연속 20 run 표본 축적이 갖는 신호 대 잡음비 보호).
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

describe("체크인 baseline 파일 가드(ci-realdb-person-read)", () => {
  /**
   * 체크인 레코드의 표본 수 — T-1593 이 실측 국면을 20 반복으로 올린 뒤 T-1594 가 그 실측 줄을
   * 전사한 값이다. 리터럴 대신 상수로 두어 갱신 시 한 곳만 고치면 되게 한다.
   */
  const CHECKIN_SAMPLE_COUNT = 20;
  /** 체크인 허용 표본 수 하한 — 이 아래는 degenerate 분포라 baseline 자격이 없다. */
  const CHECKIN_SAMPLE_MIN = 20;
  /** 체크인 축 env-meta — 파일명 slug 은 `label` 에만 매달린다(`dataScale` 은 파일 내용 축). */
  const CHECKIN_ENV: BaselineEnvMeta = {
    label: "ci-realdb-person-read",
    concurrency: 1,
  };
  /** 체크인 파일이 없는 label — error path · 존재 조회 false 국면 전용. */
  const MISSING_ENV: BaselineEnvMeta = {
    label: "ci-realdb-does-not-exist",
    concurrency: 1,
  };
  /** repo root 는 모듈 위치 기반(cwd 무의존) — 경로 문자열을 손으로 새로 적지 않는다. */
  const repoRoot = defaultCheckinRepoRoot();
  const baselineDir = resolveCheckinBaselineDir(repoRoot);
  const baselinePath = resolveCheckinBaselinePath(CHECKIN_ENV, repoRoot);

  /** 파일 원문(UTF-8) 을 읽되 후행 개행 **1 개까지만** 흡수한다(정본 비교용 본문). */
  const readBody = (): string => {
    const raw = fs.readFileSync(baselinePath, { encoding: "utf-8" });
    return raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  };

  // happy — 체크인 파일이 예외 0 으로 리포트로 복원되고, 원문이 정본 직렬화 형태와 동일하다.
  it("happy: 체크인 파일이 예외 0 으로 복원되고 원문이 정본 직렬화 형태와 문자열 동일", () => {
    const report = readBaselineFile(CHECKIN_ENV, baselineDir);

    expect(report.env.label).toBe(CHECKIN_ENV.label);
    expect(report.env.concurrency).toBe(1);
    expect(report.count).toBe(CHECKIN_SAMPLE_COUNT);
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
    const body = readBody();
    expect(body.includes("\n")).toBe(false);
    expect(body).toBe(serializeBaselineReport(parseBaselineReport(body)));
    // 경로도 정본 유도값 그대로다(경로 문자열을 손으로 조립하지 않았음의 관찰).
    expect(baselineFileExists(CHECKIN_ENV, baselineDir)).toBe(true);
  });

  // error — 체크인되지 않은 label 은 ENOENT 계열 오류를 래핑 없이 전파한다.
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
  });

  // 분기 — 체크인 기준 대비 동일 수치 / tolerance 초과 두 방향을 모두 태운다(throw 0).
  it("분기: 동일 수치 candidate 는 무회귀, p95 를 10 배로 키운 candidate 는 회귀 표기", () => {
    const baseline = readBaselineFile(CHECKIN_ENV, baselineDir);

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
      const baseline = readBaselineFile(CHECKIN_ENV, baselineDir);
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

    // (b) dataScale 표기 — 실측 spec 의 SEED_ROWS 표기와 어긋나지 않는다.
    it("(b) 체크인 파일의 env.dataScale 이 '<n> persons' 형태의 비어있지 않은 string", () => {
      const report = readBaselineFile(CHECKIN_ENV, baselineDir);

      expect(typeof report.env.dataScale).toBe("string");
      expect(report.env.dataScale).not.toBe("");
      expect(report.env.dataScale).toMatch(/^\d+ persons$/);
    });

    // (c) stale label 파일 누적 방지(§Consequences (a)) — 체크인 파일은 정확히 1 개다.
    it("(c) 체크인 디렉토리의 baseline 파일이 정확히 1 개이고 이름이 정본 유도값과 동일", () => {
      const entries = fs
        .readdirSync(baselineDir)
        .filter((name) => name.endsWith(".json"))
        .sort();

      expect(entries).toEqual([path.posix.basename(baselinePath)]);
    });

    // (d) 표본 수 하한 — degenerate 표본(예: 갱신 전 count=3) baseline 의 재체크인 차단.
    it("(d) 체크인 파일의 report.count 가 표본 수 하한(CHECKIN_SAMPLE_MIN) 이상", () => {
      const report = readBaselineFile(CHECKIN_ENV, baselineDir);

      expect(Number.isInteger(report.count)).toBe(true);
      expect(report.count).toBeGreaterThanOrEqual(CHECKIN_SAMPLE_MIN);
      // 하한이 장식이 아님의 관찰 — 갱신 전 레코드(count=3)는 이 단언에서 실제로 떨어진다.
      expect(3).toBeLessThan(CHECKIN_SAMPLE_MIN);
    });

    // (e) 값 범위 · 단조성 — 전사 과정에서 자리 뒤바뀜 · 부호 오류가 섞이면 여기서 걸린다.
    it("(e) p50 <= p95 <= p99 단조성 + throughput > 0 + 0 <= errorRate <= 1", () => {
      const report = readBaselineFile(CHECKIN_ENV, baselineDir);

      expect(report.p50).toBeLessThanOrEqual(report.p95);
      expect(report.p95).toBeLessThanOrEqual(report.p99);
      expect(report.p50).toBeGreaterThan(0);
      expect(report.throughput).toBeGreaterThan(0);
      expect(report.errorRate).toBeGreaterThanOrEqual(0);
      expect(report.errorRate).toBeLessThanOrEqual(1);
    });
  });
});

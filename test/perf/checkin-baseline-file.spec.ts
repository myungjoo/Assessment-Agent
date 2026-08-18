/**
 * 체크인(repo 안 commit) baseline 파일 **정본 가드** (REQ-048, ADR-0056 §Decision 1 ·
 * §Decision 2 · §Decision 3 (b) · §Consequences (a) · §Follow-ups (a)).
 *
 * T-1592 가 확정한 첫 체크인 baseline(`test/perf/baselines/baseline-ci-realdb-person-read.json`)이
 * 이후에도 정본 규약 — **경로**(`resolveCheckinBaselinePath` 유도값과 일치) · **직렬화 형태**
 * (`serializeBaselineReport` 출력과 문자열 동일한 단일 행 JSON) · **값 범위**(유한수 · `count`
 * 표본 수 · `dataScale` 표기) — 를 지키는지 감시한다.
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
    expect(report.count).toBe(3);
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
  });
});

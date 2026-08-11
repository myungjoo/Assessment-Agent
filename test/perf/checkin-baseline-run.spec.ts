import { CHECKIN_BASELINE_ENV_FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX } from "./checkin-baseline-report";
import {
  CheckinBaselineCompareFn,
  CheckinBaselineRunInput,
  runCheckinBaselineCheck,
} from "./checkin-baseline-run";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import {
  BaselineComparison,
  BaselineEnvMeta,
  BaselineReport,
} from "./latency-baseline";

/**
 * T-1563 — 판정 → 비교 → 로그 조립 진입점의 R-112 spec(happy-path / error path / 분기 cover /
 * negative cases). 비교를 mock 주입해 파일 시스템 · 전역 환경변수 없이 결정론적으로 검증한다.
 */
describe("checkin-baseline-run — 판정→비교→로그 조립 (ADR-0056 §Follow-ups (b))", () => {
  type Env = Record<string, string | undefined>;
  const REPO_ROOT = "/srv/repo";
  const DIR = resolveCheckinBaselineDir(REPO_ROOT);
  const METRIC = { baseline: 10, candidate: 11, delta: 1, regressed: false };
  const meta = (label = "ci-linux-x64"): BaselineEnvMeta => ({
    label,
    concurrency: 4,
  });
  const flagEnv = (value?: string): Env =>
    value === undefined ? {} : { [CHECKIN_BASELINE_ENV_FLAG]: value };
  /** 비교 함수로 전달만 되는 candidate 스텁 — 본 모듈은 그 내용을 보지 않는다. */
  const REPORT = { env: meta(), pass: true } as unknown as BaselineReport;
  /** 종합 회귀 여부만 바꿔 끼우는 비교 결과 픽스처. */
  const comparison = (regressed: boolean): BaselineComparison => ({
    p50: METRIC,
    p95: { ...METRIC, regressed },
    p99: METRIC,
    errorRate: METRIC,
    throughput: METRIC,
    regressed,
  });
  /** `{ comparison, report }` 를 내는 mock 비교 함수(호출 인자 · 횟수 관찰용). */
  const okCompare = (regressed = false): jest.Mock =>
    jest.fn(() => ({ comparison: comparison(regressed), report: "본문" }));
  const input = (
    over: Partial<CheckinBaselineRunInput> = {},
  ): CheckinBaselineRunInput => ({
    processEnv: flagEnv("1"),
    envMeta: meta(),
    repoRoot: REPO_ROOT,
    exists: true,
    candidate: REPORT,
    ...over,
  });
  /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
  const bad = (value: unknown): CheckinBaselineRunInput =>
    value as CheckinBaselineRunInput;
  const badFn = (value: unknown): CheckinBaselineCompareFn =>
    value as CheckinBaselineCompareFn;
  it("happy-path: compared 는 회귀 여부 · 로그 블록을 내고 비교를 정확히 1 회 호출한다", () => {
    const compare = okCompare(false);
    const arg = input();
    expect(runCheckinBaselineCheck(arg, compare)).toEqual({
      status: "compared",
      regressed: false,
      log: `${CHECKIN_LOG_PREFIX} outcome=compared regressed=false\n본문`,
    });
    expect(compare.mock.calls).toEqual([
      [arg.envMeta, DIR, arg.candidate, undefined],
    ]);
  });
  it("happy-path: skipped(disabled) 는 경로 없는 로그를 낸다", () => {
    expect(
      runCheckinBaselineCheck(input({ processEnv: flagEnv("0") }), okCompare()),
    ).toEqual({
      status: "skipped",
      reason: "disabled",
      log: `${CHECKIN_LOG_PREFIX} outcome=skipped reason=disabled`,
    });
  });
  it("happy-path: skipped(absent) 는 해석된 baseline 경로를 실은 로그를 낸다", () => {
    const result = runCheckinBaselineCheck(
      input({ exists: false }),
      okCompare(),
    );
    expect(result).toMatchObject({ status: "skipped", reason: "absent" });
    expect(result.log).toContain(`reason=absent path=${DIR}/`);
  });
  it.each([
    ["1", true, "compared"],
    ["1", false, "skipped"],
    [undefined, true, "skipped"],
    [undefined, false, "skipped"],
  ])("분기 cover: 토글 %j × exists=%j 는 status=%s", (flag, exists, status) => {
    const arg = input({
      processEnv: flagEnv(flag as string | undefined),
      exists: exists as boolean,
    });
    expect(runCheckinBaselineCheck(arg, okCompare()).status).toBe(status);
  });
  it.each([true, false])(
    "분기 cover: regressed=%j 를 그대로 싣고 throw 하지 않는다(exit code 불변)",
    (regressed) => {
      const result = runCheckinBaselineCheck(input(), okCompare(regressed));
      expect(result).toMatchObject({ status: "compared", regressed });
      expect(result.log).toContain(`regressed=${regressed}`);
    },
  );
  it("분기 cover: options 는 지정 시 4 번째 인자로 전달, 미지정 시 undefined", () => {
    const options = { latencyTolerance: 0.25 };
    const withOpt = okCompare();
    const without = okCompare();
    runCheckinBaselineCheck(input({ options }), withOpt);
    runCheckinBaselineCheck(input(), without);
    expect(withOpt.mock.calls[0][3]).toBe(options);
    expect(without.mock.calls[0][3]).toBeUndefined();
  });
  it.each([null, undefined, "compare", 7])(
    "error path: input 이 %j 면 TypeError",
    (v) =>
      expect(() => runCheckinBaselineCheck(bad(v), okCompare())).toThrow(
        TypeError,
      ),
  );
  it("error path: 판정 helper 의 TypeError · RangeError 가 그대로 전파된다", () => {
    const run = (over: Record<string, unknown>) => () =>
      runCheckinBaselineCheck(bad({ ...input(), ...over }), okCompare());
    expect(run({ processEnv: null })).toThrow(TypeError);
    expect(run({ envMeta: null })).toThrow(TypeError);
    expect(run({ exists: "true" })).toThrow(TypeError);
    expect(run({ repoRoot: "  " })).toThrow(RangeError);
    expect(run({ envMeta: meta("  ") })).toThrow(RangeError);
  });
  it("error path: 주입 compare 가 던진 예외(ENOENT 계열 · SyntaxError)는 래핑 없이 전파", () => {
    for (const error of [
      new Error("ENOENT: no file"),
      new SyntaxError("bad"),
    ]) {
      const compare: jest.Mock = jest.fn(() => {
        throw error;
      });
      expect(() => runCheckinBaselineCheck(input(), compare)).toThrow(error);
    }
  });
  it.each([null, undefined, 42, {}])(
    "error path: 비교 진입 확정 후 compare 가 %j 면 TypeError",
    (v) =>
      expect(() => runCheckinBaselineCheck(input(), badFn(v))).toThrow(
        TypeError,
      ),
  );
  it("negative: skip 두 국면은 compare 를 한 번도 호출하지 않고 무효 compare 도 허용", () => {
    const disabled = okCompare();
    const absent = okCompare();
    runCheckinBaselineCheck(input({ processEnv: flagEnv("false") }), disabled);
    runCheckinBaselineCheck(input({ exists: false }), absent);
    expect(disabled).not.toHaveBeenCalled();
    expect(absent).not.toHaveBeenCalled();
    expect(() =>
      runCheckinBaselineCheck(input({ exists: false }), badFn(null)),
    ).not.toThrow();
  });
  it("negative: 3 국면 status 에 write · establish 가 없고 log 는 모두 prefix 로 시작", () => {
    const results = [
      input(),
      input({ exists: false }),
      input({ processEnv: flagEnv() }),
    ].map((arg) => runCheckinBaselineCheck(arg, okCompare()));
    const statuses = results.map((r) => r.status);
    expect(statuses).toEqual(["compared", "skipped", "skipped"]);
    expect(statuses).not.toContain("written");
    expect(statuses).not.toContain("established");
    results.forEach((r) =>
      expect(r.log.startsWith(CHECKIN_LOG_PREFIX)).toBe(true),
    );
  });
  it("negative: 반복 호출이 같은 결과를 내고(결정성) 인자 객체를 변형하지 않는다", () => {
    const arg = input();
    const snapshot = JSON.stringify(arg);
    expect(runCheckinBaselineCheck(arg, okCompare())).toEqual(
      runCheckinBaselineCheck(arg, okCompare()),
    );
    expect(JSON.stringify(arg)).toBe(snapshot);
  });
  it("negative: 서로 다른 envMeta.label 은 absent 로그 경로를 다르게 만든다", () => {
    const logOf = (label: string) =>
      runCheckinBaselineCheck(
        input({ envMeta: meta(label), exists: false }),
        okCompare(),
      ).log;
    expect(logOf("ci-linux")).not.toBe(logOf("local-mac"));
  });
});

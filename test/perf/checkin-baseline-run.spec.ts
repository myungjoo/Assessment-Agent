import { CHECKIN_BASELINE_ENV_FLAG } from "./checkin-baseline-plan";
import {
  CHECKIN_LOG_PREFIX,
  formatCheckinCandidateLine,
} from "./checkin-baseline-report";
import {
  CheckinBaselineCompareFn,
  CheckinBaselineRunInput,
  CheckinBaselineRunOutcome,
  runCheckinBaselineCheck,
} from "./checkin-baseline-run";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import {
  BaselineComparison,
  BaselineEnvMeta,
  BaselineReport,
} from "./latency-baseline";

/**
 * T-1563 · T-1595 — 판정 → 비교 → 로그 조립 진입점의 R-112 spec(happy-path / error path / 분기 cover /
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
  /** candidate 픽스처 — `absent`(2 줄) · `compared`(3 줄) 국면이 마지막 줄로 전사한다. */
  const REPORT = {
    env: meta(),
    p50: 12,
    p95: 34.5,
    p99: 70,
    throughput: 210.25,
    errorRate: 0.02,
    count: 500,
    pass: true,
  } as unknown as BaselineReport;
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
  /**
   * `compared` 국면임을 단언하고 반환 · 판별 union 두 겹을 좁혀 돌려준다(캐스팅 없이 필드 접근).
   * 좁히기에 실패하면 그 자체가 계약 위반이므로 즉시 실패시킨다.
   */
  const comparedOf = (outcome: CheckinBaselineRunOutcome) => {
    if (outcome.status !== "compared") {
      throw new Error(`compared 국면이어야 함(실제 ${outcome.status})`);
    }
    const inner = outcome.confirmOrCompare;
    if (inner.outcome !== "compared") {
      throw new Error(`판별 union 이 compared 여야 함(실제 ${inner.outcome})`);
    }
    return { outcome, inner };
  };
  it("happy-path: compared 는 요약 줄 · 비교 본문 · candidate 줄을 순서대로 잇는다", () => {
    const compare = okCompare(false);
    const arg = input();
    const result = runCheckinBaselineCheck(arg, compare);
    expect(result).toEqual({
      status: "compared",
      regressed: false,
      log: `${CHECKIN_LOG_PREFIX} outcome=compared regressed=false\n본문\n${formatCheckinCandidateLine(REPORT)}`,
      // step 요약 포매터의 입력 통로 — 주입 비교 함수 반환을 판별 union 으로만 감싸 그대로 싣는다.
      confirmOrCompare: {
        outcome: "compared",
        comparison: comparison(false),
        report: "본문",
      },
    });
    // 3 번째 줄이 grep 축(prefix + candidate) 으로 시작해야 20 run 표본 축적이 성립한다.
    const lines = result.log.split("\n");
    expect(lines[2].startsWith(`${CHECKIN_LOG_PREFIX} candidate `)).toBe(true);
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
  it("happy-path: skipped(absent) 는 경로 줄 뒤에 candidate 줄을 이어 2 줄을 낸다", () => {
    const arg = input({ exists: false });
    const result = runCheckinBaselineCheck(arg, okCompare());
    expect(result).toMatchObject({ status: "skipped", reason: "absent" });
    const lines = result.log.split("\n");
    expect(lines).toHaveLength(2);
    // 기존 첫 줄의 prefix · 표기 · 순서 불변 — candidate 는 **뒤에** 붙는다.
    expect(lines[0]).toBe(
      `${CHECKIN_LOG_PREFIX} outcome=skipped reason=absent path=${DIR}/baseline-${arg.envMeta.label}.json`,
    );
    expect(lines[1]).toBe(formatCheckinCandidateLine(arg.candidate));
  });
  it("분기 cover: absent 의 candidate 줄은 표본 0 국면의 NaN 도 그대로 노출", () => {
    const zero = { ...REPORT, p50: NaN, throughput: 0, count: 0 };
    const log = runCheckinBaselineCheck(
      input({ exists: false, candidate: zero as unknown as BaselineReport }),
      okCompare(),
    ).log;
    const second = log.split("\n")[1];
    expect(second).toContain("p50=NaN");
    expect(second).toContain("throughput=0 ");
    expect(second).toContain("count=0");
  });
  it("negative: disabled 는 candidate 가 깨져 있어도 예외 0 · 로그 1 줄 불변", () => {
    const result = runCheckinBaselineCheck(
      input({
        processEnv: flagEnv("0"),
        candidate: { env: null } as unknown as BaselineReport,
      }),
      okCompare(),
    );
    expect(result.log).toBe(
      `${CHECKIN_LOG_PREFIX} outcome=skipped reason=disabled`,
    );
    expect(result.log).not.toContain("candidate");
  });
  it("negative: absent 는 compare 0 회 호출 · 반환 union 필드 구성이 불변", () => {
    const compare = okCompare();
    const arg = input({ exists: false });
    const snapshot = JSON.stringify(arg.candidate);
    const result = runCheckinBaselineCheck(arg, compare);
    expect(compare).toHaveBeenCalledTimes(0);
    expect(Object.keys(result).sort()).toEqual(["log", "reason", "status"]);
    expect(result).not.toHaveProperty("regressed");
    // 포매터가 candidate 객체를 변형하지 않는다.
    expect(JSON.stringify(arg.candidate)).toBe(snapshot);
  });
  it("error path: absent 국면의 형태 불량 candidate 는 포매터 예외로 전파된다", () => {
    const run = (candidate: unknown) => () =>
      runCheckinBaselineCheck(
        input({ exists: false, candidate: candidate as BaselineReport }),
        okCompare(),
      );
    expect(run(null)).toThrow(TypeError);
    expect(run({ ...REPORT, p95: "x" })).toThrow(TypeError);
    expect(run({ ...REPORT, env: { label: " ", concurrency: 1 } })).toThrow(
      RangeError,
    );
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
  it("분기 cover: 회귀(regressed=true) 에도 throw 0 · candidate 줄이 동일하게 붙는다", () => {
    const result = runCheckinBaselineCheck(input(), okCompare(true));
    expect(result).toEqual({
      status: "compared",
      regressed: true,
      log: `${CHECKIN_LOG_PREFIX} outcome=compared regressed=true\n본문\n${formatCheckinCandidateLine(REPORT)}`,
      confirmOrCompare: {
        outcome: "compared",
        comparison: comparison(true),
        report: "본문",
      },
    });
  });
  it("분기 cover: 줄 수 계약 — compared 는 3 줄(마지막이 candidate) · disabled 는 1 줄", () => {
    const compared = runCheckinBaselineCheck(input(), okCompare()).log.split(
      "\n",
    );
    expect(compared).toHaveLength(3);
    expect(compared[compared.length - 1]).toBe(
      formatCheckinCandidateLine(REPORT),
    );
    const disabled = runCheckinBaselineCheck(
      input({ processEnv: flagEnv("0") }),
      okCompare(),
    ).log.split("\n");
    expect(disabled).toHaveLength(1);
    expect(disabled[0]).not.toContain("candidate");
  });
  it("error path: compared 의 불량 candidate 예외는 비교 1 회 뒤 래핑 없이 전파", () => {
    const run = (candidate: unknown, compare: jest.Mock) => () =>
      runCheckinBaselineCheck(
        input({ candidate: candidate as BaselineReport }),
        compare,
      );
    // env.label 빈 문자열 → 포매터의 RangeError. 비교는 이미 1 회 끝난 시점이다.
    const blank = okCompare();
    expect(run({ ...REPORT, env: meta("") }, blank)).toThrow(RangeError);
    expect(blank).toHaveBeenCalledTimes(1);
    const nonNumber = okCompare();
    expect(run({ ...REPORT, p99: "x" }, nonNumber)).toThrow(TypeError);
    expect(nonNumber).toHaveBeenCalledTimes(1);
    const nullish = okCompare();
    expect(run(null, nullish)).toThrow(TypeError);
    expect(nullish).toHaveBeenCalledTimes(1);
  });
  it("negative: compared 의 candidate 줄도 표본 0 국면의 NaN 을 거르지 않고 전사", () => {
    const zero = { ...REPORT, p50: NaN, p95: NaN, p99: NaN, count: 0 };
    const log = runCheckinBaselineCheck(
      input({ candidate: zero as unknown as BaselineReport }),
      okCompare(),
    ).log;
    const last = log.split("\n")[2];
    expect(last).toContain("p50=NaN");
    expect(last).toContain("p95=NaN");
    expect(last).toContain("count=0");
  });
  it("happy-path: compared 는 주입 비교 반환을 판별 union 으로 감싸 confirmOrCompare 에 싣는다", () => {
    const compare = okCompare(false);
    const result = runCheckinBaselineCheck(input(), compare);
    // 비교는 정확히 1 회 — 그 1 회의 반환이 재가공 없이 그대로 실려야 한다(재계산 0).
    expect(compare).toHaveBeenCalledTimes(1);
    const returned = compare.mock.results[0].value as {
      comparison: BaselineComparison;
      report: string;
    };
    const { inner } = comparedOf(result);
    // 판별자 1 개 + 비교 반환 2 개 — 통로가 필드를 더 얹거나 덜어내지 않는다.
    expect(Object.keys(inner).sort()).toEqual([
      "comparison",
      "outcome",
      "report",
    ]);
    // 같은 참조 — 복사 · trim · 재포맷 · 반올림 어느 것도 하지 않았다는 증거.
    expect(inner.comparison).toBe(returned.comparison);
    expect(inner.report).toBe(returned.report);
  });
  it.each([true, false])(
    "분기 cover: regressed=%j 국면의 confirmOrCompare.comparison 이 반환 regressed 와 같은 출처",
    (regressed) => {
      const { outcome, inner } = comparedOf(
        runCheckinBaselineCheck(input(), okCompare(regressed)),
      );
      expect(inner.comparison.regressed).toBe(regressed);
      expect(outcome.regressed).toBe(inner.comparison.regressed);
    },
  );
  it.each([
    ["disabled", { processEnv: flagEnv("0") }],
    ["absent", { exists: false }],
  ])(
    "분기 cover: skipped(%s) 반환에는 confirmOrCompare 키가 없다",
    (_, over) => {
      const result = runCheckinBaselineCheck(
        input(over as Partial<CheckinBaselineRunInput>),
        okCompare(),
      );
      expect(result).not.toHaveProperty("confirmOrCompare");
      expect(Object.keys(result).sort()).toEqual(["log", "reason", "status"]);
    },
  );
  it("negative: confirmOrCompare.report 는 공백 · 개행 · 백틱을 거르지 않고 원문 그대로", () => {
    // 요약 포매터가 울타리 길이를 스스로 정하므로, 통로에서 본문을 다듬으면 그 판단이 깨진다.
    const raw = "  머리 공백\n```중간 백틱```\n꼬리 공백  ";
    const compare: jest.Mock = jest.fn(() => ({
      comparison: comparison(false),
      report: raw,
    }));
    const { outcome, inner } = comparedOf(
      runCheckinBaselineCheck(input(), compare),
    );
    expect(inner.report).toBe(raw);
    // 같은 원문이 로그에도 그대로 실린다(두 축이 한 값에서 갈라져 나온다).
    expect(outcome.log).toContain(raw);
  });
  it("negative: 같은 입력 2 회 호출의 confirmOrCompare 가 동일(결정성)", () => {
    const arg = input();
    const snapshot = JSON.stringify(arg);
    const first = runCheckinBaselineCheck(arg, okCompare(true));
    const second = runCheckinBaselineCheck(arg, okCompare(true));
    expect(first).toEqual(second);
    expect(JSON.stringify(arg)).toBe(snapshot);
  });
  it("error path: 빈/공백-only report 는 포매터 RangeError 로 전파되고 반환값이 없다", () => {
    for (const report of ["", "   ", "\n\t"]) {
      const compare: jest.Mock = jest.fn(() => ({
        comparison: comparison(false),
        report,
      }));
      // 비교는 이미 1 회 끝난 시점 — 그래도 조립 결과는 호출측에 도달하지 않는다.
      expect(() => runCheckinBaselineCheck(input(), compare)).toThrow(
        RangeError,
      );
      expect(compare).toHaveBeenCalledTimes(1);
    }
  });
  it("error path: 비교 반환 형태 불량(report non-string · comparison 결손)은 TypeError 로 전파", () => {
    const run = (value: unknown) => () =>
      runCheckinBaselineCheck(
        input(),
        jest.fn(() => value) as unknown as CheckinBaselineCompareFn,
      );
    expect(run({ comparison: comparison(false), report: 7 })).toThrow(
      TypeError,
    );
    expect(run({ comparison: null, report: "본문" })).toThrow(TypeError);
    expect(run({ comparison: { regressed: "yes" }, report: "본문" })).toThrow(
      TypeError,
    );
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

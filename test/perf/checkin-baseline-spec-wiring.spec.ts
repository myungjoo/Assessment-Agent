import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as adapter from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX as PREFIX } from "./checkin-baseline-report";
import {
  CheckinBaselineSpecWiringInput,
  CheckinStepSummarySinkDeps,
  checkCheckinBaselineForSpec as check,
  defaultStepSummarySinkDeps as defaultDeps,
  emitCheckinStepSummaryForSpec as emitForSpec,
  seedCheckinBaselineFixture as seed,
} from "./checkin-baseline-spec-wiring";
import { formatCheckinStepSummaryBlock } from "./checkin-baseline-step-summary";
import * as emitModule from "./checkin-baseline-step-summary-emit";
import { GITHUB_STEP_SUMMARY_ENV as SUMMARY_ENV } from "./checkin-baseline-step-summary-sink";
import {
  resolveCheckinBaselineDir,
  resolveCheckinBaselinePath,
} from "./checkin-baseline-store";
import { BaselineReport, parseBaselineReport } from "./latency-baseline";
import * as baselineIo from "./latency-baseline-io";

/**
 * T-1566 — 배선 관용구 helper 의 R-112 spec(happy / error / 분기 / negative). fs 국면은 임시
 * repo root 로 격리하고 전역 토글은 국면마다 저장 · 원복한다(부작용 0).
 */
describe("checkin-baseline-spec-wiring — 배선 관용구 (ADR-0056 §Follow-ups (b))", () => {
  const meta = (label = "ci-linux") => ({ label, concurrency: 4 });
  const report = (p50 = 10): BaselineReport => ({
    env: meta(),
    p50,
    p95: 20,
    p99: 30,
    throughput: 100,
    errorRate: 0,
    count: 50,
    pass: true,
  });
  // 비교 결과 mock — 조립 진입점 · 포매터가 보는 필드만 담는다(호출 횟수 관찰용).
  const okCompare = (regressed = false): jest.Mock =>
    jest.fn(() => ({ comparison: { regressed }, report: "본문" }));
  const flag0 = process.env[FLAG];
  let repoRoot: string; // 임시 repo root — 파일은 이 아래에서만 만든다
  let log: jest.Mock;
  const input = (
    over: Partial<CheckinBaselineSpecWiringInput> = {},
  ): CheckinBaselineSpecWiringInput => ({
    envMeta: meta(),
    candidate: report(),
    repoRoot,
    processEnv: { [FLAG]: "1" },
    compare: okCompare(),
    log,
    ...over,
  });
  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wiring-"));
    log = jest.fn();
    delete process.env[FLAG];
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (flag0 === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = flag0;
    }
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("happy: 토글 off 기본 상태는 skipped/disabled 이고 로거가 log 원문으로 1 회 호출", () => {
    const outcome = check(
      input({ processEnv: undefined, repoRoot: undefined }),
    );
    expect(outcome).toMatchObject({ status: "skipped", reason: "disabled" });
    expect(log.mock.calls).toEqual([[outcome.log]]);
    expect(outcome.log.startsWith(PREFIX)).toBe(true);
  });

  it("happy: seed 는 helper 경로에 쓰고 내용이 round-trip 파싱된다", () => {
    const written = report(12);
    const target = seed(meta(), repoRoot, written);
    expect(target).toBe(resolveCheckinBaselinePath(meta(), repoRoot));
    expect(path.resolve(target).startsWith(path.resolve(repoRoot))).toBe(true);
    const parsed = parseBaselineReport(fs.readFileSync(target, "utf-8"));
    expect(parsed).toEqual(written);
  });

  it("error: 위임 예외(RangeError · TypeError)가 래핑 없이 전파되고 로거 0 회", () => {
    const bad = { envMeta: { label: "", concurrency: 1 } };
    expect(() => check(input(bad))).toThrow(RangeError);
    expect(() =>
      check(null as unknown as CheckinBaselineSpecWiringInput),
    ).toThrow(TypeError);
    expect(log).not.toHaveBeenCalled();
  });

  it("error: seed 의 실경로 가드는 RangeError 이고 실 baselines 목록 불변", () => {
    const real = adapter.defaultCheckinRepoRoot();
    const dir = resolveCheckinBaselineDir(real);
    const snap = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null);
    const before = snap();
    expect(() => seed(meta(), real, report())).toThrow(RangeError);
    // 정규화 후 같은 위치가 되는 형태도 동일하게 막힌다(호출 전후 목록 동일 = write 0 회).
    expect(() => seed(meta(), path.join(real, "test", ".."), report())).toThrow(
      RangeError,
    );
    expect(snap()).toEqual(before);
  });

  it("분기: log 미지정이면 호출 시점의 console.log 로 1 회 출력한다", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const outcome = check(
      input({ log: undefined, processEnv: undefined, repoRoot: undefined }),
    );
    expect(spy.mock.calls).toEqual([[outcome.log]]);
    expect(log).not.toHaveBeenCalled();
  });

  it("분기: 토글 on × baseline 부재는 skipped/absent 이며 비교 함수 미호출", () => {
    const compare = okCompare();
    const outcome = check(input({ compare }));
    expect(outcome).toMatchObject({ status: "skipped", reason: "absent" });
    expect(compare).not.toHaveBeenCalled();
    expect(outcome.log).toContain(resolveCheckinBaselinePath(meta(), repoRoot));
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("분기: 토글 on × 임시 baseline 존재는 compared + regressed boolean", () => {
    seed(meta(), repoRoot, report());
    // compare 미지정 — 기본 비교 함수가 방금 심은 파일을 읽는다(동일 지표 → 무회귀 결정론).
    const outcome = check(input({ compare: undefined }));
    expect(outcome).toMatchObject({ status: "compared", regressed: false });
    expect(outcome.status === "compared" && typeof outcome.regressed).toBe(
      "boolean",
    );
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("negative: log 가 non-function 이면 TypeError 이고 위임 호출 0 회", () => {
    const spy = jest.spyOn(adapter, "runCheckinBaselineCheckWithDefaults");
    const arg = input({ log: 123 as unknown as () => void });
    expect(() => check(arg)).toThrow(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("negative: regressed=true 국면도 throw 0 — outcome 만 반환(exit code 불변)", () => {
    seed(meta(), repoRoot, report());
    const outcome = check(input({ compare: okCompare(true) }));
    expect(outcome).toMatchObject({ status: "compared", regressed: true });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("negative: 토글 off 국면은 baselineFileExists 위임이 0 회(부작용 0)", () => {
    const spy = jest.spyOn(baselineIo, "baselineFileExists");
    const outcome = check(input({ processEnv: {} }));
    expect(spy).not.toHaveBeenCalled();
    expect(outcome.status).toBe("skipped");
  });

  it("negative: input · envMeta · report 를 변형하지 않는다(호출 전후 deep-equal)", () => {
    const envMeta = meta();
    const candidate = report();
    const arg = input({ envMeta, candidate });
    const before = JSON.stringify([arg, envMeta, candidate]);
    check(arg);
    const seeded = report(9);
    const seedBefore = JSON.stringify(seeded);
    seed(envMeta, repoRoot, seeded);
    expect(JSON.stringify([arg, envMeta, candidate])).toBe(before);
    expect(JSON.stringify(seeded)).toBe(seedBefore);
    expect(envMeta).toEqual(meta());
  });
});

/**
 * T-1615 — step 요약 기본 주입값 결선의 R-112 spec(happy / error / 분기 / negative 충분 cover).
 * 주입 갈래는 가짜 record + mock append 로, 기본 바인딩 갈래는 임시 디렉토리 실파일 + 전역 env
 * 저장 · 원복으로 검증한다(부작용 0 · exit code 불변).
 */
describe("emitCheckinStepSummaryForSpec — 요약 기본 주입값 결선 (ADR-0056 §Decision 3 (b))", () => {
  const TITLE = "체크인 baseline 요약";
  type Env = Record<string, string | undefined>;
  /** 비교 판별 union 팩토리 — 포매터 입력이자 실행 결과의 `confirmOrCompare` 값. */
  const cmp = (regressed = false, report = "상세 본문 ` 줄1\n줄2") =>
    ({ outcome: "compared", comparison: { regressed }, report }) as never;
  /** 비교 국면 실행 결과 팩토리. */
  const compared = (regressed = false, over: Record<string, unknown> = {}) =>
    ({
      status: "compared",
      regressed,
      log: `${PREFIX} outcome=compared regressed=${regressed}`,
      confirmOrCompare: cmp(regressed),
      ...over,
    }) as never;
  /** 단락 국면 실행 결과 팩토리(비교가 없었으므로 `confirmOrCompare` 자체가 없다). */
  const skippedOutcome = () =>
    ({
      status: "skipped",
      reason: "absent",
      log: `${PREFIX} outcome=skipped reason=absent`,
    }) as never;
  /** 가짜 환경변수 record + 호출 관찰용 mock append 주입 묶음. */
  const injected = (over: Partial<CheckinStepSummarySinkDeps> = {}) =>
    ({
      processEnv: { [SUMMARY_ENV]: summaryPath },
      append: jest.fn(),
      ...over,
    }) as CheckinStepSummarySinkDeps & { append: jest.Mock };
  const bad = <T>(v: unknown): T => v as T;
  const env0 = process.env[SUMMARY_ENV];
  let tmpDir: string;
  let summaryPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "step-summary-"));
    summaryPath = path.join(tmpDir, "summary.md");
    delete process.env[SUMMARY_ENV];
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (env0 === undefined) {
      delete process.env[SUMMARY_ENV];
    } else {
      process.env[SUMMARY_ENV] = env0;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("happy: 주입 deps + compared 는 appended 를 내고 요약 블록이 정확히 1 회 기록된다", () => {
    const deps = injected({
      append: jest.fn((target: string, data: string) =>
        fs.appendFileSync(target, data, { encoding: "utf-8" }),
      ),
    });
    expect(emitForSpec(compared(), TITLE, deps)).toEqual({
      status: "appended",
      path: summaryPath,
    });
    const written = fs.readFileSync(summaryPath, "utf-8");
    expect(written).toBe(`${formatCheckinStepSummaryBlock(cmp(), TITLE)}\n`);
    expect(written.split(`## ${TITLE}`)).toHaveLength(2);
    expect(deps.append).toHaveBeenCalledTimes(1);
  });

  it("happy: 위임을 정확히 1 회 호출하고 반환을 가공 없이 그대로 낸다", () => {
    const spy = jest
      .spyOn(emitModule, "emitCheckinStepSummary")
      .mockReturnValue({ status: "failed", reason: "append-threw" });
    const deps = injected();
    expect(emitForSpec(compared(), TITLE, deps)).toEqual({
      status: "failed",
      reason: "append-threw",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(compared(), TITLE, deps);
  });

  it("error: 포매터가 던지는 형태 불량 입력은 failed/format-threw 이고 throw 0", () => {
    const deps = injected();
    const arg = compared(false, { confirmOrCompare: bad({ outcome: 42 }) });
    expect(() => emitForSpec(arg, TITLE, deps)).not.toThrow();
    expect(emitForSpec(arg, TITLE, deps)).toEqual({
      status: "failed",
      reason: "format-threw",
    });
    expect(deps.append).not.toHaveBeenCalled();
  });

  it("error: append 가 던지는 국면은 failed/append-threw 이고 throw 0", () => {
    const deps = injected({
      append: jest.fn(() => {
        throw new Error("디스크 실패");
      }),
    });
    expect(emitForSpec(compared(), TITLE, deps)).toEqual({
      status: "failed",
      reason: "append-threw",
    });
    expect(deps.append).toHaveBeenCalledTimes(1);
  });

  it("분기: deps 미지정 기본 바인딩은 호출 시점 env 를 읽어 실제 파일에 기록한다", () => {
    process.env[SUMMARY_ENV] = summaryPath; // 기본값 결선이 호출 시점에 조회하는지 확인
    expect(emitForSpec(compared(), TITLE)).toEqual({
      status: "appended",
      path: summaryPath,
    });
    expect(fs.readFileSync(summaryPath, "utf-8")).toBe(
      `${formatCheckinStepSummaryBlock(cmp(), TITLE)}\n`,
    );
  });

  it("분기: 기본 바인딩 × 환경변수 부재는 skipped/env-absent 이고 파일 생성 0", () => {
    expect(emitForSpec(compared(), TITLE)).toEqual({
      status: "skipped",
      reason: "env-absent",
    });
    expect(fs.existsSync(summaryPath)).toBe(false);
  });

  it("분기: 기본 바인딩 × 빈-공백 환경변수는 skipped/env-blank", () => {
    process.env[SUMMARY_ENV] = "   ";
    expect(emitForSpec(compared(), TITLE)).toEqual({
      status: "skipped",
      reason: "env-blank",
    });
    expect(fs.existsSync(summaryPath)).toBe(false);
  });

  it("분기: 비-compared 는 skipped/not-compared 이고 주입 append 가 0 회", () => {
    const deps = injected();
    expect(emitForSpec(skippedOutcome(), TITLE, deps)).toEqual({
      status: "skipped",
      reason: "not-compared",
    });
    expect(deps.append).not.toHaveBeenCalled();
  });

  it("분기: defaultStepSummarySinkDeps 는 호출 시점 process.env 를 싣는다", () => {
    process.env[SUMMARY_ENV] = summaryPath;
    const deps = defaultDeps();
    expect((deps.processEnv as Env)[SUMMARY_ENV]).toBe(summaryPath);
    process.env[SUMMARY_ENV] = `${summaryPath}.2`;
    expect((defaultDeps().processEnv as Env)[SUMMARY_ENV]).toBe(
      `${summaryPath}.2`,
    );
    // append 는 utf-8 바인딩 — 대상 파일에 원문 그대로 붙는다.
    deps.append(summaryPath, "한 줄\n");
    deps.append(summaryPath, "두 줄\n");
    expect(fs.readFileSync(summaryPath, "utf-8")).toBe("한 줄\n두 줄\n");
  });

  it("negative: outcome 이 null · undefined 면 TypeError 가 전파된다", () => {
    const deps = injected();
    expect(() => emitForSpec(bad(null), TITLE, deps)).toThrow(TypeError);
    expect(() => emitForSpec(bad(undefined), TITLE, deps)).toThrow(TypeError);
    expect(deps.append).not.toHaveBeenCalled();
  });

  it("negative: sectionTitle 이 non-string 이면 TypeError 가 전파된다", () => {
    expect(() => emitForSpec(compared(), bad(42), injected())).toThrow(
      TypeError,
    );
  });

  it("negative: sectionTitle 이 빈/공백-only 면 RangeError 가 전파된다", () => {
    expect(() => emitForSpec(compared(), "", injected())).toThrow(RangeError);
    expect(() => emitForSpec(compared(), "  \t ", injected())).toThrow(
      RangeError,
    );
  });

  it("negative: deps 가 지정됐으나 null 이면 기본값으로 흡수하지 않고 TypeError", () => {
    expect(() => emitForSpec(compared(), TITLE, bad(null))).toThrow(TypeError);
  });

  it("negative: deps.append 가 non-function 이면 TypeError 가 전파된다", () => {
    expect(() =>
      emitForSpec(compared(), TITLE, injected({ append: bad("nope") })),
    ).toThrow(TypeError);
  });

  it("negative: 인자(outcome · deps) 를 호출 전후로 변형하지 않는다(순수성)", () => {
    const outcome = compared();
    const processEnv: Env = { [SUMMARY_ENV]: summaryPath, OTHER: "값" };
    const deps = injected({ processEnv });
    const before = JSON.stringify([outcome, processEnv]);
    emitForSpec(outcome, TITLE, deps);
    expect(JSON.stringify([outcome, processEnv])).toBe(before);
    expect(Object.keys(deps)).toEqual(["processEnv", "append"]);
  });
});

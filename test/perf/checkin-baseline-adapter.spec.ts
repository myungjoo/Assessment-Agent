import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  CheckinBaselineDefaultsInput,
  defaultCheckinRepoRoot,
  resolveRepoRootFromPerfDir as fromPerfDir,
  runCheckinBaselineCheckWithDefaults as run,
} from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX as PREFIX } from "./checkin-baseline-report";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import {
  BaselineReport,
  resolveBaselinePath,
  serializeBaselineReport,
} from "./latency-baseline";

/**
 * T-1564 — 기본값 바인딩 어댑터의 R-112 spec(happy / error / 분기 / negative). fs 국면은 임시
 * repo root 로 격리하고 전역 환경변수 · cwd 는 매 케이스 원복한다(부작용 0).
 */
describe("checkin-baseline-adapter — 기본값 결선 (ADR-0056 §Follow-ups (b))", () => {
  const meta = (label = "ci-linux") => ({ label, concurrency: 4 });
  const nums = { p50: 10, p95: 20, p99: 30, throughput: 100, errorRate: 0 };
  const rest = { count: 50, pass: true };
  const report = (): BaselineReport => ({ env: meta(), ...nums, ...rest });
  // 비교 결과 mock — 조립 진입점 · 포매터가 보는 필드만 담는다(호출 인자 · 횟수 관찰용).
  const okCompare = (regressed = false): jest.Mock =>
    jest.fn(() => ({ comparison: { regressed }, report: "본문" }));
  const env = (value?: string): Record<string, string | undefined> =>
    value === undefined ? {} : { [FLAG]: value };
  // 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용).
  const bad = (v: unknown): CheckinBaselineDefaultsInput =>
    v as CheckinBaselineDefaultsInput;
  let hasFile: string; // baseline 파일이 있는 임시 repo root
  let noFile: string; // baseline 파일이 없는 임시 repo root
  const flag0 = process.env[FLAG];
  const cwd0 = process.cwd();
  const input = (over: Partial<CheckinBaselineDefaultsInput> = {}) => ({
    envMeta: meta(),
    candidate: report(),
    processEnv: env("1"),
    repoRoot: hasFile,
    compare: okCompare(),
    ...over,
  });
  beforeEach(() => {
    hasFile = fs.mkdtempSync(path.join(os.tmpdir(), "checkin-has-"));
    noFile = fs.mkdtempSync(path.join(os.tmpdir(), "checkin-no-"));
    const dir = resolveCheckinBaselineDir(hasFile);
    fs.mkdirSync(dir, { recursive: true });
    const json = serializeBaselineReport(report());
    fs.writeFileSync(resolveBaselinePath(meta(), dir), json, "utf-8");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.chdir(cwd0);
    if (flag0 === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = flag0;
    }
    fs.rmSync(hasFile, { recursive: true, force: true });
    fs.rmSync(noFile, { recursive: true, force: true });
  });
  it("happy: 토글 on + 파일 존재는 compared(regressed=true) 를 throw 없이 낸다", () => {
    const compare = okCompare(true);
    const options = { latencyTolerance: 0.25 };
    const arg = input({ compare, options });
    const res = run(arg);
    expect(res).toMatchObject({ status: "compared", regressed: true });
    expect(res.log.startsWith(PREFIX)).toBe(true);
    // options 지정 국면 — 4 번째 인자로 그대로 전달되고 호출은 정확히 1 회.
    const dir = resolveCheckinBaselineDir(hasFile);
    expect(compare.mock.calls).toEqual([
      [arg.envMeta, dir, arg.candidate, options],
    ]);
  });
  it("happy: 파일 부재는 absent, 토글 off 는 disabled 이며 비교 호출 0 회", () => {
    const c1 = okCompare();
    const c2 = okCompare();
    const absent = run(input({ repoRoot: noFile, compare: c1 }));
    const off = run(input({ processEnv: env("false"), compare: c2 }));
    expect(absent).toMatchObject({ status: "skipped", reason: "absent" });
    expect(off).toMatchObject({ status: "skipped", reason: "disabled" });
    expect([absent.log, off.log].every((l) => l.startsWith(PREFIX))).toBe(true);
    expect(c1).not.toHaveBeenCalled();
    expect(c2).not.toHaveBeenCalled();
  });
  it.each([
    ["1", true, "compared"],
    ["1", false, "skipped"],
    [undefined, true, "skipped"],
    [undefined, false, "skipped"],
  ])("분기: 토글 %j × 존재=%j → %s", (flag, exists, status) => {
    const processEnv = env(flag as string | undefined);
    const arg = input({ processEnv, repoRoot: exists ? hasFile : noFile });
    expect(run(arg).status).toBe(status);
  });
  it("분기: repoRoot 미지정은 cwd 가 아니라 모듈 위치 기준 절대 경로를 쓴다", () => {
    const root = defaultCheckinRepoRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(fs.existsSync(path.join(root, "test", "perf"))).toBe(true);
    const envMeta = meta("t-1564-absent-fixture");
    const res = run(input({ repoRoot: undefined, envMeta }));
    expect(res).toMatchObject({ status: "skipped", reason: "absent" });
    expect(res.log).toContain("test/perf/baselines");
    process.chdir(os.tmpdir());
    expect(defaultCheckinRepoRoot()).toBe(root);
  });
  it("분기: processEnv 미지정이면 전역 환경변수를 읽는다(종료 시 원복)", () => {
    process.env[FLAG] = "yes";
    const on = run(input({ processEnv: undefined, repoRoot: noFile }));
    process.env[FLAG] = "0";
    const off = run(input({ processEnv: undefined }));
    expect(on).toMatchObject({ reason: "absent" });
    expect(off).toMatchObject({ reason: "disabled" });
  });
  it("분기: compare 미지정이면 기본 비교 함수가 파일을 읽고 결과가 결정적이다", () => {
    const arg = input({ compare: undefined });
    const snapshot = JSON.stringify(arg);
    const res = run(arg);
    expect(res).toMatchObject({ status: "compared", regressed: false });
    expect(res.log).toContain("outcome=compared regressed=false");
    expect(run(arg)).toEqual(res); // 결정성 + 입력 불변(아래 snapshot 비교)
    expect(JSON.stringify(arg)).toBe(snapshot);
  });
  it.each([null, undefined, "run", 7])("error: input 이 %j 면 TypeError", (v) =>
    expect(() => run(bad(v))).toThrow(TypeError),
  );
  it("error: 위임 helper 예외(envMeta · repoRoot)가 래핑 없이 전파된다", () => {
    const call = (over: Record<string, unknown>) => () =>
      run(bad({ ...input(), ...over }));
    expect(call({ envMeta: null })).toThrow(TypeError);
    expect(call({ repoRoot: 42 })).toThrow(TypeError);
    expect(call({ envMeta: meta("  ") })).toThrow(RangeError);
    expect(call({ repoRoot: "" })).toThrow(RangeError);
  });
  it("error: 주입 compare 가 던진 예외(ENOENT 계열 · SyntaxError)는 래핑 없이 전파", () => {
    for (const e of [new Error("ENOENT: no file"), new SyntaxError("bad")]) {
      const compare = jest.fn(() => {
        throw e;
      });
      expect(() => run(input({ compare }))).toThrow(e);
    }
  });
  it("error: fromPerfDir 는 두 단계 상위를 내고 무효 입력을 거른다", () => {
    expect(fromPerfDir(path.join(cwd0, "test", "perf"))).toBe(cwd0);
    expect(() => fromPerfDir(7 as unknown as string)).toThrow(TypeError);
    expect(() => fromPerfDir("   ")).toThrow(RangeError);
  });
  it("negative: 토글 off 는 fs 조회 0 회, compared 는 비교 함수 정확히 1 회", () => {
    // 실 fs 모듈 객체에 spy — 위임 모듈의 namespace getter 가 이 객체를 읽으므로 관측된다.
    const spy = jest.spyOn(jest.requireActual<typeof fs>("fs"), "existsSync");
    run(input({ processEnv: env() }));
    expect(spy).not.toHaveBeenCalled();
    const compare = okCompare();
    run(input({ compare })); // options 미지정 국면 — 4 번째 인자 undefined
    expect(compare.mock.calls[0][3]).toBeUndefined();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("negative: 어떤 국면에서도 baseline 파일 · 디렉토리가 생성되지 않는다", () => {
    const snap = (root: string): string => {
      const dir = resolveCheckinBaselineDir(root);
      return fs.existsSync(dir) ? fs.readdirSync(dir).join(",") : "(부재)";
    };
    const roots = [noFile, hasFile, defaultCheckinRepoRoot()];
    const before = roots.map(snap);
    [
      input(),
      input({ repoRoot: noFile }),
      input({ processEnv: env() }),
      input({ repoRoot: undefined, envMeta: meta("t-1564-absent-fixture") }),
    ].forEach((arg) => run(arg));
    expect(roots.map(snap)).toEqual(before);
  });
});

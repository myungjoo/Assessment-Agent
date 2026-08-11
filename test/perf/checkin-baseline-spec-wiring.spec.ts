import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as adapter from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX as PREFIX } from "./checkin-baseline-report";
import {
  CheckinBaselineSpecWiringInput,
  checkCheckinBaselineForSpec as check,
  seedCheckinBaselineFixture as seed,
} from "./checkin-baseline-spec-wiring";
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

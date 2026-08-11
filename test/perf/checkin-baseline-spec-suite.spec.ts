import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { defaultCheckinRepoRoot } from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import {
  CheckinBaselineWiringSuiteOptions as Options,
  registerCheckinBaselineWiringSuite as register,
} from "./checkin-baseline-spec-suite";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import { BaselineReport } from "./latency-baseline";
import * as baselineIo from "./latency-baseline-io";

/**
 * T-1568 — 배선 suite factory 의 R-112 spec. 합성 리포트 · 임시 디렉토리만 쓰고(HTTP · 시계
 * 무의존) 등록 국면은 jest 전역을 mock 으로 갈아끼워 포착한 뒤 직접 실행해 관찰한다. 아래
 * module scope 실등록이 국면 7 개를 실제로 통과시킨다(happy).
 */

const meta = { label: "suite-factory", concurrency: 2 };
const FIXED = { throughput: 100, errorRate: 0, count: 20, pass: true };
const tmpDirs: string[] = [];
/** 측정 stub — 같은 ms 에 늘 같은 리포트(결정론). */
const measure = (ms: number): Promise<BaselineReport> =>
  Promise.resolve({ env: meta, p50: ms, p95: ms * 2, p99: ms * 3, ...FIXED });
const tempDir = (name: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `suite-${name}-`));
  tmpDirs.push(dir);
  return dir;
};
const base = { envMeta: meta, measure, tempDir };
const opts = (over: Partial<Options> = {}): Options => ({ ...base, ...over });

const realLabels = register(opts({ title: "T-1568 실등록" }));

const rm = (d: string) => fs.rmSync(d, { recursive: true, force: true });
afterAll(() => tmpDirs.splice(0).forEach(rm));

describe("checkin-baseline-spec-suite — 배선 suite factory (ADR-0056 §Follow-ups (b))", () => {
  type Phase = [string, () => Promise<unknown>];
  const KEYS = ["describe", "it", "beforeEach", "afterEach"];
  /** jest 전역 4 종을 mock 으로 교체해 등록 인자(제목 · 국면 · hook)를 포착하고 즉시 원복. */
  const capture = (arg: unknown) => {
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = KEYS.map((k) => g[k]);
    const its: Phase[] = [];
    const hooks: Array<() => void> = [];
    const titles: string[] = [];
    g.describe = (name: string, body: () => void) => {
      titles.push(name);
      body();
    };
    g.it = (name: string, body: () => Promise<unknown>) =>
      its.push([name, body]);
    g.beforeEach = g.afterEach = (fn: () => void) => hooks.push(fn);
    let labels: string[] | null = null;
    let error: unknown = null;
    try {
      labels = register(arg as Options);
    } catch (thrown) {
      error = thrown;
    } finally {
      KEYS.forEach((k, i) => (g[k] = saved[i]));
    }
    return { labels, error, its, hooks, titles };
  };
  /** 등록 국면 1 개를 beforeEach → 국면 → afterEach 순서로 실행하고 반환을 넘긴다. */
  const runPhase = async (index: number, over: Partial<Options> = {}) => {
    const c = capture(opts(over));
    c.hooks[0]();
    try {
      return await c.its[index][1]();
    } finally {
      c.hooks[1]();
    }
  };

  it("happy: 유효 options 는 국면 label 7 개(happy 2 · error 2 · 분기 1 · negative 2) 반환", () => {
    expect(realLabels).toHaveLength(7);
    const n = (p: string) => realLabels.filter((l) => l.startsWith(p)).length;
    const kinds = [n("happy"), n("error"), n("분기"), n("negative")];
    expect(kinds.join()).toBe("2,2,1,2");
    expect(capture(opts()).labels).toEqual(realLabels); // 재호출도 동일 구성
  });

  it("happy: title 은 describe 제목에 포함되고 미지정 시 기본 제목이 쓰인다", () => {
    const head = (title?: string) => capture(opts({ title })).titles[0];
    expect(head("고유-제목")).toContain("고유-제목");
    expect(head(undefined)).toContain("체크인 baseline");
  });

  it.each([
    ["options undefined", undefined],
    ["options null", null],
    ["options 문자열", "opts"],
    ["measure non-function", { ...base, measure: 1 }],
    ["tempDir non-function", { ...base, tempDir: null }],
  ])("error: %s 는 TypeError 이고 describe · it 등록 0 회", (_l, arg) => {
    const c = capture(arg);
    expect(c.error).toBeInstanceOf(TypeError);
    expect([c.titles.length, c.its.length, c.labels]).toEqual([0, 0, null]);
  });

  it.each([
    ["분기 (a) 토글 off", 0, { status: "skipped", reason: "disabled" }],
    ["분기 (b) 토글 on × 부재", 2, { status: "skipped", reason: "absent" }],
    ["분기 (c) 토글 on × 존재", 1, { status: "compared", regressed: false }],
    ["negative (a) 회귀", 5, { status: "compared", regressed: true }],
  ])("등록 국면 %s 실행 → %p (throw 0)", async (_l, index, expected) => {
    expect(await runPhase(index as number)).toMatchObject(expected as object);
  });

  it("negative: 토글 off 국면은 baselineFileExists 위임이 0 회(부작용 0)", async () => {
    const spy = jest.spyOn(baselineIo, "baselineFileExists");
    for (const i of [0, 6]) await runPhase(i);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("negative: factory 호출만으로는 measure · tempDir 이 0 회(등록 ≠ 실행)", () => {
    const m = jest.fn(measure);
    const t = jest.fn(tempDir);
    expect(capture(opts({ measure: m, tempDir: t })).labels).toHaveLength(7);
    expect([m.mock.calls.length, t.mock.calls.length]).toEqual([0, 0]);
  });

  it("negative: 전 국면 통과 후에도 저장소 실경로 baselines 목록이 불변(오염 0)", async () => {
    const dir = resolveCheckinBaselineDir(defaultCheckinRepoRoot());
    const snap = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null);
    const before = snap();
    for (let i = 0; i < realLabels.length; i += 1) await runPhase(i);
    expect(snap()).toEqual(before);
  });

  it("negative: envMeta.label 빈 값 국면은 RangeError 전파 + 디렉토리 미생성", async () => {
    const bad = { envMeta: { label: "", concurrency: 1 } };
    await expect(runPhase(1, bad)).rejects.toThrow(RangeError);
    const created = tmpDirs[tmpDirs.length - 1];
    expect(fs.existsSync(resolveCheckinBaselineDir(created))).toBe(false);
  });

  it("전역 토글은 등록 hook 이 저장 · 원복 — 국면 실행 후 원값이 보존된다", async () => {
    const original = process.env[FLAG];
    process.env[FLAG] = "sentinel";
    await runPhase(1); // 토글을 켜는 국면(beforeEach → 국면 → afterEach)
    expect(process.env[FLAG]).toBe("sentinel");
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });
});

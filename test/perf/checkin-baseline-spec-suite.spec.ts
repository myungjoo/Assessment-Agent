import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { defaultCheckinRepoRoot } from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import {
  CheckinBaselineWiringSuiteOptions as Options,
  registerCheckinBaselineWiringSuite as register,
} from "./checkin-baseline-spec-suite";
import {
  resolveCheckinBaselineDir,
  resolveCheckinBaselinePath,
} from "./checkin-baseline-store";
import { BaselineReport } from "./latency-baseline";
import * as baselineIo from "./latency-baseline-io";

/**
 * T-1568 — 배선 suite factory 의 R-112 spec. 합성 리포트 · 임시 디렉토리만 쓰고(HTTP · 시계
 * 무의존) 등록 국면은 jest 전역을 mock 으로 갈아끼워 포착한 뒤 직접 실행해 관찰한다. 아래
 * module scope 실등록이 국면 10 개(T-1573 기본 바인딩 3 개 포함)를 실제로 통과시킨다(happy).
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

/** 기본 바인딩 국면이 실제로 보는 저장소 실경로 디렉토리와 목록 스냅샷(미존재는 `null`). */
const realDir = (): string =>
  resolveCheckinBaselineDir(defaultCheckinRepoRoot());
const realSnap = (): string[] | null =>
  fs.existsSync(realDir()) ? fs.readdirSync(realDir()).sort() : null;
/** T-1573 승격 국면(기본 바인딩) 의 등록 인덱스 — 기존 0~6 뒤에 append 된다. */
const REAL = { happy: 7, branch: 8, negative: 9 };

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

  it("happy: 유효 options 는 국면 label 10 개(happy 3 · error 2 · 분기 2 · negative 3) 반환", () => {
    expect(realLabels).toHaveLength(10);
    const n = (p: string) => realLabels.filter((l) => l.startsWith(p)).length;
    const kinds = [n("happy"), n("error"), n("분기"), n("negative")];
    expect(kinds.join()).toBe("3,2,2,3");
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
    expect(capture(opts({ measure: m, tempDir: t })).labels).toHaveLength(10);
    expect([m.mock.calls.length, t.mock.calls.length]).toEqual([0, 0]);
  });

  it("negative: 전 국면 통과 후에도 저장소 실경로 baselines 목록이 불변(오염 0)", async () => {
    const dir = resolveCheckinBaselineDir(defaultCheckinRepoRoot());
    const snap = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null);
    const before = snap();
    for (let i = 0; i < realLabels.length; i += 1) await runPhase(i);
    expect(snap()).toEqual(before);
  });

  it("happy: 기본 바인딩 국면은 실행 시점 파일 존재 여부대로 status 를 낸다(하드코딩 0)", async () => {
    const target = resolveCheckinBaselinePath(meta, defaultCheckinRepoRoot());
    const expected = fs.existsSync(target)
      ? { status: "compared" }
      : { status: "skipped", reason: "absent" };
    expect(await runPhase(REAL.happy)).toMatchObject(expected);
  });

  it("분기: 기본 바인딩 국면은 baselineFileExists 를 토글 on 1 회(실경로) · off 0 회 위임", async () => {
    // 국면 안의 `jest.spyOn` 은 이미 mock 인 속성을 그대로 돌려주므로(호출 기록은 국면이
    // clear · restore 한다) 위임 인자는 별도 배열로 받는다. 원 함수 call-through 유지.
    const real = baselineIo.baselineFileExists;
    const calls: Array<[unknown, unknown]> = [];
    const spy = jest.spyOn(baselineIo, "baselineFileExists");
    spy.mockImplementation((env, dir) => {
      calls.push([env, dir]);
      return real(env, dir);
    });
    // 국면은 on → off 순으로 태우므로 누적 1 회가 곧 on 1 · off 0 이다(반환은 off 쪽 결과).
    const off = await runPhase(REAL.branch);
    expect(calls).toEqual([[meta, realDir()]]);
    expect(off).toMatchObject({ status: "skipped", reason: "disabled" });
    spy.mockRestore();
  });

  it("negative: 기본 바인딩 연속 호출 국면 후에도 실경로 목록 · 디렉토리 존재가 불변", async () => {
    const before = realSnap();
    expect(await runPhase(REAL.negative)).toHaveLength(3);
    expect(realSnap()).toEqual(before);
    expect(fs.existsSync(realDir())).toBe(before !== null);
  });

  it("error: 기본 바인딩 국면도 envMeta.label 빈 값이면 RangeError 전파 + 실경로 불변", async () => {
    const before = realSnap();
    const bad = { envMeta: { label: "", concurrency: 1 } };
    await expect(runPhase(REAL.happy, bad)).rejects.toThrow(RangeError);
    expect(realSnap()).toEqual(before);
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

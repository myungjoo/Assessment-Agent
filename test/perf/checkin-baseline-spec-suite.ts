/**
 * 체크인(repo 안 commit) baseline 확인 배선의 **jest 국면 공유 suite factory**
 * (REQ-048, ADR-0056 §Decision 2 · §Decision 3 (b) · §Follow-ups (b)).
 *
 * spec 마다 달라지는 부분(`envMeta` · 측정 · 임시 디렉토리)만 주입받아 국면 배선 복제를 멈춘다
 * (T-1567 실측 spec 당 +197 LOC → 소비자 추가분 ~10 LOC). **판정 · 경로 · 로그 · seed 재구현
 * 0** — 전량 helper 위임이라 계약 · 예외는 `checkin-baseline-spec-wiring` ·
 * `checkin-baseline-store` JSDoc 을 따른다(위임 예외는 래핑 없이 전파). 본 모듈 책임은 jest
 * 국면 등록과 등록 시점 인자 형태 검사 둘뿐 — 토글 off 기본 상태에서 `fs` 조회 0 · write 0 ·
 * **exit code 불변**(회귀에도 throw 0), **등록 ≠ 실행**(`measure` · `tempDir` 은 등록 시점
 * 0 회 호출), runtime export 는 함수 1 개(options interface 는 타입 전용).
 */

import * as fs from "fs";

import { defaultCheckinRepoRoot } from "./checkin-baseline-adapter";
import { CHECKIN_BASELINE_ENV_FLAG as FLAG } from "./checkin-baseline-plan";
import { CHECKIN_LOG_PREFIX } from "./checkin-baseline-report";
import {
  CheckinBaselineSpecWiringInput,
  checkCheckinBaselineForSpec as check,
  seedCheckinBaselineFixture as seed,
} from "./checkin-baseline-spec-wiring";
import {
  resolveCheckinBaselineDir,
  resolveCheckinBaselinePath,
} from "./checkin-baseline-store";
import { BaselineEnvMeta, BaselineReport } from "./latency-baseline";
import * as baselineIo from "./latency-baseline-io";

/** 등록 입력 — **spec 고유분만**. `measure(ms)` 는 결정론적(비교 국면이 무회귀 단언) ·
 * `tempDir(name)` 는 저장소 밖 임시 디렉토리 · `title` 은 describe 제목 접두. */
export interface CheckinBaselineWiringSuiteOptions {
  envMeta: BaselineEnvMeta;
  measure: (stepMs: number) => Promise<BaselineReport> | BaselineReport;
  tempDir: (name: string) => string;
  title?: string;
}

const FN = "registerCheckinBaselineWiringSuite";

/**
 * 국면 **10 개**(happy 3 · error 2 · 분기 2 · negative 3)를 `describe` 1 개로 등록하고 label
 * 배열을 반환한다(spec 고유 통합 국면은 각 spec 에 남긴다). 뒤 3 개(T-1573)는 `repoRoot` 를
 * **생략**해 어댑터 기본 바인딩(저장소 실경로)을 그대로 타는 국면이라 소비자 4 spec 전부가 같은
 * seam 을 통과한다. 전역 토글은 등록하는 `beforeEach` / `afterEach` 안에서 저장 · 원복해
 * **누출 0**. `options` 형태 검사는 jest 전역을 건드리기 **전에** 해 무효 인자 국면의
 * `describe` · `it` 호출을 0 회로 둔다.
 *
 * @throws {TypeError} `options` non-object(`null` 포함) · `measure` · `tempDir` non-function
 *   일 때. `envMeta` 형태는 helper 계약에 맡긴다(중복 throw 금지).
 */
export function registerCheckinBaselineWiringSuite(
  options: CheckinBaselineWiringSuiteOptions,
): string[] {
  if (typeof options !== "object" || options === null) {
    throw new TypeError(`${FN}: options 는 object 이어야 함(null 불가)`);
  }
  (["measure", "tempDir"] as const).forEach((key) => {
    if (typeof options[key] !== "function") {
      throw new TypeError(`${FN}: options.${key} 는 function 이어야 함`);
    }
  });

  const { envMeta, measure, tempDir } = options;
  let repoRoot = ""; // 임시 repo root — baseline 파일은 이 아래에만 만든다(무오염)
  let savedFlag: string | undefined;
  const realDir = () => resolveCheckinBaselineDir(defaultCheckinRepoRoot());
  const snap = () =>
    fs.existsSync(realDir()) ? fs.readdirSync(realDir()).sort() : null;
  /** 국면 공통 호출 — 측정 1 회 후 helper 위임(임시 repoRoot 기본, override 가능). */
  const call = async (
    ms: number,
    over: Partial<CheckinBaselineSpecWiringInput> = {},
  ) => check({ envMeta, candidate: await measure(ms), repoRoot, ...over });

  const phases: Record<string, () => Promise<unknown>> = {
    "happy (a) 토글 off → skipped/disabled + prefix 로그": async () => {
      const o = await call(10, { repoRoot: undefined });
      expect(o).toMatchObject({ status: "skipped", reason: "disabled" });
      expect(o.log.startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      return o;
    },
    "happy (b) 토글 on × 존재 → compared + regressed=false": async () => {
      process.env[FLAG] = "1";
      // 기준과 동일 stepMs 라 기본 tolerance 에서 무회귀가 결정론적으로 성립.
      const seeded = seed(envMeta, repoRoot, await measure(10));
      const o = await call(10);
      expect(o).toMatchObject({ status: "compared", regressed: false });
      expect(fs.existsSync(seeded)).toBe(true);
      return o;
    },
    "분기 (c) 토글 on × 부재 → skipped/absent + 비교 미호출": async () => {
      process.env[FLAG] = "true";
      const compare = jest.fn();
      const o = await call(10, { compare });
      expect(compare).not.toHaveBeenCalled();
      expect(o).toMatchObject({ status: "skipped", reason: "absent" });
      expect(o.log).toContain(resolveCheckinBaselinePath(envMeta, repoRoot));
      return o;
    },
    "error (1) envMeta.label 빈 값 → RangeError + 파일 미생성": async () => {
      process.env[FLAG] = "1";
      const bad = { envMeta: { label: "", concurrency: 1 } };
      await expect(call(10, bad)).rejects.toThrow(RangeError);
      expect(fs.existsSync(resolveCheckinBaselineDir(repoRoot))).toBe(false);
    },
    "error (2) seed 에 저장소 실경로 → RangeError + 실 목록 불변": async () => {
      const before = snap();
      const candidate = await measure(10);
      const bad = () => seed(envMeta, defaultCheckinRepoRoot(), candidate);
      expect(bad).toThrow(RangeError); // write · mkdir 0 회
      expect(snap()).toEqual(before);
    },
    "negative (a) regressed=true 여도 throw 0(exit code 불변)": async () => {
      process.env[FLAG] = "yes";
      seed(envMeta, repoRoot, await measure(10));
      // 인위로 느린 candidate + tolerance 0 → 회귀. 그래도 반환은 정상(throw 0).
      const o = await call(100, { options: { latencyTolerance: 0 } });
      expect(o).toMatchObject({ status: "compared", regressed: true });
      return o;
    },
    "negative (b) 토글 off 국면은 baselineFileExists 위임 0 회": async () => {
      const candidate = await measure(10);
      // 어댑터가 존재 조회를 위임하는 유일한 경계 — 토글 off 면 0 회여야 한다.
      const spy = jest.spyOn(baselineIo, "baselineFileExists");
      const o = check({ envMeta, candidate });
      expect(spy).not.toHaveBeenCalled();
      expect(o.status).toBe("skipped");
      spy.mockRestore();
      return o;
    },
    // ── T-1573 승격분 — **토글 on × 기본 바인딩(저장소 실경로)** 국면 3 개 ──
    // 위 국면 7 개는 토글 on 이면 전부 임시 `repoRoot` 주입이고 실경로 국면은 전부 토글 off 라,
    // 어댑터가 토글 on 일 때 실경로로 존재 조회를 위임하는 분기가 한 번도 실행되지 않는다. 아래
    // 3 개는 `repoRoot` 를 생략해 그 분기를 태운다. 토글 세팅만 하고 원복은 `afterEach` 에 맡긴다
    // (별도 원복 로직 0 — 누출 0 은 colocated spec 의 토글 보존 국면이 검증).
    "happy (c) 토글 on × 기본 바인딩 → throw 0 + prefix 로그": async () => {
      process.env[FLAG] = "1";
      // 기대 status 는 하드코딩하지 않는다 — 실 baseline 이 체크인된(ADR-0056 §Follow-ups
      // (a)) 뒤에도 성립해야 하므로 실행 시점 파일 존재 여부로 분기한다.
      const target = resolveCheckinBaselinePath(
        envMeta,
        defaultCheckinRepoRoot(),
      );
      const exists = fs.existsSync(target);
      const logs: string[] = [];
      const o = await call(10, {
        repoRoot: undefined,
        log: (message) => logs.push(message),
      });
      expect(o.log.startsWith(CHECKIN_LOG_PREFIX)).toBe(true);
      expect(logs).toEqual([o.log]);
      if (exists) {
        expect(o.status).toBe("compared");
      } else {
        expect(o).toMatchObject({ status: "skipped", reason: "absent" });
        expect(o.log).toContain(target);
      }
      return o;
    },
    "분기 (d) 기본 바인딩 존재-조회 — 토글 on 1 회 · off 0 회": async () => {
      const candidate = await measure(10);
      const spy = jest.spyOn(baselineIo, "baselineFileExists");
      try {
        process.env[FLAG] = "1";
        const on = check({ envMeta, candidate, log: () => undefined });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(envMeta, realDir()); // 실경로 인자
        expect(["compared", "skipped"]).toContain(on.status);

        spy.mockClear();
        delete process.env[FLAG];
        const off = check({ envMeta, candidate, log: () => undefined });
        expect(spy).not.toHaveBeenCalled();
        expect(off).toMatchObject({ status: "skipped", reason: "disabled" });
        return off;
      } finally {
        spy.mockRestore();
      }
    },
    "negative (c) 기본 바인딩 on/off 연속 → throw 0 + 실경로 write 0":
      async () => {
        const candidate = await measure(10);
        const before = snap();
        // 토글 truthy 표기 2 종 + off 를 연속으로 태운다. absent 든 회귀든 반환만 하고 예외를
        // 올리지 않아야 exit code 가 불변이다(ADR-0056 §Decision 3 (b)).
        const statuses: string[] = [];
        for (const flag of ["1", "yes", undefined]) {
          if (flag === undefined) delete process.env[FLAG];
          else process.env[FLAG] = flag;
          statuses.push(
            check({ envMeta, candidate, log: () => undefined }).status,
          );
        }
        expect(statuses).toHaveLength(3);
        expect(statuses[2]).toBe("skipped");
        // write 경로가 애초에 없으므로(§Decision 2) 목록도 디렉토리 존재 여부도 그대로다.
        expect(snap()).toEqual(before);
        expect(fs.existsSync(realDir())).toBe(before !== null);
        return statuses;
      },
  };

  // jest 전역은 **호출 시점**에 읽는다(spec 이 교체해 등록 인자를 관찰할 수 있도록).
  const g = globalThis as unknown as Record<string, (...a: unknown[]) => void>;
  const head = options.title ?? "체크인 baseline";
  g.describe(`${head} 확인 배선 (ADR-0056 §Follow-ups (b)) — 관찰 전용`, () => {
    g.beforeEach(() => {
      savedFlag = process.env[FLAG];
      delete process.env[FLAG];
      repoRoot = tempDir("repo");
    });
    g.afterEach(() => {
      if (savedFlag === undefined) delete process.env[FLAG];
      else process.env[FLAG] = savedFlag;
    });
    Object.entries(phases).forEach(([label, body]) => g.it(label, body));
  });
  return Object.keys(phases);
}

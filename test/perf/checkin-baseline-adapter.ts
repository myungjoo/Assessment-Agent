/**
 * 체크인(repo 안 commit) baseline 조립 진입점의 **실 환경 기본값 바인딩 어댑터** (REQ-048,
 * ADR-0056 §Decision 1 · §Decision 2 · §Decision 3 (b) · §Follow-ups (b)).
 *
 * 조립 진입점 `runCheckinBaselineCheck` 는 순수성을 지키려고 `processEnv` · `repoRoot` ·
 * `exists` · 비교 함수를 **전부 주입받는다**. 배선 slice 가 그 4 줄을 spec 마다 각자 적으면 repo
 * root 계산식과 존재 조회 시점이 갈리므로, 본 모듈이 **기본값 결선 한 겹**만 책임져 spec 당
 * 변경을 호출 1 줄로 줄인다.
 *
 * **신규 판정 로직 0 · 재구현 0** — 토글 판정 · 경로 계산 · 존재 조회 · 판정/조립/로그가 전량
 * 위임이고 위임 예외는 **래핑 없이 그대로 전파**한다. **write 국면 부재**(§Decision 2 — 자기 승인
 * `established` 분기 · fs write · mkdir 계열 호출이 0 건). **exit code 불변**(§Decision 3 (b) —
 * 회귀에도 throw 0). **토글 off 국면 부작용 0** — `fs` 존재 조회 자체를 하지 않는다.
 */

import * as path from "path";

import { isCheckinBaselineEnabled } from "./checkin-baseline-plan";
import {
  CheckinBaselineCompareFn,
  CheckinBaselineRunOutcome,
  runCheckinBaselineCheck,
} from "./checkin-baseline-run";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import {
  BaselineEnvMeta,
  BaselineReport,
  CompareOptions,
} from "./latency-baseline";
import {
  baselineFileExists,
  readCompareBaselineFile,
} from "./latency-baseline-io";

/**
 * `test/perf` 디렉토리 경로에서 repo root 를 산출한다(`<perfDir>/../..` — 결합 · 구분자 정규화는
 * `path.resolve` 위임). 절대 `perfDir` 이면 결과도 그 경로에서만 파생돼 **cwd 무의존**이다.
 *
 * @throws {TypeError} `perfDir` 이 non-string 일 때.
 * @throws {RangeError} `perfDir` 이 빈/공백-only string 일 때.
 */
export function resolveRepoRootFromPerfDir(perfDir: string): string {
  if (typeof perfDir !== "string") {
    throw new TypeError(
      "resolveRepoRootFromPerfDir: perfDir 는 string 이어야 함",
    );
  }
  if (perfDir.trim() === "") {
    throw new RangeError(
      "resolveRepoRootFromPerfDir: perfDir 는 빈/공백-only string 일 수 없음",
    );
  }
  return path.resolve(perfDir, "..", "..");
}

/**
 * 본 모듈 위치(`__dirname` = `test/perf`) 기반 repo root — **cwd 가 아니라 모듈 위치** 기준이라
 * 어느 디렉토리에서 jest 를 띄워도 같은 값이다. 상수 export 가 아니라 **호출 시점 계산**(module
 * load 시점 계산 금지 — 로드 순서 부작용 0).
 */
export function defaultCheckinRepoRoot(): string {
  return resolveRepoRootFromPerfDir(__dirname);
}

/**
 * 기본값 바인딩 입력 — 필수는 `envMeta`(파일명 slug · 비교 1 번째 인자) · `candidate`(방금 측정한
 * 리포트) 둘뿐이고, `options`(허용치) · `repoRoot` · `processEnv` · `compare` 는 선택이며 미지정
 * 시 각각 `defaultCheckinRepoRoot()` · 전역 `process.env` · `readCompareBaselineFile` 로 결선한다.
 * **`exists` 는 입력에 없다** — 존재 조회 시점이 호출측마다 갈리지 않도록 본 모듈이 조회한다.
 */
export interface CheckinBaselineDefaultsInput {
  envMeta: BaselineEnvMeta;
  candidate: BaselineReport;
  options?: CompareOptions;
  repoRoot?: string;
  processEnv?: Record<string, string | undefined>;
  compare?: CheckinBaselineCompareFn;
}

/**
 * 실 환경 기본값(전역 환경변수 · 모듈 위치 기반 repo root · `fs` 존재 조회 · 기본 비교 함수)을
 * 결선해 `runCheckinBaselineCheck` 에 넘기고 그 반환을 **가공 없이** 낸다. 순서: (1) `input`
 * non-object · `null` → `TypeError`, (2) 기본값 결선(명시 값 우선), (3) 토글 off 면 `exists` 를
 * `false` 로 두고 **`fs` 조회 생략**, (4) on 이면 `baselineFileExists` 위임, (5) 조립 위임.
 * 위임 예외(`TypeError` · `RangeError` · `Error`(`ENOENT` 계열) · `SyntaxError`)는 래핑 없이
 * 그대로 올린다. **결정성 · 입력 불변 · exit code 불변** — 같은 입력은 늘 같은 결과, 인자 변형
 * 0, 회귀에도 throw 0(`compared` · `regressed: true` 로 관찰만).
 */
export function runCheckinBaselineCheckWithDefaults(
  input: CheckinBaselineDefaultsInput,
): CheckinBaselineRunOutcome {
  // 1. 입력 형태 검증 — 필드 접근 전에 먼저 막는다.
  if (typeof input !== "object" || input === null) {
    throw new TypeError(
      "runCheckinBaselineCheckWithDefaults: input 은 object 이어야 함(null 불가)",
    );
  }
  // 2. 기본값 결선 — 명시 값이 있으면 그 값이 우선(?? 라 빈 문자열도 명시로 존중).
  const processEnv = input.processEnv ?? process.env;
  const repoRoot = input.repoRoot ?? defaultCheckinRepoRoot();
  const compare = input.compare ?? readCompareBaselineFile;
  // 3~4. 토글 off 면 fs 조회 자체를 하지 않는다(부작용 0). on 일 때만 존재 조회 위임.
  const exists = isCheckinBaselineEnabled(processEnv)
    ? baselineFileExists(input.envMeta, resolveCheckinBaselineDir(repoRoot))
    : false;
  // 5. 조립은 전적으로 위임 — 반환을 가공 없이 그대로 낸다(재해석 · 재포맷 금지).
  const runInput = {
    processEnv,
    envMeta: input.envMeta,
    repoRoot,
    exists,
    candidate: input.candidate,
    options: input.options,
  };
  return runCheckinBaselineCheck(runInput, compare);
}

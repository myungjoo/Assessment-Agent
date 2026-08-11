/**
 * 체크인(repo 안 commit) baseline 의 **경로 해석 단일 진입점** (REQ-048, ADR-0056 §Decision 1).
 *
 * ADR-0056 §Decision 1 은 체크인 baseline 의 저장 위치를 repo 안 확정 디렉토리 하나로 못 박았다.
 * 그 뒤 따라올 두 후속 slice(§Follow-ups (a) 체크인 JSON 최초 생성 · (b) CI 편입)가 각자 경로
 * 문자열을 따로 적으면 그 순간 drift 가 생기므로, 두 slice 가 공유할 경로 해석을 본 모듈 하나로
 * 모은다. 여기서 나온 값 외에 다른 경로 문자열을 새로 적지 않는 것이 본 모듈의 존재 이유다.
 *
 * **파일명 규약 재구현 0** — prefix · slug · 확장자 규약은 전적으로 `resolveBaselinePath`
 * (내부적으로 `resolveBaselineFilename`)에 위임한다. 본 모듈은 **디렉토리 결합만** 책임진다.
 * **순수 · 부작용 0** — `fs` 무의존. 디렉토리 생성 · 존재 검사 · 환경변수 read 없음. `path.posix`
 * (플랫폼 무관 정규화)만 쓴다. 실제 파일 존재 확인이 필요하면 기존 io 헬퍼를 쓰면 되고, 본
 * 모듈에 중복 추가하지 않는다.
 */

import * as path from "path";

import { BaselineEnvMeta, resolveBaselinePath } from "./latency-baseline";

/**
 * 체크인 baseline 디렉토리 — repo root 기준 **POSIX 상대 경로** 상수 (ADR-0056 §Decision 1).
 * 절대경로가 아니라 상대 경로인 이유: CI runner · 로컬 개발기의 checkout 위치가 달라도 같은
 * 값이 유효해야 하고, repo root 결합은 호출측이 자기 컨텍스트로 결정하기 때문이다.
 */
export const CHECKIN_BASELINE_DIR = "test/perf/baselines";

/**
 * `repoRoot` 와 `CHECKIN_BASELINE_DIR` 을 **결정적(deterministic)** 으로 결합해 체크인 baseline
 * 디렉토리 경로를 낸다.
 *
 * 규칙:
 *  1. `repoRoot` 가 string 이 아니면 `TypeError`, 빈 string 또는 공백-only 이면 `RangeError`
 *     (`resolveBaselinePath` 의 `baseDir` 계약과 **동형** — 예외 종류를 일부러 맞춘다).
 *  2. `path.posix.join` 으로 결합 — 후행 구분자 유무(`"a/b"` vs `"a/b/"`)와 중복 구분자를
 *     정규화해 플랫폼 무관 동일 결과를 보장한다.
 *
 * **절대경로 강제 없음** — 상대 `repoRoot` 를 주면 결과도 상대 경로다(호출측 자유도 보존).
 *
 * @throws {TypeError} `repoRoot` 가 non-string 일 때.
 * @throws {RangeError} `repoRoot` 가 빈/공백-only string 일 때.
 */
export function resolveCheckinBaselineDir(repoRoot: string): string {
  if (typeof repoRoot !== "string") {
    throw new TypeError(
      "resolveCheckinBaselineDir: repoRoot 는 string 이어야 함",
    );
  }
  if (repoRoot.trim() === "") {
    throw new RangeError(
      "resolveCheckinBaselineDir: repoRoot 는 빈/공백-only string 일 수 없음",
    );
  }
  return path.posix.join(repoRoot, CHECKIN_BASELINE_DIR);
}

/**
 * `BaselineEnvMeta` 와 `repoRoot` 로부터 체크인 baseline JSON 파일의 전체 경로를 낸다.
 * `resolveBaselinePath(env, resolveCheckinBaselineDir(repoRoot))` 위임이 전부다.
 *
 * **예외 전파** — `env` 형태 불량(`TypeError`) · `env.label` 무효(`RangeError`)는
 * `resolveBaselinePath` 가 내는 것을 **그대로 전파**한다(재검증 · 중복 throw 금지).
 * `repoRoot` 관련 예외는 `resolveCheckinBaselineDir` 계약을 그대로 따른다. 인자 평가 순서상
 * `repoRoot` 검증이 `env` 검증보다 먼저 일어난다(둘 다 무효면 `repoRoot` 쪽 예외가 관측됨).
 *
 * **결정성** — 같은 (`env`, `repoRoot`)는 항상 같은 문자열을 낸다. 서로 다른 `env.label` 은
 * 서로 다른 파일명을 내어 체크인 파일끼리 충돌하지 않는다.
 *
 * @throws {TypeError} `repoRoot` non-string, 또는 `env` 형태 불량(전파).
 * @throws {RangeError} `repoRoot` 빈/공백-only, 또는 `env.label`/slug 무효(전파).
 */
export function resolveCheckinBaselinePath(
  env: BaselineEnvMeta,
  repoRoot: string,
): string {
  return resolveBaselinePath(env, resolveCheckinBaselineDir(repoRoot));
}

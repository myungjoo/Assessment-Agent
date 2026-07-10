/**
 * S2 조회 latency baseline 디스크 write harness (REQ-048, load-resilience-test-plan §5 #4·#5).
 *
 * `latency-baseline.ts` 의 **순수 primitive**(경로 결정 `resolveBaselinePath`, 직렬화
 * `serializeBaselineReport`)를 조립해 baseline JSON 을 실제 디스크에 기록하는 **첫 fs-touching
 * 모듈**이다. 순수 primitive 파일을 fs 부작용으로 오염시키지 않도록 io 책임을 본 모듈로
 * 격리한다(경로·직렬화 규칙 재구현 금지 — 전적으로 primitive 위임, DRY).
 *
 * write 방향(`writeBaselineFile` = `serializeBaselineReport` → `fs.writeFile`)과 read 방향
 * (`readBaselineFile` = `fs.readFile` → `parseBaselineReport`)이 대칭 짝을 이룬다(§5 #4·#5).
 * 그 위에 `readCompareBaselineFile`(= `readBaselineFile` → `compareBaselineReports` →
 * `formatComparisonReport`)이 디스크 기준을 로드해 in-memory candidate 와 비교하는 최종
 * 조립 진입점을 얹는다(`compareBaselineJson` 의 disk-input 짝, §5 #5).
 */

import * as fs from "fs";
import * as path from "path";

import {
  BaselineComparison,
  BaselineEnvMeta,
  BaselineReport,
  CompareOptions,
  compareBaselineReports,
  formatComparisonReport,
  parseBaselineReport,
  resolveBaselinePath,
  serializeBaselineReport,
} from "./latency-baseline";

/**
 * baseline 리포트를 baseline 디렉토리(`baseDir`) 아래 결정적 경로에 JSON 으로 기록하고
 * **쓴 파일의 전체 경로**를 반환한다.
 *
 * 절차:
 *  1. `resolveBaselinePath(env, baseDir)` 로 저장 경로를 결정한다(env/baseDir 형태·빈값 예외는
 *     primitive 계약대로 그대로 전파 — 재검증·중복 throw 금지).
 *  2. `serializeBaselineReport(report)` 로 리포트를 유효 JSON 문자열로 직렬화한다(리포트 형태
 *     불량 예외는 그대로 전파).
 *  3. 저장 경로의 상위 디렉토리를 **재귀 생성**한다(`fs.mkdirSync(dir, { recursive: true })` —
 *     이미 있으면 no-op, 여러 depth 미존재도 한 번에 생성).
 *  4. 그 경로에 JSON 문자열을 **UTF-8 로 기록**한다(`fs.writeFileSync`, 이미 있으면 덮어쓰기).
 *
 * **순서 계약** — 경로 결정·직렬화(순수, 예외 시 fs 접근 0)를 fs 접근 **전에** 완료한다.
 * 즉 `resolveBaselinePath`/`serializeBaselineReport` 가 throw 하면 디렉토리 생성·파일 쓰기가
 * 일어나지 않는다(부작용 없이 실패).
 *
 * **경로·직렬화 위임 불변** — 경로/파일명 규칙은 `resolveBaselinePath`(→ `resolveBaselineFilename`),
 * 직렬화 규칙은 `serializeBaselineReport` 에 전적으로 위임한다(재구현 금지 — DRY). 본 함수는
 * fs 부작용(디렉토리 생성 + 파일 쓰기)만 책임진다.
 *
 * **동기 fs** — 기존 harness 의 순수·동기 스타일과 통일하기 위해 `*Sync` API 를 쓴다
 * (async 도입 불요, 테스트 결정성 유지).
 *
 * @param report 저장할 baseline 리포트.
 * @param env 실행 환경 메타(파일명 slug 유도에 사용 — `resolveBaselinePath` 계약).
 * @param baseDir baseline 디렉토리(파일명과 결합할 상위 경로).
 * @returns 기록한 파일의 전체 경로(`resolveBaselinePath(env, baseDir)` 와 동일).
 * @throws {TypeError} `env` 형태 불량 또는 `baseDir` non-string(경로 결정 primitive 전파).
 * @throws {RangeError} `env.label`/slug 무효 또는 `baseDir` 빈/공백-only(경로 결정 primitive 전파).
 * @throws {TypeError} `report` 형태 불량(직렬화 primitive 전파).
 */
export function writeBaselineFile(
  report: BaselineReport,
  env: BaselineEnvMeta,
  baseDir: string,
): string {
  // 1·2. 순수 primitive(경로 결정·직렬화)를 fs 접근 전에 완료 — throw 시 부작용 0.
  const filePath = resolveBaselinePath(env, baseDir);
  const json = serializeBaselineReport(report);
  // 3. 상위 디렉토리 재귀 생성(이미 있으면 no-op, 다중 depth 도 한 번에).
  const dir = path.posix.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  // 4. UTF-8 로 기록(이미 있으면 덮어쓰기 — overwrite 결정성).
  fs.writeFileSync(filePath, json, { encoding: "utf-8" });
  return filePath;
}

/**
 * baseline 디렉토리(`baseDir`) 아래 결정적 경로의 baseline 파일을 디스크에서 읽어
 * `BaselineReport` 로 복원한다. `writeBaselineFile` 의 대칭 read 방향이다.
 *
 * 절차:
 *  1. `resolveBaselinePath(env, baseDir)` 로 읽을 경로를 결정한다(env/baseDir 형태·빈값 예외는
 *     primitive 계약대로 그대로 전파 — 재검증·중복 throw 금지).
 *  2. 그 경로의 파일을 **UTF-8 로 읽는다**(`fs.readFileSync(path, "utf-8")`). 파일 부재 등 fs
 *     오류(예: `ENOENT`)는 그대로 전파한다(존재 검사·친절한 래핑 금지 — 계약 최소화).
 *  3. 읽은 문자열을 `parseBaselineReport(json)` 로 `BaselineReport` 로 복원해 반환한다(JSON
 *     형태 불량·리포트 형태 불량 예외는 그대로 전파).
 *
 * **순서 계약** — 경로 결정(순수, 예외 시 fs 접근 0)을 fs 접근 **전에** 완료한다. 즉
 * `resolveBaselinePath` 가 throw 하면 파일 읽기가 일어나지 않는다(부작용 없이 실패).
 *
 * **write 와의 round-trip 대칭** — `readBaselineFile(env, baseDir)` 는 동일 (`env`, `baseDir`)로
 * `writeBaselineFile(report, env, baseDir)` 가 쓴 파일을 정확히 읽어 원본 `report` 와 동치(NaN
 * 지표 포함)를 복원한다(두 함수가 동일 `resolveBaselinePath` 경로 규약을 공유).
 *
 * **경로·파싱 위임 불변** — 경로/파일명 규칙은 `resolveBaselinePath`(→ `resolveBaselineFilename`),
 * 역직렬화 규칙은 `parseBaselineReport` 에 전적으로 위임한다(재구현 금지 — DRY). 본 함수는
 * fs 부작용(파일 읽기)만 책임진다.
 *
 * **동기 fs** — 기존 harness 의 순수·동기 스타일과 통일하기 위해 `*Sync` API 를 쓴다
 * (async 도입 불요, 테스트 결정성 유지).
 *
 * @param env 실행 환경 메타(파일명 slug 유도에 사용 — `resolveBaselinePath` 계약).
 * @param baseDir baseline 디렉토리(파일명과 결합할 상위 경로).
 * @returns 읽어 복원한 baseline 리포트.
 * @throws {TypeError} `env` 형태 불량 또는 `baseDir` non-string(경로 결정 primitive 전파).
 * @throws {RangeError} `env.label`/slug 무효 또는 `baseDir` 빈/공백-only(경로 결정 primitive 전파).
 * @throws {Error} 파일 부재 등 fs 오류(`ENOENT` 계열 — `fs.readFileSync` 가 던지는 그대로).
 * @throws {SyntaxError} 파일 내용이 유효 JSON 이 아닐 때(`parseBaselineReport` 전파).
 * @throws {TypeError} JSON 은 유효하나 리포트 형태 불량(`parseBaselineReport` 전파).
 */
export function readBaselineFile(
  env: BaselineEnvMeta,
  baseDir: string,
): BaselineReport {
  // 1. 경로 결정(순수, 예외 시 fs 접근 0) — throw 시 파일 읽기 없이 부작용 0 으로 실패.
  const filePath = resolveBaselinePath(env, baseDir);
  // 2. UTF-8 로 읽기 — 파일 부재 등 fs 오류(ENOENT 계열)는 래핑 없이 그대로 전파.
  const json = fs.readFileSync(filePath, { encoding: "utf-8" });
  // 3. 역직렬화 — JSON/리포트 형태 불량 예외는 parseBaselineReport 계약대로 그대로 전파.
  return parseBaselineReport(json);
}

/**
 * 디스크에 확정 저장된 **기준 baseline** 을 로드해 in-memory **candidate**(방금 측정한
 * `BaselineReport`)와 비교하고, 회귀 판정(`comparison`)과 사람-친화 리포트(`report`)를
 * `{ comparison, report }` 로 조립해 반환한다. `compareBaselineJson` 의 **disk-input 짝**이자,
 * load-resilience-test-plan §5 #5 실 harness 가 import 할 최종 조립 진입점이다.
 *
 * `compareBaselineJson` 이 in-memory JSON 문자열 2개(기준·candidate)를 받는 것과 달리, 본
 * 함수는 **기준을 디스크에서 로드**(`readBaselineFile`)하고 candidate 는 in-memory 로 받는다.
 * 반환 형태 `{ comparison, report }`·조립 순서(로드→비교→포맷)·하위 예외 propagate 컨벤션은
 * `compareBaselineJson` 과 동형이다.
 *
 * 절차(신규 판정·계산 로직 0 — 하위 primitive 를 조립만):
 *  1. `readBaselineFile(env, baseDir)` 로 저장 기준 baseline 을 로드한다(env/baseDir 형태·빈값
 *     예외 및 fs 오류(`ENOENT` 계열)·파싱 예외는 `readBaselineFile` 계약대로 그대로 전파 —
 *     재검증·중복 throw·친절한 래핑 금지).
 *  2. 로드한 `baseline` 과 인자 `candidate` 를 `compareBaselineReports(baseline, candidate,
 *     options)` 로 비교한다(candidate 형태 불량·tolerance 음수/NaN 예외는 그대로 전파).
 *  3. `formatComparisonReport(comparison)` 로 사람-친화 문자열을 만들어 `{ comparison, report }`
 *     로 반환한다(`report` 는 반환 `comparison` 에서 파생되어 정합 보장).
 *
 * **순서 계약** — 디스크 read(기준 로드)를 비교 **전에** 완료한다. `readBaselineFile` 가
 * throw(경로 예외·`ENOENT`·파싱 실패)하면 비교·포맷이 일어나지 않는다.
 *
 * **판정·렌더 위임 불변** — 회귀 판정·delta 계산·NaN 방어는 전적으로 `compareBaselineReports`,
 * 리포트 렌더링은 `formatComparisonReport` 에 위임한다(재구현 금지 — DRY). 본 함수는
 * read → compare → format 의 얇은 조립만 책임진다.
 *
 * **관찰·리포트 전용** — S2 pass/fail 임계·assertion 로직을 바꾸지 않는다. 회귀 탐지 관찰·
 * 리포트 용도이며, 신규 외부 dependency 0(`readBaselineFile` 경유 fs builtin 만).
 *
 * **동기 fs** — 기존 harness 의 동기 스타일과 통일하기 위해 `readBaselineFile`(`*Sync`)을 쓴다
 * (async 미도입, 결정성 유지).
 *
 * @param env 실행 환경 메타(기준 파일명 slug 유도 — `readBaselineFile`→`resolveBaselinePath` 계약).
 * @param baseDir 기준 baseline 이 저장된 디렉토리(파일명과 결합할 상위 경로).
 * @param candidate 방금 측정한 candidate 리포트(in-memory, 디스크에서 로드하지 않는다).
 * @param options 회귀 판정 허용치(선택 — 미지정 시 `compareBaselineReports` 기본 tolerance 사용).
 * @returns `{ comparison, report }` — 비교 결과와 그에서 파생한 사람-친화 리포트 문자열.
 * @throws {TypeError} `env` 형태 불량 또는 `baseDir` non-string(경로 결정 primitive 전파),
 *   또는 `candidate` 형태 불량(`compareBaselineReports` 전파).
 * @throws {RangeError} `env.label`/slug 무효 또는 `baseDir` 빈/공백-only(경로 결정 primitive 전파),
 *   또는 `options.latencyTolerance`/`errorRateTolerance` 음수·NaN(`compareBaselineReports` 전파).
 * @throws {Error} 기준 파일 부재 등 fs 오류(`ENOENT` 계열 — `readBaselineFile` 이 던지는 그대로).
 * @throws {SyntaxError} 기준 파일 내용이 유효 JSON 이 아닐 때(`parseBaselineReport` 전파).
 */
export function readCompareBaselineFile(
  env: BaselineEnvMeta,
  baseDir: string,
  candidate: BaselineReport,
  options?: CompareOptions,
): { comparison: BaselineComparison; report: string } {
  // 1. 디스크 기준 로드 — 경로 예외·ENOENT·파싱 예외는 readBaselineFile 계약대로 그대로 전파.
  //    throw 시 비교·포맷 미도달(순서 계약).
  const baseline = readBaselineFile(env, baseDir);
  // 2. 기준 baseline ↔ in-memory candidate 비교(candidate 형태 불량·tolerance 무효는 여기서 전파).
  const comparison = compareBaselineReports(baseline, candidate, options);
  // 3. 비교 결과를 사람-친화 문자열로 포맷(반환 comparison 에서 파생 → 정합 보장).
  const report = formatComparisonReport(comparison);
  return { comparison, report };
}

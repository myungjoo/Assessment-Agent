/**
 * 체크인(repo 안 commit) baseline 확인을 **perf-spec 에 태우는 배선 관용구 공유 helper**
 * (REQ-048, ADR-0056 §Decision 2 · §Decision 3 (b) · §Follow-ups (b)).
 *
 * T-1565 가 summary measure→confirm perf-spec 에서 배선 형태를 한 번 확정했지만, 그 관용구가
 * spec 안 지역 함수라 잔여 4 spec 이 복제하면 같은 관용구가 5 벌로 갈라진다. 본 모듈은 그 두
 * 관용구 — (1) 어댑터 위임 1 회 + 반환 로그 그대로 출력, (2) 임시 `repoRoot` 안에만 baseline
 * JSON 을 심는 픽스처 seed — 만 모은다.
 *
 * **신규 판정 로직 0 · 재구현 0** — 토글 판정 · 경로 계산 · 존재 조회 · 비교 · 로그 문자열은
 * 전량 기존 모듈 위임이고, 위임 예외는 **래핑 없이 그대로 전파**한다. 본 모듈이 더하는 책임은
 * 로거 결선과 픽스처 seed 의 **실경로 오염 차단 가드** 둘뿐이다(§Decision 2 — 저장소
 * `test/perf/baselines` 에는 쓰지 않는다). **exit code 불변** — 회귀에도 throw 0(§Decision 3 (b)).
 * **jest hook 무의존** — 토글 격리 hook 은 각 spec 의 책임으로 남긴다.
 */

import * as fs from "fs";
import * as path from "path";

import {
  CheckinBaselineDefaultsInput,
  defaultCheckinRepoRoot,
  runCheckinBaselineCheckWithDefaults,
} from "./checkin-baseline-adapter";
import { CheckinBaselineRunOutcome } from "./checkin-baseline-run";
import {
  CheckinStepSummaryEmitOutcome,
  emitCheckinStepSummary,
} from "./checkin-baseline-step-summary-emit";
import { CheckinStepSummarySinkDeps } from "./checkin-baseline-step-summary-sink";
import { resolveCheckinBaselinePath } from "./checkin-baseline-store";
import {
  BaselineEnvMeta,
  BaselineReport,
  serializeBaselineReport,
} from "./latency-baseline";

/**
 * 배선 입력 — 어댑터 입력(`CheckinBaselineDefaultsInput`)의 superset 이며 출력 로거 하나만
 * 더한다. `log` 미지정 시 **호출 시점의** `console.log` 를 쓴다(모듈 로드 시점 고정 아님 —
 * spec 의 `jest.spyOn(console, "log")` 가 그대로 관측된다).
 */
export interface CheckinBaselineSpecWiringInput
  extends CheckinBaselineDefaultsInput {
  log?: (message: string) => void;
}

/**
 * 어댑터를 **정확히 1 회** 호출하고 반환 `outcome.log` 를 주입 로거로 **원문 그대로 1 회**
 * 출력한 뒤 outcome 을 **가공 없이** 반환한다(문자열 재조립 · 반환 재해석 금지).
 *
 * 순서: (1) 로거 결선 · 형태 검사 — 위임 **전에** 막아 무효 로거 국면의 위임 호출을 0 회로
 * 둔다, (2) 어댑터 위임, (3) 로그 출력, (4) 반환. 따라서 위임이 던지는 국면에서는 로거 호출이
 * 0 회다. `input` 자체의 형태 검증은 하지 않고 어댑터 계약에 맡긴다(중복 throw 금지).
 *
 * @throws {TypeError} `input.log` 가 지정됐으나 non-function 일 때, 그 밖에 어댑터가 던지는
 *   것(전파 — `input` non-object · `envMeta` 형태 불량 등).
 * @throws {RangeError} 어댑터 · 경로 helper 가 던지는 것(전파 — `envMeta.label` 무효 등).
 */
export function checkCheckinBaselineForSpec(
  input: CheckinBaselineSpecWiringInput,
): CheckinBaselineRunOutcome {
  const log = (input as CheckinBaselineSpecWiringInput | undefined)?.log;
  const emit = log ?? console.log;
  if (typeof emit !== "function") {
    throw new TypeError(
      "checkCheckinBaselineForSpec: input.log 는 function 이어야 함",
    );
  }
  const outcome = runCheckinBaselineCheckWithDefaults(input);
  emit(outcome.log);
  return outcome;
}

/**
 * **테스트 픽스처 전용** — `resolveCheckinBaselinePath` 로 얻은 경로에 상위 디렉토리를 만든 뒤
 * 직렬화 JSON 을 쓰고 그 경로를 반환한다(경로 문자열 · JSON 형태 재구현 0).
 *
 * `repoRoot` 가 정규화 후 `defaultCheckinRepoRoot()` 와 같은 위치면 **`RangeError` 를 던지고
 * write · mkdir 을 0 회** 수행한다 — 저장소 실경로(`test/perf/baselines`) 오염 차단
 * (ADR-0056 §Decision 2). 빈/공백-only `repoRoot` 는 본 가드가 아니라 경로 helper 의
 * `RangeError` 로 넘긴다(예외 계약 단일화). 경로 · 직렬화 검증이 모두 fs 접근보다 앞서므로
 * 어떤 예외 국면에서도 부작용이 0 이다.
 *
 * @throws {TypeError} `repoRoot` non-string · `envMeta` 형태 불량 · `report` 형태 불량(전파).
 * @throws {RangeError} 실경로 가드, 또는 `repoRoot` 빈/공백-only · `envMeta.label` 무효(전파).
 */
export function seedCheckinBaselineFixture(
  envMeta: BaselineEnvMeta,
  repoRoot: string,
  report: BaselineReport,
): string {
  if (
    typeof repoRoot === "string" &&
    repoRoot.trim() !== "" &&
    path.resolve(repoRoot) === path.resolve(defaultCheckinRepoRoot())
  ) {
    throw new RangeError(
      "seedCheckinBaselineFixture: repoRoot 는 저장소 실경로일 수 없음(픽스처 전용)",
    );
  }
  const target = resolveCheckinBaselinePath(envMeta, repoRoot);
  const json = serializeBaselineReport(report);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json, { encoding: "utf-8" });
  return target;
}

/**
 * step 요약 주입 묶음 · 결과 판별 union 타입을 **그대로** 재-export 한다(새 타입 정의 금지 —
 * 계약이 호출처마다 갈리면 안 된다).
 */
export type { CheckinStepSummarySinkDeps } from "./checkin-baseline-step-summary-sink";
export type { CheckinStepSummaryEmitOutcome } from "./checkin-baseline-step-summary-emit";

/**
 * step 요약 sink 의 **기본 주입값 한 묶음** 을 만든다(ADR-0056 §Decision 3 (b)).
 *
 * 합성 진입점 `emitCheckinStepSummary` 는 **전역 접근 0** 계약 때문에 환경변수 record 와 append
 * 함수를 전부 주입받는다. 그 묶기를 perf-spec 마다 복제하면 "무엇을 기본값으로 쓰는가" 가 호출처
 * 수만큼 갈라지므로, 기본값 결선을 이 한 곳에만 둔다(`checkCheckinBaselineForSpec` 이
 * `input.log ?? console.log` 로 로거 기본값을 묶은 것과 동형).
 *
 * **호출 시점 조회** — `processEnv` 는 모듈 로드 시점이 아니라 **호출 시점의** `process.env` 를
 * 그대로 싣는다(spec 이 국면마다 env 를 바꿔도 관측돼야 한다). `append` 도 호출 시점에 새로
 * 만들어지는 얇은 바인딩이라 `fs` spy 가 그대로 걸린다. **재구현 0** — 환경변수명 상수 · 단락
 * 판정 · 요약 문구는 여기서 다시 적지 않는다(sink · emit 계약 그대로).
 *
 * @returns 호출 시점 `process.env` + `fs.appendFileSync` utf-8 바인딩으로 채운 주입 묶음.
 * @throws 없음 — 값 조립만 하고 fs · 환경변수 write 를 하지 않는다.
 */
export function defaultStepSummarySinkDeps(): CheckinStepSummarySinkDeps {
  return {
    processEnv: process.env,
    append: (target: string, data: string): void => {
      fs.appendFileSync(target, data, { encoding: "utf-8" });
    },
  };
}

/**
 * 체크인 baseline 실행 결과를 step 요약으로 내보내되 **주입 묶음의 기본값만 결선** 한다 —
 * `emitCheckinStepSummary` 를 **정확히 1 회** 호출하고 그 반환을 **재조립 · 재판정 없이 그대로**
 * 반환한다.
 *
 * `deps` 가 `undefined` 일 때만 `defaultStepSummarySinkDeps()` 로 채우고, 지정된 값은 **가공 없이**
 * 그대로 넘긴다(`null` 도 가공하지 않고 넘겨 위임의 `TypeError` 로 드러나게 둔다 — `??` 로
 * 흡수하면 무효 인자가 조용히 기본값으로 바뀐다). **중복 검증 금지** — `outcome` · `sectionTitle` ·
 * `deps` 형태 검사는 전적으로 위임 계약이며 본 helper 는 다시 던지지 않는다.
 *
 * **exit code 불변** — 위임이 던지지 않는 값을 새로 던지지 않는다(관찰-only 계약 보존 —
 * 포매터 · append 실패는 위임이 삼켜 `failed` 로만 보고한다).
 *
 * @param outcome 체크인 baseline 실행 결과 판별 union(`compared` | `skipped`).
 * @param sectionTitle 요약 heading 문구(빈/공백-only 불가 — 위임 계약 그대로).
 * @param deps 주입 묶음. 미지정 시 `defaultStepSummarySinkDeps()` 를 쓴다.
 * @returns 위임 반환 그대로(append 수행 · 단락 · 삼킨 실패 판별 union).
 * @throws {TypeError} 위임이 던지는 것 전파(`outcome` non-object · `null` · `undefined`,
 *   `sectionTitle` non-string, 지정된 `deps` 가 `null` · non-object · 필드 형태 불량).
 * @throws {RangeError} 위임이 던지는 것 전파(`sectionTitle` 빈/공백-only).
 */
export function emitCheckinStepSummaryForSpec(
  outcome: CheckinBaselineRunOutcome,
  sectionTitle: string,
  deps?: CheckinStepSummarySinkDeps,
): CheckinStepSummaryEmitOutcome {
  return emitCheckinStepSummary(
    outcome,
    sectionTitle,
    deps === undefined ? defaultStepSummarySinkDeps() : deps,
  );
}

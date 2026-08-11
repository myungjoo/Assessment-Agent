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

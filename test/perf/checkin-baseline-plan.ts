/**
 * 체크인(repo 안 commit) baseline **비교 진입 판정의 단일 진입점** (REQ-048,
 * ADR-0056 §Decision 2 · §Decision 3 (b) · §Consequences (d)).
 *
 * ADR-0056 §Decision 2 는 체크인 baseline 을 **명시적 `commitMode: pr` task 에서만** 갱신하기로 못
 * 박았다. 그런데 `confirmOrCompareBaseline` 은 부재 시 곧바로 write 해 그 시점 측정을 기준으로 자기
 * 승인하므로(§Consequences (d) 의 "첫 run 자기 승인" 위험), 체크인 디렉토리를 그대로 물리면 CI 가
 * baseline 을 쓰는 셈이 된다. 그래서 필요한 것은 **언제 비교에 진입하고 언제 아무 것도 하지 않는지**
 * 를 한 곳에서 판정하는 진입점이다. 판별 union 에 `write`/`establish` 가 없는 이유가 그것이며, 비교
 * 결과의 회귀도 관찰일 뿐 exit code 를 바꾸지 않는다(§Decision 3 (b)).
 *
 * **재구현 0 · 순수 · 부작용 0** — 경로 조립은 `resolveCheckinBaselinePath` 위임(경로 문자열을 여기
 * 새로 적지 않는다), 존재 판정은 주입 boolean 위임이라 파일 시스템 접근 · 전역 환경변수 read 가 0.
 */

import { resolveCheckinBaselinePath } from "./checkin-baseline-store";
import { BaselineEnvMeta } from "./latency-baseline";

/**
 * 체크인 baseline 비교의 **opt-in 토글 환경변수 이름** 상수(로컬 일상 perf 실행이 무조건 비교에
 * 진입하지 않도록 명시 opt-in). 이 문자열을 다른 곳에 다시 적지 말고 항상 본 상수를 참조한다.
 */
export const CHECKIN_BASELINE_ENV_FLAG = "PERF_CHECKIN_BASELINE";

/** 토글 on 으로 인정하는 값 — **trim + 소문자화 이후** 기준(관대한 truthy 해석 금지). */
const ENABLED_VALUES: ReadonlySet<string> = new Set(["1", "true", "yes"]);

/**
 * 주입된 환경변수 record 를 읽어 체크인 baseline 비교가 **켜져 있는지** boolean 으로 낸다. 값이
 * string 이고 trim + 소문자화 결과가 `"1"`/`"true"`/`"yes"` 중 하나면 `true`, 미설정 · 빈 문자열 ·
 * `"0"`/`"false"` · 그 밖의 값 · non-string 은 전부 `false`(모호하면 off — 비교에 잘못 진입하는
 * 쪽보다 안 하는 쪽이 안전하다). 전역 환경변수를 읽지 않고 인자도 변형하지 않는다(부작용 0).
 *
 * @param env 환경변수 record(호출측이 넘긴 프로세스 환경 사본 등).
 * @returns 토글이 켜져 있으면 `true`, 아니면 `false`.
 * @throws {TypeError} `env` 가 object 가 아니거나 `null` 일 때.
 */
export function isCheckinBaselineEnabled(
  env: Record<string, string | undefined>,
): boolean {
  if (typeof env !== "object" || env === null) {
    throw new TypeError(
      "isCheckinBaselineEnabled: env 는 object 이어야 함(null 불가)",
    );
  }
  const raw = (env as Record<string, unknown>)[CHECKIN_BASELINE_ENV_FLAG];
  // 미설정 · non-string 은 전부 off(예외 아님 — 토글 미지정은 정상 상태다).
  return (
    typeof raw === "string" && ENABLED_VALUES.has(raw.trim().toLowerCase())
  );
}

/**
 * 비교 진입 판정 결과 — `mode` 판별자로 두 국면을 구별하는 discriminated union. `"compare"` 는 토글
 * on + 파일 존재라 **비교에 진입**(`baselinePath` 는 해석된 경로), `"skip"` 은 아무 것도 하지 않음
 * (`reason` 이 `"disabled"` 면 토글 off 라 `baselinePath` 는 `null`, `"absent"` 면 토글 on 이나 파일
 * 부재라 로그용 경로를 싣는다). §Decision 2 대로 write / establish 를 표현할 수단은 애초에 없다.
 */
export type CheckinBaselinePlan =
  | { mode: "compare"; baselinePath: string }
  | {
      mode: "skip";
      reason: "disabled" | "absent";
      baselinePath: string | null;
    };

/** `planCheckinBaselineCheck` 입력 — 환경 · 경로 재료 · 존재 여부를 전부 주입받는다. */
export interface CheckinBaselinePlanInput {
  /** 환경변수 record(토글 판정용) — 전역을 직접 읽지 않기 위해 주입받는다. */
  processEnv: Record<string, string | undefined>;
  /** 실행 환경 메타(파일명 slug 유도 — `resolveCheckinBaselinePath` 계약). */
  envMeta: BaselineEnvMeta;
  /** repo root 경로(체크인 baseline 디렉토리와 결합할 상위 경로). */
  repoRoot: string;
  /** baseline 파일 존재 여부 — 파일 시스템 조회는 호출측 책임(여기선 boolean 만 받는다). */
  exists: boolean;
}

/**
 * 체크인 baseline 비교에 **진입할지** 판정해 `CheckinBaselinePlan` 을 낸다(판정 외 부작용 0).
 *
 * 판정 순서: (1) `input` non-object → `TypeError`. (2) 토글 off 면 **즉시 단락**
 * (`skip`/`disabled`/`null`) — 경로 조립을 아예 하지 않아 `repoRoot`/`envMeta` 가 무효여도 예외 0.
 * (3) `exists` non-boolean → `TypeError`(존재 여부를 추측하지 않는다). (4) 경로는
 * `resolveCheckinBaselinePath` 위임으로만 얻고 그 예외를 **그대로 전파**(재검증 · 중복 throw 금지).
 * (5) `exists === false` → `skip(absent)`(**write 하지 않는다**), `true` → `compare`.
 *
 * **결정성 · 입력 불변** — 같은 입력은 늘 같은 결과, 인자 변형 0, 서로 다른 `envMeta.label` 은 서로
 * 다른 `baselinePath`(경로 helper 계약 승계).
 *
 * @param input 환경변수 record · env 메타 · repo root · 존재 여부.
 * @returns 비교 진입(`compare`) 또는 단락(`skip`) 판정.
 * @throws {TypeError} `input`/`processEnv` non-object · `null`, `exists` non-boolean, `envMeta`
 *   형태 불량 · `repoRoot` non-string(뒤 둘은 경로 helper 전파).
 * @throws {RangeError} `repoRoot` 빈/공백-only, `envMeta.label`/slug 무효(경로 helper 전파).
 */
export function planCheckinBaselineCheck(
  input: CheckinBaselinePlanInput,
): CheckinBaselinePlan {
  // 1. 입력 형태 검증 — 필드 접근 전에 먼저 막는다.
  if (typeof input !== "object" || input === null) {
    throw new TypeError(
      "planCheckinBaselineCheck: input 은 object 이어야 함(null 불가)",
    );
  }
  const { processEnv, envMeta, repoRoot, exists } = input;
  // 2. 토글 off → 경로 조립 없이 단락(무효 repoRoot 를 줘도 여기서 끝나 throw 0).
  if (!isCheckinBaselineEnabled(processEnv)) {
    return { mode: "skip", reason: "disabled", baselinePath: null };
  }
  // 3. 존재 여부는 반드시 boolean 주입 — 추측하지 않는다.
  if (typeof exists !== "boolean") {
    throw new TypeError(
      "planCheckinBaselineCheck: input.exists 는 boolean 이어야 함",
    );
  }
  // 4. 경로는 전적으로 위임 — 위임 예외(TypeError/RangeError)는 그대로 전파.
  const baselinePath = resolveCheckinBaselinePath(envMeta, repoRoot);
  // 5. 부재면 skip(absent) — write 국면은 존재하지 않는다(ADR-0056 §Decision 2).
  return exists
    ? { mode: "compare", baselinePath }
    : { mode: "skip", reason: "absent", baselinePath };
}

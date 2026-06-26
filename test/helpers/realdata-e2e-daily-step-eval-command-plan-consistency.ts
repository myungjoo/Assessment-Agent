// realdata-e2e-daily-step-eval-command-plan-consistency.ts — 실 평가 e2e **step④ daily-
// test step_eval 진입측 leaf 컴포저** 산출 ↔ gating single-source 재유도 정합 순수 가드
// (T-0693 박제).
//
// 책임:
//   - `buildRealDataDailyStepEvalCommandPlan(env)`(T-0611) 는 입력 env 의 gating 판정
//     (`resolveRealDataE2eLiveGating(env)`)을 받아 `{ action, argv?, reason }`
//     (`RealDataDailyStepEvalCommandPlan`) 으로 합성하는 **step④ 진입측 leaf 컴포저**다.
//     PLAN.md 109행 ④ 단계의 `deploy/daily-test.sh` step_eval bash 배선이 이 plan 만
//     execFile 하면 되도록 결정 로직을 외화한다(jest 프로세스 spawn 하나만 외부 경계).
//   - 본 가드 신설 전 이 컴포저에는 **독립 정합 가드가 부재했다**(origin/main grep 0).
//     gating 결과와 산출 plan 사이의 합성 회귀 — action↔gating.enabled 오매핑, argv
//     config/spec-path drift, argv 길이/순서 어긋남, action="skip" 인데 argv 존재(잘못
//     spawn 유발), reason 재포장 — 을 build-time 에 잡을 장치가 없었다. 본 가드는 합성
//     회귀로 손상된 step_eval command plan 이 bash 배선으로 새기 전 build-time 에
//     fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 입력 env 의 gating 재유도):
//   - `gating.enabled=true ⇒ plan.action==="run" ∧ plan.argv` 가 canonical 4-요소 벡터
//     (`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath",
//     REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]`)와 정확히 일치.
//   - `gating.enabled=false ⇒ plan.action==="skip" ∧ plan.argv` 부재(undefined).
//   - `plan.reason === gating.reason`(컴포저는 gating.reason 을 전파만 — 재포장 0).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError — evaluate-side mirror
// T-0691 정합):
//   - `plan` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `env` 비-객체(null/배열/원시 포함) → 한국어 TypeError(gating 재유도 불가).
//   - `plan.action` 이 "run"/"skip" 외 값 → 한국어 RangeError(분기 enum 위반).
//   - action↔gating.enabled 오매핑(run인데 enabled=false 또는 그 반대) → RangeError.
//   - run 분기: argv 부재 / argv 비-배열 / argv 가 canonical 벡터와 정확히 일치 안 함
//     (길이 / 각 원소) → RangeError.
//   - skip 분기: argv 존재(undefined 가 아님) → RangeError(caller 의 잘못된 spawn 유발).
//   - reason 불일치 → RangeError(컴포저가 gating.reason 을 재포장).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan` / `env` 읽기·비교만(mutate 0). 부수효과 0 · `@Injectable` 0 ·
// Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 →
// 동일 동작(정합 plan 이면 항상 void, drift 면 항상 동일 지점에서 throw). 가드는
// `resolveRealDataE2eLiveGating(env)` 를 호출해 expected gating 을 재유도하지만, 그
// helper 자체는 부수효과 0 순수 함수라 가드 또한 결정론을 유지한다.
//
// 패턴 mirror: `assertRealDataScoringCallArgsConsistentWithInputs`(T-0691, evaluate-side
// leaf 가드)의 step④ 진입측 mirror — 차이점:
//   (a) 재유도 source 가 production 매퍼 호출이 아니라 `resolveRealDataE2eLiveGating(env)`
//       (단일 helper 위임)이라 gating 키 규칙 재구현 0 — 위임만.
//   (b) 정책 값(canonical argv 4-요소)이 컴포저 export 상수이므로 import 재사용
//       (중복 정의 0). config / spec-path drift 도 그 상수 ===-equal 로 박제.
//   (c) action 이 enum("run"/"skip")이라 enum 위반(다른 값) 분기도 RangeError 로 박제.
//
// Out of Scope (task T-0693):
//   - 컴포저 본문 수정 / self-wire 배선 — 본 가드는 외부 독립 검증만. self-wire 는
//     별도 후속 task(T-0691→T-0692 짝 패턴 mirror).
//   - gating helper(`realdata-e2e-live-gating.ts`) 수정 — 본 task 는 호출(재유도)만.
//   - 자동 복구 / 정규화 / 기본값 채움 0 — 손상 plan 을 silent 수선하지 않는다.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 0 — 순수 비교만.
//   - 실 jest spawn / 실 daily-test.sh step_eval wiring / Ollama / live-LLM(ADR-0045) /
//     credential wiring 0 — build-time 순수 가드만.
//   - evaluate-side / seed-side / result-issue-side 가드/컴포저(T-0687~T-0692 등) 변경
//     0 — step④ 진입측 daily-step-eval-command-plan seam 만.
import {
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
  type RealDataDailyStepEvalCommandPlan,
} from "./realdata-e2e-daily-step-eval-command-plan";
import { resolveRealDataE2eLiveGating } from "./realdata-e2e-live-gating";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 'object' 로 뭉뚱그리는
// 것과 구분해 노출(디버깅 가독성). T-0691 mirror 와 동형 helper.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// assertPlanStructure — `plan` 의 최소 형태 fail-fast 검증. 구조/타입 결손은 TypeError
// 로 값 정합 위반(RangeError) 과 분리. plan 이 객체여야 .action/.argv/.reason 접근 시
// 타입 충돌 차단.
function assertPlanStructure(
  plan: RealDataDailyStepEvalCommandPlan | null | undefined,
): asserts plan is RealDataDailyStepEvalCommandPlan {
  if (
    plan === null ||
    plan === undefined ||
    typeof plan !== "object" ||
    Array.isArray(plan)
  ) {
    throw new TypeError(
      `plan 이 객체가 아니다(타입: ${describe(plan)}) — gating 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertEnvStructure — 재유도 source(env) 최소 형태 fail-fast 검증. gating helper 가
// env 인자를 객체로 가정하므로 비-객체 / null / 배열은 차단(gating 재유도 자체가 불가).
function assertEnvStructure(
  env: NodeJS.ProcessEnv | null | undefined,
): asserts env is NodeJS.ProcessEnv {
  if (
    env === null ||
    env === undefined ||
    typeof env !== "object" ||
    Array.isArray(env)
  ) {
    throw new TypeError(
      `env 가 객체가 아니다(타입: ${describe(env)}) — gating 재유도를 진행할 수 없다.`,
    );
  }
}

// canonical argv 벡터(run 분기 expected). 컴포저 export 상수 import 재사용 — 중복 정의
// 0. 정책 drift 차단의 single source 이며, 컴포저가 매 호출 새 배열을 반환하므로 본
// 가드도 새 배열을 만든다(reference 동등이 아니라 길이·각 원소 ===-equal 로 대조).
function expectedRunArgv(): string[] {
  return [
    "--config",
    REALDATA_E2E_SMOKE_JEST_CONFIG,
    "--runTestsByPath",
    REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  ];
}

/**
 * 실 평가 e2e **step④ 진입측 leaf 컴포저**(`buildRealDataDailyStepEvalCommandPlan`) 산출
 * plan 이, 주입된 입력 `env` 의 `resolveRealDataE2eLiveGating(env)` 재유도 결과와 정합
 * 함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ build-time chain 의
 * 진입측 leaf-seam 무결성 조각). `assertRealDataScoringCallArgsConsistentWithInputs`
 * (T-0691, evaluate-side leaf 가드)의 step④ 진입측 mirror.
 *
 * 검증하는 불변식:
 *   - gating.enabled=true ⇒ plan.action==="run" ∧ plan.argv 가 canonical 4-요소 벡터
 *     (`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath",
 *     REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]`)와 정확히 일치.
 *   - gating.enabled=false ⇒ plan.action==="skip" ∧ plan.argv 부재(undefined).
 *   - plan.reason === gating.reason(재포장 0).
 *
 * 검사 순서(fail-fast): 구조(plan 객체 · env 객체) → action enum("run"/"skip") 검증 →
 * gating 재유도 → action↔gating.enabled 매핑 → 분기별(run argv 정확히 일치 / skip argv
 * 부재) → reason 일치. 가장 먼저 어긋난 지점에서 throw.
 *
 * @param plan leaf 컴포저 산출 RealDataDailyStepEvalCommandPlan. 변형하지 않는다.
 * @param env 재유도 source — `resolveRealDataE2eLiveGating(env)` 재호출에 사용. 변형하지
 *   않는다.
 * @returns 정합이면 void.
 * @throws {TypeError} `plan` 비-객체(null/undefined/배열/원시 포함) / `env` 비-객체
 *   (구조·타입 결손).
 * @throws {RangeError} `plan.action` 이 "run"/"skip" 외 / action↔gating.enabled 오매핑 /
 *   run 분기 argv 부재 또는 canonical 벡터 불일치 / skip 분기 argv 존재 / reason 불일치
 *   (값 정합 위반). 메시지에 어긋난 필드 / 기대값 / 실측값 정보 포함.
 */
export function assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
  plan: RealDataDailyStepEvalCommandPlan,
  env: NodeJS.ProcessEnv,
): void {
  // 구조 검증(TypeError 분기) — plan 객체 + env 객체. 둘 다 통과해야 gating 재유도 가능.
  assertPlanStructure(plan);
  assertEnvStructure(env);

  // action enum 검증 — 컴포저는 "run" / "skip" 만 산출. 다른 값은 분기 enum 위반.
  if (plan.action !== "run" && plan.action !== "skip") {
    throw new RangeError(
      `정합 위반: plan.action 이 "run"/"skip" 외 값이다 — 실측=${JSON.stringify(plan.action)}.`,
    );
  }

  // gating 재유도 — env 로 helper 를 재호출해 expected gating 을 single-source 로 얻는다.
  // gating 키 규칙은 helper 가 단독 소유 — 본 가드는 위임 결과만 본다.
  const gating = resolveRealDataE2eLiveGating(env);

  // action↔gating.enabled 매핑 — enabled=true ⇔ action="run", enabled=false ⇔ action="skip".
  // 오매핑(run 인데 enabled=false 또는 skip 인데 enabled=true) 차단.
  const expectedAction: "run" | "skip" = gating.enabled ? "run" : "skip";
  if (plan.action !== expectedAction) {
    throw new RangeError(
      `정합 위반: plan.action 이 gating.enabled 와 어긋난다 — gating.enabled=${gating.enabled} ⇒ 기대=${JSON.stringify(expectedAction)}, 실측=${JSON.stringify(plan.action)}.`,
    );
  }

  // 분기별 argv 검증 — run 분기는 canonical 4-요소 벡터와 정확히 일치, skip 분기는 부재.
  if (gating.enabled) {
    // run 분기 — argv 가 정의되어 있고 배열이어야 한다.
    if (plan.argv === undefined) {
      throw new RangeError(
        '정합 위반: plan.action="run" 인데 plan.argv 가 부재(undefined)다 — caller 가 jest 를 spawn 할 수 없다.',
      );
    }
    if (!Array.isArray(plan.argv)) {
      throw new RangeError(
        `정합 위반: plan.argv 가 배열이 아니다 — 타입=${describe(plan.argv)}.`,
      );
    }
    const expected = expectedRunArgv();
    if (plan.argv.length !== expected.length) {
      throw new RangeError(
        `정합 위반: plan.argv 길이가 canonical 벡터와 다르다 — 기대=${expected.length}, 실측=${plan.argv.length}.`,
      );
    }
    for (let i = 0; i < expected.length; i += 1) {
      if (plan.argv[i] !== expected[i]) {
        throw new RangeError(
          `정합 위반: plan.argv[${i}] 가 canonical 벡터와 다르다 — 기대=${JSON.stringify(expected[i])}, 실측=${JSON.stringify(plan.argv[i])}.`,
        );
      }
    }
  } else {
    // skip 분기 — argv key 자체가 부재(undefined)여야 한다. 존재하면 caller 가 잘못
    // spawn 할 위험이 있다(컴포저 계약: skip 시 argv key 자체 미설정).
    if (plan.argv !== undefined) {
      throw new RangeError(
        `정합 위반: plan.action="skip" 인데 plan.argv 가 존재한다(타입: ${describe(plan.argv)}) — caller 가 잘못 spawn 할 위험이 있다.`,
      );
    }
  }

  // reason 일치 — 컴포저는 gating.reason 을 전파만 한다(재포장 0). 문자열 ===-equal 로
  // 박제(부분 매칭/공백 정규화 0 — 정책 drift 도 catch).
  if (plan.reason !== gating.reason) {
    throw new RangeError(
      `정합 위반: plan.reason 이 gating.reason 과 다르다 — 기대=${JSON.stringify(gating.reason)}, 실측=${JSON.stringify(plan.reason)}.`,
    );
  }
}

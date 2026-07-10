// realdata-e2e-daily-step-collect-command-plan.ts — 실 평가 e2e daily-test `step_collect` 의
// gating 판정 + jest invocation argv 산출 순수 컴포저 (T-0887 박제).
//
// 책임:
//   - PLAN.md 109행 ④ 단계는 `deploy/daily-test.sh` 가 nightly 로 실 github 수집 leg +
//     실 LLM 평가 leg 를 각 1 회 round-trip 하는 자율 nightly 실 평가 e2e 다. 현재
//     `step_eval`(T-0611 컴포저 → bash 배선)은 LLM 평가 leg(`realdata-e2e-live.smoke-spec.ts`,
//     T-0610)만 spawn 하고, 실 github.com 수집 leg(`realdata-e2e-github-collection-live.smoke-spec.ts`,
//     T-0806)는 nightly runner 가 한 번도 실행하지 않는 gap 이 있다. 본 컴포저는 그 gap 을
//     메우는 첫 slice 로, collection leg 의 "어떤 gating env 면 실행하고 부재 시 SKIP 할지" +
//     "실행 시 어떤 jest argv 로 collection live smoke 를 돌릴지" 의 **결정 로직을 순수 TS
//     helper 로 외화** 해 R-112 unit test 로 cover 한다.
//   - eval-leg 컴포저(`realdata-e2e-daily-step-eval-command-plan.ts`, T-0611)와 **동형**이되
//     argv 의 spec 경로만 collection live smoke spec 으로 교체한다 — bash 결정 로직을
//     testable 한 순수 plan 으로 외화하고 남는 외부 경계는 jest 프로세스 spawn 한 번뿐으로
//     줄인다.
//
// 🔥 gating helper 위임 (재구현 0):
//   - gating env 키 집합·완전성 규칙은 `resolveRealDataE2eLiveGating(env)`(T-0610)에
//     전적으로 위임한다. 본 컴포저는 gating env 키를 재구현하지 않고 `enabled` boolean
//     분기만 plan 의 `action`("run" | "skip")으로 매핑한다. eval-leg 과 동일한 gating
//     source 를 공유하므로 두 leg 의 활성/skip 판정이 항상 일관된다.
//
// 🔥 결정론·무공유 (R-59 / §9 정합):
//   - 입력 외 상태(시각·난수·전역 env) 의존 0. 동일 env 두 번 호출 → deep-equal 산출.
//     입력 env 객체 mutate 0, 매 호출 새 plan 객체(+ 새 argv 배열) 반환.
//   - 실 credential 값을 argv / reason 에 echo 0(§9) — argv 는 spec 경로 + smoke config
//     flag 만 담는다. 실 LLM/PAT 값은 bash 가 자식 jest 프로세스의 env 로 별도 전달하며
//     본 plan 에는 구조적으로 포함되지 않는다(raw 미저장 R-59).
//
// 🔥 외부 의존 0 — 기존 gating helper import 만, 새 dependency 0 (Node 내장 타입만).
//   collection leg 전용 consistency 가드(`...-collect-command-plan-consistency.ts`)는
//   eval-leg 이 T-0693 별도 slice 로 붙인 것과 대칭으로 후속 slice — 본 task 는 순수
//   additive 신설 2 파일이라 self-assert 가드를 도입하지 않는다(Out of Scope 준수).
import { resolveRealDataE2eLiveGating } from "./realdata-e2e-live-gating";

// collection live smoke spec 의 경로 — jest argv 가 단일-spec bound 로 가리킬 대상
// (T-0806 박제). eval-leg 의 `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` 와 동형이되 collection
// leg spec 을 가리킨다. `package.json` 의 `test:smoke` 관례와 정합한다.
export const REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH =
  "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts";

// smoke jest config 경로 — `test:smoke` script 와 동일(jest-smoke.json). 본 컴포저는
// 이 기존 관례를 바꾸지 않고 그대로 가리킨다(Out of Scope: package.json 변경 금지).
export const REALDATA_E2E_SMOKE_JEST_CONFIG = "./test/jest-smoke.json";

// RealDataDailyStepCollectCommandPlan — daily-test `step_collect` 의 실행 결정 plan.
//   - action: "run"  → gating env 7 종 모두 set, bash 가 argv 로 jest spawn.
//             "skip" → gating 부재, bash 가 `mark collect SKIP`(조용한 SKIP, throw 0).
//   - argv: action === "run" 일 때만 존재(jest 실행 인자-벡터 — jest 실행 파일명 미포함).
//           action === "skip" 이면 undefined(caller 가 잘못 spawn 하지 않도록 명시적 부재).
//   - reason: 사람 보고용 사유(gating helper 의 reason 전파). 실 credential 값 미포함(§9).
export interface RealDataDailyStepCollectCommandPlan {
  action: "run" | "skip";
  argv?: string[];
  reason: string;
}

// buildRealDataDailyStepCollectCommandPlan — env 를 입력 받아 daily-test `step_collect` 의
// gating 판정 + (활성 시) jest invocation argv 를 산출하는 **순수 컴포저**.
//
// 합성:
//   (1) resolveRealDataE2eLiveGating(env) → { enabled, reason } (gating 위임, 키 재구현 0).
//   (2) enabled === true  → { action: "run", argv: [smoke config + 단일 spec bound], reason }.
//       enabled === false → { action: "skip", reason } (argv 미포함, throw 0 — 조용한 SKIP).
//
// jest argv 구성(단일-spec bound·deterministic):
//   ["--config", "./test/jest-smoke.json", "--runTestsByPath",
//    "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts"]
//   - `--config` 로 기존 smoke 설정 재사용(testRegex / globalSetup 정합).
//   - `--runTestsByPath` + 정확한 spec 경로로 **그 spec 하나만** 실행(단일 실행 bound).
//   - 실 credential 값은 argv 에 넣지 않음 — bash 가 자식 프로세스 env 로 별도 전달(§9).
//
// 순수성·무공유:
//   - env 는 읽기만(mutate 0). 매 호출 새 plan 객체 + (run 시) 새 argv 배열 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력 env 만의 함수).
//   - gating helper 가 throw 0 이라 본 컴포저도 throw 0(부재는 action="skip" 으로만 표현).
//     null/undefined/비-객체 env 도 gating helper 의 방어에 위임 — 본 컴포저는 추가 방어 0.
//
// @param env process.env 또는 임의 env map(테스트 주입).
// @returns gating 판정에 따른 run/skip plan(+ run 시 jest argv) + 사람 보고용 reason.
export function buildRealDataDailyStepCollectCommandPlan(
  env: NodeJS.ProcessEnv,
): RealDataDailyStepCollectCommandPlan {
  // (1) gating 판정 위임 — gating env 키·완전성 규칙은 T-0610 helper 가 단독 소유.
  const gating = resolveRealDataE2eLiveGating(env);

  // (2) skip 분기 — argv 미포함(명시적 undefined), throw 0(조용한 SKIP 유도).
  if (!gating.enabled) {
    return {
      action: "skip",
      reason: gating.reason,
    };
  }

  // run 분기 — 단일-spec bound jest argv(매 호출 새 배열). 실 credential 미포함(§9).
  // argv 의 spec 경로만 eval-leg 과 다르다(collection live smoke spec 을 가리킴).
  return {
    action: "run",
    argv: [
      "--config",
      REALDATA_E2E_SMOKE_JEST_CONFIG,
      "--runTestsByPath",
      REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
    ],
    reason: gating.reason,
  };
}

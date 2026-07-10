// realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-test command-plan **eval↔collect dual-leg convergence** non-gated
// build-time smoke (T-0893 박제, PLAN.md 109행 🟢 실 평가 e2e). run-plan dual-leg
// convergence 정본(T-0753)의 daily-step 쌍 mirror.
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - PLAN 109행 step ④(`deploy/daily-test.sh`)는 nightly 로 **eval leg**(`step_eval` →
//     `realdata-e2e-live.smoke-spec.ts`)와 **collect leg**(`step_collect` →
//     `realdata-e2e-github-collection-live.smoke-spec.ts`)를 각 1 회 spawn 한다. 두 leg 의
//     bash 결정 로직은 순수 컴포저 `buildRealDataDailyStepEvalCommandPlan`(T-0611) /
//     `buildRealDataDailyStepCollectCommandPlan`(T-0887)로 외화됐고, 각각 컴포저→bash→
//     parity smoke→가드→self-wire→조립 smoke 까지 동형으로 대칭하게 닫혔다(T-0611…T-0736 ↔
//     T-0887…T-0892).
//   - 두 컴포저는 설계상 **하나의 수렴점(convergence)** 을 공유한다:
//       (1) 동일 gating single-source `resolveRealDataE2eLiveGating(env)`(T-0610)에 위임 —
//           임의 env 에 대해 run/skip 판정이 항상 일치.
//       (2) 동일 jest config 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`(="./test/jest-smoke.json")
//           공유.
//       (3) argv 는 `["--config", <config>, "--runTestsByPath", <spec>]` 4-요소 벡터로
//           동형이되 마지막 원소(spec 경로)만 leg 별로 상이(eval=live smoke / collect=
//           collection live smoke).
//   - 그러나 이 dual-leg convergence 를 **직접-체인으로 묶은 non-gated build-time smoke 는
//     부재**다. 각 leg 단독 조립 smoke(T-0736 eval / T-0892 collect)는 자기 leg 의
//     gating→action→argv 만 검증할 뿐, **두 leg 간 수렴**(공유 gating source·공유 config·
//     spec-only 차이)은 어느 CI 그물도 잡지 못한다 — 향후 한 leg 만 gating 재구현·config
//     하드코딩·argv 순서 변경·spec 경로 cross-wiring 으로 drift 해도 상대 없이 새어나간다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     두 컴포저를 같은 fixture env 로 구동해 (a) 공유 gating 판정 일치 (b) 공유 config
//     byte-identical (c) argv 앞 3 요소 byte-identical + spec 경로만 상이 (d) spec 경로
//     cross-wiring 부재를 직접 박제한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. gating→action→
//         argv 수렴 surface 만 — 실 수집·평가 실행은 두 컴포저 범위 밖.
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. 실 jest 프로세스 spawn 0.
//      🔥 process.env 읽기 0 — fixture env 객체를 직접 주입(env-gated describe.skip 금지).
//      🔥 credential 0 echo — 두 leg argv 는 spec 경로 + config flag 만. 주입한 token-like
//         fixture 값이 어느 leg argv/reason 에도 나타나지 않음(§9).
//      🔥 새 외부 dependency 0 — 기존 두 컴포저 + gating helper import 재사용만(새 컴포저/
//         가드/helper 신설 0).
//
// run-plan dual-leg convergence 정본(T-0753)의 daily-step 쌍 mirror 이며, 각 leg 단독 조립
// smoke(T-0736/T-0892)와 file-disjoint 병렬이다. 본 머지로 daily-step eval↔collect 두 leg 가
// 컴포저 쌍 대칭(T-0611↔T-0887 …)에 더해 수렴 그물까지 닫힌다.
//
// Out of Scope (T-0893):
//   - 각 leg 단독 조립 smoke(T-0736 eval / T-0892 collect) 수정 — 절대 건드리지 않음
//     (file-disjoint 병렬). 본 spec 은 두 leg 간 수렴만 신설.
//   - T-0889 shell↔TS parity-drift smoke 재구현 — bash 배선 대비 argv drift 는 별도 cover.
//   - 두 컴포저 소스 / gating helper / consistency 가드 수정 — test-only(신규 smoke 1 파일).
//   - 실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 live smoke 실행 /
//     Ollama / live-LLM / 실 github 수집 / credential wiring.
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepCollectCommandPlan,
  REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG as COLLECT_SMOKE_JEST_CONFIG,
} from "../helpers/realdata-e2e-daily-step-collect-command-plan";
import {
  buildRealDataDailyStepEvalCommandPlan,
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG as EVAL_SMOKE_JEST_CONFIG,
} from "../helpers/realdata-e2e-daily-step-eval-command-plan";
import {
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
} from "../helpers/realdata-e2e-live-gating";

// gating env 7 종 모두 set 된 완전 fixture — happy-path("run") 수렴 진입용. 실 credential 0,
// 결정론 placeholder 값만(token-like 값은 양 leg argv echo 부재 검증에도 재사용). process.env
// 읽기 0 — 본 객체를 두 컴포저에 각각 직접 주입한다(T-0736/T-0892 fixture 패턴 재사용).
function fullGatingEnv(): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://localhost:11434/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: "smoke-fixture-api-key-TOKENLIKE",
    [REALDATA_E2E_LLM_MODEL_ENV]: "smoke-fixture-model",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-smoke",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: "ghp_smokeFixturePAT_TOKENLIKE",
  };
}

// 양 leg argv/reason echo 부재 검증에 쓸 token-like 값 집합 — 위 fixture 가 주입하는
// credential-성 값들. 어느 leg argv/reason 에도 이 값이 나타나면 안 된다(§9).
const TOKENLIKE_VALUES = [
  "http://localhost:11434/v1",
  "smoke-fixture-api-key-TOKENLIKE",
  "smoke-fixture-model",
  "openai-compatible",
  "2024-smoke",
  "ghp_smokeFixturePAT_TOKENLIKE",
];

// 두 leg 가 공유해야 할 canonical argv 앞 3 요소(config flag + smoke config + runTestsByPath
// flag). 이 prefix 는 양 leg byte-identical 이어야 한다(spec 경로만 상이). 컴포저 상수로부터
// 유도(하드코딩 drift 방지).
const SHARED_ARGV_PREFIX = [
  "--config",
  EVAL_SMOKE_JEST_CONFIG,
  "--runTestsByPath",
];

// 각 leg 의 spec 경로 리터럴(cross-wiring 부재 단언용). eval=live smoke / collect=collection
// live smoke — 두 리터럴은 서로 상대 leg argv 에 등장하면 안 된다.
const EVAL_SPEC_LITERAL = "test/smoke/realdata-e2e-live.smoke-spec.ts";
const COLLECT_SPEC_LITERAL =
  "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts";

describe("Smoke(non-gated): 실 평가 e2e daily-test command-plan eval↔collect dual-leg convergence(공유 gating·공유 config·spec-only 차이) live 0 검증", () => {
  describe("happy path — gating 완전 set → 두 leg 동시 run + argv 수렴", () => {
    it("두 컴포저 모두 action='run' + argv.length===4 + reason 전파", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      const collectPlan =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv());

      // 완전 gating 하에서 두 leg 모두 run 진입(어느 한 leg 만 skip 으로 갈리지 않음).
      expect(evalPlan.action).toBe("run");
      expect(collectPlan.action).toBe("run");
      // 두 leg argv 모두 4-요소 벡터.
      expect(evalPlan.argv).toHaveLength(4);
      expect(collectPlan.argv).toHaveLength(4);
      // reason 은 양 leg 모두 비공백(사람 보고용).
      expect(evalPlan.reason.length).toBeGreaterThan(0);
      expect(collectPlan.reason.length).toBeGreaterThan(0);
    });

    it("argv 앞 3 요소가 두 leg byte-identical + 4 번째(spec 경로)만 상이", () => {
      const evalArgv =
        buildRealDataDailyStepEvalCommandPlan(fullGatingEnv()).argv ?? [];
      const collectArgv =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv()).argv ?? [];

      // 앞 3 요소(--config + smoke config + --runTestsByPath)가 두 leg byte-identical.
      expect(evalArgv.slice(0, 3)).toEqual(SHARED_ARGV_PREFIX);
      expect(collectArgv.slice(0, 3)).toEqual(SHARED_ARGV_PREFIX);
      expect(evalArgv.slice(0, 3)).toEqual(collectArgv.slice(0, 3));
      // 4 번째(spec 경로)만 leg 별로 상이 — eval=live smoke / collect=collection live smoke.
      expect(evalArgv[3]).toBe(REALDATA_E2E_LIVE_SMOKE_SPEC_PATH);
      expect(collectArgv[3]).toBe(
        REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
      );
      expect(evalArgv[3]).not.toBe(collectArgv[3]);
    });
  });

  describe("공유 gating single-source 수렴 — 동일 env 면 두 leg action 항상 일치", () => {
    it("완전 gating(enabled) → 두 leg 모두 'run'(판정 일치)", () => {
      const env = fullGatingEnv();
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(env);
      const collectPlan = buildRealDataDailyStepCollectCommandPlan(env);

      // 같은 env → 두 leg 의 gating 판정(action)이 갈리지 않음.
      expect(evalPlan.action).toBe(collectPlan.action);
      expect(evalPlan.action).toBe("run");
    });

    it("gating 부재(disabled, {}) → 두 leg 모두 'skip'(판정 일치)", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan({});
      const collectPlan = buildRealDataDailyStepCollectCommandPlan({});

      expect(evalPlan.action).toBe(collectPlan.action);
      expect(evalPlan.action).toBe("skip");
    });

    it("부분-set(필수 키 일부 누락) → 두 leg action 여전히 일치('skip')", () => {
      // github PAT 1 종만 누락 — 불완전 gating 이 어느 한 leg 만 run 으로 새지 않음.
      const partial = fullGatingEnv();
      delete partial[REALDATA_E2E_GITHUB_READ_PAT_ENV];
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(partial);
      const collectPlan = buildRealDataDailyStepCollectCommandPlan(partial);

      expect(evalPlan.action).toBe(collectPlan.action);
      expect(evalPlan.action).toBe("skip");
    });
  });

  describe("공유 config 상수 수렴 — REALDATA_E2E_SMOKE_JEST_CONFIG byte-identical", () => {
    it("두 컴포저 export 하는 config 상수가 byte-identical(='./test/jest-smoke.json')", () => {
      // 두 leg 이 export 하는 config 상수 자체가 같은 값(single-source 관례 공유).
      expect(EVAL_SMOKE_JEST_CONFIG).toBe(COLLECT_SMOKE_JEST_CONFIG);
      expect(EVAL_SMOKE_JEST_CONFIG).toBe("./test/jest-smoke.json");
    });

    it("run argv 의 config 요소(index 1)도 두 leg 동일", () => {
      const evalArgv =
        buildRealDataDailyStepEvalCommandPlan(fullGatingEnv()).argv ?? [];
      const collectArgv =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv()).argv ?? [];

      expect(evalArgv[1]).toBe(collectArgv[1]);
      expect(evalArgv[1]).toBe("./test/jest-smoke.json");
    });
  });

  describe("error / branch — gating 부재/부분-set 는 두 leg 모두 조용한 skip(throw 0)", () => {
    it("빈 env({}) → 두 leg 모두 action='skip' + argv === undefined(throw 0)", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan({});
      const collectPlan = buildRealDataDailyStepCollectCommandPlan({});

      expect(evalPlan.action).toBe("skip");
      expect(collectPlan.action).toBe("skip");
      // skip 분기는 argv 를 명시적으로 두지 않음(caller 가 잘못 spawn 하지 않도록 부재).
      expect(evalPlan.argv).toBeUndefined();
      expect(collectPlan.argv).toBeUndefined();
    });

    it("필수 gating 키 일부 누락 → 두 leg 모두 skip(어느 한 leg 만 run 으로 새지 않음)", () => {
      // LLM base URL 만 공백-only — 공백 값은 부재와 동일(non-blank guard).
      const partial = fullGatingEnv();
      partial[REALDATA_E2E_LLM_BASE_URL_ENV] = "   ";
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(partial);
      const collectPlan = buildRealDataDailyStepCollectCommandPlan(partial);

      expect(evalPlan.action).toBe("skip");
      expect(collectPlan.action).toBe("skip");
      expect(evalPlan.argv).toBeUndefined();
      expect(collectPlan.argv).toBeUndefined();
    });

    it("run 분기 — 완전 gating 하에서 두 leg 모두 argv 존재(skip 분기와 명확 분리)", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      const collectPlan =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv());
      expect(evalPlan.action).toBe("run");
      expect(collectPlan.action).toBe("run");
      expect(evalPlan.argv).toBeDefined();
      expect(collectPlan.argv).toBeDefined();
    });
  });

  describe("negative cases — cross-wiring 부재 + credential echo 0 + 결정론·무공유·no-mutation", () => {
    it("(a) 빈 env({}) → 두 leg 모두 skip(완전성 미충족, run 으로 새지 않음)", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan({});
      const collectPlan = buildRealDataDailyStepCollectCommandPlan({});
      expect(evalPlan.action).toBe("skip");
      expect(collectPlan.action).toBe("skip");
    });

    it("(b) enable flag 만 set, 나머지 누락 → 두 leg 모두 skip(부분-set 은 run 으로 새지 않음)", () => {
      const partial: NodeJS.ProcessEnv = {
        [REALDATA_E2E_LIVE_TEST_ENV]: "1",
      };
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(partial);
      const collectPlan = buildRealDataDailyStepCollectCommandPlan(partial);
      expect(evalPlan.action).toBe("skip");
      expect(collectPlan.action).toBe("skip");
    });

    it("(c) spec 경로 cross-wiring 부재 — eval argv 에 collection 경로 부재 + collect argv 에 live 경로 부재", () => {
      const evalArgv =
        buildRealDataDailyStepEvalCommandPlan(fullGatingEnv()).argv ?? [];
      const collectArgv =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv()).argv ?? [];

      const evalJoined = evalArgv.join(" ");
      const collectJoined = collectArgv.join(" ");

      // eval argv 어디에도 collection spec 경로가 없음(cross-wiring 부재, 부등 + 정규식).
      expect(evalArgv).not.toContain(COLLECT_SPEC_LITERAL);
      expect(evalJoined).not.toMatch(/github-collection-live/);
      // collect argv 어디에도 live(eval) spec 경로가 없음. eval spec 은 `realdata-e2e-live`
      // 이고 collect spec 은 `realdata-e2e-github-collection-live` 라 substring 이 겹치므로,
      // collect argv 의 spec 원소가 정확히 eval 리터럴과 동일하지 않음(부등)으로 단언하고,
      // eval-live spec 토큰(`realdata-e2e-live.smoke-spec`)이 collect argv 에 부재함을
      // 정규식으로도 단언한다(collection spec 은 이 토큰을 substring 으로 포함하지 않음).
      expect(collectArgv).not.toContain(EVAL_SPEC_LITERAL);
      expect(collectArgv[3]).not.toBe(EVAL_SPEC_LITERAL);
      expect(collectJoined).not.toMatch(/realdata-e2e-live\.smoke-spec/);
    });

    it("(d) 두 leg argv/reason 이 실 credential 값을 echo 하지 않음(§9)", () => {
      const evalPlan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      const collectPlan =
        buildRealDataDailyStepCollectCommandPlan(fullGatingEnv());

      const evalArgvJoined = (evalPlan.argv ?? []).join(" ");
      const collectArgvJoined = (collectPlan.argv ?? []).join(" ");

      for (const tokenLike of TOKENLIKE_VALUES) {
        expect(evalArgvJoined).not.toContain(tokenLike);
        expect(collectArgvJoined).not.toContain(tokenLike);
        expect(evalPlan.reason).not.toContain(tokenLike);
        expect(collectPlan.reason).not.toContain(tokenLike);
      }
      // 정규식 단언 — token-like 접미사(TOKENLIKE / ghp_ prefix)가 어느 leg 에도 없음.
      expect(evalArgvJoined).not.toMatch(/TOKENLIKE|ghp_/);
      expect(collectArgvJoined).not.toMatch(/TOKENLIKE|ghp_/);
      expect(evalPlan.reason).not.toMatch(/TOKENLIKE|ghp_/);
      expect(collectPlan.reason).not.toMatch(/TOKENLIKE|ghp_/);
    });

    it("(e) 결정론·무공유 — 동일 env 로 각 컴포저 두 번 호출 시 deep-equal + 매 호출 새 plan·새 argv 배열(참조 비동일)", () => {
      const env = fullGatingEnv();

      const evalA = buildRealDataDailyStepEvalCommandPlan(env);
      const evalB = buildRealDataDailyStepEvalCommandPlan(env);
      const collectA = buildRealDataDailyStepCollectCommandPlan(env);
      const collectB = buildRealDataDailyStepCollectCommandPlan(env);

      // 결정론 — 같은 env 두 호출 byte-identical(각 leg 내부).
      expect(evalA).toEqual(evalB);
      expect(collectA).toEqual(collectB);
      // 무공유 — 매 호출 새 plan 컨테이너 + 새 argv 배열(참조 비동일).
      expect(evalA).not.toBe(evalB);
      expect(collectA).not.toBe(collectB);
      expect(evalA.argv).not.toBe(evalB.argv);
      expect(collectA.argv).not.toBe(collectB.argv);
    });

    it("(f) 입력 env mutate 0 — 두 컴포저 각 호출 전후 env deep-equal", () => {
      const env = fullGatingEnv();
      const before = JSON.parse(JSON.stringify(env));

      buildRealDataDailyStepEvalCommandPlan(env);
      buildRealDataDailyStepCollectCommandPlan(env);

      // 두 컴포저 모두 env 를 읽기만(mutate 0) — 호출 후 입력 env 내용 동형.
      expect(env).toEqual(before);
    });
  });
});

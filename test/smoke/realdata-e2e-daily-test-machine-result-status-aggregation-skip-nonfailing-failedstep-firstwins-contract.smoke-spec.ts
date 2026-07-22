// realdata-e2e-daily-test-machine-result-status-aggregation-skip-nonfailing-failedstep-firstwins-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 가 내보내는 머신 요약 JSON 의
// **result/failedStep 상태-집계 contract** 를 실 shell 파일을 readFileSync 로 읽어(실행/source 0)
// 정적 검증하는 non-gated build-time smoke (T-0944, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// gap: T-1122 가 eval_chain 을 8번째 step 으로 배선하면서 nightly 는 SKIP-gated 프로파일을
// 가진다(cloud CI / 일반 LAN: eval·collect·rediscovery·eval_chain SKIP). 이때 집계 불변식 — (a) SKIP 은
// result 를 FAIL 로 뒤집지 않음(false 알람 0)·failedStep=null, (b) 실 FAIL 이면 result=FAIL +
// failedStep 은 첫 FAIL step 만(first-FAIL-wins), (c) SKIP 은 PASS/FAIL 과 구분되는 제3 토큰으로
// steps 값에 직렬화 — 은 origin/main 검증 0 부재였다(T-0791 parity-drift 는 스키마/직렬화 형식만
// 봉하고 steps 값은 dummy "PASS" 만 채움). 본 spec 이 그 상보적 표면(집계 값 semantics)을 닫는다.
//
// 전략(T-0791 동형): daily-test.sh 를 readFileSync 로 읽어 RESULT 루프·mark first-FAIL guard·
// steps_json 직렬화 표현식을 정적 앵커로 추출하고, 그 bash semantics 를 TS 순수 함수로 동형
// 모델링해 8-step PASS/FAIL/SKIP 조합의 result/failedStep 산출을 assert.
//   🔥 실 redeploy/HTTP/jest spawn/gh/git 0 — 파일 read + 정적 추출 + 합성 JSON.parse 만.
//   🔥 gating 분기 0 — non-gated 항상 실행(describe.skip 0). credential 0(§9/REQ-059).
//   🔥 새 외부 dependency 0(node 내장 fs/path). src 변경 0(test-only). daily-test.sh 읽기만.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// step 상태 토큰 — bash mark 헬퍼가 STEP_STATUS 에 넣는 3-토큰(제3 토큰 SKIP 이 PASS/FAIL 과
// 구분됨). 미지 토큰(UNKNOWN 등)은 실 shell semantics 상 FAIL 이 아니므로 result 를 뒤집지 않음.
type StepStatus = "PASS" | "FAIL" | "SKIP" | string;

// step 순회 정본 ORDER(`deploy/daily-test.sh` 287행) — result/steps 집계 순회 source.
// T-0943 에서 `rediscovery` 가 7번째 원소로 append 됨.
// T-1122 에서 `eval_chain` 이 8번째 원소로 append 됨(step_eval_chain full-chain bash 배선).
const ORDER = [
  "redeploy",
  "health",
  "liveness",
  "auth",
  "eval",
  "collect",
  "rediscovery",
  "eval_chain",
] as const;

// TS 동형 집계 모델(정본) — daily-test.sh 의 bash 집계 semantics 를 순수 함수로 모델링.
//   - mark first-FAIL-wins(261~266행): ORDER 순회로 첫 FAIL step 만 failedStep 에 박제.
//   - RESULT FAIL-only 루프(360~363행): RESULT="PASS" init + FAIL 이 하나라도 있으면 FAIL
//     (SKIP/PASS/미지 토큰은 result 불변). 입력(stepStatus)은 mutate 하지 않는다.
function aggregate(
  stepStatus: Readonly<Record<string, StepStatus>>,
  order: readonly string[],
): { result: "PASS" | "FAIL"; failedStep: string | null } {
  let result: "PASS" | "FAIL" = "PASS";
  let failedStep: string | null = null;
  for (const s of order) {
    if (stepStatus[s] === "FAIL") {
      // RESULT FAIL-only: FAIL 이 하나라도 있으면 result=FAIL.
      result = "FAIL";
      // first-FAIL-wins: failedStep 이 아직 null 일 때만 세팅(첫 FAIL 만 박제).
      if (failedStep === null) {
        failedStep = s;
      }
    }
  }
  return { result, failedStep };
}

// steps_json 직렬화 동형 모델(`deploy/daily-test.sh` 368~372행) — ORDER 순회로 각 step 의
// STEP_STATUS 값을 그대로 직렬화(SKIP 도 PASS/FAIL 과 동일 슬롯의 제3 토큰). 입력 mutate 0.
function buildStepsJson(
  stepStatus: Readonly<Record<string, StepStatus>>,
  order: readonly string[],
): string {
  const inner = order.map((s) => `"${s}":"${stepStatus[s]}"`).join(",");
  return `{${inner}}`;
}

// 정적 앵커 추출: RESULT 집계 루프가 shell 소스에 실재하는지(FAIL-only 표현식).
function hasResultLoopAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('RESULT="PASS"') &&
    shellSource.includes('[ "${STEP_STATUS[$s]}" = "FAIL" ] && RESULT="FAIL"')
  );
}

// 정적 앵커 추출: mark first-FAIL guard 가 shell 소스에 실재하는지.
function hasMarkFirstFailAnchor(shellSource: string): boolean {
  return shellSource.includes(
    '[ "$2" = "FAIL" ] && [ "$FAILED_STEP" = "null" ]',
  );
}

// 정적 앵커 추출: steps_json 직렬화 루프(STEP_STATUS 값 그대로 직렬화)가 실재하는지.
function hasStepsJsonSerializationAnchor(shellSource: string): boolean {
  return shellSource.includes(
    'steps_json="$steps_json,\\"$s\\":\\"${STEP_STATUS[$s]}\\""',
  );
}

// 헬퍼: ORDER 전체를 단일 토큰으로 채운 profile 을 만든다(all-SKIP / all-PASS 등).
function uniformProfile(
  token: StepStatus,
  order: readonly string[] = ORDER,
): Record<string, StepStatus> {
  const p: Record<string, StepStatus> = {};
  for (const s of order) {
    p[s] = token;
  }
  return p;
}

describe("realdata-e2e step④ daily-test.sh 머신 요약 JSON result/failedStep 상태-집계 contract smoke — SKIP 비-failing · first-FAIL-wins · SKIP 제3 토큰 (T-0944)", () => {
  describe("Happy-path: dormant all-SKIP 프로파일 → result=PASS·failedStep=null", () => {
    it("8-step 이 모두 SKIP 이면 result==='PASS' AND failedStep===null(cloud CI / 일반 LAN 기본 nightly 프로파일이 false 알람 0)", () => {
      const { result, failedStep } = aggregate(uniformProfile("SKIP"), ORDER);
      expect(result).toBe("PASS");
      expect(failedStep).toBeNull();
    });

    it("SKIP+PASS 혼합(FAIL 0) 프로파일도 result==='PASS' AND failedStep===null(SKIP 이 result 를 뒤집지 않음)", () => {
      const mixed: Record<string, StepStatus> = {
        redeploy: "SKIP",
        health: "PASS",
        liveness: "PASS",
        auth: "PASS",
        eval: "SKIP",
        collect: "SKIP",
        rediscovery: "SKIP",
        eval_chain: "SKIP",
      };
      const { result, failedStep } = aggregate(mixed, ORDER);
      expect(result).toBe("PASS");
      expect(failedStep).toBeNull();
    });
  });

  describe("Happy-path: 정적 앵커 존재(집계 semantics 가 실 shell 앵커에 근거)", () => {
    it("실 deploy/daily-test.sh 를 읽어 RESULT 집계 루프·mark first-FAIL guard·steps_json 직렬화 표현식이 소스에 등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // (a) RESULT 집계 루프(FAIL-only).
      expect(hasResultLoopAnchor(shellSource)).toBe(true);
      expect(shellSource).toContain('RESULT="PASS"');
      // (b) mark first-FAIL guard.
      expect(hasMarkFirstFailAnchor(shellSource)).toBe(true);
      // (c) steps_json 직렬화 루프(STEP_STATUS 값 그대로).
      expect(hasStepsJsonSerializationAnchor(shellSource)).toBe(true);
      // ORDER 8-원소 앵커도 실재(집계 순회 source).
      expect(shellSource).toContain(
        "ORDER=(redeploy health liveness auth eval collect rediscovery eval_chain)",
      );
    });
  });

  describe("branch: 단일 FAIL → result=FAIL·failedStep=그 step", () => {
    it("8-step 중 정확히 1개(liveness)만 FAIL(나머지 SKIP/PASS)이면 result==='FAIL' AND failedStep==='liveness'", () => {
      const profile: Record<string, StepStatus> = {
        redeploy: "PASS",
        health: "PASS",
        liveness: "FAIL",
        auth: "SKIP",
        eval: "SKIP",
        collect: "SKIP",
        rediscovery: "SKIP",
        eval_chain: "SKIP",
      };
      const { result, failedStep } = aggregate(profile, ORDER);
      expect(result).toBe("FAIL");
      expect(failedStep).toBe("liveness");
    });

    it("첫 step(redeploy) 단일 FAIL 도 result==='FAIL' AND failedStep==='redeploy'", () => {
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("SKIP"),
        redeploy: "FAIL",
      };
      const { result, failedStep } = aggregate(profile, ORDER);
      expect(result).toBe("FAIL");
      expect(failedStep).toBe("redeploy");
    });
  });

  describe("branch: first-FAIL-wins(다중 FAIL) → failedStep 은 ORDER 상 첫 FAIL step 만", () => {
    it("health·auth·collect 3개가 FAIL 이면 failedStep 은 ORDER index 최소인 'health'(이후 FAIL 이 덮어쓰지 않음), result 는 FAIL", () => {
      const profile: Record<string, StepStatus> = {
        redeploy: "PASS",
        health: "FAIL",
        liveness: "PASS",
        auth: "FAIL",
        eval: "SKIP",
        collect: "FAIL",
        rediscovery: "SKIP",
        eval_chain: "SKIP",
      };
      const { result, failedStep } = aggregate(profile, ORDER);
      expect(result).toBe("FAIL");
      expect(failedStep).toBe("health");
    });

    it("두 step(collect·rediscovery)만 FAIL 이면 failedStep==='collect'(ORDER 상 먼저)", () => {
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("PASS"),
        collect: "FAIL",
        rediscovery: "FAIL",
      };
      const { result, failedStep } = aggregate(profile, ORDER);
      expect(result).toBe("FAIL");
      expect(failedStep).toBe("collect");
    });

    it("전 step FAIL(all-FAIL)이면 failedStep 은 ORDER 첫 원소 'redeploy'", () => {
      const { result, failedStep } = aggregate(uniformProfile("FAIL"), ORDER);
      expect(result).toBe("FAIL");
      expect(failedStep).toBe("redeploy");
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 미지 상태 토큰(UNKNOWN) 주입 시 실 shell semantics 동형(FAIL 만 result 를 뒤집으므로 미지 토큰은 result 불변)", () => {
      // 실 shell 의 RESULT 루프는 `= "FAIL"` 만 검사 → UNKNOWN 은 PASS 처럼 result 불변.
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("SKIP"),
        health: "UNKNOWN",
        auth: "UNKNOWN",
      };
      const { result, failedStep } = aggregate(profile, ORDER);
      expect(result).toBe("PASS"); // 미지 토큰은 FAIL 이 아니므로 result 불변
      expect(failedStep).toBeNull();

      // 미지 토큰 + 실 FAIL 이 섞이면 result=FAIL, failedStep 은 그 FAIL(미지 토큰은 무시).
      const withFail: Record<string, StepStatus> = {
        ...uniformProfile("UNKNOWN"),
        eval: "FAIL",
      };
      const agg2 = aggregate(withFail, ORDER);
      expect(agg2.result).toBe("FAIL");
      expect(agg2.failedStep).toBe("eval");
    });

    it("negative (a) — SKIP 비-failing 변별성: all-SKIP 과 all-PASS 가 둘 다 result=PASS·failedStep=null 로 동형 수렴", () => {
      const allSkip = aggregate(uniformProfile("SKIP"), ORDER);
      const allPass = aggregate(uniformProfile("PASS"), ORDER);
      expect(allSkip).toEqual({ result: "PASS", failedStep: null });
      expect(allPass).toEqual({ result: "PASS", failedStep: null });
      // SKIP 이 PASS 와 result 집계상 동치(SKIP 이 FAIL 로 오집계되면 이 assert FAIL).
      expect(allSkip).toEqual(allPass);
    });

    it("negative (b) — SKIP 은 steps 값에서 제3 토큰으로 보존(PASS/FAIL 로 뭉개지지 않고 JSON round-trip)", () => {
      const profile: Record<string, StepStatus> = {
        redeploy: "PASS",
        health: "PASS",
        liveness: "PASS",
        auth: "PASS",
        eval: "SKIP",
        collect: "SKIP",
        rediscovery: "SKIP",
        eval_chain: "SKIP",
      };
      const stepsJson = buildStepsJson(profile, ORDER);
      const parsed = JSON.parse(stepsJson) as Record<string, string>;
      // SKIP 슬롯이 "SKIP" 문자열로 round-trip(제3 토큰 보존).
      expect(parsed.eval).toBe("SKIP");
      expect(parsed.collect).toBe("SKIP");
      expect(parsed.rediscovery).toBe("SKIP");
      expect(parsed.eval_chain).toBe("SKIP");
      // PASS 슬롯은 "PASS" 로 구분 보존.
      expect(parsed.redeploy).toBe("PASS");
      // 키 집합은 ORDER 와 동일.
      expect(Object.keys(parsed)).toEqual([...ORDER]);
    });

    it("negative (c) — 집계 drift 변별성: SKIP 을 FAIL 로 집계하는 mutant 모델이 정본 result 와 not.toEqual(원본 mutate 0)", () => {
      // 정본: SKIP 은 result 를 뒤집지 않음.
      const profile = uniformProfile("SKIP");
      const canonical = aggregate(profile, ORDER);

      // mutant(사본): SKIP 도 FAIL 처럼 result 를 뒤집는 잘못된 집계.
      const mutantAggregate = (
        stepStatus: Readonly<Record<string, StepStatus>>,
        order: readonly string[],
      ): { result: "PASS" | "FAIL"; failedStep: string | null } => {
        let result: "PASS" | "FAIL" = "PASS";
        let failedStep: string | null = null;
        for (const s of order) {
          if (stepStatus[s] === "FAIL" || stepStatus[s] === "SKIP") {
            result = "FAIL";
            if (failedStep === null) {
              failedStep = s;
            }
          }
        }
        return { result, failedStep };
      };
      const mutant = mutantAggregate(profile, ORDER);

      // 본 smoke 가 실제로 집계 drift 를 잡음을 입증.
      expect(mutant).not.toEqual(canonical);
      expect(canonical.result).toBe("PASS");
      expect(mutant.result).toBe("FAIL");
      // 원본 profile 은 mutate 0 — 여전히 all-SKIP.
      expect(profile).toEqual(uniformProfile("SKIP"));
    });

    it("negative (d) — failedStep 덮어쓰기 drift 변별성: last-FAIL-wins mutant 이 정본 first-wins 와 다른 step 산출", () => {
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("PASS"),
        health: "FAIL",
        collect: "FAIL",
      };
      const canonical = aggregate(profile, ORDER);

      // mutant(사본): last-FAIL-wins — guard 없이 매 FAIL 마다 덮어씀.
      const mutantLastWins = (
        stepStatus: Readonly<Record<string, StepStatus>>,
        order: readonly string[],
      ): { result: "PASS" | "FAIL"; failedStep: string | null } => {
        let result: "PASS" | "FAIL" = "PASS";
        let failedStep: string | null = null;
        for (const s of order) {
          if (stepStatus[s] === "FAIL") {
            result = "FAIL";
            failedStep = s; // guard 없음 → 매번 덮어씀(last-wins)
          }
        }
        return { result, failedStep };
      };
      const mutant = mutantLastWins(profile, ORDER);

      // 정본 first-wins: failedStep==='health'(ORDER 상 먼저).
      expect(canonical.failedStep).toBe("health");
      // mutant last-wins: failedStep==='collect'(ORDER 상 뒤).
      expect(mutant.failedStep).toBe("collect");
      expect(mutant.failedStep).not.toBe(canonical.failedStep);
      // result 는 둘 다 FAIL(집계 값 아닌 failedStep 계약만 다름).
      expect(canonical.result).toBe("FAIL");
      expect(mutant.result).toBe("FAIL");
    });

    it("negative (e) — credential 누출 0: 추출/합성 문자열(RESULT 루프 텍스트·steps_json·합성 JSON)에 gh 토큰 어휘 미등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const stepsJson = buildStepsJson(uniformProfile("SKIP"), ORDER);
      const canonicalJson = JSON.stringify(
        aggregate(uniformProfile("FAIL"), ORDER),
      );
      // RESULT 루프 텍스트 슬라이스(앵커 주변).
      const resultLoopSlice = shellSource.slice(
        shellSource.indexOf('RESULT="PASS"'),
        shellSource.indexOf('RESULT="PASS"') + 200,
      );

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [resultLoopSlice, stepsJson, canonicalJson];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 shell 소스로 앵커 추출·집계 모델을 두 번 호출하면 byte-identical deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const a1 = hasResultLoopAnchor(shellSource);
      const a2 = hasResultLoopAnchor(shellSource);
      expect(a1).toBe(a2);

      const profile: Record<string, StepStatus> = {
        ...uniformProfile("SKIP"),
        auth: "FAIL",
        collect: "FAIL",
      };
      const agg1 = aggregate(profile, ORDER);
      const agg2 = aggregate(profile, ORDER);
      expect(agg1).toEqual(agg2);

      const s1 = buildStepsJson(profile, ORDER);
      const s2 = buildStepsJson(profile, ORDER);
      expect(s1).toBe(s2);
    });

    it("집계·직렬화 보조 함수가 입력(STEP_STATUS 사본·shell 문자열)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      hasResultLoopAnchor(shellSource);
      hasMarkFirstFailAnchor(shellSource);
      hasStepsJsonSerializationAnchor(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      // 집계 모델이 입력 profile 을 mutate 0.
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("PASS"),
        health: "FAIL",
      };
      const profileSnapshot = { ...profile };
      aggregate(profile, ORDER);
      buildStepsJson(profile, ORDER);
      expect(profile).toEqual(profileSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("집계·직렬화 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      // 집계 모델은 어떤 env 도 읽지 않으므로, env 를 임의로 비워도 동일 결과를 낸다.
      const envSnapshot = { ...process.env };
      const profile: Record<string, StepStatus> = {
        ...uniformProfile("SKIP"),
        collect: "FAIL",
      };
      const before = aggregate(profile, ORDER);
      // env 를 mutate 해도 집계 결과가 불변 — 모델이 gating env 를 참조하지 않음을 입증.
      const injected = { INJECTED_GATING_ENV: "1" };
      Object.assign(process.env, injected);
      const after = aggregate(profile, ORDER);
      delete process.env.INJECTED_GATING_ENV;
      expect(after).toEqual(before);
      // env 원복(테스트 side-effect 0).
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 shell 실행/source 0(추출 결과가 문자열이지 실행 산출물이 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 읽은 값은 shell 스크립트 텍스트(첫 줄 shebang)일 뿐 실행 결과가 아님.
      expect(shellSource.startsWith("#!")).toBe(true);
      // 앵커 추출은 순수 문자열 검사(실행 0).
      expect(hasResultLoopAnchor(shellSource)).toBe(true);
    });
  });
});

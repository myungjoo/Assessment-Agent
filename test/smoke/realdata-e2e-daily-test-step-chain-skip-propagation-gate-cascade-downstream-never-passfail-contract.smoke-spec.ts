// realdata-e2e-daily-test-step-chain-skip-propagation-gate-cascade-downstream-never-passfail-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 의 **step-chaining SKIP-propagation
// gate cascade** 를 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated
// build-time smoke (T-0947, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 봉함 불변식: **downstream step 은 precondition 체인이 끊기면 절대 PASS/FAIL 아닌 SKIP.** 무인
// nightly 모니터링이 파싱하는 step status 가 false-positive/negative 신호를 내지 않도록 cascade 가
// 구조적으로 차단. cascade 계약 5종(실 소스 gate 앵커): (a) SKIP_REDEPLOY=1 → redeploy SKIP(281행,
// PASS 아님) · (b) redeploy FAIL → health SKIP(291행 `!= "FAIL"`) · (c) health != PASS → liveness+auth
// SKIP(297행 `:-SKIP == PASS`) · (d) auth != PASS → eval·collect·rediscovery SKIP(308/326/345행) ·
// (e) gating 부재 → 3 leg SKIP(311/329/348행 `! realdata_eval_gating_enabled`).
//
// 전략(T-0944 동형): 5종 gate 표현을 정적 앵커 추출 + bash semantics 를 TS 순수 함수
// `computeChainedStatuses(outcomes, opts)` 로 동형 모델링해 outcomes→profile cascade 산출 assert.
// T-0944(profile→result/failedStep 집계 `aggregate`)와 distinct surface(outcomes→profile gate).
//   🔥 실 redeploy/HTTP/jest spawn/gh/git 0 · gating 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0 · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// step 상태 토큰 — bash mark 헬퍼가 STEP_STATUS 에 넣는 3-토큰(제3 토큰 SKIP 이 PASS/FAIL 과 구분).
type StepStatus = "PASS" | "FAIL" | "SKIP";

// 실행됐을 때 각 step 이 내는 본연의 결과(PASS/FAIL). cascade 는 이 outcome 을 gate 통과 시에만
// 채택하고, precondition 이 끊긴 downstream 에는 outcome 을 무시하고 SKIP 을 강제한다.
type RunOutcome = "PASS" | "FAIL";

// step 순회 정본 ORDER(`deploy/daily-test.sh` 259행) — cascade 산출 순회 source.
const ORDER = [
  "redeploy",
  "health",
  "liveness",
  "auth",
  "eval",
  "collect",
  "rediscovery",
] as const;
type StepName = (typeof ORDER)[number];

// realdata-e2e 3 leg(auth PASS + gating 필요) — eval/collect/rediscovery 동형 gate.
const REALDATA_LEGS: StepName[] = ["eval", "collect", "rediscovery"];

type Outcomes = Partial<Record<StepName, RunOutcome>>;
interface ChainOpts {
  skipRedeploy?: boolean;
  gatingEnabled?: boolean;
}
type Profile = Record<StepName, StepStatus>;

// TS 동형 cascade 모델(정본) — daily-test.sh 279~357행 step-chaining gate cascade 를 순수 함수로
// 모델링. 입력(outcomes 객체·opts)은 mutate 하지 않는다(읽기만). outcome 미지정 step 은 실행 시
// PASS 로 간주(happy-path 편의) — gate 로 SKIP 되면 outcome 은 무시된다.
function computeChainedStatuses(
  outcomes: Readonly<Outcomes>,
  opts: Readonly<ChainOpts> = {},
): Profile {
  const skipRedeploy = opts.skipRedeploy ?? false;
  const gatingEnabled = opts.gatingEnabled ?? false;
  // gate 를 통과해 "실행" 됐을 때 그 step 이 내는 본연의 결과.
  const run = (step: StepName): StepStatus => outcomes[step] ?? "PASS";

  const status = {} as Profile;

  // (a) redeploy — SKIP_REDEPLOY=1 이면 SKIP(not PASS, 281행), 아니면 실행 결과.
  status.redeploy = skipRedeploy ? "SKIP" : run("redeploy");

  // (b) health gate — redeploy 가 FAIL 이 아니면(PASS 또는 SKIP = non-FAIL) 진행, 아니면 SKIP(291행).
  status.health = status.redeploy !== "FAIL" ? run("health") : "SKIP";

  // (c) liveness+auth gate — health 가 PASS 일 때만 둘 다 실행, 아니면 둘 다 SKIP(297행 `:-SKIP` default).
  if (status.health === "PASS") {
    status.liveness = run("liveness");
    status.auth = run("auth");
  } else {
    status.liveness = "SKIP";
    status.auth = "SKIP";
  }

  // (d)+(e) realdata-e2e 3 leg — auth != PASS 면 SKIP(308/326/345), auth PASS 라도 gating 부재면
  // SKIP(311/329/348). 둘 다 충족일 때만 실행 결과. 3 leg 동형 gate.
  for (const leg of REALDATA_LEGS) {
    if (status.auth !== "PASS") {
      status[leg] = "SKIP";
    } else if (!gatingEnabled) {
      status[leg] = "SKIP";
    } else {
      status[leg] = run(leg);
    }
  }

  return status;
}

// 헬퍼: downstream(redeploy·health 제외한 나머지 5 step)이 전부 SKIP 인지 — false-positive 차단
// 불변식 확인용(precondition 끊기면 never PASS/FAIL).
function allSkipExcept(profile: Profile, kept: StepName[]): boolean {
  return ORDER.filter((s) => !kept.includes(s)).every(
    (s) => profile[s] === "SKIP",
  );
}

// ── 정적 앵커 추출 보조 함수 (실 bash gate 표현이 소스에 실재하는지) ──────────────────────

// (a) SKIP_REDEPLOY 분기가 `mark redeploy SKIP`(not PASS)로 표기하는지(281~283행).
function hasSkipRedeployAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('if [ "$SKIP_REDEPLOY" = "1" ]; then') &&
    shellSource.includes("mark redeploy SKIP")
  );
}

// (b) health gate `[ "${STEP_STATUS[redeploy]}" != "FAIL" ]`(291행) — redeploy non-FAIL → health 진행.
function hasHealthGateAnchor(shellSource: string): boolean {
  return shellSource.includes('[ "${STEP_STATUS[redeploy]}" != "FAIL" ]');
}

// (c) liveness+auth gate `[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]`(297행) — `:-SKIP` default 포함.
function hasLivenessAuthGateAnchor(shellSource: string): boolean {
  return shellSource.includes('[ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]');
}

// 소스 내 needle 등장 횟수(3 leg gate 는 eval/collect/rediscovery 에 각각 → 3회 기대).
function countOccurrences(shellSource: string, needle: string): number {
  let count = 0;
  let idx = shellSource.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = shellSource.indexOf(needle, idx + needle.length);
  }
  return count;
}

// (d) realdata 3 leg auth gate `[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]`(308/326/345행) — 3회.
function countAuthGateAnchors(shellSource: string): number {
  return countOccurrences(
    shellSource,
    '[ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]',
  );
}

// (e) gating gate `! realdata_eval_gating_enabled`(311/329/348행) — 3회.
function countGatingGateAnchors(shellSource: string): number {
  return countOccurrences(shellSource, "! realdata_eval_gating_enabled");
}

// 5종 gate 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractCascadeGateAnchors(shellSource: string): {
  skipRedeploy: boolean;
  healthGate: boolean;
  livenessAuthGate: boolean;
  authGateCount: number;
  gatingGateCount: number;
} {
  return {
    skipRedeploy: hasSkipRedeployAnchor(shellSource),
    healthGate: hasHealthGateAnchor(shellSource),
    livenessAuthGate: hasLivenessAuthGateAnchor(shellSource),
    authGateCount: countAuthGateAnchors(shellSource),
    gatingGateCount: countGatingGateAnchors(shellSource),
  };
}

describe("realdata-e2e step④ daily-test.sh step-chaining SKIP-propagation gate cascade contract smoke — downstream 은 precondition 미충족 시 절대 PASS/FAIL 아닌 SKIP (T-0947)", () => {
  describe("Happy-path: 전부 성공 경로 → 7 step 모두 PASS", () => {
    it("redeploy·health·liveness·auth 실행 성공 + gating enabled + 3 leg 성공이면 7 step 전부 PASS(정상 nightly)", () => {
      const profile = computeChainedStatuses(
        {
          redeploy: "PASS",
          health: "PASS",
          liveness: "PASS",
          auth: "PASS",
          eval: "PASS",
          collect: "PASS",
          rediscovery: "PASS",
        },
        { skipRedeploy: false, gatingEnabled: true },
      );
      for (const s of ORDER) {
        expect(profile[s]).toBe("PASS");
      }
    });
  });

  describe("Happy-path: cascade gate 앵커 정적 추출(TS 모델이 실 bash gate 를 mirror)", () => {
    it("실 deploy/daily-test.sh 를 읽어 5종 cascade gate 표현이 소스에 존재(SKIP_REDEPLOY·redeploy!=FAIL·health:-SKIP==PASS·auth:-SKIP!=PASS×3·!gating×3)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractCascadeGateAnchors(shellSource);
      expect(anchors.skipRedeploy).toBe(true);
      expect(anchors.healthGate).toBe(true);
      expect(anchors.livenessAuthGate).toBe(true);
      // auth gate·gating gate 는 3 leg(eval/collect/rediscovery) 에 각각 → 정확히 3회 등장.
      expect(anchors.authGateCount).toBe(3);
      expect(anchors.gatingGateCount).toBe(3);
      // ORDER 7-원소·mark 헬퍼 앵커도 실재(cascade 순회 source).
      expect(shellSource).toContain(
        "ORDER=(redeploy health liveness auth eval collect rediscovery)",
      );
    });
  });

  describe("Happy-path: SKIP_REDEPLOY=1 → redeploy SKIP(not PASS)·이후 health 는 non-FAIL 로 진행", () => {
    it("skipRedeploy:true 면 redeploy===SKIP(not PASS) AND health 는 진행(redeploy SKIP 은 non-FAIL)", () => {
      const profile = computeChainedStatuses(
        { health: "PASS", liveness: "PASS", auth: "PASS" },
        { skipRedeploy: true, gatingEnabled: false },
      );
      // redeploy 는 SKIP(281행) — PASS 아님(실행 성공 아님).
      expect(profile.redeploy).toBe("SKIP");
      expect(profile.redeploy).not.toBe("PASS");
      // health gate 는 redeploy 를 non-FAIL 로 취급 → 진행(SKIP≠FAIL).
      expect(profile.health).toBe("PASS");
      // gating 부재라 3 leg 은 SKIP(auth PASS 라도 gating 필요).
      expect(profile.eval).toBe("SKIP");
    });

    it("소스에서 SKIP_REDEPLOY 분기가 `mark redeploy SKIP`(not `mark redeploy PASS`)임을 정적 확인", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain("mark redeploy SKIP");
      // SKIP_REDEPLOY 블록(281~288행) 슬라이스 내에서 첫 mark 가 SKIP 이어야 함.
      const branchStart = shellSource.indexOf(
        'if [ "$SKIP_REDEPLOY" = "1" ]; then',
      );
      expect(branchStart).toBeGreaterThan(-1);
      const branchSlice = shellSource.slice(branchStart, branchStart + 120);
      expect(branchSlice).toContain("mark redeploy SKIP");
    });
  });

  describe("branch: redeploy FAIL → health SKIP → 전 downstream SKIP(291/297/308 전파)", () => {
    it("redeploy=FAIL 이면 health=SKIP 이고 liveness·auth·eval·collect·rediscovery 전부 SKIP(redeploy 만 FAIL)", () => {
      const profile = computeChainedStatuses(
        { redeploy: "FAIL" },
        { gatingEnabled: true },
      );
      expect(profile.redeploy).toBe("FAIL");
      expect(profile.health).toBe("SKIP");
      // 나머지 downstream 은 절대 PASS/FAIL 아니고 전부 SKIP.
      expect(allSkipExcept(profile, ["redeploy"])).toBe(true);
      for (const s of [
        "liveness",
        "auth",
        "eval",
        "collect",
        "rediscovery",
      ] as StepName[]) {
        expect(profile[s]).toBe("SKIP");
      }
    });
  });

  describe("branch: health FAIL/SKIP → liveness+auth 둘 다 SKIP → 3 leg SKIP(297 gate)", () => {
    it("redeploy=PASS·health=FAIL 이면 liveness·auth 둘 다 SKIP 이고 eval/collect/rediscovery 도 SKIP", () => {
      const profile = computeChainedStatuses(
        { redeploy: "PASS", health: "FAIL" },
        { gatingEnabled: true },
      );
      expect(profile.health).toBe("FAIL");
      expect(profile.liveness).toBe("SKIP");
      expect(profile.auth).toBe("SKIP");
      // auth SKIP 이므로 3 leg 도 SKIP.
      for (const leg of REALDATA_LEGS) {
        expect(profile[leg]).toBe("SKIP");
      }
      expect(allSkipExcept(profile, ["redeploy", "health"])).toBe(true);
    });

    it("health 가 미실행 SKIP(redeploy SKIP → health 진행했으나 health 자체 SKIP 시나리오 아님) — health!=PASS 일반화: liveness+auth 둘 다 SKIP", () => {
      // redeploy=SKIP(non-FAIL) → health 진행, health outcome=FAIL → liveness+auth SKIP.
      const profile = computeChainedStatuses(
        { health: "FAIL" },
        { skipRedeploy: true, gatingEnabled: true },
      );
      expect(profile.redeploy).toBe("SKIP");
      expect(profile.health).toBe("FAIL");
      expect(profile.liveness).toBe("SKIP");
      expect(profile.auth).toBe("SKIP");
    });
  });

  describe("branch: auth FAIL → eval·collect·rediscovery 3종 SKIP(308/326/345 동일 gate)", () => {
    it("앞 체인 PASS·auth=FAIL 이면 eval·collect·rediscovery 3 leg 모두 SKIP(3개 각각 auth!=PASS gate)", () => {
      const profile = computeChainedStatuses(
        {
          redeploy: "PASS",
          health: "PASS",
          liveness: "PASS",
          auth: "FAIL",
        },
        { gatingEnabled: true },
      );
      expect(profile.auth).toBe("FAIL");
      // liveness 는 health PASS 라 실행됨(PASS) — auth 와 병렬 leg, cascade 상 downstream 아님.
      expect(profile.liveness).toBe("PASS");
      // 3 leg 각각 SKIP.
      expect(profile.eval).toBe("SKIP");
      expect(profile.collect).toBe("SKIP");
      expect(profile.rediscovery).toBe("SKIP");
    });
  });

  describe("branch: auth PASS + gating 부재 → eval·collect·rediscovery SKIP(311/329/348 gate)", () => {
    it("auth=PASS 지만 gatingEnabled:false 면 3 leg 모두 SKIP(auth PASS 만으로는 leg 실행 불충분)", () => {
      const profile = computeChainedStatuses(
        {
          redeploy: "PASS",
          health: "PASS",
          liveness: "PASS",
          auth: "PASS",
          eval: "PASS",
          collect: "PASS",
          rediscovery: "PASS",
        },
        { gatingEnabled: false },
      );
      // 앞 체인은 전부 PASS.
      expect(profile.auth).toBe("PASS");
      expect(profile.liveness).toBe("PASS");
      // gating 부재라 3 leg 은 outcome(PASS) 무시하고 SKIP.
      for (const leg of REALDATA_LEGS) {
        expect(profile[leg]).toBe("SKIP");
      }
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — cascade gate 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(gate 표현 부재)에서 추출기가 false / 0 을 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractCascadeGateAnchors(emptySource);
      expect(anchors.skipRedeploy).toBe(false);
      expect(anchors.healthGate).toBe(false);
      expect(anchors.livenessAuthGate).toBe(false);
      expect(anchors.authGateCount).toBe(0);
      expect(anchors.gatingGateCount).toBe(0);
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractCascadeGateAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.authGateCount).toBe(3);
    });

    it("negative (a) — downstream never PASS/FAIL 불변식 위반 변별: health!=PASS 인데 liveness 를 run 시키는 mutant 에서 불변식 assert 실패", () => {
      // mutant(사본): health 게이트를 무시하고 liveness 를 항상 outcome 으로 실행(잘못된 cascade).
      const mutantIgnoreHealthGate = (
        outcomes: Readonly<Outcomes>,
      ): Profile => {
        const canonical = computeChainedStatuses(outcomes, {
          gatingEnabled: false,
        });
        // 위반 주입: health 가 PASS 아닌데도 liveness 를 outcome 으로 강제 실행.
        return { ...canonical, liveness: outcomes.liveness ?? "PASS" };
      };

      const outcomes: Outcomes = {
        redeploy: "PASS",
        health: "FAIL",
        liveness: "PASS",
      };
      const canonical = computeChainedStatuses(outcomes, {
        gatingEnabled: false,
      });
      const mutant = mutantIgnoreHealthGate(outcomes);

      // 정본: health FAIL → liveness SKIP(불변식 준수).
      expect(canonical.liveness).toBe("SKIP");
      // mutant: liveness=PASS(불변식 위반) → 본 smoke 가 회귀를 잡음.
      expect(mutant.liveness).toBe("PASS");
      expect(mutant.liveness).not.toBe(canonical.liveness);
      // "precondition 끊긴 downstream 은 SKIP" 불변식 assert 가 mutant 에서 실패함을 실증.
      expect(allSkipExcept(canonical, ["redeploy", "health"])).toBe(true);
      expect(allSkipExcept(mutant, ["redeploy", "health"])).toBe(false);
      // 원본 outcomes 는 mutate 0.
      expect(outcomes).toEqual({
        redeploy: "PASS",
        health: "FAIL",
        liveness: "PASS",
      });
    });

    it("negative (b) — SKIP_REDEPLOY → PASS drift 변별: redeploy 를 PASS 로 마킹하는 mutant 이 정본 SKIP 과 다름", () => {
      const outcomes: Outcomes = { health: "PASS", auth: "PASS" };
      const canonical = computeChainedStatuses(outcomes, {
        skipRedeploy: true,
        gatingEnabled: false,
      });
      // mutant(사본): SKIP_REDEPLOY 경로에서 redeploy 를 PASS 로 잘못 마킹(실행 안 한 걸 성공 보고).
      const mutantSkipToPass = (): Profile => {
        const base = computeChainedStatuses(outcomes, {
          skipRedeploy: false, // redeploy 를 실행 성공(PASS)처럼 취급하는 drift
          gatingEnabled: false,
        });
        return base;
      };
      const mutant = mutantSkipToPass();

      // 정본: redeploy=SKIP(실행 안 함).
      expect(canonical.redeploy).toBe("SKIP");
      // mutant: redeploy=PASS(false 성공 보고) → 회귀 검출.
      expect(mutant.redeploy).toBe("PASS");
      expect(mutant.redeploy).not.toBe(canonical.redeploy);

      // 소스 문자열 mutant: `mark redeploy SKIP` → `mark redeploy PASS` 치환 사본에서
      // "SKIP_REDEPLOY 경로는 SKIP(not PASS)" 정적 assert 가 실패함을 실증(원본 문자열 mutate 0).
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const mutatedSource = shellSource.replace(
        "mark redeploy SKIP",
        "mark redeploy PASS",
      );
      expect(hasSkipRedeployAnchor(shellSource)).toBe(true); // 원본은 SKIP 앵커 존재
      expect(hasSkipRedeployAnchor(mutatedSource)).toBe(false); // 사본은 SKIP 앵커 소실
      // 원본 소스 문자열은 mutate 0.
      expect(shellSource).toContain("mark redeploy SKIP");
    });

    it("negative (c) — redeploy gate 축소 drift 변별: health gate 를 `!= FAIL` 에서 `== PASS` 로 좁힌 mutant 에서 SKIP→진행 계약 실패", () => {
      // 정본: redeploy=SKIP(SKIP_REDEPLOY 경로) → health 진행(non-FAIL).
      const canonical = computeChainedStatuses(
        { health: "PASS" },
        { skipRedeploy: true, gatingEnabled: false },
      );
      // mutant(사본): health gate 를 `redeploy == PASS` 로 좁힘 → redeploy SKIP 이면 health 잘못 SKIP.
      const mutantNarrowedGate = (
        outcomes: Readonly<Outcomes>,
        opts: Readonly<ChainOpts>,
      ): Profile => {
        const status = {} as Profile;
        // SKIP_REDEPLOY 경로면 SKIP, 아니면 실행 결과(정본과 동일한 redeploy 산출).
        status.redeploy = opts.skipRedeploy
          ? "SKIP"
          : (outcomes.redeploy ?? "PASS");
        // 축소된 gate: redeploy === PASS 일 때만 health 진행(정본은 != FAIL).
        status.health =
          status.redeploy === "PASS" ? (outcomes.health ?? "PASS") : "SKIP";
        status.liveness = "SKIP";
        status.auth = "SKIP";
        status.eval = "SKIP";
        status.collect = "SKIP";
        status.rediscovery = "SKIP";
        return status;
      };
      const mutant = mutantNarrowedGate(
        { health: "PASS" },
        { skipRedeploy: true, gatingEnabled: false },
      );

      // 정본: redeploy SKIP → health 진행(PASS).
      expect(canonical.redeploy).toBe("SKIP");
      expect(canonical.health).toBe("PASS");
      // mutant: redeploy SKIP 을 non-PASS 로 취급 → health 잘못 SKIP.
      expect(mutant.health).toBe("SKIP");
      expect(mutant.health).not.toBe(canonical.health);
    });

    it("negative (d) — auth gate leg 누락 drift 변별: eval leg 에서 auth!=PASS 검사 제거한 mutant 에서 auth FAIL→leg SKIP 실패", () => {
      const outcomes: Outcomes = {
        redeploy: "PASS",
        health: "PASS",
        liveness: "PASS",
        auth: "FAIL",
        eval: "PASS",
      };
      const canonical = computeChainedStatuses(outcomes, {
        gatingEnabled: true,
      });
      // mutant(사본): eval gate 에서 auth 체인 검사를 빼고 gating 만 확인 → auth FAIL 에도 eval 실행 시도.
      const mutantMissingAuthGate = (): Profile => {
        const base = computeChainedStatuses(outcomes, { gatingEnabled: true });
        // auth 체인 무시하고 gating enabled 면 eval 을 outcome 으로 실행(network/secret 노출 회귀).
        return { ...base, eval: outcomes.eval ?? "PASS" };
      };
      const mutant = mutantMissingAuthGate();

      // 정본: auth FAIL → eval SKIP(gate 준수).
      expect(canonical.eval).toBe("SKIP");
      // mutant: auth FAIL 무시 → eval=PASS(leg 실행 시도) → 회귀 검출.
      expect(mutant.eval).toBe("PASS");
      expect(mutant.eval).not.toBe(canonical.eval);
    });

    it("negative (e) — credential 누출 0: 추출/합성하는 어떤 문자열에도 gh 토큰 어휘 미등장(gating env 이름만 가능·실값 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const profile = computeChainedStatuses(
        { redeploy: "FAIL" },
        { gatingEnabled: true },
      );
      const profileJson = JSON.stringify(profile);
      const gateNames = REALDATA_LEGS.join(",");
      const anchorSlice = shellSource.slice(
        shellSource.indexOf('[ "$SKIP_REDEPLOY" = "1" ]'),
        shellSource.indexOf('[ "$SKIP_REDEPLOY" = "1" ]') + 300,
      );

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [profileJson, gateNames, anchorSlice, ORDER.join(",")];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 outcomes 입력으로 computeChainedStatuses 를 두 번 호출하면 deep-equal(결정론)", () => {
      const outcomes: Outcomes = {
        redeploy: "PASS",
        health: "PASS",
        liveness: "PASS",
        auth: "PASS",
      };
      const opts: ChainOpts = { gatingEnabled: true };
      const p1 = computeChainedStatuses(outcomes, opts);
      const p2 = computeChainedStatuses(outcomes, opts);
      expect(p1).toEqual(p2);
    });

    it("동일 shell 소스로 gate 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const a1 = extractCascadeGateAnchors(shellSource);
      const a2 = extractCascadeGateAnchors(shellSource);
      expect(a1).toEqual(a2);
    });

    it("cascade 모델·추출 보조 함수가 입력(outcomes 객체·shell 문자열·opts)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractCascadeGateAnchors(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const outcomes: Outcomes = {
        redeploy: "PASS",
        health: "FAIL",
        auth: "PASS",
      };
      const outcomesSnapshot = { ...outcomes };
      const opts: ChainOpts = { skipRedeploy: false, gatingEnabled: true };
      const optsSnapshot = { ...opts };
      computeChainedStatuses(outcomes, opts);
      expect(outcomes).toEqual(outcomesSnapshot);
      expect(opts).toEqual(optsSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("cascade 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — gating 은 opts 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const outcomes: Outcomes = {
        redeploy: "PASS",
        health: "PASS",
        auth: "PASS",
      };
      const before = computeChainedStatuses(outcomes, { gatingEnabled: true });
      // env 를 mutate 해도 cascade 결과 불변 — 모델이 gating env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { INJECTED_GATING_ENV: "1" });
      const after = computeChainedStatuses(outcomes, { gatingEnabled: true });
      delete process.env.INJECTED_GATING_ENV;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 shell 실행/source 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasHealthGateAnchor(shellSource)).toBe(true);
    });
  });
});

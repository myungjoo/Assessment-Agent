// realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// 최외곽 컴포저(buildRealDataE2eRunPlan)의 **dual-leg(pipeline·run) single-source
// convergence** non-gated build-time smoke (T-0753 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - 최외곽 단일 진입 컴포저 `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597) 는
//     두 leg 를 단일 plan 으로 합류시킨다:
//       (1) pipeline leg — buildRealDataPipelinePlan(seeds, modelId) 위임 산출.
//           seed-side 진입 plan({collectCallArgs, modelId})을 thread.
//       (2) run leg — 검증(assertRunRefNonBlank gitSha/dateToken)·복사된 run 식별자
//           {gitSha, dateToken}.
//   - 컴포저 핵심 불변식은 **두 leg 가 각자의 단일 source 로부터 합류**한다는 것이다 —
//     pipeline leg 은 위임 컴포저 단일 source, run leg 은 입력 run 의 검증·복사 단일
//     source. 두 leg 는 서로 독립 thread(한쪽 입력 변경이 다른 leg 에 누출되지 않음)이며,
//     pipeline guard 가 run guard 보다 먼저 평가된다(guard-ordering).
//   - 그러나 이 dual-leg(pipeline·run) single-source convergence 를 **직접-체인으로 묶은
//     non-gated build-time smoke 는 부재**다. 기존 realdata-e2e-assembly.smoke-spec.ts
//     (T-0728) 는 buildRealDataE2eRunPlan 을 step-args aggregator 로 가는 setup 으로만
//     쓰고 `runPlan.pipeline.modelId === MODEL_ID` + `runPlan.run === RUN_REF` 의 shallow
//     단언만 한다. (a) runPlan.pipeline 이 직접 호출 buildRealDataPipelinePlan(seeds,
//     modelId) 와 byte-identical(pipeline leg 단일 source) (b) partial-thread 격리(다른
//     seeds→pipeline 만 변함·run 불변, 다른 run→run 만 변함·pipeline 불변) (c) pipeline
//     guard 가 run guard 보다 먼저 평가됨(guard-ordering) 을 직접 단언하는 smoke 는 0 이다.
//     이는 T-0752 가 닫은 downstream aggregator(buildRealDataE2eStepArgs) convergence 의
//     **upstream 대칭 sibling** — runPlan 자체를 합성하는 컴포저의 절단면이다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     pipeline leg byte-identical / run leg single-source / partial-thread 격리 /
//     guard-ordering / negative guard 전파를 직접-체인으로 박제한다. leg-swap·leg-drift·
//     partial-thread·guard-order-flip 회귀를 public CI 그물로 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//
// Out of Scope (T-0753):
//   - 기존 realdata-e2e-assembly.smoke-spec.ts(T-0728) 의 shallow runPlan 단언 수정 /
//     중복 it 이관 — 본 spec 은 신규 파일만(별도 sweep 금지).
//   - downstream aggregator(buildRealDataE2eStepArgs) convergence 재단언 — T-0752 가 이미
//     cover. 본 spec 은 upstream runPlan 합성만.
//   - test/helpers/realdata-e2e-run-plan.ts 또는 어떤 컴포저 helper 의 로직 변경(컴포저
//     재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
//   - 실 수집 / collectForPerson / 실 scoring / scoreUnit / 실 LLM round-trip / Ollama /
//     DB / 실 gh / 실 git sha·timestamp / 실 jest spawn / 실 네트워크.
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import { buildRealDataPipelinePlan } from "../helpers/realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 모든 it 가 같은 결정론 입력을 공유한다(매 호출 새 객체 트리).
const MODEL_ID = "cfg-realdata-e2e-run-plan-dual-leg-smoke";
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 매 호출 새 RUN_REF 복사본 — 입력-무공유 단언이 fixture 상수를 오염시키지 않도록.
function freshRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

describe("Smoke(non-gated): 실 평가 e2e run-plan 컴포저 dual-leg(pipeline·run) single-source convergence", () => {
  describe("happy path — 두 leg 동시 합류", () => {
    it("buildRealDataE2eRunPlan(seeds, modelId, run) — 반환 { pipeline, run } 의 두 필드가 모두 정의·shape 보유", () => {
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());

      // pipeline leg — seed-side 진입 plan({collectCallArgs, modelId}) shape.
      expect(runPlan.pipeline).toBeDefined();
      expect(Array.isArray(runPlan.pipeline.collectCallArgs)).toBe(true);
      expect(typeof runPlan.pipeline.modelId).toBe("string");
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);

      // run leg — 검증·복사된 run 식별자({gitSha, dateToken}) shape.
      expect(runPlan.run).toBeDefined();
      expect(runPlan.run.gitSha).toBe(RUN_REF.gitSha);
      expect(runPlan.run.dateToken).toBe(RUN_REF.dateToken);
    });
  });

  describe("dual-leg single-source convergence (핵심) — 각 leg ↔ 직접 호출 byte-identical", () => {
    it("(a) runPlan.pipeline 이 직접 호출 buildRealDataPipelinePlan(seeds, modelId) 와 byte-identical(toEqual) 이며 새 객체(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());

      // 같은 seeds·modelId 로 pipeline 컴포저를 직접 재호출 → 최외곽 컴포저의 pipeline
      // leg 와 deep-equal(pipeline leg 이 위임 컴포저 단일 source 로부터 합류).
      const directPipeline = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(runPlan.pipeline).toEqual(directPipeline);
      // 동시에 새 객체로 무공유(직접-재호출 산출과 참조 비동일 — 매 호출 새 트리).
      expect(runPlan.pipeline).not.toBe(directPipeline);
    });

    it("(b) runPlan.run 이 입력 run 과 byte-identical(toEqual — gitSha·dateToken 보존)이며 새 객체(not.toBe — 검증 후 복사, 입력과 무공유)", () => {
      const seeds = buildRealDataE2eSeed();
      const inputRun = freshRun();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, inputRun);

      // run leg — 입력 run 의 두 토큰 보존(deep-equal).
      expect(runPlan.run).toEqual(inputRun);
      // 검증 통과 후 새 객체로 복사 — 입력 run 객체와 참조 비동일(무공유).
      expect(runPlan.run).not.toBe(inputRun);
    });
  });

  describe("partial-thread 격리 (branch) — 두 leg 가 서로 독립 thread", () => {
    it("다른 seeds → pipeline leg 만 변함·run leg 불변(교차 누출 0)", () => {
      const baseSeeds = buildRealDataE2eSeed();
      // 단일-원소 변형 seeds(다른 username·email·externalId) — pipeline leg 만 영향.
      const otherSeeds: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "other-user",
            email: "other-user@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            {
              service: "github.com",
              externalId: "other-user",
              isPrimary: true,
            },
          ],
        },
      ];

      const a = buildRealDataE2eRunPlan(baseSeeds, MODEL_ID, freshRun());
      const b = buildRealDataE2eRunPlan(otherSeeds, MODEL_ID, freshRun());

      // pipeline 은 seeds 에 의존 → 다른 seeds 면 변함.
      expect(a.pipeline).not.toEqual(b.pipeline);
      // run 은 seeds 무관 → 같은 run 입력이면 불변.
      expect(a.run).toEqual(b.run);
    });

    it("다른 modelId → pipeline leg 만 변함·run leg 불변", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());
      const b = buildRealDataE2eRunPlan(seeds, `${MODEL_ID}-v2`, freshRun());

      // pipeline.modelId 가 modelId 에 의존 → 다른 modelId 면 pipeline 변함.
      expect(a.pipeline).not.toEqual(b.pipeline);
      // run 은 modelId 무관 → 불변.
      expect(a.run).toEqual(b.run);
    });

    it("다른 run(다른 gitSha) → run leg 만 변함·pipeline leg 불변", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());
      const b = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: "def5678",
        dateToken: RUN_REF.dateToken,
      });

      // pipeline 은 run 무관 → 같은 seeds·modelId 면 불변.
      expect(a.pipeline).toEqual(b.pipeline);
      // run 은 gitSha 에 의존 → 다른 gitSha 면 변함.
      expect(a.run).not.toEqual(b.run);
    });

    it("다른 run(다른 dateToken) → run leg 만 변함·pipeline leg 불변", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());
      const b = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: RUN_REF.gitSha,
        dateToken: "2026-07-01",
      });

      expect(a.pipeline).toEqual(b.pipeline);
      expect(a.run).not.toEqual(b.run);
    });
  });

  describe("guard-ordering (branch) — pipeline guard 가 run guard 보다 먼저 평가됨", () => {
    it("빈 modelId + 빈 run.gitSha 동시 입력 → pipeline 측 modelId guard 가 우선 throw(run guard 미도달)", () => {
      const seeds = buildRealDataE2eSeed();
      // modelId 와 run.gitSha 모두 빈 입력 — 합성 순서상 pipeline 위임((1)) 이 run
      // guard((2)) 보다 먼저 평가되므로 modelId guard 가 먼저 throw 해야 한다.
      let caught: Error | undefined;
      try {
        buildRealDataE2eRunPlan(seeds, "", { gitSha: "", dateToken: "" });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      // pipeline 측 modelId guard 의 메시지로 우선 throw 확인(run guard 메시지 아님).
      expect(caught?.message).toContain("buildRealDataPipelinePlan");
      expect(caught?.message).toContain("modelId");
      // run guard 메시지(RealDataResultIssueRunRef.gitSha) 는 도달하지 않았음을 단언.
      expect(caught?.message).not.toContain("RealDataResultIssueRunRef");
    });
  });

  describe("error / negative — guard 전파(자체 try/catch 0)", () => {
    it("빈 modelId → 위임 pipeline guard throw 전파", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataE2eRunPlan(seeds, "", freshRun())).toThrow(
        /modelId/,
      );
    });

    it("공백만의 modelId → 위임 pipeline guard throw 전파", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataE2eRunPlan(seeds, "   ", freshRun())).toThrow(
        /modelId/,
      );
    });

    it("빈 run.gitSha → 본 컴포저 run guard 명시적 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow(/gitSha/);
    });

    it("공백만의 run.gitSha → run guard throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow(/gitSha/);
    });

    it("빈 run.dateToken → run guard throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow(/dateToken/);
    });

    it("공백만의 run.dateToken → run guard throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow(/dateToken/);
    });

    it("externalId 빈/공백 seed → 하위 collect 매퍼 throw 전파(run guard 미도달)", () => {
      // externalId 가 빈 seed — pipeline 위임 안 collect 매퍼가 throw 해야 하고, 그
      // throw 가 본 컴포저 run guard((2)) 도달 전에 전파된다.
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "bad",
            email: "bad@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "   ", isPrimary: true },
          ],
        },
      ];
      expect(() =>
        buildRealDataE2eRunPlan(badSeeds, MODEL_ID, freshRun()),
      ).toThrow();
    });
  });

  describe("flow / branch — 빈·단일·다수 seeds 분기", () => {
    it("빈 seeds + 유효 modelId + 유효 run → pipeline.collectCallArgs: [] + run 보존(throw 0)", () => {
      const runPlan = buildRealDataE2eRunPlan([], MODEL_ID, freshRun());
      expect(runPlan.pipeline.collectCallArgs).toEqual([]);
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      expect(runPlan.run).toEqual(RUN_REF);
    });

    it("단일 seed → pipeline 이 1:1 매핑, run 보존", () => {
      const singleSeed: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "solo",
            email: "solo@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "solo", isPrimary: true },
          ],
        },
      ];
      const runPlan = buildRealDataE2eRunPlan(singleSeed, MODEL_ID, freshRun());
      // pipeline 은 위임 컴포저 직접 호출과 byte-identical(단일-source convergence 유지).
      expect(runPlan.pipeline).toEqual(
        buildRealDataPipelinePlan(singleSeed, MODEL_ID),
      );
      expect(runPlan.run).toEqual(RUN_REF);
    });

    it("다수 seed → convergence 유지(pipeline byte-identical + run 보존)", () => {
      // 기본 fixture(myungjoo/leemgs 2 인) — 다수 seed 분기.
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());
      expect(runPlan.pipeline).toEqual(
        buildRealDataPipelinePlan(seeds, MODEL_ID),
      );
      expect(runPlan.pipeline.collectCallArgs.length).toBeGreaterThan(1);
      expect(runPlan.run).toEqual(RUN_REF);
    });
  });

  describe("결정론·무공유·no-mutation", () => {
    it("동일 (seeds, modelId, run) 두 번 호출 → deep-equal + 새 plan 객체(not.toBe) + leg 트리도 새 객체", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());
      const b = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());

      // 결정론 — 동일 입력 두 호출 byte-identical.
      expect(a).toEqual(b);
      // 매 호출 새 plan 컨테이너 + 새 leg 트리(반환 참조 비동일).
      expect(a).not.toBe(b);
      expect(a.pipeline).not.toBe(b.pipeline);
      expect(a.run).not.toBe(b.run);
    });

    it("입력 seeds / run mutate 0 — 호출 전후 deep-equal", () => {
      const seeds = buildRealDataE2eSeed();
      const run = freshRun();
      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const runBefore = JSON.parse(JSON.stringify(run));

      buildRealDataE2eRunPlan(seeds, MODEL_ID, run);

      expect(seeds).toEqual(seedsBefore);
      expect(run).toEqual(runBefore);
    });
  });

  describe("R-59 raw 본문 누출 0 — plan 은 식별자·modelId·run 토큰만 보유", () => {
    it("sentinel — raw 외부 활동 본문(commit/PR/issue body)이 plan 직렬화에 구조적으로 미등장", () => {
      // seeds / modelId / run 어디에도 raw 본문은 입력되지 않으며, 컴포저는 식별자·
      // modelId·run 토큰만 thread 하므로 raw 본문 sentinel 은 plan 에 등장할 수 없다.
      const sentinel = "SENTINEL-RAW-BODY-DO-NOT-LEAK-0753";
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, freshRun());

      const serialized = JSON.stringify(runPlan);
      // 입력에 부재한 sentinel 은 산출에도 부재(구조적 미포함 — R-59).
      expect(serialized).not.toContain(sentinel);
      // plan 은 collectCallArgs(식별자) + modelId + run 토큰만 — narrative/body 키 부재.
      expect(serialized).not.toContain("narrative");
      expect(serialized).not.toContain('"body"');
    });
  });
});

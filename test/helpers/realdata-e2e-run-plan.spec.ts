// realdata-e2e-run-plan.spec.ts — T-0597 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 단일 seed + 유효 modelId + 유효 run → pipeline 이 T-0592 산출과
//     deep-equal + run 보존, (b) 다수 seed 동형, (c) 반환 shape({pipeline, run}) 검증.
//   - error path: (a) modelId 빈/공백 → 위임 pipeline guard throw 전파, (b) externalId
//     빈/공백 seed → 하위 collect 매퍼 throw 전파, (c) run.gitSha 빈/공백 → run guard
//     throw, (d) run.dateToken 빈/공백 → run guard throw — 각 1+.
//   - flow/branch: (a) guard 순서 — pipeline guard(modelId/seed)가 run guard 보다 먼저
//     평가됨(빈 seeds + 빈 modelId + 유효 run → modelId throw 우선), (b) 빈 seeds + 유효
//     modelId + 유효 run → collectCallArgs 빈 배열 + run 보존(throw 0) 경계.
//   - negative 충분 cover(단일 negative 금지 — 예외 분기마다): modelId 공백-only/탭개행,
//     externalId 공백-only seed, gitSha 공백-only/탭개행, dateToken 공백-only/탭개행 —
//     각 throw + 무공유/not-same-ref 검증.
//   - 결정론·무공유: 동일 (seeds, modelId, run) 2회 호출 → deep-equal + plan/pipeline/run
//     not-same-ref, 입력 seeds 배열·원소 / run 객체 mutate 0(호출 전후 deep-equal 스냅샷).
//   - R-59: plan 이 {pipeline, run} 필드만 보유(raw narrative 키 0).
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import * as consistency from "./realdata-e2e-run-plan-consistency";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// 유효 modelId fixture — 평가 정책 모델 식별 문자열.
const MODEL_ID = "qwen2.5:7b";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// seed descriptor fixture 생성기 — github.com identity 1 개 보유 정규 shape.
function makeSeed(externalId: string): RealDataSeedDescriptor {
  return {
    person: {
      fullName: externalId,
      email: `${externalId}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [{ service: "github.com", externalId, isPrimary: true }],
  };
}

const SINGLE: RealDataSeedDescriptor[] = [makeSeed("myungjoo")];
const MULTIPLE: RealDataSeedDescriptor[] = [
  makeSeed("myungjoo"),
  makeSeed("leemgs"),
];

describe("buildRealDataE2eRunPlan — 실 평가 e2e 최외곽 run plan 컴포저", () => {
  describe("happy-path — pipeline + run 합성", () => {
    it("단일 seed + 유효 modelId + 유효 run → pipeline 이 T-0592 산출과 deep-equal + run 보존", () => {
      const plan = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);

      expect(plan.pipeline).toEqual(
        buildRealDataPipelinePlan(SINGLE, MODEL_ID),
      );
      expect(plan.run).toEqual(RUN);
    });

    it("다수 seed → pipeline.collectCallArgs 가 위임 산출과 deep-equal + modelId 보존", () => {
      const plan = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      expect(plan.pipeline).toEqual(
        buildRealDataPipelinePlan(MULTIPLE, MODEL_ID),
      );
      expect(plan.pipeline.collectCallArgs).toHaveLength(2);
      expect(plan.pipeline.modelId).toBe(MODEL_ID);
    });

    it("plan 키가 정확히 {pipeline, run}", () => {
      const plan = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);

      expect(Object.keys(plan).sort()).toEqual(["pipeline", "run"].sort());
    });
  });

  describe("flow / branch 분기 cover — guard 순서 + 빈 seeds 경계", () => {
    it("빈 seeds + 유효 modelId + 유효 run → collectCallArgs 빈 배열 + run 보존(throw 0)", () => {
      const plan = buildRealDataE2eRunPlan([], MODEL_ID, RUN);

      expect(plan.pipeline.collectCallArgs).toEqual([]);
      expect(plan.pipeline.modelId).toBe(MODEL_ID);
      expect(plan.run).toEqual(RUN);
    });

    it("guard 순서 — 빈 seeds + 빈 modelId + 유효 run → modelId guard(pipeline)가 우선 throw", () => {
      expect(() => buildRealDataE2eRunPlan([], "", RUN)).toThrow(
        /modelId 는 빈 문자열/,
      );
    });

    it("guard 순서 — 빈 modelId + 빈 run 동시 → pipeline guard 가 run guard 보다 먼저 throw(modelId 메시지)", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, "", { gitSha: "", dateToken: "" }),
      ).toThrow(/modelId 는 빈 문자열/);
    });
  });

  describe("error path — 위임 throw 전파 + run guard throw", () => {
    it("modelId 빈 문자열 → 위임 pipeline guard throw 전파", () => {
      expect(() => buildRealDataE2eRunPlan(SINGLE, "", RUN)).toThrow(
        /modelId 는 빈 문자열/,
      );
    });

    it("externalId 빈 문자열 seed → 하위 collect 매퍼 throw 전파", () => {
      expect(() =>
        buildRealDataE2eRunPlan([makeSeed("")], MODEL_ID, RUN),
      ).toThrow(/externalId 가 비어있거나 공백뿐입니다/);
    });

    it("run.gitSha 빈 문자열 → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("negative cases 충분 cover — 예외 분기마다 별도 throw", () => {
    it("modelId 공백-only → 위임 pipeline guard throw", () => {
      expect(() => buildRealDataE2eRunPlan(SINGLE, "   ", RUN)).toThrow(
        /modelId 는 빈 문자열/,
      );
    });

    it("modelId 탭·개행만 → 위임 pipeline guard throw", () => {
      expect(() => buildRealDataE2eRunPlan(SINGLE, "\t\n", RUN)).toThrow(
        /modelId 는 빈 문자열/,
      );
    });

    it("externalId 공백-only seed → 하위 collect 매퍼 throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan([makeSeed("   ")], MODEL_ID, RUN),
      ).toThrow(/externalId 가 비어있거나 공백뿐입니다/);
    });

    it("run.gitSha 공백-only → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "   ",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 탭·개행 → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "\t\n",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 공백-only → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("run.dateToken 탭·개행 → run guard throw", () => {
      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "\t\n",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정론·무공유·입력 보존", () => {
    it("동일 (seeds, modelId, run) 두 번 호출 → deep-equal 결과", () => {
      const first = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);
      const second = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan / pipeline / run 객체(not-same-ref) 반환", () => {
      const first = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);
      const second = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);

      expect(first).not.toBe(second);
      expect(first.pipeline).not.toBe(second.pipeline);
      expect(first.run).not.toBe(second.run);
    });

    it("반환 run 이 입력 run 과 not-same-ref(새 객체로 복사 — 출력 mutate 가 입력에 누설 0)", () => {
      const inputRun: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-23",
      };
      const plan = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, inputRun);
      plan.run.gitSha = "오염";

      expect(inputRun.gitSha).toBe("abc1234");
    });

    it("반환 plan.pipeline.collectCallArgs mutate(push) 가 재호출 결과에 누설되지 않음(무공유)", () => {
      const first = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);
      first.pipeline.collectCallArgs.push({
        person: { serviceIdentities: [] },
        since: undefined,
        assessmentId: "오염",
      });

      const second = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);
      expect(second.pipeline.collectCallArgs).toHaveLength(1);
    });

    it("입력 seeds 배열·원소 / run 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const seedsSnapshot = JSON.parse(JSON.stringify(MULTIPLE));
      const runSnapshot = { ...RUN };

      buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      expect(MULTIPLE).toEqual(seedsSnapshot);
      expect(RUN).toEqual(runSnapshot);
    });
  });

  describe("R-59 정합 — plan 이 {pipeline, run} 필드만 보유", () => {
    it("plan 에 raw narrative / 원본 활동 본문 키 0", () => {
      const plan = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);

      // pipeline 은 collectCallArgs(식별자) + modelId(문자열)만, run 은 식별 토큰만.
      expect(Object.keys(plan.pipeline).sort()).toEqual(
        ["collectCallArgs", "modelId"].sort(),
      );
      expect(Object.keys(plan.run).sort()).toEqual(
        ["dateToken", "gitSha"].sort(),
      );
    });
  });

  // T-0678 self-wire 배선 검증 — 컴포저가 산출 plan({pipeline, run}) 반환 직전 consistency
  // 가드를 (산출 runPlan, seeds, modelId, run) 인자로 정확히 1회 self-assert 하는지, 정상
  // 합성이면 throw 0·반환 plan byte-identical·무공유 불변, 가드가 throw 하면 컴포저가
  // 삼키지 않고 전파하는지, 위임/run guard throw 입력에서는 가드 진입 전 그 throw 가
  // 전파(가드 미호출)되는지 검증.
  describe("consistency 가드 self-wire (T-0678) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(단일 seed) → 가드가 (산출 runPlan, seeds, modelId, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      const plan = buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 runPlan, seeds, modelId, run) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, SINGLE, MODEL_ID, RUN);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(SINGLE);
      expect(spy.mock.calls[0][2]).toBe(MODEL_ID);
      expect(spy.mock.calls[0][3]).toBe(RUN);
    });

    it("다수 seed 분기에서도 가드가 (산출 runPlan, seeds, modelId, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      const plan = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, MULTIPLE, MODEL_ID, RUN);
    });

    it("빈 seeds 경계 분기에서도 가드가 (산출 runPlan, [], modelId, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );
      const emptySeeds: RealDataSeedDescriptor[] = [];

      const plan = buildRealDataE2eRunPlan(emptySeeds, MODEL_ID, RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, emptySeeds, MODEL_ID, RUN);
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 가드 미배선 기대값(위임 pipeline + run 복사)과 byte-identical(불변)", () => {
      const plan = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      // self-wire 가 반환 plan 을 변형하지 않음 — 위임 산출 + run 입력과 byte-identical.
      expect(plan.pipeline).toEqual(
        buildRealDataPipelinePlan(MULTIPLE, MODEL_ID),
      );
      expect(plan.run).toEqual(RUN);
    });

    it("가드가 throw 하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataE2eRunPlanConsistentWithSources")
        .mockImplementation(() => {
          throw new RangeError("정합 위반: self-wire 가드 모의 throw");
        });

      expect(() => buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN)).toThrow(
        /self-wire 가드 모의 throw/,
      );
    });

    it("위임 pipeline throw 입력(modelId 공백-only)에서는 가드 진입 전 위임 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      expect(() => buildRealDataE2eRunPlan(SINGLE, "   ", RUN)).toThrow(
        /modelId 는 빈 문자열/,
      );
      // 위임 pipeline guard 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("externalId 공백-only seed 입력에서도 가드 진입 전 하위 매퍼 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataE2eRunPlan([makeSeed("   ")], MODEL_ID, RUN),
      ).toThrow(/externalId 가 비어있거나 공백뿐입니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("run.gitSha 공백-only 입력에서는 가드 진입 전 run guard throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "  ",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
      // run guard 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("run.dateToken 공백-only 입력에서도 가드 진입 전 run guard throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataE2eRunPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataE2eRunPlan(SINGLE, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: " \t\n ",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 plan 무공유", () => {
      const seedsSnapshot = JSON.stringify(MULTIPLE);
      const runSnapshot = JSON.stringify(RUN);

      const a = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);
      const b = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);

      // 비변형(seeds/run mutate 0).
      expect(JSON.stringify(MULTIPLE)).toBe(seedsSnapshot);
      expect(JSON.stringify(RUN)).toBe(runSnapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 plan 의 pipeline/run 트리 mutate 가 후속 호출 결과에 누출 0).
      a.pipeline.collectCallArgs.push({
        person: { serviceIdentities: [] },
        since: undefined,
        assessmentId: "오염",
      });
      const c = buildRealDataE2eRunPlan(MULTIPLE, MODEL_ID, RUN);
      expect(c.pipeline.collectCallArgs).toHaveLength(2);
    });
  });
});

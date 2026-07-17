// realdata-e2e-terminal-sequence-collect-evaluate-result-publish-order-lock.smoke-spec.ts
// — 실 평가 e2e 종단 4-seam 시퀀스(collect→evaluate→result→publish) 실행 순서
// order-lock non-gated build-time smoke (T-1097 박제, §D 후보 (c) leg1, PLAN.md 109행).
//
// 존재 이유(T-1096 audit 섹션 C 축 2 / 섹션 D 후보 1): 기존 조립·17-way threading smoke 는
// 각 seam 을 개별 threading 하나, collect→evaluate→result→publish 4-seam 을 한 flow 에서
// 순차 실행해 실행 순서를 `invocationCallOrder` 로 못박는 종단-시퀀스 spec 은 부재였다
// (`grep -rlE 'invocationCallOrder' test/smoke/` → 0). 본 spec 은 gating 없는 일반 describe
// 로 4-seam 대표 builder 에 `jest.spyOn` 을 걸어 실행 순서를 lock 한다. 평가·수집 leg 는
// synthetic literal 로 우회 — 실 LLM/네트워크/gh 호출 0, fetch 0, process.env 0, credential
// 0(R-113 public CI 항상 발화). 새 컴포저/가드 신설 0(기존 build* import 재사용).
//
// 4-seam 대표 builder(spy 대상): collect=`buildRealDataE2eRunPlan`(collect 조립 진입점,
// Required Reading L33), evaluate=`buildRealDataEvaluationStepArgs`,
// result=`buildRealDataResultOutcomeStepArgs`, publish=`buildRealDataResultPublishStepArgs`.
// 본 4 builder 는 서로를 내부 호출하지 않아 spy invocationCallOrder 가 flow 의 명시적 호출만
// 계측한다. pre-실행 aggregator `buildRealDataE2eStepArgs` 는 내부에서 evaluate/publish 를
// live ESM 바인딩으로 재호출하므로 spy set 에서 제외한다(포함 시 순서 계측 오염).
//
// Out of Scope(T-1097): 실 LLM/orchestrator/gateway/Ollama/실 gh — synthetic 대체(live leg 는
// realdata-e2e-live.smoke-spec.ts 책임). §D 후보 2(인자-충실도)는 후속 leg. 기존 smoke 수정·
// production src/ 변경 0(신규 파일 1개, seam builder export 재사용).
import type {
  Activity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import * as evaluationStepArgsModule from "../helpers/realdata-e2e-evaluation-step-args";
import * as resultOutcomeStepArgsModule from "../helpers/realdata-e2e-result-outcome-step-args";
import * as resultPublishStepArgsModule from "../helpers/realdata-e2e-result-publish-step-args";
import * as runPlanModule from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// 결정론 상수 + 정상 issue URL stdout(개행 포함, 실 gh round-trip 0).
const MODEL_ID = "cfg-realdata-e2e-terminal-sequence-order-lock-smoke";
const RUN_REF = { gitSha: "abc1234", dateToken: "2026-07-18" } as const;
const INSTANCE_KEY = "github.com";
const RESULT_STDOUT = "https://github.com/myungjoo/AA_S1/issues/42\n";

// synthetic GithubActivity — author = seed 첫 username(single-source 보존).
function syntheticActivity(author: string): GithubActivity {
  return {
    sourceType: "github",
    externalId: "realdata-e2e-terminal-sequence-c1",
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind: "commit",
  };
}

// synthetic EvaluationResult — 도메인 타입 정합만 만족하는 minimal literal(실 LLM 0).
function makeInputs(): {
  seeds: ReturnType<typeof buildRealDataE2eSeed>;
  activities: Activity[];
  results: EvaluationResult[];
} {
  const seeds = buildRealDataE2eSeed();
  const activities: Activity[] = [
    syntheticActivity(seeds[0].serviceIdentities[0].externalId),
  ];
  const results: EvaluationResult[] = [
    {
      unitId: `github:${INSTANCE_KEY}:realdata-e2e-terminal-sequence-c1`,
      narrative: "synthetic evaluation narrative — order-lock smoke",
      difficulty: "easy",
      contribution: "low",
      volume: 1,
    },
  ];
  return { seeds, activities, results };
}

// 4-seam 대표 builder spy 설치 — 반복 boilerplate 제거. spy 는 기본 call-through 라 동작
// 무변경, 실행 순서/threading 계측만 추가한다.
function installSeamSpies() {
  return {
    collect: jest.spyOn(runPlanModule, "buildRealDataE2eRunPlan"),
    evaluate: jest.spyOn(
      evaluationStepArgsModule,
      "buildRealDataEvaluationStepArgs",
    ),
    result: jest.spyOn(
      resultOutcomeStepArgsModule,
      "buildRealDataResultOutcomeStepArgs",
    ),
    publish: jest.spyOn(
      resultPublishStepArgsModule,
      "buildRealDataResultPublishStepArgs",
    ),
  };
}

// 종단 4-seam 시퀀스 실행기 — collect→evaluate→result→publish 를 한 flow 에서 순차 호출.
// collect 산출 runPlan 이 하위 3 seam 입력으로 threading 된다. overrides 로 각 negative
// 경계(빈 modelId/run, URL 없는 stdout, 빈 배열)를 주입한다.
function runSeq(
  o: {
    modelId?: string;
    run?: { gitSha: string; dateToken: string };
    stdout?: string;
    empty?: boolean;
  } = {},
) {
  const inputs = makeInputs();
  const activities = o.empty ? [] : inputs.activities;
  const results = o.empty ? [] : inputs.results;
  const stdout = o.stdout ?? RESULT_STDOUT;
  const runPlan = runPlanModule.buildRealDataE2eRunPlan(
    inputs.seeds,
    o.modelId ?? MODEL_ID,
    o.run ?? { ...RUN_REF },
  );
  evaluationStepArgsModule.buildRealDataEvaluationStepArgs(runPlan, activities);
  resultOutcomeStepArgsModule.buildRealDataResultOutcomeStepArgs(
    runPlan,
    stdout,
  );
  resultPublishStepArgsModule.buildRealDataResultPublishStepArgs(
    runPlan,
    results,
  );
  return { runPlan, activities, results, stdout };
}

// 순서 부등식 헬퍼 — collect < evaluate < result < publish (라운드 i).
function expectTerminalOrder(spy: ReturnType<typeof installSeamSpies>, i = 0) {
  expect(spy.collect.mock.invocationCallOrder[i]).toBeLessThan(
    spy.evaluate.mock.invocationCallOrder[i],
  );
  expect(spy.evaluate.mock.invocationCallOrder[i]).toBeLessThan(
    spy.result.mock.invocationCallOrder[i],
  );
  expect(spy.result.mock.invocationCallOrder[i]).toBeLessThan(
    spy.publish.mock.invocationCallOrder[i],
  );
}

describe("Smoke(non-gated): 실 평가 e2e 종단 4-seam 시퀀스 order-lock", () => {
  afterEach(() => jest.restoreAllMocks());

  describe("종단 순서 order-lock(happy-path)", () => {
    it("collect < evaluate < result < publish 를 invocationCallOrder 부등식으로 lock(각 1회)", () => {
      const spy = installSeamSpies();
      runSeq();
      expect(spy.collect).toHaveBeenCalledTimes(1);
      expect(spy.evaluate).toHaveBeenCalledTimes(1);
      expect(spy.result).toHaveBeenCalledTimes(1);
      expect(spy.publish).toHaveBeenCalledTimes(1);
      expectTerminalOrder(spy);
    });

    it("반복 호출에도 매 라운드 순서 유지(결정성)", () => {
      const spy = installSeamSpies();
      runSeq();
      runSeq();
      expect(spy.collect).toHaveBeenCalledTimes(2);
      expect(spy.publish).toHaveBeenCalledTimes(2);
      expectTerminalOrder(spy, 0);
      expectTerminalOrder(spy, 1);
    });
  });

  describe("seam threading 충실도(happy-path)", () => {
    it("collect 산출 runPlan 이 3 하위 seam 입력으로 동일 reference threading + 데이터 threading(activities/stdout/results)", () => {
      const spy = installSeamSpies();
      const { runPlan, activities, results, stdout } = runSeq();
      // 단일 source: collect 산출 runPlan 이 3 하위 seam 첫 인자로 reference 동일.
      expect(spy.collect.mock.results[0].value).toBe(runPlan);
      expect(spy.evaluate.mock.calls[0][0]).toBe(runPlan);
      expect(spy.result.mock.calls[0][0]).toBe(runPlan);
      expect(spy.publish.mock.calls[0][0]).toBe(runPlan);
      // 데이터 threading: 각 seam 두 번째 인자가 flow 공급 데이터와 값-동일.
      expect(spy.evaluate.mock.calls[0][1]).toBe(activities);
      expect(spy.result.mock.calls[0][1]).toBe(stdout);
      expect(spy.publish.mock.calls[0][1]).toBe(results);
      expect(spy.publish.mock.results[0].value.report.summary).toBeDefined();
    });
  });

  describe("error path — seam throw 시 downstream 미도달", () => {
    it("evaluate seam throw → result·publish 미호출", () => {
      const spy = installSeamSpies();
      spy.evaluate.mockImplementation(() => {
        throw new Error("synthetic evaluate seam failure");
      });
      expect(() => runSeq()).toThrow("synthetic evaluate seam failure");
      expect(spy.evaluate).toHaveBeenCalledTimes(1);
      expect(spy.result).not.toHaveBeenCalled();
      expect(spy.publish).not.toHaveBeenCalled();
    });

    it("collect seam throw(빈 modelId) → 하위 3 seam 전부 미호출", () => {
      const spy = installSeamSpies();
      expect(() => runSeq({ modelId: "" })).toThrow();
      expect(spy.evaluate).not.toHaveBeenCalled();
      expect(spy.result).not.toHaveBeenCalled();
      expect(spy.publish).not.toHaveBeenCalled();
    });
  });

  describe("flow / branch — 빈 배열 경계에서도 종단 순서 유지", () => {
    it("빈 activities + 빈 results — throw 0 으로 4-seam 순차 발화 + 순서 부등식 유지", () => {
      const spy = installSeamSpies();
      expect(() => runSeq({ empty: true })).not.toThrow();
      expect(spy.collect).toHaveBeenCalledTimes(1);
      expect(spy.publish).toHaveBeenCalledTimes(1);
      expectTerminalOrder(spy);
    });
  });

  describe("negative cases — 순서 위반·threading 누락·경계값 (seam 별 cover)", () => {
    it("(i) 순서 위반 대조 — publish 를 2번째 collect 보다 먼저 실행하면 collect < publish 부등식이 깨진다(assert teeth)", () => {
      const { seeds, results } = makeInputs();
      const spy = installSeamSpies();
      const runPlan = runPlanModule.buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        ...RUN_REF,
      });
      resultPublishStepArgsModule.buildRealDataResultPublishStepArgs(
        runPlan,
        results,
      ); // publish 먼저
      runPlanModule.buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF }); // collect 나중
      const secondCollect = spy.collect.mock.invocationCallOrder[1];
      const firstPublish = spy.publish.mock.invocationCallOrder[0];
      expect(firstPublish).toBeLessThan(secondCollect);
      expect(secondCollect < firstPublish).toBe(false);
    });

    it("(ii) threading 누락 대조 — publish 에 collect 산출과 다른 runPlan 을 넘기면 reference 불일치 검출", () => {
      const { seeds, results } = makeInputs();
      const spy = installSeamSpies();
      const runPlanA = runPlanModule.buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        ...RUN_REF,
      });
      const runPlanB = runPlanModule.buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        ...RUN_REF,
      });
      resultPublishStepArgsModule.buildRealDataResultPublishStepArgs(
        runPlanB,
        results,
      );
      expect(spy.collect.mock.results[0].value).toBe(runPlanA);
      expect(spy.publish.mock.calls[0][0]).not.toBe(runPlanA);
      expect(spy.publish.mock.calls[0][0]).toBe(runPlanB);
    });

    it("(iii-a) 경계값 — 빈 run.gitSha 는 collect seam 에서 throw(downstream 미도달)", () => {
      const spy = installSeamSpies();
      expect(() =>
        runSeq({ run: { gitSha: "", dateToken: RUN_REF.dateToken } }),
      ).toThrow();
      expect(spy.evaluate).not.toHaveBeenCalled();
    });

    it("(iii-b) 경계값 — 공백만의 run.dateToken 도 collect seam 에서 throw(downstream 미도달)", () => {
      const spy = installSeamSpies();
      expect(() =>
        runSeq({ run: { gitSha: RUN_REF.gitSha, dateToken: "   " } }),
      ).toThrow();
      expect(spy.publish).not.toHaveBeenCalled();
    });

    it("(iii-c) 경계값 — URL 없는 stdout 이면 result seam 에서 throw(result 발화, publish 미도달)", () => {
      const spy = installSeamSpies();
      expect(() => runSeq({ stdout: "no url in this stdout" })).toThrow();
      expect(spy.result).toHaveBeenCalledTimes(1);
      expect(spy.publish).not.toHaveBeenCalled();
    });
  });
});

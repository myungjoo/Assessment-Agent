// realdata-e2e-step-args-consistency.spec.ts — T-0671 colocated unit spec for
// `assertRealDataE2eStepArgsConsistentWithSources`(aggregator-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (runPlan, activities, results) 으로 aggregator
//     (`buildRealDataE2eStepArgs`)가 산출한 stepArgs 를 가드에 넘기면 throw 0(void) —
//     round-trip 정합. 빈/단일/다수 activities·results 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): stepArgs null·undefined / runPlan null·
//     undefined / evaluation·publish 비-object / runPlan.pipeline·run 비-object → 각
//     분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): evaluation 변조 / publish 변조 → 각
//     RangeError + 메시지에 해당 구성요소(evaluation/publish) 식별자 포함.
//   - flow/branch: ① 정합 → void ② evaluation drift → RangeError ③ publish drift →
//     RangeError ④ 구조 결손 → TypeError ⑤ 재유도 위임 throw(modelId / run 식별자
//     빈/공백)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (stepArgs, runPlan, activities, results) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 stepArgs / runPlan / activities / results 객체 변경 0.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

// T-1064 순서-lock leg 11 — guard 재유도가 직접 호출하는 2 distinct sub-composer 를
// namespace 로 잡아 jest.spyOn 배선(정합-경로 상대 호출 순서 invocationCallOrder 부등식
// 1개 + fail-fast 양방향 계측). 두 프로퍼티에 pass-through spy 를 건다. reference-페어링
// 없음 — 두 sub-composer 는 각각 runPlan 을 독립 소비(데이터-의존 chain 아님, aggregator
// fail-fast-sequential).
import * as evaluationStepArgsModule from "./realdata-e2e-evaluation-step-args";
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import * as publishStepArgsModule from "./realdata-e2e-result-publish-step-args";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import { buildRealDataE2eStepArgs } from "./realdata-e2e-step-args";
import type { RealDataE2eStepArgs } from "./realdata-e2e-step-args";
import { assertRealDataE2eStepArgsConsistentWithSources } from "./realdata-e2e-step-args-consistency";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-26",
};

const MODEL_ID = "qwen2.5-coder:32b";

// pipeline fixture — 평가 step-args 재유도는 `runPlan.pipeline.modelId` 를 thread 하므로
// 유효 modelId 한 슬롯이 필요하다(빈 modelId 면 평가 위임이 throw — 전파 분기에서 활용).
function makePipeline(modelId: string = MODEL_ID): RealDataPipelinePlan {
  return {
    collectCallArgs: [
      {
        person: {
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo" },
          ],
        },
        since: undefined,
        assessmentId: "ASSESSMENT_ID_PLACEHOLDER",
      },
    ],
    modelId,
  };
}

// run plan fixture 생성기 — 유효 pipeline(modelId thread) + run 을 담은
// RealDataE2eRunPlan. 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(
  run: RealDataResultIssueRunRef = RUN,
  modelId: string = MODEL_ID,
): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(modelId),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

// GithubActivity fixture 생성기 — 평가 step-args 재유도 입력. 평가 위임이 매핑만 하므로
// 식별 필드만 정규 shape 로 채운다.
function makeActivity(overrides: Partial<GithubActivity> = {}): GithubActivity {
  return {
    externalId: overrides.externalId ?? "commit-abc",
    sourceType: "github",
    instanceKey: overrides.instanceKey ?? "com",
    author: overrides.author ?? "myungjoo",
    timestamp: overrides.timestamp ?? "2026-06-20T10:00:00.000Z",
    metadata: overrides.metadata ?? {},
    repoRef: overrides.repoRef ?? "octo-org/octo-repo",
    kind: overrides.kind ?? "commit",
  };
}

const HAPPY_ACTIVITIES: Activity[] = [
  makeActivity({ externalId: "commit-a", kind: "commit" }),
  makeActivity({ externalId: "pr-1", kind: "pr" }),
];

// EvaluationResult fixture 생성기 — 5 필드 정규 shape. publish 위임이 집계만 하므로
// narrative 값은 검증에 무관.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "github:com:commit-abc",
    narrative: overrides.narrative ?? "평가 정성 평가문",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 12,
  };
}

const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({
    unitId: "github:com:a",
    difficulty: "easy",
    contribution: "low",
    volume: 3,
  }),
  makeResult({
    unitId: "github:com:b",
    difficulty: "hard",
    contribution: "high",
    volume: 20,
  }),
];

// makeStepArgs — aggregator 실제 산출물을 재사용해 정상 정합 stepArgs 를 만든다(손상
// 분기 test 가 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makeStepArgs(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  activities: Activity[] = HAPPY_ACTIVITIES,
  results: EvaluationResult[] = HAPPY_RESULTS,
): RealDataE2eStepArgs {
  return buildRealDataE2eStepArgs(runPlan, activities, results);
}

describe("assertRealDataE2eStepArgsConsistentWithSources", () => {
  // T-1064 spy 격리 — 순서-lock describe 의 jest.spyOn 이 후속 test 로 새지 않도록
  // 최상위 afterEach 에서 모든 mock 복원(신규 spyOn 격리 필수 — 없으면 관측 오염).
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (정합 stepArgs → void)", () => {
    it("다수 activities·results aggregator 산출 stepArgs 를 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("정합 stepArgs 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      expect(
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toBeUndefined();
    });

    it("빈 activities + 빈 results 경계 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [];
      const results: EvaluationResult[] = [];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("단일 activity + 단일 result 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities = [makeActivity()];
      const results = [makeResult()];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const stepArgs = makeStepArgs(runPlan);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a)(b)(c))", () => {
    it("evaluation 만 손상(callArgs 누락) → RangeError(evaluation 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        evaluation: {
          ...stepArgs.evaluation,
          callArgs: stepArgs.evaluation.callArgs.slice(0, -1),
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation.*byte-identical/s);
    });

    it("evaluation 만 손상(inputs 임의 필드 변형) → RangeError(evaluation 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        evaluation: {
          ...stepArgs.evaluation,
          inputs: [],
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation.*byte-identical/s);
    });

    it("publish 만 손상(searchArgv 위치 swap) → RangeError(publish 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const swapped = [...stepArgs.publish.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          searchArgv: swapped,
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish.*byte-identical/s);
    });

    it("publish 만 손상(report summary count 조작) → RangeError(publish 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          report: {
            ...stepArgs.publish.report,
            summary: {
              ...stepArgs.publish.report.summary,
              count: stepArgs.publish.report.summary.count + 99,
            },
          },
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish.*byte-identical/s);
    });

    it("evaluation 검사가 publish 검사보다 먼저 — 둘 다 손상 시 evaluation RangeError (negative (b))", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        evaluation: {
          ...stepArgs.evaluation,
          callArgs: stepArgs.evaluation.callArgs.slice(0, -1),
        },
        publish: {
          ...stepArgs.publish,
          searchArgv: [...stepArgs.publish.searchArgv].reverse(),
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation/);
    });

    it("deep-equal 이 원소·순서·길이까지 강제 — publish.searchArgv 원소 순서만 swap 해도 검출 (negative (c))", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      // 길이·원소 집합은 동일하고 순서만 뒤바뀐 경우도 byte-identical 위반.
      const reordered = [...stepArgs.publish.searchArgv].reverse();
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: { ...stepArgs.publish, searchArgv: reordered },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (a) fail-fast)", () => {
    it("stepArgs null → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          null as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs 가 null\/undefined/);
    });

    it("stepArgs undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          undefined as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("stepArgs null 이 evaluation/publish 비-object 보다 먼저 throw (fail-fast 순서)", () => {
      // stepArgs 자체가 null 이므로 evaluation/publish 접근 전에 차단됨.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          null as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs 가 null\/undefined/);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          null as unknown as RealDataE2eRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          undefined as unknown as RealDataE2eRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("evaluation 비-object(null) → TypeError", () => {
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        evaluation: null,
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation 이 객체가 아니다/);
    });

    it("evaluation 비-object(원시값 string) → TypeError(타입 라벨 노출)", () => {
      // describe 의 typeof fall-through 분기 cover — null/array 가 아닌 원시값은
      // typeof 라벨(string)을 메시지에 노출한다.
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        evaluation: "not-an-object",
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation 이 객체가 아니다\(타입: string\)/);
    });

    it("publish 비-object(배열) → TypeError", () => {
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        publish: [],
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish 가 객체가 아니다/);
    });

    it("runPlan.pipeline 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: null,
        run: { gitSha: "abc1234", dateToken: "2026-06-26" },
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          corrupted,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.pipeline 이 객체가 아니다/);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          corrupted,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("runPlan.pipeline.modelId 공백-only → 평가 위임 guard throw 가 전파(publish 미도달)", () => {
      const blankModelRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline("   "),
        run: { gitSha: "abc1234", dateToken: "2026-06-26" },
      };
      // 구조는 온전(pipeline/run object)하나 modelId 가 공백이라 evaluation 재유도가 throw.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankModelRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow();
    });

    it("runPlan.run.gitSha 공백-only → publish 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "   ", dateToken: "2026-06-26" },
      };
      // evaluation 재유도는 정상 통과(modelId 유효)하고 publish 재유도에서 run guard throw.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("runPlan.run.dateToken 공백-only → publish 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "abc1234", dateToken: "  " },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (d), (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const run = () =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift stepArgs 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          searchArgv: [...stepArgs.publish.searchArgv].reverse(),
        },
      };
      const run = () =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        );
      expect(run).toThrow(/stepArgs\.publish/);
      expect(run).toThrow(/stepArgs\.publish/);
    });

    it("빈 activities + 빈 results + 유효 runPlan 정상 통과(throw 0) (negative (f))", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [];
      const results: EvaluationResult[] = [];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("가드 호출 후 stepArgs / runPlan / activities / results 객체 mutate 0 (negative (e))", () => {
      const runPlan = makeRunPlan();
      const activities = [
        makeActivity(),
        makeActivity({ externalId: "pr-9", kind: "pr" }),
      ];
      const results = [makeResult(), makeResult({ volume: 5 })];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const stepArgsSnapshot = JSON.stringify(stepArgs);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);
      const resultsSnapshot = JSON.stringify(results);
      assertRealDataE2eStepArgsConsistentWithSources(
        stepArgs,
        runPlan,
        activities,
        results,
      );
      expect(JSON.stringify(stepArgs)).toBe(stepArgsSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
    });
  });

  // T-1064 — consistency-guard 재유도 위임 순서-lock leg 11(step-args aggregator
  // fail-fast-sequential). guard(`assert…StepArgsConsistentWithSources`)는 2 distinct
  // sub-composer 를 순차 statement 로 재유도한다: buildRealDataEvaluationStepArgs(runPlan,
  // activities) → buildRealDataResultPublishStepArgs(runPlan, results). 두 위임은 서로의
  // 산출을 소비하지 않고(둘 다 runPlan 을 독립 인자로 받음 — ① activities, ② results) 데이터상
  // 병렬이라 reference-페어링(뒤 builder 첫 인자 === 앞 builder 산출) assert 는 적용하지
  // 않는다. 대신 guard 본문의 순차 fail-fast 계약을 못박는다 — evaluation 재유도가 publish
  // 재유도보다 먼저 평가되므로(JS statement 순차 평가) eval 위임 throw 시 publish 위임은
  // 도달조차 하지 않는다. 현행 spec 은 두 재유도를 실 입력 throw 전파(L~488)로만 검증
  // (spec invocationCallOrder=0)해, guard 본문에서 두 재유도를 재정렬(publish 를 먼저 재호출)
  // 해도 검출 못 한다. T-1063 의 3-builder 순서-lock 선례를 2-sub-composer(1-edge) aggregator
  // fail-fast 로 축소 적용해 그 gap 을 봉한다(reference-페어링 2개는 데이터-의존 아니므로 미적용).
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 stepArgs 를 spy 설치 前 미리 만든 뒤(makeStepArgs 자체가
  //     aggregator 를 돌려 두 sub-composer 를 호출하므로 spy 설치 후 만들면 호출 횟수 오염 —
  //     guard 재유도만 격리 계측) 두 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도
  //     1회 트리거 → evaluation < publish invocationCallOrder 부등식(edge 1개·toBeLessThan)
  //     + 각 정확히 1회.
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     stepArgs/runPlan/activities/results mutate 0(read-only guard).
  //   - error/negative(a fail-fast edge): evaluation 위임 강제 throw → publish 미도달(0회) —
  //     첫 sub-composer throw 가 뒤 sub-composer 도달 전에 선전파.
  //   - error/negative(b 종단 throw 순서 재확인): publish 위임 강제 throw → evaluation 은
  //     이미 1회(순서 상 evaluation 이 publish 보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1064 — 재유도 위임 순서-lock(evaluation → publish)", () => {
    it("정합 재유도 시 evaluation < publish 순으로 호출된다(invocationCallOrder 부등식 1개·각 1회)", () => {
      // stepArgs 는 spy 설치 前 합성 — makeStepArgs 도 두 sub-composer 를 호출하므로 spy 설치
      // 후 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const evalSpy = jest.spyOn(
        evaluationStepArgsModule,
        "buildRealDataEvaluationStepArgs",
      );
      const publishSpy = jest.spyOn(
        publishStepArgsModule,
        "buildRealDataResultPublishStepArgs",
      );

      assertRealDataE2eStepArgsConsistentWithSources(
        stepArgs,
        runPlan,
        HAPPY_ACTIVITIES,
        HAPPY_RESULTS,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(evalSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).toHaveBeenCalledTimes(1);
      // 순서 edge 1개: evaluation(첫 호출) < publish(첫 호출).
      expect(evalSpy.mock.invocationCallOrder[0]).toBeLessThan(
        publishSpy.mock.invocationCallOrder[0],
      );

      // T-1103 — 인자-충실도 lock(2-delegate, 둘째 인자 포함). 위 order-lock 은 횟수+순서만
      // 못박고 각 위임에 "어떤 완전한 payload" 가 전달됐는지는 미검증이다. 재유도 call site
      // (helper L210~214)가 sub-composer ①/② 를 정확히 (runPlan, activities)/(runPlan, results)
      // 두 인자 완전 충실도로 호출함을 canonical matcher 로 봉한다.
      // 분기 없음(happy-path 재유도 단일 경로 tighten — 새 분기 도입 0), 항목 생략.
      // evaluation delegate: runPlan + activities 두 인자 완전 충실도.
      expect(evalSpy).toHaveBeenCalledWith(runPlan, HAPPY_ACTIVITIES);
      // publish delegate: 동일 runPlan reference + results 두 인자 완전 충실도.
      expect(publishSpy).toHaveBeenCalledWith(runPlan, HAPPY_RESULTS);

      // negative(인자-축) — 둘째 인자 payload drift 는 매칭되지 않음(toHaveBeenCalledWith 가
      // 진짜로 둘째 인자를 비교함을 노출). evaluation 에 results 를, publish 에 activities 를
      // 넣으면(둘째 인자 치환) 매칭 실패해야 한다.
      expect(evalSpy).not.toHaveBeenCalledWith(runPlan, HAPPY_RESULTS);
      expect(publishSpy).not.toHaveBeenCalledWith(runPlan, HAPPY_ACTIVITIES);

      // negative(인자 개수) — 각 delegate 가 정확히 2 인자로 호출됨(여분 인자 0, arity 봉함).
      expect(evalSpy.mock.calls[0]).toHaveLength(2);
      expect(publishSpy.mock.calls[0]).toHaveLength(2);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + stepArgs/runPlan/activities/results mutate 0", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const stepArgsSnapshot = JSON.stringify(stepArgs);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(HAPPY_ACTIVITIES);
      const resultsSnapshot = JSON.stringify(HAPPY_RESULTS);
      jest.spyOn(evaluationStepArgsModule, "buildRealDataEvaluationStepArgs");
      jest.spyOn(publishStepArgsModule, "buildRealDataResultPublishStepArgs");

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(JSON.stringify(stepArgs)).toBe(stepArgsSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(HAPPY_ACTIVITIES)).toBe(activitiesSnapshot);
      expect(JSON.stringify(HAPPY_RESULTS)).toBe(resultsSnapshot);
    });

    it("(a fail-fast edge) evaluation 위임이 throw 하면 publish 재유도에 도달하지 못한다(0회)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      jest
        .spyOn(evaluationStepArgsModule, "buildRealDataEvaluationStepArgs")
        .mockImplementation(() => {
          throw new Error("eval-boom");
        });
      const publishSpy = jest.spyOn(
        publishStepArgsModule,
        "buildRealDataResultPublishStepArgs",
      );

      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/eval-boom/);

      // 첫 sub-composer throw 가 뒤 sub-composer 도달 전 선전파 → publish 미호출.
      expect(publishSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 종단 throw 순서 재확인) publish 위임이 throw 하면 evaluation 은 이미 1회 호출됨", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const evalSpy = jest.spyOn(
        evaluationStepArgsModule,
        "buildRealDataEvaluationStepArgs",
      );
      const publishSpy = jest
        .spyOn(publishStepArgsModule, "buildRealDataResultPublishStepArgs")
        .mockImplementation(() => {
          throw new Error("publish-boom");
        });

      // 정합 입력으로 앞 재유도(evaluation)는 통과하고 둘째 재유도(publish)가 throw.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/publish-boom/);

      // 순서 상 evaluation 이 publish 보다 먼저 평가됨 — publish 재유도 throw 시점에
      // evaluation 은 이미 1회 호출됐고 publish 도 1회 진입(그 안의 강제 throw).
      expect(evalSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(evalSpy.mock.invocationCallOrder[0]).toBeLessThan(
        publishSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // T-1070 — 구조-검사 선행성 order-lock(구조 결손 → 두 build 위임 0-call).
  // 가드(`assert…StepArgsConsistentWithSources`)는 본문에서 구조 검사
  // (assertStepArgsStructure → assertRunPlanStructure, 6분기)를 값 재유도 위임
  // (buildRealDataEvaluationStepArgs → buildRealDataResultPublishStepArgs)보다 **먼저**
  // 수행한다. 기존 구조 error-path 테스트(구조 결손 → TypeError)들은 `.toThrow(TypeError)`
  // 만 assert 하고 "구조 위반 시 두 build 위임이 아예 호출되지 않는(선행 fail-fast) 선행성"
  // 은 검증하지 않았다. 본 블록은 구조 결손 6분기 각각에서 두 sub-composer spy 가 모두
  // `toHaveBeenCalledTimes(0)` 임을 못박아, 리팩터가 build 위임을 구조 검사 위로 끌어올리는
  // silent 재정렬로부터 "구조 검사 → 값 재유도" 순서를 방어한다(T-1066~T-1069 defense-in-depth
  // step-args mirror). 대조로 값 정합 위반(RangeError)은 구조 검사를 통과해 build 위임이
  // 호출된 뒤 발생함을 2 케이스로 명확화한다(구조=TypeError·build 0-call vs 값=RangeError·
  // build 호출됨 경계). spy 는 기존 T-1064 블록의 두 모듈(pass-through)을 재사용하며 최상위
  // afterEach 가 복원 격리한다.
  describe("T-1070 — 구조-검사 선행성 order-lock(구조 결손 → 두 build 위임 0-call)", () => {
    // installBuildSpies — 두 sub-composer 를 pass-through spy 로 감싼다. 구조 결손 케이스는
    // 구조 검사에서 선차단되므로 두 spy 모두 0-call 이어야 한다. 반드시 stepArgs 를 spy 설치
    // 前에 합성해야 makeStepArgs 내부 aggregator 호출이 관측을 오염시키지 않는다.
    function installBuildSpies() {
      const evalSpy = jest.spyOn(
        evaluationStepArgsModule,
        "buildRealDataEvaluationStepArgs",
      );
      const publishSpy = jest.spyOn(
        publishStepArgsModule,
        "buildRealDataResultPublishStepArgs",
      );
      return { evalSpy, publishSpy };
    }

    describe("happy-path (구조 통과 → 두 build 위임 각 1회, evaluation → publish 순)", () => {
      it("정합 구조 입력이면 두 build 위임이 각 1회 호출되고 evaluation < publish 선행(invocationCallOrder 부등식)", () => {
        // stepArgs 는 spy 설치 前 합성(aggregator 내부 호출 격리).
        const runPlan = makeRunPlan();
        const stepArgs = makeStepArgs(runPlan);
        const { evalSpy, publishSpy } = installBuildSpies();

        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        );

        // 구조 검사 통과 후 값 재유도 도달 — 각 위임 정확히 1회 + evaluation 선행.
        expect(evalSpy).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledTimes(1);
        expect(evalSpy.mock.invocationCallOrder[0]).toBeLessThan(
          publishSpy.mock.invocationCallOrder[0],
        );
      });
    });

    describe("구조 결손 6분기 — TypeError + 두 build 위임 0-call(선행성 fail-fast)", () => {
      // 분기 ① stepArgs 컨테이너 null/undefined — evaluation/publish 접근 前 선차단.
      it("stepArgs=null → TypeError + evaluation·publish build 0-call", () => {
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            null as unknown as RealDataE2eStepArgs,
            makeRunPlan(),
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/stepArgs 가 null\/undefined/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      it("stepArgs=undefined → TypeError + evaluation·publish build 0-call", () => {
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            undefined as unknown as RealDataE2eStepArgs,
            makeRunPlan(),
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(TypeError);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      // 분기 ② stepArgs.evaluation 비-object — 구조 검사 2단계서 선차단.
      it("stepArgs.evaluation=null(비-object) → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const corrupted = {
          ...stepArgs,
          evaluation: null,
        } as unknown as RealDataE2eStepArgs;
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            corrupted,
            makeRunPlan(),
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/stepArgs\.evaluation 이 객체가 아니다/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      it("stepArgs.evaluation=원시값 string(비-object) → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const corrupted = {
          ...stepArgs,
          evaluation: "not-an-object",
        } as unknown as RealDataE2eStepArgs;
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            corrupted,
            makeRunPlan(),
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/stepArgs\.evaluation 이 객체가 아니다/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      // 분기 ③ stepArgs.publish 비-object(배열) — 구조 검사 3단계서 선차단.
      it("stepArgs.publish=배열(비-object) → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const corrupted = {
          ...stepArgs,
          publish: [],
        } as unknown as RealDataE2eStepArgs;
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            corrupted,
            makeRunPlan(),
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/stepArgs\.publish 가 객체가 아니다/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      // 분기 ④ runPlan 컨테이너 null/undefined — assertRunPlanStructure 선차단.
      it("runPlan=null → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            stepArgs,
            null as unknown as RealDataE2eRunPlan,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/runPlan 이 null\/undefined/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      it("runPlan=undefined → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            stepArgs,
            undefined as unknown as RealDataE2eRunPlan,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(TypeError);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      // 분기 ⑤ runPlan.pipeline 비-object — 재유도 前 선차단.
      it("runPlan.pipeline=null(비-object) → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const corrupted = {
          pipeline: null,
          run: { gitSha: "abc1234", dateToken: "2026-06-26" },
        } as unknown as RealDataE2eRunPlan;
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            stepArgs,
            corrupted,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/runPlan\.pipeline 이 객체가 아니다/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });

      // 분기 ⑥ runPlan.run 비-object — 재유도 前 선차단.
      it("runPlan.run=null(비-object) → TypeError + build 0-call", () => {
        const stepArgs = makeStepArgs();
        const corrupted = {
          pipeline: makePipeline(),
          run: null,
        } as unknown as RealDataE2eRunPlan;
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            stepArgs,
            corrupted,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/runPlan\.run 이 객체가 아니다/);
        expect(evalSpy).toHaveBeenCalledTimes(0);
        expect(publishSpy).toHaveBeenCalledTimes(0);
      });
    });

    describe("대조 — 값 정합 위반(RangeError)은 구조 통과 후 build 위임 호출 뒤 발생", () => {
      // 구조는 온전(evaluation/publish object)하나 값이 drift — 구조 검사를 통과해
      // build 위임이 호출된 뒤 deep-equal 비교에서 RangeError. 구조(build 0-call) vs
      // 값(build 호출됨) 경계를 선행성 관점에서 대조.
      it("evaluation drift → RangeError + evaluation build 위임은 호출됨(≥1)", () => {
        const runPlan = makeRunPlan();
        const stepArgs = makeStepArgs(runPlan);
        const corrupted: RealDataE2eStepArgs = {
          ...stepArgs,
          evaluation: {
            ...stepArgs.evaluation,
            callArgs: stepArgs.evaluation.callArgs.slice(0, -1),
          },
        };
        const { evalSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            corrupted,
            runPlan,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(RangeError);
        // 구조 통과 → 값 재유도 도달: evaluation build 위임이 최소 1회 호출됐다.
        expect(evalSpy).toHaveBeenCalledTimes(1);
      });

      it("publish drift → RangeError + 두 build 위임 모두 호출됨(evaluation 통과 후 publish 도달)", () => {
        const runPlan = makeRunPlan();
        const stepArgs = makeStepArgs(runPlan);
        const corrupted: RealDataE2eStepArgs = {
          ...stepArgs,
          publish: {
            ...stepArgs.publish,
            searchArgv: [...stepArgs.publish.searchArgv].reverse(),
          },
        };
        const { evalSpy, publishSpy } = installBuildSpies();
        expect(() =>
          assertRealDataE2eStepArgsConsistentWithSources(
            corrupted,
            runPlan,
            HAPPY_ACTIVITIES,
            HAPPY_RESULTS,
          ),
        ).toThrow(/stepArgs\.publish/);
        // evaluation 비교 통과 후 publish 재유도까지 도달 → 두 위임 모두 호출됨.
        expect(evalSpy).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});

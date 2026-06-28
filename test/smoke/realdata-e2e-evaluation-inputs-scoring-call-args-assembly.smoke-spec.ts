// realdata-e2e-evaluation-inputs-scoring-call-args-assembly.smoke-spec.ts — 실 평가
// e2e activities→evaluation-inputs→scoring-call-args 조립 체인 non-gated build-time
// smoke (T-0745 박제, PLAN.md 109행 🟢 실 평가 e2e step②→③ 경계).
//
// 본 spec 의 존재 이유 — public CI gap 해소(collect-side 조립 smoke T-0744,
// seed→collect-input→collect-call-args step①② 수집 입력 경로의 evaluate-side(step②③
// 평가 입력 경로) 대칭 형제):
//   - PLAN 109행 step②(수집) → step③(평가) 경계의 build-time 순수 layer 는 두 컴포저가
//     직렬로 닫는다 — (1) `buildRealDataEvaluationInputs(activities)`(T-0578)가 수집 산출
//     `Activity[]` 의 각 원소를 production `mapActivityToEvaluationInput()` 로 변환해 평가
//     입력 contract `EvaluationInput[]`(= `EvaluationScoringService.scoreUnit` 의 **첫**
//     인자)로 매핑하고, (2) `buildRealDataScoringCallArgs(inputs, modelId)`(T-0579)가 그
//     위에 `scoreUnit(input, options)` 의 완전한 호출-args 묶음 `RealDataScoringCallArgs[]`
//     (`{input, options:{modelId}}`)을 얹는다 — modelId 는 server-side
//     `LlmProviderConfigResolver` 단일 source 결정값을 caller 가 주입(ADR-0048).
//   - 이 두 컴포저는 각각 unit(`realdata-e2e-evaluation-inputs.spec.ts` /
//     `realdata-e2e-scoring-call-args.spec.ts`) + consistency(`...-consistency.spec.ts`)
//     spec 으로 닫혀 있으나, **activities→evaluation-inputs→scoring-call-args 를 묶은 직접
//     조립 체인 단위의 non-gated build-time smoke** 는 부재였다. 기존
//     `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0591)는 두 컴포저를 감싼
//     aggregator `buildRealDataEvaluationPlan(activities, modelId)` 진입으로만 검증할 뿐 —
//     `Activity[] → EvaluationInput[]` 중간 변환 산출(production 매퍼 정합·order 보존)과 그
//     위 scoring 호출-args 합성(`options:{modelId}` 페어링·`input` reference 1:1 wrap)을 두
//     helper 의 직접 chain 으로 묶은 단언은 0 이었다(`git grep` 으로 두 컴포저를 직접 chain
//     으로 묶은 smoke = evaluation-plan-assembly(aggregator 진입)뿐, 직접 2-컴포저 체인 smoke
//     부재 확인).
//     즉 evaluation-inputs shape drift(매퍼 변환 누락 / 원소 drop·순서 뒤섞임)·scoring
//     call-args shape drift(`input` reference 페어링 실패 / `options.modelId` 미적용 / 잉여
//     필드 누출)·modelId 빈/공백 throw 전파·빈/단일/다수 activity 분기는 public CI 에서 직접
//     발화되지 않고 evaluation-plan aggregator 또는 step③ DB/LLM-gated runner set-up 시에만
//     잡혔다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     activities→evaluation-inputs→scoring-call-args 조립 surface 를 검증한다. live leg(실
//     github.com 네트워크 fetch / 실 활동 수집 / `EvaluationScoringService.scoreUnit` 실 호출
//     / 실 scoring 실행 / 실 LlmProviderConfigResolver / 실 LLM / Ollama / DB 접근 / 실 jest
//     spawn)는 복제하지 않고, synthetic Activity literal 을 컴포저에 직접 공급해 live leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 scoreUnit 호출 0 — scoring/평가 미실행. synthetic Activity literal 을 컴포저에
//         직접 공급해 평가 입력·호출-args 조립 surface 만 검증.
//      🔥 실 네트워크 호출 0 — github / Ollama / DB 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 LlmProviderConfigResolver 0 / 실 modelId 결정 0 / 실 jest spawn 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 buildRealDataEvaluationInputs/buildRealDataScoringCallArgs
//         import 재사용만(consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0745):
//   - 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0591,
//     `buildRealDataEvaluationPlan(activities, modelId)` aggregator 진입) 의 재검증 — 본
//     task 는 그 aggregator 아래 evaluation-inputs→scoring-call-args 직접 chain 만 책임
//     (중복·재검증 0).
//   - 기존 `realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts`(T-0739,
//     `buildRealDataEvaluationStepArgs(runPlan, activities)` run-plan threading layer) — 본
//     task 는 modelId 직접 주입 chain 만, 별개 절단면.
//   - 기존 `realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts`(T-0744, collect-side
//     seed→collect-input→collect-call-args 경로) — 본 task 는 evaluate-side 평가 입력 경로만,
//     별개 절단면.
//   - 실 scoring 호출 / `scoreUnit` 실행 / 실 LLM round-trip / Ollama / 실
//     `LlmProviderConfigResolver` modelId 결정 / DB 접근 / 실 jest spawn.
//   - 난이도별 routing(R-97) / modelId 외 ScoringOptions 필드 / EvaluationResult 산출 — 본
//     task 는 build-time 호출-args 묶음 shape 만 검증.
//   - 컴포저 소스(`realdata-e2e-evaluation-inputs.ts` / `realdata-e2e-scoring-call-args.ts`) /
//     production 매퍼(`evaluation-input.mapper.ts`) / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
//   - T-0728~T-0744 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream(본 task 는 신규
//     파일 추가만).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { isContributionKind } from "../../src/assessment-evaluation/domain/evaluation-input";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataScoringCallArgs } from "../helpers/realdata-e2e-scoring-call-args";

// 본 smoke 공통 fixture 상수 — 모든 it 가 같은 결정론 입력을 공유한다(매 it 가 새 객체
// 트리를 받도록 빌더 함수로 합성).
const MODEL_ID = "cfg-realdata-e2e-evaluation-inputs-scoring-call-args-smoke";
const INSTANCE_KEY = "github.com";

// syntheticActivity — 도메인 타입 정합 GithubActivity literal 1 건 빌더. externalId /
// author / kind 를 인자로 받아 다수 element + 매퍼 분기 다양성(commit/pr→code,
// issue→document)을 cover 할 수 있게 한다. metadata 는 raw 본문 아닌 scalar 만
// (REQ-032 정합 — titleLength scalar).
function syntheticActivity(
  externalId: string,
  author: string,
  kind: GithubActivity["kind"] = "commit",
): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind,
  };
}

// validActivities — synthetic 다수 activity fixture(2 건, commit/pr 혼합). 매 it 가
// 새 트리를 받아 입력 mutate 누설이 없도록 빌더 함수로 합성.
function validActivities(): GithubActivity[] {
  return [
    syntheticActivity("realdata-e2e-eval-args-c1", "alice", "commit"),
    syntheticActivity("realdata-e2e-eval-args-c2", "bob", "pr"),
  ];
}

describe("Smoke(non-gated): 실 평가 e2e activities→evaluation-inputs→scoring-call-args 조립 체인 live-LLM 0 검증", () => {
  describe("happy path — 종단 체인(activities→evaluation-inputs→scoring-call-args) 산출", () => {
    it("(a) buildRealDataEvaluationInputs→buildRealDataScoringCallArgs 종단 → callArgs 가 배열·길이=activity 수·각 원소 input/options 필드 보유", () => {
      const activities = validActivities();

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(Array.isArray(callArgs)).toBe(true);
      expect(callArgs).toHaveLength(activities.length);
      for (const args of callArgs) {
        expect(args.input).toBeDefined();
        expect(args.options).toBeDefined();
      }
    });

    it("(b) 각 원소 options.modelId === MODEL_ID(동형 적용) · options 가 {modelId} 단일 필드만 보유(잉여 필드 누출 0)", () => {
      const inputs = buildRealDataEvaluationInputs(validActivities());
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      for (const args of callArgs) {
        expect(args.options.modelId).toBe(MODEL_ID);
        // options 는 정확히 modelId 키 1 개만 보유 — 잉여 필드 누출 0.
        expect(Object.keys(args.options)).toEqual(["modelId"]);
      }
    });

    it("(c) 각 원소 input 이 buildRealDataEvaluationInputs 의 대응 원소와 동일 reference(1:1 wrap, EvaluationInput 복제 0)", () => {
      const inputs = buildRealDataEvaluationInputs(validActivities());
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(callArgs).toHaveLength(inputs.length);
      callArgs.forEach((args, i) => {
        // reference 동일 — EvaluationInput 복제 0(위임 helper 계약 보존).
        expect(args.input).toBe(inputs[i]);
      });
    });
  });

  describe("단일 source 조립 단언 — evaluation-inputs → scoring-call-args 를 activities 단일 source 로 thread", () => {
    it("buildRealDataScoringCallArgs(buildRealDataEvaluationInputs(activities), MODEL_ID).map(a=>a.input) 이 buildRealDataEvaluationInputs(activities) 와 deep-equal(중복 매핑 없이 동일 변환 위임)", () => {
      const activities = validActivities();

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      // call-args 의 input 들을 추출한 배열이 evaluation-inputs 직접 산출과 byte-identical.
      expect(callArgs.map((args) => args.input)).toEqual(inputs);
    });

    it("call-args 산출 원소 수 = evaluation-inputs 산출 원소 수 = activity 수(1:1 wrap)", () => {
      const activities = validActivities();

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(inputs).toHaveLength(activities.length);
      expect(callArgs).toHaveLength(activities.length);
      expect(callArgs).toHaveLength(inputs.length);
    });

    it("중간 EvaluationInput shape 가 production mapActivityToEvaluationInput 정합(unitId 합성·contributionKind 정규화 산출이 기대대로)", () => {
      const activities = validActivities();

      const inputs = buildRealDataEvaluationInputs(activities);

      activities.forEach((activity, i) => {
        // unitId = `<sourceType>:<instanceKey>:<externalId>` 합성(매퍼 계약).
        expect(inputs[i].unitId).toBe(
          `github:${INSTANCE_KEY}:${activity.externalId}`,
        );
        // contributionKind: commit/pr → code, issue → document(R-30).
        const expectedKind = activity.kind === "issue" ? "document" : "code";
        expect(inputs[i].contributionKind).toBe(expectedKind);
        expect(isContributionKind(inputs[i].contributionKind)).toBe(true);
        // typed 필드 전사 정합(sourceType/instanceKey/author/timestamp).
        expect(inputs[i].sourceType).toBe(activity.sourceType);
        expect(inputs[i].instanceKey).toBe(activity.instanceKey);
        expect(inputs[i].author).toBe(activity.author);
        expect(inputs[i].timestamp).toBe(activity.timestamp);
      });
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 activity + 매퍼 종류 분기(분기별 분리)", () => {
    it("빈 activities + 유효 modelId → buildRealDataEvaluationInputs([]) = [] → buildRealDataScoringCallArgs([], MODEL_ID) = [](throw 0)", () => {
      const inputs = buildRealDataEvaluationInputs([]);
      expect(inputs).toEqual([]);
      expect(buildRealDataScoringCallArgs(inputs, MODEL_ID)).toEqual([]);
    });

    it("단일 activity → 길이 1 + 1:1 페어링(input reference 동일 · options.modelId 적용)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-args-c1", "alice", "commit"),
      ];

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].input).toBe(inputs[0]);
      expect(callArgs[0].options.modelId).toBe(MODEL_ID);
    });

    it("다수 activity → 순서 보존된 1:1 페어링(각 input reference 동일 · 순서 정합)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-args-c1", "alice", "commit"),
        syntheticActivity("realdata-e2e-eval-args-c2", "bob", "pr"),
        syntheticActivity("realdata-e2e-eval-args-c3", "carol", "issue"),
      ];

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(callArgs).toHaveLength(activities.length);
      for (let i = 0; i < activities.length; i += 1) {
        expect(callArgs[i].input).toBe(inputs[i]);
        expect(callArgs[i].input.unitId).toBe(
          `github:${INSTANCE_KEY}:${activities[i].externalId}`,
        );
        expect(callArgs[i].options.modelId).toBe(MODEL_ID);
      }
    });

    it("매퍼 분기 다양성 — commit/pr → code · issue → document(서로 다른 activity 종류로 매퍼 분기 cover)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-args-commit", "alice", "commit"),
        syntheticActivity("realdata-e2e-eval-args-pr", "bob", "pr"),
        syntheticActivity("realdata-e2e-eval-args-issue", "carol", "issue"),
      ];

      const inputs = buildRealDataEvaluationInputs(activities);
      const callArgs = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(callArgs[0].input.contributionKind).toBe("code");
      expect(callArgs[1].input.contributionKind).toBe("code");
      expect(callArgs[2].input.contributionKind).toBe("document");
    });
  });

  describe("negative cases — modelId guard throw 전파(조립 경로 자체 try/catch 0)", () => {
    it("(a) modelId 빈 문자열 → buildRealDataScoringCallArgs 의 throw 가 조립 경로로 그대로 전파", () => {
      const activities = validActivities();
      expect(() =>
        buildRealDataScoringCallArgs(
          buildRealDataEvaluationInputs(activities),
          "",
        ),
      ).toThrow();
    });

    it("(b) modelId 공백만 → throw 전파", () => {
      const activities = validActivities();
      expect(() =>
        buildRealDataScoringCallArgs(
          buildRealDataEvaluationInputs(activities),
          "   ",
        ),
      ).toThrow();
    });

    it("(c) 빈 activities + 빈 modelId → buildRealDataEvaluationInputs([]) = [] 이지만 buildRealDataScoringCallArgs([], '') 가 modelId guard 로 throw(입력 빈 배열이어도 modelId guard 선행)", () => {
      // 빈 activities → 빈 inputs 이지만 modelId 가 빈/공백이면 guard throw — 빈-배열
      // 분기로 조용히 통과하지 않는다(컴포저 modelId guard 의 build-time 정책 박제).
      expect(() =>
        buildRealDataScoringCallArgs(buildRealDataEvaluationInputs([]), ""),
      ).toThrow();
      expect(() =>
        buildRealDataScoringCallArgs(buildRealDataEvaluationInputs([]), "   "),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 activities+MODEL_ID 두 번 chain 호출 + 입력 불변", () => {
    it("(c-결정론·무공유) 두 호출 deep-equal + 매 호출 새 객체 트리(종단 산출 배열·각 원소 options 객체 참조 비동일 — input 은 매퍼 계약대로 동일 reference 페어링이므로 options 차원 무공유만 단언)", () => {
      const activities = validActivities();

      const inputsA = buildRealDataEvaluationInputs(activities);
      const a = buildRealDataScoringCallArgs(inputsA, MODEL_ID);
      const inputsB = buildRealDataEvaluationInputs(activities);
      const b = buildRealDataScoringCallArgs(inputsB, MODEL_ID);

      // deep-equal — 결정론(입력만의 함수).
      expect(a).toEqual(b);

      // 최상위 배열·원소·options 참조 무공유(매 호출 새 컨테이너 + 새 options).
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].options).not.toBe(b[0].options);
      // input 은 각 chain 의 자기 inputs 원소를 reference 그대로 페어링(복제 0) —
      // 같은 chain 안에서는 동일 reference 임을 단언(options 차원 무공유와 구분).
      expect(a[0].input).toBe(inputsA[0]);
      expect(b[0].input).toBe(inputsB[0]);
    });

    it("(d) no-mutation — 입력 activities(및 중첩 metadata 제외한 scalar 필드)가 chain 호출 전후 deep-equal(mutate 0)", () => {
      const activities = validActivities();
      const snapshot = JSON.parse(JSON.stringify(activities));

      buildRealDataScoringCallArgs(
        buildRealDataEvaluationInputs(activities),
        MODEL_ID,
      );

      // 호출 후에도 입력 배열 자체와 모든 원소 필드가 그대로(mutate 0).
      expect(activities).toEqual(snapshot);
      expect(activities).toHaveLength(2);
      expect(activities[0].externalId).toBe("realdata-e2e-eval-args-c1");
      expect(activities[1].externalId).toBe("realdata-e2e-eval-args-c2");
    });
  });
});

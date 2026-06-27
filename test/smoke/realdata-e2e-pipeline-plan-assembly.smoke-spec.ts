// realdata-e2e-pipeline-plan-assembly.smoke-spec.ts — 실 평가 e2e seed-side 진입 plan
// 조립 체인 non-gated build-time smoke (T-0731 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - PLAN 109행 step ②(수집) 진입 경계는 seed-side 진입 plan 컴포저
//     `buildRealDataPipelinePlan(seeds, modelId)`(T-0592) 가 닫는다 — seed descriptor
//     배열을 `buildRealDataCollectCallArgs`(T-0577) 에 위임해 collect 호출-args 묶음을
//     만들고, 평가 정책 `modelId` 를 guard 검증 후 보존해 `{ collectCallArgs, modelId }`
//     (step ② live runner 가 들고 갈 "어떤 인원을 어떤 modelId 정책으로 수집→평가할지"
//     한 묶음) 을 합성한다.
//   - 이 컴포저는 컴포저 단위 unit spec(`realdata-e2e-pipeline-plan.spec.ts`) 으로는
//     닫혀 있으나, **여러 link 를 묶은 조립 체인 단위의 non-gated build-time smoke** 는
//     부재였다 — 즉 seed→collect-call-args 위임 + modelId 보존의 조립 surface 회귀
//     (modelId guard 순서 뒤집힘, collect 위임 산출 변형/누락, modelId 다른 값으로
//     바꿔치기, externalId throw 전파 끊김) 는 컴포저 unit spec 밖의 조립 레벨에서는
//     CI 그물이 없었다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe**
//     로 동일 조립 surface(seed fixture → pipeline-plan 컴포저 → 위임 collect 산출) 를
//     검증한다. live leg(실 수집 / EvaluationScoringService / LlmHttpGateway / Ollama /
//     orchestrator / 실 github 네트워크) 는 복제하지 않고, seed-side 진입 plan 조립만
//     검증한다(evaluate-side 실행 0). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. seed-side
//         진입 plan 조립만 — evaluate-side 실행은 본 컴포저 범위 밖.
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 — deriveSince / assessment.id 치환 0. ASSESSMENT_ID_PLACEHOLDER
//         그대로 검증(실 DB write 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//
// build-time consistency-guard sweep(T-0584~T-0726) 종결과 직교한 조립 레벨 그물이며,
// T-0728(seed→run-plan→step-args)·T-0729(result-issue publish)·T-0730(evaluation-plan)
// 의 file-disjoint 병렬 sibling 이다. 컴포저 unit spec 가 닫지 못하는 조립 레벨 회귀를
// non-gated 로 cover 한다.
//
// Out of Scope (T-0731):
//   - T-0728/T-0729/T-0730 의 조립 smoke 파일 — 절대 건드리지 않음(file-disjoint 병렬).
//   - 실 CollectionEntryService.collectForPerson / 실 github 수집 / gh 실행 / 실
//     deriveSince(DB 접근) — 본 spec 은 collect 호출-args 조립 surface 만 검증.
//   - 실 EvaluationScoringService.scoreUnit / 실 LLM round-trip / Ollama / orchestrator.
//   - ASSESSMENT_ID_PLACEHOLDER → 실 assessment.id 치환 runner / 실 DB write.
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 수정 — test-only(신규 smoke spec 1 파일).
import { buildRealDataPipelinePlan } from "../helpers/realdata-e2e-pipeline-plan";
import { ASSESSMENT_ID_PLACEHOLDER } from "../helpers/realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-pipeline-plan-assembly-smoke";

// externalId 빈/공백 seed 합성 — negative case 3 용. 결정론 fixture 의 첫 descriptor 를
// 복제하되 externalId 만 빈/공백으로 손상시켜 위임 buildRealDataCollectInput throw 전파를
// 검증한다(modelId 는 유효하게 둔 채 seed 측 결함만 주입).
function seedWithBlankExternalId(externalId: string): RealDataSeedDescriptor {
  return {
    person: {
      fullName: "blank-externalid-probe",
      email: "blank-externalid-probe@e2e.realdata.test",
      active: true,
    },
    serviceIdentities: [
      {
        service: "github.com",
        externalId,
        isPrimary: true,
      },
    ],
  };
}

describe("Smoke(non-gated): 실 평가 e2e seed-side 진입 plan 조립 체인(seeds+modelId→{collectCallArgs,modelId}) live-LLM 0 검증", () => {
  describe("happy path — 조립된 진입 plan 산출", () => {
    it("결정론 seed fixture + 유효 modelId 로 { collectCallArgs, modelId } 두 필드가 모두 조립되고 위임 산출과 정합한다", () => {
      // (1) seed 빌더 — 무인자 결정론 상수 빌더(1+ 건).
      const seeds = buildRealDataE2eSeed();
      expect(seeds.length).toBeGreaterThan(0);

      // (2) pipeline-plan 단일 진입 — modelId guard 후 collect 위임을 한 묶음으로 조립.
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 두 필드 모두 산출 + collectCallArgs 길이가 seeds 길이와 1:1 + modelId 원시값 보존.
      expect(plan.collectCallArgs).toBeDefined();
      expect(plan.modelId).toBe(MODEL_ID);
      expect(plan.collectCallArgs.length).toBe(seeds.length);

      // 각 collectCallArgs 원소가 위임 helper(buildRealDataCollectCallArgs) 산출과 정합:
      // since=undefined(신규 인원 full collection)·assessmentId=ASSESSMENT_ID_PLACEHOLDER.
      for (const callArg of plan.collectCallArgs) {
        expect(callArg.since).toBeUndefined();
        expect(callArg.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
        expect(callArg.person).toBeDefined();
      }
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 seed 경로", () => {
    it("빈 seeds([]) + 유효 modelId — throw 0 으로 빈 collectCallArgs 배열 + modelId 보존(L88 빈-배열 분기)", () => {
      const plan = buildRealDataPipelinePlan([], MODEL_ID);
      expect(plan.collectCallArgs).toEqual([]);
      expect(plan.modelId).toBe(MODEL_ID);
    });

    it("단일 seed — 위임 helper 의 단일 매핑이 조립 경로로도 1:1 도달(collectCallArgs 길이 1)", () => {
      const single = [buildRealDataE2eSeed()[0]];
      const plan = buildRealDataPipelinePlan(single, MODEL_ID);
      expect(plan.collectCallArgs.length).toBe(1);
      expect(plan.modelId).toBe(MODEL_ID);
      expect(plan.collectCallArgs[0].since).toBeUndefined();
      expect(plan.collectCallArgs[0].assessmentId).toBe(
        ASSESSMENT_ID_PLACEHOLDER,
      );
    });

    it("다수 seed — 위임 helper 의 다수 매핑이 조립 경로로도 1:1 도달(collectCallArgs 길이 = seeds 길이)", () => {
      const base = buildRealDataE2eSeed();
      // fixture 가 1 건만 산출해도 다수 분기를 보장하도록 복제로 2+ 건 구성.
      const many = [...base, ...base];
      expect(many.length).toBeGreaterThanOrEqual(2);
      const plan = buildRealDataPipelinePlan(many, MODEL_ID);
      expect(plan.collectCallArgs.length).toBe(many.length);
      expect(plan.modelId).toBe(MODEL_ID);
    });
  });

  describe("negative cases — 조립 체인의 guard / 위임 throw 전파", () => {
    it("빈 modelId — buildRealDataPipelinePlan 의 modelId guard 가 collect 위임 전 throw(L109)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "")).toThrow();
    });

    it("공백만의 modelId — buildRealDataPipelinePlan 의 modelId guard 가 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "   ")).toThrow();
    });

    it("externalId 빈 seed — 위임 buildRealDataCollectInput throw 가 조립 경로로 그대로 전파(modelId 는 유효)", () => {
      expect(() =>
        buildRealDataPipelinePlan([seedWithBlankExternalId("")], MODEL_ID),
      ).toThrow();
    });

    it("externalId 공백만의 seed — 위임 throw 가 조립 경로로 그대로 전파(modelId 는 유효)", () => {
      expect(() =>
        buildRealDataPipelinePlan([seedWithBlankExternalId("   ")], MODEL_ID),
      ).toThrow();
    });

    it("빈 seeds([]) + 유효 modelId — 빈 plan(throw 0) 경계(위 flow 분기의 negative-경계 mirror)", () => {
      const plan = buildRealDataPipelinePlan([], MODEL_ID);
      expect(plan.collectCallArgs).toEqual([]);
      expect(plan.modelId).toBe(MODEL_ID);
    });
  });

  describe("guard 순서 — 빈 seeds 경계에서도 modelId guard 우선", () => {
    it("빈 seeds([]) + 빈 modelId 동시 — modelId guard 가 우선 throw(L93~95 계약)", () => {
      expect(() => buildRealDataPipelinePlan([], "")).toThrow();
    });

    it("빈 seeds([]) + 공백만의 modelId 동시 — modelId guard 가 우선 throw", () => {
      expect(() => buildRealDataPipelinePlan([], "   ")).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 입력 두 호출의 deep-equal + 참조 비공유 + 입력 불변", () => {
    it("같은 (seeds, modelId) 두 호출 → plan deep-equal 이면서 plan · plan.collectCallArgs 참조 비공유", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // deep-equal 산출(결정론).
      expect(a).toEqual(b);
      // 새 컨테이너 + 새 collectCallArgs 배열 — 두 호출이 같은 reference 를 공유하지 않음.
      expect(a).not.toBe(b);
      expect(a.collectCallArgs).not.toBe(b.collectCallArgs);
    });

    it("입력 seeds 배열 · 원소가 호출 전후로 mutate 되지 않음", () => {
      const seeds = buildRealDataE2eSeed();
      const before = JSON.parse(JSON.stringify(seeds));
      const lenBefore = seeds.length;

      buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 호출 후 입력 배열 길이 · 내용 동형(무공유 보존).
      expect(seeds.length).toBe(lenBefore);
      expect(seeds).toEqual(before);
    });
  });
});

// realdata-e2e-pipeline-plan-dual-leg-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// seed-side 진입 컴포저(buildRealDataPipelinePlan)의 **dual-leg(collectCallArgs·modelId)
// single-source convergence** non-gated build-time smoke (T-0754 박제, PLAN.md 109행
// 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - seed-side 진입 컴포저 `buildRealDataPipelinePlan(seeds, modelId)`(T-0592) 는 두
//     leg 를 단일 plan 으로 합류시킨다:
//       (1) collectCallArgs leg — buildRealDataCollectCallArgs(seeds) 위임 산출.
//           seed descriptor → collectForPerson 호출-args 묶음을 thread.
//       (2) modelId leg — guard(빈/공백 throw) 후 보존된 평가 정책 modelId.
//   - 컴포저 핵심 불변식은 **두 leg 가 각자의 단일 source 로부터 합류**한다는 것이다 —
//     collectCallArgs leg 은 위임 컴포저 단일 source, modelId leg 은 입력 modelId 의
//     guard·보존 단일 source. 두 leg 는 서로 독립 thread(한쪽 입력 변경이 다른 leg 에
//     누출되지 않음)이며, modelId guard 가 collect 위임보다 먼저 평가된다(guard-ordering).
//   - 그러나 이 dual-leg(collectCallArgs·modelId) single-source convergence 를 **직접-체인
//     으로 묶은 non-gated build-time smoke 는 부재**다. 기존 realdata-e2e-pipeline-plan-
//     assembly.smoke-spec.ts(T-0731) 는 `plan.collectCallArgs` 의 각 원소를 위임 helper
//     산출과 element 단위 shape 로만 대조하고, 빈 배열 분기에서만 toEqual([]) 한다. (a)
//     plan.collectCallArgs 전체가 직접 호출 buildRealDataCollectCallArgs(seeds) 와
//     byte-identical(collectCallArgs leg 단일 source) (b) partial-thread 격리(다른
//     seeds→collectCallArgs 만 변함·modelId 불변, 다른 modelId→modelId 만 변함·
//     collectCallArgs 불변) (c) modelId guard 가 collect 위임보다 먼저 평가됨(guard-ordering)
//     을 dual-leg convergence 관점에서 직접 단언하는 smoke 는 0 이다. 이는 T-0753 가 닫은
//     바깥 run-plan(buildRealDataE2eRunPlan) dual-leg(pipeline·run) convergence 의 **seed-side
//     안쪽 sibling** — 그 pipeline leg 을 합성하는 안쪽 컴포저의 절단면이다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     collectCallArgs leg byte-identical / modelId leg single-source / partial-thread 격리 /
//     guard-ordering / negative guard 전파를 직접-체인으로 박제한다. leg-swap·leg-drift·
//     partial-thread·guard-order-flip 회귀를 public CI 그물로 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. seed-side
//         진입 plan 조립만 — evaluate-side 실행은 본 컴포저 범위 밖.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 — deriveSince / assessment.id 치환 0. ASSESSMENT_ID_PLACEHOLDER
//         그대로(실 DB write 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//
// Out of Scope (T-0754):
//   - 기존 realdata-e2e-pipeline-plan-assembly.smoke-spec.ts(T-0731) 의 per-element shallow
//     단언 수정 / 중복 it 이관 — 본 spec 은 신규 파일만(별도 sweep 금지).
//   - 바깥 run-plan(buildRealDataE2eRunPlan) convergence 재단언 — T-0753 가 이미 cover.
//     본 spec 은 안쪽 pipeline-plan 합성만.
//   - test/helpers/realdata-e2e-pipeline-plan.ts 또는 어떤 컴포저 helper 의 로직 변경(컴포저
//     재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
//   - 실 수집 / collectForPerson / 실 scoring / scoreUnit / 실 LLM round-trip / Ollama /
//     DB / 실 gh / 실 jest spawn / 실 네트워크.
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import { buildRealDataPipelinePlan } from "../helpers/realdata-e2e-pipeline-plan";
import { buildRealDataCollectCallArgs } from "../helpers/realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-pipeline-plan-dual-leg-smoke";

// 단일-원소 변형 seeds 합성 — partial-thread 격리용(다른 seeds 입력). 기본 fixture 와
// 다른 username·email·externalId 로, collectCallArgs leg 만 변하고 modelId leg 는 불변임을
// 단언하는 데 쓴다.
function otherSeeds(externalId: string): RealDataSeedDescriptor[] {
  return [
    {
      person: {
        fullName: externalId,
        email: `${externalId}@e2e.realdata.test`,
        active: true,
      },
      serviceIdentities: [
        { service: "github.com", externalId, isPrimary: true },
      ],
    },
  ];
}

// externalId 빈/공백 seed 합성 — negative case 용. 결정론 fixture 의 모양을 복제하되
// externalId 만 빈/공백으로 손상시켜 위임 buildRealDataCollectInput throw 전파를 검증한다
// (modelId 는 유효하게 둔 채 seed 측 결함만 주입).
function seedWithBlankExternalId(externalId: string): RealDataSeedDescriptor[] {
  return [
    {
      person: {
        fullName: "blank-externalid-probe",
        email: "blank-externalid-probe@e2e.realdata.test",
        active: true,
      },
      serviceIdentities: [
        { service: "github.com", externalId, isPrimary: true },
      ],
    },
  ];
}

describe("Smoke(non-gated): 실 평가 e2e pipeline-plan 컴포저 dual-leg(collectCallArgs·modelId) single-source convergence", () => {
  describe("happy path — 두 leg 동시 합류", () => {
    it("buildRealDataPipelinePlan(seeds, modelId) — 반환 { collectCallArgs, modelId } 의 두 필드가 모두 정의·shape 보유", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // collectCallArgs leg — collectForPerson 호출-args 묶음 배열 shape.
      expect(plan.collectCallArgs).toBeDefined();
      expect(Array.isArray(plan.collectCallArgs)).toBe(true);
      // modelId leg — 평가 정책 modelId 문자열 보존.
      expect(typeof plan.modelId).toBe("string");
      expect(plan.modelId).toBe(MODEL_ID);
    });
  });

  describe("dual-leg single-source convergence (핵심) — 각 leg ↔ 직접 호출 byte-identical", () => {
    it("(a) plan.collectCallArgs 가 직접 호출 buildRealDataCollectCallArgs(seeds) 와 byte-identical(toEqual 전체 배열 deep-equal) 이며 새 배열(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 같은 seeds 로 collect 컴포저를 직접 재호출 → 컴포저의 collectCallArgs leg 와
      // 전체 배열 deep-equal(collectCallArgs leg 이 위임 컴포저 단일 source 로부터 합류).
      // element 단위 shallow 가 아닌 배열 전체 byte-identical.
      const directCollect = buildRealDataCollectCallArgs(seeds);
      expect(plan.collectCallArgs).toEqual(directCollect);
      // 동시에 새 배열로 무공유(직접-재호출 산출과 참조 비동일 — 매 호출 새 트리).
      expect(plan.collectCallArgs).not.toBe(directCollect);
    });

    it("(b) plan.modelId 가 입력 modelId 와 === (string 원시값 보존, modelId leg 단일 source)", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // modelId leg — 입력 modelId 원시값 그대로 보존(guard 통과 후 변형 0).
      expect(plan.modelId === MODEL_ID).toBe(true);
    });
  });

  describe("partial-thread 격리 (branch) — 두 leg 가 서로 독립 thread", () => {
    it("다른 seeds → collectCallArgs leg 만 변함·modelId leg 불변(교차 누출 0)", () => {
      const baseSeeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(baseSeeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(otherSeeds("other-user"), MODEL_ID);

      // collectCallArgs 는 seeds 에 의존 → 다른 seeds 면 변함.
      expect(a.collectCallArgs).not.toEqual(b.collectCallArgs);
      // modelId 는 seeds 무관 → 같은 modelId 입력이면 불변.
      expect(a.modelId).toEqual(b.modelId);
    });

    it("다른 modelId → modelId leg 만 변함·collectCallArgs leg 불변", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, `${MODEL_ID}-v2`);

      // modelId 는 입력 modelId 에 의존 → 다른 modelId 면 변함.
      expect(a.modelId).not.toEqual(b.modelId);
      // collectCallArgs 는 modelId 무관 → 같은 seeds 면 불변(직접 비교).
      expect(a.collectCallArgs).toEqual(b.collectCallArgs);
    });
  });

  describe("guard-ordering (branch) — modelId guard 가 collect 위임보다 먼저 평가됨", () => {
    it("빈 modelId + externalId 빈 seed 동시 입력 → modelId guard 가 우선 throw(collect 위임 미도달)", () => {
      // modelId 와 externalId 모두 손상된 입력 — 합성 순서상 modelId guard((2-guard))
      // 가 collect 위임((1)) 보다 먼저 평가되므로 modelId guard 가 먼저 throw 해야 한다.
      let caught: Error | undefined;
      try {
        buildRealDataPipelinePlan(seedWithBlankExternalId(""), "");
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      // 본 컴포저 modelId guard 의 메시지로 우선 throw 확인(collect 위임 측 메시지 아님).
      expect(caught?.message).toContain("buildRealDataPipelinePlan");
      expect(caught?.message).toContain("modelId");
    });
  });

  describe("error / negative — guard 전파(자체 try/catch 0)", () => {
    it("빈 modelId → 본 컴포저 modelId guard 명시적 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "")).toThrow(/modelId/);
    });

    it("공백만의 modelId → modelId guard throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "   ")).toThrow(/modelId/);
    });

    it("externalId 빈 seed(유효 modelId) → 위임 collect 매퍼 throw 전파", () => {
      expect(() =>
        buildRealDataPipelinePlan(seedWithBlankExternalId(""), MODEL_ID),
      ).toThrow();
    });

    it("externalId 공백만의 seed(유효 modelId) → 위임 collect 매퍼 throw 전파", () => {
      expect(() =>
        buildRealDataPipelinePlan(seedWithBlankExternalId("   "), MODEL_ID),
      ).toThrow();
    });

    it("빈 seeds([]) + 빈 modelId 동시 → modelId guard 가 우선 throw(빈 seeds 경계에서도 collect 미도달)", () => {
      expect(() => buildRealDataPipelinePlan([], "")).toThrow(/modelId/);
    });
  });

  describe("flow / branch — 빈·단일·다수 seeds 분기", () => {
    it("빈 seeds + 유효 modelId → plan.collectCallArgs: [] + modelId 보존(throw 0)", () => {
      const plan = buildRealDataPipelinePlan([], MODEL_ID);
      expect(plan.collectCallArgs).toEqual([]);
      expect(plan.modelId).toBe(MODEL_ID);
    });

    it("단일 seed → collectCallArgs 길이 1 + 위임 컴포저와 byte-identical", () => {
      const single = otherSeeds("solo");
      const plan = buildRealDataPipelinePlan(single, MODEL_ID);
      expect(plan.collectCallArgs.length).toBe(1);
      // 단일-source convergence 유지(위임 직접 호출과 byte-identical).
      expect(plan.collectCallArgs).toEqual(
        buildRealDataCollectCallArgs(single),
      );
    });

    it("다수 seed → collectCallArgs 길이 = seeds 길이 + 위임 컴포저와 byte-identical", () => {
      // 기본 fixture(myungjoo/leemgs 2 인) — 다수 seed 분기.
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(plan.collectCallArgs.length).toBe(seeds.length);
      expect(plan.collectCallArgs.length).toBeGreaterThan(1);
      expect(plan.collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
    });
  });

  describe("결정론·무공유·no-mutation", () => {
    it("동일 (seeds, modelId) 두 번 호출 → deep-equal + 새 plan 객체(not.toBe) + collectCallArgs 참조 비공유(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 결정론 — 동일 입력 두 호출 byte-identical.
      expect(a).toEqual(b);
      // 매 호출 새 plan 컨테이너 + 새 collectCallArgs 트리(반환 참조 비동일).
      expect(a).not.toBe(b);
      expect(a.collectCallArgs).not.toBe(b.collectCallArgs);
    });

    it("입력 seeds mutate 0 — 호출 전후 deep-equal", () => {
      const seeds = buildRealDataE2eSeed();
      const seedsBefore = JSON.parse(JSON.stringify(seeds));

      buildRealDataPipelinePlan(seeds, MODEL_ID);

      expect(seeds).toEqual(seedsBefore);
    });
  });

  describe("R-59 raw 본문 누출 0 — plan 은 식별자·modelId·placeholder 토큰만 보유", () => {
    it("sentinel — raw 외부 활동 본문(commit/PR/issue body)이 plan 직렬화에 구조적으로 미등장", () => {
      // seeds / modelId 어디에도 raw 본문은 입력되지 않으며, 컴포저는 식별자·modelId·
      // placeholder 토큰만 thread 하므로 raw 본문 sentinel 은 plan 에 등장할 수 없다.
      const sentinel = "SENTINEL-RAW-BODY-DO-NOT-LEAK-0754";
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      const serialized = JSON.stringify(plan);
      // 입력에 부재한 sentinel 은 산출에도 부재(구조적 미포함 — R-59).
      expect(serialized).not.toContain(sentinel);
      // plan 은 collectCallArgs(식별자) + modelId 만 — narrative/body 키 부재.
      expect(serialized).not.toContain("narrative");
      expect(serialized).not.toContain('"body"');
    });
  });
});

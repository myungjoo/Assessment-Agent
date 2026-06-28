// realdata-e2e-pipeline-evaluation-plan-modelid-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e pipeline-plan↔evaluation-plan 두 stage single-source modelId 정책
// cross-stage convergence 조립 체인 non-gated build-time smoke (T-0761 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0680/T-0754 pipeline-plan stage /
// T-0682/T-0756 evaluation-plan stage 단독 spec 의 cross-stage modelId-convergence 짝):
//   - PLAN 109행의 한 번의 실 평가 run 은 단일 `modelId` 평가 정책(server-side
//     `LlmProviderConfigResolver` 단일 source, ADR-0048)을 **한 번 결정**한 뒤 두
//     stage 가 그것을 공유한다 — (1) **seed-side pipeline-plan**
//     `buildRealDataPipelinePlan(seeds, modelId)`(T-0592)는 step①→② 진입 plan
//     `{collectCallArgs, modelId}` 을 산출해 step②(수집 runner)가 어떤 인원을 어떤
//     modelId 정책으로 수집→평가할지 결정하고, (2) **evaluate-side evaluation-plan**
//     `buildRealDataEvaluationPlan(activities, modelId)`(T-0591)는 step③ 평가 plan
//     `{inputs, callArgs}` 을 산출해 `callArgs[].options.modelId` 로 실제 scoring 을
//     어떤 modelId 로 수행할지 결정한다.
//   - cross-stage 핵심 불변식은 **두 stage 가 동일 단일 `modelId` 정책 source 로
//     수렴**한다는 것 — pipeline-plan 이 step② 로 carry 하는 `plan.modelId` 와
//     evaluation-plan 의 `callArgs[].options.modelId` 가 byte-identical 로 일치해야
//     한다. 두 stage 가 같은 `modelId` 를 공유하지 않으면(예: pipeline-plan 은 정책 A
//     로 수집 진입했는데 evaluation-plan 은 정책 B 로 scoring) **step② 가 A 정책
//     가정으로 수집·진입했는데 step③ 가 B 모델로 평가**해 stage 핸드오프가 깨진다
//     (평가 정책 단일성·재실행 정합 ADR-0048/REQ-037 무력화).
//   - 기존 sweep 은 두 stage 를 **각각 따로** 닫았다 — pipeline-plan stage 는
//     T-0680/T-0754(collect leg↔modelId leg 단독), evaluation-plan stage 는
//     T-0682/T-0756(inputs leg↔callArgs leg 단독). 그러나 **pipeline-plan stage 와
//     evaluation-plan stage 를 동일 단일 `modelId` 정책으로 동시 호출해, seed-side
//     진입 plan 의 `modelId` 와 evaluate-side scoring plan 의
//     `callArgs[].options.modelId` 가 byte-identical 단일 source 로 수렴**함을 박제한
//     smoke 는 NONE 이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로 두
//     stage 의 cross-stage modelId 수렴만 검증한다(pipeline-plan stage 내부 collect
//     leg↔modelId leg / evaluation-plan stage 내부 inputs leg↔callArgs leg 자체 재단언
//     금지 — 기존 spec 이미 cover). live leg(실 prisma·실 collectForPerson·실
//     github.com fetch·실 LlmProviderConfigResolver·실 LLM·DB·LAN gate)는 복제하지
//     않고, 순수 컴포저에 synthetic seed/activity 를 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 prisma 호출 0 / 실 수집 호출 0 — pipeline-plan 은 collect-call-args 트리만 관측.
//      🔥 실 LlmProviderConfigResolver 호출 0 — modelId 는 build-time placeholder 문자열로 주입.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 LLM 0 — 두 stage 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(가드 신설 금지).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0761):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(collectForPerson) / 실 prisma.upsert /
//     실 LlmProviderConfigResolver modelId 실 결정(ADR-0048) / 실 LLM scoring round-trip /
//     placeholder 치환 runner(live leg 복제 0) — 본 spec 은 plan 트리만 관측.
//   - pipeline-plan stage 내부 collect leg↔modelId leg dual-leg 수렴 전수 재단언
//     (T-0680/T-0754 이미 cover — 본 task 는 cross-stage modelId 수렴만).
//   - evaluation-plan stage 내부 inputs leg↔callArgs leg dual-leg 수렴 +
//     `callArgs[i].input === inputs[i]` reference 페어링 전수 재단언(T-0682/T-0756 이미
//     cover — 본 task 는 두 stage 간 modelId 수렴만).
//   - collectCallArgs/inputs 의 개별 shape 전수 재단언(T-0577/T-0578/T-0688/T-0691 cover).
//   - 난이도별 modelId routing(R-97 deferred) — 본 task 는 단일 modelId 동형 수렴만.
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import { buildRealDataEvaluationPlan } from "../helpers/realdata-e2e-evaluation-plan";
import { buildRealDataPipelinePlan } from "../helpers/realdata-e2e-pipeline-plan";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// build-time placeholder modelId — 실 LlmProviderConfigResolver(ADR-0048)가 돌려줄
// 단일 결정값 자리. 본 spec 은 resolver 를 호출하지 않고 이 문자열을 직접 주입한다
// (live 0). 두 stage 가 동일 source 로 수렴함을 박제하는 단일 정책 값.
const MODEL_ID = "gpt-4o-mini";

// synthetic 단일-identity seed descriptor 합성 헬퍼 — fixture shape 정합(person 메타 +
// github.com identity 1 개). R-59 정합(raw 활동 0, 식별자만).
function singleIdentitySeed(
  username: string,
  externalId: string = username,
): RealDataSeedDescriptor {
  return {
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [{ service: "github.com", externalId, isPrimary: true }],
  };
}

// synthetic GithubActivity 합성 헬퍼 — evaluation-plan stage 의 activities source.
// raw 본문 미보유(REQ-032/R-59) — 식별자/참조 필드만. kind 로 contributionKind 다양성
// (commit/pr/issue)을 만들어 multi-unit scoring 분기를 cover 한다.
function githubActivity(
  externalId: string,
  kind: "commit" | "pr" | "issue",
): Activity {
  return {
    externalId,
    sourceType: "github",
    instanceKey: "com",
    author: "myungjoo",
    timestamp: "2026-06-01T00:00:00.000Z",
    metadata: {},
    repoRef: "octo-org/octo-repo",
    kind,
  };
}

describe("Smoke(non-gated): 실 평가 e2e pipeline-plan↔evaluation-plan 두 stage single-source modelId 정책 cross-stage convergence 조립 체인 live 0 검증", () => {
  describe("happy path — 동일 modelId 로 두 stage 동시 호출 정상 산출", () => {
    it("단일 modelId 정책으로 pipeline-plan(seeds) + evaluation-plan(activities) 동시 호출 → 두 plan 모두 정상 산출({collectCallArgs, modelId} / {inputs, callArgs})", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [githubActivity("sha-1", "commit")];

      // seed-side pipeline-plan + evaluate-side evaluation-plan 동시 호출(단일 modelId).
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const evalPlan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // pipeline-plan: {collectCallArgs, modelId} 정상 산출.
      expect(Array.isArray(pipelinePlan.collectCallArgs)).toBe(true);
      expect(pipelinePlan.collectCallArgs).toHaveLength(seeds.length);
      expect(typeof pipelinePlan.modelId).toBe("string");

      // evaluation-plan: {inputs, callArgs} 정상 산출.
      expect(Array.isArray(evalPlan.inputs)).toBe(true);
      expect(Array.isArray(evalPlan.callArgs)).toBe(true);
      expect(evalPlan.callArgs).toHaveLength(activities.length);
    });
  });

  describe("cross-stage modelId single-source 수렴 — 핵심 불변식(branch)", () => {
    it("pipelinePlan.modelId 와 evalPlan.callArgs[].options.modelId 가 모두 주입한 단일 modelId 와 byte-identical(seed-side 진입 정책 === evaluate-side scoring 정책)", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [githubActivity("sha-1", "commit")];

      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const evalPlan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // seed-side 진입 plan 이 step② 로 carry 하는 정책.
      expect(pipelinePlan.modelId).toBe(MODEL_ID);
      // evaluate-side scoring 이 실제 사용하는 정책(모든 callArgs entry 가 동일).
      for (const callArg of evalPlan.callArgs) {
        expect(callArg.options.modelId).toBe(MODEL_ID);
      }

      // collect-진입 정책과 scoring 정책이 동일 source 임을 박제(stage 간 drift 0).
      expect(
        evalPlan.callArgs.every(
          (c) => c.options.modelId === pipelinePlan.modelId,
        ),
      ).toBe(true);
    });
  });

  describe("multi-unit scoring 분기에서도 modelId 동형 수렴(branch)", () => {
    it("activities 가 다양 contributionKind(commit/pr/issue) 2+ 원소 → evalPlan.callArgs 다중 entry 의 options.modelId 가 전부 pipelinePlan.modelId 와 동일(일부 unit 만 다른 modelId routing drift 0)", () => {
      const seeds = buildRealDataE2eSeed();
      // 다양 kind 3 원소 — 다중 unit scoring 분기.
      const activities = [
        githubActivity("sha-1", "commit"),
        githubActivity("pr-2", "pr"),
        githubActivity("issue-3", "issue"),
      ];

      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const evalPlan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 다중 entry 모두 동형 modelId(R-97 난이도별 routing 미적용 — 단일 modelId 동형).
      expect(evalPlan.callArgs).toHaveLength(3);
      expect(
        evalPlan.callArgs.every(
          (c) => c.options.modelId === pipelinePlan.modelId,
        ),
      ).toBe(true);
      // 일부 unit 만 다른 modelId 로 routing 되는 drift 0 — distinct modelId 집합 크기 1.
      const distinct = new Set(evalPlan.callArgs.map((c) => c.options.modelId));
      expect(distinct.size).toBe(1);
      expect([...distinct][0]).toBe(MODEL_ID);
    });
  });

  describe("partial-thread 격리 — 두 stage 가 같은 modelId source 따라 동시 이동(branch)", () => {
    it("서로 다른 modelId 정책으로 두 stage 함께 호출 → pipelinePlan.modelId 와 evalPlan.callArgs[].options.modelId 가 함께 동형 변화(한 stage 만 stale modelId 면 핸드오프 깨짐을 회귀 박제)", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [githubActivity("sha-1", "commit")];

      // 정책 A.
      const modelA = "policy-model-a";
      const pipelineA = buildRealDataPipelinePlan(seeds, modelA);
      const evalA = buildRealDataEvaluationPlan(activities, modelA);

      // 정책 B(modelId 가 다름).
      const modelB = "policy-model-b";
      const pipelineB = buildRealDataPipelinePlan(seeds, modelB);
      const evalB = buildRealDataEvaluationPlan(activities, modelB);

      // 두 stage 의 modelId 가 정책 A→B 로 **함께** 이동(drift 0).
      expect(pipelineA.modelId).not.toBe(pipelineB.modelId);
      expect(evalA.callArgs[0].options.modelId).not.toBe(
        evalB.callArgs[0].options.modelId,
      );

      // 정책 A: 두 stage modelId 가 함께 modelA 로 수렴.
      expect(pipelineA.modelId).toBe(modelA);
      expect(evalA.callArgs[0].options.modelId).toBe(modelA);
      // 정책 B: 두 stage modelId 가 함께 modelB 로 수렴.
      expect(pipelineB.modelId).toBe(modelB);
      expect(evalB.callArgs[0].options.modelId).toBe(modelB);
    });

    it("빈 seeds([]) + 빈 activities([]) + 유효 modelId → 두 stage 모두 빈 sub-배열(collectCallArgs=[] AND inputs=[]/callArgs=[])이되 pipelinePlan.modelId 는 보존(경계값 — 빈 입력에서도 modelId 정책 carry)", () => {
      const pipelinePlan = buildRealDataPipelinePlan([], MODEL_ID);
      const evalPlan = buildRealDataEvaluationPlan([], MODEL_ID);

      // 두 stage 모두 빈 sub-배열로 동형 수렴(throw 0).
      expect(pipelinePlan.collectCallArgs).toEqual([]);
      expect(evalPlan.inputs).toEqual([]);
      expect(evalPlan.callArgs).toEqual([]);

      // 그러나 modelId 정책은 빈 입력에서도 carry(seed-side 진입 정책 보존).
      expect(pipelinePlan.modelId).toBe(MODEL_ID);
    });
  });

  describe("error path / negative cases — 두 stage 의 빈/공백 modelId guard 대칭 박제", () => {
    it("빈 문자열 modelId '' → pipeline-plan stage(buildRealDataPipelinePlan) throw 전파(평가 정책 미결정 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "")).toThrow();
    });

    it("빈 문자열 modelId '' → evaluation-plan stage(buildRealDataEvaluationPlan) throw 전파(scoring 정책 미결정 차단)", () => {
      const activities = [githubActivity("sha-1", "commit")];
      expect(() => buildRealDataEvaluationPlan(activities, "")).toThrow();
    });

    it("공백-only modelId '   ' → pipeline-plan stage throw 전파(guard 대칭 — seed-side 거부)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() => buildRealDataPipelinePlan(seeds, "   ")).toThrow();
    });

    it("공백-only modelId '   ' → evaluation-plan stage throw 전파(guard 대칭 — evaluate-side 거부)", () => {
      const activities = [githubActivity("sha-1", "commit")];
      expect(() => buildRealDataEvaluationPlan(activities, "   ")).toThrow();
    });

    it("어떤 seed descriptor 의 identity externalId 가 빈 문자열 '' → pipeline-plan stage 가 위임 collect 단계 throw 전파(수집 author 귀속 key 빈값 차단 — modelId guard throw 와 분리된 두 번째 negative 경로)", () => {
      const seeds = [singleIdentitySeed("ghost", "")];
      // modelId 는 유효하므로 modelId guard 는 통과 — collect 위임이 throw.
      expect(() => buildRealDataPipelinePlan(seeds, MODEL_ID)).toThrow();
    });

    it("어떤 seed descriptor 의 identity externalId 가 공백-only '   ' → pipeline-plan stage 가 위임 collect 단계 throw 전파", () => {
      const seeds = [singleIdentitySeed("ghost", "   ")];
      expect(() => buildRealDataPipelinePlan(seeds, MODEL_ID)).toThrow();
    });
  });

  describe("flow / branch — guard 우선순위 cross-stage 정합(branch)", () => {
    it("빈 seeds([]) + 빈/공백 modelId 경계 → pipeline-plan stage 가 collect 위임보다 modelId guard 를 먼저 throw(seeds 가 비어도 modelId guard 우선)", () => {
      // 빈 seeds 면 collect 위임은 throw 0 인데도, modelId guard 가 먼저 발동해 throw.
      expect(() => buildRealDataPipelinePlan([], "")).toThrow();
      expect(() => buildRealDataPipelinePlan([], "   ")).toThrow();
      // 유효 modelId 면 빈 seeds 는 throw 0 — guard 가 modelId 미결정만 막음을 대조 확인.
      expect(() => buildRealDataPipelinePlan([], MODEL_ID)).not.toThrow();
    });

    it("evaluation-plan stage 도 동일 빈/공백 modelId 에서 throw — 두 stage 의 modelId guard 우선순위가 정합(둘 다 modelId 미결정을 먼저 막음)", () => {
      // 빈 activities 면 inputs 위임은 throw 0 인데도, modelId guard 가 먼저 throw.
      expect(() => buildRealDataEvaluationPlan([], "")).toThrow();
      expect(() => buildRealDataEvaluationPlan([], "   ")).toThrow();
      // 유효 modelId 면 빈 activities 는 throw 0 — 대조 확인.
      expect(() => buildRealDataEvaluationPlan([], MODEL_ID)).not.toThrow();
    });
  });

  describe("credential 누출 0 — 두 stage 어느 출력에도 secret/raw 활동 미포함(§9·R-59)", () => {
    it("pipelinePlan·evalPlan 직렬화 어디에도 token/secret/ghp_/--auth 어휘 + raw 활동 본문(commit/PR/issue 본문) 미포함", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [
        githubActivity("sha-1", "commit"),
        githubActivity("pr-2", "pr"),
      ];

      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const evalPlan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      const serialized = [
        JSON.stringify(pipelinePlan),
        JSON.stringify(evalPlan),
      ]
        .join(" ")
        .toLowerCase();

      // 실 credential leak shape 어휘만 검사.
      for (const secretToken of [
        "ghp_",
        "gho_",
        "--auth",
        "authorization",
        "bearer",
        "password",
        "secret",
      ]) {
        expect(serialized).not.toContain(secretToken);
      }

      // raw 외부 활동 데이터(commit/PR/issue 본문) 미포함 — 식별자·modelId 문자열·정규화
      // 평가 입력만(R-59 정합).
      const rawSerialized = [
        JSON.stringify(pipelinePlan),
        JSON.stringify(evalPlan),
      ].join(" ");
      expect(rawSerialized).not.toContain('"body"');
      expect(rawSerialized).not.toContain('"diff"');
      expect(rawSerialized).not.toContain('"message"');
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 두 번 호출 + 입력 불변", () => {
    it("두 stage 각각 두 번 호출 → deep-equal 산출(toEqual) + 새 객체(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [githubActivity("sha-1", "commit")];

      const pipelineA = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const pipelineB = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const evalA = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const evalB = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(pipelineA).toEqual(pipelineB);
      expect(evalA).toEqual(evalB);

      // 참조는 무공유 — 매 호출 새 plan 객체.
      expect(pipelineA).not.toBe(pipelineB);
      expect(evalA).not.toBe(evalB);
    });

    it("입력 seeds(중첩 person/serviceIdentities)·activities·modelId(string 원시)가 두 stage 호출 전후로 mutate 0(deep-equal snapshot 보존)", () => {
      const seeds = buildRealDataE2eSeed();
      const activities = [
        githubActivity("sha-1", "commit"),
        githubActivity("pr-2", "pr"),
      ];
      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const modelIdBefore = MODEL_ID;

      buildRealDataPipelinePlan(seeds, MODEL_ID);
      buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 호출 후 입력 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(seeds).toEqual(seedsBefore);
      expect(activities).toEqual(activitiesBefore);
      // modelId 는 string 원시값이라 변형 불가 — 동일성 명시 확인.
      expect(MODEL_ID).toBe(modelIdBefore);
    });
  });
});

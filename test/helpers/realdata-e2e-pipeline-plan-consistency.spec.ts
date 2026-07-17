// realdata-e2e-pipeline-plan-consistency.spec.ts — T-0679 colocated unit spec for
// `assertRealDataPipelinePlanConsistentWithSources`(seed-side pipeline-plan-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (seeds, modelId) 으로 컴포저(`buildRealDataPipelinePlan`)가 산출한
//     pipelinePlan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈 seeds / 단일·
//     다수 seed 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): pipelinePlan null·undefined /
//     collectCallArgs 비-배열 / seeds 비-배열 / modelId 비-string → 각 분기별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): collectCallArgs 변조(원소 누락/순서 swap)
//     / modelId 변조 → 각 RangeError + 메시지에 해당 구성요소(collectCallArgs/modelId)
//     식별자 포함.
//   - flow/branch: ① 정합 → void ② collectCallArgs drift → RangeError ③ modelId drift →
//     RangeError ④ 구조 결손 → TypeError ⑤ 재유도 위임 throw(externalId 빈/공백 seed)가
//     가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (pipelinePlan, seeds, modelId) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 pipelinePlan / seeds 객체 변경 0.
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import { assertRealDataPipelinePlanConsistentWithSources } from "./realdata-e2e-pipeline-plan-consistency";
// T-1079 구조-선행성 spy 용 namespace import — 가드의 유일 재유도 delegate
// (buildRealDataCollectCallArgs)를 jest.spyOn 으로 계측하기 위함(구조 결손 시 0-call 못박기).
import * as collectModule from "./realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

const MODEL_ID = "qwen2.5-coder:32b";

// 단일 seed fixture — buildRealDataE2eSeed 의 한 원소 모사(github.com 1 identity).
function makeSeed(username = "myungjoo"): RealDataSeedDescriptor {
  return {
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [
      { service: "github.com", externalId: username, isPrimary: true },
    ],
  };
}

// 다수 seed fixture — 실 컴포저 기본 seed(myungjoo/leemgs) 재사용.
function makeSeeds(): RealDataSeedDescriptor[] {
  return buildRealDataE2eSeed();
}

describe("assertRealDataPipelinePlanConsistentWithSources", () => {
  describe("happy-path (정합 pipelinePlan → void)", () => {
    it("다수 seed 컴포저 산출 pipelinePlan 을 그대로 넘기면 throw 0(void)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("정합 pipelinePlan 이면 void(undefined) 를 반환한다", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).toBeUndefined();
    });

    it("빈 seeds + 유효 modelId 경계 분기도 round-trip 정합(void)", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("단일 seed 분기도 round-trip 정합(void)", () => {
      const seeds = [makeSeed()];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("다른 유효 modelId 조합도 round-trip 정합(void)", () => {
      const seeds = makeSeeds();
      const modelId = "llama3.1:8b";
      const pipelinePlan = buildRealDataPipelinePlan(seeds, modelId);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          modelId,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative)", () => {
    it("collectCallArgs 손상(원소 누락) → RangeError(collectCallArgs 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: pipelinePlan.collectCallArgs.slice(0, -1),
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs.*byte-identical/s);
    });

    it("collectCallArgs 손상(원소 내부 변형) → RangeError(collectCallArgs 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: pipelinePlan.collectCallArgs.map((arg) => ({
          ...arg,
          assessmentId: "DRIFTED_ID",
        })),
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs.*byte-identical/s);
    });

    it("modelId 손상(값 변경) → RangeError(modelId 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        modelId: "다른-모델:7b",
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.modelId.*일치하지 않다/s);
    });

    it("collectCallArgs 검사가 modelId 검사보다 먼저 — 둘 다 손상 시 collectCallArgs RangeError", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        collectCallArgs: pipelinePlan.collectCallArgs.slice(0, -1),
        modelId: "다른-모델:7b",
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs/);
    });

    it("deep-equal 이 원소·순서·길이까지 강제 — collectCallArgs 원소 순서만 swap 해도 검출", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      // 다수 seed 이므로 collectCallArgs 길이 ≥ 2 — 순서만 뒤바뀐 경우도 byte-identical 위반.
      expect(pipelinePlan.collectCallArgs.length).toBeGreaterThanOrEqual(2);
      const reordered = [...pipelinePlan.collectCallArgs].reverse();
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: reordered,
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (fail-fast)", () => {
    it("pipelinePlan null → TypeError", () => {
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          null as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan 이 null\/undefined/);
    });

    it("pipelinePlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          undefined as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(TypeError);
    });

    it("pipelinePlan null 이 collectCallArgs 비-배열보다 먼저 throw (fail-fast 순서)", () => {
      // pipelinePlan 자체가 null 이므로 collectCallArgs 접근 전에 차단됨.
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          null as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan 이 null\/undefined/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("pipelinePlan.collectCallArgs 비-배열(null) → TypeError(타입 라벨 null)", () => {
      const corrupted = {
        collectCallArgs: null,
        modelId: MODEL_ID,
      } as unknown as RealDataPipelinePlan;
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: null\)/);
    });

    it("pipelinePlan.collectCallArgs 비-배열(object) → TypeError(타입 라벨 object)", () => {
      const corrupted = {
        collectCallArgs: {},
        modelId: MODEL_ID,
      } as unknown as RealDataPipelinePlan;
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(
        /pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: object\)/,
      );
    });

    it("seeds 비-배열(object) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          {} as unknown as RealDataSeedDescriptor[],
          MODEL_ID,
        ),
      ).toThrow(/seeds 가 배열이 아니다\(타입: object\)/);
    });

    it("modelId 비-string(number) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          7 as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: number\)/);
    });

    it("modelId 비-string(배열) → TypeError(타입 라벨 array)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          [] as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: array\)/);
    });

    it("modelId 비-string(null) → TypeError(타입 라벨 null)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          null as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: null\)/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("externalId 빈/공백 seed → collect 위임 하위 빌더 throw 가 전파", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const blankSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "x", email: "x@e2e.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "  ", isPrimary: true },
          ],
        },
      ];
      // 재유도 source 의 externalId 가 공백이라 collect 위임 하위 빌더가 throw.
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          blankSeeds,
          MODEL_ID,
        ),
      ).toThrow();
    });
  });

  describe("결정성 / 비변형 (negative)", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const run = () =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift pipelinePlan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        modelId: "다른-모델:7b",
      };
      const run = () =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        );
      expect(run).toThrow(/pipelinePlan\.modelId/);
      expect(run).toThrow(/pipelinePlan\.modelId/);
    });

    it("빈 seeds + 유효 modelId 정상 통과(throw 0)", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("가드 호출 후 pipelinePlan / seeds 객체 mutate 0", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const pipelinePlanSnapshot = JSON.stringify(pipelinePlan);
      const seedsSnapshot = JSON.stringify(seeds);
      assertRealDataPipelinePlanConsistentWithSources(
        pipelinePlan,
        seeds,
        MODEL_ID,
      );
      expect(JSON.stringify(pipelinePlan)).toBe(pipelinePlanSnapshot);
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
    });
  });

  // ── T-1079 구조-검사 선행성 order-lock (구조 결손 → collect 재유도 delegate 0-call) ──
  // Why: 가드 본문은 2 구조 assert(assertPipelinePlanStructure L176 / assertSourcesStructure
  // L177)를 collect 재유도 위임(buildRealDataCollectCallArgs L183)보다 **먼저** 수행한다.
  // 기존 구조 error-path 블록(L205 구조 결손 null/undefined / L238 구성요소 type 위반)은
  // .toThrow(TypeError) 만 assert 하고 재유도 delegate 호출 횟수를 못박지 않았다(spec 이
  // delegate 를 import 조차 안 함 — spyOn 0 / toHaveBeenCalledTimes(0) 0). 즉 구조 결손 입력
  // 시 delegate 가 toHaveBeenCalledTimes(0) 이어야 한다는 선행성이 미검증이었다. 본 블록은
  // 그 gap 을 구조 결손 대표 7 분기(pipelinePlan null·undefined · collectCallArgs 비-배열
  // (null/object) · seeds 비-배열 · modelId 비-string(number/null)) 각각 delegate 0-call 로
  // 확장 완결해, "구조 검사 → 값 재유도" 순서가 silent 재정렬(리팩터가 재유도를 구조 검사
  // 위로 끌어올림)로 깨지면 반드시 fail 하도록 못박는다(T-1066~T-1078 defense-in-depth 의
  // pipeline-plan mirror, 단일 delegate buildRealDataCollectCallArgs).
  //
  // R-112 cover 구조(구조-선행성):
  //   - error/negative(핵심): 구조 결손 7 분기 각각 → TypeError(한국어 라벨) + 재유도
  //     delegate 0-call. 분기 분리(단일 negative 로 묶지 않음), pipelinePlan null 과 undefined 는
  //     별 case, collectCallArgs 비-배열은 null·object, modelId 비-string 은 number·null 로 분리.
  //   - happy/flow: 정합 pipelinePlan/seeds/modelId 는 구조 검사 통과 후 delegate 에 도달
  //     (정확히 1회, seeds 인자)하고 void.
  //   - 경계 대조(negative 보강): 값 정합 위반(재유도-후 RangeError, collectCallArgs drift 또는
  //     modelId mismatch)은 구조 통과 → delegate 도달 **뒤** 발생(delegate 호출됨) — 구조
  //     (TypeError, 0-call) vs 값(재유도-후 RangeError, 1-call) 경계를 선행성 관점에서 명확화.
  //     본 가드는 구조 검사와 재유도 사이 RangeError 분기가 없어 모든 RangeError 가 delegate
  //     호출을 수반한다(daily-step-eval 의 "재유도-전 RangeError" 대조 불필요).
  describe("T-1079 — 구조-검사 선행성 order-lock(구조 결손 → collect 재유도 delegate 0-call)", () => {
    afterEach(() => {
      // 신규 spyOn 격리 — 최상위 다른 블록으로 mock 누수 방지.
      jest.restoreAllMocks();
    });

    // 구조 결손 7 분기 fixture. 결손 아닌 인자는 정합(makeSeeds/MODEL_ID/정합 pipelinePlan)으로
    // 둔다 — 결손 아닌 인자는 구조 통과해야 결손 인자에서 fail-fast 됨을 격리 확인. makeX 는
    // spyOn **전** 에 호출(정합 pipelinePlan 합성이 내부에서 delegate 를 호출하므로 계측 오염 차단).
    const STRUCTURE_DEFICIENT_CASES: Array<{
      label: string;
      makePipelinePlan: () => RealDataPipelinePlan;
      makeSeedsArg: () => RealDataSeedDescriptor[];
      makeModelId: () => string;
      messagePattern: RegExp;
    }> = [
      {
        label: "pipelinePlan null",
        makePipelinePlan: () => null as unknown as RealDataPipelinePlan,
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => MODEL_ID,
        messagePattern: /pipelinePlan 이 null\/undefined/,
      },
      {
        label: "pipelinePlan undefined",
        makePipelinePlan: () => undefined as unknown as RealDataPipelinePlan,
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => MODEL_ID,
        messagePattern: /pipelinePlan 이 null\/undefined/,
      },
      {
        label: "collectCallArgs 비-배열(null)",
        makePipelinePlan: () =>
          ({
            collectCallArgs: null,
            modelId: MODEL_ID,
          }) as unknown as RealDataPipelinePlan,
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => MODEL_ID,
        messagePattern:
          /pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: null\)/,
      },
      {
        label: "collectCallArgs 비-배열(object)",
        makePipelinePlan: () =>
          ({
            collectCallArgs: {},
            modelId: MODEL_ID,
          }) as unknown as RealDataPipelinePlan,
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => MODEL_ID,
        messagePattern:
          /pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: object\)/,
      },
      {
        label: "seeds 비-배열(object)",
        makePipelinePlan: () =>
          buildRealDataPipelinePlan(makeSeeds(), MODEL_ID),
        makeSeedsArg: () => ({}) as unknown as RealDataSeedDescriptor[],
        makeModelId: () => MODEL_ID,
        messagePattern: /seeds 가 배열이 아니다\(타입: object\)/,
      },
      {
        label: "modelId 비-string(number)",
        makePipelinePlan: () =>
          buildRealDataPipelinePlan(makeSeeds(), MODEL_ID),
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => 7 as unknown as string,
        messagePattern: /modelId 가 문자열이 아니다\(타입: number\)/,
      },
      {
        label: "modelId 비-string(null)",
        makePipelinePlan: () =>
          buildRealDataPipelinePlan(makeSeeds(), MODEL_ID),
        makeSeedsArg: () => makeSeeds(),
        makeModelId: () => null as unknown as string,
        messagePattern: /modelId 가 문자열이 아니다\(타입: null\)/,
      },
    ];

    STRUCTURE_DEFICIENT_CASES.forEach(
      ({
        label,
        makePipelinePlan,
        makeSeedsArg,
        makeModelId,
        messagePattern,
      }) => {
        it(`구조 결손[${label}] → TypeError + buildRealDataCollectCallArgs 재유도 0-call(선행 차단)`, () => {
          // 결손 아닌 인자는 spy 설치 전 합성 — 정합 pipelinePlan 합성 내부의 delegate 호출이
          // 계측을 오염시키지 않도록 격리.
          const pipelinePlan = makePipelinePlan();
          const seeds = makeSeedsArg();
          const modelId = makeModelId();
          const collectSpy = jest.spyOn(
            collectModule,
            "buildRealDataCollectCallArgs",
          );

          // 구조 결손이므로 TypeError(한국어 라벨) throw.
          expect(() =>
            assertRealDataPipelinePlanConsistentWithSources(
              pipelinePlan,
              seeds,
              modelId,
            ),
          ).toThrow(TypeError);
          expect(() =>
            assertRealDataPipelinePlanConsistentWithSources(
              pipelinePlan,
              seeds,
              modelId,
            ),
          ).toThrow(messagePattern);

          // 핵심: 구조 검사가 재유도보다 먼저 차단 → delegate 미호출(0-call).
          expect(collectSpy).toHaveBeenCalledTimes(0);
        });
      },
    );

    it("구조 검사 통과(정합 pipelinePlan/seeds/modelId) → 재유도 delegate 도달(정확히 1회, seeds 인자) 후 void", () => {
      // pipelinePlan 은 spy 설치 前 합성 — buildRealDataPipelinePlan 내부도 delegate 를 호출하므로
      // spy 설치 후 만들면 호출 횟수가 오염된다. 가드 재유도 호출만 격리 계측한다.
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const collectSpy = jest.spyOn(
        collectModule,
        "buildRealDataCollectCallArgs",
      );

      const result = assertRealDataPipelinePlanConsistentWithSources(
        pipelinePlan,
        seeds,
        MODEL_ID,
      );

      // 구조 통과 → delegate 정확히 1회 도달(정확히 seeds 인자로), 가드는 void.
      // invocationCallOrder 는 구조 검사 통과 뒤 호출된 유일 delegate 의 순번(>0)으로 도달을 못박는다.
      expect(result).toBeUndefined();
      expect(collectSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledWith(seeds);
      expect(collectSpy.mock.invocationCallOrder[0]).toBeGreaterThan(0);
    });

    it("경계 대조(재유도-후 RangeError) — collectCallArgs drift 는 구조 통과 후 delegate 도달 뒤 발생(구조 0-call vs 값 1-call)", () => {
      // 구조 온전(collectCallArgs 배열) → 재유도 도달 → drift 검출 RangeError.
      // pipelinePlan 은 spy 설치 前 합성해 계측 오염 차단.
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: pipelinePlan.collectCallArgs.slice(0, -1),
      };
      const collectSpy = jest.spyOn(
        collectModule,
        "buildRealDataCollectCallArgs",
      );

      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(RangeError);

      // 구조(TypeError, 0-call) 와 대조: 값 경로는 구조를 통과해 delegate 가 정확히 1회 호출됨.
      expect(collectSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledWith(seeds);
    });

    it("경계 대조(재유도-후 RangeError) — modelId mismatch 도 구조 통과 후 delegate 도달 뒤 발생(값 1-call)", () => {
      // collectCallArgs 정합 → 재유도 도달 + collectCallArgs 통과 → modelId === 대조에서 RangeError.
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        modelId: "다른-모델:7b",
      };
      const collectSpy = jest.spyOn(
        collectModule,
        "buildRealDataCollectCallArgs",
      );

      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.modelId/);

      // modelId RangeError 도 재유도-후 이므로 delegate 호출됨(구조 0-call 과 경계 분리).
      expect(collectSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledWith(seeds);
    });
  });
});

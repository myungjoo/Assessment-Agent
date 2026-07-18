// realdata-e2e-seed-collect-call-args-consistency.spec.ts — T-0687 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정합 callArgs(빈 배열 / 단일 seed / 다수 seed)에 대해 void 반환(throw 0).
//   - error path: callArgs null/undefined/비-배열, seeds null/비-배열, callArgs 원소가
//     객체 아님 → 각 TypeError.
//   - flow/branch: 구조 결손(TypeError) 분기 vs 값 정합 위반(RangeError) 분기 각 cover.
//     길이 불일치 / person drift / since 정책 위반 / assessmentId 정책 위반 / 위임 throw
//     전파 각 분기 분리.
//   - negative 충분 cover(Acceptance ①~⑥): callArgs 짧음/김 · person 변조 · since 비-
//     undefined · assessmentId 비-placeholder · externalId 빈/공백 seed 위임 throw 전파 ·
//     callArgs 원소 type mismatch 각 1+.
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
  type RealDataCollectCallArgs,
} from "./realdata-e2e-seed-collect-call-args";
import { assertRealDataCollectCallArgsConsistentWithSources } from "./realdata-e2e-seed-collect-call-args-consistency";
// T-1081 구조-선행성 spy 용 namespace import — 가드의 유일 재유도 delegate
// (buildRealDataCollectInput)를 jest.spyOn 으로 계측하기 위함(구조 결손 시 0-call 못박기).
import * as seedCollectInputModule from "./realdata-e2e-seed-collect-input";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// SEEDS — 기본 fixture(myungjoo/leemgs 두 Person, 각 github.com identity 1개). 다수
// seed happy-path + 대부분 negative 케이스의 base 입력.
const SEEDS: RealDataSeedDescriptor[] = buildRealDataE2eSeed();

// SINGLE — 단일 seed happy-path 용. 첫 번째 descriptor 만.
const SINGLE: RealDataSeedDescriptor[] = [SEEDS[0]];

// buildConsistent — seeds 로부터 leaf 컴포저로 정합 callArgs 를 합성한다(재유도와 동일
// 경로 — 본 helper 가 가드의 happy-path source). 본 spec 의 가드 입력은 항상 이 함수로
// 산출하거나, 그 산출을 의도적으로 변형해 negative 케이스를 만든다.
function buildConsistent(
  seeds: RealDataSeedDescriptor[],
): RealDataCollectCallArgs[] {
  return buildRealDataCollectCallArgs(seeds);
}

describe("assertRealDataCollectCallArgsConsistentWithSources", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 배열 입력(seeds=[]) → void(throw 0)", () => {
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources([], []),
      ).not.toThrow();
    });

    it("단일 seed 정합 입력 → void(throw 0)", () => {
      const callArgs = buildConsistent(SINGLE);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SINGLE),
      ).not.toThrow();
    });

    it("다수 seed(myungjoo/leemgs) 정합 입력 → void(throw 0)", () => {
      const callArgs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).not.toThrow();
    });

    it("정합 입력에 대해 반환값이 undefined(void) 다", () => {
      const callArgs = buildConsistent(SEEDS);
      expect(
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toBeUndefined();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("callArgs=null → TypeError(타입 라벨 'null' 포함)", () => {
      // null 은 typeof 가 'object' 로 뭉뚱그리지만 describe 가 'null' 라벨로 구분 노출.
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          null as unknown as RealDataCollectCallArgs[],
          SEEDS,
        ),
      ).toThrow(/callArgs 가 배열이 아니다.*null/);
    });

    it("callArgs=undefined → TypeError", () => {
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          undefined as unknown as RealDataCollectCallArgs[],
          SEEDS,
        ),
      ).toThrow(TypeError);
    });

    it("callArgs 가 비-배열(object) → TypeError(타입 라벨 포함)", () => {
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          {} as unknown as RealDataCollectCallArgs[],
          SEEDS,
        ),
      ).toThrow(/callArgs 가 배열이 아니다.*object/);
    });

    it("seeds=null → TypeError", () => {
      const callArgs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          callArgs,
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);
    });

    it("seeds 가 비-배열(string) → TypeError(타입 라벨 포함)", () => {
      const callArgs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          callArgs,
          "nope" as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seeds 가 배열이 아니다.*string/);
    });
  });

  describe("flow / branch — 구조(TypeError) vs 값 정합 위반(RangeError) 분리", () => {
    it("구조 결손은 TypeError 이고 RangeError 가 아니다", () => {
      const callArgs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(
          callArgs,
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).not.toThrow(RangeError);
    });

    it("값 정합 위반(person drift)은 RangeError 이고 TypeError 가 아니다", () => {
      const callArgs = buildConsistent(SEEDS);
      const tampered = [...callArgs];
      tampered[0] = {
        ...callArgs[0],
        person: { serviceIdentities: [] },
      } as RealDataCollectCallArgs;
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(tampered, SEEDS),
      ).not.toThrow(TypeError);
    });

    it("길이 불일치 RangeError 가 원소 검사보다 먼저 throw(fail-fast)", () => {
      // 길이 짧음 + 남은 원소도 변조 — 길이 메시지가 먼저 나와야 한다(fail-fast 순서).
      const callArgs = buildConsistent(SEEDS).slice(0, 1);
      callArgs[0] = {
        ...callArgs[0],
        person: { serviceIdentities: [] },
      } as RealDataCollectCallArgs;
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/길이가 재유도 expected 와 다르다.*기대=2.*실측=1/);
    });

    it("person 검사가 since 검사보다 먼저 throw(원소 내 fail-fast 순서)", () => {
      // 같은 index 에서 person drift + since 위반 동시 — person RangeError 가 먼저.
      const callArgs = buildConsistent(SEEDS);
      callArgs[0] = {
        person: { serviceIdentities: [] },
        since: "2026-01-01T00:00:00.000Z",
        assessmentId: ASSESSMENT_ID_PLACEHOLDER,
      };
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/callArgs\[0\]\.person 이 재유도 expected/);
    });

    it("since 검사가 assessmentId 검사보다 먼저 throw(원소 내 fail-fast 순서)", () => {
      // person 은 정합, since 위반 + assessmentId 위반 동시 — since RangeError 가 먼저.
      const callArgs = buildConsistent(SEEDS);
      callArgs[0] = {
        ...callArgs[0],
        since: "2026-01-01T00:00:00.000Z",
        assessmentId: "WRONG",
      };
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/callArgs\[0\]\.since 가 신규-인원 정책/);
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다(Acceptance ①~⑥)", () => {
    it("(①a) callArgs 길이가 seeds 보다 짧음 → RangeError(길이 정보)", () => {
      const callArgs = buildConsistent(SEEDS).slice(0, 1);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/길이.*기대=2.*실측=1/);
    });

    it("(①b) callArgs 길이가 seeds 보다 김 → RangeError(길이 정보)", () => {
      const callArgs = buildConsistent(SEEDS);
      const extra = [...callArgs, { ...callArgs[0] }];
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(extra, SEEDS),
      ).toThrow(/길이.*기대=2.*실측=3/);
    });

    it("(②) person 필드 변조(deep-equal 실패) → RangeError(어긋난 index)", () => {
      const callArgs = buildConsistent(SEEDS);
      callArgs[1] = {
        ...callArgs[1],
        person: {
          serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
        },
      } as RealDataCollectCallArgs;
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(
        /callArgs\[1\]\.person 이 재유도 expected 와 byte-identical 하지 않다/,
      );
    });

    it("(③) since 가 undefined 아님(잘못된 값 주입) → RangeError(since 필드)", () => {
      const callArgs = buildConsistent(SEEDS);
      callArgs[0] = {
        ...callArgs[0],
        since: "2026-06-01T00:00:00.000Z",
      };
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/callArgs\[0\]\.since 가 신규-인원 정책\(undefined\)과 다르다/);
    });

    it("(④) assessmentId 가 placeholder 아님 → RangeError(assessmentId 필드)", () => {
      const callArgs = buildConsistent(SEEDS);
      callArgs[1] = {
        ...callArgs[1],
        assessmentId: "real-assessment-id-123",
      };
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/callArgs\[1\]\.assessmentId 가 placeholder 정책/);
    });

    it("(⑤) externalId 빈/공백 seed 로 위임 매퍼 throw 가 그대로 전파", () => {
      // seeds 에 externalId 공백 descriptor 가 섞이면 buildRealDataCollectInput 재유도가
      // throw. 가드는 자체 try/catch 0 — 그대로 전파한다(삼키지 않음).
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "blank", email: "blank@e2e.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "   ", isPrimary: true },
          ],
        },
      ];
      // callArgs 는 정합 SINGLE 산출을 빌려 길이 1 로 맞춤(구조 통과 후 재유도 단계에서
      // 위임 throw 가 전파되는 경로 검증).
      const callArgs = buildConsistent(SINGLE);
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, badSeeds),
      ).toThrow(/externalId 가 비어있거나 공백뿐입니다/);
    });

    it("(⑥) callArgs 원소가 객체 아닌 타입(type mismatch) → TypeError", () => {
      const callArgs = buildConsistent(SEEDS);
      const tampered = [...callArgs];
      tampered[1] = "not-an-object" as unknown as RealDataCollectCallArgs;
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(tampered, SEEDS),
      ).toThrow(/callArgs\[1\] 가 객체가 아니다.*string/);
    });

    it("(⑥b) callArgs 원소가 null → TypeError(타입 라벨 'null')", () => {
      const callArgs = buildConsistent(SEEDS);
      const tampered = [...callArgs];
      tampered[0] = null as unknown as RealDataCollectCallArgs;
      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(tampered, SEEDS),
      ).toThrow(/callArgs\[0\] 가 객체가 아니다.*null/);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 callArgs 배열·원소를 변형하지 않는다", () => {
      const callArgs = buildConsistent(SEEDS);
      const lenBefore = callArgs.length;
      const firstRef = callArgs[0];
      assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS);
      expect(callArgs).toHaveLength(lenBefore);
      expect(callArgs[0]).toBe(firstRef);
    });

    it("정합 호출이 seeds 배열을 변형하지 않는다", () => {
      const callArgs = buildConsistent(SEEDS);
      const seeds: RealDataSeedDescriptor[] = [...SEEDS];
      const before = [...seeds];
      assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds);
      expect(seeds).toEqual(before);
      expect(seeds[0]).toBe(before[0]);
    });
  });

  // 구조-검사 선행성 order-lock — 구조 결손(TypeError)이 person 매퍼 재유도 위임
  // (buildRealDataCollectInput)보다 먼저 수행됨을 delegate spy 로 못박는다(T-1066~T-1080
  // defense-in-depth 의 seed-collect-call-args mirror, 단일 delegate). 기존 구조 error-path
  // 블록(L68)은 .toThrow(TypeError) 만 assert 하고 delegate 호출 횟수를 못박지 않아, "구조 검사
  // → 값 재유도" 순서를 silent 재정렬(리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어하지
  // 못했다(그 블록은 delegate 를 import 조차 안 함).
  //   - 구조 결손 6 분기(callArgs null/undefined · callArgs 비-배열(object) · callArgs 원소
  //     비-object(type mismatch) · seeds null · seeds 비-배열(string))마다 TypeError + delegate
  //     0-call. callArgs null 과 undefined 는 별 case 로 분리(단일 negative 로 묶지 않음).
  //   - happy/flow: 정합 callArgs/seeds 는 구조 검사 통과 후 delegate 에 도달(정확히 1회, seeds
  //     인자)하고 void.
  //   - 경계 대조(negative 보강): 값 정합 위반(재유도-후 RangeError, 길이 불일치 또는 person
  //     drift)은 구조 통과 → delegate 도달 **뒤** 발생(delegate 1-call) — 구조(TypeError, 0-call)
  //     vs 값(재유도-후 RangeError, 1-call) 경계를 선행성 관점에서 명확화. 본 가드는 구조 검사와
  //     재유도 사이 RangeError 분기가 없어 모든 RangeError 가 delegate 호출을 수반한다.
  describe("T-1081 — 구조-검사 선행성 order-lock(구조 결손 → buildRealDataCollectInput 재유도 delegate 0-call)", () => {
    afterEach(() => {
      // 신규 spyOn 격리 — 기존 블록(실 delegate 를 재유도에 사용)으로 mock 누수 방지.
      jest.restoreAllMocks();
    });

    // 구조 결손 6 분기 fixture. 결손 아닌 인자는 정합(정합 SEEDS/buildConsistent 산출)으로 둔다 —
    // 결손 아닌 인자는 구조 통과해야 결손 인자에서 fail-fast 됨을 격리 확인. makeCallArgs 의
    // buildConsistent 는 spyOn **전** 에 호출(정합 callArgs 합성이 내부에서 delegate 를 호출하므로
    // 계측 오염 차단).
    const STRUCTURE_DEFICIENT_CASES: Array<{
      label: string;
      makeCallArgs: () => RealDataCollectCallArgs[];
      makeSeedsArg: () => RealDataSeedDescriptor[];
      messagePattern: RegExp;
    }> = [
      {
        label: "callArgs null",
        makeCallArgs: () => null as unknown as RealDataCollectCallArgs[],
        makeSeedsArg: () => SEEDS,
        messagePattern: /callArgs 가 배열이 아니다.*null/,
      },
      {
        label: "callArgs undefined",
        makeCallArgs: () => undefined as unknown as RealDataCollectCallArgs[],
        makeSeedsArg: () => SEEDS,
        messagePattern: /callArgs 가 배열이 아니다.*undefined/,
      },
      {
        label: "callArgs 비-배열(object)",
        makeCallArgs: () => ({}) as unknown as RealDataCollectCallArgs[],
        makeSeedsArg: () => SEEDS,
        messagePattern: /callArgs 가 배열이 아니다.*object/,
      },
      {
        label: "callArgs 원소 비-object(number)",
        makeCallArgs: () => [42] as unknown as RealDataCollectCallArgs[],
        makeSeedsArg: () => SEEDS,
        messagePattern: /callArgs\[0\] 가 객체가 아니다.*number/,
      },
      {
        label: "seeds null",
        makeCallArgs: () => buildConsistent(SEEDS),
        makeSeedsArg: () => null as unknown as RealDataSeedDescriptor[],
        messagePattern: /seeds 가 배열이 아니다.*null/,
      },
      {
        label: "seeds 비-배열(string)",
        makeCallArgs: () => buildConsistent(SEEDS),
        makeSeedsArg: () => "nope" as unknown as RealDataSeedDescriptor[],
        messagePattern: /seeds 가 배열이 아니다.*string/,
      },
    ];

    STRUCTURE_DEFICIENT_CASES.forEach(
      ({ label, makeCallArgs, makeSeedsArg, messagePattern }) => {
        it(`구조 결손[${label}] → TypeError + buildRealDataCollectInput 재유도 0-call(선행 차단)`, () => {
          // 결손 아닌 인자는 spy 설치 전 합성 — 정합 callArgs 합성 내부의 delegate 호출이
          // 계측을 오염시키지 않도록 격리.
          const callArgs = makeCallArgs();
          const seeds = makeSeedsArg();
          const inputSpy = jest.spyOn(
            seedCollectInputModule,
            "buildRealDataCollectInput",
          );

          // 구조 결손이므로 TypeError(한국어 라벨) throw.
          expect(() =>
            assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds),
          ).toThrow(TypeError);
          expect(() =>
            assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds),
          ).toThrow(messagePattern);

          // 핵심: 구조 검사가 재유도보다 먼저 차단 → delegate 미호출(0-call).
          expect(inputSpy).toHaveBeenCalledTimes(0);
        });
      },
    );

    it("구조 검사 통과(정합 callArgs/seeds) → 재유도 delegate 도달(정확히 1회, seeds 인자) 후 void", () => {
      // callArgs 는 spy 설치 前 합성 — buildRealDataCollectCallArgs 내부도 delegate 를
      // 호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다. 가드 재유도 호출만 격리 계측한다.
      const callArgs = buildConsistent(SEEDS);
      const inputSpy = jest.spyOn(
        seedCollectInputModule,
        "buildRealDataCollectInput",
      );

      const result = assertRealDataCollectCallArgsConsistentWithSources(
        callArgs,
        SEEDS,
      );

      // 구조 통과 → delegate 정확히 1회 도달(정확히 seeds 인자로), 가드는 void.
      // invocationCallOrder 는 구조 검사 통과 뒤 호출된 유일 delegate 의 순번(>0)으로 도달을 못박는다.
      expect(result).toBeUndefined();
      expect(inputSpy).toHaveBeenCalledTimes(1);
      expect(inputSpy).toHaveBeenCalledWith(SEEDS);
      expect(inputSpy.mock.invocationCallOrder[0]).toBeGreaterThan(0);
      // 인자-충실도 negative(payload drift) — positive With(SEEDS)가 실제로 인자 drift 를
      // 잡음을 노출. SINGLE(길이 1)은 실제 주입 SEEDS(길이 2)와 deep-equal 미매칭이므로
      // 우연 통과 없이 축을 검증한다. [...SEEDS] 같은 얕은 복사본은 deep-equal 매칭되어
      // negative 로 부적합 — 값 자체가 다른 SINGLE 을 대상으로 삼는다.
      expect(inputSpy).not.toHaveBeenCalledWith(SINGLE);
      // arity 봉함 — delegate buildRealDataCollectInput 는 1-arg(seeds)이므로 정확히 1
      // 인자로만 호출됨(여분 인자 0)을 못박는다. 분기 없음(구조 통과 후 단일-call 경로).
      expect(inputSpy.mock.calls[0].length).toBe(1);
    });

    it("경계 대조(재유도-후 RangeError) — 길이 불일치는 구조 통과 후 delegate 도달 뒤 발생(구조 0-call vs 값 1-call)", () => {
      // 구조 온전(callArgs 배열·원소 object) → 재유도 도달 → 길이 불일치 검출 RangeError.
      // callArgs 는 spy 설치 前 합성해 계측 오염 차단.
      const callArgs = buildConsistent(SEEDS).slice(0, 1);
      const inputSpy = jest.spyOn(
        seedCollectInputModule,
        "buildRealDataCollectInput",
      );

      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/길이가 재유도 expected 와 다르다/);

      // 구조(TypeError, 0-call) 와 대조: 값 경로는 구조를 통과해 delegate 가 정확히 1회 호출됨.
      expect(inputSpy).toHaveBeenCalledTimes(1);
      expect(inputSpy).toHaveBeenCalledWith(SEEDS);
    });

    it("경계 대조(재유도-후 RangeError) — person drift 도 구조 통과 후 delegate 도달 뒤 발생(값 1-call)", () => {
      // callArgs 원소 전부 object(구조 온전) → 재유도 도달 → person deep-equal 실패 RangeError.
      const callArgs = buildConsistent(SEEDS);
      callArgs[1] = {
        ...callArgs[1],
        person: {
          serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
        },
      } as RealDataCollectCallArgs;
      const inputSpy = jest.spyOn(
        seedCollectInputModule,
        "buildRealDataCollectInput",
      );

      expect(() =>
        assertRealDataCollectCallArgsConsistentWithSources(callArgs, SEEDS),
      ).toThrow(/callArgs\[1\]\.person 이 재유도 expected/);

      // person RangeError 도 재유도-후 이므로 delegate 호출됨(구조 0-call 과 경계 분리).
      expect(inputSpy).toHaveBeenCalledTimes(1);
      expect(inputSpy).toHaveBeenCalledWith(SEEDS);
    });
  });
});

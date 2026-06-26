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
});

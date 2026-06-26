// realdata-e2e-seed-collect-call-args.spec.ts — T-0577 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: buildRealDataE2eSeed() 결과를 입력으로 2 Person 각각
//     { person, since: undefined, assessmentId: ASSESSMENT_ID_PLACEHOLDER } 정확
//     산출 + 순서 보존 + person.serviceIdentities 가 buildRealDataCollectInput 과 일치.
//   - flow/branch: 빈 입력 배열 분기 + serviceIdentities 빈 descriptor 분기 +
//     하위 매퍼 throw 전파 분기.
//   - error/negative 충분 cover: 빈 문자열 externalId throw 전파, 공백뿐 externalId
//     throw 전파, 다중 identity 중 하나만 비어도 throw 전파.
//   - 무공유/순수성: 입력 mutation 격리 + 반환값(중첩 person) mutate 격리 + 새 객체
//     트리 + 무공유 회귀(반환값 mutate 후 재호출 결과 불변).
//   - placeholder 일관성: 모든 args 의 assessmentId 가 동일 상수 + since 가 undefined.
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "./realdata-e2e-seed-collect-call-args";
import * as consistency from "./realdata-e2e-seed-collect-call-args-consistency";
import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input";
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";

// 다중 identity 를 가진 단일 Person descriptor (분기 cover 용).
const MULTI_IDENTITY_DESCRIPTOR: RealDataSeedDescriptor = {
  person: { fullName: "m", email: "m@x.test", active: true },
  serviceIdentities: [
    { service: "github.com", externalId: "m1", isPrimary: true },
    { service: "github.com", externalId: "m2", isPrimary: false },
  ],
};

describe("buildRealDataCollectCallArgs", () => {
  describe("happy path (정상 호출-args 산출)", () => {
    it("2 Person → { person, since: undefined, assessmentId: placeholder } 정확 산출", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      expect(result).toEqual([
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "leemgs" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });

    it("입력 Person 순서를 보존한다", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      expect(
        result.map((a) => a.person.serviceIdentities[0].externalId),
      ).toEqual(["myungjoo", "leemgs"]);
    });

    it("person 은 buildRealDataCollectInput 결과와 정확히 일치한다 (중복 매핑 0)", () => {
      const seeds = buildRealDataE2eSeed();
      const callArgs = buildRealDataCollectCallArgs(seeds);
      const collectInput = buildRealDataCollectInput(seeds);
      expect(callArgs.map((a) => a.person)).toEqual(collectInput);
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 입력) 빈 배열 입력 → 빈 배열 반환 (throw 0)", () => {
      expect(() => buildRealDataCollectCallArgs([])).not.toThrow();
      expect(buildRealDataCollectCallArgs([])).toEqual([]);
    });

    it("(분기 identity=0) serviceIdentities 빈 descriptor → 빈 serviceIdentities 보존", () => {
      const result = buildRealDataCollectCallArgs([
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      expect(result).toEqual([
        {
          person: { serviceIdentities: [] },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });

    it("(분기 identity=2+) 다중 identity 가 순서 보존하며 person 에 전부 매핑된다", () => {
      const result = buildRealDataCollectCallArgs([MULTI_IDENTITY_DESCRIPTOR]);
      expect(result[0].person.serviceIdentities).toEqual([
        { service: "github.com", externalId: "m1" },
        { service: "github.com", externalId: "m2" },
      ]);
    });
  });

  describe("error / negative cases (하위 매퍼 throw 전파 충분 cover)", () => {
    it("(externalId 빈 문자열) 하위 throw 가 본 빌더를 통해 전파된다", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "e", email: "e@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(externalId 공백뿐) 하위 throw 전파", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "w", email: "w@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "   ", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(다중 identity 중 하나만 비어도) throw 전파", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "p", email: "p@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "ok", isPrimary: true },
              { service: "github.com", externalId: "  ", isPrimary: false },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });
  });

  describe("placeholder 일관성 (신규-인원 full-collection 계약 박제)", () => {
    it("모든 args 의 assessmentId 가 동일 ASSESSMENT_ID_PLACEHOLDER 상수다", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
      }
    });

    it("모든 args 의 since 가 undefined 다 (신규 seed 인원 → full collection)", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(args.since).toBeUndefined();
      }
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력 seeds 배열·중첩 객체를 mutate 하지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seeds);
      buildRealDataCollectCallArgs(seeds);
      expect(JSON.stringify(seeds)).toBe(snapshot);
    });

    it("반환값(중첩 person)을 mutate 해도 원본 입력이 오염되지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const result = buildRealDataCollectCallArgs(seeds);
      result[0].person.serviceIdentities[0].externalId = "TAMPERED";
      result[0].person.serviceIdentities.push({
        service: "github.com",
        externalId: "extra",
      });
      expect(seeds[0].serviceIdentities[0].externalId).toBe("myungjoo");
      expect(seeds[0].serviceIdentities).toHaveLength(1);
    });

    it("반환값과 입력은 서로 다른 객체 트리다 (중첩 person 포함)", () => {
      const seeds = [MULTI_IDENTITY_DESCRIPTOR];
      const result = buildRealDataCollectCallArgs(seeds);
      expect(result[0].person).not.toBe(seeds[0]);
      expect(result[0].person.serviceIdentities).not.toBe(
        seeds[0].serviceIdentities,
      );
      expect(result[0].person.serviceIdentities[0]).not.toBe(
        seeds[0].serviceIdentities[0],
      );
    });

    it("(무공유 회귀) 반환값(중첩 person) mutate 후 동일 입력 재호출 결과가 불변이다", () => {
      const seeds = buildRealDataE2eSeed();
      const first = buildRealDataCollectCallArgs(seeds);
      first[0].person.serviceIdentities[0].externalId = "POLLUTED";
      const second = buildRealDataCollectCallArgs(seeds);
      expect(second).toEqual([
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "leemgs" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });
  });

  describe("(R-59) raw 활동 데이터 미포함", () => {
    it("출력 element 는 person/since/assessmentId 키만 가진다 (새 raw 필드 0)", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(Object.keys(args).sort()).toEqual([
          "assessmentId",
          "person",
          "since",
        ]);
        expect(Object.keys(args.person)).toEqual(["serviceIdentities"]);
        for (const identity of args.person.serviceIdentities) {
          expect(Object.keys(identity).sort()).toEqual([
            "externalId",
            "service",
          ]);
        }
      }
    });
  });

  // T-0688 self-wire 배선 검증 — 컴포저가 산출 RealDataCollectCallArgs[] 반환 직전
  // consistency 가드를 (산출 callArgs, seeds) 인자로 정확히 1회 self-assert 하는지, 정상
  // 합성이면 throw 0·반환 산출물 byte-identical·무공유 불변, 가드가 throw 하면 컴포저가
  // 삼키지 않고 그대로 전파하는지, 위임 매퍼 throw 입력(externalId 빈/공백)에서는 가드 진입
  // 전 그 throw 가 map 단계에서 전파(가드 미호출)되는지, 가드 회귀(RangeError/TypeError
  // 모의) 전파를 검증한다. T-0686 evaluation-inputs self-wire spec 패턴의 seed-side mirror.
  describe("consistency 가드 self-wire (T-0688) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 seed) → 가드가 (산출 callArgs, seeds) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectCallArgsConsistentWithSources",
      );
      const seeds = buildRealDataE2eSeed();

      const result = buildRealDataCollectCallArgs(seeds);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 callArgs, seeds) 와 일치.
      expect(spy).toHaveBeenCalledWith(result, seeds);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 배열 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(result);
      expect(spy.mock.calls[0][1]).toBe(seeds);
    });

    it("(분기 단일 seed) 단일 descriptor 분기에서도 가드가 (산출 callArgs, seeds) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectCallArgsConsistentWithSources",
      );
      const seeds = [MULTI_IDENTITY_DESCRIPTOR];

      const result = buildRealDataCollectCallArgs(seeds);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, seeds);
    });

    it("(분기 빈 seeds 경계) 빈 배열에서도 가드가 (산출 [], []) 로 정확히 1회 호출됨 (가드 통과·빈 산출물)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectCallArgsConsistentWithSources",
      );
      const empty: RealDataSeedDescriptor[] = [];

      const result = buildRealDataCollectCallArgs(empty);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, empty);
      // 빈 배열 통과(가드가 빈 callArgs 를 정합으로 인정 — throw 0).
      expect(result).toEqual([]);
    });

    it("정상 합성 → 가드 통과 후 반환 산출물이 self-wire 미배선 기대값(위임 매퍼 산출 + 정책 상수)과 byte-identical(불변)", () => {
      const seeds = buildRealDataE2eSeed();

      const result = buildRealDataCollectCallArgs(seeds);

      // self-wire 가 반환 산출물을 변형하지 않음 — person 은 위임 매퍼 산출과 deep-equal,
      // since/assessmentId 는 정책 상수, 순서 보존.
      expect(result).toEqual([
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "leemgs" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
      // person 은 위임 매퍼 재유도와 byte-identical.
      expect(result.map((a) => a.person)).toEqual(
        buildRealDataCollectInput(seeds),
      );
    });

    it("(negative 1 — 위임 매퍼 throw) externalId 빈/공백 seed → map 단계 throw 가 가드 진입 전 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectCallArgsConsistentWithSources",
      );
      // externalId 빈 문자열 → buildRealDataCollectInput 의 map 단계 throw 가 가드
      // self-assert 보다 먼저 평가되므로 가드 미도달.
      const broken: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "e", email: "e@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "", isPrimary: true },
          ],
        },
      ];

      expect(() => buildRealDataCollectCallArgs(broken)).toThrow(/externalId/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 2 — RangeError 길이 불일치 회귀 모사) 원소 drop 회귀 → 가드 RangeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataCollectCallArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: callArgs 길이가 재유도 expected 와 다르다 — 기대=2, 실측=1.",
          );
        });

      expect(() =>
        buildRealDataCollectCallArgs(buildRealDataE2eSeed()),
      ).toThrow(/길이가 재유도 expected 와 다르다/);
    });

    it("(negative 3 — RangeError index person drift 회귀 모사) 특정 index person 변조 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataCollectCallArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: callArgs[1].person 이 재유도 expected 와 byte-identical 하지 않다",
          );
        });

      expect(() =>
        buildRealDataCollectCallArgs(buildRealDataE2eSeed()),
      ).toThrow(/byte-identical 하지 않다/);
    });

    it("(negative 4 — RangeError since 정책 위반 회귀 모사) since 비-undefined 주입 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataCollectCallArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: callArgs[0].since 가 신규-인원 정책(undefined)과 다르다 — 실측="2026-01-01".',
          );
        });

      expect(() =>
        buildRealDataCollectCallArgs(buildRealDataE2eSeed()),
      ).toThrow(/since 가 신규-인원 정책/);
    });

    it("(negative 5 — RangeError assessmentId 정책 위반 회귀 모사) placeholder 아님 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataCollectCallArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: callArgs[0].assessmentId 가 placeholder 정책과 다르다 — 실측="real-id".',
          );
        });

      expect(() =>
        buildRealDataCollectCallArgs(buildRealDataE2eSeed()),
      ).toThrow(/assessmentId 가 placeholder 정책/);
    });

    it("(negative 6 — TypeError 구조결손 회귀 모사) 산출물 비-배열 모사 → 가드 TypeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataCollectCallArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new TypeError("callArgs 가 배열이 아니다 — 구조 검증 실패.");
        });

      expect(() =>
        buildRealDataCollectCallArgs(buildRealDataE2eSeed()),
      ).toThrow(TypeError);
    });

    it("(negative 7 — 빈 seeds 경계) 빈 배열은 가드 통과 + 빈 산출물 반환(throw 0)", () => {
      expect(() => buildRealDataCollectCallArgs([])).not.toThrow();
      expect(buildRealDataCollectCallArgs([])).toEqual([]);
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 산출물 무공유", () => {
      const seeds = buildRealDataE2eSeed();
      const seedsSnapshot = JSON.stringify(seeds);

      const a = buildRealDataCollectCallArgs(seeds);
      const b = buildRealDataCollectCallArgs(seeds);

      // 비변형(seeds mutate 0).
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
      expect(seeds).toHaveLength(2);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 배열이 호출마다 새 객체).
      expect(a).not.toBe(b);
      expect(a[0].person).not.toBe(b[0].person);
    });
  });
});

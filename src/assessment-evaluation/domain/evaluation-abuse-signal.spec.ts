// evaluation-abuse-signal.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). `computeAbuseSignal` 순수 함수의
// 결정적 abusing 신호 산출(author 그룹핑 + 저-volume × 반복 시그니처 + code/document
// 분해 + suspected 경계 + 방어적 입력 흡수)을 검증한다. 신규 파일 100% 지향 — 모든
// 분기(suspected true/false, 반복 by-unitId / by-(kind,volume), code/document,
// 경계 단위 수)를 cover 한다.

import type { ActivityMetadata } from "../../assessment-collection/domain/activity";

import {
  computeAbuseSignal,
  LOW_VOLUME_THRESHOLD,
  MIN_UNITS_FOR_SUSPICION,
  SUSPECTED_REPETITION_RATIO,
} from "./evaluation-abuse-signal";
import type { ContributionKind } from "./evaluation-input";
import type { EvaluationInput } from "./evaluation-input";

// EvaluationInput stub 빌더. volume 은 metadata.titleLength 로 산출되므로
// (evaluation-volume.ts) titleLength 로 저/고 volume 을 조절한다.
function makeInput(
  overrides: Partial<EvaluationInput> & { titleLength?: unknown } = {},
): EvaluationInput {
  const { titleLength, metadata, ...rest } = overrides;
  const finalMetadata: ActivityMetadata =
    metadata ??
    (titleLength === undefined
      ? {}
      : ({ titleLength } as unknown as ActivityMetadata));
  return {
    unitId: "github:sec:c1",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: finalMetadata,
    ...rest,
  };
}

// 고유한 unitId / 고-volume(정상) code 단위.
function highVolumeUnit(i: number, author = "gildong"): EvaluationInput {
  return makeInput({
    unitId: `github:sec:hi-${i}`,
    author,
    contributionKind: "code",
    titleLength: 100,
  });
}

// 저-volume 반복(같은 unitId) 단위 — abusing 시그니처.
function lowVolumeRepeated(author = "spammer"): EvaluationInput {
  return makeInput({
    unitId: "github:sec:dup",
    author,
    contributionKind: "code",
    titleLength: 1,
  });
}

describe("computeAbuseSignal", () => {
  describe("상수 sanity (경계 기준값)", () => {
    it("LOW_VOLUME_THRESHOLD / SUSPECTED_REPETITION_RATIO / MIN_UNITS 값", () => {
      expect(LOW_VOLUME_THRESHOLD).toBe(3);
      expect(SUSPECTED_REPETITION_RATIO).toBe(0.5);
      expect(MIN_UNITS_FOR_SUSPICION).toBe(2);
    });
  });

  describe("happy-path — 정상 batch (R-112-1)", () => {
    it("다양한 고-volume code/document 혼합은 suspected=false", () => {
      const signal = computeAbuseSignal([
        highVolumeUnit(1),
        makeInput({
          unitId: "github:sec:doc-1",
          contributionKind: "document",
          titleLength: 80,
        }),
        makeInput({
          unitId: "github:sec:doc-2",
          contributionKind: "document",
          titleLength: 60,
        }),
      ]);
      expect(signal.suspected).toBe(false);
      expect(signal.totalUnitCount).toBe(3);
      expect(signal.byAuthor).toHaveLength(1);
      const author = signal.byAuthor[0];
      expect(author.author).toBe("gildong");
      expect(author.unitCount).toBe(3);
      expect(author.lowVolumeUnitCount).toBe(0);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
      expect(author.byKind.code.unitCount).toBe(1);
      expect(author.byKind.document.unitCount).toBe(2);
    });
  });

  describe("error path / 방어 (R-112-2)", () => {
    it("빈 배열 → totalUnitCount 0, byAuthor [], suspected false, throw 없음", () => {
      let signal!: ReturnType<typeof computeAbuseSignal>;
      expect(() => {
        signal = computeAbuseSignal([]);
      }).not.toThrow();
      expect(signal.totalUnitCount).toBe(0);
      expect(signal.byAuthor).toEqual([]);
      expect(signal.suspected).toBe(false);
    });

    it("metadata 누락(빈 객체) → volume 0(저-volume) 으로 흡수, throw 없음", () => {
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:a", metadata: {} }),
        makeInput({ unitId: "github:sec:b", metadata: {} }),
      ]);
      // titleLength 부재 → volume 0 → 둘 다 같은 (kind, volume=0) 반복 + 저-volume.
      expect(signal.suspected).toBe(true);
      expect(signal.byAuthor[0].lowVolumeUnitCount).toBe(2);
    });

    it("비-number titleLength(string/boolean/null) → volume 0 fallback, throw 없음", () => {
      expect(() =>
        computeAbuseSignal([
          makeInput({ unitId: "github:sec:s", titleLength: "long-string" }),
          makeInput({ unitId: "github:sec:t", titleLength: true }),
          makeInput({ unitId: "github:sec:u", titleLength: null }),
        ]),
      ).not.toThrow();
    });

    it("비정상 timestamp 도 throw 없이 신호 산출(timestamp 미사용)", () => {
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:x", timestamp: "not-a-date" }),
        makeInput({ unitId: "github:sec:y", timestamp: "" }),
      ]);
      expect(signal.totalUnitCount).toBe(2);
    });

    it("NaN/Infinity titleLength → volume 0 fallback", () => {
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:n", titleLength: Number.NaN }),
        makeInput({
          unitId: "github:sec:i",
          titleLength: Number.POSITIVE_INFINITY,
        }),
      ]);
      expect(signal.byAuthor[0].lowVolumeUnitCount).toBe(2);
    });
  });

  describe("branch cover — suspected true/false 경계 (R-112-3)", () => {
    it("다수 저-volume 반복(같은 unitId) → suspected=true", () => {
      const signal = computeAbuseSignal([
        lowVolumeRepeated(),
        lowVolumeRepeated(),
        lowVolumeRepeated(),
      ]);
      const author = signal.byAuthor[0];
      expect(author.suspected).toBe(true);
      expect(author.repetitionRatio).toBe(1);
      expect(author.lowVolumeUnitCount).toBe(3);
      expect(signal.suspected).toBe(true);
    });

    it("repetitionRatio 가 경계(0.5) 정확히 → suspected=true (>= 경계)", () => {
      // 한 author 의 4 단위 중 2 건이 저-volume 반복(같은 unitId), 2 건은 고유 고-volume.
      const signal = computeAbuseSignal([
        lowVolumeRepeated("gildong"),
        lowVolumeRepeated("gildong"),
        highVolumeUnit(1, "gildong"),
        highVolumeUnit(2, "gildong"),
      ]);
      const author = signal.byAuthor[0];
      expect(author.unitCount).toBe(4);
      expect(author.repetitionRatio).toBe(0.5);
      expect(author.suspected).toBe(true);
    });

    it("repetitionRatio 가 경계 미만(0.25) → suspected=false", () => {
      // 4 단위 중 1 건만 저-volume(반복 아님 — 고유) → 분자 0.
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:lo", titleLength: 1 }),
        highVolumeUnit(1),
        highVolumeUnit(2),
        highVolumeUnit(3),
      ]);
      const author = signal.byAuthor[0];
      expect(author.lowVolumeUnitCount).toBe(1);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });

    it("단위 1 개만(경계 — MIN_UNITS 미만) → suspected=false", () => {
      const signal = computeAbuseSignal([lowVolumeRepeated()]);
      const author = signal.byAuthor[0];
      expect(author.unitCount).toBe(1);
      // 단일 단위는 반복 그룹 미형성 → repetitionRatio 0.
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });

    it("저-volume 2 건이지만 unitId 다르고 volume 다름(반복 아님) → suspected=false", () => {
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:p", titleLength: 1 }),
        makeInput({ unitId: "github:sec:q", titleLength: 2 }),
      ]);
      const author = signal.byAuthor[0];
      expect(author.lowVolumeUnitCount).toBe(2);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });
  });

  describe("branch cover — code abusing vs document abusing (R-112-3)", () => {
    it("code abusing — 저-volume code 단위 반복(같은 volume)", () => {
      const signal = computeAbuseSignal([
        makeInput({
          unitId: "github:sec:c1",
          contributionKind: "code",
          titleLength: 1,
        }),
        makeInput({
          unitId: "github:sec:c2",
          contributionKind: "code",
          titleLength: 1,
        }),
        makeInput({
          unitId: "github:sec:c3",
          contributionKind: "code",
          titleLength: 1,
        }),
      ]);
      const author = signal.byAuthor[0];
      // unitId 다르지만 (kind=code, volume=1) 동일 → 반복으로 분류.
      expect(author.byKind.code.repeatedUnitCount).toBe(3);
      expect(author.byKind.code.lowVolumeUnitCount).toBe(3);
      expect(author.byKind.document.unitCount).toBe(0);
      expect(author.suspected).toBe(true);
    });

    it("document abusing — 저-volume document 단위 반복(같은 volume)", () => {
      const signal = computeAbuseSignal([
        makeInput({
          unitId: "github:sec:d1",
          contributionKind: "document",
          titleLength: 2,
        }),
        makeInput({
          unitId: "github:sec:d2",
          contributionKind: "document",
          titleLength: 2,
        }),
      ]);
      const author = signal.byAuthor[0];
      expect(author.byKind.document.repeatedUnitCount).toBe(2);
      expect(author.byKind.document.lowVolumeUnitCount).toBe(2);
      expect(author.byKind.code.unitCount).toBe(0);
      expect(author.suspected).toBe(true);
    });

    it("같은 volume 이라도 kind 다르면 반복 그룹 분리(code 1 + document 1 → 반복 아님)", () => {
      const signal = computeAbuseSignal([
        makeInput({
          unitId: "github:sec:m1",
          contributionKind: "code",
          titleLength: 1,
        }),
        makeInput({
          unitId: "github:sec:m2",
          contributionKind: "document",
          titleLength: 1,
        }),
      ]);
      const author = signal.byAuthor[0];
      // (code,1) 1 건 + (document,1) 1 건 → 각 빈도 1 → 반복 아님.
      expect(author.byKind.code.repeatedUnitCount).toBe(0);
      expect(author.byKind.document.repeatedUnitCount).toBe(0);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });
  });

  describe("negative cases 충분 cover (R-112-4)", () => {
    it("단일 author 고-volume 정상 기여 → suspected=false", () => {
      const signal = computeAbuseSignal([
        highVolumeUnit(1),
        highVolumeUnit(2),
        highVolumeUnit(3),
      ]);
      expect(signal.suspected).toBe(false);
      expect(signal.byAuthor[0].repetitionRatio).toBe(0);
    });

    it("여러 author 혼합 batch — 1 명만 abusing 이면 batch suspected=true", () => {
      const signal = computeAbuseSignal([
        highVolumeUnit(1, "normal"),
        highVolumeUnit(2, "normal"),
        lowVolumeRepeated("spammer"),
        lowVolumeRepeated("spammer"),
      ]);
      expect(signal.byAuthor).toHaveLength(2);
      // 최초 등장 순서 — normal 먼저, spammer 나중.
      expect(signal.byAuthor[0].author).toBe("normal");
      expect(signal.byAuthor[0].suspected).toBe(false);
      expect(signal.byAuthor[1].author).toBe("spammer");
      expect(signal.byAuthor[1].suspected).toBe(true);
      expect(signal.suspected).toBe(true);
    });

    it("여러 author 모두 정상 → batch suspected=false", () => {
      const signal = computeAbuseSignal([
        highVolumeUnit(1, "a"),
        highVolumeUnit(2, "a"),
        highVolumeUnit(1, "b"),
        highVolumeUnit(2, "b"),
      ]);
      expect(signal.suspected).toBe(false);
      expect(signal.byAuthor.every((x) => !x.suspected)).toBe(true);
    });

    it("모든 단위 동일 unitId 중복(저-volume) → 반복 by-unitId 분기, suspected=true", () => {
      const signal = computeAbuseSignal([
        lowVolumeRepeated(),
        lowVolumeRepeated(),
        lowVolumeRepeated(),
        lowVolumeRepeated(),
      ]);
      const author = signal.byAuthor[0];
      expect(author.unitCount).toBe(4);
      expect(author.byKind.code.repeatedUnitCount).toBe(4);
      expect(author.repetitionRatio).toBe(1);
      expect(author.suspected).toBe(true);
    });

    it("고-volume 이지만 같은 unitId 반복 → 반복이나 저-volume 아니라 분자 0(suspected=false)", () => {
      // 반복(by unitId)이지만 volume 높음 → 저-volume 반복 분자에 미포함.
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:hv", titleLength: 100 }),
        makeInput({ unitId: "github:sec:hv", titleLength: 100 }),
      ]);
      const author = signal.byAuthor[0];
      expect(author.byKind.code.repeatedUnitCount).toBe(2);
      expect(author.lowVolumeUnitCount).toBe(0);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });

    it("volume 경계값 — LOW_VOLUME_THRESHOLD 정확히는 저-volume 아님", () => {
      // titleLength=3 → volume 3 = threshold → < 미충족 → 저-volume 아님.
      const signal = computeAbuseSignal([
        makeInput({ unitId: "github:sec:b1", titleLength: 3 }),
        makeInput({ unitId: "github:sec:b2", titleLength: 3 }),
      ]);
      const author = signal.byAuthor[0];
      expect(author.lowVolumeUnitCount).toBe(0);
      expect(author.repetitionRatio).toBe(0);
      expect(author.suspected).toBe(false);
    });
  });

  describe("결정성 / 부수효과 0 (referential transparency, R-112-2)", () => {
    it("동일 입력 2 회 호출이 동일 출력이다", () => {
      const inputs = [lowVolumeRepeated(), lowVolumeRepeated()];
      expect(computeAbuseSignal(inputs)).toEqual(computeAbuseSignal(inputs));
    });

    it("입력 배열·원소를 변형하지 않는다", () => {
      const inputs: EvaluationInput[] = [
        highVolumeUnit(1),
        lowVolumeRepeated(),
      ];
      const snapshot = JSON.parse(JSON.stringify(inputs));
      computeAbuseSignal(inputs);
      expect(inputs).toEqual(snapshot);
      expect(inputs).toHaveLength(2);
    });

    it("어떤 입력에서도 throw 하지 않는다", () => {
      const weird: EvaluationInput[] = [
        makeInput({ titleLength: "bad" }),
        makeInput({ metadata: {} }),
        makeInput({ timestamp: "???" }),
      ];
      expect(() => computeAbuseSignal(weird)).not.toThrow();
    });

    it("byKind 는 항상 code/document 두 키를 모두 가진다(분해 안정)", () => {
      const signal = computeAbuseSignal([highVolumeUnit(1)]);
      const kinds: ContributionKind[] = ["code", "document"];
      kinds.forEach((k) => {
        expect(signal.byAuthor[0].byKind[k]).toBeDefined();
      });
    });
  });
});

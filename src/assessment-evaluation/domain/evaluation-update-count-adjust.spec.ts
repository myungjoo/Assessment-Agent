// evaluation-update-count-adjust.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover).
// `applyUpdateCountNeutralizationToVolume` 순수 함수의 R-41 net 0 중립 보존 동작
// (neutralized author/unit 식별 + base volume 보존 + 비대상 passthrough + author
// 미매칭 + 빈 입력 + 비유한 / 음수 / NaN / Infinity 방어 + 입력 비변형 + 결정성)
// 을 검증한다. 신규 파일 100% coverage 지향 — 모든 분기를 cover 한다.
//
// abusing 감점(T-0522 applyAbuseSignalToVolume)과의 결정적 차이:
//   - 본 helper 는 감점하지 않는다. R-41 은 net 0 (advantage / penalty 둘 다 없음).
//   - 따라서 중립 대상이라 해도 정상 base volume 은 그대로 보존된다(비변형 1:1).
//   - 단 음수 / NaN / Infinity layer 경계는 FLOOR(0) 로 방어 절하한다(invariant 보호).

import type { EvaluationResult } from "./evaluation-result";
import {
  applyUpdateCountNeutralizationToVolume,
  UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR,
  type UpdateCountAdjustEntry,
} from "./evaluation-update-count-adjust";
import type {
  UpdateCountNeutralEntry,
  UpdateCountNeutralization,
} from "./evaluation-update-count-neutral";

// EvaluationResult stub 빌더. 본 helper 는 volume 만 검토 / 조정하므로 나머지 필드는
// 고정 — overrides 로 unitId 와 volume 만 변경한다.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "confluence:hq:p1",
    narrative: "정상 기여",
    difficulty: "medium",
    contribution: "medium",
    volume: 100,
    ...overrides,
  };
}

// UpdateCountNeutralEntry stub 빌더.
function makeAuthorEntry(
  overrides: Partial<UpdateCountNeutralEntry> = {},
): UpdateCountNeutralEntry {
  const neutralizedUnitIds = overrides.neutralizedUnitIds ?? [
    "confluence:hq:p1",
  ];
  return {
    author: "habitual",
    neutralizedCount: neutralizedUnitIds.length,
    neutralizedUnitIds,
    neutralized: neutralizedUnitIds.length >= 1,
    ...overrides,
  };
}

// UpdateCountNeutralization stub 빌더.
function makeNeutralization(
  byAuthor: UpdateCountNeutralEntry[],
  totalUnitCount = 0,
): UpdateCountNeutralization {
  const totalNeutralizedCount = byAuthor.reduce(
    (sum, entry) => sum + entry.neutralizedCount,
    0,
  );
  return {
    totalUnitCount: totalUnitCount || byAuthor.length,
    totalNeutralizedCount,
    byAuthor,
    neutralized: byAuthor.some((entry) => entry.neutralized),
  };
}

describe("applyUpdateCountNeutralizationToVolume", () => {
  describe("happy path (R-41 net 0 중립 보존)", () => {
    it("중립 대상으로 식별된 author/unit 의 volume 을 base 값 그대로 보존한다(감점 아님)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 100 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      // R-41 핵심: 중립 대상이어도 volume 은 base 값 그대로(net 0 — 감점 아님,
      // 보너스 아님). abuse 감점 공식을 mirror 하지 않는 것이 본 task 의 의도.
      expect(out[0].result.volume).toBe(100);
      // author 와 나머지 필드는 전사.
      expect(out[0].author).toBe("habitual");
      expect(out[0].result.unitId).toBe("confluence:hq:p1");
      expect(out[0].result.narrative).toBe("정상 기여");
      expect(out[0].result.difficulty).toBe("medium");
      expect(out[0].result.contribution).toBe("medium");
    });

    it("비대상(중립 대상 아님) author 의 unit 은 volume 그대로 passthrough", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "gildong",
          result: makeResult({ unitId: "confluence:hq:p99", volume: 80 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "gildong",
          neutralizedUnitIds: [],
          // neutralized=false (빈 ids 로 자동 계산).
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(80);
    });

    it("중립 대상 / 비대상 / 미매칭 혼합 batch 를 각각 규칙대로 처리한다", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 40 }),
        },
        {
          author: "gildong",
          result: makeResult({ unitId: "confluence:hq:p2", volume: 60 }),
        },
        {
          author: "unknown",
          result: makeResult({ unitId: "github:sec:c1", volume: 30 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
        makeAuthorEntry({
          author: "gildong",
          neutralizedUnitIds: [],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      // 중립 대상 — base 보존.
      expect(out[0].result.volume).toBe(40);
      // 비대상 — passthrough.
      expect(out[1].result.volume).toBe(60);
      // author 미매칭 — passthrough.
      expect(out[2].result.volume).toBe(30);
      // 순서와 길이 보존(caller 매핑 재사용 보장).
      expect(out).toHaveLength(3);
      expect(out.map((e) => e.author)).toEqual([
        "habitual",
        "gildong",
        "unknown",
      ]);
    });
  });

  describe("error path (명시적 입력 계약 위반)", () => {
    it("entries 가 null 이면 한국어 TypeError throw", () => {
      const neutralization = makeNeutralization([]);
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          null as unknown as UpdateCountAdjustEntry[],
          neutralization,
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          null as unknown as UpdateCountAdjustEntry[],
          neutralization,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("entries 가 undefined 이면 한국어 TypeError throw", () => {
      const neutralization = makeNeutralization([]);
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          undefined as unknown as UpdateCountAdjustEntry[],
          neutralization,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("neutralization 이 null 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          [],
          null as unknown as UpdateCountNeutralization,
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          [],
          null as unknown as UpdateCountNeutralization,
        ),
      ).toThrow("neutralization 은 null 또는 undefined 일 수 없습니다.");
    });

    it("neutralization 이 undefined 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyUpdateCountNeutralizationToVolume(
          [],
          undefined as unknown as UpdateCountNeutralization,
        ),
      ).toThrow("neutralization 은 null 또는 undefined 일 수 없습니다.");
    });
  });

  describe("branch coverage (각 분기 1+)", () => {
    it("(a) author 신호 존재 + unit 이 중립 대상 → base volume 보존", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 55 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(55);
    });

    it("(b) author 신호 존재하나 unit 이 neutralizedUnitIds 에 없음 → 무변경", () => {
      // 같은 author 의 다른 단위가 중립 대상이지만 본 단위는 아님(부분 적용 정합).
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p99", volume: 77 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(77);
    });

    it("(c) author 미매칭(신호에 author 자체가 없음) → 무변경", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "stranger",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 42 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(42);
    });

    it("(d) volume 음수 layer-경계 입력 → FLOOR(0) 절하(중립 대상)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: -10 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR);
      expect(out[0].result.volume).toBe(0);
    });

    it("author 신호 존재하나 neutralized=false → 무변경(빈 ids 보호)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 66 }),
        },
      ];
      // neutralizedUnitIds 가 비어 있으면 neutralized=false → 분기 (a) 의 short-
      // circuit 가지(authorSignal.neutralized === false) 를 cover.
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: [],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(66);
    });
  });

  describe("negative cases (예외 분기마다 충분 cover)", () => {
    it("(i) 빈 entries 배열 → 빈 배열 반환", () => {
      const out = applyUpdateCountNeutralizationToVolume(
        [],
        makeNeutralization([]),
      );
      expect(out).toEqual([]);
    });

    it("(ii) 빈 neutralization.byAuthor → 전 단위 무변경 복제", () => {
      const entries: UpdateCountAdjustEntry[] = [
        { author: "a1", result: makeResult({ unitId: "u1", volume: 55 }) },
        { author: "a2", result: makeResult({ unitId: "u2", volume: 44 }) },
      ];

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        makeNeutralization([]),
      );

      expect(out[0].result.volume).toBe(55);
      expect(out[1].result.volume).toBe(44);
      // 새 객체 복제 확인.
      expect(out[0].result).not.toBe(entries[0].result);
      expect(out[1].result).not.toBe(entries[1].result);
    });

    it("(iii) author 미매칭 단위 — 무변경 passthrough(여러 author 혼합 안전)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "phantom",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 90 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(90);
    });

    it("(iv) 동일 author 다수 단위 중 일부만 중립 대상 → 부분 적용 정합", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 40 }),
        },
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p2", volume: 80 }),
        },
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p3", volume: 60 }),
        },
      ];
      // p1, p3 만 중립 대상 — p2 는 같은 author 이지만 대상 아님.
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1", "confluence:hq:p3"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(40); // 중립 대상 — base 보존.
      expect(out[1].result.volume).toBe(80); // 같은 author 이지만 대상 아님 — 무변경.
      expect(out[2].result.volume).toBe(60); // 중립 대상 — base 보존.
    });

    it("(v) 다수 author 혼합 entries — 독립 처리 + 순서 보존", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "alpha",
          result: makeResult({ unitId: "u-a1", volume: 10 }),
        },
        {
          author: "beta",
          result: makeResult({ unitId: "u-b1", volume: 20 }),
        },
        {
          author: "alpha",
          result: makeResult({ unitId: "u-a2", volume: 30 }),
        },
        {
          author: "gamma",
          result: makeResult({ unitId: "u-g1", volume: 40 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "alpha",
          neutralizedUnitIds: ["u-a2"],
        }),
        makeAuthorEntry({
          author: "beta",
          neutralizedUnitIds: ["u-b1"],
        }),
        // gamma 는 신호에 없음(미매칭).
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out).toHaveLength(4);
      expect(out[0].result.volume).toBe(10); // alpha/u-a1 대상 아님.
      expect(out[1].result.volume).toBe(20); // beta/u-b1 중립 대상 — 보존.
      expect(out[2].result.volume).toBe(30); // alpha/u-a2 중립 대상 — 보존.
      expect(out[3].result.volume).toBe(40); // gamma 미매칭 — 무변경.
      // 순서 보존.
      expect(out.map((e) => e.author)).toEqual([
        "alpha",
        "beta",
        "alpha",
        "gamma",
      ]);
    });

    it("(vi-a) volume 0 입력(중립 대상) → 0 유지", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 0 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(0);
    });

    it("(vi-b) volume NaN 입력(중립 대상) → FLOOR(0) 절하", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({
            unitId: "confluence:hq:p1",
            volume: Number.NaN,
          }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(0);
    });

    it("(vi-c) volume Infinity 입력(중립 대상) → FLOOR(0) 절하", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({
            unitId: "confluence:hq:p1",
            volume: Number.POSITIVE_INFINITY,
          }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(0);
    });

    it("(vi-d) volume -Infinity 입력(중립 대상) → FLOOR(0) 절하", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({
            unitId: "confluence:hq:p1",
            volume: Number.NEGATIVE_INFINITY,
          }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(out[0].result.volume).toBe(0);
    });

    it("(vi-e) volume 소수(중립 대상) → floor 정규화(결정성)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 42.9 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      // floor(42.9) = 42 — base 보존 + 정수화.
      expect(out[0].result.volume).toBe(42);
    });

    it("(vi-f) 비대상 분기는 volume 을 정규화하지 않고 그대로 전사(passthrough)", () => {
      // 비대상 분기는 base value 를 그대로 둔다 — caller 가 이미 산출한 값 신뢰.
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "gildong",
          result: makeResult({ unitId: "u1", volume: 42.9 }),
        },
      ];
      const neutralization = makeNeutralization([]);

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      // 비대상은 무변경(소수도 그대로) — 비대상 분기는 정규화 책임이 없음을 외화.
      expect(out[0].result.volume).toBe(42.9);
    });
  });

  describe("입력 비변형 + 결정성", () => {
    it("입력 entries / result / neutralization 을 변형하지 않는다(deep-equal 보존)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 100 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
      ]);
      const entriesSnapshot = JSON.parse(JSON.stringify(entries));
      const neutralizationSnapshot = JSON.parse(JSON.stringify(neutralization));

      applyUpdateCountNeutralizationToVolume(entries, neutralization);

      expect(entries).toEqual(entriesSnapshot);
      expect(neutralization).toEqual(neutralizationSnapshot);
    });

    it("Object.freeze 된 입력으로 호출해도 throw 없이 통과(비변형 증명)", () => {
      const result = Object.freeze(
        makeResult({ unitId: "confluence:hq:p1", volume: 100 }),
      );
      const entry = Object.freeze({ author: "habitual", result });
      const entries = Object.freeze([
        entry,
      ]) as unknown as UpdateCountAdjustEntry[];
      const authorEntry = Object.freeze(
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: Object.freeze([
            "confluence:hq:p1",
          ]) as unknown as string[],
        }),
      );
      const neutralization = Object.freeze(makeNeutralization([authorEntry]));

      const out = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      // 중립 대상 — base 100 보존.
      expect(out[0].result.volume).toBe(100);
      // 출력은 입력과 다른 새 객체.
      expect(out[0].result).not.toBe(result);
      expect(out[0]).not.toBe(entry);
    });

    it("동일 입력 2회 호출이 동일 출력(결정성)", () => {
      const entries: UpdateCountAdjustEntry[] = [
        {
          author: "habitual",
          result: makeResult({ unitId: "confluence:hq:p1", volume: 100 }),
        },
        {
          author: "gildong",
          result: makeResult({ unitId: "confluence:hq:p2", volume: 50 }),
        },
      ];
      const neutralization = makeNeutralization([
        makeAuthorEntry({
          author: "habitual",
          neutralizedUnitIds: ["confluence:hq:p1"],
        }),
        makeAuthorEntry({
          author: "gildong",
          neutralizedUnitIds: [],
        }),
      ]);

      const first = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );
      const second = applyUpdateCountNeutralizationToVolume(
        entries,
        neutralization,
      );

      expect(first).toEqual(second);
    });
  });

  describe("상수 export", () => {
    it("UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR v1 baseline = 0", () => {
      expect(UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR).toBe(0);
    });
  });
});

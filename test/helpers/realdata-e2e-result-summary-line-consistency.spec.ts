// realdata-e2e-result-summary-line-consistency.spec.ts — T-0711 colocated unit spec for
// `assertRealDataResultSummaryLineConsistentWithSummary`.
//
// R-112 cover: happy(정합→void, 빈 batch count=0 슬롯 포함·일반 batch) · 구조 결손
// (line 비-string/null/undefined·summary null/undefined·byDifficulty/byContribution
// 누락→TypeError) · 값 정합 위반(task negative ① count drift · ② volume drift · ③
// 난이도 슬롯 값/순서 drift · ④ 기여도 슬롯 값/순서 drift · ⑤ prefix drift → RangeError) ·
// 결정성·비변형(line/summary mutate 0).
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "./realdata-e2e-result-summary-line";
import { assertRealDataResultSummaryLineConsistentWithSummary } from "./realdata-e2e-result-summary-line-consistency";

// 일반 batch fixture — count/volume + 난이도 3 슬롯 + 기여도 4 슬롯 모두 비-0.
const GENERAL_SUMMARY: RealDataResultSummary = {
  count: 5,
  totalVolume: 42,
  byDifficulty: { easy: 2, medium: 2, hard: 1 },
  byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
};

// 빈 batch fixture — count=0, 모든 슬롯 0(빈 batch 도 슬롯 누락 없이 등장).
const EMPTY_SUMMARY: RealDataResultSummary = {
  count: 0,
  totalVolume: 0,
  byDifficulty: { easy: 0, medium: 0, hard: 0 },
  byContribution: { zero: 0, low: 0, medium: 0, high: 0 },
};

// makeLine — 컴포저 실제 산출 라인을 재사용해 정상 정합 쌍을 만든다(drift 분기 test 가
// 라인 또는 summary 한쪽만 변조해 손상 fixture 를 만든다).
function makeLine(summary: RealDataResultSummary): string {
  return formatRealDataResultSummaryLine(summary);
}

describe("assertRealDataResultSummaryLineConsistentWithSummary", () => {
  describe("happy-path (정합 line↔summary → void)", () => {
    it("일반 batch — 컴포저 산출 라인을 그대로 넘기면 throw 0(void)", () => {
      const summary = GENERAL_SUMMARY;
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(summary),
          summary,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          GENERAL_SUMMARY,
        ),
      ).toBeUndefined();
    });

    it("빈 batch(count=0·전 슬롯 0)도 정합(void)", () => {
      const summary = EMPTY_SUMMARY;
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(summary),
          summary,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — line 비-string / null/undefined → TypeError (negative ⑥)", () => {
    it("line null → TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          null as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(TypeError);
    });

    it("line undefined → TypeError(메시지 노출)", () => {
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          undefined as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/line 이 string 이 아니다/);
    });

    it("line 숫자(비-string) → TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          7 as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/line 이 string 이 아니다/);
    });
  });

  describe("구조 결손 — summary null/undefined / 슬롯 누락 → TypeError (negative ⑦⑧)", () => {
    it("summary null → TypeError (negative ⑦)", () => {
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          null as unknown as RealDataResultSummary,
        ),
      ).toThrow(/summary 가 null\/undefined/);
    });

    it("summary undefined → TypeError (negative ⑦)", () => {
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          undefined as unknown as RealDataResultSummary,
        ),
      ).toThrow(TypeError);
    });

    it("summary.byDifficulty 누락(undefined) → TypeError (negative ⑧)", () => {
      const summary = {
        ...GENERAL_SUMMARY,
        byDifficulty:
          undefined as unknown as RealDataResultSummary["byDifficulty"],
      };
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          summary,
        ),
      ).toThrow(/summary\.byDifficulty 가 누락/);
    });

    it("summary.byContribution 누락(null) → TypeError (negative ⑧)", () => {
      const summary = {
        ...GENERAL_SUMMARY,
        byContribution:
          null as unknown as RealDataResultSummary["byContribution"],
      };
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          summary,
        ),
      ).toThrow(/summary\.byContribution 가 누락/);
    });
  });

  describe("값 정합 위반 — line drift → RangeError", () => {
    it("count 값 drift(라인의 count 토큰이 summary.count 와 불일치) → RangeError (negative ①)", () => {
      // summary.count=5 인데 라인은 count=99 → 독립 재합성(count=5)과 불일치.
      const drifted = makeLine(GENERAL_SUMMARY).replace("count=5", "count=99");
      const run = () =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("volume 값 drift → RangeError (negative ②)", () => {
      const drifted = makeLine(GENERAL_SUMMARY).replace(
        "volume=42",
        "volume=7",
      );
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("난이도 슬롯 값/순서 drift(easy↔hard 값 뒤바뀜) → RangeError (negative ③)", () => {
      // 라인의 난이도 슬롯 `=2/2/1` 을 `=1/2/2`(easy↔hard swap)로 변조 → summary(2/2/1) 와 불일치.
      const drifted = makeLine(GENERAL_SUMMARY).replace(
        "난이도(easy/medium/hard)=2/2/1",
        "난이도(easy/medium/hard)=1/2/2",
      );
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/난이도.*drift|기대=.*실측=/s);
    });

    it("기여도 슬롯 값/순서 drift(zero↔high 값 뒤바뀜) → RangeError (negative ④)", () => {
      // 라인의 기여도 슬롯 `=1/1/2/1` 을 `=1/1/2/9`(high 값 변조)로 변조 → summary 와 불일치.
      const drifted = makeLine(GENERAL_SUMMARY).replace(
        "기여도(zero/low/medium/high)=1/1/2/1",
        "기여도(zero/low/medium/high)=1/1/2/9",
      );
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("prefix drift → RangeError (negative ⑤)", () => {
      const drifted = makeLine(GENERAL_SUMMARY).replace(
        "실 평가 e2e 결과: ",
        "실 평가 결과: ",
      );
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("summary 측 슬롯 값이 라인과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      // 라인은 GENERAL(난이도 2/2/1) 산출인데 summary 만 난이도 슬롯을 바꾸면 재합성이 어긋남.
      const mismatched: RealDataResultSummary = {
        ...GENERAL_SUMMARY,
        byDifficulty: { easy: 5, medium: 0, hard: 0 },
      };
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          makeLine(GENERAL_SUMMARY),
          mismatched,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const line = makeLine(GENERAL_SUMMARY);
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          line,
          GENERAL_SUMMARY,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          line,
          GENERAL_SUMMARY,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const drifted = makeLine(GENERAL_SUMMARY).replace("count=5", "count=0");
      const run = () =>
        assertRealDataResultSummaryLineConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 summary 객체·하위 슬롯 mutate 0 (deep-equal 불변)", () => {
      const summary = GENERAL_SUMMARY;
      const line = makeLine(summary);
      const snapshot = JSON.stringify(summary);
      assertRealDataResultSummaryLineConsistentWithSummary(line, summary);
      expect(JSON.stringify(summary)).toBe(snapshot);
    });

    it("가드 호출 전후 line 문자열 불변(원본 동일)", () => {
      const line = makeLine(GENERAL_SUMMARY);
      const lineSnapshot = line;
      assertRealDataResultSummaryLineConsistentWithSummary(
        line,
        GENERAL_SUMMARY,
      );
      expect(line).toBe(lineSnapshot);
    });
  });
});

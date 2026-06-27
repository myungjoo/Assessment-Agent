// realdata-e2e-result-summary-markdown-consistency.spec.ts — T-0713 colocated unit
// spec for `assertRealDataResultSummaryMarkdownConsistentWithSummary`.
//
// R-112 cover: happy(정합→void, 빈 batch count=0 슬롯 포함·일반 batch, 렌더러 실
// 출력 대조) · 구조 결손(markdown 비-string/null/undefined·summary null/undefined·
// byDifficulty/byContribution 누락→TypeError) · 값 정합 위반(task negative ① count
// drift · ② volume drift · ③ 난이도 슬롯 값/순서 drift · ④ 기여도 슬롯 값/순서 drift ·
// ⑤ 헤더/표 고정 리터럴 drift → RangeError) · flow/branch(TypeError↔RangeError 분기·
// difficulty 3 슬롯·contribution 4 슬롯 순회) · 결정성·비변형(markdown/summary mutate 0).
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";
import { assertRealDataResultSummaryMarkdownConsistentWithSummary } from "./realdata-e2e-result-summary-markdown-consistency";

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

// makeMarkdown — 컴포저 실제 산출 마크다운을 재사용해 정상 정합 쌍을 만든다(drift
// 분기 test 가 마크다운 또는 summary 한쪽만 변조해 손상 fixture 를 만든다).
function makeMarkdown(summary: RealDataResultSummary): string {
  return renderRealDataResultSummaryMarkdown(summary);
}

describe("assertRealDataResultSummaryMarkdownConsistentWithSummary", () => {
  describe("happy-path (정합 markdown↔summary → void)", () => {
    it("일반 batch — 컴포저 산출 마크다운을 그대로 넘기면 throw 0(void)", () => {
      const summary = GENERAL_SUMMARY;
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(summary),
          summary,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
          GENERAL_SUMMARY,
        ),
      ).toBeUndefined();
    });

    it("빈 batch(count=0·전 슬롯 0)도 정합(void)", () => {
      const summary = EMPTY_SUMMARY;
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(summary),
          summary,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — markdown 비-string / null/undefined → TypeError (negative ⑥)", () => {
    it("markdown null → TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          null as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(TypeError);
    });

    it("markdown undefined → TypeError(메시지 노출)", () => {
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          undefined as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/markdown 이 string 이 아니다/);
    });

    it("markdown 숫자(비-string) → TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          7 as unknown as string,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/markdown 이 string 이 아니다/);
    });
  });

  describe("구조 결손 — summary null/undefined / 슬롯 누락 → TypeError (negative ⑦⑧)", () => {
    it("summary null → TypeError (negative ⑦)", () => {
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
          null as unknown as RealDataResultSummary,
        ),
      ).toThrow(/summary 가 null\/undefined/);
    });

    it("summary undefined → TypeError (negative ⑦)", () => {
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
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
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
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
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
          summary,
        ),
      ).toThrow(/summary\.byContribution 가 누락/);
    });
  });

  describe("값 정합 위반 — markdown drift → RangeError", () => {
    it("count 값 drift(마크다운의 평가 단위 수 값이 summary.count 와 불일치) → RangeError (negative ①)", () => {
      // summary.count=5 인데 마크다운은 99 → 독립 재합성(5)과 불일치.
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "- 평가 단위 수: 5",
        "- 평가 단위 수: 99",
      );
      const run = () =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("totalVolume 값 drift → RangeError (negative ②)", () => {
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "- 총 volume: 42",
        "- 총 volume: 7",
      );
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("difficulty 슬롯 값/순서 drift(easy↔hard 행 값 뒤바뀜) → RangeError (negative ③)", () => {
      // 라인 `| easy | 2 |` 을 `| easy | 1 |`(hard 값 1 과 swap)로 변조 → summary(2)와 불일치.
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "| easy | 2 |",
        "| easy | 1 |",
      );
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(/난이도.*drift|기대=.*실측=/s);
    });

    it("contribution 슬롯 값/순서 drift(high 행 값 변조) → RangeError (negative ④)", () => {
      // `| high | 1 |` 을 `| high | 9 |` 로 변조 → summary(high=1)와 불일치.
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "| high | 1 |",
        "| high | 9 |",
      );
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("헤더 고정 리터럴 drift(섹션 제목 변형) → RangeError (negative ⑤)", () => {
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "## 실 평가 e2e 결과 요약",
        "## 실 평가 결과 요약",
      );
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("표 헤더/구분선 고정 리터럴 drift(difficulty 표 헤더 행 변형) → RangeError (negative ⑤)", () => {
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "| difficulty | count |",
        "| difficulty | 개수 |",
      );
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("contribution 표 구분선 drift → RangeError (negative ⑤)", () => {
      // contribution 표의 구분선만 변형(첫 `| --- | --- |` 은 difficulty 표 것이므로
      // 마지막 매칭 — split/rejoin 으로 2 번째 구분선만 변조).
      const md = makeMarkdown(GENERAL_SUMMARY);
      const sep = "| --- | --- |";
      const lastIdx = md.lastIndexOf(sep);
      const drifted =
        md.slice(0, lastIdx) +
        "| --- | :--: |" +
        md.slice(lastIdx + sep.length);
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        ),
      ).toThrow(RangeError);
    });

    it("summary 측 슬롯 값이 마크다운과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      // 마크다운은 GENERAL(난이도 2/2/1) 산출인데 summary 만 난이도 슬롯을 바꾸면 재합성이 어긋남.
      const mismatched: RealDataResultSummary = {
        ...GENERAL_SUMMARY,
        byDifficulty: { easy: 5, medium: 0, hard: 0 },
      };
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          makeMarkdown(GENERAL_SUMMARY),
          mismatched,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const markdown = makeMarkdown(GENERAL_SUMMARY);
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          markdown,
          GENERAL_SUMMARY,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          markdown,
          GENERAL_SUMMARY,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const drifted = makeMarkdown(GENERAL_SUMMARY).replace(
        "- 평가 단위 수: 5",
        "- 평가 단위 수: 0",
      );
      const run = () =>
        assertRealDataResultSummaryMarkdownConsistentWithSummary(
          drifted,
          GENERAL_SUMMARY,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 summary 객체·하위 슬롯 mutate 0 (deep-equal 불변)", () => {
      const summary = GENERAL_SUMMARY;
      const markdown = makeMarkdown(summary);
      const snapshot = JSON.stringify(summary);
      assertRealDataResultSummaryMarkdownConsistentWithSummary(
        markdown,
        summary,
      );
      expect(JSON.stringify(summary)).toBe(snapshot);
    });

    it("가드 호출 전후 markdown 문자열 불변(원본 동일)", () => {
      const markdown = makeMarkdown(GENERAL_SUMMARY);
      const markdownSnapshot = markdown;
      assertRealDataResultSummaryMarkdownConsistentWithSummary(
        markdown,
        GENERAL_SUMMARY,
      );
      expect(markdown).toBe(markdownSnapshot);
    });
  });
});

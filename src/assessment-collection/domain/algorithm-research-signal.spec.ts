// algorithm-research-signal 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative). ADR-0064 § Decision 2(marker 그룹 3 축 · (C) 필수 · 임계 2)를
// 그대로 단언한다 — 외부 I/O 0, 순수 함수 fixture 입력만.

import {
  ALGORITHM_RESEARCH_ALGORITHM_MARKERS,
  ALGORITHM_RESEARCH_FORMAT_MARKERS,
  ALGORITHM_RESEARCH_MIN_HITS,
  ALGORITHM_RESEARCH_RESEARCH_MARKERS,
  computeAlgorithmResearchHits,
} from "./algorithm-research-signal";

describe("computeAlgorithmResearchHits", () => {
  describe("happy path (R-112-1)", () => {
    it.each([
      ["(C)+(A) — 형식·알고리즘", "신규 정렬 알고리즘 설계안 소개"],
      ["(C)+(B) — 형식·외부 연구", "arxiv 논문 정리 — 추천 모델"],
    ])("%s title 은 임계 2 를 만족한다", (_label, title) => {
      expect(computeAlgorithmResearchHits(title)).toBe(2);
      expect(computeAlgorithmResearchHits(title)).toBeGreaterThanOrEqual(
        ALGORITHM_RESEARCH_MIN_HITS,
      );
    });

    it("임계 상수는 (C) 필수 + 주제 축 1 을 뜻하는 2 다", () => {
      expect(ALGORITHM_RESEARCH_MIN_HITS).toBe(2);
    });
  });

  describe("error path (R-112-2)", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["number", 42],
      ["객체", { title: "알고리즘 소개" }],
      ["배열", ["알고리즘 소개"]],
      ["boolean", true],
    ])("비-string 입력(%s)은 throw 없이 0", (_label, input) => {
      expect(() => computeAlgorithmResearchHits(input)).not.toThrow();
      expect(computeAlgorithmResearchHits(input)).toBe(0);
    });
  });

  describe("그룹 분기별 (R-112-3)", () => {
    it.each([
      ["(C) 단독 — 주제 축 없음", "온보딩 자료 정리", 1],
      ["(A) 단독 — 형식 축 없음", "알고리즘 성능 회귀 대응", 0],
      ["(B) 단독 — 형식 축 없음", "외부 연구 미팅 회의록", 0],
      ["3 그룹 동시", "알고리즘 연구 소개", 3],
      ["대소문자 무시 — Research/Introduction", "Research Introduction", 2],
      ["대소문자 무시 — SOTA/Survey", "SOTA Survey", 2],
      ["한영 혼용", "Transformer 논문 도입 검토", 2],
    ])("%s → %d", (_label, title, expected) => {
      expect(computeAlgorithmResearchHits(title)).toBe(expected);
    });

    it("모든 marker 상수는 소문자다(부분 문자열 매칭 전제)", () => {
      const all = [
        ...ALGORITHM_RESEARCH_ALGORITHM_MARKERS,
        ...ALGORITHM_RESEARCH_RESEARCH_MARKERS,
        ...ALGORITHM_RESEARCH_FORMAT_MARKERS,
      ];
      expect(all.every((marker) => marker === marker.toLowerCase())).toBe(true);
    });
  });

  describe("negative case (R-112-4)", () => {
    it.each([
      ["빈 문자열", ""],
      ["공백뿐", "   \t "],
      ["marker 무관 title", "2026 년 2 분기 배포 일정"],
    ])("%s → 0(형식 축 미매칭)", (_label, title) => {
      expect(computeAlgorithmResearchHits(title)).toBe(0);
    });

    it("같은 그룹 marker 가 여러 개여도 중복 가산하지 않는다(그룹 단위 1)", () => {
      // (A) algorithm · 알고리즘 · heuristic 3 개 + (C) 소개 1 개 → 2(3+1 아님).
      expect(
        computeAlgorithmResearchHits("algorithm 알고리즘 heuristic 소개"),
      ).toBe(2);
      // (C) 소개 · 정리 · survey 3 개, 주제 축 0 → 1.
      expect(computeAlgorithmResearchHits("소개 정리 survey")).toBe(1);
    });

    it("반환값은 항상 0~3 정수 범위 안이다", () => {
      const probes = ["", "정리", "알고리즘 정리", "알고리즘 연구 정리"];
      for (const probe of probes) {
        const hits = computeAlgorithmResearchHits(probe);
        expect(Number.isInteger(hits)).toBe(true);
        expect(hits).toBeGreaterThanOrEqual(0);
        expect(hits).toBeLessThanOrEqual(3);
      }
    });
  });
});

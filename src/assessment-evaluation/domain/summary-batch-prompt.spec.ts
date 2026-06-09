// summary-batch-prompt spec — T-0307, ADR-0035 §Decision 5 batch prompt 경계.
// `buildSummaryBatchPrompt` 순수 함수의 결정성 + typed surface 만 직렬화(raw 0) +
// 빈 묶음/단일/다수 분기 cover(R-112 4 종, CLAUDE.md §3.2). 본 함수는 의존성 0 의
// 순수 함수라 LLM mock 0 / 네트워크 0 / DB 0 으로 독립 검증한다.
import type { EvaluationResult } from "./evaluation-result";
import {
  buildSummaryBatchPrompt,
  type SummaryBatchContext,
} from "./summary-batch-prompt";

// EvaluationResult fixture — typed surface 5 필드. raw 본문 필드는 타입상 부재.
function unit(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    unitId: "github:com/sec:abc123",
    narrative: "잘 구조화된 리팩터링 기여",
    difficulty: "hard",
    contribution: "high",
    volume: 42,
    ...overrides,
  };
}

const CONTEXT: SummaryBatchContext = {
  personId: "person-7",
  period: "weekly",
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
};

describe("buildSummaryBatchPrompt", () => {
  describe("happy-path — typed surface 직렬화", () => {
    it("좌표 context(personId/period/periodStart) 를 prompt heading 에 포함한다", () => {
      const prompt = buildSummaryBatchPrompt(CONTEXT, [unit()]);

      expect(prompt).toContain("personId: person-7");
      expect(prompt).toContain("period: weekly");
      // periodStart 는 ISO-8601 결정적 직렬화.
      expect(prompt).toContain("periodStart: 2026-06-01T00:00:00.000Z");
      expect(prompt).toContain("unitCount: 1");
    });

    it("각 unit 의 per-unit typed surface(difficulty/contribution/volume/narrative)를 line 으로 포함한다", () => {
      const prompt = buildSummaryBatchPrompt(CONTEXT, [unit()]);

      expect(prompt).toContain("difficulty: hard");
      expect(prompt).toContain("contribution: high");
      expect(prompt).toContain("volume: 42");
      expect(prompt).toContain("narrative: 잘 구조화된 리팩터링 기여");
    });
  });

  describe("branch — 단일 / 다수 / 빈 묶음", () => {
    it("다수 unit 묶음의 모든 unit 이 입력 순서 그대로 직렬화된다(인덱스 [1]..[N])", () => {
      const results = [
        unit({ narrative: "첫 번째 기여", difficulty: "easy" }),
        unit({ narrative: "두 번째 기여", difficulty: "medium" }),
        unit({ narrative: "세 번째 기여", difficulty: "hard" }),
      ];

      const prompt = buildSummaryBatchPrompt(CONTEXT, results);

      expect(prompt).toContain("unitCount: 3");
      expect(prompt).toContain("[1]");
      expect(prompt).toContain("[2]");
      expect(prompt).toContain("[3]");
      // 입력 순서 보존 — 첫 번째가 두 번째보다 앞에 등장.
      expect(prompt.indexOf("첫 번째 기여")).toBeLessThan(
        prompt.indexOf("두 번째 기여"),
      );
      expect(prompt.indexOf("두 번째 기여")).toBeLessThan(
        prompt.indexOf("세 번째 기여"),
      );
    });

    it("빈 묶음 → throw 0, 빈 묶음 안내 line 을 포함한 valid prompt 반환", () => {
      const prompt = buildSummaryBatchPrompt(CONTEXT, []);

      expect(prompt).toContain("unitCount: 0");
      expect(prompt).toContain("평가할 단위 기여가 없음");
      // heading 좌표는 여전히 포함.
      expect(prompt).toContain("personId: person-7");
    });
  });

  describe("negative — raw 본문 미포함(typed surface only, REQ-032 / §Decision 2)", () => {
    it("narrative 가 raw-오인 문자열을 포함해도 builder 가 추가로 raw 본문 키를 직렬화하지 않는다", () => {
      // EvaluationResult 에는 raw 본문 필드(commit message 전문 / diff / issue body /
      // page HTML)가 타입상 부재하므로, prompt 에 raw 본문 키 자체가 등장하지 않는다.
      const prompt = buildSummaryBatchPrompt(CONTEXT, [unit()]);

      // raw 본문 키워드 marker 가 prompt 에 등장하지 않는다(typed surface only).
      expect(prompt).not.toContain("commitMessage");
      expect(prompt).not.toContain("diff:");
      expect(prompt).not.toContain("issueBody");
      expect(prompt).not.toContain("pageHtml");
      expect(prompt).not.toContain("<html");
    });

    it("EvaluationResult 의 typed 필드만 prompt 에 반영된다(평가-파생 필드 whitelist)", () => {
      const result = unit({
        narrative: "정상 평가문",
        difficulty: "medium",
        contribution: "low",
        volume: 3,
      });

      const prompt = buildSummaryBatchPrompt(CONTEXT, [result]);

      // 평가-파생 typed 필드만 등장.
      expect(prompt).toContain("difficulty: medium");
      expect(prompt).toContain("contribution: low");
      expect(prompt).toContain("volume: 3");
      expect(prompt).toContain("narrative: 정상 평가문");
    });
  });

  describe("determinism / no-side-effect", () => {
    it("동일 입력 → 동일 prompt(2 회 호출)", () => {
      const results = [unit(), unit({ narrative: "다른 기여" })];

      const first = buildSummaryBatchPrompt(CONTEXT, results);
      const second = buildSummaryBatchPrompt(CONTEXT, results);

      expect(first).toBe(second);
    });

    it("입력 배열/context 를 변형하지 않는다(부수효과 0)", () => {
      const results = [unit()];
      const snapshot = JSON.parse(JSON.stringify(results));

      buildSummaryBatchPrompt(CONTEXT, results);

      expect(JSON.parse(JSON.stringify(results))).toEqual(snapshot);
    });
  });
});

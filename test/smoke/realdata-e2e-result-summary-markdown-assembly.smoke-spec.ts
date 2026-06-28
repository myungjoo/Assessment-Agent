// realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts — 실 평가 e2e
// result-summary→markdown 조립 체인 non-gated build-time smoke (T-0748, PLAN.md
// 109행 🟢 실 평가 e2e). step ③(평가)→step ④(결과 이슈 박제) 경계의 post-eval
// 결과 요약 렌더 leg 는 두 컴포저가 직렬로 닫는다 — buildRealDataResultSummary(
// T-0705/T-0706)가 EvaluationResult[] 를 RealDataResultSummary 로 집계하고,
// renderRealDataResultSummaryMarkdown(T-0714)이 그 descriptor 를 daily-test 이슈
// 본문용 결정론 마크다운(헤더 + 평가 단위 수 + 총 volume + difficulty/contribution
// 분포 표) 으로 렌더한다. T-0740 (results→summary→descriptor, issue-descriptor side)
// 의 markdown-본문 side 대칭 sibling. synthetic EvaluationResult literal 직접 주입으로
// 실 LLM / EvaluationScoringService.scoreUnit / Ollama / 실 github / 실 gh / 실 jest
// spawn / DB / 네트워크 0 복제. credential 0·process.env 읽기 0·gating 0(public CI
// 항상 green, R-113). 기존 컴포저 import 재사용만(consistency-guard 신설 금지, T-0726).
// Out of Scope: 실 LLM/평가/github/gh, buildRealDataResultReportPlan(T-0740 cover),
// 컴포저·가드·helper·production src/ 수정, 기존 smoke 파일 수정.
import {
  CONTRIBUTION_LEVELS,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
import { renderRealDataResultSummaryMarkdown } from "../helpers/realdata-e2e-result-summary-markdown";

// synthetic EvaluationResult 1 건 — 도메인 타입 정합(difficulty/contribution 멤버십)만
// 만족하는 minimal literal. 실 LLM 호출 없이 EvaluationResult shape 만 강제.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative: "synthetic evaluation narrative — assembly smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// renderViaChain — 본 smoke 의 종단 조립 진입. results→summary→markdown 한 호출.
function renderViaChain(results: EvaluationResult[]): string {
  const summary = buildRealDataResultSummary(results);
  return renderRealDataResultSummaryMarkdown(summary);
}

describe("Smoke(non-gated): 실 평가 e2e result-summary→markdown 조립 체인(results→summary→markdown) live-LLM 0 검증", () => {
  describe("happy path — 종단 조립 markdown 산출", () => {
    it("다수 results(난이도/기여도/volume 다양) → markdown 이 고정 헤더·평가 단위 수·총 volume·difficulty/contribution 분포 섹션 골격을 모두 보유", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];

      const markdown = renderViaChain(results);

      expect(markdown).toContain("## 실 평가 e2e 결과 요약");
      expect(markdown).toContain(`- 평가 단위 수: ${results.length}`);
      expect(markdown).toContain("- 총 volume: 10");
      expect(markdown).toContain("### difficulty 분포");
      expect(markdown).toContain("| difficulty | count |");
      expect(markdown).toContain("### contribution 분포");
      expect(markdown).toContain("| contribution | count |");
      expect(markdown).toContain("| --- | --- |");
    });

    it("다수 results 의 chain 산출 markdown 이 expected literal(슬롯 single-source 순서대로 카운트 보간)과 byte-identical(toBe deep string)", () => {
      const results = [
        syntheticResult("github:github.com:e1", "easy", "low", 3),
        syntheticResult("github:github.com:e2", "medium", "high", 5),
        syntheticResult("github:github.com:e3", "hard", "medium", 2),
      ];

      const expected = [
        "## 실 평가 e2e 결과 요약",
        "",
        `- 평가 단위 수: ${results.length}`,
        "- 총 volume: 10",
        "",
        "### difficulty 분포",
        "",
        "| difficulty | count |",
        "| --- | --- |",
        "| easy | 1 |",
        "| medium | 1 |",
        "| hard | 1 |",
        "",
        "### contribution 분포",
        "",
        "| contribution | count |",
        "| --- | --- |",
        "| zero | 0 |",
        "| low | 1 |",
        "| medium | 1 |",
        "| high | 1 |",
      ].join("\n");

      expect(renderViaChain(results)).toBe(expected);
    });

    it("markdown 안의 difficulty/contribution 표 카운트가 중간 summary.byDifficulty/byContribution 값과 동일하게 전파(재집계 없이 위임 산출만 thread)", () => {
      const results = [
        syntheticResult("github:github.com:p1", "easy", "low", 1),
        syntheticResult("github:github.com:p2", "easy", "high", 2),
        syntheticResult("github:github.com:p3", "hard", "medium", 4),
      ];
      const summary = buildRealDataResultSummary(results);
      const markdown = renderRealDataResultSummaryMarkdown(summary);
      for (const difficulty of DIFFICULTIES) {
        expect(markdown).toContain(
          `| ${difficulty} | ${summary.byDifficulty[difficulty]} |`,
        );
      }
      for (const level of CONTRIBUTION_LEVELS) {
        expect(markdown).toContain(
          `| ${level} | ${summary.byContribution[level]} |`,
        );
      }
    });
  });

  describe("단일 source 조립 단언 — 중간 summary 단일 source 전파, 재합성 없이 위임 산출만 옮김", () => {
    it("chain 산출 markdown 이 renderRealDataResultSummaryMarkdown(buildRealDataResultSummary(results)) 와 toBe 동일(중간 summary 단일 source)", () => {
      const results = [
        syntheticResult("github:github.com:s1", "easy", "zero", 2),
        syntheticResult("github:github.com:s2", "hard", "high", 4),
      ];

      const viaChain = renderViaChain(results);
      const viaDirect = renderRealDataResultSummaryMarkdown(
        buildRealDataResultSummary(results),
      );

      expect(viaChain).toBe(viaDirect);
    });

    it("markdown 의 `- 평가 단위 수`·`- 총 volume` 토큰이 summary.count·summary.totalVolume 과 정합(집계↔렌더 토큰 정합)", () => {
      const results = [
        syntheticResult("github:github.com:t1", "medium", "low", 1),
        syntheticResult("github:github.com:t2", "medium", "medium", 6),
      ];
      const summary = buildRealDataResultSummary(results);
      const markdown = renderRealDataResultSummaryMarkdown(summary);
      expect(markdown).toContain(`- 평가 단위 수: ${summary.count}`);
      expect(markdown).toContain(`- 총 volume: ${summary.totalVolume}`);
    });
  });

  describe("flow / branch — 빈 / 단일 / 슬롯 집중 results 경로(분기별 분리)", () => {
    it("빈 results([]) → summary count 0·전 슬롯 0·totalVolume 0 → markdown 이 `- 평가 단위 수: 0`·`- 총 volume: 0`·전 슬롯 0 표 보유(빈-입력 종단 렌더)", () => {
      const markdown = renderViaChain([]);

      expect(markdown).toContain("- 평가 단위 수: 0");
      expect(markdown).toContain("- 총 volume: 0");
      for (const difficulty of DIFFICULTIES) {
        expect(markdown).toContain(`| ${difficulty} | 0 |`);
      }
      for (const level of CONTRIBUTION_LEVELS) {
        expect(markdown).toContain(`| ${level} | 0 |`);
      }
    });

    it("단일 result → 해당 슬롯만 1·나머지 슬롯 0·totalVolume=그 volume 의 정확한 종단 markdown", () => {
      const markdown = renderViaChain([
        syntheticResult("github:github.com:single", "medium", "medium", 7),
      ]);
      expect(markdown).toContain("- 평가 단위 수: 1");
      expect(markdown).toContain("- 총 volume: 7");
      expect(markdown).toContain("| medium | 1 |");
      expect(markdown).toContain("| easy | 0 |");
      expect(markdown).toContain("| hard | 0 |");
      expect(markdown).toContain("| zero | 0 |");
      expect(markdown).toContain("| low | 0 |");
      expect(markdown).toContain("| high | 0 |");
    });

    it("모든 원소가 동일 difficulty/contribution(슬롯 집중) → 그 슬롯만 count·나머지 슬롯 0 의 종단 markdown", () => {
      const results = [
        syntheticResult("github:github.com:f1", "hard", "high", 2),
        syntheticResult("github:github.com:f2", "hard", "high", 3),
        syntheticResult("github:github.com:f3", "hard", "high", 5),
      ];

      const markdown = renderViaChain(results);

      expect(markdown).toContain("- 평가 단위 수: 3");
      expect(markdown).toContain("- 총 volume: 10");
      expect(markdown).toContain("| hard | 3 |");
      expect(markdown).toContain("| high | 3 |");
      expect(markdown).toContain("| easy | 0 |");
      expect(markdown).toContain("| medium | 0 |");
      expect(markdown).toContain("| zero | 0 |");
      expect(markdown).toContain("| low | 0 |");
      expect(markdown).toContain("| medium | 0 |");
    });
  });

  describe("negative / branch — raw narrative 누출 0 / 슬롯 순서 결정론 / totalVolume 정수 합 보간", () => {
    it("raw 본문/narrative 누출 0 — synthetic narrative 에 sentinel 문자열 주입해도 markdown 에 미등장(R-59/REQ-059, count/volume·슬롯 라벨·고정 표 골격만)", () => {
      const sentinel = "SENTINEL_RAW_NARRATIVE_LEAK_PROBE_T_0748";
      const r1 = syntheticResult("github:github.com:r1", "easy", "low", 1);
      const r2 = syntheticResult("github:github.com:r2", "medium", "high", 2);
      r1.narrative = `${sentinel} a`;
      r2.narrative = `${sentinel} b`;
      const markdown = renderViaChain([r1, r2]);

      expect(markdown).not.toContain(sentinel);
      expect(markdown).not.toContain("narrative");
      expect(markdown).not.toContain("github:github.com:r1");
    });

    it("슬롯 순서 결정론 — 입력 results 의 difficulty/contribution 등장 순서를 섞어도 markdown 표는 항상 single-source 순서로 렌더(DIFFICULTIES / CONTRIBUTION_LEVELS)", () => {
      // 입력 difficulty 등장 순서: hard → easy → medium (single-source 역순).
      // 입력 contribution 등장 순서: high → zero → low (single-source 역순).
      const markdown = renderViaChain([
        syntheticResult("github:github.com:o1", "hard", "high", 1),
        syntheticResult("github:github.com:o2", "easy", "zero", 2),
        syntheticResult("github:github.com:o3", "medium", "low", 3),
      ]);

      // difficulty 표 row 순서가 DIFFICULTIES(easy → medium → hard) 와 일치.
      const easyIdx = markdown.indexOf("| easy |");
      const mediumIdxDifficulty = markdown.indexOf("| medium |");
      const hardIdx = markdown.indexOf("| hard |");
      expect(easyIdx).toBeGreaterThan(-1);
      expect(mediumIdxDifficulty).toBeGreaterThan(easyIdx);
      expect(hardIdx).toBeGreaterThan(mediumIdxDifficulty);

      // contribution 표 row 순서 비교 — 'medium' 이 양 표에 등장하므로 contribution
      // section 헤더 이후로 slice 한 영역에서 슬롯 위치를 단언.
      const contribSection = markdown.slice(
        markdown.indexOf("### contribution 분포"),
      );
      const zeroIdx = contribSection.indexOf("| zero |");
      const lowIdx = contribSection.indexOf("| low |");
      const mediumIdxContrib = contribSection.indexOf("| medium |");
      const highIdx = contribSection.indexOf("| high |");
      expect(zeroIdx).toBeGreaterThan(-1);
      expect(lowIdx).toBeGreaterThan(zeroIdx);
      expect(mediumIdxContrib).toBeGreaterThan(lowIdx);
      expect(highIdx).toBeGreaterThan(mediumIdxContrib);
    });

    it("totalVolume 정수 합 보간 — 여러 volume(0 포함)이 합산돼 `- 총 volume` 토큰에 정확히 보간", () => {
      const results = [
        syntheticResult("github:github.com:v1", "easy", "low", 0),
        syntheticResult("github:github.com:v2", "easy", "low", 4),
        syntheticResult("github:github.com:v3", "medium", "high", 11),
        syntheticResult("github:github.com:v4", "hard", "zero", 7),
      ];

      const markdown = renderViaChain(results);

      // 0 + 4 + 11 + 7 = 22.
      expect(markdown).toContain("- 총 volume: 22");
      expect(markdown).toContain("- 평가 단위 수: 4");
    });
  });

  describe("결정론 · 무공유 — 동일 results 두 번 chain 호출 + 입력 불변", () => {
    it("동일 results 두 번 chain 호출 → markdown 문자열 toBe 동일(결정론, 입력만의 함수)", () => {
      const results = [
        syntheticResult("github:github.com:d1", "easy", "low", 3),
        syntheticResult("github:github.com:d2", "hard", "high", 6),
      ];
      expect(renderViaChain(results)).toBe(renderViaChain(results));
    });

    it("중간 summary 객체가 매 호출마다 새 참조(무공유 — buildRealDataResultSummary 반환 참조 비동일)", () => {
      const results = [
        syntheticResult("github:github.com:sh1", "medium", "low", 1),
      ];

      const summaryA = buildRealDataResultSummary(results);
      const summaryB = buildRealDataResultSummary(results);

      expect(summaryA).toEqual(summaryB);
      expect(summaryA).not.toBe(summaryB);
      expect(summaryA.byDifficulty).not.toBe(summaryB.byDifficulty);
      expect(summaryA.byContribution).not.toBe(summaryB.byContribution);
    });

    it("입력 results 배열·원소가 chain 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const results = [
        syntheticResult("github:github.com:n1", "easy", "low", 1),
        syntheticResult("github:github.com:n2", "medium", "high", 2),
      ];
      const resultsBefore = JSON.parse(JSON.stringify(results));

      renderViaChain(results);

      expect(results).toEqual(resultsBefore);
      expect(results.length).toBe(resultsBefore.length);
      for (let i = 0; i < results.length; i += 1) {
        expect(results[i]).toEqual(resultsBefore[i]);
      }
    });
  });
});

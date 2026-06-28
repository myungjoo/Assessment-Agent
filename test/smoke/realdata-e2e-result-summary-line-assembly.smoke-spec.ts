// realdata-e2e-result-summary-line-assembly.smoke-spec.ts — 실 평가 e2e
// result-summary→line 조립 체인 non-gated build-time smoke (T-0749, PLAN.md
// 109행 🟢 실 평가 e2e). step ③(평가)→step ④(결과 이슈 박제) 경계의 post-eval
// 결과 요약 **단일-라인** 렌더 leg 는 두 컴포저가 직렬로 닫는다 —
// buildRealDataResultSummary(T-0580/T-0706)가 EvaluationResult[] 를
// RealDataResultSummary 로 집계하고, formatRealDataResultSummaryLine(T-0642)가
// 그 descriptor 를 daily-test 이슈 title / rolling 이슈 상단 한 줄 / journal /
// CI step_eval stdout 용 결정론 한국어 단일 라인으로 렌더한다. T-0748
// (result-summary→markdown 본문 side)의 단일-라인 side 대칭 sibling. synthetic
// EvaluationResult literal 직접 주입으로 실 LLM / EvaluationScoringService.scoreUnit
// / Ollama / 실 github / 실 gh / 실 jest spawn / DB / 네트워크 0 복제. credential
// 0·process.env 읽기 0·gating 0(public CI 항상 green, R-113). 기존 컴포저 import
// 재사용만(consistency-guard 신설 금지, T-0726).
// Out of Scope: 실 LLM/평가/github/gh, markdown-본문 side(T-0748 cover),
// 컴포저·가드·helper·production src/ 수정, 기존 smoke 파일 수정.
import {
  CONTRIBUTION_LEVELS,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
import {
  RESULT_LINE_PREFIX,
  formatRealDataResultSummaryLine,
} from "../helpers/realdata-e2e-result-summary-line";

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

// renderViaChain — 본 smoke 의 종단 조립 진입. results→summary→line 한 호출.
function renderViaChain(results: EvaluationResult[]): string {
  const summary = buildRealDataResultSummary(results);
  return formatRealDataResultSummaryLine(summary);
}

describe("Smoke(non-gated): 실 평가 e2e result-summary→line 조립 체인(results→summary→line) live-LLM 0 검증", () => {
  describe("happy path — 종단 조립 line 산출", () => {
    it("다수 results(난이도/기여도/volume 다양) → line 이 고정 prefix·count=·volume=·난이도·기여도 골격을 모두 보유", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];

      const line = renderViaChain(results);

      expect(line).toContain(RESULT_LINE_PREFIX);
      expect(line).toContain(`count=${results.length}`);
      expect(line).toContain("· volume=10");
      expect(line).toContain("· 난이도(easy/medium/hard)=");
      expect(line).toContain("· 기여도(zero/low/medium/high)=");
    });

    it("다수 results 의 chain 산출 line 이 expected literal(슬롯 single-source 순서대로 슬래시-join 보간)과 byte-identical(toBe deep string)", () => {
      const results = [
        syntheticResult("github:github.com:e1", "easy", "low", 3),
        syntheticResult("github:github.com:e2", "medium", "high", 5),
        syntheticResult("github:github.com:e3", "hard", "medium", 2),
      ];

      // count=3 · volume=10 · 난이도 easy/medium/hard=1/1/1 ·
      // 기여도 zero/low/medium/high=0/1/1/1.
      const expected =
        "실 평가 e2e 결과: count=3" +
        " · volume=10" +
        " · 난이도(easy/medium/hard)=1/1/1" +
        " · 기여도(zero/low/medium/high)=0/1/1/1";

      expect(renderViaChain(results)).toBe(expected);
    });

    it("line 안의 difficulty/contribution 슬롯 값이 중간 summary.byDifficulty/byContribution 값과 동일하게 전파(재집계 없이 위임 산출만 thread)", () => {
      const results = [
        syntheticResult("github:github.com:p1", "easy", "low", 1),
        syntheticResult("github:github.com:p2", "easy", "high", 2),
        syntheticResult("github:github.com:p3", "hard", "medium", 4),
      ];
      const summary = buildRealDataResultSummary(results);
      const line = formatRealDataResultSummaryLine(summary);

      const difficultyValues = DIFFICULTIES.map(
        (difficulty) => summary.byDifficulty[difficulty],
      ).join("/");
      const contributionValues = CONTRIBUTION_LEVELS.map(
        (level) => summary.byContribution[level],
      ).join("/");
      expect(line).toContain(`· 난이도(easy/medium/hard)=${difficultyValues}`);
      expect(line).toContain(
        `· 기여도(zero/low/medium/high)=${contributionValues}`,
      );
    });
  });

  describe("단일 source 조립 단언 — 중간 summary 단일 source 전파, 재합성 없이 위임 산출만 옮김", () => {
    it("chain 산출 line 이 formatRealDataResultSummaryLine(buildRealDataResultSummary(results)) 와 toBe 동일(중간 summary 단일 source)", () => {
      const results = [
        syntheticResult("github:github.com:s1", "easy", "zero", 2),
        syntheticResult("github:github.com:s2", "hard", "high", 4),
      ];

      const viaChain = renderViaChain(results);
      const viaDirect = formatRealDataResultSummaryLine(
        buildRealDataResultSummary(results),
      );

      expect(viaChain).toBe(viaDirect);
    });

    it("line 의 `count=`·`· volume=` 토큰이 summary.count·summary.totalVolume 과 정합(집계↔렌더 토큰 정합)", () => {
      const results = [
        syntheticResult("github:github.com:t1", "medium", "low", 1),
        syntheticResult("github:github.com:t2", "medium", "medium", 6),
      ];
      const summary = buildRealDataResultSummary(results);
      const line = formatRealDataResultSummaryLine(summary);
      expect(line).toContain(`count=${summary.count}`);
      expect(line).toContain(`· volume=${summary.totalVolume}`);
    });
  });

  describe("flow / branch — 빈 / 단일 / 슬롯 집중 results 경로(분기별 분리)", () => {
    it("빈 results([]) → summary count 0·전 슬롯 0·totalVolume 0 → line 이 count=0·volume=0·난이도 0/0/0·기여도 0/0/0/0 골격 보유(빈-입력 종단 렌더)", () => {
      const line = renderViaChain([]);

      expect(line).toBe(
        "실 평가 e2e 결과: count=0" +
          " · volume=0" +
          " · 난이도(easy/medium/hard)=0/0/0" +
          " · 기여도(zero/low/medium/high)=0/0/0/0",
      );
    });

    it("단일 result → 해당 슬롯만 1·나머지 슬롯 0·totalVolume=그 volume 의 정확한 종단 line", () => {
      const line = renderViaChain([
        syntheticResult("github:github.com:single", "medium", "medium", 7),
      ]);
      expect(line).toBe(
        "실 평가 e2e 결과: count=1" +
          " · volume=7" +
          " · 난이도(easy/medium/hard)=0/1/0" +
          " · 기여도(zero/low/medium/high)=0/0/1/0",
      );
    });

    it("모든 원소가 동일 difficulty/contribution(슬롯 집중) → 그 슬롯만 count·나머지 슬롯 0 의 종단 line", () => {
      const results = [
        syntheticResult("github:github.com:f1", "hard", "high", 2),
        syntheticResult("github:github.com:f2", "hard", "high", 3),
        syntheticResult("github:github.com:f3", "hard", "high", 5),
      ];

      const line = renderViaChain(results);

      expect(line).toBe(
        "실 평가 e2e 결과: count=3" +
          " · volume=10" +
          " · 난이도(easy/medium/hard)=0/0/3" +
          " · 기여도(zero/low/medium/high)=0/0/0/3",
      );
    });
  });

  describe("negative / branch — raw narrative 누출 0 / 슬롯 순서 결정론 / totalVolume 정수 합 보간 / 개행 0", () => {
    it("raw 본문/narrative 누출 0 — synthetic narrative 에 sentinel 문자열 주입해도 line 에 미등장(R-59/REQ-059, count/volume·슬롯 라벨·고정 prefix 만)", () => {
      const sentinel = "SENTINEL_RAW_NARRATIVE_LEAK_PROBE_T_0749";
      const r1 = syntheticResult("github:github.com:r1", "easy", "low", 1);
      const r2 = syntheticResult("github:github.com:r2", "medium", "high", 2);
      r1.narrative = `${sentinel} a`;
      r2.narrative = `${sentinel} b`;
      const line = renderViaChain([r1, r2]);

      expect(line).not.toContain(sentinel);
      expect(line).not.toContain("narrative");
      expect(line).not.toContain("github:github.com:r1");
    });

    it("슬롯 순서 결정론 — 입력 results 의 difficulty/contribution 등장 순서를 섞어도 line 슬롯은 항상 single-source 순서로 렌더(easy→medium→hard·zero→low→medium→high)", () => {
      // 입력 difficulty 등장 순서: hard → easy → medium (single-source 역순).
      // 입력 contribution 등장 순서: high → zero → low (single-source 역순).
      const line = renderViaChain([
        syntheticResult("github:github.com:o1", "hard", "high", 1),
        syntheticResult("github:github.com:o2", "easy", "zero", 2),
        syntheticResult("github:github.com:o3", "medium", "low", 3),
      ]);

      // 난이도 슬롯 라벨이 single-source 고정 순서로 등장.
      expect(line).toContain("난이도(easy/medium/hard)=");
      // 각 입력이 1 건씩이므로 슬롯 값은 single-source 순서대로 1/1/1.
      expect(line).toContain("· 난이도(easy/medium/hard)=1/1/1");
      // 기여도: zero 1 · low 1 · medium 0 · high 1.
      expect(line).toContain("· 기여도(zero/low/medium/high)=1/1/0/1");
    });

    it("totalVolume 정수 합 보간 — 여러 volume(0 포함)이 합산돼 `· volume=` 토큰에 정확히 보간", () => {
      const results = [
        syntheticResult("github:github.com:v1", "easy", "low", 0),
        syntheticResult("github:github.com:v2", "easy", "low", 4),
        syntheticResult("github:github.com:v3", "medium", "high", 11),
        syntheticResult("github:github.com:v4", "hard", "zero", 7),
      ];

      const line = renderViaChain(results);

      // 0 + 4 + 11 + 7 = 22.
      expect(line).toContain("· volume=22");
      expect(line).toContain("count=4");
    });

    it("개행 0 — 산출 line 이 `\\n` 을 보유하지 않음(단일 라인 형태 정합)", () => {
      const line = renderViaChain([
        syntheticResult("github:github.com:nl1", "easy", "low", 1),
        syntheticResult("github:github.com:nl2", "hard", "high", 9),
      ]);
      expect(line).not.toContain("\n");
      expect(line.split("\n")).toHaveLength(1);
    });
  });

  describe("결정론 · 무공유 — 동일 results 두 번 chain 호출 + 입력 불변", () => {
    it("동일 results 두 번 chain 호출 → line 문자열 toBe 동일(결정론, 입력만의 함수)", () => {
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

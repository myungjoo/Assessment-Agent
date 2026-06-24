// realdata-e2e-result-summary-line.spec.ts — T-0642 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 모든 슬롯 양수인 descriptor 입력에 대해 출력 한 줄 문자열이 count·
//     volume·난이도 3 슬롯·기여도 4 슬롯 값을 정확히 담고 개행 0 임을 검증.
//   - flow/branch: ① 정상 분기 ② count=0(빈 batch) 분기 ③ 일부 슬롯 0(미등장 슬롯도
//     0 으로 등장) 분기 ④ 일부 슬롯 큰 수(자릿수 보존) 분기 각 1+ test 로 분기 격리.
//   - error/negative 충분 cover: null/undefined/byDifficulty 누락/byContribution
//     누락 각 한국어 TypeError / 입력 비변형 / 결정성 byte-identical / 전 슬롯 0 /
//     큰 수 / slot single-source 순서 보존 / 음수 자릿수 보존 각 1+ test. 단일
//     negative 만으로 부족 — 분기마다 cover.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical.
//   - 무공유/순수성: 호출 후 입력 summary·하위 분포 객체의 키/값 불변 검증.
//   - R-59: 출력 문자열에 narrative 류 raw 본문 부재(렌더 입력 자체에 부재).
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import {
  RESULT_LINE_PREFIX,
  formatRealDataResultSummaryLine,
} from "./realdata-e2e-result-summary-line";

// fixture 빌더 — 슬롯별 카운트를 명시적으로 받아 결정론적 descriptor 를 생성.
// 부분 입력만 받아 나머지 슬롯은 0 으로 채운다(미지정 슬롯도 키 존재 보장).
function makeSummary(opts: {
  count: number;
  byDifficulty: Partial<Record<Difficulty, number>>;
  byContribution: Partial<Record<ContributionLevel, number>>;
  totalVolume: number;
}): RealDataResultSummary {
  const byDifficulty = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTIES) {
    byDifficulty[d] = opts.byDifficulty[d] ?? 0;
  }
  const byContribution = {} as Record<ContributionLevel, number>;
  for (const c of CONTRIBUTION_LEVELS) {
    byContribution[c] = opts.byContribution[c] ?? 0;
  }
  return {
    count: opts.count,
    byDifficulty,
    byContribution,
    totalVolume: opts.totalVolume,
  };
}

describe("formatRealDataResultSummaryLine", () => {
  describe("happy-path", () => {
    it("모든 슬롯 양수 descriptor → count·volume·난이도·기여도 슬롯 값 한 줄 렌더", () => {
      const summary = makeSummary({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
        totalVolume: 42,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toBe(
        "실 평가 e2e 결과: count=5 · volume=42 · 난이도(easy/medium/hard)=2/2/1 · 기여도(zero/low/medium/high)=1/1/2/1",
      );
    });

    it("출력에 prefix·count·volume·슬롯 헤더가 모두 등장하고 개행 0", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 1 },
        totalVolume: 9,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line.startsWith(RESULT_LINE_PREFIX)).toBe(true);
      expect(line).toContain("count=3");
      expect(line).toContain("volume=9");
      expect(line).toContain("난이도(easy/medium/hard)=");
      expect(line).toContain("기여도(zero/low/medium/high)=");
      expect(line).not.toContain("\n");
    });
  });

  describe("error path — fail-fast 한국어 TypeError", () => {
    it("① null 입력 → 한국어 TypeError", () => {
      expect(() =>
        formatRealDataResultSummaryLine(
          null as unknown as RealDataResultSummary,
        ),
      ).toThrow(TypeError);
      expect(() =>
        formatRealDataResultSummaryLine(
          null as unknown as RealDataResultSummary,
        ),
      ).toThrow("summary 가 null 또는 undefined 입니다");
    });

    it("② undefined 입력 → 한국어 TypeError", () => {
      expect(() =>
        formatRealDataResultSummaryLine(
          undefined as unknown as RealDataResultSummary,
        ),
      ).toThrow(TypeError);
      expect(() =>
        formatRealDataResultSummaryLine(
          undefined as unknown as RealDataResultSummary,
        ),
      ).toThrow("summary 가 null 또는 undefined 입니다");
    });

    it("③ byDifficulty 누락 → 한국어 TypeError", () => {
      const broken = {
        count: 1,
        byContribution: { zero: 1, low: 0, medium: 0, high: 0 },
        totalVolume: 1,
      } as unknown as RealDataResultSummary;

      expect(() => formatRealDataResultSummaryLine(broken)).toThrow(TypeError);
      expect(() => formatRealDataResultSummaryLine(broken)).toThrow(
        "summary.byDifficulty 가 누락된 불완전 descriptor",
      );
    });

    it("④ byContribution 누락 → 한국어 TypeError", () => {
      const broken = {
        count: 1,
        byDifficulty: { easy: 1, medium: 0, hard: 0 },
        totalVolume: 1,
      } as unknown as RealDataResultSummary;

      expect(() => formatRealDataResultSummaryLine(broken)).toThrow(TypeError);
      expect(() => formatRealDataResultSummaryLine(broken)).toThrow(
        "summary.byContribution 가 누락된 불완전 descriptor",
      );
    });
  });

  describe("flow/branch", () => {
    it("① 정상 분기 — 혼합 분포", () => {
      const summary = makeSummary({
        count: 4,
        byDifficulty: { easy: 1, medium: 2, hard: 1 },
        byContribution: { zero: 0, low: 2, medium: 1, high: 1 },
        totalVolume: 20,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toBe(
        "실 평가 e2e 결과: count=4 · volume=20 · 난이도(easy/medium/hard)=1/2/1 · 기여도(zero/low/medium/high)=0/2/1/1",
      );
    });

    it("② count=0(빈 batch) 분기 — count=0·volume=0·전 슬롯 0 명시", () => {
      const summary = makeSummary({
        count: 0,
        byDifficulty: {},
        byContribution: {},
        totalVolume: 0,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toBe(
        "실 평가 e2e 결과: count=0 · volume=0 · 난이도(easy/medium/hard)=0/0/0 · 기여도(zero/low/medium/high)=0/0/0/0",
      );
    });

    it("③ 일부 슬롯 0 — 미등장 슬롯도 0 으로 등장(누락 0)", () => {
      const summary = makeSummary({
        count: 2,
        byDifficulty: { hard: 2 },
        byContribution: { high: 2 },
        totalVolume: 8,
      });

      const line = formatRealDataResultSummaryLine(summary);

      // easy/medium 미등장 → 0/0/2, zero/low/medium 미등장 → 0/0/0/2.
      expect(line).toBe(
        "실 평가 e2e 결과: count=2 · volume=8 · 난이도(easy/medium/hard)=0/0/2 · 기여도(zero/low/medium/high)=0/0/0/2",
      );
    });

    it("④ 일부 슬롯 큰 수 — 자릿수 보존", () => {
      const summary = makeSummary({
        count: 1_000_000,
        byDifficulty: { easy: 999_999, medium: 1, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 1_000_000 },
        totalVolume: 123_456_789,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toContain("count=1000000");
      expect(line).toContain("volume=123456789");
      expect(line).toContain("난이도(easy/medium/hard)=999999/1/0");
      expect(line).toContain("기여도(zero/low/medium/high)=0/0/0/1000000");
    });
  });

  describe("negative cases 충분 cover", () => {
    it("① 입력 비변형 — summary·byDifficulty·byContribution 객체 before/after deep-equal", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 1 },
        totalVolume: 11,
      });
      const before = JSON.parse(JSON.stringify(summary));

      formatRealDataResultSummaryLine(summary);

      expect(summary).toEqual(before);
    });

    it("② 결정성 — 동일 입력 2 회 호출 byte-identical", () => {
      const summary = makeSummary({
        count: 7,
        byDifficulty: { easy: 3, medium: 2, hard: 2 },
        byContribution: { zero: 1, low: 2, medium: 2, high: 2 },
        totalVolume: 55,
      });

      const first = formatRealDataResultSummaryLine(summary);
      const second = formatRealDataResultSummaryLine(summary);

      expect(first).toBe(second);
    });

    it("③ 모든 슬롯 0 입력 → 한 줄 자체는 생성(슬롯 값 모두 0 으로 등장)", () => {
      const summary = makeSummary({
        count: 0,
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 0 },
        totalVolume: 0,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toContain("난이도(easy/medium/hard)=0/0/0");
      expect(line).toContain("기여도(zero/low/medium/high)=0/0/0/0");
      expect(line).not.toContain("\n");
    });

    it("④ 큰 수(count=1_000_000_000) 입력 → 자릿수 보존·줄바꿈 0", () => {
      const summary = makeSummary({
        count: 1_000_000_000,
        byDifficulty: { easy: 1_000_000_000, medium: 0, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 1_000_000_000 },
        totalVolume: 1_000_000_000,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toContain("count=1000000000");
      expect(line).toContain("volume=1000000000");
      expect(line).not.toContain("\n");
    });

    it("⑤ slot single-source 순서 보존 — 난이도 easy/medium/hard·기여도 zero/low/medium/high 순서 고정", () => {
      const summary = makeSummary({
        count: 10,
        byDifficulty: { easy: 1, medium: 2, hard: 3 },
        byContribution: { zero: 1, low: 2, medium: 3, high: 4 },
        totalVolume: 0,
      });

      const line = formatRealDataResultSummaryLine(summary);

      // 슬롯 헤더가 import 한 single-source 배열 순서를 그대로 따름.
      expect(line).toContain(`난이도(${DIFFICULTIES.join("/")})=1/2/3`);
      expect(line).toContain(
        `기여도(${CONTRIBUTION_LEVELS.join("/")})=1/2/3/4`,
      );
      // 난이도 헤더가 기여도 헤더보다 앞에 등장.
      expect(line.indexOf("난이도(")).toBeLessThan(line.indexOf("기여도("));
    });

    it("⑥ slot 값 음수(혹시 들어오면) 자릿수 보존 — silent drop 금지", () => {
      const summary = makeSummary({
        count: -1,
        byDifficulty: { easy: -2, medium: 0, hard: 0 },
        byContribution: { zero: -3, low: 0, medium: 0, high: 0 },
        totalVolume: -5,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).toContain("count=-1");
      expect(line).toContain("volume=-5");
      expect(line).toContain("난이도(easy/medium/hard)=-2/0/0");
      expect(line).toContain("기여도(zero/low/medium/high)=-3/0/0/0");
    });
  });

  describe("R-59 raw 미저장 정합", () => {
    it("출력에 narrative 류 raw 본문 키 부재(입력 descriptor 자체에 부재)", () => {
      const summary = makeSummary({
        count: 2,
        byDifficulty: { easy: 1, medium: 1, hard: 0 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 0 },
        totalVolume: 4,
      });

      const line = formatRealDataResultSummaryLine(summary);

      expect(line).not.toContain("narrative");
    });
  });
});

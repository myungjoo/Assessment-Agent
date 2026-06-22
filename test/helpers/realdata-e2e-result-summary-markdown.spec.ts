// realdata-e2e-result-summary-markdown.spec.ts — T-0581 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: difficulty·contribution 이 다양하게 섞인 descriptor 입력에 대해
//     출력 문자열이 모든 슬롯·카운트·총 volume·count 헤더를 정확히 담음을 검증.
//   - flow/branch: count / totalVolume / 각 difficulty 슬롯(easy/medium/hard) /
//     각 contribution 슬롯(zero/low/medium/high) 분기마다 1+ test. 본 렌더러의 추가
//     분기는 슬롯 순회 외 없음(미등장 슬롯도 descriptor 에 0 으로 키 존재 — "키 부재"
//     분기는 발생하지 않음).
//   - error/negative 충분 cover: 빈 요약(전 슬롯 0 명시 렌더) / 단일 슬롯 집중(나머지
//     0 명시) / 큰 volume(1_000_000 정확 렌더) / 키 enumeration 역순 fixture(출력은
//     DIFFICULTIES·CONTRIBUTION_LEVELS 순서 고정) 각 1+ test. 단일 negative 만으로 부족.
//   - 결정론: 동일 입력 2 회 렌더 → byte-identical.
//   - 무공유/순수성: 렌더 후 입력 summary·하위 분포 객체의 키/값 불변 검증.
//   - R-59: 출력 문자열에 narrative 류 raw 본문 부재(렌더 입력 자체에 부재).
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";

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

describe("renderRealDataResultSummaryMarkdown", () => {
  // happy-path — difficulty/contribution 이 다양하게 섞인 fixture(easy 2 / medium 1 /
  // hard 0, zero 1 / low 1 / medium 1 / high 0, totalVolume 42, count 3).
  it("모든 슬롯·카운트·총 volume·count 헤더를 정확히 렌더링한다", () => {
    const summary = makeSummary({
      count: 3,
      byDifficulty: { easy: 2, medium: 1, hard: 0 },
      byContribution: { zero: 1, low: 1, medium: 1, high: 0 },
      totalVolume: 42,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    // count / totalVolume 헤더.
    expect(md).toContain("- 평가 단위 수: 3");
    expect(md).toContain("- 총 volume: 42");
    // difficulty 슬롯 행 — 미등장 hard 도 0 으로 명시.
    expect(md).toContain("| easy | 2 |");
    expect(md).toContain("| medium | 1 |");
    expect(md).toContain("| hard | 0 |");
    // contribution 슬롯 행 — 미등장 high 도 0 으로 명시.
    expect(md).toContain("| zero | 1 |");
    expect(md).toContain("| low | 1 |");
    expect(md).toContain("| medium | 1 |");
    expect(md).toContain("| high | 0 |");
    // 섹션 헤더 존재.
    expect(md).toContain("## 실 평가 e2e 결과 요약");
    expect(md).toContain("### difficulty 분포");
    expect(md).toContain("### contribution 분포");
  });

  // 슬롯 single source 고정 순서 — 출력 안에서 DIFFICULTIES / CONTRIBUTION_LEVELS
  // 순서대로 행이 등장함을 index 비교로 검증.
  it("difficulty 행은 DIFFICULTIES 순서, contribution 행은 CONTRIBUTION_LEVELS 순서로 렌더링한다", () => {
    const summary = makeSummary({
      count: 0,
      byDifficulty: {},
      byContribution: {},
      totalVolume: 0,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    expect(md.indexOf("| easy |")).toBeLessThan(md.indexOf("| medium | 0 |"));
    // difficulty medium 행(테이블 1)이 hard 행보다 앞.
    const hardIdx = md.indexOf("| hard |");
    expect(md.indexOf("| easy |")).toBeLessThan(hardIdx);

    expect(md.indexOf("| zero |")).toBeLessThan(md.indexOf("| low |"));
    expect(md.indexOf("| low |")).toBeLessThan(md.indexOf("| high |"));
  });

  // negative (d) — 입력 객체의 키 enumeration 순서를 의도적으로 역순으로 만든 fixture
  // 에서도 출력 슬롯 순서는 single-source 배열 순서를 따름.
  it("입력 객체의 키 enumeration 역순과 무관하게 single-source 순서로 렌더링한다", () => {
    // 키를 hard→medium→easy, high→medium→low→zero 역순으로 삽입.
    const byDifficulty = {} as Record<Difficulty, number>;
    byDifficulty.hard = 5;
    byDifficulty.medium = 3;
    byDifficulty.easy = 1;
    const byContribution = {} as Record<ContributionLevel, number>;
    byContribution.high = 4;
    byContribution.medium = 3;
    byContribution.low = 2;
    byContribution.zero = 1;
    const summary: RealDataResultSummary = {
      count: 9,
      byDifficulty,
      byContribution,
      totalVolume: 100,
    };

    const md = renderRealDataResultSummaryMarkdown(summary);

    // 출력에서 easy(1) 행이 hard(5) 행보다 먼저 등장.
    expect(md.indexOf("| easy | 1 |")).toBeLessThan(md.indexOf("| hard | 5 |"));
    expect(md.indexOf("| zero | 1 |")).toBeLessThan(md.indexOf("| high | 4 |"));
  });

  // 결정론 — 동일 입력 2 회 렌더 → byte-identical.
  it("동일 입력에 대해 byte-identical 한 출력을 반환한다", () => {
    const summary = makeSummary({
      count: 4,
      byDifficulty: { easy: 1, medium: 2, hard: 1 },
      byContribution: { zero: 0, low: 2, medium: 1, high: 1 },
      totalVolume: 77,
    });

    const a = renderRealDataResultSummaryMarkdown(summary);
    const b = renderRealDataResultSummaryMarkdown(summary);

    expect(a).toBe(b);
  });

  // negative (a) — 빈 요약(count 0, 모든 슬롯 0, totalVolume 0)에서도 슬롯 누락 없는
  // 0-only 렌더링.
  it("빈 요약(count 0)에서도 모든 슬롯을 0 으로 누락 없이 렌더링한다", () => {
    const summary = makeSummary({
      count: 0,
      byDifficulty: {},
      byContribution: {},
      totalVolume: 0,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    expect(md).toContain("- 평가 단위 수: 0");
    expect(md).toContain("- 총 volume: 0");
    for (const d of DIFFICULTIES) {
      expect(md).toContain(`| ${d} | 0 |`);
    }
    for (const c of CONTRIBUTION_LEVELS) {
      expect(md).toContain(`| ${c} | 0 |`);
    }
  });

  // negative (b) — 단일 슬롯 집중(모두 hard, 모두 high)에서 나머지 슬롯이 0 으로
  // 명시 렌더링됨.
  it("단일 슬롯 집중 시 나머지 difficulty/contribution 슬롯을 0 으로 명시 렌더링한다", () => {
    const summary = makeSummary({
      count: 6,
      byDifficulty: { hard: 6 },
      byContribution: { high: 6 },
      totalVolume: 12,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    expect(md).toContain("| hard | 6 |");
    expect(md).toContain("| easy | 0 |");
    expect(md).toContain("| medium | 0 |");
    expect(md).toContain("| high | 6 |");
    expect(md).toContain("| zero | 0 |");
    expect(md).toContain("| low | 0 |");
  });

  // negative (c) — 큰 volume 합산(1_000_000)의 정확한 수치 렌더링.
  it("큰 totalVolume(1_000_000)를 정확한 수치로 렌더링한다", () => {
    const summary = makeSummary({
      count: 1,
      byDifficulty: { medium: 1 },
      byContribution: { medium: 1 },
      totalVolume: 1_000_000,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    expect(md).toContain("- 총 volume: 1000000");
  });

  // 무공유/순수성 회귀 — 렌더 호출 후 입력 summary·하위 분포 객체의 키/값 불변.
  it("입력 summary 와 하위 분포 객체를 mutate 하지 않는다", () => {
    const summary = makeSummary({
      count: 2,
      byDifficulty: { easy: 1, hard: 1 },
      byContribution: { low: 2 },
      totalVolume: 9,
    });
    const beforeDifficulty = { ...summary.byDifficulty };
    const beforeContribution = { ...summary.byContribution };
    const beforeCount = summary.count;
    const beforeVolume = summary.totalVolume;

    renderRealDataResultSummaryMarkdown(summary);

    expect(summary.byDifficulty).toEqual(beforeDifficulty);
    expect(summary.byContribution).toEqual(beforeContribution);
    expect(summary.count).toBe(beforeCount);
    expect(summary.totalVolume).toBe(beforeVolume);
  });

  // R-59 — 출력에 narrative 류 raw 본문 부재(렌더 입력 자체에 부재). descriptor 가
  // 카운트·합산만 보유하므로 raw 본문이 이슈로 새지 않음을 표상.
  it("출력에 narrative 류 raw 본문 키가 등장하지 않는다", () => {
    const summary = makeSummary({
      count: 1,
      byDifficulty: { easy: 1 },
      byContribution: { zero: 1 },
      totalVolume: 3,
    });

    const md = renderRealDataResultSummaryMarkdown(summary);

    expect(md).not.toContain("narrative");
    expect(md).not.toContain("unitId");
  });
});

// realdata-e2e-result-issue-descriptor.spec.ts — T-0582 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 summary(difficulty/contribution 섞임, totalVolume>0) + 정상 run
//     에 대해 title(prefix+token) / marker(안정 토큰) / body(marker 라인 + 렌더 본문)가
//     정확히 산출됨을 검증.
//   - error/negative 충분 cover: (a) 빈 gitSha throw, (b) 공백-only gitSha throw,
//     (c) 빈 dateToken throw, (d) 공백-only dateToken throw — 각 별도 case(필드별·빈/
//     공백별 분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(gitSha 빈/공백, dateToken 빈/공백) + 정상 경로 각 1+.
//     body 에 marker 라인이 정확히 1 회 포함됨(중복·누락 0) 검증.
//   - 멱등 marker 안정성: 동일 run(동일 gitSha+dateToken)이면 summary 가 달라도 marker
//     동일, 서로 다른 run 은 서로 다른 marker.
//   - 결정론: 동일 (summary, run) 2 회 호출 → byte-identical descriptor.
//   - 무공유/순수성: 빌드 후 입력 summary / run 의 키·값 불변.
//   - R-59: descriptor 가 narrative 류 raw 본문 키를 담지 않음(렌더 입력 자체에 부재).
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import {
  buildRealDataResultIssueDescriptor,
  type RealDataResultIssueRunRef,
} from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// fixture 빌더 — 슬롯별 카운트를 명시적으로 받아 결정론적 summary descriptor 를 생성.
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

const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

describe("buildRealDataResultIssueDescriptor", () => {
  // happy-path — 정상 summary(섞임, totalVolume>0) + 정상 run.
  it("정상 입력에 대해 title / marker / body 를 정확히 산출한다", () => {
    const summary = makeSummary({
      count: 3,
      byDifficulty: { easy: 2, medium: 1 },
      byContribution: { low: 1, medium: 1, high: 1 },
      totalVolume: 42,
    });

    const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    // title — 고정 prefix + run token(dateToken@gitSha) 포함.
    expect(descriptor.title).toBe("실 평가 e2e 결과 2026-06-23@abc1234");
    // marker — 안정 식별 토큰(run token 포함).
    expect(descriptor.marker).toContain("2026-06-23@abc1234");
    expect(descriptor.marker).toMatch(/^<!--/);
    expect(descriptor.marker).toMatch(/-->$/);
    // body — marker 라인으로 시작 + 렌더 본문(T-0581) 포함.
    expect(descriptor.body.startsWith(descriptor.marker)).toBe(true);
    expect(descriptor.body).toContain("## 실 평가 e2e 결과 요약");
    expect(descriptor.body).toContain("- 평가 단위 수: 3");
    expect(descriptor.body).toContain("- 총 volume: 42");
    expect(descriptor.body).toContain("| easy | 2 |");
  });

  // flow/branch — body 에 marker 라인이 정확히 1 회만 포함(중복·누락 0).
  it("body 에 marker 라인을 정확히 1 회만 포함한다", () => {
    const summary = makeSummary({
      count: 1,
      byDifficulty: { hard: 1 },
      byContribution: { zero: 1 },
      totalVolume: 5,
    });

    const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    const occurrences = descriptor.body.split(descriptor.marker).length - 1;
    expect(occurrences).toBe(1);
  });

  // 멱등 marker 안정성 — 동일 run 이면 summary 가 달라도 marker 동일.
  it("동일 run 이면 summary 가 달라도 marker / title 이 동일하다", () => {
    const summaryA = makeSummary({
      count: 1,
      byDifficulty: { easy: 1 },
      byContribution: { low: 1 },
      totalVolume: 10,
    });
    const summaryB = makeSummary({
      count: 99,
      byDifficulty: { hard: 99 },
      byContribution: { high: 99 },
      totalVolume: 9999,
    });

    const a = buildRealDataResultIssueDescriptor(summaryA, HAPPY_RUN);
    const b = buildRealDataResultIssueDescriptor(summaryB, HAPPY_RUN);

    expect(a.marker).toBe(b.marker);
    expect(a.title).toBe(b.title);
    // 본문은 summary 가 다르므로 달라야 한다(멱등은 marker/title 식별자에 한함).
    expect(a.body).not.toBe(b.body);
  });

  // 멱등 marker 안정성 — 서로 다른 run 은 서로 다른 marker.
  it("서로 다른 run(gitSha 또는 dateToken 상이)은 서로 다른 marker 를 산출한다", () => {
    const summary = makeSummary({
      count: 1,
      byDifficulty: { easy: 1 },
      byContribution: { low: 1 },
      totalVolume: 10,
    });

    const base = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
    const otherSha = buildRealDataResultIssueDescriptor(summary, {
      gitSha: "def5678",
      dateToken: "2026-06-23",
    });
    const otherDate = buildRealDataResultIssueDescriptor(summary, {
      gitSha: "abc1234",
      dateToken: "2026-06-24",
    });

    expect(base.marker).not.toBe(otherSha.marker);
    expect(base.marker).not.toBe(otherDate.marker);
    expect(base.title).not.toBe(otherSha.title);
    expect(base.title).not.toBe(otherDate.title);
  });

  // 결정론 — 동일 (summary, run) 2 회 호출 → byte-identical descriptor.
  it("동일 입력에 대해 byte-identical 한 descriptor 를 반환한다", () => {
    const summary = makeSummary({
      count: 4,
      byDifficulty: { easy: 1, medium: 2, hard: 1 },
      byContribution: { low: 2, medium: 1, high: 1 },
      totalVolume: 77,
    });

    const a = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
    const b = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    expect(a.title).toBe(b.title);
    expect(a.marker).toBe(b.marker);
    expect(a.body).toBe(b.body);
  });

  const baseSummary = makeSummary({
    count: 1,
    byDifficulty: { easy: 1 },
    byContribution: { low: 1 },
    totalVolume: 1,
  });

  // negative (a) — 빈 gitSha throw.
  it("빈 gitSha 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueDescriptor(baseSummary, {
        gitSha: "",
        dateToken: "2026-06-23",
      }),
    ).toThrow(/gitSha/);
  });

  // negative (b) — 공백-only gitSha throw.
  it("공백-only gitSha 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueDescriptor(baseSummary, {
        gitSha: "   ",
        dateToken: "2026-06-23",
      }),
    ).toThrow(/gitSha/);
  });

  // negative (c) — 빈 dateToken throw.
  it("빈 dateToken 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueDescriptor(baseSummary, {
        gitSha: "abc1234",
        dateToken: "",
      }),
    ).toThrow(/dateToken/);
  });

  // negative (d) — 공백-only dateToken throw.
  it("공백-only dateToken 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueDescriptor(baseSummary, {
        gitSha: "abc1234",
        dateToken: "\t \n",
      }),
    ).toThrow(/dateToken/);
  });

  // 무공유/순수성 회귀 — 빌드 후 입력 summary / run 의 키·값 불변.
  it("입력 summary 와 run 객체를 mutate 하지 않는다", () => {
    const summary = makeSummary({
      count: 2,
      byDifficulty: { easy: 1, hard: 1 },
      byContribution: { low: 2 },
      totalVolume: 9,
    });
    const run: RealDataResultIssueRunRef = {
      gitSha: "abc1234",
      dateToken: "2026-06-23",
    };
    const beforeDifficulty = { ...summary.byDifficulty };
    const beforeContribution = { ...summary.byContribution };
    const beforeRun = { ...run };

    buildRealDataResultIssueDescriptor(summary, run);

    expect(summary.byDifficulty).toEqual(beforeDifficulty);
    expect(summary.byContribution).toEqual(beforeContribution);
    expect(summary.count).toBe(2);
    expect(summary.totalVolume).toBe(9);
    expect(run).toEqual(beforeRun);
  });

  // R-59 — descriptor 에 narrative 류 raw 본문 키 부재(렌더 입력 자체에 부재).
  it("descriptor 에 narrative 류 raw 본문 키가 등장하지 않는다", () => {
    const summary = makeSummary({
      count: 1,
      byDifficulty: { easy: 1 },
      byContribution: { zero: 1 },
      totalVolume: 3,
    });

    const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    expect(descriptor.body).not.toContain("narrative");
    expect(descriptor.body).not.toContain("unitId");
  });
});

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
import * as bodyConsistencyModule from "./realdata-e2e-result-issue-descriptor-body-consistency";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "./realdata-e2e-result-summary-line";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";

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

  // T-0645 — body 합성에 formatRealDataResultSummaryLine 한 줄이 marker 와 markdown
  // 본문 사이에 정확히 포함된다(가공 0 합성).
  describe("body 에 한 줄 요약(formatRealDataResultSummaryLine) 배선", () => {
    // happy-path — 정상 summary(섞임, totalVolume>0) → 한 줄 요약 포함.
    it("정상 summary 의 body 가 marker 와 markdown 사이에 한 줄 요약을 포함한다", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 2, medium: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 42,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);

      expect(descriptor.body).toContain(expectedLine);
      // marker 직후 빈 줄 1개 + 한 줄 요약 + 빈 줄 1개 + markdown 본문.
      expect(descriptor.body).toContain(
        `${descriptor.marker}\n\n${expectedLine}\n\n`,
      );
    });

    // count=0 빈 summary 도 정상 body 합성 분기.
    it("count=0·volume=0·슬롯 모두 0 인 빈 summary 도 한 줄 요약이 body 에 포함된다", () => {
      const summary = makeSummary({
        count: 0,
        byDifficulty: {},
        byContribution: {},
        totalVolume: 0,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);

      expect(descriptor.body).toContain(expectedLine);
      // 한 줄 요약에 count=0·volume=0·전 슬롯 0 이 명시적으로 등장.
      expect(expectedLine).toContain("count=0");
      expect(expectedLine).toContain("volume=0");
      expect(expectedLine).toContain("0/0/0");
      expect(expectedLine).toContain("0/0/0/0");
    });

    // 큰 수·다양한 분포 summary 분기.
    it("큰 수·다양한 분포 summary 에 대해 한 줄 요약이 body 에 포함된다", () => {
      const summary = makeSummary({
        count: 999,
        byDifficulty: { easy: 333, medium: 333, hard: 333 },
        byContribution: { zero: 100, low: 200, medium: 300, high: 399 },
        totalVolume: 123456,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);

      expect(descriptor.body).toContain(expectedLine);
      expect(expectedLine).toContain("count=999");
      expect(expectedLine).toContain("volume=123456");
    });

    // negative ① — 한 줄 요약이 정확히 1 회 등장(중복·누락 0).
    it("body 에 한 줄 요약이 정확히 1 회만 등장한다", () => {
      const summary = makeSummary({
        count: 2,
        byDifficulty: { easy: 1, medium: 1 },
        byContribution: { low: 1, medium: 1 },
        totalVolume: 7,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);

      const occurrences = descriptor.body.split(expectedLine).length - 1;
      expect(occurrences).toBe(1);
    });

    // negative ② — body 의 한 줄 요약 부분이 formatter 산출과 byte-identical
    // (가공 0 합성 증명).
    it("body 내 한 줄 요약이 formatRealDataResultSummaryLine 산출과 byte-identical 하다", () => {
      const summary = makeSummary({
        count: 4,
        byDifficulty: { easy: 1, medium: 2, hard: 1 },
        byContribution: { low: 2, medium: 1, high: 1 },
        totalVolume: 77,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);

      // body 의 라인 배열에서 한 줄 요약과 정확히 같은 라인이 1 개 존재.
      const lines = descriptor.body.split("\n");
      const matches = lines.filter((line) => line === expectedLine);
      expect(matches).toHaveLength(1);
    });

    // negative ③ — body 라인 구조: [marker, "", line, "", ...markdown lines].
    it("body 첫 4 라인이 marker / 빈 줄 / 한 줄 요약 / 빈 줄 순서로 합성된다", () => {
      const summary = makeSummary({
        count: 1,
        byDifficulty: { hard: 1 },
        byContribution: { high: 1 },
        totalVolume: 11,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);
      const lines = descriptor.body.split("\n");

      expect(lines[0]).toBe(descriptor.marker);
      expect(lines[1]).toBe("");
      expect(lines[2]).toBe(expectedLine);
      expect(lines[3]).toBe("");
      // markdown 본문이 한 줄 요약 뒤에 위치(첫 markdown 헤더가 5번째 라인 이후).
      expect(descriptor.body).toContain(
        `${expectedLine}\n\n## 실 평가 e2e 결과 요약`,
      );
    });

    // negative ④ — 결정성: 동일 (summary, run) 2 회 호출 → body 동일.
    it("동일 입력에 대해 한 줄 요약 포함 body 가 byte-identical 하다", () => {
      const summary = makeSummary({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
        totalVolume: 33,
      });

      const a = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const b = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

      expect(a.body).toBe(b.body);
    });

    // negative ⑤ — title·marker 회귀 0: 한 줄 요약 추가가 title/marker byte 를 바꾸지
    // 않음(byte-identical 보존).
    it("한 줄 요약 추가가 title·marker byte 를 바꾸지 않는다(회귀 0)", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 2, medium: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 42,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

      // title — 본 task 전과 byte-identical.
      expect(descriptor.title).toBe("실 평가 e2e 결과 2026-06-23@abc1234");
      // marker — 본 task 전과 byte-identical.
      expect(descriptor.marker).toBe(
        "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->",
      );
    });

    // negative ⑥ — 입력 비변형: 한 줄 요약 합성 후에도 summary·byDifficulty·
    // byContribution·run 객체 변경 0.
    it("한 줄 요약 합성 후에도 입력 summary 와 run 을 mutate 하지 않는다", () => {
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

    // R-59 — body 는 한 줄 요약·markdown 모두 카운트·분포만(narrative/raw 본문 0).
    it("한 줄 요약 추가 후에도 body 가 narrative 류 raw 본문 키를 담지 않는다", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 15,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

      expect(descriptor.body).not.toContain("narrative");
      expect(descriptor.body).not.toContain("unitId");
      expect(descriptor.body).not.toContain("rawActivity");
    });

    // guard 분기 — gitSha 빈 → throw(한 줄 요약 합성 도달 전).
    it("gitSha guard 가 한 줄 요약 합성 전 단계에서 throw 한다", () => {
      const summary = makeSummary({
        count: 1,
        byDifficulty: { easy: 1 },
        byContribution: { low: 1 },
        totalVolume: 1,
      });

      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: "",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha/);
    });

    // guard 분기 — dateToken 공백-only → throw(한 줄 요약 합성 도달 전).
    it("dateToken guard 가 한 줄 요약 합성 전 단계에서 throw 한다", () => {
      const summary = makeSummary({
        count: 1,
        byDifficulty: { easy: 1 },
        byContribution: { low: 1 },
        totalVolume: 1,
      });

      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken/);
    });
  });

  // T-0647 — buildRealDataResultIssueDescriptor 가 반환 직전 자기 산출 descriptor 의
  // body 3 블록 구조 무결성을 assertRealDataResultIssueDescriptorBodyConsistent 로
  // self-assert 하도록 배선됐음을 검증한다(T-0644 formatter self-guard 의 descriptor-
  // side mirror). 정상 입력이면 가드는 void 반환 → 동작·반환값 byte-identical 보존.
  // builder 는 항상 정상 body 를 합성하므로 self-guard throw 분기는 builder 입력으로
  // 직접 유발 불가 — 본 describe 는 (a) self-wire 가 실제 호출 경로에 배선됐음 + (b)
  // self-wire 가 builder 동작(title/marker/body byte-identical)을 깨지 않음에 집중.
  describe("body-consistency self-guard self-wire 배선 (T-0647)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // negative ① — self-wire 배선 검증: 가드가 builder 산출 경로에 실제 배선됐음을
    // spyOn 으로 감시(정확히 1 회·(descriptor, summary) 인자로 호출).
    it("정상 입력에서 가드를 정확히 1 회 (descriptor, summary) 인자로 호출한다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 2, medium: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 42,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      // 가드는 (합성된 descriptor, 입력 summary) 로 호출된다.
      expect(spy).toHaveBeenCalledWith(
        {
          title: descriptor.title,
          marker: descriptor.marker,
          body: descriptor.body,
        },
        summary,
      );
    });

    // happy-path — 정상 summary(섞임, totalVolume>0) → self-guard 통과해 정상 descriptor
    // 반환(throw 0).
    it("정상 summary + 정상 run 에서 self-guard 통과해 정상 descriptor 를 반환한다(throw 0)", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 2, medium: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 42,
      });

      expect(() =>
        buildRealDataResultIssueDescriptor(summary, HAPPY_RUN),
      ).not.toThrow();
    });

    // happy-path 분기 — count=0·volume=0·전 슬롯 0 빈 summary 도 self-guard 통과.
    it("count=0·volume=0 빈 summary 도 self-guard 통과해 정상 descriptor 를 반환한다", () => {
      const summary = makeSummary({
        count: 0,
        byDifficulty: {},
        byContribution: {},
        totalVolume: 0,
      });

      expect(() =>
        buildRealDataResultIssueDescriptor(summary, HAPPY_RUN),
      ).not.toThrow();
    });

    // branch — 큰 수·다양한 분포 summary 도 self-guard 통과.
    it("큰 수·다양한 분포 summary 도 self-guard 통과해 정상 descriptor 를 반환한다", () => {
      const summary = makeSummary({
        count: 999,
        byDifficulty: { easy: 333, medium: 333, hard: 333 },
        byContribution: { zero: 100, low: 200, medium: 300, high: 399 },
        totalVolume: 123456,
      });

      expect(() =>
        buildRealDataResultIssueDescriptor(summary, HAPPY_RUN),
      ).not.toThrow();
    });

    // error 분기 ① — 빈/공백 gitSha 는 body 합성·self-guard 도달 전 식별자 guard 에서
    // throw(self-wire 가 기존 식별자 guard 우선순위를 깨지 않음).
    it("빈 gitSha 는 self-guard 도달 전 식별자 guard 에서 throw 하고 가드를 호출하지 않는다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );

      expect(() =>
        buildRealDataResultIssueDescriptor(baseSummary, {
          gitSha: "",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha/);
      // 식별자 guard 가 먼저 throw → body-consistency 가드 미도달.
      expect(spy).not.toHaveBeenCalled();
    });

    // error 분기 ② — 공백-only dateToken 도 식별자 guard 에서 throw.
    it("공백-only dateToken 은 self-guard 도달 전 식별자 guard 에서 throw 한다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );

      expect(() =>
        buildRealDataResultIssueDescriptor(baseSummary, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken/);
      expect(spy).not.toHaveBeenCalled();
    });

    // negative ② — 결정성: 동일 (summary, run) 2 회 호출 → 둘 다 동일 descriptor
    // (self-wire 후에도 결정성 보존).
    it("self-wire 후에도 동일 입력에 대해 byte-identical descriptor 를 반환한다", () => {
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

    // negative ③ — 입력 비변형: 호출 후 summary·byDifficulty·byContribution·run 객체
    // 변경 0(self-wire 가 입력을 mutate 하지 않음).
    it("self-wire 후에도 입력 summary 와 run 을 mutate 하지 않는다", () => {
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

    // negative ④ — byte-identical 회귀 0: self-wire 추가가 title/marker/body byte 를
    // 바꾸지 않음(정상 입력).
    it("self-wire 추가가 title·marker·body byte 를 바꾸지 않는다(회귀 0)", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 2, medium: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 42,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);
      const expectedMarkdown = renderRealDataResultSummaryMarkdown(summary);

      expect(descriptor.title).toBe("실 평가 e2e 결과 2026-06-23@abc1234");
      expect(descriptor.marker).toBe(
        "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->",
      );
      // body 도 self-wire 전 합성 규칙(marker / "" / line / "" / markdown)과 동일.
      expect(descriptor.body).toBe(
        [descriptor.marker, "", expectedLine, "", expectedMarkdown].join("\n"),
      );
    });

    // negative ⑤ — body 구조 보존: 첫 라인 = marker, 한 줄 요약 정확히 1 회, markdown
    // 본문이 한 줄 요약 뒤에 위치(self-guard 가 통과시키는 정상 구조 재확인).
    it("self-wire 통과 body 가 marker → 한 줄 요약(1 회) → markdown 구조를 유지한다", () => {
      const summary = makeSummary({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
        totalVolume: 33,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
      const expectedLine = formatRealDataResultSummaryLine(summary);
      const lines = descriptor.body.split("\n");

      // 첫 라인 = marker.
      expect(lines[0]).toBe(descriptor.marker);
      // 한 줄 요약이 정확히 1 회 등장.
      const occurrences = lines.filter((line) => line === expectedLine).length;
      expect(occurrences).toBe(1);
      // markdown 본문이 한 줄 요약 뒤에 위치.
      expect(descriptor.body).toContain(
        `${expectedLine}\n\n## 실 평가 e2e 결과 요약`,
      );
    });

    // negative ⑥ — R-59: body 가 raw narrative 키/본문을 담지 않음.
    it("self-wire 후에도 body 가 narrative 류 raw 본문 키를 담지 않는다(R-59)", () => {
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { low: 1, medium: 1, high: 1 },
        totalVolume: 15,
      });

      const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

      expect(descriptor.body).not.toContain("narrative");
      expect(descriptor.body).not.toContain("unitId");
      expect(descriptor.body).not.toContain("rawActivity");
    });
  });
});

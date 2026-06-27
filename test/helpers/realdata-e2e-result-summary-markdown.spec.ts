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
// self-wire(T-0714) 검증용 namespace import — 컴포저가 top-level import 로 같은 모듈을
// 로드하므로 CommonJS 모듈 캐시 객체와 본 namespace 가 동일 참조라 spyOn 이 컴포저의
// 가드 호출을 가로챈다(가드는 컴포저 모듈을 import 하지 않아 top-level 순환 의존 0).
import * as markdownConsistencyModule from "./realdata-e2e-result-summary-markdown-consistency";

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

  // ── self-wire(T-0714) — 값-정합 가드 단일 return 배선 ─────────────────────
  // 컴포저가 단일 return 직전 값-정합 가드
  // assertRealDataResultSummaryMarkdownConsistentWithSummary 를 self-assert 하는지 검증한다.
  // 컴포저는 top-level import 로 가드 모듈을 로드하고 본 spec 은 namespace import 하므로
  // 동일 CommonJS 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다
  // (가드는 컴포저 모듈을 import 하지 않아 순환 의존 0, T-0712 lazy require 불요).
  describe("self-wire(T-0714) — 값-정합 가드 단일 return 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // ① happy — 정상 입력에서 값-정합 가드를 throw 0 으로 통과해 반환 마크다운이
    //   self-wire 전과 byte-identical(기존 happy-path test 의 expected 와 정확히 일치).
    it("① 정상 입력에서 값-정합 가드를 throw 0 으로 통과해 반환물이 self-wire 전과 byte-identical 하다(happy)", () => {
      const summary = makeSummary({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
        totalVolume: 42,
      });

      const md = renderRealDataResultSummaryMarkdown(summary);

      // self-wire 전 합성 규칙(헤더 + count + volume + difficulty 표 + contribution 표)
      // 의 byte-identical 재구성과 일치(컴포저 출력 자체가 single source).
      const expected = [
        "## 실 평가 e2e 결과 요약",
        "",
        "- 평가 단위 수: 5",
        "- 총 volume: 42",
        "",
        "### difficulty 분포",
        "",
        "| difficulty | count |",
        "| --- | --- |",
        "| easy | 2 |",
        "| medium | 2 |",
        "| hard | 1 |",
        "",
        "### contribution 분포",
        "",
        "| contribution | count |",
        "| --- | --- |",
        "| zero | 1 |",
        "| low | 1 |",
        "| medium | 2 |",
        "| high | 1 |",
      ].join("\n");
      expect(md).toBe(expected);
    });

    // ② 빈 batch happy — count=0·전 슬롯 0 에서도 self-assert 통과·정상 반환.
    it("② 빈 batch(count=0·전 슬롯 0)도 값-정합 가드 통과·정상 마크다운 반환(throw 0, 경계 입력)", () => {
      const summary = makeSummary({
        count: 0,
        byDifficulty: {},
        byContribution: {},
        totalVolume: 0,
      });

      expect(() => renderRealDataResultSummaryMarkdown(summary)).not.toThrow();
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

    // ③ 호출 배선 검증(self-wire 발동 증명) — 정확히 1 회·(markdown, summary) 인자 호출.
    //   미배선 회귀(import 만 추가하고 호출 누락) 시 호출수 0 으로 fail.
    it("③ 값-정합 가드 호출 배선 — 정확히 1 회·합성 마크다운과 입력 summary 동일 인자로 호출(self-wire 발동 증명)", () => {
      const spy = jest.spyOn(
        markdownConsistencyModule,
        "assertRealDataResultSummaryMarkdownConsistentWithSummary",
      );
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 1 },
        totalVolume: 9,
      });

      const md = renderRealDataResultSummaryMarkdown(summary);

      expect(spy).toHaveBeenCalledTimes(1);
      // 반환 마크다운과 동일 문자열·입력 summary 동일 참조를 인자로 받아야 한다(반환 직전 단언).
      expect(spy).toHaveBeenCalledWith(md, summary);
      expect(spy.mock.calls[0][0]).toBe(md);
      expect(spy.mock.calls[0][1]).toBe(summary);
    });

    // ④ 값 가드 RangeError throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파
    //   (silent 통과 0, negative ①).
    it("④ 값 가드 RangeError throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(silent 통과 0, negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          markdownConsistencyModule,
          "assertRealDataResultSummaryMarkdownConsistentWithSummary",
        )
        .mockImplementation(() => {
          throw sentinel;
        });
      const summary = makeSummary({
        count: 3,
        byDifficulty: { easy: 1, medium: 1, hard: 1 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 1 },
        totalVolume: 9,
      });

      expect(() => renderRealDataResultSummaryMarkdown(summary)).toThrow(
        sentinel,
      );
    });

    // ⑤ 값 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류
    //   무관 전파, negative ②).
    it("⑤ 값 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          markdownConsistencyModule,
          "assertRealDataResultSummaryMarkdownConsistentWithSummary",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });
      const summary = makeSummary({
        count: 2,
        byDifficulty: { easy: 1, medium: 1, hard: 0 },
        byContribution: { zero: 0, low: 1, medium: 1, high: 0 },
        totalVolume: 4,
      });

      expect(() => renderRealDataResultSummaryMarkdown(summary)).toThrow(
        "구조 결손 모사",
      );
    });

    // ⑥ 형태/구조 가드 선throw 시 값-정합 가드 미호출(분기 순서 보장, negative ③).
    //   컴포저는 가드 호출 전에 슬롯 순회(`DIFFICULTIES.map`)를 수행하므로 byDifficulty
    //   가 undefined 인 손상 입력에서는 슬롯 순회 단계에서 TypeError 가 먼저 발생해 값
    //   가드 도달 전에 throw 전파된다(slot iteration 이 형태 결손에 대한 first-throw guard
    //   역할). 값-정합 가드 spy 호출수 0 으로 분기 순서 박제.
    it("⑥ 형태/구조 결손 입력(byDifficulty 누락)은 슬롯 순회 단계에서 선throw — 값-정합 가드는 미호출(분기 순서 보장, negative)", () => {
      const valueSpy = jest.spyOn(
        markdownConsistencyModule,
        "assertRealDataResultSummaryMarkdownConsistentWithSummary",
      );
      const broken = {
        count: 1,
        byContribution: { zero: 0, low: 0, medium: 0, high: 1 },
        totalVolume: 1,
        // byDifficulty 누락 → DIFFICULTIES.map 의 summary.byDifficulty[d] 접근에서 TypeError.
      } as unknown as RealDataResultSummary;

      expect(() => renderRealDataResultSummaryMarkdown(broken)).toThrow(
        TypeError,
      );
      // 슬롯 순회 단계에서 먼저 throw 하므로 값-정합 가드는 호출되지 않는다(선throw 시 후속 미호출).
      expect(valueSpy).not.toHaveBeenCalled();
    });

    // ⑦ self-wire 후에도 동일 입력에 대해 byte-identical 마크다운 반환(결정성 보존).
    it("⑦ self-wire 후에도 동일 입력에 대해 byte-identical 마크다운 반환(결정성 보존)", () => {
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

    // ⑧ self-wire 후에도 입력 summary·하위 분포 객체 mutate 0(비변형 보존).
    it("⑧ self-wire 후에도 입력 summary 와 하위 분포 객체를 mutate 하지 않는다(비변형 보존)", () => {
      const summary = makeSummary({
        count: 2,
        byDifficulty: { easy: 1, hard: 1 },
        byContribution: { low: 2 },
        totalVolume: 9,
      });
      const snapshot = JSON.stringify(summary);

      renderRealDataResultSummaryMarkdown(summary);

      expect(JSON.stringify(summary)).toBe(snapshot);
    });
  });
});

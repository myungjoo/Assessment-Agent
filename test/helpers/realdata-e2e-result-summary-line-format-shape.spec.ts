// realdata-e2e-result-summary-line-format-shape.spec — T-0643 실 평가 e2e 결과 요약
// "한 줄 요약" 라인 형태 불변식 가드 단위 테스트. R-112(기능 + 예외 + flow 3종 +
// negative 충분 cover) 강제. 각 위반 분기(①~⑥ + 빈 라인 위장)를 정확히 1개씩 격리
// trigger 하고, 정상 결과 라인은 변형·차단 없이 통과(void)함을 검증한다. happy-path
// 는 실 `formatRealDataResultSummaryLine` 산출을 그대로 통과시키는 end-to-end 정합
// 케이스를 여러 fixture(빈 batch·혼합·일부 슬롯 0·큰 수)로 포함한다(가드 ↔ formatter
// 계약 정합 회귀 방어). T-0638 summary-batch-outcome-format-shape.spec 구조 mirror.

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
import { assertRealDataResultSummaryLineFormatShape } from "./realdata-e2e-result-summary-line-format-shape";

// 정상 결과 라인 1개 — formatter 산출 형태와 byte 정합(prefix · count/volume 카운트
// 토큰 · 난이도 3 슬롯 · 기여도 4 슬롯 고정 순서 · 개행 0). 위반 케이스는 본 라인에서
// 한 축만 깬다.
const VALID_LINE = `${RESULT_LINE_PREFIX}count=5 · volume=42 · 난이도(easy/medium/hard)=2/2/1 · 기여도(zero/low/medium/high)=1/1/2/1`;

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

describe("assertRealDataResultSummaryLineFormatShape", () => {
  describe("happy path — 정상 결과 라인은 throw 0(void)", () => {
    it("정상 단일 라인 결과를 통과시킨다(throw 0)", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).not.toThrow();
      expect(
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).toBeUndefined();
    });

    it("실 formatRealDataResultSummaryLine(빈 batch · count 0) 산출을 그대로 통과시킨다(end-to-end 정합)", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 0,
          byDifficulty: {},
          byContribution: {},
          totalVolume: 0,
        }),
      );
      // 빈 batch 도 빈 문자열이 아니라 `count=0` 을 명시 — 가드가 차단하지 않는다.
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("실 formatRealDataResultSummaryLine(혼합 분포) 산출을 통과시킨다", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 4,
          byDifficulty: { easy: 1, medium: 2, hard: 1 },
          byContribution: { zero: 0, low: 2, medium: 1, high: 1 },
          totalVolume: 20,
        }),
      );
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("실 formatRealDataResultSummaryLine(일부 슬롯 0) 산출을 통과시킨다(0 슬롯 유지)", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 2,
          byDifficulty: { hard: 2 },
          byContribution: { high: 2 },
          totalVolume: 8,
        }),
      );
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("실 formatRealDataResultSummaryLine(큰 수) 산출을 통과시킨다(자릿수 보존)", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 1_000_000,
          byDifficulty: { easy: 999_999, medium: 1, hard: 0 },
          byContribution: { zero: 0, low: 0, medium: 0, high: 1_000_000 },
          totalVolume: 123_456_789,
        }),
      );
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("실 formatRealDataResultSummaryLine(전 슬롯 0) 산출을 통과시킨다", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 0,
          byDifficulty: { easy: 0, medium: 0, hard: 0 },
          byContribution: { zero: 0, low: 0, medium: 0, high: 0 },
          totalVolume: 0,
        }),
      );
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("입력 line 문자열을 변형하지 않는다(비변형 · deep-equal)", () => {
      const original = VALID_LINE;
      const snapshot = `${original}`;
      assertRealDataResultSummaryLineFormatShape(original);
      expect(original).toEqual(snapshot);
    });

    it("같은 입력 2회 호출 결정성(byte-identical 동작 — 둘 다 void)", () => {
      expect(
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).toBeUndefined();
      expect(
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).toBeUndefined();
    });
  });

  describe("① 비-string → TypeError(구조 결손)", () => {
    it("null 은 TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("undefined 는 TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(
          undefined as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("숫자는 TypeError(메시지에 string 아님 명시)", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(42 as unknown as string),
      ).toThrow(/string 이 아니다/);
    });

    it("객체는 TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape({} as unknown as string),
      ).toThrow(TypeError);
    });

    it("배열은 TypeError", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape([] as unknown as string),
      ).toThrow(TypeError);
    });
  });

  describe("② 개행 혼입 → RangeError(단일 라인 위반)", () => {
    it("후행 개행은 RangeError(라인 수 명시)", () => {
      const line = `${VALID_LINE}\n`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        RangeError,
      );
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /단일 라인 위반/,
      );
    });

    it("중간 개행은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1\n · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /단일 라인 위반/,
      );
    });
  });

  describe("③ prefix 위반 → RangeError", () => {
    it("빈 문자열은 prefix 위반 RangeError(빈 라인 위장 차단)", () => {
      expect(() => assertRealDataResultSummaryLineFormatShape("")).toThrow(
        RangeError,
      );
      expect(() => assertRealDataResultSummaryLineFormatShape("")).toThrow(
        /prefix 위반/,
      );
    });

    it("공백만은 prefix 위반 RangeError(빈 라인 위장 차단)", () => {
      expect(() => assertRealDataResultSummaryLineFormatShape("   ")).toThrow(
        /prefix 위반/,
      );
    });

    it("prefix drift(다른 라벨로 시작)는 RangeError", () => {
      const line = `요약 결과: count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /prefix 위반/,
      );
    });

    it("prefix 부분 일치(라벨 일부 누락)는 RangeError", () => {
      const line = `평가 e2e 결과: count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /prefix 위반/,
      );
    });
  });

  describe("④ 카운트 토큰 위반 → RangeError", () => {
    it("`count=` 토큰 누락은 RangeError", () => {
      // prefix 통과 · 개행 0 이나 `count=` 토큰 부재 → ④ 격리 trigger.
      const line = `${RESULT_LINE_PREFIX}cnt 1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /카운트 토큰 위반/,
      );
    });

    it("`· volume=` 토큰 누락은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · vol 1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /카운트 토큰 위반/,
      );
    });
  });

  describe("⑤ 난이도 슬롯 위반 → RangeError", () => {
    it("난이도 슬롯 누락은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /난이도 슬롯 위반/,
      );
    });

    it("난이도 라벨 순서 뒤바뀜은 RangeError(고정 순서 위반)", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(medium/easy/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /난이도 슬롯 위반/,
      );
    });

    it("난이도 슬롯 값 1개 누락은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /난이도 슬롯 위반/,
      );
    });

    it("난이도 슬롯 값이 정수 아님(비-숫자)은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=x/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /난이도 슬롯 위반/,
      );
    });
  });

  describe("⑥ 기여도 슬롯 위반 → RangeError", () => {
    it("기여도 슬롯 누락은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /기여도 슬롯 위반/,
      );
    });

    it("기여도 라벨 순서 뒤바뀜은 RangeError(고정 순서 위반)", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(low/zero/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /기여도 슬롯 위반/,
      );
    });

    it("기여도 슬롯 값 1개 누락은 RangeError", () => {
      const line = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /기여도 슬롯 위반/,
      );
    });
  });

  describe("flow/branch — 분기 격리", () => {
    it("① 정상 분기 — 혼합 분포 라인 void", () => {
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).not.toThrow();
    });

    it("② 빈 문자열 입력 → prefix 위반(③) RangeError 분기", () => {
      expect(() => assertRealDataResultSummaryLineFormatShape("")).toThrow(
        /prefix 위반/,
      );
    });

    it("③ 공백만 입력 → prefix 위반(③) 분기", () => {
      expect(() => assertRealDataResultSummaryLineFormatShape("     ")).toThrow(
        /prefix 위반/,
      );
    });

    it("④ 개행이 line 끝에만 있는 경우(`\\n` 1개) → 개행 0 위반(②) 분기", () => {
      const line = `${VALID_LINE}\n`;
      expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
        /단일 라인 위반/,
      );
    });

    it("⑤ 모든 슬롯 값 0 line(count=0·volume=0·슬롯 모두 0) → 정상(void) 분기", () => {
      const line = `${RESULT_LINE_PREFIX}count=0 · volume=0 · 난이도(easy/medium/hard)=0/0/0 · 기여도(zero/low/medium/high)=0/0/0/0`;
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });

    it("⑥ formatter 가 실제로 생성한 라인을 그대로 입력 → 정상 분기", () => {
      const line = formatRealDataResultSummaryLine(
        makeSummary({
          count: 3,
          byDifficulty: { easy: 1, medium: 1, hard: 1 },
          byContribution: { zero: 0, low: 1, medium: 1, high: 1 },
          totalVolume: 11,
        }),
      );
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(line),
      ).not.toThrow();
    });
  });

  describe("negative cases 충분 cover", () => {
    it("① 입력 비변형 — 호출 전후 line 문자열 동일(부수효과 0)", () => {
      const line = VALID_LINE;
      const before = `${line}`;
      assertRealDataResultSummaryLineFormatShape(line);
      expect(line).toBe(before);
    });

    it("② 결정성 — 정상 line 2회 호출 둘 다 void", () => {
      expect(
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).toBeUndefined();
      expect(
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).toBeUndefined();
    });

    it("③ 손상 line 2회 호출 → 둘 다 동일 위치 throw(동일 메시지)", () => {
      const broken = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() => assertRealDataResultSummaryLineFormatShape(broken)).toThrow(
        /난이도 슬롯 위반/,
      );
      expect(() => assertRealDataResultSummaryLineFormatShape(broken)).toThrow(
        /난이도 슬롯 위반/,
      );
    });

    it("④ RESULT_LINE_PREFIX single-source 정합 — 가드가 import 한 상수 prefix 를 따른다", () => {
      // 가드가 라벨을 자체 정의하지 않고 import 한 상수에 묶임을 확인. 정상 라인의
      // prefix 만 잘라 라벨 drift 시키면 ③ 으로 차단됨을 명시(드리프트 회귀 방어).
      const drifted = VALID_LINE.replace(RESULT_LINE_PREFIX, "딴 라벨: ");
      expect(() => assertRealDataResultSummaryLineFormatShape(drifted)).toThrow(
        /prefix 위반/,
      );
    });

    it("⑤ DIFFICULTIES single-source 순서 정합 — 고정 순서(easy→medium→hard) 강제", () => {
      expect(DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
      const reordered = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/hard/medium)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`;
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(reordered),
      ).toThrow(/난이도 슬롯 위반/);
    });

    it("⑤ CONTRIBUTION_LEVELS single-source 순서 정합 — 고정 순서(zero→low→medium→high) 강제", () => {
      expect(CONTRIBUTION_LEVELS).toEqual(["zero", "low", "medium", "high"]);
      const reordered = `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/medium/low/high)=1/0/0/0`;
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(reordered),
      ).toThrow(/기여도 슬롯 위반/);
    });

    it("⑥ formatter happy 출력 + 분기 출력(count=0 / 모든 슬롯 0 / 큰 수) 모두 가드 통과", () => {
      const lines = [
        formatRealDataResultSummaryLine(
          makeSummary({
            count: 5,
            byDifficulty: { easy: 2, medium: 2, hard: 1 },
            byContribution: { zero: 1, low: 1, medium: 2, high: 1 },
            totalVolume: 42,
          }),
        ),
        formatRealDataResultSummaryLine(
          makeSummary({
            count: 0,
            byDifficulty: {},
            byContribution: {},
            totalVolume: 0,
          }),
        ),
        formatRealDataResultSummaryLine(
          makeSummary({
            count: 1_000_000_000,
            byDifficulty: { easy: 1_000_000_000, medium: 0, hard: 0 },
            byContribution: { zero: 0, low: 0, medium: 0, high: 1_000_000_000 },
            totalVolume: 1_000_000_000,
          }),
        ),
      ];
      for (const line of lines) {
        expect(() =>
          assertRealDataResultSummaryLineFormatShape(line),
        ).not.toThrow();
      }
    });

    it("⑦ 다양한 손상 패턴(개행 위치 다양·토큰 일부만·슬롯 일부만) 모두 RangeError", () => {
      const corruptLines = [
        // 중간 개행
        `${RESULT_LINE_PREFIX}count=1\n · volume=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`,
        // volume 토큰 누락
        `${RESULT_LINE_PREFIX}count=1 · 난이도(easy/medium/hard)=1/0/0 · 기여도(zero/low/medium/high)=1/0/0/0`,
        // 난이도 슬롯 일부만
        `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0 · 기여도(zero/low/medium/high)=1/0/0/0`,
        // 기여도 슬롯 누락
        `${RESULT_LINE_PREFIX}count=1 · volume=1 · 난이도(easy/medium/hard)=1/0/0`,
      ];
      for (const line of corruptLines) {
        expect(() => assertRealDataResultSummaryLineFormatShape(line)).toThrow(
          RangeError,
        );
      }
    });
  });

  describe("R-59 raw 미저장 정합", () => {
    it("가드는 형태만 검증 — 평가 본문·narrative 미접촉(입력 외 상태 의존 0)", () => {
      // 정상 라인에 narrative 류 raw 본문 키가 부재해도 가드는 정상 통과(형태 검증만).
      expect(VALID_LINE).not.toContain("narrative");
      expect(() =>
        assertRealDataResultSummaryLineFormatShape(VALID_LINE),
      ).not.toThrow();
    });
  });
});

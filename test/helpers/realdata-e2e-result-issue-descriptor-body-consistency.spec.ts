// realdata-e2e-result-issue-descriptor-body-consistency.spec.ts — T-0646 colocated
// unit spec for `assertRealDataResultIssueDescriptorBodyConsistent`.
//
// R-112 cover 구조:
//   - happy-path: 정상 summary(섞임, totalVolume>0) + count=0 빈 summary 두 분기 모두에서
//     `buildRealDataResultIssueDescriptor` 산출 descriptor 가 가드를 void 통과.
//   - error/negative 충분 cover: descriptor null / summary null / body 가 string 아님 /
//     marker 가 string 아님 → 각 분기 별 TypeError(필드별·결손별 분기마다).
//   - flow/branch: ① 정상 descriptor → void ② marker 라인 손상 → RangeError ③ 한 줄
//     요약 라인 손상 → RangeError ④ markdown 블록 손상 → RangeError ⑤ 구분 빈 줄 제거 →
//     RangeError(라인 수 미달 또는 빈 줄 누락 분기) — 각 1+ test.
//   - 재유도 일치: 정상 descriptor 의 body 라인이 single-source 산출과 byte-identical 함
//     검증(가공 0 합성 증명).
//   - 한 줄 요약 중복/누락 손상: 한 줄 요약 2 회 등장 / 누락된 손상 body → RangeError.
//   - 입력 비변형: 가드 호출 후 descriptor / summary / 분포 객체 변경 0.
//   - 결정성: 동일 (descriptor, summary) 2 회 호출 → 둘 다 동일 동작.
//   - R-59: 가드가 raw narrative 키/본문을 읽지 않음(body·summary 모두 카운트·분포·
//     markdown 카운트만 비교).
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import {
  buildRealDataResultIssueDescriptor,
  type RealDataResultIssueDescriptor,
  type RealDataResultIssueRunRef,
} from "./realdata-e2e-result-issue-descriptor";
import { assertRealDataResultIssueDescriptorBodyConsistent } from "./realdata-e2e-result-issue-descriptor-body-consistency";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "./realdata-e2e-result-summary-line";
// namespace import 신설(T-1085) — 재유도 delegate 2개에 jest.spyOn 을 걸기 위한 모듈
// 객체 참조. 기존 named import(formatRealDataResultSummaryLine / renderRealData
// ResultSummaryMarkdown)는 expected-value 계산용으로 유지하되, spy 는 namespace 멤버
// 를 target 으로 건다(named import 와 동일 모듈 객체를 가리켜 가드 호출이 spy 에 잡힘).
import * as summaryLineModule from "./realdata-e2e-result-summary-line";
import * as summaryMarkdownModule from "./realdata-e2e-result-summary-markdown";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";

// fixture 빌더 — 슬롯별 카운트를 명시적으로 받아 결정론적 summary descriptor 를
// 생성한다. 기존 `realdata-e2e-result-issue-descriptor.spec.ts` 의 fixture 빌더와
// 동형 관례.
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

// 정상 descriptor + summary 기본 fixture — 손상 분기 test 가 descriptor 를 spread 한 뒤
// body 만 수정해 손상 fixture 를 만든다.
function makeHappyFixture(): {
  descriptor: RealDataResultIssueDescriptor;
  summary: RealDataResultSummary;
} {
  const summary = makeSummary({
    count: 3,
    byDifficulty: { easy: 2, medium: 1 },
    byContribution: { low: 1, medium: 1, high: 1 },
    totalVolume: 42,
  });
  const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);
  return { descriptor, summary };
}

describe("assertRealDataResultIssueDescriptorBodyConsistent", () => {
  // happy-path ① — 정상 descriptor(섞임, totalVolume>0) → void.
  it("정상 descriptor 와 summary 에 대해 void 를 반환한다(throw 0)", () => {
    const { descriptor, summary } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // happy-path ② — count=0 빈 summary 도 정상 통과(빈 분포 분기).
  it("count=0·volume=0·슬롯 모두 0 인 빈 summary 도 void 반환", () => {
    const summary = makeSummary({
      count: 0,
      byDifficulty: {},
      byContribution: {},
      totalVolume: 0,
    });
    const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // happy-path ③ — 큰 수·다양한 분포 summary 도 정상 통과.
  it("큰 수·다양한 분포 summary 의 descriptor 도 void 반환", () => {
    const summary = makeSummary({
      count: 999,
      byDifficulty: { easy: 333, medium: 333, hard: 333 },
      byContribution: { zero: 100, low: 200, medium: 300, high: 399 },
      totalVolume: 123456,
    });
    const descriptor = buildRealDataResultIssueDescriptor(summary, HAPPY_RUN);

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // 재유도 일치 — 정상 descriptor 의 body 라인이 single-source 산출과 byte-identical.
  it("정상 descriptor 의 body 라인이 single-source 산출과 byte-identical(가공 0)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const expectedLine = formatRealDataResultSummaryLine(summary);
    const expectedMarkdown = renderRealDataResultSummaryMarkdown(summary);
    const lines = descriptor.body.split("\n");

    expect(lines[0]).toBe(descriptor.marker);
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe(expectedLine);
    expect(lines[3]).toBe("");
    expect(lines.slice(4).join("\n")).toBe(expectedMarkdown);
    // 정상 통과 단언(가드 호출 결과 확인).
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // error/negative ① — descriptor null → TypeError.
  it("descriptor 가 null 이면 TypeError", () => {
    const { summary } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        null as unknown as RealDataResultIssueDescriptor,
        summary,
      ),
    ).toThrow(TypeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        null as unknown as RealDataResultIssueDescriptor,
        summary,
      ),
    ).toThrow(/descriptor/);
  });

  // error/negative ② — summary null → TypeError.
  it("summary 가 null 이면 TypeError", () => {
    const { descriptor } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        descriptor,
        null as unknown as RealDataResultSummary,
      ),
    ).toThrow(TypeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        descriptor,
        null as unknown as RealDataResultSummary,
      ),
    ).toThrow(/summary/);
  });

  // error/negative ③ — descriptor undefined → TypeError.
  it("descriptor 가 undefined 이면 TypeError", () => {
    const { summary } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        undefined as unknown as RealDataResultIssueDescriptor,
        summary,
      ),
    ).toThrow(TypeError);
  });

  // error/negative ④ — summary undefined → TypeError.
  it("summary 가 undefined 이면 TypeError", () => {
    const { descriptor } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(
        descriptor,
        undefined as unknown as RealDataResultSummary,
      ),
    ).toThrow(TypeError);
  });

  // error/negative ⑤ — descriptor.body 가 string 아님(undefined) → TypeError.
  it("descriptor.body 가 string 아니면 TypeError", () => {
    const { descriptor, summary } = makeHappyFixture();
    const broken = {
      ...descriptor,
      body: undefined as unknown as string,
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(TypeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/body/);
  });

  // error/negative ⑥ — descriptor.marker 가 string 아님(undefined) → TypeError.
  it("descriptor.marker 가 string 아니면 TypeError", () => {
    const { descriptor, summary } = makeHappyFixture();
    const broken = {
      ...descriptor,
      marker: undefined as unknown as string,
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(TypeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/marker/);
  });

  // flow/branch ① — body 첫 라인이 marker 와 불일치 → RangeError.
  it("body 첫 라인이 marker 와 불일치하면 RangeError(불변식 2)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[0] = "<!-- drifted-marker -->";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(2\)/);
  });

  // flow/branch ② — body 의 한 줄 요약 블록이 formatter 산출과 불일치 → RangeError.
  it("한 줄 요약 라인이 formatter 산출과 불일치하면 RangeError(불변식 4)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[2] = "실 평가 e2e 결과: count=999 · drifted line";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(4\)/);
  });

  // flow/branch ③ — body 의 markdown 블록이 renderer 산출과 불일치 → RangeError.
  it("markdown 블록이 renderer 산출과 불일치하면 RangeError(불변식 6)", () => {
    const { descriptor, summary } = makeHappyFixture();
    // markdown 블록(5 번째 라인부터)을 손상.
    const lines = descriptor.body.split("\n");
    lines[4] = "## drifted-markdown-header";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(6\)/);
  });

  // flow/branch ④ — marker 직후 구분 빈 줄 손상 → RangeError(불변식 3).
  it("marker 직후 구분 빈 줄이 빈 문자열이 아니면 RangeError(불변식 3)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[1] = "non-empty-line";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(3\)/);
  });

  // flow/branch ⑤ — 한 줄 요약 직후 구분 빈 줄 손상 → RangeError(불변식 5).
  it("한 줄 요약 직후 구분 빈 줄이 빈 문자열이 아니면 RangeError(불변식 5)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[3] = "non-empty-line";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(5\)/);
  });

  // flow/branch ⑥ — 구분 빈 줄 제거로 body 라인 수 미달 → RangeError(불변식 1).
  it("body 라인 수가 5 미만이면 RangeError(불변식 1)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: `${descriptor.marker}\n\n`,
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(1\)/);
  });

  // negative ① — 한 줄 요약 중복 손상(markdown 블록에 추가 삽입) → markdown 블록
  // byte-identical 비교가 drift 를 catch → RangeError(불변식 6). 별도 occurrences
  // 보강 분기는 dead branch 로 판정돼 제거됐고(불변식 (4)~(6) 통과 시 정확히 1 회
  // 등장이 이미 강제됨), 본 negative test 는 그 (6) markdown drift 분기에 동기화.
  it("한 줄 요약 중복 손상 → markdown 블록 drift 로 RangeError(불변식 6)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const expectedLine = formatRealDataResultSummaryLine(summary);
    // 한 줄 요약을 markdown 블록 안에도 끼워 중복 등장 시킨다(블록 구조 (1)~(5) 는
    // 유지하되 markdown 본문이 single-source 산출과 drift 하도록).
    const lines = descriptor.body.split("\n");
    const corruptedBody = [
      ...lines.slice(0, 4),
      lines[4],
      expectedLine,
      ...lines.slice(5),
    ].join("\n");
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: corruptedBody,
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(6\)/);
  });

  // negative ② — 한 줄 요약 누락 손상(라인을 다른 값으로 대체) → RangeError(불변식 4).
  it("한 줄 요약 라인이 누락(다른 값으로 대체)된 손상 descriptor 는 RangeError", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[2] = "DROPPED";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(/불변식\(4\)/);
  });

  // 입력 비변형 — 가드 호출 후 descriptor / summary / 분포 객체 변경 0.
  it("가드 호출 후 descriptor·summary·분포 객체를 mutate 하지 않는다", () => {
    const { descriptor, summary } = makeHappyFixture();
    const beforeBody = descriptor.body;
    const beforeMarker = descriptor.marker;
    const beforeTitle = descriptor.title;
    const beforeDifficulty = { ...summary.byDifficulty };
    const beforeContribution = { ...summary.byContribution };
    const beforeCount = summary.count;
    const beforeVolume = summary.totalVolume;

    assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary);

    expect(descriptor.body).toBe(beforeBody);
    expect(descriptor.marker).toBe(beforeMarker);
    expect(descriptor.title).toBe(beforeTitle);
    expect(summary.byDifficulty).toEqual(beforeDifficulty);
    expect(summary.byContribution).toEqual(beforeContribution);
    expect(summary.count).toBe(beforeCount);
    expect(summary.totalVolume).toBe(beforeVolume);
  });

  // 결정성 — 동일 (descriptor, summary) 2 회 호출: 둘 다 정상 → void.
  it("정상 입력 2 회 호출 → 둘 다 void(결정성)", () => {
    const { descriptor, summary } = makeHappyFixture();

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // 결정성 — 손상 입력 2 회 호출: 둘 다 동일 throw.
  it("손상 입력 2 회 호출 → 둘 다 RangeError(결정성)", () => {
    const { descriptor, summary } = makeHappyFixture();
    const lines = descriptor.body.split("\n");
    lines[0] = "<!-- drifted -->";
    const broken: RealDataResultIssueDescriptor = {
      ...descriptor,
      body: lines.join("\n"),
    };

    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(broken, summary),
    ).toThrow(RangeError);
  });

  // R-59 — 가드가 raw narrative 류 키를 읽지 않음(body·summary 모두 카운트·분포만
  // 비교). descriptor / summary 자체에 narrative 키가 부재하므로 본 단언은 입력
  // 비변형 보강.
  it("가드는 카운트·분포·markdown 카운트만 비교하며 raw narrative 키를 읽지 않는다", () => {
    const { descriptor, summary } = makeHappyFixture();

    // 입력에 narrative 류 키가 부재함을 단언(R-59 입력 측면 정합).
    expect(descriptor.body).not.toContain("narrative");
    expect(descriptor.body).not.toContain("rawActivity");
    expect(descriptor.body).not.toContain("unitId");
    expect(() =>
      assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary),
    ).not.toThrow();
  });

  // T-1085 — 구조-검사 선행성 order-lock. 가드는 2 상위 구조 assert(assertDescriptor
  // Structure L136 / assertSummaryStructure L137)를 body 재유도 위임 2개(format
  // RealDataResultSummaryLine L142 / renderRealDataResultSummaryMarkdown L143)보다 먼저
  // 수행한다. 기존 상위 구조 error-path it 6건은 .toThrow(TypeError) 만 assert 하고
  // delegate 호출 횟수를 못박지 않았다(clean-leg). 본 블록이 상위 구조 결손 6 분기에서
  // delegate 2개 각각 toHaveBeenCalledTimes(0)(선행 차단)을, 정합 경로에서 각각 1-call
  // 을, 재유도-후 RangeError 경계에서 각각 1-call 을 못박아 "구조 검사 → body 재유도"
  // 순서를 silent 재정렬로부터 방어한다(T-1066~T-1084 defense-in-depth clean-leg mirror,
  // delegate 2개).
  describe("구조-검사 선행성 order-lock(구조 결손 → 재유도 delegate 2개 0-call)", () => {
    afterEach(() => {
      // 신규 spyOn 격리 — 기존 블록(실 delegate 를 fixture 합성·byte-identical 대조·
      // 결정성 등에 사용)으로 mock 이 누수되지 않도록 매 test 후 복원.
      jest.restoreAllMocks();
    });

    // 상위 구조 결손 6 분기 fixture. 결손 아닌 인자는 정합(makeHappyFixture 산출)으로 두어
    // 결손 인자에서 fail-fast 됨을 격리 확인한다. makeHappyFixture 는 내부에서 delegate 를
    // 호출해 정합 descriptor 를 합성하므로 반드시 spyOn **전**에 호출(계측 오염 차단).
    const STRUCTURE_DEFICIENT_CASES: Array<{
      label: string;
      makeDescriptorArg: (
        base: RealDataResultIssueDescriptor,
      ) => RealDataResultIssueDescriptor;
      makeSummaryArg: (base: RealDataResultSummary) => RealDataResultSummary;
      messagePattern: RegExp;
    }> = [
      {
        label: "descriptor null",
        makeDescriptorArg: () =>
          null as unknown as RealDataResultIssueDescriptor,
        makeSummaryArg: (base) => base,
        messagePattern: /descriptor 가 null\/undefined/,
      },
      {
        label: "descriptor undefined",
        makeDescriptorArg: () =>
          undefined as unknown as RealDataResultIssueDescriptor,
        makeSummaryArg: (base) => base,
        messagePattern: /descriptor 가 null\/undefined/,
      },
      {
        label: "descriptor.body 비-string(숫자)",
        makeDescriptorArg: (base) =>
          ({
            ...base,
            body: 123,
          }) as unknown as RealDataResultIssueDescriptor,
        makeSummaryArg: (base) => base,
        messagePattern: /descriptor\.body 가 문자열이 아니다/,
      },
      {
        label: "descriptor.marker 비-string(null)",
        makeDescriptorArg: (base) =>
          ({
            ...base,
            marker: null,
          }) as unknown as RealDataResultIssueDescriptor,
        makeSummaryArg: (base) => base,
        messagePattern: /descriptor\.marker 가 문자열이 아니다/,
      },
      {
        label: "summary null",
        makeDescriptorArg: (base) => base,
        makeSummaryArg: () => null as unknown as RealDataResultSummary,
        messagePattern: /summary 가 null\/undefined/,
      },
      {
        label: "summary undefined",
        makeDescriptorArg: (base) => base,
        makeSummaryArg: () => undefined as unknown as RealDataResultSummary,
        messagePattern: /summary 가 null\/undefined/,
      },
    ];

    STRUCTURE_DEFICIENT_CASES.forEach(
      ({ label, makeDescriptorArg, makeSummaryArg, messagePattern }) => {
        it(`구조 결손[${label}] → TypeError + 재유도 delegate 2개 0-call(선행 차단)`, () => {
          // 정합 base fixture 를 spy 설치 前 합성 — makeHappyFixture 내부의 delegate
          // 호출이 계측을 오염시키지 않도록 격리.
          const { descriptor: base, summary: baseSummary } = makeHappyFixture();
          const descriptor = makeDescriptorArg(base);
          const summary = makeSummaryArg(baseSummary);
          const lineSpy = jest.spyOn(
            summaryLineModule,
            "formatRealDataResultSummaryLine",
          );
          const markdownSpy = jest.spyOn(
            summaryMarkdownModule,
            "renderRealDataResultSummaryMarkdown",
          );

          // 상위 구조 결손이므로 TypeError(한국어 라벨) throw.
          expect(() =>
            assertRealDataResultIssueDescriptorBodyConsistent(
              descriptor,
              summary,
            ),
          ).toThrow(TypeError);
          expect(() =>
            assertRealDataResultIssueDescriptorBodyConsistent(
              descriptor,
              summary,
            ),
          ).toThrow(messagePattern);

          // 핵심: 상위 구조 검사가 body 재유도보다 먼저 차단 → delegate 2개 미호출(0-call).
          expect(lineSpy).toHaveBeenCalledTimes(0);
          expect(markdownSpy).toHaveBeenCalledTimes(0);
        });
      },
    );

    it("구조 검사 통과(정합 descriptor/summary) → 재유도 delegate 2개 각 1회(summary 인자) 도달 후 void", () => {
      // fixture 는 spy 설치 前 합성 — makeHappyFixture(buildRealDataResultIssueDescriptor)
      // 내부도 delegate 를 호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다. 가드 재유도
      // 호출만 격리 계측한다.
      const { descriptor, summary } = makeHappyFixture();
      const lineSpy = jest.spyOn(
        summaryLineModule,
        "formatRealDataResultSummaryLine",
      );
      const markdownSpy = jest.spyOn(
        summaryMarkdownModule,
        "renderRealDataResultSummaryMarkdown",
      );

      const result = assertRealDataResultIssueDescriptorBodyConsistent(
        descriptor,
        summary,
      );

      // 2 상위 구조 assert 통과 → delegate 2개 각각 정확히 1회 도달(정확히 summary 인자로),
      // 가드는 void. invocationCallOrder(>0)로 구조 검사 통과 뒤 호출됨을 못박는다.
      expect(result).toBeUndefined();
      expect(lineSpy).toHaveBeenCalledTimes(1);
      expect(lineSpy).toHaveBeenCalledWith(summary);
      expect(markdownSpy).toHaveBeenCalledTimes(1);
      expect(markdownSpy).toHaveBeenCalledWith(summary);
      expect(lineSpy.mock.invocationCallOrder[0]).toBeGreaterThan(0);
      expect(markdownSpy.mock.invocationCallOrder[0]).toBeGreaterThan(0);
    });

    it("경계 대조(재유도-후 RangeError) — 한 줄 요약 라인 drift 는 구조 통과 후 delegate 2개 도달 뒤 발생(구조 0-call vs 값 1-call)", () => {
      // 구조 온전(descriptor object·body/marker string·summary object) → 재유도 도달 →
      // 불변식(4) 한 줄 요약 라인 drift 검출 RangeError. fixture 는 spy 설치 前 합성해
      // 계측 오염 차단.
      const { descriptor, summary } = makeHappyFixture();
      const lines = descriptor.body.split("\n");
      lines[2] = "실 평가 e2e 결과: drifted line";
      const corrupted: RealDataResultIssueDescriptor = {
        ...descriptor,
        body: lines.join("\n"),
      };
      const lineSpy = jest.spyOn(
        summaryLineModule,
        "formatRealDataResultSummaryLine",
      );
      const markdownSpy = jest.spyOn(
        summaryMarkdownModule,
        "renderRealDataResultSummaryMarkdown",
      );

      expect(() =>
        assertRealDataResultIssueDescriptorBodyConsistent(corrupted, summary),
      ).toThrow(RangeError);

      // 값 정합 위반은 구조 통과 뒤 재유도 delegate 도달 후 검출 → 구조(0-call)와 달리
      // delegate 2개 모두 1-call(재유도가 값 비교 직전에 이미 수행됨).
      expect(lineSpy).toHaveBeenCalledTimes(1);
      expect(lineSpy).toHaveBeenCalledWith(summary);
      expect(markdownSpy).toHaveBeenCalledTimes(1);
      expect(markdownSpy).toHaveBeenCalledWith(summary);
    });
  });
});

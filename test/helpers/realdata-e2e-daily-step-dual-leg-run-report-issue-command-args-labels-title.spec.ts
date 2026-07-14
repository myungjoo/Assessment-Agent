// realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.spec.ts —
// T-1010 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(args,
//   descriptor, expectedLabels)` — daily-step dual-leg run report 이슈 멱등 명령-args 의
//   labels·title 정합 불변식(title 3자 정합·labels 고정-상수 정합·labels 무공유) 순수 가드.
//
// R-112 cover 구조:
//   - happy-path: 정상 descriptor → buildRealDataDailyStepDualLegRunReportIssueCommandArgs
//     산출 정상 args → 가드 void(throw 0). gitSha/dateToken/leg status 다양성 descriptor
//     변형 + 수동 단일 label 집합 변형.
//   - error/negative 충분 cover: ① args null/undefined → TypeError ② descriptor
//     null/undefined → TypeError ③ expectedLabels null/배열아님/원소非string → TypeError
//     ④ createArgs/updateArgs 부재·title 非string·labels 非배열 → TypeError ⑤ createArgs.title
//     불일치 → RangeError ⑥ updateArgs.title 불일치 → RangeError ⑦ labels 누락/추가 →
//     RangeError ⑧ labels 순서변경 → RangeError ⑨ labels 무공유 위반(동일 참조) → RangeError.
//     불변식별·필드별 분기마다 cover(단일 negative 만으로 부족).
//   - flow/branch: 정상 void / (1) create title 위반 / (2) update title 위반 / (3) labels
//     내용 위반 / (4) labels 참조 위반 / 구조 결손 TypeError 각 분기 격리.
//   - negative cases: 결정성(2회 호출 동일) / 입력 비변형 / 빈 labels 경계 / 부분집합·
//     초과집합 거부 / 공백·대소문자 민감(byte-identical) / R-59 raw 미저장(비시크릿 더미).
import {
  buildRealDataDailyStepDualLegRunReportIssueCommandArgs,
  type RealDataDailyStepDualLegRunReportIssueCommandArgs,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

// 비시크릿 더미 run 식별 토큰 — 실 gitSha/PAT/credential 미노출(R-59 / §9). marker 는
// 빌더 self-wire body marker 가드가 marker-first body 를 요구하므로 body 첫 라인에 박는다.
const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-06-25@abc1234 -->";
const TITLE = "실 평가 e2e daily-step dual-leg run report 2026-06-25@abc1234";

// 빌더의 고정 상수와 동일 내용의 expectedLabels — 단, 별도 배열 리터럴이므로 빌더가
// 복제한 createArgs.labels 와 참조는 다르다(무공유 정상 케이스).
const EXPECTED_LABELS: readonly string[] = [
  "realdata-e2e",
  "daily-step-dual-leg-run-report",
];

// leg status 분포를 모사한 descriptor 변형들 — title 은 항상 동일(같은 run), body 첫
// 라인은 marker(빌더 정합). 가드는 title/labels 만 보지만 빌더가 정상 args 를 산출하려면
// body 가 marker-first 여야 한다(빌더 self-wire body marker 가드 통과 조건).
function makeDescriptor(
  bodyTail: readonly string[],
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  return {
    title: TITLE,
    marker: MARKER,
    body: [MARKER, "", ...bodyTail].join("\n"),
  };
}

const ALL_PASS = makeDescriptor([
  "## 실 평가 e2e daily-step dual-leg run report",
  "- eval leg: run / pass",
  "- collect leg: run / pass",
  "- overall: all-pass",
]);
const MIXED = makeDescriptor([
  "## 실 평가 e2e daily-step dual-leg run report",
  "- eval leg: run / fail",
  "- collect leg: skip / skip",
  "- overall: fail",
]);

// 가드 직접 단위 테스트용 정상 args 합성기 — 빌더를 거치지 않고 임의 labels·title 변형을
// 주입할 수 있게 한다(빌더는 고정 상수만 산출하므로 일부 분기는 수동 합성이 필요).
function makeArgs(overrides: {
  createTitle?: string;
  updateTitle?: string;
  labels?: string[];
}): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return {
    searchQuery: MARKER,
    createArgs: {
      title: overrides.createTitle ?? TITLE,
      body: ALL_PASS.body,
      labels: overrides.labels ?? [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ],
    },
    updateArgs: {
      title: overrides.updateTitle ?? TITLE,
      body: ALL_PASS.body,
    },
  };
}

describe("assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent", () => {
  // ── happy-path ──────────────────────────────────────────────────────────
  it.each([
    ["all-pass leg 분포", ALL_PASS],
    ["mixed(fail/skip) leg 분포", MIXED],
  ])(
    "정상 %s descriptor → 빌더 산출 args 에 대해 void 반환(throw 0)",
    (_label, descriptor) => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
          args,
          descriptor,
          EXPECTED_LABELS,
        ),
      ).not.toThrow();
    },
  );

  it("다양한 label 집합 변형 — 단일 label 집합도 정상이면 void", () => {
    const args = makeArgs({ labels: ["only-one"] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        ["only-one"],
      ),
    ).not.toThrow();
  });

  // ── 구조/타입 결손(TypeError) ───────────────────────────────────────────
  it("① args 가 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("① args 가 undefined 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        undefined as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("④ args.createArgs 가 부재하면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: undefined as unknown as typeof args.createArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("④ args.createArgs.title 이 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: { ...args.createArgs, title: 42 as unknown as string },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("④ args.createArgs.labels 가 배열이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: {
        ...args.createArgs,
        labels: "realdata-e2e" as unknown as string[],
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("④ args.updateArgs 가 부재하면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      updateArgs: null as unknown as typeof args.updateArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("④ args.updateArgs.title 이 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      updateArgs: { ...args.updateArgs, title: {} as unknown as string },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("② descriptor 가 null 이면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        null as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("② descriptor.title 이 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const brokenDescriptor = {
      ...ALL_PASS,
      title: 123 as unknown as string,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        brokenDescriptor,
        EXPECTED_LABELS,
      ),
    ).toThrow(TypeError);
  });

  it("③ expectedLabels 가 null 이면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        null as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("③ expectedLabels 가 배열이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        "daily-step-dual-leg-run-report" as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("③ expectedLabels 원소가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        ["realdata-e2e", 7 as unknown as string],
      ),
    ).toThrow(TypeError);
  });

  // ── 값 정합 위반(RangeError) ────────────────────────────────────────────
  it("⑤ createArgs.title 이 descriptor.title 과 불일치하면 RangeError", () => {
    const broken = makeArgs({ createTitle: "어긋난 제목" });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(1\)/);
  });

  it("⑥ updateArgs.title 이 descriptor.title 과 불일치하면 RangeError", () => {
    const broken = makeArgs({ updateTitle: `${TITLE} (수정)` });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(2\)/);
  });

  it("⑦ labels 원소가 누락되면(개수 부족) RangeError", () => {
    const broken = makeArgs({ labels: ["realdata-e2e"] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑦ labels 원소가 추가되면(개수 초과) RangeError", () => {
    const broken = makeArgs({
      labels: ["realdata-e2e", "daily-step-dual-leg-run-report", "extra"],
    });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑦ labels 원소 내용이 어긋나면(같은 개수, 다른 값) RangeError", () => {
    const broken = makeArgs({
      labels: ["realdata-e2e", "DAILY-STEP-DUAL-LEG-RUN-REPORT"],
    });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑧ labels 순서가 변경되면 RangeError", () => {
    const broken = makeArgs({
      labels: ["daily-step-dual-leg-run-report", "realdata-e2e"],
    });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑨ createArgs.labels 가 expectedLabels 와 동일 참조면(무공유 위반) RangeError", () => {
    // 빌더가 상수를 복제하지 않고 직접 반환하는 무공유 위반을 모사 — createArgs.labels
    // 와 expectedLabels 가 같은 배열 참조다(내용은 일치하므로 (3) 통과 후 (4) 가 catch).
    const sharedLabels: string[] = [
      "realdata-e2e",
      "daily-step-dual-leg-run-report",
    ];
    const broken: RealDataDailyStepDualLegRunReportIssueCommandArgs = {
      searchQuery: MARKER,
      createArgs: {
        title: TITLE,
        body: ALL_PASS.body,
        labels: sharedLabels,
      },
      updateArgs: { title: TITLE, body: ALL_PASS.body },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        sharedLabels,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        sharedLabels,
      ),
    ).toThrow(/불변식\(4\)/);
  });

  // ── negative cases 충분 cover ───────────────────────────────────────────
  it("결정성 — 동일 (args, descriptor, expectedLabels) 2 회 호출 둘 다 void", () => {
    const args = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(MIXED);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        MIXED,
        EXPECTED_LABELS,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        MIXED,
        EXPECTED_LABELS,
      ),
    ).not.toThrow();
  });

  it("결정성 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const broken = makeArgs({ labels: ["wrong"] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("입력 비변형 — 호출 후 args / descriptor / expectedLabels 객체 불변", () => {
    const args = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(MIXED);
    const argsBefore = JSON.stringify(args);
    const descriptorBefore = JSON.stringify(MIXED);
    const labelsBefore = JSON.stringify(EXPECTED_LABELS);

    assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
      args,
      MIXED,
      EXPECTED_LABELS,
    );

    expect(JSON.stringify(args)).toBe(argsBefore);
    expect(JSON.stringify(MIXED)).toBe(descriptorBefore);
    expect(JSON.stringify(EXPECTED_LABELS)).toBe(labelsBefore);
  });

  it("빈 labels 경계 — expectedLabels 와 createArgs.labels 둘 다 빈 배열이면 void", () => {
    const args = makeArgs({ labels: [] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        [],
      ),
    ).not.toThrow();
  });

  it("빈 labels 경계 — expectedLabels 가 빈 배열인데 createArgs.labels 가 비지 않으면 RangeError", () => {
    const args = makeArgs({ labels: ["unexpected"] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        [],
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("부분 일치 거부 — createArgs.labels 가 expectedLabels 의 진부분집합이면 RangeError", () => {
    const args = makeArgs({ labels: ["daily-step-dual-leg-run-report"] });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("부분 일치 거부 — createArgs.labels 가 expectedLabels 의 초과집합이면 RangeError", () => {
    const args = makeArgs({
      labels: [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
        "daily-step-dual-leg-run-report",
      ],
    });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("공백 민감 — label 에 트레일링 공백이 있으면(byte-identical 아님) RangeError", () => {
    const args = makeArgs({
      labels: ["realdata-e2e", "daily-step-dual-leg-run-report "],
    });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("대소문자 민감 — title 이 대소문자만 다르면(byte-identical 아님) RangeError", () => {
    const broken = makeArgs({ createTitle: TITLE.toUpperCase() });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        broken,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).toThrow(/불변식\(1\)/);
  });

  // ── §9 / §12 / R-59 안전성 ──────────────────────────────────────────────
  it("R-59 — fixture 는 비시크릿 더미 string, raw 활동 본문 전역 저장 0", () => {
    // 본 spec 의 모든 fixture(MARKER/TITLE/label)는 비시크릿 더미다. 가드는 title·labels
    // string 만 비교하며 raw payload(commit/PR/issue 전문)를 파일/전역에 저장하지 않는다.
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(MARKER).not.toMatch(/ghp_|github_pat_|secret|token/i);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
        args,
        ALL_PASS,
        EXPECTED_LABELS,
      ),
    ).not.toThrow();
  });
});

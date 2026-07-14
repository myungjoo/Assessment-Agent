// realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.spec.ts
// — T-1008 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(args,
// descriptor)` — daily-step dual-leg run report 이슈 멱등 명령-args 의 body marker-first
// 구조 불변식(descriptor-only) 순수 가드.
//
// R-112 cover 구조:
//   - happy-path: 정상 descriptor → buildRealDataDailyStepDualLegRunReportIssueCommandArgs
//     산출 정상 args → 가드 void(throw 0). gitSha/dateToken/leg status 다양성 descriptor 변형.
//   - error/negative 충분 cover: ① args null/undefined → TypeError ② descriptor
//     null/undefined → TypeError ③ createArgs/updateArgs 부재·body·searchQuery·marker 가
//     string 아님 → TypeError ④ createArgs.body 불일치 → RangeError ⑤ updateArgs.body
//     불일치 → RangeError ⑥ marker-first 위반 → RangeError ⑦ searchQuery 불일치 →
//     RangeError. 불변식별·필드별 분기마다 cover(단일 negative 만으로 부족).
//   - flow/branch: 정상 void / (1) create body 위반 / (2) update body 위반 / (3)
//     marker-first 위반 / (4) searchQuery 위반 / 구조 결손 TypeError 각 분기 격리.
//   - negative cases: 결정성(2회 호출 동일) / 입력 비변형 / create·update 비대칭 손상 /
//     공백·빈 marker 위반 / marker 부분일치 함정 / R-59(raw narrative 미접촉).
import {
  buildRealDataDailyStepDualLegRunReportIssueCommandArgs,
  type RealDataDailyStepDualLegRunReportIssueCommandArgs,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-06-23@abc1234 -->";

const LABELS: readonly string[] = [
  "realdata-e2e",
  "daily-step-dual-leg-run-report",
];

// dual-leg run report 본문 분포를 모사한 marker-first body 변형들 — descriptor.body 첫
// 라인이 항상 marker 인 정상 합성을 모사한다(빌더가 marker 를 본문 첫 라인으로 박는 규칙
// 정합).
function makeDescriptor(
  bodyTail: readonly string[],
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  return {
    title: "실 평가 e2e daily-step dual-leg run report 2026-06-23@abc1234",
    marker: MARKER,
    body: [MARKER, "", ...bodyTail].join("\n"),
  };
}

const ALL_PASS = makeDescriptor([
  "## daily-step dual-leg run report",
  "- overallStatus: all-pass",
  "- eval leg: run/pass",
  "- collect leg: run/pass",
]);
const MIXED_STATUS = makeDescriptor([
  "## daily-step dual-leg run report",
  "- overallStatus: fail",
  "- eval leg: run/fail",
  "- collect leg: run/pass",
]);
const SKIP_LEG = makeDescriptor([
  "## daily-step dual-leg run report",
  "- overallStatus: fail",
  "- eval leg: skip/skip",
  "- collect leg: run/pass",
]);

describe("assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor", () => {
  // ── happy-path ──────────────────────────────────────────────────────────
  it.each([
    ["all-pass", ALL_PASS],
    ["mixed status", MIXED_STATUS],
    ["skip leg", SKIP_LEG],
  ])(
    "정상 %s descriptor → 산출 args 에 대해 void 반환(throw 0)",
    (_label, descriptor) => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
          args,
          descriptor,
        ),
      ).not.toThrow();
    },
  );

  // ── 구조/타입 결손(TypeError) ───────────────────────────────────────────
  it("① args 가 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("① args 가 undefined 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        undefined as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("② descriptor 가 null 이면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        null as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
      ),
    ).toThrow(TypeError);
  });

  it("② descriptor 가 undefined 이면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        undefined as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
      ),
    ).toThrow(TypeError);
  });

  it("③ args.searchQuery 가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      searchQuery: 42 as unknown as string,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("③ args.createArgs 가 부재하면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: undefined as unknown as typeof args.createArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("③ args.createArgs.body 가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: { ...args.createArgs, body: 0 as unknown as string },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("③ args.updateArgs 가 부재하면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      updateArgs: null as unknown as typeof args.updateArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("③ args.updateArgs.body 가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      updateArgs: { ...args.updateArgs, body: {} as unknown as string },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(TypeError);
  });

  it("③ descriptor.body 가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const brokenDescriptor = {
      ...ALL_PASS,
      body: 123 as unknown as string,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        brokenDescriptor,
      ),
    ).toThrow(TypeError);
  });

  it("③ descriptor.marker 가 string 이 아니면 TypeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const brokenDescriptor = {
      ...ALL_PASS,
      marker: null as unknown as string,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        brokenDescriptor,
      ),
    ).toThrow(TypeError);
  });

  // ── 값 정합 위반(RangeError) ────────────────────────────────────────────
  it("④ createArgs.body 가 descriptor.body 와 불일치하면 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      createArgs: {
        ...args.createArgs,
        body: `${ALL_PASS.body}\n손상`,
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(1\)/);
  });

  it("⑤ updateArgs.body 가 descriptor.body 와 불일치하면 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      updateArgs: {
        ...args.updateArgs,
        body: ALL_PASS.body.replace("all-pass", "fail"),
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(2\)/);
  });

  it("⑥ body 첫 라인이 marker 가 아니면(marker-first 위반) RangeError", () => {
    // descriptor.body 와 양 body 를 동일하게(불변식 1·2 통과) marker 가 첫 라인이
    // 아닌 형태로 손상시켜 (3) marker-first 분기를 격리한다.
    const noMarkerFirstBody = ["딴 줄", MARKER, "", "본문"].join("\n");
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
      ...ALL_PASS,
      body: noMarkerFirstBody,
    };
    const args: RealDataDailyStepDualLegRunReportIssueCommandArgs = {
      searchQuery: MARKER,
      createArgs: {
        title: descriptor.title,
        body: noMarkerFirstBody,
        labels: [...LABELS],
      },
      updateArgs: { title: descriptor.title, body: noMarkerFirstBody },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        descriptor,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        descriptor,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑥ body 가 marker 를 둘째 라인에 두면(marker-first 위반) RangeError", () => {
    // marker 가 첫 라인이 아니라 둘째 라인에 박힌 손상 — 양 body·descriptor.body 가
    // 동일(불변식 1·2 통과)하되 첫 라인이 marker 와 불일치하므로 (3) marker-first 가 catch.
    const body = ["헤더 줄", MARKER, "본문"].join("\n");
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
      ...ALL_PASS,
      body,
    };
    const args: RealDataDailyStepDualLegRunReportIssueCommandArgs = {
      searchQuery: MARKER,
      createArgs: {
        title: descriptor.title,
        body,
        labels: [...LABELS],
      },
      updateArgs: { title: descriptor.title, body },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        descriptor,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("⑦ searchQuery 가 descriptor.marker 와 불일치하면 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = {
      ...args,
      searchQuery: `${MARKER}-drift`,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(4\)/);
  });

  // ── negative cases 충분 cover ───────────────────────────────────────────
  it("결정성 — 동일 (args, descriptor) 2 회 호출 둘 다 void", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(MIXED_STATUS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        MIXED_STATUS,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        MIXED_STATUS,
      ),
    ).not.toThrow();
  });

  it("결정성 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = { ...args, searchQuery: "어긋난-토큰" };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(4\)/);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(4\)/);
  });

  it("입력 비변형 — 호출 후 args / descriptor 객체 불변", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(MIXED_STATUS);
    const argsBefore = JSON.stringify(args);
    const descriptorBefore = JSON.stringify(MIXED_STATUS);

    assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
      args,
      MIXED_STATUS,
    );

    expect(JSON.stringify(args)).toBe(argsBefore);
    expect(JSON.stringify(MIXED_STATUS)).toBe(descriptorBefore);
  });

  it("비대칭 손상 — create body 만 손상돼도 검출(두 body 모두 검사 증명)", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const onlyCreateBroken = {
      ...args,
      createArgs: { ...args.createArgs, body: "전혀 다른 body" },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        onlyCreateBroken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(1\)/);
  });

  it("비대칭 손상 — update body 만 손상돼도 검출(create 통과 후 update catch)", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const onlyUpdateBroken = {
      ...args,
      updateArgs: { ...args.updateArgs, body: "전혀 다른 body" },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        onlyUpdateBroken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(2\)/);
  });

  it("빈 marker 위반 — searchQuery 가 빈 문자열인데 marker 는 비어있지 않으면 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    const broken = { ...args, searchQuery: "" };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(4\)/);
  });

  it("marker 부분일치 함정 — searchQuery 가 marker 의 prefix 만 담으면 RangeError", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    // marker 의 앞부분만(전체 일치 아님) — byte-identical 검사라 prefix 일치는 위반.
    const broken = { ...args, searchQuery: MARKER.slice(0, MARKER.length - 5) };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        broken,
        ALL_PASS,
      ),
    ).toThrow(/불변식\(4\)/);
  });

  it("marker 부분일치 함정 — body 첫 라인이 marker 를 prefix 로만 포함하면 marker-first 위반", () => {
    // body 첫 라인이 marker 의 prefix(전체 일치 아님)인 손상 — 양 body·descriptor.body
    // 동일(불변식 1·2 통과)하되 첫 라인이 marker 전체와 불일치하므로 (3) 가 catch.
    const truncatedMarker = MARKER.slice(0, MARKER.length - 3);
    const body = [truncatedMarker, "", "본문"].join("\n");
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
      ...ALL_PASS,
      body,
    };
    const args: RealDataDailyStepDualLegRunReportIssueCommandArgs = {
      searchQuery: MARKER,
      createArgs: {
        title: descriptor.title,
        body,
        labels: [...LABELS],
      },
      updateArgs: { title: descriptor.title, body },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        descriptor,
      ),
    ).toThrow(/불변식\(3\)/);
  });

  it("R-59 — 가드는 body 의 marker/string 만 비교, raw narrative 키 미접촉", () => {
    // 가드 통과 후에도 명령-args body 에 raw narrative 류 키가 끼어들지 않음을 함께 확인
    // (가드 자체가 raw 본문을 다루지 않음 — descriptor.body/marker single-source 비교만).
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(ALL_PASS);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
        args,
        ALL_PASS,
      ),
    ).not.toThrow();
    expect(args.createArgs.body).not.toContain("narrative");
    expect(args.updateArgs.body).not.toContain("narrative");
    expect(args.createArgs.body).not.toContain("rawActivity");
  });
});

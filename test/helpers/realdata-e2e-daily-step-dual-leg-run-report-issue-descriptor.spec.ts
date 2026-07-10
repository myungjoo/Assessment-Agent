// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts — T-0896
// colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: overallStatus "all-pass" 정상 report → title(prefix+token) /
//     marker(안정 토큰) / body(marker 라인 + 렌더 본문)가 정확히 산출됨 + 동일 report
//     재빌드 시 byte-identical.
//   - error/negative 충분 cover: (a) 빈 gitSha throw, (b) 공백-only gitSha throw,
//     (c) 빈 dateToken throw, (d) 공백-only dateToken throw — 각 별도 case(필드별·빈/
//     공백별 분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(gitSha 빈/공백, dateToken 빈/공백) + 정상 경로 각 1+.
//     body 에 marker 라인이 정확히 1 회 포함됨(중복·누락 0) 검증. overallStatus 4 분기
//     중 all-pass + 비-all-pass(some-fail 등)에서 title/body 정확 산출.
//   - 멱등 marker 안정성: 동일 run(동일 gitSha+dateToken)이면 leg status/overallStatus
//     가 달라도 marker/title 동일, 서로 다른 run 은 서로 다른 marker.
//   - 결정론: 동일 report 2 회 호출 → byte-identical descriptor + 매번 새 객체.
//   - 무공유/순수성: 빌드 후 입력 report / eval / collect 객체 deep-equal 불변.
//   - R-59: descriptor 가 narrative 류 raw 본문 키를 담지 않음(렌더 입력 자체에 부재).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueDescriptor,
  type RealDataDailyStepDualLegRunReportIssueDescriptor,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";

// fixture 빌더 — leg status / overallStatus / run 식별자를 명시적으로 받아 결정론적
// report descriptor 를 생성한다. summaryLine 은 T-0894 컴포저 산출 포맷과 동형으로
// 합성(본 빌더는 이 라인을 렌더러 위임 통해 body 로 전파만).
function makeReport(opts: {
  gitSha?: string;
  dateToken?: string;
  evalAction?: "run" | "skip";
  evalStatus?: "pass" | "fail" | "skip";
  collectAction?: "run" | "skip";
  collectStatus?: "pass" | "fail" | "skip";
  overallStatus?: "all-pass" | "some-fail" | "all-skip" | "partial";
}): RealDataDailyStepDualLegRunReport {
  const gitSha = opts.gitSha ?? "abc1234";
  const dateToken = opts.dateToken ?? "2026-06-23";
  const evalStatus = opts.evalStatus ?? "pass";
  const collectStatus = opts.collectStatus ?? "pass";
  const overallStatus = opts.overallStatus ?? "all-pass";
  return {
    gitSha,
    dateToken,
    eval: { action: opts.evalAction ?? "run", status: evalStatus },
    collect: { action: opts.collectAction ?? "run", status: collectStatus },
    overallStatus,
    summaryLine: `[${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`,
  };
}

const HAPPY_REPORT = makeReport({});

describe("buildRealDataDailyStepDualLegRunReportIssueDescriptor", () => {
  // happy-path — overallStatus "all-pass" 정상 report.
  it("정상 all-pass report 에 대해 title / marker / body 를 정확히 산출한다", () => {
    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);

    // title — 고정 prefix + run token(dateToken@gitSha) 포함.
    expect(descriptor.title).toBe(
      "실 평가 e2e daily-step dual-leg run report 2026-06-23@abc1234",
    );
    // marker — 안정 식별 토큰(run token 포함).
    expect(descriptor.marker).toContain("2026-06-23@abc1234");
    expect(descriptor.marker).toMatch(/^<!--/);
    expect(descriptor.marker).toMatch(/-->$/);
    // body — marker 라인으로 시작 + 렌더 본문(T-0895) 포함.
    expect(descriptor.body.startsWith(descriptor.marker)).toBe(true);
    expect(descriptor.body).toContain(
      "## 실 평가 e2e daily-step dual-leg run report",
    );
    expect(descriptor.body).toContain("- git sha: abc1234");
    expect(descriptor.body).toContain("- date token: 2026-06-23");
    expect(descriptor.body).toContain("- overall status: all-pass");
    expect(descriptor.body).toContain("| eval | run | pass |");
    expect(descriptor.body).toContain("| collect | run | pass |");
  });

  // 동일 report 재빌드 시 byte-identical(happy-path 결정론).
  it("동일 report 재빌드 시 byte-identical descriptor 를 반환한다", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);

    expect(a.title).toBe(b.title);
    expect(a.marker).toBe(b.marker);
    expect(a.body).toBe(b.body);
  });

  // flow/branch — body 에 marker 라인이 정확히 1 회만 포함(중복·누락 0).
  it("body 에 marker 라인을 정확히 1 회만 포함한다", () => {
    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);

    const occurrences = descriptor.body.split(descriptor.marker).length - 1;
    expect(occurrences).toBe(1);
  });

  // flow/branch — body 구조: [marker, "", ...markdown lines].
  it("body 첫 2 라인이 marker / 빈 줄 순서이고 그 뒤에 마크다운 본문이 위치한다", () => {
    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);
    const expectedMarkdown =
      renderRealDataDailyStepDualLegRunReportMarkdown(HAPPY_REPORT);
    const lines = descriptor.body.split("\n");

    expect(lines[0]).toBe(descriptor.marker);
    expect(lines[1]).toBe("");
    // body 는 marker → 빈 줄 → 렌더 본문(가공 0 위임)으로 정확히 합성된다.
    expect(descriptor.body).toBe(
      [descriptor.marker, "", expectedMarkdown].join("\n"),
    );
  });

  // branch — overallStatus "some-fail"(비-all-pass) 분기에서도 title/body 정확 산출.
  it("some-fail report(비-all-pass 분기)에 대해 title / body 를 정확히 산출한다", () => {
    const report = makeReport({
      evalStatus: "fail",
      collectStatus: "pass",
      overallStatus: "some-fail",
    });

    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

    expect(descriptor.title).toBe(
      "실 평가 e2e daily-step dual-leg run report 2026-06-23@abc1234",
    );
    expect(descriptor.body).toContain("- overall status: some-fail");
    expect(descriptor.body).toContain("| eval | run | fail |");
    expect(descriptor.body).toContain("| collect | run | pass |");
  });

  // branch — overallStatus "all-skip"(두 leg skip) 분기도 정상 산출.
  it("all-skip report(두 leg skip 분기)에 대해 body 를 정확히 산출한다", () => {
    const report = makeReport({
      evalAction: "skip",
      evalStatus: "skip",
      collectAction: "skip",
      collectStatus: "skip",
      overallStatus: "all-skip",
    });

    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

    expect(descriptor.body).toContain("- overall status: all-skip");
    expect(descriptor.body).toContain("| eval | skip | skip |");
    expect(descriptor.body).toContain("| collect | skip | skip |");
  });

  // 멱등 marker 안정성 (negative a) — 동일 run 이면 leg status/overallStatus 가 달라도
  // marker / title 동일.
  it("동일 run 이면 leg status/overallStatus 가 달라도 marker / title 이 동일하다", () => {
    const reportA = makeReport({ overallStatus: "all-pass" });
    const reportB = makeReport({
      evalStatus: "fail",
      collectStatus: "skip",
      collectAction: "skip",
      overallStatus: "some-fail",
    });

    const a = buildRealDataDailyStepDualLegRunReportIssueDescriptor(reportA);
    const b = buildRealDataDailyStepDualLegRunReportIssueDescriptor(reportB);

    expect(a.marker).toBe(b.marker);
    expect(a.title).toBe(b.title);
    // 본문은 leg status/overallStatus 가 다르므로 달라야 한다(멱등은 marker/title 식별자에 한함).
    expect(a.body).not.toBe(b.body);
  });

  // 멱등 marker 안정성 (negative b) — 서로 다른 run(gitSha 또는 dateToken 상이)은 서로
  // 다른 marker.
  it("서로 다른 run(gitSha 또는 dateToken 상이)은 서로 다른 marker 를 산출한다", () => {
    const base = buildRealDataDailyStepDualLegRunReportIssueDescriptor(
      makeReport({}),
    );
    const otherSha = buildRealDataDailyStepDualLegRunReportIssueDescriptor(
      makeReport({ gitSha: "def5678" }),
    );
    const otherDate = buildRealDataDailyStepDualLegRunReportIssueDescriptor(
      makeReport({ dateToken: "2026-06-24" }),
    );

    expect(base.marker).not.toBe(otherSha.marker);
    expect(base.marker).not.toBe(otherDate.marker);
    expect(base.title).not.toBe(otherSha.title);
    expect(base.title).not.toBe(otherDate.title);
  });

  // 결정론·무공유 (negative c) — 동일 report 2 회 호출 → descriptor 동일 + 반환은 매번
  // 새 객체.
  it("동일 report 두 번 빌드 시 descriptor 가 동일하되 매번 새 객체를 반환한다", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);

    expect(a).toEqual(b);
    // 값은 동일하되 참조는 매 호출 새 객체(무공유).
    expect(a).not.toBe(b);
  });

  // 입력 mutate 0 (negative d) — report 및 하위 eval/collect 객체가 빌드 전후 deep-equal.
  it("입력 report 및 하위 eval / collect 객체를 mutate 하지 않는다", () => {
    const report = makeReport({
      evalStatus: "fail",
      collectStatus: "skip",
      collectAction: "skip",
      overallStatus: "some-fail",
    });
    const before = JSON.parse(JSON.stringify(report));

    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

    expect(report).toEqual(before);
    expect(report.eval).toEqual(before.eval);
    expect(report.collect).toEqual(before.collect);
  });

  // credential/raw echo 0 (negative e) — descriptor 는 run 식별자·leg status·집계 요약
  // (렌더 위임)만 담고 narrative/raw 활동 본문·secret 형태를 노출하지 않음.
  it("descriptor 에 narrative / raw 활동 / secret 류 본문 키가 등장하지 않는다", () => {
    const descriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);
    const serialized = JSON.stringify(descriptor);

    expect(serialized).not.toContain("narrative");
    expect(serialized).not.toContain("rawActivity");
    // credential 형태(env-var 어형·토큰 prefix)가 본문에 새지 않음. 본문의 정상 표기
    // "date token" 같은 소문자 어휘는 credential 이 아니므로 매칭 대상에서 제외한다 —
    // 대문자 env-var 명·GitHub/Slack 토큰 prefix 등 credential-shaped 문자열만 검출.
    expect(serialized).not.toMatch(
      /SECRET|GITHUB_TOKEN|_TOKEN\b|API[_-]?KEY|PASSWORD|ghp_|xox[baprs]-|Bearer /,
    );
  });

  const baseReport = makeReport({});

  // negative (a) — 빈 gitSha throw.
  it("빈 gitSha 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueDescriptor({
        ...baseReport,
        gitSha: "",
      }),
    ).toThrow(/gitSha/);
  });

  // negative (b) — 공백-only gitSha throw.
  it("공백-only gitSha 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueDescriptor({
        ...baseReport,
        gitSha: "   ",
      }),
    ).toThrow(/gitSha/);
  });

  // negative (c) — 빈 dateToken throw.
  it("빈 dateToken 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueDescriptor({
        ...baseReport,
        dateToken: "",
      }),
    ).toThrow(/dateToken/);
  });

  // negative (d) — 공백-only dateToken throw.
  it("공백-only dateToken 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueDescriptor({
        ...baseReport,
        dateToken: "\t \n",
      }),
    ).toThrow(/dateToken/);
  });

  // 반환 타입 형태 회귀 — descriptor 는 정확히 { title, marker, body } 3 키만 담는다.
  it("descriptor 는 정확히 title / marker / body 3 키만 담는다", () => {
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor =
      buildRealDataDailyStepDualLegRunReportIssueDescriptor(HAPPY_REPORT);

    expect(Object.keys(descriptor).sort()).toEqual(["body", "marker", "title"]);
  });
});

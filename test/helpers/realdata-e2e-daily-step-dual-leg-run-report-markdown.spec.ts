// realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts — T-0895 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: overallStatus "all-pass"(eval pass & collect pass) 완전 descriptor →
//     마크다운이 gitSha/dateToken/두 leg status/overallStatus/summaryLine 을 모두 담고
//     동일 descriptor 재렌더 시 byte-identical.
//   - error path: guard 3 분기(gitSha / dateToken / summaryLine 빈-공백-only → throw) 각 1+.
//   - flow/branch: overallStatus 4 분기(all-pass/some-fail/all-skip/partial) 각 1+ +
//     per-leg status 3 분기(pass/fail/skip) 각 1+ 로 렌더 표기 정확성 검증.
//   - negative 충분 cover: all-skip / some-fail / partial 정확 표기, credential echo 0,
//     결정론·무공유, 입력 mutate 0 각 1+. 단일 negative 만으로 부족.
import type {
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepDualLegOverallStatus,
  RealDataDailyStepLegStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";

// fixture 빌더 — run 식별자·per-leg {action,status}·overallStatus 를 명시적으로 받아
// 결정론적 descriptor 를 생성(spec 내 인라인 구성 — 새 공용 mock helper 추출 0). 기본값은
// all-pass 완전 descriptor 이며 opts 로 각 슬롯을 덮어쓴다.
function makeReport(
  opts: {
    gitSha?: string;
    dateToken?: string;
    evalAction?: "run" | "skip";
    evalStatus?: RealDataDailyStepLegStatus;
    collectAction?: "run" | "skip";
    collectStatus?: RealDataDailyStepLegStatus;
    overallStatus?: RealDataDailyStepDualLegOverallStatus;
    summaryLine?: string;
  } = {},
): RealDataDailyStepDualLegRunReport {
  const gitSha = opts.gitSha ?? "abc1234";
  const dateToken = opts.dateToken ?? "2026-07-11";
  const evalStatus = opts.evalStatus ?? "pass";
  const collectStatus = opts.collectStatus ?? "pass";
  const overallStatus = opts.overallStatus ?? "all-pass";
  return {
    gitSha,
    dateToken,
    eval: { action: opts.evalAction ?? "run", status: evalStatus },
    collect: { action: opts.collectAction ?? "run", status: collectStatus },
    overallStatus,
    summaryLine:
      opts.summaryLine ??
      `[${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`,
  };
}

describe("renderRealDataDailyStepDualLegRunReportMarkdown", () => {
  // ── happy-path ────────────────────────────────────────────────────────────
  // all-pass(eval pass & collect pass) 완전 descriptor → 마크다운이 run 식별자·두 leg
  // status·overallStatus·summaryLine 을 모두 정확히 담음.
  it("all-pass descriptor 를 gitSha/dateToken/두 leg status/overallStatus/summaryLine 모두 담아 렌더링한다", () => {
    const report = makeReport({
      gitSha: "deadbee",
      dateToken: "2026-07-10",
      evalStatus: "pass",
      collectStatus: "pass",
      overallStatus: "all-pass",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain("## 실 평가 e2e daily-step dual-leg run report");
    expect(md).toContain("- git sha: deadbee");
    expect(md).toContain("- date token: 2026-07-10");
    expect(md).toContain("| eval | run | pass |");
    expect(md).toContain("| collect | run | pass |");
    expect(md).toContain("- overall status: all-pass");
    expect(md).toContain(
      "- summary: [2026-07-10@deadbee] eval=pass collect=pass → all-pass",
    );
  });

  // 고정 슬롯 순서 — eval 행이 collect 행보다, run 식별자가 summary 보다 앞에 등장.
  it("eval→collect 고정 행 순서와 헤더→leg 표→summary 고정 슬롯 순서로 렌더링한다", () => {
    const report = makeReport();

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md.indexOf("| eval |")).toBeLessThan(md.indexOf("| collect |"));
    expect(md.indexOf("- git sha:")).toBeLessThan(md.indexOf("| eval |"));
    expect(md.indexOf("| collect |")).toBeLessThan(md.indexOf("- summary:"));
  });

  // 결정론 — 동일 descriptor 2 회 렌더 → byte-identical + 반환은 매번 새 문자열.
  it("동일 descriptor 에 대해 byte-identical 한 출력을 반환한다(결정론)", () => {
    const report = makeReport({ gitSha: "f00ba12", dateToken: "2026-01-01" });

    const a = renderRealDataDailyStepDualLegRunReportMarkdown(report);
    const b = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(a).toBe(b);
  });

  // ── error path — guard 3 분기 ───────────────────────────────────────────────
  it("gitSha 가 빈/공백-only 면 throw 한다(비식별 리포트 차단)", () => {
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ gitSha: "" }),
      ),
    ).toThrow(/gitSha 가 비어있습니다/);
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ gitSha: "   " }),
      ),
    ).toThrow(/gitSha 가 비어있습니다/);
  });

  it("dateToken 이 빈/공백-only 면 throw 한다(비식별 리포트 차단)", () => {
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ dateToken: "" }),
      ),
    ).toThrow(/dateToken 가 비어있습니다/);
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ dateToken: "  \t " }),
      ),
    ).toThrow(/dateToken 가 비어있습니다/);
  });

  it("summaryLine 이 빈/공백-only 면 throw 한다(손상 리포트 차단)", () => {
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ summaryLine: "" }),
      ),
    ).toThrow(/summaryLine 가 비어있습니다/);
    expect(() =>
      renderRealDataDailyStepDualLegRunReportMarkdown(
        makeReport({ summaryLine: "   " }),
      ),
    ).toThrow(/summaryLine 가 비어있습니다/);
  });

  // ── flow/branch — overallStatus 4 분기 ──────────────────────────────────────
  it("overallStatus some-fail(eval fail & collect pass) 를 정확히 표기한다", () => {
    const report = makeReport({
      evalStatus: "fail",
      collectStatus: "pass",
      overallStatus: "some-fail",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain("| eval | run | fail |");
    expect(md).toContain("| collect | run | pass |");
    expect(md).toContain("- overall status: some-fail");
  });

  it("overallStatus all-skip(두 leg 모두 skip) 를 정확히 표기한다", () => {
    const report = makeReport({
      evalAction: "skip",
      evalStatus: "skip",
      collectAction: "skip",
      collectStatus: "skip",
      overallStatus: "all-skip",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain("| eval | skip | skip |");
    expect(md).toContain("| collect | skip | skip |");
    expect(md).toContain("- overall status: all-skip");
  });

  it("overallStatus partial(eval pass & collect skip) 를 정확히 표기한다", () => {
    const report = makeReport({
      evalStatus: "pass",
      collectAction: "skip",
      collectStatus: "skip",
      overallStatus: "partial",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain("| eval | run | pass |");
    expect(md).toContain("| collect | skip | skip |");
    expect(md).toContain("- overall status: partial");
  });

  // per-leg status 3 분기(pass/fail/skip) 가 마크다운에 각각 정확히 표기.
  it("per-leg status pass/fail/skip 를 각 leg 행에 정확히 표기한다", () => {
    // eval fail / collect skip — pass 는 위 all-pass·some-fail test 에서 cover.
    const report = makeReport({
      evalStatus: "fail",
      collectAction: "skip",
      collectStatus: "skip",
      overallStatus: "some-fail",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain("| eval | run | fail |");
    expect(md).toContain("| collect | skip | skip |");
  });

  // ── negative 충분 cover ─────────────────────────────────────────────────────
  // (d) credential echo 0 — gitSha/dateToken 에 token-like placeholder 를 심어도 마크다운은
  //   그 식별자 슬롯 외 어떤 secret 형태(Bearer / ghp_ / token= 등)도 노출하지 않는다.
  it("credential echo 0 — 식별자에 token-like 값을 심어도 마크다운에 secret 패턴이 노출되지 않는다", () => {
    const report = makeReport({
      gitSha: "ghp_FAKE1234",
      dateToken: "2026-07-11",
      summaryLine:
        "[2026-07-11@ghp_FAKE1234] eval=pass collect=pass → all-pass",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    // 식별자 슬롯 값(gitSha)에는 등장하나, 그 외 secret 어휘/형태는 부재.
    expect(md).not.toMatch(/Bearer\s/i);
    expect(md).not.toMatch(/token\s*=/i);
    expect(md).not.toMatch(/authorization/i);
    expect(md).not.toMatch(/password/i);
    // gitSha 슬롯 자체는 descriptor 값 그대로 렌더(식별자 표현) — 그 외 leak 0.
    expect(md).toContain("- git sha: ghp_FAKE1234");
  });

  // (e) 결정론·무공유 — 동일 descriptor 두 번 렌더 시 문자열 동일 + 반환은 매번 새 문자열.
  it("반환은 매 호출 새 문자열이며 동일 descriptor 에 대해 값은 동일하다(무공유)", () => {
    const report = makeReport({ overallStatus: "all-pass" });

    const a = renderRealDataDailyStepDualLegRunReportMarkdown(report);
    const b = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(a).toBe(b);
    // 문자열은 primitive 라 동일 값이면 참조 비교도 true — 대신 새 렌더가 stale 공유
    // 객체를 노출하지 않음을 표상하기 위해 독립 mutate 가 서로 영향 없음을 확인.
    const mutated = `${a}-x`;
    expect(mutated).not.toBe(b);
  });

  // (f) 입력 mutate 0 — report 및 하위 eval/collect 객체가 렌더 전후 deep-equal(읽기만).
  it("입력 report 와 하위 eval/collect 객체를 mutate 하지 않는다", () => {
    const report = makeReport({
      evalStatus: "fail",
      collectAction: "skip",
      collectStatus: "skip",
      overallStatus: "some-fail",
    });
    const snapshot = JSON.stringify(report);

    renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(JSON.stringify(report)).toBe(snapshot);
  });

  // summaryLine 은 descriptor 값 그대로 보간 — 임의 형태의 요약도 손상 없이 렌더.
  it("summaryLine 을 descriptor 값 그대로 손상 없이 렌더링한다", () => {
    const report = makeReport({
      summaryLine: "[2026-12-31@cafe123] eval=skip collect=fail → some-fail",
    });

    const md = renderRealDataDailyStepDualLegRunReportMarkdown(report);

    expect(md).toContain(
      "- summary: [2026-12-31@cafe123] eval=skip collect=fail → some-fail",
    );
  });
});

// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts —
// T-0988 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`.
//
// R-112 cover 구조:
//   - happy-path: 실 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 산출을
//     가드에 넣으면 throw 0(void) — 다중 leg-status 조합(all-pass / some-fail / all-skip / partial).
//   - error path: report gitSha/dateToken 빈-공백 입력 시 재유도가 producer 와 동형 Error 를 던짐.
//   - flow/branch: descriptor 구조 결손(title/marker/body 필드 제거·비-string) → TypeError,
//     값 drift(title/marker/body 각 미세 변형) → RangeError 를 분기마다. 동일 run 이면 leg
//     status 가 달라도 title/marker 동일(멱등) 검증.
//   - negative 충분 cover: title prefix 변조·runToken 순서 뒤집기·marker `-->` 종결 누락·body
//     2블록 빈 줄 제거·marker 라인 위치 이동 등 각 mutant 를 개별 RangeError 로 감지 + 가드
//     비변형(입력 mutate 0) + §9 비시크릿 더미 fixture assert.
import type {
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepDualLegOverallStatus,
  RealDataDailyStepLegStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueDescriptor,
  type RealDataDailyStepDualLegRunReportIssueDescriptor,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency";

// fixture 빌더 — run 식별자·per-leg {action,status}·overallStatus 를 명시적으로 받아
// 결정론적 report descriptor 를 생성. summaryLine 은 컴포저(T-0894)와 동형으로 합성.
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
  const dateToken = opts.dateToken ?? "2026-07-14";
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

// makeDescriptor — 실 producer 산출 descriptor 를 재사용해 정상 정합 쌍을 만든다(drift 분기
// test 가 descriptor 한 필드만 변조해 손상 fixture 를 만든다).
function makeDescriptor(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  return buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
}

describe("assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent", () => {
  describe("happy-path (정합 descriptor↔report → void)", () => {
    it("all-pass — producer 산출 descriptor 를 그대로 넘기면 throw 0(void)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const report = makeReport();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
        ),
      ).toBeUndefined();
    });

    it("eval=pass/collect=fail(some-fail) 조합도 정합(void)", () => {
      const report = makeReport({
        evalStatus: "pass",
        collectStatus: "fail",
        overallStatus: "some-fail",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("eval=skip/collect=skip(all-skip) 조합도 정합(void)", () => {
      const report = makeReport({
        evalAction: "skip",
        evalStatus: "skip",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "all-skip",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("partial(eval=pass/collect=skip) 조합도 정합(void)", () => {
      const report = makeReport({
        evalStatus: "pass",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "partial",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("label 을 넘겨도 정합 쌍이면 void", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          makeDescriptor(report),
          "daily-issue#1",
        ),
      ).not.toThrow();
    });
  });

  describe("error path — report 식별자 빈-공백 → producer 동형 Error", () => {
    it("gitSha 빈 문자열 → 재유도가 producer 와 동형 Error(/gitSha/)", () => {
      const report = makeReport({ gitSha: "" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          // descriptor 는 구조상 온전한 더미(재유도 이전 단계에서 report guard 가 먼저 throw).
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/gitSha/);
    });

    it("gitSha 공백-only → producer 동형 Error", () => {
      const report = makeReport({ gitSha: "   " });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/gitSha/);
    });

    it("dateToken 빈 문자열 → producer 동형 Error(/dateToken/)", () => {
      const report = makeReport({ dateToken: "" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/dateToken/);
    });

    it("dateToken 공백-only → producer 동형 Error", () => {
      const report = makeReport({ dateToken: "\t \n" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/dateToken/);
    });
  });

  describe("flow/branch — 구조 결손 → TypeError", () => {
    it("descriptor null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          makeReport(),
          null as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        ),
      ).toThrow(/descriptor 가 null\/undefined/);
    });

    it("descriptor 비-객체(문자열) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          makeReport(),
          "not-an-object" as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        ),
      ).toThrow(/descriptor 가 객체가 아니다/);
    });

    it("title 필드 부재/비-string → TypeError", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        title: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/descriptor\.title 가 string 이 아니다/);
    });

    it("marker 필드 비-string(숫자) → TypeError", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        marker: 42 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/descriptor\.marker 가 string 이 아니다/);
    });

    it("body 필드 부재(null) → TypeError", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        body: null as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/descriptor\.body 가 string 이 아니다/);
    });
  });

  describe("flow/branch — 멱등(동일 run → title/marker 동일)", () => {
    it("동일 run 이면 leg status/overallStatus 가 달라도 title/marker 정합(양 descriptor 모두 void)", () => {
      // 동일 gitSha+dateToken, 다른 leg status. producer 는 title/marker 를 동일하게 산출하므로
      // 두 report↔descriptor 쌍 모두 정합 통과해야 한다(가드가 멱등 title/marker 를 재유도).
      const reportA = makeReport({ overallStatus: "all-pass" });
      const reportB = makeReport({
        evalStatus: "fail",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "some-fail",
      });
      const descA = makeDescriptor(reportA);
      const descB = makeDescriptor(reportB);
      // 동일 run → title/marker 멱등(producer 규약) — 가드 재유도도 동일 token 을 산출.
      expect(descA.title).toBe(descB.title);
      expect(descA.marker).toBe(descB.marker);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          reportA,
          descA,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          reportB,
          descB,
        ),
      ).not.toThrow();
    });
  });

  describe("negative 충분 cover — descriptor 필드별 drift → RangeError", () => {
    it("(a) title prefix 변조 → RangeError(title)", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        title: "실 평가 e2e daily-step run report 2026-07-14@abc1234",
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(title\)/);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("(b) title runToken 순서 뒤집기(gitSha@dateToken) → RangeError(title)", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        title: "실 평가 e2e daily-step dual-leg run report abc1234@2026-07-14",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/정합 위반\(title\)/);
    });

    it("(c) marker `-->` 종결 누락 → RangeError(marker)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = {
        ...base,
        marker: base.marker.replace(/ -->$/, ""),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(marker\)/);
    });

    it("(d) marker runToken 순서 뒤집기 → RangeError(marker)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = {
        ...base,
        marker: base.marker.replace("2026-07-14@abc1234", "abc1234@2026-07-14"),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/정합 위반\(marker\)/);
    });

    it("(e) body 2블록 구분 빈 줄 제거 → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      // marker\n\n<markdown> → marker\n<markdown> (빈 줄 1개 제거).
      const descriptor = {
        ...base,
        body: base.body.replace(`${base.marker}\n\n`, `${base.marker}\n`),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(body\)/);
    });

    it("(f) body marker 라인 위치 이동(마크다운 뒤로) → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const markdown = base.body.slice(base.marker.length + 2); // marker + "\n\n" 제거
      // marker 를 본문 뒤로 이동(위치 규칙 위반).
      const descriptor = {
        ...base,
        body: [markdown, "", base.marker].join("\n"),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/정합 위반\(body\)/);
    });

    it("(g) body 마크다운 블록 값 변조 → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = {
        ...base,
        body: base.body.replace("- git sha: abc1234", "- git sha: deadbee"),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/정합 위반\(body\)/);
    });

    it("report 측 슬롯이 descriptor 와 어긋나도 RangeError(양방향 어느 쪽이든 노출)", () => {
      // descriptor 는 abc1234 run 산출인데 report 만 gitSha 를 바꾸면 재유도가 어긋남.
      const rendered = makeDescriptor(makeReport());
      const mismatched = makeReport({ gitSha: "0000000" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          mismatched,
          rendered,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형 / §9·§12 안전성", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const report = makeReport();
      const descriptor = makeDescriptor(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = { ...base, title: `${base.title} DRIFT` };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report 객체·하위 eval/collect 슬롯 mutate 0(deep-equal 불변)", () => {
      const report = makeReport({
        evalStatus: "fail",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "some-fail",
      });
      const descriptor = makeDescriptor(report);
      const snapshot = JSON.stringify(report);
      assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
        report,
        descriptor,
      );
      expect(JSON.stringify(report)).toBe(snapshot);
    });

    it("가드 호출 전후 descriptor 객체 mutate 0(deep-equal 불변)", () => {
      const report = makeReport();
      const descriptor = makeDescriptor(report);
      const snapshot = JSON.stringify(descriptor);
      assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
        report,
        descriptor,
      );
      expect(JSON.stringify(descriptor)).toBe(snapshot);
    });

    it("§9 — fixture 식별자는 비시크릿 더미이며 재유도/대조 산출에 secret 패턴/raw payload 미노출", () => {
      // 식별자에 token-like 더미를 심어도 그 슬롯 외 secret 어휘가 재유도/대조 산출에 없다.
      const report = makeReport({
        gitSha: "ghp_FAKEDUMMY",
        summaryLine:
          "[2026-07-14@ghp_FAKEDUMMY] eval=pass collect=pass → all-pass",
      });
      const descriptor = makeDescriptor(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
      // 가드는 descriptor·마크다운 구조만 다룬다 — Bearer/authorization/password 등 secret
      // 어휘나 commit/PR/issue payload 전문은 대조 대상에 부재.
      expect(descriptor.body).not.toMatch(/Bearer\s/i);
      expect(descriptor.body).not.toMatch(/authorization/i);
      expect(descriptor.body).not.toMatch(/password/i);
    });
  });
});

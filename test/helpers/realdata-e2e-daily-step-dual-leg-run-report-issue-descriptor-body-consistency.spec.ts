// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.spec.ts —
// T-0988 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent`
// (T-1026 에서 body-focus 로 축소 — title·marker 식별자 재유도·대조는 identity oracle
// T-1024 로 위임, 본 가드는 body 2 블록 구조[marker 라인 → 빈 줄 → markdown] 만 검증).
//
// R-112 cover 구조:
//   - happy-path: 실 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 산출을
//     가드에 넣으면 throw 0(void) — 다중 leg-status 조합(all-pass / some-fail / all-skip / partial).
//   - error path: report gitSha/dateToken 빈-공백 입력 시 재유도가 producer 와 동형 Error 를 던짐.
//   - flow/branch: descriptor 구조 결손(marker/body 필드 제거·비-string) → TypeError,
//     body 2 블록 구조 drift(최소 라인 미달 / marker 첫라인 불일치 / 빈 줄 구분 결손 / 마크다운
//     블록 변조) → RangeError 를 분기마다. 동일 run 이면 leg status 가 달라도 body/marker 정합.
//   - negative 충분 cover: body markdown 블록 drift·2블록 빈 줄 제거·marker 라인 위치 이동·
//     marker 첫라인 불일치·min-length 미달 등 각 mutant 를 개별 RangeError 로 감지 + 가드
//     비변형(입력 mutate 0) + §9 비시크릿 더미 fixture assert.
//   - 회귀 방지(T-1026 축소 못 박기): title 이 drift 해도 본 body-focus 가드는 통과(title 은
//     이제 검증하지 않음 — identity oracle T-1024 가 별도로 잡음). marker 합성 규칙(prefix·
//     runToken·`-->`)이 틀려도 body 첫 라인과 일치하기만 하면 통과(marker 합성 검증은 identity
//     oracle 위임 — 본 가드는 body 안 marker 라인 위치만 확인).
import type {
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepDualLegOverallStatus,
  RealDataDailyStepLegStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueDescriptor,
  type RealDataDailyStepDualLegRunReportIssueDescriptor,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency";

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

describe("assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent (body-focus)", () => {
  describe("happy-path (정합 descriptor↔report → void)", () => {
    it("all-pass — producer 산출 descriptor 를 그대로 넘기면 throw 0(void)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const report = makeReport();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          makeDescriptor(report),
        ),
      ).not.toThrow();
    });

    it("label 을 넘겨도 정합 쌍이면 void", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          makeDescriptor(report),
          "daily-issue#1",
        ),
      ).not.toThrow();
    });

    it("빈 문자열 label 도 정합 쌍이면 void (contextPrefix 빈-label 분기)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          makeDescriptor(report),
          "",
        ),
      ).not.toThrow();
    });
  });

  describe("error path — report 식별자 빈-공백 → producer 동형 Error", () => {
    it("gitSha 빈 문자열 → 재유도가 producer 와 동형 Error(/gitSha/)", () => {
      const report = makeReport({ gitSha: "" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          // descriptor 는 구조상 온전한 더미(재유도 이전 단계에서 report guard 가 먼저 throw).
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/gitSha/);
    });

    it("gitSha 공백-only → producer 동형 Error", () => {
      const report = makeReport({ gitSha: "   " });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/gitSha/);
    });

    it("dateToken 빈 문자열 → producer 동형 Error(/dateToken/)", () => {
      const report = makeReport({ dateToken: "" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/dateToken/);
    });

    it("dateToken 공백-only → producer 동형 Error", () => {
      const report = makeReport({ dateToken: "\t \n" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          { title: "x", marker: "y", body: "z" },
        ),
      ).toThrow(/dateToken/);
    });
  });

  describe("flow/branch — 구조 결손 → TypeError", () => {
    it("descriptor null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          makeReport(),
          null as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        ),
      ).toThrow(/descriptor 가 null\/undefined/);
    });

    it("descriptor 비-객체(문자열) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          makeReport(),
          "not-an-object" as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        ),
      ).toThrow(/descriptor 가 객체가 아니다/);
    });

    it("marker 필드 비-string(숫자) → TypeError", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        marker: 42 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/descriptor\.body 가 string 이 아니다/);
    });

    it("body 필드 비-string(숫자) → TypeError", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        body: 7 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).toThrow(/descriptor\.body 가 string 이 아니다/);
    });
  });

  describe("flow/branch — 멱등(동일 run → body/marker 동일)", () => {
    it("동일 run 이면 leg status/overallStatus 가 달라도 body/marker 정합(양 descriptor 모두 void)", () => {
      // 동일 gitSha+dateToken, 다른 leg status. producer 는 marker 를 동일하게 산출하므로
      // 두 report↔descriptor 쌍 모두 body-focus 정합 통과해야 한다.
      const reportA = makeReport({ overallStatus: "all-pass" });
      const reportB = makeReport({
        evalStatus: "fail",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "some-fail",
      });
      const descA = makeDescriptor(reportA);
      const descB = makeDescriptor(reportB);
      // 동일 run → marker 멱등(producer 규약). body 첫 라인(=marker)도 동일.
      expect(descA.marker).toBe(descB.marker);
      expect(descA.body.split("\n")[0]).toBe(descB.body.split("\n")[0]);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          reportA,
          descA,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          reportB,
          descB,
        ),
      ).not.toThrow();
    });
  });

  describe("negative 충분 cover — body 2 블록 구조 drift → RangeError", () => {
    it("(min-length) body 라인 수 3 미달(단일 라인) → RangeError(body)", () => {
      const report = makeReport();
      const descriptor = {
        ...makeDescriptor(report),
        body: "single-line-body",
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/최소 3 라인/);
    });

    it("(a) body 마크다운 블록 값 변조 → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = {
        ...base,
        body: base.body.replace("- git sha: abc1234", "- git sha: deadbee"),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(body\)/);
      expect(run).toThrow(/byte-identical 하지 않다/);
    });

    it("(b) body 2블록 구분 빈 줄 제거 → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      // marker\n\n<markdown> → marker\n<markdown> (빈 줄 1개 제거).
      const descriptor = {
        ...base,
        body: base.body.replace(`${base.marker}\n\n`, `${base.marker}\n`),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(body\)/);
    });

    it("(c) marker 가 body 첫 라인과 불일치(marker 단독 변조) → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      // descriptor.marker 만 바꾸고 body 는 그대로 → body 첫 라인 != marker.
      const descriptor = {
        ...base,
        marker: `${base.marker} DRIFT`,
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/body 첫 라인이 descriptor\.marker 와 불일치/);
    });

    it("(d) body marker 라인 위치 이동(마크다운 뒤로) → RangeError(body)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const markdown = base.body.slice(base.marker.length + 2); // marker + "\n\n" 제거
      // marker 를 본문 뒤로 이동(위치 규칙 위반) — body 첫 라인이 marker 가 아니게 됨.
      const descriptor = {
        ...base,
        body: [markdown, "", base.marker].join("\n"),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(body\)/);
    });

    it("report 측 슬롯이 descriptor 와 어긋나면 마크다운 재유도가 drift → RangeError(body)", () => {
      // descriptor 는 abc1234 run 산출인데 report 만 gitSha 를 바꾸면 마크다운 재유도가 어긋남.
      const rendered = makeDescriptor(makeReport());
      const mismatched = makeReport({ gitSha: "0000000" });
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          mismatched,
          rendered,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(body\)/);
    });
  });

  describe("회귀 방지 — T-1026 body-focus 축소(title·marker 식별자 검증은 identity oracle 위임)", () => {
    it("title 이 drift 해도 body-focus 가드는 통과(title 은 이제 미검증 — identity oracle 이 별도로 잡음)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      // title 만 변조 — body/marker 는 그대로. body-focus 가드는 title 을 검증하지 않으므로 통과.
      const descriptor = {
        ...base,
        title: `${base.title} DRIFT`,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("marker 합성 규칙이 틀려도 body 첫 라인과 일치하면 통과(marker 합성 검증은 identity oracle 위임)", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      // marker 를 잘못된(하지만 body 첫 라인과 일관된) 값으로 바꿈 — prefix·runToken·`-->`
      // 규칙이 어긋나도 body 첫 라인 == marker 이기만 하면 body-focus 가드는 통과.
      // marker 합성 규칙 위반은 identity oracle(T-1024)이 별도로 catch.
      const wrongMarker = "<!-- wrong-composed-marker -->";
      const markdown = base.body.slice(base.marker.length + 2);
      const descriptor = {
        ...base,
        marker: wrongMarker,
        body: [wrongMarker, "", markdown].join("\n"),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
    });
  });

  describe("결정성 / 비변형 / §9·§12 안전성", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const report = makeReport();
      const descriptor = makeDescriptor(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
          report,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const report = makeReport();
      const base = makeDescriptor(report);
      const descriptor = {
        ...base,
        body: base.body.replace(`${base.marker}\n\n`, `${base.marker}\n`),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
      assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
        report,
        descriptor,
      );
      expect(JSON.stringify(report)).toBe(snapshot);
    });

    it("가드 호출 전후 descriptor 객체 mutate 0(deep-equal 불변)", () => {
      const report = makeReport();
      const descriptor = makeDescriptor(report);
      const snapshot = JSON.stringify(descriptor);
      assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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
        assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
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

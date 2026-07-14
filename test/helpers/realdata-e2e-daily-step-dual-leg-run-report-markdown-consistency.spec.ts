// realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.spec.ts — T-0986
// colocated unit spec for `assertRealDataDailyStepDualLegRunReportMarkdownConsistent`.
//
// R-112 cover 구조:
//   - happy-path: 렌더러(`renderRealDataDailyStepDualLegRunReportMarkdown`)를 producer 로
//     호출해 얻은 정합 마크다운(다중 leg-status 조합 fixture)에 대해 가드가 throw 0(void).
//   - error path: markdown 비-string / report 구조 결손(비-객체·null / gitSha 비-string /
//     eval 결손 / overallStatus 결손) → 각 TypeError 1+.
//   - flow/branch: per-leg status 3종(pass/fail/skip) · overallStatus 4종(all-pass/
//     some-fail/all-skip/partial) · eval→collect 고정 행 순서(입력 키 순서 무관) 각 정합 통과.
//   - negative 충분 cover: producer 정합 마크다운을 얕은 복제 후 한 조각만 손상 → 각 RangeError
//     (헤더 문구 · git sha · date token · overall status · leg 표 슬롯 · eval↔collect 순서 ·
//     표 헤더/구분선 · summary) + 비식별 식별자(빈-공백) → TypeError. 각 1+.
//   - §9 / §12: fixture 에 실 secret/PAT/credential 실 값 미노출(더미 string), raw 활동 본문
//     저장 0(가드는 report descriptor·마크다운 구조만 다룸) assert.
import type {
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepDualLegOverallStatus,
  RealDataDailyStepLegStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";
import { assertRealDataDailyStepDualLegRunReportMarkdownConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency";

// fixture 빌더 — run 식별자·per-leg {action,status}·overallStatus 를 명시적으로 받아
// 결정론적 descriptor 를 생성(spec 내 인라인 구성). 기본값은 all-pass 완전 descriptor 이며
// opts 로 각 슬롯을 덮어쓴다. summaryLine 은 렌더러 컴포저(T-0894)와 동형으로 합성.
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

// makeMarkdown — 렌더러 실제 산출 마크다운을 재사용해 정상 정합 쌍을 만든다(drift 분기
// test 가 마크다운 한쪽만 변조해 손상 fixture 를 만든다).
function makeMarkdown(report: RealDataDailyStepDualLegRunReport): string {
  return renderRealDataDailyStepDualLegRunReportMarkdown(report);
}

describe("assertRealDataDailyStepDualLegRunReportMarkdownConsistent", () => {
  describe("happy-path (정합 markdown↔report → void)", () => {
    it("all-pass(eval run/pass & collect run/pass) — 렌더러 산출 마크다운을 그대로 넘기면 throw 0(void)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const report = makeReport();
      expect(
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
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
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
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
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
        ),
      ).not.toThrow();
    });

    it("label 을 넘겨도 정합 쌍이면 void", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
          "daily-report#1",
        ),
      ).not.toThrow();
    });
  });

  describe("flow/branch — per-leg status 3종 / overallStatus 4종 / eval→collect 순서", () => {
    it("per-leg status pass/fail/skip 3종이 표 행에 정확히 반영된 정합 통과", () => {
      // eval=pass · collect=fail 을 한 fixture 로, 별도로 skip 을 다른 fixture 로 cover.
      const mixed = makeReport({
        evalStatus: "pass",
        collectStatus: "fail",
        overallStatus: "some-fail",
      });
      const skipped = makeReport({
        evalAction: "skip",
        evalStatus: "skip",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "all-skip",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          mixed,
          makeMarkdown(mixed),
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          skipped,
          makeMarkdown(skipped),
        ),
      ).not.toThrow();
    });

    it("overallStatus 4종(all-pass/some-fail/all-skip/partial) 각 정합 통과", () => {
      const cases: Array<{
        overallStatus: RealDataDailyStepDualLegOverallStatus;
        evalStatus: RealDataDailyStepLegStatus;
        collectStatus: RealDataDailyStepLegStatus;
        evalAction?: "run" | "skip";
        collectAction?: "run" | "skip";
      }> = [
        {
          overallStatus: "all-pass",
          evalStatus: "pass",
          collectStatus: "pass",
        },
        {
          overallStatus: "some-fail",
          evalStatus: "fail",
          collectStatus: "pass",
        },
        {
          overallStatus: "all-skip",
          evalStatus: "skip",
          collectStatus: "skip",
          evalAction: "skip",
          collectAction: "skip",
        },
        {
          overallStatus: "partial",
          evalStatus: "pass",
          collectStatus: "skip",
          collectAction: "skip",
        },
      ];
      for (const c of cases) {
        const report = makeReport(c);
        expect(() =>
          assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
            report,
            makeMarkdown(report),
          ),
        ).not.toThrow();
      }
    });

    it("입력 키 순서가 eval→collect 와 달라도 재유도가 고정 행 순서로 정합 통과", () => {
      // collect/eval 키를 역순으로 선언한 report — 재유도는 항상 eval→collect 고정 순서.
      const report: RealDataDailyStepDualLegRunReport = {
        collect: { action: "run", status: "fail" },
        eval: { action: "run", status: "pass" },
        summaryLine: "[2026-07-11@abc1234] eval=pass collect=fail → some-fail",
        overallStatus: "some-fail",
        dateToken: "2026-07-11",
        gitSha: "abc1234",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(report),
        ),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손 → TypeError", () => {
    it("markdown 비-string(숫자) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          makeReport(),
          7 as unknown as string,
        ),
      ).toThrow(/markdown 이 string 이 아니다/);
    });

    it("markdown null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          makeReport(),
          null as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          null as unknown as RealDataDailyStepDualLegRunReport,
          "## 실 평가 e2e daily-step dual-leg run report",
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("report 비-객체(문자열) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          "not-an-object" as unknown as RealDataDailyStepDualLegRunReport,
          "irrelevant",
        ),
      ).toThrow(/report 가 객체가 아니다/);
    });

    it("gitSha 비-string(숫자) → TypeError", () => {
      const report = {
        ...makeReport(),
        gitSha: 123 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.gitSha 가 string 이 아니다/);
    });

    it("dateToken 비-string → TypeError", () => {
      const report = {
        ...makeReport(),
        dateToken: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.dateToken 가 string 이 아니다/);
    });

    it("overallStatus 결손(비-string) → TypeError", () => {
      const report = {
        ...makeReport(),
        overallStatus:
          undefined as unknown as RealDataDailyStepDualLegOverallStatus,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.overallStatus 가 string 이 아니다/);
    });

    it("summaryLine 비-string → TypeError", () => {
      const report = {
        ...makeReport(),
        summaryLine: 42 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.summaryLine 가 string 이 아니다/);
    });

    it("eval 결손(null) → TypeError", () => {
      const report = {
        ...makeReport(),
        eval: null as unknown as RealDataDailyStepDualLegRunReport["eval"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.eval 가 누락된\/비-객체/);
    });

    it("collect 결손(비-객체) → TypeError", () => {
      const report = {
        ...makeReport(),
        collect:
          "run" as unknown as RealDataDailyStepDualLegRunReport["collect"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          makeMarkdown(makeReport()),
        ),
      ).toThrow(/report\.collect 가 누락된\/비-객체/);
    });

    it("gitSha 빈/공백-only(비식별 리포트) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          makeReport({ gitSha: "   " }),
          "irrelevant",
        ),
      ).toThrow(/report\.gitSha 가 비어있습니다/);
    });

    it("dateToken 빈-only(비식별 리포트) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          makeReport({ dateToken: "" }),
          "irrelevant",
        ),
      ).toThrow(/report\.dateToken 가 비어있습니다/);
    });

    it("summaryLine 공백-only(손상 리포트) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          makeReport({ summaryLine: "  \t " }),
          "irrelevant",
        ),
      ).toThrow(/report\.summaryLine 가 비어있습니다/);
    });
  });

  describe("negative 충분 cover — markdown 슬롯별 drift → RangeError", () => {
    it("(a) 헤더 문구 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "## 실 평가 e2e daily-step dual-leg run report",
        "## 실 평가 e2e daily-step run report",
      );
      const run = () =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("(b) `- git sha:` 값 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "- git sha: abc1234",
        "- git sha: deadbee",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(c) `- date token:` 값 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "- date token: 2026-07-11",
        "- date token: 1999-01-01",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(d) `- overall status:` 값 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "- overall status: all-pass",
        "- overall status: some-fail",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(e) leg 표 행의 action/status 슬롯 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "| eval | run | pass |",
        "| eval | run | fail |",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(f) eval↔collect 행 순서 뒤바꿈 → RangeError", () => {
      // eval=pass / collect=fail 로 두 행을 구분 가능하게 만든 뒤 순서만 swap.
      const report = makeReport({
        evalStatus: "pass",
        collectStatus: "fail",
        overallStatus: "some-fail",
      });
      const md = makeMarkdown(report);
      const evalRow = "| eval | run | pass |";
      const collectRow = "| collect | run | fail |";
      // 두 행을 임시 placeholder 로 치환 후 서로 자리 교환.
      const drifted = md
        .replace(evalRow, " EVAL ")
        .replace(collectRow, evalRow)
        .replace(" EVAL ", collectRow);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(g) 표 헤더/구분선 리터럴 변형 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "| leg | action | status |",
        "| leg | action | 결과 |",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(g') 표 구분선 리터럴 변형 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "| --- | --- | --- |",
        "| :-- | :-: | --: |",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(h) `- summary:` 값 변조 → RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "eval=pass collect=pass → all-pass",
        "eval=fail collect=fail → some-fail",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("report 측 슬롯 값이 markdown 과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      // markdown 은 all-pass 산출인데 report 만 overallStatus 를 바꾸면 재유도가 어긋남.
      const rendered = makeMarkdown(makeReport());
      const mismatched = makeReport({ overallStatus: "partial" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          mismatched,
          rendered,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형 / §9·§12 안전성", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const report = makeReport();
      const markdown = makeMarkdown(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          markdown,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          markdown,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const report = makeReport();
      const drifted = makeMarkdown(report).replace(
        "- git sha: abc1234",
        "- git sha: 0000000",
      );
      const run = () =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          drifted,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report 객체·하위 eval/collect 슬롯 mutate 0 (deep-equal 불변)", () => {
      const report = makeReport({
        evalStatus: "fail",
        collectAction: "skip",
        collectStatus: "skip",
        overallStatus: "some-fail",
      });
      const markdown = makeMarkdown(report);
      const snapshot = JSON.stringify(report);
      assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
        report,
        markdown,
      );
      expect(JSON.stringify(report)).toBe(snapshot);
    });

    it("가드 호출 전후 markdown 문자열 불변(원본 동일)", () => {
      const report = makeReport();
      const markdown = makeMarkdown(report);
      const markdownSnapshot = markdown;
      assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
        report,
        markdown,
      );
      expect(markdown).toBe(markdownSnapshot);
    });

    it("§9/§12 — fixture 식별자는 비시크릿 더미이며 마크다운에 secret 패턴/raw payload 미노출", () => {
      // 식별자에 token-like 더미를 심어도 그 슬롯 외 secret 어휘가 재유도/대조 산출에 없다.
      const report = makeReport({
        gitSha: "ghp_FAKEDUMMY",
        summaryLine:
          "[2026-07-11@ghp_FAKEDUMMY] eval=pass collect=pass → all-pass",
      });
      const markdown = makeMarkdown(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
          report,
          markdown,
        ),
      ).not.toThrow();
      // 가드는 descriptor·마크다운 구조만 다룬다 — Bearer/authorization/password 등 secret
      // 어휘나 commit/PR/issue payload 전문은 대조 대상에 부재.
      expect(markdown).not.toMatch(/Bearer\s/i);
      expect(markdown).not.toMatch(/authorization/i);
      expect(markdown).not.toMatch(/password/i);
    });
  });
});

// realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts —
// T-0903 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 단일 URL 줄, (b) trailing 개행 포함 URL 줄, (c) 여러 줄 중 URL
//     줄 포함(gh 부가 메시지 + URL) → 각 `{issueNumber, url}` 정확 추출.
//   - error path: (a) URL 미포함(빈/무관 텍스트) → throw, (b) 비-github 호스트 → throw,
//     (c) `/pull/` 경로 → throw, (d) issueNumber 비양수(`/issues/0`, `/issues/abc`)
//     → throw 각 별도 case.
//   - flow/branch: URL 발견/미발견 분기 + number 검증 통과/실패 분기 + 다중 줄 vs 단일
//     줄 분기 각 1+.
//   - negative 충분 cover(분기마다): 빈 stdout / 공백-only / URL 형식 깨짐(번호 누락) /
//     number 0·음수·선행 0·비정수 / 비-github 호스트 / `/pull/` 경로 / 앞뒤 공백·탭·개행
//     혼입 각 1+.
//   - 결정론·무공유: 동일 stdout 2 회 호출 → deep-equal, 매 호출 새 객체.
//   - R-59: 출력 키가 {issueNumber, url} 만 — 입력 외 데이터 생성 0.
import {
  parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput,
  type RealDataDailyStepDualLegRunReportIssueOutcome,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

describe("parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput — gh create/edit stdout → outcome 순수 파서", () => {
  describe("happy-path (정상 파싱)", () => {
    it("단일 URL 줄 stdout 을 {issueNumber, url} 로 파싱한다", () => {
      const stdout = "https://github.com/owner/repo/issues/42";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 42,
        url: "https://github.com/owner/repo/issues/42",
      });
    });

    it("trailing 개행 포함 URL 줄에서 url 을 trim 해 파싱한다", () => {
      const stdout = "https://github.com/owner/repo/issues/7\n";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 7,
        url: "https://github.com/owner/repo/issues/7",
      });
      // trailing 개행이 url 에 새지 않는다(정규화).
      expect(outcome.url.endsWith("7")).toBe(true);
    });

    it("여러 줄 중 URL 줄을 포함(gh 부가 메시지 + URL)해도 URL 을 추출한다", () => {
      const stdout = [
        "Creating issue in owner/repo",
        "https://github.com/owner/repo/issues/128",
        "",
      ].join("\n");

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 128,
        url: "https://github.com/owner/repo/issues/128",
      });
    });

    it("gh issue edit 형태(여러 줄 부가 메시지 뒤 URL)도 파싱한다", () => {
      const stdout =
        "Editing issue #128\nhttps://github.com/some-org/my-repo/issues/128\n";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 128,
        url: "https://github.com/some-org/my-repo/issues/128",
      });
    });
  });

  describe("다중 줄 첫-매칭 결정론", () => {
    it("여러 URL 줄이 있으면 첫 매칭 URL 을 결정론적으로 사용한다", () => {
      const stdout = [
        "https://github.com/owner/repo/issues/10",
        "https://github.com/owner/repo/issues/20",
      ].join("\n");

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 10,
        url: "https://github.com/owner/repo/issues/10",
      });
    });
  });

  describe("error path (URL 미발견 / 형태 오류)", () => {
    it("빈 문자열이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(""),
      ).toThrow(/issue URL/);
    });

    it("무관 텍스트(URL 미포함)면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "issue 생성에 실패했습니다",
        ),
      ).toThrow(/issue URL/);
    });

    it("비-github 호스트 URL 이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://gitlab.com/owner/repo/issues/42",
        ),
      ).toThrow(/issue URL/);
    });

    it("`/pull/` 경로(비-issue)면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/pull/42",
        ),
      ).toThrow(/issue URL/);
    });

    it("issue 번호가 없는 깨진 URL(…/issues/)이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/",
        ),
      ).toThrow(/issue URL/);
    });
  });

  describe("negative — issueNumber 검증", () => {
    it("issue 번호가 0 이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/0",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("issue 번호가 선행 0(007)이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/007",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("issue 번호 자리가 비숫자(abc)면 URL 매칭 실패로 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/abc",
        ),
      ).toThrow(/issue URL/);
    });
  });

  describe("negative — 공백·탭·개행 혼입", () => {
    it("공백-only stdout 이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "   \t\n  ",
        ),
      ).toThrow(/issue URL/);
    });

    it("URL 앞뒤에 탭·공백·개행이 섞여 있어도 URL 만 추출한다", () => {
      const stdout = "\t  https://github.com/owner/repo/issues/55  \n\n";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 55,
        url: "https://github.com/owner/repo/issues/55",
      });
    });

    it("URL 뒤에 비숫자가 바로 붙으면(…/issues/42x) issueNumber 오염을 막고 매칭 실패로 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/42x",
        ),
      ).toThrow(/issue URL/);
    });
  });

  describe("R-59 정합 (issueNumber/url 만 추출)", () => {
    it("출력 키가 {issueNumber, url} 만이다(본문/narrative 미보유)", () => {
      const stdout = "https://github.com/owner/repo/issues/9\n부가 본문 marker";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
    });
  });

  describe("결정론·무공유", () => {
    it("동일 stdout 두 번 호출 → deep-equal 결과를 산출한다(결정론)", () => {
      const stdout = "https://github.com/owner/repo/issues/33\n";

      const a =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);
      const b =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(a).toEqual(b);
    });

    it("매 호출 새 객체를 반환한다(무공유)", () => {
      const stdout = "https://github.com/owner/repo/issues/33";

      const a =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);
      const b =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(a).not.toBe(b);
    });

    it("반환 객체 mutate 가 다음 호출 결과에 누설되지 않는다(출력 객체 무공유)", () => {
      const stdout = "https://github.com/owner/repo/issues/33";

      const first: RealDataDailyStepDualLegRunReportIssueOutcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);
      first.issueNumber = 999;
      first.url = "mutated";

      const second =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);
      expect(second).toEqual({
        issueNumber: 33,
        url: "https://github.com/owner/repo/issues/33",
      });
    });
  });
});

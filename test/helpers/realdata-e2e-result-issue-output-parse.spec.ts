// realdata-e2e-result-issue-output-parse.spec.ts — T-0589 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 단일 URL 줄, (b) trailing 개행 포함 URL, (c) 여러 줄 중 URL 줄
//     포함(부가 메시지 섞임) 각각 {issueNumber, url} 정확 추출.
//   - error path: (a) URL 미포함(빈/무관 텍스트/비-github 호스트/`/pull/` 경로) → throw,
//     (b) number 비양수(`/issues/0`, 선행 0) / 번호 누락(`/issues/`) / 비숫자(`/issues/abc`)
//     → throw.
//   - flow/branch: URL 발견/미발견 분기 · number 검증 통과/실패 분기 · 다중 줄 vs 단일
//     줄 분기 각 1+.
//   - negative 충분 cover(분기마다): 빈 stdout / 공백-only / URL 번호 누락 / number 0·
//     선행0 / 비-github 호스트 / `/pull/` 경로 / 앞뒤 공백·탭·개행 혼입.
//   - 결정론·무공유: 동일 stdout 2 회 호출 → deep-equal, 매 호출 새 객체.
//   - R-59: 출력 키가 {issueNumber, url} 만(raw narrative 보유 0).
import { parseRealDataResultIssueCreateEditOutput } from "./realdata-e2e-result-issue-output-parse";

describe("parseRealDataResultIssueCreateEditOutput — gh issue create/edit stdout → outcome 순수 파서", () => {
  describe("happy-path (정상 파싱)", () => {
    it("단일 URL 줄 stdout 을 {issueNumber, url} 로 추출한다", () => {
      const stdout = "https://github.com/owner/repo/issues/42";

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 42,
        url: "https://github.com/owner/repo/issues/42",
      });
    });

    it("trailing 개행 포함 URL 을 trim 해 정규화한다", () => {
      const stdout = "https://github.com/owner/repo/issues/7\n";

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 7,
        url: "https://github.com/owner/repo/issues/7",
      });
    });

    it("여러 줄 중 URL 줄을 찾아 파싱한다(gh 부가 메시지 섞임)", () => {
      const stdout = [
        "Creating issue in owner/repo",
        "https://github.com/owner/repo/issues/123",
        "Done.",
      ].join("\n");

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 123,
        url: "https://github.com/owner/repo/issues/123",
      });
    });

    it("여러 URL 이 있으면 첫 매칭 URL 을 사용한다(결정론)", () => {
      const stdout = [
        "https://github.com/owner/repo/issues/10",
        "https://github.com/owner/repo/issues/20",
      ].join("\n");

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(outcome.issueNumber).toBe(10);
    });

    it("출력 키는 {issueNumber, url} 만이다(R-59 — raw narrative 보유 0)", () => {
      const outcome = parseRealDataResultIssueCreateEditOutput(
        "https://github.com/owner/repo/issues/5",
      );

      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
    });
  });

  describe("error path — URL 미발견 분기", () => {
    it("빈 stdout 이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueCreateEditOutput("")).toThrow(
        /issue URL.*찾지 못했습니다/,
      );
    });

    it("공백-only stdout 이면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput("   \n\t "),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });

    it("URL 무관 텍스트면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput("아무 관련 없는 메시지"),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });

    it("비-github 호스트 URL 이면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://gitlab.com/owner/repo/issues/42",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });

    it("/pull/ 경로(이슈 아님)면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/pull/42",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });

    it("/issues/ 뒤 번호 누락이면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });

    it("/issues/ 뒤가 비숫자(abc)면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/abc",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/);
    });
  });

  describe("error path — number 검증 분기", () => {
    it("번호가 0 이면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/0",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("번호에 선행 0(007)이 있으면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/007",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("negative — 공백·탭·개행 혼입", () => {
    it("앞뒤 공백·탭·개행이 혼입된 단일 URL 을 trim 해 파싱한다", () => {
      const stdout = "\t  https://github.com/owner/repo/issues/99  \n";

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(outcome).toEqual({
        issueNumber: 99,
        url: "https://github.com/owner/repo/issues/99",
      });
    });
  });

  describe("결정론·무공유", () => {
    it("동일 stdout 두 번 호출 → deep-equal 결과를 산출한다(결정론)", () => {
      const stdout = "https://github.com/owner/repo/issues/42\n";

      const a = parseRealDataResultIssueCreateEditOutput(stdout);
      const b = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(a).toEqual(b);
    });

    it("매 호출 새 객체를 반환한다(무공유)", () => {
      const stdout = "https://github.com/owner/repo/issues/42";

      const a = parseRealDataResultIssueCreateEditOutput(stdout);
      const b = parseRealDataResultIssueCreateEditOutput(stdout);

      expect(a).not.toBe(b);
    });
  });
});

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
import * as outcomeShapeModule from "./realdata-e2e-result-issue-outcome-parse-shape";
import { REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS } from "./realdata-e2e-result-issue-outcome-parse-shape";
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

  // T-0662 — outcome↔parse-shape 가드 producer self-wire 검증.
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 전후 산출 outcome byte-identical 보존 + self-assert throw 0.
  //   - self-wire 검증: 정상 outcome 산출 시 가드가 `(outcome, PARSE_SHAPE_KEYS)` 인자로
  //     매 호출 1회 호출됨을 spy 로 확인.
  //   - error path: 가드를 spy 로 강제 throw(TypeError 구조 결손 / RangeError set 불일치)
  //     시키면 producer 가 손상 outcome 을 반환하지 않고 그 에러를 propagate(fail-fast).
  //   - flow/branch: 기존 검증 분기(URL 미발견 throw / issueNumber 비양정수 throw)가
  //     self-assert 도달 전에 발생(검증 순서 보존) — 가드 미호출.
  //   - negative 충분 cover: (a) URL 미발견 throw 가 가드 도달 전, (b) issueNumber 0·선행0·
  //     비정수 throw 가 가드 도달 전, (c) 정상 outcome 가드 throw 0, (d) 매 정상 호출마다
  //     `["issueNumber","url"]` 인자 self-assert, (e) 입력 stdout 비변형(순수성 보존).
  describe("T-0662 — outcome↔parse-shape 가드 producer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 산출 outcome 이 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const stdout = "https://github.com/owner/repo/issues/42";

      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

      // self-wire 전과 동일 — {issueNumber, url} 만, 필드 순서 보존.
      expect(outcome).toEqual({
        issueNumber: 42,
        url: "https://github.com/owner/repo/issues/42",
      });
      expect(Object.keys(outcome)).toEqual(["issueNumber", "url"]);
    });

    it("정상 outcome 산출 시 가드를 (outcome, PARSE_SHAPE_KEYS) 인자로 1회 호출한다", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataResultIssueOutcomeMatchesParseShape",
      );

      parseRealDataResultIssueCreateEditOutput(
        "https://github.com/owner/repo/issues/7",
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        { issueNumber: 7, url: "https://github.com/owner/repo/issues/7" },
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      );
    });

    it("정상 outcome 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw 하면 producer 가 손상 outcome 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          outcomeShapeModule,
          "assertRealDataResultIssueOutcomeMatchesParseShape",
        )
        .mockImplementation(() => {
          throw new RangeError("forced shape mismatch");
        });

      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).toThrow(/forced shape mismatch/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 producer 가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          outcomeShapeModule,
          "assertRealDataResultIssueOutcomeMatchesParseShape",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).toThrow(/forced structural defect/);
    });

    it("기존 검증 throw(URL 미발견)는 가드 도달 전에 발생한다(검증 순서 보존 — 가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataResultIssueOutcomeMatchesParseShape",
      );

      expect(() => parseRealDataResultIssueCreateEditOutput("")).toThrow(
        /issue URL.*찾지 못했습니다/,
      );
      // URL 매칭 전에 throw 했으므로 self-assert 는 호출되지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("기존 검증 throw(issueNumber 0)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataResultIssueOutcomeMatchesParseShape",
      );

      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/0",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("기존 검증 throw(issueNumber 선행 0)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataResultIssueOutcomeMatchesParseShape",
      );

      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/007",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("입력 stdout 문자열을 변형하지 않는다(순수성 보존)", () => {
      const stdout = "https://github.com/owner/repo/issues/42\n";
      const before = stdout;

      parseRealDataResultIssueCreateEditOutput(stdout);

      expect(stdout).toBe(before);
    });
  });
});

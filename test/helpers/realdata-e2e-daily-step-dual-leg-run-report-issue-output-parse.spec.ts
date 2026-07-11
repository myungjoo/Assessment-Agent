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
// self-wire(T-0905) 검증용 — 가드 모듈 전체를 namespace import 해 `jest.spyOn` 으로
// 가드 호출을 가로채고(강제 throw / 호출 인자 확인), 정규 키 상수를 인자 대조에 쓴다.
import * as outcomeShapeModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape";
import { REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape";
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

  // T-0905 — outcome↔parse-shape 가드 producer self-wire 검증.
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
  //     `["issueNumber","url"]` 인자 self-assert, (e) 입력 stdout 비변형(순수성 보존),
  //     (f) 동일 stdout 두 번 호출 결정론(에러 여부·outcome 동형).
  describe("T-0905 — outcome↔parse-shape 가드 producer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 산출 outcome 이 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const stdout = "https://github.com/owner/repo/issues/42";

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

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
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
      );

      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
        "https://github.com/owner/repo/issues/7",
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        { issueNumber: 7, url: "https://github.com/owner/repo/issues/7" },
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      );
    });

    it("정상 outcome 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw(set 불일치) 하면 producer 가 손상 outcome 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          outcomeShapeModule,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
        )
        .mockImplementation(() => {
          throw new RangeError("forced shape mismatch");
        });

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).toThrow(/forced shape mismatch/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 producer 가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          outcomeShapeModule,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/1",
        ),
      ).toThrow(/forced structural defect/);
    });

    it("기존 검증 throw(URL 미발견)는 가드 도달 전에 발생한다(검증 순서 보존 — 가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(""),
      ).toThrow(/issue URL/);
      // URL 매칭 전에 throw 했으므로 self-assert 는 호출되지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("기존 검증 throw(issueNumber 0)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/0",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("기존 검증 throw(issueNumber 선행 0)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        outcomeShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/owner/repo/issues/007",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("입력 stdout 문자열을 변형하지 않는다(순수성 보존)", () => {
      const stdout = "https://github.com/owner/repo/issues/42\n";
      const before = stdout;

      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(stdout).toBe(before);
    });

    it("동일 stdout 두 번 호출 시 self-wire 후에도 산출이 deep-equal·참조-무공유 유지(결정론)", () => {
      const stdout = "https://github.com/owner/repo/issues/88\n";

      const a =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);
      const b =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});

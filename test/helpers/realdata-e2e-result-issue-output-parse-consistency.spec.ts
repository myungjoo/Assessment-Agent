// realdata-e2e-result-issue-output-parse-consistency.spec.ts — T-0723 colocated unit
// spec for `assertRealDataResultIssueOutputConsistentWithStdout`.
//
// R-112 cover: happy(정합 산출→void, 단일 줄 URL·다중 줄 첫 매칭·trailing 개행/공백 trim
// 정합) · 구조 결손(outcome 비-non-null-객체·배열·stdout 비-string·URL 미발견(빈/공백/무관
// 텍스트/비-github 호스트/`/pull/` 경로)·`<number>` 비양정수(`/issues/0`·선행 0·`/issues/abc`)
// → TypeError) · 값 정합 위반(issueNumber 값 drift·url 값 drift(trim 누락·다른 매칭 URL
// 선택)·잘못된 첫 매칭(2개 중 두 번째 산출)·추가필드 누설 → RangeError) · 결정성·비변형
// (outcome/stdout mutate 0). 컴포저 `parseRealDataResultIssueCreateEditOutput` 로 정상 산출을
// 만들되, 손상 fixture 는 산출 또는 stdout 한쪽만 변조해 만든다.
import {
  parseRealDataResultIssueCreateEditOutput,
  type RealDataResultIssueOutcome,
} from "./realdata-e2e-result-issue-output-parse";
import { assertRealDataResultIssueOutputConsistentWithStdout } from "./realdata-e2e-result-issue-output-parse-consistency";

// 단일 줄 issue URL stdout fixture(trailing 개행 포함 — 파서가 trim 함을 재유도와 정합 확인).
const SINGLE_URL_STDOUT = "https://github.com/octo/repo/issues/42\n";

// 다중 줄 stdout fixture — gh 가 부가 메시지를 출력하는 경우. 첫 매칭 URL(/issues/7)이
// 결정론적으로 선택돼야 한다(두 번째 /issues/99 가 아님).
const MULTI_LINE_STDOUT = [
  "Creating issue in octo/repo",
  "https://github.com/octo/repo/issues/7",
  "See also https://github.com/octo/repo/issues/99",
].join("\n");

describe("assertRealDataResultIssueOutputConsistentWithStdout", () => {
  describe("happy-path (정합 산출↔stdout → void)", () => {
    it("단일 줄 URL — 컴포저 산출을 그대로 넘기면 throw 0(void)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          SINGLE_URL_STDOUT,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          SINGLE_URL_STDOUT,
        ),
      ).toBeUndefined();
    });

    it("다중 줄 stdout — 첫 매칭 URL(/issues/7) 결정론 정합(void)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(MULTI_LINE_STDOUT);
      expect(outcome.issueNumber).toBe(7);
      expect(outcome.url).toBe("https://github.com/octo/repo/issues/7");
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          MULTI_LINE_STDOUT,
        ),
      ).not.toThrow();
    });

    it("trailing 개행/공백이 trim 되어 정합(URL 뒤 공백+개행)", () => {
      const stdout = "https://github.com/octo/repo/issues/123   \n\t";
      const outcome = parseRealDataResultIssueCreateEditOutput(stdout);
      expect(outcome.url).toBe("https://github.com/octo/repo/issues/123");
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — outcome 측 → TypeError (negative: outcome 비-non-null-객체/배열)", () => {
    it("outcome null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          null as unknown as RealDataResultIssueOutcome,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(/outcome 이 non-null 객체가 아니다/);
    });

    it("outcome 숫자 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          7 as unknown as RealDataResultIssueOutcome,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(TypeError);
    });

    it("outcome 문자열 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          "outcome" as unknown as RealDataResultIssueOutcome,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(TypeError);
    });

    it("outcome 배열 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          [] as unknown as RealDataResultIssueOutcome,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(/배열이다/);
    });
  });

  describe("구조 결손 — stdout 측 → TypeError (negative: stdout 비-string/URL 미발견/number 비양정수)", () => {
    it("stdout 비-string(null) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          null as unknown as string,
        ),
      ).toThrow(/stdout 이 string 이 아니다/);
    });

    it("stdout 비-string(숫자) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          7 as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("stdout 빈 문자열(URL 미발견) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(outcome, ""),
      ).toThrow(/issue URL.*찾지 못했다/s);
    });

    it("stdout 공백-only(URL 미발견) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(outcome, "   \n  "),
      ).toThrow(/찾지 못했다/);
    });

    it("stdout 무관 텍스트(URL 미발견) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          "이슈 생성 실패: 권한 없음",
        ),
      ).toThrow(/찾지 못했다/);
    });

    it("stdout 비-github 호스트(URL 미발견) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          "https://gitlab.com/octo/repo/issues/42",
        ),
      ).toThrow(/찾지 못했다/);
    });

    it("stdout `/pull/` 경로(issue 아님, URL 미발견) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          "https://github.com/octo/repo/pull/42",
        ),
      ).toThrow(/찾지 못했다/);
    });

    it("stdout `<number>` 비양정수(/issues/0) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          "https://github.com/octo/repo/issues/0",
        ),
      ).toThrow(/number 가 양의 정수가 아니다/);
    });

    it("stdout `<number>` 선행 0(/issues/007) → TypeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          "https://github.com/octo/repo/issues/007",
        ),
      ).toThrow(/양의 정수가 아니다/);
    });
  });

  describe("값 정합 위반 — 산출↔stdout drift → RangeError", () => {
    it("issueNumber 값 drift(산출 number ≠ stdout URL number) → RangeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      const drifted = { ...outcome, issueNumber: 999 };
      const run = () =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          drifted,
          SINGLE_URL_STDOUT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("url 값 drift — trim 누락(trailing 공백 잔존) → RangeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      // 재유도 expected.url 은 trim 됨. 산출이 trim 안 된 url 을 가지면 값 drift.
      const drifted = {
        ...outcome,
        url: "https://github.com/octo/repo/issues/42  ",
      };
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          drifted,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("url 값 drift — 다른 매칭 URL 선택 → RangeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      const drifted = {
        ...outcome,
        url: "https://github.com/octo/repo/issues/777",
      };
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          drifted,
          SINGLE_URL_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("잘못된 첫 매칭 — 2개 URL 중 두 번째(/issues/99)를 산출 → RangeError", () => {
      // 재유도는 첫 매칭(/issues/7)을 기대. 산출이 두 번째 URL 을 골랐다면 결정론 위반.
      const wrongMatch: RealDataResultIssueOutcome = {
        issueNumber: 99,
        url: "https://github.com/octo/repo/issues/99",
      };
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          wrongMatch,
          MULTI_LINE_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("추가 필드 누설(산출 outcome 에 extra 키 잔존, 값 동일) → RangeError", () => {
      // 재유도 expected 는 {issueNumber, url} 2 키. 값은 같지만 산출이 추가 키를 누설하면
      // 키 개수(3≠2) 불일치로 drift 를 잡는다.
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      const leaked = {
        ...outcome,
        htmlUrl: "https://github.com/octo/repo/issues/42",
      } as unknown as RealDataResultIssueOutcome;
      const run = () =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          leaked,
          SINGLE_URL_STDOUT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/추가필드/);
    });

    it("stdout 측이 산출과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      // stdout 은 number=88 인데 산출 outcome 은 42 → 재유도(88)와 산출(42) 불일치.
      const otherStdout = "https://github.com/octo/repo/issues/88\n";
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          otherStdout,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("§9 정합 — raw 활동 본문·credential 미노출", () => {
    it("정상 산출은 issueNumber/url 만 비교(부수효과·노출 0 — void)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          SINGLE_URL_STDOUT,
        ),
      ).not.toThrow();
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(MULTI_LINE_STDOUT);
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          MULTI_LINE_STDOUT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          outcome,
          MULTI_LINE_STDOUT,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      const drifted = { ...outcome, issueNumber: 1 };
      const run = () =>
        assertRealDataResultIssueOutputConsistentWithStdout(
          drifted,
          SINGLE_URL_STDOUT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 outcome 객체 mutate 0 (deep-equal 불변)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(MULTI_LINE_STDOUT);
      const snapshot = JSON.stringify(outcome);
      assertRealDataResultIssueOutputConsistentWithStdout(
        outcome,
        MULTI_LINE_STDOUT,
      );
      expect(JSON.stringify(outcome)).toBe(snapshot);
    });

    it("가드 호출 전후 stdout 문자열 불변(원본 동일)", () => {
      const outcome =
        parseRealDataResultIssueCreateEditOutput(SINGLE_URL_STDOUT);
      const stdoutSnapshot = SINGLE_URL_STDOUT;
      assertRealDataResultIssueOutputConsistentWithStdout(
        outcome,
        SINGLE_URL_STDOUT,
      );
      expect(SINGLE_URL_STDOUT).toBe(stdoutSnapshot);
    });
  });
});

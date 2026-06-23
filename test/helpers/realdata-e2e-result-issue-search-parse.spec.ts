// realdata-e2e-result-issue-search-parse.spec.ts — T-0587 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 1건 stdout → SearchHit 1개, (b) 정상 2+ 건 stdout → 순서
//     보존 SearchHit[], (c) `"[]"` → `[]` 각각 검증.
//   - error path: (a) 잘못된 JSON(`"not json"`) → throw, (b) JSON 이 배열 아님(object
//     `'{"number":1}'` / string `'"str"'`) → throw 각 별도 case.
//   - flow/branch: 정상 파싱 분기 + 각 guard throw 분기(JSON parse 실패 / 비배열 /
//     원소 비객체 / number 비양수 / 문자열 비타입) 각 1+.
//   - negative 충분 cover(분기마다): (a) number 누락, (b) number 0/음수/비정수 각 별도,
//     (c) title/body 비문자열(number/null/undefined), (d) 원소 비객체(null/숫자).
//   - 결정론·무공유: 동일 stdout 2 회 호출 → deep-equal, 매 호출 새 배열·새 객체.
//   - 최소 shape: `--json` 외 추가 필드 섞여도 {number, title, body} 만 추출(drop).
//   - R-59: 입력 외 데이터 생성 0 — 출력 키가 {number, title, body} 만.
import { parseRealDataResultIssueSearchOutput } from "./realdata-e2e-result-issue-search-parse";

describe("parseRealDataResultIssueSearchOutput — gh search stdout → SearchHit[] 순수 파서", () => {
  describe("happy-path (정상 파싱)", () => {
    it("정상 1건 stdout 을 SearchHit 1개로 파싱한다", () => {
      const stdout = JSON.stringify([
        { number: 42, title: "결과 이슈", body: "본문 marker" },
      ]);

      const hits = parseRealDataResultIssueSearchOutput(stdout);

      expect(hits).toEqual([
        { number: 42, title: "결과 이슈", body: "본문 marker" },
      ]);
    });

    it("정상 2+ 건 stdout 을 입력 순서를 보존한 SearchHit[] 로 파싱한다", () => {
      const stdout = JSON.stringify([
        { number: 200, title: "두번째", body: "b2" },
        { number: 100, title: "첫번째", body: "b1" },
        { number: 300, title: "세번째", body: "b3" },
      ]);

      const hits = parseRealDataResultIssueSearchOutput(stdout);

      expect(hits.map((h) => h.number)).toEqual([200, 100, 300]);
      expect(hits).toEqual([
        { number: 200, title: "두번째", body: "b2" },
        { number: 100, title: "첫번째", body: "b1" },
        { number: 300, title: "세번째", body: "b3" },
      ]);
    });

    it('빈 배열 stdout("[]") 을 빈 SearchHit[] 로 반환한다(후보 0건)', () => {
      expect(parseRealDataResultIssueSearchOutput("[]")).toEqual([]);
    });

    it("--json 요청 외 추가 필드가 섞여도 {number, title, body} 만 추출한다(최소 shape)", () => {
      const stdout = JSON.stringify([
        {
          number: 7,
          title: "t",
          body: "b",
          url: "https://example.com/7",
          state: "open",
          labels: ["x"],
        },
      ]);

      const hits = parseRealDataResultIssueSearchOutput(stdout);

      expect(hits).toEqual([{ number: 7, title: "t", body: "b" }]);
      // 추가 필드는 출력에 누설되지 않는다(R-59 — 입력 외 데이터 생성 0).
      expect(Object.keys(hits[0])).toEqual(["number", "title", "body"]);
    });
  });

  describe("error path (JSON / 배열 형태 오류)", () => {
    it("잘못된 JSON 문자열(not json)이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput("not json")).toThrow();
    });

    it("JSON 이 object(비배열)면 throw 한다", () => {
      expect(() =>
        parseRealDataResultIssueSearchOutput('{"number":1}'),
      ).toThrow(/배열이 아닙니다/);
    });

    it("JSON 이 string(비배열)이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput('"str"')).toThrow(
        /배열이 아닙니다/,
      );
    });

    it("JSON 이 number(비배열)면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput("123")).toThrow(
        /배열이 아닙니다/,
      );
    });

    it("JSON 이 null(비배열)이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput("null")).toThrow(
        /배열이 아닙니다/,
      );
    });
  });

  describe("negative — 원소가 객체 아님", () => {
    it("원소가 null 이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput("[null]")).toThrow(
        /객체가 아닙니다/,
      );
    });

    it("원소가 숫자면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput("[123]")).toThrow(
        /객체가 아닙니다/,
      );
    });

    it("원소가 문자열이면 throw 한다", () => {
      expect(() => parseRealDataResultIssueSearchOutput('["str"]')).toThrow(
        /객체가 아닙니다/,
      );
    });
  });

  describe("negative — number 검증", () => {
    it("number 누락이면 throw 한다", () => {
      const stdout = JSON.stringify([{ title: "t", body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /number 가 양의 정수가 아닙니다/,
      );
    });

    it("number 가 0 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /number 가 양의 정수가 아닙니다/,
      );
    });

    it("number 가 음수면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: -3, title: "t", body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /number 가 양의 정수가 아닙니다/,
      );
    });

    it("number 가 비정수(소수)면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1.5, title: "t", body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /number 가 양의 정수가 아닙니다/,
      );
    });

    it("number 가 문자열(비숫자)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: "1", title: "t", body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /number 가 양의 정수가 아닙니다/,
      );
    });
  });

  describe("negative — title/body 문자열 검증", () => {
    it("title 이 숫자면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /title 가 문자열이 아닙니다/,
      );
    });

    it("title 이 null 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: null, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /title 가 문자열이 아닙니다/,
      );
    });

    it("title 누락(undefined)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /title 가 문자열이 아닙니다/,
      );
    });

    it("body 가 숫자면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: 9 }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /body 가 문자열이 아닙니다/,
      );
    });

    it("body 가 null 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: null }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /body 가 문자열이 아닙니다/,
      );
    });

    it("body 누락(undefined)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t" }]);
      expect(() => parseRealDataResultIssueSearchOutput(stdout)).toThrow(
        /body 가 문자열이 아닙니다/,
      );
    });
  });

  describe("결정론·무공유", () => {
    it("동일 stdout 두 번 호출 → deep-equal 결과를 산출한다(결정론)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      const a = parseRealDataResultIssueSearchOutput(stdout);
      const b = parseRealDataResultIssueSearchOutput(stdout);

      expect(a).toEqual(b);
    });

    it("매 호출 새 배열·새 객체를 반환한다(무공유)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      const a = parseRealDataResultIssueSearchOutput(stdout);
      const b = parseRealDataResultIssueSearchOutput(stdout);

      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
    });
  });
});

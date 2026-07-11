// realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts —
// T-0901 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 1건 stdout → SearchHit 1개, (b) 정상 2+ 건 stdout → 순서
//     보존 SearchHit[], (c) `"[]"` → `[]` 각각 검증.
//   - error path: (a) 잘못된 JSON(`"not json"`) → throw, (b) JSON 이 배열 아님(object
//     `'{"number":1}'` / string `'"str"'` / number `"42"` / null) → throw 각 별도 case.
//   - flow/branch: 정상 파싱 분기 + 각 guard throw 분기(JSON parse 실패 / 비배열 /
//     원소 비객체 / number 비양수 / 문자열 비타입) 각 1+.
//   - negative 충분 cover(분기마다): (a) number 누락, (b) number 0/음수/비정수/비숫자 각
//     별도, (c) title/body 비문자열(number/null/undefined 각), (d) 원소 비객체(null/숫자/
//     문자열), (e) 여분 필드 섞인 원소 → 여분 절삭 {number, title, body} 만 남음.
//   - 결정론·무공유: 동일 stdout 2 회 호출 → deep-equal, 매 호출 새 배열·새 객체.
//   - R-59: 입력 외 데이터 생성 0 — 출력 키가 {number, title, body} 만.
//
// self-wire(T-0909) cover 구조: 값-정합 가드 producer self-wire — happy 무회귀(byte-
// identical) + 가드 호출 배선(1회·(hits, stdout) 인자·동일 참조) + throw 선전파(RangeError/
// TypeError) + 기존 컴포저 throw 는 가드 도달 전 발생(가드 미호출) + 결정성·무공유 유지.
import { parseRealDataDailyStepDualLegRunReportIssueSearchOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";
// self-wire(T-0909) 검증용 namespace import — 컴포저가 top-level value import 로 같은
// 모듈을 가져오므로(가드가 컴포저를 type-only import 만 함 → 순환 0) spec 의 spy 와 컴포저의
// 호출이 동일 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다.
import * as searchParseConsistencyModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency";

describe("parseRealDataDailyStepDualLegRunReportIssueSearchOutput — gh search stdout → SearchHit[] 순수 파서", () => {
  describe("happy-path (정상 파싱)", () => {
    it("정상 1건 stdout 을 SearchHit 1개로 파싱한다", () => {
      const stdout = JSON.stringify([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(hits).toEqual([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
      ]);
    });

    it("정상 2+ 건 stdout 을 입력 순서를 보존한 SearchHit[] 로 파싱한다", () => {
      const stdout = JSON.stringify([
        { number: 200, title: "두번째", body: "b2" },
        { number: 100, title: "첫번째", body: "b1" },
        { number: 300, title: "세번째", body: "b3" },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      // 입력 순서 보존(파서는 재정렬하지 않음 — 후보 최소번호 선택은 T-0898 resolver 책임).
      expect(hits.map((h) => h.number)).toEqual([200, 100, 300]);
      expect(hits).toEqual([
        { number: 200, title: "두번째", body: "b2" },
        { number: 100, title: "첫번째", body: "b1" },
        { number: 300, title: "세번째", body: "b3" },
      ]);
    });

    it('빈 배열 stdout("[]") 을 빈 SearchHit[] 로 반환한다(후보 0건)', () => {
      expect(
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[]"),
      ).toEqual([]);
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

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(hits).toEqual([{ number: 7, title: "t", body: "b" }]);
      // 추가 필드는 출력에 누설되지 않는다(R-59 — 입력 외 데이터 생성 0).
      expect(Object.keys(hits[0])).toEqual(["number", "title", "body"]);
    });
  });

  describe("error path (JSON / 배열 형태 오류)", () => {
    it("잘못된 JSON 문자열(not json)이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("not json"),
      ).toThrow();
    });

    it("JSON 이 object(비배열)면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput('{"number":1}'),
      ).toThrow(/배열이 아닙니다/);
    });

    it("JSON 이 string(비배열)이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput('"str"'),
      ).toThrow(/배열이 아닙니다/);
    });

    it("JSON 이 number(비배열)면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("42"),
      ).toThrow(/배열이 아닙니다/);
    });

    it("JSON 이 null(비배열)이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("null"),
      ).toThrow(/배열이 아닙니다/);
    });
  });

  describe("negative — 원소가 객체 아님", () => {
    it("원소가 null 이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[null]"),
      ).toThrow(/객체가 아닙니다/);
    });

    it("원소가 숫자면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[123]"),
      ).toThrow(/객체가 아닙니다/);
    });

    it("원소가 문자열이면 throw 한다", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput('["str"]'),
      ).toThrow(/객체가 아닙니다/);
    });
  });

  describe("negative — number 검증", () => {
    it("number 누락이면 throw 한다", () => {
      const stdout = JSON.stringify([{ title: "t", body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
    });

    it("number 가 0 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
    });

    it("number 가 음수면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: -3, title: "t", body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
    });

    it("number 가 비정수(소수)면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1.5, title: "t", body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
    });

    it("number 가 문자열(비숫자)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: "1", title: "t", body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
    });
  });

  describe("negative — title/body 문자열 검증", () => {
    it("title 이 숫자면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/title 가 문자열이 아닙니다/);
    });

    it("title 이 null 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: null, body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/title 가 문자열이 아닙니다/);
    });

    it("title 누락(undefined)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, body: "b" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/title 가 문자열이 아닙니다/);
    });

    it("body 가 숫자면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: 9 }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/body 가 문자열이 아닙니다/);
    });

    it("body 가 null 이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: null }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/body 가 문자열이 아닙니다/);
    });

    it("body 누락(undefined)이면 throw 한다", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t" }]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/body 가 문자열이 아닙니다/);
    });
  });

  describe("결정론·무공유", () => {
    it("동일 stdout 두 번 호출 → deep-equal 결과를 산출한다(결정론)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      const a = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      const b = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(a).toEqual(b);
    });

    it("매 호출 새 배열·새 객체를 반환한다(무공유)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      const a = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      const b = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
    });

    it("반환 배열/원소 mutate 가 다음 호출 결과에 누설되지 않는다(출력 객체 무공유)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      const first =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      first.push({ number: 99, title: "x", body: "y" });
      first[0].title = "mutated";

      const second =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      expect(second).toEqual([{ number: 1, title: "t", body: "b" }]);
    });
  });

  // ── self-wire(T-0909) — 값-정합 가드 단일 return 배선 ────────────────────────
  // 컴포저가 top-level value import 로 consistency 모듈을 가져오므로(가드는 컴포저를
  // type-only import 만 함 → 순환 0) 아래 spyOn 이 컴포저의 가드 호출을 가로챈다. 본 가드는
  // hits + stdout 두 인자를 받고 둘 다 단일 return 사이트에서 가용하므로 컴포저 단일 호출
  // 안에서 self-wire 된다(본 컴포저는 per-hit set-equality 가드가 없어 본 배선이 최초
  // self-wire — summary 축 T-0722·dual-leg output 축 T-0907 mirror).
  describe("T-0909 — 값-정합 가드 producer self-wire(산출↔stdout deep-equal)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① 정상 호출에서 값-정합 가드를 throw 0 으로 통과해 산출이 self-wire 전과 byte-identical 하다(happy·무회귀)", () => {
      const stdout = JSON.stringify([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
        { number: 7, title: "t", body: "b", url: "https://x/7", state: "open" },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      // self-wire 후에도 {number, title, body} 만, 추가 필드 drop, 순서 보존(byte-identical).
      expect(hits).toEqual([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
        { number: 7, title: "t", body: "b" },
      ]);
    });

    it("② 값-정합 가드 호출 배선 — 정확히 1회·(반환될 hits 와 동일 참조, 원본 stdout) 인자로 호출(인자 순서 hits+stdout 검증)", () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );
      const stdout = JSON.stringify([
        { number: 1, title: "t1", body: "b1" },
        { number: 2, title: "t2", body: "b2" },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (hits, stdout) 준수 — 첫 인자는 반환 hits 와 동일 참조, 둘째는 입력 stdout.
      expect(spy).toHaveBeenCalledWith(hits, stdout);
      expect(spy.mock.calls[0][0]).toBe(hits);
      expect(spy.mock.calls[0][1]).toBe(stdout);
    });

    it("③ 매 호출마다 가드가 1회씩 호출된다 — 두 번 호출 시 누적 2회(호출별 self-assert 발동, 결정론)", () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('④ 빈 배열("[]")이어도 값-정합 가드를 1회 호출한다(전체-산출 단일 호출)', () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[]");

      expect(hits).toEqual([]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith([], "[]");
    });

    it("⑤ 값-정합 가드 RangeError(값 정합 위반) throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          searchParseConsistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
        )
        .mockImplementation(() => {
          throw sentinel;
        });
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(sentinel);
    });

    it("⑥ 값-정합 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          searchParseConsistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow("구조 결손 모사");
    });

    it("⑦ 기존 컴포저 throw(number 비양정수)는 가드 도달 전 발생해 값-정합 가드를 거치지 않는다(self-wire 가 fail-fast 를 가리지 않음, negative)", () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
      // map 단계에서 throw 했으므로 단일 return 직전 self-assert 는 도달하지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑧ 기존 컴포저 throw(비배열 stdout)도 가드 도달 전 발생한다(가드 미호출, negative)", () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput('{"number":1}'),
      ).toThrow(/배열이 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑨ 기존 컴포저 throw(원소 비객체)도 가드 도달 전 발생한다(가드 미호출, negative)", () => {
      const spy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[null]"),
      ).toThrow(/객체가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑩ self-wire 는 입력 stdout 을 변형하지 않는다(순수성 — 호출 전후 stdout 동일)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);
      const stdoutBefore = stdout;

      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      // 입력 문자열은 불변 — self-wire 가 stdout 을 읽기만 하고 mutate 하지 않는다.
      expect(stdout).toBe(stdoutBefore);
    });

    it("⑪ self-wire 후에도 동일 stdout 두 번 호출 산출이 deep-equal·참조-무공유 유지(결정성·무공유, negative — mutation 격리)", () => {
      const stdout = JSON.stringify([
        { number: 1, title: "t1", body: "b1" },
        { number: 2, title: "t2", body: "b2" },
      ]);

      const first =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      const second =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(first).toEqual(second);
      // 매 호출 새 배열·새 객체(참조-무공유) — self-wire 가 무공유를 깨지 않음.
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
    });
  });
});

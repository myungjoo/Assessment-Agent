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
// self-wire(T-1015) 검증용 namespace import — hit-shape 가드 모듈. 컴포저가 top-level value
// import 로 같은 모듈을 가져오므로(가드는 hit type 을 type-only import 만 함 → 순환 0) spec 의
// spy 와 컴포저의 per-hit 호출이 동일 모듈 캐시 객체를 가리킨다. re-export 상수도 함께 import.
import * as searchHitShapeModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape";
import { REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-hit-shape";
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

  // ── self-wire(T-1015) — hit-shape↔parse-shape set-equality 가드 per-hit 배선 ─────
  // 컴포저가 top-level value import 로 hit-shape 모듈을 가져오므로(가드는 hit type 을
  // type-only import 만 함 → 순환 0) 아래 spyOn 이 컴포저의 per-hit 가드 호출을 가로챈다. 본
  // 가드는 정규화 hit 마다 `(hit, PARSE_SHAPE_KEYS)` 인자로 호출된다(요약축 T-0660 mirror —
  // 빌더는 단일 반환 1지점이나 파서는 매 hit self-assert).
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 전후 산출 배열 byte-identical 보존 + per-hit self-assert throw 0.
  //   - self-wire 검증: 매 정규화 hit 마다 가드가 `(hit, PARSE_SHAPE_KEYS)` 인자로 호출됨을
  //     spy 로 확인(다건=각 1회, 빈 배열=0회).
  //   - error path: 가드를 spy 로 강제 throw(RangeError/TypeError) 시키면 producer 가 손상
  //     hit 을 반환하지 않고 그 에러를 propagate(fail-fast).
  //   - flow/branch: 기존 검증 분기(비배열/비객체/number/title/body throw)가 per-hit
  //     self-assert 도달 전에 발생(정규화 후에만 호출 — 검증 순서 보존) → 가드 미호출. 기존
  //     whole-batch `ConsistentWithStdout` self-assert 도 여전히 호출됨(회귀 0).
  //   - negative 충분 cover: (a) 다건 매 hit self-assert, (b) 빈 배열 미호출, (c) 검증 순서
  //     보존, (d) 정상 hit throw 0, (e) 입력 stdout 비변형(순수성), (f) 결정성, (g) 인자
  //     정합(hit+상수), (h) R-59 raw 미저장(출력 키 {number,title,body} 만).
  describe("T-1015 — hit-shape↔parse-shape set-equality 가드 producer per-hit self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① self-wire 후에도 정상 산출 배열이 byte-identical 보존된다(검증만, 출력 비변형·추가 필드 drop)", () => {
      const stdout = JSON.stringify([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
        { number: 7, title: "t", body: "b", url: "https://x/7", state: "open" },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      // self-wire 전과 동일 — {number, title, body} 만, 필드 순서 보존, 추가 필드 drop.
      expect(hits).toEqual([
        { number: 42, title: "dual-leg 결과 이슈", body: "본문 marker" },
        { number: 7, title: "t", body: "b" },
      ]);
      expect(Object.keys(hits[0])).toEqual(["number", "title", "body"]);
      expect(Object.keys(hits[1])).toEqual(["number", "title", "body"]);
    });

    it('② "[]" → [] 는 self-wire 후에도 정상 반환된다(빈 배열 — 가드 미호출 분기)', () => {
      expect(
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[]"),
      ).toEqual([]);
    });

    it("③ 매 정규화 hit 마다 가드를 (hit, PARSE_SHAPE_KEYS) 인자로 호출한다(다건=각 1회, spy 호출 횟수=hit 개수)", () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );
      const stdout = JSON.stringify([
        { number: 1, title: "t1", body: "b1" },
        { number: 2, title: "t2", body: "b2" },
        { number: 3, title: "t3", body: "b3" },
      ]);

      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(spy).toHaveBeenCalledTimes(3);
      // 각 호출의 2번째 인자는 single-source parse-shape 키 목록(re-export 상수 동일 참조).
      expect(spy).toHaveBeenNthCalledWith(
        1,
        { number: 1, title: "t1", body: "b1" },
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      expect(spy).toHaveBeenNthCalledWith(
        3,
        { number: 3, title: "t3", body: "b3" },
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      // 인자 정합 — 첫 인자는 정규화 hit, 둘째는 re-export 상수와 동일 참조.
      expect(spy.mock.calls[0][1]).toBe(
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
    });

    it('④ 빈 배열("[]")이면 가드를 한 번도 호출하지 않는다(반복 0 — map 콜백 미진입)', () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[]");

      expect(hits).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑤ 정상 hit 에 대해 가드가 throw 하지 않는다(실 상수·정규화 shape 쌍 self-assert 통과 — 미mock 실호출)", () => {
      const stdout = JSON.stringify([
        { number: 1, title: "t", body: "b" },
        { number: 2, title: "t2", body: "b2" },
      ]);
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).not.toThrow();
    });

    it("⑥ 가드가 RangeError(shape 위반) throw 하면 producer 가 손상 hit 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          searchHitShapeModule,
          "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
        )
        .mockImplementation(() => {
          throw new RangeError("forced shape mismatch");
        });
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/forced shape mismatch/);
    });

    it("⑦ 가드가 TypeError(구조 결손 모사) throw 해도 producer 가 선전파한다(에러 종류 무관 propagate)", () => {
      jest
        .spyOn(
          searchHitShapeModule,
          "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow("구조 결손 모사");
    });

    it("⑧ 기존 검증 throw(number 누락)는 가드 도달 전에 발생한다(정규화 후에만 self-assert — 검증 순서 보존, 가드 미호출)", () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );
      const stdout = JSON.stringify([{ title: "t", body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/number 가 양의 정수가 아닙니다/);
      // 정규화 전에 throw 했으므로 per-hit self-assert 는 호출되지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑨ 기존 검증 throw(title 비문자열)도 가드 도달 전에 발생한다(검증 순서 보존, 가드 미호출)", () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );
      const stdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
      ).toThrow(/title 가 문자열이 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑩ 기존 검증 throw(비배열 stdout)도 가드 도달 전에 발생한다(map 미진입, 가드 미호출)", () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput('{"number":1}'),
      ).toThrow(/배열이 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑪ 기존 검증 throw(원소 비객체)도 가드 도달 전에 발생한다(정규화 전, 가드 미호출)", () => {
      const spy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );

      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[null]"),
      ).toThrow(/객체가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑫ per-hit hit-shape self-wire 와 기존 whole-batch ConsistentWithStdout self-assert 가 공존한다(양 축 모두 호출 — 축 비중복)", () => {
      const hitShapeSpy = jest.spyOn(
        searchHitShapeModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchHitShapeMatchesParseShapeKeys",
      );
      const consistencySpy = jest.spyOn(
        searchParseConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout",
      );
      const stdout = JSON.stringify([
        { number: 1, title: "t1", body: "b1" },
        { number: 2, title: "t2", body: "b2" },
      ]);

      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      // per-hit shape 가드는 hit 개수(2)만큼, whole-batch 값 가드는 1회 — 두 축 모두 배선 유지.
      expect(hitShapeSpy).toHaveBeenCalledTimes(2);
      expect(consistencySpy).toHaveBeenCalledTimes(1);
    });

    it("⑬ self-wire 는 입력 stdout 을 변형하지 않는다(순수성 — 호출 전후 stdout 동일)", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: "b" }]);
      const before = stdout;

      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(stdout).toBe(before);
    });

    it("⑭ self-wire 후에도 동일 stdout 두 번 파싱 산출이 deep-equal·참조-무공유 유지(결정성·무공유)", () => {
      const stdout = JSON.stringify([
        { number: 1, title: "t1", body: "b1" },
        { number: 2, title: "t2", body: "b2" },
      ]);

      const first =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      const second =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
    });

    it("⑮ R-59 — self-wire 후에도 산출 hit 키가 {number, title, body} 만(raw narrative 미저장·입력 외 데이터 생성 0)", () => {
      const stdout = JSON.stringify([
        {
          number: 9,
          title: "t",
          body: "raw issue payload 전문",
          author: "someone",
          comments: 3,
        },
      ]);

      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

      expect(Object.keys(hits[0])).toEqual(["number", "title", "body"]);
    });
  });
});

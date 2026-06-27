// realdata-e2e-result-issue-search-parse-consistency.spec.ts — T-0721 colocated unit
// spec for `assertRealDataResultIssueSearchOutputConsistentWithStdout`.
//
// R-112 cover: happy(정합 산출→void, "[]"→[] 0건·1 hit·2 hit) · 구조 결손(hits 비배열·
// 원소 null/숫자/문자열·stdout 비-string·비-JSON·JSON 비배열·원소 비객체·number 비양정수·
// title/body 비문자열 → TypeError) · 값 정합 위반(추가필드 누설·개수 불일치(hit 누락/중복)·
// 순서 뒤바뀜·number/title/body 값 drift → RangeError) · 결정성·비변형(hits/stdout
// mutate 0). 컴포저 `parseRealDataResultIssueSearchOutput` 로 정상 산출을 만들되, 손상
// fixture 는 산출 또는 stdout 한쪽만 변조해 만든다.
import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";
import { parseRealDataResultIssueSearchOutput } from "./realdata-e2e-result-issue-search-parse";
import { assertRealDataResultIssueSearchOutputConsistentWithStdout } from "./realdata-e2e-result-issue-search-parse-consistency";

// 1 hit raw gh stdout fixture(추가 필드 url 포함 — 파서가 drop 함을 재유도와 정합 확인).
const ONE_HIT_STDOUT = JSON.stringify([
  {
    number: 12,
    title: "이슈 제목 A",
    body: "marker 포함 본문 A",
    url: "https://x/12",
  },
]);

// 2 hit raw gh stdout fixture.
const TWO_HIT_STDOUT = JSON.stringify([
  { number: 12, title: "제목 A", body: "본문 A" },
  { number: 7, title: "제목 B", body: "본문 B" },
]);

describe("assertRealDataResultIssueSearchOutputConsistentWithStdout", () => {
  describe("happy-path (정합 산출↔stdout → void)", () => {
    it("1 hit — 컴포저 산출을 그대로 넘기면 throw 0(void)", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          ONE_HIT_STDOUT,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      expect(
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          TWO_HIT_STDOUT,
        ),
      ).toBeUndefined();
    });

    it('"[]" → [](0건) happy-path 도 정합(void)', () => {
      const stdout = "[]";
      const hits = parseRealDataResultIssueSearchOutput(stdout);
      expect(hits).toEqual([]);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout),
      ).not.toThrow();
    });

    it("2 hit(다중) 정합도 throw 0", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          TWO_HIT_STDOUT,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — hits 측 → TypeError (negative: hits 비배열/원소 비객체)", () => {
    it("hits 비배열(객체) → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          {} as unknown as RealDataResultIssueSearchHit[],
          ONE_HIT_STDOUT,
        ),
      ).toThrow(/hits 가 배열이 아니다/);
    });

    it("hits 원소 null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          [null] as unknown as RealDataResultIssueSearchHit[],
          ONE_HIT_STDOUT,
        ),
      ).toThrow(/hits\[0\] 가 객체가 아니다/);
    });

    it("hits 원소 숫자 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          [7] as unknown as RealDataResultIssueSearchHit[],
          ONE_HIT_STDOUT,
        ),
      ).toThrow(TypeError);
    });

    it("hits 원소 문자열 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          ["hit"] as unknown as RealDataResultIssueSearchHit[],
          ONE_HIT_STDOUT,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구조 결손 — stdout 측 → TypeError (negative: stdout 비-string/비-JSON/비배열/원소 결손)", () => {
    it("stdout 비-string(null) → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          null as unknown as string,
        ),
      ).toThrow(/stdout 이 string 이 아니다/);
    });

    it("stdout 비-string(숫자) → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          7 as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("stdout 비-JSON → TypeError(유효한 JSON 아님)", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          "{not json",
        ),
      ).toThrow(/유효한 JSON 이 아니다/);
    });

    it("stdout JSON 이 비배열(객체) → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          '{"number":1}',
        ),
      ).toThrow(/배열이 아니다/);
    });

    it("stdout JSON 원소 비객체(숫자) → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, "[7]"),
      ).toThrow(/원소\[0\] 가 객체가 아니다/);
    });

    it("stdout JSON 원소 number 비양정수(0) → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout),
      ).toThrow(/number 가 양의 정수가 아니다/);
    });

    it("stdout JSON 원소 title 비문자열 → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const stdout = JSON.stringify([{ number: 1, title: 9, body: "b" }]);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout),
      ).toThrow(/title 가 문자열이 아니다/);
    });

    it("stdout JSON 원소 body 비문자열 → TypeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const stdout = JSON.stringify([{ number: 1, title: "t", body: null }]);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout),
      ).toThrow(/body 가 문자열이 아니다/);
    });
  });

  describe("값 정합 위반 — 산출↔stdout drift → RangeError", () => {
    it("추가 필드 누설(산출 hit 에 url 잔존, 개수·값 동일) → RangeError", () => {
      // 재유도 expected 는 {number,title,body} 3 키. 개수·필드값은 stdout 과 같지만
      // 산출이 추가 키(url)를 누설하면 키 개수(4≠3) 불일치로 drift 를 잡는다.
      const leaked = [
        {
          number: 12,
          title: "이슈 제목 A",
          body: "marker 포함 본문 A",
          url: "https://x/12",
        },
      ] as unknown as RealDataResultIssueSearchHit[];
      const run = () =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          leaked,
          ONE_HIT_STDOUT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("개수 불일치 — hit 누락(산출이 stdout 보다 적음) → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      const dropped = [hits[0]];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          dropped,
          TWO_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("개수 불일치 — hit 중복(산출이 stdout 보다 많음) → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      const duplicated = [...hits, hits[0]];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          duplicated,
          TWO_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("순서 뒤바뀜(산출 hit 순서 swap) → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      const swapped = [hits[1], hits[0]];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          swapped,
          TWO_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("number 값 drift → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const drifted = [{ ...hits[0], number: 999 }];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          drifted,
          ONE_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("title 값 drift → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const drifted = [{ ...hits[0], title: "변조된 제목" }];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          drifted,
          ONE_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("body 값 drift → RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const drifted = [{ ...hits[0], body: "변조된 본문" }];
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          drifted,
          ONE_HIT_STDOUT,
        ),
      ).toThrow(RangeError);
    });

    it("stdout 측이 산출과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      // stdout 은 number=99 인데 산출 hits 는 12 → 재유도(99)와 산출(12) 불일치.
      const otherStdout = JSON.stringify([
        { number: 99, title: "이슈 제목 A", body: "marker 포함 본문 A" },
      ]);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          otherStdout,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("§9 정합 — raw 활동 본문·credential 미노출", () => {
    it("정상 산출은 number/title/body 만 비교(부수효과·노출 0 — void)", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          ONE_HIT_STDOUT,
        ),
      ).not.toThrow();
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          TWO_HIT_STDOUT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          hits,
          TWO_HIT_STDOUT,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const drifted = [{ ...hits[0], number: 1 }];
      const run = () =>
        assertRealDataResultIssueSearchOutputConsistentWithStdout(
          drifted,
          ONE_HIT_STDOUT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 hits 배열·원소 mutate 0 (deep-equal 불변)", () => {
      const hits = parseRealDataResultIssueSearchOutput(TWO_HIT_STDOUT);
      const snapshot = JSON.stringify(hits);
      assertRealDataResultIssueSearchOutputConsistentWithStdout(
        hits,
        TWO_HIT_STDOUT,
      );
      expect(JSON.stringify(hits)).toBe(snapshot);
    });

    it("가드 호출 전후 stdout 문자열 불변(원본 동일)", () => {
      const hits = parseRealDataResultIssueSearchOutput(ONE_HIT_STDOUT);
      const stdoutSnapshot = ONE_HIT_STDOUT;
      assertRealDataResultIssueSearchOutputConsistentWithStdout(
        hits,
        ONE_HIT_STDOUT,
      );
      expect(ONE_HIT_STDOUT).toBe(stdoutSnapshot);
    });
  });
});

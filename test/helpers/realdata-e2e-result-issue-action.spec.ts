// realdata-e2e-result-issue-action.spec.ts — T-0584 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 빈 searchHits → create, (b) 매칭 hit 1건 → update(그 number),
//     (c) 매칭 hit 2건(200, 100) → update(100, 최소값) 각각 검증.
//   - error/negative 충분 cover: (a) 빈 marker throw, (b) 공백-only marker throw,
//     (c) hit number = 0 throw, (d) hit number = -1 throw — 각 별도 case(필드별·
//     종류별 분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(marker 빈/공백, number 0 이하/비정수) + 후보 0 / 1 /
//     다수 정상 분기 각 1+. 분기마다 cover.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical action(deep equal). 후보 다수 시
//     입력 순서가 달라져도 동일 issueNumber(최소값).
//   - 무공유/순수성: 호출 후 입력 searchHits 배열 길이·각 hit 키·값 불변.
//   - R-59: action descriptor 가 body / title 류 raw 본문 키를 담지 않음(issueNumber 만).
import {
  resolveRealDataResultIssueAction,
  type RealDataResultIssueSearchHit,
} from "./realdata-e2e-result-issue-action";

const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->";

// marker 를 포함하는 hit body 를 만든다(실 박제 본문 모사 — marker 라인 + 본문).
function hitWithMarker(number: number): RealDataResultIssueSearchHit {
  return {
    number,
    title: "실 평가 e2e 결과 2026-06-23@abc1234",
    body: [MARKER, "", "## 실 평가 e2e 결과 요약", "- 평가 단위 수: 3"].join(
      "\n",
    ),
  };
}

// marker 미포함 hit — 다른 run / 무관 이슈 모사.
function hitWithoutMarker(number: number): RealDataResultIssueSearchHit {
  return {
    number,
    title: "다른 이슈",
    body: [
      "<!-- realdata-e2e-result-issue: 2026-01-01@deadbee -->",
      "무관 본문",
    ].join("\n"),
  };
}

describe("resolveRealDataResultIssueAction", () => {
  // ── happy-path (a) — 빈 searchHits → create ──────────────────────────────
  it("빈 searchHits 면 create action 을 반환한다", () => {
    expect(resolveRealDataResultIssueAction([], MARKER)).toEqual({
      action: "create",
    });
  });

  // ── happy-path (b) — 매칭 hit 1건 → update(그 number) ─────────────────────
  it("매칭 hit 1건이면 그 number 로 update action 을 반환한다", () => {
    const action = resolveRealDataResultIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 42 });
  });

  // ── happy-path (c) — 매칭 hit 2건(200, 100) → update(100, 최소값) ──────────
  it("매칭 hit 2건이면 최소 number 로 update action 을 반환한다", () => {
    const action = resolveRealDataResultIssueAction(
      [hitWithMarker(200), hitWithMarker(100)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── 후보 0건 분기 — hit 있으나 marker 미포함 ──────────────────────────────
  it("hit 1건이지만 body 가 marker 미포함이면 create 를 반환한다", () => {
    expect(
      resolveRealDataResultIssueAction([hitWithoutMarker(7)], MARKER),
    ).toEqual({ action: "create" });
  });

  it("hit 다수지만 모두 marker 미포함이면 create 를 반환한다", () => {
    expect(
      resolveRealDataResultIssueAction(
        [hitWithoutMarker(7), hitWithoutMarker(8), hitWithoutMarker(9)],
        MARKER,
      ),
    ).toEqual({ action: "create" });
  });

  // ── 후보 다수(3건, 순서 섞임) → 최소 번호 ─────────────────────────────────
  it("매칭 hit 3건(순서 섞임)이면 최소 number 로 update 한다", () => {
    const action = resolveRealDataResultIssueAction(
      [hitWithMarker(300), hitWithMarker(100), hitWithMarker(200)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── 혼합(매칭 + 미매칭) — 매칭 후보만 대상으로 최소 번호 ──────────────────
  it("매칭/미매칭 혼합 시 매칭 후보의 최소 number 만 고른다", () => {
    const action = resolveRealDataResultIssueAction(
      [hitWithoutMarker(5), hitWithMarker(50), hitWithMarker(30)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 30 });
  });

  // ── error/negative (a) — 빈 marker throw ─────────────────────────────────
  it("marker 가 빈 문자열이면 throw 한다", () => {
    expect(() =>
      resolveRealDataResultIssueAction([hitWithMarker(1)], ""),
    ).toThrow(/marker/);
  });

  // ── error/negative (b) — 공백-only marker throw ──────────────────────────
  it("marker 가 공백-only 면 throw 한다", () => {
    expect(() =>
      resolveRealDataResultIssueAction([hitWithMarker(1)], "   \t\n  "),
    ).toThrow(/marker/);
  });

  // ── error/negative (c) — hit number = 0 throw ────────────────────────────
  it("hit number 가 0 이면 throw 한다", () => {
    expect(() =>
      resolveRealDataResultIssueAction([hitWithMarker(0)], MARKER),
    ).toThrow(/number/);
  });

  // ── error/negative (d) — hit number = -1 throw ───────────────────────────
  it("hit number 가 음수면 throw 한다", () => {
    expect(() =>
      resolveRealDataResultIssueAction([hitWithMarker(-1)], MARKER),
    ).toThrow(/number/);
  });

  // ── error/negative (e) — hit number 비정수 throw(파싱 사고) ────────────────
  it("hit number 가 비정수면 throw 한다", () => {
    expect(() =>
      resolveRealDataResultIssueAction([hitWithMarker(1.5)], MARKER),
    ).toThrow(/number/);
  });

  // ── 결정론 — 동일 입력 2 회 호출 → byte-identical action ──────────────────
  it("동일 입력에 대해 deep-equal 한 action 을 반환한다", () => {
    const hits = [hitWithMarker(200), hitWithMarker(100)];
    const a = resolveRealDataResultIssueAction(hits, MARKER);
    const b = resolveRealDataResultIssueAction(hits, MARKER);
    expect(a).toEqual(b);
  });

  // ── 결정론 — 입력 순서가 달라져도 동일 issueNumber(최소값) ─────────────────
  it("후보 입력 순서가 달라도 동일 issueNumber(최소값)를 산출한다", () => {
    const asc = resolveRealDataResultIssueAction(
      [hitWithMarker(100), hitWithMarker(200), hitWithMarker(300)],
      MARKER,
    );
    const desc = resolveRealDataResultIssueAction(
      [hitWithMarker(300), hitWithMarker(200), hitWithMarker(100)],
      MARKER,
    );
    expect(asc).toEqual(desc);
    expect(asc).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── R-59 — action descriptor 가 raw 본문 키(body/title)를 담지 않음 ────────
  it("update action 은 issueNumber 만 담고 body/title 을 담지 않는다", () => {
    const action = resolveRealDataResultIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    expect(Object.keys(action).sort()).toEqual(["action", "issueNumber"]);
    expect(action).not.toHaveProperty("body");
    expect(action).not.toHaveProperty("title");
  });

  it("create action 은 action 키만 담는다", () => {
    const action = resolveRealDataResultIssueAction([], MARKER);
    expect(Object.keys(action)).toEqual(["action"]);
  });

  // ── 무공유 회귀 — 호출 후 입력 searchHits 배열·각 hit 키·값 불변 ──────────
  it("호출 후 입력 searchHits 배열 길이와 각 hit 의 키·값이 불변이다", () => {
    const hits: RealDataResultIssueSearchHit[] = [
      hitWithMarker(200),
      hitWithMarker(100),
    ];
    const snapshot = JSON.parse(JSON.stringify(hits));

    resolveRealDataResultIssueAction(hits, MARKER);

    expect(hits).toEqual(snapshot);
    expect(hits.length).toBe(2);
  });

  it("반환 action 을 mutate 해도 다음 호출 결과에 누설되지 않는다", () => {
    const a = resolveRealDataResultIssueAction([hitWithMarker(42)], MARKER);
    (a as { issueNumber: number }).issueNumber = 999;
    const b = resolveRealDataResultIssueAction([hitWithMarker(42)], MARKER);
    expect(b).toEqual({ action: "update", issueNumber: 42 });
  });
});

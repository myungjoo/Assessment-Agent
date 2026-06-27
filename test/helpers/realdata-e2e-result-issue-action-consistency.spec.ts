// realdata-e2e-result-issue-action-consistency.spec.ts — T-0703 colocated unit spec.
//
// 대상: `assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker)` —
// create-or-update action(`resolveRealDataResultIssueAction`, T-0584) 의 분기 결정·최소
// issueNumber 선택이 (searchHits, marker) 로부터 독립 재유도한 expected 와 deep-equal 정합한지
// 검증하는 순수 가드(action 분기-layer). 실 컴포저 산출 action 을 happy-path fixture 로
// 재사용해 컴포저↔가드 paired 교차 검증한다.
//
// R-112 cover 구조:
//   - happy-path: 후보 0건→create / 후보 1건→update / 후보 2+건→최소 number update 각 1+,
//     컴포저 산출 action 에 대해 void(throw 0).
//   - error path: action 변조(create↔update 뒤바뀜 / issueNumber 최소 아님 / 후보 0건인데
//     update) 각 변조 종류별 throw.
//   - branch/flow: 구조 결손 TypeError vs 값 정합 위반 RangeError vs create 정상 vs update
//     정상 각 분기 1+.
//   - negative cases 충분 cover (a)~(g): marker 빈/공백 · number 0/음수/비정수 · 후보 다수
//     최소 아님 · 분기 경계 오류 · action 형태 결손 · 결정론 · 비변형.
import {
  resolveRealDataResultIssueAction,
  type RealDataResultIssueAction,
  type RealDataResultIssueSearchHit,
} from "./realdata-e2e-result-issue-action";
import { assertRealDataResultIssueActionConsistentWithInputs } from "./realdata-e2e-result-issue-action-consistency";

const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-27@abc1234 -->";

// marker 를 포함하는 hit body 를 만든다(실 박제 본문 모사 — marker 라인 + 본문).
function hitWithMarker(number: number): RealDataResultIssueSearchHit {
  return {
    number,
    title: "실 평가 e2e 결과 2026-06-27@abc1234",
    body: [MARKER, "", "## 실 평가 e2e 결과 요약", "- 평가 단위 수: 3"].join(
      "\n",
    ),
  };
}

// marker 미포함 hit — 다른 run / 무관 이슈 모사(후보 추출에서 제외돼야 함).
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

describe("assertRealDataResultIssueActionConsistentWithInputs", () => {
  // ── happy-path (컴포저↔가드 paired) ──────────────────────────────────────
  it("후보 0건(빈 searchHits) → 컴포저 create action 에 대해 void(throw 0)", () => {
    const searchHits: RealDataResultIssueSearchHit[] = [];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(action).toEqual({ action: "create" });
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("후보 0건(hit 있으나 marker 미포함) → create action 에 대해 void", () => {
    const searchHits = [hitWithoutMarker(7), hitWithoutMarker(8)];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(action).toEqual({ action: "create" });
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("후보 1건 → 그 number 로 update action 에 대해 void", () => {
    const searchHits = [hitWithMarker(42)];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(action).toEqual({ action: "update", issueNumber: 42 });
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("후보 2+건 → 최소 number update action 에 대해 void(순서 섞임)", () => {
    const searchHits = [
      hitWithMarker(300),
      hitWithMarker(100),
      hitWithMarker(200),
    ];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(action).toEqual({ action: "update", issueNumber: 100 });
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("매칭/미매칭 혼합 → 매칭 후보 최소 number update 에 대해 void", () => {
    const searchHits = [
      hitWithoutMarker(5),
      hitWithMarker(50),
      hitWithMarker(30),
    ];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(action).toEqual({ action: "update", issueNumber: 30 });
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  // ── error path — action 변조(값 정합 위반, RangeError) ────────────────────
  it("create↔update 뒤바뀜(후보 0건인데 update) → RangeError", () => {
    const searchHits: RealDataResultIssueSearchHit[] = [];
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 1,
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(/정합 위반/);
  });

  it("update↔create 뒤바뀜(후보 1+건인데 create) → RangeError", () => {
    const searchHits = [hitWithMarker(42)];
    const tampered: RealDataResultIssueAction = { action: "create" };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("issueNumber 가 후보 최소값이 아님(최대값 선택) → RangeError(멱등 회귀 보호)", () => {
    const searchHits = [hitWithMarker(100), hitWithMarker(200)];
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 200, // 최소(100)가 아닌 최대.
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("issueNumber 가 후보에 없는 임의 값 → RangeError", () => {
    const searchHits = [hitWithMarker(42)];
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 999,
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── branch — 구조 결손(TypeError) vs 값 정합 위반(RangeError) 분리 ──────────
  it("action 이 null 이면 TypeError(구조 결손)", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        null as unknown as RealDataResultIssueAction,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("action 이 undefined 이면 TypeError(구조 결손)", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        undefined as unknown as RealDataResultIssueAction,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("action.action 태그가 'create'/'update' 가 아니면 TypeError", () => {
    const broken = { action: "delete" } as unknown as RealDataResultIssueAction;
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(broken, [], MARKER),
    ).toThrow(TypeError);
  });

  // ── negative (e) — action 형태 결손(update 인데 issueNumber 부재/비정수) ────
  it("(e) update action 인데 issueNumber 가 undefined 이면 TypeError", () => {
    const broken = { action: "update" } as unknown as RealDataResultIssueAction;
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        broken,
        [hitWithMarker(1)],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("(e) update action 인데 issueNumber 가 문자열이면 TypeError", () => {
    const broken = {
      action: "update",
      issueNumber: "42",
    } as unknown as RealDataResultIssueAction;
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        broken,
        [hitWithMarker(42)],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("(e) update action 인데 issueNumber 가 0/음수면 TypeError", () => {
    const zero = {
      action: "update",
      issueNumber: 0,
    } as unknown as RealDataResultIssueAction;
    const neg = {
      action: "update",
      issueNumber: -1,
    } as unknown as RealDataResultIssueAction;
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        zero,
        [hitWithMarker(42)],
        MARKER,
      ),
    ).toThrow(TypeError);
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        neg,
        [hitWithMarker(42)],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  // ── searchHits 구조 결손(TypeError) ──────────────────────────────────────
  it("searchHits 가 배열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        "not-array" as unknown as RealDataResultIssueSearchHit[],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("searchHits 원소가 객체가 아니면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        [null as unknown as RealDataResultIssueSearchHit],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("searchHits hit.body 가 문자열이 아니면 TypeError", () => {
    const broken = [{ number: 1, title: "t", body: 42 as unknown as string }];
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        broken,
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("searchHits hit.number 가 숫자가 아니면 TypeError(구조 결손)", () => {
    const broken = [
      { number: "1" as unknown as number, title: "t", body: MARKER },
    ];
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        broken,
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  // ── marker 구조 결손(TypeError) ──────────────────────────────────────────
  it("marker 가 문자열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        [],
        99 as unknown as string,
      ),
    ).toThrow(TypeError);
  });

  // ── negative (a) — marker 빈/공백(컴포저 input guard 동형 전파) ────────────
  it("(a) marker 가 빈 문자열이면 컴포저 동형 Error 전파", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        [hitWithMarker(1)],
        "",
      ),
    ).toThrow(/marker/);
  });

  it("(a) marker 가 공백-only 면 컴포저 동형 Error 전파", () => {
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        [hitWithMarker(1)],
        "   \t\n  ",
      ),
    ).toThrow(/marker/);
  });

  // ── negative (b) — hit number 0/음수/비정수(number guard 동형 전파) ────────
  it("(b) hit number 가 0 이면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(0)];
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        hits,
        MARKER,
      ),
    ).toThrow(/number/);
  });

  it("(b) hit number 가 음수면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(-5)];
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        hits,
        MARKER,
      ),
    ).toThrow(/number/);
  });

  it("(b) hit number 가 비정수면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(1.5)];
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        { action: "create" },
        hits,
        MARKER,
      ),
    ).toThrow(/number/);
  });

  // ── negative (c) — 후보 다수인데 입력 issueNumber 최소 아님 ────────────────
  it("(c) 후보 3건 섞임인데 입력 issueNumber 가 최소 아님 → RangeError", () => {
    const searchHits = [
      hitWithMarker(300),
      hitWithMarker(100),
      hitWithMarker(200),
    ];
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 200, // 최소(100)가 아님.
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (d) — 분기 경계 오류 ────────────────────────────────────────
  it("(d) 후보 0건인데 action 이 update → RangeError", () => {
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 7,
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        [hitWithoutMarker(7)],
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("(d) 후보 1+건인데 action 이 create → RangeError", () => {
    const tampered: RealDataResultIssueAction = { action: "create" };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        [hitWithMarker(10), hitWithMarker(20)],
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (f) — 결정론(입력 순서 무관 동일 issueNumber 재유도) ──────────
  it("(f) 입력 순서가 다른 동일 후보 집합에서 동일 issueNumber 재유도 → 둘 다 void", () => {
    const asc = [hitWithMarker(100), hitWithMarker(200), hitWithMarker(300)];
    const desc = [hitWithMarker(300), hitWithMarker(200), hitWithMarker(100)];
    const action: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 100,
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(action, asc, MARKER),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(action, desc, MARKER),
    ).not.toThrow();
  });

  it("(f) 결정론 — 동일 입력 2 회 호출 둘 다 void", () => {
    const searchHits = [hitWithMarker(42)];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("(f) 결정론 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const searchHits = [hitWithMarker(100), hitWithMarker(200)];
    const tampered: RealDataResultIssueAction = {
      action: "update",
      issueNumber: 200,
    };
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (g) — 정상 입력 비변형(가드 호출 전후 deep-equal 불변) ────────
  it("(g) 가드 호출 후 action/searchHits 객체 불변(mutate 0)", () => {
    const searchHits = [hitWithMarker(200), hitWithMarker(100)];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    const searchHitsBefore = JSON.stringify(searchHits);
    const actionBefore = JSON.stringify(action);
    const markerBefore = MARKER;

    assertRealDataResultIssueActionConsistentWithInputs(
      action,
      searchHits,
      MARKER,
    );

    expect(JSON.stringify(searchHits)).toBe(searchHitsBefore);
    expect(JSON.stringify(action)).toBe(actionBefore);
    expect(MARKER).toBe(markerBefore);
    expect(searchHits.length).toBe(2);
  });

  // ── R-59 — action 은 issueNumber 만 보유(가드가 body/title 류 키를 합성/요구 0) ──
  it("R-59 — update action 은 issueNumber 만 담고 body/title 미보유 시 void", () => {
    const searchHits = [hitWithMarker(42)];
    const action = resolveRealDataResultIssueAction(searchHits, MARKER);
    expect(Object.keys(action).sort()).toEqual(["action", "issueNumber"]);
    expect(() =>
      assertRealDataResultIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });
});

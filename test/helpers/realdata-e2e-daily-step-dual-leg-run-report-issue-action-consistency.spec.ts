// realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.spec.ts —
// T-0995 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action,
// searchHits, marker)` — create-or-update action
// (`resolveRealDataDailyStepDualLegRunReportIssueAction`, T-0898) 의 분기 결정·최소
// issueNumber 선택이 (searchHits, marker) 로부터 독립 재유도한 expected 와 deep-equal 정합한지
// 검증하는 순수 가드(action 분기-layer). 실 producer 산출 action 을 happy-path fixture 로
// 재사용해 producer↔가드 paired 교차 검증한다(oracle ↔ producer 로직 일치 round-trip 증명).
//
// R-112 cover 구조:
//   - happy-path: 후보 0건→create / 후보 1건→update / 후보 2+건→최소 number update 각 1+,
//     producer 산출 action 에 대해 void(throw 0).
//   - error path: action 변조(create↔update 뒤바뀜 / issueNumber 최소 아님 / 후보 0건인데
//     update) 각 변조 종류별 throw + 구조 결손 TypeError.
//   - branch/flow: 구조 결손 TypeError vs 값 정합 위반 RangeError vs create 정상 vs update
//     정상 각 분기 1+.
//   - negative cases 충분 cover (a)~(g): action create↔update 오매핑 · issueNumber 변조 ·
//     후보 다수 최소 아님 · 분기 경계 오류 · marker 빈/공백 · number 0/음수/비정수 · 비변형.
//   - §9/§12: 모든 fixture 비시크릿 더미 string · raw 활동 본문 파일/전역 저장 0.
import {
  resolveRealDataDailyStepDualLegRunReportIssueAction,
  type RealDataDailyStepDualLegRunReportIssueAction,
  type RealDataDailyStepDualLegRunReportIssueSearchHit,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import { assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency";

const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-14@abc1234 -->";

// marker 를 포함하는 hit body 를 만든다(실 박제 본문 모사 — marker 라인 + 본문). 비시크릿
// 더미 string 만 사용(실 secret/PAT/credential 실 값 미노출 — §9).
function hitWithMarker(
  number: number,
): RealDataDailyStepDualLegRunReportIssueSearchHit {
  return {
    number,
    title: "daily-step dual-leg run report 2026-07-14@abc1234",
    body: [MARKER, "", "## dual-leg run report 요약", "- 실행 leg 수: 2"].join(
      "\n",
    ),
  };
}

// marker 미포함 hit — 다른 run / 무관 이슈 모사(후보 추출에서 제외돼야 함).
function hitWithoutMarker(
  number: number,
): RealDataDailyStepDualLegRunReportIssueSearchHit {
  return {
    number,
    title: "다른 이슈",
    body: [
      "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-01-01@deadbee -->",
      "무관 본문",
    ].join("\n"),
  };
}

describe("assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs", () => {
  // ── happy-path (producer↔가드 paired round-trip) ─────────────────────────
  it("후보 0건(빈 searchHits) → producer create action 에 대해 void(throw 0)", () => {
    const searchHits: RealDataDailyStepDualLegRunReportIssueSearchHit[] = [];
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(action).toEqual({ action: "create" });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("후보 0건(hit 있으나 marker 미포함) → create action 에 대해 void", () => {
    const searchHits = [hitWithoutMarker(7), hitWithoutMarker(8)];
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(action).toEqual({ action: "create" });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("후보 1건 → 그 number 로 update action 에 대해 void", () => {
    const searchHits = [hitWithMarker(42)];
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 42 });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 100 });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 30 });
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });

  // ── error path — action 변조(값 정합 위반, RangeError) ────────────────────
  it("(a) create↔update 오매핑(후보 0건인데 update) → RangeError", () => {
    const searchHits: RealDataDailyStepDualLegRunReportIssueSearchHit[] = [];
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 1,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(/정합 위반/);
  });

  it("(a) update↔create 오매핑(후보 1+건인데 create) → RangeError", () => {
    const searchHits = [hitWithMarker(42)];
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "create",
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("(b) issueNumber 가 후보 최소값이 아님(최대값 선택) → RangeError(멱등 회귀 보호)", () => {
    const searchHits = [hitWithMarker(100), hitWithMarker(200)];
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 200, // 최소(100)가 아닌 최대.
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("(b) issueNumber 가 후보에 없는 임의 값 → RangeError", () => {
    const searchHits = [hitWithMarker(42)];
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 999,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── branch — 구조 결손(TypeError) vs 값 정합 위반(RangeError) 분리 ──────────
  it("action 이 null 이면 TypeError(구조 결손)", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        null as unknown as RealDataDailyStepDualLegRunReportIssueAction,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("action 이 undefined 이면 TypeError(구조 결손)", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        undefined as unknown as RealDataDailyStepDualLegRunReportIssueAction,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("action 이 배열이면 TypeError(구조 결손)", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        [] as unknown as RealDataDailyStepDualLegRunReportIssueAction,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("action.action 태그가 'create'/'update' 가 아니면 TypeError", () => {
    const broken = {
      action: "delete",
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        broken,
        [],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  // ── negative (e) — action 형태 결손(update 인데 issueNumber 부재/비정수) ────
  it("(e) update action 인데 issueNumber 가 undefined 이면 TypeError", () => {
    const broken = {
      action: "update",
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        broken,
        [hitWithMarker(42)],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("(e) update action 인데 issueNumber 가 0/음수/비정수면 TypeError", () => {
    const zero = {
      action: "update",
      issueNumber: 0,
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    const neg = {
      action: "update",
      issueNumber: -1,
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    const frac = {
      action: "update",
      issueNumber: 1.5,
    } as unknown as RealDataDailyStepDualLegRunReportIssueAction;
    for (const broken of [zero, neg, frac]) {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
          broken,
          [hitWithMarker(42)],
          MARKER,
        ),
      ).toThrow(TypeError);
    }
  });

  // ── searchHits 구조 결손(TypeError) ──────────────────────────────────────
  it("searchHits 가 배열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        "not-array" as unknown as RealDataDailyStepDualLegRunReportIssueSearchHit[],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("searchHits 원소가 객체가 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        [null as unknown as RealDataDailyStepDualLegRunReportIssueSearchHit],
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  it("searchHits hit.body 가 문자열이 아니면 TypeError", () => {
    const broken = [{ number: 1, title: "t", body: 42 as unknown as string }];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        broken,
        MARKER,
      ),
    ).toThrow(TypeError);
  });

  // ── marker 구조 결손(TypeError) ──────────────────────────────────────────
  it("marker 가 문자열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        [],
        99 as unknown as string,
      ),
    ).toThrow(TypeError);
  });

  // ── negative (f) — marker 빈/공백(컴포저 input guard 동형 전파) ────────────
  it("(f) marker 가 빈 문자열이면 컴포저 동형 Error 전파", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        [hitWithMarker(1)],
        "",
      ),
    ).toThrow(/marker/);
  });

  it("(f) marker 가 공백-only 면 컴포저 동형 Error 전파", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        [hitWithMarker(1)],
        "   \t\n  ",
      ),
    ).toThrow(/marker/);
  });

  // ── negative (g) — hit number 0/음수/비정수(number guard 동형 전파) ────────
  it("(g) hit number 가 0 이면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(0)];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        hits,
        MARKER,
      ),
    ).toThrow(/number/);
  });

  it("(g) hit number 가 음수면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(-5)];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        { action: "create" },
        hits,
        MARKER,
      ),
    ).toThrow(/number/);
  });

  it("(g) hit number 가 비정수면 number guard 동형 Error 전파", () => {
    const hits = [hitWithMarker(1.5)];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 200, // 최소(100)가 아님.
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (d) — 분기 경계 오류 ────────────────────────────────────────
  it("(d) 후보 0건인데 action 이 update → RangeError", () => {
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 7,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        [hitWithoutMarker(7)],
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  it("(d) 후보 1+건인데 action 이 create → RangeError", () => {
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "create",
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        [hitWithMarker(10), hitWithMarker(20)],
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── 결정론(입력 순서 무관 동일 issueNumber 재유도) ────────────────────────
  it("입력 순서가 다른 동일 후보 집합에서 동일 issueNumber 재유도 → 둘 다 void", () => {
    const asc = [hitWithMarker(100), hitWithMarker(200), hitWithMarker(300)];
    const desc = [hitWithMarker(300), hitWithMarker(200), hitWithMarker(100)];
    const action: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 100,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        asc,
        MARKER,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        desc,
        MARKER,
      ),
    ).not.toThrow();
  });

  it("결정론 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const searchHits = [hitWithMarker(100), hitWithMarker(200)];
    const tampered: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 200,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        tampered,
        searchHits,
        MARKER,
      ),
    ).toThrow(RangeError);
  });

  // ── 비변형(가드 호출 전후 deep-equal 불변) ───────────────────────────────
  it("가드 호출 후 action/searchHits/marker 객체 불변(mutate 0)", () => {
    const searchHits = [hitWithMarker(200), hitWithMarker(100)];
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    const searchHitsBefore = JSON.stringify(searchHits);
    const actionBefore = JSON.stringify(action);
    const markerBefore = MARKER;

    assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
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
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      searchHits,
      MARKER,
    );
    expect(Object.keys(action).sort()).toEqual(["action", "issueNumber"]);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(
        action,
        searchHits,
        MARKER,
      ),
    ).not.toThrow();
  });
});

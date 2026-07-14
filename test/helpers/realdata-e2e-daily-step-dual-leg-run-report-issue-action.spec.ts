// realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts — T-0898 colocated
// unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 빈 searchHits → create, (b) 매칭 hit 1건 → update(그 number),
//     (c) 매칭 hit 2건(200, 100) → update(100, 최소값) 각각 검증.
//   - error/negative 충분 cover: (a) 빈 marker throw, (b) 공백-only marker throw,
//     (c) hit number = 0 throw, (d) hit number = -1 throw, (e) hit number 비정수
//     throw — 각 별도 case(필드별·종류별 분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(marker 빈/공백, number 0 이하/비정수) + 후보 0 / 1 /
//     다수 정상 분기 각 1+. 분기마다 cover.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical action(deep equal). 후보 다수 시
//     입력 순서가 달라져도 동일 issueNumber(최소값).
//   - 무공유/순수성: 호출 후 입력 searchHits 배열 길이·각 hit 키·값 불변. 반환 action
//     mutate 가 다음 호출에 누설되지 않음(매 호출 새 객체).
//   - R-59: action descriptor 가 body / title 류 raw 본문 키를 담지 않음(issueNumber 만).
//   - self-wire (T-0996): resolver 가 create/update 두 반환 지점 직전 consistency oracle
//     가드를 스스로 호출하는지(flow spy)·drift 를 전파하는지(negative)·정상 산출을 mutate 하지
//     않는지(무공유) 검증. consistency 모듈은 namespace 로 import 해 self-wire spy(jest.spyOn)
//     대상으로 삼는다 — ts-jest CommonJS 로 컴파일되므로, 이 namespace 의 함수를 spyOn 하면
//     resolver 내부 self-wire 호출이 가로채진다.
import {
  resolveRealDataDailyStepDualLegRunReportIssueAction,
  type RealDataDailyStepDualLegRunReportIssueSearchHit,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import * as actionConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency";

const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report: 2026-07-11@abc1234 -->";

// marker 를 포함하는 hit body 를 만든다(실 박제 본문 모사 — marker 라인 + 본문).
function hitWithMarker(
  number: number,
): RealDataDailyStepDualLegRunReportIssueSearchHit {
  return {
    number,
    title: "실 평가 e2e dual-leg run report 2026-07-11@abc1234",
    body: [
      MARKER,
      "",
      "## dual-leg run report",
      "- eval leg: pass",
      "- collect leg: pass",
    ].join("\n"),
  };
}

// marker 미포함 hit — 다른 run / 무관 이슈 모사.
function hitWithoutMarker(
  number: number,
): RealDataDailyStepDualLegRunReportIssueSearchHit {
  return {
    number,
    title: "다른 이슈",
    body: [
      "<!-- realdata-e2e-daily-step-dual-leg-run-report: 2026-01-01@deadbee -->",
      "무관 본문",
    ].join("\n"),
  };
}

describe("resolveRealDataDailyStepDualLegRunReportIssueAction", () => {
  // ── happy-path (a) — 빈 searchHits → create ──────────────────────────────
  it("빈 searchHits 면 create action 을 반환한다", () => {
    expect(
      resolveRealDataDailyStepDualLegRunReportIssueAction([], MARKER),
    ).toEqual({ action: "create" });
  });

  // ── happy-path (b) — 매칭 hit 1건 → update(그 number) ─────────────────────
  it("매칭 hit 1건이면 그 number 로 update action 을 반환한다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 42 });
  });

  // ── happy-path (c) — 매칭 hit 2건(200, 100) → update(100, 최소값) ──────────
  it("매칭 hit 2건이면 최소 number 로 update action 을 반환한다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(200), hitWithMarker(100)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── 후보 0건 분기 (b) — hit 1건 있으나 marker 미포함 ──────────────────────
  it("hit 1건이지만 body 가 marker 미포함이면 create 를 반환한다", () => {
    expect(
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithoutMarker(7)],
        MARKER,
      ),
    ).toEqual({ action: "create" });
  });

  // ── 후보 0건 분기 (c) — hit 다수지만 모두 marker 미포함 ────────────────────
  it("hit 다수지만 모두 marker 미포함이면 create 를 반환한다", () => {
    expect(
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithoutMarker(7), hitWithoutMarker(8), hitWithoutMarker(9)],
        MARKER,
      ),
    ).toEqual({ action: "create" });
  });

  // ── 후보 다수(3건, 순서 섞임) → 최소 번호 ─────────────────────────────────
  it("매칭 hit 3건(순서 섞임)이면 최소 number 로 update 한다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(300), hitWithMarker(100), hitWithMarker(200)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── 혼합(매칭 + 미매칭) — 매칭 후보만 대상으로 최소 번호 ──────────────────
  it("매칭/미매칭 혼합 시 매칭 후보의 최소 number 만 고른다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithoutMarker(5), hitWithMarker(50), hitWithMarker(30)],
      MARKER,
    );
    expect(action).toEqual({ action: "update", issueNumber: 30 });
  });

  // ── error/negative (a) — 빈 marker throw ─────────────────────────────────
  it("marker 가 빈 문자열이면 throw 한다", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(1)],
        "",
      ),
    ).toThrow(/marker/);
  });

  // ── error/negative (b) — 공백-only marker throw ──────────────────────────
  it("marker 가 공백-only 면 throw 한다", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(1)],
        "   \t\n  ",
      ),
    ).toThrow(/marker/);
  });

  // ── error/negative (c) — hit number = 0 throw ────────────────────────────
  it("hit number 가 0 이면 throw 한다", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(0)],
        MARKER,
      ),
    ).toThrow(/number/);
  });

  // ── error/negative (d) — hit number = -1 throw ───────────────────────────
  it("hit number 가 음수면 throw 한다", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(-1)],
        MARKER,
      ),
    ).toThrow(/number/);
  });

  // ── error/negative (e) — hit number 비정수 throw(파싱 사고) ────────────────
  it("hit number 가 비정수면 throw 한다", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(1.5)],
        MARKER,
      ),
    ).toThrow(/number/);
  });

  // ── error/negative (f) — 정상 hit 사이에 number ≤ 0 인 hit 이 섞여도 throw ──
  it("정상 hit 사이에 number 0 이하 hit 이 섞이면 throw 한다(음수/0 guard 회귀)", () => {
    expect(() =>
      resolveRealDataDailyStepDualLegRunReportIssueAction(
        [hitWithMarker(10), hitWithMarker(-3), hitWithMarker(20)],
        MARKER,
      ),
    ).toThrow(/number/);
  });

  // ── 결정론 — 동일 입력 2 회 호출 → byte-identical action ──────────────────
  it("동일 입력에 대해 deep-equal 한 action 을 반환한다", () => {
    const hits = [hitWithMarker(200), hitWithMarker(100)];
    const a = resolveRealDataDailyStepDualLegRunReportIssueAction(hits, MARKER);
    const b = resolveRealDataDailyStepDualLegRunReportIssueAction(hits, MARKER);
    expect(a).toEqual(b);
  });

  // ── 결정론 — 입력 순서가 달라져도 동일 issueNumber(최소값) ─────────────────
  it("후보 입력 순서가 달라도 동일 issueNumber(최소값)를 산출한다", () => {
    const asc = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(100), hitWithMarker(200), hitWithMarker(300)],
      MARKER,
    );
    const desc = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(300), hitWithMarker(200), hitWithMarker(100)],
      MARKER,
    );
    expect(asc).toEqual(desc);
    expect(asc).toEqual({ action: "update", issueNumber: 100 });
  });

  // ── R-59 — action descriptor 가 raw 본문 키(body/title)를 담지 않음 ────────
  it("update action 은 issueNumber 만 담고 body/title 을 담지 않는다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    expect(Object.keys(action).sort()).toEqual(["action", "issueNumber"]);
    expect(action).not.toHaveProperty("body");
    expect(action).not.toHaveProperty("title");
  });

  it("create action 은 action 키만 담는다", () => {
    const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [],
      MARKER,
    );
    expect(Object.keys(action)).toEqual(["action"]);
  });

  // ── 무공유 회귀 — 호출 후 입력 searchHits 배열·각 hit 키·값 불변 ──────────
  it("호출 후 입력 searchHits 배열 길이와 각 hit 의 키·값이 불변이다", () => {
    const hits: RealDataDailyStepDualLegRunReportIssueSearchHit[] = [
      hitWithMarker(200),
      hitWithMarker(100),
    ];
    const snapshot = JSON.parse(JSON.stringify(hits));

    resolveRealDataDailyStepDualLegRunReportIssueAction(hits, MARKER);

    expect(hits).toEqual(snapshot);
    expect(hits.length).toBe(2);
  });

  // ── 무공유 회귀 — 반환 action mutate 가 다음 호출 결과에 누설되지 않음 ─────
  it("반환 action 을 mutate 해도 다음 호출 결과에 누설되지 않는다", () => {
    const a = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    (a as { issueNumber: number }).issueNumber = 999;
    const b = resolveRealDataDailyStepDualLegRunReportIssueAction(
      [hitWithMarker(42)],
      MARKER,
    );
    expect(b).toEqual({ action: "update", issueNumber: 42 });
  });
});

// self-wire drift-guard 배선 검증 (T-0996) — resolver 가 create/update 두 반환 지점 직전
// consistency oracle 가드를 스스로 호출하는지(flow spy)·drift 를 전파하는지(negative)·정상
// 산출을 mutate 하지 않는지(무공유)를 검증한다. self-wire 가 어느 분기에서든 제거되면 flow
// spy·negative 전파 case 가 fail = de-facto regression guard(양 분기 배선 존재 증명).
const GUARD_NAME =
  "assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs" as const;

describe("resolveRealDataDailyStepDualLegRunReportIssueAction self-wire consistency guard (T-0996)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (self-wire 배선 후에도 정합 action 정상 반환 — throw 0)", () => {
    it("(i) create 분기(빈 hits) → self-wire 후에도 기대 action 반환", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction([], MARKER),
      ).not.toThrow();
      expect(
        resolveRealDataDailyStepDualLegRunReportIssueAction([], MARKER),
      ).toEqual({ action: "create" });
    });

    it("(ii) create 분기(marker 미포함 hits) → self-wire 후에도 create 반환", () => {
      expect(
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithoutMarker(7), hitWithoutMarker(8)],
          MARKER,
        ),
      ).toEqual({ action: "create" });
    });

    it("(iii) update 분기(후보 1건) → self-wire 후에도 그 number 로 update 반환", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(42)],
          MARKER,
        ),
      ).not.toThrow();
      expect(
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(42)],
          MARKER,
        ),
      ).toEqual({ action: "update", issueNumber: 42 });
    });

    it("(iv) update 분기(후보 다수) → self-wire 후에도 최소 number 로 update 반환", () => {
      expect(
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(200), hitWithMarker(100), hitWithMarker(300)],
          MARKER,
        ),
      ).toEqual({ action: "update", issueNumber: 100 });
    });
  });

  describe("error-path (기존 방어 guard 가 self-wire 로 가려지지 않음)", () => {
    it("marker 빈 → resolver 자체 assertMarkerNonBlank Error 를 던진다", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(1)],
          "",
        ),
      ).toThrow(/marker/);
    });

    it("marker 공백-only → resolver 자체 assertMarkerNonBlank Error 를 던진다", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(1)],
          "   \t  ",
        ),
      ).toThrow(/marker/);
    });

    it("hit number 0 → resolver 자체 assertPositiveNumber Error 를 던진다", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(0)],
          MARKER,
        ),
      ).toThrow(/number/);
    });

    it("hit number 음수 → resolver 자체 assertPositiveNumber Error 를 던진다", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(-1)],
          MARKER,
        ),
      ).toThrow(/number/);
    });

    it("hit number 비정수 → resolver 자체 assertPositiveNumber Error 를 던진다", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(1.5)],
          MARKER,
        ),
      ).toThrow(/number/);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — 두 분기 각각 spy 로 배선 존재 증명)", () => {
    it("create 분기(후보 0건) → 가드가 (반환된 action, searchHits, marker) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(actionConsistency, GUARD_NAME);
      const hits = [hitWithoutMarker(7)];
      const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
        hits,
        MARKER,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(action, hits, MARKER);
    });

    it("update 분기(후보 1+건) → 가드가 (반환된 action, searchHits, marker) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(actionConsistency, GUARD_NAME);
      const hits = [hitWithMarker(200), hitWithMarker(100)];
      const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
        hits,
        MARKER,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(action, hits, MARKER);
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
    it("(a) create 분기 — 가드가 RangeError throw → resolver 가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: create 강제 drift(테스트)");
      jest.spyOn(actionConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction([], MARKER),
      ).toThrow(drift);
    });

    it("(a) update 분기 — 가드가 RangeError throw → resolver 가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: update 강제 drift(테스트)");
      jest.spyOn(actionConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          [hitWithMarker(42)],
          MARKER,
        ),
      ).toThrow(drift);
    });

    it("(b) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 action byte-identical, 입력 hits 무공유, 매 호출 새 객체", () => {
      const hits: RealDataDailyStepDualLegRunReportIssueSearchHit[] = [
        hitWithMarker(200),
        hitWithMarker(100),
      ];
      const snapshot = JSON.parse(JSON.stringify(hits));

      const first = resolveRealDataDailyStepDualLegRunReportIssueAction(
        hits,
        MARKER,
      );
      const second = resolveRealDataDailyStepDualLegRunReportIssueAction(
        hits,
        MARKER,
      );

      // self-wire 는 tautology(void)라 반환 action 은 배선 이전 산출 결과와 동일해야 한다.
      expect(first).toEqual({ action: "update", issueNumber: 100 });
      // 입력 searchHits 배열·각 hit 객체 미변형.
      expect(hits).toEqual(snapshot);
      // 매 호출 새 action 객체 무공유 — mutate 가 다음 호출에 누설되지 않음.
      expect(first).not.toBe(second);
      (first as { issueNumber: number }).issueNumber = 999;
      expect(second).toEqual({ action: "update", issueNumber: 100 });
    });
  });
});

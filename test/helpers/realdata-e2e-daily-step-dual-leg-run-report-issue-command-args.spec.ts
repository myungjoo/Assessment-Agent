// realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts — T-0897
// colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 descriptor(title/marker/body 비어있지 않음)에 대해
//     searchQuery(marker) / createArgs(title, body, 고정 labels) / updateArgs(title,
//     body)가 정확히 산출됨을 검증 + 동일 descriptor 재호출 byte-identical.
//   - error/negative 충분 cover: (a) 빈 title throw, (b) 공백-only title throw,
//     (c) 빈 marker throw, (d) 공백-only marker throw — 각 별도 case(필드별·빈/공백별
//     분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(title 빈/공백, marker 빈/공백) + 정상 경로 각 1+.
//     create/update 양쪽 body 에 marker 라인이 포함됨(누락 0) 검증.
//   - marker 멱등 정합: searchQuery 가 descriptor.marker 를 포함/동일, create/update
//     body 모두에 marker 보존, 멱등 searchQuery 안정성(동일 marker → 동일 searchQuery).
//   - 결정론: 동일 descriptor 2 회 호출 → byte-identical 명령-args(deep equal).
//   - 무공유/순수성: 빌드 후 입력 descriptor 의 키·값 불변(deep-equal) + 반환 객체/배열이
//     매 호출 새 참조 + 반환 labels mutate 가 다음 호출 결과·입력에 누설되지 않음.
//   - R-59: 명령-args body 에 narrative 류 raw 본문 키 부재(입력 자체에 부재).
//   - self-wire (T-0991): 빌더가 반환 직전 consistency oracle 가드를 스스로 호출하는지
//     R-112 4종(happy/error/flow/negative)으로 봉한다.
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
// body-marker 가드 모듈(T-1008)은 namespace 로 import 해 T-1009 self-wire spy(jest.spyOn)
// 대상으로 삼는다. ts-jest CommonJS 트랜스파일에서 빌더의 named import 는 이 모듈 객체
// 프로퍼티 접근으로 컴파일되므로, 이 namespace 의 함수를 spyOn 하면 빌더 내부 self-wire
// 호출이 가로채진다.
import * as issueCommandArgsBodyMarker from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker";
// consistency 모듈은 namespace 로 import 해 self-wire spy(jest.spyOn) 대상으로 삼는다.
// ts-jest CommonJS 트랜스파일에서 빌더의 named import 는 이 모듈 객체 프로퍼티 접근으로
// 컴파일되므로, 이 namespace 의 함수를 spyOn 하면 빌더 내부 self-wire 호출이 가로채진다.
import * as issueCommandArgsConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency";
// labels·title 가드 모듈(T-1010)은 namespace 로 import 해 T-1011 self-wire spy(jest.spyOn)
// 대상으로 삼는다. ts-jest CommonJS 트랜스파일에서 빌더의 named import 는 이 모듈 객체
// 프로퍼티 접근으로 컴파일되므로, 이 namespace 의 함수를 spyOn 하면 빌더 내부 self-wire
// 호출이 가로채진다.
import * as issueCommandArgsLabelsTitle from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-11@abc1234 -->";

const FIXED_LABELS = ["realdata-e2e", "daily-step-dual-leg-run-report"];

// 정상 descriptor fixture — marker 라인 + 마크다운 본문(marker-first). spec 안 인라인
// 구성(새 공용 mock helper 추출 불요).
const HAPPY_DESCRIPTOR: RealDataDailyStepDualLegRunReportIssueDescriptor = {
  title: "실 평가 e2e daily-step dual-leg run report 2026-07-11@abc1234",
  marker: MARKER,
  body: [
    MARKER,
    "",
    "## 실 평가 e2e daily-step dual-leg run report",
    "- eval leg: pass",
    "- collect leg: pass",
    "- overall: all-pass",
  ].join("\n"),
};

describe("buildRealDataDailyStepDualLegRunReportIssueCommandArgs", () => {
  // happy-path — 정상 descriptor 에 대해 명령-args 3 종을 정확히 산출.
  it("정상 입력에 대해 searchQuery / createArgs / updateArgs 를 정확히 산출한다", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    // searchQuery — marker 기반(동일 run 검색 토큰).
    expect(args.searchQuery).toBe(MARKER);
    // createArgs — title / body / 고정 labels.
    expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
    expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
    expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    // updateArgs — title / body(labels 없음).
    expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
    expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
  });

  // happy-path 재호출 byte-identical — 동일 descriptor 재호출 시 결과 deep-equal.
  it("동일 descriptor 재호출 시 byte-identical 한 명령-args 를 반환한다", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(a).toEqual(b);
    expect(a.searchQuery).toBe(b.searchQuery);
    expect(a.createArgs.body).toBe(b.createArgs.body);
    expect(a.updateArgs.body).toBe(b.updateArgs.body);
    expect(a.createArgs.labels).toEqual(b.createArgs.labels);
  });

  // marker 멱등 정합 — searchQuery 가 marker 포함 + create/update body 양쪽에 marker 보존.
  it("searchQuery 및 create/update body 양쪽에 marker 가 보존된다", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(args.searchQuery).toContain(MARKER);
    expect(args.createArgs.body).toContain(MARKER);
    expect(args.updateArgs.body).toContain(MARKER);
    // marker 라인은 create/update body 각각 정확히 1 회 등장(중복 0 — descriptor 그대로 전달).
    expect(args.createArgs.body.split(MARKER).length - 1).toBe(1);
    expect(args.updateArgs.body.split(MARKER).length - 1).toBe(1);
  });

  // negative (a) — 멱등 searchQuery 안정성: 동일 descriptor.marker 면 두 번 호출한
  // searchQuery 가 동일(later live wiring 의 안정 검색 토큰).
  it("동일 marker 에 대해 searchQuery 가 안정적으로 동일하다(멱등 검색 토큰)", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(a.searchQuery).toBe(b.searchQuery);
    expect(a.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
  });

  // negative (b) — 결정론적 labels: labels 는 고정 결정론 집합(호출마다 동일, 시각·랜덤·
  // env 의존 0).
  it("labels 는 고정 결정론 집합으로 호출마다 동일하다", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(a.createArgs.labels).toEqual(FIXED_LABELS);
    expect(b.createArgs.labels).toEqual(FIXED_LABELS);
  });

  // negative (c) — 결정론·무공유: 동일 descriptor 두 번 빌드 시 결과 동일 + 반환은 매번
  // 새 객체(중첩 createArgs/updateArgs/labels 배열도 새로 생성 — 서로 다른 참조).
  it("동일 descriptor 두 번 빌드 시 결과 deep-equal 하나 매번 새 객체·새 배열을 반환한다", () => {
    const a =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);
    const b =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(a).toEqual(b);
    // 무공유 — 최상위/중첩 객체·배열 모두 서로 다른 참조.
    expect(a).not.toBe(b);
    expect(a.createArgs).not.toBe(b.createArgs);
    expect(a.updateArgs).not.toBe(b.updateArgs);
    expect(a.createArgs.labels).not.toBe(b.createArgs.labels);
  });

  // negative (d) — 입력 mutate 0: descriptor 가 빌드 전후 deep-equal(읽기만).
  it("입력 descriptor 를 mutate 하지 않는다(빌드 전후 deep-equal)", () => {
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
      title: "실 평가 e2e daily-step dual-leg run report 2026-07-11@abc1234",
      marker: MARKER,
      body: [MARKER, "", "본문"].join("\n"),
    };
    const before = { ...descriptor };

    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

    expect(descriptor).toEqual(before);
    expect(descriptor.title).toBe(before.title);
    expect(descriptor.marker).toBe(before.marker);
    expect(descriptor.body).toBe(before.body);
  });

  // negative (e) — 무공유 회귀: 반환 createArgs.labels 배열에 push 해도 다음 호출 결과
  // labels·입력에 누설 0.
  it("반환 createArgs.labels 를 mutate 해도 다음 호출 결과에 누설되지 않는다", () => {
    const first =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);
    first.createArgs.labels.push("leaked");

    const second =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(second.createArgs.labels).toEqual(FIXED_LABELS);
    expect(second.createArgs.labels).not.toContain("leaked");
    // 매 호출이 새 배열을 반환 — 두 호출의 labels 는 서로 다른 참조.
    expect(first.createArgs.labels).not.toBe(second.createArgs.labels);
  });

  // error path (a) — 빈 title throw.
  it("빈 title 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        title: "",
      }),
    ).toThrow(/title/);
  });

  // error path (b) — 공백-only title throw.
  it("공백-only title 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        title: "  \t ",
      }),
    ).toThrow(/title/);
  });

  // error path (c) — 빈 marker throw.
  it("빈 marker 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        marker: "",
      }),
    ).toThrow(/marker/);
  });

  // error path (d) — 공백-only marker throw.
  it("공백-only marker 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        marker: "\n \t",
      }),
    ).toThrow(/marker/);
  });

  // branch — marker-only body(요약 라인 없는 최소 변형)도 정상 산출(marker 보존).
  it("marker-only body descriptor 도 정상 명령-args 를 산출한다", () => {
    const onlyMarker =
      "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-12@deadbee -->";
    const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
      title: "실 평가 e2e daily-step dual-leg run report 2026-07-12@deadbee",
      marker: onlyMarker,
      body: onlyMarker,
    };

    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

    expect(args.searchQuery).toBe(onlyMarker);
    expect(args.createArgs.body).toBe(onlyMarker);
    expect(args.updateArgs.body).toBe(onlyMarker);
    expect(args.createArgs.labels).toEqual(FIXED_LABELS);
  });

  // R-59 — 명령-args body 에 narrative 류 raw 본문 키 부재(입력 descriptor 에 부재).
  it("명령-args body 에 narrative 류 raw 본문 키가 등장하지 않는다", () => {
    const args =
      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(args.createArgs.body).not.toContain("narrative");
    expect(args.updateArgs.body).not.toContain("narrative");
    expect(args.createArgs.body).not.toContain("rawActivity");
  });
});

// self-wire drift-guard 배선 검증 (T-0991) — 빌더가 반환 직전 consistency oracle 가드
// `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`(T-0990)를 스스로
// 호출해 산출 명령-args 를 즉시 자가 검증하는지를 R-112 4종(happy/error/flow/negative)으로
// 봉한다. self-wire 가 제거되면 flow spy·negative 전파 case 가 fail = de-facto regression guard.
describe("buildRealDataDailyStepDualLegRunReportIssueCommandArgs self-wire consistency guard (T-0991)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 서로 다른 marker/body 를 갖는 두 번째 정합 fixture(호출 사실 검증의 다중 descriptor 용).
  const OTHER_MARKER =
    "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-12@deadbee -->";
  const OTHER_DESCRIPTOR: RealDataDailyStepDualLegRunReportIssueDescriptor = {
    title: "실 평가 e2e daily-step dual-leg run report 2026-07-12@deadbee",
    marker: OTHER_MARKER,
    body: [OTHER_MARKER, "", "## 본문", "- overall: some-fail"].join("\n"),
  };

  describe("happy-path (self-wire 배선 후에도 정합 명령-args 정상 반환 — throw 0)", () => {
    it("(i) 정상 descriptor → throw 없이 정합 명령-args 반환(searchQuery=marker·멱등 body·labels 유지)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      // searchQuery=marker.
      expect(args.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
      // create·update body 동일(멱등).
      expect(args.createArgs.body).toBe(args.updateArgs.body);
      // labels 상수 유지.
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("(ii) 다른 descriptor(다른 marker/body) → throw 없이 정합 명령-args 반환", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );
      expect(args.searchQuery).toBe(OTHER_MARKER);
      expect(args.createArgs.body).toBe(args.updateArgs.body);
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("(iii) marker-only body descriptor → self-wire 후에도 정상 반환", () => {
      const onlyMarker =
        "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-13@cafef00 -->";
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        title: "실 평가 e2e daily-step dual-leg run report 2026-07-13@cafef00",
        marker: onlyMarker,
        body: onlyMarker,
      };
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor),
      ).not.toThrow();
    });
  });

  describe("error-path (기존 방어 guard 가 self-wire 로 가려지지 않음)", () => {
    it("title 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "  ",
        }),
      ).toThrow(/title 가 비어있습니다/);
    });

    it("marker 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "",
        }),
      ).toThrow(/marker 가 비어있습니다/);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재 증명)", () => {
    it("정상 경로 → 가드가 (descriptor, 반환된 commandArgs) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(HAPPY_DESCRIPTOR, args);
    });

    it("다른 descriptor fixture → 가드가 반환 commandArgs 인자로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(OTHER_DESCRIPTOR, args);
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
    it("(a) 가드가 drift 감지해 RangeError throw → 빌더가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: 강제 drift(테스트)");
      jest
        .spyOn(
          issueCommandArgsConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
        )
        .mockImplementation(() => {
          throw drift;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(drift);
    });

    it("(b) 가드가 TypeError throw → 빌더가 동일 TypeError 전파(구조 결손도 삼키지 않음)", () => {
      const structural = new TypeError("commandArgs 구조 결손(테스트)");
      jest
        .spyOn(
          issueCommandArgsConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
        )
        .mockImplementation(() => {
          throw structural;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(structural);
    });

    it("(c) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 명령-args 가 기대값과 byte-identical, 입력 descriptor 미변형, labels 무공유", () => {
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        ...HAPPY_DESCRIPTOR,
      };
      const before = { ...descriptor };

      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

      // self-wire 는 tautology(void)라 반환 명령-args 는 배선 이전 조립 결과와 동일해야 한다.
      expect(args.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      // 입력 descriptor 미변형.
      expect(descriptor).toEqual(before);
      // 반환 labels 무공유 — mutate 가 상수·다음 호출에 누설되지 않음.
      args.createArgs.labels.push("leaked");
      const next =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(next.createArgs.labels).toEqual(FIXED_LABELS);
    });
  });
});

// self-wire body marker-first 정합 가드 배선 검증 (T-1009, 요약축 T-0650 mirror) — 빌더가
// 반환 직전 T-1008 body 축 가드
// `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor` 를
// (commandArgs, descriptor) 인자로 스스로 호출해 body 전파·marker-first·searchQuery 정합을
// 즉시 자가 검증하는지를 R-112 4종(happy/error/flow/negative)으로 봉한다. self-wire 가
// 제거되면 flow spy·negative 전파 case 가 fail = de-facto regression guard.
describe("buildRealDataDailyStepDualLegRunReportIssueCommandArgs self-wire body-marker guard (T-1009)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 서로 다른 marker/body 를 갖는 두 번째 정합 fixture(호출 사실 검증의 다중 descriptor 용).
  const OTHER_MARKER =
    "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-12@deadbee -->";
  const OTHER_DESCRIPTOR: RealDataDailyStepDualLegRunReportIssueDescriptor = {
    title: "실 평가 e2e daily-step dual-leg run report 2026-07-12@deadbee",
    marker: OTHER_MARKER,
    body: [OTHER_MARKER, "", "## 본문", "- overall: some-fail"].join("\n"),
  };

  describe("happy-path (self-wire 배선 후에도 정합 명령-args 정상 반환 — throw 0, 다양성)", () => {
    it("(i) 정상 descriptor(다수 leg 요약) → throw 없이 정합 명령-args 반환(body byte-identical·marker-first·searchQuery=marker)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      // create·update body 가 descriptor.body 와 byte-identical(양 경로 전파).
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      // marker-first — 두 body 의 첫 라인이 marker.
      expect(args.createArgs.body.split("\n")[0]).toBe(HAPPY_DESCRIPTOR.marker);
      expect(args.updateArgs.body.split("\n")[0]).toBe(HAPPY_DESCRIPTOR.marker);
      // searchQuery=marker.
      expect(args.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
    });

    it("(ii) 다른 descriptor(다른 marker/body·some-fail leg status) → throw 없이 정합 명령-args 반환", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );
      expect(args.createArgs.body).toBe(OTHER_DESCRIPTOR.body);
      expect(args.updateArgs.body).toBe(OTHER_DESCRIPTOR.body);
      expect(args.searchQuery).toBe(OTHER_MARKER);
    });

    it("(iii) marker-only body descriptor(최소 변형) → self-wire 후에도 정상 반환(body=marker, marker-first 자명)", () => {
      const onlyMarker =
        "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-13@cafef00 -->";
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        title: "실 평가 e2e daily-step dual-leg run report 2026-07-13@cafef00",
        marker: onlyMarker,
        body: onlyMarker,
      };
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
      expect(args.createArgs.body).toBe(onlyMarker);
      expect(args.searchQuery).toBe(onlyMarker);
    });
  });

  describe("error-path (기존 방어 guard·body 축 가드가 self-wire 로 서로 가려지지 않음)", () => {
    it("(a) title 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다(body 가드 self-wire 가 식별자 guard 를 깨지 않음)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "  ",
        }),
      ).toThrow(/title 가 비어있습니다/);
    });

    it("(b) marker 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "",
        }),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(c) body 가드가 body 전파 회귀를 감지해 RangeError throw → 빌더가 동일 RangeError 전파(손상 args 유출 0)", () => {
      const drift = new RangeError("불변식(1) 위반: 강제 body drift(테스트)");
      jest
        .spyOn(
          issueCommandArgsBodyMarker,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
        )
        .mockImplementation(() => {
          throw drift;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(drift);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재·순서 증명)", () => {
    it("(i) 정상 경로 → body 가드가 (반환된 commandArgs, descriptor) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsBodyMarker,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(args, HAPPY_DESCRIPTOR);
    });

    it("(ii) 다른 descriptor fixture → body 가드가 반환 commandArgs 인자로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsBodyMarker,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(args, OTHER_DESCRIPTOR);
    });

    it("(iii) 기존 Consistent 가드도 여전히 호출됨(body 가드 배선이 기존 self-wire 를 밀어내지 않음)", () => {
      const consistentSpy = jest.spyOn(
        issueCommandArgsConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        issueCommandArgsBodyMarker,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
      );

      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

      // 두 가드 모두 정확히 1 회 호출 — 나란히 배선.
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
      // 순서 보존 — Consistent 가드가 body 가드보다 먼저 호출된다(식별자→Consistent→Body).
      expect(consistentSpy.mock.invocationCallOrder[0]).toBeLessThan(
        bodySpy.mock.invocationCallOrder[0],
      );
    });

    it("(iv) 식별자 guard throw 분기(title 빈) → body 가드는 호출되지 않음(fail-fast, 가드 순서 보존)", () => {
      const bodySpy = jest.spyOn(
        issueCommandArgsBodyMarker,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "",
        }),
      ).toThrow(/title/);

      // 식별자 guard 가 먼저 throw 하므로 body 가드까지 도달하지 않는다.
      expect(bodySpy).not.toHaveBeenCalled();
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파·비변형·결정성·순서·R-59)", () => {
    it("(a) 결정성 — 동일 descriptor 2 회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 안 깨짐)", () => {
      const a =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      const b =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(a).toEqual(b);
      expect(a.createArgs.body).toBe(b.createArgs.body);
      expect(a.updateArgs.body).toBe(b.updateArgs.body);
    });

    it("(b) 입력 비변형 — 빌드 후 입력 descriptor deep-equal(self-wire 호출 전후 변경 0)", () => {
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        ...HAPPY_DESCRIPTOR,
      };
      const before = { ...descriptor };

      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
      expect(descriptor.body).toBe(before.body);
      expect(descriptor.marker).toBe(before.marker);
    });

    it("(c) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 명령-args 가 배선 이전 조립 결과와 byte-identical, labels 무공유", () => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      // body 가드는 tautology(void)라 반환 명령-args 는 배선 이전 조립 결과와 동일해야 한다.
      expect(args.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      // 반환 labels 무공유 — mutate 가 상수·다음 호출에 누설되지 않음.
      args.createArgs.labels.push("leaked");
      const next =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(next.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("(d) body 가드가 TypeError throw(구조 결손) → 빌더가 동일 TypeError 전파(삼키지 않음)", () => {
      const structural = new TypeError("commandArgs body 구조 결손(테스트)");
      jest
        .spyOn(
          issueCommandArgsBodyMarker,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
        )
        .mockImplementation(() => {
          throw structural;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(structural);
    });

    it("(e) R-59 — self-wire 후에도 반환 body 에 narrative 류 raw 본문 키 부재", () => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(args.createArgs.body).not.toContain("narrative");
      expect(args.updateArgs.body).not.toContain("rawActivity");
    });
  });
});

// self-wire labels·title 정합 가드 배선 검증 (T-1011, 요약축 T-0652 mirror) — 빌더가 반환
// 직전 T-1010 labels·title 축 가드
// `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent` 를
// (commandArgs, descriptor, DUAL_LEG_RUN_REPORT_ISSUE_LABELS) 인자로 스스로 호출해 create/
// update title byte-identical 전파·labels 고정-상수 exact match·labels 무공유를 즉시 자가
// 검증하는지를 R-112 4종(happy/error/flow/negative)으로 봉한다. self-wire 가 제거되면 flow
// spy·negative 전파 case 가 fail = de-facto regression guard.
describe("buildRealDataDailyStepDualLegRunReportIssueCommandArgs self-wire labels-title guard (T-1011)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 서로 다른 marker/body 를 갖는 두 번째 정합 fixture(호출 사실 검증의 다중 descriptor 용).
  const OTHER_MARKER =
    "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-12@deadbee -->";
  const OTHER_DESCRIPTOR: RealDataDailyStepDualLegRunReportIssueDescriptor = {
    title: "실 평가 e2e daily-step dual-leg run report 2026-07-12@deadbee",
    marker: OTHER_MARKER,
    body: [OTHER_MARKER, "", "## 본문", "- overall: some-fail"].join("\n"),
  };

  describe("happy-path (self-wire 배선 후에도 정합 명령-args 정상 반환 — throw 0, 다양성)", () => {
    it("(i) 정상 descriptor → throw 없이 정합 명령-args 반환(create/update title=descriptor.title·labels 고정상수)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      // create·update title 이 descriptor.title 로 byte-identical 수렴(멱등 식별).
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      // labels 고정 상수 exact match.
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("(ii) 다른 descriptor(다른 marker/body·some-fail leg status) → throw 없이 정합 명령-args 반환", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        ),
      ).not.toThrow();
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );
      expect(args.createArgs.title).toBe(OTHER_DESCRIPTOR.title);
      expect(args.updateArgs.title).toBe(OTHER_DESCRIPTOR.title);
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    });
  });

  describe("error-path (기존 방어 guard·labels·title 축 가드가 self-wire 로 서로 가려지지 않음)", () => {
    it("(a) title 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다(labels·title 가드 self-wire 가 식별자 guard 를 깨지 않음)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "  ",
        }),
      ).toThrow(/title 가 비어있습니다/);
    });

    it("(b) marker 빈-공백 → 빌더 자체 assertNonBlank 의 Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "",
        }),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(c) labels·title 가드가 정합 회귀를 감지해 RangeError throw → 빌더가 동일 RangeError 전파(손상 args 유출 0)", () => {
      const drift = new RangeError("불변식(1) 위반: 강제 title drift(테스트)");
      jest
        .spyOn(
          issueCommandArgsLabelsTitle,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
        )
        .mockImplementation(() => {
          throw drift;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(drift);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재·순서·인자 증명)", () => {
    it("(i) 정상 경로 → labels·title 가드가 (반환된 commandArgs, descriptor, 고정 labels 상수) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsLabelsTitle,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 정합 — (반환할 commandArgs, 원본 descriptor, 고정 labels 상수와 동치 배열).
      expect(spy).toHaveBeenCalledWith(args, HAPPY_DESCRIPTOR, FIXED_LABELS);
      // 3번째 인자가 반환 createArgs.labels 와 동치이되(고정 상수) 참조는 무공유(빌더가 복제 반환).
      const passedLabels = spy.mock.calls[0][2];
      expect(passedLabels).toEqual(FIXED_LABELS);
      expect(args.createArgs.labels).not.toBe(passedLabels);
    });

    it("(ii) 다른 descriptor fixture → labels·title 가드가 반환 commandArgs 인자로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(
        issueCommandArgsLabelsTitle,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
      );
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          OTHER_DESCRIPTOR,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(args, OTHER_DESCRIPTOR, FIXED_LABELS);
    });

    it("(iii) 세 가드(Consistent·Body·LabelsTitle) 모두 여전히 호출됨 + 순서 보존(Consistent→Body→LabelsTitle)", () => {
      const consistentSpy = jest.spyOn(
        issueCommandArgsConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        issueCommandArgsBodyMarker,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        issueCommandArgsLabelsTitle,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
      );

      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(HAPPY_DESCRIPTOR);

      // 세 가드 모두 정확히 1 회 호출 — 나란히 배선(새 가드가 기존 두 self-wire 를 밀어내지 않음).
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
      expect(labelsTitleSpy).toHaveBeenCalledTimes(1);
      // 순서 보존 — Consistent → Body → LabelsTitle(식별자 guard 이후).
      expect(consistentSpy.mock.invocationCallOrder[0]).toBeLessThan(
        bodySpy.mock.invocationCallOrder[0],
      );
      expect(bodySpy.mock.invocationCallOrder[0]).toBeLessThan(
        labelsTitleSpy.mock.invocationCallOrder[0],
      );
    });

    it("(iv) 식별자 guard throw 분기(title 빈) → labels·title 가드는 호출되지 않음(fail-fast, 가드 순서 보존)", () => {
      const labelsTitleSpy = jest.spyOn(
        issueCommandArgsLabelsTitle,
        "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "",
        }),
      ).toThrow(/title/);

      // 식별자 guard 가 먼저 throw 하므로 labels·title 가드까지 도달하지 않는다.
      expect(labelsTitleSpy).not.toHaveBeenCalled();
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파·비변형·결정성·순서·무공유·R-59)", () => {
    it("(a) 결정성 — 동일 descriptor 2 회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 안 깨짐)", () => {
      const a =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      const b =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(a).toEqual(b);
      expect(a.createArgs.title).toBe(b.createArgs.title);
      expect(a.createArgs.labels).toEqual(b.createArgs.labels);
    });

    it("(b) 입력 비변형 — 빌드 후 입력 descriptor deep-equal(self-wire 호출 전후 변경 0)", () => {
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        ...HAPPY_DESCRIPTOR,
      };
      const before = { ...descriptor };

      buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
      expect(descriptor.title).toBe(before.title);
    });

    it("(c) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 명령-args 가 배선 이전 조립 결과와 byte-identical, labels 무공유", () => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      // labels·title 가드는 tautology(void)라 반환 명령-args 는 배선 이전 조립 결과와 동일.
      expect(args.searchQuery).toBe(HAPPY_DESCRIPTOR.marker);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      // 반환 labels 무공유 — mutate 가 상수·다음 호출에 누설되지 않음.
      args.createArgs.labels.push("leaked");
      const next =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(next.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("(d) labels·title 가드가 TypeError throw(구조 결손) → 빌더가 동일 TypeError 전파(삼키지 않음)", () => {
      const structural = new TypeError(
        "commandArgs labels·title 구조 결손(테스트)",
      );
      jest
        .spyOn(
          issueCommandArgsLabelsTitle,
          "assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent",
        )
        .mockImplementation(() => {
          throw structural;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        ),
      ).toThrow(structural);
    });

    it("(e) 무공유 보존 — self-wire 후에도 반환 createArgs.labels 가 고정 상수 exact match 이되 매 호출 새 배열", () => {
      const a =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      const b =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(a.createArgs.labels).toEqual(FIXED_LABELS);
      expect(b.createArgs.labels).toEqual(FIXED_LABELS);
      // 매 호출 새 배열 — 두 호출의 labels 는 서로 다른 참조(무공유).
      expect(a.createArgs.labels).not.toBe(b.createArgs.labels);
    });

    it("(f) R-59 — self-wire 후에도 반환 body 에 narrative 류 raw 본문 키 부재", () => {
      const args =
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          HAPPY_DESCRIPTOR,
        );
      expect(args.createArgs.body).not.toContain("narrative");
      expect(args.updateArgs.body).not.toContain("rawActivity");
    });
  });
});

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
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
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

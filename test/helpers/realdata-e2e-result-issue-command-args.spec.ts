// realdata-e2e-result-issue-command-args.spec.ts — T-0583 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 descriptor(title/marker/body 비어있지 않음)에 대해
//     searchQuery(marker) / createArgs(title, body, 고정 labels) / updateArgs(title,
//     body)가 정확히 산출됨을 검증.
//   - error/negative 충분 cover: (a) 빈 title throw, (b) 공백-only title throw,
//     (c) 빈 marker throw, (d) 공백-only marker throw — 각 별도 case(필드별·빈/공백별
//     분기마다). 단일 negative 만으로 부족.
//   - flow/branch: guard 분기(title 빈/공백, marker 빈/공백) + 정상 경로 각 1+.
//     create/update 양쪽 body 에 marker 라인이 포함됨(누락 0) 검증.
//   - marker 멱등 정합: searchQuery 가 descriptor.marker 를 포함, create/update body
//     모두에 marker 보존.
//   - 결정론: 동일 descriptor 2 회 호출 → byte-identical 명령-args(deep equal).
//   - 무공유/순수성: 빌드 후 입력 descriptor 의 키·값 불변 + 반환 labels mutate 가 다음
//     호출 결과에 누설되지 않음.
//   - R-59: 명령-args 가 narrative 류 raw 본문 키를 담지 않음(입력 자체에 부재).
import {
  buildRealDataResultIssueCommandArgs,
  type RealDataResultIssueCommandArgs,
} from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";

const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->";

const HAPPY_DESCRIPTOR: RealDataResultIssueDescriptor = {
  title: "실 평가 e2e 결과 2026-06-23@abc1234",
  marker: MARKER,
  body: [MARKER, "", "## 실 평가 e2e 결과 요약", "- 평가 단위 수: 3"].join(
    "\n",
  ),
};

describe("buildRealDataResultIssueCommandArgs", () => {
  // happy-path — 정상 descriptor 에 대해 명령-args 3 종을 정확히 산출.
  it("정상 입력에 대해 searchQuery / createArgs / updateArgs 를 정확히 산출한다", () => {
    const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

    // searchQuery — marker 기반(동일 run 검색 토큰).
    expect(args.searchQuery).toBe(MARKER);
    // createArgs — title / body / 고정 labels.
    expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
    expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
    expect(args.createArgs.labels).toEqual(["realdata-e2e", "result"]);
    // updateArgs — title / body(labels 없음).
    expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
    expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
  });

  // marker 멱등 정합 — searchQuery 가 marker 포함 + create/update body 양쪽에 marker 보존.
  it("searchQuery 및 create/update body 양쪽에 marker 가 보존된다", () => {
    const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(args.searchQuery).toContain(MARKER);
    expect(args.createArgs.body).toContain(MARKER);
    expect(args.updateArgs.body).toContain(MARKER);
  });

  // 결정론 — 동일 descriptor 2 회 호출 → byte-identical 명령-args.
  it("동일 입력에 대해 deep-equal 한 명령-args 를 반환한다", () => {
    const a = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
    const b = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(a).toEqual(b);
    expect(a.searchQuery).toBe(b.searchQuery);
    expect(a.createArgs.body).toBe(b.createArgs.body);
    expect(a.updateArgs.body).toBe(b.updateArgs.body);
    expect(a.createArgs.labels).toEqual(b.createArgs.labels);
  });

  // negative (a) — 빈 title throw.
  it("빈 title 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        title: "",
      }),
    ).toThrow(/title/);
  });

  // negative (b) — 공백-only title throw.
  it("공백-only title 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        title: "  \t ",
      }),
    ).toThrow(/title/);
  });

  // negative (c) — 빈 marker throw.
  it("빈 marker 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        marker: "",
      }),
    ).toThrow(/marker/);
  });

  // negative (d) — 공백-only marker throw.
  it("공백-only marker 에 대해 throw 한다", () => {
    expect(() =>
      buildRealDataResultIssueCommandArgs({
        ...HAPPY_DESCRIPTOR,
        marker: "\n \t",
      }),
    ).toThrow(/marker/);
  });

  // 무공유/순수성 회귀 — 빌드 후 입력 descriptor 의 키·값 불변.
  it("입력 descriptor 를 mutate 하지 않는다", () => {
    const descriptor: RealDataResultIssueDescriptor = {
      title: "실 평가 e2e 결과 2026-06-23@abc1234",
      marker: MARKER,
      body: [MARKER, "", "본문"].join("\n"),
    };
    const before = { ...descriptor };

    buildRealDataResultIssueCommandArgs(descriptor);

    expect(descriptor).toEqual(before);
    expect(descriptor.title).toBe(before.title);
    expect(descriptor.marker).toBe(before.marker);
    expect(descriptor.body).toBe(before.body);
  });

  // 무공유 회귀 — 반환 labels 배열 mutate 가 다음 호출 결과에 누설되지 않는다.
  it("반환 createArgs.labels 를 mutate 해도 다음 호출 결과에 누설되지 않는다", () => {
    const first: RealDataResultIssueCommandArgs =
      buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
    first.createArgs.labels.push("leaked");

    const second = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(second.createArgs.labels).toEqual(["realdata-e2e", "result"]);
    expect(second.createArgs.labels).not.toContain("leaked");
    // 매 호출이 새 배열을 반환 — 두 호출의 labels 는 서로 다른 참조.
    expect(first.createArgs.labels).not.toBe(second.createArgs.labels);
  });

  // R-59 — 명령-args 본문에 narrative 류 raw 본문 키 부재(입력 descriptor 에 부재).
  it("명령-args body 에 narrative 류 raw 본문 키가 등장하지 않는다", () => {
    const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

    expect(args.createArgs.body).not.toContain("narrative");
    expect(args.updateArgs.body).not.toContain("narrative");
    expect(args.createArgs.body).not.toContain("unitId");
  });
});

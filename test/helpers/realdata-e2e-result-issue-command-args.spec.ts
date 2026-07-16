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
import * as bodyMarkerModule from "./realdata-e2e-result-issue-command-args-body-marker";
import * as consistencyModule from "./realdata-e2e-result-issue-command-args-consistency";
import * as labelsTitleModule from "./realdata-e2e-result-issue-command-args-labels-title";
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

  // self-wire 배선 검증 (T-0650) — buildRealDataResultIssueCommandArgs 가 명령-args 를
  // 반환하기 직전에 assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args,
  // descriptor) 를 self-assert 하도록 배선됐음을 검증한다(T-0646→T-0647 descriptor-side
  // self-wire 의 command-args-side mirror). 정상 입력이면 가드는 void 반환 → 동작·반환값
  // byte-identical 보존. builder 는 항상 정상 body 를 합성하므로 가드 throw 분기는 builder
  // 입력으로 직접 유발 불가 — 본 describe 는 (a) self-wire 가 실제 호출 경로에 배선됐음 +
  // (b) self-wire 가 builder 동작(반환 byte-identical)을 깨지 않음 + (c) 회귀 모사 시
  // fail-fast 에 집중.
  describe("body marker-first 가드 self-wire 배선 (T-0650)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // flow/branch ③ + negative ③ — self-wire 배선 검증: 가드가 builder 반환 직전 실제
    // 호출 경로에 배선됐음을 spyOn 으로 감시(정확히 1 회·(반환할 args, 원본 descriptor)
    // 인자로 호출).
    it("정상 입력에서 가드를 정확히 1 회 (반환할 args, descriptor) 인자로 호출한다", () => {
      const spy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );

      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(spy).toHaveBeenCalledTimes(1);
      // 가드는 (빌더가 반환하는 바로 그 args, 입력 descriptor) 로 호출된다.
      expect(spy).toHaveBeenCalledWith(args, HAPPY_DESCRIPTOR);
    });

    // happy-path — 정상 descriptor → 가드 통과해 정상 명령-args 반환(throw 0).
    it("정상 descriptor 에서 가드 통과해 정상 명령-args 를 반환한다(throw 0)", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).not.toThrow();
    });

    // happy-path 분기 — 단일 result·짧은 body 변형 descriptor 도 가드 통과.
    it("단일 result 짧은 body descriptor 도 가드 통과해 정상 반환한다", () => {
      const singleMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-24@deadbee -->";
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-24@deadbee",
        marker: singleMarker,
        body: [singleMarker, "", "- 평가 단위 수: 1"].join("\n"),
      };

      expect(() =>
        buildRealDataResultIssueCommandArgs(descriptor),
      ).not.toThrow();
    });

    // branch — marker-only body(요약 라인 없는 최소 변형)도 가드 통과(marker-first 보존).
    it("marker-only body descriptor 도 가드 통과해 정상 반환한다", () => {
      const onlyMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-25@cafef00 -->";
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-25@cafef00",
        marker: onlyMarker,
        body: onlyMarker,
      };

      expect(() =>
        buildRealDataResultIssueCommandArgs(descriptor),
      ).not.toThrow();
    });

    // negative ④ + flow/branch ② — 식별자 guard 우선: 빈 title 은 가드 self-assert
    // 도달 전 식별자 guard 에서 throw(분기 순서 보존). 가드 미호출.
    it("빈 title 은 가드 self-assert 도달 전 식별자 guard 에서 throw 하고 가드를 호출하지 않는다", () => {
      const spy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "",
        }),
      ).toThrow(/title/);
      // 식별자 guard 가 먼저 throw → body marker 가드 미도달.
      expect(spy).not.toHaveBeenCalled();
    });

    // 식별자 guard 우선 (marker 측) — 공백-only marker 도 가드 도달 전 식별자 guard throw.
    it("공백-only marker 는 가드 self-assert 도달 전 식별자 guard 에서 throw 한다", () => {
      const spy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "   ",
        }),
      ).toThrow(/marker/);
      expect(spy).not.toHaveBeenCalled();
    });

    // error path ② — 가드가 검출하는 불변식 위반을 spyOn 으로 모사: 빌더가 회귀해 가드가
    // throw 하는 상황을 mock 으로 주입하면 빌더가 손상 args 를 반환하기 전에 fail-fast
    // throw 한다(손상 args 가 caller 로 새 나가지 않음).
    it("가드가 회귀를 검출해 throw 하면 빌더도 손상 args 를 반환하지 않고 throw 한다", () => {
      jest
        .spyOn(
          bodyMarkerModule,
          "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "불변식(4) 위반: searchQuery 가 descriptor.marker 와 byte-identical 하지 않다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
    });

    // error path ② (TypeError 변형) — 구조 결손을 가드가 TypeError 로 검출하는 경우도
    // 빌더가 그대로 전파한다(가드 에러 정책 보존: 구조 결손=TypeError / 값 정합=RangeError).
    it("가드가 구조 결손을 TypeError 로 검출하면 빌더가 그대로 전파한다", () => {
      jest
        .spyOn(
          bodyMarkerModule,
          "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "args.createArgs.body 가 문자열이 아니다 — create body 전파 검증을 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(TypeError);
    });

    // negative ① — 결정성: 동일 descriptor 2 회 빌드 → 둘 다 byte-identical 정상 반환
    // (self-wire 가 결정성 깨지지 않음).
    it("self-wire 후에도 동일 descriptor 에 대해 byte-identical 명령-args 를 반환한다", () => {
      const a = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
      const b = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(a).toEqual(b);
      expect(a.searchQuery).toBe(b.searchQuery);
      expect(a.createArgs.body).toBe(b.createArgs.body);
      expect(a.updateArgs.body).toBe(b.updateArgs.body);
    });

    // negative ② — 입력 비변형: 빌드 후 입력 descriptor 변경 0(self-wire 가 입력을
    // mutate 하지 않음).
    it("self-wire 후에도 입력 descriptor 를 mutate 하지 않는다", () => {
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-23@abc1234",
        marker: MARKER,
        body: [MARKER, "", "본문"].join("\n"),
      };
      const before = { ...descriptor };

      buildRealDataResultIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
    });

    // negative — byte-identical 회귀 0: self-wire 추가가 정상 입력 반환값을 바꾸지 않음.
    it("self-wire 추가가 정상 입력 명령-args byte 를 바꾸지 않는다(회귀 0)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.searchQuery).toBe(MARKER);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(["realdata-e2e", "result"]);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
    });

    // negative ⑤ — R-59: self-wire 후에도 빌더가 raw narrative 미접촉.
    it("self-wire 후에도 명령-args body 에 narrative 류 raw 본문 키가 등장하지 않는다(R-59)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.createArgs.body).not.toContain("narrative");
      expect(args.updateArgs.body).not.toContain("narrative");
      expect(args.createArgs.body).not.toContain("rawActivity");
    });
  });

  // self-wire 배선 검증 (T-0652) — buildRealDataResultIssueCommandArgs 가 명령-args 를
  // 반환하기 직전에 assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args,
  // descriptor, RESULT_ISSUE_LABELS) 를 self-assert 하도록 배선됐음을 검증한다
  // (T-0649→T-0650 body marker self-wire 의 labels·title-side mirror). 정상 입력이면
  // 가드는 void 반환 → 동작·반환값 byte-identical 보존. builder 는 항상 정상 title·labels 를
  // 합성하므로 가드 throw 분기는 builder 입력으로 직접 유발 불가 — 본 describe 는 (a)
  // self-wire 가 실제 호출 경로에 배선됐음 + (b) self-wire 가 builder 동작(반환
  // byte-identical)을 깨지 않음 + (c) 회귀 모사 시 fail-fast 에 집중.
  describe("labels·title 정합 가드 self-wire 배선 (T-0652)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // flow/branch ③ + negative ③ — self-wire 호출 인자 정합: 가드가 builder 반환 직전 실제
    // 호출 경로에 정확히 1 회 (반환할 args, 원본 descriptor, RESULT_ISSUE_LABELS 동치
    // 배열) 인자로 호출됨을 spyOn 으로 감시(self-wire 가 실제 배선됐음 증명).
    it("정상 입력에서 가드를 정확히 1 회 (반환할 args, descriptor, RESULT_ISSUE_LABELS 동치 배열) 인자로 호출한다", () => {
      const spy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(spy).toHaveBeenCalledTimes(1);
      // 가드는 (빌더가 반환하는 바로 그 args, 입력 descriptor, 고정 labels 동치 배열) 로
      // 호출된다 — 세 번째 인자가 ["realdata-e2e", "result"] 와 동치임을 확인.
      expect(spy).toHaveBeenCalledWith(args, HAPPY_DESCRIPTOR, [
        "realdata-e2e",
        "result",
      ]);
    });

    // happy-path — 정상 descriptor → labels·title 가드 통과해 정상 명령-args 반환(throw 0).
    it("정상 descriptor 에서 labels·title 가드 통과해 정상 명령-args 를 반환한다(throw 0)", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).not.toThrow();
    });

    // happy-path 분기 — 다른 title·marker 변형 descriptor 도 labels·title 가드 통과.
    it("다른 title·marker 변형 descriptor 도 labels·title 가드 통과해 정상 반환한다", () => {
      const altMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-24@deadbee -->";
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-24@deadbee",
        marker: altMarker,
        body: [altMarker, "", "- 평가 단위 수: 1"].join("\n"),
      };

      expect(() =>
        buildRealDataResultIssueCommandArgs(descriptor),
      ).not.toThrow();
    });

    // flow/branch ① — 정상 입력 → body 가드 + labels·title 가드 둘 다 void → 정상 반환
    // 분기. 두 가드가 모두 정확히 1 회 호출됨(나란히 배선).
    it("정상 입력에서 body 가드와 labels·title 가드를 모두 정확히 1 회 호출한다", () => {
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(bodySpy).toHaveBeenCalledTimes(1);
      expect(labelsTitleSpy).toHaveBeenCalledTimes(1);
    });

    // negative ④ + flow/branch ② — 식별자 guard 우선: 빈 title 은 labels·title 가드
    // self-assert 도달 전 식별자 guard 에서 throw(분기 순서 보존). 가드 미호출.
    it("빈 title 은 가드 self-assert 도달 전 식별자 guard 에서 throw 하고 labels·title 가드를 호출하지 않는다", () => {
      const spy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "",
        }),
      ).toThrow(/title/);
      // 식별자 guard 가 먼저 throw → labels·title 가드 미도달.
      expect(spy).not.toHaveBeenCalled();
    });

    // 식별자 guard 우선 (marker 측) — 공백-only marker 도 labels·title 가드 도달 전
    // 식별자 guard throw.
    it("공백-only marker 는 가드 self-assert 도달 전 식별자 guard 에서 throw 한다", () => {
      const spy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "   ",
        }),
      ).toThrow(/marker/);
      expect(spy).not.toHaveBeenCalled();
    });

    // error path ② — labels·title 가드가 검출하는 불변식 위반을 spyOn 으로 모사: 빌더가
    // 회귀해(title 3자 불일치 등) 가드가 RangeError throw 하는 상황을 mock 주입하면
    // 빌더가 손상 args 를 반환하기 전에 fail-fast throw(손상 args 가 caller 로 새지 않음).
    it("labels·title 가드가 회귀를 검출해 throw 하면 빌더도 손상 args 를 반환하지 않고 throw 한다", () => {
      jest
        .spyOn(
          labelsTitleModule,
          "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "불변식(1) 위반: createArgs.title 이 descriptor.title 과 byte-identical 하지 않다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
    });

    // error path ② (TypeError 변형) — labels·title 가드가 구조 결손을 TypeError 로
    // 검출하는 경우도 빌더가 그대로 전파한다(가드 에러 정책 보존).
    it("labels·title 가드가 구조 결손을 TypeError 로 검출하면 빌더가 그대로 전파한다", () => {
      jest
        .spyOn(
          labelsTitleModule,
          "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "args.createArgs.labels 가 배열이 아니다 — labels 정합 비교를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(TypeError);
    });

    // negative ① — 결정성: 동일 descriptor 2 회 빌드 → 둘 다 byte-identical 정상 반환
    // (labels·title self-wire 가 결정성 깨지지 않음).
    it("labels·title self-wire 후에도 동일 descriptor 에 대해 byte-identical 명령-args 를 반환한다", () => {
      const a = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
      const b = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(a).toEqual(b);
      expect(a.createArgs.title).toBe(b.createArgs.title);
      expect(a.updateArgs.title).toBe(b.updateArgs.title);
      expect(a.createArgs.labels).toEqual(b.createArgs.labels);
    });

    // negative ② — 입력 비변형: 빌드 후 입력 descriptor 변경 0(self-wire 가 입력을
    // mutate 하지 않음).
    it("labels·title self-wire 후에도 입력 descriptor 를 mutate 하지 않는다", () => {
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-23@abc1234",
        marker: MARKER,
        body: [MARKER, "", "본문"].join("\n"),
      };
      const before = { ...descriptor };

      buildRealDataResultIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
    });

    // negative — byte-identical 회귀 0: labels·title self-wire 추가가 정상 입력
    // title·labels 반환값을 바꾸지 않음.
    it("labels·title self-wire 추가가 정상 입력 명령-args title·labels byte 를 바꾸지 않는다(회귀 0)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.labels).toEqual(["realdata-e2e", "result"]);
    });

    // negative ⑤ — labels 무공유: 반환 createArgs.labels mutate 가 고정 상수·다음 호출에
    // 누설 안 됨(가드의 무공유 불변식이 정상 경로에서 통과 — self-wire 후에도 빌더가
    // 상수를 복제해 반환).
    it("labels·title self-wire 후에도 반환 createArgs.labels mutate 가 다음 호출에 누설되지 않는다", () => {
      const first = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
      first.createArgs.labels.push("leaked");

      const second = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(second.createArgs.labels).toEqual(["realdata-e2e", "result"]);
      expect(second.createArgs.labels).not.toContain("leaked");
      expect(first.createArgs.labels).not.toBe(second.createArgs.labels);
    });

    // negative ⑥ — R-59: labels·title self-wire 후에도 빌더가 raw narrative 미접촉.
    it("labels·title self-wire 후에도 명령-args body 에 narrative 류 raw 본문 키가 등장하지 않는다(R-59)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.createArgs.body).not.toContain("narrative");
      expect(args.updateArgs.body).not.toContain("rawActivity");
    });
  });

  // self-wire 배선 검증 (T-1032) — buildRealDataResultIssueCommandArgs 가 명령-args 를
  // 반환하기 직전에 assertRealDataResultIssueCommandArgsConsistent(args, descriptor) 를
  // self-assert 하도록 배선됐음을 검증한다(T-1031 신설 full-recomposition 가드의 producer
  // self-wire — daily 축 T-0991 self-wire 의 요약축 mirror). 자매 body-marker(T-0650)·
  // labels-title(T-0652) self-wire 가 필드별 invariant 를 지킨다면, 본 가드는 전체 객체를
  // descriptor 만으로 독립 재조립해 통째로 대조하는 세 번째 방어 축이다. 정상 입력이면
  // 가드는 void 반환 → 동작·반환값 byte-identical 보존. builder 는 항상 정합 명령-args 를
  // 합성하므로 가드 throw 분기는 builder 입력으로 직접 유발 불가 — 본 describe 는 (a)
  // self-wire 가 실제 호출 경로에 (args, descriptor) artifact-first 2-arg 로 배선됐음 +
  // (b) self-wire 가 builder 동작(반환 byte-identical)을 깨지 않음 + (c) 회귀 모사 시
  // fail-fast 에 집중.
  describe("full-recomposition 정합 가드 self-wire 배선 (T-1032)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // flow/branch — self-wire 호출 인자 정합: 가드가 builder 반환 직전 실제 호출 경로에
    // 정확히 1 회 (반환할 args, 원본 descriptor) artifact-first 2-arg 로 호출됨을 spyOn 으로
    // 감시(self-wire 가 실제 배선됐음 증명 + label 3번째 인자 생략 확인).
    it("정상 입력에서 가드를 정확히 1 회 (반환할 args, descriptor) artifact-first 2-arg 로 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );

      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(spy).toHaveBeenCalledTimes(1);
      // 가드는 (빌더가 반환하는 바로 그 args, 입력 descriptor) 2-arg 로 호출된다 — label
      // (3번째)은 생략(artifact-first, arg-swap footgun 방지).
      expect(spy).toHaveBeenCalledWith(args, HAPPY_DESCRIPTOR);
      // arg-swap footgun 방지 — 첫 인자가 args(descriptor 아님), 둘째가 descriptor.
      const [firstArg, secondArg] = spy.mock.calls[0];
      expect(firstArg).toBe(args);
      expect(secondArg).toBe(HAPPY_DESCRIPTOR);
      // label(3번째 인자) 생략 확인.
      expect(spy.mock.calls[0].length).toBe(2);
    });

    // happy-path — 정상 descriptor → full-recomposition 가드 통과해 정상 명령-args 반환(throw 0).
    it("정상 descriptor 에서 full-recomposition 가드 통과해 정상 명령-args 를 반환한다(throw 0)", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).not.toThrow();
    });

    // happy-path 분기 — 단일 result·짧은 body 변형 descriptor 도 가드 통과.
    it("단일 result 짧은 body descriptor 도 full-recomposition 가드 통과해 정상 반환한다", () => {
      const singleMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-24@deadbee -->";
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-24@deadbee",
        marker: singleMarker,
        body: [singleMarker, "", "- 평가 단위 수: 1"].join("\n"),
      };

      expect(() =>
        buildRealDataResultIssueCommandArgs(descriptor),
      ).not.toThrow();
    });

    // branch — marker-only body(요약 라인 없는 최소 변형)도 가드 통과.
    it("marker-only body descriptor 도 full-recomposition 가드 통과해 정상 반환한다", () => {
      const onlyMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-25@cafef00 -->";
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-25@cafef00",
        marker: onlyMarker,
        body: onlyMarker,
      };

      expect(() =>
        buildRealDataResultIssueCommandArgs(descriptor),
      ).not.toThrow();
    });

    // flow/branch — 세 self-assert 모두 호출됨: 신규 full-recomposition 가드 + 기존 두
    // 자매(body-marker / labels-title) 가드가 정상 입력에서 각각 정확히 1 회 호출된다
    // (신규 배선이 기존 self-wire 를 밀어내지 않음 — triple-oracle parity 완성).
    it("정상 입력에서 세 self-assert(full-recomposition + body-marker + labels-title)를 모두 정확히 1 회 호출한다", () => {
      const consistencySpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(consistencySpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
      expect(labelsTitleSpy).toHaveBeenCalledTimes(1);
    });

    // negative — 식별자 guard 우선: 빈 title 은 full-recomposition 가드 self-assert 도달 전
    // 식별자 guard 에서 throw(분기 순서 보존). 가드 미호출.
    it("빈 title 은 가드 self-assert 도달 전 식별자 guard 에서 throw 하고 full-recomposition 가드를 호출하지 않는다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          title: "",
        }),
      ).toThrow(/title/);
      // 식별자 guard 가 먼저 throw → full-recomposition 가드 미도달.
      expect(spy).not.toHaveBeenCalled();
    });

    // 식별자 guard 우선 (marker 측) — 공백-only marker 도 가드 도달 전 식별자 guard throw.
    it("공백-only marker 는 가드 self-assert 도달 전 식별자 guard 에서 throw 한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs({
          ...HAPPY_DESCRIPTOR,
          marker: "   ",
        }),
      ).toThrow(/marker/);
      expect(spy).not.toHaveBeenCalled();
    });

    // error path — full-recomposition 가드가 검출하는 drift 를 spyOn 으로 모사(RangeError):
    // 빌더가 회귀해 가드가 throw 하는 상황을 mock 주입하면 빌더가 손상 args 를 반환하기 전에
    // fail-fast throw(손상 args 가 caller 로 새지 않음).
    it("full-recomposition 가드가 drift 를 검출해 RangeError throw 하면 빌더도 손상 args 를 반환하지 않고 throw 한다", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssueCommandArgsConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: searchQuery 가 독립 재유도 expected 와 byte-identical 하지 않다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
    });

    // error path (TypeError 변형) — 구조 결손을 가드가 TypeError 로 검출하는 경우도 빌더가
    // 그대로 전파한다(가드 에러 정책 보존: 구조 결손=TypeError / 값 drift=RangeError).
    it("full-recomposition 가드가 구조 결손을 TypeError 로 검출하면 빌더가 그대로 전파한다", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssueCommandArgsConsistent",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "commandArgs.createArgs 가 객체가 아니다 — 독립 재유도 대조를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(TypeError);
    });

    // negative — 결정성: 동일 descriptor 2 회 빌드 → 둘 다 byte-identical 정상 반환
    // (full-recomposition self-wire 가 결정성 깨지지 않음).
    it("full-recomposition self-wire 후에도 동일 descriptor 에 대해 byte-identical 명령-args 를 반환한다", () => {
      const a = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
      const b = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(a).toEqual(b);
      expect(a.searchQuery).toBe(b.searchQuery);
      expect(a.createArgs.body).toBe(b.createArgs.body);
      expect(a.updateArgs.body).toBe(b.updateArgs.body);
    });

    // negative — 입력 비변형: 빌드 후 입력 descriptor 변경 0(self-wire 가 입력을 mutate
    // 하지 않음).
    it("full-recomposition self-wire 후에도 입력 descriptor 를 mutate 하지 않는다", () => {
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-23@abc1234",
        marker: MARKER,
        body: [MARKER, "", "본문"].join("\n"),
      };
      const before = { ...descriptor };

      buildRealDataResultIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
    });

    // negative — byte-identical 회귀 0: self-wire 추가가 정상 입력 반환값을 바꾸지 않음.
    it("full-recomposition self-wire 추가가 정상 입력 명령-args byte 를 바꾸지 않는다(회귀 0)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.searchQuery).toBe(MARKER);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(["realdata-e2e", "result"]);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
    });

    // negative — labels 무공유: 반환 createArgs.labels mutate 가 다음 호출에 누설 안 됨
    // (full-recomposition self-wire 후에도 빌더가 상수를 복제해 반환).
    it("full-recomposition self-wire 후에도 반환 createArgs.labels mutate 가 다음 호출에 누설되지 않는다", () => {
      const first = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);
      first.createArgs.labels.push("leaked");

      const second = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(second.createArgs.labels).toEqual(["realdata-e2e", "result"]);
      expect(second.createArgs.labels).not.toContain("leaked");
    });

    // negative — R-59: full-recomposition self-wire 후에도 빌더가 raw narrative 미접촉.
    it("full-recomposition self-wire 후에도 명령-args body 에 narrative 류 raw 본문 키가 등장하지 않는다(R-59)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.createArgs.body).not.toContain("narrative");
      expect(args.updateArgs.body).not.toContain("rawActivity");
    });
  });

  // self-wire 호출 순서 lock (T-1033) — 세 self-assert(full-recomposition + body-marker +
  // labels-title)의 producer 반환-직전 상대 호출 순서를 daily 정본(...CommandArgs.ts
  // L172/187/205 Consistent→Body→LabelsTitle broad-first)과 동형으로 잠근다. daily spec
  // L812/L832~837 의 invocationCallOrder 3자 부등식을 요약축 이름으로 mirror 한다. T-1033
  // 이전 요약축은 body→labels→consistent broad-last 였고(신규 full-recomp 를 뒤에 append),
  // 순서를 잠그는 test 가 부재했다 — 본 describe 가 (a) 재정렬된 broad-first 순서를 명시
  // lock 하고 (b) full-recomp-first fail-fast 분기(가장 강한 오라클 회귀 시 나머지 두 가드
  // 미도달)를 검증한다. 근거: full-recomposition 오라클은 전체 객체를 독립 재조립·대조하는
  // 가장 강한(broad) 오라클로, 먼저 실행하면 drift 시 최고 정보량 진단이 first-throw 로 난다.
  describe("self-wire 호출 순서 lock — Consistent→Body→LabelsTitle broad-first (T-1033, daily spec L832 mirror)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // flow/branch + 순서-lock — 세 가드 모두 호출됨 + 상대 순서 보존(Consistent→Body→
    // LabelsTitle). daily spec (iii) L812/L832~837 mirror. 세 spy 의 invocationCallOrder[0]
    // 로 broad-first(full-recomp 가 가장 먼저, labels-title 가 가장 나중)를 명시 부등식으로 lock.
    it("세 가드(Consistent·Body·LabelsTitle) 모두 호출됨 + 순서 보존(Consistent→Body→LabelsTitle)", () => {
      const consistentSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      // 세 가드 모두 정확히 1 회 호출 — 나란히 배선(재정렬이 어느 가드도 밀어내지 않음).
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
      expect(labelsTitleSpy).toHaveBeenCalledTimes(1);
      // 순서 보존 — Consistent → Body → LabelsTitle(식별자 guard 이후, daily 정본 broad-first).
      expect(consistentSpy.mock.invocationCallOrder[0]).toBeLessThan(
        bodySpy.mock.invocationCallOrder[0],
      );
      expect(bodySpy.mock.invocationCallOrder[0]).toBeLessThan(
        labelsTitleSpy.mock.invocationCallOrder[0],
      );
    });

    // error-path (a) + flow/branch — full-recomp-first fail-fast: 가장 강한 가드가 회귀를
    // 모사(throw)하면 producer 가 throw 전파 + 재정렬로 이제 **가장 먼저** 실행되므로
    // body-marker·labels-title 는 미도달(미호출)까지 검증한다.
    it("full-recomp 가드가 throw 하면 producer 가 전파하고 body-marker·labels-title 는 미호출(broad-first fail-fast)", () => {
      const consistentSpy = jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssueCommandArgsConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: full-recomposition expected 와 byte-identical 하지 않다.",
          );
        });
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
      // full-recomp 가 먼저 throw → 나머지 두 자매 가드 미도달(fail-fast, 순서 보존).
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).not.toHaveBeenCalled();
      expect(labelsTitleSpy).not.toHaveBeenCalled();
    });

    // error-path (b) + flow/branch — body-marker 가 throw 하면 producer 전파 + labels-title
    // 는 미도달(full-recomp 는 이미 통과). 중간 가드 fail-fast 순서 검증.
    it("body-marker 가드가 throw 하면 producer 가 전파하고 labels-title 는 미호출", () => {
      const consistentSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );
      jest
        .spyOn(
          bodyMarkerModule,
          "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "불변식 위반: createArgs.body 가 descriptor.body 와 byte-identical 하지 않다.",
          );
        });
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
      // full-recomp 는 먼저 통과(호출됨), labels-title 는 미도달.
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(labelsTitleSpy).not.toHaveBeenCalled();
    });

    // error-path (c) — labels-title(가장 나중) 가드가 throw 하면 producer 전파. 앞선 두
    // 가드는 이미 통과(호출됨).
    it("labels-title 가드가 throw 하면 producer 가 전파한다(앞선 두 가드는 통과)", () => {
      const consistentSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      jest
        .spyOn(
          labelsTitleModule,
          "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "불변식 위반: createArgs.title 이 descriptor.title 과 byte-identical 하지 않다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR),
      ).toThrow(RangeError);
      expect(consistentSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
    });

    // negative — 순서-lock 부등식이 실제로 Consistent-first 를 강제함을 명시(daily 와 동일
    // 순서). full-recomp 의 호출 순번이 자매 둘보다 엄격히 작음을 재확인(broad-first invariant).
    it("Consistent 의 invocationCallOrder 가 Body·LabelsTitle 둘보다 엄격히 작다(daily 동일 broad-first)", () => {
      const consistentSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueCommandArgsConsistent",
      );
      const bodySpy = jest.spyOn(
        bodyMarkerModule,
        "assertRealDataResultIssueCommandArgsBodyPreservesDescriptor",
      );
      const labelsTitleSpy = jest.spyOn(
        labelsTitleModule,
        "assertRealDataResultIssueCommandArgsLabelsTitleConsistent",
      );

      buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      const consistentOrder = consistentSpy.mock.invocationCallOrder[0];
      expect(consistentOrder).toBeLessThan(bodySpy.mock.invocationCallOrder[0]);
      expect(consistentOrder).toBeLessThan(
        labelsTitleSpy.mock.invocationCallOrder[0],
      );
    });

    // negative — 재정렬이 정상 입력 반환값을 바꾸지 않음(byte-identical 회귀 0).
    it("순서 재정렬 후에도 정상 입력 명령-args byte 를 바꾸지 않는다(회귀 0)", () => {
      const args = buildRealDataResultIssueCommandArgs(HAPPY_DESCRIPTOR);

      expect(args.searchQuery).toBe(MARKER);
      expect(args.createArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.createArgs.body).toBe(HAPPY_DESCRIPTOR.body);
      expect(args.createArgs.labels).toEqual(["realdata-e2e", "result"]);
      expect(args.updateArgs.title).toBe(HAPPY_DESCRIPTOR.title);
      expect(args.updateArgs.body).toBe(HAPPY_DESCRIPTOR.body);
    });

    // negative — 재정렬이 입력 descriptor 를 mutate 하지 않음(비변형).
    it("순서 재정렬 후에도 입력 descriptor 를 mutate 하지 않는다", () => {
      const descriptor: RealDataResultIssueDescriptor = {
        title: "실 평가 e2e 결과 2026-06-23@abc1234",
        marker: MARKER,
        body: [MARKER, "", "본문"].join("\n"),
      };
      const before = { ...descriptor };

      buildRealDataResultIssueCommandArgs(descriptor);

      expect(descriptor).toEqual(before);
    });
  });
});

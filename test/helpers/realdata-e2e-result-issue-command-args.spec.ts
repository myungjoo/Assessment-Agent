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
});

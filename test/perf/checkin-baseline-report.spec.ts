import {
  CHECKIN_LOG_PREFIX,
  formatCheckinCandidateLine,
  formatCheckinOutcomeBlock,
  formatCheckinOutcomeLine,
} from "./checkin-baseline-report";
import { BaselineReport } from "./latency-baseline";
import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * T-1561 — 체크인 baseline confirm/compare outcome 로그 포매터의 R-112 spec.
 * happy-path / error path / 분기 cover / negative cases 충분 cover 를 모두 담는다.
 * 순수 함수라 파일 시스템 · 환경변수 · 네트워크 없이 결정론적으로 검증한다(colocated unit).
 */
describe("checkin-baseline-report — outcome 로그 포매터 (ADR-0056 §Decision 3 (b))", () => {
  /** 검증 대상 축약 alias(동일 함수 — 한 줄 단언 가독성용). */
  const line = formatCheckinOutcomeLine;
  const block = formatCheckinOutcomeBlock;

  /** `established` 국면 결과 팩토리. */
  const est = (path: unknown): ConfirmOrCompareResult =>
    ({ outcome: "established", path }) as ConfirmOrCompareResult;

  /** `compared` 국면 결과 팩토리(회귀 여부 · 상세 본문 · 잉여 필드만 바꿔 쓴다). */
  const cmp = (
    regressed: unknown,
    report: unknown = "상세 본문",
    extra: Record<string, unknown> = {},
  ): ConfirmOrCompareResult =>
    ({
      outcome: "compared",
      comparison: { regressed },
      report,
      ...extra,
    }) as unknown as ConfirmOrCompareResult;

  /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
  const bad = (value: unknown): ConfirmOrCompareResult =>
    value as ConfirmOrCompareResult;

  it("happy-path: CHECKIN_LOG_PREFIX 가 확정 값과 일치하고 개행이 없다", () => {
    expect(CHECKIN_LOG_PREFIX).toBe("[perf][checkin-baseline]");
    expect(CHECKIN_LOG_PREFIX).not.toContain("\n");
  });

  describe("formatCheckinOutcomeLine — 한 줄 요약", () => {
    it("happy-path: established 는 접두와 path 원문을 그대로 싣는다", () => {
      expect(line(est("test/perf/baselines/s2.json"))).toBe(
        `${CHECKIN_LOG_PREFIX} outcome=established path=test/perf/baselines/s2.json`,
      );
    });

    it("happy-path: compared 는 regressed=false 를 싣는다", () => {
      expect(line(cmp(false))).toBe(
        `${CHECKIN_LOG_PREFIX} outcome=compared regressed=false`,
      );
    });

    it("분기 cover: regressed=true 분기는 true 를 싣는다", () => {
      expect(line(cmp(true))).toBe(
        `${CHECKIN_LOG_PREFIX} outcome=compared regressed=true`,
      );
    });

    it("negative: regressed=true 여도 throw 하지 않는다(exit code 불변)", () => {
      expect(() => line(cmp(true))).not.toThrow();
      expect(() => block(cmp(true, "회귀 상세"))).not.toThrow();
    });

    it("negative: 두 분기 모두 결과에 개행이 포함되지 않는다", () => {
      expect(line(est("/a b/x.json"))).not.toContain("\n");
      expect(line(cmp(true))).not.toContain("\n");
    });

    it("negative: path 를 정규화·가공하지 않고 원문 그대로 싣는다", () => {
      const raw = " ./a//b/../c.json ";
      expect(line(est(raw))).toBe(
        `${CHECKIN_LOG_PREFIX} outcome=established path=${raw}`,
      );
    });

    it("negative: compared 입력에 path 가 섞여 있어도 line 에 실리지 않는다", () => {
      const out = line(cmp(false, "본문", { path: "/srv/leak.json" }));
      expect(out).not.toContain("path=");
      expect(out).not.toContain("/srv/leak.json");
    });

    it("negative: 같은 입력 반복 호출이 항상 같은 문자열을 낸다(결정성)", () => {
      const input = est("/srv/repo/x.json");
      expect(line(input)).toBe(line(input));
    });

    it("error path: result 가 null · non-object 이면 TypeError", () => {
      expect(() => line(bad(null))).toThrow(TypeError);
      expect(() => line(bad("compared"))).toThrow(TypeError);
      expect(() => line(bad(7))).toThrow(TypeError);
    });

    it("error path: outcome 이 non-string 이면 TypeError", () => {
      expect(() => line(bad({ outcome: 7 }))).toThrow(TypeError);
    });

    it("error path: 알 수 없는 outcome 문자열이면 RangeError", () => {
      expect(() => line(bad({ outcome: "skipped" }))).toThrow(RangeError);
    });

    it("error path: established 의 path 가 non-string 이면 TypeError", () => {
      expect(() => line(est(42))).toThrow(TypeError);
    });

    it("error path: established 의 path 가 빈·공백-only 이면 RangeError", () => {
      expect(() => line(est(""))).toThrow(RangeError);
      expect(() => line(est("   "))).toThrow(RangeError);
    });

    it("error path: compared 의 comparison 이 부재면 TypeError", () => {
      expect(() => line(bad({ outcome: "compared" }))).toThrow(TypeError);
    });

    it("error path: compared 의 regressed 가 non-boolean 이면 TypeError", () => {
      expect(() => line(cmp("true"))).toThrow(TypeError);
    });
  });

  describe("formatCheckinOutcomeBlock — 상세 본문 결합", () => {
    it("happy-path: compared 는 line 과 report 를 개행 1 개로 잇는다", () => {
      const input = cmp(false, "상세 본문");
      expect(block(input)).toBe(`${line(input)}\n상세 본문`);
    });

    it("분기 cover: established 는 line 과 문자 그대로 같다(한 줄)", () => {
      const input = est("/srv/repo/x.json");
      expect(block(input)).toBe(line(input));
      expect(block(input)).not.toContain("\n");
    });

    it("분기 cover: compared 는 regressed=true 본문도 두 덩어리로 낸다", () => {
      const out = block(cmp(true, "회귀 상세"));
      expect(out.split("\n")[0]).toContain("regressed=true");
      expect(out.endsWith("회귀 상세")).toBe(true);
    });

    it("negative: report 원문을 가공(trim·재정렬)하지 않고 그대로 잇는다", () => {
      const report = "  머리 공백\n둘째 줄  ";
      expect(block(cmp(false, report))).toBe(`${line(cmp(false))}\n${report}`);
    });

    it("negative: 같은 입력 반복 호출이 항상 같은 문자열을 낸다(결정성)", () => {
      const input = cmp(true, "상세");
      expect(block(input)).toBe(block(input));
    });

    it("error path: report 가 non-string 이면 TypeError", () => {
      expect(() => block(cmp(false, 42))).toThrow(TypeError);
    });

    it("error path: report 가 빈·공백-only 이면 RangeError", () => {
      expect(() => block(cmp(false, ""))).toThrow(RangeError);
      expect(() => block(cmp(false, " \n "))).toThrow(RangeError);
    });

    it("error path: line 계약의 예외를 그대로 승계한다(null · 미지 outcome)", () => {
      expect(() => block(bad(null))).toThrow(TypeError);
      expect(() => block(bad({ outcome: "unknown", report: "본문" }))).toThrow(
        RangeError,
      );
    });
  });

  describe("formatCheckinCandidateLine — candidate 지표 한 줄 (T-1589)", () => {
    const cand = formatCheckinCandidateLine;
    /** 정상 candidate 팩토리 — 필드만 갈아끼워 국면을 만든다. */
    const rep = (over: Record<string, unknown> = {}): BaselineReport =>
      ({
        env: { label: "ci-linux-x64", concurrency: 4 },
        p50: 12,
        p95: 34.5,
        p99: 70,
        throughput: 210.25,
        errorRate: 0.02,
        count: 500,
        pass: true,
        ...over,
      }) as unknown as BaselineReport;
    /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
    const badRep = (value: unknown): BaselineReport => value as BaselineReport;
    const HEAD = `${CHECKIN_LOG_PREFIX} candidate label=ci-linux-x64 concurrency=4`;

    it("happy-path: 지표 9 개를 고정 순서 key=value 한 줄로 정확히 싣는다", () => {
      const out = cand(rep());
      expect(out).toBe(
        `${HEAD} p50=12 p95=34.5 p99=70 throughput=210.25 errorRate=0.02 count=500 pass=true`,
      );
      expect(out).not.toContain("\n");
    });

    it("분기 cover: 표본 0(p50·p95·p99 NaN, throughput 0)도 예외 없이 NaN 노출", () => {
      const zero = rep({
        p50: NaN,
        p95: NaN,
        p99: NaN,
        throughput: 0,
        count: 0,
      });
      expect(cand(zero)).toBe(
        `${HEAD} p50=NaN p95=NaN p99=NaN throughput=0 errorRate=0.02 count=0 pass=true`,
      );
    });

    it.each([true, false])("분기 cover: pass=%j 를 그대로 전사한다", (pass) =>
      expect(cand(rep({ pass }))).toContain(`pass=${pass}`),
    );

    it.each([0, 1])("negative: errorRate 경계값 %j 도 누락 없이 실린다", (v) =>
      expect(cand(rep({ errorRate: v }))).toContain(`errorRate=${v}`),
    );

    it("negative: 수치를 재계산·반올림하지 않고 원문 그대로 전사한다", () => {
      const out = cand(rep({ p95: 34.56789, throughput: 0.1 + 0.2 }));
      expect(out).toContain("p95=34.56789");
      expect(out).toContain("throughput=0.30000000000000004");
    });

    it("negative: 입력을 변형하지 않고(deep-equal) 반복 호출이 같은 문자열", () => {
      const input = rep();
      const snapshot = JSON.parse(JSON.stringify(input));
      expect(cand(input)).toBe(cand(input));
      expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
    });

    it.each([null, undefined, "candidate", 7])(
      "error path: candidate 가 %j 면 TypeError",
      (v) => expect(() => cand(badRep(v))).toThrow(TypeError),
    );

    it.each([null, undefined, "env", 7])(
      "error path: candidate.env 가 %j 면 TypeError",
      (env) => expect(() => cand(rep({ env }))).toThrow(TypeError),
    );

    it("error path: env.label 은 non-string 이면 TypeError, 빈·공백-only 면 RangeError", () => {
      const withLabel = (label: unknown) => () =>
        cand(rep({ env: { label, concurrency: 4 } }));
      expect(withLabel(7)).toThrow(TypeError);
      expect(withLabel("")).toThrow(RangeError);
      expect(withLabel("   ")).toThrow(RangeError);
    });

    it("error path: env.concurrency 가 non-number 면 TypeError", () =>
      expect(() =>
        cand(rep({ env: { label: "ci", concurrency: "4" } })),
      ).toThrow(TypeError));

    it.each(["p50", "p95", "p99", "throughput", "errorRate", "count"])(
      "error path: 수치 필드 %s 가 non-number · 부재면 TypeError",
      (key) => {
        expect(() => cand(rep({ [key]: "12" }))).toThrow(TypeError);
        expect(() => cand(rep({ [key]: undefined }))).toThrow(TypeError);
      },
    );

    it.each(["true", 1, null, undefined])(
      "error path: pass 가 %j 면 TypeError",
      (pass) => expect(() => cand(rep({ pass }))).toThrow(TypeError),
    );

    it("error path: 예외 메시지에 함수명 prefix 가 있어 호출측 추적이 된다", () => {
      expect(() => cand(badRep(null))).toThrow(/formatCheckinCandidateLine: /);
      expect(() => cand(rep({ p95: "x" }))).toThrow(/candidate\.p95/);
      expect(() => cand(rep({ env: { label: " ", concurrency: 1 } }))).toThrow(
        /candidate\.env\.label/,
      );
    });
  });
});

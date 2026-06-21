// period-bridge-to-persist-context.mapper.spec — T-0556. 순수 helper
// `toEvaluationPersistContext` 의 R-112 cover: happy path / error path / branch
// coverage / negative cases 충분 cover / 비변형 / regression(hqOrigin Q-0045).
// 신규 파일 100% coverage 목표.

import type { EvaluationPersistContext } from "../domain/evaluation-result.persist.mapper";

import { toEvaluationPersistContext } from "./period-bridge-to-persist-context.mapper";
import { PeriodBridgeDto } from "./period-bridge.dto";

/** 좌표 4 축 + 선택 reevaluate 를 갖는 PeriodBridgeDto plain 객체 조립 helper. */
function makeBridge(overrides: Partial<PeriodBridgeDto> = {}): PeriodBridgeDto {
  const dto = new PeriodBridgeDto();
  dto.personId = overrides.personId ?? "person-1";
  dto.period = overrides.period ?? "week";
  dto.scope = overrides.scope ?? "commit";
  dto.periodStart = overrides.periodStart ?? "2026-06-10T00:00:00+09:00";
  if (overrides.reevaluate !== undefined) {
    dto.reevaluate = overrides.reevaluate;
  }
  return dto;
}

describe("toEvaluationPersistContext", () => {
  describe("happy path — 유효 좌표 4-tuple 변환", () => {
    it("personId/period/scope 는 변형 없이 그대로 전사된다", () => {
      const bridge = makeBridge({
        personId: "person-42",
        period: "month",
        scope: "aggregate",
        periodStart: "2026-06-01T00:00:00+09:00",
      });

      const context = toEvaluationPersistContext(bridge);

      expect(context.personId).toBe("person-42");
      expect(context.period).toBe("month");
      expect(context.scope).toBe("aggregate");
    });

    it("periodStart(ISO string) 는 올바른 Date 인스턴스로 변환되어 getTime() 이 일치한다", () => {
      const iso = "2026-06-10T00:00:00+09:00";
      const bridge = makeBridge({ periodStart: iso });

      const context = toEvaluationPersistContext(bridge);

      expect(context.periodStart).toBeInstanceOf(Date);
      expect(Number.isNaN(context.periodStart.getTime())).toBe(false);
      expect(context.periodStart.getTime()).toBe(new Date(iso).getTime());
    });

    it("UTC 그리고 +09:00 등 다양한 timezone offset 의 ISO 도 결정적으로 변환된다", () => {
      const utcBridge = makeBridge({ periodStart: "2026-06-10T00:00:00Z" });
      const kstBridge = makeBridge({
        periodStart: "2026-06-10T09:00:00+09:00",
      });

      const utcContext = toEvaluationPersistContext(utcBridge);
      const kstContext = toEvaluationPersistContext(kstBridge);

      // 동일 instant 의 두 표현 — 변환 후 getTime() 도 동일.
      expect(utcContext.periodStart.getTime()).toBe(
        kstContext.periodStart.getTime(),
      );
    });

    it("반환 값은 EvaluationPersistContext 형태(4-field) 이며 reevaluate 축은 출력에 포함되지 않는다", () => {
      const bridge = makeBridge({ reevaluate: true });

      const context = toEvaluationPersistContext(bridge);

      // 컴파일러가 EvaluationPersistContext 4-field 만 허용하지만, 런타임 단언으로
      // reevaluate 가 새 객체에 새어 들어가지 않았는지 명시 검증(R-112 negative).
      expect(Object.keys(context).sort()).toEqual([
        "period",
        "periodStart",
        "personId",
        "scope",
      ]);
      expect((context as unknown as Record<string, unknown>).reevaluate).toBe(
        undefined,
      );
    });
  });

  describe("error path — fail-fast 한국어 TypeError", () => {
    it("bridge 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toEvaluationPersistContext(null as unknown as PeriodBridgeDto),
      ).toThrow(TypeError);
      expect(() =>
        toEvaluationPersistContext(null as unknown as PeriodBridgeDto),
      ).toThrow("null/undefined 일 수 없다");
    });

    it("bridge 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toEvaluationPersistContext(undefined as unknown as PeriodBridgeDto),
      ).toThrow(TypeError);
      expect(() =>
        toEvaluationPersistContext(undefined as unknown as PeriodBridgeDto),
      ).toThrow("null/undefined 일 수 없다");
    });

    it("periodStart 가 비-string(number) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      (bridge as unknown as { periodStart: unknown }).periodStart =
        1718000000000;

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "string 이어야 한다",
      );
    });

    it("periodStart 가 비-string(Date 객체 직접 전달) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      (bridge as unknown as { periodStart: unknown }).periodStart = new Date();

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "string 이어야 한다",
      );
    });

    it("periodStart 가 비-string(undefined) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      (bridge as unknown as { periodStart: unknown }).periodStart = undefined;

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "string 이어야 한다",
      );
    });

    it("periodStart 가 빈 string 이면 한국어 메시지 TypeError 를 던진다(누락 vs 잘못된 형식 구분)", () => {
      const bridge = makeBridge({ periodStart: "" });

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "빈 string 일 수 없다",
      );
    });

    it("periodStart 가 Invalid Date 를 만드는 string('not-a-date') 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge({ periodStart: "not-a-date" });

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "유효한 ISO 날짜가 아니다",
      );
    });

    it("periodStart 가 Invalid Date 를 만드는 string('2026-13-99') 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge({ periodStart: "2026-13-99" });

      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "유효한 ISO 날짜가 아니다",
      );
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 유효 변환 분기 — 모든 방어 통과 후 새 객체 반환", () => {
      const bridge = makeBridge();
      const context = toEvaluationPersistContext(bridge);
      expect(context).toBeDefined();
      expect(context.periodStart).toBeInstanceOf(Date);
    });

    it("(b) bridge null 거부 분기", () => {
      expect(() =>
        toEvaluationPersistContext(null as unknown as PeriodBridgeDto),
      ).toThrow(TypeError);
    });

    it("(c) periodStart 비-string 거부 분기", () => {
      const bridge = makeBridge();
      (bridge as unknown as { periodStart: unknown }).periodStart = 42;
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "string 이어야 한다",
      );
    });

    it("(d) periodStart 빈 string 거부 분기", () => {
      const bridge = makeBridge({ periodStart: "" });
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "빈 string 일 수 없다",
      );
    });

    it("(e) periodStart Invalid Date 거부 분기", () => {
      const bridge = makeBridge({ periodStart: "garbage" });
      expect(() => toEvaluationPersistContext(bridge)).toThrow(
        "유효한 ISO 날짜가 아니다",
      );
    });
  });

  describe("negative cases 충분 cover — 좌표 무결성 / 비변형 / 누락 단언", () => {
    it("personId 가 빈 string 이어도 변환은 통과한다(상류 @IsNotEmpty 책임 — 본 매퍼는 string 축 정규화 0)", () => {
      // evaluation-persisted-period-coordinates 의 string 축 빈 string 허용 정신과 정합 —
      // periodStart Date 축은 거부하되 string 축은 controller-scope 책임.
      const bridge = makeBridge({ personId: "" });
      const context = toEvaluationPersistContext(bridge);
      expect(context.personId).toBe("");
    });

    it("입력 bridge 객체를 mutate 하지 않는다(호출 후 모든 필드 그대로)", () => {
      const bridge = makeBridge({
        personId: "p-keep",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-10T00:00:00+09:00",
        reevaluate: true,
      });
      const snapshot = {
        personId: bridge.personId,
        period: bridge.period,
        scope: bridge.scope,
        periodStart: bridge.periodStart,
        reevaluate: bridge.reevaluate,
      };

      toEvaluationPersistContext(bridge);

      expect(bridge.personId).toBe(snapshot.personId);
      expect(bridge.period).toBe(snapshot.period);
      expect(bridge.scope).toBe(snapshot.scope);
      // periodStart 는 여전히 string(변환은 새 Date 인스턴스로 분리).
      expect(bridge.periodStart).toBe(snapshot.periodStart);
      expect(typeof bridge.periodStart).toBe("string");
      expect(bridge.reevaluate).toBe(snapshot.reevaluate);
    });

    it("반환 객체의 periodStart 는 새 Date 인스턴스로, 입력 string 과 분리된 instant 표현", () => {
      const bridge = makeBridge({ periodStart: "2026-06-10T00:00:00+09:00" });
      const context = toEvaluationPersistContext(bridge);

      // 새 Date 인스턴스(입력은 string, 출력은 Date) — 동일 instant 의 다른 표현.
      expect(context.periodStart).toBeInstanceOf(Date);
      // 입력 string 은 변환 후에도 그대로 string(비변형 단언 보강).
      expect(typeof bridge.periodStart).toBe("string");
    });

    it("연속 호출 결과는 결정적이다(같은 입력 → 같은 출력 instant)", () => {
      const bridge = makeBridge({ periodStart: "2026-06-10T00:00:00+09:00" });

      const first = toEvaluationPersistContext(bridge);
      const second = toEvaluationPersistContext(bridge);

      expect(first.personId).toBe(second.personId);
      expect(first.period).toBe(second.period);
      expect(first.scope).toBe(second.scope);
      expect(first.periodStart.getTime()).toBe(second.periodStart.getTime());
    });

    it("reevaluate 가 출력에 누락된다(축 누락 단언 강화)", () => {
      const bridgeTrue = makeBridge({ reevaluate: true });
      const bridgeFalse = makeBridge({ reevaluate: false });
      const bridgeNone = makeBridge();

      const ctxTrue = toEvaluationPersistContext(bridgeTrue);
      const ctxFalse = toEvaluationPersistContext(bridgeFalse);
      const ctxNone = toEvaluationPersistContext(bridgeNone);

      // 입력 reevaluate 값에 무관하게 출력 객체에 reevaluate 키가 없음.
      expect("reevaluate" in ctxTrue).toBe(false);
      expect("reevaluate" in ctxFalse).toBe(false);
      expect("reevaluate" in ctxNone).toBe(false);
    });

    it("반환 타입은 EvaluationPersistContext(컴파일러 강제) — 본 런타임 단언은 type assignment 검증", () => {
      const bridge = makeBridge();
      const context: EvaluationPersistContext =
        toEvaluationPersistContext(bridge);
      // type 호환성 자체는 컴파일러가 본 file 의 type annotation 으로 강제 — 런타임은
      // 필드 존재만 추가 단언.
      expect(typeof context.personId).toBe("string");
      expect(typeof context.period).toBe("string");
      expect(typeof context.scope).toBe("string");
      expect(context.periodStart).toBeInstanceOf(Date);
    });
  });

  describe("regression (hqOrigin Q-0045) — Invalid Date silent 통과 회귀 방지", () => {
    it("periodStart='not-a-date' 가 Invalid Date 로 silent 통과하면 fail (run-side chain 좌표 무결성 보호)", () => {
      // Q-0045 옵션1 의 run-side chain 은 본 매퍼를 single source 로 사용한다. 매퍼가
      // Invalid Date 를 silent 반환하면 downstream 차집합 매칭·영속화가 비결정적으로
      // 무너져 평가 누락/중복을 유발한다 — 이 test 가 회귀 시점에 fail 하도록 박제.
      const bridge = makeBridge({ periodStart: "not-a-date" });

      let thrown: unknown = null;
      try {
        const result = toEvaluationPersistContext(bridge);
        // 여기 도달하면 회귀 — Invalid Date 가 silent 통과한 것.
        thrown = result;
      } catch (error) {
        thrown = error;
      }

      // 반드시 TypeError 가 던져져야 한다(silent 통과 = 회귀).
      expect(thrown).toBeInstanceOf(TypeError);
      // 메시지가 "유효한 ISO 날짜가 아니다" 어휘를 포함해야 한다(원인 식별성).
      expect((thrown as TypeError).message).toContain(
        "유효한 ISO 날짜가 아니다",
      );
      // 메시지가 원본 string 을 echo 해 디버깅 식별성을 유지한다.
      expect((thrown as TypeError).message).toContain("not-a-date");
    });

    it("regression — 빈 string periodStart 도 silent 통과 금지(Date('') 가 Invalid 라 silent 진입 가능)", () => {
      const bridge = makeBridge({ periodStart: "" });
      expect(() => toEvaluationPersistContext(bridge)).toThrow(TypeError);
    });
  });
});

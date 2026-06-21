// persist-result-to-run-outcome.mapper.spec — T-0557. 순수 helper
// `toUnevaluatedFillRunOutcome` 의 R-112 cover: happy path / error path / branch
// coverage / negative cases 충분 cover / 비변형 / regression(hqOrigin Q-0045).
// 신규 파일 100% coverage 목표. `Assessment` 의존 부분은 plain 객체 stub 으로 충족
// (실 Prisma/DB 0 — 본 매퍼는 result.created 만 읽고 assessment 본문은 안 읽는다).

import type { Assessment } from "@prisma/client";

import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";

import { PeriodBridgeDto } from "./period-bridge.dto";
import { toUnevaluatedFillRunOutcome } from "./persist-result-to-run-outcome.mapper";

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

/**
 * PeriodBridgeAdminPersistResult plain stub 조립 helper. 본 매퍼는 result.created 만
 * 읽으므로 assessment 는 최소 plain 객체 stub 으로 충족(실 Prisma row 0).
 */
function makeResult(created: boolean): PeriodBridgeAdminPersistResult {
  return {
    // 본 매퍼는 assessment 본문을 읽지 않으므로 식별자만 가진 plain stub 으로 충분.
    assessment: { id: "assessment-1" } as unknown as Assessment,
    created,
  };
}

describe("toUnevaluatedFillRunOutcome", () => {
  describe("happy path — 좌표 echo + created→status 도출", () => {
    it("(a) created === true → status 'evaluated' + 좌표 4 축 echo 정확", () => {
      const bridge = makeBridge({
        personId: "person-42",
        period: "month",
        scope: "aggregate",
        periodStart: "2026-06-01T00:00:00+09:00",
      });

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(outcome.status).toBe("evaluated");
      expect(outcome.personId).toBe("person-42");
      expect(outcome.period).toBe("month");
      expect(outcome.scope).toBe("aggregate");
      expect(outcome.periodStart).toBe("2026-06-01T00:00:00+09:00");
    });

    it("(b) created === false → status 'skipped' + 좌표 4 축 echo 정확", () => {
      const bridge = makeBridge({
        personId: "person-7",
        period: "day",
        scope: "document",
        periodStart: "2026-06-21T00:00:00+09:00",
      });

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(false));

      expect(outcome.status).toBe("skipped");
      expect(outcome.personId).toBe("person-7");
      expect(outcome.period).toBe("day");
      expect(outcome.scope).toBe("document");
      expect(outcome.periodStart).toBe("2026-06-21T00:00:00+09:00");
    });

    it("periodStart 는 string 그대로 echo(추가 직렬화/Date 변환 0)", () => {
      const iso = "2026-06-10T00:00:00Z";
      const bridge = makeBridge({ periodStart: iso });

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(typeof outcome.periodStart).toBe("string");
      expect(outcome.periodStart).toBe(iso);
    });

    it("evaluatedCount 와 reason 은 v1 에서 설정하지 않는다(미설정 → 집계 0 취급)", () => {
      const bridge = makeBridge();

      const evaluated = toUnevaluatedFillRunOutcome(bridge, makeResult(true));
      const skipped = toUnevaluatedFillRunOutcome(bridge, makeResult(false));

      // 키 자체가 outcome 객체에 없어야 한다(undefined 명시 설정도 아님).
      expect("evaluatedCount" in evaluated).toBe(false);
      expect("reason" in evaluated).toBe(false);
      expect("evaluatedCount" in skipped).toBe(false);
      expect("reason" in skipped).toBe(false);
    });

    it("반환 객체는 좌표 4 축 + status 키만 갖는다(failed 합성/평가 본문 누출 0)", () => {
      const bridge = makeBridge();

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(Object.keys(outcome).sort()).toEqual([
        "period",
        "periodStart",
        "personId",
        "scope",
        "status",
      ]);
    });
  });

  describe("error path — fail-fast 한국어 TypeError", () => {
    it("bridge 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunOutcome(
          null as unknown as PeriodBridgeDto,
          makeResult(true),
        ),
      ).toThrow(TypeError);
      expect(() =>
        toUnevaluatedFillRunOutcome(
          null as unknown as PeriodBridgeDto,
          makeResult(true),
        ),
      ).toThrow("bridge 는 null/undefined 일 수 없다");
    });

    it("bridge 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunOutcome(
          undefined as unknown as PeriodBridgeDto,
          makeResult(false),
        ),
      ).toThrow("bridge 는 null/undefined 일 수 없다");
    });

    it("result 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      expect(() =>
        toUnevaluatedFillRunOutcome(
          bridge,
          null as unknown as PeriodBridgeAdminPersistResult,
        ),
      ).toThrow(TypeError);
      expect(() =>
        toUnevaluatedFillRunOutcome(
          bridge,
          null as unknown as PeriodBridgeAdminPersistResult,
        ),
      ).toThrow("result 는 null/undefined 일 수 없다");
    });

    it("result 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      expect(() =>
        toUnevaluatedFillRunOutcome(
          bridge,
          undefined as unknown as PeriodBridgeAdminPersistResult,
        ),
      ).toThrow("result 는 null/undefined 일 수 없다");
    });

    it("result.created 가 undefined(비-boolean) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      const result = {
        assessment: {} as unknown as Assessment,
        created: undefined,
      } as unknown as PeriodBridgeAdminPersistResult;

      expect(() => toUnevaluatedFillRunOutcome(bridge, result)).toThrow(
        TypeError,
      );
      expect(() => toUnevaluatedFillRunOutcome(bridge, result)).toThrow(
        "result.created 는 boolean 이어야 한다",
      );
    });

    it("result.created 가 'true'(string, 비-boolean) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      const result = {
        assessment: {} as unknown as Assessment,
        created: "true",
      } as unknown as PeriodBridgeAdminPersistResult;

      expect(() => toUnevaluatedFillRunOutcome(bridge, result)).toThrow(
        "result.created 는 boolean 이어야 한다",
      );
    });

    it("result.created 가 1(number, 비-boolean) 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bridge = makeBridge();
      const result = {
        assessment: {} as unknown as Assessment,
        created: 1,
      } as unknown as PeriodBridgeAdminPersistResult;

      expect(() => toUnevaluatedFillRunOutcome(bridge, result)).toThrow(
        "result.created 는 boolean 이어야 한다",
      );
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) created === true 분기 → evaluated", () => {
      const outcome = toUnevaluatedFillRunOutcome(
        makeBridge(),
        makeResult(true),
      );
      expect(outcome.status).toBe("evaluated");
    });

    it("(b) created === false 분기 → skipped", () => {
      const outcome = toUnevaluatedFillRunOutcome(
        makeBridge(),
        makeResult(false),
      );
      expect(outcome.status).toBe("skipped");
    });

    it("(c) bridge null 거부 분기", () => {
      expect(() =>
        toUnevaluatedFillRunOutcome(
          null as unknown as PeriodBridgeDto,
          makeResult(true),
        ),
      ).toThrow(TypeError);
    });

    it("(d) result null 거부 분기", () => {
      expect(() =>
        toUnevaluatedFillRunOutcome(
          makeBridge(),
          null as unknown as PeriodBridgeAdminPersistResult,
        ),
      ).toThrow(TypeError);
    });

    it("(e) created 비-boolean 거부 분기", () => {
      const result = {
        assessment: {} as unknown as Assessment,
        created: null,
      } as unknown as PeriodBridgeAdminPersistResult;
      expect(() => toUnevaluatedFillRunOutcome(makeBridge(), result)).toThrow(
        "result.created 는 boolean 이어야 한다",
      );
    });
  });

  describe("negative cases 충분 cover — 무결성 / 비변형 / 별개 객체 단언", () => {
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

      toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(bridge.personId).toBe(snapshot.personId);
      expect(bridge.period).toBe(snapshot.period);
      expect(bridge.scope).toBe(snapshot.scope);
      expect(bridge.periodStart).toBe(snapshot.periodStart);
      expect(bridge.reevaluate).toBe(snapshot.reevaluate);
    });

    it("입력 result 객체를 mutate 하지 않는다(created 그대로)", () => {
      const result = makeResult(false);

      toUnevaluatedFillRunOutcome(makeBridge(), result);

      expect(result.created).toBe(false);
    });

    it("반환 outcome 은 입력 bridge 와 별개 객체다(같은 참조 아님)", () => {
      const bridge = makeBridge();

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(outcome).not.toBe(bridge as unknown as object);
    });

    it("연속 호출 결과는 결정적이다(같은 입력 → 같은 outcome)", () => {
      const bridge = makeBridge({ periodStart: "2026-06-10T00:00:00+09:00" });
      const result = makeResult(true);

      const first = toUnevaluatedFillRunOutcome(bridge, result);
      const second = toUnevaluatedFillRunOutcome(bridge, result);

      expect(first).toEqual(second);
    });

    it("좌표 echo 는 result.created 값과 독립이다(같은 좌표, created 만 다름)", () => {
      const bridge = makeBridge({
        personId: "p-x",
        period: "month",
        scope: "aggregate",
        periodStart: "2026-06-01T00:00:00+09:00",
      });

      const evaluated = toUnevaluatedFillRunOutcome(bridge, makeResult(true));
      const skipped = toUnevaluatedFillRunOutcome(bridge, makeResult(false));

      // 좌표 4 축은 두 outcome 에서 동일(created 만 status 를 가른다).
      expect(evaluated.personId).toBe(skipped.personId);
      expect(evaluated.period).toBe(skipped.period);
      expect(evaluated.scope).toBe(skipped.scope);
      expect(evaluated.periodStart).toBe(skipped.periodStart);
      expect(evaluated.status).not.toBe(skipped.status);
    });

    it("personId 가 빈 string 이어도 echo 는 통과한다(상류 @IsNotEmpty 책임 — 본 매퍼는 좌표 정규화 0)", () => {
      const bridge = makeBridge({ personId: "" });

      const outcome = toUnevaluatedFillRunOutcome(bridge, makeResult(true));

      expect(outcome.personId).toBe("");
      expect(outcome.status).toBe("evaluated");
    });
  });

  describe("regression (hqOrigin Q-0045) — status 무결성 회귀 방지", () => {
    it("result.created 가 비-boolean('false' string)인데 status 가 silent 으로 도출되면 fail(union 밖 진입 차단)", () => {
      // Q-0045 run-side chain 은 본 매퍼를 single source 로 사용한다. "false" string 은
      // truthy 라 단순 삼항으로 도출하면 evaluated 로 오판된다 — 명시 거부해야 한다.
      const bridge = makeBridge();
      const result = {
        assessment: {} as unknown as Assessment,
        created: "false",
      } as unknown as PeriodBridgeAdminPersistResult;

      let thrown: unknown = null;
      try {
        const outcome = toUnevaluatedFillRunOutcome(bridge, result);
        // 여기 도달하면 회귀 — 비-boolean created 가 silent 으로 status 를 도출한 것.
        thrown = outcome;
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(TypeError);
      expect((thrown as TypeError).message).toContain(
        "result.created 는 boolean 이어야 한다",
      );
    });

    it("status 도출이 created 와 역전되지 않는다 — created true 는 반드시 evaluated", () => {
      // created → status 매핑 역전(true→skipped) 회귀 시 fail 하도록 박제.
      const outcome = toUnevaluatedFillRunOutcome(
        makeBridge(),
        makeResult(true),
      );
      expect(outcome.status).toBe("evaluated");
      expect(outcome.status).not.toBe("skipped");
    });

    it("status 도출이 created 와 역전되지 않는다 — created false 는 반드시 skipped", () => {
      const outcome = toUnevaluatedFillRunOutcome(
        makeBridge(),
        makeResult(false),
      );
      expect(outcome.status).toBe("skipped");
      expect(outcome.status).not.toBe("evaluated");
    });
  });
});

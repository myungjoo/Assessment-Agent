// run-unevaluated-fill-coordinate.spec — T-0558. impure 실행 helper
// `runUnevaluatedFillCoordinate` 의 R-112 cover: happy path / error path / branch
// coverage / negative cases 충분 cover / 비변형 / regression(hqOrigin Q-0045).
// runner 는 jest mock 함수(`jest.fn().mockResolvedValue/.mockRejectedValue`)로 충족 —
// 실 service/LLM/DB 0. 신규 파일 100% coverage 목표.

import type { Assessment } from "@prisma/client";

import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";

import { PeriodBridgeDto } from "./period-bridge.dto";
import {
  runUnevaluatedFillCoordinate,
  type UnevaluatedFillCoordinateRunner,
} from "./run-unevaluated-fill-coordinate";

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

/** PeriodBridgeAdminPersistResult plain stub — assessment 는 plain 객체 stub(실 DB 0). */
function makeResult(created: boolean): PeriodBridgeAdminPersistResult {
  return {
    assessment: { id: "assessment-stub" } as unknown as Assessment,
    created,
  };
}

/** created 결과로 resolve 하는 jest mock runner. */
function resolvingRunner(created: boolean): UnevaluatedFillCoordinateRunner {
  return jest.fn().mockResolvedValue(makeResult(created));
}

/** 주어진 값으로 reject 하는 jest mock runner. */
function rejectingRunner(error: unknown): UnevaluatedFillCoordinateRunner {
  return jest.fn().mockRejectedValue(error);
}

describe("runUnevaluatedFillCoordinate", () => {
  describe("happy path — runner 결과를 outcome 으로 합성", () => {
    it("(a) runner 가 created=true 로 resolve → status 'evaluated' + 좌표 echo", async () => {
      const bridge = makeBridge({
        personId: "person-42",
        period: "month",
        scope: "aggregate",
        periodStart: "2026-06-01T00:00:00+09:00",
      });
      const runner = resolvingRunner(true);

      const outcome = await runUnevaluatedFillCoordinate(bridge, runner);

      expect(outcome.status).toBe("evaluated");
      expect(outcome.personId).toBe("person-42");
      expect(outcome.period).toBe("month");
      expect(outcome.scope).toBe("aggregate");
      expect(outcome.periodStart).toBe("2026-06-01T00:00:00+09:00");
      expect(runner).toHaveBeenCalledTimes(1);
    });

    it("(b) runner 가 created=false 로 resolve → status 'skipped' + 좌표 echo", async () => {
      const bridge = makeBridge({ personId: "person-7" });
      const runner = resolvingRunner(false);

      const outcome = await runUnevaluatedFillCoordinate(bridge, runner);

      expect(outcome.status).toBe("skipped");
      expect(outcome.personId).toBe("person-7");
      expect(outcome.period).toBe("week");
      expect(outcome.scope).toBe("commit");
      expect(outcome.periodStart).toBe("2026-06-10T00:00:00+09:00");
    });

    it("(c) runner 가 reject → status 'failed' + 좌표 echo + reason", async () => {
      const bridge = makeBridge({ personId: "person-9" });
      const runner = rejectingRunner(new Error("수집 0건"));

      const outcome = await runUnevaluatedFillCoordinate(bridge, runner);

      expect(outcome.status).toBe("failed");
      expect(outcome.personId).toBe("person-9");
      expect(outcome.period).toBe("week");
      expect(outcome.scope).toBe("commit");
      expect(outcome.periodStart).toBe("2026-06-10T00:00:00+09:00");
      expect(outcome.reason).toBe("수집 0건");
    });

    it("성공 path 는 T-0557 매퍼 위임 — evaluated outcome 에 evaluatedCount/reason 미설정", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        resolvingRunner(true),
      );
      expect(outcome.evaluatedCount).toBeUndefined();
      expect(outcome.reason).toBeUndefined();
    });
  });

  describe("error path — runner 호출 전 fail-fast 한국어 TypeError", () => {
    it("bridge 가 null 이면 한국어 메시지 TypeError 를 던진다", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          null as unknown as PeriodBridgeDto,
          resolvingRunner(true),
        ),
      ).rejects.toThrow("null/undefined 일 수 없다");
    });

    it("bridge 가 undefined 이면 한국어 메시지 TypeError 를 던진다", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          undefined as unknown as PeriodBridgeDto,
          resolvingRunner(true),
        ),
      ).rejects.toThrow(TypeError);
    });

    it("runner 가 null 이면 한국어 메시지 TypeError 를 던진다(호출 전 방어)", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          makeBridge(),
          null as unknown as UnevaluatedFillCoordinateRunner,
        ),
      ).rejects.toThrow("runner 는 함수여야 한다");
    });

    it("runner 가 undefined 이면 한국어 메시지 TypeError 를 던진다", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          makeBridge(),
          undefined as unknown as UnevaluatedFillCoordinateRunner,
        ),
      ).rejects.toThrow(TypeError);
    });

    it("runner 가 비-function(객체) 이면 한국어 메시지 TypeError 를 던진다", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          makeBridge(),
          {} as unknown as UnevaluatedFillCoordinateRunner,
        ),
      ).rejects.toThrow("runner 는 함수여야 한다");
    });

    it("bridge null 방어는 runner 호출 전 — runner 가 호출되지 않는다", async () => {
      const runner = resolvingRunner(true);
      await expect(
        runUnevaluatedFillCoordinate(
          null as unknown as PeriodBridgeDto,
          runner,
        ),
      ).rejects.toThrow(TypeError);
      expect(runner).not.toHaveBeenCalled();
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 성공 분기 — runner resolve → 매퍼 위임", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        resolvingRunner(true),
      );
      expect(outcome.status).toBe("evaluated");
    });

    it("(b) 실패 분기 — runner reject → failed 합성", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(new Error("LLM 오류")),
      );
      expect(outcome.status).toBe("failed");
      expect(outcome.reason).toBe("LLM 오류");
    });

    it("(c) reason 합성 분기 — Error 인스턴스면 error.message", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(new Error("persist 실패")),
      );
      expect(outcome.reason).toBe("persist 실패");
    });

    it("(d) reason 합성 분기 — 비-Error throw 값이면 String(error)", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner("plain-string-error"),
      );
      expect(outcome.reason).toBe("plain-string-error");
    });

    it("(e) bridge null 거부 분기", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          null as unknown as PeriodBridgeDto,
          resolvingRunner(true),
        ),
      ).rejects.toThrow(TypeError);
    });

    it("(f) runner 비-function 거부 분기", async () => {
      await expect(
        runUnevaluatedFillCoordinate(
          makeBridge(),
          42 as unknown as UnevaluatedFillCoordinateRunner,
        ),
      ).rejects.toThrow(TypeError);
    });
  });

  describe("negative cases 충분 cover — 안전 직렬화 / 비변형 / 별개 객체", () => {
    it("runner 가 Error 객체 reject → reason 은 error.message", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(new Error("경계 케이스 에러")),
      );
      expect(outcome.status).toBe("failed");
      expect(outcome.reason).toBe("경계 케이스 에러");
    });

    it("runner 가 string reject → reason 은 String(error) 안전 직렬화", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner("문자열 reject"),
      );
      expect(outcome.reason).toBe("문자열 reject");
    });

    it("runner 가 숫자 reject → reason 은 String(error) 안전 직렬화", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(500),
      );
      expect(outcome.reason).toBe("500");
    });

    it("runner 가 null reject → reason 은 'null' 안전 직렬화(throw 0)", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(null),
      );
      expect(outcome.status).toBe("failed");
      expect(outcome.reason).toBe("null");
    });

    it("runner 가 undefined reject → reason 은 'undefined' 안전 직렬화(throw 0)", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(undefined),
      );
      expect(outcome.status).toBe("failed");
      expect(outcome.reason).toBe("undefined");
    });

    it("runner 가 plain 객체 reject → reason 은 '[object Object]' 안전 직렬화", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner({ code: "X" }),
      );
      expect(outcome.status).toBe("failed");
      expect(typeof outcome.reason).toBe("string");
    });

    it("failed outcome 에 evaluatedCount 미설정(T-0552 가 evaluated status 만 합산)", async () => {
      const outcome = await runUnevaluatedFillCoordinate(
        makeBridge(),
        rejectingRunner(new Error("x")),
      );
      expect(outcome.evaluatedCount).toBeUndefined();
    });

    it("입력 bridge 객체를 mutate 하지 않는다(reject 흡수 후에도 모든 필드 그대로)", async () => {
      const bridge = makeBridge({
        personId: "p-keep",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-10T00:00:00+09:00",
        reevaluate: true,
      });
      const snapshot = { ...bridge };

      await runUnevaluatedFillCoordinate(
        bridge,
        rejectingRunner(new Error("아무거나")),
      );

      expect(bridge.personId).toBe(snapshot.personId);
      expect(bridge.period).toBe(snapshot.period);
      expect(bridge.scope).toBe(snapshot.scope);
      expect(bridge.periodStart).toBe(snapshot.periodStart);
      expect(bridge.reevaluate).toBe(snapshot.reevaluate);
    });

    it("failed outcome 은 입력 bridge 와 별개 객체(echo 만, 참조 공유 0)", async () => {
      const bridge = makeBridge();
      const outcome = await runUnevaluatedFillCoordinate(
        bridge,
        rejectingRunner(new Error("x")),
      );
      expect(outcome).not.toBe(bridge as unknown as object);
    });
  });

  describe("regression (hqOrigin Q-0045) — 부분 실패 흡수 + 좌표 무결성", () => {
    it("runner reject 시 helper 가 에러를 재던지지 않고 failed outcome 으로 흡수한다", async () => {
      // 재던지면(흡수 실패) 이 await 가 reject 되어 test 가 fail 한다 — Q-0045 run-side
      // chain 의 부분 실패 흡수(REQ-037 일괄 평가) 회귀 방지.
      let thrown: unknown = null;
      let outcome: Awaited<
        ReturnType<typeof runUnevaluatedFillCoordinate>
      > | null = null;
      try {
        outcome = await runUnevaluatedFillCoordinate(
          makeBridge(),
          rejectingRunner(new Error("좌표 1개 실패")),
        );
      } catch (error) {
        thrown = error;
      }

      // 재던짐 0 — 반드시 failed outcome 으로 흡수돼야 한다.
      expect(thrown).toBeNull();
      expect(outcome).not.toBeNull();
      expect(outcome?.status).toBe("failed");
      expect(outcome?.reason).toBe("좌표 1개 실패");
    });

    it("failed outcome 의 좌표 4 축이 bridge echo 와 정확히 일치한다(어긋나면 fail)", async () => {
      // 좌표 무결성 회귀 방지 — failed outcome 의 4 축이 입력 좌표와 어긋나면 downstream
      // 집계/UI 가 어느 좌표가 실패했는지 오인한다.
      const bridge = makeBridge({
        personId: "person-x",
        period: "day",
        scope: "document",
        periodStart: "2026-06-15T00:00:00+09:00",
      });

      const outcome = await runUnevaluatedFillCoordinate(
        bridge,
        rejectingRunner(new Error("실패")),
      );

      expect(outcome.personId).toBe(bridge.personId);
      expect(outcome.period).toBe(bridge.period);
      expect(outcome.scope).toBe(bridge.scope);
      expect(outcome.periodStart).toBe(bridge.periodStart);
    });
  });
});

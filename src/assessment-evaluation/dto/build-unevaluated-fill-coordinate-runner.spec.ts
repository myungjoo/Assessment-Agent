// build-unevaluated-fill-coordinate-runner.spec — T-0559. 순수 factory
// `buildUnevaluatedFillCoordinateRunner` 의 R-112 cover: happy path / error path / branch
// coverage / negative cases 충분 cover / 비변형 / regression(hqOrigin Q-0045). 신규
// 파일은 분기 단순하므로 100% coverage 목표. `persist` 는 jest mock, person/options/
// PeriodBridgeAdminPersistResult 는 plain 객체 stub(실 service/LLM/DB 0).

import type { Assessment } from "@prisma/client";

import type { ScoringOptions } from "../evaluation-scoring.service";
import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import {
  buildUnevaluatedFillCoordinateRunner,
  type GenerateAndPersistFn,
} from "./build-unevaluated-fill-coordinate-runner";
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

/** resolved person 입력 stub(serviceIdentities — service + externalId). */
function makePerson(): PeriodBridgePersonInput {
  return {
    serviceIdentities: [{ service: "github", externalId: "gh-octocat" }],
  };
}

/** scoring 옵션 stub(modelId). */
function makeOptions(modelId = "gpt-test"): ScoringOptions {
  return { modelId };
}

/** PeriodBridgeAdminPersistResult stub(read-back Assessment + created 플래그). */
function makePersistResult(created = true): PeriodBridgeAdminPersistResult {
  return {
    assessment: { id: "assessment-1" } as unknown as Assessment,
    created,
  };
}

/** jest mock persist — 기본 resolve, 호출별로 .mockResolvedValue/.mockRejectedValue 재설정. */
function makePersistMock(
  result: PeriodBridgeAdminPersistResult = makePersistResult(),
): jest.MockedFunction<GenerateAndPersistFn> {
  return jest
    .fn<ReturnType<GenerateAndPersistFn>, Parameters<GenerateAndPersistFn>>()
    .mockResolvedValue(result) as jest.MockedFunction<GenerateAndPersistFn>;
}

describe("buildUnevaluatedFillCoordinateRunner", () => {
  describe("happy path — 유효 좌표 + resolved person + options + mock persist", () => {
    it("(a) 반환값은 함수(thunk) 이다", () => {
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        makePersistMock(),
      );

      expect(typeof runner).toBe("function");
    });

    it("(b) thunk 를 await 하면 persist 가 (person, { since: periodStart }, options, context, reevaluate) 로 1 회 호출되고 resolve 값을 그대로 반환한다", async () => {
      const bridge = makeBridge({
        periodStart: "2026-06-10T00:00:00+09:00",
        reevaluate: true,
      });
      const person = makePerson();
      const options = makeOptions("gpt-4o");
      const expected = makePersistResult(false);
      const persist = makePersistMock(expected);

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        person,
        options,
        persist,
      );
      const result = await runner();

      expect(persist).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenCalledWith(
        person,
        { since: "2026-06-10T00:00:00+09:00" },
        options,
        toEvaluationPersistContext(bridge),
        true,
      );
      // mock 의 resolve 값(PeriodBridgeAdminPersistResult) 이 그대로 반환됨.
      expect(result).toBe(expected);
    });

    it("(c) context 인자는 toEvaluationPersistContext(bridge) 와 동등하다(personId/period/scope 전사 + periodStart Date)", async () => {
      const bridge = makeBridge({
        personId: "person-42",
        period: "month",
        scope: "aggregate",
        periodStart: "2026-06-01T00:00:00+09:00",
      });
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();

      const passedContext = persist.mock.calls[0][3];
      const expectedContext = toEvaluationPersistContext(bridge);
      expect(passedContext.personId).toBe(expectedContext.personId);
      expect(passedContext.period).toBe(expectedContext.period);
      expect(passedContext.scope).toBe(expectedContext.scope);
      expect(passedContext.periodStart).toBeInstanceOf(Date);
      expect(passedContext.periodStart.getTime()).toBe(
        expectedContext.periodStart.getTime(),
      );
    });

    it("person / options 는 변형 없이 thunk 인자로 pass-through 된다(같은 참조)", async () => {
      const person = makePerson();
      const options = makeOptions();
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        person,
        options,
        persist,
      );
      await runner();

      // 같은 객체 참조가 그대로 전달(pass-through — 복사/변형 0).
      expect(persist.mock.calls[0][0]).toBe(person);
      expect(persist.mock.calls[0][2]).toBe(options);
    });

    it("period.since 는 bridge.periodStart 를 echo 한다(도출/변형 0)", async () => {
      const bridge = makeBridge({ periodStart: "2026-01-15T00:00:00Z" });
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();

      expect(persist.mock.calls[0][1]).toEqual({
        since: "2026-01-15T00:00:00Z",
      });
    });
  });

  describe("error path — fail-fast 한국어 TypeError(factory 조립 시점)", () => {
    it("bridge 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          null as unknown as PeriodBridgeDto,
          makePerson(),
          makeOptions(),
          makePersistMock(),
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          null as unknown as PeriodBridgeDto,
          makePerson(),
          makeOptions(),
          makePersistMock(),
        ),
      ).toThrow("null/undefined 일 수 없다");
    });

    it("bridge 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          undefined as unknown as PeriodBridgeDto,
          makePerson(),
          makeOptions(),
          makePersistMock(),
        ),
      ).toThrow("null/undefined 일 수 없다");
    });

    it("persist 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          makeBridge(),
          makePerson(),
          makeOptions(),
          null as unknown as GenerateAndPersistFn,
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          makeBridge(),
          makePerson(),
          makeOptions(),
          null as unknown as GenerateAndPersistFn,
        ),
      ).toThrow("persist 는 함수여야 한다");
    });

    it("persist 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          makeBridge(),
          makePerson(),
          makeOptions(),
          undefined as unknown as GenerateAndPersistFn,
        ),
      ).toThrow("persist 는 함수여야 한다");
    });

    it("persist 가 비-function(객체) 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          makeBridge(),
          makePerson(),
          makeOptions(),
          {} as unknown as GenerateAndPersistFn,
        ),
      ).toThrow("persist 는 함수여야 한다");
    });

    it("thunk 실행 시 periodStart 가 Invalid Date('not-a-date') 면 toEvaluationPersistContext 의 한국어 TypeError 가 reject 로 전파된다", async () => {
      const bridge = makeBridge({ periodStart: "not-a-date" });
      const persist = makePersistMock();

      // factory 조립은 throw 0(lazy) — thunk await 에서 reject.
      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );

      await expect(runner()).rejects.toThrow(TypeError);
      await expect(runner()).rejects.toThrow("유효한 ISO 날짜가 아니다");
      // context 도출이 실패하면 persist 는 호출조차 되지 않는다.
      expect(persist).not.toHaveBeenCalled();
    });

    it("thunk 실행 시 periodStart 가 빈 string 이면 한국어 TypeError 가 reject 로 전파된다", async () => {
      const bridge = makeBridge({ periodStart: "" });
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );

      await expect(runner()).rejects.toThrow("빈 string 일 수 없다");
      expect(persist).not.toHaveBeenCalled();
    });

    it("thunk 실행 시 periodStart 가 비-string(number) 이면 한국어 TypeError 가 reject 로 전파된다", async () => {
      const bridge = makeBridge();
      (bridge as unknown as { periodStart: unknown }).periodStart =
        1718000000000;
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );

      await expect(runner()).rejects.toThrow("string 이어야 한다");
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 입력 방어 통과 분기 — 정상 thunk 반환", () => {
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        makePersistMock(),
      );
      expect(typeof runner).toBe("function");
    });

    it("(b) bridge null 거부 분기", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          null as unknown as PeriodBridgeDto,
          makePerson(),
          makeOptions(),
          makePersistMock(),
        ),
      ).toThrow(TypeError);
    });

    it("(c) persist 비-function 거부 분기", () => {
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          makeBridge(),
          makePerson(),
          makeOptions(),
          42 as unknown as GenerateAndPersistFn,
        ),
      ).toThrow(TypeError);
    });

    it("(d) thunk 정상 persist 위임 분기", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("(e) thunk Invalid periodStart 로 context 도출 실패 분기", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge({ periodStart: "garbage" }),
        makePerson(),
        makeOptions(),
        persist,
      );
      await expect(runner()).rejects.toThrow(TypeError);
      expect(persist).not.toHaveBeenCalled();
    });

    it("reevaluate=true 좌표는 thunk 의 5 번째 인자로 true 가 전달된다", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge({ reevaluate: true }),
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();
      expect(persist.mock.calls[0][4]).toBe(true);
    });

    it("reevaluate=false 좌표는 thunk 의 5 번째 인자로 false 가 전달된다", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge({ reevaluate: false }),
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();
      expect(persist.mock.calls[0][4]).toBe(false);
    });

    it("reevaluate 미지정 좌표는 thunk 의 5 번째 인자로 undefined 가 전달된다", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();
      expect(persist.mock.calls[0][4]).toBe(undefined);
    });
  });

  describe("negative cases 충분 cover — 비변형 / reject 전파 / lazy", () => {
    it("mock persist 가 reject 하면 thunk 는 그 reject 를 그대로 전파한다(흡수 0 — 흡수는 T-0558 helper 책임)", async () => {
      const persist = jest
        .fn<
          ReturnType<GenerateAndPersistFn>,
          Parameters<GenerateAndPersistFn>
        >()
        .mockRejectedValue(
          new Error("persist 실패"),
        ) as jest.MockedFunction<GenerateAndPersistFn>;

      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        persist,
      );

      await expect(runner()).rejects.toThrow("persist 실패");
    });

    it("factory 호출은 persist 를 호출하지 않는다(lazy — thunk await 전 부수효과 0)", () => {
      const persist = makePersistMock();
      buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        persist,
      );
      // thunk 를 await 하지 않았으므로 persist 미호출.
      expect(persist).not.toHaveBeenCalled();
    });

    it("입력 bridge 객체를 mutate 하지 않는다(thunk 실행 후 모든 필드 그대로)", async () => {
      const bridge = makeBridge({
        personId: "p-keep",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-10T00:00:00+09:00",
        reevaluate: true,
      });
      const snapshot = { ...bridge };

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        makePersistMock(),
      );
      await runner();

      expect(bridge.personId).toBe(snapshot.personId);
      expect(bridge.period).toBe(snapshot.period);
      expect(bridge.scope).toBe(snapshot.scope);
      expect(bridge.periodStart).toBe(snapshot.periodStart);
      expect(typeof bridge.periodStart).toBe("string");
      expect(bridge.reevaluate).toBe(snapshot.reevaluate);
    });

    it("입력 person / options 객체를 mutate 하지 않는다(thunk 실행 후 그대로)", async () => {
      const person = makePerson();
      const options = makeOptions("gpt-keep");
      const personSnapshot = JSON.stringify(person);
      const optionsSnapshot = JSON.stringify(options);

      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        person,
        options,
        makePersistMock(),
      );
      await runner();

      expect(JSON.stringify(person)).toBe(personSnapshot);
      expect(JSON.stringify(options)).toBe(optionsSnapshot);
    });

    it("같은 runner 를 두 번 await 하면 persist 가 2 회 호출된다(thunk 재사용 가능 — 캐시 0)", async () => {
      const persist = makePersistMock();
      const runner = buildUnevaluatedFillCoordinateRunner(
        makeBridge(),
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();
      await runner();
      expect(persist).toHaveBeenCalledTimes(2);
    });
  });

  describe("regression (hqOrigin Q-0045) — 인자 무결성 + lazy 평가 회귀 방지", () => {
    it("period.since 가 bridge.periodStart 와 어긋나게 전달되면 fail(since echo 무결성 보호)", async () => {
      const bridge = makeBridge({ periodStart: "2026-06-10T00:00:00+09:00" });
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();

      // since 가 좌표 periodStart 와 정확히 일치해야 한다 — 어긋나면 이 단언이 fail.
      expect(persist.mock.calls[0][1]).toEqual({
        since: bridge.periodStart,
      });
    });

    it("reevaluate 가 bridge.reevaluate 와 어긋나게(항상 true 강제) 전달되면 fail(reeval flag 무결성 보호)", async () => {
      // bridge.reevaluate=false 인데 thunk 가 true 를 강제 전달하면 first-write-wins 가
      // 깨져 기존 평가문이 파괴적으로 교체된다 — 회귀 시점에 이 단언이 fail 하도록 박제.
      const bridge = makeBridge({ reevaluate: false });
      const persist = makePersistMock();

      const runner = buildUnevaluatedFillCoordinateRunner(
        bridge,
        makePerson(),
        makeOptions(),
        persist,
      );
      await runner();

      expect(persist.mock.calls[0][4]).toBe(false);
      expect(persist.mock.calls[0][4]).not.toBe(true);
    });

    it("toEvaluationPersistContext 호출은 factory 조립 시점이 아니라 thunk 실행 시점에 일어난다(factory 호출만으로는 Invalid periodStart 가 throw 되지 않음)", () => {
      const bridge = makeBridge({ periodStart: "not-a-date" });

      // Invalid periodStart 임에도 factory 조립은 throw 0(lazy — context 도출이 thunk
      // 안으로 미뤄짐). 조립 시점에 throw 되면 좌표 배열 순회 자체가 중단돼 REQ-037 부분
      // 실패 흡수가 깨진다 — 이 단언이 회귀 시점에 fail 하도록 박제.
      expect(() =>
        buildUnevaluatedFillCoordinateRunner(
          bridge,
          makePerson(),
          makeOptions(),
          makePersistMock(),
        ),
      ).not.toThrow();
    });
  });
});

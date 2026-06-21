// run-unevaluated-fill-batch.spec — T-0560. 순수 loop driver `runUnevaluatedFillBatch`
// 의 R-112 cover: happy path / error path / branch coverage / negative cases 충분 cover /
// 비변형 / regression(hqOrigin Q-0045). 신규 파일은 분기 단순하므로 100% coverage 목표.
// `resolvePerson` / `persist` 는 jest mock(`jest.fn().mockResolvedValue/.mockRejectedValue`),
// person/options/PeriodBridgeAdminPersistResult 는 plain 객체 stub(실 service/LLM/DB 0).

import type { Assessment } from "@prisma/client";

import type { ScoringOptions } from "../evaluation-scoring.service";
import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import type { GenerateAndPersistFn } from "./build-unevaluated-fill-coordinate-runner";
import { PeriodBridgeDto } from "./period-bridge.dto";
import {
  runUnevaluatedFillBatch,
  type ResolvePersonFn,
} from "./run-unevaluated-fill-batch";

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
function makePerson(externalId = "gh-octocat"): PeriodBridgePersonInput {
  return {
    serviceIdentities: [{ service: "github", externalId }],
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

/** 기본 resolve 하는 jest mock resolvePerson. */
function makeResolveMock(
  person: PeriodBridgePersonInput = makePerson(),
): jest.MockedFunction<ResolvePersonFn> {
  return jest
    .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
    .mockResolvedValue(person) as jest.MockedFunction<ResolvePersonFn>;
}

/** 기본 resolve 하는 jest mock persist. */
function makePersistMock(
  result: PeriodBridgeAdminPersistResult = makePersistResult(),
): jest.MockedFunction<GenerateAndPersistFn> {
  return jest
    .fn<ReturnType<GenerateAndPersistFn>, Parameters<GenerateAndPersistFn>>()
    .mockResolvedValue(result) as jest.MockedFunction<GenerateAndPersistFn>;
}

describe("runUnevaluatedFillBatch — 좌표 배열 순수 loop driver", () => {
  describe("happy path — 다중 좌표 순회 + 집계", () => {
    it("evaluated 1 + skipped 1 + failed 1 을 유발하는 배열 → outcomes 순서·길이 일치 + status 별 집계 정확", async () => {
      const bridges = [
        makeBridge({ personId: "p-eval" }),
        makeBridge({ personId: "p-skip" }),
        makeBridge({ personId: "p-fail" }),
      ];
      const resolvePerson = makeResolveMock();
      // 좌표별로 결과 분기: created=true→evaluated, created=false→skipped, reject→failed.
      const persist = jest
        .fn<
          ReturnType<GenerateAndPersistFn>,
          Parameters<GenerateAndPersistFn>
        >()
        .mockResolvedValueOnce(makePersistResult(true))
        .mockResolvedValueOnce(makePersistResult(false))
        .mockRejectedValueOnce(
          new Error("persist 실패"),
        ) as jest.MockedFunction<GenerateAndPersistFn>;

      const result = await runUnevaluatedFillBatch(
        bridges,
        resolvePerson,
        makeOptions(),
        persist,
      );

      // outcomes 길이·순서 일치(입력 좌표 순서 보존).
      expect(result.outcomes).toHaveLength(3);
      expect(result.outcomes.map((o) => o.personId)).toEqual([
        "p-eval",
        "p-skip",
        "p-fail",
      ]);
      expect(result.outcomes.map((o) => o.status)).toEqual([
        "evaluated",
        "skipped",
        "failed",
      ]);
      // status 별 집계 정확.
      expect(result.totalCount).toBe(3);
      expect(result.evaluatedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      // failed outcome 의 reason echo.
      expect(result.outcomes[2].reason).toBe("persist 실패");
    });

    it("좌표마다 resolvePerson 이 정확히 1 회씩 그 좌표로 호출되고 persist 가 각 좌표 5 인자로 호출됨", async () => {
      const bridges = [
        makeBridge({
          personId: "p-1",
          periodStart: "2026-06-01T00:00:00+09:00",
        }),
        makeBridge({
          personId: "p-2",
          periodStart: "2026-06-08T00:00:00+09:00",
          reevaluate: true,
        }),
      ];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await runUnevaluatedFillBatch(
        bridges,
        resolvePerson,
        makeOptions("model-x"),
        persist,
      );

      // resolvePerson — 좌표마다 1 회씩, 정확히 그 좌표로.
      expect(resolvePerson).toHaveBeenCalledTimes(2);
      expect(resolvePerson).toHaveBeenNthCalledWith(1, bridges[0]);
      expect(resolvePerson).toHaveBeenNthCalledWith(2, bridges[1]);
      // persist — 좌표마다 5 인자(person, { since }, options, context, reevaluate).
      expect(persist).toHaveBeenCalledTimes(2);
      const firstCall = persist.mock.calls[0];
      expect(firstCall[1]).toEqual({ since: "2026-06-01T00:00:00+09:00" });
      expect(firstCall[2]).toEqual({ modelId: "model-x" });
      expect(firstCall[4]).toBeUndefined();
      const secondCall = persist.mock.calls[1];
      expect(secondCall[1]).toEqual({ since: "2026-06-08T00:00:00+09:00" });
      expect(secondCall[4]).toBe(true);
    });

    it("빈 배열 [] → 빈 outcomes + 모든 카운트 0", async () => {
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      const result = await runUnevaluatedFillBatch(
        [],
        resolvePerson,
        makeOptions(),
        persist,
      );

      expect(result.outcomes).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.evaluatedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(0);
      // 빈 배열이면 callable 호출 0(좌표가 없으므로).
      expect(resolvePerson).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe("error path — 순회 전 fail-fast 한국어 TypeError", () => {
    it("bridges 가 null 이면 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          null as unknown as PeriodBridgeDto[],
          makeResolveMock(),
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/bridges 는 배열이어야 한다/);
    });

    it("bridges 가 undefined 이면 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          undefined as unknown as PeriodBridgeDto[],
          makeResolveMock(),
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(TypeError);
    });

    it("bridges 가 non-array(객체)면 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          {} as unknown as PeriodBridgeDto[],
          makeResolveMock(),
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/bridges 는 배열이어야 한다/);
    });

    it("배열 원소가 null 이면 인덱스 포함 한국어 TypeError", async () => {
      const bridges = [makeBridge(), null as unknown as PeriodBridgeDto];
      await expect(
        runUnevaluatedFillBatch(
          bridges,
          makeResolveMock(),
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/bridges\[1\] 좌표 원소가 null\/undefined/);
    });

    it("배열 원소가 undefined 이면 인덱스 포함 한국어 TypeError", async () => {
      const bridges = [undefined as unknown as PeriodBridgeDto];
      await expect(
        runUnevaluatedFillBatch(
          bridges,
          makeResolveMock(),
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/bridges\[0\] 좌표 원소가 null\/undefined/);
    });

    it("resolvePerson 이 함수가 아니면(null) 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          [makeBridge()],
          null as unknown as ResolvePersonFn,
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/resolvePerson 은 함수여야 한다/);
    });

    it("resolvePerson 이 함수가 아니면(객체) 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          [makeBridge()],
          {} as unknown as ResolvePersonFn,
          makeOptions(),
          makePersistMock(),
        ),
      ).rejects.toThrow(/resolvePerson 은 함수여야 한다/);
    });

    it("persist 가 함수가 아니면(undefined) 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          [makeBridge()],
          makeResolveMock(),
          makeOptions(),
          undefined as unknown as GenerateAndPersistFn,
        ),
      ).rejects.toThrow(/persist 는 함수여야 한다/);
    });

    it("persist 가 함수가 아니면(숫자) 한국어 TypeError", async () => {
      await expect(
        runUnevaluatedFillBatch(
          [makeBridge()],
          makeResolveMock(),
          makeOptions(),
          42 as unknown as GenerateAndPersistFn,
        ),
      ).rejects.toThrow(/persist 는 함수여야 한다/);
    });
  });

  describe("branch / negative — 좌표 결과 분기 + 부분 실패 흡수", () => {
    it("persist reject 하는 좌표만 failed, 나머지 정상(부분 실패 흡수)", async () => {
      const bridges = [
        makeBridge({ personId: "ok-1" }),
        makeBridge({ personId: "boom" }),
        makeBridge({ personId: "ok-2" }),
      ];
      const persist = jest
        .fn<
          ReturnType<GenerateAndPersistFn>,
          Parameters<GenerateAndPersistFn>
        >()
        .mockResolvedValueOnce(makePersistResult(true))
        .mockRejectedValueOnce(new Error("LLM 오류"))
        .mockResolvedValueOnce(
          makePersistResult(true),
        ) as jest.MockedFunction<GenerateAndPersistFn>;

      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        makeOptions(),
        persist,
      );

      expect(result.outcomes.map((o) => o.status)).toEqual([
        "evaluated",
        "failed",
        "evaluated",
      ]);
      // batch abort 0 — 마지막 좌표까지 처리됨.
      expect(persist).toHaveBeenCalledTimes(3);
      expect(result.outcomes[1].reason).toBe("LLM 오류");
    });

    it("resolvePerson reject 하는 좌표만 failed(person 해석 실패 흡수), persist 는 호출 안 됨", async () => {
      const bridges = [
        makeBridge({ personId: "ok-1" }),
        makeBridge({ personId: "no-person" }),
      ];
      const resolvePerson = jest
        .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
        .mockResolvedValueOnce(makePerson())
        .mockRejectedValueOnce(
          new Error("person 해석 실패"),
        ) as jest.MockedFunction<ResolvePersonFn>;
      const persist = makePersistMock();

      const result = await runUnevaluatedFillBatch(
        bridges,
        resolvePerson,
        makeOptions(),
        persist,
      );

      expect(result.outcomes.map((o) => o.status)).toEqual([
        "evaluated",
        "failed",
      ]);
      expect(result.outcomes[1].personId).toBe("no-person");
      expect(result.outcomes[1].reason).toBe("person 해석 실패");
      // resolver reject 좌표는 persist 를 흘리지 않는다(person 없이 흘릴 수 없으므로).
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("resolvePerson reject 가 비-Error(string)면 String(error) 로 reason echo", async () => {
      const resolvePerson = jest
        .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
        .mockRejectedValueOnce(
          "문자열 사유",
        ) as jest.MockedFunction<ResolvePersonFn>;

      const result = await runUnevaluatedFillBatch(
        [makeBridge()],
        resolvePerson,
        makeOptions(),
        makePersistMock(),
      );

      expect(result.outcomes[0].status).toBe("failed");
      expect(result.outcomes[0].reason).toBe("문자열 사유");
    });

    it("resolvePerson 이 동기 반환(Promise 아님)해도 await 로 수렴", async () => {
      // resolver 가 Promise 가 아닌 plain 객체를 반환하는 분기(union 의 동기 경로).
      const resolvePerson = jest
        .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
        .mockReturnValue(makePerson()) as jest.MockedFunction<ResolvePersonFn>;
      const persist = makePersistMock(makePersistResult(true));

      const result = await runUnevaluatedFillBatch(
        [makeBridge()],
        resolvePerson,
        makeOptions(),
        persist,
      );

      expect(result.outcomes[0].status).toBe("evaluated");
    });

    it("모두 evaluated 인 배열 → 모든 outcomes evaluated, 카운트 일치", async () => {
      const bridges = [
        makeBridge({ personId: "a" }),
        makeBridge({ personId: "b" }),
      ];
      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        makeOptions(),
        makePersistMock(makePersistResult(true)),
      );
      expect(result.outcomes.every((o) => o.status === "evaluated")).toBe(true);
      expect(result.evaluatedCount).toBe(2);
    });

    it("입력 bridges 배열·각 bridge·options 객체를 mutate 하지 않는다", async () => {
      const bridge = makeBridge({ personId: "immut" });
      const bridges = [bridge];
      const bridgesSnapshot = [...bridges];
      const bridgeSnapshot = { ...bridge };
      const options = makeOptions();
      const optionsSnapshot = { ...options };

      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        options,
        makePersistMock(),
      );

      expect(bridges).toEqual(bridgesSnapshot);
      expect(bridges).toHaveLength(1);
      expect(bridge).toEqual(bridgeSnapshot);
      expect(options).toEqual(optionsSnapshot);
      // 반환 outcomes 는 입력과 별개 새 배열.
      expect(result.outcomes).not.toBe(bridges);
    });

    it("좌표가 순차(sequential)로 실행됨 — resolvePerson 호출 순서가 입력 순서와 일치(Promise.all 아님)", async () => {
      const bridges = [
        makeBridge({ personId: "first" }),
        makeBridge({ personId: "second" }),
        makeBridge({ personId: "third" }),
      ];
      const callOrder: string[] = [];
      const resolvePerson = jest
        .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
        .mockImplementation(async (bridge: PeriodBridgeDto) => {
          // 마이크로태스크 yield 후 호출 순서 기록 — 병렬이면 순서가 섞일 수 있다.
          await Promise.resolve();
          callOrder.push(bridge.personId);
          return makePerson();
        }) as jest.MockedFunction<ResolvePersonFn>;

      await runUnevaluatedFillBatch(
        bridges,
        resolvePerson,
        makeOptions(),
        makePersistMock(),
      );

      expect(callOrder).toEqual(["first", "second", "third"]);
    });
  });

  describe("regression — hqOrigin Q-0045 (부분 실패 흡수 + 순서/길이 무결성)", () => {
    it("좌표 1 개 persist reject 시 batch 가 abort 하지 않고 나머지 좌표를 끝까지 처리한다", async () => {
      const bridges = [
        makeBridge({ personId: "a" }),
        makeBridge({ personId: "b" }),
        makeBridge({ personId: "c" }),
      ];
      const persist = jest
        .fn<
          ReturnType<GenerateAndPersistFn>,
          Parameters<GenerateAndPersistFn>
        >()
        .mockRejectedValueOnce(new Error("첫 좌표 실패"))
        .mockResolvedValue(
          makePersistResult(true),
        ) as jest.MockedFunction<GenerateAndPersistFn>;

      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        makeOptions(),
        persist,
      );

      // abort 했다면 outcomes 길이가 3 미만일 것 — 3 이어야 통과.
      expect(result.outcomes).toHaveLength(3);
      expect(result.outcomes.map((o) => o.status)).toEqual([
        "failed",
        "evaluated",
        "evaluated",
      ]);
    });

    it("outcomes 순서가 입력 좌표 순서와 정확히 일치한다(어긋나면 fail)", async () => {
      const bridges = [
        makeBridge({ personId: "x1" }),
        makeBridge({ personId: "x2" }),
        makeBridge({ personId: "x3" }),
        makeBridge({ personId: "x4" }),
      ];
      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        makeOptions(),
        makePersistMock(),
      );
      expect(result.outcomes.map((o) => o.personId)).toEqual([
        "x1",
        "x2",
        "x3",
        "x4",
      ]);
    });

    it("좌표 N 개 입력 시 outcomes 길이가 정확히 N(누락/중복 시 fail)", async () => {
      const bridges = Array.from({ length: 5 }, (_, i) =>
        makeBridge({ personId: `n-${i}` }),
      );
      const result = await runUnevaluatedFillBatch(
        bridges,
        makeResolveMock(),
        makeOptions(),
        makePersistMock(),
      );
      expect(result.outcomes).toHaveLength(5);
      expect(result.totalCount).toBe(5);
    });
  });
});

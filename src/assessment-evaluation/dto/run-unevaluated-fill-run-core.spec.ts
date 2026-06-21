// run-unevaluated-fill-run-core.spec — T-0563. 순수 orchestration core
// `runUnevaluatedFillRunCore`(dedup → options → batch 조립)의 R-112 cover: happy path /
// error path / branch coverage / negative cases 충분 cover / 비변형. 신규 파일은 분기
// 단순(위임 3 단계)하므로 100% coverage 목표. 조립 대상 helper(dedup/options/batch)는
// **실제로 호출**(mock 0)해 통합 경로를 검증하고, `resolvePerson` / `persist` 만 jest mock
// (`jest.fn().mockResolvedValue/.mockRejectedValue`)으로 닫아 실 service/LLM/DB 0 으로 둔다.

import type { Assessment } from "@prisma/client";

import type { ScoringOptions } from "../evaluation-scoring.service";
import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import type { GenerateAndPersistFn } from "./build-unevaluated-fill-coordinate-runner";
import { PeriodBridgeDto } from "./period-bridge.dto";
import { type ResolvePersonFn } from "./run-unevaluated-fill-batch";
import { runUnevaluatedFillRunCore } from "./run-unevaluated-fill-run-core";

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

describe("runUnevaluatedFillRunCore — dedup → options → batch 순수 조립 core", () => {
  describe("happy path — dedup 후 batch 위임 + persist 호출 수 검증", () => {
    it("중복 포함 좌표 배열 → dedup 후 남은 좌표 수만큼만 persist 호출 + 집계 반환", async () => {
      // 좌표 3 개 중 1·3 이 동일 좌표(first-wins) → dedup 후 2 개만 흘림.
      const bridges = [
        makeBridge({
          personId: "p-1",
          periodStart: "2026-06-01T00:00:00+09:00",
        }),
        makeBridge({
          personId: "p-2",
          periodStart: "2026-06-08T00:00:00+09:00",
        }),
        makeBridge({
          personId: "p-1",
          periodStart: "2026-06-01T00:00:00+09:00",
        }),
      ];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      const result = await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "gpt-4o",
        "default-model",
      );

      // dedup 후 2 좌표만 흘림 → persist/resolvePerson 각 2 회.
      expect(persist).toHaveBeenCalledTimes(2);
      expect(resolvePerson).toHaveBeenCalledTimes(2);
      // batch 결과 pass-through — outcomes 길이·순서(dedup 된 좌표 순서) 일치.
      expect(result.totalCount).toBe(2);
      expect(result.outcomes.map((o) => o.personId)).toEqual(["p-1", "p-2"]);
      expect(result.evaluatedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("중복 없는 단일 좌표 → 그대로 1 회 흘림 + evaluated 1", async () => {
      const bridges = [makeBridge({ personId: "solo" })];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock(makePersistResult(true));

      const result = await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "m",
        "d",
      );

      expect(persist).toHaveBeenCalledTimes(1);
      expect(result.totalCount).toBe(1);
      expect(result.outcomes[0].status).toBe("evaluated");
    });
  });

  describe("flow / branch — options modelId 채택 분기", () => {
    it("[분기1] request modelId 유효 → batch 에 넘어간 options.modelId 가 request 값", async () => {
      const bridges = [makeBridge()];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "req-model",
        "def-model",
      );

      // persist 의 3 번째 인자(options)가 request modelId 채택(default 무관).
      expect(persist.mock.calls[0][2]).toEqual<ScoringOptions>({
        modelId: "req-model",
      });
    });

    it("[분기2] request 비어있음 → batch 에 넘어간 options.modelId 가 default fallback 값", async () => {
      const bridges = [makeBridge()];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        undefined,
        "def-model",
      );

      expect(persist.mock.calls[0][2]).toEqual<ScoringOptions>({
        modelId: "def-model",
      });
    });
  });

  describe("순서 고정(load-bearing) — options 도출이 dedup/batch 전에 차단", () => {
    it("request·default modelId 둘 다 빈 값 → buildFillRunScoringOptions 의 한국어 TypeError 전파 + 좌표 0 개 흘림", async () => {
      const bridges = [makeBridge()];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await expect(
        runUnevaluatedFillRunCore(bridges, resolvePerson, persist, "", "   "),
      ).rejects.toThrow(TypeError);
      // options 도출이 dedup/batch 전이라 좌표를 단 1 개도 흘리지 않는다(영속 부수효과 0).
      expect(resolvePerson).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    });

    it("request 가 비-string type(number) → buildFillRunScoringOptions 의 한국어 TypeError 전파", async () => {
      const bridges = [makeBridge()];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await expect(
        runUnevaluatedFillRunCore(
          bridges,
          resolvePerson,
          persist,
          // 의도적 type 위반 — silent coercion 차단 검증.
          42 as unknown as string,
          "def-model",
        ),
      ).rejects.toThrow(TypeError);
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe("error path — dedup 입력 방어 전파", () => {
    it("rawBridges 가 null → dedupePeriodBridgeRequests 의 한국어 TypeError 전파", async () => {
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await expect(
        runUnevaluatedFillRunCore(
          // 의도적 non-array 입력.
          null as unknown as PeriodBridgeDto[],
          resolvePerson,
          persist,
          "m",
          "d",
        ),
      ).rejects.toThrow(TypeError);
      // options 는 유효했으나 dedup 에서 차단 → 좌표 0 개 흘림.
      expect(persist).not.toHaveBeenCalled();
    });

    it("rawBridges 원소가 null → dedupePeriodBridgeRequests 의 한국어 TypeError(인덱스 포함) 전파", async () => {
      const bridges = [makeBridge(), null as unknown as PeriodBridgeDto];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await expect(
        runUnevaluatedFillRunCore(bridges, resolvePerson, persist, "m", "d"),
      ).rejects.toThrow(/requests\[1\]/);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("[빈 좌표 배열] → 빈 결과(persist 0 회) 정상 반환", async () => {
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      const result = await runUnevaluatedFillRunCore(
        [],
        resolvePerson,
        persist,
        "m",
        "d",
      );

      expect(result.outcomes).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.evaluatedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(0);
      // 좌표 0 개 → callable 호출 0.
      expect(resolvePerson).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    });

    it("[resolvePerson reject] 좌표 1 개의 person 해석 실패 → 그 좌표만 failed 로 batch 가 흡수(pass-through), 나머지 정상", async () => {
      const bridges = [
        makeBridge({
          personId: "p-ok",
          periodStart: "2026-06-01T00:00:00+09:00",
        }),
        makeBridge({
          personId: "p-bad",
          periodStart: "2026-06-08T00:00:00+09:00",
        }),
      ];
      const resolvePerson = jest
        .fn<ReturnType<ResolvePersonFn>, Parameters<ResolvePersonFn>>()
        .mockResolvedValueOnce(makePerson())
        .mockRejectedValueOnce(
          new Error("person 해석 실패"),
        ) as jest.MockedFunction<ResolvePersonFn>;
      const persist = makePersistMock();

      const result = await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "m",
        "d",
      );

      // batch 가 좌표 단위 reject 를 failed outcome 으로 흡수 — core 는 pass-through.
      expect(result.totalCount).toBe(2);
      expect(result.outcomes.map((o) => o.status)).toEqual([
        "evaluated",
        "failed",
      ]);
      expect(result.outcomes[1].reason).toBe("person 해석 실패");
      // person 해석 실패 좌표는 persist 안 함 → persist 는 정상 좌표 1 회만.
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("[persist reject] 좌표 1 개의 영속 실패 → 그 좌표만 failed 로 batch 가 흡수(pass-through)", async () => {
      const bridges = [makeBridge({ personId: "p-fail" })];
      const resolvePerson = makeResolveMock();
      const persist = jest
        .fn<
          ReturnType<GenerateAndPersistFn>,
          Parameters<GenerateAndPersistFn>
        >()
        .mockRejectedValue(
          new Error("persist 실패"),
        ) as jest.MockedFunction<GenerateAndPersistFn>;

      const result = await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "m",
        "d",
      );

      expect(result.totalCount).toBe(1);
      expect(result.outcomes[0].status).toBe("failed");
      expect(result.outcomes[0].reason).toBe("persist 실패");
    });

    it("[persist 비-function] → runUnevaluatedFillBatch 의 한국어 TypeError 전파", async () => {
      const bridges = [makeBridge()];
      const resolvePerson = makeResolveMock();

      await expect(
        runUnevaluatedFillRunCore(
          bridges,
          resolvePerson,
          // 의도적 비-function persist.
          null as unknown as GenerateAndPersistFn,
          "m",
          "d",
        ),
      ).rejects.toThrow(TypeError);
    });

    it("[resolvePerson 비-function] → runUnevaluatedFillBatch 의 한국어 TypeError 전파", async () => {
      const bridges = [makeBridge()];
      const persist = makePersistMock();

      await expect(
        runUnevaluatedFillRunCore(
          bridges,
          // 의도적 비-function resolvePerson.
          undefined as unknown as ResolvePersonFn,
          persist,
          "m",
          "d",
        ),
      ).rejects.toThrow(TypeError);
    });
  });

  describe("비변형 — 입력 배열/좌표 mutate 0", () => {
    it("입력 rawBridges 배열·좌표 객체를 변형하지 않는다", async () => {
      const original = makeBridge({ personId: "immutable" });
      const snapshot = { ...original };
      const bridges = [original];
      const resolvePerson = makeResolveMock();
      const persist = makePersistMock();

      await runUnevaluatedFillRunCore(
        bridges,
        resolvePerson,
        persist,
        "m",
        "d",
      );

      expect(bridges).toHaveLength(1);
      expect(original).toEqual(snapshot);
    });
  });
});

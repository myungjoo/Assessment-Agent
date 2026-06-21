// UnevaluatedFillRunOrchestratorService spec — T-0564(Q-0045 옵션1 run-side 사슬 slice 1'
// loop-level @Injectable wiring). R-112 4 종(happy / error / branch / negative 충분 cover,
// CLAUDE.md §3.2) + regression(hqOrigin Q-0045) 검증. 2 collaborator(PersonService.
// findByIdWithIdentities / PeriodBridgeAdminPersistService.generateAndPersist)를 mock
// 주입 — 실 DB / 실 LLM / 실 네트워크 0. 본 spec 은 service 가 (a) lookup adapter 로
// PersonService 의 NotFoundException 을 null 로 화해하고, (b) generateAndPersist 를 persist
// 로 바인딩한 뒤, (c) runUnevaluatedFillRunCore(T-0563)에 1 회 위임함을 cover 한다 —
// dedup / modelId fallback 분기 / person 존재·부재 분기 / 부분 실패 흡수(REQ-037) /
// core fail-fast TypeError 전파(흡수 0) / NotFoundException 외 error 전파(재포장 0).
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { ServiceIdentity } from "@prisma/client";

import type { PersonWithIdentities } from "../user/person.repository";
import { PersonService } from "../user/person.service";

import type { PeriodBridgeDto } from "./dto/period-bridge.dto";
import type { PeriodBridgeAdminPersistResult } from "./period-bridge-admin-persist.service";
import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";
import { UnevaluatedFillRunOrchestratorService } from "./unevaluated-fill-run-orchestrator.service";

const DEFAULT_MODEL = "default-model";

// 좌표 fixture — 4 축 echo. personId override 로 person 존재/부재 분기를 구성한다.
function bridge(overrides: Partial<PeriodBridgeDto> = {}): PeriodBridgeDto {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as PeriodBridgeDto;
}

// person row fixture — findByIdWithIdentities 가 resolve 할 serviceIdentities 포함 row.
// build-resolve-person-fn 이 serviceIdentities 만 narrow 하므로 그 외 Person 필드는 임의.
function personRow(): PersonWithIdentities {
  return {
    id: "person-1",
    fullName: "옥토캣",
    email: "octo@example.com",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    serviceIdentities: [
      { service: "com", externalId: "octocat" } as ServiceIdentity,
    ],
  } as unknown as PersonWithIdentities;
}

// generateAndPersist 성공 result fixture — assessment + created 플래그. core/batch 가
// evaluated outcome 으로 집계한다.
function persistResult(): PeriodBridgeAdminPersistResult {
  return {
    assessment: {
      id: "assessment-1",
    } as PeriodBridgeAdminPersistResult["assessment"],
    created: true,
  };
}

// TestingModule 조립 — PersonService / PeriodBridgeAdminPersistService 를 mock 으로 주입.
// 실 생성자 의존(PrismaService / repository / collaborator)을 우회하기 위해 useValue 로
// 필요한 메서드만 가진 mock 객체를 바인딩한다(실 DB / 실 LLM 0).
async function buildService(mocks: {
  findByIdWithIdentities: jest.Mock;
  generateAndPersist: jest.Mock;
}): Promise<UnevaluatedFillRunOrchestratorService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      UnevaluatedFillRunOrchestratorService,
      {
        provide: PersonService,
        useValue: { findByIdWithIdentities: mocks.findByIdWithIdentities },
      },
      {
        provide: PeriodBridgeAdminPersistService,
        useValue: { generateAndPersist: mocks.generateAndPersist },
      },
    ],
  }).compile();

  return moduleRef.get(UnevaluatedFillRunOrchestratorService);
}

describe("UnevaluatedFillRunOrchestratorService", () => {
  describe("happy-path — DI 바인딩 + core 위임", () => {
    it("중복 포함 좌표를 dedup 후 좌표 수만큼 generateAndPersist 호출하고 UnevaluatedFillRunResult 를 반환한다", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      // 같은 좌표 2 개(중복) + 다른 좌표 1 개 → dedup 후 2 개만 흘러야 한다(first-wins).
      const result = await service.run(
        [
          bridge(),
          bridge(),
          bridge({
            personId: "person-2",
            periodStart: "2026-07-01T00:00:00.000Z",
          }),
        ],
        undefined,
        DEFAULT_MODEL,
      );

      // dedup → 좌표 2 개 → generateAndPersist 2 회.
      expect(generateAndPersist).toHaveBeenCalledTimes(2);
      // 두 좌표 모두 성공 → evaluated 2.
      expect(result.totalCount).toBe(2);
      expect(result.evaluatedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it("request modelId 가 없으면 default modelId 가 generateAndPersist 의 options.modelId 로 전달된다(default fallback 분기)", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      await service.run([bridge()], undefined, DEFAULT_MODEL);

      // generateAndPersist 의 3 번째 인자(options)에 default modelId 가 채택돼 들어가야 한다.
      const options = generateAndPersist.mock.calls[0][2];
      expect(options).toEqual({ modelId: DEFAULT_MODEL });
    });
  });

  describe("flow / 분기 cover", () => {
    it("request modelId 가 있으면 default 가 아니라 request modelId 가 options.modelId 로 채택된다(request 우선 분기)", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      await service.run([bridge()], "request-model", DEFAULT_MODEL);

      const options = generateAndPersist.mock.calls[0][2];
      expect(options).toEqual({ modelId: "request-model" });
    });

    it("person 존재 분기 — lookup 이 row 를 resolve 하면 그 좌표는 evaluated outcome 으로 수렴한다", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run([bridge()], undefined, DEFAULT_MODEL);

      expect(result.outcomes[0].status).toBe("evaluated");
      // serviceIdentities 가 narrow 돼 person 인자로 generateAndPersist 에 넘어갔는지 확인.
      expect(generateAndPersist.mock.calls[0][0]).toEqual({
        serviceIdentities: [{ service: "com", externalId: "octocat" }],
      });
    });

    it("person 부재 분기 — lookup adapter 가 NotFoundException 을 null 로 화해해 그 좌표만 failed outcome 으로 흡수한다", async () => {
      const findByIdWithIdentities = jest
        .fn()
        .mockRejectedValue(new NotFoundException("person not found: person-1"));
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run([bridge()], undefined, DEFAULT_MODEL);

      // person 부재 → resolver 가 좌표 단위 Error → 그 좌표 failed. persist 미도달.
      expect(result.failedCount).toBe(1);
      expect(result.outcomes[0].status).toBe("failed");
      expect(generateAndPersist).not.toHaveBeenCalled();
    });
  });

  describe("error path — core fail-fast TypeError 전파(흡수 0)", () => {
    it("request·default modelId 둘 다 빈 값이면 buildFillRunScoringOptions 의 TypeError 가 전파되고 generateAndPersist 는 호출되지 않는다", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      // options 도출은 좌표를 흘리기 전 차단 — TypeError 전파 + generateAndPersist 0 회.
      await expect(service.run([bridge()], "  ", "")).rejects.toThrow(
        TypeError,
      );
      expect(generateAndPersist).not.toHaveBeenCalled();
    });

    it("rawBridges 가 non-array(null)면 dedupePeriodBridgeRequests 의 TypeError 가 전파된다", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      await expect(
        service.run(
          null as unknown as PeriodBridgeDto[],
          undefined,
          DEFAULT_MODEL,
        ),
      ).rejects.toThrow(TypeError);
      expect(generateAndPersist).not.toHaveBeenCalled();
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) 빈 좌표 배열 → generateAndPersist 0 회 + 빈 결과를 정상 반환한다", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run([], undefined, DEFAULT_MODEL);

      expect(generateAndPersist).not.toHaveBeenCalled();
      expect(result.totalCount).toBe(0);
      expect(result.evaluatedCount).toBe(0);
    });

    it("(b) 한 좌표의 person 부재(NotFoundException) → 그 좌표만 failed, 나머지 좌표는 정상 evaluated(부분 실패 흡수, REQ-037)", async () => {
      // person-1 은 부재(NotFoundException), person-2 는 존재.
      const findByIdWithIdentities = jest.fn(async (id: string) => {
        if (id === "person-1") {
          throw new NotFoundException("person not found: person-1");
        }
        return personRow();
      });
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run(
        [
          bridge({ personId: "person-1" }),
          bridge({
            personId: "person-2",
            periodStart: "2026-07-01T00:00:00.000Z",
          }),
        ],
        undefined,
        DEFAULT_MODEL,
      );

      expect(result.failedCount).toBe(1);
      expect(result.evaluatedCount).toBe(1);
      // person-2 좌표만 persist 도달.
      expect(generateAndPersist).toHaveBeenCalledTimes(1);
    });

    it("(c) 한 좌표의 generateAndPersist reject → 그 좌표만 failed 로 흡수되고 나머지 정상(batch pass-through)", async () => {
      const findByIdWithIdentities = jest.fn().mockResolvedValue(personRow());
      // 첫 좌표 persist reject, 둘째 좌표 성공.
      const generateAndPersist = jest
        .fn()
        .mockRejectedValueOnce(new Error("LLM 호출 실패"))
        .mockResolvedValueOnce(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run(
        [
          bridge({ personId: "person-1" }),
          bridge({
            personId: "person-2",
            periodStart: "2026-07-01T00:00:00.000Z",
          }),
        ],
        undefined,
        DEFAULT_MODEL,
      );

      expect(result.failedCount).toBe(1);
      expect(result.evaluatedCount).toBe(1);
      expect(generateAndPersist).toHaveBeenCalledTimes(2);
    });

    it("(d) findByIdWithIdentities 가 NotFoundException 외 error(DB 연결 실패) → adapter 가 catch 하지 않고 그 error 가 좌표 단위로 batch 에 흡수된다(재포장 0)", async () => {
      const dbError = new Error("DB 연결 실패");
      const findByIdWithIdentities = jest.fn().mockRejectedValue(dbError);
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run([bridge()], undefined, DEFAULT_MODEL);

      // NotFoundException 아니므로 adapter 가 그대로 전파 → batch 가 좌표 단위 failed 로 흡수.
      // reason 에 원본 message 가 담겨 재포장 0 임을 확인.
      expect(result.failedCount).toBe(1);
      expect(result.outcomes[0].status).toBe("failed");
      expect(result.outcomes[0].reason).toContain("DB 연결 실패");
      expect(generateAndPersist).not.toHaveBeenCalled();
    });
  });

  describe("regression — hqOrigin Q-0045 person 부재 좌표 흡수", () => {
    it("person 부재 좌표가 batch 를 abort 하지 않고 그 좌표만 failed 로 흡수되며 나머지 모두 정상 평가된다(lookup adapter 가 NotFoundException 을 null 로 화해하지 않으면 fail)", async () => {
      // 가운데 좌표만 person 부재(NotFoundException), 앞뒤 좌표는 존재.
      const findByIdWithIdentities = jest.fn(async (id: string) => {
        if (id === "missing") {
          throw new NotFoundException("person not found: missing");
        }
        return personRow();
      });
      const generateAndPersist = jest.fn().mockResolvedValue(persistResult());
      const service = await buildService({
        findByIdWithIdentities,
        generateAndPersist,
      });

      const result = await service.run(
        [
          bridge({ personId: "present-1" }),
          bridge({ personId: "missing" }),
          bridge({
            personId: "present-2",
            periodStart: "2026-08-01T00:00:00.000Z",
          }),
        ],
        undefined,
        DEFAULT_MODEL,
      );

      // 부재 1 개만 failed, 나머지 2 개 정상 → 한 좌표 person 부재가 run 을 깨지 않음.
      expect(result.totalCount).toBe(3);
      expect(result.failedCount).toBe(1);
      expect(result.evaluatedCount).toBe(2);
      // 존재 좌표 2 개만 persist 도달(부재 좌표는 persist 미도달).
      expect(generateAndPersist).toHaveBeenCalledTimes(2);
    });
  });
});

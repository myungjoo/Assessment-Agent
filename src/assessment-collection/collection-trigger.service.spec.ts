// CollectionTriggerService unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative 충분 cover). ADR-0031 §5 test posture(a~f + happy). 4 building block(PersonService
// / SinceDerivationService / AssessmentService / CollectionEntryService)을 jest mock 으로
// 주입 — 실 DB·실 adapter·실 token 0(Q-0025 deferred 정합). orchestration 합성(순서·throw
// 전파·placeholder 평가필드·since/now 처리)만 검증한다.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Assessment, Contribution } from "@prisma/client";

import type { AssessmentCreateInput } from "../user/assessment.repository";
import { AssessmentService } from "../user/assessment.service";
import { PersonService } from "../user/person.service";

import { CollectionEntryService } from "./collection-entry.service";
import { CollectionTriggerService } from "./collection-trigger.service";
import { CollectTriggerDto } from "./dto/collect-trigger.dto";
import { SinceDerivationService } from "./since-derivation.service";

// base dto — periodStart 명시 제공(결정론). 개별 test 가 일부만 변형.
const dto: CollectTriggerDto = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-06-01T00:00:00.000Z",
};

// person fixture — service 는 .serviceIdentities 만 읽으므로 최소 형태.
function personFixture(
  serviceIdentities: { service: string; externalId: string }[] = [
    { service: "github", externalId: "gildong" },
  ],
): unknown {
  return { id: "person-1", serviceIdentities };
}

interface MakeOpts {
  find?: () => Promise<unknown>;
  derive?: () => Promise<string | undefined>;
  create?: (input: AssessmentCreateInput) => Promise<Assessment>;
  collect?: () => Promise<Contribution[]>;
}

// makeService — 4 의존성 mock 주입한 service + 각 spy 반환.
function makeService(opts: MakeOpts = {}): {
  service: CollectionTriggerService;
  findSpy: jest.Mock;
  deriveSpy: jest.Mock;
  createSpy: jest.Mock;
  collectSpy: jest.Mock;
} {
  const findSpy = jest.fn(opts.find ?? (async () => personFixture()));
  const deriveSpy = jest.fn(
    opts.derive ?? (async () => "2026-05-01T00:00:00.000Z"),
  );
  const createSpy = jest.fn(
    opts.create ??
      (async (input: AssessmentCreateInput): Promise<Assessment> =>
        ({ id: "assess-1", ...input }) as unknown as Assessment),
  );
  const collectSpy = jest.fn(
    opts.collect ??
      (async (): Promise<Contribution[]> =>
        [{ id: "c-1" }, { id: "c-2" }] as unknown as Contribution[]),
  );
  const personService = {
    findByIdWithIdentities: findSpy,
  } as unknown as PersonService;
  const sinceDerivationService = {
    deriveSince: deriveSpy,
  } as unknown as SinceDerivationService;
  const assessmentService = {
    create: createSpy,
  } as unknown as AssessmentService;
  const collectionEntryService = {
    collectForPerson: collectSpy,
  } as unknown as CollectionEntryService;
  return {
    service: new CollectionTriggerService(
      personService,
      sinceDerivationService,
      assessmentService,
      collectionEntryService,
    ),
    findSpy,
    deriveSpy,
    createSpy,
    collectSpy,
  };
}

describe("CollectionTriggerService", () => {
  describe("happy path (R-112-1)", () => {
    it("정상 summary 를 반환하고 placeholder 평가필드 Assessment 생성 + collectForPerson 을 (input, since, assessmentId) 로 호출한다", async () => {
      const { service, createSpy, collectSpy } = makeService();

      const result = await service.triggerCollection(dto);

      expect(result).toEqual({
        assessmentId: "assess-1",
        personId: "person-1",
        since: "2026-05-01T00:00:00.000Z",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-01T00:00:00.000Z",
        contributionCount: 2,
      });
      // Assessment 는 placeholder 평가필드 + Date periodStart 로 생성됨.
      expect(createSpy).toHaveBeenCalledWith({
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: 0,
        volume: 0,
        narrative: "",
      });
      // collectForPerson 은 (serviceIdentities, since, assessmentId) 순서로 호출.
      expect(collectSpy).toHaveBeenCalledWith(
        { serviceIdentities: [{ service: "github", externalId: "gildong" }] },
        "2026-05-01T00:00:00.000Z",
        "assess-1",
      );
    });
  });

  describe("error / negative cases 충분 cover (R-112-2/4, ADR-0031 §5)", () => {
    it("(a) Person 404 → 전파하고 후속 단계(derive/create/collect) 미호출", async () => {
      const { service, deriveSpy, createSpy, collectSpy } = makeService({
        find: async () => {
          throw new NotFoundException("person not found: person-1");
        },
      });

      await expect(service.triggerCollection(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(deriveSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
      expect(collectSpy).not.toHaveBeenCalled();
    });

    it("(b) 빈 serviceIdentities → Assessment 는 생성, collectForPerson 빈 input, contributionCount 0", async () => {
      const { service, createSpy, collectSpy } = makeService({
        find: async () => personFixture([]),
        collect: async () => [],
      });

      const result = await service.triggerCollection(dto);

      expect(result.contributionCount).toBe(0);
      expect(createSpy).toHaveBeenCalledTimes(1); // 빈 수집도 유효 batch — Assessment 생성됨.
      expect(collectSpy).toHaveBeenCalledWith(
        { serviceIdentities: [] },
        "2026-05-01T00:00:00.000Z",
        "assess-1",
      );
    });

    it("(c) deriveSince undefined → since null(full collection), collectForPerson 에 undefined 전달", async () => {
      const { service, collectSpy } = makeService({
        derive: async () => undefined,
      });

      const result = await service.triggerCollection(dto);

      expect(result.since).toBeNull();
      expect(collectSpy).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        "assess-1",
      );
    });

    it("(d) AssessmentService.create P2002 → ConflictException 전파, collectForPerson 미호출", async () => {
      const { service, collectSpy } = makeService({
        create: async () => {
          throw new ConflictException("assessment already exists");
        },
      });

      await expect(service.triggerCollection(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(collectSpy).not.toHaveBeenCalled();
    });

    it("(e) collectForPerson reject → 그대로 전파", async () => {
      const { service } = makeService({
        collect: async () => {
          throw new Error("수집 실패");
        },
      });

      await expect(service.triggerCollection(dto)).rejects.toThrow("수집 실패");
    });

    it("(f) deriveSince reject → 전파하고 create 미호출", async () => {
      const { service, createSpy } = makeService({
        derive: async () => {
          throw new Error("since 도출 실패");
        },
      });

      await expect(service.triggerCollection(dto)).rejects.toThrow(
        "since 도출 실패",
      );
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe("now() 처리 / branch cover (R-112-3, ADR-0031 §1)", () => {
    it("periodStart 미제공 시 서버 now() ISO 를 사용한다 (유효 ISO-8601, 시각 비교 없이)", async () => {
      const { service, createSpy } = makeService();
      const dtoNoPeriodStart: CollectTriggerDto = {
        personId: dto.personId,
        period: dto.period,
        scope: dto.scope,
      };

      const result = await service.triggerCollection(dtoNoPeriodStart);

      // 유효 ISO-8601(round-trip) — 시각 자체는 비교하지 않음(결정론 회피).
      expect(new Date(result.periodStart).toISOString()).toBe(
        result.periodStart,
      );
      // create 에 넘긴 Date 가 summary periodStart(ISO)와 동일 경계.
      const createdArg = createSpy.mock.calls[0][0] as AssessmentCreateInput;
      expect((createdArg.periodStart as Date).toISOString()).toBe(
        result.periodStart,
      );
    });

    it("periodStart 명시 제공 시 그 값이 create(Date)·summary(ISO)에 그대로 사용된다 (결정론)", async () => {
      const { service, createSpy } = makeService();

      const result = await service.triggerCollection({
        ...dto,
        periodStart: "2026-07-15T12:00:00.000Z",
      });

      expect(result.periodStart).toBe("2026-07-15T12:00:00.000Z");
      const createdArg = createSpy.mock.calls[0][0] as AssessmentCreateInput;
      expect((createdArg.periodStart as Date).toISOString()).toBe(
        "2026-07-15T12:00:00.000Z",
      );
    });
  });
});

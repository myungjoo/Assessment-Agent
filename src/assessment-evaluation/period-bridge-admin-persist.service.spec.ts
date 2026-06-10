// PeriodBridgeAdminPersistService spec — T-0321, ADR-0037 slice 2(§Decision1 Admin
// full path + §Decision2 evaluation-side single-writer + amended §Decision3 first-write-
// wins read-through + §Decision4 fresh collect). R-112 4 종(happy / error / branch /
// negative 충분 cover, CLAUDE.md §3.2) 검증. 5 개 collaborator(CollectionSpecService.
// buildCollectionSpec / CollectionOrchestratorService.collectActivities /
// EvaluationOrchestratorService.evaluateActivities / EvaluationResultPersistService.
// persist / AssessmentRepository.{findById,findByCoordinate})를 전부 mock 주입 — 실 LLM
// / 실 DB / 실 네트워크 0. 본 spec 은 compose 정합(5 단계 순서·인자 pass-through →
// since 분기 → error 전파 → 빈 수집 흡수 → first-write-wins 3 분기[좌표 부재 create /
// 좌표 존재 read-through / P2002 race catch→read fall-through] → reeval 미호출 →
// ephemeral write-0 sibling 구조 보존)을 cover 한다.
import { ConflictException } from "@nestjs/common";
import type { Assessment, ServiceIdentity } from "@prisma/client";

import { CollectionOrchestratorService } from "../assessment-collection/collection-orchestrator.service";
import type { CollectionSpec } from "../assessment-collection/collection-orchestrator.service";
import { CollectionSpecService } from "../assessment-collection/collection-spec.service";
import type { Activity } from "../assessment-collection/domain/activity";
import { AssessmentRepository } from "../user/assessment.repository";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";
import { type ScoringOptions } from "./evaluation-scoring.service";
import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";
import {
  PeriodBridgeEphemeralService,
  type PeriodBridgePersonInput,
} from "./period-bridge-ephemeral.service";

// 임의 CollectionSpec fixture — pass-through 만 하므로 내부 구조 무관.
const SPEC: CollectionSpec = {
  github: { sources: [] },
  confluence: { instances: [] },
};

const OPTIONS: ScoringOptions = { modelId: "gpt-4o-deploy" };

// 유효 context 4-tuple — 영속 식별 축. negative test 가 override 로 개별 축을 깬다.
function buildContext(
  overrides: Partial<EvaluationPersistContext> = {},
): EvaluationPersistContext {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

// GithubActivity fixture — author/instanceKey 로 귀속 필터 분기 구성.
function githubActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    sourceType: "github",
    externalId: "abc123",
    instanceKey: "com",
    author: "octocat",
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: "octo-org/octo-repo",
    kind: "commit",
    ...overrides,
  } as Activity;
}

// EvaluationResult fixture — evaluateActivities mock 이 반환할 결과 1 건.
function resultFor(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: `narrative for ${unitId}`,
    difficulty: "medium",
    contribution: "medium",
    volume: 0,
  };
}

// person 입력 — service=com(activity.instanceKey 매칭) + externalId=octocat
// (activity.author 매칭) 이면 귀속된다(author-filter 규칙).
function personMatching(): PeriodBridgePersonInput {
  return {
    serviceIdentities: [
      { service: "com", externalId: "octocat" } as Pick<
        ServiceIdentity,
        "service" | "externalId"
      >,
    ],
  };
}

// 영속 Assessment fixture — read-back mock 이 반환할 row. id 로 분기를 식별한다.
function assessmentRow(id: string): Assessment {
  return {
    id,
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    difficulty: "medium",
    contributionScore: 2 as unknown as Assessment["contributionScore"],
    volume: 0,
    narrative: "persisted",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
  } as Assessment;
}

// mock collaborator 5 종 factory. 기본은 happy-path(좌표 부재 create) resolve.
function makeMocks(): {
  spec: { buildCollectionSpec: jest.Mock };
  orchestrator: { collectActivities: jest.Mock };
  evaluation: { evaluateActivities: jest.Mock };
  persist: { persist: jest.Mock };
  repo: { findById: jest.Mock; findByCoordinate: jest.Mock };
} {
  return {
    spec: { buildCollectionSpec: jest.fn().mockResolvedValue(SPEC) },
    orchestrator: { collectActivities: jest.fn().mockResolvedValue([]) },
    evaluation: { evaluateActivities: jest.fn().mockResolvedValue([]) },
    // 기본 create 분기 — contributionCount > 0 → created=true.
    persist: {
      persist: jest
        .fn()
        .mockResolvedValue({ assessmentId: "asmt-1", contributionCount: 3 }),
    },
    repo: {
      findById: jest.fn().mockResolvedValue(assessmentRow("asmt-1")),
      findByCoordinate: jest.fn().mockResolvedValue(assessmentRow("asmt-1")),
    },
  };
}

// service + mock 5 종 직접 생성 — sibling service spec 의 direct-construction idiom mirror.
function makeService(
  mocks: ReturnType<typeof makeMocks>,
): PeriodBridgeAdminPersistService {
  return new PeriodBridgeAdminPersistService(
    mocks.spec as unknown as CollectionSpecService,
    mocks.orchestrator as unknown as CollectionOrchestratorService,
    mocks.evaluation as unknown as EvaluationOrchestratorService,
    mocks.persist as unknown as EvaluationResultPersistService,
    mocks.repo as unknown as AssessmentRepository,
  );
}

describe("PeriodBridgeAdminPersistService", () => {
  describe("happy-path — collect→filter→evaluate→persist(fill)→read-back (좌표 부재 create)", () => {
    it("5 단계를 순서대로 호출하고 persist('fill') 1 회 + 영속 Assessment 를 반환한다", async () => {
      const mocks = makeMocks();
      const person = personMatching();
      const context = buildContext();
      const activities = [
        githubActivity({ externalId: "c1", author: "octocat" }),
      ];
      mocks.orchestrator.collectActivities.mockResolvedValue(activities);
      const evaluated = [resultFor("github:com:c1")];
      mocks.evaluation.evaluateActivities.mockResolvedValue(evaluated);
      const service = makeService(mocks);

      const result = await service.generateAndPersist(
        person,
        { since: "2026-01-01T00:00:00Z" },
        OPTIONS,
        context,
      );

      // (1) buildCollectionSpec(person, since).
      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        person,
        "2026-01-01T00:00:00Z",
      );
      // (2) collectActivities(spec).
      expect(mocks.orchestrator.collectActivities).toHaveBeenCalledWith(SPEC);
      // (4) evaluateActivities(귀속 활동, options).
      const [evalArg, optArg] =
        mocks.evaluation.evaluateActivities.mock.calls[0];
      expect(evalArg).toEqual(activities);
      expect(optArg).toBe(OPTIONS);
      // (5) persist(context, results, "fill") — 1 회, mode "fill".
      expect(mocks.persist.persist).toHaveBeenCalledTimes(1);
      expect(mocks.persist.persist).toHaveBeenCalledWith(
        context,
        evaluated,
        "fill",
      );
      // read-back: 반환 assessmentId 로 findById.
      expect(mocks.repo.findById).toHaveBeenCalledWith("asmt-1");
      // 좌표 부재 create(contributionCount > 0) → created=true + 영속 Assessment 반환.
      expect(result.created).toBe(true);
      expect(result.assessment.id).toBe("asmt-1");
    });

    it("호출 순서가 spec → collect → evaluate → persist → read-back 으로 보장된다", async () => {
      const mocks = makeMocks();
      const order: string[] = [];
      mocks.spec.buildCollectionSpec.mockImplementation(async () => {
        order.push("spec");
        return SPEC;
      });
      mocks.orchestrator.collectActivities.mockImplementation(async () => {
        order.push("collect");
        return [githubActivity()];
      });
      mocks.evaluation.evaluateActivities.mockImplementation(async () => {
        order.push("evaluate");
        return [resultFor("github:com:abc123")];
      });
      mocks.persist.persist.mockImplementation(async () => {
        order.push("persist");
        return { assessmentId: "asmt-1", contributionCount: 1 };
      });
      mocks.repo.findById.mockImplementation(async () => {
        order.push("read-back");
        return assessmentRow("asmt-1");
      });
      const service = makeService(mocks);

      await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      expect(order).toEqual([
        "spec",
        "collect",
        "evaluate",
        "persist",
        "read-back",
      ]);
    });
  });

  describe("branch / flow — first-write-wins read-through 3 분기 + since pass-through", () => {
    it("(i) 좌표 부재 — create 후 read-back, created=true (위 happy-path 와 합쳐 cover)", async () => {
      const mocks = makeMocks();
      mocks.persist.persist.mockResolvedValue({
        assessmentId: "asmt-1",
        contributionCount: 2,
      });
      const service = makeService(mocks);

      const result = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      expect(result.created).toBe(true);
      expect(mocks.repo.findById).toHaveBeenCalledWith("asmt-1");
      expect(mocks.repo.findByCoordinate).not.toHaveBeenCalled();
    });

    it("(ii) 좌표 존재 — persist no-op(contributionCount 0) → read-through, write 미발생, created=false", async () => {
      const mocks = makeMocks();
      // 좌표 존재 → "fill" no-op: assessmentId 만 반환, contributionCount 0(새 write 0).
      mocks.persist.persist.mockResolvedValue({
        assessmentId: "asmt-existing",
        contributionCount: 0,
      });
      mocks.repo.findById.mockResolvedValue(assessmentRow("asmt-existing"));
      const service = makeService(mocks);

      const result = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      // persist 는 정확히 1 회(두 번째 create 0) + "fill" 모드(reeval 아님).
      expect(mocks.persist.persist).toHaveBeenCalledTimes(1);
      expect(mocks.persist.persist.mock.calls[0][2]).toBe("fill");
      // 기존 저장본 read-through 반환(409 미발생).
      expect(result.created).toBe(false);
      expect(result.assessment.id).toBe("asmt-existing");
    });

    it("(iii) race P2002 — persist 가 ConflictException → catch 후 좌표 read fall-through, created=false (409 전파 0)", async () => {
      const mocks = makeMocks();
      mocks.persist.persist.mockRejectedValue(
        new ConflictException("평가 결과가 이미 존재한다"),
      );
      mocks.repo.findByCoordinate.mockResolvedValue(
        assessmentRow("asmt-winner"),
      );
      const service = makeService(mocks);

      const context = buildContext();
      const result = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        context,
      );

      // 409 가 caller 로 전파되지 않고 좌표 read 로 fall-through.
      expect(mocks.repo.findByCoordinate).toHaveBeenCalledWith({
        personId: context.personId,
        period: context.period,
        scope: context.scope,
        periodStart: context.periodStart,
      });
      // findById 는 호출 안 됨(persist 가 throw 했으므로 assessmentId 부재).
      expect(mocks.repo.findById).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.assessment.id).toBe("asmt-winner");
    });

    it("since 지정 시 buildCollectionSpec 에 그 값이 그대로 전달된다", async () => {
      const mocks = makeMocks();
      const service = makeService(mocks);

      await service.generateAndPersist(
        personMatching(),
        { since: "2026-03-01T00:00:00Z" },
        OPTIONS,
        buildContext(),
      );

      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        expect.anything(),
        "2026-03-01T00:00:00Z",
      );
    });

    it("since 미지정(undefined) 시 buildCollectionSpec 에 undefined 가 전달된다", async () => {
      const mocks = makeMocks();
      const service = makeService(mocks);

      await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
      );
    });
  });

  describe("error path — 실패 전파(swallow 0, fail-fast)", () => {
    it("(a) evaluateActivities reject → 전파 + persist 미호출", async () => {
      const mocks = makeMocks();
      const boom = new Error("scoring 실패");
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity(),
      ]);
      mocks.evaluation.evaluateActivities.mockRejectedValue(boom);
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).rejects.toThrow("scoring 실패");
      // persist 미도달(fail-fast — 평가 실패 시 영속화 0).
      expect(mocks.persist.persist).not.toHaveBeenCalled();
    });

    it("(b) buildCollectionSpec reject → 전파(fail-fast) + 이후 단계 미호출", async () => {
      const mocks = makeMocks();
      mocks.spec.buildCollectionSpec.mockRejectedValue(
        new Error("spec 조립 실패"),
      );
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).rejects.toThrow("spec 조립 실패");
      expect(mocks.orchestrator.collectActivities).not.toHaveBeenCalled();
      expect(mocks.evaluation.evaluateActivities).not.toHaveBeenCalled();
      expect(mocks.persist.persist).not.toHaveBeenCalled();
    });

    it("(c) persist 가 ConflictException 외 error → 전파(P2002 만 catch, 그 외 삼키지 않음)", async () => {
      const mocks = makeMocks();
      mocks.persist.persist.mockRejectedValue(
        new Error("알 수 없는 difficulty"),
      );
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).rejects.toThrow("알 수 없는 difficulty");
      // read fall-through 미발동(ConflictException 아니므로).
      expect(mocks.repo.findByCoordinate).not.toHaveBeenCalled();
    });

    it("read-back(findById) 이 null → 영속화 직후 부재는 명시적 throw", async () => {
      const mocks = makeMocks();
      mocks.repo.findById.mockResolvedValue(null);
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).rejects.toThrow("Assessment read-back 실패");
    });

    it("P2002 fall-through 후 좌표 read-back(findByCoordinate) null → 명시적 throw", async () => {
      const mocks = makeMocks();
      mocks.persist.persist.mockRejectedValue(
        new ConflictException("이미 존재"),
      );
      mocks.repo.findByCoordinate.mockResolvedValue(null);
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).rejects.toThrow("좌표 read-back 실패");
    });
  });

  describe("negative cases — 예외 상황 분기마다 충분 cover", () => {
    it("2 번째 동일 좌표 호출은 read-through — persist no-op + 두 번째 create 0 + 409 미발생", async () => {
      const mocks = makeMocks();
      // 1 번째: create(contributionCount 3). 2 번째: 좌표 존재 no-op(contributionCount 0).
      mocks.persist.persist
        .mockResolvedValueOnce({ assessmentId: "asmt-1", contributionCount: 3 })
        .mockResolvedValueOnce({
          assessmentId: "asmt-1",
          contributionCount: 0,
        });
      mocks.repo.findById.mockResolvedValue(assessmentRow("asmt-1"));
      const service = makeService(mocks);
      const context = buildContext();

      const first = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        context,
      );
      const second = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        context,
      );

      // 첫 호출은 create, 두 번째는 read-through(write 미발생) — 같은 저장본으로 수렴.
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.assessment.id).toBe("asmt-1");
      // persist 는 2 회 호출되되 둘 다 "fill"(reeval 0) — 두 번째 create 는 persist 내부
      // no-op 으로 흡수(본 service 는 reeval 을 절대 전달하지 않음).
      expect(mocks.persist.persist).toHaveBeenCalledTimes(2);
      expect(
        mocks.persist.persist.mock.calls.every((c) => c[2] === "fill"),
      ).toBe(true);
    });

    it("reeval 모드 미호출 — 본 service 는 persist 를 항상 'fill' 로만 호출(overwrite DEFERRED 가드)", async () => {
      const mocks = makeMocks();
      const service = makeService(mocks);

      await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      const modes = mocks.persist.persist.mock.calls.map((c) => c[2]);
      expect(modes).toContain("fill");
      expect(modes).not.toContain("reeval");
    });

    it("빈 수집 흡수 — collectActivities 빈 배열 → evaluateActivities([]) → persist 빈 입력 경로(throw 0)", async () => {
      const mocks = makeMocks();
      mocks.orchestrator.collectActivities.mockResolvedValue([]);
      mocks.evaluation.evaluateActivities.mockResolvedValue([]);
      mocks.persist.persist.mockResolvedValue({
        assessmentId: "asmt-empty",
        contributionCount: 0,
      });
      mocks.repo.findById.mockResolvedValue(assessmentRow("asmt-empty"));
      const service = makeService(mocks);

      const context = buildContext();
      const result = await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        context,
      );

      // 빈 결과로 evaluate 호출 + persist 가 빈 입력(context, [], "fill")을 받아도
      // throw 0 → 영속본 수렴.
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledWith(
        [],
        OPTIONS,
      );
      expect(mocks.persist.persist).toHaveBeenCalledWith(context, [], "fill");
      expect(result.assessment.id).toBe("asmt-empty");
    });

    it("귀속 0 건 흡수 — author 불일치 활동만 수집 → 평가 입력 빈 배열 → persist 빈 입력", async () => {
      const mocks = makeMocks();
      // author 가 person 의 externalId(octocat)와 불일치 → 귀속 0 건.
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity({ author: "stranger" }),
      ]);
      const service = makeService(mocks);

      await service.generateAndPersist(
        personMatching(),
        {},
        OPTIONS,
        buildContext(),
      );

      // 귀속 0 건이므로 evaluateActivities 는 빈 배열을 받는다.
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledWith(
        [],
        OPTIONS,
      );
    });

    it("collection-orchestrator partial-failure 흡수 — orchestrator throw 0 전제 하 본 service 도 별도 throw 0", async () => {
      const mocks = makeMocks();
      // orchestrator 는 부분 실패를 자체 흡수해 (예: 부분) Activity[] 를 반환한다(throw 0).
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity(),
      ]);
      const service = makeService(mocks);

      await expect(
        service.generateAndPersist(
          personMatching(),
          {},
          OPTIONS,
          buildContext(),
        ),
      ).resolves.toBeDefined();
      // 본 service 는 collectActivities 를 try 로 감싸지 않는다 — orchestrator throw 0 전제.
    });

    it("ephemeral write-0 sibling 구조 보존 — Admin service 는 persist 를 주입받지만 ephemeral service 는 persist symbol 주입조차 안 한다", () => {
      // Admin service 생성자는 5 자리(마지막 2 = persist / repo)를 받는다.
      expect(PeriodBridgeAdminPersistService.length).toBe(5);
      // ephemeral service 생성자는 3 자리(persist-free 만) — persist 도달 불가 구조적 보장.
      expect(PeriodBridgeEphemeralService.length).toBe(3);
    });
  });
});

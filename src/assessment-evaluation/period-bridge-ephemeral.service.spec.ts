// PeriodBridgeEphemeralService spec — T-0316, ADR-0037 §Decision1 User self-only
// ephemeral 경로 + §Decision4 fresh in-memory collect. R-112 4 종(happy / error /
// branch / negative 충분 cover, CLAUDE.md §3.2) 검증. 세 collaborator
// (CollectionSpecService.buildCollectionSpec / CollectionOrchestratorService.
// collectActivities / EvaluationOrchestratorService.evaluateActivities)를 전부 mock
// 주입 — 실 LLM / 실 DB / 실 네트워크 0. 본 service 는 thin compose(buildCollectionSpec
// → collectActivities → filterActivitiesByAuthor[순수 함수, 실호출] → evaluateActivities)
// 라, 본 spec 은 compose 의 정합(4 단계 호출 순서·인자 pass-through → since 분기 →
// error 전파 → 빈 수집 흡수 → persist 미주입의 구조적 write-0)을 cover 한다.
import type { ServiceIdentity } from "@prisma/client";

import { CollectionOrchestratorService } from "../assessment-collection/collection-orchestrator.service";
import type { CollectionSpec } from "../assessment-collection/collection-orchestrator.service";
import { CollectionSpecService } from "../assessment-collection/collection-spec.service";
import type { Activity } from "../assessment-collection/domain/activity";

import type { EvaluationResult } from "./domain/evaluation-result";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { type ScoringOptions } from "./evaluation-scoring.service";
import {
  PeriodBridgeEphemeralService,
  type PeriodBridgePersonInput,
} from "./period-bridge-ephemeral.service";

// 임의 CollectionSpec fixture — 본 service 는 spec 을 collectActivities 로 pass-through
// 만 하므로 내부 구조는 무관(빈 github/confluence enumerate 로 충분).
const SPEC: CollectionSpec = {
  github: { sources: [] },
  confluence: { instances: [] },
};

const OPTIONS: ScoringOptions = { modelId: "gpt-4o-deploy" };

// GithubActivity fixture — author/instanceKey 를 바꿔 귀속 필터 분기를 구성한다.
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

// person 입력 — serviceIdentity 의 service=com(activity.instanceKey 와 매칭) +
// externalId=octocat(activity.author 와 매칭) 이면 귀속된다(author-filter 규칙).
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

// mock collaborator 3 종 factory. 기본은 happy-path resolve. 각 테스트가
// mockRejectedValueOnce / mockResolvedValueOnce 로 override 한다.
function makeMocks(): {
  spec: { buildCollectionSpec: jest.Mock };
  orchestrator: { collectActivities: jest.Mock };
  evaluation: { evaluateActivities: jest.Mock };
} {
  return {
    spec: { buildCollectionSpec: jest.fn().mockResolvedValue(SPEC) },
    orchestrator: { collectActivities: jest.fn().mockResolvedValue([]) },
    evaluation: { evaluateActivities: jest.fn().mockResolvedValue([]) },
  };
}

// service + mock 3 종 직접 생성(new Service(...mocks)) — sibling service spec 의
// direct-construction idiom mirror(Test.createTestingModule 불요).
function makeService(
  mocks: ReturnType<typeof makeMocks>,
): PeriodBridgeEphemeralService {
  return new PeriodBridgeEphemeralService(
    mocks.spec as unknown as CollectionSpecService,
    mocks.orchestrator as unknown as CollectionOrchestratorService,
    mocks.evaluation as unknown as EvaluationOrchestratorService,
  );
}

describe("PeriodBridgeEphemeralService", () => {
  describe("happy-path — collect→filter→evaluate→return (in-memory)", () => {
    it("4 단계를 순서대로 호출하고 in-memory EvaluationResult[] 를 반환한다", async () => {
      const mocks = makeMocks();
      const person = personMatching();
      const activities = [githubActivity({ externalId: "c1" })];
      mocks.orchestrator.collectActivities.mockResolvedValue(activities);
      const expected = [resultFor("github:com:c1")];
      mocks.evaluation.evaluateActivities.mockResolvedValue(expected);
      const service = makeService(mocks);

      const results = await service.generateEphemeral(
        person,
        { since: "2026-01-01T00:00:00Z" },
        OPTIONS,
      );

      // 반환값은 evaluateActivities 결과 그대로(in-memory, persist 0).
      expect(results).toBe(expected);

      // (1) buildCollectionSpec(person, since) 호출.
      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledTimes(1);
      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        person,
        "2026-01-01T00:00:00Z",
      );
      // (2) collectActivities(spec) — buildCollectionSpec 산출 spec 을 그대로 받음.
      expect(mocks.orchestrator.collectActivities).toHaveBeenCalledWith(SPEC);
      // (4) evaluateActivities(귀속 활동, options) — 귀속된 1 건 + options pass-through.
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledTimes(1);
      const [evalArg, optArg] =
        mocks.evaluation.evaluateActivities.mock.calls[0];
      expect(evalArg).toEqual(activities);
      expect(optArg).toBe(OPTIONS);
    });

    it("호출 순서가 spec → collect → evaluate 로 보장된다", async () => {
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
        return [];
      });
      const service = makeService(mocks);

      await service.generateEphemeral(personMatching(), {}, OPTIONS);

      expect(order).toEqual(["spec", "collect", "evaluate"]);
    });
  });

  describe("branch / flow — since 미지정 vs 지정 pass-through", () => {
    it("since 지정 시 buildCollectionSpec 에 그 값이 그대로 전달된다", async () => {
      const mocks = makeMocks();
      const service = makeService(mocks);

      await service.generateEphemeral(
        personMatching(),
        { since: "2026-03-01T00:00:00Z" },
        OPTIONS,
      );

      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        expect.anything(),
        "2026-03-01T00:00:00Z",
      );
    });

    it("since 미지정(undefined) 시 buildCollectionSpec 에 undefined 가 전달된다", async () => {
      const mocks = makeMocks();
      const service = makeService(mocks);

      await service.generateEphemeral(personMatching(), {}, OPTIONS);

      expect(mocks.spec.buildCollectionSpec).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
      );
    });
  });

  describe("error path — 실패 전파(swallow 0, fail-fast)", () => {
    it("(a) collectActivities 가 빈 Activity[] → evaluateActivities([]) 호출 + 빈 결과 반환(throw 0)", async () => {
      const mocks = makeMocks();
      mocks.orchestrator.collectActivities.mockResolvedValue([]);
      mocks.evaluation.evaluateActivities.mockResolvedValue([]);
      const service = makeService(mocks);

      const results = await service.generateEphemeral(
        personMatching(),
        {},
        OPTIONS,
      );

      expect(results).toEqual([]);
      // 빈 수집이라도 evaluateActivities 는 빈 배열로 호출된다(빈 수집 흡수).
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledWith(
        [],
        OPTIONS,
      );
    });

    it("(b) evaluateActivities reject 시 그 error 가 swallow 없이 전파된다", async () => {
      const mocks = makeMocks();
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity(),
      ]);
      const boom = new Error("LLM HTTP 호출 실패 (status: 503)");
      mocks.evaluation.evaluateActivities.mockRejectedValue(boom);
      const service = makeService(mocks);

      await expect(
        service.generateEphemeral(personMatching(), {}, OPTIONS),
      ).rejects.toThrow(boom);
    });

    it("buildCollectionSpec reject 시 fail-fast — collect/evaluate 미진입", async () => {
      const mocks = makeMocks();
      const boom = new Error("GitHub spec 조립 실패");
      mocks.spec.buildCollectionSpec.mockRejectedValue(boom);
      const service = makeService(mocks);

      await expect(
        service.generateEphemeral(personMatching(), {}, OPTIONS),
      ).rejects.toThrow(boom);
      // spec 단계에서 throw → 이후 단계 미호출(fail-fast).
      expect(mocks.orchestrator.collectActivities).not.toHaveBeenCalled();
      expect(mocks.evaluation.evaluateActivities).not.toHaveBeenCalled();
    });
  });

  describe("negative — author 귀속 / persist 미호출 구조적 write-0", () => {
    it("타인 활동만 수집되면 귀속 0 건 → evaluateActivities([]) → 빈 결과", async () => {
      const mocks = makeMocks();
      // 수집된 활동의 author 가 person 의 externalId 와 불일치 → 귀속 0.
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity({ author: "someone-else" }),
      ]);
      const service = makeService(mocks);

      const results = await service.generateEphemeral(
        personMatching(),
        {},
        OPTIONS,
      );

      expect(results).toEqual([]);
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledWith(
        [],
        OPTIONS,
      );
    });

    it("귀속 활동만 evaluateActivities 로 넘어간다(타인 활동 제외)", async () => {
      const mocks = makeMocks();
      const mine = githubActivity({ externalId: "mine", author: "octocat" });
      const theirs = githubActivity({ externalId: "theirs", author: "other" });
      mocks.orchestrator.collectActivities.mockResolvedValue([mine, theirs]);
      const service = makeService(mocks);

      await service.generateEphemeral(personMatching(), {}, OPTIONS);

      const [filtered] = mocks.evaluation.evaluateActivities.mock.calls[0];
      expect(filtered).toEqual([mine]);
    });

    it("구조적 write-0 — 생성자 의존이 정확히 3 개이고 persist symbol 미주입", () => {
      // 본 service 의 생성자 arity 가 3(spec/orchestrator/evaluation)임을 박제 —
      // EvaluationResultPersistService / CollectionPersistenceService / collectForPerson /
      // PrismaService 가 주입되면 arity 가 늘어 본 단언이 fail 한다(ADR-0037 §Decision1
      // ephemeral write-0 의 unit-level 회귀 가드). e2e DB-write-0 검증은 slice 5.
      expect(PeriodBridgeEphemeralService.length).toBe(3);
    });

    it("persist 경로 미존재 — 주입된 3 mock 외 어떤 write 호출도 발생하지 않는다", async () => {
      const mocks = makeMocks();
      mocks.orchestrator.collectActivities.mockResolvedValue([
        githubActivity(),
      ]);
      mocks.evaluation.evaluateActivities.mockResolvedValue([
        resultFor("github:com:abc123"),
      ]);
      const service = makeService(mocks);

      await service.generateEphemeral(personMatching(), {}, OPTIONS);

      // 주입된 mock 3 종은 전부 persist-free / in-memory. persist mock 을 주입하지
      // 않았으므로 본 service 가 persist 를 호출할 surface 자체가 없다 — 호출 횟수로
      // collect/evaluate 만 정확히 1 회씩 호출됐음을 확인(추가 write path 0).
      expect(mocks.orchestrator.collectActivities).toHaveBeenCalledTimes(1);
      expect(mocks.evaluation.evaluateActivities).toHaveBeenCalledTimes(1);
    });
  });

  describe("determinism / no-side-effect", () => {
    it("동일 입력 + 동일 mock 응답 → 동일 결과(2 회 호출)", async () => {
      const activities = [githubActivity({ externalId: "d1" })];
      const expected = [resultFor("github:com:d1")];

      const a = makeMocks();
      a.orchestrator.collectActivities.mockResolvedValue(activities);
      a.evaluation.evaluateActivities.mockResolvedValue(expected);
      const first = await makeService(a).generateEphemeral(
        personMatching(),
        {},
        OPTIONS,
      );

      const b = makeMocks();
      b.orchestrator.collectActivities.mockResolvedValue(activities);
      b.evaluation.evaluateActivities.mockResolvedValue(expected);
      const second = await makeService(b).generateEphemeral(
        personMatching(),
        {},
        OPTIONS,
      );

      expect(first).toEqual(second);
    });
  });
});

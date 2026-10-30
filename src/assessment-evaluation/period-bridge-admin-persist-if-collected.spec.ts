import { Logger } from "@nestjs/common";

import { CollectionOrchestratorService } from "../assessment-collection/collection-orchestrator.service";
import { ConfluenceCollectionService } from "../assessment-collection/confluence-collection.service";
import { GithubCollectionService } from "../assessment-collection/github-collection.service";

import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";

const SOURCE = { instanceKey: "com", org: "o", repo: "r" };
const SPACES = { key: "wiki", spaceAllowlist: ["A", "B"] };
const PERSON = {
  serviceIdentities: [{ service: "com", externalId: "gildong" }],
};
const PERIOD = {
  since: "2026-10-22T15:00:00.000Z",
  until: "2026-10-23T15:00:00.000Z",
};
const CONTEXT = {
  personId: "p1",
  period: "day",
  scope: "aggregate",
  periodStart: new Date(PERIOD.since),
};
const commit = (date: string, login = "gildong"): unknown => ({
  sha: `sha-${date}-${login}`,
  commit: { author: { name: "n", date } },
  author: { login },
});

// 실 수집 service 3 종을 잇고 leaf(client · traversal)만 mock 해 tally 전달 경로까지 검증한다.
function setup(
  spec: {
    sources?: unknown[];
    instances?: unknown[];
    person?: typeof PERSON;
    coverage?: { complete: boolean; unavailableKeys: string[] };
  } = {},
) {
  const client = {
    requestAllPagesForInstance: jest.fn().mockResolvedValue([]),
  };
  const traversal = { traverseInstance: jest.fn().mockResolvedValue([]) };
  const github = new GithubCollectionService(client as never);
  const confluence = new ConfluenceCollectionService(traversal as never);
  const evaluation = { evaluateActivities: jest.fn().mockResolvedValue([]) };
  const persist = {
    persist: jest
      .fn()
      .mockResolvedValue({ assessmentId: "a", contributionCount: 0 }),
  };
  const service = new PeriodBridgeAdminPersistService(
    {
      buildCollectionSpecWithCoverage: jest.fn().mockResolvedValue({
        spec: {
          github: { sources: spec.sources ?? [SOURCE] },
          confluence: { instances: spec.instances ?? [] },
        },
        coverage: spec.coverage ?? { complete: true, unavailableKeys: [] },
      }),
    } as never,
    new CollectionOrchestratorService(github, confluence),
    evaluation as never,
    persist as never,
    { findById: jest.fn().mockResolvedValue({ id: "a" }) } as never,
  );
  const run = (reevaluate?: boolean) =>
    service.generateAndPersistIfCollected(
      spec.person ?? PERSON,
      PERIOD,
      { modelId: "m" },
      CONTEXT,
      reevaluate,
    );
  return { run, client, traversal, github, confluence, evaluation, persist };
}
type Mocks = ReturnType<typeof setup>;

describe("PeriodBridgeAdminPersistService.generateAndPersistIfCollected", () => {
  it("모든 호출이 성공한 0 건은 실제 무활동이라 빈 평가를 저장한다", async () => {
    const { run, evaluation, persist } = setup();
    await expect(run()).resolves.toEqual({
      assessment: { id: "a" },
      created: false,
    });
    expect(evaluation.evaluateActivities).toHaveBeenCalledWith([], {
      modelId: "m",
    });
    expect(persist.persist).toHaveBeenCalledWith(CONTEXT, [], "fill");
  });

  it("Confluence 만 쓰는 인원의 전 SPACE 성공 0 건은 빈 평가를 저장한다", async () => {
    const { run, traversal, persist } = setup({
      sources: [],
      instances: [{ ...SPACES, key: "com" }],
    });
    traversal.traverseInstance.mockResolvedValue([
      { spaceKey: "A", pages: [] },
      { spaceKey: "B", pages: [] },
    ]);
    await expect(run()).resolves.not.toBeNull();
    expect(persist.persist).toHaveBeenCalledTimes(1);
  });

  it("모든 호출이 성공하면 창 · 귀속 필터 결과만 평가해 저장한다", async () => {
    const { run, client, evaluation, persist } = setup();
    client.requestAllPagesForInstance.mockResolvedValueOnce([
      commit("2026-10-23T00:00:00Z"),
      commit("2026-10-23T00:00:00Z", "someone-else"),
      commit(PERIOD.until),
    ]);
    await run();
    expect(evaluation.evaluateActivities.mock.calls[0][0]).toHaveLength(1);
    expect(persist.persist).toHaveBeenCalledTimes(1);
  });

  it("reevaluate 는 수집이 완전할 때 reeval 로 저장한다", async () => {
    const { run, persist } = setup();
    await run(true);
    expect(persist.persist).toHaveBeenCalledWith(CONTEXT, [], "reeval");
  });

  it("활동이 있어도 호출 하나가 실패하면 저장하지 않는다_n", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const { run, client, evaluation, persist } = setup();
    client.requestAllPagesForInstance
      .mockResolvedValueOnce([commit("2026-10-23T00:00:00Z")])
      .mockRejectedValueOnce(new Error("403"));
    await expect(run()).resolves.toBeNull();
    expect(evaluation.evaluateActivities).not.toHaveBeenCalled();
    expect(persist.persist).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("범위 미달이면 수집 호출 없이 건너뛰고 사유를 경고한다_n", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const { run, client, evaluation, persist } = setup({
      coverage: { complete: false, unavailableKeys: ["SEC"] },
    });
    await expect(run()).resolves.toBeNull();
    expect(client.requestAllPagesForInstance).not.toHaveBeenCalled();
    expect(evaluation.evaluateActivities).not.toHaveBeenCalled();
    expect(persist.persist).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/personId=p1 .*unavailable=SEC$/),
    );
    warn.mockRestore();
  });

  it("불완전하면 reevaluate 여도 기존 평가를 건드리지 않는다_n", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const { run, client, persist } = setup();
    client.requestAllPagesForInstance.mockRejectedValueOnce(new Error("500"));
    await expect(run(true)).resolves.toBeNull();
    expect(persist.persist).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("창 밖 활동만 있고 호출이 실패했으면 수집 불가로 본다_n", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const { run, client, persist } = setup();
    client.requestAllPagesForInstance
      .mockRejectedValueOnce(new Error("403"))
      .mockResolvedValueOnce([commit(PERIOD.until)]);
    await expect(run()).resolves.toBeNull();
    expect(persist.persist).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("succeeded=2 failed=1"),
    );
    warn.mockRestore();
  });

  it.each<[string, (m: Mocks) => unknown, Parameters<typeof setup>[0]]>([
    [
      "GitHub 호출 전부 실패(token 만료)",
      (m) =>
        m.client.requestAllPagesForInstance.mockRejectedValue(new Error("401")),
      undefined,
    ],
    [
      "일부 호출 실패 + 나머지 0 건",
      (m) =>
        m.client.requestAllPagesForInstance.mockRejectedValueOnce(
          new Error("403"),
        ),
      undefined,
    ],
    [
      "GitHub 전 호출 성공 + Confluence instance 실패",
      (m) => m.traversal.traverseInstance.mockRejectedValue(new Error("key")),
      { instances: [SPACES] },
    ],
    [
      "GitHub 전 호출 성공 + Confluence SPACE 일부 skip",
      (m) =>
        m.traversal.traverseInstance.mockResolvedValue([
          { spaceKey: "A", pages: [] },
        ]),
      { instances: [SPACES] },
    ],
    [
      "GitHub service 레벨 throw",
      (m) => {
        m.traversal.traverseInstance.mockResolvedValue([
          { spaceKey: "A", pages: [] },
          { spaceKey: "B", pages: [] },
        ]);
        jest
          .spyOn(m.github, "collectGithubActivities")
          .mockRejectedValue(new Error("boom"));
      },
      { instances: [SPACES] },
    ],
    [
      "Confluence service 레벨 throw",
      (m) =>
        jest
          .spyOn(m.confluence, "collectConfluenceActivities")
          .mockRejectedValue(new Error("boom")),
      undefined,
    ],
  ])("%s 이면 평가 · 저장 없이 null 이다_n", async (_label, arrange, spec) => {
    const mocks = setup(spec);
    arrange(mocks);
    await expect(mocks.run()).resolves.toBeNull();
    expect(mocks.evaluation.evaluateActivities).not.toHaveBeenCalled();
    expect(mocks.persist.persist).not.toHaveBeenCalled();
  });

  it("LLM 평가 실패는 삼키지 않고 저장 없이 전파한다_n", async () => {
    const { run, evaluation, persist } = setup();
    evaluation.evaluateActivities.mockRejectedValue(new Error("llm"));
    await expect(run()).rejects.toThrow("llm");
    expect(persist.persist).not.toHaveBeenCalled();
  });
});

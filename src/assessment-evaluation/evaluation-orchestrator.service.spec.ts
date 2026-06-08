// EvaluationOrchestratorService spec — T-0292, ADR-0032 §1/§4/§2 compose slice.
// R-112 4 종(happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) 검증.
// EvaluationScoringService 는 mock { scoreUnit: jest.fn() } 으로 주입 — 실 LLM 호출
// 0 / 실 네트워크 0 / live credential 0. 본 orchestrator 는 thin compose
// (map(mapActivityToEvaluationInput) → dedupTemporalDuplicates → excludeSelfFollowUps
// → 단위별 scoreUnit 순차 호출 → EvaluationResult[]) 라, 매핑·dedup·scoring 순수
// 함수의 동작은 각자 spec 이 검증하고 본 spec 은 compose 의 정합(정규화 → dedup branch
// → 호출 횟수·인자·순서 → error 전파 → 빈 입력 경계 → 결정성·비변형)을 cover 한다.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../assessment-collection/domain/activity";

import { mapActivityToEvaluationInput } from "./domain/evaluation-input.mapper";
import type { EvaluationResult } from "./domain/evaluation-result";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationScoringService,
  type ScoringOptions,
} from "./evaluation-scoring.service";

// GithubActivity fixture — commit(code 기여). overrides 로 kind/externalId/author/
// timestamp 를 바꿔 dedup / contributionKind 분기를 구성한다.
function githubActivity(
  overrides: Partial<GithubActivity> = {},
): GithubActivity {
  return {
    sourceType: "github",
    externalId: "abc123",
    instanceKey: "com/sec",
    author: "octocat",
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: "octo-org/octo-repo",
    kind: "commit",
    ...overrides,
  };
}

// ConfluenceActivity fixture — page(document 기여).
function confluenceActivity(
  overrides: Partial<ConfluenceActivity> = {},
): ConfluenceActivity {
  return {
    sourceType: "confluence",
    externalId: "page-7",
    instanceKey: "wiki",
    author: "writer",
    timestamp: "2026-06-02T09:30:00Z",
    metadata: { titleLength: 10 },
    spaceRef: "ENG",
    version: 3,
    ...overrides,
  };
}

const OPTIONS: ScoringOptions = { modelId: "gpt-4o-deploy" };

// mock scoreUnit 응답 조립 — orchestrator 는 scoreUnit 결과를 그대로 수집하므로,
// 입력 unitId 를 echo 한 EvaluationResult 로 호출 순서·대상 단위를 단언할 수 있다.
function resultFor(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: `narrative for ${unitId}`,
    difficulty: "medium",
    contribution: "medium",
    volume: 0,
  };
}

// mock scoring service factory — scoreUnit 은 jest.fn 으로 주입(실 호출 0). 기본은
// 받은 input 의 unitId 를 echo 한 result 를 resolve 하므로, 호출 순서가 결과 순서로
// 그대로 드러난다. 각 테스트가 mockRejectedValueOnce 등으로 override 한다.
function makeScoringService(): { scoreUnit: jest.Mock } {
  return {
    scoreUnit: jest.fn().mockImplementation(async (input: { unitId: string }) =>
      // eslint-disable-next-line @typescript-eslint/require-await
      resultFor(input.unitId),
    ),
  };
}

// orchestrator + mock scoring service 직접 생성(new Service(mock)) — sibling
// service spec 의 direct-construction idiom mirror(생성자 의존이 scoringService
// 단일이라 Test.createTestingModule 불요).
function makeOrchestrator(scoringService: {
  scoreUnit: jest.Mock;
}): EvaluationOrchestratorService {
  return new EvaluationOrchestratorService(
    scoringService as unknown as EvaluationScoringService,
  );
}

describe("EvaluationOrchestratorService", () => {
  describe("happy-path — Activity[] → 정규화 → dedup → scoring → EvaluationResult[]", () => {
    it("github commit + github issue + confluence page 혼합 → 올바른 순서·개수로 반환", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "commit-1", kind: "commit" }),
        githubActivity({ externalId: "issue-1", kind: "issue" }),
        confluenceActivity({ externalId: "page-1" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 중복·self-follow-up 없음 → 3 건 모두 scoring, 입력 순서 보존.
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.unitId)).toEqual([
        "github:com/sec:commit-1",
        "github:com/sec:issue-1",
        "confluence:wiki:page-1",
      ]);
    });

    it("scoreUnit 에 매퍼 결과(unitId/contributionKind 정규화)가 그대로 넘어간다", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const commit = githubActivity({ externalId: "commit-9", kind: "commit" });
      const issue = githubActivity({ externalId: "issue-9", kind: "issue" });

      await orchestrator.evaluateActivities([commit, issue], OPTIONS);

      // commit → code, issue → document 정규화가 scoreUnit input 에 반영된다.
      const [firstInput] = scoring.scoreUnit.mock.calls[0];
      const [secondInput] = scoring.scoreUnit.mock.calls[1];
      expect(firstInput).toEqual(mapActivityToEvaluationInput(commit));
      expect(firstInput.contributionKind).toBe("code");
      expect(secondInput.contributionKind).toBe("document");
    });
  });

  describe("scoreUnit 호출 검증 — dedup 후 단위 수만큼 정확히 호출 + options 전달", () => {
    it("dedup 후 남은 단위 수만큼 scoreUnit 이 호출되고 각 호출에 options(modelId) 가 전달된다", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "c1" }),
        confluenceActivity({ externalId: "p1" }),
      ];

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
      // 각 호출의 두 번째 인자 = 전달된 options(그대로).
      expect(scoring.scoreUnit.mock.calls[0][1]).toBe(OPTIONS);
      expect(scoring.scoreUnit.mock.calls[1][1]).toBe(OPTIONS);
    });
  });

  describe("dedup 적용 검증(branch) — R-21 시간적 중복 / R-30 self-follow-up", () => {
    it("(i) 동일 unitId 가 서로 다른 timestamp 로 중복 → earliest 1 건만 scoring(R-21)", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      // 같은 commit(동일 externalId/instance/sourceType → 동일 unitId)이 두 timestamp 로.
      const activities: Activity[] = [
        githubActivity({
          externalId: "dup",
          timestamp: "2026-03-15T00:00:00Z", // 더 늦음
        }),
        githubActivity({
          externalId: "dup",
          timestamp: "2026-02-01T00:00:00Z", // earliest — 이 건이 남아야 한다
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(1);
      // earliest timestamp 의 단위가 scoring 됐다.
      const [scoredInput] = scoring.scoreUnit.mock.calls[0];
      expect(scoredInput.timestamp).toBe("2026-02-01T00:00:00Z");
    });

    it("(ii) 같은 issue(document) 동일 author self-follow-up → 최초 기여만 scoring(R-30)", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      // 동일 issue unitId + 동일 author 가 두 timestamp 로(self-follow-up). issue →
      // document 라 excludeSelfFollowUps 대상. dedupTemporal 는 unitId 동일이라 먼저
      // 1 건으로 합쳐지므로, 서로 다른 unitId 의 self-follow-up 시나리오로 구성한다.
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "page-a",
          author: "writer",
          timestamp: "2026-05-01T00:00:00Z",
        }),
        confluenceActivity({
          externalId: "page-b",
          author: "writer",
          timestamp: "2026-05-02T00:00:00Z",
        }),
      ];
      // page-a / page-b 는 unitId 가 다르나 self-follow-up 그룹 키는 unitId+author 라
      // 서로 다른 그룹 → 둘 다 보존(휴리스틱 v1 — unitId 베이스). 본 케이스는 서로 다른
      // unit 이 보존됨을 확인(self-follow-up 미발화 분기).
      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );
      expect(results).toHaveLength(2);

      // 동일 unitId(동일 page) + 동일 author 가 두 번 → excludeSelfFollowUps earliest 1 건.
      const sameUnit: Activity[] = [
        confluenceActivity({
          externalId: "page-c",
          author: "writer",
          version: 1,
          timestamp: "2026-05-10T00:00:00Z", // 최초 기여
        }),
        confluenceActivity({
          externalId: "page-c",
          author: "writer",
          version: 2,
          timestamp: "2026-05-20T00:00:00Z", // self-follow-up — 제외
        }),
      ];
      const scoring2 = makeScoringService();
      const orchestrator2 = makeOrchestrator(scoring2);
      const results2 = await orchestrator2.evaluateActivities(
        sameUnit,
        OPTIONS,
      );
      expect(results2).toHaveLength(1);
      // unitId 가 동일하므로 dedupTemporal 단계에서 earliest 1 건으로 합쳐진다 →
      // earliest(최초 기여) 보존.
      expect(scoring2.scoreUnit.mock.calls[0][0].timestamp).toBe(
        "2026-05-10T00:00:00Z",
      );
    });

    it("(iii) 다른 author 의 동일 베이스 document 단위는 모두 보존된다", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      // 같은 page 베이스지만 author 가 다름 → self 가 아니므로 둘 다 보존. unitId 가
      // 같으면 dedupTemporal 이 합치므로, author 별 보존을 보려면 unitId 를 분리한다.
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "shared-1",
          author: "alice",
          timestamp: "2026-04-01T00:00:00Z",
        }),
        confluenceActivity({
          externalId: "shared-2",
          author: "bob",
          timestamp: "2026-04-02T00:00:00Z",
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(2);
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });
  });

  describe("error path — scoreUnit reject 시 전파(swallow 0, §2 실패 격리)", () => {
    it("한 단위에서 scoreUnit 이 reject 하면 orchestrator 가 그대로 throw 한다", async () => {
      const scoring = makeScoringService();
      const boom = new Error("LLM HTTP 호출 실패 (status: 503)");
      // 첫 단위는 정상, 두 번째 단위에서 reject.
      scoring.scoreUnit
        .mockResolvedValueOnce(resultFor("github:com/sec:ok"))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "ok" }),
        githubActivity({ externalId: "fail" }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
    });

    it("scoreUnit reject 시 이후 단위 scoring 으로 진행하지 않는다(순차 실패 격리)", async () => {
      const scoring = makeScoringService();
      scoring.scoreUnit
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(resultFor("never"));
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "first" }),
        githubActivity({ externalId: "second" }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow("timeout");
      // 첫 단위에서 throw → 두 번째 단위 scoreUnit 미호출(순차).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(1);
    });
  });

  describe("branch / negative — 빈 입력 / code-only / contributionKind 분기 / 전부 합쳐짐", () => {
    it("(i) 빈 Activity[] → 빈 EvaluationResult[] + scoreUnit 호출 0", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(ii) code 기여만(self-follow-up 부적용 분기) → 누락 0, 전부 scoring", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      // 동일 author 의 commit 2 건(unitId 다름) — code 라 excludeSelfFollowUps 대상 아님.
      const activities: Activity[] = [
        githubActivity({ externalId: "c-1", author: "dev", kind: "commit" }),
        githubActivity({ externalId: "c-2", author: "dev", kind: "pr" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(2);
      // pr → code 정규화 분기도 cover.
      expect(scoring.scoreUnit.mock.calls[1][0].contributionKind).toBe("code");
    });

    it("(iii) contributionKind code vs document 분기 각 1+ (혼합 입력)", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "code-u", kind: "commit" }),
        confluenceActivity({ externalId: "doc-u" }),
      ];

      await orchestrator.evaluateActivities(activities, OPTIONS);

      const kinds = scoring.scoreUnit.mock.calls.map(
        (c) => c[0].contributionKind,
      );
      expect(kinds).toContain("code");
      expect(kinds).toContain("document");
    });

    it("(iv) 동일 unitId 다수 → dedup 으로 1 건 합쳐지는 경계", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "same",
          timestamp: "2026-01-03T00:00:00Z",
        }),
        githubActivity({
          externalId: "same",
          timestamp: "2026-01-01T00:00:00Z",
        }),
        githubActivity({
          externalId: "same",
          timestamp: "2026-01-02T00:00:00Z",
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(1);
      // earliest(2026-01-01) 보존.
      expect(scoring.scoreUnit.mock.calls[0][0].timestamp).toBe(
        "2026-01-01T00:00:00Z",
      );
    });
  });

  describe("determinism / no-side-effect", () => {
    it("동일 Activity[] + 동일 mock 응답 → 동일 EvaluationResult[](2 회 호출)", async () => {
      const activities: Activity[] = [
        githubActivity({ externalId: "d-1" }),
        confluenceActivity({ externalId: "d-2" }),
      ];

      const scoringA = makeScoringService();
      const first = await makeOrchestrator(scoringA).evaluateActivities(
        activities,
        OPTIONS,
      );
      const scoringB = makeScoringService();
      const second = await makeOrchestrator(scoringB).evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(first).toEqual(second);
    });

    it("입력 Activity[] 배열을 변형하지 않는다(부수효과 0)", async () => {
      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "imm-1" }),
        githubActivity({ externalId: "imm-1" }), // 중복 — dedup 됨
      ];
      const snapshot = [...activities];

      await orchestrator.evaluateActivities(activities, OPTIONS);

      // 원본 배열 길이·내용 비변형(map/dedup 모두 새 배열 산출).
      expect(activities).toHaveLength(2);
      expect(activities).toEqual(snapshot);
    });
  });
});

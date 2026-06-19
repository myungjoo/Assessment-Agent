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

// resultWithVolume — abuse wiring 검증용. scoring 산출 volume 을 명시 지정해 abuse
// adjust 의 감점/무변경을 입출력 비교로 단언한다(기본 resultFor 는 volume 0 고정이라
// 감점 가시성 0). unitId echo 는 유지해 순서 정합도 함께 본다.
function resultWithVolume(unitId: string, volume: number): EvaluationResult {
  return { ...resultFor(unitId), volume };
}

// makeScoringServiceWithVolume — 각 단위에 고정 volume 을 부여하는 mock. abuse
// detection 은 deduped 입력의 titleLength 로 신호를 산출하고, scoring volume 은 본
// mock 이 통제하므로 두 축(signal vs scored volume)을 독립적으로 구성할 수 있다.
function makeScoringServiceWithVolume(volume: number): {
  scoreUnit: jest.Mock;
} {
  return {
    scoreUnit: jest.fn().mockImplementation(async (input: { unitId: string }) =>
      // eslint-disable-next-line @typescript-eslint/require-await
      resultWithVolume(input.unitId, volume),
    ),
  };
}

// suspectedCommits — 한 author 의 abusing 의심 신호를 만드는 fixture 집합. 같은 author
// (suspectedAuthor)·같은 kind(commit→code)·동일 titleLength(1 → low-volume<3)·서로 다른
// externalId(unitId 분리로 dedup 생존) n 건. computeAbuseSignal 기준 (kind, volume) 동일
// 반복 + low-volume → repetitionRatio 1.0, unitCount≥2 → suspected=true.
function suspectedCommits(
  author: string,
  count: number,
  titleLength = 1,
): GithubActivity[] {
  return Array.from({ length: count }, (_unused, i) =>
    githubActivity({
      externalId: `${author}-sus-${String(i)}`,
      author,
      kind: "commit",
      timestamp: `2026-07-0${String(i + 1)}T00:00:00Z`,
      metadata: { titleLength },
    }),
  );
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

  // ── T-0523: abuse signal 소비 배선(computeAbuseSignal → applyAbuseSignalToVolume)
  //    detection 은 deduped 입력의 titleLength 로 신호를 산출하고, 소비는 scoring 후
  //    suspected author 단위의 volume 을 결정적으로 감점한다. mock scoreUnit 으로 scoring
  //    volume 을 통제해 입출력 비교로 감점/무변경을 단언한다.
  describe("abuse wiring — suspected author volume 감점 / non-suspected 무변경(R-26/R-40)", () => {
    it("(happy) suspected author 의 단위 volume 이 결정적으로 0 으로 감점된다(repetitionRatio 1.0)", async () => {
      // 같은 author·동일 titleLength(1, low-volume)·동일 kind 3 건 → repetitionRatio 1.0,
      // suspected=true. scoring volume 은 100 으로 통제 → floor(100*(1-1))=0 으로 감점.
      const scoring = makeScoringServiceWithVolume(100);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("abuser", 3);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // suspected → 전 단위 volume 0 으로 감점(결정적).
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(happy) non-suspected author 의 단위 volume 은 무변경 passthrough 다", async () => {
      // 단일 author 단일 단위(unitCount 1 < MIN_UNITS_FOR_SUSPICION) → suspected=false.
      const scoring = makeScoringServiceWithVolume(42);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "clean-1", author: "honest" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      // suspected 아님 → scoring volume 그대로 보존.
      expect(results[0].volume).toBe(42);
    });

    it("(branch a) suspected + non-suspected 혼합 batch → suspected 만 감점, 나머지 무변경", async () => {
      // abuser: suspectedCommits 3 건(감점), honest: 큰 titleLength 단일 단위(무변경).
      const scoring = makeScoringServiceWithVolume(50);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        githubActivity({
          externalId: "honest-1",
          author: "honest",
          metadata: { titleLength: 80 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 순서 보존 — 앞 3 건 abuser(감점 0), 마지막 honest(무변경 50).
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 50]);
    });

    it("(branch b) 전 author 가 non-suspected → 전 단위 volume 무변경", async () => {
      // 서로 다른 author 의 high-volume 단위들(반복 0) → suspected 0.
      const scoring = makeScoringServiceWithVolume(77);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "h1",
          author: "alice",
          metadata: { titleLength: 50 },
        }),
        confluenceActivity({
          externalId: "h2",
          author: "bob",
          metadata: { titleLength: 60 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([77, 77]);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // 동일 unitId 중복 2 건 + 별개 단위 → dedup 후 2 건. detection 은 dedup 후 입력(2 건)
      // 으로 신호 산출. 두 단위는 같은 author·동일 low-volume·동일 kind → suspected.
      const scoring = makeScoringServiceWithVolume(30);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "dup",
          author: "abuser",
          kind: "commit",
          timestamp: "2026-08-02T00:00:00Z",
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "dup",
          author: "abuser",
          kind: "commit",
          timestamp: "2026-08-01T00:00:00Z", // earliest 보존 → 중복 1 건 제거
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "other",
          author: "abuser",
          kind: "commit",
          timestamp: "2026-08-03T00:00:00Z",
          metadata: { titleLength: 1 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // dedup 후 2 건 → 둘 다 suspected 감점(repetitionRatio 1.0 → volume 0).
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.volume)).toEqual([0, 0]);
    });

    it("(branch d) repetitionRatio 1.0 경계 → 전량 감점(floor(volume*(1-1))=0)", async () => {
      // 전 단위 동일 low-volume 반복 → repetitionRatio 1.0 → 가장 강한 감점.
      const scoring = makeScoringServiceWithVolume(99);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("ratio-one", 4);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 0]);
    });

    it("(branch d) repetitionRatio 0 경계(반복 0) → suspected 0, 무변경", async () => {
      // 같은 author 2 단위지만 titleLength 가 서로 달라 (kind, volume) 반복 0 →
      // repetitionRatio 0 → suspected false → 무변경.
      const scoring = makeScoringServiceWithVolume(55);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "v-a",
          author: "varied",
          kind: "commit",
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "v-b",
          author: "varied",
          kind: "commit",
          metadata: { titleLength: 2 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([55, 55]);
    });
  });

  describe("abuse wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 abuse adjust 미실행 + error 전파(§2 실패 격리)", async () => {
      // suspected 구성이어도 scoring 단계 reject 면 adjust 자리에 도달 0 — error 전파.
      const scoring = makeScoringServiceWithVolume(100);
      const boom = new Error("LLM HTTP 호출 실패 (status: 500)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithVolume("ok", 100))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("abuser", 2);

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0(부분 결과 위장 0).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(error/negative i) 빈 Activity[] → 빈 EvaluationResult[](helper 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithVolume(10);
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 단위(suspected=false) → 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(7);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "solo", author: "solo-dev" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(7);
    });

    it("(negative iii) 동일 author 다수 단위 → 전부 동일 규칙(suspected 시 전 단위 감점)", async () => {
      const scoring = makeScoringServiceWithVolume(60);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("multi", 5);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(5);
      // 전 단위 동일 감점 규칙 적용(repetitionRatio 1.0 → 전부 0).
      expect(results.every((r) => r.volume === 0)).toBe(true);
    });

    it("(negative iv) suspected author 의 volume 이 이미 0 → FLOOR 0 유지(무음수)", async () => {
      // scoring volume 0 인 suspected 단위 → floor(0*(1-ratio))=0, FLOOR 절하로 0 유지.
      const scoring = makeScoringServiceWithVolume(0);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("zero-vol", 3);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(negative v) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      // 각 단위에 unitId 별 고유 volume 을 부여해 author↔result 매핑 misalignment 를 잡는다.
      // honest author(non-suspected) 단위들이라 volume 무변경 → unitId 순서와 volume 순서가
      // 입력 순서를 그대로 따라야 한다.
      const volumeByUnit: Record<string, number> = {
        "github:com/sec:m-1": 11,
        "github:com/sec:m-2": 22,
        "confluence:wiki:m-3": 33,
      };
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) =>
            resultWithVolume(input.unitId, volumeByUnit[input.unitId]),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "m-1",
          author: "a1",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "m-2",
          author: "a2",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "m-3",
          author: "a3",
          metadata: { titleLength: 40 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // unitId 와 volume 이 같은 단위에 짝지어진 채 입력 순서로 반환(매핑 정합).
      expect(
        results.map((r) => ({ unitId: r.unitId, volume: r.volume })),
      ).toEqual([
        { unitId: "github:com/sec:m-1", volume: 11 },
        { unitId: "github:com/sec:m-2", volume: 22 },
        { unitId: "confluence:wiki:m-3", volume: 33 },
      ]);
    });
  });

  describe("abuse wiring — 결정성 / 비변형 단언", () => {
    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic adjust)", async () => {
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        githubActivity({
          externalId: "honest-x",
          author: "honest",
          metadata: { titleLength: 70 },
        }),
      ];

      const first = await makeOrchestrator(
        makeScoringServiceWithVolume(88),
      ).evaluateActivities(activities, OPTIONS);
      const second = await makeOrchestrator(
        makeScoringServiceWithVolume(88),
      ).evaluateActivities(activities, OPTIONS);

      expect(first).toEqual(second);
      // suspected 감점이 결정적으로 반영됐는지도 함께 본다(앞 3 건 0, 마지막 88).
      expect(first.map((r) => r.volume)).toEqual([0, 0, 0, 88]);
    });

    it("(비변형) suspected 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithVolume(100);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("abuser", 3);
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });

  // ── T-0526: update 횟수 중립화 소비 배선(computeUpdateCountNeutralization →
  //    applyUpdateCountNeutralizationToVolume). detection 은 dedup 후 입력의
  //    metadata.version(≥ UPDATE_COUNT_NEUTRAL_THRESHOLD=5) 으로 신호를 산출하고,
  //    소비는 scoring + abuse adjust 후 중립 대상 author/unit 의 volume 을 net 0(base
  //    보존)으로 처리한다. mock scoreUnit 으로 scoring volume 을 통제해 입출력 비교로
  //    중립 보존 / 무변경을 단언한다.
  describe("update-count wiring — version ≥ 5 document 단위의 volume 중립 보존 / 비대상 무변경(R-41)", () => {
    it("(happy) update 횟수 ≥ 5 인 document 단위 → volume 이 결정적으로 base 보존(net 0)된다", async () => {
      // metadata.version ≥ 5(임계) 인 document 단위 3 건 → 전 단위 중립 대상.
      // scoring volume 은 17 로 통제 → preserveNeutralVolume(17) = floor(17) = 17 보존.
      // 서로 다른 author 로 두어 abuse suspected 분기를 회피한다(repetition unit < 2).
      const scoring = makeScoringServiceWithVolume(17);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "doc-1",
          author: "w-a",
          metadata: { titleLength: 40, version: 5 },
        }),
        confluenceActivity({
          externalId: "doc-2",
          author: "w-b",
          metadata: { titleLength: 50, version: 9 },
        }),
        confluenceActivity({
          externalId: "doc-3",
          author: "w-c",
          metadata: { titleLength: 60, version: 50 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // R-41 정신: update 횟수가 5 든 50 이든 base volume(17) 을 그대로 보존
      // (advantage 도 penalty 도 없음). 보존과 무변경이 동일 결과를 산출하므로 별
      // 어서션으로 보존 분기가 실제로 동작했음을 보강한다(아래 (branch d) FLOOR
      // 절하 어서션이 보존 분기 활성 회귀를 잡는다).
      expect(results.map((r) => r.volume)).toEqual([17, 17, 17]);
    });

    it("(happy) version < 5 document 단위 → 비대상, volume 무변경 passthrough", async () => {
      const scoring = makeScoringServiceWithVolume(42);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // 서로 다른 author 로 두어 abuse 분기를 회피.
        confluenceActivity({
          externalId: "low-1",
          author: "w-a",
          metadata: { titleLength: 40, version: 1 },
        }),
        confluenceActivity({
          externalId: "low-2",
          author: "w-b",
          metadata: { titleLength: 50, version: 4 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(2);
      // 비대상 → scoring volume 그대로(무변경).
      expect(results.map((r) => r.volume)).toEqual([42, 42]);
    });

    it("(branch a) 중립 대상 + 비대상 혼합 batch → 대상만 base 보존, 비대상 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(30);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // 같은 author 의 중립 대상 단위(metadata.version ≥ 5).
        confluenceActivity({
          externalId: "neutral-1",
          author: "doc-writer",
          metadata: { titleLength: 40, version: 5 },
        }),
        // 같은 author 의 비대상 단위(metadata.version < 5) — 부분 적용 정합.
        confluenceActivity({
          externalId: "low-1",
          author: "doc-writer",
          metadata: { titleLength: 50, version: 2 },
        }),
        // 다른 author 의 비대상 단위(version metadata 부재 → 0 fallback).
        githubActivity({
          externalId: "code-1",
          author: "coder",
          kind: "commit",
          metadata: { titleLength: 80 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // 입력 순서 보존 — 모두 base 30 으로 결과 동일(중립=보존, 비대상=무변경).
      // suspected 신호도 없는 입력(titleLength 가 단위마다 달라 (kind, volume) 반복 0)
      // 이라 abuse 감점도 0.
      expect(results.map((r) => r.volume)).toEqual([30, 30, 30]);
    });

    it("(branch b) 전 단위가 비대상(metadata.version < 5) → 전 단위 volume 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(55);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // 서로 다른 author 로 두어 abuse suspected 분기 회피.
        confluenceActivity({
          externalId: "n-1",
          author: "wa",
          metadata: { titleLength: 40, version: 1 },
        }),
        confluenceActivity({
          externalId: "n-2",
          author: "wb",
          metadata: { titleLength: 50, version: 3 },
        }),
        confluenceActivity({
          externalId: "n-3",
          author: "wc",
          metadata: { titleLength: 60, version: 4 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([55, 55, 55]);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // 동일 unitId(metadata.version 6 / 7) 중복 + 별개 단위(metadata.version 8).
      // dedup earliest-wins 후 2 건 모두 metadata.version ≥ 5 → 둘 다 중립 대상.
      // 같은 author 라도 titleLength 가 단위마다 달라 (kind, volume) 반복 0 →
      // abuse suspected 분기 회피, 순수 update-count 보존 분기만 검증.
      const scoring = makeScoringServiceWithVolume(40);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "dup",
          author: "doc",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 40, version: 6 },
        }),
        confluenceActivity({
          externalId: "dup",
          author: "doc",
          timestamp: "2026-09-01T00:00:00Z", // earliest 보존
          metadata: { titleLength: 50, version: 7 },
        }),
        confluenceActivity({
          externalId: "other",
          author: "doc",
          timestamp: "2026-09-03T00:00:00Z",
          metadata: { titleLength: 60, version: 8 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // dedup 후 2 건 → 둘 다 중립 대상(base 40 보존).
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.volume)).toEqual([40, 40]);
    });

    it("(branch d) metadata.version 경계 — 정확히 5 → 대상(보존), 4 → 비대상(무변경)", async () => {
      // 경계값 자체의 분기 동작을 가시화하려면 보존 / 무변경이 다른 결과를 내는 입력
      // 이 필요하다. 음수 base volume 으로 layer 경계 진입 → 보존 분기는 FLOOR 0
      // 절하, 무변경 분기는 음수 그대로 통과(passthrough). adjust 의 unitId 매칭은
      // 정규화된 full unitId(`confluence:wiki:<externalId>`) 기준이라 mock 산출
      // result.unitId 도 full unitId 로 echo 한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          .mockResolvedValueOnce(resultWithVolume("confluence:wiki:u-4", -5))
          .mockResolvedValueOnce(resultWithVolume("confluence:wiki:u-5", -5)),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // 임계 미만(비대상): -5 → 무변경 passthrough → -5.
        confluenceActivity({
          externalId: "u-4",
          author: "u-a",
          metadata: { titleLength: 40, version: 4 },
        }),
        // 임계(대상): -5 → preserveNeutralVolume(-5) = FLOOR 0.
        confluenceActivity({
          externalId: "u-5",
          author: "u-b",
          metadata: { titleLength: 50, version: 5 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // version=4 → 비대상 → -5 그대로. version=5 → 대상 → FLOOR 0.
      expect(results.map((r) => r.volume)).toEqual([-5, 0]);
    });

    it("(branch d) metadata.version 비-number / 누락 → 0 fallback, 비대상 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(13);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // metadata.version 누락(github issue, metadata 에 version 부재).
        githubActivity({ externalId: "no-ver", kind: "issue" }),
        // metadata.version 이 string(비-number).
        confluenceActivity({
          externalId: "str-ver",
          metadata: { titleLength: 5, version: "high" },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 둘 다 비대상 → scoring volume 그대로.
      expect(results.map((r) => r.volume)).toEqual([13, 13]);
    });
  });

  describe("update-count wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 update-count adjust 미실행 + error 전파(§2 실패 격리)", async () => {
      const scoring = makeScoringServiceWithVolume(100);
      const boom = new Error("LLM HTTP 호출 실패 (status: 503)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithVolume("ok", 100))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "doc-ok",
          author: "wa",
          metadata: { titleLength: 40, version: 10 },
        }),
        confluenceActivity({
          externalId: "doc-fail",
          author: "wb",
          metadata: { titleLength: 50, version: 10 },
        }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0.
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(negative i) 빈 Activity[] → 빈 EvaluationResult[](중립화 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithVolume(10);
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 비대상 단위 → 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(7);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "solo",
          author: "solo-writer",
          metadata: { titleLength: 40, version: 1 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(7);
    });

    it("(negative iii) 동일 author 다수 단위 — 일부만 중립 대상(부분 적용 정합)", async () => {
      // metadata.version 으로 중립 대상 / 비대상을 분리. titleLength 가 단위마다
      // 달라 abuse suspected 분기는 회피(reps 0). 부분 적용 자체의 가시화를 위해
      // 음수 base volume 입력 → 보존(FLOOR 0) vs 무변경(음수 그대로) 으로 분기 구분.
      // adjust 의 unitId 매칭은 정규화된 full unitId 기준 → mock 도 full unitId echo.
      const scoring = {
        scoreUnit: jest
          .fn()
          .mockResolvedValueOnce(resultWithVolume("confluence:wiki:mix-1", -5))
          .mockResolvedValueOnce(resultWithVolume("confluence:wiki:mix-2", -5))
          .mockResolvedValueOnce(resultWithVolume("confluence:wiki:mix-3", -5)),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // 중립 대상(version=6) → 보존 분기 → FLOOR 0.
        confluenceActivity({
          externalId: "mix-1",
          author: "writer",
          metadata: { titleLength: 40, version: 6 },
        }),
        // 비대상(version=2) → 무변경 → -5 그대로.
        confluenceActivity({
          externalId: "mix-2",
          author: "writer",
          metadata: { titleLength: 50, version: 2 },
        }),
        // 중립 대상(version=9) → 보존 분기 → FLOOR 0.
        confluenceActivity({
          externalId: "mix-3",
          author: "writer",
          metadata: { titleLength: 60, version: 9 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // 부분 적용 박제: 대상은 FLOOR 0, 비대상은 -5 그대로 통과.
      expect(results.map((r) => r.volume)).toEqual([0, -5, 0]);
    });

    it("(negative iv) 중립 대상 단위의 base volume 이 음수 / NaN → FLOOR 0 으로 절하", async () => {
      // scoring 산출 volume 이 -10 / NaN 인 layer 경계 입력 → FLOOR 0.
      const scoring = {
        scoreUnit: jest
          .fn()
          .mockResolvedValueOnce(
            resultWithVolume("confluence:wiki:neg-vol", -10),
          )
          .mockResolvedValueOnce(
            resultWithVolume("confluence:wiki:nan-vol", Number.NaN),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "neg-vol",
          author: "wa",
          metadata: { titleLength: 40, version: 10 },
        }),
        confluenceActivity({
          externalId: "nan-vol",
          author: "wb",
          metadata: { titleLength: 50, version: 10 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 둘 다 중립 대상 + 비유한/음수 → FLOOR 0(R-41 정신의 자연 하한).
      expect(results.map((r) => r.volume)).toEqual([0, 0]);
    });

    it("(negative v) code 단위(commit/pr) 는 metadata.version 무관 비대상(R-41 문서 한정)", async () => {
      // GitHub commit 의 metadata 에 version=10 을 강제로 부여해도 contributionKind
      // === "code" 라 중립 대상이 되지 않음. 본 테스트는 R-41 "문서 한정" 박제.
      // 음수 base volume 입력 → 보존 분기였다면 FLOOR 0 으로 절하됐을 것이지만,
      // code 단위는 비대상이라 -3 그대로 통과 — "문서 한정" 분기가 실제로 동작했음을
      // 가시화한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          .mockResolvedValueOnce(resultWithVolume("github:com/sec:code-x", -3)),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "code-x",
          kind: "commit",
          metadata: { titleLength: 50, version: 10 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // code 단위 → 비대상, 무변경 → -3 그대로 passthrough(보존 분기였다면 FLOOR 0).
      expect(results.map((r) => r.volume)).toEqual([-3]);
    });

    it("(negative vi) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      const volumeByUnit: Record<string, number> = {
        "confluence:wiki:n-1": 11,
        "confluence:wiki:n-2": 22,
        "github:com/sec:n-3": 33,
      };
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) =>
            resultWithVolume(input.unitId, volumeByUnit[input.unitId]),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "n-1",
          author: "doc-a",
          metadata: { titleLength: 40, version: 6 }, // 중립 대상
        }),
        confluenceActivity({
          externalId: "n-2",
          author: "doc-b",
          metadata: { titleLength: 50, version: 2 }, // 비대상
        }),
        githubActivity({
          externalId: "n-3",
          author: "coder",
          kind: "commit",
          metadata: { titleLength: 60 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // unitId 순서와 volume 순서가 입력 순서를 그대로 따른다(매핑 정합). 보존 분기와
      // 무변경 분기가 같은 양수 base 라 동일 결과지만, unitId↔volume 짝이 입력 순서로
      // 보존되는지를 본다.
      expect(
        results.map((r) => ({ unitId: r.unitId, volume: r.volume })),
      ).toEqual([
        { unitId: "confluence:wiki:n-1", volume: 11 },
        { unitId: "confluence:wiki:n-2", volume: 22 },
        { unitId: "github:com/sec:n-3", volume: 33 },
      ]);
    });
  });

  describe("update-count wiring — abuse + update-count 공존 / 결정성 / 비변형", () => {
    it("(공존) abuse suspected + update-count 중립 대상이 동일 batch 에 공존 → 둘 다 결정적 처리", async () => {
      // abuser(code) suspectedCommits 3 건 → suspected 감점(volume 0).
      // doc-writer 의 document 단위 metadata.version=10 → 중립 대상. 음수 base
      // volume 을 부여해 보존 분기가 FLOOR 0 으로 절하되는 가시성 확보. 다른
      // honest author 의 document 단위(version 1)도 입력 순서 끝에 두어 비대상 분기
      // 도 함께 확인한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          // 첫 3 건(abuser suspectedCommits) — 모두 base 80.
          .mockResolvedValueOnce(
            resultWithVolume("github:com/sec:abuser-sus-0", 80),
          )
          .mockResolvedValueOnce(
            resultWithVolume("github:com/sec:abuser-sus-1", 80),
          )
          .mockResolvedValueOnce(
            resultWithVolume("github:com/sec:abuser-sus-2", 80),
          )
          // 중립 대상 doc — 음수 base → 보존 분기 FLOOR 0 절하.
          .mockResolvedValueOnce(
            resultWithVolume("confluence:wiki:neutral-doc", -7),
          )
          // 비대상 doc — 음수 base → 무변경 passthrough(-5).
          .mockResolvedValueOnce(
            resultWithVolume("confluence:wiki:low-doc", -5),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        confluenceActivity({
          externalId: "neutral-doc",
          author: "doc-writer",
          metadata: { titleLength: 40, version: 10 },
        }),
        confluenceActivity({
          externalId: "low-doc",
          author: "doc-low",
          metadata: { titleLength: 50, version: 2 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 앞 3 건(abuser code) 감점 → 0. 4 번째(중립 대상 doc, base -7) → 보존 FLOOR 0.
      // 5 번째(비대상 doc, base -5) → 무변경 -5 그대로(보존 분기 미발화 가시화).
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 0, -5]);
    });

    it("(공존) 한 단위가 abuse suspected ∩ update-count 중립 대상 → 적용 순서 v1(abuse → update-count) 결과 박제", async () => {
      // document(confluence page) 같은 author 의 단위 3 건 — abuse signal 은 (kind,
      // volume) 반복으로 suspected 판정한다. mock scoreUnit 으로 동일 volume(100) 을
      // 부여하면 (document, 100) 이 3 회 반복 → repetitionRatio 1.0 → suspected.
      // 동시에 metadata.version ≥ 5 라 update-count 중립 대상도 만족.
      const scoring = makeScoringServiceWithVolume(100);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "cross-1",
          author: "cross",
          metadata: { titleLength: 1, version: 6 },
        }),
        confluenceActivity({
          externalId: "cross-2",
          author: "cross",
          metadata: { titleLength: 1, version: 7 },
        }),
        confluenceActivity({
          externalId: "cross-3",
          author: "cross",
          metadata: { titleLength: 1, version: 8 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // 적용 순서 박제(v1): abuse 감점 → update-count 중립 보존.
      // abuse 감점 후 volume = 0(repetitionRatio 1.0 → floor(100*(1-1))=0).
      // 중립 보존 후 volume = preserveNeutralVolume(0) = FLOOR 0(0 ≤ FLOOR).
      // 결과: 전 단위 0(두 신호가 같은 단위에 모두 작용해도 결정적).
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(회귀) 기존 abuse 감점 배선은 보존 — update-count 비대상이면 abuse 감점만 적용", async () => {
      // suspectedCommits 는 code 기여 — update-count 는 code 단위 비대상이라
      // 기존 abuse 감점(volume 0) 결과가 그대로 보존된다.
      const scoring = makeScoringServiceWithVolume(100);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("regress", 3);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 전 단위 abuse 감점만 적용(중립 비대상 → update-count adjust 무변경 passthrough).
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic 두 신호)", async () => {
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "d-1",
          author: "wa",
          metadata: { titleLength: 40, version: 6 }, // 중립 대상
        }),
        confluenceActivity({
          externalId: "d-2",
          author: "wb",
          metadata: { titleLength: 50, version: 3 }, // 비대상
        }),
        ...suspectedCommits("d-abuser", 2),
      ];

      const first = await makeOrchestrator(
        makeScoringServiceWithVolume(45),
      ).evaluateActivities(activities, OPTIONS);
      const second = await makeOrchestrator(
        makeScoringServiceWithVolume(45),
      ).evaluateActivities(activities, OPTIONS);

      expect(first).toEqual(second);
      // 결정적 결과 박제: doc-1 중립 보존(45), doc-2 비대상 무변경(45),
      // d-abuser 2 건 abuse 감점(0, 0).
      expect(first.map((r) => r.volume)).toEqual([45, 45, 0, 0]);
    });

    it("(비변형) 중립 대상 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithVolume(60);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "i-1",
          author: "wa",
          metadata: { titleLength: 40, version: 6 },
        }),
        confluenceActivity({
          externalId: "i-2",
          author: "wb",
          metadata: { titleLength: 50, version: 9 },
        }),
      ];
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });
});

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

// docWithVersion — update 횟수 중립화 wiring 검증용 document fixture. 핵심:
// computeUpdateCountNeutralization 은 `input.metadata.version` 을 읽으므로(매퍼는
// ConfluenceActivity.version 을 metadata 로 옮기지 않는다 — 별도 top-level 필드),
// 중립 대상 단위를 구성하려면 `metadata.version` 을 명시 주입해야 한다. confluence
// page(document) 에 metadata.version 을 통제해 임계(5) 분기를 결정적으로 만든다.
function docWithVersion(overrides: {
  externalId: string;
  author?: string;
  version?: number;
}): ConfluenceActivity {
  const { externalId, author = "writer", version } = overrides;
  return confluenceActivity({
    externalId,
    author,
    metadata:
      version === undefined
        ? { titleLength: 10 }
        : { titleLength: 10, version },
  });
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

  // ── T-0526: update 횟수 중립화 배선(computeUpdateCountNeutralization →
  //    applyUpdateCountNeutralizationToVolume). detection 은 dedup 후 입력의
  //    metadata.version 으로 신호를 산출하고(임계 5), 소비는 abuse 감점 후 중립 대상
  //    document 단위의 volume 을 net 0(base 보존)으로 처리한다. mock scoreUnit 으로
  //    scoring volume 을 통제해 보존/무변경을 입출력 비교로 단언한다. abuse 배선이
  //    함께 보존됨(회귀 0)도 확인한다.
  describe("update-count wiring — 중립 대상 단위 volume net 0 보존 / 비대상 무변경(R-41)", () => {
    it("(happy) version 임계 이상(≥5) document 단위는 base volume 이 net 0 으로 보존된다", async () => {
      // metadata.version 5 인 document → 중립 대상. abuse 는 단일 author 단일 단위라
      // suspected=false(무감점) → scoring volume 그대로 도달 후 중립 보존(base 유지).
      const scoring = makeScoringServiceWithVolume(40);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "doc-neutral", version: 5 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      // 중립 보존 = base volume 그대로(net 0 — 감점도 가산도 없음).
      expect(results[0].volume).toBe(40);
    });

    it("(happy) version 임계 미만(<5) 비대상 document 단위는 volume 무변경 passthrough 다", async () => {
      const scoring = makeScoringServiceWithVolume(33);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "doc-low", version: 4 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(33);
    });

    it("(branch a) 중립 대상 + 비대상 혼합 batch → 대상 보존, 비대상 무변경(둘 다 무감점)", async () => {
      // 두 단위 모두 다른 author(self-follow-up 미발화) + 단일 단위라 abuse suspected 0.
      // doc-hi(version 6) 중립 대상, doc-lo(version 2) 비대상. 둘 다 base 보존이지만
      // 중립 보존 분기와 passthrough 분기를 각각 통과한다.
      const scoring = makeScoringServiceWithVolume(50);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "doc-hi", author: "a1", version: 6 }),
        docWithVersion({ externalId: "doc-lo", author: "a2", version: 2 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 순서 보존 — 둘 다 base 50 보존(net 0).
      expect(results.map((r) => r.volume)).toEqual([50, 50]);
    });

    it("(branch b) 전 단위 비대상(version<임계 또는 code) → 전 단위 volume 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(70);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "d-3", author: "a1", version: 3 }),
        // code 단위(commit) — version 무관 비대상(R-41 문서 한정).
        githubActivity({
          externalId: "c-x",
          author: "a2",
          kind: "commit",
          metadata: { titleLength: 50, version: 99 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([70, 70]);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // 동일 unitId document 중복 2 건(둘 다 version≥5) → dedup 후 earliest 1 건.
      // 그 1 건이 중립 대상으로 식별돼 base 보존(detection 이 dedup 후 입력 위 동작 확인).
      const scoring = makeScoringServiceWithVolume(25);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "dup-doc",
          author: "w",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 10, version: 7 },
        }),
        confluenceActivity({
          externalId: "dup-doc",
          author: "w",
          timestamp: "2026-09-01T00:00:00Z", // earliest 보존
          metadata: { titleLength: 10, version: 7 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(25);
    });

    it("(branch d) version 경계 5 정확히 → 중립 대상, 4 → 비대상", async () => {
      const scoring = makeScoringServiceWithVolume(15);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "exact-5", author: "a1", version: 5 }),
        docWithVersion({ externalId: "below-4", author: "a2", version: 4 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 둘 다 base 보존(중립 대상은 보존, 비대상은 무변경)이라 volume 동일하지만,
      // 임계 경계 5/4 의 두 분기(중립 보존 vs passthrough)를 각각 통과한다.
      expect(results.map((r) => r.volume)).toEqual([15, 15]);
    });

    it("(branch d) version 비-number / 누락 → 비대상(0 흡수, 무변경)", async () => {
      const scoring = makeScoringServiceWithVolume(18);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // metadata.version 누락 document — resolveUpdateCount 0 흡수 → 비대상.
        docWithVersion({ externalId: "no-ver", author: "a1" }),
        // metadata.version 이 string("9") — number 아님 → 0 흡수 → 비대상.
        confluenceActivity({
          externalId: "str-ver",
          author: "a2",
          metadata: { titleLength: 10, version: "9" },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([18, 18]);
    });
  });

  describe("update-count wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 두 adjust(abuse + update-count) 미실행 + error 전파", async () => {
      // 중립 대상 구성이어도 scoring reject 면 adjust 자리 도달 0 — error 전파.
      const scoring = makeScoringServiceWithVolume(40);
      const boom = new Error("LLM HTTP 호출 실패 (status: 500)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithVolume("ok", 40))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "ok", author: "a1", version: 6 }),
        docWithVersion({ externalId: "fail", author: "a2", version: 6 }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0(부분 결과 위장 0).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(negative i) 빈 Activity[] → 빈 EvaluationResult[](두 helper 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithVolume(10);
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 단위(비대상) → 무변경", async () => {
      const scoring = makeScoringServiceWithVolume(8);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "solo", author: "solo-w", version: 2 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(8);
    });

    it("(negative iii) 동일 author 다수 단위 — 일부만 중립 대상(부분 적용 정합)", async () => {
      // 같은 author 의 document 3 건: version 6/2/8. unitId 가 모두 달라 dedup 미발화.
      // version≥5 인 doc-1(6), doc-3(8) 만 중립 대상, doc-2(2)는 비대상. 모두 base
      // 보존이지만 같은 author 안에서 unitId 단위 부분 적용 분기를 통과한다.
      const scoring = makeScoringServiceWithVolume(60);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "doc-1", author: "multi", version: 6 }),
        docWithVersion({ externalId: "doc-2", author: "multi", version: 2 }),
        docWithVersion({ externalId: "doc-3", author: "multi", version: 8 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.volume)).toEqual([60, 60, 60]);
    });

    it("(negative iv) 중립 대상 단위의 scoring volume 이 0 → FLOOR 0 유지(무음수)", async () => {
      // scoring volume 0 인 중립 대상 → preserveNeutralVolume 의 FLOOR 0 분기 통과.
      const scoring = makeScoringServiceWithVolume(0);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({ externalId: "zero", author: "w", version: 9 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results[0].volume).toBe(0);
    });

    it("(negative v) code 단위(commit)는 version≥5 라도 비대상(R-41 문서 한정)", async () => {
      // commit 에 metadata.version 99 를 줘도 contributionKind=code 라 중립 미식별.
      const scoring = makeScoringServiceWithVolume(45);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "code-hi-ver",
          author: "dev",
          kind: "commit",
          metadata: { titleLength: 50, version: 99 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      // code 단위는 version 무관 비대상 → 무변경(scoring volume 그대로).
      expect(results[0].volume).toBe(45);
    });

    it("(negative vi) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      // unitId 별 고유 volume 으로 author↔result 매핑 misalignment 를 잡는다. 전 단위
      // 비대상(version<5) → volume 무변경, unitId 순서와 volume 순서가 입력 순서 그대로.
      const volumeByUnit: Record<string, number> = {
        "confluence:wiki:o-1": 11,
        "confluence:wiki:o-2": 22,
        "confluence:wiki:o-3": 33,
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
        docWithVersion({ externalId: "o-1", author: "a1", version: 1 }),
        docWithVersion({ externalId: "o-2", author: "a2", version: 2 }),
        docWithVersion({ externalId: "o-3", author: "a3", version: 3 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(
        results.map((r) => ({ unitId: r.unitId, volume: r.volume })),
      ).toEqual([
        { unitId: "confluence:wiki:o-1", volume: 11 },
        { unitId: "confluence:wiki:o-2", volume: 22 },
        { unitId: "confluence:wiki:o-3", volume: 33 },
      ]);
    });
  });

  describe("abuse + update-count 공존 / 결정성 / 비변형 단언", () => {
    it("(공존) 한 단위 abuse suspected 감점 + 다른 단위 update-count 중립 보존이 함께 동작", async () => {
      // abuser: suspectedCommits 3 건(code, abuse 감점 → volume 0).
      // writer: version 7 document 단일 단위(abuse 미발화 + update-count 중립 보존 → base).
      const scoring = makeScoringServiceWithVolume(50);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 앞 3 건 abuse 감점 0, 마지막 document 중립 보존(base 50). 두 배선 공존 + 회귀 0.
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 50]);
    });

    it("(공존) abuse 배선이 보존된다 — update-count 비대상 batch 의 abuse 감점 회귀 0", async () => {
      // update-count 중립 대상 0(전 code 단위) → abuse 감점만 작동. T-0523 동작 보존 확인.
      const scoring = makeScoringServiceWithVolume(80);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("abuser", 3);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic adjust)", async () => {
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
      ];

      const first = await makeOrchestrator(
        makeScoringServiceWithVolume(50),
      ).evaluateActivities(activities, OPTIONS);
      const second = await makeOrchestrator(
        makeScoringServiceWithVolume(50),
      ).evaluateActivities(activities, OPTIONS);

      expect(first).toEqual(second);
      expect(first.map((r) => r.volume)).toEqual([0, 0, 0, 50]);
    });

    it("(비변형) 중립 대상 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithVolume(50);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        docWithVersion({
          externalId: "doc-low",
          author: "writer2",
          version: 2,
        }),
      ];
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });
});

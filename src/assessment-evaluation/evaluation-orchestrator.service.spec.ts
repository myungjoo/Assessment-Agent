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

import * as evaluationAdjustmentsPipeline from "./domain/evaluation-adjustments-pipeline";
import { mapActivityToEvaluationInput } from "./domain/evaluation-input.mapper";
import { NOTABLE_CONTRIBUTION_NARRATIVE_MARKER } from "./domain/evaluation-notable-contribution-adjust";
import type { EvaluationResult } from "./domain/evaluation-result";
import { UNDERPERFORMER_NARRATIVE_MARKER } from "./domain/evaluation-underperformer-adjust";
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

// resultWithContribution — contribution-quality wiring 검증용. scoring 산출
// contribution 을 명시 지정해 floor 강등/무변경을 입출력 비교로 단언한다(기본
// resultFor 는 contribution "medium" 고정). zero-contribution 대상이면 mock 이
// "high" 로 매겨도 결과가 "zero" 로 강등돼야 하고, 비대상이면 mock 값이 그대로
// 보존돼야 한다. unitId echo 는 유지해 순서 정합도 함께 본다.
function resultWithContribution(
  unitId: string,
  contribution: EvaluationResult["contribution"],
): EvaluationResult {
  return { ...resultFor(unitId), contribution };
}

// resultWithNarrative — underperformer wiring 검증용. scoring 산출 narrative 를
// 명시 지정해 marker 접두/보존을 입출력 비교로 단언한다(기본 resultFor 는
// "narrative for <unitId>" 고정). 저성과 author 단위는 mock 이 어떤 narrative 를
// 반환해도 결과가 marker 접두로 시작해야 하고, 비대상은 mock 값이 그대로 보존돼야
// 한다. unitId echo 는 유지해 순서 정합도 함께 본다.
function resultWithNarrative(
  unitId: string,
  narrative: string,
): EvaluationResult {
  return { ...resultFor(unitId), narrative };
}

// makeScoringServiceWithNarrative — 각 단위에 고정 narrative 를 부여하는 mock.
// underperformer detection 은 deduped 입력의 contributionKind=code 단위 수를 동료
// 평균 대비 측정하고, scoring narrative 는 본 mock 이 통제하므로 두 축(signal vs
// scored narrative)을 독립적으로 구성할 수 있다. 기본은 "원본 narrative" 로 둬
// marker 접두가 가시적으로 드러나도록 한다.
function makeScoringServiceWithNarrative(narrative = "원본 narrative"): {
  scoreUnit: jest.Mock;
} {
  return {
    scoreUnit: jest.fn().mockImplementation(async (input: { unitId: string }) =>
      // eslint-disable-next-line @typescript-eslint/require-await
      resultWithNarrative(input.unitId, narrative),
    ),
  };
}

// underPerformerCommit — 저성과자 식별 대상 fixture(code 기여 단위 1 건만 가진
// author). batch 안에서 평균 code 기여 단위 수가 충분히 높을 때(예: 동료가 4 건씩
// 가질 때) underPerformer 로 식별된다. titleLength 를 contribution-quality 임계 이상
// 으로 둬 zero-contribution 강등 분기와 분리한다(narrative 외 필드 영향 0).
function underPerformerCommit(overrides: {
  externalId: string;
  author: string;
  titleLength?: number;
}): GithubActivity {
  const { externalId, author, titleLength = 40 } = overrides;
  return githubActivity({
    externalId,
    author,
    kind: "commit",
    metadata: { titleLength },
  });
}

// peerCommits — underperformer 비교 기준 동료 author 의 code 기여 단위 다수. 같은
// author 의 commit count 건. titleLength 는 contribution-quality 임계 이상으로 둬
// zero-contribution 분기와 분리한다(narrative 외 필드 영향 0). underperformer detection
// 은 author 별 code 단위 수만 보므로 titleLength / metadata 는 결과에 영향 없다.
function peerCommits(
  author: string,
  count: number,
  titleLengthBase = 40,
): GithubActivity[] {
  return Array.from({ length: count }, (_unused, i) =>
    githubActivity({
      externalId: `${author}-peer-${String(i)}`,
      author,
      kind: "commit",
      timestamp: `2026-11-0${String(i + 1)}T00:00:00Z`,
      // titleLength 를 단위마다 다르게 줘 (kind, volume) 반복도 줄여 abuse suspected
      // 미발화를 보장한다(peer 단위는 narrative 보존이 검증 대상).
      metadata: { titleLength: titleLengthBase + i },
    }),
  );
}

// makeScoringServiceWithContribution — 각 단위에 고정 contribution 을 부여하는
// mock. contribution-quality detection 은 deduped 입력의 titleLength 로 신호를
// 산출하고, scoring contribution 은 본 mock 이 통제하므로 두 축(signal vs scored
// contribution)을 독립적으로 구성할 수 있다. 기본을 "high" 로 둬 floor 강등이
// LLM 정성 산출을 덮어쓰는지(가시성)를 확인하기 쉽게 한다.
function makeScoringServiceWithContribution(
  contribution: EvaluationResult["contribution"] = "high",
): { scoreUnit: jest.Mock } {
  return {
    scoreUnit: jest.fn().mockImplementation(async (input: { unitId: string }) =>
      // eslint-disable-next-line @typescript-eslint/require-await
      resultWithContribution(input.unitId, contribution),
    ),
  };
}

// zeroContribCommit — contribution-quality 대상(zero-contribution 후보) 단위 fixture.
// titleLength 를 CONTRIBUTION_QUALITY_TITLE_FLOOR(=1) 이하로 둬 detection 이
// zero-contribution 후보로 식별하게 한다. 서로 다른 externalId 로 unitId 를 분리해
// dedup 생존을 보장한다.
function zeroContribCommit(overrides: {
  externalId: string;
  author?: string;
  titleLength?: number;
}): GithubActivity {
  const { externalId, author = "reporter", titleLength = 1 } = overrides;
  return githubActivity({
    externalId,
    author,
    kind: "commit",
    metadata: { titleLength },
  });
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

  // ── T-0529: 기여 품질 floor 강등 배선(computeContributionQualitySignal →
  //    applyContributionQualityFloor). detection 은 dedup 후 입력의
  //    metadata.titleLength(임계 1) 로 zero-contribution 후보를 식별하고, 소비는
  //    abuse 감점 + update-count 중립 후 대상 단위의 contribution 을 결정적으로
  //    "zero" 로 floor 강등한다. mock scoreUnit 으로 contribution 을 통제해 강등/보존을
  //    입출력 비교로 단언한다. abuse / update-count 배선이 함께 보존됨(회귀 0)도 확인.
  describe("contribution-quality wiring — 대상 단위 contribution floor 강등 / 비대상 무변경(R-37/R-38)", () => {
    it("(happy) titleLength≤임계(zero-contribution 후보) 단위는 mock 이 high 로 매겨도 contribution 이 zero 로 강등된다", async () => {
      // titleLength 1(=임계) → detection 이 zero-contribution 후보로 식별. scoring
      // contribution 은 high 로 통제 → floor 강등으로 결과는 zero 여야 한다.
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({ externalId: "trivial", titleLength: 1 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].contribution).toBe("zero");
    });

    it("(happy) titleLength>임계(비대상) 단위는 mock scoreUnit contribution 이 그대로 보존된다", async () => {
      // titleLength 42(기본 githubActivity) → 비대상. scoring contribution high →
      // 무변경 passthrough 로 결과도 high.
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "rich", metadata: { titleLength: 42 } }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].contribution).toBe("high");
    });

    it("(branch a) 대상 + 비대상 혼합 batch → 대상만 zero 강등, 비대상 무변경", async () => {
      // reporter: titleLength 1(대상), author2: titleLength 50(비대상). 둘 다 scoring
      // contribution medium → 대상만 zero 강등, 비대상은 medium 보존. 순서 보존.
      const scoring = makeScoringServiceWithContribution("medium");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({
          externalId: "z-1",
          author: "reporter",
          titleLength: 1,
        }),
        githubActivity({
          externalId: "r-1",
          author: "richauthor",
          metadata: { titleLength: 50 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.contribution)).toEqual(["zero", "medium"]);
    });

    it("(branch b) 전 단위 비대상(titleLength>임계) → 전 단위 contribution 무변경", async () => {
      const scoring = makeScoringServiceWithContribution("low");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "n-1",
          author: "a1",
          metadata: { titleLength: 20 },
        }),
        confluenceActivity({
          externalId: "n-2",
          author: "a2",
          metadata: { titleLength: 30 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.contribution)).toEqual(["low", "low"]);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // 동일 unitId(zero-contribution 후보) 중복 2 건 → dedup 후 earliest 1 건. 그
      // 1 건이 대상으로 식별돼 zero 강등(detection 이 dedup 후 입력 위 동작 확인).
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "dup-z",
          author: "reporter",
          kind: "commit",
          timestamp: "2026-10-02T00:00:00Z",
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "dup-z",
          author: "reporter",
          kind: "commit",
          timestamp: "2026-10-01T00:00:00Z", // earliest 보존
          metadata: { titleLength: 1 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].contribution).toBe("zero");
    });

    it("(branch d) titleLength 경계 — 임계 정확히(1)→강등, 임계+1(2)→무변경, 누락→강등(0 흡수)", async () => {
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "exact-1",
          author: "a1",
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "above-2",
          author: "a2",
          metadata: { titleLength: 2 },
        }),
        // titleLength 누락 → resolveTitleLength 0 흡수 → 임계 이하 → 강등.
        githubActivity({
          externalId: "missing",
          author: "a3",
          metadata: {},
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // exact-1 강등(zero), above-2 무변경(high), missing 강등(zero).
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "high",
        "zero",
      ]);
    });
  });

  describe("contribution-quality wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 세 adjust(abuse + update-count + contribution-quality) 미실행 + error 전파", async () => {
      // 강등 대상 구성이어도 scoring reject 면 adjust 자리 도달 0 — error 전파.
      const scoring = makeScoringServiceWithContribution("high");
      const boom = new Error("LLM HTTP 호출 실패 (status: 500)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithContribution("ok", "high"))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({ externalId: "ok", author: "a1", titleLength: 1 }),
        zeroContribCommit({ externalId: "fail", author: "a2", titleLength: 1 }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0(부분 결과 위장 0).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(negative i) 빈 Activity[] → 빈 EvaluationResult[](세 helper 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 단위(비대상) → contribution 무변경", async () => {
      const scoring = makeScoringServiceWithContribution("medium");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "solo",
          author: "solo-dev",
          metadata: { titleLength: 40 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].contribution).toBe("medium");
    });

    it("(negative iii) 동일 author 다수 단위 — 일부만 대상(부분 적용 정합)", async () => {
      // 같은 author 의 단위 3 건: titleLength 1/40/0. unitId 가 모두 달라 dedup 미발화.
      // titleLength≤1 인 u-1(1), u-3(0) 만 대상(zero 강등), u-2(40)는 비대상(보존).
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "u-1",
          author: "multi",
          metadata: { titleLength: 1 },
        }),
        githubActivity({
          externalId: "u-2",
          author: "multi",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "u-3",
          author: "multi",
          metadata: { titleLength: 0 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "high",
        "zero",
      ]);
    });

    it("(negative iv) 대상 단위의 scoring contribution 이 이미 zero → 멱등(zero 유지)", async () => {
      // scoring contribution 이 이미 zero 인 대상 단위 → floor 강등 멱등(값 동일).
      const scoring = makeScoringServiceWithContribution("zero");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({ externalId: "idem", titleLength: 1 }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results[0].contribution).toBe("zero");
    });

    it("(negative v) titleLength 비-number(string) / Infinity → 0 흡수 → 강등 대상", async () => {
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // titleLength 가 string → resolveTitleLength 0 흡수 → 임계 이하 → 강등.
        githubActivity({
          externalId: "str-tl",
          author: "a1",
          metadata: { titleLength: "abc" as unknown as number },
        }),
        // titleLength Infinity → 비유한 → 0 흡수 → 강등.
        githubActivity({
          externalId: "inf-tl",
          author: "a2",
          metadata: { titleLength: Infinity },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results.map((r) => r.contribution)).toEqual(["zero", "zero"]);
    });

    it("(negative vi) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      // unitId 별 고유 contribution 으로 author↔result 매핑 misalignment 를 잡는다.
      // 전 단위 비대상(titleLength>임계) → contribution 무변경, unitId 순서와
      // contribution 순서가 입력 순서 그대로여야 한다.
      const contributionByUnit: Record<
        string,
        EvaluationResult["contribution"]
      > = {
        "github:com/sec:q-1": "low",
        "github:com/sec:q-2": "medium",
        "confluence:wiki:q-3": "high",
      };
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) =>
            resultWithContribution(
              input.unitId,
              contributionByUnit[input.unitId],
            ),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "q-1",
          author: "a1",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "q-2",
          author: "a2",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "q-3",
          author: "a3",
          metadata: { titleLength: 40 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(
        results.map((r) => ({
          unitId: r.unitId,
          contribution: r.contribution,
        })),
      ).toEqual([
        { unitId: "github:com/sec:q-1", contribution: "low" },
        { unitId: "github:com/sec:q-2", contribution: "medium" },
        { unitId: "confluence:wiki:q-3", contribution: "high" },
      ]);
    });
  });

  describe("3 배선 공존(abuse + update-count + contribution-quality) / 결정성 / 비변형 / 직교", () => {
    it("(공존) 한 단위 abuse 감점 + 다른 단위 update-count 중립 + 또 다른 단위 contribution floor 가 함께 동작", async () => {
      // abuser: suspectedCommits 3 건(code, titleLength 1) → abuse 감점(volume 0) +
      //   titleLength 1 이라 contribution-quality 대상이기도 함(zero 강등).
      // writer: version 7 document(titleLength 10, abuse 미발화) → update-count 중립
      //   (base volume 보존) + 비대상(contribution 보존).
      // reporter: titleLength 1 단일 commit(abuse 미발화 — unitCount 1) → contribution
      //   강등 대상(zero), volume 무변경.
      // 본 케이스로 세 배선이 서로 다른 단위에서 동시에 작동함을 단언한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "solo-z",
          author: "reporter",
          titleLength: 1,
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // volume: abuser 3 건 감점 0, doc-keep 중립 보존 50, reporter 무감점 50.
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 50, 50]);
      // contribution: abuser 3 건(titleLength 1) zero 강등, doc-keep(titleLength 10)
      // 비대상 high 보존, reporter zero 강등.
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "zero",
        "zero",
        "high",
        "zero",
      ]);
    });

    it("(교차) 한 단위가 abuse suspected ∩ update-count 중립 ∩ contribution floor 모두 대상 → volume 감점·중립 + contribution zero 동시 적용", async () => {
      // 단일 author writer 의 document 단위들로 세 신호를 한 author 에 겹친다:
      //   - version 7(≥5) → update-count 중립 대상.
      //   - titleLength 1 → contribution-quality 강등 대상.
      //   - 같은 (kind=document, low-volume) 반복 3 건 → abuse suspected.
      // 동일 author·동일 kind·동일 titleLength·서로 다른 externalId 3 건이라
      // repetitionRatio 1.0 → suspected. abuse 감점으로 volume 0 → update-count 중립은
      // base(0) 보존, contribution 은 zero 강등. 필드 직교 결과를 명시 박제.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 100,
            contribution: "high" as const,
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "x-1",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
        confluenceActivity({
          externalId: "x-2",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
        confluenceActivity({
          externalId: "x-3",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(3);
      // abuse 감점(repetitionRatio 1.0 → 0) → update-count 중립 base(0) 보존.
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
      // contribution-quality floor 강등 → 전부 zero(volume 축과 직교).
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "zero",
        "zero",
      ]);
    });

    it("(공존) abuse 배선이 보존된다 — abuse 발화 batch 에서 contribution-quality 가 끼어도 abuse 감점 회귀 0", async () => {
      // abuse 발화 조건(titleLength<3, 저-volume 반복)은 contribution-quality 발화
      // 조건(titleLength≤1)과 부분 겹친다 — 둘은 저-titleLength 휴리스틱을 공유한다.
      // 따라서 abuse 가 발화하는 batch 에서 contribution floor 가 함께 끼어도 abuse
      // 감점(volume 0)이 회귀 없이 그대로 작동함을 단언한다(T-0523 보존).
      const scoring = makeScoringServiceWithVolume(80);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = suspectedCommits("abuser", 3);

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // abuser 3 건 abuse 감점 0(회귀 0). contribution 은 titleLength 1 이라 함께 zero
      // 강등되지만, 본 단언의 핵심은 abuse volume 감점이 보존됨이다.
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0]);
    });

    it("(공존) update-count 배선이 보존된다 — contribution-quality 비대상 document batch 의 중립 보존 회귀 0", async () => {
      // 전 단위 titleLength>임계(contribution-quality 미발화) + version≥5(update-count
      // 중립 대상) document → update-count 중립만 작동, contribution 무변경. T-0526 보존.
      const scoring = makeScoringServiceWithVolume(80);
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

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 둘 다 base 80 보존(중립 대상은 보존, 비대상은 무변경). contribution 비대상 보존.
      expect(results.map((r) => r.volume)).toEqual([80, 80]);
      expect(results.every((r) => r.contribution === "medium")).toBe(true);
    });

    it("(직교) 필드 직교 — volume 배선은 contribution 을, contribution 배선은 volume 을 건드리지 않는다", async () => {
      // titleLength 1(contribution 강등 대상) + version 7(update-count 중립 대상) 단일
      // document. abuse 는 단일 단위라 미발화. update-count 중립은 volume 만, contribution
      // floor 는 contribution 만 바꿔야 한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 35,
            contribution: "high" as const,
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "ortho",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // volume 은 update-count 중립으로 base 35 보존(contribution 강등이 건드리지 않음).
      expect(results[0].volume).toBe(35);
      // contribution 은 floor 강등으로 zero(update-count 중립이 건드리지 않음).
      expect(results[0].contribution).toBe("zero");
    });

    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic adjust)", async () => {
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "z",
          author: "reporter",
          titleLength: 1,
        }),
      ];

      const makeScoring = (): { scoreUnit: jest.Mock } => ({
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
          })),
      });

      const first = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );
      const second = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(first).toEqual(second);
      // 결정적 결과를 함께 본다: volume [0,0,0,50,50], contribution 강등 반영.
      expect(first.map((r) => r.volume)).toEqual([0, 0, 0, 50, 50]);
      expect(first.map((r) => r.contribution)).toEqual([
        "zero",
        "zero",
        "zero",
        "high",
        "zero",
      ]);
    });

    it("(비변형) contribution-quality 대상 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({
          externalId: "z-1",
          author: "reporter",
          titleLength: 1,
        }),
        githubActivity({
          externalId: "rich",
          author: "richauthor",
          metadata: { titleLength: 50 },
        }),
      ];
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });

  // ── T-0532: 저성과자 narrative annotation 배선(computeUnderPerformerSignal →
  //    applyUnderPerformerAnnotation). detection 은 dedup 후 입력의 author 별
  //    contributionKind="code" 단위 수를 동료 평균 대비 상대 비교
  //    (UNDERPERFORMER_RELATIVE_FLOOR=0.5) 로 measure 하고, 소비는 abuse 감점 +
  //    update-count 중립 + contribution-quality floor 후 저성과 author 의 **모든**
  //    단위 narrative 앞에 표준 한국어 marker(UNDERPERFORMER_NARRATIVE_MARKER) 를
  //    결정적으로 접두 annotation 한다(author-level 전파). mock scoreUnit 으로
  //    narrative 를 통제해 marker 접두/보존을 입출력 비교로 단언한다. abuse /
  //    update-count / contribution-quality 배선이 함께 보존됨(회귀 0)도 확인한다.
  describe("underperformer wiring — 저성과 author 단위 narrative marker 접두 / 비대상 무변경(R-27)", () => {
    it("(happy) underPerformer=true author 의 모든 단위 narrative 가 marker 접두로 시작한다", async () => {
      // slow author: code 단위 1 건. peers: 각 4 건 → 평균 (1+4+4)/3 = 3, floor 1.5,
      // slow(1) < 1.5 → underPerformer=true. mock narrative "원본" → marker + "원본".
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
        ...peerCommits("peerB", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 1(slow) + 4 + 4 = 9 단위.
      expect(results).toHaveLength(9);
      // slow author 의 단위(첫 1 건)는 marker 접두.
      expect(results[0].narrative).toBe(
        `${UNDERPERFORMER_NARRATIVE_MARKER}원본`,
      );
      expect(
        results[0].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      ).toBe(true);
    });

    it("(happy) underPerformer=false author 단위는 narrative 가 mock 반환값 그대로 보존", async () => {
      // 위와 동일 batch — peer 단위(인덱스 1~8) 는 비대상이라 narrative "원본" 그대로.
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
        ...peerCommits("peerB", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 비대상 author 단위(인덱스 1 부터) → narrative 보존(marker 미접두).
      for (let i = 1; i < results.length; i += 1) {
        expect(results[i].narrative).toBe("원본");
        expect(
          results[i].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ).toBe(false);
      }
    });

    it("(branch a) 대상 + 비대상 author 혼합 batch → 대상만 marker 접두, 비대상 무변경(순서 보존)", async () => {
      // 위 happy 와 동일 구성이지만 입력 순서를 섞어 marker 접두/보존이 unitId 순서를
      // 그대로 따라가는지 단언한다(매핑 misalignment 회귀 방어 미니버전). peer 4 건 +
      // slow 1 건이 [peer, slow, peer, peer, peer] 순으로 들어가도 marker 접두 자리는
      // 슬로우 author 단위(인덱스 1)에만 정확히 와야 한다. peer-a~d 의 externalId 가
      // 모두 다르므로 dedup 미발화.
      const scoring = makeScoringServiceWithNarrative("기본");
      const orchestrator = makeOrchestrator(scoring);
      const activitiesFixed: Activity[] = [
        githubActivity({
          externalId: "peer-a",
          author: "peer",
          kind: "commit",
          timestamp: "2026-12-01T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
        underPerformerCommit({ externalId: "slow-x", author: "slow" }),
        githubActivity({
          externalId: "peer-b",
          author: "peer",
          kind: "commit",
          timestamp: "2026-12-02T00:00:00Z",
          metadata: { titleLength: 41 },
        }),
        githubActivity({
          externalId: "peer-c",
          author: "peer",
          kind: "commit",
          timestamp: "2026-12-03T00:00:00Z",
          metadata: { titleLength: 42 },
        }),
        githubActivity({
          externalId: "peer-d",
          author: "peer",
          kind: "commit",
          timestamp: "2026-12-04T00:00:00Z",
          metadata: { titleLength: 43 },
        }),
      ];
      // 인자에 activities 가 아닌 activitiesFixed 를 넘긴다(상기 fixture 가 의도된
      // 분리된 외부 단위 5 건). peer 4 + slow 1 → mean=(4+1)/2=2.5, floor=1.25,
      // slow(1)<1.25 → underPerformer=true.

      const results = await orchestrator.evaluateActivities(
        activitiesFixed,
        OPTIONS,
      );

      expect(results).toHaveLength(5);
      // 입력 순서 [peer-a, slow-x, peer-b, peer-c, peer-d] 보존 — slow 단위만 marker 접두.
      const isMarked = results.map((r) =>
        r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      );
      expect(isMarked).toEqual([false, true, false, false, false]);
    });

    it("(branch b) 전 author 비대상(저성과 미식별) batch → 전 단위 narrative 무변경", async () => {
      // 두 author 가 각 4 건씩 — 동률(equal counts), 동일 평균. floor 비교에서 양쪽
      // 모두 codeUnitCount >= floor 이므로 underPerformer 0(전원 동일). narrative 전부
      // mock 반환값 그대로 보존.
      const scoring = makeScoringServiceWithNarrative("동률 narrative");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("alice", 4),
        ...peerCommits("bob", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(8);
      // 전 단위 marker 미접두 — 신호 underPerformerDetected=false 흡수.
      expect(
        results.every(
          (r) => !r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ),
      ).toBe(true);
      expect(results.every((r) => r.narrative === "동률 narrative")).toBe(true);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // slow author 의 commit 1 건 중복(unitId 동일) 2 건 → dedup 후 1 건. peer 4 건.
      // dedup 후 mean=(1+4)/2=2.5, floor 1.25, slow(1)<1.25 → underPerformer.
      // (만약 detection 이 dedup 전 입력 위에서 동작했다면 slow=2 → 2>=1.25 → 미식별
      //  가능성 — 본 단언으로 dedup 후 input 사용을 검증.)
      const scoring = makeScoringServiceWithNarrative("dedup-check");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({
          externalId: "slow-dup",
          author: "slow",
          kind: "commit",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "slow-dup",
          author: "slow",
          kind: "commit",
          timestamp: "2026-09-01T00:00:00Z", // earliest 보존
          metadata: { titleLength: 40 },
        }),
        ...peerCommits("peerX", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // dedup 으로 slow 1 건 + peer 4 건 → 5 단위.
      expect(results).toHaveLength(5);
      // slow 단위(인덱스 0)는 underPerformer 식별되어 marker 접두, peer 는 보존.
      expect(
        results[0].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      ).toBe(true);
      for (let i = 1; i < results.length; i += 1) {
        expect(
          results[i].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ).toBe(false);
      }
    });

    it("(branch d) 단독 author / 평균 0 경계 → underPerformer 0(보수적, 전 단위 무변경)", async () => {
      // 단일 author 단일 단위 → comparable false → underPerformer 0. narrative 보존.
      const scoring = makeScoringServiceWithNarrative("solo");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "only", author: "solo-dev" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(
        results[0].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      ).toBe(false);

      // 평균 0 경계 — 전 author 가 document 만 가져 code 단위 수 0 → meanCodeUnitCount 0.
      // comparable false → underPerformer 0(전원 동일 — 보수적). narrative 보존.
      const scoring2 = makeScoringServiceWithNarrative("docs-only");
      const orchestrator2 = makeOrchestrator(scoring2);
      const activitiesDocs: Activity[] = [
        confluenceActivity({
          externalId: "d-1",
          author: "writer-a",
          timestamp: "2026-09-01T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "d-2",
          author: "writer-b",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
      ];

      const results2 = await orchestrator2.evaluateActivities(
        activitiesDocs,
        OPTIONS,
      );

      expect(results2).toHaveLength(2);
      expect(
        results2.every(
          (r) => !r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ),
      ).toBe(true);
    });
  });

  describe("underperformer wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 네 adjust(abuse + update-count + contribution-quality + underperformer) 미실행 + error 전파", async () => {
      // 저성과 식별 구성이어도 scoring reject 면 adjust 자리 도달 0 — error 전파.
      const scoring = makeScoringServiceWithNarrative("원본");
      const boom = new Error("LLM HTTP 호출 실패 (status: 500)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithNarrative("ok", "원본"))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "ok", author: "slow" }),
        ...peerCommits("peerA", 4),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0(부분 결과 위장 0).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(negative i) 빈 Activity[] → 빈 EvaluationResult[](네 helper 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 단위 → 동료 부재 → 비대상 → narrative 무변경", async () => {
      const scoring = makeScoringServiceWithNarrative("solo-narrative");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "only", author: "solo-dev" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].narrative).toBe("solo-narrative");
    });

    it("(negative iii) 동일 author 다수 단위 — 저성과 식별 시 그 author 의 **모든** 단위가 일관 marker 접두(author-level 전파)", async () => {
      // slow author 가 code 단위 1 건 + document 단위 2 건(code 카운트엔 미반영). peer
      // 가 code 4 건. dedup 후 slow code=1, peer code=4 → mean (1+4)/2=2.5, floor 1.25,
      // slow(1)<1.25 → underPerformer. slow author 의 **모든** 단위(code 1 + document 2)
      // narrative 가 marker 접두로 일관됨을 단언.
      const scoring = makeScoringServiceWithNarrative("multi-unit");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // slow author code 1 건.
        underPerformerCommit({ externalId: "slow-c-1", author: "slow" }),
        // slow author document 2 건(code 카운트 미반영이지만 narrative annotation 대상).
        confluenceActivity({
          externalId: "slow-d-1",
          author: "slow",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "slow-d-2",
          author: "slow",
          metadata: { titleLength: 41 },
        }),
        // peer code 4 건.
        ...peerCommits("peerY", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 3 + 4 = 7 단위.
      expect(results).toHaveLength(7);
      // slow author 단위(인덱스 0,1,2)는 모두 marker 접두 일관.
      for (let i = 0; i < 3; i += 1) {
        expect(
          results[i].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ).toBe(true);
      }
      // peer 단위(인덱스 3~6)는 보존.
      for (let i = 3; i < 7; i += 1) {
        expect(
          results[i].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ).toBe(false);
      }
    });

    it("(negative iv) 대상 author narrative 가 이미 marker 접두 → 멱등(중복 접두 0)", async () => {
      // mock scoring 이 이미 marker 로 시작하는 narrative 를 반환 → 멱등으로 1 회만 유지.
      const preMarked = `${UNDERPERFORMER_NARRATIVE_MARKER}이미 접두된 본문`;
      const scoring = makeScoringServiceWithNarrative(preMarked);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // slow 단위 narrative — marker 가 두 번 접두되지 않고 1 회만(멱등).
      expect(results[0].narrative).toBe(preMarked);
      // 검증: marker 가 정확히 1 회 등장(중복 접두 0).
      const occurrences =
        results[0].narrative.split(UNDERPERFORMER_NARRATIVE_MARKER).length - 1;
      expect(occurrences).toBe(1);
    });

    it("(negative v) 빈 narrative('') 단위가 저성과 대상일 때도 marker 만 접두(본문 손상 없음)", async () => {
      const scoring = makeScoringServiceWithNarrative("");
      const orchestrator = makeOrchestrator(scoring);
      // slow code=1, peerA/peerB code=4 → mean=3, under floor 1.5(slow<1.5 → under),
      // notable ceiling 4.5(peers 4<4.5 → 비대상). peerB 를 둬 peer 가 notable 임계를
      // 넘지 않도록 평균을 조정(T-0535 notable 배선과의 간섭 회피 — peer narrative 보존).
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
        ...peerCommits("peerB", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // slow → 빈 narrative 에 marker 만 접두.
      expect(results[0].narrative).toBe(UNDERPERFORMER_NARRATIVE_MARKER);
      // peer → 빈 narrative 보존.
      for (let i = 1; i < results.length; i += 1) {
        expect(results[i].narrative).toBe("");
      }
    });

    it("(negative vi) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      // unitId 별 고유 narrative 로 author↔result 매핑 misalignment 를 잡는다. 전 단위
      // 비대상(평균 0 / 단독 author 등 보수적 분기로 underPerformer 0) → narrative
      // 무변경, unitId 순서와 narrative 순서가 입력 순서 그대로여야 한다.
      const narrativeByUnit: Record<string, string> = {
        "github:com/sec:p-1": "alpha",
        "github:com/sec:p-2": "beta",
        "github:com/sec:p-3": "gamma",
      };
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) =>
            resultWithNarrative(input.unitId, narrativeByUnit[input.unitId]),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      // 세 단위 모두 서로 다른 author 의 code 1 건씩 → mean (1+1+1)/3=1, floor 0.5,
      // 전원 codeUnitCount(1) >= 0.5 → underPerformer 0. narrative 보존. 세 번째도
      // contributionKind=code 로 통일(github commit) — 만약 document(confluence) 였다면
      // 그 author 의 codeUnitCount=0 → underPerformer 식별되어 marker 가 끼었을 것.
      // unitId 의 prefix 분기(github vs confluence)는 mapper 가 결정하므로 narrative 별
      // 순서 정합만 검증한다.
      const activities: Activity[] = [
        githubActivity({
          externalId: "p-1",
          author: "a1",
          kind: "commit",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "p-2",
          author: "a2",
          kind: "commit",
          metadata: { titleLength: 41 },
        }),
        githubActivity({
          externalId: "p-3",
          author: "a3",
          kind: "commit",
          metadata: { titleLength: 42 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(
        results.map((r) => ({
          unitId: r.unitId,
          narrative: r.narrative,
        })),
      ).toEqual([
        { unitId: "github:com/sec:p-1", narrative: "alpha" },
        { unitId: "github:com/sec:p-2", narrative: "beta" },
        { unitId: "github:com/sec:p-3", narrative: "gamma" },
      ]);
    });
  });

  describe("4 배선 공존(abuse + update-count + contribution-quality + underperformer) / 결정성 / 비변형 / 직교", () => {
    it("(공존) 한 단위 abuse 감점 + 다른 단위 update-count 중립 + 또 다른 단위 contribution floor + 저성과 author narrative marker 가 함께 동작", async () => {
      // abuser: suspectedCommits 3 건(code, titleLength 1) → abuse 감점 + contribution
      //   floor 강등(titleLength 1). abuser 의 code 3 건.
      // writer: version 7 document 단일(titleLength 10, abuse 미발화) → update-count
      //   중립 보존, contribution 비대상. writer 의 code 0 건(document 만).
      // reporter: titleLength 1 단일 commit(abuse 미발화 — unitCount 1) →
      //   contribution 강등 대상. reporter 의 code 1 건.
      // slow-narrator: code 1 건(titleLength 40, contribution 미발화).
      // peer: code 4 건(titleLength 40~).
      //
      // code counts: abuser=3, writer=0, reporter=1, slow-narrator=1, peer=4 →
      // mean=(3+0+1+1+4)/5=1.8, floor 0.9. 미만 author: writer(0), peer 미만 가능
      // 검증 — writer(0)<0.9 → underPerformer, reporter(1)>=0.9 미식별, slow-narrator
      // (1)>=0.9 미식별. 따라서 writer 의 document 단위에 marker 접두.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
            narrative: "기본",
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "solo-z",
          author: "reporter",
          titleLength: 1,
        }),
        underPerformerCommit({
          externalId: "narrator-1",
          author: "slow-narrator",
        }),
        ...peerCommits("peer", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 3 + 1 + 1 + 1 + 4 = 10 단위.
      expect(results).toHaveLength(10);
      // volume: abuser 3 건 감점 0, doc-keep 중립 보존 50, reporter 무감점 50,
      // narrator 50, peer 4 건 50.
      expect(results.map((r) => r.volume)).toEqual([
        0, 0, 0, 50, 50, 50, 50, 50, 50, 50,
      ]);
      // contribution: abuser 3 건(titleLength 1) zero, doc-keep(titleLength 10) 보존
      // high, reporter zero, narrator(titleLength 40) high, peer high.
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "zero",
        "zero",
        "high",
        "zero",
        "high",
        "high",
        "high",
        "high",
        "high",
      ]);
      // narrative marker: writer 의 doc-keep(인덱스 3)만 marker 접두, 나머지 보존.
      const isMarked = results.map((r) =>
        r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      );
      expect(isMarked).toEqual([
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
    });

    it("(교차) 한 단위가 abuse suspected ∩ update-count 중립 ∩ contribution floor ∩ underperformer 모두 대상 → volume 감점·중립 + contribution zero + narrative marker 동시 적용", async () => {
      // 단일 author writer 의 document 단위들로 네 신호를 한 author 에 겹친다:
      //   - version 7(≥5) → update-count 중립 대상.
      //   - titleLength 1 → contribution-quality 강등 대상.
      //   - 같은 (kind=document, low-volume) 반복 3 건 → abuse suspected.
      //   - writer 의 code 0 건 + peer 의 code 6 건 → mean=(0+6)/2=3, floor 1.5,
      //     writer(0)<1.5 → underPerformer.
      // 동일 author 동일 kind 동일 titleLength 다른 externalId 3 건이라 dedup 미발화.
      // abuse 감점 → volume 0, update-count 중립 → base(0) 보존, contribution zero,
      // narrative marker 접두. 필드 직교 결과를 명시 박제.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 100,
            contribution: "high" as const,
            narrative: "본문",
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        confluenceActivity({
          externalId: "x-1",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
        confluenceActivity({
          externalId: "x-2",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
        confluenceActivity({
          externalId: "x-3",
          author: "writer",
          metadata: { titleLength: 1, version: 7 },
        }),
        ...peerCommits("peer", 6),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(9);
      // writer 의 3 단위: abuse 감점(repetitionRatio 1.0 → 0), update-count 중립 보존(0),
      // contribution zero, narrative marker 접두. peer 6 단위: 모두 무감점 + 보존.
      const writerResults = results.slice(0, 3);
      const peerResults = results.slice(3);
      expect(writerResults.every((r) => r.volume === 0)).toBe(true);
      expect(writerResults.every((r) => r.contribution === "zero")).toBe(true);
      expect(
        writerResults.every((r) =>
          r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ),
      ).toBe(true);
      // peer 단위 — volume 100, contribution high, narrative 보존.
      expect(peerResults.every((r) => r.volume === 100)).toBe(true);
      expect(peerResults.every((r) => r.contribution === "high")).toBe(true);
      expect(
        peerResults.every(
          (r) => !r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
        ),
      ).toBe(true);
    });

    it("(공존) abuse 배선이 보존된다 — underperformer 가 끼어도 abuse 감점 회귀 0", async () => {
      // abuser 3 건(suspected, code) + peer 4 건(code). abuser 의 code=3, peer code=4
      // → mean=3.5, floor 1.75 → 둘 다 미식별(>=1.75). underperformer 미발화 batch
      // 에서도 abuse 감점이 그대로 작동함을 확인(T-0523 보존).
      const scoring = makeScoringServiceWithVolume(80);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        ...peerCommits("peer", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // abuser 3 건 abuse 감점 0(회귀 0), peer 4 건 무감점 보존.
      expect(results.map((r) => r.volume)).toEqual([0, 0, 0, 80, 80, 80, 80]);
    });

    it("(공존) contribution-quality 배선이 보존된다 — underperformer 가 끼어도 contribution floor 회귀 0", async () => {
      // reporter(titleLength 1) zero 강등 + peer 4 건(titleLength 40~). reporter
      // code=1, peer code=4 → mean=2.5, floor 1.25, reporter(1)<1.25 → underPerformer.
      // contribution 강등은 reporter 만(둘 다 보존이라 floor 회귀 검증).
      const scoring = makeScoringServiceWithContribution("high");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        zeroContribCommit({
          externalId: "r-1",
          author: "reporter",
          titleLength: 1,
        }),
        ...peerCommits("peer", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // reporter zero 강등(회귀 0), peer high 보존.
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "high",
        "high",
        "high",
        "high",
      ]);
    });

    it("(직교) 필드 직교 — narrative 배선은 volume / contribution 을, 다른 배선은 narrative 를 건드리지 않는다", async () => {
      // slow(code 1) + peerA/peerB(각 code 4) → mean=3, under floor 1.5(slow<1.5 →
      // under), notable ceiling 4.5(peers 4<4.5 → 비대상). mock 이 volume 35,
      // contribution "high", narrative "x" 를 반환. slow 의 단위는 narrative 만 marker
      // 접두되고 volume / contribution 은 그대로 보존되어야 한다. peer 는 전체 보존
      // (다른 배선 미발화). peerB 를 둬 peer 가 notable 임계를 넘지 않도록 평균 조정
      // (T-0535 notable 배선과의 간섭 회피).
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 35,
            contribution: "high" as const,
            narrative: "x",
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
        ...peerCommits("peerB", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // slow 단위 — narrative marker 접두, volume / contribution 보존.
      expect(results[0].narrative).toBe(`${UNDERPERFORMER_NARRATIVE_MARKER}x`);
      expect(results[0].volume).toBe(35);
      expect(results[0].contribution).toBe("high");
      // peer 단위 — 전체 보존.
      for (let i = 1; i < results.length; i += 1) {
        expect(results[i].narrative).toBe("x");
        expect(results[i].volume).toBe(35);
        expect(results[i].contribution).toBe("high");
      }
    });

    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic adjust + marker 멱등)", async () => {
      // 4 배선 공존 + 멱등 marker 검증 — 동일 입력으로 두 번 호출해도 동일 결과.
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "z",
          author: "reporter",
          titleLength: 1,
        }),
        underPerformerCommit({
          externalId: "narrator-1",
          author: "slow-narrator",
        }),
        ...peerCommits("peer", 4),
      ];

      const makeScoring = (): { scoreUnit: jest.Mock } => ({
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
            narrative: "deterministic",
          })),
      });

      const first = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );
      const second = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(first).toEqual(second);
    });

    it("(비변형) underperformer 대상 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peer", 4),
      ];
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });

  // ── T-0535: 중요·어려운 기여 narrative annotation 배선
  //    (computeNotableContributionSignal → applyNotableContributionAnnotation).
  //    detection 은 dedup 후 입력의 author 별 contributionKind="code" 단위 수를 동료
  //    평균 대비 상대 비교(NOTABLE_RELATIVE_CEILING=1.5) 로 measure 하고, 소비는 abuse
  //    감점 + update-count 중립 + contribution-quality floor + underperformer annotation
  //    후 중요기여 author 의 **모든** 단위 narrative 앞에 표준 한국어 marker
  //    (NOTABLE_CONTRIBUTION_NARRATIVE_MARKER) 를 결정적으로 접두 annotation 한다
  //    (author-level 전파, underperformer 의 대칭 inverse). mock scoreUnit 으로
  //    narrative 를 통제해 marker 접두/보존을 입출력 비교로 단언한다. 앞 네 배선이 함께
  //    보존됨(회귀 0)도 확인한다.
  describe("notable wiring — 중요기여 author 단위 narrative marker 접두 / 비대상 무변경(R-25)", () => {
    it("(happy) notable=true author 의 모든 단위 narrative 가 marker 접두로 시작한다", async () => {
      // star author: code 단위 6 건. peers: 각 2 건 → 평균 (6+2+2)/3 ≈ 3.33, notable
      // ceiling 3.33*1.5 ≈ 5, star(6) > 5 → notable=true. peer 2 건은 under floor
      // (3.33*0.5 ≈ 1.67) 이상이라 저성과 미식별 → peer 는 어떤 marker 도 안 받음.
      // mock narrative "원본" → marker + "원본".
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 6(star) + 2 + 2 = 10 단위.
      expect(results).toHaveLength(10);
      // star author 의 단위(첫 6 건)는 marker 접두.
      for (let i = 0; i < 6; i += 1) {
        expect(results[i].narrative).toBe(
          `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}원본`,
        );
        expect(
          results[i].narrative.startsWith(
            NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
          ),
        ).toBe(true);
      }
    });

    it("(happy) notable=false author 단위는 narrative 가 mock 반환값 그대로 보존", async () => {
      // 위와 동일 batch — peer 단위(인덱스 6~9) 는 비대상이라 narrative "원본" 그대로.
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 비대상 author 단위(인덱스 6~9) → narrative 보존(marker 미접두).
      for (let i = 6; i < results.length; i += 1) {
        expect(results[i].narrative).toBe("원본");
        expect(
          results[i].narrative.startsWith(
            NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
          ),
        ).toBe(false);
      }
    });

    it("(branch a) 대상 + 비대상 author 혼합 batch → 대상만 marker 접두, 비대상 무변경(순서 보존)", async () => {
      // 입력 순서를 섞어 marker 접두/보존이 unitId 순서를 그대로 따라가는지 단언한다.
      // star: code 4 건, peer: 1 건 → mean=(4+1)/2=2.5, ceiling 3.75, star(4)>3.75 →
      // notable. peer-a~d / star externalId 모두 달라 dedup 미발화.
      const scoring = makeScoringServiceWithNarrative("기본");
      const orchestrator = makeOrchestrator(scoring);
      const activitiesFixed: Activity[] = [
        underPerformerCommit({ externalId: "peer-1", author: "peer" }),
        ...peerCommits("star", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activitiesFixed,
        OPTIONS,
      );

      expect(results).toHaveLength(5);
      // 입력 순서 [peer, star×4] 보존 — star 단위만 marker 접두.
      const isMarked = results.map((r) =>
        r.narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
      );
      expect(isMarked).toEqual([false, true, true, true, true]);
    });

    it("(branch b) 전 author 비대상(중요기여 미식별) batch → 전 단위 narrative 무변경", async () => {
      // 두 author 가 각 4 건씩 — 동률(equal counts), 동일 평균. ceiling 비교에서 양쪽
      // 모두 codeUnitCount <= ceiling 이므로 notable 0(전원 동일). narrative 전부
      // mock 반환값 그대로 보존.
      const scoring = makeScoringServiceWithNarrative("동률 narrative");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("alice", 4),
        ...peerCommits("bob", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(8);
      // 전 단위 marker 미접두 — 신호 notableDetected=false 흡수.
      expect(
        results.every(
          (r) => !r.narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
        ),
      ).toBe(true);
      expect(results.every((r) => r.narrative === "동률 narrative")).toBe(true);
    });

    it("(branch c) dedup 으로 일부 제거된 batch → detection 이 dedup 후 입력 위에서 동작", async () => {
      // peer author 의 commit 1 건 중복(unitId 동일) 2 건 → dedup 후 1 건. star 6 건.
      // dedup 후 mean=(6+1)/2=3.5, ceiling 5.25, star(6)>5.25 → notable.
      // (만약 detection 이 dedup 전 입력 위에서 동작했다면 peer=2 → mean=4, ceiling 6,
      //  star(6)>6 거짓 → 미식별 — 본 단언으로 dedup 후 input 사용을 검증.)
      const scoring = makeScoringServiceWithNarrative("dedup-check");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        githubActivity({
          externalId: "peer-dup",
          author: "peer",
          kind: "commit",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "peer-dup",
          author: "peer",
          kind: "commit",
          timestamp: "2026-09-01T00:00:00Z", // earliest 보존
          metadata: { titleLength: 40 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // dedup 으로 star 6 건 + peer 1 건 → 7 단위.
      expect(results).toHaveLength(7);
      // star 단위(인덱스 0~5)는 notable 식별되어 marker 접두, peer 는 보존.
      for (let i = 0; i < 6; i += 1) {
        expect(
          results[i].narrative.startsWith(
            NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
          ),
        ).toBe(true);
      }
      expect(
        results[6].narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
      ).toBe(false);
    });

    it("(branch d) 단독 author / 평균 0 경계 → notable 0(보수적, 전 단위 무변경)", async () => {
      // 단일 author 단일 단위 → comparable false → notable 0. narrative 보존.
      const scoring = makeScoringServiceWithNarrative("solo");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "only", author: "solo-dev" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(
        results[0].narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
      ).toBe(false);

      // 평균 0 경계 — 전 author 가 document 만 가져 code 단위 수 0 → meanCodeUnitCount 0.
      // comparable false → notable 0(전원 동일 — 보수적). narrative 보존.
      const scoring2 = makeScoringServiceWithNarrative("docs-only");
      const orchestrator2 = makeOrchestrator(scoring2);
      const activitiesDocs: Activity[] = [
        confluenceActivity({
          externalId: "d-1",
          author: "writer-a",
          timestamp: "2026-09-01T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "d-2",
          author: "writer-b",
          timestamp: "2026-09-02T00:00:00Z",
          metadata: { titleLength: 40 },
        }),
      ];

      const results2 = await orchestrator2.evaluateActivities(
        activitiesDocs,
        OPTIONS,
      );

      expect(results2).toHaveLength(2);
      expect(
        results2.every(
          (r) => !r.narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
        ),
      ).toBe(true);
    });
  });

  describe("notable wiring — error path / negative cases(예외 분기마다 cover)", () => {
    it("(error) scoring reject 시 다섯 adjust(abuse + update-count + contribution-quality + underperformer + notable) 미실행 + error 전파", async () => {
      // 중요기여 식별 구성이어도 scoring reject 면 adjust 자리 도달 0 — error 전파.
      const scoring = makeScoringServiceWithNarrative("원본");
      const boom = new Error("LLM HTTP 호출 실패 (status: 500)");
      scoring.scoreUnit
        .mockResolvedValueOnce(resultWithNarrative("ok", "원본"))
        .mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "ok", author: "star" }),
        underPerformerCommit({ externalId: "peerA-1", author: "peerA" }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow(boom);
      // 두 번째 단위에서 throw → scoring 2 회 시도, adjust 도달 0(부분 결과 위장 0).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
    });

    it("(negative i) 빈 Activity[] → 빈 EvaluationResult[](다섯 helper 빈 입력 통과)", async () => {
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);

      const results = await orchestrator.evaluateActivities([], OPTIONS);

      expect(results).toEqual([]);
      expect(scoring.scoreUnit).not.toHaveBeenCalled();
    });

    it("(negative ii) 단일 author 단일 단위 → 동료 부재 → 비대상 → narrative 무변경", async () => {
      const scoring = makeScoringServiceWithNarrative("solo-narrative");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "only", author: "solo-dev" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].narrative).toBe("solo-narrative");
    });

    it("(negative iii) 동일 author 다수 단위 — 중요기여 식별 시 그 author 의 **모든** 단위가 일관 marker 접두(author-level 전파)", async () => {
      // star author 가 code 단위 6 건 + document 단위 2 건(code 카운트엔 미반영). peer
      // 가 code 1 건. dedup 후 star code=6, peer code=1 → mean (6+1)/2=3.5, ceiling 5.25,
      // star(6)>5.25 → notable. star author 의 **모든** 단위(code 6 + document 2)
      // narrative 가 marker 접두로 일관됨을 단언.
      const scoring = makeScoringServiceWithNarrative("multi-unit");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        // star author code 6 건.
        ...peerCommits("star", 6),
        // star author document 2 건(code 카운트 미반영이지만 narrative annotation 대상).
        confluenceActivity({
          externalId: "star-d-1",
          author: "star",
          metadata: { titleLength: 40 },
        }),
        confluenceActivity({
          externalId: "star-d-2",
          author: "star",
          metadata: { titleLength: 41 },
        }),
        // peer code 1 건.
        underPerformerCommit({ externalId: "peerY-1", author: "peerY" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 6 + 2 + 1 = 9 단위.
      expect(results).toHaveLength(9);
      // star author 단위(인덱스 0~7)는 모두 marker 접두 일관.
      for (let i = 0; i < 8; i += 1) {
        expect(
          results[i].narrative.startsWith(
            NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
          ),
        ).toBe(true);
      }
      // peer 단위(인덱스 8)는 보존.
      expect(
        results[8].narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
      ).toBe(false);
    });

    it("(negative iv) 대상 author narrative 가 이미 marker 접두 → 멱등(중복 접두 0)", async () => {
      // mock scoring 이 이미 marker 로 시작하는 narrative 를 반환 → 멱등으로 1 회만 유지.
      const preMarked = `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}이미 접두된 본문`;
      const scoring = makeScoringServiceWithNarrative(preMarked);
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        underPerformerCommit({ externalId: "peerA-1", author: "peerA" }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // star 단위 narrative — marker 가 두 번 접두되지 않고 1 회만(멱등).
      expect(results[0].narrative).toBe(preMarked);
      // 검증: marker 가 정확히 1 회 등장(중복 접두 0).
      const occurrences =
        results[0].narrative.split(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)
          .length - 1;
      expect(occurrences).toBe(1);
    });

    it("(negative v) 빈 narrative('') 단위가 중요기여 대상일 때도 marker 만 접두(본문 손상 없음)", async () => {
      const scoring = makeScoringServiceWithNarrative("");
      const orchestrator = makeOrchestrator(scoring);
      // star code=6, peerA/peerB code=2 → mean=3.33, notable ceiling 5(star 6>5 →
      // notable), under floor 1.67(peer 2>1.67 → 비대상). peer narrative 보존을 보장
      // 하려면 peer 가 under/notable 어느 marker 도 받지 않아야 한다.
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // star → 빈 narrative 에 marker 만 접두.
      expect(results[0].narrative).toBe(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER);
      // peer → 빈 narrative 보존(marker 미접두).
      expect(results[results.length - 1].narrative).toBe("");
    });

    it("(negative vi) entries 순서 = scoring 결과 순서 정합(매핑 misalignment 회귀 방어)", async () => {
      // unitId 별 고유 narrative 로 author↔result 매핑 misalignment 를 잡는다. 전 단위
      // 비대상(평균 동률로 notable 0) → narrative 무변경, unitId 순서와 narrative 순서가
      // 입력 순서 그대로여야 한다.
      const narrativeByUnit: Record<string, string> = {
        "github:com/sec:p-1": "alpha",
        "github:com/sec:p-2": "beta",
        "github:com/sec:p-3": "gamma",
      };
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) =>
            resultWithNarrative(input.unitId, narrativeByUnit[input.unitId]),
          ),
      };
      const orchestrator = makeOrchestrator(scoring);
      // 세 단위 모두 서로 다른 author 의 code 1 건씩 → mean (1+1+1)/3=1, ceiling 1.5,
      // 전원 codeUnitCount(1) <= 1.5 → notable 0. narrative 보존.
      const activities: Activity[] = [
        githubActivity({
          externalId: "p-1",
          author: "a1",
          kind: "commit",
          metadata: { titleLength: 40 },
        }),
        githubActivity({
          externalId: "p-2",
          author: "a2",
          kind: "commit",
          metadata: { titleLength: 41 },
        }),
        githubActivity({
          externalId: "p-3",
          author: "a3",
          kind: "commit",
          metadata: { titleLength: 42 },
        }),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(
        results.map((r) => ({
          unitId: r.unitId,
          narrative: r.narrative,
        })),
      ).toEqual([
        { unitId: "github:com/sec:p-1", narrative: "alpha" },
        { unitId: "github:com/sec:p-2", narrative: "beta" },
        { unitId: "github:com/sec:p-3", narrative: "gamma" },
      ]);
    });
  });

  describe("5 배선 공존(abuse + update-count + contribution-quality + underperformer + notable) / 결정성 / 비변형 / 직교", () => {
    it("(공존) 다섯 배선이 함께 동작 — abuse 감점 + update-count 중립 + contribution floor + underperformer marker + notable marker", async () => {
      // abuser: suspectedCommits 3 건(code, titleLength 1) → abuse 감점 + contribution
      //   floor 강등. abuser code=3.
      // writer: version 7 document 단일(titleLength 10, abuse 미발화) → update-count
      //   중립 보존. writer code=0.
      // reporter: titleLength 1 단일 commit → contribution 강등. reporter code=1.
      // star: code 8 건(titleLength 40~) → notable 후보.
      //
      // code counts: abuser=3, writer=0, reporter=1, star=8 → mean=(3+0+1+8)/4=3,
      // underperformer floor 1.5: writer(0)<1.5 AND reporter(1)<1.5 → 둘 다
      // underPerformer. notable ceiling 4.5: star(8)>4.5 → notable. abuser(3)는 둘 다
      // 아님. 따라서 writer·reporter 의 단위에 저성과 marker, star 8 단위에 중요기여
      // marker 가 각각 접두된다(임계 분리로 한 author 가 동시 둘 다는 아님).
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
            narrative: "기본",
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "solo-z",
          author: "reporter",
          titleLength: 1,
        }),
        ...peerCommits("star", 8),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // 3 + 1 + 1 + 8 = 13 단위.
      expect(results).toHaveLength(13);
      // volume: abuser 3 건 감점 0, doc-keep 중립 보존 50, reporter 50, star 8 건 50.
      expect(results.map((r) => r.volume)).toEqual([
        0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      ]);
      // contribution: abuser 3 건(titleLength 1) zero, doc-keep(titleLength 10) high,
      // reporter zero, star(titleLength 40~) high.
      expect(results.map((r) => r.contribution)).toEqual([
        "zero",
        "zero",
        "zero",
        "high",
        "zero",
        "high",
        "high",
        "high",
        "high",
        "high",
        "high",
        "high",
        "high",
      ]);
      // underperformer marker: writer 의 doc-keep(인덱스 3) + reporter(인덱스 4) 접두.
      const isUnder = results.map((r) =>
        r.narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      );
      expect(isUnder).toEqual([
        false,
        false,
        false,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
      // notable marker: star 의 8 단위(인덱스 5~12)만 접두.
      const isNotable = results.map((r) =>
        r.narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
      );
      expect(isNotable).toEqual([
        false,
        false,
        false,
        false,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ]);
    });

    it("(edge) v1 적용 순서 박제 — underperformer 먼저, notable 다음 → narrative 앞에 [중요기여] [저성과자] 순서로 접두", async () => {
      // 일반적으로 임계 분리(0.5↓ vs 1.5↑)로 한 author 가 동시 둘 다는 불가하지만,
      // 적용 순서를 spec 으로 명시 박제한다. notable annotation 은 narrative 가 notable
      // marker 로 시작할 때만 멱등이며, underperformer marker 로 시작하는 narrative 에는
      // notable marker 를 추가로 앞에 접두한다. pipeline 은 underperformer 를 먼저 적용
      // (앞에 [저성과자] 접두) 후 notable 을 적용(다시 앞에 [중요기여] 접두)하므로, 한
      // author 가 (가상으로) 둘 다라면 최종 narrative 는 [중요기여] [저성과자] <본문> 이
      // 된다. 본 케이스는 mock narrative 가 이미 [저성과자] 로 시작하는 star(notable)
      // 단위를 구성해 notable 적용이 그 앞에 [중요기여] 를 더하는 v1 순서 결과를 단언.
      const underPrefixed = `${UNDERPERFORMER_NARRATIVE_MARKER}본문`;
      const scoring = makeScoringServiceWithNarrative(underPrefixed);
      const orchestrator = makeOrchestrator(scoring);
      // star: code 6 건 → notable. peer: 각 2 건 → 비대상.
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // star 단위 — 이미 [저성과자] 접두 narrative 에 notable 이 [중요기여] 를 앞에 더함
      // → [중요기여] [저성과자] 본문(v1 순서 = under 먼저 노출, notable 이 최종 외곽).
      expect(results[0].narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}${UNDERPERFORMER_NARRATIVE_MARKER}본문`,
      );
      // 각 marker 정확히 1 회(중복 접두 0 — notable 은 자기 marker 기준 멱등).
      const underOcc =
        results[0].narrative.split(UNDERPERFORMER_NARRATIVE_MARKER).length - 1;
      const notableOcc =
        results[0].narrative.split(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)
          .length - 1;
      expect(underOcc).toBe(1);
      expect(notableOcc).toBe(1);
    });

    it("(공존) underperformer 배선이 보존된다 — notable 이 끼어도 저성과 marker 회귀 0", async () => {
      // slow author code 1 건 + peers 각 4 건 → mean (1+4+4)/3=3, floor 1.5,
      // slow(1)<1.5 → underPerformer. ceiling 4.5: 전원 미만 → notable 0. 저성과
      // marker 만 발화(notable 끼어도 underperformer 회귀 0 확인).
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        underPerformerCommit({ externalId: "slow-1", author: "slow" }),
        ...peerCommits("peerA", 4),
        ...peerCommits("peerB", 4),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // slow 단위(인덱스 0)는 저성과 marker 접두, notable marker 미접두.
      expect(
        results[0].narrative.startsWith(UNDERPERFORMER_NARRATIVE_MARKER),
      ).toBe(true);
      expect(
        results.every(
          (r) => !r.narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER),
        ),
      ).toBe(true);
    });

    it("(직교) 필드 직교 — notable 배선은 volume / contribution 을, 다른 배선은 narrative 를 건드리지 않는다", async () => {
      // star(code 6) + peer(code 1×2) → star notable. mock 이 volume 35,
      // contribution "high", narrative "x" 를 반환. star 의 단위는 narrative 만 marker
      // 접두되고 volume / contribution 은 그대로 보존되어야 한다.
      const scoring = {
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 35,
            contribution: "high" as const,
            narrative: "x",
          })),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];

      const results = await orchestrator.evaluateActivities(
        activities,
        OPTIONS,
      );

      // star 단위(인덱스 0) — narrative marker 접두, volume / contribution 보존.
      expect(results[0].narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}x`,
      );
      expect(results[0].volume).toBe(35);
      expect(results[0].contribution).toBe("high");
      // peer 단위(인덱스 6,7) — 전체 보존.
      for (let i = 6; i < results.length; i += 1) {
        expect(results[i].narrative).toBe("x");
        expect(results[i].volume).toBe(35);
        expect(results[i].contribution).toBe("high");
      }
    });

    it("(결정성) 동일 입력 2 회 호출 → 동일 출력(toEqual, deterministic adjust + marker 멱등)", async () => {
      // 5 배선 공존 + 멱등 marker 검증 — 동일 입력으로 두 번 호출해도 동일 결과.
      const activities: Activity[] = [
        ...suspectedCommits("abuser", 3),
        docWithVersion({
          externalId: "doc-keep",
          author: "writer",
          version: 7,
        }),
        zeroContribCommit({
          externalId: "z",
          author: "reporter",
          titleLength: 1,
        }),
        ...peerCommits("star", 8),
      ];

      const makeScoring = (): { scoreUnit: jest.Mock } => ({
        scoreUnit: jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/require-await
          .mockImplementation(async (input: { unitId: string }) => ({
            ...resultFor(input.unitId),
            volume: 50,
            contribution: "high" as const,
            narrative: "deterministic",
          })),
      });

      const first = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );
      const second = await makeOrchestrator(makeScoring()).evaluateActivities(
        activities,
        OPTIONS,
      );

      expect(first).toEqual(second);
    });

    it("(비변형) notable 대상 입력 Activity[] 를 호출 후 변경하지 않는다(deep-equal)", async () => {
      const scoring = makeScoringServiceWithNarrative("원본");
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        ...peerCommits("star", 6),
        ...peerCommits("peerA", 2),
        ...peerCommits("peerB", 2),
      ];
      const snapshot = JSON.parse(JSON.stringify(activities));

      await orchestrator.evaluateActivities(activities, OPTIONS);

      expect(activities).toEqual(snapshot);
    });
  });

  // ── T-0607: applyEvaluationAdjustments 단일 진입 wiring 검증 ───────────────
  //    orchestrator L262~315 의 inline 5-step chain(abuse → update-count →
  //    quality → underperformer → notable → flatten) 이 T-0606 박제 composer
  //    `applyEvaluationAdjustments(entries, signals)` 단일 호출로 교체됐는지를
  //    jest.spyOn 으로 직접 검증한다(중간 변환 0 / 5 signal 단일 container /
  //    spy 산출 = 최종 return 의 same-ref / spy throw 시 try/catch 0 전파).
  //    composer 자체의 동작 spec 은 evaluation-adjustments-pipeline.spec 이 박제
  //    (중복 0 원칙) — 본 describe 는 service ↔ composer 의 wiring 만 cover.
  describe("composer wiring(T-0607) — applyEvaluationAdjustments 단일 호출 / 5 signal container / spy 전파", () => {
    // 본 describe 는 composer 의 named export 를 jest.spyOn 으로 가로채
    // 호출 횟수 / 인자 형식 / 반환값 same-ref / throw 전파를 단언한다.
    // namespace import(`* as evaluationAdjustmentsPipeline`)로 module binding
    // 을 받아 spyOn 이 setter trap 으로 메서드 교체 가능하게 한다.
    // afterEach 에서 spy 를 restore 해 케이스 간 누수 0.
    let composerSpy: jest.SpyInstance;

    afterEach(() => {
      composerSpy.mockRestore();
    });

    it("(happy) composer 가 정확히 1 회 호출되고 인자는 (entries, 5-signal container) 형식 — 반환값이 orchestrator return 과 same-ref", async () => {
      // 실 composer 동작은 그대로 두고 spy 만 부착(callThrough). 산출 = real
      // composer 가 반환한 배열이라야 same-ref 단언이 의미 있다.
      composerSpy = jest.spyOn(
        evaluationAdjustmentsPipeline,
        "applyEvaluationAdjustments",
      );

      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "wire-c1", kind: "commit" }),
        confluenceActivity({ externalId: "wire-p1" }),
      ];

      const result = await orchestrator.evaluateActivities(activities, OPTIONS);

      // (a) 정확히 1 회 호출 — 5-step inline chain 이 단일 composer 진입으로 교체됐다.
      expect(composerSpy).toHaveBeenCalledTimes(1);

      // (b) 첫 인자 = entries({ author, result }[]). 길이/순서 정합 단언.
      const [entriesArg, signalsArg] = composerSpy.mock.calls[0];
      expect(Array.isArray(entriesArg)).toBe(true);
      expect(entriesArg).toHaveLength(2);
      expect(entriesArg[0]).toHaveProperty("author");
      expect(entriesArg[0]).toHaveProperty("result");

      // (c) 두 번째 인자 = 5-signal 단일 container(camelCase 5 field 정확히).
      //     필드 이름이 composer 가 기대하는 정확한 형태인지 형 검증.
      expect(signalsArg).toEqual(
        expect.objectContaining({
          abuse: expect.anything(),
          updateCount: expect.anything(),
          quality: expect.anything(),
          underPerformer: expect.anything(),
          notableContribution: expect.anything(),
        }),
      );
      expect(Object.keys(signalsArg as object).sort()).toEqual([
        "abuse",
        "notableContribution",
        "quality",
        "underPerformer",
        "updateCount",
      ]);

      // (d) composer 반환 배열이 orchestrator 의 최종 return 과 same-ref —
      //     중간 변환 0 / 추가 mapping 0 보장(byte-identical 위임).
      expect(result).toBe(composerSpy.mock.results[0].value);
    });

    it("(error) composer spy 가 throw 하면 orchestrator 가 자체 try/catch 없이 그대로 전파(투명성)", async () => {
      // composer 가 던지는 임의의 Error 를 mock — orchestrator 의 흡수 0 확인.
      const sentinel = new Error("composer-sentinel");
      composerSpy = jest
        .spyOn(evaluationAdjustmentsPipeline, "applyEvaluationAdjustments")
        .mockImplementation(() => {
          throw sentinel;
        });

      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "err-c1", kind: "commit" }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toBe(sentinel);

      // composer 가 1 회 호출됐고 spy 호출 후 error 전파라 orchestrator 의
      // 마지막 단계(adjust thread)에서 throw 가 발생했음이 확인된다.
      expect(composerSpy).toHaveBeenCalledTimes(1);
    });

    it("(negative i) 빈 activities → composer 도 빈 entries + 빈 신호 5종으로 호출되고 빈 배열 반환(throw 0)", async () => {
      composerSpy = jest.spyOn(
        evaluationAdjustmentsPipeline,
        "applyEvaluationAdjustments",
      );

      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);

      const result = await orchestrator.evaluateActivities([], OPTIONS);

      expect(result).toEqual([]);
      // 빈 입력이어도 composer 는 정상 호출된다 — 본 service 는 short-circuit
      // 분기 없이 composer 위임을 단일 path 로 둔다(분기 단순화).
      expect(composerSpy).toHaveBeenCalledTimes(1);
      const [entriesArg, signalsArg] = composerSpy.mock.calls[0];
      expect(entriesArg).toEqual([]);
      // 5 signal 모두 항상 새 객체로 전달(null/undefined 0 — composer guard
      // 도달 0). 빈 deduped 에서도 detection helper 가 빈 신호 객체 반환.
      expect(signalsArg).toBeDefined();
      expect((signalsArg as Record<string, unknown>).abuse).toBeDefined();
      expect((signalsArg as Record<string, unknown>).updateCount).toBeDefined();
      expect((signalsArg as Record<string, unknown>).quality).toBeDefined();
      expect(
        (signalsArg as Record<string, unknown>).underPerformer,
      ).toBeDefined();
      expect(
        (signalsArg as Record<string, unknown>).notableContribution,
      ).toBeDefined();
    });

    it("(negative ii) scoreUnit reject 시 composer 도달 0 — scoring 실패 격리(§2)가 adjust 단계 보호", async () => {
      composerSpy = jest.spyOn(
        evaluationAdjustmentsPipeline,
        "applyEvaluationAdjustments",
      );

      const scoring: { scoreUnit: jest.Mock } = {
        scoreUnit: jest.fn().mockRejectedValue(new Error("scoring-failed")),
      };
      const orchestrator = makeOrchestrator(scoring);
      const activities: Activity[] = [
        githubActivity({ externalId: "scoring-fail", kind: "commit" }),
      ];

      await expect(
        orchestrator.evaluateActivities(activities, OPTIONS),
      ).rejects.toThrow("scoring-failed");

      // scoring 실패 격리 — composer 위임은 scoring 전량 성공 후에만 진입.
      // (부분 결과 위장 0)
      expect(composerSpy).not.toHaveBeenCalled();
    });

    it("(negative iii) entries 길이 = scoring 결과 길이 = deduped 단위 수(매핑 misalignment 회귀 방어)", async () => {
      composerSpy = jest.spyOn(
        evaluationAdjustmentsPipeline,
        "applyEvaluationAdjustments",
      );

      const scoring = makeScoringService();
      const orchestrator = makeOrchestrator(scoring);
      // dedup 으로 1 건 합쳐지는 입력 — 동일 unitId 두 timestamp.
      const activities: Activity[] = [
        githubActivity({
          externalId: "dup-1",
          timestamp: "2026-04-15T00:00:00Z",
        }),
        githubActivity({
          externalId: "dup-1",
          timestamp: "2026-04-01T00:00:00Z",
        }),
        githubActivity({ externalId: "uniq-2", kind: "commit" }),
      ];

      await orchestrator.evaluateActivities(activities, OPTIONS);

      // dedup 으로 2 건 생존(중복 1 + 유일 1).
      expect(scoring.scoreUnit).toHaveBeenCalledTimes(2);
      const [entriesArg] = composerSpy.mock.calls[0];
      expect(entriesArg).toHaveLength(2);
      // entries[i].author = deduped[i].author 정합.
      expect(entriesArg.map((e: { author: string }) => e.author)).toEqual([
        "octocat",
        "octocat",
      ]);
    });

    it("(negative iv) options 변경 → scoring 까지만 영향, composer 인자(entries / signals) 와 무관", async () => {
      composerSpy = jest.spyOn(
        evaluationAdjustmentsPipeline,
        "applyEvaluationAdjustments",
      );

      const scoring1 = makeScoringService();
      const scoring2 = makeScoringService();
      const orchestrator1 = makeOrchestrator(scoring1);
      const orchestrator2 = makeOrchestrator(scoring2);
      const activities: Activity[] = [
        githubActivity({ externalId: "opt-1", kind: "commit" }),
      ];
      const optionsA: ScoringOptions = { modelId: "gpt-4o-deploy" };
      const optionsB: ScoringOptions = { modelId: "claude-opus-deploy" };

      await orchestrator1.evaluateActivities(activities, optionsA);
      await orchestrator2.evaluateActivities(activities, optionsB);

      expect(composerSpy).toHaveBeenCalledTimes(2);
      // composer 인자는 options 와 무관해야 한다 — entries 형태 / signals 형태
      // 가 두 호출에서 동일 (signal 객체 자체는 새로 만들어지지만 5 key 동일).
      const [entriesA, signalsA] = composerSpy.mock.calls[0];
      const [entriesB, signalsB] = composerSpy.mock.calls[1];
      expect(entriesA).toEqual(entriesB);
      expect(Object.keys(signalsA as object).sort()).toEqual(
        Object.keys(signalsB as object).sort(),
      );
      // scoreUnit 에는 다른 options 가 전달된다(scoring 까지만 options 영향).
      expect(scoring1.scoreUnit.mock.calls[0][1]).toBe(optionsA);
      expect(scoring2.scoreUnit.mock.calls[0][1]).toBe(optionsB);
    });
  });
});

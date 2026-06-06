// activity-contribution.mapper 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover + VALID_SOURCE_TYPES/VALID_DIFFICULTIES 정합 +
// raw-not-stored 단언). collection slice (v-a), ADR-0029 Decision §6. live/credentialed
// test 0 — mocked 입력만(Q-0025 deferred).

import {
  VALID_DIFFICULTIES,
  VALID_SOURCE_TYPES,
} from "../../user/contribution.service";

import type { ConfluenceActivity, GithubActivity } from "./activity";
import {
  mapActivityToContribution,
  PLACEHOLDER_CONTRIBUTION_SCORE,
  PLACEHOLDER_DIFFICULTY,
  PLACEHOLDER_VOLUME,
} from "./activity-contribution.mapper";

// ContributionCreateInput 의 정확한 7 키 — raw 본문 키 부재 단언의 기준.
const EXPECTED_KEYS = [
  "assessmentId",
  "contributionScore",
  "difficulty",
  "sourceRef",
  "sourceType",
  "sourceUrl",
  "volume",
].sort();

const ASSESSMENT_ID = "assess-1";

// GithubActivity fixture 빌더 — kind 만 바꿔 분기를 검증한다.
function githubActivity(
  kind: GithubActivity["kind"],
  overrides: Partial<GithubActivity> = {},
): GithubActivity {
  return {
    externalId: "abc123sha",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    repoRef: "octo-org/octo-repo",
    kind,
    ...overrides,
  };
}

// ConfluenceActivity fixture 빌더.
function confluenceActivity(
  overrides: Partial<ConfluenceActivity> = {},
): ConfluenceActivity {
  return {
    externalId: "page-77",
    sourceType: "confluence",
    instanceKey: "eng",
    author: "accountId-1",
    timestamp: "2026-06-02T10:00:00Z",
    metadata: {},
    spaceRef: "ENG",
    version: 3,
    ...overrides,
  };
}

describe("mapActivityToContribution", () => {
  describe("happy path (R-112-1)", () => {
    it("GithubActivity(commit) 를 sourceType=commit + sourceRef=SHA 로 매핑한다", () => {
      const result = mapActivityToContribution(
        githubActivity("commit"),
        ASSESSMENT_ID,
      );
      expect(result).toEqual({
        assessmentId: "assess-1",
        sourceType: "commit",
        sourceUrl: "octo-org/octo-repo#abc123sha",
        sourceRef: "abc123sha",
        difficulty: "easy",
        contributionScore: 0,
        volume: 0,
      });
    });

    it("ConfluenceActivity 를 sourceType=document + sourceRef=id@version 로 매핑한다", () => {
      const result = mapActivityToContribution(
        confluenceActivity(),
        ASSESSMENT_ID,
      );
      expect(result).toEqual({
        assessmentId: "assess-1",
        sourceType: "document",
        sourceUrl: "ENG#page-77",
        sourceRef: "page-77@3",
        difficulty: "easy",
        contributionScore: 0,
        volume: 0,
      });
    });
  });

  describe("sourceType 분기 (R-112-3 branch — kind 별 + github/confluence discriminator)", () => {
    // GithubActivity.kind(commit/pr/issue) 각 분기 + ConfluenceActivity discriminator
    // 분기가 각각 정확한 sourceType 을 산출하는지 한 표로 cover.
    it.each([
      ["github-commit", githubActivity("commit"), "commit"],
      ["github-pr", githubActivity("pr"), "pr"],
      ["github-issue", githubActivity("issue"), "pr"],
      ["confluence", confluenceActivity(), "document"],
    ] as const)(
      "%s 분기는 sourceType=%s 로 산출한다",
      (_label, activity, expected) => {
        expect(
          mapActivityToContribution(activity, ASSESSMENT_ID).sourceType,
        ).toBe(expected);
      },
    );
  });

  describe("VALID_SOURCE_TYPES / VALID_DIFFICULTIES 정합 (R-112-2)", () => {
    it.each([
      ["github-commit", githubActivity("commit")],
      ["github-pr", githubActivity("pr")],
      ["github-issue", githubActivity("issue")],
      ["confluence", confluenceActivity()],
    ] as const)(
      "%s 의 산출 sourceType / difficulty 는 각각 허용 집합 멤버다",
      (_label, activity) => {
        const result = mapActivityToContribution(activity, ASSESSMENT_ID);
        expect(VALID_SOURCE_TYPES as readonly string[]).toContain(
          result.sourceType,
        );
        expect(VALID_DIFFICULTIES as readonly string[]).toContain(
          result.difficulty,
        );
      },
    );

    it("ADR-0029 §6 illustrative `github:commit` literal 은 산출되지 않는다", () => {
      const result = mapActivityToContribution(
        githubActivity("commit"),
        ASSESSMENT_ID,
      );
      expect(result.sourceType).not.toBe("github:commit");
    });
  });

  describe("placeholder 평가 필드 (R-112-3)", () => {
    it("difficulty/contributionScore/volume 은 placeholder 상수(easy/0/0)다", () => {
      const result = mapActivityToContribution(
        githubActivity("pr"),
        ASSESSMENT_ID,
      );
      expect(result.difficulty).toBe(PLACEHOLDER_DIFFICULTY);
      expect(result.contributionScore).toBe(PLACEHOLDER_CONTRIBUTION_SCORE);
      expect(result.volume).toBe(PLACEHOLDER_VOLUME);
      expect([
        PLACEHOLDER_DIFFICULTY,
        PLACEHOLDER_CONTRIBUTION_SCORE,
        PLACEHOLDER_VOLUME,
      ]).toEqual(["easy", 0, 0]);
    });
  });

  describe("raw-not-stored 단언 (R-112-4)", () => {
    it.each([
      [
        "github",
        githubActivity("commit") as GithubActivity | ConfluenceActivity,
      ],
      ["confluence", confluenceActivity()],
    ] as const)(
      "%s 출력 key 집합이 ContributionCreateInput 7 키로만 한정된다",
      (_label, activity) => {
        const result = mapActivityToContribution(activity, ASSESSMENT_ID);
        expect(Object.keys(result).sort()).toEqual(EXPECTED_KEYS);
      },
    );

    it("입력 metadata(보조 메타)는 출력에 누출되지 않는다", () => {
      const activity = githubActivity("pr", {
        metadata: { titleLength: 42, raw: "must not leak" },
      });
      const result = mapActivityToContribution(activity, ASSESSMENT_ID);
      expect(JSON.stringify(result)).not.toContain("must not leak");
      expect(Object.keys(result)).not.toContain("metadata");
    });
  });

  describe("경계값 / negative cases (R-112-4)", () => {
    it("Confluence version=0 경계값이 sourceRef 에 정확히 합성된다", () => {
      const result = mapActivityToContribution(
        confluenceActivity({ externalId: "p-9", version: 0 }),
        ASSESSMENT_ID,
      );
      expect(result.sourceRef).toBe("p-9@0");
    });

    it("Confluence 큰 version 경계값이 sourceRef 에 정확히 합성된다", () => {
      const result = mapActivityToContribution(
        confluenceActivity({ externalId: "p-9", version: 999999 }),
        ASSESSMENT_ID,
      );
      expect(result.sourceRef).toBe("p-9@999999");
    });

    it("assessmentId 빈 문자열은 throw 없이 그대로 pass-through 된다(검증은 service 책임)", () => {
      const result = mapActivityToContribution(githubActivity("commit"), "");
      expect(result.assessmentId).toBe("");
    });

    it("github sourceRef 는 externalId(SHA/number) 와 정확히 일치한다(issue=number)", () => {
      const result = mapActivityToContribution(
        githubActivity("issue", { externalId: "7" }),
        "임의-assessment-id-xyz",
      );
      expect(result.sourceRef).toBe("7");
      // assessmentId 임의 값 pass-through 도 함께 검증.
      expect(result.assessmentId).toBe("임의-assessment-id-xyz");
    });
  });
});

// evaluation-input.mapper 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover + contributionKind 정규화 정합 + raw-not-
// stored 단언). evaluation slice 첫 impl, ADR-0032 Decision §1. dependency 0 /
// LLM 호출 0 / mocked 입력만(순수 함수).
//
// 범위 분리 (T-0287 round 2): type-guard `isContributionKind` / const
// `CONTRIBUTION_KINDS` / `EvaluationInput` shape 의 type-level 단언은
// evaluation-input.spec.ts 가 cover — 본 spec 은 매퍼 동작에 집중.

import type {
  ConfluenceActivity,
  GithubActivity,
} from "../../assessment-collection/domain/activity";

import { CONTRIBUTION_KINDS, type EvaluationInput } from "./evaluation-input";
import { mapActivityToEvaluationInput } from "./evaluation-input.mapper";

// EvaluationInput 의 정확한 7 키 — raw 본문 키 부재 단언의 기준.
const EXPECTED_KEYS = [
  "author",
  "contributionKind",
  "instanceKey",
  "metadata",
  "sourceType",
  "timestamp",
  "unitId",
].sort();

// raw 본문 키 후보 — 본 매퍼 출력에 절대 존재하면 안 되는 키 목록(REQ-032).
const FORBIDDEN_RAW_KEYS = ["body", "diff", "html", "message", "content"];

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

describe("mapActivityToEvaluationInput", () => {
  describe("happy path (R-112-1)", () => {
    it("GithubActivity(commit) 를 contributionKind=code + unitId=sourceType:instanceKey:externalId 로 매핑한다", () => {
      const result = mapActivityToEvaluationInput(githubActivity("commit"));
      expect(result).toEqual({
        unitId: "github:sec:abc123sha",
        contributionKind: "code",
        sourceType: "github",
        instanceKey: "sec",
        author: "gildong",
        timestamp: "2026-06-01T09:00:00Z",
        metadata: {},
      });
    });

    it("GithubActivity(pr) 를 contributionKind=code 로 매핑한다", () => {
      const result = mapActivityToEvaluationInput(githubActivity("pr"));
      expect(result.contributionKind).toBe("code");
      expect(result.sourceType).toBe("github");
    });

    it("GithubActivity(issue) 를 contributionKind=document 로 매핑한다 (L82/R-30 계약)", () => {
      const result = mapActivityToEvaluationInput(githubActivity("issue"));
      expect(result.contributionKind).toBe("document");
      expect(result.sourceType).toBe("github");
    });

    it("ConfluenceActivity 를 contributionKind=document + unitId=confluence:instanceKey:pageId 로 매핑한다", () => {
      const result = mapActivityToEvaluationInput(confluenceActivity());
      expect(result).toEqual({
        unitId: "confluence:eng:page-77",
        contributionKind: "document",
        sourceType: "confluence",
        instanceKey: "eng",
        author: "accountId-1",
        timestamp: "2026-06-02T10:00:00Z",
        metadata: {},
      });
    });
  });

  describe("contributionKind 분기 (R-112-3 branch — github kind 별 + sourceType discriminator)", () => {
    // GithubActivity.kind(commit/pr/issue) 각 분기 + ConfluenceActivity
    // discriminator 분기 4 종 전부 정확한 contributionKind 를 산출하는지 한 표로 cover.
    it.each([
      ["github-commit", githubActivity("commit"), "code"],
      ["github-pr", githubActivity("pr"), "code"],
      ["github-issue", githubActivity("issue"), "document"],
      ["confluence", confluenceActivity(), "document"],
    ] as const)(
      "%s 분기는 정확한 contributionKind 를 산출한다",
      (_label, activity, expected) => {
        expect(mapActivityToEvaluationInput(activity).contributionKind).toBe(
          expected,
        );
      },
    );

    it("산출 contributionKind 는 항상 CONTRIBUTION_KINDS 멤버다 (4 분기 전수)", () => {
      const activities = [
        githubActivity("commit"),
        githubActivity("pr"),
        githubActivity("issue"),
        confluenceActivity(),
      ];
      for (const activity of activities) {
        const result = mapActivityToEvaluationInput(activity);
        expect(CONTRIBUTION_KINDS as readonly string[]).toContain(
          result.contributionKind,
        );
      }
    });
  });

  describe("unitId 합성 (R-112-3)", () => {
    it("GitHub 3 instance(com/sec/ecode) 별 unitId 가 instanceKey 로 분리된다", () => {
      const com = mapActivityToEvaluationInput(
        githubActivity("commit", { instanceKey: "com", externalId: "sha-A" }),
      );
      const sec = mapActivityToEvaluationInput(
        githubActivity("commit", { instanceKey: "sec", externalId: "sha-A" }),
      );
      const ecode = mapActivityToEvaluationInput(
        githubActivity("commit", { instanceKey: "ecode", externalId: "sha-A" }),
      );
      expect(com.unitId).toBe("github:com:sha-A");
      expect(sec.unitId).toBe("github:sec:sha-A");
      expect(ecode.unitId).toBe("github:ecode:sha-A");
      // cross-instance 충돌 차단: 동일 externalId 라도 unitId 가 모두 다르다.
      expect(new Set([com.unitId, sec.unitId, ecode.unitId]).size).toBe(3);
    });

    it("동일 externalId 라도 sourceType 이 다르면 unitId 가 다르다 (cross-source 차단)", () => {
      // GitHub 의 externalId 와 Confluence 의 externalId 가 우연히 같을 때(예: "7")
      // 도 sourceType prefix 가 충돌을 방지한다.
      const gh = mapActivityToEvaluationInput(
        githubActivity("issue", { instanceKey: "sec", externalId: "7" }),
      );
      const cf = mapActivityToEvaluationInput(
        confluenceActivity({ instanceKey: "sec", externalId: "7" }),
      );
      expect(gh.unitId).toBe("github:sec:7");
      expect(cf.unitId).toBe("confluence:sec:7");
      expect(gh.unitId).not.toBe(cf.unitId);
    });
  });

  describe("metadata 전사 (R-112-2 error/negative — scalar 4 종)", () => {
    it("metadata 가 빈 객체일 때 빈 객체로 그대로 전사된다", () => {
      const result = mapActivityToEvaluationInput(
        githubActivity("commit", { metadata: {} }),
      );
      expect(result.metadata).toEqual({});
    });

    it("metadata 의 string/number/boolean/null 4 종 scalar 가 모두 보존된다", () => {
      const result = mapActivityToEvaluationInput(
        githubActivity("pr", {
          metadata: {
            titleLength: 42,
            isDraft: false,
            label: "feature",
            assignee: null,
          },
        }),
      );
      expect(result.metadata).toEqual({
        titleLength: 42,
        isDraft: false,
        label: "feature",
        assignee: null,
      });
    });

    it("metadata 는 reference 전달이다 — 동일 객체 참조(deep copy 0)", () => {
      const meta = { titleLength: 7 };
      const activity = githubActivity("commit", { metadata: meta });
      const result = mapActivityToEvaluationInput(activity);
      expect(result.metadata).toBe(meta);
    });
  });

  describe("raw-not-stored 단언 (R-112-4)", () => {
    it.each([
      ["github-commit", githubActivity("commit")],
      ["github-pr", githubActivity("pr")],
      ["github-issue", githubActivity("issue")],
      ["confluence", confluenceActivity()],
    ] as const)(
      "%s 출력 key 집합이 EvaluationInput 7 키로만 한정된다",
      (_label, activity) => {
        const result = mapActivityToEvaluationInput(activity);
        expect(Object.keys(result).sort()).toEqual(EXPECTED_KEYS);
      },
    );

    it("raw 본문 키(body/diff/html/message/content)가 출력에 부재한다 (REQ-032 schema-level)", () => {
      const result = mapActivityToEvaluationInput(githubActivity("commit"));
      for (const forbidden of FORBIDDEN_RAW_KEYS) {
        expect(Object.keys(result)).not.toContain(forbidden);
      }
    });

    it("type-level 보장: EvaluationInput 타입에 raw 본문 키가 없다 (compile-time)", () => {
      // 본 test 는 compile-time 만 의미가 있다 — TypeScript 가 아래 할당을 거부
      // 하면 (= EvaluationInput 에 body 키가 부재해야) 본 단언이 박제된다.
      // 런타임 assertion 은 noop — Object.keys 단언은 위 it 가 수행.
      const result: EvaluationInput = mapActivityToEvaluationInput(
        githubActivity("commit"),
      );
      // @ts-expect-error — body 는 EvaluationInput 에 존재하지 않는 키
      const _bodyMustNotExist: string = result.body;
      // @ts-expect-error — diff 는 EvaluationInput 에 존재하지 않는 키
      const _diffMustNotExist: string = result.diff;
      void _bodyMustNotExist;
      void _diffMustNotExist;
      expect(true).toBe(true);
    });
  });

  describe("typed 필드 전사 (R-112-2)", () => {
    it("author / timestamp / sourceType / instanceKey 4 필드가 Activity 에서 그대로 전사된다", () => {
      const activity = githubActivity("pr", {
        author: "alice",
        timestamp: "2026-01-15T08:30:00Z",
        instanceKey: "com",
      });
      const result = mapActivityToEvaluationInput(activity);
      expect(result.author).toBe("alice");
      expect(result.timestamp).toBe("2026-01-15T08:30:00Z");
      expect(result.sourceType).toBe("github");
      expect(result.instanceKey).toBe("com");
    });

    it("Confluence 의 spaceRef / version 은 EvaluationInput 출력에 누출되지 않는다", () => {
      const result = mapActivityToEvaluationInput(
        confluenceActivity({ spaceRef: "DOCS", version: 99 }),
      );
      expect(Object.keys(result)).not.toContain("spaceRef");
      expect(Object.keys(result)).not.toContain("version");
      expect(JSON.stringify(result)).not.toContain("DOCS");
      expect(JSON.stringify(result)).not.toContain("99");
    });

    it("GitHub 의 repoRef / kind 는 EvaluationInput 출력에 누출되지 않는다", () => {
      const result = mapActivityToEvaluationInput(
        githubActivity("commit", { repoRef: "very/specific-repo" }),
      );
      expect(Object.keys(result)).not.toContain("repoRef");
      expect(Object.keys(result)).not.toContain("kind");
      expect(JSON.stringify(result)).not.toContain("very/specific-repo");
    });
  });

  describe("순수성 — 부수효과 0 / throw 0 (R-112-2 negative)", () => {
    it("동일 입력에 대해 항상 동일 출력을 산출한다 (referential transparency)", () => {
      const activity = githubActivity("issue", { externalId: "id-1" });
      const a = mapActivityToEvaluationInput(activity);
      const b = mapActivityToEvaluationInput(activity);
      expect(a).toEqual(b);
    });

    it("입력 Activity 객체를 mutate 하지 않는다 (입력 invariance)", () => {
      const activity = githubActivity("commit", {
        metadata: { titleLength: 5 },
      });
      const snapshot = JSON.stringify(activity);
      mapActivityToEvaluationInput(activity);
      expect(JSON.stringify(activity)).toBe(snapshot);
    });

    it("어떤 분기에서도 throw 하지 않는다 (4 분기 전수)", () => {
      expect(() =>
        mapActivityToEvaluationInput(githubActivity("commit")),
      ).not.toThrow();
      expect(() =>
        mapActivityToEvaluationInput(githubActivity("pr")),
      ).not.toThrow();
      expect(() =>
        mapActivityToEvaluationInput(githubActivity("issue")),
      ).not.toThrow();
      expect(() =>
        mapActivityToEvaluationInput(confluenceActivity()),
      ).not.toThrow();
    });
  });
});

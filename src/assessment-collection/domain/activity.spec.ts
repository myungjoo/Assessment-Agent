// activity.ts 의 unit test(CLAUDE.md §3.2 R-112 — 런타임 export(guard) happy/negative
// cover + 타입 contract compile-time 단언). collection slice (i), ADR-0029 Decision §2.

import {
  ACTIVITY_SOURCE_TYPES,
  Activity,
  ConfluenceActivity,
  GithubActivity,
  isActivitySourceType,
} from "./activity";

describe("ACTIVITY_SOURCE_TYPES", () => {
  it("github / confluence 2 종을 정확히 노출한다", () => {
    expect([...ACTIVITY_SOURCE_TYPES].sort()).toEqual(["confluence", "github"]);
  });
});

describe("isActivitySourceType", () => {
  it.each(["github", "confluence"])("허용 멤버(%s)에 true", (value) => {
    expect(isActivitySourceType(value)).toBe(true);
  });

  it.each(["", "GitHub", "gitlab", "bitbucket", "  github  "])(
    "비-멤버(%s)에 false(negative)",
    (value) => {
      expect(isActivitySourceType(value)).toBe(false);
    },
  );
});

describe("타입 contract(compile-time 단언)", () => {
  it("discriminated union 이 sourceType 으로 좁혀진다", () => {
    const github: GithubActivity = {
      externalId: "sha1",
      sourceType: "github",
      instanceKey: "sec",
      author: "gildong",
      timestamp: "2026-06-01T09:00:00Z",
      repoRef: "org/repo",
      kind: "commit",
      metadata: {},
    };
    const confluence: ConfluenceActivity = {
      externalId: "123",
      sourceType: "confluence",
      instanceKey: "c-sec",
      author: "acct-1",
      timestamp: "2026-06-01T09:00:00Z",
      spaceRef: "ENG",
      version: 2,
      metadata: { titleLength: 5 },
    };
    // union 으로 좁히기 — sourceType narrowing 이 변형 전용 필드를 노출.
    const items: Activity[] = [github, confluence];
    const repoRefs = items
      .filter((a): a is GithubActivity => a.sourceType === "github")
      .map((a) => a.repoRef);
    const versions = items
      .filter((a): a is ConfluenceActivity => a.sourceType === "confluence")
      .map((a) => a.version);
    expect(repoRefs).toEqual(["org/repo"]);
    expect(versions).toEqual([2]);
  });
});

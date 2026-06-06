// author-filter.spec — filterActivitiesByAuthor 순수 함수의 R-112 spec. happy / negative
// (a~f) / branch 를 분기마다 cover(ADR-0030 §2/§3 author 귀속). 순수 함수라 mock 불요 —
// 입력 literal factory 로 충분.

import type { ServiceIdentity } from "@prisma/client";

import { ConfluenceActivity, GithubActivity } from "./activity";
import { filterActivitiesByAuthor } from "./author-filter";

// githubActivity / confluenceActivity — Activity literal factory. 본 필터는 instanceKey /
// author / sourceType 만 읽으므로 나머지 필드는 고정 placeholder.
function githubActivity(
  instanceKey: string,
  author: string,
  externalId = `sha-${author}`,
): GithubActivity {
  return {
    externalId,
    sourceType: "github",
    instanceKey,
    author,
    timestamp: "2026-01-01T00:00:00Z",
    metadata: {},
    repoRef: "acme/api",
    kind: "commit",
  };
}

function confluenceActivity(
  instanceKey: string,
  author: string,
  externalId = `page-${author}`,
): ConfluenceActivity {
  return {
    externalId,
    sourceType: "confluence",
    instanceKey,
    author,
    timestamp: "2026-01-01T00:00:00Z",
    metadata: {},
    spaceRef: "ENG",
    version: 1,
  };
}

describe("filterActivitiesByAuthor", () => {
  describe("happy path", () => {
    it("Person 의 GitHub/Confluence 활동은 보존하고 무관 author 활동은 제외한다(순서 유지, 입력 미변형)", () => {
      const identities = [
        { service: "public", externalId: "gildong" },
        { service: "cloud", externalId: "acc1" },
      ];
      const activities = [
        githubActivity("public", "gildong"),
        confluenceActivity("cloud", "acc1"),
        githubActivity("public", "stranger"),
        confluenceActivity("cloud", "stranger2"),
      ];

      const result = filterActivitiesByAuthor(activities, identities);

      expect(result).toEqual([
        githubActivity("public", "gildong"),
        confluenceActivity("cloud", "acc1"),
      ]);
      // 입력 배열 미변형(원본 length 보존).
      expect(activities).toHaveLength(4);
    });

    it("다중 identity(여러 instance)는 각 externalId 가 그 instance 활동을 독립 귀속한다", () => {
      const identities = [
        { service: "public", externalId: "a" },
        { service: "sec", externalId: "b" },
      ];
      const activities = [
        githubActivity("public", "a"),
        githubActivity("sec", "b"),
      ];

      const result = filterActivitiesByAuthor(activities, identities);

      expect(result).toEqual([
        githubActivity("public", "a"),
        githubActivity("sec", "b"),
      ]);
    });
  });

  describe("negative / error path", () => {
    it("(a) 빈 serviceIdentities → 귀속 0(빈 배열, throw 0)", () => {
      const result = filterActivitiesByAuthor(
        [githubActivity("public", "gildong")],
        [],
      );

      expect(result).toEqual([]);
    });

    it("(b) author 전부 불일치 → 빈 배열(throw 0)", () => {
      const result = filterActivitiesByAuthor(
        [githubActivity("public", "someone"), confluenceActivity("cloud", "x")],
        [{ service: "public", externalId: "gildong" }],
      );

      expect(result).toEqual([]);
    });

    it("(c) cross-source 동명 false-match 방지 — GitHub 활동이 Confluence identity 로 귀속되지 않음", () => {
      // Confluence accountId 'shared' 가 GitHub login 'shared' 와 동명인 상황.
      const identities = [{ service: "cloud", externalId: "shared" }];
      const activities = [
        githubActivity("public", "shared"), // GitHub — confluence identity 와 매칭 안 됨
        confluenceActivity("cloud", "shared"), // Confluence — 매칭됨
      ];

      const result = filterActivitiesByAuthor(activities, identities);

      // GitHub 활동은 제외, Confluence 활동만 귀속.
      expect(result).toEqual([confluenceActivity("cloud", "shared")]);
    });

    it("(d) 빈 activities → 빈 배열(throw 0)", () => {
      const result = filterActivitiesByAuthor(
        [],
        [{ service: "public", externalId: "gildong" }],
      );

      expect(result).toEqual([]);
    });

    it("(e) 부분 매칭 — 같은 author 활동은 전부 보존, 다른 author 는 전부 제외", () => {
      const identities = [{ service: "public", externalId: "gildong" }];
      const activities = [
        githubActivity("public", "gildong", "sha-1"),
        githubActivity("public", "gildong", "sha-2"),
        githubActivity("public", "other", "sha-3"),
      ];

      const result = filterActivitiesByAuthor(activities, identities);

      expect(result).toEqual([
        githubActivity("public", "gildong", "sha-1"),
        githubActivity("public", "gildong", "sha-2"),
      ]);
    });

    it("(f) isPrimary=false identity 의 externalId 도 매칭된다(isPrimary 무관)", () => {
      // isPrimary 를 포함한 객체를 넘겨도 함수는 service/externalId 만 본다.
      const identity: Pick<ServiceIdentity, "service" | "externalId"> & {
        isPrimary: boolean;
      } = { service: "public", externalId: "gildong", isPrimary: false };

      const result = filterActivitiesByAuthor(
        [githubActivity("public", "gildong")],
        [identity],
      );

      expect(result).toEqual([githubActivity("public", "gildong")]);
    });
  });

  describe("branch cover", () => {
    it("같은 instance 의 2 identity(방어적) → 두 externalId 모두 귀속(externalId 집합 합집합)", () => {
      const identities = [
        { service: "public", externalId: "a" },
        { service: "public", externalId: "b" },
      ];
      const activities = [
        githubActivity("public", "a"),
        githubActivity("public", "b"),
      ];

      const result = filterActivitiesByAuthor(activities, identities);

      expect(result).toEqual([
        githubActivity("public", "a"),
        githubActivity("public", "b"),
      ]);
    });

    it("service↔instanceKey 매칭은 대소문자/공백을 정규화한다", () => {
      const result = filterActivitiesByAuthor(
        [githubActivity("Public", "gildong")],
        [{ service: "  public ", externalId: "gildong" }],
      );

      expect(result).toEqual([githubActivity("Public", "gildong")]);
    });
  });
});

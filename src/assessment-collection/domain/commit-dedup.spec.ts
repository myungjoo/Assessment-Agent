// commit-dedup 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch / negative
// cases 충분 cover). collection slice (ii), ADR-0029 Decision §4(commit SHA earliest-
// wins dedup). 부수효과 0 순수 함수만 검증 — adapter mock 0.

import { GithubActivity } from "./activity";
import { dedupGithubActivities } from "./commit-dedup";

// commit — 주어진 SHA / timestamp / repoRef 로 commit 활동 fixture 를 만든다.
function commit(
  sha: string,
  timestamp: string,
  repoRef = "octo-org/octo-repo",
): GithubActivity {
  return {
    externalId: sha,
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp,
    repoRef,
    kind: "commit",
    metadata: {},
  };
}

// pr — 주어진 number / timestamp / repoRef 로 PR 활동 fixture 를 만든다.
function pr(
  number: string,
  timestamp: string,
  repoRef = "octo-org/octo-repo",
): GithubActivity {
  return {
    externalId: number,
    sourceType: "github",
    instanceKey: "sec",
    author: "octocat",
    timestamp,
    repoRef,
    kind: "pr",
    metadata: {},
  };
}

describe("dedupGithubActivities", () => {
  describe("happy path (R-112-1)", () => {
    it("무중복 입력은 그대로(순서 보존) 반환한다", () => {
      const input = [
        commit("aaa", "2026-06-01T09:00:00Z"),
        commit("bbb", "2026-06-02T09:00:00Z"),
        pr("42", "2026-06-03T09:00:00Z"),
      ];
      const result = dedupGithubActivities(input);
      expect(result).toEqual(input);
    });

    it("빈 배열은 빈 배열을 반환한다", () => {
      expect(dedupGithubActivities([])).toEqual([]);
    });

    it("입력 배열을 변형하지 않는다(부수효과 0)", () => {
      const input = [
        commit("aaa", "2026-06-02T09:00:00Z"),
        commit("aaa", "2026-06-01T09:00:00Z"),
      ];
      const snapshot = JSON.parse(JSON.stringify(input));
      dedupGithubActivities(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe("commit SHA earliest-wins (R-112-3 branch, R-112-4 negative)", () => {
    it("같은 SHA 2건 중 첫째가 earlier 면 첫째를 유지한다(i)", () => {
      const earlier = commit("dup", "2026-06-01T09:00:00Z", "org/repo-a");
      const later = commit("dup", "2026-06-05T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([earlier, later]);
      expect(result).toEqual([earlier]);
    });

    it("같은 SHA 2건 중 둘째가 earlier 면 둘째를 유지한다(ii)", () => {
      const later = commit("dup", "2026-06-05T09:00:00Z", "org/repo-a");
      const earlier = commit("dup", "2026-06-01T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([later, earlier]);
      // earlier 항목이 살아남되, 반환 위치는 키 최초 등장(=later 의 index 0) 기준.
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(earlier);
    });

    it("같은 SHA·동일 timestamp 면 먼저 등장한 항목을 유지한다(iii tie-break)", () => {
      const first = commit("dup", "2026-06-01T09:00:00Z", "org/repo-a");
      const second = commit("dup", "2026-06-01T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([first, second]);
      expect(result).toEqual([first]);
    });

    it("같은 SHA 3건이면 최earliest 1건만 유지한다", () => {
      const a = commit("dup", "2026-06-03T09:00:00Z");
      const b = commit("dup", "2026-06-01T09:00:00Z");
      const c = commit("dup", "2026-06-02T09:00:00Z");
      const result = dedupGithubActivities([a, b, c]);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe("2026-06-01T09:00:00Z");
    });

    it("서로 다른 SHA 는 timestamp 무관하게 모두 유지된다", () => {
      const input = [
        commit("aaa", "2026-06-05T09:00:00Z"),
        commit("bbb", "2026-06-01T09:00:00Z"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });

    it("비-파싱 timestamp 는 사전식 fallback 비교로 결정적 dedup 한다", () => {
      // Date.parse 가 NaN 인 timestamp → 문자열 비교 fallback 분기 cover.
      const a = commit("dup", "zzz-invalid");
      const b = commit("dup", "aaa-invalid");
      const result = dedupGithubActivities([a, b]);
      expect(result).toHaveLength(1);
      // "aaa-invalid" < "zzz-invalid" 이므로 b 가 earlier 로 유지.
      expect(result[0].timestamp).toBe("aaa-invalid");
    });
  });

  describe("pr / issue dedup (R-112-3 branch)", () => {
    it("같은 repo·같은 PR number 는 1건으로 dedup 된다", () => {
      const input = [
        pr("42", "2026-06-01T09:00:00Z"),
        pr("42", "2026-06-02T09:00:00Z"),
      ];
      const result = dedupGithubActivities(input);
      expect(result).toHaveLength(1);
      // earlier-wins tie-break 동일 적용.
      expect(result[0].timestamp).toBe("2026-06-01T09:00:00Z");
    });

    it("다른 repo 의 동일 PR number 는 별개 활동으로 보존된다", () => {
      const input = [
        pr("42", "2026-06-01T09:00:00Z", "org/repo-a"),
        pr("42", "2026-06-01T09:00:00Z", "org/repo-b"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });

    it("같은 SHA commit 과 같은 number 의 pr 은 키가 달라 충돌하지 않는다", () => {
      const input = [
        commit("42", "2026-06-01T09:00:00Z"),
        pr("42", "2026-06-01T09:00:00Z"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });
  });
});

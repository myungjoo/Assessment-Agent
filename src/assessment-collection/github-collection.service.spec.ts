// GithubCollectionService 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). collection slice (ii), ADR-0029 Decision §3(skip-and-
// continue) + §4(SHA earliest-wins dedup). live/credentialed 수집 0 — `GithubInstanceClient`
// 는 jest mock 으로 주입(Q-0025 deferred 정합). 실 GitHub 호출 0 / 실 token 0.

import { GithubInstanceClient } from "../github/github-instance-client.service";

import {
  GithubCollectionService,
  GithubCollectionSpec,
} from "./github-collection.service";

// rawCommit / rawPr / rawIssue — adapter 가 반환하는 raw `unknown[]` 의 단일 item
// 형태(github-activity.mapper fixture 와 동형). mapper 를 실제로 통과시켜 service 의
// raw→typed→dedup flow 전체를 검증한다(mapper 는 별도 mock 0 — 순수 함수 합성 검증).
function rawCommit(sha: string, date: string): unknown {
  return {
    sha,
    commit: { author: { name: "홍길동", date } },
    author: { login: "gildong" },
  };
}

function rawPr(number: number, createdAt: string): unknown {
  return {
    number,
    title: "PR 제목",
    pull_request: { url: `https://api.github.com/pulls/${number}` },
    user: { login: "octocat" },
    created_at: createdAt,
  };
}

function rawIssue(number: number, createdAt: string): unknown {
  return {
    number,
    title: "이슈 제목",
    user: { login: "issuer" },
    created_at: createdAt,
  };
}

// makeClientMock — `requestAllPagesForInstance` 만 mock 한 `GithubInstanceClient` 를
// 만든다. handler 는 (key, path) → raw item 배열 또는 throw 를 결정한다.
function makeClientMock(handler: (key: string, path: string) => unknown[]): {
  service: GithubCollectionService;
  spy: jest.Mock;
} {
  const spy = jest.fn(
    async (key: string, path: string): Promise<unknown[]> => handler(key, path),
  );
  const client = {
    requestAllPagesForInstance: spy,
  } as unknown as GithubInstanceClient;
  return { service: new GithubCollectionService(client), spy };
}

// commits endpoint(suffix "commits")인지 path 로 판정한다.
function isCommitsPath(path: string): boolean {
  return path.endsWith("/commits");
}
function isPullsPath(path: string): boolean {
  return path.endsWith("/pulls");
}

describe("GithubCollectionService", () => {
  describe("happy path (R-112-1)", () => {
    it("단일 source 의 commits/pulls/issues 를 수집해 GithubActivity[]로 매핑한다", async () => {
      const { service, spy } = makeClientMock((_key, path) => {
        if (isCommitsPath(path))
          return [rawCommit("sha-a", "2026-06-01T09:00:00Z")];
        if (isPullsPath(path)) return [rawPr(42, "2026-06-02T10:00:00Z")];
        return [rawIssue(7, "2026-06-03T11:00:00Z")];
      });

      const spec: GithubCollectionSpec = {
        sources: [{ instanceKey: "sec", org: "octo-org", repo: "octo-repo" }],
      };
      const result = await service.collectGithubActivities(spec);

      // 3 endpoint 각각 1 item → 3 activity.
      expect(result).toHaveLength(3);
      expect(result.map((a) => a.kind).sort()).toEqual([
        "commit",
        "issue",
        "pr",
      ]);
      // 모든 활동에 호출 context(instanceKey / repoRef)가 주입됐다.
      expect(result.every((a) => a.instanceKey === "sec")).toBe(true);
      expect(result.every((a) => a.repoRef === "octo-org/octo-repo")).toBe(
        true,
      );
      // 3 endpoint × 1 source = 3 회 호출.
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it("since 지정 시 query 로 pass-through 하고, 미지정 시 query 를 보내지 않는다", async () => {
      const { service, spy } = makeClientMock(() => []);

      await service.collectGithubActivities({
        sources: [
          {
            instanceKey: "com",
            org: "o",
            repo: "r",
            since: "2026-05-01T00:00:00Z",
          },
        ],
      });
      // since 가 query 로 그대로 전달됐다(도출 0 — pass-through).
      expect(spy).toHaveBeenCalledWith("com", expect.any(String), {
        since: "2026-05-01T00:00:00Z",
      });

      spy.mockClear();
      await service.collectGithubActivities({
        sources: [{ instanceKey: "com", org: "o", repo: "r" }],
      });
      // since 미지정 → query 는 undefined.
      expect(spy).toHaveBeenCalledWith("com", expect.any(String), undefined);
    });

    it("다중 source(instance×org×repo)를 모두 enumerate 한다", async () => {
      const { service, spy } = makeClientMock(() => []);
      await service.collectGithubActivities({
        sources: [
          { instanceKey: "com", org: "o1", repo: "r1" },
          { instanceKey: "sec", org: "o2", repo: "r2" },
        ],
      });
      // 2 source × 3 endpoint = 6 회 호출.
      expect(spy).toHaveBeenCalledTimes(6);
    });
  });

  describe("dedup 통합 (R-112-3 branch, R-112-4 negative)", () => {
    it("여러 source 에서 같은 SHA 가 수집되면 earliest timestamp 1건만 남는다", async () => {
      const { service } = makeClientMock((key, path) => {
        if (!isCommitsPath(path)) return [];
        // 두 source 가 같은 SHA 를 다른 timestamp 로 반환(Fork/Rebase/Meld).
        if (key === "com")
          return [rawCommit("dup-sha", "2026-06-05T09:00:00Z")];
        return [rawCommit("dup-sha", "2026-06-01T09:00:00Z")]; // earlier
      });
      const result = await service.collectGithubActivities({
        sources: [
          { instanceKey: "com", org: "o", repo: "r" },
          { instanceKey: "sec", org: "o", repo: "r" },
        ],
      });
      // earliest-wins → 1건, earlier timestamp 유지.
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe("2026-06-01T09:00:00Z");
    });
  });

  describe("malformed skip (R-112-2)", () => {
    it("mapper 가 null 반환하는 malformed raw item 은 결과에서 걸러진다", async () => {
      const { service } = makeClientMock((_key, path) => {
        if (!isCommitsPath(path)) return [];
        return [
          rawCommit("good", "2026-06-01T09:00:00Z"),
          { not: "a valid github item" }, // 식별 필드 전무 → mapper null
          null, // 비-객체 → mapper null
        ];
      });
      const result = await service.collectGithubActivities({
        sources: [{ instanceKey: "sec", org: "o", repo: "r" }],
      });
      // good 1건만 남고 malformed 2건은 skip.
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("good");
    });
  });

  describe("skip-and-continue (R-112-2, R-112-3 branch, R-112-4 negative)", () => {
    it("한 endpoint 가 throw(권한 부족)해도 나머지 endpoint 결과는 반환한다(전체 throw 0)", async () => {
      const { service } = makeClientMock((_key, path) => {
        if (isCommitsPath(path)) {
          throw new Error("permission denied (4xx)");
        }
        if (isPullsPath(path)) return [rawPr(1, "2026-06-02T10:00:00Z")];
        return [rawIssue(2, "2026-06-03T11:00:00Z")];
      });
      const result = await service.collectGithubActivities({
        sources: [{ instanceKey: "sec", org: "o", repo: "r" }],
      });
      // commits 는 skip, pulls/issues 는 수집 → 2건.
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.kind).sort()).toEqual(["issue", "pr"]);
    });

    it("일부 source 만 throw 하는 부분 가용성 시나리오에서 가용 source 결과를 반환한다", async () => {
      const { service } = makeClientMock((key, path) => {
        if (key === "com") {
          // com instance 전 endpoint throw.
          throw new Error("instance com unavailable");
        }
        if (isCommitsPath(path))
          return [rawCommit("ok-sha", "2026-06-01T09:00:00Z")];
        return [];
      });
      const result = await service.collectGithubActivities({
        sources: [
          { instanceKey: "com", org: "o", repo: "r" },
          { instanceKey: "sec", org: "o", repo: "r" },
        ],
      });
      // com 은 전부 skip, sec 의 commit 1건만 반환.
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("ok-sha");
    });

    it("모든 source 가 throw 해도 빈 배열을 반환한다(전체 실패도 throw 0)", async () => {
      const { service } = makeClientMock(() => {
        throw new Error("all sources unavailable");
      });
      await expect(
        service.collectGithubActivities({
          sources: [
            { instanceKey: "com", org: "o", repo: "r" },
            { instanceKey: "sec", org: "o2", repo: "r2" },
          ],
        }),
      ).resolves.toEqual([]);
    });
  });

  describe("empty enumerate (R-112-2 negative)", () => {
    it("빈 source 입력이면 빈 배열을 반환하고 adapter 를 호출하지 않는다", async () => {
      const { service, spy } = makeClientMock(() => []);
      const result = await service.collectGithubActivities({ sources: [] });
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("source 는 있으나 모든 endpoint 가 빈 결과면 빈 배열을 반환한다", async () => {
      const { service } = makeClientMock(() => []);
      const result = await service.collectGithubActivities({
        sources: [{ instanceKey: "sec", org: "o", repo: "r" }],
      });
      expect(result).toEqual([]);
    });
  });
});

// GithubOrgEnumerateService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §1 mode A enumerate + per-target skip-and-continue.
// live/credentialed enumerate 0 — `GithubInstanceClient` 는 jest mock 으로 주입(Q-0025
// deferred 정합). 실 GitHub 호출 0 / 실 token 0.

import { GithubInstanceClient } from "../github/github-instance-client.service";

import { GithubOrgEnumerateTarget } from "./domain/github-repo-source";
import { GithubOrgEnumerateService } from "./github-org-repo-enumerate.service";

// repoItem — GitHub `orgs/{org}/repos` list item 의 raw 형태(mapRepoName fixture 와 동형).
function repoItem(name: string): unknown {
  return { name, full_name: `acme/${name}` };
}

// makeService — `requestAllPagesForInstance` 만 mock 한 `GithubInstanceClient` 를 주입한
// service 를 만든다. handler 는 (key, path) → raw item 배열 또는 throw 를 결정한다.
function makeService(handler: (key: string, path: string) => unknown[]): {
  service: GithubOrgEnumerateService;
  spy: jest.Mock;
} {
  const spy = jest.fn(
    async (key: string, path: string): Promise<unknown[]> => handler(key, path),
  );
  const client = {
    requestAllPagesForInstance: spy,
  } as unknown as GithubInstanceClient;
  return { service: new GithubOrgEnumerateService(client), spy };
}

describe("GithubOrgEnumerateService.enumerateRepoSources", () => {
  describe("happy path", () => {
    it("2 target 의 org repo 를 orgs/{org}/repos path 로 enumerate 해 source 로 산출한다", async () => {
      const { service, spy } = makeService((_key, path) => {
        if (path === "orgs/acme/repos")
          return [repoItem("api"), repoItem("web")];
        if (path === "orgs/beta/repos") return [repoItem("lib")];
        return [];
      });
      const targets: GithubOrgEnumerateTarget[] = [
        { instanceKey: "public", org: "acme", since: "2026-01-01T00:00:00Z" },
        { instanceKey: "sec", org: "beta", since: "2026-01-01T00:00:00Z" },
      ];

      const sources = await service.enumerateRepoSources(targets);

      expect(sources).toEqual([
        {
          instanceKey: "public",
          org: "acme",
          repo: "api",
          since: "2026-01-01T00:00:00Z",
        },
        {
          instanceKey: "public",
          org: "acme",
          repo: "web",
          since: "2026-01-01T00:00:00Z",
        },
        {
          instanceKey: "sec",
          org: "beta",
          repo: "lib",
          since: "2026-01-01T00:00:00Z",
        },
      ]);
      // 각 target 이 올바른 instanceKey + orgs/{org}/repos path 로 호출됨을 검증.
      expect(spy).toHaveBeenCalledWith("public", "orgs/acme/repos");
      expect(spy).toHaveBeenCalledWith("sec", "orgs/beta/repos");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("(f) since 지정 target → 산출 source 에 since pass-through", async () => {
      const { service } = makeService(() => [repoItem("api")]);

      const sources = await service.enumerateRepoSources([
        { instanceKey: "public", org: "acme", since: "2026-03-03T00:00:00Z" },
      ]);

      expect(sources).toEqual([
        {
          instanceKey: "public",
          org: "acme",
          repo: "api",
          since: "2026-03-03T00:00:00Z",
        },
      ]);
    });

    it("(e) since 미지정(undefined) target → 산출 source 의 since 도 undefined", async () => {
      const { service } = makeService(() => [repoItem("api")]);

      const sources = await service.enumerateRepoSources([
        { instanceKey: "public", org: "acme" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
      ]);
    });
  });

  describe("negative / error path", () => {
    it("(a) 한 target 이 throw(4xx) → 그 target skip, 나머지 source 보존(skip-and-continue)", async () => {
      const { service } = makeService((_key, path) => {
        if (path === "orgs/forbidden/repos") {
          throw new Error("403 권한 부족");
        }
        return [repoItem("api")];
      });

      const sources = await service.enumerateRepoSources([
        { instanceKey: "public", org: "forbidden" },
        { instanceKey: "public", org: "acme" },
      ]);

      // forbidden 은 throw 로 skip, acme 만 산출 — 전체 throw 0.
      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
      ]);
    });

    it("(b) 빈 targets 배열 → 빈 결과 + client 호출 0", async () => {
      const { service, spy } = makeService(() => [repoItem("api")]);

      const sources = await service.enumerateRepoSources([]);

      expect(sources).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(c) malformed item(name 누락/비-string)은 skip, 정상 repo 는 유지", async () => {
      const { service } = makeService(() => [
        repoItem("api"),
        { id: 1 }, // name/full_name 누락 → mapRepoName null
        { name: 123 }, // 비-string → null
        repoItem("web"),
      ]);

      const sources = await service.enumerateRepoSources([
        { instanceKey: "public", org: "acme" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
        { instanceKey: "public", org: "acme", repo: "web", since: undefined },
      ]);
    });

    it("(d) org repo 응답이 빈 배열 → 그 target source 0", async () => {
      const { service, spy } = makeService(() => []);

      const sources = await service.enumerateRepoSources([
        { instanceKey: "public", org: "acme" },
      ]);

      expect(sources).toEqual([]);
      // 빈 응답이어도 enumerate 호출 자체는 발생(early-return 은 빈 targets 한정).
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("branch cover", () => {
    it("try(성공) target 과 catch(skip) target 이 한 배열에 섞여도 성공분만 산출", async () => {
      const { service } = makeService((_key, path) => {
        if (path === "orgs/ok1/repos") return [repoItem("r1")];
        if (path === "orgs/bad/repos") throw new Error("down");
        if (path === "orgs/ok2/repos") return [repoItem("r2")];
        return [];
      });

      const sources = await service.enumerateRepoSources([
        { instanceKey: "k", org: "ok1" },
        { instanceKey: "k", org: "bad" },
        { instanceKey: "k", org: "ok2" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "k", org: "ok1", repo: "r1", since: undefined },
        { instanceKey: "k", org: "ok2", repo: "r2", since: undefined },
      ]);
    });
  });
});

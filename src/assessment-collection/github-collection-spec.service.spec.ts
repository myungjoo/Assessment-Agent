// GithubCollectionSpecService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §1 mode B+A 결합 + §2 Person→instance 매핑.
// resolveGithubInstances / resolveGithubRepoSources(순수 함수)는 실제로 통과시키고
// GithubOrgEnumerateService(async)만 jest mock 으로 주입한다(Q-0025 deferred 정합 —
// 실 GitHub 호출 0 / 실 token 0). env 는 임의 map literal 로 주입(실 process.env 의존 0).

import { GithubOrgEnumerateTarget } from "./domain/github-repo-source";
import { GithubCollectionSpecService } from "./github-collection-spec.service";
import { GithubRepoSource } from "./github-collection.service";
import { GithubOrgEnumerateService } from "./github-org-repo-enumerate.service";

// ENV_MIXED — public(mode B: _REPOS 설정) + sec(mode A: _REPOS 미설정) 혼합 env.
const ENV_MIXED: NodeJS.ProcessEnv = {
  GITHUB_INSTANCES: "public sec",
  GITHUB_PUBLIC_HOST: "github.com",
  GITHUB_PUBLIC_TOKEN_ENC: "enc-public",
  GITHUB_PUBLIC_ORG: "acme",
  GITHUB_PUBLIC_REPOS: "acme/api",
  GITHUB_SEC_HOST: "github.sec.samsung.net",
  GITHUB_SEC_TOKEN_ENC: "enc-sec",
  GITHUB_SEC_ORG: "secorg",
};

// makeService — GithubOrgEnumerateService.enumerateRepoSources 만 mock 한 service 를 만든다.
function makeService(
  env: NodeJS.ProcessEnv,
  handler: (
    targets: GithubOrgEnumerateTarget[],
  ) => GithubRepoSource[] | Promise<GithubRepoSource[]>,
): { service: GithubCollectionSpecService; spy: jest.Mock } {
  const spy = jest.fn(
    async (targets: GithubOrgEnumerateTarget[]): Promise<GithubRepoSource[]> =>
      handler(targets),
  );
  const enumerateService = {
    enumerateRepoSources: spy,
  } as unknown as GithubOrgEnumerateService;
  return {
    service: new GithubCollectionSpecService(enumerateService, env),
    spy,
  };
}

describe("GithubCollectionSpecService.buildGithubCollectionSpec", () => {
  describe("happy path", () => {
    it("mode B + mode A 가 섞인 Person 의 source 를 결합(B 먼저)하고 since 를 pass-through 한다", async () => {
      const since = "2026-01-01T00:00:00Z";
      const { service, spy } = makeService(ENV_MIXED, () => [
        { instanceKey: "sec", org: "secorg", repo: "svc", since },
      ]);

      const spec = await service.buildGithubCollectionSpec(
        { serviceIdentities: [{ service: "public" }, { service: "sec" }] },
        since,
      );

      // mode B(public/acme/api) 먼저, 그 다음 mode A enumerate 결과(sec/secorg/svc).
      expect(spec.sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since },
        { instanceKey: "sec", org: "secorg", repo: "svc", since },
      ]);
      // mode A enumerate 는 sec 의 orgEnumerateTarget 으로 호출됨.
      expect(spy).toHaveBeenCalledWith([
        { instanceKey: "sec", org: "secorg", since },
      ]);
    });
  });

  describe("negative / error path", () => {
    it("(a) 매칭 GitHub instance 부재(빈 serviceIdentities) → 빈 sources + enumerate 호출 0", async () => {
      const { service, spy } = makeService(ENV_MIXED, () => [
        { instanceKey: "x", org: "y", repo: "z" },
      ]);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [],
      });

      expect(spec.sources).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(a') unmatched service identity → 빈 sources + enumerate 호출 0", async () => {
      const { service, spy } = makeService(ENV_MIXED, () => []);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "nonexistent" }],
      });

      expect(spec.sources).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(b) mode B-only(allowlist 만) → orgEnumerateTargets 빈 → enumerate 호출 skip, sources = mode B 만", async () => {
      const envBOnly: NodeJS.ProcessEnv = {
        GITHUB_INSTANCES: "public",
        GITHUB_PUBLIC_HOST: "github.com",
        GITHUB_PUBLIC_TOKEN_ENC: "enc",
        GITHUB_PUBLIC_ORG: "acme",
        GITHUB_PUBLIC_REPOS: "acme/api beta/web",
      };
      const { service, spy } = makeService(envBOnly, () => []);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "public" }],
      });

      expect(spec.sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
        { instanceKey: "public", org: "beta", repo: "web", since: undefined },
      ]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(c) mode A-only(allowlist 빈) → mode B 0, mode A enumerate 결과만", async () => {
      const envAOnly: NodeJS.ProcessEnv = {
        GITHUB_INSTANCES: "sec",
        GITHUB_SEC_HOST: "github.sec.samsung.net",
        GITHUB_SEC_TOKEN_ENC: "enc",
        GITHUB_SEC_ORG: "secorg",
      };
      const { service, spy } = makeService(envAOnly, () => [
        { instanceKey: "sec", org: "secorg", repo: "svc", since: undefined },
      ]);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "sec" }],
      });

      expect(spec.sources).toEqual([
        { instanceKey: "sec", org: "secorg", repo: "svc", since: undefined },
      ]);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("(d) enumerate 가 throw → mode A 를 빈 배열로 흡수, mode B sources 보존(부분 가용성)", async () => {
      const { service } = makeService(ENV_MIXED, () => {
        throw new Error("enumerate 실패");
      });

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "public" }, { service: "sec" }],
      });

      // mode A 는 throw 로 흡수(빈 배열), mode B(public/acme/api)만 보존 — 전체 throw 0.
      expect(spec.sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
      ]);
    });

    it("(e) since 미지정(undefined) → 산출 source 의 since 도 undefined", async () => {
      const { service } = makeService(ENV_MIXED, () => [
        { instanceKey: "sec", org: "secorg", repo: "svc", since: undefined },
      ]);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "public" }, { service: "sec" }],
      });

      expect(spec.sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
        { instanceKey: "sec", org: "secorg", repo: "svc", since: undefined },
      ]);
    });

    it("(f) since 지정 → mode B target 에 since pass-through(enumerate 에 넘긴 target 에도)", async () => {
      const since = "2026-05-05T00:00:00Z";
      const { service, spy } = makeService(ENV_MIXED, () => []);

      await service.buildGithubCollectionSpec(
        { serviceIdentities: [{ service: "sec" }] },
        since,
      );

      // sec(mode A)의 orgEnumerateTarget 에 since 가 pass-through 되어 enumerate 에 전달됨.
      expect(spy).toHaveBeenCalledWith([
        { instanceKey: "sec", org: "secorg", since },
      ]);
    });
  });

  describe("env 주입 기본값 분기", () => {
    it("env 미주입 시 process.env 기본값을 사용한다(테스트 env 엔 GITHUB_INSTANCES 부재 → 빈 sources)", async () => {
      const spy = jest.fn(async (): Promise<GithubRepoSource[]> => []);
      const enumerateService = {
        enumerateRepoSources: spy,
      } as unknown as GithubOrgEnumerateService;
      // env 인자 생략 → @Optional 기본값 process.env 경로(테스트 env 엔 GITHUB_* 미설정).
      const service = new GithubCollectionSpecService(enumerateService);

      const spec = await service.buildGithubCollectionSpec({
        serviceIdentities: [{ service: "public" }],
      });

      expect(spec.sources).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

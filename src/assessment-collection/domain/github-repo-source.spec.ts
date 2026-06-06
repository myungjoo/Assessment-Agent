// github-repo-source.spec — resolveGithubRepoSources 순수 함수의 R-112 spec.
// happy / error·negative / branch / flow 를 분기마다 cover 한다(ADR-0030 §6 negative
// 목록 정합). 순수 함수라 공유 mock 불요 — 입력 객체 literal 로 충분(부수효과 0).

import type { GithubInstanceConfig } from "../../github/github-instance-config";

import { resolveGithubRepoSources } from "./github-repo-source";

// makeInstance — 테스트용 GithubInstanceConfig literal 빌더. 필수 필드만 받고 나머지는
// 본 함수가 보지 않는 host/tokenEnc 에 placeholder 를 채운다(실값 0 — §9).
function makeInstance(
  partial: Partial<GithubInstanceConfig> & { key: string },
): GithubInstanceConfig {
  return {
    key: partial.key,
    host: partial.host ?? "github.example.test",
    orgs: partial.orgs ?? [],
    repos: partial.repos ?? [],
    tokenEnc: partial.tokenEnc ?? "enc-placeholder",
  };
}

describe("resolveGithubRepoSources", () => {
  describe("happy path — 모드 B allowlist 산출", () => {
    it("org/repo 토큰 + bare repo 토큰을 매칭 instance 에서 올바른 source 로 산출하고 since 를 pass-through 한다", () => {
      const instances = [
        makeInstance({
          key: "public",
          orgs: ["acme", "beta"],
          repos: ["acme/api", "shared-lib"],
        }),
      ];
      const since = "2026-01-01T00:00:00Z";

      const { sources, orgEnumerateTargets } = resolveGithubRepoSources(
        instances,
        [{ service: "public" }],
        since,
      );

      // org/repo 토큰 1 개 + bare repo × orgs 2 개 = source 3 개.
      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since },
        { instanceKey: "public", org: "acme", repo: "shared-lib", since },
        { instanceKey: "public", org: "beta", repo: "shared-lib", since },
      ]);
      // 모드 B 만 있으므로 enumerate target 0.
      expect(orgEnumerateTargets).toEqual([]);
    });

    it("대소문자/공백이 달라도 service↔key 를 정규화 매칭한다", () => {
      const instances = [
        makeInstance({ key: "Sec", orgs: ["org1"], repos: ["org1/repo1"] }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "  SEC " },
      ]);

      expect(sources).toEqual([
        { instanceKey: "Sec", org: "org1", repo: "repo1", since: undefined },
      ]);
    });
  });

  describe("negative / error path", () => {
    it("(a) 매칭 instance 가 없는 ServiceIdentity 는 skip — 빈 결과 + throw 0", () => {
      const instances = [makeInstance({ key: "public", repos: ["o/r"] })];

      const call = () =>
        resolveGithubRepoSources(instances, [{ service: "nonexistent" }]);

      expect(call).not.toThrow();
      const { sources, orgEnumerateTargets } = call();
      expect(sources).toEqual([]);
      expect(orgEnumerateTargets).toEqual([]);
    });

    it("(b) 빈 ServiceIdentity 배열 → 빈 sources + 빈 targets", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["o"], repos: ["o/r"] }),
      ];

      const result = resolveGithubRepoSources(instances, []);

      expect(result).toEqual({ sources: [], orgEnumerateTargets: [] });
    });

    it("(c) 모드 A(빈 allowlist) 매칭 instance → source 0, orgEnumerateTargets 로만 노출", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["acme", "beta"], repos: [] }),
      ];
      const since = "2026-02-02T00:00:00Z";

      const { sources, orgEnumerateTargets } = resolveGithubRepoSources(
        instances,
        [{ service: "public" }],
        since,
      );

      expect(sources).toEqual([]);
      expect(orgEnumerateTargets).toEqual([
        { instanceKey: "public", org: "acme", since },
        { instanceKey: "public", org: "beta", since },
      ]);
    });

    it("(c') 모드 A 인데 orgs 0 개 → source 0 + target 0(enumerate 불가)", () => {
      const instances = [makeInstance({ key: "public", orgs: [], repos: [] })];

      const result = resolveGithubRepoSources(instances, [
        { service: "public" },
      ]);

      expect(result).toEqual({ sources: [], orgEnumerateTargets: [] });
    });

    it("(d) bare repo 토큰 + instance orgs 0 개 → 그 토큰 skip(산출 불가)", () => {
      const instances = [
        makeInstance({ key: "public", orgs: [], repos: ["lonely-repo"] }),
      ];

      const { sources, orgEnumerateTargets } = resolveGithubRepoSources(
        instances,
        [{ service: "public" }],
      );

      expect(sources).toEqual([]);
      expect(orgEnumerateTargets).toEqual([]);
    });

    it("(e) malformed 슬래시 토큰(다중 슬래시 / 빈 org / 빈 repo / lone slash)은 skip", () => {
      const instances = [
        makeInstance({
          key: "public",
          orgs: ["acme"],
          repos: ["a/b/c", "/repo", "org/", "/", "good/one"],
        }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "public" },
      ]);

      // malformed 4 개는 전부 skip, 정상 토큰 1 개만 산출.
      expect(sources).toEqual([
        { instanceKey: "public", org: "good", repo: "one", since: undefined },
      ]);
    });

    it("(e') 빈/공백 bare 토큰은 skip(방어적 — slice i 가 이미 제거하지만 throw 0 보장)", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["acme"], repos: ["   ", "ok"] }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "public" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "ok", since: undefined },
      ]);
    });

    it("(f) since 미지정(undefined) → 산출 source 의 since 도 undefined", () => {
      const instances = [makeInstance({ key: "public", repos: ["acme/api"] })];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "public" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "public", org: "acme", repo: "api", since: undefined },
      ]);
    });
  });

  describe("flow / branch cover", () => {
    it("매칭 분기 — 일부 instance 만 매칭(나머지는 미처리)", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["a"], repos: ["a/r1"] }),
        makeInstance({ key: "sec", orgs: ["b"], repos: ["b/r2"] }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "sec" },
      ]);

      // public 은 identity 가 안 가리키므로 미처리 — sec 만 산출.
      expect(sources).toEqual([
        { instanceKey: "sec", org: "b", repo: "r2", since: undefined },
      ]);
    });

    it("모드 A + 모드 B 가 instance 단위로 독립 공존한다", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["a"], repos: ["a/r1"] }), // 모드 B
        makeInstance({ key: "sec", orgs: ["b"], repos: [] }), // 모드 A
      ];

      const { sources, orgEnumerateTargets } = resolveGithubRepoSources(
        instances,
        [{ service: "public" }, { service: "sec" }],
      );

      expect(sources).toEqual([
        { instanceKey: "public", org: "a", repo: "r1", since: undefined },
      ]);
      expect(orgEnumerateTargets).toEqual([
        { instanceKey: "sec", org: "b", since: undefined },
      ]);
    });

    it("동일 instance 에 다중 identity 가 매칭돼도 1 회만 처리한다(중복 source 방지)", () => {
      const instances = [
        makeInstance({ key: "public", orgs: ["a"], repos: ["a/r1"] }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "public" },
        { service: "PUBLIC" },
      ]);

      expect(sources).toEqual([
        { instanceKey: "public", org: "a", repo: "r1", since: undefined },
      ]);
    });

    it("입력 instances 에 동일 key config 가 중복돼도 1 회만 처리한다(방어적 dedup)", () => {
      // 정상 경로에서는 resolveGithubInstances 가 이미 dedupe 하지만, 본 함수는 입력
      // dedup 을 가정하지 않고 방어적으로 동일 정규화 key 의 2 번째 config 를 skip 한다.
      const instances = [
        makeInstance({ key: "public", orgs: ["a"], repos: ["a/r1"] }),
        makeInstance({ key: "PUBLIC", orgs: ["a"], repos: ["a/r2"] }),
      ];

      const { sources } = resolveGithubRepoSources(instances, [
        { service: "public" },
      ]);

      // 두 번째 동일-key config 는 skip — 첫 config 의 source 만 산출.
      expect(sources).toEqual([
        { instanceKey: "public", org: "a", repo: "r1", since: undefined },
      ]);
    });
  });
});

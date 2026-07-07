// realdata-e2e-github-collection-live.spec.ts — T-0806 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: gating enabled(github PAT + Ollama 5 종 present) + myungjoo/leemgs
//     seed → 대상 username·api base URL·endpoint path·Authorization 헤더 present·
//     결정론 구조 반환.
//   - flow/branch: gating enabled/disabled 분기 각 1+(disabled → 빈 plan). seed 대상이
//     1 명/2 명 분기 각 1+. primary vs 첫 identity 선택 분기.
//   - error/negative 충분 cover: (a) github PAT env 부재 → enabled false → 빈 plan,
//     (b) Ollama 5 종 중 1 개 부재 → enabled false, (c) 빈 seed → 빈 plan,
//     (d) PAT 빈 문자열 → enabled false, (e) 입력 env/seed 배열 비변형(부수효과 0),
//     gating null/비객체 TypeError, seeds 비배열 TypeError, github identity 부재 throw,
//     externalId 빈/공백 throw.
//   - R-59: plan entry 는 raw PAT 값·raw 활동 본문 미포함(hasAuthorizationHeader boolean
//     만, entry 키 집합 고정).
import { resolveGithubApiBaseUrl } from "../../src/github/github-request.builder";

import { buildRealDataGithubCollectionPlan } from "./realdata-e2e-github-collection-live";
import { resolveRealDataE2eLiveGating } from "./realdata-e2e-live-gating";
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";

// gating enabled 를 만드는 완전한 mock env(7 종 present). 실 credential 값 0 — 더미 토큰만.
const FULL_ENV: NodeJS.ProcessEnv = {
  REALDATA_E2E_LIVE_TEST: "1",
  REALDATA_E2E_LLM_BASE_URL: "http://localhost:11434/v1",
  REALDATA_E2E_LLM_API_KEY: "dummy-key",
  REALDATA_E2E_LLM_MODEL: "dummy-model",
  REALDATA_E2E_LLM_PROVIDER: "openai-compatible",
  REALDATA_E2E_LLM_API_VERSION: "2024-01-01",
  REALDATA_E2E_GITHUB_READ_PAT: "dummy-pat",
};

// 단일 seed descriptor(1 명 대상 분기 cover 용).
const SINGLE_SEED: RealDataSeedDescriptor = {
  person: { fullName: "solo", email: "solo@x.test", active: true },
  serviceIdentities: [
    { service: "github.com", externalId: "solouser", isPrimary: true },
  ],
};

describe("buildRealDataGithubCollectionPlan", () => {
  describe("happy path (gating enabled + myungjoo/leemgs seed)", () => {
    it("2 명 대상·Authorization present·결정론 구조를 반환한다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seeds = buildRealDataE2eSeed();

      const plan = buildRealDataGithubCollectionPlan(gating, seeds);

      const apiBase = resolveGithubApiBaseUrl("github.com");
      expect(plan).toEqual({
        enabled: true,
        entries: [
          {
            username: "myungjoo",
            host: "github.com",
            apiBaseUrl: apiBase,
            path: "/users/myungjoo/events/public",
            hasAuthorizationHeader: true,
          },
          {
            username: "leemgs",
            host: "github.com",
            apiBaseUrl: apiBase,
            path: "/users/leemgs/events/public",
            hasAuthorizationHeader: true,
          },
        ],
      });
    });

    it("api base URL 은 resolveGithubApiBaseUrl(github.com) 재사용 값이다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      for (const entry of plan.entries) {
        expect(entry.apiBaseUrl).toBe("https://api.github.com");
      }
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 disabled) gating.enabled=false → 빈 plan(entries 0)", () => {
      const gating = resolveRealDataE2eLiveGating({}); // env 전부 부재
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(plan).toEqual({ enabled: false, entries: [] });
    });

    it("(분기 enabled) gating.enabled=true → entries 2 건", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(plan.enabled).toBe(true);
      expect(plan.entries).toHaveLength(2);
    });

    it("(분기 대상 1 명) 단일 seed → entries 1 건", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(gating, [SINGLE_SEED]);
      expect(plan.entries).toHaveLength(1);
      expect(plan.entries[0].username).toBe("solouser");
    });

    it("(분기 대상 2 명) 2 seed → entries 2 건·순서 보존", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(plan.entries.map((e) => e.username)).toEqual([
        "myungjoo",
        "leemgs",
      ]);
    });

    it("(분기 빈 seed) enabled 여도 빈 seed → 빈 entries", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(gating, []);
      expect(plan).toEqual({ enabled: true, entries: [] });
    });

    it("(분기 primary 선택) primary 아닌 identity 가 앞에 있어도 primary 를 대상으로 뽑는다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed: RealDataSeedDescriptor = {
        person: { fullName: "p", email: "p@x.test", active: true },
        serviceIdentities: [
          { service: "github.com", externalId: "secondary", isPrimary: false },
          { service: "github.com", externalId: "primaryone", isPrimary: true },
        ],
      };
      const plan = buildRealDataGithubCollectionPlan(gating, [seed]);
      expect(plan.entries[0].username).toBe("primaryone");
    });

    it("(분기 primary 부재) primary 가 없으면 첫 github.com identity 를 대상으로 뽑는다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed: RealDataSeedDescriptor = {
        person: { fullName: "np", email: "np@x.test", active: true },
        serviceIdentities: [
          { service: "github.com", externalId: "firstone", isPrimary: false },
          { service: "github.com", externalId: "secondtwo", isPrimary: false },
        ],
      };
      const plan = buildRealDataGithubCollectionPlan(gating, [seed]);
      expect(plan.entries[0].username).toBe("firstone");
    });
  });

  describe("negative cases (충분 cover — 각 1+)", () => {
    it("(a) github PAT env 부재 → enabled false → 빈 plan(실 호출 대상 0)", () => {
      const noPat = { ...FULL_ENV };
      delete noPat.REALDATA_E2E_GITHUB_READ_PAT;
      const gating = resolveRealDataE2eLiveGating(noPat);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(gating.enabled).toBe(false);
      expect(plan).toEqual({ enabled: false, entries: [] });
    });

    it("(b) Ollama 5 종 중 1 개(BASE_URL) 부재 → enabled false → 빈 plan", () => {
      const noBase = { ...FULL_ENV };
      delete noBase.REALDATA_E2E_LLM_BASE_URL;
      const gating = resolveRealDataE2eLiveGating(noBase);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(gating.enabled).toBe(false);
      expect(plan.entries).toHaveLength(0);
    });

    it("(c) 빈 seed descriptor → enabled 여도 빈 plan", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      expect(
        buildRealDataGithubCollectionPlan(gating, []).entries,
      ).toHaveLength(0);
    });

    it("(d) PAT 는 있으나 빈 문자열 → enabled false(수집 leg 진입 불가)", () => {
      const gating = resolveRealDataE2eLiveGating({
        ...FULL_ENV,
        REALDATA_E2E_GITHUB_READ_PAT: "   ",
      });
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(gating.enabled).toBe(false);
      expect(plan.entries).toHaveLength(0);
    });

    it("gating 이 null → 한국어 메시지 TypeError", () => {
      expect(() =>
        buildRealDataGithubCollectionPlan(
          null as unknown as ReturnType<typeof resolveRealDataE2eLiveGating>,
          buildRealDataE2eSeed(),
        ),
      ).toThrow(/gating 이 null/);
    });

    it("gating 이 undefined → TypeError", () => {
      expect(() =>
        buildRealDataGithubCollectionPlan(
          undefined as unknown as ReturnType<
            typeof resolveRealDataE2eLiveGating
          >,
          buildRealDataE2eSeed(),
        ),
      ).toThrow(TypeError);
    });

    it("seeds 가 배열이 아님(undefined) → 한국어 메시지 TypeError", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      expect(() =>
        buildRealDataGithubCollectionPlan(
          gating,
          undefined as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seeds 가 배열이 아닙니다/);
    });

    it("seeds 가 배열이 아님(null) → TypeError", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      expect(() =>
        buildRealDataGithubCollectionPlan(
          gating,
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);
    });

    it("enabled=true 인데 github.com identity 부재 seed → 명시적 throw", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed = {
        person: { fullName: "x", email: "x@x.test", active: true },
        serviceIdentities: [],
      } as unknown as RealDataSeedDescriptor;
      expect(() => buildRealDataGithubCollectionPlan(gating, [seed])).toThrow(
        /github\.com serviceIdentity 가 없습니다/,
      );
    });

    it("enabled=true 인데 externalId 빈 문자열 → 명시적 throw", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed: RealDataSeedDescriptor = {
        person: { fullName: "e", email: "e@x.test", active: true },
        serviceIdentities: [
          { service: "github.com", externalId: "", isPrimary: true },
        ],
      };
      expect(() => buildRealDataGithubCollectionPlan(gating, [seed])).toThrow(
        /username.*비어있거나 공백뿐/,
      );
    });

    it("enabled=true 인데 externalId 공백뿐 → 명시적 throw", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed: RealDataSeedDescriptor = {
        person: { fullName: "w", email: "w@x.test", active: true },
        serviceIdentities: [
          { service: "github.com", externalId: "   ", isPrimary: true },
        ],
      };
      expect(() => buildRealDataGithubCollectionPlan(gating, [seed])).toThrow(
        /공백뿐/,
      );
    });

    it("seed 가 비객체(serviceIdentities 비배열) → TypeError", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seed = {
        person: { fullName: "b", email: "b@x.test", active: true },
        serviceIdentities: "not-array",
      } as unknown as RealDataSeedDescriptor;
      expect(() => buildRealDataGithubCollectionPlan(gating, [seed])).toThrow(
        TypeError,
      );
    });
  });

  describe("입력 비변형 / 순수성 (부수효과 0)", () => {
    it("(e) 호출 후 입력 env 객체가 mutate 되지 않는다", () => {
      const env = { ...FULL_ENV };
      const envSnapshot = JSON.stringify(env);
      const gating = resolveRealDataE2eLiveGating(env);
      buildRealDataGithubCollectionPlan(gating, buildRealDataE2eSeed());
      expect(JSON.stringify(env)).toBe(envSnapshot);
    });

    it("호출 후 입력 seed 배열·중첩 객체가 mutate 되지 않는다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seeds = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seeds);
      buildRealDataGithubCollectionPlan(gating, seeds);
      expect(JSON.stringify(seeds)).toBe(snapshot);
    });

    it("반환 plan 을 mutate 해도 원본 seed 가 오염되지 않는다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataGithubCollectionPlan(gating, seeds);
      plan.entries[0].username = "TAMPERED";
      plan.entries.push({
        username: "extra",
        host: "github.com",
        apiBaseUrl: "https://api.github.com",
        path: "/users/extra/events/public",
        hasAuthorizationHeader: false,
      });
      expect(seeds[0].serviceIdentities[0].externalId).toBe("myungjoo");
      expect(seeds[0].serviceIdentities).toHaveLength(1);
    });

    it("(무공유) 호출마다 새 객체 트리를 반환한다", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataGithubCollectionPlan(gating, seeds);
      const b = buildRealDataGithubCollectionPlan(gating, seeds);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.entries).not.toBe(b.entries);
      expect(a.entries[0]).not.toBe(b.entries[0]);
    });
  });

  describe("(R-59 / §9) raw credential·활동 데이터 미포함", () => {
    it("plan entry 는 raw PAT 값을 담지 않는다 — hasAuthorizationHeader boolean 만", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      const serialized = JSON.stringify(plan);
      // 더미 PAT 값이 plan 어디에도 새지 않는다(§9 — 존재 boolean 만).
      expect(serialized).not.toContain("dummy-pat");
      for (const entry of plan.entries) {
        expect(typeof entry.hasAuthorizationHeader).toBe("boolean");
      }
    });

    it("plan entry 는 고정된 키 집합만 가진다(raw 활동 필드 0)", () => {
      const gating = resolveRealDataE2eLiveGating(FULL_ENV);
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      for (const entry of plan.entries) {
        expect(Object.keys(entry).sort()).toEqual([
          "apiBaseUrl",
          "hasAuthorizationHeader",
          "host",
          "path",
          "username",
        ]);
      }
    });
  });
});

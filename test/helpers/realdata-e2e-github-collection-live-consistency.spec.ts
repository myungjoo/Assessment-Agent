// realdata-e2e-github-collection-live-consistency.spec.ts — T-0984 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 실제 `buildRealDataGithubCollectionPlan` 출력을 가드에 넘겨 정합 시 void —
//     (i) enabled=true 다중 seed fixture, (ii) enabled=false fixture, (iii) label 인자 branch.
//   - error path: plan 구조 결손(비객체/null / enabled 비-boolean / entries 비-배열) → TypeError.
//   - flow/branch: (a) enabled=false 빈 plan, (b) enabled=true 다중 seed, (c) hasAuthHeader
//     true/false 두 분기, (d) primary-우선 선택 두 경로(primary 존재 / 부재→첫 identity).
//   - negative 충분 cover: producer 정합 plan 을 얕은 복제 후 한 슬롯만 손상 → 각 RangeError —
//     (a) host, (b) path(public 누락), (c) apiBaseUrl, (d) username, (e) hasAuthHeader 반전,
//     (f) entries 길이 불일치(누락/과잉), (g) enabled=false 인데 entries 비어있지 않음.
//   - §9 secret-safety: fixture/plan/에러 메시지 어디에도 실 PAT 미노출(더미 string · boolean만).
//   - neutral 재유도: oracle 소스가 producer 를 runtime import 하지 않고 type-only 만 씀 assert.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildRealDataGithubCollectionPlan } from "./realdata-e2e-github-collection-live";
import type { RealDataE2eGithubCollectionPlan } from "./realdata-e2e-github-collection-live";
import { assertRealDataGithubCollectionPlanConsistent } from "./realdata-e2e-github-collection-live-consistency";
import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// §9 격리: githubPat 은 비시크릿 더미 평문(실 PAT 아님). 어느 fixture 도 실 credential 미보유.
const DUMMY_PAT = "dummy-pat-value-1234";

// gating enabled=true + githubPat 존재 → hasAuthorizationHeader=true 분기.
const GATING_ENABLED_WITH_PAT: RealDataE2eLiveGating = {
  enabled: true,
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "dummy-key",
    model: "dummy-model",
    provider: "openai-compatible",
    apiVersion: "2024-01-01",
  },
  githubPat: DUMMY_PAT,
  reason: "fixture — 활성",
};

// gating enabled=true + githubPat 공백 → hasAuthorizationHeader=false 분기(방어적 존재 판정).
const GATING_ENABLED_BLANK_PAT: RealDataE2eLiveGating = {
  enabled: true,
  githubPat: "   ",
  reason: "fixture — 활성이나 PAT 공백",
};

// gating disabled → 빈 plan 분기.
const GATING_DISABLED: RealDataE2eLiveGating = {
  enabled: false,
  reason: "fixture — skip",
};

const SEEDS: RealDataSeedDescriptor[] = buildRealDataE2eSeed();

describe("assertRealDataGithubCollectionPlanConsistent", () => {
  describe("happy path — 실제 producer 출력 정합 → void(throw 0)", () => {
    it("(i) enabled=true 다중 seed → seed 당 entry 정합 통과", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(plan.entries).toHaveLength(SEEDS.length);
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
        ),
      ).not.toThrow();
    });

    it("(ii) enabled=false → 빈 plan 정합 통과", () => {
      const plan = buildRealDataGithubCollectionPlan(GATING_DISABLED, SEEDS);
      expect(plan).toEqual({ enabled: false, entries: [] });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_DISABLED,
          SEEDS,
          plan,
        ),
      ).not.toThrow();
    });

    it("(iii) label 인자를 넘겨도 정합 시 void(라벨 branch)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
          "collectionPlan#0",
        ),
      ).not.toThrow();
    });

    it("정합 호출 반환값이 undefined(void) 다", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
        ),
      ).toBeUndefined();
    });
  });

  describe("flow/branch cover — 분기마다 1+", () => {
    it("(c-true) githubPat 존재 → hasAuthorizationHeader=true 정합 통과", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(plan.entries.every((e) => e.hasAuthorizationHeader === true)).toBe(
        true,
      );
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
        ),
      ).not.toThrow();
    });

    it("(c-false) githubPat 공백 → hasAuthorizationHeader=false 정합 통과", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_BLANK_PAT,
        SEEDS,
      );
      expect(
        plan.entries.every((e) => e.hasAuthorizationHeader === false),
      ).toBe(true);
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_BLANK_PAT,
          SEEDS,
          plan,
        ),
      ).not.toThrow();
    });

    it("(d-primary) primary github.com identity 존재 시 그것을 선택 → 정합 통과", () => {
      // 기본 fixture seed 는 primary=true github.com identity 를 갖는다.
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(plan.entries[0]?.username).toBe(
        SEEDS[0].serviceIdentities[0].externalId,
      );
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
        ),
      ).not.toThrow();
    });

    it("(d-firstFallback) primary 부재 시 첫 github.com identity 선택 → 정합 통과", () => {
      // primary 가 없고 github.com identity 2 개인 seed — producer/oracle 모두 첫 identity 선택.
      const seedNoPrimary: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "octo", email: "octo@e2e.test", active: true },
          serviceIdentities: [
            {
              service: "github.com",
              externalId: "octo-first",
              isPrimary: false,
            },
            {
              service: "github.com",
              externalId: "octo-second",
              isPrimary: false,
            },
          ],
        },
      ];
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        seedNoPrimary,
      );
      expect(plan.entries[0]?.username).toBe("octo-first");
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          seedNoPrimary,
          plan,
        ),
      ).not.toThrow();
    });
  });

  describe("error path — plan 구조 결손 → TypeError", () => {
    it("plan=null → TypeError", () => {
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          null as unknown as RealDataE2eGithubCollectionPlan,
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=비객체(number) → TypeError", () => {
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          7 as unknown as RealDataE2eGithubCollectionPlan,
        ),
      ).toThrow(TypeError);
    });

    it("plan.enabled 비-boolean → TypeError", () => {
      const bad = {
        enabled: "yes",
        entries: [],
      } as unknown as RealDataE2eGithubCollectionPlan;
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          bad,
        ),
      ).toThrow(/plan.enabled 가 boolean 이 아니다/);
    });

    it("plan.entries 비-배열 → TypeError", () => {
      const bad = {
        enabled: true,
        entries: {},
      } as unknown as RealDataE2eGithubCollectionPlan;
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          bad,
        ),
      ).toThrow(/plan.entries 가 배열이 아니다/);
    });

    it("gating=null → TypeError(재유도 불가)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          null as unknown as RealDataE2eLiveGating,
          SEEDS,
          plan,
        ),
      ).toThrow(/gating 이 객체가 아니다.*null/);
    });

    it("seeds=비배열 → TypeError(재유도 불가)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          "nope" as unknown as RealDataSeedDescriptor[],
          plan,
        ),
      ).toThrow(/seeds 가 배열이 아니다/);
    });
  });

  describe("negative cases 충분 cover — 값 drift 유형마다 1+", () => {
    // 손상 helper — 정합 plan 을 얕은 복제 후 첫 entry 의 한 슬롯만 손상시킨다.
    function tamperFirstEntry(
      plan: RealDataE2eGithubCollectionPlan,
      patch: Partial<RealDataE2eGithubCollectionPlan["entries"][number]>,
    ): RealDataE2eGithubCollectionPlan {
      return {
        enabled: plan.enabled,
        entries: plan.entries.map((entry, i) =>
          i === 0 ? { ...entry, ...patch } : { ...entry },
        ),
      };
    }

    it("(a) entry.host 오염 → RangeError(host)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, { host: "evil.example" });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(
        /plan.entries\[0\].host 가 재유도 expected.*실측="evil.example"/,
      );
    });

    it("(b) entry.path 형태 변조(public 누락) → RangeError(path)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, {
        path: `/users/${plan.entries[0].username}/events`,
      });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries\[0\].path 가 재유도 expected/);
    });

    it("(c) entry.apiBaseUrl 변조 → RangeError(apiBaseUrl)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, {
        apiBaseUrl: "https://evil.example/api",
      });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries\[0\].apiBaseUrl 이 재유도 expected/);
    });

    it("(d) entry.username 변조(잘못된 identity 선택 모사) → RangeError(username)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, { username: "wrong-user" });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries\[0\].username 이 재유도 expected/);
    });

    it("(e) entry.hasAuthorizationHeader boolean 반전 → RangeError(hasAuthHeader)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, {
        hasAuthorizationHeader: false,
      });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(
        /plan.entries\[0\].hasAuthorizationHeader 가 재유도 expected.*기대=true.*실측=false/,
      );
    });

    it("(f) entries 길이 불일치(과잉) → RangeError(entries 길이)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered: RealDataE2eGithubCollectionPlan = {
        enabled: true,
        entries: [...plan.entries, { ...plan.entries[0] }],
      };
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries 길이가 재유도 expected.*기대=2.*실측=3/);
    });

    it("(f-b) entries 길이 불일치(누락) → RangeError(entries 길이)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered: RealDataE2eGithubCollectionPlan = {
        enabled: true,
        entries: [plan.entries[0]],
      };
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries 길이가 재유도 expected.*기대=2.*실측=1/);
    });

    it("(g) enabled=false 인데 entries 비어있지 않음 → RangeError(entries 길이)", () => {
      const activePlan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      // gating.enabled=false 로 재유도하면 expected entries=[] 인데 plan 은 entries 를 채웠다.
      const tampered: RealDataE2eGithubCollectionPlan = {
        enabled: false,
        entries: activePlan.entries,
      };
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_DISABLED,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.entries 길이가 재유도 expected.*기대=0.*실측=2/);
    });

    it("(h) enabled 반영 drift(gating disabled 인데 plan.enabled=true) → RangeError(enabled)", () => {
      const tampered: RealDataE2eGithubCollectionPlan = {
        enabled: true,
        entries: [],
      };
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_DISABLED,
          SEEDS,
          tampered,
        ),
      ).toThrow(/plan.enabled 가 재유도 expected.*기대=false.*실측=true/);
    });

    it("(i) 구조 결손은 TypeError 이고 RangeError 가 아니다(분리)", () => {
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          null as unknown as RealDataE2eGithubCollectionPlan,
        ),
      ).not.toThrow(RangeError);
    });

    it("(i-b) 값 drift 는 RangeError 이고 TypeError 가 아니다(분리)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const tampered = tamperFirstEntry(plan, { host: "evil.example" });
      expect(() =>
        assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          tampered,
        ),
      ).not.toThrow(TypeError);
    });
  });

  describe("§9 secret-safety — PAT 실 값 미노출", () => {
    it("hasAuthorizationHeader drift throw 메시지에 PAT 실 값이 포함되지 않는다(boolean만)", () => {
      const secretGating: RealDataE2eLiveGating = {
        enabled: true,
        githubPat: "ghp_SUPERSECRETPATVALUE0987654321",
        reason: "fixture — 활성",
      };
      const plan = buildRealDataGithubCollectionPlan(secretGating, SEEDS);
      const tampered: RealDataE2eGithubCollectionPlan = {
        enabled: true,
        entries: plan.entries.map((entry, i) =>
          i === 0 ? { ...entry, hasAuthorizationHeader: false } : { ...entry },
        ),
      };
      let message = "";
      try {
        assertRealDataGithubCollectionPlanConsistent(
          secretGating,
          SEEDS,
          tampered,
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/hasAuthorizationHeader 가 재유도 expected/);
      expect(message).not.toContain("ghp_SUPERSECRETPATVALUE0987654321");
      expect(message).not.toMatch(/ghp_|SUPERSECRET/i);
    });

    it("정합 plan 직렬화에 실 credential-looking 값 미보관(hasAuthorizationHeader boolean만)", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const serialized = JSON.stringify(plan);
      // plan 은 hasAuthorizationHeader boolean 만 노출 — raw PAT 값 자체가 없다.
      expect(serialized).not.toContain(DUMMY_PAT);
      expect(serialized).not.toMatch(/ghp_|secret|password/i);
      expect(plan.entries[0]?.hasAuthorizationHeader).toBe(true);
    });
  });

  describe("neutral 재유도 — oracle 이 producer 를 runtime import 하지 않음", () => {
    it("oracle 소스가 producer 를 type-only 로만 import(runtime import 0)", () => {
      const source = readFileSync(
        join(__dirname, "realdata-e2e-github-collection-live-consistency.ts"),
        "utf8",
      );
      const importLines = source
        .split("\n")
        .filter((line) => line.trimStart().startsWith("import"));
      // producer 모듈을 value import 하는 라인은 없어야 한다(type-only 만 허용).
      const producerValueImport = importLines.find(
        (line) =>
          /["']\.\/realdata-e2e-github-collection-live["']/.test(line) &&
          !line.trimStart().startsWith("import type"),
      );
      expect(producerValueImport).toBeUndefined();
      // buildRealDataGithubCollectionPlan 을 value import 재사용하지 않는다.
      expect(source).not.toContain(
        "import { buildRealDataGithubCollectionPlan }",
      );
      // 독립 재유도 상수를 자체 정의한다.
      expect(source).toContain("EXPECTED_GITHUB_COLLECTION_HOST");
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 gating/seeds/plan 을 변형하지 않는다", () => {
      const plan = buildRealDataGithubCollectionPlan(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
      );
      const beforeGating = JSON.stringify(GATING_ENABLED_WITH_PAT);
      const beforeSeeds = JSON.stringify(SEEDS);
      const beforePlan = JSON.stringify(plan);
      assertRealDataGithubCollectionPlanConsistent(
        GATING_ENABLED_WITH_PAT,
        SEEDS,
        plan,
      );
      expect(JSON.stringify(GATING_ENABLED_WITH_PAT)).toBe(beforeGating);
      expect(JSON.stringify(SEEDS)).toBe(beforeSeeds);
      expect(JSON.stringify(plan)).toBe(beforePlan);
    });
  });
});

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

// T-1088 구조-검사 선행성 spy 인프라(신규 namespace import). 가드가 named import 로
// resolveGithubApiBaseUrl 를 호출해도 동일 모듈 객체를 가리키므로 jest.spyOn 에 잡힌다.
import * as githubRequestBuilderModule from "../../src/github/github-request.builder";

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

  // T-1088 — 구조-검사 선행성 order-lock(clean leg). 가드는 상위 구조 assert 3개
  // (assertGatingStructure / assertSeedsStructure / assertPlanStructure — 각 TypeError)를
  // 요소별 재유도 위임 deriveExpectedPlan(내부 seeds.map → resolveGithubApiBaseUrl per-seed)
  // 보다 **먼저** 수행한다. 재유도-앞 구조 error 입력(gating/seeds/plan 결손)을 주면 delegate
  // resolveGithubApiBaseUrl 가 toHaveBeenCalledTimes(0) 이어야 한다는 선행성을 spy 로 못박아
  // "구조 검사 → 요소별 재유도" 순서를 silent 재정렬로부터 방어한다(defense-in-depth). 값 정합
  // 위반 RangeError(enabled/entries 길이/슬롯 drift)는 재유도 **뒤**에 오므로 delegate 는 per-seed
  // map 이라 gating.enabled=true 면 seeds.length 회 호출 — 값-boundary 대조에 사용한다(0-call
  // 범위 밖). 신규 namespace import + spyOn 인프라 신설 clean-leg. per-seed map + gating.enabled
  // early-return 특이점: 정상 도달 call 횟수는 1 아니라 seeds.length(gating disabled 면 0).
  describe("구조-검사 선행성 — 재유도-앞 구조 error → delegate 0-call (T-1088)", () => {
    // 본 블록 전용 spy 격리 — 신규 spyOn 이 기존 블록(실 delegate 를 정합 대조에 사용)으로
    // leak 되지 않도록 매 test 후 복원한다.
    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("happy-path(선행성 정상 흐름) — 구조 통과 후 요소별 재유도 delegate 호출", () => {
      it("gating.enabled=true + seeds.length ≥ 1 → delegate 정확히 seeds.length 회 호출", () => {
        // plan 합성(내부에서 delegate 를 호출)을 spyOn **이전**에 수행해 producer 의 합성 call 이
        // spy count 에 포함되지 않게 한 뒤 spy 를 걸고 가드를 호출 → 가드가 요소별 재유도에서
        // delegate 를 정확히 seeds.length 회 호출함을 확인. per-seed map 특이점: 1 아님.
        const plan = buildRealDataGithubCollectionPlan(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
        );
        expect(SEEDS.length).toBeGreaterThanOrEqual(1);
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        const result = assertRealDataGithubCollectionPlanConsistent(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
          plan,
        );
        expect(result).toBeUndefined();
        // spy 는 실 구현 call-through(mockImplementation 미지정) — byte-identical 대조가 통과한다.
        expect(spy).toHaveBeenCalledTimes(SEEDS.length);
        // 인자-충실도(per-element 순번별) — 재유도 delegate 가 매 호출마다 constant host
        // literal "github.com" 을 **정확히 그 순번에** 1-arg 로 받았음을 순번별로 lock
        // (횟수+순번+인자 payload 모두). EXPECTED_GITHUB_COLLECTION_HOST 는 guard 로컬 상수
        // (미export)이므로 spec 에서는 literal "github.com" 를 직접 대조한다.
        // 본 seam 은 per-element map 이라 SEEDS.length 회 호출 — 원소별 상이 payload 대신
        // 매번 동일 host 라서 순번별 동일 host 로 못박는다(evaluation-inputs leg13 패턴 확장).
        for (let i = 1; i <= SEEDS.length; i++) {
          expect(spy).toHaveBeenNthCalledWith(i, "github.com");
        }
        // canonical 전체 충실도 — host 인자가 관측됨을 명시(순번 무관 완전 충실도).
        expect(spy).toHaveBeenCalledWith("github.com");
        // negative(인자 payload drift 축) — deep-equality 매칭이 host payload drift 를 실제로
        // 잡음을 노출. 오염 host("evil.example")·빈 host("")로는 호출된 적 없음(값 drift 미매칭).
        // 기존 값-drift RangeError it 과 별개의 인자-축 negative.
        expect(spy).not.toHaveBeenCalledWith("evil.example");
        expect(spy).not.toHaveBeenCalledWith("");
        // negative(인자 개수/arity 봉함) — 각 delegate 호출이 정확히 1 인자로만 호출됨(여분 인자 0).
        // per-seed map 의 1-arity 봉함 — 재유도가 host 외 추가 컨텍스트를 넘기지 않음.
        spy.mock.calls.forEach((call) => {
          expect(call.length).toBe(1);
        });
        // flow/분기: 본 leg 은 happy-path 선행성 재유도 order-lock it 단일 경로 tighten —
        // 새 분기 도입 0(요소별 동일 constant host 호출로 per-seed 재유도 조립에 분기 없음, 항목 생략).
      });

      it("gating.enabled≠true(disabled) → early-return 으로 delegate 0-call(seed map 미실행)", () => {
        // gating disabled 면 deriveExpectedPlan 이 seed 를 읽기 전 early-return → delegate 미호출.
        const plan = buildRealDataGithubCollectionPlan(GATING_DISABLED, SEEDS);
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        const result = assertRealDataGithubCollectionPlanConsistent(
          GATING_DISABLED,
          SEEDS,
          plan,
        );
        expect(result).toBeUndefined();
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("plan 구조 결손(TypeError) → delegate 0-call", () => {
      it("(i) plan=null → throw(TypeError) + delegate 0-call", () => {
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            null as unknown as RealDataE2eGithubCollectionPlan,
          ),
        ).toThrow(TypeError);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("(ii) plan=비객체(number) → throw(TypeError) + delegate 0-call", () => {
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            7 as unknown as RealDataE2eGithubCollectionPlan,
          ),
        ).toThrow(/plan 이 객체가 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("(iii) plan.enabled 비-boolean → throw(TypeError) + delegate 0-call", () => {
        const bad = {
          enabled: "yes",
          entries: [],
        } as unknown as RealDataE2eGithubCollectionPlan;
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            bad,
          ),
        ).toThrow(/plan.enabled 가 boolean 이 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("(iv) plan.entries 비-배열 → throw(TypeError) + delegate 0-call", () => {
        const bad = {
          enabled: true,
          entries: {},
        } as unknown as RealDataE2eGithubCollectionPlan;
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            bad,
          ),
        ).toThrow(/plan.entries 가 배열이 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("gating 구조 결손(TypeError) → delegate 0-call", () => {
      it("(v) gating=null(비-객체) → throw(TypeError) + delegate 0-call", () => {
        // plan 은 구조상 온전한 정합 plan 으로 두어 gating 구조 검사(assertGatingStructure)가
        // 재유도-앞 차단 지점임을 격리 확인한다.
        const plan = buildRealDataGithubCollectionPlan(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
        );
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            null as unknown as RealDataE2eLiveGating,
            SEEDS,
            plan,
          ),
        ).toThrow(/gating 이 객체가 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("seeds 구조 결손(TypeError) → delegate 0-call", () => {
      it("(vi) seeds=비배열(string) → throw(TypeError) + delegate 0-call", () => {
        const plan = buildRealDataGithubCollectionPlan(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
        );
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            "nope" as unknown as RealDataSeedDescriptor[],
            plan,
          ),
        ).toThrow(/seeds 가 배열이 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("경계 대조 — 재유도-후 값 위반(RangeError)은 delegate seeds.length 회(0-call 범위 밖)", () => {
      it("슬롯 drift(host 오염) → RangeError + delegate 정확히 seeds.length 회(gating.enabled=true)", () => {
        // 상위 구조 검사(gating/seeds/plan)를 통과하므로 delegate 가 source seed 전량에 대해
        // 호출된 뒤 슬롯 대조에서 RangeError — 재유도-앞 0-call 과 대비되는 값-boundary
        // (per-seed map 이라 seeds.length 회, 1 아님).
        const plan = buildRealDataGithubCollectionPlan(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
        );
        const tampered: RealDataE2eGithubCollectionPlan = {
          enabled: plan.enabled,
          entries: plan.entries.map((entry, i) =>
            i === 0 ? { ...entry, host: "evil.example" } : { ...entry },
          ),
        };
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            tampered,
          ),
        ).toThrow(RangeError);
        expect(spy).toHaveBeenCalledTimes(SEEDS.length);
      });

      it("entries 길이 불일치(누락) → RangeError + delegate 정확히 seeds.length 회(gating.enabled=true)", () => {
        const plan = buildRealDataGithubCollectionPlan(
          GATING_ENABLED_WITH_PAT,
          SEEDS,
        );
        const tampered: RealDataE2eGithubCollectionPlan = {
          enabled: true,
          entries: [plan.entries[0]],
        };
        const spy = jest.spyOn(
          githubRequestBuilderModule,
          "resolveGithubApiBaseUrl",
        );
        expect(() =>
          assertRealDataGithubCollectionPlanConsistent(
            GATING_ENABLED_WITH_PAT,
            SEEDS,
            tampered,
          ),
        ).toThrow(/plan.entries 길이가 재유도 expected/);
        expect(spy).toHaveBeenCalledTimes(SEEDS.length);
      });
    });
  });
});

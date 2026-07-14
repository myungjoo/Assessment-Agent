// realdata-e2e-eval-chain.spec.ts — T-0975 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 수집 활동 N 건(합성 fixture) 주입 → bounded single(정확히 1 건) descriptor
//     조립 + person/service-identity(myungjoo/leemgs username 귀속) 보존.
//   - error path: 수집 활동 0 건(빈 배열) → active:false + 빈 activities(조용한-빈-입력 차단).
//   - flow/branch: (i) 활동 1 건 vs 다수(다수 → 1 건 bound), (ii) gating.enabled true/false
//     가 active 에 반영, (iii) myungjoo seed vs leemgs seed 귀속 분기.
//   - negative 충분 cover: (a) author 귀속 메타 누락(malformed) → skip, (b) 비-array/undefined
//     입력 → 방어적 TypeError, (c) gating.credential(ollama) 부재인데 enabled → active:false,
//     (d) 다수 활동 중 유효 0 건 → 빈-입력 error path 로 수렴, gating null/비객체 TypeError.
//   - §9: descriptor 어디에도 실 secret/token/apiKey 미등장(username·활동 메타 비시크릿만).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

import { buildRealDataE2eEvalChainInput } from "./realdata-e2e-eval-chain";
import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";

// gating enabled(평가 credential present) mock — 실 credential 값 0(더미만). ollama 는 실 LLM
// 평가 leg 진입 credential 존재를 표현하며, 본 helper 는 그 값을 참조하지 않는다(존재만 판정).
const GATING_ENABLED: RealDataE2eLiveGating = {
  enabled: true,
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "dummy-key-not-real",
    model: "dummy-model",
    provider: "openai-compatible",
    apiVersion: "2024-01-01",
  },
  githubPat: "dummy-pat-not-real",
  reason: "test enabled",
};

// gating disabled(공개 CI 기본) mock — credential 부재.
const GATING_DISABLED: RealDataE2eLiveGating = {
  enabled: false,
  reason: "test disabled",
};

// 합성 github 활동 1 건 빌더 — 지정 username 을 author(귀속 key)로 박제. metadata 는 volume
// 산출용 typed scalar 만(raw github 본문 미포함, R-59).
function activityFor(username: string, externalId: string): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: "github.com",
    author: username,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${username}/sample-repo`,
    kind: "commit",
  };
}

describe("buildRealDataE2eEvalChainInput", () => {
  describe("happy path (수집 활동 → bounded single descriptor)", () => {
    it("N 건 주입 → 정확히 1 건으로 bound + author(username) 귀속 보존", () => {
      const activities = [
        activityFor("myungjoo", "c1"),
        activityFor("myungjoo", "c2"),
        activityFor("myungjoo", "c3"),
      ];
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, activities);

      expect(input.activities).toHaveLength(1);
      expect(input.activities[0].externalId).toBe("c1");
      // person/service-identity 귀속(username) 보존 assert.
      expect(input.username).toBe("myungjoo");
      expect(input.activities[0].author).toBe("myungjoo");
      expect(input.active).toBe(true);
    });

    it("활동 정확히 1 건 주입 → 그 1 건 그대로 bound + active", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("myungjoo", "only"),
      ]);
      expect(input.activities).toHaveLength(1);
      expect(input.activities[0].externalId).toBe("only");
      expect(input.active).toBe(true);
    });
  });

  describe("error path (빈 입력 → 조용한-빈-입력-평가 차단)", () => {
    it("수집 활동 0 건(빈 배열) → active:false + 빈 activities + username null", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, []);
      expect(input.active).toBe(false);
      expect(input.activities).toHaveLength(0);
      expect(input.username).toBeNull();
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(i-a) 활동 1 건 → bound 1 건", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("myungjoo", "x"),
      ]);
      expect(input.activities).toHaveLength(1);
    });

    it("(i-b) 다수 활동 → 첫 유효 1 건으로 bound(무제한 round-trip 차단)", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("leemgs", "first"),
        activityFor("leemgs", "second"),
      ]);
      expect(input.activities).toHaveLength(1);
      expect(input.activities[0].externalId).toBe("first");
    });

    it("(ii-a) gating.enabled=true + credential + 유효 활동 → active:true", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("myungjoo", "a"),
      ]);
      expect(input.active).toBe(true);
    });

    it("(ii-b) gating.enabled=false → active:false(활동 있어도)", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_DISABLED, [
        activityFor("myungjoo", "a"),
      ]);
      expect(input.active).toBe(false);
      // 비활성이어도 bounded 활동 자체는 조립되어(descriptor 결정론) 후속 skip 판정에 쓰인다.
      expect(input.activities).toHaveLength(1);
    });

    it("(iii-a) myungjoo seed 귀속 → username myungjoo", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("myungjoo", "m1"),
      ]);
      expect(input.username).toBe("myungjoo");
    });

    it("(iii-b) leemgs seed 귀속 → username leemgs", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("leemgs", "l1"),
      ]);
      expect(input.username).toBe("leemgs");
    });
  });

  describe("negative cases (충분 cover — 각 1+)", () => {
    it("(a) author 귀속 메타 누락(빈 문자열) 활동 → skip → 빈-입력 error path", () => {
      const malformed = { ...activityFor("x", "bad"), author: "" };
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        malformed as GithubActivity,
      ]);
      expect(input.activities).toHaveLength(0);
      expect(input.active).toBe(false);
    });

    it("(a') author 가 공백-only → skip", () => {
      const malformed = { ...activityFor("x", "bad"), author: "   " };
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        malformed as GithubActivity,
      ]);
      expect(input.activities).toHaveLength(0);
    });

    it("(b) collectedActivities 가 undefined → 한국어 메시지 TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainInput(
          GATING_ENABLED,
          undefined as unknown as GithubActivity[],
        ),
      ).toThrow(/collectedActivities 가 배열이 아닙니다/);
    });

    it("(b') collectedActivities 가 null → TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainInput(
          GATING_ENABLED,
          null as unknown as GithubActivity[],
        ),
      ).toThrow(TypeError);
    });

    it("(c) gating.enabled 인데 ollama credential 부재 → active:false(비정상 조합 차단)", () => {
      const gatingNoCred: RealDataE2eLiveGating = {
        enabled: true,
        githubPat: "dummy",
        reason: "enabled but no ollama",
      };
      const input = buildRealDataE2eEvalChainInput(gatingNoCred, [
        activityFor("myungjoo", "a"),
      ]);
      expect(input.active).toBe(false);
      // 활동 자체는 bound 되나 credential 부재라 실 평가 진입 금지.
      expect(input.activities).toHaveLength(1);
    });

    it("(d) 다수 활동 중 유효 0 건(전부 malformed) → 빈-입력 error path 로 수렴", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        { ...activityFor("x", "b1"), author: "" } as GithubActivity,
        { ...activityFor("y", "b2"), author: "  " } as GithubActivity,
      ]);
      expect(input.activities).toHaveLength(0);
      expect(input.active).toBe(false);
      expect(input.username).toBeNull();
    });

    it("gating 이 null → 한국어 메시지 TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainInput(
          null as unknown as RealDataE2eLiveGating,
          [activityFor("myungjoo", "a")],
        ),
      ).toThrow(/gating 이 null/);
    });

    it("gating 이 undefined → TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainInput(
          undefined as unknown as RealDataE2eLiveGating,
          [activityFor("myungjoo", "a")],
        ),
      ).toThrow(TypeError);
    });

    it("배열 안에 비객체 entry(null/문자열) → 방어적 skip", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        null as unknown as GithubActivity,
        "not-an-activity" as unknown as GithubActivity,
        activityFor("myungjoo", "valid"),
      ]);
      // 비객체는 skip 되고 유효 활동만 bound 된다.
      expect(input.activities).toHaveLength(1);
      expect(input.activities[0].externalId).toBe("valid");
    });
  });

  describe("순수성 / 입력 비변형 (부수효과 0)", () => {
    it("호출 후 입력 활동 배열이 mutate 되지 않는다", () => {
      const activities = [
        activityFor("myungjoo", "c1"),
        activityFor("myungjoo", "c2"),
      ];
      const snapshot = JSON.stringify(activities);
      buildRealDataE2eEvalChainInput(GATING_ENABLED, activities);
      expect(JSON.stringify(activities)).toBe(snapshot);
    });

    it("호출마다 새 activities 배열을 반환한다(공유 배열 노출 0)", () => {
      const activities = [activityFor("myungjoo", "c1")];
      const a = buildRealDataE2eEvalChainInput(GATING_ENABLED, activities);
      const b = buildRealDataE2eEvalChainInput(GATING_ENABLED, activities);
      expect(a).toEqual(b);
      expect(a.activities).not.toBe(b.activities);
      expect(a.activities).not.toBe(activities);
    });
  });

  describe("(§9) descriptor 에 실 secret 미등장", () => {
    it("descriptor 직렬화에 apiKey/PAT 값이 새지 않는다(비시크릿 username·메타만)", () => {
      const input = buildRealDataE2eEvalChainInput(GATING_ENABLED, [
        activityFor("myungjoo", "c1"),
      ]);
      const serialized = JSON.stringify(input);
      expect(serialized).not.toContain("dummy-key-not-real");
      expect(serialized).not.toContain("dummy-pat-not-real");
      // 비시크릿(username)만 노출됨을 확인.
      expect(serialized).toContain("myungjoo");
    });
  });
});

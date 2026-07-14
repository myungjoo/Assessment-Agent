// realdata-e2e-eval-chain-consistency.spec.ts — T-0976 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 실제 `buildRealDataE2eEvalChainInput` 출력을 가드에 넘겨 정합 시 void
//     — (i) 유효 활동 1 건, (ii) 유효 활동 다수(→1 건 bound), (iii) 유효 활동 0 건
//     (active:false/빈 activities) 각각.
//   - error path: helper 출력을 의도적으로 손상시킨 descriptor(activities 2 건화 / active
//     뒤집기 / username 교체) 주입 → 각 RangeError.
//   - flow/branch: (i) gating.enabled true vs false, (ii) ollama 존재 vs 부재, (iii)
//     myungjoo vs leemgs author 귀속(username 재유도) 각 분기.
//   - negative 충분 cover: (a) descriptor 비객체/null → TypeError, (b) descriptor.activities
//     비배열 → TypeError, (c) collectedActivities 비배열 → TypeError, (d) gating 비객체/null
//     → TypeError, (e) length 같지만 원소 author drift → RangeError(index), (f) active 만
//     drift → RangeError.
//   - §9 secret-safety: fixture/descriptor/에러 메시지에 실 secret/token/apiKey 미등장 assert.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

import {
  buildRealDataE2eEvalChainInput,
  type RealDataE2eEvalChainInput,
} from "./realdata-e2e-eval-chain";
import { assertRealDataE2eEvalChainInputConsistent } from "./realdata-e2e-eval-chain-consistency";
import type {
  RealDataE2eLiveGating,
  RealDataE2eLiveOllamaCredential,
} from "./realdata-e2e-live-gating";

// gating fixtures — §9 격리: 실 credential 값을 담지 않는다. active 재유도는 gating.enabled
// + ollama 존재 여부만 보므로 ollama 는 빈 더미 객체로 충분하다(credential-looking 값 0).
const DUMMY_OLLAMA = {} as RealDataE2eLiveOllamaCredential;

// GATING_ACTIVE — enabled + ollama 존재(active 재유도 true 경로).
const GATING_ACTIVE: RealDataE2eLiveGating = {
  enabled: true,
  ollama: DUMMY_OLLAMA,
  reason: "test — 활성(더미 gating)",
};

// GATING_DISABLED — enabled false(ollama 부재). active 재유도 false 경로.
const GATING_DISABLED: RealDataE2eLiveGating = {
  enabled: false,
  reason: "test — 비활성(더미 gating)",
};

// GATING_ENABLED_NO_CRED — enabled true 이나 ollama 부재. 비정상 조합 → active false 경로.
const GATING_ENABLED_NO_CRED: RealDataE2eLiveGating = {
  enabled: true,
  reason: "test — 활성 flag 이나 credential 부재(더미 gating)",
};

// activity fixtures — 비시크릿 username·활동 메타만(§9 / R-59). raw 본문 0.
const ACT_MYUNGJOO: GithubActivity = {
  sourceType: "github",
  externalId: "abc123",
  instanceKey: "com",
  author: "myungjoo",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { additions: 10 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};

const ACT_LEEMGS: GithubActivity = {
  sourceType: "github",
  externalId: "42",
  instanceKey: "com",
  author: "leemgs",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 24 },
  repoRef: "octo-org/octo-repo",
  kind: "pr",
};

// author 귀속 결손(공백-only) — filter 재유도에서 제외되어야 하는 malformed 활동.
const ACT_MALFORMED: GithubActivity = {
  sourceType: "github",
  externalId: "9",
  instanceKey: "sec",
  author: "   ",
  timestamp: "2026-06-03T00:00:00.000Z",
  metadata: {},
  repoRef: "octo-org/other-repo",
  kind: "issue",
};

describe("assertRealDataE2eEvalChainInputConsistent", () => {
  describe("happy path — 실제 helper 출력 정합 → void(throw 0)", () => {
    it("(i) 유효 활동 1 건 → 정합 통과", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(ii) 유효 활동 다수(→1 건 bound) → 정합 통과", () => {
      const collected = [ACT_MYUNGJOO, ACT_LEEMGS];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      expect(descriptor.activities).toHaveLength(1);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(iii) 유효 활동 0 건(빈 입력) → active:false/빈 activities 정합 통과", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, []);
      expect(descriptor.active).toBe(false);
      expect(descriptor.activities).toHaveLength(0);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(iii-b) 전부 malformed(귀속 결손) → 0 건 수렴 정합 통과", () => {
      const collected = [ACT_MALFORMED];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      expect(descriptor.activities).toHaveLength(0);
      expect(descriptor.username).toBeNull();
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(iii-c) null 원소 혼입(방어적 skip) → 유효 1 건 bound 정합 통과", () => {
      // collectedActivities 에 null 원소가 섞여도 helper·oracle 모두 filter 에서 방어적
      // 으로 제외(귀속 predicate 의 비객체/null false 분기)하고 유효 1 건으로 bound → 정합.
      const collected = [null, ACT_MYUNGJOO] as unknown as GithubActivity[];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      expect(descriptor.activities).toHaveLength(1);
      expect(descriptor.username).toBe("myungjoo");
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          descriptor,
        ),
      ).not.toThrow();
    });

    it("정합 호출 반환값이 undefined(void) 다", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).toBeUndefined();
    });
  });

  describe("error path — 손상 descriptor 주입 → RangeError", () => {
    it("activities 를 2 건으로 늘림(bound 위반) → RangeError(길이 정보)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        activities: [ACT_MYUNGJOO, ACT_LEEMGS],
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).toThrow(/activities 길이가 재유도 expected 와 다르다.*기대=1.*실측=2/);
    });

    it("active 를 뒤집음 → RangeError(active drift)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        active: !descriptor.active,
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).toThrow(/descriptor.active 가 재유도 expected 와 다르다/);
    });

    it("username 을 다른 author 로 교체 → RangeError(username drift)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        username: "leemgs",
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).toThrow(/descriptor.username 이 재유도 expected 와 다르다/);
    });
  });

  describe("flow / branch — 재유도 분기마다", () => {
    it("(i-a) gating.enabled true → 재유도 active true 반영", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(descriptor.active).toBe(true);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(i-b) gating.enabled false → 재유도 active false 반영", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_DISABLED, [
        ACT_MYUNGJOO,
      ]);
      expect(descriptor.active).toBe(false);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_DISABLED,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(ii-a) ollama credential 존재 → active true 경로 정합", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_LEEMGS,
      ]);
      expect(descriptor.active).toBe(true);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_LEEMGS],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(ii-b) ollama credential 부재(enabled true) → active false 경로 정합", () => {
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ENABLED_NO_CRED,
        [ACT_MYUNGJOO],
      );
      expect(descriptor.active).toBe(false);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ENABLED_NO_CRED,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(iii-a) myungjoo seed 귀속 → username 재유도 정합", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(descriptor.username).toBe("myungjoo");
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow();
    });

    it("(iii-b) leemgs seed 귀속 → username 재유도 정합", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_LEEMGS,
      ]);
      expect(descriptor.username).toBe("leemgs");
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_LEEMGS],
          descriptor,
        ),
      ).not.toThrow();
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다", () => {
    it("(a) descriptor=null → TypeError", () => {
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          null as unknown as RealDataE2eEvalChainInput,
        ),
      ).toThrow(/descriptor 가 객체가 아니다.*null/);
    });

    it("(a-b) descriptor=비객체(number) → TypeError", () => {
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          7 as unknown as RealDataE2eEvalChainInput,
        ),
      ).toThrow(TypeError);
    });

    it("(b) descriptor.activities 비배열 → TypeError", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      const broken = {
        ...descriptor,
        activities: "nope",
      } as unknown as RealDataE2eEvalChainInput;
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          [ACT_MYUNGJOO],
          broken,
        ),
      ).toThrow(/descriptor.activities 가 배열이 아니다.*string/);
    });

    it("(c) collectedActivities 비배열 → TypeError", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          null as unknown as GithubActivity[],
          descriptor,
        ),
      ).toThrow(/collectedActivities 가 배열이 아니다.*null/);
    });

    it("(d) gating=null → TypeError", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          null as unknown as RealDataE2eLiveGating,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).toThrow(/gating 이 객체가 아니다.*null/);
    });

    it("(d-b) gating=비객체(string) → TypeError", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          "nope" as unknown as RealDataE2eLiveGating,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).toThrow(/gating 이 객체가 아니다.*string/);
    });

    it("(e) length 같지만 원소 author drift → RangeError(index 정보)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      // username 은 원본대로 두고 activities[0] 만 다른 author 원소로 교체(길이 유지).
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        activities: [ACT_LEEMGS],
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).toThrow(
        /descriptor.activities\[0\] 가 재유도 expected 와 byte-identical 하지 않다/,
      );
    });

    it("(f) active 만 drift(activities 정합) → RangeError(active 우선)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        active: false,
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).toThrow(/descriptor.active 가 재유도 expected 와 다르다/);
    });

    it("구조 결손은 TypeError 이고 RangeError 가 아니다(분리)", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          null as unknown as RealDataE2eLiveGating,
          [ACT_MYUNGJOO],
          descriptor,
        ),
      ).not.toThrow(RangeError);
    });

    it("값 drift 는 RangeError 이고 TypeError 가 아니다(분리)", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        username: "leemgs",
      };
      expect(() =>
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        ),
      ).not.toThrow(TypeError);
    });
  });

  describe("§9 secret-safety — 실 secret/token/apiKey 미등장", () => {
    it("gating fixture · descriptor 어디에도 credential-looking 필드 미등장", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      const serialized = JSON.stringify({
        gating: GATING_ACTIVE,
        descriptor,
      });
      expect(serialized).not.toMatch(/token|apiKey|secret|pat|password/i);
      // 비시크릿 username·활동 메타만 등장하는지 확인.
      expect(descriptor.username).toBe("myungjoo");
    });

    it("정합 위반 에러 메시지에 secret/token/apiKey 미등장", () => {
      const collected = [ACT_MYUNGJOO];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      const tampered: RealDataE2eEvalChainInput = {
        ...descriptor,
        username: "leemgs",
      };
      let message = "";
      try {
        assertRealDataE2eEvalChainInputConsistent(
          GATING_ACTIVE,
          collected,
          tampered,
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/재유도 expected 와 다르다/);
      expect(message).not.toMatch(/token|apiKey|secret|password/i);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 collectedActivities 배열을 변형하지 않는다", () => {
      const collected: GithubActivity[] = [ACT_MYUNGJOO, ACT_LEEMGS];
      const before = [...collected];
      const descriptor = buildRealDataE2eEvalChainInput(
        GATING_ACTIVE,
        collected,
      );
      assertRealDataE2eEvalChainInputConsistent(
        GATING_ACTIVE,
        collected,
        descriptor,
      );
      expect(collected).toEqual(before);
      expect(collected[0]).toBe(before[0]);
    });

    it("정합 호출이 descriptor 배열·원소를 변형하지 않는다", () => {
      const descriptor = buildRealDataE2eEvalChainInput(GATING_ACTIVE, [
        ACT_MYUNGJOO,
      ]);
      const lenBefore = descriptor.activities.length;
      const firstRef = descriptor.activities[0];
      assertRealDataE2eEvalChainInputConsistent(
        GATING_ACTIVE,
        [ACT_MYUNGJOO],
        descriptor,
      );
      expect(descriptor.activities).toHaveLength(lenBefore);
      expect(descriptor.activities[0]).toBe(firstRef);
    });
  });
});

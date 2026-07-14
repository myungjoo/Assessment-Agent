// realdata-e2e-eval-chain-activity-map-consistency.spec.ts — T-0979 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 실제 `mapRealDataGithubEventToActivity` 출력을 가드에 넘겨 정합 시 void
//     — (i) PullRequestEvent(kind=pr), (ii) IssuesEvent(kind=issue), (iii) 그 외 type
//     (kind=commit) 각각.
//   - error path: helper 출력을 의도적으로 손상시킨 activity(kind 교체 / externalId 변경 /
//     author 교체 / metadata.titleLength drift) 주입 → 각 RangeError.
//   - flow/branch: (i) kind 3 분기(pr/issue/commit), (ii) externalId string vs 비string
//     fallback, (iii) timestamp string vs 비string epoch fallback, (iv) repoRef repo.name
//     string vs 누락 `${username}/unknown-repo` fallback 각 분기.
//   - negative 충분 cover: (a) activity 비객체/null → TypeError, (b) event 비객체/null →
//     TypeError, (c) username 비string → TypeError, (d) metadata 에 raw 본문 키 유입 →
//     RangeError(R-59), (e) 상수 필드(sourceType/instanceKey) drift → RangeError(필드명),
//     (f) repoRef fallback 형식 drift → RangeError.
//   - §9 secret-safety: fixture/activity/에러 메시지에 실 secret/token/apiKey 미등장 assert.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

import { mapRealDataGithubEventToActivity } from "./realdata-e2e-eval-chain-activity-map";
import { assertRealDataGithubEventActivityMappingConsistent } from "./realdata-e2e-eval-chain-activity-map-consistency";

// event fixtures — §9 / R-59 격리: type/id/created_at/repo.name 만 담는 더미 구조.
// raw 본문(payload 전문·commit message·diff·issue body) 0, credential-looking 값 0.
const USERNAME = "myungjoo";

// PR event(kind=pr 사영 경로) — 모든 필드 string 으로 fallback 미발동 경로.
const EVENT_PR: Record<string, unknown> = {
  type: "PullRequestEvent",
  id: "pr-100",
  created_at: "2026-06-01T00:00:00Z",
  repo: { name: "octo-org/octo-repo" },
};

// Issues event(kind=issue 사영 경로).
const EVENT_ISSUE: Record<string, unknown> = {
  type: "IssuesEvent",
  id: "issue-200",
  created_at: "2026-06-02T00:00:00Z",
  repo: { name: "octo-org/other-repo" },
};

// Push event(그 외 type → kind=commit 사영 경로).
const EVENT_PUSH: Record<string, unknown> = {
  type: "PushEvent",
  id: "push-300",
  created_at: "2026-06-03T00:00:00Z",
  repo: { name: "octo-org/octo-repo" },
};

describe("assertRealDataGithubEventActivityMappingConsistent", () => {
  describe("happy path — 실제 helper 출력 정합 → void(throw 0)", () => {
    it("(i) PullRequestEvent(kind=pr) → 정합 통과", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(activity.kind).toBe("pr");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
        ),
      ).not.toThrow();
    });

    it("(ii) IssuesEvent(kind=issue) → 정합 통과", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_ISSUE);
      expect(activity.kind).toBe("issue");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_ISSUE,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iii) 그 외 type(kind=commit) → 정합 통과", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PUSH);
      expect(activity.kind).toBe("commit");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PUSH,
          activity,
        ),
      ).not.toThrow();
    });

    it("정합 호출 반환값이 undefined(void) 다", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
        ),
      ).toBeUndefined();
    });

    it("label 인자를 넘겨도 정합 시 void(라벨 branch)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
          "activity#0",
        ),
      ).not.toThrow();
    });
  });

  describe("error path — 손상 activity 주입 → RangeError", () => {
    it("kind 를 다른 값으로 교체 → RangeError(kind drift)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = { ...activity, kind: "commit" };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(
        /activity.kind 가 재유도 expected 와 다르다.*기대="pr".*실측="commit"/,
      );
    });

    it("externalId 를 변경 → RangeError(externalId drift)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = { ...activity, externalId: "tampered" };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(/activity.externalId 가 재유도 expected 와 다르다/);
    });

    it("author 를 다른 username 으로 교체 → RangeError(author drift)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = { ...activity, author: "leemgs" };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(/activity.author 가 재유도 expected\(username 귀속\)와 다르다/);
    });

    it("metadata.titleLength 를 drift → RangeError(metadata)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = {
        ...activity,
        metadata: { titleLength: 9999 },
      };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(
        /activity.metadata 가 재유도 expected 와 byte-identical 하지 않다/,
      );
    });

    it("timestamp 를 변경 → RangeError(timestamp drift)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = {
        ...activity,
        timestamp: "1999-01-01T00:00:00Z",
      };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(/activity.timestamp 가 재유도 expected 와 다르다/);
    });
  });

  describe("flow / branch — 재유도 분기마다", () => {
    it("(i) kind 3 분기(pr/issue/commit) 재유도 대조 정합", () => {
      for (const [event, expectedKind] of [
        [EVENT_PR, "pr"],
        [EVENT_ISSUE, "issue"],
        [EVENT_PUSH, "commit"],
      ] as const) {
        const activity = mapRealDataGithubEventToActivity(USERNAME, event);
        expect(activity.kind).toBe(expectedKind);
        expect(() =>
          assertRealDataGithubEventActivityMappingConsistent(
            USERNAME,
            event,
            activity,
          ),
        ).not.toThrow();
      }
    });

    it("(ii-a) externalId string → 그대로 통과 재유도 정합", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(activity.externalId).toBe("pr-100");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
        ),
      ).not.toThrow();
    });

    it("(ii-b) externalId 비string(number) → String(...) fallback 재유도 정합", () => {
      const event: Record<string, unknown> = {
        type: "PushEvent",
        id: 42,
        created_at: "2026-06-04T00:00:00Z",
        repo: { name: "octo-org/octo-repo" },
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.externalId).toBe("42");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });

    it("(ii-c) externalId 누락 → 'unknown' fallback 재유도 정합", () => {
      const event: Record<string, unknown> = {
        type: "PushEvent",
        created_at: "2026-06-05T00:00:00Z",
        repo: { name: "octo-org/octo-repo" },
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.externalId).toBe("unknown");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iii-a) timestamp string → 그대로 통과 재유도 정합", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(activity.timestamp).toBe("2026-06-01T00:00:00Z");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iii-b) timestamp 비string → epoch fallback 재유도 정합", () => {
      const event: Record<string, unknown> = {
        type: "PushEvent",
        id: "push-9",
        created_at: 12345,
        repo: { name: "octo-org/octo-repo" },
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.timestamp).toBe("1970-01-01T00:00:00Z");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iv-a) repoRef repo.name string → 그대로 통과 재유도 정합", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(activity.repoRef).toBe("octo-org/octo-repo");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iv-b) repoRef repo 누락 → `${username}/unknown-repo` fallback 재유도 정합", () => {
      const event: Record<string, unknown> = {
        type: "PushEvent",
        id: "push-7",
        created_at: "2026-06-06T00:00:00Z",
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.repoRef).toBe("myungjoo/unknown-repo");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });

    it("(v) event.type 누락(비string) → kind=commit + titleLength=0 재유도 정합", () => {
      // event.type 이 없으면 helper 는 type=""(길이 0)으로 다뤄 kind=commit,
      // metadata.titleLength=0 을 산출한다. oracle 도 동일 fallback 으로 수렴한다.
      const event: Record<string, unknown> = {
        id: "push-typeless",
        created_at: "2026-06-09T00:00:00Z",
        repo: { name: "octo-org/octo-repo" },
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.kind).toBe("commit");
      expect(activity.metadata.titleLength).toBe(0);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });

    it("(iv-c) repoRef repo 존재하나 name 비string → fallback 재유도 정합", () => {
      // repo 는 있으나 name 이 string 이 아닌 경우(부분 응답 방어) — helper·oracle 모두
      // `${username}/unknown-repo` fallback 으로 수렴한다.
      const event: Record<string, unknown> = {
        type: "PushEvent",
        id: "push-11",
        created_at: "2026-06-08T00:00:00Z",
        repo: { name: 123 },
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      expect(activity.repoRef).toBe("myungjoo/unknown-repo");
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          activity,
        ),
      ).not.toThrow();
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다", () => {
    it("(a) activity=null → TypeError", () => {
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          null as unknown as GithubActivity,
        ),
      ).toThrow(/activity 가 객체가 아니다.*null/);
    });

    it("(a-b) activity=비객체(number) → TypeError", () => {
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          7 as unknown as GithubActivity,
        ),
      ).toThrow(TypeError);
    });

    it("(b) event=null → TypeError", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          null as unknown as Record<string, unknown>,
          activity,
        ),
      ).toThrow(/event 가 객체가 아니다.*null/);
    });

    it("(b-b) event=비객체(string) → TypeError", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          "nope" as unknown as Record<string, unknown>,
          activity,
        ),
      ).toThrow(/event 가 객체가 아니다.*string/);
    });

    it("(c) username=비string(number) → TypeError", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          7 as unknown as string,
          EVENT_PR,
          activity,
        ),
      ).toThrow(/username 이 string 이 아니다.*number/);
    });

    it("(d) metadata 에 raw 본문 키(payload/body) 유입 → RangeError(R-59)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = {
        ...activity,
        metadata: {
          titleLength: activity.metadata.titleLength as number,
          // raw 본문 키 유입 시뮬레이션 — typed scalar 만 허용하므로 정합 위반.
          bodyText: "raw issue body 전문",
        },
      };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(
        /activity.metadata 가 재유도 expected 와 byte-identical 하지 않다.*R-59/,
      );
    });

    it("(e-1) sourceType drift → RangeError(필드명 포함)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered = {
        ...activity,
        sourceType: "confluence",
      } as unknown as GithubActivity;
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(/activity.sourceType 이 재유도 expected 와 다르다/);
    });

    it("(e-2) instanceKey drift → RangeError(필드명 포함)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = {
        ...activity,
        instanceKey: "sec",
      };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).toThrow(/activity.instanceKey 가 재유도 expected 와 다르다/);
    });

    it("(f) repoRef fallback 형식 drift(다른 형식) → RangeError", () => {
      // repo 누락 event 로 helper 를 돌리면 `${username}/unknown-repo` 가 expected 인데
      // activity 의 repoRef 를 다른 형식으로 변조 → 정합 위반.
      const event: Record<string, unknown> = {
        type: "PushEvent",
        id: "push-8",
        created_at: "2026-06-07T00:00:00Z",
      };
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      const tampered: GithubActivity = {
        ...activity,
        repoRef: "myungjoo/unknown",
      };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          event,
          tampered,
        ),
      ).toThrow(/activity.repoRef 가 재유도 expected 와 다르다/);
    });

    it("구조 결손은 TypeError 이고 RangeError 가 아니다(분리)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          null as unknown as Record<string, unknown>,
          activity,
        ),
      ).not.toThrow(RangeError);
    });

    it("값 drift 는 RangeError 이고 TypeError 가 아니다(분리)", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = { ...activity, kind: "issue" };
      expect(() =>
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        ),
      ).not.toThrow(TypeError);
    });
  });

  describe("§9 secret-safety — 실 secret/token/apiKey 미등장", () => {
    it("event fixture · activity 어디에도 credential-looking 필드 미등장", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const serialized = JSON.stringify({ event: EVENT_PR, activity });
      expect(serialized).not.toMatch(/token|apiKey|secret|pat|password/i);
      // 비시크릿 username·활동 메타만 등장하는지 확인.
      expect(activity.author).toBe("myungjoo");
    });

    it("정합 위반 에러 메시지에 secret/token/apiKey 미등장", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const tampered: GithubActivity = { ...activity, author: "leemgs" };
      let message = "";
      try {
        assertRealDataGithubEventActivityMappingConsistent(
          USERNAME,
          EVENT_PR,
          tampered,
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/재유도 expected/);
      expect(message).not.toMatch(/token|apiKey|secret|password/i);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 event 객체를 변형하지 않는다", () => {
      const event: Record<string, unknown> = {
        type: "PullRequestEvent",
        id: "pr-100",
        created_at: "2026-06-01T00:00:00Z",
        repo: { name: "octo-org/octo-repo" },
      };
      const before = JSON.stringify(event);
      const activity = mapRealDataGithubEventToActivity(USERNAME, event);
      assertRealDataGithubEventActivityMappingConsistent(
        USERNAME,
        event,
        activity,
      );
      expect(JSON.stringify(event)).toBe(before);
    });

    it("정합 호출이 activity 객체·metadata 를 변형하지 않는다", () => {
      const activity = mapRealDataGithubEventToActivity(USERNAME, EVENT_PR);
      const metaRef = activity.metadata;
      const before = JSON.stringify(activity);
      assertRealDataGithubEventActivityMappingConsistent(
        USERNAME,
        EVENT_PR,
        activity,
      );
      expect(JSON.stringify(activity)).toBe(before);
      expect(activity.metadata).toBe(metaRef);
    });
  });
});

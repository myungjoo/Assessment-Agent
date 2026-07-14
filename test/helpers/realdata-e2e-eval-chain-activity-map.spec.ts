// realdata-e2e-eval-chain-activity-map.spec.ts — T-0978 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 event 3 종 type(PullRequestEvent / IssuesEvent / PushEvent) → 올바른
//     GithubActivity 매핑(kind 사영 정확 + author=username + sourceType="github" +
//     instanceKey="github.com" + repoRef/timestamp/externalId 통과).
//   - error/negative: 각 fallback 분기 1+ — (a) type 누락/비string → kind="commit",
//     (b) id 누락/비string → externalId String 변환·"unknown" fallback, (c) created_at 누락
//     → epoch fallback, (d) repo 누락/repo.name 비string → `${username}/unknown-repo`.
//   - flow/branch: kind 3 분기(pr/issue/commit) 각각 + 4 fallback 분기 각각 분리 test.
//   - R-59 격리: metadata 에 raw payload 전문/본문 키가 실리지 않고 typed scalar(titleLength)만.
//   - 순수성: 동일 입력 2 회 호출 시 서로 다른 새 객체 반환 + 입력 event unmutated.
//   - self-wire (T-0982): producer 가 반환 직전 consistency oracle 가드를 스스로 호출하는지
//     R-112 4종(happy/error/flow/negative)으로 봉한다.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

import { mapRealDataGithubEventToActivity } from "./realdata-e2e-eval-chain-activity-map";
// consistency 모듈은 namespace 로 import 해 self-wire spy(jest.spyOn) 대상으로 삼는다.
// ts-jest CommonJS 트랜스파일에서 producer 의 named import 는 이 모듈 객체 프로퍼티 접근으로
// 컴파일되므로, 이 namespace 의 함수를 spyOn 하면 producer 내부 self-wire 호출이 가로채진다.
import * as activityMapConsistency from "./realdata-e2e-eval-chain-activity-map-consistency";

// 정상 github events API 응답 1 건 형태의 fixture 빌더 — 지정 type/id/repo 로 raw event 를
// 만든다. metadata 에 실릴 raw 본문 후보(payload)를 일부러 넣어 R-59 격리를 검증한다.
function eventOf(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "PushEvent",
    id: "evt-1",
    created_at: "2026-06-01T12:00:00Z",
    repo: { name: "myungjoo/leemgs" },
    // raw payload 본문 — 매핑 산출 metadata 에 절대 실리면 안 되는 후보(R-59).
    payload: { commits: [{ message: "raw commit message 전문" }] },
    ...overrides,
  };
}

describe("mapRealDataGithubEventToActivity", () => {
  describe("happy path (정상 event 3 종 → GithubActivity)", () => {
    it("PullRequestEvent → kind='pr' + 공통 필드 정확", () => {
      const activity = mapRealDataGithubEventToActivity(
        "myungjoo",
        eventOf({ type: "PullRequestEvent", id: "pr-9" }),
      );
      expect(activity.kind).toBe("pr");
      expect(activity.author).toBe("myungjoo");
      expect(activity.sourceType).toBe("github");
      expect(activity.instanceKey).toBe("github.com");
      expect(activity.externalId).toBe("pr-9");
      expect(activity.repoRef).toBe("myungjoo/leemgs");
      expect(activity.timestamp).toBe("2026-06-01T12:00:00Z");
    });

    it("IssuesEvent → kind='issue'", () => {
      const activity = mapRealDataGithubEventToActivity(
        "leemgs",
        eventOf({ type: "IssuesEvent", id: "iss-3" }),
      );
      expect(activity.kind).toBe("issue");
      expect(activity.author).toBe("leemgs");
      expect(activity.externalId).toBe("iss-3");
    });

    it("PushEvent(그 외 type) → kind='commit'", () => {
      const activity = mapRealDataGithubEventToActivity(
        "myungjoo",
        eventOf({ type: "PushEvent", id: "push-1" }),
      );
      expect(activity.kind).toBe("commit");
    });
  });

  describe("negative cases — fallback 분기 각각 (충분 cover)", () => {
    it("(a-1) type 누락 → kind='commit' + titleLength=0", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ type: undefined }),
      );
      expect(activity.kind).toBe("commit");
      expect(activity.metadata.titleLength).toBe(0);
    });

    it("(a-2) type 비string(number) → kind='commit'", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ type: 123 }),
      );
      expect(activity.kind).toBe("commit");
      expect(activity.metadata.titleLength).toBe(0);
    });

    it("(b-1) id 누락 → externalId='unknown' fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ id: undefined }),
      );
      expect(activity.externalId).toBe("unknown");
    });

    it("(b-2) id null → externalId='unknown' fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ id: null }),
      );
      expect(activity.externalId).toBe("unknown");
    });

    it("(b-3) id 비string(number) → String 변환", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ id: 42 }),
      );
      expect(activity.externalId).toBe("42");
    });

    it("(c-1) created_at 누락 → epoch fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ created_at: undefined }),
      );
      expect(activity.timestamp).toBe("1970-01-01T00:00:00Z");
    });

    it("(c-2) created_at 비string(number) → epoch fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ created_at: 1700000000 }),
      );
      expect(activity.timestamp).toBe("1970-01-01T00:00:00Z");
    });

    it("(d-1) repo 누락 → `${username}/unknown-repo` fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "myungjoo",
        eventOf({ repo: undefined }),
      );
      expect(activity.repoRef).toBe("myungjoo/unknown-repo");
    });

    it("(d-2) repo.name 비string → fallback", () => {
      const activity = mapRealDataGithubEventToActivity(
        "leemgs",
        eventOf({ repo: { name: 999 } }),
      );
      expect(activity.repoRef).toBe("leemgs/unknown-repo");
    });

    it("(d-3) repo 가 null → fallback(guard)", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ repo: null }),
      );
      expect(activity.repoRef).toBe("u/unknown-repo");
    });

    it("전 필드 malformed(빈 event) → 모든 fallback 동시 적용", () => {
      const activity = mapRealDataGithubEventToActivity("u", {});
      expect(activity.kind).toBe("commit");
      expect(activity.externalId).toBe("unknown");
      expect(activity.timestamp).toBe("1970-01-01T00:00:00Z");
      expect(activity.repoRef).toBe("u/unknown-repo");
      expect(activity.metadata.titleLength).toBe(0);
    });
  });

  describe("(R-59) 격리 — metadata 는 typed scalar 만, raw 본문 미포함", () => {
    it("metadata 에 titleLength 만 존재 + payload/commits/message 키 부재", () => {
      const activity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({ type: "IssuesEvent" }),
      );
      expect(Object.keys(activity.metadata)).toEqual(["titleLength"]);
      expect(activity.metadata.titleLength).toBe("IssuesEvent".length);
      const serialized = JSON.stringify(activity);
      // raw payload 본문이 산출 activity 어디에도 새지 않았음을 직렬화로 확인.
      expect(serialized).not.toContain("raw commit message 전문");
      expect(serialized).not.toContain("payload");
      expect(serialized).not.toContain("commits");
    });

    it("metadata value 는 원시 scalar(number) — 객체 그래프 유입 0", () => {
      const activity = mapRealDataGithubEventToActivity("u", eventOf({}));
      expect(typeof activity.metadata.titleLength).toBe("number");
    });
  });

  describe("순수성 / 입력 비변형 (부수효과 0)", () => {
    it("호출마다 새 GithubActivity 객체를 반환한다(참조 비동일)", () => {
      const event = eventOf({ type: "PushEvent" });
      const a = mapRealDataGithubEventToActivity("u", event);
      const b = mapRealDataGithubEventToActivity("u", event);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.metadata).not.toBe(b.metadata);
    });

    it("입력 event 객체를 mutate 하지 않는다", () => {
      const event = eventOf({ type: "PullRequestEvent", id: "x" });
      const snapshot = JSON.stringify(event);
      mapRealDataGithubEventToActivity("u", event);
      expect(JSON.stringify(event)).toBe(snapshot);
    });

    it("반환 타입이 GithubActivity 계약(sourceType 리터럴 'github') 을 만족", () => {
      const activity: GithubActivity = mapRealDataGithubEventToActivity(
        "u",
        eventOf({}),
      );
      expect(activity.sourceType).toBe("github");
    });
  });

  // self-wire drift-guard 배선 검증 (T-0982) — producer 가 반환 직전 consistency oracle 가드를
  // 스스로 호출해 매핑 즉시 자가 검증하는지를 R-112 4종(happy/error/flow/negative)으로 봉한다.
  describe("self-wire consistency guard (T-0982)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("happy-path (self-wire 배선 후에도 정합 activity 정상 반환 — throw 0)", () => {
      it("(i) PullRequestEvent(kind=pr) → throw 없이 정합 activity 반환", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            "myungjoo",
            eventOf({ type: "PullRequestEvent", id: "pr-1" }),
          ),
        ).not.toThrow();
        const activity = mapRealDataGithubEventToActivity(
          "myungjoo",
          eventOf({ type: "PullRequestEvent", id: "pr-1" }),
        );
        expect(activity.kind).toBe("pr");
      });

      it("(ii) IssuesEvent(kind=issue) → throw 없이 정합 activity 반환", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            "leemgs",
            eventOf({ type: "IssuesEvent", id: "iss-1" }),
          ),
        ).not.toThrow();
        const activity = mapRealDataGithubEventToActivity(
          "leemgs",
          eventOf({ type: "IssuesEvent", id: "iss-1" }),
        );
        expect(activity.kind).toBe("issue");
      });

      it("(iii) 그 외 type(kind=commit) → throw 없이 정합 activity 반환", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            "myungjoo",
            eventOf({ type: "PushEvent", id: "push-1" }),
          ),
        ).not.toThrow();
        const activity = mapRealDataGithubEventToActivity(
          "myungjoo",
          eventOf({ type: "PushEvent", id: "push-1" }),
        );
        expect(activity.kind).toBe("commit");
      });
    });

    describe("error-path (기존 방어 guard 가 self-wire 로 가려지지 않음)", () => {
      it("username 비-string → self-assert 의 TypeError 를 던진다", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            123 as unknown as string,
            eventOf({}),
          ),
        ).toThrow(TypeError);
      });

      it("event null → producer 자체 TypeError(가드 미도달)", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            "u",
            null as unknown as Record<string, unknown>,
          ),
        ).toThrow(TypeError);
      });

      it("event 비-객체(number) → self-assert 의 TypeError 를 던진다", () => {
        expect(() =>
          mapRealDataGithubEventToActivity(
            "u",
            42 as unknown as Record<string, unknown>,
          ),
        ).toThrow(TypeError);
      });
    });

    describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재 증명)", () => {
      it("PullRequestEvent 경로 → 가드가 (username, event, 반환 activity) 로 정확히 1 회 호출", () => {
        const spy = jest.spyOn(
          activityMapConsistency,
          "assertRealDataGithubEventActivityMappingConsistent",
        );
        const event = eventOf({ type: "PullRequestEvent", id: "s1" });
        const activity = mapRealDataGithubEventToActivity("myungjoo", event);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("myungjoo", event, activity);
      });

      it("commit 경로(그 외 type) → 가드가 반환 activity 인자로 정확히 1 회 호출", () => {
        const spy = jest.spyOn(
          activityMapConsistency,
          "assertRealDataGithubEventActivityMappingConsistent",
        );
        const event = eventOf({ type: "PushEvent", id: "s2" });
        const activity = mapRealDataGithubEventToActivity("leemgs", event);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("leemgs", event, activity);
        expect(activity.kind).toBe("commit");
      });
    });

    describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
      it("(a) 가드가 drift 감지해 RangeError throw → producer 가 동일 RangeError 전파(silent 삼킴 0)", () => {
        const drift = new RangeError("정합 위반: 강제 drift(테스트)");
        jest
          .spyOn(
            activityMapConsistency,
            "assertRealDataGithubEventActivityMappingConsistent",
          )
          .mockImplementation(() => {
            throw drift;
          });

        expect(() =>
          mapRealDataGithubEventToActivity(
            "myungjoo",
            eventOf({ type: "PullRequestEvent", id: "d1" }),
          ),
        ).toThrow(drift);
      });

      it("(b) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 activity 는 새 객체, 입력 event/username 미변형", () => {
        const event = eventOf({ type: "IssuesEvent", id: "n1" });
        const snapshot = JSON.stringify(event);

        const a = mapRealDataGithubEventToActivity("myungjoo", event);
        const b = mapRealDataGithubEventToActivity("myungjoo", event);

        // 입력 event 미변형.
        expect(JSON.stringify(event)).toBe(snapshot);
        // 반환 activity 는 매 호출 새 객체(공유 노출 0).
        expect(a).toEqual(b);
        expect(a).not.toBe(b);
        expect(a.metadata).not.toBe(b.metadata);
      });
    });
  });
});

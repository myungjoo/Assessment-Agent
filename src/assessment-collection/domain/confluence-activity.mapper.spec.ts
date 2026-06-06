// confluence-activity.mapper 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover + raw-not-stored 단언). collection slice (i),
// ADR-0029 Decision §2. live/credentialed test 0 — fixture 입력만(Q-0025 deferred).

import { mapConfluenceActivity } from "./confluence-activity.mapper";

// 공통 호출 context — orchestrator 가 주입하는 instance/SPACE 식별자(raw page 밖).
const INSTANCE = "confluence-sec";
const SPACE = "ENG";

// 정상 Confluence page item fixture(Cloud, accountId) — page 본문 HTML 을 일부러 넣어
// mapper 가 그를 누출하지 않음(raw-not-stored)을 함께 검증한다.
function cloudPage(): unknown {
  return {
    id: "123456",
    title: "설계 문서",
    version: {
      number: 3,
      when: "2026-06-01T09:00:00Z",
      by: { accountId: "acct-789" },
    },
    // raw page 본문 HTML — mapper 가 절대 추출하면 안 되는 raw 본문.
    body: {
      storage: { value: "<p>page 본문 HTML raw body must not leak</p>" },
    },
  };
}

// 정상 Server page item fixture(username, number id 변형).
function serverPage(): unknown {
  return {
    id: 654321,
    title: "운영 문서",
    version: {
      number: 1,
      when: "2026-06-02T10:00:00Z",
      by: { username: "ops-user" },
    },
  };
}

describe("mapConfluenceActivity", () => {
  describe("happy path (R-112-1)", () => {
    it("Cloud page(accountId)를 ConfluenceActivity 로 매핑한다", () => {
      const result = mapConfluenceActivity(cloudPage(), INSTANCE, SPACE);
      expect(result).toEqual({
        externalId: "123456",
        sourceType: "confluence",
        instanceKey: "confluence-sec",
        author: "acct-789",
        timestamp: "2026-06-01T09:00:00Z",
        spaceRef: "ENG",
        version: 3,
        metadata: { titleLength: "설계 문서".length },
      });
    });

    it("Server page(number id + username)를 매핑한다", () => {
      const result = mapConfluenceActivity(serverPage(), INSTANCE, SPACE);
      expect(result).toMatchObject({
        externalId: "654321",
        author: "ops-user",
        version: 1,
      });
    });
  });

  describe("raw-not-stored 단언 (R-112-4)", () => {
    it("출력 key 집합이 typed 필드로 한정되고 page 본문 HTML 이 누출되지 않는다", () => {
      const result = mapConfluenceActivity(cloudPage(), INSTANCE, SPACE);
      expect(result).not.toBeNull();
      expect(Object.keys(result as object).sort()).toEqual(
        [
          "author",
          "externalId",
          "instanceKey",
          "metadata",
          "sourceType",
          "spaceRef",
          "timestamp",
          "version",
        ].sort(),
      );
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("raw body must not leak");
      // 원본 title 문자열 자체는 metadata 에 없다(길이 number 만).
      expect(serialized).not.toContain("설계 문서");
    });
  });

  describe("error / negative path (R-112-2, R-112-3 branch)", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["number primitive", 42],
      ["string primitive", "not-an-object"],
      ["boolean primitive", false],
      ["array", [{ id: "1" }]],
    ])("비-객체 raw(%s)는 null 을 반환한다", (_label, raw) => {
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("빈 객체는 식별 필드 전무로 null 을 반환한다", () => {
      expect(mapConfluenceActivity({}, INSTANCE, SPACE)).toBeNull();
    });

    it("id 부재면 externalId 미해소로 null", () => {
      const raw = {
        version: {
          number: 1,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("id 가 빈 문자열이면 null", () => {
      const raw = { ...(cloudPage() as object), id: "  " };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("id 가 비-finite number(NaN)면 null", () => {
      const raw = {
        id: Number.NaN,
        version: {
          number: 1,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("version 객체 부재면 null(version 미해소)", () => {
      const raw = { id: "1", title: "t" };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("version 이 비-객체(number)면 null", () => {
      const raw = { id: "1", version: 3 };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("version.number 가 비-number 면 null(type mismatch)", () => {
      const raw = {
        id: "1",
        version: {
          number: "3",
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("version.number 가 비-finite 면 null", () => {
      const raw = {
        id: "1",
        version: {
          number: Number.POSITIVE_INFINITY,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("author 부재(by 객체 없음)면 null", () => {
      const raw = {
        id: "1",
        version: { number: 2, when: "2026-06-01T09:00:00Z" },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("by 가 비-객체면 null(author 미해소)", () => {
      const raw = {
        id: "1",
        version: { number: 2, when: "2026-06-01T09:00:00Z", by: "x" },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("accountId 부재 시 username 으로 fallback 한다", () => {
      const raw = {
        id: "1",
        version: {
          number: 2,
          when: "2026-06-01T09:00:00Z",
          by: { username: "u" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)?.author).toBe("u");
    });

    it("accountId·username 모두 비-string 이면 null", () => {
      const raw = {
        id: "1",
        version: {
          number: 2,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: 1, username: 2 },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("timestamp(version.when) 부재면 null", () => {
      const raw = { id: "1", version: { number: 2, by: { accountId: "a" } } };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("version.when 이 비-string 이면 null(type mismatch)", () => {
      const raw = {
        id: "1",
        version: { number: 2, when: 1234567890, by: { accountId: "a" } },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)).toBeNull();
    });

    it("title 부재면 metadata 가 빈 객체다(메타 분기 negative)", () => {
      const raw = {
        id: "1",
        version: {
          number: 2,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)?.metadata).toEqual({});
    });

    it("title 이 비-string 이면 metadata 에 titleLength 미포함", () => {
      const raw = {
        id: "1",
        title: 999,
        version: {
          number: 2,
          when: "2026-06-01T09:00:00Z",
          by: { accountId: "a" },
        },
      };
      expect(mapConfluenceActivity(raw, INSTANCE, SPACE)?.metadata).toEqual({});
    });
  });
});

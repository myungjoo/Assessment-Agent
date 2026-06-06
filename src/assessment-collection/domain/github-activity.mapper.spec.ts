// github-activity.mapper 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover + raw-not-stored 단언). collection slice (i), ADR-0029
// Decision §2. live/credentialed test 0 — fixture 입력만(Q-0025 deferred).

import { mapGithubActivity } from "./github-activity.mapper";

// 공통 호출 context — orchestrator 가 주입하는 instance/repo 식별자(raw item 밖).
const INSTANCE = "sec";
const REPO = "octo-org/octo-repo";

// 정상 commit list item fixture — raw 본문(message 전문)을 일부러 넣어, mapper 가 그를
// 누출하지 않음(raw-not-stored)을 함께 검증한다.
function commitItem(): unknown {
  return {
    sha: "abc123def456",
    // raw commit message 전문 — mapper 가 절대 추출하면 안 되는 raw 본문.
    commit: {
      message:
        "feat: 매우 긴 commit message 전문 본문 ... raw body must not leak",
      author: { name: "홍길동", date: "2026-06-01T09:00:00Z" },
    },
    author: { login: "gildong" },
  };
}

// 정상 PR list item fixture — title 과 pull_request 하위 객체 포함.
function prItem(): unknown {
  return {
    number: 42,
    title: "PR 제목",
    pull_request: {
      url: "https://api.github.com/repos/octo-org/octo-repo/pulls/42",
    },
    user: { login: "octocat" },
    created_at: "2026-06-02T10:00:00Z",
    // raw body — 누출 금지.
    body: "PR 본문 전문 raw body must not leak",
  };
}

// 정상 issue list item fixture — number 만 있고 pull_request 부재.
function issueItem(): unknown {
  return {
    number: 7,
    title: "이슈 제목",
    user: { login: "issuer" },
    created_at: "2026-06-03T11:00:00Z",
  };
}

describe("mapGithubActivity", () => {
  describe("happy path (R-112-1)", () => {
    it("commit item 을 GithubActivity(kind=commit)로 매핑한다", () => {
      const result = mapGithubActivity(commitItem(), INSTANCE, REPO);
      expect(result).toEqual({
        externalId: "abc123def456",
        sourceType: "github",
        instanceKey: "sec",
        author: "gildong",
        timestamp: "2026-06-01T09:00:00Z",
        repoRef: "octo-org/octo-repo",
        kind: "commit",
        metadata: {},
      });
    });

    it("PR item 을 GithubActivity(kind=pr)로 매핑하고 titleLength 메타를 담는다", () => {
      const result = mapGithubActivity(prItem(), INSTANCE, REPO);
      expect(result).toMatchObject({
        externalId: "42",
        kind: "pr",
        author: "octocat",
        timestamp: "2026-06-02T10:00:00Z",
        metadata: { titleLength: "PR 제목".length },
      });
    });

    it("issue item 을 GithubActivity(kind=issue)로 매핑한다", () => {
      const result = mapGithubActivity(issueItem(), INSTANCE, REPO);
      expect(result).toMatchObject({ externalId: "7", kind: "issue" });
    });
  });

  describe("raw-not-stored 단언 (R-112-4)", () => {
    it("commit 출력 key 집합이 typed 필드로 한정되고 raw message 가 누출되지 않는다", () => {
      const result = mapGithubActivity(commitItem(), INSTANCE, REPO);
      expect(result).not.toBeNull();
      // 출력 key 는 정확히 typed 필드 8 종.
      expect(Object.keys(result as object).sort()).toEqual(
        [
          "author",
          "externalId",
          "instanceKey",
          "kind",
          "metadata",
          "repoRef",
          "sourceType",
          "timestamp",
        ].sort(),
      );
      // 직렬화한 출력 어디에도 raw commit message 전문이 없다.
      expect(JSON.stringify(result)).not.toContain("raw body must not leak");
    });

    it("PR 출력에 raw body 가 누출되지 않고 title 은 길이만 담는다", () => {
      const result = mapGithubActivity(prItem(), INSTANCE, REPO);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("raw body must not leak");
      // 원본 title 문자열 자체는 metadata 에 없다(길이 number 만).
      expect(serialized).not.toContain("PR 제목");
    });
  });

  describe("error / negative path (R-112-2, R-112-3 branch)", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["number primitive", 42],
      ["string primitive", "not-an-object"],
      ["boolean primitive", true],
      ["array", [{ sha: "x" }]],
    ])("비-객체 raw(%s)는 null 을 반환한다", (_label, raw) => {
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("빈 객체는 식별 필드 전무로 null 을 반환한다", () => {
      expect(mapGithubActivity({}, INSTANCE, REPO)).toBeNull();
    });

    it("externalId 부재(sha·number 모두 없음)면 null", () => {
      const raw = {
        commit: { author: { date: "2026-06-01T09:00:00Z" } },
        author: { login: "x" },
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("sha 가 빈 문자열이면 externalId 미해소로 null", () => {
      const raw = { ...(commitItem() as object), sha: "   " };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("number 가 비-finite(NaN)면 externalId 미해소로 null", () => {
      const raw = {
        number: Number.NaN,
        user: { login: "x" },
        created_at: "2026-06-02T10:00:00Z",
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("author 부재(commit author.login 도 user.login 도 없음)면 null", () => {
      const raw = {
        sha: "abc",
        commit: { author: { date: "2026-06-01T09:00:00Z" } },
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("author 객체가 비-string login 이면 user.login 으로 fallback 한다", () => {
      const raw = {
        number: 5,
        author: { login: 123 },
        user: { login: "fallback-user" },
        created_at: "2026-06-02T10:00:00Z",
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)?.author).toBe(
        "fallback-user",
      );
    });

    it("timestamp 부재(commit.author.date 도 created_at 도 없음)면 null", () => {
      const raw = { sha: "abc", author: { login: "x" } };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("timestamp 가 비-string 이면 null(type mismatch)", () => {
      const raw = { number: 9, user: { login: "x" }, created_at: 1234567890 };
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("commit 의 commit.author 가 비-객체면 commit date 분기를 건너뛰고 created_at 로 해소", () => {
      const raw = {
        sha: "abc",
        commit: { author: "not-an-object" },
        author: { login: "x" },
        created_at: "2026-06-04T12:00:00Z",
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)?.timestamp).toBe(
        "2026-06-04T12:00:00Z",
      );
    });

    it("kind 미해소(sha·pull_request·number 전무)면 null", () => {
      const raw = {
        author: { login: "x" },
        created_at: "2026-06-02T10:00:00Z",
        title: "t",
      };
      // externalId 도 number 부재로 미해소 → null. kind 분기 자체도 미해소.
      expect(mapGithubActivity(raw, INSTANCE, REPO)).toBeNull();
    });

    it("title 부재면 metadata 가 빈 객체다(메타 분기 negative)", () => {
      const raw = {
        number: 11,
        user: { login: "x" },
        created_at: "2026-06-02T10:00:00Z",
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)?.metadata).toEqual({});
    });

    it("title 이 비-string 이면 metadata 에 titleLength 미포함", () => {
      const raw = {
        number: 12,
        title: 999,
        user: { login: "x" },
        created_at: "2026-06-02T10:00:00Z",
      };
      expect(mapGithubActivity(raw, INSTANCE, REPO)?.metadata).toEqual({});
    });
  });
});

// github-activity.mapper 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover + raw-not-stored 단언). collection slice (i), ADR-0029
// Decision §2. live/credentialed test 0 — fixture 입력만(Q-0025 deferred).

import { computeAlgorithmResearchHits } from "./algorithm-research-signal";
import { computeCommitContentFingerprint } from "./commit-content-fingerprint";
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
        // commit 은 내용 지문 메타를 함께 담는다(ADR-0063 § Decision 1).
        metadata: { contentFingerprint: expect.any(String) },
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

  describe("content 지문 배선 (ADR-0063 § Decision 1·4·6)", () => {
    const COMMIT_MESSAGE = (commitItem() as { commit: { message: string } })
      .commit.message;

    it("commit 은 metadata.contentFingerprint 를 helper 산출값(hex 64 자) 그대로 담는다", () => {
      const result = mapGithubActivity(commitItem(), INSTANCE, REPO);
      expect(result?.metadata.contentFingerprint).toBe(
        computeCommitContentFingerprint(COMMIT_MESSAGE),
      );
      expect(result?.metadata.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it.each([
      ["raw.commit 부재", { sha: "s1" }],
      ["commit.message 부재", { sha: "s2", commit: { note: "x" } }],
      ["commit.message 비-string", { sha: "s3", commit: { message: 123 } }],
      ["하한 미달 message", { sha: "s4", commit: { message: "fix typo" } }],
    ])(
      "%s 면 지문 키 자체가 미포함이고 기존 매핑은 깨지지 않는다",
      (_l, extra) => {
        const raw = {
          ...(extra as object),
          author: { login: "gildong" },
          created_at: "2026-06-01T09:00:00Z",
        };
        const result = mapGithubActivity(raw, INSTANCE, REPO);
        expect(result?.kind).toBe("commit");
        expect(result?.author).toBe("gildong");
        expect(result?.metadata).not.toHaveProperty("contentFingerprint");
      },
    );

    it.each([
      ["pr", prItem()],
      ["issue", issueItem()],
    ])(
      "kind=%s 는 commit.message 가 있어도 지문을 산출하지 않는다",
      (_l, item) => {
        // 긴 commit.message 를 일부러 심어도 § Decision 6 대로 미산출.
        const raw = {
          ...(item as object),
          commit: { message: COMMIT_MESSAGE },
        };
        const result = mapGithubActivity(raw, INSTANCE, REPO);
        expect(result?.metadata).not.toHaveProperty("contentFingerprint");
        // 기존 titleLength 메타 동작은 회귀 없이 유지된다.
        expect(result?.metadata.titleLength).toBeGreaterThan(0);
      },
    );
  });

  describe("algorithmResearchHits 배선 (ADR-0064 § Decision 1·2)", () => {
    // issue raw 조립기 — title 만 바꿔가며 kind=issue 분기를 태운다. `title` 인자를
    // 생략하면 title 키 자체가 없는 raw 가 된다(키 부재 분기).
    function issueWith(...title: unknown[]): Record<string, unknown> {
      const raw: Record<string, unknown> = {
        number: 21,
        user: { login: "issuer" },
        created_at: "2026-06-05T12:00:00Z",
      };
      if (title.length > 0) {
        raw.title = title[0];
      }
      return raw;
    }

    it.each([
      ["(C)+(A) 형식·알고리즘", "새 정렬 알고리즘 설계안 소개"],
      ["(C)+(B) 형식·연구 (대소문자 무시)", "arXiv 논문 정리"],
    ])("%s title 을 가진 issue 는 hits 2 를 담는다", (_l, title) => {
      const result = mapGithubActivity(issueWith(title), INSTANCE, REPO);
      expect(result?.kind).toBe("issue");
      expect(result?.metadata.algorithmResearchHits).toBe(2);
      // mapper 는 판별을 복제하지 않고 helper 산출값을 그대로 싣는다.
      expect(result?.metadata.algorithmResearchHits).toBe(
        computeAlgorithmResearchHits(title),
      );
    });

    it.each([
      ["(C) 단독", "온보딩 문서 정리", 1],
      ["3 그룹 동시 매칭", "SOTA heuristic tutorial", 3],
    ])("%s title(%s) 은 hits %i 를 담는다", (_l, title, hits) => {
      expect(
        mapGithubActivity(issueWith(title), INSTANCE, REPO)?.metadata
          .algorithmResearchHits,
      ).toBe(hits);
    });

    it.each([
      ["number", 999],
      ["null", null],
      ["객체", { text: "알고리즘 소개" }],
      ["배열", ["연구 정리"]],
      ["boolean", true],
    ])(
      "title 이 비-string(%s)인 issue 는 throw 0 이고 키를 담지 않는다",
      (_l, title) => {
        const call = () => mapGithubActivity(issueWith(title), INSTANCE, REPO);
        expect(call).not.toThrow();
        expect(call()?.metadata).not.toHaveProperty("algorithmResearchHits");
      },
    );

    it("title 키가 아예 없는 issue 도 throw 0 이고 키를 담지 않는다", () => {
      const call = () => mapGithubActivity(issueWith(), INSTANCE, REPO);
      expect(call).not.toThrow();
      expect(call()?.metadata).toEqual({});
    });

    it.each([
      ["marker 무관 title", "이슈 제목"],
      ["빈 문자열 title", ""],
      ["공백만 있는 title", "   "],
    ])("%s 인 issue 는 키를 담지 않는다", (_l, title) => {
      expect(
        mapGithubActivity(issueWith(title), INSTANCE, REPO)?.metadata,
      ).not.toHaveProperty("algorithmResearchHits");
    });

    it.each([
      ["pr", { ...(prItem() as object), title: "SOTA algorithm 소개" }],
      ["commit", { ...(commitItem() as object), title: "SOTA algorithm 소개" }],
    ])(
      "kind=%s 는 marker 만점 title 이어도 키를 담지 않는다(대상 kind 한정)",
      (_l, raw) => {
        // 같은 title 이 issue 였다면 3 이었음을 대조로 고정한다.
        expect(computeAlgorithmResearchHits("SOTA algorithm 소개")).toBe(3);
        const result = mapGithubActivity(raw, INSTANCE, REPO);
        expect(result?.metadata).not.toHaveProperty("algorithmResearchHits");
      },
    );

    it("issue 에서 titleLength 와 공존하고 기존 메타가 회귀하지 않는다", () => {
      const title = "새 정렬 알고리즘 설계안 소개";
      const result = mapGithubActivity(issueWith(title), INSTANCE, REPO);
      expect(result?.metadata).toEqual({
        titleLength: title.length,
        algorithmResearchHits: 2,
      });
    });

    it("commit metadata 계약은 지문 단독으로 불변이다", () => {
      const raw = { ...(commitItem() as object), title: "알고리즘 소개" };
      expect(mapGithubActivity(raw, INSTANCE, REPO)?.metadata).toEqual({
        titleLength: "알고리즘 소개".length,
        contentFingerprint: expect.any(String),
      });
    });

    it("raw title 문자열 자체는 반환 객체 어디에도 누출되지 않는다(REQ-032)", () => {
      const title = "새 정렬 알고리즘 설계안 소개";
      const serialized = JSON.stringify(
        mapGithubActivity(issueWith(title), INSTANCE, REPO),
      );
      expect(serialized).not.toContain(title);
      expect(serialized).not.toContain("알고리즘");
      expect(serialized).toContain("algorithmResearchHits");
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

// commit-dedup 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch / negative
// cases 충분 cover). collection slice (ii), ADR-0029 Decision §4(commit SHA earliest-
// wins dedup) + ADR-0063 Decision §4/§5/§6(pass 2 내용 지문 dedup — 키 합성 · 통과
// 조건 · 직렬 합성 · 결정성). 부수효과 0 순수 함수만 검증 — adapter mock 0.

import { ActivityMetadataValue, GithubActivity } from "./activity";
import {
  dedupGithubActivities,
  dedupGithubActivitiesByContent,
} from "./commit-dedup";

// commit — 주어진 SHA / timestamp / repoRef 로 commit 활동 fixture 를 만든다.
function commit(
  sha: string,
  timestamp: string,
  repoRef = "octo-org/octo-repo",
): GithubActivity {
  return {
    externalId: sha,
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp,
    repoRef,
    kind: "commit",
    metadata: {},
  };
}

// pr — 주어진 number / timestamp / repoRef 로 PR 활동 fixture 를 만든다.
function pr(
  number: string,
  timestamp: string,
  repoRef = "octo-org/octo-repo",
): GithubActivity {
  return {
    externalId: number,
    sourceType: "github",
    instanceKey: "sec",
    author: "octocat",
    timestamp,
    repoRef,
    kind: "pr",
    metadata: {},
  };
}

describe("dedupGithubActivities", () => {
  describe("happy path (R-112-1)", () => {
    it("무중복 입력은 그대로(순서 보존) 반환한다", () => {
      const input = [
        commit("aaa", "2026-06-01T09:00:00Z"),
        commit("bbb", "2026-06-02T09:00:00Z"),
        pr("42", "2026-06-03T09:00:00Z"),
      ];
      const result = dedupGithubActivities(input);
      expect(result).toEqual(input);
    });

    it("빈 배열은 빈 배열을 반환한다", () => {
      expect(dedupGithubActivities([])).toEqual([]);
    });

    it("입력 배열을 변형하지 않는다(부수효과 0)", () => {
      const input = [
        commit("aaa", "2026-06-02T09:00:00Z"),
        commit("aaa", "2026-06-01T09:00:00Z"),
      ];
      const snapshot = JSON.parse(JSON.stringify(input));
      dedupGithubActivities(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe("commit SHA earliest-wins (R-112-3 branch, R-112-4 negative)", () => {
    it("같은 SHA 2건 중 첫째가 earlier 면 첫째를 유지한다(i)", () => {
      const earlier = commit("dup", "2026-06-01T09:00:00Z", "org/repo-a");
      const later = commit("dup", "2026-06-05T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([earlier, later]);
      expect(result).toEqual([earlier]);
    });

    it("같은 SHA 2건 중 둘째가 earlier 면 둘째를 유지한다(ii)", () => {
      const later = commit("dup", "2026-06-05T09:00:00Z", "org/repo-a");
      const earlier = commit("dup", "2026-06-01T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([later, earlier]);
      // earlier 항목이 살아남되, 반환 위치는 키 최초 등장(=later 의 index 0) 기준.
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(earlier);
    });

    it("같은 SHA·동일 timestamp 면 먼저 등장한 항목을 유지한다(iii tie-break)", () => {
      const first = commit("dup", "2026-06-01T09:00:00Z", "org/repo-a");
      const second = commit("dup", "2026-06-01T09:00:00Z", "org/repo-b");
      const result = dedupGithubActivities([first, second]);
      expect(result).toEqual([first]);
    });

    it("같은 SHA 3건이면 최earliest 1건만 유지한다", () => {
      const a = commit("dup", "2026-06-03T09:00:00Z");
      const b = commit("dup", "2026-06-01T09:00:00Z");
      const c = commit("dup", "2026-06-02T09:00:00Z");
      const result = dedupGithubActivities([a, b, c]);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe("2026-06-01T09:00:00Z");
    });

    it("서로 다른 SHA 는 timestamp 무관하게 모두 유지된다", () => {
      const input = [
        commit("aaa", "2026-06-05T09:00:00Z"),
        commit("bbb", "2026-06-01T09:00:00Z"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });

    it("비-파싱 timestamp 는 사전식 fallback 비교로 결정적 dedup 한다", () => {
      // Date.parse 가 NaN 인 timestamp → 문자열 비교 fallback 분기 cover.
      const a = commit("dup", "zzz-invalid");
      const b = commit("dup", "aaa-invalid");
      const result = dedupGithubActivities([a, b]);
      expect(result).toHaveLength(1);
      // "aaa-invalid" < "zzz-invalid" 이므로 b 가 earlier 로 유지.
      expect(result[0].timestamp).toBe("aaa-invalid");
    });
  });

  describe("pr / issue dedup (R-112-3 branch)", () => {
    it("같은 repo·같은 PR number 는 1건으로 dedup 된다", () => {
      const input = [
        pr("42", "2026-06-01T09:00:00Z"),
        pr("42", "2026-06-02T09:00:00Z"),
      ];
      const result = dedupGithubActivities(input);
      expect(result).toHaveLength(1);
      // earlier-wins tie-break 동일 적용.
      expect(result[0].timestamp).toBe("2026-06-01T09:00:00Z");
    });

    it("다른 repo 의 동일 PR number 는 별개 활동으로 보존된다", () => {
      const input = [
        pr("42", "2026-06-01T09:00:00Z", "org/repo-a"),
        pr("42", "2026-06-01T09:00:00Z", "org/repo-b"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });

    it("같은 SHA commit 과 같은 number 의 pr 은 키가 달라 충돌하지 않는다", () => {
      const input = [
        commit("42", "2026-06-01T09:00:00Z"),
        pr("42", "2026-06-01T09:00:00Z"),
      ];
      expect(dedupGithubActivities(input)).toHaveLength(2);
    });
  });
});

// fp — pass 2 용 commit fixture. 지문(`metadata.contentFingerprint`)과 author 를 지정해
// 키 합성(`content:<author>:<digest>`) 축을 분리 검증한다. fingerprint 를 생략하면
// metadata 를 빈 객체로 둔다(지문 부재 활동 = 키 대상 아님).
function fp(
  sha: string,
  ts: string,
  fingerprint?: ActivityMetadataValue,
  author = "gildong",
): GithubActivity {
  return {
    ...commit(sha, ts),
    author,
    metadata:
      fingerprint === undefined ? {} : { contentFingerprint: fingerprint },
  };
}

// mapper 가 산출하는 sha256 hex digest 자리표시 — 값 자체는 pass 2 에 불투명하고
// 동일성만 의미가 있다.
const DIGEST_A = "a".repeat(64);

describe("dedupGithubActivitiesByContent", () => {
  describe("happy path (R-112-1)", () => {
    it("SHA 는 다르고 author·지문이 같은 commit 2건은 earliest 1건으로 접힌다", () => {
      const orig = fp("s1", "2026-02-01T09:00:00Z", DIGEST_A);
      const copy = fp("s2", "2026-03-01T09:00:00Z", DIGEST_A);
      expect(dedupGithubActivitiesByContent([copy, orig])).toEqual([orig]);
    });
  });

  describe("error path (R-112-2)", () => {
    it("빈 배열은 빈 배열을 반환한다", () => {
      expect(dedupGithubActivitiesByContent([])).toEqual([]);
    });

    it("metadata 가 빈 객체인 활동은 throw 없이 원본 그대로 통과한다", () => {
      const input = [fp("s1", "2026-06-01T09:00:00Z")];
      expect(() => dedupGithubActivitiesByContent(input)).not.toThrow();
      expect(dedupGithubActivitiesByContent(input)).toEqual(input);
    });

    it("contentFingerprint 가 비-string(number/null/boolean)이어도 통과시킨다", () => {
      const input = [
        fp("s1", "2026-06-01T09:00:00Z", 42),
        fp("s2", "2026-06-01T09:00:00Z", null),
        fp("s3", "2026-06-01T09:00:00Z", true),
      ];
      expect(dedupGithubActivitiesByContent(input)).toEqual(input);
    });
  });

  describe("키 합성 분기 (R-112-3 branch)", () => {
    it("지문이 같아도 author 가 다르면 접히지 않는다", () => {
      const input = [
        fp("s1", "2026-06-01T09:00:00Z", DIGEST_A, "gildong"),
        fp("s2", "2026-06-02T09:00:00Z", DIGEST_A, "chulsoo"),
      ];
      expect(dedupGithubActivitiesByContent(input)).toHaveLength(2);
    });

    it("같은 지문·author 이면 repoRef 가 달라도 접힌다(키에 repoRef 미포함)", () => {
      const a = {
        ...fp("s1", "2026-06-01T09:00:00Z", DIGEST_A),
        repoRef: "o/a",
      };
      const b = {
        ...fp("s2", "2026-06-05T09:00:00Z", DIGEST_A),
        repoRef: "o/b",
      };
      expect(dedupGithubActivitiesByContent([a, b])).toEqual([a]);
    });

    it("pr / issue 는 지문이 실려 있어도 키 대상이 아니라 접히지 않는다", () => {
      const meta = { contentFingerprint: DIGEST_A };
      const p1 = { ...pr("42", "2026-06-01T09:00:00Z"), metadata: meta };
      const p2 = { ...pr("43", "2026-06-02T09:00:00Z"), metadata: meta };
      const issue: GithubActivity = { ...p1, externalId: "7", kind: "issue" };
      expect(dedupGithubActivitiesByContent([p1, p2, issue])).toHaveLength(3);
    });

    it("pass 1 → pass 2 직렬 순서에서 SHA 중복이 먼저 접힌 뒤 지문 중복이 접힌다", () => {
      const early = fp("dup", "2026-02-01T09:00:00Z", DIGEST_A);
      const sameSha = fp("dup", "2026-04-01T09:00:00Z", DIGEST_A);
      const copy = fp("s2", "2026-03-01T09:00:00Z", DIGEST_A);
      const pass1 = dedupGithubActivities([sameSha, early, copy]);
      expect(pass1).toHaveLength(2);
      expect(dedupGithubActivitiesByContent(pass1)).toEqual([early]);
    });
  });

  describe("negative case (R-112-4)", () => {
    it("동일 timestamp tie 는 먼저 등장한 항목을 유지한다", () => {
      const first = fp("s1", "2026-06-01T09:00:00Z", DIGEST_A);
      const second = fp("s2", "2026-06-01T09:00:00Z", DIGEST_A);
      expect(dedupGithubActivitiesByContent([first, second])).toEqual([first]);
    });

    it("통과 활동과 접힌 활동이 섞여도 반환 순서가 최초 등장 위치 기준으로 안정적이다", () => {
      const plain = fp("s0", "2026-06-09T09:00:00Z");
      const late = fp("s1", "2026-06-08T09:00:00Z", DIGEST_A);
      const other = pr("42", "2026-06-07T09:00:00Z");
      const early = fp("s2", "2026-01-01T09:00:00Z", DIGEST_A);
      const result = dedupGithubActivitiesByContent([
        plain,
        late,
        other,
        early,
      ]);
      // early 가 승자지만 위치는 그 키의 최초 등장(index 1) 자리를 유지한다.
      expect(result).toEqual([plain, early, other]);
    });

    it("입력 배열을 변형하지 않는다(부수효과 0)", () => {
      const input = [
        fp("s1", "2026-06-02T09:00:00Z", DIGEST_A),
        fp("s2", "2026-06-01T09:00:00Z", DIGEST_A),
      ];
      const snapshot = [...input];
      dedupGithubActivitiesByContent(input);
      expect(input).toEqual(snapshot);
    });

    it("지문 없는 commit 2건은 서로 병합되지 않는다(하한 미달 오탐 차단)", () => {
      const input = [
        fp("s1", "2026-06-01T09:00:00Z"),
        fp("s2", "2026-06-02T09:00:00Z"),
      ];
      expect(dedupGithubActivitiesByContent(input)).toEqual(input);
    });

    it("pass 1 회귀 무영향 — 지문 없는 pass 1 결과를 그대로 통과시킨다", () => {
      const pass1 = dedupGithubActivities([
        commit("dup", "2026-06-02T09:00:00Z"),
        commit("dup", "2026-06-01T09:00:00Z"),
        pr("42", "2026-06-03T09:00:00Z"),
      ]);
      expect(dedupGithubActivitiesByContent(pass1)).toEqual(pass1);
    });
  });
});

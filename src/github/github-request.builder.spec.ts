// GithubAdapter 순수 request-builder spec — T-0174. 순수 함수 R-112 4 종(happy/
// error/branch/negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접
// 단언. T-0157 openai-compatible.adapter.spec 스타일 mirror (부수효과 0 / 외부 의존
// 0). ADR-0016 §2(3 host variant base URL 라우팅) + §3(auth header shape) 만 대상.
import {
  GITHUB_API_VERSION,
  GithubRequestInput,
  buildGithubRequest,
  resolveGithubApiBaseUrl,
} from "./github-request.builder";

// 유효한 buildGithubRequest 입력 fixture — negative case 는 이 base 에서 1 필드만
// 변형해 격리 검증. host=public github.com, plaintext token, list endpoint path.
function validInput(): GithubRequestInput {
  return {
    host: "github.com",
    token: "plaintext-token",
    path: "/repos/acme/widgets/commits",
  };
}

describe("GITHUB_API_VERSION", () => {
  it("ADR-0016 §3 의 pin 된 GitHub REST API 버전 상수다 (happy)", () => {
    // 상수 값이 계약과 일치해야 X-GitHub-Api-Version header 가 옳게 박힌다.
    expect(GITHUB_API_VERSION).toBe("2022-11-28");
  });
});

describe("resolveGithubApiBaseUrl", () => {
  it("public github.com 은 분리된 api.github.com 으로 라우팅한다 (happy + branch: public)", () => {
    expect(resolveGithubApiBaseUrl("github.com")).toBe(
      "https://api.github.com",
    );
  });

  it("host 매칭은 case-insensitive 다 — GitHub.com 도 public 분기 (branch: public, case)", () => {
    expect(resolveGithubApiBaseUrl("GitHub.com")).toBe(
      "https://api.github.com",
    );
  });

  it.each<[string]>([["github.sec.samsung.net"], ["github.ecodesamsung.com"]])(
    "Enterprise host %s 는 같은 host 아래 /api/v3 로 라우팅한다 (happy + branch: enterprise)",
    (host) => {
      expect(resolveGithubApiBaseUrl(host)).toBe(`https://${host}/api/v3`);
    },
  );

  it("protocol prefix + trailing slash 가 섞여도 public 으로 정규화한다 (branch: normalize → public)", () => {
    // "https://github.com/" 는 normalizeHost 후 "github.com" 으로 매칭돼 public.
    expect(resolveGithubApiBaseUrl("https://github.com/")).toBe(
      "https://api.github.com",
    );
  });

  it("Enterprise host 의 protocol prefix + trailing slash 도 정규화한다 (branch: normalize → enterprise)", () => {
    // 정규화된 host 로 /api/v3 를 조립 — 입력의 https:// 와 trailing slash 제거.
    expect(resolveGithubApiBaseUrl("http://github.sec.samsung.net/")).toBe(
      "https://github.sec.samsung.net/api/v3",
    );
  });

  // negative — 빈/공백 문자열 host 는 assertNonEmpty guard 에서 throw.
  it.each<[string, string]>([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("host 가 %s 이면 Error throw (negative: empty/blank)", (_label, host) => {
    expect(() => resolveGithubApiBaseUrl(host)).toThrow("host");
  });

  // negative — 비-string host 는 assertNonEmpty 의 typeof 체크에서 throw.
  it.each<[string, unknown]>([
    ["number", 42],
    ["null", null],
    ["undefined", undefined],
  ])(
    "host 가 비-string(%s)이면 Error throw (negative: non-string)",
    (_label, host) => {
      expect(() => resolveGithubApiBaseUrl(host as unknown as string)).toThrow(
        "host",
      );
    },
  );

  it("정규화 후 빈 host(예: 'https://')는 Error throw (negative: normalize → empty)", () => {
    // protocol prefix 제거 후 host 가 비면 명확한 Error — silent 빈 url 조립 방지.
    expect(() => resolveGithubApiBaseUrl("https://")).toThrow("host");
  });
});

describe("buildGithubRequest", () => {
  it("정상 입력으로 url + 3 header 를 조립한다 (happy)", () => {
    const req = buildGithubRequest(validInput());
    // public base + 정규화된 path (leading slash 1 개로 join).
    expect(req.url).toBe("https://api.github.com/repos/acme/widgets/commits");
    // ADR-0016 §3 필수 header 3 종 전부 — Bearer token / Accept / 버전 pin.
    expect(req.headers).toEqual({
      Authorization: "Bearer plaintext-token",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    });
  });

  it("Enterprise host 입력 시 /api/v3 base 위에 path 를 조립한다 (happy + branch: enterprise base)", () => {
    const input = validInput();
    input.host = "github.sec.samsung.net";
    const req = buildGithubRequest(input);
    expect(req.url).toBe(
      "https://github.sec.samsung.net/api/v3/repos/acme/widgets/commits",
    );
  });

  it("X-GitHub-Api-Version header 가 GITHUB_API_VERSION 상수와 일치한다 (happy: 버전 pin)", () => {
    const req = buildGithubRequest(validInput());
    expect(req.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("path 에 leading slash 가 있든 없든 동일 url 을 만든다 (branch: leading slash 정규화)", () => {
    const withSlash = buildGithubRequest(validInput());
    const noSlash = buildGithubRequest({
      ...validInput(),
      path: "repos/acme/widgets/commits",
    });
    // 두 입력의 url 이 동일해야 — leading slash 유무가 결과에 영향 없음.
    expect(withSlash.url).toBe(noSlash.url);
    expect(noSlash.url).toBe(
      "https://api.github.com/repos/acme/widgets/commits",
    );
  });

  it("path 의 다중 leading slash 도 단일 slash 로 정규화한다 (branch: multi leading slash)", () => {
    const req = buildGithubRequest({
      ...validInput(),
      path: "///repos/acme/widgets/commits",
    });
    expect(req.url).toBe("https://api.github.com/repos/acme/widgets/commits");
  });

  it("query 가 주어지면 ?k=v&... 로 append 한다 (branch: query 유)", () => {
    const req = buildGithubRequest({
      ...validInput(),
      query: { per_page: "100", page: "2" },
    });
    expect(req.url).toBe(
      "https://api.github.com/repos/acme/widgets/commits?per_page=100&page=2",
    );
  });

  it("query 값을 URLSearchParams 로 인코딩한다 — special char 포함 (branch: query encoding)", () => {
    const req = buildGithubRequest({
      ...validInput(),
      query: { since: "2026-06-02T00:00:00Z", q: "a b&c=d" },
    });
    // 공백/&/= 등 special char 가 percent-encoding 되어야 — 깨진 query 방지.
    expect(req.url).toBe(
      "https://api.github.com/repos/acme/widgets/commits" +
        "?since=2026-06-02T00%3A00%3A00Z&q=a+b%26c%3Dd",
    );
  });

  it("query 가 빈 객체({})면 ? 를 붙이지 않는다 (branch: query 무 — empty object)", () => {
    const req = buildGithubRequest({ ...validInput(), query: {} });
    expect(req.url).not.toContain("?");
    expect(req.url).toBe("https://api.github.com/repos/acme/widgets/commits");
  });

  it("query 가 undefined 면 ? 를 붙이지 않는다 (branch: query 무 — undefined)", () => {
    const req = buildGithubRequest({ ...validInput(), query: undefined });
    expect(req.url).not.toContain("?");
    expect(req.url).toBe("https://api.github.com/repos/acme/widgets/commits");
  });

  // negative — 빈/공백 token / path / host 는 각각 명확한 Error throw.
  it.each<[string, unknown]>([
    ["token", ""],
    ["path", ""],
    ["host", ""],
    ["token", "   "],
    ["path", "   "],
    ["host", "   "],
  ])(
    "%s 가 비어있으면(%j) Error throw (negative: empty/blank)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildGithubRequest(input as unknown as GithubRequestInput),
      ).toThrow(field);
    },
  );

  // negative — 비-string token / path / host 는 assertNonEmpty 에서 throw.
  it.each<[string, unknown]>([
    ["token", null],
    ["path", 42],
    ["host", undefined],
    ["token", { not: "string" }],
  ])(
    "%s 가 비-string(%j)이면 Error throw (negative: non-string)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildGithubRequest(input as unknown as GithubRequestInput),
      ).toThrow(field);
    },
  );

  it("정규화 후 빈 host(예: 'https://')면 Error throw (negative: normalize → empty host)", () => {
    expect(() =>
      buildGithubRequest({ ...validInput(), host: "https://" }),
    ).toThrow("host");
  });

  it("token 은 Authorization header value 에만 등장하고 다른 곳에 누출되지 않는다 (security: no token leak)", () => {
    const secret = "super-secret-leak-canary-xyz";
    const req = buildGithubRequest({
      ...validInput(),
      token: secret,
      query: { per_page: "50" },
    });
    // token 은 url 어디에도 노출되면 안 된다(로그/직렬화 누출 방지, ADR-0016 §3).
    expect(req.url).not.toContain(secret);
    // Authorization 값 안에 정확히 1 회만 — Bearer prefix 동반.
    expect(req.headers.Authorization).toBe(`Bearer ${secret}`);
    // 그 외 어떤 header value 에도 token 이 박히면 안 된다.
    const otherHeaderValues = Object.entries(req.headers)
      .filter(([key]) => key !== "Authorization")
      .map(([, value]) => value);
    for (const value of otherHeaderValues) {
      expect(value).not.toContain(secret);
    }
  });
});

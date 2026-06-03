// ConfluenceAdapter 순수 request-builder spec — T-0186. 순수 함수 R-112 4 종(happy/
// error/branch/negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접 단언.
// github-request.builder.spec(T-0174) 스타일 mirror(부수효과 0 / 외부 의존 0).
// ADR-0018 §2(풀 base URL + relative path concat) + §3(Cloud Basic vs Server Bearer
// auth header + Accept) 만 대상. service dispatch / cursor pagination 은 본 slice 밖.
import {
  ConfluenceRequestInput,
  buildConfluenceRequest,
} from "./confluence-request.builder";

// 유효한 buildConfluenceRequest 입력 fixture — negative case 는 이 base 에서 1 필드만
// 변형해 격리 검증. baseUrl=Server 풀 URL, authUser=null(Server Bearer), 평문 token,
// list endpoint path. Cloud 케이스는 authUser 를 채워 별도 변형한다.
function validInput(): ConfluenceRequestInput {
  return {
    baseUrl: "https://confluence.internal.example/rest/api",
    authUser: null,
    token: "plaintext-token",
    path: "/content",
  };
}

// Cloud Basic 분기 fixture — authUser(email) 를 채운다. base URL 은 Cloud `/wiki/
// rest/api` 형태. base64 기대값은 각 test 에서 `email:token` 으로 직접 계산.
function cloudInput(): ConfluenceRequestInput {
  return {
    baseUrl: "https://acme.atlassian.net/wiki/rest/api",
    authUser: "user@acme.example",
    token: "plaintext-token",
    path: "/content",
  };
}

// `authUser:token` 을 base64 인코딩한 기대 Basic credential 계산 helper(test 전용).
function expectedBasic(authUser: string, token: string): string {
  return Buffer.from(`${authUser}:${token}`, "utf-8").toString("base64");
}

describe("buildConfluenceRequest", () => {
  it("Server(authUser null) 입력으로 url + Bearer auth + Accept 를 조립한다 (happy + branch: Server Bearer)", () => {
    const req = buildConfluenceRequest(validInput());
    // base URL + 정규화된 path(leading slash 1 개로 join).
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
    // ADR-0018 §3 — Server 는 Bearer <token> + Accept: application/json.
    expect(req.headers).toEqual({
      Authorization: "Bearer plaintext-token",
      Accept: "application/json",
    });
  });

  it("Cloud(authUser 존재) 입력으로 url + Basic base64(email:token) auth + Accept 를 조립한다 (happy + branch: Cloud Basic)", () => {
    const req = buildConfluenceRequest(cloudInput());
    expect(req.url).toBe("https://acme.atlassian.net/wiki/rest/api/content");
    // ADR-0018 §3 — Cloud 는 Basic base64(authUser:token) + Accept: application/json.
    expect(req.headers).toEqual({
      Authorization: `Basic ${expectedBasic("user@acme.example", "plaintext-token")}`,
      Accept: "application/json",
    });
  });

  it("Basic credential 은 `authUser:token` 순서로 정확히 base64 인코딩된다 (branch: Cloud base64 정확성)", () => {
    const req = buildConfluenceRequest(cloudInput());
    // Basic prefix 를 떼고 base64 디코딩하면 정확히 `email:token` 순서여야 한다.
    const encoded = req.headers.Authorization.replace(/^Basic /, "");
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    expect(decoded).toBe("user@acme.example:plaintext-token");
  });

  it("base URL 에 trailing slash 가 있어도 path 와 이중 slash 를 남기지 않는다 (branch: base trailing slash 정규화)", () => {
    const req = buildConfluenceRequest({
      ...validInput(),
      baseUrl: "https://confluence.internal.example/rest/api/",
    });
    // 이중 slash 없이 단일 slash 로 join.
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
    expect(req.url).not.toContain("api//content");
  });

  it("path 에 leading slash 가 있든 없든 동일 url 을 만든다 (branch: leading slash 정규화)", () => {
    const withSlash = buildConfluenceRequest(validInput());
    const noSlash = buildConfluenceRequest({
      ...validInput(),
      path: "content",
    });
    // 두 입력의 url 이 동일해야 — leading slash 유무가 결과에 영향 없음.
    expect(withSlash.url).toBe(noSlash.url);
    expect(noSlash.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
  });

  it("path 의 다중 leading slash 도 단일 slash 로 정규화한다 (branch: multi leading slash)", () => {
    const req = buildConfluenceRequest({ ...validInput(), path: "///content" });
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
  });

  it("query 가 주어지면 ?k=v&... 로 append 한다 (branch: query 유)", () => {
    const req = buildConfluenceRequest({
      ...validInput(),
      query: { spaceKey: "DEV", limit: "100" },
    });
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content?spaceKey=DEV&limit=100",
    );
  });

  it("query 값을 URLSearchParams 로 인코딩한다 — special char 포함 (branch: query encoding)", () => {
    const req = buildConfluenceRequest({
      ...validInput(),
      query: { cql: "type=page AND space=DEV", start: "0" },
    });
    // 공백/= 등 special char 가 percent-encoding 되어야 — 깨진 query 방지.
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content" +
        "?cql=type%3Dpage+AND+space%3DDEV&start=0",
    );
  });

  it("query 가 빈 객체({})면 ? 를 붙이지 않는다 (branch: query 무 — empty object)", () => {
    const req = buildConfluenceRequest({ ...validInput(), query: {} });
    expect(req.url).not.toContain("?");
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
  });

  it("query 가 undefined 면 ? 를 붙이지 않는다 (branch: query 무 — undefined)", () => {
    const req = buildConfluenceRequest({ ...validInput(), query: undefined });
    expect(req.url).not.toContain("?");
    expect(req.url).toBe(
      "https://confluence.internal.example/rest/api/content",
    );
  });

  // negative — authUser 가 빈 문자열 / 공백-only 면 Server Bearer 로 분기(Cloud 오분기
  // 안 함). authUser 존재 여부 분기의 경계값 cover.
  it.each<[string, string]>([
    ["empty string", ""],
    ["whitespace-only", "   "],
  ])(
    "authUser 가 %s 면 Cloud 오분기 없이 Server Bearer 로 분기한다 (negative: authUser 경계 → Bearer)",
    (_label, authUser) => {
      const req = buildConfluenceRequest({ ...validInput(), authUser });
      expect(req.headers.Authorization).toBe("Bearer plaintext-token");
      // Basic prefix 로 잘못 분기되지 않아야 한다.
      expect(req.headers.Authorization).not.toContain("Basic");
    },
  );

  // negative — 빈/공백 baseUrl / token / path 는 각각 명확한 Error throw.
  it.each<[string, unknown]>([
    ["baseUrl", ""],
    ["token", ""],
    ["path", ""],
    ["baseUrl", "   "],
    ["token", "   "],
    ["path", "   "],
  ])(
    "%s 가 비어있으면(%j) Error throw (negative: empty/blank)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildConfluenceRequest(input as unknown as ConfluenceRequestInput),
      ).toThrow(field);
    },
  );

  // negative — 비-string baseUrl / token / path 는 assertNonEmpty 의 typeof 체크에서
  // throw. authUser 는 null 허용이라 본 표에서 제외.
  it.each<[string, unknown]>([
    ["baseUrl", null],
    ["token", 42],
    ["path", undefined],
    ["token", { not: "string" }],
  ])(
    "%s 가 비-string(%j)이면 Error throw (negative: non-string)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildConfluenceRequest(input as unknown as ConfluenceRequestInput),
      ).toThrow(field);
    },
  );

  it("token 은 Bearer Authorization header value 에만 등장하고 다른 곳에 누출되지 않는다 (security: no token leak — Server)", () => {
    const secret = "super-secret-leak-canary-xyz";
    const req = buildConfluenceRequest({
      ...validInput(),
      token: secret,
      query: { limit: "50" },
    });
    // token 은 url 어디에도 노출되면 안 된다(로그/직렬화 누출 방지, ADR-0018 §3).
    expect(req.url).not.toContain(secret);
    expect(req.headers.Authorization).toBe(`Bearer ${secret}`);
    // 그 외 어떤 header value 에도 token 이 박히면 안 된다.
    const otherHeaderValues = Object.entries(req.headers)
      .filter(([key]) => key !== "Authorization")
      .map(([, value]) => value);
    for (const value of otherHeaderValues) {
      expect(value).not.toContain(secret);
    }
  });

  it("Cloud Basic 분기에서도 평문 token 이 url / 비-Authorization header 에 누출되지 않는다 (security: no token leak — Cloud)", () => {
    const secret = "super-secret-leak-canary-cloud";
    const req = buildConfluenceRequest({
      ...cloudInput(),
      token: secret,
      query: { limit: "50" },
    });
    // 평문 token 은 url 어디에도 노출되면 안 된다(base64 안에만 묻혀 있어야 함).
    expect(req.url).not.toContain(secret);
    // Authorization 은 Basic <base64> form — 평문 token substring 이 그대로 보이면
    // 안 된다(base64 인코딩되어 있으므로).
    expect(req.headers.Authorization).toMatch(/^Basic /);
    expect(req.headers.Authorization).not.toContain(secret);
    // 그 외 어떤 header value 에도 token / base64 credential 이 박히면 안 된다.
    const otherHeaderValues = Object.entries(req.headers)
      .filter(([key]) => key !== "Authorization")
      .map(([, value]) => value);
    for (const value of otherHeaderValues) {
      expect(value).not.toContain(secret);
    }
  });

  it("throw message 에 token 평문이 노출되지 않는다 (security: error message no token leak)", () => {
    const secret = "super-secret-leak-canary-err";
    // baseUrl 을 비워 throw 를 유발하되, token 은 평문으로 들어있다.
    try {
      buildConfluenceRequest({
        ...validInput(),
        baseUrl: "",
        token: secret,
      });
      // throw 가 일어나지 않으면 명시적으로 실패.
      throw new Error("expected buildConfluenceRequest to throw");
    } catch (err) {
      const message = (err as Error).message;
      // 에러 메시지에는 field 이름(baseUrl)만, token 평문은 부재.
      expect(message).toContain("baseUrl");
      expect(message).not.toContain(secret);
    }
  });
});

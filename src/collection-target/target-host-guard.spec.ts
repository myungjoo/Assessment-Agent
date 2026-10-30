// target-host-guard spec — 허용 host 규칙과 우회 입력을 고정한다.
import {
  checkConfluenceEndpoint,
  checkGithubEndpoint,
} from "./target-host-guard";

const ENV_NAME = "GITHUB_K_ALLOWED_HOST";
const ALLOWED = { [ENV_NAME]: "allowed.test" };
const github = (endpoint: string, env: NodeJS.ProcessEnv = ALLOWED) =>
  checkGithubEndpoint(endpoint, env, ENV_NAME);
const confluence = (endpoint: string, env: NodeJS.ProcessEnv = ALLOWED) =>
  checkConfluenceEndpoint(endpoint, env, ENV_NAME);

const MISMATCH = { ok: false, reason: `endpoint host 불일치 — ${ENV_NAME}` };

describe("checkGithubEndpoint", () => {
  it.each([
    ["allowed.test"],
    [" allowed.test "],
    ["ALLOWED.Test"],
    ["allowed.test/"],
    ["allowed.test:443"],
    ["https://allowed.test"],
    ["HTTPS://Allowed.Test/"],
    // 파서가 지우는 문자는 정규화 값으로 나가므로 검사와 요청이 갈라지지 않는다.
    ["allow\ted.test"],
    ["allowed%2Etest"],
  ])("%j 는 정규화한 host 로 통과한다", (endpoint) => {
    expect(github(endpoint)).toEqual({ ok: true, endpoint: "allowed.test" });
  });

  it.each([
    ["suffix 뒤에 붙인 다른 host", "allowed.test.evil.test"],
    ["subdomain", "sub.allowed.test"],
    ["접두가 같은 host", "allowed.testevil.test"],
    ["끝 점", "allowed.test."],
    ["다른 port", "allowed.test:8443"],
    ["유사 문자 host", "аllowed.test"],
  ])("%s 는 host 불일치다_n", (_label, endpoint) => {
    expect(github(endpoint)).toEqual(MISMATCH);
  });

  it.each([
    ["userinfo 로 위장", "allowed.test@evil.test"],
    ["userinfo + 비밀번호", "allowed.test:pw@evil.test"],
    ["scheme + userinfo", "https://allowed.test@evil.test"],
    ["허용 host 의 userinfo", "user@allowed.test"],
    ["path 에 숨긴 허용 host", "evil.test/allowed.test"],
    ["scheme + path", "https://evil.test/allowed.test"],
    ["backslash", "evil.test\\allowed.test"],
    ["backslash + @", "evil.test\\@allowed.test"],
    ["fragment", "evil.test#allowed.test"],
    ["query", "evil.test?allowed.test"],
    ["허용 host 의 path", "allowed.test/api"],
    ["평문 http", "http://allowed.test"],
    ["대문자 평문 http", "HTTP://allowed.test"],
    ["다른 scheme", "ftp://allowed.test"],
    ["파싱 불가", "https://"],
  ])("%s 는 형식 거부다_n", (_label, endpoint) => {
    expect(github(endpoint)).toEqual({
      ok: false,
      reason: "endpoint 형식 거부 (https host 만 허용)",
    });
  });

  it.each([
    ["부재", {}],
    ["공백", { [ENV_NAME]: "  " }],
  ])("허용 host 가 %s 면 거부한다_n", (_label, env) => {
    expect(github("allowed.test", env)).toEqual({
      ok: false,
      reason: `허용 host 미설정 — ${ENV_NAME}`,
    });
  });

  it.each([
    ["scheme 포함", "https://allowed.test"],
    ["path 포함", "allowed.test/api"],
    ["userinfo 포함", "user@allowed.test"],
    ["파싱 불가", "a b"],
  ])("허용 host 가 %s 이면 형식 오류다_n", (_label, allowed) => {
    expect(github("allowed.test", { [ENV_NAME]: allowed })).toEqual({
      ok: false,
      reason: `허용 host 형식 오류 — ${ENV_NAME}`,
    });
  });

  it("port 를 적은 허용 값은 그 port 만 허용한다", () => {
    const env = { [ENV_NAME]: " Allowed.test:8443 " };

    expect(github("allowed.test:8443", env)).toEqual({
      ok: true,
      endpoint: "allowed.test:8443",
    });
    expect(github("allowed.test", env)).toEqual(MISMATCH);
    expect(github("allowed.test:9443", env)).toEqual(MISMATCH);
  });

  it("허용 값의 :443 은 생략과 같다", () => {
    const env = { [ENV_NAME]: "allowed.test:443" };

    expect(github("allowed.test", env)).toEqual({
      ok: true,
      endpoint: "allowed.test",
    });
  });

  it("끝 점은 양쪽이 같을 때만 일치한다", () => {
    const env = { [ENV_NAME]: "allowed.test." };

    expect(github("allowed.test.", env)).toEqual({
      ok: true,
      endpoint: "allowed.test.",
    });
    expect(github("allowed.test", env)).toEqual(MISMATCH);
  });

  it("거부 사유에 endpoint 원문을 싣지 않는다_n", () => {
    const results = [
      github("user:s3cret@evil.test"),
      github("https://user:s3cret@allowed.test"),
      github("s3cret.evil.test"),
    ];

    expect(JSON.stringify(results)).not.toContain("s3cret");
  });
});

describe("checkConfluenceEndpoint", () => {
  it.each([
    ["https://allowed.test/rest/api", "https://allowed.test/rest/api"],
    [
      " HTTPS://Allowed.Test:443/wiki/rest/api/ ",
      "https://allowed.test/wiki/rest/api",
    ],
    ["https://allowed.test", "https://allowed.test"],
  ])("%j 는 정규화한 URL 로 통과한다", (endpoint, expected) => {
    expect(confluence(endpoint)).toEqual({ ok: true, endpoint: expected });
  });

  it("port 를 적은 허용 값이면 그 port 를 유지한다", () => {
    expect(
      confluence("https://allowed.test:8443/rest/api", {
        [ENV_NAME]: "allowed.test:8443",
      }),
    ).toEqual({ ok: true, endpoint: "https://allowed.test:8443/rest/api" });
  });

  it.each([
    ["suffix", "https://allowed.test.evil.test/rest/api"],
    ["path", "https://evil.test/allowed.test"],
    ["끝 점", "https://allowed.test./rest/api"],
    ["port", "https://allowed.test:8443/rest/api"],
    ["backslash", "https://evil.test\\@allowed.test/"],
  ])("%s 우회는 host 불일치다_n", (_label, endpoint) => {
    expect(confluence(endpoint)).toEqual(MISMATCH);
  });

  it.each([
    ["평문 http", "http://allowed.test/rest/api"],
    ["scheme 없음", "allowed.test/rest/api"],
    ["host:port 만", "allowed.test:443/rest/api"],
    ["userinfo", "https://allowed.test@evil.test/rest/api"],
    ["허용 host 의 userinfo", "https://user:pw@allowed.test/rest/api"],
    ["query", "https://allowed.test/rest/api?x=1"],
    ["fragment", "https://allowed.test/rest/api#x"],
  ])("%s 는 형식 거부다_n", (_label, endpoint) => {
    expect(confluence(endpoint)).toEqual({
      ok: false,
      reason: "endpoint 형식 거부 (https URL 만 허용)",
    });
  });

  it("허용 host 가 없으면 https 여도 거부한다_n", () => {
    expect(confluence("https://allowed.test/rest/api", {})).toEqual({
      ok: false,
      reason: `허용 host 미설정 — ${ENV_NAME}`,
    });
  });
});

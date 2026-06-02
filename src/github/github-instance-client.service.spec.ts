// GithubInstanceClient spec — T-0180. R-112 4 종(happy / error / branch / negative
// 충분 cover) + never-read-back 비노출 검증. 실 네트워크 0 / 실 token 0 / 실 credential
// 0 — GithubAdapter 와 LlmApiKeyCipher 는 Jest mock 으로 주입하고(§5 credential 게이트
// 미발화), env 는 생성자 인자로 주입한 in-memory map 만 쓴다(실 secret 값 0, §9).
//
// 검증 포인트:
//   - happy: 유효 key → cipher.decrypt 가 해당 instance tokenEnc 로 1회 호출되고,
//     adapter.request 가 올바른 { host, token(복호 결과), path, query } 로 1회 호출되며,
//     adapter 반환값이 그대로 전파됨. requestAllPages 도 위임 + flatten 배열 반환.
//   - error path: 미존재/비활성 key → throw / cipher.decrypt throw 전파 /
//     GithubDomainError 전파.
//   - branch: key 존재/부재 분기, query 유무 분기 각 1+.
//   - negative: 빈/공백 key, 빈 GITHUB_INSTANCES, tokenEnc 부재로 reject 된 key,
//     decrypt 실패, adapter 도메인 error 위상 — 예외 분기마다 1+.
//   - never-read-back: 복호된 평문 token 이 throw error message / 반환 객체에 미노출.
import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { GithubAdapter, GithubDomainError } from "./github-adapter.service";
import { GithubInstanceClient } from "./github-instance-client.service";

// 명백히 가짜인 test 전용 값 — 실 GitHub token / 실 암호문 아님(CLAUDE.md §9).
const FAKE_TOKEN_ENC = "fake-encrypted-envelope-base64==";
const FAKE_PLAINTEXT_TOKEN = "ghp_FAKE_plaintext_token_not_real_000000";

// public instance 1 개를 활성화하는 표준 env fixture. 실값 0 — 모두 가짜.
function envWithPublicInstance(
  overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    GITHUB_INSTANCES: "public",
    GITHUB_PUBLIC_HOST: "github.com",
    GITHUB_PUBLIC_ORG: "acme",
    GITHUB_PUBLIC_TOKEN_ENC: FAKE_TOKEN_ENC,
    ...overrides,
  };
}

// adapter mock — request / requestAllPages 를 jest.fn 으로 대체해 호출/반환을 assert.
function makeAdapterMock(): GithubAdapter & {
  request: jest.Mock;
  requestAllPages: jest.Mock;
} {
  return {
    request: jest.fn(),
    requestAllPages: jest.fn(),
  } as unknown as GithubAdapter & {
    request: jest.Mock;
    requestAllPages: jest.Mock;
  };
}

// cipher mock — decrypt 만 stub. 기본은 평문 token 을 반환하는 happy stub.
function makeCipherMock(
  decryptImpl: (envelope: string) => string = () => FAKE_PLAINTEXT_TOKEN,
): LlmApiKeyCipher & { decrypt: jest.Mock } {
  return {
    decrypt: jest.fn(decryptImpl),
  } as unknown as LlmApiKeyCipher & { decrypt: jest.Mock };
}

describe("GithubInstanceClient.requestForInstance", () => {
  describe("happy path (유효 key → JIT decrypt + adapter.request 위임)", () => {
    it("cipher.decrypt 를 해당 instance tokenEnc 로 1회, adapter.request 를 올바른 input 으로 1회 호출하고 반환값을 전파한다", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const adapterResult = { sha: "abc123" };
      adapter.request.mockResolvedValue(adapterResult);

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );
      const result = await client.requestForInstance(
        "public",
        "/repos/acme/widget/commits",
        { state: "open" },
      );

      // (a) cipher.decrypt 가 해당 instance 의 tokenEnc envelope 로 정확히 1회 호출.
      expect(cipher.decrypt).toHaveBeenCalledTimes(1);
      expect(cipher.decrypt).toHaveBeenCalledWith(FAKE_TOKEN_ENC);
      // (b) adapter.request 가 복호 결과를 token 으로 실어 올바른 input 으로 1회 호출.
      expect(adapter.request).toHaveBeenCalledTimes(1);
      expect(adapter.request).toHaveBeenCalledWith({
        host: "github.com",
        token: FAKE_PLAINTEXT_TOKEN,
        path: "/repos/acme/widget/commits",
        query: { state: "open" },
      });
      // (c) adapter 반환값이 그대로 전파.
      expect(result).toBe(adapterResult);
    });

    it("key 매칭은 case-insensitive 다 (PUBLIC 키로도 public instance 를 찾는다 — branch)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      adapter.request.mockResolvedValue({});

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );
      await client.requestForInstance("PUBLIC", "/user");

      expect(adapter.request).toHaveBeenCalledTimes(1);
    });

    it("query 미지정 시 input.query 가 undefined 로 위임된다 (branch — query 무)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      adapter.request.mockResolvedValue({});

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );
      await client.requestForInstance("public", "/user");

      expect(adapter.request).toHaveBeenCalledWith({
        host: "github.com",
        token: FAKE_PLAINTEXT_TOKEN,
        path: "/user",
        query: undefined,
      });
    });
  });

  describe("error path / negative (config 해석 실패 분기)", () => {
    it("미존재 key 는 throw 하고 cipher / adapter 를 호출하지 않는다 (negative — unknown key)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      await expect(
        client.requestForInstance("does-not-exist", "/user"),
      ).rejects.toThrow();
      expect(cipher.decrypt).not.toHaveBeenCalled();
      expect(adapter.request).not.toHaveBeenCalled();
    });

    it("빈 key 는 cipher 호출 전 fail-fast throw (negative — empty key)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      await expect(client.requestForInstance("", "/user")).rejects.toThrow();
      expect(cipher.decrypt).not.toHaveBeenCalled();
    });

    it("공백-only key 는 fail-fast throw (negative — whitespace key)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      await expect(
        client.requestForInstance("   \t ", "/user"),
      ).rejects.toThrow();
      expect(cipher.decrypt).not.toHaveBeenCalled();
    });

    it("빈 GITHUB_INSTANCES (활성 instance 0) 면 어떤 key 든 throw (negative — no active instance)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const client = new GithubInstanceClient(adapter, cipher, {
        GITHUB_INSTANCES: "",
      });

      await expect(
        client.requestForInstance("public", "/user"),
      ).rejects.toThrow();
    });

    it("tokenEnc 부재로 resolveGithubInstances 가 reject 한 key 는 미존재 취급되어 throw (negative — rejected key)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      // GITHUB_PUBLIC_TOKEN_ENC 부재 → resolveGithubInstances 가 public 을 reject →
      // 활성 instances 에서 빠지므로 client 는 미존재 key 로 본다.
      const client = new GithubInstanceClient(adapter, cipher, {
        GITHUB_INSTANCES: "public",
        GITHUB_PUBLIC_HOST: "github.com",
      });

      await expect(
        client.requestForInstance("public", "/user"),
      ).rejects.toThrow();
      expect(cipher.decrypt).not.toHaveBeenCalled();
    });

    it("cipher.decrypt 가 throw (깨진 envelope) 하면 swallow 없이 전파한다 (negative — decrypt fail)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock(() => {
        throw new Error("복호화할 envelope 이 올바르지 않습니다");
      });

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      await expect(
        client.requestForInstance("public", "/user"),
      ).rejects.toThrow();
      // decrypt 가 throw 했으므로 adapter.request 는 호출되지 않는다.
      expect(adapter.request).not.toHaveBeenCalled();
    });

    it("adapter.request 의 GithubDomainError (permission-denied) 를 그대로 전파한다 (negative — domain error)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const domainError = new GithubDomainError(
        "permission-denied",
        403,
        "github 권한 거부 (host: github.com, path: /user, status: 403)",
      );
      adapter.request.mockRejectedValue(domainError);

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      await expect(client.requestForInstance("public", "/user")).rejects.toBe(
        domainError,
      );
    });
  });

  describe("never-read-back / secret 비노출 검증", () => {
    it("미존재 key throw 의 error message 에 평문 token 이 노출되지 않는다", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const client = new GithubInstanceClient(
        adapter,
        cipher,
        envWithPublicInstance(),
      );

      let caught: unknown;
      try {
        await client.requestForInstance("missing", "/user");
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).not.toContain(FAKE_PLAINTEXT_TOKEN);
      expect((caught as Error).message).not.toContain(FAKE_TOKEN_ENC);
    });
  });
});

describe("GithubInstanceClient.requestAllPagesForInstance", () => {
  // client 는 query 를 가공 없이(as-is) adapter.requestAllPages 로 위임한다 — per_page
  // boundary 를 query 에 overlay 하는 건 GithubAdapter.requestAllPages 의 책임이라
  // client unit scope 밖이다. 따라서 본 spec 은 위임 정합성만 검증하고 per_page 값은 assert 하지 않는다.
  it("adapter.requestAllPages 에 위임하고 flatten 된 배열을 그대로 반환한다 (happy)", async () => {
    const adapter = makeAdapterMock();
    const cipher = makeCipherMock();
    const pages = [{ sha: "a" }, { sha: "b" }, { sha: "c" }];
    adapter.requestAllPages.mockResolvedValue(pages);

    const client = new GithubInstanceClient(
      adapter,
      cipher,
      envWithPublicInstance(),
    );
    const result = await client.requestAllPagesForInstance(
      "public",
      "/repos/acme/widget/commits",
    );

    expect(cipher.decrypt).toHaveBeenCalledWith(FAKE_TOKEN_ENC);
    expect(adapter.requestAllPages).toHaveBeenCalledTimes(1);
    expect(adapter.requestAllPages).toHaveBeenCalledWith({
      host: "github.com",
      token: FAKE_PLAINTEXT_TOKEN,
      path: "/repos/acme/widget/commits",
      query: undefined,
    });
    expect(result).toBe(pages);
  });

  it("query 를 함께 위임한다 (branch — query 유)", async () => {
    const adapter = makeAdapterMock();
    const cipher = makeCipherMock();
    adapter.requestAllPages.mockResolvedValue([]);

    const client = new GithubInstanceClient(
      adapter,
      cipher,
      envWithPublicInstance(),
    );
    await client.requestAllPagesForInstance(
      "public",
      "/repos/acme/widget/pulls",
      {
        state: "all",
      },
    );

    expect(adapter.requestAllPages).toHaveBeenCalledWith({
      host: "github.com",
      token: FAKE_PLAINTEXT_TOKEN,
      path: "/repos/acme/widget/pulls",
      query: { state: "all" },
    });
  });

  it("미존재 key 는 throw 하고 adapter.requestAllPages 를 호출하지 않는다 (negative)", async () => {
    const adapter = makeAdapterMock();
    const cipher = makeCipherMock();

    const client = new GithubInstanceClient(
      adapter,
      cipher,
      envWithPublicInstance(),
    );

    await expect(
      client.requestAllPagesForInstance("nope", "/user"),
    ).rejects.toThrow();
    expect(adapter.requestAllPages).not.toHaveBeenCalled();
  });

  it("adapter.requestAllPages 의 GithubDomainError (rate-limited) 를 그대로 전파한다 (negative — domain error)", async () => {
    const adapter = makeAdapterMock();
    const cipher = makeCipherMock();
    const domainError = new GithubDomainError(
      "rate-limited",
      429,
      "github rate limit (host: github.com, path: /user, status: 429)",
    );
    adapter.requestAllPages.mockRejectedValue(domainError);

    const client = new GithubInstanceClient(
      adapter,
      cipher,
      envWithPublicInstance(),
    );

    await expect(
      client.requestAllPagesForInstance("public", "/user"),
    ).rejects.toBe(domainError);
  });
});

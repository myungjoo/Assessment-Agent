// registered-target-redirect spec — 등록 대상 경로의 redirect 에서 token 이 다른 origin 으로 가지 않음을
// 실 fetch · 로컬 서버로 고정한다 (ADR-0059 §Consequences (e)).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { ConfluenceAdapter } from "../confluence/confluence-adapter.service";
import { GithubAdapter } from "../github/github-adapter.service";

// adapter 는 redirect 옵션 없이 기본 globalThis.fetch 를 쓴다. 다른 origin 으로의 redirect 에서
// fetch 가 Authorization 을 지우는 것이 token 경계이므로 HTTP client 교체 시 여기서 깨져야 한다.
// 로컬 서버의 다른 port 가 다른 origin 이다.
describe("redirect — 다른 origin 으로 token 이 따라가지 않는다", () => {
  const TOKEN = "redirect-plain-token";
  let origin: Server;
  let foreign: Server;
  let originUrl: string;
  let foreignUrl: string;
  let originAuth: (string | undefined)[];
  let foreignAuth: (string | undefined)[];

  // fetch 가 막는 bad port (최대 10080) 를 OS 가 주면 다시 받는다.
  const listen = async (server: Server): Promise<string> => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    if (port > 10080) {
      return `http://127.0.0.1:${port}`;
    }
    await new Promise((resolve) => server.close(resolve));
    return listen(server);
  };

  beforeAll(async () => {
    foreign = createServer((req, res) => {
      foreignAuth.push(req.headers.authorization);
      res.setHeader("content-type", "application/json");
      res.end("[]");
    });
    origin = createServer((req, res) => {
      originAuth.push(req.headers.authorization);
      if (req.url === "/final") {
        res.setHeader("content-type", "application/json");
        res.end("{}");
        return;
      }
      const sameOrigin = req.url?.includes("same-origin");
      res.writeHead(sameOrigin ? 301 : 302, {
        location: sameOrigin ? "/final" : `${foreignUrl}/landed`,
      });
      res.end();
    });
    foreignUrl = await listen(foreign);
    originUrl = await listen(origin);
  });

  afterAll(async () => {
    await Promise.all(
      [origin, foreign].map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
  });

  beforeEach(() => {
    originAuth = [];
    foreignAuth = [];
  });

  const expectTokenStopped = (): void => {
    expect(originAuth).toHaveLength(1);
    expect(originAuth[0]).toContain(TOKEN);
    expect(foreignAuth).toEqual([undefined]);
  };

  it("GithubAdapter", async () => {
    // builder 가 항상 https 를 조립하므로 scheme · host 만 로컬 stub 으로 낮춘다. adapter 의
    // 기본 fetch 를 그대로 타도록 주입하지 않고 globalThis.fetch 를 감싼다.
    const realFetch = globalThis.fetch;
    const spy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation((url, init) =>
        realFetch(String(url).replace(/^https:\/\/[^/]+/, originUrl), init),
      );

    try {
      await new GithubAdapter().request({
        host: "allowed.test",
        token: TOKEN,
        path: "repos/o/r/commits",
      });
    } finally {
      spy.mockRestore();
    }

    expectTokenStopped();
  });

  it("ConfluenceAdapter", async () => {
    const adapter = new ConfluenceAdapter();

    await adapter.request({
      baseUrl: `${originUrl}/rest/api`,
      authUser: null,
      token: TOKEN,
      path: "content",
    });

    expectTokenStopped();
  });

  it("같은 origin redirect 는 token 을 유지하고 다른 origin 으로 가지 않는다", async () => {
    await new ConfluenceAdapter().request({
      baseUrl: `${originUrl}/rest/api`,
      authUser: null,
      token: TOKEN,
      path: "same-origin",
    });

    expect(originAuth).toHaveLength(2);
    expect(originAuth[1]).toContain(TOKEN);
    expect(foreignAuth).toEqual([]);
  });
});

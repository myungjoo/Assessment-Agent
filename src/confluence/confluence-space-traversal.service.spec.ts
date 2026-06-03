// ConfluenceSpaceTraversalService spec — T-0189. R-112 4 종(happy / error / branch /
// negative 충분 cover) + never-read-back 비노출 검증. 실 네트워크 0 / 실 token 0 /
// 실 credential 0 — ConfluenceAdapter 와 LlmApiKeyCipher 는 Jest mock 으로 주입하고
// (§5 credential 게이트 미발화), config 는 in-memory fixture 만 쓴다(실 secret 0, §9).
//
// 검증 포인트:
//   - happy: multi-SPACE / single-SPACE 전부 성공 시 각 SPACE 의 requestAllPages 가
//     올바른 input(spaceKey query + 복호 token)으로 호출되고 결과가 aggregate 됨.
//   - error path: cipher.decrypt throw(깨진 envelope) 가 swallow 없이 전파(전 SPACE
//     공유 token 이므로 전체 fail-fast — SPACE 단위 skip 아님).
//   - branch: skip-and-continue catch 분기(권한 거부 SPACE) vs 정상 SPACE 통과 분기.
//   - negative: 403 skip + emit + 나머지 aggregate / 404 skip / 빈 allowlist(호출 0) /
//     all-SPACEs-fail(전부 skip + 각 emit) / no-op emitter default crash 없음 /
//     non-domain error 전파.
//   - never-read-back: 복호 평문 token 이 반환값 / emit payload 에 미노출.
import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import {
  ConfluenceAdapter,
  ConfluenceDomainError,
  PermissionDeniedEmitter,
} from "./confluence-adapter.service";
import { ConfluenceInstanceConfig } from "./confluence-instance-config";
import { ConfluenceSpaceTraversalService } from "./confluence-space-traversal.service";

// 명백히 가짜인 test 전용 값 — 실 Confluence token / 실 암호문 아님(CLAUDE.md §9).
const FAKE_TOKEN_ENC = "fake-encrypted-confluence-envelope-base64==";
const FAKE_PLAINTEXT_TOKEN = "fake_confluence_pat_not_real_0000000000";

// 표준 instance config fixture. spaceAllowlist 는 인자로 받아 SPACE 수를 변형한다.
function makeConfig(
  spaceAllowlist: string[],
  overrides: Partial<ConfluenceInstanceConfig> = {},
): ConfluenceInstanceConfig {
  return {
    key: "cloud",
    baseUrl: "https://acme.atlassian.net/wiki/rest/api",
    authUser: "fake-user@example.com",
    tokenEnc: FAKE_TOKEN_ENC,
    spaceAllowlist,
    ...overrides,
  };
}

// adapter mock — requestAllPages 만 jest.fn 으로 대체해 호출/반환을 assert.
function makeAdapterMock(): ConfluenceAdapter & {
  requestAllPages: jest.Mock;
} {
  return {
    requestAllPages: jest.fn(),
  } as unknown as ConfluenceAdapter & { requestAllPages: jest.Mock };
}

// cipher mock — decrypt 만 stub. 기본은 평문 token 을 반환하는 happy stub.
function makeCipherMock(
  decryptImpl: (envelope: string) => string = () => FAKE_PLAINTEXT_TOKEN,
): LlmApiKeyCipher & { decrypt: jest.Mock } {
  return {
    decrypt: jest.fn(decryptImpl),
  } as unknown as LlmApiKeyCipher & { decrypt: jest.Mock };
}

// emitter mock — emit 호출을 jest.fn 으로 추적.
function makeEmitterMock(): PermissionDeniedEmitter & { emit: jest.Mock } {
  return { emit: jest.fn() };
}

// permission-denied(403) 도메인 error helper.
function permissionDeniedError(status = 403): ConfluenceDomainError {
  return new ConfluenceDomainError(
    "permission-denied",
    status,
    `confluence 권한 거부 (status: ${status})`,
  );
}

describe("ConfluenceSpaceTraversalService.traverseInstance", () => {
  describe("happy path (전 SPACE 성공)", () => {
    it("multi-SPACE: 각 SPACE 의 requestAllPages 가 올바른 input 으로 호출되고 결과가 aggregate 된다", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      const devPages = [{ id: "1" }, { id: "2" }];
      const docsPages = [{ id: "3" }];
      adapter.requestAllPages
        .mockResolvedValueOnce(devPages)
        .mockResolvedValueOnce(docsPages);

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["DEV", "DOCS"]),
      );

      // (a) token 은 전 SPACE 공유라 cipher.decrypt 가 정확히 1회만 호출.
      expect(cipher.decrypt).toHaveBeenCalledTimes(1);
      expect(cipher.decrypt).toHaveBeenCalledWith(FAKE_TOKEN_ENC);
      // (b) 각 SPACE 마다 requestAllPages 가 spaceKey query + 복호 token 으로 호출.
      expect(adapter.requestAllPages).toHaveBeenCalledTimes(2);
      expect(adapter.requestAllPages).toHaveBeenNthCalledWith(1, {
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        authUser: "fake-user@example.com",
        token: FAKE_PLAINTEXT_TOKEN,
        path: "/content",
        query: { spaceKey: "DEV" },
      });
      expect(adapter.requestAllPages).toHaveBeenNthCalledWith(2, {
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        authUser: "fake-user@example.com",
        token: FAKE_PLAINTEXT_TOKEN,
        path: "/content",
        query: { spaceKey: "DOCS" },
      });
      // (c) SPACE 식별 가능한 형태로 aggregate.
      expect(result).toEqual([
        { spaceKey: "DEV", pages: devPages },
        { spaceKey: "DOCS", pages: docsPages },
      ]);
      // (d) 권한 부족 0 이므로 emit 미호출.
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it("single-SPACE: allowlist 1 SPACE 만 있을 때 정상 수집한다", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const pages = [{ id: "only" }];
      adapter.requestAllPages.mockResolvedValue(pages);

      const service = new ConfluenceSpaceTraversalService(adapter, cipher);
      const result = await service.traverseInstance(makeConfig(["SOLO"]));

      expect(adapter.requestAllPages).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ spaceKey: "SOLO", pages }]);
    });

    it("authUser 가 null(Server Bearer) 이어도 그대로 input 에 전달된다 (branch — auth scheme)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      adapter.requestAllPages.mockResolvedValue([]);

      const service = new ConfluenceSpaceTraversalService(adapter, cipher);
      await service.traverseInstance(makeConfig(["DEV"], { authUser: null }));

      expect(adapter.requestAllPages).toHaveBeenCalledWith(
        expect.objectContaining({ authUser: null }),
      );
    });
  });

  describe("error path (cipher.decrypt 실패)", () => {
    it("cipher.decrypt 가 throw(깨진 envelope) 하면 swallow 없이 전파하고 adapter 를 호출하지 않는다 (negative — decrypt fail, 전체 fail-fast)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock(() => {
        throw new Error("복호화할 envelope 이 올바르지 않습니다");
      });

      const service = new ConfluenceSpaceTraversalService(adapter, cipher);

      await expect(
        service.traverseInstance(makeConfig(["DEV", "DOCS"])),
      ).rejects.toThrow();
      // 복호 실패는 전 SPACE 공유 token 이므로 SPACE 단위 skip 이 아니라 전체 중단.
      expect(adapter.requestAllPages).not.toHaveBeenCalled();
    });
  });

  describe("skip-and-continue 분기 (4xx catch vs 정상 통과)", () => {
    it("403 SPACE 는 skip + emit, 나머지 SPACE 는 정상 aggregate 한다 (branch + negative — 403 skip)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      const docsPages = [{ id: "ok" }];
      // DEV 는 권한 거부(catch 분기), DOCS 는 정상(통과 분기).
      adapter.requestAllPages
        .mockRejectedValueOnce(permissionDeniedError(403))
        .mockResolvedValueOnce(docsPages);

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["DEV", "DOCS"]),
      );

      // DEV skip → 결과에서 제외, DOCS 만 aggregate (전체 abort 안 함).
      expect(result).toEqual([{ spaceKey: "DOCS", pages: docsPages }]);
      // 권한 거부 SPACE 에 대해 emit 1회 (식별 정보만, token 평문 0).
      expect(emitter.emit).toHaveBeenCalledTimes(1);
      expect(emitter.emit).toHaveBeenCalledWith({
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        path: "/content",
        status: 403,
      });
      // skip 후에도 다음 SPACE 진행 — requestAllPages 는 2회 호출.
      expect(adapter.requestAllPages).toHaveBeenCalledTimes(2);
    });

    it("401 도 permission-denied 로 emit 후 skip 한다 (negative — 401 skip)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      adapter.requestAllPages.mockRejectedValue(permissionDeniedError(401));

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(makeConfig(["DEV"]));

      expect(result).toEqual([]);
      expect(emitter.emit).toHaveBeenCalledWith({
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        path: "/content",
        status: 401,
      });
    });

    it("404(not-found) SPACE 도 skip-and-continue 되며 emit 은 안 한다 (negative — 404 skip)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      const okPages = [{ id: "ok" }];
      adapter.requestAllPages
        .mockRejectedValueOnce(
          new ConfluenceDomainError("not-found", 404, "confluence 대상 부재"),
        )
        .mockResolvedValueOnce(okPages);

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["GONE", "HERE"]),
      );

      // GONE skip(권한 위상 아님 → emit 미호출), HERE 정상 aggregate.
      expect(result).toEqual([{ spaceKey: "HERE", pages: okPages }]);
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(adapter.requestAllPages).toHaveBeenCalledTimes(2);
    });

    it("비-권한 도메인 error(rate-limited)도 그 SPACE 만 skip 하고 계속 진행한다 (negative — non-permission skip, ADR-0018 §4)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      const okPages = [{ id: "ok" }];
      adapter.requestAllPages
        .mockRejectedValueOnce(
          new ConfluenceDomainError(
            "rate-limited",
            429,
            "confluence rate limit",
          ),
        )
        .mockResolvedValueOnce(okPages);

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["BUSY", "HERE"]),
      );

      expect(result).toEqual([{ spaceKey: "HERE", pages: okPages }]);
      // rate-limited 는 permission-denied 위상 아님 → emit 미호출.
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it("status 가 undefined 인 permission-denied 는 403 으로 보강해 emit 한다 (branch — status fallback)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      adapter.requestAllPages.mockRejectedValue(
        new ConfluenceDomainError(
          "permission-denied",
          undefined,
          "confluence 권한 거부",
        ),
      );

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      await service.traverseInstance(makeConfig(["DEV"]));

      expect(emitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });
  });

  describe("negative cases (경계 / no-op / 전파)", () => {
    it("빈 allowlist 면 adapter 호출 0회 + 빈 배열 반환 (negative — empty allowlist)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();

      const service = new ConfluenceSpaceTraversalService(adapter, cipher);
      const result = await service.traverseInstance(makeConfig([]));

      expect(result).toEqual([]);
      expect(adapter.requestAllPages).not.toHaveBeenCalled();
    });

    it("all-SPACEs-fail: 전 SPACE 가 4xx 면 전부 skip + 각 emit + 빈 배열(전체 abort 금지) (negative — all fail)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      adapter.requestAllPages.mockRejectedValue(permissionDeniedError(403));

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["A", "B", "C"]),
      );

      expect(result).toEqual([]);
      // 전 SPACE 순회(abort 안 함) → 3회 호출 + 3회 emit.
      expect(adapter.requestAllPages).toHaveBeenCalledTimes(3);
      expect(emitter.emit).toHaveBeenCalledTimes(3);
    });

    it("emitter 미주입(no-op default) 시에도 catch 분기가 crash 없이 진행된다 (negative — no-op emitter)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const okPages = [{ id: "ok" }];
      adapter.requestAllPages
        .mockRejectedValueOnce(permissionDeniedError(403))
        .mockResolvedValueOnce(okPages);

      // emitter 인자 생략 → NO_OP_PERMISSION_DENIED_EMITTER default.
      const service = new ConfluenceSpaceTraversalService(adapter, cipher);
      const result = await service.traverseInstance(
        makeConfig(["DENIED", "HERE"]),
      );

      // emit 이 no-op 이어도 skip-and-continue 정상 동작.
      expect(result).toEqual([{ spaceKey: "HERE", pages: okPages }]);
    });

    it("ConfluenceDomainError 가 아닌 error(builder Error 등)는 swallow 없이 전파한다 (negative — non-domain error 전파)", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const programmingError = new Error(
        "confluence 요청 조립 실패: path 가 비어있음",
      );
      adapter.requestAllPages.mockRejectedValue(programmingError);

      const service = new ConfluenceSpaceTraversalService(adapter, cipher);

      await expect(service.traverseInstance(makeConfig(["DEV"]))).rejects.toBe(
        programmingError,
      );
    });
  });

  describe("never-read-back / secret 비노출 검증", () => {
    it("복호된 평문 token 이 반환 결과 / emit payload 어디에도 노출되지 않는다", async () => {
      const adapter = makeAdapterMock();
      const cipher = makeCipherMock();
      const emitter = makeEmitterMock();
      adapter.requestAllPages
        .mockResolvedValueOnce([{ id: "ok" }])
        .mockRejectedValueOnce(permissionDeniedError(403));

      const service = new ConfluenceSpaceTraversalService(
        adapter,
        cipher,
        emitter,
      );
      const result = await service.traverseInstance(
        makeConfig(["OK", "DENIED"]),
      );

      // 반환 결과 직렬화에 평문 token / 암호문 미노출.
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(FAKE_PLAINTEXT_TOKEN);
      expect(serialized).not.toContain(FAKE_TOKEN_ENC);
      // emit payload 에도 token 미노출.
      const emitArg = emitter.emit.mock.calls[0][0];
      expect(JSON.stringify(emitArg)).not.toContain(FAKE_PLAINTEXT_TOKEN);
    });
  });
});

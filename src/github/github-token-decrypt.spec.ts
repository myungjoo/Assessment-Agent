// github-token-decrypt spec — T-0179 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + never-read-back 비노출 검증 + coverage line/function ≥ 80%).
//
// 본 spec 은 실 GitHub token / 실 암호문을 박제하지 않는다 (CLAUDE.md §9). test
// fixture envelope 는 LlmApiKeyCipher.encrypt 로 in-memory 생성한 round-trip 값만
// 쓰거나, cipher 자체를 mock 으로 주입한다. master key (LLM_APIKEY_ENC_KEY) 는 각
// test 마다 crypto.randomBytes(32) 로 생성한 obviously-fake 키를 env 에 set/복원한다.
//
// 검증 포인트:
//   - happy: 유효 envelope (cipher.encrypt round-trip) → 평문 token 복원.
//   - error path: cipher.decrypt 가 throw (변조 / 잘못된 키 / 깨진 base64 / 키 부재
//     / 키 길이 미달) 하면 helper 가 swallow 하지 않고 그대로 전파.
//   - branch: 빈/공백-only/undefined tokenEnc 방어 분기 → cipher 호출 전 fail-fast.
//   - negative: tamper / wrong-key / missing-env / 길이 미달 / 빈 입력 각 1+.
//   - never-read-back: 평문 token 이 error message 에 노출되지 않음을 assert.
import { randomBytes } from "node:crypto";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { GithubInstanceConfig } from "./github-instance-config";
import {
  decryptGithubInstanceConfigToken,
  decryptGithubInstanceToken,
} from "./github-token-decrypt";

const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";

// withEnvKey — LLM_APIKEY_ENC_KEY 를 set 한 뒤 fn 실행, 끝나면 원래 값 복원 (env 누수
// 방지). cipher spec 의 동형 helper — 실 secret 0, 호출부가 생성한 키만 전달.
function withEnvKey<T>(keyEncoded: string | undefined, fn: () => T): T {
  const prev = process.env[ENC_KEY_ENV];
  if (keyEncoded === undefined) {
    delete process.env[ENC_KEY_ENV];
  } else {
    process.env[ENC_KEY_ENV] = keyEncoded;
  }
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env[ENC_KEY_ENV];
    } else {
      process.env[ENC_KEY_ENV] = prev;
    }
  }
}

// 32-byte AES-256 test 키를 base64 로 생성 (in-memory — 실 secret 0).
function randomKeyBase64(): string {
  return randomBytes(32).toString("base64");
}

// 명백히 가짜인 test 전용 token 평문 — 실 GitHub token 아님 (CLAUDE.md §9).
const FAKE_TOKEN = "ghp_FAKE_test_token_not_real_000000000000";

describe("decryptGithubInstanceToken", () => {
  // 각 test 종료 후 env 정리 — withEnvKey 가 복원하나 안전망으로 추가 보장.
  afterEach(() => {
    delete process.env[ENC_KEY_ENV];
  });

  describe("happy path (유효 envelope → 평문 token 복원)", () => {
    // ------------------------------------------------------------------
    // Happy — cipher.encrypt 로 만든 envelope 를 helper 에 넣으면 원본 평문 token
    // 이 복원된다 (실 cipher + test 키 round-trip).
    // ------------------------------------------------------------------
    it("유효 envelope 를 helper 로 복호화하면 원본 평문 token 을 반환한다 (happy)", () => {
      const key = randomKeyBase64();

      const { envelope, decrypted } = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const env = cipher.encrypt(FAKE_TOKEN);
        return {
          envelope: env,
          decrypted: decryptGithubInstanceToken(cipher, env),
        };
      });

      // envelope 에 평문 token 이 그대로 노출되지 않음 (암호화됨) + round-trip 복원.
      expect(envelope).not.toContain(FAKE_TOKEN);
      expect(decrypted).toBe(FAKE_TOKEN);
    });

    // GithubInstanceConfig overload 도 동일하게 동작 (config.tokenEnc 위임).
    it("GithubInstanceConfig overload 도 tokenEnc 를 복호화해 평문 token 을 반환한다 (happy — config)", () => {
      const key = randomKeyBase64();

      const decrypted = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const instance: GithubInstanceConfig = {
          key: "public",
          host: "github.com",
          orgs: ["acme"],
          repos: [],
          tokenEnc: cipher.encrypt(FAKE_TOKEN),
        };
        return decryptGithubInstanceConfigToken(cipher, instance);
      });

      expect(decrypted).toBe(FAKE_TOKEN);
    });

    // 호출 시점에만 decrypt 가 일어남 (eager 복호화 아님) — JIT 검증.
    it("helper 호출 시점에만 cipher.decrypt 가 1회 호출된다 (JIT — eager 복호화 아님)", () => {
      const decryptMock = jest.fn().mockReturnValue(FAKE_TOKEN);
      const cipher = { decrypt: decryptMock } as unknown as LlmApiKeyCipher;

      // helper 를 만들기만 하고 호출하지 않으면 decrypt 는 0회 (lazy/JIT).
      expect(decryptMock).not.toHaveBeenCalled();

      const result = decryptGithubInstanceToken(cipher, "fake-envelope-base64");

      // 단 한 번 호출 + envelope 인자를 그대로 전달.
      expect(decryptMock).toHaveBeenCalledTimes(1);
      expect(decryptMock).toHaveBeenCalledWith("fake-envelope-base64");
      expect(result).toBe(FAKE_TOKEN);
    });
  });

  describe("빈/공백-only/undefined tokenEnc 방어 분기 (branch — fail-fast)", () => {
    // ------------------------------------------------------------------
    // Branch — 빈/공백-only/undefined envelope 는 cipher 호출 전에 fail-fast throw.
    // cipher.decrypt 는 호출되지 않아야 한다 (방어 layer).
    // ------------------------------------------------------------------
    it("빈 문자열 tokenEnc 는 cipher 호출 전에 throw 한다 (branch — empty)", () => {
      const decryptMock = jest.fn();
      const cipher = { decrypt: decryptMock } as unknown as LlmApiKeyCipher;

      expect(() => decryptGithubInstanceToken(cipher, "")).toThrow();
      // 방어 분기에서 차단 — cipher.decrypt 미호출.
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it("공백-only tokenEnc 는 cipher 호출 전에 throw 한다 (branch — whitespace)", () => {
      const decryptMock = jest.fn();
      const cipher = { decrypt: decryptMock } as unknown as LlmApiKeyCipher;

      expect(() => decryptGithubInstanceToken(cipher, "   \t  ")).toThrow();
      expect(decryptMock).not.toHaveBeenCalled();
    });

    it("undefined tokenEnc 는 cipher 호출 전에 throw 한다 (branch — undefined)", () => {
      const decryptMock = jest.fn();
      const cipher = { decrypt: decryptMock } as unknown as LlmApiKeyCipher;

      expect(() => decryptGithubInstanceToken(cipher, undefined)).toThrow();
      expect(decryptMock).not.toHaveBeenCalled();
    });
  });

  describe("error path 전파 (negative — cipher.decrypt throw swallow 금지)", () => {
    // ------------------------------------------------------------------
    // Negative — A 키로 encrypt 한 envelope 를 B 키로 decrypt 시 cipher 가 throw
    // (auth tag mismatch). helper 가 그 throw 를 swallow 하지 않고 전파.
    // ------------------------------------------------------------------
    it("wrong-key envelope 는 cipher 의 throw 를 그대로 전파한다 (negative — wrong-key)", () => {
      const keyA = randomKeyBase64();
      const keyB = randomKeyBase64();

      const envelope = withEnvKey(keyA, () =>
        new LlmApiKeyCipher().encrypt(FAKE_TOKEN),
      );

      withEnvKey(keyB, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => decryptGithubInstanceToken(cipher, envelope)).toThrow();
      });
    });

    // 변조 (auth-tag tamper) envelope 도 throw 전파.
    it("변조된 envelope (auth-tag tamper) 는 throw 를 전파한다 (negative — tamper)", () => {
      const key = randomKeyBase64();

      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const envelope = cipher.encrypt(FAKE_TOKEN);
        const buffer = Buffer.from(envelope, "base64");
        // 마지막 byte (ciphertext 영역) flip — 변조 시뮬레이션.
        buffer[buffer.length - 1] ^= 0xff;
        const tampered = buffer.toString("base64");

        expect(() => decryptGithubInstanceToken(cipher, tampered)).toThrow();
      });
    });

    // 깨진/잘린 base64 envelope (최소 길이 미달) 도 throw 전파.
    it("깨진/잘린 base64 envelope 는 throw 를 전파한다 (negative — 잘린 입력)", () => {
      const key = randomKeyBase64();

      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        // 4 byte 만 base64 — IV+authTag 최소 길이 미달.
        const tooShort = Buffer.from([1, 2, 3, 4]).toString("base64");
        expect(() => decryptGithubInstanceToken(cipher, tooShort)).toThrow();
      });
    });

    // LLM_APIKEY_ENC_KEY env 부재 → cipher resolveKey 가 throw → helper 전파.
    it("master key env 부재 시 cipher 의 throw 를 전파한다 (negative — missing-env)", () => {
      withEnvKey(undefined, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() =>
          decryptGithubInstanceToken(cipher, "any-nonempty-envelope"),
        ).toThrow(ENC_KEY_ENV);
      });
    });

    // 키 길이 미달 (32 byte 아님) → cipher resolveKey throw → helper 전파.
    it("master key 길이 미달 시 cipher 의 throw 를 전파한다 (negative — 키 길이 미달)", () => {
      const shortKey = randomBytes(16).toString("base64");
      withEnvKey(shortKey, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() =>
          decryptGithubInstanceToken(cipher, "any-nonempty-envelope"),
        ).toThrow(ENC_KEY_ENV);
      });
    });
  });

  describe("never-read-back / secret 비노출 검증", () => {
    // ------------------------------------------------------------------
    // 복호된 평문 token 이 error message 에 실리지 않음을 assert. helper 가 throw
    // 하는 경로 (변조 / 빈 입력 / 키 부재) 어디에서도 평문 token 문자열이 노출되면
    // 안 된다 (ADR-0014 §3 never-read-back, CLAUDE.md §9).
    // ------------------------------------------------------------------
    it("변조 envelope throw 의 error message 에 평문 token 이 노출되지 않는다", () => {
      const key = randomKeyBase64();

      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const envelope = cipher.encrypt(FAKE_TOKEN);
        const buffer = Buffer.from(envelope, "base64");
        buffer[buffer.length - 1] ^= 0xff;
        const tampered = buffer.toString("base64");

        let caught: unknown;
        try {
          decryptGithubInstanceToken(cipher, tampered);
        } catch (err) {
          caught = err;
        }
        // throw 가 발생했음을 확인. node:crypto 가 던지는 error 는 jest VM sandbox
        // 의 Error realm 과 달라 toBeInstanceOf(Error) 가 부정확하므로 (jest 의
        // toThrow 도 duck-typing 으로 판정) message 속성 존재로 throw 를 검증한다.
        expect(caught).toBeDefined();
        const message = String(
          (caught as { message?: unknown })?.message ?? "",
        );
        expect(message.length).toBeGreaterThan(0);
        // 핵심 — 평문 token 문자열이 error message 에 포함되지 않음 (never-read-back).
        expect(message).not.toContain(FAKE_TOKEN);
      });
    });

    it("빈 입력 방어 분기의 error message 에 token 평문이 없다 (애초에 평문 부재)", () => {
      const decryptMock = jest.fn();
      const cipher = { decrypt: decryptMock } as unknown as LlmApiKeyCipher;

      let caught: unknown;
      try {
        decryptGithubInstanceToken(cipher, "");
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).not.toContain(FAKE_TOKEN);
    });
  });
});

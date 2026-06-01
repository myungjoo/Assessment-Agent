// LlmApiKeyCipher spec — T-0147 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + 보안 민감 negative + coverage line/function ≥ 80%).
//
// 본 spec 은 LLM_APIKEY_ENC_KEY env var 를 각 test 마다 in-memory 로 주입/복원해
// PostgreSQL / 외부 의존 없이 isolated 하게 실행된다. 실 secret 값은 박제 0 —
// test 전용 키는 crypto.randomBytes(32) 로 매 test 생성하거나 고정 test 상수를
// in-memory 로만 set 한다 (CLAUDE.md §9 — secret literal 0).
//
// 검증 포인트:
//   - happy: encrypt → decrypt round-trip 이 원본 평문을 복원.
//   - error path: env 부재 / 키 길이 미달 / 깨진 envelope 각 throw.
//   - branch: env 부재 분기 / base64·hex 키 디코딩 분기 / 길이 미달 분기 /
//     auth tag 검증 분기 / envelope 최소 길이 분기 각 1+.
//   - negative (보안 민감): tamper(auth-tag) 실패 / wrong-key 실패 / missing-env /
//     IV 고유성 각 1+.
import { randomBytes } from "node:crypto";

import { LlmApiKeyCipher, resolveKey } from "./llm-apikey-cipher.service";

const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";

// withEnvKey — 주어진 키 인코딩 string 을 LLM_APIKEY_ENC_KEY 에 set 한 뒤 fn 을
// 실행하고, 끝나면 원래 env 값을 복원한다 (test 간 env 누수 방지). 실 secret 값은
// 박제하지 않고 호출부가 in-memory 로 생성한 키만 전달한다.
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

describe("LlmApiKeyCipher", () => {
  // 각 test 종료 후 env 정리 — withEnvKey 가 복원하나 안전망으로 추가 보장.
  afterEach(() => {
    delete process.env[ENC_KEY_ENV];
  });

  describe("encrypt() → decrypt() round-trip (happy path)", () => {
    // ------------------------------------------------------------------
    // Happy path — 동일 키로 encrypt 후 decrypt 하면 원본 평문이 복원된다.
    // ------------------------------------------------------------------
    it("동일 키로 encrypt 한 envelope 를 decrypt 하면 원본 평문을 복원한다 (happy)", () => {
      const key = randomKeyBase64();
      const plaintext = "sk-test-plaintext-apikey-12345";

      const { envelope, decrypted } = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const env = cipher.encrypt(plaintext);
        return { envelope: env, decrypted: cipher.decrypt(env) };
      });

      // 평문이 envelope 에 그대로 노출되지 않음 (암호화됨) + round-trip 복원.
      expect(envelope).not.toContain(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    // 빈 문자열 평문도 round-trip 복원 (boundary — empty plaintext).
    it("빈 문자열 평문도 round-trip 으로 복원한다 (boundary — empty)", () => {
      const key = randomKeyBase64();

      const decrypted = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        return cipher.decrypt(cipher.encrypt(""));
      });

      expect(decrypted).toBe("");
    });

    // 멀티바이트 (한글 / 이모지) 평문도 utf8 round-trip 복원 (boundary — multibyte).
    it("멀티바이트 (한글/이모지) 평문도 utf8 round-trip 으로 복원한다 (boundary — multibyte)", () => {
      const key = randomKeyBase64();
      const plaintext = "한국어-키-🔐-mixed";

      const decrypted = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        return cipher.decrypt(cipher.encrypt(plaintext));
      });

      expect(decrypted).toBe(plaintext);
    });

    // hex 인코딩 키도 수용 (branch — base64 가 32B 아니면 hex 재시도).
    it("hex 로 인코딩된 32-byte 키도 수용해 round-trip 복원한다 (branch — hex 디코딩)", () => {
      const keyHex = randomBytes(32).toString("hex");
      const plaintext = "sk-hex-key-roundtrip";

      const decrypted = withEnvKey(keyHex, () => {
        const cipher = new LlmApiKeyCipher();
        return cipher.decrypt(cipher.encrypt(plaintext));
      });

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("IV 고유성 (negative 핵심 — nonce 재사용 회귀 방지)", () => {
    // ------------------------------------------------------------------
    // Negative (보안) — 동일 평문을 2회 encrypt 하면 envelope 이 서로 다르다
    // (IV 가 매 호출 random). GCM nonce 재사용 회귀 방지 (ADR-0014 Consequences §3).
    // ------------------------------------------------------------------
    it("동일 평문을 2회 encrypt 하면 envelope 이 서로 다르다 (IV 고유성)", () => {
      const key = randomKeyBase64();
      const plaintext = "sk-same-plaintext";

      const { first, second } = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        return {
          first: cipher.encrypt(plaintext),
          second: cipher.encrypt(plaintext),
        };
      });

      // envelope 자체가 상이 (IV prefix 가 다르므로 ciphertext / tag 도 달라짐).
      expect(first).not.toBe(second);
      // 그럼에도 둘 다 decrypt 하면 동일 원본 복원 (IV 가 envelope 에 영속됨).
      const decrypted = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        return [cipher.decrypt(first), cipher.decrypt(second)];
      });
      expect(decrypted).toEqual([plaintext, plaintext]);
    });

    // 여러 번 encrypt 해도 모두 고유 (IV 충돌 부재 — 통계적 확인).
    it("100회 encrypt 의 envelope 이 모두 고유하다 (IV 충돌 부재)", () => {
      const key = randomKeyBase64();
      const seen = withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const set = new Set<string>();
        for (let i = 0; i < 100; i += 1) {
          set.add(cipher.encrypt("sk-fixed"));
        }
        return set;
      });
      expect(seen.size).toBe(100);
    });
  });

  describe("tamper / auth-tag 검증 실패 (negative 핵심 — GCM 무결성)", () => {
    // ------------------------------------------------------------------
    // Negative (보안) — ciphertext 1 byte 변조 후 decrypt 시 throw.
    // GCM auth tag 검증이 무결성 위반을 detect (DB row tamper 시나리오).
    // ------------------------------------------------------------------
    it("ciphertext 마지막 byte 를 변조한 envelope 를 decrypt 하면 throw 한다 (auth-tag 실패)", () => {
      const key = randomKeyBase64();
      const plaintext = "sk-tamper-target-with-enough-length";

      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const envelope = cipher.encrypt(plaintext);
        const buffer = Buffer.from(envelope, "base64");
        // 마지막 byte (ciphertext 영역) 를 flip — 변조 시뮬레이션.
        buffer[buffer.length - 1] ^= 0xff;
        const tampered = buffer.toString("base64");

        expect(() => cipher.decrypt(tampered)).toThrow();
      });
    });

    // authTag 영역 변조도 throw (IV/tag 영역 무결성).
    it("authTag 영역을 변조한 envelope 를 decrypt 하면 throw 한다 (auth-tag 영역 tamper)", () => {
      const key = randomKeyBase64();

      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        const envelope = cipher.encrypt("sk-tag-tamper");
        const buffer = Buffer.from(envelope, "base64");
        // IV(12) 직후 authTag 첫 byte 변조.
        buffer[12] ^= 0x01;
        expect(() => cipher.decrypt(buffer.toString("base64"))).toThrow();
      });
    });
  });

  describe("wrong-key 실패 (negative 핵심)", () => {
    // ------------------------------------------------------------------
    // Negative (보안) — A 키로 encrypt 한 envelope 를 B 키로 decrypt 시 throw
    // (auth tag mismatch — 키 불일치 detect).
    // ------------------------------------------------------------------
    it("A 키로 encrypt 한 envelope 를 B 키로 decrypt 하면 throw 한다 (wrong-key)", () => {
      const keyA = randomKeyBase64();
      const keyB = randomKeyBase64();

      const envelope = withEnvKey(keyA, () =>
        new LlmApiKeyCipher().encrypt("sk-wrong-key-target"),
      );

      // decrypt 는 keyB env scope 안에서 실행해야 wrong-key(=auth tag mismatch) 분기를
      // 친다. scope 밖에서 실행하면 env 가 이미 복원돼 missing-env 분기를 타 버린다.
      withEnvKey(keyB, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.decrypt(envelope)).toThrow();
      });
    });
  });

  describe("missing / invalid env key (error path + fail-fast)", () => {
    // ------------------------------------------------------------------
    // Error path (보안 핵심) — LLM_APIKEY_ENC_KEY 미설정 시 encrypt / decrypt 모두
    // fail-fast throw (평문 fallback 절대 금지).
    // ------------------------------------------------------------------
    it("LLM_APIKEY_ENC_KEY 미설정 시 encrypt 가 throw 한다 (missing-env fail-fast)", () => {
      withEnvKey(undefined, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.encrypt("sk-no-key")).toThrow(ENC_KEY_ENV);
      });
    });

    it("LLM_APIKEY_ENC_KEY 미설정 시 decrypt 도 throw 한다 (missing-env fail-fast)", () => {
      withEnvKey(undefined, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.decrypt("any-envelope")).toThrow(ENC_KEY_ENV);
      });
    });

    // 빈 string env 도 부재로 취급 (placeholder fallback 두지 않음 — branch).
    it("LLM_APIKEY_ENC_KEY 가 빈 string 이면 부재로 취급해 throw 한다 (branch — empty env)", () => {
      withEnvKey("", () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.encrypt("sk-empty-env")).toThrow(ENC_KEY_ENV);
      });
    });

    // ------------------------------------------------------------------
    // Error path / branch — 키 길이 미달 (32 byte 아님) 시 throw.
    // base64 로도 hex 로도 32 byte 가 아닌 키.
    // ------------------------------------------------------------------
    it("키 길이가 32 byte 미만이면 throw 한다 (키 길이 미달 — fail-fast)", () => {
      // 16 byte base64 키 — base64·hex 어느 디코딩으로도 32 byte 아님.
      const shortKey = randomBytes(16).toString("base64");
      withEnvKey(shortKey, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.encrypt("sk-short-key")).toThrow(ENC_KEY_ENV);
      });
    });

    it("키 길이가 32 byte 초과면 throw 한다 (키 길이 초과 — boundary)", () => {
      const longKey = randomBytes(48).toString("base64");
      withEnvKey(longKey, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.encrypt("sk-long-key")).toThrow(ENC_KEY_ENV);
      });
    });

    // resolveKey 를 직접 호출해 분기를 명시 cover (export 박제 helper).
    it("resolveKey 는 유효 키 set 시 32-byte Buffer 를 반환한다 (resolveKey happy)", () => {
      const key = randomKeyBase64();
      const buf = withEnvKey(key, () => resolveKey());
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBe(32);
    });
  });

  describe("깨진 / 잘린 envelope (error path + branch)", () => {
    // ------------------------------------------------------------------
    // Error path — decrypt 에 IV + authTag 최소 길이 미달 envelope 입력 시
    // 명확한 error throw (의미 불명한 crypto error 대신 진단 메시지).
    // ------------------------------------------------------------------
    it("IV+authTag 최소 길이 미달 envelope decrypt 시 throw 한다 (잘린 입력 — branch)", () => {
      const key = randomKeyBase64();
      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        // 4 byte 만 base64 — 최소 길이(28B) 미달.
        const tooShort = Buffer.from([1, 2, 3, 4]).toString("base64");
        expect(() => cipher.decrypt(tooShort)).toThrow();
      });
    });

    it("깨진 base64 (빈 string) decrypt 시 throw 한다 (negative — 깨진 입력)", () => {
      const key = randomKeyBase64();
      withEnvKey(key, () => {
        const cipher = new LlmApiKeyCipher();
        expect(() => cipher.decrypt("")).toThrow();
      });
    });
  });
});

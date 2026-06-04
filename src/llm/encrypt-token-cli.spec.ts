// encrypt-token-cli spec — T-0206 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + round-trip(consumer 호환) + §9 secret 미노출 회귀 가드).
//
// 본 spec 은 LLM_APIKEY_ENC_KEY env var 를 각 test 마다 in-memory 로 주입/복원해
// PostgreSQL / 외부 의존 / 실 네트워크 없이 isolated 하게 실행된다. 실 secret 값은
// 박제 0 — test 전용 키는 crypto.randomBytes(32) 로 생성하고, 평문은 "plain-token"
// 류 명백한 더미만 사용한다 (CLAUDE.md §9 — secret literal 0).
//
// 검증 포인트:
//   - happy: encryptToken 이 non-empty base64 envelope 반환 + round-trip(그 envelope
//     을 cipher.decrypt / decryptGithubInstanceToken 로 복원하면 원 평문 일치).
//     runEncryptTokenCli 가 stdin/argv 평문 → stdout ciphertext, exit 0.
//   - error path: 키 부재/길이 미달 → cipher.encrypt throw → CLI 비0 + stderr 진단.
//     빈/공백-only 평문 → encryptToken fail-fast throw.
//   - branch: 입력 source (stdin / argv / 둘 다 부재) 각 1+, exit code (0 / 비0) 각 1+.
//   - negative(보안): 평문이 stdout/stderr 출력 어디에도 등장하지 않음 assert.
import { randomBytes } from "node:crypto";

import { decryptGithubInstanceToken } from "../github/github-token-decrypt";

import {
  encryptToken,
  resolvePlaintext,
  runEncryptTokenCli,
  type EncryptTokenCliIo,
} from "./encrypt-token-cli";
import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";

const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";

// withEnvKey — 주어진 키 인코딩 string 을 LLM_APIKEY_ENC_KEY 에 set 한 뒤 fn 을
// 실행하고, 끝나면 원래 env 값을 복원한다 (test 간 env 누수 방지). 실 secret 값은
// 박제하지 않고 호출부가 in-memory 로 생성한 키만 전달한다 (cipher spec 패턴 mirror).
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

// makeIo — runEncryptTokenCli 에 주입할 io 를 만든다. stdout/stderr 는 capture
// 배열에 누적해 출력 내용을 assert 할 수 있게 한다 (특히 §9 평문 미노출 검증).
function makeIo(
  overrides: Partial<EncryptTokenCliIo> & { cipher: LlmApiKeyCipher },
): { io: EncryptTokenCliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const io: EncryptTokenCliIo = {
    argv: ["node", "encrypt-token.ts"],
    stdin: undefined,
    stdout: (chunk) => out.push(chunk),
    stderr: (chunk) => err.push(chunk),
    ...overrides,
  };
  return { io, out, err };
}

describe("encryptToken (순수 변환 함수)", () => {
  afterEach(() => {
    delete process.env[ENC_KEY_ENV];
  });

  // ------------------------------------------------------------------
  // Happy path + round-trip — envelope 이 consumer (adapter decrypt) 경로로
  // 복원돼야 한다 (ADR-0017 _TOKEN_ENC 계약 호환).
  // ------------------------------------------------------------------
  it("평문 토큰을 non-empty base64 envelope 으로 변환하고 평문을 노출하지 않는다 (happy)", () => {
    const key = randomKeyBase64();
    const plaintext = "plain-token";

    const envelope = withEnvKey(key, () =>
      encryptToken(plaintext, new LlmApiKeyCipher()),
    );

    expect(typeof envelope).toBe("string");
    expect(envelope.length).toBeGreaterThan(0);
    // 평문이 envelope 에 그대로 노출되지 않음 (암호화됨).
    expect(envelope).not.toContain(plaintext);
  });

  it("emit 한 envelope 을 동일 cipher.decrypt 로 복원하면 원 평문과 일치한다 (round-trip — cipher)", () => {
    const key = randomKeyBase64();
    const plaintext = "plain-token-roundtrip";

    const decrypted = withEnvKey(key, () => {
      const cipher = new LlmApiKeyCipher();
      const envelope = encryptToken(plaintext, cipher);
      return cipher.decrypt(envelope);
    });

    expect(decrypted).toBe(plaintext);
  });

  it("emit 한 envelope 을 decryptGithubInstanceToken (consumer 경로) 로 복원하면 원 평문과 일치한다 (round-trip — adapter)", () => {
    const key = randomKeyBase64();
    const plaintext = "plain-github-token";

    const decrypted = withEnvKey(key, () => {
      const cipher = new LlmApiKeyCipher();
      const tokenEnc = encryptToken(plaintext, cipher);
      // adapter 의 JIT decrypt 경계로 그대로 복원 (ADR-0017 round-trip 호환).
      return decryptGithubInstanceToken(cipher, tokenEnc);
    });

    expect(decrypted).toBe(plaintext);
  });

  // ------------------------------------------------------------------
  // Negative — 빈 / 공백-only 평문은 cipher 호출 전에 fail-fast throw.
  // ------------------------------------------------------------------
  it("빈 평문은 fail-fast throw 한다 (negative — empty plaintext)", () => {
    const key = randomKeyBase64();
    withEnvKey(key, () => {
      expect(() => encryptToken("", new LlmApiKeyCipher())).toThrow();
    });
  });

  it("공백-only 평문은 fail-fast throw 한다 (negative — whitespace-only)", () => {
    const key = randomKeyBase64();
    withEnvKey(key, () => {
      expect(() => encryptToken("   \t\n ", new LlmApiKeyCipher())).toThrow();
    });
  });

  // ------------------------------------------------------------------
  // Error path — 키 부재 / 길이 미달 시 cipher.encrypt 가 throw 를 전파.
  // ------------------------------------------------------------------
  it("LLM_APIKEY_ENC_KEY 부재 시 cipher.encrypt throw 를 전파한다 (error — missing key)", () => {
    withEnvKey(undefined, () => {
      expect(() => encryptToken("plain-token", new LlmApiKeyCipher())).toThrow(
        ENC_KEY_ENV,
      );
    });
  });

  it("키 길이 미달 시 cipher.encrypt throw 를 전파한다 (error — short key)", () => {
    const shortKey = randomBytes(16).toString("base64");
    withEnvKey(shortKey, () => {
      expect(() => encryptToken("plain-token", new LlmApiKeyCipher())).toThrow(
        ENC_KEY_ENV,
      );
    });
  });
});

describe("resolvePlaintext (입력 source 분기)", () => {
  it("stdin 이 있으면 stdin 을 우선한다 (branch — stdin 우선)", () => {
    // argv 에도 값이 있지만 stdin 이 이긴다.
    const result = resolvePlaintext(
      ["node", "cli", "argv-token"],
      "stdin-token\n",
    );
    // 끝의 개행만 정리되고 원본 보존.
    expect(result).toBe("stdin-token");
  });

  it("stdin 부재 시 argv 첫 실 인자를 쓴다 (branch — argv fallback)", () => {
    const result = resolvePlaintext(["node", "cli", "argv-token"], undefined);
    expect(result).toBe("argv-token");
  });

  it("stdin 이 공백-only 면 argv 로 fall back 한다 (branch — blank stdin)", () => {
    const result = resolvePlaintext(["node", "cli", "argv-token"], "   \n");
    expect(result).toBe("argv-token");
  });

  it("stdin·argv 둘 다 부재면 undefined 를 반환한다 (branch — neither)", () => {
    expect(resolvePlaintext(["node", "cli"], undefined)).toBeUndefined();
  });

  it("argv 인자가 공백-only 면 undefined 를 반환한다 (negative — blank argv)", () => {
    expect(resolvePlaintext(["node", "cli", "   "], undefined)).toBeUndefined();
  });
});

describe("runEncryptTokenCli (CLI 실행 — exit code + §9 secret 미노출)", () => {
  afterEach(() => {
    delete process.env[ENC_KEY_ENV];
  });

  // ------------------------------------------------------------------
  // Happy path — stdin 평문 → stdout ciphertext, exit 0.
  // ------------------------------------------------------------------
  it("stdin 평문을 받아 ciphertext 를 stdout 에 출력하고 0 을 반환한다 (happy — stdin)", () => {
    const key = randomKeyBase64();
    const plaintext = "plain-token";

    const { code, out, err } = withEnvKey(key, () => {
      const { io, out, err } = makeIo({
        stdin: `${plaintext}\n`,
        cipher: new LlmApiKeyCipher(),
      });
      return { code: runEncryptTokenCli(io), out, err };
    });

    expect(code).toBe(0);
    expect(err).toHaveLength(0);
    const emitted = out.join("");
    expect(emitted.trim().length).toBeGreaterThan(0);
    // §9 — 평문이 stdout 에 등장하지 않음 (ciphertext 만).
    expect(emitted).not.toContain(plaintext);
  });

  it("argv 평문을 받아 ciphertext 를 stdout 에 출력하고 0 을 반환한다 (happy — argv)", () => {
    const key = randomKeyBase64();
    const plaintext = "plain-token-argv";

    const { code, emitted } = withEnvKey(key, () => {
      const { io, out } = makeIo({
        argv: ["node", "cli", plaintext],
        cipher: new LlmApiKeyCipher(),
      });
      return { code: runEncryptTokenCli(io), emitted: out.join("") };
    });

    expect(code).toBe(0);
    expect(emitted).not.toContain(plaintext);
    // round-trip — CLI 가 emit 한 envelope 을 복원하면 원 평문 일치.
    const decrypted = withEnvKey(key, () =>
      new LlmApiKeyCipher().decrypt(emitted.trim()),
    );
    expect(decrypted).toBe(plaintext);
  });

  // ------------------------------------------------------------------
  // Branch / error — 입력 source 부재 → 비0 + usage 진단 (평문 없음).
  // ------------------------------------------------------------------
  it("stdin·argv 둘 다 평문 부재면 비0 을 반환하고 usage 진단을 stderr 로 낸다 (error — neither)", () => {
    const key = randomKeyBase64();
    const { code, out, err } = withEnvKey(key, () => {
      const { io, out, err } = makeIo({
        argv: ["node", "cli"],
        stdin: undefined,
        cipher: new LlmApiKeyCipher(),
      });
      return { code: runEncryptTokenCli(io), out, err };
    });

    expect(code).toBe(1);
    expect(out).toHaveLength(0);
    expect(err.join("")).toContain("사용법");
  });

  // ------------------------------------------------------------------
  // Error path — 키 부재 시 cipher.encrypt throw → 비0 + stderr 진단.
  // §9 — 진단 메시지에 평문이 등장하지 않음.
  // ------------------------------------------------------------------
  it("LLM_APIKEY_ENC_KEY 부재 시 비0 을 반환하고 평문을 노출하지 않는다 (error — missing key, §9)", () => {
    const plaintext = "plain-secret-token";
    const { io, out, err } = makeIo({
      stdin: `${plaintext}\n`,
      cipher: new LlmApiKeyCipher(),
    });
    const code = withEnvKey(undefined, () => runEncryptTokenCli(io));

    expect(code).toBe(1);
    // ciphertext 가 안 나왔으므로 stdout 비어있음.
    expect(out).toHaveLength(0);
    const diag = err.join("");
    expect(diag.length).toBeGreaterThan(0);
    // §9 핵심 — error 진단에 평문 토큰이 절대 등장하지 않는다.
    expect(diag).not.toContain(plaintext);
  });

  it("키 길이 미달 시 비0 을 반환하고 평문을 노출하지 않는다 (error — short key, §9)", () => {
    const shortKey = randomBytes(16).toString("base64");
    const plaintext = "plain-secret-token-2";

    const { code, out, err } = withEnvKey(shortKey, () => {
      const { io, out, err } = makeIo({
        argv: ["node", "cli", plaintext],
        cipher: new LlmApiKeyCipher(),
      });
      return { code: runEncryptTokenCli(io), out, err };
    });

    expect(code).toBe(1);
    expect(out).toHaveLength(0);
    expect(err.join("")).not.toContain(plaintext);
  });

  it("빈 평문(공백-only stdin·argv)은 입력 부재로 처리해 비0 을 반환한다 (negative — blank input)", () => {
    const key = randomKeyBase64();
    const { code, err } = withEnvKey(key, () => {
      const { io, err } = makeIo({
        argv: ["node", "cli", "   "],
        stdin: "   \n",
        cipher: new LlmApiKeyCipher(),
      });
      return { code: runEncryptTokenCli(io), err };
    });
    // 공백-only 는 resolvePlaintext 가 부재로 보므로 usage 진단 + 비0.
    expect(code).toBe(1);
    expect(err.join("")).toContain("사용법");
  });

  // ------------------------------------------------------------------
  // Negative (비-Error throw 분기, T-0231 audit P1) — cipher.encrypt 가
  // Error 인스턴스가 아닌 값 (string / object) 을 throw 했을 때, catch 의
  // `error instanceof Error ? error.message : String(error)` 중 `: String(error)`
  // 갈래가 실행된다 (encrypt-token-cli.ts:113). 기존 error-path test (위 264·281)
  // 는 전부 Error 인스턴스를 throw 하므로 이 갈래는 미검증이었다 (branch 91.66).
  // makeThrowingCipher — encrypt 가 주어진 비-Error 값을 throw 하는 stub cipher 를
  // 만든다. decrypt 는 본 분기에서 호출되지 않으므로 호출 시 fail 하는 guard 만 둔다.
  // ------------------------------------------------------------------
  function makeThrowingCipher(thrown: unknown): LlmApiKeyCipher {
    return {
      encrypt: (): string => {
        throw thrown;
      },
      decrypt: (): string => {
        throw new Error(
          "decrypt 는 본 negative test 에서 호출되지 않아야 한다",
        );
      },
    } as unknown as LlmApiKeyCipher;
  }

  // 비-Error throw 대표 type 을 1종 초과로 cover (R-112 negative 충분 cover):
  //   - string: 진단 메시지에 String(error) === 그 string 자체가 포함됨.
  //   - object({}): String({}) === "[object Object]" 가 포함됨.
  it.each([
    {
      label: "string 값",
      thrown: "비-Error string 폭발",
      expectedFragment: "비-Error string 폭발",
    },
    {
      label: "object 값",
      thrown: { reason: "non-error object" },
      expectedFragment: "[object Object]",
    },
  ])(
    "cipher.encrypt 가 $label 을 throw 하면 String(error) 분기로 비0 을 반환하고 평문을 노출하지 않는다 (negative — 비-Error throw, §9)",
    ({ thrown, expectedFragment }) => {
      const plaintext = "plain-secret-token-non-error";
      const { io, out, err } = makeIo({
        argv: ["node", "cli", plaintext],
        cipher: makeThrowingCipher(thrown),
      });

      const code = runEncryptTokenCli(io);

      // (a) 비0 exit — 암호화 실패가 표면화됨.
      expect(code).toBe(1);
      // (b) stdout 비어있음 — ciphertext 미출력.
      expect(out).toHaveLength(0);
      const diag = err.join("");
      // (c) stderr 진단에 String(error) 결과가 포함됨 (: String(error) 갈래 실행 증거).
      expect(diag).toContain(expectedFragment);
      expect(diag).toContain("토큰 암호화 실패");
      // (d) §9 — 평문 토큰이 stderr·stdout 어디에도 등장하지 않음.
      expect(diag).not.toContain(plaintext);
      expect(out.join("")).not.toContain(plaintext);
    },
  );
});

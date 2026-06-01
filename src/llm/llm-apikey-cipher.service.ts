// LlmApiKeyCipher — LlmProviderConfig.apiKey 의 application-layer AES-256-GCM
// envelope 암복호화 helper (T-0147 acceptance / ADR-0014 Decision §1·§2 박제).
//
// 책임:
//   - encrypt(plaintext): 평문 apiKey 를 AES-256-GCM 으로 암호화 → IV + authTag +
//     ciphertext 를 단일 base64 string (envelope) 으로 packing 해 반환.
//   - decrypt(envelope): envelope 을 unpack 해 IV / authTag / ciphertext 분리 후
//     복호화. auth tag 검증 실패 (변조 / 잘못된 키) 시 throw (swallow 금지).
//   - 키는 LLM_APIKEY_ENC_KEY env var 에서 read (AES-256 = 32-byte, base64 또는
//     hex 디코딩). env 부재 / 길이 미달 시 명확한 error throw — 평문 fallback 절대
//     금지 (보안 invariant — ADR-0014 §2).
//
// 보안 invariant (ADR-0014 Decision §1 / Consequences §3 박제):
//   - AES-256-GCM 은 authenticated encryption (AEAD) — auth tag 가 ciphertext
//     변조 (DB row tamper) 를 detect → CBC 등 non-AEAD mode 대비 무결성 보장.
//   - IV (nonce) 는 매 encrypt 호출 crypto.randomBytes(12) 로 고유 random 생성 —
//     재사용 시 GCM 기밀성 붕괴. envelope 에 IV 를 함께 영속해 decrypt 가 복원.
//   - fail-fast: jwt.strategy.ts 의 env getter 패턴 mirror 하되, 암호화 키는
//     placeholder fallback 을 두지 않는다 (JWT 와 달리 secret 부재 시 boot 가
//     아니라 암호화/복호화 *시점* 에 fail-fast — 평문 노출 방지).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - POST/PATCH/DELETE config write endpoint / write DTO — Follow-up #2.
//   - DB schema migration (apiKey 평문 → ciphertext form 전환) — 별도 schema task
//     (ADR-0014 §4). 본 helper 는 string → string 변환만.
//   - repository / service 의 encrypt 호출 wire — Follow-up #2.
//   - LlmGateway decrypt wire (LLM 호출 직전 복호화) — Follow-up #4.
//   - 키 rotation batch / key version prefix — 후속 KMS 전환 ADR (ADR-0014 §2).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

// AES-256-GCM envelope 상수. IV 12 byte 는 GCM 권장 nonce 길이 (NIST SP 800-38D),
// authTag 16 byte 는 GCM 기본 tag 길이. 키는 AES-256 = 32 byte.
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

// LLM_APIKEY_ENC_KEY env var 이름 박제 (실 secret 값 0 — ADR-0014 §2 / CLAUDE.md §9).
const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";

// resolveKey — LLM_APIKEY_ENC_KEY env var 에서 32-byte AES-256 키를 read·decode.
// base64 우선 디코딩 후 길이가 32 가 아니면 hex 로 재시도 (운영자가 어느 인코딩으로
// 주입하든 수용 — ADR-0014 §2 "base64 또는 hex"). 어느 인코딩으로도 32 byte 가
// 아니면 throw (fail-fast — 평문 fallback 절대 금지). export 박제 — spec 이 직접
// 호출해 env 부재 / 길이 미달 분기를 R-112 카테고리로 cover.
export function resolveKey(): Buffer {
  const raw = process.env[ENC_KEY_ENV];
  // env 부재 분기 — 빈 string 도 부재로 취급 (placeholder fallback 두지 않음).
  if (raw === undefined || raw === "") {
    throw new Error(
      `${ENC_KEY_ENV} 환경변수가 설정되지 않았습니다 (AES-256 = 32-byte base64/hex 키 필요, 평문 fallback 금지)`,
    );
  }

  // base64 디코딩 시도 → 32 byte 면 그대로 사용.
  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === KEY_LENGTH_BYTES) {
    return fromBase64;
  }

  // base64 가 32 byte 가 아니면 hex 로 재시도 (운영자가 hex 로 주입한 경우).
  const fromHex = Buffer.from(raw, "hex");
  if (fromHex.length === KEY_LENGTH_BYTES) {
    return fromHex;
  }

  // 어느 인코딩으로도 32 byte 가 아니면 키 길이 미달 — fail-fast throw.
  throw new Error(
    `${ENC_KEY_ENV} 키 길이가 올바르지 않습니다 (AES-256 = 32-byte 필요, base64/hex 디코딩 결과가 32 byte 가 아님)`,
  );
}

@Injectable()
export class LlmApiKeyCipher {
  // encrypt — 평문 apiKey 를 AES-256-GCM 으로 암호화. 매 호출 고유 IV 생성 →
  // ciphertext + IV + authTag 를 단일 base64 envelope 으로 packing 해 반환.
  //
  // envelope 레이아웃: base64( IV(12B) || authTag(16B) || ciphertext(가변) ).
  // decrypt 가 동일 offset 으로 unpack 한다 (round-trip 호환).
  //
  // 분기: 키 resolve 실패 (env 부재 / 길이 미달) 시 resolveKey 가 throw 하여
  // 평문이 암호화 없이 반환되는 경로를 차단 (fail-fast).
  encrypt(plaintext: string): string {
    const key = resolveKey();
    // IV 는 매 호출 random — 동일 평문이라도 envelope 이 매번 달라진다 (IV 고유성,
    // ADR-0014 Consequences §3 — GCM nonce 재사용 회귀 방지).
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // IV || authTag || ciphertext 순서로 concat 후 base64 packing.
    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  }

  // decrypt — base64 envelope 을 unpack 해 IV / authTag / ciphertext 분리 후
  // 복호화. auth tag 검증 실패 (ciphertext 변조 / 잘못된 키) 시 node:crypto 가
  // `Unsupported state or unable to authenticate data` 류 error 를 throw —
  // 본 메서드는 그것을 swallow 하지 않고 그대로 propagate (무결성 위반 표면화).
  //
  // 분기: envelope 길이가 IV + authTag 최소 길이 미만 (깨진 base64 / 잘린 입력) 이면
  // 복호화 전에 명확한 error throw — 의미 불명한 crypto error 대신 진단 가능 메시지.
  decrypt(envelope: string): string {
    const key = resolveKey();
    const buffer = Buffer.from(envelope, "base64");

    // 깨진 / 잘린 envelope 분기 — IV + authTag 최소 길이를 만족하지 못하면 throw.
    const minLength = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;
    if (buffer.length < minLength) {
      throw new Error(
        "복호화할 envelope 이 올바르지 않습니다 (IV + authTag 최소 길이 미달 — 깨진 base64 또는 잘린 입력)",
      );
    }

    // 고정 offset 으로 IV / authTag / ciphertext 분리.
    const iv = buffer.subarray(0, IV_LENGTH_BYTES);
    const authTag = buffer.subarray(IV_LENGTH_BYTES, minLength);
    const ciphertext = buffer.subarray(minLength);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // ciphertext 변조 / 잘못된 키면 final() 단계에서 auth tag mismatch 로 throw.
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

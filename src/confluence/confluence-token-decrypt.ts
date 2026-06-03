// confluence-token-decrypt — ConfluenceInstanceConfig.tokenEnc (encrypted-at-rest
// envelope) 를 HTTP 호출 직전에만 평문 token 으로 복호화하는 순수/얇은 helper
// (T-0185, ADR-0018 Decision §6 token JIT decrypt + ADR-0014 cipher 재사용).
// milestone-3 GitHub 측 동형 helper (src/github/github-token-decrypt.ts, T-0179) 의
// 직접 mirror 다.
//
// 책임:
//   - decryptConfluenceInstanceToken(cipher, tokenEnc): resolveConfluenceInstances
//     가 암호문 그대로 보관한 _TOKEN_ENC envelope 을 ADR-0014 cipher 로 복호화해
//     평문 token 을 반환한다. 복호 호출은 본 helper 진입 시점 (= HTTP 호출 직전)
//     에만 일어난다 — eager 전체 복호화 금지 (never-read-back 정합,
//     ADR-0014 §3 / ADR-0018 Decision §6).
//
// 보안 invariant (ADR-0014 §3 never-read-back / CLAUDE.md §9):
//   - 복호된 평문 token 은 반환값으로만 노출한다. 로그 / 직렬화 / error message
//     어디에도 평문 token 을 싣지 않는다 (호출처가 in-memory transient 로 즉시
//     auth header 에 실은 뒤 폐기하도록 평문을 반환만 한다).
//   - 빈/공백-only tokenEnc 분기는 평문 token 을 포함하지 않는 진단 메시지로
//     fail-fast throw 한다 (애초에 평문이 없으므로 노출 risk 0).
//   - cipher.decrypt 가 throw (env 부재 / 키 길이 미달 / 깨진 base64 / auth tag
//     mismatch) 하면 swallow 하지 않고 그대로 전파한다 — 무결성/설정 위반을
//     표면화. cipher 의 error message 는 token 평문을 포함하지 않는다 (ADR-0014).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - ConfluenceAdapter / ConfluenceModule 으로의 실 wire (instance config 순회 →
//     decrypt → request-builder 의 auth header 주입) — chain row 3+ 책임 (후속 task).
//   - request-builder (buildConfluenceRequest) / Cloud Basic vs Server Bearer header
//     조립 — ADR-0018 Decision §3/§6 chain row 3. 본 helper 는 평문 token 반환만.
//   - token 전용 master key (CONFLUENCE_TOKEN_ENC_KEY) 신설 — 본 helper 는 기존
//     LLM_APIKEY_ENC_KEY 를 쓰는 cipher 를 as-is 재사용 (ADR-0014 amendment 불요).
//   - LlmApiKeyCipher 의 일반화/리네이밍 — cipher 는 평문 내용과 무관하게 envelope
//     을 복호화하므로 그대로 재사용 (cipher 파일 미수정).
import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { ConfluenceInstanceConfig } from "./confluence-instance-config";

// decryptConfluenceInstanceToken — encrypted-at-rest token envelope 을 평문 token
// 으로 복호화한다 (ADR-0018 chain row 2). cipher 는 인자로 주입받아 unit 에서 mock
// 가능하게 한다 (DI / 함수 인자 둘 다 수용 — 호출처가 ConfluenceModule provider 든
// test mock 이든 LlmApiKeyCipher 형태만 만족하면 된다). 순수 함수로 두어 부수효과
// 0 — 복호 호출은 본 함수 진입 시점에만 일어나며, 결과는 반환값으로만 노출한다.
//
// 분기:
//   - tokenEnc 가 빈 문자열 / 공백-only / undefined → fail-fast throw (cipher
//     호출 전에 차단). resolveConfluenceInstances 가 부재 _TOKEN_ENC instance 를
//     이미 reject 하지만, 본 helper 가 단독 호출돼도 평문/빈 fallback 을 두지
//     않도록 방어 layer 를 둔다 (cipher resolveKey 의 fail-fast 정합).
//   - 유효 envelope → cipher.decrypt 위임. decrypt 의 throw (깨진 base64 / 변조 /
//     키 부재·길이 미달) 는 그대로 전파한다 (swallow 금지).
//
// 평문 token 은 본 함수 반환값 외에 어디에도 노출하지 않는다 (never-read-back).
export function decryptConfluenceInstanceToken(
  cipher: LlmApiKeyCipher,
  tokenEnc: string | undefined,
): string {
  // 빈/공백-only/undefined envelope 방어 분기 — 평문/빈 fallback 금지 (fail-fast).
  // 진단 메시지에는 token 평문이 존재하지 않으므로 노출 risk 0 (애초에 평문 없음).
  if (typeof tokenEnc !== "string" || tokenEnc.trim().length === 0) {
    throw new Error(
      "confluence token 복호화 실패: tokenEnc envelope 이 비어있거나 string 이 아님 (encrypted-at-rest envelope 필요, 평문/빈 fallback 금지)",
    );
  }

  // JIT decrypt — 본 호출 시점 (= HTTP 호출 직전) 에만 복호화한다. cipher 의 throw
  // (auth tag mismatch / 깨진 envelope / 키 부재·길이 미달) 는 그대로 전파한다.
  // 반환된 평문 token 은 호출처가 in-memory transient 로만 사용한다.
  return cipher.decrypt(tokenEnc);
}

// decryptConfluenceInstanceConfigToken — 편의 overload. ConfluenceInstanceConfig 를
// 그대로 받아 그 tokenEnc 필드를 decryptConfluenceInstanceToken 으로 위임한다.
// 호출처가 instance config 객체를 순회하며 사용할 때 tokenEnc 추출을 한 곳에 모은다
// (실 adapter wire 는 본 task 밖이나, config → 평문 token 경계를 명시적으로 박제).
export function decryptConfluenceInstanceConfigToken(
  cipher: LlmApiKeyCipher,
  instance: ConfluenceInstanceConfig,
): string {
  return decryptConfluenceInstanceToken(cipher, instance.tokenEnc);
}

#!/usr/bin/env ts-node
// scripts/encrypt-token — 평문 토큰 → AES-256-GCM ciphertext envelope (_TOKEN_ENC)
// 변환 CLI 의 얇은 entrypoint (T-0206). src/main.ts 가 부트스트랩만 담는 패턴 mirror —
// 분기 로직 0, 실 process io / cipher 를 주입해 src 본체 runEncryptTokenCli 에 위임만 한다.
//
// 사용법:
//   LLM_APIKEY_ENC_KEY=<32-byte base64/hex 키> echo <plaintext-token> | ts-node scripts/encrypt-token.ts
//   LLM_APIKEY_ENC_KEY=<...> ts-node scripts/encrypt-token.ts <plaintext-token>
//   출력: ciphertext envelope 한 줄 (GITHUB_<KEY>_TOKEN_ENC / CONFLUENCE_<KEY>_TOKEN_ENC 에 주입).
//
// 보안 (CLAUDE.md §9): 평문 토큰·키는 stdout/stderr 에 echo 하지 않는다 (본체가 보장).
import { runEncryptTokenCli } from "../src/llm/encrypt-token-cli";
import { LlmApiKeyCipher } from "../src/llm/llm-apikey-cipher.service";

// readStdin — stdin 파이프 입력을 동기 수집한다. TTY (파이프 없음) 면 빈 string
// 을 반환해 본체가 argv 경로로 fall back 하게 한다. 분기 로직은 본체에 있으므로
// 여기서는 입력 수집만 (entrypoint trivial 유지).
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

// main — 실 process io 와 cipher 를 주입해 본체를 호출하고 exit code 를 그대로
// process.exit 에 전달한다. 분기 없음 — 본체가 모든 판정을 담당.
async function main(): Promise<void> {
  const stdin = await readStdin();
  const code = runEncryptTokenCli({
    argv: process.argv,
    stdin,
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
    cipher: new LlmApiKeyCipher(),
  });
  process.exit(code);
}

// 본 파일이 직접 실행될 때만 동작한다 (test 에서 import 시 side effect 방지).
if (require.main === module) {
  void main();
}

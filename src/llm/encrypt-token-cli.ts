// encrypt-token-cli — 평문 토큰을 AES-256-GCM ciphertext envelope (_TOKEN_ENC)
// 으로 변환하는 CLI 의 testable 본체 (T-0206, ADR-0014 cipher 재사용 / ADR-0017
// _TOKEN_ENC consumer 계약 정합).
//
// 책임:
//   - encryptToken(plaintext, cipher): 빈/공백-only plaintext 를 fail-fast 로 거부한
//     뒤 cipher.encrypt 에 위임해 envelope 을 반환한다. crypto 재구현 0 —
//     LlmApiKeyCipher.encrypt 호출만 (ADR-0014 AES-256-GCM envelope 재사용).
//   - runEncryptTokenCli(io): io = { argv, stdin, stdout, stderr, cipher } 를 주입받아
//     unit-testable 한 CLI 실행 함수. 평문을 stdin 우선, 없으면 argv 로 읽어
//     encryptToken → ciphertext 만 stdout 에 출력하고 exit code (0=성공, 비0=실패) 를
//     반환한다. 실 process 를 직접 참조하지 않는다 (entrypoint 가 주입).
//
// 보안 invariant (CLAUDE.md §9 / ADR-0014 §3 never-read-back):
//   - 평문 토큰은 stdout / stderr / 로그 어디에도 echo 하지 않는다. stdout 에는
//     ciphertext envelope 만, error 메시지에도 평문을 싣지 않는다 (진단 메시지는
//     평문 미포함 — 부재/형식 사유만).
//   - 암호화 키 (LLM_APIKEY_ENC_KEY) 값도 코드/출력 어디에도 노출하지 않는다 —
//     cipher 가 env 에서 read 하고 본 모듈은 그 값을 만지지 않는다.
//   - cipher.encrypt 의 throw (env 부재 / 키 길이 미달) 는 swallow 하지 않고 비0
//     exit + 진단 메시지로 표면화한다 (평문 fallback 절대 금지).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - LLM apiKey at-rest 완결 (prisma schema migration) — 별도 §5 게이트 task.
//   - 실 GitHub/Confluence/LLM token 의 실값 처리 — 사용자 env/secret 책임 (실값 0).
//   - token 전용 master key 신설 — 기존 LLM_APIKEY_ENC_KEY cipher 를 as-is 재사용.
import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";

// runEncryptTokenCli 에 주입하는 io 경계. 실 process 대신 본 인터페이스를 주입받아
// stdin/argv/stdout/stderr/cipher 를 unit 에서 모두 mock 할 수 있게 한다 (부수효과를
// 인자로 외화 — llm-live-test-gating 의 env-인자 패턴 mirror).
export interface EncryptTokenCliIo {
  // process.argv 와 동형 — 본 함수는 index 2 이후 (실 인자) 만 본다.
  argv: string[];
  // stdin 으로 들어온 평문 (파이프 입력). 부재 시 undefined / 빈 string.
  stdin?: string;
  // ciphertext envelope 한 줄을 출력하는 sink (실 process.stdout.write 주입).
  stdout: (chunk: string) => void;
  // 진단 메시지 sink (실 process.stderr.write 주입). 평문 미포함.
  stderr: (chunk: string) => void;
  // ADR-0014 envelope cipher — 실행부가 new LlmApiKeyCipher() 를 주입.
  cipher: LlmApiKeyCipher;
}

// encryptToken — 평문 토큰을 ciphertext envelope 으로 변환한다 (순수 위임 함수).
// 빈/공백-only plaintext 는 cipher 호출 전에 fail-fast throw 한다 (평문/빈 fallback
// 금지 — github-token-decrypt 의 빈 envelope 방어와 대칭). 유효 평문은
// cipher.encrypt 에 그대로 위임한다 (crypto 재구현 0).
//
// 진단 메시지에는 평문을 포함하지 않는다 (애초에 빈/공백이므로 노출 risk 0이지만,
// 일관된 secret 미노출 규율을 유지).
export function encryptToken(
  plaintext: string,
  cipher: LlmApiKeyCipher,
): string {
  if (typeof plaintext !== "string" || plaintext.trim().length === 0) {
    throw new Error(
      "암호화할 평문 토큰이 비어있거나 공백뿐입니다 (non-empty plaintext 필요, 빈/평문 fallback 금지)",
    );
  }
  return cipher.encrypt(plaintext);
}

// resolvePlaintext — io 의 stdin 우선, 없으면 argv 의 첫 실 인자에서 평문을 고른다
// (입력 source 분기). 양쪽 모두 부재면 undefined 를 반환한다 (호출부가 비0 exit 으로
// 처리). 평문 자체는 trim 하지 않고 원본을 보존하되 (토큰 내부 공백 가능성 방어),
// "비어있는지" 판정만 trim 후 길이로 한다.
export function resolvePlaintext(
  argv: string[],
  stdin: string | undefined,
): string | undefined {
  // stdin 우선 — 파이프로 들어온 입력이 있으면 그것을 쓴다. 끝의 개행만 정리.
  if (typeof stdin === "string" && stdin.trim().length > 0) {
    return stdin.replace(/\r?\n$/, "");
  }
  // stdin 부재 → argv 의 첫 실 인자 (process.argv index 2). 없으면 undefined.
  const fromArgv = argv[2];
  if (typeof fromArgv === "string" && fromArgv.trim().length > 0) {
    return fromArgv;
  }
  return undefined;
}

// runEncryptTokenCli — CLI 실행 본체. 평문을 stdin/argv 에서 골라 encryptToken 으로
// 변환한 ciphertext 만 stdout 에 출력하고 exit code 를 반환한다 (실 process.exit 은
// entrypoint 가 호출 — 본 함수는 코드만 반환해 test 가 검증 가능).
//
// 분기 / exit code:
//   - 평문 source 부재 (stdin·argv 둘 다 없음) → 비0 (1) + usage 진단 (평문 미포함).
//   - encryptToken / cipher.encrypt throw (빈 평문 / 키 부재 / 길이 미달) → 비0 (1)
//     + error.message 진단 (평문 미포함 — encryptToken/cipher 메시지가 secret-free).
//   - 성공 → ciphertext envelope 한 줄 stdout + 0.
export function runEncryptTokenCli(io: EncryptTokenCliIo): number {
  const plaintext = resolvePlaintext(io.argv, io.stdin);
  if (plaintext === undefined) {
    // 입력 source 부재 분기 — 평문을 출력하지 않는 usage 진단만 stderr 로.
    io.stderr(
      "사용법: 평문 토큰을 stdin 으로 파이프하거나 첫 인자로 전달하세요 " +
        "(예: echo <token> | encrypt-token  또는  encrypt-token <token>). " +
        "LLM_APIKEY_ENC_KEY (32-byte base64/hex) env 가 설정돼 있어야 합니다.\n",
    );
    return 1;
  }

  try {
    const envelope = encryptToken(plaintext, io.cipher);
    // 성공 경로 — ciphertext envelope 만 출력한다 (평문/키 미노출).
    io.stdout(`${envelope}\n`);
    return 0;
  } catch (error) {
    // 진단 메시지는 평문을 포함하지 않는다 (encryptToken / cipher 의 메시지는
    // secret-free — 부재/길이/형식 사유만). error 가 아니어도 안전 fallback.
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`토큰 암호화 실패: ${message}\n`);
    return 1;
  }
}

---
id: T-0206
title: 평문 토큰 → AES-256-GCM ciphertext 변환 CLI (LlmApiKeyCipher 재사용, _TOKEN_ENC 생성)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-043, REQ-044]
origin: docs/PLAN.md P4 "자격증명 관리" credential-prep bullet (c) — 토큰 암호화 CLI (사용자 direct commit 536e469)
estimatedDiff: 240
estimatedFiles: 4
created: 2026-06-03
plannerNote: P4 credential-prep (c) — 평문 토큰→_TOKEN_ENC CLI(LlmApiKeyCipher 재사용, dep 0). R-112 backbone ×1.5. pre-check PASS(CLI 부재).
---

# T-0206 — 평문 토큰 → AES-256-GCM ciphertext 변환 CLI (LlmApiKeyCipher 재사용)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 "자격증명 관리" 의 credential-prep bullet **(c)** (사용자 direct commit 536e469 박제) — GitHub/Confluence live-run env 의 `GITHUB_<KEY>_TOKEN_ENC` ([ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) Decision §2) / `CONFLUENCE_<KEY>_TOKEN_ENC` 는 **암호화된 ciphertext envelope** 을 요구하나, 평문 토큰 → ciphertext 변환 도구가 아직 없다. 운영자가 live run 없이 그 ciphertext 값을 만들어 env 에 주입할 수 있게, 기존 [LlmApiKeyCipher](../../src/llm/llm-apikey-cipher.service.ts) (ADR-0014 AES-256-GCM envelope, `LLM_APIKEY_ENC_KEY`) 를 **재사용** 하는 작은 CLI 를 박제한다. 새 외부 dependency 0 (Node 내장 `crypto` + `LlmApiKeyCipher`), 실 token·실 key 0 (test 는 test key). 이는 사용자 GitHub/Confluence token 주입의 **선행 조건** 이며, 본 CLI 가 emit 하는 ciphertext 는 adapter 의 [decryptGithubInstanceToken](../../src/github/github-token-decrypt.ts) / Confluence 등가 JIT-decrypt 경로로 그대로 복호화돼야 한다 (round-trip 호환).

## Required Reading

- [docs/PLAN.md](../PLAN.md) P4 "자격증명 관리" — credential-prep bullet (c) (토큰 암호화 CLI) 의 원문 지시. bullet (d) (apiKey at-rest 완결) 는 본 task 범위 밖 (Out of Scope).
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) — **재사용 대상**. `LlmApiKeyCipher.encrypt(plaintext): string` 가 `base64(IV||authTag||ciphertext)` envelope 을 반환. `resolveKey()` 가 `LLM_APIKEY_ENC_KEY` (32-byte base64/hex) 를 read·fail-fast. **crypto 재구현 금지 — 본 클래스의 `encrypt` 를 호출만 한다.**
- [src/llm/llm-apikey-cipher.service.spec.ts](../../src/llm/llm-apikey-cipher.service.spec.ts) — test key 주입 패턴 (env mutate + restore, §9 실값 미기재) + round-trip (encrypt→decrypt) assert 패턴 reference. 본 CLI spec 의 test key 셋업이 이 패턴을 mirror.
- [src/github/github-token-decrypt.ts](../../src/github/github-token-decrypt.ts) — **consumer 측 round-trip 경계**. `decryptGithubInstanceToken(cipher, tokenEnc)` 가 `cipher.decrypt(tokenEnc)` 로 `_TOKEN_ENC` envelope 을 복호화. 본 CLI 가 emit 한 ciphertext 가 이 경로로 평문 복원돼야 함 (round-trip acceptance).
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) Decision §1/§2 — envelope 구조 (AES-256-GCM + IV + authTag) + `LLM_APIKEY_ENC_KEY` 키 보관. 본 CLI 의 ciphertext format 근거.
- [docs/decisions/ADR-0017-github-instance-config-source.md](../decisions/ADR-0017-github-instance-config-source.md) Decision §2/§3 — `GITHUB_<KEY>_TOKEN_ENC` 가 "AES-256-GCM envelope (base64) 형태의 암호문" 임을 박제 (`_ENC` suffix = 암호화된 형태). 본 CLI 의 출력이 채울 env 변수의 consumer 계약.
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — `process.env` 를 인자로 받는 부수효과-0 순수 함수 + fail-fast 방어 패턴 reference (본 CLI 의 입력 파싱 helper 가 mirror — argv/stdin/env 를 인자로 받아 unit-testable 하게).
- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) — 신규 production `.ts` 는 colocated `*.spec.ts` 의무 (R-112 1차 layer). `scripts/*.ts` 도 검사 대상 (`src/main.ts` 만 예외) — 본 task 의 entrypoint 구조 결정 근거 (아래 Acceptance Criteria 참조).
- [package.json](../../package.json) — jest `testRegex` `.*\.spec\.ts$` / `collectCoverageFrom` `src/**/*.(t|j)s` / `coveragePathIgnorePatterns` (`src/main.ts`, `.module.ts`). **coverage threshold 는 `src/**` 만 집계** → 본 CLI 의 testable 로직은 `src/` 아래 두어야 coverage 강제가 적용됨 (아래 구조 결정).

## Acceptance Criteria

**구조 결정 (R-112 coverage 강제 + spec-presence 정합):** testable 로직은 `src/` 아래 순수 모듈로, entrypoint 는 얇은 wrapper 로 분리한다 — `src/main.ts` 가 부트스트랩만 담고 entrypoint-exempt 인 패턴 mirror.

- [ ] `src/llm/encrypt-token-cli.ts` 신설 — testable 본체. 다음 2 layer 제공:
  - 순수 변환 함수 `encryptToken(plaintext: string, cipher: LlmApiKeyCipher): string` — 빈/공백-only plaintext 거부 (fail-fast throw, 평문/빈 fallback 금지) 후 `cipher.encrypt(plaintext)` 위임. **crypto 재구현 0 — `cipher.encrypt` 호출만.**
  - CLI 실행 함수 `runEncryptTokenCli(io)` — `io = { argv, stdin, stdout, stderr, cipher }` 를 인자로 주입받아 unit-testable (실 `process` 직접 참조 금지). 평문 토큰을 **stdin 우선, 없으면 argv** 로 읽어 `encryptToken` → ciphertext 를 stdout 에 출력하고 exit code (0=성공, 비0=실패) 를 반환. **평문 토큰은 절대 stdout/stderr/로그에 echo 하지 않는다** — 출력은 ciphertext envelope 만, error 메시지에도 평문 미포함 (§9).
- [ ] `scripts/encrypt-token.ts` 신설 — 얇은 entrypoint (shebang + `runEncryptTokenCli` 호출 + 실 `process.argv`/`process.stdin`/`process.stdout`/`new LlmApiKeyCipher()` 주입 + `process.exit(code)`). 분기 로직 0 — 본체는 `src/llm/encrypt-token-cli.ts`. (이 entrypoint 가 `src/main.ts` 처럼 trivial 하도록 유지 — 분기는 src 본체에.)
- [ ] **spec-presence 정합** — `scripts/encrypt-token.ts` 도 `check-spec-presence.sh` 의 신규 `.ts` 검사 대상이므로 colocated `scripts/encrypt-token.spec.ts` 를 둔다 (entrypoint 가 src 본체를 호출만 함을 검증하는 최소 spec). 본체 R-112 cover 는 `src/llm/encrypt-token-cli.spec.ts` 가 담당. (대안: entrypoint 를 `src/main.ts` 와 동일하게 `check-spec-presence.sh` 의 예외 case 에 추가 — 이 경우 sh 1 줄 수정 + 그 변경 자체의 reviewer 점검. 둘 중 implementer 가 더 작은 diff 를 택하되, 택한 쪽을 PR 본문에 명시.)
- [ ] `src/llm/encrypt-token-cli.spec.ts` (colocated) 신설 — R-112 4 항목:
  - **happy-path**: test key (`LLM_APIKEY_ENC_KEY` 32-byte test 값 env 주입, §9 실 key 미기재) 셋업 후 `encryptToken("plain-token", cipher)` 가 non-empty base64 envelope 반환 + **round-trip**: 그 envelope 을 `cipher.decrypt(envelope)` (또는 `decryptGithubInstanceToken`) 로 복원하면 원 평문과 일치 (consumer 측 호환 검증). `runEncryptTokenCli` happy-path — stdin/argv 평문 → stdout 에 ciphertext, exit 0.
  - **error path** (각 1+): `LLM_APIKEY_ENC_KEY` 부재/길이 미달 시 `cipher.encrypt` 가 throw → CLI 가 비0 exit + stderr 진단 (평문 미포함). 빈 평문/공백-only 평문 → `encryptToken` fail-fast throw.
  - **branch cover**: 입력 source 분기 (stdin 제공 / stdin 없고 argv 제공 / 둘 다 없음=error) 각 1+ test. exit code 분기 (0 / 비0) 각 1+.
  - **negative cases 충분 cover**: (i) 빈 평문, (ii) 공백-only 평문, (iii) 키 env 부재, (iv) 키 길이 미달, (v) stdin·argv 둘 다 평문 부재, (vi) **평문 토큰이 stdout/stderr 출력에 등장하지 않음을 assert** (§9 secret 미노출 회귀 가드) — 각 별도 it.
- [ ] `scripts/encrypt-token.spec.ts` (위 정합 대안 중 colocated 택 시) — entrypoint 가 `runEncryptTokenCli` 를 src 본체로 위임함을 검증하는 최소 happy/error test (또는 entrypoint 를 sh 예외에 추가했으면 본 항목 생략하고 그 사유 PR 명시).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 (colocated spec unit test green).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (`src/llm/encrypt-token-cli.ts` 의 모든 분기 cover; `package.json` coverageThreshold 강제).
- [ ] **secret 안전 (§9)**: CLI 코드·spec·journal 어디에도 실 토큰/실 암호화 키 값 0. spec 의 test key 는 32-byte 더미 (base64/hex), 평문은 `"plain-token"` 류 명백한 더미. 평문 토큰이 출력/에러에 echo 되지 않음을 spec 이 명시 assert.

## Out of Scope

- **LLM provider apiKey encryption-at-rest 완결** (PLAN P4 credential-prep bullet (d)) — `prisma/schema.prisma` `apiKey` 평문 → ciphertext 전환 + write 시 encrypt + JIT decrypt 배선. **DB schema migration 동반 → [§5](../../CLAUDE.md) schema 게이트** (그 task 진입 시 human checkpoint). 본 task 와 별개.
- **credentialed live RUN** — 실 GitHub/Confluence token 을 본 CLI 로 암호화해 env 주입한 뒤 gated live spec 을 실 네트워크로 실행하는 검증은 [§5](../../CLAUDE.md) 외부 자격증명 게이트 (미승인). 본 task 는 도구 (CLI) 박제만, 실 token 0.
- **실 사용자 토큰** — 본 CLI 로 변환할 실제 GitHub/Confluence/LLM token 은 사용자가 env/secret 로 다룬다. 코드/STATE/journal 에 실값 0 (§9).
- **`LlmApiKeyCipher` 의 일반화/리네이밍** — cipher 는 평문 내용과 무관하게 envelope 을 처리하므로 그대로 재사용. cipher 파일 (`src/llm/llm-apikey-cipher.service.ts`) 미수정.
- **token 전용 master key (`GITHUB_TOKEN_ENC_KEY` 등) 신설** — 본 CLI 는 기존 `LLM_APIKEY_ENC_KEY` 를 쓰는 cipher 를 as-is 재사용 (ADR-0014/ADR-0017 §3 정합). 새 env key 도입 0.
- **package.json `scripts.encrypt-token` npm script 등록** — 선택. 필요하면 implementer 가 1 줄 추가 가능하나 필수 아님 (`scripts/encrypt-token.ts` 직접 실행으로 충분). 추가 시 commitMode 영향 없음 (이미 pr).
- **새 dependency 추가** (`pnpm add`) 금지 — Node 내장 `crypto` + 기존 `LlmApiKeyCipher` 만.

## Suggested Sub-agents

`implementer → tester` — `src/llm/encrypt-token-cli.ts` 본체 + `scripts/encrypt-token.ts` entrypoint + colocated spec 은 implementer 가, R-112 4 항목 + round-trip + §9 secret-미노출 negative + coverage·spec-presence·CI green 검증은 tester 가. ADR-0014/ADR-0017 이 envelope·env 계약을 이미 박제했고 crypto 는 `LlmApiKeyCipher` 재사용이라 새 architecture 결정 0 → architect 호출 불요. 단 entrypoint 구조 (colocated entrypoint spec vs `check-spec-presence.sh` 예외 추가) 의 작은-diff 택일은 implementer 판단.

## Follow-ups

- **이 task 이후 P4 잔여 work 는 전부 §5 게이트** — driver 는 본 task 머지 후 다음 진척 (credential-prep (d) LLM apiKey at-rest 완결 = prisma schema migration §5 / 실 token live RUN = 외부 자격증명 §5) 을 위해 **사용자 checkpoint** 가 필요하다 (autonomous dependency-free backlog 소진). planner 다음 survey 는 새 task 생성 대신 §5 escalate (humanQuestion) 가 될 가능성이 높음.
- (sub-agent 가 작업 중 발견한 관련 work 를 여기 append.)

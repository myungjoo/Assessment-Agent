---
id: T-0282
title: PLAN P4 토큰 암호화 CLI bullet doc-sync (L89)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-020, REQ-033]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-08
plannerNote: PLAN L89 (토큰 암호화 CLI) stale [ ] — scripts/encrypt-token.ts 박제 완결 (T-0206) 정합 doc-sync (T-0281 동형 Group C slice 1).
---

# T-0282 — PLAN P4 토큰 암호화 CLI bullet doc-sync (L89)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L89 (`[credential-prep / 운영 공백] 토큰 암호화 CLI`) bullet 이 아직 `[ ]` 상태이지만, main 의 실코드는 이미 박제 완결이다. PLAN L89 본문 스스로가 "`scripts/encrypt-token.ts` — stdin 평문 토큰 + `LLM_APIKEY_ENC_KEY` → base64 AES-256-GCM envelope 출력 으로 박제" 라고 명시하는데, 그 파일이 실제로 main 에 존재한다. T-0279 (L81 GitHub 3 instance) + T-0280 (L83 Confluence 통합) + T-0281 (L84 SPACE 탐색 정책) 패턴을 동형으로 Group C (L88~L90 credential-prep) 의 첫 번째 단일 bullet slice 로 정합한다. L88·L90 은 별도 후속 task — 본 task 는 L89 1 bullet 만 (한 task 1 bullet 룰).

main 실코드 박제 증거:

- **scripts/encrypt-token.ts EXISTS** — T-0206 박제. `#!/usr/bin/env ts-node` 얇은 entrypoint, `runEncryptTokenCli` 본체 (src/llm/encrypt-token-cli.ts) 에 위임, `LlmApiKeyCipher` (ADR-0014 AES-256-GCM envelope) 재사용. stdin 평문 토큰 + `LLM_APIKEY_ENC_KEY` env → base64 ciphertext envelope 출력 — PLAN L89 본문이 명시한 계약 1:1 박제. argv 경로 fallback + TTY 분기 + 평문 토큰·키 stdout/stderr echo 0 (§9 보안).
- **테스트** — `scripts/encrypt-token.spec.ts` colocated spec 박제 (T-0206 R-112 4 종 cover). test key 사용 (실 키·실 토큰 0).
- **dependency 0** — Node 내장 crypto (`LlmApiKeyCipher` 가 wrapping), 새 외부 dependency 0 (§5 미발화).
- **운영 prerequisite 충족** — PLAN L89 본문이 "사용자 GitHub/Confluence token 주입의 선행 조건" 으로 박제한 것 — milestone-3 credentialed live run (Q-0024 부분 검증, Q-0017 명시) 의 token preparation tool 이 갖춰진 상태.

T-0281 가 Group B 마지막 slice (L84) 를 `[x]` 정합한 직후라 Group C 첫 slice (L89) 가 자연 연속이다. L88 (자격증명 관리 + 권한 부족 감지·통지) 은 PermissionDeniedRecord chain 박제 + credential 관리 양쪽을 cover 하는 broad bullet 이라 차기 slice 로 분리. L90 (LLM provider apiKey encryption-at-rest 완결) 도 후속 slice.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L89 (현재 stale 1 bullet)
- [docs/tasks/T-0281-plan-p4-confluence-space-traversal-bullet-doc-sync.md](T-0281-plan-p4-confluence-space-traversal-bullet-doc-sync.md) (동형 패턴 reference — Group B 직전 slice)
- main 의 `scripts/encrypt-token.ts` 박제 확인 (존재만 확인, 본문 read 불요 — 본 task 는 reality 인용만)
- [docs/decisions/ADR-0014-llm-apikey-encryption.md](../decisions/ADR-0014-llm-apikey-encryption.md) status ACCEPTED 박제 확인 (직접 본문 read 불요)
- [docs/requirements.md](../requirements.md) REQ-020 row (자격증명 관리 의무 충족 확인, 직접 본문 read 불요)

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) L89 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 한 줄 reality 인용 추가 — 예: "**(완료)** — `scripts/encrypt-token.ts` (T-0206 박제) 가 LlmApiKeyCipher (ADR-0014 AES-256-GCM envelope) 를 재사용해 stdin 평문 토큰 + `LLM_APIKEY_ENC_KEY` env → base64 ciphertext envelope 출력 으로 박제. argv 경로 fallback + TTY 분기 + 평문 토큰·키 stdout/stderr echo 0 (§9 보안). colocated spec (encrypt-token.spec.ts) R-112 4 종 cover. 새 외부 dependency 0 (Node 내장 crypto)."
- [ ] `pnpm` 실행 불요 (doc-only, 코드 변경 0). lint/build/test 미실행.
- [ ] PLAN.md 외 다른 파일 수정 0 (task 파일 / STATE.json / journal 은 driver bookkeeping).
- [ ] direct commit (driver 가 main 에 push). PR 미생성 (commitMode direct).
- [ ] commit subject 한국어 한 줄 — 예: `docs(plan): P4 토큰 암호화 CLI bullet [x] 정합 (T-0282)`.

## Out of Scope

- L82 (GitHub Issue 평가 + self-follow-up 제외) bullet 정합 — self-follow-up 제외 정책이 main 에 **미박제** 라 단순 `[x]` flip 부적합 (T-0281 Follow-up 박제). 진짜 미구현 backlog 로 별도 처리 (Q-0027 escalate 후보).
- L88 (자격증명 관리 + 권한 부족 감지·통지) bullet 정합 — Group C slice 2 (별도 task).
- L90 (LLM provider apiKey encryption-at-rest 완결) bullet 정합 — Group C slice 3 (별도 task).
- ADR-0014 의 본문 / status / Alternatives 갱신.
- `scripts/encrypt-token.ts` 또는 본체 `src/llm/encrypt-token-cli.ts` 의 functional 변경 / 신규 spec / test.
- modules.md / api.md / requirements.md 등 다른 doc 동기 (이미 정합).

## Suggested Sub-agents

직접 driver 실행 (sub-agent 0). driver 가 PLAN.md L89 1 줄을 직접 Edit 한 뒤 direct commit·push.

## Follow-ups

- L82 (GitHub Issue 평가 + self-follow-up 제외) — self-follow-up 제외 정책 main 박제 0 grep 확인됨, 진짜 미구현 backlog. 차기 planner survey 시 (a) 박제 task 큐잉 또는 (b) Q-0027 escalate 검토.
- L88 (자격증명 관리 + 권한 부족 감지·통지) doc-sync (Group C slice 2) — PermissionDeniedRecord chain (T-0207~T-0241) + 본 task (L89 토큰 암호화) + L90 (apiKey at-rest) 박제 완결을 cover 인용.
- L90 (LLM provider apiKey encryption-at-rest 완결) doc-sync (Group C slice 3) — prisma/schema.prisma apiKey ciphertext 주석 (T-0219) + LlmHttpGatewayService JIT decrypt + LlmApiKeyCipher 박제 reality 인용.
- Group C 정합 chain (L88·L90) 완료 후 P4 closure 선언 가능성 — 차기 planner fire 에서 평가 (P5 entry 또는 Q-0027 escalate).

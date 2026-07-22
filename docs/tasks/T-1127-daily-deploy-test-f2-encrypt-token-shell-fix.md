---
id: T-1127
title: daily-deploy-test §F-2 encrypt-token 예시 수정 — LLM_APIKEY_ENC_KEY 파이프 scope 버그 + 평문 PAT argv 노출 정정 (issue #1013 C-4 nit)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-044]
estimatedDiff: 15
estimatedFiles: 1
independentStream: issue-1013-live-wiring
dependsOn: []
touchesFiles:
  - docs/ops/daily-deploy-test.md
created: 2026-07-22
plannerNote: P5/issue#1013 C-4 reviewer nit closure — §F-2 shell 예시의 env-var 파이프 scope 버그 + 평문 PAT history 노출 정정, 운영자 B-series 셋업 지원 (direct, spec-guard 없음)
---

# T-1127 — daily-deploy-test §F-2 encrypt-token 예시 수정

## Why

issue #1013 C-4(T-1126, PR #1019) reviewer 가 MINOR nit 으로 남긴 `docs/ops/daily-deploy-test.md` §F-2 shell 예시의 두 가지 결함을 정정한다. 이 문서는 오너가 곧 수행할 B-series 수동 env 셋업(github read PAT 암호화 → `GITHUB_PUBLIC_TOKEN_ENC` 주입)의 실행 가이드라, 예시가 그대로 실행되면 실패하거나 secret 을 노출한다. PLAN line 109(실 github.com myungjoo/leemgs 평가 e2e 운영 env)의 운영자 절차 정확성을 보장하는 load-bearing 수정이다.

현 §F-2 예시:

```bash
LLM_APIKEY_ENC_KEY=<32byte_base64_또는_hex_키> \
  echo <read전용_github_PAT> | pnpm ts-node scripts/encrypt-token.ts
```

두 결함:

1. **env-var 파이프 scope 버그** — `LLM_APIKEY_ENC_KEY=... echo ... | pnpm ts-node ...` 에서 env 대입 prefix 는 파이프 왼쪽의 `echo` 에만 적용된다. 정작 `LLM_APIKEY_ENC_KEY` 를 읽는 프로세스는 파이프 오른쪽의 `pnpm ts-node scripts/encrypt-token.ts` 인데 여기엔 키가 전달되지 않아, 문서대로 실행하면 암호화가 실패한다.
2. **평문 PAT argv/history 노출** — 바로 위 주석은 "평문 PAT 는 stdin 파이프로만 전달(argv·history 노출 최소화)" 라고 명시하지만, `echo <read전용_github_PAT>` 는 평문 PAT 를 커맨드라인 argv 에 그대로 올려 shell history 에 남긴다. 주석의 의도 및 CLAUDE.md §9(secret 실값 노출 금지)와 모순된다.

## Required Reading

- `docs/ops/daily-deploy-test.md` §F-2 (line 203~217 부근) — 수정 대상 shell 블록 + §9 준수 주석.
- `scripts/encrypt-token.ts` (앞부분만) — `LLM_APIKEY_ENC_KEY` 를 어느 경로(env)로 읽고 평문을 어디(stdin)로 받는지 확인해 정정 예시가 실제 스크립트 계약과 일치하도록.

## Acceptance Criteria

- [ ] §F-2 shell 예시를 정정: `LLM_APIKEY_ENC_KEY` 가 실제 암호화 프로세스(`pnpm ts-node scripts/encrypt-token.ts`)에 전달되도록 env 대입 위치를 파이프 오른쪽으로 옮긴다 (예: `... | LLM_APIKEY_ENC_KEY=<32byte_key> pnpm ts-node scripts/encrypt-token.ts`).
- [ ] 평문 PAT 를 argv/history 에 남기지 않는 입력 방식으로 교체 (예: `read -rs` 로 변수에 받아 `printf %s "$VAR" | ...` stdin 전달 후 `unset`, 또는 스크립트 계약이 요구하는 등가 방식). `echo <read전용_github_PAT>` literal 제거.
- [ ] 정정 예시가 `scripts/encrypt-token.ts` 의 실제 입력 계약(키 = env `LLM_APIKEY_ENC_KEY`, 평문 = stdin)과 일치함을 Required Reading 로 확인.
- [ ] `<...>` placeholder 규율 유지 — 실 PAT / 실 키 값은 넣지 않는다 (CLAUDE.md §9). 바로 아래 §9 준수 주석과 모순 없음.
- [ ] `docs/ops/daily-deploy-test.md` 외 다른 파일 변경 0 (spec guard 없음 — direct doc-only, 1 파일).

## Out of Scope

- `deploy/env.prod.example` 참조 블록·smoke spec 변경 (본 nit 은 daily-deploy-test.md prose 만; parity smoke spec 은 env.prod.example/seed-llm-config.sh 만 읽고 본 문서는 guard 하지 않음 — 확인됨).
- §F-1 / §F-3 등 §F-2 외 서브섹션 내용 변경.
- `scripts/encrypt-token.ts` 코드 변경 (예시 문서만 정정; 스크립트 자체는 정상).
- issue #1013 B-series(오너 수동 credential 주입) 자체.

## Suggested Sub-agents

direct doc-only task — sub-agent 불요. driver 가 직접 Edit 후 main 에 direct commit. (참고: commitMode direct 이므로 PR/reviewer/tester 경로 없음. §3.2 R-110 은 코드 0 LOC direct doc-only commit 을 면제.)

## Follow-ups

(생성 시 비어 있음)

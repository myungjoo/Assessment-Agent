---
id: T-0230
title: milestone-1 2b — azure_openai credentialed live run 검증 (실 네트워크 1회)
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-096, REQ-097]
estimatedDiff: 0
estimatedFiles: 0
created: 2026-06-04
completedAt: 2026-06-04T16:05:00+09:00
verifiedOn: loop@WIN-JQIPLSBL9QV
result: DONE(PASS) — azure_openai live smoke 가 실 endpoint 에 1회 호출해 비어있지 않은 narrative round-trip 성공(2632ms). milestone-1 (custom mocked + azure gated + azure live) 완결.
---

# T-0230 — milestone-1 2b (azure_openai credentialed live run)

## Why

Q-0021 decision(option 2)에서 승인된 milestone-1 의 마지막 단계. 2a(env-gated live test 계약
ADR-0025 + gating helper T-0227 + azure live smoke spec T-0228)가 모두 머지된 뒤, 실 credential
을 주입해 azure_openai 실 endpoint 로 **1회 live 호출**해 LlmHttpGateway → azure adapter wire
전 경로가 실제로 동작함을 검증한다. session #55 t8 의 AskUserQuestion checkpoint(Q-0022)에서
사용자가 "milestone-1 2b 실행"을 선택해 진행.

## 수행 내용 (실행 기록 — 코드 변경 0)

- credential 출처: 로컬 `C:/Users/<user>/.assessment-agent/secrets.env`(repo 밖, §9 — 실값은
  코드/STATE/journal/git 어디에도 미기재, 만료 2026-06-30). 키 이름: `AZURE_OPENAI_ENDPOINT` /
  `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_DEPLOYMENT`.
- env 매핑(secrets.env → gating 계약 LLM_LIVE_*): `LLM_LIVE_TEST=1`,
  `LLM_LIVE_PROVIDER=azure_openai`, `LLM_LIVE_BASE_URL=$AZURE_OPENAI_ENDPOINT`,
  `LLM_LIVE_API_KEY=$AZURE_OPENAI_API_KEY`, `LLM_LIVE_MODEL=$AZURE_OPENAI_DEPLOYMENT`,
  `LLM_LIVE_API_VERSION=2024-02-15-preview`.
- target(공개분, Q-0021): endpoint `https://karina-east-us-2-api.openai.azure.com`, deployment
  `gpt-5.4`. wire api-version 은 gateway 상수 `AZURE_OPENAI_DEFAULT_API_VERSION=2024-02-15-preview`.
- 실행: `test/smoke/llm-live-azure.smoke-spec.ts`(T-0228)를 그대로 실행. 단 이 PC 에 local
  Postgres 부재(DATABASE_URL 미설정 / 5432 미수신 / docker 부재)라 표준 `pnpm test:smoke` 의
  globalSetup(DB `$connect`+truncateAll)이 fail-fast → 임시 DB-less jest config(repo 밖 temp,
  globalSetup 제거, testRegex 를 azure 1개로 한정)로 동일 spec 1개만 실행. azure spec 은
  repository/cipher/difficulty 를 stub 하므로 DB 불필요 — 검증 충실성 동일. 임시 config 는 실행
  후 삭제(커밋 대상 0).
- 결과: **PASS** — `1 passed`(happy: 실 azure_openai endpoint 1회 호출, 2632ms 실 round-trip),
  narrative 비어있지 않은 string, provider=LlmProvider.AzureOpenai, modelId=deployment 일치.
  실 billed API 호출 1회 발생(사용자 승인분). API key 는 출력에서 redaction — 누출 0.

## Acceptance Criteria

- [x] secrets.env(로컬, repo 밖)를 env 로 주입해 azure gating 5종 + provider 활성
- [x] 실 azure_openai endpoint 로 live 호출 1회 성공(non-empty narrative round-trip)
- [x] provider=AzureOpenai / modelId=deployment invariant 충족
- [x] §9 준수 — 실 credential 값 코드/STATE/journal/git 미기재(redaction 확인)
- [x] milestone-1 종결 — custom mocked transport + azure gated smoke + azure live run 전부 검증

## Out of Scope / Follow-ups

- LLM_APIKEY_ENC_KEY(ADR-0014) 실 암호화 경로는 본 smoke 가 cipher 를 stub 하므로 미검증 —
  실 production write CRUD 의 at-rest 암호화는 기존 unit test 가 cover. live 경로의 실 cipher
  통합은 별도 필요 시 task.
- wire api-version 영속 컬럼화(현재 gateway 상수) — ADR-0025 Follow-up, 미착수.
- live timeout hardening(AbortController) — ADR-0015/0025 chain Follow-up, 미착수.
- gpt-5.4 가 api-version `2024-02-15-preview` 로 정상 응답함을 확인 — 추후 api-version
  영속화 시 본 검증값 참조.

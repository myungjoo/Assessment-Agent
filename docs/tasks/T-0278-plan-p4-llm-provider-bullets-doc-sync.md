---
id: T-0278
title: PLAN P4 LLM provider 3 bullet doc-sync (L85+L86+L87)
phase: P4
status: DONE
completedAt: 2026-06-08T03:05:00+09:00
contentCommit: 0e2e1cf
commitMode: direct
coversReq: [REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-096, REQ-097]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-08
plannerNote: PLAN L85~L87(LLM provider 5 추상화/3 난이도/Admin LLM 모델 지정) [ ] stale — main 박제 완결(T-0157~T-0167+T-0149~T-0152) 정합 doc-sync.
---

# T-0278 — PLAN P4 LLM provider 3 bullet doc-sync (L85+L86+L87)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L85 (LLM provider 5종 추상화), L86 (3 난이도 모델 할당), L87 (Admin 이 LLM 모델 지정) 3 bullet 이 아직 `[ ]` 상태이지만, main 의 실코드는 이미 박제 완결 상태다. 본 task 는 P3 T-0153 이 P3 stale 체크박스를 정합한 패턴과 동형으로, P4 LLM provider 관련 3 bullet 의 reality drift 만 정합한다 (다른 P4 bullet 은 별도 후속 task). 진척 신호의 정확성이 다음 phase 진입 결정 (Q-0027 escalate 시점) 의 base evidence 가 된다.

main 실코드 박제 증거:

- **L85 (5 provider 추상화)** — `src/llm/providers/` 에 openai-compatible (custom/openai), azure-openai, anthropic, google-gemini 4 adapter + `src/llm/llm-http-gateway.service.ts` 의 LlmHttpGateway 가 5 provider 전부 dispatch. T-0157 (custom/openai adapter) / T-0158 (gateway routing) / T-0160 (anthropic) / T-0162 (gemini) 머지.
- **L86 (3 난이도 모델 할당)** — ADR-0011 (difficulty-model-assignment) ACCEPTED 박제 + T-0165 PR-153 (LlmHttpGateway 난이도 routing wiring) 머지 + T-0166 (modules.md doc-sync) + T-0167 (gateway interface JSDoc 정합).
- **L87 (Admin LLM 모델 지정 UI)** — backend 측 read/write CRUD endpoint 완결: GET (T-0140~T-0142) + POST (T-0149) / PATCH (T-0151) / DELETE (T-0150) /api/llm/providers + api.md doc-sync (T-0152). **UI 자체는 P6** — 본 bullet 의 backend 책임만 P4 에서 완결, UI 잔여는 P6 frontend phase. 정합 시 본문에 "backend CRUD 완결, UI 는 P6" 명시.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L85~L87 (현재 stale 3 bullet)
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) (status ACCEPTED 확인)
- main 의 `src/llm/providers/` 디렉토리 listing (5 provider adapter 박제 검증)
- `src/llm/llm-http-gateway.service.ts` 의 LlmHttpGateway class (5 provider dispatch + 난이도 routing 검증, 직접 본문 read 불요 — 존재만 확인)
- `src/llm/llm-provider.controller.ts` (CRUD endpoint 박제 확인용, 직접 본문 read 불요)

## Acceptance Criteria

- [x] [docs/PLAN.md](../PLAN.md) L85 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 "**(완료)** — 5 provider adapter (openai-compatible/azure_openai/anthropic/google_gemini) + LlmHttpGateway dispatch 머지. T-0157 (custom/openai) / T-0158 (routing) / T-0160 (anthropic) / T-0162 (gemini)." 한 줄 인용 추가.
- [x] L86 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 "**(완료)** — ADR-0011 (3 난이도 모델 할당) ACCEPTED + T-0165 PR-153 LlmHttpGateway 난이도 routing wiring + T-0166/T-0167 doc-sync." 한 줄 인용 추가.
- [x] L87 의 `[ ]` 를 `[x]` 로flip + 본문 끝에 "**(backend 완결, UI 는 P6)** — GET /api/llm/providers (T-0140~T-0142) + POST/PATCH/DELETE (T-0149/T-0151/T-0150) + api.md (T-0152). UI 는 P6 frontend phase 잔여." 한 줄 인용 추가.
- [x] `pnpm` 실행 불요 (doc-only, 코드 변경 0). lint/build/test 미실행.
- [x] PLAN.md 외 다른 파일 수정 0.
- [x] direct commit (driver 가 main 에 push). PR 미생성 (commitMode direct).
- [x] commit subject 한국어 한 줄 — 예: `docs(plan): P4 LLM provider 3 bullet [x] 정합 (T-0278)`.

## Completion

content commit: `0e2e1cf` (docs(plan): PLAN P4 LLM provider 3 bullet doc-sync (T-0278)).
PLAN.md L85·L86·L87 stale `[ ]` → `[x]` flip 완료, 각 bullet 본문에 reality-evidence 인용 추가 (L87 backend/UI=P6 qualifier 포함). 1 파일 +3/-3. R-110 면제 (doc-only direct, 분기 없음 → tester 호출 0). reviewer/PR 0.

## Out of Scope

- L81 (GitHub 3 instance 통합) / L82 (GitHub Issue 평가) / L83 (Confluence 통합) / L84 (Confluence SPACE 탐색 정책) / L88~L90 (권한 부족 통지 / 토큰 암호화 CLI / LLM apiKey at-rest) bullet 정합 — 별도 후속 task (Group B/C) 책임. 본 task 는 L85~L87 LLM provider 관련 3 bullet 만.
- ADR-0011 의 본문 / status 갱신.
- src/ 또는 test/ 어떤 파일도 수정 0.
- modules.md / api.md / requirements.md 등 다른 doc 동기 (이미 정합).
- main 실코드의 functional 변경 / 신규 spec / test.

## Suggested Sub-agents

직접 driver 실행 (sub-agent 0). driver 가 PLAN.md L85~L87 3 줄을 직접 Edit 한 뒤 direct commit·push.

## Follow-ups

- L81~L84 GitHub/Confluence 통합 bullet 4종 doc-sync (Group B 후속 task).
- L88~L90 credential 운영 공백 bullet 3종 doc-sync (Group C 후속 task).
- P4 backlog 정합 완료 후 P4 closure 선언 가능성 — planner survey 가 다음 fire 에서 평가 (P5 entry 검토 또는 추가 §5 게이트 escalate).

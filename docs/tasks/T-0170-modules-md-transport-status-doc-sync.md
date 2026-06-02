---
id: T-0170
title: modules.md LlmModule 의 transport 상태 문장을 T-0168 round-trip smoke reality 로 정합
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-097, REQ-051]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 doc-sync — modules.md L37 LlmModule 상태 문장이 T-0168 round-trip smoke 머지 후 stale (실 fetch 미착수로 오기). doc-only direct.
---

# T-0170 — modules.md LlmModule 의 transport 상태 문장을 T-0168 round-trip smoke reality 로 정합

## Why

[modules.md](../architecture/modules.md) L37 의 LlmModule 상세 entry 마지막 문장은 milestone-1 의 transport 상태를 "현 상태는 unit-level dispatch 까지 — 실 endpoint 호출의 평가 파이프라인 연결 (실 credential · env 주입 · 실 HTTP) 은 §5 HITL 게이트로 미착수" 로 기술한다. 그러나 T-0168 (PR-155, 7c6aba5) 머지로 `LlmHttpGateway` 는 이미 **실 `globalThis.fetch` transport 로 배선**됐고, 로컬 stub HTTP 서버 round-trip smoke (`test/smoke/llm-gateway-roundtrip.smoke-spec.ts`) 가 헤더 직렬화·URL 조립·non-2xx 실수신을 end-to-end 로 검증해 transport 잔여 risk 를 closeout 했다. 즉 "unit-level dispatch 까지" 는 stale — 실제로는 "실 fetch transport 배선 + local-stub round-trip smoke closeout" 이 완료됐고, **오직 live endpoint + 실 credential 통합 (Q-0016 option A) 만 §5 deferred** 다. PLAN P4 LLM provider bullet (REQ-051/097) 의 canonical 모듈 문서가 main reality 와 어긋나 있는 doc-sync gap 을 닫는다.

## Required Reading

- `docs/architecture/modules.md` (L37 — LlmModule 상세 표 row 의 마지막 "현 상태는 …" 문장만 대상)
- `docs/tasks/T-0168-llm-gateway-stub-roundtrip-smoke.md` (round-trip smoke 의 정확한 scope — 무엇이 closeout 됐는지)
- `docs/STATE.json` 의 Q-0016 decision (option B 승인 = local stub round-trip; option A = live endpoint 여전히 deferred)

## Acceptance Criteria

- [ ] `docs/architecture/modules.md` L37 LlmModule entry 의 마지막 상태 문장을 다음 reality 로 정합 (1 문장 ~ 2 문장 수정, 표 row 형식·나머지 내용 보존):
  - 실 `globalThis.fetch` transport 가 배선됨 (mocked-fetch unit 을 넘어 실 fetch round-trip).
  - 로컬 stub HTTP 서버 round-trip smoke (`test/smoke/llm-gateway-roundtrip.smoke-spec.ts`, T-0168 / PR-155) 로 헤더 직렬화·URL 조립·non-2xx 실수신을 end-to-end closeout.
  - **잔여 = live endpoint + 실 credential (LLM_APIKEY_ENC_KEY + provider API key env 주입) 통합 만 §5 HITL 게이트로 deferred** (Q-0016 option A).
- [ ] 표 다른 컬럼 (dependencies / component / REQ / ADR) 및 다른 module row 는 변경 0.
- [ ] 문장 어조·용어가 §12 한국어 정책 및 기존 modules.md 박제 스타일과 정합.

## Out of Scope

- L174 의 짧은 "LLM Gateway | LlmModule" 한 줄 요약 entry 는 `T-0156, milestone-1 박제` 만 가리키며 정확 — 건드리지 않는다 (중복 정합 불요).
- src / test / api.md / interface JSDoc 등 코드·다른 문서 변경 금지 (이미 정합 상태로 판정됨).
- live LLM 통합 자체 (실 endpoint / credential) — §5 게이트, 본 task 범위 아님.
- PLAN.md checkbox 변경 — P4 LLM bullet 은 milestone 미완 (live 미착수) 이라 정당하게 unchecked 유지.

## Suggested Sub-agents

doc-only direct → driver 가 직접 Edit (sub-agent dispatch 불요). 필요 시 `implementer` 1 회.

## Follow-ups

(비어 있음)

---
id: T-0172
title: ADR-0015 status PROPOSED→ACCEPTED 동기화 (live-integration test 계약 구현 완료 반영)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-096, REQ-097]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 doc-sync — ADR-0015 의 live-test 계약이 T-0171(PR-156) 로 main 에 박제됐으나 status 가 PROPOSED stale. §3.1 rule 4 direct 한 줄 status 갱신. §5 미발화.
---

# T-0172 — ADR-0015 status PROPOSED→ACCEPTED 동기화

## Why

ADR-0015 (LLM live-integration TEST CONTRACT) 의 결정 — gating env 이름 (`LLM_LIVE_TEST` / `LLM_LIVE_BASE_URL` / `LLM_LIVE_API_KEY` + `LLM_APIKEY_ENC_KEY` 재사용) · skip-in-CI gating (env 부재 → `describe.skip`) · 순수 gating helper · custom live endpoint wire shape — 이 T-0171 (PR-156, squash 28e5012) 로 main 에 전부 구현·머지됐다 (순수 helper `src/llm/llm-live-test-gating.ts` + env-gated live smoke spec `test/smoke/llm-live.smoke-spec.ts`). 그러나 ADR frontmatter 의 `status` 가 아직 `PROPOSED` stale 다. 본 저장소 convention (ADR-0001~0014 는 결정이 구현·머지되면 ACCEPTED) 에 따라 status 를 ACCEPTED 로 전이한다. 이는 `direct` 한 줄 doc 수정으로, ADR-0015 의 "후속 task chain" 표가 명시한 "ADR-0015 PROPOSED→ACCEPTED (merge 후 status 한 줄 갱신, BLOCKED risk 없음)" follow-up 이다.

## Required Reading

- `docs/decisions/ADR-0015-llm-live-integration-test-contract.md` (frontmatter L1~8 + 본문 제목 L10 + Consequences "후속 task chain" 표 L96~102) — status 전이 대상 + chain 표 self-reference.
- `docs/tasks/T-0164-adr-0006-status-accepted-sync.md` (L29~30) — PROPOSED→ACCEPTED 전이의 박제 형식 precedent (frontmatter `ACCEPTED (YYYY-MM-DD)` + 제목 아래 blockquote transition note 패턴).
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` (L1~12) — `ACCEPTED (YYYY-MM-DD)` frontmatter 형식 + 전이 note 형식 mirror 원본.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0015-llm-live-integration-test-contract.md` frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED (2026-06-02)` 로 변경 (T-0164/ADR-0009 의 `ACCEPTED (YYYY-MM-DD)` 형식 mirror).
- [ ] ADR 본문 제목 (`# ADR-0015 — ...`) 바로 아래에 PROPOSED→ACCEPTED 전이 note 를 blockquote (`>`) 로 추가 — 구현 안착 증거 1~3 줄: gating 순수 helper (`src/llm/llm-live-test-gating.ts`) + env-gated live smoke spec (`test/smoke/llm-live.smoke-spec.ts`, env 부재 시 `describe.skip` → CI green) 이 T-0171 (PR-156, squash 28e5012) 로 main 에 머지됨. ADR-0014 의 `LLM_APIKEY_ENC_KEY` 재사용도 박제. 잔여 credentialed live-run 은 §5 게이트로 deferred 임을 1줄 명시.
- [ ] "후속 task chain" 표 (L97~102) 의 `ADR-0015 PROPOSED→ACCEPTED` 행을 done 으로 표기하거나 (예: scope 셀에 "(본 T-0172 에서 완료)" 주석) 그대로 두되 상충 없음 확인 — 표는 forward-looking 기록이라 한 줄 주석만으로 충분.
- [ ] 변경은 `docs/decisions/ADR-0015-...md` 단일 파일에만 한정 (다른 ADR · 코드 · spec 무변경).
- [ ] 분기 없음 — doc-only direct task 라 R-110/R-112 (test 작성·coverage) 비적용. tester 미호출 (코드 변경 0).

## Out of Scope

- ADR-0015 의 본문 결정 내용 (Decision §1~§4 · Alternatives · Consequences 본문) 재작성 — status 전이 + 전이 note 만.
- 다른 ADR (ADR-0001~0014 는 이미 ACCEPTED, T-0154 의 ADR 은 별개 cloud-fire 트랙) 의 status 검토.
- credentialed live-run task 착수 — 이는 §5 외부 자격증명 게이트 (Q-0016 option A 의 deferred 2단계) 로, 사용자 credential 주입 시점에 별도 task.
- modules.md / PLAN.md 추가 doc-sync — modules.md LlmModule 행은 이미 live deferred 상태를 정확히 박제 (genuine drift 아님).
- 새 dependency / schema migration / auth 변경 — 없음 (§5 미발화).

## Suggested Sub-agents

`implementer` 만 (doc-only direct 한 줄 status + blockquote 추가). architect 불요 (ADR 결정 본문 무변경), tester 불요 (코드 0). 실제로는 driver 가 direct mode 로 직접 수행해도 무방.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

---
id: T-0280
title: PLAN P4 Confluence 통합 bullet doc-sync (L83)
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-033, REQ-034]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-08
completedAt: 2026-06-08T07:10:00+09:00
plannerNote: PLAN L83 (Confluence 통합 — 지정 SPACE 다중 관리) stale [ ] — ConfluenceModule + ADR-0018/0019 reality 박제 완결 정합 doc-sync (T-0279 동형 Group B slice 2).
result: DONE — PLAN.md L83 `[ ]`→`[x]` flip + ConfluenceModule reality 한 줄 인용 추가 (ADR-0018 transport 계약 + ADR-0019 same-host auth restriction + per-instance `_SPACE_ALLOWLIST` env + SpaceTraversalService allowlist 순회 + token JIT decrypt + 4xx → PermissionDeniedEvent emit). 1 파일 +1/-1, direct commit (PR 없음). reviewer/PR/tester 0 호출 (commitMode=direct doc-only).
---

# T-0280 — PLAN P4 Confluence 통합 bullet doc-sync (L83)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L83 (Confluence 통합 — 지정 주소의 Confluence Service 내 **지정 SPACE 들** 다중 관리) 이 아직 `[ ]` 상태이지만, main 의 실코드는 이미 박제 완결이다. T-0279 (L81 GitHub 3 instance) 패턴을 동형으로 Group B (L81~L84 GitHub/Confluence) 의 두 번째 단일 bullet slice 로 정합한다. Group B 의 잔여 L84 (Confluence SPACE 탐색 정책) 와 Group C (L88~L90 credential) 는 별도 후속 task — 본 task 는 L83 1 bullet 만 (한 task 1 bullet 룰).

main 실코드 박제 증거:

- **ConfluenceModule** — `src/confluence/` 에 ConfluenceAdapter + ConfluenceRequestBuilder + ConfluenceSpaceTraversalService + confluence-instance-config (instance-keyed env source: `CONFLUENCE_INSTANCES` + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) + confluence-token-decrypt (ADR-0014 cipher JIT 복호화, never-read-back) + 4xx → PermissionDeniedEvent emit 박제. 지정 SPACE 다중 관리는 per-instance `_SPACE_ALLOWLIST` env 와 SpaceTraversalService 의 allowlist-순회 로 박제.
- **ADR 박제** — ADR-0018 (Confluence adapter HTTP transport 계약) + ADR-0019 (same-host auth restriction for pagination) 둘 다 ACCEPTED.
- **modules.md 박제 정합** — [docs/architecture/modules.md L14 / L69 / L127 / L159 / L193](../architecture/modules.md) 가 ConfluenceModule 을 P4 leaf adapter (PrismaService 만 주입, 다른 internal module 미import) 로 명시.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L83 (현재 stale 1 bullet)
- [docs/architecture/modules.md](../architecture/modules.md) ConfluenceModule 관련 행 (reality 박제 검증)
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) (status ACCEPTED 확인)
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) (status ACCEPTED 확인)
- main 의 `src/confluence/` 디렉토리 listing (ConfluenceAdapter / ConfluenceRequestBuilder / ConfluenceSpaceTraversalService / confluence-instance-config / confluence-token-decrypt 박제 확인, 직접 본문 read 불요 — 존재만 확인)

## Acceptance Criteria

- [x] [docs/PLAN.md](../PLAN.md) L83 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 한 줄 reality 인용 추가 — 예: "**(완료)** — ConfluenceModule 단일 ConfluenceAdapter + instance-keyed config (`CONFLUENCE_INSTANCES` + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) 박제 (ADR-0018 transport 계약 + ADR-0019 same-host auth restriction). 지정 SPACE 다중 관리는 per-instance allowlist env + ConfluenceSpaceTraversalService 의 allowlist 순회 로 박제 + token JIT decrypt (ADR-0014) + 4xx → PermissionDeniedEvent emit."
- [x] `pnpm` 실행 불요 (doc-only, 코드 변경 0). lint/build/test 미실행.
- [x] PLAN.md 외 다른 파일 수정 0 (task 파일 / STATE.json / journal 은 driver bookkeeping).
- [x] direct commit (driver 가 main 에 push). PR 미생성 (commitMode direct).
- [x] commit subject 한국어 한 줄 — 예: `docs(plan): P4 Confluence 통합 bullet [x] 정합 (T-0280)`.

## Out of Scope

- L82 (GitHub Issue 평가 + self-follow-up 제외) bullet 정합 — self-follow-up 제외 정책이 main 에 **미박제** 라 단순 `[x]` flip 부적합. 진짜 미구현 backlog 로 별도 처리.
- L84 (Confluence SPACE 탐색 정책 — Crawling vs page List/Hierarchy ADR) bullet 정합 — ADR-0013 ACCEPTED 위 별도 후속 task (Group B slice 3).
- L88~L90 (자격증명 관리 / 토큰 암호화 CLI / LLM apiKey at-rest) bullet 정합 — Group C 후속 task.
- ADR-0018 / ADR-0019 의 본문 / status 갱신.
- src/ 또는 test/ 어떤 파일도 수정 0.
- modules.md / api.md / requirements.md 등 다른 doc 동기 (이미 정합).
- main 실코드의 functional 변경 / 신규 spec / test.

## Suggested Sub-agents

직접 driver 실행 (sub-agent 0). driver 가 PLAN.md L83 1 줄을 직접 Edit 한 뒤 direct commit·push.

## Follow-ups

- L82 (GitHub Issue 평가 + self-follow-up 제외) — self-follow-up 제외 정책 main 박제 0 grep 확인됨, 진짜 미구현 backlog. 후속 planner survey 시 (a) 박제 task 큐잉 또는 (b) Q-0027 escalate 항목에 포함 검토.
- L84 (Confluence SPACE 탐색 정책 — ADR-0013 ACCEPTED) doc-sync (Group B slice 3).
- L88 (자격증명 관리 + 권한 부족 감지·통지) doc-sync (Group C slice 1).
- L89 (토큰 암호화 CLI) doc-sync (Group C slice 2).
- L90 (LLM provider apiKey encryption-at-rest 완결) doc-sync (Group C slice 3).
- Group B/C 정합 chain 완료 후 P4 closure 선언 가능성 — planner 가 차기 fire 에서 평가 (P5 entry 또는 Q-0027 escalate).

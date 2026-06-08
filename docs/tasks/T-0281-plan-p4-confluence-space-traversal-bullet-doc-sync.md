---
id: T-0281
title: PLAN P4 Confluence SPACE 탐색 정책 bullet doc-sync (L84)
phase: P4
status: DONE
completedAt: 2026-06-08T09:04:15+09:00
commitMode: direct
coversReq: [REQ-017, REQ-034]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-08
plannerNote: PLAN L84 (Confluence SPACE 탐색 정책 ADR) stale [ ] — ADR-0013 ACCEPTED + SpaceTraversalService allowlist 순회 reality 박제 정합 (T-0280 동형 Group B slice 3).
---

# T-0281 — PLAN P4 Confluence SPACE 탐색 정책 bullet doc-sync (L84)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L84 (Confluence SPACE 탐색 정책 — Crawling 또는 page List/Hierarchy 기반 탐색 중 택, ADR 로 결정) bullet 이 아직 `[ ]` 상태이지만, main 의 실코드·실 ADR 은 이미 박제 완결이다. T-0279 (L81 GitHub 3 instance) + T-0280 (L83 Confluence 통합) 패턴을 동형으로 Group B (L81~L84 GitHub/Confluence) 의 세 번째 단일 bullet slice 로 정합한다. Group C (L88~L90 credential) 는 별도 후속 task — 본 task 는 L84 1 bullet 만 (한 task 1 bullet 룰).

main 실코드·실 ADR 박제 증거:

- **ADR-0013 ACCEPTED** — [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](../decisions/ADR-0013-confluence-space-traversal-policy.md) status: ACCEPTED, date 2026-06-01. README L34 가 명시 허용한 셋 (crawling / page List / Hierarchy) 중 **page List 기반 allowlist 순회** 를 default 로 박제 — Crawling 미선택. multi-SPACE 경계 + 4xx 권한 부족 탐색-제어 (skip-and-continue) 정책도 동일 ADR 에 박제.
- **ConfluenceSpaceTraversalService** — `src/confluence/confluence-space-traversal.service.ts` (+ colocated spec) 가 ADR-0013 의 결정을 in-code 박제. per-instance `_SPACE_ALLOWLIST` env 의 allowlist 를 순회 + page List 호출 + 4xx → PermissionDeniedEvent emit + skip-and-continue 로 다음 SPACE 진행.
- **REQ-017** — [docs/requirements.md](../requirements.md) REQ-017 (Confluence SPACE crawling vs hierarchy 탐색 정책) 의 ADR 의무가 ADR-0013 ACCEPTED 로 충족됨.

T-0280 가 L83 (Confluence 통합 박제 인프라) 을 `[x]` 정합했으므로, 본 task 는 그 위에 얹은 탐색 정책 결정 박제 (L84) 를 자연 연속 박제한다 — 동일 도메인 (Confluence) 의 인프라 → 정책 결정 순.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L84 (현재 stale 1 bullet)
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](../decisions/ADR-0013-confluence-space-traversal-policy.md) (status ACCEPTED 확인)
- [docs/tasks/T-0280-plan-p4-confluence-integration-bullet-doc-sync.md](T-0280-plan-p4-confluence-integration-bullet-doc-sync.md) (동형 패턴 reference — L83 직전 slice)
- main 의 `src/confluence/confluence-space-traversal.service.ts` 박제 확인 (존재만 확인, 본문 read 불요)
- [docs/requirements.md](../requirements.md) REQ-017 row (ADR 의무 충족 확인, 직접 본문 read 불요)

## Acceptance Criteria

- [x] [docs/PLAN.md](../PLAN.md) L84 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 한 줄 reality 인용 추가 — 예: "**(완료)** — ADR-0013 ACCEPTED 가 셋 (crawling / page List / Hierarchy) 중 **page List 기반 allowlist 순회** 를 default 로 박제 (Crawling 미선택). multi-SPACE 경계 + 4xx skip-and-continue 정책 동반. ConfluenceSpaceTraversalService 가 per-instance `_SPACE_ALLOWLIST` env 의 allowlist 를 순회 + 4xx → PermissionDeniedEvent emit + 다음 SPACE 진행 으로 in-code 박제."
- [x] `pnpm` 실행 불요 (doc-only, 코드 변경 0). lint/build/test 미실행.
- [x] PLAN.md 외 다른 파일 수정 0 (task 파일 / STATE.json / journal 은 driver bookkeeping).
- [x] direct commit (driver 가 main 에 push). PR 미생성 (commitMode direct).
- [x] commit subject 한국어 한 줄 — 예: `docs(plan): P4 Confluence SPACE 탐색 정책 bullet [x] 정합 (T-0281)`.

## Out of Scope

- L82 (GitHub Issue 평가 + self-follow-up 제외) bullet 정합 — self-follow-up 제외 정책이 main 에 **미박제** 라 단순 `[x]` flip 부적합. 진짜 미구현 backlog 로 별도 처리 (Q-0027 escalate 후보).
- L88~L90 (자격증명 관리 / 토큰 암호화 CLI / LLM apiKey at-rest) bullet 정합 — Group C 후속 task.
- ADR-0013 의 본문 / status / Alternatives 갱신.
- src/ 또는 test/ 어떤 파일도 수정 0 — ConfluenceSpaceTraversalService 본문 read·grep 없이 ADR-0013 박제만 cite.
- modules.md / api.md / requirements.md 등 다른 doc 동기 (이미 정합).
- main 실코드의 functional 변경 / 신규 spec / test.

## Suggested Sub-agents

직접 driver 실행 (sub-agent 0). driver 가 PLAN.md L84 1 줄을 직접 Edit 한 뒤 direct commit·push.

## Follow-ups

- L82 (GitHub Issue 평가 + self-follow-up 제외) — self-follow-up 제외 정책 main 박제 0 grep 확인됨, 진짜 미구현 backlog. 차기 planner survey 시 (a) 박제 task 큐잉 또는 (b) Q-0027 escalate 검토.
- L88 (자격증명 관리 + 권한 부족 감지·통지) doc-sync (Group C slice 1).
- L89 (토큰 암호화 CLI) doc-sync (Group C slice 2).
- L90 (LLM provider apiKey encryption-at-rest 완결) doc-sync (Group C slice 3).
- Group B/C 정합 chain 완료 후 P4 closure 선언 가능성 — 차기 planner fire 에서 평가 (P5 entry 또는 Q-0027 escalate).

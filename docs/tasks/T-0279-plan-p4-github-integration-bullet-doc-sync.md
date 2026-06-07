---
id: T-0279
title: PLAN P4 GitHub 3 instance 통합 bullet doc-sync (L81)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-08
plannerNote: PLAN L81 (GitHub 3 instance 통합) stale [ ] — GithubModule + ADR-0016/0017 reality 박제 완결 정합 doc-sync (T-0278 동형 Group B 첫 slice).
---

# T-0279 — PLAN P4 GitHub 3 instance 통합 bullet doc-sync (L81)

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L81 (GitHub 3 instance 통합 — github.com / github.sec.samsung.net / github.ecodesamsung.com, URL·org·token 설정 분리) 이 아직 `[ ]` 상태이지만, main 의 실코드는 이미 박제 완결이다. T-0278 (L85~L87 LLM provider 3 bullet) 패턴을 동형으로 Group B (L81~L84 GitHub/Confluence) 의 첫 단일 bullet slice 로 정합한다. Group B 의 나머지 (L82·L83·L84) 와 Group C (L88~L90) 는 별도 후속 task — 본 task 는 L81 1 bullet 만 (한 task 1 bullet 룰).

main 실코드 박제 증거:

- **GithubModule** — `src/github/` 에 GithubAdapter (단일 service) + GithubInstanceClient + github-instance-config (instance-keyed env source: `GITHUB_INSTANCES` + per-key `_HOST` / `_ORG` / `_TOKEN_ENC`) + github-token-decrypt (ADR-0014 cipher JIT 복호화, never-read-back) + 4xx → PermissionDeniedEvent emit 박제. 3 host variant (github.com / github.sec.samsung.net / github.ecodesamsung.com) 가 instance sub-config 로 분리. [docs/architecture/modules.md L35](../architecture/modules.md) 의 GithubModule row 가 reality 정합 상태로 박제됨.
- **ADR 박제** — ADR-0016 (GitHub adapter HTTP transport 계약) + ADR-0017 (instance config source = env) 둘 다 ACCEPTED.
- **collection 측 결선** — buildGithubCollectionSpec mode B+A 결합 (T-0260) + 전체 buildCollectionSpec (T-0261) 가 GithubAdapter 위에서 collection backbone 으로 동작 — caller end-to-end 박제.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L81 (현재 stale 1 bullet)
- [docs/architecture/modules.md](../architecture/modules.md) L35 GithubModule row (reality 박제 검증)
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](../decisions/ADR-0016-github-adapter-http-transport-contract.md) (status ACCEPTED 확인)
- [docs/decisions/ADR-0017-github-instance-config-source.md](../decisions/ADR-0017-github-instance-config-source.md) (status ACCEPTED 확인)
- main 의 `src/github/` 디렉토리 listing (GithubAdapter / GithubInstanceClient / github-instance-config / github-token-decrypt 박제 확인, 직접 본문 read 불요 — 존재만 확인)

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) L81 의 `[ ]` 를 `[x]` 로 flip + 본문 끝에 "**(완료)** — GithubModule 단일 GithubAdapter + instance-keyed config (`GITHUB_INSTANCES` + per-key `_HOST` / `_ORG` / `_TOKEN_ENC`) 박제 (ADR-0016 transport 계약 + ADR-0017 config source). 3 host variant (github.com / github.sec.samsung.net / github.ecodesamsung.com) 분리 + token JIT decrypt (ADR-0014) + 4xx → PermissionDeniedEvent emit." 한 줄 인용 추가.
- [ ] `pnpm` 실행 불요 (doc-only, 코드 변경 0). lint/build/test 미실행.
- [ ] PLAN.md 외 다른 파일 수정 0.
- [ ] direct commit (driver 가 main 에 push). PR 미생성 (commitMode direct).
- [ ] commit subject 한국어 한 줄 — 예: `docs(plan): P4 GitHub 3 instance 통합 bullet [x] 정합 (T-0279)`.

## Out of Scope

- L82 (GitHub Issue 평가 + self-follow-up 제외) bullet 정합 — self-follow-up 제외 정책이 main 에 **미박제** 라 단순 `[x]` flip 부적합. 진짜 미구현 backlog 로 별도 처리 (planner 가 후속 fire 에서 escalate 가능성).
- L83 (Confluence 통합) / L84 (Confluence SPACE 탐색 정책) bullet 정합 — 별도 후속 task (Group B slice 2·3).
- L88~L90 (자격증명 관리 / 토큰 암호화 CLI / LLM apiKey at-rest) bullet 정합 — Group C 후속 task.
- ADR-0016 / ADR-0017 의 본문 / status 갱신.
- src/ 또는 test/ 어떤 파일도 수정 0.
- modules.md / api.md / requirements.md 등 다른 doc 동기 (이미 정합).
- main 실코드의 functional 변경 / 신규 spec / test.

## Suggested Sub-agents

직접 driver 실행 (sub-agent 0). driver 가 PLAN.md L81 1 줄을 직접 Edit 한 뒤 direct commit·push.

## Follow-ups

- L82 (GitHub Issue 평가 + self-follow-up 제외) — self-follow-up 제외 정책 main 박제 0 grep 확인됨, 진짜 미구현 backlog. 후속 planner survey 시 (a) 박제 task 큐잉 또는 (b) Q-0027 escalate 항목에 포함 검토.
- L83 (Confluence 통합) doc-sync (Group B slice 2).
- L84 (Confluence SPACE 탐색 정책) doc-sync (Group B slice 3).
- L88 (자격증명 관리 + 권한 부족 감지·통지) doc-sync (Group C slice 1).
- L89 (토큰 암호화 CLI) doc-sync (Group C slice 2).
- L90 (LLM provider apiKey encryption-at-rest 완결) doc-sync (Group C slice 3).
- Group B/C 정합 chain 완료 후 P4 closure 선언 가능성 — planner 가 차기 fire 에서 평가 (P5 entry 또는 Q-0027 escalate).

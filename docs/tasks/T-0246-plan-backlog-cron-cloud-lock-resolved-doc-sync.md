---
id: T-0246
title: PLAN backlog cron@cloud refs/locks 403 자율성 해소 bullet 완결 doc-sync
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-058]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-06-05
plannerNote: P4 운영 정책 backlog L147 reality drift — ADR-0028 + T-0242~T-0244 + cron@vm-454c 자율 lock 실증으로 6 acceptance condition 전량 완결 박제, [x] flip
---

# T-0246 — PLAN backlog cron@cloud `refs/locks/*` 403 자율성 해소 bullet 완결 doc-sync

## Why

[docs/PLAN.md](../PLAN.md) L147 운영 정책 review backlog 의 "🔴 cron@cloud `refs/locks/*` 403 자율성 해소 — 사용자 요청 우선 처리 (2026-06-05)" bullet 이 reality drift 상태다. 본 bullet 이 명시한 6 acceptance condition 이 2026-06-05 동안 전량 완결·실증됐는데도 `- [ ]` unchecked 로 남아있다:

| L147 명시 step | 머지·실증 commit |
| --- | --- |
| premise-gate 충족 박제 (403 잔존 실증) | 9 회 403 journal 박제 (2026-06-05 02:02~08:04 KST 7 fire) — journal-2026-06-05.md L7~13 |
| ADR-0015 선점 → 새 ADR-NNNN 재배정 → ADR(pr) 신설 | ADR-0028 PROPOSED (T-0242 PR-209 squash c5926fd) |
| LOOP.md §1[1]·§4 + CLAUDE.md §10 lock 프로토콜 동기 | T-0243 direct 414a6e2 |
| feature-branch cleanup 가드 (lock 브랜치 오삭제 방지) | T-0243 LOOP §4 동기에 포함 |
| ACCEPTED flip | T-0243 (ADR-0028 PROPOSED → ACCEPTED 2026-06-05) |
| 다음 cron@cloud fire 자율 lock 검증 | cron@vm-454c 8195047 (16:08 KST `claude/lock-driver` zero-sha CAS 성공, 옛 9 회 403 패턴 종결) |

T-0154 도 SUPERSEDED 처리 완료 (T-0244 22dd70f, frontmatter `supersededBy: [ADR-0028, T-0242, T-0243]`). 즉 본 backlog bullet 의 모든 outcome 이 realized — `[x]` flip + 완결 박제로 doc-sync 가 필요하다. T-0244 가 task 파일만 박제하고 PLAN backlog 동기를 동반하지 않은 catch 누락 보정.

본 bullet 은 `🔴 사용자 요청 우선 처리` flag 가 달린 P4 운영 backlog 의 최상위 항목이라 미정합 상태가 future planner survey 의 false-positive (이미 완결된 backlog 를 다시 actionable 로 오인) 를 유발할 수 있다 — make-work 회피 차원에서도 정합 필요.

cron fire 의 사용자 instruction "문서/코멘트 변경 direct commit merge" 와 정합하는 direct doc-only 1 파일 변경.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L141~148 (운영 정책 review backlog 섹션 전체)
- [docs/decisions/ADR-0028-cloud-proxy-branch-lock.md](../decisions/ADR-0028-cloud-proxy-branch-lock.md) (PROPOSED → ACCEPTED flip 확인 + Follow-up §3 운영 관찰 실증 메모)
- [docs/tasks/T-0154-cloud-proxy-branch-lock-adr.md](T-0154-cloud-proxy-branch-lock-adr.md) (frontmatter `status: SUPERSEDED` + supersededBy chain 확인)
- [docs/progress/journal-2026-06-05.md](../progress/journal-2026-06-05.md) L33~46 (T-0242/0243/0244 머지·cron@vm-454c 자율 lock 실증 시퀀스)
- [docs/PLAN.md](../PLAN.md) L145~146 (직전 완결된 L145 ADR-0020 multi-task fire / L146 길이 mitigation 의 `[x] 완결` 박제 패턴 — 본 task 가 동일 패턴으로 박제할 reference)

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) L147 의 bullet 시작 `- [ ] **🔴 cron@cloud ...` 을 `- [x] **cron@cloud refs/locks/* 403 자율성 해소 — 완결(2026-06-05)** ...` 로 flip. 🔴 우선처리 flag 는 제거 (완결됐으므로 더 이상 우선처리 아님).
- [ ] 본문에 완결 박제 1 줄 추가 — "**해소 결과**: ADR-0028 (T-0242 PR-209 c5926fd PROPOSED → T-0243 414a6e2 ACCEPTED, 2026-06-05) 가 lock 저장소를 `refs/locks/driver` (blob) → `refs/heads/claude/lock-driver` (commit ref) 로 이전. 첫 cron@cloud 자율 lock CAS 성공 = cron@vm-454c 8195047 (16:08 KST, `claude/lock-driver` zero-sha 생성 → tip 0472be7, credential 0, 옛 9 회 403 패턴 종결). T-0154 SUPERSEDED (T-0244 22dd70f, `supersededBy: [ADR-0028, T-0242, T-0243]`). ADR-0028 Follow-up §3 운영 관찰 검증 완료." — 직전 완결된 L145/L146 박제 패턴과 동형 어조.
- [ ] L147 본문의 historical context (proxy 제한층 / 403 잔존 실증 / T-0154 refresh 계획 / 대안 기각) 는 그대로 보존 (이력 가치). 추가 박제는 본문 끝에 append.
- [ ] T-0154 reference 는 SUPERSEDED 박제로 갱신 — "기존 해법 = T-0154" → "기존 해법 (현 SUPERSEDED) = T-0154" 같은 짧은 정합 추가 (또는 등가 표현).
- [ ] 분기 없음 — direct doc-only 1 파일 (`docs/PLAN.md`) 의 L147 bullet 1 개 inline 수정. R-112 negative cases·coverage 항목 생략 (코드 변경 0, 분기 0).
- [ ] commit message subject 한국어, type=`docs`, scope=`plan`, T-0246 박제. body 에 본 박제 요지 + ADR-0028 / T-0242 / T-0243 / T-0244 / cron@vm-454c 8195047 / 0472be7 사실 시퀀스 1 줄 + agent-trail blob.
- [ ] `pnpm lint` / `pnpm build` / `pnpm test` 실행 불요 (R-110 direct-mode doc-only 면제 — CLAUDE.md §3.2 R-110 적용). 단 PLAN.md 의 markdown 구조 (bullet indent / link 형식) 가 깨지지 않았는지 시각 확인 1 회.

## Out of Scope

- L148 "PLAN.md 단계별 분리 검토" bullet 은 트리거 미달 상태 그대로 (현 PLAN.md LOC 합계 < 350 — 본 task 가 변경하지 않음). 본 task 가 변경할 대상 아님.
- ADR-0028 자체 본문 추가 갱신 (Follow-up §3 운영 관찰 메모는 이미 cron@vm-454c fire 가 박제 완료 — 본 task 는 PLAN backlog 측만 동기).
- T-0154 task 파일 추가 갱신 (T-0244 가 SUPERSEDED bookkeeping 완료 — 본 task 는 PLAN backlog 측만).
- cron@vm-454c fire 의 ADR-0028 §3 첫 실증 자체에 대한 별도 박제 task (cron 자체가 journal-2026-06-05 L44 박제 완료).
- 본 bullet flip 외의 PLAN.md 다른 라인 수정 (P0~P8 phase 체크박스 / 의존성 / use case 박스 등) — 본 task 가 reality 정합 확인 안 한 영역이므로 변경 금지.
- 새 ADR 신설 / Confluence·Enterprise (sec/ecode) host live 검증 (token 미제공) / Stryker / retention TTL — 본 task 의 무관 영역.

## Suggested Sub-agents

직접 driver 가 처리 (direct doc-only 1 파일, executor sub-agent dispatch 불요 — task 본문 자체가 self-contained). 또는 executor → implementer 1 회 (architect / tester 미호출).

## Follow-ups

(빈칸 — implementer 가 발견 시 append)

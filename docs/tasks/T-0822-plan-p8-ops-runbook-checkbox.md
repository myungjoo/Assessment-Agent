---
id: T-0822
title: PLAN.md P8 운영 문서 bullet(147) implemented-on-main checkbox 정합
phase: P8
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-sync
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P8 line147 운영 문서 bullet — T-0821 runbook.md shipped-on-main 반영 checkbox 정합 (drift 패턴 mirror, direct doc-only)
---

# T-0822 — PLAN.md P8 운영 문서 bullet(147) implemented-on-main checkbox 정합

## Why

[PLAN.md](../PLAN.md) Phase P8 line147 `운영 문서 (배포·복구·trouble-shoot)` bullet 은 아직 `[ ]` 이나, 직전 T-0821 이 실제 산출물 [docs/ops/runbook.md](../ops/runbook.md) (배포·복구·trouble-shoot·운영 전제 4 섹션) 를 origin/main 에 신설·머지 완료했다. 즉 deliverable 은 shipped 인데 PLAN checkbox 만 stale — T-0809~0821 이 반복 교정해 온 PLAN↔shipped drift 와 동일 패턴이다. 본 task 는 bullet147 을 `[x]` 로 flip 하고 implemented-on-main 근거 절을 append 해, 미래 planner 가 이미 완료된 운영 문서 작성을 재큐잉하는 make-work 를 차단한다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) line 143~148 (Phase P8 4 bullet)
- origin/main 의 [docs/ops/runbook.md](../ops/runbook.md) — 실제 산출물 (섹션 구조: 1 배포 / 2 복구 / 3 trouble-shoot / 4 운영 전제)
- 직전 완료 근거: [journal-2026-07-08.md](../progress/journal-2026-07-08.md) line 22 (T-0821 DONE)

## Acceptance Criteria

- [ ] `docs/PLAN.md` line147 `- [ ] 운영 문서 (배포·복구·trouble-shoot)` → `- [x]` 로 flip.
- [ ] 같은 bullet 에 implemented-on-main 근거 절 append — `docs/ops/runbook.md` 가 배포(§1)·복구(§2)·trouble-shoot(§3)·운영 전제(§4) 를 cover 함을 명시, T-0821 참조. `git ls-tree origin/main docs/ops/runbook.md` 로 실존 재확인 후 서술 (false-positive flip 금지).
- [ ] append-only — 인접 bullet(145 E2E / 146 보안 점검 / 148 부하·내성) 의 `[ ]` 상태 및 텍스트 무손상. line147 국한 수정.
- [ ] `docs/PLAN.md` 외 파일 변경 0. diff ≤ 3 LOC 1 파일.

## Out of Scope

- runbook.md 내용 수정·보강 (별도 task).
- P8 나머지 3 bullet (E2E / 보안 점검 / 부하·내성) 의 checkbox 변경 — 각각 실제 산출물 shipped 검증 후 별도 task.
- STATE.phase 필드 변경 (P8 은 미완, phase 전이 아님).
- 코드·test·CI 변경 (본 task 는 doc-only direct).

## Suggested Sub-agents

없음 — direct doc-only PLAN sync. driver 가 직접 처리 (executor 경유 불요, tiny doc task).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)

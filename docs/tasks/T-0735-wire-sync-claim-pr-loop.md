---
id: T-0735
title: sync-claim-pr.sh 를 driver loop PR-open 단계에 wiring (dup-PR 근본 fix 완결)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-06-28
plannerNote: P5 동시성 — T-0732 신설 sync-claim-pr.sh 가 미배선(primitive only). LOOP.md [4]·concurrency.md §5 에 PR-open 직후 claim prNumber 동기 절차 박제로 T-0730 dup-PR 근본 fix 완결.
independentStream: concurrency-claim-pr-sync-wiring
dependsOn: []
touchesFiles: [docs/LOOP.md, docs/architecture/concurrency.md]
---

# T-0735 — sync-claim-pr.sh 를 driver loop PR-open 단계에 wiring (dup-PR 근본 fix 완결)

## Why

T-0730 dup-PR 사고(PR #645 vs #646)의 근본 원인은 driver 가 PR 을 open 한 뒤 자기 claim entry 의 `prNumber` 를 동기하지 않아, 그 driver 가 머지 전 사망하면 reclaim-stale-claim.sh 가 `prNumber == null → 단순 제거(bare-prune)` 분기로 진입해 PR-resume 신호를 잃고 다음 driver 가 중복 PR 을 여는 것이다. T-0732 가 그 빠진 단계를 채우는 primitive `scripts/sync-claim-pr.sh` 를 신설했으나, 그 script 헤더(L14~16)가 명시하듯 **"driver/integrator 가 본 script 를 언제 호출하는지의 wiring 은 별도 direct doc task(follow-up) 책임"** 으로 남겨졌다. 본 task 가 그 wiring 을 LOOP.md / concurrency.md 절차 텍스트에 박제해 dup-PR 근본 fix 를 완결한다. (PLAN §10 동시성 안정화 / ADR-0036 §Decision 8 (a) fail-safe backbone.)

## Required Reading

- `docs/LOOP.md` — §1 [4] COMMIT MODE 분기, 특히 `DONE이고 task.commitMode == "pr"` 블록(현재 L194~212). PR open → integrator 호출 직후 지점이 wiring 대상.
- `docs/LOOP.md` — §1 [2] 의 reclaim/RESUME 분기(L130~141) 와 PR Resume 판정(a~f, L142~159) — prNumber 동기가 왜 RESUME 분기를 살리는지 맥락.
- `scripts/sync-claim-pr.sh` — 계약(L24~34): `$1=task id, $2=pr number(정수), $3=owner session id`, exit 0 = 성공/idempotent no-op, env `SYNC_REMOTE`/`SYNC_REF`/`SYNC_RETRIES`. lock-하 critical section 에서 호출해야 하는 CAS mutation 임에 주의.
- `docs/architecture/concurrency.md` — §5 staleness 회수 / PR-resume(L95~127) — reclaim 의 prNumber 분기 설명. 본 wiring 을 §5 에 한 단락 추가해 "PR open 직후 prNumber 동기" 가 (b) RESUME 분기의 전제임을 외화.
- `.claude/agents/integrator.md` — L22, L130 PR open 절차(누가 PR number 를 보유하는지) — wiring 절차 텍스트에서 driver/integrator 책임 경계 정합 확인용(편집 대상 아님).

## Acceptance Criteria

- [ ] `docs/LOOP.md` §1 [4] 의 `task.commitMode == "pr"` 블록에 **PR open(integrator 가 PR number 확보) 직후, lock(critical section) 보유 상태에서** `scripts/sync-claim-pr.sh <T-NNNN> <pr-number> <self-session>` 를 호출해 claim entry 의 `prNumber`(null→정수) + `status`(→PR_OPEN) 를 원자 동기하는 절차 step 1개를 박제. fineGrainedConcurrency 토글 ON 일 때만 적용(claim registry 가 그때만 존재 — 토글 OFF/coarse mutex 에서는 claim 없음)임을 명시.
- [ ] 위 절차에 **호출 실패 처리** 명시: sync-claim-pr 가 non-zero(대상 부재/owner 불일치/CAS 소진) 면 fail-safe — driver 는 BLOCKED 가 아니라 다음 turn 의 reclaim 이 GitHub branch 점검으로 흡수하도록 경고만 journal 박제(또는 §D8 (a) 모르면-직렬화 정합 처리). dup-PR risk 가 1 회 sync 실패로 즉시 재현되지 않도록(idempotent 재호출 가능) 명시.
- [ ] LOOP.md §1 [2] PR Resume 판정 또는 ANOTHER_ROUND 경로에서 **이미 prNumber 가 동기된 claim 은 재동기 idempotent no-op** 임을 한 줄 참조(sync-claim-pr.sh exit 0 idempotent 계약 — 중복 호출 안전).
- [ ] `docs/architecture/concurrency.md` §5 에 "PR open 직후 prNumber 동기(sync-claim-pr.sh)" 단락 1개 추가 — reclaim 의 (b) `prNumber != null → RESUME` 분기가 정상 작동하려면 이 동기 단계가 선행돼야 함을 명시하고, T-0730 dup-PR 사고를 근본 원인 사례로 1 줄 인용. scripts/sync-claim-pr.sh 링크 박제.
- [ ] 두 문서의 §12 언어 정책 준수(절차 텍스트 한국어, 식별자/경로/enum 영어). 새 dependency·schema·credential·코드 변경 0(doc-only direct).
- [ ] 분기 없음 — doc-only 절차 박제라 R-112 unit test 항목 비적용(코드 변경 0). reviewer 는 절차 정합·기존 [4]/[2] 단계와의 충돌 0·sync-claim-pr.sh 계약(인자 3개, exit 의미) 정확 인용만 점검.

## Out of Scope

- `scripts/sync-claim-pr.sh` 자체 수정(T-0732 에서 완결 — 본 task 는 호출 wiring 만).
- reclaim-stale-claim.sh 에 GitHub API cross-check(option b) 추가 — 별도 후속 task(option a wiring 이 우선이며 더 단순·credential 0). 본 task 의 Follow-ups 에 기록.
- integrator.md 편집(PR open 절차는 LOOP.md 가 권위 — wiring 절차는 LOOP.md 에 박제, integrator.md 는 참조만).
- 실제 driver 코드/스크립트 추가(LOOP 은 텍스트 계약 — 절차만 박제, 새 자동화 스크립트 0).
- toggle ON 여부 변경(현 stage 5b 유지 — 본 wiring 은 토글 ON 시 활성, OFF 시 inert).

## Suggested Sub-agents

`implementer`(doc-only direct 이므로 executor 가 직접 편집 가능 — architect 불요. commitMode direct 라 reviewer 게이트 없음, driver self-check).

## Follow-ups

(생성 시 비어있음.)

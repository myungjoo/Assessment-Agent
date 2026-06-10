---
id: T-0314
title: ADR-0034 lock-bypass 봉쇄 규율을 LOOP.md + CLAUDE.md §10 에 흡수
phase: P5
status: DONE
completedAt: 2026-06-10T10:42:00+09:00
mergedAs: c056f8e
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-06-10
plannerNote: Q-0031 followUp(B) — ADR-0034 lock-CAS 의무 규율을 운영 doc 에 흡수(direct), 흡수 後 #249 close 는 후속 follow-up. dependency-free·human-approved.
---

# T-0314 — ADR-0034 lock-bypass 봉쇄 규율을 LOOP.md + CLAUDE.md §10 에 흡수

## Why

Q-0031 (RESOLVED, 2026-06-10) 사용자 결정의 followUp 2 를 이행한다 — 별건 disposition "orphan PR #249 = (B) 규율 흡수 後 close". orphan PR #249 (branch `claude/loop-turn-cap-5-a9786f`) 가 담은 ADR-0034 ("cloud 진입점의 권위 lock CAS 의무화") 는 origin/main 의 비조상으로 diverged·mixed-mode(STALE STATE/CLAUDE/LOOP 동봉)·CI-red 라 그대로 머지하면 STATE 회귀 위험이 있다. 따라서 ADR-0034 의 **핵심 운영 규율만** 권위 운영 doc (LOOP.md 진입점 lock 절차 + CLAUDE.md §10 동시 실행 정책) 에 직접 흡수하고, 그 흡수 commit 머지 후 별도 follow-up 이 #249 를 close 한다 (흡수 後 close 순서 — ADR-0036 §Decision1 권고). 이는 ADR-0035 chain 종결 후 dependency-free·fully-approved 한 정리 작업이며, ADR-0037 의 PROPOSE 결정(double-write 경계·idempotency) 의 사용자 검토를 선점하지 않는다.

## 흡수할 ADR-0034 핵심 규율 (orphan 브랜치 `docs/decisions/ADR-0034-cloud-entrypoint-mandatory-lock-cas.md` 의 §Decision (1)~(4))

1. **lock CAS 는 모든 진입점의 무조건 선행 의무** — cron · 로컬 `/loop` · cloud `/loop` · headless 어느 진입점이든 executor 호출/commit/PR 생성 전에 권위 `refs/heads/claude/lock-driver` CAS 획득을 반드시 시도. "mirror 만 쓰고 진행" 경로 금지.
2. **`gh 부재` · `main push 불가` 는 lock-skip 근거가 아니다** — lock CAS 는 raw `git push … --force-with-lease` 로 수행하므로 `gh` 비의존. lock 저장소는 `claude/lock-driver`(허용 prefix)이며 main 이 아님 → main push 차단과 무관. 두 제약은 pr-mode stand-down 판정에는 영향을 주나 lock 획득 자체는 면제 안 함.
3. **lock 미획득(경쟁 패배) 시 = stand-down(no-op 종료), 격리 병렬 작업 금지** — "lock 못 잡았지만 feature branch + draft PR 로 격리 진행" 패턴 금지 (이것이 #246/#247 중복-PR 사고의 직접 메커니즘).
4. **`git push` 권한 자체가 없는 극단 환경** — lock CAS 불가 → 무조건 stand-down. credential/proxy 한계는 BLOCKED 가 아니라 no-op 종료로 흡수.

## Required Reading

- `docs/STATE.json` 의 Q-0031 항목 (`decision` + `followUps[1]`) — 본 task 의 근거.
- `docs/LOOP.md` §1 [1] (line ~17-35, STATE & LOCK branch-lock CAS 절차) — 진입점 lock 의무 흡수 지점.
- `docs/LOOP.md` §4 (line ~344-416, lock CAS / push hard rule / 동시 실행) — cloud 진입점 stand-down 규율 흡수 지점.
- `CLAUDE.md` §10 "동시 실행 정책 (race 회피)" — 동일 규율 한 줄 동기 지점.
- ADR-0034 원문 (orphan 브랜치): `git show origin/claude/loop-turn-cap-5-a9786f:docs/decisions/ADR-0034-cloud-entrypoint-mandatory-lock-cas.md` — 흡수 원문.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision1 (line ~55-57) — "ADR-0034 complementary·subsume 안 됨, 규율 흡수 후 #249 close" 권고 정합 확인.

## Acceptance Criteria

- [ ] `docs/LOOP.md` §1 [1] 에 "**모든 진입점(cron · 로컬/cloud `/loop` · headless) 은 작업 시작 전 권위 `claude/lock-driver` CAS 획득을 반드시 시도** — mirror-only 진행 금지" 규율 명문화. 기존 §1[1] fetch 의무 서술과 자연스럽게 연결.
- [ ] `docs/LOOP.md` §1 [1] 또는 §4 에 "**`gh 부재` · `main 직접 push 불가` 는 lock-skip 근거가 아니다** (lock 은 raw git push, `claude/*` prefix, main 아님)" 명시.
- [ ] `docs/LOOP.md` §4 에 "**lock 미획득(경쟁 패배 또는 push 권한 부재) 시 = stand-down(no-op 종료) — feature branch + draft PR 격리 병렬 작업 금지** (#246/#247 중복-PR 사고 직접 메커니즘)" 규율 추가. ADR-0034 (또는 흡수 사실) 참조 1줄.
- [ ] `CLAUDE.md` §10 "동시 실행 정책" 에 동일 규율 한 줄 동기 (예: 규칙 1 "활성 driver 는 항상 1개" 근처에 "모든 진입점 lock CAS 무조건 선행 — gh부재/main-push-불가는 skip 근거 아님, 미획득 시 stand-down" 추가).
- [ ] 흡수 본문에 ADR-0034 의 출처/사고(#246/#247) 추적성 1줄 박제 (grep 가능하도록 "ADR-0034" 토큰 포함).
- [ ] 변경은 LOOP.md + CLAUDE.md 두 파일에 한정 (≤ 5 파일 cap 충족). 새 `docs/decisions/ADR-0034-*.md` 파일을 main 에 생성하지 않는다 (orphan #249 의 mixed-mode 회귀 회피 — 규율은 운영 doc 에 인라인 흡수).
- [ ] §12 언어 정책 준수 — 흡수 본문 한국어, 식별자/경로/lock ref 토큰 영어.

## Out of Scope

- **PR #249 close / 브랜치 `claude/loop-turn-cap-5-a9786f` 삭제 금지** — 흡수 後 close 순서 준수. 본 흡수 commit 머지 후 별도 follow-up task 가 #249 를 close 한다. 본 task 에서는 close 하지 않는다.
- 새 `docs/decisions/ADR-0034-*.md` 파일 main 생성 — orphan #249 mixed-mode 회귀 위험. 규율은 운영 doc 에 인라인 흡수만.
- ADR-0036 (fine-grained concurrency) status flip 또는 채택 — staged human decision, 본 task 무관.
- ADR-0037 (period→collection→evaluate bridge) impl slice — Q-0031 followUp 1, ADR-0037 §Decision2/3 PROPOSE 의 사용자 ADR 검토 후 별도 진입.
- 코드(`src/`) 변경 — 본 task 는 운영 doc-only direct.

## Suggested Sub-agents

direct-mode doc-only — sub-agent 불요. driver 가 직접 LOOP.md + CLAUDE.md 인라인 편집 후 main 에 direct commit. (executor dispatch 없이 driver inline edit 가능 — §3.1 direct.)

## Follow-ups

- (후속 task) orphan PR #249 close + 브랜치 `claude/loop-turn-cap-5-a9786f` 삭제 — 본 흡수 commit 머지 후 진입 (흡수 後 close 순서). commitMode direct (gh pr close, 코드 변경 0).
- (Q-0031 followUp 1) ADR-0037 PROPOSE 결정(double-write 경계·idempotency) 사용자 ADR 검토 완료 후 bridge impl slice(DTO/orchestration service/controller/RBAC guard/e2e) 분해 — planner 별도 진입.

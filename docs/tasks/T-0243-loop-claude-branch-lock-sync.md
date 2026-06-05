---
id: T-0243
title: LOOP.md §1[1]·§4 + CLAUDE.md §10 의 lock 프로토콜을 claude/lock-driver 브랜치 lock 으로 동기 (ADR-0028 ACCEPTED gate)
phase: P4
status: DONE
commitMode: direct
completedAt: 2026-06-05T11:06:11+09:00
coversReq: [TBD]
estimatedDiff: 130
estimatedFiles: 4
created: 2026-06-05
plannerNote: "P4 운영 infra. ADR-0028 ACCEPTED gate task 1/2 — refs/locks/driver(blob)→claude/lock-driver(commit ref) 프로토콜 동기. doc-only inline-amend ×0.64. cutover 안전: 다음 fresh session/fire 부터 효력(in-flight session #60 무중단)."
---

# T-0243 — LOOP.md §1[1]·§4 + CLAUDE.md §10 의 lock 프로토콜을 `claude/lock-driver` 브랜치 lock 으로 동기

## Why

[ADR-0028](../decisions/ADR-0028-cloud-proxy-branch-lock.md) (PROPOSED, 2026-06-05) 는 driver lock 저장소를 전용 blob ref `refs/locks/driver` 에서 `claude/*` namespace 의 일반 브랜치 `refs/heads/claude/lock-driver` 로 이전하기로 결정했다 — cloud proxy 가 `refs/locks/*` push 를 HTTP 403 으로 거부해 cron@cloud 가 lock 을 자율 획득하지 못하던 잔존 제약을 credential 0 으로 근본 해소하기 위함이다. ADR-0028 의 ACCEPTED 전이 gate 는 **두 direct-mode 동기 task** 다 (ADR Follow-up §1·§2): 본 task 가 그 첫 번째 — `docs/LOOP.md` §1[1]·§4 의 ref-CAS 획득/해제/fetch 명령과 `CLAUDE.md` §10 의 strong-mutex 설명을 `claude/lock-driver` 브랜치 lock 프로토콜로 반영한다. CAS 원자성·강한 mutex·60분 stale 탈취·read 전 fetch 의무 불변 결정은 ADR-0009 그대로 보존하며 **저장 위치 표기만** 갱신한다.

## ⚠️ Cutover 안전 — 가장 중요한 제약 (in-flight session 무중단)

본 task 가 실행될 시점에 **로컬 `/loop` session #60 이 `refs/locks/driver` blob ref lock 을 보유한 채 매 turn heartbeat 중**이다 (STATE.lock.holder=loop, session=loop@WIN-JQIPLSBL9QV-s60). 동기된 문서가 새 `claude/lock-driver` 프로토콜을 **즉시(mid-session) 효력 발생**시키면, 진행 중인 driver 가 자기 lock 을 잃거나 split-brain 에 빠진다 (한 path 는 옛 blob ref 를, 다른 path 는 새 브랜치를 보는 상태 = ADR-0028 Decision (5) 가 금지한 "두 ref 병행" 상호배제 무효). 따라서 동기 문서는 반드시 **clean cutover** 를 명시해야 한다:

1. **효력 시점 = 다음 fresh session / 다음 fresh cron fire 부터** — 새 프로토콜은 현재 진행 중인 어떤 session 의 mid-turn 에 적용되지 않는다. 각 진입점(cron / 여러 기기 `/loop`)이 다음에 **새 conversation 으로 깨어날 때** §1[1] 의 갱신된 명령을 읽고 `claude/lock-driver` 를 본다.
2. **옛 `refs/locks/driver` 와 새 `claude/lock-driver` 병행 운영 금지** (ADR-0028 Decision (5)) — 모든 진입점이 한 번에 새 ref 로 cutover 한다. 문서가 두 ref 를 동시에 "권위" 로 기술하면 안 된다. 갱신 후 문서는 **`claude/lock-driver` 단일 권위** 만 기술한다.
3. **무중단이 성립하는 이유** — in-flight session #60 은 자신이 종료될 때까지 옛 blob ref 로 동작하다 정상 해제(tombstone) 후 종료한다. 그 다음 어떤 fresh 진입점도 새 문서를 읽고 `claude/lock-driver` 를 보므로, **wall-clock 상 어느 순간에도 활성 driver 는 1개** 이고 그 1개는 일관된 단일 프로토콜을 쓴다 (session #60 종료 전엔 옛 ref, 종료 후엔 새 브랜치). 두 프로토콜이 동시에 같은 critical section 을 경쟁하는 window 가 없다 — 활성 driver 가 항상 1개이기 때문(CLAUDE.md §10 "활성 driver 는 항상 1개").
4. **migration 메모 박제** — 갱신 문서 안에 위 1~3 의 cutover 규약을 짧게 (3~5줄) 명시해, 다음에 깨어나는 driver 가 "왜 옛 `refs/locks/driver` 가 한동안 상존했는지 / 새 브랜치를 봐야 하는지" 를 알게 한다. (옛 blob ref 는 session #60 해제 후 60분 지나면 stale 로 방치되며, 누구도 더 읽지 않으므로 별도 정리 불요.)

## Required Reading

- `docs/decisions/ADR-0028-cloud-proxy-branch-lock.md` — 특히 Decision (1)~(6) (저장소 이전 / CAS 불변 / blob→commit 기계적 차이 / fetch·획득·해제 명령 형태 / 60분 stale / cross-path 정합 / STATE mirror) 와 Decision (5) cutover + Consequences 의 "claude/lock-driver 오삭제 가드" 비용.
- `docs/LOOP.md` §1 [1] STATE & LOCK (현재 17~37행) — 갱신 대상 1.
- `docs/LOOP.md` §4 "Lock & 충돌 규약" 의 "Lock 형태" / "획득 / 해제 (ref-CAS)" / "worktree 정책" (현재 339~413행) — 갱신 대상 2.
- `CLAUDE.md` §10 "동시 실행 정책" + "Branch protection 정책" 사이의 strong-mutex 설명 단락 — 갱신 대상 3.
- `docs/tasks/T-0154-cloud-proxy-branch-lock-adr.md` frontmatter — (참고만; 본 task 에서 수정하지 않음. SUPERSEDED 처리는 deferred follow-up).

## Acceptance Criteria

- [ ] `docs/LOOP.md` §1 [1] 의 lock 명령을 `claude/lock-driver` 브랜치 lock 으로 갱신:
  - fetch 명령을 `git fetch origin main +refs/heads/claude/lock-driver:refs/remotes/origin/claude/lock-driver` 형태로 (ADR-0028 Decision (3) fetch 규약). 브랜치 미존재 시 free 간주 명시.
  - 획득을 `lock.json` 담은 commit + `git push origin <new-commit>:refs/heads/claude/lock-driver --force-with-lease=refs/heads/claude/lock-driver:<observed-old-sha>` (브랜치 미존재 시 `0{40}` zero-sha CAS) 로 (Decision (2)·(3)).
  - 해제를 tombstone empty commit(`{"holder":null}` 또는 빈 tree) CAS push 로 — **브랜치 delete 금지** (Decision (3): cloud proxy 가 브랜치 delete 막을 여지).
  - 60분 stale 탈취·session 기반 loopSessionTurnCount 처리·read 전 fetch 의무는 **불변 유지**(ADR-0009 결정), 표기 ref 만 변경.
- [ ] `docs/LOOP.md` §4 "Lock & 충돌 규약" 의 "Lock 형태" / "획득 / 해제 (ref-CAS)" / "worktree 정책" 단락에서 `refs/locks/driver` blob ref 표기를 `refs/heads/claude/lock-driver` commit ref(tip 의 `lock.json`) 로 갱신. `git ls-remote origin refs/heads/claude/lock-driver` 후 tip `lock.json` 직독 방식 명시 (Decision (6)). STATE.json.lock 은 비권위 mirror 그대로.
- [ ] `docs/LOOP.md` §4 worktree 정책에 **feature-branch 정리 스크립트가 `claude/lock-driver` 를 오삭제하지 않도록 이름 패턴 exclude 가드** 한 줄 명시 (ADR-0028 Consequences "오삭제 가드 필요").
- [ ] `CLAUDE.md` §10 "동시 실행 정책" 의 strong-mutex 설명을 `claude/lock-driver` 브랜치 lock 기반으로 동기 — "전용 ref `refs/locks/driver` 의 force-with-lease CAS" → "`refs/heads/claude/lock-driver` 브랜치(commit ref)의 force-with-lease CAS". CAS·강한 mutex·multi-machine 안전 invariant 는 불변, 저장 위치만 갱신. ADR-0009 → ADR-0028 참조 갱신.
- [ ] 위 3개 문서 어디에도 **옛 `refs/locks/driver` 와 새 브랜치를 동시에 권위로 기술하는 표현이 남지 않음** (병행 금지 — Decision (5)). 갱신 후 단일 권위 = `claude/lock-driver`.
- [ ] ⚠️ Cutover 섹션의 무중단 규약(효력 = 다음 fresh session/fire / mid-session 미적용 / 단일-활성-driver 로 split-brain 없음)을 갱신 문서 안에 3~5줄 migration 메모로 박제.
- [ ] ADR-0028 status 전이: 본 task 가 gate 2건 중 1번째이므로 **단독으로는 ACCEPTED 전이 불가**. ADR-0028 의 status 줄은 **PROPOSED 유지** — Follow-up §2(CLAUDE.md §10 동기)가 본 task 안에 합쳐졌다면(파일 4개·≤300 LOC 안에서 LOOP + CLAUDE 둘 다 갱신 완료) ADR-0028 Follow-up 의 두 doc-sync 가 모두 충족되므로 status 줄을 `PROPOSED` → `ACCEPTED (2026-06-05)` 로 flip 하고 supersede pointer 정합. **단 운영 검증(첫 cron@cloud 자율 획득, Follow-up §3)은 별도라 status 메모에 "doc-sync 완료, 첫 cron@cloud 자율 획득 검증은 운영 관찰 대기" 1줄 부기.** (LOOP + CLAUDE 를 한 task 로 합치는 것이 cap 안에서 가능 — 둘 다 inline-amend 라 작음. 만약 cap 초과로 분리 필요하면 CLAUDE.md §10 동기를 follow-up task 로 분리하고 ADR status 는 PROPOSED 유지.)
- [ ] 본 task 는 doc-only direct commit (코드 0 LOC) 이므로 R-112 test 항목 미적용 — 분기 없음, test 생략. lint/build/test 불요 (문서만 변경).

## Out of Scope

- **실제 lock 메커니즘 코드 변경 없음** — 본 task 는 LOOP.md / CLAUDE.md 의 운영 규칙 문서 동기뿐. driver 의 lock 획득/해제는 prompt 박제(문서)가 곧 구현이므로 별도 src/ 변경 0.
- **T-0154 SUPERSEDED bookkeeping** — deferred (아래 Follow-ups). 본 task 에서 T-0154 frontmatter 를 건드리지 않는다.
- **첫 cron@cloud 자율 lock 획득 운영 검증** (ADR-0028 Follow-up §3) — 운영 관찰 단계라 본 doc-sync task 범위 밖. 검증 후 별도 journal 박제.
- **옛 `refs/locks/driver` blob ref 의 물리적 삭제** — 하지 않는다 (session #60 해제 후 stale 방치, 누구도 더 안 읽음). force push / ref delete 금지(§9).
- **STATE.json.lock 필드 구조 변경** — 비권위 mirror 그대로. 본 task 는 nextTask 만 driver 가 이미 세팅(planner 책임), lock/counters 무수정.
- **feature-branch 정리 스크립트 자체 구현** — 가드 *문서화* 만. 실제 스크립트가 있으면 그 코드 수정은 별도 pr-mode follow-up.

## Suggested Sub-agents

`implementer` (문서 inline-amend 만 — architect 불요, 설계는 ADR-0028 에 이미 박제됨. tester 는 doc-only direct 라 §3.2 면제).

## Follow-ups

- (deferred, direct) **T-0154 SUPERSEDED bookkeeping** — T-0154(원래 cloud-fire-lock task, ADR-0015 참조)는 ADR-0028 이 그 의도를 supersede. T-0154 frontmatter `status: PENDING` → `SUPERSEDED`, `supersededBy: ADR-0028` (+ 본 task T-0243), `supersededAt` 추가. commitMode direct. 다음 turn 의 planner 또는 driver 가 처리.
- (deferred, 운영) ADR-0028 Follow-up §3 — 본 doc-sync 머지 후 첫 cron@cloud fire 가 `claude/lock-driver` 를 자율 획득(403 미재발)하는지 관찰 → journal 1줄 박제. 성공 시 ADR-0028 status 메모의 "운영 관찰 대기" 부기 해소.

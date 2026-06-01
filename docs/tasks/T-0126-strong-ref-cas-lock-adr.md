---
id: T-0126
title: "강한 git-ref CAS lock + multi-machine 동일역할 운영 모델 ADR (ADR-0009)"
phase: P3
status: DONE
completedAt: 2026-06-01T13:05:00+09:00
mergedAs: 19762c3
reviewRounds: 1
prNumber: 127
commitMode: pr
coversReq: []
estimatedDiff: 200
estimatedFiles: 1
actualDiff: 107
actualFiles: 1
created: 2026-06-01
dependsOn: []
plannerNote: "사용자 결정 4건 박제 — (1) 강한 CAS lock, (2) lock 위치 = 전용 git ref refs/locks/driver, (3) cron·/loop 역할 분리 없음(동일 역할), (4) cron 환경 gh/MCP 복구는 별도 follow-up ADR. 본 task 는 lock 모델 ADR 1건만. LOOP.md/CLAUDE.md/driver-prompt 개정은 ADR ACCEPTED 후 후속 direct task."
---

# T-0126 — 강한 git-ref CAS lock + multi-machine 동일역할 운영 모델 ADR

## Why

현 시스템의 동시 진입 보호는 **약한 mutex** 다 — `docs/STATE.json.lock` 을 메모리에서 잡고 작업 끝에 push 하는 구조라, lock 점검과 push 사이에 두 driver 가 같은 `lock=null` 을 보고 동시에 진입할 수 있다 (CLAUDE.md §10 "동시 실행 정책" 이 약한 mutex 임을 명시). 단일 operator / 단일 worktree 전제에서만 안전하다.

사용자 운영 시나리오가 이 전제를 깬다:
- **cron** 은 자리를 비울 때 백그라운드(Anthropic 클라우드)로 상시 가동.
- **/loop** 은 자리에 있을 때 가동하며, **장소가 바뀌면 /loop 를 돌리는 기기도 달라진다** (multi-machine).
- 둘 다 동시에 무장(armed)되며, 동시 진입 시도 가능성이 실재.

사용자 결정 4건 (본 ADR 이 박제):
1. **강한 lock** — lock 취득을 별도의 원자적 commit/push 로 분리해 진짜 CAS 보장.
2. **lock 위치 = 전용 git ref `refs/locks/driver`** — main 히스토리를 더럽히지 않고 lock 경쟁과 콘텐츠 push 를 분리. `git push --force-with-lease` 의 ref 갱신이 진짜 compare-and-swap.
3. **역할 분리 없음** — cron 과 /loop 는 동일 역할(모든 task 후보). lock 하나가 전 직렬화 부담을 짊어진다.
4. **cron 환경 gh/MCP 복구** — 동일 역할이 실제로 성립하려면 cron 클라우드도 pr-mode 를 머지까지 완수해야 함. 이는 **별도 follow-up ADR/task** 로 분리 (본 task scope 0, GitHub MCP 우선 검토 — ADR-0005 가 MCP path 정당화).

부트스트랩 역설: lock 을 고치는 작업 자체가 옛 약한 lock 위에서 돌아가므로, 본 ADR 작성/머지 기간 동안에는 사람이 **B 방식(human lock)** 으로 cron 을 일시정지해 단일 active driver 를 보장한다 (LOOP.md §6). 단 human lock 도 60분 stale 탈취 대상이므로 단기 보호용임을 ADR 에 명시.

PLAN.md "운영 정책 review backlog" + CLAUDE.md §10 마지막 단락("multi-operator 환경이 필요해지면 강한 mutex(별도 ADR 필요)로 전환")이 본 ADR 을 직접 예고.

## Required Reading

- `docs/tasks/T-0126-strong-ref-cas-lock-adr.md` (본 파일)
- `CLAUDE.md` §10 "Long-horizon 실행 모드" + "동시 실행 정책" + "Branch protection 정책" — 약한 mutex 전제와 강한 mutex 전환 예고
- `docs/LOOP.md` §1 [1] STATE & LOCK + §4 "Lock & 충돌 규약" (lock 형태 / 획득·해제 / 60분 stale / push 충돌 / Push source-target hard rule / worktree 정책 / single-writer)
- `docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md` — gh/MCP unified 도구 path 박제 (cron-env gh 부재 대응 backbone, 결정 4 의 reference)
- `docs/STATE.json` (상단 lock 블록 schema — holder/since/session/loopSessionTurnCount/loopSessionStartedAt)

## Acceptance Criteria

- [ ] **`docs/decisions/ADR-0009-strong-ref-cas-lock.md` 신설** (ADR 표준 섹션: Status / Context / Decision / Consequences / Alternatives). 본문 한국어 (CLAUDE.md §12).
- [ ] **Status**: PROPOSED 로 시작 (머지 시점). 본문 말미에 "ACCEPTED 전이는 LOOP.md/CLAUDE.md 개정 후속 task 와 함께" 명시.
- [ ] **Context** 섹션 — 위 Why 의 운영 시나리오(cron + multi-machine /loop 동시 무장) + 현 약한 mutex 의 read-then-push race + 부트스트랩 역설을 기술.
- [ ] **Decision** 섹션 — 다음을 명문화:
  - [ ] (1) lock 취득을 **별도 원자적 step** 으로 분리. 작업 시작 전 lock-acquire commit/push, 작업 종료 시 lock-release. 작업 전 구간을 lock 이 덮는다.
  - [ ] (2) lock 저장소 = **전용 ref `refs/locks/driver`**. 절차 명시:
    - `git fetch origin +refs/locks/driver:refs/locks/origin-driver` 로 현 lock 상태 fetch.
    - 비어있음/stale 이면 lock blob 생성 후 `git push origin <sha>:refs/locks/driver --force-with-lease=refs/locks/driver:<old-sha>`.
    - push 성공 = 획득. reject = 경쟁 패배 → 재fetch → held 면 즉시 종료.
    - 해제도 `--force-with-lease` CAS push.
  - [ ] (3) **holder 식별자 강화** — `holder`(loop|cron|human) + **`session` 필수**(`<holder>@<host>-<rand>`). session 이 직전과 다르면 `loopSessionTurnCount` reset (기기 이동 = 새 session). 두 기기가 둘 다 loop 여도 session 으로 구분.
  - [ ] (4) **stale 탈취도 CAS** — 60분 임계 초과 탈취 역시 `--force-with-lease` push 로 1개만 승리. human lock 도 60분 stale 대상임을 명시(단기 보호용).
  - [ ] (5) **역할 분리 없음** 명문화 — cron·/loop 동일 task 후보. 단 cron 클라우드의 pr-mode 완주는 결정 4(별도 ADR)에 의존.
- [ ] **Consequences** 섹션 — 장점(진짜 multi-machine 안전 / main 히스토리 청결 / lock·콘텐츠 분리) + 비용(driver prompt 가 ref 조작 학습 / 사람이 lock 보려면 `git ls-remote origin refs/locks/driver`) + 후속 의무(LOOP.md §1 [1]·§4 개정 + CLAUDE.md §10 개정 + STATE schema `session` 필수 + cron-env gh/MCP ADR).
- [ ] **Alternatives** 섹션 — 기각된 후보와 사유: (a) 로컬 파일/메모리 lock — 기기 간 안 보임, (b) 커밋된 STATE.json 파일 lock 유지 — lock·콘텐츠 push 경쟁 혼재, (c) GitHub API lock(Issue/label) — cron 클라우드 gh 부재로 불안정, (d) 외부 lock 서버(Redis 등) — 새 dependency(§5 BLOCKED) + 클라우드 도달 불확실.
- [ ] **doc-only ADR task** 라 production code 변경 0 — 단 `commitMode: pr`(새 ADR 은 reviewer 점검 대상, §3.1 rule 4). tester 는 `pnpm lint && pnpm build && pnpm test` (+ smoke/e2e) green 확인(R-110, 코드 변경 0 이어도 의무).
- [ ] CI 전 step green + reviewer 4-게이트 PASS.

## Out of Scope

- **LOOP.md §1 [1] / §4 실제 개정** — ADR ACCEPTED 전이와 함께 후속 **direct** task (LOOP.md 는 §3.1 direct 컬럼). 본 task 는 결정 박제(ADR)만.
- **CLAUDE.md §10 개정** — 후속 direct task. "single operator/단일 worktree 전제 → multi-entry strong-mutex" 갱신.
- **driver prompt(LOOP.md §1) ref-CAS 절차 교체** — 후속 direct task.
- **STATE.json schema `session` 필수화 + 검증** — 후속 task (data-model/schema 문서 동기).
- **cron 환경 gh/MCP 복구** (결정 4) — **별도 ADR + 구현 task**. GitHub MCP 우선 검토 (gh CLI 설치는 §5 "새 dependency" 판정 소지 — MCP path 로 회피). 본 task scope 0.
- **production code / src 변경** — 0. 본 task 는 ADR 1 파일 신설만.

## Suggested Sub-agents

`architect` (ADR 1건 작성 — 새 운영 아키텍처 결정) → `tester` (코드 변경 0 이지만 R-110 의무로 lint/build/test/smoke/e2e green 확인). implementer 미호출(production code 변경 0).

## Follow-ups

(작성 시점 — planner 예약 항목)
- (planner 예약) **LOOP.md §1 [1] + §4 개정** — ref-CAS lock 절차로 교체, `session` 필수, turn-count reset, stale 탈취 CAS. direct, ADR-0009 ACCEPTED 직후.
- (planner 예약) **CLAUDE.md §10 개정** — multi-entry strong-mutex 모델 반영. direct.
- (planner 예약) **STATE.json schema `session` 필수화** — data-model 문서 동기 포함.
- (planner 예약) **cron 환경 gh/MCP 복구 ADR + 구현** (결정 4) — GitHub MCP path 우선. pr-mode.
- (planner 예약) ADR-0009 Status PROPOSED → ACCEPTED 1줄 갱신 — 위 LOOP/CLAUDE 개정 task 머지 후 direct.

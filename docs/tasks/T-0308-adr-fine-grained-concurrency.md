---
id: T-0308
title: ADR-0036 fine-grained concurrency (critical-section-only lock + claim 기반 task 소유, ADR-0009 supersede 검토)
phase: P5
status: PENDING
commitMode: pr
coversReq: []
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-10
priority: high
plannerNote: 사용자 결정(2026-06-10, Q&A) — multi-machine/cron 병렬로 implement/test 대기 throughput 개선을 위해 Option B(fine-grained concurrency) 진입. 현 ADR-0009 "활성 driver 항상 1개"(coarse mutex)를 supersede 하고, lock 은 공유 상태(STATE/main/select+claim/bookkeeping) 접근 시에만 점유 + task 소유는 별도 claim registry 로 분리해 N driver 동시 실행을 허용하는 설계를 ADR 로 박제한다. **단 ADR 은 채택 강제가 아니라 "이 설계가 현 시점 ROI 대비 옳은가" 까지 판정** — 아래 §우려 0(독립 task 부재 시 이득 0)을 정직히 평가. architect 작성, pr-mode. fresh session 의 첫 task(사용자 option 1). 본 ADR 확정 전엔 현행 coarse mutex 유지.
---

# T-0308 — ADR-0036 fine-grained concurrency (critical-section-only lock + claim 기반 task 소유)

## Why

사용자가 multi-machine + cron 동시 운용으로 **implement/test/CI 대기 시간 동안 다른 task 를 병렬 진행**해 throughput 을 올리고 싶어 한다(2026-06-10 결정). 현재는 [ADR-0009](../decisions/ADR-0009-*.md)/[ADR-0028](../decisions/ADR-0028-cloud-proxy-branch-lock.md) 의 **"활성 driver 항상 1개"**(branch-ref CAS 강한 mutex)라 한 task 의 전체 cycle(implement→PR→CI→merge) 동안 lock 이 점유되어 다른 진행이 막힌다.

본 task 는 **fine-grained concurrency**(Option B) 를 ADR 로 설계한다: lock 은 공유 가변 상태(`STATE.json`/journal/counters/`main`/lock ref)에 쓸 때만 **짧게** 점유하고, **task 소유는 별도 claim registry** 로 표현해 여러 driver 가 *서로 다른* task 를 동시에 진행하게 한다. 이는 ADR-0009 의 핵심 불변(1 active driver)을 supersede 하므로 **코드 전에 ADR**(CLAUDE.md). 아래 우려를 모두 Decision/Consequences 로 박제해야 한다.

**중요 — ADR 은 "무조건 채택"이 아니라 판정**: §우려 0 이 가리키듯, 순차 task chain 에서는 N driver 여도 이득이 0 일 수 있다. ADR 은 (a) 설계를 박제하되 (b) 현 시점 채택 여부 / 단계적 rollout(예: planner 독립-stream 분해가 준비된 뒤 토글)까지 정직하게 결정한다.

## Required Reading

- `docs/decisions/ADR-0009-*.md` — supersede 대상. "1 active driver" 불변 + weak→strong mutex 전환 이력 + 향후 multi-operator 시 강한 mutex 예고.
- `docs/decisions/ADR-0028-cloud-proxy-branch-lock.md` — branch-ref CAS lock 의 현 저장소(`claude/lock-driver`) + cloud proxy 호환. claim registry 도 같은 메커니즘 위에 얹을지 검토.
- `CLAUDE.md` §10 (동시 실행 정책 — "활성 driver 1개", cron 간격, 시간대 분리) + §9 (STATE single-writer).
- `docs/LOOP.md` §1 (driver loop step [1]~[8]), §4 (Lock & 충돌 규약 — 형태/획득/해제/충돌 흡수/single-writer).
- `docs/progress/journal-2026-06-10.md` — 본 결정의 맥락(운영 피드백 + 우려 토론).
- `docs/STATE.json` — `lock` 스키마 + `flags`(multiTaskFire 선례 — 토글 패턴 참조) + counters.

## Acceptance Criteria — ADR-0036 이 아래를 모두 decide

- [ ] `docs/decisions/ADR-0036-fine-grained-concurrency.md` 신규(status: PROPOSED), ADR-0032/0033 포맷 mirror. `supersedes: ADR-0009`(또는 amends) 명시 + ADR-0009 와의 관계(어느 불변을 깨고 어느 걸 보존하는지).
- [ ] **결정 0 — 병렬 이득 전제(정직 평가)**: N driver 의 throughput 이득은 *동시 진행 가능한 독립 task* 존재에 달렸다. 현 work 가 대부분 순차 chain(각 slice 가 앞 머지에 의존)임을 직시하고, **planner 가 독립 stream 으로 분해하는 정책**(파일-disjoint + 의존성 없는 task 만 동시 claimable)을 함께 정의하거나, 그게 없으면 본 ADR 의 이득이 제한적임을 Consequences 에 박제. (이득 0 이면 채택 보류도 정당한 결론.)
- [ ] **결정 1 — claim registry + 원자성 + staleness**: task 소유를 표현하는 claim 스키마(owner session / claimedAt / status / prNumber / taskId). select+claim 은 **lock 하에서 atomic**(release 전 claim 박제 — 이중 claim 차단). driver 사망 시 orphan claim 의 **staleness 회수 임계**(lock 60분 stale 동형) + [LOOP.md §1[2]](../LOOP.md) PR-resume 으로 중복 PR 방지(죽기 전 PR 있으면 resume). 저장 위치(STATE.json vs 별도 ref) 결정.
- [ ] **결정 2 — merge 충돌 경계**: STATE/journal/counters 는 bookkeeping 이 critical section(lock)이라 직렬화(counters 는 origin+1 read-modify-write 유지)로 안전. **코드 충돌**(두 PR 이 같은 `src/` 파일)은 planner 의 파일-disjoint 동시 큐잉으로 회피 또는 충돌 해소 절차 정의.
- [ ] **결정 3 — 의존성 위반 방지**: 미머지 task 에 의존하는 task 를 동시 claim 하면 stale main 위 빌드 → 깨짐. claim/queue 가 의존성을 인코딩하고 독립 task 만 동시 pickup 허용하는 규칙.
- [ ] **결정 4 — cron@cloud credential 한계**: branch-ref CAS lock 은 cron@cloud 가능(ADR-0028, claude/* prefix). 단 cron@cloud 가 **feature branch push + PR open + merge** 까지 가능한지 불확실(메모리: gh/MCP 부재 시 pr-mode stand-down). 불가 시 cron 은 direct(doc) task 만 병렬 기여함을 명시하고 두 번째 driver 의 task 범위를 한정.
- [ ] **결정 5 — multi-machine clock skew → staleness 오판**: lock/claim 취득은 SHA-CAS 라 시계 무관하나 **staleness 회수는 timestamp 기반**. 기기 간 clock skew(이 repo: AKIHA 간헐 skew 실측)가 조기/지연 회수 유발. 회수 임계 보수화 + 가능하면 server time(예: gh run / GitHub API Date) 기준 결정.
- [ ] **결정 6 — CI 비용/동시성**: N 동시 PR = N CI run(Q-0028 spending-limit 사고 이력 = 비용). 동시 PR 이 **per-PR concurrency group** 으로 분리되어 서로 cancel 안 하도록 `.github/workflows` 정책(현 approval-gate + issue_comment concurrency cancel 사례 PR #257 참조)을 결정.
- [ ] **결정 7 — 관측성**: journal 인터리브 + 다중 claim 의 추론 난이도 완화 — 모든 entry 에 진입점 session-id 박제 + claim registry 조회 수단.
- [ ] **rollout**: 즉시 전환 vs `flags` 토글(multiTaskFire 선례 — ADR-0020) 단계적 rollout vs 보류. ADR-0009 의 §1 loop step 재작성 범위(별도 구현 task chain)를 Follow-ups 로 분해.
- [ ] 새 외부 dependency 0(설계만). 코드/STATE schema 변경/§1 loop 재작성은 본 ADR 밖(Follow-ups).

## Out of Scope

- 실제 claim registry 구현 / §1 driver loop 재작성 / CLAUDE.md §10·LOOP.md §4 본문 갱신 / `.github/workflows` concurrency 변경 — 전부 ADR 확정(ACCEPTED) 후 별도 구현 chain.
- ADR-0035 Summary 평가 chain(T-0307 narrative → 후속 write service) — 본 ADR 과 독립, 병행/후속 진행.
- 새 외부 dependency 추가 — §5 게이트.

## Suggested Sub-agents

`architect` — ADR-0036 작성(단일 ADR / 구현 코드 0). reviewer 가 pr-mode 검토.

## Follow-ups

(ADR ACCEPTED 후) claim registry 스키마 구현 → §1 driver loop 재작성(critical-section lock + claim) → CLAUDE.md §10 / LOOP.md §1·§4 갱신 → `.github` per-PR concurrency group → `flags` 토글. 각 ≤300 LOC / ≤5 파일.

---
id: T-0329
title: ADR-0036 stage3 slice1 — LOOP §1 claim-pickup 분기 + server-time now 주입 계약 (토글-gated)
phase: P5
status: DONE
completedAt: 2026-06-10T18:48:00+09:00
commitMode: direct
coversReq: [TBD]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-06-10
independentStream: adr0036-stage3
dependsOn: []
touchesFiles: [docs/LOOP.md, docs/STATE.json]
plannerNote: ADR-0036 §rollout stage3 slice1 — LOOP §1[2] claim-pickup 분기 + reclaim server-time now 주입 계약을 토글-gated 로 박제(OFF=동작 불변). doc-only direct.
estimatedDiffModel: "doc-only enumerated-section ×1.6 × inline-amend ×0.4 = ×0.64 → base ~110 × 0.64 ≈ 70 LOC, T-0070/T-0073/T-0076 precedent"
---

# T-0329 — ADR-0036 stage3 slice1: LOOP §1 claim-pickup 분기 + server-time now 주입 계약

## Why

ADR-0036 §rollout stage3(§1 loop 재작성 — critical-section lock + claim pickup 분기 + reclaim 통합)의 **첫 slice**다. stage2 가 select+claim CAS primitive(`scripts/select-claim.sh`, T-0327)와 orphan staleness 회수 + PR-resume primitive(`scripts/reclaim-stale-claim.sh`, T-0328)를 박제했으나, **driver loop 가 이 primitive 들을 언제 어떻게 호출하는지**가 아직 LOOP.md 에 통합되지 않았다(stage2 doc 의 §5 "미shipped" 명시). 본 slice 는 LOOP.md §1[2]에 **claim-pickup 분기**(`flags.fineGrainedConcurrency` 토글-gated)와 reclaim primitive 의 **server-time now 주입 계약**을 박제해, stage3 의 핵심인 "loop 가 critical-section 안에서 select+claim 후 lock release 하고 병렬 진행" 진입점을 문서화한다. 토글 OFF(현 상태) 동안은 forward-looking spec 으로 기능 — driver 동작 변경 0(기존 단일-task pickup 경로 그대로). ADR-0036 buildThrough 승인·escalate 금지(adr0036Rollout.buildThrough=true·ACCEPTED).

## Required Reading

- `docs/decisions/ADR-0036-fine-grained-concurrency.md` (§Decision 1 원자성·staleness, §rollout stage3, §Decision 5 clock-skew server-time)
- `docs/architecture/concurrency.md` (§3 select+claim 원자성, §5 staleness 회수 / PR-resume — server-time now 주입 계약 본문)
- `docs/LOOP.md` §1[1] STATE & LOCK, §1[2] 작업 선정 + PR Resume 판정 (claim-pickup 분기를 삽입할 위치)
- `scripts/select-claim.sh` 헤더 주석 (select+claim 절차 — loop 가 호출할 contract)
- `scripts/reclaim-stale-claim.sh` 헤더 주석 (RECLAIM_NOW 주입 계약 — "미주입 시 회수 보류", PR-resume 신호 stdout)

## Acceptance Criteria

- [ ] `docs/LOOP.md` §1[2]에 **claim-pickup 분기**를 박제: `flags.fineGrainedConcurrency == true` 일 때 driver 가 (a) lock(critical section) 획득 후 `scripts/select-claim.sh` 로 첫 claimable task 1개를 select+claim(같은 commit 에 claim append + lock tombstone CAS push = 즉시 release), (b) claim 박제 후 lock-free 로 implement/test 진행, (c) claimable 부재 시 no-op 종료. **토글 OFF(현 상태)면 기존 단일-task pickup(`currentTask`/`nextTask`/planner dispatch) 경로 그대로** — 분기는 토글-gated 로 명시.
- [ ] §1[2] 또는 인접 절에 **reclaim primitive 의 server-time now 주입 계약**을 박제: driver 가 `scripts/reclaim-stale-claim.sh` 를 호출할 때 server-time(GitHub API `Date` 헤더 / `gh run` UTC)을 `RECLAIM_NOW` 로 주입한다, **server-time 확보 불가 시 회수 보류**(미주입=primitive 가 회수 안 함, concurrency.md §5 계약 mirror), `RESUME prNumber=<n>` stdout 신호를 받으면 새 PR 생성 대신 PR-resume(§1[2] Resume 판정 재사용)으로 분기.
- [ ] 본 slice 가 **doc-only(LOOP.md)** 이고 `src/`·`scripts/`·`.github/` 변경 0 임을 확인(stage3 의 실제 loop 동작은 토글 OFF 라 spec 만 — 분기 코드 자체는 driver-prompt 텍스트). 따라서 R-110 tester 면제(direct doc-only commit, CLAUDE.md §3.2).
- [ ] LOOP.md 변경이 **기존 단일-driver 경로를 회귀시키지 않음**을 검증: 토글 OFF 분기(현 동작)가 기존 §1[2] currentTask/nextTask/planner dispatch 흐름과 1:1 동일하게 보존되는지 본문 대조(claim-pickup 은 토글 ON 일 때만 진입).
- [ ] `docs/STATE.json` 의 `adr0036Rollout.stage3` 를 신설/갱신: "stage3 slice1 IN_PROGRESS(LOOP §1 claim-pickup 분기 + server-time now 주입 계약 박제) — slice2(CLAUDE §10 'N-driver' 서술 sync) + slice3(LOOP §4 충돌 흡수 경계 sync) 후속" 명시(driver/planner single-writer 권한).
- [ ] 분기 없음 — 본 task 는 doc-only direct 이라 R-112 unit test 4종 항목 비적용(코드 변경 0). 본 항목 명시로 §3.2 충족.

## Out of Scope

- **CLAUDE.md §10 "활성 driver 항상 1개" → "claim 보유 N-driver" 서술 sync** — stage3 slice2 (후속 direct doc task). 본 slice 는 LOOP §1 진입점만.
- **LOOP.md §4 graceful 종료의 코드-충돌(`merge-conflict-code`) 흡수 경계가 N-driver 동시 PR 에서 어떻게 동작하는지 서술 보강** — stage3 slice3 (후속).
- **per-PR concurrency group(`.github/workflows`)** — stage4 (pr, §Decision 6).
- **`flags.fineGrainedConcurrency = true` 토글 ON** — stage5 (별도 direct, 30일 dogfood 후).
- **scripts/select-claim.sh·reclaim-stale-claim.sh primitive 코드 변경** — 이미 머지(T-0327/T-0328). 본 slice 는 호출 계약 박제만, primitive 자체 무변경.
- **실제 server-time fetch 구현 코드** — driver-prompt 가 어느 명령으로 server-time 을 얻는지는 LOOP 텍스트로 계약만 박제(GitHub API `Date` / `gh run` UTC), 새 스크립트 도입 0.

## Suggested Sub-agents

`implementer → tester` 불요 — doc-only direct commit 은 driver 가 직접 LOOP.md/STATE.json edit 후 commit(executor 가 doc edit 만 수행, tester R-110 면제 §3.2). architect 불요(ADR-0036 §Decision 1/5 + concurrency.md §3/§5 가 권위 박제, 새 결정 0).

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)

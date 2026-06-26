---
id: T-0675
title: reclaim-stale-claim 을 lib-lock-tree 헬퍼로 라우팅 + 동시성 test case 보강 (fix-2 slice 1b)
phase: P5
status: DONE
completedAt: 2026-06-26T04:20:42Z
mergedAs: a9bfe3c
prNumber: 591
reviewRounds: 1
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 95
estimatedFiles: 4
created: 2026-06-26
dependsOn: [T-0674]
independentStream: lock-acquire-fix
touchesFiles:
  - scripts/reclaim-stale-claim.sh
  - scripts/reclaim-stale-claim.test.sh
  - scripts/lib-lock-tree.test.sh
plannerNote: "P5 fix-2 slice 1b — T-0674 신설 lib-lock-tree.sh 헬퍼로 reclaim-stale-claim.sh 라우팅 + temp-file-collision 동시성 test case + reclaim 회귀 가드. slice 1a(T-0674) 의존."
---

# T-0675 — reclaim-stale-claim 을 lib-lock-tree 헬퍼로 라우팅 (fix-2 slice 1b)

> **분할 이력**: 본 task 는 T-0674(slice 1a, fix-2 slice 1)에서 분리됐다. 원래 단일 task 가 acquire/select/reclaim 3 script 를 모두 헬퍼로 라우팅하려다 6 파일/+368 LOC 로 hard cap(5 파일/300 LOC)을 초과해 planner 가 2 slice 로 split(CLAUDE.md §3). slice **1a(T-0674)** = 헬퍼 신설 + 단위 test + acquire/select 라우팅 + ci 배선. 본 slice **1b(T-0675)** = 남은 `reclaim-stale-claim.sh` 라우팅 + 이연된 동시성 test case + reclaim 회귀 확인. 헬퍼(`scripts/lib-lock-tree.sh`)와 그 단위 test 는 T-0674 에서 이미 완결·검증되므로, 본 slice 는 **이미 검증된 함수를 호출만 추가**한다.

## Why

double-claim(#588) fix-2 의 목표는 lock-ref tip tree 보존 mutation 을 단일 헬퍼로 통일해 "한 경로만 패턴을 어기면 claims.json wipe" 위험을 구조적으로 없애는 것이다. T-0674(slice 1a)가 `scripts/lib-lock-tree.sh` 헬퍼를 신설하고 `acquire-lock.sh`·`select-claim.sh` 2 script 를 라우팅했다. 본 slice 는 남은 한 경로인 `scripts/reclaim-stale-claim.sh`(orphan claim 회수 시 claims.json 재작성 + lock tombstone CAS) 의 tree-보존 mutation 을 같은 헬퍼 호출로 치환해 **세 번째이자 마지막 lock-ref 변경 경로**까지 단일 구현으로 끌어들인다. 이로써 ADR-0036 §Decision 1 의 "보존 불변"(claims.json 동거 tree·CAS 원자성)이 acquire·select·reclaim **모든** 경로에서 한 함수로 강제된다. 또한 T-0674 가 cap 때문에 이연한 temp-file-collision(동시 호출 시 임시파일 충돌 0) 검증 case 를 본 slice 에서 보강한다. CLAUDE.md §10 동시 실행 정책 + ADR-0036 §Decision 1/8 정합.

## Required Reading

- `scripts/lib-lock-tree.sh` (전체, T-0674 가 신설) — 라우팅 대상 헬퍼 `lock_tree_cas_push` 의 시그니처·preserve-except regex 의미·blob 쌍 인자 형식·return code(0/20/30)·source-only 계약. 상단 주석 박제 참조.
- `scripts/reclaim-stale-claim.sh` (전체 — tree-보존 mutation 부분 식별) — orphan claim 회수 시 claims.json 재작성 + lock tombstone CAS 패턴. 본 task 가 헬퍼 호출로 치환할 대상. 회수 판정/server-time 계약/PR-resume(`RESUME prNumber=...`) 신호/exit code 로직은 불변.
- `scripts/reclaim-stale-claim.test.sh` (전체) — 라우팅 변경 후 전부 pass 해야 할 회귀 가드. bare-repo + clone 골격.
- `scripts/lib-lock-tree.test.sh` (전체, T-0674 가 신설) — 본 task 가 temp-file-collision case 1+ 를 append 할 대상. 기존 case 와 동형 골격으로 추가.
- `scripts/select-claim.sh` (헬퍼 호출 부위만) — T-0674 가 select-claim 을 라우팅한 방식의 reference. reclaim 라우팅이 동형 패턴을 따르도록.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 1 (보존 불변·atomic select+claim) — claims.json 동거 tree·CAS 원자성 근거.

## Acceptance Criteria

- [ ] `scripts/reclaim-stale-claim.sh` 가 `lib-lock-tree.sh` 를 source 해, orphan claim 회수의 tree-보존 mutation(claims.json 재작성 + lock.json tombstone, preserve-except `\s(claims\.json|lock\.json)$`)을 `lock_tree_cas_push` 호출로 치환. **회수 판정·server-time(`RECLAIM_NOW`) 계약·PR-resume(`RESUME prNumber=...`) 신호·exit code 의미 불변** — 외부 계약(인자·env·stdout·exit code)이 바뀌지 않음.
- [ ] 라우팅 후 reclaim 의 중복 plumbing(ls-tree base + blob 교체 + commit-tree + CAS push + 빈 commit 가드 + 재시도)이 제거되고 헬퍼 한 호출로 대체됨 — script 안에 동일 mutation 로직이 잔존하지 않음(grep 으로 `git mktree`/`--force-with-lease` 잔존 0 확인).
- [ ] `scripts/lib-lock-tree.test.sh` 에 **temp-file-collision 동시 호출 검증 case 1+** append(T-0674 에서 이연) — 같은 work-tree 에서 `lock_tree_cas_push` 2회 연속 호출이 서로의 임시파일을 덮어쓰지 않음(고유 경로 검증). 동시 driver 가 같은 임시 경로를 race 하지 않음을 가드.
- [ ] `scripts/reclaim-stale-claim.test.sh` 가 **변경 후에도 전부 pass**(헬퍼 라우팅이 reclaim 외부 동작을 바꾸지 않음 증명 — 회귀 가드). 필요 시 sourcing 경로만 조정.
- [ ] reclaim 라우팅에 대한 happy-path test 1+: orphan(stale 60분 초과) claim 이 있는 tip 에서 reclaim → claims.json 의 해당 claim 만 회수(상태 변경)·그 외 엔트리·sibling 파일 byte-동일 보존(#588 류 wipe 회귀 가드). 기존 spec 에 없으면 추가.
- [ ] reclaim 라우팅에 대한 error/negative test(예외 분기마다 1+): (1) stale 미충족(60분 이내) claim → 회수 안 함(no-op, exit code 불변), (2) CAS lease mismatch(동시 다른 driver 가 먼저 tip 변경) → reject 후 재시도 또는 정의된 exit. 기존 reclaim spec 이 이미 cover 하면 그대로 pass 확인으로 충족.
- [ ] 분기 없는 단순 라우팅 치환부는 "분기 없음 — 항목 생략" 명시 가능하나, reclaim 의 회수 판정 분기(stale 충족/미충족)는 각 1+ test 로 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 확인 — src 변경 0 이어도 R-110 의무). shell script 변경이라 jest 대상 아님 — jest line/function ≥ 80% 임계는 기존 그대로 유지됨 확인(`pnpm test:cov` regression 0).
- [ ] PR 본문에 "smoke/e2e 영향 없음(shell script only, src·web 무변경)" 명시. T-0674 머지 선행 의존(헬퍼 존재 전제) 명시.

## Out of Scope

- **헬퍼(`scripts/lib-lock-tree.sh`) 자체의 신규 함수/시그니처 변경** — T-0674 에서 신설·확정됨. 본 slice 는 호출만 추가, 헬퍼 구현 미변경(필요 시 발견된 결함은 Follow-ups 로 별도 patch).
- **acquire-lock.sh·select-claim.sh 재변경** — T-0674 에서 라우팅 완료. 본 slice 미접촉.
- **acquire 와 첫 claim 을 단일 CAS commit 으로 물리 통합**(fix-2 slice 2) — driver loop(LOOP.md §1[2]) 호출 순서 재설계 필요한 별도 slice. Follow-ups.
- claims.json schema 변경. reclaim 의 회수 판정 의미·server-time 계약·PR-resume 신호 의미 변경.
- LOOP.md §1[1]·§1[2] prose 변경 — script 내부 리팩터링이라 driver 호출 계약 불변.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- **fix-2 slice 2(별도 task)**: acquire 와 첫 claim 을 단일 CAS critical-section commit 으로 물리 통합 가능한지 검토 — lock 획득 commit 과 claim+tombstone commit 사이 window 제거(ADR-0036 §Decision 1 의 "lock CAS 획득 → claim 박제 → tombstone 동반 release 를 같은 commit"). driver loop §1[2] 호출 순서 재설계 동반 시 cap 분할.
- **재-ON 결정 게이트**: fix-2 완결(slice 1a+1b+2 머지) 후 fineGrainedConcurrency 토글 정확성 게이트(이중 claim 0 + bookkeeping 충돌 0) 재검증 — 재활성 자체는 사람 결정(회로 차단기 자동 복구 금지, Q-0047 amendment).

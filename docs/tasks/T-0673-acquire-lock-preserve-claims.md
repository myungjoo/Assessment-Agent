---
id: T-0673
title: lock-acquire 가 claims.json 을 보존하도록 canonical acquire-lock.sh 신설
phase: P5
status: DONE
mergedAs: 53af60c
prNumber: 589
reviewRounds: 2
completedAt: 2026-06-26T02:54:32Z
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 260
estimatedFiles: 4
created: 2026-06-26
dependsOn: []
independentStream: lock-acquire-fix
touchesFiles:
  - scripts/acquire-lock.sh
  - scripts/acquire-lock.test.sh
  - docs/LOOP.md
plannerNote: "P5 동시성 fix-1 — lock-acquire 가 claims.json wipe → double-claim(#588) 근본 차단. select-claim.sh tree-보존 패턴 재사용."
---

# T-0673 — lock-acquire 가 claims.json 을 보존하도록 canonical acquire-lock.sh 신설

## Why

fineGrainedConcurrency(동시 N-driver claim) 가 재-ON 됐으나 double-claim 근본 버그가 미수정이다. driver 가 lock 을 획득할 때 만드는 commit 이 `claims.json` 을 보존하지 않고 `lock.json` 만 담은 fresh tree 로 lock ref 를 덮어쓴다. 사고 commit be74f97(cloud cron lock-acquire) 의 tree = `lock.json` 단독, parent tree = `claims.json`(T-0672 활성 claim) + `lock.json` — 즉 lock 획득이 다른 driver 의 활성 claim 을 wipe → 그 driver 가 빈 claims 를 보고 같은 task 재claim → 중복 PR(#588). T-0526 도 동일 class race. 본 task 는 모든 lock-acquire 경로가 claims.json(및 lock ref tip tree 의 다른 모든 파일)을 보존하도록 canonical 헬퍼 script 를 신설한다. CLAUDE.md §10 동시 실행 정책 + ADR-0036 §Decision 1/8 의 "보존 불변" 을 lock-acquire 경로에서도 실제로 지킨다.

## Required Reading

- `scripts/select-claim.sh` (line 115~150) — tree-보존 패턴의 정본: `git ls-tree "$old_sha" | grep -vE '\s(claims\.json|lock\.json)$'` 로 기존 tree 엔트리를 base 로 깔고 claims.json/lock.json 만 교체. self-contained git identity(`-c user.name=... -c user.email=...`) 처리, `--force-with-lease` CAS, CAS race 재시도 루프. 본 task 헬퍼가 mirror 할 패턴.
- `scripts/reclaim-stale-claim.sh` (line 178~208) — 동형 tree-보존 + tombstone + identity self-provide + CAS push 패턴. acquire/release 헬퍼 골격 참고.
- `scripts/select-claim.test.sh` (전체) — bare-repo + 2 clone self-contained spec 패턴. 네트워크/credential 불요. acquire-lock.test.sh 가 차용할 골격(`git init --bare`, clone A/B, `count_entry`, pass/fail, CLAIM_NOW 동형 NOW 주입).
- `docs/LOOP.md` line 26~34 + line 471~479 — 현재 lock-acquire/release 의 ad-hoc plumbing prose(`lock.json` 담은 commit 생성 → `--force-with-lease` push, tombstone release). 본 task 가 "ad-hoc plumbing 금지 — acquire-lock.sh 사용(claims.json 보존)" 으로 갱신할 대상.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 1(보존 불변 목록) + §Decision 8(안전장치 5종) — claims.json 동거 tree·CAS 원자성 보존 근거.

## Acceptance Criteria

- [ ] `scripts/acquire-lock.sh` 신설: lock ref tip tree 를 base 로 `lock.json` 만 교체하고 **claims.json 및 그 외 모든 tree 엔트리를 보존**(select-claim.sh line 121~131 패턴 재사용 — `git ls-tree "$old_sha" | grep -vE '\s(lock\.json)$'` base + lock.json blob 교체). lock 미존재(ref 부재) 시 zero-sha lease(expect-absent)로 첫 lock 생성. `--force-with-lease="$REF:$old_sha"` CAS push + CAS race 재시도 루프(select-claim.sh 동형, 기본 3회).
- [ ] tombstone release 도 같은 보존 원칙: release 경로(별도 함수/모드 또는 본 script 의 release 동작)가 `lock.json` 을 tombstone(`{"holder":null,"since":""}` 또는 동형)으로 교체하되 claims.json 보존.
- [ ] self-contained git identity 처리: `git -c user.name='...' -c user.email='...' commit-tree` 로 CI ubuntu(empty ident) 환경 호환(select-claim.sh line 137~143 동형).
- [ ] 계약/env 를 script 상단 주석에 박제: holder/session/since 입력, REMOTE/REF/lease 동작, exit code 의미(0=획득 성공, non-zero=CAS lose 소진/인자 오류), stdout/stderr.
- [ ] `scripts/acquire-lock.test.sh` 신설 — select-claim.test.sh 의 bare-repo + 2 clone self-contained 골격 차용. 다음 R-112 4종 + negative 충분 cover:
  - [ ] **happy-path** (기능): claims.json 이 이미 존재하는 lock ref tip 에서 acquire 후 tip tree 에 **claims.json 이 byte-동일 보존**되고 lock.json 이 본인 holder 로 박힘. (회귀 test — 본 버그가 재발하면 fail: claims.json 누락 시 이 assertion 이 fail.)
  - [ ] **error path**: lock ref 부재 시 zero-sha(expect-absent) lease 로 첫 lock 생성 성공.
  - [ ] **branch cover**: (a) tombstone-free(free) lock 획득 성공, (b) 다른 holder 가 held(60분 이내) — 호출측 책임 경계라면 script 자체는 CAS 만 검증하되 free/held tip 상태별 분기 1+, (c) stale tombstone tip 에서 획득.
  - [ ] **negative 충분 cover** (예외 분기마다 1+): (1) CAS lease mismatch(틀린 old-sha) → push reject(verify-ref-cas-lock T4 mirror), (2) 빈/누락 commit push 방지(MEMORY lock-cas-bash-hazard — `test -n "$COMMIT"` 가드로 empty COMMIT push 차단 검증), (3) acquire 직전 claims.json 이 존재할 때 acquire 가 그것을 wipe 하지 않음(double-claim 회귀 가드 — 본 task 핵심), (4) release(tombstone) 후에도 claims.json 보존.
  - [ ] `pnpm test:cov` 통과 — 다만 본 변경은 shell script 라 jest coverage 대상 아님. shell script 는 `bash scripts/acquire-lock.test.sh` 가 전부 pass 해야 하며, **script 의 모든 분기(line·branch·function 의미상 ≥80%)가 .test.sh case 로 cover** 됨을 spec 의 branch-검증 매핑 주석(select-claim.test.sh line 11~17 동형)에 명시.
- [ ] `docs/LOOP.md` §1[1](line 26~34) + lock 절(line 471~479)의 lock-acquire/release prose 갱신: "본인 lock.json 담은 commit 생성" → "`scripts/acquire-lock.sh` 로 lock 획득(ad-hoc git plumbing 금지 — claims.json 보존)". release prose 도 동형 갱신.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 확인 — src 변경 0 이어도 R-110 의무).
- [ ] PR 본문에 "smoke/e2e 영향 없음(shell script + doc only, src 무변경)" 명시.

## Out of Scope

- **fix-2(acquire+claim 단일화)** — 모든 진입점의 lock-acquire 를 select-claim.sh 단일 경로로 통일하거나 acquire 와 claim 을 한 CAS commit 으로 합치는 작업은 본 task 가 아니다. Follow-ups 의 별도 task.
- driver loop(LOOP.md §1[1]) 의 acquire 호출 지점을 acquire-lock.sh 호출로 실제 배선하는 코드 변경 — 본 task 는 헬퍼 신설 + prose 갱신까지. (driver prose 가 헬퍼를 가리키게만 한다. 실 호출 배선이 cap 초과면 분리.)
- STATE.json.lock human mirror 동기 로직 변경.
- claims.json schema / select-claim.sh / reclaim-stale-claim.sh 의 동작 변경.

## Suggested Sub-agents

architect → implementer → tester

## Follow-ups

- **fix-2(별도 task 박제 대상)**: 모든 lock-acquire 진입점(cron · local/cloud `/loop` · headless)이 ad-hoc git plumbing 대신 `scripts/acquire-lock.sh` 를 실제 호출하도록 driver loop(LOOP.md §1[1]) 배선을 단일화한다. 나아가 acquire 와 select-claim 을 한 CAS critical-section 으로 통합 가능한지(lock 획득 + 첫 claim 을 단일 commit) 검토 — ADR-0036 §Decision 1 atomic select+claim 과 정합. cap 안에서 분할.

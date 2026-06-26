---
id: T-0674
title: lock-ref tree mutation 을 공통 헬퍼로 추출해 acquire/select/reclaim 단일 경로 통일 (fix-2 slice 1)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 195
estimatedFiles: 5
created: 2026-06-26
dependsOn: [T-0673]
independentStream: lock-acquire-fix
touchesFiles:
  - scripts/lib-lock-tree.sh
  - scripts/lib-lock-tree.test.sh
  - scripts/acquire-lock.sh
  - scripts/select-claim.sh
  - scripts/reclaim-stale-claim.sh
plannerNote: "P5 동시성 fix-2 slice 1 — lock-ref tip tree 보존 mutation(ls-tree base + blob 교체 + CAS)을 3 script 가 공유하는 단일 헬퍼로 추출. double-claim #588 구조적 차단."
---

# T-0674 — lock-ref tree mutation 을 공통 헬퍼로 추출해 단일 경로 통일 (fix-2 slice 1)

## Why

double-claim(#588) 의 근본 원인은 **lock ref tip tree 를 변경하는 경로가 여러 개**인데 그중 하나(ad-hoc lock-acquire)가 `claims.json` 을 보존하지 않고 `lock.json` 단독 fresh tree 로 덮어쓴 것이었다. fix-1(T-0673)이 canonical `acquire-lock.sh` 를 신설해 acquire/release 경로를 막았으나, 같은 "tip tree 를 base 로 한두 blob 만 교체 + `--force-with-lease` CAS push + self-contained git identity + 빈 commit 가드 + CAS race 재시도" 로직이 **`acquire-lock.sh`·`select-claim.sh`·`reclaim-stale-claim.sh` 3 곳에 복붙으로 중복**돼 있다(T-0673 Out of Scope 가 fix-2 로 명시). 복붙 중복은 #588 류 재발 위험의 구조적 원천이다 — 한 script 만 패턴을 어기면 다시 claims.json wipe 가 난다. 본 task 는 그 tree-보존 mutation 을 단일 공통 헬퍼 `scripts/lib-lock-tree.sh` 로 추출해 3 script 가 모두 그 한 함수를 거치게 한다. ADR-0036 §Decision 1 의 "보존 불변"(claims.json 동거 tree·CAS 원자성)을 **모든** lock-ref 변경 경로에서 단일 구현으로 강제한다. CLAUDE.md §10 동시 실행 정책 + ADR-0036 §Decision 1/8 정합.

## Required Reading

- `scripts/acquire-lock.sh` (line 77~123) — tree-보존 mutation 의 정본: `lock_blob_body | git hash-object -w --stdin` → `git ls-tree "$old_sha" | grep -vE '\s(lock\.json)$'` base + lock.json blob 교체 → self-contained identity `git -c user.name=... commit-tree` → 빈 commit 가드(`[ -z "$commit" ]` return 30) → `--force-with-lease="$REF:$old_sha"` CAS push + 재시도 루프. 추출 대상 함수의 reference 구현.
- `scripts/select-claim.sh` (line 115~152) — 동일 패턴이지만 **2 blob(claims.json + lock.json tombstone)** 을 교체. `git ls-tree "$old_sha" | grep -vE '\s(claims\.json|lock\.json)$'` base. 본 task 가 공통 헬퍼 호출로 치환할 대상 — claim CAS 의미는 불변.
- `scripts/reclaim-stale-claim.sh` (line 178~210 추정 — 전체 훑어 tree-보존 mutation 부분 확인) — orphan claim 회수 시 claims.json 재작성 + lock tombstone CAS. 동형 패턴. 본 task 가 공통 헬퍼 호출로 치환할 대상 — 회수 판정/PR-resume 신호 로직은 불변.
- `scripts/select-claim.test.sh` (전체) — bare-repo + 2 clone self-contained spec 골격(`git init --bare`, clone A/B, `count_entry`, pass/fail, `CLAIM_NOW` 동형 NOW 주입). `lib-lock-tree.test.sh` 가 차용할 골격.
- `scripts/acquire-lock.test.sh` (전체) — T-0673 회귀 가드(claims.json byte 보존). 본 task 변경 후에도 전부 pass 해야 함(헬퍼 추출이 동작을 바꾸지 않음 증명).
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 1(line 46~48, 보존 불변·atomic select+claim) — claims.json 동거 tree·CAS 원자성 근거.

## Acceptance Criteria

- [ ] `scripts/lib-lock-tree.sh` 신설 — sourcing 용 라이브러리(직접 실행 아닌 `source`). 공통 함수 1+ 제공:
  - [ ] **`lock_tree_cas_push`** (또는 동형 명) — 인자: `<remote> <ref> <old_sha> <preserve-except-regex> <"path=blobsha" 쌍 N개> [<commit-msg>]`. 동작: `git ls-tree "$old_sha" | grep -vE "$preserve_except_regex"` 를 base 로 깔고 인자로 받은 path↔blobsha 쌍을 추가 → `git mktree` → self-contained identity `commit-tree`(`-c user.name=... -c user.email=...`) → **빈 commit 가드**(빈 COMMIT 시 non-zero return, push 안 함 — MEMORY lock-cas-bash-hazard) → `--force-with-lease="$ref:$old_sha"` CAS push. 성공 0 / 빈 commit 가드 30 / CAS lose 20 반환(현 3 script 의 return code 의미 보존).
  - [ ] `old_sha` 빈 문자열이면 zero-sha expect-absent lease(첫 생성). `git ls-tree` base 생략(parent 없음 → `commit-tree` -p 생략).
  - [ ] 함수가 `/tmp` 임시파일에 의존하지 않거나, 의존 시 호출별 고유 경로 + 정리(현 `/tmp/.al_tree`·`/tmp/.sc_tree` race-prone 패턴 개선 — 동시 driver 가 같은 경로 덮어쓰기 방지). MEMORY summary-batch/mktemp hazard 회피(MSYS mktemp 주의).
- [ ] `scripts/acquire-lock.sh` 가 `lib-lock-tree.sh` 를 source 해 `lock_tree_cas_push` 호출로 치환 — acquire(lock.json 교체, preserve-except `\s(lock\.json)$`)·release(tombstone lock.json 교체, 동일 preserve-except) 둘 다. **외부 계약(인자·env·exit code·stdout) 불변** — 호출측 driver 가 바뀌지 않음.
- [ ] `scripts/select-claim.sh` 가 `lib-lock-tree.sh` 를 source 해 claim CAS(claims.json + lock.json tombstone 2 blob 교체, preserve-except `\s(claims\.json|lock\.json)$`)를 헬퍼 호출로 치환. **claimed-set 제외·pick_claimable·재시도 루프·exit code(0/1) 의미 불변.**
- [ ] `scripts/reclaim-stale-claim.sh` 의 tree-보존 mutation 부분을 헬퍼 호출로 치환. **회수 판정·server-time 계약·PR-resume(`RESUME prNumber=...`) 신호·exit code 불변.**
- [ ] `scripts/lib-lock-tree.sh` 계약/env 를 상단 주석에 박제: 함수 시그니처, preserve-except regex 의미, blob 쌍 인자 형식, exit/return code(0/20/30), self-contained identity 이유(CI ubuntu empty ident), 빈 commit 가드 이유(브랜치 삭제 방지). source-only(직접 실행 아님) 명시.
- [ ] `scripts/lib-lock-tree.test.sh` 신설 — select-claim.test.sh bare-repo + 2 clone 골격 차용. 다음 R-112 4종 + negative 충분 cover:
  - [ ] **happy-path**(기능): 기존 claims.json + 다른 파일이 있는 tip 에서 `lock_tree_cas_push` 로 lock.json 만 교체 → tip tree 에 **claims.json 및 그 외 파일 byte-동일 보존**, lock.json 만 갱신(#588 회귀 가드 — 보존 깨지면 fail).
  - [ ] **error path**: `old_sha` 부재(빈 문자열) → zero-sha expect-absent lease 로 첫 생성 성공. parent 없는 commit.
  - [ ] **branch cover**: (a) 1 blob 교체(acquire) 경로, (b) 2 blob 교체(claim) 경로, (c) old_sha 존재 vs 부재 분기 각 1+.
  - [ ] **negative 충분 cover**(예외 분기마다 1+): (1) CAS lease mismatch(틀린 old_sha) → push reject(return 20), (2) 빈/누락 commit → push 차단(return 30, 브랜치 삭제 방지 — `git ls-remote` 로 ref 가 삭제 안 됨 확인), (3) preserve-except 가 교체 대상만 빼고 나머지 다 보존(여러 sibling 파일 1개라도 누락 시 fail), (4) 동시 호출 시 임시파일 충돌 없음(고유 경로 검증 — 같은 work 에서 2회 연속 호출이 서로 덮어쓰지 않음).
  - [ ] spec 의 branch-검증 매핑 주석(select-claim.test.sh line 11~17 동형)에 각 case ↔ 헬퍼 분기 매핑 명시. **헬퍼의 모든 분기(line·branch·function 의미상 ≥80%)가 case 로 cover.**
- [ ] `scripts/acquire-lock.test.sh`·`scripts/select-claim.test.sh`·`scripts/reclaim-stale-claim.test.sh` 가 **변경 후에도 전부 pass**(헬퍼 추출이 외부 동작을 바꾸지 않음 증명 — 회귀 가드). 필요 시 sourcing 경로만 조정.
- [ ] `.github/workflows/ci.yml` 에 `bash scripts/lib-lock-tree.test.sh` step 배선(T-0673 의 "acquire-lock claims 보존 검증" step 동형 — R-111/R-114: CI 미실행 test 는 회귀 가드 불가).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 확인 — src 변경 0 이어도 R-110 의무). `pnpm test:cov` 는 shell script 라 jest 대상 아님(본 변경 src 무관) — 다만 jest line/function ≥ 80% 임계가 기존 그대로 유지됨 확인.
- [ ] PR 본문에 "smoke/e2e 영향 없음(shell script only, src·web 무변경)" 명시.

## Out of Scope

- **acquire 와 select-claim 을 단일 CAS commit 으로 물리 통합**(lock 획득 + 첫 claim 을 한 commit) — 본 task 는 mutation **로직**을 공통 헬퍼로 추출해 단일 구현으로 만드는 것까지. acquire commit 과 claim commit 을 한 CAS 로 합치는 것은 driver loop(LOOP.md §1[2]) 호출 순서 재설계가 필요한 별도 slice(fix-2 slice 2). Follow-ups 에 박제.
- LOOP.md §1[1]·§1[2] prose 변경 — 본 task 는 script 내부 리팩터링이라 driver 호출 계약(어느 script 를 언제 부르는지)이 불변이므로 prose 갱신 불요. prose 가 헬퍼 내부 구현을 언급하지 않음.
- claims.json schema 변경. select-claim 의 claimed-set 제외 의미·reclaim 의 회수 판정 의미 변경.
- `verify-ref-cas-lock.sh`(옛 `refs/locks/driver` 검증 spec) 변경 — 별개 executable spec, lock 획득 경로 아님.
- STATE.json.lock human mirror 동기 로직 변경.

## Suggested Sub-agents

architect → implementer → tester

## Follow-ups

- **fix-2 slice 2(별도 task)**: acquire 와 첫 claim 을 단일 CAS critical-section commit 으로 물리 통합 가능한지 검토 — lock 획득 commit 과 claim+tombstone commit 사이 window 제거(ADR-0036 §Decision 1 "lock CAS 획득 → claim 박제 → tombstone 동반 release 를 같은 commit" 의 문자 그대로 구현). driver loop §1[2] 호출 순서 재설계 동반 시 cap 분할.
- **재-ON 결정 게이트**: fix-2 완결(slice 1+2 머지) 후 fineGrainedConcurrency 토글 정확성 게이트(이중 claim 0 + bookkeeping 충돌 0) 재검증 — 단 재활성 자체는 사람 결정(회로 차단기 자동 복구 금지, Q-0047 amendment).

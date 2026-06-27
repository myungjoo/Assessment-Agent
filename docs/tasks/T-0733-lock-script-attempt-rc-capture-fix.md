---
id: T-0733
title: select-claim·reclaim-stale-claim 의 attempt() rc-capture 버그 수정 + 실 CAS-race·재시도소진 회귀 가드
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-06-28
plannerNote: "P5 lock-infra correctness — sync-claim-pr.sh(T-0732) 가 고친 if-then rc=$? gotcha 가 select-claim/reclaim 형제 2 스크립트에 잔존(origin/main L136/L219), dup-PR 사고(T-0526/T-0672/T-0730) 와 동형 — split 1/2 (acquire-lock 검증은 follow-up); pr"
independentStream: concurrency-lock-script-rc-fix
dependsOn: []
touchesFiles:
  - scripts/select-claim.sh
  - scripts/reclaim-stale-claim.sh
  - scripts/select-claim.test.sh
  - scripts/reclaim-stale-claim.test.sh
---

# T-0733 — select-claim·reclaim-stale-claim 의 attempt() rc-capture 버그 수정 + 실 CAS-race·재시도소진 회귀 가드

## Why

T-0732(PR #648 squash d142fdf1) 가 신규 `scripts/sync-claim-pr.sh` 에서 고친 bash gotcha 가 **이미 머지돼 사용 중인 형제 lock 스크립트 2 개에 그대로 잔존**한다. `scripts/select-claim.sh`(origin/main L130-139)·`scripts/reclaim-stale-claim.sh`(origin/main L212-222) 의 `attempt()` 가 다음 패턴을 쓴다:

```
if lock_tree_cas_push ...; then
  ...; return 0
fi
rc=$?
return "$rc"
```

bash 의 `if cmd; then ...; fi` 는 **`else` 가 없으면 조건이 false 여도 compound 문 자체의 종료코드가 0** 이다. 따라서 직후 `rc=$?` 는 helper(`lock_tree_cas_push`)의 실제 return code(20=CAS-lose / 30=빈-commit 가드, `scripts/lib-lock-tree.sh` L52/L114)가 아니라 **항상 0** 을 캡처한다. 결과: 실제 CAS-lose race 에서 `attempt()` 가 20 대신 0(가짜 성공)을 반환 → main-loop 의 `20) i=$((i+1))` 재시도 분기와 재시도소진 `exit 1` 분기가 **도달 불가 dead code**. race-loser 가 빈 stdout 으로 exit 0 한 채 재시도·claimable 재평가를 안 하고 종료해, 문서화된 재시도/stand-down 계약이 깨진다. 원자적 `--force-with-lease` CAS 자체는 이중 push 를 막으므로 데이터 손상은 없으나(no data loss), retry semantics 가 망가져 과거 dup-PR / double-claim 사고(T-0526 / T-0672 / T-0730)를 가중했을 개연성이 있다.

본 task 는 T-0732 가 `sync-claim-pr.sh` 에서 적용한 **동일 fix**(helper 호출 직후 즉시 `rc=$?` 캡처 후 분기)를 이 2 개 형제 스크립트에 적용하고, 각 test 파일에 **pre-fix 코드에서는 FAIL / post-fix 에서는 PASS** 하는 진짜 CAS-race·재시도소진 회귀 가드를 추가한다.

CLAUDE.md §10 동시 실행 정책(ref-CAS lock·claim registry)·ADR-0036 §Decision 1/8 의 재시도/stand-down 계약 정합 직접 보강.

## Required Reading

- `scripts/sync-claim-pr.sh` — T-0732 가 적용한 **정답 패턴**. 특히 L164-184 (`rc=$?` 를 `lock_tree_cas_push` 호출 직후 즉시 캡처 후 `if [ "$rc" -eq 0 ]` 분기 → `return "$rc"`). L167-172 의 주석이 gotcha 를 설명한다.
- `scripts/sync-claim-pr.test.sh` — **회귀 가드 reference**. 특히 [T8] (L255~ : origin.git 서버측 update hook 으로 첫 push 만 거부 → CAS lose(20) → 재시도 분기에서 최종 성공) 과 [T12] (L341~ : hook 이 매 push 영구 거부 + 작은 `SYNC_RETRIES` → 재시도소진 → `exit 1` 분기 non-zero + "소진" 사유). 이 두 케이스가 본 task 가 각 형제 test 에 이식할 패턴이다.
- `scripts/select-claim.sh` — 버그 있는 `attempt()` (L130-139). main-loop case (L142-155: `20)` 재시도 / 소진 `exit 1`). exit code 의미: 0 성공 / 10 claimable 부재 / 20 CAS lose.
- `scripts/reclaim-stale-claim.sh` — 버그 있는 `attempt()` (L212-222). main-loop case (L225-241: `20)` 재시도 / 소진 `exit 1`). exit code 의미: 0 성공 / 5 대상부재 / 6 now 미주입 / 20 CAS lose.
- `scripts/select-claim.test.sh` — 회귀 가드를 추가할 대상.
- `scripts/reclaim-stale-claim.test.sh` — 회귀 가드를 추가할 대상.
- `scripts/lib-lock-tree.sh` — `lock_tree_cas_push` return code 정의 (0 성공 / 20 CAS lose / 30 빈 commit 가드). fix 가 보존해야 할 계약.

## Acceptance Criteria

- [ ] `scripts/select-claim.sh` 의 `attempt()`: `lock_tree_cas_push` 호출 직후 **즉시** `rc=$?` 를 캡처한 뒤 `if [ "$rc" -eq 0 ]` 로 분기하도록 수정(sync-claim-pr.sh L173-183 패턴). 성공 시 task id stdout + `return 0`, 그 외 `return "$rc"`. `if helper; then ...; fi` 뒤 `rc=$?` 패턴 제거.
- [ ] `scripts/reclaim-stale-claim.sh` 의 `attempt()`: 동일 fix 적용. 성공 시 resume_msg/reclaim_msg stdout 출력 후 `return 0`, 그 외 `return "$rc"`. RESUME/RECLAIM 신호·exit code 외부 의미(5/6/20)는 불변 보존.
- [ ] 두 스크립트 모두 기존 exit code 계약(select: 0/10/20, reclaim: 0/5/6/20) 과 stdout 신호(claimed task id / RESUME / RECLAIM) 외부 동작은 변경 0 — fix 는 race-lose 경로의 rc 전파만 바로잡는다.
- [ ] **Happy-path test**: 각 스크립트의 정상 claim/회수 성공 경로가 exit 0 + 올바른 stdout 신호를 내는지 검증하는 test 1+ (기존 happy-path test 유지·재확인 포함).
- [ ] **Error path test**: 각 스크립트의 비-race 실패/no-op 경로(select: claimable 부재 → exit non-zero; reclaim: 대상부재 exit 0 / now 미주입 exit 0)가 올바른 exit code + stderr 사유를 내는지 test 1+.
- [ ] **CAS-race 재시도 분기 회귀 가드 (각 test 파일 1+)**: sync-claim-pr.test.sh [T8] 처럼 origin.git 에 **서버측 update hook** 을 심어 lock ref 로의 **첫** push 만 1회 거부(CAS lose 20 시뮬레이션) → 둘째 시도 성공. 기대: 최종 exit 0 + 올바른 stdout 신호. **이 test 는 pre-fix 코드(rc=0 가짜 성공으로 첫 attempt 에서 곧장 exit 0, 재시도 미발생)에서는 FAIL** 하고 post-fix 에서는 PASS 해야 한다(진짜 회귀 가드).
- [ ] **재시도소진 분기 회귀 가드 (각 test 파일 1+)**: sync-claim-pr.test.sh [T12] 처럼 update hook 이 lock ref 로의 **모든** push 를 영구 거부 + 작은 `CLAIM_RETRIES`/`RECLAIM_RETRIES`=1 → 매 라운드 CAS lose(20) → 재시도소진 → main-loop `exit 1` 분기 non-zero exit + "소진" 사유 stderr. 추가로 소진까지 lock ref tip 불변·claim 상태 부분반영 0 검증. **pre-fix 에서는 FAIL(가짜 성공 exit 0 으로 소진 분기 미도달), post-fix 에서 PASS**.
- [ ] **Branch / negative cases 충분 cover**: 위 race-lose(20) 분기 외에 빈-commit 가드(30) 전파 경로(있으면 `*)` case 로 그대로 전파되는지), owner/대상 부재 등 각 분기에 test 분리. 단일 negative 만 작성 금지 — 예외 분기마다 cover.
- [ ] 각 신규 회귀 test 의 describe/it(또는 echo 라벨) 문자열에 "pre-fix 에서 FAIL / post-fix 에서 PASS" 의도를 한국어로 명시해 reviewer 가 진짜 회귀 가드임을 확인 가능.
- [ ] `bash scripts/select-claim.test.sh` 와 `bash scripts/reclaim-stale-claim.test.sh` 가 둘 다 통과(exit 0). CI 가 이 .test.sh 들을 실행한다면 그 step 도 green.
- [ ] `pnpm lint && pnpm build` 통과(스크립트 변경이 빌드에 영향 없음 확인). shell script test 라 jest coverageThreshold 직접 적용 대상은 아니나, 변경이 TS 커버리지에 영향 없음을 `pnpm test:cov` 로 재확인(line ≥ 80% / function ≥ 80% 유지).

## Out of Scope

- `scripts/acquire-lock.sh` 의 코드 수정 — 그 `attempt()`(L93-95)는 `lock_tree_cas_push` 호출을 함수의 **마지막 명령**으로 두어 종료코드가 자연 전파되므로 본 버그가 없다. acquire-lock 의 회귀 가드 보강(CAS-race·소진 test 가 없음)은 별도 follow-up task 로 분리(아래 Follow-ups 참조). 본 task 에서 건드리지 않는다.
- 새 `scripts/sync-claim-pr.sh` 추가 수정 — T-0732 에서 이미 fix 됨.
- claims.json schema 변경 / 새 exit code 도입 / driver loop·integrator·LOOP.md wiring 변경. 본 task 는 race-lose rc 전파 버그만 고친다.
- 새 의존성 추가, CI workflow 구조 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 후보) `scripts/acquire-lock.sh` 회귀 가드 보강 — attempt() 는 버그 없으나 select/reclaim/sync 와 달리 CAS-race(20)·재시도소진(exit 1) 회귀 가드 test 가 없다. sync-claim-pr.test.sh [T8]/[T12] 패턴을 `scripts/acquire-lock.test.sh` 에 이식하는 별도 pr task(split 2/2).

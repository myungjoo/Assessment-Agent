---
id: T-0734
title: acquire-lock retry-loop CAS-race·재시도소진 회귀 가드 보강 (T-0733 split 2/2)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 75
estimatedFiles: 1
created: 2026-06-28
plannerNote: P5 lock-infra; T-0733 split 2/2 — acquire-lock.sh 무버그지만 while-retry loop(20)재시도·exit1 소진)에 server-hook 구동 가드 0, sibling select-claim.test.sh [T5][T6] mirror
independentStream: concurrency-lock-script-rc-fix
dependsOn: []
touchesFiles: [scripts/acquire-lock.test.sh]
---

# T-0734 — acquire-lock retry-loop CAS-race·재시도소진 회귀 가드 보강 (T-0733 split 2/2)

## Why

T-0733 (PR #649, split 1/2) 이 `select-claim.sh` / `reclaim-stale-claim.sh` 의 `attempt()` rc-capture 버그를 고치면서, 두 sibling 의 test 에 **서버측 update-hook 으로 구동하는** 실 CAS-race-재시도 `[T5]` + 재시도소진 `[T6]` 회귀 가드를 이식했다. 그 split 1/2 의 plannerNote 는 "acquire-lock.sh 는 bare-helper-call attempt 라 무버그 → 회귀 가드 보강은 split 2/2 follow-up" 으로 본 task 를 예고했다.

`scripts/acquire-lock.sh` 의 `attempt()` (L99-100) 는 `lock_tree_cas_push` 를 bare statement 로 호출한 뒤 즉시 `rc=$?` 를 캡처하므로 **마스킹 버그가 없다** (확인 완료). 그러나 그 무버그를 **회귀로부터 보호하는 server-hook 구동 test 가 0** 이다 — `acquire-lock.test.sh` 의 `[T5]` 는 *직접* push 거부만 검증하고(B7 주석이 "패자 직접 push 거부로 cover" 라고 자인), script 자신의 `while [ "$i" -le "$RETRIES" ]` 재시도 loop (`20) i=$((i+1))` 재시도 분기 + 최종 `exit 1` 소진 분기) 를 실제로 구동하는 가드가 없다. 누군가 acquire-lock.sh 의 `attempt()` 를 sibling 처럼 `if helper; then exit 0; fi; rc=$?` 형태로 잘못 리팩터하면 현재 test suite 는 이를 잡지 못한다. 본 task 는 sibling `[T5]`/`[T6]` mirror 가드를 이식해 그 구멍을 닫는다 (CLAUDE.md §3.2 R-112 분기 cover, README 110-114).

## Required Reading

- `scripts/acquire-lock.sh` — 특히 L76-95 (`attempt()` — bare-call 후 즉시 rc 캡처, 무버그 패턴) + L97-109 (`while` 재시도 loop: `20)` 재시도 / `*) exit "$rc"` 전파 / 최종 `exit 1` 소진 분기).
- `scripts/acquire-lock.test.sh` — 기존 [T1]~[T7] 구조 + helper(`run_acquire`, `tip_holder`, `tip_claims_raw`, `cur_tip` L39-68). 특히 L131-148 [T5] (직접 push 거부 — 본 task 가 보강할 retry-loop 가드 부재 지점) + L150-164 [T6] 빈-commit 가드.
- `scripts/select-claim.test.sh` L166-247 — 이식할 **mirror 원본**: [T5] server-hook 첫 push 1회 거부 → `20)` 재시도 → 둘째 push hook 통과로 성공 / [T6] hook 영구 거부 + `CLAIM_RETRIES=1` → 매 라운드 CAS lose → 소진 `exit 1` + "소진" 사유 + ref tip 불변.
- `scripts/lib-lock-tree.sh` — `lock_tree_cas_push` 의 rc 의미 (0 성공 / 20 CAS lose / 30 빈-commit 가드). hook 거부가 어떤 rc 로 매핑되는지 확인용 (필요 시).

## Acceptance Criteria

- [ ] `acquire-lock.test.sh` 에 신규 **[T8] CAS-race 재시도 분기 회귀 가드** 추가: origin.git 에 server-side `update` hook 을 심어 lock ref 로의 **첫** push 1회만 거부(자기 무장 해제) → `attempt()` 가 CAS lose(20) 반환 → `while` loop 의 `20)` 분기에서 새 tip 재독 후 둘째 시도 → 최종 `exit 0` + lock holder 정확 박제(가짜 성공 아님) 검증. select-claim.test.sh [T5] mirror. (happy/branch — 재시도 분기 실구동)
- [ ] `acquire-lock.test.sh` 에 신규 **[T9] 재시도소진 분기 회귀 가드** 추가: server-side `update` hook 이 lock ref 로의 **모든** push 를 영구 거부 + `ACQUIRE_RETRIES=1` 주입 → 매 라운드 CAS lose(20) → 재시도소진 → 최종 `exit 1` (`grep -qF "소진"` 으로 사유 확인) + ref tip 끝까지 불변(부분 반영 0) 검증. select-claim.test.sh [T6] mirror. (error-path/negative — 소진 분기 실도달)
- [ ] 두 신규 case 는 **pre-fix 에서 FAIL → post-fix 에서 PASS** 하는 진짜 회귀 가드여야 한다 (만약 `attempt()` 가 sibling 의 옛 `if helper; then ... fi; rc=$?` 마스킹 패턴으로 리팩터되면 [T8] 은 "성공 보고했으나 holder 미반영", [T9] 는 "소진 분기 미도달 가짜 exit 0" 으로 FAIL). test 본문 주석에 이 의도 명시.
- [ ] hook 파일은 각 case 끝에서 `rm -f` 로 정리해 이후 [T1]~[T7] 및 다른 test 영향 0 (select-claim.test.sh L195 mirror). `mkdir -p "$WORK/origin.git/hooks"` 선행.
- [ ] 기존 [T1]~[T7] 7개 case 는 무수정 그대로 PASS 유지 (회귀 0). 본 task 는 **test-only 추가** — `acquire-lock.sh` production 코드는 1 LOC 도 건드리지 않는다.
- [ ] 분기 cover: [T8] = 재시도 성공 분기(`20)` → 다음 라운드 성공), [T9] = 소진 분기(`exit 1`) 를 각각 1+ case 로 cover. 기존 0)/20)/30)/소진 4 분기 중 retry-loop 의 2 미커버 분기(재시도 성공·소진)를 본 task 가 채운다.
- [ ] negative cases 충분 cover: [T9] 소진 시 (a) non-zero exit (b) "소진" 사유 stderr (c) ref tip 불변 3 조건 모두 assert. [T8] 도 (a) exit 0 (b) holder 정확 (c) hook 무장 해제 후 둘째 push 통과 검증.
- [ ] `bash scripts/acquire-lock.test.sh` 실행 → 전체 PASS (마지막 "acquire-lock 검증 통과 ..." 라인 갱신해 T8/T9 포함, exit 0).
- [ ] CI 에서 본 test 가 실행되는지 확인 — `pnpm lint && pnpm build && pnpm test` (또는 해당 shell-test runner step) green. (R-112: test:cov line ≥ 80% / function ≥ 80% 는 shell test-only 변경이라 TS coverage 영향 0 — 기존 threshold 유지 확인.)
- [ ] regression test 1+ (본 task 자체가 회귀 가드 보강이므로 [T8]/[T9] 가 곧 regression test — 결함(retry-loop dead-code화) 재발 시 fail).

## Out of Scope

- `acquire-lock.sh` production 코드 수정 (무버그 — 건드리지 않는다). 만약 작업 중 실 버그가 발견되면 즉시 고치지 말고 Follow-ups 에 적고 별도 patch task 큐잉 요청.
- `select-claim.test.sh` / `reclaim-stale-claim.test.sh` / `sync-claim-pr.test.sh` 재수정 (이미 T-0733/T-0732 완료).
- `lib-lock-tree.sh` / `lib-lock-tree.test.sh` 변경.
- LOOP.md / integrator wiring / STATE.json schema 변경.
- 새 hook 추상화 helper 추출 (각 case 안 inline hook 으로 충분 — sibling mirror 일관성 우선).

## Suggested Sub-agents

`implementer → tester` (test-only 변경 — architect 불요. tester 가 pre-fix FAIL 검증을 위해 임시로 attempt() 마스킹 패턴 주입→FAIL 확인→복원, 그리고 post-fix PASS 확인하는 절차 권장).

## Follow-ups

(없음 — 작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)

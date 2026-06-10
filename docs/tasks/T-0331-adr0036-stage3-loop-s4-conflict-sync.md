---
id: T-0331
title: LOOP.md §4 충돌 흡수·push 매칭에 ADR-0036 토글-gated claim/N-driver 경계 동기 (stage3 slice3)
phase: P5
status: DONE
completedAt: 2026-06-10T19:15:12+09:00
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-06-10
independentStream: adr0036-stage3
dependsOn: [T-0330]
touchesFiles: [docs/LOOP.md]
plannerNote: P5 ADR-0036 stage3 slice3 — LOOP §4 충돌 흡수·push 매칭에 토글-gated claim/N-driver 경계 sync(doc-only direct, dependency-free buildThrough)
---

# T-0331 — LOOP.md §4 충돌 흡수·push 매칭에 ADR-0036 토글-gated claim/N-driver 경계 동기 (stage3 slice3)

## Why

ADR-0036(fine-grained concurrency) rollout stage3 의 slice1(T-0329, LOOP §1[2] 토글-gated claim-pickup 분기)·slice2(T-0330, CLAUDE §10 N-driver 서술)가 머지됐다. 남은 slice3 은 LOOP.md §4 "Lock & 충돌 규약"의 **commit·push 충돌 흡수 경계와 push source/target 매칭 hard rule** 을 토글-gated claim/N-driver regime 으로 동기하는 것이다. 현재 §4 의 "Commit · Push 충돌 처리 (graceful 종료)" 와 "Push source/target 매칭 hard rule" 문단은 coarse single-driver("활성 driver 1개") 전제만 서술하며 ADR-0036 §Decision 2(merge 충돌 경계: bookkeeping 은 critical-section lock 직렬화, 코드 충돌은 파일-disjoint 큐잉 1차 방어 + 나중 머지 PR 의 `merge-conflict-code` 흡수)를 한 줄도 언급하지 않는다(본 task 작성 시 §4 영역 grep 결과 claim / fineGrainedConcurrency / ADR-0036 / N-driver / disjoint 매칭 0건). 이 stale narrative gap 을 닫는다. README 정책 REQ(long-horizon 자동화 동시성 규율, REQ-057/058) 정합 유지.

## Required Reading

- `docs/LOOP.md` §4 "Lock & 충돌 규약" 의 두 문단 — "### Commit · Push 충돌 처리 (graceful 종료)"(현재 L430~454 영역, 1~4 step + BLOCKER reason 카테고리 + "### Push source/target 매칭 hard rule" 1~3 hard rule + 사고 사례) — 동기 대상. 본문 의미·step 번호·hard rule 번호·사고 사례 전부 보존.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 2 "merge 충돌 경계"(bookkeeping = critical-section 직렬화 / 코드 충돌 = disjoint 큐잉 1차 + `merge-conflict-code` 흡수, 데이터 손상 0·throughput 만 상실) + §Decision 0 (파일-disjoint 동시 claimable 조건) + §rollout stage3 — source-of-truth.
- `docs/LOOP.md` §1[2] (T-0329 이 박제한 토글-gated claim-pickup 분기: lock-하 select+claim → 즉시 release → lock-free 진행) — §4 서술이 가리킬 loop-level 동작.
- `CLAUDE.md` §10 "### 동시 실행 정책 (race 회피)"(T-0330 이 sync 한 N-driver 서술) + `docs/STATE.json` `adr0036Rollout` 객체 (stage3 정의 + buildThrough + toggleGate stage5) — 서술 정합 참조.

## Acceptance Criteria

- [ ] LOOP.md §4 "Commit · Push 충돌 처리 (graceful 종료)" 문단에 ADR-0036 토글-gated 경계를 1 문단(또는 step 뒤 종속 문단)으로 추가: `flags.fineGrainedConcurrency=true` 일 때 (a) bookkeeping 충돌(STATE.json·journal·counters)은 lock(critical-section) 하에서만 write 되므로 직렬화로 안전(counters origin+1 read-modify-write 불변), (b) 코드 충돌(두 PR 이 같은 `src/`)은 lock 으로 못 막고 §Decision 0 파일-disjoint 동시 큐잉이 1차 방어이며 그래도 충돌 시 나중 머지 PR 이 기존 §4 rebase 단계의 `merge-conflict-code` BLOCKED 로 흡수(데이터 손상 0·throughput 만 상실) — 임을 명시. 기존 1~4 step graceful 종료 로직과 정합.
- [ ] LOOP.md §4 "Push source/target 매칭 hard rule" 이 claim/N-driver regime 에서도 불변임을 1 문장 명시: 각 driver 는 자기 claim 한 task 의 commitMode 에 따라 direct→main / pr→`claude/T-NNNN-<slug>` 로 push 하며 source≠target push 금지 hard rule 은 N-driver 동시 진행 시에도 진입점별로 그대로 강제(claim 이 push 매칭 규율을 완화하지 않음). 기존 hard rule 1~3 + 사고 사례 보존.
- [ ] 추가 서술이 LOOP.md §1[2](T-0329) + CLAUDE §10(T-0330) + ADR-0036 §Decision 0/§Decision 2/§rollout 와 정합 — 임의 새 정책 발명 0(기존 ADR/LOOP/CLAUDE 박제 사실만 요약·cross-reference). ADR-0036 §Decision 2 링크 1+ 포함.
- [ ] 토글 OFF 가 현 기본값이고 driver 동작 불변(forward-looking spec)임을 명시 — 본 doc-sync 가 충돌 흡수·push 매칭 행동을 바꾸지 않음을 분명히. 토글 OFF 시 기존 coarse single-driver 충돌 흡수 1:1 보존.
- [ ] 기존 §4 의 모든 step 번호·hard rule 번호·BLOCKER reason 카테고리(`merge-conflict-code`, `push-contention`, `wrong-source-branch` 등)·사고 사례·ADR-0028/0009/0034 cross-reference 의미 보존(중복·모순 introduce 0).
- [ ] 변경은 docs/LOOP.md 1파일만, doc-only direct commit (코드/CI/manifest 변경 0). diff ≤ 50 LOC.
- [ ] R-110/R-112 tester 면제 (doc-only direct commit, 코드 0 LOC — §3.2). lint/build/test 호출 불요.

## Out of Scope

- CLAUDE.md §10 (N-driver 동시실행 정책 서술 sync) — 이미 stage3 slice2(T-0330)에서 완료. 본 task 는 LOOP.md §4 만.
- LOOP.md §1[2] (claim-pickup 분기) / §4 lock 획득·해제 CAS 절차 / stand-down 규율 — 이미 박제 완료(slice1·ADR-0034 흡수). 본 task 는 §4 충돌 흡수 + push 매칭 두 문단만 동기.
- stage4 (per-PR CI concurrency group, `.github/workflows/` 변경 — commitMode pr) / stage5 (`flags.fineGrainedConcurrency` 토글 ON, 30일 dogfood).
- 실제 driver loop 충돌 흡수·push 동작 변경 (토글 OFF 유지, 본 task 는 서술 동기만).
- ADR-0036 본문 / §Status / §rollout 수정 (이미 ACCEPTED·박제 완료 — 본 task 는 LOOP §4 가 그것을 반영할 뿐).
- claims.json schema / select+claim·reclaim primitive 변경 (stage2 T-0327/T-0328 박제 완료).

## Suggested Sub-agents

implementer (doc-only edit — architect 불요, ADR-0036 §Decision 2 가 이미 source-of-truth).

## Follow-ups

(없음 — 작성 시점)

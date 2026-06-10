---
id: T-0330
title: CLAUDE.md §10 동시실행 정책에 ADR-0036 토글-gated N-driver 서술 동기 (stage3 slice2)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-10
independentStream: adr0036-stage3
dependsOn: [T-0329]
touchesFiles: [CLAUDE.md]
plannerNote: P5 ADR-0036 stage3 slice2 — CLAUDE §10 동시실행 정책에 토글-gated N-driver 경로 서술 sync(doc-only direct, dependency-free buildThrough)
---

# T-0330 — CLAUDE.md §10 동시실행 정책에 ADR-0036 토글-gated N-driver 서술 동기 (stage3 slice2)

## Why

ADR-0036(fine-grained concurrency) rollout stage3 slice1(T-0329)이 LOOP.md §1[2]에 토글-gated claim-pickup 분기 + reclaim server-time now 주입 계약을 박제하면서, driver loop 의 fine-grained 동작이 LOOP.md 에는 반영됐다. 그러나 CLAUDE.md §10 "동시 실행 정책 (race 회피)"의 서술은 여전히 coarse single-driver mutex("활성 driver 는 항상 1개")만을 설명하며 ADR-0036 의 토글-gated N-driver 경로(`flags.fineGrainedConcurrency` ON 시 N driver 가 각자 claim registry 로 task 를 소유, lock 은 critical-section 에서만 점유)를 한 줄도 언급하지 않는다(본 task 작성 시 grep 결과 ADR-0036 / fineGrainedConcurrency / claim registry 매칭 0건). 이는 stale narrative gap 으로, stage3 §rollout 의 "CLAUDE§10 동기" 항목이다. README 정책 REQ(long-horizon 자동화 동시성 규율, REQ-057/058)의 정합 유지.

## Required Reading

- `CLAUDE.md` §10 "Long-horizon 실행 모드" 의 "### 동시 실행 정책 (race 회피)" 절(현재 L335 부터, 규칙 1~5 + "규칙 2·3 권장" 마무리 문단) — 동기 대상.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 0 / §Status / §rollout — N-driver 토글-gated 경로 + stage 정의 + break-even gate 의 source-of-truth.
- `docs/LOOP.md` §1[2] (T-0329 이 박제한 토글-gated claim-pickup 분기 + reclaim server-time now 주입 계약) — CLAUDE §10 서술이 가리킬 loop-level 동작.
- `docs/STATE.json` 의 `adr0036Rollout` 객체 (stage3 정의 + buildThrough + toggleGate stage5) — 서술 정합 참조.

## Acceptance Criteria

- [ ] CLAUDE.md §10 "동시 실행 정책 (race 회피)" 절에 ADR-0036 토글-gated N-driver 경로를 1 문단(또는 규칙 1 에 종속 문단) 으로 추가: `flags.fineGrainedConcurrency=true` 일 때 N driver 가 각자 claim registry(claude/lock-driver tree claims.json)로 task 를 소유하고 lock 은 critical-section(claim 박제·STATE write)에서만 점유하는 fine-grained 경로 — 기존 "활성 driver 는 항상 1개"(coarse mutex)는 토글 OFF(현 기본값) 시의 동작으로 명확히 구분 표기.
- [ ] 추가 서술이 LOOP.md §1[2](T-0329) 및 ADR-0036 §Decision 0 / §rollout 와 정합 — 임의 새 정책 발명 0(기존 ADR/LOOP 박제 사실만 요약·cross-reference). ADR-0036 / LOOP.md §1[2] 링크 1+ 포함.
- [ ] 토글 OFF 가 현 기본값이고 driver 동작 불변(forward-looking spec)임을 명시 — 본 doc-sync 가 driver 행동을 바꾸지 않음을 분명히.
- [ ] 기존 규칙 1~5 + 권장 문단의 의미·번호 보존(중복·모순 introduce 0). ADR-0009/ADR-0028/ADR-0034 기존 cross-reference 유지.
- [ ] 변경은 CLAUDE.md 1파일만, doc-only direct commit (코드/CI/manifest 변경 0). diff ≤ 50 LOC.
- [ ] R-110/R-112 tester 면제 (doc-only direct commit, 코드 0 LOC — §3.2). lint/build/test 호출 불요.

## Out of Scope

- LOOP.md §4 (코드-충돌 흡수 경계 N-driver sync) — 이는 stage3 slice3 의 별도 task 책임. 본 task 는 CLAUDE §10 만.
- stage4 (per-PR CI concurrency group, `.github/workflows/` 변경 — commitMode pr) / stage5 (`flags.fineGrainedConcurrency` 토글 ON, 30일 dogfood).
- 실제 driver loop 동작 변경 (토글 OFF 유지, 본 task 는 서술 동기만).
- ADR-0036 본문 / §Status / §rollout 수정 (이미 ACCEPTED·박제 완료 — 본 task 는 CLAUDE §10 가 그것을 반영할 뿐).
- §2.5 multi-task fire 관련 서술 (별개 메커니즘, 혼동 금지).

## Suggested Sub-agents

implementer (doc-only edit — architect 불요, ADR-0036 가 이미 source-of-truth).

## Follow-ups

(없음 — 작성 시점)

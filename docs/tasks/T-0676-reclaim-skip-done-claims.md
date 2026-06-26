---
id: T-0676
title: reclaim-stale-claim 이 status=DONE claim 을 prune 처리(spurious RESUME 차단)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-06-26
dependsOn: []
independentStream: lock-acquire-fix
touchesFiles:
  - scripts/reclaim-stale-claim.sh
  - scripts/reclaim-stale-claim.test.sh
plannerNote: "P5 동시성 정합 — reclaim 이 status=DONE stale claim 을 RESUME 대신 prune. T-0674 13:00 사고(merged PR #589 에 spurious RESUME) follow-up. single-helper test × 1.0."
---

# T-0676 — reclaim-stale-claim 이 status=DONE claim 을 prune 처리

## Why

T-0674 실행 turn(2026-06-26 13:00 driver journal)에서 `scripts/reclaim-stale-claim.sh` 가 **이미 merge·정리 완료된 T-0673 claim**(`status: DONE`, `prNumber: 589`, claimedAt 70분 경과)을 stale 로 보고 `RESUME prNumber=589` 신호를 spurious emit 했다. 그 turn 은 PR #589 가 이미 MERGED 임을 driver 가 별도로 확인해 RESUME 을 무시했기에 무해했으나, **latent 버그**다: reclaim 이 entry 의 `status` 필드를 전혀 읽지 않아, 60분 지난 DONE claim 이 `prNumber` 를 가지면 branch (2)(PR-resume)로 빠져 merged PR 에 대한 resume 신호를 낸다. 이는 ADR-0034/#588 이 차단하려는 "중복 PR 작업" 메커니즘과 정확히 같은 류의 오작동 표면이다.

본 task 는 reclaim 의 staleness 분류에 **status=DONE skip(prune)** 가드를 추가해, 종료된 claim 은 RESUME 후보가 아니라 **단순 제거(prune) 후보**로 처리한다. CLAUDE.md §10 동시 실행 정책 + ADR-0036 §Decision 1/5(orphan 회수) 정합. fix-2 slice(T-0673~T-0675)로 닫힌 claims.json 보존 라인의 인접 정합 보강이며, lock-acquire-fix stream 의 마무리 한 조각이다.

## Required Reading

- `scripts/reclaim-stale-claim.sh` — 특히 `field()` 헬퍼와 staleness 분류 while 루프(entry 당 `taskId`/`claimedAt`/`prNumber` 추출 → is_stale 판정 → prNumber 분기). 여기에 `status` 추출 + DONE-skip 분기를 추가한다.
- `scripts/reclaim-stale-claim.test.sh` — `seed_claims` / `run_test` 헬퍼와 기존 test 케이스 구조(CLAIMED/PR_OPEN/IN_PROGRESS status 를 가진 claim seed). 신규 DONE 케이스를 동형으로 추가.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 1(orphan claim staleness·PR-resume 우선) + §Decision 5(server-time now 주입) — 회수 분류 규칙의 권위 정의. DONE-prune 이 §Decision 1 의 "prNumber 보유 claim 은 resume" 규칙의 정당한 예외(종료된 PR 은 resume 대상 아님)임을 확인.
- `docs/architecture/concurrency.md` §5(reclaim 운영 view) — DONE-skip 가 운영 view 와 모순 없는지 확인(필요 시 본 task 범위 밖 doc-sync 는 Follow-ups).

## Acceptance Criteria

- [ ] `scripts/reclaim-stale-claim.sh` 의 staleness 분류 루프가 각 entry 의 `status` 필드를 추출하고(`field "$entry" status`), `status` 가 `DONE`(merged 동의어 포함 — 현 claims 표기는 `DONE`)인 stale claim 은 **prNumber 유무와 무관하게 prune(제거) 처리**한다(RESUME 신호 미발생, kept 배열에 미포함, `RECLAIM taskId=<T>` 신호 또는 `PRUNE`-동의어 신호 1줄). 살아있는(임계 이내) DONE claim 은 기존대로 보존(stale 인 경우에만 prune — 종료됐어도 임계 이내면 보수적으로 둔다, finalize 경로가 정리).
- [ ] DONE 이 아닌 stale claim(CLAIMED/PR_OPEN/IN_PROGRESS 등)의 기존 분기(prNumber null → prune, prNumber non-null → RESUME)는 **byte-동작 불변**. 즉 status 가드는 DONE 에만 적용되고 그 외 status 의 회수/resume 경로를 바꾸지 않는다.
- [ ] **Happy-path test**: stale + `status: DONE` + `prNumber: 589` claim seed → reclaim 실행 시 RESUME 미발생, 해당 entry 가 claims.json 에서 제거됨(prune), exit 0. (T-0674 13:00 사고의 직접 재현·회귀 가드.)
- [ ] **Error/negative test 1 — DONE skip 이 RESUME 을 누르는지**: stale DONE + prNumber non-null 인데 stdout 에 `RESUME` 문자열이 나오지 않음을 명시 assert(현 버그면 RESUME 이 나와 fail — 본 fix 후 pass).
- [ ] **Branch test — status 분기 분리**: 같은 claims 배열 안에 (a) stale DONE+prNumber, (b) stale PR_OPEN+prNumber, (c) stale CLAIMED+prNumber null, (d) live IN_PROGRESS 4 entry 를 한 배열로 seed → (a) prune, (b) RESUME 발생+entry 유지+owner 교체, (c) prune, (d) 보존. 각 분기 1+ assert.
- [ ] **Negative cases 충분 cover**: (1) stale DONE+prNumber null(이미 prune 대상이었던 경로 — status 가드 추가 후에도 prune 유지), (2) live(임계 이내) DONE+prNumber(보존 — stale 아니므로 손대지 않음), (3) `status` 필드 누락 claim(레거시 — DONE 아님으로 간주, 기존 prNumber 분기 그대로 — 보수적), (4) 빈 claims 배열(no-op exit 0) 각 1+ test.
- [ ] **Regression test 1+** (본 task 는 13:00 사고의 latent 버그 fix — frontmatter hqOrigin 은 없으나 사실상 patch): merged-DONE claim(T-0673-shape: `status: DONE`, `prNumber: 589`, 70분 경과)에 대해 RESUME 이 emit 되지 않음을 검증하는 case 1+. 결함 재발 시 fail.
- [ ] `bash scripts/reclaim-stale-claim.test.sh` 전 케이스 pass(기존 63 케이스 회귀 무영향 + 신규 케이스 추가).
- [ ] `.github/workflows/ci.yml` 에 reclaim-stale-claim.test.sh 가 이미 CI step 으로 배선돼 있는지 확인 — 미배선이면 본 PR 에서 배선 추가(R-111/R-114: CI 미실행 test 는 회귀 가드 불가). 이미 배선됐으면 이 항목 충족.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 단 본 task 는 bash script 변경이라 jest coverage 대상이 아닐 수 있음; src/web/test 무변경이면 기존 jest suite green 유지(329 suite)로 갈음하고 본 항목은 "src coverage 회귀 0" 로 해석.

## Out of Scope

- `select-claim.sh`·`acquire-lock.sh` 변경(이미 fix-2 로 헬퍼 라우팅 완료 — 본 task 는 reclaim 분류 로직만).
- `lib-lock-tree.sh` 헬퍼 변경(tree-보존 CAS plumbing 은 불변 — 본 task 는 분류 단계의 status 판정만 추가, push 경로는 그대로).
- driver loop(LOOP.md §1[2])의 reclaim 호출 시점·RESUME 소비 로직 변경(stage 3 책임 — 본 slice 는 script 내부 분류만).
- `status` enum 값 정규화/스키마 변경(claims.json status 표기 통일은 별도 follow-up).
- ADR-0036 / concurrency.md 본문 갱신(필요 시 Follow-ups 로 direct doc-sync task 분리 — 본 task 는 pr 코드만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

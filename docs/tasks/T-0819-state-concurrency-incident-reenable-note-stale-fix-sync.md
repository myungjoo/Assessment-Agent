---
id: T-0819
title: STATE concurrencyIncidents.reenableNote 의 'fix 미머지' stale prose 교정 (fix-1/fix-2 머지 확인 반영)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 4
estimatedFiles: 1
independentStream: state-bookkeeping-sync
dependsOn: []
touchesFiles: [docs/STATE.json]
created: 2026-07-08
plannerNote: T-0818 Follow-up — concurrencyIncidents.reenableNote 'fix 미머지' prose 는 T-0674(PR#590)+T-0732 머지로 stale; direct STATE-only 교정
---

# T-0819 — STATE concurrencyIncidents.reenableNote 의 'fix 미머지' stale prose 교정

## Why

T-0818 완료 journal 이 non-blocking follow-up 으로 명시한 STATE-sync 작업이다: `docs/STATE.json` 의 `concurrencyIncidents.reenableNote` prose 가 "**주의: 근본 원인(lock-acquire 경로 claims.json 미보존) fix 아직 미머지** — 재발 risk 인지·수용" 및 "fix-1 머지 후 재발 risk 해소" 라고 서술하지만, 해당 fix 는 이미 origin/main 에 머지됐다. T-0674(PR #590, commit 0823d307) 가 `scripts/lib-lock-tree.sh` 공통 헬퍼(`lock_tree_cas_push`)를 추출해 **모든 lock-acquire 경로(acquire-lock.sh·select-claim.sh)가 ls-tree base 로 claims.json 을 보존**하도록 라우팅했고(= fix-1/fix-2), T-0675(PR #591)가 reclaim 경로도 같은 헬퍼로 라우팅, T-0732 가 PR-open 직후 claim 의 prNumber sync primitive(3회차 T-0730 근본 원인)를 닫았다. 따라서 "미머지" prose 는 stale 이며, 미래 incident triage 를 오도(fix 미존재로 오인 → 불필요한 재큐잉 risk)한다. 이 stale prose 를 "머지 완료" 사실로 교정한다. STATE-only 변경이므로 `commitMode: direct`.

## Required Reading

- `docs/STATE.json` — `concurrencyIncidents` object (특히 `reenableNote` 필드 전문 + `note` 필드의 3회차 fix 방향 서술). 파일이 크므로 `grep -n reenableNote docs/STATE.json` 으로 해당 라인만 국소 read.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 8 (d) 회로 차단기 + §Decision 1 (claims.json 보존 불변) — 교정 문구가 ADR 권위 정의와 정합하는지 확인용 (필요 시 §Decision 8 근처만).

## Acceptance Criteria

- [ ] `docs/STATE.json` 의 `concurrencyIncidents.reenableNote` 에서 "**근본 원인(lock-acquire 경로 claims.json 미보존) fix 아직 미머지** — 재발 risk 인지·수용" 및 "fix-1 머지 후 재발 risk 해소" 취지의 stale 문장을, **fix 머지 완료 사실**로 교정한다. 교정 문구에 근거 task/PR 을 명시: fix-1/fix-2 = T-0674(PR #590, `lib-lock-tree.sh` 공통 헬퍼로 acquire/select 라우팅해 claims.json ls-tree base 보존) + T-0675(PR #591, reclaim 라우팅) 머지 완료, 3회차 prNumber sync = T-0732 머지 완료. "재발 risk 해소됨(2026-07-08 확인)" 취지로 마무리.
- [ ] `reenabledAt`/`reenabledBy` 및 forensic root-cause 서술(be74f97 tree 분석 등 사실 기록)은 **변경하지 않는다** — 과거 사실 기록은 보존, "미머지→머지" 상태 문구만 교정.
- [ ] `concurrencyIncidents` 의 카운터 필드(`double-claim`/`merge-conflict-code`/`reclaim-misfire`/`ci-cost-overrun`) 및 `flags` 는 **변경하지 않는다**.
- [ ] 편집 후 `node -e "require('./docs/STATE.json')"` 가 에러 없이 통과(valid JSON) — STATE.json Edit 후 object boundary 손상 없음 검증(MEMORY: state-json-edit-validate).
- [ ] diff 는 `concurrencyIncidents.reenableNote`(및 필요 시 `note` 필드의 동일 stale 취지 문장) 국한 — 다른 STATE 필드 무손상. 변경 파일 1개(`docs/STATE.json`).
- [ ] 분기 없음 — 순수 문자열 교정 direct doc-only STATE-sync 이므로 R-110/R-112 test 항목 면제(코드 0 LOC). 본 항목 명시로 test 4종 생략 근거 박제.

## Out of Scope

- `scripts/lib-lock-tree.sh`·`select-claim.sh`·`acquire-lock.sh`·`reclaim-stale-claim.sh` 등 실제 스크립트 코드 변경 (fix 는 이미 머지됨 — 본 task 는 prose 정합만).
- 회로 차단기 카운터 리셋·`flags.fineGrainedConcurrency`/`maxConcurrentClaims` 토글 변경.
- `note` 필드의 1·2·3회차 forensic 사실 기록 재작성 (사실 보존; 단 `note` 안에 "fix 미머지/planner 최우선 큐잉 권장" 같은 stale 액션-필요 문구가 있으면 그 문장만 "T-0674/0675/0732 머지 완료" 로 정합 — 사실 서술은 유지).
- 새 ADR 작성·PLAN.md 변경·다른 phase drift 교정.

## Suggested Sub-agents

없음 — driver 직접 처리(direct doc-only STATE-sync, code/test 0). executor/tester 불요.

## Follow-ups

(비어 있음)

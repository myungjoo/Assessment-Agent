---
id: T-0808
title: 미배선 dead helper computeOverwriteReevalPlan + spec 제거 (ADR-0053 SUPERSEDED 정리)
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-07-07T12:47:00Z
prNumber: 721
mergeCommit: 56477500
coversReq: [REQ-037, REQ-040, REQ-041, REQ-045, REQ-064]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-07-07
dependsOn: [T-0807]
independentStream: gate5-adr0053-cleanup
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts
  - src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.spec.ts
plannerNote: "P5 gate5 cleanup slice2 (T-0807 §Follow-ups) — ADR-0053 SUPERSEDED 로 unwired 된 helper+spec dead code 제거. estimate: single-helper × 1.0(순삭제)."
---

# T-0808 — 미배선 dead helper computeOverwriteReevalPlan + spec 제거 (ADR-0053 SUPERSEDED 정리)

## Why

[T-0807 §Follow-ups](T-0807-adr-0053-superseded-by-adr-0038.md)(gate5 cleanup slice2, pr)가 이관한 dead code 를 제거한다. overwrite/재평가 mechanism 은 [ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED)이 이미 완결한 canonical 설계이고 그 구현 chain(T-0333~T-0337)이 main 에 안착·e2e 검증됐다. [ADR-0053](../decisions/ADR-0053-overwrite-reeval-mechanism.md)은 그 중복 재결정으로 T-0807 에서 **SUPERSEDED**(supersededBy: ADR-0038) 표기됐다. 따라서 ADR-0053 slice1 으로 T-0805 가 추가한 순수 helper `computeOverwriteReevalPlan`(+ `REEVAL_MODES` / `OverwriteReevalPlan` 타입)와 그 colocated spec 은 **어디에서도 import 되지 않는 unwired dead code** 다 — orchestration 은 ADR-0038 chain 의 자체 inline 분기로 동작한다. grep 재확인 결과 두 심볼의 import 처는 자기 spec 파일 하나뿐이므로, 두 파일을 통째로 제거해 canonical source(ADR-0038 chain)만 남긴다. 제거는 `src/` 변경이라 `commitMode: pr`(§3.1 rule).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts` — 제거 대상 helper(`computeOverwriteReevalPlan` + `REEVAL_MODES` + `OverwriteReevalPlan` 타입). 이 파일이 export 하는 심볼이 프로덕션 코드 어디에서도 참조되지 않음을 다시 확인
- `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.spec.ts` — colocated spec(제거 대상). 위 helper 만 import
- `docs/tasks/T-0807-adr-0053-superseded-by-adr-0038.md` §Follow-ups(57행) — 본 task 의 트리거·근거·제거 방침(dead code → 파일 통삭)
- `docs/decisions/ADR-0053-overwrite-reeval-mechanism.md`(frontmatter + 상단 blockquote만) — SUPERSEDED 확인. canonical=ADR-0038

## Acceptance Criteria

두 파일만 제거한다(그 외 파일 변경 0). production 참조가 0 인 dead code 이므로 삭제로 인한 회귀 표면이 없어야 한다.

- [ ] 제거 직전 `git grep -n "computeOverwriteReevalPlan\|REEVAL_MODES\|OverwriteReevalPlan\|evaluation-overwrite-reeval-plan"` 를 `src/`(spec 제외) 범위로 실행해 **자기 파일 2개 외 참조가 0** 임을 재확인(참조가 있으면 dead 가 아니므로 BLOCKED 또는 Follow-up 재판정).
- [ ] `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts` 삭제.
- [ ] `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.spec.ts` 삭제.
- [ ] `pnpm build` 통과 — dangling import / 미해결 심볼 0(제거된 심볼을 참조하는 프로덕션 코드 없음 검증).
- [ ] `pnpm lint` 통과 — unused import / no-unused-vars 등 잔여 lint 0.
- [ ] `pnpm test` 통과 — 나머지 suite 전량 green(제거된 spec 만 사라지고 다른 spec 은 영향 0).
- [ ] `pnpm test:cov` 통과 — 전역 coverage `line ≥ 80% AND function ≥ 80%` 유지. dead 파일+spec 이 동시에 사라지므로 분모/분자에서 함께 빠져 전역 임계는 유지돼야 함(혹시 임계 저하 시 원인 규명 후 보고 — 다른 파일 coverage 는 불변이어야 정상).
- [ ] `scripts/check-spec-presence.sh`(있는 경우) 통과 — 남은 `src/` 파일마다 colocated spec 존재 규칙 위배 0(helper+spec 을 쌍으로 제거하므로 orphan src / orphan spec 발생 안 함).

### R-112 적용 메모 (dead code 순삭제 특례)

본 task 는 **public symbol 추가/수정이 0** 인 순수 dead-code 제거다. R-112 의 happy/error/branch/negative 신규 test 작성 항목은 "새로 추가·수정된 symbol" 을 전제하므로 본 task 에는 신규 test 없음 — 대신 위 `pnpm test`/`pnpm test:cov` green 유지가 회귀 게이트다. 삭제로 인해 다른 코드의 분기/coverage 가 변하지 않음(참조 0)을 build+test+cov 3종으로 검증한다. **분기 없음·신규 symbol 없음 — R-112 신규 test 작성 항목은 본 task 에 해당 없음**을 PR 본문에 명시할 것.

## Out of Scope

- **ADR-0053 / ADR-0038 본문 수정** — status 표기는 T-0807 에서 완료. 본 task 는 코드 파일만 제거, ADR 는 건드리지 않는다.
- **`EvaluationPersistContext` / `evaluation-result.persist.mapper` 수정** — helper 가 import 하던 타입 원본은 다른 곳에서 계속 쓰이므로 그대로 둔다(helper 파일만 삭제).
- **orchestration 에 helper 를 배선(wire)하는 대안** — canonical 은 ADR-0038 chain 이므로 outsource 실익 없음(T-0807 §Follow-ups 판정). 제거로 확정. 만약 reviewer/오너가 배선 실익을 새로 제기하면 **별도 신규 task**(R-112 배선 test 동반)로 재큐잉 — 본 task 에서 되살리지 않는다.
- **STATE / PLAN / counters 갱신** — driver bookkeeping direct commit 소관.
- **다른 domain 파일의 dead code 정리** — 발견 시 Follow-ups 에만 적고 본 task 에서 손대지 않는다(cap 보호).

## Suggested Sub-agents

`implementer → tester` (파일 2개 삭제 + build/lint/test/cov green 확인. architect 불요 — 결정은 ADR-0038/ADR-0053/T-0807 에서 완결)

## Follow-ups

(없음 — dead-code 순삭제 완결. gate5 cleanup slice1(T-0807 ADR-0053 SUPERSEDED)+slice2(본 task 파일 제거) 로 overwrite/재평가 canonical source 가 ADR-0038 chain 하나로 수렴.)

## Result (DONE)

PR [#721](https://github.com/myungjoo/Assessment-Agent/pull/721) round1 reviewer APPROVE(0 BLOCKER/0 MAJOR/0 MINOR) + 4-게이트 PASS → squash merge `56477500` --delete-branch. `evaluation-overwrite-reeval-plan.ts` + `.spec.ts` 2파일 통삭(-668 raw), production src 무변경. 제거 직전 `git grep` src/ 재확인 참조 자기 파일 2개뿐(dead 확정). build/lint/test(355 suites/9042 tests green)/cov(line 99.95%·func 100%·branch 99.25%, 임계 line≥80%∧func≥80% 유지)/check-spec-presence 통과. R-112 신규 test 는 순수 dead-code 제거라 해당 없음(green suite 가 회귀 게이트).

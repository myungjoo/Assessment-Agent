---
id: T-0807
title: ADR-0053(overwrite/재평가)를 선행 ADR-0038 의 중복 재결정으로 SUPERSEDED 표기
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-037, REQ-040, REQ-041, REQ-045, REQ-064]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-07
dependsOn: []
independentStream: gate5-adr0053-cleanup
touchesFiles:
  - docs/decisions/ADR-0053-overwrite-reeval-mechanism.md
plannerNote: "P5 gate5 cleanup (T-0806 Follow-up) — ADR-0053 은 선행 ADR-0038 의 중복 재결정. status 를 SUPERSEDED 로 flip(§3.1 rule4 direct). helper 제거는 후속 pr task."
---

# T-0807 — ADR-0053(overwrite/재평가)를 선행 ADR-0038 의 중복 재결정으로 SUPERSEDED 표기

## Why

[T-0806 §Follow-ups](T-0806-realdata-e2e-github-collection-live-smoke.md)(gate 5 cleanup, non-blocking)가 캐처한 중복 재결정을 정리한다. overwrite / 이미 영속화된 평가문 재평가 mechanism 은 **[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED, 2026-06-10)** 이 이미 완결한 설계다 — Admin 명시 재평가 요청 contract(period bridge DTO `reevaluate?` flag) + ADR-0033 `reeval` PersistMode(reset-and-recreate) 재사용 + ADR-0037 §Decision3 first-write-wins 의 명시 opt-out + RBAC Admin + idempotency 경계까지 박제됐고, 그 구현 chain(T-0333~T-0337)이 main 에 안착·e2e 검증됐다. [ADR-0053](../decisions/ADR-0053-overwrite-reeval-mechanism.md)(T-0804, 2026-07-07)은 오너의 Q-0051 옵션5(PLAN line107 DEFERRED 해제) 지시를 받아 ADR-first 로 작성됐으나 **선행 ADR-0038 을 0회 참조한 채 동일 mechanism(명시 mode flag 시에만 reset-and-recreate, 무플래그 default 는 first-write-wins 보존)을 재결정**했다. 두 ADR 이 같은 결정을 이중 박제한 상태이므로, 나중 ADR-0053 을 `SUPERSEDED`(supersededBy: ADR-0038)로 표기해 canonical source 를 ADR-0038 하나로 수렴시킨다. 본 task 는 ADR frontmatter status flip + Context 한 줄 박제만 — production code / helper 는 건드리지 않는다(후속 pr task).

## Required Reading

- `docs/decisions/ADR-0053-overwrite-reeval-mechanism.md` — status flip 대상. frontmatter `status: ACCEPTED`(4행), `supersedes`/`supersedesDecision`/`augments`(8~10행), 상단 blockquote(15행)
- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` (frontmatter + 상단 blockquote 만) — 선행·canonical 결정. 본 task 가 `supersededBy` 로 가리킬 대상. status ACCEPTED / 동일 mechanism(reeval reset-and-recreate 재사용) 확인
- `docs/tasks/T-0806-realdata-e2e-github-collection-live-smoke.md` §Follow-ups(70행 gate5 cleanup) — 본 task 의 트리거·근거·split 방침(ADR flip=direct, helper 제거=pr)

## Acceptance Criteria

`docs/decisions/ADR-0053-overwrite-reeval-mechanism.md` 만 수정한다(1 파일). 다른 파일 변경 0.

- [x] ADR-0053 frontmatter `status:` 를 `ACCEPTED` → `SUPERSEDED` 로 변경.
- [x] ADR-0053 frontmatter 에 `supersededBy: ADR-0038` 필드 추가(기존 `supersedes: null` 아래 또는 인접).
- [x] ADR-0053 상단 blockquote(15행 부근) 또는 Context 최상단에 **한국어 한~두 줄** 로 "본 ADR 은 선행 [ADR-0038](ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED, 2026-06-10)의 동일 mechanism 을 중복 재결정한 것으로 확인돼 **SUPERSEDED** 됨 — canonical source 는 ADR-0038. 구현(T-0333~T-0337)은 이미 main 안착·e2e 검증. (T-0806 §Follow-ups gate5 cleanup 발견)" 취지를 명시. 기존 본문 결정 내용은 삭제하지 말고 상단 표기만 추가(history 보존).
- [x] ADR-0038 을 상호 참조하도록 링크 경로가 정확한지 확인(`ADR-0038-overwrite-reevaluate-persisted-assessment.md`).
- [x] 파일 내 markdown link 문법·frontmatter YAML 문법이 깨지지 않았는지 육안 확인(status enum 은 영어 `SUPERSEDED` 유지 — §12).

## Result

**DONE (2026-07-07T10:40Z, cron@aa-local-s1-aa44b96d1cbe fire).** ADR-0053 frontmatter `status: ACCEPTED → SUPERSEDED` + `supersededBy: ADR-0038` 추가 + 상단 blockquote 에 canonical=ADR-0038(구현 T-0333~T-0337 안착·e2e 검증) 중복 재결정 SUPERSEDED 표기 1줄(기존 결정 본문 history 보존). 1 파일 direct doc-only(+4/-1). helper 제거(slice2, pr)는 §Follow-ups 로 이관.

## Out of Scope

- **helper dead code 제거/배선** — `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts`(T-0805 `computeOverwriteReevalPlan`) 및 그 spec 은 어디에서도 호출되지 않는 unwired dead code 지만, 이는 `src/` 변경이라 **별도 pr task**(§3.1 rule 3 split). 본 task 는 건드리지 않는다 — Follow-ups 에 이관.
- **ADR-0038 본문 수정** — canonical source 는 그대로. 본 task 는 ADR-0053 만 표기.
- **PLAN.md line107 / STATE 갱신** — driver 의 bookkeeping direct commit 소관. 본 task 파일은 ADR 표기만.
- **T-0804/T-0805 task 파일 status 재조정** — 이미 DONE 인 두 task 의 회고 표기는 불필요(history 보존, ADR 표기로 충분).

## Suggested Sub-agents

`implementer` (direct doc-only — code 없음, tester 불요. driver 가 direct commit 으로 처리)

## Follow-ups

- **(gate 5 cleanup slice 2, pr)** — `src/assessment-evaluation/domain/evaluation-overwrite-reeval-plan.ts`(T-0805 `computeOverwriteReevalPlan` 순수 helper) + colocated `.spec.ts` 는 orchestration 이 자체 inline 분기(ADR-0038 chain)로 동작하므로 **어디에서도 import 되지 않는 dead code**(grep 확인: import 처는 자기 spec 뿐). → 별도 pr task 로 helper + spec 파일 제거. 제거 시 `pnpm build`/`pnpm test:cov` green 유지(dead code 라 참조 0, 회귀 위험 낮음). 만약 reviewer/오너가 "다중 좌표 partial-reset plan outsource" 실익을 인정하면 제거 대신 orchestration 에 wire — 그 경우 R-112 배선 test 동반. planner 가 T-0807 merge 후 큐잉.

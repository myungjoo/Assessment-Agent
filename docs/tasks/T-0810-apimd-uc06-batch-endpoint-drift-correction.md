---
id: T-0810
title: api.md UC-06 batch endpoint 4행을 implemented-on-main 대체 route 로 drift 교정
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-037, REQ-040, REQ-041]
estimatedDiff: 8
estimatedFiles: 1
independentStream: p5-doc-drift-apimd
dependsOn: []
touchesFiles: [docs/architecture/api.md]
created: 2026-07-07
plannerNote: P5 pipeline drift — api.md /api/assessments batch 4행 '미구현 P5 예정'이나 REQ 는 alternate route 로 shipped, T-0809 PLAN drift 패턴 mirror
---

# T-0810 — api.md UC-06 batch endpoint 4행을 implemented-on-main 대체 route 로 drift 교정

## Why

[docs/architecture/api.md](../architecture/api.md) 의 `/api/assessments` batch 4행(L95~98: `POST /run`·bulk `DELETE`·`POST /reeval`·`POST /reset`)이 **"미구현, P5 evaluation pipeline 에서 도입 예정 (UC-06 batch)"** 로 표기돼 있으나, 그 4행이 cover 하는 REQ-037/040/041 은 P5 pipeline 에서 **다른 route 로 이미 shipped** 됐다. api.md 는 stale — 결코 build 되지 않을 `/api/assessments/*` batch path 를 "예정" 으로 가리킨다. 이는 [T-0809](T-0809-plan-p5-detection-checkbox-sync.md) 가 PLAN.md P5 checkbox↔shipped-code drift 를 교정한 것과 동형 패턴을 api.md 에 적용하는 것이며, 미래 planner 가 이 never-built endpoint 를 make-work 로 재큐잉하는 risk 를 차단한다.

shipped 대체 route(전부 main 실존 확인):
- **REQ-040 manual trigger** → `POST /api/assessment-collection/collect`(T-0271~T-0275, ADR-0031) + `POST /api/assessment-evaluation/period`(api.md L103 기박제).
- **REQ-041 최근 N일 bulk delete→재수집** → `POST /api/schedules/recent-deletion/:personId`([src/scheduling/recent-deletion.controller.ts](../../src/scheduling/recent-deletion.controller.ts) L96, T-0428 PR #346, api.md 합계행 L142 기박제).
- **REQ-037 reeval / reset&reeval** → `POST /api/assessment-evaluation/period` `reevaluate` flag(ADR-0038 §Decision1~5, api.md L103 기박제) + `POST /api/assessment-evaluation/unevaluated-fill-run`(T-0565, 평가 없는 부분 일괄 평가).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) L93~103(교정 대상 4행 + 이미 박제된 대체 route 행), L142(합계행의 `/api/assessments batch 4건 … deferred` 서술).
- [docs/tasks/T-0809-plan-p5-detection-checkbox-sync.md](T-0809-plan-p5-detection-checkbox-sync.md)(drift-correction 패턴 precedent — append-only, 기존 REQ 참조·설명 보존).
- [docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) §Decision1~5(REQ-037 reeval/reset 이 `reevaluate` flag 로 shipped 된 근거).

## Acceptance Criteria

- [ ] api.md L95~98 의 4행 마지막 컬럼에서 **"미구현, P5 … 예정"** 서술을 **"implemented-on-main via <대체 route>"** 로 교정한다. 각 행은 위 Why 절의 대체 route 로 cross-reference(경로 + 박제 task/PR/ADR)를 append 한다:
  - `POST /api/assessments/run`(REQ-040) → `POST /api/assessment-collection/collect` + `POST /api/assessment-evaluation/period` 로 shipped 표기.
  - `DELETE /api/assessments`(REQ-041) → `POST /api/schedules/recent-deletion/:personId`(T-0428) 로 shipped 표기.
  - `POST /api/assessments/reeval`(REQ-037) → `POST /api/assessment-evaluation/unevaluated-fill-run`(T-0565) 로 shipped 표기.
  - `POST /api/assessments/reset`(REQ-037) → `POST /api/assessment-evaluation/period` `reevaluate` flag(ADR-0038) 로 shipped 표기.
- [ ] 교정은 **append-only 정신** — 기존 METHOD/path/UC 링크/REQ 참조·설명 본문을 삭제하지 않고, "이 path 는 shipped 아님, capability 는 <대체 route> 로 이관" 임을 명확히 한다(caller 혼동 0 — `/api/assessments/run` 이 실제 route 인 것처럼 오독 방지).
- [ ] api.md L142 합계행의 `` `/api/assessments` 의 batch 4 건 … P5 evaluation pipeline 의존 미구현 deferred `` 서술도 동일하게 "대체 route 로 shipped" 로 정합 교정(합계행과 개별 4행이 모순되지 않게).
- [ ] 대체 route path 가 실제 main 에 존재함을 재확인(grep): `git grep -n '@Post("recent-deletion/:personId")' src/scheduling/recent-deletion.controller.ts` / `git grep -n 'unevaluated-fill-run' src/assessment-evaluation/assessment-evaluation.controller.ts` / api.md L103 의 `/api/assessment-evaluation/period` + `reevaluate` 행 실존. 존재하지 않는 route 로 링크하지 않는다.
- [ ] `git diff --stat` 이 `docs/architecture/api.md` 1 파일만, ≤ 15 LOC 변경임을 확인(doc-only, code/test 0).

분기 없음 — doc-only direct 변경이라 R-112 4종 test 항목 생략(코드·spec 0). tester 미호출(R-110 direct doc-only 면제).

## Out of Scope

- `/api/assessments/*` batch endpoint 를 **실제 구현하지 않는다** — capability 는 대체 route 로 이미 shipped 이므로 새 route 신설은 duplicate. 본 task 는 doc-drift 교정만.
- api.md L128~129 의 `/api/me/permission-denied`·`/api/admin/permission-denied` conceptual placeholder 행은 별개 이슈 — 건드리지 않는다.
- PLAN.md·STATE.json·REQ-COVERAGE-AUDIT.md 등 다른 doc 동기화는 out-of-scope(필요 시 별도 follow-up). 본 task 는 api.md 1 파일 한정.
- 대체 route 자체의 계약(request/response shape) 재기술은 out-of-scope — 이미 api.md L103 등에 박제됨. 본 task 는 stale 4행 → 대체 route pointer 교정만.

## Suggested Sub-agents

없음 — driver 가 직접 direct doc edit(executor 경유 doc-only 변경). architect/implementer/tester 불요.

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기 append.)

## Result (DONE 2026-07-07)

direct doc-only commit `8492f0a1` — api.md L95~98 batch 4행(run/bulk-DELETE/reeval/reset) + 합계행(L142)의 "미구현 P5 예정" 서술을 "shipped 아님(never-built) — capability 는 대체 route 로 implemented-on-main 이관" pointer 로 교정. 대체 route 4종(`/api/assessment-collection/collect`+`/api/assessment-evaluation/period`, `/api/schedules/recent-deletion/:personId`, `/api/assessment-evaluation/unevaluated-fill-run`, period `reevaluate` flag ADR-0038) 전부 main grep 재확인. append-only(METHOD/path/UC/REQ 보존). 실측 diff 1파일 5/5 LOC. CI(headSha 8492f0a1) markdown-only, in_progress → 다음 turn conclusion 재확인.

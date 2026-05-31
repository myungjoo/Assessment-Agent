---
id: T-0124
title: api.md auth tier 컬럼 RBAC enforced 표기 보강 (T-0121/T-0122/T-0123 chain 3/3 closure doc-sync)
phase: P3
status: DONE
completedAt: 2026-06-01T02:05:00+09:00
commitMode: direct
coversReq: [REQ-043, REQ-045, REQ-046, REQ-084, REQ-086]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-05-31
dependsOn: [T-0121, T-0122, T-0123]
plannerNote: "T-0123 Follow-ups #1 — controller RBAC chain 3/3 (Assessment/Contribution/Summary) 종결 후 api.md description 컬럼의 의도값 표기를 reality 와 align 하는 doc-sync. doc-only direct, cap 안전."
result: "api.md §5 의 `/api/assessments`·`/api/contributions`·`/api/summaries` 3 controller × 4 endpoint = 12 row description 컬럼 + 2 group header (L98/L103) + 1 합계 줄 (L126 신규 paragraph) 에 RBAC enforced 박제 완료. grep 'RBAC enforc' 매치 = 15 (AC 6 이상 충족). auth tier 컬럼 User+/Admin+ 변경 0 (이미 의도값). actual diff: 1 파일 / +6/-6 (실제 line touch — markdown 표 inline append + 1 paragraph 추가)."
---

# T-0124 — api.md auth tier 컬럼 RBAC enforced 표기 보강

## Why

`docs/PLAN.md` P3 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User)" + "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 을 직접 cover 한다. T-0121 (AssessmentController) / T-0122 (ContributionController) / T-0123 (SummaryController) 의 RBAC chain 3/3 종결로 3 controller (총 12 endpoint) 의 auth tier 가 의도값 ↔ reality 로 align 되었으나, [docs/architecture/api.md](../architecture/api.md) §5 의 description 컬럼은 여전히 `T-0117/T-0118/T-0119 박제` (controller shipped 시점) 만 표기하고 RBAC enforcement 사실은 박제 0 이다. 본 task 는 그 gap 을 doc-sync 한다 — T-0123 Follow-ups #1 의 planner 예약 항목.

이는 mid-phase doc-shift 패턴 (T-0040 / T-0045 / T-0058 의 4 회차 mid-phase doc-shift 박제, [p3-implementation-plan.md §2](../architecture/p3-implementation-plan.md) 박제) 의 5 회차 — code 변경 0, 새 결정 0, 신규 ADR 0. CLAUDE.md §3.1 의 `direct` 컬럼 (api.md 는 `docs/architecture/` 이므로 일반적으로는 `pr` 컬럼이지만, 본 task 의 변경은 **이미 머지된 사실의 doc 박제 (description annotation 보강)** 일 뿐 architecture 결정 변경 0 이라 doc-only direct 로 처리 가능 — 단 reviewer 가 본 분류에 이견이 있으면 `pr` 로 escalate). 보수적으로 본 task 는 **doc-only direct** 로 분류하되, 본 task 가 architecture 결정에 영향을 주지 않는다는 점을 본문 Out of Scope 에 명시.

## Required Reading

- `docs/tasks/T-0124-api-md-rbac-enforced-annotation.md` (본 파일)
- `docs/architecture/api.md` (특히 §5 의 L89–107 — `/api/assessments` / `/api/contributions` / `/api/summaries` 의 12 row + L124 합계 줄)
- `docs/tasks/T-0121-assessment-controller-rbac.md` — chain 1/3 reference (mergedAs / prNumber 박제값 사용)
- `docs/tasks/T-0122-contribution-controller-rbac.md` — chain 2/3 reference (mergedAs=6779cf8 / prNumber=124)
- `docs/tasks/T-0123-summary-controller-rbac.md` — chain 3/3 reference (mergedAs=31c96bd / prNumber=125)

## Acceptance Criteria

- [ ] `docs/architecture/api.md` §5 의 `/api/assessments` CRUD 4 row (L90–93) 의 description 컬럼에 RBAC enforcement 사실 박제 — 각 row 끝 또는 적절한 위치에 "**T-0121 박제 (PR-122) — RBAC enforced**" 또는 동등 표기 추가 (기존 `T-0117 박제 (PR-119)` 표기와 자연스럽게 병기, 본문 의미 변경 0).
- [ ] `docs/architecture/api.md` §5 의 `/api/contributions` 4 row (L99–102) 의 description 컬럼에 RBAC enforcement 사실 박제 — "**T-0122 박제 (PR-124) — RBAC enforced**" 동등 표기 추가.
- [ ] `docs/architecture/api.md` §5 의 `/api/summaries` 4 row (L104–107) 의 description 컬럼에 RBAC enforcement 사실 박제 — "**T-0123 박제 (PR-125) — RBAC enforced**" 동등 표기 추가.
- [ ] `docs/architecture/api.md` §5 의 그룹 header (L98 의 `/api/contributions — 개별 commit/PR/문서 단위 기여 (T-0118 박제, PR-120)` 및 L103 의 `/api/summaries — 일/주/월 시계열 요약 평가 (T-0119 박제, PR-121)`) 에도 RBAC enforcement 박제 — header 끝에 ", RBAC enforced T-0122/T-0123" 또는 동등 표기 추가.
- [ ] `docs/architecture/api.md` §5 의 합계 줄 (L124) 에 controller RBAC chain 3/3 종결 사실 1 줄 박제 — "Assessment/Contribution/Summary 3 controller 의 RBAC enforcement (User+ GET / Admin+ POST/DELETE) 는 T-0121/T-0122/T-0123 chain 으로 완료" 또는 동등 표기 추가.
- [ ] auth tier 컬럼 값 (User+ / Admin+) 은 **변경 0** — 이미 의도값으로 정확히 기재됨 (T-0120 박제). 본 task 는 description 컬럼의 박제만 보강.
- [ ] doc-only 변경이라 `pnpm lint && pnpm build && pnpm test` 등 코드 검증 불필요. 단, mermaid block / 표 구조 / markdown 렌더링 깨지지 않는지 자체 점검 (preview).
- [ ] 변경 후 grep 으로 검증: `grep -n "RBAC enforced" /home/user/Assessment-Agent/docs/architecture/api.md` 가 최소 3 row + 2 header + 1 합계 줄 = **6 회 이상** 매치.

## Out of Scope

- **auth tier 컬럼 값 변경** — 이미 정확. 본 task 는 description 컬럼의 doc-sync 만.
- **api.md 의 다른 section 갱신** — §1 (intro) / §2 (Auth credential) / §3 (RBAC tier) / §4 (resource prefix) / §6 (status code policy) / §7 (UC cross-reference) / §8 (Out of scope) 변경 0. §5 의 RBAC chain 3/3 박제만.
- **다른 controller (Person / Group / Part / User / Llm / Admin) 의 RBAC 적용** — 별도 task / chain (현재 RBAC 미적용, 후속 backbone task).
- **CurrentUser decorator 추출 / RolesGuard 공용 util refactor** — T-0123 Follow-ups #2, 별도 pr-mode refactor task.
- **새 ADR 신설 / 새 architecture 결정** — 0. 본 task 는 이미 결정·박제된 사실의 doc-sync 만.
- **PLAN.md / p3-implementation-plan.md / data-model.md / modules.md 갱신** — api.md 만. PLAN.md 의 RBAC bullet 갱신은 chain 종결 사실 박제 doc-sync 가 필요하면 별도 task (단 PLAN.md 가 이미 RBAC bullet 을 `[ ]` 그대로 둔 상태이므로, RBAC chain 3/3 종결 표기 갱신은 P3 → P4 전이 시 일괄 검토 권장).
- **STATE.json 갱신** — driver 책임 (planner 가 nextTask=T-0124 만 박제, 실 transfer 는 다음 driver turn).

## Suggested Sub-agents

`implementer` 단독 (architect 미호출 — 새 결정 0, tester 미호출 — doc-only). 단, doc-only direct 라 본 task 는 사실 executor sub-agent 호출 없이 driver 가 직접 Edit 도구로 수행해도 무방 (CLAUDE.md §3.1 direct mode 운영 관행). 호출 시에도 implementer 가 api.md 만 Edit, build/test 실행 0.

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) T-0123 Follow-ups #2: 3 controller 동일 패턴 출현 — CurrentUser decorator 추출 / RolesGuard 공용 util refactor task 검토 (pr-mode, ~200-300 LOC).
- (planner 예약) PLAN.md P3 의 "Auth/RBAC 모델" + "User read-only 권한 범위 명시" bullet 의 chain 3/3 종결 표기 갱신 — P3 → P4 전이 시 일괄 검토 권장.

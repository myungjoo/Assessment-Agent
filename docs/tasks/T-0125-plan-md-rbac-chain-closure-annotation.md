---
id: T-0125
title: PLAN.md P3 Auth/RBAC bullet 에 controller chain 3/3 종결 사실 박제 (T-0121/T-0122/T-0123 doc-sync)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-045, REQ-046, REQ-084, REQ-086]
estimatedDiff: 32
estimatedFiles: 1
created: 2026-06-01
dependsOn: [T-0121, T-0122, T-0123, T-0124]
plannerNote: "T-0124 Follow-ups #2 — PLAN.md P3 의 Auth/RBAC bullet 2 종에 controller RBAC chain 3/3 (Assessment/Contribution/Summary) 종결 사실 박제. doc-only direct, mid-phase doc-shift 6 회차."
---

# T-0125 — PLAN.md P3 Auth/RBAC bullet 에 controller chain 3/3 종결 사실 박제

## Why

[docs/PLAN.md](../PLAN.md) P3 의 L61–62 두 bullet — "Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만, 본인 self-demote 금지 (R-84)" 와 "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" — 은 controller RBAC chain 3/3 종결 (T-0121 AssessmentController PR-122 / T-0122 ContributionController PR-124 / T-0123 SummaryController PR-125 + T-0124 api.md §5 doc-sync) 의 사실 박제가 0 인 상태로 `[ ]` 그대로. 본 task 는 그 gap 을 doc-sync 한다 — T-0124 Follow-ups #2 의 planner 예약 항목.

bullet 의 checkbox 를 `[x]` 로 옮기지는 **않는다** — Person / Group / Part / User / Llm / Admin / `/api/me` controller 의 RBAC 적용은 아직 미적용 (별도 후속 chain) 이라 bullet 전체 closure 가 아니다. 본 task 는 sub-progress 박제 (bullet 본문 끝에 "[partial] T-0121/T-0122/T-0123 chain 으로 Assessment/Contribution/Summary 3 controller × 12 endpoint RBAC enforced (T-0124 api.md §5 doc-sync 완료); 나머지 controller 는 후속 chain" 또는 동등) 만 추가.

이는 mid-phase doc-shift 패턴 ([p3-implementation-plan.md §2](../architecture/p3-implementation-plan.md) 박제, T-0040 / T-0045 / T-0058 / T-0124 의 4 회차 + 본 task = 5 회차) — code 변경 0, 새 결정 0, 신규 ADR 0. CLAUDE.md §3.1 의 `direct` 컬럼 (`docs/PLAN.md` 명시) 에 정확히 해당 → **doc-only direct**.

## Required Reading

- `docs/tasks/T-0125-plan-md-rbac-chain-closure-annotation.md` (본 파일)
- `docs/PLAN.md` (특히 L60–66 의 P3 Domain core bullet 영역 — Auth/RBAC 모델 L61 + User read-only L62)
- `docs/architecture/api.md` (특히 L89–107 의 12 row + L126 의 합계 줄 paragraph — T-0124 doc-sync 결과물 reference)
- `docs/tasks/T-0124-api-md-rbac-enforced-annotation.md` (직전 doc-sync task — Follow-ups #2 source)
- `docs/tasks/T-0121-assessment-controller-rbac.md` — chain 1/3 reference (mergedAs / PR-122)
- `docs/tasks/T-0122-contribution-controller-rbac.md` — chain 2/3 reference (mergedAs=6779cf8 / PR-124)
- `docs/tasks/T-0123-summary-controller-rbac.md` — chain 3/3 reference (mergedAs=31c96bd / PR-125)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L61 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User) ..." bullet 본문 끝에 controller RBAC chain 3/3 종결 사실 박제 — "**[partial] T-0121 / T-0122 / T-0123 chain 으로 Assessment / Contribution / Summary 3 controller (12 endpoint) RBAC enforced** (JwtAuthGuard + RolesGuard + @Roles, ROLE_HIERARCHY 박제값 그대로; T-0124 api.md §5 doc-sync 완료). 나머지 controller (Person / Group / Part / User / Llm / Admin / `/api/me`) 는 후속 chain" 또는 동등 한국어 표기 추가.
- [ ] `docs/PLAN.md` L62 의 "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 본문 끝에 controller chain 3/3 종결 사실 박제 — "**[partial] T-0121 / T-0122 / T-0123 chain 으로 Assessment / Contribution / Summary 3 controller 의 GET endpoint 가 User+ tier 로 enforced** (POST / DELETE 는 Admin+ tier, R-86 read-only 범위 backbone 박제 완료). 나머지 controller 는 후속 chain" 또는 동등 한국어 표기 추가.
- [ ] **checkbox `[ ]` → `[x]` 변경 금지** — 본 task 는 partial progress 박제만, bullet 전체 closure 아님 (Person/Group/Part/Llm/Admin/`/api/me` controller RBAC 미적용 잔존).
- [ ] PLAN.md 의 **다른 bullet / 다른 phase / 다른 section** 변경 0 — P3 L61–62 두 bullet 만 inline append.
- [ ] doc-only 변경이라 `pnpm lint && pnpm build && pnpm test` 등 코드 검증 불필요. 단, markdown 표 구조 / list 들여쓰기 / 렌더링 깨지지 않는지 자체 점검 (preview).
- [ ] 변경 후 grep 으로 검증: `grep -n "T-0121\|T-0122\|T-0123" /home/user/Assessment-Agent/docs/PLAN.md` 가 최소 2 row 매치 (L61 + L62 각 1 회 이상).

## Out of Scope

- **checkbox `[x]` 전체 closure** — bullet 전체 종결은 모든 controller (Person / Group / Part / User / Llm / Admin / `/api/me`) RBAC 적용 후 별도 task (P3 → P4 전이 시점).
- **PLAN.md 의 다른 bullet 갱신** — L63–66 의 raw data 저장 금지 / 상대 비교 / Persistence / 테스트 품질 sub-bullet 변경 0. P4/P5/P6/P7/P8 phase 본문 변경 0.
- **다른 doc 갱신** — `docs/architecture/p3-implementation-plan.md` / `p3-to-p4-transition.md` / `data-model.md` / `modules.md` / `components.md` / api.md 변경 0 (api.md 는 T-0124 가 이미 doc-sync 완료).
- **CurrentUser decorator 추출 / RolesGuard 공용 util refactor** — T-0123 Follow-ups #2 / T-0124 Follow-ups #1, 별도 pr-mode refactor task (~200-300 LOC).
- **다른 controller (Person / Group / Part / User / Llm / Admin / `/api/me`) 의 RBAC 적용** — 별도 task / chain (현재 미적용, 후속 backbone task).
- **새 ADR 신설 / 새 architecture 결정** — 0. 본 task 는 이미 결정·박제된 사실의 PLAN.md doc-sync 만.
- **STATE.json 갱신** — driver 책임 (planner 가 nextTask=T-0125 만 박제, 실 currentTask transfer 는 다음 driver turn).

## Suggested Sub-agents

`implementer` 단독 (architect 미호출 — 새 결정 0, tester 미호출 — doc-only). 단, doc-only direct 라 본 task 는 사실 executor sub-agent 호출 없이 driver 가 직접 Edit 도구로 수행해도 무방 (CLAUDE.md §3.1 direct mode 운영 관행 + T-0124 의 driver-직접-Edit 박제 패턴 mirror). 호출 시에도 implementer 가 PLAN.md 만 Edit, build/test 실행 0.

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) T-0123 Follow-ups #2 / T-0124 Follow-ups #1: 3 controller 동일 패턴 출현 — CurrentUser decorator 추출 / RolesGuard 공용 util refactor task 검토 (pr-mode, ~200-300 LOC). gh CLI 가 있는 환경에서 다음 cron 발화 시 우선.
- (planner 예약) 다른 controller (Person / Group / Part / User / Llm / Admin / `/api/me`) 의 RBAC 적용 chain — 본 doc-sync 완료 후 자연 후속 backbone chain. controller 별 ~250-300 LOC × N controller, 각각 별도 pr-mode task.
- (planner 예약) `docs/architecture/p3-implementation-plan.md` / `p3-to-p4-transition.md` 의 controller RBAC chain 3/3 종결 사실 박제 (mid-phase doc-shift 6 회차 후보, doc-only direct).

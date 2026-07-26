---
id: T-1235
title: DashboardView GET /api/contributions 평가 상세 조회 web↔backend 계약 drift-guard spec 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-033]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-26
independentStream: p6-dashboard-contract-guard
dependsOn: []
touchesFiles: [web/src/views/DashboardView.contributions-list-contract.test.ts]
plannerNote: P6 — T-1234 Follow-up. DashboardView 4 GET 중 3번째 slice = GET /api/contributions. T-1234 summaries spec 구조 mirror + assessmentId null-gate 분기, T-1201 helper 재사용(신규 coverage).
---

# T-1235 — DashboardView GET /api/contributions 평가 상세 조회 web↔backend 계약 drift-guard spec 신설

## Why

PLAN.md line 119 의 시각화 대시보드(REQ-038) 를 소유하는 `DashboardView` 는 4개의 GET endpoint(`/api/assessments`·`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`) 를 fire 하지만, 지금까지 신설된 web↔backend 계약 drift-guard spec 은 T-1233(`GET /api/assessments`)·T-1234(`GET /api/summaries`) 두 slice뿐이다. 본 task 는 나머지 2종 중 **세 번째 slice** — `GET /api/contributions`(평가 상세, api.md 106, `contribution.controller.ts` bare `@Get()` findByAssessment) 에 대한 drift-guard spec 을 신설한다.

이는 dedup(기존 spec 중복 추출기 이관)이 아니라 **신규 coverage** 이며, 시작부터 T-1201 공용 helper 를 import 해 중복 추출기를 만들지 않는다. `buildContributionsPath` 는 `summaries` 와 동형으로 **assessmentId falsy 시 `null` 반환**하는 조건부 조회 가드 분기가 있고(assessmentId 누락 시 400 회피), 쿼리 param 이름이 `assessmentId` 단일이라는 점만 다르다.

## Required Reading

- `web/src/views/DashboardView.tsx` — 특히 `buildContributionsPath(assessmentId)`(L185~191): `assessmentId` falsy → `null` 반환(조회 미수행), 있으면 `/api/contributions?assessmentId=` query 합성. web 이 fire 하는 계약(bare route·GET·assessmentId query·path-param 없음·null-gate 분기)을 이 함수에서 추출한다. selectedId → contributionsPath 파생부(L381~390)도 참고.
- `src/user/contribution.controller.ts` — `@Controller("api/contributions")`(L75) + bare `@Get()` `findByAssessment`(L97~106, `@Query("assessmentId")` optional, `@Body` 없음) vs `@Get(":id")` `findOne`(L114~118, detail, `@Param`) vs `@Post()` `create`(L131~136, body 있음) 판별 축. web 이 fire 하는 bare-route list 는 `findByAssessment` 에 매핑돼야 하며 `:id` detail 도 `@Post()` create 도 아님.
- `web/src/views/__contract-guard__/contract-extractors.ts` — T-1201 공용 helper. `stripComments`·`extractControllerRoute`·`extractHandlerMethods`·`composeRoute`·`stripQuery` 등을 **alphabetical named import 로 재사용**(중복 inline 정의 금지). helper 미제공 추출(query param 이름 집합·null-gate 판정 등)만 spec 로컬 정의.
- `web/src/views/DashboardView.summaries-list-contract.test.ts` (T-1234, 300 LOC) — 직전 slice. describe/it 구조·bare `@Get()` vs `@Get(":id")` 판별·null-gate 분기·negative(드리프트 주입) 관례를 그대로 mirror. **단 소비처는 `buildContributionsPath`, controller 는 `contribution.controller.ts`, base 는 `api/contributions`, query param 은 `assessmentId` 단일**.
- `docs/architecture/api.md` L106 부근 — `GET /api/contributions?assessmentId=` row(계약 확인용, 변경 불요).

## Acceptance Criteria

- [ ] 신규 spec 파일 `web/src/views/DashboardView.contributions-list-contract.test.ts`(colocated) 를 신설한다. (1) `DashboardView.tsx` 의 `buildContributionsPath` 산출에서 web-fire 계약을, (2) `contribution.controller.ts` 에서 backend 계약을 각각 추출해 대조한다. 공용 추출기는 `__contract-guard__/contract-extractors.ts` 에서 alphabetical named import 로 재사용(중복 inline 정의 0).
- [ ] **happy-path(정합) test 1+**: 현재 main 의 `buildContributionsPath(assessmentId)` 산출 route 가 `api/contributions` base + bare `@Get()` findByAssessment 에 정확히 매핑되고, method=GET, query param 집합 `{assessmentId}` 가 backend `@Query` 인자와 일치함을 검증(계약 정합 → pass).
- [ ] **error/negative(드리프트 주입) test 각 1+** — 아래 축마다 드리프트를 in-memory 로 주입하면 guard 가 fail 함을 검증(각 1+):
  - (a) base path 드리프트(`api/contributions` → `api/contribution` 또는 `api/commits`) → 불일치 검출.
  - (b) method 드리프트(GET → POST) → 불일치 검출(단순 method 축; `@Post()` create 오매핑은 (c) 와 별도).
  - (c) bare-route vs `:id`/`@Post()` 혼동 — web 이 `/api/contributions/:id` detail 또는 create(POST) 를 fire 하도록 오변형 시 bare `@Get()` findByAssessment(list) 매핑이 깨짐을 검출.
  - (d) query param 이름 드리프트(`assessmentId` → `assessment` 또는 query 제거) → 불일치 검출.
  - (e) `@Get()` findByAssessment 핸들러 부재(list handler 제거) → 매핑 대상 소멸 검출.
- [ ] **flow/branch cover — null-gate 분기 포함**: (1) bare `@Get()`(list) vs `@Get(":id")`(detail) 판별 각 1+ test. (2) `buildContributionsPath` 의 **assessmentId 유무 분기 각 1+** — assessmentId truthy 시 `/api/contributions?assessmentId=` 문자열 반환(조회 fire), assessmentId falsy 시 `null` 반환(조회 미수행)을 검증하고, null 반환은 계약 대조 대상에서 제외됨(조회 자체가 없으므로 드리프트 불가)을 명시.
- [ ] **query 무해성**: `?assessmentId=` query 는 route 대조 시 `stripQuery` 로 제거돼 route 비교에 영향을 주지 않음을 검증(query 유무가 계약 판정을 바꾸지 않음).
- [ ] production 코드 변경 0 — DashboardView.tsx / contribution.controller.ts / helper 는 **읽기만**, 수정 금지(순수 test-only 신설).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused import 0).

## Out of Scope

- **나머지 1 DashboardView GET endpoint(`/api/permission-denied-records`) drift-guard 는 본 slice 에서 다루지 않는다** — 별도 후속 slice(Follow-up, 4종 중 마지막). 본 task 는 `GET /api/contributions` 1종만.
- 기존 `AdminView.*-contract.test.ts` / `DashboardView.assessments-list-contract.test.ts` / `DashboardView.summaries-list-contract.test.ts` 이관/수정 금지 — 본 task 는 신규 파일만 추가.
- `__contract-guard__/contract-extractors.ts`(공용 helper) 수정 금지 — 부족한 추출은 spec 로컬에 정의하되, helper 확장이 필요하면 Follow-up 에 적는다.
- backend controller/service/DTO/api.md 변경 0 — 이미 shipped 계약을 대조만.
- `DashboardView.tsx` / `buildContributionsPath` 리팩터 금지 — 계약 대조만, 소비처 변형 금지.
- **cap 유의**: T-1234 이 300/300 LOC 로 cap 정확히 도달했다. 본 spec 은 동형 구조 + assessmentId 단일 query(summaries 의 2 param 보다 단순)라 유사 또는 소폭 작은 규모 예상. 300 LOC / 5 파일 cap 초과 위험 시 helper-미제공 추출을 최소 inline 으로 유지하고, 초과 불가피하면 executor 가 즉시 BLOCKED(task-too-large) 로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: DashboardView 마지막 GET endpoint drift-guard slice(`/api/permission-denied-records`, 고정 endpoint·query 없음). 4종 공통 추출 패턴이 반복 확정되면 `__contract-guard__` helper 확장(null-gate list 추출 공통화) 검토.

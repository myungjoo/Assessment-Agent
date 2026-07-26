---
id: T-1234
title: DashboardView GET /api/summaries 시계열 요약 조회 web↔backend 계약 drift-guard spec 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-26
independentStream: p6-dashboard-contract-guard
dependsOn: []
touchesFiles: [web/src/views/DashboardView.summaries-list-contract.test.ts]
plannerNote: P6 — T-1233 Follow-up. DashboardView 4 GET 중 2번째 slice = GET /api/summaries. T-1233 assessments spec 구조 mirror + null-path 분기 추가, T-1201 helper 재사용(신규 coverage).
---

# T-1234 — DashboardView GET /api/summaries 시계열 요약 조회 web↔backend 계약 drift-guard spec 신설

## Why

PLAN.md line 119 의 시각화 대시보드(REQ-038) 를 소유하는 `DashboardView` 는 4개의 GET endpoint(`/api/assessments`·`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`) 를 fire 하지만, 지금까지 신설된 web↔backend 계약 drift-guard spec 은 첫 slice T-1233(`GET /api/assessments`) 하나뿐이다. 본 task 는 T-1233 의 Out of Scope / Follow-up 이 명시한 **나머지 3종 중 두 번째 slice** — `GET /api/summaries`(시계열 요약, api.md 109, `summary.controller.ts` `@Get()` findByPerson) 에 대한 drift-guard spec 을 신설한다.

이는 dedup(기존 spec 중복 추출기 이관)이 아니라 **신규 coverage** 이며, 시작부터 T-1201 공용 helper 를 import 해 중복 추출기를 만들지 않는다. `buildSummariesPath` 는 `assessments` 와 달리 **personId falsy 시 `null` 반환**하는 조건부 조회 가드 분기가 있어(assessments 는 항상 문자열 반환), 이 분기 축을 추가로 대조한다.

## Required Reading

- `web/src/views/DashboardView.tsx` — 특히 `buildSummariesPath(personId, period)`(L145~157): `personId` falsy → `null` 반환(조회 미수행), 있으면 `/api/summaries?personId=&period=` query 합성. web 이 fire 하는 계약(bare route·GET·personId/period query·path-param 없음·null-gate 분기)을 이 함수에서 추출한다.
- `src/user/summary.controller.ts` — `@Controller("api/summaries")`(L79) + bare `@Get()` `findByPerson`(L100~110, `@Query("personId")`·`@Query("period")` 둘 다 optional, `@Body` 없음) vs `@Get(":id")` `findById`(L121~125, detail) vs `@Post()` `create`(L138~142, body 있음) 판별 축. web 이 fire 하는 bare-route list 는 `findByPerson` 에 매핑돼야 하며 `:id` detail 도 `@Post()` create 도 아님.
- `web/src/views/__contract-guard__/contract-extractors.ts` — T-1201 공용 helper. `stripComments`·`extractControllerRoute`·`extractHandlerMethods`·`composeRoute`·`stripQuery` 등을 **alphabetical named import 로 재사용**(중복 inline 정의 금지). helper 미제공 추출(query param 이름 집합·null-gate 판정 등)만 spec 로컬 정의.
- `web/src/views/DashboardView.assessments-list-contract.test.ts` (T-1233, 299 LOC) — 직전 slice. describe/it 구조·bare `@Get()` vs `@Get(":id")` 판별·negative(드리프트 주입) 관례를 그대로 mirror. **단 소비처는 `buildSummariesPath`, controller 는 `summary.controller.ts`, base 는 `api/summaries`**.
- `docs/architecture/api.md` L108~112 부근 — `GET /api/summaries?personId=&period=` row(계약 확인용, 변경 불요).

## Acceptance Criteria

- [ ] 신규 spec 파일 `web/src/views/DashboardView.summaries-list-contract.test.ts`(colocated) 를 신설한다. (1) `DashboardView.tsx` 의 `buildSummariesPath` 산출에서 web-fire 계약을, (2) `summary.controller.ts` 에서 backend 계약을 각각 추출해 대조한다. 공용 추출기는 `__contract-guard__/contract-extractors.ts` 에서 alphabetical named import 로 재사용(중복 inline 정의 0).
- [ ] **happy-path(정합) test 1+**: 현재 main 의 `buildSummariesPath(personId, period)` 산출 route 가 `api/summaries` base + bare `@Get()` findByPerson 에 정확히 매핑되고, method=GET, query param 집합 `{personId, period}` 가 backend `@Query` 인자와 일치함을 검증(계약 정합 → pass).
- [ ] **error/negative(드리프트 주입) test 각 1+** — 아래 축마다 드리프트를 in-memory 로 주입하면 guard 가 fail 함을 검증(각 1+):
  - (a) base path 드리프트(`api/summaries` → `api/summary` 또는 `api/digests`) → 불일치 검출.
  - (b) method 드리프트(GET → POST) → 불일치 검출(단순 method 축; `@Post()` create 오매핑은 (c) 와 별도).
  - (c) bare-route vs `:id`/`@Post()` 혼동 — web 이 `/api/summaries/:id` detail 또는 create(POST) 를 fire 하도록 오변형 시 bare `@Get()` findByPerson(list) 매핑이 깨짐을 검출.
  - (d) query param 이름 드리프트(`personId` → `userId` 또는 `period` 제거) → 불일치 검출.
  - (e) `@Get()` findByPerson 핸들러 부재(list handler 제거) → 매핑 대상 소멸 검출.
- [ ] **flow/branch cover — null-gate 분기 포함**: (1) bare `@Get()`(list) vs `@Get(":id")`(detail) 판별 각 1+ test. (2) `buildSummariesPath` 의 **personId 유무 분기 각 1+** — personId truthy 시 `/api/summaries?...` 문자열 반환(조회 fire), personId falsy 시 `null` 반환(조회 미수행)을 검증하고, null 반환은 계약 대조 대상에서 제외됨(조회 자체가 없으므로 드리프트 불가)을 명시.
- [ ] **query 무해성**: `?personId=`·`?period=` query 는 route 대조 시 `stripQuery` 로 제거돼 route 비교에 영향을 주지 않음을 검증(query 유무가 계약 판정을 바꾸지 않음).
- [ ] production 코드 변경 0 — DashboardView.tsx / summary.controller.ts / helper 는 **읽기만**, 수정 금지(순수 test-only 신설).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused import 0).

## Out of Scope

- **나머지 2 DashboardView GET endpoint(`/api/contributions`·`/api/permission-denied-records`) drift-guard 는 본 slice 에서 다루지 않는다** — 각각 별도 후속 slice(Follow-up). 본 task 는 `GET /api/summaries` 1종만.
- 기존 `AdminView.*-contract.test.ts` / `DashboardView.assessments-list-contract.test.ts` 이관/수정 금지 — 본 task 는 신규 파일만 추가.
- `__contract-guard__/contract-extractors.ts`(공용 helper) 수정 금지 — 부족한 추출은 spec 로컬에 정의하되, helper 확장이 필요하면 Follow-up 에 적는다.
- backend controller/service/DTO/api.md 변경 0 — 이미 shipped 계약을 대조만.
- `DashboardView.tsx` / `buildSummariesPath` 리팩터 금지 — 계약 대조만, 소비처 변형 금지.
- **cap 유의**: T-1233 이 299/300 LOC 로 cap 에 근접했다. 본 spec 은 동형 구조 + null-gate 분기 1축 추가라 유사 규모 예상. 300 LOC / 5 파일 cap 초과 위험 시 helper-미제공 추출을 최소 inline 으로 유지하고, 초과 불가피하면 executor 가 즉시 BLOCKED(task-too-large) 로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: DashboardView 나머지 2 GET endpoint drift-guard slice(`/api/contributions`·`/api/permission-denied-records`). 4종 공통 추출 패턴이 반복되면 `__contract-guard__` helper 확장(assessments/summaries 의 null-gate list 추출 공통화) 검토.
- T-1233 R1 nit 참조: no-query fire 케이스(`?? ''` fallback·`if (!query) return []`) 가 실제 fire 경로에서 미호출인 방어 분기. summaries 도 동일 패턴이면 본 spec 에서 해당 방어 분기를 실제로 cover 하는 test 를 넣어 dead-branch 를 실효화할지 검토.

## Result (DONE — 2026-07-26)

- PR #1126 squash merge `18f12484` + branch delete. reviewer round 2/7 APPROVE(round1 nit 1건 → §3 Nit-in-PR closure round+1 마감, round2 nit 0).
- 산출물: `web/src/views/DashboardView.summaries-list-contract.test.ts` (test-only, +300 LOC, production 무변경). T-1201 공용 helper 8종 재사용(중복 추출기 0), `buildSummariesPath` null-gate 분기 축 대조 + `extractPathQueryParams` null-query 방어분기 cover.
- 검증: vitest 26 신규 pass / web 전체 1887 무회귀, tsc/build green. 4-게이트 PASS(reviewer external comment issuecomment-5081182711, CI 기본검사 approval-gate pass + 배포산출물검증 pass).
- Follow-up: DashboardView 잔여 2 GET slice — `GET /api/contributions`, `GET /api/permission-denied-records` drift-guard spec.

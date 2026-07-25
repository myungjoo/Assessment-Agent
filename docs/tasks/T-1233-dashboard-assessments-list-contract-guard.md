---
id: T-1233
title: DashboardView GET /api/assessments 시계열 조회 web↔backend 계약 drift-guard spec 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038]
estimatedDiff: 210
estimatedFiles: 1
created: 2026-07-25
independentStream: p6-dashboard-contract-guard
dependsOn: []
touchesFiles: [web/src/views/DashboardView.assessments-list-contract.test.ts]
plannerNote: P6 — AdminView 전 endpoint 는 drift-guard 있으나 DashboardView 4 GET 은 0. 첫 slice = 핵심 R-38 GET /api/assessments, T-1201 helper 재사용(dedup 아님·신규 coverage).
---

# T-1233 — DashboardView GET /api/assessments 시계열 조회 web↔backend 계약 drift-guard spec 신설

## Why

PLAN.md line 119 의 시각화 대시보드(REQ-038) 는 `DashboardView` 가 소유하며, 이 컨테이너는 **4개의 GET endpoint**(`/api/assessments`·`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`) 를 fire 한다. 그런데 지금까지 신설된 web↔backend 계약 drift-guard spec 은 전부 `AdminView.*-contract.test.ts` 로 **AdminView 가 fire 하는 mutation/조회 endpoint 만** 보호하고, **DashboardView 의 데이터-읽기 경로 4종은 drift-guard 가 하나도 없다**. 즉 앱의 가장 중요한 조회 경로(시계열 평가 결과)가 backend 컨트롤러 계약과 드리프트해도 test 로 잡히지 않는다.

본 task 는 그 공백 중 **첫 slice 이자 가장 핵심**인 `GET /api/assessments`(api.md 89, `assessment.controller.ts` `@Get()` findByPerson, 시계열 평가 결과 조회) 에 대한 drift-guard spec 을 신설한다. 이는 방금 종료된 contract-guard **dedup** stream(기존 spec 의 중복 추출기 이관)과 **다른 성격** — 기존에 존재하지 않던 endpoint 에 대한 **신규 coverage** 이며, 시작부터 T-1201 이 신설한 공용 helper(`web/src/views/__contract-guard__/contract-extractors.ts`)를 import 해 중복 추출기를 만들지 않는다.

## Required Reading

- `web/src/views/DashboardView.tsx` — 특히 `buildAssessmentsPath(personId, period)`(L101~114 부근): `/api/assessments?personId=&period=` query 합성. web 이 fire 하는 계약(bare route·GET·personId/period query·path-param 없음)을 이 함수에서 추출한다.
- `src/user/assessment.controller.ts` — `@Controller("api/assessments")`(L71) + `@Get()` `findByPerson`(L93~103, `@Query("personId")`·`@Query("period")` 둘 다 optional, `@Body` 없음) vs `@Get(":id")` `findOne`(detail) 판별 축. web 이 fire 하는 bare-route list 는 `findByPerson` 에 매핑돼야 하며 `:id` detail 이 아님.
- `web/src/views/__contract-guard__/contract-extractors.ts` — T-1201 공용 helper. `stripComments`·`extractControllerRoute`·`extractHandlerMethods`·`composeRoute`·`stripQuery` 등을 **named import 로 재사용**(중복 inline 정의 금지). helper 가 제공하지 않는 assessments-전용 추출(query param 이름 집합 등)만 이 spec 안에 정의.
- `web/src/views/AdminView.persons-list-contract.test.ts` (245 LOC) 및 `AdminView.schedules-list-contract.test.ts` (221 LOC) — 기존 GET-list drift-guard spec 의 describe/it 구조·bare `@Get()` vs `@Get(":id")` 판별 패턴·negative(드리프트 주입) 관례를 그대로 mirror. **단 소비처는 DashboardView.tsx**(AdminView 아님).
- `docs/architecture/api.md` L88~92 부근 — `GET /api/assessments?personId=&period=` row(계약 확인용, 변경 불요).

## Acceptance Criteria

- [ ] 신규 spec 파일 `web/src/views/DashboardView.assessments-list-contract.test.ts`(colocated) 를 신설한다. 파일은 (1) `DashboardView.tsx` 의 `buildAssessmentsPath` 산출에서 web-fire 계약을, (2) `assessment.controller.ts` 에서 backend 계약을 각각 추출해 대조한다. 공용 추출기는 `__contract-guard__/contract-extractors.ts` 에서 alphabetical named import 로 재사용(중복 inline 정의 0).
- [ ] **happy-path(정합) test 1+**: 현재 main 의 `buildAssessmentsPath` 산출 route 가 `api/assessments` base + bare `@Get()` findByPerson 에 정확히 매핑되고, method=GET, query param 집합 `{personId, period}` 가 backend `@Query` 인자와 일치함을 검증(계약 정합 → pass).
- [ ] **error/negative(드리프트 주입) test 각 1+** — 아래 축마다 드리프트를 in-memory 로 주입하면 guard 가 fail 함을 검증(각 1+):
  - (a) base path 드리프트(`api/assessments` → `api/evaluations`) → 불일치 검출.
  - (b) method 드리프트(GET → POST) → 불일치 검출.
  - (c) bare-route vs `:id` 혼동 — web 이 `/api/assessments/:id` detail 을 fire 하도록 오변형 시 `@Get()` findByPerson(list) 매핑이 깨짐을 검출.
  - (d) query param 이름 드리프트(`personId` → `userId` 또는 `period` 제거) → 불일치 검출.
  - (e) `@Get()` findByPerson 핸들러 부재(list handler 제거) → 매핑 대상 소멸 검출.
- [ ] **flow/branch cover**: bare `@Get()`(list/time-series) vs `@Get(":id")`(detail) 판별 분기 각 1+ test — list 는 findByPerson 에, detail 은 findOne 에 매핑되어 서로 오인되지 않음.
- [ ] **query 무해성**: `?personId=`·`?period=` query 는 route 대조 시 `stripQuery` 로 제거돼 route 비교에 영향을 주지 않음을 검증(query 유무가 계약 판정을 바꾸지 않음).
- [ ] production 코드 변경 0 — DashboardView.tsx / assessment.controller.ts / helper 는 **읽기만**, 수정 금지(순수 test-only 신설).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused import 0).

## Out of Scope

- **나머지 3 DashboardView GET endpoint(`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`) drift-guard 는 본 slice 에서 다루지 않는다** — 각각 별도 후속 slice(Follow-up). 본 task 는 `GET /api/assessments` 1종만.
- 기존 `AdminView.*-contract.test.ts` 이관/수정 금지 — dedup stream 은 이미 종료. 본 task 는 신규 파일만 추가.
- `__contract-guard__/contract-extractors.ts`(공용 helper) 수정 금지 — 부족한 추출은 spec 로컬에 정의하되, helper 확장이 필요하면 Follow-up 에 적는다.
- backend controller/service/DTO/api.md 변경 0 — 이미 shipped 계약을 대조만.
- `DashboardView.tsx` / `buildAssessmentsPath` 리팩터 금지 — 계약 대조만, 소비처 변형 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: DashboardView 나머지 3 GET endpoint drift-guard slice(`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`), 4종 공통 추출 패턴이 반복되면 helper 확장 검토.
- reviewer nit(비차단, PR #1125 R1): spec 의 `extractPathQueryParams` 의 `if (!query) return []` 방어 분기와 `assessmentsFire` 의 `?? ''` fallback 이 어떤 fire 경로에서도 호출 안 됨(personId 항상 truthy). 파일이 이미 299/300 LOC cap 근접이라 §3 Nit-in-PR closure 예외(cap-초과 risk) → 본 PR 에서 안 고치고 별도 slice(no-query fire 케이스)에서 흡수 권장.

## Result

- **Status: DONE** (2026-07-25T23:16:08Z, PR [#1125](https://github.com/myungjoo/Assessment-Agent/pull/1125) squash merged `c7c9d6cd`).
- test-only 1파일 신설(`web/src/views/DashboardView.assessments-list-contract.test.ts`, +299/-0, production 0). 공용 helper 8종 named import 재사용. vitest 25 신규 pass / 1861 전체 무회귀, tsc + vite build green, root eslint green.
- reviewer round 1/7 APPROVE(0 BLOCKER/0 MAJOR, nit 2건 Follow-up 이관), 4-게이트 PASS(reviewer comment external, CI 기본검사+배포산출물검증 green). counters 1223→1224.

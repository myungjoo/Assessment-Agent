---
id: T-1236
title: DashboardView GET /api/permission-denied-records 권한 부족 감사 조회 web↔backend 계약 drift-guard spec 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038, REQ-008]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-07-26
independentStream: p6-dashboard-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/DashboardView.permission-denied-records-list-contract.test.ts]
plannerNote: P6 — T-1235 Follow-up. DashboardView 4 GET 중 마지막 slice = GET /api/permission-denied-records. 고정 상수 경로(null-gate 없음·web query 0) + backend optional query 3종 subset 축. T-1201 helper 재사용(신규 coverage).
---

# T-1236 — DashboardView GET /api/permission-denied-records 권한 부족 감사 조회 web↔backend 계약 drift-guard spec 신설

## Why

PLAN.md line 119 의 시각화 대시보드(REQ-038) 를 소유하는 `DashboardView` 는 4개의 GET endpoint(`/api/assessments`·`/api/summaries`·`/api/contributions`·`/api/permission-denied-records`) 를 fire 하며, 지금까지 web↔backend 계약 drift-guard spec 은 T-1233(`GET /api/assessments`)·T-1234(`GET /api/summaries`)·T-1235(`GET /api/contributions`) 세 slice 가 신설됐다. 본 task 는 **4종 중 마지막 slice** — `GET /api/permission-denied-records`(권한 부족 감사 조회, R-20/R-33/REQ-008/REQ-016, `permission-denied-record.controller.ts` bare `@Get()` list) 에 대한 drift-guard spec 을 신설한다.

이는 dedup(기존 spec 중복 추출기 이관)이 아니라 **신규 coverage** 이며, 시작부터 T-1201 공용 helper 를 import 해 중복 추출기를 만들지 않는다. 직전 3 slice 와 달리 web 소비처가 **고정 상수 경로**(`PERMISSION_DENIED_RECORDS_PATH = '/api/permission-denied-records'`, null-gate 분기 없음, web-fire query param 0)라 web 쪽은 더 단순하지만, backend `@Get()` list 는 optional query 3종(`instanceRef`·`provider`·`httpStatus`)을 받으므로 **web-fire query 집합(∅) ⊆ backend optional query 집합** 이라는 subset 호환 축을 새로 대조한다.

## Required Reading

- `web/src/views/DashboardView.tsx` — 특히 상수 `PERMISSION_DENIED_RECORDS_PATH`(L66, `'/api/permission-denied-records'`) 와 네 번째 `useApiResource<PermissionDeniedRecordRow[]>(PERMISSION_DENIED_RECORDS_PATH)` 호출(L397~401). web 이 fire 하는 계약(bare route·GET·query 0·path-param 없음·null-gate 분기 없음 — 무조건 조회)을 이 상수에서 추출한다. 조건부 조회 가드가 없다는 점이 summaries/contributions slice 와의 핵심 차이.
- `src/permission-denied/permission-denied-record.controller.ts` — `@Controller("api/permission-denied-records")`(L78) + bare `@Get()` `list`(L98~119, `@Query("instanceRef")`·`@Query("provider")`·`@Query("httpStatus")` **셋 다 optional**, `@Body` 없음). 이 controller 는 `@Get(":id")` detail 도 `@Post()` create 도 **없음** — 유일 route 가 bare `@Get()` list. web 이 fire 하는 bare-route 는 이 `list` 에 매핑돼야 한다.
- `web/src/views/__contract-guard__/contract-extractors.ts` — T-1201 공용 helper. `stripComments`·`extractControllerRoute`·`extractHandlerMethods`·`composeRoute`·`stripQuery` 등을 **alphabetical named import 로 재사용**(중복 inline 정의 금지). helper 미제공 추출(backend optional query param 이름 집합·web-fire query 집합·subset 판정 등)만 spec 로컬 정의.
- `web/src/views/DashboardView.contributions-list-contract.test.ts` (T-1235, ~291 LOC) — 직전 slice. describe/it 구조·bare `@Get()` 판별·negative(드리프트 주입) 관례를 그대로 mirror. **단 소비처는 고정 상수 `PERMISSION_DENIED_RECORDS_PATH`(함수 아님), controller 는 `permission-denied-record.controller.ts`, base 는 `api/permission-denied-records`, web-fire query 는 ∅ / backend optional query 는 3종**. null-gate 분기가 없으므로 관련 test 는 제거하고, 대신 subset 호환 test 를 추가한다.
- `docs/architecture/api.md` — `GET /api/permission-denied-records` row(계약 확인용, 변경 불요).

## Acceptance Criteria

- [ ] 신규 spec 파일 `web/src/views/DashboardView.permission-denied-records-list-contract.test.ts`(colocated) 를 신설한다. (1) `DashboardView.tsx` 의 `PERMISSION_DENIED_RECORDS_PATH` 상수에서 web-fire 계약을, (2) `permission-denied-record.controller.ts` 에서 backend 계약을 각각 추출해 대조한다. 공용 추출기는 `__contract-guard__/contract-extractors.ts` 에서 alphabetical named import 로 재사용(중복 inline 정의 0).
- [ ] **happy-path(정합) test 1+**: 현재 main 의 `PERMISSION_DENIED_RECORDS_PATH` 산출 route 가 `api/permission-denied-records` base + bare `@Get()` list 에 정확히 매핑되고, method=GET, web-fire query 집합 `∅` 가 backend optional query 집합 `{instanceRef, provider, httpStatus}` 의 subset(호환)임을 검증(계약 정합 → pass).
- [ ] **error/negative(드리프트 주입) test 각 1+** — 아래 축마다 드리프트를 in-memory 로 주입하면 guard 가 fail 함을 검증(각 1+):
  - (a) base path 드리프트(`api/permission-denied-records` → `api/permission-denied-record` 또는 `api/denied-records`) → 불일치 검출.
  - (b) method 드리프트(GET → POST) → 불일치 검출.
  - (c) bare-route vs `:id` 혼동 — web 이 `/api/permission-denied-records/:id` detail 을 fire 하도록 오변형 시 bare `@Get()` list 매핑이 깨짐을 검출(이 controller 는 detail route 자체가 없으므로 path-param 주입이 곧 계약 위반).
  - (d) query subset 위반 드리프트 — web 이 backend 미선언 query param(예 `?personId=` 또는 `?foo=`)을 fire 하도록 오변형 시 web-fire query 집합이 backend optional 집합의 subset 이 아니게 됨을 검출(∅ 였던 web query 에 미선언 키 주입 → mismatch).
  - (e) `@Get()` list 핸들러 부재(list handler 제거) → 매핑 대상 소멸 검출.
- [ ] **flow/branch cover**: (1) bare `@Get()`(list) 매핑 판별 test 1+ — 이 controller 는 유일 route 가 bare `@Get()` 임을 확인(다른 route 부재 축). (2) **query subset 호환 분기 각 1+** — web-fire query 집합이 backend optional 집합의 subset 일 때 pass(현 main: ∅ ⊆ 3종), subset 이 아닐 때 fail(미선언 키 주입)을 각각 검증. null-gate 분기가 없음을 spec 주석/describe 로 명시(summaries/contributions 와의 구조 차이 — 무조건 조회).
- [ ] **query 무해성**: backend `@Query` 데코레이터의 optional query param 존재가 web-fire 계약(query 0)을 깨지 않음을 검증(backend 가 optional query 를 선언해도 web 이 안 보내는 것은 정합 — 모두 optional 이므로).
- [ ] production 코드 변경 0 — DashboardView.tsx / permission-denied-record.controller.ts / helper 는 **읽기만**, 수정 금지(순수 test-only 신설).
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec 전부 pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused import 0).

## Out of Scope

- **본 slice 로 DashboardView 4 GET drift-guard 가 완결된다** — 이후 신규 endpoint 가 추가되지 않는 한 별도 후속 slice 불요. 본 task 는 `GET /api/permission-denied-records` 1종만.
- 기존 `AdminView.*-contract.test.ts` / `DashboardView.{assessments,summaries,contributions}-list-contract.test.ts` 이관/수정 금지 — 본 task 는 신규 파일만 추가.
- `__contract-guard__/contract-extractors.ts`(공용 helper) 수정 금지 — 부족한 추출(query subset 판정 등)은 spec 로컬에 정의하되, 4종 slice 공통 패턴 helper 확장이 필요하면 Follow-up 에 적는다.
- backend controller/service/DTO/api.md 변경 0 — 이미 shipped 계약을 대조만. `parseHttpStatus` 등 controller 내부 로직 검증은 backend 자체 spec 소관(본 task 는 계약 표면만).
- `DashboardView.tsx` / `PERMISSION_DENIED_RECORDS_PATH` 리팩터 금지 — 계약 대조만, 소비처 변형 금지.
- **cap 유의**: 직전 3 slice 는 260~300 LOC. 본 spec 은 null-gate 분기가 없어(web 소비처 단순) 그보다 작거나 유사, subset 호환 축 추가로 상쇄될 수 있음. 300 LOC / 5 파일 cap 초과 위험 시 helper-미제공 추출을 최소 inline 으로 유지하고, 초과 불가피하면 executor 가 즉시 BLOCKED(task-too-large) 로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: DashboardView 4 GET drift-guard 완결 후, 4종 slice 의 공통 추출 패턴(bare `@Get()` list 판별·query subset 호환·null-gate 판정)을 `__contract-guard__` helper 로 승격해 향후 신규 GET slice 의 중복 inline 을 원천 차단할지 검토.

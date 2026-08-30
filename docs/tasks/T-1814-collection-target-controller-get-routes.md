---
id: T-1814
title: CollectionTargetController 신설 + GET 조회 2 route 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
estimatedDiff: 340
estimatedFiles: 4
created: 2026-08-30
completedAt: 2026-08-30T22:52:55Z
prNumber: 1426
mergeCommit: 1fbdac31
independentStream: collection-target-registration
dependsOn: [T-1811, T-1812, T-1813]
touchesFiles:
  - src/assessment-collection/collection-target.controller.ts
  - src/assessment-collection/collection-target.controller.spec.ts
  - src/assessment-collection/assessment-collection.module.ts
  - src/assessment-collection/assessment-collection.module.spec.ts
sizeExempt: true
exemptReason: 초과분 전량이 R-112 강제 colocated spec — production 순증 ≤ 110 LOC (controller 2 handler + module controllers 배열 1 줄). T-1748(ServiceIdentityController 골격 + GET, 300 LOC / 5 파일) 선례 승계.
plannerNote: ADR-0059 Follow-ups (c) 셋째 조각 — controller 골격 + User+ 조회 2 route 만. 편집 3 route 는 후속 slice.
---

# T-1814 — CollectionTargetController 신설 + GET 조회 2 route 배선

## Why

오너 지시 [PLAN](../PLAN.md) `130 행`(REQ-070 / REQ-072 / REQ-073) 의 수집 대상 등록·편집 축 chain 을 잇는다. [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` 는 [T-1809](T-1809-collection-target-repository.md) ~ [T-1811](T-1811-collection-target-service-update-delete-module.md) 로 종결됐고, `§Follow-ups (c)` 의 DTO 2 종은 [T-1812](T-1812-collection-target-create-dto.md)(Create) · [T-1813](T-1813-collection-target-update-dto.md)(Update) 가 박았다. 남은 것은 **controller + 5 route + guard 배선** 뿐인데, ADR `§Decision 5` route 표 5 행을 한 diff 에 담으면 spec 포함 700 LOC 을 넘겨 [CLAUDE.md §3](../../CLAUDE.md) cap 을 확실히 초과한다.

그래서 [ServiceIdentityController](../../src/user/service-identity.controller.ts) 의 절단 선례(T-1748 골격+GET → T-1749 POST → T-1750 PATCH → T-1751 DELETE)를 그대로 승계해, 본 slice 는 **controller 골격(경로 · ValidationPipe · guard wire) + 조회 tier(`User+`) 2 route** 만 노출한다. 조회 2 route 는 tier 가 같고(`@Roles("User")`) 둘 다 순수 위임이라 한 덩어리로 묶는 편이 반복 골격 비용을 줄인다. 편집 tier 3 route(POST · PATCH · DELETE — `@Roles("Admin")`)는 후속 slice 로 남긴다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — 특히 `§Decision 5`(route 표 5 행 · RBAC · 오류 계약 표 a~e · 응답 envelope 미도입) 와 `§Follow-ups`
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) — 위임 대상. `findAll()` · `findById(id)` 시그니처와 404 변환 계약
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 본 controller 가 mirror 할 골격(경로 상수 · controller-scope `ValidationPipe` 3 옵션 · `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles` 순서 · 주석 밀도)
- [src/user/service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) — colocated controller spec 의 구조 선례(핸들러 위임 검증 + decorator metadata drift guard). **본 task 의 신규 spec 은 colocated 위치 `src/assessment-collection/collection-target.controller.spec.ts` 에 둔다**
- [src/assessment-collection/assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts) — `imports` 에 `AuthModule` 이 이미 있고 `providers` 에 `CollectionTargetService` 가 이미 등록돼 있음을 확인할 것 (`controllers` 배열만 늘린다)
- [src/assessment-collection/assessment-collection.module.spec.ts](../../src/assessment-collection/assessment-collection.module.spec.ts) — module 배선 검증 spec 의 기존 패턴

## Acceptance Criteria

- [x] `src/assessment-collection/collection-target.controller.ts` 를 신설한다. `@Controller("api/collection-targets")` + controller-scope `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` 를 `ServiceIdentityController` 와 동일하게 설정하고, 생성자는 `CollectionTargetService` **단독** 주입.
- [x] public 핸들러는 정확히 **2 개** — `findAll()`(`@Get()`, 200, `service.findAll()` 위임) 과 `findById(@Param("id") id)`(`@Get(":id")`, 200, `service.findById(id)` 위임). 두 route 모두 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` (ADR `§Decision 5` 권한 열). 편집 3 route(POST · PATCH · DELETE)는 본 slice 에서 **추가하지 않는다**.
- [x] controller 는 **오류 변환 0 · try/catch 0** — `P2025` → 404 변환은 service 소관(ADR `§Decision 5` d 행)이므로 raw forward 하고, 응답 body 는 NestJS 기본 형태 유지(커스텀 envelope 도입 금지). 이 책임 경계를 파일 헤더 주석에 한국어로 박제한다.
- [x] `assessment-collection.module.ts` 의 `controllers` 배열에 `CollectionTargetController` 를 추가한다. `imports` · `providers` · `exports` 배열은 **불변**(`AuthModule` · `CollectionTargetService` 는 이미 등록돼 있음). 새 dependency 0.
- [x] happy-path unit test — `findAll()` 이 service 반환 배열을 가공 없이 그대로 돌려주는 case 1+, `findById()` 가 단건을 그대로 돌려주는 case 1+.
- [x] error path unit test — service 가 `NotFoundException`(`findById`) 또는 임의 오류(`findAll`)를 던질 때 controller 가 **흡수하지 않고 그대로 전파**함을 각 1+ case 로 검증.
- [x] 분기 cover — 본 두 핸들러에는 조건 분기가 없다(순수 위임). 대신 "0 row → 빈 배열 200 (예외 아님)" 과 "row 존재 → 배열 1+" 두 경로를 각각 test 로 고정하고, 분기 부재 사실을 spec 주석에 명시한다.
- [x] negative cases 충분 cover (각 1+ test) — (a) `findAll` 이 인자를 받지 않고 service 를 정확히 1 회 호출, (b) `findById` 가 path param 을 trim · 형식 검증 · 기본값 없이 **그대로** 넘김(빈 문자열 · 공백 포함 값도 가공 0), (c) service 반환값을 복제 · 정렬 · 필터하지 않음(동일 참조), (d) decorator metadata drift guard — 두 route 의 `@Roles` tier 가 `"User"` 이고 guard 가 `[JwtAuthGuard, RolesGuard]` 순서임을 `Reflect.getMetadata` 로 고정, (e) `@Controller` 경로가 `api/collection-targets` 이고 ValidationPipe 3 옵션이 유지됨을 고정, (f) controller 에 편집 tier 핸들러(POST · PATCH · DELETE)가 **아직 없음**을 prototype 메서드 수로 고정(후속 slice 의 회귀 신호).
- [x] `assessment-collection.module.spec.ts` 에 `CollectionTargetController` 가 module 에서 resolve 되고 그 의존이 DI 로 닫힘을 검증하는 case 1+ 추가.
- [x] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 `collection-target.controller.ts` 는 line · function 100% 를 목표로 한다.

## Out of Scope

- POST · PATCH · DELETE 3 route 배선 (편집 tier — 후속 slice, ADR `§Follow-ups (c)` 잔여).
- `CollectionTargetService` · `CollectionTargetRepository` · DTO 2 종의 로직 변경 (전부 T-1809 ~ T-1813 에서 완결 — 본 task 의 production diff 는 controller 신설 + module `controllers` 한 줄뿐).
- pagination · 정렬 · 필터 query param, 응답 envelope, credential 마스킹 helper (ADR 이 전부 비채택 / DB 에 credential 열 자체가 없음).
- e2e · smoke spec 추가 (ADR `§Follow-ups` 후속 축).
- [api.md](../architecture/api.md) · [requirements.md](../requirements.md) doc-sync 및 PLAN `130 행` 완료 선언 (ADR `§Follow-ups (f)` — 5 route 전량 배선 후).
- web AdminView 패널 (ADR `§Follow-ups` 후속 축).
- `{ "endpoint": null }` 오류 계약 확정 (T-1813 reviewer MINOR 승계 Follow-up — 편집 route slice 소관).

## Suggested Sub-agents

`implementer → tester`



## 결과 요약 (driver bookkeeping)

- PR [#1426](https://github.com/myungjoo/Assessment-Agent/pull/1426) round 1 APPROVE → squash merge (main `1fbdac31`).
- `CollectionTargetController` 신설 — controller-scope ValidationPipe 3 옵션 + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`, public handler 정확히 2 개 (GET 목록 · GET 단건) 모두 service 무가공 위임 (오류 변환 0 · try/catch 0).
- `AssessmentCollectionModule` 은 `controllers` 배열 한 줄만 추가 (imports/providers/exports 불변).
- 4 파일 +424/-1. 신규 controller line · function 100%, 전체 463 suite / 13366 test pass (글로벌 line 99.94% · function 100%).

## Follow-ups

- 편집 tier slice (POST · PATCH · DELETE) 가 착지하면 `src/assessment-collection/collection-target.controller.spec.ts` 의 negative (f) prototype 핸들러 목록 test 가 의도적으로 fail 한다 — 그 slice 에서 5 handler 로 갱신해야 한다.

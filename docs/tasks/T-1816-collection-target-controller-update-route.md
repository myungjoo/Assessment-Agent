---
id: T-1816
title: Add the PATCH update route to CollectionTargetController
phase: P5
status: DONE
completedAt: 2026-08-31T02:02:12Z
prNumber: 1428
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-backend
dependsOn: [T-1815]
touchesFiles:
  - src/assessment-collection/collection-target.controller.ts
  - src/assessment-collection/collection-target.controller.spec.ts
estimatedDiff: 250
estimatedFiles: 2
created: 2026-08-31
plannerNote: ADR-0059 Follow-ups (c) 다섯째 조각 — 편집 tier 잔여 2 route 중 PATCH 1 개만 절단 (T-1750 선례)
---

# T-1816 — CollectionTargetController 에 PATCH 부분 수정 route 배선

## Why

오너 지시 [PLAN](../PLAN.md) `130 행`(REQ-070 / REQ-072 / REQ-073) 의 수집 대상 등록·편집 축 chain 을 잇는다. [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (c)` 는 DTO 2 종([T-1812](T-1812-collection-target-create-dto.md) Create · [T-1813](T-1813-collection-target-update-dto.md) Update) · controller 골격 + 조회 tier 2 route([T-1814](T-1814-collection-target-controller-get-routes.md)) · POST 등록 route([T-1815](T-1815-collection-target-controller-create-route.md))까지 착지했고, 남은 것은 **편집 tier 2 route(PATCH · DELETE — `@Roles("Admin")`)** 뿐이다.

두 route 를 한 diff 에 담으면 R-112 spec 분량 때문에 [CLAUDE.md §3](../../CLAUDE.md) cap(≤ 300 LOC / ≤ 5 파일)을 다시 넘긴다. 그래서 [ServiceIdentityController](../../src/user/service-identity.controller.ts) 의 **route 1 개 = slice 1 개** 절단 선례(T-1749 POST → T-1750 PATCH → T-1751 DELETE)를 그대로 승계해, 본 slice 는 **PATCH 부분 수정 route 1 개만** 얹는다. PATCH 가 DELETE 보다 먼저인 이유는 ADR `§Decision 5` DELETE 행이 "일시 제외는 `active=false` PATCH" 로 PATCH 를 전제하고 있고, `UpdateCollectionTargetDto`(T-1813) 가 이미 착지해 **소비처 0 인 채 방치된 유일한 DTO** 이기 때문이다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — 특히 `§Decision 5` 의 route 표 PATCH 행(성공 status **200** · RFC-7396 merge patch · 정체성 축 `type` · `instanceKey` 갱신 제외 · 권한 `Admin+`)과 오류 계약 표 a(401) · b(403) · d(404 `P2025`) · e(400 ValidationPipe) 행, 그리고 "커스텀 envelope 미도입"
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — 본 task 가 route 를 얹을 대상. 기존 controller-scope `ValidationPipe` 3 옵션 · guard stack 순서 · "오류 변환 0 · try/catch 0" 헤더 주석 경계를 그대로 유지할 것. 헤더 주석의 "route (지금까지 배선한 3 행)" 목록도 4 행으로 갱신 대상이다
- [src/assessment-collection/collection-target.controller.spec.ts](../../src/assessment-collection/collection-target.controller.spec.ts) — **colocated spec 위치는 이 파일 그대로** (새 spec 파일 신설 금지). 특히 `447~456 행` 근처의 negative (f) prototype 핸들러 목록 test(현재 3 handler 고정)를 확인할 것
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) `85 행` 이하 — 위임 대상 `update(id, input)` 시그니처와 `P2025` → `NotFoundException` 변환이 **service 소관**이라는 사실
- [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — body 타입. 5 필드(`endpoint` · `orgs` · `repos` · `spaces` · `active`) 전량 optional, 빈 객체 `{}` 도 valid
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `110~140 행` — PATCH handler 의 데코레이터 순서 · `@HttpCode` 미부착 근거(200 은 `@Patch` 기본값) 주석 밀도 선례

## Acceptance Criteria

- [ ] `CollectionTargetController` 에 `update(@Param("id") id: string, @Body() dto: UpdateCollectionTargetDto)` public 핸들러 **1 개만** 추가한다. `@Patch(":id")` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`(POST 와 같은 편집 tier — ADR `§Decision 5` 권한 열) 을 기존 route 와 같은 데코레이터 순서로 부착하고, `service.update(id, dto)` 로 **무가공 위임**한다.
- [ ] 성공 status 는 **200** 이며 NestJS `@Patch` 기본값이므로 `@HttpCode` 를 붙이지 **않는다**. 그 근거를 handler 주석에 한국어로 박제한다.
- [ ] 오류 변환 0 · try/catch 0 유지 — `P2025` → 404 변환은 service 소관(ADR `§Decision 5` 오류 표 d 행), 400 은 controller-scope `ValidationPipe` 소관(e 행)이므로 controller 는 어느 쪽도 재구현하지 않는다. 응답 body 는 NestJS 기본 `HttpException` 형태 유지(커스텀 envelope 도입 금지).
- [ ] 정체성 축(`type` · `instanceKey`) 제거 로직을 controller 에 두지 **않는다** — 두 필드는 `UpdateCollectionTargetDto` 의 허용 축이 아니라 `forbidNonWhitelisted` 가 400 을 내는 구조이며, 그 근거를 handler 주석 1 줄로 박제한다.
- [ ] DELETE route 는 본 slice 에서 **추가하지 않는다**. `assessment-collection.module.ts` 는 **불변**(controller 는 T-1814 가 이미 등록).
- [ ] happy-path unit test — `update()` 가 `id` 와 DTO 를 가공 없이 그대로 `service.update` 에 넘기고 service 반환 row 를 그대로 돌려주는 case 1+.
- [ ] error path unit test — service 가 `NotFoundException`(`:id` row 부재) 을 던질 때와 임의 `Error` 를 던질 때, controller 가 **흡수하지 않고 그대로 전파**함을 각 1+ case 로 검증.
- [ ] 분기 cover — 본 handler 에는 조건 분기가 없다(순수 위임). **빈 객체 `{}` body**(merge patch 의 no-field 요청)와 **여러 필드를 담은 body** 두 입력 경로를 각각 test 로 고정하고, 분기 부재 사실을 spec 주석에 명시한다.
- [ ] negative cases 충분 cover (각 1+ test) — (a) `service.update` 를 정확히 **1 회** 호출하고 다른 service 메서드(`findAll` · `findById` · `create`) 는 **호출 0**, (b) DTO 객체를 복제 · 필드 추가 · 기본값 주입 없이 **동일 참조**로 넘기고 `id` 도 trim · 형식 검증 없이 그대로 전달, (c) service throw 시 후속 처리 없이 단락(다른 service 메서드 호출 0), (d) decorator metadata drift guard — `update` 의 `@Roles` tier 가 `"Admin"` 이고 guard 가 `[JwtAuthGuard, RolesGuard]` 순서이며 method 가 PATCH · path 가 `:id` 이고 `@HttpCode` 미부착임을 `Reflect.getMetadata` 로 고정, (e) 기존 3 route 의 tier(`findAll` · `findById` = `"User"`, `create` = `"Admin"`) 가 **변하지 않았음**을 재확인(편집 route 추가로 인한 권한 회귀 차단).
- [ ] 기존 negative (f) prototype 핸들러 목록 test 를 **4 handler(`findAll` · `findById` · `create` · `update`)** 로 갱신한다(T-1815 Follow-ups 가 예고한 의도적 fail 지점). 갱신 시 "DELETE 는 아직 미배선" 이라는 후속 slice 회귀 신호 성격을 주석에 유지한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `collection-target.controller.ts` 는 line · function 100% 를 유지한다.

## Out of Scope

- DELETE route 배선 (후속 slice — ADR `§Follow-ups (c)` 잔여, 성공 status 204 라 `@HttpCode(204)` 판단이 따로 붙는다).
- **`{ "endpoint": null }` 오류 계약 확정** (T-1813 reviewer MINOR M2 승계). `@IsOptional()` 이 `null` 도 skip 하는 문제는 `UpdateCollectionTargetDto` 의 decorator 축(`@IsOptional` → `@ValidateIf` 등) 을 바꿔야 풀리며, DTO + DTO spec 2 파일의 독립 slice 다. 본 route slice 에 섞으면 4 파일 · 330 LOC 로 cap 을 넘긴다 — Follow-ups 로 이월한다. controller 는 "오류 변환 0" 경계를 지켜 이 문제를 handler 에서 우회하지 **않는다**.
- `CollectionTargetService` · `CollectionTargetRepository` · DTO 2 종의 로직 변경 (T-1809 ~ T-1813 에서 완결 — 본 task 의 production diff 는 controller handler 1 개 + 헤더 주석 갱신뿐).
- `assessment-collection.module.ts` · `assessment-collection.module.spec.ts` 변경 (T-1814 가 이미 배선).
- pagination · 정렬 · 필터 query param, 응답 envelope, credential 마스킹 (ADR 이 전부 비채택 / DB 에 credential 열 자체가 없다 — `§Decision 2`).
- e2e · smoke spec 추가 (ADR `§Follow-ups (d)` 축).
- [api.md](../architecture/api.md) · [requirements.md](../requirements.md) doc-sync 및 PLAN `130 행` 완료 선언 (ADR `§Follow-ups (f)` — 5 route 전량 배선 후).
- web AdminView 등록·편집 패널 (ADR `§Follow-ups (e)` 축).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

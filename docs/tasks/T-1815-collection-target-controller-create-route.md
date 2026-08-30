---
id: T-1815
title: Add the POST create route to CollectionTargetController
phase: P5
status: DONE
completedAt: 2026-08-30T23:56:18Z
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-backend
dependsOn: [T-1814]
touchesFiles:
  - src/assessment-collection/collection-target.controller.ts
  - src/assessment-collection/collection-target.controller.spec.ts
estimatedDiff: 250
estimatedFiles: 2
created: 2026-08-30
plannerNote: ADR-0059 Follow-ups (c) 넷째 조각 — 편집 tier 3 route 중 POST 등록 1 개만 절단 (T-1749 선례)
---

# T-1815 — CollectionTargetController 에 POST 등록 route 배선

## Why

오너 지시 [PLAN](../PLAN.md) `130 행`(REQ-070 / REQ-072 / REQ-073) 의 수집 대상 등록·편집 축 chain 을 잇는다. [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (c)` 는 DTO 2 종([T-1812](T-1812-collection-target-create-dto.md) Create · [T-1813](T-1813-collection-target-update-dto.md) Update)과 controller 골격 + 조회 tier 2 route([T-1814](T-1814-collection-target-controller-get-routes.md))까지 착지했고, 남은 것은 **편집 tier 3 route(POST · PATCH · DELETE — `@Roles("Admin")`)** 뿐이다.

3 route 를 한 diff 에 담으면 R-112 spec 분량 때문에 [CLAUDE.md §3](../../CLAUDE.md) cap(≤ 300 LOC / ≤ 5 파일)을 넘긴다. 그래서 [ServiceIdentityController](../../src/user/service-identity.controller.ts) 의 **route 1 개 = slice 1 개** 절단 선례(T-1749 POST `245 insertions` → T-1750 PATCH → T-1751 DELETE)를 그대로 승계해, 본 slice 는 **POST 등록 route 1 개만** 얹는다. 등록(POST)이 먼저인 이유는 ADR `§Decision 5` 오류 표 c 행(`P2002` → 409)이 등록 경로에만 걸려 있고, REQ-070 의 "빈 상태에서 막히지 않도록" 이 곧 **첫 row 를 만드는 경로**이기 때문이다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — 특히 `§Decision 5` 의 route 표 POST 행(성공 status **201** · 권한 `Admin+`)과 오류 계약 표 a(401) · b(403) · c(409 `P2002`) · e(400 ValidationPipe) 행, 그리고 "커스텀 envelope 미도입"
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — 본 task 가 route 를 얹을 대상. 기존 controller-scope `ValidationPipe` 3 옵션 · guard stack 순서 · "오류 변환 0 · try/catch 0" 헤더 주석 경계를 그대로 유지할 것
- [src/assessment-collection/collection-target.controller.spec.ts](../../src/assessment-collection/collection-target.controller.spec.ts) — **colocated spec 위치는 이 파일 그대로** (새 spec 파일 신설 금지). 특히 negative (f) 의 prototype 핸들러 목록 test 를 확인할 것
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) — 위임 대상 `create(input)` 시그니처와 `P2002` → `ConflictException` 변환이 **service 소관**이라는 사실
- [src/assessment-collection/dto/create-collection-target.dto.ts](../../src/assessment-collection/dto/create-collection-target.dto.ts) — body 타입. 7 필드(`type` · `instanceKey` · `endpoint` 필수 / `orgs` · `repos` · `spaces` · `active` optional)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `105 행` 이하 — POST handler 의 데코레이터 순서 · `@HttpCode` 미부착 근거 주석 밀도 선례

## Acceptance Criteria

- [ ] `CollectionTargetController` 에 `create(@Body() dto: CreateCollectionTargetDto)` public 핸들러 **1 개만** 추가한다. `@Post()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`(조회 2 route 의 `"User"` 와 다른 tier — ADR `§Decision 5` 권한 열) 을 기존 route 와 같은 데코레이터 순서로 부착하고, `service.create(dto)` 로 **무가공 위임**한다.
- [ ] 성공 status 는 **201** 이며 NestJS `@Post` 기본값이므로 `@HttpCode` 를 붙이지 **않는다**. 그 근거를 handler 주석에 한국어로 박제한다.
- [ ] 오류 변환 0 · try/catch 0 유지 — `P2002` → 409 변환은 service 소관(ADR `§Decision 5` c 행), 400 은 controller-scope `ValidationPipe` 소관(e 행)이므로 controller 는 어느 쪽도 재구현하지 않는다. 응답 body 는 NestJS 기본 `HttpException` 형태 유지(커스텀 envelope 도입 금지).
- [ ] PATCH · DELETE 2 route 는 본 slice 에서 **추가하지 않는다**. `assessment-collection.module.ts` 는 **불변**(controller 는 T-1814 가 이미 등록).
- [ ] happy-path unit test — `create()` 가 DTO 를 가공 없이 그대로 `service.create` 에 넘기고 service 반환 row 를 그대로 돌려주는 case 1+.
- [ ] error path unit test — service 가 `ConflictException`(중복 등록) 을 던질 때와 임의 `Error` 를 던질 때, controller 가 **흡수하지 않고 그대로 전파**함을 각 1+ case 로 검증.
- [ ] 분기 cover — 본 handler 에는 조건 분기가 없다(순수 위임). optional 필드가 **있는 body** 와 **필수 3 필드만 있는 body** 두 입력 경로를 각각 test 로 고정하고, 분기 부재 사실을 spec 주석에 명시한다.
- [ ] negative cases 충분 cover (각 1+ test) — (a) `service.create` 를 정확히 **1 회** 호출하고 조회 메서드(`findAll` · `findById`) 는 **호출 0**, (b) DTO 객체를 복제 · 필드 추가 · 기본값 주입 없이 **동일 참조**로 넘김, (c) service throw 시 후속 처리 없이 단락(다른 service 메서드 호출 0), (d) decorator metadata drift guard — `create` 의 `@Roles` tier 가 `"Admin"` 이고 guard 가 `[JwtAuthGuard, RolesGuard]` 순서이며 method 가 POST · path 가 `/` 임을 `Reflect.getMetadata` 로 고정, (e) 기존 조회 2 route 의 `@Roles("User")` tier 가 **변하지 않았음**을 재확인(편집 tier 추가로 인한 권한 회귀 차단).
- [ ] 기존 negative (f) prototype 핸들러 목록 test 를 **3 handler(`findAll` · `findById` · `create`)** 로 갱신한다(T-1814 Follow-ups 가 예고한 의도적 fail 지점). 갱신 시 "PATCH · DELETE 는 아직 미배선" 이라는 후속 slice 회귀 신호 성격을 주석에 유지한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `collection-target.controller.ts` 는 line · function 100% 를 유지한다.

## Out of Scope

- PATCH · DELETE 2 route 배선 (후속 slice — ADR `§Follow-ups (c)` 잔여).
- `{ "endpoint": null }` 오류 계약 확정 (T-1813 reviewer MINOR M2 승계 — `UpdateCollectionTargetDto` 축이라 **PATCH slice** 소관).
- `CollectionTargetService` · `CollectionTargetRepository` · DTO 2 종의 로직 변경 (T-1809 ~ T-1813 에서 완결 — 본 task 의 production diff 는 controller handler 1 개뿐).
- `assessment-collection.module.ts` · `assessment-collection.module.spec.ts` 변경 (T-1814 가 이미 배선).
- pagination · 정렬 · 필터 query param, 응답 envelope, credential 마스킹 (ADR 이 전부 비채택 / DB 에 credential 열 자체가 없음 — `§Decision 2`).
- e2e · smoke spec 추가 (ADR `§Follow-ups (d)` 축).
- [api.md](../architecture/api.md) · [requirements.md](../requirements.md) doc-sync 및 PLAN `130 행` 완료 선언 (ADR `§Follow-ups (f)` — 5 route 전량 배선 후).
- web AdminView 등록·편집 패널 (ADR `§Follow-ups (e)` 축).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups


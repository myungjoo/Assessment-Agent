---
id: T-1750
title: Add the PATCH update route to ServiceIdentityController
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-073]
independentStream: service-identity-backend
dependsOn: [T-1749]
touchesFiles:
  - src/user/service-identity.controller.ts
  - src/user/service-identity.controller.spec.ts
  - src/user/user.module.ts
estimatedDiff: 240
estimatedFiles: 3
created: 2026-08-28
completedAt: 2026-08-28T04:53:16Z
prNumber: 1380
mergeCommit: be71f725
plannerNote: P5 / PLAN 132 행 오너 지시 chain — ADR-0058 §Follow-ups (b) 잔여 3 route 중 PATCH 수정 1 개만 절단
---

# T-1750 — ServiceIdentityController 에 PATCH 수정 route 1 개 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(인원별 ServiceIdentity 관리 API·UI, R-182~R-183) chain 에서
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (a)`(DTO · service ·
repository)는 T-1739~T-1747 로 마감됐고, `§Follow-ups (b)`(controller + RBAC 배선)는
[T-1748](T-1748-service-identity-controller-list.md)(GET 목록) · [T-1749](T-1749-service-identity-controller-create.md)(POST 생성)
까지 진행돼 **PATCH 수정 · DELETE 삭제 · primary 지정 3 route 가 미노출**이다. 그래서 등록한 서비스 ID 의
오타를 UI 에서 고칠 HTTP 경로가 아직 0 이다.

본 slice 는 그 잔여 3 route 중 **PATCH 수정 1 개만** 가져간다. 직전 controller slice 실적이 route 1 개당
`+245/-24` ~ `+300/-1`(handler + spec) 이라 2 route 이상을 한 commit 에 담으면
[CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 확실히 넘기 때문이다. service 쪽
`ServiceIdentityService.update`(3 단 404 · 미전달 보존 no-op · `P2025` → 404)는
[T-1743](T-1743-service-identity-service-update.md) 이 이미 박제했으므로 본 task 는 **HTTP 노출만** 한다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 1`(route 표의 PATCH 행 · 성공 200), `§Decision 3`(갱신 축은 `externalId` 단일 · `isPrimary`
  와 `service` 금지 · RFC-7396 미전달 보존), `§Decision 4`(RBAC — 편집은 Admin+),
  `§Decision 5`(오류 계약 · controller 는 추가 변환 0 raw forward)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 확장 대상.
  헤더 주석의 route 목록 · 책임 경계 · controller-scope `ValidationPipe` 3 옵션 설정
- [src/user/service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) —
  colocated spec. fixture · service mock · guard/metadata 검증 관례를 그대로 재사용한다
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `136~182 행` —
  `update(personId, identityId, dto)` 시그니처와 오류 계약(404 3 단 · `P2025` → 404 · 그 외 propagate)
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) —
  body DTO(`externalId?` 단일 축, `@ValidateIf` 로 null 400)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `76~95 행` — 기존 `@Patch(":id")`
  route 의 param + body DTO + `@Roles("Admin")` 배선 관례(mirror 대상)
- [src/user/user.module.ts](../../src/user/user.module.ts) `24~31 행` — 헤더 주석의 endpoint 목록
  (본 task 에서 문구만 갱신, `controllers`·`providers`·`exports` 배열 diff 0)

## Acceptance Criteria

- [x] `ServiceIdentityController` 에 `@Patch(":identityId")` handler 1 개 추가 — path param
      `personId` · `identityId`, body `UpdateServiceIdentityDto`, `service.update(personId, identityId, dto)`
      로 1 회 위임 후 반환값 무가공 전달. 성공 status 는 NestJS 기본 200 이므로 `@HttpCode` 미부착.
- [x] guard stack 은 `@UseGuards(JwtAuthGuard, RolesGuard)` 동일 순서 + `@Roles("Admin")`(편집 tier,
      ADR-0058 §Decision 4). controller 안 `try`/`catch` 0 — 오류는 raw forward.
- [x] **happy-path unit test 1+** — 유효 body 로 호출 시 `service.update` 가 정확히 1 회, 인자
      (`personId`·`identityId`·dto) 가 일치하고 반환 참조가 그대로 전달되는지 검증.
- [x] **error path unit test 1+** — service 가 `NotFoundException`(404) 을 던질 때 controller 가
      변환 없이 **동일 인스턴스**를 전파하는지, 일반 `Error` 도 동일하게 전파하는지 각 1+ 검증.
- [x] **분기 cover** — handler 자체에 코드 분기가 없으면 그 근거를 주석으로 명시하고, guard/route
      metadata 축(HTTP method · path param · `@Roles` tier 가 GET 의 `"User"` 와 다름 · guard 순서 ·
      `@HttpCode` 미부착)으로 각 1+ test 를 대체 배치한다.
- [x] **negative cases 충분 cover** — 최소 4 종: (a) 빈 `identityId` 도 controller 가 가공 없이
      위임, (b) service throw 시 단락되어 다른 collaborator 호출 0 회, (c) `UpdateServiceIdentityDto`
      키 집합이 `externalId` 1 개로 불변(= `isPrimary`·`service` 미노출), (d) 미전달 body(`{}`)도
      controller 가 그대로 위임(보존 semantic 은 service 책임).
- [x] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 handler 는 line·function 100%.
- [x] `src/user/user.module.ts` 헤더 주석의 endpoint 목록을 "GET · POST · PATCH 3 endpoint (잔여
      2 route 는 후속 slice)" 로 갱신. 배열 diff 0.
- [x] 변경 파일 ≤ 3 개, diff ≤ 300 LOC.

## Out of Scope

- DELETE 삭제 route · primary 지정 action POST route 배선 (각각 후속 slice).
- `ServiceIdentityService` · `ServiceIdentityRepository` · DTO 의 로직 변경 (헤더 주석 외 diff 0).
- e2e / smoke spec 신설 (ADR-0058 §Follow-ups (c)).
- `docs/architecture/api.md` · `docs/requirements.md` doc-sync (§Follow-ups (e)) 및 완료 표기.
- `web/` 편집 UI (§Follow-ups (d)) · `prisma/` · `package.json` · `.github/workflows/` 변경.
- 응답 envelope · pagination · 정렬 query param 도입.

## Suggested Sub-agents

`implementer → tester`



## Result (DONE)

PR [#1380](https://github.com/myungjoo/Assessment-Agent/pull/1380) squash merge → main `be71f725` (2026-08-28T04:53:16Z).
`ServiceIdentityController` 에 `@Patch(":identityId")` handler 1 개를 추가해 `service.update(personId, identityId, dto)`
로 1 회 위임하고 반환값을 무가공 전달한다 — `@HttpCode` 미부착이라 NestJS 기본 200, guard 는
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`(편집 tier), controller 안 `try`/`catch` 0 이라
`NotFoundException` · 일반 `Error` 모두 동일 인스턴스로 raw forward 된다. `user.module.ts` 는 헤더 주석
endpoint 목록만 3 route 기준으로 갱신해 배열 diff 0. 3 파일 `+243/-17`.

spec 은 PATCH 위임 9 케이스 + route/guard metadata 4 케이스를 더해 R-112 4 종을 덮었다 — happy(인자 3 종
일치 + 반환 동일 참조) / error path(404 · 일반 `Error` 전파) / 분기(handler 분기 0 근거 주석 + metadata 축
4 케이스 대체) / negative 6 종(빈 `identityId` 위임 · throw 단락 시 collaborator 0 회 · DTO 키 집합 불변 ·
빈 body 위임 등). 대상 파일 line · branch · function 100%, 전체 458 suite / 13183 test green
(line 99.94% / function 100%). reviewer APPROVE round 1/7 + PR comment 외부 post + CI 2 job pass 로
4-게이트 충족.

## Follow-ups

- `src/user/service-identity.service.ts` `33~35 행` 헤더 주석이 "GET 1 개만 노출 / POST · PATCH · DELETE ·
  primary 4 route 미배선" 으로 T-1749 시점부터 drift 중 — 잔여 2 route(DELETE 삭제 · primary 지정) slice 에서
  일괄 정정 권고.


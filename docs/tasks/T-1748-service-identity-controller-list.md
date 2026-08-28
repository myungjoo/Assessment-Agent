---
id: T-1748
title: Add ServiceIdentityController with the GET list route and guard stack
phase: P5
status: DONE
commitMode: pr
prNumber: 1378
coversReq: [REQ-078, REQ-073]
independentStream: service-identity-backend
dependsOn: [T-1741, T-1747]
touchesFiles:
  - src/user/service-identity.controller.ts
  - src/user/service-identity.controller.spec.ts
  - src/user/user.module.ts
  - src/user/user.module.spec.ts
estimatedDiff: 275
estimatedFiles: 4
created: 2026-08-28
completed: 2026-08-28T02:59:12Z
mergeCommit: bfb186b8
plannerNote: P5 / PLAN 132 행 오너 지시 chain — ADR-0058 §Follow-ups (b) controller 배선의 첫 slice (GET 1 route 만)
---

# T-1748 — ServiceIdentityController 신설 + GET 목록 route 1 개 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(ServiceIdentity 관리 API·UI, R-182~R-183) chain 에서
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (a)`(DTO + service +
repository) 는 [T-1739](T-1739-service-identity-dtos.md) ~ [T-1747](T-1747-service-identity-delete-primary-repromotion.md)
로 마감됐다. 그런데 **controller · route 가 0 개라 완성된 service 를 HTTP 로 부를 수 없다** — REQ-078 의
"조회·추가·수정·삭제 API 제공" 이 아직 0 이다. 본 slice 는 그 다음 항목인 `§Follow-ups (b)`(controller +
RBAC 배선) 를 시작하되, `§Decision 1` 의 5 route 를 한 commit 에 담으면 [CLAUDE.md](../../CLAUDE.md) §3 의
300 LOC 상한을 확실히 넘기므로(직전 slice 들이 method 1 개당 `+262` ~ `+298`) **controller 골격 + guard
stack + GET 목록 route 1 개**만 절단한다. 나머지 4 route(POST · PATCH · DELETE · primary 지정)는 후속 slice 다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  `§Decision 1`(route 표 — 본 slice 는 GET 행 하나만), `§Decision 4`(guard stack · 401/403 발생 지점),
  `§Decision 5` (c)(GET 도 Person 부재 시 404 — 단 변환은 service 책임, controller 는 raw forward).
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) — `@UseGuards(JwtAuthGuard,
  RolesGuard)` + `@Roles("User")` 의 production 선례와 import 경로(`../auth/jwt-auth.guard` ·
  `../auth/roles.decorator` · `../auth/roles.guard`). 1:1 mirror 대상.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `1~50 행` — controller-scope
  `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` 설정(ADR-0058
  `§Decision 2` 가 그대로 승계하라고 못 박은 pipe 옵션).
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) — 특히
  `findByPersonId(personId)` 시그니처와 헤더 주석의 "controller · route · guard 배선 없음" 문구
  (본 slice 가 갱신 대상).
- [src/user/user.module.ts](../../src/user/user.module.ts) — `controllers` 배열과 헤더 주석의 controllers
  단락(`25 행` 부근). `ServiceIdentityService` 는 이미 providers/exports 에 등록돼 있다(T-1741) — providers
  변경 0.
- [src/user/assessment.controller.spec.ts](../../src/user/assessment.controller.spec.ts) — guard metadata
  (`Reflect.getMetadata("__guards__", ...)`) · `@Roles` metadata 검증 관례. **케이스를 통째로 베끼지 말고
  패턴만 승계**(본 slice spec 은 route 1 개 분량).
- [src/user/user.module.spec.ts](../../src/user/user.module.spec.ts) `285~300 행` 부근 — controller 등록
  resolve test 관례.

## 구현 방향 (범위 절단 포함)

1. `src/user/service-identity.controller.ts` 신설 — `@Controller("api/persons/:personId/identities")`
   (ADR `§Decision 1` 의 nested path 그대로) + controller-scope `ValidationPipe`(위 옵션 3 종) +
   `ServiceIdentityService` 생성자 주입.
2. route 는 **GET 목록 1 개만** — `@Get()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` +
   `@Param("personId") personId: string` → `service.findByPersonId(personId)` 를 그대로 반환. 성공 status 는
   NestJS 기본 200 이므로 `@HttpCode` 불요.
3. **controller 는 추가 변환 0** — service 가 던지는 `NotFoundException`(Person 부재) 을 잡지 않고 그대로
   전파한다(ADR `§Decision 5` 서두 "controller 는 raw forward"). try/catch 금지.
4. `user.module.ts` 의 `controllers` 배열에 `ServiceIdentityController` 추가 + 헤더 주석 controllers 단락에
   1~2 줄 추가. providers · exports 배열 변경 0.
5. `service-identity.service.ts` 헤더 주석의 "controller · route · guard 배선 없음 (ADR-0058 §Follow-ups
   (b))" 문구를 본 slice 반영으로 **해당 bullet 만** 교체(GET 만 노출됐고 나머지 4 route 는 후속임을 명시).
   장문 재작성 금지 — 이 파일은 1 bullet 수정에 한해 건드릴 수 있고 로직 변경 0 이다.
6. spec 은 route 1 개 분량으로 좁게 — 아래 Acceptance Criteria 의 항목을 덮는 최소 케이스만.

## Acceptance Criteria

- [ ] `src/user/service-identity.controller.ts` 에 `ServiceIdentityController` 가 존재하고 base path 가
      `api/persons/:personId/identities`, GET route 가 `service.findByPersonId(personId)` 를 정확히 1 회
      호출하며 반환값을 가공 없이 그대로 돌려준다.
- [ ] guard metadata 검증 — GET handler 에 `JwtAuthGuard` + `RolesGuard` 가 이 순서로 붙어 있고
      `@Roles("User")` metadata 가 박혀 있음을 test 로 고정(ADR `§Decision 4`).
- [ ] controller-scope `ValidationPipe` 의 옵션 3 종(`whitelist` · `forbidNonWhitelisted` · `transform`)이
      모두 `true` 임을 test 로 고정.
- [ ] happy-path unit test 1+ — service 가 2 row 를 돌려줄 때 controller 가 같은 배열을 그대로 반환하고
      `findByPersonId` 인자가 URL 의 `personId` 와 일치함을 검증.
- [ ] error path unit test 1+ — service 가 `NotFoundException`(Person 부재) 을 throw 하면 controller 가
      **변환·흡수 없이 그대로 전파**함을 검증. 일반 `Error` 전파도 1 케이스.
- [ ] 분기 cover — controller 의 GET handler 자체에는 조건 분기가 없다(순수 위임). 따라서 분기 축은
      **guard tier** 로 대체해 (a) `@Roles("User")` metadata 존재 · (b) 인증/권한 판정이 controller 코드가
      아니라 guard layer 소관임을 metadata 로 고정하는 2 케이스로 덮는다. 그 외 분기 없음 — 이 항목의
      코드 분기 test 는 해당 없음을 spec 주석 1 줄로 명시.
- [ ] negative cases 충분 cover — 예외 상황 각 1+: 빈 문자열 `personId` 도 가공 없이 service 로 전달 ·
      service 가 빈 배열을 주면 빈 배열 200(예외 아님) · service throw 시 후속 처리 0 회(호출 횟수로 단락
      확인) · service 를 mock 으로 대체했을 때 controller 가 다른 collaborator 를 부르지 않음.
- [ ] `UserModule` compile test 에서 `ServiceIdentityController` 가 resolve 된다(user.module.spec.ts 에
      케이스 1 개 추가). providers · exports 배열은 변경 0 임을 diff 로 확인 가능.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 controller 파일 coverage 100% 목표.
- [ ] diff ≤ 300 LOC / 변경 파일 ≤ 5 개 ([CLAUDE.md](../../CLAUDE.md) §3) — 목표는 4~5 파일 / ≤ 280 LOC.

## Out of Scope

- **나머지 4 route 배선 0** — POST(create) · PATCH(update) · DELETE · POST primary 지정은 각각 후속 slice.
  본 slice 는 GET 1 개만 노출한다.
- **service · repository · DTO · 순수 모듈 로직 변경 0** — `service-identity.service.ts` 는 헤더 주석
  1 bullet 교체만 허용하고 메서드 본문은 손대지 않는다.
- **e2e / smoke spec 추가 0** — ADR-0058 `§Follow-ups (c)` 의 별도 slice.
- **`docs/architecture/api.md` · `docs/requirements.md` 갱신 0** — `§Follow-ups (e)` doc-sync slice 소관.
  본 slice 는 코드만 건드린다(commitMode mixed 금지, CLAUDE.md §3.1).
- **auth 결정 0** — `RolesGuard` / `ROLE_HIERARCHY` / `JwtAuthGuard` 어느 것도 수정하지 않는다.
- **응답 envelope · pagination · 정렬 query param 도입 0** — repository 순서 그대로 forward.
- 기존 controller spec 대량 재작성 금지 — 신규 spec 파일 + `user.module.spec.ts` 케이스 1 개 추가로 한정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- [T-1747](T-1747-service-identity-delete-primary-repromotion.md) 이월분: `src/user/service-identity-primary-order.ts`
  헤더 주석의 "**소비처는 현재 0 이다.** 다음 slice 가 ... 배선한다" 단락이 T-1747 머지로 사실과 어긋난다
  (reviewer 가 PR #1377 에 MINOR 로 외화). 본 slice 도 그 파일을 건드리지 않으므로 여전히 미해소 — 후속
  주석 1 단락 교체 slice 또는 같은 파일을 손대는 다음 PR 안에서 정리 권고.

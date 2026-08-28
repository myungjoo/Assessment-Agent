---
id: T-1752
title: Add the primary-designation route to ServiceIdentityController
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-024]
independentStream: service-identity-backend
dependsOn: [T-1751]
touchesFiles:
  - src/user/service-identity.controller.ts
  - src/user/service-identity.controller.spec.ts
  - src/user/user.module.ts
estimatedDiff: 250
estimatedFiles: 3
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (b) 마지막 잔여 route(primary 지정) 1 개 — chain 완결
---

# T-1752 — ServiceIdentityController 에 primary 지정 route 배선

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (b)` 의 controller 배선 chain (T-1748 GET → T-1749 POST → T-1750 PATCH → T-1751 DELETE) 을 닫는 **마지막 slice** 다. `§Decision 1` 의 route 표 5 행 중 현재 main 에 4 개가 노출돼 있고 남은 것은 **primary 지정 전용 경로** (`POST /api/persons/:personId/identities/:identityId/primary`) 1 개뿐이다.

service `setPrimary` (Person 선검사 404 · 소유 아님 404 · 이미 primary 여도 early return 하지 않는 idempotent 계약 · `P2025` → 404) 는 T-1744 에서 이미 완결돼 본 slice 에 도메인 로직 변경이 0 이고 HTTP 노출만 남았다. 직전 slice 실적 (route 1 개 = `+245/-24` · `+243/-17` · `+249/-28`) 상 본 slice 도 [CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한 안에 들어온다. 본 task 가 머지되면 `§Follow-ups (b)` 가 마감되고 잔여는 `(c)` e2e · `(d)` UI · `(e)` doc-sync 로 넘어간다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 **primary 행** (`73~79 행` 부근: action POST · `@HttpCode(200)` 명시 · 새 row 를 만들지 않으므로 201 아님 · idempotent), `§Decision 3` (primary 를 PATCH body 축이 아니라 전용 경로로 뺀 이유), `§Decision 4` RBAC, `§Decision 5` 오류 변환표
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 확장 대상. 헤더 주석의 route 목록 · 4 route 배선 패턴 · 순수 위임 관례 · 기존 `@Post()` create handler (본 route 와 path 가 다름에 주의)
- [src/user/service-identity.controller.spec.ts](../../src/user/service-identity.controller.spec.ts) — 기존 GET · POST · PATCH · DELETE describe 구조와 mock service 패턴 (colocated spec — 신규 케이스는 이 파일에 추가한다, 새 spec 파일 신설 금지)
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `201~228 행` `setPrimary(personId, identityId)` — 시그니처와 반환 계약 (**승격된 row 를 반환**) 및 그 위 주석의 idempotent 근거
- [src/user/user.module.ts](../../src/user/user.module.ts) `25~31 행` · `107 행` 부근 — 헤더 주석의 endpoint 목록 갱신만 (배열 diff 0 이어야 함)

## Acceptance Criteria

- [ ] `ServiceIdentityController` 에 `@Post(":identityId/primary")` handler 1 개 추가 — `service.setPrimary(personId, identityId)` 를 **정확히 1 회** 호출하고 반환값을 무가공 전달.
- [ ] 성공 status 는 **200** — POST 의 NestJS 기본값이 201 이므로 `@HttpCode(200)` 을 **명시적으로** 부착한다 (ADR `§Decision 1` primary 행: 새 row 를 만들지 않으므로 201 아님).
- [ ] guard stack 은 `@UseGuards(JwtAuthGuard, RolesGuard)` 순서 + `@Roles("Admin")` (편집 tier — GET 목록의 `"User"` 와 독립, ADR `§Decision 4`).
- [ ] controller 안 `try`/`catch` 0 — 404 (Person 부재 · 소유 아님 · `P2025`) 는 service 가 이미 `NotFoundException` 으로 만들므로 raw forward. body 를 받지 않으므로 `@Body()` 미사용.
- [ ] happy-path unit test 1+ — handler 가 `service.setPrimary` 를 1 회 호출하고 인자 2 종 (`personId` · `identityId`) 이 그대로 전달되며 승격된 row 가 **동일 참조** 로 반환되는지 검증.
- [ ] error path unit test 1+ — service 가 `NotFoundException` 을 던지는 경우와 일반 `Error` 를 던지는 경우 각각 **동일 인스턴스가 변환 없이 전파** 되는지 검증.
- [ ] 분기 test — handler 에 코드 분기가 없으므로 (순수 위임) 그 근거를 주석으로 명시하고, 대신 route metadata 축 (`@Post` path 가 `":identityId/primary"` · `@HttpCode(200)` 부착 · `@Roles` tier 가 `"Admin"` · guard 순서 `JwtAuthGuard` → `RolesGuard`) 을 각각 1+ 케이스로 대체 검증.
- [ ] negative cases 충분 cover — ① 빈 `identityId` 도 가공 없이 위임 / ② service throw 시 다른 collaborator 호출 0 회 (단락) / ③ **이미 primary 인 row 재요청도 early return 없이 그대로 위임** (idempotent — handler 가 자체 판단하지 않음, ADR `§Decision 1`) / ④ 기존 create handler 의 `@Post()` path 가 본 변경으로 회귀하지 않고 두 POST route 의 path metadata 가 서로 다름 / ⑤ GET · PATCH · DELETE 3 route 의 기존 metadata 회귀 없음 — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `service-identity.controller.ts` 는 line · branch · function 100% 유지.
- [ ] `user.module.ts` 는 헤더 주석의 endpoint 목록만 5 route 기준으로 갱신 — `controllers` · `providers` · `exports` 배열 diff 0.
- [ ] `service-identity.controller.ts` 헤더 주석의 "현재 4 route 배선 / 잔여 primary 지정 1 route" 서술을 **5 route 전량 배선 · `§Follow-ups (b)` 마감** 으로 갱신하고, 잔여 후속은 `(c)` e2e · `(e)` doc-sync 임을 명시.

## Out of Scope

- service · repository · DTO 로직 변경 (T-1739 ~ T-1747 에서 이미 완결). `setPrimary` 재구현 · `$transaction` 재구현 금지.
- e2e / smoke spec 추가 — ADR-0058 `§Follow-ups (c)` 의 별도 slice.
- [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) 의 route 표 · REQ status doc-sync — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- ADR-0058 본문의 `§Follow-ups (b)` 완료 표기 — ADR 본문 수정은 본 task 범위 밖 (`(e)` 에서 실측 기준 재판정).
- AdminView 편집 UI (`§Follow-ups (d)`).
- 응답 envelope · pagination · 정렬 query param 도입.
- `service-identity-primary-order.ts` 헤더 주석 stale 정정 등 직전 reviewer MINOR 건.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음)

## 완료 기록

- **완료 시각**: 2026-08-28T06:56:01Z (squash merge)
- **PR**: [#1382](https://github.com/myungjoo/Assessment-Agent/pull/1382) — reviewer APPROVE round 1/7, 4-게이트 충족 후 squash merge + branch delete
- **머지 commit**: `adf1658e`
- **결과 요약**: `ServiceIdentityController` 에 `@Post(":identityId/primary")` handler 1 개를 추가해 `service.setPrimary` 로 순수 위임하고, `@HttpCode(200)` 을 명시해 POST 기본 201 을 덮었다. guard 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, controller 안 `try`/`catch` 0 이라 404 는 raw forward 다. 3 파일 `+256/-25`, controller line·branch·function 100%, 전체 458 suite / 13208 test green. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 1` 의 5 route 가 전량 노출돼 `§Follow-ups (b)` 가 마감됐고, 잔여는 `(c)` e2e · `(d)` UI · `(e)` doc-sync 다.

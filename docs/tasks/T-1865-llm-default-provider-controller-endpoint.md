---
id: T-1865
title: PUT /api/llm/providers/default 엔드포인트 + DTO + 기본 row 삭제 409 + api.md
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1864]
touchesFiles:
  - src/llm/llm-provider-config.controller.ts
  - src/llm/llm-provider-config.controller.spec.ts
  - src/llm/dto/set-default-llm-provider.dto.ts
  - src/llm/llm-provider-config.service.ts
  - docs/architecture/api.md
estimatedDiff: 240
estimatedFiles: 5
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 4/7. service.ts 는 택1 (i) 일 때만 delete 409 분기로 재진입, (ii) 면 무변경 — touchesFiles 는 보수적으로 포함"
---

# T-1865 — PUT /api/llm/providers/default 엔드포인트 + DTO + 기본 row 삭제 409 + api.md

## Why

[T-1864](T-1864-llm-default-provider-resolver-precedence-service.md) 의 `setDefault` 를 HTTP 로 노출한다. Web UI (T-1866) 가 호출할 유일한 쓰기 경로이며, 오너 지시 (2026-09-03) "Web UI 에서 선택" 의 backend 절반이다. 함께 [ADR-0062](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) (4) "기본 row 삭제는 409" 를 닫는다.

**NestJS 라우팅 함정** — [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 는 `@Get(":id")` (`106 행`) · `@Patch(":id")` · `@Delete(":id")` 를 갖는다. 정적 path `default` 는 선언 순서상 `:id` 계열보다 **앞** 에 두어야 `PUT /providers/default` 가 `:id = "default"` 로 오매칭되지 않는다 (PUT 은 현재 `:id` 핸들러가 없어 실충돌은 없지만, 이후 `PUT /:id` 추가 시 회귀를 막기 위해 위치 + 주석 + test 로 고정).

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — (B) API shape 택1 (권장 `PUT /api/llm/providers/default` body `{ llmProviderConfigId }`) · (4) 삭제 409.
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — Admin+ RBAC decorator 3 종, controller-scope ValidationPipe (whitelist + forbidNonWhitelisted), 기존 5 핸들러 주석 규약.
- [src/llm/dto/assign-difficulty-mapping.dto.ts](../../src/llm/dto/assign-difficulty-mapping.dto.ts) — `llmProviderConfigId` 단일 필드 DTO 의 선례 (IsString / IsNotEmpty / MaxLength 255). 그대로 mirror.
- [src/llm/llm-provider-config.controller.spec.ts](../../src/llm/llm-provider-config.controller.spec.ts) — service mock + RBAC reflect 검증 패턴.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `240~270 행` — delete 의 P2003 → 409 변환. 택1 (i) 면 여기에 "삭제 대상이 기본 row 면 `ConflictException`" 사전 분기 추가.
- [docs/architecture/api.md](../architecture/api.md) `128~135 행` — UC-05 표. 새 행 1 + GET/DELETE 행 갱신.

## Acceptance Criteria

- [ ] `SetDefaultLlmProviderDto { llmProviderConfigId: string }` 신설 (`@IsString @IsNotEmpty @MaxLength(255)`).
- [ ] `@Put("default")` 핸들러 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `@HttpCode(200)`, body DTO → `service.setDefault(id)` → sanitize view (`isDefault: true`). **`@Get(":id")` 보다 앞에 선언** + 그 이유 주석.
- [ ] 기본 row `DELETE /:id` → 409 `ConflictException` (한국어 메시지: "기본 provider 로 지정된 설정은 삭제할 수 없다 — 먼저 다른 provider 를 기본으로 지정하라"). 택1 (ii) 면 P2003 경로가 이미 409 이므로 메시지만 두 원인 (난이도 슬롯 in-use / 기본 지정) 을 구분해 안내.
- [ ] api.md UC-05 표에 `PUT /api/llm/providers/default` 행 추가 (Admin+, 200, 404 부재 id, 400 DTO 위반 / extra 키), `GET /api/llm/providers` 행의 view 필드 목록에 `isDefault` 추가 (6 → 7 필드), `DELETE` 행에 기본 row 409 사유 추가. `§ 5` 200 OK / 201 목록 표 (`181 행` 부근) 에 PUT 200 명시 부착 반영.
- [ ] controller happy-path 1+ — 정상 body → 200 + view `isDefault === true`, service.setDefault 가 body id 로 1 회 호출.
- [ ] error path 1+ — service 가 `NotFoundException` throw 시 404 그대로 propagate, 의존성 reject raw propagate.
- [ ] 분기 cover — RBAC: `Reflect.getMetadata` 로 새 핸들러의 guards + roles `["Admin"]` 검증 (기존 5 핸들러 검증과 동형).
- [ ] negative cases 각 1+ — 빈 `llmProviderConfigId` 400 · 숫자 type 400 · extra 키 400 (forbidNonWhitelisted) · body 부재 400 · **`PUT /providers/default` 가 `:id` 핸들러로 흘러가지 않음** (라우트 순서 회귀 test — supertest 로 `default` path 가 200/404 이지 `:id` 의 응답이 아님) · 기본 row DELETE 409.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build` 통과. e2e 가 provider 목록 필드 수를 세면 본 PR 에서 갱신.

## Out of Scope

- Web UI (T-1866). seed (T-1867). requirements.md / PLAN (T-1868).
- `GET /api/llm/providers/default` 단독 조회 엔드포인트 — 목록의 `isDefault` 로 충분 (ADR-0062 (B)). 필요 시 follow-up.

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- T-1866: `web/src/views/adminLlmProviderMutationRunners.ts` 에 `runSetDefaultProvider` (PUT 배선) + `LlmProviderConfigList` 배지/버튼.

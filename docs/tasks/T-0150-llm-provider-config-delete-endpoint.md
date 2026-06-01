---
id: T-0150
title: DELETE /api/llm/providers/:id — LLM provider config 삭제 endpoint (P2025 404 / P2003 in-use 409)
phase: P4
status: DONE
completedAt: 2026-06-02
mergedAs: 4656194
prNumber: 143
reviewRounds: 1
commitMode: pr
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-096]
estimatedDiff: 115
estimatedFiles: 4
created: 2026-06-02
plannerNote: P4 milestone-2 write CRUD DELETE slice (Q-0013 승인). R-112 backbone × 1.5(P2002 미적용 — @unique 부재). repo.delete 기존, P2025→404 + P2003→409 service 변환만.
---

# T-0150 — DELETE /api/llm/providers/:id (LLM provider config 삭제 + in-use 차단)

## Why

Q-0013 가 승인한 **milestone-2 (LLM provider config write CRUD)** 의 DELETE slice 다. POST slice (T-0149) 가 merge 됐고, 남은 write 경로는 PATCH / DELETE / api.md doc-sync 다. 본 task 는 그중 **DELETE** 를 신설한다 — Admin+ 가 등록된 LLM provider config 를 id 로 삭제하되, (a) 존재하지 않는 id 는 404, (b) DifficultyMapping 슬롯에 **사용 중인** config 는 schema 의 `onDelete: Restrict` (prisma/schema.prisma §LlmProviderConfig FK, ADR-0011 §2) 가 거는 Prisma **P2003** (FK constraint failed) 를 catch 해 **409 Conflict** (in-use — 먼저 슬롯 재지정 후 삭제하라는 운영 가시성) 로 변환한다.

DELETE 는 PATCH 보다 단순한 self-contained slice 다 — repository `delete(id)` 메서드가 이미 존재 (P2025 raw propagate) 하고, P2025→404 변환은 기존 `DifficultyMappingService` 의 `getPrismaErrorCode` duck-typing 패턴 (instanceof 회피) 을 mirror 하면 된다. P2003→409 변환만 신규 분기다. 새 외부 dependency 0 / 새 외부 credential 0 / DB schema migration 0 (기존 FK·`delete` 재사용) — §5 HITL 게이트 미발화 (Q-0013 승인 scope 내).

PLAN.md Phase P4 "LLM provider 추상화 (R-99~103)" + "자격증명 관리 (R-20/R-33)" bullet 의 write 경로 완성. PATCH slice 와 api.md doc-sync 는 별도 follow-up task.

## Required Reading

- `src/llm/llm-provider-config.service.ts` — 기존 `create` / `findById` 패턴 + `LlmProviderConfigService` 구조. 본 task 가 `delete(id)` 메서드 추가
- `src/llm/llm-provider-config.repository.ts` — `delete(id)` 이미 존재 (P2025 raw propagate, line 69~71). 본 task 는 service 가 이를 호출하고 P2025/P2003 를 4xx 로 변환 (repository 재배선 불요 — 확인용)
- `src/llm/llm-provider-config.controller.ts` — 기존 GET/POST controller (Admin+ RBAC stack + controller-scope ValidationPipe). 본 task 가 `@Delete(":id")` 추가
- `src/llm/difficulty-mapping.service.ts` — `getPrismaErrorCode` duck-typing helper (line 41~51) + P2025→NotFoundException 변환 패턴 (line 173 부근). 본 task 가 동일 패턴 mirror (P2025→404, P2003→409). helper 중복은 기존 §Follow-ups 의 외화 candidate 정합 — 본 task 도 mirror 우선, 신규 외화 없음
- `src/llm/difficulty-mapping.service.spec.ts` — P2025 변환 test 패턴 (line 299~) + `buildPrismaError` 사용 예. 본 task spec 의 P2025/P2003 case mirror 기준
- `test/helpers/prisma-mock.ts` — `buildPrismaError(code, message)` 헬퍼 (Prisma error code mock 생성). DELETE service spec 의 P2025/P2003 case 가 이를 사용
- `prisma/schema.prisma` (line 321~361) — `LlmProviderConfig` 에 `@unique`/`@@unique` **부재** (P2002 분기 0 확인) + `DifficultyMapping → LlmProviderConfig` 의 `onDelete: Restrict` (P2003 in-use 차단 근거)

## Acceptance Criteria

- [ ] `LlmProviderConfigService` 에 `delete(id)` 메서드 추가 — `repository.delete(id)` 호출을 `try/catch` 로 감싸 (1) Prisma `P2025` (record not found) catch 시 `NotFoundException` (404) 으로 변환, (2) Prisma `P2003` (foreign key constraint failed — DifficultyMapping 슬롯이 본 config 사용 중) catch 시 `ConflictException` (409) 으로 변환 (메시지에 "in-use" / "먼저 슬롯 재지정" 취지 명시), (3) 그 외 error (DB 장애 등) 는 swallow 없이 그대로 propagate. error code 식별은 `getPrismaErrorCode` duck-typing 패턴 mirror (instanceof 회피). 성공 시 `void` 반환 (응답 body 0 — apiKey leak 표면 0).
- [ ] `LlmProviderConfigController` 에 `@Delete(":id")` 핸들러 추가 — `@Param("id") id: string`, `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (기존 GET/POST 와 동일 tier). `@HttpCode(204)` 로 204 No Content 반환 (삭제 성공 body 없음). service raw forward (controller 자체 분기 0 — service 가 4xx 변환).
- [ ] **Happy-path unit test**: 유효 id → `service.delete` 가 `repository.delete` 를 그 id 로 1회 호출 + 정상 종료 (throw 없음, void). controller `@Delete(":id")` 가 `service.delete` 로 forward + 204 status 검증.
- [ ] **Error path unit test**: (a) `repository.delete` 가 P2025 reject (id 부재) → service 가 `NotFoundException` (404) 변환 검증, (b) `repository.delete` 가 P2003 reject (in-use) → service 가 `ConflictException` (409) 변환 검증, (c) `repository.delete` 가 P2025/P2003 아닌 raw error (DB 장애) reject → service 가 변환 없이 그대로 propagate 검증 (404/409 로 잘못 변환하지 않음).
- [ ] **Flow / branch coverage**: service.delete 의 분기 — 성공 (변환 0) / P2025 (404) / P2003 (409) / 그 외 (raw propagate) 각 1+ test. `getPrismaErrorCode` 가 `code` 필드 없는 error 에 `undefined` 반환 → raw propagate 경로도 cover.
- [ ] **Negative cases 충분 cover**: P2025 / P2003 / unknown Prisma code (예: P2002 같은 무관 code → raw propagate, 404/409 변환 안 함) / code 필드 부재 plain Error → 각 1+ test. RBAC negative (User actor 403 / 인증 부재 401) 는 기존 guard stack 이 cover 하므로 controller test 에서 guard 적용 사실만 확인 (기존 GET/POST test 패턴 mirror).
- [ ] **never-read-back invariant 유지**: DELETE 응답에 body 가 없음 (204, apiKey 든 어떤 config 필드든 직렬화 0) 을 검증하는 test 1+ (ADR-0014 §3 — 삭제 경로에서도 secret 노출 0).
- [ ] service / controller test 는 기존 colocated `src/llm/llm-provider-config.service.spec.ts` / `src/llm/llm-provider-config.controller.spec.ts` 에 case 추가 (신규 spec 파일 신설 불요 — DELETE 는 DTO 없음). P2025/P2003 mock 은 `test/helpers/prisma-mock.ts` 의 `buildPrismaError` 사용.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **PATCH /api/llm/providers/:id (수정) — split follow-up** (별도 task). 부분 갱신 + optional apiKey 재암호화 시멘틱 (apiKey 부재 = 기존 유지 / 명시 = 재암호화 교체, ADR-0014 §3) 은 그 task 책임. 본 task 는 DELETE 만 — repository 에 `update` 메서드 추가 금지.
- **api.md doc-sync** — chain 마지막 별도 direct-mode task (POST + DELETE + PATCH 종합 반영).
- **DB schema migration** — 불요 (기존 `onDelete: Restrict` FK + `delete` 메서드 재사용). 새 컬럼 / 타입 변경 / FK 정책 변경 0. `prisma/migrations/*` 추가 금지.
- **soft delete (active=false)** 도입 — LlmProviderConfig 는 hard delete 정책 (schema 에 active 컬럼 0). soft delete 전환은 본 task scope 외 (필요 시 별도 ADR).
- **DifficultyMapping 자동 재지정 / cascade nullify** — `onDelete: Restrict` 정책 유지 (Admin 이 명시적으로 먼저 슬롯 재지정 후 삭제, ADR-0011 §2). 본 task 는 in-use 를 409 로 표면화만 — 자동 슬롯 nullify 금지.
- 새 RBAC / auth-flow 정책 변경 0 — 기존 `JwtAuthGuard` / `RolesGuard` / `@Roles("Admin")` stack 적용만.
- `getPrismaErrorCode` helper 의 service 간 중복 외화 (shared util 추출) — 본 task 는 기존 mirror 우선, 신규 외화 금지 (Follow-ups 에 기록).
- 기존 stale 주석 ("ADR-0006 follow-up" 등) 의 대량 정정 — 본 task 가 직접 손대는 파일 내 1~2 줄만 정합, 별도 sweep 금지 (Follow-ups 에 기록).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(빈 상태로 생성 — sub-agent 가 관련 작업 발견 시 추가)

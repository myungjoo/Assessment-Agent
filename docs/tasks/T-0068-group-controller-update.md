---
id: T-0068
title: GroupController @Patch(":id") endpoint + spec — Group CRUD-U 4-layer 완성 (PersonController 패턴 mirror)
phase: P3
status: DONE
commitMode: pr
prNumber: 62
mergedAs: 7509a7a
completedAt: 2026-05-27
reviewRounds: 1
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 322
actualDiff: 244
estimatedFiles: 2
sizeExempt: true
exemptReason: cap-bend pre-justified — R-112 4-카테고리 cover backbone × 1.5 multiplier (estimate-model.md §3.1 / §4) controller-with-spec 박제. 315~330 LOC envelope 안 — controller @Patch(":id") 메서드 신설 (~15 LOC) + spec describe("PATCH /api/groups/:id") block 추가 (unit-level happy 1 + branch 2 + error 1 + ValidationPipe integration negative 4~5 + 200 LOC) + JSDoc 한국어 + R-112 의 atomic-introduce 의무 (§3.2 — public symbol 의 4 카테고리 cover 가 동일 commit 안). T-0055 (413 LOC sizeExempt 박제) + T-0056 (545 LOC) + T-0057 (496 LOC) R-112 backbone precedent 3 회차 정당화. split 안 함 — R-112 의 atomic-introduce 의무 위반 회피.
created: 2026-05-27
dependsOn: [T-0036, T-0055, T-0057, T-0066, T-0067]
plannerNote: session #20 turn 4 (loop, planner-only safe) — T-0067 의 자연 follow-up. GroupController @Patch(":id") 신설로 Group CRUD-U 4-layer (DTO+repo+service+controller) closure. PersonController @Patch (T-0036) precedent 1:1 mirror.
---

# T-0068 — GroupController @Patch(":id") endpoint + spec (Group CRUD-U 4-layer closure)

## Why

[T-0066](T-0066-group-update-dto-and-repository.md) (UpdateGroupDto + GroupRepository.update) + [T-0067](T-0067-group-service-update.md) (GroupService.update + P2025→NotFoundException 변환) 두 layer 가 박제됐다. 마지막 layer 는 `GroupController.@Patch(":id")` HTTP endpoint — service.update 의 HTTP 노출 + ValidationPipe wire 로 client 가 partial update 호출 가능. [PersonController L81-87](../../src/user/person.controller.ts) precedent 가 1 차 mirror source — T-0036/T-0037 의 keys-routing 제거 + service.update 단일 forward 패턴 적용. 본 task 머지 시 Group 도메인 의 CRUD-U 4-layer (DTO + repository + service + controller) fully closed — REQ-028 (Group 정책) + REQ-051 (Group entity invariant) 의 HTTP layer partial update semantic 박제.

[api.md L78](../architecture/api.md) 의 `PATCH /api/groups/:id → group 수정` row 가 이미 박제 (T-0030) — 별도 doc 갱신 0. 본 task 후 GroupController 의 책임 경계 주석 (L36-55) 갱신 — "PATCH endpoint 미노출" 항목 제거.

## Required Reading

- [docs/tasks/T-0067-group-service-update.md](T-0067-group-service-update.md) — 직전 layer 박제 — GroupService.update + P2025→NotFoundException + spec R-112 4 카테고리.
- [docs/tasks/T-0066-group-update-dto-and-repository.md](T-0066-group-update-dto-and-repository.md) — DTO + repository layer 박제 — UpdateGroupDto (`name?: string` 단일 필드 + IsOptional/IsString/IsNotEmpty/MaxLength(255)).
- [src/user/person.controller.ts L81-87](../../src/user/person.controller.ts) — `@Patch(":id")` 메서드 1 차 precedent (RFC-7396 partial update + service.update 단일 forward + 200 OK 자동 응답).
- [src/user/person.controller.spec.ts L156-264](../../src/user/person.controller.spec.ts) — `update()` describe block 의 R-112 4 카테고리 cover 패턴 + ValidationPipe integration negative case.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — 본 task 의 변경 대상. 현 7 endpoint (4 CRUD + 3 N:M) → 8 endpoint 로 확장. 책임 경계 주석 L36-55 의 "PATCH endpoint 미노출" 항목 갱신.
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) — 본 task 의 변경 대상. 기존 unit-level 7 endpoint + ValidationPipe integration block 에 PATCH block 추가.
- [src/user/group.service.ts](../../src/user/group.service.ts) — T-0067 박제 `update(id, patch)` 메서드 + JSDoc + P2025 변환.
- [src/user/dto/update-group.dto.ts](../../src/user/dto/update-group.dto.ts) — T-0066 박제 UpdateGroupDto.
- [docs/architecture/api.md L70-79](../architecture/api.md) — UC-03 endpoint 표. `PATCH /api/groups/:id` row 박제 확인 (변경 0).
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 — R-112 4-카테고리 cover backbone × 1.5 multiplier 적용 근거. cap-bend pre-justified 박제 source (T-0055/T-0056/T-0057 precedent 3 회차).
- [CLAUDE.md §3.2 R-112](../../CLAUDE.md) — 새 public symbol 도입 시 atomic-introduce 의무 (happy / error / branch / negative 4 카테고리 동일 commit).

## Acceptance Criteria

본 task 의 변경 대상:

### A. GroupController @Patch(":id") 메서드 신설

- [ ] `src/user/group.controller.ts` 에 `@Patch(":id")` 메서드 추가. PersonController.update 패턴 mirror:
  - `import { ..., Patch } from "@nestjs/common"` — 기존 import 줄에 `Patch` 추가.
  - `import { UpdateGroupDto } from "./dto/update-group.dto"` 추가.
  - body: `async update(@Param("id") id: string, @Body() patch: UpdateGroupDto): Promise<Group> { return this.service.update(id, patch); }` — service.update 단일 forward.
  - HTTP status — default 200 OK (NestJS 자동 + @HttpCode decorator 없음, PersonController.update 와 동일).
  - 응답 — service 가 반환한 Group row 그대로 client 로 propagate.
- [ ] 한국어 JSDoc header 신설 (8~12 줄):
  - 책임 — "`PATCH /api/groups/:id` — RFC-7396 JSON Merge Patch + ValidationPipe wire + service.update 단일 forward".
  - branch 박제 — `patch.name !== undefined` vs `undefined` 의 service-layer no-op semantic (controller 는 routing 만, 의미는 service).
  - error propagation — `NotFoundException` (P2025 변환, T-0067 박제) 자동 → 404. `BadRequestException` (ValidationPipe) 자동 → 400.
  - 책임 경계 — AuthGuard 미적용 / N:M membership PATCH 부재 (별도 후속).
- [ ] 기존 책임 경계 주석 L36-55 갱신:
  - api.md row 표 (L4-11) 에 `PATCH /api/groups/:id → update` row 추가.
  - "Out of Scope — T-0057 시점" 단락 (L48-55) 의 "PATCH endpoint 미노출 — Group 의 mutation 은 본 task 의 CRUD 중 C/R/D + N:M add/remove 만 (별도 후속)" → "PATCH endpoint 추가 (T-0068 박제) — Group.name 부분 수정 + ValidationPipe wire" 로 갱신. PartController PATCH 부재 박제 유지.
- [ ] ValidationPipe wire 자동 적용 — Controller-scope `@UsePipes` (L74-80) 가 신규 endpoint 도 cover. 별도 wire 0.

### B. GroupController.@Patch(":id") spec 신설

- [ ] `src/user/group.controller.spec.ts` 의 unit-level block (L85~) 에 `describe("PATCH /api/groups/:id", ...)` 또는 it block 신설. **R-112 4 카테고리 cover** (per CLAUDE.md §3.2 R-112 의무):
  - **happy 1+**: name patch 시 `service.update` mock 이 정상 Group row 반환 + mock 호출 인자 `(id, {name})` 정합 + controller 가 same row return 검증.
  - **error path 1+**: `service.update` mock 이 reject(NotFoundException) 시 controller 가 NotFoundException 그대로 propagate 검증.
  - **branch 1+** (다중):
    - `{name: "..."}` 단일 필드 patch → `(id, {name})` forward (happy 와 별도 추가 가능).
    - 빈 `{}` patch → `(id, {})` forward (PATCH no-op semantic, PersonController.update L233-242 mirror).
  - **negative cases 충분 cover** (2+ 분기, controller-level):
    - service 가 ConflictException-like / unknown Error 반환 시 raw propagate (Person controller spec L254-264 mirror).
    - 빈 string id (`""`) 도 service 로 forward (controller 는 검증 책임 없음).
- [ ] `describe("GroupController (ValidationPipe integration)", ...)` block (L400~) 에 PATCH ValidationPipe negative case 추가 (supertest). **CreateGroupDto + AddMemberDto 패턴 mirror**:
  - **happy reference 1**: `{name: "정상그룹"}` payload → 200 OK + service.update 1 회 호출 검증.
  - **negative 1 (빈 string)**: `{name: ""}` → @IsNotEmpty 위반 → 400 + service.update 미호출.
  - **negative 2 (extra field)**: `{name: "그룹", foo: "bar"}` → forbidNonWhitelisted → 400 + service.update 미호출.
  - **negative 3 (wrong type)**: `{name: 12345}` → @IsString 위반 → 400 + service.update 미호출.
  - **negative 4 (MaxLength)**: `{name: "a".repeat(256)}` → @MaxLength(255) 위반 → 400 + service.update 미호출.
  - **branch (empty patch)**: `{}` → @IsOptional 통과 → 200 OK + service.update 1 회 호출 `(id, {})` 검증 (RFC-7396 no-op semantic 박제, ValidationPipe layer 는 통과).
- [ ] `buildServiceMock` factory (L60~80 부근 가정) 또는 ValidationPipe integration block 의 `serviceMock` 객체 (L402-410) 에 `update: jest.fn()` 추가.
- [ ] 본 task 의 신규 신설 코드 (controller.@Patch + spec) 의 coverage 는 colocated spec 으로 100% line / function / branch 박제 의무.

### C. Test/CI 수행 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과 (TypeScript strict typing — `UpdateGroupDto` import path 정합).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global` 강제). 본 task 신규 코드 100% 박제.
- [ ] `pnpm test:smoke` 통과 (DATABASE_URL local PostgreSQL 16 가정, T-0061 패턴 reuse).
- [ ] `pnpm test:e2e` 통과 (DATABASE_URL local PostgreSQL 16, T-0062 패턴 reuse).
- [ ] CI 의 6 step (lint / build / test:cov / smoke / e2e / reviewer agent approval 검증) 전부 green.

### D. PR / 4-게이트

- [ ] feature branch `claude/T-0068-group-controller-update` push.
- [ ] PR open — title/body 한국어 + AC 체크리스트 + Refs 단락 + PersonController.@Patch precedent reference + Group CRUD-U 4-layer closure 명시 + cap-bend pre-justified note (estimatedDiff=322 LOC × 1.5 multiplier 적용 + T-0055/T-0056/T-0057 R-112 backbone precedent 3 회차 정당화).
- [ ] reviewer agent round 1 → APPROVE 또는 ANOTHER_ROUND (round ≤ 7).
- [ ] reviewer comment 외부 post 검증 (4-게이트 #2).
- [ ] integrator self-check 6 항목 PASS (4-게이트 #3) — sizeExempt 정당성 검증 포함.
- [ ] CI green (4-게이트 #4 + R-114).
- [ ] `gh pr merge --squash --delete-branch` 머지 — worktree race 10 회차 가능성 시 [race-patterns.md §2](../architecture/race-patterns.md) `gh api -X DELETE refs/heads/<branch>` fallback 적용.

## Out of Scope

- **GroupService.update 변경 안 함** — T-0067 박제 유지. P2002 분기 추가 안 함 (Group.name `@unique` 미정의 유지).
- **GroupRepository.update 변경 안 함** — T-0066 박제 유지.
- **UpdateGroupDto 변경 안 함** — T-0066 박제 유지 (`name?: string` 단일 필드).
- **prisma/schema.prisma 변경 안 함** — Group.name `@unique` 추가 안 함. 동명 Group 허용 정책 유지.
- **Part 도메인 PATCH 추가 안 함** — UpdatePartDto / PartRepository.update / PartService.update / PartController.@Patch 모두 미박제 backbone gap 이나 본 task scope 는 Group 단독. Part PATCH 는 별도 T-0069 후보 (4-layer 통합 또는 split).
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지. 본 endpoint 도 Admin+ 권한 표기만 (api.md L78 박제 유지) — 실 가드 후속.
- **N:M membership PATCH endpoint 추가 안 함** — `PATCH /api/groups/:id/members/:membershipId` 같은 N:M middle row mutation 은 본 task scope 아님 (membership 자체에 mutable field 부재 — schema.prisma L123-133 박제).
- **smoke / e2e spec 갱신 안 함** — 본 task 는 unit-level controller spec + ValidationPipe integration 만. groups.smoke (T-0061) + groups.e2e (T-0062) 에 PATCH HTTP-layer test 추가는 별도 후속 (smoke/e2e 의 PATCH coverage gap 박제 — Follow-ups).
- **api.md row 추가 안 함** — `PATCH /api/groups/:id` row 가 T-0030 시점 박제 (api.md L78). 본 task 는 doc 변경 0.
- **GroupController 의 기존 7 endpoint 변경 안 함** — findAll / findById / findPersons / create / addMember / delete / removeMember 박제 유지.
- **ADR 신설 안 함** — ADR-0005 (race-fix) / ADR-0007 (audit log) / ADR-0008 (auth credential) 진행은 별도 task.
- **race-patterns.md 갱신 안 함** — T-0065 박제 8 회차 enumeration 유지. 본 task 진행 중 추가 race 발견 시 Follow-ups 에 기록.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator`

- **architect 호출 0** — PersonController.@Patch (T-0036/T-0037) + GroupController CRUD 7 endpoint (T-0055/T-0057) precedent 모두 박제, 새 ADR 0.
- **implementer** — A.1~A.4 + B.1~B.4 (@Patch 메서드 + JSDoc + 책임 경계 주석 갱신 + spec R-112 4 카테고리 박제 + ValidationPipe negative). cap envelope 322 LOC / 2 파일 (R-112 backbone × 1.5 multiplier + sizeExempt 박제).
- **tester** — C.1~C.6 (lint / build / test:cov / smoke / e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 박제 + PersonController.@Patch precedent mirror 정합 + Out of Scope 준수 + ValidationPipe wire 정합 + sizeExempt 정당성 검증 (cap-bend pre-justified note + precedent 3 회차) + race-patterns.md cross-ref 검증.
- **integrator** — 4-게이트 + worktree race fallback (10 회차 가능성) + sizeExempt 정당성 self-check 6 항목 중 검증.

## Follow-ups

(planner queue 후 추가 — implementer / tester / reviewer / integrator 가 append)

- (planner pre-queue) **T-0069 후보**: Part 도메인 PATCH 4 layer (UpdatePartDto + PartRepository.update + PartService.update + PartController.@Patch + 각 spec) — Group precedent 3 회 박제 (T-0066/T-0067/T-0068) 후 mirror. 통합 task (~500 LOC sizeExempt) 또는 layer-split (4 sub-task).
- (planner pre-queue) **groups.smoke / groups.e2e PATCH 확장 후보**: T-0061 (smoke) + T-0062 (e2e) 에 PATCH HTTP-layer test 추가 — happy + 404 + 400 (ValidationPipe) + REQ-051 N:M 무관 isolation. T-0068 머지 후 자연 follow-up.
- (planner pre-queue) **HQ-0009 영구 fix 후보**: install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp ADR 박제 + follow-up task. cron backbone 실효 부재 패턴 영구 해소.
- (planner pre-queue) **estimate model 10 회차 milestone 후보**: T-0066 (+61) / T-0067 (+ TBD) / T-0068 (+ TBD) 3 회차 추가 후 estimate-model.md §6 의 10 회차 milestone 도달 — multiplier 재산출 + 카테고리 추가 (R-112 enumerated-negative 분리?) 검토.
- (planner pre-queue) **race-patterns.md §8 cron-vs-loop variant 후보**: session #20 turn 1 cron a153ae5 BLOCKED bookkeeping push + loop executor merge 동시 발화 lost work 0 dogfood. T-0065 doc-only direct 후속.
- (planner pre-queue) **phase 2 src/user spec migration 후보**: jest.mock 패턴 vs PrismaService DI 패턴 일관성 검토 (mock-only 5 spec migration ~200-250 LOC).

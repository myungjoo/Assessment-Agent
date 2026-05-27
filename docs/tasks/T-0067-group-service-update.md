---
id: T-0067
title: GroupService.update + spec — P2025 → NotFoundException 변환 (Person 패턴 mirror, controller PATCH 는 후속)
phase: P3
status: DONE
commitMode: pr
prNumber: 61
mergedAs: 84104ac
completedAt: 2026-05-27
reviewRounds: 1
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 200
actualDiff: 214
estimatedFiles: 2
created: 2026-05-27
dependsOn: [T-0036, T-0050, T-0056, T-0066]
plannerNote: session #20 turn 2 (loop, planner-only safe) — T-0066 의 자연 follow-up. UpdateGroupDto+GroupRepository.update layer 가 박제됐으므로 service layer 가 P2025→NotFoundException 변환 + dto.name undefined 분기 cover.
---

# T-0067 — GroupService.update + spec (P2025 → NotFoundException 변환 layer)

## Why

[T-0066](T-0066-group-update-dto-and-repository.md) 머지로 Group 도메인 PATCH 의 2 layer (UpdateGroupDto + GroupRepository.update) 가 박제됐다. 다음 layer 는 `GroupService.update` — repository 의 raw P2025 throw 를 NestJS `NotFoundException` 으로 변환하는 service-layer 의미 부여. [PersonService.update L102-125](../../src/user/person.service.ts) precedent 가 1 차 mirror source — 단 Group 은 `name` 단일 필드이므로 `fullName/email/active` 3 필드 spread 대신 `name` 단일 분기. P2002 변환 분기 부재 (Group.name `@unique` 미정의, [group.repository.ts L25-30](../../src/user/group.repository.ts) 박제). 본 task 머지 후 [T-0068](#) 가 GroupController @Patch(":id") endpoint 추가로 4 layer 완성.

REQ-028 (Group 정책) + REQ-051 (Group entity invariant) 의 service-layer 부분 update semantics 박제. [group.service.ts L46](../../src/user/group.service.ts) 의 책임 경계 주석 "GroupRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task)" 의 일부 해소.

## Required Reading

- [docs/tasks/T-0066-group-update-dto-and-repository.md](T-0066-group-update-dto-and-repository.md) — 직전 layer 박제 — UpdateGroupDto + GroupRepository.update + GroupUpdateInput interface.
- [src/user/person.service.ts L96-125](../../src/user/person.service.ts) — `update()` 메서드 1 차 precedent (RFC-7396 partial update + P2025/P2002 변환 + undefined spread guard).
- [src/user/person.service.spec.ts L215-360](../../src/user/person.service.spec.ts) — `update()` describe block 의 R-112 4 카테고리 cover 패턴.
- [src/user/group.service.ts](../../src/user/group.service.ts) — 본 task 의 변경 대상. L46 책임 경계 주석 갱신 + 신규 `update()` 메서드 추가 위치.
- [src/user/group.service.spec.ts](../../src/user/group.service.spec.ts) — 본 task 의 변경 대상. 기존 4 메서드 + N:M 3 메서드 spec 패턴 mirror.
- [src/user/group.repository.ts L83-85](../../src/user/group.repository.ts) — T-0066 박제 `update(id, input)` 메서드 + GroupUpdateInput interface (`name?: string` 단일 필드).
- [src/user/dto/update-group.dto.ts](../../src/user/dto/update-group.dto.ts) — T-0066 박제 UpdateGroupDto (`name?: string` 단일 필드).
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 — service-with-spec × 1.5 multiplier 적용 근거. T-0066 의 +61 LOC under-estimate 학습 — enumerated-negative 자연 결과로 actual ~200 LOC 예상.

## Acceptance Criteria

본 task 의 변경 대상:

### A. GroupService.update 메서드 신설

- [ ] `src/user/group.service.ts` 에 `async update(id: string, patch: UpdateGroupDto): Promise<Group>` 메서드 추가. PersonService.update 패턴 mirror:
  - `import type { UpdateGroupDto } from "./dto/update-group.dto"` 추가.
  - body: `try { return await this.groupRepository.update(id, { ...(patch.name !== undefined && { name: patch.name }) }) } catch (error) { if (getPrismaErrorCode(error) === "P2025") throw new NotFoundException("group not found: ${id}"); throw error; }`.
  - P2002 변환 분기 **부재** — Group.name `@unique` 미정의 박제. JSDoc 에 사유 명시.
  - undefined spread guard — `patch.name === undefined` 시 빈 객체 `{}` 를 repository 로 forward (PATCH no-op semantic 박제, Prisma `@updatedAt` directive 가 updatedAt 만 갱신).
- [ ] 한국어 JSDoc header 신설 (10~15 줄):
  - 책임 — "RFC-7396 partial update + P2025 → NotFoundException 변환".
  - branch 분기 박제 — `patch.name !== undefined` vs `undefined` 의 spread 동작 차이.
  - P2002 부재 사유 — Group.name @unique 미정의 (group.repository.ts L25-30 박제).
  - 책임 경계 — PATCH endpoint (controller) 는 후속 T-0068 책임.
- [ ] 기존 L46 책임 경계 주석 갱신 — "GroupRepository.update 추가 / PATCH endpoint 없음" → "GroupController PATCH 없음 (CRUD 의 C/R/D + service.update 만 — controller PATCH 는 별도 후속 task T-0068)".

### B. GroupService.update spec 신설

- [ ] `src/user/group.service.spec.ts` 의 `describe("update()", ...)` block 신설. **R-112 4 카테고리 cover** (per CLAUDE.md §3.2 R-112 의무):
  - **happy-path 1+**: name patch 시 GroupRepository.update mock 이 정상 Group row 반환 + mock 호출 인자 `(id, {name})` 정합 + service 가 same row return 검증.
  - **error path 1+**: GroupRepository.update mock 이 reject(`buildPrismaError("P2025")`) 시 service 가 NotFoundException throw + error message 가 "group not found: " + id 포함 검증.
  - **branch 1+** (다중):
    - `patch.name !== undefined` → `{name}` forward (happy 와 별도 추가 가능).
    - `patch.name === undefined` (빈 `{}` patch) → repository 로 빈 객체 `{}` forward (PATCH no-op, Person.update 의 fullName-only branch mirror).
  - **negative cases 충분 cover** (3+ 분기):
    - unknown Prisma error code (`P9999`) → raw propagate (NotFoundException 안 변환).
    - code 없는 generic Error → raw propagate.
    - undefined name patch + repository 가 정상 반환 시점 동작 (no-op semantic 박제).
    - 빈 string id (`""`) 도 repository 로 forward (PersonService.findById negative pattern mirror).
- [ ] 본 task 의 신규 신설 코드 (service.update + spec) 의 coverage 는 colocated spec 으로 100% line / function / branch 박제 의무.

### C. Test/CI 수행 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global` 강제). 본 task 신규 코드 100% 박제.
- [ ] `pnpm test:smoke` 통과 (DATABASE_URL local PostgreSQL 16 가정, T-0061 패턴 reuse).
- [ ] `pnpm test:e2e` 통과 (DATABASE_URL local PostgreSQL 16, T-0062 패턴 reuse).
- [ ] CI 의 6 step (lint / build / test:cov / smoke / e2e / reviewer agent approval 검증) 전부 green.

### D. PR / 4-게이트

- [ ] feature branch `claude/T-0067-group-service-update` push.
- [ ] PR open — title/body 한국어 + AC 체크리스트 + Refs 단락 + PersonService.update precedent reference.
- [ ] reviewer agent round 1 → APPROVE 또는 ANOTHER_ROUND (round ≤ 7).
- [ ] reviewer comment 외부 post 검증 (4-게이트 #2).
- [ ] integrator self-check 6 항목 PASS (4-게이트 #3).
- [ ] CI green (4-게이트 #4 + R-114).
- [ ] `gh pr merge --squash --delete-branch` 머지 — worktree race 9 회차 가능성 시 [race-patterns.md §2](../architecture/race-patterns.md) `gh api -X DELETE refs/heads/<branch>` fallback 적용.

## Out of Scope

- **GroupController @Patch(":id") endpoint 신설 안 함** — 후속 T-0068 책임. 본 task 는 service layer 의 update 메서드만. api.md 의 PATCH /api/groups/:id row 추가는 T-0068 시점.
- **GroupRepository.update 변경 안 함** — T-0066 박제 유지. P2002 분기 추가 안 함 (Group.name `@unique` 미정의 유지).
- **prisma/schema.prisma 변경 안 함** — Group.name `@unique` 추가 안 함. 동명 Group 허용 정책 유지.
- **Part 도메인 PATCH 동시 추가 안 함** — UpdatePartDto / PartRepository.update / PartService.update 모두 미박제 backbone gap 이나 본 task scope 는 Group 단독. Part PATCH 는 별도 T-0069 후보.
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지.
- **smoke / e2e spec 신규 추가 안 함** — service layer 만 변경, controller endpoint 변경 0 이므로 HTTP-layer test 갱신 불요. groups.smoke (T-0061) + groups.e2e (T-0062) 는 본 task scope 변경 0.
- **ADR 신설 안 함** — ADR-0005 (race-fix) / ADR-0007 (audit log) / ADR-0008 (auth credential) 진행은 별도 task.
- **race-patterns.md 갱신 안 함** — T-0065 박제 7 회차 enumeration 유지. 본 task 진행 중 추가 race 발견 시 Follow-ups 에 기록.
- **`getPrismaErrorCode` helper 외화 안 함** — 3 service (Person / Part / Group) 중복은 [group.service.ts L67-77](../../src/user/group.service.ts) 박제 (T-0050 §Follow-ups 의 phase 2 외화 candidate). 본 task 는 in-place 유지.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator`

- **architect 호출 0** — PersonService.update (T-0036/T-0037) + GroupService.create/findAll/findById/delete (T-0050) 의 precedent 가 모든 의사결정 박제, 새 ADR 0.
- **implementer** — A.1~A.3 + B.1~B.2 (service.update 메서드 + JSDoc + spec 4 카테고리 박제). cap envelope ~200 LOC / 2 파일 (× 1.5 service-with-spec multiplier + T-0066 의 +61 LOC under-estimate 학습 반영).
- **tester** — C.1~C.6 (lint / build / test:cov / smoke / e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 박제 + PersonService.update precedent mirror 정합 + Out of Scope 준수 + P2002 분기 부재 사유 명시 검증 + race-patterns.md cross-ref 검증.
- **integrator** — 4-게이트 + worktree race fallback (9 회차 가능성).

## Follow-ups

(planner queue 후 추가 — implementer / tester / reviewer / integrator 가 append)

- (planner pre-queue) **T-0068 후보**: GroupController @Patch(":id") endpoint + spec 박제 + api.md PATCH /api/groups/:id row 추가. service.update 의 forward target.
- (planner pre-queue) **T-0069 후보**: Part 도메인 PATCH 4 layer (UpdatePartDto + PartRepository.update + PartService.update + PartController.@Patch + 각 spec) — Group precedent 2 회 박제 후 mirror, 통합 task 또는 split.
- (planner pre-queue) **HQ-0009 영구 fix 후보**: install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp ADR 박제 + follow-up task. cron backbone 실효 부재 패턴 영구 해소.
- (planner pre-queue) **estimate model refinement 후보**: T-0066 의 +61 LOC under-estimate (× 1.28 추가) 데이터 박제 후 multiplier 조정 (× 1.5 → × 1.6 또는 enumerated-negative 카테고리 분리). T-0067 actual 결과 추가 후 의사결정.
- (planner pre-queue) **race-patterns.md §8 후보**: cron-vs-loop race variant 추가 (session #20 turn 1 cron a153ae5 BLOCKED bookkeeping push + loop executor merge 동시 발화 lost work 0 dogfood).

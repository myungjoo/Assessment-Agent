---
id: T-0066
title: UpdateGroupDto + GroupRepository.update 부분 update 첫 layer (Person 패턴 mirror, controller PATCH 는 후속)
phase: P3
status: DONE
commitMode: pr
prNumber: 60
mergedAs: 91182a5
completedAt: 2026-05-27
reviewRounds: 1
blockerReason: credential
blockedAt: 2026-05-27T14:10:00+09:00
blockerResolvedAt: 2026-05-27T14:20:00+09:00
blockerResolution: HQ-0009-use-local-env-gh-3rd-time
linkedHumanQuestion: HQ-0009
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 220
actualDiff: 281
estimatedFiles: 4
created: 2026-05-27
plannerNote: session #19 turn 10 cap-close — Group entity CRUD-U gap (Person UpdatePersonDto + PATCH precedent 박제) 의 repository+DTO layer 만 우선 박제, controller/service PATCH 는 후속 task.
---

# T-0066 — UpdateGroupDto + GroupRepository.update 부분 update 첫 layer

## Why

[PLAN.md](../PLAN.md) Phase P3 backbone 의 CRUD-U gap 박제: Person 도메인은 [UpdatePersonDto](../../src/user/dto/update-person.dto.ts) + `PersonRepository.update` + `PersonService.update` + `PersonController.@Patch(":id")` 4 layer 가 박제 완료 (T-0036/T-0041) 이나 Group 도메인은 CRUD 의 C/R/D 만 박제 (T-0039 → T-0057 누적) — [group.service.ts L46](../../src/user/group.service.ts) 의 책임 경계 주석이 "GroupRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task)" 박제. 본 task 는 그 후속 task 의 첫 layer (repository + DTO) 만 우선 박제 — service.update + controller PATCH 는 cap-discipline 의무 따라 T-0067 / T-0068 으로 split.

REQ-028 (Group 정책 — 임의 group 다중 소속 가능) + REQ-051 (Group entity invariant) 의 부분 update 의 의미 정의 박제 — name 컬럼이 schema `@unique` 미정의이므로 P2002 분기 부재, P2025 (row 부재) 1 분기만 cover.

## Required Reading

- [docs/tasks/T-0036-person-service-controller-dto.md](T-0036-person-service-controller-dto.md) — UpdatePersonDto + PersonService.update 패턴의 1 차 precedent.
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — UpdateGroupDto 의 1:1 mirror source (단 Group 은 fullName/email/active 가 아닌 name 단일 필드).
- [src/user/dto/create-group.dto.ts](../../src/user/dto/create-group.dto.ts) — Group name 컬럼의 class-validator 정합 박제 source (UpdateGroupDto 와 동일 validation 규칙 reuse).
- [src/user/dto/update-person.dto.spec.ts](../../src/user/dto/update-person.dto.spec.ts) — UpdateGroupDto spec 의 R-112 4 카테고리 cover precedent.
- [src/user/group.repository.ts](../../src/user/group.repository.ts) — `create` / `findById` / `findMany` / `delete` 4 메서드 + GroupCreateInput 패턴. 본 task 는 `update` 5 번째 메서드 + GroupUpdateInput interface 추가.
- [src/user/group.repository.spec.ts](../../src/user/group.repository.spec.ts) — 기존 4 메서드 unit spec 패턴 (PrismaService mock + `Object.assign(new Error, {code})` P2025 박제) 의 mirror source.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — `update` 메서드 시그니처 mirror source (PersonRepository.update 가 1 차 precedent).
- [src/user/group.service.ts L46](../../src/user/group.service.ts) — "GroupRepository.update 추가 / PATCH endpoint 없음" 책임 경계 주석 (본 task 가 그 주석의 해소 시작).
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 — service-with-spec × 1.5 multiplier 적용 근거.
- [docs/architecture/race-patterns.md](../architecture/race-patterns.md) — 7 회차 race-fix lessons (T-0065 박제). 본 task 의 integrator dispatch 시 reference.

## Acceptance Criteria

본 task 의 변경 대상:

### A. UpdateGroupDto 신설 + spec

- [ ] `src/user/dto/update-group.dto.ts` 신설. 한국어 JSDoc header (책임 / Out of Scope / Person 도메인 precedent reference).
- [ ] class field 1 종: `name?: string` — `@IsOptional()` + `@IsString()` + `@IsNotEmpty()` + `@MaxLength(255)` decorator (create-group.dto.ts 의 name field validation 1:1 mirror, 단 `@IsOptional()` 추가 — PATCH partial semantics 박제).
- [ ] `src/user/dto/update-group.dto.spec.ts` 신설. **R-112 4 카테고리 cover** (per CLAUDE.md §3.2 R-112 의무):
  - **happy-path 1+**: name 단일 필드 박제 + plainToInstance + validate 0 error 검증.
  - **error path 1+**: name 빈 문자열 → `@IsNotEmpty()` violation; name 256 byte → `@MaxLength` violation; name 비-string → `@IsString()` violation.
  - **branch 1+**: name 미포함 (empty object) → `@IsOptional()` 분기 → validation pass (PATCH no-op 시점 박제). UpdatePersonDto.spec 의 동일 branch 패턴 mirror.
  - **negative cases 충분 cover**: name=null / name=undefined / name=number / name=boolean / extra-property "non-whitelisted-field" (whitelist+forbidNonWhitelisted ValidationPipe global 의 forbid 검증은 controller spec 책임이므로 본 spec 에선 skip 단 비-string 4 종 부족 시 1+) — 최소 3 종 negative test.

### B. GroupRepository.update 메서드 + spec

- [ ] `src/user/group.repository.ts` 의 5 번째 메서드 `async update(id: string, input: GroupUpdateInput): Promise<Group>` 추가. `GroupUpdateInput` interface 신설 (`name?: string` 단일 필드, partial update semantics 박제). Prisma `this.prisma.group.update({ where: { id }, data: input })` raw forward. error 정책: P2025 (row 부재) raw propagate (catch 안 함 — group.service 의 update 가 후속 task 에서 P2025 → NotFoundException 변환 책임).
- [ ] 한국어 JSDoc header 갱신 — 기존 책임 경계 주석에 update 메서드 1 줄 추가 (PersonRepository.update 패턴 mirror, P2025 raw propagate 박제, P2002 분기 부재 사유 명시 — name 컬럼 `@unique` 미정의).
- [ ] `src/user/group.repository.spec.ts` 의 update describe block 신설. **R-112 4 카테고리 cover**:
  - **happy-path 1+**: PrismaService.group.update mock 이 정상 Group row 반환 시 메서드가 same row return 검증 + mock 호출 인자 정합 (`{where:{id},data:input}`).
  - **error path 1+**: PrismaService.group.update mock 이 reject(`Object.assign(new Error("..."),{code:"P2025"})`) 시 메서드가 동일 error 를 raw propagate (catch 안 함).
  - **branch 1+**: input 의 name 필드 missing (`{}`) 도 동일하게 forward (Prisma 가 빈 data 의 PATCH no-op semantic 처리) — 호출 인자 검증.
  - **negative cases 충분 cover**: PrismaService.group.update reject(non-Prisma generic Error) → raw propagate; reject(`code:"P9999"`) → raw propagate; PrismaService 의존성 unset 시점 일관성 — 최소 3 종 negative test (P2025 + P9999 + generic Error 3 분기 명시).

### C. Test/CI 수행 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 의 신규 신설 코드 (UpdateGroupDto + GroupRepository.update) 의 coverage 는 colocated spec 으로 100% 박제 의무.
- [ ] `pnpm test:smoke` 통과 (DATABASE_URL local PostgreSQL 16 가정, T-0061 패턴 reuse).
- [ ] `pnpm test:e2e` 통과 (DATABASE_URL local PostgreSQL 16, T-0062 패턴 reuse).
- [ ] CI 의 6 step (lint / build / test:cov / smoke / e2e / reviewer agent approval 검증) 전부 green.

### D. PR / 4-게이트

- [ ] feature branch `claude/T-0066-group-update-dto-and-repository` push.
- [ ] PR open — title/body 한국어 + AC 체크리스트 + Refs 단락 + Person UpdatePersonDto precedent reference.
- [ ] reviewer agent round 1 → APPROVE 또는 ANOTHER_ROUND (round ≤ 7).
- [ ] reviewer comment 외부 post 검증 (4-게이트 #2).
- [ ] integrator self-check 6 항목 PASS (4-게이트 #3).
- [ ] CI green (4-게이트 #4 + R-114).
- [ ] `gh pr merge --squash --delete-branch` 머지 — worktree race 8 회차 발생 시 [race-patterns.md §2](../architecture/race-patterns.md) 의 fallback `gh api -X DELETE refs/heads/<branch>` 적용.

## Out of Scope

- **GroupService.update 신설 안 함** — 후속 T-0067 책임. 본 task 는 repository + DTO 의 2 layer 만 박제. service.update 가 P2025 → NotFoundException 변환 + name 의 도메인 invariant (예: 길이 / 형식 추가) 를 다음 task 에서 책임.
- **GroupController PATCH endpoint 신설 안 함** — 후속 T-0068 책임. 본 task 는 endpoint 추가 0 — api.md 의 PATCH /api/groups/:id 박제는 T-0068 시점.
- **PartRepository.update / UpdatePartDto 동시 추가 안 함** — Part 도메인 PATCH 도 미박제 backbone gap 이나 본 task scope 는 Group 단독. Part PATCH 는 별도 후속 task.
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지.
- **smoke / e2e spec 신규 추가 안 함** — repository + DTO 만 추가, controller endpoint 변경 0 이므로 HTTP-layer test 갱신 불요. groups.smoke (T-0061) + groups.e2e (T-0062) 는 본 task scope 변경 0.
- **prisma/schema.prisma 변경 안 함** — schema 의 Group.name `@unique` 미정의 박제 유지, P2002 분기 신설 안 함.
- **ADR 신설 안 함** — ADR-0005 (race-fix) / ADR-0007 (audit log) / ADR-0008 (auth credential) 의 진행은 별도 task. 본 task 는 ADR 0.
- **race-patterns.md 갱신 안 함** — T-0065 박제 7 회차 enumeration 유지, 본 task 진행 중 추가 race 발견 시 follow-up 에 기록.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator`

- **architect 호출 0** — UpdatePersonDto + PersonRepository.update 의 1 차 precedent 가 모든 의사결정 박제, 새 ADR 0.
- **implementer** — A.1~A.5 + B.1~B.3 (DTO + repository.update 메서드 + 한국어 JSDoc + spec 4 카테고리 박제). cap envelope ~220 LOC / 4 파일 (× 1.5 service-with-spec multiplier 적용한 estimate, 단 service.update 가 본 task scope 외이므로 실 actual 은 ~180 LOC 예상).
- **tester** — C.1~C.6 (lint / build / test:cov / smoke / e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 박제 + Person precedent mirror 정합 + Out of Scope 준수 + race-patterns.md cross-ref 검증.
- **integrator** — 4-게이트 + worktree race fallback (8 회차 가능성).

## Blocker → Resolved (2026-05-27T14:10:00 → 14:20:00+09:00 — credential → use-local-env-gh-3rd-time)

원본 BLOCKED 사유: cron 발화 turn 진입 시 Anthropic 클라우드 env 에 `gh` CLI 부재 확정 (`which gh` → command not found). T-0066 은 pr-mode 라 reviewer agent 의 PR comment 외부 post (4-게이트 #2) + integrator agent 의 `gh pr checks` / `gh pr merge` (4-게이트 #4 + 실 merge action) 가 전부 gh 의존. executor dispatch 전 graceful BLOCKED, 코드 변경 0.

- HQ-0006 (T-0039, 2026-05-26): install-gh-cli env-bound 1 회성 resolved
- HQ-0008 (T-0061, 2026-05-27): use-local-env-gh 1 회성 resolved
- HQ-0009 (본 task, 2026-05-27): **use-local-env-gh-3rd-time** resolved — 사용자 `/loop turn cap 10` (session #20 turn 1, KST 14:15) 진입 후 local Windows env (D:/Assessment-Agent/.claude/worktrees/suspicious-fermat-39846f) gh v2.88.1 + Active=true 확인 + executor pr-mode full chain (architect 0 + implementer + tester + reviewer + integrator) → 4-게이트 all PASS → PR-60 squash merge sha **91182a5** (worktree race 8 회차 dogfood `gh api -X DELETE` fallback). 영구 fix (install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp ADR 박제) 는 별도 follow-up task 책임.

**Resolution outcomes**:
- (i) cron-vs-loop env credential 3 회차 반복 = systemic — 영구 fix 책임 follow-up task 위임 박제
- (ii) cron-vs-loop race 첫 dogfood — cron a153ae5 BLOCKED bookkeeping push 와 loop executor merge 가 동시 발화, executor merge 가 cron commit 위에 자연 stack (lost work 0)
- (iii) estimate model first-pass under-estimate 검증 — service-with-spec × 1.5 multiplier 의 220 estimate 가 281 actual (+61 LOC), enumerated negative 카테고리 별도 multiplier 분리 follow-up

## Follow-ups

(planner queue 후 추가 — implementer / tester / reviewer / integrator 가 append)

- (planner pre-queue) **T-0067 후보**: GroupService.update + spec 박제 — P2025 → NotFoundException 변환 + name 의 도메인 invariant 분기.
- (planner pre-queue) **T-0068 후보**: GroupController @Patch(":id") + spec 박제 + api.md PATCH /api/groups/:id row 추가.
- (planner pre-queue) **T-0069 후보**: Part 도메인 PATCH (UpdatePartDto + PartRepository.update + PartService.update + PartController.@Patch + 각 spec) — Group precedent 1 회 박제 후 mirror.

---
id: T-0069
title: UpdatePartDto + PartRepository.update 부분 update 첫 layer (Group precedent mirror, P2002 분기 박제)
phase: P3
status: DONE
commitMode: pr
prNumber: 63
mergedAs: 14f64bf
completedAt: 2026-05-27
reviewRounds: 1
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 220
actualDiff: 334
estimatedFiles: 4
created: 2026-05-27
dependsOn: [T-0036, T-0039, T-0057, T-0066]
plannerNote: session #20 turn 6 — Group 4-layer closure 후 Part 도메인 CRUD-U mirror 첫 layer (DTO+repo). P2002 분기 명시 박제 (Part.name @unique).
---

# T-0069 — UpdatePartDto + PartRepository.update 부분 update 첫 layer

## Why

[PLAN.md](../PLAN.md) Phase P3 backbone 의 CRUD-U gap 박제 — Part 도메인 mirror 시작. Group 도메인은 T-0066 (DTO+repo) → T-0067 (service) → T-0068 (controller @Patch) 4-layer 박제 완료 (lastCommit 7509a7a, **Group 도메인 CRUD-U fully closed**). Person 도메인은 T-0036/T-0041 박제 완료. Part 도메인은 [src/user/part.repository.ts](../../src/user/part.repository.ts) 의 책임 경계 주석이 "CRUD primitive 4 종 (create/findById/findMany/delete) 만 — update 미박제" 박제 — 본 task 가 그 5 번째 메서드 + DTO 의 2 layer 박제 시작.

REQ-028 (조직도 파트 정확히 1 invariant — service-layer 책임) + REQ-051 (Part entity invariant) + REQ-058 (REST 표준) 의 partial update 의미 정의 박제. **Group 과의 차이**: Part.name 은 [prisma/schema.prisma L108](../../prisma/schema.prisma) `@unique` **정의** — P2002 분기 **존재** (Group 은 `@unique` 미정의로 P2002 부재). 본 task 는 P2002 branch 의 명시 박제가 핵심 deliverable.

## Required Reading

- [docs/tasks/T-0066-group-update-dto-and-repository.md](T-0066-group-update-dto-and-repository.md) — Group 도메인 DTO+repo 1 차 precedent. 본 task 의 1:1 mirror 대상.
- [src/user/dto/update-group.dto.ts](../../src/user/dto/update-group.dto.ts) — UpdatePartDto 의 1:1 mirror source (name 단일 필드 + class-validator decorator 4 종).
- [src/user/dto/update-group.dto.spec.ts](../../src/user/dto/update-group.dto.spec.ts) — UpdatePartDto.spec 의 R-112 4 카테고리 cover 패턴 mirror.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — Part name 컬럼의 class-validator 정합 박제 source (UpdatePartDto 와 동일 validation 규칙 reuse).
- [src/user/part.repository.ts](../../src/user/part.repository.ts) — 기존 4 메서드 (create/findById/findMany/delete) + PartCreateInput 패턴. 본 task 는 `update` 5 번째 메서드 + PartUpdateInput interface 추가. P2002 / P2003 / P2025 propagate 정책 박제.
- [src/user/part.repository.spec.ts](../../src/user/part.repository.spec.ts) — 기존 4 메서드 unit spec 패턴 (PrismaService mock + `Object.assign(new Error, {code})` P2002/P2003/P2025 박제) 의 mirror source.
- [src/user/group.repository.ts](../../src/user/group.repository.ts) — `update` 메서드 시그니처 mirror source (GroupRepository.update 가 1 차 backbone precedent).
- [src/user/group.repository.spec.ts](../../src/user/group.repository.spec.ts) — update describe block 의 R-112 4 카테고리 cover precedent.
- [prisma/schema.prisma L106-114](../../prisma/schema.prisma) — Part model 의 `name @unique` directive 박제 (Group 과의 차이). P2002 분기 정당화 source.
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 — service-with-spec × 1.5 multiplier 적용 근거 (T-0066 +28% under-estimate + T-0067 +7% accurate + T-0068 -24% over-estimate 3 회차 calibration data 박제 후 multiplier 정착).

## Acceptance Criteria

본 task 의 변경 대상:

### A. UpdatePartDto 신설 + spec

- [ ] `src/user/dto/update-part.dto.ts` 신설. 한국어 JSDoc header — 책임 / Out of Scope / Group UpdateGroupDto precedent reference + **P2002 분기 존재 박제 (Part.name @unique 정의)**.
- [ ] class field 1 종: `name?: string` — `@IsOptional()` + `@IsString()` + `@IsNotEmpty()` + `@MaxLength(255)` decorator (CreatePartDto 의 name field validation 1:1 mirror, 단 `@IsOptional()` 추가 — PATCH partial semantics 박제).
- [ ] `src/user/dto/update-part.dto.spec.ts` 신설. **R-112 4 카테고리 cover** (per CLAUDE.md §3.2 R-112 의무):
  - **happy-path 1+**: name 단일 필드 박제 + plainToInstance + validate 0 error 검증.
  - **error path 1+**: name 빈 문자열 → `@IsNotEmpty()` violation; name 256 byte → `@MaxLength` violation; name 비-string → `@IsString()` violation.
  - **branch 1+**: name 미포함 (empty object `{}`) → `@IsOptional()` 분기 → validation pass (PATCH no-op 시점 박제). UpdateGroupDto.spec 의 동일 branch 패턴 mirror.
  - **negative cases 충분 cover**: name=null / name=undefined / name=number / name=boolean → 최소 3 종 negative test. extra-property "non-whitelisted-field" 거부는 ValidationPipe global 책임이므로 본 spec 에선 skip.

### B. PartRepository.update 메서드 + spec

- [ ] `src/user/part.repository.ts` 의 5 번째 메서드 `async update(id: string, input: PartUpdateInput): Promise<Part>` 추가. `PartUpdateInput` interface 신설 (`name?: string` 단일 필드, partial update semantics 박제). Prisma `this.prisma.part.update({ where: { id }, data: input })` raw forward.
- [ ] error 정책 박제 (JSDoc + 코드 주석):
  - **P2002** (name unique 위반) raw propagate — Part.name `@unique` directive (schema.prisma L108) 의 schema-level enforce. 본 layer catch X — service-layer (후속 task) 가 `ConflictException` 변환 책임.
  - **P2025** (row 부재) raw propagate — service-layer 의 update 가 후속 task 에서 `P2025 → NotFoundException` 변환 책임.
  - (P2003 은 update operation 에서 발생 안 함 — delete 의 cascade 정책 책임. 본 task 의 update 는 P2003 분기 부재 박제.)
- [ ] 한국어 JSDoc header 갱신 — 기존 책임 경계 주석에 update 메서드 1 줄 추가 (GroupRepository.update 패턴 mirror + Part 특유 P2002 분기 명시 — name @unique).
- [ ] `src/user/part.repository.spec.ts` 의 update describe block 신설. **R-112 4 카테고리 cover**:
  - **happy-path 1+**: PrismaService.part.update mock 이 정상 Part row 반환 시 메서드가 same row return 검증 + mock 호출 인자 정합 (`{where:{id},data:input}`).
  - **error path 1+ (P2002 핵심 박제)**: PrismaService.part.update mock 이 reject(`Object.assign(new Error("Unique constraint failed"),{code:"P2002"})`) 시 메서드가 동일 error 를 raw propagate (catch 안 함). **Group precedent 와의 차이점 박제** — Group 의 update.spec 은 P2002 분기 부재, Part 는 P2002 명시.
  - **error path 2 (P2025 row 부재)**: PrismaService.part.update mock 이 reject(`{code:"P2025"}`) 시 메서드가 동일 error 를 raw propagate.
  - **branch 1+**: input 의 name 필드 missing (`{}`) 도 동일하게 forward (Prisma 가 빈 data 의 PATCH no-op semantic 처리) — 호출 인자 검증.
  - **negative cases 충분 cover**: PrismaService.part.update reject(non-Prisma generic Error) → raw propagate; reject(`code:"P9999"`) → raw propagate; empty string id (`""`) 도 raw forward — 최소 3 종 negative test (P9999 + generic Error + 빈 id 3 분기 명시).

### C. Test/CI 수행 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 의 신규 신설 코드 (UpdatePartDto + PartRepository.update) 의 coverage 는 colocated spec 으로 **100% 박제 의무**.
- [ ] `pnpm test:smoke` 통과 (DATABASE_URL local PostgreSQL 16 가정, T-0059 패턴 reuse — parts.smoke 본 task scope 변경 0).
- [ ] `pnpm test:e2e` 통과 (DATABASE_URL local PostgreSQL 16, T-0060 패턴 reuse — parts.e2e 본 task scope 변경 0).
- [ ] CI 의 6 step (lint / build / test:cov / smoke / e2e / reviewer agent approval 검증) 전부 green.

### D. PR / 4-게이트

- [ ] feature branch `claude/T-0069-part-update-dto-and-repository` push.
- [ ] PR open — title/body 한국어 + AC 체크리스트 + Refs 단락 + Group UpdateGroupDto precedent reference + **P2002 분기 존재 명시** (Group 과의 차이 강조).
- [ ] reviewer agent round 1 → APPROVE 또는 ANOTHER_ROUND (round ≤ 7).
- [ ] reviewer comment 외부 post 검증 (4-게이트 #2).
- [ ] integrator self-check 6 항목 PASS (4-게이트 #3).
- [ ] CI green (4-게이트 #4 + R-114).
- [ ] `gh pr merge --squash --delete-branch` 머지 — worktree race 11 회차 가능 시 [race-patterns.md §2](../architecture/race-patterns.md) 의 fallback `gh api -X DELETE refs/heads/<branch>` 적용 (T-0066/T-0067/T-0068 누적 3 회차 정착).

## Out of Scope

- **PartService.update 신설 안 함** — 후속 T-0070 책임. 본 task 는 repository + DTO 의 2 layer 만 박제. service.update 가 P2025 → NotFoundException + P2002 → ConflictException 변환 + name 의 도메인 invariant (예: 길이 / 형식 추가) 를 다음 task 에서 책임.
- **PartController @Patch endpoint 신설 안 함** — 후속 T-0071 책임. 본 task 는 endpoint 추가 0 — api.md 의 PATCH /api/parts/:id 박제는 T-0071 시점.
- **prisma/schema.prisma 변경 안 함** — Part.name `@unique` 박제 유지, 추가 컬럼 도입 안 함.
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지.
- **smoke / e2e spec 신규 추가 안 함** — repository + DTO 만 추가, controller endpoint 변경 0 이므로 HTTP-layer test 갱신 불요. parts.smoke (T-0059) + parts.e2e (T-0060) 는 본 task scope 변경 0.
- **REQ-028 invariant (Person 의 정확히 1 Part) service-layer 강제 안 함** — Part 의 update 자체는 invariant 영향 없음 (Person 의 partId 는 변경 안 됨). 본 task 는 Part entity 의 부분 update 만.
- **Group / Person 도메인 동시 변경 안 함** — Group T-0066~T-0068 박제 완료 + Person T-0036/T-0041 박제 완료, 본 task 는 Part 단독.
- **ADR 신설 안 함** — ADR-0005 (race-fix) / ADR-0007 (audit log) / ADR-0008 (auth credential) / multi-worktree planner stale-STATE 정책 ADR 의 진행은 별도 task. 본 task 는 ADR 0.
- **race-patterns.md / estimate-model.md 갱신 안 함** — T-0068 turn 5 lessons (10 회차 milestone + multi-worktree planner stale-STATE) 박제는 별도 follow-up task. 본 task 진행 중 추가 race 발견 시 follow-up 에 기록.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator`

- **architect 호출 0** — UpdateGroupDto + GroupRepository.update (T-0066) 의 1 차 precedent + PersonRepository.update (T-0036) 의 2 차 precedent 가 모든 의사결정 박제. 새 ADR 0.
- **implementer** — A.1~A.3 + B.1~B.4 (DTO + repository.update 메서드 + 한국어 JSDoc + spec 4 카테고리 + P2002 분기 박제). cap envelope ~220 LOC / 4 파일 (× 1.5 service-with-spec multiplier + T-0066 의 +28% under-estimate 학습 + T-0068 의 -24% over-estimate 학습 calibration — Part 의 P2002 분기 추가로 Group estimate 보다 ~10-15 LOC 증가 예상).
- **tester** — C.1~C.6 (lint / build / test:cov / smoke / e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 박제 + Group/Person precedent mirror 정합 + **P2002 분기 명시 박제 검증** + Out of Scope 준수 + race-patterns.md cross-ref 검증.
- **integrator** — 4-게이트 + worktree race 11 회차 fallback (T-0066/T-0067/T-0068 3 회차 정착 패턴 reuse).

## Follow-ups

(planner queue 후 추가 — implementer / tester / reviewer / integrator 가 append)

- (planner pre-queue) **T-0070 후보**: PartService.update + spec 박제 — P2025 → NotFoundException + P2002 → ConflictException 변환 + name 도메인 invariant.
- (planner pre-queue) **T-0071 후보**: PartController @Patch(":id") + spec + api.md PATCH /api/parts/:id row 추가 (Part 도메인 CRUD-U 4-layer fully closed).
- (planner pre-queue) **HQ-0009 영구 fix ADR** (install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp 박제 + follow-up task).
- (planner pre-queue) **multi-worktree planner stale-STATE 정책 ADR** (turn 5 lesson 박제 — planner prompt 강화 + worktree-multi 환경 정책).
- (planner pre-queue) **estimate model multiplier doc refinement** (T-0066 +28% under / T-0067 +7% accurate / T-0068 -24% over / 본 T-0069 4 회차 calibration data 박제 후 정착).
- (planner pre-queue) **race-patterns.md §8 cron-vs-loop variant + worktree race 10 회차 milestone 박제**.

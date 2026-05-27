---
id: T-0071
title: PartService.update + spec — P2025→NotFoundException + P2002→ConflictException 변환 (Group T-0067 mirror + ConflictException 추가)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 360
estimatedFiles: 2
created: 2026-05-27
dependsOn: [T-0036, T-0050, T-0057, T-0067, T-0069]
plannerNote: session #20 turn 10 cap-close — T-0069 의 자연 follow-up. Part service-layer update + P2002→ConflictException 변환 박제 (Group T-0067 mirror, Part.name @unique 분기 추가).
---

# T-0071 — PartService.update + spec (P2025 → NotFoundException + P2002 → ConflictException 변환 layer)

## Why

[T-0069](T-0069-part-update-dto-and-repository.md) 머지로 Part 도메인 PATCH 의 2 layer ([UpdatePartDto](../../src/user/dto/update-part.dto.ts) + [PartRepository.update](../../src/user/part.repository.ts) L99) 가 박제됐다. 다음 layer 는 `PartService.update` — repository 의 raw P2025 / P2002 throw 를 NestJS `NotFoundException` / `ConflictException` 으로 변환하는 service-layer 의미 부여. [GroupService.update L162-186](../../src/user/group.service.ts) precedent 가 1 차 mirror source — 단 Group 은 P2002 분기 부재 (Group.name `@unique` 미정의) 였으나 Part 는 P2002 분기 **존재** ([schema.prisma L108](../../prisma/schema.prisma) `name @unique`) 이므로 [PersonService.update L102-125](../../src/user/person.service.ts) 의 P2002→ConflictException 변환 패턴까지 추가 박제. 본 task 머지 후 [T-0072](#) (planner queue 시점) 가 PartController @Patch(":id") endpoint 추가로 Part 도메인 CRUD-U 4-layer 완성.

REQ-028 (조직도 파트 정확히 1 invariant — service-layer 책임) + REQ-051 (Part entity invariant) + REQ-058 (REST 표준) 의 service-layer 부분 update semantics 박제. [part.service.ts L13-16](../../src/user/part.service.ts) 의 책임 경계 주석 "PartRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task)" 의 일부 해소.

**Group precedent 와의 핵심 차이 (P2002 분기 명시 박제)**: Part.name `@unique` 존재 → P2002 변환 분기 **필수**. PartService.create (L58-67) 가 이미 `P2002 → ConflictException("part name already in use: ${dto.name}")` 박제 — update 도 동일 메시지 정합 (단 `patch.name` undefined 가능).

## Required Reading

- [docs/tasks/T-0069-part-update-dto-and-repository.md](T-0069-part-update-dto-and-repository.md) — 직전 layer 박제 (UpdatePartDto + PartRepository.update + PartUpdateInput interface + P2002 분기 raw propagate).
- [docs/tasks/T-0067-group-service-update.md](T-0067-group-service-update.md) — 1 차 mirror precedent (GroupService.update P2025→NotFoundException 변환). 본 task 는 그 위에 P2002→ConflictException 추가.
- [src/user/group.service.ts L162-186](../../src/user/group.service.ts) — `update()` 1 차 precedent (RFC-7396 partial update + undefined spread guard + P2025 catch).
- [src/user/group.service.spec.ts](../../src/user/group.service.spec.ts) — `describe("update()", ...)` block 의 R-112 4 카테고리 cover 패턴 mirror source.
- [src/user/person.service.ts L96-125](../../src/user/person.service.ts) — `update()` 메서드 의 P2002→ConflictException 변환 패턴 2 차 precedent.
- [src/user/person.service.spec.ts L215-360](../../src/user/person.service.spec.ts) — P2002 변환 describe 의 R-112 cover 패턴.
- [src/user/part.service.ts](../../src/user/part.service.ts) — 본 task 의 변경 대상. L13-16 책임 경계 주석 갱신 + 신규 `update()` 메서드 추가 위치. L58-67 `create()` 의 P2002→ConflictException 메시지 정합 source.
- [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) — 본 task 의 변경 대상. 기존 5 메서드 + `getPrismaErrorCode` helper + `buildPrismaError` 패턴 mirror.
- [src/user/part.repository.ts L99-115](../../src/user/part.repository.ts) — T-0069 박제 `update(id, input)` 메서드 + PartUpdateInput interface (`name?: string` 단일 필드) + P2002/P2025 raw propagate 정책.
- [src/user/dto/update-part.dto.ts](../../src/user/dto/update-part.dto.ts) — T-0069 박제 UpdatePartDto (`name?: string` 단일 필드).
- [prisma/schema.prisma L106-114](../../prisma/schema.prisma) — Part model 의 `name @unique` directive 박제 (P2002 분기 정당화 source).
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 + §4.1 — service-with-spec × 1.5 multiplier + **P2002 sub-multiplier × 1.2** 적용 근거. 본 task 가 P2002 sub-multiplier × 1.2 첫 사용 사례.

## Estimate breakdown

[estimate-model.md](../architecture/estimate-model.md) §5 planner 적용 절차 따라:

- **base estimate**: 200 LOC (T-0067 GroupService.update + spec 의 200 LOC base 직관 재사용 — service.update 메서드 ~25 LOC + spec describe block ~140 LOC + JSDoc ~35 LOC).
- **multiplier × 1.5** (R-112 4-카테고리 cover backbone — happy/error/branch/negative test 의무 + JSDoc 한국어 책임 경계).
- **P2002 sub-multiplier × 1.2** (Part.name @unique 분기 추가 — estimate-model.md §4.1 박제 첫 사용 사례, Group precedent 대비 P2002 변환 spec test +3~4 it / JSDoc +20 LOC / catch 분기 +10 LOC = +60 LOC 자연 mass).
- **effective**: 200 × 1.5 × 1.2 = **360 LOC envelope** / 2 파일.
- **cap envelope > 300 LOC** → planner-pre-justified `sizeExempt: false` 미사용 + cap-bend 정당화 명시. R-112 atomic-introduce 의무 (§3.2 — 새 public symbol 도입 시 happy/error/branch/negative 4 카테고리 동일 commit) 가 split 회피 사유. 단 T-0066 (+28%) / T-0067 (+7%) / T-0068 (-24%) / T-0069 (+45%) calibration 평균 +16% 따르면 실 actual ~250-300 LOC 도 가능 — envelope 보수 측 산정.

## Acceptance Criteria

본 task 의 변경 대상:

### A. PartService.update 메서드 신설

- [ ] `src/user/part.service.ts` 에 `async update(id: string, patch: UpdatePartDto): Promise<Part>` 메서드 추가. GroupService.update + PersonService.update 패턴 mirror:
  - `import type { UpdatePartDto } from "./dto/update-part.dto"` 추가.
  - body: `try { return await this.partRepository.update(id, { ...(patch.name !== undefined && { name: patch.name }) }) } catch (error) { const code = getPrismaErrorCode(error); if (code === "P2025") throw new NotFoundException("part not found: ${id}"); if (code === "P2002") throw new ConflictException("part name already in use: ${patch.name ?? ''}"); throw error; }`.
  - **P2002 변환 분기 필수** — Part.name `@unique` 정의 ([schema.prisma L108](../../prisma/schema.prisma)) 박제. PartService.create L62-64 의 동일 메시지 정합 (`part name already in use: ${...}`) 단 `patch.name` undefined 시 빈 string fallback.
  - undefined spread guard — `patch.name === undefined` 시 빈 객체 `{}` 를 repository 로 forward (PATCH no-op semantic 박제, Prisma `@updatedAt` directive 가 updatedAt 만 갱신).
- [ ] 한국어 JSDoc header 신설 (15~20 줄):
  - 책임 — "RFC-7396 partial update + P2025 → NotFoundException + P2002 → ConflictException 변환".
  - branch 분기 박제 — `patch.name !== undefined` vs `undefined` 의 spread 동작 차이.
  - **P2002 분기 존재 사유 명시** — Part.name `@unique` (schema.prisma L108) + Group.name `@unique` 미정의 와의 차이 박제. PartService.create L58-67 의 P2002→ConflictException 변환 1 차 박제 + update 의 메시지 정합.
  - 책임 경계 — PATCH endpoint (controller) 는 후속 T-0072 책임.
- [ ] 기존 L13-16 책임 경계 주석 갱신 — "PartRepository.update 추가 / PATCH endpoint 없음" → "PartController PATCH 없음 (CRUD 의 C/R/D + service.update 만 — controller PATCH 는 별도 후속 task T-0072)".

### B. PartService.update spec 신설

- [ ] `src/user/part.service.spec.ts` 의 `describe("update()", ...)` block 신설. **R-112 4 카테고리 cover** (per CLAUDE.md §3.2 R-112 의무):
  - **happy-path 1+**: name patch 시 PartRepository.update mock 이 정상 Part row 반환 + mock 호출 인자 `(id, {name})` 정합 + service 가 same row return 검증.
  - **error path 1 (P2025 → NotFoundException)**: PartRepository.update mock 이 reject(`buildPrismaError("P2025")`) 시 service 가 NotFoundException throw + error message 가 "part not found: " + id 포함 검증.
  - **error path 2 (P2002 → ConflictException) — Group precedent 차별 핵심**: PartRepository.update mock 이 reject(`buildPrismaError("P2002")`) 시 service 가 ConflictException throw + error message 가 "part name already in use: " + patch.name 포함 검증. PartService.create P2002 변환 메시지 정합 (L62-64).
  - **branch 1+** (다중):
    - `patch.name !== undefined` → `{name}` forward (happy 와 별도 추가 가능).
    - `patch.name === undefined` (빈 `{}` patch) → repository 로 빈 객체 `{}` forward (PATCH no-op).
    - P2002 + `patch.name === undefined` 분기 → error message 의 fallback empty string 박제 (defensive — 실 사용 unlikely 이나 분기 명시).
  - **negative cases 충분 cover** (3+ 분기):
    - unknown Prisma error code (`P9999`) → raw propagate (NotFoundException/ConflictException 안 변환).
    - code 없는 generic Error → raw propagate.
    - undefined name patch + repository 가 정상 반환 시점 동작 (no-op semantic 박제 — repository 가 정상 Part 반환).
    - 빈 string id (`""`) 도 repository 로 forward (PartService.findById negative pattern mirror).
- [ ] 본 task 의 신규 신설 코드 (service.update + spec) 의 coverage 는 colocated spec 으로 **100% line / function / branch / statement** 박제 의무.

### C. Test/CI 수행 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global` 강제). 본 task 신규 코드 100% 박제.
- [ ] `pnpm test:smoke` 통과 (DATABASE_URL local PostgreSQL 16, T-0059 패턴 reuse — parts.smoke 본 task scope 변경 0).
- [ ] `pnpm test:e2e` 통과 (DATABASE_URL local PostgreSQL 16, T-0060 패턴 reuse — parts.e2e 본 task scope 변경 0).
- [ ] CI 의 6 step (lint / build / test:cov / smoke / e2e / reviewer agent approval 검증) 전부 green.

### D. PR / 4-게이트

- [ ] feature branch `claude/T-0071-part-service-update` push.
- [ ] PR open — title/body 한국어 + AC 체크리스트 + Refs 단락 + GroupService.update T-0067 precedent reference + PersonService.update L102-125 P2002 변환 precedent reference + estimate breakdown 단락 (× 1.5 × 1.2 = effective × 1.8 첫 사용 사례).
- [ ] reviewer agent round 1 → APPROVE 또는 ANOTHER_ROUND (round ≤ 7). **review 핵심 포인트**: (i) R-112 4 카테고리 cover 검증 — happy + P2025 error + P2002 error (Group 차별 핵심) + branch + negative 3+ (ii) JSDoc 한국어 P2002 분기 존재 사유 명시 검증 (iii) PartService.create P2002 메시지 정합 검증 (iv) Group precedent 와의 차이 명시 검증 (v) estimate model § 4.1 P2002 sub-multiplier × 1.2 첫 사용 사례 박제.
- [ ] reviewer comment 외부 post 검증 (4-게이트 #2).
- [ ] integrator self-check 6 항목 PASS (4-게이트 #3).
- [ ] CI green (4-게이트 #4 + R-114).
- [ ] `gh pr merge --squash --delete-branch` 머지 — worktree race 12 회차 가능성 시 [race-patterns.md §2](../architecture/race-patterns.md) `gh api -X DELETE refs/heads/<branch>` fallback 적용 (T-0066/T-0067/T-0068/T-0069 누적 4 회차 precedent).

## Out of Scope

- **PartController @Patch(":id") endpoint 신설 안 함** — 후속 T-0072 (planner queue 시점) 책임. 본 task 는 service layer 의 update 메서드만. api.md 의 PATCH /api/parts/:id row 추가는 T-0072 시점.
- **PartRepository.update 변경 안 함** — T-0069 박제 유지. P2002/P2025 raw propagate 정책 유지.
- **prisma/schema.prisma 변경 안 함** — Part.name `@unique` 박제 유지. Group.name `@unique` 추가 안 함 (별도 ADR 필요 결정).
- **PartService.create 의 P2002 변환 메시지 수정 안 함** — L62-64 박제 유지, 본 task 의 update 가 동일 메시지 정합.
- **PartService.delete 의 P2003 변환 갱신 안 함** — L90-103 박제 유지.
- **`getPrismaErrorCode` helper 외화 안 함** — 3 service (Person / Part / Group) 중복은 [part.service.ts L36-46](../../src/user/part.service.ts) 박제 (T-0050 §Follow-ups 의 phase 2 외화 candidate). 본 task 는 in-place 유지.
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지.
- **smoke / e2e spec 신규 추가 안 함** — service layer 만 변경, controller endpoint 변경 0 이므로 HTTP-layer test 갱신 불요. parts.smoke (T-0059) + parts.e2e (T-0060) 는 본 task scope 변경 0.
- **ADR 신설 안 함** — ADR-0005 (race-fix) / ADR-0007 (audit log) / ADR-0008 (auth credential) 진행은 별도 task.
- **race-patterns.md 갱신 안 함** — T-0065 박제 + 11 회차 milestone 유지. 본 task 진행 중 추가 race 발견 시 Follow-ups 에 기록.
- **estimate-model.md 갱신 안 함** — T-0070 박제 유지. 본 task 의 actual LOC 결과는 다음 multiplier refinement task (15 회차 milestone) 에서 흡수.
- **PartService 의 dependency 추가 안 함** — PartRepository + PersonRepository 만 의존, 신규 service inject 0.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator`

- **architect 호출 0** — GroupService.update (T-0067) + PersonService.update (T-0036) + PartService.create P2002 변환 (T-0050) 의 precedent 가 모든 의사결정 박제, 새 ADR 0. P2002 sub-multiplier × 1.2 도 estimate-model.md §4.1 박제 (T-0070) 후 첫 사용, 새 결정 0.
- **implementer** — A.1~A.3 + B.1~B.2 (service.update 메서드 + JSDoc + spec 4 카테고리 박제). cap envelope ~360 LOC / 2 파일 (× 1.5 × 1.2 = effective × 1.8 multiplier, P2002 sub-multiplier 첫 사용 사례).
- **tester** — C.1~C.6 (lint / build / test:cov / smoke / e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 P2002 분기 박제 + GroupService.update precedent mirror 정합 + PartService.create 메시지 정합 + Out of Scope 준수 + estimate-model.md §4.1 P2002 sub-multiplier 첫 사용 사례 박제 검증 + race-patterns.md cross-ref 검증.
- **integrator** — 4-게이트 + worktree race fallback (12 회차 가능성, `gh api -X DELETE` 5 회차 precedent).

## Follow-ups

(planner queue 후 추가 — implementer / tester / reviewer / integrator 가 append)

- (planner pre-queue) **T-0072 후보**: PartController @Patch(":id") endpoint + spec 박제 + api.md PATCH /api/parts/:id row 추가. service.update 의 forward target. PersonController.@Patch + GroupController.@Patch (T-0068) precedent 1:1 mirror.
- (planner pre-queue) **HQ-0009 영구 fix 후보**: install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp ADR 박제 + follow-up task. cron backbone 실효 부재 패턴 영구 해소.
- (planner pre-queue) **multi-worktree planner stale-STATE ADR 후보**: turn 5 lesson + turn 6/7 parent-write rule 정착 박제. planner agent prompt enhancement (`git show origin/main:docs/STATE.json` 강제 또는 driver 의 sync 의무).
- (planner pre-queue) **race-patterns.md §8 후보**: cron-vs-loop race variant 추가 (session #20 turn 1 cron a153ae5 BLOCKED bookkeeping push + loop executor merge 동시 발화 lost work 0 dogfood) + worktree race 12 회차 milestone 박제 (본 task merge 후).
- (planner pre-queue) **estimate model 15 회차 milestone refinement 후보**: T-0066~T-0071 6 회차 누적 + base 7 회차 = 13 회차 데이터 박제 후 multiplier 재산출. **P2002 sub-multiplier × 1.2 첫 사용 사례 검증** (본 task actual LOC) 가 sub-multiplier 정합 / 조정 follow-up.
- (planner pre-queue) **P3 → P4 phase advance 재평가 후보**: Part 4-layer fully closed 후 entity progress 평가 (Group 4-layer + Part 4-layer = 6/11 박제). T-0063 evaluation doc 의 trigger 재평가.

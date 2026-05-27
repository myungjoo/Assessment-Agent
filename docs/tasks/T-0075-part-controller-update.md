---
id: T-0075
title: PartController @Patch(":id") endpoint + spec — Part 도메인 CRUD-U 4-layer fully closed (GroupController T-0068 mirror)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-051, REQ-058]
estimatedDiff: 322
actualDiff: 265
estimatedFiles: 2
actualFiles: 3
sizeExempt: true
exemptReason: R-112 4-카테고리 cover backbone (controller @Patch + spec) atomic-introduce — happy/error/branch/negative 4 카테고리 동일 commit 의무 (§3.2). PersonController.@Patch + GroupController.@Patch (T-0068) precedent 322 LOC envelope 정합. base ~215 × 1.5 = 322 LOC.
estimateOutcome: -17% within-tolerance (envelope 322 actual 265, base 215 × 1.5 × 1.2 P2002 sub × 2 회차 누적 — 첫 사용 T-0071 -10% / 본 task -17%, sub-multiplier × 1.2 정확도 2 회차 dogfood)
created: 2026-05-27
completedAt: 2026-05-27T23:45:05+09:00
dependsOn: [T-0036, T-0068, T-0071]
prNumber: 66
prUrl: https://github.com/myungjoo/Assessment-Agent/pull/66
mergedAs: e5bb1d28c69a706ce56e041940870cc41a7df13a
reviewRounds: 1
plannerNote: session #21 turn 5 cap-close — Part 도메인 마지막 layer (PartController @Patch endpoint), Group 도메인 CRUD-U 4-layer closure (T-0068) 의 mirror. T-0071 PartService.update 의 controller layer forward target.
---

# T-0075 — PartController @Patch(":id") endpoint + spec (Part 도메인 CRUD-U 4-layer fully closed)

## Why

[T-0071](T-0071-part-service-update.md) 머지 (7383b78) 로 PartService.update 박제 완료 (P2025→NotFoundException + P2002→ConflictException 변환, Group precedent 차별 P2002 분기 명시). 다음 layer 는 PartController.@Patch(":id") endpoint — service layer 의 HTTP forward target. [GroupController.@Patch L131](../../src/user/group.controller.ts) (T-0068 박제) 와 [PersonController.@Patch L81-87](../../src/user/person.controller.ts) (T-0036 박제) 의 1:1 mirror.

본 task 머지 후 **Part 도메인 CRUD-U 4-layer fully closed** — UpdatePartDto (T-0069) + PartRepository.update (T-0069) + PartService.update (T-0071) + 본 task PartController.@Patch(":id"). Group 도메인 (T-0066~T-0068) + Part 도메인 (T-0069+T-0071+본 T-0075) 양쪽 평행 4-layer closure.

REQ-028 (조직도 파트 정확히 1 invariant — HTTP layer 책임) + REQ-051 (Part entity invariant) + REQ-058 (REST 표준 PATCH 의미) 의 HTTP-layer 부분 update 박제 완성.

## Required Reading

- [docs/tasks/T-0071-part-service-update.md](T-0071-part-service-update.md) — 직전 layer 박제 (PartService.update + P2025/P2002 변환).
- [docs/tasks/T-0068-group-controller-update.md](T-0068-group-controller-update.md) — 1차 mirror precedent (GroupController.@Patch + spec R-112 4 카테고리).
- [src/user/group.controller.ts](../../src/user/group.controller.ts) L131 — `@Patch(":id")` 1차 precedent (RFC-7396 partial update + service.update 단일 forward + 200 OK 자동 응답).
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) `describe("@Patch(:id)", ...)` block — R-112 4 카테고리 cover 패턴 mirror source.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) L81-87 — 2차 precedent.
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) `describe("@Patch", ...)` block — ValidationPipe integration test pattern.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — 본 task 의 변경 대상. 신규 `@Patch(":id")` 메서드 추가 위치 + 책임 경계 주석 갱신.
- [src/user/part.controller.spec.ts](../../src/user/part.controller.spec.ts) — 본 task 의 변경 대상. `describe("@Patch(:id)", ...)` block 신설.
- [src/user/dto/update-part.dto.ts](../../src/user/dto/update-part.dto.ts) — T-0069 박제 UpdatePartDto.
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.1 + §4 — R-112 4-카테고리 cover backbone × 1.5 multiplier (T-0071 박제 +P2002 sub × 1.2 첫 사용 사례 -10% accurate-pass).
- [docs/architecture/api.md](../architecture/api.md) — `PATCH /api/parts/:id` row 추가 위치 (T-0068 row 다음).

## Acceptance Criteria

### A. PartController.@Patch(":id") 메서드 신설

- [ ] `src/user/part.controller.ts` 에 `@Patch(":id") async update(@Param("id") id: string, @Body() patch: UpdatePartDto): Promise<Part>` 메서드 추가. GroupController.@Patch L131 + PersonController.@Patch L81-87 1:1 mirror:
  - `import { Patch } from "@nestjs/common"` 추가.
  - `import { UpdatePartDto } from "./dto/update-part.dto"` 추가.
  - body: `return await this.partService.update(id, patch)` — service.update 단일 forward (NotFoundException / ConflictException 은 NestJS exception filter 가 자동 HTTP 응답 변환).
  - 200 OK 응답 자동 (NestJS @Patch decorator 기본).
- [ ] 한국어 JSDoc header 신설 (10~15 줄):
  - 책임 — "RFC-7396 partial update + Part.name @unique 분기 + service.update 의 변환 (P2025→404 / P2002→409) HTTP forward".
  - branch 분기 박제 — patch body shape (name only vs 빈 object) + ValidationPipe integration.
  - 책임 경계 — service layer (T-0071 박제) 와 명시 분리. controller 는 HTTP forward 만.
- [ ] 기존 책임 경계 주석 갱신 — "PartController 의 PATCH endpoint 부재" → "CRUD-U 4-layer fully closed".

### B. PartController.@Patch spec 신설

- [ ] `src/user/part.controller.spec.ts` 의 `describe("@Patch(:id)", ...)` block 신설. **R-112 4 카테고리 cover** (CLAUDE.md §3.2 R-112 의무):
  - **happy-path 1+**: valid patch body (name) 시 partService.update mock 이 정상 Part row 반환 + controller 가 same row return 검증 + mock 호출 인자 `(id, patch)` 정합.
  - **error path 1 (NotFoundException propagate)**: service mock 이 reject(NotFoundException) 시 controller 가 동일 exception propagate (NestJS exception filter 처리).
  - **error path 2 (ConflictException propagate)**: service mock 이 reject(ConflictException) 시 동일 propagate.
  - **branch 1+** (다중):
    - `{name}` patch → forward.
    - 빈 `{}` patch → forward (no-op semantic 박제).
  - **negative cases 충분 cover** (3+ 분기 via ValidationPipe integration):
    - 빈 string `{name: ""}` → ValidationPipe 400 (IsNotEmpty 위반).
    - extra field `{name: "x", extra: "y"}` → ValidationPipe 400 (whitelist 위반).
    - wrong type `{name: 123}` → ValidationPipe 400 (IsString 위반).
    - MaxLength(255) 초과 → ValidationPipe 400.
- [ ] 본 task 의 신규 코드 (controller @Patch + spec) coverage colocated **100% line/branch/function/statement**.

### C. api.md amend

- [ ] `docs/architecture/api.md` 의 endpoint 표에 `PATCH /api/parts/:id` row 추가 (T-0068 row `PATCH /api/groups/:id` 다음 위치). body shape `UpdatePartDto` + response Part + 200 OK + 404 NotFound + 409 Conflict 박제.

### D. Test / 검증 (R-110 / R-112 / R-114)

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥80% func ≥80% global threshold, 신규 코드 100% colocated).
- [ ] `pnpm test:smoke` 통과 (parts.smoke scope 변경 0, T-0059 박제 reuse).
- [ ] `pnpm test:e2e` 통과 (parts.e2e scope 변경 0, T-0060 박제 reuse — 단 PATCH endpoint e2e 박제는 후속 task 후보).
- [ ] CI 6 step green (lint / build / test:cov / smoke / e2e / reviewer-gate).

### E. PR / 4-게이트

- [ ] feature branch `claude/T-0075-part-controller-update` push.
- [ ] PR open + reviewer round 1 → APPROVE 또는 ANOTHER_ROUND.
- [ ] reviewer comment 외부 post (4-게이트 #2).
- [ ] integrator self-check (4-게이트 #3).
- [ ] CI green (4-게이트 #4).
- [ ] `gh pr merge --squash --delete-branch` — worktree race 13 회차 가능성 시 `gh api -X DELETE refs/heads/<branch>` fallback (race-patterns.md §2, T-0066~T-0071 누적 6 회차).

## Out of Scope

- **PartController PATCH e2e spec 신설 안 함** — 본 task 는 unit/integration 만. PATCH e2e 박제는 별도 후속 task (parts.e2e amend 또는 새 task).
- **PartService.update 변경 안 함** — T-0071 박제 유지.
- **UpdatePartDto / PartRepository.update 변경 안 함** — T-0069 박제 유지.
- **PartService.delete 변경 안 함** — L90-103 박제 유지.
- **AuthGuard / 권한 layer 추가 안 함** — ADR-0008 auth credential 미박제 상태 유지.
- **api.md 의 다른 row 변경 안 함** — PATCH /api/parts/:id 추가만.
- **ADR 신설 안 함**.
- **smoke / e2e 신규 spec 추가 안 함** — controller layer 만, T-0059/T-0060 기존 spec scope 변경 0.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect 호출 0)

- **architect 호출 0** — GroupController.@Patch (T-0068) + PersonController.@Patch (T-0036) precedent 1:1 mirror, 새 ADR 0, 새 외부 dependency 0.
- **implementer** — A.1~A.3 + B.1~B.2 + C.1 (controller method + JSDoc + spec 4 카테고리 + api.md row). cap envelope 322 LOC / 2~3 파일 (sizeExempt:true, R-112 atomic-introduce).
- **tester** — D.1~D.5 (lint + build + test:cov + smoke + e2e). DATABASE_URL local 의존 (jest-smoke-setup / jest-e2e maxWorkers:1).
- **reviewer** — R-112 4 카테고리 cover 검증 + JSDoc 한국어 + GroupController.@Patch precedent mirror 정합 + Out of Scope 준수 + estimate-model.md §3.1 backbone × 1.5 multiplier 검증.
- **integrator** — 4-게이트 + worktree race fallback (13 회차 가능성).

## Follow-ups

- **parts.e2e PATCH endpoint 박제** — 본 task 머지 후 parts.e2e amend 또는 새 task (PATCH e2e HTTP contract depth).
- **estimate-model.md §6 20 회차 milestone refinement** — T-0066~T-0075 누적 10 회차 + inline-amend sub-multiplier × 0.4 추가 calibration data.
- **race-patterns.md §8 cron-vs-loop variant + 12 회차 milestone + multi-driver collab 3-way pattern 박제**.
- **phase 2 src/user spec migration** — ~200-250 LOC mechanical.
- **P3 → P4 phase advance 재평가** — Group 4-layer + Part 4-layer (본 task 머지 후) = 8/11 entity backbone 박제 → P4 phase advance trigger 충족 검토.
- **Person 도메인 PATCH retroactive 검토** — Person 의 update 가 이미 T-0036 시점 박제 → 일관성 확인.

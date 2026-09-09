---
id: T-1998
title: Add idempotent difficulty slot seed endpoint (POST /api/llm/difficulty-mappings/seed)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 360
estimatedFiles: 6
sizeExempt: true
exemptReason: "census-guard-forces-e2e: 신규 route 는 route-e2e census drift guard(allowlist 정확히 []) 때문에 e2e spec 동반이 필수라 6 파일 · ~360 LOC 이 최소 머지 가능 단위"
created: 2026-09-09
independentStream: llm-difficulty
dependsOn: []
touchesFiles:
  - src/llm/difficulty-mapping.service.ts
  - src/llm/difficulty-mapping.service.spec.ts
  - src/llm/difficulty-mapping.controller.ts
  - src/llm/difficulty-mapping.controller.spec.ts
  - docs/architecture/api.md
  - test/e2e/difficulty-mappings.e2e-spec.ts
plannerNote: P5 REQ-050 잔여 — ADR-0011 64 행 3 슬롯 seed 경로 부재를 Admin 멱등 route 로 배선, census guard 상 e2e 동반 필수라 cap-bend
---

# T-1998 — 난이도 3 슬롯 멱등 seed endpoint 신설

## Why

[docs/requirements.md](../requirements.md) `69 행` REQ-050 은 `IN_PROGRESS` 이고, 그 행이 자인한 잔여 중 하나가 **"Decision §1 · §3 운영 함의가 전제한 3 row seed 경로 부재"** 다. [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) `64 행` 은 "entity code task 의 seed (Decision §1 의 3 row) 가 초기 매핑을 제공하고, Admin 이 endpoint 로 슬롯별 model 을 갱신" 을 운영 전제로 박았는데, 현재 슬롯 row 를 만드는 경로가 **어디에도 없다** — `PATCH /api/llm/difficulty-mappings/:difficulty` 는 [difficulty-mapping.repository.ts](../../src/llm/difficulty-mapping.repository.ts) `88 행` `updateProviderConfig` 가 `update`(upsert 아님)라 슬롯 부재 시 P2025 → 404 로 끝난다. 즉 운영 DB 에서는 Admin 이 난이도별 model 을 **영원히 지정할 수 없다**. 본 slice 는 그 빈칸을 Admin 전용 멱등 seed route 로 메운다.

**issue-still-relevant pre-check (origin/main `97628da4` 실측)** — 미해소 확인:

- `git grep -n '"seed' origin/main -- package.json` 히트 **1 건**(`27 행` `seed:devset-logins`) 뿐 — 난이도 슬롯 seed script **0**.
- `git grep -n 'seedDifficultySlot\|ensureDifficultySlot\|difficulty-slot-seed' origin/main` 히트 **0**.
- `grep -i difficulty deploy/seed-llm-config.sh` 히트 **0** (배포 seed 경로도 슬롯을 만들지 않는다).
- `prisma/` 에는 `migrations/` · `schema.prisma` 뿐 — seed script 파일 **0**.
- `test/e2e/difficulty-mappings.e2e-spec.ts` `101 행` `seedThreeSlots()` 는 spec 내부 헬퍼라 **운영 경로가 아니다**.
- `git log origin/main --oneline -8 -- src/llm/` 최신 3 건은 기본 provider 축(T-1863~T-1865)이고 슬롯 생성 경로 변경 **0**.

### Scope note — CLAUDE.md §3 cap 초과 사유 (예외 조항 적용)

**caps 를 초과한다**: `estimatedDiff: 360`(> 300 LOC) · `estimatedFiles: 6`(> 5 파일). 사유는 두 가지이며 둘 다 회피 불가다.

- **e2e spec 이 optional 이 아니다** — [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts)(T-1985 · T-1989) 의 census drift guard 는 allowlist 가 **정확히 `[]`** 임을 단언한다. 따라서 e2e round-trip 이 없는 **신규 route 는 CI red 라 머지 자체가 불가능**하다. 즉 route 5 파일(service · controller + colocated spec 2 + api.md route 표 1 행)에 [test/e2e/difficulty-mappings.e2e-spec.ts](../../test/e2e/difficulty-mappings.e2e-spec.ts) 를 더한 **6 파일 · ~360 LOC 이 머지 가능한 최소 단위**다.
- **split 이 성립하지 않는다** — "route 먼저, e2e 나중" 으로 쪼개면 **첫 slice 가 그 자체로 CI red** 라 영원히 머지되지 않는다(§3 split 의 전제인 "각 slice 가 독립적으로 머지 가능" 이 깨진다).

그래서 split 대신 `sizeExempt: true` 로 진행한다. 초과분은 e2e spec 1 파일(~75 LOC)에 한정되며, 나머지 5 파일(service · controller + colocated spec 2 + [docs/architecture/api.md](../architecture/api.md) route 표 1 행)은 기존 산정(285 LOC)을 그대로 지킨다.

**진행 상태** — 본 task 는 이미 브랜치 `claude/T-1998-difficulty-slot-seed-endpoint` 에서 route 축(5 파일 · 295 LOC)이 구현돼 열린 PR 에 올라가 있고 reviewer APPROVE 도 받았다. 남은 red 는 census drift guard 뿐이므로 **다음 fire 는 그 브랜치를 이어받아 e2e describe 를 추가**한다 — 브랜치 · PR 재생성 금지.

**재사용 가능한 planner 제약(일반화)** — **신규 HTTP route 를 추가하는 task 는 처음부터 e2e spec 을 in-scope 로 잡는다.** census drift guard 가 e2e coverage 없는 route 의 머지를 금지하므로, e2e 를 뒤로 미룬 slice 는 구조적으로 머지 불가다.

새 ADR 불요 — ADR-0011 `49 행`(정확히 3 row) · `64 행`(seed 전제) 범위 안의 구현이고, 슬롯은 `llmProviderConfigId` **null** 로 생성돼 `62 행` fail-fast 계약도 그대로 유지된다(미지정 슬롯은 여전히 4xx 로 거부). DB schema · 인증 모델 · dependency 변경 **0**.

## Required Reading

- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `47~51 행`(§1 3 row 고정) · `60~64 행`(§3 fail-fast + 운영 함의 seed 문장)
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) `17~38 행` — `Difficulty` union · `DIFFICULTIES` · `isDifficulty`
- [src/llm/difficulty-mapping.repository.ts](../../src/llm/difficulty-mapping.repository.ts) `43~80 행` — `DifficultyMappingCreateInput` · `create` · `findMany`(P2002 raw propagate 계약 포함)
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `41 행` `getPrismaErrorCode` · `136~145 행` `findAllMappings` · `153~188 행` `assignProviderConfig`(P2025 → 4xx 변환 패턴)
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `58~105 행` — `@Controller` · ValidationPipe · `@Get()` / `@Patch(":difficulty")` 의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 패턴
- [src/llm/difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) `85~88 행` · `216~254 행` — repository mock 조립 패턴
- [src/llm/difficulty-mapping.controller.spec.ts](../../src/llm/difficulty-mapping.controller.spec.ts) `95 행` unit · `355 행` RBAC guard integration describe — 신규 route 를 어느 describe 에 붙일지 판단용

## Acceptance Criteria

- [ ] `DifficultyMappingService` 에 멱등 seed 메서드 1 개 신설 — `DIFFICULTIES` 를 single source 로 `findMany()` 결과와 대조해 **없는 슬롯만** `create({ difficulty, llmProviderConfigId: null })` 하고, `{ created, existing }`(둘 다 `Difficulty[]`, `DIFFICULTIES` 순서)를 반환한다. 이미 3 슬롯이 있으면 `create` 호출 **0 회**.
- [ ] 동시 seed race 로 `create` 가 P2002(`@@unique([difficulty])` 위반)를 던지면 그 슬롯을 **`existing` 으로 흡수**하고 계속 진행한다(멱등). P2002 외 error 와 `findMany` 실패는 **삼키지 않고 raw propagate**.
- [ ] `DifficultyMappingController` 에 `@Post("seed")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` route 신설(요청 body 없음). service 반환값 raw forward — controller 자체 분기 0.
- [ ] happy-path unit test — 신규 service 메서드: 슬롯 0 건 → `created` 3 개 · `create` 3 회 호출(인자 `llmProviderConfigId: null` 검증) / 신규 controller 핸들러: service 위임 1 회 + 반환 payload 그대로.
- [ ] error path unit test — `findMany` reject 전파 1+, `create` 가 P2002 **아닌** error(예: `code: "P2003"` · code 없는 generic `Error`) reject 시 전파 1+, controller 가 service rejection 을 swallow 하지 않음 1+.
- [ ] 분기별 test — (a) 슬롯 0 건(전량 생성) (b) 일부 존재(예: `easy` 만 존재 → `medium`/`hard` 만 생성) (c) 3 건 전부 존재(`create` 0 회) (d) P2002 흡수 후 나머지 슬롯 생성 계속 — 각 1+.
- [ ] negative case test — 미지원 난이도 row(예: `trivial`)가 DB 에 섞여 있어도 `DIFFICULTIES` 밖 값은 `created`/`existing` 어디에도 새지 않음 1+, 반환 배열 순서가 `DIFFICULTIES` 순서임 1+, RBAC — cookie 부재 401 · `User` actor 403 · `Admin`/`SuperAdmin` 200 을 기존 guard integration describe 패턴으로 각 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] unit spec 은 colocated 유지 — [src/llm/difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) 와 [src/llm/difficulty-mapping.controller.spec.ts](../../src/llm/difficulty-mapping.controller.spec.ts) 에만 추가하고 **새 unit spec 파일 신설 0**.
- [ ] **e2e round-trip 추가(필수 · in-scope)** — 기존 [test/e2e/difficulty-mappings.e2e-spec.ts](../../test/e2e/difficulty-mappings.e2e-spec.ts) 에 `POST /api/llm/difficulty-mappings/seed` describe 1 개 추가: (a) 빈 DB 에서 200 + `created` 3 슬롯 (b) 곧바로 재호출 시 200 + `existing` 3 · `created` 0(멱등) (c) 인증 쿠키 부재 401 / `User` actor 403 각 1+. 새 e2e 파일 신설 0(기존 파일에만 추가). `pnpm test:e2e` 통과.
- [ ] **route-e2e census drift guard 통과** — `pnpm test:smoke` 가 green 이고, [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) 의 allowlist 가 **`[]` 그대로**(신규 route 를 allowlist 에 추가하는 우회 금지 — 반드시 e2e coverage 로 해소).
- [ ] cap-bend 승인분 유지 — `estimatedDiff: 360` · `estimatedFiles: 6`(위 Scope note 사유, `sizeExempt: true`). 그 이상 커지면 negative case 를 줄이지 말고 **주석 · describe 문구를 압축**해 맞춘다. 대상 파일은 frontmatter `touchesFiles` 6 개로 한정.

## Out of Scope

- e2e spec **신규 파일** 신설 · 기존 e2e 의 다른 describe 수정(위 AC 가 요구하는 seed describe 1 개 추가 외 무접촉). census drift guard 의 allowlist 편집도 금지.
- CLI seed script(`scripts/seed-difficulty-slots.ts`) · [package.json](../../package.json) `seed:*` script 추가 · 부트스트랩 자동 seed 배선. 본 slice 는 HTTP route 를 소비처로 동반해 CLAUDE.md §3 소비처 동반 의무를 이미 충족하므로 CLI 는 불요 축이다.
- `prisma/schema.prisma` · migration · repository 시그니처 변경(기존 `create` · `findMany` 를 그대로 소비).
- 슬롯에 `llmProviderConfigId` 를 자동으로 채우는 동작(ADR-0011 `62 행` fail-fast 위반) · 기본 provider 축(T-1863~T-1865)과의 연동.
- [docs/requirements.md](../requirements.md) REQ-050 재판정 · [docs/PLAN.md](../PLAN.md) checkbox 변경(§3.1 구현 머지 후 1 회 별도 `direct` slice).
- `web/` UI 진입점 추가, `classifyNarrative` / `options.difficulty` 주입 축(REQ-050 의 다른 잔여) 은 무접촉.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

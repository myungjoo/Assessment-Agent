---
id: T-1330
title: export scope preview 2 종의 400 매핑을 실 HTTP 왕복 e2e 로 실증
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-31
independentStream: export-scope-input-4xx
dependsOn: [T-1328]
touchesFiles:
  - test/e2e/export-scope-preview.e2e-spec.ts
plannerNote: "T-1328 Follow-ups 의 미큐잉 e2e slice 회수 — filter unit 만 있고 HTTP 왕복 400 단언 0. e2e test-only x1.5 = 약 260 LOC / 1 파일"
---

# T-1330 — export scope preview 2 종의 400 매핑을 실 HTTP 왕복 e2e 로 실증

## Why

[T-1328](T-1328-export-scope-preview-input-4xx-filter.md) (PR #1206, main `a10ae22d`) 이 `ScopeInputExceptionFilter` 를 배선해 `POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection` 의 호출자 입력 결함을 500 → **400** 으로 매핑했지만, 검증은 **필터 unit spec + controller metadata 단언** 까지였다. T-1328 이 Follow-ups 에 "HTTP 왕복 400 단언은 별도 e2e slice 로 분리 (미큐잉)" 이라 스스로 남긴 항목을 본 task 가 회수한다.

필요성: `@UseFilters` 는 **핸들러 단위 metadata** 라 실제 요청 경로에서 guard(401/403) · `ValidationPipe`(400) · 필터가 어떤 순서로 맞물리는지는 metadata 단언만으로 증명되지 않는다. 특히 필터 분기 (1) `HttpException` passthrough 가 **401/403 을 400 으로 오분류하지 않는다** 는 계약은 실 guard stack 을 통과시켜야만 확증된다 (R-113 — unit 외 e2e 를 CI 에서 함께 수행). PLAN P5 잔여 3 항목은 사람-승인/credential 게이트이거나 대형 chain 이라 cap 내 1-task 로 부적합해 본 마감 항목을 선택했다.

pre-check (issue-still-relevant): `git grep -l "describe-scope\|preview-selection" -- test/` 결과가 `test/perf/export-running-read.perf-spec.ts` 1 건뿐이고 `test/e2e/` 에는 **0 hit** — 미착수 확인.

## Required Reading

- [src/export/scope-input-exception.filter.ts](../../src/export/scope-input-exception.filter.ts) — 매핑 4 분기의 정본. 특히 `SCOPE_INPUT_GUIDE = "Export scope 입력이 올바르지 않습니다"` 안내 문구 prefix 와 (1) `HttpException` passthrough / (2)(3) `RangeError`·`TypeError` → 400 / (4) unknown → 500.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) **215~229 행** (`describeScope`) · **255~270 행** (`previewSelection`) · **280~292 행** (`coerceDateRange`) — 두 핸들러의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@UseFilters(ScopeInputExceptionFilter)` + `@Roles("Admin")` 조합과, request body 의 ISO string → `Date` coerce 경로 (잘못된 날짜 문자열이 `Invalid Date` 가 되어 helper `TypeError` 를 유발하는 이유).
- [src/export/dto/create-export.dto.ts](../../src/export/dto/create-export.dto.ts) — `scope` 는 `@IsEnum(ExportScope)`, `dateRange` 는 `@IsOptional() @IsObject()`, `entitySelector` 는 `@IsOptional() @IsArray()`. 즉 **scope 조합 결함은 DTO 를 통과해 helper 까지 도달**하고, enum 이 아닌 `scope` 값은 `ValidationPipe` 400 (필터 passthrough) 이라는 경계 구분의 근거.
- [src/export/export-scope-description.ts](../../src/export/export-scope-description.ts) **112~124 행 주석** — 어떤 입력이 `RangeError` 이고 어떤 입력이 `TypeError` 인지의 정본 (range + dateRange 부재 / start>=end → RangeError, start·end Invalid Date → TypeError, partial + 빈 배열 / 허용 외 entity → RangeError).
- [test/e2e/export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) **1~120 행** — 본 spec 이 mirror 할 e2e 골격 (헤더 주석 구조 · `createAuthenticatedE2EApp` 로 Admin/User actor 2 종 seed · `buildAuthCookie` · `BASE` 상수 · 실 PostgreSQL 전제). 단 본 task 는 **훨씬 가벼운 골격** 이다 (아래 Out of Scope 참조).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) **60~140 행** — `createAuthenticatedE2EApp({ users })` 반환 shape (`app` / `prisma` / user 별 token) 과 `buildAuthCookie(token)` 형식.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` 시그니처 (본 spec 은 `afterAll` 1 회만 호출).

## Acceptance Criteria

신규 파일 `test/e2e/export-scope-preview.e2e-spec.ts` **1 개** 만 추가한다. 아래 test 는 모두 supertest 로 실 HTTP 요청을 보내고 **status + 응답 body** 를 단언한다.

- [ ] **happy-path (R-112 ①)** — Admin cookie 로 `POST /api/admin/export/describe-scope` 에 `{ scope: "FULL" }` → **200**, 응답 body 가 scope 설명 모델 (사람-친화 설명 필드) 을 담는다. 같은 방식으로 `POST /api/admin/export/preview-selection` 에 `{ scope: "FULL" }` → **200**, body 에 `selectedCount` · `excludedCount` · `perEntitySelected` 3 키가 존재한다 (빈 DB 라 count 는 0 이어도 무방 — 키 존재 + 타입만 단언).
- [ ] **error path — `RangeError` → 400 (R-112 ②)** — `describe-scope` 에 (a) `{ scope: "RANGE" }` (dateRange 누락) · (b) `{ scope: "RANGE", dateRange: { start: "2026-02-02T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z" } }` (start >= end) · (c) `{ scope: "PARTIAL", entitySelector: [] }` (빈 배열) · (d) `{ scope: "PARTIAL", entitySelector: ["Bogus"] }` (허용 외 entity) 4 종 → **각각 400**, `message` 가 `"Export scope 입력이 올바르지 않습니다"` 로 시작한다.
- [ ] **error path — `TypeError` → 400 (R-112 ②)** — `describe-scope` 에 `{ scope: "RANGE", dateRange: { start: "not-a-date", end: "2026-01-02T00:00:00.000Z" } }` (Invalid Date) → **400**, 동일 안내 prefix. 이 case 가 필터 분기 (3) 을 실 경로로 cover 한다.
- [ ] **branch cover — 두 endpoint 가 같은 필터를 공유함 (R-112 ③)** — `preview-selection` 에도 최소 2 종 (RangeError 계열 1 + TypeError 계열 1, 예: `{scope:"RANGE"}` 와 Invalid Date) 을 보내 **400 + 동일 안내 prefix** 를 단언한다. `describe-scope` 는 순수 합성 · `preview-selection` 은 실 DB read 라 경로가 다르므로 두 endpoint 각각 확인해야 한다.
- [ ] **negative — 인증/권한 결함이 400 으로 오분류되지 않음 (R-112 ④)** — (a) cookie 없이 `describe-scope` 호출 → **401** · (b) `User` role cookie 로 `describe-scope` 호출 → **403** · (c) `User` role cookie 로 `preview-selection` 호출 → **403**. 세 경우 모두 응답 status 가 400 이 **아님** 을 함께 단언해 필터 분기 (1) `HttpException` passthrough (재매핑 0) 를 실증한다.
- [ ] **negative — `ValidationPipe` 400 은 필터가 message 를 덮어쓰지 않음 (R-112 ④)** — Admin cookie 로 `{ scope: "BOGUS" }` 전송 → **400** 이되 `message` 가 `"Export scope 입력이 올바르지 않습니다"` prefix 를 **포함하지 않는다** (class-validator 의 원 message 보존 = passthrough 분기). 같은 취지로 정의되지 않은 키 (예: `{ scope: "FULL", bogusKey: 1 }`) → **400** (`forbidNonWhitelisted`) 도 1 case 추가.
- [ ] **negative — 경계값** — `{ scope: "RANGE", dateRange: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z" } }` (start == end, 빈 반열림 구간) → **400** (`RangeError` 경계). 이 case 로 `start < end` 경계가 배타임을 확인한다.
- [ ] **DB write 0 확인** — 두 endpoint 호출 후 `prisma.exportJob.count()` 가 **0** 임을 단언하는 test 1 개 (read-only 계약 — REQ-032 raw 미저장 정합).
- [ ] **spec 골격 규율** — `beforeAll` 에서 `createAuthenticatedE2EApp` 로 Admin / User actor 2 종을 spec 고유 email (예: `export-scope-admin@e2e.test` · `export-scope-user@e2e.test`) 로 seed, `afterAll` 에서 `truncateAll(prisma)` 1 회 + `app.close()`. **`afterEach` truncate 는 두지 않는다** — 본 spec 은 어떤 row 도 쓰지 않으며, JWT 검증은 DB lookup 이 없어 (`src/auth/jwt.strategy.ts` `validate` 는 payload claim 만 검사) actor re-seed 도 불요하다.
- [ ] **CI 통과** — `pnpm lint && pnpm build && pnpm test` 로컬 green (기존 429 suite 무회귀) + PR 의 GitHub Actions unit / smoke / **e2e** 3 종 green. 새 e2e 는 CI 의 실 PostgreSQL 에서 실행된다.
- [ ] **coverage (R-112 ⑤)** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 production code 0 LOC 변경이라 커버리지 수치가 내려가면 안 된다.
- [ ] **cap 확인** — `git diff --stat` 이 **1 파일** 이고 총 변경이 **300 LOC 이내**. 초과 우려 시 `preview-selection` 의 branch case 를 2 종으로 유지하고 주석을 줄인다 (test case 삭제보다 주석 축소 우선).
- [ ] **언어 규율 (§12)** — `describe` / `it` 문자열과 주석은 한국어, 식별자·경로·HTTP status·클래스명은 영어.

## Out of Scope

- **production code 수정 0** — `src/` 어느 파일도 건드리지 않는다. 필터·controller·helper 의 동작은 T-1328 이 확정한 그대로다. (건드리면 본 task 의 성격이 바뀌므로 별도 task 로 split.)
- **unknown → 500 분기의 e2e 실증 0** — 필터 분기 (4) 는 실 요청으로 인위 유발하려면 service mock override 가 필요해 e2e 성격에 맞지 않는다. 이미 `scope-input-exception.filter.spec.ts` unit 이 cover 한다.
- **`GET /api/admin/export/:id/download` 의 손상 job row `RangeError` status 변경·검증 0** — [T-1291](T-1291-export-download-scope-select-wire.md) 이월 항목이며 **서버 상태** 결함이라 판단 대상이 다르다.
- **`export-download.e2e-spec.ts` 수정 0** — 신규 파일에만 쓴다 (590 행 기존 spec 을 더 키우지 않는다).
- **`docs/architecture/api.md` 재수정 0** — [T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) 가 이미 400 으로 정합했다. 본 task 에서 문서를 함께 고치면 §3.1 rule 3 (direct + pr 혼합) 위반.
- **scope preview 응답 shape 확장·필드 추가 0**, **다른 export endpoint 의 e2e 신설 0** — 발견 시 Follow-ups 에만 적는다.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, T-1328 이 박제한 계약의 실증일 뿐)

## Follow-ups

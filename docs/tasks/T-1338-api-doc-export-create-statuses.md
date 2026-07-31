---
id: T-1338
title: api.md § 5 124 행에 POST /api/admin/export 의 성공·실패 status 실측 보강
phase: P5
status: DONE
completedAt: 2026-07-31T02:45:00Z
resultCommit: 60206fa6
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1337]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1337 Out of Scope 가 이월한 § 5 export slice — 124 행은 status 0 + 문장 미완결로 UC-07 블록 유일 공백"
---

# T-1338 — api.md § 5 124 행에 `POST /api/admin/export` 의 성공·실패 status 실측 보강

## Why

[T-1337](T-1337-api-doc-import-create-failure-statuses.md) 이 § 5 125 행 (`POST /api/admin/import`) 에 성공 201 + 실패 5 종을 채우면서, Out of Scope 에 "**§ 5 의 다른 UC-07 행** (`/api/admin/export` · `/api/admin/backup` · …) 의 status 서술 보강 — 본 task 는 125 행 하나만 다룬다" 로 이월 사유를 명시했다. 그 이월분 중 가장 큰 공백이 **124 행** 이다 — UC-07 블록 (123~140 행) 의 다른 모든 행이 성공·실패 status 를 갖춘 지금, 124 행만 `평가 자료 export (raw 미포함, REQ-032·REQ-030) — \`scope\`(body, \`CreateExportDto\`)` 로 **status 를 하나도 적지 않고 문장도 조사에서 끊긴** 상태다. import 쌍 (125 행) 과 정확히 대칭인 create 경로인데 설명 밀도만 극단적으로 낮다.

핵심 차별점은 **scope 입력 오류의 400 매핑 경로** 다 — 같은 `CreateExportDto` 를 받는 `describe-scope` (135 행) · `preview-selection` (136 행) 은 helper 가 던진 `RangeError`/`TypeError` 를 `ScopeInputExceptionFilter` 가 400 으로 **매핑** 하지만, create 는 그 filter 를 **부착하지 않고** service 가 `validateExportScope` 의 verdict 를 보고 직접 `BadRequestException` 을 던진다. 같은 입력 결함이 서로 다른 메커니즘으로 같은 400 에 도달한다는 사실이 세 행을 나란히 읽는 독자에게 가장 중요한 정보다.

## Required Reading

- `docs/architecture/api.md` **124 행** — 수정 대상 단 한 행. 기존 문구 (`평가 자료 export (raw 미포함, REQ-032·REQ-030) — \`scope\`(body, \`CreateExportDto\`)`) 와 UC-07 §5 링크·`Admin+` 컬럼은 **보존** 하고 status 서술을 **뒤에 이어 붙인다** (기존 문장 삭제 0 — 끊긴 조사 뒤를 자연스럽게 잇는 정도의 최소 연결은 허용).
- `docs/architecture/api.md` **125 행** — import create row (T-1337 이 방금 채운 정본). 성공/실패 status 표기의 **문체·순서 정본** ("응답 **201** — … 실패 400 (…) / 401 (미인증, `JwtAuthGuard`) / 403 (비-Admin actor, `RolesGuard` + `@Roles("Admin")`) …"). 124 행의 새 문장을 이 형식에 맞춘다. **읽기 전용 — 125 행은 한 글자도 수정 금지.**
- `docs/architecture/api.md` **135~136 행** (`POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection`) — 두 행이 이미 박제한 `ScopeInputExceptionFilter` 400 매핑 서술. 124 행에 적을 "create 는 filter 미부착 · verdict 기반 400" 대비 서술의 근거. **읽기 전용 — 두 행 수정 금지.**
- `docs/architecture/api.md` **166 행 (§ 6 `201 Created`)** — "**`@Post` 기본값 201 인 4 종** … POST `/api/admin/export`" 이 이미 박제돼 있다. 124 행 성공 status 서술이 이 행과 **어긋나지 않아야** 한다. **읽기 전용 — § 6 표는 본 task 밖** ([T-1334](T-1334-api-doc-status-code-table-realign.md)·[T-1335](T-1335-api-doc-status-code-202-204-rows.md)·[T-1336](T-1336-api-doc-status-code-413-row.md) 이 정합 완료).
- `src/export/export.controller.ts` **143~150 행** (`@Controller("api/admin/export")` + controller-scope `@UsePipes(ValidationPipe{ whitelist, forbidNonWhitelisted, transform })`) · **154~174 행** (`create` 핸들러 주석 + `@Post()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@CurrentUser("sub")` → `requestedById` 결합 + `service.createJob` forward). `@HttpCode` **미부착** 과 `@UseFilters` **미부착** 두 사실이 각각 성공 201·verdict 기반 400 의 근거다. **읽기 전용.**
- `src/export/export-job.service.ts` **226~255 행** (`createJob`) — 400 분기 2 계열: (a) `requestedById` 공백 → `BadRequestException`, (b) `validateExportScope(this.toScopePayload(input))` verdict `valid=false` → `buildExportScopeRejection` 의 headline + detailLines 를 메시지로 하는 `BadRequestException` (raw verdict 객체·stack 미직렬화, REQ-032). 그 뒤는 `prisma.exportJob.create` 뿐 — **409 분기도 404 분기도 없다.** **읽기 전용.**
- `src/export/export-job.service.ts` **562~573 행** (`coerceDateRange`) · **588~593 행** (`mapNotFound`) — coerce 는 throw 하지 않고 Invalid Date 를 helper 의 field error 로 흘려 400 이 되며, P2025 → 404 변환은 `mark*`/`findJob` 전용이라 create 경로와 무관하다. create 의 Prisma error (예: `requestedById` 가 실재하지 않는 User 를 가리킬 때의 **P2003 FK 위반**) 는 매핑 대상이 아니라 raw 전파 → **500**. **읽기 전용.**
- `src/export/dto/create-export.dto.ts` — `@IsEnum(ExportScope)` scope 필수 · `dateRange` `@IsOptional`+`@IsObject` · `entitySelector` `@IsOptional`+`@IsArray`. DTO 위반 + `forbidNonWhitelisted` extra 키가 boundary 400 의 셋째 계열이다. **읽기 전용.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 숫자를 재확인한다 — task 본문을 그대로 믿지 말 것. 불일치 시 **실측이 정본**):
  - `git grep -n "@HttpCode\|@UseFilters" -- src/export/export.controller.ts` → create 핸들러 (`@Post()` 바로 위) 에는 **둘 다 없음** = 성공 201 + filter 미개입.
  - `git grep -n "BadRequestException" -- src/export/export-job.service.ts` → `createJob` 안 **2 곳** (requestedById 공백 · scope verdict).
  - `git grep -n "ConflictException\|NotFoundException" -- src/export/export-job.service.ts` → `createJob` 범위 (226~255 행) 밖에서만 잡힌다 = create 에 409·404 분기 0.
  - `git grep -c "실패" -- docs/architecture/api.md` → 본 task 전후 값을 비교해 124 행에 1 건이 **추가** 됐음을 확인 (감소·타 행 변동 0).

## Acceptance Criteria

- [ ] **124 행 끝** (`\`scope\`(body, \`CreateExportDto\`)` 뒤) 에 성공·실패 status 문장을 이어 붙인다. 성공은 **201** 이며 근거는 "`@HttpCode` 미부착 = `@Post` NestJS 기본값이자 의도적 default, 실 `ExportJob` row (`status=PENDING`) 를 생성해 그대로 반환하므로 201 이 사실과 맞다 (DB write 0 인 `describe-scope`·`preview-selection` 은 `@HttpCode(HttpStatus.OK)` 로 200 — T-1331)" 취지로 1 구절 박제한다.
- [ ] 실패 status 를 **`400 / 401 / 403` 3 종** 으로 열거하고 각각 발화 조건을 실측 근거로 1 구절씩 적는다:
  - **400** — 3 계열: (a) `CreateExportDto` 위반 (`scope` 가 `ExportScope` enum 밖 · `dateRange` 비-객체 · `entitySelector` 비-배열 · `forbidNonWhitelisted` extra 키 — controller-scope `ValidationPipe` 가 boundary 에서 거부), (b) `requestedById` 공백 (service 자체 분기), (c) `validateExportScope` verdict `valid=false` (RANGE 인데 `dateRange` 누락 · `start>=end` · Invalid Date · PARTIAL 인데 허용 외 entity) → `buildExportScopeRejection` 의 headline + detailLines 메시지.
  - **401** — 미인증 (`JwtAuthGuard`). **403** — 비-Admin actor (`RolesGuard` + `@Roles("Admin")`, Admin/SuperAdmin 통과). 발화자는 `@CurrentUser("sub")` 에서 취해 `requestedById` 로 결합하므로 **client 가 임의 발화자를 위장할 수 없다** (REQ-045) 는 사실을 1 구절 병기한다.
- [ ] **409·404 부재를 명시** — create 는 job row 생성만 하고 `@unique` 충돌 대상도, `:id` 조회도 없어 **409 분기 0 · 404 분기 0** 이다 (`ConflictException`/`NotFoundException` 은 `mark*`/`findJob` 등 다른 메서드 소관). import create (125 행) 가 race guard + Prisma 복원 매핑으로 **409 를 갖는 것과의 비대칭** 을 1 구절로 박제한다.
- [ ] **scope 오류 400 의 매핑 경로 차이를 1 구절로 명시** — create 는 `ScopeInputExceptionFilter` 를 **부착하지 않고** service 가 verdict 를 보고 `BadRequestException` 을 직접 던지는 반면, 같은 `CreateExportDto` 를 받는 `describe-scope` (135 행) · `preview-selection` (136 행) 은 helper 가 던진 `RangeError`/`TypeError` 를 그 filter 가 400 으로 매핑한다. **결과 status 는 셋 다 400 이나 도달 메커니즘이 다르다.**
- [ ] **매핑 표 밖 error 는 500** 임을 1 구절로 박제한다 — `createJob` 은 Prisma error 를 변환하지 않으므로 (`mapNotFound` 는 `mark*`/`findJob` 전용) `requestedById` 가 실재하지 않는 User 를 가리킬 때의 **P2003 FK 위반** · 연결 실패 `P1001` 등은 raw 전파되어 500 으로 표면화된다 (무차별 흡수 0).
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본 task 본문의 서술과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 실측을 따르고 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 **전** `awk 'NR==124 {print gsub(/\|/,"|")}' docs/architecture/api.md` 값을 먼저 찍어 두고, 편집 **후** 같은 명령이 **동일한 값** 을 내는지 비교한다 (§ 5 표 컬럼 수 유지 — 행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지). `docs/architecture/api.md` 의 총 행 수도 편집 전후 **동일** 하다.
- [ ] 검증 grep — `git grep -n "201" -- docs/architecture/api.md | grep ":124:"` 가 **1 hit** 이상, `git grep -n "CreateExportDto" -- docs/architecture/api.md | grep ":124:"` 가 여전히 **1 hit** (기존 서술 보존), 그리고 `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이며 `git diff` 의 변경 행이 **124 단 하나** 다 (125·135·136·166 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1334](T-1334-api-doc-status-code-table-realign.md)·T-1335·T-1336·T-1337 선례) — 대신 위 grep 3 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`src/` 코드 변경 전면 금지** — 특히 (a) create 핸들러에 `@HttpCode(201)` 명시 부착, (b) create 에 `ScopeInputExceptionFilter` 부착해 매핑 경로를 describe-scope 와 통일, (c) `createJob` 의 Prisma error 매핑 확장 (P2003 → 400). 동작 무변경이라도 별도 `pr` task 소관 (§3.1 rule 3). 특히 (b) 는 실 동작 변경 가능성이 있어 ADR 검토 대상이다.
- **125 행 (import create) · 135~136 행 (describe-scope · preview-selection) 재수정** — [T-1328](T-1328-export-scope-preview-input-4xx-filter.md)·[T-1329](T-1329-api-doc-scope-preview-4xx-sync.md)·T-1337 이 방금 정합을 끝냈다. 대칭을 맞추려고 그 행들의 문구를 손대지 않는다 (본 task 는 124 행 **단독** 편집).
- **§ 6 표 (163~176 행) 수정** — 124 행 서술이 § 6 과 어긋나면 **124 행 쪽을 § 6 에 맞춘다** (§ 6 을 고치지 않는다).
- **§ 6 409 행 "일부 mutation — 구체 분기는 P3" 의 stale 전수 감사** — T-1337 이 이미 이월한 별도 slice. 발견 사항은 Follow-ups 에 기록만 한다.
- **§ 5 의 나머지 UC-07 행** (`POST /api/admin/backup` · `POST /api/admin/restore` 등) 의 status 서술 보강 — 본 task 는 124 행 하나만 다룬다.
- **`docs/use-cases/UC-07-export-import.md`** · `docs/architecture/*` 의 다른 문서 동기화 — 손대지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 amend — architect·tester 불요)

## Follow-ups

- **본 task 정의서의 행 번호 drift (실측 정정)** — Required Reading·Acceptance Criteria 가 `describe-scope`/`preview-selection` 을 **135~136 행** 으로 적었으나 실측은 **132~133 행** 이다 (135 행 = `GET /api/admin/export/:id`, 136 행 = `POST /api/admin/backup`). executor 는 실측값 132~133 을 정본으로 삼아 본문을 작성했다. § 6 `201 Created` 의 166 행 표기는 정확했다. 이후 planner 는 task 정의서에 행 번호를 적을 때 반드시 파일을 열어 실측한다.

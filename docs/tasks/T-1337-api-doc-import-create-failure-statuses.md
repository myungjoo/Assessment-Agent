---
id: T-1337
title: api.md § 5 125 행에 POST /api/admin/import 의 성공·실패 status 실측 보강
phase: P5
status: DONE
completedAt: 2026-07-31T01:40:00Z
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 16
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1336]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1336 Out of Scope 가 명시 이월한 § 5 slice — 125 행만 실패 status 0 이라 126 행(preview)과 비대칭"
---

# T-1337 — api.md § 5 125 행에 `POST /api/admin/import` 의 성공·실패 status 실측 보강

## Why

[T-1336](T-1336-api-doc-status-code-413-row.md) 이 § 6 표에 413 행을 신설하면서 Out of Scope 에 "**§ 5 125 행 (`POST /api/admin/import`) 의 실패 status 서술 보강** — 이 행은 현재 실패 status 를 하나도 적지 않아 preview (126 행) 와 비대칭이지만, 그 보강은 § 5 소관의 별도 slice 다" 라고 이월 사유를 명시했다. 실제로 [api.md](../architecture/api.md) 125 행은 응답 body 조립 (`restoreSummary` additive envelope) 만 서술하고 **성공 status 도 실패 status 도 한 개도 적지 않는다** — 바로 다음 126 행 (dry-run preview) 이 "응답 200 … 실패 400 / 401 / 403 / 413" 을 갖춘 것과 대비되며, 정작 **실 복원을 수행해 실패 표면이 더 넓은 쪽** (job row 생성 · `$transaction` 개시 · Prisma error 매핑) 이 비어 있는 역전이다. 본 task 는 125 행에 실측 기반 성공 201 + 실패 `400 / 401 / 403 / 409 / 413` 을 채워 두 행을 대칭으로 만든다. § 6 표는 [T-1334](T-1334-api-doc-status-code-table-realign.md)·[T-1335](T-1335-api-doc-status-code-202-204-rows.md)·T-1336 이 이미 정합했으므로 본 task 는 **§ 5 단 한 행** 만 다룬다.

핵심 차별점은 **409** 다 — preview 에는 없고 create 에만 있는 status 이며 (job 생성 race guard + 복원 중 Prisma 매핑), 이 비대칭이 두 행을 나란히 읽는 독자에게 가장 중요한 정보다.

## Required Reading

- `docs/architecture/api.md` **125 행** — 수정 대상 단 한 행 (`| POST | `/api/admin/import` | UC-07 §5 | … T-1296 박제 (PR #1187). | Admin+ |`). 기존 `restoreSummary` 서술과 `T-1296 박제 (PR #1187)` 출처 표기는 **보존** 하고 status 서술을 **뒤에 덧붙인다** (문장 삭제 0).
- `docs/architecture/api.md` **126 행** — preview row. 실패 status 표기의 **문체·순서 정본** ("실패 400 (…) / 401 (미인증) / 403 (비-Admin) / 413 (크기 상한 초과, `MulterExceptionFilter` 매핑)"). 125 행의 새 문장을 이 형식에 맞춘다. **읽기 전용 — 126 행은 한 글자도 수정 금지.**
- `docs/architecture/api.md` **166 행 (§ 6 `201 Created`)** · **174 행 (§ 6 `413`)** — 125 행에 적을 성공 201 (`@Post` 기본값 4 종 중 하나) 과 413 (업로드 2 종) 서술이 § 6 표와 **어긋나지 않는지** 대조용. **읽기 전용 — § 6 표는 본 task 밖 (T-1334/T-1335/T-1336 이 방금 정합).**
- `src/import/import.controller.ts` **129 행** (`MISSING_DUMP_FILE_MESSAGE`) · **233~250 행** (`@Post()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + `@UseFilters(MulterExceptionFilter)` + `FileInterceptor` limits, 그리고 `file === undefined` → `BadRequestException`) · **251~262 행** (`createJob` 이 던지는 `ConflictException`/`BadRequestException` 은 raw propagate, runJob 미도달). `@HttpCode` 가 **없다** 는 사실이 성공 201 의 근거다. **읽기 전용.**
- `src/import/import-job.service.ts` **73~96 행** — `createJob` 의 invariant: `requestedById` 공백 · `mode` 가 `ImportMode` enum 밖이면 400, `evaluateImportRaceGuard` verdict 가 blocking (이미 `RUNNING` 인 import job 존재) 이면 **`ConflictException` (409)**. **읽기 전용.**
- `src/import/import-restore-error.ts` **20~26 행 (매핑 표 주석)** · **78~99 행 (`toImportRestoreHttpException`)** — 복원 실행 중 Prisma error 매핑: **P2002 → 409** · **P2025 → 409** · **P2003 → 400** · **그 외 code (P2028 · P1001 등) 와 code 없는 error 는 `undefined` 로 떨어져 원본 raw 전파 → 500**. **읽기 전용.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 숫자를 재확인한다 — task 본문을 그대로 믿지 말 것. 불일치 시 **실측이 정본**):
  - `git grep -n "@HttpCode" -- src/import/import.controller.ts` → **preview 핸들러 1 hit 뿐** (create 에는 없음 = `@Post` 기본값 201).
  - `git grep -n "ConflictException" -- src/import/import-job.service.ts src/import/import-restore-error.ts` → 두 파일에서 각각 throw / return 지점이 잡힌다 (409 근거 2 계열).
  - `git grep -n "P2003" -- src/import/import-restore-error.ts` → **400** 매핑 1 곳.
  - `git grep -c "실패" -- docs/architecture/api.md` → 본 task 전후 값을 비교해 125 행에 1 건이 **추가** 됐음을 확인 (감소·타 행 변동 0).

## Acceptance Criteria

- [ ] **125 행 끝의 `T-1296 박제 (PR #1187).` 앞** 에 성공·실패 status 문장을 삽입한다. 성공은 **201** 이며 근거는 "`@HttpCode` 미부착 = `@Post` NestJS 기본값이자 의도적 default, 실 `ImportJob` row 를 생성하므로 201 이 사실과 맞다 (dry-run 인 preview 는 200 — T-1332)" 취지로 1 구절 박제한다.
- [ ] 실패 status 를 **`400 / 401 / 403 / 409 / 413` 5 종** 으로 열거하고 각각 발화 조건을 실측 근거로 1 구절씩 적는다:
  - **400** — 파일 미첨부 (`MISSING_DUMP_FILE_MESSAGE`, controller 자체 분기) · `CreateImportDto` 위반 (`mode` 가 `ImportMode` enum 밖 · `forbidNonWhitelisted` extra 키) · 복원 중 **P2003 FK 위반** (`toImportRestoreHttpException` 매핑).
  - **401** — 미인증 (`JwtAuthGuard`). **403** — 비-Admin actor (`RolesGuard` + `@Roles("Admin")`). guard 가 `FileInterceptor` 보다 먼저 실행되므로 **파일 파싱 전에 차단** 된다는 사실을 1 구절로 병기 (controller 주석이 정본).
  - **409** — (a) `createJob` 의 진행 중-작업 race guard (`evaluateImportRaceGuard` verdict blocking = 이미 `RUNNING` 인 import job 존재, UC-07 §4 precondition 4) 와 (b) 복원 실행 중 **P2002 (dump 중복) · P2025 (복원 도중 대상 변경)** 두 계열.
  - **413** — 업로드 파일이 `MAX_IMPORT_FILE_SIZE_BYTES` (50 MiB) 초과, `MulterExceptionFilter` 매핑 (§ 6 174 행과 동일 근거).
- [ ] **preview 와의 비대칭을 1 구절로 명시** — 409 는 **create 에만** 있다 (preview 는 job row 미생성 · `$transaction` 미개시라 race guard 도 Prisma 복원 매핑도 경유하지 않는다). 이 문장이 125·126 두 행을 나란히 읽을 때의 핵심 차이다.
- [ ] **매핑 표 밖 error 는 500** 임을 1 구절로 박제한다 — `toImportRestoreHttpException` 이 P2002/P2003/P2025 외에는 `undefined` 를 돌려주어 원본 error 가 raw 전파되고 (무차별 흡수 금지), 그 결과 `P2028` transaction timeout · `P1001` 연결 실패 등은 500 으로 표면화된다.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본 task 본문의 서술과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 실측을 따르고 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — `awk 'NR==125 {print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **5** (§ 5 표는 5 컬럼 = 파이프 6 개인지 실측 후 그 값과 동일하게 유지 — 편집 전 값을 먼저 찍어 두고 편집 후 같은 값인지 비교한다). 행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지이며, `docs/architecture/api.md` 의 총 행 수가 편집 전후 **동일** 하다.
- [ ] 검증 grep — `git grep -n "409" -- docs/architecture/api.md | grep ":125:"` 가 **1 hit**, `git grep -n "T-1296 박제 (PR #1187)" -- docs/architecture/api.md` 가 여전히 **1 hit** (기존 출처 표기 보존), 126 행은 `git diff` 에 **등장하지 않는다** (변경 행이 125 단 하나).
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1333](T-1333-api-doc-import-preview-200-sync.md)·[T-1334](T-1334-api-doc-status-code-table-realign.md)·T-1335·T-1336 선례) — 대신 위 grep 3 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`src/` 코드 변경 전면 금지** — 특히 (a) create 핸들러에 `@HttpCode(201)` 명시 부착, (b) `toImportRestoreHttpException` 매핑 표 확장 (P2028 · P1001 추가), (c) race guard 문구 조정. 동작 무변경이라도 별도 `pr` task 소관 (§3.1 rule 3).
- **126 행 (preview) 재수정** — [T-1332](T-1332-import-preview-httpcode-200.md)·T-1333 이 방금 200 정합을 끝냈다. 대칭을 맞추려고 126 행 문구를 손대지 않는다 (본 task 는 125 행 **단독** 편집).
- **§ 6 표 (163~176 행) 수정** — 200/201 (T-1334) · 202/204 (T-1335) · 413 (T-1336) 이 순차 정합을 끝낸 상태다. 125 행 서술이 § 6 과 어긋나면 **125 행 쪽을 § 6 에 맞춘다** (§ 6 을 고치지 않는다).
- **§ 6 409 행 "일부 mutation — 구체 분기는 P3" 의 stale 감사** — 실측상 409 는 import 외에도 여러 service (`evaluation-result-persist` · `summary-persist` · `llm-provider-config` 등) 에 분포하며 그 전수 정합은 별도 slice 다. 발견 사항은 Follow-ups 에 기록만 한다.
- **§ 5 의 다른 UC-07 행** (`/api/admin/export` · `/api/admin/backup` · `/api/admin/restore` · `GET /api/admin/import/:id` 등) 의 status 서술 보강 — 본 task 는 125 행 하나만 다룬다.
- **`docs/use-cases/UC-07-export-import.md`** 의 status 서술 동기화 — 다른 문서는 손대지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 amend — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result (2026-07-31 완료)

- direct-mode main direct commit `dd8d1e82` — [api.md](../architecture/api.md) 125 행 단 1 행 amend (+1/-1, 1 파일).
- 채운 내용: 성공 **201** (`@HttpCode` 미부착 = `@Post` 기본값, 실 `ImportJob` row 생성) + 실패 **400 / 401 / 403 / 409 / 413** 5 종 + **409 가 create 전용** 이라는 비대칭 1 구절 + 매핑 표 밖 error raw 전파 → **500**. 기존 `restoreSummary` 응답 조립 서술과 `T-1296 박제 (PR #1187)` 출처 표기는 문장 삭제 0 으로 보존.
- 126 행 (preview) · § 6 표 (163~176 행) · `src/` · `test/` · `web/` 무수정 — Out of Scope 준수 (`git status` 1 파일).
- doc-only 라 R-110 tester 면제 — 실측 4 종 재확인 (`@HttpCode` grep 은 주석 2 + decorator 1 = 3 hit 이나 create 미부착 사실 동일, `ConflictException` 2 계열 · P2003 → 400 · "실패" 19→20) + 표 구조 self-check + 검증 grep 3 종 (409@125 1 hit · `T-1296 박제` 1 hit · 126 행 diff 미등장) 으로 대체.
- Follow-ups: 없음 (§ 5 의 남은 UC-07 행 중 `POST /api/admin/export` 124 행은 [T-1338](T-1338-api-doc-export-create-statuses.md) 로 큐잉됨).

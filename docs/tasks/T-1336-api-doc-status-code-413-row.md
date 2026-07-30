---
id: T-1336
title: api.md § 6 표에 413 Payload Too Large row 신설 (import 업로드 상한 실측 2 종)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-30
independentStream: api-status-code-table
dependsOn: [T-1335]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1335 가 닫은 202 gap 과 동형 — 실측 413(MulterExceptionFilter 2 종)이 § 6 표에 row 부재, § 5 126 행만 언급"
---

# T-1336 — api.md § 6 표에 413 Payload Too Large row 신설 (import 업로드 상한 실측 2 종)

## Why

[T-1335](T-1335-api-doc-status-code-202-204-rows.md) 가 [api.md](../architecture/api.md) § 6 표준 status code 표의 **성공 (2xx) 계열** 을 실측과 맞추면서, 표에 아예 없던 `202 Accepted` row 를 신설해 "§ 5 개별 endpoint 행은 그 status 를 쓰는데 § 6 표만 모른다" 는 유형의 gap 을 처음 닫았다. **정확히 같은 gap 이 실패 계열에 1 건 더 남아 있다** — `413 Payload Too Large` 다.

- 실측상 `PayloadTooLargeException` 을 내는 경로가 코드에 존재한다 — `src/import/multer-exception.filter.ts` 의 매핑 분기 (2) 가 `MulterError(LIMIT_FILE_SIZE)` 를 413 으로 매핑하고, 이 filter 는 import 업로드 endpoint **2 종** (`POST /api/admin/import` · `POST /api/admin/import/preview`) 에 `@UseFilters` 로 붙어 있다.
- 그런데 § 6 표 (163~174 행) 의 status 행 10 개 중 413 은 **한 줄도 없다**. 반면 § 5 endpoint 표 **126 행** (import preview) 은 실패 status 를 "400 / 401 / 403 / **413** (크기 상한 초과, `MulterExceptionFilter` 매핑)" 으로 이미 적고 있어, **"모든 endpoint 가 따르는 기본 status code 정책" 을 자처하는 § 6 표만 읽는 독자에게는 413 이 존재하지 않는 status** 로 보인다 — T-1335 가 202 에서 해소한 것과 같은 방향의 문서 내부 불일치다.
- 413 은 [ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Decision 3 이 박제한 **`limits.fileSize` 상한 강제 (DoS 표면 차단)** 의 사용자-가시 계약이라 표에서 누락되면 안 되는 종류의 status 다.

[T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) · [T-1333](T-1333-api-doc-import-preview-200-sync.md) · [T-1334](T-1334-api-doc-status-code-table-realign.md) · T-1335 와 동일한 doc-only 계열이며, 판정 기준은 추론이 아니라 `src/` 실측이다.

## Required Reading

- `docs/architecture/api.md` **163~176 행** — § 6 status code 표 전체 (헤더 2 행 + status 10 행) 와 표 아래 176 행 주석. 수정은 **173 행 (409 Conflict) 과 174 행 (500) 사이에 413 행 1 개 삽입** 단 한 곳이다. 각 행의 3 컬럼 구조 (`status` / `발화 조건` / `적용 범위`) 를 유지한다. **165~174 기존 행은 한 글자도 수정 금지** (200/201 은 T-1334, 202/204 는 T-1335 가 방금 정합한 상태다).
- `docs/architecture/api.md` **126 행** — `POST /api/admin/import/preview` row. 실패 status 서술 "400 (파일 미첨부 · 손상 dump · DTO 위반) / 401 (미인증) / 403 (비-Admin) / 413 (크기 상한 초과, `MulterExceptionFilter` 매핑)" 이 이미 박제돼 있다. 새 413 행의 표현·근거를 이 문장과 **어긋나지 않게** 맞춘다. **행 자체는 수정 금지 (읽기 전용).**
- `src/import/multer-exception.filter.ts` **1~19 행 (헤더 주석) · 56~71 행 (`toHttpException`)** — 4 분기 매핑 규칙의 정본. 특히 **(1) `HttpException` passthrough** (Nest 가 `FileInterceptor` 안에서 `LIMIT_FILE_SIZE` 를 이미 `PayloadTooLargeException` 으로 선변환한 경우 포함) 와 **(2) raw `MulterError(LIMIT_FILE_SIZE)` → 413 방어적 매핑** 의 관계를 표 행의 `발화 조건` 에 정확히 옮긴다. **읽기 전용 — 본 task 는 `src/` 를 1 줄도 고치지 않는다.**
- `src/import/import.controller.ts` **123 행** (`MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024`) · **233~241 행** (create: `@Post()` + `@UseFilters(MulterExceptionFilter)` + `FileInterceptor` limits) · **299~313 행** (preview: `@Post("preview")` + `@HttpCode(HttpStatus.OK)` + 같은 filter/limits, 303 행 주석이 "`MulterExceptionFilter`(413) 는 `@HttpCode` 보다 우선한다" 를 박제). **읽기 전용.**
- 실측 명령 3 종 (executor 가 직접 실행해 목록을 확정한다 — 본 task 본문의 숫자를 그대로 믿지 말고 재실측 후 일치 확인):
  - `git grep -n "@UseFilters(MulterExceptionFilter)" -- "src/**/*.controller.ts"` → **2 hit** (`src/import/import.controller.ts` 의 create · preview 핸들러).
  - `git grep -n "PayloadTooLargeException" -- "src/**/*.ts"` → 비-spec 파일 기준 `src/import/multer-exception.filter.ts` **단 1 곳** (import 업로드 외에 413 을 내는 경로가 없다는 근거).
  - `git grep -n "413" -- docs/architecture/api.md` → 현재 **126 행 1 hit** (§ 5 preview row). 본 task 후 § 6 표 행이 더해져 2 hit 이 된다.

## Acceptance Criteria

- [ ] **173 행 (409 Conflict) 과 174 행 (500 Internal Server Error) 사이에 `413 Payload Too Large` row 1 개를 삽입**한다. `발화 조건` 컬럼은 "multipart 업로드 파일이 `limits.fileSize` 상한 (`MAX_IMPORT_FILE_SIZE_BYTES` = 50 MiB) 을 초과 — `MulterError(LIMIT_FILE_SIZE)` 를 `MulterExceptionFilter` 가 `PayloadTooLargeException` 으로 매핑" 취지로, `적용 범위` 컬럼은 실측 **2 종** (`POST /api/admin/import` · `POST /api/admin/import/preview`) 을 나열하고 **파일 업로드를 받는 endpoint 에만 해당** 한다는 한정을 명시한다. 근거 출처로 [ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Decision 3 (상한 강제 · DoS 표면 차단) 를 1 구절로 병기한다.
- [ ] 새 행에 **preview 의 성공 status 200 과 413 의 우선순위** 를 1 구절로 박제한다 — `MulterExceptionFilter` 가 `@HttpCode(HttpStatus.OK)` 보다 우선하므로 preview 도 상한 초과 시 200 이 아니라 413 을 돌려준다 (`src/import/import.controller.ts:303` 주석이 정본).
- [ ] 실측 재확인 — executor 가 Required Reading 의 실측 명령 3 종을 실제로 실행하고, 본 task 본문의 **2 hit / 1 곳 / 1 hit** 과 결과가 일치함을 확인한 뒤 표에 옮긴다. 불일치 시 **실측이 정본** 이며 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] status 행 정렬 유지 — 표의 status 행이 **숫자 오름차순** (200 → 201 → 202 → 204 → 400 → 401 → 403 → 404 → 409 → **413** → 500) 이 되도록 413 을 409 와 500 사이에 넣는다.
- [ ] 표 구조 무손상 — `awk 'NR>=163 && NR<=175 {n=gsub(/\|/,"|"); print NR": "n}' docs/architecture/api.md` 결과가 **모든 행 파이프 4 개** 이고, `grep -cE '^\| \*\*[0-9]{3} ' docs/architecture/api.md` 가 **11** (기존 10 + 신설 1) 이다. 행 병합·줄바꿈 삽입·컬럼 추가 금지.
- [ ] 검증 grep — `git grep -n "413 Payload Too Large" -- docs/architecture/api.md` 가 **1 hit** (신설 § 6 행) 이고, `git grep -c "413" -- docs/architecture/api.md` 가 **2** (§ 5 126 행 + § 6 신설 행) 다. 126 행의 기존 문장은 그대로 남아 있어야 한다.
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1334](T-1334-api-doc-status-code-table-realign.md) · T-1335 선례) — 대신 위 grep 2 종 + 표 구조/정렬 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이므로 실행 불요.

## Out of Scope

- **`src/` 코드 변경 전면 금지** — 특히 (a) `MAX_IMPORT_FILE_SIZE_BYTES` 값 조정, (b) `MulterExceptionFilter` 를 export 쪽 (`ScopeInputExceptionFilter`) 과 통합하는 리팩터, (c) `@Post` 기본값 201 인 endpoint 에 `@HttpCode(201)` 명시 부착. 동작 무변경이라도 별도 `pr` task 소관 (§3.1 rule 3).
- **165~174 기존 status 행 재수정** — 200/201 (T-1334) 과 202/204 (T-1335) 는 방금 실측 정합을 끝냈다. 본 task 는 손대지 않는다.
- **4xx 개념 서술 감사** — 400 "모든 POST / PATCH" · 403 "mutation endpoint 전반" · 409 "일부 mutation — 구체 분기는 P3" 같은 기존 행의 적용 범위 실측 검증 (특히 409 행의 stale 한 "P3" 지시) 은 본 task 밖. 발견 사항은 Follow-ups 에 기록만 한다.
- **§ 5 125 행 (`POST /api/admin/import`) 의 실패 status 서술 보강** — 이 행은 현재 실패 status 를 하나도 적지 않아 preview (126 행) 와 비대칭이지만, 그 보강은 § 5 소관의 별도 slice 다. 본 task 는 § 6 표만 다룬다.
- **176 행 (412 Precondition Failed 주석) 수정** — race/concurrency status 는 여전히 본 표의 default 가 아니다. 글자 그대로 보존.
- `docs/use-cases/UC-07-export-import.md` 등 다른 문서의 413 · 업로드 상한 서술 — 본 task 는 api.md § 6 표만 다룬다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 삽입 — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

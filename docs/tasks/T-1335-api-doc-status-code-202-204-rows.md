---
id: T-1335
title: api.md § 6 표에 202 Accepted row 신설 + 204 No Content 적용 범위 실측 정합
phase: P5
status: DONE
completedAt: 2026-07-30T23:47:00Z
commitMode: direct
coversReq: [REQ-027, REQ-039, REQ-040, REQ-041]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-07-30
independentStream: api-status-code-table
dependsOn: [T-1334]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1334 가 Out of Scope 로 미룬 § 6 잔여 2 행 회수 — 202 row 자체가 부재(실측 3 종)이고 204 는 '일부' 서술이 실측 11 종과 어긋남"
---

# T-1335 — api.md § 6 표에 202 Accepted row 신설 + 204 No Content 적용 범위 실측 정합

## Why

[T-1334](T-1334-api-doc-status-code-table-realign.md) 가 [api.md](../architecture/api.md) § 6 표준 status code 표의 **200 / 201** 두 행을 실측 controller 기준으로 정합시키면서, 같은 표의 남은 성공 계열 drift 2 건은 자기 Out of Scope 에 "별도 slice" 로 명시해 뒤로 미뤄 뒀다. 본 task 가 그 slice 를 회수해 § 6 표의 **성공(2xx) 계열 서술을 실측과 완결**시킨다.

- **`202 Accepted` row 가 표에 아예 없다** — 실측으로 `POST /api/schedules/trigger` · `POST /api/schedules/backfill/:personId` · `POST /api/schedules/recent-deletion/:personId` **3 종** 이 `@HttpCode(202)` 다. § 5 endpoint 표 149~151 행은 셋 다 이미 "202 Accepted" 로 정확히 적고 있는데, "모든 endpoint 가 따르는 기본 status code 정책" 을 자처하는 § 6 표가 그 status 를 한 줄도 다루지 않아 **표만 읽는 독자에게는 202 가 존재하지 않는 status** 로 보인다.
- **204 행 (167 행) 의 `적용 범위` 가 "DELETE 계열 일부" 라 두 방향으로 틀렸다** — 실측상 controller 의 `@Delete` **10 종 전량** 이 `@HttpCode(204)` 라 "일부" 가 아니라 **전량** 이고, 반대로 DELETE 가 아닌 `POST /api/auth/logout` 도 204 라 "DELETE 계열" 이라는 한정 자체가 좁다.

[T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) · [T-1333](T-1333-api-doc-import-preview-200-sync.md) · T-1334 와 동일한 doc-only 계열이며, 판정 기준은 추론이 아니라 `src/**/*.controller.ts` 실측이다.

## Required Reading

- `docs/architecture/api.md` **163~173 행** — § 6 status code 표 전체 (헤더 2 행 + status 9 행). 수정은 **166 행 뒤에 202 행 1 개 삽입** + **167 행 (204) 의 `적용 범위` 컬럼 교체** 두 곳뿐이다. 각 행의 3 컬럼 구조 (`status` / `발화 조건` / `적용 범위`) 를 유지한다. **165 · 166 행 (T-1334 가 방금 정합) 은 수정 금지.**
- `docs/architecture/api.md` **149 · 150 · 151 행** — `/api/schedules/backfill/:personId` · `/api/schedules/trigger` · `/api/schedules/recent-deletion/:personId` row. 셋 다 "202 Accepted" 와 그 근거 (fire-and-forget · runner 위임 · 결과 body 형태) 를 이미 박제하고 있다. 새 202 행에 인용할 path 표기를 이 세 행과 **글자 그대로 일치**시킨다. **행 자체는 수정 금지 (읽기 전용).**
- 실측 명령 3 종 (executor 가 직접 실행해 목록을 확정한다 — 본 task 본문의 숫자를 그대로 믿지 말고 재실측 후 일치 확인):
  - `git grep -n "@HttpCode(202)" -- "src/**/*.controller.ts"` → **3 종** (`src/scheduling/cron-schedule.controller.ts:141` = `POST trigger` · `src/scheduling/backfill.controller.ts:70` = `POST backfill/:personId` · `src/scheduling/recent-deletion.controller.ts:97` = `POST recent-deletion/:personId`, 셋 다 `@Controller("api/schedules")` prefix).
  - `git grep -n "@HttpCode(204)" -- "src/**/*.controller.ts"` → 주석 줄 제외 **11 종** — DELETE 10 종 (`/api/persons/:id` · `/api/groups/:id` · `/api/groups/:id/members/:membershipId` · `/api/parts/:id` · `/api/assessments/:id` · `/api/contributions/:id` · `/api/summaries/:id` · `/api/llm/providers/:id` · `/api/users/:id/instance-access` · `/api/schedules/:name`) + POST 1 종 (`POST /api/auth/logout`, `src/auth/auth.controller.ts:194~195`).
  - `git grep -c "@Delete(" -- "src/**/*.controller.ts"` → 합계 **10** — 위 DELETE 10 종과 같은 수이므로 "`@Delete` 전량이 204" 라는 서술의 근거가 된다.
- `src/auth/auth.controller.ts:186~199` — `POST /api/auth/logout` 의 `@HttpCode(204)` 와 cookie clear 근거 주석. 204 행에 "DELETE 가 아닌 204 실례" 로 인용할 때의 문구 참고용 **읽기 전용**. 본 task 는 `src/` 를 1 줄도 고치지 않는다.

## Acceptance Criteria

- [ ] **166 행 (201 Created) 과 167 행 (204 No Content) 사이에 `202 Accepted` row 1 개를 삽입**한다. `발화 조건` 컬럼은 "요청을 접수했으나 처리 완료 전 응답 — fire-and-forget / 비동기 발화" 취지로, `적용 범위` 컬럼은 실측 **3 종** (`POST /api/schedules/trigger` · `POST /api/schedules/backfill/:personId` · `POST /api/schedules/recent-deletion/:personId`) 을 나열하고 각각이 manual trigger / backfill / delete→재수집 **runner 위임** 이라 즉시 완료를 보장하지 않는다는 근거를 1 구절로 병기한다. 박제 task 표기 (`T-0417` · `T-0421` · `T-0428`) 도 함께 적는다 (§ 5 149~151 행 출처).
- [ ] **167 행 (204 No Content) 의 `적용 범위` 컬럼을 "DELETE 계열 일부" 에서 실측 서술로 교체**한다 — (a) `@Delete` **10 종 전량** 이 204 라는 사실, (b) DELETE 가 아닌 **`POST /api/auth/logout`** 도 204 (cookie clear 후 body 없음) 라는 사실 둘 다 드러나야 한다. `발화 조건` 컬럼 ("DELETE / mutation 성공 시 body 불필요한 경우") 은 **글자 그대로 보존**.
- [ ] 실측 재확인 — executor 가 Required Reading 의 실측 명령 3 종을 실제로 실행하고, 본 task 본문의 3 종 / 11 종 / 10 목록과 **결과가 일치함을 확인**한 뒤 표에 옮긴다. 불일치 시 **실측이 정본** 이며 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 신설 202 행 포함 모든 행이 markdown **3 컬럼** 을 유지하고 파이프 개수가 행마다 동일하다. 행 병합·줄바꿈 삽입·컬럼 추가 금지. `sed -n '163,175p' docs/architecture/api.md` 로 표가 헤더 2 행 + status **10 행** (기존 9 + 신설 1) 임을 확인.
- [ ] status 행 정렬 유지 — 표의 status 행이 **숫자 오름차순** (200 → 201 → 202 → 204 → 400 → 401 → 403 → 404 → 409 → 500) 이 되도록 202 를 201 과 204 사이에 넣는다.
- [ ] 검증 grep — `git grep -n "202 Accepted" -- docs/architecture/api.md` 가 § 6 표 행 **1 hit 을 새로 포함**한다 (§ 5 149~151 행의 기존 hit 은 그대로 유지). `git grep -n "DELETE 계열 일부" -- docs/architecture/api.md` 결과가 **0 hit** 이다.
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1334](T-1334-api-doc-status-code-table-realign.md) 선례) — 대신 위 grep 2 종 + 표 구조/정렬 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이므로 실행 불요.

## Out of Scope

- **`src/` 코드 변경 전면 금지** — 특히 (a) `@Post` 기본값 201 인 4 종에 `@HttpCode(201)` 명시 부착, (b) `POST /api/auth/logout` 을 204 → 200 으로 바꾸는 류의 "정합" 리팩터. 동작 무변경이라도 별도 `pr` task 소관 (§3.1 rule 3).
- **165 · 166 행 (200 / 201) 재수정** — T-1334 가 방금 실측 정합을 끝냈다. 본 task 는 손대지 않는다.
- **4xx / 500 행 (168~173) 의 적용 범위 감사** — "모든 POST / PATCH" · "일부 mutation — 구체 분기는 P3" 같은 개념 서술의 실측 검증은 본 task 밖 (필요하면 Follow-ups 에 기록만).
- § 5 endpoint 표의 개별 행 (69~151) 수정 — 149~151 행은 이미 202 로 정합이고 나머지 행의 status 서술 감사도 본 task 밖이다.
- § 5 표 하단 155 행의 **endpoint 집계 수치** (72 / shipped 70) 재계산 — 본 task 는 endpoint 를 신설·삭제하지 않으므로 집계 불변.
- `docs/use-cases/UC-01-evaluation-execution.md` 등 다른 문서의 status 서술 — 본 task 는 api.md § 6 표만 다룬다.

## Suggested Sub-agents

`implementer` (doc-only inline-amend + 1 행 삽입 — architect·tester 불요)

## Follow-ups

- 실패(4xx/5xx) 계열에 같은 형태의 row-부재 gap 이 1 건 남아 있다 — `src/import/multer-exception.filter.ts` 가 `MulterError(LIMIT_FILE_SIZE)` → `PayloadTooLargeException` 으로 매핑하고 import 업로드 2 종에 `@UseFilters` 로 붙어 있는데 § 6 표에 `413` row 가 없다 → **[T-1336](T-1336-api-doc-status-code-413-row.md)** 으로 큐잉됨.

## Result

- **DONE** (2026-07-30T23:47:00Z) — direct-mode, main direct commit `c6656280`. `docs/architecture/api.md` 1 파일 +2/-1 (167 행에 202 행 1 개 삽입 + 168 행 204 의 `적용 범위` 컬럼만 inline amend, cap 준수).
- § 6 표에 없던 `202 Accepted` 행을 201 과 204 사이에 신설해 실측 3 종 (`POST /api/schedules/trigger` · `/backfill/:personId` · `/recent-deletion/:personId`) 과 runner 위임 근거를 박제했다 — § 5 표 149~151 행과의 서술 불일치 해소.
- 204 행 적용 범위를 "DELETE 계열 일부" 에서 실측 11 종 (`@Delete` **10 종 전량** + `POST /api/auth/logout`) 서술로 교체했다. 기존 서술은 '전량인데 일부' · 'DELETE 아닌 204 존재' 두 방향으로 틀려 있었다.
- `발화 조건` 컬럼과 165 · 166 행 (T-1334 가 방금 정합한 200/201) 은 글자 그대로 보존. `src/` · `test/` · `web/` 무수정.
- doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol 0). 대체 검증: 실측 grep 3 종 (202→3 / 204→11 / `@Delete`→10) 재확인 + 표 구조 (헤더 2 행 + status 10 행, 전 행 파이프 4 개) · 숫자 오름차순 self-check + 검증 grep 2 종 통과.
- main CI run `30591162206` **success** (R-114 fire 안에서 확인 완료).

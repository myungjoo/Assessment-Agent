---
id: T-1334
title: api.md § 6 표준 status code 표의 200/201 적용 범위를 실측 controller 기준으로 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030, REQ-032]
estimatedDiff: 22
estimatedFiles: 1
created: 2026-07-30
independentStream: api-status-code-table
dependsOn: [T-1333]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1333 이 Out of Scope 로 분리해 둔 § 6 표 slice 회수 — 201 범위 목록이 never-built /api/assessments/run 을 싣고 실측 13 종을 누락"
---

# T-1334 — api.md § 6 표준 status code 표의 200/201 적용 범위를 실측 controller 기준으로 정합

## Why

[T-1331](T-1331-export-scope-preview-httpcode-200.md) · [T-1332](T-1332-import-preview-httpcode-200.md) · [T-1333](T-1333-api-doc-import-preview-200-sync.md) chain 으로 UC-07 §5 preview 가족 3 종의 성공 status 가 코드·문서 양쪽에서 **200** 으로 통일됐다. 그런데 [api.md](../architecture/api.md) **§ 6 표준 status code 표** (165~166 행) 는 그 chain 이 확정한 사실을 전혀 반영하지 못한 채 두 가지 실측 drift 를 안고 있다.

- **166 행 (201 Created) 의 적용 범위 목록이 사실과 다르다** — 목록에 실린 `POST /api/assessments/run` 은 같은 문서 96 행이 스스로 "이 path 는 shipped 아님 (never-built)" 이라고 못 박은 path 다. 반대로 실제로 201 을 반환하는 endpoint 는 목록의 5 개보다 훨씬 많아 (실측 **13 종**), 표만 읽는 독자는 `/api/assessments` · `/api/contributions` · `/api/summaries` · `/api/admin/export` · `/api/admin/import` 등의 성공 status 를 알 수 없다.
- **165 행 (200 OK) 은 "POST (action)" 이라고 개념만 적고 실례가 0** — T-1331/T-1332 가 방금 박제한 read-only POST 3 종이 바로 그 "POST (action)" 의 정본 실례인데 문서에 연결이 없다.

T-1333 은 이 표 수정을 자기 Out of Scope 에 "별도 slice" 로 명시해 뒤로 미뤄 뒀다. 본 task 가 그 slice 를 회수한다 — [T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) · T-1333 과 동일한 doc-only inline-amend 계열이며, 판정 기준은 추론이 아니라 `src/**/*.controller.ts` 실측이다.

## Required Reading

- `docs/architecture/api.md` **163~167 행** — § 6 status code 표의 헤더 + `200 OK` / `201 Created` / `204 No Content` row. 수정 대상은 **165 · 166 두 행뿐**이며, 각 행의 3 컬럼 구조 (`status` / `발화 조건` / `적용 범위`) 를 유지한다.
- `docs/architecture/api.md` **96 행** — `POST /api/assessments/run` row. "**이 path 는 shipped 아님 (never-built)**. capability 는 `POST /api/assessment-collection/collect` + `POST /api/assessment-evaluation/period` 로 implemented-on-main 이관" 서술. 166 행에서 이 path 를 걷어내는 근거이자, 대체 path 를 무엇으로 적을지의 출처다. **이 행 자체는 수정 금지 (읽기 전용).**
- `docs/architecture/api.md` **126 · 132 · 133 행** — import preview · export `describe-scope` · `preview-selection` row. T-1331~T-1333 이후 셋 다 "응답 200" 으로 정합돼 있다. 165 행에 실례로 인용할 때 path 표기를 이 세 행과 **글자 그대로 일치**시킨다. **행 자체는 수정 금지.**
- 실측 명령 2 종 (executor 가 직접 실행해 목록을 확정한다 — 본 task 본문의 목록을 그대로 믿지 말고 재실측 후 일치 확인):
  - `git grep -n "@HttpCode(201)" -- "src/**/*.controller.ts"` → 명시 201 **9 종**: `POST /api/persons` · `/api/groups` · `/api/groups/:id/members` · `/api/parts` · `/api/users` · `/api/assessments` · `/api/contributions` · `/api/summaries` · `/api/assessment-collection/collect`.
  - `@Post()` 에 `@HttpCode` 미부착이라 NestJS 기본값 201 인 **4 종**: `POST /api/admin/export` (`src/export/export.controller.ts:162`) · `POST /api/admin/import` (`src/import/import.controller.ts:233`) · `POST /api/llm/providers` (`src/llm/llm-provider-config.controller.ts:124`) · `POST /api/users/:id/instance-access` (`src/user-instance-access/user-instance-access.controller.ts:84`).
- `src/export/export.controller.ts:218~223` 의 `@HttpCode(HttpStatus.OK)` 근거 주석 — 165 행에 붙일 "read-only POST 는 200" 서술의 문구 참고용 **읽기 전용**. 본 task 는 `src/` 를 1 줄도 고치지 않는다.

## Acceptance Criteria

- [ ] **166 행 (201 Created) 의 `적용 범위` 컬럼을 실측 13 종으로 교체**한다. 명시 `@HttpCode(201)` **9 종** 과 `@Post` 기본값 201 **4 종** 을 구분해 적어, 후자가 "의도적 default" 임이 드러나게 한다 (예: "명시 `@HttpCode(201)` 9 종 — ... / `@Post` 기본값 201 4 종 — ..."). `발화 조건` 컬럼 ("POST 가 새 resource 생성 시 — body 동반 (또는 `Location` header)") 은 **글자 그대로 보존**.
- [ ] **166 행에서 `POST /api/assessments/run` (run row 생성) 을 제거**한다. 제거만 하고 끝내지 말고, 96 행이 박제한 사실 ("never-built — capability 는 `/api/assessment-collection/collect` 로 이관") 을 한 구절로 병기해 독자가 옛 표기를 찾다 헤매지 않게 한다.
- [ ] **165 행 (200 OK) 의 `적용 범위` 컬럼에 read-only POST 실례를 명시**한다 — `POST /api/admin/export/describe-scope` · `/api/admin/export/preview-selection` · `/api/admin/import/preview` 3 종이 "새 row 를 만들지 않는 dry-run/조회라 `@HttpCode(HttpStatus.OK)`" 라는 취지 + 박제 task 표기 (`T-1331` · `T-1332`). `발화 조건` 컬럼의 "GET / PATCH / POST (action) 의 정상 완료 — body 동반" 은 **보존**.
- [ ] 실측 재확인 — executor 가 위 Required Reading 의 실측 명령 2 종을 실제로 실행하고, 본 task 본문의 13 종 목록과 **결과가 일치함을 확인**한 뒤 표에 옮긴다. 불일치 시 **실측이 정본** 이며 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 165 · 166 행이 각각 markdown **3 컬럼** 을 유지하고 파이프 개수가 변하지 않는다. 행 병합·줄바꿈 삽입·컬럼 추가 금지. `sed -n '163,173p' docs/architecture/api.md` 로 표 전체가 여전히 11 행 (헤더 2 + status 9 행) 임을 확인.
- [ ] 검증 grep — `git grep -n "assessments/run" -- docs/architecture/api.md` 결과에 **§ 6 표 행 (166) 이 포함되지 않는다** (96 행 등 § 5 표의 서술은 그대로 남아야 하므로 0 hit 을 요구하지 않는다). `git grep -n "describe-scope" -- docs/architecture/api.md` 가 § 6 표 행 **1 hit 을 새로 포함**한다.
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1333](T-1333-api-doc-import-preview-200-sync.md) 선례) — 대신 위 grep 2 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이므로 실행 불요.

## Out of Scope

- **`202 Accepted` row 신설** — `POST /api/schedules/trigger` · `/api/schedules/backfill/:personId` · `/api/schedules/recent-deletion/:personId` 3 종이 `@HttpCode(202)` 인데 § 6 표에 202 row 자체가 없다. 표 **행 추가** 는 구조 변경이라 별도 slice (Follow-ups 에 기록만).
- **`204 No Content` row (167 행) 수정** — `POST /api/auth/logout` 이 204 라 "DELETE 계열 일부" 서술이 좁지만 본 task 범위 밖. 손대지 않는다.
- `src/` 의 어떤 코드 변경도 금지 — 특히 `@Post` 기본값 201 인 4 종에 `@HttpCode(201)` 를 **명시적으로 부착하는 리팩터 금지** (동작 무변경 리팩터라도 별도 `pr` task 소관, §3.1 rule 3).
- § 5 endpoint 표의 개별 행 (69~151) 수정 — 126 · 132 · 133 행은 이미 정합이고 나머지 행의 status 서술 감사도 본 task 밖이다.
- § 5 표 하단 155 행의 **endpoint 집계 수치** (72 / shipped 70) 재계산 — 본 task 는 endpoint 를 신설·삭제하지 않으므로 집계 불변.
- `docs/use-cases/UC-07-export-import.md` 등 다른 문서의 status 서술 — 본 task 는 api.md § 6 두 행만 다룬다.

## Suggested Sub-agents

`implementer` (doc-only inline-amend — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

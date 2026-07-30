---
id: T-1332
title: import preview dry-run 응답을 @HttpCode(200) 으로 정합
phase: P5
status: DONE
completedAt: 2026-07-30T21:52:12Z
prNumber: 1209
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 110
estimatedFiles: 4
created: 2026-07-31
independentStream: import-preview-status
dependsOn: [T-1331]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
  - test/e2e/import-restore-http.e2e-spec.ts
  - web/src/views/AdminView.tsx
plannerNote: "T-1331 후속 — 같은 UC-07 §5 step 4 preview 가족인 import dry-run 만 201 잔존. R-112 backbone x1.5 = 110 LOC / 4 파일, api.md 동기는 별도 direct task"
---

# T-1332 — import preview dry-run 응답을 `@HttpCode(200)` 으로 정합

## Why

[T-1331](T-1331-export-scope-preview-httpcode-200.md) (PR #1208, main `f682efa9`) 이 export 측 preview 2 종 (`POST /api/admin/export/describe-scope` · `/preview-selection`) 을 read-only 조회라는 이유로 **200** 으로 정합시켰다. 그런데 같은 [UC-07 §5](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) step 4 (confirmation dialog) 가족에 속하는 **import 측 dry-run `POST /api/admin/import/preview`** 만 `@HttpCode` 미부착이라 NestJS 기본값 **201 Created** 로 남아 있다 (`src/import/import.controller.ts` 295 행). 이 endpoint 는 [api.md](../architecture/api.md) 126 행 스스로가 "**`ImportJob` row 미생성 · DB write 0 · `$transaction` 미개시**" 라고 못 박는 순수 dry-run 이라, 생성된 resource 가 0 인데 201 Created 를 주장하는 것은 사실과 어긋난다. 결과적으로 같은 dialog step 을 채우는 preview 3 종의 성공 status 가 200 / 200 / 201 로 갈라져 있어, web·후속 slice 가 "preview 는 200" 을 전제하면 import 만 조용히 다르게 동작한다. 본 task 는 import preview 도 200 으로 맞춰 preview 가족의 status 계약을 하나로 만든다.

`docs/architecture/api.md` 126 행은 현재 "응답 201" 이라 **문서도 함께 바뀌어야 하지만**, api.md 수정은 `direct` mode 라 CLAUDE.md §3.1 rule 3 에 따라 본 task 에 섞지 않는다 — 코드 먼저 (본 task, `pr`), 문서 동기는 후속 `direct` task ([T-1328](T-1328-export-scope-preview-input-4xx-filter.md) → [T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) 와 같은 순서).

## Required Reading

- `src/import/import.controller.ts` — 76~89 행 `@nestjs/common` import 블록 (`HttpCode` · `HttpStatus` 추가 필요), 그리고 279~295 행 preview 핸들러의 주석 블록 + `@Post("preview")` decorator stack (`@UseGuards` / `@Roles` / `@UseFilters(MulterExceptionFilter)` / `@UseInterceptors(FileInterceptor)`). 231 행 `@Post()` (create) 는 **읽기만** — 실제 job row 를 만드는 mutation 이라 201 유지가 정답이다.
- `src/import/import.controller.spec.ts` — **colocated spec**. 1203~1235 행 (preview happy `.expect(201)`), 1236~1330 행 (401 / 403 / 파일 누락 / whitelist negative 블록), 1622~1638 행 (`it.each(["Admin", "SuperAdmin"])` escalation `.expect(201)` + it 문자열의 "201"), 그리고 718~790 행 (핸들러 metadata 단언 구간 — `@UseFilters` / `@UseInterceptors` 부착 검사 패턴. `@HttpCode` metadata 단언을 여기에 같은 스타일로 추가한다).
- `test/e2e/import-restore-http.e2e-spec.ts` — 59~66 행 헤더 주석, 681~760 행 section H (`uploadPreview` helper 와 happy 2 개 — 703 행 it 문자열의 "201", 714 행 · 759 행 `expect(preview.status).toBe(201)`). 830~880 행 (400 / 413 rejection 블록) 은 status 변경 대상이 아니다.
- `web/src/views/AdminView.tsx` 247~250 행 — `ADMIN_IMPORT_PREVIEW_PATH` 위 주석의 "응답 201" 표기 (본 변경으로 stale 이 되는 **주석 1 줄**). 호출부는 `apiClient` 의 `response.ok` 판정이라 status 값 자체에 의존하지 않는다 (`web/src/api/apiClient.ts` 94 행) — 동작 변경 0.
- `docs/architecture/api.md` 126 행 — "응답 201 + `PreviewImportResponse`" 문구. **읽기만 하고 수정 금지** (후속 direct task 소관).

## Acceptance Criteria

- [ ] `src/import/import.controller.ts` 의 `preview` 핸들러에 `@HttpCode(HttpStatus.OK)` 를 부착하고 (`@nestjs/common` import 블록에 `HttpCode` · `HttpStatus` 를 알파벳 순서로 추가), 위 주석 블록에 "job row · transaction · DB write 가 0 인 dry-run 이라 200 — export preview 2 종 (T-1331) 과 같은 계약" 취지 1~2 줄을 한국어로 남긴다. `create` 핸들러 (`@Post()`) 에는 **아무 것도 부착하지 않는다** (실 job row 생성이라 201 유지).
- [ ] happy-path test — `src/import/import.controller.spec.ts` 의 preview 성공 케이스 (1205 행 블록) 가 `.expect(200)` 으로 갱신되고, 응답 body 단언 (`{ ...summary, mode }` 4 key · `summary` / `id` 미포함 · raw sentinel 미노출) 은 그대로 유지된다. `it` 문자열의 status 표기도 자연스럽게 갱신.
- [ ] error path test — `previewFromDump` 가 reject 할 때 (기존 error path 블록) status 가 200 으로 바뀌지 않고 원 예외 status 가 그대로 나감을 확인하는 test 1+ 유지·확인. 파일 누락 시 `BadRequestException` **400** 도 그대로임을 확인.
- [ ] flow / branch cover — `@HttpCode` 부착이 (a) mode 지정 / (b) mode 미지정 (`REPLACE` fallback) 두 분기 모두에서 200 을 내고 `mode` echo 값이 불변임을 각 1+ test 로 확인.
- [ ] negative cases 충분 cover — (a) 미인증 **401**, (b) 비-Admin **403**, (c) 파일 미첨부 **400**, (d) DTO whitelist 위반 **400**, (e) `MulterExceptionFilter` 의 크기 상한 **413** 이 각각 200 으로 오염되지 않음을 각 1+ test 로 확인하고, (f) **`POST /api/admin/import` (실 job 생성) 은 여전히 201** 임을 고정하는 회귀 test 1+ 를 둔다.
- [ ] metadata test — `ImportController.prototype.preview` 에 `HttpCode` metadata 가 **200** 으로 부착됐고 `ImportController.prototype.create` 에는 부착이 없음을 대조하는 test 1+ (기존 `@UseFilters` metadata 단언과 같은 스타일).
- [ ] `test/e2e/import-restore-http.e2e-spec.ts` section H 의 `expect(preview.status).toBe(201)` 2 곳을 **200** 으로 바꾸고, 703 행 it 문자열과 관련 주석을 "200 (dry-run, T-1332)" 취지로 갱신한다. preview ↔ 실행 `restoreSummary` 수치 일치 단언과 DB write 0 단언은 무손상 유지.
- [ ] `web/src/views/AdminView.tsx` 249 행 주석의 "응답 201" 을 200 으로 정정한다 (**주석 1 줄만** — 로직·테스트 무변경).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] web 측 `pnpm --dir web test` (또는 저장소 관례 명령) 와 타입체크가 주석 변경 후에도 통과.

## Out of Scope

- `docs/architecture/api.md` 126 행의 "응답 201" 문구 수정 — **후속 `direct` task 소관** (§3.1 rule 3, direct/pr 혼합 금지). 본 task 에서 건드리면 위반.
- `POST /api/admin/import` (실 import 실행) · `POST /api/admin/import/preview` 외 **다른 endpoint 의 status 변경** — `src/llm/llm-provider-config.controller.ts` · `src/user-instance-access/...` · `src/export/export.controller.ts` `@Post()` 등 `@HttpCode` 미부착 handler 가 남아 있어도 본 task 는 import preview 하나만 다룬다 (필요 시 Follow-ups).
- 응답 body shape (`PreviewImportResponse` 4 key) · `mode` fallback 로직 (`dto.mode ?? ImportMode.REPLACE`) 변경.
- `MulterExceptionFilter` / `FileInterceptor` 상한 / RBAC decorator stack 변경.
- web 의 `runImportPreview` 로직 · 문구 · 테스트 변경 (주석 1 줄 외 무변경).
- 새 e2e spec 파일 신설 — 기존 `import-restore-http.e2e-spec.ts` section H 를 갱신한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result

- **DONE** (2026-07-30T21:52:12Z) — pr-mode, PR [#1209](https://github.com/myungjoo/Assessment-Agent/pull/1209) squash merge `14adc440`. 4 파일 +147/-12 (cap 준수 — 300 LOC / 5 파일 이내).
- `POST /api/admin/import/preview` handler 에 `@HttpCode(HttpStatus.OK)` + 한국어 근거 주석 부착 (`HttpCode` / `HttpStatus` import 추가). 실 import 실행 `POST /api/admin/import` 는 **201 그대로 유지** — dry-run 만 200 으로 갈랐다.
- [T-1331](T-1331-export-scope-preview-httpcode-200.md) 이 export preview 2 종을 200 으로 맞춘 데 이어, 같은 [UC-07 §5](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) step 4 preview 가족의 성공 status 계약이 **200 / 200 / 200** 으로 통일됐다.
- colocated spec: T-1332 metadata describe 1 개(preview 200 부착 / create·GET 3 종 미부착 대조) + branch/negative 3 개 추가. e2e `import-restore-http.e2e-spec.ts` section H 의 status 단언 3 곳(REPLACE / MERGE / mode 미지정)을 200 으로 갱신. web `AdminView.tsx` 는 주석 1 줄만 정정 (로직·테스트 무변경 — `apiClient` 가 `response.ok` 판정이라 status 값 의존 0).
- R-112: happy 200 · error path (`previewFromDump` reject 400 · 파일 누락 400) · flow/branch (mode 지정 MERGE / 미지정 REPLACE fallback 양쪽 200) · negative 충분 cover (401 · 403 · 400 파일누락 · 400 whitelist · 413 · create 201 회귀). unit 429 suite / 12302 test pass, `test:cov` line·function 80% 통과. web 2082 pass + vite build.
- reviewer round 1/7 APPROVE, 4-게이트 PASS (reviewer comment 외부 존재를 driver 가 직접 확인), PR CI green. merge 후 main CI `14adc440` 도 **success**.

## Follow-ups (실행 후 추가)

- `docs/architecture/api.md` 126 행의 "응답 201" 문구가 아직 stale — [T-1333](T-1333-api-doc-import-preview-200-sync.md) (`direct`) 으로 큐잉됨.

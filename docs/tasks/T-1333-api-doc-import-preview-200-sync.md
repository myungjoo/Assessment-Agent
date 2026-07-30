---
id: T-1333
title: api.md 의 import preview 응답 status 서술을 201 → 200 으로 실측 정합
phase: P5
status: DONE
completedAt: 2026-07-30T22:39:10Z
commitMode: direct
coversReq: [REQ-030, REQ-032]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-31
independentStream: import-preview-status
dependsOn: [T-1332]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1332(PR #1209, main 14adc440)가 코드를 200 으로 바꿨는데 api.md 126 행만 '응답 201' 잔존 — §3.1 rule 3 로 분리해 둔 direct doc slice 회수"
---

# T-1333 — api.md 의 import preview 응답 status 서술을 201 → 200 으로 실측 정합

## Why

[T-1332](T-1332-import-preview-httpcode-200.md) (PR #1209, main `14adc440`) 가 `POST /api/admin/import/preview` 핸들러에 `@HttpCode(HttpStatus.OK)` 를 부착해 dry-run preview 의 성공 응답을 **200** 으로 정합시켰다. 그런데 [api.md](../architecture/api.md) **126 행**은 여전히 "응답 **201** + `PreviewImportResponse`" 라고 적고 있어 실동작과 어긋난다. 같은 행이 스스로 "**`ImportJob` row 미생성 · DB write 0 · `$transaction` 미개시**" 라고 못 박고 있어 문서 내부에서도 201 Created 주장과 모순이다.

T-1332 는 CLAUDE.md §3.1 rule 3 (direct + pr 혼합 금지) 에 따라 이 문서 slice 를 의도적으로 뒤로 분리했고, 자기 Out of Scope 에 "후속 `direct` task 소관" 이라고 명시해 뒀다. 본 task 가 그 slice 를 회수한다 — [T-1328](T-1328-export-scope-preview-input-4xx-filter.md) → [T-1329](T-1329-api-doc-scope-preview-4xx-sync.md) 와 동일한 코드-먼저·문서-나중 순서다. 이로써 UC-07 §5 step 4 preview 가족 3 종 (export `describe-scope` · `preview-selection` · import `preview`) 의 성공 status 가 코드·문서 양쪽에서 모두 **200** 으로 통일된다.

## Required Reading

- `docs/architecture/api.md` **126 행** — `| POST | /api/admin/import/preview | UC-07 §5 | ... |` row. 수정 지점은 이 한 행 안의 (a) "응답 201 + `PreviewImportResponse`" 문구, (b) 행 끝 박제 목록 "T-1299 (PR #1189) 배선 · T-1300 (PR #1190) e2e 박제 · T-1302 (PR #1191) mode echo 박제." 두 곳뿐이다.
- `docs/architecture/api.md` 132·133 행 — export scope preview 2 종 row. [T-1331](T-1331-export-scope-preview-httpcode-200.md) 이후 이미 "응답 200" 이라 **읽기만 하고 수정 금지** (본 task 는 import 한 행만 다룬다). 문장 톤·박제 표기 스타일의 참고 선례로만 본다.
- `docs/architecture/api.md` **165~166 행** — § 6 표준 status code 표의 `200 OK` / `201 Created` row. 201 row 의 적용 범위 목록 (`/api/persons`, `/api/groups`, `/api/parts`, `/api/users`, `/api/llm/providers`, `/api/assessments/run`) 에는 import preview 가 애초에 **없다** → 표 수정 불요임을 확인만 한다.
- `docs/tasks/T-1332-import-preview-httpcode-200.md` 의 Why · Out of Scope — 본 문서 slice 를 분리해 둔 근거와 "job row 생성 0 이라 200" 판단 문장 (문구 재사용 참고).
- `src/import/import.controller.ts` 의 `preview` 핸들러 decorator stack — `@HttpCode(HttpStatus.OK)` 부착 사실 확인용 **읽기 전용**. 본 task 는 `src/` 를 1 줄도 고치지 않는다.

## Acceptance Criteria

- [ ] `docs/architecture/api.md` 126 행의 "**응답 201 + `PreviewImportResponse`**" 를 "**응답 200 + `PreviewImportResponse`**" 로 교체한다. 뒤따르는 4-key envelope 설명 (`deleted`/`inserted`/`kept`/`mode`) · `mode` 해석 서술 · 실행 응답과의 mode 표기 위치 차이 서술은 **글자 그대로 보존**.
- [ ] 같은 행에 200 인 근거 1 문장을 자연스럽게 덧붙인다 — "`ImportJob` row 를 만들지 않는 dry-run 이라 `@HttpCode(HttpStatus.OK)` 부착 (실 job 을 만드는 `POST /api/admin/import` 는 여전히 201)" 취지. 기존 "**`ImportJob` row 미생성 · DB write 0 · `$transaction` 미개시**" 문장과 중복 서술이 되지 않도록 그 문장 근처에 붙인다.
- [ ] 행 끝 박제 목록에 `T-1332 (PR #1209) 200 정합 박제` 를 기존 항목 뒤에 병기한다 (`T-1299 ... · T-1300 ... · T-1302 ...` 순서·표기 유지, 126 행의 `·` 구분 스타일 그대로).
- [ ] 실패 status 목록 `400 / 401 / 403 / 413` 은 **변경 0** — T-1332 가 error path status 를 바꾸지 않았음이 그 task Result 에 박제돼 있다.
- [ ] 검증 grep — `git grep -n "응답 201" -- docs/architecture/api.md` 결과에 `/api/admin/import/preview` 행이 **더 이상 없다** (다른 endpoint 의 201 서술은 그대로 남아야 하므로 0 hit 을 요구하지 않는다). `git grep -n "T-1332" -- docs/architecture/api.md` 가 **1 hit**.
- [ ] 표 구조 무손상 — 126 행의 markdown 5 컬럼 (`METHOD` / path / UC / description / auth tier) 이 유지되고 파이프 개수가 변하지 않는다. 행 병합·줄바꿈 삽입 금지.
- [ ] `src/` · `test/` · `web/` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC) — 대신 위 grep 2 종과 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이므로 실행 불요.

## Out of Scope

- `src/import/import.controller.ts` 를 포함한 모든 코드 변경 — 실동작은 T-1332 가 이미 완결했다. 본 task 는 문서만 맞춘다.
- api.md **132·133 행** (export scope preview 2 종) — T-1331 이후 이미 200 이라 손댈 것이 없다.
- api.md § 6 표준 status code 표 (165~166 행) 수정 — 201 row 의 적용 범위 목록에 import preview 가 없어 정합이 이미 성립한다. 표에 preview 계열을 새로 나열하는 확장은 별도 slice.
- `POST /api/admin/import` (실행 경로, 125 행) 의 서술 — 실 job row 를 만들므로 201 이 맞다. 건드리지 않는다.
- `docs/use-cases/UC-07-export-import.md` 의 preview 관련 서술 — status code 를 명시하지 않아 stale 이 아니다.
- 다른 endpoint 의 `@HttpCode` 미부착 (예: `src/llm/llm-provider-config.controller.ts` · `src/export/export.controller.ts` `@Post()`) 조사·수정 — T-1332 Out of Scope 가 이미 분리해 둔 별건.

## Suggested Sub-agents

`implementer` (doc-only inline-amend — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result

- **DONE** (2026-07-30T22:39:10Z) — direct-mode, main direct commit `304975cb`. `docs/architecture/api.md` 1 파일 +1/-1 (cap 준수 — 300 LOC / 5 파일 이내). PR·reviewer 없음 (§3.1 direct 컬럼).
- 126 행의 "응답 **201** + `PreviewImportResponse`" 를 "응답 **200**" 으로 교체하고, `ImportJob` row 를 만들지 않는 dry-run 이라 `@HttpCode(HttpStatus.OK)` 를 부착했다는 근거 1 문장을 병기했다 (실 job 을 만드는 `POST /api/admin/import` 는 여전히 201). 4-key envelope (`deleted`/`inserted`/`kept`/`mode`) 서술과 실패 status `400 / 401 / 403 / 413` 은 글자 그대로 보존.
- 행 끝 박제 목록에 `T-1332 (PR #1209) 200 정합 박제` 를 기존 항목 (T-1299 · T-1300 · T-1302) 뒤에 병기.
- 이로써 [UC-07 §5](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) step 4 preview 가족 3 종 (export `describe-scope` · `preview-selection` · import `preview`) 의 성공 status 가 **코드·문서 양쪽 모두 200** 으로 통일됐다 — [T-1331](T-1331-export-scope-preview-httpcode-200.md) → [T-1332](T-1332-import-preview-httpcode-200.md) → 본 task 로 이어진 코드-먼저·문서-나중 시퀀스의 마지막 조각.
- doc-only 라 R-110 tester 면제 (production code 0 LOC). 대체 검증: grep 2 종 (`"응답 201"` 잔존 행에 import preview 없음 · `T-1332` 1 hit) + 표 5 컬럼 구조 self-check (파이프 개수 유지, 파일 227 행 불변) 통과. `src/` · `test/` · `web/` 무수정.
- main CI (run `30587889368`, headSha `304975cb`) conclusion **success**.

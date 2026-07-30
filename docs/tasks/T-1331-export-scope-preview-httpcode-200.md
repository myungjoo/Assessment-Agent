---
id: T-1331
title: export scope preview 2 종 read-only 응답을 @HttpCode(200) 으로 정합
phase: P5
status: DONE
completedAt: 2026-07-30T20:49:08Z
prNumber: 1208
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-07-31
independentStream: export-scope-input-4xx
dependsOn: [T-1328, T-1330]
touchesFiles:
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
  - test/e2e/export-scope-preview.e2e-spec.ts
plannerNote: "T-1330 Follow-up — read-only 조회가 201 로 응답. api.md 132·133 은 이미 '응답 200' 이라 doc 변경 0, 코드만 정합 x1.5 = 80 LOC / 3 파일"
---

# T-1331 — export scope preview 2 종 read-only 응답을 `@HttpCode(200)` 으로 정합

## Why

[T-1330](T-1330-export-scope-preview-400-e2e.md) (PR #1207, main `59a14755`) 의 e2e 가 실 HTTP 왕복으로 확인한 사실 — `POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection` 두 handler 는 **read-only 조회** 인데도 `@HttpCode` 미부착이라 NestJS 기본값 **201 Created** 로 응답한다 (e2e spec 94~98 행이 `OK_STATUS = 201` 로 실 동작을 박제해 둠). 반면 [docs/architecture/api.md](../architecture/api.md) 132 행 · 133 행의 계약은 두 endpoint 모두 **"응답 200"** 이라고 적고 있어, **문서 계약과 실 동작이 어긋난다**. 둘 중 옳은 쪽은 문서다 — 새 resource 를 만들지 않는 read-only 조회에 201 Created 는 REST 오용이고, web UI · 후속 slice 가 200 을 전제하면 조용히 깨진다. 본 task 는 코드를 문서 계약에 맞춰 200 으로 정합한다 (api.md 는 이미 200 이라 **문서 변경 0** — §3.1 rule 3 의 direct/pr split 불요).

## Required Reading

- `src/export/export.controller.ts` — 215 행 `@Post("describe-scope")` · 255 행 `@Post("preview-selection")` 핸들러 2 개와 그 위 주석 블록, 그리고 import 절 (`HttpCode` / `HttpStatus` 추가 필요 여부 확인).
- `src/export/export.controller.spec.ts` — 1795~1810 행 (describe-scope happy `.expect(201)`) · 1874~1965 행 (preview-selection happy 및 관련 `.expect(201)`) 구간. **colocated spec** 이며 신규 파일 신설 없이 본 파일에서 수정한다.
- `test/e2e/export-scope-preview.e2e-spec.ts` — 94~98 행 `OK_STATUS` 상수와 그 위 "201 인 이유" 주석, 101 행 · 117 행 happy it 블록.
- `docs/architecture/api.md` 132~133 행 — 두 endpoint 의 "응답 200" 계약 문구 (읽기만, 수정 금지).

## Acceptance Criteria

- [ ] `describeScope` · `previewSelection` 두 handler 에 `@HttpCode(HttpStatus.OK)` 를 부착하고, 위 주석 블록에 "read-only 조회라 200 — api.md 132·133 계약 정합" 취지 1~2 줄을 한국어로 남긴다.
- [ ] happy-path test — `src/export/export.controller.spec.ts` 의 describe-scope · preview-selection 성공 케이스가 각각 **`.expect(200)`** 로 갱신되고 응답 body 단언 (`ExportScopeDescription` / count 요약 3 키) 은 그대로 유지된다. `it` 문자열의 "201" 표기도 200 으로 자연스럽게 갱신.
- [ ] error path test — 두 endpoint 의 `RangeError` / `TypeError` 입력 결함이 여전히 **400** 으로 매핑됨을 확인하는 test 1+ 유지·확인 (`ScopeInputExceptionFilter` 가 `@HttpCode` 보다 우선함을 실증).
- [ ] flow / branch cover — 인증 부재 **401** · User role **403** 분기가 200 으로 바뀌지 않음을 각 1+ test 로 확인 (guard 가 handler 이전에 차단하므로 `@HttpCode` 영향 없음).
- [ ] negative cases 충분 cover — (a) 미인증 401, (b) 권한 부족 403, (c) 잘못된 입력 400, (d) `POST /api/admin/export` (job 생성 mutation) 는 **여전히 201** 임을 확인하는 회귀 test 1+, (e) DTO whitelist 위반 400. 각 1+ test.
- [ ] `test/e2e/export-scope-preview.e2e-spec.ts` 의 `OK_STATUS` 를 **200** 으로 바꾸고, 그 위 "201 인 이유" 주석을 "read-only 라 `@HttpCode(200)` 부착 (T-1331)" 취지로 갱신. e2e 의 happy 2 개가 실 HTTP 왕복으로 200 을 수신함을 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:e2e` 로 `export-scope-preview.e2e-spec.ts` 통과 확인.

## Out of Scope

- `POST /api/admin/export` (job 생성) · `POST /api/admin/import` · `POST /api/admin/import/preview` 등 **다른 endpoint 의 status 변경** — 본 task 는 export scope preview 2 종만.
- `docs/architecture/api.md` 수정 — 이미 "응답 200" 이라 변경 불요 (직접 수정하면 direct/pr 혼합 위반).
- `ScopeInputExceptionFilter` 의 매핑 로직 변경 · 새 exception 종류 추가.
- 응답 body shape (`ExportScopeDescription` / `ExportSelectionPreview`) 변경.
- web UI 측 fetch 코드 수정 (현재 두 endpoint 호출부 없음 — 필요 시 Follow-ups 로).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result

- **DONE** (2026-07-30T20:49:08Z) — pr-mode, PR [#1208](https://github.com/myungjoo/Assessment-Agent/pull/1208) squash merge `f682efa9`. 3 파일 +101/-11 (cap 준수 — 300 LOC / 5 파일 이내).
- `describeScope` · `previewSelection` 두 handler 에 `@HttpCode(HttpStatus.OK)` 부착 + 한국어 근거 주석. `HttpCode` / `HttpStatus` import 추가. [api.md](../architecture/api.md) 132·133 행 계약("응답 200")과 실동작이 정합됐다 — **문서 변경 0**.
- colocated spec 의 happy-path 단언을 201 → 200 으로 갱신(body 단언 유지), `test/e2e/export-scope-preview.e2e-spec.ts` 의 `OK_STATUS` 를 200 으로 바꾸고 "201 인 이유" 주석을 200 근거로 재작성.
- R-112: happy 200 · `RangeError`/`TypeError` 400 우선 유지 · 401/403 분기 불변 · job 생성 `POST` 는 여전히 **201 회귀 test** · whitelist 400 까지 negative 충분 cover. unit 429 suite / 12294 test pass, `test:cov` line·function 80% 통과.
- reviewer round 1/7 APPROVE, 4-게이트 PASS (reviewer comment 외부 존재 확인), PR CI green. merge 후 main CI `f682efa9` 도 **success**.

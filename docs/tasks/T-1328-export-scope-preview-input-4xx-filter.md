---
id: T-1328
title: Export scope preview 2 종의 잘못된 입력을 500 → 400 으로 매핑하는 ScopeInputExceptionFilter 배선
phase: P5
status: DONE
prNumber: 1206
completedAt: 2026-07-30T17:55:12Z
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 255
estimatedFiles: 4
created: 2026-07-31
independentStream: export-scope-input-4xx
dependsOn: []
touchesFiles:
  - src/export/scope-input-exception.filter.ts
  - src/export/scope-input-exception.filter.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "T-1305 이월 결함 — describe-scope · preview-selection 의 caller 입력 오류가 500 으로 표면화. MulterExceptionFilter(T-1253) 패턴 mirror 로 400 매핑. R-112 backbone x1.5 = 255 LOC / 4 파일"
---

# T-1328 — Export scope preview 2 종의 잘못된 입력을 500 → 400 으로 매핑

## Why

`POST /api/admin/export/describe-scope` 와 `POST /api/admin/export/preview-selection` 은 **caller 가 보낸 scope 조합이 잘못됐을 때 HTTP 500** 으로 응답한다. [export.controller.ts](../../src/export/export.controller.ts) 197~201 행 · 234~237 행 주석이 그 사실을 스스로 박제하고 있다 — RANGE + `dateRange` 누락 / `start >= end` / PARTIAL + 빈 `entitySelector` / 허용 외 entity 는 helper 의 `RangeError`, Invalid Date 는 `TypeError` 가 swallow 없이 raw propagate 해 NestJS default exception filter 가 **500** 으로 매핑한다. 즉 **호출자 입력 결함이 서버 오류로 표면화**되는 상태다 — Admin UI 는 "내 입력이 잘못됐다" 와 "서버가 죽었다" 를 구분할 수 없고, 운영 관점에서도 정상 입력 검증 실패가 5xx 로 집계된다.

이 항목은 [T-1305](T-1305-api-doc-export-remaining-routes.md) 가 문서화 slice 에서 사실만 적고 **Follow-ups 로 남긴 결함** 이며([T-1313](T-1313-p6-deferred-residual-list-resync.md) Follow-ups 에도 이월돼 있다), 본 task 가 그중 **caller 입력 계열만** 닫는다. 매핑 mechanism 은 새로 설계하지 않고 [T-1253](T-1253-import-upload-size-limit-multer-filter.md) 이 import 측에 박제한 [`MulterExceptionFilter`](../../src/import/multer-exception.filter.ts) 패턴(핸들러 단위 `@UseFilters` + `HttpException` passthrough + 알려진 예외만 4xx + 그 외 500 보존)을 **그대로 mirror** 한다. 새 외부 dependency 0, helper/service 의 throw 종류 변경 0.

[REQ-030](../requirements.md)(Export) / [REQ-032](../requirements.md)(raw 미저장 — 본 경로는 read-only 유지) / [REQ-045](../requirements.md)(Admin 전용 — 401/403 passthrough 보존) cover.

## Required Reading

- [src/export/export.controller.ts](../../src/export/export.controller.ts) — **186~223 행** `@Post("describe-scope")` (helper 직호출, DB write 0) + **225~261 행** `@Post("preview-selection")` (service 경유 read-only) + **263~282 행** `coerceDateRange`. 두 핸들러의 "controller 자체 분기 0 → 500" 주석이 본 task 의 수정 대상 서술이다.
- [src/import/multer-exception.filter.ts](../../src/import/multer-exception.filter.ts) — **mirror 원본**. `@Catch()` + `catch()` 가 `toHttpException()` private 로 위임 → `response.status(...).json(mapped.getResponse())` 구조, 분기 우선순위(HttpException passthrough → 알려진 예외 4xx → unknown 500).
- [src/import/multer-exception.filter.spec.ts](../../src/import/multer-exception.filter.spec.ts) — colocated spec 의 형태(분기별 단언 + `ArgumentsHost` mock). 본 task 의 신규 spec 은 이 파일 구조를 따른다.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) **748~772 행** — `Reflect.getMetadata("__exceptionFilters__", Controller.prototype.<handler>)` 로 `@UseFilters` 부착을 단언하는 선례. controller spec 추가분은 이 형태를 따른다.
- [src/export/export-scope-description.ts](../../src/export/export-scope-description.ts) **77~96 행** (`assertValidDate` → `TypeError`, `assertValidRange` → `RangeError`) + **165~196 행** (RANGE `dateRange` 누락 / PARTIAL 빈 selector / 허용 외 entity → `RangeError`) — 매핑 대상 예외의 실제 발생 지점·메시지 형태.

## Acceptance Criteria

- [ ] **`src/export/scope-input-exception.filter.ts` 신설** — `ScopeInputExceptionFilter` (NestJS `ExceptionFilter`, `@Catch()`). 매핑 규칙 4 분기를 [`MulterExceptionFilter`](../../src/import/multer-exception.filter.ts) 와 동형으로 구현: (1) `HttpException` 은 status·body **그대로 passthrough** (401/403/ValidationPipe 400 재매핑 금지), (2) `RangeError` → **400 BadRequest**, (3) `TypeError` → **400 BadRequest**, (4) 그 외 unknown → **500** (default 동작 보존, swallow 금지). 400 응답 message 는 한국어 안내 + 원 `error.message` 를 포함한다 (helper 메시지에 secret 없음 — §9 확인 완료). 파일 상단에 목적·분기 규칙 주석(한국어, §12).
- [ ] **`src/export/export.controller.ts` 배선** — `describeScope` · `previewSelection` **두 핸들러에만** `@UseFilters(ScopeInputExceptionFilter)` 부착. 두 핸들러 위 주석의 "raw propagate → 500" 서술을 "→ 400 매핑 (`ScopeInputExceptionFilter`)" 로 정정하고, `create` · `download` · `findJob` 등 **다른 핸들러는 1 줄도 수정하지 않는다**. helper/service 의 throw 종류 변경 0.
- [ ] **happy-path unit test 1+** — `src/export/scope-input-exception.filter.spec.ts` (colocated) 에서 `RangeError` 투입 시 400 status + 한국어 message 를 담은 body 로 `response.status().json()` 이 호출됨을 단언.
- [ ] **error path unit test 1+** — `TypeError` (Invalid Date 계열) 투입 시 400 으로 매핑되고, unknown 예외(`new Error("boom")`) 투입 시 **500** 으로 매핑됨(4xx 로 오분류 0)을 각각 단언.
- [ ] **분기별 test (branch cover)** — 위 4 분기 각각 1+ test: (1) `HttpException` passthrough 는 **원 status 보존** (`ForbiddenException` 403 · `BadRequestException` 400 두 케이스로 재매핑 0 확인), (2) `RangeError` 400, (3) `TypeError` 400, (4) unknown 500.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: `null` / `undefined` 투입 (→ 500, throw 0), 문자열·plain object 투입 (→ 500), `RangeError` 를 상속한 subclass 투입 (→ 400 유지), message 가 빈 문자열인 `RangeError` (→ 400 + 안내 문구만), body 에 stack trace 등 내부 노출 0 확인.
- [ ] **controller 배선 단언 (metadata level)** — `src/export/export.controller.spec.ts` 에 4 test 추가: `describeScope` · `previewSelection` 의 `Reflect.getMetadata("__exceptionFilters__", ...)` 가 `ScopeInputExceptionFilter` 를 포함하고, **negative** 로 `create` · `download` 핸들러에는 **미부착** (undefined 이거나 `ScopeInputExceptionFilter` 미포함) 임을 단언한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 전량 통과 (기존 suite 회귀 0 — 특히 `export.controller.spec.ts` · `export-scope-description.spec.ts`).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 filter 파일은 분기 4 종 전량 cover).
- [ ] **diff ≤ 300 LOC / 파일 정확히 4 개** (`git diff --stat` 으로 확인). 초과 예상 시 filter spec 의 중복 케이스를 줄여 맞춘다.
- [ ] **언어 규율 (§12)** — 주석·test 설명·400 message 는 한국어, 식별자·decorator·status 토큰은 영어.

## Out of Scope

- **`download` 경로의 `RangeError` (손상 job row) 매핑 0** — [T-1291](T-1291-export-download-scope-select-wire.md) 이월 항목. 그것은 **서버 상태** 결함이라 409/422/500 중 무엇인지가 제품 판단 대상이며, 본 task 는 **caller 입력** 계열만 닫는다.
- **`create` (`POST /api/admin/export`) 및 import 측 경로 0 수정** — 업로드 stack 은 `MulterExceptionFilter` 가 이미 cover.
- **`docs/architecture/api.md` 갱신 0** — 46 행 등이 "500 으로 나간다" 를 현재 사실로 적고 있어 본 변경 후 stale 해지지만, doc 수정은 `direct` 대상이라 §3.1 rule 3 대로 **후속 direct task 로 분리** (Follow-ups 박제).
- **helper (`export-scope-description.ts` · `export-scope-select.ts`) 의 throw 타입 변경 0** — helper 가 `HttpException` 을 던지게 만드는 리팩터는 domain layer 에 HTTP 의존을 들이는 방향이라 금지. 매핑은 controller 경계에서만.
- **e2e spec 신규 추가 0** — 400 매핑의 HTTP 왕복 실증은 별도 slice (Follow-ups). 본 task 는 filter unit + controller metadata 로 cover.
- **global exception filter 도입 0** — `main.ts` 의 앱 전역 필터 등록은 다른 경로의 status 계약을 광범위하게 바꾸므로 본 slice 밖.
- **새 dependency 0** (`@nestjs/common` 만 사용), **`deploy/daily-test.sh` leg 추가 0** (drift-guard 3 종 동반으로 cap 초과 — Q-0054 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **`docs/architecture/api.md` 132·133 행 stale 정정** — 두 endpoint 실패 status 서술이 아직 "500" 이다. planner 가 **T-1329**(direct, doc-only) 로 큐잉 완료.
- **400 매핑의 e2e 실증 slice** — 본 task 는 filter unit + controller metadata 로만 cover 했다. HTTP 왕복 400 단언은 별도 e2e slice 로 분리 (미큐잉).

## 결과 (2026-07-30 완료)

`ScopeInputExceptionFilter` 신설(`HttpException` passthrough → `RangeError`/`TypeError` 400 → unknown 500) + `describeScope` · `previewSelection` 두 핸들러에만 `@UseFilters` 배선. helper throw 타입 변경 0, 새 dependency 0. +293/-7 · 4 파일(cap 이내). 신규 필터 spec 13 test + controller metadata 4 test(positive 2 / negative 2), 기존 500 단언 1 건을 400 계약으로 정정. 신규 필터 line·branch·function 100%, 전역 line 99.95% · function 100%. reviewer APPROVE round 1/7, 4-게이트 PASS, PR #1206 squash merge `a10ae22d`.

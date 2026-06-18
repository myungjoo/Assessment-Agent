---
id: T-0490
title: api.md §5 GET /api/admin/export → POST 정정 (T-0488 code↔doc drift closure)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0488]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "P7 chain follow-up — T-0488 §Follow-ups 의 doc-sync. ExportController 가 POST /api/admin/export 로 박제됐으나 api.md §5 L123·L176 은 GET 잔존(PR-400 round1 MAJOR finding). doc-only direct, doc-only inline-amend × 0.64."
---

# T-0490 — api.md §5 `GET /api/admin/export` → `POST` 정정

## Why

P7 export/import 실 배선 chain 의 [T-0488](T-0488-export-controller-dto-module.md) (ExportController, PR-400 merge ec2fe31) §Follow-ups 에 기록된 **code↔doc drift 의 closure** 다. T-0488 의 `ExportController` 는 export job 생성이 mutation 이므로 `POST /api/admin/export` 로 박제됐으나 ([src/export/export.controller.ts](../../src/export/export.controller.ts) L69·L88 `@Post()`), [docs/architecture/api.md](../architecture/api.md) §5 의 계약 표 (L123) 와 UC 매핑 표 (L176) 는 여전히 `GET /api/admin/export` 를 명시 — REST 정합(query GET 으로 mutation 발화는 안티패턴)에 어긋난 채 문서만 stale 이다. 이는 PR-400 reviewer round 1 의 MAJOR finding(api.md GET→POST doc-sync) 의 명시적 closure 항목이다.

api.md 본문은 `direct` commitMode(docs/architecture status 갱신)이므로 T-0488 의 pr-mode PR 에 포함하지 않고 본 별도 direct doc task 로 분리됐다. status polling endpoint(`GET /:id`·`GET /running`)는 조회이므로 GET 유지 — 본 task 는 export **생성** 메서드만 `GET`→`POST` 정정한다 (REQ-030 Export 자료 export 계약 정합).

## Required Reading

- `docs/architecture/api.md` L122~126 (UC-07 Export/Import/Backup 표) + L176 (UC-07 매핑 행) — 정정 대상 2 위치.
- `src/export/export.controller.ts` L69·L88·L80~101 — 실 박제된 endpoint surface(`@Controller("api/admin/export")` + `@Post()` create + `@Get("running")` + `@Get(":id")`). 문서를 코드 사실에 맞춘다.

## Acceptance Criteria

- [ ] `docs/architecture/api.md` L123 의 export job 생성 행 method 컬럼 `GET` → `POST` 정정. description 의 `scope query` 표현은 body DTO(`CreateExportDto.scope`) 로 옮겨졌으므로 자연스럽게 다듬되(예: `scope`(body) 또는 `CreateExportDto`), resource path(`/api/admin/export`) · audience(Admin+) · REQ 참조(REQ-032·REQ-030) 는 불변 유지.
- [ ] `docs/architecture/api.md` L176 (UC-07 매핑 행) 의 `GET /api/admin/export` → `POST /api/admin/export` 정정. 같은 행의 `POST /api/admin/import`·`POST /api/admin/backup`·`POST /api/admin/restore` 는 불변.
- [ ] status polling endpoint(`GET /api/admin/export/:id`·`GET /api/admin/export/running`)는 본 task 에서 **변경하지 않음** — 조회이므로 GET 정합. (현재 표에 별도 행이 없으면 행 신설은 본 task 범위 밖 — §Out of Scope.)
- [ ] 정정 후 표의 markdown 정렬(파이프 컬럼)이 깨지지 않음 — 육안 확인(파일 inspect).
- [ ] 분기 없음 — 본 task 는 doc 텍스트 2 위치 inline-amend 라 코드/test 변경 0. R-112 test 항목(happy/error/branch/negative)·`pnpm test` 는 doc-only direct commit 이므로 면제(CLAUDE.md §3.2 direct-mode doc-only commit 면제 조항).

## Out of Scope

- `src/` 코드 변경 0 — 본 task 는 api.md 문서만(ExportController 는 T-0488 merge 그대로).
- status polling endpoint(`GET /:id`·`GET /running`) 행 신설/변경 — 별도 follow-up(필요 시). 본 task 는 기존 export 생성 행 method 정정만.
- `POST /api/admin/import` 행 정정 0 — 이미 POST(정합), multipart 표현도 T-0489 merge 후 별도 검토 대상.
- `CreateExportDto` body schema 표 추가·request/response 예시 추가 — 본 task 는 method 1 글자 정정 + 그에 따른 description 자연화만, 신규 schema 문서화 아님.
- ADR / use-case / 다른 §의 export 언급 일괄 정정 — drift 이 확인된 §5 표 2 위치만(대량 일괄 grep-replace 금지, CLAUDE.md §12 호환).

## Suggested Sub-agents

(direct doc-only — driver 가 직접 Edit 수행. sub-agent dispatch 불요. 단 executor 경유 시 implementer 1 회로 충분.)

## Follow-ups

(생성 시 비움 — 발견 시 append.)

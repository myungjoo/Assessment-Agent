---
id: T-1827
title: api.md 에 shipped 된 collection-targets 5 route 를 doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-doc-sync
dependsOn: [T-1817]
touchesFiles:
  - docs/architecture/api.md
estimatedDiff: 90
estimatedFiles: 1
created: 2026-09-01
plannerNote: P5 / ADR-0059 §Follow-ups — 머지된 collection-targets 5 route 를 api.md §4·5·6 에 doc-sync (T-1826 reviewer MINOR)
---

# T-1827 — api.md 에 shipped 된 collection-targets 5 route 를 doc-sync

## Why

[T-1814](T-1814-collection-target-controller-get-routes.md) ~ [T-1817](T-1817-collection-target-controller-delete-route.md) 이 `CollectionTargetController` 의 5 route 를 main 에 머지했는데 [api.md](../architecture/api.md) 에는 `collection-target` 이 **0 건**이다 (`git grep -i collection-target -- docs/architecture/api.md` 실측 0). [T-1826](T-1826-admin-collection-target-create-form.md) 의 reviewer 가 이 누락을 MINOR finding 으로 지적했고, 해당 PR 은 `pr` 축이라 문서 축과 혼합할 수 없어 `Follow-ups` 로 이월된 부채다. api.md 는 `§ 5` 표가 endpoint contract 의 source 라고 스스로 선언하는 living document 이므로, 5 route 가 표에 없으면 이후 slice 가 계약을 문서가 아닌 코드에서 역추론하게 된다. 선례는 동형 doc-sync 인 [T-1757](T-1757-api-md-service-identity-routes-doc-sync.md) (ServiceIdentity nested 5 route) 이다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — `§ 4` prefix 표 · `§ 5` endpoint 표 (특히 82~86 행 ServiceIdentity 5 row 가 서술 밀도의 선례) · `§ 5` 끝 **합계** 문단 · `§ 6` 201 / 204 행
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — 5 route 의 method · path · guard · `@Roles` · 성공 status 정본 (route 별 주석이 근거를 이미 박제)
- [src/assessment-collection/dto/create-collection-target.dto.ts](../../src/assessment-collection/dto/create-collection-target.dto.ts) · [update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — body 필드와 400 계약
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` — route 표 · 권한 열 · 오류 표 (문서 서술의 근거 pointer)
- [docs/tasks/T-1757-api-md-service-identity-routes-doc-sync.md](T-1757-api-md-service-identity-routes-doc-sync.md) — 동형 doc-sync 선례 (합계 재계산 방식 포함)

## Acceptance Criteria

- [ ] `§ 5` endpoint 표에 `/api/collection-targets` group header row 1 개 + endpoint row **5 개** 를 추가한다. 각 row 는 method / path / 출처 / description / 권한 5 열을 채우고, 계약 사실은 controller 실코드와 일치해야 한다:
  - `GET /api/collection-targets` — 200 (`@Get` 기본값), row 0 개면 **빈 배열 200** (예외 아님), 권한 `User+`.
  - `GET /api/collection-targets/:id` — 200, row 부재는 service 가 `P2025` → 404, 권한 `User+`.
  - `POST /api/collection-targets` — **201** (`@Post` 기본값, `@HttpCode` 미부착), body `CreateCollectionTargetDto` 7 필드 (`type` · `instanceKey` · `endpoint` 필수 / `orgs` · `repos` · `spaces` · `active` optional), error 409 (동일 `(type, instanceKey)` `P2002`) / 400 (ValidationPipe `whitelist` + `forbidNonWhitelisted`), 권한 `Admin+`.
  - `PATCH /api/collection-targets/:id` — **200** (`@Patch` 기본값), body `UpdateCollectionTargetDto` 5 필드 전량 optional RFC-7396 merge patch (`{}` 도 200), 정체성 축 `type` · `instanceKey` 는 DTO 허용 축이 아니라 `forbidNonWhitelisted` 가 400, error 404 (`P2025`), 권한 `Admin+`.
  - `DELETE /api/collection-targets/:id` — **204** (`@HttpCode(204)` 명시, body 없음 — 일시 제외는 삭제가 아니라 `active=false` PATCH), error 404 (`P2025`), 권한 `Admin+`.
- [ ] 다섯 row 의 출처 열은 UC 가 아니라 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) 를 가리키고, group header 에 **9 UC `§5` sequence 호명이 0 건** 이며 본 route 군이 [PLAN.md](../PLAN.md) `130 행` 오너 지시 (REQ-070 · REQ-072 · REQ-073) 유래임을 한 줄로 박제한다.
- [ ] `§ 5` 끝 **합계** 문단을 재계산한다 — endpoint `77` → `82`, shipped `72` → `77`, resource prefix `16` → `17` (`/api/collection-targets` 는 nested sub-resource 가 아닌 **최상위 prefix** 라 `/api/persons/:personId/identities` 선례와 달리 prefix 를 1 늘린다). 늘어난 근거 (T-1814~T-1817 shipped, 본 task 박제) 를 기존 문장 형식대로 이어 적는다.
- [ ] `§ 4` prefix 표에 `/api/collection-targets` row 1 개를 추가한다 — 책임 module 은 `AssessmentCollectionModule`, 비고에 REQ-070 · REQ-072 · REQ-073 과 ADR-0059 pointer. (`§ 5` 합계의 prefix 17 과 정합.)
- [ ] `§ 6` **201 Created** 행을 갱신한다 — `실측 14 종` → `15 종`, `@Post 기본값 201 인 5 종` → `6 종` 이며 목록에 `POST /api/collection-targets` 추가.
- [ ] `§ 6` **204 No Content** 행을 갱신한다 — `실측 12 종` → `13 종`, `@Delete 11 종 전량` → `12 종 전량` 이며 목록에 `/api/collection-targets/:id` 추가.
- [ ] `git grep -c "collection-targets" docs/architecture/api.md` 가 **9 이상** (§4 1 + §5 header 1 + §5 5 row + §6 2) 을 반환한다.
- [ ] `pnpm lint:md` 또는 저장소의 markdown 검사 script 가 존재하면 통과한다. 존재하지 않으면 본 항목은 "해당 script 부재" 로 task 본문에 기록하고 생략한다.
- [ ] 표 이외 문단·다른 endpoint row 의 문구 변경 0 (`git diff --stat docs/architecture/api.md` 가 1 파일이고, `§ 4` / `§ 5` / `§ 6` 밖의 행이 바뀌지 않는다).

R-112 4 항목은 본 task 에 적용하지 않는다 — `commitMode: direct` doc-only 이며 코드 변경 0 이라 CLAUDE.md §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 에 해당한다. 분기 없음 — 해당 항목 생략.

## Out of Scope

- **코드 변경 금지** — `src/` · `test/` · `web/` 를 건드리지 않는다. 본 task 는 이미 머지된 계약을 문서에 옮기는 doc-sync 다.
- **REQ status 재판정 금지** — [requirements.md](../requirements.md) `89 행` REQ-070 · `91 행` REQ-072 · `92 행` REQ-073 의 `PLANNED` 를 손대지 않는다. 편집 축 UI (PATCH 폼 · DELETE 버튼) 가 아직 미완이고, 재판정은 CLAUDE.md §3.1 판정 규칙 6 대로 그 구현 arc 가 끝난 뒤 1 회만 한다.
- **PLAN.md `130 행` checkbox 변경 금지** — ADR-0059 가 "완료 선언 0" 을 명시했다.
- **다른 문서 동기 금지** — [modules.md](../architecture/modules.md) · [data-model.md](../architecture/data-model.md) · [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 는 본 slice 밖이다. 필요하면 `Follow-ups` 에 적는다.
- **`§ 7` UC cross-reference 표에 row 신설 금지** — 본 route 군을 호명하는 UC `§5` sequence step 이 없다. 없는 매핑을 만들지 않고, 그 사실만 `§ 5` group header 한 줄로 박제한다.
- **다른 endpoint row 의 서술 개선 금지** — 눈에 띄어도 본 diff 에 섞지 않는다.

## Suggested Sub-agents

`implementer` (문서 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

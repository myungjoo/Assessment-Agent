---
id: T-1823
title: CollectionTarget 오류 계약 5 행을 e2e 로 고정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-registration
dependsOn: [T-1817, T-1818, T-1819]
touchesFiles:
  - test/e2e/collection-targets.e2e-spec.ts
estimatedDiff: 330
estimatedFiles: 1
sizeExempt: true
exemptReason: "error-contract-indivisible — ADR-0059 §Decision 5 오류 표 a~e 5 행은 한 계약이고, 나눠 자르면 부트스트랩·seed 보일러플레이트 약 90 LOC 이 두 파일에 복제된다. 파일 수 1 개로 파일 cap 은 여유."
created: 2026-08-31
completed: 2026-08-31T10:57:33Z
plannerNote: "P5 / ADR-0059 §Follow-ups (d) — T-1819 격리 전제 머지 후 오류 표 5 행을 실 HTTP 로 고정하는 e2e 1 파일"
---

# T-1823 — CollectionTarget 오류 계약 5 행을 e2e 로 고정

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups` chain 의 **(d) 조각**이다. (a)~(c) 가 T-1808 ~ T-1818 로 전량 머지돼 `/api/collection-targets` 5 route 가 이미 서 있고, T-1819 가 `TRUNCATE_TABLES` 에 `"CollectionTarget"` 을 넣어 `@@unique([type, instanceKey])` 발 state leak 을 닫아 e2e 격리 전제까지 갖춰졌다. 지금까지의 검증은 전부 unit layer(controller spec 은 service 를 mock) 라, `§Decision 5` 오류 표 a~e 5 행이 **실 guard stack + 실 ValidationPipe + 실 PostgreSQL** 위에서 실제로 그 status 를 내는지는 아직 아무도 확인하지 않았다. 본 slice 가 그 5 행을 실 HTTP 로 못박아 REQ-070 / REQ-072 / REQ-073 의 API 축 회귀를 red 로 잡는다.

issue-still-relevant pre-check (`origin/main` tip `092ff2fb`): `test/e2e/collection-targets.e2e-spec.ts` **미존재**, `test/` 안에서 `CollectionTarget` 을 언급하는 파일은 `db-truncate.ts` · `db-truncate.spec.ts` · `prisma-schema.spec.ts` 3 건뿐이며 e2e 는 0 건이다. `CollectionTargetController` 는 `assessment-collection.module.ts` `93 행` 에 등록돼 있어 `createAuthenticatedE2EApp()` 이 띄우는 `AppModule` 에서 route 가 실제로 잡힌다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 5` (154~187 행) 의 route 표 5 행 + 오류 표 a~e 5 행. **본 task 의 assert 범위는 이 두 표가 전부다.**
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — `@Controller("api/collection-targets")` + controller-scope `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` + route 별 `@Roles` 등급.
- [src/assessment-collection/dto/create-collection-target.dto.ts](../../src/assessment-collection/dto/create-collection-target.dto.ts) · [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — 400 을 만드는 decorator 집합(`@IsIn` · `@IsNotEmpty` · `@MaxLength(255)` · `@ValidateIf` null 계약).
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) — `P2002` → 409 / `P2025` → 404 변환 지점.
- [test/e2e/permission-denied-records.e2e-spec.ts](../../test/e2e/permission-denied-records.e2e-spec.ts) — RBAC e2e 의 표준 골격(다중 actor seed · cookie · `afterEach(truncateAll)` · `afterAll(app.close)`). 본 spec 이 mirror 할 패턴.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` · `buildAuthCookie` · `AuthenticatedE2EContext` 계약.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `TRUNCATE_TABLES` 8 원소에 `"CollectionTarget"` 이 들어있음을 확인(T-1819).

## Acceptance Criteria

신규 파일 **`test/e2e/collection-targets.e2e-spec.ts` 1 개만** 추가한다. `src/` · `prisma/` · `package.json` · CI workflow 무변경.

- [ ] **happy-path** — `User` cookie 로 `GET /api/collection-targets` 200 + 빈 배열, `Admin` cookie 로 `POST` 201(생성된 row 의 `type` · `instanceKey` 반영) · 그 id 로 `GET /:id` 200 · `PATCH /:id` 200(부분 수정 반영) · `DELETE /:id` 204(body 없음) 각 1+ test. 5 route 성공 status 가 `§Decision 5` route 표와 일치함을 assert.
- [ ] **오류 행 a (401)** — cookie 부재 및 invalid JWT 각각에 대해 401. 조회 route 1 개 + 편집 route 1 개 이상에서 확인(guard 가 route 별로 붙어있음을 실증).
- [ ] **오류 행 b (403)** — `User` 등급 cookie 로 `POST` · `PATCH` · `DELETE` 3 route 각 403. 같은 cookie 로 `GET` 2 route 는 200 임을 대비 assert(등급 경계가 조회/편집으로 갈리는 분기 cover).
- [ ] **오류 행 c (409)** — 동일 `(type, instanceKey)` 재등록 시 409. 첫 `POST` 는 201 이고 두 번째만 409 임을 한 test 안에서 확인(`P2002` 변환 경로).
- [ ] **오류 행 d (404)** — 존재하지 않는 id 로 `GET /:id` · `PATCH /:id` · `DELETE /:id` 각 404. `DELETE` 직후 같은 id 재요청이 404 인 회귀 케이스 1+ 포함(`P2025` 변환 경로).
- [ ] **오류 행 e (400) — negative 충분 cover** — `type` 미허용 값 · `instanceKey` 빈 문자열 · 256 자 초과(`@MaxLength(255)` 경계) · 미정의 필드 포함(`forbidNonWhitelisted`) · 배열 필드에 문자열 아닌 원소 · `PATCH` body 의 명시적 `null`(T-1818 의 `@ValidateIf` 계약) 각 1+ test. 단일 400 만으로 끝내지 않는다.
- [ ] **분기 cover** — 위 항목이 곧 분기 cover 다: 조회 tier vs 편집 tier(`@Roles`), 목록 0 row vs N row, 신규 등록 vs 중복 등록, 존재 id vs 부재 id 각 분기 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 slice 는 `src/` 무변경이라 전역 coverage 수치 변동이 없어야 한다 — 떨어졌다면 무언가 잘못 건드린 것이다.
- [ ] `pnpm test:e2e` 로 본 spec 이 green (실 DB 필요 — 로컬에 `DATABASE_URL` 이 없으면 CI 의 `test:e2e` step 결과로 확인, `permission-denied-records.e2e-spec.ts` 헤더의 관례와 동일).
- [ ] spec 헤더 주석에 책임 경계(무엇을 assert 하고 무엇을 안 하는지) · ADR-0059 `§Decision 5` 참조 · R-113 cover 근거를 한국어로 명시.

## Out of Scope

- `src/` 의 어떤 파일도 고치지 않는다. e2e 가 red 를 내면 그 자체가 결함 발견이므로, **고치지 말고** BLOCKED 또는 Follow-ups 로 박제한 뒤 별도 slice 로 분리한다(본 slice 는 계약 고정 전용).
- `docs/architecture/api.md` · `docs/requirements.md` doc-sync — `§Follow-ups (f)` 소관이며 `direct` 라 본 `pr` slice 와 혼합 금지 (CLAUDE.md §3.1 규칙 3).
- REQ-070 / REQ-072 / REQ-073 status 재판정 — 위 (f) 에서 **구현 머지 후 1 회만** (CLAUDE.md §3.1 규칙 6).
- AdminView 등록·편집 패널(`§Follow-ups (e)`) · env 병합 배선(`§Follow-ups (g)`).
- `active=false` 의 수집 파이프라인 반영 여부 검증 — 배선 자체가 (g) 소관이라 본 e2e 는 row 의 저장/조회까지만 본다.
- smoke spec 신설 · 기존 e2e 파일 수정 · `db-truncate.ts` 재수정.
- T-1819 가 남긴 "`7 도메인 테이블`" stale 주석 정정 4 개 spec — 그 nit 은 별도 slice 로 계속 이월(파일 수 cap).

## Suggested Sub-agents

`tester → implementer` (본 slice 는 test 파일 1 개가 산출물 전부라 tester 가 주 작성자, implementer 는 spec 이 red 를 낼 때 원인 분류만 — 수정은 Out of Scope)

## Result

- **DONE** (2026-08-31T10:57:33Z) — [PR #1432](https://github.com/myungjoo/Assessment-Agent/pull/1432) squash 머지 → main `99a1ea54`.
- 신규 `test/e2e/collection-targets.e2e-spec.ts` 1 파일 `+454/-0`. `src/` · `prisma/` · `package.json` · CI workflow 무변경 — 전역 coverage 변동 0.
- ADR-0059 `§Decision 5` route 표 5 행 + 오류 표 a~e 5 행을 실 guard stack · 실 ValidationPipe · 실 PostgreSQL 위에서 고정. 400 negative 는 7 케이스(미허용 `type` · 빈 `instanceKey` · 256 자/255 자 경계 · 미정의 필드 · 배열 원소 type · `PATCH` 정체성 축 · 명시적 `null` vs 빈 `{}`).
- e2e red 0 — 오류 표 5 행이 실 코드 위에서 그대로 green 이라 `src/` 결함 발견 없음 (Out of Scope 의 "red 면 BLOCKED" 분기 미발동).
- 실측 454 LOC 이 `estimatedDiff` 330 을 상회했으나 `sizeExempt: true` 이며 파일 수 1 개로 파일 cap 여유. 초과분은 header 책임 경계 주석 + 400 negative 확장분.
- reviewer round 1 APPROVE (finding 0), 4-게이트 PASS, CI 전량 green (e2e step 포함).

## Follow-ups

(없음 — e2e red 0)

---
id: T-1757
title: Sync api.md with the shipped ServiceIdentity nested routes
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-078]
independentStream: service-identity-backend
dependsOn: [T-1756]
touchesFiles:
  - docs/architecture/api.md
estimatedDiff: 60
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (e) 전반 — 머지 완료된 identities 5 route 를 api.md § 5·6·7 에 doc-sync (drift 해소)
---

# T-1757 — api.md 를 머지된 ServiceIdentity nested 5 route 와 동기화

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` 의 (a) DTO+service · (b) controller+RBAC · (c) e2e chain 이 T-1739 ~ T-1756 으로 **전부 머지**됐다. 그런데 [api.md](../architecture/api.md) 에는 `identities` 문자열이 **0 hit** 이다 — 실제로 배선된 5 route 가 API 계약 문서에 한 줄도 없는 drift 상태다.

본 slice 는 `§Follow-ups (e)` 중 **api.md 축만** 절단해 그 drift 를 닫는다. (e) 가 함께 요구하는 `requirements.md` REQ-078 / REQ-079 status 재판정은 (d) AdminView UI 의 실측에 걸려 있어 **별도 slice** 로 분리한다 (본 task Out of Scope). api.md 는 `§ 5` 표에 route 를 더하는 것으로 끝나지 않고 `§ 6` 의 **실측 카운트** 3 지점과 `§ 7` UC-03 cell 까지 함께 움직여야 정합이 유지된다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — 본 slice 가 **유일하게 수정**할 파일.
  - `76 행` — `**UC-03 평가 대상 인원 (...)**` 그룹 헤더 행 (prefix 열거를 갱신할 자리).
  - `77~90 행` — UC-03 route 행들. 특히 `86 행` `GET /api/groups/:id/members` 가 **nested sub-resource 표기 선례**이고 `89 행` `PATCH /api/parts/:id` 가 오류 계약 (404 / 409 / 400) 서술 밀도의 선례다. 새 행은 이 두 행의 문체를 승계한다.
  - `165 행` (200 OK) · `166 행` (201 Created) · `168 행` (204 No Content) — 실측 카운트 3 지점.
  - `187 행` — `§ 7` 의 UC-03 cross-reference cell.
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표 5 행 (path · 성공 status · 권한 정본), `§Decision 2` (1 인원 1 primary invariant · 자동 승격 · 삭제 후 재승격), `§Decision 3` (PATCH 는 `externalId` 단일 축), `§Decision 4` (GET 은 `User`+ · 편집은 `Admin`+), `§Decision 5` (a ~ e 오류 계약 — Person 부재 404 / 타 Person 소유 **403 아닌 404** / `P2002` 409 / `P2025` 404), `§Decision 6` (`service` · `externalId` 형식 검증 → 400).
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `69 행` (`@Controller("api/persons/:personId/identities")`) 과 `86` · `105` · `127` · `151~152` · `181~182 행` 의 decorator — **성공 status 를 문서에 적기 전 실코드로 재확인**할 근거 (`@HttpCode` 명시 여부가 `§ 6` 카운트 분류를 가른다: create 는 `@Post()` 기본값 201, delete 는 명시 `@HttpCode(204)`, primary 는 명시 `@HttpCode(200)`).

## Acceptance Criteria

- [ ] `docs/architecture/api.md` **1 파일만** 수정한다 — 다른 문서 (`requirements.md` · `PLAN.md` · ADR-0058 본문) · 코드 · 테스트 변경 0.
- [ ] `§ 5` 의 UC-03 그룹에 **5 route 행**을 추가한다: `GET /api/persons/:personId/identities` (200, User+) · `POST` 같은 path (201, Admin+) · `PATCH /api/persons/:personId/identities/:identityId` (200, Admin+) · `DELETE` 같은 path (204, Admin+) · `POST /api/persons/:personId/identities/:identityId/primary` (200, Admin+). 각 행에 (i) 동작 요약, (ii) 오류 계약 (Person 부재 404 · 타 Person 소유 **404** · `P2002` 409 · `P2025` 404 · DTO 위반 400 중 해당 항목), (iii) 근거 pointer (ADR-0058 + 박제 task ID) 를 한국어로 적는다. 표기 관례는 `86 행` · `89 행` 을 승계한다.
- [ ] `76 행` 그룹 헤더의 prefix 열거에 `/api/persons/:personId/identities` 를 병기한다.
- [ ] `§ 6` 실측 카운트 3 지점을 **실코드 재확인 후** 갱신한다 — ① `165 행` 200 OK 의 "POST (action) 정본 실례" 목록에 primary 지정 route 를 더하고 개수를 재집계, ② `166 행` 201 Created 의 총 실측 개수와 "`@Post` 기본값 201" 하위 목록에 identities create 를 더해 재집계, ③ `168 행` 204 의 `@Delete` 전량 목록과 총 개수에 identities delete 를 더해 재집계. 각 개수는 `src/**/*.controller.ts` 를 실제로 grep 해 확인한 값이어야 하며, 추정으로 적지 않는다.
- [ ] `§ 7` `187 행` UC-03 cell 에 nested identities 5 route 를 병기하되, 계약 세부는 재생산하지 말고 `§ 5` 행으로 위임한다 (`UC-09` cell 의 위임 문체 선례).
- [ ] 문서에 적힌 성공 status · 권한 tier 가 [service-identity.controller.ts](../../src/user/service-identity.controller.ts) 의 실제 decorator 와 **한 건도 어긋나지 않음**을 완료 기록에 1 줄로 명시한다 (5 route × status/tier 대조).
- [ ] 범위 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) §12 의 `~` 규약을 따른다 (신규 표기분 한정, 기존 표기 전면 소급 치환 금지).
- [ ] `commitMode: direct` + production code 0 LOC 이므로 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / 분기 / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (코드 분기 0).

## Out of Scope

- `docs/requirements.md` 의 REQ-078 / REQ-079 status 재판정 — REQ-078 은 "API **와** Admin UI" 를 함께 요구해 `§Follow-ups (d)` UI 실측 없이는 `DONE` 판정이 불가하다. **별도 direct slice** 로 분리한다.
- `docs/PLAN.md` `132 행` 오너 지시 bullet 의 `[x]` 전환 · ADR-0058 본문의 완료 표기 — (d) · (e) 잔여가 남아 있어 완료 선언 금지 (ADR-0058 `§Decision` 의 "완료 선언 0" 조항).
- AdminView 편집 UI (`§Follow-ups (d)`) 와 `web/` 변경 일체.
- `src/**` · `test/**` 변경 — 문서가 코드와 어긋나면 문서를 코드에 맞추고, **코드가 틀렸다고 판단되면 고치지 말고** Follow-ups 에 적는다.
- api.md 의 다른 UC 그룹 · 기존 행의 문체 리팩터 · 표 재정렬 — diff 를 부풀리고 review 표면을 넓힌다.
- [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 신규 § 추가 — 본 slice 는 단순 doc-sync 라 audit 조문 신설 대상이 아니다.

## Suggested Sub-agents

`implementer`

## Follow-ups

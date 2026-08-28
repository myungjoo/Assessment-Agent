---
id: T-1758
title: Re-judge REQ-078 / REQ-079 status against the shipped ServiceIdentity API
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-078, REQ-079]
independentStream: service-identity-backend
dependsOn: [T-1757]
touchesFiles:
  - docs/requirements.md
estimatedDiff: 50
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (e) 잔여 — api.md 축(T-1757) 이후 남은 requirements.md REQ-078·079 status 재판정
---

# T-1758 — requirements.md 의 REQ-078 · REQ-079 상태를 shipped ServiceIdentity API 실측으로 재판정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (e)` 는 두 축 — **api.md 5 route 추가** 와 **REQ-078 / REQ-079 status 재판정** — 을 요구한다. 앞 축은 [T-1757](T-1757-api-md-service-identity-routes-doc-sync.md) 이 머지로 닫았고, 본 slice 는 **남은 requirements.md 축만** 절단한다. `§Follow-ups (a)~(c)` chain (T-1739~T-1756) 이 DTO · service · repository `update` · controller 5 route · e2e 까지 전부 main 에 올렸는데도 [requirements.md](../requirements.md) `97 행` 의 REQ-078 은 여전히 `PLANNED` 이고 구현 위치가 `P6 (PLAN 132 행)` 뿐이라, **shipped 된 API 축이 추적 표에서 0 hit** 인 drift 가 남아 있다 (PLAN 132 행 오너 지시 chain 의 실측 반영 누락).

REQ-078 은 "조회·추가·수정·삭제 API **와** Admin UI 제공" 이라는 2 축 요구다. API 축은 머지 완료, UI 축(`§Follow-ups (d)`) 은 미shipped 이므로 본 task 는 REQ-078 을 `DONE` 이 아니라 **`IN_PROGRESS` (축별 근거 병기)** 로 재판정한다. REQ-079 는 인원 추가/편집 동선 UI 라 여전히 `PLANNED` 이며, 그 판정 근거(무엇이 남았는지)만 명시한다.

## Required Reading

- [docs/requirements.md](../requirements.md) `1~20 행` (운영 룰 · 상태 enum · 7 컬럼 schema) 와 `97~98 행` (REQ-078 / REQ-079 행)
- [docs/requirements.md](../requirements.md) `22 행` (REQ-003) — 축별 근거를 병기한 `IN_PROGRESS` 서술의 선례 문체
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` (259~285 행) — (a)~(e) chain 및 (d) 미shipped 확인
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `69 행` (`@Controller("api/persons/:personId/identities")`) · `86 · 105 · 127 · 151 · 181 행` (5 route decorator) — 실코드 근거
- [docs/tasks/T-1757-api-md-service-identity-routes-doc-sync.md](T-1757-api-md-service-identity-routes-doc-sync.md) — 직전 slice 의 범위 (중복 회피)

## Acceptance Criteria

- [ ] `docs/requirements.md` 의 REQ-078 행 상태가 `PLANNED` → `IN_PROGRESS` 로 갱신되고, 괄호 근거에 **API 축 shipped / Admin UI 축 미shipped** 두 축이 각각 명시된다.
- [ ] REQ-078 근거 문장이 **실코드 좌표**를 인용한다 — 최소 `src/user/service-identity.controller.ts` 의 `@Controller("api/persons/:personId/identities")` 와 5 route(`@Get()` · `@Post()` · `@Patch(":identityId")` · `@Delete(":identityId")` · `@Post(":identityId/primary")`). 인용한 decorator 문자열은 `grep -n '@\(Get\|Post\|Patch\|Delete\|Controller\)(' src/user/service-identity.controller.ts` 결과와 문자 단위로 일치해야 한다.
- [ ] REQ-078 의 "구현 위치 (phase/task)" 컬럼에 shipped chain 의 task ID 가 comma 로 추가된다 (최소 `T-1739`(ADR) · 서비스/DTO 축 · controller 축 · e2e 축 대표 ID 를 포함하고, 남은 UI 축은 `P6 (PLAN 132 행)` 로 유지).
- [ ] REQ-079 행은 상태 `PLANNED` 를 **유지**하되, 근거로 "ADR-0058 §Follow-ups (d) AdminView 편집 UI 미shipped" 가 병기된다 (상태 토큰 자체는 바꾸지 않는다).
- [ ] 표의 7 컬럼 schema 가 깨지지 않는다 — `awk -F'|' 'NR>0 && /^\| REQ-07[89] /{print NF}' docs/requirements.md` 가 두 행 모두 다른 REQ 행과 동일한 필드 수를 출력한다.
- [ ] `git diff --stat` 결과가 `docs/requirements.md` 1 파일이며 diff ≤ 300 LOC.
- [ ] 상태 enum 은 `docs/requirements.md` `9 행` 이 정의한 5 값(`PLANNED` / `IN_PROGRESS` / `DONE` / `BLOCKED` / `SUPERSEDED`) 밖의 새 토큰을 만들지 않는다.

> 본 task 는 `commitMode: direct` 인 **doc-only** slice 라 코드 변경 0 이다 — CLAUDE.md §3.2 R-110 의 tester 의무는 direct-mode doc-only commit 면제 조항에 해당하며, R-112 4 항목(happy-path / error path / 분기 / negative)은 **추가되는 production symbol 이 0 이라 적용 대상 없음**. 대신 위 grep / awk 검증 항목이 문서 정합의 기계 검증을 대신한다.

## Out of Scope

- **코드 1 LOC 변경 금지** — `src/` · `test/` · `web/` · `prisma/` 어느 파일도 건드리지 않는다.
- **api.md 재수정 금지** — 5 route 표 · 카운트는 T-1757 이 이미 동기화했다. 오탈자가 보여도 Follow-ups 에만 적는다.
- **ADR-0058 본문 수정 금지** — `§Status` · `§Follow-ups` 항목의 완료 표기는 (d) 까지 끝난 뒤 별도 slice 가 판단한다.
- **PLAN.md 132 행 오너 지시 bullet 의 `[ ]` → `[x]` 승격 금지** — UI 축(REQ-079) 이 미shipped 라 bullet 완료 조건 미충족.
- **REQ-073 · REQ-023 ~ REQ-025 등 인접 행 재판정 금지** — 본 slice 는 REQ-078 / REQ-079 두 행만 손댄다.
- **다른 REQ 행의 일괄 status 감사 금지** — 표 전수 재판정은 별도 task.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

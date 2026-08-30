---
id: T-1802
title: 인원 추가/삭제/변경/Deactivate/Activate Web UI 배선 실측으로 REQ-071 재판정 + PLAN 130 행 인원 축 서술 갱신
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-071]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
independentStream: p6-assessment-target-admin
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P6 오너 지시 130 행 인원 축 — AdminView 인원 CRUD+active 는 shipped 인데 REQ-071 은 PLANNED drift (doc-only)"
---

# T-1802 — 인원 추가/삭제/변경/Deactivate/Activate Web UI 배선 실측으로 REQ-071 재판정 + PLAN 130 행 인원 축 서술 갱신

## Why

직전 4 fire ([T-1796](T-1796-requirements-req074-person-selector-rejudge.md) · [T-1795](T-1795-requirements-req075-narrative-rejudge.md) · [T-1797](T-1797-requirements-req076-score-scale-rejudge.md) · [T-1800](T-1800-requirements-req077-query-axis-rejudge.md)) 이 오너 지시 [PLAN](../PLAN.md) `131 행` (대시보드 실동작) 의 4 축을 재판정으로 닫고 [T-1801](T-1801-plan-131-dashboard-runtime-closure.md) 이 그 bullet 마커를 `[x]` 로 승격해, P6 에 남은 🔴 오너 지시는 `130 행` (평가 대상 추가·편집 인터페이스, R-164~R-168) 과 `133 행` (UI 기본기, R-187~R-191) 둘이다. 본 slice 는 PLAN 순서상 먼저인 `130 행` 을 착수하되, 그 4 축([requirements.md](../requirements.md) `89~92 행` REQ-070 ~ REQ-073) 중 **구현이 이미 shipped 인데 문서만 뒤처진 drift 축** 하나만 절단한다.

planner 가 본 fire 에서 `origin/main` (`35b7b438`) 을 직접 확인한 결과 `90 행` **REQ-071 (평가 대상 인원의 추가/삭제/변경/Deactivate/Activate 를 Web UI 에서 수행)** 이 그 축이다 — row 는 여전히 `PLANNED` 이고 근거 열이 `P6 (PLAN 130 행)` 뿐인데, backend 축은 [person.controller.ts](../../src/user/person.controller.ts) 가 `GET` · `GET :id` · `POST` · `PATCH :id` · `DELETE :id` 5 route 를 shipped 이고 ([update-person.dto.ts](../../src/user/dto/update-person.dto.ts) 의 `active?: boolean` 이 Deactivate/Activate 를 담당), web 축은 [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 생성 폼 · 인라인 수정 폼(활성/휴직 `<select>` 포함) · 삭제 콜백을 모두 배선해 mutation 러너 3 종(`handleCreatePerson` · `handleUpdatePerson` · `handleDeletePerson`)이 실제로 발사된다. 나머지 3 축(REQ-070 우산 · REQ-072 시스템 등록 · REQ-073 RBAC)은 실체 판단이 다르므로 본 slice 가 건드리지 않는다.

## Required Reading

- [docs/requirements.md](../requirements.md) `90 행` — REQ-071 row (재판정 대상). `93~96 행` REQ-074 ~ REQ-077 네 row 는 직전 재판정들이 쓴 판정 본문 **형식 참고용으로만** 읽는다
- [docs/PLAN.md](../PLAN.md) `130 행` — 오너 지시 bullet (R-164~R-168). 본문 중 "인원 축은 기존 AdminView 패널 재사용/노출 동선 개선 위주" 문장이 갱신 지점
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — `53 행` `@Get()` · `60 행` `@Get(":id")` · `68 행` `@Post()` · `81 행` `@Patch(":id")` · `91 행` `@Delete(":id")` (backend 5 route)
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — `43 행` `active?: boolean` (Deactivate/Activate 축의 계약 필드)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `132 행` `PERSONS_PATH`, `2967 행` `buildPersonPatch`(`active` 명시 비교 분기), `3692 행` `handleCreatePerson`, `3770 행` `handleDeletePerson`, `3973 행` `handleUpdatePerson`, `5525 행~` 인원 관리 섹션(생성 폼 2 input · 인라인 수정 폼 3 controlled input), `5598~5608 행` 활성/휴직 `<select>`, `5633 행` `<PersonList>` 마운트(`onDelete`)
- [web/src/views/AdminView.person-create-contract.test.ts](../../web/src/views/AdminView.person-create-contract.test.ts) · [AdminView.person-update-contract.test.ts](../../web/src/views/AdminView.person-update-contract.test.ts) (`139 행`·`204~220 행` 이 `active` 매핑을 고정) · [AdminView.person-delete-contract.test.ts](../../web/src/views/AdminView.person-delete-contract.test.ts) · [AdminView.persons-list-contract.test.ts](../../web/src/views/AdminView.persons-list-contract.test.ts) — web 축 검증 실체
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — backend 축 검증 실체 (검증 위치 열 판정 입력)
- [docs/tasks/T-1800-requirements-req077-query-axis-rejudge.md](T-1800-requirements-req077-query-axis-rejudge.md) — 직전 동형 재판정 slice 의 판정 본문 · 근거 열 표기 형식

## Acceptance Criteria

- [ ] [requirements.md](../requirements.md) `90 행` REQ-071 의 status 를 실측 결과에 따라 재판정한다 — **5 동작 축(추가 · 삭제 · 변경 · Deactivate · Activate)이 모두 Web UI 에서 발사 가능하면 `DONE`**, 그중 하나라도 UI 진입점이 없으면 `IN_PROGRESS` 로 두고 잔여를 판정 본문에 명시한다. 판정은 반드시 `origin/main` 을 직접 열어 확인한 결과로만 내린다 (planner 가 위에 적은 행 번호를 그대로 베끼지 말고 재확인한 좌표로 적을 것).
- [ ] 판정 본문에 **backend 축**(controller 5 route + `UpdatePersonDto.active`) 과 **web 축**(생성 폼 → `handleCreatePerson` / 인라인 수정 폼 + 활성·휴직 `<select>` → `buildPersonPatch` → `handleUpdatePerson` / `PersonList` `onDelete` → `handleDeletePerson`) 두 축의 실제 파일·행 좌표를 근거로 박는다 (`93~96 행` 판정 본문과 같은 형식).
- [ ] Deactivate/Activate 축이 **soft delete 의미로 실제 왕복하는지** 한 겹 확인한다 — `buildPersonPatch` 가 `active` 를 falsy 체크가 아닌 명시 비교로 다뤄 `false` 도 patch 에 실리는지, 그리고 목록 조회(`GET /api/persons`)가 비활성 인원을 어떻게 다루는지(활성만 반환하면 휴직 처리 후 목록에서 사라져 **재활성(Activate) 진입점이 사라지는지**)를 확인하고, 진입점이 없으면 그 사실을 잔여로 적고 `IN_PROGRESS` 를 택한다. 이 확인 결과는 판정 본문에 한 줄로 남긴다.
- [ ] 같은 row 의 근거 열(현재 `P6 (PLAN 130 행)` 만 있음)에 shipped slice 를 `93~96 행` 과 같은 표기로 추가한다 — 축별 slice ID 는 `git log --oneline --grep "T-114"` 등으로 실제 확인해 적고(planner 사전 확인: 생성 `T-1143` · 삭제 `T-1144` · 수정 `T-1145` 로 보이나 **검증 후 기입**), 확인되지 않는 ID 는 적지 않는다.
- [ ] 검증 위치 열(`e2e`)이 실측과 맞는지 확인한다 — backend 축은 [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 가 supertest 로 존재하고 web 축은 colocated vitest 4 개뿐이므로, 실측대로 `unit + e2e` 로 정정하거나 `e2e` 유지 근거를 판정 본문에 한 줄로 남긴다 (직전 4 slice 가 모두 `e2e` → `unit` 으로 정정한 선례가 있으나 본 REQ 는 backend e2e 실체가 있으므로 **베끼지 말고 실측으로 결정**).
- [ ] [PLAN.md](../PLAN.md) `130 행` 의 인원 축 서술("인원 축은 기존 AdminView 패널 재사용/노출 동선 개선 위주")을 shipped 사실에 맞게 갱신한다 — REQ-071 재판정 참조(`90 행`) + 근거 slice 를 문장 1~2 개로 덧붙이고, 잔여가 REQ-070 · REQ-072 · REQ-073 임을 같은 문장에서 분명히 한다.
- [ ] `git diff --stat` 결과가 `docs/requirements.md` · `docs/PLAN.md` **2 파일** 뿐이고 코드 변경 0 이다.
- [ ] `python -c "import json,io; json.load(io.open('docs/STATE.json',encoding='utf-8'))"` 로 STATE 무결성이 깨지지 않았음을 확인한다 (본 task 는 STATE 를 건드리지 않지만 driver bookkeeping 전 검증).
- [ ] 분기 없음 · 코드 변경 0 인 doc-only task 이므로 R-112 4 항목(happy-path / error path / 분기 cover / negative cases)은 **적용 대상 아님** — CLAUDE.md §3.2 의 direct-mode doc-only 면제 조항에 해당한다. tester 미호출이 정당한 사유를 commit trail 의 `notes` 에 한 줄로 남긴다.

## Out of Scope

- `src/` · `web/` · `test/` 아래 **어떤 코드·spec 도 수정 금지** — 본 slice 는 문서 재판정 전용이다. 실측 중 결함(예: 휴직 인원 재활성 진입점 부재)이 보이면 고치지 말고 Follow-ups 에 적는다.
- `89 행` REQ-070 (빈 상태 우산 축) · `91 행` REQ-072 (평가 대상 시스템 등록·편집) · `92 행` REQ-073 (RBAC) 재판정 — 각각 별도 slice 소관이며, 특히 REQ-072 는 모델·API·UI 신설 판단이 필요해 architect ADR 선행 대상이다.
- [PLAN.md](../PLAN.md) `130 행` bullet 의 마커 `[ ]` → `[x]` 승격 — 위 3 축이 잔여이므로 승격 금지.
- [PLAN.md](../PLAN.md) `133 행` (UI 기본기, REQ-080 ~ REQ-084) 관련 서술 일체.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 동기 ([T-1800](T-1800-requirements-req077-query-axis-rejudge.md) Follow-up 소관 — 별도 slice).
- 새 ADR 작성, `docs/architecture/*` 갱신, requirements.md 의 다른 REQ row 일괄 점검.

## Suggested Sub-agents

`implementer` (doc-only 단일 편집 — architect · tester 불요)

## Follow-ups

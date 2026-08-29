---
id: T-1779
title: Re-judge REQ-078 / REQ-079 against the shipped ServiceIdentity Admin UI axis
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-078, REQ-079]
independentStream: service-identity-doc-sync
dependsOn: [T-1758, T-1778]
touchesFiles:
  - docs/requirements.md
estimatedDiff: 70
estimatedFiles: 1
created: 2026-08-29
plannerNote: P5 / ADR-0058 §Follow-ups (e) 마감 — (d) UI 축 shipped 실측으로 REQ-078·079 status 재판정 (doc-only)
---

# T-1779 — shipped 된 ServiceIdentity Admin UI 축 실측으로 REQ-078 · REQ-079 재판정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (e)` 는 "REQ-078 / REQ-079 status 를 (a) ~ (d) 실측에 맞춰 재판정" 하라고 요구한다. [T-1757](T-1757-api-md-service-identity-routes-doc-sync.md) 이 api.md 5 route 축을, [T-1758](T-1758-requirements-req078-service-identity-status-rejudge.md) 이 **API 축만 shipped 이던 시점의** REQ-078 재판정을 닫았고, 그 이후 `§Follow-ups (d)` AdminView 편집 UI 축이 [T-1759](T-1759-web-service-identity-api-client-read.md) ~ [T-1778](T-1778-service-identity-admin-gating.md) chain 으로 전부 머지됐다 (조회 select · 목록 · 추가 폼 · 수정 폼 · 행 액션 3 종 · Admin+ RBAC gating).

그런데 [requirements.md](../requirements.md) `97 행` 의 REQ-078 은 여전히 "Admin UI 축 미shipped" 를 근거로 `IN_PROGRESS` 이고, `98 행` 의 REQ-079 는 "`web/src` 에 UI 0 건" 을 근거로 `PLANNED` 이다 — **머지된 사실과 추적 표가 어긋난 drift** 다. 본 slice 는 그 두 행만 실측 좌표로 재판정해 `§Follow-ups (e)` 를 마감한다. 코드 변경 0 · doc-only 이므로 `commitMode: direct`.

## Required Reading

- [docs/requirements.md](../requirements.md) `1~12 행` (운영 룰 · 상태 enum · 7 컬럼 schema) 와 `97~98 행` (REQ-078 / REQ-079 행 본문)
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups` (259~285 행) — (d) · (e) 범위
- [docs/tasks/T-1758-requirements-req078-service-identity-status-rejudge.md](T-1758-requirements-req078-service-identity-status-rejudge.md) — 직전 재판정 slice 의 문체 · 범위 (중복 회피)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `5480~5515 행` (인원 생성 폼) · `5586~5660 행` (service identity 조회 select · 목록 · 추가 폼 · 수정 폼 · 행 액션 slot 마운트) — REQ-079 "이어서 입력" 판정의 실측 근거
- [docs/tasks/T-1778-service-identity-admin-gating.md](T-1778-service-identity-admin-gating.md) — UI 축 마지막 slice (Admin+ gating) 범위 확인

## Acceptance Criteria

- [x] `docs/requirements.md` REQ-078 행의 근거가 **Admin UI 축 shipped** 사실로 갱신되고, 상태 토큰이 두 축(API · Admin UI) 실측에 맞게 재판정된다 (두 축 모두 shipped 로 확인되면 `DONE`, 잔여가 있으면 `IN_PROGRESS` 유지 + 잔여 명시). 상태를 무엇으로 정하든 **근거 문장이 그 판정의 축별 이유를 명시**해야 한다.
- [x] REQ-078 근거가 **실코드 좌표**를 인용한다 — 최소 `web/src/views/AdminView.tsx` 의 service identity 패널 (조회 select · `ServiceIdentityList` · `ServiceIdentityAddForm` · `ServiceIdentityEditForm` · `renderRowActions`) 심볼명을 포함하고, `grep -n "ServiceIdentityAddForm\|ServiceIdentityEditForm\|renderRowActions" web/src/views/AdminView.tsx` 결과와 심볼 문자열이 일치한다.
- [x] REQ-078 의 "구현 위치" 컬럼에 UI 축 chain 대표 task ID (`T-1759` ~ `T-1778` 범위 중 최소 client · 목록 · 추가 · 수정 · 행 액션 · gating 대표 ID) 가 comma 로 추가된다.
- [x] REQ-079 행이 재판정된다 — 판정 기준을 근거에 명시한다: **인원 추가 폼(`5480~5515 행`) 과 service identity 패널(`5586 행` ~) 이 같은 AdminView 안에 있으나 identity 입력은 전용 인원 select 를 경유**한다는 사실을 적고, 그 동선이 REQ-079 의 "이어서 입력 가능" 을 충족하면 `DONE`, 별도 패널 경유가 잔여라고 판단하면 `IN_PROGRESS` + 잔여 한 줄. 어느 쪽이든 **근거 없이 토큰만 바꾸지 않는다**.
- [x] 표의 7 컬럼 schema 가 깨지지 않는다 — `awk -F'|' '/^\| REQ-07[89] /{print NF}' docs/requirements.md` 가 두 행 모두 인접 REQ 행과 동일한 필드 수를 출력한다.
- [x] 상태 enum 은 `docs/requirements.md` `9 행` 이 정의한 5 값(`PLANNED` / `IN_PROGRESS` / `DONE` / `BLOCKED` / `SUPERSEDED`) 밖의 새 토큰을 만들지 않는다.
- [x] `git diff --stat` 결과가 `docs/requirements.md` 1 파일이며 diff ≤ 300 LOC.

> 본 task 는 `commitMode: direct` **doc-only** slice 다 — 추가되는 production symbol 이 0 이라 CLAUDE.md §3.2 R-112 4 항목(happy-path / error path / 분기 cover / negative cases)은 **적용 대상 없음** 이고, R-110 tester 의무도 direct-mode doc-only 면제 조항에 해당한다. 대신 위 grep / awk / `git diff --stat` 검증 항목이 문서 정합의 기계 검증을 대신한다.

## Out of Scope

- **코드 1 LOC 변경 금지** — `src/` · `web/` · `test/` · `prisma/` 어느 파일도 건드리지 않는다.
- **api.md 재수정 금지** — 5 route 표는 T-1757 이 이미 동기화했다.
- **ADR-0058 본문 (`§Status` · `§Follow-ups` 완료 표기) 수정 금지** — (d) · (e) closure 표기는 별도 slice 로 판단한다 (Follow-ups 에 적는다).
- **PLAN.md bullet 승격 금지** — PLAN 의 오너 지시 bullet `[ ]` → `[x]` 전환은 본 slice 범위 밖.
- **REQ-078 · REQ-079 이외 행 재판정 금지** — 인접 REQ 나 표 전수 감사는 별도 task.
- **web 코드 결함이 보여도 고치지 않는다** — Follow-ups 에만 적는다.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect · tester 불요)

## Follow-ups

- **ADR-0058 `§Follow-ups (d)·(e)` closure 표기 slice** — (d) `AdminView 편집 UI` 와 (e) doc-sync 가 실제로 모두 마감됐으므로 ADR 본문의 열린 항목 표기를 닫는 별도 direct slice 가 필요하다 (본 slice 는 Out of Scope 로 ADR 본문 수정을 금지했다).
- **REQ-079 동선 연결 slice** — `web/src/views/AdminView.tsx` 의 `handleCreatePerson` (`3652 행`) 성공 후 방금 만든 인원을 `setSelectedIdentityPersonId` 로 identity 대상에 자동 연결 (또는 추가 폼에 매핑 입력 통합) 하고, REQ-079 의 검증 위치인 e2e 로 그 연속 동선을 고정한다. 이 slice 가 머지되면 REQ-079 를 다시 `DONE` 후보로 재판정한다.

## 완료 기록

- **Status: DONE** — 2026-08-29T09:44Z, direct commit `7d38a33b` (main).
- 결과: `docs/requirements.md` 1 파일 `+2/-2`. REQ-078 은 API 축 (5 route) + Admin UI 축 (조회 select `5591 행` · `ServiceIdentityList` `5606 행` · `renderRowActions` `5610 행` · `ServiceIdentityAddForm` `5622 행` · `ServiceIdentityEditForm` `5645 행` · `ServiceIdentityRowActions` 삭제 `106 행` / primary `111 행`) 두 축이 모두 shipped 임을 실측 좌표로 박고 `IN_PROGRESS` → `DONE` 승격, 구현 위치에 UI chain 대표 task ID (T-1759 ~ T-1778) 를 추가했다. REQ-079 는 인원 추가 폼과 identity 패널이 같은 AdminView 섹션에 있어 "이름 / email 만 입력 가능" 금지 조건은 해소됐으나 `setSelectedIdentityPersonId` 호출처가 `handleIdentityPersonChange` 하나뿐이라 인원 생성 후 대상 자동 연결이 없다는 잔여를 근거로 `PLANNED` → `IN_PROGRESS` 재판정했다. 7 컬럼 schema 유지 (awk 필드수 9, 인접 행 동일) · 상태 enum 5 값 내.

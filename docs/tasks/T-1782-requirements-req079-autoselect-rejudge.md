---
id: T-1782
title: Re-judge REQ-079 against the shipped person create/update identity autoselect wiring
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-079]
independentStream: service-identity-doc-sync
dependsOn: [T-1780, T-1781]
touchesFiles:
  - docs/requirements.md
estimatedDiff: 40
estimatedFiles: 1
created: 2026-08-29
completedAt: 2026-08-29T12:45Z
plannerNote: P5 / ADR-0058 §Follow-ups (e) 잔여 — T-1780·T-1781 동선 연결 shipped 실측으로 REQ-079 재판정 (doc-only)
---

# T-1782 — 인원 생성 · 수정 후 identity 대상 자동 선택 shipped 실측으로 REQ-079 재판정

## Why

[T-1779](T-1779-service-identity-req-rejudge-ui-axis.md) 는 REQ-078 을 `DONE` 으로 승격하면서 REQ-079 는 "인원 생성 · 수정 동선이 방금 다룬 인원을 identity 대상으로 잇지 않는다" 를 유일한 잔여 근거로 `PLANNED` → `IN_PROGRESS` 로 재판정했다. 그 잔여 (1) 은 이후 [T-1780](T-1780-person-create-identity-target-autoselect.md) (생성 축 `onCreated`) 과 [T-1781](T-1781-person-update-identity-target-autoselect.md) (수정 축 `onUpdated`) 두 PR 이 머지되며 **실제로 해소** 됐는데, [requirements.md](../requirements.md) `98 행` 의 REQ-079 근거 문장은 여전히 "`setSelectedIdentityPersonId` 호출처가 `handleIdentityPersonChange` 하나뿐" 이라고 적혀 있다 — 머지된 사실과 추적 표가 어긋난 drift 다.

본 slice 는 그 한 행만 실측 좌표로 재판정해 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (e)` 의 REQ-079 축을 닫는다. 코드 변경 0 · doc-only 이므로 `commitMode: direct`.

## Required Reading

- [docs/requirements.md](../requirements.md) `1~12 행` (운영 룰 · 상태 enum · 검증 위치 enum · 7 컬럼 schema) 와 `97~98 행` (REQ-078 / REQ-079 행 본문 — REQ-078 은 문체 참고용, 수정 대상 아님)
- [docs/tasks/T-1779-service-identity-req-rejudge-ui-axis.md](T-1779-service-identity-req-rejudge-ui-axis.md) `## 완료 기록` — 직전 재판정이 남긴 REQ-079 잔여 (1) · (2) 정의
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 실측 좌표 — `1702 행` (`onCreated?: (personId: string) => void`) · `1709 행` (`extractCreatedPersonId`) · `1766~1768 행` (생성 성공 분기의 콜백 호출) · `3013 행` (`onUpdated?`) · `3066 행` (`deps.onUpdated?.(id.trim())`) · `3454 행` (`setSelectedIdentityPersonId` 선언) · `3716 행` (생성 배선) · `3999 행` (수정 배선)
- [web/src/views/AdminView.person-create-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-create-identity-autoselect.test.tsx) 와 [web/src/views/AdminView.person-update-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-update-identity-autoselect.test.tsx) — 두 동선의 **실제 검증 실체** (검증 위치 컬럼 판정 근거)
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)·(e)` (약 `276~285 행`) — 본 slice 가 닫는 범위 경계

## Acceptance Criteria

- [x] `docs/requirements.md` 의 REQ-079 행 (`98 행`) 근거가 **동선 연결 shipped** 사실로 갱신된다 — 최소 `onCreated` · `onUpdated` · `setSelectedIdentityPersonId` 세 심볼명을 인용하고, `grep -n "onCreated?:\|onUpdated?:\|setSelectedIdentityPersonId" web/src/views/AdminView.tsx` 결과와 인용 심볼 문자열이 일치한다.
- [x] 상태 토큰이 실측에 맞게 재판정된다 — T-1779 가 적은 잔여 (1) (생성 · 수정 후 자동 연결) 이 해소됐음을 근거로 `DONE` 으로 승격하거나, 잔여 (2) (본 REQ 의 검증 위치인 `e2e` 로 연속 동선 고정) 를 아직 미충족으로 판단하면 `IN_PROGRESS` 를 유지하고 **잔여를 한 줄로 명시** 한다. 어느 쪽이든 **근거 없이 토큰만 바꾸지 않는다** — 판정 문장이 (1) · (2) 각각의 충족 / 미충족 이유를 적어야 한다.
- [x] 잔여 (2) 판정 시 **현재 shipped 된 검증 실체를 사실대로 적는다** — 두 동선은 backend supertest e2e 가 아니라 web colocated spec (`AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx`) 으로 고정돼 있다. 검증 위치 컬럼을 바꿀 경우 `docs/requirements.md` `10 행` 의 검증 위치 enum (`unit` / `smoke` / `e2e` / `perf` / `policy` / `manual` / `n/a`) 밖의 새 토큰을 만들지 않는다.
- [x] REQ-079 의 "구현 위치" 컬럼에 동선 연결 slice ID `T-1780`, `T-1781` 이 comma 로 추가된다 (`grep -c "T-1780" docs/requirements.md` ≥ 1).
- [x] 상태 enum 은 `docs/requirements.md` `9 행` 이 정의한 5 값 (`PLANNED` / `IN_PROGRESS` / `DONE` / `BLOCKED` / `SUPERSEDED`) 밖의 새 토큰을 만들지 않는다.
- [x] 표의 7 컬럼 schema 가 깨지지 않는다 — `awk -F'|' '/^\| REQ-079 /{print NF}' docs/requirements.md` 가 인접 REQ 행 (`REQ-078` · `REQ-080`) 과 동일한 필드 수를 출력한다.
- [x] `git diff --stat` 결과가 `docs/requirements.md` 1 파일이며 diff ≤ 300 LOC.

> 본 task 는 `commitMode: direct` **doc-only** slice 다 — 추가되는 production symbol 이 0 이라 CLAUDE.md §3.2 R-112 4 항목 (happy-path / error path / 분기 cover / negative cases 충분 cover) 은 **적용 대상 없음** 이고, R-110 tester 의무도 direct-mode doc-only 면제 조항에 해당한다. 대신 위 grep / awk / `git diff --stat` 검증 항목이 문서 정합의 기계 검증을 대신한다.

## Out of Scope

- **코드 1 LOC 변경 금지** — `src/` · `web/` · `test/` · `prisma/` 어느 파일도 건드리지 않는다. e2e spec 신설도 본 slice 밖이다 (필요하다고 판단되면 Follow-ups 에만 적는다).
- **REQ-078 행 재수정 금지** — T-1779 가 이미 `DONE` 으로 재판정했다.
- **ADR-0058 본문 수정 금지** — `§Status` · `§Follow-ups (d)·(e)` 의 closure 표기는 별도 direct slice 다.
- **api.md 수정 금지** — 5 route 표는 T-1757 이 동기화했다.
- **PLAN.md bullet 승격 금지** — 오너 지시 bullet `[ ]` → `[x]` 전환은 본 slice 범위 밖.
- **REQ-079 이외 행 재판정 · 표 전수 감사 금지**.
- **web 코드 결함이 보여도 고치지 않는다** — Follow-ups 에만 적는다.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect · tester 불요)

## 완료 기록

- **DONE** 2026-08-29T12:45Z — direct commit `5b0b748c` (main). `docs/requirements.md` 1 파일 `+1/-1`, 코드 0 LOC.
- REQ-079 행의 잔여 2 개를 축별로 재판정했다. **잔여 (1) 동선 연결 = 해소** — `web/src/views/AdminView.tsx` `1702 행` `onCreated?: (personId: string) => void;` · `1766 행` `extractCreatedPersonId(created)` · `1768 행` `deps.onCreated?.(createdId);` (T-1780) 과 `3013 행` `onUpdated?: (personId: string) => void;` · `3066 행` `deps.onUpdated?.(id.trim());` (T-1781), 그리고 배선처 `3716 행` · `3999 행` 의 `setSelectedIdentityPersonId(personId)` 를 실측 인용해, "`setSelectedIdentityPersonId` 호출처가 `handleIdentityPersonChange` (현 `3458 행`) 하나뿐" 이라던 T-1779 시점 근거가 더 이상 사실이 아님을 박제했다.
- **잔여 (2) e2e 연속 동선 고정 = 미충족** — shipped 검증 실체가 `web/src/views/AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx` 두 web colocated spec 이고 `test/e2e/service-identities.e2e-spec.ts` 는 identity API 5 route 만 덮는다. 따라서 상태 토큰은 `IN_PROGRESS` 유지, 검증 위치는 실측대로 `e2e` → `unit + e2e` 로 적었다 (enum 밖 신규 토큰 0).
- 구현 위치 컬럼에 `T-1780` · `T-1781` 추가. 상태 enum 5 값 · 7 컬럼 schema 유지. doc-only direct 라 R-110 tester 의무 · R-112 4 항목은 적용 대상 없음.

## Follow-ups

- REQ-079 잔여 (2) — 인원 생성 · 수정 → identity 매핑 **연속 동선을 e2e 로 고정** 하는 slice (본 slice 범위 밖, 별도 pr-mode task).
- [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Status` · `§Follow-ups (d)·(e)` closure 표기 direct doc slice.

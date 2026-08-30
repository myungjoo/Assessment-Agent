---
id: T-1805
title: Activate(재활성) UI 진입점 shipped 실측으로 REQ-071 DONE 재판정 + PLAN 130 행 인원 축 서술 갱신
phase: P6
status: DONE
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
plannerNote: "P6 오너 지시 PLAN 130 행 인원 축 — T-1803+T-1804 로 Activate 진입점 shipped, REQ-071 IN_PROGRESS drift 해소 (doc-only)"
---

# T-1805 — Activate(재활성) UI 진입점 shipped 실측으로 REQ-071 DONE 재판정 + PLAN 130 행 인원 축 서술 갱신

## Why

[PLAN.md](../PLAN.md) `130 행` 오너 지시 (평가 대상 추가·편집 인터페이스, R-164~R-168) 의 인원 축은 [T-1802](T-1802-requirements-req071-person-crud-rejudge.md) 재판정 시점에 "4/5 shipped + **Activate(재활성) UI 진입점 1 건** 잔여" 였다. 그 잔여를 backend 축 [T-1803](T-1803-person-list-include-inactive-query.md) (`GET /api/persons?includeInactive=true`, PR #1417) 과 web 소비 축 [T-1804](T-1804-adminview-include-inactive-toggle.md) (AdminView 휴직 포함 토글, PR #1418) 이 연속으로 닫았으므로, 문서만 옛 사실에 머물러 있다.

본 slice 는 **코드를 고치지 않고 문서 판정만 실측에 맞춘다** — [requirements.md](../requirements.md) `90 행` REQ-071 을 `IN_PROGRESS` → `DONE` 으로 재판정하고, [PLAN.md](../PLAN.md) `130 행` 의 "인원 축 4/5 shipped + Activate 잔여" 서술을 5/5 로 갱신한다. 판정을 미루면 shipped 된 기능이 미완으로 남아 다음 planner 가 이미 닫힌 잔여를 다시 큐잉할 위험이 있다.

## Required Reading

- [docs/requirements.md](../requirements.md) `90 행` — REQ-071 row 전체 (`IN_PROGRESS` 판정 본문 + 근거 열 + 검증 위치 열).
- [docs/PLAN.md](../PLAN.md) `130 행` — 오너 지시 bullet "평가 대상 추가·편집 인터페이스 (R-164~R-168)" 의 인원 축 서술.
- [docs/tasks/T-1803-person-list-include-inactive-query.md](T-1803-person-list-include-inactive-query.md) — backend query 축 결과 요약.
- [docs/tasks/T-1804-adminview-include-inactive-toggle.md](T-1804-adminview-include-inactive-toggle.md) — web 토글 축 결과 요약.
- `src/user/person.controller.ts` 의 `@Get()` 핸들러 — `@Query("includeInactive")` 분기 실측 (행 번호는 직접 확인).
- `web/src/views/AdminView.tsx` `812~830 행` (`buildPersonsPath` 의 optional `includeInactive` 인자) · `3459~3471 행` (`personsIncludeInactive` state + `personsPath` useMemo) · `5568~5580 행` (인원 관리 섹션 controlled checkbox).

## Acceptance Criteria

- [ ] 먼저 **실측 확인** 후 판정한다 — `git grep -n "includeInactive" -- src/user/person.controller.ts web/src/views/AdminView.tsx` 로 backend query 분기와 web 토글 배선이 origin/main 에 실제로 존재함을 확인하고, 그 확인 결과를 근거 열에 행 좌표와 함께 기입한다 (추정 금지).
- [ ] [docs/requirements.md](../requirements.md) `90 행` REQ-071 의 status 를 `IN_PROGRESS` → `DONE` 으로 바꾼다. 판정 본문은 "5 동작 축 (추가 · 삭제 · 변경 · Deactivate · **Activate**) 이 모두 Web UI 에서 발사된다" 로 갱신하고, 옛 "Activate 축의 UI 진입점이 0" 서술과 "잔여 = Activate(재활성) UI 진입점 1 건" 문장을 **삭제** 한다 (사실이 아닌 문장을 남기지 않는다).
- [ ] 같은 row 의 근거 열에 `Activate 진입점 축 shipped — T-1803(backend query), T-1804(web 토글)` 을 추가한다. 기존 shipped slice 나열은 보존한다.
- [ ] Activate 왕복 경로를 근거 본문에 한 겹으로 명시한다 — 토글 체크 → `buildPersonsPath(nonce, true)` 가 `includeInactive=true` 를 실어 조회 → 휴직 인원이 목록에 노출 → 기존 인라인 수정 폼의 활성·휴직 `<select>` → `PATCH /api/persons/:id` `{active:true}`. 즉 **재활성 자체는 전용 route 가 아니라 기존 PATCH 축** 임을 명시한다.
- [ ] 검증 위치 열은 `unit + e2e` 를 유지하되, web 축 검증 실체에 `web/src/views/AdminView.persons-include-inactive.test.tsx` 를 추가한다 (T-1804 신규 spec). 새 e2e 를 만들지 않았으므로 e2e 표기를 늘리지 않는다.
- [ ] [docs/PLAN.md](../PLAN.md) `130 행` bullet 의 인원 축 서술을 "**2026-08-30 재판정 결과 4/5 shipped** … 남은 것은 Activate(재활성) UI 진입점 1 건 뿐이다" → "인원 축 5/5 shipped" 로 갱신하고, 근거로 T-1803 · T-1804 링크와 REQ-071 `DONE` 을 건다.
- [ ] [docs/PLAN.md](../PLAN.md) `130 행` bullet 의 마커는 **`[ ]` 유지** — 같은 bullet 의 잔여인 `89 행` REQ-070 (빈 상태 우산) 과 `91 행` REQ-072 (평가 대상 시스템 등록·편집) 가 아직 닫히지 않았기 때문이다. 그 잔여를 bullet 본문에 명시적으로 남긴다.
- [ ] 변경 파일은 정확히 2 개 (`docs/requirements.md`, `docs/PLAN.md`). 코드 변경 0 LOC.
- [ ] `git diff --stat` 으로 두 파일 외 변경이 없음을 확인한다.
- [ ] 행 좌표 표기는 [CLAUDE.md §12](../../CLAUDE.md) 의 범위 표기 규약을 따른다 (`~` 구분자, 단일 행은 `90 행`, `L` prefix 금지).

## Out of Scope

- **코드 변경 일절 금지** — `src/` · `web/` · `test/` 어느 파일도 건드리지 않는다 (본 task 는 `commitMode: direct` doc-only).
- **[api.md](../architecture/api.md) `?includeInactive` query 계약 동기** — `GET /api/persons` row 에 query 축을 반영하는 작업은 별도 doc-only `direct` slice (Follow-ups 참조). 본 task 에서 api.md 를 수정하면 파일 수가 늘고 판정과 계약 동기가 한 commit 에 섞인다.
- **REQ-070 · REQ-072 · REQ-073 재판정** — 각각 별도 row 소관. 본 task 는 REQ-071 row 와 PLAN 인원 축 서술만 만진다.
- **PLAN `130 행` bullet 을 `[x]` 로 승격** — 잔여 REQ 가 남아 금지.
- **다른 REQ row 의 검증 위치 열 일괄 정정** — 본 row 외 손대지 않는다.
- 신규 spec / e2e 추가 (doc-only task 이므로 test 코드 0).

## Suggested Sub-agents

`implementer → tester` (tester 는 doc-only 이므로 실행 대상이 없다 — `git diff --stat` 로 파일 범위와 코드 0 LOC 만 확인).

## Follow-ups

- [api.md](../architecture/api.md) `GET /api/persons` row 에 `?includeInactive=true` query 계약 동기 (doc-only `direct`, T-1803 Follow-ups 승계).

## 완료 기록

- **완료 시각**: 2026-08-30T12:46Z (direct commit `710c9824`)
- **결과 요약**: `docs/requirements.md` `90 행` REQ-071 을 `IN_PROGRESS` → `DONE` 으로 재판정했다. 5 동작 축(추가 · 삭제 · 변경 · Deactivate · Activate) 전량이 Web UI 에서 발사됨을 원본 소스 좌표로 실측 확인했고 — backend 는 `src/user/person.controller.ts` `71~73 행` 의 `includeInactive === "true"` 분기, web 은 `web/src/views/AdminView.tsx` `813 행` `buildPersonsPath` optional 인자 · `3462 행` `personsIncludeInactive` state · `5574~5581 행` 토글 checkbox · `5649 행` 활성 여부 `<select>` — Activate 왕복 경로(토글 → `?includeInactive=true` 조회 → 인라인 수정 폼 select → `PATCH {active:true}`)가 전용 route 없이 성립함을 한 겹 명시했다. `docs/PLAN.md` `130 행` 인원 축 서술은 4/5 → 5/5 로 갱신하되 잔여 REQ-070 · REQ-072 · REQ-073 이 남아 bullet 마커 `[ ]` 는 유지했다. 변경 정확히 2 파일 · `+2/-2`, 코드 0 LOC.

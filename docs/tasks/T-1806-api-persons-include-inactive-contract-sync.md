---
id: T-1806
title: api.md 77 행 GET /api/persons 의 ?includeInactive query 계약 동기 + stale group filter 표기 정정
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-026, REQ-071]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-08-30
independentStream: p6-assessment-target-admin
dependsOn: []
touchesFiles:
  - docs/architecture/api.md
plannerNote: "P6 인원 축 잔여 doc-sync — T-1803 이 shipped 한 ?includeInactive 계약이 api.md 77 행에 미반영 (doc-only inline-amend)"
---

# T-1806 — api.md 77 행 `GET /api/persons` 의 `?includeInactive` query 계약 동기 + stale group filter 표기 정정

## Why

[T-1803](T-1803-person-list-include-inactive-query.md) (PR #1417) 이 `GET /api/persons` 에 `?includeInactive=true` query 분기를 shipped 했고 [T-1805](T-1805-requirements-req071-activate-rejudge.md) 가 REQ-071 을 `DONE` 으로 재판정했지만, endpoint 계약의 정본인 [api.md](../architecture/api.md) `§ 5` 표 `77 행` 은 여전히 "평가 대상 인원 목록 (active filter / group filter 가능)" 이라는 옛 표기에 머물러 있다 — 두 task 가 모두 Follow-up 으로 남긴 잔여다.

이 표기는 두 가지가 틀렸다. ① 실제 계약은 "default 는 활성 인원만, `?includeInactive=true` (정확히 `"true"`) 일 때만 휴직 포함 전량" 인데 그 판정 어휘·default 가 전혀 적혀 있지 않다. ② `group filter` 는 controller·service 어디에도 없는 **미구현 표기** 다 (`src/user/person.controller.ts` 의 `@Get()` 은 `@Query("includeInactive")` 단일, `person.service.ts` 는 `findActive` / `findAll` 2 경로뿐). 계약 정본이 shipped 아닌 필터를 "가능" 이라 적어두면 web 소비자와 다음 slice 가 없는 기능을 전제하게 된다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) `77 행` — `GET /api/persons` row 전체 (설명 열 · 권한 열). 인접 `80 행` (PATCH row 의 `active` 서술) 이 표기 톤의 선례.
- [docs/architecture/api.md](../architecture/api.md) `146 행` — `GET /api/permission-denied-records` row 의 `query param ... 필터` 표기. **본 task 가 따를 query 계약 서술 선례**.
- [docs/architecture/api.md](../architecture/api.md) `158 행` — `§ 5` 표 합계 문단 (endpoint 77 / prefix 16 / shipped 72).
- `src/user/person.controller.ts` 의 `@Get()` 핸들러와 그 위 주석 — `includeInactive === "true"` 판정 어휘, `"1"` · `"yes"` 를 받지 않는 이유, 별도 DTO class 를 두지 않는 이유 (행 번호는 직접 확인).
- `src/user/person.service.ts` 의 `findActive` / `findAll` — 두 분기의 반환 범위.
- [docs/tasks/T-1803-person-list-include-inactive-query.md](T-1803-person-list-include-inactive-query.md) — backend query 축 결과 요약.

## Acceptance Criteria

- [ ] 먼저 **실측 확인** 후 서술한다 — `git grep -n "includeInactive" -- src/user/person.controller.ts` 로 query 분기가 origin/main 에 존재함을, `git grep -n "group" -- src/user/person.controller.ts src/user/person.service.ts` 로 group filter 가 **부재** 함을 각각 확인하고 그 결과에 근거해서만 표기를 고친다 (추정 금지).
- [ ] [api.md](../architecture/api.md) `77 행` 설명 열에 `?includeInactive` query 계약을 박제한다 — (a) **default (query 부재)** 는 활성 인원만 (`service.findActive`), (b) **`?includeInactive=true`** 일 때만 휴직 포함 전량 (`service.findAll`), (c) 판정 어휘는 **정확히 문자열 `"true"`** 이며 `"1"` · `"yes"` 같은 값은 default 동작을 유지한다는 점, (d) 근거 slice `T-1803` (PR #1417) 표기.
- [ ] 같은 행의 stale 표기 `group filter 가능` 을 **삭제** 하거나 "미구현" 으로 명시 정정한다 — shipped 아닌 필터를 "가능" 으로 남기지 않는다. `active filter` 표기는 위 `?includeInactive` 서술로 대체한다.
- [ ] `158 행` 합계 문단의 endpoint `77` / prefix `16` / shipped `72` 숫자는 **불변** 으로 유지한다 (query param 추가는 endpoint 신설이 아니다). 숫자를 건드리지 않았음을 `git diff` 로 확인한다.
- [ ] 표 구조 (`|` 열 수 · 열 순서 · 권한 열 `User+`) 를 깨뜨리지 않는다 — `git diff docs/architecture/api.md` 로 `77 행` 외 다른 행이 변경되지 않았음을 확인한다.
- [ ] 행 범위 표기는 [CLAUDE.md §12](../../CLAUDE.md) 의 범위 좌표 규약을 따른다 (물결 `~` 하나, `L` prefix 금지, 단일 행은 `77 행`).
- [ ] 본 task 는 doc-only `direct` — `src/` · `web/` · `test/` 파일을 하나도 건드리지 않는다 (`git status` 로 확인).

## Out of Scope

- backend 코드 변경 일체 — `includeInactive` 판정 어휘 확장 (`"1"` · `"yes"` 수용), DTO class 도입, group filter **신규 구현** 은 모두 금지. 본 task 는 이미 shipped 된 사실의 문서화만 한다.
- `web/` 변경 일체 — AdminView 토글은 [T-1804](T-1804-adminview-include-inactive-toggle.md) 로 이미 shipped.
- [UC-03](../use-cases/UC-03-person-crud.md) 본문 갱신 — 필요하면 Follow-up 으로.
- `§ 5` 표의 다른 endpoint 행 정정 · 합계 재집계 — 다른 stale 표기를 발견해도 본 PR 에서 고치지 않고 Follow-ups 에 적는다.
- [requirements.md](../requirements.md) · [PLAN.md](../PLAN.md) 재판정 — [T-1805](T-1805-requirements-req071-activate-rejudge.md) 에서 이미 완료.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 inline-amend — architect · tester 불요, direct-mode 라 [CLAUDE.md §3.2](../../CLAUDE.md) R-110 면제)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 인접 작업 발견 시 여기에 append)

## 완료 기록

- **완료 시각**: 2026-08-30T13:44Z (direct commit `ecc19661`)
- **결과 요약**: [api.md](../architecture/api.md) `77 행` `GET /api/persons` 설명 열 한 줄만 교체했다 (`1 파일 +1/-1`, 코드 0 LOC). 실측 근거로 `src/user/person.controller.ts` 의 `@Query("includeInactive")` 분기 (`69~71 행`, `includeInactive === "true"` 단일 등가 비교) 존재와 group 축 query 의 전역 부재 (controller · service 0 hit) 를 각각 확인한 뒤에만 서술했다. 박제 내용은 (a) default (query 미전달) 는 `PersonService.findActive` 로 활성 인원만, (b) `?includeInactive=true` 일 때만 `PersonService.findAll` 로 휴직 포함 전량, (c) 판정 어휘가 **정확히 문자열 `"true"`** 라 `"1"` · `"yes"` · `"TRUE"` 변형은 모두 default 동작을 유지한다는 점, (d) 근거 slice `T-1803` (PR #1417) 네 겹이다. 동시에 shipped 아닌 `group filter 가능` 옛 표기를 **미구현** 으로 명시 정정해 web 소비자와 다음 slice 가 없는 기능을 전제하지 않게 했다. `158 행` 합계 (endpoint 77 / prefix 16 / shipped 72) 와 표 구조 (5 열 · 권한 열 `User+ (조회)`) 는 불변, `77 행` 외 다른 행 변경 0.

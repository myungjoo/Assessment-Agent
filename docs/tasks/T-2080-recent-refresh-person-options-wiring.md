---
id: T-2080
title: 최근 N일 재수집 ⑫ — 전체 인원을 고를 수 있게 하고 패널에 결과 · 비활성을 배선한다
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-11-02
independentStream: recent-refresh
dependsOn: [T-2079]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx, web/src/views/useAdminSchedule.ts, web/src/views/useAdminSchedule.test.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑫. 설계 결정은 T-2069. 인원 옵션이 실환경에서 항상 빔
---

# T-2080 — 인원 옵션 · 패널 배선

## Why

T-2069 arc 의 ⑫ 조각이다 (README `74 행`). 두 결함이 남아 있어 Admin 이 재수집을 끝까지 쓸 수 없다.

1. **인원을 고를 수 없다.** `personOptions` 는 `deriveMembers` 파생인데, 이 helper 는 그룹 응답의 `members` · `persons` 를 읽는다. `GET /api/groups` 는 `GroupRepository.findMany` 의 plain row 라 두 필드가 없어 실환경에서 옵션이 항상 비고, spec 은 fixture 에 `members` 를 넣어 통과한다.
2. **결과가 보이지 않는다.** T-2079 가 올린 `reevalResult` 와 T-2077 의 `result` · `triggerDisabled` props 가 `AdminView.tsx` 에서 연결돼 있지 않다.

issue-still-relevant 확인: origin/main `591513fc` 의 `AdminView.tsx` `1328 행` 패널 호출에 두 props 가 없고, `useAdminSchedule.ts` `167 행` 이 `personOptions = members` 다.

## Required Reading

- T-2069 "설계 결정", T-2079 Follow-ups 의 "T-2080 확인 사항".
- `web/src/views/useAdminSchedule.ts` (`33 행` ~ `51 행`, `145 행` ~ `223 행`), colocated spec `web/src/views/useAdminSchedule.test.ts`.
- `web/src/views/AdminView.tsx` (`586 행` `personData`, `797 행`, `869 행` ~ `896 행`, `1305 행` ~ `1335 행`), colocated spec `web/src/views/AdminView.test.tsx` (`4548 행` 이후 describe).
- `web/src/components/ReEvaluationTriggerPanel.tsx` props, `web/src/components/PersonList.tsx` `PersonRow` (`15 행`).

## Acceptance Criteria

인원 옵션:

- [ ] `useAdminSchedule` 의 `members` 인자를 `persons: PersonRow[] | undefined` 로 바꾸고, `personOptions` 는 `{ id, name: fullName }` 파생이다. `AdminView` 는 `personData` 를 넘긴다. 그룹 선택 없이 전체 인원이 옵션에 나온다.
- [ ] `persons` 가 `undefined` (조회 전 · 실패) 면 옵션은 빈 배열이고 throw 하지 않는다.

패널 배선:

- [ ] `AdminView` 가 패널에 `result={reevalResult}` 와 `triggerDisabled` 를 넘긴다. `triggerDisabled` 는 `selectedPersonId` 가 빈 값일 때 true 다.
- [ ] 인원을 바꾸면 `reevalResult` · `reevalError` 를 비운다 (다른 인원의 결과가 남지 않는다).
- [ ] 진행 중 (`reevalSubmitting`) 에는 인원 `<select>` 가 비활성이다. 결과가 시작한 인원의 것임을 보장한다.

주석 · 문구:

- [ ] `AdminView.tsx` 의 "15 심볼" 주석을 실제 수로 맞추고, `1305 행` ~ `1308 행` · `1321 행` ~ `1327 행` 주석을 실제 동작 (전체 인원, `{ days }` body, 결과 표시) 으로 고친다. `useAdminSchedule.ts` `165 행` 주석도 같이 고친다.

R-112 (spec 위치: 위 colocated 두 파일):

- [ ] Happy-path: `personOptions` 파생 · 전체 인원 옵션 렌더 · `result` 표시 · 선택 인원으로 POST 발사 각 1+.
- [ ] Error path: `persons` 조회 실패 (`undefined`) 에서 옵션이 비고 패널이 throw 없이 렌더된다. 1+.
- [ ] 분기: 인원 선택 / 미선택의 버튼 활성 · 비활성, 인원 변경 시 비움 / 미변경 시 유지, `<select>` 진행 중 / 대기 각 1+.
- [ ] Negative (예외 분기마다 1+, test 이름은 `_n` 으로 끝남): 빈 인원 배열, 빈 값으로 되돌린 인원 선택, 미선택에서 트리거 시 POST 미발사.
- [ ] 그룹 응답에 `members` 가 없어도 (실 API shape) 인원 옵션이 나오는 test 1+. fixture 가 결함을 가리지 않게 한다.
- [ ] 기존 `AdminView` spec 중 그룹 `members` fixture 로 인원 옵션을 검증하던 test 를 `personData` 기반으로 옮긴다. 그룹 멤버 패널 test 는 건드리지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` · web test · build green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), PR CI green.

## Out of Scope

- 휴직 인원 제외. 옵션은 인원 관리 목록과 같은 `personData` 를 그대로 쓴다.
- 토글로 목록에서 사라진 선택 인원의 재검증.
- `useAdminMemberships` 의 `members` 반환 · `deriveMembers` 제거 (파일 cap 초과 — 사용처 없는 helper 제거는 T-2082).
- unmount 시 조회 취소 · 결과 재조회 경로 · `runReEvaluate` 해제 통합 (T-2079 Follow-ups).
- `instants` 제거 (T-2081). backend 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

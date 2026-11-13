---
id: T-2084
title: 최근 N일 재수집 ⑭-b2 — 입력 결함 filter 의 instants 주석과 spec 예시 message 를 현재 TypeError 출처로 바꾼다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 25
estimatedFiles: 2
created: 2026-11-10
independentStream: recent-refresh
dependsOn: [T-2083]
touchesFiles: [src/scheduling/recent-deletion-input-exception.filter.ts, src/scheduling/recent-deletion-input-exception.filter.spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭-b2. T-2083 Follow-up. filter 의 죽은 instants 설명 정리
---

# T-2084 — filter 의 instants 주석 · spec 예시 message 정리

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 중 ⑭-b2 조각이다 (README `74 행`, R-74 / REQ-041). T-2081 이 요청 본문에서 `instants` 를 지우고 T-2083 이 `selectInDeletionWindow` 를 삭제했으므로, `RecentDeletionInputExceptionFilter` 가 받는 `TypeError` 는 더 이상 "instants 비-배열 · 원소 Invalid Date" 에서 오지 않는다. 지금 남은 출처는 `buildRecentDeletionWindow` 의 `reference` 비-Date / Invalid Date (`src/scheduling/recent-deletion-window.ts` `45 행` ~ `47 행`) 와 `planRecentRefresh` 의 Invalid `now` (`src/scheduling/recent-deletion-coordinates.ts` `68 행` ~ `69 행`) 다. filter 주석과 spec 이 없는 경로를 예시로 들고 있어 읽는 사람을 오도한다.

issue-still-relevant 확인 (origin/main `2402d4b0`): `git grep -n "instants\|selectInDeletionWindow" -- src/scheduling/recent-deletion-input-exception.filter.ts src/scheduling/recent-deletion-input-exception.filter.spec.ts` 가 filter `16 행` · `58 행`, spec `71 행` · `72 행` · `76 행` · `81 행` 을 돌려준다. 두 파일의 마지막 변경은 T-1965 (`9ecc7736`) 뿐이라 이미 고쳐진 적이 없다.

TypeError → 400 분기 자체는 `reference` / `now` 경로로 계속 쓰이므로 **동작은 바꾸지 않는다**.

## Required Reading

- `src/scheduling/recent-deletion-input-exception.filter.ts` 전체 (63 줄).
- `src/scheduling/recent-deletion-input-exception.filter.spec.ts` `60 행` ~ `85 행` (colocated spec — TypeError 분기 test).
- `src/scheduling/recent-deletion-window.ts` `40 행` ~ `56 행` (TypeError 출처 1).
- `src/scheduling/recent-deletion-coordinates.ts` `60 행` ~ `70 행` (TypeError 출처 2).
- `docs/tasks/T-2083-recent-refresh-remove-window-select.md` 의 Out of Scope · Follow-ups.

## Acceptance Criteria

변경:

- [ ] `src/scheduling/recent-deletion-input-exception.filter.ts` `16 행` 의 분기 (3) 설명을 실제 출처로 바꾼다 — 예: `(3) TypeError (reference 비-Date · Invalid Date, now Invalid Date) → 400.` `instants` 단어를 남기지 않는다.
- [ ] 같은 파일 `58 행` 주석 `days 범위·instants 형식 결함` 을 `days 범위 · 기준 시각 형식 결함` 처럼 현재 입력에 맞게 고친다. 코드 (분기 조건 · message 조립) 는 바꾸지 않는다.
- [ ] `src/scheduling/recent-deletion-input-exception.filter.spec.ts` 의 TypeError test (`71 행` ~ `82 행`) 의 주석 · `it` 문자열 · 예시 message 를 실제 출처로 바꾼다 — 예: `new TypeError("planRecentRefresh: 유효한 now 가 필요합니다")` 를 던지고 400 + body 에 `유효한 now` 포함을 검증한다. 검증하는 분기 (TypeError → 400) 는 그대로다.
- [ ] `git grep -n "instants" -- src/scheduling/recent-deletion-input-exception.filter.ts src/scheduling/recent-deletion-input-exception.filter.spec.ts` 결과가 0 줄이고, `git grep -n "selectInDeletionWindow\|deletion-window-select\|recent-deletion-plan" -- src test` 결과도 0 줄이다 (web 은 ⑭-c 범위라 제외). 다른 파일의 `instants` (import 복원 helper, DTO · controller · e2e 의 "제거된 필드 거부" 회귀 test) 는 의도된 현재 사용이라 건드리지 않는다.

R-112 (신규 / 변경 public symbol 없음 — 주석과 기존 test 의 예시 입력만 바꾼다):

- [ ] Happy-path: 기존 RangeError → 400, HttpException passthrough test 가 수정 없이 green.
- [ ] Error path / 분기: TypeError → 400 분기 test 1 개가 새 예시 message 로 green (분기 cover 유지). unknown → 500 test 가 수정 없이 green.
- [ ] Negative: 신규 분기가 없으므로 새 negative test 는 쓰지 않는다 (분기 없음 — 이 항목 생략). 기존 빈 message · 비-문자열 message test 가 수정 없이 green 인지 확인한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), PR CI green (unit · smoke · e2e).

## Out of Scope

- filter 의 분기 조건 · status 매핑 · message 조립 변경.
- `src/scheduling/recent-deletion-window.ts` · `recent-deletion-coordinates.ts` 의 throw 종류 · 문구 변경.
- `web/src/views/AdminView.recent-deletion-contract.test.ts` `10 행` 주석, `useAdminMemberships` 의 `members` / `deriveMembers` 정리 (⑭-c, pr).
- `docs/architecture/api.md` `170 행` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` · `docs/architecture/modules.md` `42 행` doc-sync (⑭-d, direct).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각 (planner 가 순서대로 큐잉): ⑭-c web contract test 주석 · `useAdminMemberships` `members` / `deriveMembers` 정리 (pr) → ⑭-d api.md · UC-06 · modules.md doc-sync (direct).

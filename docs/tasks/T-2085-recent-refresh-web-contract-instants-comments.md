---
id: T-2085
title: 최근 N일 재수집 ⑭-c1 — web 재평가 계약 guard spec 의 instants 설명과 예시 입력을 현재 DTO 에 맞춘다
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-11-12
independentStream: recent-refresh
dependsOn: [T-2084]
touchesFiles: [web/src/views/AdminView.recent-deletion-contract.test.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭-c1. T-2084 Follow-up ⑭-c 를 파일 cap 때문에 둘로 나눈 첫 조각
---

# T-2085 — web 재평가 계약 guard spec 의 instants 설명 정리

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 중 web 조각이다 (README `74 행`, R-74 / REQ-041). T-2081 이 `RecentDeletionDto` 에서 `instants` 를 지웠고 (현재 `src/scheduling/dto/recent-deletion.dto.ts` 는 `days?` 하나뿐), 같은 spec 의 happy-path test (`227 행` ~ `231 행`) 도 이미 "필수 필드 없음 · days optional" 을 단언한다. 그런데 파일 머리 주석 (`10 행`) 은 아직 `@Body{instants 필수/days optional}` 을, 추출기 주석 (`43 행`) 은 `instants!` 를 예로 들고, 추출 실패 test (`194 행`) 와 path drift test (`282 행`) 는 없어진 필드명을 예시 입력으로 쓴다. 읽는 사람이 `instants` 가 아직 계약의 일부라고 오해한다.

⑭-c 를 나눈 이유: `useAdminMemberships` 의 `members` 반환 · `deriveMembers` 제거까지 함께 하면 `adminMembershipDerivations.ts` · `adminMembershipDerivations.test.ts` · `useAdminMemberships.ts` · `AdminView.tsx` · `AdminView.test.tsx` 에 본 파일까지 6 파일로 5 파일 상한을 넘는다. 그 정리는 ⑭-c2 로 넘긴다.

issue-still-relevant 확인 (origin/main `4756a75d`): `git grep -n "instants" -- web/src` 가 본 파일 `10 행` · `43 행` · `194 행` · `282 행` 4 줄만 돌려준다. 본 파일의 마지막 변경은 T-2079 (`91252e0c`) 이고 이 4 줄은 손대지 않았다.

## Required Reading

- `web/src/views/AdminView.recent-deletion-contract.test.ts` `1 행` ~ `60 행` (머리 주석 · `extractDtoFields`), `180 행` ~ `235 행` (추출 실패 test · body 정합 happy-path), `275 행` ~ `300 행` (path · DTO drift negative test).
- `src/scheduling/dto/recent-deletion.dto.ts` 전체 (16 줄 — 현재 계약 정본).
- `docs/tasks/T-2084-recent-refresh-filter-instants-comments.md` 의 Out of Scope · Follow-ups.

## Acceptance Criteria

변경 (본 파일 1 개만):

- [ ] `10 행` 의 판별 축 설명을 현재 계약으로 바꾼다 — 예: `@Body{필수 필드 없음 · days optional}`. `instants` 단어를 남기지 않는다.
- [ ] `43 행` 의 추출기 주석 예시를 `instants!` 대신 일반 표기로 바꾼다 — 예: `required(name!/표기 없음)/optional(days?)`. 추출기 코드는 바꾸지 않는다.
- [ ] `194 행` 추출 실패 test 의 `bodyKeys: new Set(['instants'])` 를 현재 web 이 보내는 키 (`days`) 로 바꾼다. 기대값 `['backend 계약 추출 실패']` 는 그대로다.
- [ ] `282 행` path drift negative case 의 label · subPath 에서 `instants` 를 다른 임의 세그먼트로 바꾼다 — 예: `recent-deletion/:personId/extra`. 단언 (`path 불일치`) 은 그대로다.
- [ ] `git grep -n "instants" -- web/src` 결과가 0 줄이다.

R-112 (신규 / 변경 public symbol 없음 — 주석과 기존 test 의 예시 입력만 바꾼다):

- [ ] Happy-path: body 정합 test (`227 행` ~) 와 route 합성 test 가 수정 없이 green.
- [ ] Error path / 분기: 추출 실패 test 가 새 `bodyKeys` 로 `backend 계약 추출 실패` 를 그대로 내고 green. path drift `it.each` 4 case 가 모두 `path 불일치` 로 green (분기 cover 유지).
- [ ] Negative: 신규 분기가 없으므로 새 negative test 는 쓰지 않는다 (분기 없음 — 이 항목 생략). 기존 DTO drift (`295 행` · `296 행`) · 형제 base 혼동 negative test 가 수정 없이 green 인지 확인한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, web `vitest` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), PR CI green (unit · smoke · e2e).

## Out of Scope

- 본 spec 의 추출기 · `diffContract` 로직, describe / it 구조 변경.
- `useAdminMemberships` 의 `members` 반환 · `deriveMembers` (`adminMembershipDerivations.ts`) 제거와 그 test 정리 (⑭-c2, pr).
- `GroupList` 의 `members` / `persons` 멤버 수 표시 — 현재 쓰이는 기능이라 대상 아님.
- `docs/architecture/api.md` `170 행` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` · `docs/architecture/modules.md` `42 행` doc-sync (⑭-d, direct).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각 (planner 가 순서대로 큐잉): ⑭-c2 `useAdminMemberships` 의 `members` 반환 제거 + `deriveMembers` 삭제 — `web/src/views/adminMembershipDerivations.ts` (함수 · export) · `adminMembershipDerivations.test.ts` (`deriveMembers` describe · re-export 단언) · `useAdminMemberships.ts` (`members` useMemo · 반환 · 머리 주석) · `AdminView.tsx` (`98 행` import · `1854 행` re-export · `14 행` ~ `15 행` · `793 행` 주석) · `AdminView.test.tsx` (`428 행` ~ `466 행` `deriveMembers` test) 5 파일 (pr) → ⑭-d api.md · UC-06 · modules.md doc-sync (direct).

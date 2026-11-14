---
id: T-2086
title: 최근 N일 재수집 ⑭-c2a — useAdminMemberships 반환에서 쓰이지 않는 members 파생을 뺀다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-11-14
independentStream: recent-refresh
dependsOn: [T-2085]
touchesFiles: [web/src/views/useAdminMemberships.ts, web/src/views/useAdminMemberships.test.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭-c2a. ⑭-c2 가 6 파일이라 hook 2 파일 / 삭제 4 파일로 재분할한 첫 조각
---

# T-2086 — useAdminMemberships 반환에서 members 파생 제거

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 중 web 조각이다 (README `74 행`, R-74 / REQ-041). T-2080 부터 재평가 인원 옵션은 `personData` 에서 파생하므로, `useAdminMemberships` 가 돌려주는 `members` (client-side `deriveMembers` 파생) 를 쓰는 곳이 없다. AdminView 는 이 hook 에서 9 심볼만 꺼내 쓰고 `members` 는 꺼내지 않는다 (`web/src/views/AdminView.tsx` `790 행` ~ `804 행`). `useAdminSchedule.ts` 에도 `members` 참조가 없다. 그런데 hook 은 여전히 `members` 를 계산해 반환하고, 머리 주석은 "`useAdminSchedule` 의 `members` 주입" 이 소비처라고 적고 있다.

재분할 이유: T-2085 Follow-up 은 ⑭-c2 를 5 파일로 잡았지만 `web/src/views/useAdminMemberships.test.ts` 도 `members` 를 단언한다 (`RETURN_KEYS` `80 행`, 파생 단언 `309 행` · `540 행` · `628 행` · `705 행` · `718 행`). 그래서 ⑭-c2 는 6 파일이고 5 파일 상한을 넘는다. 본 task (⑭-c2a) 는 hook 과 그 spec 2 파일만 다룬다. `deriveMembers` 함수 삭제는 ⑭-c2b 로 넘긴다. 본 task 가 끝나면 `deriveMembers` 를 production 에서 부르는 곳이 사라지므로 ⑭-c2b 에서 함수를 지울 수 있다.

issue-still-relevant 확인 (origin/main `caa21fee`): `useAdminMemberships.ts` `59 행` ~ `62 행` 에 `members` useMemo 가 있고, `166 행` 에서 반환한다. 오너가 직접 머지한 `caa21fee` (PR #1641, cohort-statistics API) 는 `src/user/*` · `docs/architecture/api.md` 만 바꿨고 web 멤버십 축은 건드리지 않았다. 따라서 본 방향과 충돌하지 않는다.

## Required Reading

- `web/src/views/useAdminMemberships.ts` 전체 (178 줄). 특히 머리 주석 `1 행` ~ `26 행`, import `31 행` ~ `39 행`, `members` useMemo `55 행` ~ `62 행`, 반환 `162 행` ~ `177 행`.
- `web/src/views/useAdminMemberships.test.ts` (colocated spec): `1 행` ~ `12 행` (머리 주석), `76 행` ~ `105 행` (`RETURN_KEYS` · `INTERNAL_ONLY_KEYS`), `130 행` ~ `135 행`, `300 행` ~ `340 행`, `535 행` ~ `542 행`, `622 행` ~ `630 행`, `700 행` ~ `720 행`.
- `web/src/views/AdminView.tsx` `790 행` ~ `804 행` (소비처가 `members` 를 꺼내지 않는다는 근거). 읽기만 하고 고치지 않는다.

## Acceptance Criteria

변경 (2 파일만):

- [ ] `useAdminMemberships.ts`: `members` useMemo 와 그 선행 주석 (`55 행` ~ `62 행`) 을 지우고, 반환 object 에서 `members` 를 뺀다. `deriveMembers` import 도 지운다. `findGroup` · `deriveMembersFromMemberships` · `deriveAddCandidates` · `buildGroupMembersPath` import 는 그대로 둔다.
- [ ] `useAdminMemberships.ts` 주석 정합: `3 행` 이동 대상 목록에서 "`members` client-side 파생" 을 빼고, `16 행` 의 "반환 `members` 를 `useAdminSchedule` 이 소비하고" 와 `19 행` 의 "`useAdminSchedule` 의 `members` 주입" 을 지운다. 호출 위치 제약은 `useApiResource` 발사 순번 근거만 남긴다. 반환 심볼 수는 `19 행` · `23 행` · `162 행` 모두 11 에서 10 으로 맞춘다. T-2086 에서 뺐다는 사실을 한 줄로 남긴다.
- [ ] 나머지 hook 본문, `useMemo` / `useCallback` deps 배열, `runRemove` / `runAdd` 주입 키, `useApiResource` 호출 순서는 바꾸지 않는다.
- [ ] `useAdminMemberships.test.ts`: `RETURN_KEYS` 에서 `'members'` 를 빼고 `77 행` 주석을 10 심볼 (파생 1 + 조회 상태 2 + remove 3 + add 3 + 후보 1) 로 고친다. `328 행` it 문자열도 10 심볼로 고친다. `300 행` it 의 `members` 단언 (`308 행` ~ `312 행`) 과 it 문자열의 `members` 를 지운다. `540 행` · `628 행` (`627 행` 주석 포함) · `705 행` · `718 행` 의 `expect(hook.members)` 단언을 지운다. 이때 같은 it 의 나머지 단언은 남긴다. 단언이 하나도 남지 않는 it 이 생기면 그 it 은 통째로 지운다. 머리 주석 `6 행` 이동 대상 목록과 `132 행` 주석 (`deriveMembers` 언급) 은 현재 fallback 소비처인 `deriveMembersFromMemberships` 기준으로 고친다. fixture 는 그대로 둔다.
- [ ] `git grep -n "hook.members\b\|deriveMembers\b" -- web/src/views/useAdminMemberships.ts web/src/views/useAdminMemberships.test.ts` 결과가 0 줄이다. `deriveMembersFromMemberships` 는 대상이 아니므로 단어 경계로 구분한다.

R-112 (신규 public symbol 없음, hook 반환 표면에서 `members` 1 개만 빠진다):

- [ ] Happy-path: 반환 표면 test 가 10 심볼 `RETURN_KEYS` 와 정확히 일치하고 green 이다. `groupMembers` · `addCandidates` 파생 test 가 기존 기대값 그대로 green 이다.
- [ ] Error path: 멤버십 조회 실패 (`membersError`) · remove / add 실패 문구 test 가 수정 없이 green 이다.
- [ ] 분기: 그룹 미선택 (path null) · 선택 그룹 전환 · stale 선택 · 빈 `groups` fallback 분기 test 가 `members` 단언만 빠진 채 `groupMembers` 단언으로 각 분기를 계속 cover 하고 green 이다.
- [ ] Negative: 반환 표면 test 에 `expect(hook).not.toHaveProperty('members')` 단언 1 개를 추가해 제거된 키가 다시 새지 않도록 잠근다 (`INTERNAL_ONLY_KEYS` 에 넣거나 별도 단언으로). 기존 캡슐화 negative (`INTERNAL_ONLY_KEYS`) 는 그대로 green 이어야 한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, web `vitest` 와 web `tsc` (build) green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), PR CI green (unit · smoke · e2e).

## Out of Scope

- `deriveMembers` 함수 · export 삭제 (`adminMembershipDerivations.ts`), 그 test (`adminMembershipDerivations.test.ts` `78 행` describe · `345 행` re-export 단언), `AdminView.tsx` import `98 행` · re-export `1854 행` · `14 행` ~ `15 행` · `790 행` ~ `793 행` 주석, `AdminView.test.tsx` `428 행` ~ `466 행`. 이것들은 ⑭-c2b (pr, 4 파일) 에서 한다.
- `GroupRow` 의 `members` / `persons` 필드와 `deriveMembersFromMemberships` 의 `members ?? persons` fallback. 지금 쓰이고 있으므로 대상이 아니다.
- `docs/architecture/api.md` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` · `docs/architecture/modules.md` doc-sync (⑭-d, direct).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각 (planner 가 순서대로 큐잉): ⑭-c2b `deriveMembers` 삭제. 대상은 `web/src/views/adminMembershipDerivations.ts` (함수 · export · `7 행` / `19 행` / `135 행` / `159 행` 주석), `adminMembershipDerivations.test.ts` (`deriveMembers` describe · re-export 단언), `AdminView.tsx` (`98 행` import · `1854 행` re-export · `14 행` ~ `15 행` · `790 행` ~ `793 행` 주석), `AdminView.test.tsx` (`8 행` 주석 · `71 행` import · `428 행` ~ `466 행` test) 4 파일이다 (pr). 그다음이 ⑭-d api.md · UC-06 · modules.md doc-sync (direct)다. `caa21fee` 가 api.md 에 1 줄을 추가했으므로 ⑭-d 는 `170 행` 좌표를 다시 확인해야 한다.

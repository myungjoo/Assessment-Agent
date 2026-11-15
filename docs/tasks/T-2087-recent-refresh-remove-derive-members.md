---
id: T-2087
title: 최근 N일 재수집 ⑭-c2b — 소비처가 사라진 deriveMembers helper 를 지운다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-11-15
independentStream: recent-refresh
dependsOn: [T-2086]
touchesFiles: [web/src/views/adminMembershipDerivations.ts, web/src/views/adminMembershipDerivations.test.ts, web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭-c2b. T-2086 머지로 production 소비처 0 이 된 deriveMembers 삭제 (4 파일)
---

# T-2087 — 소비처가 사라진 deriveMembers helper 삭제

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 중 web 조각의 두 번째다 (README `74 행`, R-74 / REQ-041). T-2086 (PR #1649, `fac0ec97`) 이 `useAdminMemberships` 반환에서 `members` 파생과 `deriveMembers` import 를 지웠다. 그래서 `deriveMembers` 는 production 코드에서 호출하는 곳이 없다. 남은 참조는 AdminView 의 import (`98 행`) 와 export 배럴 re-export (`1854 행`) 뿐이고, 둘 다 함수를 실제로 부르지 않는다. 그런데도 spec 2 개가 이 helper 를 계속 검증하고 있다.

issue-still-relevant 확인 (origin/main `067515d9`): `git grep -n "deriveMembers\b" -- web/ src/` 결과는 `adminMembershipDerivations.ts` (`7 행` · `19 행` 주석, `82 행` 정의, `135 행` · `159 행` 주석), `adminMembershipDerivations.test.ts` (`14 행` · `26 행` import, `78 행` ~ `145 행` 부근 describe, `345 행` 재수출 단언), `AdminView.tsx` (`98 행` · `1854 행`), `AdminView.test.tsx` (`8 행` 주석, `71 행` import, `428 행` ~ `466 행` test 2 개) 에만 걸린다. 다른 web 모듈과 backend 는 참조하지 않는다. 아직 지워지지 않았으므로 본 task 는 유효하다.

## Required Reading

- `web/src/views/adminMembershipDerivations.ts` `1 행` ~ `30 행` (머리 주석), `76 행` ~ `103 행` (`deriveMembers` 정의와 선행 주석), `129 행` ~ `136 행`, `157 행` ~ `160 행` (`deriveMembers` 를 언급하는 주석).
- `web/src/views/adminMembershipDerivations.test.ts` (colocated spec) `1 행` ~ `30 행` (머리 주석 · import), `78 행` ~ `150 행` (`describe('deriveMembers')`), `338 행` ~ `352 행` (배럴 재수출 describe).
- `web/src/views/AdminView.tsx` `10 행` ~ `18 행` (머리 주석의 멤버 파생 서술), `92 행` ~ `104 행` (import), `785 행` ~ `800 행` (hook 호출 위 주석), `1850 행` ~ `1860 행` (export 배럴).
- `web/src/views/AdminView.test.tsx` (colocated spec) `5 행` ~ `10 행` (머리 주석), `68 행` ~ `75 행` (import), `418 행` ~ `470 행` (`deriveMembers` test 2 개와 인접 `findGroup` test).

## Acceptance Criteria

변경 (4 파일만):

- [ ] `adminMembershipDerivations.ts`: `deriveMembers` 함수와 그 선행 주석 블록을 지운다. `findGroup` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates` · `FALLBACK_MEMBER_NAME` · row 타입 3 개는 본문을 한 줄도 바꾸지 않는다.
- [ ] `adminMembershipDerivations.ts` 주석 정합: 머리 주석 `7 행` · `19 행` 의 helper 목록에서 `deriveMembers` 를 빼고 개수를 5 에서 4 로 고친다. 이동 이력은 사실이므로 "T-1876 이 옮긴 5 개 중 `deriveMembers` 는 T-2087 에서 소비처 소멸로 삭제" 라고 한 줄로 남긴다. `135 행` 의 "(deriveMembers 동형)" 과 `159 행` 의 "deriveMembers/deriveMembersFromMemberships 와 동형" 은 남은 helper 기준으로 고친다 (`deriveMembersFromMemberships` 동형 또는 표현 삭제).
- [ ] `adminMembershipDerivations.test.ts`: `describe('deriveMembers')` 블록 전체와 `deriveMembers` · `reexportedDeriveMembers` import 를 지운다. 재수출 단언 (`345 행`) 에서 `deriveMembers` 줄만 지운다. 머리 주석의 "helper 5" 는 4 로 고친다. `GROUP` / `FALLBACK` 같은 fixture · 상수가 다른 describe 에서 쓰이지 않게 되면 그것도 지운다 (lint unused 방지). 다른 describe 에서 쓰이면 그대로 둔다.
- [ ] `AdminView.tsx`: `98 행` 의 `deriveMembers` import 와 `1854 행` 의 배럴 re-export 를 지운다. `14 행` ~ `15 행` 머리 주석은 "group row 의 members 를 client-side 파생" 서술을 현재 사실 (멤버 표시는 `GET /api/groups/:id/members` 멤버십 조회 + `deriveMembersFromMemberships`) 로 고친다. `790 행` ~ `793 행` 주석은 사실과 맞으면 그대로 두고, `deriveMembers` 를 가리키는 표현이 있으면만 고친다. 그 밖의 AdminView 본문과 hook 호출 순서는 바꾸지 않는다.
- [ ] `AdminView.test.tsx`: `71 행` import 에서 `deriveMembers` 를 지우고, `428 행` ~ `466 행` 의 `deriveMembers` test 2 개 (주석 포함) 를 지운다. `8 행` 머리 주석의 "(deriveMembers/findGroup)" 은 `findGroup` 등 남은 helper 기준으로 고친다. `SAMPLE` fixture 는 다른 test 가 쓰므로 그대로 둔다. 다른 test 는 손대지 않는다.
- [ ] `git grep -n "deriveMembers\b" -- web/ src/` 결과가 0 줄이다. `deriveMembersFromMemberships` 는 단어 경계로 구분되어 걸리지 않는다.

R-112 (신규 public symbol 없음, 공개 표면에서 `deriveMembers` 1 개만 빠진다):

- [ ] Happy-path: 남은 helper 4 개 (`findGroup` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates`) 의 기존 happy test 가 수정 없이 green 이다. `deriveMembersFromMemberships` 의 `members ?? persons` fallback · `fullName` 이름 fallback happy test 가 남아 있어 삭제한 test 가 보던 매핑 계약을 계속 cover 하는지 확인한다 (없다면 해당 test 1 개를 `adminMembershipDerivations.test.ts` 에 추가).
- [ ] Error path: 남은 helper 의 비배열 · undefined 입력 안전 fallback test 가 수정 없이 green 이다.
- [ ] 분기: `deriveMembersFromMemberships` 의 person 매칭 성공 / 매칭 실패 / 빈 이름 분기 test 가 green 이다 (이번 변경에 새 분기 없음).
- [ ] Negative: 배럴 재수출 describe 에 `deriveMembers` 가 더는 export 되지 않음을 잠그는 단언 1 개를 추가한다. 예: `import * as derivations from './adminMembershipDerivations'` 와 `import * as adminView from './AdminView'` 에 대해 `expect(derivations).not.toHaveProperty('deriveMembers')` · `expect(adminView).not.toHaveProperty('deriveMembers')`. 나머지 재수출 동일 참조 단언은 그대로 green 이다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, web `vitest` 와 web `tsc` (build) green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), PR CI green (unit · smoke · e2e).

## Out of Scope

- `useAdminMemberships.ts` / `useAdminMemberships.test.ts` (T-2086 에서 끝났다).
- `GroupRow` 의 `members` / `persons` 필드와 `deriveMembersFromMemberships` 의 `members ?? persons` fallback. 지금 쓰이고 있으므로 대상이 아니다.
- `findGroup` 의 export 범위 축소 등 다른 helper 정리. 필요해 보이면 Follow-ups 에 적는다.
- `docs/architecture/api.md` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` · `docs/architecture/modules.md` doc-sync (⑭-d, direct).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각: ⑭-d api.md · UC-06 · modules.md doc-sync (direct). `caa21fee` 가 api.md 에 1 줄을 추가했으므로 ⑭-d 는 `170 행` 좌표를 다시 확인해야 한다.

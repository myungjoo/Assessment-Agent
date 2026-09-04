---
id: T-1894
title: AdminView ② 인원 축 중 조회·삭제 배선(`476 행` ~ `506 행` · `627 행` ~ `653 행`, 58 줄)을 useAdminPersons hook 으로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-026]
independentStream: adminview-god-component-refactor
dependsOn: [T-1893]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminPersons.ts
  - web/src/views/useAdminPersons.test.ts
  - web/src/views/AdminView.persons-list-contract.test.ts
  - web/src/views/AdminView.persons-include-inactive.test.tsx
estimatedDiff: 480
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: 인원 축 2 조각(`476 행` ~ `506 행` 재조회 nonce · 휴직 포함 토글 상태 · nonce+토글 aware path useMemo · `useApiResource<PersonRow[]>` 목록 조회 / `627 행` ~ `653 행` 삭제 in-flight · 실패 문구 2 상태 + `handleDeletePerson`)을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminPersons(initialPersonsIncludeInactive: boolean)` 시그니처와 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0. (b) 신규 로직 0 LOC: `buildPersonsPath(personsRefreshNonce, personsIncludeInactive)` useMemo 와 그 deps 배열 · `runDeletePerson` 주입 키 6 개(`remove` · `describeError` · `deleting` · `setDeleting` · `setDeleteError` · `bumpRefresh`) · `useCallback` deps `[deletingPerson]` 까지 본문 무변경 이동. (c) 기존 spec 무수정 통과 — 렌더 spec 의 `vi.mock('../api/useApiResource')` 는 모듈 단위라 hook 모듈에도 그대로 적용되고 라우팅이 path 기반이라 회귀 0, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 2 파일뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 58 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 아홉째 슬라이스 — ② 인원 축을 2 분할한 ① 조회·삭제, head 1228a549 재실측 · drift-guard 2 건 pointer 동반"
---

# T-1894 — AdminView 인원 조회·삭제 배선을 useAdminPersons hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 아홉째 슬라이스다. 직전 슬라이스([T-1893](T-1893-adminview-parts-axis-hook-extract.md))가 ⑦ 파트 축을 소진해 잔여는 ① 그룹 · 멤버십 · ② 인원 두 축뿐이고, bullet 이 못 박은 착수 기준("축 밖 의존이 적은 축부터")대로 **② 인원 축이 먼저**다 — 그룹 · 멤버십 축의 `addCandidates` 파생이 인원 데이터를 소비하므로(단방향) 인원 축을 먼저 hook 으로 닫아야 그룹 축 추출 때 파라미터로 넘길 표면이 명확해진다. AdminView 는 현재 **2,248 줄**이라 목표선 ≤ 2,000 줄까지 잔여 `-248 줄` 이고, 본 슬라이스의 기대 순 감소는 `-45 줄` 안팎이다.

**issue-still-relevant pre-check 결과** ([.claude/agents/planner.md](../../.claude/agents/planner.md) `§Pre-check: issue-still-relevant`, head `1228a549` 기준 실측):

1. **목적지 모듈 미존재** — `git ls-tree origin/main web/src/views/` 의 hook 모듈은 `useAdminCollectionTargets` · `useAdminImportExport` · `useAdminLlmProviders` · `useAdminParts` · `useAdminSchedule` · `useAdminServiceIdentities` · `useAdminUsers` **7 개**이고 `useAdminPersons.ts` 는 없다. `git grep "useAdminPersons" origin/main -- web/src` 결과 **0 건** — 본 축은 아직 AdminView 본문에 그대로 있다.
2. **좌표 재실측** (bullet 의 축 좌표는 T-1891 ~ T-1893 이전 것이라 무효 → 현 head 로 재측정) — 인원 축은 4 조각(`476 행` ~ `506 행` 조회 / `543 행` ~ `592 행` 생성 / `627 행` ~ `653 행` 삭제 / `772 행` ~ `888 행` 수정)이며 본 슬라이스가 가져가는 것은 **조회 · 삭제 2 조각**이다: **(A) `476 행` ~ `506 행`**(31 줄 — `personsRefreshNonce` `479 행` · `personsIncludeInactive` `485 행` ~ `487 행` · `personsPath` useMemo `492 행` ~ `495 행` · `useApiResource<PersonRow[]>(personsPath)` `502 행` ~ `506 행`), **(B) `627 행` ~ `653 행`**(27 줄 — `deletingPerson` `629 행` · `deletePersonError` `633 행` ~ `635 행` · `handleDeletePerson` `642 행` ~ `653 행`).
3. **2 분할이 강제되는 근거 (파일 cap)** — 인원 축 4 조각을 한 슬라이스로 옮기면 drift-guard pointer 갱신이 **4 파일**(아래 census)이 되어 AdminView.tsx + hook 모듈 + hook spec 을 더한 **7 파일 = cap 초과**다. 그래서 소스 guard 가 조회 축을 겨냥한 2 파일과 mutation 축을 겨냥한 2 파일의 경계를 절단면으로 삼아 ① 조회 + 삭제(본 task, 5 파일) → ② 생성 + 수정(후속, 5 파일) 로 나눈다. 삭제 조각을 ① 에 붙인 이유는 **소스 anchor 가 0** 이라 파일을 늘리지 않으면서 이동량을 27 줄 키우기 때문이다(`AdminView.person-delete-contract.test.ts` 와 `AdminView.test.tsx` 의 삭제 test 는 배럴에서 `runDeletePerson` 을 직접 import 하는 단위 test 라 배선 이동과 무관하다).
4. **anchor census 재실행** (bullet `(i)` ~ `(iv)` 지시대로) — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 결과 **13 파일**이고, 그중 본 슬라이스 2 조각의 심볼을 소스 텍스트로 잡는 것은 `AdminView.persons-list-contract.test.ts`(`/useApiResource<PersonRow\[\]>\(\s*(personsPath[^)]*)\)/` 호출식 anchor, `76 행`) 와 `AdminView.persons-include-inactive.test.tsx`(`/const personsPath = useMemo\(([\s\S]*?)\);\n/` + `buildPersonsPath(personsRefreshNonce, personsIncludeInactive)` + deps 배열 문자열, `174 행` ~ `184 행`) **2 건**뿐이다. 후자의 `checked={personsIncludeInactive}` guard(`189 행`)는 JSX 대상이라 AdminView 소스를 계속 읽어야 한다 — **두 소스를 모두 읽는 형태**로 고친다. `adminResourcePathBuilders.test.ts` 와 `AdminView.test.tsx` 의 `buildPersonsPath` test 는 빌더 모듈 · 배럴 import 라 무영향이다. **여유 0** 이므로 착수 시 census 를 한 번 더 돌려 6 번째 파일이 필요해지면 즉시 planner 에게 분할을 요청한다.
5. **축 밖 의존 실측** — hook 이 밖에서 받아야 하는 값은 props 유래 `initialPersonsIncludeInactive` **하나**뿐이다(`useAdminUsers` 의 파라미터 0, `useAdminParts` 의 파라미터 1 과 동형). 반대로 hook 이 내보내야 하는 값은 잔류 소비처가 실제로 쓰는 것만이다 — JSX 의 `personData` · `personLoading` · `personError` · `deletingPerson` · `deletePersonError` · `handleDeletePerson` · `personsIncludeInactive` · `setPersonsIncludeInactive`, 잔류 파생 · 핸들러의 `personData`(`handleEditPerson` `815 행` · `addCandidates` `1010 행` · ServiceIdentity 인원 `<select>` `1767 행`), 그리고 잔류 생성 · 수정 핸들러가 쓰는 **`setPersonsRefreshNonce`(한시적 노출)** 다. 마지막 항목은 [T-1891](T-1891-adminview-users-query-create-hook-extract.md) 이 `setUsersRefreshNonce` 를 한시적으로 노출했다가 [T-1892](T-1892-adminview-users-role-access-hook-extract.md) 합류 시 내린 선례와 동형이며, 후속 슬라이스에서 반환 표면에서 내린다.
6. **`useApiResource` 호출 순번 보존** — 현 호출 순서는 그룹(`467 행`) → `auth/me`(`474 행`) → 인원(`506 행`) → ServiceIdentity hook(`538 행`) → … 이다. `useAdminPersons(...)` 호출을 **조각 (A) 자리(`476 행`)** 에 두면 hook 내부의 `useApiResource` 가 같은 순번에서 발사되어 순서가 보존된다. 삭제 조각은 `useApiResource` 를 쓰지 않으므로 hook 안으로 합류해도 조회 순번에 영향이 없다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 순수 추출 3 조건 판정 · 파일 cap anchor census 방법 `(i)` ~ `(iv)` · 착수 순서 기준
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `476 행` ~ `506 행` · `627 행` ~ `653 행` (이동 대상 2 조각), `543 행` ~ `592 행` · `772 행` ~ `888 행` (잔류 생성 · 수정 축 — `setPersonsRefreshNonce` · `personData` 소비 확인), `1128 행` ~ `1131 행` (아래 nit 대상 주석), `1640 행` ~ `1650 행` · `1745 행` ~ `1754 행` · `1767 행` (JSX 소비처)
- [web/src/views/useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) — 모듈 서두 주석 형식 · 반환 표면 캡슐화 · 한시적 setter 노출 선례
- [web/src/views/useAdminParts.ts](../../web/src/views/useAdminParts.ts) — 파라미터 1 개(초기값 props) hook 시그니처 선례
- [web/src/views/useAdminParts.test.ts](../../web/src/views/useAdminParts.test.ts) — colocated hook spec 의 R-112 구성 선례(happy / error / 분기 / negative)
- [web/src/views/AdminView.persons-list-contract.test.ts](../../web/src/views/AdminView.persons-list-contract.test.ts) `72 행` ~ `78 행` · `111 행` ~ `113 행` — 호출식 anchor 와 소스 로딩 지점
- [web/src/views/AdminView.persons-include-inactive.test.tsx](../../web/src/views/AdminView.persons-include-inactive.test.tsx) `26 행` ~ `28 행` · `174 행` ~ `190 행` — `personsPath` useMemo guard 와 JSX guard 의 경계
- [CLAUDE.md](../../CLAUDE.md) §3 (소비처 동반 의무 · Nit-in-PR closure) · §3.2 (R-112)

## Acceptance Criteria

- [ ] 신규 모듈 `web/src/views/useAdminPersons.ts` 가 `export function useAdminPersons(initialPersonsIncludeInactive: boolean)` 를 제공하고, 이동 2 조각의 선언 본문 · `useMemo` / `useCallback` deps 배열 · `runDeletePerson` 주입 키가 이동 전과 **글자-동일**하다 (`git diff` 로 이동분이 삭제 + 추가로만 나타남).
- [ ] `web/src/views/AdminView.tsx` 에서 위 2 조각이 제거되고, `useAdminPersons(initialPersonsIncludeInactive)` 호출이 **이동 전 조각 (A) 자리**(`auth/me` 조회 직후, ServiceIdentity hook 호출 직전)에 놓여 `useApiResource` 호출 순번이 보존된다.
- [ ] 소비처 동반 — AdminView 가 hook 반환값을 destructure 해 JSX(`personData` · `personLoading` · `personError` · `deletingPerson` · `deletePersonError` · `handleDeletePerson` · `personsIncludeInactive` · `setPersonsIncludeInactive`) 와 잔류 파생 · 핸들러(`handleEditPerson` · `addCandidates` · ServiceIdentity 인원 `<select>` · 생성 · 수정의 `setPersonsRefreshNonce`)에서 **같은 이름으로 즉시 되돌려 쓴다**. hook 단독 슬라이스가 아니다.
- [ ] hook 내부 값(`personsPath` · `personsRefreshNonce` · `setDeletingPerson` · `setDeletePersonError`)은 반환 표면에 노출하지 않는다. `setPersonsRefreshNonce` 만 **한시적 노출**이며 그 사유를 모듈 서두 주석에 명시한다.
- [ ] happy-path unit test — colocated `web/src/views/useAdminPersons.test.ts` 에 hook 의 정상 동작 test 1+ (초기 마운트 시 base path 조회 · 반환 표면 심볼 존재 · 삭제 핸들러 성공 경로).
- [ ] error path unit test — 조회 error 를 `personError` 로 그대로 전달하는 경로 1+ 와 삭제 실패 시 `deletePersonError` 에 사람-친화 문구가 담기고 throw 하지 않는 경로 1+.
- [ ] 분기 cover — `personsIncludeInactive` 토글 ON/OFF 각각의 path 파생 1+, `personsRefreshNonce` 0 / 증가 각각 1+, 삭제 in-flight(`deletingPerson=true`) 재발사 억제 분기 1+.
- [ ] negative cases 충분 cover — 빈/공백 id 삭제 발사 억제, `initialPersonsIncludeInactive` 로 `true` 주입 시 초기 path, 조회 응답이 배열이 아닌 경우(null/undefined) 소비처가 throw 하지 않음, 삭제 실패 후 재시도 시 이전 error 가 비워짐 — 각 1+ test.
- [ ] `web/src/views/AdminView.persons-list-contract.test.ts` 의 호출식 anchor pointer 를 새 hook 모듈 소스로 교체하되 **계약 문장(정규식 · 기대값)은 무변경**이다.
- [ ] `web/src/views/AdminView.persons-include-inactive.test.tsx` 가 `personsPath` useMemo guard 는 hook 소스에서, `checked={personsIncludeInactive}` JSX guard 는 AdminView 소스에서 각각 읽도록 pointer 를 분리하고, 렌더 test(`personsPaths` 단언 4 종)는 무수정 통과한다.
- [ ] Nit-in-PR closure (CLAUDE.md §3, [T-1893](T-1893-adminview-parts-axis-hook-extract.md) Follow-ups 승계) — `AdminView.tsx` `1128 행` ~ `1131 행` 의 `useAdminCollectionTargets` 선행 주석이 주장하는 "기존 spec 이 `useApiResource` mock 을 호출 순서로 구분한다" 서술을 실측(web 의 모든 spec 은 path 라우팅, 순번 라우팅 0 건)에 맞게 정정한다. 주석 1 곳 정리이며 별도 task 로 승격하지 않는다.
- [ ] `pnpm --dir web lint && pnpm --dir web build && pnpm --dir web test` 통과 (기존 spec 은 pointer 교체 2 건 외 무수정 통과).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `web/src/views/AdminView.tsx` 의 LOC 이 감소했음을 `wc -l` 로 확인하고 그 수치를 PR 본문에 적는다 (기대 `-45 줄` 안팎).

## Out of Scope

- 인원 축의 **생성**(`543 행` ~ `592 행`) · **수정**(`772 행` ~ `888 행`) 조각 이동 — 후속 슬라이스(같은 `useAdminPersons` 모듈로 합류, `AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx` 2 건 pointer 동반, 5 파일).
- ① 그룹 · 멤버십 축 이동.
- JSX return 의 하위 컴포넌트화(경로 2) — 순수 추출 3 조건 미충족이라 별도 절단 기준을 따른다.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 갱신 — `direct` 대상이라 본 `pr` task 에 섞지 않는다 (CLAUDE.md §3.1 판정 규칙 3).
- 이동 대상 코드의 동작 · 문구 · deps 배열 변경, 배럴 재수출 표면 변경, 새 dependency 추가.
- 위 Nit 1 건 외의 주석 정리 · 리네이밍.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-09-04 20:56Z 완료)

- **DONE** (`pr`, PR [#1481](https://github.com/myungjoo/Assessment-Agent/pull/1481) → main [`c283cd53`](https://github.com/myungjoo/Assessment-Agent/commit/c283cd53)). round 1 squash merge.
- 인원 조회·삭제 2 조각(58 줄)을 `web/src/views/useAdminPersons.ts` 로 본문·deps 배열·`runDeletePerson` 주입 키 6 개까지 글자-동일 이동. hook 호출을 조각 (A) 자리에 두어 `useApiResource` 순번 보존, `setPersonsRefreshNonce` 만 한시 노출(T-1891 선례).
- **AdminView.tsx 2,248 → 2,217 줄(-31)**. 5 파일 `+688/-68`.
- 신규 spec 24 케이스(happy 5 · error 3 · 분기 4 · negative 12) 로 R-112 4 종 cover — 빈·공백 id 억제, in-flight 재발사 억제, 비배열 응답 5 종, 되돌림, 재시도 error 정리. web 138 파일 4,080 test green, backend 466 suite 13,495 test + `coverageThreshold`(line/function ≥ 80%) 통과.
- drift-guard 2 건은 pointer 만 교체(계약 문장 무변경). Nit-in-PR closure 로 `useAdminCollectionTargets` 선행 주석의 "spec 이 호출 순번으로 구분" 서술을 실측(순번 라우팅 0 건)에 맞게 정정.
- 4-게이트 실측 — reviewer VERDICT=APPROVE comment 외부 존재 · PR CI success · integrator 자체 점검 통과 · CI green.

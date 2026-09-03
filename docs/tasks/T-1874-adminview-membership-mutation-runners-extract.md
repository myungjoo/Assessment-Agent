---
id: T-1874
title: AdminView 의 그룹 멤버십 add·remove mutation 러너 군을 adminMembershipRunners 로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
independentStream: adminview-god-component-refactor
dependsOn: [T-1873]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminMembershipRunners.ts
  - web/src/views/adminMembershipRunners.test.ts
estimatedDiff: 380
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (연속 블록 1 개 `997~1127 행` 을 통째로 옮기고 선언 앞에 `export` 만 붙인 뒤 AdminView 가 단방향 import 로 배선하는 것이 전부) · (b) 신규 로직 0 LOC (async 러너 2 · deps 타입 2 의 본문 · 주석 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출 덕에 `from './AdminView'` 무수정 통과 (`AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.test.tsx` 는 심볼 import 방식이라 소스 경로에 의존하지 않음). 삭제 약 131 + 추가 약 145 가 전부 이동량이고 나머지는 신규 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열두째 실분할 — 그룹 멤버십 add·remove 러너 4 심볼(997~1127 행 연속 블록)"
created: 2026-09-03
completedAt: 2026-09-03T17:51:26Z
prNumber: 1466
mergeCommit: 756af1227b1b17276a7282fe985d85c092f2e364
---

# T-1874 — AdminView 의 그룹 멤버십 add·remove mutation 러너 군을 adminMembershipRunners 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목했던 **사용자 관리 mutation 축**은 [T-1872](T-1872-adminview-create-user-runners-extract.md) (생성 축 7 심볼) + [T-1873](T-1873-adminview-user-access-role-runners-extract.md) (권한 · 역할 축 10 심볼) 이 [adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) 로 전량 옮겨 **마감**됐다. 본 task 는 그 다음 축인 **그룹 멤버십 mutation 러너 군**을 신규 모듈로 옮기는 열두째 순수-추출 슬라이스다. cap 이 append 를 싸게 extract 를 비싸게 만들어 온 구조를 되돌려 목표선 (≤ 2,000 줄) 까지의 잔여를 줄이는 것이 목적이다.

**issue-still-relevant pre-check (origin/main `ee400a9d` 실측)**:

- `wc -l web/src/views/AdminView.tsx` = **4,198 줄**, 선언 수 (`grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`) = **70**. 최초 기록 (6,087 줄 · 149 선언) 대비 `-1,889 줄`. PLAN bullet 본문의 `4,497 줄` 표기는 T-1871 시점 값이라 이미 stale 하다 (본 bullet 의 LOC 갱신은 아래 Follow-ups 의 별도 `direct` task).
- 이동 대상 4 심볼 (`RemoveDeps` · `runRemove` · `AddDeps` · `runAdd`) 이 **여전히 AdminView.tsx 에만** 정의돼 있다 — `1001` · `1024` · `1063` · `1090 행`. 선행 주석 포함 `997 행` ~ `1127 행` 의 **연속 1 블록 131 줄**이라 T-1873 과 마찬가지로 이동 경계가 단순하다.
- 목적지 모듈 `web/src/views/adminMembershipRunners.ts` 는 origin/main 에 **부재** (`git ls-tree origin/main web/src/views/` 히트 0) — 중복 task 아님.
- 소비처는 컨테이너의 `handleRemove` (`1884 행`) · `handleAdd` (`1913 행`) 이며 둘 다 AdminView 에 잔류한다. 두 소비처의 import 배선을 **같은 PR 안에서** 갈아끼우므로 CLAUDE.md §3 의 소비처 동반 의무를 충족한다 (helper 단독 slice 아님).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `997 행` ~ `1127 행` (이동 대상 블록), `1884 행` ~ `1935 행` 부근 (소비처 `handleRemove` · `handleAdd`), 파일 머리 import 블록 (`18 행` ~ `60 행`), 파일 끝 `export {` / `export type {` 배럴.
- [web/src/views/adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) — 직전 슬라이스가 만든 **모듈 헤더 주석 · `RequestOptions` import · export 부착 관례**의 참조 선례.
- [web/src/views/adminUserMutationRunners.test.ts](../../web/src/views/adminUserMutationRunners.test.ts) — 신규 경계 spec 의 구성 선례 (R-112 4 종 배치).
- [web/src/views/AdminView.group-member-remove-contract.test.ts](../../web/src/views/AdminView.group-member-remove-contract.test.ts) — `runRemove` 를 심볼 import 하는 기존 계약 spec (무수정 통과해야 함).
- [web/src/views/AdminView.group-member-add-contract.test.ts](../../web/src/views/AdminView.group-member-add-contract.test.ts) — `runAdd` · `AddDeps` 를 심볼 import 하는 기존 계약 spec (무수정 통과해야 함).
- [web/src/views/AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) — AdminView **소스 텍스트**를 읽는 drift-guard. `68 행` `extractMembersFireMethod` 가 단언하는 대상은 컨테이너 본문의 `useApiResource<MembershipRow[]>(groupMembersPath)` 호출부라 잔류부이며 본 이동의 영향이 없음을 착수 시 재확인한다.

## Acceptance Criteria

- [ ] 신규 파일 [web/src/views/adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) 가 존재하고 `RemoveDeps` · `runRemove` · `AddDeps` · `runAdd` **4 심볼**을 `export` 한다. 각 선언의 **본문과 선행 주석은 한 글자도 바뀌지 않아야** 하며 (선언 앞 `export` 키워드 부착만 허용), `import type { RequestOptions } from '../api/apiClient';` 외의 새 의존은 추가하지 않는다.
- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 에서 위 4 선언이 제거되고, 새 모듈에서 값 (`runRemove` · `runAdd`) 과 타입 (`RemoveDeps` · `AddDeps`) 을 import 하도록 배선된다. **역방향 import 0** — 새 모듈이 `./AdminView` 를 import 하지 않는다 (`grep -n "from './AdminView'" web/src/views/adminMembershipRunners.ts` 히트 0).
- [ ] 소비처 `handleRemove` · `handleAdd` 가 새 모듈의 러너를 호출하도록 같은 PR 안에서 배선된다 (소비처 동반 의무 — helper 단독 slice 금지).
- [ ] AdminView 파일 끝 배럴이 이동 전 공개 표면을 그대로 re-export 한다 — `export { ... runRemove, runAdd ... }` 와 `export type { ... RemoveDeps, AddDeps ... }` 유지. 기존 spec 의 `from './AdminView'` 가 **무수정**으로 통과해야 한다.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **4,198 줄보다 작아진다** (기대 `-120 줄` 안팎). PR 본문에 이동 전/후 실측 LOC 을 박제한다.
- [ ] **happy-path unit test** — 신규 spec 에서 `runRemove` 의 정상 DELETE 발사 (path `/api/groups/:id/members/:membershipId` · method `DELETE` · 성공 시 `bumpRefresh` 1 회) 와 `runAdd` 의 정상 POST 발사 (path `/api/groups/:id/members` · body `{ personId }` · 성공 시 `bumpRefresh` + `resetInput`) 를 각 1+ 검증한다.
- [ ] **error path unit test** — 두 러너 각각에 대해 발사 primitive 가 throw 할 때 (a) 예외가 밖으로 새지 않고 (b) `describeError` 파생 문구가 `setRemoveError` / `setAddError` 로 표면화되며 (c) `bumpRefresh` 가 호출되지 않음을 각 1+ 검증한다.
- [ ] **flow / 분기 cover** — `runRemove` 의 분기 3 종 (빈 `membershipId` 미발사 / `removing === true` 미발사 / 정상 발사) 과 `runAdd` 의 분기 4 종 (공백만 `personId` trim 후 미발사 / 빈 `groupId` 미발사 / `adding === true` 미발사 / 정상 발사) 을 각 1+ test 로 분리한다. 두 러너의 `finally` 경로 (성공 · 실패 모두 진행 플래그가 off 로 복귀) 도 각 1+ 검증한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: (a) 빈 문자열 인자, (b) 공백만 인자 (`runAdd` trim 경로), (c) in-flight 중복 호출 (이중 발사 0 검증), (d) 비정상 문자가 든 `groupId` · `membershipId` 의 `encodeURIComponent` 안전 인코딩, (e) 발사 primitive 의 reject (의존성 실패), (f) 실패 후 입력 · 재조회 nonce 미변경 (`resetInput` 미호출).
- [ ] **동일 참조 검증 1+** — `import { runRemove, runAdd } from './AdminView'` 로 얻은 심볼이 `adminMembershipRunners` 의 것과 **동일 참조** (`toBe`) 임을 단언해 배럴 재수출이 사본이 아님을 박제한다.
- [ ] `pnpm --dir web test` (vitest) 전량 green — 기존 계약 spec · drift-guard 무수정 통과 포함.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — jest `coverageThreshold` 미달 시 CI red.
- [ ] `pnpm lint && pnpm build` 가 web · backend 양쪽에서 통과한다.

## Out of Scope

- **난이도 매핑 assign 축** (`AssignDeps` · `runAssign` · 동반 상수 `LLM_MAPPINGS_PATH`) 이동 — 같은 연속 블록의 위쪽 이웃이지만 LLM 축이라 별도 슬라이스로 남긴다 (Follow-ups 참조).
- **멤버십 파생 helper 군** (`findGroup` · `deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates`) 과 row 타입 (`GroupRow` · `GroupMemberRow` · `MembershipRow`) 이동 — `FALLBACK_MEMBER_NAME` · `Member` · `PersonRow` 의존이 얽혀 있고 `AdminView.group-members-contract.test.ts` 동반 갱신 여부 재확인이 필요해 별도 슬라이스로 남긴다.
- `InFlightIdGate` · `createInFlightIdGate` (`1129 행` 이후) — 컨테이너 소유 범용 gate 라 멤버십 축이 아니다.
- 러너 본문의 어떤 **동작 변경 · 리팩터 · 주석 재작성**도 금지 (순수 추출 — 선언 앞 `export` 부착과 import 배선만).
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 · 다음 대상 재지목 — `direct` 대상이라 §3.1 판정 규칙 3 에 따라 별도 task.
- 기존 spec 의 import 경로를 `./adminMembershipRunners` 로 갈아끼우는 정리 — 배럴 재수출로 무수정 통과가 성립하므로 불필요한 diff 를 만들지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (planner 사전 박제) 다음 순수-추출 후보 ①: **난이도 매핑 assign 축** — `AssignDeps` · `runAssign` (`936 행` ~ `995 행`) + 동반 상수 `LLM_MAPPINGS_PATH` (`389 행`) 를 기존 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 이동. 잔류 `buildMappingsPath` (`790 행`) 가 상수를 쓰므로 T-1873 의 `USERS_PATH` 선례대로 **상수를 동반 이동하고 AdminView 가 import 로 되돌려 쓰는** 방향만 성립한다.
- (planner 사전 박제) 다음 순수-추출 후보 ②: **멤버십 파생 helper 축** — 위 Out of Scope 의 5 helper + row 타입 3. 착수 시 `AdminView.group-members-contract.test.ts` (`68 행`) · `AdminView.groups-list-contract.test.ts` 두 drift-guard 의 단언 anchor 가 잔류부인지 재확인해 파일 cap 산술에 반영할 것.
- (planner 사전 박제) [docs/PLAN.md](../PLAN.md) `183 행` bullet 갱신 (`direct`) — 실측 LOC 을 `4,198 줄` 기준으로 고치고, 마감된 사용자 관리 축 대신 다음 대상을 재지목한다. 본 task 머지 후 1 회로 묶어 doc churn 을 줄인다.

## 결과 요약 (2026-09-03 완료)

PR [#1466](https://github.com/myungjoo/Assessment-Agent/pull/1466) 머지 (squash → main `756af122`, round 1 APPROVE). 그룹 멤버십 축 4 심볼 (`RemoveDeps` · `runRemove` · `AddDeps` · `runAdd`) 을 신규 [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) 로 옮기고 선언 앞에 `export` 만 부착해 본문 · 주석 diff 0 을 기계 검증했다 (`+510/-132`). 소비처 `handleRemove` · `handleAdd` 배선을 같은 PR 에 포함해 소비처 동반 의무를 충족했고, 역방향 import 0 · 배럴 재수출 유지로 기존 계약 spec 2 종과 drift-guard 는 무수정 통과했다. `AdminView.tsx` 는 `4,198` → **`4,072` 줄** (-126).

신규 경계 spec 25 케이스로 R-112 4 종을 채웠다 — happy · error path · 분기 (`runRemove` 3 · `runAdd` 4 · `finally` 성공 · 실패) · negative 충분 cover (빈 인자 · 공백 trim · in-flight 중복 발사 · `encodeURIComponent` 안전 인코딩 · primitive reject · `resetInput` 미호출) · 동일 참조 1. web vitest 126 파일 `3,754` test 전량 green, jest `test:cov` 466 suite `13,495` test green (line · function ≥ 80% 충족), `pnpm lint && pnpm build` web · backend 양쪽 통과. PR head run `33786312690` = success.

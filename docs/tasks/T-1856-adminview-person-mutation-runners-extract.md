---
id: T-1856
title: AdminView 의 인원 mutation 러너 군을 별도 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-071, REQ-079]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminPersonMutationRunners.ts
  - web/src/views/adminPersonMutationRunners.test.ts
estimatedDiff: 1000
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + RequestOptions 타입 import 1 줄 + 선언 앞 export 키워드만) · (b) 신규 로직 0 LOC (deps 타입 4 · 순수 helper 2 · async 러너 3 · 입력 타입 2 의 본문 무변경) · (c) 기존 spec 6 개 (person-create/delete/update contract 3 + create/update identity-autoselect 2 + AdminView.test.tsx) 가 AdminView 재수출 덕에 import 경로까지 무수정 통과. 삭제 304 + 추가 약 330 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 다섯째 실분할 — T-1855 가 head 79dd1eda 에서 지목한 인원 mutation 러너 군 11 심볼 비연속 2 블록"
created: 2026-09-02
---

# T-1856 — AdminView 의 인원 mutation 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **후속 `pr` task** 다. 직전 fire ([T-1855](T-1855-plan-adminview-debt-remeasure.md)) 가 head 재측정을 마치며 **다음 대상을 "인원(person) mutation 러너 군 11 심볼, 비연속 2 블록 합계 약 301 줄"** 로 좌표까지 지목해 뒀고, 본 slice 가 그 지목을 그대로 집행한다.

부채 실측은 `5,569 줄` (head `79dd1eda`) 로 최초 기록 `6,087 줄` 대비 `-518 줄` 이지만 목표선 `≤ 2,000 줄` 까지 아직 `-3,569 줄` 이 남아 슬라이스당 -300 줄 페이스로도 산술 8 회 이상이 필요하다. 본 slice 는 그 페이스를 잇는 다섯째 실분할이다.

**planner issue-still-relevant pre-check (origin/main `6c384d2c` 실측)** — 미안착이 맞다: ① `git ls-tree origin/main web/src/views/` 에 `adminPersonMutationRunners` 파일 **0 건** (기존 추출 모듈은 `adminServiceIdentityRowActions.tsx` · `adminCollectionTargetRunners.ts` · `adminServiceIdentityRunners.ts` · `adminGroupPartMutationRunners.ts` 4 개이며 인원 축은 없다). ② 대상 11 심볼은 여전히 `AdminView.tsx` 본문에 있다 (`CreatePersonFields` `1791` · `CreatePersonDeps` `1800` · `extractCreatedPersonId` `1823` · `runCreatePerson` `1847` · `DeletePersonDeps` `2227` · `runDeletePerson` `2248` · `PersonPatchInput` `2286` · `PersonPatch` `2294` · `buildPersonPatch` `2308` · `UpdatePersonDeps` `2337` · `runUpdatePerson` `2369`). ③ 두 블록이 참조하는 **AdminView 최상위 심볼은 `PERSONS_PATH` 하나뿐** 임을 기계 확인했다 (발사 primitive 는 전부 deps 주입) — 따라서 T-1854 의 `GROUPS_PATH`/`PARTS_PATH` 동반 이동 선례를 그대로 따르면 본문 재작성이 0 이 된다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 **비연속 2 블록** 이며, 각 선언 위 주석 블록까지 포함한 경계는 다음과 같다 (origin/main `6c384d2c` 기준):
  - **생성 축** `1788~1892 행` — `CreatePersonFields` (`1791`) · `CreatePersonDeps` (`1800`) · `extractCreatedPersonId` (`1823`) · `runCreatePerson` (`1847`). 종료 직후 `1894 행` 의 `CREATE_USER_ERROR_SEPARATOR` 주석은 **범위 밖** (사용자 축).
  - **삭제·수정 축** `2223~2416 행` — `DeletePersonDeps` (`2227`) · `runDeletePerson` (`2248`) · `PersonPatchInput` (`2286`) · `PersonPatch` (`2294`) · `buildPersonPatch` (`2308`) · `UpdatePersonDeps` (`2337`) · `runUpdatePerson` (`2369`). 바로 앞 `2208 행` 근처의 `createInFlightIdGate` 는 ServiceIdentity · 역할 변경 경로도 공유하는 범용 게이트라 **범위 밖** 이고, 종료 직후 `2418 행` 부터의 `UpdateProviderFields` 주석도 **범위 밖** (LLM provider 축).
  - `186~190 행` 의 `PERSONS_PATH` 상수 (주석 4 줄 + 선언 1 줄) — 러너 3 개가 직접 참조하므로 **동반 이동 대상** 이며, AdminView 의 `buildPersonsPath` (`921` · `923 행`) 가 계속 쓰므로 AdminView 가 새 모듈에서 import 해 온다.
  - 파일 끝 `export {` (`5474` 부근) · `export type {` 목록, 그리고 `import type { RequestOptions } from '../api/apiClient'` 줄.
- [web/src/views/adminGroupPartMutationRunners.ts](../../web/src/views/adminGroupPartMutationRunners.ts) `1~25 행` — 직전 slice (T-1854) 가 박제한 **모듈 헤더 주석 규약** (이동 근거 · 단방향 import 방향 · 재수출로 기존 spec 보존 · `.ts` 확장자 판단 · 상수 동반 이동 근거). 본 모듈도 같은 형식을 따른다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `142~175 행` — 앞선 두 추출 모듈을 AdminView 가 import 하는 형태 (값 import + `import type` 분리 + 위 주석) 의 선례.
- [web/src/views/adminGroupPartMutationRunners.test.ts](../../web/src/views/adminGroupPartMutationRunners.test.ts) — 신설 모듈 **경계 spec** 의 선례. [adminCollectionTargetRunners.test.ts](../../web/src/views/adminCollectionTargetRunners.test.ts) `3~10 행` 주석이 그 범위 규약 (기존 spec 의 상세 행동을 복제하지 않고 "새 모듈 자신의 공개 표면" 만 검증) 의 정본이다.
- [web/src/views/AdminView.person-create-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-create-identity-autoselect.test.tsx) `158~171 행` — `AdminView.tsx` **원문을 `readFileSync` 로 읽어** `onCreated: (personId) => setSelectedIdentityPersonId(personId)` 배선을 정규식으로 잠그는 drift-guard. 같은 형태가 [AdminView.person-update-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-update-identity-autoselect.test.tsx) `135~147 행` 에도 있다. **두 정규식이 잠그는 것은 컨테이너의 deps 조립부** (`handleCreatePerson` / `handleUpdatePerson`) 라 AdminView 에 그대로 남아야 하며, 러너 본문만 옮기면 계속 green 이다 — 이동 후 반드시 재확인한다.
- [docs/PLAN.md](../PLAN.md) `183 행` — 대상 좌표 · 측정 방법 (`wc -l` / 선언 수 `grep -cE`) · 목표선의 정본.

## Acceptance Criteria

- [ ] `web/src/views/adminPersonMutationRunners.ts` 신설 — 위 2 블록의 **11 심볼** (입력 타입 2 · deps 타입 3 · 순수 helper 2 · async 러너 3, 세부 구성은 위 좌표 참조) 과 `PERSONS_PATH` 상수를 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`. 허용 변경은 (i) 선언 앞 `export` 키워드 추가, (ii) `import type { RequestOptions } from '../api/apiClient'` 1 줄 추가 뿐이다.
- [ ] 모듈 최상단 헤더 주석 — 이동 근거 (PLAN `183 행` 부채 · 다섯째 실분할) · **AdminView → 본 모듈 단방향 import** 규약 (본 모듈은 AdminView 를 import 하지 않는다) · 재수출로 기존 spec 을 보존한다는 사실 · `PERSONS_PATH` 동반 이동 근거 (역방향 import 차단, T-1854 `GROUPS_PATH` 선례) · `.ts` 확장자 판단을 명시.
- [ ] `AdminView.tsx` 는 옮긴 심볼과 `PERSONS_PATH` 를 새 모듈에서 import 하고, `PERSONS_PATH` 를 **재선언하지 않는다** (정본 1 개 유지). `buildPersonsPath` 가 import 한 상수를 그대로 쓴다.
- [ ] `AdminView.tsx` 파일 끝 `export {` / `export type {` 목록의 **공개 표면이 이동 전과 정확히 같다** — 값 심볼 (`runCreatePerson` · `extractCreatedPersonId` · `runDeletePerson` · `buildPersonPatch` · `runUpdatePerson`) 과 타입 심볼 (`CreatePersonFields` · `CreatePersonDeps` · `DeletePersonDeps` · `PersonPatchInput` · `PersonPatch` · `UpdatePersonDeps`) 을 그대로 re-export 한다. 이동 전에 export 표면이 아니었던 심볼 (`PERSONS_PATH`) 은 AdminView 에서 새로 export 하지 않는다.
- [ ] 기존 spec **6 개** (`AdminView.person-create-contract` · `person-delete-contract` · `person-update-contract` · `person-create-identity-autoselect` · `person-update-identity-autoselect` · `AdminView.test.tsx`) 의 `from './AdminView'` 가 **한 줄도 수정되지 않고** 통과한다. 특히 두 identity-autoselect spec 의 `readFileSync` drift-guard 정규식 2 개가 AdminView 원문에서 계속 매칭돼야 한다 (컨테이너 배선은 옮기지 않으므로 무수정 통과가 정상).
- [ ] **happy-path unit test** — 신설 경계 spec `adminPersonMutationRunners.test.ts` 에서 러너 3 개 (`runCreatePerson` · `runDeletePerson` · `runUpdatePerson`) 가 **직접 import 경로** 로도 각각 정확한 primitive 를 1 회 발사하고 (`POST /api/persons` · `DELETE /api/persons/:id` · `PATCH /api/persons/:id`) 성공 전이 (재조회 트리거 · 입력 초기화 · 편집 종료 · optional 후속 훅) 를 수행함을 검증 (러너당 1+). 순수 helper 2 개 (`extractCreatedPersonId` · `buildPersonPatch`) 도 정상 입력 1+.
- [ ] **error path unit test** — 러너 3 개 각각의 주입 primitive 가 reject 할 때 **throw 없이** error 문구를 error state 로 표면화하고 진행 플래그를 `finally` 로 되돌림을 검증 (러너당 1+).
- [ ] **분기 cover** — 각 러너의 no-op 가드 분기를 분리해 test: 생성은 `fullName`/`email` 공백 가드 · in-flight (`creating`) 가드, 삭제는 `id` 공백 가드 · in-flight (`deleting`) 가드, 수정은 `id` 공백 가드 · in-flight (`updating`) 가드 · **변경 필드가 없어 patch 가 비면 미발사** 분기. `extractCreatedPersonId` 는 (정상 문자열 id / id 부재 · 비문자열 / 공백 id) 갈래를, `buildPersonPatch` 는 (필드별 변경 있음 / 미변경 skip / 전부 미변경) 갈래를 각각 test.
- [ ] **negative cases 충분 cover** — 최소 5 종 이상: ① 공백만 있는 `fullName` 또는 `email` 로 POST 0 회 ② 공백 `id` 로 DELETE/PATCH 0 회 ③ in-flight 중 재호출 시 이중 발사 0 ④ 실패 경로에서 목록 재조회 트리거 미호출 + optional 후속 훅 (`onCreated`/`onUpdated`) 미호출 ⑤ 미변경 입력으로 PATCH 0 회 ⑥ **재수출 identity 보존** — `AdminView` 에서 import 한 심볼과 새 모듈에서 import 한 심볼이 **동일 함수 참조** (`toBe`) 임을 값 심볼 5 개 전부에 대해 검증 (기존 계약 spec 의 위임 검증이 계속 유효함을 기계적으로 고정).
- [ ] 경계 spec 은 기존 계약 spec 3 개의 상세 행동 검증을 **복제하지 않는다** — 검증 범위는 "새 모듈 자신의 공개 표면" 으로 한정하고, 그 범위 규약을 spec 최상단 주석에 명시 (T-1830 선례).
- [ ] `cd web && pnpm test` (vitest) 전량 green — 기존 spec 6 개가 수정 없이 통과하는 것이 곧 순수 추출 조건 (c) 의 기계적 증거다.
- [ ] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과. web 번들은 `cd web && pnpm build` 로 확인 (import 경로 변경 반영).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [ ] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `5569` 보다 **270 줄 이상 작아진다** (이동 304 줄 - 새 import 블록 약 25 줄).

## Out of Scope

- `createInFlightIdGate` (`2208 행` 부근) 이동 — ServiceIdentity · 역할 변경 경로도 공유하는 범용 게이트라 인원 축과 함께 옮기지 않는다 (PLAN `183 행` 이 명시한 경계).
- `CREATE_USER_ERROR_SEPARATOR` 이하 사용자 축 · `UpdateProviderFields` 이하 LLM provider 축 심볼 이동 — 다음 슬라이스 대상이며 본 slice 범위 밖.
- 러너 본문 로직 개선 (가드 추가 · 에러 문구 변경 · 중복 제거 · 타입 정리) — **순수 추출** 이므로 본문 한 줄도 바꾸지 않는다. 개선 여지가 보이면 Follow-ups 에 적는다.
- 컨테이너 (`handleCreatePerson` / `handleDeletePerson` / `handleUpdatePerson`) 의 deps 조립부 이동 — AdminView 에 남긴다 (두 identity-autoselect drift-guard 가 그 원문을 잠근다).
- 기존 계약 spec 6 개의 수정 — 무수정 통과가 본 task 의 성공 조건이다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 LOC · 다음 대상 문구 갱신 — `direct` 대상이라 [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 3 대로 본 task 에 섞지 않고 Follow-ups 로 분리한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예정) `direct` — PLAN `183 행` 부채 bullet 의 실측 LOC 갱신 (`wc -l` + 선언 수 재측정) + 다음 추출 대상 (사용자 축 또는 LLM provider 축) 좌표 지목.

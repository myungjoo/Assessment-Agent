---
id: T-1854
title: AdminView 의 그룹·파트 mutation 러너 군을 별도 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminGroupPartMutationRunners.ts
  - web/src/views/adminGroupPartMutationRunners.test.ts
estimatedDiff: 1300
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + RequestOptions import 경로 조정 + 선언 앞 export 키워드만) · (b) 신규 로직 0 LOC (러너 6 · deps 타입 6 · helper 2 의 본문 무변경) · (c) 기존 spec 7 개 (group/part contract 6 + AdminView.test.tsx) 가 AdminView 재수출 덕에 import 경로까지 무수정 통과. 삭제 487 + 추가 약 505 가 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 넷째 실분할 — T-1853 이 head 에서 재측정해 지목한 그룹·파트 mutation 러너 군 3 블록 472 행"
created: 2026-09-02
---

# T-1854 — AdminView 의 그룹·파트 mutation 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **후속 `pr` task** 다. 그 bullet 이 직전 fire ([T-1853](T-1853-plan-adminview-debt-remeasure.md)) 에서 head 재측정을 마치고 **다음 대상을 "그룹/파트 mutation 러너 군 (deps interface 6 + async 러너 6 + 파트 삭제 helper 2), 비연속 3 블록 합계 472 줄"** 로 명시해 뒀다. 본 slice 가 그 지목을 그대로 집행한다.

부채 실측은 `6,053 줄` (2026-09-02 head) 로 최초 기록 `6,087 줄` 대비 **-34 줄** 에 그친다 — 앞선 순수 추출 3 슬라이스가 빼낸 만큼 다시 붙었다는 뜻이며 **append 속도가 extract 속도를 앞선다**. 목표선 `≤ 2,000 줄` 은 추출을 지속해야만 도달하므로, 직전 T-1852 의 `-200 줄` 보다 큰 `-472 줄` 페이스를 본 slice 가 낸다.

**planner issue-still-relevant pre-check (origin/main `5036f653` 실측)** — 미안착이 맞다: ① `git ls-tree origin/main web/src/views/` 에 `adminGroupPartMutationRunners` 파일 **0 건** (기존 추출 모듈은 `adminServiceIdentityRowActions.tsx` · `adminCollectionTargetRunners.ts` · `adminServiceIdentityRunners.ts` 3 개뿐이며 그룹·파트 축은 없다). ② 대상 14 심볼은 여전히 `AdminView.tsx` 본문에 있고 파일 끝 `export {` (`5921 행`) 에서만 노출된다. ③ 세 블록은 외부 값 import 를 하나도 쓰지 않는다 (모든 발사 primitive 가 deps 주입, `trim()` 등 내장만 사용) — 타입 `RequestOptions` 만 `../api/apiClient` 에서 가져오면 본문 재작성이 0 이 된다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 **비연속 3 블록**이며, 각 선언 위 주석 블록까지 포함한 경계는 다음과 같다 (origin/main `5036f653` 기준):
  - **create 축** `1888~2032 행` — `CreateGroupDeps` (`1893`) · `runCreateGroup` (`1916`) · `CreatePartDeps` (`1962`) · `runCreatePart` (`1990`). 종료 직후 `2034 행` 의 `CREATE_USER_ERROR_SEPARATOR` 주석은 **범위 밖**.
  - **delete 축** `2421~2579 행` — `DeleteGroupDeps` (`2426`) · `runDeleteGroup` (`2447`) · `DeletePartDeps` (`2485`) · `runDeletePart` (`2506`) · `resolveSelectedPartIdAfterDelete` (`2550`) · `buildDeletePartBumpRefresh` (`2570`). 종료 직후 `2581 행` 부터의 `PersonPatchInput` 주석은 **범위 밖**.
  - **update 축** `2718~2900 행` — `UpdateGroupDeps` (`2723`) · `runUpdateGroup` (`2751`) · `UpdatePartDeps` (`2812`) · `runUpdatePart` (`2844`). 종료 직후 `2902 행` 부터의 `UpdateProviderFields` 주석은 **범위 밖**.
  - 파일 끝 `export {` (`5921 행`) 과 `export type {` (`6004 행`) 목록, 그리고 `21 행` `import type { RequestOptions } from '../api/apiClient'` 도 함께 본다.
- [web/src/views/adminServiceIdentityRunners.ts](../../web/src/views/adminServiceIdentityRunners.ts) `1~16 행` — 직전 slice (T-1852) 가 박제한 **모듈 헤더 주석 규약** (이동 근거 · 단방향 import 방향 · 재수출로 기존 spec 보존 · 확장자 판단). 본 모듈도 같은 형식을 따른다.
- [web/src/views/adminServiceIdentityRunners.test.ts](../../web/src/views/adminServiceIdentityRunners.test.ts) — 신설 모듈 **경계 spec** 의 선례. [adminCollectionTargetRunners.test.ts](../../web/src/views/adminCollectionTargetRunners.test.ts) `3~10 행` 주석이 그 범위 규약 (기존 spec 의 상세 행동을 복제하지 않고 "새 모듈 자신의 공개 표면" 만 검증) 의 정본이다.
- [web/src/views/AdminView.group-create-contract.test.ts](../../web/src/views/AdminView.group-create-contract.test.ts) `1~10 행` — `from './AdminView'` 로 러너를 직접 부르는 기존 계약 spec 6 개의 대표. 이 파일들이 **한 줄도 수정되지 않아야** 한다는 것이 순수 추출 조건 (c) 의 기계적 증거다.
- [docs/PLAN.md](../PLAN.md) `183 행` — 대상 좌표 · 측정 방법 (`wc -l` / 선언 수 `grep -cE`) · 목표선의 정본.

## Acceptance Criteria

- [ ] `web/src/views/adminGroupPartMutationRunners.ts` 신설 — 위 3 블록의 **14 심볼** (deps interface 6 · async 러너 6 · 순수 helper 2) 을 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`. 허용 변경은 (i) 선언 앞 `export` 키워드 추가, (ii) `import type { RequestOptions } from '../api/apiClient'` 1 줄 추가 뿐이다.
- [ ] 모듈 최상단 헤더 주석 — 이동 근거 (PLAN `183 행` 부채 · 넷째 실분할) · **AdminView → 본 모듈 단방향 import** 규약 (본 모듈은 AdminView 를 import 하지 않는다) · 재수출로 기존 spec 을 보존한다는 사실 · `.ts` 확장자 판단 근거를 명시 (T-1852 헤더 형식 준수).
- [ ] `AdminView.tsx` 는 옮긴 심볼을 새 모듈에서 import 하고, 파일 끝 `export {` 목록의 8 개 값 심볼 (`runCreateGroup` · `runCreatePart` · `runDeleteGroup` · `runDeletePart` · `resolveSelectedPartIdAfterDelete` · `buildDeletePartBumpRefresh` · `runUpdateGroup` · `runUpdatePart`) 을 **그대로 re-export** 한다. deps 타입 6 개는 이동 전에도 AdminView 의 export 표면이 아니었다면 재수출하지 않고 새 모듈에서만 export 한다 (공개 표면 무변경 — `export type {` 목록을 실제로 확인해 판단).
- [ ] 기존 spec **7 개** (`AdminView.group-create-contract` · `group-delete-contract` · `group-update-contract` · `part-create-contract` · `part-delete-contract` · `part-update-contract` · `AdminView.test.tsx`) 의 `from './AdminView'` 가 **한 줄도 수정되지 않고** 통과한다.
- [ ] **happy-path unit test** — 신설 경계 spec `adminGroupPartMutationRunners.test.ts` 에서 러너 6 개가 **직접 import 경로** 로도 각각 정확한 primitive 를 1 회 발사하고 성공 전이 (`bumpRefresh` · 입력 초기화 · 편집 종료 등) 를 수행함을 검증 (러너당 1+). helper 2 개도 정상 입력 1+.
- [ ] **error path unit test** — 러너 6 개 각각의 주입 primitive 가 reject 할 때 throw 없이 error 문구를 표면화하고 진행 플래그를 `finally` 로 되돌림을 검증 (러너당 1+).
- [ ] **분기 cover** — 각 러너의 no-op 가드 분기를 분리해 test: 생성 2 종은 `name` 공백 가드 · in-flight 가드, 삭제 2 종은 `id` 공백 가드 · in-flight 가드, 수정 2 종은 `id` 공백 가드 · `name` 공백 가드 · **원본과 동일해 미변경이면 미발사** 분기 · in-flight 가드. `resolveSelectedPartIdAfterDelete` 는 (삭제 id 공백 / 선택과 일치 / 불일치) 3 갈래를 각각 test.
- [ ] **negative cases 충분 cover** — 최소 5 종 이상: ① 공백만 있는 `name` 미발사 ② 공백 `id` 미발사 ③ in-flight 중 재호출 시 이중 발사 0 ④ 실패 경로에서 목록 재조회 (`bumpRefresh`) 미호출 ⑤ 수정 러너의 `originalName` 과 trim 후 동일하면 PATCH 0 회 ⑥ 재수출 identity 보존 — `AdminView` 에서 import 한 심볼과 새 모듈에서 import 한 심볼이 **동일 함수 참조** (`toBe`) 임을 8 개 값 심볼 전부에 대해 검증.
- [ ] 경계 spec 은 기존 계약 spec 6 개의 상세 행동 검증을 **복제하지 않는다** — 검증 범위는 "새 모듈 자신의 공개 표면" 으로 한정하고, 그 범위 규약을 spec 최상단 주석에 명시 (T-1830 선례).
- [ ] `cd web && pnpm test` (vitest) 전량 green — 기존 spec 7 개가 수정 없이 통과하는 것이 곧 (c) 조건의 기계적 증거.
- [ ] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과. web 쪽 번들은 `cd web && pnpm build` 로 확인 (import 경로 변경 반영).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [ ] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `6053` 보다 **450 줄 이상 작아진다** (이동 487 줄 - 새 import 블록 약 20 줄).

## Out of Scope

- 러너·helper 본문 로직 수정 · 리네이밍 · 시그니처 변경 · 주석 재작성 (순수 추출 조건 (a)(b) 위반).
- 기존 spec 7 개의 import 경로 변경 (재수출로 무수정 통과가 본 slice 의 검증 지표다).
- 인접한 다른 helper 군 (사용자 생성 · 인원 patch · LLM provider · 스케줄 · import/export) 의 추출 — 각각 별도 slice. 특히 `CREATE_USER_ERROR_SEPARATOR` (`2034 행 ~`) · `PersonPatchInput` (`2581 행 ~`) · `UpdateProviderFields` (`2902 행 ~`) 는 경계 **밖**이므로 건드리지 않는다.
- [docs/PLAN.md](../PLAN.md) `183 행` 의 실측 LOC 갱신 — 본 slice 는 `pr` 이고 PLAN 갱신은 `direct` 라 §3.1 판정 규칙 3 에 따라 별도 task 다.
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 동작 변경 0 이라 REQ 상태를 바꾸지 않는다 (§3.1 판정 규칙 6).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음)

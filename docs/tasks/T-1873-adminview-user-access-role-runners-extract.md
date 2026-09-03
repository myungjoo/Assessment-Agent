---
id: T-1873
title: AdminView 의 인스턴스 접근·역할 변경 mutation 러너 군을 adminUserMutationRunners 로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-039]
independentStream: adminview-god-component-refactor
dependsOn: [T-1872]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminUserMutationRunners.ts
  - web/src/views/adminUserMutationRunners.test.ts
estimatedDiff: 560
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (연속 블록 1 개 + 동반 상수 4 개를 옮기고 선언 앞에 export 를 붙인 뒤 단방향 import 로 배선하는 것이 전부) · (b) 신규 로직 0 LOC (러너 3 · 순수 helper 1 · 타입 4 · 상수 4 의 본문 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출 덕에 `from './AdminView'` 무수정 통과하고, AdminView 소스를 읽는 drift-guard 3 개는 단언 대상이 전부 잔류부(컨테이너 배선 · markup · users fire call site)라 무영향(실측). 삭제 약 205 + 추가 약 215 가 전부 이동량이며 나머지는 신규 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열한째 실분할 — 사용자 관리 축 잔여인 권한·역할 10 심볼 + 동반 상수 4 로 축 마감"
created: 2026-09-04
completedAt: 2026-09-03T16:56:21Z
prNumber: 1465
mergeCommit: 52a4caf56c2c3dc5d387a0b900a3fa98ec1ff3ef
---

# T-1873 — AdminView 의 인스턴스 접근·역할 변경 mutation 러너 군을 adminUserMutationRunners 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 다음 대상으로 지목한 **사용자 관리 mutation 축 17 심볼** 중 생성 축 7 심볼은 [T-1872](T-1872-adminview-create-user-runners-extract.md) 가 [adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) 로 옮겨 소진했고, 본 task 는 **잔여인 권한 · 역할 축 10 심볼**을 같은 모듈로 옮겨 축을 마감한다. cap 이 append 를 싸게 extract 를 비싸게 만들어 온 구조를 되돌리는 순수 추출 슬라이스이며, 목표선 (≤ 2,000 줄) 까지의 잔여를 줄이는 열한째 슬라이스다.

**issue-still-relevant pre-check (origin/main `b7bb1336` 실측, 2026-09-04)** — ① `git grep -nE 'function runChangeRole|function runGrantInstanceAccess|function runRevokeInstanceAccess' origin/main -- web/src/views/` 가 세 러너를 여전히 `AdminView.tsx` 의 `1284 행` · `1184 행` · `1234 행` 에서만 찾는다. ② `adminUserMutationRunners.ts` 안의 `runChangeRole` 히트 2 건 (`14 행` · `33 행`) 은 **주석뿐** 이고, 그 중 `14 행` 이 "runRevokeInstanceAccess · runChangeRole 등은 후속 slice 로 넘긴다" 고 직접 적어 본 task 가 그 후속임을 확인해 준다. ③ `wc -l` 실측 `4,392 줄` · 선언 `84` 개로 PLAN bullet 의 5 차 실측값 (`4,497 줄` · 93) 대비 T-1872 머지분만큼만 줄어 있다 — 중복 · 선행 박제 0. ④ **T-1871 이 적어둔 행 좌표 `1234~1426 행` 은 T-1872 머지로 밀렸다** — 본 task 는 head 재실측값 (`1129~1321 행`) 을 쓴다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 블록 `1129~1321 행`, 동반 상수 `338~354 행`, 소비처 `2984~3060 행`, 배럴 `4318~4322 행` (값) · `4369~4373 행` (타입).
- [web/src/views/adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) — 이동 목적지. `44 행` 의 `USERS_PATH` 를 이미 소유하고 있어 새 모듈 신설이 불필요하다.
- [web/src/views/adminUserMutationRunners.test.ts](../../web/src/views/adminUserMutationRunners.test.ts) — 신규 경계 spec 을 덧붙일 파일. `121 행` describe 가 본 task 가 따를 형식의 선례다.
- [docs/tasks/T-1872-adminview-create-user-runners-extract.md](T-1872-adminview-create-user-runners-extract.md) — 직전 슬라이스의 이동 규약 (본문 무변경 · 단방향 import · 배럴 재수출).
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 절단선 후보 서술 (본 task 가 그 두 번째 절단선).

## 이동 대상 (head `b7bb1336` 실측)

**연속 1 블록 `1129~1321 행` (193 줄) 의 10 심볼** — `buildInstanceAccessPath` · `InstanceAccessFormInput` · `InstanceAccessFormFlags` · `deriveInstanceAccessFormFlags` · `GrantInstanceAccessDeps` · `runGrantInstanceAccess` · `RevokeInstanceAccessDeps` · `runRevokeInstanceAccess` · `ChangeRoleDeps` · `runChangeRole`.

**동반 상수 4** (러너 본문만 쓰는 module-private 상수라 함께 옮기지 않으면 역방향 import 가 된다) — `USER_ROLE_FORBIDDEN_ERROR` (`342 행`) · `INSTANCE_ACCESS_DUPLICATE_ERROR` (`348 행`) · `INSTANCE_ACCESS_GRANTED_TEXT` (`349 행`) · `INSTANCE_ACCESS_REVOKED_TEXT` (`354 행`). 각 상수의 선행 주석도 함께 옮긴다 (근거 문맥 유실 방지).

**경계 밖 — 옮기지 않는다**: `INSTANCE_ACCESS_NO_USER_LABEL` (`350 행` — markup `3728 행` 이 소비하는 select 라벨이라 잔류) · `InFlightIdGate` (`1325 행`) · `createInFlightIdGate` (`1337 행`) (컨테이너 소유 범용 gate) · 위쪽 `runAdd` (멤버십 축).

## Acceptance Criteria

- [ ] 위 10 심볼 + 동반 상수 4 가 [adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) 로 옮겨졌고, 각 선언의 **본문이 한 줄도 바뀌지 않았다** (`export` 키워드 부착과 주석 위치 이동만 허용).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 옮긴 심볼을 `./adminUserMutationRunners` 에서 값 import · 타입 import 로만 받아 쓴다. **새 모듈이 `./AdminView` 를 import 하는 역방향 의존이 0** 이다 (`grep -n "from './AdminView'" web/src/views/adminUserMutationRunners.ts` 가 빈 결과).
- [ ] AdminView 파일 끝 배럴 (`export { ... }` · `export type { ... }`) 이 옮긴 10 심볼을 **그대로 재수출**해 공개 표면이 무변경이다 — 기존 spec 의 `from './AdminView'` 가 무수정으로 산다.
- [ ] `adminUserMutationRunners.test.ts` 에 신규 describe 1 개를 덧붙여 **새 모듈 직접 import 경계**를 검증한다 (기존 `121 행` describe 선례 동형, 기존 계약 spec 의 복제 금지):
  - [ ] happy-path 1+ — `runGrantInstanceAccess` 가 `POST /api/users/:id/instance-access` 를 1 회 발사하고 성공 안내 문구 전이를 낸다.
  - [ ] happy-path 1+ — `runRevokeInstanceAccess` · `runChangeRole` 각각의 정상 발사 · 성공 전이 (러너별 1+).
  - [ ] error path 1+ — 주입된 fetch 가 reject 해도 러너가 **throw 하지 않고** 실패 문구를 세팅하며 `finally` 가 진행 플래그 해제를 보장한다 (러너별 1+).
  - [ ] 분기 cover — `runGrantInstanceAccess` 의 409 (`isConflict` true → `INSTANCE_ACCESS_DUPLICATE_ERROR`) 대 그 외 분기, `runChangeRole` 의 403 (`isForbidden` true → `USER_ROLE_FORBIDDEN_ERROR`) 대 그 외 분기, `deriveInstanceAccessFormFlags` 의 각 분기를 **분기마다 1+** test.
  - [ ] negative cases 충분 cover — 각 1+ test: ① 빈 `userId` (공백만) 이면 미발사 · 상태 전이 0 · ② 빈 `instanceRef` (공백만) 이면 미발사 · ③ in-flight true 재호출 시 이중 발사 0 · ④ `runChangeRole` 의 빈 role 미발사 · ⑤ `buildInstanceAccessPath` 가 특수문자 id 를 `encodeURIComponent` 로 인코딩해 형제 자원 (`/api/groups` 등) 으로 오발사하지 않음 · ⑥ 실패 경로가 `bumpRefresh` 를 부르지 않음.
  - [ ] 동일 참조 검증 1+ — AdminView 재수출본과 새 모듈 직접 import 본이 **같은 함수 참조** 다 (기존 계약 spec 의 위임 검증이 이동 후에도 유효함의 근거).
- [ ] `cd web && pnpm test` 통과 (기존 web vitest 전량 무수정 green — 소스를 읽는 drift-guard 3 개 `AdminView.test.tsx` `9186 행` · `9604 행`, `AdminView.users-list-contract.test.ts` `111 행` 포함).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (`coverageThreshold`).
- [ ] `pnpm lint && pnpm build` 통과 (web · backend 양쪽).
- [ ] `wc -l web/src/views/AdminView.tsx` 가 `4,392` 미만으로 줄었고 실측값을 PR 본문에 적는다 (다음 PLAN 갱신의 입력).

## Out of Scope

- 러너 · helper 의 **동작 변경 · 시그니처 변경 · 리네이밍** — 순수 추출이므로 본문 수정 0. 개선 아이디어는 Follow-ups 로.
- `InFlightIdGate` · `createInFlightIdGate` · `INSTANCE_ACCESS_NO_USER_LABEL` 이동 (경계 밖 — 위 "경계 밖" 절 참조).
- 멤버십 축 (`runAdd` 등) · 그 밖의 잔여 축 추출 — 별도 슬라이스.
- [docs/PLAN.md](../PLAN.md) `183 행` 부채 bullet 의 실측 수치 갱신 — `direct` commit 이라 §3.1 규칙 3 대로 별도 task 다.
- 기존 계약 spec (`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts`) 의 import 경로 변경 — 배럴 재수출로 무수정 통과가 원칙이며, 굳이 옮기지 않는다.
- 새 dependency 추가 (0 이어야 한다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

## 결과 요약 (2026-09-03 완료)

PR [#1465](https://github.com/myungjoo/Assessment-Agent/pull/1465) 머지 (squash → main `52a4caf5`, round 1 APPROVE). 권한 · 역할 축 10 심볼 + 동반 상수 4 를 `adminUserMutationRunners.ts` 로 옮기고 선언 앞에 `export` 만 부착해 본문 diff 0 을 지켰다 (`+249/-228`). `AdminView.tsx` 는 `4,392` → **`4,198` 줄** 로 줄었고, 배럴 10 심볼 재수출 유지로 공개 표면 · 기존 계약 spec 은 무수정 통과했다. `INSTANCE_ACCESS_NO_USER_LABEL` 은 markup 소비처가 잔류부라 옮기지 않았다 (경계 밖 판정 그대로).

신규 경계 describe 1 개 (`+446`) 로 R-112 4 종을 채웠다 — happy 3 · error 3 · 분기 3 (409 · 403 · 파생 진리표) · negative 6 · 동일 참조 1, 총 16 케이스. web vitest `3,713` → `3,729` 전량 green (기존 125 파일 무수정, drift-guard 3 종 포함), `pnpm test:cov` line · function ≥ 80% 통과, `pnpm lint && pnpm build` web · backend 양쪽 통과. PR head run `33780946997` = success.

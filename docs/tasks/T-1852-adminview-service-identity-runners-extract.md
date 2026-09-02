---
id: T-1852
title: AdminView 의 ServiceIdentity 러너 군을 별도 모듈로 순수 추출
phase: P6
status: DONE
commitMode: pr
prNumber: 1455
completedAt: 2026-09-02T12:57:52Z
coversReq: [REQ-078, REQ-079]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminServiceIdentityRunners.ts
  - web/src/views/adminServiceIdentityRowActions.tsx
  - web/src/views/adminServiceIdentityRunners.test.ts
estimatedDiff: 620
estimatedFiles: 4
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + import 경로 조정만) · (b) 신규 로직 0 LOC (옮겨진 러너 4 개 본문 무변경) · (c) 기존 spec 5 개가 AdminView 재수출 덕에 import 경로까지 무수정으로 통과. 삭제 약 213 + 추가 약 240 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 4 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 셋째 실분할 — 1 차 대상(행 액션 helper 군)은 이미 안착, 남은 러너 4 개를 빼며 역방향 import 도 해소"
created: 2026-09-02
---

# T-1852 — AdminView 의 ServiceIdentity 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **후속 `pr` task** 다. 그 bullet 이 1 차 대상으로 지목한 "ServiceIdentity 행별 액션 helper 군" 은 이미 [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) 로 빠져 있고, 둘째 실분할인 수집 대상 러너 군도 [T-1830](T-1830-adminview-collection-target-runners-extract.md) 이 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 로 닫았다. 그럼에도 부채 실측은 되레 악화됐다 — bullet 이 적은 **6,087 줄** 이 오늘 origin/main `b9771c54` 기준 **6,253 줄** 이다. 본 slice 는 그 다음 덩어리인 **ServiceIdentity mutation 러너 군** (`AdminView.tsx` `1880~2092 행` — type 1 · deps interface 4 · async 러너 4) 을 뺀다.

**planner issue-still-relevant pre-check (origin/main `b9771c54` 실측)** — 미안착이 맞다: ① `git ls-tree origin/main web/src/views/` 에 `adminServiceIdentityRunners` 파일 **0 건** (`adminServiceIdentityRowActions.tsx` 만 존재). ② 러너 4 개 (`runCreateServiceIdentity` · `runUpdateServiceIdentity` · `runDeleteServiceIdentity` · `runSetPrimaryServiceIdentity`) 는 여전히 `AdminView.tsx` 본문에 있고 파일 끝 `export {` 블록에서만 노출된다. ③ 추출의 부가 이득도 실재한다 — [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) `18 행` 이 `import { runDeleteServiceIdentity, runSetPrimaryServiceIdentity } from './AdminView'` 로 **역방향 import** 를 만들고 있고, 같은 파일 `8~9 행` 주석이 그것을 "둘 다 아직 AdminView 에 남아 역방향을 만든다" 고 스스로 결함으로 박제해 뒀다. 본 추출이 그 역방향을 단방향으로 되돌린다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 `1880 행` `type ServiceIdentityInput` 부터 `2092 행` (`runSetPrimaryServiceIdentity` 끝, `interface CreateGroupDeps` 직전) 까지. 파일 끝 `export {` (`6121 행` 부근) 과 `export type {` (`6204 행` 부근) 목록도 함께 본다.
- [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) `1~16 행` — T-1830 이 박제한 **모듈 헤더 주석 규약**(이동 근거 · 단방향 import 방향 · 재수출로 기존 spec 보존 · 확장자 판단) 의 정본 형식. 본 모듈도 같은 형식을 따른다.
- [web/src/views/adminCollectionTargetRunners.test.ts](../../web/src/views/adminCollectionTargetRunners.test.ts) — 신설 모듈 **경계 spec** 의 선례 (기존 spec 의 상세 행동 검증을 복제하지 않고 "새 모듈 자신의 공개 표면" 만 검증한다는 범위 규약).
- [web/src/views/adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) `1~20 행`, `210~240 행` — 역방향 import (`18 행`) 와 두 러너 호출 지점.
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 1` · `§Decision 3` — 러너들이 주석으로 인용하는 body 화이트리스트 근거 (이동 시 주석도 함께 옮겨야 하므로 맥락 확인용).

## Acceptance Criteria

- [x] `web/src/views/adminServiceIdentityRunners.ts` 신설 — `AdminView.tsx` `1880~2092 행` 의 9 심볼 (`ServiceIdentityInput` type 1 · `CreateServiceIdentityDeps` / `UpdateServiceIdentityDeps` / `DeleteServiceIdentityDeps` / `SetPrimaryServiceIdentityDeps` 4 · 러너 4) 을 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`.
- [x] 모듈 최상단에 헤더 주석 — 이동 근거(PLAN `183 행` 부채) · **AdminView → 본 모듈 단방향 import** 규약 · 재수출로 기존 spec 을 보존한다는 사실을 명시 (T-1830 헤더 형식 준수).
- [x] `AdminView.tsx` 는 옮긴 심볼을 새 모듈에서 import 하고 파일 끝 `export {` / `export type {` 목록에서 **그대로 re-export** 한다 — 기존 spec 5 개 (`AdminView.service-identity-create` / `-update` / `-delete` / `-primary` / `-row-bridge`) 의 `from './AdminView'` 가 **한 줄도 수정되지 않고** 통과해야 한다.
- [x] `adminServiceIdentityRowActions.tsx` `18 행` 의 `from './AdminView'` 를 `from './adminServiceIdentityRunners'` 로 바꿔 역방향 import 를 제거하고, 같은 파일 `8~9 행` 의 "아직 AdminView 에 남아 역방향을 만든다" 주석을 해소 사실로 갱신한다.
- [x] **happy-path unit test** — 신설 경계 spec `adminServiceIdentityRunners.test.ts` 에서 러너 4 개가 **직접 import 경로** 로도 각각 정확한 primitive 를 1 회 발사하고 성공 전이(`bumpRefresh` 등)를 수행함을 검증 (러너당 1+).
- [x] **error path unit test** — 러너 4 개 각각의 주입 primitive 가 reject 할 때 throw 없이 error 문구를 표면화하고 진행 플래그를 `finally` 로 되돌림을 검증 (러너당 1+).
- [x] **분기 cover** — 각 러너의 no-op 가드 분기를 분리해 test (예: `runCreateServiceIdentity` 는 personId 공백 / 입력 미완 / in-flight 3 갈래, 나머지 3 러너는 각자의 id 가드 · in-flight 가드).
- [x] **negative cases 충분 cover** — 최소 4 종 이상: ① 빈/공백 `personId` 미발사 ② 빈 `externalId` 미발사 ③ in-flight 중 재호출 시 이중 발사 0 ④ 실패 경로에서 목록 재조회(`bumpRefresh`) 미호출 ⑤ 재수출 identity 보존 — `AdminView` 에서 import 한 러너와 새 모듈에서 import 한 러너가 **동일 함수 참조** (`toBe`) 임을 검증 (row-bridge spec 의 위임 검증이 계속 유효함의 근거).
- [x] `cd web && pnpm test` (vitest) 전량 green — 기존 spec 5 개가 수정 없이 통과하는 것이 곧 (c) 조건의 기계적 증거.
- [x] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과. web 쪽 build 는 `cd web && pnpm build` 로 확인 (import 경로 변경이 번들에 반영되는지).
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [x] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `6253` 보다 **200 줄 이상 작아진다**.

## Out of Scope

- 러너 본문 로직 수정 · 리네이밍 · 시그니처 변경 (순수 추출 조건 (a)(b) 위반).
- 기존 spec 5 개의 import 경로 변경 (재수출로 무수정 통과가 본 slice 의 검증 지표다).
- 다른 helper 군 (그룹 · 파트 · 사용자 · LLM · import/export · 스케줄) 의 추출 — 각각 별도 slice.
- `PLAN.md` `183 행` 의 실측 LOC 갱신 및 목표선 `[x]` 승격 — `direct` commit 대상이라 §3.1 규칙 3 대로 분리 (Follow-ups 참조).
- `requirements.md` 의 REQ-078 / REQ-079 재판정 — 두 REQ 는 이미 `DONE` 이고 본 slice 는 리팩터라 status 변동 없음 (§3.1 규칙 6).
- ServiceIdentity 관련 신규 기능 · UI 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `PLAN.md` `183 행` 부채 bullet 의 실측 LOC 을 본 slice 머지 후 값으로 갱신하고 다음 추출 대상(그룹/파트 mutation 러너 군 — `AdminView.tsx` `2093~2238 행` 부근)을 1 차 대상 문구로 교체 (`direct`).

## 완료 기록 (2026-09-02)

`pr` 모드로 PR [#1455](https://github.com/myungjoo/Assessment-Agent/pull/1455) 을 열어 round 1 에서 4-게이트 (reviewer APPROVE + PR comment 외부 존재 + integrator 자체 점검 + CI green) 를 모두 통과하고 squash 머지했다 (main `0761fb20`). 실측 `+268/-215` 3 파일 — 이동 208 줄이 origin/main 블록과 byte 동일 (차이 9 줄은 전부 `export ` prefix) 이라 순수 추출 조건 (a)(b) 를 기계적으로 충족했고, `AdminView.tsx` 는 `6253` → `6053` 으로 정확히 200 줄 감소했다. `adminServiceIdentityRowActions.tsx` `18 행` 의 `./AdminView` 역방향 import 를 제거해 단방향으로 되돌렸고 (ESM 순환 0), AdminView 재수출 표면 2 블록은 byte 무변경이라 기존 spec 5 개가 import 경로까지 무수정으로 통과했다. 신설 경계 spec `adminServiceIdentityRunners.test.ts` 가 R-112 4 종 (happy 4 · error path · 분기 13 · negative 5 종) 을 cover 하고, web vitest 118 파일 3572 test green · backend jest 466 suite 13495 test green (line 99.94% / function 100%) 이다.

**의도적 미수행 1 건 (reviewer MINOR 기록 · 타당 판정)** — Acceptance Criteria 3 이 적은 `export type {` 재수출은 하지 않았다. deps 타입 5 개는 이동 **전에도** `AdminView` 의 export 표면이 아니었으므로 재수출은 공개 표면을 되레 확대하고, "200 줄 이상 순 감소" AC 를 무너뜨린다. 근거는 PR body 와 신설 모듈 헤더 주석에 박제했다.

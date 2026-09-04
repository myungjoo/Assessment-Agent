---
id: T-1882
title: AdminView 의 잔여 정적 표면(문구·DOM id 상수 + 폼 옵션·게이트 축 + 범위 편집 축)을 순수 추출해 helper 표면을 소진
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-045, REQ-049]
independentStream: adminview-god-component-refactor
dependsOn: [T-1880]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminViewConstants.ts
  - web/src/views/adminViewConstants.test.ts
  - web/src/views/adminCollectionTargetRunners.ts
  - web/src/views/AdminView.auth-me-contract.test.ts
estimatedDiff: 700
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`321 행` ~ `591 행` 의 잔여 top-level 상수 · 타입 · 순수 helper 를 선행 주석까지 통째로 옮기고 선언 앞에 `export` 만 붙인 뒤 AdminView 가 단방향 import 로 되돌려 쓰는 것이 전부) · (b) 신규 로직 0 LOC (`foldScopeForEdit` 의 구분자 접합 · `buildScopePatch` 의 필드별 patch 조립 · `resolveProviderSelectValue` 의 placeholder 환원 · `createInFlightIdGate` 의 ref-우선 read / write 순서 전부 본문 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출(`3498 행` ~ `3630 행`) 유지 덕에 `from './AdminView'` 무수정 통과 — planner 가 AdminView 소스를 `readFileSync` 로 읽는 drift-guard 12 파일을 전수 검사한 결과 이동 블록을 anchor 로 쓰는 spec 은 `AdminView.auth-me-contract.test.ts`(`132 행` `AUTH_ME_PATH_DECL` · `178 행` `toContain`) 1 건뿐이라 그 1 파일만 대상 소스를 새 모듈로 갈아끼운다(선례 = `AdminView.schedules-list-contract.test.ts` `138 행` 의 `SCHEDULE_RUNNERS_SOURCE` 패턴). 이동 약 220 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 은 예외 없이 준수 — 6 번째 파일이 필요해지면 ② 축을 드롭한다(Out of Scope 참조)."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열일곱째 실분할 — 잔여 순수 표면 271 줄 일괄 소진, head 9240580c 좌표 전수 재확인"
created: 2026-09-04
---

# T-1882 — AdminView 의 잔여 정적 표면을 순수 추출해 helper 표면을 소진

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 8 차 실측 갱신([T-1881](T-1881-plan-adminview-debt-remeasure-next-target.md))에서 **다음 대상으로 명시 지목한 "잔여 순수 표면 일괄 소진 슬라이스"** 의 실분할이다. bullet 의 구조 산술대로 본 슬라이스 한 건이면 `321 행` ~ `591 행` 의 잔여 helper 표면이 소진되고, 이후 남는 것은 컴포넌트 본문(2,904 줄)뿐이라 **순수 추출 경로의 마지막 슬라이스**에 해당한다.

**issue-still-relevant pre-check 실측** (planner 가 head `9240580c` 에서 전수 재측정):

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 **3,630 줄**(`wc -l`)로 PLAN bullet 8 차 실측 표기와 일치한다 — 좌표가 stale 하지 않다.
- 목적지 신규 모듈 `web/src/views/adminViewConstants.ts` 는 main 에 **미존재**하고(`ls web/src/views/` 의 비-test 모듈 14 개에 없음), 이동 대상 심볼 중 형제 모듈로 이미 옮겨진 것은 **0** 이다 — `EXPORT_SCOPE_OPTIONS` · `resolveProviderSelectValue` · `REEVAL_WINDOW_OPTIONS` · `createInFlightIdGate` 를 AdminView 밖 production 소스에서 찾으면 [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) `66 행` · `80 행` 의 **주석 언급 2 건뿐**(선언 0)이다.
- ② 축의 목적지 판정도 유효하다 — [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 는 `scopeFieldsForCollectionTargetType`(`282 행`) · `parseScopeInput`(`298 행`) 을 이미 소유하지만 `foldScopeForEdit` · `buildScopePatch` 는 **아직 없다**(부분 안착 0).
- **drift-guard 전수 검사** — AdminView 소스를 `readFileSync` 로 읽는 spec 은 12 개이고, 그 중 11 개는 `extract*FireMethod` 추출자로 **잔류 컨테이너의 fetch 호출**만 본다. 이동 블록을 소스 문자열 anchor 로 쓰는 것은 [AdminView.auth-me-contract.test.ts](../../web/src/views/AdminView.auth-me-contract.test.ts) `132 행`(`AUTH_ME_PATH_DECL`) · `178 행`(`toContain`) **1 건뿐**이라 파일 cap 산술에 1 파일로 반영했다.
- **역방향 import 1 건은 무해**하다 — [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) `22 행` 이 `import type { InFlightIdGate } from './AdminView'` 로 타입만 당겨 쓰므로 배럴 재수출을 유지하면 무수정 통과하고 런타임 cycle 도 0 이다(타입 import 는 컴파일에서 소거).

**소비처 동반 의무 충족** (CLAUDE.md §3) — 잔류 컨테이너가 이동 심볼을 계속 소비한다(AdminView 안 참조 횟수: `LLM_PROVIDER_OPTIONS` 6 · `foldScopeForEdit` 5 · `createInFlightIdGate` 5 · `EXPORT_SCOPE_OPTIONS` 4 · `EMPTY_COLLECTION_TARGET_SCOPE_INPUT` 4 · `PERSON_HEADING` 4 · `resolveProviderSelectValue` 3 · `REEVAL_WINDOW_OPTIONS` 3 · `buildScopePatch` 3 · `NOT_ADMIN_NOTICE_TEXT` 3 · `AUTH_ME_PATH` 2 · `FALLBACK_GROUP_NAME` 2). AdminView 가 새 모듈에서 import 로 되돌려 쓰는 방향이므로 소비처 없는 helper 단독 slice 가 아니다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 3 묶음: ① 문구 · DOM id 상수 22 개(`PERSON_HEADING` `323 행` ~ `FALLBACK_GROUP_NAME` `505 행`, `AUTH_ME_PATH` `416 행` 포함) · ② 수집 대상 범위 편집 축 4 심볼(`EMPTY_COLLECTION_TARGET_SCOPE_INPUT` `354 행` · `SCOPE_EDIT_SEPARATOR` `361 행` · `foldScopeForEdit` `366 행` · `buildScopePatch` `375 행`) · ③ 폼 옵션 · 게이트 축 8 심볼(`ScopeOption` `434 행` · `EXPORT_SCOPE_OPTIONS` `440 행` · `LlmProviderOption` `455 행` · `LLM_PROVIDER_OPTIONS` `461 행` · `LLM_PROVIDER_PLACEHOLDER_LABEL` `470 행` · `resolveProviderSelectValue` `479 행` · `REEVAL_WINDOW_OPTIONS` `490 행` · `InFlightIdGate` `563 행` · `createInFlightIdGate` `575 행`). **잔류 대상**은 `MeRow`(`511 행`) · `AdminViewProps`(`515 행`) · `isAdminRole`(`557 행`) 이고, 배럴 재수출 블록은 `3498 행` ~ `3630 행` 이며, `REEVAL_WINDOW_OPTIONS` 가 쓰는 `ReEvaluationWindow` 타입 import 는 `149 행` 이다.
- [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) — ② 축의 목적지. `scopeFieldsForCollectionTargetType`(`282 행`) · `parseScopeInput`(`298 행`) 이 이미 같은 축을 소유하며, 모듈 헤더 주석(`12 행`)의 배럴 재수출 서술 컨벤션도 여기서 확인.
- [web/src/views/adminProviderDifficultyDerivations.ts](../../web/src/views/adminProviderDifficultyDerivations.ts) — 직전 슬라이스([T-1880](T-1880-adminview-provider-difficulty-derivations-extract.md))가 만든 모듈. 신규 모듈의 헤더 주석 · export 스타일을 이 파일에 맞춘다.
- [web/src/views/AdminView.auth-me-contract.test.ts](../../web/src/views/AdminView.auth-me-contract.test.ts) — `117 행`(소스 로드) · `132 행`(`AUTH_ME_PATH_DECL`) · `178 행`(`toContain`) 이 본 slice 가 유일하게 손봐야 할 drift-guard anchor.
- [web/src/views/AdminView.schedules-list-contract.test.ts](../../web/src/views/AdminView.schedules-list-contract.test.ts) — `138 행` 이 대상 소스를 `SCHEDULE_RUNNERS_SOURCE` 로 갈아끼운 선례. 위 anchor 수정은 이 패턴을 그대로 따른다.
- [web/src/views/AdminView.collection-targets-scope-edit.test.tsx](../../web/src/views/AdminView.collection-targets-scope-edit.test.tsx) — `63 행` 이 `foldScopeForEdit` · `buildScopePatch` 를 배럴(`from './AdminView'`)로 당겨 쓴다. **무수정 통과가 본 slice 의 회귀 판정 기준**이다.
- [docs/PLAN.md](../PLAN.md) `183 행` — 본 슬라이스를 지목한 부채 bullet(3 묶음 · 목적지 · 파일 cap 주의 · 기대 순 감소 `-230 줄` 안팎).

## Acceptance Criteria

- [ ] 신규 모듈 `web/src/views/adminViewConstants.ts` 에 위 ① 문구 · DOM id 상수 군과 ③ 폼 옵션 · 게이트 축을 **본문 무변경으로** 옮기고 각 선언에 `export` 를 붙였다. 모듈 상단에 한국어 헤더 주석으로 소유 범위(렌더 비의존 정적 표면)와 배럴 재수출 유지 사실을 적었다.
- [ ] ② 수집 대상 범위 편집 축 4 심볼을 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 로 **본문 무변경으로** 옮겼다(같은 모듈의 `parseScopeInput` · `scopeFieldsForCollectionTargetType` 와 한 축).
- [ ] `AdminView.tsx` 는 옮긴 심볼을 새 모듈 · 기존 모듈에서 **import 로 되돌려 쓰고**, 배럴 재수출 블록(`3498 행` ~ `3630 행`)에 옮긴 공개 심볼을 그대로 유지해 **공개 표면이 무변경**이다(`MeRow` · `AdminViewProps` · `isAdminRole` 은 잔류).
- [ ] 신규 colocated spec `web/src/views/adminViewConstants.test.ts` 를 추가했다 — **happy-path**: `resolveProviderSelectValue` 가 알려진 provider 값을 그대로 돌려주고, `createInFlightIdGate` 의 `write` → `read` 가 같은 tick 에 방금 쓴 값을 돌려주며, `EXPORT_SCOPE_OPTIONS` · `LLM_PROVIDER_OPTIONS` · `REEVAL_WINDOW_OPTIONS` 의 값 집합이 기대와 일치한다.
- [ ] **error / negative path** test 를 예외 분기마다 1+ 추가했다 — `resolveProviderSelectValue(undefined)` · 빈 문자열 · 목록에 없는 미지 provider 값이 각각 placeholder 로 환원되고, `createInFlightIdGate` 가 `undefined` 로 해제될 때 `read` 가 `undefined` 를 돌려주며, 옵션 배열에 중복 value 가 없고 빈 label 이 없다(경계값).
- [ ] **flow / 분기 cover** — `resolveProviderSelectValue` 의 인식 / 미인식 두 분기, `createInFlightIdGate` 의 `write` 가 ref 를 먼저 동기 갱신하고 `setState` 를 뒤에 부르는 **순서 계약**(호출 순서 assert) 을 각각 별도 test 로 나눴다.
- [ ] ② 축 4 심볼은 기존 [AdminView.collection-targets-scope-edit.test.tsx](../../web/src/views/AdminView.collection-targets-scope-edit.test.tsx) 가 배럴 import 로 계속 cover 하며 **그 파일은 무수정**이다(수정이 필요해지면 순수 추출 조건 (c) 위반이므로 이동 방식을 재검토한다).
- [ ] `AdminView.auth-me-contract.test.ts` 의 `AUTH_ME_PATH` anchor 를 새 모듈 소스 대조로 갈아끼웠고(선례 `AdminView.schedules-list-contract.test.ts` `138 행`), 그 spec 이 통과한다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전량 통과 — 특히 AdminView 를 렌더하는 기존 spec 군이 **한 줄도 수정되지 않은 채** green 이다(동작 변경 0 의 실증).
- [ ] 변경 파일 수가 **5 개 이하**임을 `git diff --stat` 으로 확인했다(LOC 만 면제 — 파일 cap 은 예외 없음).
- [ ] 순수 추출 3 조건 (a) 동작 변경 0 · (b) 신규 로직 0 LOC · (c) 기존 spec 무수정 통과 를 PR 본문에 명시했다.

## Out of Scope

- 컴포넌트 본문(`593 행` ~ `3496 행`)의 prelude · JSX 분해 — PLAN bullet 이 순수 추출 3 조건 충족 여부를 **착수 전 별도 판단** 대상으로 못박은 영역이라 본 slice 는 손대지 않는다.
- 잔류 확정 심볼 `MeRow` · `AdminViewProps` · `isAdminRole` 이동(컴포넌트 계약 밀착 — 옮기면 역방향 import 위험).
- [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) `22 행` 의 역방향 `import type { InFlightIdGate } from './AdminView'` 정리 — 배럴 재수출로 무수정 통과하므로 본 slice 에서 건드리지 않는다(파일 cap 보호). Follow-ups 로 남긴다.
- 이동 심볼의 이름 변경 · 값 변경 · 로직 개선 · 주석 재작성(선행 주석은 통째로 함께 옮긴다).
- [docs/PLAN.md](../PLAN.md) `183 행` 부채 bullet 의 실측 갱신 — 머지 후 별도 `direct` task 로 처리한다.
- **파일 6 개 이상으로 번지는 확장** — 구현 중 6 번째 파일이 필요해지면(예: [adminCollectionTargetRunners.test.ts](../../web/src/views/adminCollectionTargetRunners.test.ts) 수정 필요) ② 축을 통째로 드롭해 후속 slice 로 넘기고 ① · ③ 만으로 cap 안에서 완결한다. cap 초과 진행은 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

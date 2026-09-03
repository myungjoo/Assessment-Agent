---
id: T-1880
title: AdminView 의 provider · 난이도 파생 helper 축(4 심볼 + 상수 1 + row 타입 2)을 adminProviderDifficultyDerivations 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050]
independentStream: adminview-god-component-refactor
dependsOn: [T-1879]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminProviderDifficultyDerivations.ts
  - web/src/views/adminProviderDifficultyDerivations.test.ts
estimatedDiff: 520
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`574 행` ~ `664 행` 연속 helper 블록 91 줄 + `498 행` ~ `518 행` row 타입 블록 21 줄을 선행 주석까지 통째로 옮기고 선언 앞에 `export` 만 붙인 뒤 AdminView 가 단방향 import 로 되돌려 쓰는 것이 전부) · (b) 신규 로직 0 LOC (`deriveProviders` 의 index 합성 key · `deriveProviderConfigs` 의 선택 필드 생략 · `deriveDifficultyMapping` 의 미지 키 무시 · `mergeMapping` 의 부분 override 전부 본문 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출(`3609 행` ~ `3611 행` · `3622 행` · 타입 `3691 행` ~ `3692 행`) 덕에 `from './AdminView'` 무수정 통과 — planner 가 `readFileSync` drift-guard 39 파일을 전수 검사한 결과 본 축을 anchor 로 쓰는 spec 은 `AdminView.llm-provider-list-contract.test.ts`(`71 행` `useApiResource<LlmProviderRow[]>(providersPath)`) 와 `AdminView.difficulty-mapping-list-contract.test.ts`(`68 행` `useApiResource<DifficultyMappingRow[]>(mappingsPath)`) 둘뿐이고 두 anchor 모두 **잔류 컨테이너**(`1493 행` · `1607 행`)를 가리켜 이동 블록을 참조하지 않는다. 삭제 약 112 + 추가 약 145 가 전부 이동량이고 나머지는 새 모듈 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열여섯째 실분할 — head 28b09ce2 재측정에서 mergeMapping 이 574~664 연속 블록으로 합쳐짐 확인"
created: 2026-09-04
---

# T-1880 — AdminView 의 provider · 난이도 파생 helper 축을 adminProviderDifficultyDerivations 모듈로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 **더 작은 후속 후보**로 지목해 둔 **provider · 난이도 파생 helper 축**의 실분할이며, 직전 [T-1879](T-1879-adminview-resource-path-builders-extract.md)(경로 빌더 8 심볼) 의 Out of Scope 가 다음 slice 로 넘긴 바로 그 축이다. bullet 이 산술로 박제했듯 잔여 helper 표면만으로 목표선(≤ 2,000 줄)에 닿지는 못하지만, 본 축은 이동 경계가 단순한 상태로 남은 마지막 helper 군에 가깝다.

**issue-still-relevant pre-check 실측** (planner 가 head `28b09ce2` 에서 전수 재측정):

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 **3,735 줄 · 선언 46 개** — T-1879 머지분(`-127 줄`)이 반영된 값이다. PLAN bullet 표기(`3,862 줄`)는 stale 이므로 본 task 는 PLAN 좌표를 신뢰하지 않고 전량 재측정했다.
- 목적지 후보 `web/src/views/adminProviderDifficultyDerivations.ts` 는 main 에 **미존재**하고(`git ls-tree origin/main web/src/views/`), 다섯 심볼 중 어느 것도 형제 모듈로 이미 옮겨져 있지 않다(`function deriveProviders|deriveDifficultyMapping|mergeMapping` 이 AdminView 밖 소스에 0 건). 즉 본 task 의 의도는 main 에 아직 박제되지 않았다(partial 안착 0).
- **PLAN 이 경고한 "연속 블록이 아니다" 는 이미 해소됐다** — bullet 은 `mergeMapping` 이 경로 빌더 블록 뒤(`779 행`)에 떨어져 있다고 적었으나, T-1879 가 그 사이의 경로 빌더 블록을 통째로 들어냈으므로 현재는 `DIFFICULTY_KEYS`(`574 행` ~ `575 행`) · `deriveProviders`(`577 행` ~ `590 행`) · `deriveProviderConfigs`(`592 행` ~ `617 행`) · `deriveDifficultyMapping`(`619 행` ~ `646 행`) · `mergeMapping`(`648 행` ~ `664 행`) 이 **`574 행` ~ `664 행` 연속 1 블록 91 줄**이다. 이동 경계가 T-1879 와 동일하게 단순해졌다.
- **동반 이동 대상은 row 타입 2 개** — bullet 이 경고한 "`DIFFICULTY_KEYS` 를 두 helper 가 함께 쓰므로 상수를 동반 이동해야 한다" 는 그대로 유효하고(`640 행` · `657 행` 두 곳에서 사용), 추가로 helper 시그니처가 쓰는 frontend-local 최소 타입 `LlmProviderRow`(`498 행` ~ `510 행`) · `DifficultyMappingRow`(`512 행` ~ `518 행`) 도 함께 옮겨야 정본이 1 개로 유지된다([T-1876](T-1876-adminview-membership-derivations-extract.md) 이 row 타입 3 개를 동반 이동한 선례 동형).

**소비처 동반 의무 충족** (CLAUDE.md §3) — 잔류 컨테이너가 네 helper 를 계속 호출한다(`deriveProviders` `1611 행` · `deriveProviderConfigs` `1618 행` · `mergeMapping(deriveDifficultyMapping(...), ...)` `1727 행`) 그리고 두 row 타입은 `useApiResource<LlmProviderRow[]>`(`1493 행`) · `useApiResource<DifficultyMappingRow[]>`(`1607 행`) 가 계속 쓴다. AdminView 가 새 모듈에서 import 로 되돌려 쓰는 방향이므로 소비처 없는 helper 단독 slice 가 아니다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `498 행` ~ `518 행`(row 타입 2, 선행 주석 포함), `574 행` ~ `664 행`(이동 대상 helper 블록 전문), `116 행` ~ `119 행`(`ProviderOption` · `Difficulty` 타입 import), `127 행` ~ `128 행`(`LlmProviderConfigRow` 타입 import), `1493 행` · `1607 행`(row 타입 소비처), `1609 행` ~ `1620 행`, `1722 행` ~ `1729 행`(helper 호출부), `3603 행` ~ `3625 행` · `3686 행` ~ `3693 행`(배럴 재수출).
- [web/src/views/adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) — `1 행` ~ `25 행` 모듈 헤더 주석. **파생 helper + row 타입 동반 이동의 직전 선례** — 헤더 서술 형식·단방향 import 원칙을 그대로 따른다.
- [web/src/views/adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) — 직전 slice(T-1879) 결과물. 새 모듈의 import 정리 방식(정본 모듈에서 직접 import, 역방향 0) 참고.
- [web/src/views/AdminView.llm-provider-list-contract.test.ts](../../web/src/views/AdminView.llm-provider-list-contract.test.ts) — `68 행` ~ `72 행` (`useApiResource<LlmProviderRow[]>` anchor 가 잔류부 참조임을 재확인).
- [web/src/views/AdminView.difficulty-mapping-list-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-list-contract.test.ts) — `65 행` ~ `69 행` (동형 anchor 재확인).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) — `74 행` ~ `86 행` · `131 행` (본 축 심볼을 배럴에서 import 하는 기존 spec — **무수정 통과** 가 조건 (c) 판정 기준).
- [docs/PLAN.md](../PLAN.md) `183 행` AdminView 부채 bullet.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 "순수 추출 리팩터" 카테고리 (a)(b)(c) 3 조건.

## Acceptance Criteria

- [ ] 새 모듈 `web/src/views/adminProviderDifficultyDerivations.ts` 를 만들고 helper 4(`deriveProviders` · `deriveProviderConfigs` · `deriveDifficultyMapping` · `mergeMapping`) · 상수 1(`DIFFICULTY_KEYS`) · row 타입 2(`LlmProviderRow` · `DifficultyMappingRow`) 를 **각 선언 위 주석까지 포함해 본문 무변경**으로 옮긴다. 이동 블록이 `export` 키워드 외 byte-identical 임을 diff 로 대조해 확인.
- [ ] `DIFFICULTY_KEYS` 는 이동 전에도 AdminView 배럴에 없던 **모듈-private 심볼**이므로 새 모듈에서도 `export` 하지 않는다(공개 표면 무변경 — [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 의 `FALLBACK_MEMBER_NAME` 선례 동형). `grep -n "export const DIFFICULTY_KEYS" web/src/views/adminProviderDifficultyDerivations.ts` 가 0 건임을 확인.
- [ ] 새 모듈은 표시용 타입을 **정본 출처에서 직접** import 한다 — `ProviderOption` · `Difficulty`(`../components/DifficultyModelSelector`) · `LlmProviderConfigRow`(`../components/LlmProviderConfigList`). 새 모듈이 `./AdminView` 를 import 하지 않음(역방향 import 0)을 `grep -n "from './AdminView'" web/src/views/adminProviderDifficultyDerivations.ts` 로 확인.
- [ ] AdminView 에서 이동 블록 두 조각(`498 행` ~ `518 행` · `574 행` ~ `664 행`)을 삭제하고 새 모듈에서 값 4 개 + 타입 2 개를 import 한다. 세 호출부(`1611 행` · `1618 행` · `1727 행`)와 두 타입 소비처(`1493 행` · `1607 행`)는 **표기 무변경**이며, 파일 끝 배럴의 값 재수출 4 개(`deriveProviders` · `deriveProviderConfigs` · `deriveDifficultyMapping` · `mergeMapping`)와 타입 재수출 2 개(`LlmProviderRow` · `DifficultyMappingRow`)를 **그대로 유지**한다(공개 표면 무변경).
- [ ] AdminView 에서 사용처가 사라지는 타입 import 를 정리한다 — `ProviderOption`(`117 행`) 와 `LlmProviderConfigRow`(`128 행`) 는 이동 후 잔류부에서 쓰이지 않으므로 제거하고, `Difficulty`(`118 행`) 는 `1586 행` · `1751 행` 이 계속 쓰므로 **유지**한다. `LlmProviderConfigList` default import(`127 행`) 도 유지. 판정은 `pnpm --filter web build`(`tsc --noEmit` 의 `noUnusedLocals`) 로 확인.
- [ ] 새 colocated spec `web/src/views/adminProviderDifficultyDerivations.test.ts` 를 추가한다 (colocated 우선 — `test/helpers` fallback 불요, 새 mock 없음).
  - [ ] **happy-path**: 네 helper 각각에 대해 정상 입력 1+ test — `deriveProviders` 가 id/provider/modelId 를 그대로 매핑, `deriveProviderConfigs` 가 sanitized view 4 필드를 매핑, `deriveDifficultyMapping` 이 세 슬롯을 채움, `mergeMapping` 이 override 슬롯을 덮음. 공개 심볼 4 개 전수 cover.
  - [ ] **error / 예외 path**: 배열이 아닌 입력(`undefined` · `null`)에서 `deriveProviders` · `deriveProviderConfigs` 가 **throw 없이 빈 배열**, `deriveDifficultyMapping` 이 **throw 없이 세 슬롯 전부 `null` 인 기본 매핑**을 반환하는 test 1+ (조회 전 · 실패 응답의 빈 상태 위임 계약).
  - [ ] **flow / branch cover**: 분기마다 1+ — (i) `deriveProviders` · `deriveProviderConfigs` 의 `id` 존재 vs 누락(`p<n>` index 합성 key) 양쪽, (ii) `deriveProviderConfigs` 의 `modelId` · `endpointUrl` truthy vs falsy 양쪽(falsy 면 **키 자체가 생략**됨을 `'modelId' in config === false` 형태로 검증), (iii) `deriveDifficultyMapping` 의 세 슬롯 키 vs 미지 키 양쪽, (iv) `deriveDifficultyMapping` 의 `llmProviderConfigId` truthy vs 빈값 양쪽, (v) `mergeMapping` 의 override 슬롯 정의 vs `undefined` 양쪽.
  - [ ] **negative cases 충분 cover** — 예외 상황 분기마다 1+: (i) `deriveProviders` 가 `provider` · `modelId` 누락 row 를 `undefined` 가 아닌 **빈 문자열**로 채움(컴포넌트가 `undefined` 를 렌더하지 않는 계약), (ii) 미지의 난이도 키(예 `'expert'`)가 결과 매핑에 **키로도 등장하지 않음**, (iii) `llmProviderConfigId` 가 빈 문자열이면 `null` 로 보정, (iv) `deriveProviderConfigs` 결과에 secret `apiKey` 가 **어떤 경로로도 실리지 않음**(입력 row 에 `apiKey` 를 넣어도 출력에 없음 — sanitized view 계약), (v) `mergeMapping` 이 `base` 객체를 **mutate 하지 않고** 새 객체를 반환(호출 후 `base` 원본 동일성 검증), (vi) `mergeMapping` 의 override 가 비었을 때 base 와 **값은 같되 참조는 다른** 객체 반환, (vii) 빈 배열 입력에서 `deriveProviders` 는 빈 배열 · `deriveDifficultyMapping` 은 세 슬롯 `null` 기본 매핑(경계값).
  - [ ] **모듈 경계 정본 1 개 검증**: 새 모듈에서 직접 import 한 값 4 개가 AdminView 배럴에서 import 한 동명 심볼과 **동일 참조**임을 assert 하는 test 1+ (재선언·복제 회귀 차단).
- [ ] `pnpm --filter web test` (web 워크스페이스 vitest) 통과 — 기존 spec **무수정** 으로 전부 green. 특히 [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 와 두 drift-guard contract spec([AdminView.llm-provider-list-contract.test.ts](../../web/src/views/AdminView.llm-provider-list-contract.test.ts) · [AdminView.difficulty-mapping-list-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-list-contract.test.ts))이 수정 0 으로 통과. **수정이 필요해지면 그 사실 자체가 순수 추출 조건 (c) 위반 신호** 이므로 진행을 멈추고 Follow-ups 에 기록.
- [ ] `pnpm lint && pnpm build` 통과 (backend 회귀 0 확인) + `pnpm --filter web build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 추출 후 `wc -l web/src/views/AdminView.tsx` 실측을 PR 본문에 적는다. 기대 순 감소는 **`-100 줄` 안팎**(이동 112 줄 − 신규 import 블록 증가분 + 제거되는 타입 import 2 줄) — 실측이 기대와 크게 어긋나면 그 차이의 원인을 PR 본문에 1 줄 설명.

## Out of Scope

- 네 helper 와 두 row 타입의 **동작 · 시그니처 · 주석 본문 변경** 일체 (순수 추출 조건 (a)(b) 위반). 보수적 fallback 규약(`p<n>` 합성 key · 빈 문자열 채움 · 선택 필드 생략 · 미지 키 무시)을 "개선" 하지 않는다.
- `DIFFICULTY_KEYS` 를 새로 `export` 해 공개 표면을 넓히는 변경 (배럴 · spec 무수정 전제가 깨진다).
- `resolveProviderSelectValue`(`466 행`) · `LLM_PROVIDER_OPTIONS`(`452 행`) 등 **provider <select> 표시 helper 축** — 본 축과 다른 관심사이며 별도 slice 후보.
- **AdminView 컴포넌트 본문(`825 행` 부근 ~ 배럴 직전)의 섹션 단위 하위 컴포넌트 분리** — PLAN bullet 이 "순수 추출 3 조건을 충족하지 못할 수 있어 착수 전 별도 판단 필요" 로 유보한 작업.
- 배럴 재수출 정리 / 공개 표면 축소.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 stale 실측(`3,862 줄`) 갱신 — `direct` 성격이라 별도 task (CLAUDE.md §3.1 판정 3). 본 slice 머지 후 갱신 task 가 T-1879 · T-1880 두 슬라이스를 한 번에 반영한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

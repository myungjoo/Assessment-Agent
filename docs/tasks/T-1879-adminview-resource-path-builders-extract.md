---
id: T-1879
title: AdminView 의 경로 빌더 helper 축(build*Path 8 심볼)을 adminResourcePathBuilders 모듈로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-045, REQ-049]
independentStream: adminview-god-component-refactor
dependsOn: [T-1877]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminResourcePathBuilders.ts
  - web/src/views/adminResourcePathBuilders.test.ts
estimatedDiff: 420
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`641 행` ~ `773 행` 연속 1 블록의 순수 helper 8 개를 선행 주석까지 통째로 옮기고 선언 앞에 `export` 만 붙인 뒤 AdminView 가 단방향 import 로 되돌려 쓰는 것이 전부) · (b) 신규 로직 0 LOC (각 빌더의 nonce 분기 · `buildPersonsPath` 의 query 조립 · `buildPartPersonsPath` / `buildServiceIdentitiesPath` 의 null 반환 가드 전부 본문 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출(`3739 행` ~ `3746 행`) 덕에 `from './AdminView'` 무수정 통과 — 8 개 contract spec 과 `AdminView.test.tsx` 는 모두 심볼 import 방식이고, 소스 텍스트 drift-guard 의 anchor 는 전부 잔류 컨테이너(`useApiResource<XRow[]>(xxxPath)` · `const personsPath = useMemo(` · `handleChangeRole` · `instanceAccessActionDisabled`)라 이동 블록을 참조하지 않음을 planner 가 전수 확인. 삭제 약 133 + 추가 약 155 가 전부 이동량이고 나머지는 새 모듈 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열다섯째 실분할 — 경로 빌더 8 심볼(641~773 행 연속 블록) 전수 재측정 후 좌표 유효 확인"
created: 2026-09-03
completedAt: 2026-09-03T22:52:49Z
prNumber: 1469
mergeCommit: 9e7e36b6
---

# T-1879 — AdminView 의 경로 빌더 helper 축(build\*Path 8 심볼)을 adminResourcePathBuilders 모듈로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 다음 `pr` 대상으로 지목한 **경로 빌더 helper 축**의 실분할이다. bullet 이 산술로 박제했듯 잔여 helper 표면(`307 행` ~ `820 행`)을 전량 추출해도 목표선(≤ 2,000 줄)에는 닿지 않지만, 본 축은 이동 경계가 가장 단순한 연속 블록이라 helper 표면 축소의 남은 몫을 값싸게 회수한다.

**issue-still-relevant pre-check 실측** (planner 가 head `34ac5e92` 에서 전수 재측정 — PLAN 좌표는 stale 을 전제로 재확인): [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 **3,862 줄 · 선언 54 개**로 T-1878 실측과 동일하며(T-1878 은 doc-only 라 코드 무변경), 여덟 빌더가 **`buildMappingsPath`(`646 행`) · `buildProvidersPath`(`659 행`) · `buildPersonsPath`(`673 행`) · `buildGroupsPath`(`702 행`) · `buildPartsPath`(`715 행`) · `buildUsersPath`(`724 행`) · `buildPartPersonsPath`(`741 행`) · `buildServiceIdentitiesPath`(`761 행`)** 로 PLAN 이 적어 둔 좌표와 정확히 일치한다. 선행 주석 시작 `641 행` 부터 `buildServiceIdentitiesPath` 닫는 괄호 `773 행` 까지가 **연속 1 블록 133 줄**임도 재확인했다. 목적지 후보 `web/src/views/adminResourcePathBuilders.ts` 는 main 에 **미존재**하고 여덟 심볼 중 어느 것도 형제 모듈로 이미 옮겨져 있지 않다 — 즉 본 task 의 의도는 main 에 아직 박제되지 않았다(partial 안착 0).

**소비처 동반 의무 충족** (CLAUDE.md §3) — 잔류 컨테이너가 여덟 빌더를 계속 호출한다(`buildGroupsPath` `856 행` · `buildPersonsPath` `895 행` · `buildServiceIdentitiesPath` `932 행` · `buildProvidersPath` `1609 행` · `buildMappingsPath` `1727 행` · `buildPartsPath` `2103 행` · `buildPartPersonsPath` `2359 행` · `buildUsersPath` `2393 행`). AdminView 가 새 모듈에서 import 로 되돌려 쓰는 방향이므로 소비처 없는 helper 단독 slice 가 아니다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `641 행` ~ `773 행` (이동 대상 블록 전문), `69 행` ~ `83 행` · `184 행` ~ `185 행` · `231 행` ~ `241 행` · `253 행` ~ `262 행` · `274 행` ~ `286 행` (base 상수 import 블록 5 개), `3730 행` ~ `3746 행` (배럴 재수출), 위 Why 에 적힌 8 개 호출부 행.
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — `LLM_PROVIDERS_PATH` · `LLM_MAPPINGS_PATH` 정본 위치, `29 행` 주석(빌더 소비 주체 서술).
- [web/src/views/adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) — `115 행` `buildGroupMembersPath`. **이미 추출 완료된 동형 빌더** — 본 task 는 건드리지 않는다(모듈 헤더 주석 작성 시 선례로만 참고).
- [web/src/views/AdminView.users-list-contract.test.ts](../../web/src/views/AdminView.users-list-contract.test.ts) — `74 행` `extractUsersFireMethod` (소스 텍스트 drift-guard 의 anchor 형태 확인용 대표 1 개).
- [web/src/views/AdminView.persons-include-inactive.test.tsx](../../web/src/views/AdminView.persons-include-inactive.test.tsx) — `178 행` ~ `190 행` (`const personsPath = useMemo(` anchor — 잔류부 참조임을 재확인).
- [docs/PLAN.md](../PLAN.md) `183 행` AdminView 부채 bullet.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 "순수 추출 리팩터" 카테고리 (a)(b)(c) 3 조건.

## Acceptance Criteria

- [ ] 새 모듈 `web/src/views/adminResourcePathBuilders.ts` 를 만들고 여덟 빌더(`buildMappingsPath` · `buildProvidersPath` · `buildPersonsPath` · `buildGroupsPath` · `buildPartsPath` · `buildUsersPath` · `buildPartPersonsPath` · `buildServiceIdentitiesPath`)를 **각 선언 위 주석까지 포함해 본문 무변경**으로 옮긴다. 선언 앞에 `export` 만 붙인다 — 이동 블록이 `export` 키워드 외 byte-identical 임을 diff 로 대조해 확인.
- [ ] base 상수는 **재선언 없이 원래 출처에서 직접** import 한다 — `USERS_PATH` (`./adminUserMutationRunners`) · `GROUPS_PATH` · `PARTS_PATH` (`./adminGroupPartMutationRunners`) · `PERSONS_PATH` (`./adminPersonMutationRunners`) · `LLM_PROVIDERS_PATH` · `LLM_MAPPINGS_PATH` (`./adminLlmProviderMutationRunners`) · `serviceIdentityCollectionPath` (`../api/serviceIdentity`). 새 모듈이 `./AdminView` 를 import 하지 않음(역방향 import 0)을 `grep -n "from './AdminView'" web/src/views/adminResourcePathBuilders.ts` 로 확인.
- [ ] AdminView 에서 이동 블록(`641 행` ~ `773 행`)을 삭제하고 새 모듈에서 여덟 심볼을 import 한다. 여덟 호출부는 **호출 형태 무변경**이며, 파일 끝 배럴 재수출(`3739 행` ~ `3746 행`)의 여덟 이름을 **그대로 유지**한다(공개 표면 무변경).
- [ ] 새 colocated spec `web/src/views/adminResourcePathBuilders.test.ts` 를 추가한다 (colocated 우선 — `test/helpers` fallback 불요, 새 mock 없음).
  - [ ] **happy-path**: 여덟 빌더 각각에 대해 nonce 0(또는 기본 인자) 호출이 query 없는 base path 를 그대로 내는 test 1+ — 여덟 심볼 전수 cover.
  - [ ] **error / 예외 path**: `buildPartPersonsPath` · `buildServiceIdentitiesPath` 가 미선택 입력에서 `null` 을 반환해 조건부 조회 idle 을 유발하는 test 1+ (깨진 `/api/parts//persons` · `/api/persons//identities` 미발사).
  - [ ] **flow / branch cover**: 각 빌더의 nonce 분기(≤ 0 vs > 0) 양쪽 1+ test. `buildPersonsPath` 는 `nonce × includeInactive` **4 조합 전수**와 query 구분자 조립(`?` 첫 항목 · `&` 이후)을 cover.
  - [ ] **negative cases 충분 cover** — 예외 상황 분기마다 1+: (i) 음수 nonce 가 base path 로 떨어짐, (ii) `buildPartPersonsPath` 의 `undefined` · 빈 문자열 입력 각각 `null`, (iii) `buildServiceIdentitiesPath` 의 공백뿐인 id 가 `null`, (iv) `buildPersonsPath(n, false)` 가 무의미한 `includeInactive=false` 를 싣지 않음, (v) `buildPartPersonsPath` 가 `encodeURIComponent` 로 안전 인코딩해 param 값이 literal `persons` 세그먼트를 침범하지 않음, (vi) 형제 자원 오발사 방지 — 각 빌더 결과가 다른 자원 base(`/api/groups` · `/api/parts` 등)를 포함하지 않음.
  - [ ] **모듈 경계 정본 1 개 검증**: 새 모듈에서 직접 import 한 여덟 심볼이 AdminView 배럴에서 import 한 동명 심볼과 **동일 참조**임을 assert 하는 test 1+ (재선언·복제 회귀 차단).
- [ ] `pnpm --filter web test` (또는 web 워크스페이스의 vitest 실행 명령) 통과 — 기존 spec **무수정** 으로 전부 green. 특히 8 개 contract spec (`AdminView.difficulty-mapping-list-contract.test.ts` · `AdminView.groups-list-contract.test.ts` · `AdminView.llm-provider-list-contract.test.ts` · `AdminView.part-persons-contract.test.ts` · `AdminView.parts-list-contract.test.ts` · `AdminView.persons-list-contract.test.ts` · `AdminView.users-list-contract.test.ts` · `AdminView.persons-include-inactive.test.tsx`) 과 `AdminView.test.tsx` 가 spec 파일 수정 0 으로 통과. **수정이 필요해지면 그 사실 자체가 순수 추출 조건 (c) 위반 신호** 이므로 진행을 멈추고 Follow-ups 에 기록.
- [ ] `pnpm lint && pnpm build` 통과 — `tsc noUnusedLocals` 로 AdminView 에서 사용처가 사라진 상수 import 가 남지 않았는지 확인.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 추출 후 `wc -l web/src/views/AdminView.tsx` 실측을 PR 본문에 적는다. 기대 순 감소는 **`-120 줄` 안팎** (이동 133 줄 − 신규 import 블록 증가분) — 실측이 기대와 크게 어긋나면 그 차이의 원인을 PR 본문에 1 줄 설명.

## Out of Scope

- 여덟 빌더의 **동작·시그니처·주석 본문 변경** 일체 (순수 추출 조건 (a)(b) 위반). nonce 규약·null 가드·인코딩 방식을 "개선" 하지 않는다.
- `mergeMapping` (`779 행`) · `DIFFICULTY_KEYS` (`568 행`) · `deriveProviders` (`574 행`) · `deriveProviderConfigs` (`592 행`) · `deriveDifficultyMapping` (`619 행`) 등 **provider · 난이도 파생 helper 축** — PLAN bullet 이 다음 후속 후보로 지목한 별도 slice.
- 이미 [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 로 추출 완료된 `buildGroupMembersPath` 를 새 모듈로 다시 옮기는 이동.
- **AdminView 컴포넌트 본문(`825 행` ~ `3728 행`)의 섹션 단위 하위 컴포넌트 분리** — PLAN bullet 이 "순수 추출 3 조건을 충족하지 못할 수 있어 착수 전 별도 판단 필요" 로 유보한 작업.
- 배럴 재수출 정리 / 공개 표면 축소 (spec 무수정 통과 전제가 깨진다).
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 — `direct` 성격이라 별도 task (CLAUDE.md §3.1 판정 3).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-09-03T22:52:49Z, DONE)

- `pr` 모드로 PR #1469 를 round 1 에 squash merge (main `9e7e36b6`). 변경 3 파일 `+405/-149`.
- 여덟 빌더(`buildMappingsPath` · `buildProvidersPath` · `buildPersonsPath` · `buildGroupsPath` · `buildPartsPath` · `buildUsersPath` · `buildPartPersonsPath` · `buildServiceIdentitiesPath`)를 선행 주석까지 **`export` 키워드 외 byte-identical** 로 신규 [adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) (150 줄) 로 이동. base 상수 7 개는 정본 모듈에서 직접 import 해 역방향 import 0.
- **AdminView.tsx `3,862 → 3,735 줄` (-127)** — 기대치 `-120` 안팎과 일치.
- colocated spec 50 건 추가 (happy 8 심볼 전수 · null idle 2 종 · nonce 분기 양쪽 · `buildPersonsPath` query 4 조합 · negative (i)~(vi) · 배럴 동일 참조 8). web 전체 128 파일 3,841 test green, 기존 spec 수정 0.
- 4-게이트 실측 — reviewer APPROVE comment 외부 존재(게이트 2), PR head `300bee95` run(33814569861) · approve-comment 재검증 run(33814666530) 모두 success(게이트 4).


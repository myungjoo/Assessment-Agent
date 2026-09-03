---
id: T-1878
title: PLAN 183 행 AdminView 부채 7 차 실측 갱신 + 구조 산술 박제 + 다음 추출 대상 재지목
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1876, T-1877]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-09-03
plannerNote: "P5 PLAN 183 행 부채 bullet — T-1876·T-1877 머지로 표기 stale(4,072/66 vs 실측 3,862/54) + 지목 2 건 전량 소멸"
---

# T-1878 — PLAN 183 행 AdminView 부채 7 차 실측 갱신 + 구조 산술 박제 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이며, 거기 박제된 실측값과 "다음 추출 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. 두 값이 stale 하면 다음 슬라이스가 이미 추출된 심볼을 다시 지목하는 중복 task 로 이어진다 ([T-1861](T-1861-plan-adminview-debt-remeasure-next-target.md) · [T-1871](T-1871-plan-adminview-debt-remeasure-next-target.md) · [T-1875](T-1875-plan-adminview-debt-remeasure-next-target.md) 이 같은 사유로 만들어진 선례). 또 [T-1877](T-1877-adminview-difficulty-assign-runner-extract.md) `Follow-ups` 첫 항목이 "T-1876 분과 **묶어 1 회로**" 본 갱신을 명시 위임했다 — 두 슬라이스분을 한 번에 흡수한다.

**issue-still-relevant pre-check (origin/main `a79e40df` 실측 — PLAN 이 적어 둔 좌표는 stale 을 전제로 전수 재측정했다)**:

- PLAN `183 행` 표기 = `4,072 줄 · top-level 선언 66 개` (측정 sha `756af122`) vs **실측 `3,862 줄 · 선언 54 개`** — [T-1876](T-1876-adminview-membership-derivations-extract.md) (`4,072 → 3,921`, `-151`) · [T-1877](T-1877-adminview-difficulty-assign-runner-extract.md) (`3,921 → 3,862`, `-59`) 두 머지분이 **모두 미반영**.
- 같은 행이 지목한 **두 대상이 전부 소멸**했다 — "다음 대상 = 멤버십 파생 helper 축" 은 T-1876 이 [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 로 전량 옮겼고 (`grep -c 'function deriveAddCandidates' web/src/views/AdminView.tsx` = 0), "더 작은 후속 후보 = 난이도 매핑 assign 축" 은 T-1877 이 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 옮겼다 (`grep -c 'function runAssign' web/src/views/AdminView.tsx` = 0). 즉 bullet 에 **유효한 다음 대상이 0 개** 라 지금 갱신하지 않으면 다음 `pr` 슬라이스의 입력이 없다.
- 새 지목 후보의 심볼 8 개는 **여전히 AdminView.tsx 에만** 있다 — `buildMappingsPath`(`646 행`) · `buildProvidersPath`(`659 행`) · `buildPersonsPath`(`673 행`) · `buildGroupsPath`(`702 행`) · `buildPartsPath`(`715 행`) · `buildUsersPath`(`724 행`) · `buildPartPersonsPath`(`741 행`) · `buildServiceIdentitiesPath`(`761 행`). 같은 이름을 담은 목적지 모듈은 없다 (`grep -rl 'function buildGroupsPath' web/src/views/*.ts` 히트 = AdminView.tsx 외 0).
- **본 갱신이 새로 박제해야 할 사실 (지금까지 bullet 에 없던 것)** — 파일 구조를 4 구역으로 실측했다: `1 행` ~ `306 행` 헤더 주석 + import 블록 (306 줄) · `307 행` ~ `820 행` top-level 상수 · 타입 · 순수 helper (514 줄) · `825 행` ~ `3728 행` `AdminView` 컴포넌트 본문 (2,904 줄) · `3730 행` ~ `3862 행` 배럴 재수출 (133 줄). **잔여 helper 표면 514 줄을 전량 추출해도 약 3,350 줄** 이라 목표선 (≤ 2,000 줄) 에 1,300 줄 이상 못 미친다 — 지금까지의 순수 추출 경로만으로는 **산술적으로 목표 도달이 불가능**하다는 사실이 이번 측정에서 처음 확정됐다.
- 본 갱신 대상은 `docs/PLAN.md` **1 파일뿐** — 같은 실측치를 박제한 다른 문서는 없다 (부채 추적 지점 단일). 두 슬라이스분 갱신이 main 에 미안착이라 중복 task 가 아니다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (한 줄이 매우 길다; 반드시 **부분 편집**으로 처리한다).
- [docs/tasks/T-1875-plan-adminview-debt-remeasure-next-target.md](T-1875-plan-adminview-debt-remeasure-next-target.md) — 직전 (6 차) 실측 갱신의 문장 형태 · 좌표 박제 방식 선례.
- [docs/tasks/T-1877-adminview-difficulty-assign-runner-extract.md](T-1877-adminview-difficulty-assign-runner-extract.md) `Follow-ups` · `완료 기록` — 본 slice 로 위임된 갱신 항목과 실측 순 감소 `-59`.
- [docs/tasks/T-1876-adminview-membership-derivations-extract.md](T-1876-adminview-membership-derivations-extract.md) `완료 기록` — 실측 순 감소 `-151`.

## Acceptance Criteria

측정은 **PLAN bullet 이 박제한 방법 그대로** 수행하고, 그 시점 값을 우선한다 (아래 수치는 planner pre-check 시점 값이다):

```
git fetch origin main -q
git show origin/main:web/src/views/AdminView.tsx | wc -l
git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '
```

- [ ] bullet 제목의 `— 4,072 줄` 을 실측 LOC (**3,862**) 로 교체.
- [ ] 본문 실측 문구 `**4,072 줄 · top-level 선언 66 개**(2026-09-03 head \`756af122\` 실측)` 을 `**3,862 줄 · top-level 선언 54 개**(2026-09-03 head \`828910ad\` 실측)` 로 교체 (측정 sha 는 T-1877 머지 commit).
- [ ] 최초 기록 대비 누적 감소 표기 **2 곳** 을 `-2,015 줄` → `-2,225 줄` 로 갱신하고, 선언 수 추이 `(선언 149 → 66)` 을 `(선언 149 → 54)` 로 갱신 (6,087 − 3,862 = 2,225).
- [ ] 목표선 잔여 표기 `-2,072 줄` → `-1,862 줄` 로 갱신 (3,862 − 2,000 = 1,862). 이어지는 페이스 문장의 수치도 함께 고쳐 쓴다 — 선언된 `-250~500 줄` 밴드 상단으로도 **산술 4 회 이상**이고, **최근 3 슬라이스 실측은 `-126` · `-151` · `-59` (평균 `-112`) 로 밴드 하단에도 못 미쳐 그 페이스로는 산술 17 회가 필요**하다는 사실을 적는다 (직전 갱신의 `-105` · `-194` · `-126` · 평균 `-142` · 15 회 서술을 대체).
- [ ] 진척 목록을 **순수 추출 12 슬라이스 → 14 슬라이스** 로 늘리고 두 건을 추가한다: [T-1876](T-1876-adminview-membership-derivations-extract.md) [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) (멤버십 파생 helper 5 + row 타입 3 + 상수 1, `-151 줄`) · [T-1877](T-1877-adminview-difficulty-assign-runner-extract.md) [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) (난이도 매핑 assign 축 2 심볼 + 상수 1, `-59 줄`, **난이도 매핑 mutation 축 마감**).
- [ ] **구조 산술을 새 문장으로 박제한다** (지금까지 bullet 에 없던 사실 — 다음 planner 가 잘못된 기대로 슬라이스를 계속 만들지 않게 하는 것이 목적이다). 아래 실측을 그대로 적을 것:
  - 파일 4 구역 = 헤더 주석 + import 블록 `1 행` ~ `306 행` (306 줄) · top-level 상수 · 타입 · 순수 helper `307 행` ~ `820 행` (514 줄) · `AdminView` 컴포넌트 본문 `825 행` ~ `3728 행` (2,904 줄) · 배럴 재수출 `3730 행` ~ `3862 행` (133 줄).
  - **잔여 helper 표면 514 줄을 전량 추출해도 약 3,350 줄** — 목표선까지 1,300 줄 이상이 남는다. 즉 목표 도달은 **컴포넌트 본문 2,904 줄의 섹션 단위 하위 컴포넌트 분리** 없이는 불가능하며, 그 작업은 markup + state 를 함께 옮기므로 [planner.md](../../.claude/agents/planner.md) 의 **순수 추출 3 조건 (a)(b)(c) 를 그대로 충족하지 못할 수 있다** (`sizeExempt` 직행 카테고리와 성격이 다르다 — 착수 전 별도 판단이 필요하다).
  - 순 감소가 이동량보다 작게 나오는 이유도 한 문장으로 적는다 — 추출마다 import 블록과 배럴 재수출이 커져 (현재 306 + 133 = **439 줄**, 파일의 약 11%) 이동 62 줄이 순 `-59` 로 상쇄된 T-1877 이 그 실례다.
- [ ] 소멸한 "다음 대상" 지목 문단 (멤버십 파생 helper 축 + 동반 이동 타입 3 · 상수 1 · 경계 밖 목록 · 파일 cap 주의) 을 **경로 빌더 helper 축** 으로 교체한다. 아래 실측 사실을 그대로 박제할 것 (head `828910ad` 기준):
  - 대상 = `buildMappingsPath`(`646 행`) · `buildProvidersPath`(`659 행`) · `buildPersonsPath`(`673 행`) · `buildGroupsPath`(`702 행`) · `buildPartsPath`(`715 행`) · `buildUsersPath`(`724 행`) · `buildPartPersonsPath`(`741 행`) · `buildServiceIdentitiesPath`(`761 행`) 의 **순수 helper 8**, 선행 주석부터 `buildServiceIdentitiesPath` 닫는 괄호까지 `641 행` ~ `773 행` 의 **연속 1 블록 133 줄**.
  - **동반 이동 0** — 여덟 helper 가 쓰는 base 상수는 이미 전부 외부 모듈에서 import 돼 있다 (`USERS_PATH` `73 행` · `GROUPS_PATH` `231 행` · `PARTS_PATH` `232 행` · `PERSONS_PATH` `256 행` · `LLM_PROVIDERS_PATH` `280 행` · `LLM_MAPPINGS_PATH` `281 행` · `serviceIdentityCollectionPath` `184 행`). 새 모듈이 **같은 출처에서 직접** import 하면 되므로 상수 재선언도, AdminView 를 향한 역방향 import 도 필요 없다.
  - **소비처 동반 의무 충족** — 잔류 컨테이너가 여덟 helper 를 계속 호출한다 (예: `buildMappingsPath` `1727 행` `useMemo` · `buildServiceIdentitiesPath` `932 행`). AdminView 가 새 모듈에서 import 로 되돌려 쓰는 방향이며 helper 단독 slice 가 아니다.
  - 기대 순 감소는 **`-120 줄` 안팎** (이동 133 줄 − 신규 import 블록 증가분).
  - **파일 cap 주의 박제** — 배럴이 여덟 helper 를 이미 `export` 하므로 (`3739 행` ~ `3746 행`) 재수출을 유지하면 심볼 import 방식 spec 은 무수정 통과한다 (`AdminView.difficulty-mapping-list-contract.test.ts` · `AdminView.groups-list-contract.test.ts` · `AdminView.llm-provider-list-contract.test.ts` · `AdminView.part-persons-contract.test.ts` 등이 그 방식이다). 다만 AdminView **소스 텍스트**를 `readFileSync` 로 읽는 drift-guard 의 anchor 가 잔류부인지 **슬라이스 착수 시 재확인** 해 파일 cap (≤ 5, LOC 만 면제) 산술에 반영한다.
- [ ] 위 지목 문단 끝에 **더 작은 후속 후보** 를 한 문장으로 덧붙인다 — **provider · 난이도 파생 helper 축** (`DIFFICULTY_KEYS`(`568 행`) · `deriveProviders`(`574 행`) · `deriveProviderConfigs`(`592 행`) · `deriveDifficultyMapping`(`619 행`) · `mergeMapping`(`779 행`)) 이며, `mergeMapping` 만 경로 빌더 블록 뒤에 떨어져 있어 **연속 블록이 아니라는 점**과 `DIFFICULTY_KEYS` 를 `deriveDifficultyMapping` · `mergeMapping` 이 함께 쓰므로 **상수를 동반 이동해야** 정본이 1 개로 유지된다는 사실까지 적는다.
- [ ] `git diff --stat` 이 `docs/PLAN.md` **1 파일** 만 보고하고, bullet 의 나머지 서술 (측정 방법 문단 · 구조적 유인 설명 · 선행 처리 [T-1822](T-1822-pure-extraction-cap-bend-category.md) 링크 · 목표선 정의 · 넷째 슬라이스 서술 · `[ ]` 체크박스 상태) 은 **무변경**.
- [ ] 코드 변경 0 이므로 test 는 불요 — 단 `git status --short` 로 `docs/PLAN.md` 외 오염이 없음을 확인한다. (R-112 4 항목은 `commitMode: direct` doc-only 라 적용 대상이 아니다 — CLAUDE.md §3.2 의 direct-mode doc-only 면제.)

## Out of Scope

- `web/src/views/AdminView.tsx` 를 포함한 **모든 코드 변경** — 본 slice 는 doc-only `direct` 다. 실제 추출은 후속 `pr` slice (§3.1 판정 규칙 3 분리 유지).
- 지목된 경로 빌더 helper 축의 실제 이동 · 새 모듈 신설 — 다음 `pr` task 의 몫이다.
- 컴포넌트 본문 분리 (섹션 하위 컴포넌트화) 의 **설계 · ADR 작성** — 본 slice 는 "순수 추출만으로는 산술 미달" 이라는 **사실만 박제**한다. 방식 결정은 별도 검토다.
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 리팩터 추적 문서 갱신이라 REQ 구현이 없다 (CLAUDE.md §3.1 판정 규칙 6).
- PLAN `181 행` · `182 행` (과분할 차단 · 재판정 왕복) bullet 갱신.
- 부채 bullet 의 목표선 (≤ 2,000 줄) 자체 재조정 — 오너 지시값이라 planner 판단으로 바꾸지 않는다.
- `docs/PLAN.md` 의 다른 phase · 항목, [PLAN_archive.md](../PLAN_archive.md).

## Suggested Sub-agents

`implementer` (doc 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (planner 사전 박제) [T-1877](T-1877-adminview-difficulty-assign-runner-extract.md) `Follow-ups` 두 번째 항목 (`src/run-status/run-status.service.spec.ts:134` 의 backend full-suite 병렬 flaky) 은 **여전히 미해소** 다. 본 slice 는 backend 를 건드리지 않으므로 그대로 이월하며, 재발 관측 시 별도 `pr` task 로 격리한다.

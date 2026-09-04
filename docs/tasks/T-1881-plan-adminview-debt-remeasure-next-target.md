---
id: T-1881
title: PLAN 183 행 AdminView 부채 8 차 실측 갱신 + 본문 내부 분해 박제 + 다음 추출 대상 재지목
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1879, T-1880]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 10
estimatedFiles: 1
created: 2026-09-04
plannerNote: "P5 PLAN 183 행 부채 bullet — T-1879·T-1880 머지로 표기 stale(3,862/54 vs 실측 3,630/39) + 지목 2 건 전량 소멸"
---

# T-1881 — PLAN 183 행 AdminView 부채 8 차 실측 갱신 + 본문 내부 분해 박제 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이고, 거기 박제된 실측값과 "다음 추출 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. 지금 그 bullet 은 머지된 두 슬라이스를 반영하지 못했고 **유효한 다음 대상이 0 개** 라, 갱신하지 않으면 다음 슬라이스의 입력이 없거나 이미 추출된 심볼을 다시 지목하는 중복 task 가 된다 ([T-1861](T-1861-plan-adminview-debt-remeasure-next-target.md) · [T-1871](T-1871-plan-adminview-debt-remeasure-next-target.md) · [T-1875](T-1875-plan-adminview-debt-remeasure-next-target.md) · [T-1878](T-1878-plan-adminview-debt-remeasure-next-target.md) 이 같은 사유의 선례다).

**issue-still-relevant pre-check (origin/main `34b9d95c` · AdminView head `06074b68` 실측 — bullet 이 적어 둔 좌표는 stale 을 전제로 전수 재측정했다)**:

- PLAN `183 행` 표기 = `3,862 줄 · top-level 선언 54 개` (측정 sha `828910ad`) vs **실측 `3,630 줄 · 선언 39 개`** — [T-1879](T-1879-adminview-resource-path-builders-extract.md) (`3,862 → 3,735`, `-127`) · [T-1880](T-1880-adminview-provider-difficulty-derivations-extract.md) (`3,735 → 3,630`, `-105`) 두 머지분이 **모두 미반영** (`grep -c 'T-1879\|T-1880\|3,630' docs/PLAN.md` = 0).
- 같은 행이 지목한 **두 대상이 전부 소멸**했다 — "다음 대상 = 경로 빌더 helper 축" 은 T-1879 가 [adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) 로 전량 옮겼고, "더 작은 후속 후보 = provider · 난이도 파생 helper 축" 은 T-1880 이 [adminProviderDifficultyDerivations.ts](../../web/src/views/adminProviderDifficultyDerivations.ts) 로 옮겼다 (`grep -cE '^function (buildGroupsPath|deriveProviders|mergeMapping)' web/src/views/AdminView.tsx` = 0).
- **본 갱신이 새로 박제해야 할 사실** — 컴포넌트 본문 2,904 줄의 내부 분해를 처음 실측했다: `593 행` ~ `2589 행` 이 hooks · state · 핸들러 prelude (1,997 줄), `2590 행` ~ `3496 행` 이 JSX return (907 줄) 이다. 즉 본문 mass 의 약 **69% 가 markup 이 아니라 state · 핸들러 prelude** 라, 목표선 도달 경로를 "JSX 섹션 하위 컴포넌트화" 로만 상상하면 실제 mass 를 못 건드린다.
- 본 갱신 대상은 `docs/PLAN.md` **1 파일뿐** — 같은 실측치를 박제한 다른 문서는 없다 (부채 추적 지점 단일; [components.md](../architecture/components.md) · [modules.md](../architecture/modules.md) 는 AdminView 를 언급하되 LOC 실측을 박제하지 않는다).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (한 줄이 매우 길다; 반드시 **부분 편집**으로 처리한다).
- [docs/tasks/T-1878-plan-adminview-debt-remeasure-next-target.md](T-1878-plan-adminview-debt-remeasure-next-target.md) — 직전 (7 차) 갱신의 문장 형태 · 좌표 박제 방식 · 구조 산술 서술 선례.
- [docs/tasks/T-1879-adminview-resource-path-builders-extract.md](T-1879-adminview-resource-path-builders-extract.md) `완료 기록` — 실측 순 감소 `-127`.
- [docs/tasks/T-1880-adminview-provider-difficulty-derivations-extract.md](T-1880-adminview-provider-difficulty-derivations-extract.md) `완료 기록` — 실측 순 감소 `-105`.

## Acceptance Criteria

측정은 **PLAN bullet 이 박제한 방법 그대로** 수행하고, 그 시점 값을 우선한다 (아래 수치는 planner pre-check 시점 값이다):

```
git fetch origin main -q
git show origin/main:web/src/views/AdminView.tsx | wc -l
git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '
```

- [ ] bullet 제목의 `— 3,862 줄` 을 실측 LOC (**3,630**) 로 교체.
- [ ] 본문 실측 문구 `**3,862 줄 · top-level 선언 54 개**(2026-09-03 head \`828910ad\` 실측)` 을 `**3,630 줄 · top-level 선언 39 개**(2026-09-04 head \`06074b68\` 실측)` 으로 교체 (측정 sha 는 T-1880 머지 commit).
- [ ] 최초 기록 대비 누적 감소 표기를 `-2,225 줄` → **`-2,457 줄`** 로 갱신하고 선언 수 추이 `(선언 149 → 54)` 를 `(선언 149 → 39)` 로 갱신 (6,087 − 3,630 = 2,457).
- [ ] 목표선 잔여 표기를 `-1,862 줄` → **`-1,630 줄`** 로 갱신 (3,630 − 2,000 = 1,630). 이어지는 페이스 문장의 수치도 함께 고쳐 쓴다 — **최근 3 슬라이스 실측은 `-59` · `-127` · `-105` (평균 `-97`)** 이고 그 페이스가 이어지면 산술 **17 회**가 더 필요하다 (직전 갱신의 `-126` · `-151` · `-59` · 평균 `-112` · 17 회 서술을 대체).
- [ ] 진척 목록을 **순수 추출 14 슬라이스 → 16 슬라이스** 로 늘리고 두 건을 추가한다: [T-1879](T-1879-adminview-resource-path-builders-extract.md) [adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) (경로 빌더 순수 helper 8 심볼, `-127 줄`) · [T-1880](T-1880-adminview-provider-difficulty-derivations-extract.md) [adminProviderDifficultyDerivations.ts](../../web/src/views/adminProviderDifficultyDerivations.ts) (provider · 난이도 파생 helper 4 심볼 + 상수 1, `-105 줄`, **파생 helper 축 마감**).
- [ ] 구조 산술 문단의 4 구역 좌표를 실측으로 갱신한다 — 헤더 주석 + import 블록 `1 행` ~ `319 행` (319 줄) · top-level 상수 · 타입 · 순수 helper `321 행` ~ `591 행` (**271 줄** — 직전 측정 514 줄에서 `-243`) · `AdminView` 컴포넌트 본문 `593 행` ~ `3496 행` (2,904 줄 — 직전 측정과 **동일**) · 배럴 재수출 `3498 행` ~ `3630 행` (133 줄). 잔여 helper 표면 271 줄을 **전량 추출해도 약 3,360 줄** 이라 목표선까지 1,360 줄이 남는다는 결론도 같은 수치로 고쳐 쓴다.
- [ ] **본문 내부 분해를 새 문장으로 박제한다** (지금까지 bullet 에 없던 사실 — 다음 슬라이스가 mass 를 잘못 겨냥하지 않게 하는 것이 목적이다): 컴포넌트 본문 2,904 줄은 `593 행` ~ `2589 행` 의 hooks · state · 핸들러 prelude (**1,997 줄**) 와 `2590 행` ~ `3496 행` 의 JSX return (**907 줄**) 로 나뉘며, 본문 mass 의 약 **69% 가 markup 이 아니라 prelude** 다. 따라서 "JSX 섹션 하위 컴포넌트화" 만으로는 최대 907 줄에만 닿고, 목표선은 **prelude 의 state · 핸들러 군집을 custom hook 모듈로 옮기는 경로** 없이는 도달하지 않는다. 그 경로가 [planner.md](../../.claude/agents/planner.md) 의 순수 추출 3 조건 (a)(b)(c) 를 충족하는지는 **착수 전 별도 판단** 대상이라는 단서를 함께 적는다 (T-1878 이 박제한 "본문 분리는 성격이 다르다" 단서를 대체하지 말고 이 분해 사실로 **보강**할 것).
- [ ] 소멸한 "다음 대상" 지목 문단 (경로 빌더 helper 축 + 동반 이동 0 + 파일 cap 주의 + provider · 난이도 후속 후보) 을 **잔여 순수 표면 일괄 소진 슬라이스** 로 교체한다. 아래 실측 사실을 그대로 박제할 것 (head `06074b68` 기준):
  - 대상 = `321 행` ~ `591 행` 의 **잔여 top-level 상수 · 타입 · 순수 helper 전량** (271 줄). 세 묶음이다 — ① 화면 문구 · DOM id 상수 22 개 (`PERSON_HEADING`(`323 행`) ~ `FALLBACK_GROUP_NAME`(`505 행`), `AUTH_ME_PATH`(`416 행`) 포함) ② 수집 대상 범위 편집 축 4 심볼 (`EMPTY_COLLECTION_TARGET_SCOPE_INPUT`(`354 행`) · `SCOPE_EDIT_SEPARATOR`(`361 행`) · `foldScopeForEdit`(`366 행`) · `buildScopePatch`(`375 행`)) ③ 폼 옵션 · 게이트 축 8 심볼 (`ScopeOption`(`434 행`) · `EXPORT_SCOPE_OPTIONS`(`440 행`) · `LlmProviderOption`(`455 행`) · `LLM_PROVIDER_OPTIONS`(`461 행`) · `resolveProviderSelectValue`(`479 행`) · `REEVAL_WINDOW_OPTIONS`(`490 행`) · `InFlightIdGate`(`563 행`) · `createInFlightIdGate`(`575 행`)).
  - **잔류 허용** — 컴포넌트 자신의 props · 응답 row 타입 (`MeRow`(`511 행`) · `AdminViewProps`(`515 행`)) 과 `isAdminRole`(`557 행`) 은 잔류해도 무방하다 (컴포넌트 계약에 밀착 — 옮기면 역방향 import 위험).
  - **목적지** — ② 는 이미 수집 대상 축을 소유한 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 로 (같은 모듈이 `parseScopeInput` · `scopeFieldsForCollectionTargetType` 를 이미 쓴다), ① · ③ 은 신규 모듈 1 개로 모은다. 즉 **한 슬라이스 = AdminView + 기존 모듈 1 + 신규 모듈 1 (+ 신규 spec 1)** 로 파일 cap (≤ 5) 안이며, LOC 은 순수 추출 면제 대상이다.
  - **소비처 동반 의무 충족** — 잔류 컨테이너가 세 묶음을 계속 소비한다 (예: `foldScopeForEdit` `2044 행` · `EMPTY_COLLECTION_TARGET_SCOPE_INPUT` `2028 행` · 문구 상수는 JSX return 전역). AdminView 가 새 모듈에서 import 로 되돌려 쓰는 방향이라 helper 단독 slice 가 아니다.
  - 기대 순 감소는 **`-230 줄` 안팎** (이동 271 줄 − 신규 import 블록 증가분). 이 한 건으로 **잔여 helper 표면이 소진**되어, 이후 남는 것은 컴포넌트 본문뿐이라는 사실도 함께 적는다.
  - **파일 cap 주의 박제** — 배럴 (`3498 행` ~ `3630 행`) 재수출을 유지하면 심볼 import 방식 spec 은 무수정 통과하지만, AdminView **소스 텍스트** 를 `readFileSync` 로 읽는 drift-guard 가 15 개 있으므로 (`web/src/views/AdminView.*contract*.test.ts` 등) 그 anchor 가 이동 대상 문구 상수인지 **슬라이스 착수 시 재확인** 해 파일 cap 산술에 반영한다.
- [ ] `git diff --stat` 이 `docs/PLAN.md` **1 파일** 만 보고하고, bullet 의 나머지 서술 (측정 방법 문단 · 구조적 유인 설명 · 선행 처리 [T-1822](T-1822-pure-extraction-cap-bend-category.md) 링크 · 목표선 정의 · 넷째 슬라이스 서술 · `[ ]` 체크박스 상태) 은 **무변경**.
- [ ] 코드 변경 0 이므로 test 는 불요 — 단 `git status --short` 로 `docs/PLAN.md` 외 오염이 없음을 확인한다. (R-112 4 항목은 `commitMode: direct` doc-only 라 적용 대상이 아니다 — CLAUDE.md §3.2 의 direct-mode doc-only 면제.)

## Out of Scope

- `web/src/views/AdminView.tsx` 를 포함한 **모든 코드 변경** — 본 slice 는 doc-only `direct` 다. 실제 추출은 후속 `pr` slice (§3.1 판정 규칙 3 분리 유지).
- 지목된 잔여 순수 표면의 실제 이동 · 신규 모듈 신설 · 배럴 조정 — 다음 `pr` task 의 몫이다.
- 컴포넌트 본문 (prelude 1,997 줄 / JSX 907 줄) 분리 방식의 **설계 · ADR 작성** — 본 slice 는 분해 **실측 사실만** 박제한다. 방식 결정은 별도 검토다.
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 리팩터 추적 문서 갱신이라 REQ 구현이 없다 (CLAUDE.md §3.1 판정 규칙 6).
- [docs/architecture/components.md](../architecture/components.md) · [modules.md](../architecture/modules.md) 의 AdminView 서술 갱신 — 두 문서는 LOC 실측을 박제하지 않아 stale 이 아니다.
- PLAN `181 행` · `182 행` (과분할 차단 · 재판정 왕복) bullet 갱신.
- 부채 bullet 의 목표선 (≤ 2,000 줄) 자체 재조정 — 오너 지시값이라 planner 판단으로 바꾸지 않는다.
- `docs/PLAN.md` 의 다른 phase · 항목, [PLAN_archive.md](../PLAN_archive.md).

## Suggested Sub-agents

`implementer` (doc 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(생성 시 비어 있음)

## 완료 기록

- **완료 시각**: 2026-09-04T00:41Z (server-time 기준)
- **commit**: [`9edb7258`](https://github.com/myungjoo/Assessment-Agent/commit/9edb7258) (`direct` → main, `docs/PLAN.md` 1 파일 `+1/-1`)
- **실측 재확인** (`origin/main` = `bc6d06e8`): AdminView.tsx **3,630 줄 · top-level 선언 39 개**. 4 구역 경계는 `1~319` (import) · `321~591` (잔여 순수 표면 271 줄) · `593~3496` (컴포넌트 본문 2,904 줄) · `3498~3630` (배럴 133 줄) 이며 합이 3,630 으로 정합.
- **새로 박제한 사실**: 컴포넌트 본문 2,904 줄이 `593~2589` 의 hooks · state · 핸들러 prelude (1,997 줄) 와 `2590~3496` 의 JSX return (907 줄) 로 갈리며, mass 의 약 69% 가 markup 이 아니라 prelude 다 — "JSX 하위 컴포넌트화" 만으로는 목표선(≤ 2,000 줄) 에 닿지 않는다.
- **다음 대상 재지목**: 소멸한 두 지목(경로 빌더 축 · provider·난이도 파생 축) 을 **잔여 순수 표면 일괄 소진 슬라이스**(문구·DOM id 상수 22 + 범위 편집 4 심볼 + 폼 옵션·게이트 8 심볼, 기대 `-230 줄` 안팎) 로 교체했다. drift-guard 는 `readFileSync` + `AdminView.tsx` 동시 매칭 spec **15 개** 실측.
- **검증**: 코드 변경 0 인 doc-only `direct` 라 R-112 면제 (CLAUDE.md §3.2). `git diff --stat` 이 `docs/PLAN.md` 1 파일만 보고, 작업 트리 오염 0.

---
id: T-1908
title: AdminView 수집 대상 패널의 오류 alert 3 종 · 등록 폼을 AdminCollectionTargetsSection props 로 흡수 (경로 2 슬라이스 2/2)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-072]
estimatedDiff: 250
estimatedFiles: 3
independentStream: adminview-god-component-refactor
dependsOn: [T-1907]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminCollectionTargetsSection.tsx
  - web/src/views/AdminCollectionTargetsSection.test.tsx
created: 2026-09-06
plannerNote: "P6 · PLAN 184 행 경로 2 두 번째 슬라이스 — T-1907 이 children 슬롯으로 통과시킨 alert 3 종 · 등록 폼을 props 로 흡수해 패널 이관 완결"
---

# T-1908 — 수집 대상 패널의 오류 alert 3 종 · 등록 폼을 props 로 흡수 (경로 2 슬라이스 2/2)

## Why

[docs/PLAN.md](../PLAN.md) `184 행` AdminView god component 부채 bullet 이 지목한 **경로 2(JSX 섹션 → 하위 컴포넌트)** 의 수집 대상 패널 이관 중 절반만 끝났다. 직전 [T-1907](T-1907-adminview-collection-targets-section-extract.md)(PR #1498, squash `e073a466`)이 `<section>` 껍데기 · `<h2>` · 목록 마운트만 [AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) 로 옮기고, 오류 alert 3 종과 등록 폼은 **`children` 슬롯으로 그대로 통과**시켜 DOM 순서를 보존했다. 그 task 파일의 `Out of Scope` 와 `Follow-ups` 가 남은 절반(= 본 task)을 슬라이스 2/2 로 명시했다.

**즉 현재 상태는 중간 상태다** — 패널의 마크업 절반은 컴포넌트에, 절반은 여전히 AdminView 의 JSX 안에 있고(`1874 행` ~ `1906 행`, 33 줄), `children` prop 은 이 한 소비처만을 위해 열려 있는 임시 슬롯이다. 본 task 가 그 33 줄을 흡수하면 수집 대상 패널은 AdminView 에 **마운트 1 개만** 남기고 완전히 이관되며, `children` 슬롯은 소비처 0 이 되어 함께 제거된다.

착수 전 planner 가 확인한 사실(재확인 불요, 기준 = origin/main `e073a466`):

- AdminView.tsx 실측 **2,048 줄**(T-1907 직전 2,080 → `-32`). 마운트는 `1854 행` ~ `1907 행`, props 닫는 `>` 는 `1873 행`, children 블록은 `1874 행` ~ `1906 행`, 닫는 태그 `1907 행`.
- children 블록 구성 = 삭제 실패 alert(`1877 행` ~ `1879 행`) · 토글 실패 alert(`1882 행` ~ `1884 행`) · 편집 저장 실패 alert(`1887 행` ~ `1889 행`) · `isAdmin` gating 등록 폼(`1894 행` ~ `1906 행`) + 각 선행 주석.
- **issue-still-relevant 확인** — `e073a466` 의 [AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) 는 여전히 `children?: ReactNode` 슬롯만 갖고 `deleteError` · `createError` 계열 props 가 **없다**. 본 변경 의도는 main 에 미박제.
- **anchor census** — `grep -rl "AdminView.tsx" web/src --include=*.test.*` = **13 파일**이고, 그중 AdminView **소스 문자열**을 `readFileSync` 로 읽는 drift-guard 는 `AdminView.auth-me-contract.test.ts` · `AdminView.create-user-failure.test.ts` · `AdminView.groups-list-contract.test.ts` · `AdminView.test.tsx`(`9744 행` · `9829 행`) 뿐이며 **전부 사용자 · 그룹 · auth 축**이라 수집 대상 문자열을 세지 않는다. `AdminView.collection-targets-*.test.tsx` 6 건은 AdminView 를 렌더해 동작을 보는 spec 이라 렌더 DOM 이 같으면 무수정 통과한다(T-1907 에서 실증). → `touchesFiles` 3 파일 확정.
- **배럴 재수출 영향 0** — `1912 행` 이후 재수출 목록에 `CollectionTargetAddForm` 이 없고 러너 3 종(`runCreateCollectionTarget` 등)만 있다. 따라서 폼이 옮겨가면 AdminView 의 `244 행` import 는 **미사용이 되어 제거 대상**이고, 러너 import 는 재수출 때문에 유지된다.
- 순수 추출 3 조건은 PLAN `184 행` 판정대로 경로 2 전체가 **미충족**이므로 `sizeExempt` 금지. cap 산술: AdminView `-33/+16`, 컴포넌트 `+65`, spec `+85` ≈ **250 LOC / 3 파일** 로 cap 안(직전 동형 슬라이스 T-1907 실측 222 insertions / 60 deletions 로 보정).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — **경로 2 제약 3 종**(순수 추출 미충족 → `sizeExempt` 금지 / 소비처 동반 / census 합산) 문단과 수집 대상 패널 지목 문단.
- [docs/tasks/T-1907-adminview-collection-targets-section-extract.md](T-1907-adminview-collection-targets-section-extract.md) — `Acceptance Criteria` 의 props 명명 · gating 규약(§ "isAdmin 을 prop 으로 받지 않는다")과 `Out of Scope` 의 2/2 위임 문장.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1849 행` ~ `1853 행`(선행 주석) · `1854 행` ~ `1873 행`(현 마운트 props) · `1874 행` ~ `1906 행`(**흡수 대상 children 블록**) · `1907 행` 닫는 태그.
- 같은 파일 `244 행` — `CollectionTargetAddForm` default import(이동 후 미사용 → 제거 대상). `238 행` 주석은 이미 T-1907 이 남긴 안내이므로 필요 시 1 줄만 갱신.
- 같은 파일 `1912 행` 이후 배럴 재수출 블록 — 러너 3 종만 있고 폼이 없음을 확인(제거 판단 근거).
- [web/src/views/AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) 전체 93 줄 — props 인터페이스 · 주석 관례 · export convention.
- [web/src/views/AdminCollectionTargetsSection.test.tsx](../../web/src/views/AdminCollectionTargetsSection.test.tsx) `18 행` ~ `25 행`(`rows` · `baseProps` · `render` helper) · `69 행`(children 케이스 — 본 task 가 대체) — 케이스 추가 시 이 helper 를 재사용한다.
- [web/src/components/CollectionTargetAddForm.tsx](../../web/src/components/CollectionTargetAddForm.tsx) `CollectionTargetAddFormProps` 인터페이스 — 필수 3 값 + 필수 변경 콜백 3 + `onSubmit` 필수 + `loading?` · `error?` optional.
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) `§Decision 1` — 컴포넌트는 fetch 를 모른다(흡수 후에도 조회 · 훅 호출 0 유지).
- [CLAUDE.md](../../CLAUDE.md) `§3`(소비처 동반 의무) · `§3.2`(R-112).

## Acceptance Criteria

- [ ] [AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) props 확장 — 오류 축 3 개(`deleteError?: string` · `toggleError?: string` · `updateError?: string`)와 등록 폼 축(`createType: string` · `createInstanceKey: string` · `createEndpoint: string` · `onCreateTypeChange: (v: string) => void` · `onCreateInstanceKeyChange` · `onCreateEndpointChange` · `onCreateSubmit?: () => void` · `createLoading?: boolean` · `createError?: string`)을 추가한다. 값 변환 · 기본값 부여 0 — 받은 값을 그대로 `CollectionTargetAddForm` 에 통과시킨다.
- [ ] **gating 규약은 T-1907 승계** — `isAdmin` 을 prop 으로 받지 않는다. 등록 폼은 `onCreateSubmit` 이 정의된 경우에만 렌더하고(`onCreateSubmit ? <CollectionTargetAddForm … onSubmit={onCreateSubmit} /> : null`), 호출부가 `isAdmin ? handleCreateCollectionTarget : undefined` 삼항을 그대로 유지한다 — 비-Admin 에게 403 확정 컨트롤이 노출되지 않는 기존 계약 무변경.
- [ ] **렌더 DOM 순서 보존** — `<h2>` → `<CollectionTargetList>` → 삭제 alert → 토글 alert → 편집 저장 alert → 등록 폼 순서가 이동 전과 글자 그대로 같다. 각 alert 는 값이 falsy 면 **미렌더**(빈 `<div role="alert">` 를 남기지 않는다).
- [ ] `children?: ReactNode` prop 과 그 렌더 슬롯, 그리고 `import type { ReactNode }` 를 **제거**한다(소비처 0). 제거 후 컴포넌트에 미사용 import 가 남지 않는다.
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 소비처 배선 **같은 PR** — `1874 행` ~ `1906 행` children 블록을 지우고 마운트를 self-closing(`… />`)으로 바꾸며, 지운 값들을 위 신설 props 로 내려보낸다. `244 행` 의 `CollectionTargetAddForm` import 를 제거하고(배럴 재수출 없음 확인 완료), 러너 3 종 · 훅 import 는 유지한다. 흡수로 사라지는 주석 4 개 블록은 마운트 위 **4 줄 이하**로 응축한다.
- [ ] happy-path 1+ — colocated spec 에서 `deleteError` · `toggleError` · `updateError` 3 문구와 등록 폼(`onCreateSubmit` 전달)이 목록 뒤에 **선언 순서대로** 함께 렌더됨을 `renderToStaticMarkup` 문자열로 검증(문구 3 개의 `indexOf` 가 오름차순이고 폼이 그 뒤).
- [ ] error path 1+ — 목록 축 `error` 와 오류 alert 3 종이 동시에 주어져도 throw 0 이고 각 표면이 자기 자리에 렌더됨을 검증.
- [ ] 분기마다 1+ — (a) `deleteError` 유/무, (b) `toggleError` 유/무, (c) `updateError` 유/무, (d) `onCreateSubmit` 정의/미정의(폼 렌더/미렌더).
- [ ] negative 를 예외 분기마다 1+ — (a) 오류 3 종 · `onCreateSubmit` 을 모두 `undefined` 로 준 비-Admin 경로에서 `role="alert"` 요소 **0 개** · 등록 폼 컨트롤 0 개 · throw 0, (b) 세 오류가 동시에 truthy 여도 alert 가 서로 자리를 뺏지 않고 3 개 모두 렌더(같은 자리 공유 금지 회귀 차단), (c) `createError` 만 있고 `onCreateSubmit` 이 없으면 폼이 없으므로 그 문구도 노출되지 않음, (d) `createType` 등 입력값이 빈 문자열이어도 폼이 throw 없이 렌더되고 submit 이 차단 상태로 나옴.
- [ ] 기존 spec **무수정** green — `AdminView.collection-targets-*.test.tsx` 6 건 · `AdminView.test.tsx` 섹션 id · heading 단언을 한 줄도 고치지 않는다(고쳐야 한다면 렌더 DOM 이 달라진 것이므로 되돌린다). 단 본 컴포넌트의 colocated spec 안 `children` 케이스(`69 행`)는 슬롯 제거에 맞춰 위 신설 케이스로 **대체**한다.
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) · `pnpm build` 통과, `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과.
- [ ] cap 준수 — 최종 diff 300 LOC 이하 / 파일 3 개. 파일별 예산: 컴포넌트 증가 70 줄 이하 · spec 증가 90 줄 이하 · AdminView diff 55 줄 이하. 초과가 불가피하면 `sizeExempt` 를 붙이지 말고 BLOCKED(`task-too-large`) 로 되돌린다.

## Out of Scope

- `useAdminCollectionTargets()` 호출 · destructure 블록을 컴포넌트로 옮기지 않는다(컴포넌트는 controlled 유지 — ADR-0041 §Decision 1).
- `CollectionTargetList` · `CollectionTargetAddForm` 내부 수정 금지(props 계약 · 마크업 · 문구 무변경).
- alert 3 종의 마크업을 개선하지 않는다(공용 alert 컴포넌트 추출 · aria 속성 추가 · className 부여 전부 금지 — 이동만 한다).
- 나머지 4 패널(사용자 · 인원 · 그룹 · 파트) 손대지 않는다.
- `sizeExempt` 부여 금지 — PLAN `184 행` 이 경로 2 를 순수 추출 3 조건 **미충족**으로 박제했다.
- PLAN `184 행` 실측 LOC 갱신 · 마커 승격 금지(별도 direct slice — 본 PR 머지 후 실측이 ≤ 2,000 줄일 때만 성립).
- 새 문구 상수 · 새 CSS 규칙 · 새 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점 없음 — 본 PR 머지 후 planner 가 PLAN `184 행` 실측 갱신 슬라이스와 다음 패널 지목을 큐잉한다.)

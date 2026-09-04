---
id: T-1884
title: AdminView 의 import/export 축 prelude(상태 9 + 핸들러 5 + 패널 props 파생 1)를 useAdminImportExport hook 으로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
independentStream: adminview-god-component-refactor
dependsOn: [T-1882]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminImportExport.ts
  - web/src/views/useAdminImportExport.test.tsx
estimatedDiff: 580
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`1479 행` ~ `1649 행` 의 import/export 축 state · 핸들러 · 패널 props 파생을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminImportExport()` 시그니처와 `return { selectedScope, handleScopeChange, importExportPanelProps };` literal · AdminView 의 destructure 한 줄 · import 경로 조정뿐이며 분기 0) · (b) 신규 로직 0 LOC (`handleExport` 의 `runAdminExportJob` 주입 · `handleImport` 의 `runImportPreview` 주입 · `handleConfirmImport` 의 `runConfirmedImport` 주입 · `handleCancelImport` 의 `clearImportConfirm` 주입 · `importExportPanelProps` 의 `busy`/`error`/`message` OR·?? 합성 전부 본문 무변경 이동, `useCallback` deps 배열도 그대로) · (c) 렌더 트리가 그대로라 AdminView 렌더 spec 무수정 통과 — planner 가 AdminView 소스를 `readFileSync` 로 읽는 drift-guard 19 파일을 전수 검사한 결과 이동 대상(prelude 선언 · 핸들러 이름 · `useState` 패턴)을 anchor 로 쓰는 spec 은 0 건이고(`AdminView.test.tsx` `2873 행` 의 `setExporting` 은 러너 unit test 의 주입 인자이지 소스 텍스트 anchor 가 아니다), JSX 텍스트를 anchor 로 쓰는 guard 는 JSX 무변경이라 그대로 산다. 이동 171 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 첫 본문 분해 슬라이스 — import/export 축 hook 화, head 38bbd710 좌표 · 축 밖 의존 0 · drift-guard anchor 0 실측"
---

# T-1884 — AdminView 의 import/export 축 prelude 를 useAdminImportExport hook 으로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` 오너 지시 AdminView god component 부채 bullet 의 **열여덟째 슬라이스이자 첫 본문 분해 슬라이스** 다. 직전 [T-1883](T-1883-plan-adminview-debt-remeasure-body-phase.md) 이 9 차 실측으로 **순수 추출 경로 종료**(컴포넌트 밖 표면 0)를 박제하면서, 남은 mass 인 컴포넌트 본문 2,904 줄 중 **69% 가 JSX 가 아니라 prelude 1,997 줄** 임을 밝히고 다음 대상으로 **prelude 인벤토리 ⑤ import/export 축**(`1481 행` ~ `1650 행`, 170 줄, 연속, 축 밖 의존 0)을 목적지 · 순 감소 기대 · cap 산술과 함께 지목했다. 본 task 는 그 지목을 그대로 집행한다.

**issue-still-relevant pre-check 실측** (head `38bbd710`, PLAN 실측 기준 commit `839562a7` 이후 doc-only commit 만 있어 코드 동일):

- `wc -l web/src/views/AdminView.tsx` = **3,450 줄** — PLAN 표기와 일치, 좌표 유효.
- 목적지 `web/src/views/useAdminImportExport.ts` 는 main 에 **미존재** (`web/src/views/` 에 `useAdmin*` 모듈 0 개) — 중복 안착 없음.
- 이동 대상 블록 실좌표는 선행 주석 포함 **`1479 행` ~ `1649 행`(171 줄)** — `exporting`(`1481 행`) · `exportMessage`(`1485 행`) · `exportError`(`1491 행`) · `selectedScope`(`1498 행`) · `handleExport`(`1513 행`) · `handleScopeChange`(`1533 행`) · `importing`(`1539 행`) · `importMessage`(`1543 행`) · `importError`(`1549 행`) · `importConfirmText`(`1555 행`) · `pendingImportFile`(`1561 행`) · `handleImport`(`1577 행`) · `handleConfirmImport`(`1598 행`) · `handleCancelImport`(`1614 행`) · `importExportPanelProps`(`1628 행`) 로 PLAN 인벤토리와 일치.
- **축 밖 의존 0 재확인** — 블록 안의 `set*` 호출은 전부 자기 축 state 이고(타 축 refresh nonce 미접촉), 블록이 참조하는 외부 심볼(`runAdminExportJob` · `runImportPreview` · `runConfirmedImport` · `clearImportConfirm` · `browserDownloadDeps` · `createExportJob` · `getExportJob` · `downloadExportJob` · `request` · `toErrorMessage` · `DataImportExportPanelProps`)은 **전부 모듈 최상위 import** 라 hook 모듈이 직접 import 하면 된다 → **hook 은 파라미터 0 개**. 역방향으로도 블록의 15 심볼을 블록 밖에서 쓰는 코드는 **주석 4 곳뿐**(`21 행` · `1659 행` · `1663 행` · `1669 행` · `2629 행`)이라 실사용 0.
- 소비처는 JSX **3 곳**(`2634 행` `value={selectedScope}` · `2635 행` `onChange={handleScopeChange}` · `2649 행` `<DataImportExportPanel {...importExportPanelProps} />`) — 같은 슬라이스에서 destructure 한 줄로 되돌려 쓰므로 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무 충족(helper 단독 슬라이스 아님).
- drift-guard 19 개(`grep -rl "AdminView.tsx" web/src --include=*.test.*`) 전수 검사 결과 **이동 대상을 anchor 로 쓰는 spec 0 건** — 3 개의 `readFileSync` 소스 텍스트 guard 는 각각 역할 변경(`9188 행` 인근) · 인스턴스 접근(`9605 행` 인근) · 사용자 관리(`9681 행` 인근) 축을 본다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 prelude 축별 인벤토리 ⑤ · 순수 추출 3 조건 판정(경로 1 충족) · 파일 cap 주의.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1479 행` ~ `1649 행` (이동 대상 전문), `19 행` ~ `56 행` · `132 행` ~ `133 행` (import 블록 중 본 축 관련분), `2625 행` ~ `2652 행` (소비처 JSX 3 곳), `3318 행` ~ `3450 행` (배럴 재수출 — 본 task 는 배럴을 건드리지 않는다).
- [web/src/views/adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) — 이미 분리된 실행 로직(러너 · deps 타입 · `browserDownloadDeps`). 본 task 는 이 모듈을 **수정하지 않는다**.
- [web/src/views/adminViewConstants.test.ts](../../web/src/views/adminViewConstants.test.ts) — 직전 슬라이스([T-1882](T-1882-adminview-residual-static-surface-extract.md))의 colocated spec 형식 선례.
- [web/src/views/AdminView.collection-targets-mount.test.tsx](../../web/src/views/AdminView.collection-targets-mount.test.tsx) `1 행` ~ `30 행` — RTL 부재 환경의 렌더 harness 선례(`renderToStaticMarkup` + `vi.mock`). 신규 hook spec 의 probe 컴포넌트가 이 패턴을 승계한다.

## Acceptance Criteria

- [ ] 신규 [web/src/views/useAdminImportExport.ts](../../web/src/views/useAdminImportExport.ts) 가 AdminView `1479 행` ~ `1649 행` 의 15 선언(export 상태 4 + import 상태 5 + 핸들러 5 + 패널 props 파생 1)을 **선행 주석까지 본문 무변경으로** 담고, `export function useAdminImportExport()` 가 `{ selectedScope, handleScopeChange, importExportPanelProps }` 를 반환한다 (파라미터 0 개 — 외부 의존은 모듈 최상위 import 로 해결).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 같은 위치에서 `const { selectedScope, handleScopeChange, importExportPanelProps } = useAdminImportExport();` 한 줄로 되돌려 쓰고, JSX 3 곳(`value={selectedScope}` · `onChange={handleScopeChange}` · `<DataImportExportPanel {...importExportPanelProps} />`)은 **한 글자도 바뀌지 않는다**.
- [ ] 이동으로 미사용이 된 AdminView import 만 제거한다 — `browserDownloadDeps`(`34 행`) · `createExportJob`/`getExportJob`/`downloadExportJob`(`25 행` ~ `27 행`, 셋 모두 미사용이면 `../api/exportJob` import 문 자체 제거) · `DataImportExportPanelProps` 타입(`133 행`). **배럴(`3318 행` ~ `3450 행`)이 재수출하는 심볼의 import 는 남긴다** (`runAdminExportJob` · `runImport` · `runImportPreview` · `runConfirmedImport` · `clearImportConfirm` · `buildExportInput` · `formatImportJobDetail` 등) — 제거하면 배럴이 깨져 기존 spec 이 red.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **3,290 줄 이하**(기대 순 감소 `-160` 줄 안팎, 기준 3,450)로 줄어든다.
- [ ] **happy-path unit test** — 신규 colocated spec [web/src/views/useAdminImportExport.test.tsx](../../web/src/views/useAdminImportExport.test.tsx) 가 probe 컴포넌트(`renderToStaticMarkup` 로 1 회 렌더)로 hook 을 호출해 반환 3 심볼의 초기값을 고정한다: `selectedScope === ''` · `handleScopeChange` 가 함수 · `importExportPanelProps` 의 `busy === false` · `error`/`message` 가 `undefined` · `onExport`/`onImportFile`/`onConfirmImport`/`onCancelImport` 4 콜백이 모두 함수.
- [ ] **happy-path (핸들러 주입 계약)** — `vi.mock('./adminImportExportRunners')` 로 러너 4 개를 대체한 뒤 `onExport()` · `onImportFile(file)` · `onConfirmImport()` · `onCancelImport()` 를 각각 호출해, 대응 러너(`runAdminExportJob` · `runImportPreview` · `runConfirmedImport` · `clearImportConfirm`)가 **1 회씩** 호출되고 주입 deps 에 자기 축 setter(`setExporting`/`setExportError`/`setExportMessage`, `setImporting`/`setImportError`/`setImportMessage`/`setImportConfirmText`/`setPendingImportFile`)와 in-flight 가드(`exporting` / `importing`)가 이동 전과 동일한 키로 전달되는지 검증한다.
- [ ] **error path unit test** — 러너 mock 이 reject 하는 Promise 를 반환할 때 hook 의 핸들러 호출이 **동기 throw 하지 않고** 그 Promise 를 그대로 전파하는지 1+ test (실패 문구 합성 책임은 러너에 있고 hook 은 위임만 한다는 이동 전 계약 고정). `handleScopeChange` 에 `{ target: { value: 'g1' } }` 이 아닌 형태를 넘길 때의 동작도 1+ test.
- [ ] **분기 cover** — `importExportPanelProps` 의 3 합성 분기 각각 1+ test: `busy: exporting || importing`(양쪽 false → false, 한쪽 true → true) · `error: exportError ?? importError`(export 우선, export 없음 → import 폴백, 둘 다 없음 → `undefined`) · `message: exportMessage ?? importMessage`(동형 3 조합). state 를 실제로 갱신할 수 없는 harness 라면 **러너 mock 이 주입받은 setter 를 렌더 단계에서 호출해 재렌더를 유발하는 probe**(신규 dependency 0) 로 각 조합을 만든다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: ① `onExport()` 를 in-flight(`exporting === true`) 상태에서 재호출해도 러너의 가드 인자가 `exporting: true` 로 전달됨 · ② `onImportFile` 에 파일 없이(`undefined`) 호출된 경우의 전달값 · ③ `onConfirmImport()` 를 보관 파일 없이 호출할 때 러너에 `undefined` 가 그대로 넘어감(hook 이 자체 판단하지 않음) · ④ `onCancelImport()` 가 POST 를 유발하지 않고 `clearImportConfirm` 만 호출 · ⑤ hook 이 반환 객체에 내부 setter 를 **노출하지 않음**(캡슐화 회귀 가드).
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 green — 기존 web vitest **130 파일 3,879 test** 가 무수정 통과하고(직전 T-1882 기준선), 신규 spec 만큼 파일 · test 수가 증가한다. AdminView 소스를 `readFileSync` 로 읽는 drift-guard 19 개도 red 없음.
- [ ] 착수 시 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 로 drift-guard 목록을 **재실측**해 이동 대상을 anchor 로 쓰는 spec 이 새로 생겼는지 확인한다. 발견되면 그 파일까지 포함해도 파일 cap ≤ 5 를 지킬 수 있는지 판정하고, 초과하면 착수 전 Follow-ups 에 남기고 범위를 줄인다.

## Out of Scope

- [adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) 본문 수정 — 러너 · deps 타입 · 문구 helper 는 이미 분리돼 있고 본 task 는 건드리지 않는다.
- AdminView 배럴 재수출(`3318 행` ~ `3450 행`) 변경 — hook 을 배럴에 추가하지 않는다(기존 공개 표면 무변경이 (c) 조건의 근거다).
- JSX return(`2410 행` ~ `3316 행`) 의 하위 컴포넌트 분리 — PLAN 판정의 **경로 2** 이고 순수 추출 3 조건 미충족이라 별도 슬라이스다.
- 다른 prelude 축(① 그룹 · 멤버십 / ② 인원 / ③ ServiceIdentity / ④ LLM provider · 난이도 / ⑥ 수집 대상 / ⑦ 파트 / ⑧ 사용자 관리 / ⑨ 스케줄) 의 hook 화 — 한 슬라이스 한 축.
- import/export 기능 동작 · UI 문구 · 패널 props 계약 변경 — 순수 추출이므로 동작 변경 0.
- 새 dependency 추가(RTL · react-test-renderer 등) — 필요해 보이면 BLOCKED 로 올린다([CLAUDE.md](../../CLAUDE.md) `§5`).
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — 머지 후 별도 `direct` task(10 차 실측).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **`scripts/check-spec-presence.sh` 가 `.test.tsx` 를 인정하지 않는다** — 본 slice 의 round 1 CI 가 `spec 파일 동반 여부 검사` step 에서 red 였다. 스크립트가 `.spec.ts` / `.test.ts` 두 확장자만 허용해 AC 가 지정한 `useAdminImportExport.test.tsx` 를 spec 으로 세지 못했다. 본 PR 안에서는 probe 렌더를 `createElement` 로 바꿔 `.test.ts` 로 개명해 우회했으나(스크립트 무수정), React 컴포넌트를 JSX 로 렌더하는 후속 hook slice 는 같은 벽에 다시 부딪힌다. planner 가 별도 `pr` task 로 스크립트에 `.test.tsx` / `.spec.tsx` 를 추가하고 [scripts/check-spec-presence.test.sh](../../scripts/check-spec-presence.test.sh) 에 대응 케이스를 붙일 것.
- **`useAdminImportExport` 는 파라미터 0 개가 아니라 1 개** — 본 task 의 planner pre-check 가 `initialImportConfirmText`(AdminView prop, 이동 전 `1555 행` 의 `useState` 초기값) 를 축 밖 의존으로 세지 못했다. 실제 구현은 `useAdminImportExport(initialImportConfirmText?: string)` 로 동작 보존한 채 안착했고 reviewer 가 MINOR 로 확인했다. 후속 축 hook 화 slice 의 pre-check 는 `useState` 초기값의 prop 참조까지 훑을 것.

## 완료 기록

- **완료 시각**: 2026-09-04T04:07Z (server-time 기준 — `gh api -i rate_limit` `Date` 헤더 `Fri, 04 Sep 2026 03:37:31 GMT` 기준 fire)
- **PR / merge**: [PR #1472](https://github.com/myungjoo/Assessment-Agent/pull/1472) → main [`388a2282`](https://github.com/myungjoo/Assessment-Agent/commit/388a2282) (squash, round 1 APPROVE)
- **실측 결과**: `web/src/views/AdminView.tsx` **3,450 → 3,277 줄 (-173)** — AC 의 목표선(≤ 3,290) 충족. 신규 [useAdminImportExport.ts](../../web/src/views/useAdminImportExport.ts) 205 줄 + colocated spec [useAdminImportExport.test.ts](../../web/src/views/useAdminImportExport.test.ts) 458 줄. 3 파일 `+671/-181`.
- **순수성**: 이동 171 줄은 main `8197ef21` 원본과 본문 · `useCallback` deps 배열 · 러너 주입 키까지 무변경. AdminView 는 destructure 한 줄로 되돌려 쓰고 JSX 3 곳(`value={selectedScope}` · `onChange={handleScopeChange}` · `<DataImportExportPanel {...importExportPanelProps} />`) 은 한 글자도 바뀌지 않았다. 미사용이 된 `../api/exportJob` import 문 · `browserDownloadDeps` · `DataImportExportPanelProps` 타입만 제거하고 배럴 재수출 심볼의 import 는 전부 남겼다.
- **AC 대비 유일한 편차**: hook 시그니처가 파라미터 0 개가 아니라 `initialImportConfirmText?: string` 1 개 — 위 `Follow-ups` 참조. 동작 보존이며 reviewer MINOR 확인.
- **검증**: 신규 spec 20 test (happy 3 · 주입 계약 4 · error 3 · 분기 5 · negative 5) 로 R-112 4 종 전부 cover. web vitest **131 파일 3,899 test** green (직전 T-1882 기준선 130/3,879 대비 +1 파일 +20 test), AdminView 소스를 `readFileSync` 로 읽는 drift-guard 19 개 red 0. `cd web && pnpm lint && pnpm build && pnpm test` 전부 green.
- **CI**: round 1 첫 push(`e6937b8c`) 는 `spec 파일 동반 여부 검사` step 에서 fail — 위 `Follow-ups` 의 `.test.tsx` 미인식이 원인이며 spec 파일명 변경으로 같은 round 안에서 해소. 최종 PR head `e548af72` 의 pull_request run(33834557901) 과 approve-comment 재검증 run(33834703097) 모두 **success**, 머지 후 main run(33835053830) 도 **success**.
- **4-게이트**: reviewer VERDICT=APPROVE PR comment 외부 존재(게이트 2, 1 건) · CI green(게이트 4) · integrator 자체 점검 통과 · Acceptance Criteria 11 항목 전부 ok → round 1 squash merge.

---
id: T-0372
title: P6 frontend UI slice 12 — 대시보드 페이지네이션 컨트롤 presentational 컴포넌트 (web/src/components/DashboardPaginationControl.tsx)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-046, REQ-092]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2(시각화 대시보드) 잔여 fragment — 결과 표 페이지네이션/페이지 크기 컨트롤 props 기반 presentational, T-0361~T-0371 file-disjoint·새 dep 0·ci.yml 무관.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/DashboardPaginationControl.tsx
  - web/src/components/DashboardPaginationControl.test.tsx
---

# T-0372 — P6 frontend UI slice 12: 대시보드 페이지네이션 컨트롤 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 잔여 표시 표면 중 **결과 표 페이지네이션** fragment 를 컴포넌트로 분해한다. bullet2 의 정렬·필터 컨트롤은 `DashboardFilterBar`(T-0370)가, 결과 표는 `EvaluationResultTable`(T-0363)가, 시계열 추이는 `TrendTimeSeriesPanel`(T-0371)가 props 기반으로 박제했으나, **대용량 결과(R-091 의 100~200명 규모)를 페이지 단위로 탐색하는 컨트롤**(현재 페이지·전체 페이지·이전/다음·페이지 크기 선택)은 아직 없다. 본 task 는 그 **페이지네이션 컨트롤 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361~T-0371) 와 동일하게 props 로만 현재 페이지·전체 항목 수·페이지 크기·콜백·loading/error 를 받는 순수 controlled component 로 시작하며, **내부 상태/데이터 fetch 없이** 이전/다음·페이지 번호·페이지 크기 변경을 콜백으로만 위임한다. 실제 결과 fetch(GET /api/*)·서버 페이지네이션 쿼리·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. (조회·시각화 R-046 의 대용량 결과 탐색 UI 표면을 props 기반으로 미리 박제하고, R-092 의 "조회·시각화 3초 이내" 가 향후 구동할 페이지 분할 표시 컴포넌트의 정적 표면만 확보한다 — 데이터 배선·성능 검증은 후속.)

## Required Reading

- `web/src/components/DashboardFilterBar.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 빈/미전달 fallback 분기 + 라벨 fallback + 콜백 prop convention(`onChange` 류) + named(`export type`)/default export convention 의 직전 선례(T-0370). 본 task 의 loading/error 분기·콜백 위임·라벨 fallback 구조는 이 패턴을 그대로 차용한다. 직접 import 하지 않고(file-disjoint 유지) 모양만 정합.
- `web/src/components/EvaluationResultTable.tsx` — 결과 표 데이터 convention(`EvaluationResultRow`)·`role`/`aria-*` 사용·named/default export convention 의 직전 선례. 본 페이지네이션 컨트롤이 향후 결합될 결과 표의 항목 수·표식 모양을 이와 정합시킨다. 직접 import 하지 않고 모양만 정합.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지, 라우터·상태관리 라이브러리 포함 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/DashboardPaginationControl.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - props 타입: `interface DashboardPaginationControlProps { currentPage: number; totalItems: number; pageSize: number; pageSizeOptions?: number[]; onPageChange?: (page: number) => void; onPageSizeChange?: (size: number) => void; loading?: boolean; error?: string; labelPrefix?: string }` (named export).
  - **전체 페이지 수 계산**: `totalPages = Math.max(1, Math.ceil(totalItems / pageSize))` (순수 파생값 — 내부 상태 없음). `pageSize <= 0` 또는 `totalItems` 음수 등 비정상 입력은 안전 fallback(예: totalPages 1, 빈 결과 표식)로 처리해 NaN/Infinity 렌더를 방지한다.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, 페이지 컨트롤(이전/다음·페이지 번호·페이지 크기 선택)은 미렌더 또는 전부 비활성(disabled)한다 (loading 우선 정책 — error 보다 우선).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더하고 페이지 컨트롤은 미렌더 또는 비활성한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading`·`error` 가 아니면 페이지 컨트롤을 렌더한다: 이전 버튼·다음 버튼·현재 페이지/전체 페이지 표식(예: "3 / 10 페이지")·전체 항목 수 표식·페이지 크기 선택(`pageSizeOptions` 전달 시 그 옵션, 미전달 시 기본 예: `[10, 20, 50]`).
    - **경계 비활성**: `currentPage <= 1` 이면 이전 버튼 `disabled`, `currentPage >= totalPages` 면 다음 버튼 `disabled` (경계 page 에서 콜백이 범위 밖으로 호출되지 않도록).
    - `labelPrefix` 미전달 시 기본 한국어 라벨(예: "결과")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
  - **콜백 위임**: 이전/다음 버튼은 각각 `onPageChange?.(currentPage - 1)` / `onPageChange?.(currentPage + 1)` 를 경계 비활성이 아닐 때만 호출하고, 페이지 크기 선택 변경은 `onPageSizeChange?.(선택값)` 를 호출한다. 콜백 prop 미전달(`undefined`)이어도 throw 하지 않는다(옵셔널 체이닝). 내부 상태(`useState`)·데이터 fetch·라우팅·외부 store 사용 금지 — props 표시·파생 계산·콜백 위임만.
  - named export(props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만).
- [ ] `web/src/components/DashboardPaginationControl.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (분기는 **렌더 구조** — 이전/다음 버튼 존재·`disabled` 속성·페이지 표식 텍스트·전체 항목 수 표식·페이지 크기 옵션 개수·`role="status"`/`role="alert"`/라벨 fallback — 로 검증한다. 콜백 호출은 정적 markup 으로는 직접 검증 불가하므로 disabled 경계 분기·렌더 구조로 cover 하고, 콜백 위임 자체는 컴포넌트가 핸들러를 부착했는지 정적 구조로 간접 확인한다.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, `totalItems`·`pageSize`·중간 `currentPage` 전달)에서 이전/다음 버튼·"현재/전체 페이지" 표식·전체 항목 수 표식·페이지 크기 옵션이 렌더되고, 중간 페이지에서는 이전/다음 둘 다 활성(미disabled)임을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 페이지 컨트롤이 미렌더(또는 disabled)됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 + 컨트롤 미렌더/비활성), 정상 렌더 분기, 첫 페이지 경계(`currentPage=1` → 이전 버튼 `disabled`), 마지막 페이지 경계(`currentPage=totalPages` → 다음 버튼 `disabled`), 단일 페이지(`totalPages=1` → 이전·다음 둘 다 `disabled`) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error 보다 우선 1+; `error` 와 정상 페이지 입력 동시 전달 시 error 우선(컨트롤 미렌더/비활성) 1+; `currentPage=1` 첫 페이지 경계(이전 disabled) 1+; 마지막 페이지 경계(다음 disabled) 1+; `pageSize <= 0` 비정상 입력 시 안전 fallback(totalPages 1·NaN/Infinity 미렌더) 1+; `totalItems=0` 빈 결과(totalPages 1·이전/다음 disabled) 1+; `pageSizeOptions` 미전달 시 기본 옵션 fallback 1+; `labelPrefix` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `labelPrefix`(falsy → 기본 라벨 fallback 경계값) 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; `onPageChange`/`onPageSizeChange` 미전달(undefined)이어도 렌더가 throw 하지 않음 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/경계 페이지/단일 페이지/비정상 pageSize)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 결과 fetch(GET /api/*) · 서버 페이지네이션 쿼리(offset/limit·cursor) · 페이지 prefetch · 무한 스크롤 · 전체 페이지 데이터 캐싱 — 후속 slice 책임. 본 task 는 props 로 받은 페이지 메타를 표시하고 페이지/크기 변경을 콜백으로만 위임.
- 내부 상태(`useState`)로 currentPage/pageSize 보유 — 본 task 는 controlled(부모가 상태 소유). uncontrolled 변형은 후속 wiring slice 책임.
- R-092 "조회·시각화 3초 이내" 의 실제 성능 검증 · 데이터 로딩 최적화 — 후속 데이터 배선·성능 task 책임. 본 task 는 표시 표면만.
- `EvaluationResultTable`/`DashboardFilterBar`/`TrendTimeSeriesPanel` 와의 실제 결합(페이지네이션이 표를 구동) · 컨테이너 컴포넌트 · 상태 lift-up — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0371 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 라우터(react-router) · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0371 와 교집합 0).
- 정교한 스타일링(CSS) · 페이지 번호 범위 압축("1 … 4 5 6 … 20" 생략 표기) · 점프-to-page 입력 — 의미 구조(이전/다음 버튼 · 현재/전체 페이지 표식 · 전체 항목 수 · 페이지 크기 선택 · 경계 disabled · `role="status"`/`role="alert"`)만. 정교한 번호 범위/점프 UI 는 후속 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 페이지네이션 컨트롤 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---

## 완료 기록

- **Status: DONE** (2026-06-13T11:57Z, cron@cloud-aa-local-sched)
- PR [#304](https://github.com/myungjoo/Assessment-Agent/pull/304) → squash merge `3465e09` (`--delete-branch`).
- reviewer APPROVE round 1/7, integrator 4-게이트 PASS, CI first-pass green.
- DashboardPaginationControl presentational 컴포넌트 + spec(web vitest 20 신규/191 전체) — 새 dep 0, backend 불변.
- frontmatter status 가 머지 시 closeout 에서 PENDING 으로 잔류 → 본 doc-sync 로 DONE 정정 (T-0402).

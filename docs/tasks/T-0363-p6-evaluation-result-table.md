---
id: T-0363
title: P6 frontend UI slice 3 — 평가 결과 조회 테이블 presentational 컴포넌트 (web/src/components/EvaluationResultTable.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-046]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: [T-0353]
touchesFiles:
  - web/src/components/EvaluationResultTable.tsx
  - web/src/components/EvaluationResultTable.test.tsx
plannerNote: "P6 UI bullet2(시각화 대시보드 sort/filter) 분해 — 순수 presentational 결과 테이블(분기有: empty/loading/sort방향), 새 dep 0, ci.yml 무관, T-0362 패턴 차용"
---

# T-0363 — P6 frontend UI slice 3: 평가 결과 조회 테이블 presentational 컴포넌트

## Why

Q-0037 사용자 결정 ("P6 frontend 진입") 에 따라 P6 frontend UI 작업을 계속 분해한다. [PLAN.md](../PLAN.md) Phase P6 의 2번째 bullet **"시각화 대시보드 (정렬·필터·시계열)"** 의 첫 building block 으로, **평가 결과를 표로 조회하는 presentational 테이블 컴포넌트**를 박제한다 ([requirements.md](../requirements.md) REQ-038 "UI 조회 / sort / filter / 시계열" + REQ-046 "User read-only 조회/sort/filter"). [ADR-0040](../decisions/ADR-0040-frontend-stack.md) §1 이 "sort/filter dashboard 는 React 의 선언적 상태 모델이 표준" 임을 채택 근거로 박제했고, 그 위에 올라가는 첫 UI slice 다.

본 task 는 직전 slice (T-0362 LoginForm, T-0361 EvaluationGuardBanner) 와 동일하게 **데이터 의존성 0 의 순수 presentational 컴포넌트**로 시작한다. 테이블은 표시할 행(rows)·현재 정렬 상태(sort key/direction)·정렬 변경 콜백·loading 플래그를 props 로만 받아 렌더하며, 실제 결과 fetch (`/api/*` 소비)·정렬 로직 실행·시계열 차트·필터 UI 배선은 후속 slice 로 분리한다 (아래 Out of Scope). 이렇게 scaffold (T-0353) 외 어떤 task 에도 의존하지 않는 dependency-free 진입을 유지해, fine-grained concurrency (현재 stage 5b, direct-only 병렬) 하에서도 다른 web 파일과 file-disjoint 하게 둔다.

## Required Reading

- `web/src/components/LoginForm.tsx` — 직전 slice 의 순수 presentational controlled 컴포넌트 패턴 (props 인터페이스 + 분기 + named/default export convention + 한국어 주석). 본 task 는 이 패턴을 그대로 차용한다.
- `web/src/components/EvaluationGuardBanner.tsx` — 더 단순한 분기(active 토글) presentational 패턴 + `role` 속성 사용 예. 테이블의 empty/loading 분기 작성 시 참고.
- `web/src/App.test.tsx` 와 `web/src/components/EvaluationGuardBanner.test.tsx` — vitest 테스트 패턴: `react-dom/server` 의 `renderToStaticMarkup(<...>)` 로 **jsdom 없이** 정적 렌더 문자열만 검증 (dep 표면 최소화 — jsdom·@testing-library 도입은 ADR-0040 §5 게이트라 본 task 금지). 파일명은 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS, sort/filter dashboard 채택 근거), §5 (dep 게이트: react/react-dom/vitest 만 — 그 외 import 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만 — 그 외 import 금지).

## Acceptance Criteria

- [ ] `web/src/components/EvaluationResultTable.tsx` 신설 — 평가 결과 행 목록을 표로 렌더하는 순수 함수형 컴포넌트. 최소 인터페이스 (예시 — 구현이 동등 의미로 조정 가능):
  - 행 타입: `{ id: string; subjectName: string; metricLabel: string; score: number }` (1행 = 1 평가 결과; 필드명/구성은 구현이 동등 의미로 조정 가능).
  - props: `{ rows: EvaluationResultRow[]; sortKey?: keyof EvaluationResultRow; sortDirection?: 'asc' | 'desc'; onSortChange?: (key: keyof EvaluationResultRow) => void; loading?: boolean; emptyMessage?: string }`
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 로딩 표시 (예: `role="status"` 영역에 "불러오는 중…") 를 렌더하고 테이블 본문(행)은 렌더하지 않는다.
    - `loading` 이 아니고 `rows` 가 빈 배열이면 빈 상태 메시지 (`emptyMessage` 가 truthy 면 그 문구, 아니면 기본 문구 예: "표시할 평가 결과가 없습니다") 를 렌더한다. 의미 없는 빈 테이블 헤더만 남기지 않는다.
    - `rows` 가 1개 이상이면 헤더 + 각 행을 `<table>` 구조로 렌더한다 (각 행은 props 로 받은 순서대로 — **정렬 로직 자체는 본 컴포넌트가 수행하지 않는다**, props 의 rows 순서를 그대로 표시하는 presentational 책임만).
    - 정렬 가능 컬럼 헤더 클릭 시 `onSortChange(key)` 호출 (콜백이 주어졌을 때만). `sortKey` + `sortDirection` 이 현재 정렬 상태를 시각/의미적으로 반영 (예: 현재 정렬 컬럼 헤더에 `aria-sort="ascending|descending"` 부여, 나머지는 미부여 또는 `none`).
  - 새 dependency import 금지 (react 만). fetch·라우팅·정렬/필터 실 로직·외부 store 사용 금지 — 데이터·정렬 상태는 props 로 받는다 (controlled component). `loading` 과 `empty` 의 우선순위는 구현이 정한 정책을 test 로 고정 (예: loading 이면 rows 유무와 무관하게 로딩 표시 우선).
- [ ] R-112 unit tests — `web/src/components/EvaluationResultTable.test.tsx` (vitest, `renderToStaticMarkup` 사용 — jsdom 불요):
  - **happy-path 1+**: rows 2~3개를 전달하면 각 행의 `subjectName`/`metricLabel`/`score` 값과 `<table>`/`<th>` 헤더가 렌더 결과에 포함됨을 검증. props 의 rows 순서대로 출력되는지(첫 행 토큰이 둘째 행 토큰보다 앞 index) 확인 1+.
  - **error/negative path 1+**: rows 빈 배열 + `loading` 미전달 시 기본 빈 상태 문구가 렌더되고 데이터 행(`<td>` score 등)은 렌더되지 않음 1+.
  - **flow / branch** — 아래 분기 각 1+ test:
    - `loading={true}` → 로딩 표시(`role="status"` + "불러오는 중") 렌더, 행/빈상태 문구 미렌더.
    - `loading` 미전달(false) + rows 있음 → 테이블 본문 렌더.
    - rows 빈 배열 + `loading` 미전달 → 빈 상태 문구 렌더.
    - `sortKey`/`sortDirection` 전달 시 해당 컬럼 헤더에 `aria-sort` (ascending/descending) 가 반영, 나머지 컬럼엔 미부여(또는 none) 1+.
  - **negative cases 충분 cover** (예외 상황 분기마다 1+):
    - `loading={true}` + rows 가 채워져 있어도 행을 렌더하지 않고 로딩 표시 우선 (loading 우선 정책 고정) 1+.
    - `emptyMessage="아직 평가가 실행되지 않았습니다"` + rows 빈 배열 시 기본 문구 대신 custom 빈 문구가 렌더 1+.
    - rows 빈 배열 + `sortKey` 동시 전달 시에도 데이터 행 없이 빈 상태만 렌더(빈데이터 + 정렬상태 복합) 1+.
    - 빈 문자열 `emptyMessage` 는 기본 문구로 fallback (의미 없는 빈 메시지 방지) 1+.
  - 실행: `pnpm --filter web test` (vitest run) 통과.
- [ ] **테스트 파일명은 `.test.tsx`** — root jest `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. `web/` 아래에 `.spec.ts` 파일 금지. 컴포넌트·테스트 둘 다 `.tsx` 로 둬 `scripts/check-spec-presence.sh` 의 `*.ts` pathspec 밖에 둔다 (web `.ts` spec 정책은 BLOCKED T-0355 책임이므로 본 task 는 `.ts` 신설을 피한다).
- [ ] `pnpm --filter web build` 성공 — type-check(`tsc --noEmit`) + vite build green (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` 그대로 green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0 이어야 함.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령(`pnpm --filter web test` + root `pnpm lint && pnpm build && pnpm test`)을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.

## Out of Scope

- **`.github/workflows/ci.yml` 변경 일절 금지** — web vitest 의 CI 자동 실행 step 추가는 BLOCKED 상태인 T-0355 (`workflow` scope credential 대기) 의 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다 (현 CI 가 무변경으로 green 이어야 함).
- 실제 결과 fetch (`GET /api/*` 등 `/api/*` 소비) · 정렬/필터 실 로직 (실제 배열 정렬·필터링) · 시계열 차트 렌더 · 페이지네이션 · 시계열 변화 시각화 — 후속 slice. 본 task 는 props 로 받은 rows 를 그대로 표시하고 sort 콜백만 호출하는 순수 controlled 컴포넌트만. 정렬 로직은 상위(후속 컨테이너)가 수행한다.
- `App.tsx` 에 테이블 wiring (렌더 트리 삽입) · 결과 데이터 보유 컨테이너 (예: `DashboardPage`) · 로컬 sort state 보유 — 라우팅/데이터 소스가 없는 현 단계에선 make-work. 컴포넌트만 정의하고 export 한다 (T-0361/T-0362 와 동일 정책 — 컴포넌트 정의·export 까지).
- 필터 UI 컴포넌트 (sort key/방향 선택 외 metric/이름/ID별 filter 입력) · Admin 패널 · 로그인 흐름(T-0362 완료) · 평가 진행 중 배너(T-0361 완료) 등 다른 P6 UI bullet — 각 후속 task.
- 새 dependency 추가 (jsdom · @testing-library · 차트 라이브러리 · 라우터 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트(별도 승인). 본 task 는 react/react-dom/vitest 만 사용.
- web vitest **coverage threshold 도입**(`@vitest/coverage-v8` 새 dev dep) — §5 게이트, BLOCKED T-0355 Follow-up.
- 테이블의 정교한 스타일링(CSS) · 접근성 정밀화(caption 연결·키보드 정렬 단축키 등 고급 패턴) — 의미 구조(`<table>`/`<th>`/`<td>` · `aria-sort` · `role="status"` 로딩 표시 · 빈 상태 메시지)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·sort/filter dashboard 채택 근거를 결정 완료, 본 task 는 그 위 presentational 테이블 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

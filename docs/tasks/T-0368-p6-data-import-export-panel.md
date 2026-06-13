---
id: T-0368
title: P6 frontend UI slice 8 — 데이터 import/export 패널 presentational 컴포넌트 (web/src/components/DataImportExportPanel.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet3(Admin 패널 …import/export) 미커버 fragment 분해 — slice 8, import/export 패널 순수 presentational, T-0361~T-0367 file-disjoint·새 dep 0·ci.yml 무관.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/DataImportExportPanel.tsx
  - web/src/components/DataImportExportPanel.test.tsx
---

# T-0368 — P6 frontend UI slice 8: 데이터 import/export 패널 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet3 "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" 의 **"import/export" fragment** 는 아직 컴포넌트로 분해되지 않았다 (인원·그룹·재평가 fragment 는 T-0366 GroupMemberList / T-0367 ReEvaluationTriggerPanel 로 커버됨). 본 task 는 그 import/export 흐름을 표현하는 **데이터 import/export 패널 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361~T-0367) 와 동일하게 props 로만 콜백·진행상태·error 를 받는 순수 controlled component 로 시작하며, 실제 파일 업로드 파싱·export 다운로드 요청·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. backend import/export API 는 후속 배선 대상이므로, 본 task 는 데이터 의존성 0 의 순수 presentational UI slice 다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 로딩 / `role="alert"` 에러 + 콜백 선택적 렌더(`onRemove` 전달 시에만 버튼) + named/default export convention 의 직전 선례. 본 task 의 import/export 버튼·진행상태·에러 분기 구조는 이 패턴을 그대로 차용한다.
- `web/src/components/GroupMemberList.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/DataImportExportPanel.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - props: `{ onExport?: () => void; onImportFile?: (file: File) => void; busy?: boolean; error?: string; message?: string; exportLabel?: string; importLabel?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `busy === true` 면 `role="status"` 영역에 진행 표시 ("처리 중…") 를 렌더하고, import/export 트리거(버튼·파일 입력)는 비활성(`disabled`) 또는 미렌더하여 중복 트리거를 막는다 (busy 우선 정책).
    - `busy` 가 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `busy` 가 아니면 export 버튼을 렌더하고, 클릭 시 `onExport` 가 전달돼 있으면 `onExport()` 를 호출한다. `onExport` 미전달 시에는 버튼을 비활성 또는 미렌더한다.
    - `busy` 가 아니면 import 파일 입력(`<input type="file">`)을 렌더하고, 파일 선택(change) 시 `onImportFile` 이 전달돼 있으면 선택된 첫 File 로 `onImportFile(file)` 을 호출한다. `onImportFile` 미전달 시 파일 입력을 비활성 또는 미렌더한다.
    - `message`(선택)가 truthy 면 (busy/error 가 아닌 정상 상태에서) 안내/성공 문구를 별도 영역(예: `role="status"` 또는 일반 텍스트)에 렌더한다. `message` 미전달이면 해당 영역 미렌더.
    - `exportLabel`/`importLabel` 미전달 시 기본 한국어 라벨(예: "내보내기", "가져오기")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
  - named export(props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만). fetch·라우팅·외부 store·실제 파일 파싱/다운로드 트리거 사용 금지 — 콜백 호출만.
- [ ] `web/src/components/DataImportExportPanel.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (콜백 호출 자체는 jsdom 이벤트가 필요하므로, 콜백 분기는 **렌더 구조** — 버튼/파일입력의 존재·`disabled` 속성 유무·라벨 텍스트 — 로 검증한다. 직전 slice 와 동일하게 정적 markup 단언으로 분기 cover.)
- [ ] **Happy-path test 1+**: 정상 상태(busy/error 없음, `onExport`+`onImportFile` 전달)에서 export 버튼과 import 파일 입력이 활성 상태로 렌더되고 라벨이 표시됨을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: busy 분기(`busy=true` → `role="status"` 진행 표시 렌더 + 트리거 비활성/미렌더), 정상 export 버튼 렌더 분기, 정상 import 파일 입력 렌더 분기, `message` 전달/미전달 분기(안내 문구 렌더 유무) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `busy=true` 가 error·콜백보다 우선 (busy 우선 정책 — 트리거 비활성/미렌더) 1+; `error` 와 정상 props 동시 전달 시 error 우선·트리거 영역 처리 1+; `onExport` 미전달 시 export 버튼 비활성/미렌더 1+; `onImportFile` 미전달 시 파일 입력 비활성/미렌더 1+; `exportLabel`/`importLabel` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(busy/error/export/import/message)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 파일 업로드 파싱(CSV/JSON 등) · export 다운로드 요청(`GET /api/.../export` 등) · backend import/export API 호출 · 진행률 polling · 토스트 배선 — 후속 slice. 본 task 는 props 로 받은 상태를 표시하고 `onExport`/`onImportFile` 콜백만 호출.
- import 결과 미리보기 · 검증 오류 목록 · dry-run 패널 · 파일 형식 선택 드롭다운 — 별도 후속 slice.
- `App.tsx` 에 컴포넌트 wiring · Admin 패널 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0367 과 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 파일 파싱 라이브러리 · 라우터 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0367 과 교집합 0).
- 정교한 스타일링(CSS) — 의미 구조(버튼 · `<input type="file">` · `role="status"` 진행 표시 · `role="alert"` 에러 · 안내 문구)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 import/export 패널 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

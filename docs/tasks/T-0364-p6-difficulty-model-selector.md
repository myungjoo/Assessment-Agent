---
id: T-0364
title: P6 frontend UI slice 4 — 난이도별 LLM 모델 선택 presentational 컴포넌트 (web/src/components/DifficultyModelSelector.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: [T-0353]
touchesFiles:
  - web/src/components/DifficultyModelSelector.tsx
  - web/src/components/DifficultyModelSelector.test.tsx
plannerNote: "P6 R-96 Admin LLM 모델 지정 UI 분해 — 난이도(easy/medium/hard) 슬롯별 provider 선택 controlled select 컴포넌트, 새 dep 0, ci.yml 무관, LoginForm 패턴 차용"
---

# T-0364 — P6 frontend UI slice 4: 난이도별 LLM 모델 선택 presentational 컴포넌트

## Why

Q-0037 사용자 결정 ("P6 frontend 진입") 에 따라 P6 frontend UI 작업을 계속 분해한다. [PLAN.md](../PLAN.md) Phase P4 의 **"Admin 이 LLM 모델 지정 UI (R-96) — backend 완결, UI 는 P6"** 항목과 Phase P6 의 3번째 bullet **"Admin 패널"** 의 첫 building block 으로, **3 난이도 슬롯(easy/medium/hard) 각각에 어떤 등록된 LLM provider 를 쓸지 선택하는 presentational 폼 컴포넌트**를 박제한다 ([requirements.md](../requirements.md) REQ-049/REQ-050 "난이도 슬롯 ↔ provider 매핑", REQ-051 "custom LLM 3 model 슬롯"). backend 는 이미 완결 (`GET /api/llm/providers` T-0140, `GET/PATCH /api/llm/difficulty-mappings[/:difficulty]` T-0139) 이라, 본 task 는 그 위에 올라가는 **데이터 의존성 0 의 순수 presentational UI slice** 다.

본 task 는 직전 slice (T-0363 EvaluationResultTable, T-0362 LoginForm, T-0361 EvaluationGuardBanner) 와 동일하게 **props 로만 데이터·콜백·loading/error 를 받는 controlled component** 로 시작한다. provider 목록·현재 슬롯 매핑·매핑 변경 콜백·loading 플래그를 props 로만 받아 렌더하며, 실제 fetch (`GET /api/llm/providers`)·실제 PATCH 요청·전역 상태·라우팅 배선은 후속 slice 로 분리한다 (아래 Out of Scope). 이렇게 scaffold (T-0353) 외 어떤 task 에도 의존하지 않는 dependency-free 진입을 유지해, fine-grained concurrency (현재 stage 5b) 하에서도 다른 web 파일과 file-disjoint 하게 둔다.

## Required Reading

- `web/src/components/LoginForm.tsx` — 직전 controlled 폼 슬라이스 패턴 (props 인터페이스 + loading/error 분기 + `event.preventDefault()` 폼 제출 + named/default export convention + 한국어 주석). 본 task 의 `<select>` 기반 폼은 이 패턴을 그대로 차용한다.
- `web/src/components/EvaluationResultTable.tsx` — empty/loading 분기 + `role="status"` 로딩 표시 + 빈 상태 메시지 fallback 패턴. 본 task 의 "provider 0개(빈 목록)" 빈 상태 처리 시 참고.
- `web/src/components/LoginForm.test.tsx` 와 `web/src/components/EvaluationResultTable.test.tsx` — vitest 테스트 패턴: `react-dom/server` 의 `renderToStaticMarkup(<...>)` 로 **jsdom 없이** 정적 렌더 문자열만 검증 (dep 표면 최소화 — jsdom·@testing-library 도입은 ADR-0040 §5 게이트라 본 task 금지). 파일명은 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/architecture/api.md` — `## 4. Resource model` 의 `/api/llm` row + UC-05 endpoint 표 (`GET /api/llm/providers` 가 6 필드 `id/provider/endpointUrl/modelId/createdAt/updatedAt` sanitize view 반환, `apiKey` redact; `PATCH /api/llm/difficulty-mappings/:difficulty` 가 슬롯별 `llmProviderConfigId` 재지정). props 데이터 형태를 실 backend 계약과 맞추기 위한 참조 (apiKey 는 props 에 포함하지 않는다).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §5 (dep 게이트: react/react-dom/vitest 만 — 그 외 import 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만 — 그 외 import 금지).

## Acceptance Criteria

- [ ] `web/src/components/DifficultyModelSelector.tsx` 신설 — 3 난이도 슬롯별 provider 선택 폼을 렌더하는 순수 함수형 컴포넌트. 최소 인터페이스 (예시 — 구현이 동등 의미로 조정 가능):
  - provider 옵션 타입: `{ id: string; provider: string; modelId: string }` (apiKey 등 secret 필드는 **포함하지 않는다** — backend sanitize view 와 정합).
  - 난이도 타입: `'easy' | 'medium' | 'hard'` (3 슬롯 고정).
  - props: `{ providers: ProviderOption[]; mapping: Record<'easy' | 'medium' | 'hard', string | null>; onAssign: (difficulty: 'easy' | 'medium' | 'hard', providerId: string) => void; loading?: boolean; error?: string }` (`mapping` 의 값은 현재 슬롯에 할당된 providerId 또는 미할당 `null`).
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 로딩 표시 (예: `role="status"` 영역에 "불러오는 중…") 를 렌더하고 슬롯 폼은 렌더하지 않는다 (loading 우선 정책).
    - `loading` 이 아니고 `providers` 가 빈 배열이면 빈 상태 메시지 (예: "등록된 LLM provider 가 없습니다") 를 렌더하고 슬롯 `<select>` 는 렌더하지 않는다 (선택할 옵션이 없으므로).
    - `loading` 이 아니고 `providers` 가 1개 이상이면 3 난이도 슬롯 각각에 대해 `<label>` + `<select>` 를 렌더한다. 각 `<select>` 의 `<option>` 은 `providers` 목록 + 미할당 placeholder 옵션(예: "선택 안 함")으로 구성하고, `mapping[difficulty]` 가 현재 선택값으로 반영된다 (controlled — `value={mapping[difficulty] ?? ''}`).
    - `<select>` 변경 시 `onAssign(difficulty, selectedProviderId)` 호출 (선택된 option value 가 빈 placeholder 가 아닐 때만 — 또는 정책을 test 로 고정).
    - `error` 가 truthy 면 `role="alert"` 영역에 렌더, 없으면 미렌더.
  - 새 dependency import 금지 (react 만). fetch·라우팅·실 PATCH 요청·외부 store 사용 금지 — 데이터·매핑 상태는 props 로 받는다 (controlled component).
- [ ] R-112 unit tests — `web/src/components/DifficultyModelSelector.test.tsx` (vitest, `renderToStaticMarkup` 사용 — jsdom 불요). 아래 4 종을 **모두** cover:
  - **happy-path 1+**: providers 2~3개 + mapping(슬롯 일부 할당) 전달 시 3 난이도 슬롯의 `<label>`/`<select>` 와 각 provider 의 `modelId`/`provider` 가 `<option>` 으로 렌더되고, `mapping[difficulty]` 에 해당하는 `<option>` 이 selected 로 반영됨을 검증 1+.
  - **error/negative path 1+**: providers 빈 배열 + `loading` 미전달 시 빈 상태 문구가 렌더되고 슬롯 `<select>` 는 렌더되지 않음 1+.
  - **flow / branch** — 아래 분기 각 1+ test:
    - `loading={true}` → 로딩 표시(`role="status"` + "불러오는 중") 렌더, 슬롯/빈상태 문구 미렌더.
    - `loading` 미전달(false) + providers 있음 → 3 슬롯 `<select>` 렌더.
    - providers 빈 배열 + `loading` 미전달 → 빈 상태 문구 렌더, `<select>` 미렌더.
    - `error="저장 실패"` 전달 시 `role="alert"` 영역에 문구 렌더, error 미전달 시 alert 영역 미렌더.
  - **negative cases 충분 cover** (예외 상황 분기마다 1+):
    - `loading={true}` + providers 가 채워져 있어도 슬롯을 렌더하지 않고 로딩 표시 우선 (loading 우선 정책 고정) 1+.
    - `mapping` 의 어떤 슬롯이 `null`(미할당) 일 때 그 `<select>` 가 placeholder("선택 안 함") 를 selected 로 두고 특정 provider 를 selected 로 두지 않음 1+.
    - `mapping` 이 알 수 없는 providerId 를 가리켜도(목록에 없는 id) 렌더가 throw 하지 않고 placeholder fallback 또는 정책대로 동작 1+.
    - providers 빈 배열 + mapping 일부 할당 동시 전달 시에도 빈 상태만 렌더(빈옵션 + 잔존 매핑 복합) 1+.
  - 실행: `pnpm --filter web test` (vitest run) 통과.
- [ ] **테스트 파일명은 `.test.tsx`** — root jest `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. `web/` 아래에 `.spec.ts` 파일 금지. 컴포넌트·테스트 둘 다 `.tsx` 로 둬 `scripts/check-spec-presence.sh` 의 `*.ts` pathspec 밖에 둔다.
- [ ] `pnpm --filter web build` 성공 — type-check(`tsc --noEmit`) + vite build green (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` 그대로 green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0 이어야 함.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령(`pnpm --filter web test` + root `pnpm lint && pnpm build && pnpm test`)을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.

## Out of Scope

- **`.github/workflows/ci.yml` 변경 일절 금지** — web vitest 의 CI 자동 실행 step 추가는 BLOCKED 상태인 T-0355 (`workflow` scope credential 대기) 의 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다 (현 CI 가 무변경으로 green 이어야 함).
- 실제 provider 목록 fetch (`GET /api/llm/providers`) · 실제 매핑 저장 (`PATCH /api/llm/difficulty-mappings/:difficulty`) · 낙관적 업데이트 · 에러 토스트 배선 — 후속 slice. 본 task 는 props 로 받은 providers/mapping 을 표시하고 변경 콜백만 호출하는 순수 controlled 컴포넌트만.
- provider **등록/수정/삭제 폼** (`POST/PATCH/DELETE /api/llm/providers` — endpointUrl/apiKey 입력 등) — 별도 후속 slice. 본 task 는 난이도 슬롯 ↔ 기존 provider 매핑 선택 UI 만.
- `apiKey` 등 secret 입력/표시 — backend sanitize view 가 redact 하므로 본 컴포넌트 props 에도 secret 을 두지 않는다. secret 입력 폼은 별도 보안 검토 동반 slice (BLOCKED 가능).
- `App.tsx` 에 컴포넌트 wiring · Admin 패널 컨테이너(데이터 보유·로컬 상태) · 라우팅 — 라우팅/데이터 소스가 없는 현 단계에선 make-work. 컴포넌트만 정의·export 한다 (T-0361/T-0362/T-0363 와 동일 정책).
- 새 dependency 추가 (jsdom · @testing-library · 라우터 · 상태관리 · CSS 프레임워크 · form 라이브러리 등) — 전부 ADR-0040 §5 new-dep 게이트(별도 승인). 본 task 는 react/react-dom/vitest 만 사용.
- web vitest **coverage threshold 도입**(`@vitest/coverage-v8` 새 dev dep) — §5 게이트, BLOCKED T-0355 Follow-up.
- 정교한 스타일링(CSS) · 접근성 정밀화(키보드 단축키 등 고급 패턴) — 의미 구조(`<label>`/`<select>`/`<option>` · `role="status"` 로딩 · `role="alert"` 에러 · 빈 상태 메시지)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조를, backend 가 LLM 모델 지정 API 계약을 이미 결정 완료. 본 task 는 그 위 presentational select 폼 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

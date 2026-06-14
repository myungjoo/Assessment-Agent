---
id: T-0375
title: P6 frontend UI slice 15 — 단일 평가 결과 상세 패널 presentational 컴포넌트 (web/src/components/EvaluationDetailPanel.tsx)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-036, REQ-038]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2/REQ-036(정성+Metric 수치) 잔여 fragment — 단일 평가 항목별 metric 점수+정성 근거 상세 패널 props 기반 presentational, T-0361~T-0374 file-disjoint·새 dep 0·ci.yml 무관·dependsOn 빈배열 병렬 claimable.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/EvaluationDetailPanel.tsx
  - web/src/components/EvaluationDetailPanel.test.tsx
---

# T-0375 — P6 frontend UI slice 15: 단일 평가 결과 상세 패널 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 표시 표면 중, 지금까지의 컴포넌트는 **목록/집계 지향**(`EvaluationResultTable` T-0363 의 행 목록, `MetricSummaryCards` T-0373 의 상단 요약, `ScoreDistributionChart` T-0374 의 분포)이었다. 그러나 [REQ-036](../requirements.md) ("상대 비교 가능 + **LLM 정성 + Metric 수치**") 가 요구하는 **단일 평가 결과의 항목별(metric별) 수치 점수 + 정성 평가 근거(rationale/evidence) 상세 뷰**는 아직 컴포넌트가 없다. 사용자가 표에서 한 평가 행을 선택했을 때 펼쳐 볼 "이 평가의 metric 별 점수가 얼마이고, LLM 이 그렇게 평가한 정성 근거가 무엇인가"를 보여주는 **상세 패널**이 그것이다. 본 task 는 그 **단일 평가 결과 상세 패널 presentational 컴포넌트**를 박제한다.

직전 P6 slice 와 동일하게 props 로만 평가 metadata·metric 항목 배열·loading/error 를 받는 순수 controlled component 로 시작하며, **내부 상태/데이터 fetch/집계 없이** 받은 항목을 표시만 한다. metric 점수의 막대/배지·근거 텍스트 표시는 props 값의 순수 표시 파생(예: 점수 → 0~max 대비 percent, 빈 근거 → fallback 문구)만 수행하며, 차트 라이브러리/마크다운 렌더러는 도입하지 않는다 (div + 텍스트 + role 접근성). 실제 평가 상세 fetch(GET /api/*)·서버 조회·전역 상태·라우팅·표 행 선택 연동·App.tsx 배선은 후속 slice 책임이다. (REQ-036 의 "정성 + Metric 수치" 동시 표시 표면을 props 기반으로 미리 박제하고, REQ-038 의 UI 조회 표면 중 단일 평가 상세 조회만 확보한다. 실 데이터 배선·정성 텍스트 서식·성능 검증은 후속.)

## Required Reading

- `web/src/components/EvaluationResultTable.tsx` — 평가 결과 행 배열을 props 로 받아 표시하는 직전 선례(T-0363). 본 상세 패널의 metric 항목 배열 props 모양·loading/error/빈 상태 분기를 이와 정합시킨다 (목록 vs 단일 상세의 역할 분리). 직접 import 하지 않고(file-disjoint 유지) 모양만 정합.
- `web/src/components/MetricSummaryCards.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 빈/미전달 fallback 분기 + 라벨 fallback + 비정상 number(NaN/Infinity) 안전 표식 치환 + named(`export interface`)/default export convention 의 직전 선례(T-0373). 본 task 의 loading/error 분기·빈 항목 fallback·라벨 fallback·비정상 점수 안전 표식 구조는 이 패턴을 그대로 차용한다. 직접 import 하지 않고 모양만 정합.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지, **차트·시각화·상태관리·라우터·마크다운 라이브러리 포함 금지** — 점수 막대는 div + inline style 로만, 근거는 plain text 로만).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/EvaluationDetailPanel.tsx` 신설. props 만 받는 순수 presentational 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - metric 항목 타입(named export): `interface EvaluationMetricItem { id: string; label: string; score: number; maxScore?: number; rationale?: string }` (예: label="코드 품질", score=8, maxScore=10, rationale="최근 7일 커밋의 테스트 커버리지가 향상됨").
  - props 타입(named export): `interface EvaluationDetailPanelProps { subjectName?: string; periodLabel?: string; metrics: EvaluationMetricItem[]; loading?: boolean; error?: string; emptyLabel?: string; titlePrefix?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, metric 항목 목록은 미렌더한다 (loading 우선 정책 — error 보다 우선).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더하고 metric 항목 목록은 미렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading`·`error` 가 아니고 `metrics` 가 빈 배열(또는 미전달/undefined)이면 `emptyLabel`(미전달 시 기본 한국어 라벨, 예: "표시할 평가 항목이 없습니다")로 빈 상태를 렌더한다.
    - `loading`·`error` 가 아니고 `metrics` 가 1개 이상이면 각 metric 을 항목으로 렌더한다: `label`·`score`(maxScore 있으면 "score/maxScore" 형태)·`rationale` 정성 근거 텍스트를 표시한다. 점수 막대를 **`maxScore` 대비 비율(percent)** 로 inline style(`width: NN%`) div 막대로 표현한다 (maxScore 미전달/0 이면 막대 0% 또는 막대 생략 — 0 나눗셈 방지). `rationale` 미전달/빈 문자열이면 정성 근거 fallback 문구(예: "정성 근거 없음")로 표시한다. 접근성을 위해 각 점수 막대에 `aria-label`(예: "코드 품질: 8/10") 부여.
    - `subjectName`/`periodLabel` 미전달 시 각각 기본 한국어 라벨(예: "대상 미지정"/"기간 미지정")로 fallback 한다. 빈 문자열도 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
    - `titlePrefix` 미전달 시 기본 한국어 라벨(예: "평가 상세")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback.
  - **안전 렌더 / 비율 계산**: `score` 가 음수·`NaN`·`Infinity` 등 비정상 값이면 안전하게 0 으로 clamp 해 raw NaN/Infinity 비율/텍스트를 렌더하지 않는다. `maxScore` 가 0/음수/미전달이면 0 나눗셈을 피하고 막대를 0% (또는 막대 생략)로 렌더한다. `score > maxScore` 이면 비율을 100% 상한으로 clamp 한다 (막대 overflow 방지). `label`/`rationale` 빈 문자열 등 비정상 항목도 throw 없이 안전 표시.
  - 내부 상태(`useState`)·데이터 fetch·집계 계산·라우팅·외부 store 사용 금지 — props 표시·비율 파생만(props 로 받은 `score`/`maxScore` 의 비율 같은 순수 표시 파생은 허용).
  - named export(metric 타입·props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만).
- [ ] `web/src/components/EvaluationDetailPanel.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (분기는 **렌더 구조** — metric 항목 개수·`label`/`score`/`rationale` 텍스트·점수 막대 width percent·`role="status"`/`role="alert"`/빈 상태 라벨/title·subject·period fallback — 로 검증한다.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, 2개 이상 `metrics` 전달, maxScore 있음)에서 각 metric 의 `label`·`score`/`maxScore`·`rationale` 텍스트와 subject/period/title prefix 가 렌더되고 항목 개수가 입력 metric 수와 일치하며, `score===maxScore` metric 의 막대가 100% 로 렌더됨을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 metric 항목 목록이 미렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 + 항목 미렌더), 빈 상태 분기(`metrics=[]` → `emptyLabel` 렌더), 정상 항목 렌더 분기, 비율 계산 분기(maxScore 대비 작은 score 가 < 100% width), rationale fallback 분기(rationale 미전달 → fallback 문구) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error 보다 우선 1+; `error` 와 정상 `metrics` 동시 전달 시 error 우선(항목 미렌더) 1+; `metrics=[]` 빈 배열(빈 상태 라벨) 1+; `metrics` 미전달(undefined → 빈 상태) 1+; `emptyLabel` 미전달 시 기본 라벨 fallback 1+; `titlePrefix`/`subjectName`/`periodLabel` 미전달 시 기본 라벨 fallback 각 1+; 빈 문자열 `titlePrefix`/`subjectName`/`periodLabel`(falsy → 기본 라벨 fallback 경계값) 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; `rationale` 미전달/빈 문자열(정성 근거 fallback) 1+; `maxScore` 미전달/0(막대 0% 또는 생략, 0 나눗셈 방지) 1+; `score` 가 음수/`NaN`/`Infinity` 등 비정상일 때 0 clamp(raw NaN/Infinity 미렌더) 1+; `score > maxScore`(100% 상한 clamp) 1+; 단일 metric(`metrics` 길이 1) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/빈 항목/비율 계산/0 나눗셈 방지/score clamp/rationale fallback)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 평가 상세 fetch(GET /api/*) · 서버 조회 · metric 항목 산정/집계 로직 — 후속 slice 책임. 본 task 는 props 로 받은 metric 배열을 표시만 하고 maxScore 대비 비율 같은 순수 표시 파생만 수행.
- 내부 상태(`useState`)로 항목 보유 · 데이터 로딩 로직 — 본 task 는 controlled(부모가 데이터 소유). 컨테이너 변형은 후속 wiring slice 책임.
- 표(`EvaluationResultTable`) 행 선택 → 상세 패널 펼침 연동 · 상태 lift-up · 모달/드로어 컨테이너 — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- 차트 라이브러리(recharts · chart.js · d3 등) · SVG path · canvas 렌더 · 마크다운 렌더러(react-markdown 등) 도입 — ADR-0040 §5 new-dep 게이트. 본 task 는 div + inline style percent 막대 + plain text 근거만.
- 정성 근거(rationale)의 마크다운/리치 텍스트 서식 · 펼침/접힘 토글 · 인터랙티브 툴팁 · 애니메이션 — 후속 slice 후보. 본 task 는 plain text 표시만.
- REQ-048/REQ-092 "조회·시각화 3초 이내" 의 실제 성능 검증 · 데이터 로딩 최적화 — 후속 데이터 배선·성능 task 책임. 본 task 는 표시 표면만.
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0374 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 차트 lib · 마크다운 · 상태관리 · 라우터 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0374 와 교집합 0).
- 정교한 스타일링(CSS) · 반응형 레이아웃 세부 — 의미 구조(metric 항목 목록 · label/score/rationale · maxScore 대비 비율 width · 빈 상태 · `role="status"`/`role="alert"`)만. 정교한 레이아웃은 후속 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 단일 평가 결과 상세 패널 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---

## 완료 기록

- **Status: DONE** (2026-06-13T12:55Z, cron@cloud-aa-local-sched)
- PR [#307](https://github.com/myungjoo/Assessment-Agent/pull/307) → squash merge `d24c54c` (`--delete-branch`).
- reviewer APPROVE round 1/7 (MINOR×1 비차단: scoreText 주석 표현 — 동작 정확, follow-up 불요), integrator 4-게이트 PASS, CI first-pass green.
- EvaluationDetailPanel presentational 컴포넌트 + spec(web vitest 27 신규/260 전체) — 새 dep 0, backend 불변.
- frontmatter status 가 머지 시 closeout 에서 PENDING 으로 잔류 → 본 doc-sync 로 DONE 정정 (T-0402).

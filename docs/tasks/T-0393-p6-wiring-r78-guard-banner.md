---
id: T-0393
title: P6 wiring⑤ DashboardView 에 EvaluationGuardBanner(R-78) 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [R-78]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0384]
touchesFiles: [web/src/views/DashboardView.tsx, web/src/views/DashboardView.test.tsx]
plannerNote: "P6 ⑤ R-78 — presentational EvaluationGuardBanner 를 DashboardView 상단에 prop 주입(evaluationActive)으로 배선; 상태 polling 은 backend status 계약 미shipped 라 Follow-up defer"
sizeExempt: false
---

# T-0393 — P6 wiring⑤ DashboardView 에 EvaluationGuardBanner(R-78) 배선

## Why

PLAN.md P6 항목 "평가 진행 중 시각화 보호 (R-78) — 평가 자료 수집/평가 중에는 기존 자료만 표시 + 상단 경고 배너" 의 조립 slice 다. presentational `EvaluationGuardBanner`(active: boolean + message?) 는 P6 presentational phase 에서 이미 신설됐으나(ADR-0040 §6) 아직 어떤 view 에도 배선되지 않았다. 본 task 는 이 배너를 `DashboardView` **상단**(자료 영역 위)에 배선해 "기존 자료를 가리지 않고 상단에 경고를 띄운다"는 R-78 표면을 완성한다. 배너의 active 신호는 controlled lift-up 으로 컨테이너 props(`evaluationActive`)에서 받는다 — backend 의 실행-상태(in-progress/status) 계약이 api.md 에 아직 shipped 되지 않았으므로(`/api/assessments` row 에 status 필드 없음, batch/run 은 P5 미구현 deferred) 자동 polling 파생은 본 slice 범위 밖이며 Follow-up 으로 defer 한다.

## Required Reading

- `docs/tasks/T-0393-p6-wiring-r78-guard-banner.md` (본 파일)
- `web/src/views/DashboardView.tsx` — 배선 대상 컨테이너(controlled lift-up 패턴·initial* prop 주입·presentational 합성 경계 확인)
- `web/src/views/DashboardView.test.tsx` — colocated spec(추가 위치, renderToStaticMarkup 정적 렌더 패턴 정합)
- `web/src/components/EvaluationGuardBanner.tsx` — 배선할 presentational(props: `active: boolean`, `message?: string`; active=false 면 null 반환)
- `web/src/components/EvaluationGuardBanner.test.tsx` — 배너 단독 검증 패턴 참고(중복 검증 금지 — 컨테이너 배선만 검증)
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` (Decision 1 controlled lift-up·presentational 수정 0 경계만 — 전문 재독 불요)

## Acceptance Criteria

- [ ] `DashboardView.tsx` 가 `EvaluationGuardBanner` 를 import 하고, `section[aria-label="대시보드"]` **최상단**(MetricSummaryCards 보다 앞, 즉 자료 영역 위)에 렌더한다. personId 미선택 분기(조회 미수행 안내)에서도 배너가 상단에 노출되도록 배선한다(평가 진행 중이면 대상 미선택이어도 경고가 보여야 함).
- [ ] `DashboardViewProps` 에 `evaluationActive?: boolean`(기본 `false`) 와 `evaluationMessage?: string` 을 추가하고, 그 값을 `EvaluationGuardBanner` 의 `active`/`message` 로 그대로 내려보낸다(controlled lift-up — 컨테이너는 active 를 직접 파생하지 않고 주입받는다). `EvaluationGuardBanner` 외 다른 presentational/`apiClient`/`useApiResource` 수정 0.
- [ ] 새 dependency 0 (ADR-0040 §5 게이트) — react hooks + 기존 import 만 사용. `package.json`/lockfile 미변경.
- [ ] happy-path test 1+: `evaluationActive={true}` 로 `DashboardView` 를 `renderToStaticMarkup` 정적 렌더 시 경고 배너 문구(`role="alert"` 또는 기본 문구 토큰)가 출력에 포함됨을 검증(personId 주입 케이스).
- [ ] error/negative path test 1+: `evaluationActive` 미주입(기본 false) 또는 `false` 일 때 배너 미노출(`role="alert"` 부재)을 검증 — 자료 화면을 가리지 않음.
- [ ] branch test: (1) personId 선택 + active=true, (2) personId 미선택 + active=true 두 분기 각각에서 배너가 상단에 노출됨을 검증(personId 분기 양쪽에서 배너 일관 노출). 분기별 1+ test.
- [ ] negative cases 충분 cover: `evaluationActive={false}` + `evaluationMessage` 동시 주입 시에도 배너 미노출(active 우선) / `evaluationActive={true}` + 빈 `evaluationMessage` 시 기본 문구 fallback / personId 미선택 + active=false 시 안내 문구만(배너 부재) — 각 1+ test.
- [ ] `pnpm --dir web test`(vitest) 로 신규 test 포함 전체 green 로컬 검증. root `pnpm lint && pnpm build` green. (web vitest 의 ci.yml 배선은 T-0355 Follow-up 으로 별도 tracked — 본 PR 은 로컬 검증 + reviewer NOTE 명시. `@vitest/coverage-v8` 미설치라 coverage threshold 는 구성적 cover; line/function ≥ 80% 의도는 신규 분기 전수 test 로 충족.)

## Out of Scope

- backend 실행-상태(in-progress/status) 계약 소비 / polling / 자동 `active` 파생 — api.md 에 status 필드/배치 진행 endpoint 가 shipped 되지 않음(`/api/assessments` row status 부재, `/run`·`/reeval`·`/reset` 은 P5 미구현 deferred). 계약 확정 후 Follow-up.
- `AdminView` 등 다른 view 에 배너 배선 — 본 slice 는 DashboardView 한정.
- `EvaluationGuardBanner.tsx` 컴포넌트 자체 수정(props 추가·문구 변경 등) — 배선만.
- `AppShell`/`apiClient`/`useApiResource`/다른 presentational 수정.
- 서버 polling 간격·refetch·실시간 갱신 로직.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (defer until backend contract) 평가 실행-상태 polling: backend 가 assessment in-progress/status 신호(예: `/api/assessments` row 의 status 필드 또는 진행-상황 endpoint)를 shipped 하면 `evaluationActive` 를 그 신호에서 파생(useApiResource polling)하도록 배선. 계약은 P5/P7 batch pipeline 의존.
- (tracked) web vitest 를 `.github/workflows/ci.yml` 에 배선(T-0355) — 현재 web test 는 로컬 tester 실행으로만 검증.

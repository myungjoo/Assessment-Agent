---
id: T-0376
title: P6 frontend composition-wiring 전환 ADR — App.tsx 조립·라우팅·data-fetch 경계·non-parallel claim shape 박제 (ADR-0041)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-042, REQ-048]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-13
plannerNote: presentational 분해 소진 — 15 컴포넌트(T-0361~T-0375) 박제 완료. 다음 단계 App.tsx composition wiring 은 shared-file·non-parallel stream(claim shape 변경) → deliberate 계획 필요해 ADR-0041(pr)로 전환 scope 박제.
independentStream: p6-frontend-composition
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0041-frontend-composition-wiring.md
  - docs/PLAN.md
---

# T-0376 — P6 frontend composition-wiring 전환 ADR (ADR-0041)

## Why

PLAN [Phase P6](../PLAN.md) 의 네 bullet(로그인/SuperAdmin 셋업 · 시각화 대시보드 · Admin 패널 · R-78 평가 진행 중 보호)을 cover 하는 **순수 presentational 표면**은 T-0361~T-0375 로 15개 컴포넌트가 박제되며 **사실상 소진**됐다 (`web/src/components/` 의 EvaluationGuardBanner / LoginForm / EvaluationResultTable / DifficultyModelSelector / SuperAdminSetupForm / GroupMemberList / ReEvaluationTriggerPanel / DataImportExportPanel / SchedulePanel / DashboardFilterBar / TrendTimeSeriesPanel / DashboardPaginationControl / MetricSummaryCards / ScoreDistributionChart / EvaluationDetailPanel). 남은 standalone presentational 후보(평가-run progress stepper · 파괴적 액션 confirmation-dialog shell · toast 배너)는 **genuine requirement backing 이 없다** — R-78/REQ-042 의 "평가 진행 중 보호"는 이미 EvaluationGuardBanner 가 cover 하고(README 의 R-78 은 "기존 자료만 표시 + 상단 경고 배너"이지 진행 단계 stepper 가 아님), confirmation-dialog/toast 는 특정 REQ 가 아니라 **composition 단계에서 결정될 interaction 관심사**다. 따라서 contrived component 를 강행하지 않는다(planner 룰: weak fragment 강행 금지).

다음으로 genuine value 가 있는 단계는 **15개 presentational 컴포넌트를 실제 화면으로 조립하는 App.tsx composition-wiring 전환**이다. 이는 지금까지의 file-disjoint 병렬 패턴(T-0361~T-0375 가 각자 2개 신규 파일만 만져 동시 claim 가능)과 **근본적으로 다르다** — `web/src/App.tsx`(현재 정적 placeholder, T-0353)와 layout/routing/data-fetch 경계 파일을 **여러 task 가 공유 수정**하므로 **shared-file·non-parallel stream**이 되어 [ADR-0036](../decisions/ADR-0036-fine-grained-concurrency.md) §Decision 0 의 동시 claim 조건(파일-disjoint)을 깨고 **concurrency claim shape 를 바꾼다**. 그래서 무계획 wiring task 양산 대신, 전환 전략을 **ADR-0041 로 먼저 박제**한다 ("코드보다 ADR이 먼저다" — CLAUDE.md §1, [ADR-0040](../decisions/ADR-0040-frontend-stack.md) §1 이 상태관리/라우터를 "도입 시점 별도 ADR" 로 위임한 그 위임의 수령). 본 task 는 ADR-0041(결정 전용, 코드 0 LOC) 신설 + PLAN P6 bullet 에 전환 진입점 한 줄 박제까지만 책임진다 — 실제 App.tsx 조립 코드는 ADR-0041 이 박제한 시퀀스에 따른 **후속 wiring task chain** 의 책임이다.

## Required Reading

- `web/src/App.tsx` — 현재 정적 placeholder(T-0353, 분기·로직 0). composition 전환이 교체할 대상. ADR-0041 은 이것이 어떤 레이아웃/라우팅/데이터-fetch 컨테이너로 진화하는지의 시퀀스를 박제한다.
- `web/src/main.tsx` — Vite 진입(`createRoot`). 라우터 provider 도입 시 wrapping 지점 후보. ADR-0041 이 라우팅 도입 위치를 결정할 때 참조.
- `docs/decisions/ADR-0040-frontend-stack.md` — §1(React+Vite+TS, 상태관리/라우터/차트는 "도입 시점 별도 ADR + §5 new-dep 게이트" 로 위임) · §2(SPA 는 기존 `/api/*` REST contract 의 순수 소비자, frontend 가 `src/` 미수정 경계 불변) · §5(dep 게이트 — react/react-dom/vitest 만, 그 외 import 는 ADR 동반). ADR-0041 은 본 ADR 의 미결 위임(라우터·data-fetch·상태)을 수령해 결정한다.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` — §Decision 0(동시 claim 조건 = 파일-disjoint·의존성 없음·같은 commitMode). composition-wiring 이 왜 이 조건을 깨는지(App.tsx 공유 수정 → file-disjoint 불성립 → non-parallel)와, 그래서 본 stream 이 단일-claim 순차 진행임을 ADR-0041 이 명시한다.
- `web/src/components/EvaluationGuardBanner.tsx` — R-78/REQ-042 의 상단 경고 배너 surface(T-0361). composition 단계에서 이 배너가 "평가 진행 중" 전역 상태에 어떻게 연결되는지가 data-fetch 경계 결정의 한 입력 — ADR-0041 §(R-78 보호 배선)에서 참조.
- `web/src/components/LoginForm.tsx` 또는 `web/src/components/EvaluationResultTable.tsx` — props-only controlled 컴포넌트의 대표 모양 1개. ADR-0041 이 "컨테이너가 데이터를 소유하고 presentational 에 props 주입" 패턴(controlled lift-up)을 박제할 때 정합 참조(전부 다 읽지 말 것 — 1개로 충분, context 보호).
- `docs/architecture/api.md` — frontend 가 소비할 `/api/*` REST contract 목록(인증·평가 조회·Admin·스케줄). ADR-0041 의 data-fetch 경계(어느 화면이 어느 endpoint 를 호출하는지의 매핑 개요)에서 참조하되 endpoint 전수 나열은 금지(개요만 — 세부 fetch 배선은 후속 task).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0041-frontend-composition-wiring.md` 신설 — ADR 표준 frontmatter(`id: ADR-0041`, `title`, `status: PROPOSED`, `date`, `relatedTask: T-0376`, `supersedes: null`) + 본문(Context / Decision / Consequences / Alternatives). status 는 **PROPOSED** 로 생성(ACCEPTED flip 은 reviewer 검토 후 별도 direct 한 줄 수정 — CLAUDE.md §3.1 규칙4).
- [ ] **Context 절**: presentational 분해 소진 사실(15 컴포넌트, T-0361~T-0375) + 전환 필요성 + ADR-0040 의 라우터/data-fetch/상태 위임 수령 + ADR-0036 §Decision 0 claim-shape 변경(file-disjoint → shared-file non-parallel) 을 박제한다.
- [ ] **Decision 절 — 다음 5개 결정을 명시한다** (각 1+ 단락, 결정 + 사유):
  1. **컴포지션 구조**: 15개 presentational 컴포넌트가 어떤 컨테이너/레이아웃 위계로 조립되는지(예: AppShell → 인증 게이트 → 라우트별 화면 컨테이너 → presentational). controlled lift-up 패턴(컨테이너가 데이터 소유, presentational 은 props 소비 — ADR-0040 §2 정합) 채택을 명시.
  2. **라우팅 접근**: 라우터 라이브러리 도입 여부(react-router 도입 시 ADR-0040 §5 new-dep 게이트 충족 명시 + BLOCKED §5 new-dep 경로 따름) vs 무라우터 조건부 렌더(상태 기반 화면 전환)의 trade-off 와 선택. **새 dependency 도입을 결정하면 본 ADR 은 그 도입을 제안만 하고 실 `pnpm add` 는 별도 task + 사용자 승인 게이트**(CLAUDE.md §5 new-dep BLOCKED)임을 명시.
  3. **data-fetch 경계**: 어디서 `/api/*` 를 호출하는가(컨테이너 레벨 fetch vs 전용 fetch 레이어/hook) + 인증(JWT HttpOnly cookie, ADR-0008) credential 흐름 개요 + loading/error 상태를 presentational props 로 내려보내는 경계. fetch 라이브러리 도입 여부도 §5 게이트 대상으로 명시.
  4. **R-78/REQ-042 보호 배선**: "평가 진행 중" 전역 상태가 어떻게 감지되어 EvaluationGuardBanner 노출 + 기존 자료만 표시로 이어지는지의 배선 개요.
  5. **concurrency claim shape 전환**: 본 composition stream 이 `web/src/App.tsx`(+레이아웃/라우팅/fetch 파일)를 공유 수정하므로 **file-disjoint 불성립 → 단일-claim 순차(non-parallel) stream** 임을 ADR-0036 §Decision 0 근거로 명시. 후속 wiring task 는 `independentStream: p6-frontend-composition` + 직렬 `dependsOn` chain 으로 큐잉되어야 함을 박제(병렬 claim 후보에서 제외). 기존 p6-frontend-ui presentational stream 과의 관계(presentational 은 동결/완료, 신규 컴포넌트는 composition 필요 시에만)도 한 줄.
- [ ] **Consequences 절**: 본 전환의 결과(병렬 throughput 감소 — 단일 claim 순차 / App.tsx 충돌 표면 증가 → rebase 빈도 / data-fetch 도입 시 new-dep 게이트 발생 가능) + 후속 wiring task chain 의 대략 분할(예: ① AppShell+레이아웃 골격 → ② 인증 게이트+라우팅 → ③ 대시보드 화면 조립 → ④ Admin 화면 조립 → ⑤ R-78 보호 배선; 각 ~≤300 LOC/5파일 cap 준수, 직렬 dependsOn)을 개요로 박제. **이 분할은 개요일 뿐 — 실 task 생성은 ADR ACCEPTED 후 planner 의 후속 호출 책임**임을 명시.
- [ ] **Alternatives 절**: 최소 2개 기각 대안(예: ① presentational 분해를 contrived 컴포넌트로 더 끌고 가기 → genuine REQ backing 없어 기각 / ② ADR 없이 App.tsx 를 단일 거대 task 로 한번에 조립 → cap 초과 + non-parallel claim shape 미박제로 race/충돌 위험 → 기각).
- [ ] `docs/PLAN.md` Phase P6 에 composition-wiring 전환 진입점 한 줄 박제 — presentational 분해 완료(15 컴포넌트) + ADR-0041 이 조립/라우팅/data-fetch/non-parallel claim shape 박제 + 후속 wiring chain 이 단일-claim 순차로 진행됨을 참조하는 한 줄 추가(기존 4 bullet 은 보존, 전환 메모만 추가).
- [ ] 본 task 는 **문서(ADR + PLAN)만** 변경 — `web/` · `src/` · `.github/` · `package.json` 일절 미수정(코드 0 LOC, dependency 0). production code 변경 0 이므로 R-112 unit test 신규 작성은 비대상(아래 분기 없음 메모 참조).
- [ ] **분기 없음 — R-112 unit test 항목 생략**: 본 task 는 doc-only(ADR + PLAN.md) 변경이라 추가/수정된 public symbol(함수/클래스/엔드포인트)이 0 이다. happy-path/error-path/branch/negative unit test 의무는 production code 가 없으므로 적용 대상이 아니다. 단 commitMode 가 `pr`(새 ADR 추가 — CLAUDE.md §3.1 규칙4)이므로 R-110 에 따라 tester 가 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`(backend jest, line ≥ 80% / function ≥ 80%) 를 실행해 **기존 backend 불변(회귀 0)** 을 green 확인한다 — 본 task 가 코드를 안 만져도 doc 변경 PR 의 CI 전 step green 을 검증.
- [ ] `cd web && pnpm test`(web vitest) 와 root `pnpm test:cov`(backend) 모두 그대로 green — 본 task 는 어떤 코드도 안 만지므로 둘 다 영향 0(회귀 0 확인용).
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.

## Out of Scope

- 실제 `web/src/App.tsx` 조립 코드 · AppShell/레이아웃/라우팅/컨테이너 컴포넌트 신설 · data-fetch hook/레이어 구현 — **전부 ADR-0041 ACCEPTED 후 후속 wiring task chain 책임**. 본 task 는 ADR(전략 결정) + PLAN 한 줄만.
- 새 dependency(react-router · @tanstack/react-query · axios · zustand · CSS 프레임워크 등) 실 `pnpm add` — ADR-0041 이 도입을 **제안**할 수는 있으나 실 추가는 CLAUDE.md §5 new-dep BLOCKED → 사용자 승인 → 별도 task. 본 task 는 dependency 0.
- 기존 15개 presentational 컴포넌트 수정 · 신규 presentational 컴포넌트 신설 — presentational 분해는 소진/동결. 본 task 는 그 위 composition 전략만 박제(컴포넌트 파일 미수정 — file-disjoint).
- ADR status 를 ACCEPTED 로 flip — 본 task 는 PROPOSED 로 생성. ACCEPTED flip 은 reviewer 검토 통과 후 별도 direct 한 줄 수정(CLAUDE.md §3.1 규칙4).
- `.github/workflows/ci.yml` 변경(web vitest CI 배선 포함) — BLOCKED 상태 T-0355(workflow-scope credential 대기) 책임. 본 task 무관.
- backend `src/` · `/api/*` endpoint 신설/변경 — ADR-0040 §2 경계 불변(frontend 는 기존 contract 소비자). 본 task 는 backend 미수정.
- STATE.json 수정 — driver 가 nextTask·backlogNote 를 설정한다(planner 는 STATE 미수정 — 본 호출 지시).

## Suggested Sub-agents

`architect → tester` — architect 가 ADR-0041(composition/routing/data-fetch/claim-shape 결정) 작성 + PLAN.md 한 줄 박제, tester 가 R-110 회귀 0 검증(`pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` backend green + `cd web && pnpm test` green). implementer 불요 — 코드 변경 0(doc-only).

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 예상 후속: ADR-0041 ACCEPTED flip 별도 direct task → composition wiring task chain ①~⑤ 가 planner 후속 호출로 큐잉, 전부 `independentStream: p6-frontend-composition` 단일-claim 순차.)

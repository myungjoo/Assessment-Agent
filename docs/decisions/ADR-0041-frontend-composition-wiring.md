---
id: ADR-0041
title: Frontend composition-wiring 전환 (App.tsx 조립 구조·무라우터 view 전환·fetch hook 경계·R-78 보호 배선·non-parallel single-claim stream)
status: ACCEPTED
date: 2026-06-13
relatedTask: T-0376
supersedes: null
---

# ADR-0041 — Frontend composition-wiring 전환 (App.tsx 조립 구조·무라우터 view 전환·fetch hook 경계·R-78 보호 배선·non-parallel single-claim stream)

## Context

PLAN [Phase P6](../PLAN.md) 의 네 bullet (로그인/SuperAdmin 셋업 · 시각화 대시보드 · Admin 패널 · R-78 평가 진행 중 보호) 을 cover 하는 **순수 presentational 표면은 T-0361~T-0375 로 15 개 컴포넌트가 박제되며 사실상 소진**됐다 (`web/src/components/` 의 EvaluationGuardBanner · LoginForm · EvaluationResultTable · DifficultyModelSelector · SuperAdminSetupForm · GroupMemberList · ReEvaluationTriggerPanel · DataImportExportPanel · SchedulePanel · DashboardFilterBar · TrendTimeSeriesPanel · DashboardPaginationControl · MetricSummaryCards · ScoreDistributionChart · EvaluationDetailPanel). 이 컴포넌트들은 전부 props-only controlled component 다 — 입력값·콜백·loading/error 플래그를 props 로만 받고 데이터를 소유하지 않는다 (대표 모양: [`LoginForm.tsx`](../../web/src/components/LoginForm.tsx), [`EvaluationGuardBanner.tsx`](../../web/src/components/EvaluationGuardBanner.tsx)). 남은 standalone presentational 후보 (평가-run progress stepper · confirmation-dialog shell · toast 배너) 는 genuine REQ backing 이 없어 강행하지 않는다 (planner weak-fragment 강행 금지).

다음으로 genuine value 가 있는 단계는 **15 개 presentational 컴포넌트를 실제 화면으로 조립하는 App.tsx composition-wiring 전환**이다. 현재 [`web/src/App.tsx`](../../web/src/App.tsx) 는 정적 placeholder (T-0353, 분기·로직 0) 이고 [`web/src/main.tsx`](../../web/src/main.tsx) 는 `createRoot` 진입뿐이다. 이 전환은 다음 위임과 제약을 동시에 수령한다:

- **[ADR-0040](ADR-0040-frontend-stack.md) 의 미결 위임 수령**: ADR-0040 §1 은 "상태관리/라우터/차트 라이브러리는 본 ADR 이 결정하지 않는다 — 각 도입 시점에 §5 new-dep 게이트 + 필요 시 별도 ADR" 로 위임했고, §2 는 SPA 가 기존 `/api/*` REST contract + JWT HttpOnly cookie ([ADR-0008](ADR-0008-auth-credential-type.md)) 의 순수 소비자임을, §6 은 R-78 보호의 frontend 측 책임 (실행 상태 조회 → 배너 토글 + 영속 데이터만 fetch) 을 박제했다. 본 ADR 은 그 위임 (라우터 · data-fetch · 상태 · R-78 배선) 을 수령해 결정한다 ("코드보다 ADR 이 먼저다" — CLAUDE.md §1).
- **[ADR-0036](ADR-0036-fine-grained-concurrency.md) §Decision 0 claim-shape 변경**: T-0361~T-0375 는 각 task 가 신규 컴포넌트 파일 2 개만 만져 **file-disjoint** 했고, 그래서 동시 claim 가능 (병렬) 했다. composition-wiring 은 `web/src/App.tsx` (+ 신설될 layout/routing/fetch 경계 파일) 를 **여러 task 가 공유 수정**하므로 §Decision 0 의 동시 claimable 조건 (a) 파일-disjoint 을 깨고 **shared-file·non-parallel stream** 으로 claim-shape 가 바뀐다.

무계획 wiring task 양산은 (1) App.tsx 공유 수정의 race/충돌 위험과 (2) cap (300 LOC / 5 파일) 초과 위험을 부른다. 그래서 전환 전략을 본 ADR 로 먼저 박제한 뒤, 실 조립 코드는 후속 wiring task chain 의 책임으로 넘긴다. 본 ADR 은 결정 전용 0 LOC — 새 dependency 실 추가는 ACCEPTED 후 별도 §5-gated task 다.

## Decision

본 ADR 은 다음 5 개를 결정한다. 단 status 는 **PROPOSED** — ACCEPTED flip 은 reviewer 검토 후 별도 direct 한 줄 수정 (CLAUDE.md §3.1 규칙 4).

### 1. 컴포지션 구조 — AppShell → 인증 게이트 → 화면 컨테이너 → presentational (controlled lift-up)

15 개 presentational 컴포넌트는 다음 위계로 조립한다:

```
AppShell (전역 레이아웃 + R-78 배너 슬롯)
  └ 인증 게이트 (미인증 → LoginForm 화면 / 인증 → 아래 화면 컨테이너)
      └ 화면 컨테이너 (route/view 단위: 대시보드 · Admin · SuperAdmin 셋업)
          └ presentational 컴포넌트 (props 소비)
```

**controlled lift-up 패턴** 을 채택한다: 데이터·상태 (입력값 · loading · error · 조회 결과) 는 **화면 컨테이너가 소유** 하고, presentational 컴포넌트는 props 로만 소비한다. 이는 기존 15 개 컴포넌트가 이미 props-only controlled 로 작성된 모양 (예 `LoginForm` 의 `username`/`password`/`onSubmit`/`loading`/`error` props, `EvaluationGuardBanner` 의 `active`/`message` props) 과 정확히 정합한다 (ADR-0040 §2 — 컨테이너가 데이터 소유, presentational 은 props 소비). 사유: 이 패턴이라야 presentational 컴포넌트를 **수정 없이** 그대로 재사용해 조립할 수 있고, 테스트 가능성 (presentational 은 순수 함수, 컨테이너만 fetch mock) 과 관심사 분리가 유지된다.

### 2. 라우팅 접근 — 무라우터 상태 기반 view 전환 (react-router 는 deferred §5-gated 제안)

**채택: 초기 composition 은 라우터 라이브러리 없이 React hooks 기반 상태 (예 `useState<View>`) 로 view 를 조건부 렌더링** 한다 (`'login' | 'dashboard' | 'admin' | 'superadmin-setup'` 같은 view enum 을 AppShell/인증 게이트 레벨에서 보유하고 switch). 사유:

- **zero-new-dep 으로 즉시 autonomous 시작**: 무라우터 view 전환은 `react`/`react-dom` (ADR-0040 §5 의 이미 승인 예정 dep) 만으로 성립한다. 새 dependency 게이트 (CLAUDE.md §5 BLOCKED → 사용자 승인) 를 거치지 않고 composition wiring 을 곧바로 시작할 수 있다.
- **현 요구 충족**: P6 의 화면 수는 소수 (로그인 · 대시보드 · Admin · SuperAdmin 셋업) 이고, 사내 인증 뒤 SPA 라 SEO·deep-link·브라우저 history 동기화가 필수 요구가 아니다 (ADR-0040 대안 1 Next.js 기각 논리와 동형 — SSR/file-routing 무의미). 단순 view 전환으로 충분하다.

**deferred 제안 (proposal only — 실 추가는 별도 §5-gated task + 사용자 승인)**: deep-linking (북마크 가능한 URL · 새로고침 시 view 보존 · 브라우저 뒤로가기) 이 genuine 요구로 부상하면 **react-router** 도입을 제안한다. 단 본 ADR 은 이 도입을 **제안만** 하며, 실 `pnpm add react-router` 은 CLAUDE.md §5 new-dep BLOCKED 게이트 → 사용자 승인 → 별도 ADR/task 의 책임이다 (ADR-0040 §5 위임 경로 동일). 무라우터 view 전환을 view enum 으로 추상화해 두면 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.

### 3. data-fetch 경계 — 컨테이너가 thin custom fetch hook 호출, JWT cookie 자동 동반, loading/error → props

**채택: `/api/*` 호출은 화면 컨테이너가 thin custom fetch hook/layer 를 통해 수행** 한다. fetch 라이브러리 (axios · @tanstack/react-query 등) 없이 **native `fetch` 를 얇게 감싼 custom hook** (예 `useApi(path)` 또는 `apiClient.get(path)`) 을 첫 cut 으로 채택한다. 사유:

- **zero-new-dep 으로 즉시 시작**: native `fetch` 는 브라우저 표준 — 새 dependency 0. axios/react-query 게이트를 거치지 않고 data-fetch 배선을 시작할 수 있다.
- **인증 (JWT HttpOnly cookie, ADR-0008) credential 흐름**: ADR-0040 §2 의 same-origin 구조에서 cookie 는 자동 동반된다. fetch 호출은 `credentials: 'same-origin'` (또는 `'include'` 동등) 으로 cookie 를 실어 보내고, SPA 는 token 을 저장/접근하지 않는다 (HttpOnly — XSS 표면 0). 표준 흐름: `POST /api/auth/login` → cookie 발급 → 이후 `/api/*` 요청 자동 동반 → **401 시 `POST /api/auth/refresh` 1 회 재시도** → 실패 시 인증 게이트가 로그인 view 로 전환. 이 401→refresh→retry 정책은 thin fetch hook 안에 캡슐화한다.
- **loading/error → props 경계**: 컨테이너가 fetch 의 loading/error/data 상태를 보유하고, 이를 presentational 컴포넌트의 props (예 `loading?`, `error?`) 로 내려보낸다. presentational 은 fetch 를 모른다 (§1 controlled lift-up 과 정합). data-fetch ↔ 화면 매핑 개요 (전수 나열 금지 — [api.md](../architecture/api.md) §5 참조): 로그인 화면 → `/api/auth/login`·`/api/auth/refresh`·`/api/auth/me`, 대시보드 화면 → `/api/assessments`·`/api/summaries`·`/api/contributions` (조회/시계열, User+), Admin 화면 → `/api/persons`·`/api/groups`·`/api/parts`·`/api/llm`·`/api/admin` (mutation, Admin+), SuperAdmin 셋업 → `/api/users` (첫 user · 등급 변경). 세부 endpoint 별 fetch 배선·DTO shape 는 후속 wiring task 책임.

**deferred 제안 (proposal only — 실 추가는 별도 §5-gated task + 사용자 승인)**: 캐싱·중복 요청 dedup·background refetch·낙관적 업데이트가 genuine 요구로 부상하면 **@tanstack/react-query** (또는 동등 query 라이브러리) 도입을 제안한다. 단 실 `pnpm add` 는 CLAUDE.md §5 new-dep BLOCKED → 사용자 승인 → 별도 task 다. thin custom hook 의 인터페이스를 query-library hook 모양 (loading/error/data 반환) 에 가깝게 두면 후일 교체 표면을 줄일 수 있다.

### 4. R-78/REQ-042 보호 배선 — "평가 진행 중" 전역 상태 → EvaluationGuardBanner 토글 + 영속 자료만 fetch

R-78 (평가 진행 중에는 기존 자료만 표시 + 상단 경고 배너) 의 frontend 배선은 다음으로 충족한다 (ADR-0040 §6 책임 수령):

- **전역 "평가 진행 중" 상태 감지**: AppShell 레벨이 평가 실행 상태를 보유한다 (`evaluationInProgress: boolean`). 이 상태는 평가 실행 상태 endpoint 의 polling (또는 조회 응답에 동반되는 상태 플래그) 으로 갱신한다. 상태 endpoint 가 backend 에 부재하면 (P5/P7 evaluation-run 상태 자산 의존) 그 backend task 가 선행해야 하며, 본 frontend stream 은 그 contract 가 갖춰진 시점에 polling 을 배선한다 (선행 의존은 후속 wiring task 의 `dependsOn` 으로 박제).
- **EvaluationGuardBanner 토글**: AppShell 의 R-78 배너 슬롯이 `evaluationInProgress` 를 `EvaluationGuardBanner` 의 `active` prop 으로 내려보낸다. `active === true` 면 배너가 `role="alert"` 로 렌더, `false` 면 null 반환 (이미 [`EvaluationGuardBanner.tsx`](../../web/src/components/EvaluationGuardBanner.tsx) 가 그 분기를 박제). 컴포넌트 수정 0 — props 배선만.
- **"기존 자료만 표시" 자연 충족**: SPA 는 어차피 이미 영속화된 `/api/*` 데이터만 읽으므로 (mutation 없는 조회 화면) "기존 자료만 표시" 는 자연 충족된다. 추가 책임은 진행 중일 때 mutation/재수집 트리거 UI (재평가 패널 등) 를 disable 하는 가드뿐이며, 이는 `evaluationInProgress` 를 해당 presentational 의 `disabled`/`loading` props 로 내려 표현한다.

### 5. concurrency claim shape 전환 — single-claim 순차 (non-parallel) stream

본 composition stream 은 `web/src/App.tsx` (+ 신설될 AppShell/인증 게이트/라우팅-view/fetch hook 파일) 를 **여러 task 가 공유 수정** 하므로 [ADR-0036](ADR-0036-fine-grained-concurrency.md) §Decision 0 의 동시 claimable 조건 (a) **파일-disjoint 이 불성립** 한다. 따라서 본 stream 은 **단일-claim 순차 (non-parallel)** 로 진행한다 — 한 시점에 1 개 wiring task 만 claim/진행하고, 다음 task 는 직전 task 머지 후 풀린다.

- **큐잉 규약**: 후속 wiring task 는 frontmatter 에 `independentStream: p6-frontend-composition` + **직렬 `dependsOn` chain** (각 task 가 직전 task 를 `dependsOn` 으로 가리킴) + `touchesFiles: [web/src/App.tsx, ...]` 를 박제한다. §Decision 0 의 select 단계가 `dependsOn` 미머지 task 를 claim 후보에서 제외 (§Decision 3) 하므로, 직렬 chain 은 자동으로 병렬 claim 후보에서 빠진다. 즉 본 stream 은 fine-grained concurrency 토글 ON 이어도 병렬 진행되지 않는다 (설계상 single-claim).
- **기존 p6-frontend-ui presentational stream 과의 관계**: presentational stream (T-0361~T-0375) 은 **동결/완료** 다. 신규 presentational 컴포넌트는 composition 단계에서 genuine 필요가 발견될 때만 (그 wiring task 안에서 또는 별도 file-disjoint task 로) 추가하며, 무근거 contrived 컴포넌트는 강행하지 않는다 (planner weak-fragment 룰).

## Consequences

### 긍정

- presentational 컴포넌트를 **수정 0** 으로 재사용해 조립한다 (controlled lift-up + props 배선만) — 분해 단계의 산출물이 그대로 살아 throughput 손실이 없다.
- zero-new-dep 기본값 (무라우터 view 전환 + native fetch hook) 으로 composition wiring 을 **사용자 승인 대기 없이 autonomous 하게 시작** 할 수 있다 — §5 new-dep BLOCKED 게이트를 첫 cut 에서 회피.
- single-claim 순차 stream 으로 App.tsx 공유 수정의 race/이중 claim 위험을 **사전 인코딩** 한다 (런타임 충돌 탐지 대신 큐잉 단계 회피 — ADR-0036 §Decision 0 정합).
- R-78 배선이 AppShell 한 곳의 전역 상태 → props 흐름으로 국소화 — 보호 책임의 추적이 명확.

### 부정

- composition stream 은 **병렬 throughput 이 감소** 한다 (단일 claim 순차). presentational 분해의 file-disjoint 병렬성을 잃는다 — 단 §Decision 0 가 애초에 공유 수정 task 의 병렬을 금지하므로 안전을 위한 의도된 비용이다.
- `web/src/App.tsx` 의 **충돌 표면이 증가** 한다 (여러 task 가 같은 파일 수정) → 직렬 chain 이라도 fetch+rebase 빈도가 늘 수 있다. cap (300 LOC / 5 파일) 을 넘지 않도록 task 를 잘게 split 해 한 task 가 App.tsx 를 크게 흔들지 않게 한다.
- data-fetch/라우터 라이브러리가 후일 genuine 요구로 부상하면 **new-dep 게이트 (CLAUDE.md §5 BLOCKED → 사용자 승인)** 가 발생한다 — 본 ADR 의 deferred 제안이 그 진입점이다.
- R-78 polling 은 평가 실행 상태 endpoint 의 backend 존재에 의존한다 — 부재 시 backend 선행 task 가 필요 (후속 wiring task 의 `dependsOn` 으로 박제).

### 중립 — 후속 wiring task chain 분할 (개요만, 실 task 생성은 ACCEPTED 후 planner 책임)

본 stream 의 wiring 은 대략 다음 직렬 chain 으로 분할될 것이다 (각 ~≤300 LOC / 5 파일 cap 준수, 직렬 `dependsOn`, `independentStream: p6-frontend-composition`):

1. **① AppShell + 레이아웃 골격** — 전역 레이아웃 + view enum 상태 + R-78 배너 슬롯.
2. **② 인증 게이트 + view 전환 (무라우터)** — 미인증/인증 분기 + LoginForm 배선 + 401→refresh→retry fetch hook 골격.
3. **③ 대시보드 화면 조립** — 조회/시계열/필터 presentational + `/api/assessments`·`/api/summaries`·`/api/contributions` fetch 배선.
4. **④ Admin 화면 조립** — 인원/그룹/LLM/import-export/스케줄 presentational + `/api/persons`·`/api/groups`·`/api/parts`·`/api/llm`·`/api/admin` mutation 배선.
5. **⑤ R-78 보호 배선** — 평가 진행 중 전역 상태 polling + EvaluationGuardBanner 토글 + mutation 가드.

**이 분할은 개요일 뿐이다** — 실 task 생성·정확한 split·LOC 추산은 본 ADR 이 ACCEPTED 로 flip 된 후 **planner 의 후속 호출 책임** 이다. SuperAdmin 셋업 화면은 ②/④ 중 의존성에 맞는 위치에 흡수될 수 있다.

## Alternatives considered

### presentational 분해를 contrived 컴포넌트로 더 끌고 가기 (대안 1 — 기각)

평가-run progress stepper · confirmation-dialog shell · toast 배너 등 standalone presentational 컴포넌트를 더 만들어 file-disjoint 병렬 throughput 을 연장하는 안. 그러나 이 후보들은 **genuine REQ backing 이 없다** — R-78/REQ-042 의 "평가 진행 중 보호" 는 이미 EvaluationGuardBanner 가 cover 하고 (README 의 R-78 은 "기존 자료만 표시 + 상단 경고 배너" 이지 progress stepper 가 아님), confirmation-dialog/toast 는 특정 REQ 가 아니라 composition 단계에서 결정될 interaction 관심사다. weak-fragment 강행은 사용처 없는 죽은 컴포넌트와 잘못된 인터페이스 추측을 낳는다 — **기각**.

### ADR 없이 App.tsx 를 단일 거대 task 로 한번에 조립 (대안 2 — 기각)

전략 박제를 생략하고 `web/src/App.tsx` + 전 화면 컨테이너 + fetch 레이어를 한 task 로 조립하는 안. 그러나 (a) 전체 조립은 **cap (300 LOC / 5 파일) 을 크게 초과** 하고 (15 컴포넌트 × 컨테이너 + fetch + 라우팅), (b) claim-shape 가 미박제라 다른 driver 가 같은 App.tsx 를 동시 claim 하면 **race/이중 claim/merge 충돌** 위험이 노출된다 (ADR-0036 §Decision 0 의 file-disjoint 사전 회피가 작동하지 않음). single task 의 거대 diff 는 reviewer 검토 표면도 폭증시킨다 — **기각**. 본 ADR 이 claim-shape (single-claim 순차) 와 직렬 chain 분할을 사전 박제해 두 위험을 모두 회피한다.

### react-router + react-query 를 초기 composition 에서 즉시 도입 (대안 3 — 기각/deferred)

처음부터 본격 라우터 + query 라이브러리를 깔아 deep-linking·캐싱을 확보하는 안. 그러나 둘 다 **새 dependency** 라 CLAUDE.md §5 new-dep BLOCKED → 사용자 승인 게이트에 걸려 composition wiring 의 autonomous 시작을 막는다. 현 P6 요구 (소수 화면, 사내 인증 SPA, 100~200 명 규모 조회) 는 무라우터 view 전환 + native fetch hook 으로 충분히 충족된다 (ADR-0040 §1·§6 정합). 따라서 즉시 도입은 **기각** 하고, deep-linking/캐싱이 genuine 요구로 부상하는 시점의 §5-gated 제안 (Decision 2·3 의 deferred) 으로 미룬다.

## References

- [T-0376](../tasks/T-0376-p6-composition-wiring-adr.md) — 본 ADR 을 박제한 task
- [ADR-0040](ADR-0040-frontend-stack.md) — Frontend stack (React + Vite, `/api/*` 경계, R-78 frontend 책임, new-dep §5 게이트) — 본 ADR 이 그 미결 위임 (라우터·data-fetch·상태) 을 수령
- [ADR-0036](ADR-0036-fine-grained-concurrency.md) §Decision 0 — 동시 claimable 조건 (파일-disjoint) — composition 이 깨는 그 조건
- [ADR-0008](ADR-0008-auth-credential-type.md) — JWT HttpOnly Secure SameSite=Strict cookie (인증 credential 흐름의 전제)
- [docs/architecture/api.md](../architecture/api.md) §5 — `/api/*` REST contract (data-fetch 경계의 소비 대상)
- [CLAUDE.md](../../CLAUDE.md) §1 (코드보다 ADR) / §5 (new-dep BLOCKED 게이트) / §3.1 규칙 4 (PROPOSED → ACCEPTED flip)
- [README.md](../../README.md) — REQ-038 (시각화 UI) / REQ-042·R-78 (평가 진행 중 보호) / REQ-048 (조회 3초)
- `web/src/App.tsx` (현 placeholder) / `web/src/main.tsx` (진입) / `web/src/components/LoginForm.tsx` · `EvaluationGuardBanner.tsx` (controlled presentational 대표 모양)

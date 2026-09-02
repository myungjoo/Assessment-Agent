---
id: ADR-0060
title: 평가/수집 실행 상태 조회 endpoint 계약 — 상태 보유 방식 · endpoint shape · RBAC · 전이 시점 · polling 주기
status: ACCEPTED
date: 2026-09-02
relatedTask: [T-1840]
relatedReq: [REQ-083]
supersedes: null
---

# ADR-0060 — 평가/수집 실행 상태 조회 endpoint 계약 (R-78 polling 선행)

## Status

**ACCEPTED**. 본 ADR 은 **결정만 박제** 하며 코드를 1 LOC 도 만들지 않는다 — 본 task 의 diff 는 이 문서 1 개뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 이다(`git diff --stat` 이 `docs/decisions/ADR-0060-evaluation-run-status-endpoint.md` 한 줄만 보이는 것으로 검증된다). 상태 보유 service · controller route · DTO · e2e · web polling 배선은 전부 §Follow-ups 로 이월한다([ADR-0058](ADR-0058-service-identity-management-api.md) · [ADR-0059](ADR-0059-collection-target-registration.md) 의 doc-only ADR 선례 동형).

**새 외부 dependency 0 · Prisma schema 변경 0** — 채택안(§Decision 1 (a))은 기존 NestJS provider 와 이미 부착된 `JwtAuthGuard` / `RolesGuard` 만으로 성립한다. 따라서 본 결정은 [CLAUDE.md](../../CLAUDE.md) `§5` 의 new-dep 게이트와 DB schema 게이트 **어느 쪽에도 걸리지 않는다**.

**완료 선언 0** — 본 ADR 은 [PLAN.md](../PLAN.md) `133 행` bullet 의 마커를 바꾸지 않고, [requirements.md](../requirements.md) `102 행` REQ-083 의 `PLANNED` status 도 그대로 두며, [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` 의 **gap** 표기도 유지한다. 실제 capability 는 §Follow-ups 의 slice 들이 머지된 뒤에야 생긴다.

## Context

[PLAN.md](../PLAN.md) `133 행` bullet(오너 지시 2026-08-26, R-187~R-191)의 잔여 두 조각
(① 전역 CSS · ④ R-78 polling) 중 ④ 를 여는 첫 slice 다. 선행 의존은 이미 세 곳에 박제돼
있다 — [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` 표가
"전역 경고 배너 토글 ← 평가/수집 실행 상태 조회 endpoint — **gap (미존재)**" 이고,
같은 문서 `107 행` 이 그 gap 을 "P6 dashboard 의 hard dependency" 로 올려 두었으며,
[ADR-0041](ADR-0041-frontend-composition-wiring.md) `88 행` 이 "R-78 polling 은 평가 실행
상태 endpoint 의 backend 존재에 의존 — 부재 시 backend 선행 task 필요" 로 못 박았다.
소비 측 계약은 이미 완성돼 있다 —
[EvaluationGuardBanner.tsx](../../web/src/components/EvaluationGuardBanner.tsx) `12 행` 이
`active: boolean` prop 을 받아 `21 행` 에서 `false` 면 `null`, `27 행` 에서 `true` 면
`role="alert"` 배너를 그린다(ADR-0041 `64 행` 의 "컴포넌트 수정 0 — props 배선만").

문제는 backend 에 **실행 상태라는 자산 자체가 없다** 는 것이다.

- **실행 진입점은 전부 동기 요청이다** — 평가 축은
  [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)
  의 `208 행` `@Post("evaluate")` · `339 행` `@Post("period")` · `538 행`
  `@Post("unevaluated-fill-plan")` · `599 행` `@Post("unevaluated-fill-run")` 4 route 고,
  수집 축은
  [assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts)
  `54 행` `@Post("collect")` 1 route 다. 다섯 모두 요청 handler 안에서 일을 끝내고 결과를
  반환할 뿐, "지금 돌고 있다" 를 밖에서 읽을 수 있는 형태로 남기지 않는다.
- **DB 에 실행 상태 model 이 없다** — [prisma/schema.prisma](../../prisma/schema.prisma) 의
  job 계열은 `614 행` `ExportJob` 과 그 뒤 `ImportJob` 둘뿐이고, 평가/수집 실행을 표현하는
  model 은 0 이다.
- **조회 endpoint 도 없다** — [api.md](../architecture/api.md) 의 평가/수집 표에 실행 상태
  조회 행이 없다.

즉 "무엇을 실행 중으로 볼 것인가 · 그 상태를 어디에 둘 것인가 · 누가 읽을 수 있는가" 는 대안이
실재하는 설계 결정이고, 그중 일부(Prisma model 신설)는 [CLAUDE.md](../../CLAUDE.md) `§5` 의 DB
schema 게이트를 건드린다. 이 판단을 후속 slice 마다 재추론하면 service · route · web polling 이
각자 다른 가정을 갖는다. "코드보다 ADR 이 먼저"([CLAUDE.md](../../CLAUDE.md) `§1`)를 여기서
1 회 집행한다.

## Decision

### 1. 실행 상태의 보유 방식 — (a) 프로세스 in-memory 실행 카운터 서비스 채택

축별 **실행 중 카운터를 보유하는 단일 NestJS provider** 를 신설한다(`RunStatusService`,
`src/run-status/`). 상태 실체는 축마다 정수 카운터 하나와 가장 이른 시작 시각 하나뿐이며,
DB · 파일 · 외부 store 를 쓰지 않는다.

채택 근거는 다음과 같다.

- **배포 토폴로지와 정합** — [ADR-0003](ADR-0003-deployment.md) `32 행` Decision §1 이 운영
  토폴로지를 **monolithic 단일 NestJS process** 로 확정했고, 그 위에서 프로세스 메모리는
  "그 프로세스가 지금 무엇을 실행 중인가" 에 대한 **정확한** 정본이다. 상태의 수명이 실행의
  수명과 정확히 같다.
- **동형 선례가 이미 ACCEPTED** — [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) `57 행` 이
  스케줄 등록을 "단일 process in-memory(프로세스 재시작 시 휘발)" 로 두고 영속화 · 다중
  인스턴스를 후속/별도 ADR 로 분리했다. 본 결정은 같은 경계선을 같은 이유로 다시 긋는다.
- **게이트 회피가 정당하다** — 새 외부 dependency **0**, `prisma/schema.prisma` 변경 **0**,
  migration **0**. 회피를 위해 요구를 깎은 것이 아니라, R-78 이 필요로 하는 것이 "현재 실행
  중인가" 라는 **휘발성 boolean** 뿐이어서 영속 자산이 애초에 과잉이다.
- **읽기 비용이 상수** — polling 대상이라 조회가 잦다. 메모리 카운터 읽기는 DB round-trip
  0 이라 [requirements.md](../requirements.md) REQ-048(3 초 응답) 계열 NFR 에 부담을 주지
  않는다.

기각안 2 종((b) Prisma model 신설 · (c) 기존 데이터에서 파생 추론)의 기각 사유는
§Alternatives 에 적는다. **만약 후속 slice 가 본 결정을 뒤집고 schema 변경을 동반하는 안으로
가야 한다고 판단하면**, 그 slice 는 §Consequences (e) 대로 진행을 멈추고
[CLAUDE.md](../../CLAUDE.md) `§5` 게이트를 경유해야 한다.

### 2. endpoint 계약 — `GET /api/run-status`

| 항목 | 값 |
| --- | --- |
| method | `GET` |
| path | `/api/run-status` |
| 성공 status | `200`(실행 중 여부와 무관하게 항상 200 — 상태 조회 자체는 언제나 성공) |
| request body | 없음(query parameter 0) |

응답 body shape(모든 필드 필수이며 `null` 허용 여부를 명시):

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `active` | `boolean` | 두 축 중 **하나라도** 실행 중이면 `true`. 배너 토글의 단일 축 |
| `evaluation.active` | `boolean` | 평가 축 실행 중 여부 |
| `evaluation.runningCount` | `number`(정수 ≥ 0) | 평가 축 동시 실행 건수 |
| `evaluation.startedAt` | `string` 또는 `null` | 실행 중인 평가 중 가장 이른 시작 시각(ISO-8601 UTC). 비실행 시 `null` |
| `collection.active` | `boolean` | 수집 축 실행 중 여부 |
| `collection.runningCount` | `number`(정수 ≥ 0) | 수집 축 동시 실행 건수 |
| `collection.startedAt` | `string` 또는 `null` | 위와 동형(수집 축) |
| `observedAt` | `string` | 서버가 이 응답을 만든 시각(ISO-8601 UTC). 클라이언트의 stale 판정 근거 |

불변식: `active === (evaluation.active || collection.active)` 이고
각 축의 `active === (runningCount > 0)` 이다 — 파생 필드를 응답에 함께 실어 클라이언트가 같은
규칙을 재구현하지 않게 한다.

**배너 매핑**: frontend 는 응답의 `active` 를 AppShell 의 `evaluationInProgress` 전역 상태에
그대로 대입하고 그 값을
[EvaluationGuardBanner](../../web/src/components/EvaluationGuardBanner.tsx) 의 `active` prop
으로 내려보낸다(ADR-0041 `64 행` 배선 그대로 — 컴포넌트 수정 0).

### 3. 인증 · RBAC 경계 — `User+`

`JwtAuthGuard` + `RolesGuard` + `@Roles("User")` 를 부착한다. 근거와 귀결:

- **등급 선택** — 배너는 인증된 모든 화면의 전역 요소이므로 가장 낮은 인증 tier 인 `User` 를
  기준으로 연다. [api.md](../architecture/api.md) `37 행` 의 escalation
  (`SuperAdmin ⊇ Admin ⊇ User ⊇ Public`)상 `RolesGuard` 의 `ROLE_HIERARCHY` 가 Admin ·
  SuperAdmin 도 통과시키므로 **인증된 사용자에게 403 이 발생하는 경로는 없다**
  (`339 행` `@Post("period")` 가 이미 쓰는 것과 같은 조합).
- **미인증 요청** — cookie 부재 · 토큰 invalid · 만료는 `JwtAuthGuard` 가 **401** 로 막는다.
  실행 상태를 익명에게 공개하지 않는다(운영 활동 시점이 새는 것을 막는 최소 보수 선택).
- **credential 정합** — [ADR-0008](ADR-0008-auth-credential-type.md) `Decision §2` 의 JWT
  HttpOnly · Secure · SameSite=Strict cookie 계약을 그대로 따른다. 본 endpoint 전용의 새
  credential · 새 header · 새 token 은 **도입하지 않으며**, web 은 기존과 같이 fetch 의
  `credentials` 옵션을 `include` 로 두어 호출한다.

### 4. 상태 전이 시점 — 비용 있는 실행 4 진입점 · `finally` 감소 보장

**상태를 켜는 진입점(4 개)**:

| 진입점 | 축 |
| --- | --- |
| `208 행` `@Post("evaluate")` | evaluation |
| `339 행` `@Post("period")` | evaluation |
| `599 행` `@Post("unevaluated-fill-run")` | evaluation |
| `54 행` `@Post("collect")`(collection controller) | collection |

**켜지 않는 진입점(1 개)**: `538 행` `@Post("unevaluated-fill-plan")` — 이름 그대로 무엇을
평가할지 **계획만 조회** 하는 dry-run 이라 LLM round-trip 도 write 도 없다. 이것까지 켜면
배너가 "평가 중" 이라고 거짓말한다.

**전이 규칙**: 각 handler 는 실행 직전에 `begin(axis)` 로 카운터를 1 증가시키고 `finally`
블록에서 `end(axis)` 로 1 감소시킨다. 감소를 `finally` 에 두는 것이 계약의 핵심이다 — 정상
반환 · `HttpException` · service-layer 의 raw 전파 예외 어느 경로로 빠져나가도 감소가
실행되므로 **예외로 인한 stuck 상태가 생기지 않는다**. 카운터는 축별 정수이므로 동시 실행
N 건이 서로를 조기 종료시키지 않는다(마지막 1 건이 끝나야 `active` 가 `false` 로 내려간다).

**프로세스 재시작 시 복구**: 상태가 프로세스 메모리에만 있으므로 재시작하면 두 축 모두
`runningCount` 가 0 으로 초기화된다. 즉 `finally` 조차 돌지 못하는 비정상 종료(강제 kill ·
OOM)에서도 **재시작 자체가 복구 수단** 이며, 별도의 TTL · 청소 job · 관리자용 강제 해제
endpoint 를 두지 않는다(§Decision 1 의 "상태 수명 = 실행 수명" 의 자연 귀결). 반대로 실행 중
재시작하면 그 실행도 프로세스와 함께 사라지므로 상태와 실체가 여전히 일치한다.

### 5. polling 주기와 다중 인스턴스 한계

- **권장 간격 5 초** — 근거 세 가지다. (a) 보호 대상 실행이 LLM round-trip 을 포함해 통상
  수 초 ~ 수 분이므로 5 초 해상도면 배너가 실행 구간의 대부분을 덮는다. (b) 최악의 지연은
  켜짐 · 꺼짐 각각 5 초인데, R-78 이 요구하는 것은 "진행 중임을 알린다" 이지 밀리초 정확도가
  아니다. (c) 응답이 메모리 읽기 + 작은 JSON 이라 동시 사용자 100~200 명 규모에서도 초당 수십
  건 수준의 무시 가능한 부하다([ADR-0003](ADR-0003-deployment.md) `38 행` 이 전제한 규모).
- **탭 비가시 시 중단** — 문서가 hidden 이면 polling 을 멈추고 가시화 시 즉시 1 회 조회한다.
  백그라운드 탭이 종일 요청을 쌓는 것을 막는 값싼 절약이다.
- **다중 인스턴스에서의 부정확** — 채택안은 **단일 프로세스 전제** 다. 인스턴스가 2 개 이상이
  되면 A 에서 실행 중인 평가를 B 가 알 수 없어 B 로 라우팅된 조회는 `active: false` 를
  반환하는 **false-negative** 가 생긴다(반대 방향, 즉 실행이 없는데 `true` 가 되는
  false-positive 는 발생하지 않는다).
- **그럼에도 R-78 의 보호 의도가 깨지지 않는 이유** — R-78 의 보호는 두 조각이다.
  **① "기존 자료만 표시"** 는 조회 endpoint 가 본질적으로 이미 영속화된 데이터만 반환하기
  때문에 인스턴스 수와 무관하게 성립한다
  ([frontend-api-contract.md](../architecture/frontend-api-contract.md) `83 행` 의 "(b) 자연
  충족"). **② "상단 경고 배너"** 만이 위 false-negative 의 영향을 받으며, 그 결과는 사용자가
  안내를 못 받는 **정보 손실** 이지 잘못된 데이터를 보는 **오염** 이 아니다.
- **완화책** — 다중 인스턴스는 현재 요구가 아니다([ADR-0003](ADR-0003-deployment.md) `44 행`
  의 전환 조건 (c) HA 가 요구로 추가되는 시점에 별도 ADR). 그 시점의 승격 경로는 상태를 공유
  저장소(DB row 또는 외부 store)로 옮기는 것이며, §Decision 2 의 **응답 계약은 그대로 두고
  §Decision 1 의 보유 방식만 교체** 하면 되도록 읽기 표면을 endpoint 하나로 좁혀 두었다.

## Consequences

### 긍정

- **결정 재추론 종료** — 보유 방식 · endpoint shape · RBAC · 전이 시점 · polling 5 축이 한 문서로 닫혀 §Follow-ups 의 slice 들은 집행만 한다.
- **게이트 0 으로 자율 진행** — 새 dependency 0 · schema 변경 0 이라 후속 chain 이 사용자 승인 대기 없이 진행된다([CLAUDE.md](../../CLAUDE.md) `§5`).
- **기존 실행 경로 무손상** — 4 진입점의 orchestration 로직을 건드리지 않고 증감 두 줄로 감싼다. 실패 처리 · 응답 shape 는 그대로다.
- **읽기 표면이 하나** — 배너가 참조하는 진실이 `GET /api/run-status` 하나뿐이라 후일 보유 방식을 바꿔도 frontend 배선은 무변경이다.

### 부정 / trade-off

- **(a) chain 완주 전에는 배너가 항상 비활성이다** — §Follow-ups (a) ~ (e) 가 모두 머지되기
  전까지 `EvaluationGuardBanner` 는 계속 `active: false` 로 렌더 0 이다. 즉 **중간 상태의
  "배너가 안 보임" 은 "평가가 안 돌고 있음" 을 뜻하지 않는다**. 이 false-success 를 여기서
  미리 박제해 두어, 중간 slice 의 리뷰나 재판정이 "배너가 조용하니 R-78 충족" 으로 오독하지
  않게 한다(Q-0055 선례 — 계약 drift 를 사후에 발견해 owner 게이트까지 갔던 사고와 같은 종류의
  오독을 사전에 차단). 같은 이유로 §Status 는 REQ-083 status 와 PLAN 마커를 손대지 않는다.
- **(b) 다중 인스턴스에서 배너가 false-negative** — §Decision 5 그대로. 단일 프로세스 전제가
  깨지는 순간 조용히 부정확해지며 그 부정확이 사용자에게 오류로 보이지 않는다(배너가 그냥 안
  뜬다). HA 전환 ADR 이 이 항목을 반드시 다시 읽어야 한다.
- **(c) 카운터는 "무엇을" 실행 중인지 모른다** — 응답에 personId · period · 진행률이 없다.
  R-78 이 요구하지 않아 의도적으로 뺐으나, 후일 "누구 평가가 얼마나 남았나" 요구가 오면
  §Decision 1 의 보유 방식 자체를 재검토해야 한다(카운터로는 확장이 어렵다).
- **(d) polling 이 인증 요청을 5 초마다 만든다** — 접속 사용자 수 × 12 회/분의 인증된 GET 이
  상시 발생한다. 부하 자체는 미미하나 access log · 감사 로그가 이 요청으로 희석될 수 있어,
  로깅 정책이 붙는 시점에 본 endpoint 를 제외 대상으로 볼지 판단이 필요하다.
- **(e) schema 승격은 게이트 대상** — 후속 slice 가 §Decision 1 을 뒤집어 Prisma model 신설로
  가야 한다고 판단하면, 그 slice 는 **즉시 중단하고 `BLOCKED` → notifier 를 거쳐야 한다**
  ([CLAUDE.md](../../CLAUDE.md) `§5` DB schema 게이트). 본 ADR 의 권한으로 schema 를 바꾸는
  것은 금지다 — 본 ADR 은 schema 변경 0 인 안을 채택했을 뿐 schema 변경을 허가하지 않았다.

## Alternatives considered

| 대안 | 내용 | 미채택 근거 |
| --- | --- | --- |
| **(b) Prisma model 신설(`EvaluationRun` 류)** | 실행마다 row 를 만들고 status 전이(`RUNNING` → `SUCCEEDED`/`FAILED`)를 영속화. `614 행` `ExportJob` 동형 | ① [CLAUDE.md](../../CLAUDE.md) `§5` 의 **DB schema 게이트** 에 걸려 owner 승인 없이는 첫 slice 조차 못 연다 — 배너 하나를 켜기 위해 지불하기에 과한 비용이다. ② 영속의 이득(재시작을 넘는 진행 · 감사 추적)은 [ADR-0044](ADR-0044-export-import-job-persistence.md) `144 행` 이 export/import job 에 대해 정당화한 것인데, 배너는 **현재 순간의 boolean** 만 필요해 그 이득을 쓰지 않는다. ③ 오히려 해롭다 — 비정상 종료로 `RUNNING` row 가 남으면 실행이 끝났는데도 배너가 영구히 켜지는 **stuck 상태** 가 생기고, 이를 막으려면 TTL · 청소 job · 강제 해제 경로를 추가로 설계해야 한다(§Decision 4 의 재시작 복구가 공짜로 주는 것). ④ 매 polling 이 DB 조회가 된다 — §Decision 1 |
| **(c) 기존 데이터에서 파생 추론(`Assessment.updatedAt` 등)** | "최근 N 초 안에 갱신된 Assessment 가 있으면 실행 중" 으로 간주 | ① **정의부터 부정확** 하다 — 실행 시작 후 첫 write 가 나오기 전 구간(LLM 대기)은 `false`, 실행이 끝난 뒤 N 초는 `true` 라 배너가 켜져야 할 때 안 켜지고 꺼져야 할 때 안 꺼진다. ② 임계값 N 이 **근거 없는 마법 상수** 이며 LLM 지연 분포가 바뀔 때마다 재조정 대상이 된다. ③ **수집 축을 아예 못 본다** — 수집만 돌고 평가 write 가 없는 구간이 통째로 누락된다. ④ 매 polling 이 인덱스 스캔을 유발해 (b) 의 비용 문제를 그대로 지면서 정확도는 더 낮다 — §Decision 1 |
| **조회 응답에 상태 플래그를 동봉(전용 endpoint 0)** | `/api/assessments` 등 기존 조회 응답에 `evaluationInProgress` 를 실어 보냄(ADR-0041 `63 행` 의 괄호 대안) | 배너가 **조회 트래픽에 종속** 된다 — 사용자가 아무 조회도 하지 않는 화면에서는 상태가 갱신되지 않고, 반대로 모든 조회 endpoint 의 응답 shape 를 동시에 바꿔야 해 변경 표면이 넓다. 읽기 표면을 하나로 좁힌다는 §Decision 2 의 이점도 잃는다 |
| **WebSocket / SSE push** | 상태 변화를 서버가 밀어 보냄 | polling 요청은 사라지나 **새 전송 표면과 연결 수명 관리** 가 들어온다. 5 초 지연이 충분한 요구(§Decision 5)에 비해 비용이 크고, 단일 프로세스 전제가 깨지면 어차피 같은 한계를 만난다 — 필요해지면 그때 별도 ADR |
| **`unevaluated-fill-plan` 도 상태를 켬** | 5 진입점 전부를 동일 취급 | dry-run 계획 조회는 LLM 호출도 write 도 없어, 켜면 실제로는 진행 중이 아닌 상태를 "평가 중" 으로 알린다 — 경고의 신뢰도를 깎는다 — §Decision 4 |
| **`@Roles("Admin")` 으로 제한** | 실행 상태를 Admin+ 에게만 공개 | 배너는 인증된 모든 등급의 전역 요소다. Admin 으로 좁히면 User 화면에서 배너가 영원히 안 뜨거나 403 을 삼키는 분기를 frontend 가 떠안는다 — §Decision 3 |
| **미인증에도 200 공개** | guard 0 인 public endpoint | 운영 활동이 언제 도는지가 익명에게 새고, 기존 `/api/*` 의 인증 기본값에서 홀로 이탈한다. 배너 자체가 인증 후 화면 요소라 공개할 이유도 없다 — §Decision 3 |

## Out of scope

- **코드 1 LOC 0** — `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 무변경(§Status). 상태 service · route · DTO · e2e · web polling 은 전부 §Follow-ups 다. `prisma/schema.prisma` 변경 0 · migration 0 이며(채택안이 schema 를 필요로 하지 않는다), 기존 5 진입점의 orchestration 도 **읽기만** 했다.
- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 0** — [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 상 구현 slice 머지 **후** 1 회만 한다(§Follow-ups (f)).
- **[PLAN.md](../PLAN.md) `133 행` 마커 변경 0** — 잔여 ① 전역 CSS 가 남아 있어 `[ ]` 유지하며, 그 ① 자체도 독립 arc 라 본 ADR 밖이다(배너의 시각적 스타일 포함).
- **[frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 표 · [api.md](../architecture/api.md) 표 동기 0** — endpoint 가 실제로 shipped 된 뒤의 doc-sync slice 소관(§Follow-ups (f)).
- **진행률 · 취소 · 실행 이력 조회** — R-78 이 요구하지 않는다(§Consequences (c)).

## References

- [docs/PLAN.md](../PLAN.md) `133 행` — 오너 지시(2026-08-26, R-187~R-191) ④ R-78 polling
- [docs/requirements.md](../requirements.md) `102 행` REQ-083
- [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) `81~110 행` — §3.4 배너 데이터 소스 + §5 gap 1
- [ADR-0041](ADR-0041-frontend-composition-wiring.md) `59~64 행` · `88 행` · `98 행` — R-78 배선 · 선행 의존 · ⑤ slice
- [ADR-0003](ADR-0003-deployment.md) `32 행` · `38 행` · `44 행` — monolithic 단일 process · 규모 전제 · HA 전환 조건
- [ADR-0042](ADR-0042-nestjs-schedule-adoption.md) `57 행` — 단일 process in-memory(휘발) 선례
- [ADR-0044](ADR-0044-export-import-job-persistence.md) `144 행` — 영속 job entity 를 택한 반대 사례
- [ADR-0008](ADR-0008-auth-credential-type.md) `Decision §2` — JWT HttpOnly cookie 계약
- [docs/architecture/api.md](../architecture/api.md) `37 행` — tier escalation
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `208 행` · `339 행` · `538 행` · `599 행`
- [src/assessment-collection/assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts) `54 행`
- [web/src/components/EvaluationGuardBanner.tsx](../../web/src/components/EvaluationGuardBanner.tsx) `12 행` · `21 행` · `27 행`
- [prisma/schema.prisma](../../prisma/schema.prisma) `614 행` `ExportJob`
- [ADR-0058](ADR-0058-service-identity-management-api.md) · [ADR-0059](ADR-0059-collection-target-registration.md) — doc-only ADR 형식 선례
- [CLAUDE.md](../../CLAUDE.md) `§1` 코드보다 ADR / `§3` 소비처 동반 의무 / `§3.2` R-112 / `§5` 게이트 / `§12` 언어 정책

## Follow-ups

아래는 **순서가 있는 chain** 이다((a) → (b) → (d) → (e) → (f) 가 선행 의존이고 (c) 는 (a)
이후 언제든 착수 가능). **모든 항목이 diff ≤ 300 LOC / 변경 파일 ≤ 5 개 cap 을 지키고, 코드
변경을 동반하면 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 4 항목(happy-path / error path /
분기 cover / negative cases 충분 cover)을 준수한다.** 각 slice 는
[CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무대로 **helper 와 그 호출자를 같은 PR 에**
담는다.

- **(a) 상태 service + 평가 축 소비처 배선** — 신설: `src/run-status/run-status.service.ts`
  (`begin(axis)` / `end(axis)` / `snapshot()`) · `src/run-status/run-status.module.ts`.
  소비처 배선: `src/assessment-evaluation/assessment-evaluation.module.ts` 에
  `RunStatusModule` import, `src/assessment-evaluation/assessment-evaluation.controller.ts` 의
  `208 행` · `339 행` · `599 행` 3 handler 를 `finally` 감소로 감싸 카운터를 증감
  (`538 행` `unevaluated-fill-plan` 은 **제외** — §Decision 4). colocated
  `run-status.service.spec.ts` 로 negative(불균형 `end` · 음수 방지 · 동시 N 건 · 예외 경로
  감소) cover. 5 파일 이내.
- **(b) 조회 route + AppModule 등록** — 신설: `src/run-status/run-status.controller.ts`
  (`@Controller("api/run-status")` + `@Get()` + `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("User")`)와 응답 타입. 소비처 배선: `src/app.module.ts` 에 `RunStatusModule` 등록.
  colocated controller spec 으로 §Decision 2 의 shape 불변식과 비인증 분기 cover.
- **(c) 수집 축 소비처 배선** — `src/assessment-collection/assessment-collection.module.ts` 에
  `RunStatusModule` import + `assessment-collection.controller.ts` `54 행`
  `@Post("collect")` handler 를 `finally` 감소로 감싸 collection 축 증감. colocated spec 에
  예외 경로 감소 test 포함.
- **(d) e2e 로 계약 고정** — 신설: `test/e2e/run-status.e2e-spec.ts`. 미인증 401 · 인증 200 +
  필드 shape · 비실행 시 `active: false` · §Decision 2 불변식을 실 HTTP 로 고정. negative 위주
  스위트.
- **(e) web polling 배선** — 신설: `web/src/api/runStatus.ts`(cookie 동봉 조회 + 실패를
  `active: false` 로 안전 흡수). 소비처 배선: `web/src/AppShell.tsx` 에 5 초 interval + 탭
  비가시 시 중단(§Decision 5) + 응답 `active` 를 `evaluationInProgress` 로, 그것을 기존
  `EvaluationGuardBanner` 의 `active` prop 으로 전달(**컴포넌트 파일 수정 0**). colocated
  `runStatus.test.ts` · `AppShell.test.tsx` 갱신으로 polling 정리(unmount 시 clear) · 실패
  흡수 · 토글 분기 cover. cap 압박이 크면 api helper + spec 을 (e1), AppShell 배선 + spec 을
  (e2) 로 쪼갠다.
- **(f) doc-sync + REQ-083 재판정** — [api.md](../architecture/api.md) 표에
  `GET /api/run-status` 행 추가,
  [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` 의 **gap** 을
  shipped 로 갱신하고 `107 행` 목록에서 1 번 항목 제거,
  [requirements.md](../requirements.md) `102 행` REQ-083 status 를 (a) ~ (e) 실측에 맞춰
  **1 회** 재판정([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 구현 머지 후). doc-sync 이므로
  코드 변경 0.

Refs: T-1840, REQ-083

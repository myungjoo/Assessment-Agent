# Frontend ↔ Backend API 소비 계약 (P6 prep)

> **본 문서는 P6 (Web UI) 진입 prep 산출물이다.** [ADR-0040](../decisions/ADR-0040-frontend-stack.md) §2 "SPA 는 기존 `/api/*` REST contract 의 순수 소비자" 결정을 화면 단위로 구체화한다 — frontend 가 어느 화면에서 [api.md](api.md) 의 어느 기존 endpoint 를 소비하는지, 인증 cookie 를 어떻게 다루는지, 그리고 **P6 가 필요로 하나 아직 shipped 되지 않은 endpoint (gap)** 를 박제한다.
>
> **성격**: 본 문서는 **새 dependency 0 · backend 변경 0 · ADR-0040 flip 비의존** 이다. ADR-0040 이 PROPOSED → ACCEPTED 로 flip 되든(혹은 React 가 다른 framework 로 바뀌든) 본 소비 계약은 동일하게 유효하다 — 어떤 SPA 든 결국 같은 `/api/*` contract 를 소비하기 때문이다. 따라서 stack 승인을 기다리는 동안의 **dependency-free prep** 으로 작성됐다 (Q-0035 = P6 진입 결정).
>
> **living document** — endpoint 가 신설·변경되면 [api.md](api.md) 가 source-of-truth 이고 본 문서는 그 소비 측 매핑을 동기한다.

## 1. 범위와 비범위

본 문서가 **하는 것**:

- P6 4 화면 ([PLAN.md](../PLAN.md) Phase P6) 이 소비하는 기존 `/api/*` endpoint 를 화면 단위로 매핑.
- 인증 cookie ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md)) 의 frontend 측 소비 패턴 (저장 안 함 / 자동 동반 / 401 → refresh).
- R-78 (REQ-042) "평가 진행 중 시각화 보호" 배너의 데이터 소스 + gap.
- P6 가 필요로 하나 **아직 미구현인 endpoint (gap)** 목록 — backend 선행 task 후보.

본 문서가 **하지 않는 것** (범위 밖):

- 구체 JSON request/response field schema — [api.md](api.md) §8 과 동일하게 controller/DTO 가 source.
- 화면 컴포넌트 트리 · 라우팅 · 상태관리 라이브러리 선택 — ADR-0040 §1·§Consequences 가 후속 결정으로 deferred.
- `web/` 디렉토리 실 구조 / scaffold — ADR-0040 ACCEPTED 후 별도 task ([directory.md](directory.md) 갱신 포함).
- 차트 라이브러리 / 시각화 컴포넌트 설계.

## 2. 인증 cookie 소비 패턴 (모든 화면 공통)

[ADR-0008](../decisions/ADR-0008-auth-credential-type.md) + [api.md](api.md) §2 의 **JWT HttpOnly Secure SameSite=Strict cookie** (access 15min + refresh 7day rotation) 를 그대로 소비한다. ADR-0040 §2 의 same-origin 구조 (개발 = Vite dev proxy / 운영 = NestJS static serve) 라 CORS·token 저장 책임이 frontend 에 **없다**.

| 단계 | frontend 동작 | 소비 endpoint |
| --- | --- | --- |
| 로그인 | email/password 제출 → 성공 시 cookie 자동 set (frontend 가 token 을 읽거나 저장하지 **않음** — HttpOnly) | `POST /api/auth/login` |
| 인증 상태 확인 | 앱 부팅 시 본인 등급/식별자 조회 (cookie 자동 동반). 401 이면 미로그인으로 간주 → 로그인 화면 | `GET /api/auth/me` |
| 토큰 만료 | 임의 `/api/*` 호출이 401 반환 시 1회 refresh 시도 → 성공 시 원 요청 재시도, 실패 시 로그인 화면 전환 | `POST /api/auth/refresh` |
| 로그아웃 | cookie clear 요청 (idempotent) → 로그인 화면 | `POST /api/auth/logout` |

**frontend 책임 경계**: cookie 는 browser 가 same-origin 요청에 자동 동반하므로 frontend 코드는 `Authorization` header 를 직접 세팅하지 않는다. RBAC tier (User/Admin/SuperAdmin) 는 backend 가 강제 — frontend 는 403 응답을 받아 UI 를 가리는 **2차 방어** 만 한다 (1차는 backend guard, [api.md](api.md) §3).

## 3. 화면별 endpoint 소비 맵

### 3.1 로그인 / SuperAdmin 초기 셋업 ([PLAN.md](../PLAN.md) P6 L115)

| 화면 요소 | 소비 endpoint | auth tier | 비고 |
| --- | --- | --- | --- |
| 로그인 폼 | `POST /api/auth/login` | Public | 실패 401 → 동일 메시지 (enumeration 차단, api.md) |
| 첫 user(SuperAdmin) 셋업 | `POST /api/users` | Public | DB 비었으면 첫 user 가 자동 SuperAdmin (REQ-044, api.md). 화면은 "첫 실행" 분기 |
| 본인 등급 확인 | `GET /api/auth/me` | User+ | 부팅 시 라우팅 가드 (로그인 여부 + role) |
| 비밀번호 변경 | `PATCH /api/users/:id/password` | User(self)/Admin+ | self 변경은 User 도 가능 |

### 3.2 시각화 대시보드 (정렬·필터·시계열, REQ-038) ([PLAN.md](../PLAN.md) P6 L116)

REQ-038 의 핵심 — 이름/ID/지표별 sort·filter + 일/주/월 시계열. **데이터는 이미 영속화** 되어 있어 frontend 는 조회 endpoint 만 소비한다 (User 등급도 read 가능).

| 화면 요소 | 소비 endpoint | auth tier | 비고 |
| --- | --- | --- | --- |
| 인원 선택 / 필터 (group·part) | `GET /api/persons` `GET /api/groups` `GET /api/parts` | User+ | active/group 필터는 query, sort/filter 일부는 client-side |
| 인원별 평가 시계열 | `GET /api/assessments?personId=&period=` | User+ | **현 구현은 plain CRUD** — `sort`/`filter`/`window`/page 고도화는 P5 deferred (api.md). 초기 dashboard 는 client-side sort/filter 로 대응, 대량 시 backend 확장 gap (§5) |
| 단일 평가 상세 | `GET /api/assessments/:id` | User+ | drill-down |
| 기여 단위 (commit/PR/문서) | `GET /api/contributions?assessmentId=` | User+ | assessment 의 component (REQ-033) |
| 일/주/월 요약 시계열 | `GET /api/summaries?personId=&period=` | User+ | 시계열 차트의 주 데이터 (REQ-034/035/038) |

**집단·전체·filter 인원 단위 시각화** (REQ-038): 현 endpoint 는 personId 단위 조회라, 집단/전체 aggregate 는 frontend 가 N 인원을 fan-out fetch 후 client-side 집계하거나, backend aggregate endpoint 가 선행돼야 한다 (§5 gap).

### 3.3 Admin 패널 (인원·그룹·재평가·import/export·스케줄) ([PLAN.md](../PLAN.md) P6 L117)

| 화면 요소 | 소비 endpoint | auth tier | 비고 |
| --- | --- | --- | --- |
| 인원 CRUD | `POST/PATCH/DELETE /api/persons[/:id]` | Admin+ | PATCH = RFC-7396 merge patch |
| 그룹 / 파트 CRUD | `POST/PATCH/DELETE /api/groups[/:id]` `…/api/parts[/:id]` | Admin+ | part 삭제는 소속 인원 0 일 때만 |
| user 등급 변경 | `PATCH /api/users/:id/role` | SuperAdmin | self-demote 403 |
| LLM provider 설정 | `GET/POST/PATCH/DELETE /api/llm/providers[/:id]` | Admin+ | apiKey 는 응답에서 redact (never-read-back) — 화면은 "재입력" UX |
| 난이도 매핑 | `GET /api/llm/difficulty-mappings` `PATCH …/:difficulty` | Admin+ | easy/medium/hard 슬롯 |
| 수집 manual trigger | `POST /api/assessment-collection/collect` | Admin+ | 한 Person 수집 (ADR-0031) |
| 평가 manual trigger | `POST /api/assessment-evaluation/evaluate` | Admin+ | 수집된 활동 평가+persist |
| 기간 평가 (Admin full-persist) | `POST /api/assessment-evaluation/period` | Admin (full-persist) | first-write-wins + `reevaluate` overwrite (ADR-0037/0038) |
| 권한 부족 audit | `GET /api/permission-denied-records` | User+ | Admin 전체 / non-Admin own-instance |
| instance 접근 grant/revoke | `POST/DELETE /api/users/{id}/instance-access` | Admin+ | non-Admin 가시 범위 부여 (ADR-0027) |
| export / import / backup / restore | `GET /api/admin/export` `POST /api/admin/import` `…/backup` `…/restore` | Admin+ | import 는 multipart |
| **스케줄 (cron 주기 지정)** | — | — | **gap (§5) — endpoint 미존재, P7** |
| **재평가 batch (bulk delete·reeval·reset)** | `DELETE /api/assessments` `POST /api/assessments/reeval` `…/reset` | Admin+ | **미구현 — P5 (UC-06 batch), api.md** |

### 3.4 평가 진행 중 시각화 보호 배너 (R-78 / REQ-042) ([PLAN.md](../PLAN.md) P6 L118)

ADR-0040 §6 의 결정 — frontend 가 (a) 평가 실행 상태를 조회해 전역 배너를 토글하고, (b) 조회 화면은 이미 영속화된 데이터만 fetch 한다. (b) 는 §3.2 의 조회 endpoint 가 본질적으로 영속 데이터만 반환하므로 **자연 충족**. (a) 의 "실행 상태 조회" 가 핵심 gap:

| 화면 요소 | 소비 endpoint | 상태 |
| --- | --- | --- |
| 전역 경고 배너 토글 | **평가/수집 실행 상태 조회 endpoint** | **gap (§5) — 미존재** |
| 배너 중 조회 (기존 자료) | §3.2 의 GET endpoint 그대로 | shipped |

ADR-0040 §6 이 이미 명시 — "실행 상태 endpoint 는 P5/P7 의 evaluation run 상태 자산 — 부재 시 backend task 선행". polling 주기·endpoint shape 는 P6 dashboard task 책임.

## 4. RBAC ↔ 화면 가시성 매핑 요약

| tier | 접근 화면 |
| --- | --- |
| Public | 로그인 / 첫 user 셋업 |
| User | 로그인 + 대시보드 조회 (sort/filter/시계열) + 본인 권한부족 audit + 비밀번호 self 변경 |
| Admin | User 전부 + Admin 패널 (인원/그룹/LLM/수집·평가 trigger/export·import/instance grant) |
| SuperAdmin | Admin 전부 + user 등급 변경 |

frontend 는 `GET /api/auth/me` 의 role 로 메뉴/라우트를 게이트하되, 실제 강제는 backend guard 가 한다 (frontend 게이트는 UX 편의 + 2차 방어). [api.md](api.md) §3 의 `SuperAdmin ⊇ Admin ⊇ User ⊇ Public` escalation 을 그대로 반영.

## 5. P6 가 필요로 하나 미구현인 endpoint (gap — backend 선행 후보)

본 절은 P6 화면이 요구하나 현재 [api.md](api.md) 기준 **미구현/deferred** 인 endpoint 를 박제한다. 각 항목은 frontend impl 전 backend task 가 선행돼야 하며, **frontend 가 임의로 신설하지 않는다** (ADR-0040 §2 경계 — `src/` 미접촉). 우선순위/scope 는 별도 planner 판단.

1. **평가/수집 실행 상태 조회** — R-78 배너 (§3.4) 의 핵심. evaluation run 상태 자산은 P5/P7 책임 (ADR-0040 §6). **P6 dashboard 의 hard dependency** — 배너 없이는 R-78 미충족.
2. **집단·전체·filter 인원 aggregate 조회** — REQ-038 의 "집단·전체·filter 인원 단위 시각화" (§3.2). 현 personId 단위 조회로는 N-fan-out + client 집계가 필요 — 100~200 명 규모에서 REQ-048 (3초) 위반 징후 시 backend aggregate endpoint 선행.
3. **평가 batch (manual trigger / bulk delete / reeval / reset)** — `POST /api/assessments/run`, `DELETE /api/assessments`, `POST /api/assessments/reeval`, `POST /api/assessments/reset` 는 api.md 가 **P5 (UC-06 batch) 미구현 deferred** 로 박제. Admin 패널 (§3.3) 의 재평가 UX 가 의존.
4. **스케줄 (cron 주기 지정)** — Admin 패널 (§3.3) 의 스케줄 항목 + P7 (R-72). 현재 endpoint 미존재 — P7 SchedulerModule 의 HTTP 노출 선행 필요 (UC-01 cron 은 in-process `@Cron` handler 라 HTTP endpoint 아님, api.md §7).
5. **dashboard sort/filter/window 고도화** — `GET /api/assessments` 는 plain CRUD (api.md) — 대량 데이터에서 server-side sort/filter/pagination 이 필요해질 수 있음. 초기엔 client-side 로 대응, REQ-048 위반 시 backend 확장.

## 6. 다음 단계 (ADR-0040 flip 후)

본 prep 은 stack 승인과 독립이다. ADR-0040 PROPOSED → ACCEPTED flip 후 진행될 frontend impl task 의 입력으로 본 문서를 사용한다:

- scaffold task — `pnpm create vite` + `pnpm-workspace.yaml` + `@nestjs/serve-static` (새 dependency — [CLAUDE.md](../../CLAUDE.md) §5 게이트, ADR-0040 §5).
- 인증 흐름 컴포넌트 (§2) — 가장 먼저, 다른 화면의 전제.
- 대시보드 (§3.2) → Admin 패널 (§3.3) → R-78 배너 (§3.4, gap 1 선행 필요).
- §5 gap 들은 각각 backend task 로 분해 (frontend 와 독립 진행 가능 — ADR-0040 §2 경계).

## 7. References

- [ADR-0040](../decisions/ADR-0040-frontend-stack.md) — Frontend stack (React+Vite, NestJS 경계, web/ 구조) — 본 문서의 §2 경계 결정 source
- [docs/architecture/api.md](api.md) — `/api/*` contract source-of-truth (본 문서가 소비 측 매핑)
- [docs/PLAN.md](../PLAN.md) Phase P6 — 4 화면 source / Phase P5·P7 — gap 의 backend 선행 phase
- [README.md](../../README.md) — REQ-038 (시각화) / REQ-042·R-78 (실행 중 보호) / REQ-048 (3초 성능) / REQ-044~046 (RBAC)
- [ADR-0008](../decisions/ADR-0008-auth-credential-type.md) — JWT HttpOnly cookie (§2 인증 소비 패턴의 전제)
- [docs/architecture/directory.md](directory.md) — `web/` 위치 (ADR-0040 ACCEPTED 후 갱신 대상)

Refs: ADR-0040, ADR-0008, ADR-0031, ADR-0032, ADR-0037, ADR-0038, REQ-038, REQ-042, REQ-048, REQ-044, REQ-045, REQ-046, R-78

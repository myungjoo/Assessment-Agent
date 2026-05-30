---
id: UC-04
title: 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)
actor: SuperAdmin / Admin
trigger: 서비스 첫 로긴 (SuperAdmin 자동 지정) 또는 SuperAdmin/Admin 이 Web UI 사용자 관리 화면에서 사용자 추가/등급 변경/Password 변경
status: DONE
coversReq: [REQ-043, REQ-044]
adjacentReq: [REQ-045, REQ-046]
relatedUc: [UC-01, UC-02, UC-03, UC-05, UC-06, UC-07, UC-08]
sourceTask: T-0024
---

# UC-04 — 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)

> **본 문서는 P2 의 네 번째 use case 본문 분해 task [T-0024](../tasks/T-0024-uc-04-account-auth.md) 의 산출물이다.** [docs/use-cases/INDEX.md](INDEX.md) 의 UC-04 row 를 sequence diagram + 흐름 + 실패 경로 + component/module mapping 으로 풀어쓴다. [UC-01](UC-01-evaluation-execution.md) / [UC-02](UC-02-evaluation-query.md) / [UC-03](UC-03-person-crud.md) 의 11 section template 을 그대로 적용한다.

## 1. 개요

본 use case 는 Assessment-Agent 의 **인증·권한 layer 의 source** — 서비스 런칭 후 첫 로긴 사용자가 자동 SuperAdmin 으로 지정되는 흐름, SuperAdmin / Admin / User 의 3 등급 권한 체계, SuperAdmin 이 사용자 추가, Admin 이상이 User → Admin 승급, SuperAdmin 만 Admin → User 강등 가능 + 본인 self-demote 금지, 모든 기능이 ID/Password 로 보호되는 정책을 박제한다 ([README.md](../../README.md) L83–86 "보안 특성" 단락). cover REQ 는 2 개 ([REQ-043](../requirements.md) 모든 기능 ID/Password 보호 / [REQ-044](../requirements.md) SuperAdmin 첫 로긴 + 3 등급 + 승급·강등 규칙) 로 [UC-03](UC-03-person-crud.md) (7 REQ) 보다 짧지만, UC-04 가 정의하는 3 등급이 **UC-01 ~ UC-08 전체의 actor 컬럼 (SuperAdmin / Admin / User) 의 의미를 박제하는 source** 라는 점에서 중요도가 높다.

본 UC 는 [UC-03](UC-03-person-crud.md) (평가 대상 인원 master data) 와 **개념적으로 분리** — Person 은 평가 대상자 (사람), User 는 로그인 가능 계정 (이 시스템의 사용자) 로 두 entity 가 별개다. 한 Person 이 동시에 User 일 수 있는지의 mapping 은 P3 의 data-model.md / 별도 ADR 책임 (Out of Scope). 본 UC 는 8 component 중 3 (Web UI / Backend API / DB Persistence) + 8 module 중 4 (WebModule / AuthModule / UserModule / PersistenceModule) 만 거치며, 외부 시스템 호출 없는 [ADR-0003 §1 monolithic NestJS process](../decisions/ADR-0003-deployment.md) 안의 in-process write 흐름이다. 다른 UC 가 AuthModule 을 "guard 호출 wrapper" 로만 사용한다면 UC-04 는 AuthModule 의 **service layer (사용자·등급 CRUD) 까지 활용**.

## 2. Actor

| actor | 책임 | 본 UC 내 권한 |
| --- | --- | --- |
| **SuperAdmin** ([README.md](../../README.md) L84, [REQ-044](../requirements.md)) | 모든 권한 + Admin→User 강등 + 사용자 추가 + 본인 외 사용자 Password 재설정. 첫 로긴 자동 지정 등급. | 본 UC 의 모든 main flow + alt flow 사용 가능. 본인 self-demote 만 §7.5 로 차단. |
| **Admin** ([README.md](../../README.md) L84, [REQ-045](../requirements.md)) | 사용자 추가 + User→Admin 승급. Admin→User 강등 권한 없음. | 사용자 추가 / User→Admin 승급 가능, Admin→User 강등은 §7.2 로 차단. |
| **User** ([README.md](../../README.md) L86, [REQ-046](../requirements.md)) | read-only — 본 UC 의 actor 아님. 본인 Password 변경은 가능 (§6.4). | 사용자 추가 / 등급 변경 호출 시 §7.2 차단. 본인 Password 변경은 모든 등급 허용. |

본 UC 는 SuperAdmin / Admin 이 주된 actor 이며, User 는 §6.4 본인 Password 변경 한 흐름에만 등장. 사용자 (User entity — 로그인 계정) 자체의 CRUD / 등급 승급이 본 UC 의 책임이며, 평가 대상 **인원** (Person entity) 의 CRUD 는 [UC-03](UC-03-person-crud.md) 의 책임.

## 3. Trigger

본 UC 는 다음 4 가지 sub-trigger 경로를 가지며, **(b)~(d) 는 동일한 main flow (§5) 로 수렴** — 차이는 BackendAPI 가 받는 write payload 의 종류 (HTTP method + body) 만 다르다. (a) 첫 로긴 SuperAdmin 자동 지정은 별도 alt flow (§6.1).

1. **서비스 첫 로긴 (자동 SuperAdmin 지정)** — 서비스 런칭 후 첫 로그인 시도 사용자가 SuperAdmin 등급으로 자동 생성. User 테이블이 비어 있을 때 1 회만 발화 ([REQ-044](../requirements.md)).
2. **사용자 추가** — SuperAdmin / Admin 이 Web UI 사용자 관리 화면에서 "신규 사용자 추가" 버튼 → username + 초기 Password + 등급 입력 → 저장 ([REQ-043](../requirements.md), [REQ-044](../requirements.md)).
3. **등급 변경** — User→Admin 승급 (Admin 이상) 또는 Admin→User 강등 (SuperAdmin 한정 + 본인 self-demote 금지, [REQ-044](../requirements.md)).
4. **본인 Password 변경** — 모든 등급이 본인 Password 변경 가능 ([REQ-043](../requirements.md)).

## 4. Preconditions

본 UC 의 main flow 진입 전 다음 조건이 충족돼야 한다. 미충족 시 §7 의 error path 로 분기.

1. **DB Persistence 가용** — PostgreSQL connection pool 정상. connection 끊김 / timeout 시 §7.4.
2. **(a) 첫 로긴 trigger 의 precondition** — User 테이블이 비어 있음. 1 회만 발화, 이후 동일 trigger 재발화 불가.
3. **(b)~(d) trigger 의 precondition** — 인증 완료 ([REQ-043](../requirements.md)) + 본 작업에 해당 등급 권한 보유 ([REQ-044](../requirements.md)). 미인증 시 §7.1, 권한 부족 시 §7.2.

본 UC 의 핵심 invariant **"SuperAdmin 본인의 self-demote 금지"** ([REQ-044](../requirements.md)) 는 §7.5 의 error flow 로 단단히 박제.

## 5. Main flow (sequence diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Actor as SuperAdmin/Admin
    participant WebUI
    participant BackendAPI
    participant AuthModule
    participant UserModule
    participant PersistenceModule

    Actor->>WebUI: 사용자 관리 화면 접근 / action 선택 (사용자 추가 / 등급 변경 / Password 변경)
    WebUI->>BackendAPI: POST /api/users 또는 PATCH /api/users/:id/role 또는 PATCH /api/users/:id/password + payload
    BackendAPI->>AuthModule: 인증 검증 (REQ-043)
    Note over AuthModule: 미인증 시 §7.1 분기 (401)

    BackendAPI->>AuthModule: 권한 검증 (REQ-044)
    Note over AuthModule: action 별 최소 등급:<br/>사용자 추가 = Admin 이상<br/>User→Admin 승급 = Admin 이상<br/>Admin→User 강등 = SuperAdmin 한정<br/>self-demote = 차단 (§7.5)<br/>권한 부족 시 §7.2 분기 (403)

    BackendAPI->>UserModule: createUser / setUserRole / setUserPassword (payload)
    Note over UserModule: payload 검증<br/>(등급 enum 유효 / Password 강도 / username 중복 / target user 존재 / self-demote invariant)<br/>(REQ-043, REQ-044)

    alt 검증 실패
        Note over UserModule: §7.3·§7.5 분기 (400 + 검증 메시지)
    end

    alt 첫 로긴 trigger — User 테이블 비어있음 (REQ-044)
        Note over UserModule: SuperAdmin 등급으로 자동 생성<br/>§6.1 분기
    end

    UserModule->>PersistenceModule: User row CRUD (Password 는 hash 저장 — schema-level 강제)
    PersistenceModule-->>UserModule: 결과 (성공 row 또는 DB error)

    UserModule-->>BackendAPI: result + audit metadata
    BackendAPI-->>WebUI: JSON 응답 (성공 = UserResponseDto / 검증 실패 / 권한 부족)
    Note over BackendAPI: 성공 응답 body = UserResponseDto (5 readonly 필드 id/email/role/createdAt/updatedAt — hashedPassword 응답 누출 차단, T-0095 박제). defence in depth 2 layer: DB bcrypt 10 rounds (T-0092) + HTTP whitelist DTO (T-0095). ADR-0008 §6 application-layer last-mile.
    WebUI->>Actor: 결과 표시 (성공 / 검증 실패 안내 / 권한 부족 안내)
```

step 수: 약 11 (autonumber 기준 — alt block 안의 분기 포함, 8 ≤ 11 ≤ 14 범위 안). 본 다이어그램은 [components.md](../architecture/components.md) 의 Component diagram + [modules.md](../architecture/modules.md) 의 의존성 그래프와 정합 — Web UI → Backend API, Backend API → {AuthModule, UserModule}, UserModule → PersistenceModule 의 방향이 모두 의존성 그래프에서 허용된 방향. Password hash 알고리즘은 P3 의 별도 ADR 책임 — 본 UC 는 "Password 는 hash 저장 (schema-level 강제)" 의 conceptual level 만.

## 6. Alternative flows

### 6.1 서비스 첫 로긴 — SuperAdmin 자동 지정 (REQ-044)

User 테이블이 비어 있을 때 첫 로그인 시도 사용자가 SuperAdmin 등급으로 자동 생성된다 ([REQ-044](../requirements.md)). 본 흐름은 §5 의 main flow 와 **분리된 별도 트리거** — 인증 검증 (§5 step 3) 단계 자체가 우회되며, AuthModule 이 User 테이블이 비어 있음을 감지하면 입력된 username + Password 를 SuperAdmin 으로 직접 insert. 본 trigger 는 서비스 런칭 후 **1 회만** 발화 가능 — 이후 동일 trigger 는 User 테이블 비어 있음 조건 위반으로 발화 불가. 두 사용자가 동시 첫 로긴 시도하는 race condition (둘 다 SuperAdmin 으로 지정될 위험) 의 처리는 P3 의 service layer 책임 (Out of Scope).

### 6.2 User → Admin 승급 (Admin 이상)

Admin 또는 SuperAdmin 이 본 작업 수행 가능 — target user 는 현재 등급 User. PATCH /api/users/:id/role + body `{ role: "Admin" }` 요청. AuthModule 의 권한 검증 (§5 step 4) 이 actor 의 등급 ≥ Admin 확인 후 통과. 본 흐름은 README L83–86 의 "Admin 도 User→Admin 승급 가능" 정책 박제.

### 6.3 Admin → User 강등 (SuperAdmin 한정)

SuperAdmin 만 수행 가능 — target user 는 현재 등급 Admin. PATCH /api/users/:id/role + body `{ role: "User" }` 요청. AuthModule 의 권한 검증 (§5 step 4) 이 actor 의 등급 == SuperAdmin 확인 후 통과. Admin 이 본 요청 시도 시 §7.2 (403) 로 차단. SuperAdmin 본인이 self (target == actor) 인 경우 §7.5 (self-demote 차단) 로 별도 분기.

### 6.4 본인 Password 변경 (모든 등급)

모든 등급 (SuperAdmin / Admin / User) 이 본인 Password 변경 가능 — User 등급도 본 흐름에 한해 actor 로 진입. PATCH /api/users/:id/password + body `{ oldPassword, newPassword }` 요청, 단 `:id == 인증된 actor 자신` 일 때만 허용. AuthModule 의 권한 검증 (§5 step 4) 이 단순화 — `:id == authenticated self` 검사만 수행. 본인 외 사용자의 Password 재설정은 SuperAdmin 의 별도 흐름 (관리자 reset — 본 UC 의 §6.4 알 수 없음, P3 의 책임).

## 7. Error flows

본 UC 의 error path 는 다음 5 종.

### 7.1 인증 실패 (REQ-043)

`AuthModule` guard 가 session / JWT 검증 실패 (만료 / 위조 / 미존재) → 401 return → WebUI 가 사용자를 login 페이지로 redirect. 본 UC 의 main flow 진입 자체가 차단되며, User entity 의 어떤 write 도 발생하지 않는다. 단 §6.1 의 첫 로긴 trigger 는 본 단계 우회.

### 7.2 권한 부족 (REQ-044)

다음 경우에 AuthModule guard 가 403 return + WebUI 가 "권한 부족" 안내:

- User 가 사용자 추가 / 등급 변경 시도 (본 UC 의 actor 아님).
- Admin 이 Admin→User 강등 시도 (SuperAdmin 한정 권한 위반, §6.3).
- Admin 이 다른 사용자의 등급을 SuperAdmin 으로 변경 시도 (등급 promote 권한 위반 — Admin→SuperAdmin promote 는 README L83–86 명시 없음, 보수적으로 차단).

본 UC 의 모든 sub-trigger 가 동일 차단 정책을 따른다.

### 7.3 payload 검증 실패 (REQ-043, REQ-044)

UserModule 의 payload 검증 단계에서 다음 중 하나에 해당하면 400 return + 검증 메시지:

- 등급 enum 잘못 (SuperAdmin / Admin / User 외 값).
- Password 강도 부족 (구체 정책은 P3 의 service layer 책임).
- username 중복 (system-wide unique).
- target user 부재 (PATCH 의 `:id` 가 DB 에 없음).

WebUI 는 응답 메시지를 form 의 field-level error 로 표시. Password 강도 정책 / 정책 위반 메시지는 P3 의 service layer 구현 책임 — 본 UC §7.3 은 "강도 부족" 의 conceptual level 만.

### 7.4 DB write fail

`PersistenceModule` 이 connection 끊김 / timeout / unique constraint 위반 (username 중복) / transaction rollback 시 5xx return → WebUI 가 사용자에게 "일시적 오류 — 재시도해주세요" 안내. 본 UC 의 retry 정책은 **사용자가 직접 재시도** 가 default — POST (사용자 추가) 의 retry 는 중복 생성 위험으로 사용자 명시적 재시도 권장.

### 7.5 SuperAdmin self-demote 시도 (REQ-044 invariant)

SuperAdmin 본인이 본인의 등급을 Admin / User 로 변경 시도 — PATCH /api/users/:id/role + `:id == authenticated self` + `body.role != SuperAdmin` 의 경우 — AuthModule 또는 UserModule 의 invariant 검증이 403 return + "SuperAdmin 본인 등급 변경 불가" 안내. 본 invariant 는 README L83–86 의 명시 정책 ("본인 self-demote 금지") 의 박제로, 시스템에 SuperAdmin 이 0 명 남는 상황을 사전 차단.

## 8. Postconditions

본 UC 는 **write operation** 이므로 시스템 상태 변경이 발생한다. main flow 가 종료된 후의 시스템 상태:

- **User row CRUD 완료** — PersistenceModule 의 User 테이블에 row 가 insert (사용자 추가) 또는 update (등급 변경 / Password 변경) 됨. Password 는 hash 저장 (schema-level 강제, hash 알고리즘은 P3 의 별도 ADR 책임).
- **응답 layer 의 hashedPassword 누출 차단** — UserResponseDto (T-0095 박제 — private constructor + fromEntity static factory + 5 readonly 필드 id/email/role/createdAt/updatedAt) 가 HTTP 응답 body 의 whitelist 강제, Prisma User entity 의 hashedPassword 컬럼 응답 누출 0. defence in depth 2 layer 박제 — DB-level bcrypt 10 rounds (T-0092 박제) + HTTP-layer UserResponseDto whitelist (T-0095 박제), ADR-0008 §6 application-layer last-mile 완결 cross-ref.
- **등급 변경 시 즉시 발효** — 변경된 사용자의 다음 API 호출부터 새 등급 적용. session / JWT invalidation 의 구체 mechanism (현 session 강제 종료 / 재로그인 요구 / claim refresh) 은 P3 의 책임.
- **첫 로긴 trigger 의 경우 User 테이블에 SuperAdmin row 1 개 영구 생성** — 이후 동일 trigger 재발화 불가 (§6.1).
- **Audit log 1 row 생성** — 작업 종류 (USER_CREATE / ROLE_CHANGE / PASSWORD_CHANGE) + actor + target user + before/after role + timestamp 박제 (감사 추적 목적). 구체 schema 는 P3 data-model.md 의 책임 — 본 UC 는 "Audit log 1 row 생성" 까지만.
- **NFR** — 본 UC 의 write 흐름은 일반적 CRUD 의 reasonable 응답 시간. 구체 SLA 는 README 명시 없음 — [REQ-048](../requirements.md) 의 3 초는 read ([UC-02](UC-02-evaluation-query.md)) 한정.

## 9. Component / Module mapping

본 UC 가 거치는 3 component + 4 module ([INDEX.md](INDEX.md) UC-04 row 와 정확히 일치). 각 component 의 본 UC 에서의 책임은 1 줄로 한정.

| component (T-A3) | module (T-A4) | 본 UC 에서의 책임 |
| --- | --- | --- |
| Web UI | WebModule | 로그인 화면 + 사용자 관리 화면 SPA — 사용자 표 / 추가·등급 변경 form / Password 변경 form (REQ-043, REQ-044). |
| Backend API | AuthModule (guard + service) + UserModule (controller + service) | `POST /api/users` / `PATCH /api/users/:id/role` / `PATCH /api/users/:id/password` endpoint 노출 + 인증·권한 guard + payload 검증 + invariant enforcement (REQ-043, REQ-044). **AuthModule 의 service layer (사용자·등급 CRUD) 가 본 UC 의 중심** — 다른 UC 는 AuthModule 의 guard 만 사용. |
| DB Persistence | PersistenceModule | User row CRUD + Password hash 저장 + Audit log row insert (REQ-043, REQ-044). |

본 UC 에서 거치지 않는 5 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway) + 5 module (SchedulerModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule) 의 책임 위임:

- **Scheduler / SchedulerModule** — [UC-01](UC-01-evaluation-execution.md) (cron trigger) 의 책임. 본 UC 는 Actor 의 동기 write 흐름이므로 cron 발화 없음.
- **Worker / AssessmentModule** — UC-01 의 책임. 본 UC 는 사용자 계정 CRUD 만이므로 평가 파이프라인과 무관.
- **GitHub Adapter / Confluence Adapter / LLM Gateway** + 대응 module — UC-01 의 책임. 본 UC 는 외부 시스템 호출 없음.

## 10. 관련 REQ

본 UC 가 cover 하는 2 primary REQ + 2 인접 REQ. 각 REQ 가 본 UC 의 어느 section/step 에서 cover 되는지 명시.

| REQ | 요약 | 본 UC 의 cover 위치 |
| --- | --- | --- |
| REQ-043 | 모든 기능 ID/Password 보호 | §1 / §3 trigger 2–4 / §4 precondition 3 / §5 step 3 / §7.1 / §7.3 / §9 AuthModule |
| REQ-044 | SuperAdmin 첫 로긴 + 3 등급 + 승급·강등 규칙 + self-demote 금지 | §1 / §2 actor / §3 trigger 1, 3 / §4 precondition 2, 3 / §5 step 4 / §6.1 / §6.2 / §6.3 / §7.2 / §7.5 / §9 AuthModule |
| REQ-045 (인접) | Admin 권한 (인원 편집 / Group 편집 포함) | §2 actor — 본 UC 는 Admin 의 사용자 추가 / User→Admin 승급 권한 박제 (인원 편집 권한은 [UC-03](UC-03-person-crud.md) 의 책임) |
| REQ-046 (인접) | User read-only 권한 | §2 actor — 본 UC 는 User 의 본인 Password 변경 외 모든 write 차단 박제 (read-only 의 구체 범위는 [UC-02](UC-02-evaluation-query.md) 의 책임) |

본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 추가 0 — [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 의 4 항목 (happy / error / branch / negative) 모두 N/A. mermaid sequence 의 alt block 2 개 가 §6.1 첫 로긴 SuperAdmin 자동 지정 분기 + §7.3 검증 실패 분기를 박제하며, error flow 5 종 (§7.1~§7.5) 이 인증 실패 / 권한 부족 / payload 검증 실패 / DB write fail / SuperAdmin self-demote 차단의 negative path 를 cover.

## 11. References

- [docs/use-cases/INDEX.md](INDEX.md) — UC-04 row 의 source. 본 UC 의 §9 mapping 이 INDEX.md 의 "주요 component / 주요 module" 컬럼과 정확히 일치.
- [docs/use-cases/UC-01-evaluation-execution.md](UC-01-evaluation-execution.md) / [UC-02-evaluation-query.md](UC-02-evaluation-query.md) / [UC-03-person-crud.md](UC-03-person-crud.md) — 앞선 3 UC 본문 template. UC-03 는 Person (평가 대상 인원) vs User (로그인 계정) 의 conceptual 분리.
- [docs/architecture/components.md](../architecture/components.md) / [modules.md](../architecture/modules.md) / [INDEX.md](../architecture/INDEX.md) — 본 UC §9 가 거치는 3 component + 4 module 의 source + MVA style.
- [docs/requirements.md](../requirements.md) — 본 UC 의 2 primary REQ + 2 인접 REQ row 의 source.
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) / [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — PostgreSQL + Prisma + monolithic NestJS process — 본 UC 의 persistence + hop 1 의 근거.
- [README.md](../../README.md) L43–58 (Person vs User 구분 맥락) / L83–86 (3 권한 등급 + SuperAdmin 첫 로긴 + 승급·강등 규칙 + ID/Password 보호 — 본 UC 의 핵심 source).
- [docs/tasks/T-0024-uc-04-account-auth.md](../tasks/T-0024-uc-04-account-auth.md) — 본 UC 의 분해 task. [T-0023](../tasks/T-0023-uc-03-person-crud.md) — 직전 UC-03 task (본 UC 의 template).

Refs: T-0024, T-0023, T-0022, T-0020, T-0019, T-0016, T-0017, ADR-0002, ADR-0003, REQ-043, REQ-044, REQ-045, REQ-046

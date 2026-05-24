---
id: T-0024
title: P2-UC-04 — 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급) use case 분해 (docs/use-cases/UC-04-account-auth.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044]
estimatedDiff: 140
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 네번째 UC 본문 분해 (UC-04 권한·계정). UC-03 직후 자연 페어 — UC-03 평가 대상 인원 vs UC-04 로그인 계정. T-0023 template 적용.
dependsOn: [T-0019, T-0023]
blocks: []
hqOrigin: null
---

# T-0024 — P2-UC-04: 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급) use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 본문 ([T-0022](T-0022-uc-02-evaluation-query.md))** + **UC-03 본문 ([T-0023](T-0023-uc-03-person-crud.md))** 까지 머지되어 INDEX.md 8 UC backbone + 3 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **UC-04 권한·계정 관리 (SuperAdmin 첫 로긴 / 사용자 추가 / 등급 승급·강등)** 의 본문을 1 파일로 분해한다.

UC-04 는 [README.md](../../README.md) L83-86 "보안 특성" 단락의 핵심 흐름 — 서비스 런칭 후 첫 로긴 사용자가 SuperAdmin 으로 자동 지정, SuperAdmin / Admin / User 의 3 등급 권한 체계, SuperAdmin 이 사용자 추가, Admin 권한자가 User → Admin 승급 가능, Admin → User 강등은 SuperAdmin 만 수행 가능 + SuperAdmin 본인의 self-demote 금지, 모든 기능이 ID/Password 로 보호 — 을 박제한다. UC-04 의 cover REQ 는 2 (REQ-043 모든 기능 ID/Password 보호 / REQ-044 SuperAdmin 첫 로긴 + 3 등급 + 승급·강등 규칙) 로 UC-03 (7 REQ) 보다 짧지만, **UC-01 ~ UC-08 전체의 인증·권한 layer 의 source** 라는 점에서 중요도가 높다 — UC-04 가 정의하는 3 등급이 다른 UC 의 actor 컬럼 (Admin / SuperAdmin / User) 의 의미를 박제한다.

본 task 의 산출물은 (1) UC-04 본문 1 파일, (2) INDEX.md 의 UC-04 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-04 cover marker 추가. T-0020 / T-0022 / T-0023 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 첫 bullet "Use case 발굴" 의 네 번째 UC 본문 분해)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-04 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 두 번째 UC 본문 (template + read flow 의 인증·권한 layer 가 UC-04 와 인접)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — 직전 UC 본문 (template + UC-03 인원 master data 와 UC-04 사용자 계정 의 구분 — Person vs User 의 conceptual 분리)
- [README.md](../../README.md) L43-58 (계정·권한 등급의 맥락 — 평가 대상 인원 단락과 보안 단락의 분리), L83-86 (3 권한 등급 + SuperAdmin 첫 로긴 + 승급·강등 규칙 + ID/Password 보호 — UC-04 의 핵심 source)
- [docs/architecture/components.md](../architecture/components.md) — UC-04 가 거치는 3 component (Web UI / Backend API / DB Persistence) 의 책임 + contract 정의 (오타 0 인용)
- [docs/architecture/modules.md](../architecture/modules.md) — UC-04 가 거치는 4 module (WebModule / AuthModule / UserModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-04 의 2 primary REQ (REQ-043 ID/Password 보호 / REQ-044 SuperAdmin 첫 로긴 + 3 등급 + 승급·강등 규칙) + 인접 REQ (REQ-045 Admin 권한 / REQ-046 User read-only)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (사용자 계정 / 권한 등급의 persistence layer 기반)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS + AuthModule guard layer (UC-04 의 hop 수에 영향)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0023-uc-03-person-crud.md](T-0023-uc-03-person-crud.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-04 본문 파일 신설

- [ ] `docs/use-cases/UC-04-account-auth.md` 신설. 한국어 본문 ≥ 70 줄 / ≤ 180 줄 (overly detailed 회피, MVA 원칙 — UC-04 는 REQ 2 개로 UC-03 보다 짧음). 다음 section 을 본 순서로 포함 (T-0020/T-0022/T-0023 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-04`, `title: 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)`, `actor: SuperAdmin / Admin`, `trigger: 서비스 첫 로긴 (SuperAdmin 자동 지정) 또는 SuperAdmin/Admin 이 Web UI 사용자 관리 화면에서 사용자 추가/등급 변경/Password 변경`, `status: DONE`, `coversReq: [REQ-043, REQ-044]`, `adjacentReq: [REQ-045, REQ-046]`, `relatedUc: [UC-01, UC-02, UC-03, UC-05, UC-06, UC-07, UC-08]`, `sourceTask: T-0024`.
  - **1. 개요** — 1~2 단락. UC-04 의 본질 (로그인 계정의 master data + 3 등급 권한 체계의 박제) + README L83-86 인용 + UC-03 (평가 대상 인원 master data) 와의 구분 (Person 은 평가 대상자, User 는 로그인 가능 계정 — 두 entity 별개) 명시. UC-04 가 정의하는 3 등급이 UC-01 ~ UC-08 의 모든 actor 컬럼의 의미를 박제하는 source 임을 짧게 언급.
  - **2. Actor** — SuperAdmin / Admin (REQ-044). 표 형식. 각 등급의 권한 boundary 명시 — SuperAdmin: 모든 권한 + Admin→User 강등 + 사용자 추가, Admin: User→Admin 승급 + 사용자 추가 (등급 변경 권한은 강등 제외), User: 본 UC 의 actor 아님 (REQ-046 — read-only).
  - **3. Trigger** — 4 sub-trigger 가 동일 main flow 로 수렴: (a) 서비스 첫 로긴 — 자동 SuperAdmin 지정 (런칭 후 1 회만 발화), (b) 사용자 추가 (SuperAdmin / Admin), (c) 등급 변경 (User→Admin 승급 = Admin 이상 / Admin→User 강등 = SuperAdmin 한정), (d) 본인 Password 변경 (모든 등급) — UC-04 의 부수 흐름.
  - **4. Preconditions** — DB Persistence 가용, AuthModule guard 동작. (a) 첫 로긴 trigger 의 precondition 은 "User 테이블 비어 있음", (b)~(d) 의 precondition 은 "인증 완료 + 본 작업에 해당 등급 권한 보유". 본인 self-demote 금지 invariant (REQ-044) 는 §7 의 error flow.
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Actor (SuperAdmin/Admin) / WebUI / BackendAPI / AuthModule / UserModule / PersistenceModule. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. Actor 가 Web UI 사용자 관리 화면 접근, action 선택 (사용자 추가 / 등급 변경 / Password 변경)
    2. WebUI → BackendAPI write 요청 (POST /api/users / PATCH /api/users/:id/role / PATCH /api/users/:id/password 등)
    3. AuthModule guard 가 인증 검증 (REQ-043 — ID/Password)
    4. AuthModule guard 가 권한 검증 (REQ-044 — action 별 최소 등급: 사용자 추가 = Admin 이상 / User→Admin 승급 = Admin 이상 / Admin→User 강등 = SuperAdmin 한정 / self-demote = 차단)
    5. UserModule service 가 request payload 검증 (등급 enum 유효 / Password 강도 / username 중복 / target user 존재 / self-demote invariant)
    6. PersistenceModule 이 User row CRUD (Password 는 hash 저장 — schema-level 강제, hash 알고리즘 P3 ADR 책임)
    7. UserModule → BackendAPI 결과 응답
    8. BackendAPI → WebUI JSON 응답
    9. WebUI 가 Actor 에게 결과 표시 (성공 / 검증 실패 / 권한 부족)
  - **6. Alternative flows** — (6.1) **서비스 첫 로긴 (SuperAdmin 자동 지정)**: User 테이블이 비어 있을 때 첫 로그인 시도 사용자가 SuperAdmin 등급으로 자동 생성 (REQ-044) — main flow 와 분리된 별도 트리거 (트리거 표시 + invariant 만, 구체 흐름은 P3 의 책임). (6.2) **User→Admin 승급 (Admin 이상)**: Admin 또는 SuperAdmin 이 본 작업 수행 가능, target user 는 현재 등급 User. (6.3) **Admin→User 강등 (SuperAdmin 한정)**: SuperAdmin 만 수행 가능, target user 는 현재 등급 Admin, SuperAdmin 본인이 self 인 경우 §7.5 로 차단. (6.4) **본인 Password 변경**: 모든 등급이 본인 Password 변경 가능 — 권한 검증 단순 (인증된 self).
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 401 → WebUI login redirect. (7.2) **권한 부족** (REQ-044): User 가 사용자 추가/등급 변경 시도, Admin 이 Admin→User 강등 시도 → 403 + "권한 부족" 안내. (7.3) **payload 검증 실패**: 등급 enum 잘못 / Password 강도 부족 / username 중복 / target user 부재 → 400 + 검증 메시지. (7.4) **DB write fail**: PersistenceModule connection 끊김 / unique constraint 위반 → 5xx → WebUI 재시도 안내. (7.5) **SuperAdmin self-demote 시도** (REQ-044 invariant): SuperAdmin 본인의 등급을 Admin/User 로 변경 시도 → 403 + "SuperAdmin 본인 등급 변경 불가" 안내 (REQ-044 의 명시 invariant).
  - **8. Postconditions** — write operation 이므로 시스템 상태 변경 발생: (a) User row CRUD 완료 (Password 는 hash 저장), (b) 등급 변경 시 즉시 발효 — 변경된 사용자의 다음 API 호출부터 새 등급 적용, (c) Audit log 1 row 생성 (작업 종류 + actor + target user + before/after role + timestamp — 구체 schema 는 P3 data-model.md 책임), (d) 첫 로긴 trigger 의 경우 User 테이블에 SuperAdmin row 1 개 영구 생성 — 이후 동일 trigger 재발화 불가, (e) NFR: 본 UC 의 write 흐름은 일반적 CRUD 의 reasonable 응답 시간 (구체 SLA 는 README 명시 없음 — REQ-048 의 3 초는 read 한정).
  - **9. Component / Module mapping** — 본 UC 가 거치는 3 component + 4 module (INDEX.md 의 UC-04 row 와 정확 일치 — Web UI / Backend API / DB Persistence + WebModule / AuthModule / UserModule / PersistenceModule). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 5 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway) + 5 module (SchedulerModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule) 의 위임 표시. **AuthModule 의 본 UC 에서의 중심 역할**: 다른 UC 가 AuthModule 을 "guard 호출 의 wrapper" 로만 사용한다면 UC-04 는 AuthModule 의 service layer (사용자·등급 CRUD) 까지 활용.
  - **10. 관련 REQ** — 2 primary REQ + 2 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0002 / ADR-0003 / README L43-58, L83-86 / UC-01·UC-02·UC-03 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-04 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-04 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-04 description 단락 (§3 의 UC-04 단락) 의 끝에 `→ [UC-04-account-auth.md](UC-04-account-auth.md)` link 추가 (UC-01 / UC-02 / UC-03 row 의 동일 pattern).
- [ ] Refs 라인의 끝에 `T-0024` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) L82 의 첫 bullet `[~]` 본문에 "UC-04 본문 분해 ([UC-04-account-auth.md](use-cases/UC-04-account-auth.md), T-0024) 완료" 한 줄 inline append.
- [ ] L83 의 "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" bullet 끝에 "UC-04 cover ([UC-04](use-cases/UC-04-account-auth.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 / UC-02 / UC-03 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (SuperAdmin / Admin / WebUI / BackendAPI / AuthModule / UserModule / PersistenceModule). Actor 는 SuperAdmin 또는 Admin 둘 중 하나로 단순화 가능 (sequence 안에서 alt block 으로 분기).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over AuthModule: action 별 최소 등급 검증 (REQ-044)`).
- [ ] `alt` block 으로 §6.1 (첫 로긴 SuperAdmin 자동 지정) 또는 §7.5 (SuperAdmin self-demote 차단) 분기 표시 — main flow 안에 통합.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 / T-0023 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 140 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-04 는 2 REQ 로 UC-03 (7 REQ) 보다 짧음. 본문 ≤180 LOC 의 가이드 안에서.
- [ ] 변경 파일: `docs/use-cases/UC-04-account-auth.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-04 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019/T-0020/T-0021/T-0022/T-0023 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (5번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-04 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-05 ~ UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-04 만 cover. (T-0020 / T-0022 / T-0023 template, 본 task 는 네 번째 적용 — 후속 4 UC 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 write endpoint (예: `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/password`) 와 entity column (User 의 username / password_hash / role / created_at) 은 후속 api.md / data-model.md 의 row.
- **사용자 / 권한 등급 의 실제 controller / service / DB schema 구현** — P3 (Domain core) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P3.
- **User entity 의 ERD / 컬럼 / 인덱스 / Password hash 알고리즘 선정** — P3 data-model.md + 별도 ADR 책임. 본 UC 는 conceptual level 만 (username / role enum / password_hash 의 존재).
- **인증 흐름 detail (session vs JWT / cookie 정책 / CSRF / rate limit)** — P3 의 별도 ADR. 본 UC 의 §5 step 3 은 "AuthModule guard 가 인증 검증" 의 conceptual level 만, 구체 mechanism 은 P3.
- **Audit log schema** (사용자 변경 기록) — P3 의 data-model.md 책임. 본 UC §8 postcondition 은 "Audit log 1 row 생성" 까지만.
- **Password 강도 정책 / 정책 위반 시 메시지** — P3 의 service layer 구현 책임. 본 UC §7.3 는 "강도 부족" 의 conceptual level 만.
- **첫 로긴 SuperAdmin 자동 지정 의 race condition 처리** (두 사용자가 동시 첫 로긴 시도) — P3 의 service layer 책임. 본 UC §6.1 는 invariant 만 (User 테이블이 비어 있을 때 1 회만 발화).
- **사용자 관리 화면의 구체 UI / 컴포넌트 / form 검증** — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **외부 SSO / LDAP 통합** — README 명시 없음. 본 UC 는 local username/password 만 cover. 별도 ADR / 별도 UC 필요 시 후속.
- **사용자 삭제 흐름** — README L83-86 명시 없음 (등급 변경만 언급). 본 UC 는 추가 / 등급 변경 / Password 변경 만 cover. 사용자 삭제는 별도 결정.
- **UC-03 의 Person (평가 대상 인원) 과 UC-04 의 User (로그인 계정) 의 관계 매핑** — 두 entity 가 별도임을 §1 에서 명시하지만 구체 mapping (한 Person 이 동시에 User 일 수 있나?) 은 P3 의 data-model.md / 별도 ADR.
- **T-0017~T-0023 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-04 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-03 본문 의 §5 sequence diagram style 그대로 적용. 본 UC 의 4 sub-trigger (첫 로긴 / 사용자 추가 / 등급 변경 / Password 변경) 와 4 alt flow (첫 로긴 SuperAdmin 자동 지정 / User→Admin 승급 / Admin→User 강등 SuperAdmin 한정 / Password 변경) 를 어떻게 sequence 1 개로 통합할지 결정 (T-0023 의 main flow + alt block 통합 pattern 적용). 본 UC 의 핵심 invariant 인 "SuperAdmin self-demote 금지" 를 §7.5 의 error flow 로 단단히 박제. 산출물: UC-04-account-auth.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-04-account-auth.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 §6.1 첫 로긴 자동 지정 또는 §7.5 self-demote 차단 분기 표시). T-0020 / T-0022 / T-0023 의 frontmatter / section 순서 / Refs 라인 style 정확 일치.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-04-*.md ↔ PLAN.md ↔ UC-01-*.md / UC-02-*.md / UC-03-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

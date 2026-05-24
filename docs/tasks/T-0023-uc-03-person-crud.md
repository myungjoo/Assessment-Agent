---
id: T-0023
title: P2-UC-03 — 평가 대상 인원 CRUD + Group/파트 + Activate/Deactivate use case 분해 (docs/use-cases/UC-03-person-crud.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-045]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 세번째 UC 본문 분해 (UC-03 인원 CRUD). UC-04/UC-05 동일 template 후속 큐잉 예정. T-0020/T-0022 template 적용.
dependsOn: [T-0019, T-0022]
blocks: []
hqOrigin: null
---

# T-0023 — P2-UC-03: 평가 대상 인원 CRUD + Group/파트 + Activate/Deactivate use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 본문 ([T-0022](T-0022-uc-02-evaluation-query.md))** 이 모두 머지되어 INDEX.md 8 UC backbone + 2 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **UC-03 평가 대상 인원 CRUD + Group/파트 + Activate/Deactivate** 의 본문을 1 파일로 분해한다.

UC-03 은 [README.md](../../README.md) L36-58 "평가 대상 인원" 단락의 핵심 흐름 — Admin 이 Web UI 의 인원 관리 화면에서 평가 대상 인원의 추가·수정·삭제·Deactivate·Activate, 한 인원이 N 서비스 ID (github.com / github.sec / github.ecode / confluence.sec) 를 가지며 일부 NULL 허용, primary key 역할 ID 1 개 지정, Group 정책 (다중 임의 group + 단일 조직도 파트), 휴직 시 Deactivate 로 평가 대상자 명단에서 숨김 — 을 박제한다. UC-03 의 cover REQ 는 7 (REQ-023 서비스별 ID 매핑 / REQ-024 primary key 역할 ID / REQ-025 일부 NULL / REQ-026 CRUD + Deactivate/Activate / REQ-027 신규 인원 1년치 평가 / REQ-028 Group 정책 / REQ-045 Admin 권한) 이며, UC-01 / UC-02 의 평가 실행·조회 흐름이 모두 본 UC 가 관리하는 인원 데이터 위에서 동작한다 — **3 UC 가 P2 의 core triad** (실행 → 조회 → 인원 관리).

본 task 의 산출물은 (1) UC-03 본문 1 파일, (2) INDEX.md 의 UC-03 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-03 cover marker 추가. T-0020 / T-0022 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 첫 bullet "Use case 발굴" 의 세 번째 UC 본문 분해)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-03 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 직전 UC 본문 (template + UC-02 와 UC-03 의 관계: UC-02 가 인원 데이터를 read, UC-03 이 인원 데이터를 write)
- [README.md](../../README.md) L36-58 ("평가 대상 인원" 단락 — N 서비스 ID 매핑 / primary key 역할 ID / NULL 허용 / CRUD / Deactivate / Group 정책 / 신규 인원 1년치 평가), L83-86 (3 권한 등급 — Admin 이 본 UC actor), L85 (Admin 권한 — 인원 편집 / Group 편집 포함)
- [docs/architecture/components.md](../architecture/components.md) — UC-03 가 거치는 3 component (Web UI / Backend API / DB Persistence) 의 책임 + contract 정의 (오타 0 인용)
- [docs/architecture/modules.md](../architecture/modules.md) — UC-03 가 거치는 4 module (WebModule / UserModule / AuthModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-03 의 7 primary REQ (REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-045) + 인접 REQ (REQ-043 인증 / REQ-044 권한 등급)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (인원 CRUD 의 persistence layer 기반)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS (UC-03 의 hop 수에 영향)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0022-uc-02-evaluation-query.md](T-0022-uc-02-evaluation-query.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-03 본문 파일 신설

- [ ] `docs/use-cases/UC-03-person-crud.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 200 줄 (overly detailed 회피, MVA 원칙). 다음 section 을 본 순서로 포함 (T-0020/T-0022 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-03`, `title: 평가 대상 인원 CRUD + Group/파트 + Activate/Deactivate`, `actor: Admin`, `trigger: Web UI 인원 관리 화면에서 인원 추가/수정/삭제/Activate/Deactivate/Group 편집`, `status: DONE`, `coversReq: [REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-045]`, `adjacentReq: [REQ-043, REQ-044]`, `relatedUc: [UC-01, UC-02, UC-04, UC-07]`, `sourceTask: T-0023`.
  - **1. 개요** — 1~2 단락. UC-03 의 본질 (인원 master data 의 CRUD + Group/파트 + Activate/Deactivate) + README L36-58 인용 + UC-01/UC-02 와의 관계 (인원 데이터가 두 UC 의 master data) 명시.
  - **2. Actor** — Admin / SuperAdmin (REQ-045 — Admin 권한 / SuperAdmin 은 Admin 의 super set). User 는 본 UC 의 actor 아님 (REQ-046 read-only). 표 형식.
  - **3. Trigger** — Web UI 인원 관리 화면 진입 후 (a) 인원 추가 / (b) 인원 수정 (서비스 ID·primary ID·Group/파트) / (c) 인원 삭제 / (d) Deactivate / (e) Activate / (f) Group 편집 — 6 sub-trigger 가 동일 main flow 로 수렴, write 종류만 다름.
  - **4. Preconditions** — 인증 완료 (REQ-043), 사용자 등급 = Admin or SuperAdmin (REQ-044, REQ-045), DB Persistence 가용. (CRUD 시 추가 precondition 은 §6 / §7 의 alt/error flow 에서.)
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Admin / WebUI / BackendAPI / AuthModule / UserModule / PersistenceModule. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. Admin 이 Web UI 인원 관리 화면 접근, action 선택 (추가/수정/삭제/Deactivate/Activate)
    2. WebUI → BackendAPI write 요청 (POST/PUT/DELETE /api/persons 등)
    3. AuthModule guard 가 인증·권한 검증 (REQ-043, REQ-044, REQ-045 — Admin 이상)
    4. UserModule service 가 request payload 검증 (서비스 ID 매핑 — REQ-023, primary key 역할 ID 1개 지정 — REQ-024, 일부 NULL 허용 — REQ-025, Group 정책 — REQ-028)
    5. PersistenceModule 이 Person/ServiceIdentity/Group/Part row CRUD (Deactivate 는 soft delete flag — REQ-026)
    6. (신규 인원 추가 시) UserModule 이 1년치 평가 1회 trigger 를 SchedulerModule/AssessmentModule 에 emit (REQ-027 — 별도 흐름)
    7. UserModule → BackendAPI 결과 응답
    8. BackendAPI → WebUI JSON 응답
    9. WebUI 가 Admin 에게 결과 표시 (성공 / 검증 실패 / 권한 부족)
  - **6. Alternative flows** — (6.1) **Deactivate vs Delete 의 차이 (REQ-026)**: Deactivate 는 soft (평가 대상 명단에서 숨김, 기존 평가 데이터 보존), Delete 는 hard (참조 무결성 cascade 정책은 P3 data-model.md 책임). (6.2) **primary key 역할 ID 변경 (REQ-024)**: 기존 primary ID 로 박제된 평가 데이터의 ID 재매핑 정책 — 본 UC 는 "변경 허용 + 기존 평가 데이터 보존" 의 conceptual level 만, 구체 마이그레이션 흐름은 P3. (6.3) **신규 인원 추가 시 1년치 평가 1회 (REQ-027)**: 일반 인원의 매일 1주일 단위 평가와 분리된 별도 trigger — UserModule 이 AssessmentModule 에 emit, 본 UC 는 trigger 발화까지만 cover, 실제 평가 흐름은 UC-01 의 책임. (6.4) **Group 편집 (REQ-028)**: 다중 임의 group N 개 + 단일 조직도 파트 1 개 의 invariant 검증 — 파트 0 개 또는 2 개 이상이면 §7.5.
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 401 → WebUI login redirect. (7.2) **권한 부족** (REQ-045): User 등급이 본 UC 호출 시 403 → WebUI 가 "Admin 권한 필요" 안내. (7.3) **서비스 ID 매핑 검증 실패** (REQ-023, REQ-024, REQ-025): 4 서비스 ID 모두 NULL / primary key 역할 ID 가 NULL / primary ID 가 중복 → 400 + 검증 메시지. (7.4) **DB write fail**: PersistenceModule connection 끊김 / unique constraint 위반 / transaction rollback → 5xx → WebUI 재시도 안내. (7.5) **Group 정책 위반** (REQ-028): 조직도 파트 0 개 또는 2 개 이상 → 400 + "조직도 파트는 정확히 1 개" 안내.
  - **8. Postconditions** — write operation 이므로 시스템 상태 변경 발생: (a) Person/ServiceIdentity/Group/Part row CRUD 완료, (b) Deactivate 시 평가 대상 명단에서 숨김 (UC-01 의 다음 cron 발화 시 본 인원 제외), (c) Activate 시 다시 평가 대상에 포함, (d) 신규 인원 추가 시 1년치 평가 1회 trigger 가 SchedulerModule queue 에 enqueue, (e) Audit log 1 row 생성 (변경 종류 + admin user + timestamp + before/after — 구체 schema 는 P3 data-model.md 책임), (f) NFR: 본 UC 의 write 흐름은 일반적 CRUD 의 reasonable 응답 시간 (구체 SLA 는 README 명시 없음 — REQ-048 의 3 초는 read 한정).
  - **9. Component / Module mapping** — 본 UC 가 거치는 3 component + 4 module (INDEX.md 의 UC-03 row 와 정확 일치). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 5 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway) + 5 module (SchedulerModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule) 의 위임 표시. AssessmentModule 은 §6.3 의 신규 인원 1년치 평가 emit 의 receiver 로만 인접 (직접 호출 없음 — event 기반).
  - **10. 관련 REQ** — 7 primary REQ + 2 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0002 / ADR-0003 / README L36-58, L83-86 / UC-01·UC-02 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-03 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-03 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-03 description 단락 (§3 의 UC-03 단락) 의 끝에 `→ [UC-03-person-crud.md](UC-03-person-crud.md)` link 추가 (UC-01 / UC-02 row 의 동일 pattern).
- [ ] Refs 라인의 끝에 `T-0023` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) L82 의 첫 bullet `[~]` 본문에 "UC-03 본문 분해 ([UC-03-person-crud.md](use-cases/UC-03-person-crud.md), T-0023) 완료" 한 줄 inline append.
- [ ] L83 의 "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" bullet 끝에 "UC-03 cover ([UC-03](use-cases/UC-03-person-crud.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 / UC-02 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (Admin / WebUI / BackendAPI / AuthModule / UserModule / PersistenceModule).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over UserModule: 서비스 ID 매핑·primary key·Group 검증 (REQ-023, REQ-024, REQ-025, REQ-028)`).
- [ ] `alt` block 으로 §6.3 (신규 인원 추가 시 1년치 평가 trigger) 또는 §6.1 (Deactivate vs Delete) 분기 표시 — main flow 안에 통합.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 180 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. T-0022 review 의 estimatedDiff 가이드 초과 MINOR 를 본 task 에서 동일 패턴으로 흡수 — 본문 ≤200 LOC / 변경 파일 3 의 가이드 안에서. UC-03 은 7 REQ (UC-02 의 4 REQ + 인접 3 보다 많음) 라서 본문 길이 UC-02 (179 LOC) 보다 약간 큼.
- [ ] 변경 파일: `docs/use-cases/UC-03-person-crud.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-03 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019/T-0020/T-0021/T-0022 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (4번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-03 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-04 ~ UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-03 만 cover. (T-0020 / T-0022 template, 본 task 는 세 번째 적용 — 후속 5 UC 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 write endpoint (예: `POST /api/persons`, `PATCH /api/persons/:id`, `DELETE /api/persons/:id`) 와 entity column (Person / ServiceIdentity / Group / Part) 은 후속 api.md / data-model.md 의 row.
- **인원 CRUD 의 실제 controller / service / DB schema 구현** — P3 (Domain core) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P3.
- **Person / ServiceIdentity / Group / Part 의 ERD / 컬럼 / 인덱스** — P3 data-model.md 책임. 본 UC 는 conceptual level 만 (4 서비스 ID + primary key 역할 ID + Group N + Part 1).
- **신규 인원 추가 시 1년치 평가 1회 (REQ-027) 의 실제 cron / queue / worker 구현** — P7 (Scheduling) 의 책임. 본 UC §6.3 은 trigger 발화까지만.
- **Audit log schema** (변경 기록) — P3 의 data-model.md 책임. 본 UC 의 §8 postcondition 은 "Audit log 1 row 생성" 까지만.
- **Deactivate / Delete 의 참조 무결성 cascade 정책 (Person → Assessment row 의 cascade vs restrict)** — P3 data-model.md 책임. 본 UC §6.1 는 conceptual level 만.
- **primary key 역할 ID 변경 (REQ-024) 의 마이그레이션 흐름** (기존 평가 데이터의 ID 재매핑) — P3 의 별도 ADR. 본 UC §6.2 는 "변경 허용 + 기존 평가 데이터 보존" 의 conceptual level 만.
- **인원 관리 화면의 구체 UI / 컴포넌트 / form 검증** — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **Import / Export 흐름** — UC-07 의 책임. 본 UC 는 인원 master data 의 CRUD 만 cover.
- **3 권한 등급의 사용자 자체 CRUD (Admin 추가 / 등급 승급)** — UC-04 (권한·계정 관리) 의 책임. 본 UC 는 평가 대상 **인원** 의 master data 만 — 사용자 (login 가능 계정) 의 CRUD 와 구분 (README L86 의 User read-only 와 별개 개념).
- **T-0017~T-0022 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-03 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README L36-58 + L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-02 본문 의 §5 sequence diagram style 그대로 적용. 본 UC 의 6 sub-trigger (추가/수정/삭제/Deactivate/Activate/Group 편집) 와 4 alt flow (Deactivate vs Delete / primary key 변경 / 신규 인원 1년치 평가 / Group 정책 invariant) 를 어떻게 sequence 1 개로 통합할지 결정 (T-0022 의 main flow + alt block 통합 pattern 적용). 산출물: UC-03-person-crud.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-03-person-crud.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 §6.3 신규 인원 1년치 평가 trigger 또는 §6.1 Deactivate vs Delete 분기 표시). T-0020 / T-0022 의 frontmatter / section 순서 / Refs 라인 style 정확 일치.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-03-*.md ↔ PLAN.md ↔ UC-01-*.md / UC-02-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

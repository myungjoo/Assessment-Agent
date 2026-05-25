---
id: T-0027
title: P2-UC-07 — Export / Import / Backup / Restore use case 분해 (docs/use-cases/UC-07-export-import.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 일곱번째 UC 본문 분해 (UC-07 Export/Import/Backup/Restore). raw 미저장 정책 (REQ-032) 하에서 평가 결과 dump/load 흐름 박제 — Admin 권한 한정.
dependsOn: [T-0019, T-0026]
blocks: []
hqOrigin: null
---

# T-0027 — P2-UC-07: Export / Import / Backup / Restore use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 본문 ([T-0022](T-0022-uc-02-evaluation-query.md))** + **UC-03 본문 ([T-0023](T-0023-uc-03-person-crud.md))** + **UC-04 본문 ([T-0024](T-0024-uc-04-account-auth.md))** + **UC-05 본문 ([T-0025](T-0025-uc-05-llm-config.md))** + **UC-06 본문 ([T-0026](T-0026-uc-06-evaluation-delete-reeval.md))** 까지 머지되어 INDEX.md 8 UC backbone + 6 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **UC-07 Export / Import / Backup / Restore** 의 본문을 1 파일로 분해한다.

UC-07 는 [README.md](../../README.md) "평가 자료의 저장" 단락의 핵심 — Admin 이 저장된 평가 자료 (raw 미포함, **REQ-032**) 를 **Export** 하여 backup 하고 **Import / Restore** 로 reset 할 수 있다 (**REQ-030**) — 의 박제다. **UC-07 의 본질**: (a) **raw 미저장 정책 (REQ-032) 의 invariant 가 Export payload 에 자연 전파** — Export 가 dump 하는 것은 평가 결과 / 인원 master / Group / LLM 설정 / Audit log 까지 (Assessment row, Person row, Group row, LLMConfig row, AuditLog row 등) 이고 raw GitHub commit · Confluence 문서는 처음부터 DB 에 없으므로 자연히 제외됨. Export 산출물의 schema·포맷은 P3 data-model.md 책임. (b) **dump/load 의 대칭 흐름** — Export 는 read-only operation (DB → file artifact), Import / Restore 는 destructive write (file artifact → DB, 기존 row 모두 삭제 후 재구성). Restore 의 destructive 측면은 UC-06 의 Reset & Reeval 과 유사하나 차이점: UC-06 은 평가 결과만 삭제 + 재수집 trigger, UC-07 Restore 는 평가 결과 + master data + config 까지 file 의 snapshot 으로 복원. (c) **Admin 권한 한정 (REQ-045)** — Export · Import 모두 Admin 의 권한 집합 중 하나. SuperAdmin 도 수행 가능 (Admin super set). User 는 read-only (REQ-046) 로 본 UC 의 actor 아님. UC-07 의 cover REQ 는 3 (REQ-030 / REQ-032 / REQ-045) 으로 UC-06 와 동일하게 작지만 시스템의 disaster recovery / migration 박제이므로 invariant 가 단단해야 한다 (Export 산출물의 raw 부재 + Restore 의 atomicity + 권한 검증).

본 task 의 산출물은 (1) UC-07 본문 1 파일, (2) INDEX.md 의 UC-07 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-07 cover marker 추가. T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 첫 bullet "Use case 발굴" 의 일곱 번째 UC 본문 분해. PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 로 split 되어 P2 단락 L-number 변경 — 본문 read 시 최신 L-number 사용)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-07 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 두 번째 UC 본문 (template)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — 세 번째 UC 본문 (template + Admin write 흐름의 권한 검증 layer)
- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) — 네 번째 UC 본문 (template + alt block 통합 pattern)
- [docs/use-cases/UC-05-llm-config.md](../use-cases/UC-05-llm-config.md) — 다섯 번째 UC 본문 (template + Admin write 흐름의 권한 검증)
- [docs/use-cases/UC-06-evaluation-delete-reeval.md](../use-cases/UC-06-evaluation-delete-reeval.md) — 직전 UC 본문 (template + destructive write 흐름 + 강한 confirmation dialog 패턴 + Reset 의 영향 범위 표시 — UC-07 Restore 도 동일 패턴 적용)
- [README.md](../../README.md) "평가 자료의 저장" 단락 ("Admin 이 Export / Import 가능", "raw 데이터 미저장" 의 source) + L83-86 (3 권한 등급 — Admin 이 본 UC actor)
- [docs/architecture/components.md](../architecture/components.md) — UC-07 가 거치는 3 component (Web UI / Backend API / DB Persistence) 의 책임 + contract 정의 (오타 0 인용). Export / Import 가 Backend API 의 dedicated endpoint 를 통과한다는 점 명시.
- [docs/architecture/modules.md](../architecture/modules.md) — UC-07 가 거치는 4 module (WebModule / AssessmentModule / AuthModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-07 의 3 primary REQ (REQ-030 Export/backup + Restore / REQ-032 raw 미저장 + 평가 결과만 보유 / REQ-045 Admin 권한 — 재작성/Reset/Import/Export/인원편집/Group편집) + 인접 REQ (REQ-043 인증 / REQ-044 권한 등급 / REQ-038 평가 결과 schema / REQ-037 Reset & Reeval 참조)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest stack
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (Export / Restore 의 persistence layer 기반 — Prisma client 의 raw dump 또는 model-level dump 의 선택은 P3 data-model.md 책임)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS 운영 토폴로지
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0026-uc-06-evaluation-delete-reeval.md](T-0026-uc-06-evaluation-delete-reeval.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴 + destructive write 흐름의 confirmation dialog 패턴)

## Acceptance Criteria

### 1. UC-07 본문 파일 신설

- [ ] `docs/use-cases/UC-07-export-import.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 180 줄 (overly detailed 회피, MVA 원칙 — UC-07 는 3 REQ 로 UC-06 와 동일 크기 / UC-04 (2 REQ) 와 유사 / UC-05 (7 REQ) 보다 짧다. UC-06 의 177 LOC discipline 동일 적용). 다음 section 을 본 순서로 포함 (T-0020/T-0022/T-0023/T-0024/T-0025/T-0026 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-07`, `title: Export / Import / Backup / Restore`, `actor: Admin`, `trigger: Web UI 평가 자료 관리 화면에서 (a) Export (DB → file artifact 다운로드) 또는 (b) Import / Restore (file artifact 업로드 → DB 복원) 선택`, `status: DONE`, `coversReq: [REQ-030, REQ-032, REQ-045]`, `adjacentReq: [REQ-037, REQ-038, REQ-043, REQ-044]`, `relatedUc: [UC-01, UC-02, UC-06]`, `sourceTask: T-0027`.
  - **1. 개요** — 1~2 단락. UC-07 의 본질 (Export = read-only DB → file dump / Import = destructive write file → DB load 의 대칭 흐름) + README "평가 자료의 저장" 단락 인용 + raw 미저장 정책 (REQ-032) 이 Export payload 에 자연 전파 (raw GitHub commit · Confluence 문서 처음부터 DB 에 없음) + UC-06 Reset & Reeval 과의 차이점 (UC-06 은 평가 결과만 삭제 + 재수집 trigger, UC-07 Restore 는 평가 결과 + master + config snapshot 복원). disaster recovery / migration / staging 환경 seed 등 활용 시나리오.
  - **2. Actor** — Admin (REQ-045 — Import / Export 의 Admin 권한). SuperAdmin 은 Admin super set 으로 본 UC 도 수행 가능. User 는 본 UC 의 actor 아님 (REQ-046 read-only). 표 형식.
  - **3. Trigger** — Web UI 평가 자료 관리 화면 진입 후 다음 sub-trigger:
    - (a) **Export (REQ-030 전반부)** — read-only operation. DB 의 평가 결과 + 인원 master + Group + LLM 설정 + Audit log 의 snapshot 을 file artifact (예: JSON dump / SQL dump / 압축 archive — 구체 포맷은 P3 data-model.md) 로 다운로드. 옵션: 전체 dump 또는 특정 기간 / 특정 인원 / 특정 entity 한정 dump (선택적, 본 UC §6.1 alt flow).
    - (b) **Import / Restore (REQ-030 후반부)** — destructive write operation. file artifact 업로드 → 기존 DB row 모두 삭제 (또는 merge 옵션 — 본 UC §6.2 alt flow) → file 의 snapshot 으로 재구성. 강한 confirmation dialog 필수 (영향 범위 표시 + 사용자 명시 확인).
  - **4. Preconditions** — 인증 완료 (REQ-043), 사용자 등급 = Admin or SuperAdmin (REQ-044, REQ-045), DB Persistence 가용. Import / Restore 의 경우 추가로 (a) 업로드된 file artifact 가 본 시스템의 dump 포맷 (schema version 일치) (b) 진행 중 UC-01 평가 실행 또는 UC-06 destructive operation 없음 (race 정책은 §6.4 alt flow).
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Admin / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. Admin 이 Web UI 평가 자료 관리 화면 접근, action 선택 (Export / Import)
    2. WebUI 가 사용자 확인 dialog 표시 (Export 는 옵션 선택 dialog, Import 는 강한 confirmation — destructive 명시 + 영향 범위 + 기존 데이터 삭제 경고)
    3. WebUI → BackendAPI write 요청 (`GET /api/admin/export?scope=full|range&...` 또는 `POST /api/admin/restore` multipart file upload — 구체 endpoint 는 P2 api.md 책임, 본 UC 는 conceptual level)
    4. AuthModule guard 가 인증·권한 검증 (REQ-043, REQ-044, REQ-045 — Admin 이상)
    5. AssessmentModule service 가 request payload 검증 (Export: scope 옵션 / 기간 / 인원 범위 검증. Import: file artifact 의 schema version 검증 / file 크기 한계 / payload 무결성 hash 검증)
    6. **Export 분기**: PersistenceModule 이 read-only query 로 대상 row 조회 (Assessment + Person + Group + LLMConfig + AuditLog) → AssessmentModule 이 dump format 으로 직렬화 → BackendAPI 가 streaming download 응답 (raw 미저장 — REQ-032 — 으로 raw 는 자연 부재)
    7. **Import 분기**: AssessmentModule 이 transaction 시작 → PersistenceModule 이 기존 row 일괄 삭제 (atomic) → file artifact 의 snapshot 으로 row 재구성 → transaction commit
    8. AssessmentModule 이 audit log 1 row 생성 (Export: 종류 + admin user + scope + row count. Import: 종류 + admin user + file source + 복원된 row count)
    9. AssessmentModule → BackendAPI 결과 응답 (Export: streaming file. Import: 복원 결과 요약 — 복원된 row count + 다음 UC-01 평가 실행 시점)
    10. BackendAPI → WebUI 응답
    11. WebUI 가 Admin 에게 결과 표시 (Export: file 다운로드 완료. Import: 복원 완료 + "다음 평가 진행 시 비어있는 시간 구간 자동 재수집" 안내 — REQ-037 cross-reference)
  - **6. Alternative flows** — (6.1) **Export 의 scope 옵션 (REQ-030 전반부)**: 전체 dump (모든 entity 전 기간) 또는 부분 dump (특정 기간 / 특정 인원 / 특정 entity 선택) — Cartesian product 가능, 본 UC 는 옵션 enum 만 박제, 구체 query 로직은 P5. (6.2) **Import 의 merge 옵션 (REQ-030 후반부)**: replace mode (기존 row 모두 삭제 후 복원, default) vs merge mode (기존 row 보존 + file artifact 의 row 추가, conflict 시 file 우선 또는 reject — 본 UC 는 옵션 박제만, 구체 conflict resolution 은 P5). (6.3) **schema version 차이**: 업로드된 file 의 schema version 이 현재 시스템 version 과 다를 때 — 두 가지 선택 (사용자 결정 위임): (i) 자동 migration 시도 (P5 의 migration table 책임), (ii) reject + 사용자에게 version mismatch 안내 — 본 UC 는 (ii) default, (i) 는 conceptual level 만. (6.4) **race 감지**: UC-01 평가 실행 또는 UC-06 destructive operation 진행 중 본 UC Import 호출 → 두 가지 선택: (i) 진행 중 작업 완료 후 본 UC 실행 (default), (ii) 진행 중 작업 중단 후 본 UC 실행 — 본 UC §6.3 와 동일 정책, 구체 cancellation protocol 은 P5. (6.5) **부분 Export 후 추후 부분 Import**: Export 된 부분 dump 를 다른 시스템에 Import 시 merge mode 활용 — staging 환경 seed 또는 cross-instance migration 시나리오, 본 UC 는 시나리오 박제만.
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 401 → WebUI login redirect. (7.2) **권한 부족** (REQ-045): User 등급이 본 UC 호출 시 403 → WebUI 가 "Admin 권한 필요" 안내. (7.3) **payload 검증 실패** (REQ-030): Export scope 옵션 부적합 / Import file artifact 의 schema version 부적합 / file 크기 한계 초과 / payload 무결성 hash 검증 실패 → 400 + 검증 메시지. (7.4) **Import file 손상**: 업로드된 file 이 본 시스템의 dump 포맷 아님 또는 partial corruption → 400 + 사용자에게 file 재확인 안내, transaction 시작 전 reject (DB 변경 0). (7.5) **DB write fail (Import)**: PersistenceModule connection 끊김 / transaction rollback → 5xx → WebUI 재시도 안내, transaction atomic 으로 부분 복원 상태 없음 (all-or-nothing). (7.6) **race 감지 후 사용자가 (i) 선택 시 대기**: 진행 중 작업이 비정상 timeout → 본 UC 도 timeout 전파, 사용자에게 재시도 안내.
  - **8. Postconditions** — Export 와 Import 의 분기 별 상태: **Export 경로** — (a) DB 상태 무변화 (read-only operation), (b) Audit log 1 row 생성 (Export 종류 + admin user + scope + row count), (c) Admin 에게 file artifact 전달 완료 (외부 backup 책임은 Admin 의 운영 영역). **Import / Restore 경로** — (a) 기존 DB row 모두 삭제 + file artifact 의 snapshot 으로 재구성 (replace mode default) 또는 merge mode 적용, (b) raw 미저장 정책 (REQ-032) 자연 유지 — file 의 row 가 raw 를 포함하지 않으므로, (c) UC-01 의 다음 발화가 복원된 master + 비어있는 시간 구간을 감지 → 자동 재수집 (REQ-037 cross-reference), (d) UC-02 의 다음 조회는 복원된 평가 결과 표시, (e) Audit log 1 row 생성 (Import 종류 + admin user + file source + 복원된 row count). NFR: 본 UC 의 응답 시간은 dump size 에 비례 (read 한정 SLA REQ-048 의 3 초는 본 UC 의 일반적 dump 에 적용, 대량 dump 는 long-running operation 가능 — async job + status polling 옵션은 P5 의 별도 설계).
  - **9. Component / Module mapping** — 본 UC 가 거치는 3 component + 4 module (INDEX.md 의 UC-07 row 와 정확 일치 — Web UI / Backend API / DB Persistence + WebModule / AssessmentModule / AuthModule / PersistenceModule). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 5 component (Scheduler / Worker / LLM Gateway / GitHub Adapter / Confluence Adapter) + 5 module (SchedulerModule / LlmModule / UserModule / GithubModule / ConfluenceModule) 의 위임 표시. **AssessmentModule 의 본 UC 에서의 역할**: UC-01 의 evaluate-write, UC-02 의 read service, UC-06 의 destructive write service 에 더해 본 UC 에서는 **dump / load service** 까지 활용 — Export endpoint (serialize) + Import endpoint (deserialize + transactional restore). **UC-06 과의 trigger 관계**: 본 UC Restore 가 복원한 평가 결과는 UC-06 의 manual delete / Reset & Reeval 의 대상이 됨 (operation chain 가능). **UC-01 과의 trigger 관계**: 본 UC Import 후 비어있는 시간 구간은 UC-01 의 다음 발화가 자동 재수집 (REQ-037 cross-reference, UC-06 §5 step 11 conceptual reference 와 동일 패턴).
  - **10. 관련 REQ** — 3 primary REQ + 4 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0001 / ADR-0002 / ADR-0003 / README "평가 자료의 저장" 단락 + L83-86 / UC-01·UC-02·UC-03·UC-04·UC-05·UC-06 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-07 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-07 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-07 description 단락 (§3 의 UC-07 단락) 의 끝에 `→ [UC-07-export-import.md](UC-07-export-import.md)` link 추가 (UC-01 ~ UC-06 row 의 동일 pattern).
- [ ] UC-07 row 의 "관련 REQ" 컬럼에 `REQ-032` 추가 (현재 `REQ-030, REQ-045` → `REQ-030, REQ-032, REQ-045`). 본 task 의 coversReq 와 정합.
- [ ] Refs 라인의 끝에 `T-0027` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) 의 P2 첫 bullet `[~]` 본문에 "UC-07 본문 분해 ([UC-07-export-import.md](use-cases/UC-07-export-import.md), T-0027) 완료" 한 줄 inline append. (PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 분리 후 L-number 변경됐으므로 implementer 는 작업 시 최신 L-number 재확인.)
- [ ] P2 두 번째 bullet "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" 끝에 "UC-07 cover ([UC-07](use-cases/UC-07-export-import.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 ~ UC-06 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (Admin / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over AssessmentModule: scope / file schema version / 무결성 hash 검증 (REQ-030, REQ-032, REQ-045)`).
- [ ] `alt` block 으로 §6.1 Export vs §6.2 Import 분기 또는 §6.4 race 분기 표시 — main flow 안에 통합 (UC-06 의 3 sub-trigger 통합 pattern 참고).
- [ ] §5 step 11 의 UC-01 자동 재수집 conceptual reference 를 `Note over` 또는 별도 dashed arrow 로 표시 (실제 sequence 단계가 아님 명시, UC-06 동일 패턴).

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 170 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-07 는 3 REQ (UC-06 와 동일 크기) 라서 본문 길이 UC-06 (177 LOC) 와 비슷한 ≤180 LOC / 변경 파일 3 의 가이드 안에서.
- [ ] 변경 파일: `docs/use-cases/UC-07-export-import.md` (신설) + `docs/use-cases/INDEX.md` (status / link / REQ 컬럼 / Refs) + `docs/PLAN.md` (UC-07 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019~T-0026 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (7번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-07 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-07 만 cover. (T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 template, 본 task 는 일곱 번째 적용 — 후속 UC-08 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 endpoint (예: `GET /api/admin/export?scope=...`, `POST /api/admin/restore` multipart) 와 Export / Import payload entity (DumpManifest / dump format schema) 은 후속 api.md / data-model.md 의 row.
- **Export / Import 의 실제 controller / service / streaming / transaction 구현** — P5 (Scheduling / Worker / Domain pipeline) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P5.
- **dump format 의 구체 schema** (JSON vs SQL vs binary archive, entity 별 직렬화 규칙, schema version 표기 방법, 무결성 hash 알고리즘 등) — P3 data-model.md 의 별도 row. 본 UC §1 / §5 / §6.3 는 conceptual level 만.
- **schema migration 의 구체 로직** (version A 의 dump 를 version B 시스템으로 자동 변환) — P5 의 별도 설계. 본 UC §6.3 는 default reject + conceptual reference 만.
- **merge mode 의 conflict resolution 알고리즘** (replace vs merge 시 row PK 충돌 처리) — P5 의 service layer 책임. 본 UC §6.2 는 옵션 enum 만.
- **race 감지 시 cancellation protocol** — P5 의 별도 설계. 본 UC §6.4 는 race 정책의 default (대기) 만 박제 (UC-06 §6.3 와 동일 위임).
- **Audit log schema** (ExportAuditLog / ImportAuditLog 의 컬럼 / 인덱스 / 보존 기간) — P3 data-model.md 책임. 본 UC §5 step 8 / §8 (b)(e) 는 conceptual level 만.
- **대량 dump 의 async job / progress polling / streaming chunked download / resumable upload** — P5 의 별도 설계. 본 UC §8 NFR 는 long-running operation 가능성만 언급.
- **외부 backup storage 연계** (S3 / 사내 NAS / OneDrive 등 자동 업로드) — README 명시 없음, 본 UC 는 Admin 에게 file artifact 전달까지만, 외부 storage 연계는 별도 REQ 갱신 시 ADR.
- **file artifact 의 암호화 / 무결성 서명** (Export payload 에 민감 데이터 포함 시 at-rest encryption + signature 검증) — README 명시 없음, 본 UC 는 무결성 hash 검증 까지만, 암호화는 별도 보안 ADR.
- **Restore 의 dry-run mode** (실제 DB write 없이 영향 시뮬레이션) — README 명시 없음, 본 UC scope 밖, P5 의 별도 enhancement.
- **평가 자료 관리 화면의 구체 UI / 컴포넌트 / file upload widget / progress bar 디자인** — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **Cross-instance migration tooling** (instance A 에서 Export → instance B 에서 Import 의 자동화 script) — README 명시 없음, 본 UC §6.5 는 시나리오 박제만, tooling 은 별도 ops 영역.
- **T-0017~T-0026 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-07 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README "평가 자료의 저장" 단락 + L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-06 본문 의 §5 sequence diagram style 그대로 적용. 본 UC 의 2 sub-trigger (Export / Import) 와 5 alt flow (Export scope / Import merge mode / schema version / race / cross-instance) 를 어떻게 sequence 1 개로 통합할지 결정 (T-0026 의 3 sub-trigger 통합 pattern 참고 — alt block 으로 Export vs Import 분기 표시). 본 UC 의 핵심 invariant 인 "raw 미저장 → Export payload 에 raw 자연 부재" (REQ-032 cross-reference) 와 "Import / Restore 의 atomic transaction" 과 "UC-01 의 다음 발화가 비어있는 구간 자동 재수집" 을 §1 / §5 step 7 / §8 (b)(c) 에 단단히 박제. 산출물: UC-07-export-import.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-07-export-import.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 Export vs Import 분기 표시, step 11 의 UC-01 자동 재수집 reference 는 `Note over` 로 표시). T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 의 frontmatter / section 순서 / Refs 라인 style 정확 일치. PLAN.md L-number 는 commit 98ace27 refactor 이후 변경된 최신 값 사용. INDEX.md UC-07 row 의 "관련 REQ" 컬럼에 REQ-032 추가 (현재 INDEX.md 가 REQ-030/045 만 표기 → REQ-030/032/045 로 동기).
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-07-*.md ↔ PLAN.md ↔ UC-01-*.md / UC-02-*.md / UC-03-*.md / UC-04-*.md / UC-05-*.md / UC-06-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

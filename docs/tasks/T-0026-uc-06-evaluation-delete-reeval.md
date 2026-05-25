---
id: T-0026
title: P2-UC-06 — 평가 결과 manual delete + 재수집 use case 분해 (docs/use-cases/UC-06-evaluation-delete-reeval.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-041, REQ-045]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 여섯번째 UC 본문 분해 (UC-06 평가 결과 manual delete + 재수집). UC-01 평가 실행과 자연 페어 — 삭제 후 다음 cron 발화 시 비어있는 시간 구간 자동 재수집.
dependsOn: [T-0019, T-0025]
blocks: []
hqOrigin: null
---

# T-0026 — P2-UC-06: 평가 결과 manual delete + 재수집 use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 본문 ([T-0022](T-0022-uc-02-evaluation-query.md))** + **UC-03 본문 ([T-0023](T-0023-uc-03-person-crud.md))** + **UC-04 본문 ([T-0024](T-0024-uc-04-account-auth.md))** + **UC-05 본문 ([T-0025](T-0025-uc-05-llm-config.md))** 까지 머지되어 INDEX.md 8 UC backbone + 5 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **UC-06 평가 결과 manual delete + 재수집** 의 본문을 1 파일로 분해한다.

UC-06 는 [README.md](../../README.md) "평가 자료의 저장" 단락의 핵심 — Admin 이 기존 평가 결과의 최근 N 일치 (예: 1 일 / 7 일 / 30 일) 를 **수동 삭제 (REQ-041)** 하거나 평가 없는 부분 일괄 재평가 또는 Reset & Reeval (**REQ-037**) 을 수행하면 다음 평가 (UC-01) 진행 시 비어있는 시간 구간이 자동 재수집되어 다시 평가됨 — 의 박제다. **UC-06 의 본질**: (a) destructive write 흐름 (DB row 영구 삭제 / 시간 구간 단위 + 인원 단위 또는 전체 단위), (b) UC-01 의 자동 재수집 trigger source (삭제 후 다음 cron 발화 시 AssessmentModule 의 평가 파이프라인이 "비어있는 시간 구간" 을 감지 → 그 구간에 대해 재평가 수행), (c) Admin 권한 한정 (**REQ-045** — 재작성·Reset·인원편집·Group편집 의 Admin 권한 집합 중 본 UC 는 재작성/Reset 부분). UC-06 의 cover REQ 는 3 (REQ-037 / REQ-041 / REQ-045) 으로 작지만 시스템의 destructive operation 박제이므로 invariant 가 단단해야 한다 (한번 삭제된 평가 결과는 raw 미저장 정책 — REQ-032 — 으로 인해 외부 source 재수집 + LLM 재평가 외에는 복구 불가).

본 task 의 산출물은 (1) UC-06 본문 1 파일, (2) INDEX.md 의 UC-06 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-06 cover marker 추가. T-0020 / T-0022 / T-0023 / T-0024 / T-0025 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 첫 bullet "Use case 발굴" 의 여섯 번째 UC 본문 분해. PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 로 split 되어 P2 단락 L-number 변경 — 본문 read 시 최신 L-number 사용)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-06 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template + UC-01 평가 실행이 본 UC 의 자연 페어 — 본 UC 가 삭제한 시간 구간을 UC-01 의 다음 발화가 재수집)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 두 번째 UC 본문 (template)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — 세 번째 UC 본문 (template + 6 sub-trigger 통합 sequence pattern + Admin write 흐름의 권한 검증 layer)
- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) — 네 번째 UC 본문 (template + alt block 통합 pattern)
- [docs/use-cases/UC-05-llm-config.md](../use-cases/UC-05-llm-config.md) — 직전 UC 본문 (template + Admin write 흐름의 권한 검증 + 4 sub-trigger 통합 sequence pattern)
- [README.md](../../README.md) "평가 자료의 저장" 단락 ("Admin이 직접 삭제 가능", "Reset & Reeval", "비어있는 부분 자동 재수집" 의 source) + L83-86 (3 권한 등급 — Admin 이 본 UC actor)
- [docs/architecture/components.md](../architecture/components.md) — UC-06 가 거치는 3 component (Web UI / Backend API / DB Persistence) 의 책임 + contract 정의 (오타 0 인용). UC-01 평가 실행이 본 UC 의 trigger downstream consumer 임을 명시.
- [docs/architecture/modules.md](../architecture/modules.md) — UC-06 가 거치는 4 module (WebModule / AssessmentModule / AuthModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-06 의 3 primary REQ (REQ-037 평가 없는 부분 일괄 평가 + Reset & Reeval / REQ-041 Admin 최근 N일 결과 manual delete → 재수집 / REQ-045 Admin 권한 — 재작성/Reset/Import/Export/인원편집/Group편집) + 인접 REQ (REQ-032 raw 미저장 / REQ-043 인증 / REQ-044 권한 등급 / REQ-038 평가 결과 schema)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest stack
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (평가 결과 row 삭제의 persistence layer 기반)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS 운영 토폴로지
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0025-uc-05-llm-config.md](T-0025-uc-05-llm-config.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-06 본문 파일 신설

- [ ] `docs/use-cases/UC-06-evaluation-delete-reeval.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 180 줄 (overly detailed 회피, MVA 원칙 — UC-06 는 3 REQ 로 UC-04 (2 REQ) 와 유사 / UC-05 (7 REQ) 보다 짧다). 다음 section 을 본 순서로 포함 (T-0020/T-0022/T-0023/T-0024/T-0025 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-06`, `title: 평가 결과 manual delete + 재수집`, `actor: Admin`, `trigger: Web UI 평가 결과 관리 화면에서 (a) 최근 N 일 manual delete (1/7/30 일) 또는 (b) Reset & Reeval (전체 또는 인원/기간 단위) 선택`, `status: DONE`, `coversReq: [REQ-037, REQ-041, REQ-045]`, `adjacentReq: [REQ-032, REQ-038, REQ-043, REQ-044]`, `relatedUc: [UC-01, UC-02]`, `sourceTask: T-0026`.
  - **1. 개요** — 1~2 단락. UC-06 의 본질 (평가 결과 destructive delete + UC-01 의 자동 재수집 trigger 의 박제) + README "평가 자료의 저장" 단락 인용 + UC-01 평가 실행과의 관계 (본 UC 가 삭제한 시간 구간을 UC-01 의 다음 발화가 "비어있는 시간 구간" 으로 감지 → 자동 재수집) 명시. raw 미저장 정책 (REQ-032) 으로 인해 한번 삭제된 평가 결과는 외부 source 재수집 + LLM 재평가 외에는 복구 불가 — invariant 강조.
  - **2. Actor** — Admin (REQ-045 — 재작성/Reset 의 Admin 권한). SuperAdmin 은 Admin 의 super set 으로 본 UC 도 수행 가능. User 는 본 UC 의 actor 아님 (REQ-046 read-only). 표 형식.
  - **3. Trigger** — Web UI 평가 결과 관리 화면 진입 후 다음 sub-trigger:
    - (a) **최근 N 일 manual delete (REQ-041)** — 1 일 / 7 일 / 30 일 옵션 중 선택, 전체 인원 또는 특정 인원/Group 한정 가능. 삭제 후 자동 재수집 발화 trigger (다음 cron) 까지 기다리지 않고 즉시 재수집 옵션도 가능 (단 본 UC 의 §5 sequence 는 cron 발화 기다리는 default 흐름 — immediate re-trigger 는 UC-01 의 manual trigger 흐름이 흡수).
    - (b) **평가 없는 부분 일괄 평가 (REQ-037 전반부)** — 기존 평가가 있는 시간 구간은 보존하고 비어있는 구간만 재수집. 신규 인원 추가 직후 또는 일부 삭제 직후 사용.
    - (c) **Reset & Reeval (REQ-037 후반부)** — 전체 또는 특정 인원/기간의 평가 결과를 모두 삭제하고 처음부터 재평가. 가장 destructive 한 흐름 — 사용자 확인 step 필수.
  - **4. Preconditions** — 인증 완료 (REQ-043), 사용자 등급 = Admin or SuperAdmin (REQ-044, REQ-045), DB Persistence 가용, 삭제 대상 row 1+ 존재 (없으면 §7.4 error flow 로 분기). UC-01 평가 실행이 진행 중인 경우 본 UC 는 대기 또는 거부 — race 정책은 §6.3 alt flow.
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Admin / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. Admin 이 Web UI 평가 결과 관리 화면 접근, action 선택 (manual delete / 일괄 평가 / Reset & Reeval)
    2. WebUI 가 사용자 확인 dialog 표시 (특히 Reset & Reeval 은 강한 confirmation — destructive 명시 + 영향 범위 표시)
    3. WebUI → BackendAPI write 요청 (DELETE /api/assessments?dateRange=N&personIds=... 또는 POST /api/assessments/reset 등 — 구체 endpoint 는 P2 api.md 책임, 본 UC 는 conceptual level)
    4. AuthModule guard 가 인증·권한 검증 (REQ-043, REQ-044, REQ-045 — Admin 이상)
    5. AssessmentModule service 가 request payload 검증 (dateRange enum 유효 / personIds·groupIds 존재 검증 / 진행 중 평가와의 race 검증)
    6. PersistenceModule 이 대상 row 삭제 (Assessment row + 관련 메타 row, transaction 내 일괄 — REQ-032 의 raw 미저장 정책 으로 raw 는 없음)
    7. AssessmentModule 이 audit log 1 row 생성 (삭제 종류 + admin user + 대상 person/date range + row count)
    8. AssessmentModule → BackendAPI 결과 응답 (삭제된 row count + 영향 받은 시간 구간 요약)
    9. BackendAPI → WebUI JSON 응답
    10. WebUI 가 Admin 에게 결과 표시 (삭제 row count + 다음 cron 발화 시점 + "비어있는 시간 구간은 다음 평가 시 자동 재수집" 안내)
    11. **(이후 별도 흐름 — UC-01 의 다음 발화)** Scheduler cron 발화 → AssessmentModule 평가 파이프라인이 "비어있는 시간 구간" 을 감지 → 그 구간에 대해 외부 source 재수집 + LLM 재평가 수행 → DB 에 새 row 저장. **본 단계는 UC-01 의 영역** — 본 UC 의 sequence 에는 conceptual reference 로만 (`Note over AssessmentModule: 다음 cron 발화 시 UC-01 이 비어있는 구간 자동 재수집 (REQ-037)`).
  - **6. Alternative flows** — (6.1) **3 sub-trigger 의 분기 (REQ-037, REQ-041)**: manual delete 는 row 삭제만 / 일괄 평가는 row 추가만 (비어있는 구간 채움, 기존 row 보존) / Reset & Reeval 은 row 삭제 + 즉시 재평가 trigger 의 결합 — 본 UC 는 3 흐름의 difference 만, 세부 트랜잭션 로직은 P5. (6.2) **삭제 범위 옵션**: 전체 인원 vs 특정 인원/Group vs 특정 기간 (1/7/30 일) — Cartesian product 가능, 본 UC 는 옵션 enum 만 박제. (6.3) **UC-01 평가 실행 중 race**: 평가 파이프라인이 진행 중일 때 본 UC 호출 → 두 가지 선택 (사용자 결정 위임): (i) 진행 중 평가 완료 후 본 UC 실행, (ii) 진행 중 평가 중단 후 본 UC 실행 — 본 UC 는 (i) default, (ii) 는 conceptual level 만, 구체 cancellation protocol 은 P5. (6.4) **즉시 재수집 옵션**: 본 UC 후 다음 cron 을 기다리지 않고 즉시 UC-01 의 manual trigger 호출 — 본 UC 는 trigger 까지만, 실제 재평가 흐름은 UC-01 흡수.
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 401 → WebUI login redirect. (7.2) **권한 부족** (REQ-045): User 등급이 본 UC 호출 시 403 → WebUI 가 "Admin 권한 필요" 안내. (7.3) **payload 검증 실패** (REQ-037, REQ-041): dateRange enum 부적합 / personIds·groupIds 가 존재하지 않는 ID / Reset & Reeval 의 confirmation 누락 → 400 + 검증 메시지. (7.4) **삭제 대상 0 row**: 지정된 조건에 해당하는 row 가 0 → 404 또는 200 + "삭제 대상 없음" 안내 (idempotent 동작 권장 — 200). (7.5) **DB write fail**: PersistenceModule connection 끊김 / transaction rollback → 5xx → WebUI 재시도 안내, audit log 도 같이 rollback (atomic). (7.6) **UC-01 race 감지 후 사용자가 (i) 선택 시 대기**: 진행 중 평가가 비정상 timeout → 본 UC 도 timeout 전파, 사용자에게 재시도 안내.
  - **8. Postconditions** — destructive write operation 이므로 시스템 상태 변경 발생: (a) Assessment row N 개 영구 삭제 (raw 미저장 — REQ-032 — 으로 복구 불가, 외부 source 재수집 + LLM 재평가 만 가능), (b) 비어있는 시간 구간 형성 → UC-01 의 다음 발화가 이 구간을 감지 (REQ-037 의 "평가 없는 부분 일괄 평가"), (c) Audit log 1 row 생성 (삭제 종류 + admin user + 대상 person/date range + row count — schema 는 P3 data-model.md 책임), (d) UC-02 의 다음 조회는 삭제 반영된 결과 + 비어있는 구간이 시계열에 gap 으로 표시 (단 진행 중 평가 배너는 별도 — REQ-042), (e) NFR: 본 UC 의 write 흐름은 일반적 destructive CRUD 의 reasonable 응답 시간 (구체 SLA 는 README 명시 없음 — REQ-048 의 3 초는 read 한정). 대량 삭제 (예: 30 일 + 전체 인원) 는 long-running operation 가능 — async job + status polling 옵션은 P5 의 별도 설계.
  - **9. Component / Module mapping** — 본 UC 가 거치는 3 component + 4 module (INDEX.md 의 UC-06 row 와 정확 일치 — Web UI / Backend API / DB Persistence + WebModule / AssessmentModule / AuthModule / PersistenceModule). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 5 component (Scheduler / Worker / LLM Gateway / GitHub Adapter / Confluence Adapter) + 5 module (SchedulerModule / LlmModule / UserModule / GithubModule / ConfluenceModule) 의 위임 표시. **AssessmentModule 의 본 UC 에서의 역할**: 다른 UC 가 AssessmentModule 의 read service (UC-02) 또는 write service (UC-01 평가 파이프라인) 를 사용한다면 UC-06 는 AssessmentModule 의 **destructive write service** 까지 활용 — delete + reset endpoint 제공. **UC-01 과의 trigger 관계**: 본 UC 의 §5 step 11 (conceptual reference) 이 UC-01 의 자동 재수집 흐름 source — 본 UC 가 삭제한 비어있는 구간을 UC-01 이 다음 cron 발화 시 자동 감지.
  - **10. 관련 REQ** — 3 primary REQ + 4 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0001 / ADR-0002 / ADR-0003 / README "평가 자료의 저장" 단락 + L83-86 / UC-01·UC-02·UC-03·UC-04·UC-05 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-06 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-06 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-06 description 단락 (§3 의 UC-06 단락) 의 끝에 `→ [UC-06-evaluation-delete-reeval.md](UC-06-evaluation-delete-reeval.md)` link 추가 (UC-01 / UC-02 / UC-03 / UC-04 / UC-05 row 의 동일 pattern).
- [ ] Refs 라인의 끝에 `T-0026` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) 의 P2 첫 bullet `[~]` 본문에 "UC-06 본문 분해 ([UC-06-evaluation-delete-reeval.md](use-cases/UC-06-evaluation-delete-reeval.md), T-0026) 완료" 한 줄 inline append. (PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 분리 후 L-number 변경됐으므로 implementer 는 작업 시 최신 L-number 재확인.)
- [ ] P2 두 번째 bullet "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" 끝에 "UC-06 cover ([UC-06](use-cases/UC-06-evaluation-delete-reeval.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 / UC-02 / UC-03 / UC-04 / UC-05 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (Admin / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over AssessmentModule: dateRange / personIds / Reset confirmation 검증 (REQ-037, REQ-041, REQ-045)`).
- [ ] `alt` block 으로 §6.1 (3 sub-trigger 분기 — manual delete vs 일괄 평가 vs Reset & Reeval) 또는 §6.3 (UC-01 평가 실행 중 race) 분기 표시 — main flow 안에 통합.
- [ ] §5 step 11 의 UC-01 자동 재수집 conceptual reference 를 `Note over` 또는 별도 dashed arrow 로 표시 (실제 sequence 단계가 아님 명시).

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 / T-0023 / T-0024 / T-0025 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 150 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-06 는 3 REQ (UC-04 의 2 REQ 보다 약간 많고 UC-05 의 7 REQ 보다 적음) 라서 본문 길이 UC-04 (197 LOC) 와 UC-05 (예상 190 LOC) 의 중간 — 본문 ≤180 LOC / 변경 파일 3 의 가이드 안에서.
- [ ] 변경 파일: `docs/use-cases/UC-06-evaluation-delete-reeval.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-06 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019/T-0020/T-0021/T-0022/T-0023/T-0024/T-0025 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (6번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-06 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-07 ~ UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-06 만 cover. (T-0020 / T-0022 / T-0023 / T-0024 / T-0025 template, 본 task 는 여섯 번째 적용 — 후속 2 UC 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 destructive endpoint (예: `DELETE /api/assessments?dateRange=N&personIds=...`, `POST /api/assessments/reset`) 와 audit log entity (DeleteAuditLog / ResetAuditLog 의 column·index) 은 후속 api.md / data-model.md 의 row.
- **평가 결과 삭제 / Reset & Reeval 의 실제 controller / service / DB transaction 구현** — P5 (Scheduling / Worker / Domain pipeline) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P5.
- **자동 재수집 로직의 구체 구현** (비어있는 시간 구간 감지 → 외부 source 재수집 → LLM 재평가) — UC-01 / P4 / P5 책임. 본 UC §5 step 11 은 conceptual reference 만.
- **삭제 transaction 의 atomicity / rollback / 부분 실패 처리** — P5 의 service layer 책임. 본 UC §7.5 는 conceptual level 만.
- **대량 삭제 의 async job / progress polling / cancellation protocol** — P5 의 별도 설계. 본 UC §8 (e) 는 long-running operation 가능성만 언급.
- **UC-01 평가 실행 중 race 의 구체 cancellation protocol** — P5 의 별도 설계. 본 UC §6.3 는 race 정책의 default (대기) 만 박제.
- **Audit log schema** (DeleteAuditLog / ResetAuditLog 의 컬럼 / 인덱스 / 보존 기간) — P3 data-model.md 책임. 본 UC §5 step 7 / §8 (c) 는 conceptual level 만.
- **Assessment row 의 ERD / 컬럼 / 인덱스 / cascade rule** — P3 data-model.md 책임. 본 UC 는 conceptual level 만.
- **삭제 권한의 fine-grained 모델** (Admin 이 다른 Admin 의 평가 결과를 삭제 가능한지 등) — REQ-045 의 conceptual scope 안에서 본 UC 는 "Admin 이상" 까지만, fine-grained 권한은 P4 또는 별도 REQ 갱신 필요 시 ADR.
- **Soft delete 옵션** (row 영구 삭제 vs deleted_at timestamp 만 표시) — README 명시 없음 + REQ-032 raw 미저장 정책 의 해석상 hard delete default — 단 향후 soft delete 도입 시 별도 ADR.
- **평가 결과 관리 화면의 구체 UI / 컴포넌트 / confirmation dialog 디자인** — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **삭제 후 사용자 통지** (Reset & Reeval 영향 사용자에게 alert / email) — README 명시 없음 + 본 UC 는 audit log 까지만, 외부 통지는 별도 REQ 갱신 시 ADR.
- **T-0017~T-0025 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-06 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README "평가 자료의 저장" 단락 + L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-05 본문 의 §5 sequence diagram style 그대로 적용. 본 UC 의 3 sub-trigger (manual delete / 일괄 평가 / Reset & Reeval) 와 4 alt flow (3 sub-trigger 분기 / 삭제 범위 옵션 / UC-01 race / 즉시 재수집) 를 어떻게 sequence 1 개로 통합할지 결정 (T-0025 의 main flow + alt block 통합 pattern 적용). 본 UC 의 핵심 invariant 인 "raw 미저장 → 한번 삭제된 평가 결과는 복구 불가" 와 "UC-01 의 다음 발화가 비어있는 구간 자동 재수집" 을 §8 (a) / §5 step 11 conceptual reference 에 단단히 박제. 산출물: UC-06-evaluation-delete-reeval.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-06-evaluation-delete-reeval.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 §6.1 3 sub-trigger 분기 또는 §6.3 UC-01 race 분기 표시, step 11 의 UC-01 자동 재수집 reference 는 `Note over` 로 표시). T-0020 / T-0022 / T-0023 / T-0024 / T-0025 의 frontmatter / section 순서 / Refs 라인 style 정확 일치. PLAN.md L-number 는 commit 98ace27 refactor 이후 변경된 최신 값 사용.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-06-*.md ↔ PLAN.md ↔ UC-01-*.md / UC-02-*.md / UC-03-*.md / UC-04-*.md / UC-05-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

---
id: T-0028
title: P2-UC-08 — 권한 부족 인식·통지 (GitHub / Confluence) use case 분해 (docs/use-cases/UC-08-permission-denied.md)
phase: P2
status: DONE
commitMode: pr
coversReq: [REQ-008, REQ-016]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-05-25
completed: 2026-05-25T11:00:00+09:00
mergedPr: 27
mergeSha: db65dd7
plannerNote: P2 마지막 (8/8) UC 본문 분해 (UC-08 권한 부족 인식·통지). System-actor 첫 사례 — Adapter 4xx 감지 → PermissionDeniedEvent → DB 기록 → Web UI 표시. 본 task 머지 시 P2 UC 본문 8/8 closure.
dependsOn: [T-0019, T-0027]
blocks: []
hqOrigin: null
resultSummary: PR-27 round 1/7 squash db65dd7 — UC-08-permission-denied.md 179 LOC 신설 + INDEX/PLAN 8/8 closure 박제. 11 section + mermaid 14-step (8 participant + 2 actor + 2 alt + 4 Note) + System-actor invariant + Dual audience 분기 + 3 phase (emit/propagation/display). reviewer 0 BLOCKER/MAJOR 1 MINOR. **P2 UC backbone 8/8 closure achieved**. CI rerun --failed 10번째 dogfood. driver workaround 10번째. executor 가 commit/push 누락 → driver 가 직접 commit + push 보완 (executor 결함 patch — 후속 follow-up).
---

# T-0028 — P2-UC-08: 권한 부족 인식·통지 (GitHub / Confluence) use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 ([T-0022](T-0022-uc-02-evaluation-query.md))** + **UC-03 ([T-0023](T-0023-uc-03-person-crud.md))** + **UC-04 ([T-0024](T-0024-uc-04-account-auth.md))** + **UC-05 ([T-0025](T-0025-uc-05-llm-config.md))** + **UC-06 ([T-0026](T-0026-uc-06-evaluation-delete-reeval.md))** + **UC-07 ([T-0027](T-0027-uc-07-export-import.md))** 까지 머지되어 INDEX.md 8 UC backbone + 7 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **마지막 UC-08 권한 부족 인식·통지 (GitHub / Confluence)** 의 본문을 1 파일로 분해한다. **본 task 머지 시점에 P2 UC 본문 8/8 closure 가 달성**된다.

UC-08 는 [README.md](../../README.md) "Assessment Target / GitHub 권한 부족" + "보안 특성 / Confluence 권한 부족" 단락의 핵심 — GitHub Adapter / Confluence Adapter 가 외부 시스템 (3 GitHub instance + Confluence) 의 **4xx 응답을 감지하면 PermissionDeniedEvent 를 emit**, AssessmentModule 이 event 를 받아 **DB 에 권한 부족 기록을 남기고**, Web UI 가 **사용자 (REQ-008 — GitHub) 및 관리자 (REQ-016 — Confluence) 모두 인식할 수 있도록 표시** — 의 박제다. **UC-08 의 본질**: (a) **System-actor UC — 본 시스템 첫 사례**. 다른 7 UC 는 모두 사람 (User / Admin / SuperAdmin) 또는 Scheduler 가 actor 인 반면, 본 UC 는 **외부 시스템의 4xx 응답이 trigger origin**. 사람이 직접 trigger 하지 않으나 사람이 **인식·대응** 할 수 있어야 함 — 이 invariant 가 UC §5 의 sequence diagram + §2 actor + §8 postcondition 에 단단히 박제. (b) **trigger / propagation / display 의 3 phase 흐름**. (i) **trigger origin**: 외부 시스템 (GitHub.com / GitHub.sec / GitHub.ecode / Confluence.sec) 의 4xx 응답 → Adapter 가 감지 (UC-01 평가 파이프라인 진행 중 발생). (ii) **propagation**: GithubModule / ConfluenceModule 이 PermissionDeniedEvent emit → AssessmentModule event handler → PersistenceModule DB write (권한 부족 기록 row). (iii) **display (read path)**: Web UI 가 사용자 페이지 열 때 PersistenceModule 의 권한 부족 row 조회 → 사용자 (REQ-008) 및 관리자 (REQ-016) 모두 인식할 수 있게 표시 — display 는 사람이 페이지 열 때 발화하는 별도 read flow. (c) **이중 audience (REQ-008 vs REQ-016)**: GitHub 권한 부족은 **사용자도 인식 필요** (개발자가 자기 commit 접근권을 부여하지 않아 평가가 누락된 상황을 본인이 발견·해소 가능해야 함, REQ-008). Confluence 권한 부족은 **관리자가 인식·대응 필요** (Confluence space 접근권은 관리자 운영 영역, REQ-016). 두 경로의 표시 channel · 대상 권한 등급이 다름 — Web UI 가 두 audience 별로 다른 표시 영역 운영. UC-08 의 cover REQ 는 2 (REQ-008 / REQ-016) 으로 UC-04 (2 REQ) 와 동일하게 작지만 **시스템의 자동 emit 흐름 + display 영역 통합** 이라는 architectural 박제이므로 sequence diagram 이 trigger origin 명시 (외부 시스템 → Adapter) + display 분기 (read path 별도) 를 둘 다 표시해야 한다.

본 task 의 산출물은 (1) UC-08 본문 1 파일, (2) INDEX.md 의 UC-08 row 갱신 (PLANNED→DONE) + **P2 UC backbone 8/8 closure** 확인 row, (3) PLAN.md 의 P2 bullet 본문에 UC-08 cover marker + **P2 UC 본문 분해 8/8 closure marker** 추가. T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 / T-0027 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용하되, **System-actor 첫 사례** 이므로 sequence diagram 의 시작점 (trigger origin = 외부 시스템 4xx 응답) 명시 + Note `사람이 직접 trigger 안 함, 인식·대응 가능해야 함` 박제 + display 의 read path 분기 표시.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 첫 bullet "Use case 발굴" 의 여덟 번째이자 **마지막** UC 본문 분해. PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 로 split 되어 P2 단락 L-number 변경 — 본문 read 시 최신 L-number 사용)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-08 row + description 단락 (본 task 가 풀어쓸 source). 특히 UC-08 row 의 actor 컬럼 `System (GitHub Adapter / Confluence Adapter emit → Web UI 표시)` 와 component / module 컬럼 정확 일치 필요.
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template + **본 UC 의 trigger origin upstream** — UC-01 평가 파이프라인 진행 중에 외부 시스템 4xx 응답이 발생하므로 본 UC 의 trigger 가 UC-01 의 영역 안에서 일어남)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 두 번째 UC 본문 (template + Web UI 의 read path display 패턴 — 본 UC 의 §5 step 의 read path 분기가 UC-02 의 read flow 와 동일 구조)
- [docs/use-cases/UC-06-evaluation-delete-reeval.md](../use-cases/UC-06-evaluation-delete-reeval.md) — 여섯 번째 UC 본문 (template + alt block + Note 패턴 — 본 UC 의 sequence diagram 에 trigger / propagation / display 의 3 phase Note 박제 시 참고)
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — 일곱 번째 UC 본문 (직전 template + frontmatter / 11 section / Refs 라인 style 정확 일치 source)
- [README.md](../../README.md) "Assessment Target" 단락 (특히 GitHub instance / Confluence 권한 부족 인식 단락) + "보안 특성" 단락 (Confluence 권한 부족 → 관리자 인식 채널) + L83-86 (3 권한 등급 — 사용자·관리자 두 audience 의 source)
- [docs/architecture/components.md](../architecture/components.md) — UC-08 가 거치는 4 component (GitHub Adapter / Confluence Adapter / Backend API / Web UI) 의 책임 + contract 정의 + DB Persistence 의 보조 역할 (오타 0 인용). GitHub Adapter / Confluence Adapter 의 4xx 감지 + event emit 책임 명시.
- [docs/architecture/modules.md](../architecture/modules.md) — UC-08 가 거치는 4 module (GithubModule / ConfluenceModule / AssessmentModule / WebModule) 의 책임 + component ↔ module mapping (오타 0 인용) + AssessmentModule 의 event handler 역할 + PersistenceModule 의 보조 역할.
- [docs/requirements.md](../requirements.md) — UC-08 의 2 primary REQ (REQ-008 GitHub 권한 부족 인식·통지 / REQ-016 Confluence 권한 부족 인식·통지) + 인접 REQ (REQ-005~007 GitHub 3 instance / REQ-014/015 Confluence / REQ-043 인증 / REQ-044 권한 등급 / REQ-045 Admin 권한 / REQ-046 User read-only)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest stack
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (권한 부족 기록 row 의 persistence layer 기반 — 구체 schema 는 P3 data-model.md 책임)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS 운영 토폴로지 + secret / network — 본 UC 의 외부 시스템 호출 (GitHub / Confluence) 의 운영 기반
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0027-uc-07-export-import.md](T-0027-uc-07-export-import.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-08 본문 파일 신설

- [ ] `docs/use-cases/UC-08-permission-denied.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 180 줄 (overly detailed 회피, MVA 원칙 — UC-08 는 2 REQ 로 UC-04 (2 REQ) 와 동급 / UC-06·UC-07 (3 REQ) 보다 작다. UC-06 의 177 LOC / UC-07 의 ≤180 LOC discipline 동일 적용). 다음 section 을 본 순서로 포함 (T-0020/T-0022/T-0023/T-0024/T-0025/T-0026/T-0027 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-08`, `title: 권한 부족 인식·통지 (GitHub / Confluence)`, `actor: System (GitHub Adapter / Confluence Adapter emit → Web UI 표시)`, `trigger: 외부 시스템 (GitHub 3 instance / Confluence.sec) 의 4xx (403/401) 응답을 Adapter 가 UC-01 평가 파이프라인 진행 중 감지`, `status: DONE`, `coversReq: [REQ-008, REQ-016]`, `adjacentReq: [REQ-005, REQ-006, REQ-007, REQ-014, REQ-015, REQ-043, REQ-044, REQ-045, REQ-046]`, `relatedUc: [UC-01, UC-02]`, `sourceTask: T-0028`.
  - **1. 개요** — 1~2 단락. UC-08 의 본질 (System-actor 첫 사례 / trigger / propagation / display 의 3 phase / 이중 audience REQ-008 vs REQ-016) + README "Assessment Target" + "보안 특성" 단락 인용 + UC-01 평가 파이프라인의 영역 안에서 trigger 발생 + display 의 read path 분기 (사람이 페이지 열 때 발화).
  - **2. Actor** — System (GitHub Adapter / Confluence Adapter emit → Web UI 표시) — **본 시스템 첫 System-actor UC**. 표 형식 — System 의 emit 역할 + 사람 (User / Admin / SuperAdmin) 의 인식·대응 역할의 분리. User 는 REQ-008 (GitHub) 의 audience, Admin 은 REQ-016 (Confluence) 의 audience. 사람이 직접 trigger 안 함을 표 footnote 또는 별도 한 줄로 박제.
  - **3. Trigger** — 외부 시스템 4xx 응답 감지의 sub-trigger:
    - (a) **GitHub 4xx (REQ-008)** — UC-01 평가 파이프라인이 GitHub 3 instance (github.com / github.sec.samsung.net / github.ecodesamsung.com) 중 하나에 호출 시 403 (권한 부족) 또는 401 (token 만료) 응답. GitHub Adapter 가 status code + endpoint + 영향 받은 repo·user 식별. **사용자 audience** (해당 GitHub ID 가 매핑된 평가 대상 인원 본인) 가 인식 대상.
    - (b) **Confluence 4xx (REQ-016)** — UC-01 평가 파이프라인이 Confluence.sec.samsung.net 의 지정 SPACE 호출 시 403 또는 401 응답. Confluence Adapter 가 status code + SPACE 식별. **관리자 audience** (Admin / SuperAdmin) 가 인식 대상 — Confluence SPACE 접근권은 관리자 운영 영역.
  - **4. Preconditions** — UC-01 평가 파이프라인 진행 중 (Scheduler cron 발화 또는 Admin manual trigger 이후), GitHub Adapter / Confluence Adapter 가 외부 시스템 호출 시도 중, DB Persistence 가용 (event handler 의 write 영역). **사람의 사전 행동 없음** — 본 UC 의 trigger 는 외부 시스템 응답에 100% 의존. display phase 의 사전조건: 사람이 Web UI 에 로그인 (REQ-043) + 자기 권한 audience 에 해당하는 영역에 진입 (사용자 본인의 평가 결과 화면 또는 Admin 의 시스템 상태 화면).
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: ExternalSystem (외부 시스템 — GitHub / Confluence) / GithubAdapter / ConfluenceAdapter / AssessmentModule / PersistenceModule / WebUI / Person (사용자) / Admin (관리자). 최소 8 단계 ≤ 14 단계. **trigger origin 명시 — 시작점은 외부 시스템 의 4xx 응답** + **Note `사람이 직접 trigger 안 함, 인식·대응 가능해야 함`** 의 박제 + **display phase 의 read path 분기 — alt block 으로 사람이 페이지 열 때 발화** 표시. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. **Trigger origin Note**: "본 UC 의 trigger 는 사람의 직접 입력이 아니라 외부 시스템 (GitHub 3 instance / Confluence.sec) 의 4xx 응답. 사람은 인식·대응 phase 에만 등장."
    2. UC-01 평가 파이프라인 진행 중 GithubAdapter / ConfluenceAdapter 가 외부 시스템에 호출 (3 GitHub instance 또는 Confluence SPACE — REQ-005~007, REQ-014, REQ-015 cross-reference)
    3. ExternalSystem → Adapter: 4xx (403 / 401) 응답
    4. Adapter (GithubAdapter / ConfluenceAdapter) 가 status code 감지 → PermissionDeniedEvent 구성 (source 종류 + endpoint + 영향 받은 repo·user / SPACE 정보 + timestamp — REQ-008 또는 REQ-016)
    5. Adapter → AssessmentModule: PermissionDeniedEvent emit (event-driven decouple — UC-03 신규 인원 emit 패턴과 동일)
    6. AssessmentModule event handler → PersistenceModule: 권한 부족 기록 row insert (audience flag 포함 — user / admin / both)
    7. **alt block — audience 분기**: GitHub 4xx 경우 audience=user (REQ-008), Confluence 4xx 경우 audience=admin (REQ-016)
    8. UC-01 평가 파이프라인은 본 권한 부족 구간을 skip 또는 graceful degradation 으로 계속 진행 (구체 정책은 P5 의 retry / circuit breaker 영역)
    9. **display phase (별도 read path)** — `Note over WebUI: 별도 시점 — 사람이 페이지 열 때 발화`
    10. Person 또는 Admin 이 WebUI 에 자기 audience 의 화면 진입 (Person → 본인 평가 결과 화면 / Admin → 시스템 상태 화면)
    11. WebUI → BackendAPI (AssessmentModule read endpoint) → PersistenceModule: 권한 부족 row 조회 (audience filter)
    12. WebUI 가 audience 별로 권한 부족 표시 (Person: "내 GitHub commit 접근권 부족 — 해당 instance 의 접근권 부여 필요" / Admin: "Confluence SPACE X 접근권 부족 — 관리자 운영 필요")
  - **6. Alternative flows** — (6.1) **자가-해소 감지**: 사용자/관리자가 권한 부여 후 다음 UC-01 발화 시 4xx → 200 전환 감지 → 권한 부족 row 의 resolvedAt 갱신, WebUI 의 인식 표시 자동 사라짐 (구체 메커니즘은 P5). (6.2) **반복 4xx 감지**: 같은 endpoint 의 4xx 가 N 회 연속 발생 시 디바운스 (중복 emit 억제) — 동일 권한 부족 row 의 추가 timestamp 만 append, 구체 알고리즘은 P5. (6.3) **다중 audience 동시 발생**: 한 발화에서 GitHub 와 Confluence 4xx 가 동시 발생하면 두 권한 부족 row 가 별도로 insert (audience flag 별 분리), WebUI 도 각각 표시. (6.4) **인원 미매핑 GitHub 4xx**: 4xx 발생한 GitHub user 가 본 시스템의 평가 대상 인원으로 매핑돼있지 않으면 user audience 표시 대상 없음 → admin audience 로 fallback (관리자가 매핑 누락 판단). (6.5) **token 만료 (401) vs 권한 부족 (403)**: 두 status code 의 분기는 conceptual level 만 박제 (둘 다 인식 대상), 구체 분류·복구 protocol 은 P4 GitHub/Confluence integration 의 별도 설계.
  - **7. Error flows** — (7.1) **event emit 실패**: Adapter → AssessmentModule event bus 호출 자체 실패 (in-process event bus 라 dropping 위험 낮음) → log 만 남기고 UC-01 진행 계속, 다음 발화에서 재시도. (7.2) **PersistenceModule write fail**: 권한 부족 row insert 실패 → log + UC-01 graceful degradation 계속, 다음 발화에서 재시도. (7.3) **display read fail**: WebUI 의 권한 부족 row 조회 실패 → 사람 audience 가 인식 못함 → log 만, UC-01 자체에는 영향 없음 (display 는 best-effort). (7.4) **stale row 누적**: 자가-해소 (§6.1) 가 동작하지 않아 권한 부족 row 가 무한 누적될 위험 — 보존 기간 정책 / 자동 cleanup 은 P3 data-model.md 의 별도 row. (7.5) **인증 실패 (REQ-043)**: display phase 에서 사람이 미인증 상태로 화면 진입 → AuthModule guard 가 401 → login redirect (UC-04 의 §7.1 동일 흐름).
  - **8. Postconditions** — 본 UC 의 emit phase 종료 후: **(a) DB 에 권한 부족 기록 row 생성** (audience flag + source 종류 + endpoint + 영향 범위 + timestamp 박제, 구체 schema 는 P3 data-model.md 책임), **(b) UC-01 평가 파이프라인은 본 권한 부족 구간 skip + graceful degradation 으로 계속 진행** (REQ-008 / REQ-016 은 평가를 중단시키지 않음 — 한 instance / SPACE 의 권한 부족이 전체 평가를 멈추지 않게 보호). display phase 종료 후: **(c) Person audience 가 본인 GitHub 권한 부족을 인식** (REQ-008), **(d) Admin audience 가 Confluence SPACE 권한 부족을 인식** (REQ-016), **(e) 자가-해소 시 권한 부족 row 의 resolvedAt 갱신 후 WebUI 의 인식 표시 사라짐**. NFR: emit phase 의 latency 는 외부 시스템 응답 시간 + 1 event hop + 1 DB write 의 합. display phase 는 read 한정 SLA REQ-048 의 3 초 안.
  - **9. Component / Module mapping** — 본 UC 가 거치는 4 component + 4 module (INDEX.md 의 UC-08 row 와 정확 일치 — GitHub Adapter / Confluence Adapter / Backend API / Web UI + GithubModule / ConfluenceModule / AssessmentModule / WebModule). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. DB Persistence (PersistenceModule) 은 INDEX.md row 에 명시 안 됐으나 §5 step 6 / step 11 의 보조 persistence 영역으로 본문 §9 footnote 1 줄로 추가 설명 (INDEX.md row 와의 차이 박제 — 본문 footnote 만, INDEX.md 갱신 없음). 본 UC 에서 거치지 않는 4 component (Scheduler / Worker / LLM Gateway / DB Persistence ← INDEX row 기준) + 5 module (SchedulerModule / LlmModule / UserModule / AuthModule / PersistenceModule ← INDEX row 기준) 의 위임 표시. **UC-01 과의 trigger 관계**: 본 UC 의 trigger 는 UC-01 평가 파이프라인 진행 중 발생 — UC-01 의 §5 sequence 에서 GithubAdapter / ConfluenceAdapter 호출 단계가 본 UC 의 trigger origin. **UC-02 와의 display 관계**: 본 UC 의 display phase 는 UC-02 의 read path 와 동일 구조 — Web UI → Backend API → PersistenceModule. UC-02 는 평가 결과 row 조회, 본 UC display 는 권한 부족 row 조회.
  - **10. 관련 REQ** — 2 primary REQ + 9 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시. REQ-008 / REQ-016 의 audience 분리 + REQ-005~007, REQ-014, REQ-015 의 외부 시스템 source + REQ-043~046 의 인증·권한 layer.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0001 / ADR-0002 / ADR-0003 / README "Assessment Target" + "보안 특성" + L83-86 / UC-01·UC-02·UC-06·UC-07 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-08 row 갱신 + P2 backbone 8/8 closure 박제

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-08 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-08 description 단락 (§3 의 UC-08 단락) 의 끝에 `→ [UC-08-permission-denied.md](UC-08-permission-denied.md)` link 추가 (UC-01 ~ UC-07 row 의 동일 pattern).
- [ ] INDEX.md §1 "개요" 또는 §2 "UC 목록 표" 뒤에 **P2 UC backbone 8/8 closure 한 줄 박제** 추가 — "본 INDEX.md 의 8 UC 모두 본문 분해 완료 (UC-01 ~ UC-08, T-0020 ~ T-0028)" 의 의미가 한 줄로 들어가도록 (위치·정확 문구는 architect 결정 — 기존 갱신 룰 §5 와 자연스럽게 통합). 본 한 줄이 P2 UC 분해 phase 의 closure marker.
- [ ] Refs 라인의 끝에 `T-0028` 추가. 또한 REQ-008, REQ-016 이 Refs 라인의 REQ 부분에 누락돼있는지 확인 — 누락 시 추가 (현재 Refs 라인은 REQ-008/016 모두 이미 포함 추정, implementer 확인).

### 3. PLAN.md 갱신 + P2 UC 본문 8/8 closure marker

- [ ] [docs/PLAN.md](../PLAN.md) 의 P2 첫 bullet `[~]` 본문에 "UC-08 본문 분해 ([UC-08-permission-denied.md](use-cases/UC-08-permission-denied.md), T-0028) 완료" 한 줄 inline append. **P2 첫 bullet `[~]` 을 `[x]` 로 전환** — 8/8 UC 본문 모두 완료. (PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 분리 후 L-number 변경됐으므로 implementer 는 작업 시 최신 L-number 재확인.)
- [ ] P2 두 번째 bullet "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" 끝에 "UC-08 cover ([UC-08](use-cases/UC-08-permission-denied.md) §5 sequence + §9 component/module mapping)" inline append + **`[~]` → `[x]` 전환** (8/8 매핑 완료).
- [ ] P2 첫·두 번째 bullet 옆 (또는 bullet 아래 한 줄) 에 **"P2 UC 본문 분해 8/8 closure (UC-01 ~ UC-08, T-0020 ~ T-0028)"** marker 한 줄 박제. 본 한 줄이 P2 UC 분해 phase 의 closure 신호 — 후속 task 들 (api.md / data-model.md / Use case 인벤토리 검증) 는 별도 bullet 로 그대로 둠.

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (ExternalSystem / GithubAdapter / ConfluenceAdapter / AssessmentModule / PersistenceModule / WebUI / Person / Admin — Person 과 Admin 은 `actor` keyword 사용).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용.
- [ ] **trigger origin Note 박제** — `Note over ExternalSystem,GithubAdapter: 본 UC 의 trigger 는 사람의 직접 입력이 아니라 외부 시스템의 4xx 응답. 사람은 인식·대응 phase 에만 등장.` (또는 동등 의미의 Note) — System-actor 첫 사례의 invariant 명시.
- [ ] **display phase 분기 Note 또는 alt block** — `Note over WebUI: 별도 시점 — 사람이 페이지 열 때 발화 (별도 read path)` 또는 동등한 alt block 으로 emit phase 와 display phase 의 분리 표시.
- [ ] `alt` block 으로 §6.3 GitHub vs Confluence audience 분기 표시 — main flow 안에 통합 (UC-06 의 3 sub-trigger 통합 pattern + UC-07 의 Export/Import 분기 통합 pattern 참고).

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 / T-0027 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 170 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-08 는 2 REQ (UC-04 와 동급) 라서 본문 길이 ≤180 LOC / 변경 파일 3 의 가이드 안에서 (UC-06 의 177 LOC / UC-07 의 ≤180 LOC discipline 동일 적용).
- [ ] 변경 파일: `docs/use-cases/UC-08-permission-denied.md` (신설) + `docs/use-cases/INDEX.md` (status / link / 8/8 closure 박제 / Refs) + `docs/PLAN.md` (UC-08 cover marker + `[~]` → `[x]` + 8/8 closure marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019~T-0027 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (8번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.
- [ ] **본 task 머지 시 P2 UC 본문 8/8 closure 달성** — driver / integrator 가 STATE.json 의 `phase` 갱신 시 `P2-uc-complete` 또는 동등 표기 (정확 enum 은 driver 결정).

## Out of Scope

본 task 는 UC-08 본문 분해 + INDEX.md 의 status 갱신 + 8/8 closure marker 박제만 수행. 다음은 별도 task:

- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 endpoint (예: 권한 부족 row 의 read endpoint) 와 entity (PermissionDeniedRecord — audience flag / source / endpoint / 영향 범위 / timestamp / resolvedAt) 은 후속 api.md / data-model.md 의 row.
- **Use case 인벤토리 검증** — P2 의 또 다른 별도 task. requirements.md 의 모든 functional REQ 가 1+ use case 로 cover 되는지 확인 — UC-08 까지 8 UC 박제 후 본격 검증.
- **PermissionDeniedEvent 의 실제 controller / service / event bus / event handler 구현** — P4 (External integrations) 의 GitHub / Confluence Adapter 의 권한 부족 감지·통지 영역. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P4.
- **PermissionDeniedRecord schema** (audience enum / source enum / endpoint 표기 / 영향 범위 표기 / timestamp / resolvedAt / 보존 기간 / 인덱스) — P3 data-model.md 의 별도 row. 본 UC §5 / §8 은 conceptual level 만.
- **token 만료 vs 권한 부족 의 분류·복구 protocol** (401 vs 403 의 분기 처리) — P4 의 GitHub / Confluence integration 별도 설계. 본 UC §6.5 는 conceptual level 만.
- **반복 4xx 디바운스 / 중복 emit 억제 알고리즘** — P5 의 service layer 책임. 본 UC §6.2 는 conceptual level 만.
- **자가-해소 감지 메커니즘 (4xx → 200 전환 감지 + resolvedAt 갱신)** — P5 의 별도 설계. 본 UC §6.1 / §8 (e) 는 conceptual level 만.
- **stale row 누적 방지 (보존 기간 정책 + 자동 cleanup)** — P3 data-model.md + P5 의 별도 영역. 본 UC §7.4 는 conceptual level 만.
- **인원 미매핑 GitHub 4xx 의 fallback 정책** (인원 매핑 누락 시 admin audience 로 전환) — P5 의 service layer 책임. 본 UC §6.4 는 conceptual level 만.
- **Web UI 의 권한 부족 표시 widget / 알림 채널** (in-page banner / 이메일 / Slack 등) — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **circuit breaker / retry policy** (4xx 다발 시 외부 시스템 호출 일시 중단) — P4 / P5 의 별도 설계. 본 UC §8 (b) 는 graceful degradation 의 conceptual level 만.
- **GitHub / Confluence 외 외부 시스템 4xx 처리** (LLM provider 4xx 등) — 본 UC scope 밖 (LLM 권한 부족은 REQ-008 / REQ-016 의 cover 영역 아님). LLM provider 4xx 는 UC-01 / UC-05 의 error path 또는 별도 UC 의 영역.
- **T-0017~T-0027 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-08 의 trigger / propagation / display 의 3 phase 통합 흐름 + System-actor 첫 사례의 invariant + sequence diagram 의 trigger origin 명시 + display phase 분기 (read path) 결정. README "Assessment Target" + "보안 특성" + L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-06 본문 의 §5 sequence diagram style + UC-07 의 alt block 통합 pattern 그대로 적용. 본 UC 의 핵심 invariant 인 "사람이 직접 trigger 안 함 (System-actor)" 과 "REQ-008 / REQ-016 의 audience 분리 (User vs Admin)" 와 "trigger origin = 외부 시스템 4xx 응답" 과 "display phase = read path 별도 발화" 를 §1 / §5 Note / §5 alt block / §8 (a)~(e) 에 단단히 박제. INDEX.md 의 P2 backbone 8/8 closure 박제 한 줄의 정확 위치·문구 결정. 산출물: UC-08-permission-denied.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + INDEX.md / PLAN.md 의 closure marker 박제 위치 + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-08-permission-denied.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (trigger origin Note + audience 분기 alt block + display phase 분기 Note). T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 / T-0027 의 frontmatter / section 순서 / Refs 라인 style 정확 일치. PLAN.md L-number 는 commit 98ace27 refactor 이후 변경된 최신 값 사용. INDEX.md UC-08 row + Refs 라인 + 8/8 closure 박제. PLAN.md 의 P2 첫·두 번째 bullet 의 `[~]` → `[x]` 전환 + 8/8 closure marker 박제.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-08-*.md ↔ PLAN.md ↔ UC-01-*.md ~ UC-07-*.md 간 link 무결성 확인. **P2 UC 본문 8/8 closure 마커가 INDEX.md / PLAN.md 양쪽에 동기 박제됐는지 cross-check** — 본 task 의 architectural 의미가 closure marker 의 정합에 박제됨.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

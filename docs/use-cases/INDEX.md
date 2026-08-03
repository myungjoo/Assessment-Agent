# Use cases — INDEX

> **본 문서는 P2 entry task [T-0019](../tasks/T-0019-p2-entry-use-case-index.md) 의 산출물이다.** Phase P2 (Use case decomposition) 의 backbone — 본 시스템에서 식별된 use case 의 목록 + 각 UC 와 actor / component (T-A3) / module (T-A4) / 관련 REQ 의 매핑 표를 박제한다. 각 UC 의 본격 분해 (트리거 / 흐름 / 데이터 / NFR / sequence diagram) 는 후속 task (`UC-NN-*.md`) 의 책임.

## 1. 개요

Phase P2 (Use case decomposition) 의 목표는 [README.md](../../README.md) + P1 의 architecture 산출물 (3 ADR + [requirements.md](../requirements.md) + [deployment.md](../architecture/deployment.md) + [components.md](../architecture/components.md) + [modules.md](../architecture/modules.md)) 을 기반으로 각 use case 를 1 파일씩 분해하는 것이다 ([PLAN.md](../PLAN.md) Phase P2). 이후 phase 의 task 가 본 use case 들을 cover 하는 형태로 진행된다.

본 INDEX.md 는 P2 의 **entry artifact** — 각 UC 본문 (UC-NN-*.md) 의 *목차* 역할만 한다. 다음 항목만 박제:

- UC 목록 표 (UC ID / title / actor / 주요 component / 주요 module / 관련 REQ / status).
- 각 UC 의 1~2 줄 description (어떤 트리거 / 어떤 결과 / 어떤 REQ).
- References + 갱신 룰.

각 UC 의 본격 내용 (actor 의 흐름·sequence diagram·관련 데이터 모델·NFR·post-condition·실패 경로 등) 은 P2 의 후속 task (`P2-Mod-1` ~ `P2-Mod-N`) 가 `docs/use-cases/UC-NN-*.md` 1 파일씩 신설하면서 채운다. 본 INDEX.md 는 living document — 새 UC 가 추가되거나 기존 UC 의 status 가 진행되면 갱신된다.

## 2. UC 목록 표

본 표의 column 정의:

- **UC ID** — `UC-NN` 형식. 본 task 시점에 `UC-01` ~ `UC-08` 의 8 개 use case 식별.
- **title** — 한국어 짧은 제목.
- **actor** — User / Admin / SuperAdmin / Scheduler / System 중 하나 또는 `/` 로 구분된 둘 이상. (README L83–86 의 3 권한 등급 + Scheduler in-process cron + System emit.)
- **주요 component** — [components.md](../architecture/components.md) 의 8 component 명 (Web UI / Backend API / Worker / Scheduler / LLM Gateway / GitHub Adapter / Confluence Adapter / DB Persistence) 만 사용. 오타 0.
- **주요 module** — [modules.md](../architecture/modules.md) 의 8 NestJS module 명 (WebModule / AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / PersistenceModule) 만 사용. 오타 0.
- **관련 REQ** — [requirements.md](../requirements.md) 의 66 REQ ID 만 사용. 존재하지 않는 REQ ID 인용 금지.
- **status** — `PLANNED` (본 INDEX.md 에 row 만 존재) / `IN_PROGRESS` (대응 UC-NN-*.md 본문 task 진행 중) / `DONE` (UC 본문 머지) 의 3 값.

| UC ID | title | actor | 주요 component | 주요 module | 관련 REQ | status |
| --- | --- | --- | --- | --- | --- | --- |
| UC-01 | 평가 실행 (자동 cron + manual trigger) | Scheduler / Admin | Scheduler, Worker, GitHub Adapter, Confluence Adapter, LLM Gateway, DB Persistence | SchedulerModule, AssessmentModule, GithubModule, ConfluenceModule, LlmModule, PersistenceModule | REQ-005, REQ-006, REQ-007, REQ-014, REQ-015, REQ-039, REQ-040, REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055 | DONE |
| UC-02 | 평가 결과 조회 / sort / filter / 시계열 | User / Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-038, REQ-042, REQ-046, REQ-048 | DONE |
| UC-03 | 평가 대상 인원 CRUD + Group / 파트 + Activate/Deactivate | Admin | Web UI, Backend API, DB Persistence | WebModule, UserModule, AuthModule, PersistenceModule | REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-045 | DONE |
| UC-04 | 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급) | SuperAdmin / Admin | Web UI, Backend API, DB Persistence | WebModule, AuthModule, UserModule, PersistenceModule | REQ-043, REQ-044 | DONE |
| UC-05 | LLM 설정 (provider / model / 난이도) | Admin | Web UI, Backend API, LLM Gateway, DB Persistence | WebModule, LlmModule, AuthModule, PersistenceModule | REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055 | DONE |
| UC-06 | 평가 결과 manual delete + 재수집 | Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-037, REQ-041, REQ-045 | DONE |
| UC-07 | Export / Import / Backup / Restore | Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-030, REQ-032, REQ-045 | DONE |
| UC-08 | 권한 부족 인식·통지 (GitHub / Confluence) | System (GitHub Adapter / Confluence Adapter emit → Web UI 표시) | GitHub Adapter, Confluence Adapter, Backend API, Web UI | GithubModule, ConfluenceModule, AssessmentModule, WebModule | REQ-008, REQ-016 | DONE |
| UC-09 | 사용자 지정 기간 임의 평가문 요청 | User / Admin | Web UI, Backend API, Worker, LLM Gateway, DB Persistence | WebModule, AssessmentModule, AuthModule, UserModule, LlmModule, PersistenceModule | REQ-004 | DONE |

총 8 UC. README 의 7 단락 (Assessment Target / 평가 대상 인원 / 평가 자료의 저장 / 평가 자료의 시각화와 UI / 평가 실행 제약 / 보안 특성 / LLM Serving) 에서 추출. functional REQ cover 검증은 후속 task ("Use case 인벤토리 검증", [PLAN.md](../PLAN.md) L84) 에서 본격 수행.

**P2 UC 본문 분해 8/8 closure** — UC-01 ~ UC-08 의 본문 분해 (T-0020 / T-0022 / T-0023 / T-0024 / T-0025 / T-0026 / T-0027 / T-0028) 가 모두 완료되어 본 INDEX.md 의 8 UC 모두 `status: DONE`. 후속 P2 task (api.md / data-model.md / Use case 인벤토리 검증) 는 본 backbone 위에서 진행.

**2026-08-02 재판정 (T-1391)** — 위 closure 선언을 2 축으로 실측 재검산 (§5 갱신 룰 3 "UC 본문 task 가 머지될 때 status 컬럼을 `DONE` 으로 갱신" 의 사후 동기 의무 이행). 축 (a) UC 본문 파일 실재 8/8 (`docs/use-cases/UC-01-*.md` ~ `UC-08-*.md`), §3 description 링크 8 건 모두 실제 파일명과 일치 — broken link 0. 축 (b) 본문 task 8 건 (T-0020 / T-0022 ~ T-0028) frontmatter `status` 모두 `DONE` — 8/8.
판정: **8 row 전부 `DONE` 유지, 표 row 변경 0** (두 축 모두 충족). 미검증 축 — 각 UC 본문의 **내용 충실도**, "관련 REQ" 컬럼과 [requirements.md](../requirements.md) 66 REQ 의 1:1 정합, actor / component / module 컬럼의 오타 0 여부는 본 재판정 범위 밖 (별도 slice).

**2026-08-02 REQ 컬럼 정합 대조 (T-1392)** — 위 T-1391 미검증 축 중 "관련 REQ" 컬럼 정합을 forward (인용 → 실재) 방향으로 실측. 8 row 의 인용 총 **41 건** (UC-01 13 / UC-02 4 / UC-03 7 / UC-04 2 / UC-05 7 / UC-06 3 / UC-07 3 / UC-08 2), unique **33 개**, 대조 대상 [requirements.md](../requirements.md) REQ row **66 건** (unique ID 도 66 — 중복 0).
판정: dangling (인용됐으나 requirements.md 에 부재) **0 건** — 위 26 행 제약 "존재하지 않는 REQ ID 인용 금지" **충족**, 표 row 변경 0. 미검증 축 — 인용 REQ 가 해당 UC 와 **의미적으로** 맞는지, 어느 row 에도 인용되지 않은 REQ 집합 (역방향 coverage — [REQ-COVERAGE-AUDIT.md](REQ-COVERAGE-AUDIT.md) 소관), actor / component / module 컬럼 오타 여부는 본 대조 범위 밖.

**2026-08-03 UC-09 row 등록 (T-1412)** — [T-1411](../tasks/T-1411-uc-09-user-defined-period-evaluation.md) 이 [UC-09 본문](UC-09-user-defined-period-evaluation.md) (174 행) 을 머지함에 따라 §5 갱신 룰 1 (새 UC → 표 row 추가 + 신규 description 단락 추가) · 룰 3 (본문 머지 시 status `DONE`) 을 이행. 위 표에 UC-09 row 1 행 + §3 에 description 블록 1 개 추가 → 현재 총계는 **9 UC** 다. 다만 21 행의 "본 task 시점에 `UC-01` ~ `UC-08` 의 8 개" 와 40 행의 "총 8 UC" 는 [T-0019](../tasks/T-0019-p2-entry-use-case-index.md) 시점 기록이라 **무편집 보존** 한다. 본 row 등록으로 [REQ-COVERAGE-AUDIT.md](REQ-COVERAGE-AUDIT.md) §12.10 축 A 가 "UC-09 미착수" 판정 근거로 든 `grep -c "^| UC-" INDEX.md` = 8 이 **9 로 해소** 됐다.
관련 REQ 컬럼을 `REQ-004` **단독** 으로 둔 근거 — UC-09 frontmatter `coversReq` 가 `[REQ-004]` 단독이고 `adjacentReq` 9 종 (REQ-035 / 038 / 039 / 040 / 043 / 045 / 046 / 048 / 049) 은 [REQ-COVERAGE-AUDIT.md](REQ-COVERAGE-AUDIT.md) §4 104 행의 subset 규칙 ("INDEX.md 의 `관련 REQ` 컬럼이 본 list 의 subset 인 경우 본문 frontmatter 가 정답") 상 본 표에 올리지 않는다. 아래 110 행 closure 문단의 4 값 · gap 서술은 **본 slice 무편집** — audit §3 의 REQ-004 재분류 cascade 가 확정된 뒤 후속 slice 가 동기한다 ([§12.4](REQ-COVERAGE-AUDIT.md) 311 행 의 (e) · (f) 분리 허용).

## 3. 각 UC 별 description

### UC-01 평가 실행 (자동 cron + manual trigger)

Scheduler (`@nestjs/schedule` in-process cron) 의 cron 시각 도달 또는 Admin 의 manual trigger 가 발화. AssessmentModule (Worker 흡수 — [modules.md](../architecture/modules.md) "Components ↔ Modules mapping") 의 평가 파이프라인 service 가 3 GitHub instance + Confluence + LLM gateway 를 거쳐 commit / 문서 별 기여도·난이도·양·LLM 평가문을 생성, DB Persistence (raw 미저장, REQ-032 schema-level 강제) 에 저장. 후속 task 가 평가 파이프라인의 단계별 sequence 와 실패 / 재시도 / 부분 성공 경로를 분해. → [UC-01-evaluation-execution.md](UC-01-evaluation-execution.md)

### UC-02 평가 결과 조회 / sort / filter / 시계열

User / Admin 이 Web UI 의 대시보드를 통해 저장된 평가 결과를 조회. 이름 / ID / 지표별 sorting + filtering, 시간 흐름 (일·주·월 단위) 시계열 표시. 평가 진행 중에는 기존 자료만 표시 + 상단 경고 배너 (REQ-042). 조회·시각화는 3 초 이내 (REQ-048). User 등급은 read-only (REQ-046). → [UC-02-evaluation-query.md](UC-02-evaluation-query.md)

### UC-03 평가 대상 인원 CRUD + Group / 파트 + Activate/Deactivate

Admin 이 Web UI 의 인원 관리 화면에서 평가 대상 인원을 추가·수정·삭제·Deactivate·Activate. 한 인원이 N 서비스 ID (github.com / github.sec / github.ecode / confluence.sec) 를 가지며 일부 NULL 허용 (REQ-023, REQ-025). primary key 역할 ID 1 개 지정 (REQ-024). Group 정책: 임의 group N 개 + 조직도 파트 정확히 1 개 (REQ-028). 휴직 시 Deactivate 로 평가 대상자 명단에서 숨김 (REQ-026). → [UC-03-person-crud.md](UC-03-person-crud.md)

### UC-04 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)

서비스 런칭 후 첫 로긴 사용자가 SuperAdmin (내부적으로 SuperAdmin / Admin / User 의 3 등급) 으로 지정. SuperAdmin 이 사용자 추가 및 등급 승급 / 강등 권한 보유 — Admin → User 강등은 SuperAdmin 만 수행 가능, SuperAdmin 본인의 self-demote 금지 (REQ-044). 모든 기능은 ID / Password 보호 (REQ-043). → [UC-04-account-auth.md](UC-04-account-auth.md)

### UC-05 LLM 설정 (provider / model / 난이도)

Admin 이 Web UI 의 LLM 설정 화면에서 5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI, REQ-051~055) 중 선택, 각 provider 별 endpoint / API key / model 식별자 입력. 3 난이도 모델 슬롯에 각각 다른 (또는 동일) provider/model 매핑 (REQ-050). LLM Gateway 가 평가 파이프라인 호출 시 본 설정에 따라 routing. 어떤 평가 항목이 어떤 난이도인지의 결정은 P4 ADR. → [UC-05-llm-config.md](UC-05-llm-config.md)

### UC-06 평가 결과 manual delete + 재수집

Admin 이 기존 평가 결과의 최근 N 일치 (예: 1 일 / 7 일 / 30 일) 를 수동 삭제 (REQ-041) 하거나 평가 없는 부분 일괄 재평가 또는 Reset & Reeval (REQ-037) 수행. 다음 평가 진행 시 비어있는 시간 구간이 자동 재수집되어 다시 평가됨 (평가 자료의 저장 정책). → [UC-06-evaluation-delete-reeval.md](UC-06-evaluation-delete-reeval.md)

### UC-07 Export / Import / Backup / Restore

Admin 이 저장된 평가 자료 (raw 미포함, REQ-032) 를 Export 하여 backup 하고 Restore 로 reset 할 수 있다 (REQ-030). Web UI 의 Admin 화면 → Backend API → DB Persistence 의 dump/load 경로. 본 use case 는 단일 Admin 권한만 노출 (REQ-045). → [UC-07-export-import.md](UC-07-export-import.md)

### UC-08 권한 부족 인식·통지 (GitHub / Confluence)

GitHub Adapter / Confluence Adapter 가 외부 시스템의 4xx 응답을 감지하면 PermissionDeniedEvent 를 emit. AssessmentModule 이 event 를 받아 DB 에 권한 부족 기록을 남기고, Web UI 가 사용자 (REQ-008 — GitHub) 및 관리자 (REQ-016 — Confluence) 모두 인식할 수 있도록 표시. 시스템 자체가 actor 인 use case — 사람이 직접 trigger 하지 않으나 사람이 인식·대응할 수 있어야 함. → [UC-08-permission-denied.md](UC-08-permission-denied.md)

### UC-09 사용자 지정 기간 임의 평가문 요청

로그인한 User / Admin 이 평가 대상 person 과 기간 좌표 (period + periodStart) 를 지정해 `POST /api/assessment-evaluation/period` 를 호출하면 발화. Scheduler cron / Admin manual trigger 로 발화하는 full-period 파이프라인 (UC-01) 과는 **요청자가 기간 좌표를 들고 온다** 는 trigger 축에서, 이미 저장된 결과를 읽는 조회 경로 (UC-02) 와는 **새 LLM 호출을 동반해 결과를 생성한다** 는 축에서 갈린다. 한 route 안에서 role 이 실행 경로를 dispatch — User 는 self-only ephemeral 분기로 단위별 평가 결과만 응답받고 DB write 0, Admin 은 persist 분기로 Assessment 좌표 row 를 영속화하고 좌표 6 키를 응답받는다 (REQ-004). → [UC-09-user-defined-period-evaluation.md](UC-09-user-defined-period-evaluation.md)

## 4. References

- [docs/PLAN.md](../PLAN.md) — Phase P2 의 6 bullet (L78–91). 본 INDEX.md 가 첫 bullet "Use case 발굴" 의 backbone.
- [docs/architecture/components.md](../architecture/components.md) — T-A3 산출물. UC 목록 표의 "주요 component" 컬럼 값의 source.
- [docs/architecture/modules.md](../architecture/modules.md) — T-A4 산출물. UC 목록 표의 "주요 module" 컬럼 값의 source.
- [docs/requirements.md](../requirements.md) — REQ-NNN source of truth. UC 목록 표의 "관련 REQ" 컬럼 값의 source.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 인덱스 + MVA 원칙. 본 INDEX.md 가 동일 style 을 따른다.
- [docs/architecture/api.md](../architecture/api.md) — API contract (T-0030). 본 INDEX.md 8 UC §5 sequence 가 source 인 HTTP endpoint 표.
- [docs/architecture/deployment.md](../architecture/deployment.md) — T-A2 산출물. UC 의 운영 토폴로지 cross-reference.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest / GitHub Actions stack. 모든 UC 의 구현 기반.
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma. UC 의 영속 저장 기반.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic / secret / scheduler / network. 모든 UC 의 운영 토폴로지 기반.
- [README.md](../../README.md) — 7 단락 (L11–103) 이 본 INDEX.md 의 UC 추출 source.

## 5. 갱신 룰

본 INDEX.md 는 living document. 다음 사건이 발생하면 본 표 및 description 을 갱신한다:

1. **새 UC 가 추가될 때** — README 변경 또는 functional REQ 누락 발견 시. 본 표에 새 row 추가 (UC-NN 번호는 sequential 유지) + 신규 description 단락 추가. planner 가 task 생성 시 본 갱신을 함께 수행.
2. **UC 본문 task 가 진행될 때** — 대응 UC 의 status 컬럼을 `PLANNED` → `IN_PROGRESS` 로 갱신. integrator 가 task 머지 시 또는 driver 가 task 생성 시 갱신 (direct doc-only commit).
3. **UC 본문 task 가 머지될 때** — 대응 UC 의 status 컬럼을 `IN_PROGRESS` → `DONE` 으로 갱신. integrator 가 머지 시 본 INDEX.md 의 row + 본문 파일 (UC-NN-*.md) 의 link 를 동시 갱신.
4. **REQ 가 추가·변경·삭제될 때** — planner 가 [requirements.md](../requirements.md) 변경을 감지하면 본 표의 "관련 REQ" 컬럼을 동기. 삭제된 REQ ID 가 본 표에 남아있으면 reviewer 가 다음 PR 에서 발견.
5. **architecture 변경** — components.md / modules.md 의 component / module 명이 갱신되면 본 표의 "주요 component" / "주요 module" 컬럼을 동기. ADR 신설 시 References 단락에 추가.

본 INDEX.md 는 P2 의 후속 task (`P2-Mod-1` ~ `P2-Mod-N` — 각 UC 별 본문 분해) 와 P2 의 나머지 entry artifact (api.md / data-model.md / directory.md) 의 backbone 으로 사용된다. P3+ 의 모든 task 는 frontmatter 의 `coversReq` 또는 본문 Why 단락에서 본 INDEX.md 의 UC ID 를 인용하여 "본 task 는 UC-03 의 service layer 를 구현한다" 와 같이 추적성을 박제한다.

**REQ ↔ UC coverage audit closure** — 본 INDEX.md 의 8 UC backbone 의 functional REQ cover 완전성은 [REQ-COVERAGE-AUDIT.md](REQ-COVERAGE-AUDIT.md) ([T-0029](../tasks/T-0029-uc-inventory-audit.md)) 에서 audit 됨 (원 출처 2026-05-25). 66 REQ 중 uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 (REQ-004 — 사용자 지정 기간 임의 평가문, UC-09 신설 또는 UC-01 확장 권장).
2026-08-02 재판정: REQ-COVERAGE-AUDIT.md §9 참조 ([T-1390](../tasks/T-1390-uc-index-audit-closure-resync.md) 재검산 결과 위 4 값 · 합 66 모두 매트릭스 실제 분포와 **일치**, REQ-004 는 `gap` 유지 — 근거 실측값은 §9 에 위임).
2026-08-03 재판정: REQ-COVERAGE-AUDIT.md §12 참조 ([T-1405](../tasks/T-1405-req-coverage-matrix-rejudge-scope-design.md) 설계 + [T-1406](../tasks/T-1406-req-coverage-s1-crosscutting-rejudge.md) ~ [T-1408](../tasks/T-1408-req-coverage-s3-infrastructure-rejudge-l212-closure.md) 실판정으로 재판정 후보 17 row 전건을 재검토한 결과 유지 12 / 기록만 5 / **분류 변경 0** 이라 위 4 값 · 합 66 은 무변 — 대조 실측값은 §12.9 에 위임).
2026-08-03 재분류: [T-1411](../tasks/T-1411-uc-09-user-defined-period-evaluation.md) UC-09 본문 신설 → [T-1412](../tasks/T-1412-index-uc09-row-registration.md) 본 INDEX 의 UC-09 row · description 등록 → [T-1413](../tasks/T-1413-req004-gap-to-uc-covered-reclassification.md) 실판정 chain 으로 REQ-004 가 `gap` → `uc-covered` 로 전이해 위 4 값이 **uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66** 으로 갱신 — 판정 근거와 cascade 실행 실측값은 REQ-COVERAGE-AUDIT.md §12.11 · §12.12 에 위임 (118 행의 원 출처 4 값은 시점 기록이라 무편집 보존).

Refs: T-0029, T-0028, T-0027, T-0026, T-0025, T-0024, T-0023, T-0022, T-0020, T-0019, T-0016, T-0017, ADR-0001, ADR-0002, ADR-0003, REQ-005, REQ-006, REQ-007, REQ-008, REQ-014, REQ-015, REQ-016, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-030, REQ-032, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055

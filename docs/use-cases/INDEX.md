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
| UC-02 | 평가 결과 조회 / sort / filter / 시계열 | User / Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-038, REQ-042, REQ-046, REQ-048 | PLANNED |
| UC-03 | 평가 대상 인원 CRUD + Group / 파트 + Activate/Deactivate | Admin | Web UI, Backend API, DB Persistence | WebModule, UserModule, AuthModule, PersistenceModule | REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-045 | PLANNED |
| UC-04 | 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급) | SuperAdmin / Admin | Web UI, Backend API, DB Persistence | WebModule, AuthModule, UserModule, PersistenceModule | REQ-043, REQ-044 | PLANNED |
| UC-05 | LLM 설정 (provider / model / 난이도) | Admin | Web UI, Backend API, LLM Gateway, DB Persistence | WebModule, LlmModule, AuthModule, PersistenceModule | REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055 | PLANNED |
| UC-06 | 평가 결과 manual delete + 재수집 | Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-037, REQ-041, REQ-045 | PLANNED |
| UC-07 | Export / Import / Backup / Restore | Admin | Web UI, Backend API, DB Persistence | WebModule, AssessmentModule, AuthModule, PersistenceModule | REQ-030, REQ-045 | PLANNED |
| UC-08 | 권한 부족 인식·통지 (GitHub / Confluence) | System (GitHub Adapter / Confluence Adapter emit → Web UI 표시) | GitHub Adapter, Confluence Adapter, Backend API, Web UI | GithubModule, ConfluenceModule, AssessmentModule, WebModule | REQ-008, REQ-016 | PLANNED |

총 8 UC. README 의 7 단락 (Assessment Target / 평가 대상 인원 / 평가 자료의 저장 / 평가 자료의 시각화와 UI / 평가 실행 제약 / 보안 특성 / LLM Serving) 에서 추출. functional REQ cover 검증은 후속 task ("Use case 인벤토리 검증", [PLAN.md](../PLAN.md) L84) 에서 본격 수행.

## 3. 각 UC 별 description

### UC-01 평가 실행 (자동 cron + manual trigger)

Scheduler (`@nestjs/schedule` in-process cron) 의 cron 시각 도달 또는 Admin 의 manual trigger 가 발화. AssessmentModule (Worker 흡수 — [modules.md](../architecture/modules.md) "Components ↔ Modules mapping") 의 평가 파이프라인 service 가 3 GitHub instance + Confluence + LLM gateway 를 거쳐 commit / 문서 별 기여도·난이도·양·LLM 평가문을 생성, DB Persistence (raw 미저장, REQ-032 schema-level 강제) 에 저장. 후속 task 가 평가 파이프라인의 단계별 sequence 와 실패 / 재시도 / 부분 성공 경로를 분해. → [UC-01-evaluation-execution.md](UC-01-evaluation-execution.md)

### UC-02 평가 결과 조회 / sort / filter / 시계열

User / Admin 이 Web UI 의 대시보드를 통해 저장된 평가 결과를 조회. 이름 / ID / 지표별 sorting + filtering, 시간 흐름 (일·주·월 단위) 시계열 표시. 평가 진행 중에는 기존 자료만 표시 + 상단 경고 배너 (REQ-042). 조회·시각화는 3 초 이내 (REQ-048). User 등급은 read-only (REQ-046).

### UC-03 평가 대상 인원 CRUD + Group / 파트 + Activate/Deactivate

Admin 이 Web UI 의 인원 관리 화면에서 평가 대상 인원을 추가·수정·삭제·Deactivate·Activate. 한 인원이 N 서비스 ID (github.com / github.sec / github.ecode / confluence.sec) 를 가지며 일부 NULL 허용 (REQ-023, REQ-025). primary key 역할 ID 1 개 지정 (REQ-024). Group 정책: 임의 group N 개 + 조직도 파트 정확히 1 개 (REQ-028). 휴직 시 Deactivate 로 평가 대상자 명단에서 숨김 (REQ-026).

### UC-04 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)

서비스 런칭 후 첫 로긴 사용자가 SuperAdmin (내부적으로 SuperAdmin / Admin / User 의 3 등급) 으로 지정. SuperAdmin 이 사용자 추가 및 등급 승급 / 강등 권한 보유 — Admin → User 강등은 SuperAdmin 만 수행 가능, SuperAdmin 본인의 self-demote 금지 (REQ-044). 모든 기능은 ID / Password 보호 (REQ-043).

### UC-05 LLM 설정 (provider / model / 난이도)

Admin 이 Web UI 의 LLM 설정 화면에서 5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI, REQ-051~055) 중 선택, 각 provider 별 endpoint / API key / model 식별자 입력. 3 난이도 모델 슬롯에 각각 다른 (또는 동일) provider/model 매핑 (REQ-050). LLM Gateway 가 평가 파이프라인 호출 시 본 설정에 따라 routing. 어떤 평가 항목이 어떤 난이도인지의 결정은 P4 ADR.

### UC-06 평가 결과 manual delete + 재수집

Admin 이 기존 평가 결과의 최근 N 일치 (예: 1 일 / 7 일 / 30 일) 를 수동 삭제 (REQ-041) 하거나 평가 없는 부분 일괄 재평가 또는 Reset & Reeval (REQ-037) 수행. 다음 평가 진행 시 비어있는 시간 구간이 자동 재수집되어 다시 평가됨 (평가 자료의 저장 정책).

### UC-07 Export / Import / Backup / Restore

Admin 이 저장된 평가 자료 (raw 미포함, REQ-032) 를 Export 하여 backup 하고 Restore 로 reset 할 수 있다 (REQ-030). Web UI 의 Admin 화면 → Backend API → DB Persistence 의 dump/load 경로. 본 use case 는 단일 Admin 권한만 노출 (REQ-045).

### UC-08 권한 부족 인식·통지 (GitHub / Confluence)

GitHub Adapter / Confluence Adapter 가 외부 시스템의 4xx 응답을 감지하면 PermissionDeniedEvent 를 emit. AssessmentModule 이 event 를 받아 DB 에 권한 부족 기록을 남기고, Web UI 가 사용자 (REQ-008 — GitHub) 및 관리자 (REQ-016 — Confluence) 모두 인식할 수 있도록 표시. 시스템 자체가 actor 인 use case — 사람이 직접 trigger 하지 않으나 사람이 인식·대응할 수 있어야 함.

## 4. References

- [docs/PLAN.md](../PLAN.md) — Phase P2 의 6 bullet (L78–91). 본 INDEX.md 가 첫 bullet "Use case 발굴" 의 backbone.
- [docs/architecture/components.md](../architecture/components.md) — T-A3 산출물. UC 목록 표의 "주요 component" 컬럼 값의 source.
- [docs/architecture/modules.md](../architecture/modules.md) — T-A4 산출물. UC 목록 표의 "주요 module" 컬럼 값의 source.
- [docs/requirements.md](../requirements.md) — REQ-NNN source of truth. UC 목록 표의 "관련 REQ" 컬럼 값의 source.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 인덱스 + MVA 원칙. 본 INDEX.md 가 동일 style 을 따른다.
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

Refs: T-0020, T-0019, T-0016, T-0017, ADR-0001, ADR-0002, ADR-0003, REQ-005, REQ-006, REQ-007, REQ-008, REQ-014, REQ-015, REQ-016, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-030, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055

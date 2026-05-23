# Assessment-Agent — Master Plan

> 이 파일은 planner sub-agent가 점진적으로 채우고 정련한다. 부트스트랩 시점에는 phase 골격만 존재한다.
> 자세한 단위 작업은 [docs/tasks/](tasks/) 의 T-NNNN 파일을 참조.
> 각 phase 의 bullet 은 [README.md](../README.md) 의 지시사항과 [docs/requirements.md](requirements.md) 의 REQ-NNN 매핑을 cover 해야 한다.

상태는 [STATE.json](STATE.json) 의 `phase` 필드와 동기화되어야 한다.

---

## Phase P0 — Bootstrap

목표: 자동 루프가 도는 데 필요한 최소 골격을 만든다.

- [~] T-0001 — ADR-0001 stack 결정 + NestJS 프로젝트 골격 + GitHub Actions CI **(SUPERSEDED — size cap 초과로 4개로 split, HQ-0001 결정)**
- [x] T-0002 — ADR-0001 stack 결정 박제 (NestJS / TS / pnpm / Jest / GHA) (PR-2, 8c6defe)
- [x] T-0003 — 프로젝트 base config (pnpm + tsconfig + ESLint + .gitignore) (PR-3, e6052d4)
- [ ] T-0006 — T-0003 결함 patch: jest.roots 에서 부재 디렉토리 제거 (HQ-0002 결정 b)
- [~] T-0004 — NestJS minimal src skeleton + 첫 sanity test **(BLOCKED — T-0006 merge 후 unblock)**
- [ ] T-0005 — CI workflow 에 lint/build/test step 추가 + README 명령어 단락

**참고**: `.github/workflows/ci.yml` 의 trigger·job 골격은 부트스트랩 단계에서 사용자 명시 요청에 따라 main에 직접 박혀 있다 (skeleton 상태). T-0005는 그 위에 실제 step 들을 채운다.

완료 조건: `pnpm test` 가 통과하는 빈 NestJS 프로젝트가 main에 merge되고, CI가 green.

---

## Phase P0.5 — Test·CI infra hardening (README 110-114 / §3.2 강제층)

목표: README 110–114 의 절대 규칙이 단순 문서 정책이 아니라 **CI 게이트로 강제되는 메커니즘**까지 구축. P0 끝나고 P1 진입 전에 진행 (도메인 코드가 들어가기 전에 test 인프라가 준비돼있어야 효과 큼).

- [ ] T-0007 — CI 에 "신규 production .ts 파일 → 대응 .spec.ts 필수" 검사 step 추가 (간단한 bash check 또는 git diff 분석 step)
- [ ] T-0008 — `pnpm test:cov` 를 CI 에 통합 + 최소 line/branch coverage threshold (낮게 시작, 예: 50%) — jest 설정에 threshold 명시
- [ ] T-0009 — Smoke test 인프라 (supertest 기반) + 1개 sanity smoke + CI 의 `pnpm test:smoke` step 추가 — R-113 (smoke 부분) 충족
- [ ] T-0010 — E2E test 인프라 (NestJS testing module + supertest 또는 별도 runner) + 1개 e2e + CI 의 `pnpm test:e2e` step 추가 — R-113 (e2e 부분) 충족

완료 조건: 변경된 production code 에 spec 누락이 자동으로 CI fail 을 일으키고, coverage threshold 미만이면 CI fail, smoke·e2e 까지 CI 에서 자동 실행되어 R-113 까지 모두 강제된다.

각 task 의 acceptance criteria 는 planner 의 R-112 의무 항목을 따라 happy/error/branch/negative test 자체 가짐 (즉 T-0007 의 검사 step 자체에도 test 가 따라야 한다).

---

## Phase P1 — Architecture (MVA)

목표: 도메인 코드가 들어가기 전에 **꼭 필요한 architecture 결정** 을 박제. 4+1 view 전체가 아니라 **Minimum Viable Architecture** — 코드 시작에 필요한 만큼만, 나머지는 task 진행 중 ADR 로 진화.

- [ ] **P1-Entry** — README → REQ 매핑 표 완성 ([docs/requirements.md](requirements.md) 모든 row 검증). planner 가 자동 생성하는 P1 첫 task. commitMode: direct.
- [ ] **T-A1: Requirement 분리** — FR (Functional Requirement) / NFR (Non-Functional Requirement) / Constraint 컬럼 추가. [docs/requirements.md](requirements.md) 의 `kind` 컬럼을 채운다. 검증 위치 (test 종류) 와 결합.
- [ ] **T-A2: Deployment view** — [docs/architecture/deployment.md](architecture/deployment.md) 신설. 다음을 결정·박제 (ADR-0003):
  - Monolithic NestJS vs queue+worker 분리 (R-91 1h 처리량을 고려)
  - DB (외부 PostgreSQL vs embedded vs sqlite — ADR-0002 로 합쳐도 OK)
  - Secret 저장 (env / vault / file)
  - Scheduler 위치 (NestJS `@nestjs/schedule` / 외부 cron / queue trigger)
  - 외부 네트워크 boundary (Samsung 내부망 접근 — github.sec / ecode)
- [ ] **T-A3: Component view** — [docs/architecture/components.md](architecture/components.md) 신설. mermaid 다이어그램 + 각 component 책임:
  - Web UI (Frontend) ↔ Backend API
  - Worker (평가 파이프라인)
  - DB / Persistence
  - LLM Gateway (5 provider abstraction)
  - GitHub Adapter (3 instance) / Confluence Adapter
  - Scheduler / Trigger
  각 컴포넌트 간 contract (sync/async, message format) 명시.
- [ ] **T-A4: Module view (확장)** — [docs/architecture/modules.md](architecture/modules.md). NestJS module 구조 (AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule). 의존성 방향 acyclic 확인. component view 와 mapping.

완료 조건: 4개 architecture document (deployment / components / modules / 그리고 requirements 의 kind 컬럼) 이 main 에 merge 되고, ADR-0002 (DB) + ADR-0003 (Deployment) 가 ACCEPTED 상태.

이 phase 끝나면 P2 (Use case decomposition) 가 architecture 기반으로 use case 를 각 component / module 에 분류해 진행할 수 있다.

**범위 밖** (over-design 회피, 후속 phase 에서 진화):

- 구체적 데이터 모델 schema (테이블 컬럼) — P3 (Domain core) 에서.
- 구체적 API endpoint signature — P3 / P4 진행 중.
- 구체적 NestJS service 클래스 / 메서드 시그니처 — implementer 책임.
- Frontend 컴포넌트 트리 — P6 (Web UI) 진입 시.

---

## Phase P2 — Use case decomposition

목표: README + P1 architecture 를 기반으로 각 use case 를 1 파일씩 분해. 이후 phase 들의 task 가 use case 를 cover 하는 형태로 진행.

- [ ] Use case 발굴: README 각 섹션 → [docs/use-cases/](use-cases/) 의 `UC-NN-*.md`. 각 use case 는 actor (SuperAdmin / Admin / User / Scheduler / Reviewer Agent) / 트리거 / 흐름 / 데이터 / NFR (성능·보안) / 관련 REQ 명시.
- [ ] 각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑 (sequence diagram 또는 텍스트).
- [ ] **Use case 인벤토리 검증**: requirements.md 의 모든 functional REQ 가 1+ use case 로 cover 되는지 확인. 빠지면 use case 추가.
- [ ] **API contract 초안** — [docs/architecture/api.md](architecture/api.md). use case 흐름 기반으로 HTTP endpoint 목록. 구체 schema 는 P3 에서.
- [ ] **데이터 모델 초안** — [docs/architecture/data-model.md](architecture/data-model.md). 핵심 entity (Person / ServiceIdentity / Assessment / Contribution / Summary / Group / Part / LlmProviderConfig 등) 의 conceptual model. 테이블 컬럼은 P3.
- [ ] **디렉토리 구조 정의** — [docs/architecture/directory.md](architecture/directory.md). NestJS 표준 + module view 와 mapping.

각 항목은 planner가 1~3개의 T-NNNN task로 분할한다. 모두 commitMode: direct 또는 pr (use case 는 doc → direct; api/data-model 은 ADR 동반 시 pr).

---

## Phase P3 — Domain core

목표: 외부 통합 없이 자체적으로 돌릴 수 있는 도메인 핵심.

- [ ] 평가 대상 인원 관리 (CRUD, group, deactivate/activate — 휴직 시 숨김)
- [ ] **서비스별 ID 매핑** — github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등 각 서비스의 ID 보유, 일부 NULL 허용 (R-48)
- [ ] **Primary key 역할 ID 지정** — 서비스 중 1개의 ID 를 기준 식별자로 (예: confluence.sec.samsung.net ID) (R-47)
- [ ] **Group 정책** — 한 인원은 임의 group 다중 소속 가능, 단 조직도 파트는 정확히 1개 (R-51)
- [ ] 평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)
- [ ] **🔥 Raw data 저장 금지 (R-59)** — code commit 본문·문서 변경 본문 등 raw 는 저장하지 않고 평가된 결과 (난이도/기여도/양/평가문) 만 보유. ADR-필수 항목.
- [ ] **상대 비교 가능 데이터 구조** — 개발자 간 동일 metric 비교가 가능한 형태 (R-63)
- [ ] Persistence layer (DB 는 ADR-0002 에서 이미 결정됨 — 본 phase 에서 구현)
- [ ] Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만, 본인 self-demote 금지 (R-84)
- [ ] User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)

---

## Phase P4 — External integrations

- [ ] GitHub 통합 — 3 instance 모두: **github.com / github.sec.samsung.net / github.ecodesamsung.com**. 각 instance 의 URL·org·token 설정 분리.
- [ ] **GitHub Issue 평가** (R-30) — Repo 내 Issue 작성을 문서 기여로 평가. 단 **본인이 본인 follow-up 을 남기고 본인이 소비하는 경우 카운트 제외**.
- [ ] Confluence 통합 — 지정 주소의 Confluence Service 내 **지정 SPACE들** 다중 관리
- [ ] **Confluence SPACE 탐색 정책** (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정.
- [ ] **LLM provider 추상화** — 5 provider: **custom (OpenAI 호환 / 내부 자체 서버 / proxy 가능 / 3 model 슬롯을 모두 custom 으로 채울 수도 있음)** / Azure OpenAI / Anthropic / Google Gemini / OpenAI (R-99~103)
- [ ] **3가지 난이도 모델 할당** (R-97) — 평가 항목별 난이도 분류 + 어떤 항목이 어떤 난이도 모델로 처리될지 구현 과정에서 결정. ADR 로 박제.
- [ ] **Admin 이 LLM 모델 지정** UI (R-96)
- [ ] 자격증명 관리 + **권한 부족 감지·통지** (사용자 + 관리자 모두 인식 가능, R-20·33)

---

## Phase P5 — Evaluation pipeline

- [ ] 단위 commit/document 평가 (난이도·기여도·양)
- [ ] 일/주/월 요약 평가 (LLM 정성 + Metric 수치). **당일 활동은 자정까지 평가 미실시** (R-61). 주간은 다음주 시작 시, 월간은 다음달 시작 시.
- [ ] **사용자 지정 기간** 임의 평가문 생성 (R-9) — Admin/User 가 임의 기간을 지정해 LLM 평가문 요청
- [ ] **중복 제거** — fork/rebase/meld 로 인한 중복 + **시간적 중복** (earlier date 우선 — 2월 결과물이 3월 timestamp 일 때 2월 기여로 판단, R-21)
- [ ] **재수집 정책** — 평가 자료 재수집 시 저장 부분 중복 방지. **최근 1주 는 재수집·중복 제거 OK** (data sync 보호, R-58)
- [ ] **Abusing 방지 metric** — 코드 abusing (commit/PR 숫자만 늘리기, R-26) + **문서 abusing** (의미 없는 기여 단순 반복, R-40)
- [ ] **문서 update 횟수 중립화** (R-41) — 습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage/disadvantage **둘 다 없어야**
- [ ] **품질 분류** (R-37·38) — 단순 보고·copy-paste 로그 = **zero-contribution** / 새 알고리즘 설계·외부 연구 도입 소개자료 = **높은 contribution**
- [ ] **"어렵고 남이 못할 일" 정성 평가** (R-25) — 중요한 기여 / 난이도 높은 기여 식별
- [ ] **저성과자 식별** (R-27) — 코드 기여 현격히 떨어지는 인원 식별
- [ ] 평가 재실행·부분 reset (R-64)

---

## Phase P6 — Web UI

- [ ] 로그인 / SuperAdmin 초기 셋업 흐름
- [ ] 시각화 대시보드 (정렬·필터·시계열)
- [ ] Admin 패널 (인원·그룹·재평가·import/export·스케줄)
- [ ] "평가 진행중" 경고 배너

---

## Phase P7 — Scheduling & operations

- [ ] Admin이 cron 주기 지정 (예: KST 02:00) (R-72)
- [ ] Manual trigger (R-73)
- [ ] 최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)
- [ ] **신규 인원 추가 시 1년치 평가 1회** (R-50) — 일반 인원의 매일 1주일 단위 평가와 분리
- [ ] Import / export / restore (R-57) — 평가 자료 backup/restore
- [ ] **성능 검증**:
  - 100~200명 / 50~100 repo / ~1000 confluence page / **1h 이내** (R-91)
  - **조회·시각화 3초 이내** (R-92) — 이미 저장된 결과 조회 시
- [ ] **평가 진행 중 시각화 보호** (R-78) — 평가 자료 수집/평가 중에는 기존 자료만 표시 + 상단 경고 배너

---

## Phase P8 — Hardening & launch

- [ ] E2E 시나리오 커버리지
- [ ] 보안 점검 (secret 처리, 인증 흐름, RBAC)
- [ ] 운영 문서 (배포·복구·trouble-shoot)
- [ ] 부하·내성 테스트

---

## 의존성

P0 → P0.5 → **P1 (Architecture)** → **P2 (Use case decomposition)** → (P3, P4 병행) → P5 → P6 → P7 → P8

각 phase 내부 task 순서는 planner가 결정한다.

P1 의 architecture document 는 living document — 이후 task 진행 중 architect 가 ADR 와 함께 갱신한다 ([.claude/agents/architect.md](../.claude/agents/architect.md)).

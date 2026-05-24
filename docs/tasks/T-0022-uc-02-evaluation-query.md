---
id: T-0022
title: P2-UC-02 — 평가 결과 조회/sort/filter/시계열 use case 분해 (docs/use-cases/UC-02-evaluation-query.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-042, REQ-046, REQ-048]
estimatedDiff: 160
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 두번째 UC 본문 분해 (UC-02 조회). UC-01 평가 실행의 자연 페어 — 실행 → 조회 = 1·2 most-used flow. T-0020 template 적용.
dependsOn: [T-0019, T-0020]
blocks: []
hqOrigin: null
---

# T-0022 — P2-UC-02: 평가 결과 조회/sort/filter/시계열 use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** 와 **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** 이 머지되어 INDEX.md 8 UC backbone + UC-01 template 박제가 완료됐다. 본 task 는 8 UC 중 **UC-02 평가 결과 조회 / sort / filter / 시계열** 의 본문을 1 파일로 분해한다.

UC-02 는 UC-01 평가 실행의 **자연 페어** — 평가 실행 (UC-01) 의 §8 postcondition 이 본 UC 의 precondition 이 된다. [README.md](../../README.md) L68-71 의 "평가 자료의 시각화와 UI" 단락 (이름/ID/지표별 sort + filter + 일·주·월 시계열) 와 L78 의 "평가 진행 중에는 기존 자료만 + 경고 배너" 가 본 UC 로 수렴한다. INDEX.md 의 UC-02 row 는 3 component (Web UI / Backend API / DB Persistence) + 4 module (WebModule / AssessmentModule / AuthModule / PersistenceModule) 를 거치며 4 REQ (REQ-038, REQ-042, REQ-046, REQ-048) 를 cover 한다.

본 task 의 산출물은 (1) UC-02 본문 1 파일, (2) INDEX.md 의 UC-02 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-02 cover marker 추가. T-0020 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 첫 bullet "Use case 발굴" 의 두 번째 UC 본문 분해)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-02 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 직전 UC 본문 (template + UC-01 의 §8 postcondition 이 UC-02 의 precondition)
- [README.md](../../README.md) L68-71 ("평가 자료의 시각화와 UI" — 이름/ID/지표 sort/filter + 일/주/월 시계열), L78 ("평가 진행 중 기존 자료 + 경고 배너"), L84-86 (3 권한 등급 + User read-only), L92 (조회 3초 이내)
- [docs/architecture/components.md](../architecture/components.md) — UC-02 가 거치는 3 component (Web UI / Backend API / DB Persistence) 의 책임 + contract 정의 (오타 0 인용)
- [docs/architecture/modules.md](../architecture/modules.md) — UC-02 가 거치는 4 module (WebModule / AssessmentModule / AuthModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-02 의 4 primary REQ (REQ-038 sort/filter/시계열, REQ-042 진행 중 보호, REQ-046 User read-only, REQ-048 3초 이내) + 인접 REQ (REQ-043 인증, REQ-044 권한 등급, REQ-045 Admin 전용 — UC-02 에서 부분 cover)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Web UI 가 Backend API 와 같은 process 인지 별 deployment 인지 (monolithic 결정 — UC-02 sequence 의 hop 수에 영향)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0020-uc-01-evaluation-execution.md](T-0020-uc-01-evaluation-execution.md) — UC-01 task 정의서 (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-02 본문 파일 신설

- [ ] `docs/use-cases/UC-02-evaluation-query.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 200 줄 (overly detailed 회피, MVA 원칙). 다음 section 을 본 순서로 포함 (T-0020 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-02`, `title: 평가 결과 조회/sort/filter/시계열`, `actor: User / Admin`, `trigger: Web UI 로그인 후 평가 결과 페이지 접근`, `status: DONE`, `coversReq: [REQ-038, REQ-042, REQ-046, REQ-048]`, `adjacentReq: [REQ-043, REQ-044, REQ-045]`, `relatedUc: [UC-01, UC-04]`, `sourceTask: T-0022`.
  - **1. 개요** — 1~2 단락. UC-02 의 본질 (저장된 평가 결과를 Web UI 가 sort/filter/시계열로 조회) + README L68-71 인용 + UC-01 의 §8 postcondition 이 본 UC 의 precondition 임을 명시.
  - **2. Actor** — User / Admin / SuperAdmin 의 read 권한 (REQ-046 — User 는 조회만, Admin/SuperAdmin 은 추가 권한 보유하나 본 UC scope 안에서는 read 만 cover). 표 형식.
  - **3. Trigger** — Web UI 의 평가 결과 페이지 접근 (login 후). sort 컬럼 변경 / filter 조건 변경 / 시계열 단위 변경 (일/주/월) 도 본 UC 의 trigger 분기 (모두 동일 read 흐름).
  - **4. Preconditions** — 인증 완료 (REQ-043), 사용자 등급 식별 (REQ-044), 평가 데이터 1+ row 존재 (UC-01 의 1+ successful run 후), DB Persistence 가용.
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: User / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. User 가 Web UI 의 평가 결과 페이지 접근 (sort/filter param 포함 가능)
    2. WebUI → BackendAPI 평가 결과 query 요청
    3. AuthModule guard 가 인증·권한 검증 (REQ-043, REQ-044)
    4. AssessmentModule service 가 query 파라미터 (sort 컬럼 / filter 조건 / 시계열 단위) 해석
    5. PersistenceModule 이 평가 결과 row read (raw 미저장 — REQ-032 인접, UC-01 에서 이미 강제됨)
    6. AssessmentRun.status read (진행 중이면 §6.1 alt flow 로 분기 — REQ-042)
    7. AssessmentModule 이 결과 집계 (sort/filter 적용 + 시계열 grouping)
    8. BackendAPI → WebUI 결과 응답 (≤3 초 — REQ-048)
    9. WebUI 가 사용자에게 표시
  - **6. Alternative flows** — (6.1) **평가 진행 중 조회 (REQ-042)**: AssessmentRun.status='RUNNING' 인 경우 WebUI 가 기존 자료만 표시 + 상단 경고 배너 ("평가 진행 중 — 표시되는 데이터는 직전 평가 결과"). (6.2) sort 컬럼 변경 / filter 조건 변경: client-side vs server-side 의 선택 — 본 UC 는 server-side 를 default 로 명시하고 구체 결정은 P6 Web UI ADR 로 위임. (6.3) 시계열 단위 변경 (일/주/월): grouping window 만 다를 뿐 main flow 와 동일.
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 가 401/403 return → WebUI 가 login 페이지 redirect. (7.2) **권한 부족** (REQ-046 — User 가 Admin 전용 컬럼 접근 시): 403 return → WebUI 가 접근 가능 컬럼만 표시. (7.3) **DB read fail**: PersistenceModule 이 connection 끊김 / timeout 시 5xx return → WebUI 가 재시도 안내. (7.4) **평가 데이터 0 row**: UC-01 이 1 번도 successful 안 한 상태 — WebUI 가 "평가 데이터 없음" 표시 + Admin 에게 manual trigger 안내 (UC-01 link).
  - **8. Postconditions** — read-only operation 이므로 시스템 상태 변경 없음. User 화면에 평가 결과 표시 / Audit log 1 row 생성 (조회 ID + user + timestamp + filter param — 구체 schema 는 P3 data-model.md 책임).
  - **9. Component / Module mapping** — 본 UC 가 거치는 3 component + 4 module (INDEX.md 와 정확 일치). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 5 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway) + 4 module (SchedulerModule / GithubModule / ConfluenceModule / LlmModule) 의 위임 표시.
  - **10. 관련 REQ** — 4 primary REQ + 3 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0003 / README L68-71, L78, L84-86, L92 / UC-01 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-02 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-02 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-02 description 단락 (§3 의 UC-02 단락) 의 끝에 `→ [UC-02-evaluation-query.md](UC-02-evaluation-query.md)` link 추가 (UC-01 row 의 동일 pattern).
- [ ] Refs 라인의 끝에 `T-0022` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) L82 의 첫 bullet `[~]` 본문에 "UC-02 본문 분해 ([UC-02-evaluation-query.md](use-cases/UC-02-evaluation-query.md), T-0022) 완료" 한 줄 inline append.
- [ ] L83 의 "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" bullet 끝에 "UC-02 cover ([UC-02](use-cases/UC-02-evaluation-query.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (User / WebUI / BackendAPI / AuthModule / AssessmentModule / PersistenceModule).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over AuthModule: 인증·권한 검증 (REQ-043, REQ-044)`).
- [ ] `alt` block 으로 §6.1 (평가 진행 중 조회) 분기 표시 — main flow 안에 통합.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 160 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. T-0020 review 의 estimatedDiff 가이드 초과 MINOR 를 본 task 에서 동일 패턴으로 흡수 — 본문 ≤200 LOC / 변경 파일 3 의 가이드 안에서.
- [ ] 변경 파일: `docs/use-cases/UC-02-evaluation-query.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-02 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019/T-0020/T-0021 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용.
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-02 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-03 ~ UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-02 만 cover. (T-0020 이 template, 본 task 는 두 번째 적용 — 후속 6 UC 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 GET endpoint (예: `/api/assessments?sort=...&filter=...&window=daily`) 와 entity column 은 후속 api.md / data-model.md 의 첫 row.
- **평가 결과 조회의 실제 controller / service / DB query 구현** — P3 (Domain core) 또는 P6 (Web UI) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P3+.
- **sort/filter/시계열의 server-side vs client-side 결정 ADR** — P6 Web UI ADR. 본 UC 는 server-side 가 default 라는 표시만.
- **시계열 차트 라이브러리 결정 (Chart.js / Recharts / D3 등)** — P6 Web UI 의 별도 ADR. 본 UC 는 시계열 표시가 일/주/월 단위로 가능하다 까지만.
- **AssessmentRun.status 진행 중 보호 (REQ-042) 의 구체 UI** (배너 위치 / 색상 / 문구) — P6 UX 책임. 본 UC 는 "기존 자료 + 경고 배너" 의 conceptual level 만.
- **3 초 이내 (REQ-048) 의 perf test 구체 시나리오** — P7 (Cross-cutting NFR) 의 perf test task. 본 UC 는 NFR 목표만 명시.
- **Audit log schema** (조회 기록) — P3 의 data-model.md 책임. 본 UC 의 §8 postcondition 은 "Audit log 1 row 생성" 까지만.
- **권한 별 노출 컬럼 매트릭스** (User 가 보면 안 되는 컬럼이 있는지) — UC-04 (권한·계정 관리) 의 책임. 본 UC 의 §7.2 는 "권한 부족 → 접근 가능 컬럼만 표시" 까지만.
- **T-0019 / T-0020 / T-0021 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-02 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README L68-71 + L78 + L84-86 + L92 + ADR-0003 + components.md / modules.md / requirements.md 의 cross-reference. UC-01 본문 의 §5 sequence diagram style 그대로 적용. 산출물: UC-02-evaluation-query.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-02-evaluation-query.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 §6.1 진행 중 분기 표시). T-0020 의 frontmatter / section 순서 / Refs 라인 style 정확 일치.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-02-*.md ↔ PLAN.md ↔ UC-01-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

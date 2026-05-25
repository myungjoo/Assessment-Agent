---
id: T-0025
title: P2-UC-05 — LLM 설정 (provider / model / 난이도 매핑) use case 분해 (docs/use-cases/UC-05-llm-config.md)
phase: P2
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-05-25
completed: 2026-05-25T09:50:00+09:00
mergedPr: 24
mergeSha: 8f874a0
plannerNote: P2 다섯번째 UC 본문 분해 (UC-05 LLM 설정). UC-01 이 인용하는 5 provider + 3 난이도 매핑의 source. T-0023/T-0024 template 적용.
dependsOn: [T-0019, T-0024]
blocks: []
hqOrigin: null
resultSummary: PR-24 round 1/7 squash 8f874a0 — UC-05-llm-config.md 225 LOC 신설 + INDEX/PLAN 갱신. 11 section + mermaid 12-step + alt 2 + error flow 6. reviewer 0 BLOCKER/MAJOR 3 MINOR (본문 LOC 가이드 초과 / LLMGateway participant naming / REQ-046 adjacentReq 누락 — 모두 absorbable). CI rerun --failed 7번째 dogfood.
---

# T-0025 — P2-UC-05: LLM 설정 (provider / model / 난이도 매핑) use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** + **UC-01 본문 ([T-0020](T-0020-uc-01-evaluation-execution.md))** + **UC-02 본문 ([T-0022](T-0022-uc-02-evaluation-query.md))** + **UC-03 본문 ([T-0023](T-0023-uc-03-person-crud.md))** + **UC-04 본문 ([T-0024](T-0024-uc-04-account-auth.md))** 까지 머지되어 INDEX.md 8 UC backbone + 4 UC 본문 박제가 완료됐다. 본 task 는 8 UC 중 **UC-05 LLM 설정 (provider / model / 난이도 매핑)** 의 본문을 1 파일로 분해한다.

UC-05 는 [README.md](../../README.md) L93-103 "LLM Serving" 단락의 핵심 흐름 — Admin 이 Web UI 의 LLM 설정 화면에서 5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI) 중 선택하고 각 provider 별 endpoint / API key / model 식별자를 입력, 3 난이도 모델 슬롯에 각각 다른 (또는 동일) provider/model 매핑, LLM Gateway 가 평가 파이프라인 호출 시 본 설정에 따라 routing — 을 박제한다. UC-05 의 cover REQ 는 7 (REQ-049 Admin 이 LLM 모델 지정 / REQ-050 3 난이도 모델 + 항목별 난이도 매핑 / REQ-051 custom provider / REQ-052 Azure OpenAI / REQ-053 Anthropic / REQ-054 Google Gemini / REQ-055 OpenAI) 이며, **UC-01 평가 실행 흐름이 본 UC 가 박제하는 LLM 설정 위에서 동작** — UC-01 §5 의 LLM Gateway hop 이 본 UC 의 설정을 읽는다. UC-01 / UC-04 와 함께 **3 UC 가 시스템 운영의 backbone** (실행 / 권한 / LLM 설정).

본 task 의 산출물은 (1) UC-05 본문 1 파일, (2) INDEX.md 의 UC-05 row 갱신 (PLANNED→DONE), (3) PLAN.md 의 P2 bullet 본문에 UC-05 cover marker 추가. T-0020 / T-0022 / T-0023 / T-0024 template (frontmatter + 11 section + mermaid sequenceDiagram + REQ 매핑 표 + References) 을 그대로 적용한다.

본 task 는 doc-only 이지만 새 파일 신설을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 첫 bullet "Use case 발굴" 의 다섯 번째 UC 본문 분해. PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 로 split 되어 P2 단락이 L39 부근에 위치 — 본문 read 시 최신 L-number 사용)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-05 row + description 단락 (본 task 가 풀어쓸 source)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) — 첫 UC 본문 (template + UC-01 §5 의 LLM Gateway hop 이 본 UC 의 설정을 read 하는 consumer)
- [docs/use-cases/UC-02-evaluation-query.md](../use-cases/UC-02-evaluation-query.md) — 두 번째 UC 본문 (template)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — 세 번째 UC 본문 (template + 6 sub-trigger 통합 sequence pattern)
- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) — 직전 UC 본문 (template + alt block 통합 pattern + Admin write 흐름의 권한 검증 layer)
- [README.md](../../README.md) L83-86 (3 권한 등급 — Admin 이 본 UC actor), L93-103 ("LLM Serving" 단락 — 5 provider + 3 난이도 모델 + 항목별 난이도 매핑 = UC-05 의 핵심 source)
- [docs/architecture/components.md](../architecture/components.md) — UC-05 가 거치는 4 component (Web UI / Backend API / LLM Gateway / DB Persistence) 의 책임 + contract 정의 (오타 0 인용)
- [docs/architecture/modules.md](../architecture/modules.md) — UC-05 가 거치는 4 module (WebModule / LlmModule / AuthModule / PersistenceModule) 의 책임 + component ↔ module mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-05 의 7 primary REQ (REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055) + 인접 REQ (REQ-043 인증 / REQ-044 권한 등급 / REQ-045 Admin 권한)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / TypeScript / pnpm / Jest stack (LLM Gateway 의 구현 기반)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma (LLM 설정 의 persistence layer 기반)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic NestJS + secret 처리 정책 (API key 의 envelope 위치 영향)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고
- [docs/tasks/T-0024-uc-04-account-auth.md](T-0024-uc-04-account-auth.md) — 직전 UC task (본 task 의 template + Acceptance Criteria 패턴)

## Acceptance Criteria

### 1. UC-05 본문 파일 신설

- [ ] `docs/use-cases/UC-05-llm-config.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 200 줄 (overly detailed 회피, MVA 원칙 — UC-05 는 7 REQ 로 UC-03 (7 REQ) 와 동급, UC-04 (2 REQ) 보다 길다). 다음 section 을 본 순서로 포함 (T-0020/T-0022/T-0023/T-0024 template 동일):
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-05`, `title: LLM 설정 (provider / model / 난이도 매핑)`, `actor: Admin`, `trigger: Web UI LLM 설정 화면에서 provider 선택 / endpoint·API key·model 식별자 입력 / 3 난이도 슬롯에 provider+model 매핑`, `status: DONE`, `coversReq: [REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]`, `adjacentReq: [REQ-043, REQ-044, REQ-045]`, `relatedUc: [UC-01, UC-04]`, `sourceTask: T-0025`.
  - **1. 개요** — 1~2 단락. UC-05 의 본질 (LLM provider 설정 + 3 난이도 모델 슬롯 매핑의 박제) + README L93-103 인용 + UC-01 평가 실행과의 관계 (본 UC 의 설정이 UC-01 §5 의 LLM Gateway hop 의 routing source) 명시. 어떤 평가 항목이 어떤 난이도인지의 결정은 P4 의 별도 ADR 책임이라는 점 짧게 언급 (본 UC 의 scope 가 아님).
  - **2. Actor** — Admin (REQ-045 — Admin 권한 / SuperAdmin 은 Admin 의 super set, 본 UC 도 SuperAdmin 수행 가능). User 는 본 UC 의 actor 아님 (REQ-046 read-only). 표 형식.
  - **3. Trigger** — Web UI LLM 설정 화면 진입 후 (a) provider 추가 / 활성화 — 5 provider 중 선택 + endpoint·API key·model 식별자 입력, (b) provider 설정 수정 — endpoint·API key·model 식별자 변경, (c) provider 비활성화 / 삭제, (d) 3 난이도 슬롯 (Easy / Medium / Hard 또는 1·2·3 — 구체 라벨은 P4 ADR) 에 provider+model 매핑 — 4 sub-trigger 가 동일 main flow 로 수렴, write 종류만 다름.
  - **4. Preconditions** — 인증 완료 (REQ-043), 사용자 등급 = Admin or SuperAdmin (REQ-044, REQ-045), DB Persistence 가용, LlmModule service 동작. (CRUD 시 추가 precondition 은 §6 / §7 의 alt/error flow 에서.)
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Admin / WebUI / BackendAPI / AuthModule / LlmModule / PersistenceModule / LLMGateway. 최소 8 단계 ≤ 14 단계 의 sequence. 단계별 한국어 1 줄 라벨 + 관련 REQ 인용. 핵심 단계 포함:
    1. Admin 이 Web UI LLM 설정 화면 접근, action 선택 (provider 추가/수정/삭제/난이도 매핑)
    2. WebUI → BackendAPI write 요청 (POST/PATCH/DELETE /api/llm/providers 또는 PATCH /api/llm/difficulty-mapping 등)
    3. AuthModule guard 가 인증·권한 검증 (REQ-043, REQ-044, REQ-045 — Admin 이상)
    4. LlmModule service 가 request payload 검증 (provider enum 유효 — REQ-051~055 의 5 값 / endpoint URL 형식 / API key 비공백 / model 식별자 비공백 / 난이도 enum 유효 — REQ-050 의 3 슬롯)
    5. PersistenceModule 이 LlmProviderConfig / DifficultyMapping row CRUD (API key 는 암호화 저장 — schema-level 강제, 암호화 방식 P3 ADR 책임)
    6. (provider 추가/수정 시 optional) LlmModule 이 LLMGateway 에 health check 요청 — 새 endpoint·key 가 연결 가능한지 확인 (해당 사항 없으면 skip — 본 UC 는 health check 를 conceptual level 만)
    7. LlmModule → BackendAPI 결과 응답
    8. BackendAPI → WebUI JSON 응답 (API key 는 마스킹된 형태로 반환)
    9. WebUI 가 Admin 에게 결과 표시 (성공 / 검증 실패 / 권한 부족 / health check 결과)
  - **6. Alternative flows** — (6.1) **5 provider 별 설정 차이 (REQ-051~055)**: custom 은 OpenAI 호환 endpoint + 다양한 model + proxy 가능 + 3 슬롯 모두 custom 가능 (REQ-051), 나머지 4 provider 는 각자의 native API endpoint·key 형식 — 본 UC 는 provider 종류 5 의 박제까지만, 각 provider 의 SDK 선택은 P4 ADR. (6.2) **3 난이도 슬롯 매핑 (REQ-050)**: 3 슬롯 각각 동일 provider+model 가능 (예: 모두 custom + 같은 model) 또는 서로 다른 provider+model (예: Easy=Gemini / Medium=Anthropic / Hard=OpenAI) 가능 — 본 UC 는 매핑 invariant 만 (3 슬롯 모두 채워야 함 — 어떤 평가 항목이 어떤 난이도인지의 분류는 P4 ADR). (6.3) **LLM Gateway health check (선택)**: provider 추가/수정 시 health check 옵션 — 새 endpoint·key 가 reachable 한지 확인, fail 시 사용자에게 경고 표시 후 저장 여부 결정 — 본 UC 는 conceptual level 만, 구체 protocol 은 P4. (6.4) **API key 마스킹 / 재입력**: 기존 provider 설정 조회 시 API key 는 마스킹 형태 (예: `sk-****abcd`) 로만 반환 — 수정 시에는 새 key 입력하지 않으면 기존 key 보존, 새 key 입력 시 교체.
  - **7. Error flows** — (7.1) **인증 실패** (REQ-043): AuthModule guard 401 → WebUI login redirect. (7.2) **권한 부족** (REQ-045): User 등급이 본 UC 호출 시 403 → WebUI 가 "Admin 권한 필요" 안내. (7.3) **payload 검증 실패** (REQ-049, REQ-050, REQ-051~055): provider enum 5 중 아님 / endpoint URL 형식 부적합 / API key 빈 값 / model 식별자 빈 값 / 난이도 슬롯 enum 부적합 / 3 슬롯 중 1+ 미채움 → 400 + 검증 메시지. (7.4) **LLM Gateway health check fail** (선택): 새 endpoint·key 가 reachable 하지 않음 → 경고 표시 + 저장 여부 결정 사용자 위임 (저장 강행 가능 — 추후 평가 시 fail 발생). (7.5) **DB write fail**: PersistenceModule connection 끊김 / unique constraint 위반 / 암호화 실패 → 5xx → WebUI 재시도 안내. (7.6) **난이도 매핑 invariant 위반** (REQ-050): 3 슬롯 중 1+ 가 비활성화된 provider 를 가리킴 → 400 + "비활성 provider 참조 불가" 안내.
  - **8. Postconditions** — write operation 이므로 시스템 상태 변경 발생: (a) LlmProviderConfig row CRUD 완료 (API key 는 암호화 저장), (b) DifficultyMapping row 갱신 — 3 슬롯의 provider+model 결정, (c) 변경 즉시 발효 — UC-01 의 다음 평가 파이프라인 호출부터 새 설정 적용 (in-memory cache 가 있다면 invalidate — P4 책임), (d) Audit log 1 row 생성 (변경 종류 + admin user + provider 식별자 + before/after — API key 자체는 audit 에 기록 X, 구체 schema 는 P3 data-model.md 책임), (e) NFR: 본 UC 의 write 흐름은 일반적 CRUD 의 reasonable 응답 시간 (구체 SLA 는 README 명시 없음 — REQ-048 의 3 초는 read 한정). health check 옵션 사용 시 외부 API 호출 latency 가 추가됨.
  - **9. Component / Module mapping** — 본 UC 가 거치는 4 component + 4 module (INDEX.md 의 UC-05 row 와 정확 일치 — Web UI / Backend API / LLM Gateway / DB Persistence + WebModule / LlmModule / AuthModule / PersistenceModule). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로. 본 UC 에서 거치지 않는 4 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter) + 5 module (SchedulerModule / GithubModule / ConfluenceModule / AssessmentModule / UserModule) 의 위임 표시. **LlmModule 의 본 UC 에서의 중심 역할**: 다른 UC 가 LlmModule 을 "LLMGateway 호출 wrapper" 로만 사용한다면 UC-05 는 LlmModule 의 service layer (provider·매핑 CRUD + 선택적 health check) 까지 활용. LLMGateway component 는 본 UC 의 §6.3 health check 흐름의 conceptual receiver — 실제 평가 routing 의 consumer 는 UC-01.
  - **10. 관련 REQ** — 7 primary REQ + 3 인접 REQ 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0001 / ADR-0002 / ADR-0003 / README L83-86, L93-103 / UC-01·UC-02·UC-03·UC-04 본문 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-05 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-05 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-05 description 단락 (§3 의 UC-05 단락) 의 끝에 `→ [UC-05-llm-config.md](UC-05-llm-config.md)` link 추가 (UC-01 / UC-02 / UC-03 / UC-04 row 의 동일 pattern).
- [ ] Refs 라인의 끝에 `T-0025` 추가.

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) 의 P2 첫 bullet `[~]` 본문에 "UC-05 본문 분해 ([UC-05-llm-config.md](use-cases/UC-05-llm-config.md), T-0025) 완료" 한 줄 inline append. (PLAN.md 가 commit 98ace27 에서 PLAN_archive.md 분리 후 L-number 변경됐으므로 implementer 는 작업 시 최신 L-number 재확인.)
- [ ] P2 두 번째 bullet "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" 끝에 "UC-05 cover ([UC-05](use-cases/UC-05-llm-config.md) §5 sequence + §9 component/module mapping)" inline append (UC-01 / UC-02 / UC-03 / UC-04 의 동일 pattern).

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (Admin / WebUI / BackendAPI / AuthModule / LlmModule / PersistenceModule / LLMGateway).
- [ ] sequence step 수: 8 이상 14 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over LlmModule: provider enum·endpoint URL·API key·model 식별자·난이도 enum 검증 (REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055)`).
- [ ] `alt` block 으로 §6.3 (LLM Gateway health check 선택 흐름) 또는 §6.1 (5 provider 별 설정 차이) 분기 표시 — main flow 안에 통합.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, markdown lint 가 있다면 통과 — Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 / T-0022 / T-0023 / T-0024 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 190 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-05 는 7 REQ (UC-03 동급) 라서 본문 길이 UC-03 (200 LOC) 와 유사 — 본문 ≤200 LOC / 변경 파일 3 의 가이드 안에서.
- [ ] 변경 파일: `docs/use-cases/UC-05-llm-config.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-05 cover marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019/T-0020/T-0021/T-0022/T-0023/T-0024 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (6번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-05 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-06 ~ UC-08 본문 분해** — 후속 P2 sub-task. 본 task 는 UC-05 만 cover. (T-0020 / T-0022 / T-0023 / T-0024 template, 본 task 는 다섯 번째 적용 — 후속 3 UC 도 동일 pattern.)
- **api.md / data-model.md 신설** — P2 의 별도 entry artifact task. 본 UC 에서 사용되는 write endpoint (예: `POST /api/llm/providers`, `PATCH /api/llm/providers/:id`, `PATCH /api/llm/difficulty-mapping`) 와 entity column (LlmProviderConfig / DifficultyMapping 의 column·index·암호화 컬럼) 은 후속 api.md / data-model.md 의 row.
- **LLM provider 설정 / 난이도 매핑 의 실제 controller / service / DB schema 구현** — P4 (External integrations) 범위. 본 UC 의 §5 sequence step 은 어떤 component 가 무엇을 하는지의 어디서 level — 어떻게 의 코드 level 은 P4.
- **5 provider 의 SDK 선택 / wrapper 구현** (OpenAI SDK / Anthropic SDK / Google AI SDK / Azure OpenAI SDK / custom HTTP client) — P4 의 별도 task + 별도 ADR. 본 UC 는 5 provider 의 존재 박제만.
- **3 난이도 모델 슬롯 의 라벨링 (Easy/Medium/Hard 또는 1/2/3) 및 어떤 평가 항목이 어떤 난이도인지 매핑** — README L97 명시 ("구현하면서 결정") 대로 P4 의 별도 ADR 책임. 본 UC §6.2 는 "3 슬롯 매핑 invariant" 만, 슬롯 라벨·항목 매핑은 P4.
- **API key 의 암호화 방식 / 키 관리** (envelope encryption / KMS / 환경변수) — P3 또는 P4 의 별도 ADR 책임. 본 UC §8 (a) 는 "암호화 저장" 의 conceptual level 만.
- **LlmProviderConfig / DifficultyMapping entity 의 ERD / 컬럼 / 인덱스 / 암호화 컬럼 정의** — P3 data-model.md 책임. 본 UC 는 conceptual level 만.
- **LLM Gateway health check 의 구체 protocol** (ping endpoint / dummy completion / timeout 처리) — P4 의 service layer 책임. 본 UC §6.3 / §7.4 는 conceptual level 만.
- **LLM Gateway 의 routing logic (난이도 → provider 선택 → API 호출)** — UC-01 / P4 / P5 책임. 본 UC 는 routing source data (LlmProviderConfig + DifficultyMapping) 박제까지만.
- **Audit log schema** (LLM 설정 변경 기록) — P3 의 data-model.md 책임. 본 UC §8 (d) 는 "Audit log 1 row 생성 + API key 자체는 기록 X" 까지만.
- **LLM 설정 화면의 구체 UI / 컴포넌트 / form 검증** — P6 (Web UI) 책임. 본 UC 는 어디서 / 무엇을 까지만, 어떻게 는 P6.
- **외부 LLM 호출의 retry / circuit breaker / rate limit / 비용 추적** — P4 / P5 의 책임. 본 UC 는 LLM 설정의 박제만 — 호출 흐름은 UC-01.
- **T-0017~T-0024 review 의 MINOR follow-up 들** — 본 task scope 밖. 단 본 task 가 INDEX.md / PLAN.md 를 갱신하는 김에 인접 1 건 (예: UC-08 actor 컬럼 길이 또는 PR-TBD placeholder) 발견 시 incidental 처리 가능 — 별도 acceptance 추가 의무 없음.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-05 의 main flow / alt flows / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README L93-103 + L83-86 + components.md / modules.md / requirements.md 의 cross-reference. UC-04 본문 의 §5 sequence diagram style 그대로 적용. 본 UC 의 4 sub-trigger (provider 추가/수정/삭제/난이도 매핑) 와 4 alt flow (5 provider 차이 / 3 난이도 슬롯 매핑 / health check 선택 / API key 마스킹) 를 어떻게 sequence 1 개로 통합할지 결정 (T-0024 의 main flow + alt block 통합 pattern 적용). 본 UC 의 핵심 invariant 인 "3 난이도 슬롯 모두 채움" 과 "API key 암호화 저장 + 마스킹 반환" 을 §7.6 / §8 (a) 에 단단히 박제. 산출물: UC-05-llm-config.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음.
- **implementer**: architect 의 outline 을 따라 UC-05-llm-config.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성 (alt block 으로 §6.3 health check 또는 §6.1 5 provider 차이 분기 표시). T-0020 / T-0022 / T-0023 / T-0024 의 frontmatter / section 순서 / Refs 라인 style 정확 일치. PLAN.md L-number 는 commit 98ace27 refactor 이후 변경된 최신 값 사용.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증. INDEX.md ↔ UC-05-*.md ↔ PLAN.md ↔ UC-01-*.md / UC-02-*.md / UC-03-*.md / UC-04-*.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

---
id: T-0019
title: P2-Entry — Use case index 신설 (docs/use-cases/INDEX.md + UC-NN row 목록 + actor/component/module/REQ 매핑)
phase: P2
status: DONE
commitMode: pr
coversReq: [TBD]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-05-24
completedAt: 2026-05-24
plannerNote: P2-Entry — use-cases/INDEX.md 신설 (UC-NN 목록 + actor/component/module/REQ 매핑). 후속 UC-NN 분해 task 들의 backbone. pr-mode doc-only.
dependsOn: [T-0017]
blocks: [P2-Mod-1, P2-Mod-2, P2-API, P2-DataModel, P2-Directory]
hqOrigin: null
---

# T-0019 — P2-Entry: Use case index 신설

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 **목표**는 "README + P1 architecture 를 기반으로 각 use case 를 1 파일씩 분해. 이후 phase 들의 task 가 use case 를 cover 하는 형태로 진행" 이다. P1 (Architecture / MVA) 가 [T-0017](T-0017-t-a4-module-view.md) 머지로 전체 완료 — 8 component ([components.md](../architecture/components.md)) + 8 NestJS module ([modules.md](../architecture/modules.md)) + 3 ADR (stack / DB / deployment) 가 박제됐다. 이제 P2 의 backbone 이 될 **use case 인벤토리** 가 필요하다.

본 task 는 P2 의 **entry task** — 각 UC 본문 파일 (UC-NN-*.md) 의 본격 분해 (actor / trigger / 흐름 / 데이터 / NFR / sequence) 는 후속 task 의 책임이고, 본 task 는 그 **목록과 매핑 표** 만 박제한다. CLAUDE.md `## Phase entry task 자동 생성` 의 P2 entry sequence ("Use case 인벤토리 — README → docs/use-cases/UC-NN-*.md 1 개씩, 모든 functional REQ 가 1+ use case 로 cover 되는지 검증") 의 첫 단계.

본 task 가 박제하는 UC 목록은 다음 task 들의 기반:

- **P2 후속 task (UC-NN 별 본문 분해)**: 각 UC 파일이 본 task 의 INDEX.md row 1 개를 풀어서 actor / 트리거 / 흐름 / sequence / 관련 REQ / 관련 component / 관련 module 을 박제.
- **P2 api.md**: HTTP endpoint 목록이 본 task 의 UC 흐름에서 도출.
- **P2 data-model.md**: entity 목록이 본 task 의 UC 가 다루는 데이터에서 도출.
- **P2 directory.md**: NestJS 표준 디렉토리 구조가 [modules.md](../architecture/modules.md) 의 8 module 을 src/<module>/... 로 mapping.
- **P3+ 모든 phase**: 각 task 의 frontmatter `coversReq` / 본문 Why 가 본 task 의 UC ID 를 인용 (예: "본 task 는 UC-03 (인원 CRUD) 의 service layer 를 구현한다").

본 task 가 cover 하는 REQ: P2 entry 단계이므로 직접 cover 하는 REQ 는 없다 — 후속 UC-NN 분해 task 들이 각 UC 의 관련 REQ 를 covers. 본 task 의 frontmatter `coversReq: [TBD]` 는 본 task 가 enumeration 만 한다는 의미.

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다 — 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 첫 bullet "Use case 발굴" 의 entry step)
- [README.md](../../README.md) 전체 (use case 추출 source — 특히 L11-103 의 "Assessment Target / 평가 대상 인원 / 평가 자료의 저장 / 평가 자료의 시각화와 UI / 평가 실행 제약 / 보안 특성 / LLM Serving" 7 단락)
- [docs/architecture/components.md](../architecture/components.md) — 8 component 명 (UC 별 "주요 component" 컬럼 채울 때 정확히 일치해야 함, 오타 0)
- [docs/architecture/modules.md](../architecture/modules.md) — 8 module 명 (UC 별 "주요 module" 컬럼 채울 때 정확히 일치해야 함, 오타 0)
- [docs/requirements.md](../requirements.md) — 66 REQ 목록 (UC 별 "관련 REQ" 컬럼 채울 때 ID 정확히 일치)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + 본 INDEX.md 의 style 참고
- [docs/tasks/T-0017-t-a4-module-view.md](T-0017-t-a4-module-view.md) — P1 마지막 task 의 산출물 + style 참고

## Acceptance Criteria

본 task 는 pr-mode 이므로 [CLAUDE.md §3.2 R-110](../../CLAUDE.md) 가 active — tester 가 `pnpm lint && pnpm build && pnpm test` 실행 의무. 단 production code 0 LOC (doc-only) 이므로 R-112 (unit test 4 종) 는 **N/A** — task 본문에 "doc-only — R-112 N/A" 명시.

- [ ] **AC-1: docs/use-cases/INDEX.md 신설**. 한국어 ≥ 40 줄. 디렉토리 [docs/use-cases/](../use-cases/) 가 없으면 함께 생성 (.gitkeep 또는 INDEX.md 자체로 디렉토리 생성).
- [ ] **AC-2: INDEX.md 구조**. 다음 5 section 을 모두 포함 (heading 명은 한국어 또는 영어 통일):
  - (1) 개요 — P2 (Use case decomposition) 의 목적 + 본 INDEX.md 의 위치 (P2 의 backbone, 각 UC 본문 파일의 목차) + living document 명시 + 본 PR/SHA 박제 자리 (`> 본 문서는 P2 entry task [T-0019] 의 산출물이다.` 한 줄).
  - (2) UC 목록 표 — 7 컬럼: `UC ID | title | actor | 주요 component | 주요 module | 관련 REQ | status`. ≥ 5 row (≥ 5 UC), 권장 6~8 row.
  - (3) 각 UC 별 1 줄 description — 표 뒤에 `### UC-NN <title>` heading + 1~2 줄 description (어떤 트리거 / 어떤 결과 / 어떤 REQ 와 관련. P3+ task 에서 본격 분해 예고).
  - (4) References — PLAN.md / components.md / modules.md / requirements.md 4 파일 링크 + ADR-0001/0002/0003 링크.
  - (5) 갱신 룰 — 새 REQ 추가 시 / 새 UC 추가 시 / UC 본문 task 머지 시 본 표의 status 컬럼 갱신 룰 (3~5 줄).
- [ ] **AC-3: UC 목록 ≥ 5 (권장 6~8)**. README 의 명세에서 추출. 다음 후보를 권장 (planner 가 README 를 읽고 추출한 결과 — implementer 는 README 를 재확인 후 조정 가능):
  - **UC-01 평가 실행 (자동 cron + manual trigger)** — actor: Scheduler / Admin. component: Scheduler + Worker + GitHub Adapter + Confluence Adapter + LLM Gateway + DB Persistence. module: SchedulerModule + AssessmentModule + GithubModule + ConfluenceModule + LlmModule + PersistenceModule. REQ: REQ-005~007, REQ-014, REQ-015, REQ-039, REQ-040, REQ-049, REQ-051~055.
  - **UC-02 평가 결과 조회 / sort / filter / 시계열** — actor: User / Admin. component: Web UI + Backend API + DB Persistence. module: WebModule + AssessmentModule + AuthModule + PersistenceModule. REQ: REQ-038, REQ-042, REQ-046, REQ-048.
  - **UC-03 평가 대상 인원 CRUD + Group / 파트 + Activate/Deactivate** — actor: Admin. component: Web UI + Backend API + DB Persistence. module: WebModule + UserModule + AuthModule + PersistenceModule. REQ: REQ-023~028, REQ-045.
  - **UC-04 권한·계정 관리 (SuperAdmin 첫 로긴 / 등급 승급)** — actor: SuperAdmin / Admin. component: Web UI + Backend API + DB Persistence. module: WebModule + AuthModule + UserModule + PersistenceModule. REQ: REQ-043, REQ-044.
  - **UC-05 LLM 설정 (provider / model / 난이도)** — actor: Admin. component: Web UI + Backend API + LLM Gateway + DB Persistence. module: WebModule + LlmModule + AuthModule + PersistenceModule. REQ: REQ-049, REQ-050, REQ-051~055.
  - **UC-06 평가 결과 manual delete + 재수집** — actor: Admin. component: Web UI + Backend API + DB Persistence. module: WebModule + AssessmentModule + AuthModule + PersistenceModule. REQ: REQ-037, REQ-041, REQ-045.
  - **UC-07 Export / Import / Backup / Restore** — actor: Admin. component: Web UI + Backend API + DB Persistence. module: WebModule + AssessmentModule + AuthModule + PersistenceModule. REQ: REQ-030, REQ-045.
  - **UC-08 권한 부족 인식·통지** — actor: System (GitHub Adapter / Confluence Adapter 가 emit, Web UI 가 표시). component: GitHub Adapter + Confluence Adapter + Backend API + Web UI. module: GithubModule + ConfluenceModule + AssessmentModule + WebModule. REQ: REQ-008, REQ-016.

  implementer 가 README 재확인 후 위 8 UC 후보 중 충분히 enumerable 한 것 ≥ 5 개를 채택 (모두 채택해도 무방, 일부 추가/삭제도 무방 — 단 후속 task Follow-ups 에 변경 이유 메모).
- [ ] **AC-4: actor 컬럼 값** = `User` / `Admin` / `SuperAdmin` / `Scheduler` / `System` 중 하나 (또는 둘 이상 `/` 로 구분). README 의 권한 정의 (L83-86) + Scheduler / System 추가.
- [ ] **AC-5: component 컬럼 값** 은 [components.md](../architecture/components.md) 의 8 component (Web UI / Backend API / Worker / Scheduler / LLM Gateway / GitHub Adapter / Confluence Adapter / DB Persistence) 명과 **정확히 일치**. 오타 0. (Implementer 가 components.md 의 component 명을 grep 으로 확인 권장.)
- [ ] **AC-6: module 컬럼 값** 은 [modules.md](../architecture/modules.md) 의 8 NestJS module (AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule / SchedulerModule / WebModule) 명과 **정확히 일치**. 오타 0.
- [ ] **AC-7: 관련 REQ 컬럼** 의 REQ-NNN ID 가 [requirements.md](../requirements.md) 의 66 REQ ID 와 **정확히 일치**. 존재하지 않는 REQ ID 인용 금지 (T-0015 round 1 REQUEST_CHANGES 의 REQ-099~103 사례 재발 방지).
- [ ] **AC-8: status 컬럼** 의 초기값은 모두 `PLANNED`. 후속 UC 본문 task 가 머지될 때 `IN_PROGRESS` → `DONE` 으로 갱신 (갱신 룰 section 에 명시).
- [ ] **AC-9: PLAN.md L82** ("Use case 발굴: README 각 섹션 → docs/use-cases/ 의 UC-NN-*.md") 에 본 task 의 closure 표시. 형식: 해당 bullet 의 `- [ ]` → `- [x]` 변경 + 본 task ID + 머지 SHA / PR# 박제 (예: `T-0019, PR-NN, SHA <abbrev>`).
- [ ] **AC-10: production code 0 LOC** — `src/` / `web/` / `test/` / `package.json` / `package-lock.json` / `pnpm-lock.yaml` / `.github/workflows/` 변경 0. doc-only.
- [ ] **AC-11: 신규 dependency 0**. package.json 의 dependencies / devDependencies 변경 0.
- [ ] **AC-12: R-110 (pr-mode) 활성** — tester 가 `pnpm lint && pnpm build && pnpm test` 실행 후 모두 pass 확인. R-112 는 doc-only 이므로 **N/A** — PR 본문에 "doc-only — R-112 N/A" 명시.
- [ ] **AC-13: size cap 준수** — diff ≤ 300 LOC, 변경 파일 ≤ 5 개. 예상치: INDEX.md (~50 LOC) + PLAN.md L82 closure (~3 LOC) + 본 task 파일 status/completedAt/Follow-ups 갱신 (~10 LOC) + (선택) `docs/use-cases/.gitkeep` 또는 디렉토리 생성용 placeholder = 80~100 LOC / 2-3 파일.
- [ ] **AC-14: 4-gate (CLAUDE.md §3.3)** — reviewer APPROVE + PR comment 외화 + integrator self-check OK + CI 7 step green.

## Out of Scope

본 task 는 P2 의 **entry / enumeration** 만 책임진다. 다음은 모두 **후속 task** 의 책임 — 본 task 에서 손대지 말 것 (cap 보호 + scope creep 방지):

- 각 UC 본문 파일 (UC-NN-*.md) 의 신설. 각 UC 가 별도 task (예: P2-Mod-1: UC-01 평가 실행 본문, P2-Mod-2: UC-02 조회·sort·filter, ...) 로 분해. 본 task 의 INDEX.md 는 row 1 줄 + 1~2 줄 description 까지만.
- [docs/architecture/api.md](../architecture/api.md) (HTTP endpoint 목록) — PLAN.md L85 의 별도 bullet.
- [docs/architecture/data-model.md](../architecture/data-model.md) (entity conceptual model) — PLAN.md L86 의 별도 bullet.
- [docs/architecture/directory.md](../architecture/directory.md) (NestJS 표준 디렉토리 구조) — PLAN.md L87 의 별도 bullet.
- 새 ADR. 본 task 는 enumeration 만 — 새 architectural decision 없음. (UC 별 본격 분해 task 에서 필요 시 ADR.)
- production code (`src/`, `web/`) 변경. doc-only.
- 새 dependency 추가. CLAUDE.md §5 HITL 룰 적용 — 발견 시 즉시 BLOCKED 전환.
- requirements.md 의 REQ row 추가 / 갱신. 본 task 는 read-only 로 인용만 — REQ 변경은 별도 task (planner 가 README 변경 감지 시).
- components.md / modules.md 변경. 본 task 는 read-only 로 component / module 명 인용만.
- sequence diagram (mermaid) — UC 본문 task 의 책임. 본 task 는 표 + 1~2 줄 description 만.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect** — README (L11-103) 를 읽고 use case 후보 추출. AC-3 권장 8 UC 후보를 README 와 대조하여 ≥ 5 개 채택 결정. components.md / modules.md / requirements.md 의 정확한 명칭 / ID 와 cross-check (오타 0 보증). INDEX.md outline 작성 (5 section + 표 schema 박제).
- **implementer** — architect outline 기반으로 INDEX.md 본문 작성 (한국어 ≥ 40 줄). PLAN.md L82 closure 표시. 본 task 파일 status/completedAt/Follow-ups 갱신.
- **tester** — `pnpm lint && pnpm build && pnpm test` 실행 후 pass 확인. R-112 doc-only N/A 명시. CI 7 step green 확인 (push 후 `gh run watch`).

## Follow-ups

본 task executor 가 진행 중 식별한 후속 task 후보 (planner 가 P2 진행 시 task 생성 후보로 검토):

- **P2-Mod-1 ~ P2-Mod-8** — 각 UC (UC-01 ~ UC-08) 별 본문 파일 (`docs/use-cases/UC-NN-*.md`) 신설. 각 task 는 1 UC 만 분해 (size cap 보호) — actor 의 단계별 흐름 / sequence diagram (mermaid) / 데이터 model 후보 entity 명세 / NFR (성능·보안) / 실패·재시도 경로 / post-condition. 분해 우선순위: UC-04 (auth, P3 의 RBAC 모듈 기반) → UC-03 (인원 관리) → UC-01 (평가 실행, 가장 복잡) → UC-02 (조회 / UI) → 나머지.
- **P2-API entry** — `docs/architecture/api.md` 신설 (PLAN.md L85). 본 INDEX.md 의 8 UC 흐름에서 도출되는 HTTP endpoint 목록을 모아 단일 표로 박제. 구체 schema 는 P3.
- **P2-DataModel entry** — `docs/architecture/data-model.md` 신설 (PLAN.md L86). 본 INDEX.md 의 8 UC 가 다루는 entity (Person / ServiceIdentity / Assessment / Contribution / Summary / Group / Part / LlmProviderConfig 등) 의 conceptual model. 테이블 컬럼은 P3.
- **P2-Directory entry** — `docs/architecture/directory.md` 신설 (PLAN.md L87). NestJS 표준 디렉토리 구조 + [modules.md](../architecture/modules.md) 의 8 module ↔ `src/<module>/...` mapping.
- **Use case 인벤토리 검증** — [PLAN.md](../PLAN.md) L84 의 별도 bullet. 본 INDEX.md 머지 후 functional REQ 중 본 표의 어느 UC 에도 cover 되지 않은 REQ 가 있는지 검증 → 빠지면 UC 추가. 본 task 시점에 candidate 검사:
  - REQ-002 (Web Interface 제공) — UC-02 + UC-03 + UC-04 + 모든 Admin UI UC 가 분산 cover (UI 의 존재 자체가 actor 가 Web UI 인 모든 UC 로 cover). pass.
  - REQ-003 (양·질 평가 / 저장 / 표시) — UC-01 + UC-02. pass.
  - REQ-004 (사용자 지정 기간 LLM 평가 코멘트) — UC-02 의 시계열 + UC-01 의 LLM 평가문 생성. pass.
  - REQ-009 (Fork/Rebase/Meld 중복 제거) — UC-01 의 평가 파이프라인 내부 — 표면화 안 됨. **후속 분해 시 UC-01 본문에 명시 필요**.
  - REQ-010~013 (코드 평가 목표 — 양/질/abusing/저성과자) — UC-01 의 LLM + Metric. cover.
  - REQ-018~022 (문서 평가 목표 — 보고·copy-paste / 새 알고리즘 / 조직 기여 / 문서 abusing / update 횟수 중립화) — UC-01 의 Confluence Adapter + LLM. cover.
  - REQ-029, REQ-031, REQ-032, REQ-033 (저장 정책 — non-volatile / 재수집 / raw 금지 / commit·문서 단위) — UC-01 의 DB Persistence + UC-06 의 재수집. cover.
  - REQ-034, REQ-035, REQ-036 (일·주·월 요약 + 상대 비교) — UC-01 의 LLM + Metric. cover.
  - REQ-047 (100~200명 / 1h 이내) — NFR. UC-01 의 평가 파이프라인. cover (NFR 별도 검증).
- **UC-08 의 actor 명** — 본 INDEX.md 는 "System" 으로 표기. 후속 UC-08 본문에서 정확한 trigger (외부 GitHub/Confluence 의 4xx response) + receiver (사용자 + 관리자 모두, REQ-008 / REQ-016) 를 명시할 때 actor 정의 재검토. 필요 시 PLAN.md 의 actor 정의 (현재 "SuperAdmin / Admin / User / Scheduler / Reviewer Agent") 에 "System" 추가 검토.
- **R-112 N/A 명시** — 본 task 는 doc-only (production code 0 LOC). PR 본문에 "doc-only — R-112 N/A" 명시 (driver 가 PR 생성 시).

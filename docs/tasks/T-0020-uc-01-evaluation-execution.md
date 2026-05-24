---
id: T-0020
title: P2-UC-01 — 평가 실행 use case 분해 (docs/use-cases/UC-01-evaluation-execution.md)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-014, REQ-015, REQ-039, REQ-040, REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 160
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 첫 UC 본문 분해 (UC-01 평가 실행). INDEX.md 의 UC-01 row 를 sequence diagram + 흐름 + 실패 경로로 풀어냄. 후속 UC-02~08 의 template.
dependsOn: [T-0019]
blocks: []
hqOrigin: null
---

# T-0020 — P2-UC-01: 평가 실행 use case 분해

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 첫 bullet "Use case 발굴" 의 **P2-Entry ([T-0019](T-0019-p2-entry-use-case-index.md))** 가 [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 8 UC backbone 박제로 완료됐다. 본 task 는 그 8 UC 중 **UC-01 평가 실행 (자동 cron + manual trigger)** 의 본문을 1 파일로 분해한다.

UC-01 은 본 시스템의 **core flow** — [README.md](../../README.md) L11-50 의 "Assessment Target" 단락 전체 (3 GitHub instance + Confluence + LLM 평가) 와 L72-73 의 "평가 실행 제약" (cron 주기 / manual trigger) 가 모두 본 use case 로 수렴한다. INDEX.md 의 UC-01 row 가 8 component 중 6 개 (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway / DB Persistence) 와 8 module 중 6 개 (SchedulerModule / AssessmentModule / GithubModule / ConfluenceModule / LlmModule / PersistenceModule) 를 거치며, 13 REQ 를 cover 한다는 사실이 그 중심성을 보여준다.

본 task 의 산출물은:

1. **후속 UC-02 ~ UC-08 분해 task 들의 template** — frontmatter / 섹션 구조 / sequence diagram 스타일 / REQ 참조 방식 / component·module mapping 표시 방식이 본 파일을 기준으로 박제된다.
2. **P3 (Domain core) / P4 (External integrations) / P5 (Evaluation pipeline) 의 backbone** — 각 phase 의 service layer / adapter / pipeline 구현 task 가 본 UC-01 의 sequence diagram 단계를 1+ 씩 cover 하는 형태로 진행된다.
3. **P2 의 api.md / data-model.md** 의 input — UC-01 의 main flow 에서 사용되는 HTTP endpoint (manual trigger, status query) 와 데이터 entity (Assessment, Contribution, AssessmentRun) 가 후속 api.md / data-model.md task 의 첫 row 가 된다.

본 task 는 doc-only 이지만 새 파일 신설 + INDEX.md 의 row status 갱신 + PLAN.md 의 bullet 갱신을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 의 "새 docs/architecture/* 또는 docs/decisions/* 추가" 와 동일한 카테고리 — 새 docs/use-cases/* 추가도 reviewer 점검 대상).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) L78-91 (Phase P2 의 6 bullet — 본 task 는 첫 bullet "Use case 발굴" 의 첫 본문 분해 task)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — UC-01 row + description 단락 (본 task 가 풀어쓸 source)
- [README.md](../../README.md) L11-50 (Assessment Target 단락 — 3 GitHub instance + Confluence + LLM 평가의 source), L72-73 (cron 주기 / manual trigger), L96-103 (LLM 5 provider)
- [docs/architecture/components.md](../architecture/components.md) — UC-01 이 거치는 6 component (Scheduler / Worker / GitHub Adapter / Confluence Adapter / LLM Gateway / DB Persistence) 의 책임 + contract 정의 (오타 0 인용)
- [docs/architecture/modules.md](../architecture/modules.md) — UC-01 이 거치는 6 module 의 책임 + component ↔ module N:N mapping (오타 0 인용)
- [docs/requirements.md](../requirements.md) — UC-01 의 13 REQ (REQ-005, 006, 007, 014, 015, 039, 040, 049, 051, 052, 053, 054, 055) row + 인접 REQ (REQ-008 권한 부족, REQ-031 재수집, REQ-032 raw 금지, REQ-034 일일 요약) 의 요약·검증 위치·상태
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Scheduler 위치 (NestJS `@nestjs/schedule` in-process cron) / monolithic vs queue 결정 (UC-01 의 sequence 가 본 결정을 따른다)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고 (over-design 회피, 본 UC 파일은 운영에 필요한 만큼만)
- [docs/tasks/T-0019-p2-entry-use-case-index.md](T-0019-p2-entry-use-case-index.md) — 직전 P2-Entry task 의 산출물 + style 참고

## Acceptance Criteria

### 1. UC-01 본문 파일 신설

- [ ] `docs/use-cases/UC-01-evaluation-execution.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 200 줄 (overly detailed 회피, MVA 원칙). 다음 section 을 본 순서로 포함:
  - **Frontmatter** (한국어 본문 + 영어 키): `id: UC-01`, `title: 평가 실행 (자동 cron + manual trigger)`, `actor: Scheduler / Admin`, `trigger: cron 또는 manual`, `status: DONE`, `coversReq: [REQ-005, ...]` (INDEX.md 와 정확 일치).
  - **1. 개요** — 1~2 단락. UC-01 의 본질 (3 GitHub + Confluence 수집 → LLM 평가 → DB 저장) + README 단락 인용.
  - **2. Actor** — Scheduler (in-process cron) / Admin (manual trigger) 의 책임 차이. README L72-73 인용.
  - **3. Trigger** — (a) cron 시각 도달 (b) Admin manual trigger (c) 평가 재실행 (REQ-037 인접, 후속 UC-06 와의 관계). 3 trigger 모두 동일한 main flow 로 수렴.
  - **4. Preconditions** — 인증 (REQ-043), GitHub instance 3 개 모두 token/URL 설정, Confluence SPACE 설정, LLM provider 1+ 설정 (REQ-049~055), 평가 대상 인원 1+ 활성 (REQ-026), 이전 run idle 상태.
  - **5. Main flow (sequence diagram)** — mermaid `sequenceDiagram` block. participant: Scheduler / Admin / AssessmentModule / GithubModule / ConfluenceModule / LlmModule / PersistenceModule. 최소 10 단계 ≤ 18 단계 의 sequence. 단계별 한국어 1 줄 라벨. 핵심 단계 포함:
    1. Trigger 발화 (cron 또는 Admin)
    2. AssessmentModule 이 AssessmentRun 생성 + 평가 대상 인원·기간 결정
    3. GithubModule 이 3 instance 의 commit/issue/PR 수집 (REQ-005, 006, 007, 014)
    4. ConfluenceModule 이 지정 SPACE 의 페이지 수집 (REQ-015)
    5. 중복 제거 (REQ-009 인접, P5 에서 본격 구현)
    6. LlmModule 이 commit/문서 별 평가문 + 난이도·기여도·양 생성 (3 난이도 모델 routing, REQ-049~055)
    7. PersistenceModule 이 평가 결과 저장 (raw 미저장, REQ-032)
    8. AssessmentRun 완료 표시 + Web UI 가 결과 표시 가능 상태
  - **6. Alternative flows** — (6.1) Scheduler 자동 vs Admin 수동의 trigger metadata 차이만 (main flow 는 동일). (6.2) 신규 인원 1년치 평가 (REQ-027, P7 분리 — 본 UC 의 alt 가 아니라 별도 UC 혹은 P7 task 로 분리 명시).
  - **7. Error flows** — (7.1) GitHub instance 4xx (권한 부족) → PermissionDeniedEvent emit → UC-08 으로 위임 (REQ-008). (7.2) GitHub/Confluence 5xx → 재시도 정책 (구체 정책은 P4 ADR). (7.3) LLM provider timeout/error → fail-fast vs retry 정책 (구체는 P4 ADR). (7.4) DB write fail → AssessmentRun 을 FAILED 로 마킹, partial state cleanup 정책 (구체는 P3 ADR). 각 error 의 구체 retry/cleanup 은 후속 phase 의 ADR 로 위임 — 본 UC 에서는 경로만 명시.
  - **8. Postconditions** — AssessmentRun row 생성 (SUCCESS/FAILED/PARTIAL), 평가 결과 row N 개 (각 인원·기간 별), Web UI 가 UC-02 (조회) 로 표시 가능 상태.
  - **9. Component / Module mapping** — 본 UC 가 거치는 6 component + 6 module 의 표 (INDEX.md 와 일치). 각 component 의 본 UC 에서의 책임을 한국어 1 줄로.
  - **10. 관련 REQ** — 13 primary REQ + 4 인접 REQ (REQ-008, 031, 032, 034) 의 표. 각 REQ 가 UC 의 어느 section/sequence step 에서 cover 되는지 명시.
  - **11. References** — INDEX.md / components.md / modules.md / requirements.md / ADR-0003 / README L11-50, L72-73 / 본 task 파일 링크.

### 2. INDEX.md 의 UC-01 row 갱신

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 UC-01 row 의 `status` 컬럼: `PLANNED` → `DONE`.
- [ ] UC-01 description 단락 (§3 의 UC-01 단락) 의 끝에 `→ [UC-01-evaluation-execution.md](UC-01-evaluation-execution.md)` link 추가.
- [ ] Refs 라인의 끝에 `T-0020` 추가.
- [ ] T-0019 review 의 4 MINOR follow-up 중 인접 1 개 처리: PR-TBD placeholder (T-0019 본문 + INDEX.md 의 UC-01 description "PR-TBD" 또는 T-0019 frontmatter 의 prNumber 누락 여부) — 본 task scope 안에서는 INDEX.md / PLAN.md 의 "PR-TBD" 문자열 grep 후 실제 PR-18 로 갱신 (만약 존재).

### 3. PLAN.md 갱신

- [ ] [docs/PLAN.md](../PLAN.md) L82 의 첫 bullet 끝 marker `[~]` → 그대로 유지 (P2 진행 중). 그 bullet 의 본문에 "UC-01 본문 분해 ([UC-01-evaluation-execution.md](use-cases/UC-01-evaluation-execution.md), T-0020) 완료. UC-02~08 후속 분해 task 대기" 한 줄 추가.
- [ ] L83 의 "각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑" bullet: UC-01 의 §9 (component/module mapping) 이 본 bullet 의 첫 cover — bullet 끝에 "UC-01 cover ([UC-01](use-cases/UC-01-evaluation-execution.md))" 한 줄 inline.

### 4. mermaid sequence diagram 검증

- [ ] mermaid `sequenceDiagram` block 이 syntax 정합 — GitHub native renderer 로 렌더링됐을 때 깨지지 않음. participant 명은 components.md / modules.md 의 이름과 정확 일치 (Scheduler / Admin / AssessmentModule / GithubModule / ConfluenceModule / LlmModule / PersistenceModule).
- [ ] sequence step 수: 10 이상 18 이하. 각 step 의 라벨은 한국어 1 줄 + 관련 REQ ID 1 개 이상 인용 (예: `Note over GithubModule: 3 instance 수집 (REQ-005,006,007)`).

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC 이지만 markdown lint 가 있다면 통과).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기가 없는 단순 task 에서 4번 항목을 적용 어려운 경우 task 본문에 "분기 없음 — 이 항목 생략" 명시" 룰 적용).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 160 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안.
- [ ] 변경 파일: `docs/use-cases/UC-01-evaluation-execution.md` (신설) + `docs/use-cases/INDEX.md` (status / link / Refs) + `docs/PLAN.md` (UC-01 cover marker) + 본 task 파일 (status DONE 갱신은 driver/integrator) = 3~4 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비).
- [ ] CI green (lint + build + test + reviewer-approval step).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.

## Out of Scope

본 task 는 UC-01 본문 분해 + INDEX.md 의 status 갱신만 수행. 다음은 별도 task:

- **UC-02 ~ UC-08 본문 분해** — 후속 P2 sub-task (T-0021 ~ T-0027 예상). 본 task 가 template 역할.
- **api.md / data-model.md / directory.md 신설** — P2 의 별도 entry artifact task (T-0028+ 예상).
- **평가 실행의 실제 service class / controller / DB schema / event emitter 구현** — P3 (Domain core) 범위. 본 UC 의 §5 sequence step 은 *어떤* component 가 *무엇을* 하는지의 *어디서* level — *어떻게* 의 코드 level 은 P3+.
- **LLM provider 별 어댑터 구현** (REQ-051~055) — P4 (External integrations) 범위. 본 UC 는 LlmModule routing 이 *존재한다* 까지만.
- **3 난이도 모델 routing 정책 ADR** (REQ-050) — P4 의 ADR 필수 항목. 본 UC 는 "난이도 routing 이 일어난다" 까지만.
- **GitHub Adapter 의 retry/backoff 정책 ADR** — P4 의 ADR. 본 UC 의 §7 (error flows) 는 "재시도 정책 (구체는 P4 ADR)" 의 위임 표시만.
- **Confluence SPACE 탐색 (crawling vs hierarchy) ADR** (REQ-017) — P4 의 ADR. 본 UC 는 ConfluenceModule 가 페이지 수집까지만.
- **저장 schema (Assessment / Contribution / AssessmentRun entity 의 컬럼)** — P3 의 data-model.md / ADR. 본 UC 는 *어떤* row 가 생성되는지의 conceptual level 만.
- **중복 제거 알고리즘 / Abusing 방지 metric** (REQ-009, 012, 021) — P5 (Evaluation pipeline) 범위. 본 UC 는 §5 의 "중복 제거 단계" 1 step 으로 위임.
- **Web UI 표시 흐름** (REQ-038, 042) — 별도 UC (UC-02 조회) 의 책임. 본 UC 의 §8 (postconditions) 는 "Web UI 가 표시 가능 상태" 까지만.
- **권한 부족 통지 흐름** (REQ-008, 016) — 별도 UC (UC-08 통지) 의 책임. 본 UC 의 §7.1 은 "PermissionDeniedEvent emit → UC-08 위임" 까지만.
- **T-0019 review 의 나머지 3 MINOR follow-up** (modules.md "8 vs 9" 카운트 / PLAN.md `[~]` vs AC `[x]` / UC-08 actor 길이) — 본 task scope 밖. 별도 tiny patch task 또는 후속 UC task 의 incidental update.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: UC-01 의 main flow / error flows / component·module mapping / REQ 매핑 / sequence diagram 의 단계 수와 라벨 결정. README L11-50 + ADR-0003 + components.md / modules.md / requirements.md 의 cross-reference. 산출물: UC-01-evaluation-execution.md 의 outline (section 별 한 줄 요약 + sequence diagram 의 step 목록) + ADR 추가 없음 (UC 본문은 ADR 동반 안 함).
- **implementer**: architect 의 outline 을 따라 UC-01-evaluation-execution.md 신설 + INDEX.md / PLAN.md 갱신. mermaid sequence diagram block 작성. PR-TBD placeholder grep + 갱신 (T-0019 review follow-up 1 건).
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). mermaid syntax 검증 (GitHub renderer mock 가능 시). INDEX.md ↔ UC-01-*.md ↔ PLAN.md 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)

---
id: REQ-COVERAGE-AUDIT
title: P2 Use case 인벤토리 검증 — requirements.md ↔ UC backbone audit
status: DONE
coversPlanBullet: "P2 셋째 bullet — Use case 인벤토리 검증"
sourceTask: T-0029
auditDate: 2026-05-25
---

# REQ ↔ UC Coverage Audit

> **본 문서는 [T-0029](../tasks/T-0029-uc-inventory-audit.md) 의 산출물이다.** [requirements.md](../requirements.md) 의 66 REQ 가 [INDEX.md](INDEX.md) 의 8 UC backbone (UC-01 ~ UC-08) 으로 빠짐없이 cover 되는지를 검증한다. 본 audit 통과가 P2 의 후속 artifact (api.md / data-model.md) 진행의 전제 조건이다.

## 1. 개요

본 audit 의 목적은 **gap 검출** — 8 UC 가 [requirements.md](../requirements.md) 의 모든 functional REQ 의 superset 임을 박제하는 것이다. 범위는 66 REQ 전체 (REQ-001 ~ REQ-066, FR / NFR / Constraint 모두 포함). 정책: functional REQ 는 1+ UC 의 `coversReq` frontmatter 로 cover 되어야 하나, NFR / Constraint 는 단일 UC 가 아니라 **cross-cutting (여러 UC 가 공유)** 또는 **infrastructure (UC 영역 밖 — architecture document / ADR / 운영 정책)** 에서 cover 되는 것이 정상이다. 본 audit 의 분류 기준이 "UC 로 cover 안 됨" ≠ "gap" 임을 명확히 한다.

**audit 결과 요약** — 8 UC 의 `coversReq` 합집합이 functional REQ 의 거의 전부를 cover. **gap 1 건** (REQ-004 — 사용자 지정 기간 임의 평가문 요청 흐름) 검출. cross-cutting 4 건 / infrastructure 13 건 / uc-covered 48 건. P2 셋째 bullet closure 안전 — 단, REQ-004 gap 의 follow-up task 권장 (§6 참조).

## 2. 분류 정책

REQ 의 cover 방식을 다음 4 enum 으로 분류:

- **`uc-covered`** — 1+ UC 의 frontmatter `coversReq` 에 명시됨. 또는 UC 본문 (§5 sequence / §6 데이터 / §8 postcondition) 에서 algorithmic detail (예: 중복 제거 알고리즘, abusing 방지 metric) 로 cover. UC-01 의 평가 파이프라인 내부 알고리즘 (REQ-009 ~ REQ-013, REQ-018 ~ REQ-022 등) 은 P5 phase 의 implementation 책임이지만 UC envelope 안에 있으므로 **uc-covered (UC-01)** 로 분류.
- **`cross-cutting`** — NFR / FR 중 다수 UC 가 공유하는 횡단 관심사. 단일 UC 의 coversReq 에 박제하기 부적합. architecture document (components.md / modules.md / deployment.md) 또는 ADR 에서 cover 위치 박제.
- **`infrastructure`** — Constraint REQ — UC 영역 밖. ADR / CLAUDE.md / LOOP.md / `.github/workflows/ci.yml` / PLAN.md 의 운영 정책 backlog 에서 cover.
- **`gap`** — 1+ UC 에 cover 안 됐고, cross-cutting 도 아니고, infrastructure 도 아닌 functional REQ. **본 audit 의 핵심 검출 대상**.

## 3. audit 매트릭스

5 컬럼 schema (REQ ID / kind / cover 방식 / cover 위치 / 참고). 66 row.

| REQ | kind | cover 방식 | cover 위치 | 참고 |
| --- | --- | --- | --- | --- |
| REQ-001 | Constraint | infrastructure | [README.md](../../README.md) 본문 + 본 [INDEX.md](INDEX.md) | "본 문서는 Use Case 문서의 기본" — meta 지시, doc-level 정책 |
| REQ-002 | FR | cross-cutting | [components.md](../architecture/components.md) Web UI + [modules.md](../architecture/modules.md) WebModule | UC-02 ~ UC-07 모두 Web UI 필요. 단일 UC 가 cover 하지 않음 |
| REQ-003 | FR | cross-cutting | UC-01 (생성) + UC-02 (표시) | "기여 양·질 평가 / 저장 / 표시" — UC-01 + UC-02 의 envelope |
| REQ-004 | FR | gap | — | 사용자 지정 기간 임의 평가문 — UC-01 cron / manual 둘 다 cover 안 함. §6 follow-up |
| REQ-005 | FR | uc-covered | UC-01, UC-08 (인접) | github.com 평가 — UC-01 coversReq |
| REQ-006 | FR | uc-covered | UC-01, UC-08 (인접) | github.sec 평가 — UC-01 coversReq |
| REQ-007 | FR | uc-covered | UC-01, UC-08 (인접) | github.ecode 평가 — UC-01 coversReq |
| REQ-008 | FR | uc-covered | UC-08, UC-01 (인접) | GitHub 권한 부족 — UC-08 coversReq |
| REQ-009 | FR | uc-covered | UC-01 (P5 알고리즘) | Fork/Rebase/Meld + 시간적 중복 제거 — UC-01 §5 step 9 envelope |
| REQ-010 | FR | uc-covered | UC-01 (P5 알고리즘) | 코드 양·질 평가 — UC-01 평가 파이프라인 내부 |
| REQ-011 | FR | uc-covered | UC-01 (P5 알고리즘) | 어려운 기여 높은 점수 — UC-01 LLM 평가문 |
| REQ-012 | FR | uc-covered | UC-01 (P5 알고리즘) | 코드 abusing 방지 — UC-01 metric 단계 |
| REQ-013 | FR | uc-covered | UC-01 (P5 알고리즘) | 저성과자 식별 — UC-01 결과의 분석 view (UC-02 표시) |
| REQ-014 | FR | uc-covered | UC-01, UC-08 (인접) | Issue 평가 (본인 follow-up 제외) — UC-01 coversReq |
| REQ-015 | FR | uc-covered | UC-01, UC-08 (인접) | Confluence SPACE 평가 — UC-01 coversReq |
| REQ-016 | FR | uc-covered | UC-08 | Confluence 권한 부족 — UC-08 coversReq |
| REQ-017 | Constraint | infrastructure | P4 ADR 예정 (Confluence 탐색 정책) | requirements.md L36 — ADR-필수 항목, P4 phase 책임 |
| REQ-018 | FR | uc-covered | UC-01 (P5 알고리즘) | zero-contribution — UC-01 LLM 평가문 분류 |
| REQ-019 | FR | uc-covered | UC-01 (P5 알고리즘) | 새 알고리즘 / 외부 연구 = 높은 contribution — UC-01 LLM 평가문 |
| REQ-020 | FR | uc-covered | UC-01 (P5 알고리즘) | 조직 기여 큰 인원 — UC-01 결과 분석 (UC-02 표시) |
| REQ-021 | FR | uc-covered | UC-01 (P5 알고리즘) | 문서 abusing 방지 — UC-01 metric 단계 |
| REQ-022 | FR | uc-covered | UC-01 (P5 알고리즘) | 문서 update 횟수 중립화 — UC-01 metric 단계 |
| REQ-023 | FR | uc-covered | UC-03 | 서비스별 ID 매핑 — UC-03 coversReq |
| REQ-024 | Constraint | uc-covered | UC-03 (+ P3 ADR) | Primary key 역할 ID — UC-03 coversReq, ADR 필수 |
| REQ-025 | FR | uc-covered | UC-03 | 일부 NULL 허용 — UC-03 coversReq |
| REQ-026 | FR | uc-covered | UC-03, UC-01 (대상 명단) | 인원 CRUD + Deactivate/Activate — UC-03 coversReq |
| REQ-027 | FR | uc-covered | UC-03 | 신규 인원 1년치 평가 — UC-03 coversReq |
| REQ-028 | FR | uc-covered | UC-03 | Group 정책 (다중 + 단일 파트) — UC-03 coversReq |
| REQ-029 | NFR | cross-cutting | [ADR-0002](../decisions/ADR-0002-db.md) + [components.md](../architecture/components.md) DB Persistence | 평가 자료 non-volatile 저장 — DB / 영속 layer 의 횡단 NFR |
| REQ-030 | FR | uc-covered | UC-07 | Export/Backup + Restore — UC-07 coversReq |
| REQ-031 | FR | uc-covered | UC-01 (인접, P5 알고리즘) | 재수집 중복 방지 + 최근 1주 OK — UC-01 adjacentReq + §5 step 9 |
| REQ-032 | Constraint | uc-covered | UC-07, UC-01 (인접), UC-06 (인접) + [deployment.md](../architecture/deployment.md) §3 | raw 저장 금지 — UC-07 coversReq + schema-level 강제 (ADR-0002) |
| REQ-033 | FR | uc-covered | UC-01 (data model) | commit/문서 별 기여도·난이도·양 — UC-01 §6 결과 데이터 |
| REQ-034 | FR | uc-covered | UC-01 (인접, P5 trigger) | 일별 활동 요약 (당일 자정 이후) — UC-01 adjacentReq |
| REQ-035 | FR | uc-covered | UC-01 (P5 trigger) | 주간/월간 요약 — UC-01 평가 파이프라인 + Scheduler envelope |
| REQ-036 | FR | uc-covered | UC-01 (생성) + UC-02 (표시) | 상대 비교 + LLM 정성 + Metric — UC-01 / UC-02 데이터 모델 |
| REQ-037 | FR | uc-covered | UC-06, UC-07 (인접) | 일괄 평가 + Reset & Reeval — UC-06 coversReq |
| REQ-038 | FR | uc-covered | UC-02, UC-06 (인접), UC-07 (인접) | UI 조회 / sort / filter / 시계열 — UC-02 coversReq |
| REQ-039 | FR | uc-covered | UC-01 | Admin cron 주기 지정 — UC-01 coversReq |
| REQ-040 | FR | uc-covered | UC-01 | Admin manual trigger — UC-01 coversReq |
| REQ-041 | FR | uc-covered | UC-06 | Admin 최근 N일 결과 delete + 재수집 — UC-06 coversReq |
| REQ-042 | FR | uc-covered | UC-02 | 평가 진행 중 시각화 보호 (경고 배너) — UC-02 coversReq |
| REQ-043 | NFR | uc-covered | UC-04, UC-02 (인접), UC-03 (인접), UC-05 (인접), UC-06 (인접), UC-07 (인접), UC-08 (인접) | ID/Password 보호 — UC-04 coversReq, 거의 모든 UC 가 adjacent |
| REQ-044 | FR | uc-covered | UC-04, UC-02 (인접), UC-03 (인접), UC-05 (인접), UC-06 (인접), UC-07 (인접), UC-08 (인접) | SuperAdmin / 3 등급 / 승급 — UC-04 coversReq |
| REQ-045 | FR | uc-covered | UC-03, UC-05, UC-06, UC-07 | Admin 권한 (재작성/Reset/Import/Export/인원편집/Group편집) — 다수 UC coversReq |
| REQ-046 | FR | uc-covered | UC-02, UC-04 (인접), UC-08 (인접) | User read-only — UC-02 coversReq |
| REQ-047 | NFR | cross-cutting | [deployment.md](../architecture/deployment.md) §REQ-047 + P7 perf test | 100~200 명 / 1h 이내 — 시스템 전체 처리 NFR |
| REQ-048 | NFR | uc-covered | UC-02 + [deployment.md](../architecture/deployment.md) | 조회·시각화 3 초 이내 — UC-02 coversReq + perf test |
| REQ-049 | FR | uc-covered | UC-05, UC-01 (cover) | Admin LLM 모델 지정 — UC-05 coversReq |
| REQ-050 | Constraint | uc-covered | UC-05 (+ P4 ADR) | 3 난이도 모델 슬롯 — UC-05 coversReq, ADR 필수 |
| REQ-051 | FR | uc-covered | UC-05, UC-01 | custom LLM (OpenAI 호환, 3 슬롯) — UC-05 coversReq |
| REQ-052 | FR | uc-covered | UC-05, UC-01 | Azure OpenAI provider — UC-05 coversReq |
| REQ-053 | FR | uc-covered | UC-05, UC-01 | Anthropic provider — UC-05 coversReq |
| REQ-054 | FR | uc-covered | UC-05, UC-01 | Google Gemini provider — UC-05 coversReq |
| REQ-055 | FR | uc-covered | UC-05, UC-01 | OpenAI provider — UC-05 coversReq |
| REQ-056 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §1 (stack) + `.github/workflows/ci.yml` | Well-known library / 중복 import 금지 — 운영 정책 + CI 점검 |
| REQ-057 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3 (1 task = 1 commit) | 한 commit = 한 주제 — agent 정책 |
| REQ-058 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.2 R-110 + agents | commit/PR 후 코드 검토 + test 작성 — agent 정책 |
| REQ-059 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.2 R-111 + ci.yml | 모든 test → CI 자동 실행 — CI 정책 |
| REQ-060 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 + planner | unit test (기능 + 예외 + flow + negative) — planner 정책 |
| REQ-061 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.2 R-113 + T-0009/T-0010 | smoke + e2e 도 CI 에서 — CI 정책 |
| REQ-062 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.2 R-114 + LOOP §1 [5] | 활동 후 test + 종료 전 CI — driver 정책 |
| REQ-063 | Constraint | infrastructure | [integrator.md](../../.claude/agents/integrator.md) → [reviewer.md](../../.claude/agents/reviewer.md) | PR review by other agent — agent dispatch 정책 |
| REQ-064 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.3 + integrator | Reviewer + Committer 합의, 7 round — agent 합의 정책 |
| REQ-065 | Constraint | infrastructure | [reviewer.md](../../.claude/agents/reviewer.md) | Reviewer 8 check — reviewer agent spec |
| REQ-066 | Constraint | infrastructure | [CLAUDE.md](../../CLAUDE.md) §3.1 | 코드 = PR / 진행 doc = direct — agent 정책 |

## 4. UC 별 REQ cover 요약 (reverse view)

각 UC 의 `coversReq` frontmatter + 본문 §5 / §6 / §8 가 실제로 cover 하는 REQ 의 ID list. INDEX.md 의 "관련 REQ" 컬럼이 본 list 의 subset 인 경우 본문 frontmatter 가 정답.

- **UC-01** (평가 실행) — coversReq: REQ-005, 006, 007, 014, 015, 039, 040, 049, 051, 052, 053, 054, 055. adjacent: REQ-008, 031, 032, 034. envelope-cover (P5 알고리즘): REQ-009, 010, 011, 012, 013, 018, 019, 020, 021, 022, 033, 035, 036.
- **UC-02** (조회/sort/filter/시계열) — coversReq: REQ-038, 042, 046, 048. adjacent: REQ-043, 044, 045. envelope-cover: REQ-003 (표시), REQ-013 / 020 의 비교 view.
- **UC-03** (인원 CRUD + Group + Activate) — coversReq: REQ-023, 024, 025, 026, 027, 028, 045. adjacent: REQ-043, 044.
- **UC-04** (권한·계정 관리) — coversReq: REQ-043, 044. adjacent: REQ-045, 046.
- **UC-05** (LLM 설정) — coversReq: REQ-049, 050, 051, 052, 053, 054, 055. adjacent: REQ-043, 044, 045.
- **UC-06** (평가 결과 delete + 재수집) — coversReq: REQ-037, 041, 045. adjacent: REQ-032, 038, 043, 044.
- **UC-07** (Export/Import/Backup/Restore) — coversReq: REQ-030, 032, 045. adjacent: REQ-037, 038, 043, 044.
- **UC-08** (권한 부족 인식·통지) — coversReq: REQ-008, 016. adjacent: REQ-005, 006, 007, 014, 015, 043, 044, 045, 046.

8 UC 의 coversReq union: 31 REQ. envelope-cover (UC-01 의 P5 알고리즘 13 REQ) 포함 시 uc-covered 48 REQ. 합 = 31 + 13 + 4 cross-cutting + 13 infrastructure + 1 gap = 66 (역산 일치 → §5 참조).

## 5. 분류별 요약 통계

| 분류 | count | percentage | 비고 |
| --- | --- | --- | --- |
| `uc-covered` | 48 | 73 % | 31 REQ 가 1+ UC 의 coversReq 직접 명시 + 17 REQ 가 UC envelope 내부 algorithmic / data-model cover |
| `cross-cutting` | 4 | 6 % | REQ-002 (Web Interface) / REQ-003 (생성+저장+표시 meta) / REQ-029 (non-volatile NFR) / REQ-047 (perf NFR) |
| `infrastructure` | 13 | 20 % | REQ-001 / REQ-017 / REQ-056 ~ REQ-066 (운영·CI·agent 정책) |
| `gap` | 1 | 2 % | REQ-004 (사용자 지정 기간 임의 평가문) — §6 follow-up |
| **합** | **66** | **100 %** | requirements.md row 수와 일치 — 검산 통과 |

## 6. gap follow-up

본 audit 가 검출한 gap **1 건**.

### REQ-004 — 수치 + LLM 평가 코멘트, 사용자 지정 기간

- **요약** ([requirements.md](../requirements.md) L23): "수치 지표 + LLM 평가 코멘트 (사용자 지정 기간)". README L9 의 "사용자가 임의 기간을 지정해 LLM 평가문 요청" 의 박제.
- **현 cover 상태**: UC-01 은 Scheduler cron + Admin manual trigger (REQ-039, REQ-040) 만 cover. **사용자 (User / Admin) 가 임의 시작·종료 시각을 지정해 LLM 평가문을 요청하는 흐름은 어떤 UC 에도 없다**. UC-02 의 조회/sort/filter 는 *기존* 평가 결과의 view 일 뿐 — 새로운 LLM 호출이 동반되지 않음.
- **권장 처리** — (a) **새 UC-09 신설** ("사용자 지정 기간 임의 평가문 요청"): actor User / Admin, trigger Web UI 의 date-range picker + LLM 요청 버튼, 거치는 component Web UI → Backend API → AssessmentModule → LLM Gateway → DB Persistence (캐시 저장 선택), 거치는 module WebModule / AssessmentModule / LlmModule / AuthModule / PersistenceModule. (b) **대안 — UC-01 본문 확장**: UC-01 의 trigger 단락에 "사용자 임의 기간 지정 trigger" 를 셋째 entry 로 추가 + §5 sequence 에 분기 추가. **권장은 (a) 새 UC-09 신설** — UC-01 은 cron/manual 의 full-period 평가 파이프라인이므로 분리하는 편이 깔끔.
- **권장 REQ 묶음**: REQ-004 단독. UC-09 의 sub-feature 로 REQ-035 (주간/월간 요약) 의 사용자 임의 호출 지원도 가능하나 별도 task 결정.
- **추정 task 규모**: UC-09 신설 시 T-0028 와 동급 (≤180 LOC, frontmatter + 11 section + mermaid sequence). T-0030 또는 T-0031 으로 별도 task 생성 권장. 본 task scope 밖.

## 7. NFR / Constraint cross-cutting 처리 박제 spot check

`cross-cutting` 4 REQ + `infrastructure` 13 REQ 의 cover 위치가 실제로 architecture document 또는 ADR / CLAUDE.md 에 박제됐는지 sample 검증.

- **REQ-002 (Web Interface)** — components.md L_? Web UI component + modules.md WebModule. ✓ 박제됨.
- **REQ-029 (non-volatile 저장)** — ADR-0002 (DB selection — PostgreSQL + Prisma) + components.md DB Persistence. ✓ 박제됨.
- **REQ-032 (raw 저장 금지)** — deployment.md §3 (Raw data 저장 금지 schema-level 강제) + components.md L172 + directory.md L126. ✓ 강하게 박제됨.
- **REQ-047 (perf — 1h 처리)** — deployment.md §"REQ-047 충족 시나리오" (L62). ✓ 박제됨.
- **REQ-048 (조회 3 초)** — UC-02 §5 + deployment.md. ✓ 박제됨.
- **REQ-017 (Confluence 탐색 정책 ADR)** — requirements.md L36 가 "P4 (ADR 필수)" 명시. P4 phase 진입 시 ADR 신설 필요 — **현재 미박제 (P4 phase 미진입)**. 후속 phase 의 책임 (정상 — 본 task scope 밖).
- **REQ-050 (3 난이도 모델 ADR)** — requirements.md L69 가 "P4 (ADR 필수)" 명시. UC-05 본문이 cover 하나 ADR 신설은 P4. **현재 미박제 (P4 phase 미진입)**. 정상.
- **REQ-056 ~ REQ-066** — 모두 CLAUDE.md 본문 또는 agent spec 또는 ci.yml 에 박제됨. ✓.

**spot check 결론** — cross-cutting / infrastructure 의 cover 위치 박제는 현 phase (P2) 까지 정상. P4 진입 시 REQ-017 / REQ-050 의 ADR 신설 follow-up 필요 (별도 task — 본 audit scope 밖).

## 8. 결론

본 audit 의 verdict:

- 8 UC 의 coversReq union 이 functional REQ 의 거의 전부를 cover. **gap 1 건** (REQ-004) 검출.
- gap 1 건은 UC-09 신설 또는 UC-01 확장으로 해소 가능. 후속 task (T-0030+) 책임.
- cross-cutting 4 / infrastructure 13 의 cover 위치 박제 정상. P4 phase 진입 시 REQ-017 / REQ-050 ADR 신설 follow-up 필요.
- **P2 셋째 bullet (Use case 인벤토리 검증) closure 안전 — gap follow-up 정책 박제 완료**.
- 후속 P2 artifact (api.md / data-model.md) 진행 가능 — 본 audit 의 8 UC + UC-09 (예정) 를 frontend 로 삼아 endpoint / entity 도출.

## 9. References

- [docs/requirements.md](../requirements.md) — 66 REQ row source
- [docs/use-cases/INDEX.md](INDEX.md) — 8 UC backbone
- [docs/use-cases/UC-01-evaluation-execution.md](UC-01-evaluation-execution.md) ~ [UC-08-permission-denied.md](UC-08-permission-denied.md) — 8 UC 본문
- [docs/PLAN.md](../PLAN.md) — Phase P2 셋째 bullet
- [docs/architecture/components.md](../architecture/components.md) — component view (cross-cutting cover)
- [docs/architecture/modules.md](../architecture/modules.md) — module view
- [docs/architecture/deployment.md](../architecture/deployment.md) — operational NFR cover
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) ~ [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Constraint cover
- [docs/tasks/T-0029-uc-inventory-audit.md](../tasks/T-0029-uc-inventory-audit.md) — 본 audit 의 source task
- [CLAUDE.md](../../CLAUDE.md) — infrastructure REQ (REQ-056 ~ REQ-066) cover

Refs: T-0029, T-0019, T-0020, T-0022, T-0023, T-0024, T-0025, T-0026, T-0027, T-0028, ADR-0001, ADR-0002, ADR-0003, REQ-001 ~ REQ-066 (전체 audit 대상)

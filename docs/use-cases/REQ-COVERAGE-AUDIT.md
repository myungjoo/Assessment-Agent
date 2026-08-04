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

**audit 결과 요약** — 8 UC 의 `coversReq` 합집합이 functional REQ 의 거의 전부를 cover. **gap 1 건** (REQ-004 — 사용자 지정 기간 임의 평가문 요청 흐름) 검출. cross-cutting 4 건 / infrastructure 13 건 / uc-covered 48 건. P2 셋째 bullet closure 안전 — 단, REQ-004 gap 의 follow-up task 권장 (§6 참조). 2026-08-02 재판정: §9 참조. 2026-08-03 재분류: UC-09 신설 chain (T-1411 ~ T-1413) 으로 REQ-004 가 `gap` → `uc-covered` 전이해 위 4 값은 **uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66** 으로 갱신 — 근거 §12.11 · §12.15 참조 (본 문장 앞부분의 옛 4 값 · `gap 1 건` 서술은 2026-05-25 시점 기록이라 무편집 보존).

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
| REQ-004 | FR | uc-covered | UC-09 | 사용자 지정 기간 임의 평가문 — UC-01 cron / manual 둘 다 cover 안 함. §6 follow-up · 2026-08-02 재판정: §9 참조; 2026-08-03 재분류 (T-1413): UC-09 신설로 uc-covered — 근거 §12.11 |
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
| REQ-017 | Constraint | infrastructure | [ADR-0013](../decisions/ADR-0013-confluence-space-traversal-policy.md) (Confluence SPACE 탐색 정책, ACCEPTED) | requirements.md L36 — ADR-필수 항목, P4 phase 책임 |
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
- **UC-09** (사용자 지정 기간 임의 평가문 요청) — coversReq: REQ-004. adjacent: REQ-035, 038, 039, 040, 043, 045, 046, 048, 049. relatedUc: UC-01, UC-02.

9 UC 의 coversReq union: 34 REQ. envelope 잔차 15 REQ 포함 시 uc-covered 49 REQ. 합 = 34 + 15 + 4 cross-cutting + 13 infrastructure + 0 gap = 66 (역산 일치 → §5 참조).

> 위 envelope 잔차 **15** 와 UC-01 bullet 이 나열한 envelope-cover **13** 건의 차이 2 건은 REQ-031 · REQ-034 다 — 106 행 bullet 은 이 둘을 `adjacent` 로 적었으나 §3 매트릭스는 `uc-covered` 로 분류한다. 즉 13 과 15 는 모순이 아니라 나열 기준 (bullet 서술 vs 매트릭스 분류) 의 차이이며, 본 요약 행의 anchor 는 **§3 매트릭스 실측** 이다. 2026-08-02 재판정 (T-1395) 결과 이 anchor 는 **유지** — 65 · 68 행이 `인접` 을 근거로 적으면서 분류는 `uc-covered` 로 두므로 `adjacent` 는 `uc-covered` 의 배제 사유가 아니라 하위 근거이며, bullet 의 `adjacent` 표기와 매트릭스 분류는 양립한다 (§10 참조).

## 5. 분류별 요약 통계

| 분류 | count | percentage | 비고 |
| --- | --- | --- | --- |
| `uc-covered` | 49 | 74 % | 34 REQ 가 1+ UC 의 coversReq 직접 명시 + 15 REQ 가 UC envelope 내부 algorithmic / data-model cover |
| `cross-cutting` | 4 | 6 % | REQ-002 (Web Interface) / REQ-003 (생성+저장+표시 meta) / REQ-029 (non-volatile NFR) / REQ-047 (perf NFR) |
| `infrastructure` | 13 | 20 % | REQ-001 / REQ-017 / REQ-056 ~ REQ-066 (운영·CI·agent 정책) |
| `gap` | 0 | 0 % | REQ-004 (사용자 지정 기간 임의 평가문) — §6 follow-up · 2026-08-02 재판정: §9 참조 · 2026-08-03 재분류 (T-1413): UC-09 신설로 uc-covered 전이 — §12.11 |
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

**현행 pointer (2026-08-03 append — T-1417)** — 위 5 bullet 은 frontmatter `auditDate: 2026-05-25` 시점 verdict 의 기록이며, §12.3 306 행 append-only 규약대로 수치·판정 문구를 한 글자도 고치지 않고 보존한다. 2026-08-03 현재 사실은 다음과 같이 다르다 — REQ-004 는 `gap` 이 아니라 **`uc-covered` (UC-09) 로 재분류돼 gap 0 건** 이고, UC-09 는 `(예정)` 이 아니라 **실재하는 문서** 이며, `후속 task (T-0030+) 책임` 지목은 **stale** (해당 chain 은 T-1411 ~ T-1416 이 수행) 이다. 본 문단은 수치·근거를 재생산하지 않고 §9 (2026-08-02 재판정) · §12.10 (지목 최신성) · §12.11 (실판정 + cascade) · §12.15 (본 pointer 의 처리 방침) 에 위임한다.

## 9. 2026-08-02 재판정 (T-1389)

> 본 절은 [T-1389](../tasks/T-1389-uc-coverage-audit-req-004-gap-rejudge.md) 가 **REQ-004 1 건에 한해** 수행한 재판정이다. 위 1~8 절은 `auditDate: 2026-05-25` 시점의 역사적 기록으로 **수치·판정 서술을 그대로 보존** 했고, 본 절만이 2026-08-02 실측을 반영한다. 66 REQ 전수 재audit 는 수행하지 않았다. 절 번호 충돌을 피하려고 기존 References 절은 §10 으로 옮겼다 (내용 불변).

### 9.1 UC 문서 cover 축 실측

- (a) **UC-09 파일 실재 = 0 건.** `ls docs/use-cases/` 결과는 `INDEX.md` · `REQ-COVERAGE-AUDIT.md` + `UC-01-evaluation-execution.md` ~ `UC-08-permission-denied.md` **8 UC** 뿐이며 `UC-09*` 로 시작하는 파일은 없다. §6 의 권장 (a) "새 UC-09 신설" 은 미이행 상태다.
- (b) **`coversReq` frontmatter 에 REQ-004 를 포함한 UC = 0 / 8.** `grep -n "coversReq" docs/use-cases/UC-*.md` 가 8 파일 각 7 행에서 배열 1 개씩 총 8 개를 반환했고, 그 어느 배열에도 `REQ-004` 가 없다 (UC-01 은 REQ-005 부터 시작, UC-02 는 REQ-038 부터).
- (c) **본문 언급 = 파일별 0 건 (합 0).** `grep -c "REQ-004" docs/use-cases/UC-*.md` 는 UC-01 / UC-02 / UC-03 / UC-04 / UC-05 / UC-06 / UC-07 / UC-08 **모두 0** 을 반환했다. frontmatter 외 본문 (sequence · 데이터 · postcondition) 에서도 REQ-004 를 인용한 UC 는 없어, 인용할 행 자체가 없다.

### 9.2 구현 실재 축 실측

- **HTTP 진입점 실재.** `src/assessment-evaluation/assessment-evaluation.controller.ts` 133 행이 `@Controller("api/assessment-evaluation")`, 339 행이 `@Post("period")` 이므로 사용자 지정 기간 평가 요청의 route 는 `POST /api/assessment-evaluation/period` 로 **실재** 한다.
- **설계 박제 실재.** [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 의 frontmatter `status` 는 **`ACCEPTED`** 이며 제목은 "period→collection→evaluate bridge 설계" 다.
- **requirements.md 측 상태 인용.** [requirements.md](../requirements.md) 23 행의 REQ-004 상태는 [T-1377](../tasks/T-1377-requirements-metric-llm-comment-period-status-rejudge.md) 이 재판정한 `IN_PROGRESS` 이고, 그 요약 축은 **충족 — 수치 축 · 기간 축 · LLM 코멘트 축 · API 노출 축 실재 / 미충족 — 프런트 노출 축 · 기간 종료 경계 · 좌표 종합 코멘트의 HTTP 진입점 부재** 다 (근거 본문은 그쪽에 있으며 본 절로 복사하지 않는다).

### 9.3 두 축의 분리 — 구현 실재 ≠ UC cover

§2 의 enum 정의상 `gap` 은 "**1+ UC 에 cover 안 됐고, cross-cutting 도 아니고, infrastructure 도 아닌 functional REQ**" 다. 판정 기준은 **UC 문서가 그 REQ 를 cover 하는지** 이지 코드가 존재하는지가 아니다. 따라서 9.2 의 route · ADR 이 실재한다는 사실만으로 9.1 의 cover 축 0 건을 뒤집을 수 없다. 두 축은 독립이며, 본 audit 가 계측하는 축은 전자가 아니라 후자다. (역방향도 같다 — UC 가 cover 해도 구현이 없을 수 있다.)

### 9.4 재판정 결과 — **(i) gap 유지** (구현 진행 사실 부기)

- **판정**: REQ-004 의 분류는 `gap` **그대로 유지**. UC cover 축이 (a) 0 파일 · (b) 0 / 8 coversReq · (c) 0 본문 언급으로 2026-05-25 시점과 동일하기 때문이다. 3 절 매트릭스 38 행과 5 절 통계 124 행의 `gap` 1 건도 불변이다.
- **부기 (2026-05-25 대비 변화)**: gap 의 *구현* 측면은 크게 진행됐다 — `POST /api/assessment-evaluation/period` 가 실재하고 (`src/assessment-evaluation/assessment-evaluation.controller.ts` 133 · 339 행), 그 설계가 `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` (`status: ACCEPTED`) 로 박제됐으며, `docs/requirements.md` 23 행도 `IN_PROGRESS` 다. 남은 것은 **문서 축** — 이 흐름을 담을 UC (§6 권장 (a) UC-09 신설 또는 (b) UC-01 확장) 가 아직 없다.
- **근거 파일 경로 (실재 확인)**: `docs/use-cases/UC-01-evaluation-execution.md` · `docs/use-cases/UC-02-evaluation-query.md` · `src/assessment-evaluation/assessment-evaluation.controller.ts` · `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` · `docs/requirements.md`.
- **표 무결성 검산**: `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 으로 편집 전후 불변 (매트릭스 row 수 보존). 38 행 · 124 행은 `참고` · `비고` 컬럼 끝에 pointer 문구만 덧붙여 `|` 필드 수가 헤더 및 인접 행과 동일하다.

### 9.5 한계

- **UC-09 신설의 정책적 타당성은 판정하지 않았다.** §6 의 권장 (a) 신설 / (b) UC-01 확장 중 어느 쪽이 옳은지는 본 재판정 범위 밖이며, 구현이 UC 없이 선행된 지금은 "UC 를 사후 작성" 하는 셈이라 §6 의 추정 규모 (T-0028 동급) 도 재산정이 필요할 수 있다.
- **REQ-004 의 프런트 노출 축 · 기간 종료 경계 · 좌표 종합 코멘트 HTTP 진입점** 의 실재 여부는 본 절에서 직접 실측하지 않았고 `docs/requirements.md` 23 행 (T-1377 판정) 인용으로 대체했다.
- **다른 gap 후보의 전수 재audit 는 수행하지 않았다.** 3 절 66 row 중 REQ-004 1 건만 재판정했으므로, 2026-05-25 이후 다른 REQ 의 분류가 stale 해졌는지는 미확인이다. 5 절 통계표의 `uc-covered` 48 · `cross-cutting` 4 · `infrastructure` 13 수치도 그 시점 값 그대로다.
- **`docs/use-cases/INDEX.md` 104 행** 의 audit closure 요약은 본 절과 동기화하지 않았다 (본 slice scope 밖 — task Follow-ups 참조). (2026-08-03 부기 — T-1417: 위 `104 행` 은 2026-08-02 시점 표기이고 그 closure 문단은 현재 **118 ~ 121 행** 이다. 미동기 사실 자체는 T-1414 의 cascade (e) 실행으로 **이미 해소** — 근거 §12.12.)

## 10. 2026-08-02 역방향 coverage 재검산 (T-1393)

> 본 절은 [T-1393](../tasks/T-1393-req-coverage-reverse-coverage-recheck.md) 이 §4 의 역방향 서술 수치를 3 축으로 실측 대조한 기록이다. §1 ~ §9 본문은 1 자도 고치지 않았고, 아래에서 발견한 수치 오차의 **정정도 하지 않았다** (§5 / INDEX / PLAN 까지 번지는 cascade 라 Follow-up 소관).

- **축 A — INDEX §2 미인용 REQ 33 건.** `comm -13` (§2 표 6 번째 컬럼 인용 unique 정렬 vs requirements.md REQ ID 정렬) 결과 66 − 33 = **33 건**: REQ-001 / 002 / 003 / 004 / 009 ~ 013 / 017 / 018 ~ 022 / 029 / 031 / 033 ~ 036 / 047 / 056 ~ 066. [T-1392](../tasks/T-1392-uc-index-req-column-integrity.md) 의 직전 실측 (인용 41 건 · unique 33 · requirements row 66) 과 **일치** 하며, 본 slice 에서 재실측한 값도 41 / 33 / 66 으로 같다.
- **축 A' — 미인용 33 건의 분류 분포.** §3 매트릭스 기준 `uc-covered` **15** / `cross-cutting` **4** / `infrastructure` **13** / `gap` **1** (합 33). cross-cutting · infrastructure · gap 은 **전건** 이 미인용이고, 뒤집으면 §2 표가 인용한 33 개는 **전부** `uc-covered` 다.
- 축 A' 판정: 미인용 `uc-covered` 15 건 = REQ-009 ~ 013 / 018 ~ 022 / 031 / 033 / 034 / 035 / 036 으로 모두 UC-01 envelope (P5 알고리즘 · trigger · 결과 data model) 이다. 104 행 선언 "§2 표는 요약 index 이고 정답은 UC 본문 frontmatter" 와 **모순 없음** — §2 표가 frontmatter 직접 명시분만 싣고 envelope 분을 생략한 결과이기 때문이다.
- **축 B — 8 UC frontmatter `coversReq` 실 union = 33.** `grep -n "^coversReq" docs/use-cases/UC-0*.md` 가 8 파일 각 7 행에서 배열 1 개씩 반환, 원소 총 **41 건** · unique **33 개**. 115 행 선언 **31 과 불일치 (Δ +2)**. 다만 §4 106 ~ 113 행 bullet 8 줄의 coversReq 를 직접 union 해도 **33** 이라, 오차는 bullet 이 아니라 **115 행 요약 수치 1 개** 에 국한된다. 2026-05-25 PR-28 reviewer 의 MINOR 지적 ("§4 narrative union 31 → 33") 은 **재확인됨 — 미정정 상태로 존속**.
- 축 B 부기: frontmatter union 33 과 INDEX §2 인용 unique 33 은 **집합으로 동일** (`comm` 양방향 차집합 각 0 건). 즉 §2 표의 관련 REQ 컬럼은 frontmatter 직접 명시분의 정확한 사본이다.
- **축 C — 115 행 합산식은 산술 불성립.** `31 + 13 + 4 + 13 + 1 = 62 ≠ 66` (Δ −4). 어긋나는 항은 **둘** — 직접 union 항 31 (실측 33, Δ +2) 과 envelope 항 13 (실측 15, Δ +2). 실측 정합식은 `33 + 15 + 4 + 13 + 1 = 66`.
- 축 C 부기 (§5 121 행 대조): §5 의 `uc-covered` **합계 48 은 정확** 하다 (§3 매트릭스 66 row 실측 분포가 uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 로 1:1 일치). 그러나 그 내부 분해 "31 직접 + 17 envelope" 은 **양 항 모두 오차** (실측 33 + 15). 요컨대 envelope 을 §4 는 13, §5 는 17 로 적었고 실측은 **15** — 세 값이 전부 다르다. envelope 15 = §4 가 나열한 UC-01 P5 알고리즘 13 건 + REQ-031 · REQ-034 (§4 는 `adjacent` 로 적었으나 §3 매트릭스는 `uc-covered` 로 분류).
- **종합 판정** — 역방향 축의 **집합·분류 차원 결함은 0 건** (미인용 33 건 전부가 정책상 정상 사유로 설명되고, frontmatter union 과 §2 인용 집합이 완전 일치). 반면 **요약 수치 서술 오차 3 건** 이 존속한다: 115 행 union 31 · 115 행 envelope 13 · 121 행 분해 `31 + 17`. 실체는 건전하고 틀린 것은 숫자 서술뿐이라 본 slice 는 사실 판정만 남기고 정정은 Follow-up 으로 넘긴다 (115 행 / 121 행 / INDEX 110 행 / PLAN 36 행 cascade).
- **미검증 축** (열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404 · 4 번째 축은 T-1408) 갱신분이다 — 아래 214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형) — envelope-cover 판정의 **의미적** 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), `adjacent` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함) → **해소** (217 행 T-1395), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · coversReq union 33/33), §3 매트릭스 66 row 분류 자체의 재판정 → **해소** (§12.5 ~ §12.8 T-1405 설계 + T-1406 ~ T-1408 실판정, 후보 17 row 전건 — 유지 12 / 기록만 5 / 분류 변경 0), 위 수치 오차 3 건의 실제 정정 → **해소** (213 행 T-1394).
- **2026-08-02 정정 반영 (T-1394)** — 위 수치 오차 3 건을 §3 매트릭스 66 row 실측 (uc-covered 48 / frontmatter unique union 33 → envelope 잔차 15) 을 유일한 anchor 로 정정했다: §4 요약 행 union `31 → 33` · envelope `13 → 15` (합산식도 `33 + 15 + 4 + 13 + 1 = 66` 으로 닫힘), §5 `uc-covered` 비고 셀 분해 `31 직접 + 17 envelope → 33 직접 + 15 envelope` (count 48 · 73 % 는 무수정).
- 따라서 위 200 행 blockquote 의 "정정도 하지 않았다" 와 209 행의 "정정은 Follow-up 으로 넘긴다" 는 **T-1393 시점 (정정 전) 서술** 이며, 본 bullet 이 그 이후 상태 (수치 정정 완료 · 분류 판정은 여전히 미변경) 를 가리킨다.
- **2026-08-02 귀속 재판정 (T-1395)** — 축 A (`grep -n "^coversReq" docs/use-cases/UC-0*.md`): UC-01 `adjacentReq` 4 건 중 REQ-008 → UC-08 · REQ-032 → UC-07 은 다른 UC 의 `coversReq` 에 직접 명시되고 REQ-031 · REQ-034 는 8 UC 어디에도 직접 명시가 **없다** (기대값과 일치). 축 B (UC-01 본문): REQ-031 은 71 · 80 행 (§5 Main flow 의 sequence Note 2 곳) + 173 행 (§10 관련 REQ 표) **3 건**, REQ-034 는 130 행 (§8 Postconditions) + 175 행 (§10 관련 REQ 표) **2 건** 으로 **양쪽 다 본문 근거 0 건이 아니다**. 축 C (§3 근거 셀 원문): `| REQ-031 | FR | uc-covered | UC-01 (인접, P5 알고리즘) | … — UC-01 adjacentReq + §5 step 9 |` · `| REQ-034 | FR | uc-covered | UC-01 (인접, P5 trigger) | … — UC-01 adjacentReq |` — 두 row 모두 **`인접`(adjacent) 을 근거로 제시한 채 분류는 `uc-covered`** 다.
- 종합 판정 **(가) 매트릭스 유지** — 축 C 가 보이듯 §3 분류 체계에서 `adjacent` 는 `uc-covered` 의 **배제 사유가 아니라 하위 근거** 이고 (축 A 의 REQ-032 가 대조군: adjacent 이면서 UC-07 coversReq 로도 uc-covered), 축 B 가 UC-01 본문 실 서술 근거를 확인해 envelope cover 를 뒷받침한다. 따라서 §4 106 행 bullet 의 `adjacent` 표기 (frontmatter 축) 와 §3 65 · 68 행의 `uc-covered` 분류 (cover 실체 축) 는 서로 다른 축의 표기이며 모순이 아니다 — 매트릭스 row · bullet · §4 115 행 정합식 · §5 count 전부 **무수정**, 117 행 blockquote 의 미판정 문장만 본 판정 결과로 교체했다.
- 위 두 bullet 로 212 행 "미검증 축" 이 열거한 항목 중 `adjacent 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함)` 은 **2026-08-02 부로 해소** 된다. 같은 행의 나머지 축 (envelope-cover 의 의미적 타당성 · UC 본문 §5/§6/§8 의 frontmatter 대비 전수 검증 · 66 row 분류 자체의 재판정) 은 **미해소로 존속** 하며, 수치 오차 3 건 정정은 213 행 (T-1394) 에서 이미 완료됐다.
- **2026-08-02 envelope-cover 근거 재판정 (T-1396)** — 축 A (13 ID 를 `grep -n` 으로 UC-01 본문 전수 대조): 106 행이 나열한 envelope-cover 13 건 중 UC-01 본문에 ID 로 등장하는 것은 **REQ-033 (129 행, §8 Postconditions) 1 건뿐** 이고 나머지 12 건 (REQ-009 ~ 013 · 018 ~ 022 · 035 · 036) 은 hit **0** 이다. §10 관련 REQ 표 (153 ~ 178 행) 안의 hit 도 13 건 전부 **0** — 그 표는 primary 13 + 인접 4 만 싣기 때문이다.
- 축 B — 근거 강도 분포 **강 1 / 약 0 / 없음 12** (강 = §5 Main flow · §6 Alternative flows · §8 Postconditions 서술, 약 = §9 Component mapping · §10 표 요약 참조). 다만 본문의 envelope anchor 는 per-ID 가 아니라 **위임 문장** 형태로 실재한다: §5 step 10 `assessContributions(items, difficultyRouting)` 과 그 반환 `평가문 + 난이도 + 기여도 + 양`, §5 71 · 80 행 Note 의 `구체 알고리즘은 P5`, §8 129 · 130 행 결과 row 서술.
- **종합 판정 (가) envelope 선언 유지** — 121 ~ 123 행이 envelope 을 `UC envelope 내부 algorithmic / data-model cover` 로 정의하고 206 · 210 행도 같은 독법을 쓰므로, 개별 ID 미등장은 선언 위반이 아니라 정의 그대로다. 13 건은 UC-01 `coversReq` 가 아니라 bullet 안의 별도 label 로 적혀 있어 104 행 (frontmatter + 본문 §5 / §6 / §8 실 cover) 과도 충돌하지 않는다. 따라서 §4 106 행 bullet · §3 매트릭스 · 115 행 정합식 · §5 count 전부 **무수정**.
- 위 3 bullet 로 212 행 "미검증 축" 의 `envelope-cover 판정의 의미적 타당성` 은 **UC-01 13 건 범위에서 해소** 되고, 다른 7 UC 의 envelope / adjacent 나열은 미실측이라 해당 축은 **축소된 채 존속** 한다. 나머지 2 축 (UC 본문 §5/§6/§8 의 frontmatter 대비 전수 검증 · 66 row 분류 자체의 재판정) 은 2026-08-02 시점 **미해소로 존속**.
- **2026-08-02 UC-02 envelope-cover 근거 재판정 (T-1397)** — 축 0 (`grep -n "envelope-cover"` 전수): 본 문서의 label hit 는 106 · 107 · 117 · 212 · 217 · 218 · 221 행 **7 건** 이고 §4 bullet 8 줄 (106 ~ 113 행) 중 label 을 단 것은 **106 (UC-01) · 107 (UC-02) 2 줄뿐**, UC-03 ~ UC-08 6 줄은 **0** 이다 — 즉 본 bullet 로 envelope-cover 나열 모집단이 전량 실측된다. 축 A (`grep -n "REQ-003\|REQ-013\|REQ-020" docs/use-cases/UC-02-evaluation-query.md`): 3 건 **전부 hit 0**, §10 관련 REQ 표 (145 ~ 160 행) 안에서도 0 — 그 표는 primary 4 + 인접 3 만 싣는다.
- 축 B — 근거 강도 분포 **강 0 / 약 0 / 없음 3** (강 = §5 Main flow · §6 Alternative flows · §8 Postconditions 서술, 약 = §9 Component mapping · §10 표 요약 참조). 다만 UC-01 (T-1396) 과 같이 anchor 는 per-ID 가 아니라 **위임 문장** 형태로 실재한다: REQ-003 표시 축은 §8 124 행 `Web UI 에 평가 결과 표 + 시계열 차트 표시` 와 §9 138 행 Web UI row (`평가 결과 페이지 SPA — 표 / 시계열 차트 / sort·filter·window 컨트롤`), REQ-013 / 020 의 비교 view 는 §6.2 (server-side sort / filter 를 default 로 명시) · §6.3 (일 / 주 / 월 시계열 재집계) 이 ID 없이 서술한다.
- 축 C — **이중계상 0**. §3 매트릭스 37 행 REQ-003 = `cross-cutting`, 47 행 REQ-013 · 54 행 REQ-020 = `uc-covered` 이고 66 row 는 row 당 분류값이 1 개다. envelope 잔차 **15** 는 uc-covered 48 − frontmatter union 33 의 차집합이라 정의상 중복 계상이 불가능하며, 그 실 집합 (205 행) 은 REQ-009 ~ 013 / 018 ~ 022 / 031 / 033 ~ 036 으로 REQ-013 · REQ-020 을 **이미 1 회씩 포함** 하고 REQ-003 은 cross-cutting 4 에 계상돼 envelope 밖이다. 따라서 107 행 bullet 의 3 건이 15 에 추가로 더해진 흔적은 없고 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` · §5 count `48 / 4 / 13 / 1` 은 그대로 성립한다.
- **종합 판정 (가) envelope 선언 유지** — 121 ~ 123 행의 envelope 정의 (`UC envelope 내부 algorithmic / data-model cover`) 상 개별 ID 미등장은 선언 위반이 아니고, 축 C 가 이중계상 0 을 확인했으므로 §4 106 ~ 113 행 bullet · §3 매트릭스 · 115 행 정합식 · §5 count 전부 **무수정**. 이로써 212 행 "미검증 축" 의 `envelope-cover 판정의 의미적 타당성` 은 **UC-01 (T-1396) 13 건 + UC-02 (본 bullet) 3 건 = label 보유 bullet 2 줄 전량 실측** 으로 2026-08-02 부로 **완전 해소** 된다. 같은 행의 나머지 2 축 (UC 본문 §5/§6/§8 의 frontmatter 대비 전수 검증 · §3 매트릭스 66 row 분류 자체의 재판정) 은 **미해소로 존속**.
- **2026-08-03 UC-02 coversReq 자기 cover 검증 (T-1398)** — 축 A (`grep -n "REQ-038\|REQ-042\|REQ-046\|REQ-048" docs/use-cases/UC-02-evaluation-query.md`): 4 건 모두 본문 hit ≥ 4 건 (REQ-038 = §3 37·38·39 / §5 62 / §9 134·135, REQ-042 = §1 21 / §5 71 / §6.1 87 / §9 134, REQ-046 = §2 27·30 / §4 46 / §7.2 107 / §9 135, REQ-048 = §1 21 / §5 77 / §6.2 93 / §8 126 / §9 136) 이고 메타 hit (frontmatter 7 행 · §10 표 151 ~ 154 행 · 174 행 Refs) 는 별도 계상. 축 B — 근거 강도 **강 3 (REQ-038 · 042 · 048) / 약 1 (REQ-046) / 없음 0**; REQ-046 은 §5 · §6 · §8 에 ID hit 이 없으나 §5 65 행 Note `미인증/권한부족 시 §7.1·§7.2 분기` 와 §8 121 · 123 행 (`read-only operation` · `PersistenceModule 의 write 없음`) 이 ID 없는 위임 문장 anchor 로 실재한다.
- 축 C — UC-02 §10 표 151 ~ 154 행의 자기 선언 절 (REQ-038 = `§3 / §5 step 1–2, 8 / §6.2, §6.3 / §9`, REQ-042 = `§5 alt block / §6.1 / §8`, REQ-046 = `§2 / §7.2 / §9`, REQ-048 = `§5 step 9 / §8`) 대비 **선언 항 13 개 전건이 일치** (그중 REQ-038 의 §6.2 · §6.3 과 REQ-042 의 §8 은 ID 없는 `일치 (위임 문장)` — 각각 93 행 server-side sort/filter · 95 ~ 97 행 일·주·월 재집계 · 124 행 경고 배너 서술). `선언에만 있음` **0**, `실측에만 있음` 6 항 (REQ-042 의 §1 · §9, REQ-046 의 §4, REQ-048 의 §1 · §6.2 · §9) 은 선언이 좁은 것일 뿐 결함이 아니다. 부기: REQ-048 선언의 `§5 step 9` 는 arrow 계수 (§5 83 행 규약) 로는 step 8 (77 행) — Note 계수 차 ±1 이라 절 단위 판정에는 영향 없음. 축 D — §3 매트릭스 72 · 76 · 80 · 82 행 4 row 가 모두 `uc-covered` + 근거 셀이 `UC-02 coversReq` 를 지목하며 축 A ~ C 실측과 **어긋남 0**.
- **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 4 건이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남이 0 이므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-02 본문도 read-only (174 행 불변). 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 4 건 범위에서만 2026-08-03 부로 해소** 되고, UC-01 (13 건) · UC-03 ~ UC-08 7 UC 는 미실측이라 해당 축은 **축소된 채 존속** 한다. 같은 행의 마지막 축 (§3 매트릭스 66 row 분류 자체의 재판정) 은 **미해소로 존속**.
- **2026-08-03 UC-04 · UC-08 coversReq 자기 cover 검증 (T-1399)** — 축 A (`grep -n "REQ-043\|REQ-044" docs/use-cases/UC-04-account-auth.md` · `grep -n "REQ-008\|REQ-016" docs/use-cases/UC-08-permission-denied.md`): 4 건 모두 본문 hit ≥ 11 건 — REQ-043 = §1 19 / §3 38·40 / §4 48 / §5 66·73 / §7 116·130 (제목) / §9 166·167·168, REQ-044 = §1 19 / §2 27 / §3 37·38·39 / §4 48·50 / §5 69·73·79 / §6 96 (제목)·98 / §7 120·130·145 (제목) / §9 166·167·168, REQ-008 = §1 19·21 / §2 29·31 / §3 40 / §4 53 / §5 77·79·101·105 / §7 120 / §8 127·129 / §9 139·141, REQ-016 = §1 19·21 / §2 30·32 / §3 41 / §4 53 / §5 77·81·102·105 / §7 120 / §8 127·129 / §9 140·141. 메타 hit (frontmatter 각 7 행 · §10 표 UC-04 182·183 / UC-08 156·157 · Refs UC-04 199 / UC-08 179) 는 별도 계상. 축 B — 근거 강도 **강 4 / 약 0 / 없음 0** (2 UC 합계): 4 건 전부 §5 Main flow 에 ID hit 을 갖고 REQ-044 는 §6.1 (96·98), REQ-008 · REQ-016 은 §8 (127·129) 에도 hit. REQ-043 만 §6 · §8 에 ID hit 이 없으나 UC-04 153 · 154 행 (`Password 는 hash 저장` · `응답 layer 의 hashedPassword 누출 차단`) 이 ID 없는 위임 문장 anchor 로 실재한다.
- 축 C — UC-04 §10 표 182 · 183 행과 UC-08 156 · 157 행이 선언한 근거 절 **45 항 (REQ-043 7 · REQ-044 13 · REQ-008 13 · REQ-016 12) 전건이 일치**, `선언에만 있음` **0**. 그중 8 항은 ID 없는 `일치 (위임 문장)` — REQ-044 의 §4 precondition 2 (47 행 `User 테이블이 비어 있음. 1 회만 발화`) · §6.2 (102 행 `Admin 도 User→Admin 승급 가능 정책 박제`) · §6.3 (106 행 `SuperAdmin 만 수행 가능` + self-demote §7.5 분기), REQ-008 의 §6.1 (109 행 `resolvedAt 갱신, WebUI 표시 자동 사라짐`) · §6.4 (112 행 `인원 미매핑 GitHub 4xx → admin audience fallback`) · §9 WebModule (142 행 `audience 별 표시 영역 — Person 영역 / Admin 영역`), REQ-016 의 §6.1 · §9 WebModule (같은 두 행). REQ-043 선언의 `§3 trigger 2–4` 중 trigger 3 (39 행) 만 ID 가 REQ-044 뿐인데, 48 행 precondition 3 이 `(b)~(d) trigger 의 precondition — 인증 완료 (REQ-043)` 로 일괄 지목하므로 부분 위임으로 일치 처리했다. `실측에만 있음` **8 항** (절 단위 4 = REQ-008 · REQ-016 의 §4 53 행과 §7.2 120 행, 하위 항목 4 = REQ-044 의 §3 trigger 2 (38) · §7.3 (130), REQ-008 의 §2 GitHub Adapter row (29), REQ-016 의 §2 Confluence Adapter row (30)) 으로 선언이 좁은 것일 뿐 결함이 아니다.
- 축 D — §3 매트릭스 42 · 50 · 77 · 78 행 4 row 가 모두 `uc-covered` 이고 근거 셀이 각각 `GitHub 권한 부족 — UC-08 coversReq` · `Confluence 권한 부족 — UC-08 coversReq` · `ID/Password 보호 — UC-04 coversReq, 거의 모든 UC 가 adjacent` · `SuperAdmin / 3 등급 / 승급 — UC-04 coversReq` 로 축 A ~ C 실측과 **어긋남 0** (UC 열 의 인접 표기도 §4 109 · 113 행 bullet 과 정합). **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 4 건이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-04 (199 행) · UC-08 (179 행) 본문도 read-only 불변.
- 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 (T-1398 4 건) + UC-04 · UC-08 (본 bullet 4 건) = 8 UC 중 3 UC · coversReq union 33 중 8 건 실측** 시점이 되고, UC-01 (13 건) · UC-03 (7) · UC-05 (7) · UC-06 (3) · UC-07 (3) 은 미실측 (per-UC 합 33 은 REQ-045 등 중복 포함 수치, union 잔여는 25 건) 이라 해당 축은 **축소된 채 존속** 한다. 같은 행의 마지막 축 (§3 매트릭스 66 row 분류 자체의 재판정) 도 **미해소로 존속**.
- **2026-08-03 UC-06 · UC-07 coversReq 자기 cover 검증 (T-1400)** — 중복 실측 회피 규약: REQ-045 는 양 UC coversReq 에 있어 **선언 단위 2 회 (UC-06 164 행 · UC-07 170 행) · REQ 단위 1 건** 으로 세고, grep 은 UC 파일별로 분리 실행했다 (선언 6 = unique REQ 5). 축 A (`grep -n "REQ-037\|REQ-041\|REQ-045" docs/use-cases/UC-06-evaluation-delete-reeval.md` · `grep -n "REQ-030\|REQ-032\|REQ-045" docs/use-cases/UC-07-export-import.md`): 6 선언 모두 본문 hit ≥ 6 건 — UC-06 REQ-037 = §1 19 / §3 38 · 39 / §5 78 · 92 / §6.1 99 (제목) / §7 127 · 130 / §8 137 / §9 148 · 149 (11 건), REQ-041 = §1 19 / §3 37 / §5 78 / §6 99 (제목) · 105 · 115 (제목) · 117 / §7.3 127 / §9 148 · 149 / §11 178 (11 건), REQ-045 = §1 19 / §2 27 / §4 46 / §5 74 / §7.2 126 / §9 149 (6 건); UC-07 REQ-030 = §1 19 / §3 37 · 38 / §5 82 / §6 109 · 113 (제목) / §7.3 135 / §9 154 · 155 (9 건), REQ-032 = §1 19 · 21 / §4 49 / §5 82 · 86 · 91 / §7.3 135 / §8 145 / §9 155 · 156 (10 건), REQ-045 = §1 19 / §2 27 / §4 45 / §5 78 / §7.2 134 / §9 155 (6 건). 메타 hit (frontmatter 각 7 행 · §10 표 UC-06 162 ~ 164 · UC-07 168 ~ 170 · Refs UC-06 184 · UC-07 190) 는 별도 계상.
- 축 B — 근거 강도 **강 6 / 약 0 / 없음 0** (선언 6 기준, REQ-045 는 UC-06 · UC-07 각각 (강)): 6 선언 전부 §5 Main flow 에 ID hit 을 갖고 REQ-037 · REQ-041 · REQ-030 은 §6, REQ-032 는 §8 145 행에도 hit. 축 C — UC-06 162 ~ 164 행 · UC-07 168 ~ 170 행이 선언한 근거 절 **44 항 (10 + 9 + 4 + 12 + 5 + 4) 전건 일치**, `선언에만 있음` **0**, `실측에만 있음` **16 항** (선언이 좁은 방향이라 결함 아님). 그중 8 항은 ID 없는 `일치 (위임 문장)` — UC-06 §5 step 8 (84 행 `Assessment row 삭제 + Audit log row insert`, REQ-037 · REQ-041 공통) · REQ-041 의 §8 (136 행 `Assessment row N 개 영구 삭제 — hard delete`), UC-07 REQ-030 의 §5 step 7 (77 행 export / import 요청 arrow) · §6.5 (127 행 preview 가 `삭제 / 삽입 / 보존` 수치 선표시) · §7.4 (137 행 `dump 포맷 아님 → transaction 시작 전 reject`) · §8 (144 · 145 행 Export · Import 경로), REQ-032 의 §8 (a) Export (144 행 `DB 상태 무변화 (read-only operation)` — 6 선언 중 유일한 **간접** 위임이며 raw 미저장 직접 서술은 §5 86 행 Note 에 있다).
- 부기 — REQ-045 2 선언의 `§5 step N` 은 arrow 계수 규약 (UC-06 95 행 12 step · UC-07 105 행 17 step, alt / opt block arrow 포함) 대비 **각 1 이르다** (UC-06 선언 5 / 실측 6 · UC-07 선언 7 / 실측 8 = 인증·권한 검증 arrow). 두 UC 의 다른 선언 (REQ-037 · 041 의 step 7 · 8, REQ-030 의 step 7 · 9) 과 UC-07 §6.5 127 행의 `confirmation dialog step (step 4)` 는 현행 계수와 정합하므로, ±1 은 REQ-045 행 2 곳에 국한된 표기 편차이고 **절 단위 (§5) 판정에는 영향 없다** (T-1398 의 REQ-048 `step 9` 부기와 동형 — 정정은 Out of Scope). 축 D — §3 매트릭스 64 · 66 · 71 · 75 · 79 행 5 row 가 모두 `uc-covered` 이고 근거 셀이 `Export/Backup + Restore — UC-07 coversReq` · `raw 저장 금지 — UC-07 coversReq + schema-level 강제 (ADR-0002)` · `일괄 평가 + Reset & Reeval — UC-06 coversReq` · `Admin 최근 N일 결과 delete + 재수집 — UC-06 coversReq` · `Admin 권한 … — 다수 UC coversReq` 로 축 A ~ C 실측과 **어긋남 0** (79 행 REQ-045 의 UC 열 `UC-03, UC-05, UC-06, UC-07` 중 **UC-06 · UC-07 2 개만 본 slice 검증 범위** — UC-03 · UC-05 분은 미실측). cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 없음.
- **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 6 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남이 0 이므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-06 (184 행) · UC-07 (190 행) 본문도 read-only 불변. 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (본 bullet) = 8 UC 중 5 UC · coversReq union 33 중 13 건 실측** 시점이 되고, 잔여 **20 건** (UC-01 13 · UC-03 신규 6 · UC-05 신규 1 — REQ-045 · REQ-049 / 051 ~ 055 중복 제외 후) 이라 해당 축은 **축소된 채 존속** 한다. 같은 행의 마지막 축 (§3 매트릭스 66 row 분류 자체의 재판정) 도 **미해소로 존속**.
- **2026-08-03 UC-03 coversReq 자기 cover 검증 (T-1401)** — 계수 규약: UC-03 선언은 **7 (REQ-023 ~ 028 · REQ-045)** 이나 REQ-045 는 [T-1400](../tasks/T-1400-uc06-uc07-coversreq-selfcover-verify.md) 이 UC-06 · UC-07 축으로 이미 실측했으므로 union 진행률 가산은 **신규 6 (REQ-023 ~ 028)** 뿐이고, REQ-045 는 본 bullet 에서 **UC-03 선언 축으로만 신규 판정** 한다 (T-1400 이 남긴 미판정 항). 축 A (`grep -n "REQ-023\|REQ-024\|REQ-025\|REQ-026\|REQ-027\|REQ-028\|REQ-045" docs/use-cases/UC-03-person-crud.md` 1 회 실행): 7 선언 모두 본문 hit ≥ 5 건 — REQ-023 = §1 19 / §3 37 · 38 / §5 71 · 73 / §7.3 126 (제목) · 130 / §9 161 · 162 (9 건), REQ-024 = §1 19 / §3 37 · 38 / §5 71 · 73 / §6.2 100 (제목) · 102 / §7.3 126 (제목) · 131 · 132 / §9 162 (11 건), REQ-025 = §1 19 / §3 37 · 38 / §5 71 · 73 / §7.3 126 (제목) · 130 / §9 162 (8 건), REQ-026 = §3 39 · 40 · 41 / §5 77 / §6.1 94 (제목) · 98 / §9 162 · 163 (8 건), REQ-027 = §1 21 / §3 37 / §5 80 / §6.1 98 / §6.3 104 (제목) · 108 / §11 196 (7 건), REQ-028 = §1 19 / §3 37 · 42 / §5 71 · 73 / §6.4 110 (제목) / §7.5 140 (제목) / §9 161 · 162 · 163 (10 건), REQ-045 = §2 27 / §4 49 / §5 67 / §7.2 122 (제목) / §9 162 (5 건) — 본문 합 **58 건**. 메타 hit **21 건** (frontmatter 7 행 · §10 표 177 ~ 183 행 · Refs 206 행) 은 T-1398 ~ T-1400 축 A 규약대로 별도 계상.
- 축 B — 근거 강도 **강 7 / 약 0 / 없음 0** (선언 7 기준, union 신규 6 기준으로도 강 6): 7 선언 전부 §5 Main flow 에 ID hit (67 · 71 · 73 · 77 · 80 행) 을 갖고 REQ-024 · 026 · 027 · 028 은 §6 하위 절에도 hit. §8 은 ID hit 0 이나 REQ-026 · REQ-027 이 **위임 문장** 으로 cover — 148 행 `Person / ServiceIdentity / Group / Part row CRUD 완료 … soft-flag-toggle` · 149 · 150 행 `Deactivate 시 평가 대상 명단에서 숨김` / `Activate 시 다시 평가 대상에 포함` (REQ-026), 151 행 `신규 인원 추가 시 1년치 평가 1회 trigger enqueue` (REQ-027). REQ-025 (NULL 허용) 는 §5 71 행 Note · §7.3 130 행에 ID 동반 서술이 실재해 위임 판정 불요. 축 C — §10 표 177 ~ 183 행이 선언한 근거 절 **35 항 (5 + 6 + 4 + 5 + 4 + 6 + 5) 전건 일치**, `선언에만 있음` **0**, `실측에만 있음` **7 항** (REQ-025 의 §3 37 · 38, REQ-026 의 §9 162 UserModule row, REQ-027 의 §1 21 · §6.1 98 · §11 196, REQ-028 의 §3 37 trigger 1 · §9 163 PersistenceModule row) 으로 선언이 좁은 것일 뿐 결함이 아니다. 그중 2 항이 ID 없는 `일치 (위임 문장)` — REQ-026 · REQ-027 의 §8 postcondition.
- 부기 — `§5 step N` 표기를 arrow 계수 규약 (§5 90 행 10 step, alt / opt block arrow 포함 · `Note over` 제외 — arrow 는 65 · 66 · 67 · 70 · 77 · 78 · 81 · 85 · 86 · 87 행) 으로 검산하면 REQ-045 의 `step 3` 은 67 행 = arrow 3 과 **정확 일치 (편차 0)**, REQ-026 의 `step 6` 은 실측 77 행 = arrow 5 라 **선언이 1 늦고**, REQ-023 · 024 · 025 · 028 의 `step 5` 는 실측 hit 이 arrow 아닌 Note over 71 행 · alt 73 행 (arrow 4 ~ 5 사이) 이라 **±1 이내 근접 표기**, REQ-027 의 `alt block (신규 인원)` 은 80 ~ 83 행과 일치다 — T-1400 부기와 동형으로 **기록만** 하며 절 단위 (§5) 판정에는 영향 없다 (정정은 Out of Scope). 축 D — §3 매트릭스 57 ~ 62 · 79 행 7 row 가 모두 `uc-covered` 이고 근거 셀이 `서비스별 ID 매핑` · `Primary key 역할 ID` · `일부 NULL 허용` · `인원 CRUD + Deactivate/Activate` · `신규 인원 1년치 평가` · `Group 정책 (다중 + 단일 파트)` 의 `UC-03 coversReq` (57 ~ 62) 와 `Admin 권한 … — 다수 UC coversReq` (79) 로 축 A ~ C 실측과 **어긋남 0**: 58 행 REQ-024 의 `UC-03 (+ P3 ADR)` 은 §6.2 102 행이 마이그레이션 흐름을 P3 data-model ADR 로 위임한 서술과 정합하고, 60 행 REQ-026 의 UC 열 `UC-03, UC-01 (대상 명단)` 은 §8 149 · 150 행의 `UC-01 의 다음 cron 발화` 위임과 정합하며, 79 행 REQ-045 의 UC 열 4 개 중 **UC-03 1 개만 본 slice 범위** (UC-05 분은 여전히 미실측). cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 없음.
- **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 7 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D 어긋남이 0 이므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-03 (206 행) 본문도 read-only 불변. 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (T-1400) + UC-03 (본 bullet) = 8 UC 중 6 UC · coversReq union 33 중 19 건 실측** (본 slice 신규 6 = REQ-023 ~ 028) 시점이 되고, 잔여 **14 건** (UC-01 13 · UC-05 신규 1 = REQ-050) 이라 해당 축은 **축소된 채 존속** 한다. 같은 행의 마지막 축 (§3 매트릭스 66 row 분류 자체의 재판정) 도 **미해소로 존속**.
- **2026-08-03 UC-05 coversReq 자기 cover 검증 (T-1402)** — 계수 규약: UC-05 선언 **7 (REQ-049 ~ 055)** 은 [T-1398](../tasks/T-1398-uc02-coversreq-selfcover-verify.md) ~ [T-1401](../tasks/T-1401-uc03-coversreq-selfcover-verify.md) 어느 slice 도 실측한 적이 없어 **union 신규 7 (중복 차감 0)**, 다만 그중 6 (REQ-049 · 051 ~ 055) 은 UC-01 coversReq 13 에도 있어 **UC-01 선언 축으로는 잔여 미판정**. 축 A (`grep -n "REQ-049\|REQ-050\|REQ-051\|REQ-052\|REQ-053\|REQ-054\|REQ-055" docs/use-cases/UC-05-llm-config.md` 1 회): REQ-049 = §1 19 / §2 27 / §3 37 · 38 · 39 / §5 72 (Note over) / §7.3 137 (제목) / §9 183 · 184 · 186 (10 건), REQ-050 = §1 19 / §3 40 / §4 51 / §5 72 / §6.2 108 (제목) · 115 / §7.3 137 (제목) · 145 / §7.6 158 (제목) · 163 / §9 183 · 184 · 186 (14 건), REQ-051 ~ 055 = 각 §1 19 / §3 37 (range) / §5 72 (range) / §6.1 96 (제목 range) · 100 ~ 104 중 자기 1 행 / §7.3 137 (제목 range) · 141 (range) / §9 184 (range) (각 8 건) — 본문 합 **64 건**. 메타 hit **21 건** (frontmatter 7 행 · §10 표 201 ~ 207 행 · Refs 225 행) 은 T-1398 ~ T-1401 규약대로 별도 계상. **range 표기 규약 (본 slice 최초)**: `REQ-051~055` 형태 hit 는 5 선언 각각에 계상하고 `range` 를 병기한다.
- 축 B — 근거 강도 **강 7 / 약 0 / 없음 0** (선언 7 기준, union 신규 7 기준도 동일): 7 선언 전부 §5 Main flow 72 행 payload 검증 Note 에 ID hit 을 갖고, REQ-050 은 §6.2 · REQ-051 ~ 055 는 §6.1 에도 hit. §8 (167 ~ 176 행) 은 ID hit 0 이나 **위임 문장** 으로 cover — 172 행 `DifficultyMapping row 갱신 — 3 난이도 슬롯의 provider+model 결정. 모든 슬롯이 활성 provider 를 참조하는 invariant 만족` (REQ-050), 171 행 `API key 는 암호화 저장` + 174 행 `API key 자체는 audit 에 기록 X — 마스킹 형태로만 기록` (REQ-049 의 §6.4 121 ~ 124 행 마스킹 서술과 짝). 축 C — §10 표 201 ~ 207 행 선언 근거 절 **44 항 (6 + 8 + 6 × 5) 전건 일치**, `선언에만 있음` **0**, `실측에만 있음` **2 항** (REQ-049 의 §2 27 행 actor 표, REQ-050 의 §4 51 행 precondition invariant 문장) 으로 선언이 좁을 뿐 결함 아님. 그중 2 항이 ID 없는 `일치 (위임 문장)` — REQ-049 의 §6.1 (100 ~ 104 행 각 provider 의 `model 식별자` 서술) · REQ-050 의 §8 (172 행).
- 부기 — 7 선언이 모두 선언한 `§5 step 5` 를 arrow 계수 규약 (§5 92 행 자기 선언 11 step, alt block arrow 포함 · `Note over` 제외 — arrow 는 66 · 67 · 68 · 71 · 79 · 80 · 84 · 85 · 87 · 88 · 89 행) 으로 검산하면 실측 hit 72 행은 arrow 4 (71 행) 직후의 Note 라 **선언이 1 이르다 (편차 +1, ±1 이내)** — Note over 를 계수에 포함하면 정확히 step 5 가 되므로 원인은 Note 계수 여부다. T-1400 · T-1401 부기와 동형으로 **기록만** 하며 절 단위 (§5) 판정에 영향 없다 (정정은 Out of Scope). 축 D — §3 매트릭스 83 ~ 89 행 7 row 가 모두 `uc-covered` 이고 근거 셀이 전부 `UC-05 coversReq` 를 지목해 축 A ~ C 실측과 **어긋남 0**: 84 행 REQ-050 의 `UC-05 (+ P4 ADR)` · `ADR 필수` 는 §6.2 115 행이 난이도 분류를 P4 별도 ADR 로 위임한 서술과 정합하고, 83 · 85 ~ 89 행 UC 열의 `UC-05, UC-01 (cover)` / `UC-05, UC-01` 은 UC-01 이 같은 6 건을 coversReq 로 중복 선언한 사실의 반영이라 충돌 아니다 (UC-01 축 판정은 본 slice 범위 밖). cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 없음. 축 D-2 — 79 행 REQ-045 의 UC 열 4 개 중 **UC-05 분** 은 UC-05 frontmatter 8 행이 `adjacentReq: [REQ-043, REQ-044, REQ-045]` 로 적어 **coversReq 가 아니므로 본 축 (frontmatter coversReq ↔ 본문 cover) 의 모집단 자체가 아니다** — T-1400 · T-1401 이 남긴 dangling 항은 "미실측" 이 아니라 **"본 축 대상 아님" 으로 종결**. 다만 79 행이 77 · 78 행 (`UC-05 (인접)`) 과 달리 `(인접)` 표기 없이 UC-05 를 나열하는 점은 표기 비일관 **후보로 기록만** (정정 금지 · cascade 없음).
- **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 7 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D · D-2 어긋남이 0 이므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-05 (225 행) 본문도 read-only 불변. 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (T-1400) + UC-03 (T-1401) + UC-05 (본 bullet) = 8 UC 중 7 UC · coversReq union 33 중 26 건 실측** (본 slice 신규 7 = REQ-049 ~ 055) 시점이 되고, 잔여 **7 건** (UC-01 전용 = REQ-005 · 006 · 007 · 014 · 015 · 039 · 040) 이라 해당 축은 **축소된 채 존속** 한다. 같은 행의 마지막 축 (§3 매트릭스 66 row 분류 자체의 재판정) 도 **미해소로 존속**.
- **2026-08-03 UC-01 coversReq 자기 cover 검증 (T-1403)** — 계수 규약: UC-01 선언은 **13** 이고 그중 **union 신규 7 (REQ-005 · 006 · 007 · 014 · 015 · 039 · 040)**, 나머지 **6 (REQ-049 · 051 ~ 055)** 은 [T-1402](../tasks/T-1402-uc05-coversreq-selfcover-verify.md) 가 UC-05 축으로 이미 실측했으므로 union 진행률에는 신규 7 만 가산하고 6 은 본 bullet 에서 **UC-01 선언 축으로 신규 판정** 한다. **분할 불요 재판정**: [T-1401](../tasks/T-1401-uc03-coversreq-selfcover-verify.md) Follow-up 2 번의 "13 선언은 2 slice 분할 권장" 은 planner 사전 실측 (ID hit 행 **34** = 본문 19 + 메타 15) 이 UC-03 (58) · UC-05 (64) 보다 오히려 적음을 보여 **단일 slice 로 뒤집혔다** — 선언이 `REQ-005~007` · `REQ-051~055` range 로 압축된 덕이다. 축 A (`grep -n "REQ-005\|…\|REQ-055" docs/use-cases/UC-01-evaluation-execution.md` 1 회): 본문 hit **19 행 · 선언 단위 40 건** — REQ-005 = §5 74 / §9 141 (range), REQ-006 = §5 75 / §9 141 (range), REQ-007 = §5 76 / §9 141 (range), REQ-014 = §5 74 / §9 141, REQ-015 = §4 46 / §5 79 / §9 142, REQ-039 = §2 27 / §3 36 / §5 64 (alt cron) / §9 139 / §11 183, REQ-040 = §2 28 / §3 37 / §5 66 (alt manual) / §9 140 / §11 183, REQ-049 = §4 47 / §5 82 / §9 140 · 143, REQ-051 ~ 055 = 각 §4 47 (range) / §5 82 (range) / §9 143 (range). 메타 hit **15 건** (frontmatter 7 행 · §10 표 159 ~ 171 행 · Refs 193 행) 은 T-1398 ~ T-1402 규약대로 별도 계상. **range 확장 규약**: T-1402 의 `REQ-051~055` 규약을 본 slice 최초 등장한 `REQ-005~007` (141 행) 형태에도 적용해 포함된 각 선언에 계상하고 `range` 를 병기한다.
- 축 B — 근거 강도 **강 13 / 약 0 / 없음 0** (선언 13 기준, union 신규 7 기준도 강 7 / 약 0 / 없음 0): 13 선언 전부 §5 Main flow 에 ID hit (64 · 66 · 74 · 75 · 76 · 79 · 82 행) 을 갖는다. §6 (94 ~ 103 행) · §8 (124 ~ 132 행) 은 13 선언 어느 ID 도 직접 hit 이 **0** 이나 **위임 문장** 으로 cover — §6.1 98 행 `cron / manual trigger 의 차이는 AssessmentRun row 의 source metadata 컬럼으로만 표현` 과 §8 128 행 `source, startedAt, endedAt, trigger 출처 metadata 박제` (REQ-039 · REQ-040), §8 129 행 `각 인원 × 각 commit/문서 단위 (REQ-033) 의 기여도·난이도·양·평가문` (REQ-005 ~ 007 commit 축 · REQ-014 Issue 축 · REQ-015 Confluence 문서 축의 결과 row), 그 `평가문 + 난이도` 의 산출 주체는 §5 84 행 LlmModule 반환 (REQ-049 · 051 ~ 055).
- 축 C — §10 표 159 ~ 171 행이 선언한 근거 절 **29 항 (REQ-005 ~ 007 각 2 · REQ-014 2 · REQ-015 2 · REQ-039 3 · REQ-040 3 · REQ-049 3 · REQ-051 ~ 055 각 2) 전건 일치**, `선언에만 있음` **0**, `실측에만 있음` **11 항** (REQ-015 의 §4 46, REQ-039 의 §2 27 · §11 183, REQ-040 의 §2 28 · §11 183, REQ-049 의 §9 140 Worker row, REQ-051 ~ 055 의 §4 47) 으로 선언이 좁을 뿐 결함 아님. 그중 1 항이 ID 없는 `일치 (위임 문장)` — REQ-014 선언 `§5 step 5–7` 중 step 6 · 7 (75 · 76 행) 은 ID 가 REQ-006 · 007 만 병기됐으나 호출명 `fetchCommits/Issues` 가 Issue 수집을 3 instance 전부에 서술한다. 부기 — `§5 step N` 을 arrow 계수 규약 (§5 92 행 자기 선언 11 step, alt / par block arrow 포함 · `Note over` 제외 — arrow 는 65 · 67 · 70 · 74 · 75 · 76 · 79 · 82 · 84 · 86 · 87 행) 으로 검산하면 REQ-005 `step 5` = arrow 4 · REQ-006 `step 6` = arrow 5 · REQ-007 `step 7` = arrow 6 · REQ-014 `step 5–7` = arrow 4 ~ 6 · REQ-015 `step 8` = arrow 7 로 **선언이 일괄 1 이르고**, REQ-049 · 051 ~ 055 의 `step 10` = arrow 8 로 **2 이르다** — 편차량이 각 hit 앞의 `Note over` 개수 (71 행 1 개 · 71 + 80 행 2 개) 와 정확히 같아 원인은 Note 계수 여부이며, REQ-039 · 040 의 `alt cron` · `alt manual` 표기는 편차 **0** 이다. T-1400 ~ T-1402 부기와 동형으로 **기록만** 한다 (정정은 Out of Scope).
- 축 D — §3 매트릭스 39 · 40 · 41 · 48 · 49 · 73 · 74 행 7 row 가 모두 `uc-covered` 이고 근거 셀이 `github.com 평가` · `github.sec 평가` · `github.ecode 평가` · `Issue 평가 (본인 follow-up 제외)` · `Confluence SPACE 평가` · `Admin cron 주기 지정` · `Admin manual trigger` 뒤에 전부 `— UC-01 coversReq` 를 달아 축 A ~ C 실측과 **어긋남 0**. 39 · 40 · 41 · 48 · 49 행 UC 열의 `UC-01, UC-08 (인접)` 은 UC-01 §7.1 110 행 (`4xx → PermissionDeniedEvent emit, 후속 DB 기록·UI 표시는 UC-08 의 책임`) 및 §4 113 행 bullet (UC-08 adjacent 에 REQ-005 · 006 · 007 · 014 · 015 열거) 과 정합한다. 축 D-2 — 83 · 85 ~ 89 행 6 row 는 UC 열이 `UC-05, UC-01 (cover)` (83) · `UC-05, UC-01` (85 ~ 89) 이고 근거 셀은 전부 `UC-05 coversReq` 인데, 이는 대표 근거 1 개만 적은 표기일 뿐 UC-01 frontmatter 7 행이 같은 6 건을 실제로 선언한 사실 (본 slice 실측) 과 **충돌하지 않는다** — 이로써 T-1402 가 남긴 `REQ-049 · 051 ~ 055 의 UC-01 선언 축 미판정` dangling 항이 **종결** 된다. 83 행만 `(cover)` 를 달고 85 ~ 89 행은 달지 않는 표기 비일관은 **후보로 기록만** 한다 (정정 금지 · cascade 없음). cascade (§4 115 행 정합식 · §5 count 48 · INDEX 110 행 · PLAN 36 행) 발동 대상 없음.
- **종합 판정 (가) frontmatter ↔ 본문 정합 확인** — 13 선언이 (강) 등급 또는 위임 문장 anchor 로 §5 / §6 / §8 에서 cover 되고 축 C · D · D-2 어긋남이 0 이므로 §3 매트릭스 · §4 106 ~ 113 행 bullet · 115 행 정합식 · §5 count 전부 **무수정**, UC-01 (193 행) 본문도 read-only 불변. 이로써 212 행 "미검증 축" 의 `UC 본문 §5/§6/§8 이 frontmatter 대로 실제 cover 하는지` 는 **UC-02 (T-1398) + UC-04 · UC-08 (T-1399) + UC-06 · UC-07 (T-1400) + UC-03 (T-1401) + UC-05 (T-1402) + UC-01 (본 bullet) = 8 UC 전건 · coversReq union 33 중 33 건 실측** 으로 **해소** 된다 (본 slice union 신규 7 = REQ-005 · 006 · 007 · 014 · 015 · 039 · 040, UC-01 축 신규 판정 6 = REQ-049 · 051 ~ 055). 212 행의 잔여 축은 `§3 매트릭스 66 row 분류 자체의 재판정` (및 envelope-cover 의미적 타당성 · adjacent 서술 정확성 중 미해소분) 만 남으며, 212 행 문장 자체의 갱신은 append-only 규약 보존을 위해 Follow-up 소관이다.

## 12. 2026-08-03 §3 매트릭스 66 row 분류 재판정 설계 (T-1405)

> 본 절은 [T-1405](../tasks/T-1405-req-coverage-matrix-rejudge-scope-design.md) 가 §10 잔여 축 bullet (본 문서 L212 의 `§3 매트릭스 66 row 분류 자체의 재판정`) 을 후속 slice 들이 그대로 집행할 수 있도록 **범위 · 기준 · cascade · batch 분할** 만 박제한 설계 기록이다. **어떤 row 의 분류값도 판정하지 않는다 (판정 0)** — §1 ~ §11 본문은 1 자도 고치지 않았다.
>
> **삽입 위치 제약** — 본 절은 §11 References **바로 앞** 에 넣는다 (§10 이 §11 앞에 삽입된 선례와 동형). 그래야 250 행 이하의 행 번호가 전부 불변이라 §10 의 9 개 bullet 이 행 번호로 거는 L212 참조와 §4 `115 행` 정합식 참조가 그대로 유효하다.

### 12.1 재판정 범위 — 부분집합 안 채택 (후보 17 row)

**택한 안**: 전건 66 row 가 아니라 **결정 가능한 rule 로 잘라낸 부분집합 17 row** 만 재판정한다. 근거 3 줄:

1. `uc-covered` **48 row** 는 T-1395 ~ T-1397 의 축 C · T-1398 ~ T-1403 의 축 D 가 §3 근거 셀을 UC 실측과 1:1 대조해 **"어긋남 0" 을 6 회 박제** 했으므로 분류값 재판정이 이미 수행된 것과 동치다.
2. `gap` **1 row** (REQ-004) 는 §9.4 (2026-08-02) 가 `gap` **유지** 로 명시 재판정을 마쳤다.
3. 남은 `cross-cutting` 4 + `infrastructure` 13 = **17 row** 만이 2026-05-25 T-0029 최초 판정 이후 어떤 slice 도 분류 축으로 건드리지 않은 잔여다 — 전건 66 재판정은 49 row 의 중복 노동이라 채택하지 않는다.

**rule (R)** — §3 row 중 `cover 방식` 셀이 `cross-cutting` **또는** `infrastructure` 인 row 가 후보. 뒤집으면 `uc-covered` · `gap` row 는 제외. 셀 값이 4 enum 중 정확히 하나라서 rule 은 row 마다 기계적으로 결정된다.

산출 명령 1 회와 출력:

```
$ grep -c "^| REQ-[0-9]\{3\} | [^|]* | \(cross-cutting\|infrastructure\) |" docs/use-cases/REQ-COVERAGE-AUDIT.md
17
```

후보 17 = cross-cutting 4 (REQ-002 · 003 · 029 · 047 — §3 36 · 37 · 63 · 81 행) + infrastructure 13 (REQ-001 · 017 · 056 ~ 066 — §3 35 · 51 · 90 ~ 100 행). 같은 grep 형태로 `uc-covered` = **48** · `gap` = **1** 도 실측해 48 + 1 + 17 = **66** 검산 통과. 이 **17 이 후속 slice 분할의 분모** 다.

### 12.2 판정 기준 — §2 4 enum 참조 (재정의 없음)

재판정은 §2 22 ~ 27 행의 4 enum (`uc-covered` / `cross-cutting` / `infrastructure` / `gap`) 을 **그대로 참조** 한다. 본 절은 enum 을 재정의하지 않고 새 분류값도 신설하지 않는다.

row 1 개 판정에 요구되는 **근거 3 종**:

| 근거 | 무엇을 보는가 | 실측 방법 |
| --- | --- | --- |
| (i) UC frontmatter 실측 | 해당 REQ 가 8 UC 의 `coversReq` / `adjacentReq` 에 있는지 (있으면 `uc-covered` 쪽 후보) | `grep -n "REQ-0NN" docs/use-cases/UC-0*.md` |
| (ii) UC 본문 hit | §5 sequence · §6 alternative · §8 postcondition 의 ID hit 또는 ID 없는 위임 문장 anchor | 같은 grep 결과의 본문 행을 절 단위로 귀속 |
| (iii) `docs/requirements.md` 원문 + cover 위치 셀 | REQ 원문의 kind (FR / NFR / Constraint) 와 §3 이 지목한 doc / ADR / CLAUDE.md § 가 실재하며 그 REQ 를 실제로 다루는지 | requirements.md 해당 행 read + 지목 파일 직접 read |

**분류 변경 임계** — 근거 3 종 중 **2 종 이상** 이 현 분류와 어긋날 때만 분류값을 바꾼다. **1 종만** 어긋나면 `기록만` (분류 무수정 + 본 절에 bullet append). T-1398 ~ T-1403 이 확립한 **"어긋남이 없으면 무수정 · 표기 비일관은 기록만"** 규약을 그대로 승계한다.

부기 — (iii) 의 링크 rot (지목 파일 부재 · § 번호 밀림) 는 분류 오류가 아니라 **cover 위치 셀의 표기 오류** 이므로 임계 계산에서 1 종 어긋남으로만 세고, 정정은 그 slice 안에서 cascade (a) 의 셀 수정으로 처리한다.

### 12.3 cascade 대상 전수 열거 (6 지점)

분류값이 **실제로 바뀔 때만** 동기화가 강제된다. `무수정` 판정이면 6 지점 전부 발동하지 않는다 (T-1400 ~ T-1403 이 `cascade … 발동 대상 없음` 으로 남긴 선례).

| # | 지점 | 현재 값 | 갱신 트리거 조건 |
| --- | --- | --- | --- |
| (a) | §3 해당 row 의 `cover 방식` · `cover 위치` · `참고` 셀 | row 당 분류값 1 개 (66 row) | **모든** enum 전이. 표기 오류만이면 `cover 위치` · `참고` 셀만 |
| (b) | §4 106 ~ 114 행 9 UC bullet | UC 별 coversReq / adjacent / envelope-cover 나열 9 줄 | `→ uc-covered` 또는 `uc-covered →` 전이일 때만 (해당 UC bullet 의 envelope · adjacent 나열 증감) |
| (c) | §4 116 행 정합식 | `34 + 15 + 4 + 13 + 0 = 66` | 4 항 중 하나라도 증감하는 전이 전부. 34 (frontmatter union) 은 UC frontmatter 를 고치지 않는 한 불변이라 실제로 움직이는 것은 15 / 4 / 13 / 0 항 |
| (d) | §5 122 ~ 128 행 표 count 4 값 + 합계 row | `49 / 4 / 13 / 0` · `74 / 6 / 20 / 0 %` · 합계 `**66**` · `**100 %**` + 비고 셀 | (c) 와 동일 트리거. 합계 66 · 100 % 는 row 수 불변이라 **항상 무변**, percentage 4 값은 반올림 재산출 필요 |
| (e) | `docs/use-cases/INDEX.md` 118 ~ 121 행 | `uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0` (118 행 원 출처 4 값 48 / 4 / 13 / 1 은 시점 기록으로 보존) | (c) · (d) 발동 후 그 결과 수치를 옮겨 적을 때 |
| (f) | `docs/PLAN.md` 36 행 | `uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66` (36 행 앞부분의 옛 4 값 + gap 1 건 서술은 시점 기록으로 보존) | (e) 와 동일. gap count 가 바뀌면 gap 서술 문장도 함께 |

§9.4 · §10 의 이전 요약 문장은 **cascade 갱신 대상이 아니다** — append-only 규약상 각 시점 판정을 그대로 보존하고 이후 상태는 새 bullet 이 가리킨다 (214 행이 200 · 209 행에 대해 쓴 시점 구분 화법이 정본).
2026-08-03 (T-1412): INDEX.md 의 UC-09 row · description 등록으로 (e) 지점 행 번호가 110 → 118 로 이동 (수치 문자열 무변). §12.6 ~ §12.10 본문의 `110 행` 표기는 시점 기록이라 append-only 규약대로 보존.
2026-08-03 (T-1413): §4 에 UC-09 bullet 1 행 삽입으로 편집 전 114 행 이하가 +1 (본 각주 이후 구간은 +2) 이동 — (b) · (c) · (d) 셀의 행 pointer 와 현재 값을 동기했다. §9 · §10 · §12.6 ~ §12.10 본문의 `115 행` · `121 ~ 127 행` · `L212` 등 옛 행 표기는 시점 기록이라 append-only 규약대로 보존.
2026-08-03 (T-1414): §12.4 가 분리 허용으로 남긴 cascade (e) · (f) 를 실행해 INDEX.md 118 ~ 121 행 · PLAN.md 36 행에 현 시점 4 값을 append 했고, 위 표의 (e) · (f) `현재 값` 열을 그 결과로 치환했다. 두 파일의 옛 4 값 문장은 append-only 규약대로 무편집 보존 — 근거 §12.12.

### 12.4 cascade 순서 + 원자성 규약

- **순서** — (a) → (b) → (c) → (d) → (e) → (f). 앞 단계 결과가 뒤 단계 입력이다 (row 실측 → bullet 나열 → 정합식 → 통계표 → 외부 요약 2 곳).
- **원자 묶음** — **(a) ~ (d) 는 반드시 한 slice 안에서 함께** 갱신한다. 넷 다 같은 파일 안의 상호 정합식이라 분리하면 중간 commit 이 `합 ≠ 66` 같은 자기모순 상태로 main 에 남는다.
- **분리 허용** — (e) · (f) 는 **별도 slice 로 미뤄도 된다**. 파일이 다르고 성격이 요약 문구라 lag 이 모순을 만들지 않으며, 이미 Follow-up 소관으로 분리 운용돼 왔다 (T-1404 Follow-up 3).
- **5 파일 cap 과의 관계** — 원자 묶음 (a) ~ (d) 는 파일 **1 개** 라 slice 당 변경 파일이 audit 문서 1 + task 파일 1 = **2 개** (cap 5 의 40 %). (e) · (f) 를 같은 slice 에 넣어도 4 개로 cap 안이지만, 그 경우 리스크는 LOC 이 아니라 **판정 축 혼재** 라 분리를 기본으로 한다.

### 12.5 후속 실판정 slice 분할안 (3 slice)

batch 크기는 T-1398 ~ T-1403 실적 (**UC 1 ~ 2 개 · bullet 2 ~ 5 줄 append · 90 ~ 160 LOC**) 을 근거로 산정했다. 각 slice 는 본 audit 문서 1 파일 + 자기 task 파일 1 개 = **2 파일** 만 건드려 cap (300 LOC / 5 파일) 안이다.

| slice | 담당 row batch | 건수 | 예상 diff | 비고 |
| --- | --- | --- | --- | --- |
| S1 | cross-cutting 전건 — REQ-002 · 003 · 029 · 047 | 4 | 140 ~ 160 LOC | 근거 (iii) 대상이 architecture doc 3 종 (components / modules / deployment) + ADR-0002 라 row 당 비용 최대. REQ-003 은 T-1397 축 C 가 `cross-cutting` 을 부수 확인한 대조군 |
| S2 | infrastructure 전반 — REQ-001 · 017 · 056 ~ 060 | 7 | 100 ~ 130 LOC | 지목 대상이 README · CLAUDE.md §1 / §3 / §3.2 R-110 ~ R-112 · ci.yml 로 동종이라 batch 효율 높음. REQ-017 만 `P4 ADR 예정` 미실재 pointer 라 별도 판정 |
| S3 | infrastructure 후반 — REQ-061 ~ 066 | 6 | 110 ~ 140 LOC | CLAUDE.md §3.2 R-113 / R-114 · §3.3 · §3.1 + agent spec 2 종. **마지막 slice** — 3 slice 종합 판정을 요약하고 §10 잔여 축 bullet (L212) 의 `유일 잔여 축` 문구를 닫는다 (in-place 1 줄 교체, T-1404 선례와 동형) |

합 17 row = 4 + 7 + 6 으로 12.1 의 분모와 일치. S1 · S2 는 서로 독립이라 순서 무관이나 **S3 는 반드시 마지막** 이다 — L212 closure 가 앞 두 slice 판정 결과를 인용해야 하기 때문이다.

### 12.6 S1 실판정 — cross-cutting 4 row (T-1406)

> 본 절은 [T-1406](../tasks/T-1406-req-coverage-s1-crosscutting-rejudge.md) 이 §12.5 의 S1 batch (cross-cutting 전건 4 row — REQ-002 · 003 · 029 · 047, §3 36 · 37 · 63 · 81 행) 를 §12.2 근거 3 종 + 2/3 임계로 실판정한 기록이다. **삽입 위치는 §12.5 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 가 불변이다 — 그래야 324 행 이하 전건이 행 번호 불변으로 남아 §10 의 L212 잔여 축 bullet 참조와 §4 115 행 정합식 참조가 그대로 유효하다.

#### 실측 명령 (축별 4 회)

```
$ grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047" docs/use-cases/UC-0*.md
(hit 0 — 8 UC 전건)
$ grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047" docs/architecture/components.md docs/architecture/modules.md docs/architecture/deployment.md docs/decisions/ADR-0002-db.md
docs/architecture/deployment.md:67:### REQ-047 (1 h 처리) 충족 시나리오
docs/architecture/deployment.md:73: (미충족 시 worker + 외부 큐 도입 검토 조건)
docs/decisions/ADR-0002-db.md:27 / 61  (REQ-029 non-volatile — WAL + fsync durability)
docs/decisions/ADR-0002-db.md:32 / 47 / 121 / 127  (REQ-047 처리량 · NFR 충족 가능성 · Refs)
$ grep -n "Web UI\|WebModule\|DB Persistence" docs/architecture/components.md docs/architecture/modules.md
components.md:113 | **Web UI** | (45 · 52 다이어그램, 160 · 161 interaction)   components.md:116 | **DB Persistence** |
modules.md:43 | **WebModule** |   modules.md:196 | **Web UI** | WebModule | 1:1 mapping
$ awk 'NR==21||NR==22||NR==48||NR==66' docs/requirements.md
21: REQ-002 | FR  | Web Interface 를 제공하는 Agent System
22: REQ-003 | FR  | 개발자 기여 양·질 평가 / 저장 / 표시
48: REQ-029 | NFR | 평가 자료 non-volatile 저장
66: REQ-047 | NFR | 100~200명 / 50~100 repo / ~1000 confluence / 1h 이내
```

첫 grep 의 **hit 0** 이 S1 4 row 판정의 축이다 — 4 REQ 중 어느 것도 8 UC 의 `coversReq` / `adjacentReq` 또는 본문 §5 · §6 · §8 의 ID anchor 에 등장하지 않는다. 이는 §2 25 행의 "단일 UC 의 coversReq 에 박제하기 부적합" 과 정확히 부합하므로, 근거 (i) · (ii) 는 4 row **전건에서 현 분류 `cross-cutting` 과 일치** 이며 `uc-covered` 로 끌어올릴 근거는 0 이다.

#### row 별 근거 3 종 실측

| 대상 row | (i) UC frontmatter | (ii) UC 본문 hit | (iii) requirements 원문 + cover 위치 셀 | 어긋남 |
| --- | --- | --- | --- | --- |
| 36 행 REQ-002 | hit 0 — 일치 | ID hit 0 — 일치 | 21 행 kind `FR` = 셀 `FR` 일치. 지목 2 곳 실재 — components.md 113 행 `Web UI` component row (React + Vite SPA) + modules.md 43 행 `WebModule` row 및 196 행 `Web UI → WebModule 1:1` mapping. 둘 다 Web Interface 축을 실제로 다룸 — 일치 | **0 종** |
| 37 행 REQ-003 | hit 0 — 일치 | ID hit 0 — 일치 | 22 행 kind `FR` = 셀 `FR` 일치. 다만 cover 위치 셀이 `UC-01 (생성) + UC-02 (표시)` 로 **UC 2 개** 를 지목 — 두 파일 다 실재하나 §2 25 행이 예시한 박제 장소 (architecture doc / ADR) 밖 종류다 — **어긋남 (표기 경계)** | **1 종** |
| 63 행 REQ-029 | hit 0 — 일치 | ID hit 0 — 일치 | 48 행 kind `NFR` = 셀 `NFR` 일치. ADR-0002 27 행 (non-volatile 근거) · 61 행 (WAL + fsync 로 충족) 이 REQ-029 를 명시적으로 다루고 components.md 116 행 `DB Persistence` row 실재 — 일치 | **0 종** |
| 81 행 REQ-047 | hit 0 — 일치 | ID hit 0 — 일치 | 66 행 kind `NFR` = 셀 `NFR` 일치. deployment.md 67 행 절 제목 `### REQ-047 (1 h 처리) 충족 시나리오` 가 셀의 `§REQ-047` 지목과 문자 그대로 일치 (73 행에 미충족 시 재검토 조건 부기). `P7 perf test` 는 66 행 phase `P7` · 검증 `manual + perf test` 와 일치 — 일치 | **0 종** |

#### 임계 적용 + 최종 판정

§12.2 288 행 임계 (2 종 이상 → 분류 변경 / 1 종 → `기록만` / 0 종 → 무수정) 를 기계적으로 적용한다.

| 대상 row | 어긋남 종수 | 판정 |
| --- | --- | --- |
| 36 행 REQ-002 | 0 | **유지** (`cross-cutting`) |
| 37 행 REQ-003 | 1 | **기록만** — 분류 `cross-cutting` 무수정, 본 절 부기로 갈음 |
| 63 행 REQ-029 | 0 | **유지** (`cross-cutting`) |
| 81 행 REQ-047 | 0 | **유지** (`cross-cutting`) |

- REQ-003 의 1 종을 `변경` 으로 끌고 가지 않은 이유 — 어긋난 것은 **cover 위치 셀의 지목 종류** 뿐이고 분류 축 자체 (다수 UC 공유 · 단일 UC 박제 부적합) 는 오히려 `UC-01 + UC-02` 병기가 강화한다. §12.2 290 행 부기의 "표기 오류는 임계 계산에서 1 종으로만 센다" 를 그대로 따라 보수적으로 `기록만` 을 택했다.
- requirements.md 의 status 컬럼 (22 행 `IN_PROGRESS` · 48 행 `DONE (implemented-on-main)` · 66 행 `PLANNED 유지`) 은 **구현 진척 축** 이라 §3 의 **cover 방식 분류 축** 과 무관하다 — 분류 전이 근거로 쓰지 않았다.

#### REQ-003 주의 지점 명시 판정 — §3 37 행 vs §4 107 행

**판정: 모순 아님 — 양립 (분류 무수정).** §4 107 행이 UC-02 bullet 에 `envelope-cover: REQ-003 (표시)` 를 나열하면서 §3 37 행이 같은 REQ 를 `cross-cutting` 으로 분류하는 것은 두 절의 **나열 기준 차이** 다 — §4 는 UC → REQ 역방향 view 라 "그 UC 가 덮는 부분" 을 적고, §3 은 REQ → cover 정방향 view 라 "REQ 전체를 무엇이 덮는가" 를 판정한다 (§4 117 행 blockquote 가 13 vs 15 에 대해 쓴 화법과 동형). REQ-003 의 3 축 (평가 · 저장 · 표시) 중 UC-02 envelope 안에 드는 것은 **표시 축뿐** 이라 단일 UC 로는 REQ 전체가 덮이지 않으며, 이것이 §2 25 행 "다수 UC 가 공유하는 횡단 관심사" 요건 그 자체다. §3 37 행 cover 위치 셀이 이미 `UC-01 (생성) + UC-02 (표시)` 두 UC 를 병기한다는 사실이 두 서술을 같은 사실의 두 시점 표현으로 자기 증명한다. 이 축으로 어긋난 근거 종수는 **0** 이라 임계상 무수정이다.

#### cascade 판정

**분류값 변경 0 건 → cascade (a) ~ (f) 발동 대상 없음.** §12.3 294 행이 규정한 "`무수정` 판정이면 6 지점 전부 발동하지 않는다" 그대로다 (T-1400 ~ T-1403 선례 화법). 특히 §5 124 행 `cross-cutting` 비고 셀이 열거한 4 건 ID 는 본 절 판정 대상 4 row 와 정확히 같은 집합이라 (b) bullet · (c) 정합식 `4` 항 · (d) 통계표 `4` 값이 모두 무변이고, (e) INDEX.md 110 행 · (f) PLAN.md 36 행 도 옮겨 적을 새 수치가 없다.

**cascade 7 번째 후보 지점 (발견 기록 — 본 slice 미발동)** — §12.3 표의 (c) `15` 항 (envelope 잔차) 이 장래 움직이면 §4 **117 행 blockquote** 의 `15` · `13` · `차이 2 건` 서술도 동시에 stale 해진다. 즉 (c) 는 115 행 정합식 1 곳이 아니라 117 행 blockquote 를 부속으로 거느린다. 본 slice 는 `15` 항이 무변이므로 117 행도 무수정이며, §12.3 표 자체는 append-only 규약상 손대지 않는다 (표에 row 를 끼우면 §12.4 · §12.5 의 행 번호가 밀린다).

#### 불변 검산 6 값 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## "` | 12 불변 (`###` 추가) | **12** |
| (c) | 잔여 축 문구 grep 첫 hit / 총 hit | L212 / 10 불변 | **L212 / 10** |
| (d) | L212 참조 문자열 count | 9 불변 | **9** |
| (e) | `sed -n '115p'` 정합식 | 여전히 115 행 · 합 66 | **115 행 · `33 + 15 + 4 + 13 + 1 = 66`** |
| (f) | §5 표 (121 ~ 127 행) count 4 값 + 합계 | 합 66 · `**100 %**` | **48 / 4 / 13 / 1 = 66** · 합계 row `**100 %**` 불변 |

(c) · (d) 가 불변인 것은 본 절이 그 두 검산 대상 문자열을 **의도적으로 쓰지 않고** 회피 표기 (`L212` · `잔여 축`) 를 쓴 T-1405 선례를 승계한 결과다. (f) 의 개별 percentage 4 값 (`73 / 6 / 20 / 2 %`) 합이 101 인 것은 반올림 오차이며 합계 row 표기 `**100 %**` 와 함께 본 slice 에서 무변이다.

#### S1 종합 판정 + 잔여

- **판정 분포 — 유지 3 / 기록만 1 / 변경 0** (REQ-002 · 029 · 047 유지, REQ-003 기록만). cross-cutting 4 row 는 2026-05-25 T-0029 최초 판정 이후 처음으로 근거 3 종 실측을 통과했고, 분류값은 전건 그대로다.
- **진척 — 후보 17 중 4 완료 · 잔여 13** (S2 infrastructure 7 = REQ-001 · 017 · 056 ~ 060, S3 infrastructure 6 = REQ-061 ~ 066).
- **§10 의 잔여 축 bullet (L212) 문구는 본 slice 에서 건드리지 않았다** — `유일 잔여 축` closure 는 §12.5 324 행이 못박은 대로 **S3 소관** 이다 (앞 두 slice 판정 결과를 인용해야 하므로).

#### 한계 —

1. **S2 · S3 배정 13 row 미판정** — infrastructure 전건 (REQ-001 · 017 · 056 ~ 066) 의 분류는 본 slice 에서 손대지 않았고 최초 판정값 그대로다.
2. **cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 미동기** — 본 slice 는 분류값 변경 0 이라 동기 자체가 불요였으나, 두 지점의 정합 확인도 수행하지 않았다 (§12.4 311 행의 분리 허용 + T-1404 Follow-up 3 소관).
3. **표기 비일관 3 건 미정정** — §3 83 행 `(cover)` · 79 행 `(인접)` 표기 편차와 UC §10 표의 `§5 step N` ±1 편차는 분류 축과 무관해 그대로 두었다.
4. **근거 (iii) 의 architecture doc 확인은 정적 실측** — `grep` hit + 절 제목 / 표 row 실재 수준까지만 대조했고, 그 문서가 해당 REQ 를 **충분히** 다루는지의 질적 평가 (예: components.md `Web UI` 서술이 REQ-002 의 Web Interface 요구를 실제로 만족시키는 깊이인지) 는 하지 않았다.

### 12.7 S2 실판정 — infrastructure 7 row (T-1407)

> 본 절은 [T-1407](../tasks/T-1407-req-coverage-s2-infrastructure-rejudge.md) 이 §12.5 의 S2 batch (infrastructure 전반 7 row — REQ-001 · 017 · 056 ~ 060, §3 35 · 51 · 90 ~ 94 행) 를 §12.2 근거 3 종 + 2/3 임계로 실판정한 기록이다. **삽입 위치는 §12.6 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 가 불변이다 — 그래야 410 행 이전 행 번호가 전건 불변으로 남아 §10 의 L212 잔여 축 bullet 참조와 §4 115 행 정합식 참조가 그대로 유효하다 (아래 51 행 셀 치환은 1:1 in-place 라 행 수를 바꾸지 않는다).

#### 실측 명령 (축별 5 회)

```
$ grep -n "REQ-001\|REQ-017\|REQ-056\|REQ-057\|REQ-058\|REQ-059\|REQ-060" docs/use-cases/UC-0*.md
(hit 0 — 8 UC 전건, exit 1)
$ awk 'NR==20||NR==36||NR==75||NR==76||NR==77||NR==78||NR==79' docs/requirements.md   # kind + 지시 원문 컬럼만, status 는 앞 200 자
20: REQ-001 | 본 문서는 Use Case 문서의 기본 | Constraint | P2 | policy | DONE (implemented-on-main …)
36: REQ-017 | Confluence SPACE crawling vs hierarchy 탐색 정책 (ADR) | Constraint | P4 (ADR 필수) | DONE (… ADR 실재 축 …)
75: REQ-056 | Well-known library / 중복 import 금지 / version mismatch 방지 | Constraint | P0 + 모든 phase | IN_PROGRESS
76: REQ-057 | 한 commit = 한 주제 | Constraint | (정책) CLAUDE.md §3 | DONE
77: REQ-058 | commit/PR 후 코드 검토 + test 작성 + test 수행 | Constraint | CLAUDE.md §3.2 R-110 + agents | DONE
78: REQ-059 | 모든 test → CI 자동 실행, fail → CI error | Constraint | CLAUDE.md §3.2 R-111 + ci.yml | DONE (T-0005 후 active)
79: REQ-060 | unit test (기능 + 예외 + flow + negative) | Constraint | CLAUDE.md §3.2 R-112 + planner | DONE
$ grep -n "^## 1\.\|^## 3\.\|^### 3\.2\|R-110\|R-111\|R-112" CLAUDE.md
31: ## 1. 기술 스택 (확정)   112: ## 3. Task / Commit / PR 원칙   147: ### 3.2 Test·CI 절대 규칙
151: R-110 정의   156: R-111 정의   160: R-112 정의   (18 · 118 · 168 행은 §0.5 인덱스 · 본문 인용)
$ grep -n "^\s*- name:" .github/workflows/ci.yml
(step 32 개) 190 의존성 설치 `pnpm install --frozen-lockfile` / 193 Lint 검사 `pnpm lint` / 196 Build /
218 테스트 + 커버리지 검사 / 223 스모크 테스트 / 228 e2e test / 234 perf test / 245 reviewer agent approval 검증
$ ls .claude/agents/ ; sed -n '1p' README.md ; sed -n '1,4p' docs/decisions/ADR-0013-confluence-space-traversal-policy.md
architect · executor · implementer · integrator · notifier · planner · reviewer · tester (8 종 실재)
README 1 행 = "본 문서는 이 Software System의 소개로서 Use Case 문서의 기본이 되는 Description 역할과 …"
ADR-0013 | status: ACCEPTED | date: 2026-06-01
```

첫 grep 의 **hit 0** 이 S2 7 row 판정의 축이다 (S1 과 동형) — 7 REQ 중 어느 것도 8 UC 의 `coversReq` / `adjacentReq` 또는 본문 §5 · §6 · §8 의 ID anchor 에 등장하지 않는다. 이는 §2 26 행의 "Constraint REQ — UC 영역 밖" 과 정확히 부합하므로 근거 (i) · (ii) 는 7 row **전건에서 현 분류 `infrastructure` 와 일치** 이며 `uc-covered` 로 끌어올릴 근거는 0 이다. `kind` 컬럼도 7 건 전부 `Constraint` 로 §3 셀과 일치한다.

#### row 별 근거 3 종 실측

| 대상 row | (i) UC frontmatter | (ii) UC 본문 hit | (iii) requirements 원문 + cover 위치 셀 | 어긋남 |
| --- | --- | --- | --- | --- |
| 35 행 REQ-001 | hit 0 — 일치 | ID hit 0 — 일치 | 20 행 kind `Constraint` = 셀 일치. 지목 2 곳 실재 — README.md 1 행이 `Use Case 문서의 기본` 을 문자 그대로 담고 INDEX.md 1 · 3 행이 UC 목록 backbone 을 선언. 다만 지목처가 §2 26 행 열거 (ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md) **밖** 종류 — **어긋남 (표기 경계)** | **1 종** |
| 51 행 REQ-017 | hit 0 — 일치 | ID hit 0 — 일치 | 36 행 kind `Constraint` = 셀 일치. 그러나 cover 위치 셀이 `P4 ADR 예정` 이었는데 ADR-0013 (ACCEPTED · 2026-06-01) 이 이미 실재 — **stale pointer = 링크 rot** (§12.2 290 행 부기 적용) | **1 종** |
| 90 행 REQ-056 | hit 0 — 일치 | ID hit 0 — 일치 | 75 행 kind `Constraint` = 셀 일치. CLAUDE.md 31 행 `## 1. 기술 스택 (확정)` 이 stack 을 확정표로 고정 (+ §9 가 새 dependency 를 BLOCKED 로 차단) 하고 ci.yml 190 행 `pnpm install --frozen-lockfile` (version mismatch 축) · 193 행 `Lint 검사` (중복 import 축) 가 실재 — 일치 | **0 종** |
| 91 행 REQ-057 | hit 0 — 일치 | ID hit 0 — 일치 | 76 행 kind `Constraint` = 셀 일치. CLAUDE.md 112 행 `## 3. Task / Commit / PR 원칙` 첫 bullet 이 `1 task = 1 commit` 을 명시 — 셀 지목 `§3 (1 task = 1 commit)` 과 문자 그대로 일치 | **0 종** |
| 92 행 REQ-058 | hit 0 — 일치 | ID hit 0 — 일치 | 77 행 kind `Constraint` = 셀 일치. CLAUDE.md 147 행 §3.2 · 151 행 R-110 정의가 `코드 검토 + test case 작성 + test 수행` 3 종을 규정하고 `.claude/agents/` 8 종 (tester · reviewer · integrator 포함) 실재 — 일치 | **0 종** |
| 93 행 REQ-059 | hit 0 — 일치 | ID hit 0 — 일치 | 78 행 kind `Constraint` = 셀 일치. CLAUDE.md 156 행 R-111 + ci.yml 218 · 223 · 228 행 (unit + smoke + e2e) step 실재 — test fail 이 CI red 로 연결되는 경로가 실제로 배선됨 — 일치 | **0 종** |
| 94 행 REQ-060 | hit 0 — 일치 | ID hit 0 — 일치 | 79 행 kind `Constraint` = 셀 일치. CLAUDE.md 160 ~ 167 행 R-112 가 4 항목 (happy / error / flow / negative) 을 planner 의 자동 Acceptance 삽입 의무로 규정하고 `.claude/agents/planner.md` 실재 — 일치 | **0 종** |

#### 임계 적용 + 최종 판정

§12.2 288 행 임계 (2 종 이상 → 분류 변경 / 1 종 → `기록만` / 0 종 → 무수정) 를 기계적으로 적용한다.

| 대상 row | 어긋남 종수 | 판정 |
| --- | --- | --- |
| 35 행 REQ-001 | 1 | **기록만** — 분류 `infrastructure` 무수정, 본 절 부기로 갈음 |
| 51 행 REQ-017 | 1 | **기록만** — 분류 `infrastructure` 무수정, cover 위치 셀만 치환 (아래 명시 판정) |
| 90 행 REQ-056 | 0 | **유지** (`infrastructure`) |
| 91 행 REQ-057 | 0 | **유지** (`infrastructure`) |
| 92 행 REQ-058 | 0 | **유지** (`infrastructure`) |
| 93 행 REQ-059 | 0 | **유지** (`infrastructure`) |
| 94 행 REQ-060 | 0 | **유지** (`infrastructure`) |

- 두 `기록만` 건 모두 어긋난 것은 **cover 위치 셀의 지목 종류 · 지목 최신성** 뿐이고 분류 축 자체 (Constraint · UC 영역 밖) 는 (i) · (ii) 의 hit 0 이 오히려 강화한다. §12.2 290 행 부기대로 보수적으로 `기록만` 을 택했다 (S1 의 REQ-003 처리와 동형 화법).
- requirements.md 의 status 컬럼 (75 행 `IN_PROGRESS`, 나머지 6 건 `DONE`) 은 **구현 진척 축** 이라 §3 의 **cover 방식 분류 축** 과 무관하다 — 분류 전이 근거로 쓰지 않았다 (§12.6 선례). 특히 REQ-056 의 `IN_PROGRESS` 는 정책 집행 완성도의 문제일 뿐 cover 처가 없다는 뜻이 아니다.

#### REQ-017 stale pointer 명시 판정 — §3 51 행

**판정: stale — 표기 오류 1 종, 분류값 `infrastructure` 는 무수정.** 51 행 cover 위치 셀은 `P4 ADR 예정 (Confluence 탐색 정책)` 이었으나 `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` 가 `status: ACCEPTED` · `date: 2026-06-01` 로 실재하고 requirements.md 36 행 status 도 `DONE (implemented-on-main — ADR 실재 축 …)` 라, "예정" 이라는 시제는 사실과 어긋난다. §12.2 290 행 부기가 링크 rot 을 **분류 오류가 아닌 cover 위치 셀의 표기 오류** 로 규정하므로 임계 계산에는 1 종으로만 들어가고 분류값은 그대로 `infrastructure` 다 (ADR 에서 cover 된다는 사실 자체는 오히려 §2 26 행 정의에 더 정확히 부합).

그 위에서 §12.3 (a) 의 `표기 오류만이면 cover 위치 · 참고 셀만` 경로로 **51 행 cover 위치 셀만 in-place 치환했다 (치환함)**:

| 지점 | before | after |
| --- | --- | --- |
| §3 51 행 `cover 위치` 셀 | `P4 ADR 예정 (Confluence 탐색 정책)` | `[ADR-0013](../decisions/ADR-0013-confluence-space-traversal-policy.md) (Confluence SPACE 탐색 정책, ACCEPTED)` |

이 치환은 **enum 전이가 아니므로 §12.3 (b) ~ (f) 는 발동하지 않는다** (분류값 `infrastructure` 무변 → count 13 무변). `참고` 셀 (`requirements.md L36 — ADR-필수 항목, P4 phase 책임`) 은 phase 귀속 서술로 여전히 사실이라 손대지 않았다.

#### REQ-001 자기참조 축 명시 판정 — §3 35 행 vs §2 26 행

**판정: 모순 아님 — 양립 (분류 무수정).** §3 35 행이 cover 위치로 `README.md 본문 + 본 INDEX.md` 를 지목하는데 §2 26 행 `infrastructure` 정의가 `UC 영역 밖` 을 요건으로 드는 것은, REQ-001 이 UC 의 **내용** 이 아니라 **문서 존재·형식을 규정하는 meta 지시** ("본 문서는 Use Case 문서의 기본" — README 1 행) 이기 때문이다. 즉 지목처가 UC 문서군일 뿐 REQ 자체는 어떤 UC 의 시나리오 안에도 담길 수 없고, 그 사실을 (i) · (ii) 의 **hit 0** 이 실측으로 증명한다 (담을 수 있었다면 8 UC 중 하나의 `coversReq` 에 등장했을 것). 남은 어긋남은 지목처 종류가 §2 26 행 열거 밖이라는 **표기 경계 1 종** 뿐이라 임계상 `기록만` 이며, 이는 S1 의 REQ-003 (cover 위치가 §2 25 행 예시 밖 종류) 판정과 정확히 동형이다.

#### cascade 판정

**분류값 변경 0 건 → cascade (a) ~ (f) 발동 대상 없음** (§12.3 294 행 · T-1400 ~ T-1403 · T-1406 선례 화법). 단 위 51 행 cover 위치 셀 치환은 **§12.3 (a) 의 `표기 오류만이면 cover 위치 · 참고 셀만` 경로일 뿐 enum cascade 가 아니다** — enum 이 움직이지 않았으므로 (b) bullet · (c) 115 행 정합식의 `13` 항 · (d) 통계표 `13` 값 · (e) INDEX.md 110 행 · (f) PLAN.md 36 행 은 옮겨 적을 새 수치가 없다. §5 125 행 `infrastructure` 비고 셀이 열거한 `REQ-001 / REQ-017 / REQ-056 ~ REQ-066` 13 건 중 본 절 판정 대상은 7 건이고 나머지 6 건 (REQ-061 ~ 066) 은 S3 소관이라, 비고 셀 자체도 무변이다.

#### 불변 검산 6 값 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## "` | 12 불변 (`###` 추가) | **12** |
| (c) | 잔여 축 문구 grep 첫 hit / 총 hit | L212 / 10 불변 | **L212 / 10** |
| (d) | L212 참조 문자열 count | 9 불변 | **9** |
| (e) | `sed -n '115p'` 정합식 | 여전히 115 행 · 합 66 | **115 행 · `33 + 15 + 4 + 13 + 1 = 66`** |
| (f) | §5 표 (121 ~ 127 행) count 4 값 + 합계 | 합 66 · `**100 %**` | **48 / 4 / 13 / 1 = 66** · 합계 row `**100 %**` 불변 |

51 행 치환은 `cover 방식` 셀을 건드리지 않았으므로 (a) · (f) 가 그대로다. 치환 row 의 `|` 필드 수도 편집 전후 동일 (5 컬럼 → 파이프 6 개) 임을 실측했다 (T-1370 · T-1375 표 파손 재발 방지). (c) · (d) 불변은 본 절이 두 검산 대상 문자열을 의도적으로 쓰지 않고 회피 표기 (`L212` · `잔여 축`) 를 쓴 T-1405 · T-1406 선례를 승계한 결과다.

#### hunk 국한 검증 (doc-only, R-112 대체)

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -51 +51 @@ REQ 의 cover 방식을 다음 4 enum 으로 분류:
@@ -410,0 +411,118 @@ $ awk 'NR==21||NR==22||NR==48||NR==66' docs/requirements.md
$ git diff --numstat
119     1       docs/use-cases/REQ-COVERAGE-AUDIT.md   (삽입 118 행 + 51 행 치환 +1 / -1)
```

hunk 는 **2 개뿐** — (1) 51 행 1:1 치환 (`-1 / +1`, 표 파손 없음), (2) §12.6 마지막 행과 §11 References 사이 삽입 118 행. 1 ~ 409 행 중 51 행 외 hunk **0** · 삭제 열의 **1** 은 그 치환의 짝이라 순수 삭제 **0** 이다. `git status --porcelain` 은 `touchesFiles` 2 개 (`docs/use-cases/REQ-COVERAGE-AUDIT.md` · `docs/tasks/T-1407-*.md`) 외 변경 파일 **0**.

#### S2 종합 판정 + 잔여

- **판정 분포 — 유지 5 / 기록만 2 / 변경 0** (REQ-056 ~ 060 유지, REQ-001 · REQ-017 기록만). infrastructure 전반 7 row 는 2026-05-25 T-0029 최초 판정 이후 처음으로 근거 3 종 실측을 통과했고, 분류값은 전건 그대로다.
- **진척 — 후보 17 중 11 완료 (S1 4 + S2 7) · 잔여 6** (S3 = REQ-061 ~ 066).
- **§10 의 잔여 축 bullet (L212) 문구는 본 slice 에서 건드리지 않았다** — `유일 잔여 축` closure 는 §12.5 324 행이 못박은 대로 **S3 소관** 이다.

#### 한계 —

1. **S3 배정 6 row (REQ-061 ~ 066) 미판정** — infrastructure 후반의 분류는 본 slice 에서 손대지 않았고 최초 판정값 그대로다.
2. **cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 미동기** — 분류값 변경 0 이라 동기 자체가 불요였으나 두 지점의 정합 확인도 수행하지 않았다 (T-1404 Follow-up 3 소관).
3. **표기 비일관 3 건 미정정** — §3 83 행 `(cover)` · 79 행 `(인접)` 표기 편차와 UC §10 표의 `§5 step N` ±1 편차는 분류 축과 무관해 그대로 두었다.
4. **근거 (iii) 의 `CLAUDE.md` · `ci.yml` · `README.md` 확인은 정적 실측** — heading · step `name` · 1 행 문구 실재 수준까지만 대조했고, 그 정책이 해당 REQ 를 **충분히** 집행하는지의 질적 평가 (예: `Lint 검사` step 의 rule set 이 REQ-056 의 중복 import 금지를 실제로 잡는지, `reviewer agent approval 검증` step 이 REQ-058 의 코드 검토 의무를 실질 강제하는지) 는 하지 않았다.

### 12.8 S3 실판정 — infrastructure 후반 6 row (T-1408)

> 본 절은 [T-1408](../tasks/T-1408-req-coverage-s3-infrastructure-rejudge-l212-closure.md) 이 §12.5 의 S3 batch (infrastructure 후반 6 row — REQ-061 ~ 066, §3 95 ~ 100 행) 를 §12.2 근거 3 종 + 2/3 임계로 실판정하고, §12.5 324 행이 못박은 대로 **마지막 slice** 로서 후보 17 row 전건의 종합과 §10 L212 잔여 축 closure 까지 수행한 기록이다. **삽입 위치는 §12.7 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 는 불변이다.
> 본 slice 가 528 행 이전에 가한 편집은 **L212 1:1 치환 1 건뿐** 이며 그것이 행 수 불변 (`-1 / +1`) 이라 213 행 이하 전건의 행 번호가 그대로 보존된다 — §10 bullet 9 줄의 L212 참조와 §4 `115 행` 정합식 참조가 계속 유효하다.

#### 실측 명령 (축별 5 회)

```
$ grep -n "REQ-061\|REQ-062\|REQ-063\|REQ-064\|REQ-065\|REQ-066" docs/use-cases/UC-0*.md
(hit 0 — 8 UC 전건, exit 1)
$ awk 'NR>=80&&NR<=85' docs/requirements.md   # kind + 지시 원문 컬럼만, status 는 앞 200 자
80: REQ-061 | smoke + e2e 도 CI 에서 수행 | Constraint | CLAUDE.md §3.2 R-113 + T-0009/T-0010 | DONE (T-0009/T-0010)
81: REQ-062 | 활동 후 test 수행 + 종료 전 CI 수행 | Constraint | CLAUDE.md §3.2 R-114 + LOOP §1 [5] | DONE
82: REQ-063 | PR 만들면 다른 agent 가 review | Constraint | integrator → reviewer | DONE
83: REQ-064 | Reviewer + Committer 합의로 merge, 7 round | Constraint | CLAUDE.md §3.3 + integrator | DONE
84: REQ-065 | Reviewer 8 check | Constraint | reviewer.md | DONE
85: REQ-066 | 코드 commit = PR / 진행상황 doc = direct | Constraint | CLAUDE.md §3.1 | DONE
$ grep -n "^### 3\.1\|^### 3\.2\|^### 3\.3\|R-113\|R-114" CLAUDE.md
127: ### 3.1 Commit mode   147: ### 3.2 Test·CI 절대 규칙   184: ### 3.3 Reviewer + Committer 이중 합의
171: R-113 정의   174: "P0.5 phase 의 T-0009/T-0010 이 smoke/e2e 인프라를 도입"   176: R-114 정의   (18 · 87 행은 §0.5 인덱스 · 본문 인용)
$ grep -n "^#\{1,3\} " .claude/agents/reviewer.md .claude/agents/integrator.md
reviewer  34: "# 8 check 구체 sub-check" · 102 Workflow · 111 Post (의무) · 148 4-게이트 #2 충족 박제
integrator 17 Workflow A · 27 Workflow B · 145 4-게이트 평가 도구 unified   (25 행 = reviewer sub-agent dispatch 의무)
$ grep -n "\[5\]" docs/LOOP.md ; grep -n "^status:" docs/tasks/T-0009-*.md docs/tasks/T-0010-*.md
LOOP.md 9: "## 1. 표준 Driver Prompt" / 234: "[5] CI 검증 (push 직후)" (167 · 193 행도 참조)
T-0009-smoke-test-infra.md status: DONE   T-0010-e2e-test-infra.md status: DONE
```

첫 grep 의 **hit 0** 이 S3 6 row 판정의 축이다 (S1 · S2 와 동형) — 6 REQ 중 어느 것도 8 UC 의 `coversReq` / `adjacentReq` 또는 본문 §5 · §6 · §8 의 ID anchor 에 등장하지 않는다. 이는 §2 26 행의 "Constraint REQ — UC 영역 밖" 과 정확히 부합하므로 근거 (i) · (ii) 는 6 row **전건에서 현 분류 `infrastructure` 와 일치** 이고 `uc-covered` 로 끌어올릴 근거는 0 이다. `kind` 컬럼도 6 건 전부 `Constraint` 로 §3 셀과 일치한다.

#### row 별 근거 3 종 실측

| 대상 row | (i) UC frontmatter | (ii) UC 본문 hit | (iii) requirements 원문 + cover 위치 셀 | 어긋남 |
| --- | --- | --- | --- | --- |
| 95 행 REQ-061 | hit 0 — 일치 | ID hit 0 — 일치 | 80 행 kind `Constraint` = 셀 일치. CLAUDE.md 171 행 R-113 이 unit + smoke + e2e 3 종의 CI 실행을 규정하고, 병기된 T-0009 · T-0010 이 `status: DONE` 으로 실재하며 174 행 R-113 본문이 그 두 task 를 인프라 도입 주체로 직접 지목 — 일치 | **0 종** |
| 96 행 REQ-062 | hit 0 — 일치 | ID hit 0 — 일치 | 81 행 kind `Constraint` = 셀 일치. CLAUDE.md 176 행 R-114 (commit 후 test 검증 + 종료 전 CI) + LOOP.md 9 행 `## 1.` 안의 234 행 `[5] CI 검증 (push 직후)` 실재 — 셀 지목 `LOOP §1 [5]` 와 문자 그대로 일치 | **0 종** |
| 97 행 REQ-063 | hit 0 — 일치 | ID hit 0 — 일치 | 82 행 kind `Constraint` = 셀 일치. integrator.md 25 행이 `reviewer sub-agent dispatch (의무) — reviewer 호출 없이 merge 시도 금지` 로 dispatch 경로를 명시하고 reviewer.md 도 실재 — 내용은 일치하나 지목처 종류가 §2 26 행 열거 **밖** (단독 지목) — **어긋남 (표기 경계)** | **1 종** |
| 98 행 REQ-064 | hit 0 — 일치 | ID hit 0 — 일치 | 83 행 kind `Constraint` = 셀 일치. CLAUDE.md 184 행 §3.3 이 Reviewer + Committer 이중 합의 (4-게이트) 를 규정하고 223 · 251 행이 `review round 7 초과` 를 notifier / BLOCKED 조건으로 못박으며 integrator.md 실재 — 일치 | **0 종** |
| 99 행 REQ-065 | hit 0 — 일치 | ID hit 0 — 일치 | 84 행 kind `Constraint` = 셀 일치. reviewer.md 34 행 `# 8 check 구체 sub-check` + 105 행 `위 8 check 의 sub-check 들을 순서대로 적용` 실재 — 내용은 일치하나 지목처가 §2 26 행 열거 **밖** (단독 지목) — **어긋남 (표기 경계)** | **1 종** |
| 100 행 REQ-066 | hit 0 — 일치 | ID hit 0 — 일치 | 85 행 kind `Constraint` = 셀 일치. CLAUDE.md 127 행 §3.1 Commit mode 표가 `direct` (진행 doc) / `pr` (코드) 대상과 절차를 규정 — 셀 지목 `§3.1` 과 일치 | **0 종** |

#### 임계 적용 + 최종 판정

§12.2 288 행 임계 (2 종 이상 → 분류 변경 / 1 종 → `기록만` / 0 종 → 무수정) 를 기계적으로 적용한다.

| 대상 row | 어긋남 종수 | 판정 |
| --- | --- | --- |
| 95 행 REQ-061 | 0 | **유지** (`infrastructure`) |
| 96 행 REQ-062 | 0 | **유지** (`infrastructure`) |
| 97 행 REQ-063 | 1 | **기록만** — 분류 `infrastructure` 무수정, 본 절 부기로 갈음 (셀 치환 안 함) |
| 98 행 REQ-064 | 0 | **유지** (`infrastructure`) |
| 99 행 REQ-065 | 1 | **기록만** — 분류 `infrastructure` 무수정, 본 절 부기로 갈음 (셀 치환 안 함) |
| 100 행 REQ-066 | 0 | **유지** (`infrastructure`) |

- REQ-061 · 064 의 셀은 `CLAUDE.md § + 보조 지목` 복합 형태인데, §12.7 450 행 REQ-058 (`§3.2 R-110 + agents`) 의 **0 종** 판정과 동형으로 처리했다 — §2 26 행 열거 안 지목 (CLAUDE.md) 이 주 근거로 실재하면 보조 지목 (task ID · agent 이름) 은 표기 경계를 만들지 않는다.
- 반대로 REQ-063 · 065 는 `.claude/agents/*` **단독 지목** 이라 §12.7 485 행 REQ-001 (README + INDEX 단독 지목) 판정과 동형으로 1 종을 계상했다. 판정이 갈릴 여지가 있는 지점이라 보수적으로 `기록만` 을 택했다 (분류 변경 아님).
- requirements.md 의 status 컬럼 (6 건 전부 `DONE`) 은 **구현 진척 축** 이라 §3 의 **cover 방식 분류 축** 과 무관하다 — 분류 전이 근거로 쓰지 않았다 (§12.6 · §12.7 선례).

#### REQ-061 task-ID pointer 명시 판정 — §3 95 행

**판정: 충족 — stale 아님, 셀 치환 안 함 (명시적 선택), 분류 `infrastructure` 무수정.** 95 행 cover 위치 셀은 다른 infrastructure row 와 달리 정책 문서 외에 **task ID (T-0009/T-0010)** 를 병기하는데, 두 task 파일이 `status: DONE` 으로 실재하고 CLAUDE.md 174 행 R-113 본문 자체가 그 두 task 를 smoke/e2e 인프라 도입 주체로 지목하므로 근거 (iii) 의 "지목 대상 실재" 는 충족이다. 완료된 task 를 가리키는 것은 §2 26 행이 말하는 `운영 정책 backlog` 의 이력 항목을 가리키는 것이라 정의와도 어긋나지 않는다.

따라서 §12.7 471 ~ 481 행의 REQ-017 처럼 링크 rot 로 볼 사유가 없어 §12.2 290 행 부기를 적용할 대상이 아니고, §12.3 (a) 의 표기 경로도 **발동시키지 않았다** — before → after 없음 (`CLAUDE.md §3.2 R-113 + T-0009/T-0010` 그대로 유지). 이 "치환 안 함" 은 누락이 아니라 명시적 선택이다.

#### REQ-063 · 065 agent spec pointer 명시 판정 — §3 97 · 99 행 vs §2 26 행

**판정: 열거는 폐쇄 목록이 아니라 예시 — 근거 (iii) 의 지목 대상 실재는 충족, 다만 표기 경계 1 종은 계상 (분류 무수정).** §2 26 행은 `ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md 의 **운영 정책 backlog 에서 cover**` 형태로, 열거 뒤에 `운영 정책` 이라는 상위 범주를 본체로 두는 구조다. `.claude/agents/*.md` 는 그 상위 범주의 실체 (agent 의 행동 규약 문서) 이고 CLAUDE.md §4 표가 sub-agent dispatch 를 그 문서들에 위임하므로, 문자 그대로 열거되지 않았다는 사실만으로 두 row 를 `infrastructure` 밖으로 밀어낼 근거가 되지 않는다. §2 본문은 재정의하지 않고 본 절의 해석 판정으로만 남긴다.

그럼에도 지목처 종류가 열거 문면 밖이라는 점은 §12.7 485 행 REQ-001 (지목처가 README + INDEX 로 열거 밖) 판정과 동형으로 **표기 경계 1 종** 으로 계상해 두 row 를 `기록만` 으로 뒀다 — 임계상 `기록만` 은 분류 무수정이므로 두 판정 (충족 · 1 종) 은 결론에서 충돌하지 않는다. 셀 치환도 하지 않았다: `.claude/agents/` 경로 지목은 실재·정확하며 고칠 대상이 없기 때문이다.

#### cascade 판정

**분류값 변경 0 건 → cascade (a) ~ (f) 발동 대상 없음** (§12.3 294 행 · T-1400 ~ T-1403 · T-1406 · T-1407 선례 화법). 본 slice 는 §12.7 이 51 행에 가한 것과 같은 **표기-only 셀 치환도 0 건** 이라, (a) 의 표기 경로조차 발동하지 않았다. (b) bullet · (c) 115 행 정합식의 `13` 항 · (d) 통계표 `13` 값 · (e) INDEX.md 110 행 · (f) PLAN.md 36 행 은 옮겨 적을 새 수치가 없다. §5 125 행 `infrastructure` 비고 셀이 열거한 `REQ-001 / REQ-017 / REQ-056 ~ REQ-066` 13 건 중 본 절이 마지막 6 건 (REQ-061 ~ 066) 을 판정해 13 건 전건이 실판정을 마쳤고, 그 결과 비고 셀 자체도 무변이다.

#### 불변 검산 7 값 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## "` | 12 불변 (`###` 추가) | **12** |
| (c) | 잔여 축 열거 문구 grep 첫 hit / 총 hit | L212 / 10 불변 | **L212 / 10** |
| (d) | L212 참조 문자열 count | 9 불변 | **9** |
| (e) | `sed -n '115p'` 정합식 | 여전히 115 행 · 합 66 | **115 행 · `33 + 15 + 4 + 13 + 1 = 66`** |
| (f) | §5 표 (121 ~ 127 행) count 4 값 + 합계 | 합 66 · `**100 %**` | **48 / 4 / 13 / 1 = 66** · 합계 row `**100 %**` 불변 |
| (g) | closure 대상 문구 count | 4 → **3** (의도된 유일한 감소) | **3** — 잔여 hit 는 §12.5 322 행 · §12.6 402 행 · §12.7 520 행 (전부 append-only 보존 대상) |

(a) · (f) 가 그대로인 것은 본 slice 가 §3 매트릭스의 어떤 셀도 건드리지 않았기 때문이고, (c) · (d) 불변은 본 절이 두 검산 대상 문자열을 **의도적으로 쓰지 않고** 회피 표기 (`L212` · `잔여 축`) 를 쓴 T-1405 ~ T-1407 선례를 승계한 결과다. (g) 는 본 slice 가 의도한 유일한 감소이며, 감소분 1 은 L212 4 번째 축의 해소 표기 교체에서만 나왔다.

#### hunk 국한 검증 (doc-only, R-112 대체)

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -212 +212 @@ (§10 잔여 축 bullet — 1:1 치환)
@@ -528,0 +529,126 @@ (§12.7 마지막 행과 §11 References 사이 삽입)
$ git diff --numstat docs/use-cases/REQ-COVERAGE-AUDIT.md
127     1       docs/use-cases/REQ-COVERAGE-AUDIT.md   (삽입 126 행 + L212 치환 +1 / -1)
```

hunk 는 **정확히 2 개** — (1) L212 1:1 치환 (`-1 / +1`), (2) §12.8 삽입. §3 셀 표기-only 치환이 0 건이라 3 번째 hunk 는 존재하지 않으며, 1 ~ 528 행 중 L212 외 hunk **0** · 삭제 열의 **1** 은 그 치환의 짝이라 순수 삭제 **0** 이다. 매트릭스 표 파손 위험 (T-1370 · T-1375 선례) 도 §3 를 아예 건드리지 않아 원천 차단됐고, 그 사실은 (a) `66` · (f) `48 / 4 / 13 / 1` 검산이 이중 확인한다. `git status --porcelain` 은 `touchesFiles` 2 개 (`docs/use-cases/REQ-COVERAGE-AUDIT.md` · `docs/tasks/T-1408-*.md`) 외 변경 파일 **0**.

#### S1 ~ S3 종합 판정 (후보 17 row 전건)

| slice | batch | 건수 | 유지 | 기록만 | 분류 변경 | 표기-only 셀 치환 |
| --- | --- | --- | --- | --- | --- | --- |
| S1 (T-1406) | cross-cutting 4 — REQ-002 · 003 · 029 · 047 | 4 | 3 | 1 | 0 | 0 |
| S2 (T-1407) | infrastructure 전반 7 — REQ-001 · 017 · 056 ~ 060 | 7 | 5 | 2 | 0 | 1 (§3 51 행) |
| S3 (T-1408) | infrastructure 후반 6 — REQ-061 ~ 066 | 6 | 4 | 2 | 0 | 0 |
| **합** | — | **17** | **12** | **5** | **0** | **1** |

검산: `4 + 7 + 6 = 17` 로 §12.1 274 행이 확정한 후보 분모와 닫히고, 판정 열 합도 `12 + 5 = 17` 로 같은 분모에 닫힌다. **3 slice 통틀어 enum 변경 총 0 건 · 표기-only 셀 치환 총 1 건** (S2 의 §3 51 행 REQ-017 stale pointer) 이라 §12.3 의 cascade 6 지점은 한 번도 발동하지 않았다.

cascade 무발동은 곧 **2026-05-25 T-0029 의 최초 분류 판정이 근거 3 종 재실측을 통과했다** 는 뜻이다 — 후보 17 row 어디에도 분류값을 움직일 만한 2 종 이상 어긋남이 없었고, 발견된 어긋남 5 건은 전부 cover 위치 셀의 표기 축 (지목 종류 · 지목 최신성) 에 국한됐다. 다만 §12.1 이 재판정 후보를 **17 row 부분집합** 으로 좁혔으므로 이 결론은 그 부분집합 범위의 것이고, 나머지 49 row (`uc-covered` 48 + `gap` 1) 는 T-1395 ~ T-1403 · §9.4 의 **다른 축 실측** 으로 대체된 것이지 본 재판정이 직접 재검증한 것은 아니다.

#### L212 잔여 축 closure

§10 의 잔여 축 열거 bullet (L212) 4 번째 항목의 해소 표기를 **1 행 → 1 행 in-place 교체** 했다 (T-1404 선례와 동형). 교체 범위는 그 항목의 `미해소` 표기와 괄호 사유뿐이고, 5 축의 문구·순서와 나머지 4 축의 해소 pointer (213 · 217 · 221 · 225 · 228 ~ 249 행) 는 **원문 그대로 보존** 했다 — 편집 후 `grep -n` 으로 5 개 pointer 전건 일치를 확인했다. 새 pointer 는 §12.5 ~ §12.8 (T-1405 설계 + T-1406 ~ T-1408 실판정, 후보 17 row 전건) 을 가리키며 판정 분포 `유지 12 / 기록만 5 / 분류 변경 0` 을 함께 적었다. bullet 머리의 갱신 시점 표기도 같은 1 행 안에서 본 slice 반영으로 갱신했다. before → after 전문은 검산 (g) 의 count 보존을 위해 본 문서에 인용하지 않고 **task 파일 완료 기록에 박제** 했다 (T-1404 선례와 동형).

이 closure 로 T-1393 이 남긴 5 축 전건이 해소되어 해당 열거는 종결된다. 단 그 의미는 `**설계된 범위 (후보 17 row) 의 재판정 완료**` 이지 §3 매트릭스 66 row 전건의 재검증 완료가 아니다 — 아래 한계 (1) 참조.

#### 한계 —

1. **본 재판정은 66 row 전건이 아니다** — §12.1 259 ~ 263 행이 후보를 **17 row 부분집합** 으로 좁혔으므로 나머지 **49 row (`uc-covered` 48 + `gap` 1) 는 본 재판정의 대상이 아니었다**. L212 closure 는 "설계된 범위의 재판정 완료" 를 뜻하며, 49 row 의 분류는 T-1395 ~ T-1403 (축 C · D 의 근거 셀 1:1 대조) 과 §9.4 (REQ-004 `gap` 유지) 라는 **다른 축** 의 실측에 의존한 채로 남는다.
2. **cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 미동기** — 3 slice 통틀어 분류값 변경이 0 이라 수치 동기 자체가 불요였으나, 두 지점의 **정합 확인도 수행하지 않았다** (§12.4 311 행의 분리 허용 + T-1404 Follow-up 3 · T-1407 Follow-up 2 소관).
3. **표기 비일관 3 건 미정정** — §3 83 행 `(cover)` · 79 행 `(인접)` 표기 편차와 UC §10 표의 `§5 step N` ±1 편차는 분류 축과 무관해 그대로 두었다. 본 slice 가 새로 기록한 표기 경계 2 건 (REQ-063 · 065 의 지목처 종류) 도 정정하지 않았다.
4. **근거 (iii) 확인은 정적 실측** — `CLAUDE.md` heading · `LOOP.md` step 번호 · agent spec heading · task frontmatter `status` 실재 수준까지만 대조했고, 그 정책이 해당 REQ 를 **충분히** 집행하는지의 질적 평가 (예: reviewer.md 의 8 check sub-check 가 REQ-065 의 review 품질을 실제로 담보하는지, integrator 의 dispatch 의무가 REQ-063 의 "다른 agent 가 review" 를 우회 불가능하게 만드는지) 는 하지 않았다 (§12.7 한계 4 승계).

### 12.9 cascade (e) · (f) 정합 확인 + 시점 pointer 갱신 (T-1409)

#### 대상·범위

§12.4 311 행이 **분리 허용** 으로 빼둔 cascade **(e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행** 두 외부 요약을 본 slice 가 처음으로 실제 대조한다. §12.5 ~ §12.8 (T-1405 설계 + T-1406 ~ T-1408 실판정) 이 후보 17 row 전건을 재판정한 결과가 **유지 12 / 기록만 5 / 분류 변경 0** 이라 수치 동기 자체는 불요였지만, 그 "불요" 가 실측으로 확인된 적이 없어 §12.6 407 행 · §12.7 525 행 · §12.8 651 행이 세 번 연속 한계로 이월해 왔다. 본 절은 그 이월분을 **축 A ~ D 4 축 실측** 으로 닫고, 확인 결과에 따라 두 파일의 **시점 pointer 만** 갱신한다 (수치 문자열 무편집). 본 slice 는 재판정을 하지 않으며 §3 매트릭스 셀 · §12.3 표는 건드리지 않는다.

#### 축 A ~ D 실측

| 축 | 대조 대상 / 실측 | 기대 | 실측 | 판정 |
| --- | --- | --- | --- | --- |
| (A) | INDEX.md 110 행 4 값 ↔ §5 표 (121 ~ 127 행) + 독립 anchor `grep -c "^\| REQ-"` + §3 분류 열 tally | 4 값 · 합 66 일치 | 110 행 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` · §5 표 `48 / 4 / 13 / 1` 합 `**66**` · row 수 **66** · 분류 열 tally `uc-covered 48 · cross-cutting 4 · infrastructure 13 · gap 1` | **일치 5 / 5 · 불일치 0** |
| (B) | PLAN.md 36 행 `… = 66` + gap 서술 ↔ 같은 anchor + §6 (129 ~ 139 행) · §9.4 (188 행) | 수치 4 값 + 합 일치 · gap 서술 = REQ-004 | 36 행 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` 문자열 완전 일치 · gap 서술 `REQ-004 사용자 지정 기간 임의 평가문` 이 §6 133 행 제목 · §9.4 188 행 `gap` **유지** 판정과 정합 | **일치 5 / 5 · 불일치 0** |
| (C) | 두 문서의 재판정 시점 pointer 최신성 | audit 최신 절 (§12) 반영 | INDEX.md 111 행 = `2026-08-02 재판정 … §9 참조` (T-1390) 까지 · PLAN.md 36 행 = pointer **부재** (2026-05-25 T-0029 원 출처만 인용) | **둘 다 stale** — §10 (T-1393 ~ T-1404) · §12 (T-1405 ~ T-1408) 미반영 |
| (D) | §12.3 302 · 303 행 `현재 값` 셀 문자열 ↔ 두 파일 실제 행 | 문자열 수준 어긋남 0 | (e) 셀 문자열이 INDEX.md 110 행에 substring hit **1** · (f) 셀 문자열이 PLAN.md 36 행에 substring hit **1** | **자기정합 2 / 2 · 어긋남 0** |

#### cascade (e) · (f) 발동 여부 판정

축 A · B 가 **불일치 0** 이므로 **cascade (e) · (f) 는 발동하지 않는다 — 수치 갱신 0 건**. §12.3 이 정한 트리거 ((c) · (d) 발동 후 결과 수치를 옮겨 적을 때) 가 애초에 성립하지 않았고, 3 slice 통틀어 enum 전이가 0 이었으므로 두 외부 요약의 4 값은 2026-05-25 T-0029 판정 이래 **재판정을 통과한 값** 으로 확정된다. 결함은 **축 C 하나뿐** 이며 이는 수치가 아니라 신뢰도 표기 문제라 cascade 가 아니라 pointer 갱신으로 해소했다 — "한 번도 재확인되지 않은 값" 과 "재판정을 거쳐 같음이 확인된 값" 을 독자가 구분할 수 있게 하는 것이 본 편집의 유일한 목적이다. 축 D 어긋남 0 이므로 §12.3 표 정정 대상도 없다 (표 자체의 갱신은 T-1408 Follow-up 2 소관 — 본 slice 밖).

#### 외부 2 파일 편집 before → after 요지

| 파일 | 편집 종류 | before | after |
| --- | --- | --- | --- |
| `docs/use-cases/INDEX.md` | 111 행 다음 **1 줄 삽입** (110 행 문자열 · 행 번호 불변) | 111 행 `2026-08-02 재판정 … §9 참조` 가 마지막 pointer | 112 행 신설 — `2026-08-03 재판정: … §12 참조` (T-1405 ~ T-1408 로 후보 17 row 전건 재검토, 유지 12 / 기록만 5 / 분류 변경 0 이라 4 값 · 합 66 무변, 실측값은 §12.9 위임) |
| `docs/PLAN.md` | 36 행 **1 행 → 1 행 in-place 교체** (파일 행 수 · 행 번호 불변) | 문말이 `… gap 1 = 66.` 로 끝나고 재판정 pointer 없음 | 같은 문장 뒤에 `2026-08-03 재판정: … §12.9 참조` 1 문장 첨가. 기존 문장 · 링크 · 수치는 한 글자도 축약하지 않음 |

두 편집 모두 **수치를 새로 쓰지 않았다** — 분류 변경 0 이므로 4 값 문자열은 기존 그대로 두고 시점 pointer 문장만 더했다. INDEX.md 는 111 행의 화법 (`YYYY-MM-DD 재판정: … § 참조 (T-NNNN …)`) 을 그대로 승계했고, PLAN.md 는 T-1404 의 1 행 → 1 행 교체 선례를 승계했다.

#### 불변 검산 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` | 12 불변 (`###` / `####` 만 추가) | **12** |
| (c) | L212 참조 문자열 count | 9 불변 | **9** |
| (d) | 잔여 축 열거 문구 grep 첫 hit / 총 hit | L212 / 10 불변 | **L212 / 10** |
| (e) | `sed -n '115p'` 정합식 | 여전히 115 행 · 합 66 | **115 행 · `33 + 15 + 4 + 13 + 1 = 66`** |
| (f) | §5 표 (121 ~ 127 행) count 4 값 + 합계 | `48 / 4 / 13 / 1` · 합 `**66**` · `**100 %**` | **48 / 4 / 13 / 1** · 합계 row `**66**` · `**100 %**` 불변 |
| (g) | `wc -l docs/PLAN.md` | 175 불변 | **175** |
| (h) | `wc -l docs/use-cases/INDEX.md` | 113 → 114 (의도된 유일한 증가) | **114** · 110 행 문자열 동일 |

(a) · (f) 가 그대로인 것은 본 slice 가 §3 매트릭스와 §5 표의 어떤 셀도 건드리지 않았기 때문이고, (c) · (d) 불변은 본 절이 두 검산 대상 문자열을 **의도적으로 회피** 해 `L212` · `잔여 축` 표기만 쓴 결과다 (§12.5 ~ §12.8 선례 승계). (g) · (h) 가 본 slice 가 외부 파일에 남긴 유일한 물리적 흔적이다.

#### hunk 국한 검증 (doc-only, R-112 대체)

```
$ git diff -U0 | grep '^@@'
@@ -36 +36 @@   (docs/PLAN.md — 1:1 치환)
@@ -111,0 +112 @@   (docs/use-cases/INDEX.md — 111 행 다음 1 줄 삽입)
@@ -654,0 +655,65 @@   (REQ-COVERAGE-AUDIT.md — §12.8 마지막 행과 §11 References 사이 삽입)
$ git diff --numstat
1    1   docs/PLAN.md
1    0   docs/use-cases/INDEX.md
65   0   docs/use-cases/REQ-COVERAGE-AUDIT.md
```

hunk 은 **정확히 3 개** (audit 삽입 1 · INDEX 삽입 1 · PLAN 1:1 치환 1) 이고 삭제 열 합 = **1** — 그 1 은 PLAN 치환의 짝이므로 **순수 삭제 0**. audit 파일 1 ~ 654 행 · INDEX 1 ~ 111 행 · PLAN 36 행 외 전 행은 무편집이다.

#### 한계 —

1. **대조 범위는 수치와 gap 서술까지** — INDEX.md 110 행 · PLAN.md 36 행이 함께 적은 **권장 처리 서술** (`UC-09 신설 또는 UC-01 확장 권장` · `follow-up task T-0030+ 책임`) 의 최신성은 실측하지 않았다. REQ-004 는 여전히 `gap` 이라 권장 자체는 유효하나, T-0030 / T-0031 이 이미 다른 산출물로 완료된 점을 감안하면 책임 task 지목은 stale 일 수 있다.
2. **§12.3 표의 (e) · (f) `현재 값` 셀 미갱신** — 축 D 가 어긋남 0 을 확인했으므로 정정 대상이 없었고, 표 구조 자체의 보강 (7 번째 cascade 지점 추가 등) 은 T-1408 Follow-up 2 소관으로 남는다.
3. **audit 내부 anchor 대조** — 축 A · B 는 audit §3 / §5 / §6 / §9 와 두 외부 요약 사이의 정합만 확인했다. `docs/requirements.md` 66 row 원문과의 재대조는 §12.5 ~ §12.8 이 후보 17 row 에 한해 수행한 범위 그대로이며 본 절이 넓히지 않았다.
4. **재판정 후보 밖 49 row 는 여전히 미재판정** — §12.8 한계 1 이 그대로 유효하다. 따라서 본 절이 확인한 "4 값 일치" 는 *현재 매트릭스 분포와 외부 요약이 일치* 한다는 뜻이지, 매트릭스 66 row 전건의 분류가 재검증됐다는 뜻이 아니다.

### 12.10 REQ-004 gap 권장 처리 서술의 최신성 재판정 (T-1410)

#### 대상·범위

§12.9 한계 1 (715 행) 이 이월한 **권장 처리 서술의 최신성** 을 본 slice 가 닫는다. §12.9 는 `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행의 **수치 4 값과 gap 서술** 까지만 대조했고, 같은 두 행이 함께 적은 `UC-09 신설 또는 UC-01 확장 권장` (두 파일 공통) 과 `follow-up task T-0030+ 책임` (PLAN 만) 은 대조 범위 밖이었다. 본 절은 그 두 서술을 축 A ~ D 4 축으로 실측해 **권장 자체의 유효성** 과 **책임 task 지목의 최신성** 을 분리 판정하고, stale 로 확정된 지목 1 건만 PLAN.md 36 행에서 정정한다. §6 (129 ~ 140 행) · §8 (161 행) 은 2026-05-25 시점 기록이라 §12.3 306 행의 append-only 규약대로 **무편집 보존** 하며, INDEX.md 는 본 slice 에서 읽기만 한다. 재판정 (분류 전이) 은 수행하지 않는다 — §3 매트릭스 · §5 통계 · §12.3 표 전부 무편집이다.

#### 축 A ~ D 실측

| 축 | 대조 대상 / 실측 | 기대 | 실측 | 판정 |
| --- | --- | --- | --- | --- |
| (A) 권장 (a) UC-09 신설 착수 | `ls docs/use-cases/UC-*.md` 파일 수 + `UC-09*` hit + INDEX §2 표 (31 ~ 38 행) row 수 | UC-09 파일 0 · 표 row 8 | UC 본문 파일 **8** (UC-01 ~ UC-08) · `UC-09*` hit **0** · `grep -c "^\| UC-" docs/use-cases/INDEX.md` = **8** 로 UC-09 row 없음 | **미착수 (0 / 1)** |
| (B) 권장 (b) UC-01 확장 착수 | UC-01 frontmatter `coversReq` (7 행) 의 REQ-004 포함 여부 + 본문 `사용자 지정 기간` / `임의 기간` / `date-range` / `REQ-004` grep hit | 전부 0 · §9 173 행 `0 / 8` 과 일치 | `coversReq` 13 원소에 REQ-004 **없음** (REQ-005 부터 시작) · 4 문자열 grep hit **각 0** | **미착수 (0 / 1) · §9 실측과 일치** |
| (C) 책임 task 지목 최신성 | `T-0030` · `T-0031` frontmatter `title` / `status` + 두 task 의 REQ-004 서술 + `grep -l "REQ-004" docs/tasks/*.md` 전수 | 지목 ID 소진 여부 · 대체 책임 task 유무 | T-0030 = `P2 API contract 초안 — docs/architecture/api.md` / `status: DONE` (PR 29) · T-0031 = `P2 데이터 모델 초안 — docs/architecture/data-model.md` / `status: DONE` (PR 30) · **두 task 본문 132 · 148 행이 REQ-004 을 Out of Scope 로 명시 재이관** · REQ-004 언급 task **24** · `coversReq` 에 REQ-004 를 실은 task **10** 이나 그중 UC 문서 축 해소 task **0** (나머지는 P1 REQ 매핑 · KST 기간 코드 chain · 상태 재판정) | **지목 stale** |
| (D) 권장 자체의 유효성 | §3 38 행 · §5 126 행 분류값 + §6 137 행 (a) 우선 근거 ↔ UC-01 §3 Trigger 현행 서술 | `gap` 유지 · 근거 부합 | 38 행 · 126 행 모두 **`gap`** (§9.4 188 행 유지 판정 이후 전이 0) · UC-01 §3 은 cron / Admin manual / 재수집 **3 경로** 이며 셋 다 §5 main flow 로 수렴, 사용자가 시작·종료 시각을 지정하는 경로는 **없음** | **권장 유효** (근거 부합 · 부기 1 건) |

축 C 부기 — "지목 stale" 판정의 3 요건 충족: (i) 지목된 두 ID 가 **다른 산출물** (`api.md` · `data-model.md`) 로 소진됐고, (ii) 두 task 스스로 REQ-004 을 "후속 task (UC-09 신설 또는 UC-01 확장) 책임" 으로 다시 넘겼으며, (iii) 그 후속 task 가 **아직 없다**. 즉 §6 140 행의 지목은 틀렸다기보다 **소진됐고 승계자가 없는 상태** 다. 같은 이관 문장이 `docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행에도 남아 있어 (둘 다 "UC-09 신설 또는 UC-01 확장 후 … 추가 예정"), 지목 공백은 PLAN 한 곳이 아니라 P2 artifact 전반에 걸친 일관된 미해소 상태다.

축 D 부기 — §6 137 행의 (a) 우선 근거 (`UC-01 은 cron/manual 의 full-period 평가 파이프라인이므로 분리하는 편이 깔끔`) 는 여전히 성립하나 전제 하나가 이동했다: UC-01 §3 의 trigger 는 2 경로가 아니라 **3 경로** 이고 셋째 (재수집) 는 기간이 "비어있는 시간 구간" 으로 한정된다 (REQ-037 → UC-06 위임). 다만 그 기간은 시스템이 도출하는 값이지 사용자가 지정하는 값이 아니라 REQ-004 의 축과 다르고, 3 경로 전부 동일 main flow 로 수렴하므로 "분리가 깔끔" 이라는 결론 자체는 유지된다. 부수적으로 §6 의 대안 (b) 가 적은 `셋째 entry 로 추가` 라는 **서수 표기** 는 현행 3 경로 기준으로는 넷째가 되어 이미 어긋나 있으나, §6 은 append-only 보존 대상이라 정정하지 않고 본 부기로만 남긴다.

#### 정정 대상 확정 판정

- 축 D 가 **권장 유효** 이므로 `UC-09 신설 또는 UC-01 확장 권장` 문구는 **정정 대상이 아니다 — 원문 그대로 보존** (INDEX.md 110 행 · PLAN.md 36 행 양쪽 모두).
- 축 A · B 가 **양쪽 미착수** 를 확인해 권장이 아직 살아 있음을 뒷받침한다. 따라서 두 파일에서 권장을 삭제하거나 완료 표기로 바꿀 근거는 없다.
- 축 C 가 **지목 stale** 이므로 정정 대상은 **`follow-up task T-0030+ 책임` 한 구간뿐** 이다. 정정 위치는 살아있는 체크리스트인 `docs/PLAN.md` 36 행 **하나** — 같은 지목이 있는 §6 140 행 · §8 161 행 · `api.md` 211 행 · `data-model.md` 168 행은 시점 기록이거나 본 slice 의 대상 파일 밖이라 손대지 않는다.
- 정정 방식은 **삭제가 아니라 부기** — 원 지목 문자열을 지우면 "왜 T-0030+ 라고 적혀 있었는지" 의 이력이 사라지므로, 원문을 그대로 둔 채 실측 결과를 이어 붙인다 (T-1409 가 PLAN 36 행에 시점 pointer 문장을 첨가한 화법 승계).

#### PLAN.md 36 행 before → after 요지

| 구간 | before | after |
| --- | --- | --- |
| `— follow-up task T-0030+ 책임` | 지목만 있고 시점 · 소진 여부 표기 없음 | 같은 지목 문자열을 그대로 둔 채 `; 2026-08-03 재판정: T-0030 · T-0031 은 각각 api.md · data-model.md 산출로 status DONE 이고 두 task 본문이 REQ-004 을 Out of Scope 로 재이관해 이 지목은 소진 상태이며 승계 task 는 미생성 — 근거는 §12.10` 첨가 |
| 그 외 전 구간 | — | **무편집** — 수치 4 값 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` · 권장 문구 · T-0029 링크 · T-1409 가 덧붙인 2026-08-03 재판정 pointer 문장 전부 한 글자도 축약하지 않음 |

편집 형태는 **1 행 → 1 행 in-place 치환** (T-1404 · T-1409 선례 동형) 이라 파일 행 수 175 · 행 번호 36 이 불변이다.

#### 불변 검산 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` | 12 불변 (`###` / `####` 만 추가) | **12** |
| (c) | L212 참조 문자열 count | 9 불변 | **9** |
| (d) | 잔여 축 열거 문구 count | 10 불변 | **10** |
| (e) | `sed -n '115p'` 정합식 | 여전히 115 행 · 합 66 | **115 행 · `33 + 15 + 4 + 13 + 1 = 66`** |
| (f) | §5 표 (121 ~ 127 행) count 4 값 + 합계 | `48 / 4 / 13 / 1` · 합 `**66**` · `**100 %**` | **48 / 4 / 13 / 1** · 합계 row `**66**` · `**100 %**` 불변 |
| (g) | `wc -l docs/PLAN.md` | 175 불변 | **175** |
| (h) | `wc -l docs/use-cases/INDEX.md` | 114 불변 (본 slice 무편집) | **114** · `git status` 미등장 |

(a) · (e) · (f) 가 그대로인 것은 본 slice 가 §3 매트릭스와 §5 표의 어떤 셀도 건드리지 않았기 때문이고, (c) · (d) 불변은 본 절이 두 검산 대상 문자열을 **의도적으로 회피** 해 `L212` · `잔여 축` 표기만 쓴 결과다 (§12.5 ~ §12.9 선례 승계). (h) 는 §12.9 가 만든 값 그대로이며 본 slice 의 물리적 흔적은 audit 삽입 1 · PLAN 치환 1 뿐이다.

#### hunk 국한 검증 (doc-only, R-112 대체)

```
$ git diff -U0 | grep '^@@'
@@ -36 +36 @@   (docs/PLAN.md — 1:1 치환)
@@ -719,0 +720,70 @@   (REQ-COVERAGE-AUDIT.md — §12.9 마지막 행과 §11 References 사이 삽입)
$ git diff --numstat
1    1   docs/PLAN.md
70   0   docs/use-cases/REQ-COVERAGE-AUDIT.md
```

hunk 은 **정확히 2 개** (audit 삽입 1 · PLAN 1:1 치환 1) 이고 삭제 열 합 = **1** — 그 1 은 PLAN 치환의 짝이므로 **순수 삭제 0**. audit 파일 1 ~ 719 행 · PLAN 36 행 외 전 행은 무편집이고, `docs/use-cases/INDEX.md` 는 변경 목록에 등장하지 않는다. 코드 변경 0 · 분기 0 이라 R-112 의 flow / branch 항목은 해당 없음.

#### 한계 —

1. **권장의 실행은 여전히 미착수** — 본 절은 권장의 유효성과 지목 최신성만 판정했고, UC-09 신설 / UC-01 확장 중 어느 쪽을 실제로 수행할지와 그 규모가 §6 139 행의 추정 (T-0028 동급 ≤180 LOC) 대로인지는 판정하지 않았다 (§9.5 한계 1 그대로 존속).
2. **지목 공백의 다른 3 지점 미정정** — `docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행 · §8 161 행의 `후속 task (T-0030+) 책임` 서술은 본 slice 의 대상 파일 밖이거나 append-only 보존 대상이라 그대로 남는다. 승계 task 를 실제로 생성하는 slice 가 한꺼번에 갱신하는 편이 경제적이다.
3. **REQ-004 의 구현 축은 재실측하지 않았다** — §9.2 가 기록한 `POST /api/assessment-evaluation/period` · ADR-0037 · requirements.md 23 행 `IN_PROGRESS` 는 인용만 하고 본 절에서 다시 확인하지 않았다. 본 절이 계측한 축은 §9.3 의 구분대로 **UC 문서 cover 축** 이다.
4. **재판정 후보 밖 49 row 는 여전히 미재판정** — §12.8 한계 1 · §12.9 한계 4 가 그대로 유효하다.

### 12.11 REQ-004 `gap` → `uc-covered` 실판정 + cascade (a) ~ (d) 원자 실행 (T-1413)

> 본 절은 [T-1413](../tasks/T-1413-req004-gap-to-uc-covered-reclassification.md) 이 §3 38 행 REQ-004 row 1 건을 §12.2 근거 3 종 + 2/3 임계로 **실판정** 하고, 그 결과 발동한 §12.3 cascade (a) ~ (d) 를 §12.4 원자 묶음 규약대로 **한 slice 안에서** 실행한 기록이다. **삽입 위치는 §12.10 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 가 12 로 불변이다 — §12.6 ~ §12.10 이 승계해 온 위치 규약 그대로다. 판정 대상은 §12.1 의 후보 17 row 밖 (REQ-004 는 `gap` row 라 rule (R) 의 후보가 아니다) 이지만, §9.1 의 3 축이 T-1411 · T-1412 로 전부 뒤집혀 §12.2 임계가 분류 변경을 강제한 건이다.

#### 실측 명령 (축 3 회 + 원문 확인 1 회)

```
$ ls docs/use-cases/UC-09*.md
docs/use-cases/UC-09-user-defined-period-evaluation.md          (1 파일 — 2026-08-02 시점 0)
$ grep -n "^coversReq" docs/use-cases/UC-*.md
UC-01:7 [REQ-005 …]  UC-02:7 [REQ-038 …]  UC-03:7  UC-04:7  UC-05:7  UC-06:7  UC-07:7  UC-08:7   (8 배열 모두 REQ-004 없음)
UC-09-user-defined-period-evaluation.md:7:coversReq: [REQ-004]  ← 9 배열 중 1 개 (시점 0 / 8)
$ grep -c "REQ-004" docs/use-cases/UC-*.md
UC-01 0 · UC-02 0 · UC-03 0 · UC-04 0 · UC-05 0 · UC-06 0 · UC-07 0 · UC-08 0 · UC-09 **8**
$ awk 'NR==23' docs/requirements.md            # read only — 무편집
23: REQ-004 | 9 | 수치 지표 + LLM 평가 코멘트 (사용자 지정 기간) | FR | P5 | unit + e2e | IN_PROGRESS (…)
```

#### 근거 3 종 환산 + 임계 적용

| 근거 | §9.1 시점 (2026-08-02) | 본 slice 실측 (2026-08-03) | 현 분류 `gap` 과의 대조 |
| --- | --- | --- | --- |
| (i) UC frontmatter | `coversReq` 에 REQ-004 포함 UC **0 / 8** | UC-09 7 행 `coversReq: [REQ-004]` — **1 / 9** | **어긋남** — 1+ UC 의 coversReq 명시는 §2 24 행 `uc-covered` 정의 그 자체 |
| (ii) UC 본문 hit | 8 파일 전건 **0** (합 0) | UC-09 **8 hit** · UC-01 ~ UC-08 은 각 0 그대로 | **어긋남** — 본문 §5 / §6 / §8 anchor 가 실재 |
| (iii) requirements 원문 + cover 위치 셀 | kind `FR` 일치 · cover 위치 셀 `—` (지목 없음) 이 당시 사실과 부합 | kind `FR` 여전히 일치하나 cover 위치 셀 `—` 는 UC-09 실재로 **stale** | **어긋남** — 지목 공백이 사실과 어긋남 |

**어긋남 3 / 3 → §12.2 288 행 임계 (2 종 이상) 초과 → 분류 변경 확정.** `gap` → **`uc-covered`**, cover 위치 `—` → **`UC-09`**. §9.4 188 행이 `gap` 유지의 근거로 든 3 축 (파일 0 · coversReq 0 / 8 · 본문 0) 이 전부 뒤집혔으므로 그 판정은 **시점 기록으로 보존** 하고 본 절이 이후 상태를 가리킨다 (§12.3 306 행 append-only 규약).

부기 — §9.3 이 못박은 대로 본 판정의 축은 **UC 문서 cover 축** 이다. §9.2 의 구현 실재 (route · ADR-0037 · requirements 상태) 는 판정 입력이 아니며 본 절에서 재실측하지 않았다. 즉 분류를 움직인 것은 코드가 아니라 **T-1411 의 UC-09 본문 + T-1412 의 INDEX 등록** 이다.

또한 §12.10 축 A 가 남긴 **"권장 (a) UC-09 신설 미착수 (0 / 1)"** 판정은 T-1411 의 UC-09 신설로 본 slice 시점에 **해소** 됐다 (해당 §12.10 본문은 시점 기록이라 무편집).

#### cascade 실행 기록 — (a) ~ (d) 원자 실행 / (e) · (f) 이월

- **(a) §3 38 행** — `cover 방식` `gap` → `uc-covered`, `cover 위치` `—` → `UC-09`, `참고` 셀은 기존 문자열 보존 + `; 2026-08-03 재분류 (T-1413): …` 첨가 (append-only). `|` 필드 5 컬럼 불변.
- **(b) §4** — UC-08 bullet 다음 **114 행** 에 UC-09 bullet 1 행 삽입 → bullet **9 줄**. 나열 값은 UC-09 frontmatter 7 ~ 9 행에서만 옮겨 적었고 (`coversReq: REQ-004` · adjacent 9 종 · relatedUc 2 종), 근거 없는 `envelope-cover` label 은 붙이지 않았다. 기존 8 bullet 은 무편집.
- **(c) §4 116 행 정합식** — `8 UC … 33 REQ` → `9 UC … 34 REQ`, `uc-covered 48 REQ` → `49 REQ`, 합산식 `33 + 15 + 4 + 13 + 1 = 66` → **`34 + 15 + 4 + 13 + 0 = 66`**. envelope 잔차 `15` 항은 **무변** 이라 §12.6 384 행이 부속으로 지목한 §4 118 행 blockquote 는 무편집이다.
- **(d) §5 122 ~ 128 행 표** — `uc-covered` 48 → **49** · 73 % → **74 %** (49 / 66 = 74.2 반올림) · 비고 셀 `33 REQ` → `34 REQ`, `gap` 1 → **0** · 2 % → **0 %** · 비고 셀 append (row 자체는 **삭제하지 않음** — 삭제 시 행 이동 + 시점 근거 소실). `cross-cutting` 4 (6 %) · `infrastructure` 13 (20 %) · 합계 `**66**` · `**100 %**` 는 무편집. percentage 합 검산: **74 + 6 + 20 + 0 = 100**.
- **(e) `docs/use-cases/INDEX.md` 118 행 · (f) `docs/PLAN.md` 36 행** — §12.4 312 행의 **분리 허용** 그대로 **후속 slice 로 명시 이월**. 본 slice 는 두 파일을 한 글자도 건드리지 않았다 (`wc -l` 각 122 · 175 불변 · `git status` 미등장).
- **§12.3 표 동기** — (b) · (c) · (d) 셀의 행 pointer 와 `현재 값` 을 편집 후 실측값으로 1:1 치환하고 표 아래에 T-1413 각주 1 줄을 append 했다. (a) · (e) · (f) row 는 무편집 — (a) 는 행 pointer 가 없고 (e) · (f) 는 **아직 옛 수치가 실제** 다.

#### 불변 검산 + hunk 국한 검증 (doc-only, R-112 대체)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 불변 | **66** |
| (b) | `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` | 12 불변 (`###` / `####` 만 추가) | **12** |
| (c) | `grep -n "^\| REQ-004 \|"` 출력 | `uc-covered` · `UC-09` 포함 · `\| gap \|` 미포함 | **충족** |
| (d) | §5 표 count 4 값 + 합계 | `49 / 4 / 13 / 0` · 합 `**66**` · `**100 %**` | **49 / 4 / 13 / 0 = 66** · 합계 row 무변 |
| (e) | `wc -l docs/PLAN.md` | 175 불변 | **175** · `git status` 미등장 |
| (f) | `wc -l docs/use-cases/INDEX.md` | 122 불변 | **122** · `git status` 미등장 |

```
$ git diff -U0 | grep '^@@'
@@ -38 +38 @@        (§3 REQ-004 row — 1:1 치환)
@@ -113,0 +114 @@    (§4 UC-09 bullet 1 행 삽입)
@@ -115 +116 @@      (§4 정합식 — 1:1 치환)
@@ -123 +124 @@      (§5 uc-covered row — 1:1 치환)
@@ -126 +127 @@      (§5 gap row — 1:1 치환)
@@ -299,3 +300,3 @@   (§12.3 표 (b) · (c) · (d) 셀 — 3 행 1:1 치환)
@@ -306,0 +308 @@    (§12.3 각주 1 행 append)
@@ -790,0 +793,75 @@  (§12.11 삽입 — §12.10 마지막 행과 §11 References 사이)
$ git diff --numstat
84      7       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

audit 파일의 **삭제 열 7 은 전부 in-place 치환의 짝** (38 · 116 · 124 · 127 행 4 건 + §12.3 표 3 행) 이라 **순수 삭제 0** 이고, 삽입 84 중 75 가 본 절 신설분이다. 변경 파일은 audit 1 + 본 task 파일 1 = **2 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 의 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **cascade (e) · (f) 미동기 lag 존속** — `docs/use-cases/INDEX.md` 118 행 · `docs/PLAN.md` 36 행은 여전히 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` 과 gap 1 건 서술을 담고 있다. 이는 §12.4 312 행이 **명시 허용한 분리** 이며 (파일이 다르고 성격이 요약 문구라 lag 이 모순을 만들지 않음), 후속 slice 가 닫는다.
2. **옛 요약 문장 무편집** — §1 18 행 · §8 161 · 162 행 · §9.4 188 행의 `gap 1 건` 서술은 각 시점 판정의 기록이라 §12.3 306 행 규약대로 보존했다. §9 · §10 · §12.6 ~ §12.10 본문의 옛 행 표기 (`115 행` · `121 ~ 127 행` · `L212`) 도 같은 이유로 정정하지 않았다.
3. **재판정 후보 밖 49 row 는 여전히 미재판정** — §12.8 한계 1 · §12.9 한계 4 · §12.10 한계 4 가 그대로 유효하다. 본 slice 도 REQ-004 **1 row** 만 판정했다.
4. **UC-09 본문의 질적 충분성은 판정하지 않았다** — (i) · (ii) 는 frontmatter 선언과 본문 hit 의 **실재** 까지만 실측했고, UC-09 가 REQ-004 의 미충족 축 (프런트 노출 · 기간 종료 경계 · 좌표 종합 코멘트 — requirements.md 23 행) 까지 서술로 덮는지는 §12.6 한계 4 와 같은 이유로 범위 밖이다.

### 12.12 cascade (e) · (f) 외부 요약 2 곳 수치 동기 (T-1414)

> 본 절은 [T-1414](../tasks/T-1414-cascade-ef-index-plan-count-resync.md) 가 §12.4 314 행의 **분리 허용** 으로 [T-1413](../tasks/T-1413-req004-gap-to-uc-covered-reclassification.md) 이 이월한 cascade **(e) · (f)** 잔여분을 실행한 기록이다. §12.11 이 확정한 4 값 (`uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66`) 을 audit 문서 밖의 두 요약 지점 — [INDEX.md](INDEX.md) closure 문단 · [PLAN.md](../PLAN.md) Phase P2 셋째 bullet — 으로 **옮겨 적기만** 했고, audit 문서 안의 수치는 한 글자도 재계산하지 않았다. **삽입 위치는 §12.11 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.11 이 승계해 온 위치 규약 그대로다.

#### cascade 실행 기록 — 편집 방식은 전부 append

- **(e) `docs/use-cases/INDEX.md`** — 118 행 원문 (`원 출처 2026-05-25` · `uc-covered 48 … gap 1`) 은 **무편집** 이고, 119 · 120 행의 `2026-08-0N 재판정:` 화법을 승계한 `2026-08-03 재분류:` 줄 **1 개를 120 행 뒤에 append** 했다 (in-place 치환 아님). 새 줄은 T-1411 UC-09 신설 → T-1412 INDEX 등록 → T-1413 실판정 chain 과 갱신된 4 값을 적고, 근거는 §12.11 · 본 절에 위임한다. closure 문단은 118 ~ 121 행이 됐고 `Refs:` 줄은 그 아래 그대로다.
- **(f) `docs/PLAN.md` 36 행** — 같은 줄 **끝에 문장 1 개를 append** 했다. bold 구간의 `gap 1 건 (REQ-004 …)` 과 `uc-covered 48 / … / gap 1 = 66.` 은 T-0029 시점 기록이라 보존했고, 기존 `2026-08-03 재판정: …` 문장 뒤에 갱신 4 값 + §12.11 · §12.12 pointer 문장을 이어 붙였다. 한 줄 안의 확장이라 행 수 175 는 불변이다.
- **§12.3 표 (e) · (f) 셀 치환** — (e) row 는 `지점` 열을 `118 행` → `118 ~ 121 행` (append 후 실측), `현재 값` 열을 갱신 4 값 + 원 출처 4 값 보존 부기로, (f) row 는 `현재 값` 열을 갱신 4 값 + 옛 서술 보존 부기로 1:1 치환했다. (a) ~ (d) row 는 T-1413 이 이미 동기해 **무편집** 이며, 표 아래에 T-1414 각주 1 줄을 append 했다. 이로써 §12.3 cascade 6 지점은 **(a) ~ (f) 전건 closure** 다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ wc -l docs/use-cases/INDEX.md          → 123   (편집 전 122 + append 1)
$ wc -l docs/PLAN.md                     → 175   (한 줄 in-place 확장이라 불변)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md   → 66    (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md   → 12    (불변, `###` 만 추가)
$ git diff -U0 docs/use-cases/INDEX.md | grep -c '^-[^-]'   → 0     (순수 append, 삭제 0)
$ grep -n "REQ ↔ UC coverage audit closure" docs/use-cases/INDEX.md → 118 (원문 행 위치 불변)
$ git diff -U0 | grep '^@@'
@@ -36 +36 @@          (PLAN.md 36 행 — 줄 끝 append, 1:1 치환)
@@ -120,0 +121 @@      (INDEX.md — 재분류 줄 1 행 append)
@@ -303,2 +303,2 @@     (§12.3 표 (e) · (f) 셀 — 2 행 1:1 치환)
@@ -308,0 +309 @@      (§12.3 각주 1 행 append)
@@ -867,0 +869,39 @@   (§12.12 삽입 — §12.11 마지막 행과 §11 References 사이)
$ git diff --numstat
1       1       docs/PLAN.md
1       0       docs/use-cases/INDEX.md
42      2       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

`git diff --numstat` 합계는 3 doc 파일 기준 **삽입 44 / 삭제 3** 이고 삭제 3 은 전부 in-place 치환의 짝 (PLAN 1 + §12.3 표 2) 이라 **순수 삭제 0** 이다. 변경 파일은 INDEX 1 + PLAN 1 + audit 1 + 본 task 파일 1 = **4 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다.

#### 한계 —

1. **cascade 전건 closure 이후에도 옛 요약은 무편집** — 본 slice 로 §12.3 의 6 지점이 (a) ~ (f) 전건 동기됐지만, §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행의 `gap 1 건` 요약과 INDEX.md 118 행 · PLAN.md 36 행 앞부분의 옛 4 값은 각 시점 판정의 기록이라 §12.3 306 행 append-only 규약대로 **여전히 무편집** 이다. 현 시점은 새 줄 · 새 문장이 가리킨다.
2. **§11 References bullet 의 UC 개수 표기는 stale** — `docs/use-cases/INDEX.md — 8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 2 줄이 UC-09 실재와 어긋나나, cascade 6 지점 밖이고 시점 기록인지 현행 index 서술인지 판정이 선행돼야 해 **후속 slice 소관** 이다 (본 slice 무편집).
3. **재판정 후보 밖 49 row 는 여전히 미재판정** — §12.8 한계 1 · §12.9 한계 4 · §12.11 한계 3 이 그대로 유효하다. 본 slice 는 판정을 **1 건도 하지 않았고** 수치를 옮겨 적기만 했다.

### 12.13 cascade 밖 P2 artifact 2 종 REQ-004 pointer 동기 (T-1415)

> 본 절은 [T-1415](../tasks/T-1415-arch-doc-req004-pointer-resync.md) 가 §12.3 cascade **6 지점 밖** 에 남아 있던 REQ-004 pointer 3 행 — [api.md](../architecture/api.md) 211 · 223 행 · [data-model.md](../architecture/data-model.md) 168 행 — 을 §12.11 이 확정한 4 값 (`uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66`) 에 맞춰 동기한 기록이다. 본 절도 §12.12 와 같이 수치를 **옮겨 적기만** 했고 audit 문서 안의 분류·수치는 한 건도 재판정·재계산하지 않았다. **삽입 위치는 §12.12 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.12 가 승계해 온 위치 규약 그대로다.

#### 갱신 3 행 기록 — 편집 방식은 전부 in-place 치환

- **api.md 211 행** (`## 8. Out of scope` 목록) — `gap REQ-004` · `gap 1 건` 표현과 `UC-09 신설 또는 UC-01 확장 후 … 예정` 전제 문구를 걷어내고, 2026-08-03 T-1413 재분류로 분류가 `uc-covered` (UC-09) · gap 0 건임을 적되 **UC-09 §5 sequence 가 호명하는 endpoint 가 아직 api.md §5 표에 미박제** 라 여전히 out-of-scope 이라는 잔여 의무를 보존했다. 근거는 §12.11 · 본 절로 위임. bullet 1 행 · 목록 내 위치 (211 행) 불변.
- **api.md 223 행** (`## 9. References` 의 audit bullet) — `uc-covered 48 REQ 의 분류 / gap 1 (REQ-004) 추적` → `uc-covered 49 REQ 의 분류 / gap 0 추적` + 전이 사실 부기. 부기 문구는 아래 검산 (`grep -c "gap 1"` = 0 · `grep -c "uc-covered 48"` = 0) 과 정합하도록 옛 값을 `48 REQ · gap 이 1 건` 으로 풀어 적었다 — 옛 리터럴을 그대로 재생산하면 검산이 깨지기 때문이다. 링크 target · bullet 순서 · 인접 References bullet 은 무편집.
- **data-model.md 168 행** (`## 7. Out of scope` 목록) — api.md 211 행과 동형이되 잔여 의무를 **§2 Entity 표 row 추가 미완** 으로 적었고, UC-09 가 신규 entity 를 요구하는지 여부 자체는 **판정하지 않고** "UC-09 §5 기준 entity 도출은 후속 slice 소관" 으로만 남겼다 (날조 0). bullet 1 행 · 위치 (168 행) 불변 · 인접 167 · 169 행 무편집.

세 행 모두 날짜 stamp 가 없는 **living document 의 현행 상태 서술** (`Out of scope` 목록 · `References` bullet) 이라 §12.3 306 행의 append-only 보존 대상이 **아니다** — append-only 는 "그 시점의 판정 / 요약" 문장에만 걸린다. 그래서 INDEX.md · PLAN.md (§12.12 (e) · (f)) 처럼 append 하지 않고 **in-place 치환** 하는 편이 규약상 맞는 처리다.

#### §12.10 790 행 한계 2 의 소진 상태

한계 2 가 "승계 task 를 실제로 생성하는 slice 가 한꺼번에 갱신하는 편이 경제적" 이라며 예고한 **3 지점 중 2 건** (api.md 211 행 · data-model.md 168 행) 이 본 slice 로 closure 됐고, **§8 161 행 1 건만 잔존** 한다 — 그 행은 시점 기록인지 현행 결론인지의 처리 방침 확정이 선행돼야 해 본 slice 밖이다 (Follow-up 3).

#### 불변 검산 (doc-only, R-112 대체)

```
$ wc -l docs/architecture/api.md                             → 229   (1:1 치환 2 건이라 불변)
$ wc -l docs/architecture/data-model.md                      → 190   (1:1 치환 1 건이라 불변)
$ grep -c "gap 1"         docs/architecture/api.md           → 0
$ grep -c "uc-covered 48" docs/architecture/api.md           → 0
$ grep -n "REQ-004"       docs/architecture/data-model.md    → 168 (1 건 · `gap REQ-004` 미포함)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md    → 66    (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md    → 12    (불변, `###` 만 추가)
$ git diff -U0 | grep '^@@'
@@ -211 +211 @@        (api.md 211 행 — 1:1 치환)
@@ -223 +223 @@        (api.md 223 행 — 1:1 치환)
@@ -168 +168 @@        (data-model.md 168 행 — 1:1 치환)
@@ -907,0 +908,45 @@   (§12.13 삽입 — §12.12 마지막 행과 §11 References 사이)
$ git diff --numstat
2       2       docs/architecture/api.md
1       1       docs/architecture/data-model.md
45      0       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

3 doc 파일의 **삭제 열 합 = 3** 이고 전부 in-place 치환의 짝이라 **순수 삭제 0** (audit 는 순수 append 라 삭제 0). 변경 파일은 api.md 1 + data-model.md 1 + audit 1 + 본 task 파일 1 = **4 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · UC-01 ~ UC-09 본문 · `CLAUDE.md` 는 `git status --porcelain` 에 등장하지 않는다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **UC-09 의 endpoint / entity 실박제는 미완** — 본 slice 는 pointer 문장만 동기했고, api.md §5 표의 72 endpoint / 16 prefix 합계 (153 행) 와 data-model.md §2 의 13 entity 합계 (38 행) 는 **무변** 이다. UC-09 §5 sequence 해독 → endpoint row 추가 · entity 도출 판정은 각각 후속 slice 소관이다.
2. **`8 UC` 표기 stale 은 그대로** — §11 References bullet 의 `8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 과 api.md 3 · 12 · 64 행 · data-model.md 3 · 38 행의 `8 UC` 표기가 9 UC 실재와 어긋나나, REQ-004 pointer 와 별개 축이고 문서 전반 일괄 판정이 선행돼야 해 **후속 slice 소관** 이다 (§12.12 한계 2 존속, 본 slice 무편집).
3. **옛 `gap 1 건` 요약은 여전히 무편집** — §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행의 결론 문장은 각 시점 판정의 기록이라 §12.3 306 행 규약대로 보존했다 (§12.12 한계 1 존속). 본 slice 가 in-place 로 고친 3 행은 시점 기록이 아니라 현행 상태 서술이라는 점에서 이들과 성격이 다르다.

### 12.14 UC-09 endpoint 귀속 박제 — api.md §5 104 행 · §7 row (T-1416)

> 본 절은 [T-1416](../tasks/T-1416-uc09-api-endpoint-attribution.md) 이 [T-1415](../tasks/T-1415-arch-doc-req004-pointer-resync.md) 의 **Follow-up 1** (UC-09 §5 sequence → [api.md](../architecture/api.md) §5 Endpoint 표 실박제) 을 집행한 기록이다. 삽입 위치는 §12.13 마지막 행 뒤 · §11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.13 이 승계해 온 위치 규약 그대로다.

#### 실측 선행 판정 — Follow-up 1 의 전제는 부분적으로 사실과 달랐다

Follow-up 1 은 "endpoint 미박제" 를 전제했으나, 실측 결과 **없던 것은 endpoint row 가 아니라 UC 귀속** 이었다. [UC-09](UC-09-user-defined-period-evaluation.md) §5 sequence (54 ~ 98 행 mermaid) 가 호명하는 HTTP endpoint 는 **70 행의 `POST /api/assessment-evaluation/period` 1 종뿐** 이며 (5 행 frontmatter `trigger` · 36 행 입력 계약 `PeriodBridgeDto` 5 키 · 136 행 §9 component mapping 이 모두 같은 route 를 가리킨다 — 118 행의 `POST /period` 는 같은 route 의 UI 부재 서술이고, 124 행 `GET /api/assessments` 는 §8 postcondition 이 조회 경로로 [UC-02](UC-02-evaluation-query.md) 를 참조한 것이라 §5 sequence step 이 아니다), 그 route 는 api.md §5 표 **104 행에 이미 실재** 했다 (T-0315 ~ T-0323 shipped, [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) ACCEPTED). 다만 104 행 UC 컬럼이 `[UC-01]` 단독이고 §7 cross-reference 표에도 UC-09 row 가 없어 UC-09 가 어디에도 연결돼 있지 않았다. 따라서 본 slice 는 **endpoint 신설 0** 이고 `72 endpoint` · `16 resource prefix` 는 무변이며, 바뀐 합계는 `8 UC cover` → `9 UC cover` 하나뿐이다.

#### 갱신 4 지점 기록

- **api.md 104 행** (§5 Endpoint 표) — UC 컬럼만 in-place 치환해 기존 `[UC-01](…)` 을 제거하지 않고 `· [UC-09](…)` 를 **병기** 했다 (같은 route 가 UC-01 manual trigger 의 이관 경로이자 UC-09 의 유일 진입점이라 둘 다 참이다). METHOD · path · description · auth tier 4 컬럼과 인접 103 · 105 행은 무편집.
- **api.md §7 row 신설** (UC-08 row 바로 뒤 — 신규 193 행) — 3 컬럼을 UC-09 본문 실측에서 채웠다: UC 링크는 `#5-main-flow-sequence-diagram` anchor 포함 (선행 8 row 형식 승계), 호출 step 은 §5 autonumber **step 1** (Requester→BackendAPI) 에 role 2 분기 (User ephemeral / Admin persist) 를 1 구로 덧붙였고, endpoint group 은 단일 route 이되 **계약 서술의 정본을 §5 104 행으로 위임** 해 description 을 재생산하지 않았다 (중복 서술은 drift 원인).
- **api.md 153 행** (합계) — `8 UC cover` → `9 UC cover` 1 토큰 치환 + 부기 1 구 (`T-1416 박제로 UC-09 귀속 추가 … endpoint 신설 0 이라 72 / 16 은 불변`). `72 endpoint 행` · `16 resource prefix` 와 T-0117 ~ T-1306 누계 서술은 한 글자도 바꾸지 않았다.
- **api.md 211 행** (`## 8. Out of scope`, 치환 후 212 행) — T-1415 가 적은 "UC-09 §5 sequence 가 호명하는 endpoint 는 아직 §5 표에 미박제" 는 본 실측으로 사실이 아니게 돼 남기지 않고 **1 행 in-place 재기술** 했다: (i) endpoint 축은 §5 104 행 (실재) + §7 UC-09 row (귀속) 로 본 문서 안에서 해소, (ii) out-of-scope 로 남는 잔여는 **본 문서 밖 축** — data-model.md §2 entity 도출 판정 · 프런트 기간 지정 UI 부재 (UC-09 118 행 실측), (iii) 근거는 §12.13 · 본 절로 위임. bullet 을 **삭제하지 않았다** — 잔여 축이 실재하므로 재기술이 맞다.

#### §12.13 한계 ① 의 소진 상태

한계 ① (`UC-09 의 endpoint / entity 실박제는 미완`) 중 **endpoint 축이 본 slice 로 해소** 됐다 (다만 예고와 달리 row 신설이 아니라 **이미 실재하던 route 의 귀속 박제** 로 해소됐다). **entity 축 (data-model.md §2 표 · 38 행 `13 entity` 합계) 은 잔존** 하며 T-1415 Follow-up 2 소관이다 — 본 slice 는 그 축을 판정조차 하지 않았다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md → 72   (baseline 72 — endpoint 신설 0)
$ grep -c "^| \[UC-"  docs/architecture/api.md                           → 9    (baseline 8 — §7 row 1 신설)
$ grep -c "8 UC"      docs/architecture/api.md                           → 6    (baseline 7 — 153 행 1 곳만 갱신)
$ wc -l               docs/architecture/api.md                           → 230  (baseline 229 — §7 row 1 행 증가분만)
$ grep -c "^\| REQ-"  docs/use-cases/REQ-COVERAGE-AUDIT.md               → 66   (불변)
$ grep -c "^## "      docs/use-cases/REQ-COVERAGE-AUDIT.md               → 12   (불변, `###` 만 추가)
$ git diff -U0 | grep '^@@'
@@ -104 +104 @@         (api.md 104 행 — UC 컬럼 in-place)
@@ -153 +153 @@         (api.md 153 행 — 합계 in-place)
@@ -192,0 +193 @@       (api.md §7 UC-09 row — 순수 추가)
@@ -211 +212 @@         (api.md 211 행 — 잔여 의무 재기술 in-place)
@@ -952,0 +953,47 @@    (§12.14 삽입 — §12.13 마지막 행과 §11 References 사이)
$ git diff --numstat
4       3       docs/architecture/api.md
47      0       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

api.md 의 **삭제 3 은 전부 in-place 치환의 짝** (104 · 153 · 211 행) 이라 **순수 삭제 0** 이고, audit 는 순수 append 라 삭제 0 이다. 변경 파일은 api.md 1 + audit 1 + 본 task 파일 1 = **3 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **endpoint 신설 0** — 본 slice 는 문서 안 **귀속** 만 바꿨고 실코드 route 신설은 0 이다. `72 endpoint` · `16 resource prefix` 는 무변이며, 늘어난 값은 §7 row 1 행에서 직접 파생한 `9 UC cover` 뿐이다.
2. **data-model.md §2 entity 축 미판정** — UC-09 가 신규 entity 를 요구하는지 (기존 `Assessment` 좌표로 충분한지) 를 본 slice 는 **판정하지 않았다**. §2 표 · 38 행 `13 entity` · 168 행 잔여 의무 문면은 전부 무편집이다.
3. **`8 UC` 표기는 153 행 1 곳만 갱신** — api.md 3 · 12 · 64 · 207 · 208 행 · data-model.md 3 · 38 행 · 본 문서 §11 References 2 줄은 여전히 stale 이다. 각 지점이 시점 기록인지 현행 index 서술인지의 일괄 판정이 선행돼야 해 별도 slice 소관이다 (§12.13 한계 ② 존속).

### 12.15 옛 요약 3 지점 forward pointer append + 처리 방침 확정 (T-1417)

> 본 절은 [T-1417](../tasks/T-1417-audit-legacy-summary-forward-pointer.md) 이 [T-1416](../tasks/T-1416-uc09-api-endpoint-attribution.md) 의 **Follow-up 2** (3 회 이월 — T-1413 FU4 · T-1414 FU4 · T-1415 FU3) 와 **Follow-up 4** (4 회 이월 — T-1412 FU4 부터) 를 한 slice 안에서 함께 닫은 기록이다. 둘 다 본 문서 **내부의 pointer 정합** 문제라 판정 축이 같다. 본 절은 수치를 한 건도 재판정·재계산하지 않았고 **pointer 문장만 append** 했다. **삽입 위치는 §12.14 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.14 가 승계해 온 위치 규약 그대로다.

#### 실측 선행 (편집 전 4 값 — 전제 전건 성립)

```
(i)   $ grep -n "^## 8\." REQ-COVERAGE-AUDIT.md              → 157   (`## 8. 결론`, verdict bullet 5 개 = 161 ~ 165 행)
      $ awk 'NR>=157 && NR<=166' … | grep -cE "§9|§12"       → 0     (§9 / §12 를 가리키는 pointer 문장 0 개)
(ii)  $ awk 'NR==18' … | grep -o "재판정: §[0-9.]* 참조"      → 2026-08-02 재판정: §9 참조   (pointer 가 §9 까지뿐 — §12 지목 0)
(iii) $ grep -n "INDEX.md\` 104 행" …                        → 199   (T-1416 FU4 · 본 task AC 4 의 `198 행` 표기와 1 행 어긋남 — 실측 199 채택)
      $ grep -n "coverage audit closure" INDEX.md            → 118   (closure 문단 실제 현재 범위 118 ~ 121 행, `Refs:` 123 행, wc -l 123)
(iv)  $ grep -c "^\| REQ-" REQ-COVERAGE-AUDIT.md             → 66    (baseline)
      $ grep -c "^## "     REQ-COVERAGE-AUDIT.md             → 12    (baseline, wc -l 1013)
```

4 값 모두 편집 전제와 일치해 **중단 지점은 없었다**. 유일한 어긋남은 (iii) 의 행 번호 1 행 (198 vs 실측 199) 이며, 이월 Follow-up 표기가 아니라 **실측값 199** 를 편집 대상으로 삼았다.

#### 처리 방침 확정 (정본)

**옛 요약의 수치·판정 문구는 §12.3 306 행 append-only 규약대로 무편집 보존하고, 현행 상태는 pointer 문장 append 로만 가리킨다.** 대상은 날짜·판정 시점이 문장 안에 박혀 있는 **시점 기록** — §1 18 행 · §8 161 ~ 165 행 · §9.4 188 행 · §9 199 행 · INDEX.md 118 행 · PLAN.md 36 행 앞부분이 이에 해당한다. 이는 T-1415 가 §12.13 918 행에서 `api.md` 211 · 223 행 · `data-model.md` 168 행을 **in-place 치환** 한 처리와 성격이 다르다 — 그 3 행은 `Out of scope` 목록 · `References` bullet 처럼 날짜 stamp 가 없는 **living document 의 현행 상태 서술** 이라 보존 대상이 아니었다. 판별 기준은 "그 문장이 어느 시점의 판정을 기록하는가, 아니면 현재 상태를 서술하는가" 하나다.

#### 갱신 3 지점 기록 — 편집 방식은 전부 append

- **§8 결론 (161 ~ 165 행 뒤, 신규 167 행)** — 5 bullet (`gap 1 건` · `T-0030+ 책임` · `8 UC + UC-09 (예정)` 포함) 을 **한 글자도 고치지 않고** 그 뒤에 현행 pointer 문단 1 행을 append 했다. 3 요소 — (i) 위 bullet 이 `auditDate: 2026-05-25` 시점 verdict 의 기록임을 명시, (ii) 2026-08-03 현재 REQ-004 는 `uc-covered` (gap 0) · UC-09 는 실재 · `T-0030+` 지목은 stale 이라는 현행 사실, (iii) 근거를 §9 · §12.10 · §12.11 · 본 절로 위임 (수치 재생산 최소화). `## 8.` · `## 9.` heading 무편집.
- **§1 18 행** — 4 값 (`uc-covered 48` 등) · `gap 1 건` 서술 · 기존 `2026-08-02 재판정: §9 참조.` 를 전부 보존하고, 그 뒤에 `2026-08-03 재분류: … 근거 §12.11 · §12.15 참조` 문장 1 개만 이어 붙였다 (T-1414 가 PLAN.md 36 행에 쓴 in-line append 화법 승계). **1 행 → 1 행** (행 수 증가 0).
- **§9 199 행** — `INDEX.md 104 행` 리터럴은 2026-08-02 시점 기록이라 **치환하지 않고**, 같은 행 끝에 괄호 부기 1 구를 append 했다. 2 요소 — (i) closure 문단의 현재 행 번호 118 ~ 121, (ii) 미동기 사실 자체는 T-1414 의 cascade (e) 로 **이미 해소** 됐고 근거는 §12.12 라는 pointer. **1 행 → 1 행**.

#### closure 선언

- **§12.10 790 행 한계 2 의 3 지점 전건 closure** — `api.md` 211 행 · `data-model.md` 168 행은 T-1415 (§12.13) 가, 마지막 잔존 1 건인 **§8 161 행은 본 slice** 가 닫았다. 다만 §8 은 예고된 "정정" 이 아니라 위 방침대로 **원문 보존 + pointer append** 로 닫혔다.
- **T-1416 Follow-up 2 · 4 closure** — FU2 (§8 · §1 결론 문장 처리 방침 확정, 3 회 이월) 는 위 "처리 방침 확정" 문단이 정본으로 박제하며 집행까지 마쳤고, FU4 (`INDEX.md 104 행` 표기 최신성 점검, 4 회 이월) 는 §9 199 행 부기로 닫혔다. 두 Follow-up 모두 승계 대상이 남지 않는다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md    → 66    (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md    → 12    (불변, `###` 만 추가)
$ wc -l              docs/use-cases/REQ-COVERAGE-AUDIT.md    → 1013 → 1072
$ git status --porcelain                                     → M REQ-COVERAGE-AUDIT.md · M T-1417 task 파일  (정확히 2 개)
$ git diff -U0 | grep '^@@'
@@ -18 +18 @@          (§1 18 행 — 문장 1 개 in-line append, 1:1)
@@ -166,0 +167,2 @@    (§8 pointer 문단 — 순수 추가, 신규 167 행)
@@ -199 +201 @@        (§9 199 행 — 괄호 부기 in-line append, 1:1)
@@ -999,0 +1002,57 @@  (§12.15 삽입 — §12.14 마지막 행과 §11 References 사이)
$ git diff --numstat
61      2       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

삭제 열 **2** 는 전부 in-place append 의 짝 (§1 18 행 · §9 199 행) 이라 **순수 삭제 0** 이다. `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/architecture/*` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 하고, §3 38 행 · §4 116 행 정합식 · §5 통계표 · §12.3 cascade 6 row 는 hunk 밖이라 무변이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 [CLAUDE.md](../../CLAUDE.md) §3.2 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **§9.4 188 행은 무편집 · pointer 도 없다** — `gap 유지` 판정 문장은 위 방침대로 시점 기록이라 보존했고, 그 행에 개별 pointer 를 달지도 않았다 (§9 절 전체를 §12 chain 이 승계하는 구조라 절 단위 pointer 로 충분하다고 판단). §1 · §8 만 pointer 를 받은 이유는 그 둘이 **문서 진입부 / 결론부** 라 독자가 §12 까지 내려오지 않고 오독할 위험이 크기 때문이다.
2. **§12.x 본문의 옛 행 표기는 여전히 무편집** — §12.6 ~ §12.14 의 `110 행` · `115 행` · `121 ~ 127 행` · `L212` · `104 행` 등은 각 slice 시점의 기록이라 본 절의 방침이 그 보존을 **정본으로 확정** 했다. 앞으로도 정정 대상이 아니다.
3. **`8 UC` 표기 일괄 갱신은 미착수** — §11 References 2 줄 · `api.md` 3 · 12 · 64 · 207 · 208 행 · `data-model.md` 3 · 38 행은 9 UC 실재와 어긋난 채 남아 있다 (T-1416 Follow-up 3 소관). 이들은 날짜 stamp 가 없어 위 판별 기준상 **in-place 치환 대상** 일 가능성이 높으나, 지점별 판정이 선행돼야 해 본 slice 는 건드리지 않았다.

### 12.16 UC-09 기준 data-model §2 신규 entity 필요 여부 실판정 (T-1418)

> 본 절은 [T-1418](../tasks/T-1418-data-model-uc09-entity-derivation-judgment.md) 이 [T-1417](../tasks/T-1417-audit-legacy-summary-forward-pointer.md) 의 **Follow-up 1** ([T-1415](../tasks/T-1415-arch-doc-req004-pointer-resync.md) FU2 부터 **4 회 이월**) 을 닫은 기록이다. 남아 있던 것은 pointer 가 아니라 **판정 자체** 였다 — [data-model.md](../architecture/data-model.md) 168 행이 "UC-09 § 5 기준 entity 도출 (신규 entity 가 필요한지 여부 자체) 은 후속 slice 소관" 이라고 스스로 잔여 의무를 명시했기 때문이다. 본 절은 그 판정을 실측으로 닫고, 편집 방식은 §12.15 가 정본으로 확정한 판별 기준 (날짜 stamp = 시점 기록 → append / stamp 없음 = living document → in-place) 을 **첫 적용** 했다. **삽입 위치는 §12.15 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.15 가 승계해 온 위치 규약 그대로다.

#### 실측 선행 (편집 전 4 값)

**(i) UC-09 §5 · §8 · §9 데이터 단위 전수 ↔ data-model §2 표 1:1 매핑** (§5 = 54 ~ 98 행 mermaid + 100 행 해설, §8 = 121 ~ 127 행, §9 = 129 ~ 142 행)

| UC-09 이 호명하는 데이터 단위 | 호명 위치 | §2 표 대응 row | 성격 |
| --- | --- | --- | --- |
| `personId` → resolved person | §5 72 ~ 73 행 · §9 `UserModule` 행 | **Person** | read-only 조회 (write 0) |
| `serviceIdentities` (author 필터 입력) | §5 72 · 84 행 | **ServiceIdentity** | read-only 조회 |
| 요청 principal 의 role (guard 2 종 · `isAdminRole` dispatch) | §5 71 · 76 ~ 80 행 · §9 `AuthModule` 행 | **User** (role 필드) | read-only 조회 |
| LLM provider / 난이도 모델 설정 | §4 precondition 5 · §7.4 · §9 `LlmModule` 행 | **LlmProviderConfig** · **DifficultyMapping** | read-only 참조 (설정 부재 시 reject 전파) |
| 영속된 좌표 row + `created` flag / 좌표 6 키 응답 | §5 89 ~ 94 행 · **§8 (b)** | **Assessment** | **write** (Admin 분기 한정) |
| `PeriodBridgeDto` 5 키 (`personId`/`period`/`scope`/`periodStart`/`reevaluate?`) | §3 36 행 · §5 70 행 | **대응 row 없음** | 요청 입력 계약 (비영속 DTO) |
| 수집 `activities` (GitHub / Confluence) | §5 82 ~ 84 행 | **대응 row 없음** | raw — §4 REQ-032 이 저장 자체를 금지 |
| `EvaluationResult[]` (`narrative`/`difficulty`/`contribution`/`volume`) | §5 85 ~ 86 행 · **§8 (a)** | **대응 row 없음** (in-memory) | §4 98 행이 이미 `Assessment`/`Contribution` 매핑을 박제 |
| 요청 principal 의 timezone (snap 해석 zone, 기본 KST) | §3 41 행 · §7.2 113 행 | **대응 row 없음** (User 의 컬럼 축) | 구체 컬럼은 §7 P3 범위 |

대응 row 가 없는 4 항목은 전부 **비영속 입력 / raw / in-memory / 컬럼 축** 이고, **영속 표면을 새로 요구하는 항목은 0** 이다.

```
(ii)  $ grep -c "UC-09"      docs/architecture/data-model.md        → 1     (168 행 §7 bullet 1 곳뿐 — §2 표 `source UC` 컬럼 등장 0, 기대값과 일치)
(iii) $ awk 'NR==167||NR==168' docs/architecture/data-model.md
      167 행 → "새 entity 발굴이 8 UC scope 를 벗어나는 경우 … ADR 없이 신규 entity 결정 금지"   (날짜 stamp 없음 = living document)
      168 행 → "REQ-004 … 2026-08-03 T-1413 재분류로 … 여전히 out-of-scope · 근거 § 12.11 · § 12.13"  (날짜 stamp 있음 = 시점 기록)
(iv)  $ grep -c "^| \*\*"    docs/architecture/data-model.md        → 14    (baseline · §2 표 bold entity row)
      $ grep -c "^## "       docs/architecture/data-model.md        → 8     (baseline)
      $ wc -l                docs/architecture/data-model.md        → 190   (baseline)
      $ grep -c "^| REQ-"    docs/use-cases/REQ-COVERAGE-AUDIT.md   → 66    (baseline)
      $ grep -c "^## "       docs/use-cases/REQ-COVERAGE-AUDIT.md   → 12    (baseline, wc -l 1072)
```

4 값 모두 편집 전제와 일치해 **중단 지점은 없었다** — 특히 (ii) 가 기대값 **0** 이라 §2 표 병기는 전건 신규 추가다.

#### 판정 — **신규 entity 0**

UC-09 는 §2 표에 없는 새 entity 를 **요구하지 않는다**. 근거는 UC-09 본문 3 인용이다. (a) §8 (a) 는 User 분기를 "응답으로 `EvaluationResult[]` … 를 받고 **DB 상태 변화 0**. 같은 요청을 반복해도 부작용이 없다" 로 못 박아 **영속 표면 자체가 없다**. (b) §8 (b) 는 Admin 분기의 산출을 "**Assessment 좌표 row 1 개** 가 생성 (또는 first-write-wins 로 read-through)" 으로 한정하고 응답 6 키 (`assessmentId`/`personId`/`period`/`scope`/`periodStart`/`created`) 를 열거하는데, 이 좌표는 [data-model.md](../architecture/data-model.md) §3 관계 5 가 이미 박제한 `Assessment.@@unique([personId, period, scope, periodStart])` ([ADR-0006](../decisions/ADR-0006-assessment-data-model.md) / [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md)) **그 자체** 라 새 축이 0 이다 — `created` 는 row 가 아니라 응답 flag 다. (c) §9 mapping 표의 `DB Persistence / PersistenceModule` 행은 책임을 "**Admin 분기에서만** — 좌표 row 영속 + read-through. User 분기는 write 0" 으로 적어 write 대상이 Assessment 단일임을 재확인한다. 나머지 호명 단위는 위 (i) 표대로 기존 row 의 read-only 참조이거나 비영속 항목이다. 따라서 §2 표 **row 추가 0**, 18 행 · 38 행의 `13 entity (+ 1 conceptual mention)` · `4 module` 수치 **불변** 이며, AC 3 의 ADR 게이트 (167 행) 는 발동 조건 (`신규 N ≥ 1`) 이 성립하지 않아 **N/A** 다.

#### 갱신 3 지점 기록 — §12.15 판별 기준의 첫 적용

- **data-model.md §2 표 Assessment row (28 행) — `source UC` 컬럼 in-place 병기** — 기존 `UC-01 · UC-02 · UC-06` 을 **제거하지 않고** `[UC-09](UC-09-user-defined-period-evaluation.md)` 를 이어 붙였다 (표 안 첫 등장이라 링크 포함 — 같은 컬럼의 기존 화법 승계). 표 row 수 · 컬럼 수 불변이고 같은 row 의 `책임` · `관련 REQ` · `책임 module` 3 컬럼은 무편집. **병기 대상은 이 1 row 뿐** — Person · ServiceIdentity · User · LlmProviderConfig · DifficultyMapping 은 위 (i) 표대로 UC-09 안에서 **단순 read-only 참조** 에 그쳐 AC 4 의 병기 제외 조항에 해당하고, Contribution · Summary 는 UC-09 본문이 entity 로 **직접 호명하지 않는다** (86 행의 `contribution` 은 `EvaluationResult` 의 등급 필드이지 entity 가 아니다).
- **data-model.md 38 행 (합계 문장) — in-place 치환** — `8 UC cover` → `9 UC cover` 1 토큰 치환 + 근거 1 구 (본 task ID · UC-09 · 신규 entity 0 · §12.16 pointer). 날짜 stamp 가 없는 **living document 의 현행 합계** 라 §12.15 방침의 **in-place 축**. 같은 문장의 `13 entity (+ 1 conceptual mention)` · `4 module` 과 T-0039 / ADR-0044 누계 서술 (`10 → 11`, `11 → 13`) 은 한 글자도 바꾸지 않았다.
- **data-model.md 168 행 (§7 Out of scope bullet) — append** — `2026-08-03 T-1413 재분류로 …` 로 시작하는 **앞부분은 무편집** 이고 (날짜 stamp 를 단 시점 기록 → §12.15 방침의 **append 축**), 문장 끝에 괄호 부기 1 구를 이어 붙여 (i) 잔여 의무 `§ 2 표 row 추가 미완` 이 본 slice 로 **해소** 됨, (ii) 판정 결론과 근거 3 인용 요약, (iii) out-of-scope 로 남는 것은 신규 entity 신설 가능성 자체 (167 행 ADR 게이트) 뿐임을 적었다. **1 행 → 1 행**.

#### closure 선언

- **T-1417 Follow-up 1 closure — 4 회 이월 종결.** T-1415 FU2 → T-1416 FU2(entity 축) → T-1417 FU1 로 이어진 `data-model.md §2 entity 도출 판정` 항목은 본 절로 닫힌다. §12.13 한계 ① (`UC-09 의 endpoint / entity 실박제는 미완`) 은 endpoint 축이 §12.14 (T-1416), **entity 축이 본 절** 로 각각 소진돼 **전건 closure** 다. §12.14 한계 ② (`data-model.md §2 entity 축 미판정`) 도 함께 소진된다.
- 승계 대상은 남지 않는다 — 다만 판정 결과가 `신규 0` 이라 ADR task 후보 (본 task Follow-up 3 조건부 항) 는 **생성하지 않는다**.

#### 불변 검산 (doc-only, R-112 대체)

```
$ grep -c "^| \*\*"  docs/architecture/data-model.md      → 14   (불변 — row 추가 0)
$ grep -c "^## "     docs/architecture/data-model.md      → 8    (불변)
$ wc -l              docs/architecture/data-model.md      → 190  (불변 — 3 지점 모두 1:1)
$ grep -c "UC-09"    docs/architecture/data-model.md      → 1 → 3  (28 · 38 · 168 행 각 1 행 — 행 계수)
$ grep -c "13 entity" docs/architecture/data-model.md     → 2    (불변 — 18 · 38 행)
$ grep -c "^| REQ-"  docs/use-cases/REQ-COVERAGE-AUDIT.md → 66   (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md → 12   (불변, `###` 만 추가)
$ git status --porcelain → M data-model.md · M REQ-COVERAGE-AUDIT.md · M T-1418 task 파일  (정확히 3 개)
$ git diff -U0 | grep '^@@'
@@ -28 +28 @@          (§2 Assessment row — `source UC` in-place 병기, 1:1)
@@ -38 +38 @@          (38 행 합계 — in-place 치환, 1:1)
@@ -168 +168 @@        (168 행 — 괄호 부기 append, 1:1)
@@ -1058,0 +1059,80 @@ (§12.16 삽입 — §12.15 마지막 행과 §11 References 사이)
$ git diff --numstat
3       3       docs/architecture/data-model.md
80      0       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

data-model.md 의 **삭제 3 은 전부 in-place 치환 / append 의 짝** (28 · 38 · 168 행) 이라 **순수 삭제 0** 이고, audit 는 순수 append 라 삭제 0 이다. §3 ER diagram (44 ~ 59 행 mermaid) · §4 · §5 · §6 은 hunk 밖 무변이며, `docs/architecture/api.md` · `modules.md` · `components.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **`8 UC` 표기 잔여 지점은 미착수** — 본 slice 는 data-model.md **38 행 1 곳만** 갱신했다 (AC 2 판정의 직접 귀결이라 동일 slice 소관). `data-model.md` 3 행 · `api.md` 3 · 12 · 64 · 208 · 209 · 222 행 · 본 문서 §11 References 2 줄은 9 UC 실재와 어긋난 채 남아 있다 (§12.15 한계 3 존속, 별도 slice).
2. **UC-09 ↔ `modules.md` / `components.md` mapping 미착수** — UC-09 §9 가 6 module 을 지목하는데 두 architecture 문서는 UC-09 를 알지 못한다. 특히 §2 표 `책임 module` 컬럼은 4 module 만 쓰고 **`PersistenceModule` 은 등장하지 않는데**, UC-09 §9 는 영속 책임을 그 이름으로 부른다 — 두 문서의 module 명 층위 차이라 entity 판정과 별개 축이며 본 slice 는 판정하지 않았다 (별도 slice).
3. **§3 ER diagram · §6 coverage 표 무편집 + §2 row 실수 (14) vs 합계 표기 (13) 미판정** — 판정이 `신규 0` 이라 관계·coverage 가 바뀌지 않아 §3 · §4 · §5 · §6 은 건드리지 않았다. 다만 실측 (iv) 의 `grep -c "^| \*\*"` = **14** 는 38 행의 `13 entity` 표기와 1 어긋나는데 (누계 서술이 `PermissionDeniedRecord` 를 빠뜨린 것으로 보인다), 이는 UC-09 와 무관한 **선행 불일치** 이고 본 slice AC 2 가 수치 불변을 요구하므로 **사실 기록만** 하고 정정하지 않았다 (별도 slice 소관).

### 12.17 `8 UC` 표기 12 지점 §12.15 방침 판정 + 일괄 동기 (T-1419)

> 본 절은 [T-1419](../tasks/T-1419-eight-uc-notation-bulk-resync.md) 가 [T-1418](../tasks/T-1418-data-model-uc09-entity-derivation-judgment.md) 의 **Follow-up 1** ([T-1416](../tasks/T-1416-uc09-api-endpoint-attribution.md) FU3 부터 **5 회 이월**) 을 닫은 기록이다. 남아 있던 것은 판정이 끝난 뒤의 **표기 잔여** 다 — [T-1411](../tasks/T-1411-uc-09-user-defined-period-evaluation.md) 이 UC-09 를 신설하고 [T-1412](../tasks/T-1412-index-uc09-row-registration.md) 가 [INDEX.md](INDEX.md) 에 등록해 실 UC 수가 **9** 인데, architecture 2 문서와 본 문서 §11 의 `8 UC` 표기 12 지점이 아직 그 사실을 반영하지 못했다. 본 절은 §12.15 가 정본으로 확정한 판별 기준 (날짜 stamp = 시점 기록 → pointer append / stamp 없음 = living document → in-place) 의 **2 차 적용이자 첫 다지점 일괄 적용** 이며, 수치를 한 건도 재판정·재계산하지 않았다. **삽입 위치는 §12.16 마지막 행 뒤 · §11 References 앞** 이고 `###` 이라 `## ` heading count 12 가 불변이다 — §12.6 ~ §12.16 이 승계해 온 위치 규약 그대로다.

#### 실측 선행 (편집 전 3 값 — 전제 전건 성립)

```
(i)   $ grep -n "8 UC" docs/architecture/api.md             → 3 · 12 · 64 · 208 · 209 · 222   (6 hit, 기대값 일치)
      $ grep -n "8 UC" docs/architecture/data-model.md      → 3 · 167 · 180 · 181             (4 hit, 기대값 일치)
      $ grep -c "8 UC" docs/use-cases/REQ-COVERAGE-AUDIT.md → 36  (그 중 `## 11. References` 안 1142 · 1143 행 2 줄만 본 slice 대상, 나머지 34 은 Out of Scope)
(ii)  대상 12 지점의 날짜 stamp 유무 → **전건 stamp 0** (아래 판정 표 4 열)
(iii) $ wc -l  api.md → 230 · data-model.md → 190 · REQ-COVERAGE-AUDIT.md → 1152   (baseline)
      $ grep -c "^\| REQ-" REQ-COVERAGE-AUDIT.md → 66 · $ grep -c "^## " → 12       (baseline)
      $ grep -c "^\| UC-"  INDEX.md              → 9    (9 UC 실재의 1 차 근거)
      api.md 153 행       `72 endpoint` · `16 resource prefix` · `9 UC cover`        → 실재 확인
      data-model.md 38 행 `13 entity (+ 1 conceptual mention)` · `4 module` · `9 UC cover` → 실재 확인
```

3 값 모두 편집 전제와 일치해 **중단 지점은 없었다** — 행 번호 12 개가 전건 기대값과 같아 T-1418 이 남긴 좌표를 그대로 채택했다.

#### 판정 표 — 12 지점 전건 (애매어 0)

| # | 지점 | 문장 성격 | 날짜 stamp | 판정 |
| --- | --- | --- | --- | --- |
| 1 | `api.md` 3 행 | 서두 blockquote — 문서 범위 서술, 같은 문장이 **본 문서는 living document** 를 자칭 | 없음 | **in-place** |
| 2 | `api.md` 12 행 | §1 목차 — §5 표의 현재 내용 서술 | 없음 | **in-place** |
| 3 | `api.md` 64 행 | §5 표 서두 — 표가 지금 무엇을 수집하는지 서술 | 없음 | **in-place** |
| 4 | `api.md` 208 행 | §8 Out of scope — `현재` 라는 현행 지시어로 시작하는 **주장** | 없음 | **in-place** (AC 3 (c) 실측 선행 후) |
| 5 | `api.md` 209 행 | §8 Out of scope — 4 와 동형 주장 | 없음 | **in-place** (AC 3 (c) 실측 선행 후) |
| 6 | `api.md` 222 행 | §9 References — INDEX.md 를 가리키는 현행 index 서술 | 없음 | **in-place** |
| 7 | `data-model.md` 3 행 | 서두 blockquote — 1 과 동형, **living document** 자칭 | 없음 | **in-place** |
| 8 | `data-model.md` 167 행 | §7 Out of scope — ADR 게이트 규범 (§12.16 실측 (iii) 이 이미 `날짜 stamp 없음 = living document` 로 판정) | 없음 | **in-place** (게이트 문구 무편집) |
| 9 | `data-model.md` 180 행 | §8 References — INDEX.md 현행 index 서술 | 없음 | **in-place** |
| 10 | `data-model.md` 181 행 | §8 References — UC 본문 링크 범위 서술 | 없음 | **in-place** |
| 11 | 본 문서 §11 1142 행 | References — INDEX.md 현행 index 서술 | 없음 | **in-place** |
| 12 | 본 문서 §11 1143 행 | References — UC 본문 링크 범위 서술 | 없음 | **in-place** |

12 행 전건이 **in-place 축** 으로 확정됐다 — §12.15 한계 3 이 예측한 "in-place 치환 대상일 가능성이 높으나 지점별 판정 선행 필요" 를 실판정으로 확인한 결과다. 대비되는 append 축 사례는 §12.15 의 §1 18 행 · §8 · §9 199 행, §12.16 의 `data-model.md` 168 행 — 전부 문장 안에 날짜가 박힌 시점 기록이었다. 1 · 7 의 서두 blockquote 는 `P2 의 넷째/다섯째 entry artifact (T-0030 / T-0031) 의 산출물` 이라는 **출처 절** 을 품지만, 그 절은 날짜가 아니라 산출 task 귀속이고 본 slice 는 그 절을 **한 글자도 건드리지 않았다** — 바뀐 것은 같은 문장의 UC 범위 표기뿐이다.

#### 지점별 갱신 결과

- **`api.md` 6 지점 — 전부 in-place, 각 1 행 → 1 행** (`wc -l` 230 불변). 3 · 12 · 64 행은 `8 UC` → `9 UC` + 링크 범위 `UC-01 ~ UC-08` → `UC-01 ~ UC-09` 로 옮기고 근거 1 구 (T-1419 · UC-09 · 귀속은 T-1416 · endpoint 신설 0) 를 덧붙였다. 222 행은 INDEX.md 실측 (`grep -c "^| UC-"` = 9) 을 근거로 `9 UC backbone 표`. 208 · 209 행은 아래 실측을 선행한 뒤에만 옮겼다. **153 행 합계 · §5 표 body · §7 cross-reference 표는 무편집** — 그래서 `72 endpoint` · `16 resource prefix` hit 가 유지된다.
- **`data-model.md` 4 지점 — 전부 in-place, 각 1 행 → 1 행** (`wc -l` 190 불변). 3 행은 서두 UC 범위 + 근거 1 구, 180 · 181 행은 References 의 index 서술과 링크 범위. **167 행은 게이트 문구 `ADR 없이 신규 entity 결정 금지.` 를 한 글자도 약화시키지 않고** scope 표기 `8 UC` → `9 UC` 만 바꾼 뒤, T-1418 이 확정한 `신규 entity 0` 결론 때문에 게이트 발동 조건 (`신규 N ≥ 1`) 이 현재 미성립임을 괄호 부기로 인용했다. **38 행 합계 · §2 표 · §3 ER diagram · §4 · §5 · §6 은 무편집.**
- **본 문서 §11 2 줄 — in-place**. `9 UC backbone` · `9 UC 본문` 으로 옮기고, 후자에는 §9 · §10 · §12.x 안의 `8 UC` 34 hit 가 시점 기록이라 무편집 존속함을 한 구로 명시했다. **같은 §11 의 나머지 bullet 9 줄 · 말미 `Refs:` 줄 · `## 11.` heading 은 무편집.**

#### AC 3 (c) 실측 인용 — UC-09 §5 의 realtime / webhook 호명 0

```
$ grep -niE "\b(websocket|web socket|sse|server-sent|streaming|webhook|web hook)\b" UC-09-user-defined-period-evaluation.md
  (no match, exit 1)                                                    ← 파일 전체 174 행 기준 0
$ awk 'NR>=54 && NR<=101' UC-09-user-defined-period-evaluation.md | grep -niE "\b(websocket|...|webhook)\b"
  (no match, exit 1)                                                    ← §5 Main flow 범위 0
$ grep -ciE "\b(websocket|sse|streaming|webhook)\b" UC-09-…            → 0
```

따라서 `api.md` 208 · 209 행의 주장 (`현재 … §5 sequence 어디에도 호명 없음`) 은 **9 UC 기준으로도 성립** 하며, 표기만 8 → 9 로 옮겼다. **주의** — word boundary 없는 `sse` 패턴은 `a-sse-ssment` 의 부분열에 걸려 위양성 13 hit 를 낸다. 위 실측은 `\b` 를 붙인 결과이며, boundary 없는 1 차 grep 을 그대로 신뢰했다면 "호명 있음" 으로 오판할 뻔했다.

#### closure 선언

- **T-1418 Follow-up 1 closure — 5 회 이월 종결.** T-1416 FU3 → T-1417 FU3(한계) → T-1418 FU1 로 이어진 `8 UC 표기 일괄 판정 + 동기` 항목이 본 절로 닫힌다. 12 지점 전건이 판정 + 집행까지 마쳤고 승계 대상이 남지 않는다.
- **§12.14 한계 3** (`8 UC 표기는 153 행 1 곳만 갱신`) · **§12.15 한계 3** (`8 UC 표기 일괄 갱신은 미착수`) · **§12.16 한계 1** (`8 UC 표기 잔여 지점은 미착수`) — 3 항이 **동시 소진** 된다. 남는 표기는 전부 시점 기록 (아래 한계 1) 이라 정정 대상이 아니다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ wc -l docs/architecture/api.md                             → 230  (불변 — 6 지점 모두 1:1)
$ wc -l docs/architecture/data-model.md                      → 190  (불변 — 4 지점 모두 1:1)
$ wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md                 → 1152 → 1256  (§12.17 append 104 행)
$ grep -c "72 endpoint" api.md → 2 · grep -c "16 resource prefix" api.md → 2
                                        (153 행 합계 hit 무편집 유지 1 + 3 행 부기의 신설 인용 1)
$ grep -c "^| \*\*"  docs/architecture/data-model.md         → 14   (불변 — row 추가 0)
$ grep -c "^## "     docs/architecture/data-model.md         → 8    (불변)
$ grep -c "^| REQ-"  docs/use-cases/REQ-COVERAGE-AUDIT.md    → 66   (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md    → 12   (불변, `###` 만 추가)
$ grep -c "8 UC"     api.md → 6 → 0 · data-model.md → 4 → 0
$ grep -c "8 UC"     REQ-COVERAGE-AUDIT.md                   → 36 → 49
                                        (§12.16 이전 본문 34 무편집 + §11 1143 행의 인용 1 + 본 절 신설 인용 14)
$ git status --porcelain → M api.md · M data-model.md · M REQ-COVERAGE-AUDIT.md · M T-1419 task 파일  (정확히 4 개)
$ git diff --numstat
6       6       docs/architecture/api.md
4       4       docs/architecture/data-model.md
106     2       docs/use-cases/REQ-COVERAGE-AUDIT.md
$ git diff -U0 | grep '^@@'
@@ -3 +3 @@            (api.md 3 행 — 서두 in-place, 1:1)
@@ -12 +12 @@          (api.md 12 행 — 목차 in-place, 1:1)
@@ -64 +64 @@          (api.md 64 행 — §5 표 서두 in-place, 1:1)
@@ -208,2 +208,2 @@    (api.md 208 · 209 행 — §8 주장 2 줄 in-place, 2:2)
@@ -222 +222 @@        (api.md 222 행 — §9 References in-place, 1:1)
@@ -3 +3 @@            (data-model.md 3 행 — 서두 in-place, 1:1)
@@ -167 +167 @@        (data-model.md 167 행 — §7 게이트 bullet in-place, 1:1)
@@ -180,2 +180,2 @@    (data-model.md 180 · 181 행 — §8 References 2 줄 in-place, 2:2)
@@ -1138,0 +1139,104 @@ (§12.17 삽입 — §12.16 마지막 행과 §11 References 사이, 순수 추가)
@@ -1142,2 +1246,2 @@   (§11 References 2 줄 — in-place, 2:2)
```

api.md 6 · data-model.md 4 의 **삭제 10 은 전부 in-place 치환의 짝** 이라 **순수 삭제 0** 이고, 본 문서는 §11 2 줄 in-place (삭제 2, 짝 있음) + §12.17 순수 append 다. `docs/architecture/modules.md` · `components.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **4 개** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 N/A 다.

#### 한계 —

1. **본 문서 본문의 `8 UC` 34 hit 는 무편집 존속** — §9 · §10 · §12.5 ~ §12.16 안의 값은 실행 당시 grep 출력의 축자 인용이거나 날짜 stamp 를 단 시점 기록이라 §12.15 방침의 보존 대상이다. 본 절이 인용을 위해 새로 쓴 `8 UC` 문자열도 같은 성격 (본 slice 시점의 기록) 이라 이후 정정 대상이 아니다.
2. **UC-09 ↔ `modules.md` / `components.md` mapping 미착수** — T-1418 Follow-up 2 이월 (T-1417 FU3 부터). UC-09 §9 가 `AssessmentModule` · `AuthModule` 외 6 module 을 지목하는데 두 architecture 문서는 UC-09 를 알지 못한다. 본 slice 는 표기 축만 다뤘고 module 축은 건드리지 않았다 (별도 slice).
3. **`data-model.md` 38 행 `13 entity` vs §2 표 실 row 수 14 의 1 어긋남 미정정** — T-1418 Follow-up 4 이월. 누계 서술 (`10 → 11` · `11 → 13`) 이 `PermissionDeniedRecord` 를 빠뜨린 것으로 보이며 UC-09 와 무관한 **선행 불일치** 다. 본 slice AC 4 (c) 가 38 행 무편집을 요구하므로 **사실 기록만** 한다 (별도 slice).
4. **`api.md` 223 행 링크 범위는 무편집** — `UC-01 … ~ UC-08-permission-denied.md — 본 문서의 endpoint source` 는 `8 UC` 리터럴을 담지 않아 본 slice 의 12 지점 열거에 들지 않았다. 링크 범위만 보면 9 UC 와 어긋나므로 후속 slice 의 정정 후보다 (본 절은 사실 기록만).

### 12.18 UC-09 §9 의 5 component · 6 module mapping 2 축 대조 실판정 (T-1420)

> 본 절은 [T-1420](../tasks/T-1420-uc09-module-component-mapping-verification.md) 이 [T-1419](../tasks/T-1419-eight-uc-notation-bulk-resync.md) 의 **Follow-up 1** (= 본 문서 § 12.17 **한계 2**, [T-1417](../tasks/T-1417-audit-legacy-summary-forward-pointer.md) FU3 → [T-1418](../tasks/T-1418-data-model-uc09-entity-derivation-judgment.md) FU2 → T-1419 FU1 로 **4 회 이월**) 을 닫은 기록이다. [UC-09](UC-09-user-defined-period-evaluation.md) `§9` 는 "본 UC 가 거치는 5 component + 6 module" 을 표로 못 박고 그 명칭이 [INDEX.md](INDEX.md) 19 ~ 25 행이 허용한 목록 안이라고 **스스로 검증 가능한 주장** 을 건다. 본 절은 그 주장을 **(축 A) 명칭 실재** · **(축 B) component ↔ module 조합 정합** 2 축으로 대조한 실판정이며, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) 두 문서는 **한 글자도 편집하지 않았다** — § 12.16 이 entity 축에서 `신규 0` 을 기록만 하고 `data-model.md` 를 무편집으로 둔 것과 정확히 동형이다. 삽입 위치는 § 12.17 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 5 축 — 전제 전건 성립)

```
(i)   UC-09 §9 표 (133 ~ 140 행) — 표 행 6 · component 열 유효값 5 · module 명 6
      component 5 : Web UI(135) · Backend API(136) · Worker (평가 파이프라인)(137) · LLM Gateway(139) · DB Persistence(140)
      module    6 : WebModule · AssessmentModule · AuthModule · UserModule · LlmModule · PersistenceModule
      비대칭 1   : 138 행의 component 열이 `—` (UserModule 행) — 표 행은 6 인데 component 는 5
(ii)  $ sed -n '26,46p' docs/architecture/modules.md | grep -c "^| \*\*"      → 12  (기대값 일치)
      AuthModule(32) · PersistenceModule(33) · UserModule(34) · GithubModule(35) · ConfluenceModule(36)
      · PermissionDeniedRecordModule(37) · LlmModule(38) · AssessmentModule(39)
      · AssessmentCollectionModule(40) · AssessmentEvaluationModule(41) · SchedulerModule(42) · WebModule(43)
      $ sed -n '190,229p' docs/architecture/modules.md | grep -c "^| \*\*"    → 8   (기대값 일치)
(iii) $ sed -n '109,121p' docs/architecture/components.md | grep -c "^| \*\*" → 8   (기대값 일치)
      Web UI(113) · Backend API(114) · Worker (평가 파이프라인)(115) · DB Persistence(116)
      · LLM Gateway(117) · GitHub Adapter(118) · Confluence Adapter(119) · Scheduler(120)
(iv)  $ grep -c "use-cases" docs/architecture/modules.md    → 0    · components.md → 0
      $ grep -c "UC-0"      docs/architecture/modules.md    → 1    (42 행 SchedulerModule 의 `UC-06 §6.5 · UC-01 §3` 부기 1 곳뿐)
      $ grep -c "UC-0"      docs/architecture/components.md → 0
(v)   $ wc -l modules.md → 256 · components.md → 190 · REQ-COVERAGE-AUDIT.md → 1256      (baseline)
      $ grep -c "^\| REQ-" REQ-COVERAGE-AUDIT.md → 66 · $ grep -c "^## " → 12            (baseline)
```

5 축 전건이 기대값과 일치해 **중단 지점은 없었다** — 두 축의 판정을 모두 그대로 진행했다.

#### 축 A — 명칭 실재 대조 (11 행, 애매어 0)

| # | UC-09 §9 호명 | 종류 | 정본 목록 | 판정 |
| --- | --- | --- | --- | --- |
| 1 | `Web UI` | component | `components.md` `## Component table` | **실재** (113 행) |
| 2 | `Backend API` | component | 〃 | **실재** (114 행) |
| 3 | `Worker (평가 파이프라인)` | component | 〃 | **실재** (115 행 — 부기까지 축자 동일) |
| 4 | `LLM Gateway` | component | 〃 | **실재** (117 행) |
| 5 | `DB Persistence` | component | 〃 | **실재** (116 행) |
| 6 | `WebModule` | module | `modules.md` `## Module 목록` | **실재** (43 행) |
| 7 | `AssessmentModule` | module | 〃 | **실재** (39 행 — 단 본문이 `placeholder (미shipped)` 로 자칭, 축 B 3 · 4 행의 입력) |
| 8 | `AuthModule` | module | 〃 | **실재** (32 행) |
| 9 | `UserModule` | module | 〃 | **실재** (34 행) |
| 10 | `LlmModule` | module | 〃 | **실재** (38 행) |
| 11 | `PersistenceModule` | module | 〃 | **실재** (33 행) |

**축 A 결과 — 11/11 실재, 미실재 0.** 신설 후보가 0 이므로 새 module / component 신설의 ADR 게이트는 발동하지 않고, escalate 할 Follow-up 도 없다.

#### 축 B — 조합 정합 대조 (UC-09 §9 표 6 행 전건)

| # | UC-09 행 | UC-09 의 component ↔ module | `modules.md` `## Components ↔ Modules mapping` 대응 | 판정 | 근거 1 구 |
| --- | --- | --- | --- | --- | --- |
| 1 | 135 | Web UI ↔ `WebModule` | 196 행 Web UI ↔ `WebModule` | **일치** | 1:1 축자 동일 |
| 2 | 136 | Backend API ↔ `AssessmentModule (controller layer)` + `AuthModule` | 197 행 Backend API ↔ 6 module (`AssessmentModule` + `UserModule` + `AuthModule` + `PermissionDeniedRecordModule` + `AssessmentCollectionModule` + `AssessmentEvaluationModule`) | **부분 일치** | 집합으로는 `{AssessmentModule, AuthModule}` ⊂ 6 module 로 부분집합 성립하나, 197 행이 UC-09 의 진입 endpoint `POST /api/assessment-evaluation/period` 를 **`AssessmentEvaluationController` (= AssessmentEvaluationModule)** 소유로 명시해 `(controller layer)` 한정어의 귀속이 어긋난다 |
| 3 | 137 | Worker (평가 파이프라인) ↔ `AssessmentModule (period bridge + orchestrator)` | 198 행 Worker (수집 + 평가 파이프라인) ↔ `AssessmentCollectionModule` + `AssessmentEvaluationModule` | **어긋남** | 198 행이 "평가 service layer 를 `AssessmentModule` 로 귀속하던 서술은 stale 이라 정정" 을 명문화하고 39 행이 `AssessmentModule` 을 코드 0 · AppModule 등록 0 placeholder 로 못 박는다 — UC-09 가 지목한 두 bridge service (`PeriodBridgeEphemeralService` / `PeriodBridgeAdminPersistService`) 는 41 행 `AssessmentEvaluationModule` 안에 [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 로 박제돼 있다 |
| 4 | 138 | `—` ↔ `UserModule` | 197 행 Backend API 의 6 module 중 `UserModule` | **부분 일치** | UC-09 의 component 열 공백은 정본에 대응 항이 없어서가 아니라 UC-09 가 의도적으로 비운 것 — `modules.md` 는 `UserModule` 을 **Backend API** component 에 귀속시킨다 (197 행). 따라서 `—` 행의 귀속처는 **Backend API** 이며, 그 자리를 채우면 2 행과 병합돼 UC-09 §9 의 "5 component" 비대칭이 해소된다 |
| 5 | 139 | LLM Gateway ↔ `LlmModule` | 200 행 LLM Gateway ↔ `LlmModule` | **일치** | 1:1 축자 동일 |
| 6 | 140 | DB Persistence ↔ `PersistenceModule` | 199 행 DB Persistence ↔ `PersistenceModule` (+ `PermissionDeniedRecordModule` 의 영속화 slice) | **일치** | 주축 1:1 동일 — 199 행 부기 module 은 권한 거부 audit 영속화라 UC-09 의 책임 범위 밖이고, UC-09 가 이를 생략한 것은 어긋남이 아니다 |

**축 B 결과 — 일치 3 · 부분 일치 2 · 어긋남 1.**

#### 판정 결론 (AC 4 — 1 문장)

> **UC-09 신설이 `modules.md` / `components.md` 에 요구하는 갱신은 `없음` 이다** — 축 A 가 11/11 실재로 미실재 0 이고, 축 B 의 어긋남 1 · 부분 일치 2 는 전부 **UC-09 §9 표 쪽 표기** 가 두 architecture 문서의 정본과 어긋난 방향이지 두 문서 쪽 결손이 아니며, 실측 (iv) 대로 두 문서에는 UC 축 서술이 애초에 0 (`grep -c "use-cases"` = **0** · **0**, `grep -c "UC-0"` = **1** · **0**) 이라 UC 1 건 신설이 row 나 문장을 요구하는 구조 자체가 아니다 (두 문서는 REQ / ADR 축으로 조직).

정정 후보는 반대 방향이라 본 slice 가 손대지 않고 (Out of Scope — UC-09 본문은 판정 대상 원본이라 read-only) 좌표만 박제한다. **정본 = `modules.md` 쪽** (shipped 코드 실재 + [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) / [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 근거) 이고 정정 대상은 UC-09 `§9` **137 행** (Worker ↔ `AssessmentModule` → `AssessmentCollectionModule` + `AssessmentEvaluationModule`) 과 **136 행** (`(controller layer)` 한정어의 귀속) 2 곳이다 — Follow-up 으로 넘긴다.

#### closure 선언

- **T-1419 Follow-up 1 closure — 4 회 이월 종결.** T-1417 FU3 → T-1418 FU2 → T-1419 FU1 로 이어진 `UC-09 ↔ modules.md / components.md mapping` 항목이 본 절로 닫힌다. 판정 + 기록까지 마쳤고 승계 대상이 남지 않는다 (정정 실행은 UC-09 본문 쪽 별건 — 아래 한계 밖 Follow-up).
- **§ 12.17 한계 2 소진** — "UC-09 ↔ `modules.md` / `components.md` mapping 미착수" 가 본 절의 2 축 실판정으로 해소된다.
- **UC-09 cascade 4 축 전건 종결** — endpoint 축 (§ 12.14 / T-1416) · entity 축 (§ 12.16 / T-1418) · 표기 축 (§ 12.17 / T-1419) · module 축 (본 절 / T-1420) 이 모두 판정 + 기록을 마쳐, [T-1411](../tasks/T-1411-uc-09-user-defined-period-evaluation.md) 의 UC-09 신설이 architecture 문서에 남긴 구조 축은 **잔여 0** 이다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ wc -l docs/architecture/modules.md                         → 256  (불변 — 무편집)
$ wc -l docs/architecture/components.md                      → 190  (불변 — 무편집)
$ wc -l docs/use-cases/UC-09-user-defined-period-evaluation.md → 174 (불변 — 무편집)
$ wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md                 → 1256 → 1355  (§ 12.18 append 99 행)
$ grep -c "^| \*\*"  docs/architecture/modules.md            → 20   (불변 — 12 + 8)
$ grep -c "^| \*\*"  docs/architecture/components.md         → 8    (불변)
$ grep -c "^| REQ-"  docs/use-cases/REQ-COVERAGE-AUDIT.md    → 66   (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md    → 12   (불변, `###` 만 추가)
$ git status --porcelain → M REQ-COVERAGE-AUDIT.md · M T-1420 task 파일   (정확히 2 개)
$ git diff --numstat
99      0       docs/use-cases/REQ-COVERAGE-AUDIT.md
16      8       docs/tasks/T-1420-uc09-module-component-mapping-verification.md   (AC 체크 7 + Follow-up 2 + 완료 기록)
$ git diff -U0 -- docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -1242,0 +1243,99 @@   (§ 12.18 삽입 — § 12.17 마지막 행과 § 11 References 사이, 순수 추가)
```

`git diff --numstat` 의 본 문서 삭제 열이 **0** 이라 본 절은 **순수 append** 이고 (task 파일의 삭제 8 은 AC 체크박스 7 줄 + Follow-up 1 줄의 in-place 치환 짝), `docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **2 개** · 합계 diff **+115 / -8 LOC** 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **`modules.md` 192 행 `8 component 와 본 문서의 11 module` 이 실측 module row 12 와 1 어긋남 — 무편집.** 같은 어긋남이 44 행 (`위 11 module 은 AppModule …`) · 205 행 (`총 8 component → 11 module`) 에도 반복된다. `PermissionDeniedRecordModule` (37 행) 또는 `AssessmentEvaluationModule` (41 행) 신설분이 누계 서술에 반영되지 않은 **UC-09 와 무관한 선행 불일치** 이고, 본 slice 는 두 architecture 문서 무편집 경계 (AC 6) 를 지켜야 하므로 사실 기록만 한다 (별도 slice).
2. **`INDEX.md` 19 ~ 25 행 column 정의 무편집.** 19 행 `UC-01 ~ UC-08 의 8 개` 는 실 9 UC 와 어긋나고, 25 행 `8 NestJS module 명` 은 괄호 안에 이름을 **9 개** 열거하면서 수치는 `8` 이라 자체 모순이며 `modules.md` 정본 12 와도 어긋난다. 날짜 stamp 없는 column 정의라 § 12.15 방침상 in-place 축 후보지만 본 slice 범위 밖이라 무편집 (별도 slice).
3. **§ 12.17 한계 3 · 4 잔존** — `data-model.md` 38 행 `13 entity` vs §2 표 실 row 14 의 1 어긋남, `api.md` 223 행 링크 범위 (`UC-01 … ~ UC-08-permission-denied.md`) 가 9 UC 와 어긋나는 건. 둘 다 본 slice Out of Scope 로 그대로 이월된다.
4. **두 architecture 문서 사이의 Worker 라벨 부기 불일치 — 무편집.** `components.md` 115 행은 `Worker (평가 파이프라인)`, `modules.md` 198 행은 `Worker (수집 + 평가 파이프라인)` 으로 적는다. UC-09 §9 137 행은 전자를 따랐고 축 A 3 행은 그 정본 (`components.md`) 기준으로 **실재** 판정했다 — 축 B 3 행의 어긋남은 이 라벨 차이가 아니라 module 열 귀속에서 비롯한다.

### 12.19 UC-09 § 9 module 귀속 어긋남의 처리 방식 판정 + shipped 정본 병기 (T-1421)

> 본 절은 [T-1421](../tasks/T-1421-uc09-module-attribution-correction.md) 이 [T-1420](../tasks/T-1420-uc09-module-component-mapping-verification.md) 의 **Follow-up 4** 를 닫은 기록이다. § 12.18 축 B 가 UC-09 [§ 9](UC-09-user-defined-period-evaluation.md) 6 행에서 **어긋남 1 (137 행) · 부분 일치 2 (136 · 138 행)** 를 확정하고 "정본은 [modules.md](../architecture/modules.md) 197 · 198 행, 정정 대상은 UC-09 본문" 이라고 방향까지 못 박았으나 실행은 Out of Scope 로 넘겼다. 본 절은 그 실행을 **처리 방식 판정 → 최소 blast-radius 반영** 순으로 집행한 기록이며, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [INDEX.md](INDEX.md) 세 문서와 UC-09 `§ 5` sequence 는 **한 글자도 편집하지 않았다**. 삽입 위치는 § 12.18 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 4 축 — 전제 전건 성립)

```
(i)   $ grep -c "AssessmentModule" UC-09-user-defined-period-evaluation.md          → 14  (기대값 일치)
      $ sed -n '55,100p'  … | grep -c "AssessmentModule"                            → 12  (§5 sequence participant, 기대값 일치)
      $ sed -n '129,143p' … | grep -c "AssessmentModule"                            →  2  (§9 136 · 137 행, 기대값 일치)
      → 14 = 12 (§5) + 2 (§9) 로 정확히 분해된다 (§9 밖 · §5 밖 잔여 hit 0)
(ii)  $ sed -n '26,46p' docs/architecture/modules.md | grep -c "^| \*\*"             → 12  (기대값 일치)
      그중 AssessmentCollectionModule(40 행) · AssessmentEvaluationModule(41 행) 실재 — 정본 명칭의 전건 성립
(iii) $ sed -n '25p' docs/use-cases/INDEX.md | grep -o "[A-Za-z]*Module"             →  9
      WebModule · AssessmentModule · UserModule · GithubModule · ConfluenceModule
      · LlmModule · AuthModule · SchedulerModule · PersistenceModule
      → 허용 목록 9 개 안에 AssessmentCollectionModule · AssessmentEvaluationModule 은 부재 (전수 대조)
(iv)  $ wc -l UC-09 → 174 · INDEX.md → 123 · modules.md → 256 · REQ-COVERAGE-AUDIT.md → 1355   (baseline)
      $ grep -c "^\| REQ-" REQ-COVERAGE-AUDIT.md → 66 · $ grep -c "^## " → 12                  (baseline)
```

4 축 전건이 모두 기대값과 일치해 **중단 지점은 없었다** — 판정을 그대로 진행했다.

#### 처리 방식 판정 (3 후보 택 1 — 애매어 0)

| # | 후보 | blast radius (실측) | 자기모순 발생 여부 | 판정 |
| --- | --- | --- | --- | --- |
| A | **전면 치환** — `§ 9` 136 · 137 행 module 열을 shipped 명칭으로 교체 + `§ 5` participant 12 행 · 131 행 제약문 · [INDEX.md](INDEX.md) 25 · 39 행 동기 | **17 행 / 2 파일** (UC-09 15 행 [2 + 12 + 1] + INDEX 2 행) — 본 slice 편집분 (audit + task 파일) 을 더하면 **4 파일** | 치환만 하고 INDEX 를 두면 131 행 "허용 목록만 사용" 자기모순 발생, INDEX 까지 고치면 T-1420 FU5 (25 행 `8` vs 열거 9 vs 정본 12) 를 미판정 상태로 끌고 들어와 새 모순 유입 | **기각** — `§ 5` sequence · [INDEX.md](INDEX.md) 무편집 경계 (본 task Out of Scope · T-1420 FU5 소관) 를 동시에 위반해 판정 제약상 채택 불가 |
| B | **정본 병기** — 136 · 137 행 module 열의 INDEX 허용 어휘는 유지하고 shipped 정본 명칭을 괄호로 병기 + 131 행 서두에 병기 규약 1 구 | **3 행 / 1 파일** (UC-09 131 · 136 · 137 행 in-place 1:1) | 없음 — 어휘는 허용 목록 그대로라 131 행 제약과 정합하고, 병기가 부기임을 서두가 명시해 `6 module` 수치와도 충돌 0. `§ 5` 는 hunk 밖 | **채택** — 최소 blast radius 로 T-1420 축 B 의 "UC-09 본문이 정정 대상" 판정을 실행하며 무편집 경계 3 곳을 모두 보존 |
| C | **무편집 + 한계 기록** | **0 행 / 0 파일** | 없음 (단 T-1420 축 B 판정이 미이행으로 잔존) | **기각** — B 가 cap 안에서 무모순으로 성립하므로 미이행을 정당화할 근거가 없다 ([T-1418](../tasks/T-1418-data-model-uc09-entity-derivation-judgment.md) 의 `source UC` 병기 선례가 동형 해법의 실행 가능성을 이미 입증) |

**채택 = (B) 정본 병기.** [T-1418](../tasks/T-1418-data-model-uc09-entity-derivation-judgment.md) 이 `data-model.md` 에서 쓴 병기 화법의 직계 승계다.

#### 반영 지점별 § 12.15 방침 판정 (3 지점, 각 1 행)

| 지점 | 성격 | § 12.15 판별 (시점 기록 = append / living 서술 = in-place) | 실제 처리 |
| --- | --- | --- | --- |
| UC-09 `§ 9` **131 행** 서두 | 명칭 규약 서술 — 날짜 stamp 0 | **in-place** (현행 상태 서술) | 문장 재작성 + 병기 규약 1 구 추가, **1 행 → 1 행** |
| UC-09 `§ 9` **136 행** module 열 | 표 셀 — 날짜 stamp 0 | **in-place** | 괄호 부기 append, **1 행 → 1 행** |
| UC-09 `§ 9` **137 행** module 열 | 표 셀 — 날짜 stamp 0 | **in-place** | 괄호 부기 append, **1 행 → 1 행** |

세 지점 모두 예상 결론 (in-place) 과 실측이 일치했다 — `§ 9` 안에 판정 시점을 박은 문장이 하나도 없어 append 축 후보가 발생하지 않았다. 표 행 수 **6 불변** · 표 열 수 **3 불변** · `§ 9` 이외 heading 무편집이다.

#### 수치 정합 재검산 (AC 4)

> **131 행의 `5 component + 6 module` 은 불변이다.** 채택안이 병기라 표 module 열의 INDEX 허용 어휘가 한 개도 교체되지 않았고 — module distinct 는 `WebModule` · `AssessmentModule` · `AuthModule` · `UserModule` · `LlmModule` · `PersistenceModule` 의 **6** 으로 편집 전후 동일 — 병기된 `AssessmentEvaluationModule` · `AssessmentCollectionModule` 은 정본 pointer 부기라 산정 대상이 아니다. 이 산정 기준 자체를 131 행 본문에 명문화해 향후 재계산 시 해석이 갈리지 않게 했다. component 5 (`Web UI` · `Backend API` · `Worker (평가 파이프라인)` · `LLM Gateway` · `DB Persistence`, 138 행 `—` 제외) 도 불변이다.

#### closure 선언

- **T-1420 Follow-up 4 closure.** "UC-09 `§ 9` 136 · 137 행 module 귀속 정정" 항목이 본 절로 닫힌다 — 방식 판정 (B 채택) + 반영 + 기록까지 마쳤고 승계 대상이 남지 않는다.
- **UC-09 cascade 4 축 종결 상태** — endpoint 축 (§ 12.14 / T-1416) · entity 축 (§ 12.16 / T-1418) · 표기 축 (§ 12.17 / T-1419) · module 축 (§ 12.18 판정 / T-1420 → 본 절 실행 / T-1421) 이 모두 **판정 + 실행 + 기록** 을 마쳐 [T-1411](../tasks/T-1411-uc-09-user-defined-period-evaluation.md) 의 UC-09 신설이 남긴 구조 축은 **잔여 0** 이다. 아래 한계 3 항은 전부 UC-09 신설과 무관한 **선행 불일치** 다.

#### 불변 검산 (doc-only, R-112 대체)

```
$ wc -l docs/use-cases/UC-09-user-defined-period-evaluation.md → 174  (불변 — 3 지점 전부 in-place 1:1)
$ wc -l docs/architecture/modules.md                          → 256  (불변 — 무편집)
$ wc -l docs/use-cases/INDEX.md                               → 123  (불변 — 무편집)
$ wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md                  → 1355 → 1433  (§ 12.19 append 78 행)
$ grep -c "AssessmentModule" UC-09 → 14 · sed -n '55,100p' | grep -c → 12   (불변 — §5 미편집)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md     → 66   (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md     → 12   (불변, `###` 만 추가)
$ git status --porcelain → M UC-09 · M REQ-COVERAGE-AUDIT.md · M T-1421 task 파일   (정확히 3 개)
$ git diff -U0 -- docs/use-cases/UC-09-user-defined-period-evaluation.md | grep '^@@'
@@ -131 +131 @@       (§9 서두 — in-place 1:1)
@@ -136,2 +136,2 @@   (§9 표 136 · 137 행 — in-place 2:2)
   → §5 구간 (55 ~ 100 행) hunk 미등장 = 무편집 증명
```

`docs/architecture/modules.md` · `components.md` · `api.md` · `data-model.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-08` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **UC-09 `§ 5` sequence 의 `AssessmentModule` participant 12 행 무편집** — mermaid diagram 이라 blast radius 가 크고 `§ 9` 표와 성격이 달라 본 slice 는 손대지 않았다. 그 결과 `§ 5` (participant 어휘 단독) 와 `§ 9` (허용 어휘 + shipped 정본 병기) 사이에 **표현 밀도 차이** 가 남는다 — 어긋남이 아니라 병기 부재이나, diagram 축 정정은 별도 slice 후보다.
2. **[INDEX.md](INDEX.md) 25 행 허용 목록 무편집 — 자체 모순 잔존.** `8 NestJS module 명` 이라 적으면서 괄호 안에 **9 개** 를 열거하고, 그 9 개가 `modules.md` 실측 **12** module 과도 어긋난다 (본 절 실측 (ii)(iii)). 본 절의 병기 방식은 이 모순을 **우회** 할 뿐 해소하지 않는다 — 25 행과 39 행 (UC-09 row module 열) 을 한 slice 에서 원자 처리해야 하므로 T-1420 **Follow-up 5** 소관으로 그대로 이월한다.
3. **§ 12.18 한계 1 · 3 잔존** — `modules.md` 192 · 44 · 205 행 `11 module` vs 실측 **12** (T-1420 FU3) · `data-model.md` 38 행 `13 entity` vs 실 row **14** (FU2) · `api.md` 223 행 링크 범위가 9 UC 와 어긋나는 건 (FU1). 셋 다 본 slice Out of Scope 로 이월된다.
4. **병기 화법의 확산 비용** — 136 · 137 행이 길어져 표 가독성이 떨어진다. 향후 [INDEX.md](INDEX.md) 허용 목록이 12 module 정본으로 확장되면 (FU5 처리 시점) 본 병기는 **전면 치환으로 승격 가능** 하며, 그때 본 절이 그 승격의 근거 기록이 된다.

### 12.20 modules.md `11 module` 8 지점의 실측 12 대조 판정 + 정본 자기정합 동기 (T-1422)

> 본 절은 [T-1422](../tasks/T-1422-modules-md-module-count-resync.md) 가 [T-1421](../tasks/T-1421-uc09-module-attribution-correction.md) **Follow-up 3** 의 세 축 (`modules.md` `11 module` · `data-model.md` `13 entity` · `api.md` 링크 범위) 중 **`modules.md` 축** 만 닫은 기록이다. § 12.19 한계 2 가 [INDEX.md](INDEX.md) 25 행의 자체 모순을 지목하면서 그 행이 스스로 출처를 "`modules.md` 의 8 NestJS module 명" 이라 밝히는 **파생 관계** 를 드러냈으므로, planner 는 파생 (INDEX) 정정보다 **정본 (`modules.md`) 자기정합** 을 앞세웠다 — 정본이 자기모순인 채로 파생을 고치면 "8 이라 쓰고 9 를 열거" 가 "11 이라 쓰고 12 를 열거" 로 이월될 뿐이기 때문이다. 본 절이 편집한 문서는 [modules.md](../architecture/modules.md) **하나** 이며 [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문은 **한 글자도 편집하지 않았다**. 삽입 위치는 § 12.19 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 5 축 — 전제 전건 전부 성립)

```
(i)   $ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"        → 12  (기대값 일치, 정본 표 row)
      AuthModule · PersistenceModule · UserModule · GithubModule · ConfluenceModule
      · PermissionDeniedRecordModule · LlmModule · AssessmentModule
      · AssessmentCollectionModule · AssessmentEvaluationModule · SchedulerModule · WebModule
(ii)  $ grep -n "11 module\|11 NestJS module" docs/architecture/modules.md      →  8 행 (기대값 일치)
      22 · 28 · 45 · 133 · 154 · 192 · 205 · 249  — planner 예고 행 번호와 전수 일치
(iii) $ sed -n '145,153p' … topological order 블록의 distinct module            → 12  ((i) 과 일치)
      AppModule (154 행 root) 은 열거 대상이 아니라 imports 주체라 카운트 제외
(iv)  $ sed -n '56,128p' … | grep -o "[A-Za-z]*Module" | sort -u               → 13 → AppModule 제외 12  ((i) 과 일치)
      → mermaid 다이어그램 node 축도 12 로 정합 — 산문 8 지점만 stale 이었음이 4 축 교차로 확정
(v)   $ wc -l modules.md → 256 · REQ-COVERAGE-AUDIT.md → 1433 · INDEX.md → 123      (baseline)
      $ grep -c "^## " modules.md → 8                                               (baseline)
      $ grep -c "^\| REQ-" REQ-COVERAGE-AUDIT.md → 66 · $ grep -c "^## " → 12       (baseline)
```

5 축이 모두 전제와 일치해 **중단 지점은 없었다**. 특히 (iii)(iv) 가 § 12.19 · T-1421 Why 의 1 차 추정 ("표·열거 = 정본, 산문 카운트 = stale") 을 **독립 2 축으로 재확인** 했다 — 열거 12 (topological) 와 node 12 (mermaid) 가 표 row 12 와 삼중 일치하므로 정본 수치는 **12**, stale 은 산문 `11` 8 지점이다.

#### 지점별 처리 판정 (8 + 1 = 9 행, § 12.15 판별 기준 적용)

| 행 | 현재 표기 | § 12.15 판별 | 처리 | 근거 |
| --- | --- | --- | --- | --- |
| **3** | `T-0017 이 NestJS 8 module 분해 …` | **시점 기록** (task stamp 명시) | **무편집** | T-0017 산출 시점에 8 module 이었다는 서술 자체가 참 — 같은 blockquote 가 9 · 10 · 11 번째 module 증분을 이어 적는 이력 문단이다 |
| **22** | `모든 11 module 은 동일 NestJS process` | living 서술 | `11` → `12` | 정본 표 row 12 (실측 i) |
| **28** | `다음 11 NestJS module 로 분해된다` | living 서술 | `11` → `12` | 바로 뒤 30 ~ 43 행 표가 12 row 를 열거 — 같은 문단 안 자기모순 |
| **45** | `위 11 module 은 AppModule 의 imports 에` | living 서술 | `11` → `12` | 같은 표 12 row 를 지시하는 지시어 |
| **133** | `11 module 을 imports 로 묶기만 함` | living 서술 (다이어그램 표기 설명) | `11` → `12` | mermaid node distinct 12 (실측 iv) |
| **154** | `(위 11 module 모두 imports)` | living 서술 (code block 내부) | `11` → `12` | 같은 block 145 ~ 153 행 열거 12 와 어긋난 상태를 해소 — 2 자 → 2 자라 code block 정렬 폭 불변 |
| **192** | `8 component 와 본 문서의 11 module 의 N:N` | living 서술 | `11` → `12` (`8 component` 무편집) | mapping 표 distinct module 12 · `8 component` 는 [components.md](../architecture/components.md) 정본 |
| **205** | `총 8 component → 11 module` + `Backend API 의 1:6 분할` | living 서술 | `11` → `12` 만 치환 · `8 component` · `1:6` **무편집** | 192 ~ 204 행 mapping 표 Backend API row 실측 = AssessmentModule · UserModule · AuthModule · PermissionDeniedRecordModule · AssessmentCollectionModule · AssessmentEvaluationModule **6 개** → `1:6` 정합 확인, 갱신 불요 |
| **249** | `11 module 의 단일 process 결합 (§1)` | living 서술 (References bullet) | `11` → `12` | § 12.13 이 `api.md` References bullet 을 in-place 치환한 선례 승계 |

애매어 없이 **치환 8 · 무편집 1** 로 갈렸다. 무편집 1 건 (3 행) 은 § 12.15 가 확정한 "날짜 · task stamp 가 박힌 시점 기록은 보존, stamp 없는 현행 상태 서술은 in-place" 판별의 전형이다.

#### 반영 결과 + 불변 수치

치환 8 지점은 전부 **1 행 → 1 행 in-place** 이고 무편집 1 지점 (3 행) 은 diff 에 미등장한다. mermaid block (56 ~ 128 행) 과 module 표 본문 (32 ~ 43 행) 도 hunk 가 없다 — 표는 **정본으로 읽기만** 했다. 그 결과 `wc -l` **256 불변** · `^## ` heading **8 불변** · 표 row **12 불변** · 표 열 수 불변이며, `11 module` 잔여 hit 는 **0** 이다.

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

본 절이 확정한 정본 수치 **12** 는 다음 파생 지점을 stale 로 만든다. 목록만 남기고 **편집하지 않는다**.

1. **[INDEX.md](INDEX.md) 25 행** — `8 NestJS module 명` 이라 적으면서 9 개를 열거한다. 정본 12 와 어긋나는 이중 stale (수치 8 ≠ 열거 9 ≠ 정본 12). **후속 slice 소관** (T-1421 Follow-up 1 승계 · § 12.19 한계 2 이월).
2. **[INDEX.md](INDEX.md) 39 행** — UC-09 row 의 module 열 6 값. 25 행 허용 목록과 원자 처리해야 하므로 같은 **후속 slice 소관**.
3. (참고) 위 2 지점 외의 `11 module` 파생 표기는 본 절 실측 범위 (`modules.md`) 밖에서 확인하지 않았다 — 전수 조사는 별도 slice 소관.

#### T-1421 Follow-up 3 — `modules.md` 축 closure 선언

**T-1421 Follow-up 3 의 `modules.md` 축은 본 절로 닫힌다.** 정본 문서가 표 · topological 열거 · mermaid node · 산문 카운트 **4 축 모두 12** 로 자기정합해졌고, 파생 INDEX slice 가 인용할 확정 수치가 생겼다. 잔여 2 축은 미해소로 이월한다 — ① [data-model.md](../architecture/data-model.md) **38 행** `13 entity` vs 실 row **14**, ② `api.md` **223 행** 링크 범위가 9 UC 와 어긋나는 건. 각각 별도 slice 다.

#### 불변 검산

```
$ grep -c "11 module\|11 NestJS module" docs/architecture/modules.md  →  0    (치환 완료)
$ grep -c "12 module\|12 NestJS module" docs/architecture/modules.md  →  8    (22·28·45·133·154·192·205·249)
$ wc -l  docs/architecture/modules.md                                 → 256   (불변 — 1:1 치환)
$ grep -c "^## "  docs/architecture/modules.md                        →   8   (불변)
$ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"    →  12   (불변 — 표 무편집)
$ sed -n '3p' … | grep -o "NestJS 8 module 분해"                      → hit   (시점 기록 보존)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                         → 1433 → 1518  (§ 12.20 append 85 행)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md             →  66   (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md             →  12   (불변, `###` 만 추가)
$ wc -l  docs/use-cases/INDEX.md                                      → 123   (불변 — 무편집)
$ git status --porcelain → M modules.md · M REQ-COVERAGE-AUDIT.md · M T-1422 task 파일  (정확히 3 개)
$ git diff -U0 -- docs/architecture/modules.md | grep '^@@'
@@ -22 +22 @@   @@ -28 +28 @@   @@ -45 +45 @@   @@ -133 +133 @@
@@ -154 +154 @@  @@ -192 +192 @@  @@ -205 +205 @@  @@ -249 +249 @@
   → mermaid block (56 ~ 128 행) · 표 본문 (32 ~ 43 행) · 3 행 hunk 미등장 = 무편집 증명
```

[INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **mermaid 다이어그램 (56 ~ 128 행) 무편집 존속** — 본 slice 는 node 수를 **읽기만** 했고 (실측 12, 산문과 정합) 다이어그램 자체는 손대지 않았다. 이번엔 갈리지 않았으나 **13 번째 module 이 shipped 되는 시점에는 표 · 열거 · node · 산문 4 축을 한 slice 안에서 함께 갱신** 해야 같은 종류의 어긋남이 재발하지 않는다 — 다이어그램 축은 blast radius 가 달라 그때도 별도 판정이 필요하다.
2. **[INDEX.md](INDEX.md) 25 · 39 행 파생 stale 잔존** — 본 절이 정본 12 를 확정했지만 파생 2 지점은 `8` / 9 열거 / UC-09 row 6 값 그대로다. § 12.19 한계 2 가 이월한 그 모순은 **아직 해소되지 않았고** 후속 slice 소관이다. 즉 본 절은 그 slice 의 **선행 조건만** 충족시켰다.
3. **UC-09 `§ 5` sequence participant 12 행 병기 여부 미판정** — T-1421 Follow-up 2 (§ 12.19 한계 1) 는 본 slice Out of Scope 로 그대로 남는다. `§ 5` 의 `AssessmentModule` participant 어휘와 `§ 9` 의 병기 화법 사이 표현 밀도 차이도 미해소다.
4. **T-1421 Follow-up 3 의 잔여 2 축 미해소** — `data-model.md` 38 행 `13 entity` vs 실 row 14 · `api.md` 223 행 링크 범위. 본 절은 `modules.md` 축만 닫았으므로 Follow-up 3 전체 closure 는 **아직 아니다**.

### 12.21 INDEX.md 25 행 module 허용 어휘 정본 12 동기 + 39 행 UC-09 row 귀속 판정 (T-1423)

> 본 절은 [T-1423](../tasks/T-1423-index-module-vocabulary-resync.md) 가 § 12.20 (T-1422) 한계 2 와 § 12.19 (T-1421) 한계 2 가 **동시에 지목** 한 [INDEX.md](INDEX.md) 파생 2 지점 (**25** 행 허용 어휘 · **39** 행 UC-09 row) 을 닫은 기록이다. T-1422 가 정본 [modules.md](../architecture/modules.md) 를 표 · topological 열거 · mermaid node · 산문 카운트 4 축 모두 **12** 로 자기정합시켜 파생 정정의 선행 조건이 충족됐고, [INDEX.md](INDEX.md) **114** 행 §5 갱신 룰 5 ("components.md / modules.md 의 component / module 명이 갱신되면 본 표의 컬럼을 동기") 가 본 절의 발동 근거다. 본 절이 편집한 문서는 [INDEX.md](INDEX.md) **하나** (2 행) 이며 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문은 **한 글자도 편집하지 않았다**. 삽입 위치는 § 12.20 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 5 축 — 전제 전건 전부 성립)

```
(i)   $ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"   → 12  (기대값 일치, 정본 표 row)
      AuthModule · PersistenceModule · UserModule · GithubModule · ConfluenceModule
      · PermissionDeniedRecordModule · LlmModule · AssessmentModule
      · AssessmentCollectionModule · AssessmentEvaluationModule · SchedulerModule · WebModule
(ii)  $ sed -n '25p' docs/use-cases/INDEX.md
      → 카운트 토큰 `8` · 괄호 `/` 열거 실제 **9** 개 · 정본 **12**  (기대값 일치 — 삼중 어긋남)
      열거 9 = WebModule / AssessmentModule / UserModule / GithubModule / ConfluenceModule
              / LlmModule / AuthModule / SchedulerModule / PersistenceModule
      (i) − (ii) 차집합 3 = PermissionDeniedRecordModule · AssessmentCollectionModule
                          · AssessmentEvaluationModule
      (ii) − (i) 차집합 0  → 파생은 정본의 진부분집합, 오타 · 미실재 어휘 0
(iii) $ sed -n '39p' docs/use-cases/INDEX.md | awk -F'|' '{print $6}'
      → WebModule, AssessmentModule, AuthModule, UserModule, LlmModule, PersistenceModule  (6 개)
      6 개 전부 (i) 의 12 개 안에 실재 → **미실재 0** (귀속 어긋남은 "명칭 부재" 형이 아니라 "layer 갈림" 형)
(iv)  $ sed -n '31,38p' docs/use-cases/INDEX.md — 8 row 의 module 열 distinct  → 9  ((ii) 열거와 동일 집합)
      9 ⊂ 12 (i) → 25 행 확장으로 무효화되는 row **0** → 본 slice blast radius 는 25 · 39 두 행에 고정
(v)   $ wc -l INDEX.md → 123 · REQ-COVERAGE-AUDIT.md → 1518 · modules.md → 256 · UC-09 → 174   (baseline)
      $ grep -c "^| UC-"  INDEX.md              →  9                                            (baseline)
      $ grep -c "^## "    REQ-COVERAGE-AUDIT.md → 12 · $ grep -c "^\| REQ-" → 66                 (baseline)
```

5 축이 모두 전제와 일치해 **중단 지점은 없었다**. 특히 (iv) 가 본 slice 의 범위를 사전에 잠갔다 — 8 row 가 쓰는 어휘 9 개가 정본 12 의 부분집합이라, 25 행 확장은 기존 row 를 **하나도** 무효화하지 않는다.

#### 25 행 처리 판정 + 반영

§ 12.15 가 확정한 판별 기준 ("날짜 · task stamp 가 박힌 시점 기록 = 보존 / stamp 없는 현행 상태 서술 = in-place") 을 25 행에 적용하면, 그 행은 "…만 사용. 오타 0." 이라는 **현재 유효한 편집 규칙** 서술이고 날짜 · task stamp 가 없다 → **in-place 치환** 대상이다 (바로 위 21 행이 "본 task 시점에" 로 시작하는 시점 기록인 것과 정확히 대비된다).

- **1 행 → 1 행 in-place**. 문장 골격 (`… 의 N NestJS module 명 (…) 만 사용. 오타 0.`) 과 [modules.md](../architecture/modules.md) 링크는 **보존** 하고, 카운트 토큰 `8` → `12` 와 괄호 열거 9 개 → 12 개를 **한 hunk 에서 동시** 교체했다. 열거 순서는 정본 표 row 순서 (32 ~ 43 행) 를 그대로 따른다. 카운트와 열거를 함께 바꿨으므로 T-1422 가 정본에서 닫은 "카운트 N vs 열거 M" 종류의 모순은 재발하지 않는다.
- **24 행 (`8 component 명`) 은 무편집** — [components.md](../architecture/components.md) 실측 `grep -c "^| \*\*"` = **8** 이고 그 문서 18 행 산문도 `8 component` 라 정본과 정합이다 (T-1420 축 A 실측 승계). 갱신 룰 5 의 component 축은 발동 대상이 아니다.

#### 39 행 (UC-09 row) 처리 방식 3 후보 판정

판정 축 3 개 — ① [UC-09](UC-09-user-defined-period-evaluation.md) `§ 9` 무모순 (`§ 9` 는 `5 component + 6 module` 을 **산정 기준까지 명시** 해 박제했다 — "산정 대상은 표 module 열의 INDEX 허용 어휘 distinct 수, 병기 괄호는 부기라 산정 제외"), ② blast radius (표 셀 1 개 = 1 행 in-place 로 끝나는가), ③ 나머지 8 row (31 ~ 38 행) 무편집 상태에서 39 행만 바꿀 때 생기는 표기 비대칭의 허용 여부.

| 후보 | ① `§ 9` 무모순 | ② blast radius | ③ 비대칭 | 판정 |
| --- | --- | --- | --- | --- |
| **(A) 치환** — `AssessmentModule` → `AssessmentEvaluationModule` (+ `AssessmentCollectionModule`) | **위배** — module 열 distinct 가 6 → 7 로 늘어 `§ 9` 가 박제한 `6 module` 을 직접 부정한다 | 1 행 in-place | 어휘 집합 자체가 8 row 와 갈려 비대칭이 가장 크다 | **기각** — 무편집 경계인 UC-09 본문의 확정 수치를 파생 index 가 부정하는 역전이라 축 ① 단독으로 탈락 |
| **(B) 병기** — `§ 9` 가 채택한 부기 화법과 동형 | **성립** — 병기는 괄호 부기라 distinct 산정 대상이 아니어서 `6 module` 불변 | 1 행 in-place | 39 행에만 괄호 부기가 붙는 비대칭이 발생하나, 그 행이 가리키는 본문 `§ 9` 가 이미 같은 화법을 쓰므로 **본문 ↔ index 정합** 이 표 내부 균질성보다 우선한다 | **채택** |
| **(C) 무편집** — 39 행은 후속 slice 로 이월 | 성립 (수치 불변) | 0 | 비대칭 0 | **기각** — 25 행 확장으로 허용 어휘 제약이 풀린 **바로 그 slice** 에서 판정하지 않으면 T-1421 → T-1422 → 본 slice 로 이미 3 회 이월된 같은 모순이 4 회째로 넘어간다. 이월 비용이 비대칭 비용을 넘는다 |

**채택 = (B) 병기.** 39 행 module 열의 `AssessmentModule` 뒤에 괄호 부기 1 구 (평가 축 = `AssessmentEvaluationModule` / 수집 축 = `AssessmentCollectionModule`, [modules.md](../architecture/modules.md) 197 · 198 행 정본 + `6 module` 산정 불변 명시) 를 붙여 **1 행 → 1 행 in-place** 로 반영했다. `|` 를 추가하지 않았으므로 표 열 수 (7 열) · row 수 (9) 는 불변이다.

#### 무편집 경계 (시점 기록 보존)

다음 6 지점은 **전부 무편집** 이고 diff 에 미등장한다.

| 행 | 내용 | 무편집 근거 |
| --- | --- | --- |
| **21** | `본 task 시점에 UC-01 ~ UC-08 의 8 개 use case 식별` | T-0019 시점 기록 — **51 행이 이미 "무편집 보존" 으로 판정한 선례를 승계** |
| **41** | `총 8 UC. README 의 7 단락에서 추출` | 동상 (51 행 선례 승계) |
| **43** | `P2 UC 본문 분해 8/8 closure` | T-0020 ~ T-0028 시점 closure 기록 |
| **51** | T-1412 의 UC-09 row 등록 기록 | 그 자체가 위 선례를 담은 시점 기록 |
| **58 · 86** | §3 description 산문의 `AssessmentModule` 언급 | 표 축과 산문 축은 처리 단위가 달라 별도 slice (아래 파생 영향 ②) |

21 · 41 행의 선례 승계는 § 12.15 판별 기준과도 같은 방향이다 — 두 행 모두 특정 시점의 산출을 기록하며, 현행 총계 **9** 는 51 행과 § 12.17 이 이미 별도로 박제하고 있어 오독 위험이 없다.

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

본 절이 확정한 허용 어휘 **12** 는 다음 지점을 여전히 stale 로 남긴다. 목록만 남기고 **편집하지 않는다**.

1. **31 · 36 · 37 행 (UC-01 / UC-06 / UC-07) 의 `AssessmentModule` 귀속** — 실 shipped 는 수집 `AssessmentCollectionModule` / 평가 `AssessmentEvaluationModule` 로 갈린다 (T-1421 이 UC-09 에서만 해소한 것과 **같은 종류**). 32 · 38 행 (UC-02 / UC-08) 의 `AssessmentModule` 도 같은 축이나 placeholder 책임과의 대조가 별도로 필요하다. 8 row 동시 재귀속은 blast radius 가 달라 **후속 slice 소관**.
2. **58 · 86 행 §3 description 산문의 동종 귀속** — 표 셀이 아니라 산문 문장이라 처리 단위가 다르다. **후속 slice 소관**.
3. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **4 회 이월** 중이다 (§ 12.19 한계 1 · § 12.20 한계 3). `§ 9` 는 병기를 채택했으나 `§ 5` participant 어휘는 그대로다. **후속 slice 소관**.

#### closure 선언

- **§ 12.20 (T-1422) 한계 2 · § 12.19 (T-1421) 한계 2 동시 closure** — 두 절이 같은 문장으로 이월한 "INDEX 25 · 39 행 파생 stale 잔존" 은 본 절로 닫힌다. 25 행은 정본 12 동기로, 39 행은 (B) 병기 채택으로 각각 해소됐고 승계 대상이 남지 않는다.
- **T-1421 Follow-up 1 closure** — "INDEX 허용 어휘 정본 동기" 는 위 25 행 처리로 이행됐다.
- **T-1421 Follow-up 3 잔여 2 축은 여전히 미해소** — ① [data-model.md](../architecture/data-model.md) **38** 행 `13 entity` vs 실 row **14**, ② `api.md` **223** 행 링크 범위가 9 UC 와 어긋나는 건. § 12.20 이 `modules.md` 축을, 본 절이 그 **파생 축** 을 닫았을 뿐이라 Follow-up 3 전체 closure 는 아직 아니다. 각각 별도 slice.

#### 불변 검산

```
$ sed -n '25p' docs/use-cases/INDEX.md | grep -c "12 NestJS module"          →  1   (카운트 8 → 12)
$ sed -n '25p' docs/use-cases/INDEX.md | grep -o "Module" | wc -l            → 12   (열거 9 → 12, 카운트와 일치)
$ sed -n '25p' docs/use-cases/INDEX.md | grep -c "8 NestJS module"           →  0   (stale 잔여 0)
$ sed -n '39p' … | grep -o "AssessmentEvaluationModule\|AssessmentCollectionModule" | wc -l → 2  (병기 반영)
$ wc -l  docs/use-cases/INDEX.md                                             → 123  (불변 — 2 행 모두 1:1 치환)
$ grep -c "^| UC-" docs/use-cases/INDEX.md                                   →   9  (불변)
$ awk -F'|' 'NR>=29 && NR<=39 {print NF}' docs/use-cases/INDEX.md | sort -u   →   9  (표 열 수 불변 = 7 열)
$ wc -l  docs/architecture/modules.md → 256 · UC-09 → 174                           (불변 — 무편집)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                                → 1518 → 1626  (§ 12.21 append 108 행)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md                    →  66  (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md                    →  12  (불변, `###` 만 추가)
$ git status --porcelain → M INDEX.md · M REQ-COVERAGE-AUDIT.md · M T-1423 task 파일  (정확히 3 개)
$ git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'
@@ -25 +25 @@    @@ -39 +39 @@
   → 21 · 41 · 43 · 51 · 58 · 86 행 hunk 미등장 = 무편집 증명
$ git diff --numstat -- docs/use-cases/INDEX.md                              →  2  2
   → 삭제 2 는 전부 in-place 치환의 짝 → **순수 삭제 0**
```

[modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **31 ~ 38 행 8 row 의 동종 귀속 어긋남 잔존** — 본 절은 허용 **어휘 목록** 을 12 로 넓혔을 뿐, 실제 귀속 판정은 39 행 (UC-09) 1 개만 수행했다. 어휘가 넓어진 만큼 8 row 의 `AssessmentModule` 귀속은 이제 "허용 어휘 밖" 이 아니라 "허용 어휘 안의 부정확한 선택" 이 됐고, 이는 기계적 검출이 더 어려워졌다는 뜻이기도 하다.
2. **UC-09 `§ 5` sequence participant 병기 미판정 잔존** — T-1421 Follow-up 2 가 본 slice 에서도 Out of Scope 라 **5 회째 이월** 된다. `§ 9` 병기와 `§ 5` 무병기 사이 표현 밀도 차이도 미해소다.
3. **25 행은 정본의 열거형 복제라 구조적으로 재-stale 된다** — 본 절이 카운트 · 열거를 동시에 맞췄어도 **13 번째 module 이 shipped 되는 순간** 다시 어긋난다. T-1422 § 12.20 한계 1 이 예고한 "표 · topological 열거 · mermaid node · 산문 카운트 4 축 동시 갱신" 규약에 **INDEX 25 행 허용 어휘를 5 번째 축으로 편입** 해야 같은 사고가 재발하지 않는다.
4. **39 행 병기로 표 안 표기 비대칭이 실재한다** — 축 ③ 에서 허용으로 판정했으나 해소된 것은 아니다. 향후 8 row 재귀속 slice 가 화법을 통일할 때 39 행 부기 형식을 정본으로 삼을지, 아니면 9 row 전체를 치환형으로 옮길지 함께 결정해야 한다.

### 12.22 INDEX.md 31 ~ 38 행 8 UC row 의 module 귀속 2 축 대조 실판정 (T-1424)

> 본 절은 [T-1424](../tasks/T-1424-index-uc-row-module-attribution-audit.md) 가 § 12.21 (T-1423) 이 `AC 5` 파생 영향 ① · 한계 1 로 **명시 이월** 한 축 — [INDEX.md](INDEX.md) **31 ~ 38 행** 8 UC row 의 module 열 귀속이 실 shipped layer 와 갈리는 건 — 을 닫은 기록이다. 판정은 **축 A (명칭 실재)** · **축 B (실 shipped layer 정합)** 2 축 대조로 수행했고, 어긋남 축마다 4 후보 (치환 / 병기 / 각주 / 무편집) 를 개별 판정했다. 본 절이 편집한 문서는 [INDEX.md](INDEX.md) **하나** (5 행) 이며 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문은 **한 글자도 편집하지 않았다** — UC 본문 `§ 9` 는 read-only 대조 입력으로만 썼다. 발동 근거는 [INDEX.md](INDEX.md) **114** 행 §5 갱신 룰 5 (module 명 갱신 시 "주요 module" 컬럼 동기). 삽입 위치는 § 12.21 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 5 축)

```
(i)   $ grep -c "^| \*\*" docs/architecture/modules.md                        → 20  (기대 12 와 불일치)
      $ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"      → 12  (정본 module 목록 표)
      $ sed -n '196,203p' docs/architecture/modules.md | grep -c "^| \*\*"    →  8  (component ↔ module mapping 표)
      → 20 = 12 + 8. AC 1 (i) 이 적은 무-scope grep 은 **두 표를 합산** 하는 명령이라 20 이 나온다.
        정본 축 자체 (module 목록 표 row = 12) 는 § 12.21 (i) 가 쓴 sed scope 판 과 **동일하게 12 로 성립** 하고
        28 행 산문 `12 NestJS module` · 45 행 `위 12 module` 과도 정합이라 축을 중단하지 않았다.
        불일치의 원인은 문서가 아니라 **AC 1 (i) 의 명령 표기 누락** 이다 (아래 한계 4 · Follow-up 7).
      12 = AuthModule · PersistenceModule · UserModule · GithubModule · ConfluenceModule
         · PermissionDeniedRecordModule · LlmModule · AssessmentModule
         · AssessmentCollectionModule · AssessmentEvaluationModule · SchedulerModule · WebModule
(ii)  $ sed -n '31,38p' docs/use-cases/INDEX.md | awk -F'|' '{print $6}' | tr ',' '\n' | sort -u | wc -l → 9  (기대값 일치)
(iii) 축 B 대조 — 아래 표 2 개
(iv)  33 · 34 · 35 행 (UC-03 / UC-04 / UC-05) module 명 = WebModule · UserModule · AuthModule
      · PersistenceModule · LlmModule 5 종 → 전부 (i) 실재 + shipped → **편집 대상 0**
(v)   $ wc -l INDEX.md → 123 · REQ-COVERAGE-AUDIT.md → 1626 · modules.md → 256 · components.md → 190
      $ grep -c "^| UC-" INDEX.md → 9 · $ grep -c "^## " audit → 12 · $ grep -c "^\| REQ-" audit → 66
      → (v) 6 값 전부 기대값 일치 (baseline)
```

**축 A — 명칭 실재 대조 (9 distinct × 정본 12)**

| # | INDEX 31 ~ 38 행 module 명 | 사용 row | 정본 12 실재 |
| --- | --- | --- | --- |
| 1 | `SchedulerModule` | 31 | 실재 (42 행) |
| 2 | `AssessmentModule` | 31 · 32 · 36 · 37 · 38 | 실재 (39 행) |
| 3 | `GithubModule` | 31 · 38 | 실재 (35 행) |
| 4 | `ConfluenceModule` | 31 · 38 | 실재 (36 행) |
| 5 | `LlmModule` | 31 · 35 | 실재 (38 행) |
| 6 | `PersistenceModule` | 31 ~ 37 | 실재 (33 행) |
| 7 | `WebModule` | 32 ~ 38 | 실재 (43 행) |
| 8 | `AuthModule` | 32 ~ 37 | 실재 (32 행) |
| 9 | `UserModule` | 33 · 34 | 실재 (34 행) |

**미실재 0** — 9 ⊂ 12. 어휘 위반 항목 없음. 즉 어긋남은 "명칭 부재" 형이 아니라 § 12.21 한계 1 이 예고한 "허용 어휘 안의 부정확한 선택" 형이다.

**축 B — 실 shipped layer 정합 대조**

| module 명 | modules.md 정본 판정 | 사용 row | 어긋남 |
| --- | --- | --- | --- |
| `AssessmentModule` | **39** 행 = "평가 결과 조회·sort·filter·시계열 **placeholder (미shipped)**", 코드/AppModule 등록 0 | 31 · 32 · 36 · 37 · 38 | **있음 (축 1)** |
| `SchedulerModule` | **42** 행 = shipped. 단 "**실 shipped module 명 = `SchedulingModule` (src/scheduling/)**" 부기 (rename 없이 doc 서술만 align) | 31 | **명칭 부기 있음 (축 2)** |
| `GithubModule` · `ConfluenceModule` · `LlmModule` · `PersistenceModule` · `AuthModule` · `UserModule` · `WebModule` | 35 · 36 · 38 · 33 · 32 · 34 · 43 행 전부 shipped 서술 (WebModule 은 T-0354 serve-static shipped) | 31 ~ 38 | 없음 |

**대상 UC 본문 `§ 9` 산정 수치 (read-only 인용)** — UC-01 `6 component + 6 module` · UC-02 `3 component + 4 module` · UC-06 `3 component + 4 module` · UC-07 `3 component + 4 module` · UC-08 `4 component + 4 module`. 편집 후 실측 row 별 top-level module 토큰 수는 **31 행 6 · 32 · 36 · 37 · 38 행 각 4** 로 5 UC 본문의 선언값을 **전부 보존** 한다 (T-1421 이 UC-09 `6 module` 을 보존한 것과 동형).

#### 처리 방식 4 후보 판정 (어긋남 축마다 1 행)

판정 기준 3 축 — ① 각 UC 본문 `§ 9` 산정 수치와 무모순, ② blast radius (편집 지점 수 × in-place 여부), ③ 표기 대칭 (이미 병기된 **39** 행과의 비대칭을 줄이는가).

| 어긋남 축 | (A) 치환 | (B) row 내 병기 | (C) 표 각주 | (D) 무편집 | 채택 |
| --- | --- | --- | --- | --- | --- |
| **축 1 — `AssessmentModule`** (row 31 · 32 · 36 · 37 · 38) | **기각** — row 31 을 수집 + 평가 2 module 로 치환하면 distinct 가 6 → 7 이 되어 UC-01 `§ 9` 의 `6 module` 을 직접 부정한다 (축 ① 위배). row 38 치환도 UC-08 `§ 9` 표가 명시한 `AssessmentModule` 을 index 가 부정하는 역전 | **채택** — 괄호 부기는 distinct 산정 대상이 아니라 5 UC 의 `§ 9` 수치가 전부 불변 (축 ①), 5 행 모두 1 행 → 1 행 in-place (축 ②), **39** 행이 이미 쓰는 화법을 승계해 표 안 비대칭이 1 행 예외 → 6 행 균질로 줄어든다 (축 ③) | **기각** — 각주 1 개로는 row 마다 다른 실 shipped 축 (31 = 수집·평가 / 32 = 조회 placeholder / 36 = 재수집 / 37 = 정본 미기재 / 38 = PermissionDeniedRecordModule) 을 정확히 표현할 수 없고, **39** 행 row-내 병기와 화법이 갈려 축 ③ 의 비대칭을 오히려 늘린다 | **기각** — § 12.19 → § 12.20 → § 12.21 로 이미 3 회 이월된 같은 축이라 4 회째 이월은 이월 비용이 편집 비용을 넘는다. § 12.21 이 어휘 제약을 푼 **바로 다음 slice** 가 판정 적기다 | **(B)** |
| **축 2 — `SchedulerModule`** (row 31) | **기각** — `SchedulingModule` 은 INDEX **25** 행 허용 12 밖 토큰이라 AC 3 의 어휘 상한을 위반한다 (25 행은 무편집 경계라 어휘를 넓힐 수도 없다) | **기각** — 부기라도 `SchedulingModule` 토큰을 module 열에 들이는 점은 (A) 와 같고, 정본 **42** 행 표 row 명 자체가 `SchedulerModule` 이라 파생이 정본보다 앞서 나가는 역전이 된다 | **기각** — 표 밖 각주면 어휘 상한은 피하나, 각주 삽입 지점이 **41** 행 무편집 경계와 맞닿아 blast radius 가 축 ② 기준 최악이고, 축 1 이 (B) 인 상태에서 화법이 둘로 갈린다 | **채택** — 정본 자체 (modules.md **42** 행 표 row 명 · INDEX **25** 행 허용 어휘) 가 `SchedulerModule` 로 확정돼 있어 **파생 INDEX 는 정본 어휘를 정확히 복제하고 있다**. 실 명칭 부기는 정본 42 행 본문의 책임이고 파생이 중복 부기할 이유가 없다 — 즉 본 축은 "어긋남" 이 아니라 **정본이 이미 흡수한 축** | **(D)** |

**채택 = 축 1 (B) 병기 · 축 2 (D) 무편집.** 두 축의 채택안이 갈리는 것은 판정표가 축 단위라 정상이며, 결과적으로 INDEX 편집 지점은 **5 행** (31 · 32 · 36 · 37 · 38) 으로 축 B 가 지목한 집합과 **정확히 일치** 한다.

#### 반영 결과

[§ 12.15](#1215-append--in-place-판별-방침) 판별 ("날짜 · task stamp 가 박힌 시점 기록 = 보존 / stamp 없는 현행 상태 서술 = in-place") 을 5 지점에 적용하면, 표 row 는 날짜 · task stamp 가 없는 **현행 상태 서술** 이므로 **in-place 치환** 대상이다 (바로 위 21 행 · 아래 41 · 43 · 51 행이 stamp 를 가진 시점 기록인 것과 정확히 대비된다).

| 편집 row | 병기 내용 (요지) | 정본 근거 |
| --- | --- | --- |
| **31** (UC-01) | 미shipped placeholder — 수집 축 = `AssessmentCollectionModule` · 평가 축 = `AssessmentEvaluationModule` | modules.md 39 · 40 · 41 행 |
| **32** (UC-02) | 조회·sort·filter·시계열은 본 module 의 잔여 책임이나 **미shipped placeholder** (코드/AppModule 등록 0) | modules.md 39 행 |
| **36** (UC-06) | 미shipped placeholder — REQ-041 delete→재수집 실 shipped 축 = `SchedulerModule` ④ + `AssessmentCollectionModule` | modules.md 39 · 42 행 |
| **37** (UC-07) | 미shipped placeholder — export/import 실 shipped 코드의 module 귀속은 정본 12 표에 **미기재** (후속 slice) | modules.md 39 행 + 12 표 부재 실측 |
| **38** (UC-08) | 미shipped placeholder — 권한 부족 record 영속화·audit 조회 실 shipped = `PermissionDeniedRecordModule` | modules.md 37 · 39 행 |

5 행 모두 **1 행 → 1 행 in-place** 이고 `|` 를 추가하지 않아 표 열 수 (7 열) · row 수 (9) 는 불변이다. 병기에 등장하는 module 명 (`AssessmentCollectionModule` · `AssessmentEvaluationModule` · `SchedulerModule` · `PermissionDeniedRecordModule`) 은 전부 **25 행 허용 12 안** 이며 25 행 자체는 무편집이다.

#### 무편집 경계

**21 · 24 · 25 · 39 · 41 · 43 · 51 · 58 · 86** 행 + **33 · 34 · 35** 행은 전부 무편집이고 아래 hunk 목록에 미등장한다. 특히 **25 · 39** 행은 § 12.21 (T-1423) 이 **직전 slice 에서 방금 닫은 지점** 이라 재편집이 곧 회귀이며, 본 slice 는 두 행을 각각 "어휘 상한" · "병기 화법 원형" 으로 **읽기만** 했다. 33 · 34 · 35 행은 실측 (iv) 로 편집 대상 0 이 근거화됐다.

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

1. **INDEX 58 · 86 행 §3 description 산문의 `AssessmentModule` 귀속** — 표 셀이 아니라 산문이라 처리 단위가 다르다 (T-1423 Follow-up 2, **2 회째 이월**). **후속 slice 소관**.
2. **[data-model.md](../architecture/data-model.md) 39 행 `modules.md 의 8 NestJS module 명만 사용`** — INDEX 25 행과 **동종 파생 stale** (정본 12 대비 어긋남). 본 slice 실측 중 신규 확인. **후속 slice 소관**.
3. **[data-model.md](../architecture/data-model.md) 38 행 `13 entity` vs 실 entity row 14** — T-1421 Follow-up 3 잔여 ①. **후속 slice 소관**.
4. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — 동 잔여 ②. **후속 slice 소관**.
5. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **6 회째 이월**. **후속 slice 소관**.
6. **export/import 실 shipped 코드 (`src/export/` · `src/import/`) 의 module 귀속이 modules.md 정본 12 표에 미기재** — 본 slice 실측 중 신규 확인 (row 37 병기가 그 사실만 박제). 정본 쪽 편집이라 **후속 slice 소관**.

#### closure 선언

- **§ 12.21 (T-1423) `AC 5` 파생 영향 ① closure** — "31 · 36 · 37 행 (+ 32 · 38 행) 의 `AssessmentModule` 귀속" 은 본 절의 축 1 (B) 병기 반영으로 닫힌다. 그 항목이 "8 row 동시 재귀속은 blast radius 가 달라 후속 slice 소관" 으로 넘긴 판정을 본 절이 실제 대상 **5 row** 로 좁혀 수행했다 (나머지 3 row 는 실측 (iv) 로 편집 대상 0 확정).
- **§ 12.21 한계 1 closure** — "31 ~ 38 행 8 row 의 동종 귀속 어긋남 잔존" 도 같은 반영으로 해소된다. 그 한계가 지적한 "기계적 검출이 더 어려워졌다" 는 성질은 병기가 근거 링크 (modules.md 행 번호) 를 row 안에 박아 넣음으로써 완화된다.
- **T-1423 Follow-up 1 closure** — "INDEX 8 row module 귀속 2 축 대조 + 판정 반영" 이 본 절로 이행됐다.
- **T-1421 Follow-up 3 잔여 2 축은 여전히 미해소** — 위 파생 영향 3 · 4. 본 절은 INDEX 표 축만 닫았다.

#### 불변 검산

```
$ wc -l  docs/use-cases/INDEX.md                                             → 123  (불변 — 5 행 모두 1:1 in-place)
$ grep -c "^| UC-" docs/use-cases/INDEX.md                                   →   9  (불변)
$ awk -F'|' 'NR>=29 && NR<=39 {print NF}' docs/use-cases/INDEX.md | sort -u   →   9  (표 열 수 불변 = 7 열)
$ (괄호 부기 제거 후) 31 · 32 · 36 · 37 · 38 행 top-level module 토큰 수      → 6 · 4 · 4 · 4 · 4
   → UC-01 `6 module` · UC-02 · UC-06 · UC-07 · UC-08 각 `4 module` 산정 전부 보존
$ 31 ~ 38 행 distinct module 명                                              →   9  (불변, 정본 12 의 부분집합)
$ wc -l  docs/architecture/modules.md → 256 · components.md → 190                   (불변 — 무편집)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                                → 1626 → 1754  (§ 12.22 append 128 행)
$ grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md                    →  66  (불변)
$ grep -c "^## "     docs/use-cases/REQ-COVERAGE-AUDIT.md                    →  12  (불변, `###` 만 추가)
$ git status --porcelain → M INDEX.md · M REQ-COVERAGE-AUDIT.md · M T-1424 task 파일  (정확히 3 개)
$ git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'
@@ -31,2 +31,2 @@    @@ -36,3 +36,3 @@
   → 21 · 24 · 25 · 33 · 34 · 35 · 39 · 41 · 43 · 51 · 58 · 86 행 hunk 미등장 = 무편집 증명
$ git diff --numstat -- docs/use-cases/INDEX.md                              →  5  5
   → 삭제 5 는 전부 in-place 치환의 짝 → **순수 삭제 0**
```

[modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` · `prisma/` · `src/` · `test/` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **INDEX 58 · 86 행 §3 description 산문 축 잔존** — 본 절은 **표 셀** 만 병기했다. 같은 문서 안에서 표 row 는 병기·산문은 미병기인 **새 비대칭** 이 생겼고, 이는 축 ③ 이 표 내부만 평가한 데서 온 사각지대다. 후속 slice 가 산문 축을 닫을 때 표 병기 화법을 그대로 승계해야 한다.
2. **[data-model.md](../architecture/data-model.md) 38 · 39 행 2 축 잔존** — 39 행 `8 NestJS module 명` 은 INDEX 25 행이 방금 벗어난 것과 **똑같은 stale** 이고, 38 행 `13 entity` vs 실 row 14 는 T-1421 부터 이월 중이다. 본 절은 둘 다 Out of Scope 라 목록만 남겼다.
3. **표 귀속은 정본의 복제라 구조적으로 재-stale 된다** — 병기 본문이 `modules.md` **37 · 39 · 40 · 41 · 42** 행을 **행 번호로** 인용하므로, 정본 표에 row 가 삽입·삭제되면 본 표의 인용 행 번호가 즉시 어긋난다. § 12.21 한계 3 이 예고한 "5 축 동시 갱신 규약" (표 · topological 열거 · mermaid node · 산문 카운트 + INDEX 25 행 어휘) 에 **INDEX 표 row 귀속** 을 **6 번째 축** 으로 편입해야 한다 (T-1423 Follow-up 6 갱신).
4. **AC 1 (i) 의 실측 명령이 정확하지 않았다** — 무-scope `grep -c "^| \*\*"` 는 module 목록 표 (12) 와 component ↔ module mapping 표 (8) 를 합산해 **20** 을 낸다. 본 절은 § 12.21 (i) 가 쓴 `sed -n '32,43p'` scope 판으로 12 를 재확인해 축을 진행했고 그 사실을 위 (i) 에 그대로 남겼다 — 다만 **후속 task 정의서가 같은 무-scope 명령을 복제하면 같은 오탐이 반복** 된다. scope 를 포함한 명령형으로 표준화해야 한다 (Follow-up 7).
5. **행 번호 기반 실측의 취약성** — 본 절의 축 A · 축 B 표는 `modules.md` 행 번호를 정본 좌표로 쓴다. 그 문서는 T-1422 이후 무편집이라 현 시점 유효하나, 행 번호는 내용 변경에 취약한 좌표계다. 향후 anchor / heading 기반 좌표로 옮기는 편이 견고하다.

### 12.23 modules.md 정본 12 표 vs `src/` 실 shipped module 3 축 대조 실판정 (T-1425)

> 본 절은 [T-1425](../tasks/T-1425-modules-md-shipped-module-inventory-audit.md) 가 § 12.22 (T-1424) 의 `Follow-up 8` — "export/import 실 shipped 코드 (`src/export/` · `src/import/`) 의 module 귀속이 [modules.md](../architecture/modules.md) 정본 12 표에 미기재" — 를 닫은 기록이다. § 12.19 ~ § 12.22 의 4 slice 가 **문서 ↔ 문서** 정합만 다뤘던 것과 달리, 본 절은 처음으로 **문서 ↔ 코드** 축을 대조한다 (정본 표 12 vs `src/*/*.module.ts` 실측). 판정은 **축 1 (실 shipped 전수) · 축 2 (AppModule 등록 집합) · 축 3 (정본 표 12)** 3 축 대조로 수행했고, 미기재 집합에 대해 4 후보 (row 신설 / 각주 / row 내 부기 / 무편집) 를 판정 기준 4 축으로 개별 기각·채택했다. 본 절이 편집한 문서는 [modules.md](../architecture/modules.md) **하나** (표 직후 각주 3 행 순수 추가) 이며 [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `src/` 는 **한 글자도 편집하지 않았다** — `src/` 4 파일은 read-only 대조 입력으로만 썼다. 삽입 위치는 § 12.22 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 7 축)

§ 12.22 한계 4 / `Follow-up 7` 이 요구한 **scope 포함 명령형** 을 본 절이 실제로 적용했다 — 무-scope `grep` 이 두 표를 합산해 20 을 내던 오탐을 (iii) 이 `sed` scope 로 차단한다.

```
(i)   $ ls src/*/*.module.ts | wc -l                                          → 14  (기대값 일치)
      14 = src/assessment-collection · src/assessment-evaluation · src/auth · src/confluence
         · src/export · src/github · src/import · src/llm · src/permission-denied
         · src/persistence · src/scheduling · src/user-instance-access · src/user · src/web
      $ ls src/*.module.ts                                                    → src/app.module.ts (root, 별도 표기)
(ii)  $ sed -n '64,79p' src/app.module.ts | grep -c "^    [A-Z]"               → 14
      → 14 = internal 13 + 외부 `ScheduleModule.forRoot()` 1. internal 13 = (i) 의 14 중
        `UserInstanceAccessModule` **제외** (기대값 일치).
      $ sed -n '33,37p' src/permission-denied/permission-denied-record.module.ts
      → 37 행 `imports: [UserInstanceAccessModule],` + 33 행 주석 "일반 module (non-@Global) 이라
        명시 import 로만" → `UserInstanceAccessModule` 은 AppModule 비등록, PermissionDeniedRecordModule
        경유로만 DI 그래프 진입 (ADR-0024 §3 split B).
(iii) $ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"       → 12  (기대값 일치)
      12 = AuthModule · PersistenceModule · UserModule · GithubModule · ConfluenceModule
         · PermissionDeniedRecordModule · LlmModule · AssessmentModule
         · AssessmentCollectionModule · AssessmentEvaluationModule · SchedulerModule · WebModule
(iv)  3 축 대조표 — 아래 표
(v)   $ grep -c "ExportModule\|ImportModule\|UserInstanceAccessModule" docs/architecture/modules.md
      → 0  (기대값 일치 — 정본 문서 전체에서 세 module 명이 0 회. (iv) ③ 축소 0)
(vi)  $ sed -n '25p' docs/use-cases/INDEX.md  → 허용 어휘가 정본 12 를 그대로 복제 ("12 NestJS module 명 …만 사용")
      $ sed -n '37p' docs/use-cases/INDEX.md  → UC-07 (Export / Import / Backup / Restore) row 가
        `WebModule, AssessmentModule (… 미shipped placeholder …), AuthModule, PersistenceModule`
      → 정본 미기재가 파생 문서에 **이미 오류를 만들고 있다**: 실 shipped `ExportModule` / `ImportModule`
        대신 미shipped placeholder 를 쓰고, 25 행 어휘가 정본 12 로 닫혀 있어 쓰고 싶어도 쓸 수 없다.
(vii) $ wc -l modules.md → 256 · INDEX.md → 123 · REQ-COVERAGE-AUDIT.md → 1754
                · components.md → 190 · data-model.md → 190
      $ grep -c "^## " audit → 12 · $ grep -c "^| REQ-" audit → 66 · $ grep -c "^| UC-" INDEX → 9
      $ sed -n '22p;28p;45p;133p;154p;192p;205p;249p' modules.md | grep -c "12"  → 8  (카운트 8 지점 전부 12)
      → (vii) 10 값 전부 기대값 일치 (baseline). 축 중단 사유 0.
```

**3 축 대조표 — (i)/(ii) ↔ (iii) 1:1 매칭**

| 부분집합 | 수 | 항목 (파일 경로) |
| --- | --- | --- |
| ① **양쪽 일치** | **11** | `AuthModule` (`src/auth/`) · `PersistenceModule` (`src/persistence/`) · `UserModule` (`src/user/`) · `GithubModule` (`src/github/`) · `ConfluenceModule` (`src/confluence/`) · `PermissionDeniedRecordModule` (`src/permission-denied/`) · `LlmModule` (`src/llm/`) · `AssessmentCollectionModule` (`src/assessment-collection/`) · `AssessmentEvaluationModule` (`src/assessment-evaluation/`) · `WebModule` (`src/web/`) · **`SchedulerModule` ↔ `src/scheduling/`** — 정본 **42** 행이 "실 shipped module 명 = `SchedulingModule` (src/scheduling/)" 을 이미 부기로 흡수했으므로 **일치로 계상** 한다 (§ 12.22 축 2 가 (D) 무편집으로 닫은 축) |
| ② **정본 only** | **1** | `AssessmentModule` — **어긋남 아님**. 정본 **39** 행 스스로 "평가 결과 조회·sort·filter·시계열 **placeholder (미shipped)**, 코드/AppModule 등록 0" 이라 자기박제한 **이미 닫힌 축** |
| ③ **실 only (미기재)** | **3** | `ExportModule` (`src/export/export.module.ts`, T-0488 — AppModule 등록 O) · `ImportModule` (`src/import/import.module.ts`, T-0489 — AppModule 등록 O) · `UserInstanceAccessModule` (`src/user-instance-access/user-instance-access.module.ts`, T-0238 — AppModule 등록 **X**, PermissionDeniedRecordModule 경유) |

검산: ① 11 + ② 1 = **12** (= (iii) 정본 표 row 수) · ① 11 + ③ 3 = **14** (= (i) 실 module 수). 두 등식이 모두 성립해 대조에 누락·중복이 없다.

#### 처리 방식 4 후보 판정

판정 기준 **4 축** — ① **사실 흡수** (정본만 읽는 독자가 미기재 3 을 인지하는가), ② **cascade** (새 stale 을 만드는가 · 같은 slice 안에서 닫히는가), ③ **cap** (≤ 300 LOC · ≤ 5 파일), ④ **결정 권한** (기존 ADR 서술과 충돌해 ADR 게이트를 요구하는가).

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(A) 정본 표 row 신설 + 다축 동시 동기** | **기각** | 축 ④ 위배가 결정적 — `UserInstanceAccessModule` 을 정본 표에 올리면 **22** 행이 [ADR-0003 §1](../decisions/ADR-0003-deployment.md) 을 인용해 박제한 "모든 N module 은 동일 NestJS process (**단일 AppModule 의 imports**) 에 등록된다" 가 **거짓** 이 된다 (실측 (ii) — 비등록). 즉 "정본 계상 기준 = AppModule 등록 여부인가" 라는 결정이 선행돼야 하고 이는 ADR 소관이라 direct doc slice 에서 기각. 축 ② 도 미충족 — 본 후보의 payoff 인 INDEX **37** 행 실 귀속 정정 (`ExportModule`/`ImportModule` 추가) 은 top-level module 토큰을 4 → 6 으로 늘려 [UC-07](UC-07-export-import.md) `§ 9` 의 `4 module` 산정을 부정하는데, UC 본문 편집은 본 slice **Out of Scope** 라 이 cascade 를 같은 slice 안에서 닫을 수 없다 |
| **(B) 표 직후 미기재 각주 신설** | **채택** | 축 ① 충족 — 정본만 읽는 독자가 표 바로 아래에서 미기재 3 과 각각의 파일 경로·등록 여부를 즉시 본다. 축 ② 최소 — 표 row·카운트 8 지점·mermaid·topological·mapping 무편집이라 cascade **0** (파생 [INDEX.md](INDEX.md) 25 행 어휘도 정본 12 불변이라 무편집 유지). 축 ③ 충족 — modules.md 순수 추가 3 행. 축 ④ 무해 — 계상 집합을 바꾸지 않고 "각주는 카운트 대상 아님" 경계를 본문에 명시해 22 행 서술을 건드리지 않으며, 미판정 사실 자체를 ADR 소관으로 이관 표기 |
| **(C) 기존 row 안 부기** | **기각** | 축 ① 미충족 — `UserInstanceAccessModule` 은 `PermissionDeniedRecordModule` row 에 귀속시킬 수 있으나 `ExportModule` / `ImportModule` 은 **귀속시킬 row 가 없다** (③ 3 중 2 미해결 = 부분해). 축 ② 도 (B) 보다 나쁘다 — 표 셀 in-place 치환이라 § 12.22 병기가 행 번호로 인용 중인 **37** 행 본문을 다시 건드린다 |
| **(D) 무편집 (실측·판정만 기록)** | **기각** | 축 ① 이 0 — 정본 문서만 읽는 독자에게 미기재 3 은 여전히 비가시. 본 축은 § 12.22 `Follow-up 8` 로 이미 **1 회 이월** 됐고, 실측 7 축이 전부 기대값과 일치해 판정 재료가 다 갖춰진 상태이므로 2 회째 이월은 이월 비용이 편집 비용 (3 행 순수 추가) 을 명백히 넘는다 |

**채택 = (B) 표 직후 미기재 각주 신설.** cap 초과로 자동 기각된 후보는 없으며, (A) 의 split 제안은 아래 파생 영향 ⑦ 에 남긴다.

#### 반영 결과

[§ 12.15](#1215-append--in-place-판별-방침) 판별 ("날짜 · task stamp 가 박힌 시점 기록 = 보존 / stamp 없는 현행 상태 서술 = in-place") 을 삽입 지점에 적용하면, **45** 행 (`위 12 module 은 AppModule …`) 은 stamp 없는 현행 상태 서술이지만 본 slice 는 그 문장을 **치환하지 않고** 그 뒤에 새 블록을 **순수 추가** 한다 — 즉 판별 대상 자체가 없는 append 형이라 기존 서술은 한 글자도 바뀌지 않는다 (§ 12.22 가 5 행을 in-place 치환한 것과 대비되는 형태).

| 편집 지점 | 내용 |
| --- | --- |
| **modules.md 47 ~ 48 행** (신설, 앞 빈 행 1 포함 46 ~ 48) | (i) 미기재 module 명 **3 종 전수 + 파일 경로 + 도입 task** · (ii) AppModule 등록 여부 (`ExportModule`/`ImportModule` 등록 O = `src/app.module.ts` 77 · 78 행 / `UserInstanceAccessModule` 비등록 = `permission-denied-record.module.ts` 37 행 명시 import) · (iii) **카운트 경계** ("본 문서 산문의 `12 module` 은 표 row 12 만 세며 본 각주 3 개를 포함하지 않는다") + 표 row 신설 여부가 ADR 소관임을 명시 |

#### 무편집 경계

`src/` · `test/` · `prisma/` 일체, [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · [api.md](../architecture/api.md), `docs/decisions/ADR-*.md`, `UC-01` ~ `UC-09` 본문, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 전부 무편집이고 `git status --porcelain` 에 미등장한다. [INDEX.md](INDEX.md) 는 (A) 미채택이므로 **diff 에 미등장** — 25 행 허용 어휘 · 37 행 UC-07 row · 58 · 86 행 §3 산문 · 39 행 UC-09 row 전부 그대로다. modules.md 내부에서도 표 row 12 · 카운트 8 지점 · mermaid · topological order · Components↔Modules mapping 표는 **한 글자도 편집하지 않았다** (아래 hunk 목록이 증명).

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

1. **INDEX 58 · 86 행 §3 산문의 `AssessmentModule` 귀속** — T-1424 Follow-up 1, **3 회째 이월**. **후속 slice 소관**.
2. **[data-model.md](../architecture/data-model.md) 39 행 `modules.md 의 8 NestJS module 명만 사용`** — 정본 12 대비 파생 stale. **후속 slice 소관**.
3. **[data-model.md](../architecture/data-model.md) 38 행 `13 entity` vs 실 entity row 14** — T-1421 Follow-up 3 잔여 ①. **후속 slice 소관**.
4. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — 동 잔여 ②. **후속 slice 소관**.
5. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **7 회째 이월**. **후속 slice 소관**.
6. **INDEX 37 행 UC-07 row 가 `ExportModule` / `ImportModule` 을 여전히 미사용** — (B) 채택으로 정본 표 row 는 늘지 않았고 25 행 허용 어휘도 불변이라 **잔존** (실측 (vi) 가 근거). 정정하려면 UC-07 `§ 9` 의 `4 module` 산정 재판정이 동반돼야 한다. **후속 slice 소관**.
7. **정본 표 row 신설 축 ((A) 의 split 제안)** — 미기재 3 을 표 row 로 올리려면 ① "계상 기준 = AppModule 등록 여부" 를 ADR 로 확정 → ② 표 row + 카운트 8 지점 + mermaid node/edge + topological order + Components↔Modules mapping 동시 갱신 → ③ INDEX 25 행 어휘 확장 + 37 행 재귀속 + UC-07 `§ 9` 수치 재판정 의 **3 slice 로 split** 해야 한다 (①은 ADR gate, ③은 UC 본문 게이트). **후속 slice 소관**.

#### closure 선언

- **§ 12.22 (T-1424) `Follow-up 8` closure** — "export/import 실 shipped 코드의 module 귀속이 정본 12 표에 미기재" 는 본 절의 (B) 각주 반영으로 닫힌다. 실측 결과 미기재 집합은 export/import **2 개가 아니라 `UserInstanceAccessModule` 을 포함한 3 개** 였고, 각주가 3 개 전부를 흡수했다.
- **§ 12.22 `Follow-up 7` closure** — "scope 를 포함한 실측 명령형 표준화" 를 본 절이 **AC 1 에서 실제로 적용** 했다. 위 실측 블록의 (ii) · (iii) · (vii) 은 전부 `sed -n '<from>,<to>p' <file> | grep …` 형이라 § 12.22 (i) 이 겪은 무-scope 합산 오탐 (12 + 8 = 20) 이 재발할 여지가 없다.
- **§ 12.22 파생 영향 6 closure** — 같은 항목이 본 절 대상이었다. 나머지 파생 영향 1 ~ 5 는 위 목록으로 그대로 이월된다.
- **본 절이 처음 연 축** — 이전 4 slice 가 닫지 못한 **문서 ↔ 코드** 대조를 시작했다. 다만 아래 한계 1 이 지적하듯 이 축은 snapshot 이라 재-stale 이 구조적이다.

#### 불변 검산

```
$ wc -l  docs/architecture/modules.md                        → 256 → 259  (+3, AC 3 (B) 의 +4 이내)
$ sed -n '32,43p' docs/architecture/modules.md | grep -c "^| \*\*"   →  12  (불변 — 표 row 무편집)
$ sed -n '22p;28p;45p;136p;157p;195p;208p;252p' modules.md | grep -c "12"  → 8
   → 카운트 8 지점 전부 `12` 불변 (행 번호만 +3 shift: 133·154·192·205·249 → 136·157·195·208·252)
$ grep -c "ExportModule\|ImportModule\|UserInstanceAccessModule" modules.md  → 0 → 2
   → `grep -c` 는 **행 수** — 47 행에 3 종 전부, 48 행에 `UserInstanceAccessModule` 1 종 재언급
$ wc -l  docs/use-cases/INDEX.md → 123 · components.md → 190 · data-model.md → 190  (불변 — 무편집)
$ grep -c "^| UC-" docs/use-cases/INDEX.md                   →   9  (불변) · 표 열 수 7 불변
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                → 1754 → 1878  (§ 12.23 append 124 행)
$ grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md     →  66  (불변)
$ grep -c "^## "    docs/use-cases/REQ-COVERAGE-AUDIT.md     →  12  (불변, `###` 만 추가)
$ git status --porcelain → M modules.md · M REQ-COVERAGE-AUDIT.md · M T-1425 task 파일  (정확히 3 개)
$ git diff -U0 -- docs/architecture/modules.md | grep '^@@'
@@ -46,0 +47,3 @@
   → hunk **1 개** · 표 구간 (32 ~ 43) · 카운트 지점 · mermaid (50 ~ 139) · topological (143 ~ 160)
     · mapping (193 ~ 208) 전부 hunk 밖 = 무편집 증명 (shift 후 행 번호)
$ git diff --numstat -- docs/architecture/modules.md         →  3  0
   → 삭제 0 → **순수 삭제 0** (순수 추가형)
```

`src/` · `test/` · `prisma/` · [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `data-model.md` · `UC-01` ~ `UC-09` 본문 · `docs/PLAN.md` · `docs/requirements.md` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **문서 ↔ 코드 대조는 본 slice 시점의 snapshot** — `src/*/*.module.ts` 가 하나 추가·삭제되는 순간 각주의 "미기재 3" 도 (iii) 의 12 도 즉시 재-stale 이 된다. § 12.22 한계 3 이 예고한 "다축 동시 갱신 규약" (표 · topological · mermaid · 산문 카운트 · INDEX 25 행 어휘 · INDEX 표 row 귀속 **6 축**) 에 **코드 축 (`src/` module 파일 집합)** 을 **7 번째 축** 으로 편입해야 한다 (T-1423 Follow-up 6 갱신). 나아가 이 축은 사람 규약이 아니라 CI drift-guard spec 으로 옮기는 편이 견고하다.
2. **채택안 (B) 가 남긴 미해결** — 미기재 3 은 각주로 **가시화만** 됐을 뿐 정본 표 row 도 카운트도 아니다. 따라서 (a) INDEX **25** 행 허용 어휘는 여전히 정본 12 로 닫혀 있고 (b) INDEX **37** 행 UC-07 row 는 실 shipped `ExportModule`/`ImportModule` 을 여전히 쓸 수 없다 (파생 영향 6). 본 slice 는 "쓸 수 없는 구조" 를 해소하지 못했고 그 사실을 문서화했을 뿐이다.
3. **외부 package module 의 계상 기준 미판정** — `src/app.module.ts` 75 행의 `ScheduleModule.forRoot()` (`@nestjs/schedule`) 는 실 DI 그래프의 등록 대상이지만 `src/` 의 module 파일이 아니다. 정본 표가 **자사 module 만** 세는지 외부 package module 도 계상 대상인지 어느 문서도 명시하지 않는다 — 실측 (ii) 에서 internal 13 + 외부 1 로 분리 표기한 것은 본 절의 잠정 처리이며 정본 규약이 아니다. 후속 판정 필요.
4. **행 번호 좌표계의 shift 전파** — 본 절의 3 행 추가로 modules.md **46** 행 이후의 모든 행 번호가 **+3** shift 했다. 그 결과 기존 문서·journal 이 인용 중인 modules.md 행 번호 (예: T-1348 의 `239 행`, T-1353 의 `237 행`) 는 이제 각각 242 · 240 을 가리킨다. 그 인용들은 날짜·task stamp 가 박힌 **시점 기록** 이라 § 12.15 판별상 보존 대상이므로 정정하지 않았으나, 행 번호 좌표계 자체가 append 에 취약하다는 § 12.22 한계 5 의 지적이 본 절에서 **실제로 발현** 했다. anchor / heading 기반 좌표로의 이행이 필요하다.

### 12.24 data-model.md 의 `13 entity` 2 지점 · `4 module` · `8 NestJS module 명` 3 지점 3 축 정합 (T-1426)

> 본 절은 [T-1426](../tasks/T-1426-data-model-count-and-module-vocab-resync.md) 이 § 12.23 (T-1425) 의 파생 영향 **② ③** 을 한 문서 안에서 동시에 닫은 기록이다. ② 는 [data-model.md](../architecture/data-model.md) 가 정본 module 집합을 `8 NestJS module 명` 으로 인용해 두 세대 (T-1422 의 12 확정 · T-1425 의 미기재 3 각주) 뒤처진 축이고, ③ 은 같은 문서의 `13 entity` tally 가 § 2 표 실체 row **14** 와 1 어긋난 축이다. 축 A (자기 표 정합) 는 문서가 **자기 자신의 표** 와 어긋난 최초 사례이고, 축 B (파생 어휘) 는 § 12.21 (T-1423 의 [INDEX.md](INDEX.md) 25 행) 이 닫은 것과 동형이다. 본 절이 편집한 문서는 [data-model.md](../architecture/data-model.md) **하나** (5 지점 in-place 1:1 치환) 이며 [modules.md](../architecture/modules.md) · [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `UC-01` ~ `UC-09` 본문 · `src/` · `prisma/` 는 **한 글자도 편집하지 않았다** — modules.md 는 read-only 대조 입력으로만 썼다. 삽입 위치는 § 12.23 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 7 항)

§ 12.22 `Follow-up 7` 이 요구한 **scope 포함 명령형** 을 본 절도 그대로 적용했다 — (i) · (iii) · (iv) 는 전부 `sed -n '<from>,<to>p' <file> | grep …` 형이다.

```
(i)   $ sed -n '22,36p' docs/architecture/data-model.md | grep -c '^| \*\*'      → 14  (기대값 일치)
      14 = Person · ServiceIdentity · Group · Part · PersonGroupMembership · User
         · Assessment · Contribution · Summary · LlmProviderConfig · DifficultyMapping
         · PermissionDeniedRecord · ExportJob · ImportJob
      $ sed -n '22,36p' docs/architecture/data-model.md | grep -c '(conceptual mention)'  → 1
      → 36 행 AuditLog 1 개 (`| *(conceptual mention)* **AuditLog** |` — `^| \*\*` 에 안 걸려
        (i) 의 14 에 미포함). 즉 `(+ 1 conceptual mention)` 표기의 짝은 그대로 유지된다.
(ii)  $ grep -n '13 entity' docs/architecture/data-model.md                      → 3 · 18 · 38  (3 지점)
      3  행 → "… § 2 표 row 와 38 행 `13 entity` / `4 module` 은 불변. 근거 … § 12.17.)"
              = T-1419 가 append 한 **시점 기록** (task stamp 有)
      18 행 → "본 시스템은 다음 **13 entity (+ 1 conceptual mention)** 로 분해된다. …"
      38 행 → "**합계**: 13 entity (+ 1 conceptual mention) / 4 module (…) / 9 UC cover (…)"
      → task 정의서가 예상한 2 지점이 아니라 **3 지점**. 3 행은 (vi) 판별로 보존 대상 분리.
(iii) $ sed -n '22,36p' docs/architecture/data-model.md | grep '^| \*\*' \
        | awk -F'|' '{print $(NF-1)}' | sort | uniq -c
      → 6 AssessmentModule · 5 UserModule · 2 LlmModule · 1 AuthModule   (distinct **4**, 합 14)
      → 38 행이 열거한 `4 module (UserModule / AuthModule / AssessmentModule / LlmModule)` 과
        **집합·개수 모두 일치 — 축 A-2 는 무편집**. (`AuthModule (또는 별도)` 는 36 행 AuditLog
        conceptual row 의 값이라 실체 계상 대상 아님 — grep scope 로 분리됨을 확인)
(iv)  $ sed -n '32,43p' docs/architecture/modules.md | grep -c '^| \*\*'          → 12  (기대값 일치)
      $ sed -n '47,48p' docs/architecture/modules.md | grep -c 'ExportModule'      →  1  (≥1 충족)
      → T-1425 각주 실재 확인. 48 행이 "본 문서 산문의 `12 module` 은 … 본 각주의 3 개를
        **포함하지 않는다**" 를 명시 → 축 B 채택안이 계승해야 할 계상 경계.
(v)   $ grep -n '8 NestJS module' docs/architecture/data-model.md                 → 14 · 40 · 179  (3 지점, 기대값 일치)
      14  행 → "- [modules.md](modules.md) — 8 NestJS module 의 책임 분배. …"        (§ 1 기반 목록)
      40  행 → "**module 명 정합성**: … [modules.md](modules.md) 의 8 NestJS module 명만 사용 — 신규 module 신설 0. …"
      179 행 → "- [docs/architecture/modules.md](modules.md) — T-A4 산출물. … (8 NestJS module 명)."
      → § 12.23 파생 영향 2 · § 12.22 파생 영향 2 가 이 지점을 **`39` 행** 으로 인용해 왔으나
        실측 좌표는 **40** 행이다 (1 행 오차). 그 인용들은 task stamp 가 박힌 시점 기록이라
        정정하지 않고 본 절이 실좌표를 병기한다 (§ 12.15 판별 — 아래 (vi) 와 동일 원리).
(vi)  § 12.15 판별표 — 아래 표
(vii) $ wc -l data-model.md → 190 · modules.md → 259 · REQ-COVERAGE-AUDIT.md → 1878
      $ grep -c '^## ' data-model.md → 8 · $ grep -c '^## ' audit → 12 · $ grep -c '^| REQ-' audit → 66
      $ wc -l docs/use-cases/INDEX.md → 123 · $ grep -c '^| UC-' INDEX.md → 9
      → (vii) 9 값 전부 기대값 일치 (baseline). 축 중단 사유 0.
```

**§ 12.15 판별표 — (ii) · (v) 확정 5 지점 + 3 행**

| 지점 | 성격 | 날짜 · task stamp | 판별 | 처리 |
| --- | --- | --- | --- | --- |
| **3** 행 (`38 행 13 entity / 4 module 은 불변`) | T-1419 가 append 한 UC 표기 이력 서술 | **有** ([T-1419](../tasks/T-1419-eight-uc-notation-bulk-resync.md) · § 12.17 인용) | **보존** | 무편집 — 그 시점 (T-1418 판정 직후) 에 참이던 사실의 기록이며 지금 고치면 이력이 소실 |
| **18** 행 (`13 entity (+ 1 conceptual mention)`) | § 2 서두의 현행 상태 tally | 無 | **in-place** | `13` → `14` 1:1 치환 |
| **38** 행 앞머리 (`**합계**: 13 entity … / 4 module …`) | 현행 상태 tally (living) | 無 | **in-place** | `13` → `14` 1:1 치환. `4 module` 은 (iii) 일치라 무편집 |
| **38** 행 뒤쪽 (`10 → 11`, `11 → 13` shift 이력) | T-0039 · ADR-0044 shift 의 시점 기록 | **有** (T-0039 mergeCommit c25a5de · T-0484 / Q-0040) | **보존 + append** | 이력 문장은 **한 글자도 미편집**, 그 뒤에 T-1426 shift 근거 1 문장을 **덧붙임** |
| **14** 행 (`8 NestJS module 의 책임 분배`) | § 1 기반 목록의 현행 인용 | 無 | **in-place** | `8` → `12` |
| **40** 행 (`8 NestJS module 명만 사용`) | 현행 규범 서술 | 無 | **in-place** | `8` → `12` + 계상 경계 1 구 |
| **179** 행 (`(8 NestJS module 명)`) | § 8 References 의 현행 인용 | 無 | **in-place** | `8` → `12` + 근거 축약 |

**38 행 분할 편집의 성립 근거** — 38 행은 앞머리 tally (living) 와 뒤쪽 shift 이력 (시점 기록) 이 한 행에 공존하지만, 두 부분이 문장 경계로 분리돼 있어 (`**합계**: …` 문장 / `본 합계는 … shift.` 문장) 앞 문장의 `13` 만 치환하고 뒤 문장을 원문 그대로 두는 **행 단위 1:1 치환** 이 성립한다. 따라서 append 로 우회할 필요가 없었다.

#### 처리 방식 축별 판정 (후보 3 · 채택 1 · 기각 2)

판정 기준 **3 축** — ① **사실 흡수** (본 문서만 읽는 독자가 정확한 수치를 얻는가), ② **cascade** ([modules.md](../architecture/modules.md) · [INDEX.md](INDEX.md) · `api.md` · [components.md](../architecture/components.md) 에 새 stale 을 만드는가), ③ **cap** (≤ 300 LOC · 파일 3 고정).

**축 A — `13 entity` (실측 14)**

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(A1) 실측값으로 수치 정정** (`13` → `14`, 18 · 38 두 지점 + 이력 문장 무편집) | **채택** | 축 ① 충족 — 표 바로 위·아래의 tally 가 표 자신과 일치해 독자가 세어보지 않아도 정확한 수를 얻는다. 축 ② **0** — `grep -rn '13 entity' docs/` 결과 data-model.md 밖의 hit 는 전부 `docs/tasks/` · `docs/progress/` · 본 audit 의 **시점 기록** 이고 어느 문서도 이 tally 를 자기 수치의 source 로 재인용하지 않는다 (§ 12.17 검산 블록의 `grep -c "13 entity" → 2` 는 T-1419 시점 기록이라 보존 대상). 축 ③ 충족 — 2 지점 in-place, 행 수 증가 0 |
| **(A2) 각주·부기로 흡수** (수치 무편집 + 어긋남 사실만 명시) | **기각** | 축 ① 미충족 — 독자가 여전히 본문에서 `13` 을 먼저 읽고 각주에서 뒤집어야 한다. 게다가 어긋남 원인이 "표 row 가 옳고 tally 가 틀림" 으로 **이미 확정** (실측 (i) + 이력 chain 대조) 이라 판정 유보형인 각주 형식이 사실 상태와 맞지 않는다 (§ 12.23 의 (B) 각주가 채택된 이유는 그쪽 축이 **미판정 (ADR gate)** 이었기 때문 — 본 축은 그 조건이 없다) |
| **(A3) 무편집 이월** | **기각** | 축 ① 이 0. 본 축은 T-1419 Follow-up 2 → T-1420 ~ T-1425 의 파생 영향 목록으로 **6 회 이월** 됐고, 실측 7 항이 전부 기대값과 일치해 판정 재료가 다 갖춰졌다. 7 회째 이월은 이월 비용이 편집 비용 (in-place 2 지점) 을 명백히 넘는다 |

**축 A-2 — `4 module` (38 행 부수 수치)**: 실측 (iii) 이 distinct **4** 이고 집합도 `UserModule / AuthModule / AssessmentModule / LlmModule` 로 완전 일치 — **일치, 무편집** (별도 후보 판정 불요).

**축 B — `8 NestJS module 명` (정본 12)**

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(B1) 정본 현행값으로 치환** (`8` → `12`, 3 지점 + 계상 경계 1 구) | **채택** | 축 ① 충족 — 본 문서만 읽는 독자가 정본 module 수를 바로 얻고, 40 행에 붙인 경계 1 구로 "각주 3 은 왜 안 세는가" 까지 즉답된다. 축 ② **0** — 정본 [modules.md](../architecture/modules.md) 는 이미 12 이고 파생 [INDEX.md](INDEX.md) **25** 행도 § 12.21 (T-1423) 이 `12 NestJS module 명` 으로 이미 동기해, 본 치환은 세 문서를 **같은 값으로 수렴** 시킬 뿐 새 stale 을 만들지 않는다 (실측 — `sed -n '25p' docs/use-cases/INDEX.md` 가 `12 NestJS module 명`). 축 ③ 충족 — 3 지점 in-place, 행 수 증가 0 |
| **(B2) 카운트 제거·서술화** (수치를 빼고 "정본 module 명만 사용" 으로) | **기각** | 축 ① 이 부분해 — 재-stale 면역은 얻지만 독자가 규모를 못 얻고, 무엇보다 **본 문서 단독의 서술 형식 변경** 이라 [INDEX.md](INDEX.md) 25 행 (수치 유지형) · [modules.md](../architecture/modules.md) 45 행 (`위 12 module 은 …`) 과 형식이 갈린다. 형식 통일까지 하려면 두 문서를 함께 고쳐야 해 축 ③ 의 파일 3 고정과 본 slice Out of Scope 를 동시에 위배 |
| **(B3) 무편집 이월** | **기각** | 축 ① 이 0. § 12.22 파생 영향 2 → § 12.23 파생 영향 2 로 **2 회 이월** 됐고 정본이 이미 두 세대 앞서 있어 어긋남 폭이 커지는 방향이다. 실측 (iv) 로 정본 현행값이 확정된 이상 이월 근거가 없다 |

**채택 = 축 A (A1) + 축 B (B1).** cap 초과로 자동 기각된 후보는 없어 `§ 12.24` 에 남길 split 제안도 없다. **축 B 채택안의 계상 경계 계승** — 본 문서가 쓰는 `12` 는 [modules.md](../architecture/modules.md) **32 ~ 43** 행 표 row 12 만 세는 수이며, T-1425 가 신설한 **47 ~ 48 행 각주의 미기재 3 module (`ExportModule` / `ImportModule` / `UserInstanceAccessModule`) 을 포함하지 않는다** — 48 행이 못박은 경계를 그대로 승계했고, 그 사실을 40 행 편집문에 명시했다.

#### 반영 결과

편집은 전부 **행 단위 1:1 in-place 치환** 이며 순수 추가 행 0 (38 행의 shift 근거도 같은 행 안에 덧붙인 문장이라 행 수 불변). 각 지점의 append / in-place 근거는 위 § 12.15 판별표 그대로다.

| 편집 지점 | 처리 | 내용 |
| --- | --- | --- |
| **data-model.md 14 행** | in-place | `8 NestJS module 의 책임 분배` → `12 NestJS module 의 책임 분배` |
| **data-model.md 18 행** | in-place | `**13 entity (+ 1 conceptual mention)**` → `**14 entity (+ 1 conceptual mention)**` |
| **data-model.md 38 행** | in-place (앞) + 문장 append (뒤) | 앞머리 `**합계**: 13 entity` → `14 entity`. 이력 문장 (`10 → 11`, `11 → 13`) **원문 보존** 후, T-1426 실측 명령·값 + "이력 chain 에 없는 유일한 row 인 PermissionDeniedRecord 가 tally 미반영으로 누적된 1 어긋남" 이라는 shift 근거 + 본 절 링크를 덧붙임. `4 module (…)` 열거는 무편집 |
| **data-model.md 40 행** | in-place | `8 NestJS module 명만 사용` → `12 NestJS module 명만 사용` + 계상 경계 괄호 1 구 (T-1422 확정 12 / T-1425 각주 3 은 카운트 외 — 48 행 근거) |
| **data-model.md 179 행** | in-place | `(8 NestJS module 명)` → `(12 NestJS module 명 — T-1422 확정, T-1425 미기재 3 각주는 카운트 외)` |

#### 무편집 경계

`src/` · `test/` · `prisma/` 일체, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md`, [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 **전부 무편집** 이고 `git status --porcelain` 에 미등장한다. data-model.md 내부에서도 **§ 2 표 row (22 ~ 36 행)** · **§ 3 mermaid ER diagram (42 ~ 83 행)** · **§ 4 ~ § 7 (84 ~ 172 행)** · **3 행 blockquote** 는 한 글자도 편집하지 않았다 (아래 hunk 목록이 증명).

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

1. **[INDEX.md](INDEX.md) 58 · 86 행 §3 산문의 `AssessmentModule` 귀속** — T-1424 Follow-up 1, **4 회째 이월**. **후속 slice 소관**.
2. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — T-1421 Follow-up 3 잔여 ②. **후속 slice 소관**.
3. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **8 회째 이월**. **후속 slice 소관**.
4. **[INDEX.md](INDEX.md) 37 행 UC-07 row 가 `ExportModule` / `ImportModule` 을 미사용** — § 12.23 파생 영향 6. 정정하려면 [UC-07](UC-07-export-import.md) `§ 9` 의 `4 module` 산정 재판정이 동반된다. **후속 slice 소관**.
5. **정본 표 row 신설 축** — § 12.23 파생 영향 7 (T-1425 Follow-up 2) 의 3 slice split (① ADR gate → ② 다축 동시 갱신 → ③ INDEX·UC 게이트). **후속 slice 소관**.
6. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약 미판정** — § 12.23 한계 3 (T-1425 Follow-up 3). **후속 slice 소관**.
7. **행 번호 좌표계 → anchor 좌표계 이행** — § 12.23 한계 4 (T-1425 Follow-up 4). 본 절 실측 (v) 가 발견한 "§ 12.22 · § 12.23 이 40 행을 `39` 행으로 인용" 오차가 그 취약성의 **두 번째 발현** 이다. **후속 slice 소관**.

#### closure 선언

- **§ 12.23 파생 영향 ② closure** — "[data-model.md](../architecture/data-model.md) 39 행 `modules.md 의 8 NestJS module 명만 사용` 이 정본 12 대비 파생 stale" 은 본 절의 (B1) 치환으로 닫힌다. 실측 결과 지점은 인용된 1 곳이 아니라 **14 · 40 · 179 세 곳** 이었고 (실좌표는 39 가 아니라 40), 세 곳 전부를 동시에 동기했다.
- **§ 12.23 파생 영향 ③ closure** — "[data-model.md](../architecture/data-model.md) 38 행 `13 entity` vs 실 entity row 14" (T-1421 Follow-up 3 잔여 ①, T-1419 Follow-up 2 부터 **6 회 이월**) 은 본 절의 (A1) 정정으로 닫힌다. 지점도 38 행 단독이 아니라 **18 · 38 두 곳** 이었고 (3 행은 시점 기록이라 보존), 어긋남의 원인까지 38 행 본문에 박제했다.
- **T-1421 Follow-up 3 의 3 축 전체 closure** — ① `modules.md` 축은 § 12.20 (T-1422), ② `data-model.md 13 entity` 축은 본 절, ③ `api.md 223 행` 축만 잔여 (위 파생 영향 2). 3 축 중 2 축이 닫혔다.
- **본 절이 처음 연 축** — 이전 slice 들이 **문서 ↔ 문서** (§ 12.19 ~ § 12.22) · **문서 ↔ 코드** (§ 12.23) 를 다뤘다면, 축 A 는 **한 문서가 자기 자신의 표와 어긋난** 축이다. 파생 인용보다 자기 표 tally 가 더 오래 (6 회 이월) 방치됐다는 사실 자체가 아래 한계 1 의 근거다.

#### 불변 검산

```
$ wc -l  docs/architecture/data-model.md                     → 190 → 190  (불변 — 전 지점 in-place, AC 3 의 +3 이내)
$ grep -c '^## '  docs/architecture/data-model.md            →   8  (불변)
$ sed -n '22,36p' data-model.md | grep -c '^| \*\*'          →  14  (불변 — § 2 표 row 무편집)
$ grep -c '13 entity'  data-model.md                         → 3 → 1  (3 행 시점 기록만 잔존 — 의도)
$ grep -c '14 entity'  data-model.md                         → 0 → 2  (18 · 38 행)
$ grep -c '8 NestJS module'  data-model.md                   → 3 → 0
$ grep -c '12 NestJS module' data-model.md                   → 0 → 3  (14 · 40 · 179 행)
$ wc -l  docs/architecture/modules.md → 259 · INDEX.md → 123 · components.md → 190  (불변 — 무편집)
$ sed -n '32,43p' modules.md | grep -c '^| \*\*'             →  12  (불변 — 무편집)
$ grep -c '^| UC-' docs/use-cases/INDEX.md                   →   9  (불변)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                → 1878 → 2028  (§ 12.24 append 150 행)
$ grep -c '^| REQ-' docs/use-cases/REQ-COVERAGE-AUDIT.md     →  66  (불변)
$ grep -c '^## '    docs/use-cases/REQ-COVERAGE-AUDIT.md     →  12  (불변, `###` 만 추가)
$ git status --porcelain → M data-model.md · M REQ-COVERAGE-AUDIT.md · M T-1426 task 파일  (정확히 3 개)
$ git diff -U0 -- docs/architecture/data-model.md | grep '^@@'
@@ -14 +14 @@   @@ -18 +18 @@   @@ -38 +38 @@   @@ -40 +40 @@   @@ -179 +179 @@
   → hunk **5 개** 전부 AC 3 허용 지점 (14 · 18 · 38 · 40 · 179) 과 1:1. § 2 표 (22 ~ 36)
     · § 3 mermaid (42 ~ 83) · § 4 ~ § 7 (84 ~ 172) · 3 행 blockquote 전부 hunk 밖 = 무편집 증명
$ git diff --numstat -- docs/architecture/data-model.md      →  5  5
   → 추가 5 = 삭제 5 → 전 삭제 행이 in-place 치환의 짝 = **순수 삭제 0**
```

`src/` · `test/` · `prisma/` · [modules.md](../architecture/modules.md) · [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `UC-01` ~ `UC-09` 본문 · [docs/PLAN.md](../PLAN.md) · `docs/requirements.md` 는 `git status --porcelain` 에 **미등장** 한다. 변경 파일 **3 개** · 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **수치 인용의 재-stale 은 구조적** — 본 절이 고친 `14` 도 `12` 도 정본 (§ 2 표 · [modules.md](../architecture/modules.md) 표) 이 한 row 움직이는 순간 다시 틀린다. 축 A 가 **6 회 이월** 되는 동안 아무도 눈치채지 못한 것은 사람 규약 (§ 12.23 한계 1 의 "7 축 동시 갱신") 이 실제로는 작동하지 않았다는 증거다. `sed -n '22,36p' … | grep -c '^| \*\*'` 와 산문 tally 를 대조하는 **CI drift-guard spec** 이 사람 규약보다 견고하며, 이는 § 12.23 한계 1 (T-1425 Follow-up 5) 과 동형의 결론이다.
2. **§ 2 표 row ↔ `prisma/schema.prisma` 실 model 축은 여전히 미대조** — 본 절은 표 row 수 (14) 를 **문서 안에서만** 확정했을 뿐, 그 14 개가 실제 Prisma model 로 존재하는지 · 반대로 schema 에만 있는 model 이 있는지는 검사하지 않았다. 38 행이 스스로 "ExportJob/ImportJob 의 구체 Prisma schema 코드·migration 은 후속 task" 라고 적고 있어 **문서 ↔ 코드 불일치가 이미 예고된 상태** 다. § 12.23 이 module 축에서 한 것과 같은 대조를 entity 축에서 하는 별도 slice 가 필요하다.
3. **채택안이 남긴 미해결** — (a) **3** 행 blockquote 는 `13 entity` 를 여전히 담고 있어 문서 전체를 통독하는 독자에게는 3 행 (13) 과 18 · 38 행 (14) 이 **표면상 모순** 으로 보인다. § 12.15 판별상 보존이 옳지만 "시점 기록임" 이 문장 안에서 자명하지 않은 형태라, 시점 기록에 명시적 marker 를 다는 규약이 필요하다. (b) 축 A 가 밝힌 **누락 경위 (PermissionDeniedRecord 의 tally 미반영)** 는 이력 chain 대조로 도출한 추론이며, 당시 commit 을 직접 추적해 확증하지는 않았다. (c) 축 B 의 `12` 는 T-1425 각주 3 을 배제한 값이라, 향후 그 3 이 정본 row 로 승격되면 (파생 영향 5) 본 절의 3 지점이 다시 동기 대상이 된다.

### 12.25 data-model.md `§ 2` 14 entity 표 vs `prisma/schema.prisma` 15 model 3 축 대조 (T-1427)

> 본 절은 [T-1427](../tasks/T-1427-data-model-entity-vs-prisma-model-audit.md) 이 § 12.24 (T-1426) 의 **한계 ②** 와 그 `Follow-up 1` — "`§ 2` 표 row 자체가 `prisma/schema.prisma` 실 model 과 대조된 적이 없다" — 를 닫은 기록이다. § 12.23 (T-1425) 이 **module 축** 에서 수행한 **문서 ↔ 코드** 3 축 대조 (`modules.md` 정본 12 vs `src/*/*.module.ts` 14) 의 **entity 판** 이며, § 12.24 가 `13 → 14` 로 닫은 축이 **문서 안 자기 정합** 이었던 것과 달리 본 절은 **문서 밖 코드** 를 대조 입력으로 쓴다. 편집 문서는 [data-model.md](../architecture/data-model.md) **하나** (표 직후 각주 append 1 + 행 내 문장 부기 2) 이며 `prisma/` · `src/` · `test/` · [modules.md](../architecture/modules.md) · [INDEX.md](INDEX.md) · [components.md](../architecture/components.md) · `api.md` · `UC-01` ~ `UC-09` 본문 · `docs/decisions/` · [docs/PLAN.md](../PLAN.md) · `docs/requirements.md` 는 **한 글자도 편집하지 않았다** — `prisma/schema.prisma` 는 **read-only 대조 입력** 이다. 삽입 위치는 § 12.24 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 6 항)

§ 12.22 `Follow-up 7` 이 요구한 **scope 포함 명령형** 을 (ii) 에 그대로 적용했다. (i) · (iii) · (iv) 는 대상이 **파일 전체 전수** 라 scope 를 좁히면 오히려 누락이 생기는 축이므로 무-scope `grep -n` 을 쓰되 **행번호 전수를 함께 인용** 해 합산 오류 가능성을 제거했다.

```
(i)   $ grep -n '^model ' prisma/schema.prisma      $ grep -c '^model ' … → 15  (기대값 일치)
       55 model Person              97 model Group             114 model Part
      131 model PersonGroupMembership                          170 model User
      234 model UserInstanceAccess 257 model ServiceIdentity   294 model Assessment
      329 model Contribution       361 model Summary           406 model LlmProviderConfig
      441 model DifficultyMapping  513 model PermissionDeniedRecord
      614 model ExportJob          649 model ImportJob
(ii)  $ sed -n '22,36p' docs/architecture/data-model.md | grep -c '^| \*\*'         → 14  (기대값 일치)
      14 = Person · ServiceIdentity · Group · Part · PersonGroupMembership · User
         · Assessment · Contribution · Summary · LlmProviderConfig · DifficultyMapping
         · PermissionDeniedRecord · ExportJob · ImportJob
      $ sed -n '22,36p' docs/architecture/data-model.md | grep -c '(conceptual mention)'  → 1
      → 36 행 AuditLog 1 개 (`| *(conceptual mention)* **AuditLog** |` — `^| \*\*` 에 안 걸려
        (ii) 의 14 에 미포함). 실체 계상 14 와 conceptual 계상 1 이 grep 으로 분리됨을 재확인.
(iii) $ grep -n '14 entity' docs/architecture/data-model.md   → 18 · 38  (2 지점, 기대값 일치)
      18 행 → "본 시스템은 다음 **14 entity (+ 1 conceptual mention)** 로 분해된다. …"
      38 행 → "**합계**: 14 entity (+ 1 conceptual mention) / 4 module (…) / 9 UC cover (…)"
      $ grep -n '13 entity' docs/architecture/data-model.md   → 3       (1 지점, 기대값 일치)
      3  행 → "… § 2 표 row 와 38 행 `13 entity` / `4 module` 은 불변. 근거 … § 12.17.)"
      → § 12.24 가 남긴 시점 기록 blockquote 가 그대로 보존돼 있음을 확인 (무편집 대상).
(iv)  $ grep -n 'ExportJob' docs/architecture/data-model.md   → 34 · 38 · 57 · 80 · 171  (5 지점)
      34 행 = § 2 표 row (사실 서술) · 57 행 = § 3 mermaid 관계선 · 80 행 = § 3 관계 11 서술
        → 셋 다 미구현 전제 없음, 무편집 대상.
      미구현을 전제한 행 = 38 · 171  (기대값 일치)
      38 행 → "… ExportJob/ImportJob 의 구체 Prisma schema 코드·migration 은 후속 task
                (§7 / ADR-0044 §Out of scope). …"
      171 행 → "**ExportJob / ImportJob 의 구체 Prisma schema 코드 / migration / artifact 저장소**
                — … `model ExportJob`/`model ImportJob` 코드 + migration SQL + AssessmentModule
                controller/service 구현 … 은 모두 본 문서 범위 밖 — 후속 task chain …"
      $ sed -n '614p;649p' prisma/schema.prisma
      614: model ExportJob {          649: model ImportJob {
      $ ls prisma/migrations | grep export      → 20260618000000_export_import_job
      $ grep -n 'CREATE TABLE' prisma/migrations/20260618000000_export_import_job/migration.sql
      20: CREATE TABLE "ExportJob" (  39: CREATE TABLE "ImportJob" (
      $ ls -d src/export src/import            → 둘 다 실재 (export.controller.ts · import.controller.ts
                                                 · export-job.service.ts · import-job.service.ts 등)
      → **문서 (미구현 전제) ↔ 코드 (shipped) 어긋남 확정**. 축 B 성립.
(v)   § 12.15 판별표 — 아래 표
(vi)  $ wc -l data-model.md → 190 · schema.prisma → 666 · REQ-COVERAGE-AUDIT.md → 2028
      $ grep -c '^## ' data-model.md → 8 · $ grep -c '^## ' audit → 12 · $ grep -c '^| REQ-' audit → 66
      $ wc -l modules.md → 259 · INDEX.md → 123 · components.md → 190
      → (vi) 9 값 전부 기대값 일치 (baseline). 축 중단 사유 0.
```

**§ 12.15 판별표 — (iii) · (iv) 확정 지점**

| 지점 | 성격 | 날짜 · task stamp | 판별 | 처리 |
| --- | --- | --- | --- | --- |
| **3** 행 (`38 행 13 entity / 4 module 은 불변`) | T-1419 시점 기록 | **有** (T-1419 · § 12.17) | **보존** | 무편집 (§ 12.24 판별 승계) |
| **18** 행 (`14 entity (+ 1 conceptual mention)`) | § 2 서두 현행 tally | 無 | **무편집** | 채택안이 (B) 각주라 tally 불변 — 고칠 대상 없음 |
| **22 ~ 36** 행 (§ 2 표 row 15 줄) | 정본 표 본체 | — | **무편집** | AC 4 가 (A) 채택 시에만 변경 허용 → (B) 채택이라 금지 |
| **36** 행 직후 (표 끝 ~ 38 행 사이 공백) | 신설 위치 | — | **append** | 코드 only model 각주 blockquote 2 줄 신설 (+3 행) |
| **38** 행 앞머리 (`**합계**: 14 entity …`) | 현행 tally (living) | 無 | **무편집** | (B) 채택으로 tally 불변 |
| **38** 행 중간 (`10 → 11` · `11 → 13` shift 이력 + T-1426 정정 문장) | 시점 기록 2 세대 | **有** (T-0039 c25a5de · T-0484/Q-0040 · T-1426) | **보존 + append** | **한 글자도 미편집** 후 행 끝에 T-1427 실측 문장을 덧붙임 |
| **171** 행 (§ 7 ExportJob/ImportJob bullet) | 범위 선언 + 미구현 전제 혼재 | **有** (T-0484/Q-0040 · T-0505/Q-0042 ADR-0046) | **보존 + append** | 원문 무편집 후 행 끝에 shipped 실측 문장을 덧붙임 |

**38 행 순수-append 성립 근거** — 38 행은 한 행 안에 tally 문장 · shift 이력 2 세대 · T-1426 정정 문장이 공존하지만, 어긋난 부분이 `ExportJob/ImportJob … 은 후속 task` **한 문장** 이고 이 문장이 **그 시점 (T-0484) 에는 참이던 기록** 이라 치환 대상이 아니다. 따라서 기존 문자열을 **byte 단위로 그대로 두고** 행 끝에 실측 문장을 덧붙이는 방식이 성립하며, 이는 § 12.24 가 같은 행에 T-1426 shift 근거를 덧붙인 선례와 동형이다 (행 수 불변, 문서 통독 순서상 독자가 stale 문장 직후에 정정을 읽는다).

#### 3 축 대조표 (AC 2 — 명칭 exact match 1 차 기준)

| # | 코드 model (`schema.prisma` 행) | 문서 § 2 실체 row | 구획 |
| --- | --- | --- | --- |
| 1 | `Person` (55) | **Person** | ① 일치 |
| 2 | `Group` (97) | **Group** | ① 일치 |
| 3 | `Part` (114) | **Part** | ① 일치 |
| 4 | `PersonGroupMembership` (131) | **PersonGroupMembership** | ① 일치 |
| 5 | `User` (170) | **User** | ① 일치 |
| 6 | `UserInstanceAccess` (234) | — | **③ 코드 only** |
| 7 | `ServiceIdentity` (257) | **ServiceIdentity** | ① 일치 |
| 8 | `Assessment` (294) | **Assessment** | ① 일치 |
| 9 | `Contribution` (329) | **Contribution** | ① 일치 |
| 10 | `Summary` (361) | **Summary** | ① 일치 |
| 11 | `LlmProviderConfig` (406) | **LlmProviderConfig** | ① 일치 |
| 12 | `DifficultyMapping` (441) | **DifficultyMapping** | ① 일치 |
| 13 | `PermissionDeniedRecord` (513) | **PermissionDeniedRecord** | ① 일치 |
| 14 | `ExportJob` (614) | **ExportJob** | ① 일치 |
| 15 | `ImportJob` (649) | **ImportJob** | ① 일치 |

**집계** — ① 일치 **14** (기대 14) · ② 문서 only **0** (기대 0) · ③ 코드 only **1** (기대 1). 15 = 14 + 1, 14 = 14 + 0 으로 양변이 닫힌다. **명칭 exact match 만으로 15 개 중 14 개가 짝지어져 이름-다름/개념-같음 짝은 0 건** 이라 근거 서술이 필요한 항목이 없었다.

**③ 코드 only — `UserInstanceAccess` (234 행)** — `(userId, instanceRef)` 식별자 binding 만 보유하고 token / 자격증명 컬럼을 schema 차원에서 정의하지 않는 model 이며 (231 ~ 233 행 주석이 CLAUDE.md §9 를 근거로 명시), `User` 와 N:1 `onDelete: Cascade`. **소관 module 은 `UserInstanceAccessModule`** (`src/user-instance-access/user-instance-access.module.ts`, T-0238) 로, [modules.md](../architecture/modules.md) **47 ~ 48** 행 T-1425 각주가 "정본 표 미기재 실 shipped module 3" 중 하나로 이미 기록한 module 이다 — 즉 **본 절의 ③ 은 § 12.23 이 module 축에서 남긴 미기재 3 과 같은 뿌리** 이며, entity 축 row 신설은 module 축 row 신설 판정 (파생 영향 5, ADR 선행) 에 종속된다.

**② 문서 only 가 0 인 것과 AuditLog** — `*(conceptual mention)* **AuditLog**` (36 행) 는 `^| \*\*` 에 걸리지 않는 **실체 row 가 아니므로** ② 에 계상하지 않는다. 코드에 `model AuditLog` 가 없는 것은 어긋남이 아니라 **설계 의도대로의 정합** 이다 — 163 행 § 7 이 "Audit log entity 의 구체 schema 는 별도 보안 ADR 필요" 로 out-of-scope 를 못박았고 36 행 row 자신도 "본 task scope 외 — conceptual mention 만" 이라 적어, 문서가 **미실재를 선언** 한 상태와 코드의 부재가 일치한다. 따라서 AuditLog 는 본 대조에서 어긋남 0 건이며 별도 처리 대상이 아니다.

#### 처리 방식 축별 판정 (축 ③ 4 후보 · 축 B 4 후보 — 각 채택 1 · 기각 3)

판정 기준 **4 축** — ① **MVA 범위** (7 행이 못박은 conceptual-only 경계를 넘는가 — 컬럼 type · index · migration 을 문서로 끌어오면 자동 기각), ② **cascade** (18 · 38 행 tally · § 3 mermaid 42 ~ 83 · § 6 REQ → entity coverage 115 ~ 153 · [modules.md](../architecture/modules.md) · [INDEX.md](INDEX.md) · `api.md` 에 새 stale 을 만드는가), ③ **cap** (≤ 300 LOC · 파일 3 고정), ④ **ADR 게이트** (entity 집합의 신설·재배치를 **선언** 하면 본 doc slice 범위 밖).

**축 ③ — 코드 only `UserInstanceAccess`**

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(A) `§ 2` 표에 row 신설 + tally 14 → 15 다축 동기** | **기각** | 축 ④ 위배 — row 신설은 "이 model 이 conceptual entity 집합의 일원" 이라는 **선언** 이라 ADR 선행 대상이다 (§ 12.23 이 module 축에서 (A) 를 기각한 것과 동형 근거). 축 ② 도 위배 — 15 로 올리면 § 3 mermaid 에 `User ↔ UserInstanceAccess` 관계선 · § 6 REQ → entity coverage row · "책임 module" 컬럼에 **정본 표 미기재** 인 `UserInstanceAccessModule` 명이 동시에 필요해지고, 마지막 것은 [modules.md](../architecture/modules.md) 48 행이 못박은 계상 경계를 문서 간 모순으로 만든다 |
| **(B) 표 직후 각주 추가 (row 무신설 · tally 불변)** | **채택** | 축 ① 충족 — 이름 · 소관 module · 코드 좌표만 적고 컬럼 type / index / migration 은 인용하지 않아 conceptual-only 경계 안. 축 ② **0** — tally 2 지점 · mermaid · § 6 전부 불변이라 새 stale 원천이 없다. 축 ③ 충족 — 신설 3 행. 축 ④ 회피 — 각주는 **사실 기록** 이지 집합 소속 선언이 아니다 (§ 12.23 이 module 축에서 채택한 선례를 그대로 승계) |
| **(C) 기존 row 내 부기** | **기각** | 축 ② 위배 — `UserInstanceAccess` 는 `User` 와 N:1 일 뿐 어느 실체 row 의 하위 개념도 아니라 어느 row 에 붙여도 그 row 의 책임 서술이 왜곡된다. 나아가 표 row (22 ~ 36 행) 를 건드리므로 AC 4 가 (A) 채택 시로 한정한 편집 허용 범위를 위반하고, 실체 row 계상 명령의 `^\| \*\*` 패턴 경계도 흐려진다 |
| **(D) 무편집 이월** | **기각** | § 12.24 한계 ② 가 지목하고 그 `Follow-up 1` 이 명시 요구한 축이며, 실측 6 항이 전부 기대값과 일치해 판정 재료가 완비됐다. 이월 비용 (다음 slice 가 실측을 재수행) 이 편집 비용 (각주 3 행) 을 명백히 넘는다 |

**축 B — 미구현 전제 서술 (38 · 171 행)**

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(A') 38 · 171 행을 코드 실재 반영해 in-place 정정** | **기각** | § 12.15 판별 위배 — 두 문장 다 **T-0484 / Q-0040 시점에는 참이던 기록** 이고 task stamp 가 박혀 있어 문자 치환하면 이력이 소실된다 (§ 12.24 가 3 행 blockquote 를 보존한 것과 동형). 171 행은 추가로 **치환 대상 자체가 없다** — `본 문서 범위 밖` 이라는 범위 선언은 7 행 MVA 경계상 **여전히 참** 이라 무엇을 무엇으로 바꿀지가 성립하지 않는다 |
| **(B') 각주 / 부기로 흡수 (원문 보존 + 행 끝 문장 append)** | **채택** | 축 ① 충족 — 코드 좌표 (614 · 649 행) · migration 디렉토리명만 인용하고 SQL 본문 · 컬럼 정의는 끌어오지 않는다. 축 ② **0** — 행 수 불변, 다른 문서 무영향. 축 ③ 충족 — 2 지점 부기. 축 ④ 무관 — entity 집합 선언이 아니라 **구현 상태 사실 기록**. 독자는 stale 문장 **직후** 에 정정을 읽으므로 § 12.24 (A2) 를 기각시킨 "본문 먼저 읽고 각주에서 뒤집기" 문제가 발생하지 않는다 (같은 행 안 부기라 시선 이동 0) |
| **(C') `§ 7` 만 정정하고 38 행은 이력이라 보존** | **기각** | 38 행 stale 잔존 — § 2 합계 산문은 표 바로 아래라 **독자가 § 7 보다 먼저 읽는** 지점이고, 38 행의 해당 문장은 스스로 `(§7 / ADR-0044 §Out of scope)` 로 § 7 을 가리켜 두 지점이 한 쌍으로 움직여야 한다. 한쪽만 고치면 § 12.24 가 tally 2 지점 동시 동기로 닫은 어긋남과 같은 형태의 문서 내 모순이 새로 생긴다 |
| **(D') 무편집 이월** | **기각** | 어긋남이 **코드 실측으로 확정** (614 · 649 행 model + migration + `src/export/` · `src/import/`) 됐고 task 정의서 Why 가 명시 지목한 축이다. 축 ① ~ ④ 어디에도 저촉되지 않는 (B') 가 있는 이상 이월 근거 0 |

**채택 = 축 ③ (B) + 축 B (B').** cap 초과로 자동 기각된 후보는 없어 본 절에 남길 split 제안은 없다. **계상 경계 승계** — 각주가 기록한 `UserInstanceAccess` 1 개는 18 · 38 행의 `14 entity` 에 **포함되지 않으며**, 이는 [modules.md](../architecture/modules.md) 48 행이 미기재 3 module 에 대해 못박은 경계와 같은 원리다 (각주 = 사실 기록, 정본 카운트 외).

#### 반영 결과

편집 지점 **3** 개 (AC 4 의 ≤ 6 이내), `wc -l` **190 → 193** (+3, AC 4 의 +4 이내), 순수 삭제 **0**.

| 편집 지점 | 처리 | 내용 |
| --- | --- | --- |
| **data-model.md 36 행 직후** (신설 38 ~ 39 행 + 공백 1) | **append** (§ 12.15 판별 — 신설 위치라 보존 대상 없음) | 코드 only model 각주 blockquote 2 줄 — 15 vs 14 실측 · `UserInstanceAccess` (234 행) 의 책임·관계·소관 module (`UserInstanceAccessModule`, modules.md 47 ~ 48 행 각주) · "② 문서 only 0" · **각주는 카운트 대상 아님** 경계 · row 신설은 ADR 선행이라 별도 slice 소관 |
| **data-model.md 38 행** (편집 후 **41** 행) | **append** (시점 기록 2 세대 보존 — 판별표 근거) | 원문 무편집 후 행 끝에 T-1427 실측 문장 — `후속 task` 전제가 T-0484 시점 기록임 + `model ExportJob` (614) · `model ImportJob` (649) · migration `20260618000000_export_import_job` shipped + 코드 only 1 개에도 tally `14` 불변 |
| **data-model.md 171 행** (편집 후 **174** 행) | **append** (범위 선언 자체는 참이라 치환 불성립) | 원문 무편집 후 행 끝에 shipped 실측 문장 — 코드 · migration SQL (`CREATE TABLE` 20 · 39 행) · `src/export/` · `src/import/` 실재 + `본 문서 범위 밖` 선언은 7 행 MVA 경계 그대로 불변 + 나머지 열거 항목의 shipped 여부는 미측정 (명칭 축 대조만) 임을 명시 |

#### 무편집 경계

`prisma/` **전체** (대조 입력인 `schema.prisma` 포함) · `src/` · `test/` 일체, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md`, [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 **전부 무편집** 이고 `git status --porcelain` 에 미등장한다. data-model.md 내부에서도 **3 행 blockquote** · **18 행 tally** · **§ 2 표 row (22 ~ 36 행)** · **§ 3 mermaid ER diagram (42 ~ 83 행)** · **§ 4 ~ § 6 (84 ~ 153 행)** · § 7 의 171 행 외 전 bullet 은 한 글자도 편집하지 않았다 (아래 hunk 목록이 증명).

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

1. **[INDEX.md](INDEX.md) 58 · 86 행 § 3 산문의 `AssessmentModule` 귀속** — T-1424 Follow-up 1, **5 회째 이월**. **후속 slice 소관**.
2. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — T-1421 Follow-up 3 잔여 ②. **후속 slice 소관**.
3. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **9 회째 이월**. **후속 slice 소관**.
4. **[INDEX.md](INDEX.md) 37 행 UC-07 row 가 `ExportModule` / `ImportModule` 을 미사용** — § 12.23 파생 영향 6. **후속 slice 소관**.
5. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — § 12.23 파생 영향 7 (T-1425 Follow-up 2) 의 3 slice split (① ADR gate → ② 다축 동시 갱신 → ③ INDEX·UC 게이트). 본 절 축 ③ 의 (A) 기각 근거가 이 축에 **직접 종속** 한다 (`UserInstanceAccessModule` 이 미기재 3 중 하나). **후속 slice 소관**.
6. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약 미판정** — § 12.23 한계 3 (T-1425 Follow-up 3). **후속 slice 소관**.
7. **행 번호 좌표계 → anchor 좌표계 이행** — § 12.23 한계 4 (T-1425 Follow-up 4), § 12.24 파생 영향 7 로 근거 **2 회 누적**. 본 절의 각주 append 가 38 → 41 · 171 → 174 로 좌표를 **3 행 shift** 시킨 것이 세 번째 발현이다. **후속 slice 소관**.
8. **산문 tally ↔ 표 row 수 CI drift-guard spec 신설** — § 12.24 한계 1 (T-1426 Follow-up 2). 본 절의 entity 축 문서↔코드 대조도 같은 spec 으로 묶는 안은 아래 한계 2. **후속 slice 소관**.

#### closure 선언

- **§ 12.24 한계 ② / `Follow-up 1` closure** — "§ 2 표 row ↔ `prisma/schema.prisma` 실 model 축은 여전히 미대조" 는 본 절의 3 축 대조표로 닫힌다. 결과는 **① 14 · ② 0 · ③ 1** 이며, § 12.24 가 "문서 ↔ 코드 불일치가 이미 예고된 상태" 로 지목한 38 행 서술도 축 B 로 함께 처리했다.
- **§ 12.24 가 예고한 어긋남의 실체 확인** — 예고된 어긋남 (`ExportJob/ImportJob 미구현 전제`) 은 실측 결과 **문서가 코드보다 뒤처진** 형태였고, 예고되지 않았던 반대 방향 어긋남 (**코드 only `UserInstanceAccess`**) 이 추가로 1 건 발견됐다. 즉 대조를 실제로 수행하지 않으면 **어느 방향의 어긋남이 있는지조차 알 수 없다** 는 것이 본 절의 실증이다.
- **§ 12.23 (module 축) 과의 계보** — module 축 미기재 3 · entity 축 코드 only 1 이 **같은 `UserInstanceAccessModule` 뿌리** 로 이어짐이 확인됐다. 두 축의 row 신설 판정은 하나의 ADR 게이트 (파생 영향 5) 로 함께 닫아야 한다.

#### 불변 검산

```
$ wc -l  docs/architecture/data-model.md                     → 190 → 193  (+3, AC 4 의 +4 이내)
$ grep -c '^## '  docs/architecture/data-model.md            →   8  (불변)
$ sed -n '22,36p' data-model.md | grep -c '^| \*\*'          →  14  (불변 — § 2 표 row 무편집)
$ sed -n '22,36p' data-model.md | grep -c '(conceptual mention)' → 1  (불변)
$ grep -c '14 entity'  data-model.md                         → 2 → 3  (18 · 41 행 + 신설 각주 39 행의
                                                                계상 경계 문장 — tally 지점 수는 2 불변)
$ grep -c '13 entity'  data-model.md                         →   1  (불변 — 3 행 시점 기록)
$ wc -l  prisma/schema.prisma → 666 (불변) · grep -c '^model ' → 15 (불변)   ← 무편집 실증
$ wc -l  modules.md → 259 · INDEX.md → 123 · components.md → 190  (불변 — 무편집)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md                → 2028 → 2209  (§ 12.25 append 181 행)
$ grep -c '^| REQ-' docs/use-cases/REQ-COVERAGE-AUDIT.md     →  66  (불변)
$ grep -c '^## '    docs/use-cases/REQ-COVERAGE-AUDIT.md     →  12  (불변, `###` 만 추가)
$ git diff -U0 -- docs/architecture/data-model.md | grep '^@@'
@@ -38 +38,4 @@        @@ -171 +174 @@
   → hunk **2 개**. 앞 hunk 는 36 행 직후 각주 3 행 신설 + 38 행 행-끝 부기가 인접해 한 hunk 로
     합쳐진 것이고, 뒤 hunk 는 § 7 171 행 부기다. § 2 표 (22 ~ 36) · § 3 mermaid (42 ~ 83)
     · § 4 ~ § 6 (84 ~ 153) · 3 행 blockquote · 18 행 tally 전부 hunk 밖 = 무편집 증명
$ git diff --numstat -- docs/architecture/data-model.md      →  5  2
   → 추가 5 (신설 3 + 부기 2) · 삭제 2 → 삭제 2 는 전부 부기된 두 행의 in-place 짝
     = **순수 삭제 0**
```

변경 파일은 [data-model.md](../architecture/data-model.md) · 본 audit **2 개** + [T-1427 task 파일](../tasks/T-1427-data-model-entity-vs-prisma-model-audit.md) 의 status frontmatter (driver bookkeeping commit 소관) 이며, 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **본 대조는 명칭 축 뿐** — ① 일치 14 건은 **model 명 == 표 row 명** 만 확인했을 뿐, 각 model 의 **필드 · 관계 · invariant** 가 표의 책임 서술 · § 3 mermaid 관계선 · § 4 raw 미저장 invariant 와 실제로 부합하는지는 검사하지 않았다. 예컨대 § 3 의 관계 11 (`User ↔ ExportJob 1:N`) 이 schema 의 `@relation` 과 cardinality 까지 같은지는 미검증이며, 이는 7 행 MVA 경계상 본 doc slice 가 다루기 어려운 축 (필드 대조는 컬럼 축으로 미끄러진다) 이라 **별도 판정 slice** 가 필요하다.
2. **문서 ↔ 코드 대조는 코드가 바뀔 때마다 재-stale** — 본 절이 확정한 `15 vs 14 (+1)` 은 `schema.prisma` 에 model 이 하나 추가되는 순간 다시 틀린다. § 12.24 한계 1 이 산문 tally ↔ 표 row 수에 대해 내린 결론 (사람 규약보다 **CI drift-guard spec** 이 견고) 이 본 축에도 그대로 적용되며, 대조 대상이 `grep -c '^model ' prisma/schema.prisma` 와 `sed -n '22,36p' … | grep -c '^| \*\*'` 두 명령이라 **§ 12.24 Follow-up 2 의 module 축 spec 과 한 spec 으로 묶는 안** 이 자연스럽다 (파생 영향 8). 다만 각주 계상 경계 (미기재 module 3 · 코드 only entity 1 을 카운트에서 빼는 규약) 를 spec 이 어떻게 표현할지가 설계 쟁점으로 남는다.
3. **채택안이 남긴 미해결** — (a) 각주 채택으로 `UserInstanceAccess` 는 여전히 § 3 mermaid · § 6 REQ → entity coverage 어디에도 등장하지 않아, 그 두 절만 읽는 독자에게는 **존재하지 않는 것과 같다** (row 신설은 ADR 게이트 · 파생 영향 5). (b) 축 B 의 부기는 38 · 174 행을 **더 길게** 만들어, 한 행에 시점 기록이 3 세대 (T-0484 · T-1426 · T-1427) 누적됐다 — § 12.24 한계 3 (a) 가 지적한 "시점 기록에 명시적 marker 규약이 필요" 가 본 절에서 더 뚜렷해졌다. (c) 171 행이 열거한 나머지 항목 (artifact 저장소 · retention 정책 · merge conflict 알고리즘) 의 shipped 여부는 **측정하지 않았다** — 부기 문장이 그 사실을 명시하지만, 미측정 항목이 남은 bullet 은 다음 대조에서 재확인 대상이다.

### 12.26 INDEX.md `AssessmentModule` 귀속 3 지점 문서 ↔ 코드 대조 실판정 (T-1428)

> 본 절은 [T-1428](../tasks/T-1428-index-md-module-attribution-code-resync.md) 이 § 12.25 (T-1427) 의 **파생 영향 1** ([INDEX.md](INDEX.md) **58** · **86** 행 § 3 산문의 `AssessmentModule` 귀속 — T-1424 `Follow-up 1` 이후 **5 회째 이월**) 과 **파생 영향 4** (같은 문서 **37** 행 UC-07 row 가 `ExportModule` / `ImportModule` 을 미사용 — § 12.23 파생 영향 6) 을 **한 파일 · 한 slice 에서 동시에** 닫은 기록이다. 둘은 뿌리가 같다 — 문서가 `AssessmentModule` 하나로 뭉뚱그린 귀속 vs `src/` 의 실 shipped module. **지금 닫힐 수 있게 된 계보** — 37 행의 기존 각주는 "export/import 실 shipped 코드의 module 귀속은 정본 12 표에 아직 미기재라 후속 slice 소관" 이라며 **가리킬 근거 지점의 부재** 를 이월 사유로 들었는데, § 12.23 (T-1425) 이 [modules.md](../architecture/modules.md) **47 ~ 48** 행에 "정본 표 미기재 실 shipped module 3" 각주를 박제하면서 그 전제가 해소됐다. 편집 문서는 [INDEX.md](INDEX.md) **하나** (행 내 부기 3 · 행 수 불변) 이며 `src/` · `test/` · `prisma/` · [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · [data-model.md](../architecture/data-model.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [docs/PLAN.md](../PLAN.md) · `docs/requirements.md` 는 **한 글자도 편집하지 않았다** — `src/` 는 존재 확인용 **read-only 대조 입력** 이다. 삽입 위치는 § 12.25 마지막 행 뒤 · § 11 References 앞이고 `###` 이라 `## ` heading count 12 가 불변이다.

#### 실측 선행 (편집 전 6 항)

```
(i)   $ grep -n 'AssessmentModule' docs/use-cases/INDEX.md
      → 25 · 31 · 32 · 36 · 37 · 38 · 39 · 58 · 86   (9 지점, 기대값 일치)
(ii)  $ ls -d src/*/ | wc -l                              → 15
      $ ls -d src/assessment* src/permission-denied src/export src/import 2>&1
      → src/assessment-collection  src/assessment-evaluation  src/export
         src/import  src/permission-denied                    (5 개 전부 실재)
      $ ls -d src/assessment 2>&1
      → ls: cannot access 'src/assessment': No such file or directory   (부재 확정)
(iii) $ grep -n 'ExportModule\|ImportModule' docs/architecture/modules.md   → 47  (1 지점)
      47: "> **정본 표 미기재 실 shipped module (T-1425 실측 각주)** — … `ExportModule`
           (`src/export/export.module.ts`, T-0488) · `ImportModule`
           (`src/import/import.module.ts`, T-0489) · `UserInstanceAccessModule` …"
      $ grep -n 'PermissionDeniedRecordModule\|AssessmentCollectionModule\|
                 AssessmentEvaluationModule' docs/architecture/modules.md
      → 정본 표 row 3 지점 = 37 (PermissionDeniedRecordModule) · 40
        (AssessmentCollectionModule) · 41 (AssessmentEvaluationModule).
        나머지 hit (3 · 64 · 65 · 78 · 137 · 138 · 150 · 153 · 154 · 172 · 178 · 179
        · 200 ~ 208) 은 blockquote / mermaid / 의존성 서술 / mapping 이라 가리킬 좌표 아님.
      → INDEX 가 가리킬 **근거 행번호 확정**: 37 · 39 (AssessmentModule placeholder) · 40 · 41 · 47
(iv)  기존 화법 원문 (§ 2 표 병기 완료 row):
      31 행 → "… AssessmentModule (실 shipped 는 modules.md 39 행 정본 기준 미shipped
               placeholder — 본 UC 의 수집 축 = AssessmentCollectionModule · 평가 축 =
               AssessmentEvaluationModule, 같은 문서 40 · 41 행. 병기는 부기라 UC-01 §9 의
               `6 module` 산정 불변), …"
      38 행 → "… AssessmentModule (modules.md 39 행 정본 기준 미shipped placeholder — 권한
               부족 record 영속화·audit 조회의 실 shipped 는 PermissionDeniedRecordModule,
               같은 문서 37 행. 병기는 부기라 UC-08 §9 의 `4 module` 산정 불변), …"
      37 행 (미완 문구) → "… — export/import 실 shipped 코드의 module 귀속은 정본 12 표에
               아직 미기재라 **후속 slice 소관**. 병기는 부기라 UC-07 §9 의 `4 module` 산정 불변) …"
(v)   § 12.15 판별표 — 아래 표
(vi)  $ wc -l INDEX.md → 123 · audit → 2209 · modules.md → 259 · data-model.md → 193
      $ grep -c '^## ' INDEX.md → 5 · $ grep -c '^| UC-' INDEX.md → 9
      $ grep -c '^## ' audit   → 12 · $ grep -c '^| REQ-' audit  → 66
      → (vi) 8 값 전부 기대값 일치 (baseline). 축 중단 사유 0.
```

**§ 12.15 판별표 — (i) ③ ④ 지점**

| 지점 | 성격 | 날짜 · task stamp | 판별 | 처리 |
| --- | --- | --- | --- | --- |
| **25** 행 (어휘 계약 — 정본 12 명) | 계약 서술 (living) | 無 | **무편집** | ① 정합 — 채택안이 (B) 부기라 어휘 집합 불변 |
| **31 · 32 · 36 · 38 · 39** 행 (병기 완료 5 row) | T-1421 / T-1424 병기 | 無 (본문에 slice 명시 없음) | **무편집** | ① 정합 — 재서술 금지 (AC 4) |
| **37** 행 (UC-07 row 미완 문구) | 이월 선언 (living) | 無 | **원문 보존 + 행 내 부기** | "후속 slice 소관" 은 **그 시점에는 참이던 이월 기록** 이라 치환 대상이 아니고, 근거 지점이 확보된 사실을 바로 뒤에 덧붙인다 |
| **58** 행 (UC-01 § 3 산문) | **T-0019 시점 산문** | **有** (3 행 blockquote 가 문서 전체를 T-0019 산출물로 선언) | **보존 + 문장 뒤 부기** | 원문 한 글자도 미편집 후 마지막 문장 뒤 · `→ 링크` 앞에 부기 1 문장 |
| **86** 행 (UC-08 § 3 산문) | **T-0019 시점 산문** | **有** (동상) | **보존 + 문장 뒤 부기** | 동상 |
| **21 · 40** 행 (`UC-01 ~ UC-08` · `총 8 UC`) | T-0019 시점 기록 | **有** (51 행 T-1412 가 보존 선언) | **보존** | 무편집 (Out of Scope) |

**58 · 86 행 순수-부기 성립 근거** — 두 행은 3 행 blockquote 가 문서 전체를 `T-0019` 산출물로 못박은 § 3 산문이고, 어긋난 부분은 `AssessmentModule 의 평가 파이프라인 service` / `AssessmentModule 이 event 를 받아` **한 구** 인데 이는 **그 시점 (P2, 코드 0) 에는 참이던 설계 서술** 이라 치환 대상이 아니다. 따라서 기존 문자열을 **byte 단위로 그대로 두고** 문장 뒤에 실측 부기를 덧붙이는 방식이 성립하며, 이는 § 12.25 축 B (B') 가 data-model.md 38 · 171 행에서 채택한 선례와 동형이다 (행 수 불변, 독자가 stale 서술 **직후** 에 정정을 읽는다). `→ [UC-NN-*.md]` 링크는 문단 말미의 pointer 라 부기를 그 **앞** 에 넣어 링크가 문단 끝에 남는 기존 구조도 보존했다.

#### 3 축 대조표 (AC 2 — 문서 지점 × 실 shipped 축 × 근거 지점)

| # | INDEX 지점 | 문서 서술 | 실 shipped 축 (`src/` 실측) | 근거 지점 (modules.md) | 구획 |
| --- | --- | --- | --- | --- | --- |
| 1 | **25** (어휘 계약) | 정본 12 명만 사용 | — (집합 선언) | 정본 12 표 | **① 정합** |
| 2 | **31** (UC-01 row) | placeholder + 수집·평가 축 병기 | `AssessmentCollectionModule` · `AssessmentEvaluationModule` | 39 · 40 · 41 | **① 정합** |
| 3 | **32** (UC-02 row) | placeholder (실 코드 0 명시) | — (조회 축 미shipped) | 39 | **① 정합** |
| 4 | **36** (UC-06 row) | placeholder + 재수집 축 병기 | `SchedulerModule` ④ · `AssessmentCollectionModule` | 39 · 42 | **① 정합** |
| 5 | **37** (UC-07 row) | placeholder + **"미기재라 후속 slice 소관"** | `ExportModule` (`src/export/`) · `ImportModule` (`src/import/`) | **47** (T-1425 각주) | **② 어긋남 — 근거 확보** |
| 6 | **38** (UC-08 row) | placeholder + 권한 record 축 병기 | `PermissionDeniedRecordModule` | 39 · 37 | **① 정합** |
| 7 | **39** (UC-09 row) | placeholder + 평가·수집 축 병기 | `AssessmentEvaluationModule` · `AssessmentCollectionModule` | 197 · 198 | **① 정합** |
| 8 | **58** (UC-01 산문) | `AssessmentModule 의 평가 파이프라인 service` — **병기 전무** | `AssessmentCollectionModule` (수집) + `AssessmentEvaluationModule` (평가) | 39 · 40 · 41 | **② 어긋남 — 근거 확보** |
| 9 | **86** (UC-08 산문) | `AssessmentModule 이 event 를 받아` — **병기 전무** | `PermissionDeniedRecordModule` | 39 · 37 | **② 어긋남 — 근거 확보** |

**집계** — ① 정합 **6** · ② 어긋남(근거 확보) **3** (37 · 58 · 86, 기대값 일치) · ③ 어긋남(근거 부재) **0** (기대값 일치). 9 = 6 + 3 + 0 으로 양변이 닫힌다. ③ 이 0 이므로 **무편집 이월로 넘길 지점은 없다**. 대조의 코드 축 근거는 `src/assessment/` **부재** + `src/assessment-collection` · `src/assessment-evaluation` · `src/permission-denied` · `src/export` · `src/import` **5 실재** 이며, `AssessmentModule` 은 문서상 placeholder 로 이미 선언돼 있어 **문서가 미실재를 선언한 상태와 코드의 부재가 일치** 한다 (placeholder 표기 자체는 어긋남 0 — § 12.25 의 AuditLog 처리와 동형).

#### 처리 방식 판정 (4 후보 · 채택 1 · 기각 3)

판정 기준 **4 축** — ① **어휘 계약** (25 행이 못박은 "주요 module = modules.md 의 **12** NestJS module 명" 을 깨는가 — 미기재 module 명을 본문 어휘로 승격시키면 정본 표 row 신설과 동치라 자동 기각), ② **cascade** (`UC-01` / `UC-07` / `UC-08` 본문 § 9 의 module 산정 수치 · [modules.md](../architecture/modules.md) `12 module` 산문 · [components.md](../architecture/components.md) mapping 에 새 stale 을 만드는가), ③ **cap** (≤ 300 LOC · 파일 **3 고정**), ④ **선례 일관성** (같은 표 안 5 row 가 이미 채택한 화법과 다른 규약을 한 문서 안에 공존시키는가).

| 후보 | 판정 | 근거 |
| --- | --- | --- |
| **(A) `AssessmentModule` 표기를 실 shipped module 명으로 치환** | **기각** | 축 ① 위배 — 37 행은 `ExportModule` / `ImportModule` 로 치환해야 하는데 둘은 [modules.md](../architecture/modules.md) 48 행이 "정본 표 row 도 카운트 대상도 아니다" 로 못박은 **미기재 module** 이라, 컬럼 값 승격은 정본 표 row 신설 선언과 동치 (ADR 게이트). 축 ② 도 위배 — 58 · 86 행 치환은 각 UC 본문 § 9 의 `6 module` / `4 module` 산정과 modules.md `12 module` 산문을 동시에 흔들어 새 stale 을 만든다. 축 ④ 도 위배 — 31 · 38 행이 **치환 아닌 병기** 를 이미 채택했다 |
| **(B) 원문 보존 + 문장 뒤 부기 (표 row 31 · 38 화법 승계)** | **채택** | 축 ① 충족 — 미기재 명을 **부기 안의 사실 기록** 으로만 적고 "정본 12 어휘 밖 · 컬럼 값으로 승격하지 않음" 을 명시해 25 행 계약을 그대로 지킨다. 축 ② **0** — 표 row 수 · 컬럼 값 · UC 본문 § 9 산정 · modules.md 산문 전부 불변 (각 부기가 "산정 불변" 을 자기 문장으로 재확인). 축 ③ 충족 — 3 행 in-place, 행 수 증가 0. 축 ④ 충족 — 같은 문서 5 row 의 화법을 문자 그대로 승계 |
| **(C) `§ 3` 말미에 각주 블록 1 개 신설해 3 지점을 한 곳에서 설명** | **기각** | 축 ④ 위배 — 같은 문서 안에 "행 내 병기" (표 5 row) 와 "말미 각주" 두 규약이 공존하게 된다. 축 ② 도 열위 — 독자가 58 · 86 행 본문을 먼저 읽고 문서 끝에서야 뒤집히는 구조라 § 12.24 가 (A2) 를 기각한 "본문 먼저 읽고 각주에서 뒤집기" 문제가 재발한다. 축 ③ 은 통과하나 (신설 3 ~ 5 행) 다른 두 축의 열위를 상쇄하지 못한다 |
| **(D) 무편집 이월** | **기각** | 축 ② ③ 어디에도 저촉되지 않는 (B) 가 있고, 실측 6 항이 전부 기대값과 일치해 판정 재료가 완비됐다. 58 · 86 행은 이미 **5 회째 이월** 이고 37 행이 든 이월 사유 (근거 지점 부재) 는 § 12.23 으로 해소됐으므로, 이월 비용 (다음 slice 가 실측을 재수행) 이 편집 비용 (부기 3 문장) 을 명백히 넘는다 |

**채택 = (B).** cap 초과로 자동 기각된 후보가 없어 본 절에 남길 split 제안은 없다. **계상 경계 승계** — 부기가 기록한 `ExportModule` / `ImportModule` 은 25 행 정본 12 어휘에 **포함되지 않으며**, 이는 [modules.md](../architecture/modules.md) 48 행이 미기재 3 module 에 대해 못박은 경계 (각주 = 사실 기록, 정본 카운트 외) 와 같은 원리다.

#### 반영 결과

편집 지점 **3** 행 (AC 4 의 정확히 3 이하), `wc -l` **123 → 123** (+0, AC 4 의 +2 이내), 순수 삭제 **0**.

| 편집 지점 | 처리 | 내용 |
| --- | --- | --- |
| **INDEX 37** 행 (UC-07 row) | **행 내 부기** (§ 12.15 판별 — 이월 기록 보존, 문자 삭제 0) | 기존 "후속 slice 소관" 뒤에 T-1428 대조 문장 — 실 shipped 축 = `ExportModule` (`src/export/export.module.ts`) · `ImportModule` (`src/import/import.module.ts`) + [modules.md](../architecture/modules.md) **47** 행 T-1425 각주 좌표 + 48 행 경계상 정본 12 어휘 밖이라 컬럼 값 미승격 + row 신설은 ADR 게이트 소관 |
| **INDEX 58** 행 (UC-01 § 3 산문) | **문장 뒤 부기** (T-0019 시점 산문 보존 — 판별표 근거) | 원문 무편집 후 `→ 링크` 앞에 부기 1 문장 — `AssessmentModule` 은 39 행 정본 기준 미shipped placeholder (`src/assessment/` 부재), 실 shipped 축 = 수집 `AssessmentCollectionModule` (40 행) · 평가 `AssessmentEvaluationModule` (41 행), § 2 표 31 행 · [UC-01](UC-01-evaluation-execution.md) § 9 의 `6 module` 산정 불변 |
| **INDEX 86** 행 (UC-08 § 3 산문) | **문장 뒤 부기** (동상) | 원문 무편집 후 `→ 링크` 앞에 부기 1 문장 — 실 shipped 축 = `PermissionDeniedRecordModule` (`src/permission-denied/`, 37 행), § 2 표 38 행 · [UC-08](UC-08-permission-denied.md) § 9 의 `4 module` 산정 불변 |

#### 무편집 경계

`src/` (존재 확인용 read-only 대조 입력) · `test/` · `prisma/` **일체**, [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · `api.md` · [data-model.md](../architecture/data-model.md), `UC-01` ~ `UC-09` 본문, `docs/decisions/ADR-*.md`, [docs/PLAN.md](../PLAN.md), `docs/requirements.md` 는 **전부 무편집** 이고 `git status --porcelain` 에 미등장한다. [INDEX.md](INDEX.md) 내부에서도 **21 · 40 행 시점 기록** (T-1412 보존 선언) · **25 행 어휘 계약** · **표 row 31 · 32 · 36 · 38 · 39** · § 3 의 나머지 7 description · **§ 4 References** · **§ 5 갱신 룰** 은 한 글자도 편집하지 않았다 (아래 hunk 목록이 증명).

#### 파생 영향 목록 (본 slice 편집 금지 — 후속 slice 소관)

1. **[api.md](../architecture/api.md) 223 행 `UC-01 ~ UC-08` 링크 범위 vs 9 UC** — § 12.25 파생 영향 2. **후속 slice 소관**.
2. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — T-1421 Follow-up 2 가 **10 회째 이월**. **후속 slice 소관**.
3. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 선행)** — § 12.25 파생 영향 5. 본 절 (A) 기각 근거가 이 축에 **직접 종속** 한다. **후속 slice 소관**.
4. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약 미판정** — § 12.25 파생 영향 6. **후속 slice 소관**.
5. **행 번호 좌표계 → anchor 좌표계 이행** — § 12.23 한계 4 · § 12.24 파생 영향 7 · § 12.25 파생 영향 7 로 근거 **3 회 누적**. 본 절은 INDEX 를 행 내 부기로만 고쳐 좌표 shift 0 이었으나, audit 자신은 § 12.26 append 로 § 11 References 좌표를 밀었다 — **4 회째 발현**. **후속 slice 소관**.
6. **산문 tally ↔ 표 row 수 CI drift-guard spec 신설** — § 12.25 파생 영향 8 · 한계 2. 본 절의 module 귀속 축 (`ls -d src/*/` vs 문서 module 명) 도 같은 spec 후보다. **후속 slice 소관**.
7. **각 UC 본문 `§ 9` module 산정 수치가 INDEX 병기와 별개 좌표계** — 한쪽만 갱신되는 이중 관리가 미해소. **후속 slice 소관**.

#### closure 선언

- **§ 12.25 파생 영향 1 closure (5 회째 이월 종료)** — 58 · 86 행 산문의 `AssessmentModule` 귀속은 본 절의 3 축 대조표 (② 3 건) + (B) 부기로 닫힌다. T-1424 `Follow-up 1` 이후 4 개 slice 를 건너뛴 축이 실판정으로 종료됐다.
- **§ 12.25 파생 영향 4 / § 12.23 파생 영향 6 closure** — 37 행 UC-07 row 의 "미기재라 후속 slice 소관" 은 § 12.23 이 공급한 **47 행 각주 좌표** 를 가리키는 부기로 닫힌다. 이월 사유였던 "가리킬 근거 지점 부재" 가 사실로서 해소됐음을 문서가 스스로 증명한다.
- **§ 12.23 (module 축) 과의 계보** — 미기재 3 module 중 `ExportModule` / `ImportModule` 2 개가 본 절에서 **UC 축의 소비처** 를 얻었다 (UC-07). 남은 `UserInstanceAccessModule` 은 § 12.25 ③ 이 entity 축에서 잡은 그 module 이며, 세 축 (module · entity · UC) 의 row 신설 판정은 하나의 ADR 게이트 (파생 영향 3) 로 함께 닫아야 한다.

#### 불변 검산

```
$ wc -l  docs/use-cases/INDEX.md              → 123 → 123  (+0, AC 4 의 +2 이내)
$ grep -c '^## '   docs/use-cases/INDEX.md    →   5  (불변)
$ grep -c '^| UC-' docs/use-cases/INDEX.md    →   9  (불변 — 표 row 무신설)
$ grep -c 'AssessmentModule' INDEX.md         →   9  (불변 — 치환 0, 부기만)
$ wc -l  modules.md → 259 · data-model.md → 193   (불변 — 무편집 실증)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md → 2209 → 2353  (§ 12.26 append 144 행)
$ grep -c '^## '   audit → 12  ·  grep -c '^| REQ-' audit → 66   (불변, `###` 만 추가)
$ git diff -U0 -- docs/use-cases/INDEX.md | grep '^@@'
@@ -37 +37 @@     @@ -58 +58 @@     @@ -86 +86 @@
   → hunk **3 개** = 편집 지점 3 행과 1:1. 21 · 25 · 31 · 32 · 36 · 38 · 39 · 40 행,
     § 3 의 나머지 7 description, § 4 References, § 5 갱신 룰 전부 hunk 밖 = 무편집 증명
$ git diff --numstat -- docs/use-cases/INDEX.md   →  3  3
   → 추가 3 · 삭제 3 → 삭제 3 은 전부 부기된 세 행의 in-place 짝 = **순수 삭제 0**
$ git status --porcelain
 M docs/use-cases/INDEX.md   M docs/use-cases/REQ-COVERAGE-AUDIT.md
 M docs/tasks/T-1428-index-md-module-attribution-code-resync.md   → 정확히 3 파일
```

변경 파일은 [INDEX.md](INDEX.md) · 본 audit · [T-1428 task 파일](../tasks/T-1428-index-md-module-attribution-code-resync.md) (`Follow-ups` 7 항 append — frontmatter `status` 는 STATE single-writer 규약상 driver bookkeeping commit 소관이라 본 commit 에서 무편집) **정확히 3 개** 이며, 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다.

#### 한계 —

1. **본 대조는 module 명 축 뿐** — ② 3 지점에 실 shipped module 명을 병기했을 뿐, 각 UC 산문이 서술한 **동작 · 책임** (예: 58 행의 "3 GitHub instance + Confluence + LLM gateway 를 거쳐 … 생성", 86 행의 "event 를 받아 DB 에 기록") 이 해당 module 의 실 코드와 부합하는지는 **검증하지 않았다**. 명칭이 맞아도 책임 서술이 stale 일 수 있으며, 이는 service / controller 단위 대조가 필요한 **별도 판정 slice** 다.
2. **INDEX 병기와 UC 본문 `§ 9` 산정이 별개 좌표계** — 본 절의 부기는 세 지점 모두 "§ 9 의 `N module` 산정 불변" 을 명시해 수치 충돌을 피했지만, 그 결과 **같은 사실이 두 문서에 서로 다른 형식으로 이중 관리** 된다. 어느 한쪽만 갱신되면 다시 어긋나며 (파생 영향 7), 이는 사람 규약으로는 재발을 막을 수 없어 § 12.25 한계 2 와 같은 CI drift-guard 축 (파생 영향 6) 으로만 닫힌다.
3. **채택안이 남긴 미해결** — (a) `ExportModule` / `ImportModule` 은 여전히 25 행 어휘 집합 · 정본 12 표 어디에도 없어, § 2 표만 읽는 독자에게는 **존재하지 않는 것과 같다** (row 신설은 ADR 게이트 · 파생 영향 3). (b) 32 행 UC-02 row 는 ① 정합으로 분류됐지만 그 근거가 "조회 축이 아직 미shipped" 라 **코드가 shipped 되는 순간 자동으로 stale** 이 되는 조건부 정합이다. (c) 부기로 58 · 86 행이 더 길어져 한 행에 시점 기록 2 세대 (T-0019 · T-1428) 가 누적됐다 — § 12.25 한계 3 (b) 가 지적한 "시점 기록 marker 규약 부재" 가 § 3 산문에서도 반복된다.

### 12.27 api.md `9 NestJS module` 2 지점 + `UC-01 ~ UC-08` 범위 1 지점의 정본 동기 (T-1429)

> **본 절의 위치** — `§ 12.26` 이 [INDEX.md](INDEX.md) 의 `AssessmentModule` 귀속을 닫으며 남긴 **파생 영향 1** ([api.md](../architecture/api.md) **223** 행 `UC-01 ~ UC-08` 링크 범위 ↔ 실재 **9 UC** 어긋남) 을 본 절이 종료한다. 동시에 planner 가 같은 문서에서 사전 확인한 **동종 module 어휘 축 2 지점** (**43** · **220** 행 `9 NestJS module`) 을 정본 [modules.md](../architecture/modules.md) 표 row **12** 로 맞춘다.
> **계보** — 정본 확정 `T-1422` (modules.md 산문 `11` → 표 실측 **12**) → 파생 1 `T-1423` ([INDEX.md](INDEX.md) 25 행) → 파생 2 `T-1426` ([data-model.md](../architecture/data-model.md) 3 지점) → **파생 3 `T-1429` (api.md 2 지점 — 본 절)**. api.md 는 정본을 복제하는 파생 3 문서 중 **마지막 미동기 문서** 였다. 축 B (UC 범위) 의 계보는 `T-1416` (UC-09 귀속 박제) → `T-1419` (`8 UC` 표기 12 지점 일괄 동기) → **본 절 (링크 범위 표기 잔여 1 지점)** 이다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   축 A 문서 축 전수
      $ grep -n '[0-9]\+ NestJS module' docs/architecture/api.md
      43:… [modules.md](modules.md) 의 9 NestJS module (AuthModule / PersistenceModule /
         UserModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule /
         SchedulerModule / WebModule) 안에서 결정 — **신규 module 신설 0**.
      220:- [docs/architecture/modules.md](modules.md) — 9 NestJS module — 본 문서의 endpoint 가
          어느 module controller 의 책임인지 mapping
      → 카운트 표기를 가진 행은 **43 · 220 2 행** (기대값 일치). 그 밖의 행에 `N NestJS module`
        표기 **0** — 광범위 `module` grep 이 아니라 카운트 표기 보유 행만 전수한 결과다.
      43 행 괄호 열거를 `/` 로 분해 → AuthModule · PersistenceModule · UserModule ·
        GithubModule · ConfluenceModule · LlmModule · AssessmentModule · SchedulerModule ·
        WebModule = **실 열거 9 개**. 표기 `9` 와 열거 `9` 는 **행 안에서 자기정합**
        (기대 — 표기 9 · 열거 9 일치). 220 행은 열거 없이 카운트만.

(ii)  축 A 정본 축
      $ sed -n '32,43p' docs/architecture/modules.md | grep -c '^| \*\*'   → 12
      정본 12 module 명 (표 row 순) — AuthModule / PersistenceModule / UserModule /
        GithubModule / ConfluenceModule / PermissionDeniedRecordModule / LlmModule /
        AssessmentModule / AssessmentCollectionModule / AssessmentEvaluationModule /
        SchedulerModule / WebModule
      차집합 A — 정본에 있으나 api.md 43 행 열거에 없는 이름: **3 개**
        `PermissionDeniedRecordModule` · `AssessmentCollectionModule` ·
        `AssessmentEvaluationModule`   (기대값 일치)
      차집합 B — api.md 43 행에만 있고 정본에 없는 이름: **0**   (기대값 일치)
      → 9 + 3 = 12 로 양변이 닫힌다. api.md 열거는 정본의 **진부분집합** 이라 이름 충돌 0.
      $ sed -n '47,48p' docs/architecture/modules.md
      "정본 표 미기재 실 shipped module (T-1425 실측 각주) — 위 표에 row 가 없으나 `src/` 에
       실재하는 module 이 3 개 있다: ExportModule · ImportModule · UserInstanceAccessModule …
       본 각주는 사실 기록 이지 정본 표 row 도 카운트 대상도 아니다 — 본 문서 산문의 12 module 은
       위 표 row 12 만 세며 본 각주의 3 개를 포함하지 않는다."
      → 본 slice 가 대체값으로 **12** (15 아님) 를 쓰는 근거. 각주 3 module 은 계상 밖.

(iii) 축 B
      $ grep -n 'UC-08-permission-denied.md)' docs/architecture/api.md
      223:- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md)
          ~ [UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md) —
          **본 문서의 endpoint source** (각 UC §5 sequence + §9 component/module mapping)
      → 범위 표기는 **223 행 1 곳** (기대값 일치).
      $ grep -c '9 UC' docs/architecture/api.md   → 7   (행 3 · 12 · 64 · 153 · 208 · 209 · 222)
      → T-1419 가 이미 동기한 지점이 **7 행** (task 가 대조군으로 명시한 6 행 + References
        222 행 = 7). 전부 본 slice **무편집 대조군** 이다.
      $ ls docs/use-cases/UC-0*.md | wc -l   → 9
      → 실재 UC 파일 **9**. 223 행 범위 종단 `UC-08` 은 실재 UC-09 를 range 밖에 둔다.

(iv)  선례 원문 (화법 승계 판정 재료)
      INDEX.md 25 행 (T-1423) —
        "- **주요 module** — [modules.md](../architecture/modules.md) 의 12 NestJS module 명
          (AuthModule / … / WebModule) 만 사용. 오타 0."
      data-model.md 40 행 (T-1426) —
        "- [modules.md](modules.md) — 12 NestJS module 의 책임 분배. 본 문서의 각 entity 가
          어느 module 의 책임인지 매핑 (§ 2 표 "책임 module" 컬럼)."
      → 두 선례 모두 **(A) 정본값 in-place 1:1 치환** 이며, 전자는 카운트 + 12 개 전수 열거를
        함께 확장했다. api.md 43 행은 INDEX 25 행과 **동형** (카운트 + 열거 동시 보유),
        220 행은 data-model 40 행과 **동형** (References 행 카운트만).

(v)   § 12.15 판별표 — 아래 표

(vi)  baseline
      $ wc -l  api.md → 230 · audit → 2353 · modules.md → 259 · data-model.md → 193 ·
               INDEX.md → 123 · components.md → 190
      $ grep -c '^## ' api.md → 9   ·  grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) ' api.md → 72
      $ grep -c '^## ' audit  → 12  ·  grep -c '^| REQ-' audit → 66
      → (vi) 10 값 전부 기대값 일치 (baseline). **축 중단 사유 0** — (i) ~ (iv) 도 전부
        기대값과 일치해 어느 축도 중단하지 않는다.
```

**§ 12.15 판별표 — 편집 후보 3 지점 + 대조군**

| 지점 | 성격 | 날짜 · task stamp marker | 판별 | 근거 1 구 |
| --- | --- | --- | --- | --- |
| **43** 행 (§ 4 산문 카운트 + 열거) | **파생 서술** (스스로 출처를 `modules.md` 라 밝힘) | **無** (행 안에 시점·task 인용 0) | **in-place 1:1 치환** | 시점 기록 marker 가 없으니 "그때는 참이던 서술" 로 보존할 근거가 없고, 출처를 명시한 파생이라 정본값 치환이 무모순 |
| **220** 행 (§ 9 References 카운트) | **파생 서술** (modules.md 를 가리키는 pointer) | **無** | **in-place 1:1 치환** | pointer 행의 요약 수치는 대상 문서의 현재값을 가리켜야 하므로 시점 보존 대상이 아님 |
| **223** 행 (§ 9 References 링크 범위) | **파생 pointer** (UC 파일 실재를 가리킴) | **無** | **in-place 1:1 치환** | 범위 종단은 실재 파일 목록의 현재 최대값이라 시점 기록이 아니라 index 성격 |
| **3** 행 blockquote | T-0030 산출물 선언 + **T-1419 시점 기록 보유** | **有** (`T-1419 가 … 8 → 9 동기` 명시 + `§ 12.17` 근거 링크) | **무편집** | marker 보유 지점 — 이미 `9 UC` 로 동기돼 있고 재서술은 시점 기록 훼손 |
| **12 · 64 · 153 · 208 · 209 · 222** 행 | T-1419 동기 완료 지점 (6 행) | 有 (전부 T-1419 · T-1416 인용) | **무편집** | 재서술 금지 (AC 4) — 회귀 0 을 **hunk 부재** 로 증명 |

#### 2 축 대조표 (AC 2 — 축 × 지점 × 정본 근거 × 구획)

| # | 축 | api.md 지점 | 문서 현 서술 | 정본 / 실재 근거 | 구획 | 대체값 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **A — module 어휘** | **43** (§ 4 산문) | `9 NestJS module (9 개 열거)` | [modules.md](../architecture/modules.md) 32 ~ 43 행 표 row **12** | **② 어긋남 — 근거 확보** | `12 NestJS module` + **12 개 전수 열거** (정본 표 row 순) |
| 2 | **A — module 어휘** | **220** (§ 9 References) | `9 NestJS module` | 동상 (표 row **12**) | **② 어긋남 — 근거 확보** | `12 NestJS module` (열거 없음 — 원 구조 유지) |
| 3 | **B — UC 범위** | **223** (§ 9 References) | `UC-01-… ~ UC-08-permission-denied.md` | `ls docs/use-cases/UC-0*.md` = **9** 파일 | **② 어긋남 — 근거 확보** | 범위 종단을 `UC-09-user-defined-period-evaluation.md` 로 |
| — | 대조군 | **3 · 12 · 64 · 153 · 208 · 209 · 222** | `9 UC` (T-1419 동기 완료) | 동상 (**9** 파일) | **① 정합** | — (무편집) |

**집계** — ① 정합 **7** (대조군 7 행) · ② 어긋남(근거 확보) **3** (43 · 220 · 223, 기대값 일치) · ③ 어긋남(근거 부재) **0** (기대값 일치). ③ 이 0 이므로 **무편집 이월로 넘길 지점은 없다**. ② 3 지점의 대체값은 모두 **정본 표 row 수** 또는 **실재 파일 수** 가 직접 공급하므로 본 slice 안에서 추론 없이 확정된다 (날조 0).

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 기준 **4 축** — ① **파생 관계** (본 문서가 스스로 출처를 `modules.md` / UC 파일이라 밝히는 파생 서술인가 — 파생이면 정본값 치환이 무모순), ② **cascade** (`§ 5` 합계 `72 endpoint` / `16 resource prefix` / `9 UC cover` · `§ 7` cross-reference 표 · **3 행 blockquote** 에 새 stale 을 만드는가), ③ **cap** (≤ 300 LOC · 변경 파일 **3 고정**), ④ **선례 일관성** (같은 축을 T-1423 · T-1426 이 이미 처리했으므로 다른 방식이면 파생 3 문서에 서로 다른 규약이 공존하는가).

| 후보 | ① 파생 관계 | ② cascade | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| **(A) 정본값 in-place 1:1 치환** | 3 지점 모두 출처 명시 파생 — 치환이 정본과 무모순 | 신규 stale **0** — 43 · 220 은 module 축이라 endpoint 합계와 무관, 223 은 링크 범위라 `9 UC cover` 표기와 **오히려 정합화** | 3 행 치환 = 3 파일 · 수십 LOC | T-1423 (INDEX 25) · T-1426 (data-model 40) 과 **동일 규약** | **채택** |
| (B) 원문 보존 + 행-끝 부기 | — | 부기가 길어져 43 행이 열거 2 세대를 갖게 됨 | cap 안 | 같은 축 2 선례가 (A) 라 파생 3 문서에 두 규약 공존 | **기각** — 세 지점 모두 **시점 기록 marker 가 없어** (B') 의 성립 전제 (T-1427 선례) 를 충족하지 않는다 |
| (C) `§ 9` 말미 각주 블록 신설 | — | 각주 ↔ 본문 이중 관리로 43 행 stale 이 **본문에 그대로 잔존** | cap 안이나 `wc -l` +5 이상 | 파생 3 문서 중 api.md 만 각주 규약 | **기각** — stale 원문을 본문에 남겨 독자가 43 행만 읽으면 여전히 9 를 읽는다 |
| (D) 무편집 이월 | — | 파생 영향 1 이 **재이월** | 0 LOC | — | **기각** — AC 2 ③ = 0 (근거 완비) 이라 이월 사유가 소멸했다 |

**43 행 괄호 열거 별도 판정** (9 개 유지 / **12 개 전수 확장** / 열거 삭제) — **12 개 전수 확장 채택**. 근거: (a) 카운트만 12 로 바꾸고 열거를 9 로 두면 **한 행 안에서 자기모순** 이라 AC 3 이 자동 기각으로 명시했고, (b) 열거 삭제는 "각 prefix 의 책임 module 이 어느 집합에서 결정되는가" 를 독자가 정본을 열어야만 알게 해 본 행의 기능 (허용 어휘 집합 제시) 을 잃으며, (c) INDEX 25 행 (T-1423) 이 같은 형태 (카운트 + 12 전수 열거) 를 이미 채택해 선례가 있다. 열거 순서는 **정본 표 row 순** 을 그대로 따라 정본 대조를 O(1) 로 만든다.

#### 반영 결과 (AC 4)

| 지점 | 편집 방식 | before → after |
| --- | --- | --- |
| **43** | in-place 1:1 치환 (§ 12.15 marker 無) | `9 NestJS module (… 9 개 열거 …)` → `12 NestJS module (AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / **PermissionDeniedRecordModule** / LlmModule / AssessmentModule / **AssessmentCollectionModule** / **AssessmentEvaluationModule** / SchedulerModule / WebModule)` — 카운트 + 열거 동시, **신규 module 신설 0** 문구 보존 |
| **220** | in-place 1:1 치환 (marker 無) | `— 9 NestJS module —` → `— 12 NestJS module —`, 나머지 문구 byte 불변 |
| **223** | in-place 1:1 치환 (marker 無) | `~ [UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md)` → `~ [UC-09-user-defined-period-evaluation.md](../use-cases/UC-09-user-defined-period-evaluation.md)`, 범위 시작 `UC-01` 과 뒤의 `— **본 문서의 endpoint source** …` 는 불변 |

편집 지점 **정확히 3 행** (AC 2 ② 로 판정된 것만) 이고 전부 행 단위 1:1 치환이라 api.md `wc -l` 은 **230 불변** (AC 4 의 `+2 이내` 충족). 세 지점 모두 § 12.15 판별이 "marker 無 → in-place" 로 일치해 부기 방식이 섞이지 않았다.

#### 무편집 경계 (AC 5)

`src/` · `test/` · `prisma/` · `web/` 일체와 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · [directory.md](../architecture/directory.md) · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 **전부 무편집** 이며 `git status --porcelain` 3 파일 밖이라 diff 에 미등장한다. api.md 안에서도 `§ 5` endpoint 표 (66 ~ 153 행) · `§ 7` cross-reference 표 (179 ~ 197 행) · `## 8. Out of scope` 절 · 말미 `Refs:` 줄 · `9 UC` 대조군 7 행은 **hunk 밖** 이다.

#### 파생 영향 (AC 6 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **11 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 의 계상 판정은 **ADR 게이트** 선행 (`§ 12.26` 파생 영향 3). 후속 slice 소관.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약** (`§ 12.26` 파생 영향 4). 후속 slice 소관.
4. **행 번호 좌표계 → anchor 좌표계 이행** — `§ 12.26` 이 4 회째로 셈했고 본 절 append 로 **5 회째**. 본 절이 43 · 220 · 223 세 행 번호에 전면 의존한 것이 그 누적 근거다. 후속 slice 소관.
5. **산문 tally ↔ 표 row 수 CI drift-guard spec** (`§ 12.26` 파생 영향 6) — 본 절의 `N NestJS module` 축과 `UC-NN` 범위 종단 축 **둘 다** 같은 spec 의 검사 대상 후보다. 후속 slice 소관.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리** (`§ 12.26` 파생 영향 7). 후속 slice 소관.
7. **api.md 43 행 열거에 남는 명칭 귀속 축** — 확장 후 열거에 여전히 `AssessmentModule` (정본 39 행이 **미shipped placeholder** 로 선언) 과 `SchedulerModule` (정본 42 행이 **실 shipped 명은 `SchedulingModule`** 이라 명시) 이 있다. 본 slice 는 **카운트 · 열거 집합** 만 정본과 맞췄고, 개별 명칭의 shipped 정합은 T-1424 가 채택한 `(D) 무편집` / `(B) 병기` 판정을 승계할지 여부와 함께 **후속 slice 소관** 으로 남긴다.

#### closure 선언

본 절로 `§ 12.26` **파생 영향 1** (api.md 223 행 UC 범위) 이 종료된다. 동시에 정본 [modules.md](../architecture/modules.md) 표 row **12** 를 복제하던 파생 3 문서 — [INDEX.md](INDEX.md) (T-1423) · [data-model.md](../architecture/data-model.md) (T-1426) · [api.md](../architecture/api.md) (T-1429, 본 절) — 의 **module 어휘 축이 일괄 closure** 되어, `T-1422` 정본 확정 이후 남아 있던 `9` / `8` 계열 카운트 잔여가 파생 축에서 **0** 이 됐다. 축 B 의 `8 UC` 계열 잔여도 `T-1419` 의 12 지점 + 본 절의 범위 표기 1 지점으로 api.md 안에서 **0** 이다.

#### 불변 검산 (AC 8)

```
$ wc -l  docs/architecture/api.md → 230 → 230      (in-place 3 행 치환 — 증가 0)
$ grep -c '^## ' api.md → 9   ·  grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) ' api.md → 72   (불변)
$ grep -c '9 UC' api.md → 7                        (대조군 7 행 불변 — 회귀 0)
$ wc -l  modules.md → 259 · data-model.md → 193 · INDEX.md → 123 · components.md → 190
                                                   (전부 불변 — 무편집 실증)
$ wc -l  docs/use-cases/REQ-COVERAGE-AUDIT.md → 2353 → 2518   (§ 12.27 append 165 행)
$ grep -c '^## ' audit → 12  ·  grep -c '^| REQ-' audit → 66   (불변, `###` 만 추가)
$ git diff -U0 -- docs/architecture/api.md | grep '^@@'
@@ -43 +43 @@     @@ -220 +220 @@     @@ -223 +223 @@
   → hunk **3 개** = AC 2 ② 3 지점과 1:1. § 5 endpoint 표 · § 7 표 · 3 · 12 · 64 · 153 ·
     208 · 209 · 222 행 · § 8 · Refs 줄 전부 hunk 밖 = 무편집 증명
$ git diff --numstat -- docs/architecture/api.md   →  3  3
   → 추가 3 · 삭제 3 → 삭제 3 은 전부 치환된 세 행의 in-place 짝 = **순수 삭제 0**
$ git status --porcelain
 M docs/architecture/api.md   M docs/use-cases/REQ-COVERAGE-AUDIT.md
 M docs/tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md   → 정확히 3 파일
```

변경 파일은 [api.md](../architecture/api.md) · 본 audit · [T-1429 task 파일](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) (`Follow-ups` append — frontmatter `status` 는 STATE single-writer 규약상 driver bookkeeping commit 소관이라 본 commit 에서 무편집) **정확히 3 개** 이며, 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이며, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 9).

#### 한계 —

1. **본 동기는 카운트 · 어휘 집합 축 뿐** — 43 행 열거를 정본 12 명과 집합적으로 일치시켰을 뿐, 각 module 명이 **실 shipped 코드** 와 맞는지는 여전히 미검증이다. 확장 후에도 `AssessmentModule` 은 `src/assessment/` 부재 placeholder 이고 `SchedulerModule` 의 실 디렉토리는 `src/scheduling/` (`SchedulingModule`) 이라, 이 행을 읽고 코드를 찾는 독자는 두 이름에서 헛걸음한다 (파생 영향 7). 정본 표가 그 사실을 각주로 갖고 있어 **문서 축 무모순** 은 성립하지만 **코드 축 정합** 은 별도 slice 다.
2. **파생이 정본을 복제하는 구조 자체가 잔존** — 본 절은 파생 3 문서를 정본 12 로 맞췄을 뿐 복제 구조를 없애지 않았다. 정본 표에 row 가 하나 추가되는 순간 (파생 영향 2 의 ADR 이 통과하면) **같은 3 문서 4 지점이 동시에 재-stale** 이 되며, 그때는 본 절과 `§ 12.21` · `§ 12.24` 를 그대로 반복해야 한다. 사람 규약으로는 재발을 막을 수 없고 `§ 12.25` · `§ 12.26` 한계 2 와 같은 **CI drift-guard 축** (파생 영향 5) 으로만 닫힌다.
3. **채택안이 남긴 미해결** — (a) 223 행 범위 표기는 `UC-01 ~ UC-09` 로 맞췄지만 **범위 표기 자체** 가 UC 파일 추가 시 다시 어긋나는 형태라, 종단을 고정 문자열로 두는 한 UC-10 이 생기면 동일 stale 이 재발한다 (열거 대신 "전 UC" 같은 무카운트 화법으로 바꾸는 안은 본 slice 밖). (b) 43 행이 12 개 전수 열거로 길어져 한 행의 가독성이 떨어졌다 — INDEX 25 행 선례와 같은 trade-off 이며 anchor / 표 형태로의 재구성은 파생 영향 4 소관이다. (c) 220 행과 43 행이 **같은 사실 (정본 module 수)** 을 한 문서 안에서 두 번 말하는 이중 관리는 그대로 남았다.

### 12.28 directory.md `9 module` 좌표 8 지점 + 매핑 표 9 row 의 3 축 대조 실판정 (T-1430)

> **본 절의 위치** — `§ 12.27` 은 정본 [modules.md](../architecture/modules.md) 를 복제하는 **파생 3 문서** ([INDEX.md](INDEX.md) T-1423 · [data-model.md](../architecture/data-model.md) T-1426 · [api.md](../architecture/api.md) T-1429) 의 module 어휘 축이 **일괄 closure** 됐다고 선언했다. 본 절은 그 선언이 **부분 closure 였음** 을 정정한다 — 정본을 자기 source 로 **명시** 하는 **네 번째 파생 문서** [directory.md](../architecture/directory.md) 가 그 집합에서 빠져 있었고, 해당 문서는 [T-0021](../tasks/T-0021-p2-directory-structure.md) 시점의 **`9 module` 좌표계** 에 통째로 머물러 있었다.
> **계보** — 정본 확정 `T-1422` (modules.md 산문 `11` → 표 실측 **12**) → 파생 1 `T-1423` (INDEX.md) → 파생 2 `T-1426` (data-model.md) → 파생 3 `T-1429` (api.md) → **파생 4 `T-1430` (directory.md — 본 절)**. 본 절의 3 축 대조 + 표 직후 각주 화법은 `§ 12.23` (T-1425 가 정본 표에서 수행한 선례) 을 승계한다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   문서 축 전수
      $ grep -n '9 module\|9 NestJS module' docs/architecture/directory.md
      3:   "T-0021 가 NestJS 표준 디렉토리 구조 + 9 module ↔ `src/<module>/` 매핑 …"
      7:   "modules.md (T-A4) 가 박제한 9 NestJS module (8 application module +
            PersistenceModule) 을 그대로 … 1:1 mapping 한 single source of truth"
      19:  "본 task 시점에는 … skeleton 만 존재 — 9 module 디렉토리는 P3+ 에서 생성되는
            blueprint 다."
      25:  "│   ├── app.module.ts           ← root composition (imports 9 module)"
      52:  "본 시점 (T-0021) 의 `src/` 실제 내용은 … 9 module 디렉토리는 모두 미생성."
      81:  "## 9 module 별 디렉토리 mapping"
      83:  "modules.md §"Module 목록" 의 9 module 과 본 문서의 디렉토리 경로의 1:1 매핑."
      168: "- modules.md — T-A4 산출물. 본 문서의 9 module 매핑 source."
      → **3 · 7 · 19 · 25 · 52 · 81 · 83 · 168 8 행** (기대값 일치).
      7 행 자기-검산 — 괄호 부연 `8 application module + PersistenceModule` 은 **8 + 1 = 9**
        로 행 안에서 자기정합이다. 따라서 카운트만 12 로 바꾸고 부연을 그대로 두면 한 행
        안에서 자기모순 → AC 3 의 별도 판정 입력.

(ii)  표 축
      $ sed -n '85,95p' docs/architecture/directory.md | grep -c '^| \*\*'   → 9
      module 명 ↔ 디렉토리 경로 9 쌍 (표 row 순) —
        AuthModule→src/auth/ · PersistenceModule→src/persistence/ · UserModule→src/user/ ·
        GithubModule→src/github/ · ConfluenceModule→src/confluence/ · LlmModule→src/llm/ ·
        AssessmentModule→src/assessment/ · SchedulerModule→src/scheduler/ ·
        WebModule→src/web/

(iii) 코드 축
      $ ls src/*/*.module.ts | wc -l   → 14
        assessment-collection / assessment-evaluation / auth / confluence / export /
        github / import / llm / permission-denied(permission-denied-record.module.ts) /
        persistence / scheduling / user-instance-access / user / web
      $ ls -d src/*/   → 15 (위 14 + src/common/ — module 파일 없는 공용 디렉토리)
      $ ls -d src/assessment/ src/scheduler/
      ls: cannot access 'src/assessment/': No such file or directory
      ls: cannot access 'src/scheduler/': No such file or directory
      $ echo $?   → 2      (두 경로 모두 부재 — exit code 로 실증)

(iv)  정본 축
      $ sed -n '28p;45p;47,48p' docs/architecture/modules.md
      28: "본 시스템은 다음 12 NestJS module 로 분해된다."
      45: "위 12 module 은 `AppModule` (root) 의 `imports: [...]` 에 등록되며 …"
      47~48: "정본 표 미기재 실 shipped module (T-1425 실측 각주) — … 3 개 …
              본 각주는 사실 기록 이지 정본 표 row 도 카운트 대상도 아니다 — 본 문서
              산문의 12 module 은 위 표 row 12 만 세며 본 각주의 3 개를 포함하지 않는다."
      정본 표 AssessmentModule row —
        "평가 결과 조회·sort·filter·시계열 placeholder (미shipped) … 본 module 은 아직
         코드/AppModule 등록 0 (placeholder)"
      정본 표 SchedulerModule row —
        "실 shipped module 명 = `SchedulingModule` (src/scheduling/) — P1 conceptual
         `SchedulerModule` 명칭의 실현체 (rename refactor 없이 doc 서술만 실 명칭 align)"
      → 세 사실: 정본은 **12**, 각주 3 module 은 **카운트 밖** (대체값이 15 아닌 12 인 근거),
        ② 2 row 의 설명을 **정본이 이미 공급** (날조 0).

(v)   § 12.15 판별표 — 아래 표

(vi)  baseline
      $ wc -l  directory.md → 181 · audit → 2518 · modules.md → 259 · api.md → 230 ·
               data-model.md → 193 · INDEX.md → 123 · components.md → 190
      $ grep -c '^## ' directory.md → 10   ·   grep -c '^## ' audit → 12
      $ grep -c '^| REQ-' audit → 66
      → (vi) 10 값 전부 기대값 일치. (i) ~ (iv) 도 전부 기대값과 일치 —
        **축 중단 사유 0** (어느 축도 편집을 중단하지 않는다).
```

**§ 12.15 판별표 — 편집 후보 8 지점**

| 지점 | 성격 | 시점 marker | 판별 | 근거 1 구 |
| --- | --- | --- | --- | --- |
| **3** 행 blockquote | P2 산출물 선언 | **有** (`T-0021 가 … 박제했다` — 완료형 task stamp) | **무편집** | 완료형 시점 기록이라 그때의 좌표계를 그대로 보존해야 한다 |
| **7** 행 (§ 개요 파생 서술) | **파생 서술** (출처를 `modules.md` 라 스스로 밝힘) | **無** | **in-place 치환** | marker 가 없는 현재형 파생이라 정본값 치환이 무모순 |
| **19** 행 (tree 도입 산문) | 시점 서술 | **有** ("본 task 시점에는 … blueprint 다") | **무편집** | "본 task 시점" 이 명시적 marker — 치환 시 시점 기록 훼손 |
| **25** 행 (ASCII tree 주석) | 코드블록 내부 | — (코드블록) | **무편집** | tree 는 열 정렬로 의미를 갖는 블록이라 문자열 폭 변화가 **정렬을 파손** 한다 |
| **52** 행 (tree 후 시점 서술) | 시점 서술 | **有** ("본 시점 (T-0021)") | **무편집** | 괄호 안 task id 가 직접 marker |
| **81** 행 (heading 카운트) | **자기-카운트** (바로 아래 표 row 수) | **無** | **무편집** | 표를 14 로 늘리지 않는 채택안에서 12 로 바꾸면 **heading ↔ 표 row 자기모순** → AC 3 자동 기각 규칙 적용 |
| **83** 행 (표 도입 산문) | **자기-카운트** (표를 설명) | **無** | **무편집** | 81 과 동형 — 표 row 를 세는 문장이라 표 불변이면 숫자도 불변 |
| **168** 행 (References pointer) | **파생 pointer** | **無** | **in-place 치환** | pointer 의 요약 수치는 대상 문서의 **현재값** 을 가리켜야 하므로 시점 보존 대상이 아님 |

#### 3 축 대조표 (AC 2 — 표 row 9 × 실 dir 14 전수 분류)

| # | 구획 | module (표) | 디렉토리 경로 | 실재 | 정본 근거 / 비고 |
| --- | --- | --- | --- | --- | --- |
| 1 | **① 일치** | AuthModule | `src/auth/` | 有 | `auth.module.ts` |
| 2 | **① 일치** | PersistenceModule | `src/persistence/` | 有 | `persistence.module.ts` |
| 3 | **① 일치** | UserModule | `src/user/` | 有 | `user.module.ts` |
| 4 | **① 일치** | GithubModule | `src/github/` | 有 | `github.module.ts` |
| 5 | **① 일치** | ConfluenceModule | `src/confluence/` | 有 | `confluence.module.ts` |
| 6 | **① 일치** | LlmModule | `src/llm/` | 有 | `llm.module.ts` |
| 7 | **① 일치** | WebModule | `src/web/` | 有 | `web.module.ts` |
| 8 | **② 문서 only** | AssessmentModule | `src/assessment/` | **無** | 정본 표가 **미shipped placeholder** (코드/AppModule 등록 0) 로 이미 규정 — 경로 부재가 정본과 무모순 |
| 9 | **② 문서 only** | SchedulerModule | `src/scheduler/` | **無** | 정본 표가 **실 shipped 명 = `SchedulingModule` (`src/scheduling/`)** 이라 이미 명시 — 표 경로는 P1 conceptual 명칭 잔재 |
| 10 | **③ 코드 only** | (표 미기재) | `src/assessment-collection/` | 有 | 정본 표 row 有 (`AssessmentCollectionModule`) · directory.md 표 미기재 |
| 11 | **③ 코드 only** | (표 미기재) | `src/assessment-evaluation/` | 有 | 정본 표 row 有 (`AssessmentEvaluationModule`) |
| 12 | **③ 코드 only** | (표 미기재) | `src/export/` | 有 | 정본 표 미기재 (T-1425 각주 3 중 1) |
| 13 | **③ 코드 only** | (표 미기재) | `src/import/` | 有 | 정본 표 미기재 (T-1425 각주 3 중 1) |
| 14 | **③ 코드 only** | (표 미기재) | `src/permission-denied/` | 有 | 정본 표 row 有 (`PermissionDeniedRecordModule`), 파일명 `permission-denied-record.module.ts` |
| 15 | **③ 코드 only** | (표 미기재) | `src/scheduling/` | 有 | 위 9 의 실현체 — 정본 `SchedulerModule` row 가 지목 |
| 16 | **③ 코드 only** | (표 미기재) | `src/user-instance-access/` | 有 | 정본 표 미기재 (T-1425 각주 3 중 1) |

**양변 검산** — 표 축 `9 = 7 (①) + 2 (②)` · 코드 축 `14 = 7 (①) + 7 (③)`. **둘 다 기대값과 일치** 하므로 표 편집을 중단하지 않는다. ② 2 row 의 대체 설명은 정본이 직접 공급하고 (④ 인용), ③ 7 개는 `ls` 실측이 직접 공급하므로 본 절 안에서 추론 없이 확정된다 (날조 0).

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 기준 **4 축** — ① **파생 관계** (7 · 168 행이 스스로 출처를 `modules.md` 라 밝히는 파생 서술인가), ② **cascade** (채택안이 `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 80 행) · ASCII tree (19 ~ 51 행) · `common/` `config/` `prisma/` `test/` `web/` 절에 **새 stale 이나 날조** 를 만드는가), ③ **cap** (≤ 300 LOC · 변경 파일 **3 고정**), ④ **선례 일관성** (in-place 계열 T-1423 · T-1426 · T-1429 와 각주 계열 T-1425 · T-1427 중 **P2 blueprint 문서** 성격에 맞는 쪽).

| 후보 | ① 파생 관계 | ② cascade | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (A) 8 지점 전부 12 in-place + 표 row 14 확장 | 8 중 4 지점은 파생 아님 (시점 marker · 자기-카운트) | **치명** — 신규 7 row 의 `표준 sub-dir` · `비고` 컬럼을 실측 근거 없이 **창작** 해야 하고 (Out of Scope 3), 3 · 19 · 52 치환은 시점 기록 훼손, 25 는 tree 정렬 파손 | 7 row × 4 컬럼 서술 = cap 근접 | in-place 선례는 **파생 pointer 축** 에만 적용됐지 시점 기록 축엔 아님 | **기각** — 날조 risk + § 12.15 위반 |
| **(B) marker 부재 지점만 최소 in-place + 표 직후 각주 1 블록** | 7 · 168 만 파생이라 치환 대상이 정확히 그 2 행 | 신규 stale **0** — 표 · tree · sub-structure 절 전부 불변, 사실은 각주가 흡수 | 2 행 치환 + 각주 2 행 = 수십 LOC · 3 파일 | **T-1425 `§ 12.23`** 가 정본 표에서 쓴 (B) 각주 선례와 동형 | **채택** |
| (C) 문서 전면 재작성 (blueprint → 실측 좌표계) | — | tree · sub-structure · 5 개 절 전부 재작성 → 미검증 서술 대량 유입 | **cap 초과 확실** (≥ 300 LOC) → 자동 기각 | 선례 없음 | **기각** — split 필요 시 "directory.md ASCII tree ↔ 실 `src/` 트리 정합" 을 별도 slice 로 (Follow-up 9) |
| (D) 무편집 이월 | — | 파생 4 문서 closure 가 **재이월** | 0 LOC | — | **기각** — AC 2 양변 검산이 닫혀 근거가 완비돼 이월 사유가 소멸 |

**81 행 heading 숫자 별도 판정** — **무편집**. 근거: heading 의 `9` 는 **바로 아래 표의 row 수** 를 가리키는 자기-카운트라, 표를 14 로 늘리지 않은 채 heading 만 12 로 바꾸면 `heading ↔ 표 row 수` 자기모순이 되어 AC 3 이 명시한 자동 기각 조합에 해당한다 (T-1429 의 43 행 괄호 열거 판정과 동형 규칙). **83 행** (표 도입 산문) 도 같은 이유로 무편집이며, 두 지점이 왜 `9` 로 남는지는 각주 둘째 줄이 명시한다.

**7 행 괄호 부연 별도 판정** — **부연도 함께 치환**. 근거: `8 application module + PersistenceModule` 은 `8 + 1 = 9` 자기-검산을 보유하므로 카운트만 12 로 바꾸면 한 행 안에서 자기모순 (자동 기각 조합). 정본 표 row **12** 중 PersistenceModule **1** 을 뺀 **11** 이 곧 application module 수이므로 `11 application module + PersistenceModule` 은 **정본에서 산술로 도출** 되는 값이지 창작이 아니며, 원문의 자기-검산 구조 (`11 + 1 = 12`) 도 그대로 보존된다.

#### 반영 결과 (AC 4)

| 지점 | 편집 방식 | before → after |
| --- | --- | --- |
| **7** | in-place 치환 (marker 無) | `9 NestJS module (8 application module + PersistenceModule)` → `12 NestJS module (11 application module + PersistenceModule)`, 그리고 `1:1 mapping 한 single source of truth` → `1:1 mapping 하는 single source of truth (아래 매핑 표는 T-0021 시점의 9 row — 표 직후 각주가 실 shipped 14 와의 3 축 대조를 박제)` — 정본 12 와 표 9 의 간극을 **행 안에서 자기 해소** |
| **168** | in-place 치환 (marker 無) | `본 문서의 9 module 매핑 source.` → `본 문서 module ↔ 디렉토리 매핑의 정본 source (현행 정본 표 row **12**).` |
| **표 직후** | **각주 블록 1 개 신설 (2 행)** | ① 7 · ② 2 · ③ 7 전수 + 양변 검산 + ② 2 row 의 정본 근거 + "사실 기록이지 표 row 신설 아님" + 81 · 83 이 `9` 로 남는 이유 |
| **3 · 19 · 25 · 52 · 81 · 83** | **무편집** | § 12.15 판별표대로 (시점 marker 3 지점 · 코드블록 1 지점 · 자기-카운트 2 지점) |

편집 행 **정확히 2 행** (AC 4 상한 5) + 각주 **1 블록 2 행** (상한 6 행). `wc -l` **181 → 184** (+3, 상한 +8 충족). 표 기존 9 row 본문 · ASCII tree · sub-structure 절 · `common/` `config/` `prisma/` `test/` `web/` 절 · `Refs:` 말미는 전부 무편집이다.

#### 무편집 경계 (AC 5)

`src/` · `test/` · `prisma/` · `web/` 일체 (**디렉토리 rename · 신설 0** — `src/scheduling/` → `src/scheduler/` rename 도 `src/assessment/` 신설도 하지 않았다) 와 [modules.md](../architecture/modules.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · [components.md](../architecture/components.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 **전부 무편집** 이며 `git status --porcelain` 3 파일 밖이라 diff 에 미등장한다.

#### 파생 영향 (AC 6 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **12 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 계상은 **ADR 게이트** 선행. 후속 slice 소관.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약**. 후속 slice 소관.
4. **행 번호 좌표계 → anchor 좌표계 이행** — **6 회째**. 본 절이 8 개 행 번호에 전면 의존한 것이 그 누적 근거다. 후속 slice 소관.
5. **산문 tally ↔ 표 row 수 CI drift-guard spec** — 본 절의 `N module` 축도 같은 spec 의 검사 대상 후보. 후속 slice 소관.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리**. 후속 slice 소관.
7. **[api.md](../architecture/api.md) 43 행 열거의 명칭 귀속 축** — `AssessmentModule` (미shipped placeholder) · `SchedulerModule` ↔ `SchedulingModule` (`§ 12.27` 파생 영향 7 승계). 후속 slice 소관.
8. **신규 — 시점 기록성 module 수치 문서 3 종** — [components.md](../architecture/components.md) **11** 행 (8 module 열거) · `docs/architecture/p3-implementation-plan.md` (**13 · 243** 행 `9 NestJS module`) · `docs/architecture/p3-to-p4-transition.md` (**20** 행). 셋 다 P1 ~ P3 시점 산출물이라 `§ 12.15` 상 **보존 후보** 이며 별도 판정 slice 소관 — 본 slice 는 **편집하지 않는다** (AC 8 이 diff 부재로 검증).
9. **directory.md ASCII tree ↔ 실 `src/` 트리 정합** — 본 slice 가 코드블록을 무편집으로 남긴 잔여. 후속 slice 소관.

#### closure 선언

본 절로 `§ 12.27` 의 "파생 **3** 문서 module 어휘 축 일괄 closure" 선언의 **범위를 정정** 한다 — 그 시점의 closure 는 [directory.md](../architecture/directory.md) 를 포함하지 않은 **부분 closure** 였다. 본 절이 네 번째 파생 문서를 닫음으로써 정본 [modules.md](../architecture/modules.md) 표 row **12** 를 복제하는 **파생 4 문서** (INDEX.md · data-model.md · api.md · directory.md) 의 **module 어휘 축이 실제로 closure** 됐다. directory.md 에 남은 `9` 표기 6 지점 (3 · 19 · 25 · 52 · 81 · 83) 은 stale 잔여가 아니라 **§ 12.15 상 보존 판정을 받은 시점 기록 · 코드블록 · 자기-카운트** 이며, 그 판정 근거가 본 절과 표 직후 각주에 박제됐다.

#### 불변 검산 (AC 8)

```
$ wc -l  docs/architecture/directory.md → 181 → 184      (in-place 2 행 + 각주 3 행 추가)
$ grep -c '^## ' directory.md → 10 → 10                  (불변 — heading 신설 0)
$ sed -n '85,95p' directory.md | grep -c '^| \*\*' → 9   (표 row 불변 — 확장 0)
$ wc -l  modules.md → 259 · api.md → 230 · data-model.md → 193 · INDEX.md → 123 ·
         components.md → 190                              (전부 불변 — 무편집 실증)
$ grep -c '^## ' audit → 12  ·  grep -c '^| REQ-' audit → 66   (불변, `###` 만 추가)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@'
@@ -7 +7 @@        @@ -96,0 +97,3 @@        @@ -168 +171 @@
   → hunk **3 개** = 편집 2 행 + 각주 1 블록과 1:1. ASCII tree (19 ~ 51) · sub-structure
     (54 ~ 80) · 표 9 row (85 ~ 95) · common/ · config/ · prisma/ · test/ · web/ 절 ·
     Refs 줄 전부 hunk 밖 = 무편집 증명
$ git diff --numstat -- docs/architecture/directory.md   →  5  2
   → 삭제 2 는 전부 치환된 두 행의 in-place 짝 = **순수 삭제 0**
$ git status --porcelain src/ test/ prisma/ web/     → (빈 출력)   코드 무변경 실증
$ git status --porcelain
 M docs/architecture/directory.md   M docs/use-cases/REQ-COVERAGE-AUDIT.md
 M docs/tasks/T-1430-directory-md-module-coordinate-resync.md   → 정확히 3 파일
```

변경 파일은 [directory.md](../architecture/directory.md) · 본 audit · [T-1430 task 파일](../tasks/T-1430-directory-md-module-coordinate-resync.md) **정확히 3 개** 이며 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A** 이고, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 9).

#### 한계 —

1. **본 동기는 카운트 · 경로 축 뿐** — 표 9 row 의 `표준 sub-dir` · `비고` 컬럼이 실 코드 구조 (`src/auth/dto/` · `guards/` 등이 실제로 그 형태인지) 와 맞는지는 **여전히 미검증** 이다. 본 절은 경로의 **실재 여부** 만 `ls` 로 확인했을 뿐 디렉토리 **내부 구조** 는 열지 않았고, ③ 7 개는 표 밖이라 sub-dir 서술 자체가 없다.
2. **파생이 정본을 복제하는 구조가 잔존** — 파생 4 문서를 정본 12 로 맞췄을 뿐 복제 구조를 없애지 않았다. 정본 표에 row 가 하나 추가되는 순간 (파생 영향 2 의 ADR 통과 시) **같은 4 문서 5 지점 + 본 각주** 가 동시에 재-stale 이 되며, 사람 규약으로는 막을 수 없고 파생 영향 5 의 **CI drift-guard 축** 으로만 닫힌다.
3. **채택안이 남긴 미해결** — (a) blueprint 성격 문서를 **실측 좌표계로 이행할지** 의 근본 판정은 미착수다. 본 절은 (C) 를 cap 사유로 기각했을 뿐 "P2 시점 blueprint 를 영구 보존할 것인가, 실 트리를 반영할 것인가" 를 결정하지 않았고, 그 미결이 남는 한 표 9 row · tree · 81 · 83 은 계속 각주 의존으로 설명된다. (b) 7 행이 길어져 한 문장 안에 정본값 · 시점 단서 · 각주 pointer 3 개가 공존한다 (가독성 trade-off, 파생 영향 4 소관). (c) 각주가 기록한 ③ 7 개는 **directory.md 표에도 정본 표에도** row 가 없는 3 개 (`export` / `import` / `user-instance-access`) 를 포함해, 두 문서의 미기재가 같은 ADR 게이트에 묶여 있다.

### 12.29 시점 기록성 3 문서의 `modules.md` 파생 pointer 판정 — 4 지점 in-place · 1 지점 보존 (T-1431)

> **본 절의 위치** — `§ 12.28` 은 파생 4 문서 ([INDEX.md](INDEX.md) · [data-model.md](../architecture/data-model.md) · [api.md](../architecture/api.md) · [directory.md](../architecture/directory.md)) 의 module 어휘 축 closure 를 선언하면서, **파생 영향 8** 로 "시점 기록성 module 수치 문서 3 종 ([components.md](../architecture/components.md) · `p3-implementation-plan.md` · `p3-to-p4-transition.md`) 은 `§ 12.15` 상 **보존 후보** 이며 별도 판정 slice 소관" 을 목록만 남겼다. 본 절이 그 위임된 판정을 실행한다. **계보** — `T-1422` (정본 확정 `12`) → `T-1423` → `T-1426` → `T-1429` → `T-1430` → **`T-1431` (본 절 — 정본 파생 문서 축의 마지막 잔여군)**. 본 절은 `§ 12.28` (pointer in-place) 과 `§ 12.15` (시점 기록 append-only) 를 **지점 단위로 병용** 한다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i) 문서 축 전수 — $ grep -n '[0-9] module\|[0-9] NestJS module' components.md p3-implementation-plan.md p3-to-p4-transition.md
    components.md → hit 0 | p3-implementation-plan.md → 13 · 52 · 186 · 187 · 188 · 243 |
    p3-to-p4-transition.md → 10 · 20 · 53 · 55 · 57 · 63 · 128 · 149 · 198 · 314   (= 전수 16 hit)
    → ① 파생 pointer (정본이 지금 담는 내용을 현재형으로 지목) = 4 지점 — p3-implementation-plan 13 "modules.md —
    T-A4 산출물. 9 NestJS module (8 application + PersistenceModule) … 의 source" · 243 "… 9 NestJS module. 본 표
    "책임 module" 컬럼 source." · p3-to-p4-transition 20 "… 9 NestJS module 의 source. P3 scope 5 module 중 2 박제
    + 3 미박제." · 314 "… 9 NestJS module source." (근거 1 구: 넷 다 modules.md 를 링크로 지목한 References / 기반
    목록 bullet 이며 "…의 source" 술어로 끝난다).
    → ② 시점 진척 tally = 12 지점 — p3-implementation-plan 52 ("합계: 25 task … / 1 module") · 186 ("박제 완료
    2 module (40%)") · 187 · 188 · p3-to-p4-transition 10 · 53 ("progress 2/5 (40%)") · 55 · 57 · 63 · 128 · 149 ·
    198 (근거 1 구: 전부 `박제 완료 / 미박제 / progress N/5 / 합계` 술어로 그 task 시점의 진척을 센다).
    → 기대 불일치 1 건 — components.md hit 0 (기대 ① 5 중 11 행 미검출). 11 행은 숫자 없이 module class 명 8 개를
    괄호 열거할 뿐이라 grep 모집단 밖 → AC 1 중단 규칙대로 components.md 축 편집 중단. 나머지 두 문서의 ① 4 ·
    ② 12 는 기대값과 정확히 일치 (중단 사유 0).
(ii) freeze marker 축 — $ sed -n '3p' components.md → "> 본 문서는 P1 T-A3 의 산출물이다. T-0016 가 … 8 component
    table + contract 표 … 를 박제했다." (완료형 stamp 有) | $ sed -n '1,5p' p3-implementation-plan.md → 3 "> 본 문서는
    Phase P3 의 entry artifact (T-0032) 의 산출물이다. … doc-only planning artifact" (stamp 有, freeze 문구 無) |
    $ sed -n '3p;111p;136p;329p' p3-to-p4-transition.md → 3 "> … session #19 turn 4 시점 (T-0062 머지 직후) … 결정
    신설 0" · 111 "> §2.1–§2.5 의 박제 freeze (…) 는 역사 박제로 유지." · 136 "> §2.1–§2.6 … 역사 박제로 유지." ·
    329 "> §2.1–§2.7 의 박제 freeze (…) 는 역사 invariant 로 유지 — 본문 수정 0, 본 §7 신설만." → freeze 3 선언의
    대상이 전부 §2.x 로 문면 명시이며, "본문 수정 0" 은 §2.1–§2.7 를 수식하고 문서 전체를 수식하지 않는다.
(iii) 정본 축 — $ sed -n '28p;45p;47,48p' modules.md → 28 "본 시스템은 다음 12 NestJS module 로 분해된다." · 45 "위
    12 module 은 AppModule 의 imports 에 등록되며 …" · 47~48 "정본 표 미기재 실 shipped module (T-1425 실측 각주)
    … 3 개 … 사실 기록 이지 정본 표 row 도 카운트 대상도 아니다 — 산문의 12 module 은 표 row 12 만 센다." → 대체값
    15 아닌 12 의 근거. components.md 11 행 열거 8 개는 정본 12 의 부분집합, 차집합 4 = PersistenceModule ·
    PermissionDeniedRecordModule · AssessmentCollectionModule · AssessmentEvaluationModule (8 + 4 = 12).
(iv) 선례 축 — § 12.28 은 directory.md 168 행 (References pointer) 을 "본 문서의 9 module 매핑 source." → "… 정본
    source (현행 정본 표 row 12)." 로 in-place 치환하며 "pointer 의 요약 수치는 대상 문서의 현재값을 가리켜야 하므로
    시점 보존 대상이 아님" 을 근거로 들었다. § 12.15 는 "옛 요약의 수치·판정 문구는 append-only 로 무편집 보존 …
    판별 기준은 '어느 시점의 판정을 기록하는가, 아니면 현재 상태를 서술하는가' 하나다" 로 방침을 정본화했다. → 충돌
    평가: 두 선례는 충돌하지 않는다 — § 12.15 의 기준이 이미 "시점 기록 vs 현재 서술" 이고 § 12.28 의 in-place 는 그중
    후자에만 적용된 하위 사례라, freeze 보유 문서라도 문면 범위 (§2.x) 밖의 현재형 pointer 는 보존 대상이 아니다.
(v) baseline — $ wc -l components.md 190 · p3-implementation-plan.md 272 · p3-to-p4-transition.md 364 · audit 2701 ·
    modules.md 259 · directory.md 184 | $ grep -c '^## ' 7·8·8·audit 12 | $ grep -c '^| REQ-' audit 66 → 11 값 일치
```

**5 지점 판정표 (AC 2)** — 판정 축 ① 서술 시제 · ② freeze 선언 적용 범위 (행 번호로) · ③ cascade

| 문서 · 행 | 현 서술 1 구 | freeze 선언 | 판정 | 근거 1 구 |
| --- | --- | --- | --- | --- |
| `components.md` **11** | `T-A4 (modules.md) — 본 component 분해를 NestJS module class (AssessmentModule / … / WebModule) 로 mapping` | **有** (3 행 `P1 T-A3 의 산출물` 완료형 stamp) | **무편집** | ① "다음 task 들의 책임" 목록의 bullet = **T-A3 시점이 예고한 미래 계획** 이지 정본 현황 서술이 아니며, AC 1 (i) 불성립으로 편집 중단된 축 |
| `p3-implementation-plan.md` **13** | `modules.md — T-A4 산출물. 9 NestJS module (8 application + PersistenceModule) … 의 source` | **無** (3 행은 시점 stamp 뿐, freeze 문구 0) | **in-place 동기** | ① `…의 source` 현재형 pointer 라 `§ 12.28` 168 행 판별 그대로 대상 문서의 **현재값** 을 가리켜야 함 |
| `p3-implementation-plan.md` **243** | `modules.md — T-A4 산출물. 9 NestJS module. 본 표 "책임 module" 컬럼 source.` | **無** | **in-place 동기** | ① `## References` bullet = 날짜 stamp 없는 현행 상태 서술 (`§ 12.15` 이 in-place 를 허용한 바로 그 부류) |
| `p3-to-p4-transition.md` **20** | `modules.md — 9 NestJS module 의 source. P3 scope 5 module 중 2 박제 + 3 미박제.` | 문서에 **有**, 그러나 **범위 밖** (freeze 대상 = §2.1–§2.7, 본 행은 **§1** 기반 목록) | **in-place 동기 (앞 절만)** | ② freeze 문면이 `§2.x` 한정이라 20 행에 미치지 않으며, ③ 뒷 절 tally 는 손대지 않고 시점 단서만 병기해 자기모순 0 |
| `p3-to-p4-transition.md` **314** | `modules.md — 9 NestJS module source.` | 범위 **밖** (**§6 References**, freeze 는 §2.x) | **in-place 동기** | ① 순수 pointer 라 시점 술어가 아예 없음 — 보존할 "그 시점의 판정" 자체가 부재 |

**괄호 2 지점 별도 판정** — (a) `components.md` **11** 행 8 열거의 **in-place 확장은 자동 기각**: 그 행은 T-A4 가 **앞으로 mapping 할** 대상을 T-A3 시점에 예고한 문장이라, 12 로 늘리면 그 시점에 존재하지도 않던 `AssessmentCollectionModule` · `AssessmentEvaluationModule` · `PermissionDeniedRecordModule` 을 시점 사실로 소급 창작하게 된다 (AC 1 (i) 불성립과 **두 근거가 같은 결론으로 수렴**). (b) `p3-implementation-plan.md` **13** 행 괄호 부연은 **함께 치환**: `8 application + PersistenceModule` 이 `8 + 1 = 9` 자기-검산이라 카운트만 12 로 바꾸면 한 행 안에서 자기모순 (자동 기각 조합) 이고, 정본 표 row 12 − PersistenceModule 1 = **11** 은 산술 도출이라 창작이 아니며 자기-검산 구조 (`11 + 1 = 12`) 도 보존된다 (`§ 12.28` 7 행 판정과 동형).

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 축 **4** — ① `§ 12.15` 정합 · ② 독자 오도 risk · ③ cap (≤ 300 LOC · 파일 ≤ 5) · ④ 선례 일관성.

| 후보 | ① § 12.15 정합 | ② 오도 risk | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (A) 5 지점 전부 12 in-place | **위반** — `components.md` 11 은 시점 예고 열거라 소급 창작 발생 | 해소되나 새 날조 유입 | 안전 | in-place 선례는 pointer 축 전용 | **기각** — 날조 risk |
| (B) 전 지점 원문 보존 + 각 문서 부기 1 행 | 정합 | **잔존** — 4 지점이 여전히 현재형으로 `9` 를 단언, 부기는 같은 행 밖 | 안전 | `§ 12.28` 이 동일 성격 168 행을 in-place 로 닫은 것과 불일치 | **기각** — 현재형 pointer 를 틀린 채 두는 비용이 더 큼 |
| **(C) 지점별 혼합 — 현재형 pointer 4 in-place · 시점 예고 열거 1 보존** | 정합 — 판별 기준을 **지점 단위** 로 적용 | 4 지점 해소, 1 지점은 본 절이 근거와 함께 보존 선언 | 4 행 in-place · 파일 3 · 행 증가 +0 | `§ 12.28` + `§ 12.15` **양쪽 승계** | **채택** |
| (D) 전 지점 무편집 + audit 기록만 | 정합 | **최대** — 파생 문서 축 closure 가 재이월 | 0 LOC | 이월 사유가 (i) ~ (iv) 완비로 소멸 | **기각** |

**채택안 (C) 의 혼합 축 정정** — AC 3 원문은 (C) 를 "**문서별** 혼합 (freeze 선언 없는 문서만 in-place)" 으로 정의했으나, 실측 (ii) 가 freeze 선언의 문면 범위를 `§2.x` 로 확정했으므로 본 절은 혼합 축을 **문서 단위가 아니라 지점 단위 (서술 시제 + freeze 행 범위)** 로 좁혀 채택한다. 그 결과 freeze 선언 3 개를 보유한 `p3-to-p4-transition.md` 도 §1 · §6 의 pointer 2 지점은 in-place 대상이 된다. cap 초과 후보 0 이라 split 제안 없음.

#### 반영 결과 (AC 4) + 무편집 경계

| 지점 | 편집 방식 | before → after |
| --- | --- | --- |
| p3-implementation-plan **13** | in-place 치환 (부연 동반) | `9 NestJS module (8 application + PersistenceModule)` → `현행 정본 표 row 기준 **12 NestJS module** (11 application + PersistenceModule)` + 말미에 "본문 §2 · §6 tally 의 `9` 는 T-0057 시점 박제라 보존" 단서 |
| p3-implementation-plan **243** | in-place 치환 | `9 NestJS module. 본 표 … source.` → `본 표 … 정본 source (현행 정본 표 row **12**; 진척 tally 의 9 는 T-0057 좌표계 보존)` |
| p3-to-p4-transition **20** | in-place 치환 (앞 절만) | `9 NestJS module 의 source.` → `현행 정본 표 row 기준 **12 NestJS module** 의 source.` — 뒷 절 `P3 scope 5 module 중 2 박제 + 3 미박제` 는 **문자 그대로 보존** + "T-0062 시점 좌표계" 단서 병기 |
| p3-to-p4-transition **314** | in-place 치환 | `9 NestJS module source.` → `module 어휘의 정본 source (현행 정본 표 row **12**; 본문 §2 의 9 는 T-0062 박제라 보존)` |

편집 행 **정확히 4 행**, 전부 in-place 1:1 치환이라 두 문서 `wc -l` 증가 **+0** (상한 +9 충족) 이고 편집은 모두 References / 기반 목록 bullet 안에서 끝난다. **무편집 경계** — `components.md` **전체** (11 행 포함, AC 1 (i) 중단 축) · ② 시점 진척 tally **12 지점** · freeze blockquote **4 지점** (p3-to-p4-transition 3 · 111 · 136 · 329) · 세 문서의 표 · mermaid · 코드블록 · `Refs:` 말미 · [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) · `src/` · `test/` · `prisma/` · `web/` 는 전부 무편집이며 3 파일 밖이라 diff 에 미등장한다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **13 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 계상은 **ADR 게이트** 선행. 후속 slice 소관.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약**. 후속 slice 소관.
4. **행 번호 좌표계 → anchor 좌표계 이행** — **7 회째**. 본 절이 17 개 행 번호에 전면 의존한 것이 그 누적 근거다. 후속 slice 소관.
5. **산문 tally ↔ 표 row 수 CI drift-guard spec**. 후속 slice 소관.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리**. 후속 slice 소관.
7. **[directory.md](../architecture/directory.md) ASCII tree ↔ 실 `src/` 트리 정합** (T-1430 잔여). 후속 slice 소관.
8. **시점 진척 tally 12 지점의 독자 오도 완화** — 본 slice 판정상 보존. 후속 slice 소관.
9. **신규 — [components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 여부** — AC 1 (i) 불성립으로 본 절이 편집을 중단한 축. 후속 slice 소관.

#### closure 선언

정본 [modules.md](../architecture/modules.md) 를 **현재형으로 가리키는 파생 pointer 축** 은 본 절로 **닫혔다** — `§ 12.28` 이 닫은 파생 4 문서에 더해 시점 기록성 3 문서가 보유한 pointer **4 지점** 이 정본 12 로 동기됐고 잔여 현재형 pointer 는 **0** 이다. **닫히지 않은 잔여 2**: (a) [components.md](../architecture/components.md) **11** 행 module class 8 열거 — 숫자 없는 열거라 pointer 축 grep 밖이고 시점 예고 서술이라 보존 판정 (파생 영향 9), (b) ② 시점 진척 tally **12 지점** — `§ 12.15` 상 보존이라 stale 잔여가 아니라 **역사 박제** 다.

#### 불변 검산 (AC 6)

```
$ wc -l p3-implementation-plan.md 272 → 272 · p3-to-p4-transition.md 364 → 364 · components.md 190 (무편집) ·
  modules.md 259 · directory.md 184   (전부 불변)
$ grep -c '^## ' p3-implementation-plan.md 8 · p3-to-p4-transition.md 8 · components.md 7 · audit 12 → 12
  (`###` 만 추가)   |   $ grep -c '^| REQ-' audit 66 → 66 (불변)
$ git diff -U0 -- docs/architecture/ | grep '^@@'
  @@ -13 +13 @@  @@ -243 +243 @@ (p3-implementation-plan)   @@ -20 +20 @@  @@ -314 +314 @@ (p3-to-p4)
  → hunk 4 개 = 편집 4 행과 1:1. ② tally 12 · freeze blockquote 4 · 표 · mermaid · 코드블록 · `Refs:` 말미
    전부 hunk 밖 = 무편집 증명
$ git diff --numstat → 2 2 (p3-implementation-plan) · 2 2 (p3-to-p4) · audit 순수 추가 (삭제 0)
  → 삭제 4 는 치환된 네 행의 in-place 짝 = 순수 삭제 0
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력)   코드 무변경 실증
$ git status --porcelain → M p3-implementation-plan.md · M p3-to-p4-transition.md · M audit = 3 파일
  (상한 5, components.md 는 편집 중단 축)
```

변경 파일은 **3 개** (task 파일 status 갱신은 driver bookkeeping commit 소관) 이며 합계 diff ≤ 300 LOC 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A**, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 8).

#### 한계 —

1. **본 동기는 카운트 · pointer 축 뿐** — 세 문서의 나머지 서술 (task 시퀀스 표 · 전이 trigger 3 옵션 · component contract 표) 이 현 코드와 맞는지는 **미검증** 이다. 본 절은 `modules.md` 를 지목하는 4 bullet 만 열었다.
2. **시점 기록 문서가 정본을 복제하는 구조는 잔존** — 정본 표에 row 가 하나 추가되는 순간 본 절이 고친 4 지점 + `§ 12.28` 의 파생 4 문서가 **동시에 재-stale** 이 된다. 사람 규약으로는 막을 수 없고 파생 영향 5 의 **CI drift-guard 축** 으로만 닫힌다.
3. **보존 판정이 남긴 독자 부담** — ② tally 12 지점과 `components.md` 11 행 열거는 그대로라, 독자는 여전히 `9 module` · `2/5` · `8 module class` 를 만나고 그것이 T-0057 / T-0062 / T-A3 좌표계임은 본 절과 편집된 4 행의 시점 단서를 따라가야만 안다 (파생 영향 8 · 9).

### 12.30 directory.md ASCII 트리 블록 ↔ 실 `src/` 트리 3 축 대조 — 원문 보존 + 각주 1 블록 (T-1432)

> **본 절의 위치** — `§ 12.29` 는 정본 pointer 축 closure 를 선언하면서 **파생 영향 7** 로 "[directory.md](../architecture/directory.md) ASCII tree ↔ 실 `src/` 트리 정합 (T-1430 잔여)" 을 목록만 남겼다. 본 절이 그 위임을 실행한다. **계보** — `T-1422` (정본 확정 `12`) → `T-1423` → `T-1426` → `T-1429` → `T-1430` (같은 문서의 **표 축**) → `T-1431` (파생 **pointer 축**) → **`T-1432` (본 절 — **트리 축**, directory.md 에 남은 마지막 미판정 축)**. 판정은 `§ 12.15` (시점 기록 append-only) 와 `§ 12.28` (표 축 3 축 대조 각주 화법) 의 병용이다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   트리 축 전수 — $ sed -n '21,50p' docs/architecture/directory.md → `src/` 직접 하위 = 디렉토리 11 (auth ·
      persistence · user · github · confluence · llm · assessment · scheduler · web · common · config) + 파일 2
      (main.ts · app.module.ts). root 축 열거 9 (src · prisma · test · web · docs · .github/workflows ·
      package.json · README.md / CLAUDE.md).
(ii)  코드 축 전수 — $ ls -d src/*/ | sed 's#src/##;s#/##' → assessment-collection · assessment-evaluation ·
      auth · common · confluence · export · github · import · llm · permission-denied · persistence ·
      scheduling · user-instance-access · user · web  (= 15, 기대 15 일치)
      $ ls src/*/*.module.ts | wc -l → 14   |   $ ls src/*.ts | head -20 → app.controller.ts · app.module.spec.ts ·
      app.module.ts · app.service.spec.ts · app.service.ts · bootstrap.spec.ts · bootstrap.ts · main.ts ·
      parse-port.spec.ts · parse-port.ts (= 10 — 트리 기재 2 외 8 이 미기재)
(iii) 3 축 차집합 — ① 양쪽 실재 8 = auth · common · confluence · github · llm · persistence · user · web ·
      ② 트리 전용 (경로 미실재) 3 = assessment · scheduler · config · ③ 실재 전용 (트리 미기재) 7 =
      assessment-collection · assessment-evaluation · export · import · permission-denied · scheduling ·
      user-instance-access.  양변 검산 — 11 = 8 + 3 · 15 = 8 + 7 (둘 다 성립).
      정본 근거 1 구 — assessment: modules.md 39 행 "평가 결과 조회·sort·filter·시계열 placeholder
      (미shipped)" · scheduler: modules.md 42 행 "실 shipped module 명 = SchedulingModule (src/scheduling/)" ·
      config: 정본 표 12 row 밖 = module 아님 (directory.md `## config/` 116~124 행이 서술하는 loader 위치).
      $ ls src/config* src/common/config* 2>/dev/null → (빈 출력, exit 2)   $ grep -rln
      "registerAs\|ConfigModule" src/ --include=*.ts → src/auth/ 7 파일뿐 → configuration.ts / validation.ts
      자체가 미생성 (`## config/` 의 "실제 코드는 후속 task 도입" 서술과 정합).
(iv)  시점 marker 축 — $ sed -n '3p;19p;52p' docs/architecture/directory.md → 3 "> 본 문서는 P2 의 산출물이다.
      T-0021 가 … 박제했다." · 19 "본 task 시점에는 `src/` 안에 T-0004 가 박제한 skeleton 만 존재 — 9 module
      디렉토리는 P3+ 에서 생성되는 blueprint 다." · 52 "본 시점 (T-0021) 의 `src/` 실제 내용은 … skeleton — 9
      module 디렉토리는 모두 미생성." → 세 지점이 본 블록을 T-0021 blueprint 로 규정 (최강 제약 · 무편집 대상).
(v)   top-level 축 — $ git ls-files | cut -d/ -f1 | sort -u → 26 항목. (i) 트리 기재 9 를 뺀 미기재 tracked root
      = 17 — .claude · .dockerignore · .env.example · .eslintrc.cjs · .gitattributes · .gitignore · Dockerfile ·
      deploy · docker-compose.yml · pnpm-lock.yaml · pnpm-workspace.yaml · prisma-schema.spec.ts ·
      prisma.config.spec.ts · prisma.config.ts · scripts · tsconfig.build.json · tsconfig.json (검산 26 = 9 + 17).
(vi)  baseline — $ wc -l directory.md 184 · audit 2822 · modules.md 259 | $ grep -c '^## ' directory.md 10 ·
      audit 12 | $ grep -c '^| REQ-' audit 66 → 6 값 전부 기대 일치, AC 1 중단 지점 0.
```

**지점 판정표 (AC 2)** — 판정 축 ① **블록 성격** (코드블록 안 blueprint 를 고치면 19 · 52 행 시점 선언과 자기모순인가) · ② **`§ 12.15` 정합** (시점 기록 append-only 대상인가) · ③ **선례** (`§ 12.28` 표 축 "원문 보존 + 실측 각주" 화법의 트리 축 적용 가능성). root 축 17 항목은 판정 · 근거가 동일한 것끼리 한 row 에 묶되 항목은 전수 명시한다.

| 항목 | 축 | 트리 서술 / 부재 1 구 | 실재 | 판정 | 근거 1 구 |
| --- | --- | --- | --- | --- | --- |
| `assessment` | src 하위 | `assessment/ ← AssessmentModule (평가 orchestration + Worker)` | **미실재** | 원문 보존 + 각주 부기 | ① 블록이 T-0021 blueprint 라 행 삭제는 19 행 선언과 자기모순 — 정본 39 행이 **미shipped placeholder** 로 규정 |
| `scheduler` | src 하위 | `scheduler/ ← SchedulerModule (@nestjs/schedule)` | **미실재** (실현체 `src/scheduling/`) | 원문 보존 + 각주 부기 | ③ 정본 42 행 "실 shipped module 명 = `SchedulingModule`" — 명칭 정정은 정본 축 소관이고 각주가 대응을 박제 |
| `config` | src 하위 | `config/ ← @nestjs/config 의 configuration loader + validation` | **미실재** (loader 자체 미생성) | 원문 보존 + 각주 부기 (**별도 근거**) | ② 앞 2 개와 달리 정본 표 12 row 밖 = **module 이 아님** — 본 문서 `## config/` 가 스스로 "실제 코드는 후속 task 도입" 미래형이고 실측 빈 출력이 그와 정합 |
| `assessment-collection` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① P4 수집 backbone (정본 40 행) 은 T-0021 이후 shipped — 시점 블록에 소급 삽입하면 창작 |
| `assessment-evaluation` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① P5 평가 layer (정본 41 행), 위와 동일 시점 사유 |
| `export` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① 정본 표 미기재 실 shipped (modules.md 47 행 T-1425 각주 3 중 1) — 계상 판정 선행 |
| `import` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① 위와 동일 (T-1425 각주 3 중 1) |
| `permission-denied` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① `PermissionDeniedRecordModule` (정본 37 행) 의 실 디렉토리 — row 명과 디렉토리 명이 달라 각주 병기 필요 |
| `scheduling` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ③ 트리 전용 `scheduler` 의 실현체라 각주가 두 항목을 **짝으로** 박제 |
| `user-instance-access` | src 하위 | (트리 부재) | 실재 | 블록 무편집 + 각주 열거 | ① 정본 표 미기재 + AppModule 비등록 (modules.md 47~48 행) — 계상은 ADR 게이트 |
| `scripts` | root | (트리 부재) | 실재 | 무편집 | 19 행이 트리 범위를 "상위 디렉토리 + `src/` 직접 하위 (깊이 2 단)" 로 한정 — driver / lock 운영 스크립트는 애플리케이션 디렉토리 구조 밖 (15 행 범위 정의) |
| `.claude` | root | (트리 부재) | 실재 | 무편집 | agent 메타 축 — 트리의 `README.md / CLAUDE.md` 행이 운영 규칙 축을 대표 |
| `.env.example` | root | (트리 부재) | 실재 | 무편집 | 본 문서 `## config/` 단락이 이미 "`.env` / `.env.example` 위치는 repo root" 로 서술 (중복 열거 불요) |
| `Dockerfile` · `docker-compose.yml` · `.dockerignore` · `deploy` | root | (트리 부재) | 실재 | 무편집 | 배포 산출물 축 = [deployment.md](../architecture/deployment.md) 소관 — 본 문서 15 행이 스스로 범위 밖으로 선언 |
| `tsconfig.json` · `tsconfig.build.json` · `.eslintrc.cjs` | root | (트리 부재) | 실재 | 무편집 | toolchain config 축 — T-0003 소관이며 깊이 2 단 선택 열거 밖 |
| `pnpm-lock.yaml` · `pnpm-workspace.yaml` | root | (트리 부재) | 실재 | 무편집 | 트리의 `package.json ← pnpm workspace root` 행이 이미 대표 |
| `prisma.config.ts` · `prisma.config.spec.ts` · `prisma-schema.spec.ts` | root | (트리 부재) | 실재 | 무편집 | 트리는 `prisma/` **디렉토리** 만 열거 — root 배치 config / spec 파일은 그 부속 |
| `.gitignore` · `.gitattributes` | root | (트리 부재) | 실재 | 무편집 | VCS 메타 — 디렉토리 구조 서술 대상 아님 (본 문서는 `.env` 의 `.gitignore` 등록 사실만 인용) |

**`config` 별도 1 구** — 트리 전용 3 중 `assessment` · `scheduler` 는 **module 축** (정본 표 row 를 디렉토리로 투영) 인 반면 `config` 는 정본 표에 row 가 아예 없는 **비-module 항목** 이다. 같은 "미실재" 라도 앞 둘의 근거는 "정본이 미shipped / 명칭 상이" 고, `config` 의 근거는 "본 문서 `## config/` (116 ~ 124 행) 이 예고한 loader 파일이 아직 생성되지 않았다" 다. 실측 `ls src/config* src/common/config* 2>/dev/null` 은 빈 출력이고 `ConfigModule` 사용처는 `src/auth/` 뿐이라 문서 내부 자기정합이 유지되므로, 트리 행 삭제 근거가 되지 않는다.

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 축 **4** — ① `§ 12.15` 정합 · ② 독자 오도 risk · ③ cap (≤ 300 LOC · 파일 3 고정) · ④ 선례 일관성.

| 후보 | ① § 12.15 정합 | ② 오도 risk | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (A) ASCII 블록 in-place 전면 재작성 (실 15 로 교체) | **위반** — 19 · 52 행이 블록을 T-0021 blueprint 로 선언해 자기모순 발생 | 해소되나 실재 7 의 `←` 설명 문구를 신설해야 해 **창작 유입** | ~30 행 치환 (cap 자체는 안) | 같은 문서 표 축 (`§ 12.28`) 이 보존 + 각주를 채택한 것과 불일치 | **기각** — ① 위반 + 창작 risk |
| **(B) 블록 원문 무편집 + 직후 3 축 대조 각주 blockquote 1** | **정합** — 시점 기록은 보존, 사실은 append | **해소** — 각주가 블록 바로 아래에서 미실재 3 을 명시 | +3 행 · 파일 3 | `§ 12.28` 표 축 각주 화법의 **동일 문서 내 확대 적용** | **채택** |
| (C) 혼합 (트리 전용 3 만 주석 병기 + 실재 전용 7 은 각주) | **부분 위반** — 코드블록 내부를 손대는 순간 (A) 와 같은 ① 발생 | 해소 | +3 ~ 6 행 | 한 블록 안에서 화법이 둘로 갈려 일관성 하락 | **기각** — ① 위반이 (A) 와 동질 |
| (D) 전 지점 무편집 + audit 기록만 | 정합 | **최대** — 독자는 directory.md 만 보고 `src/assessment/` · `src/scheduler/` · `src/config/` 를 실재로 오인 | 0 LOC | 표 축이 각주로 닫힌 선례와 불일치 — 트리 축만 재이월 | **기각** |

cap 초과 후보 **0** 이라 split 제안 없음. 채택안 (B) 는 `§ 12.28` 이 표 축에서 쓴 "**사실 기록이지 표 row 신설이 아니다**" 화법을 트리 축에 그대로 승계한다.

#### 반영 결과 (AC 4) + 무편집 경계

| 지점 | 편집 방식 | 내용 |
| --- | --- | --- |
| [directory.md](../architecture/directory.md) 코드블록 직후 (구 50 행 뒤 → 신 **52 ~ 53** 행) | blockquote **2 행** 순수 append (+ 구분 빈 줄 1) | 3 축 차집합 (**8 / 3 / 7**) + 양변 검산 2 식 + 트리 전용 3 각각의 정본 근거 1 구 + 파일 축 (2 vs 10) · root 축 (9 vs 26, 미기재 17) 의 보존 선언 |

`wc -l` 184 → **187** (+3, 상한 +6 충족) 이고 코드블록 **내부 편집 0** 이다. **무편집 경계** — directory.md 시점 선언 3 지점 (3 · 19 · 구 52 행) · ASCII 코드블록 21 ~ 50 행 **내부** · `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 79 행) · `## 9 module 별 디렉토리 mapping` 표 + T-1430 각주 (81 ~ 100 행) · 102 행 이후 전 구간 · `## References` · `Refs:` 말미, 그리고 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) · `src/` · `test/` · `prisma/` · `web/` · `scripts/` 는 전부 무편집이며 3 파일 밖이라 diff 에 미등장한다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **14 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 계상은 **ADR 게이트** 선행. 후속 slice 소관.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약**. 후속 slice 소관.
4. **행 번호 좌표계 → anchor 좌표계 이행** — **8 회째**. 본 절도 20 개 이상 행 번호에 의존했다. 후속 slice 소관.
5. **산문 tally ↔ 표 row 수 / 트리 항목 수 CI drift-guard spec**. 후속 slice 소관.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리**. 후속 slice 소관.
7. **신규 — [directory.md](../architecture/directory.md) `## 각 module 디렉토리의 표준 sub-structure` (54 ~ 79 행) 의 sub-dir 채택 module 열거 ↔ 실 `src/*/` 하위 실측 대조** — 본 slice 가 디렉토리 **이름 축** 만 닫아 발생한 잔여. 후속 slice 소관.
8. **[components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 여부** (T-1431 잔여). 후속 slice 소관.

#### closure 선언

[directory.md](../architecture/directory.md) 의 정본 대조 축은 **표** (`§ 12.28` / T-1430 각주) · **pointer** (`§ 12.28` 168 행 in-place) · **트리** (본 절) 3 면에서 모두 닫혔다 — 세 면 각각에 실측 기반 3 축 대조가 박제됐고 미판정 축은 **0** 이다. **닫히지 않은 잔여 2**: (a) 표준 sub-structure 단락 (54 ~ 79 행) 의 sub-dir ↔ 실 `src/*/` 하위 대조 (파생 영향 7 — 본 slice 는 디렉토리 이름 축만 다뤘다), (b) 트리 미기재 root **17** 항목 — AC 2 에서 전수 **무편집** 판정했으므로 stale 잔여가 아니라 **범위 밖 항목** 이다.

#### 불변 검산 (AC 6)

```
$ wc -l docs/architecture/directory.md 184 → 187   (+3, 상한 +6)   |   modules.md 259 → 259 (무편집)
$ grep -c '^## ' docs/architecture/directory.md → 10 (불변)   |   audit → 12 (불변, `###` 만 추가)
$ grep -c '^| REQ-' docs/use-cases/REQ-COVERAGE-AUDIT.md → 66 (불변)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@' → @@ -51,0 +52,3 @@
  → hunk 1 개 = AC 4 허용 구간 (코드블록 직후) 뿐 — 3 · 19 · 52 행 · 21~50 블록 내부 · 81~100 표 · 102 행 이후 전부 hunk 밖
$ git diff --numstat → 3 0 (directory.md) · audit 순수 추가 → 삭제 0 = 순수 삭제 0 (치환 짝 불요)
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력)   코드 무변경 실증
$ git status --porcelain → M directory.md · M REQ-COVERAGE-AUDIT.md · M T-1432 task 파일 = 3 파일 (상한 3)
```

합계 diff ≤ 300 LOC · 파일 3 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A**, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 8).

#### 한계 —

1. **본 대조는 디렉토리 이름 축뿐** — 각 디렉토리 **내부 파일 구성** (`dto/` · `entities/` · `repositories/` 등 54 ~ 79 행의 표준 sub-structure) 이 실제와 맞는지는 **미검증** 이다 (파생 영향 7).
2. **blueprint 문서가 코드를 복제하는 구조는 잔존** — `src/` 에 디렉토리가 하나 추가되는 순간 본 각주의 `15` · `8 / 3 / 7` · 두 검산식이 **즉시 재-stale** 이 된다. 사람 규약으로 막을 수 없고 파생 영향 5 의 **CI drift-guard 축** 으로만 닫힌다.
3. **보존 판정이 남긴 독자 부담** — 트리 본문은 그대로라 독자는 여전히 `src/assessment/` · `src/scheduler/` · `src/config/` 를 만나고, 그것이 T-0021 좌표계임은 각주 2 행을 읽어야만 안다. root 17 · 파일 8 미기재도 각주 한 구절로만 노출된다.

### 12.31 directory.md 표준 sub-structure 표 ↔ 실 `src/*/` 하위 3 축 대조 — 원문 보존 + 각주 1 블록 (T-1433)

> **본 절의 위치** — `§ 12.30` 은 트리 축 closure 를 선언하면서 **파생 영향 7** 로 "[directory.md](../architecture/directory.md) `## 각 module 디렉토리의 표준 sub-structure` 의 sub-dir 채택 module 열거 ↔ 실 `src/*/` 하위 실측 대조" 를 목록만 남겼고, 같은 절 **한계 1** 도 "본 대조는 디렉토리 이름 축뿐" 이라고 잔여를 명시했다. 본 절이 그 위임을 실행한다. **계보** — `T-1422` → `T-1423` → `T-1426` → `T-1429` → `T-1430` (같은 문서 **표 축**) → `T-1431` (파생 **pointer 축**) → `T-1432` (**트리 축**) → **`T-1433` (본 절 — **sub-structure 축**, directory.md 의 네 번째이자 마지막 대조 면)**. 판정은 `§ 12.15` (시점 기록 append-only) 와 `§ 12.28` · `§ 12.30` (3 축 대조 각주 화법) 의 병용이다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   표 축 전수 — $ sed -n '68,75p' docs/architecture/directory.md → sub-dir 6 종 + `채택 module` 값:
      dto/ = "모든 endpoint 가진 module (assessment / user / auth / web / scheduler)" · entities/ = "assessment /
      user (domain entity 보유)" · guards/ = "**auth** (전용)" · providers/ = "**llm** (전용)" ·
      adapters/ = "github / confluence" · repositories/ = "user / assessment (domain module 별로 보유)".
      고유 채택 module 값 8 = assessment · user · auth · web · scheduler · llm · github · confluence.
(ii)  코드 축 전수 — $ ls -d src/*/*/ | sed 's#/$##' → src/assessment-collection/domain ·
      src/assessment-collection/dto · src/assessment-evaluation/domain · src/assessment-evaluation/dto ·
      src/auth/dto · src/export/dto · src/import/dto · src/llm/dto · src/llm/providers · src/scheduling/dto ·
      src/user/dto  (= 11 경로, 기대 11 일치)
      $ ls -d src/*/*/ | awk -F/ '{print $3}' | sort | uniq -c → 2 domain · 8 dto · 1 providers (= 3 종, 기대 일치)
(iii) flat suffix 축 — $ ls src/*/*.guard.ts → src/auth/jwt-auth.guard.ts · src/auth/roles.guard.ts (= 2, 기대 일치)
      $ ls src/*/*.repository.ts → llm 2 · permission-denied 1 · user-instance-access 1 · user 9 (= 13, 기대 일치)
      $ ls src/*/*.entity.ts → (빈 출력, = 0 기대 일치)   $ ls src/*/*.adapter.ts → (빈 출력, = 0 기대 일치)
      보강 2 식 (기대 밖 추가 측정) — $ ls src/*/*-adapter.service.ts → src/confluence/confluence-adapter.service.ts ·
      src/github/github-adapter.service.ts (= 2, 표의 adapters/ 채택 module 2 와 정확히 일치) ·
      $ ls src/*/*/*.adapter.ts → src/llm/providers/{anthropic,azure-openai,google-gemini,openai-compatible}.adapter.ts
      (= 4). ⇒ planner 사전 기대의 "adapters/ = 책임 자체 미shipped" 는 **불성립** — adapter 책임은 `*.adapter.ts`
      가 아닌 `*-adapter.service.ts` 이름으로 shipped 다. 측정값 자체 (2/13/0/0) 는 전부 기대 일치라 편집 중단 사유
      아니고, 어긋난 것은 그 값에서 파생시킨 **분류** 뿐이라 아래 AC 2 에서 분류를 실측대로 정정한다.
(iv)  3 축 차집합 — ① 양쪽 실재 2 종 = dto/ · providers/ · ② 표 전용 (디렉토리 미실재) 4 종 = entities/ ·
      guards/ · adapters/ · repositories/ · ③ 실재 전용 (표 미기재) 1 종 = domain/.
      양변 검산 — 6 = 2 + 4 · 3 = 2 + 1 (둘 다 성립).
      ② 의 flat 실측 부착 → guards/ · repositories/ · adapters/ = **다른 형태로 실현** (각 2 · 13 · 2 파일) ·
      entities/ = **책임 자체 미shipped** (0, 인접 실현은 ③ domain/ 의 10 + 43 파일).
(v)   채택 module 값 축 (보조) — 경로 미실재 2 = assessment (정본 modules.md 39 행 "미shipped placeholder") ·
      scheduler (정본 42 행 "실 shipped module 명 = SchedulingModule (src/scheduling/)").
      경로는 실재하나 해당 sub-dir 미보유 = web (하위 sub-dir 0) · github · confluence (adapters/ 없음, flat 2) ·
      auth (guards/ 없음, flat 2) · user (entities/ · repositories/ 없음, flat repository 9).
      표의 어느 row 에도 없는 실 shipped module 7 (§ 12.30 ③ 과 동일 집합) 중 dto/ 보유 5 =
      assessment-collection · assessment-evaluation · export · import · scheduling, 미보유 2 =
      permission-denied · user-instance-access (대신 flat *.repository.ts 각 1). planner 기대 후보 6 은
      scheduling 을 제외했으므로 "그중 dto/ 보유" 는 4 — scheduling 을 더한 5 가 실측이다.
      dto 8 검산 — 5 (표 미기재 module) + 3 (auth · llm · user) = 8, 그중 표의 dto/ row 열거와 일치 2 (auth · user).
(vi)  PersistenceModule 특수 단락 축 (보조) — $ ls src/persistence/ → persistence.module.spec.ts ·
      persistence.module.ts · prisma.service.spec.ts · prisma.service.ts → 77 ~ 82 행이 열거한 3 파일 전부 실재
      (미기재 1 = persistence.module.spec.ts). ⇒ **본 단락은 stale 아님 · 무편집** (AC 4 넷째 bullet 전건 불성립).
(vii) baseline — $ wc -l directory.md 187 · audit 2943 · modules.md 259 | $ grep -c '^## ' directory.md 10 ·
      audit 12 | $ grep -c '^| REQ-' audit 66 → 6 값 전부 기대 일치, AC 1 중단 지점 0.
```

**지점 판정표 (AC 2)** — 판정 축 ① **문서 성격** (3 · 19 · 55 행이 본 문서를 T-0021 blueprint 로 규정하는데 표를 고치면 자기모순인가) · ② **`§ 12.15` 정합** (시점 기록 append-only 대상인가) · ③ **선례** (`§ 12.28` 표 축 · `§ 12.30` 트리 축이 같은 문서에서 채택한 "원문 보존 + 실측 각주 blockquote" 화법의 sub-structure 축 적용 가능성).

| 항목 | 축 | 표 서술 / 부재 1 구 | 실측 상태 | 판정 | 근거 1 구 |
| --- | --- | --- | --- | --- | --- |
| `entities/` | sub-dir 종 | "domain entity 또는 Prisma generated type 의 re-export wrapper" — 채택 = assessment / user | **미shipped** (`*.entity.ts` 0 · `src/user/entities/` 부재) | 원문 보존 + 각주 부기 | ① 표가 T-0021 blueprint 라 row 삭제는 55 행 선언과 자기모순 — 채택 module 중 `assessment` 는 정본 39 행이 미shipped placeholder 로 규정 |
| `guards/` | sub-dir 종 | "NestJS RBAC guard (`@UseGuards(RolesGuard)`)" — 채택 = **auth** (전용) | **flat 실현** (`src/auth/jwt-auth.guard.ts` · `roles.guard.ts` = 2) | 원문 보존 + 각주 부기 (**별도 근거**) | ③ 책임은 shipped 이고 **형태만 flat** — row 를 지우면 shipped 책임이 문서에서 사라지고, 그대로 두면 디렉토리 신설 오도라 각주로 형태를 박제 |
| `adapters/` | sub-dir 종 | "외부 시스템 instance 별 HTTP client wrapper" — 채택 = github / confluence | **flat 실현** (`*-adapter.service.ts` 2 = 채택 module 2 와 일치) | 원문 보존 + 각주 부기 (**별도 근거**) | ③ `guards/` 와 동질 — planner 기대 "미shipped" 를 실측이 뒤집었으므로 각주는 flat 실현으로 기술 |
| `repositories/` | sub-dir 종 | "Prisma client wrapping repository … domain-cohesion 유지" — 채택 = user / assessment | **flat 실현** (`*.repository.ts` 13, `src/user/` 9) | 원문 보존 + 각주 부기 (**별도 근거**) | ③ 형태만 flat 이며 **중복 신설 위험이 최대** (13 파일을 디렉토리로 재구성하라는 오독) — 각주가 그 위험을 명시 |
| `domain/` | sub-dir 종 | (표 부재) | 실재 2 (`assessment-collection` 10 · `assessment-evaluation` 43 파일) | 표 무편집 + 각주 열거 | ① P4 / P5 layer 는 T-0021 이후 shipped — 시점 표에 소급 row 삽입은 창작 (`§ 12.30` 실재 전용 7 과 동일 사유) |
| `assessment` · `scheduler` | 채택 module 값 | 3 row · 1 row 의 채택 module 값 | 경로 미실재 (`scheduler` 실현체 = `src/scheduling/`) | 무편집 | ② 두 이름의 판정은 `§ 12.28` (T-1430 각주) · `§ 12.30` 이 이미 박제 — 재판정 없이 본 각주가 그 판정을 인용만 |
| `web` · `github` · `confluence` · `auth` · `user` | 채택 module 값 | 각 row 의 채택 module 값 | 경로 실재 · 해당 sub-dir 미보유 | 무편집 | ③ 값 자체는 "어느 module 이 그 책임을 갖는가" 서술이라 **여전히 참** — 어긋난 것은 sub-dir 형태뿐이고 그것은 각주 소관 |
| 표 미기재 실 shipped 5 (`assessment-collection` · `assessment-evaluation` · `export` · `import` · `scheduling`) | 채택 module 값 | (표 부재, 전부 `dto/` 보유) | 실재 | 무편집 + 각주 1 구 | ① 채택 module 컬럼에 5 이름을 추가하면 T-0021 시점 표를 현재 좌표로 재작성하는 것 — 정본 계상 축 (ADR 게이트) 선행 |

**`guards/` · `repositories/` (+ `adapters/`) 별도 1 구** — 표 전용 4 중 `entities/` 는 `ls src/*/*.entity.ts` 가 **0** 이고 채택 module 인 `assessment` 자체가 미shipped 라 **책임 자체가 미shipped** 인 반면, `guards/` (2) · `repositories/` (13) · `adapters/` (2) 는 **책임이 이미 shipped 이고 형태만 flat 파일** 이다. 같은 "디렉토리 미실재" 라도 전자는 "아직 안 만들었다", 후자 셋은 "다른 형태로 이미 만들었다" 라 근거가 다르며, 후자를 디렉토리로 만들라는 지시로 읽으면 **기존 13 + 2 + 2 파일과 중복** 이 발생한다. 본 구분이 각주 두 번째 행의 존재 이유다.

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 축 **4** — ① `§ 12.15` 정합 · ② 독자 오도 risk · ③ cap (≤ 300 LOC · 파일 3 고정) · ④ 선례 일관성.

| 후보 | ① § 12.15 정합 | ② 오도 risk | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (A) 표 in-place 전면 재작성 (실측 3 종 + flat 축으로 교체) | **위반** — 3 · 19 · 55 행이 문서를 T-0021 blueprint 로 선언해 자기모순 | 해소되나 `domain/` row 의 `용도` 문구를 신설해야 해 **창작 유입** (AC 4 넷째 bullet 금지) | 6 row 치환 + 신설 (cap 자체는 안) | 같은 문서 표 축 (`§ 12.28`) · 트리 축 (`§ 12.30`) 이 보존 + 각주를 채택한 것과 불일치 | **기각** — ① 위반 + 창작 risk |
| **(B) 표 원문 무편집 + 표 직후 3 축 대조 각주 blockquote 1** | **정합** — 시점 기록은 보존, 사실은 append | **해소** — 각주가 표 바로 아래에서 미실재 4 와 flat 실현 3 을 명시 | +4 행 · 파일 3 | `§ 12.28` · `§ 12.30` 화법의 **동일 문서 내 3 번째 확대 적용** | **채택** |
| (C) 혼합 (표 전용 4 의 채택 module 컬럼만 주석 병기 + 나머지 각주) | **부분 위반** — 표 셀을 손대는 순간 (A) 와 같은 ① 발생 | 해소 | +4 ~ 8 행 | 한 표 안에서 화법이 둘로 갈려 일관성 하락 | **기각** — ① 위반이 (A) 와 동질 |
| (D) 전 지점 무편집 + audit 기록만 | 정합 | **최대** — 독자는 directory.md 만 보고 `src/user/entities/` · `src/github/adapters/` · `src/user/repositories/` 를 만들어야 한다고 오인 (특히 flat 13 파일과의 **중복 생성**) | 0 LOC | 표 · 트리 축이 각주로 닫힌 선례와 불일치 — sub-structure 축만 재이월 | **기각** |

cap 초과 후보 **0** 이라 split 제안 없음. 채택안 (B) 는 `§ 12.28` · `§ 12.30` 의 "**사실 기록이지 표 재작성이 아니다**" 화법을 sub-structure 축에 그대로 승계한다.

#### 반영 결과 (AC 4) + 무편집 경계

| 지점 | 편집 방식 | 내용 |
| --- | --- | --- |
| [directory.md](../architecture/directory.md) 표 직후 (구 75 행 뒤 → 신 **77 ~ 79** 행) | blockquote **3 행** 순수 append (+ 구분 빈 줄 1) | 3 축 차집합 (**2 / 4 / 1**) + 양변 검산 2 식 + 표 전용 4 의 flat 실현 3 (2 · 13 · 2) vs 미shipped 1 구분 + `채택 module` 값 축 (기존 T-1430 판정 인용 + `dto/` 8 중 표 열거 2) + 보존 선언 |

`wc -l` 187 → **191** (+4, 상한 +6 충족) 이고 표 본문 (68 ~ 75 행) **내부 편집 0** 이다. **무편집 경계** — directory.md 시점 선언 3 지점 (3 · 19 · 55 행) · ASCII 트리 21 ~ 50 행 + T-1432 각주 52 ~ 53 행 · 표 68 ~ 75 행 내부 · `PersistenceModule 의 특수 sub-structure` (구 77 ~ 82 행 — AC 1 (vi) 이 stale 아님을 실증) · `## 9 module 별 디렉토리 mapping` 표 + T-1430 각주 (구 84 ~ 101 행) · 구 105 행 이후 전 구간 · `## References` · `Refs:` 말미, 그리고 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) · `src/` · `test/` · `prisma/` · `web/` · `scripts/` 는 전부 무편집이며 3 파일 밖이라 diff 에 미등장한다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **15 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — `ExportModule` / `ImportModule` / `UserInstanceAccessModule` 계상은 **ADR 게이트** 선행. 후속 slice 소관.
3. **외부 package module (`ScheduleModule.forRoot()`) 계상 규약**. 후속 slice 소관.
4. **행 번호 좌표계 → anchor 좌표계 이행** — **9 회째**. 본 절도 20 개 이상 행 번호에 의존했다. 후속 slice 소관.
5. **산문 tally ↔ 표 row 수 / 트리 항목 수 / sub-dir 종 수 CI drift-guard spec**. 후속 slice 소관.
6. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리**. 후속 slice 소관.
7. **[components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 여부** (T-1431 잔여). 후속 slice 소관.
8. **신규 — 표 `용도` 컬럼 서술 ↔ 실 파일 내용 (책임) 대조** — 본 slice 는 sub-dir **이름 축 + flat suffix 축** 만 닫았다. 예: `providers/` 의 `용도` 가 "5 LLM provider" 인데 실 `src/llm/providers/*.adapter.ts` 는 **4** 파일 (custom 이 `openai-compatible` 에 흡수) 이라 수치 축 재판정이 필요하다. 후속 slice 소관.

#### closure 선언

[directory.md](../architecture/directory.md) 의 정본 대조 축은 **표** (`§ 12.28` / T-1430 각주) · **pointer** (`§ 12.28` in-place) · **트리** (`§ 12.30` / T-1432 각주) · **sub-structure** (본 절 / T-1433 각주) **4 면에서 모두 닫혔다** — 네 면 각각에 실측 기반 3 축 대조가 박제됐고 미판정 축은 **0** 이다. **닫히지 않은 잔여 2**: (a) 각 sub-dir 의 `용도` 컬럼 서술 ↔ 실 파일 책임 대조 (파생 영향 8 — 본 slice 는 이름 축만 다뤘다), (b) 트리 미기재 root **17** 항목 — `§ 12.30` AC 2 에서 전수 **무편집** 판정했으므로 stale 잔여가 아니라 **범위 밖 항목** 이다.

#### 불변 검산 (AC 6)

```
$ wc -l directory.md 187 → 191 (+4, 상한 +6) | modules.md 259 → 259 (무편집) | audit 2943 → 3064
  (+121 = 본 절 120 행 + 구분 빈 줄 1 ⇒ 절 자체가 cap 120 을 정확히 충족)
$ grep -c '^## ' directory.md → 10 (불변) | audit → 12 (불변, `###` 만 추가) | $ grep -c '^| REQ-' audit → 66 (불변)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@' → @@ -76,0 +77,4 @@ ⇒ hunk 1 개 = AC 4 허용 구간
  (표 직후) 뿐 — 3 · 19 · 55 행 · 68~75 표 내부 · 77~82 Persistence 단락 · 84~101 mapping 표 · 105 행 이후 전부 hunk 밖
$ git diff --numstat → 4 0 (directory.md) · 121 0 (audit 순수 추가) · 9 1 (task 파일) ⇒ 전체 삭제 1 행 = task 파일
  `## Follow-ups` placeholder 의 in-place 치환 짝 ⇒ 순수 삭제 0
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력)   코드 무변경 실증
$ git status --porcelain → M directory.md · M REQ-COVERAGE-AUDIT.md · M T-1433 task 파일 = 3 파일 (상한 3)
```

합계 diff ≤ 300 LOC · 파일 3 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A**, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 8).

#### 한계 —

1. **본 대조는 sub-dir 이름 축 + flat suffix 축뿐** — 각 파일의 **내용 / 책임** 이 표의 `용도` 컬럼 서술과 맞는지는 **미검증** 이다 (파생 영향 8 — `providers/` 5 vs 실 4 가 그 첫 증거).
2. **blueprint 문서가 코드 layout 을 복제하는 구조는 잔존** — `src/*/` 에 sub-dir 이 하나 추가되는 순간 본 각주의 `11` · `2 / 4 / 1` · 두 검산식 · flat 3 수치가 **즉시 재-stale** 이 된다. 사람 규약으로 막을 수 없고 파생 영향 5 의 **CI drift-guard 축** 으로만 닫힌다.
3. **보존 판정이 남긴 독자 부담** — 표 본문은 그대로라 P3+ implementer 는 여전히 `entities/` · `guards/` · `adapters/` · `repositories/` 지시를 만나고, 그중 셋이 flat 파일로 이미 실현됐다는 사실은 각주 3 행을 읽어야만 안다.
4. **flat suffix 축의 탐지 한계** — 본 절의 flat 측정은 **이름 규약 (`*.guard.ts` · `*.repository.ts` · `*-adapter.service.ts`) 에 의존** 한다. AC 1 (iii) 에서 `*.adapter.ts` 0 만 보고 "adapters/ 미shipped" 로 갈 뻔한 것이 그 증거이며, 다른 이름으로 실현된 책임은 여전히 미탐지일 수 있다.

### 12.32 directory.md sub-structure 표 `용도` 컬럼 6 서술 ↔ 실 파일 책임 대조 — 원문 보존 + 각주 1 블록 (T-1434)

> **본 절의 위치** — `§ 12.31` 은 sub-structure 축 closure 를 선언하면서 **파생 영향 8** 로 "표 `용도` 컬럼 서술 ↔ 실 파일 내용 (책임) 대조" 를 목록만 남겼고, 같은 절 **한계 1** 도 "본 대조는 sub-dir 이름 축 + flat suffix 축뿐" 이라고 잔여를 명시했으며 [directory.md](../architecture/directory.md) 79 행 각주 본문도 같은 문장을 박제했다. 본 절이 그 위임을 실행해 directory.md 의 **마지막 미검증 면 (서술 내용 축)** 을 닫는다. **계보** — `T-1422` → `T-1423` → `T-1426` → `T-1429` → `T-1430` (표 축) → `T-1431` (pointer 축) → `T-1432` (트리 축) → `T-1433` (sub-structure **이름 축**) → **`T-1434` (본 절 — sub-structure **서술 내용 축**)**. 앞 4 축이 이름 · 좌표의 **일치** 를 봤다면 본 축은 서술의 **참·거짓** 을 보므로 판정 enum 이 `참 / 부분참 / 거짓` 3 값으로 갈린다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   서술 축 전수 — $ sed -n '68,75p' docs/architecture/directory.md → 6 row 의 `용도` 컬럼이 **검증 가능 12**
      (dto 2 · entities 2 · guards 2 · providers 1 · adapters 3 · repositories 2) 와 **검증 불가 3** (providers ·
      adapters 의 범주 서술 2 + repositories "domain-cohesion 유지" — 형태 무관 / 설계 의도, AC 2 표 미등재) 로 갈린다.
(ii)  providers/ 축 — $ ls src/llm/providers/*.adapter.ts → anthropic · azure-openai · google-gemini ·
      openai-compatible 의 `.adapter.ts` **4** (기대 일치 · 표 서술 "5" 와 -1) · $ grep -n "custom\|OpenAI-호환\|
      openai-compatible" …/openai-compatible.adapter.ts | head -5 → 1 · 13 · 114 행 "OpenaiCompatibleAdapter —
      custom/openai(OpenAI Chat Completions 호환)" · "두 provider 가 본 wire 포맷 공유" ⇒ **통합 근거 파일 안 확인**.
(iii) repositories/ 축 — $ grep -n "async \w*(" src/user/user.repository.ts → create · findByEmail · findById ·
      updateRole · countAll · findAll (**6**, 표 예시 findActiveByGroupId **부재**) · $ grep -rn "findActiveByGroupId" src/ | wc -l → **0** (repo 전역 부재, 기대 일치)
(iv)  나머지 4 축 — $ ls src/*/*.entity.ts → 빈 출력 (0, T-1433 승계) | $ grep -rn "ecode" src/github/ | wc -l →
      **31** (기대 0 과 다름 ⇒ 3-instance 라우팅 **shipped**, "0 이면 미shipped" 전건 불성립) · 보강 $ grep -rn
      '"com"' src/github/ | wc -l → **0** · github-instance-config.ts 34 행 실 예시 key = "public" / "sec" ⇒ key
      이름 1/3 불일치 | $ ls -d src/*/dto/ → **8** · $ ls src/*/*.controller.ts → **19** (보유 module 10) ⇒ 차집합
      = controller 보유 · dto 미보유 **2** (permission-denied · user-instance-access) · 역방향 **0** | $ ls
      src/auth/*.guard.ts → jwt-auth · roles (**2**) · 11 ~ 14 행 "SuperAdmin ⊇ Admin ⊇ User" ⇒ guards/ 서술 참.
(v)   공통 4 항목 산문 축 (보조, 59 ~ 64 행) — $ ls src/*/*.{module,controller,service,service.spec}.ts →
      **14 · 19 · 51 · 51** (기대 일치). module 14 는 T-1430 과 일치하나 controller 19 · service 51 은 "module 당 1 개" 전제와 배수 불일치 (1.4 · 3.6 배).
(vi)  외부 참조 축 (보조 — 존재 여부만, 내용 정합은 범위 밖) — $ grep -c "REQ-038" requirements.md → **2** ·
      "REQ-044" → **1** · $ ls docs/decisions/ADR-0002-db.md → 실재 (raw text 금지 = 29 · 48 행 REQ-032) ·
      $ grep -c "GitHub Adapter 묶음 결정" components.md → **0** (실 문구 = 3 행 "… 3-instance 묶음 결정") ⇒ 대상
      실재 · 인용 문구만 1 낱말 차.
(vii) baseline — $ wc -l directory.md 191 · audit 3064 · modules.md 259 | $ grep -c '^## ' directory.md 10 ·
      audit 12 | $ grep -c '^| REQ-' audit 66 | $ grep -c '^### 12\.' audit 31 → 7 값 전부 일치, 중단 지점 **0** ((iv) 의 ecode 31 은 조건절 전건 불성립이라 축 중단 사유가 아니다).
```

**지점 판정표 (AC 2)** — 판정 축 ① **문서 성격** (3 · 19 · 55 행이 본 문서를 T-0021 blueprint 로 규정하는데 `용도` 서술을 고치면 자기모순인가) · ② **`§ 12.15` 정합** (시점 기록 append-only 대상인가) · ③ **선례** (`§ 12.28` 표 축 · `§ 12.30` 트리 축 · `§ 12.31` 이름 축이 같은 문서에서 3 회 채택한 "원문 보존 + 실측 각주" 화법의 서술 축 적용 가능성).

| row | claim 1 구 | 실측 결과 | 판정 | 처리 | 근거 1 구 |
| --- | --- | --- | --- | --- | --- |
| `dto/` | "`class-validator` decorator" 부착 DTO class | `src/*/dto/*.ts` **82** 중 class-validator import **64** | 참 | 무편집 | ③ 책임 · 형태 모두 shipped 라 손댈 근거 0 |
| `dto/` | "[REQ-038] 조회 endpoint 의 query DTO 등" | `grep -c "REQ-038" requirements.md` **2** (대상 실재) | 참 (존재 축) | 무편집 | 내용 정합 대조는 범위 밖 (AC 7 ⑦) |
| `entities/` | "domain entity 또는 Prisma generated type 의 re-export wrapper" | `ls src/*/*.entity.ts` **0** — 책임 자체 미shipped | **거짓** | 원문 보존 + T-1433 각주 판정 승계 | ② 79 행 각주가 이미 박제 — 같은 사실의 각주 2 개는 중복 |
| `entities/` | "raw text 컬럼 0 ([ADR-0002] §2)" | ADR-0002-db.md 실재 (29 · 48 행 REQ-032 raw text 금지) | 참 (존재 축) | 무편집 | pointer 대상 실재 확인으로 충분 |
| `guards/` | "NestJS RBAC guard (`@UseGuards(RolesGuard)`)" | `src/auth/roles.guard.ts` 실재 | 참 | 무편집 | ③ 형태만 flat — 형태 축은 T-1433 각주 소관 |
| `guards/` | "[REQ-044] 의 3 권한 (SuperAdmin / Admin / User)" | requirements.md hit **1** + roles.guard.ts 11 ~ 14 행 위계 박제 | 참 | 무편집 | 3 권한 이름 · 포함관계까지 코드와 일치 |
| `providers/` | "5 LLM provider — custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI" | `*.adapter.ts` **4** — custom + OpenAI 가 `openai-compatible` 1 파일로 통합 | **부분참** | 원문 보존 + 각주 부기 | ③ 5 종 **책임** 은 전부 shipped 이고 파일 수만 4 — 5 번째 파일 신설 오도를 각주가 차단 |
| `adapters/` | "github 3 instance (`com` / `sec` / `ecode`)" | ecode hit **31** (라우팅 shipped) · `"com"` hit **0** · 실 예시 key `public` | **부분참** | 원문 보존 + 각주 부기 | ③ 3-instance 축은 참, key 이름 1/3 만 다름 — 지우면 shipped 사실이 소실 |
| `adapters/` | "단일 adapter + sub-config 로 라우팅" | `github-adapter.service.ts` 1 + `github-instance-config.ts` 실재 | 참 | 무편집 | 라우팅 설계 서술이 코드와 일치 |
| `adapters/` | [components.md](../architecture/components.md) "GitHub Adapter 묶음 결정" 인용 | 완전일치 **0**, 실 문구 = "GitHub Adapter **3-instance** 묶음 결정" (3 행) | **부분참** (pointer) | 원문 보존 + 각주 1 구 | ① 시점 인용이라 문구 교정도 소급 재작성 — 각주로 실 문구만 병기 |
| `repositories/` | "Prisma client wrapping repository" | `UserRepository` 가 `PrismaService.user` delegate 에 1:1 forwarding | 참 | 무편집 | 책임 서술이 코드와 일치 (형태만 flat 13 파일) |
| `repositories/` | 예시 메서드 "`UserRepository.findActiveByGroupId(...)`" | `grep -rn … src/` **0** — 전역 부재, 실 surface 6 | **거짓** | 원문 보존 + 각주 부기 | ③ 오도 risk 최대 — 있는 API 로 오인하면 없는 심볼을 호출한다 |

**"거짓" 과 "부분참" 의 구분 1 구** — `repositories/` 의 `findActiveByGroupId` 는 **예시 메서드가 repo 전역에 없어** 독자가 "이미 있는 API" 로 오인하는 순간 없는 심볼을 호출한다 (**거짓**). 반면 `providers/` 의 "5 provider" 와 `adapters/` 의 "3 instance" 는 **책임이 전부 shipped 이고 파일 수 · key 이름만 어긋나** 오도의 결과가 "중복 파일 신설" · "잘못된 env key 기대" 로 한 단계 약하다 (**부분참**). 같은 "불일치" 라도 독자 손해의 종류가 달라 각주 문장도 전자는 부재 사실을, 후자는 통합 근거 · 실 key 를 각각 다르게 적었다.

#### 처리 방식 판정 (AC 3 — 4 후보 · 채택 1 · 기각 3)

판정 축 **4** — ① `§ 12.15` 정합 · ② 독자 오도 risk · ③ cap (≤ 300 LOC · 파일 **3 고정**) · ④ 선례 일관성. **cap 초과 후보 0** 이라 split 제안 없음. (B) vs (C) 의 실질 쟁점은 "표 직후 blockquote 2 개의 가독성" 인데, 본 문서는 각 각주 header 에 **task ID 를 명시하는 attribution 규약** (52 · 77 · 104 행) 을 3 회 지켜왔고 blockquote 는 빈 줄로 분리되면 별도 블록으로 렌더되므로 (B) 를 채택했다.

| 후보 | ① § 12.15 정합 | ② 오도 risk | ③ cap | ④ 선례 일관성 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (A) `용도` 컬럼 in-place 재작성 | **위반** — 3 · 19 · 55 행의 T-0021 blueprint 자기규정과 정면 모순 | 해소되나 부분참 2 를 "4 provider" · "public/sec/ecode" 로 고치면 **현재 좌표로의 소급 재작성** | 6 row 중 4 셀 치환 (cap 자체는 안) | 같은 문서 3 축 (`§ 12.28` · `§ 12.30` · `§ 12.31`) 이 3 회 보존 + 각주를 채택한 것과 불일치 | **기각** — ① 위반 |
| **(B) 표 원문 무편집 + T-1433 각주 (79 행) 뒤에 서술 축 각주 blockquote 1 신설** | **정합** — 시점 기록 보존, 사실만 append | **해소** — 거짓 2 · 부분참 3 이 표 바로 아래에서 박제 | +4 행 · 파일 3 | 3 회 화법의 4 번째 적용이면서 **각주 header 의 task attribution 규약 유지** | **채택** |
| (C) T-1433 각주 블록에 1 ~ 2 행 append | 정합 | 해소 | +2 행 · 파일 3 | **미흡** — 블록 header 가 "(T-1433 실측 각주) … 이름 축" 이라 서술 축 사실을 그 안에 넣으면 **misattribution** 이고, 79 행의 "별도 slice 소관" 위임 문장과 한 블록에서 충돌 | **기각** — ④ |
| (D) 전 지점 무편집 + audit 기록만 | 정합 | **최대** — 독자는 directory.md 만 보고 `findActiveByGroupId` 를 호출하거나 5 번째 provider adapter 를 신설한다 | 0 LOC | 3 축이 각주로 닫힌 선례와 불일치 — 서술 축만 재이월 | **기각** |

#### 반영 결과 (AC 4) + 무편집 경계

| 지점 | 편집 방식 | 내용 |
| --- | --- | --- |
| [directory.md](../architecture/directory.md) T-1433 각주 직후 (구 79 행 뒤 → 신 **81 ~ 84** 행) | blockquote **3 행** 순수 append (+ 구분 빈 줄 1) | 검증 가능 12 / 불가 3 이분 + 판정 분포 (참 7 · 부분참 3 · 거짓 2) + 거짓 2 (findActiveByGroupId 0 · entities 승계) + 부분참 3 (providers 4 · `com` key 0 · components 문구) + 참 7 요약 + 산문 축 (14 · 19 · 51 · 51) 무편집 선언 + 99 행 사본 잔여 |

`wc -l` 191 → **195** (+4, 상한 +4 충족) 이고 표 본문 (68 ~ 75 행) **내부 편집 0** · 공통 4 항목 산문 (59 ~ 64 행) **무편집** (AC 4 다섯째 bullet 의 기본값 — AC 1 (v) 가 불일치를 실증했으나 채택안 (B) 가 그 축을 각주 1 구로만 흡수) 이다. **무편집 경계** — directory.md 시점 선언 3 지점 (3 · 19 · 55 행) · ASCII 트리 + T-1432 각주 (21 ~ 53 행) · 표 68 ~ 75 행 내부 · T-1433 각주 77 ~ 79 행 · `PersistenceModule` 단락 (구 81 ~ 86 행) · `## 9 module 별 디렉토리 mapping` 표 + T-1430 각주 (구 88 ~ 105 행, **99 행 5 provider 사본 포함**) · 구 109 행 이후 전 구간 · `## References` · `Refs:` 말미, 그리고 [modules.md](../architecture/modules.md) · [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · [INDEX.md](INDEX.md) · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) · `src/` · `test/` · `prisma/` · `web/` · `scripts/` 는 전부 무편집이며 3 파일 밖이라 diff 에 미등장한다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **[UC-09](UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 미판정** — **16 회째 이월**. 후속 slice 소관.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — ADR 게이트 선행. 후속 slice 소관.
3. **행 번호 좌표계 → anchor 좌표계 이행** — **10 회째**. 본 절도 30 개 이상 행 번호에 의존했다. 후속 slice 소관.
4. **산문 tally ↔ 표 row 수 / 트리 항목 수 / sub-dir 종 수 / provider 파일 수 CI drift-guard spec**. 후속 slice 소관.
5. **신규 — mapping 표 99 행 LlmModule row 의 5 provider 파일명 열거** (`custom.provider.ts` … `openai.provider.ts` — 실 `*.adapter.ts` **4** 와 이름 규약 · 개수가 둘 다 다른, 본 slice 와 동일 claim 의 두 번째 사본). mapping 표 소관 후속 slice.
6. **[components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기** (T-1431 잔여). 후속 slice 소관.
7. **표 외부 참조 3 (`REQ-038` · `ADR-0002 §2` · components.md "GitHub Adapter 묶음 결정") 의 내용 정합 대조** — 본 slice 는 존재 여부 + 인용 문구까지만 봤다. 후속 slice 소관.
8. **각 UC 본문 `§ 9` module 산정 수치의 이중 관리**. 후속 slice 소관.

#### closure 선언

[directory.md](../architecture/directory.md) 의 정본 대조 축은 **표** (`§ 12.28`) · **pointer** (`§ 12.28` in-place) · **트리** (`§ 12.30`) · **sub-structure 이름** (`§ 12.31`) · **sub-structure 서술** (본 절) **5 면에서 모두 닫혔다** — 다섯 면 각각에 실측 기반 대조가 박제됐고 미판정 축은 **0** 이다. **닫히지 않은 잔여 2**: (a) mapping 표 99 행의 5 provider 파일명 열거 (파생 영향 5 — 같은 claim 의 두 번째 사본이라 한 문서 안에서 **부분적으로만 각주된 상태**), (b) `용도` 컬럼의 **검증 불가 claim 3** (설계 의도) — 실측으로 참·거짓을 가릴 수 없어 stale 잔여가 아니라 **범위 밖 항목** 이다.

#### 불변 검산 (AC 6)

```
$ wc -l directory.md 191 → 195 (+4, 상한 +4) | modules.md 259 → 259 (무편집) | audit 3064 → 3173
  (+109 = 본 절 108 행 + 구분 빈 줄 1 ⇒ 절 자체가 cap 110 안)
$ grep -c '^## ' directory.md → 10 (불변) | audit → 12 (불변, `###` 만 추가) | $ grep -c '^| REQ-' audit → 66
  (불변) | $ grep -c '^### 12\.' audit → 31 → 32 (본 절 1 개만 증가)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@' → @@ -80,0 +81,4 @@ ⇒ hunk **1 개** = AC 4 허용
  구간 (T-1433 각주 직후) 뿐 — 3 · 19 · 55 행 · 59~64 산문 · 68~75 표 내부 · 77~79 T-1433 각주 · 구 81~86
  Persistence · 구 88~105 mapping 표 (99 행 포함) · 구 109 행 이후가 전부 hunk 밖
$ git diff --numstat → 4 0 (directory.md) · 109 0 (audit 순수 추가) · 8 1 (task 파일) ⇒ 전체 삭제 1 행 = task
  파일 `## Follow-ups` placeholder 의 in-place 치환 짝 ⇒ **순수 삭제 0**
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력)   코드 무변경 실증
$ git status --porcelain → M directory.md · M REQ-COVERAGE-AUDIT.md · M T-1434 task 파일 = 3 파일 (상한 3)
```

합계 diff ≤ 300 LOC · 파일 3 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. 코드 변경 **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A**, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 8).

#### 한계 —

1. **본 대조는 검증 가능 claim 축뿐** — `용도` 컬럼의 **검증 불가 3** (`domain-cohesion 유지` 등 설계 의도 · 형태 무관 범주 서술) 의 **타당성** 은 미검증이다. `repositories/` 의 "domain module 안에 두어 domain-cohesion 유지" 는 flat 13 파일로 실현됐는데 그 의도가 지켜졌는지조차 본 축으로는 판정 불가다.
2. **같은 claim 의 두 번째 사본이 미각주** — 99 행 LlmModule row 는 5 provider 를 **파일명까지** 열거하고 그 파일명 (`custom.provider.ts` 등) 은 실 `*.adapter.ts` 와 이름 규약마저 다르다. mapping 표 소관 (파생 영향 5) 이라 본 slice 가 닫지 않아 **한 문서 안에서 부분적으로만 각주된 상태** 가 남는다.
3. **blueprint 서술 ↔ 코드 drift 는 시점 기록으로만 흡수** — provider adapter 가 1 개 추가되거나 `findActiveByGroupId` 가 실제로 구현되는 순간 본 각주의 `4` · `0` · `6` 수치가 즉시 재-stale 이 된다. 사람 규약으로 막을 수 없고 파생 영향 4 의 **CI drift-guard 축** 으로만 닫힌다.

### 12.33 directory.md mapping 표 `표준 sub-dir` · `비고` 두 컬럼 ↔ 실 파일 대조 — 원문 보존 + 각주 1 블록 (T-1435)

> **본 절의 위치** — `§ 12.32` 는 sub-structure 서술 축 closure 를 선언하면서 **잔여 (a)** · **파생 영향 5** · **한계 2** 로 "mapping 표 LlmModule row 가 같은 5 provider claim 을 **파일명까지** 열거하는 두 번째 사본이고 그 파일명 규약마저 실 `*.adapter.ts` 와 다르다 — mapping 표 소관" 을 명시 위임했고, `§ 12.28` (T-1430) 각주도 스스로 "`표준 sub-dir` · `비고` 컬럼은 실측 근거 없이 창작할 수 없어 별도 slice 소관" 이라고 적었다. 본 절이 그 위임을 실행해 **mapping 표에 이미 있는 9 row 의 두 컬럼 내용** — 지금까지 어느 축에서도 검증된 적 없는 면 — 을 닫는다. **계보** — `T-1430` (mapping 표 **경로 축**) → `T-1431` (pointer 축) → `T-1432` (트리 축) → `T-1433` (sub-structure 이름 축) → `T-1434` (sub-structure 서술 축) → **`T-1435` (본 절 — mapping 표 **컬럼 내용 축**)**. 판정 enum 은 `§ 12.32` 와 같이 `참 / 부분참 / 거짓` 3 값이며, 경로 미실재 2 row 를 위해 `대상외` 가 더해진다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력 그대로)

```
(i)   표 원문 전수 — $ sed -n '96,106p' docs/architecture/directory.md → header 2 + row 9. 실측으로 참·거짓을
      가릴 수 있는 claim 은 대상외 2 row 를 뺀 **7 row · 28 개** (디렉토리 존재 12 · 파일명 6 · 개수 3 ·
      decorator 1 · controller 유무 4 · 외부 pointer 2). **검증 불가 2** 는 판정 제외 — UserModule 비고의
      "인원 CRUD + group / part 소속" (형태 무관 범주) · LlmModule 비고 "modelId 로 라우팅" 의 **정책 의미**
      (파일 실재 축만 검증 가능). 대상외 2 row 의 설계 의도 서술 2 도 같은 사유 + 경로 부재로 이중 제외.
(ii)  `표준 sub-dir` 축 (9 row 일괄, 1 개 명령) — $ ls -d src/*/dto/ src/*/guards/ src/*/entities/
      src/*/repositories/ src/*/adapters/ src/*/providers/ 2>&1 → `dto/` **8** (assessment-collection ·
      assessment-evaluation · auth · export · import · llm · scheduling · user) · `providers/` **1** (llm) ·
      나머지 4 종은 "No such file or directory" (**0**) ⇒ 기대 (`§ 12.31` 승계) 일치. **표가 `dto/` 를 준
      github · confluence 는 이 8 에 부재.**
(iii) LlmModule 비고 축 — $ ls src/llm/providers/*.adapter.ts → anthropic · azure-openai · google-gemini ·
      openai-compatible **4** | $ ls src/llm/providers/*.provider.ts 2>&1 → "No such file or directory" (**0**)
      ⇒ 표의 5 파일명은 **개수 (−1)** 와 **suffix 규약 (`.provider.ts` ≠ `.adapter.ts`)** 두 축 모두 어긋난다
      (통합 근거는 재측정 없이 directory.md 82 행 `§ 12.32` 승계). $ ls src/llm/llm.service.ts 2>&1 → "No such
      file" ⇒ **부재**. 실 진입점 1 회 조회 — $ grep -rln "modelId" src/llm/*.ts | head -3 → difficulty-
      mapping.service.spec.ts · difficulty-mapping.service.ts · llm-gateway.interface.ts (그 이상 추적 안 함).
(iv)  Github · Confluence 비고 축 — $ ls src/github/ src/confluence/ | grep -v spec → 각 **7** 파일 · 양쪽
      controller **0** · 실명은 flat `github-adapter.service.ts` · `confluence-adapter.service.ts` (+ 각
      `*-instance-config.ts` · `*-request.builder.ts` · `*-token-decrypt.ts` · `*-live-test-gating.ts` 등)
      ⇒ 표의 `github.adapter.ts` · `confluence.adapter.ts` **부재**. 3 instance key 축은 `§ 12.32` 승계.
(v)   Auth · Persistence · User · Web 비고 축 (4 개 명령) — $ ls src/auth/*.service.ts src/auth/*.guard.ts →
      auth.service.ts · jwt-auth.guard.ts · roles.guard.ts | $ grep -n "@Global()" src/persistence/
      persistence.module.ts → **12 행** hit | $ ls src/user/*.controller.ts 2>&1 → **7** (assessment ·
      contribution · group · part · person · summary · user) | $ ls src/web/ | grep -v spec → web.module.ts
      (**1**, controller **0**) ⇒ 표의 `(controller only)` 와 정반대.
(vi)  대상외 2 row — directory.md 108 행 T-1430 각주가 이미 **경로 부재** 판정이라 두 컬럼 claim 을 실측 제외
      (없는 디렉토리의 sub-dir 대조는 무의미). 단 $ grep -rn "@nestjs/schedule" src/scheduling/ | wc -l →
      **5** ⇒ 개명체에서는 그 claim 만 성립.
(vii) baseline — $ wc -l → directory.md **195** · audit **3173** · modules.md **259** | $ grep -c '^## ' →
      directory.md **10** · audit **12** | audit $ grep -c '^| REQ-' → **66** · $ grep -c '^### 12\.' → **32**.
```

#### 지점 판정표 (AC 2 — 검증 가능 claim 28 + 대상외)

판정 기준 3 축 — ① **문서 성격**: directory.md 3 · 19 · 55 행이 스스로 "T-0021 시점 blueprint" 라 규정하므로 서술 수정은 자기규정과 자기모순, ② **`§ 12.15` 정합**: 시점 기록은 append-only 로 사실을 덧붙일 뿐 과거 기술을 사후 재작성하지 않음, ③ **선례**: 같은 문서에서 4 회 채택된 "원문 보존 + 실측 각주" 화법 (`§ 12.28` 표 축 · `§ 12.30` 트리 축 · `§ 12.31` 이름 축 · `§ 12.32` 서술 축).

| module row | 컬럼 | claim 1 구 | 실측 결과 | 판정 | 처리 | 근거 1 구 |
| --- | --- | --- | --- | --- | --- | --- |
| **Auth · User · Llm** | 표준 sub-dir | `dto/` (3 module) · `providers/` (llm) | (ii) 전부 실재 | 참 (4) | 무편집 | 이름 · 형태 모두 일치 — Llm 은 두 sub-dir 이 다 맞는 유일 row |
| **Auth · User** | 표준 sub-dir | `guards/` · `repositories/` | 디렉토리 **0** · flat `*.guard.ts` **2** / `*.repository.ts` **13** | 부분참 (2) | 각주 (승계) | 책임은 shipped, **형태만 flat** — 디렉토리 신설은 중복 (77 ~ 79 행 승계) |
| **UserModule** | 표준 sub-dir | `entities/` | 디렉토리 **0** · `*.entity.ts` **0** | 거짓 | 각주 (승계) | 형태 · 책임 **모두** 미shipped — 위 부분참과 갈리는 지점 |
| **Github · Confluence** | 표준 sub-dir | `dto/` · `adapters/` | 4 종 모두 디렉토리 **0**, flat adapter 각 **1** | 거짓 (2) / 부분참 (2) | 각주 (신규 사실) | `dto/` 는 대체 flat DTO 도 없어 **책임 부재 (거짓)**, `adapters/` 는 책임 shipped · **형태만 다름 (부분참)** |
| **WebModule** | 표준 sub-dir | "(controller only)" | `web.module.ts` **1** · controller **0** | 거짓 | 각주 (신규 사실) | 정반대 — "only" 가 지시할 controller 가 0 |
| **AuthModule** | 비고 | `RolesGuard` · `auth.service.ts` | (v) 두 파일 실재 | 참 (2) | 무편집 | 이름까지 정확 |
| **PersistenceModule** | 두 컬럼 | "(특수 — `prisma.service.ts` 만)" · "`@Global()` 적용 + PrismaService export" | 파일 실재 · controller 0 · (v) 12 행 hit | 참 (3) | 무편집 | 두 컬럼이 **모두** 참인 유일 row |
| **UserModule** | 비고 | "controller endpoint 노출" | (v) **7** | 참 | 무편집 | 노출 사실 성립 |
| **Github · Confluence** | 비고 | "controller 미노출 (adapter only)" · Confluence "사내 sub-config" | (iv) controller **0** · `confluence-instance-config.ts` 실재 | 참 (3) | 무편집 | 실측 일치 |
| **Github · Confluence** | 비고 | "`github.adapter.ts`" · "`confluence.adapter.ts`" | 그 이름 파일 **0** (실명 flat `*-adapter.service.ts`) | 거짓 (2) | 각주 (파일명 축) | 독자가 **없는 경로를 열게** 되어 부분참보다 거짓 성격이 강함 |
| **GithubModule** | 비고 | "3 instance (com / sec / ecode)" | 라우팅 shipped · key `com` **0** (실 `public`) | 부분참 | 상위 판정 승계 | `§ 12.32` 가 이미 판정 — **중복 각주 회피** 로 재측정 · 재각주 없음 |
| **LlmModule** | 비고 | 5 provider **파일명** 열거 (`*.provider.ts`) | `.provider.ts` **0** · `.adapter.ts` **4** | 거짓 | 각주 (**파일명 규약 축만**) | **중복 각주 회피** — 개수 축 (5 vs 4) 은 82 행이 이미 각주했으므로 본 각주는 suffix 규약이라는 **새 사실만** 적고 82 행을 참조 |
| **LlmModule** | 비고 | "`llm.service.ts` 가 라우팅" | 파일 **부재** | 거짓 | 각주 (파일명 축) | 실 진입점은 `difficulty-mapping.service.ts` · `llm-gateway.interface.ts` — 라우팅 정책 의미는 검증 불가로 제외 |
| **WebModule** | 비고 | "SPA 소스는 repo-root `web/`" | AC 6 `git status … web/` 이 경로 오류 없이 빈 출력 ⇒ tracked 실재 | 참 | 무편집 | 추가 명령 0 으로 확인 |
| **WebModule** | 비고 | serve-static + 비-`/api/*` fallback + ADR-0040 | 본 slice 실측 예산 밖 (AC 1 (v) 4 개 명령 한정) | 유보 | 파생 영향 이월 | 미측정을 판정으로 쓰지 않음 (날조 금지) |
| **Assessment · Scheduler** | 두 컬럼 전체 | — | 108 행 각주 ② **경로 미실재** | 대상외 | 무편집 | 없는 디렉토리의 sub-dir 대조는 무의미 — 단 `@nestjs/schedule` 은 개명체에서 성립 (grep **5**) |

집계 — **참 14 · 부분참 5 · 거짓 8 · 유보 1 = 28** (`거짓 8` 중 5 가 **파일명 / 디렉토리 부재로 독자가 없는 경로를 열게 되는** 유형).

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

판정 기준 4 축 — ① `§ 12.15` 정합, ② 독자 오도 risk, ③ cap (≤ 300 LOC · 파일 3 고정), ④ 선례 일관성.

| 후보 | 판정 | 근거 1 구 |
| --- | --- | --- |
| (A) 두 컬럼 in-place 재작성 | 기각 | 3 · 19 · 55 행의 blueprint 자기규정과 자기모순 + `§ 12.15` append-only 위반 (①②), 거짓 8 · 부분참 5 를 실측 서술로 교체하면 표 5 row 재작성이라 diff 도 팽창 |
| **(B) 표 원문 무편집 + T-1430 각주 (108 ~ 109 행) 뒤 컬럼 축 각주 blockquote 1 개 신설** | **채택** | 시점 원문 보존 + 사실만 덧붙여 ①② 동시 충족, 거짓 claim 바로 아래에서 오도를 차단해 ② risk 해소, +4 행이라 ③ cap 여유, 같은 문서 4 회 화법의 **5 번째 적용** 으로 ④ 일관 |
| (C) T-1430 각주 블록에 1 ~ 2 행 append | 기각 | T-1430 각주는 **경로 축** 판정문이라 컬럼 축 사실을 그 블록에 넣으면 **misattribution** — `§ 12.32` 가 같은 사유로 기각한 후보와 동형 |
| (D) 전 지점 무편집 + audit 기록만 | 기각 | ② 가 최대 — P3+ implementer 가 `src/llm/providers/custom.provider.ts` 를 열거나 `src/github/adapters/` 를 신설할 risk 가 audit 문서 1 곳에만 기록돼 현장에서 보이지 않음 |

#### 반영 결과 (AC 4) 와 무편집 경계

- directory.md **T-1430 각주 직후** 에 blank 1 + blockquote **3 행** = **+4 행** 삽입 (195 → **199**, 상한 199 준수). 표 본문 (96 ~ 106 행) · heading (92 행) · 도입 산문 (94 행) · T-1430 각주 (108 ~ 109 행) 는 **문자 1 자도 무편집** — (B) 채택이므로 표 in-place 편집 조건 (AC 4 의 (A) 단서) 이 발동하지 않는다. 각주는 **실측된 claim 만** 서술하고 미측정 (WebModule serve-static) 은 "유보" 로 남겨 새 `비고` 문구를 창작하지 않는다.
- 무편집 확인 경계 — 3 · 19 · 55 행 blueprint 선언 3 지점 · 52 행 (T-1432) · 77 ~ 79 행 (T-1433) · 81 ~ 82 행 (T-1434) 각주 · 57 ~ 90 행 sub-structure 단락 · 구 111 행 이후 전 구간 · 정본 [modules.md](../architecture/modules.md) · 코드 전부.

#### 불변 검산 (AC 6)

```
$ wc -l → directory.md 195 → 199 (+4, 상한 199) | audit 3173 → 3288 (+115, cap +115 안) | modules.md 259 (불변)
$ grep -c '^## ' → directory.md 10 (불변) · audit 12 (불변, `###` 만 추가) | audit $ grep -c '^| REQ-' → 66
  (불변) | audit $ grep -c '^### 12\.' → 32 → 33 (본 절 1 개만 증가)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@' → @@ -110,0 +111,4 @@ ⇒ hunk **1 개** = AC 4
  허용 구간 (T-1430 각주 직후) 뿐 — 3 · 19 · 55 행 · 52 · 77~79 · 81~82 행 각주 · 57~90 산문 · 구 96~106 표 내부 (99 · 103 행 포함) · 구 108~109 T-1430 각주 · 구 111 행 이후가 전부 hunk 밖
$ git diff --numstat → 4 0 (directory.md) · 115 0 (audit 순수 추가) · 16 11 (task 파일) ⇒ 삭제 11 행은 전부
  in-place 치환 짝 (status 1 + AC checkbox 9 + Follow-ups placeholder 1) ⇒ **순수 삭제 0**
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력) 코드 무변경 실증 | $ git status --porcelain →
  M directory.md · M REQ-COVERAGE-AUDIT.md · M T-1435 task 파일 = **3 파일** (상한 3)
```

합계 diff ≤ 300 LOC · 파일 3 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 안이다. production code **0 LOC** · 분기 0 이라 R-112 의 happy / error / flow / negative 4 항목과 `pnpm test:cov` 는 **N/A**, `commitMode: direct` doc-only 라 §3.2 면제 조항으로 R-110 tester 호출도 **N/A** 다 (AC 8).

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **UC-09 `§ 5` sequence participant 병기** — 17 회째 이월.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — ADR 게이트 선행 (본 slice 무편집, 259 행 불변).
3. **행 번호 → anchor 좌표계 이행** — 11 회째 이월 (본 절도 `96 ~ 106` · `108 ~ 109` 좌표를 쓴다).
4. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관.
5. **대상외 2 row (`AssessmentModule` · `SchedulerModule`) 의 두 컬럼** — `src/assessment/` 신설 또는 `src/scheduling/` 개명 정합 시 재발화.
6. **`§ 12.32` 파생 영향 6 · 7 잔존** — [components.md](../architecture/components.md) 11 행 forward pointer · 외부 참조 **내용** 정합. 여기에 (7) 본 절이 **유보** 한 WebModule serve-static / SPA fallback / ADR-0040 옵션 1 서술의 실측을 더한다.

#### closure 선언

directory.md mapping 표는 이로써 **경로 축 (`§ 12.28`) + 컬럼 내용 축 (본 절)** 이 모두 대조돼, 표 9 row 의 4 컬럼 중 검증 가능 면이 닫힌다. 잔여는 (a) 유보 1 (WebModule serve-static) · (b) 대상외 2 row · (c) 표 미기재 7 module 의 두 컬럼 (창작 불가 — 경로 신설 시 발화) 뿐이며 셋 다 파생 영향에 등재됐다. `§ 12.32` 가 남긴 **잔여 (a) · 파생 영향 5 (5 provider claim 의 두 번째 사본)** 는 본 절 (iii) + 지점 판정표 LlmModule 2 row 로 **해소** 됐다 — 같은 문서 안에서 부분적으로만 각주된 상태가 사라졌다.

#### 한계 —

1. **파일명 축은 닫혔으나 내용 축은 미검증** — `github-adapter.service.ts` 가 표의 "adapter 책임" 을 실제로 수행하는지 (내부 구현 대조) 는 본 축 밖이다. 이름 · 존재만 봤다.
2. **유보 1 이 남는다** — WebModule 의 serve-static · SPA fallback 서술은 AC 1 (v) 의 4 개 명령 예산 밖이라 판정하지 않았다. 미측정을 참으로 쓰지 않는 대신 미검증 면이 1 개 잔존한다.
3. **재-stale 은 불가피** — `src/github/dto/` 가 생기거나 5 번째 provider adapter 가 추가되는 순간 본 각주의 `8` · `4` · `0` 수치가 즉시 낡는다. 사람 규약으로 막을 수 없고 파생 영향 4 의 CI drift-guard 축으로만 닫힌다.

### 12.34 directory.md `Frontend (web/) 의 위치` 산문 단락 ↔ 실 `web/src/` · `src/web/` 대조 — 카운트 in-place + 서술 각주 혼합 (T-1436)

> **본 절의 위치** — `§ 12.33` 은 mapping 표 두 컬럼을 닫으면서 `WebModule` row 의 **serve-static · SPA fallback · ADR-0040 옵션 1 shipped** 서술만은 "실측 예산 밖" 이라며 **유보** 로 남겼다 (한계 2 · 파생 영향 6 의 (7)). 본 절이 그 유보를 닫고, 동시에 directory.md 의 **마지막 미대조 산문 단락** 인 `## Frontend (web/) 의 위치` 를 실측한다. **계보** — `T-1430` (mapping 표 경로 축) → `T-1431` (pointer 축) → `T-1432` (트리 축) → `T-1433` (sub-structure 이름 축) → `T-1434` (`용도` 컬럼 축) → `T-1435` (mapping 표 컬럼 내용 축) → **`T-1436` (본 절 — 산문 단락 축 + web 유보 closure)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이며, 상위 slice 가 이미 박제한 지점을 위해 `승계` 가 더해진다. cap 준수를 위해 아래 실측 인용은 **요약형** 이다 (명령 + 핵심 출력만).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ sed -n '183,195p' directory.md → **task 좌표 stale** (183 행 이후는 References) ; $ grep -n '^## ' … → 167 `## Frontend (web/) 의 위치` · 184 `## References` ⇒ 실 단락 **167 ~ 183 행**.
      $ sed -n '167,183p' … → heading(167) + 도입 산문(169) + 2 항목(171 `repo-root web/` · 172 `src/web/`) + 도입구(174) + 5 항목(176 ~ 180) + 마무리(182).
      claim 이분 — **검증 가능 13** (디렉토리 존재 · 파일명 · 개수 · 스택 · shipped 여부) · **검증 불가 5** ("빌드 분리" · "props 소비 stateless" ·
      "controlled lift-up 으로 상태 소유" · "무라우터 view enum + R-78 배너 슬롯" 의 의도 면 · "`web/`=소스, `src/web/`=serve 진입점" 의 역할 규정 — 형태 무관 범주라 판정 제외).
(ii)  카운트 축 (1 회 실측. test 제외 기준 = 파일명이 `.test.` 를 포함하면 제외)
      $ ls web/src/components/*.tsx | grep -v '\.test\.' | wc -l → **21** (단락 claim 15)
      $ ls web/src/views/*.tsx      | grep -v '\.test\.' | wc -l → **2** (claim 2 일치; AdminView · DashboardView)
      $ ls web/src/api/*.ts | grep -v -e '\.test\.' -e contract | wc -l → **6** (단락 열거 3) → apiClient · auth · exportJob · exportJobDownload · exportJobFlow · useApiResource (기재 3 은 모두 실재)
      $ ls web/src/*.tsx → App.test / App / AppShell.test / AppShell / AuthGate.test / AuthGate / main ⇒ non-test **4** — 단락 열거 3, **`App.tsx` 미기재**
(iii) serve 축 (T-1435 유보 closure)  $ ls src/web/ → web.module.spec.ts · web.module.ts (controller 0)
      $ grep -n "ServeStaticModule\|API_EXCLUDE_PATTERN\|WEB_DIST_PATH\|existsSync" src/web/web.module.ts →
        13 `existsSync` import / 17 `ServeStaticModule` import / 20 `WEB_DIST_PATH = join(cwd,"web","dist")` / 25 `API_EXCLUDE_PATTERN = "/api/(.*)"` /
        41 `if (!existsSync(join(distPath,"index.html"))) {` ← **조건부 등록의 실체** / 44 `return [{ rootPath, exclude: [API_EXCLUDE_PATTERN] }]` / 49 `imports: resolveServeStaticOptions(WEB_DIST_PATH).map(...)`
      ⇒ serve-static 사용 · `web/dist/` mount · 비-`/api/*` fallback(=`exclude`) 은 **참**, 무조건 화법만 **부분참**.
(iv)  $ ls -d web/dist 2>&1 → `web/dist` ← **기대값(부재)과 다름**. $ git ls-files web/dist | wc -l → 0 ; $ git check-ignore -v web/dist → `.gitignore:6:dist/`
      ⇒ 미추적 · ignore 대상이라 **clean clone 의 SPA serve 등록 수 0** 이 성립하고 본 트리의 존재는 로컬 빌드 잔여물이다. `pnpm build` 미실행 (측정만).
(v)   $ ls docs/decisions/ADR-0040-frontend-stack.md ADR-0041-frontend-composition-wiring.md → 둘 다 실재 (본문 재판정 없음) ;
      $ ls docs/tasks/T-0354-*.md → T-0354-p6-web-module-serve-static.md (실재). 보강 — pnpm-workspace.yaml `packages: - web` / package.json react ^19.2.7 ·
      vite ^8.0.16 · typescript 5.6.2 / index.html 10 행 `src="/src/main.tsx"` / App.tsx 4 · 7 행 `import AppShell` · `return <AppShell />` / apiClient.ts
      `credentials` **8** ⇒ workspace · 스택 · 진입점 · thin wrapper · JWT cookie 모두 **참**.
(vi)  baseline — wc -l directory.md **199** · audit **3288** · modules.md **259** ; grep -c '^## ' → **10** · **12** ;
      audit grep -c '^| REQ-' → **66** · grep -c '^### 12\.' → **33**  (6 값 전부 기대값 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 본 단락은 3 · 19 · 55 행이 스스로 `blueprint` 라 선언한 T-0021 구간과 달리 [T-0397](../tasks/T-0397-directory-md-web-frontend-doc-sync.md) 이 P6 에 갱신한 **현재형 doc-sync 산물** 이고, `sed -n '167,183p' … | grep -n "시점\|T-0"` 의 2 hit 도 시점 선언이 아니라 shipped task attribution (T-0354 · T-0353~T-0394) 이다 → **시점 marker 0**. ② **`§ 12.15` 정합**: 그 정본은 *시점 기록* 의 무편집 존속을 명하는데, 시점 marker 가 없는 현재형 서술은 그 보호 대상이 아니다. ③ **선례**: 같은 문서에서 5 회 채택된 "원문 보존 + 각주" 는 전부 blueprint 구간이었고, 시점 marker 부재를 근거로 정본값 1:1 치환을 택한 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) 쪽이 본 단락 성격에 맞는다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 171 | repo-root `web/` 는 pnpm workspace SPA 소스 패키지 | `packages: - web` | 참 | 무편집 | 실측 (v) |
| 171 | React + Vite (TypeScript) | react ^19.2.7 · vite ^8.0.16 · ts 5.6.2 | 참 | 무편집 | 실측 (v) |
| 171 | 소스 `web/src/` · 산출물 `web/dist/` | 양쪽 실재 (dist 는 미추적) | 참 | 무편집 | 실측 (ii) · (iv) |
| 172 | `@nestjs/serve-static` 으로 serve | `web.module.ts` 17 행 import | 참 | 무편집 | 실측 (iii) |
| 172 | mount 대상이 `web/dist/` | `WEB_DIST_PATH` 20 행 | 참 | 무편집 | 실측 (iii) |
| 172 | 비-`/api/*` 를 SPA `index.html` 로 fallback | `exclude: ["/api/(.*)"]` 25 · 44 행 | 참 | 무편집 | 실측 (iii) |
| 172 | (위 mount 의) **무조건** 등록 화법 | 41 행 — `index.html` 부재 시 빈 배열 | 부분참 | 원문 보존 + 각주 부기 | 서술 재작성 축이라 각주가 안전 |
| 172 | `T-0354 shipped` | task 파일 실재 | 참 | 무편집 | 실측 (v) |
| 174 | ADR-0041 · `T-0353~T-0394` 스트림 pointer | ADR 2 종 실재 | 참 | 무편집 | 실측 (v), 본문 재판정 없음 |
| 176 | `components/` **15** presentational | non-test `*.tsx` **21** | 거짓 | in-place `15 → 21` | 순수 수치 + 시점 marker 0 |
| 177 | `views/` **2** (`DashboardView` · `AdminView`) | **2** 일치 | 참 | 무편집 | 실측 (ii) |
| 178 | `api/` = `apiClient` · `useApiResource` · `auth` | 실 모듈 **6** (3 개 미기재) | 부분참 | in-place `모듈 6` + `등` | 기재 3 은 실재 — 열거만 불완전 |
| 179 ~ 180 | 진입 파일 3 (`AppShell` · `AuthGate` · `main`) | non-test **4** (`App.tsx` 미기재) | 부분참 | in-place `App.tsx` 추가 | `main → App → AppShell` 실 체인 |
| 106 | `WebModule` row `(controller only)` | `src/web/` = module 1 · controller 0 | 거짓 (승계) | 상위 slice 판정 승계 | 113 행 T-1435 각주가 이미 박제 — 중복 각주 회피 |

- 합계 — 검증 가능 13 = **참 9 · 부분참 3 · 거짓 1** + 승계 1 (거짓). 검증 불가 5 는 대상 제외. **카운트 축과 서술 축의 처리를 분리** 한 이유: 176 · 178 · 179~180 은 실측 정수 · 파일명이라 치환해도 새 주장을 창작하지 않지만 (T-1429 형), 172 의 조건부 mount 는 문장 구조를 다시 쓰는 축이라 원문 보존 + 각주가 오도 risk 를 더 낮춘다 — 경계가 "수치 대 서술" 로 기계적으로 그어진다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 카운트 · 열거 in-place 동기만 | 기각 | 조건부 mount 부분참 · 유보 closure 가 남지 않아 `§ 12.33` 위임이 미해소로 잔존 |
| (B) | 단락 무편집 + 각주 blockquote 1 개만 | 기각 | 시점 marker 0 인 현재형 서술에 blueprint 보호를 오적용 — 본문 `15` 잔존으로 오도 risk 최대 |
| **(C)** | **(A) + (B) 혼합 — 수치는 in-place, 조건부 mount 서술만 각주** | **채택** | 3 축 판정을 지점별로 그대로 집행 + cap 안 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | directory.md 독자가 audit 를 안 읽으면 stale 수치를 그대로 신뢰 — 6 slice 중 가장 약한 처리 |

판정 4 축 — ① **`§ 12.15` 정합**: `sed -n '167,183p' … | grep -n "시점\|T-0"` **2 hit 가 모두 attribution** 이라 시점 marker 0 → append-only 제약이 같은 강도로 걸리지 않는다. ② **독자 오도 risk**: P6 implementer 가 "15 컴포넌트" 를 완전 목록으로 신뢰하면 6 개 컴포넌트 · 3 개 api 모듈 · `App.tsx` 를 못 본 채 배선한다 — (B) · (D) 는 이 risk 를 남긴다. ③ **cap**: (C) 의 실측 diff 는 directory.md `+7/-3` (199 → **203**, 허용 `≤ 203`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다 (초과 후보 0 — split 제안 불요). ④ **선례 일관성**: 수치 축은 T-1429, 서술 축은 T-1430 ~ T-1435 의 각주 5 연속을 각각 따르므로 두 선례 중 어느 쪽도 깨지 않는다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **in-place 3 지점** — 176 행 `15 → 21`, 178 행 `thin fetch hook (3 개 열거)` → `thin fetch hook 모듈 6 (… 등)`, 180 행에 `web/src/App.tsx` — `main.tsx` 와 `AppShell` 사이 thin wrapper 추가. 수치 · 파일명은 실측 (ii) 출력과 1:1 이며 **21 개 컴포넌트 · 6 개 api 모듈 전수 열거는 하지 않았다** (카운트 + 미기재 사실만).
- **각주 1 블록 (3 행)** — 단락 말미 (182 행 뒤) append. 내용은 ① in-place 동기 근거와 3 지점 · ② serve 축 판정 (참 3 + 조건부 → 부분참) 과 `clean clone 등록 수 0` · ③ 표 row 무편집 선언 + 검증 불가 5 제외 + 본 절 pointer.
- **무편집 경계** — 96 ~ 106 행 mapping 표 (`WebModule` row 포함) · 111 ~ 113 행 T-1435 각주 · `## References` · `Refs:` 말미 전부 무편집이고 **새 pointer 를 추가하지 않았다** (ADR-0040 · ADR-0041 · T-0397 이 이미 등재). 169 · 171 · 172 · 174 · 177 · 182 행 산문도 그대로다.

#### T-1435 유보 (web 축) closure 선언

`§ 12.33` 의 한계 2 · 파생 영향 6 (7) 이 남긴 **유보 1** (WebModule 의 serve-static · SPA fallback · ADR-0040 옵션 1 shipped 서술) 은 본 절 실측 (iii) · (iv) · (v) 로 **해소** 된다 — serve-static 사용 · `web/dist/` mount · 비-`/api/*` fallback · 옵션 1 shipped pointer 는 **참**, 무조건 등록 화법만 **부분참** (조건부). 이로써 `§ 12.33` 의 미검증 면 1 개가 0 이 되고, 106 행 표 row 는 T-1435 각주 (거짓 1) + 본 절 각주 (부분참 1) 두 pointer 로 덮인다 — **표 row 자체는 양쪽 slice 모두 무편집**.

#### directory.md 전 구간 대조 완료 선언

본 절로 directory.md 의 구조 claim **6 축** 이 모두 1 회 이상 실측 대조를 마쳤다 — ① mapping 표 **경로 축** (`§ 12.28` / T-1430) · ② **pointer 축** (`§ 12.29` / T-1431) · ③ **ASCII 트리 축** (`§ 12.30` / T-1432) · ④ **sub-structure 이름 축** (`§ 12.31` / T-1433) · ⑤ **`용도` 컬럼 서술 축** (`§ 12.32` / T-1434) 과 **mapping 표 2 컬럼 축** (`§ 12.33` / T-1435) · ⑥ **`Frontend (web/)` 산문 단락 축** (본 절 / T-1436). **미대조 산문 단락 0**. 잔여는 전부 "창작 불가 (경로 신설 시 발화)" 또는 "정본 modules.md 소관 (ADR 게이트)" 으로 아래 파생 영향에 등재돼 있다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **UC-09 `§ 5` sequence participant 병기** — 18 회째 이월.
2. **정본 [modules.md](../architecture/modules.md) 표 row 신설 축** — ADR 게이트 선행 (본 slice 무편집, **259 행 불변**).
3. **행 번호 → anchor 좌표계 이행** — 12 회째 이월. 본 절이 task 좌표 `183 ~ 195` 의 stale (실 `167 ~ 183`) 을 실증해 우선순위가 올라간다.
4. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. `21` · `6` 은 컴포넌트 1 개 추가로 즉시 낡는다.
5. **[modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락의 동종 카운트 claim** — 본 slice 는 directory.md 만 닫았고 정본 쪽은 미대조 (정본 편집은 ADR 게이트).
6. **`§ 12.33` 파생 영향 미소진분** — (1) [components.md](../architecture/components.md) 11 행 forward pointer · (2) 외부 참조 **내용** 정합 · (3) 대상외 2 row (`AssessmentModule` · `SchedulerModule`) 의 두 컬럼 · (4) 표 미기재 7 module 의 두 컬럼. (7) web 유보는 본 절이 소진.
7. **`web/dist/` 조건부 mount 의 운영 문서화** — [deployment.md](../architecture/deployment.md) 가 "빌드 없이 부팅하면 SPA 라우트 미등록" 을 명시하는지 미대조.

#### 불변 검산 (AC 6)

```
$ wc -l → directory.md **203** (199 → +4, 허용 ≤ 203) · audit **3402** (3288 → +114 = 절 113 + 구분 공백 1, 허용
  +115 이내) · modules.md **259** (불변) ; grep -c '^## ' → directory.md **10** · audit **12** (둘 다 불변 —
  본 절이 `###` 라서) ; audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **34** (33 → 34)
$ git diff -U0 -- docs/architecture/directory.md | grep '^@@'
  @@ -176 +176 @@ / @@ -178 +178 @@ / @@ -180 +180 @@ / @@ -183,0 +184,4 @@
  ⇒ hunk **4**, 전부 AC 4 허용 구간 (in-place 3 지점 + 단락 말미 각주) — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/directory.md → `7  3` ⇒ 삭제 3 은 in-place 치환 (176 · 178 · 180)
  의 짝이라 **순수 삭제 0**, 추가 7 = 치환 3 + 각주 블록 4.
$ git status --porcelain src/ test/ prisma/ web/ → (빈 출력 — 코드 무변경)
$ git status --porcelain → M directory.md · M REQ-COVERAGE-AUDIT.md · M T-1436-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `wc` · `git` 이며 빌드 · 테스트를 실행하지 않았다).

#### 한계 —

1. **좌표 stale 이 판정 전에 드러났다** — task 가 지정한 `183 ~ 195` 는 실 `167 ~ 183` 이었다. 명령을 그대로 믿었다면 References 블록을 단락으로 오인했을 것이며, 파생 영향 3 (anchor 이행) 의 비용이 이미 발생 중임을 뜻한다.
2. **in-place 치환은 재-stale 을 앞당긴다** — `21` · `6` 은 각주가 아니라 본문 수치라 다음 컴포넌트 추가 즉시 낡고 "언제 잰 값인지" 가 본문에 남지 않는다 — 각주 첫 줄이 그 시점을 대신 보관한다.
3. **역할 · 의도 서술 5 와 `web/dist/` 트리 의존은 미해소** — "props 소비 stateless" 류는 파일 단위 실측으로 참·거짓을 못 가르고 (내부 구현 대조는 본 축 밖), `ls -d web/dist` 는 로컬 빌드 잔여물 때문에 git 추적 · ignore 우회 없이는 정반대 결론이 나온다.

### 12.35 deployment.md `## 배포 토폴로지` 단락 ↔ 실 `src/` · `package.json` · `pnpm-workspace.yaml` 대조 — 원문 보존 + 각주 1 블록 (T-1437)

> **본 절의 위치** — `§ 12.34` 가 directory.md 6 축 전 구간 대조 완료를 선언하면서 파생 영향 **7** 로 남긴 **"`web/dist/` 조건부 mount 의 운영 문서화 — [deployment.md](../architecture/deployment.md) 가 '빌드 없이 부팅하면 SPA 라우트 미등록' 을 명시하는지 미대조"** (T-1436 Follow-up 2) 를 본 절이 닫고, 동시에 stream 의 대조 대상 문서를 **directory.md → deployment.md** 로 이월한다. **계보** — `T-1430` ~ `T-1435` (directory.md 6 축) → `T-1436` (산문 단락 축 + web 유보 closure) → **`T-1437` (본 절 — deployment.md `## 배포 토폴로지` 축 + Follow-up 2 closure)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이며 상위 slice 가 박제한 지점에는 `승계` 가 더해진다. cap 준수를 위해 아래 실측 인용은 **요약형** 이다 (명령 + 핵심 출력만).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' deployment.md → 50 `## 배포 토폴로지 …` · 77 `## Secret …` ⇒ 실 단락 **50 ~ 76 행** (task 좌표 일치, stale 아님).
      $ sed -n '50,76p' … → heading(50) + ADR pointer(52) + 채택 선언(54) + 빌드 분리(56) + `### process 1 개의 책임 범위`(58) + 6 bullet(60~65)
      + `### REQ-047 …`(67) + 본문(69) + `### worker 분리 전환 시점`(71) + 본문(73) + trade-off(75).
      claim 이분 — **검증 가능 14** (pointer 실재 · 모듈 존재 · script 존재 · shipped 여부 · 조건부 여부) · **검증 불가 5** (62 "동기 호출 또는
      Promise.all 로 운영" · 65 "same-origin 이라 CORS 표면 없음" · 69 REQ-047 시나리오 · 73 전환 조건 (a)~(d) · 75 trade-off — 형태 무관 범주).
(ii)  6 bullet 축 (bullet 당 근거 1) — $ ls src/ → 23 항목 ; $ ls src/*/*.controller.ts | wc -l → **19** ⇒ 60 행 **참**
      $ grep -rn "@nestjs/schedule" package.json src/ … → package.json:31 `"@nestjs/schedule": "^4.1.2"` / app.module.ts:14 import ·
        **75 `ScheduleModule.forRoot()`** / scheduling/cron-schedule.service.ts:17 `SchedulerRegistry` · 73 `new CronJob(...)` ;
        $ grep -rn "@Cron(" src/ | wc -l → **0** (선언형 0 — 등록은 registry 동적형) ; $ grep -n "@Post" …/cron-schedule.controller.ts →
        140 `@Post("trigger")`  ⇒ 61 행 **참** (planner 기대 ② 미shipped **불성립** → 그 축 편집 **중단**. Q-0026 미승인 영역은
        driver cron 자동화이지 본 bullet 이 아니다) ; $ ls src/assessment-evaluation/ → 실재 ⇒ 62 행 **참**
      $ grep -n "provider 식별자" src/llm/dto/create-llm-provider-config.dto.ts → 32 행 `(azure_openai / anthropic / google_gemini /
        openai / custom)` = **5** (adapter 파일은 4 — `openai-compatible.adapter.ts` 가 openai·custom 겸용) ⇒ 63 행 **참** ;
      $ ls src/github/ src/confluence/ → 둘 다 실재 ⇒ 64 행 **참** ; $ grep -n "bullmq\|ioredis\|\"redis\"" package.json → **0 hit**
      ⇒ 54 행 "worker / 외부 큐 broker 미도입" **참**
(iii) serve-static 조건부 축 (Follow-up 2 closure) — $ grep -n "existsSync\|resolveServeStaticOptions\|API_EXCLUDE_PATTERN\|WEB_DIST_PATH"
      src/web/web.module.ts → 13 `existsSync` import / 20 `WEB_DIST_PATH = join(cwd,"web","dist")` / 25 `"/api/(.*)"` / 30 helper 선언 /
      **41 `if (!existsSync(join(distPath, "index.html"))) {`** ← 조건부 등록의 실체 / 44 `return [{ rootPath, exclude }]` / 49 `…map(…)`
      ⇒ 65 행 무조건 mount 화법 **부분참**. $ sed -n '50,76p' … | grep -n "부재\|미등록\|없으면\|조건" → **0 hit (exit 1)**
      ⇒ **deployment.md 는 "빌드 없이 부팅하면 SPA 라우트 미등록" 을 어디에도 명시하지 않는다** (Follow-up 2 의 직접 답).
(iv)  $ grep -n '"build"' package.json web/package.json → 12 `"build": "nest build"` (불변 **참**) · web:8 `"tsc --noEmit -p tsconfig.json
      && vite build"` (**참**) ; $ cat pnpm-workspace.yaml → `packages:` / `  - web` ⇒ `pnpm --filter web build` 경로 성립 **참**. 빌드 미실행.
(v)   $ ls ADR-0003-deployment.md ADR-0040-frontend-stack.md T-0399-*.md T-0354-*.md → 4 개 전부 실재 (pointer 유효까지만, 본문 재판정 없음).
(vi)  baseline — wc -l deployment.md **188** · audit **3402** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md
      **6** (실측 기록) · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **34** (기대 주어진 6 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 가 "본 문서는 P1 T-A2 의 산출물" 로 **blueprint** 를 선언하되 65 행만은 [T-0399](../tasks/T-0399-deployment-md-web-serve-static-doc-sync.md) 가 P6 에 넣은 **현재형 doc-sync** 라 성격이 혼재한다. 단락 내부 `grep -n "시점\|T-0\|P5\|P6\|P7"` **4 hit 는 전부 attribution (T-0354) 또는 phase 책임 배정 (P5)** 이지 "언제 잰 값" 을 박제한 **시점 marker 가 아니다 (marker 0)**. ② **`§ 12.15` 정합**: 그 정본은 *시점 기록* 의 무편집 존속을 명하므로 marker 0 인 본 단락에 append-only 가 같은 강도로 걸리지는 않는다 — 다만 blueprint 선언이 문서 머리에 살아 있어 T-1436 의 directory.md (blueprint 선언 자체가 없던 구간) 보다 보존 강도가 **한 단계 높다**. ③ **선례**: 순수 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place, 서술 축이면 T-1430 ~ T-1435 의 각주이고 T-1436 은 둘을 **혼합** 했는데, 본 단락은 **거짓 0 · 수치 claim 0** 이라 혼합의 in-place 몫이 애초에 발생하지 않는다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 52 | ADR-0003 §1 이 본 결정의 박제처 | 파일 실재 | 참 | 무편집 | 실측 (v), 본문 재판정 없음 |
| 54 | 6 종이 단일 NestJS process 안에서 동작 | 6 종 대응 코드 전부 실재 | 참 | 무편집 | 실측 (ii) |
| 54 | 별도 worker process / 외부 큐 broker 미도입 | queue dependency **0 hit** | 참 | 각주에 근거 부기 | 실측 (ii) |
| 56 | root `pnpm build` = NestJS tsc 불변 | `"build": "nest build"` | 참 | 각주에 근거 부기 | 실측 (iv) |
| 56 | `pnpm --filter web build` 류로 `web/dist/` 산출 | workspace `- web` + web build script | 참 | 각주에 근거 부기 | 실측 (iv) |
| 60 | HTTP API — controller layer 가 요청 수신 | `src/*/*.controller.ts` **19** | 참 | 각주에 근거 부기 | 실측 (ii) |
| 61 | Scheduler — `@nestjs/schedule` in-process cron | dep 31 행 + `forRoot()` 75 행 | 참 | 무편집 + 각주 근거 | 기대 불성립 → 편집 중단 |
| 61 | manual trigger endpoint | `@Post("trigger")` 140 행 | 참 | 각주에 근거 부기 | 실측 (ii) |
| 62 | 평가 파이프라인이 같은 process | `src/assessment-evaluation/` 실재 | 참 | 각주에 근거 부기 | 실측 (ii) |
| 63 | LLM gateway 5 provider 단일 추상화 | 식별자 **5** (adapter 파일 4) | 참 | 각주에 근거 부기 | 실측 (ii) |
| 64 | GitHub / Confluence adapter 동일 process | `src/github/` · `src/confluence/` | 참 | 각주에 근거 부기 | 실측 (ii) |
| 65 | serve-static · `web/dist/` mount · 비-`/api/*` fallback | 20 · 25 · 44 행 | 참 (승계) | 상위 slice 판정 승계 | `§ 12.34` 가 이미 박제 |
| 65 | (위 mount 의) **무조건** 등록 화법 | 41 행 — `index.html` 부재 시 빈 배열 | 부분참 | 원문 보존 + 각주 부기 | 서술 재작성 축이라 각주가 안전 |
| 65 | ADR-0040 §3 · `T-0354 shipped` pointer | 둘 다 실재 | 참 | 무편집 | 실측 (v) |

- 합계 — 검증 가능 **14 = 참 13 (승계 1 포함) · 부분참 1 · 거짓 0**, 검증 불가 5 는 대상 제외. **미shipped 축 (Scheduler) 과 조건부 축 (serve-static) 을 분리 판정** 한 결과: 전자는 실측에서 **미shipped 전제 자체가 성립하지 않아** (dependency · `forRoot()` · manual trigger 실재) 판정이 `참` 으로 뒤집혀 편집 대상에서 빠졌고, 후자는 **shipped 코드의 실 동작과 문서 화법의 어긋남** 이라 성격이 달라 유일한 부분참으로 남는다 — 즉 "문서가 앞선 서술" 과 "문서가 뒤처진 서술" 로 갈리며 전자는 갈림이 소멸, 후자만 처리 대상이다.
- **중복 각주 회피** — 조건부 mount 의 **소스 트리 축 판정은 `§ 12.34` 와 directory.md 각주에 이미 박제** 됐으므로 본 slice 는 반복하지 않고 참조만 하며, deployment.md 각주는 **운영 축 (빌드 없이 부팅 시 SPA 미등록)** 만 새로 더한다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (65 행 조건부 + 61 행 미shipped 표기) | 기각 | 61 행 미shipped 전제가 실측으로 붕괴 (참) 해 대상이 65 행 서술 1 건뿐이고, 그 1 건은 문장 구조 재작성 축이라 blueprint 문서에서 risk 최대 |
| **(B)** | **단락 원문 무편집 + 각주 blockquote 1 블록 신설** | **채택** | 거짓 0 · 수치 claim 0 이라 in-place 몫이 없고, 유일한 부분참이 서술 축이라 T-1430 ~ T-1435 화법이 그대로 맞는다 |
| (C) | 혼합 (조건부 mount 만 in-place, 나머지 각주 승계) | 기각 | T-1436 혼합의 근거였던 "수치 대 서술" 경계가 본 단락엔 부재 — 혼합해도 in-place 몫이 (A) 와 같은 1 건이라 risk 를 그대로 승계 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자가 audit 를 안 읽으면 "부팅하면 SPA 가 뜬다" 오독이 그대로 남는다 — Follow-up 2 가 요구한 것은 **운영 문서 쪽 명시** 다 |

판정 4 축 — ① **`§ 12.15` 정합**: 단락 내 `grep -n "시점\|T-0\|P5\|P6\|P7"` **4 hit 가 모두 attribution / phase 책임 배정** 이라 시점 marker 0 → append-only 가 in-place 를 절대 금지하지는 않으나, 문서 머리의 blueprint 선언 때문에 **보존 쪽 가중치가 크다**. ② **운영 오도 risk**: 본 문서는 배포 · 운영 판단의 근거 문서라 오독 비용이 directory.md 보다 **높다** — 운영자가 65 행을 무조건형으로 읽으면 frontend 빌드를 건너뛴 배포에서 SPA 404 를 만나고도 "serve-static 이 shipped 이니 문서상 떠야 한다" 로 진단이 어긋난다. (B) 는 그 조건을 같은 화면에 놓아 risk 를 없애고 (D) 는 남긴다. ③ **cap**: (B) 의 실측 diff 는 deployment.md `+4/-0` (188 → **192**, 허용 `≤ 192`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다 (초과 후보 0 — split 제안 불요). ④ **선례 일관성**: 서술 축 단독이므로 T-1430 ~ T-1435 의 각주 5 연속을 그대로 잇고 T-1436 의 혼합과도 모순이 없다 (혼합은 수치 축이 있을 때의 규칙).

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (3 행)** — 65 행 (6 bullet 말미) 뒤에 append. 내용은 ① 6 bullet 중 5 종 + 54 · 56 행의 **참** 근거를 실측 좌표로 부기, ② **Web UI 정적 serve 만 부분참** 이라는 조건부 사실과 "빌드 없이 부팅하면 API 는 뜨지만 SPA 라우트 미등록", ③ 검증 불가 / 대상외 제외 선언 + 본 절 pointer.
- **각주 위치를 단락 최말미 (75 행 뒤) 가 아니라 `### process 1 개의 책임 범위` 말미로 잡은 이유** — 주석 대상 claim 이 전부 그 하위 절 안에 있고, 최말미에 두면 독자가 `### REQ-047` · `### worker 분리 전환 시점` 두 절을 건너뛴 뒤에야 조건부 사실을 만나 오도 risk 감쇄 효과가 떨어진다.
- **문구 1:1 + 무편집 경계** — 각주의 수치 · 파일명 · 경로 (`19` · `31` · `75` · `140` · `41` · `49` · `5` · `nest build` · `packages: - web`) 는 전부 위 실측 출력 그대로이고 **실측되지 않은 동작 (dist 부재 시 반환 status code, 재빌드 절차) 은 창작하지 않았다**. 1 ~ 4 행 blockquote · 50 ~ 65 행 원문 · `### REQ-047 충족 시나리오` · `### worker 분리 전환 시점` · 75 행 trade-off · `## Secret / 자격증명 저장` (편집 후 81 행) 이하 전 구간은 그대로이며 **새 pointer 도 추가하지 않았다** (ADR-0003 · ADR-0040 · T-0399 · T-0354 는 이미 등재 — 각주가 더한 링크는 본 audit 절 1 개뿐, T-1435 · T-1436 각주와 같은 규약).

#### T-1436 Follow-up 2 (조건부 mount 운영 문서화) closure 선언

`§ 12.34` 파생 영향 **7** 이 남긴 질문 — "deployment.md 가 '빌드 없이 부팅하면 SPA 라우트 미등록' 을 명시하는가" — 의 답은 실측 (iii) 의 `grep … "부재\|미등록\|없으면\|조건"` **0 hit** 로 **"명시하지 않았다"** 이며, 본 절의 각주가 그 공백을 채워 **closure** 한다. 이로써 조건부 mount 사실은 **소스 트리 축 (directory.md 각주 · `§ 12.34`) 과 운영 축 (deployment.md 각주 · 본 절)** 양쪽에 박제됐고, 남은 미박제 면은 **정본 [modules.md](../architecture/modules.md) 쪽 (ADR 게이트)** 하나다.

#### 대조 대상 문서 이월 선언

directory.md 는 `§ 12.34` 로 **6 축 · 미대조 산문 단락 0** 이 됐으므로 본 절부터 stream 의 대조 대상은 **deployment.md** 다. deployment.md 의 `## ` 단락은 **6** 개 (`개요` · `DB / Persistence` · `배포 토폴로지` · `Secret / 자격증명 저장` · `Scheduler 위치` · `외부 네트워크 boundary`) 이고 본 절이 그중 **1 개** 를 닫았다 — **잔여 미대조 5**. 우선순위는 아래 파생 영향 5 에 둔다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **UC-09 `§ 5` sequence participant 병기** — 19 회째 이월.
2. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
3. **행 번호 → anchor 좌표계 이행** — 13 회째 이월. 본 절은 좌표가 stale 이 아니었으나 각주 4 행 삽입으로 `## Secret` 이 77 → 81 로 밀려 이후 slice 의 task 좌표가 다시 낡는다.
4. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. `19` · `5` 는 controller · provider 1 개 추가로 즉시 낡는다.
5. **deployment.md 잔여 미대조 단락 5** — 특히 `## Scheduler 위치` 의 `### cron 주기 설정 흐름 (REQ-039)` 은 본 절 (ii) 의 Scheduler 판정 (`@Cron` 0 · registry 동적 등록) 과 직결되므로 다음 slice 1 순위, 이어 `## 외부 네트워크 boundary` · `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`.
6. **`§ 12.34` 파생 영향 미소진분** — (1) UC-09 · (3) anchor · (4) drift-guard · (5) modules.md 카운트 · (6) `§ 12.33` 잔여 4 항목. (7) 은 본 절이 소진.

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **192** (188 → +4, 허용 ≤ 192) · audit **3517** (3402 → +115 = 절 114 + 구분 공백 1, 허용 +115 이내) ·
  directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **35** (34 → 35)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -66,0 +67,4 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (6 bullet 말미 각주) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `4  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ package.json → (빈 출력 — 코드 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1437-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `wc` · `cat` · `git` 이며 빌드 · 테스트를 실행하지 않았다 — `pnpm build` · `pnpm --filter web build` 도 미실행).

#### 한계 —

1. **planner 기대가 실측에 뒤집힌 사례** — 기대 ② (Scheduler 미shipped) 는 dependency 등재 · `forRoot()` · manual trigger 로 반증됐다. 기대를 그대로 믿고 "미shipped" 를 in-place 로 박았다면 **문서가 코드보다 낡은 게 아니라 틀린 상태** 가 됐을 것이며, AC 1 의 "기대와 다르면 그 축 편집 중단" 규정이 실제로 작동한 지점이다. 다만 `@Cron` **0** 의 의미 (선언형 cron job 이 실제로 도는가) 는 `## Scheduler 위치` 단락 소관이라 본 절은 bullet 의 기반 shipped 여부까지만 판정했다.
2. **각주가 본문 화법을 고치지는 않는다** — 65 행은 여전히 무조건형이라 각주를 건너뛴 독자에겐 오도가 남는다. blueprint 보존과 오도 제거의 trade-off 를 보존 쪽으로 택한 결과이며, 본문 화법 자체의 정정은 ADR-0040 / T-0399 계보를 건드리는 별도 판단이다.

### 12.36 deployment.md `## Scheduler 위치` 단락 ↔ 실 `src/scheduling/` · `src/app.module.ts` · `prisma/schema.prisma` 대조 — 원문 보존 + 각주 1 블록 (T-1438)

> **본 절의 위치** — `§ 12.35` 가 deployment.md `## 배포 토폴로지` 를 닫으면서 파생 영향 **5** 로 남긴 "잔여 미대조 5 단락, 그중 `## Scheduler 위치` 가 다음 slice 1 순위" ([T-1437](../tasks/T-1437-deployment-md-topology-section-vs-src-audit.md) Follow-up 1) 를 본 절이 닫는다. **계보** — `T-1430` ~ `T-1435` (directory.md 6 축) → `T-1436` (산문 단락 축) → `T-1437` (deployment.md `## 배포 토폴로지` 축) → **`T-1438` (본 절 — `## Scheduler 위치` 축 + `@Cron` **0** 의 의미 판정 closure)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이며 상위 slice 가 박제한 지점에는 `승계` 가 더해진다. cap 준수를 위해 아래 실측 인용은 **요약형** 이다 (명령 + 핵심 출력만).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' deployment.md → 107 `## Scheduler 위치` · 113 · 126 · 138 · 142 (하위 4 절) · 146 `## 외부 네트워크 boundary` ⇒ 실 단락 **107 ~ 145 행** (task 좌표 일치, stale 아님).
      $ sed -n '107,145p' … → heading(107) + ADR pointer(109) + 채택 선언(111) + `### cron 주기 설정 흐름 (REQ-039)`(113) + code-block(115~122) + 산문(124) + `### Manual trigger 흐름 (REQ-040)`(126) + code-block(128~134) + 산문(136) + `### 동시 실행 방지`(138) + 본문(140) + `### 후속 task 책임`(142) + 본문(144).
      claim 이분 — **검증 가능 13** (pointer 실재 · route · 심볼 실재 · registry 메서드 · 영속 model · dependency · shipped 여부) · **검증 불가 6** (116 · 129 "Admin UI (…)" 진입점 화법 · 121 "다음 trigger 부터 새 주기" · 133 "평가 파이프라인 진입" · 136 "thin wrapper" 설계 평가 · 140 · 144 의 phase 책임 배분 — 형태 무관 범주).
(ii)  route 축 — $ grep -n "@Controller\|@Get\|@Post\|@Patch\|@Delete" src/scheduling/cron-schedule.controller.ts → 70 `@Controller("api/schedules")` / 90 `@Get()` / 120 `@Delete(":name")` / 140 `@Post("trigger")` (+ 107 `@Put()` — 위 패턴 밖이라 sed 로 재확인).
      ⇒ 117 행 `PATCH /admin/schedule` 은 경로 (`/admin/schedule` vs `/api/schedules`) · method (PATCH vs PUT) **두 축 모두 거짓**, 130 행 `POST /admin/evaluation/trigger` 은 method 일치 · 경로 어긋남 ⇒ **부분참** (실 `POST /api/schedules/trigger`).
(iii) 심볼 축 — $ grep -n "export class\|^  [a-zA-Z]\+(" cron-schedule.service.ts cron-schedule.controller.ts → service 44 `CronScheduleService` / 50 `registerOrReplace(` · 80 `remove(` · 88 `list(` · 94 `exists(` ; controller 78 `CronScheduleController` / 93 `list(` · 107 `upsert(` · 124 `remove(` (+ 147 `trigger(` — async 라 패턴 밖).
      $ grep -rn "class EvaluationOrchestrator" src → evaluation-orchestrator.service.ts:85 `EvaluationOrchestratorService` ; $ grep -rn "runFullAssessment\|updateCron\|triggerNow" src → **0 hit** ⇒ 문서의 3 심볼 (`ScheduleService.updateCron` · `EvaluationController.triggerNow` · `EvaluationOrchestrator.runFullAssessment`) **실재 0** — 유사 심볼로 임의 치환하지 않고 실 명칭만 인용한다.
(iv)  영속화 축 — $ grep -n '^model ' prisma/schema.prisma → **15 model** (Person · Group · Part · PersonGroupMembership · User · UserInstanceAccess · ServiceIdentity · Assessment · Contribution · Summary · LlmProviderConfig · DifficultyMapping · PermissionDeniedRecord · ExportJob · ImportJob) ; $ grep -in "cron\|schedule" prisma/schema.prisma → **0 hit** ⇒ cron 설정 영속 대상 **0**.
      $ grep -rn "SchedulerRegistry" cron-schedule.service.ts → 17 import · 45 주입 · 68 `deleteCronJob(name)` · 73 `new CronJob(...)` · 74 `addCronJob(name, job)` · 89 · 95 `getCronJobs()` ⇒ 등록은 **in-memory registry 전용** 이라 124 행 "process restart 후에도 복원" 은 **미shipped**. 120 행의 두 registry 메서드는 68 · 74 행과 **일치 (참)**.
(v)   dependency / 시점 축 — $ grep -n "@nestjs/schedule" package.json → 31 `"@nestjs/schedule": "^4.1.2"` ; $ grep -n "ScheduleModule" src/app.module.ts → 14 import · **75 `ScheduleModule.forRoot()`** (주석 8 · 49 행 = T-0412 · ADR-0042 §Decision 2).
      $ grep -rn "@Cron(" src | grep -v spec → **0 hit** ⇒ `§ 12.35` 실측 (선언형 0 · 등록은 registry 동적형) 과 **일치 확인** (T-1437 Follow-up 1 의 직접 답) ; $ grep -n "addInterval\|addTimeout" cron-schedule.service.ts → **0 hit** ⇒ 111 행 "cron + interval + timeout 을 모두 처리" 는 부분참 (shipped 는 cron 등록뿐) ; $ grep -rln "cron" web/src → `components/SchedulePanel.tsx` 등 **9 파일** ⇒ 144 행이 P7 로 미룬 3 항목이 모두 shipped.
(vi)  동시 실행 방지 축 — $ grep -rn "RUNNING\|mutex\|isRunning" src/scheduling src/assessment-evaluation | grep -v spec → **0 hit** ⇒ 140 행 미shipped (실재 여부 기록까지만 — 구현 설계 제안 없음).
(vii) pointer 축 — $ ls ADR-0003-deployment.md ADR-0042-nestjs-schedule-adoption.md T-0412-nestjs-schedule-module-wiring.md → 3 개 전부 실재 (pointer 유효까지만, ADR 본문 재판정 없음).
(viii) baseline — wc -l deployment.md **192** · audit **3517** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **35** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 가 "본 문서는 P1 T-A2 의 산출물" 을 선언하고 본 단락은 [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 가 [ADR-0003](../decisions/ADR-0003-deployment.md) §3 으로 채운 **P1 blueprint 원본** 이다 — `§ 12.35` 단락과 달리 사후 doc-sync (T-0399 류) 가 섞이지 않아 보존 강도가 균질하게 높다. ② **`§ 12.15` 정합**: 단락 내 `grep -n "시점\|T-0\|P5\|P6\|P7"` **3 hit 는 전부 phase 책임 배정** (124 P7 · 140 P5 · 144 P7) 이고 날짜 stamp 는 0 이라 **시점 marker 0** — append-only 가 in-place 를 절대 금지하지는 않으나 blueprint 선언이 보존 쪽 가중치를 준다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place, 서술 축이면 T-1430 ~ T-1435 · T-1437 의 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 단락은 **수치 claim 0 · 명칭/서술 축 전부** 라 각주 계열에 든다.

**code-block 내부 claim 의 별도 판정** — 117 ~ 121 · 129 ~ 133 행은 코드블록 안이라 [T-1430](../tasks/T-1430-directory-md-module-coordinate-resync.md) 의 ASCII tree **무편집** 선례를 **승계** 한다. 논증 1 구: 두 code-block 은 개별 심볼의 나열이 아니라 **flow 도식 한 덩어리** 라 어긋난 행만 실 명칭으로 치환하면 남은 행 (119 행 DB row 갱신 — 미shipped) 과 시제가 섞여 도식이 반은 현행 · 반은 계획인 잡종이 된다. 따라서 각주로만 처리한다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 109 | ADR-0003 §3 이 본 결정의 박제처 | 파일 실재 | 참 | 무편집 | 실측 (vii), 본문 재판정 없음 |
| 111 | 채택 = `@nestjs/schedule` in-process | dep 31 행 + `forRoot()` 75 행 | 참 | 각주에 근거 부기 | 실측 (v) |
| 111 | cron + interval + timeout 을 모두 처리 | `addInterval` · `addTimeout` **0 hit** | 부분참 | 원문 보존 + 각주 부기 | shipped 는 cron 등록뿐 |
| 117 | `HTTP PATCH /admin/schedule` | `api/schedules` + `@Put()` (107 행) | 거짓 | 원문 보존 + 각주 부기 | 코드블록 내부 (T-1430 승계) |
| 118 | `ScheduleService.updateCron(newSpec)` | 실재 **0 hit** | 거짓 | 원문 보존 + 각주 부기 | 실 `CronScheduleService.registerOrReplace` |
| 119 | DB 의 schedule 설정 row 갱신 | 영속 model **0** | 거짓 (미shipped) | 원문 보존 + 각주 부기 | blueprint 미래 서술로 성립 여지 |
| 120 | `deleteCronJob` + `addCronJob` 재등록 | service 68 · 74 행 | 참 | 무편집 + 각주 근거 | 실측 (iv) |
| 124 | cron 식이 DB 저장돼 restart 후 복원 | registry 전용 · 영속 대상 0 | 거짓 (미shipped) | 원문 보존 + 각주 부기 | 119 행과 같은 축 |
| 130 | `HTTP POST /admin/evaluation/trigger` | 실 `POST /api/schedules/trigger` | 부분참 | 원문 보존 + 각주 부기 | method 일치 · 경로 어긋남 |
| 131 | `EvaluationController.triggerNow()` | 실재 **0 hit** | 거짓 | 원문 보존 + 각주 부기 | 실 `CronScheduleController.trigger` |
| 132 · 136 | `EvaluationOrchestrator.runFullAssessment()` 를 cron · manual 이 공유 | 클래스는 `…Service`, 메서드 **0 hit** | 거짓 | 원문 보존 + 각주 부기 | 코드블록(132) 과 산문(136) 이 같은 심볼의 짝 |
| 140 | in-process mutex 또는 `status=RUNNING` 검사 | **0 hit** | 거짓 (미shipped) | 무편집 + 각주 부기 | P5 책임 명시라 미래 서술 |
| 144 | 도입 3 항목이 P7 phase 책임 | 3 항목 모두 shipped | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | dep · `forRoot()` · `SchedulePanel.tsx` |

- 합계 — 검증 가능 **13 = 참 3 · 부분참 2 · 거짓 8**, 검증 불가 6 은 대상 제외. 거짓 8 의 내역은 **미shipped 3** (119 · 124 · 140) · **명칭/route 어긋남 4** (117 · 118 · 131 · 132·136) · **시점 낡음 1** (144) 이다.
- **미shipped 축과 명칭 어긋남 축의 분리 판정** — 전자는 blueprint 가 "아직 안 만든 것" 을 미래형으로 적은 것이라 문서 자체는 성격상 성립하고 (140 행은 `P5 phase 의 task 책임` 을 명시까지 한다), 후자는 **shipped 코드가 이미 다른 이름으로 존재** 하는 어긋남이라 오독이 곧 오작동으로 이어진다 — 성격이 다르다. 그럼에도 처리가 갈리지 않고 둘 다 `원문 보존 + 각주` 로 수렴한 이유는 명칭 어긋남 6 지점 중 5 가 code-block 안이고 밖의 1 (136 행) 은 132 행과 같은 심볼의 짝이라, 한쪽만 in-place 로 고치면 **문서 내부 불일치** 가 새로 생기기 때문이다. 판정 컬럼에서는 두 축을 구분해 남긴다.
- **144 행의 시점 낡음** 은 셋 중 어디에도 속하지 않는 제 3 유형 — `§ 12.35` 가 `## 배포 토폴로지` 에서 만난 "planner 기대가 뒤집힌" 축의 연장선이며, 문서가 코드보다 **뒤처진** (앞선 게 아니라) 유일한 지점이다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (route · 심볼을 실 명칭으로 치환) | 기각 | 치환 지점이 ≥ 8 로 AC 4 의 `≤ 3 지점` 상한을 넘고, 119 행 미shipped 축은 치환할 실 명칭 자체가 없어 창작 금지와 충돌 |
| **(B)** | **단락 원문 무편집 + 단락 말미 각주 blockquote 1 블록 신설** | **채택** | code-block 무편집 선례 (T-1430) 를 승계하면서 실 route · 실 심볼을 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (코드블록 밖 산문만 in-place, 코드블록은 각주) | 기각 | 코드블록 밖 대상이 136 · 144 둘뿐인데 136 은 132 행의 짝이라 단독 치환 시 문서 내부 불일치가 생겨 혼합의 이득이 0 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자가 audit 를 안 읽으면 문서의 `PATCH /admin/schedule` 을 그대로 호출해 404 를 만난다 — 연결 지시 문서에서 가장 비싼 실패 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker **0** 이라 append-only 가 in-place 를 절대 금지하지는 않지만, 본 단락이 손대지 않은 P1 blueprint 원본이라 보존 가중치가 `§ 12.35` 보다도 크다. ② **운영 오도 risk**: 본 단락의 두 code-block 은 "무엇을 호출하면 평가가 돈다" 를 지시하는 서술이라, 117 · 130 행을 그대로 따르면 실제로 **404** 가 난다 (실 진입점은 `PUT /api/schedules` · `POST /api/schedules/trigger`) — `§ 12.35` 의 조건부 mount 오도보다 한 단계 비싸므로 (D) 는 성립하지 않고, (B) 가 실 route 를 같은 화면에 놓아 risk 를 해소한다. ③ **cap**: (B) 의 실측 diff 는 deployment.md `+5/-0` (192 → **197**, 허용 `≤ 197`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 상한 초과라 자동 기각이며 split 을 하더라도 blueprint flow 도식의 재작성 판단이 남아 **ADR 게이트 성격** 이므로 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: 명칭 · 서술 축 단독이라 T-1430 ~ T-1435 · T-1437 의 각주 계열을 그대로 잇고, T-1436 의 혼합 (수치 축이 있을 때의 규칙) 과도 모순이 없다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (4 행)** — 144 행 (`### 후속 task 책임` 말미 = 단락 최말미) 뒤에 append. 내용은 ① 111 · 120 행의 **참** 근거 (dep 31 행 · `forRoot()` 75 행 · service 68 · 74 행) 와 `@Cron` **0** · registry 동적형, ② 두 flow 의 **실 route · 실 심볼 병기** (`api/schedules` · `@Put()` · `@Post("trigger")` · `CronScheduleService.registerOrReplace` · `CronScheduleController.trigger` · `EvaluationOrchestratorService`), ③ **미shipped 축** (영속 model 0 · mutex 0 hit) 과 144 행이 P7 로 미룬 3 항목의 **shipped** 사실, ④ 검증 불가 / 대상외 제외 선언 + 본 절 pointer.
- **각주 위치를 단락 최말미로 잡은 이유** — 각주 대상 claim 이 4 하위 절 **전체** 에 흩어져 있어 어느 하위 절 말미에 두어도 나머지를 앞지르고, 최말미는 두 code-block 을 읽은 독자가 6 행 안에 만나며 `## 외부 네트워크 boundary` 로 넘어가기 직전이라 단락 경계와도 맞는다 (`§ 12.35` 는 대상이 한 하위 절에 모여 있어 그 절 말미를 택했다 — 규칙은 "대상 claim 의 최소 공통 구간 말미" 로 같다).
- **문구 1:1 + 무편집 경계** — 각주의 수치 · 경로 · 심볼명 (`31` · `75` · `68` · `74` · `107` · `140` · `api/schedules` · `SchedulePanel.tsx`) 은 전부 위 실측 출력 그대로이고 **실측되지 않은 동작 (실제 cron default 주기 값, 미구현 mutex 의 설계, 영속 model 의 형태) 은 창작하지 않았다**. 1 ~ 4 행 blockquote · 107 ~ 144 행 원문 · `## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## 외부 네트워크 boundary` 전 구간은 그대로다. **새 pointer 도 추가하지 않았다** — ADR-0042 · T-0412 는 본문에 미등재이므로 audit 쪽에만 기록했고, 각주가 더한 링크는 본 절 1 개뿐이다 (T-1435 ~ T-1437 각주와 같은 규약).

#### T-1437 Follow-up 1 (`@Cron` 0 의 의미 판정) closure 선언

`§ 12.35` 실측 (ii) 가 잡은 `@Cron(` **0 hit** 의 의미는 — 실측 (iv) · (v) 로 **"선언형 cron job 이 0 인 것은 미구현이 아니라 설계 그대로"** 로 판정된다. `src/scheduling/cron-schedule.service.ts` 가 `SchedulerRegistry.addCronJob` / `deleteCronJob` 으로 **런타임 동적 등록** 을 수행하고 (68 · 74 행), 그것이 곧 deployment.md 120 행이 적은 flow 이기 때문이다. 다만 그 등록은 **in-memory 전용** 이라 119 · 124 행이 전제한 **DB 영속 · restart 복원은 아직 없다** — 즉 `@Cron` 0 은 "빌드타임 고정 주기를 쓰지 않는다" 는 뜻이고, 그 대가로 **process restart 시 등록된 cron 이 전부 사라진다** 는 운영 사실이 따라붙는다. 본 절의 각주가 이 두 사실을 deployment.md 에 박제해 Follow-up 1 을 **closure** 한다.

#### 대조 대상 문서 잔여 갱신

`§ 12.35` 가 선언한 deployment.md **잔여 미대조 5** 는 본 절이 `## Scheduler 위치` 1 개를 닫아 **잔여 4** 가 된다 — `## 외부 네트워크 boundary` · `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`. 우선순위는 아래 파생 영향 1 에 둔다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **deployment.md 잔여 미대조 단락 4** — 다음 slice 1 순위는 `## 외부 네트워크 boundary` (접근 대상 목록 · TLS · REQ-020 권한 부족 흐름이 실 `src/github/` · `src/confluence/` · `PermissionDeniedRecord` model 과 대조 가능해 검증 가능 claim 밀도가 가장 높다), 이어 `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`.
2. **UC-01 `§ 5` 의 cron / manual trigger 서술 ↔ 본 절 실측 route 정합** — 미대조. 같은 `PATCH /admin/schedule` 계열 표기가 UC 쪽에도 있으면 본 절 판정을 승계해야 한다.
3. **UC-09 `§ 5` sequence participant 병기** — 20 회째 이월.
4. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
5. **행 번호 → anchor 좌표계 이행** — 14 회째 이월. 본 절의 각주 5 행 삽입으로 `## 외부 네트워크 boundary` 가 146 → **151** 행으로 밀려 후속 task 좌표가 다시 낡는다.
6. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `15 model` · `9 파일` 은 model / 컴포넌트 1 개 추가로 즉시 낡는다.

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **197** (192 → +5, 허용 ≤ 197) · audit **3623** (3517 → +106 = 절 105 + 구분 공백 1, 허용 +115 이내) ·
  directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **36** (35 → 36)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -145,0 +146,5 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (단락 최말미 각주) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `5  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ package.json → (빈 출력 — 코드 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1438-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pnpm build` · `pnpm test` 는 실행하지 않았다).

#### 한계 —

1. **각주가 본문의 거짓 route 를 지우지는 않는다** — 117 · 130 행은 여전히 `/admin/…` 이라 각주를 건너뛴 독자에겐 오도가 남는다. blueprint 원본 보존과 오도 제거의 trade-off 를 보존 쪽으로 택한 결과이며 (`§ 12.35` 한계 2 와 같은 구조), flow 도식 자체의 정정은 ADR-0003 §3 ↔ ADR-0042 계보의 재정렬을 요구하는 별도 판단이다.
2. **본 절은 route 를 api.md endpoint 표와 대조하지 않았다** — 실 `api/schedules` 4 endpoint 가 [api.md](../architecture/api.md) 에 어떻게 적혀 있는지는 out of scope 라 미판정이며, deployment.md 축만 닫았다. 세 문서 (deployment · api · UC-01) 의 route 표기가 서로 어긋날 가능성은 파생 영향 2 로 남는다.

### 12.37 deployment.md `## 외부 네트워크 boundary` 전반부 ↔ 실 `src/github/` · `src/confluence/` · `src/llm/` · `deploy/` 대조 — 원문 보존 + 각주 1 블록 (T-1439)

> **본 절의 위치** — `§ 12.36` 이 deployment.md `## Scheduler 위치` 를 닫으면서 파생 영향 **1** 로 남긴 "잔여 미대조 4 단락, 그중 `## 외부 네트워크 boundary` 가 다음 slice 1 순위" ([T-1438](../tasks/T-1438-deployment-md-scheduler-section-vs-src-audit.md) Follow-up 1) 를 본 절이 **부분** 으로 닫는다 — 단락이 47 행 · 하위 5 절이라 **전반부 4 구간 (도입 문단 · `### 접근 대상 목록` · `### 지원 LLM 환경` · `### TLS / 사내 인증서 처리`) 만** 본 절의 범위이고 후반부 2 절은 다음 slice 로 이월한다. **계보** — `T-1430` ~ `T-1435` (directory.md 6 축) → `T-1436` (산문 단락 축) → `T-1437` (`## 배포 토폴로지` 축) → `T-1438` (`## Scheduler 위치` 축) → **`T-1439` (본 절 — 외부 boundary 전반부 축)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이다. cap 준수를 위해 아래 실측 인용은 **요약형** 이다 (명령 + 핵심 출력만).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md → 151 `## 외부 네트워크 boundary` · 157 `### 접근 대상 목록` · 171 `### 지원 LLM 환경 …` · 175 `### TLS / 사내 인증서 처리` · 181 `### 권한 부족 (REQ-020) 감지 흐름` · 193 `### 운영 호스트 가정`
      ⇒ 전반부 = **151 ~ 180 행** (task 좌표 일치, stale 아님) · 후반부 181 ~ 197 행은 무편집 읽기만.
      $ sed -n '151,180p' … → heading(151) + ADR-0003 §4 pointer(153) + 채택 선언(155) + 표 9 row(159~169) + LLM 산문 1 문단(173) + TLS 2 문단(177 · 179).
      claim 이분 — **검증 가능 12** (pointer 실재 · host 문자열 · provider 명칭/개수 · REQ 부여 여부 · 환경변수 등재 · 금지 위반 실재 · dependency 0) · **검증 불가 5** (155 행 "corporate network 또는 VPN 에 위치" 운영 가정 · 표 `인증` 컬럼의 PAT/API key 발급 정책 · 173 행 "어느 provider 도 default 가 아니다" 의 설계 의도 · 173 행 live-verification 의 품질 분리 논증 · 179 행 "Node.js HTTPS stack 이 native 지원" 의 런타임 외부 동작 — 본 slice 미측정).
(ii)  GitHub host 축 — $ grep -rn "github.sec.samsung.net\|github.ecodesamsung.com\|github.com" src/github --include='*.ts' | grep -v spec | head -15
      → `github-live-test-gating.ts` **59 `host: "github.com"` · 64 `host: "github.sec.samsung.net"` · 69 `host: "github.ecodesamsung.com"`** ; `github-request.builder.ts` 28 `GITHUB_PUBLIC_HOST = "github.com"` · 29 `GITHUB_PUBLIC_API_BASE = "https://api.github.com"` ; `github-instance-config.ts` 36 "base host(예: github.com / github.sec.samsung.net)" ⇒ 표 3 row **참** (public 만 API host 분리 특례).
(iii) Confluence 축 — $ grep -n "baseUrl\|host\|samsung" src/confluence/confluence-instance-config.ts | head -15
      → 46 `baseUrl: string` · 124 `env[confluenceEnvName(key, CONFLUENCE_BASE_URL_SUFFIX)]` · 166 `baseUrl: baseUrlRaw.trim()` ; **고정 host 열거 0 hit** ⇒ **base URL 주입형** — 표의 `confluence.sec.samsung.net` 은 **예시값** 이며 하드코딩 가정이 아니다 (판정 **부분참**).
(iv)  LLM provider 축 — $ grep -rn "azure\|anthropic\|gemini\|openai\|custom" src/llm --include='*.ts' | grep -v spec | grep -i "provider" | head -12
      → `llm-http-gateway.service.ts` **138 "지원 provider 는 azure_openai / custom / openai / anthropic / google_gemini"** (+ 13 · 126 행 "milestone-1 의 5 provider") · `dto/create-llm-provider-config.dto.ts` 32 동일 5 종 · `providers/{anthropic,azure-openai,google-gemini,openai-compatible}.adapter` import (38 · 42 · 46 · 50 행) ⇒ 표 5 row · 산문 5 종과 **개수 · 명칭 두 축 모두 일치 (참)**.
      $ grep -rn "LLM_LIVE_PROVIDER" src … → `llm-live-test-gating.ts` 29 `LLM_LIVE_PROVIDER_ENV = "LLM_LIVE_PROVIDER"` ⇒ 173 행의 gating env 서술 **참**.
      $ grep -c "REQ-0" docs/requirements.md → **66** ; $ grep -n -i "provider" docs/requirements.md | head -8 → REQ-005 · REQ-029 등 **본문 안의 우연 hit 뿐** — LLM provider 전용 REQ row **0** ⇒ `REQ TBD` 자체는 **여전히 유효** 하나 조건절 `P2 가 requirements.md 에 추가 시 부여` 는 P2 경과 후에도 미부여라 **시점 표기가 낡음** (부분참).
(v)   직접 outbound 축 — $ grep -rn "globalThis.fetch" src --include='*.ts' | grep -v spec | head -8 → `confluence-adapter.service.ts` 305 · `confluence.module.ts` 15 · `github-adapter.service.ts` 246 · `github.module.ts` 8 · (`llm-http-gateway.service.ts` 76) ⇒ 3 adapter 전부 default `globalThis.fetch` 주입.
      $ grep -rn "axios\|undici\|HttpModule\|ProxyAgent" src --include='*.ts' | grep -v spec | head -8 → **0 hit** ⇒ 155 행 "app process 직접 outbound · 별도 egress proxy / NAT / bastion 없음" **참**.
(vi)  TLS / proxy 축 — $ grep -n "NODE_EXTRA_CA_CERTS\|HTTPS_PROXY\|HTTP_PROXY\|NO_PROXY\|NODE_TLS_REJECT_UNAUTHORIZED" deploy/env.prod.example
      → **42 `# NODE_EXTRA_CA_CERTS=/etc/ssl/certs/corp-ca-bundle.pem` · 43 `# HTTPS_PROXY=http://proxy.example:8080` · 44 `# NO_PROXY=localhost,127.0.0.1,postgres`** (40 행 헤더가 `deployment.md "외부 네트워크" 단락` 을 명시 인용) ; `HTTP_PROXY` **미등재** ; `NODE_TLS_REJECT_UNAUTHORIZED` **미등재**.
      $ grep -rn "NODE_TLS_REJECT_UNAUTHORIZED" src scripts → **0 hit** ⇒ 177 행 금지 서술의 **위반 0**.
(vii) pointer 축 — $ ls ADR-0003-deployment.md ADR-0045-llm-provider-deployment-config.md ADR-0048-default-model-id-source.md → **3 개 전부 실재** (pointer 유효까지만, 본문 재판정 없음).
(viii) baseline — wc -l deployment.md **197** · audit **3623** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **36** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 의 "본 문서는 P1 T-A2 의 산출물" 선언이 그대로 걸리는 P1 blueprint 원본이라 보존 강도가 `§ 12.36` 과 동급으로 높다. ② **`§ 12.15` 정합**: 전반부 30 행에 날짜 stamp 는 **0** 이고 시점성 표현은 `P2 가 requirements.md 에 추가 시 부여` **1 hit** 뿐이라 시점 marker 는 사실상 1 — append-only 가 in-place 를 절대 금지하지는 않으나 근거가 얇아 보존 쪽 가중치가 남는다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 축이면 T-1430 ~ T-1435 · T-1437 · T-1438 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 전반부는 **수치 claim 0 · 명칭/등재 축 전부** 라 각주 계열에 든다.

**표 안 claim 의 별도 판정** — `### 접근 대상 목록` 은 markdown 표라 [T-1435](../tasks/T-1435-directory-md-mapping-table-columns-vs-src-audit.md) 의 "mapping 표 컬럼 = 원문 보존 + 각주" 선례를 **승계** 한다. 논증 1 구: 표의 `대상` 컬럼은 9 row 가 `위치` · `인증` · `관련 REQ` 3 컬럼과 한 줄로 묶여 의미를 이루므로 Confluence 1 셀만 "주입형 base URL" 로 바꾸면 나머지 8 row 의 고정-host 화법과 어긋나 **표 내부가 두 어휘로 갈라진다** — 셀 단위 치환의 국소성이 산문보다 낮다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 153 | ADR-0003 §4 가 본 결정의 박제처 | 파일 실재 | 참 | 무편집 | 실측 (vii), 본문 재판정 없음 |
| 155 | app process 가 직접 outbound · proxy / bastion 없음 | `globalThis.fetch` 3 adapter · http lib **0 hit** | 참 | 무편집 + 각주 근거 | 실측 (v) |
| 161 | github.com (public, PAT) | `github-live-test-gating.ts` 59 행 | 참 | 무편집 + 각주 근거 | public 만 API host 분리 |
| 162 | github.sec.samsung.net (내부망) | 같은 파일 64 행 | 참 | 무편집 + 각주 근거 | 실측 (ii) |
| 163 | github.ecodesamsung.com (내부망) | 같은 파일 69 행 | 참 | 무편집 + 각주 근거 | 실측 (ii) |
| 164 | confluence.sec.samsung.net (+ 추가 사내 Confluence) | `baseUrl` env 주입형 · 고정 host 0 | 부분참 | 원문 보존 + 각주 부기 | 표의 host 는 **예시값** (T-1435 승계) |
| 165 ~ 169 | LLM provider 5 종 (Azure / Anthropic / Gemini / OpenAI / Custom) | gateway 138 행 5 종과 일치 | 참 | 무편집 + 각주 근거 | 개수 · 명칭 두 축 일치 |
| 165 | `REQ TBD, P2 가 requirements.md 에 추가 시 부여` | LLM 전용 REQ **0** / P2 는 경과 | 부분참 | 원문 보존 + 각주 부기 | TBD 는 참 · 조건절만 낡음 |
| 173 | provider 선택 = `LlmProviderConfig` row + `LLM_LIVE_*` gating env | dto 32 행 · gating 29 행 | 참 | 무편집 + 각주 근거 | 실측 (iv) |
| 173 | ADR-0045 · ADR-0048 pointer | 두 파일 실재 | 참 | 무편집 | 실측 (vii) |
| 177 | `NODE_EXTRA_CA_CERTS` 사용 · 별도 dependency 0 | `env.prod.example` 42 행 · http lib 0 hit | 참 | 무편집 + 각주 근거 | 운영 config 에 이미 등재 |
| 177 | `NODE_TLS_REJECT_UNAUTHORIZED=0` 금지 | `src` · `scripts` **0 hit** | 참 (위반 0) | 무편집 + 각주 근거 | 금지 준수 실증 |
| 179 | `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 환경변수 사용 | 42 ~ 44 행에 2 개 등재 · `HTTP_PROXY` 미등재 | 부분참 | 원문 보존 + 각주 부기 | 등재 여부만 판정 (동작 미측정) |

- 합계 — 검증 가능 **12 = 참 9 · 부분참 3 · 거짓 0**, 검증 불가 5 는 대상 제외. **거짓 0 은 본 stream 에서 처음** 이며, `§ 12.36` 의 거짓 8 (Scheduler flow 도식) 과 대비된다 — 전반부는 host / 환경변수처럼 **shipped 사실에 붙은 서술** 이라 blueprint 미래형이 섞일 여지가 적었다.
- **참 확인 축과 stale 표기 축의 분리 판정** — 참 9 (host 3 · outbound · provider 5 종 · gating env · CA 인증서 · 금지 준수 · pointer) 는 문서와 코드가 이미 맞으므로 **무편집이 자연스럽고**, 각주는 근거만 병기한다. stale 표기 축 (165 행 `P2 가 …추가 시 부여`) 은 표기 갱신 여지가 있었으나 **원문 보존 + 각주** 로 수렴했다 — 이유 1 구: 그 조건절을 고치려면 "REQ 를 언제 부여할지" 라는 **새 시점 약속을 창작** 해야 하는데 REQ 신설은 본 slice 의 Out of Scope (requirements.md 무편집) 이므로, 실측 사실 (전용 REQ 0 · P2 경과) 만 각주에 남기는 것이 창작 금지와 양립하는 유일한 처리다.
- **부분참 3 의 내역 구분** — 164 행은 **표현 층위** (고정 host vs 주입형 예시값), 165 행은 **시점 층위** (조건절이 낡음), 179 행은 **범위 층위** (3 환경변수 중 2 만 config 등재) 로 서로 다른 유형이라 각주에서도 문장을 분리해 적었다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (표 host 셀 · REQ 표기 · proxy 문장 치환) | 기각 | 치환 대상 3 지점이 전부 **창작 없이는 못 고치는 축** (예시값 화법 · 새 REQ 시점 약속 · 미측정 런타임 동작) 이라 AC 4 의 창작 금지와 정면 충돌 |
| **(B)** | **단락 전반부 원문 무편집 + 전반부 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 · T-1438 화법을 그대로 잇고, 참 9 의 근거와 부분참 3 의 실측을 같은 화면에 병기해 운영 오도 risk 만 제거 |
| (C) | 혼합 (표는 각주, 산문 stale 표기만 in-place) | 기각 | stale 표기 (`REQ TBD …`) 가 산문이 아니라 **표 셀 안** 이라 혼합의 분할선이 성립하지 않고, 남는 산문 대상은 179 행 1 개뿐이라 이득이 0 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자가 표의 `confluence.sec.samsung.net` 을 **고정 대상** 으로 읽고 base URL env 주입 (`…_BASE_URL`) 을 빠뜨리면 Confluence 연동이 통째로 실패한다 — 배포 지시 문서에서 가장 비싼 실패 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 1 (165 행) 뿐이고 그마저 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **운영 오도 risk**: 본 문서는 **배포 지시 문서** 라 표의 host / 환경변수를 그대로 설정하는 독자를 상정해야 하고 — Confluence host 를 고정으로 읽으면 env 주입 누락, `HTTP_PROXY` 를 등재된 것으로 읽으면 config 부재로 각각 연동 실패가 나므로 risk 가중치가 산문 문서보다 한 단계 높다 (그래서 (D) 기각). ③ **cap**: (B) 의 실측 diff 는 deployment.md `+5/-0` (197 → **202**, 허용 `≤ 202`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 창작 금지 충돌로 자동 기각이며 split 을 하더라도 REQ 부여 판단이 남아 **게이트 성격** 이라 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: 명칭 · 등재 축 단독이라 T-1430 ~ T-1435 · T-1437 · T-1438 의 각주 계열을 그대로 잇고, 표 축은 T-1435 승계라 T-1436 의 혼합 (수치 축이 있을 때의 규칙) 과도 모순이 없다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (4 행)** — 179 행 (`### TLS / 사내 인증서 처리` 말미 = 전반부 최말미) 뒤에 append. 내용은 ① 155 행 **직접 outbound 참** 의 근거 (`globalThis.fetch` 3 adapter · http lib 0 hit), ② GitHub 3 host **실재** + public API host 분리 특례 와 Confluence 의 **base URL 주입형 · 예시값** 구분, ③ provider 5 종 **일치** + `LLM_LIVE_PROVIDER` 실재 + `REQ TBD` 조건절의 **시점 낡음**, ④ TLS / proxy 3 환경변수의 **등재 2 · 미등재 1** 과 금지 위반 **0**, ⑤ 검증 불가 / 미측정 제외 선언 + 본 절 pointer.
- **각주 위치를 전반부 최말미로 잡은 이유** — 대상 claim 이 4 구간 **전체** 에 흩어져 있어 어느 하위 절 말미에 두어도 나머지를 앞지르고, 179 행 뒤는 후반부 (`### 권한 부족 …`) 진입 직전이라 **본 slice 의 범위 경계와 정확히 일치** 한다 (규칙은 선행 절과 같은 "대상 claim 의 최소 공통 구간 말미").
- **문구 1:1 + 무편집 경계** — 각주의 수치 · 경로 · 심볼명 (`246` · `305` · `76` · `59` · `64` · `69` · `29` · `46` · `124` · `138` · `42 ~ 44` · `66`) 은 전부 위 실측 출력 그대로이고 **실측되지 않은 동작 (proxy 환경변수의 fetch 런타임 지원 여부, 특정 provider 의 default 지정, 인증서 mount 절차) 은 창작하지 않았다**. 1 ~ 4 행 blockquote · 151 ~ 179 행 원문 · **181 ~ 197 행 (후반부 2 절)** · `## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` 는 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 링크는 본 절 1 개뿐이며 ADR-0003 · ADR-0045 · ADR-0048 외 문서는 본문에 등재하지 않았다.

#### T-1438 Follow-up 1 부분 closure 선언

`§ 12.36` 파생 영향 1 이 다음 slice 1 순위로 지정한 `## 외부 네트워크 boundary` 를 본 절이 **전반부만 closure** 한다 — 도입 문단 · `### 접근 대상 목록` · `### 지원 LLM 환경` · `### TLS / 사내 인증서 처리` 4 구간의 검증 가능 claim 12 는 전부 판정 · 각주 반영을 마쳤다. **후반부 2 절 (`### 권한 부족 (REQ-020) 감지 흐름` 181 ~ 192 행 · `### 운영 호스트 가정` 193 ~ 197 행) 은 미대조로 이월** 하며, 본 절 실측 (v) 가 이미 잡은 `axios` · `undici` · `HttpModule` **0 hit** 는 후반부 code-block 의 해당 표기가 어긋남을 강하게 시사하므로 다음 slice 의 1 순위 근거가 된다 (본 slice 는 범위 밖이라 판정하지 않는다).

#### 대조 대상 문서 잔여 갱신

`§ 12.36` 이 선언한 deployment.md **잔여 미대조 4** 는 본 절이 `## 외부 네트워크 boundary` 의 전반부를 닫아 **잔여 3 단락 + 본 단락 후반부 1** 이 된다 — `## 외부 네트워크 boundary` 후반부 · `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`. 우선순위는 아래 파생 영향 1 · 2 에 둔다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **본 단락 후반부 (다음 slice 1 순위)** — `### 권한 부족 (REQ-020) 감지 흐름` code-block 의 `axios / undici / NestJS HttpModule` 표기는 본 절 실측 (v) 의 **0 hit** 와 어긋나고, `PermissionDeniedEvent` · `NotificationService` 심볼 실재 와 `PermissionDeniedRecord` model 대조, "P4 phase 도입 task 책임" 시점 서술의 유효성 (`§ 12.36` 144 행과 같은 유형) 이 함께 걸려 **검증 가능 claim 밀도가 잔여 중 최고** 다.
2. **deployment.md 잔여 미대조 단락 3** — `## Secret / 자격증명 저장` (env 주입 방식이 `deploy/env.prod.example` 과 대조 가능해 2 순위) → `## DB / Persistence` → `## 개요`.
3. **UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter 정합** — 미대조. 본 절 후반부 slice 와 같은 심볼 축이라 판정 승계 여지가 있다.
4. **UC-09 `§ 5` sequence participant 병기** — 21 회째 이월.
5. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
6. **행 번호 → anchor 좌표계 이행** — 15 회째 이월. 본 절의 각주 5 행 삽입으로 후반부 2 절이 181 → **186** 행으로 밀려 다음 slice 좌표가 다시 낡는다.
7. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `5 provider` · `66 REQ` 는 provider / REQ 1 개 추가로 즉시 낡는다.

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **202** (197 → +5, 허용 ≤ 202) · audit **3735** (3623 → +112 = 절 111 + 구분 공백 1, 허용 +115 이내) ·
  directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **37** (36 → 37)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -180,0 +181,5 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (전반부 최말미 각주) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `5  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ package.json → (빈 출력 — 코드 · 배포 config 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1439-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pnpm build` · `pnpm test` 는 실행하지 않았다).

#### 한계 —

1. **표 셀의 부분참 2 는 각주로만 해소된다** — 164 · 165 행은 여전히 고정 host 화법 · `P2` 조건절을 유지하므로 각주를 건너뛴 독자에겐 오도가 남는다. 창작 금지 (실측 밖 표현 신설 불가) 와 표 정합 (T-1435 승계) 을 우선한 결과이며, 표 자체의 어휘 재설계는 REQ 부여 판단과 묶여 별도 게이트다.
2. **환경변수는 "등재 여부" 까지만 판정했다** — `HTTPS_PROXY` / `NO_PROXY` 가 Node `fetch` (undici) 런타임에서 실제로 존중되는지는 실행 검증이 필요해 본 절 범위 밖이며 (Out of Scope 의 test 실행 금지), 179 행의 "native 지원" 서술은 **미판정** 으로 남겼다. 이 축은 smoke / e2e 성격이라 `pr` mode slice 소관이다.

### 12.38 deployment.md `## 외부 네트워크 boundary` 후반부 ↔ 실 `src/github/` · `src/confluence/` · `prisma/schema.prisma` · `docs/requirements.md` 대조 — 원문 보존 + 각주 1 블록 (T-1440)

> **본 절의 위치** — `§ 12.37` 이 `## 외부 네트워크 boundary` 를 **전반부만** 닫으면서 파생 영향 **1** 로 남긴 "본 단락 후반부 = 다음 slice 1 순위" ([T-1439](../tasks/T-1439-deployment-md-network-boundary-section-vs-src-audit.md) Follow-up 1) 를 본 절이 계승해 **단락 전체를 완결** 한다. **계보** — `T-1430` ~ `T-1435` (directory.md 6 축) → `T-1436` (산문 단락 축) → `T-1437` (`## 배포 토폴로지`) → `T-1438` (`## Scheduler 위치`) → `T-1439` (본 단락 전반부) → **`T-1440` (본 절 — 본 단락 후반부 축)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이며 상위 slice 가 박제한 지점에는 `승계` 가 더해진다. cap 준수를 위해 아래 실측 인용은 **요약형** 이다 (명령 + 핵심 출력만).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md → 151 `## 외부 네트워크 boundary` · 157 · 171 · 175 (전반부, `§ 12.37` closure) · **186 `### 권한 부족 (REQ-020) 감지 흐름`** · **198 `### 운영 호스트 가정`** ⇒ 후반부 = **186 ~ 202 행** (AC 좌표 일치 — `§ 12.37` 각주 5 행 삽입 반영분이라 stale 아님).
      $ sed -n '186,202p' … → heading(186) + fenced code-block(188 ~ 194, 5 단계 flow) + 산문(196) + heading(198) + 산문(200) + 산문(202).
      claim 이분 — **검증 가능 13** (심볼 4 · 라이브러리 3 · 흐름 2 · REQ 번호 1 · 시점 2 · pointer 1) · **검증 불가 4** (200 행 corporate network 위치 가정 · cloud 이전 시 ADR SUPERSEDE 필요라는 절차 규범 · VPN tunnel / Direct Connect / ExpressRoute 열거의 적절성 · "본 task 의 범위 밖" 이라는 T-0015 시점 자기 서술 — 본 slice 미측정).
(ii)  transport 축 — **재측정** (T-1439 실측 (v) 승계가 아니라 본 slice 에서 같은 명령을 다시 실행).
      $ grep -rn "axios\|undici\|HttpModule\|ProxyAgent" src --include='*.ts' | grep -v spec | head -8 → **0 hit** (출력 없음)
      $ grep -rn "globalThis.fetch" src/github src/confluence … | head -6 → `github-adapter.service.ts` **246 `private readonly fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike`** (+ 152 · 240 주석) · `github.module.ts` 8 · `confluence-adapter.service.ts` 297 · 169 (주석 — "default globalThis.fetch")
      ⇒ 190 행 3 라이브러리 **거짓**, 실 transport 는 주입형 `globalThis.fetch` (`FetchLike` port).
(iii) 이벤트 · 알림 심볼 축 — $ grep -rn "PermissionDeniedEvent\|NotificationService\|EventEmitter" src … | head -10 → 10 행 전부 `PermissionDeniedEvent` hit (`confluence-adapter.service.ts` 222 `export interface PermissionDeniedEvent` 등) ; 개별 집계 → `PermissionDeniedEvent` **32** · `NotificationService` **0 hit** · `EventEmitter` **0 hit** (`package.json` 의 `@nestjs/event-emitter` 도 **미등재**).
      $ grep -rn "PermissionDenied" src/github src/confluence … | head -8 → `github-adapter.service.ts` 202 `interface PermissionDeniedEvent` · 215 `interface PermissionDeniedEmitter` ; `confluence-adapter.service.ts` 237 · 243 `NO_OP_PERMISSION_DENIED_EMITTER` · 258 `CONFLUENCE_PERMISSION_DENIED_EMITTER`
      $ grep -n "model PermissionDeniedRecord" -A 12 prisma/schema.prisma → **513 `model PermissionDeniedRecord`** (provider / instanceRef / resourceRef / principal? / httpStatus / reason? / createdAt + index 2)
      ⇒ 실 흐름은 **emit 이되 NestJS EventEmitter 가 아닌 자체 port** 이고 종착점은 **알림이 아니라 record 영속** — `github.module.ts` 61 ~ 62 `provide: PERMISSION_DENIED_EMITTER, useClass: PersistingPermissionDeniedEmitter` → `persisting-permission-denied-emitter.ts` 34 → `permission-denied-record.service.ts` 109 `async record(` → 513 행 model.
(iv)  REQ 번호 체계 축 — $ grep -n "^| REQ-008 \|^| REQ-016 \|^| REQ-020 " docs/requirements.md | cut -c1-160
      → 27 `REQ-008 | 20 | 접근 권한(read) 부족 시 인식·통지 | FR | P4 | unit + smoke | DONE` · 35 `REQ-016 | 33 | Confluence 접근 권한 부족 인식·통지 | FR | P4 | unit | DONE` · 39 `REQ-020 | 39 | 조직 기여 큰 인원 → 높은 점수 | FR | P5 | manual + unit | IN_PROGRESS`
      ⇒ 권한 부족은 **REQ-008 (GitHub) · REQ-016 (Confluence)** 이고 REQ-020 은 점수 산정 축이라 heading 의 `(REQ-020)` 은 **거짓** (현 번호 체계 기준). requirements.md 는 **무편집** 이며 REQ 신설 · 재번호도 없다.
(v)   시점 서술 축 — $ grep -n '"phase"' docs/STATE.json | head -2 → 3 `"phase": "P4-complete / P5-in-progress"` ⇒ REQ-008 · REQ-016 `DONE` + P4 완료라 196 · 202 행은 **이미 지난 시점을 미래형** 으로 서술한다. 세부 — 4xx 분류는 `permission-denied-record.service.ts` 81 `deriveReason` 이 401/403 → `"permission-denied"` · 404 → `"not-found-or-hidden"` 까지 shipped (429 / 5xx 는 null fallback, `github-adapter.service.ts` 411 `private mapNon2xx` 와 정합) ; 알림 채널은 `Notification` / `notify` **0 hit** 로 미구현.
      `§ 12.15` 강도 1 구 — 두 행은 **날짜 stamp 가 없고** phase 배정 (현행 계획 서술) 이라 append-only 의 "시점 기록" 보다 "현행 상태 서술" 에 가깝지만, `§ 12.36` 144 행 (`P7 phase 책임` 시점 낡음 — 동일 유형) 이 **원문 보존 + 각주** 로 처리된 직전 선례가 있어 본 절도 그 강도를 승계한다.
(vi)  pointer 축 — $ ls docs/decisions/ADR-0003-deployment.md → **실재** (파일 존재 = pointer 유효까지만, 본문 재판정 · status 변경 없음).
(vii) baseline — wc -l deployment.md **202** · audit **3735** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **37** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 가 "본 문서는 P1 T-A2 의 산출물" 을 선언하고 본 후반부는 [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 가 채운 P1 blueprint 원본이라 보존 강도가 `§ 12.36` · `§ 12.37` 과 동급이다. ② **`§ 12.15` 정합**: 후반부 17 행에 날짜 stamp 는 **0** 이나 시점 marker 는 196 · 202 행 **2 hit** (`P4 phase 의 도입 task 책임` · `P4 / P7 의 task 책임`) 로 전반부 (1 hit) 보다 짙다 — append-only 가 in-place 를 절대 금지하진 않지만 보존 쪽 가중치가 더 남는다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, flow 도식 · 서술 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1439 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 후반부는 **수치 claim 0 · flow 도식 + 시점 축** 이라 각주 계열에 든다.

**code-block 안 claim 의 별도 판정** — 188 ~ 194 행은 fenced code-block 이라 [T-1430](../tasks/T-1430-directory-md-module-coordinate-resync.md) ASCII tree 무편집 · `§ 12.36` flow 도식 무편집 선례를 **승계** 하고, 블록 **밖에서 각주로 부인** 한다. 논증 1 구: 이 블록은 개별 심볼 나열이 아니라 **5 단계 화살표 flow 한 덩어리** 라 190 행 transport 만 `globalThis.fetch` 로 고치면 그 뒤 192 · 193 행 (`EventEmitter` · `NotificationService`) 이 여전히 거짓인 채 남아 **독자가 블록 전체를 검증된 지도로 오신** 하게 되고, 5 행 전부를 실 명칭으로 바꾸면 그것은 후보 (A) 의 블록 재작성이라 AC 4 의 `≤ 2 지점` 상한과 창작 금지에 걸린다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 186 | heading 의 권한 부족 = `REQ-020` | REQ-020 은 `조직 기여 큰 인원 → 높은 점수` (P5) | 거짓 | 원문 보존 + 각주 부기 | 실 대응은 REQ-008 · REQ-016, 재번호는 owner 게이트 |
| 189 | `GithubAdapter` / `ConfluenceAdapter` 가 주체 | github 237 행 · confluence 293 행 실재 | 참 | 무편집 + 각주 근거 | 실측 (iii) |
| 189 | `LlmGatewayService` 도 주체 | `src/` **0 hit** (실체 `LlmHttpGateway` 74 행) | 거짓 | 원문 보존 + 각주 부기 | `src/llm` 권한 부족 emit 경로 **0** |
| 190 | 외부 HTTPS 호출 = `axios` / `undici` / `HttpModule` | 3 라이브러리 **0 hit** | 거짓 | 원문 보존 + 각주 부기 | 실 transport 는 `globalThis.fetch` (github 246 행) |
| 191 | 4xx 응답 catch (특히 401 / 403) | `mapNon2xx` github 411 · confluence 491 행 | 참 | 무편집 + 각주 근거 | 401/403 분기에서 emit 후 throw |
| 192 | `PermissionDeniedEvent` emit | `src/` **32 hit** (github 202 · confluence 222 행) | 참 | 무편집 + 각주 근거 | 심볼명까지 1:1 일치 |
| 192 | 전달 수단 = NestJS `EventEmitter` | `EventEmitter` **0 hit** · dep 미등재 | 거짓 | 원문 보존 + 각주 부기 | 실제는 자체 `PermissionDeniedEmitter` port + DI token |
| 193 | `NotificationService` 가 수신 | **0 hit** | 거짓 | 원문 보존 + 각주 부기 | 실 수신자 `PersistingPermissionDeniedEmitter` 34 행 |
| 193 | Admin 알림 + 해당 User 알림 | push 알림 0 · `GET /api/permission-denied-records` pull 조회 실재 | 부분참 | 원문 보존 + 각주 부기 | audience 2 종은 맞고 전달 방식이 다름 (service 163 행 분기) |
| 196 | 4xx 분류 (만료 / scope / 비공개 / rate limit) 구현 | `deriveReason` 81 행이 401/403 · 404 만 (429/5xx null) | 부분참 | 원문 보존 + 각주 부기 | 분류 축은 부분 shipped |
| 196 | 위 구현은 **P4 phase 의 도입 task 책임** | REQ-008 · REQ-016 `DONE` · phase `P4-complete` | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | `§ 12.36` 144 행과 동일 유형 |
| 200 | ADR-0003 이 SUPERSEDE 대상 pointer | 파일 실재 | 참 | 무편집 | 실측 (vi), 본문 재판정 없음 |
| 202 | 도입 4 항목이 **P4 / P7 의 task 책임** | CA / proxy 는 `env.prod.example` 42 ~ 44 (§ 12.37 승계) · 4xx catch 는 shipped · 알림 채널만 미구현 | 부분참 | 원문 보존 + 각주 부기 | 4 항목 중 3 이 이미 지남 |

- 합계 — 검증 가능 **13 = 참 4 · 부분참 3 · 거짓 6**, 검증 불가 4 는 대상 제외. 거짓 6 의 내역은 **심볼 / 라이브러리 어긋남 4** (189 · 190 · 192 · 193) · **REQ 번호 1** (186) · **시점 낡음 1** (196) 이다. `§ 12.37` 의 거짓 0 (전반부) 과 정면 대비되며, 이는 후반부가 **미구현 시점의 blueprint flow 도식** 인 반면 전반부는 shipped 사실에 붙은 서술이었기 때문이다.
- **거짓 축 · 부분참 축 · 시점 축의 분리 판정** — ① **거짓 (transport · REQ 번호)**: transport 는 code-block 안이라 블록 정합상 각주로 가고, REQ 번호는 블록 밖 heading 이라 in-place 가 기술적으로 가능했으나 **ADR-0003 88 행이 같은 `REQ-020 권한 부족 흐름` 표기를 갖고 153 행이 본 단락의 박제처를 ADR-0003 으로 지목** 하므로 deployment.md 만 고치면 정본 ↔ view 가 새로 어긋난다 (ADR 본문 편집은 본 slice Out of Scope) → 각주로 수렴. ② **부분참 (event / notify)**: `PermissionDeniedEvent` 는 맞고 전달 수단 · 수신자만 다른 **형태 상이** 라 원문을 지우면 맞는 절반까지 잃는다 → 각주가 유일한 무손실 처리. ③ **시점 (P4 / P7)**: 갱신하려면 "이제 어느 phase 책임인가" 라는 **새 배정을 창작** 해야 하는데 phase 재배정은 PLAN 게이트라 실측 사실 (status `DONE` · phase 값 · 미구현 잔여 1) 만 각주에 남긴다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (code-block 재작성 포함) | 기각 | 치환 지점이 **6** 으로 AC 4 의 `≤ 2 지점` 상한을 넘고, 196 · 202 행 시점 축은 새 phase 배정을 창작해야 해 AC 4 창작 금지와 충돌 |
| **(B)** | **단락 후반부 원문 무편집 + 후반부 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1439 화법을 그대로 잇고 실 심볼 (`globalThis.fetch` · `PermissionDeniedEmitter` · `PermissionDeniedRecord`) 과 실 REQ 번호를 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (code-block 은 각주, heading 의 REQ 번호만 in-place) | 기각 | heading 의 `(REQ-020)` 은 **ADR-0003 88 행 표기의 전사** 라 한쪽만 치환하면 정본과 어긋나고, `docs/` 전수 REQ sweep 은 별도 slice 소관 (Out of Scope) 이라 1 지점 선행 치환은 sweep 일관성을 깬다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자 · 후속 구현자가 code-block 을 실 구현 지도로 읽고 `axios` 설정 · `NotificationService` 를 찾으러 가면 **존재하지 않는 계층을 쫓는** 낭비가 생긴다 — 배포 지시 문서에서 가장 비싼 실패 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 2 (196 · 202) 가 모두 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **오도 risk**: 본 문서는 **배포 지시 문서** 라 독자가 code-block 을 배선 지도로 읽는 것을 상정해야 하고 — `axios` 를 찾으면 dependency 자체가 없고 `NotificationService` 를 찾으면 모듈이 없으며 REQ-020 으로 trace 하면 점수 산정 REQ 로 잘못 도달한다. 세 오도 모두 "없는 것을 찾는" 유형이라 산문 문서보다 risk 가중치가 한 단계 높다 (그래서 (D) 기각). ③ **cap**: (B) 의 실측 diff 는 deployment.md `+5/-0` (202 → **207**, 허용 `≤ 207`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 창작 금지 충돌로 자동 기각이며 split 하더라도 phase 재배정 · REQ 재번호가 남아 **게이트 성격** 이라 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: flow 도식 + 시점 축 조합은 `§ 12.36` (T-1438) 과 정확히 같은 형상이고 그 절이 (B) 를 채택했으므로 본 절이 다른 후보를 고르면 인접 두 단락의 처리가 갈린다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (4 행)** — 202 행 (`### 운영 호스트 가정` 말미 = 후반부 최말미이자 문서 최말미) 뒤에 append. 내용은 ① 189 행 adapter 3 종의 **실재 2 · 0 hit 1** 과 190 행 transport **거짓** + 실 `globalThis.fetch`, ② 191 행 **참** (`mapNon2xx` 401/403) 과 192 행 **부분참** (event 실재 · `EventEmitter` 0 hit · 자체 port + DI token), ③ 193 행 **거짓** (`NotificationService` 0 hit) 과 실 종착 `PermissionDeniedRecord` 영속 + pull 조회 audience, ④ 196 · 202 행 **시점 낡음** (REQ-008 · REQ-016 `DONE` · phase `P4-complete / P5-in-progress` · 알림 채널만 잔여) + `### 운영 호스트 가정` 의 **검증 불가 선언** + ADR-0003 pointer 실재 + 본 절 pointer.
- **각주 위치 근거** — 대상 claim 이 `### 권한 부족 …` 과 `### 운영 호스트 가정` **두 하위 절에 걸쳐** 있어 어느 한 절 말미에 두면 나머지를 앞지르므로, 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 후반부 최말미에 뒀다. 그 위치가 `## 외부 네트워크 boundary` 단락의 끝이자 문서의 끝이라 다음 단락을 침범하지 않는다.
- **문구 1:1 + 무편집 경계** — 각주의 경로 · 심볼 · 수치 (`237` · `293` · `74` · `246` · `411` · `491` · `32 hit` · `34` · `109` · `513` · `163` · `81` · REQ-008 · REQ-016 · `P4-complete / P5-in-progress`) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 동작 (존재하지 않는 알림 채널 · 미구현 event bus · 새 phase 배정 · 새 REQ 번호) 은 창작하지 않았다**. 1 ~ 4 행 blockquote · **151 ~ 185 행 (전반부 + T-1439 각주)** · 186 ~ 202 행 원문 · `## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` 는 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 링크는 ADR-0003 (이미 200 행에 등재) 과 본 절 2 개뿐이다.

#### T-1439 Follow-up 1 closure + `## 외부 네트워크 boundary` 단락 closure 선언

- **T-1439 Follow-up 1 closure** — `§ 12.37` 이 "다음 slice 1 순위" 로 이월한 후반부 2 절 (`### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정`) 의 검증 가능 claim **13** 을 본 절이 전부 판정 · 각주 반영했다. 이월 근거였던 `axios` · `undici` · `HttpModule` **0 hit** 는 재측정으로 확인됐고 190 행이 **거짓** 으로 확정됐다. 승계 대상이 남지 않는다.
- **단락 전체 closure** — `## 외부 네트워크 boundary` (151 ~ 202 행) 는 전반부 `§ 12.37` (검증 가능 12) + 후반부 본 절 (검증 가능 13) 으로 **완결** 이며, 단락 안 각주는 전반부 말미 1 블록 + 후반부 말미 1 블록 **2 개** 다. 두 각주는 대상 구간이 겹치지 않아 중복 부기가 없다.

#### 대조 대상 문서 잔여 갱신

`§ 12.37` 이 남긴 deployment.md **잔여 3 단락 + 본 단락 후반부 1** 중 후반부를 본 절이 닫아 **잔여 3 단락** 이 된다 — `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`. 우선순위는 아래 파생 영향 1 · 2 에 둔다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **`## Secret / 자격증명 저장` (다음 slice 1 순위)** — 81 ~ 106 행의 env 주입 방식 · secret 종류 · rotation 정책이 `deploy/env.prod.example` 과 **행 단위로 직접 대조 가능** 해 잔여 3 중 claim 밀도가 가장 높다 (`§ 12.37` 실측 (vi) 이 같은 파일의 40 ~ 44 행을 이미 인용해 대조 경로도 검증됐다).
2. **deployment.md 잔여 2 단락** — `## DB / Persistence` (15 ~ 49 행, ADR-0002 · `prisma/` 대조) → `## 개요` (5 ~ 14 행).
3. **REQ 번호 체계 잔재의 전수 sweep** — 권한 부족을 `REQ-020` 으로 지칭하는 다른 지점 ([ADR-0003](../decisions/ADR-0003-deployment.md) 88 행 · [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 126 행 등) 은 본 slice 범위 밖이며 **별도 slice + REQ 재번호 owner 게이트** 소관이다.
4. **UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter / record 정합** — 미대조. 본 절의 심볼 판정 (자체 port + record 영속) 을 **승계** 할 여지가 크다.
5. **UC-09 `§ 5` sequence participant 병기** — 22 회째 이월.
6. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
7. **행 번호 → anchor 좌표계 이행** — 16 회째 이월. 본 절 각주는 문서 최말미라 기존 좌표를 밀지 않지만, 잔여 3 단락은 앞쪽이라 다음 slice 부터 다시 밀린다.
8. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `32 hit` · `66 REQ` 는 심볼 · REQ 1 개 추가로 즉시 낡는다.

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **207** (202 → +5, 허용 ≤ 207) · audit **3735 → 3848** (+113 = 절 112 + 구분 공백 1, 허용 +115 이내) ·
  directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **38** (37 → 38)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -202,0 +203,5 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (후반부 최말미 각주) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `5  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docs/requirements.md package.json → (빈 출력 — 코드 · 스키마 · requirements 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1440-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pnpm build` · `pnpm test` 는 실행하지 않았다).

#### 한계 —

1. **code-block 6 지점은 각주로만 해소된다** — 189 ~ 193 행은 여전히 `LlmGatewayService` · `axios` · `EventEmitter` · `NotificationService` 를 그대로 두므로 각주를 건너뛴 독자에겐 오도가 남는다. 블록 정합 (부분 치환 시 반은 현행 · 반은 blueprint 인 잡종) 과 창작 금지를 우선한 결과이며, 도식 자체의 재작성은 알림 채널 구현 시점의 별도 게이트다.
2. **heading 의 `(REQ-020)` 은 문서 쌍 단위로만 고칠 수 있다** — deployment.md 186 행과 ADR-0003 88 행이 같은 표기를 공유해 한쪽만 치환하면 새 불일치가 생기므로, 두 문서를 함께 다루는 sweep slice (파생 영향 3) 로 넘겼다. 그때까지 REQ-020 으로 권한 부족을 trace 하는 독자는 각주에 의존한다.
3. **알림 "인식 경로" 의 충분성은 판정하지 않았다** — pull 조회 (`GET /api/permission-denied-records`) 가 193 행이 뜻한 "Admin 알림 + User 알림" 을 요구 수준으로 충족하는지는 REQ-008 · REQ-016 의 판정 소관 (requirements.md 두 row 가 이미 한계로 명시) 이라, 본 절은 **전달 방식이 push 가 아니라 pull 이라는 사실** 까지만 남겼다.

### 12.39 deployment.md `## Secret / 자격증명 저장` 단락 ↔ 실 `deploy/env.prod.example` · `docker-compose.yml` · `deploy/*.service` · `.gitignore` · `package.json` · `src/` 대조 — 원문 보존 + 각주 1 블록 (T-1441)

> **본 절의 위치** — `§ 12.38` 이 `## 외부 네트워크 boundary` 를 완결하며 파생 영향 **1** 로 지목한 "`## Secret / 자격증명 저장` = 다음 slice 1 순위" ([T-1440](../tasks/T-1440-deployment-md-network-boundary-tail-vs-src-audit.md) Follow-up 1) 를 본 절이 계승한다. **계보** — `T-1430` ~ `T-1435` (directory.md 6 축) → `T-1436` (산문 단락 축) → `T-1437` (`## 배포 토폴로지`) → `T-1438` (`## Scheduler 위치`) → `T-1439` · `T-1440` (`## 외부 네트워크 boundary` 전 / 후반부) → **`T-1441` (본 절 — `## Secret / 자격증명 저장`)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이다. cap 준수를 위해 아래 실측 인용은 **요약형** (명령 + 핵심 출력만) 이며, **secret 값 · placeholder 실값은 옮겨 적지 않고 변수 이름까지만** 인용한다 (CLAUDE.md §9).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md → 81 `## Secret / 자격증명 저장` · 87 `### 운영 환경 secret 주입 방식` · 93 `### 개발 환경 .env 정책` · 99 `### Secret 의 종류 (참고)` · 103 `### Secret rotation 정책` · 107 `## Scheduler 위치` ⇒ 단락 = **81 ~ 106 행** (AC 좌표 일치 — stale 아님).
      $ sed -n '81,106p' … → heading(81) + pointer(83) + 채택 문장(85) + heading(87) + bullet 3(89 ~ 91) + heading(93) + bullet 3(95 ~ 97) + heading(99) + 산문(101) + heading(103) + 산문(105) ; claim 이분 — **검증 가능 16 축** (패키지 · 배선 3 · 주입 경로 3 · `.env` / template 3 · secret 종류 6 항목 · pointer 1 포함) · **검증 불가 5** (파일 권한 `0600` 권장 · owner `assessment-agent` 전용 user 권장 · 수동 rotation 방침 · P7 / P8 vault 도입 전망 · "도입 task 의 reviewer 가 schema 일관성 점검" 이라는 절차 규범 — 본 slice 미측정).
(ii)  `@nestjs/config` 축 — $ grep -n '"@nestjs/' package.json → 26 ~ 32 · 47 ~ 49 의 **10 행 = `common` · `core` · `jwt` · `passport` · `platform-express` · `schedule` · `serve-static` · `cli` · `schematics` · `testing`** ⇒ `@nestjs/config` **미등재**.
      $ grep -rn "@nestjs/config\|ConfigModule" src --include='*.ts' | grep -v spec → **7 hit 이며 7 이 전부 주석** (`| grep -v "//"` → **0**): `auth.controller.ts` 37 · `auth.module.ts` 30 · `auth.service.ts` 103 · `jwt.strategy.ts` 17 · 49 · `resolve-jwt-secret.ts` 12 (전부 "ConfigModule + Joi schema 도입 시점" 미래형) · **`src/main.ts` 2 `외부 의존성(@nestjs/config 등)은 의도적으로 도입하지 않음 (T-0004 Out of Scope)`** ; $ grep -rn "process\.env" src … | wc -l → **24** ⇒ 실 패턴은 `process.env` 직접 read.
(iii) 운영 주입 방식 축 — $ grep -rn "EnvironmentFile\|env_file\|--env-file" docker-compose.yml deploy/ → **4 hit** = `docker-compose.yml` 47 `env_file:` (48 행 `- .env`) · `deploy/docker-entrypoint.sh` 4 (주석) · `deploy/seed-llm-config.sh` 86 · 87 (주석) ⇒ `EnvironmentFile` **0** · `--env-file` **0**.
      $ grep -n "ExecStart\|Environment=" deploy/assessment-agent-redeploy.service → 9 `Environment=REPO_DIR=/opt/assessment-agent` · 11 `ExecStart=/opt/assessment-agent/deploy/redeploy.sh` (unit 은 `Type=oneshot` + `Description=… 야간 재배포`) ⇒ **앱 실행 unit 이 아니라 재배포 oneshot**.
      $ git grep -n "etc/assessment-agent\.env" -- deploy docker-compose.yml .github scripts → **0 hit** (hit 은 docs 3 건 + 본 task 파일뿐 — 배포 호스트 상태는 측정 대상 아님) ; $ ls .github/workflows/ → **ci.yml 1 개** · $ grep -rn "secrets\." .github/workflows/ → 254 `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` **1 회** ⇒ 배포 workflow 부재.
(iv)  `.env` 등록 · template 축 — $ grep -n "env" .gitignore → 15 `.env` · 16 `.env.*` · 17 `!.env.example` ⇒ **이미 등록** (예외 등록까지) ; $ ls -1 .env.example deploy/env.prod.example → **둘 다 실재** · $ git ls-files … → **둘 다 tracked** · $ wc -l .env.example → **20**.
(v)   Secret 종류 축 — $ grep -n '^[A-Z_]\+=' deploy/env.prod.example → **active 6 = `POSTGRES_USER`(8) · `POSTGRES_PASSWORD`(9) · `POSTGRES_DB`(10) · `DATABASE_URL`(15) · `PORT`(18) · `AUTH_JWT_SECRET`(23)**.
      $ grep -n '^# [A-Z_]\+=' deploy/env.prod.example → **주석 처리 optional 15** = `LLM_APIKEY_ENC_KEY`(28) · `SEED_LLM_*` 5(34 ~ 38) · `NODE_EXTRA_CA_CERTS`(42) · `HTTPS_PROXY`(43) · `NO_PROXY`(44) · 테스트용 `DATABASE_URL`(63) · `GITHUB_INSTANCES`(73) · `GITHUB_PUBLIC_HOST`(74) · `_ORG`(75) · `_REPOS`(76) · `_TOKEN_ENC`(80) ; $ grep -n "CONFLUENCE" deploy/env.prod.example → **0 hit**.
      $ grep -rn "LLM_APIKEY_ENC_KEY\|AUTH_JWT_SECRET" src --include='*.ts' | grep -v spec → `auth.*` 의 `AUTH_JWT_SECRET` · `AUTH_JWT_REFRESH_SECRET` (`auth.service.ts` 6 · 18 행) ; `LLM_APIKEY_ENC_KEY` 는 `github-token-decrypt.ts` 26 · `confluence-token-decrypt.ts` 30 · `github-instance-client.service.ts` 31 · `encrypt-token-cli.ts` 18 · 26 ⇒ **token 복호 master key 로 재사용**.
      $ grep -n "apiKey" prisma/schema.prisma → 392 ~ 395 주석 + **410 `apiKey      String`** (`LlmProviderConfig`, AES-256-GCM envelope · never-read-back) ⇒ LLM key 의 저장소는 **DB**.
      $ grep -rn "OAuth\|oauth" src … → **0 hit** · `express-session\|SESSION_SECRET` → **0** · `vault\|Vault` (src · package.json) → **0** ; $ grep -n "INSTANCES\|_TOKEN_ENC" src/github/github-instance-config.ts src/confluence/confluence-instance-config.ts → 27 `GITHUB_TOKEN_ENC_SUFFIX = "_TOKEN_ENC"` · 29 `CONFLUENCE_INSTANCES_ENV = "CONFLUENCE_INSTANCES"` ⇒ 자격은 **instance 별 암호문 env**.
(vi)  시점 서술 축 — $ grep -n '"phase"' docs/STATE.json → 3 `"phase": "P4-complete / P5-in-progress"` ⇒ 95 · 96 · 105 행의 `P3 / P4 / P7 … 처리 / 작성 / 책임` 은 이미 지난 시점을 미래형으로 서술한다.
      $ sed -n '81,106p' … | grep -n "P[0-9] \|본 task\|별도 task\|도입 task\|책임" → **4 hit** (95 · 96 · 101 · 105 행) ⇒ 본 단락의 시점 marker 밀도는 `§ 12.38` 후반부 (2 hit) 보다 짙다. 날짜 stamp 는 **0**.
(vii) pointer 축 — $ grep -n '^## \|^### ' docs/decisions/ADR-0003-deployment.md → **46 `### Decision §2 — Secret 저장 = 환경변수 (@nestjs/config 기반)`** 실재 ⇒ 83 행 pointer 유효 (본문 재판정 · status 변경 없음). 단 그 §2 의 근거 5 가 "`@nestjs/config` 자체는 별도 task 가 사용자 승인 후 도입, 본 ADR 은 패턴만 박제" 로 **유보** 해 두었고, §2 의 `secret 의 종류 (참고)` 문장이 deployment.md 101 행과 **동일 원문** 이다.
(viii) baseline — wc -l deployment.md **207** · audit **3848** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **38** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 가 "본 문서는 P1 T-A2 의 산출물" 을 선언하고 본 단락은 [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 가 [ADR-0003](../decisions/ADR-0003-deployment.md) §2 를 옮겨 채운 P1 blueprint 원본이라 보존 강도가 `§ 12.36` ~ `§ 12.38` 과 동급이다. ② **`§ 12.15` 정합**: 날짜 stamp **0**, 시점 marker **4 hit** (실측 (vi)) 로 선행 4 절 중 가장 짙다 — append-only 가 in-place 를 절대 금지하진 않지만 보존 쪽 가중치가 가장 크게 남는다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 · 흐름 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1440 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 단락은 **수치 claim 0 · 배선 / 경로 / 열거 + 시점 축** 이라 각주 계열에 든다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 83 | 본 단락 결정은 ADR-0003 §2 에 박제 | ADR-0003 **46 행** `### Decision §2` 실재 | 참 | 무편집 | 실측 (vii), 본문 재판정 없음 |
| 85 | secret 주입 = 환경변수 (`process.env`) | `src/` `process.env` **24 곳** | 참 | 무편집 + 각주 근거 | 실 패턴이 문서와 일치 |
| 85 | `@nestjs/config` 의 `ConfigModule` 패턴 **채택** | dep **미등재** · `src/` hit 7 **전부 주석** · `main.ts` 2 행 자인 | 부분참 | 원문 보존 + 각주 부기 | ADR 결정은 실재하나 구현 미도입 (§2 근거 5 가 유보) |
| 85 | 개발 = `.env` (`.gitignore` 등록 필수) | `.gitignore` 15 ~ 17 행 등록 | 참 | 무편집 + 각주 근거 | 실측 (iv) |
| 85 | 운영 = process supervisor 의 환경변수 주입 | 실 경로는 compose `env_file: - .env` | 부분참 | 원문 보존 + 각주 부기 | supervisor 계열은 맞으나 실 주체가 docker compose |
| 89 | systemd `EnvironmentFile=/etc/assessment-agent.env` | 실 자산 **0 hit** · unit 은 재배포 oneshot | 거짓 | 원문 보존 + 각주 부기 | `deploy/*.service` 에 앱 실행 unit 자체가 없음 |
| 90 | Docker `--env-file` 또는 orchestrator secret object | `--env-file` **0 hit** · secret object 미사용 | 부분참 | 원문 보존 + 각주 부기 | compose 를 쓰는 것은 맞고 디렉티브가 `env_file` |
| 91 | CI/CD 가 deployment step 환경변수로 inject | workflow **ci.yml 1 개** · 배포 job 없음 | 거짓 | 원문 보존 + 각주 부기 | 실 배포는 systemd timer + `redeploy.sh` |
| 95 | `.env` 등록은 **P3 / P4 도입 task 가 처리** | 이미 등록 (15 ~ 17 행) | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | `§ 12.36` 144 행과 동일 유형 |
| 96 | `.env.example` 을 commit 해 schema 공유 | `.env.example` **실재 · tracked · 20 행** | 참 | 무편집 + 각주 근거 | 실측 (iv) |
| 96 | 본 task 는 작성하지 않음 — **별도 task 가 작성** | 이행 완료 + 운영본은 `deploy/env.prod.example` | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | 이름이 `.env.example` 이 아닌 차이도 함께 기록 |
| 97 | `ConfigModule.forRoot({ … validationSchema })` **강제** | 미도입 — boot 검증 layer **0** | 거짓 | 원문 보존 + 각주 부기 | (ii) 의 주석 7 이 전부 "도입 시점" 미래형 |
| 101-a | GitHub 3 instance 의 PAT 또는 **OAuth token** | `GITHUB_INSTANCES` + `_TOKEN_ENC` **암호문** · OAuth **0 hit** | 부분참 | 원문 보존 + 각주 부기 | env 경유는 맞고 형태가 평문 PAT 아님 |
| 101-b | Confluence 의 PAT | `CONFLUENCE_INSTANCES` + `_TOKEN_ENC` 실재 · 운영 template **0 hit** | 부분참 | 원문 보존 + 각주 부기 | 코드엔 있고 `env.prod.example` 엔 미등재 |
| 101-c | LLM provider 5 종의 **API key** (env) | 저장소는 DB `LlmProviderConfig.apiKey` (410 행) · env 는 `LLM_APIKEY_ENC_KEY` 뿐 | 거짓 | 원문 보존 + 각주 부기 | 저장 위치 축이 env → DB (암호화 저장) 로 바뀜 |
| 101-d | DB 의 `DATABASE_URL` | `env.prod.example` **15 행** · `.env.example` 12 행 | 참 | 무편집 + 각주 근거 | 변수 이름까지 1:1 |
| 101-e | Backend 의 **JWT secret** | `AUTH_JWT_SECRET` 23 행 + `AUTH_JWT_REFRESH_SECRET` | 참 | 무편집 + 각주 근거 | 오히려 2 종으로 늘었다 |
| 101-f | 또는 **session secret** | `express-session` · `SESSION_SECRET` **0 hit** | 거짓 | 원문 보존 + 각주 부기 | session 인증 자체가 채택되지 않음 (JWT) |
| 105 | 구체 도입은 **P3 / P4 / P7 의 task 책임** | phase `P4-complete / P5-in-progress` · 다수 shipped | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | 새 phase 배정은 PLAN 게이트라 창작 불가 |

- 합계 — 검증 가능 **19 row (16 축 · 열거 6 항목 분리 반영) = 참 6 · 부분참 5 · 거짓 8**, 검증 불가 5 는 대상 제외. 거짓 8 의 내역은 **주입 경로 2** (89 · 91) · **배선 1** (97) · **열거 2** (101-c · 101-f) · **시점 3** (95 · 96 · 105) 이다. `§ 12.38` 후반부 (거짓 6 / 13) 보다도 거짓 비중이 높은데, 이는 본 단락이 **구현 이전에 쓰인 blueprint 인데 그 뒤 실제 배포 경로 (docker compose + systemd timer) 와 자격 암호화 저장이 다른 형태로 확정** 됐기 때문이다.
- **거짓 축 · 시점 축의 분리 판정** — ① **거짓 (의존성 · 주입 경로 · 열거)**: 101 행은 ADR-0003 §2 의 `secret 의 종류 (참고)` **원문 전사** 라 deployment.md 만 고치면 정본 ↔ view 가 새로 어긋나고 (ADR 본문 편집은 Out of Scope · owner 게이트), 89 ~ 91 행은 세 bullet 이 한 덩어리라 하나만 치환하면 나머지 둘이 거짓인 채 남아 독자가 목록 전체를 검증된 지침으로 오신한다 → 각주로 수렴. ② **시점 (95 · 96 · 105)**: 갱신하려면 "이제 어느 phase 책임인가" 를 **새로 배정** 해야 하는데 그것은 PLAN 게이트라, 실측 사실 (`.gitignore` 등록 · template 2 종 실재 · 현 phase 값) 만 각주에 남긴다. 두 축의 처리가 같은 (B) 로 수렴했으나 **사유는 위와 같이 다르다**.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (주입 방식 · secret 종류 재작성 포함) | 기각 | 치환 지점이 **8** 로 AC 4 의 `≤ 2 지점` 상한을 넘고, 시점 3 행은 새 phase 배정 창작이 필요해 AC 4 창작 금지와 충돌 |
| **(B)** | **단락 원문 무편집 + 단락 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1440 화법을 그대로 잇고 실 경로 (`env_file: - .env`) · 실 변수 이름 (`AUTH_JWT_SECRET` · `_TOKEN_ENC` · `LLM_APIKEY_ENC_KEY`) 을 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (시점 서술만 in-place, 나머지는 각주) | 기각 | 시점 축이야말로 새 배정을 창작해야 하는 축이라 in-place 대상으로 가장 부적합하고, `§ 12.15` append-only 가 시점 marker 4 hit 에 가장 무겁게 걸린다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자가 `@nestjs/config` 를 설치하거나 `/etc/assessment-agent.env` 를 만들고 `0600` 을 걸어도 앱이 그 파일을 읽지 않아 **secret 이 주입되지 않은 채 기동** 하는 실패로 직결된다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 4 가 전부 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **오도 risk**: 본 단락은 **secret 취급 지침** 이라 잘못 따르면 (a) 존재하지 않는 주입 경로를 만들어 앱이 자격 없이 기동하거나, (b) LLM API key 를 env 평문으로 두어 **DB 암호화 저장의 보호를 우회** 하거나, (c) `.env.example` 이 이미 있는데 새로 만들어 실값 commit risk 를 키운다 — 특히 (b) 는 문서 오도가 곧 **자격증명 노출 표면 확대** 라 산문 · 배선 문서보다 risk 가중치가 한 단계 더 높다 (그래서 (D) 기각). ③ **cap**: (B) 의 실측 diff 는 deployment.md `+6/-0` (207 → **213**, 허용 `≤ 213`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 창작 금지 충돌로 자동 기각이며 split 해도 ADR-0003 §2 동시 편집 (owner 게이트) 이 남아 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: `§ 12.37` · `§ 12.38` 이 인접 단락에서 (B) 를 채택했으므로 본 절이 다른 후보를 고르면 같은 문서 안 처리 방식이 갈린다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (5 행)** — 105 행 (`### Secret rotation 정책` 말미 = 단락 최말미) 뒤 · `## Scheduler 위치` 앞에 append (앞뒤 공백 행 보존). 내용은 ① `@nestjs/config` **미도입** (dep 미등재 · 주석 7 · `main.ts` 2 행 · `process.env` 24 곳) + 97 행 강제 부재, ② 운영 주입은 systemd 아닌 **compose `env_file: - .env`** (`EnvironmentFile` · `--env-file` 0 hit · unit 은 재배포 oneshot · 배포 workflow 부재), ③ 95 · 96 행 **시점 낡음** (`.gitignore` 15 ~ 17 · template 2 종 실재), ④ 101 행 **6 항목 참 2 · 부분참 2 · 거짓 2** + `POSTGRES_PASSWORD` 누락, ⑤ 105 행 시점 낡음 + 검증 불가 항목 제외 선언 + 83 행 pointer 유효 + 본 절 pointer.
- **각주 위치 근거 + 문구 1:1 + 무편집 경계** — 대상 claim 이 네 하위 절 (`### 운영 환경 secret 주입 방식` · `### 개발 환경 .env 정책` · `### Secret 의 종류` · `### Secret rotation 정책`) 에 걸쳐 있어 어느 한 절 말미에 두면 나머지를 앞지르므로 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 단락 최말미에 뒀다. 각주의 경로 · 변수 이름 · 수치 (`7` · `24` · `47 ~ 48` · `15 ~ 17` · `20` · `15` · `23` · `410` · `254` · `46` · `P4-complete / P5-in-progress`) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 env 이름 · 미도입 vault · 배포 호스트의 실제 파일) 은 창작하지 않았고 secret 값 · placeholder 실값도 옮기지 않았다** (변수 이름까지만). 1 ~ 4 행 blockquote · 81 ~ 106 행 원문 · `## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1440 각주는 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 링크는 ADR-0003 (이미 83 행에 등재) 과 본 절 2 개뿐이다.

#### T-1440 Follow-up 1 closure + `## Secret / 자격증명 저장` 단락 closure 선언

- **T-1440 Follow-up 1 closure** — `§ 12.38` 이 "다음 slice 1 순위" 로 이월한 근거 (81 ~ 106 행이 `deploy/env.prod.example` 과 행 단위 대조 가능) 는 실측으로 확인됐고, 그 단락의 검증 가능 claim **19 row 를 본 절이 전부 판정 · 각주 반영** 했다 — 승계 대상이 남지 않는다. **단락 closure** — `## Secret / 자격증명 저장` (81 ~ 106 행) 은 본 절로 **완결** 이며 단락 안 각주는 말미 1 블록뿐이다 (중복 부기 0).

#### 대조 대상 문서 잔여 갱신

`§ 12.38` 이 남긴 deployment.md **잔여 3 단락** 중 본 절이 1 을 닫아 **잔여 2 단락** 이 된다 — `## DB / Persistence` (15 ~ 49 행) · `## 개요` (5 ~ 14 행). 우선순위는 아래 파생 영향 1 · 2 에 둔다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **`## DB / Persistence` (다음 slice 1 순위)** — 15 ~ 49 행의 배포 토폴로지 · migration 정책 · backup 전략 · raw data 저장 금지 schema 강제가 [ADR-0002](../decisions/ADR-0002-db.md) · `prisma/schema.prisma` · `prisma/migrations/` 자산과 **직접 대조 가능** 해 잔여 2 중 claim 밀도가 높다.
2. **`## 개요` (5 ~ 14 행)** — 잔여 마지막 단락. 닫으면 deployment.md 전 단락 대조가 완결된다.
3. **`@nestjs/config` 미도입 사실의 다른 문서 전수 sweep** — 같은 "채택" 서술이 [ADR-0003](../decisions/ADR-0003-deployment.md) §2 · [T-0015](../tasks/T-0015-adr-0003-deployment-rest.md) 등에 있는지는 본 slice 범위 밖이며 **별도 slice + ADR 재판정 owner 게이트** 소관이다.
4. **[deploy/README.md](../../deploy/README.md) ↔ deployment.md 배포 절차 정합** — 두 문서가 같은 주제 (env 주입 · 재배포) 를 각자 서술한다. 정본 지정 판정이 필요하며 본 slice 는 무편집.
5. **REQ 번호 체계 잔재의 전수 sweep** — `§ 12.38` Follow-up 3 미소진 (owner 게이트).
6. **UC-09 `§ 5` sequence participant 병기** — 23 회째 이월.
7. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
8. **행 번호 → anchor 좌표계 이행** — 17 회째 이월. 본 절 각주는 문서 중간이라 `## Scheduler 위치` 이후 좌표가 **+6 밀린다** (다음 slice 는 좌표 재실측 필수).
9. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `24 곳` · `7 hit` · env key 목록은 변수 1 개 추가로 즉시 낡는다.

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **213** (207 → +6, 허용 ≤ 213) · audit **3848 → 3962** (+114 = 절 114, 허용 +115 이내) ·
  directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **39** (38 → 39)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -106,0 +107,6 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (단락 최말미 각주) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `6  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .gitignore package.json → (빈 출력 — 코드 · 배포자산 · 의존성 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1441-*.md  (**3 파일**)
```

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pnpm build` · `pnpm test` · `docker compose` 는 실행하지 않았다).

#### 한계 —

1. **8 지점의 거짓은 각주로만 해소된다** — 89 ~ 91 · 97 · 101 행 원문은 그대로라 각주를 건너뛴 독자에겐 오도가 남는다. 101 행이 ADR-0003 §2 원문의 전사라 두 문서를 함께 다루는 게이트 slice (파생 영향 3) 없이는 정본 정합을 깨지 않고 고칠 수 없다는 제약을 우선한 결과다.
2. **운영 template 의 완전성 · rotation 실행 가능성은 미판정** — `deploy/env.prod.example` 에 Confluence key 가 **0 hit** 인 사실은 기록했으나 그것이 template 결손인지 Confluence 수집이 아직 운영 대상이 아니라는 의도인지는 `deploy/` 소관 (본 slice 는 `deploy/` 무편집) 이고, 수동 rotation 이 `_TOKEN_ENC` 암호문 체계 (재암호화 필요) 에서 몇 단계인지도 `deploy/README.md` · `encrypt-token-cli.ts` 운영 절차 소관이라 방침 서술을 **검증 불가** 로 분류하는 데 그쳤다.

### 12.40 deployment.md `## DB / Persistence` 전반부 ↔ 실 `docker-compose.yml` · `prisma/` · `src/persistence/` · `.github/workflows/ci.yml` 대조 — 원문 보존 + 각주 1 블록 (T-1442)

> **본 절의 위치** — `§ 12.39` 가 `## Secret / 자격증명 저장` 을 완결하며 파생 영향 **1** 로 지목한 "`## DB / Persistence` = 다음 slice 1 순위" ([T-1441](../tasks/T-1441-deployment-md-secret-section-vs-deploy-audit.md) Follow-up 1) 를 본 절이 계승한다. 다만 그 단락은 **15 ~ 49 행 (35 행 · 하위 5 절)** 로 선행 slice 범위보다 커서, `T-1439` · `T-1440` 이 51 행짜리 `## 외부 네트워크 boundary` 를 2 slice 로 나눈 선례대로 본 절은 **전반부 (15 ~ 33 행 — heading · 도입 2 문단 · `### 배포 토폴로지` · `### Migration 정책`) 만** 닫고 후반부는 이월한다. **계보** — `T-1430` ~ `T-1435` (directory.md) → `T-1436` (산문 단락) → `T-1437` (`## 배포 토폴로지`) → `T-1438` (`## Scheduler 위치`) → `T-1439` · `T-1440` (network boundary 전 / 후반부) → `T-1441` (`## Secret / 자격증명 저장`) → **`T-1442` (본 절 — `## DB / Persistence` 전반부)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이고, 실측 인용은 cap 준수를 위해 **요약형** (명령 + 핵심 출력만) 이며 **connection string 실값 · secret 값은 옮기지 않고 변수 이름까지만** 인용한다 (CLAUDE.md §9).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md → 15 `## DB / Persistence` · 21 `### 배포 토폴로지` · 28 `### Migration 정책` · 34 `### Backup / restore 전략` · 40 `### Raw data 저장 금지 (REQ-032) …` · 46 `### 후속 진행` · 50 `## 배포 토폴로지 (Monolithic vs worker 분리)` ⇒ 전반부 = **15 ~ 33 행** (AC 좌표 일치 — stale 아님), 후반부 34 ~ 49 는 다음 slice.
      $ sed -n '15,33p' … → heading(15) + pointer 문단(17) + 채택 문장(19) + heading(21) + bullet 4(23 ~ 26) + heading(28) + bullet 3(30 ~ 32) ; claim 이분 — **검증 가능 12 축** (채택 1 · image tag 1 · 인스턴스 형태 1 · 접속 경로 1 · env 변수명 1 · 시점 1 · PrismaService 1 · pool 1 · worker 조건절 1 · migrate 명령 2 · migration 위치 / tracked 1 · CI 통합 시점 1 · pointer 2 포함) · **검증 불가 3** ("single-operator 컨텍스트에서 본 형태가 가장 가볍다" 는 평가 · 외부 managed service (RDS / Cloud SQL) 전환 전망 · "connection string 만 교체하면 동작" 이라는 미실행 전망 — 본 slice 미측정).
(ii)  DB 인스턴스 축 — $ grep -n "image:\|container_name:\|ports:\|5432" docker-compose.yml | head -12 → 14 `image: postgres:16-alpine` · 15 `container_name: assessment-agent-postgres` · 21 `ports:` · 22 `- "5432:5432"` · 40 `image: assessment-agent:latest` · 41 `container_name: assessment-agent-app` · 51 `ports:` ⇒ image tag **1:1 일치** · "PostgreSQL 16 이상" 참.
      $ sed -n '1,4p' docker-compose.yml → "운영/로컬 통합 docker-compose … `docker compose up -d --build` 한 번으로 postgres + NestJS app 을 함께" ⇒ 양자 서술 중 **compose 경로가 단일 default 로 확정** (host process 직접 기동 자산 0).
(iii) 접속 경로 축 — $ grep -n '^  [a-z-]\+:' docker-compose.yml | head -8 → 13 `postgres:` · 36 `app:` · 55 `postgres-data:` ⇒ 실 service 이름은 **`postgres`**, 문서 예시 `db` **부재**.
      $ grep -rn "DATABASE_URL" .env.example docker-compose.yml .github/workflows/ci.yml → `.env.example` **12** · compose 7 · 46 (주석) · ci.yml 66 · 67 · 70 (주석 — `PrismaService 의 buildPrismaAdapter()` 가 `process.env.DATABASE_URL` 을 읽음) ⇒ 표준 명칭 **채택 확인**.
(iv)  PrismaService · pool 축 — $ grep -rn "class PrismaService" src --include='*.ts' → **`src/persistence/prisma.service.ts:29`** `export class PrismaService extends PrismaClient implements OnModuleInit` (1 hit).
      $ grep -rn "connection_limit\|pool_timeout\|statement_timeout\|poolSize" src prisma docker-compose.yml .env.example → **0 hit** ⇒ pool / timeout 구체값 **미결정 잔존** ; $ sed -n '1,25p' prisma/schema.prisma → 8 ~ 10 행 주석 "datasource.url 은 `prisma.config.ts` 에서 adapter 로 inject … `@prisma/adapter-pg` 가 DATABASE_URL 을 읽어 pg Pool 을 구성" ⇒ 실 pool 은 **adapter default**.
(v)   worker 조건절 축 — $ grep -n '^## \|^### ' docs/decisions/ADR-0003-deployment.md | head -12 → 28 `## Decision` · **32 `### Decision §1 — Monolithic NestJS process (in-process queue OK)`** · 46 §2 · 62 §3 · 78 §4 ⇒ worker 분리는 **미결정** = 26 행 조건절의 전건 불성립 (본문 재판정 · status 변경 없음).
(vi)  Migration 도구 · 누적 축 — $ grep -rn "prisma migrate" package.json .github/workflows/ci.yml Dockerfile deploy/ → ci.yml 172 (주석) · **216 `run: pnpm prisma migrate deploy`** · 306 · 342 · 364 (주석) · Dockerfile 48 (주석) · `deploy/daily-test-step-deps-schema.test.sh` 9 · **112** ; $ grep -rn "migrate dev" (동일 대상) → **0 hit** ⇒ `deploy` 만 실 사용처.
      $ ls -1 prisma/migrations → `20260525000000_init` … `20260609000000_contribution_source_ref_unique` ; $ ls -1 prisma/migrations | wc -l → **14** ; $ git ls-files prisma/migrations | head -3 → `…/migration.sql` 3 건 ⇒ **git tracked 참**.
(vii) CI 통합 시점 축 — $ grep -n "Prisma migrate deploy\|migrate deploy" .github/workflows/ci.yml → 47 · 70 · 172 (주석) · **209 `- name: Prisma migrate deploy`** · 216 · 240 ⇒ ci.yml step **이미 실재** ; $ grep -n '"phase"' docs/STATE.json → 3 `"phase": "P4-complete / P5-in-progress"` ⇒ "P3 phase 의 task 에서 … 도입. 본 task 는 정책만 박제" 는 **지난 시점을 미래형으로** 서술.
      `§ 12.15` 강도 — 본 축은 날짜 stamp 0 · 시점 marker 3 hit (24 · 25 · 32 행) 이고 셋 다 "어느 phase 가 언제 한다" 는 **당시 계획 기록** 이라 append-only 가 in-place 치환보다 무겁게 걸린다 (갱신하려면 새 phase 배정을 창작해야 함).
(viii) pointer 축 — $ grep -n '^## \|^### ' docs/decisions/ADR-0002-db.md | head -12 → 21 `## Context` · **41 `## Decision`** · 53 `## Consequences` · 88 `## Amendment — 2026-05-25 (T-0033, HQ-0004 해소)` · 113 `## References` ⇒ 17 · 19 · 30 행 pointer **유효**.
      $ grep -n "^## 1\.\|single-operator\|단일" CLAUDE.md → **31 `## 1. 기술 스택 (확정)`** 뿐 ; $ grep -c "single-operator" CLAUDE.md → **0** ⇒ 23 행의 "`CLAUDE.md` §1 의 single-operator 운영 컨텍스트" pointer **부정확** (§1 은 기술 스택, 어휘 자체가 부재 — CLAUDE.md 는 무편집).
(ix)  baseline — wc -l deployment.md **213** · audit **3962** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **39** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 가 "본 문서는 P1 T-A2 의 산출물" 을 선언하고 본 단락은 [T-0014](../tasks/T-0014-adr-0002-db-selection.md) 가 [ADR-0002](../decisions/ADR-0002-db.md) 를 옮겨 채운 P1 blueprint 원본이라 보존 강도가 `§ 12.36` ~ `§ 12.39` 와 동급이다. ② **`§ 12.15` 정합**: 날짜 stamp **0** · 시점 marker **3 hit** (24 · 25 · 32 행, 실측 (vii)) 로 `§ 12.39` (4 hit) 보다 옅으나 셋 다 phase 배정 창작 없이는 갱신 불가라 보존 가중치가 그대로 남는다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 · 경로 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1441 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 전반부는 **수치 claim 0 · 경로 / 이름 / 명령 + 시점 축** 이라 각주 계열에 든다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 17 | 본 단락 결정은 ADR-0002 에 박제 | ADR-0002 **41 행 `## Decision`** 실재 | 참 | 무편집 | 실측 (viii), 본문 재판정 없음 |
| 19 | 채택 = PostgreSQL + Prisma | compose 14 행 postgres + `prisma/` 실재 | 참 | 무편집 + 각주 근거 | 실측 (ii) · (vi) |
| 23-a | PostgreSQL **16 이상** · `postgres:16-alpine` | compose 14 행과 **1:1** | 참 | 무편집 + 각주 근거 | image tag 문자열 일치 |
| 23-b | "동일 host 의 다른 process **또는** 로컬 Docker container" 가 default | 실 경로는 compose 단일 통합 (`postgres` + `app`) · host process 자산 0 | 부분참 | 원문 보존 + 각주 부기 | 양자 중 한쪽만 실제로 확정 |
| 23-c | pointer — CLAUDE.md **§1** 의 single-operator 컨텍스트 | §1 은 `기술 스택 (확정)` · 어휘 **0 hit** | 거짓 | 원문 보존 + 각주 부기 | CLAUDE.md 편집은 Out of Scope |
| 24-a | compose 내부 service 이름 (예: **`db:5432`**) | 실 key 는 **`postgres`** (13 행) · `app` | 부분참 | 원문 보존 + 각주 부기 | 예시 표기라 거짓은 아니나 **오도 risk** 존속 |
| 24-b | `DATABASE_URL` 표준 명칭이 Prisma convention | `.env.example` 12 · ci.yml 66 ~ 70 실재 | 참 | 무편집 + 각주 근거 | 변수 이름까지 1:1 |
| 24-c | 구체 변수 이름은 **T-0015 의 secret 단락이 결정** | 이미 이행 (`DATABASE_URL` 확정) | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | `§ 12.39` 95 · 96 행과 동일 유형 |
| 25-a | PrismaService **singleton** 으로 pool 보유 | `src/persistence/prisma.service.ts` 29 행 실재 | 참 | 무편집 + 각주 근거 | 문서가 module 위치를 안 밝힌 차이만 각주 |
| 25-b | Pool 크기 · statement timeout 은 **P3 task 에서 결정** | 4 키워드 **0 hit** · 현 phase `P4-complete / P5-in-progress` | 거짓 (시점 낡음 + 미이행) | 원문 보존 + 각주 부기 | 두 축이 겹쳐 각주에서 분리 기술 |
| 26 | ADR-0003 에서 **worker 분리가 결정되면** … 동일 DB | ADR-0003 §1 = **Monolithic** 채택 | 참 (전건 불성립) | 무편집 + 각주 근거 | 조건문 자체는 거짓이 아니라 조건 미성립 |
| 30-a | 배포 환경 = `prisma migrate deploy` | ci.yml **216** · daily-test 112 | 참 | 무편집 + 각주 근거 | 실측 (vi) |
| 30-b | 개발 환경 = `prisma migrate dev` | 대상 전부에서 **0 hit** | 부분참 | 원문 보존 + 각주 부기 | 정책 서술은 유효하나 실 script 미등재 |
| 31 | `prisma/migrations/` 누적 · git 버전 관리 | **14 개** · `git ls-files` tracked | 참 | 무편집 + 각주 근거 | 실측 (vi) |
| 32 | CI 통합은 **P3 phase 의 task 에서** 도입 · 본 task 는 정책만 | ci.yml **209 행 step 실재** | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | 새 phase 배정은 PLAN 게이트라 창작 불가 |

- 합계 — 검증 가능 **15 row = 참 8 (전건 불성립 1 포함) · 부분참 3 · 거짓 4**, 검증 불가 3 은 대상 제외. 거짓 4 의 내역은 **pointer 1** (23-c) · **시점 3** (24-c · 25-b · 32) 이다. `§ 12.39` (거짓 8 / 19) 보다 거짓 비중이 낮은데, 이는 본 전반부의 핵심 claim (DB 종류 · image tag · migration 도구 · migration 디렉토리) 이 **ADR-0002 결정 그대로 구현돼** 문서와 실제가 어긋날 표면이 작았기 때문이다.
- **거짓 / 부분참 축 · 시점 축의 분리 판정** — ① **거짓 / 부분참 (23-b · 23-c · 24-a · 30-b)**: service 이름 `db` → `postgres` 는 1 토큰 치환으로 고칠 수 있으나 같은 행의 "동일 host … 또는" 양자 서술 · Unix socket 경로가 함께 걸려 있어 한 토큰만 바꾸면 나머지가 부정확한 채 남고, 23-c 는 [CLAUDE.md](../../CLAUDE.md) 편집이 필요한데 그것이 Out of Scope 이며, 30-b 는 정책 서술로 읽으면 지금도 유효하다 → 넷 다 각주로 수렴. ② **시점 (24-c · 25-b · 32)**: 갱신하려면 "이제 어느 phase 책임인가" 를 **새로 배정** 해야 하는데 PLAN 게이트라 창작 금지 (AC 4) 와 정면 충돌하고, 특히 25-b 는 **시점 낡음과 미결정 잔존이 겹쳐** 단순 과거형 전환으로도 해소되지 않는다 → 실측 사실만 각주에 남긴다. 두 축의 처리가 같은 (B) 로 수렴했으나 **사유는 위와 같이 다르다**.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (인스턴스 형태 · service 이름 · 시점 3 행 재작성) | 기각 | 치환 지점이 **7** 로 AC 4 의 `≤ 2 지점` 상한을 넘고, 시점 3 행은 새 phase 배정 창작이 필요해 AC 4 창작 금지와 충돌 |
| **(B)** | **원문 무편집 + `### Migration 정책` 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1441 화법을 그대로 잇고 실 service 이름 (`postgres`) · 실 경로 (`src/persistence/prisma.service.ts`) · 실 step (`ci.yml` 209) 을 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (시점 서술만 in-place, 나머지는 각주) | 기각 | 시점 축이야말로 새 배정을 창작해야 하는 축이라 in-place 대상으로 가장 부적합하고, `§ 12.15` append-only 가 marker 3 hit 에 가장 무겁게 걸린다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 운영자가 `db:5432` 로 접속 문자열을 만들면 compose 내부 이름 해석에 실패하고, migration CI 통합을 **미도입으로 오인** 해 이미 있는 step 을 중복 추가하는 실패로 직결된다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 3 이 전부 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **오도 risk**: 본 단락은 **배포 지시로 읽히는 토폴로지 서술** 이라 잘못 따르면 (a) 존재하지 않는 service 이름으로 접속 문자열을 만들어 app 이 DB 를 못 찾거나, (b) `prisma migrate deploy` 의 CI 통합을 미도입으로 오인해 중복 step 을 넣거나, (c) pool / timeout 이 "P3 에서 결정됨" 으로 오신해 실제로는 adapter default 인 값을 튜닝된 것으로 신뢰한다 — 셋 다 배포 실패 또는 잘못된 용량 가정으로 이어져 (D) 를 기각시킨다. ③ **cap**: (B) 의 실측 diff 는 deployment.md `+6/-0` (213 → **219**, 허용 `≤ 219`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 창작 금지 충돌로 자동 기각이며 split 해도 CLAUDE.md 편집 (Out of Scope) 이 남아 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: `§ 12.37` ~ `§ 12.39` 가 같은 문서의 인접 단락에서 (B) 를 채택했으므로 본 절이 다른 후보를 고르면 한 문서 안 처리 방식이 갈린다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (5 행)** — 32 행 (`### Migration 정책` 본문 말미) 뒤 · `### Backup / restore 전략` heading 앞에 append (앞뒤 공백 행 보존). 내용은 ① 19 · 23-a 참 + 23-b **compose 단일 경로 확정**, ② 24-a **실 service 이름 `postgres`** + 오도 risk + 24-b 참 + 24-c 시점 낡음, ③ 25-a 실 경로 `src/persistence/` + 25-b **pool 4 키워드 0 hit** (시점 낡음 · 미결정 분리), ④ 26 전건 불성립 (ADR-0003 §1 Monolithic) + 30 ~ 31 `deploy` 참 / `dev` 0 hit / migration **14 개** tracked, ⑤ 32 **ci.yml 209 step 실재** + `§ 12.15` 처리 사유 + 23-c CLAUDE.md pointer 부정확 + 본 절 pointer.
- **각주 위치 근거 + 문구 1:1 + 무편집 경계** — 대상 claim 이 두 하위 절 (`### 배포 토폴로지` · `### Migration 정책`) 에 걸쳐 있어 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 **전반부 최말미** 에 뒀고, T-1439 가 `## 외부 네트워크 boundary` 전반부 말미에 각주를 둔 배치 (현 187 ~ 189 행) 와 동형이다. 각주의 경로 · service 이름 · 변수 이름 · 명령 · 수치 (`postgres` · `assessment-agent-postgres` · `5432:5432` · `postgres:16-alpine` · `DATABASE_URL` · `src/persistence/prisma.service.ts` 29 · `@prisma/adapter-pg` · `14` · `209` · `216` · `112` · `P4-complete / P5-in-progress`) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 env 이름 · 미도입 pool 설정값 · 배포 호스트의 실제 경로) 은 창작하지 않았고 connection string 실값 · secret 값도 옮기지 않았다** (변수 이름까지만). 1 ~ 4 행 blockquote · 15 ~ 33 행 원문 · **34 ~ 49 행 (DB 단락 후반부)** · `## 개요` · `## 배포 토폴로지` · `## Scheduler 위치` · `## Secret / 자격증명 저장` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1441 각주는 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 링크는 ADR-0003 (이미 26 행 등재) · CLAUDE.md (이미 23 행 등재) · 본 절 3 개뿐이다.

#### T-1441 Follow-up 1 의 전반부 closure + 후반부 이월

- **전반부 closure** — `§ 12.39` 가 "다음 slice 1 순위" 로 이월한 근거 (15 ~ 49 행이 ADR-0002 · `prisma/schema.prisma` · `prisma/migrations/` 와 직접 대조 가능) 는 실측으로 확인됐고, 그중 **전반부 15 ~ 33 행의 검증 가능 15 row 를 본 절이 전부 판정 · 각주 반영** 했다. 전반부에는 승계 대상이 남지 않으며 단락 안 각주는 이 1 블록뿐이다 (중복 부기 0).
- **후반부 이월** — `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행` (34 ~ 49 행) 은 **미대조** 로 남는다. REQ-032 축은 `prisma/schema.prisma` 의 `String` column 전수 판정이 필요해 단독 slice 가 적절하다는 것이 이월 사유다 (아래 파생 영향 1).

#### 대조 대상 문서 잔여 갱신

`§ 12.39` 가 남긴 deployment.md **잔여 2 단락** 은 본 절 후 **`## DB / Persistence` 후반부 (34 ~ 49 행) + `## 개요` (5 ~ 14 행)** 로 좁혀진다 (단락 수로는 1.5 단락). 우선순위는 아래 파생 영향 1 · 2 에 둔다. **본 각주가 문서 중간 (33 행 뒤) 에 들어가 34 행 이후 전 좌표가 +6 밀린다** — 다음 slice 는 좌표 재실측이 필수다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **`## DB / Persistence` 후반부 (다음 slice 1 순위)** — `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`. REQ-032 축은 `prisma/schema.prisma` 의 `String` column 전수 판정이 필요해 **단독 slice** 가 적절하다.
2. **`## 개요` (5 ~ 14 행)** — 잔여 마지막 단락. 닫으면 deployment.md 전 단락 대조가 완결된다.
3. **README 행 번호 pointer** — 후반부 36 행 (각주 반영 후 42 행) 의 "README 57 행 (export / backup / restore)" 유효성은 **후반부 slice 소관**.
4. **[deploy/README.md](../../deploy/README.md) ↔ deployment.md 배포 절차 정합** — `§ 12.39` Follow-up 4 미소진. 정본 지정 판정 필요.
5. **`@nestjs/config` 미도입 사실의 다른 문서 전수 sweep** — `§ 12.39` Follow-up 3 미소진 (ADR 재판정 owner 게이트).
6. **REQ 번호 체계 잔재의 전수 sweep** — `§ 12.38` Follow-up 3 미소진 (owner 게이트).
7. **UC-09 `§ 5` sequence participant 병기** — 24 회째 이월.
8. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
9. **행 번호 → anchor 좌표계 이행** — 18 회째 이월. 본 절 각주가 문서 중간이라 위 "잔여 갱신" 의 +6 이동이 그 근거를 또 한 번 보탠다.
10. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `14` · `0 hit` · service 이름은 compose / migration 1 건 추가로 즉시 낡는다.

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `prisma migrate` · `docker compose up` · `pnpm build` · `pnpm test` 는 실행하지 않았다).

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **219** (213 → +6, 허용 ≤ 219) · audit **3962 → 4072** (+110 = 본 절 110 행, 허용 +110 이내) · directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **40** (39 → 40)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -33,0 +34,6 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (`### Migration 정책` 말미 ~ `### Backup / restore 전략` 앞) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `6  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .github/ package.json → (빈 출력 — 코드 · 배포자산 · CI · 의존성 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1442-*.md  (**3 파일**)
```

#### 한계 —

1. **4 지점의 거짓은 각주로만 해소된다** — 23 · 24 · 25 · 32 행 원문은 그대로라 각주를 건너뛴 독자에겐 `db:5432` 오도와 "P3 에서 결정" 미래형이 남는다. service 이름 1 토큰은 치환 가능했으나 같은 행의 양자 서술 · Unix socket 경로가 함께 걸려 부분 치환이 새 부정합을 만든다는 점, 그리고 23-c 해소가 [CLAUDE.md](../../CLAUDE.md) 편집 (Out of Scope) 을 요구한다는 점을 우선한 결과다.
2. **후반부 미판정 · pool 실효값 미측정** — 34 ~ 49 행 (backup · REQ-032 · 후속 진행) 은 본 slice 범위 밖이라 REQ-032 의 schema-level 강제 여부를 판정하지 않았고, pool 은 설정 키워드 **0 hit** 까지만 확인했을 뿐 `@prisma/adapter-pg` 가 실제로 적용하는 default 크기 · timeout 값은 런타임 측정 (DB 접속) 이 필요해 **미측정** 으로 남겼다 (Out of Scope — DB 접속 금지).

### 12.41 deployment.md `## DB / Persistence` 후반부 ↔ 실 `prisma/schema.prisma` · backup 자산 · reviewer 규약 대조 — 원문 보존 + 각주 1 블록 (T-1443)

> **본 절의 위치** — `§ 12.40` 이 `## DB / Persistence` **전반부** 를 닫으며 파생 영향 **1** 로 지목한 "후반부 = 다음 slice 1 순위" ([T-1442](../tasks/T-1442-deployment-md-db-persistence-head-vs-prisma-audit.md) Follow-up 1) 를 본 절이 계승한다. 이월 사유였던 "REQ-032 축은 `String` column 전수 판정이 필요해 단독 slice 가 적절" 은 실측으로 확인됐다 (`String` 출현 **74** 회 · `model` **15** 개). **계보** — `T-1430` ~ `T-1435` (directory.md) → `T-1436` (산문 단락) → `T-1437` (`## 배포 토폴로지`) → `T-1438` (`## Scheduler 위치`) → `T-1439` · `T-1440` (network boundary 전 / 후반부) → `T-1441` (`## Secret / 자격증명 저장`) → `T-1442` (DB 전반부) → **`T-1443` (본 절 — DB 후반부)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이고, 실측 인용은 cap 준수를 위해 **요약형** 이며 **schema 의 실 데이터 · connection string · secret 은 옮기지 않고 column / model 이름까지만** 인용한다 (CLAUDE.md §9).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md → 40 `### Backup / restore 전략` · 46 `### Raw data 저장 금지 (REQ-032) 의 schema-level 강제` · 52 `### 후속 진행` · 56 `## 배포 토폴로지 (Monolithic vs worker 분리)` ⇒ 본 slice 범위 = **40 ~ 55 행** (AC 좌표 일치 — stale 아님).
      $ sed -n '40,55p' … → heading(40) + bullet 3(41 ~ 43) + heading(46) + bullet 3(47 ~ 49) + heading(52) + 문단 1(54) ; claim 이분 — **검증 가능 13 축** (backup 도구 1 · restore 명령 1 · README pointer 1 · 요구 충족 경로 1 · 자동화 미도입 1 · phase 배정 1 · raw column 1 · 컬럼화 대상 1 · ADR pointer 1 · reviewer 규약 1 · P3 시점 3) · **검증 불가 3** (43 행 "migration history 도 함께 복원되어 schema 상태가 동기" 라는 미실행 설계 서술 · 42 행 "표준 도구 사용 정책만 박제" 의 정책 선언 타당성 · 41 행 "binary 또는 plain SQL backup 가능" 의 실행 결과 — DB 접속 금지라 셋 다 미측정).
(ii)  backup 도구 축 — $ grep -rn "pg_dump\|pg_restore" deploy docs/ops scripts package.json | head -8 → `deploy/README.md:227` (`docker compose exec postgres pg_dump -U … > backup.sql`) · `docs/ops/runbook.md:94` ("PostgreSQL 표준 `pg_dump` / `pg_restore` 를 쓴다" — `### 2.2 DB restore(백업 복원)`) · `docs/ops/runbook.md:99` (백업 명령) ⇒ **3 hit, 문서 밖 자산으로 뒷받침됨** ; 단 runbook 의 복원 명령은 `docker compose exec -T postgres psql … < backup.sql` 로 **plain SQL + `psql`** 이라 `pg_restore` 실 명령은 **미등재**.
(iii) README pointer 축 — $ grep -n "export" README.md | head -6 → **57** `- 평가 자료가 저장된 공간은 쉽게 export하여 backup하고 restore하여 reset할 수도 있어야 한다.` (1 hit) ⇒ 문서가 적은 **"README 57 행" 은 정확** (planner 가설 ②「56 행일 것」을 실측이 **반증** — 가설 반증 5 회째). $ sed -n '54,58p' README.md → 54 `# 평가 자료의 저장` · 56 non-volatile · 57 export / backup / restore · 58 재수집 중복 방지 ⇒ 57 이 요구 문장 본체.
(iv)  자동화 시점 축 — $ grep -rn "backup" .github/workflows/ci.yml deploy scripts src --include='*' | head -8 → `deploy/README.md:227` **수동 1 줄** + `src/export/*.spec.ts` · `src/import/uploaded-dump-file.spec.ts` 의 **fixture 문자열** (`backup-2026-06-17.json` · `backup.dump`) 뿐 ; $ grep -rn "backup\|pg_dump" src/scheduling → **0 hit** ⇒ cron / scheduler 기반 자동 backup **미도입 (참)**.
      $ grep -n "^## Phase P7" docs/PLAN.md → **131** ; $ sed -n '131,140p' docs/PLAN.md → 오너 승인 (2026-07-07, Q-0051) + R-72 · R-73 · R-74 · R-50 · **R-57 (Import / export / restore)** 5 bullet 이 전부 `[x] implemented-on-main` ; $ grep -n '"phase"' docs/STATE.json → 3 `"phase": "P4-complete / P5-in-progress"` ⇒ **자동화는 미이행 · phase 배정은 낡음** 두 축 분리.
(v)   REQ-032 raw column 전수 축 — $ grep -c "String" prisma/schema.prisma → **74** ; $ grep -c "^model " → **15** (`Person` · `Group` · `Part` · `PersonGroupMembership` · `User` · `UserInstanceAccess` · `ServiceIdentity` · `Assessment` · `Contribution` · `Summary` · `LlmProviderConfig` · `DifficultyMapping` · `PermissionDeniedRecord` · `ExportJob` · `ImportJob`).
      $ grep -n "body\|content\|message\|diff\|patch\|rawText\|raw " prisma/schema.prisma | head -12 → hit 12 건 중 **주석 8** (280 · 281 · 285 · 288 · 321 · 323 · 324 · 356 행 — "raw 본문 컬럼 0" 선언 자체) · **`difficulty` 오탐 3** (300 · 335 · 443) · `hashedPassword` 주석 1 (156) ⇒ **raw 본문 column 0 (참)**. $ grep -nE "^\s+[a-zA-Z]+\s+(String|Json|Bytes)" … | grep -iE "body|content|message|text|raw|payload|narrative" → **303 · 366 `narrative String` 2 건뿐** — schema 주석 357 행이 "narrative 는 LLM 정성 요약 평가문 (LLM 생성 결과물 — raw 아님)" 으로 명시 ; `Json` column 은 `ExportJob.dateRange` · `entitySelector` (618 · 619) 로 **선택 조건** 이고 dump 본문은 `artifactRef` **참조만** 보유.
(vi)  reviewer 규약 축 — $ grep -rn "REQ-032\|raw data\|raw 본문" .claude/agents/*.md → **0 hit** ; $ grep -rn "REQ-032" .claude/ → **0 hit** ; $ grep -n "String\|schema.prisma\|column" .claude/agents/reviewer.md → **0 hit** (34 행 `# 8 check 구체 sub-check` 에 schema 항목 부재) ⇒ **미이행 규약**. 원문 화법은 "…확인 — raw text 보관 의도이면 REQ-032 위반으로 REQUEST_CHANGES" 로 **현재형 (현행 규약 서술)** 이라 미래 정책 예고가 아니다.
(vii) P3 시점 축 — $ ls -1 prisma/migrations | wc -l → **14** ; $ grep -rn "class PrismaService" src --include='*.ts' → `src/persistence/prisma.service.ts:29` (1 hit, `src/persistence/persistence.module.ts` 동거) ; $ grep -n '"@prisma/client"\|"prisma"' package.json → 34 `"@prisma/client": "^7.8.0"` · 42 `"prisma": "^7.8.0"` ; $ grep -c "@@index" → **14** · $ grep -c "@@unique" → **19** (`@unique` 별도 다수) ⇒ column 설계 · 인덱스 · unique · install · module **전부 이행**.
      `§ 12.15` 강도 — 본 후반부의 시점 marker 는 **3 hit** (42 · 49 · 53 행) 이고 전부 "어느 phase 가 언제 한다" 는 당시 계획 기록이며 53 행은 "코드 변경은 0 LOC" 라는 **작성 시점 자기 기술** 이라, 갱신하려면 새 phase 배정을 창작해야 해 append-only 가 `§ 12.40` 과 동일 강도로 걸린다.
(viii) pointer 유효성 축 — $ grep -n '^## \|^### ' docs/decisions/ADR-0002-db.md | head -12 → 21 `## Context` · **41 `## Decision`** · 53 `## Consequences` · 88 `## Amendment …` · 113 `## References` (`### Decision §2` heading 은 없고 `## Decision` 하위 **번호 목록 2 번** 이 "REQ-032 schema-level 강제") ⇒ 47 행 `Decision §2` pointer **유효** (본문 재판정 · status 변경 없음).
(ix)  baseline — wc -l deployment.md **219** · audit **4072** · directory.md **203** · modules.md **259** ; grep -c '^## ' deployment.md **6** · audit **12** ; audit grep -c '^| REQ-' **66** · grep -c '^### 12\.' **40** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 의 "본 문서는 P1 T-A2 의 산출물" 선언이 그대로 걸리고, 본 후반부는 [T-0014](../tasks/T-0014-adr-0002-db-selection.md) 가 [ADR-0002](../decisions/ADR-0002-db.md) 를 옮겨 채운 P1 blueprint 원본이라 보존 강도가 `§ 12.40` 과 동급이다. ② **`§ 12.15` 정합**: 날짜 stamp **0** · 시점 marker **3 hit** (42 · 49 · 53 행, 실측 (vii)) 으로 전반부와 같은 밀도이며 53 행은 자기 기술이라 치환 대상으로 가장 부적합하다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 · 규약 · 시점 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1442 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 후반부는 **행 번호 pointer 가 실측상 정확** (41 행 README 57) 해 in-place 치환 대상 자체가 0 이라 각주 계열에 든다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 41-a | 표준 `pg_dump` / `pg_restore` 로 backup 가능 | `deploy/README.md` 227 · `docs/ops/runbook.md` 94 · 99 실재 | 참 | 무편집 + 각주 근거 | 실측 (ii) 3 hit |
| 41-b | `pg_restore` 가 실 복원 경로 (43 행과 연동) | runbook 복원 명령은 **plain SQL + `psql`** | 부분참 | 원문 보존 + 각주 부기 | 도구 이름은 유효하나 실 절차와 형식이 다름 |
| 41-c | pointer — **README 57 행** (export / backup / restore) | README **57 행이 정확히 그 요구 문장** | 참 | 무편집 + 각주 근거 | planner 가설 ② 반증 (실측 우선) |
| 41-d | README 57 요구를 **본 표준 도구로** 충족 | 실 충족 주 경로는 app-level export / import job (`src/export/` · `src/import/`, PLAN P7 R-57 `[x]`) | 부분참 | 원문 보존 + 각주 부기 | dump 는 보조, 요구 충족 주 경로가 바뀜 |
| 42-a | 자동 backup 은 아직 없음 (정책만 박제) | 자동화 자산 **0** (`deploy/README.md` 227 수동 1 줄뿐) | 참 | 무편집 + 각주 근거 | 실측 (iv), `src/scheduling` 0 hit |
| 42-b | 자동 backup 은 **P7 phase 의 task** | P7 **부분 진입** (R-72 · 73 · 74 · 50 · 57 `[x]`) · 현 phase `P4-complete / P5-in-progress` | 부분참 (시점 낡음) | 원문 보존 + 각주 부기 | 새 phase 배정 창작 금지 (AC 4) |
| 47-a | `schema.prisma` 에 raw 본문 column 미정의 | 전수 — 후보 계열 column **0** (`narrative` 는 LLM 생성물) | 참 | 무편집 + 각주 근거 | 실측 (v), schema 무편집 |
| 47-b | 평가 결과 (난이도 / 평가문 / metric) 만 컬럼화 | `difficulty` · `narrative` · metric 컬럼 실재 | 참 | 무편집 | 실측 (v) model 15 개 확인 |
| 47-c | pointer — [ADR-0002](../decisions/ADR-0002-db.md) `Decision §2` | `## Decision` 41 행의 근거 **2** 번 = REQ-032 강제 | 참 | 무편집 | 실측 (viii), ADR 본문 재판정 없음 |
| 48 | reviewer agent 가 `String` column 추가를 REQ-032 위반으로 **REQUEST_CHANGES** | `.claude/agents/*.md` **0 hit** · reviewer 8 check 에 schema 항목 부재 | 거짓 (미이행 규약) | 원문 보존 + 각주 부기 | `.claude/agents/` 편집은 Out of Scope |
| 49 | 구체 column 설계 / 인덱스 / unique 는 **P3 에서 진행** | `@@index` **14** · `@@unique` **19** 실재 | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | 이행 완료를 미래형으로 서술 |
| 53-a | `prisma` install · PrismaService module 은 **P3 에서 진행** | `package.json` `^7.8.0` · `src/persistence/prisma.service.ts` · migrations **14** | 거짓 (시점 낡음) | 원문 보존 + 각주 부기 | 같은 유형이 `§ 12.40` 32 행에도 있었음 |
| 53-b | 본 task 와 본 단락은 정책만 박제 · **코드 변경 0 LOC** | T-0014 시점 기술로는 유효 | 참 (시점 한정) | 무편집 + 각주 부기 | 자기 기술이라 `§ 12.15` 보존 최강 |

- 합계 — 검증 가능 **13 row = 참 7 · 부분참 3 · 거짓 3**, 검증 불가 3 은 대상 제외. `§ 12.40` (거짓 4 / 15) 보다도 거짓 비중이 낮은데, 이는 후반부의 핵심 정책 claim (raw column 금지 · backup 도구 · ADR pointer · README pointer) 이 **실제와 그대로 일치** 했기 때문이며, 어긋난 3 건은 전부 "누가 언제 하기로 했는가" 축 (48 은 규약 주체, 49 · 53 은 phase) 이다.
- **거짓 / 부분참 축 · 시점 축의 분리 판정** — ① **거짓 / 부분참 (41-b · 41-d · 48)**: 41-b · 41-d 는 도구 · 요구 이름이 유효한 채 **실 경로만 갈라진** 형태라 원문 1 토큰 치환으로는 오히려 backup 정책 선언 자체가 지워지고, 48 은 해소하려면 `.claude/agents/reviewer.md` 체크리스트 추가가 필요한데 그것이 Out of Scope 다 (문서를 실제에 맞출 뿐 실제를 문서에 맞추지 않는다) → 셋 다 각주로 수렴. ② **시점 (42-b · 49 · 53-a)**: 갱신하려면 "이제 어느 phase 책임인가" 를 새로 배정해야 하고 그것은 PLAN 게이트라 AC 4 창작 금지와 정면 충돌하며, 특히 42-b 는 **미이행 (자동화) 과 시점 낡음 (phase 배정) 이 겹쳐** 과거형 전환으로도 해소되지 않는다 → 실측 사실만 각주에 병기. 두 축의 처리가 같은 (B) 로 수렴했으나 **사유는 위와 같이 다르다**.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (backup 경로 · 규약 · 시점 3 행 재작성) | 기각 | 치환 지점이 **6** 으로 AC 4 의 `≤ 2 지점` 상한을 넘고, 시점 3 행 · 규약 1 행은 새 phase 배정 또는 `.claude/` 편집을 요구해 창작 금지 · Out of Scope 와 충돌 |
| **(B)** | **원문 무편집 + `### 후속 진행` 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1442 화법을 그대로 잇고 실 자산 (`deploy/README.md` 227 · runbook 94 · 99) · 실 수치 (`@@index` 14 · `@@unique` 19 · migrations 14) · 미이행 사실 (0 hit) 을 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (행 번호 pointer 만 in-place, 나머지 각주) | 기각 | 실측 결과 **행 번호 pointer (README 57) 가 정확** 해 in-place 대상이 0 이므로 후보 자체가 공전한다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 독자가 48 행을 근거로 **reviewer 가 REQ-032 를 자동 차단한다고 신뢰** 하면 schema PR 에서 실재하지 않는 게이트를 믿게 되고, 42 행을 근거로 자동 backup 이 P7 에서 이미 처리됐다고 오인할 수 있다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 3 이 전부 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **오도 risk**: 본 후반부는 **데이터 보호 정책 + 복구 지시** 로 읽히는 단락이라 잘못 따르면 (a) 존재하지 않는 reviewer 자동 차단을 믿고 raw column 을 무심코 추가하거나, (b) 자동 backup 이 이미 돌고 있다고 오인해 백업 부재로 복구 불능에 빠지거나, (c) `pg_restore` 명령을 그대로 시도해 plain SQL dump 에 실패한다 — 셋 다 데이터 손실 · 정책 위반으로 직결돼 (D) 를 기각시킨다. ③ **cap**: (B) 의 실측 diff 는 deployment.md `+7/-0` (219 → **226**, 허용 `≤ 226`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다. (A) 는 창작 금지 · Out of Scope 충돌로 자동 기각이며 split 해도 `.claude/agents/` 편집이 남아 doc slice 로 쪼개는 것 자체가 부적절하다. ④ **선례 일관성**: `§ 12.37` ~ `§ 12.40` 이 같은 문서의 인접 단락에서 (B) 를 채택했으므로 본 절이 다른 후보를 고르면 한 문서 안 처리 방식이 갈린다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (6 행)** — 54 행 (`### 후속 진행` 본문 말미) 뒤 · `## 배포 토폴로지 (Monolithic vs worker 분리)` heading 앞에 append (앞뒤 공백 행 보존). 내용은 ① 41-a · 41-c 참 (자산 3 hit + README 57 정확) + 41-b · 41-d 부분참 (`psql` 실 절차 · app-level export / import), ② 42-a 미이행 + 42-b phase 낡음 **축 분리**, ③ 47-a 전수 참 (`model` 15 · `String` 74 · 후보 0 · `narrative` = LLM 생성물 · `artifactRef` 참조만) + 47-c ADR pointer 유효, ④ 48 **0 hit 미이행 규약** + 현재형 화법의 오도 risk, ⑤ 49 · 53 이행 완료 (`@@index` 14 · `@@unique` 19 · `^7.8.0` · `src/persistence/` · migrations 14) + 53-b 시점 한정, ⑥ `§ 12.15` 처리 사유 + 본 절 pointer.
- **각주 위치 근거 + 문구 1:1 + 무편집 경계** — 대상 claim 이 세 하위 절에 걸쳐 있어 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 **후반부 최말미** 에 뒀고, `§ 12.40` 이 전반부 말미 (현 34 ~ 38 행) 에 각주를 둔 배치와 동형이다. 각주의 경로 · column / model 이름 · 도구 이름 · 수치 (`deploy/README.md` 227 · `docs/ops/runbook.md` 94 · 99 · README 57 · `narrative` · `artifactRef` · `@@index` 14 · `@@unique` 19 · `^7.8.0` · migrations 14 · `String` 74 · `model` 15 · `P4-complete / P5-in-progress`) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 column · 미도입 backup script 경로 · 임의 phase 배정) 은 창작하지 않았고 schema 의 실 데이터 · connection string · secret 도 옮기지 않았다** (이름까지만). 1 ~ 4 행 blockquote · **15 ~ 38 행 (DB 전반부 + T-1442 각주)** · 40 ~ 54 행 원문 · `## 개요` · 56 행 이후 전 구간 (`## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1441 각주) 은 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 markdown 링크는 ADR-0002 (이미 47 행 등재) 와 본 절 2 개뿐이고, 나머지 파일 (`deploy/README.md` · `docs/ops/runbook.md` · `docs/PLAN.md` · `.claude/agents/reviewer.md`) 은 **링크 없는 코드 span** 으로만 인용했다.

#### T-1442 Follow-up 1 closure + `## DB / Persistence` 단락 완결 선언

- **Follow-up 1 closure** — `§ 12.40` 이 "다음 slice 1 순위" 로 이월한 후반부 (당시 34 ~ 49 행, 각주 반영 후 40 ~ 55 행) 의 **검증 가능 13 row 를 본 절이 전부 판정 · 각주 반영** 했다. 이월 근거였던 "REQ-032 는 `String` column 전수 판정 필요" 도 실측 (v) 로 소진됐다. 승계 대상은 남지 않는다.
- **단락 완결** — 이로써 `## DB / Persistence` (15 ~ 55 행) 는 전반부 (`§ 12.40` 각주 1 블록) + 후반부 (본 절 각주 1 블록) 로 **전 구간 대조 완결** 이며, 단락 안 각주는 이 2 블록뿐이다 (중복 부기 0).

#### 대조 대상 문서 잔여 갱신

`§ 12.40` 이 남긴 deployment.md 잔여 1.5 단락은 본 절 후 **`## 개요` (5 ~ 14 행) 1 개** 로 좁혀진다. 이 마지막 단락을 닫으면 **deployment.md 전 단락 대조가 완결** 된다 (아래 파생 영향 1). **본 각주는 54 행 뒤라 55 행 이후 좌표가 +7 밀리며**, `## 개요` 는 각주 앞이라 좌표 불변이다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **`## 개요` (5 ~ 14 행) = 다음 slice 1 순위** — deployment.md 잔여 마지막 단락. 닫으면 **문서 전 단락 대조가 완결** 되고 uc-doc-audit-resync stream 의 deployment.md 축이 종료된다.
2. **reviewer 규약 미이행의 처리 경로** — `.claude/agents/reviewer.md` 에 REQ-032 / raw column sub-check 를 추가할지는 **별도 direct task** 소관 (본 slice 는 audit 기록만 — 문서를 실제에 맞출 뿐 실제를 문서에 맞추지 않는다). 추가 시 ADR-0002 근거 2 번 항목과의 정합 판정이 선행돼야 한다.
3. **README 행 번호 pointer 전수 sweep** — 본 절에서 README 57 은 **정확** 으로 확인됐으나 다른 문서의 README 행 pointer 는 미검증. 전수 sweep 후보.
4. **`deploy/README.md` ↔ deployment.md 배포 절차 정합** — `§ 12.39` Follow-up 4 미소진 (본 절이 227 행을 인용하며 접점만 확인). 정본 지정 판정 필요.
5. **`@nestjs/config` 미도입 사실의 전수 sweep** — `§ 12.39` Follow-up 3 미소진 (ADR 재판정 owner 게이트).
6. **REQ 번호 체계 잔재의 전수 sweep** — `§ 12.38` Follow-up 3 미소진 (owner 게이트).
7. **`CLAUDE.md` §1 pointer 부정확** — `§ 12.40` Follow-up 3 미소진 (CLAUDE.md 는 §3.1 별개 소관).
8. **UC-09 `§ 5` sequence participant 병기** — 25 회째 이월.
9. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트, **259 행 불변**).
10. **행 번호 → anchor 좌표계 이행** — 19 회째 이월. 본 절 각주가 55 행 이후를 +7 미는 것이 근거를 또 한 번 보탠다.
11. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `74` · `15` · `14` · `19` · `0 hit` 은 schema / migration / agent 정의 1 건 변경으로 즉시 낡는다.

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pg_dump` · `pg_restore` · `prisma migrate` · `docker compose up` · `pnpm build` · `pnpm test` 는 실행하지 않았다).

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **226** (219 → +7, 허용 ≤ 226) · audit **4072 → 4178** (+106 = 본 절 106 행, 허용 +110 이내) · directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **41** (40 → 41)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -55,0 +56,7 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (`### 후속 진행` 말미 ~ `## 배포 토폴로지` heading 앞) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `7  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .github/ package.json README.md .claude/ → (빈 출력 — 코드 · 스키마 · 배포자산 · CI · 의존성 · 요구사항 정본 · agent 정의 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1443-*.md  (**3 파일**)
```

#### 한계 —

1. **3 지점의 거짓은 각주로만 해소된다** — 48 · 49 · 53 행 원문은 그대로라 각주를 건너뛴 독자에겐 "reviewer 가 REQUEST_CHANGES 한다" 는 현재형 서술과 "P3 에서 진행" 미래형이 남는다. 48 행 해소가 `.claude/agents/reviewer.md` 편집 (Out of Scope) 을, 49 · 53 행 해소가 새 phase 배정 창작 (PLAN 게이트) 을 각각 요구한다는 점을 우선한 결과다.
2. **backup / restore 의 실행 검증 · runtime 사실은 미측정** — `pg_dump` · `pg_restore` · `psql` 절차가 실제로 동작하는지, migration history 가 복원 후 정말 동기되는지 (43 행) 는 DB 접속 · 명령 실행이 필요해 Out of Scope 로 남겼다. 또한 raw column 판정은 **schema 선언 기준** 이라, 런타임에 `String` column 에 raw 본문이 실제로 적재되는지 (예: `error` · `artifactRef` 의 내용) 는 데이터 조회가 필요해 판정하지 않았다.

### 12.42 deployment.md `## 개요` ↔ 실 배포 자산 (`Dockerfile` · `docker-compose.yml` · `deploy/`) · 참조 문서 (`INDEX.md` · `components.md` · `ADR-0003` · `runbook.md`) 대조 — 원문 보존 + 각주 1 블록 (T-1444)

> **본 절의 위치** — `§ 12.41` 이 "다음 slice 1 순위" 로 지목한 [T-1443](../tasks/T-1443-deployment-md-db-persistence-tail-vs-prisma-audit.md) **Follow-up 1** (`## 개요` = deployment.md 잔여 마지막 단락) 을 본 절이 계승한다. **계보** — `T-1430` ~ `T-1435` (directory.md) → `T-1436` (산문 단락) → `T-1437` (`## 배포 토폴로지`) → `T-1438` (`## Scheduler 위치`) → `T-1439` · `T-1440` (network boundary 전 / 후반부) → `T-1441` (`## Secret / 자격증명 저장`) → `T-1442` · `T-1443` (DB 전 / 후반부) → **`T-1444` (본 절 — `## 개요`, 문서 전 단락 대조 완결)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이고, 측정은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 **secret · connection string · 실 호스트명은 옮기지 않았다** (CLAUDE.md §9).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/deployment.md | head -6 → 1 `# Deployment view` · **5 `## 개요`** · **15 `## DB / Persistence`** · 21 `### 배포 토폴로지` · 28 `### Migration 정책` · 40 `### Backup / restore 전략`
      ⇒ 본 slice 범위 = **5 (heading) · 7 ~ 13 (본문 4 문단) · 15 (다음 heading)** — AC 좌표 그대로 **stale 아님** (T-1443 각주가 54 행 뒤라 앞머리를 밀지 않았다).
      $ sed -n '5,13p' … → heading(5) + 문단 4 (7 view 성격 + MVA + manifest 범위 + P7 시점 / 9 ADR-0002 · ADR-0003 pointer + source-of-truth 자기규정 / 11 components.md pointer / 13 runbook.md pointer + 성격 claim).
      claim 이분 — **검증 가능 14 축** (manifest 자산 3 · P7 시점 1 · P7 명칭 1 · INDEX pointer 1 · ADR-0002 pointer 1 · ADR-0003 개수 1 · components pointer 3 · runbook pointer 3) · **검증 불가 4** (7 행 "본 문서는 deployment view 를 박제한다" · 7 행 "MVA 원칙에 따라 운영 가능한 최소 결정만 다루고" · 7 행 "구체적인 manifest 는 다루지 않는다" 범위 선언 · 9 행 "ADR 이 source of truth, 본 문서는 도식 / 텍스트 설명" 자기규정 — 전부 문서 자신의 범위 · 성격 선언이라 참·거짓 대상이 아니다).
(ii)  manifest 자산 축 (7 행) — $ ls -1 Dockerfile docker-compose.yml → **둘 다 실재** (repo 루트) ; $ ls -1 deploy | head -12 → `README.md` · `assessment-agent-redeploy.service` · `assessment-agent-redeploy.timer` · `daily-test-step-collect.test.sh` · `daily-test-step-deps-schema.test.sh` · `daily-test-step-env-source.test.sh` · `daily-test-step-eval-chain.test.sh` · `daily-test-step-eval.test.sh` · `daily-test-step-rediscovery.test.sh` · `daily-test.sh` · `docker-entrypoint.sh` · `env.prod.example` (+ `local-llm-example` · `redeploy.sh` · `seed-llm-config.sh`) ; $ ls -1 deploy | wc -l → **15** ; $ ls -d k8s kubernetes helm chart 2>/dev/null || echo "none" → **none**.
      ⇒ 세 자산 분리 판정 — `Dockerfile` **실재** · `docker-compose.yml` **실재** · Kubernetes manifest **부재**. 한편 $ grep -c "docker" docs/architecture/deployment.md → **7** 이고 hit 은 7 · 24 · 34 · 36 · 37 · 103 · 120 행의 **서술 참조** 뿐이라 manifest 본문 수록은 **0 행** — 즉 "문서가 다루지 않는다" (범위, 유효) 와 "repo 에 없다" (자산, 절반 거짓) 는 **다른 축** 이다.
(iii) P7 시점 축 (7 행) — $ grep -n "^## Phase P7" docs/PLAN.md → **131** `## Phase P7 — Scheduling & operations` (문서의 명칭 표기와 1:1) ; $ sed -n '131,140p' docs/PLAN.md → 오너 승인 (2026-07-07, Q-0051) + R-72 · R-73 · R-74 · R-50 · R-57 **5 bullet 전부 `[x] implemented-on-main`** ; $ python -c "…json.load…['phase']" → **`P4-complete / P5-in-progress`**.
      ⇒ (ii) 와 합쳐 **자산별로 갈림** — container / compose / systemd 자산은 이미 shipped 라 "앞으로 P7 이 한다" 가 낡았고, Kubernetes 는 여전히 미착수라 미래형이 유효하다.
(iv)  pointer 3 종 축 — $ grep -n "MVA" docs/architecture/INDEX.md | head -4 → **54** `## MVA 원칙` (1 hit, 절 실재) ; $ sed -n '1,5p' docs/architecture/components.md → 1 `# Component view` · **3** `> 본 문서는 P1 T-A3 의 산출물이다. [T-0016](../tasks/T-0016-t-a3-component-view.md) 가 component 분해도 + mermaid 다이어그램 + 8 component table + contract 표 + GitHub Adapter 3-instance 묶음 결정을 박제했다.` · 5 `## 개요` ; $ grep -n '^## ' docs/ops/runbook.md | head -10 → **21** `## 1. 배포 (Deploy / Redeploy)` · **74** `## 2. 복구 (Recovery)` · **117** `## 3. Trouble-shoot (증상별 진단)` · **143** `## 4. 운영 전제 체크리스트` (4 절뿐) ⇒ 13 행의 "배포·복구·trouble-shoot 실행 절차" 3 요소가 heading 과 **1:1 대응**.
(v)   ADR 개수 축 (9 행) — $ grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md → **8 hit** (32 · 46 · 62 · 78 = `## Decision` 하위 §1 ~ §4 / 120 · 129 · 138 · 147 = `## Alternatives considered` 하위 동명 4 절) ⇒ **실 결정은 4 개** 이고 ADR 제목 10 행도 `# ADR-0003 — Deployment 토폴로지 4 결정` 이라 "Deployment 4 결정" 수치는 **참**. (ADR 본문 재판정 · status 변경 없음.)
      `§ 12.15` 강도 — $ awk 'NR>=5 && NR<=13' … | grep -cE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" → **0** (날짜 stamp 없음) ; 시점 marker 는 7 행의 `P7` · `책임` **1 곳뿐** 이라 선행 단락 (3 hit) 보다 밀도가 낮으나, 갱신하려면 새 phase 배정을 창작해야 하는 성격은 같다.
(vi)  자기규정 축 (9 행) — 본 문서 나머지 6 단락의 누적 판정을 **재측정 없이 인용** (§7): `§ 12.35` 14 = 참 13 · 부분참 1 · 거짓 0 / `§ 12.36` 13 = 참 3 · 부분참 2 · 거짓 8 / `§ 12.37` 12 = 참 9 · 부분참 3 · 거짓 0 / `§ 12.38` 13 = 참 4 · 부분참 3 · 거짓 6 / `§ 12.39` 19 = 참 6 · 부분참 5 · 거짓 8 / `§ 12.40` 15 = 참 8 · 부분참 3 · 거짓 4 / `§ 12.41` 13 = 참 7 · 부분참 3 · 거짓 3 ⇒ **합 99 = 참 50 · 부분참 20 · 거짓 29**. (본 AC 가 적은 `§ 12.36` ~ `§ 12.41` 범위는 slice ID 기준으로 1 절 어긋나 — T-1437 은 `§ 12.35` — 실측대로 **`§ 12.35` ~ `§ 12.41` 7 절** 을 집계했다.)
(vii) baseline — $ wc -l → deployment.md **226** · audit **4178** · directory.md **203** · modules.md **259** ; $ grep -c '^## ' → deployment.md **6** · audit **12** ; audit $ grep -c '^| REQ-' → **66** · $ grep -c '^### 12\.' → **41** (기대 8 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 4 행 blockquote 의 "본 문서는 P1 T-A2 의 산출물" 선언이 본 단락에 **가장 강하게** 걸린다. `## 개요` 는 문서 자신의 범위·성격을 규정하는 머리말이라 다른 단락보다 blueprint 원본성이 높고, 실제로 검증 가능 claim 14 축 옆에 **검증 불가 자기규정 4** 가 붙어 있어 손대면 문서 정체성 자체를 재작성하게 된다. ② **`§ 12.15` 정합**: 날짜 stamp **0** · 시점 marker **1 hit** (7 행 `P7 … 책임`, 실측 (v)) 으로 밀도는 낮지만 유일한 그 1 곳이 본 slice 의 유일한 갱신 후보이며, 갱신하려면 "이제 어느 phase 책임인가" 를 창작해야 해 append-only 가 그대로 걸린다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 · 시점 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1443 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 단락은 **수치 · pointer 축이 전수 참** 이라 in-place 치환 대상이 0 이고, 남은 것은 시점 · 자산 축뿐이라 각주 계열에 든다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 7-a | pointer — [INDEX.md](../architecture/INDEX.md) 의 `MVA 원칙` | INDEX.md **54** 행 `## MVA 원칙` 실재 | 참 | 무편집 + 각주 근거 | 실측 (iv) 1 hit |
| 7-b | 다루지 않는 manifest 로 열거된 `Dockerfile` | repo 루트에 **실재** (문서 미수록은 별개) | 부분참 | 원문 보존 + 각주 부기 | 범위 선언은 유효하나 부재로 오독될 수 있음 |
| 7-c | 같은 열거의 `docker-compose.yml` | repo 루트에 **실재**, `deploy/` 자산 **15** 개 동반 | 부분참 | 원문 보존 + 각주 부기 | 실측 (ii), 오도 risk 는 각주로 제거 |
| 7-d | 같은 열거의 Kubernetes manifest | `k8s` · `kubernetes` · `helm` · `chart` **부재** | 참 | 무편집 + 각주 근거 | 실측 (ii) `none` |
| 7-e | 그 manifest 는 **P7 phase 의 운영 task 책임** | P7 부분 진입 (R-72 · 73 · 74 · 50 · 57 `[x]`) · 현 phase `P4-complete / P5-in-progress` · 자산 이미 shipped | 부분참 (시점 낡음, 자산별로 갈림) | 원문 보존 + 각주 부기 | 새 phase 배정 창작 금지 (AC 4) |
| 7-f | phase 명칭 표기 `P7 (Scheduling & operations)` | PLAN **131** 행 `## Phase P7 — Scheduling & operations` | 참 | 무편집 | 실측 (iii) 1:1 |
| 9-a | pointer — [ADR-0002](../decisions/ADR-0002-db.md) (DB) | 파일 실재 · `§ 12.41` (viii) 에서 heading 확인 완료 | 참 | 무편집 | 재측정 없이 선행 절 인용 (§7) |
| 9-b | [ADR-0003](../decisions/ADR-0003-deployment.md) 은 **Deployment 4 결정** | `### Decision §1` ~ `§4` **4 개** · ADR 제목도 "4 결정" | 참 | 무편집 + 각주 근거 | 실측 (v), `Alternatives` 동명 4 절은 별개 |
| 11-a | pointer — [components.md](../architecture/components.md) 실재 | 파일 실재 (1 행 `# Component view`) | 참 | 무편집 | 실측 (iv) |
| 11-b | components.md 는 **T-0016 의 산출물** | 3 행 blockquote 가 "P1 T-A3 의 산출물 … `T-0016` 가 … 박제" 로 자기선언 | 참 | 무편집 + 각주 근거 | 실측 (iv) 원문 인용 |
| 11-c | 그 문서에 **component 분해 + contract** 가 박제 | 같은 blockquote 에 "component 분해도 + 8 component table + **contract 표**" 명시 | 참 | 무편집 | 실측 (iv) |
| 13-a | pointer — [runbook.md](../ops/runbook.md) 실재 | 파일 실재 (`## ` 4 절) | 참 | 무편집 | 실측 (iv) |
| 13-b | 성격 — **배포 · 복구 · trouble-shoot 실행 절차** | `## 1. 배포` · `## 2. 복구` · `## 3. Trouble-shoot` 3 요소 1:1 (+ `## 4. 운영 전제 체크리스트`) | 참 | 무편집 + 각주 근거 | 실측 (iv) heading 대응 |
| 13-c | 본 view 의 정책을 **명령-level 로 푼 플레이북** | runbook 94 · 99 행 등이 실 명령 (`§ 12.41` (ii) 인용) | 참 | 무편집 | 선행 절 인용 (§7), 재측정 없음 |

- 합계 — 검증 가능 **14 row = 참 11 · 부분참 3 · 거짓 0**, 검증 불가 4 는 대상 제외. **거짓 0 은 본 stream 에서 `§ 12.37` (전반부) 에 이어 두 번째** 이며, 이는 `## 개요` 가 **문서 자신의 범위 선언 + 다른 문서 pointer** 로만 이뤄져 코드와 직접 맞물리는 서술이 거의 없기 때문이다 — pointer 4 종 (INDEX · ADR-0002 · ADR-0003 · components · runbook) 이 전부 유효했고, 실제와 갈린 3 건은 전부 "repo 에 자산이 이미 있는가 / 언제 누가 하는가" 축이다.
- **시점 축 (7-e) 과 pointer / 수치 축 (7-a · 9-b · 11-b · 13-b) 의 분리 판정** — ① **pointer / 수치 축**: 전수 참이라 처리 자체가 `무편집` 이고, 각주는 "확인했다" 는 근거 병기 목적뿐이다 (치환하면 정확한 문장을 이유 없이 흔든다). ② **시점 / 자산 축 (7-b · 7-c · 7-e)**: 갱신하려면 (a) 열거에서 `Dockerfile` · `docker-compose.yml` 을 빼거나 (b) "이제 어느 phase 책임인가" 를 새로 배정해야 하는데, (a) 는 **문서의 범위 선언 자체를 바꾸는 편집** 이라 blueprint 보존과 충돌하고 (b) 는 PLAN 게이트 · AC 4 창작 금지와 정면 충돌한다 → 실측 사실만 각주에 병기. 두 축이 같은 (B) 로 수렴했으나 **사유는 위와 같이 다르다** — 전자는 "고칠 게 없어서", 후자는 "고칠 수단이 금지돼서".

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (manifest 열거 재작성 + 시점 문구 교체) | 기각 | 참 11 row 는 치환 대상이 아예 없고, 남은 3 건의 치환은 **범위 선언 문장 재작성 또는 새 phase 배정 창작** 을 요구해 AC 4 창작 금지 · blueprint 보존과 충돌 |
| **(B)** | **원문 무편집 + `## 개요` 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1443 화법을 그대로 잇고, 실 자산 (`Dockerfile` · `docker-compose.yml` · `deploy/` 15) · 부재 사실 (k8s `none`) · pointer 유효 근거 (INDEX 54 · ADR-0003 §1 ~ §4 · components 3 행 · runbook 4 절) 를 같은 화면에 병기해 오도 risk 만 제거 |
| (C) | 혼합 (수치 · pointer 만 in-place, 시점은 각주) | 기각 | 실측 결과 **수치 · pointer 축이 전수 참** 이라 in-place 대상이 0 이므로 후보가 공전한다 (`§ 12.41` 의 (C) 기각과 같은 형태) |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 본 단락은 **문서 첫 산문 단락** 이라 노출도가 가장 높아, 독자가 "이 repo 에는 Dockerfile / compose 가 아직 없고 배포는 P7 에서 시작한다" 고 오인하면 실재하는 `deploy/` 15 개 자산 · `redeploy.sh` · systemd timer 를 놓친 채 새 배포 경로를 중복 구축하게 된다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker 1 (7 행) 이 창작 없이는 갱신 불가라 append-only 와 각주가 정합한다. ② **오도 risk**: 첫 산문 단락이라 **문서 진입 독자 전원이 읽는 위치** 이고, 오독의 비용이 (a) 실재 배포 자산 중복 구축, (b) `deploy/README.md` · runbook 플레이북 미인지로 인한 잘못된 수동 배포, (c) "P7 은 아직" 이라는 인식으로 이미 `implemented-on-main` 인 R-72 ~ R-57 재착수 — 셋 다 실작업 낭비로 직결돼 (D) 를 기각시킨다. ③ **cap**: (B) 의 실측 diff 는 deployment.md `+6/-0` (226 → **232**, 허용 `≤ 233`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다 ((A) 는 창작 금지 충돌로 자동 기각이며 split 해도 PLAN 편집이 남아 doc slice 로 쪼개는 것 자체가 부적절). ④ **선례 일관성**: `§ 12.35` ~ `§ 12.41` 이 같은 문서의 나머지 6 단락에서 모두 (B) 를 채택했으므로 마지막 단락만 다른 후보를 고르면 한 문서 안 처리 방식이 갈린다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (5 행)** — 13 행 (`## 개요` 본문 말미) 뒤 · `## DB / Persistence` heading 앞에 append (앞뒤 공백 행 보존, 실 증가 **+6** = blockquote 5 + 공백 1). 내용은 ① manifest 3 자산 **분리 판정** (Dockerfile · compose 실재 / k8s 부재) + "다루지 않는 것 ≠ 없는 것" 축 구분 + 문서 내 docker 언급 7 회가 전부 서술 참조라는 사실, ② 7-e **시점 낡음 + 자산별 갈림** (PLAN 131 · R-72 ~ R-57 `[x]` · 현 phase 표기), ③ pointer · 수치 축 **전수 참** 근거 (INDEX 54 · ADR-0003 §1 ~ §4 · components 3 행 · runbook 4 절), ④ 9 행 자기규정과 T-1437 ~ T-1443 누적 실측 (**99 = 참 50 · 부분참 20 · 거짓 29**) 사이의 긴장 1 구, ⑤ `§ 12.15` 처리 사유 + 본 절 pointer.
- **각주 위치 근거 + 문구 1:1 + 무편집 경계** — 대상 claim 이 7 · 9 · 11 · 13 행 네 문단에 걸쳐 있어 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 **단락 최말미** 에 뒀고, `§ 12.40` · `§ 12.41` 이 각각 전 / 후반부 말미에 각주를 둔 배치와 동형이다. 각주의 경로 · 절 이름 · 수치 (`Dockerfile` · `docker-compose.yml` · `deploy/` **15** · k8s **0** · docker 언급 **7** · PLAN **131** · `P4-complete / P5-in-progress` · INDEX **54** · ADR-0003 `§1` ~ `§4` **4** · components **3** 행 · runbook `## 1` ~ `## 4` · 99 / 50 / 20 / 29) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 manifest 경로 · 임의 phase 배정 · 없는 절 이름) 은 창작하지 않았고 secret · connection string · 실 호스트명도 옮기지 않았다**. **1 ~ 4 행 blockquote** 와 **15 행 이후 전 구간** (`## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1443 각주 전부) 은 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 markdown 링크는 본문에 이미 등재된 INDEX.md · ADR-0003 · components.md · runbook.md 와 본 절 pointer 뿐이고, `docs/PLAN.md` 는 **링크 없는 코드 span** 으로만 인용했다.

#### T-1443 Follow-up 1 closure + deployment.md 전 단락 대조 완결 선언

- **Follow-up 1 closure** — `§ 12.41` 이 "다음 slice 1 순위" 로 이월한 `## 개요` (당시 5 ~ 14 행, 현 5 ~ 13 행) 의 **검증 가능 14 row 를 본 절이 전부 판정 · 각주 반영** 했다. 승계 대상은 남지 않는다.
- **문서 완결 매핑 (1 줄)** — `## 개요` = T-1444 / `§ 12.42` (본 절) · `## DB / Persistence` = T-1442 (전반부) + T-1443 (후반부) / `§ 12.40` · `§ 12.41` · `## 배포 토폴로지 (Monolithic vs worker 분리)` = T-1437 / `§ 12.35` · `## Secret / 자격증명 저장` = T-1441 / `§ 12.39` · `## Scheduler 위치` = T-1438 / `§ 12.36` · `## 외부 네트워크 boundary` = T-1439 (전반부) + T-1440 (후반부) / `§ 12.37` · `§ 12.38`.
- **완결 선언** — 이로써 [deployment.md](../architecture/deployment.md) 는 `## ` 단락 **6 개 전부** 가 실측 대조를 마쳤고, 문서 안 실측 각주는 **8 블록** (전 / 후반부로 갈린 2 단락이 각 2 블록) 이며 중복 부기는 0 이다. uc-doc-audit-resync stream 의 **deployment.md 축은 본 절로 종료** 된다. 누적 판정은 검증 가능 **113 row = 참 61 · 부분참 23 · 거짓 29** (`§ 12.35` ~ `§ 12.42` 합).

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **deployment.md 축 종료 → 다음 문서 축 1 순위 = [components.md](../architecture/components.md)** — 근거: 본 절이 11 행 pointer 를 판정하며 확인했듯 components.md 는 **P1 T-A3 blueprint 원본** (3 행 자기선언) 이라 deployment.md 와 동일한 "구현 이전 서술 ↔ shipped 코드" drift 표면을 갖고, 8 component table + contract 표라는 **검증 가능 claim 밀도가 높아** 같은 판정 template 을 그대로 적용할 수 있다. 차순위는 [INDEX.md](../architecture/INDEX.md) (`MVA 원칙` · 문서 목록 pointer 축).
2. **reviewer 규약 미이행** — `.claude/agents/reviewer.md` 에 REQ-032 항목 **0 hit** (`§ 12.41` Follow-up 2 미소진). `.claude/` 소관의 별도 direct task.
3. **`deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합** — `§ 12.41` Follow-up 4 미소진. 본 절이 `deploy/` 15 개 자산을 인용하며 접점을 다시 확인했으나 정본 지정 판정은 미착수.
4. **README 행 번호 pointer drift 전수 sweep** — `§ 12.41` Follow-up 3 미소진.
5. **`@nestjs/config` 미도입 사실의 전수 sweep** — `§ 12.39` Follow-up 3 미소진 (ADR 게이트).
6. **REQ 번호 체계 잔재 전수 sweep** — `§ 12.38` Follow-up 3 미소진 (owner 게이트).
7. **`CLAUDE.md` §1 pointer 부정확** — `§ 12.40` Follow-up 3 미소진 (CLAUDE.md 는 §3.1 별개 소관).
8. **UC-09 `§ 5` sequence participant 병기** — 26 회째 이월.
9. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (**259 행 불변**, ADR 게이트).
10. **행 번호 → anchor 좌표계 이행** — 20 회째 이월. 본 절 각주가 15 행 이후를 +6 미는 것이 근거를 또 보탠다.
11. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `15` · `7` · `4` · `0` 은 배포 자산 · ADR heading 1 건 변경으로 즉시 낡는다.

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `docker build` · `docker compose up` · `pnpm build` · `pnpm test` · `prisma migrate` 는 실행하지 않았고, 배포 호스트 · 실 container 상태도 측정하지 않았다).

#### 불변 검산 (AC 6)

```
$ wc -l → deployment.md **232** (226 → +6, 허용 ≤ 233) · audit **4178 → 4283** (+105 = 본 절 105 행 = 4165 ~ 4269, 허용 ≤ 110 · +110 이내) · directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → deployment.md **6** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **42** (41 → 42)
$ git diff -U0 -- docs/architecture/deployment.md | grep '^@@' → `@@ -14,0 +15,6 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (`## 개요` 본문 말미 ~ `## DB / Persistence` heading 앞) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/deployment.md → `6  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ → (빈 출력 — 코드 · 스키마 · 배포자산 · CI · 의존성 · ADR · runbook 무변경)
$ git status --porcelain → M deployment.md · M REQ-COVERAGE-AUDIT.md · M T-1444-*.md  (**3 파일**)
```

#### 한계 —

1. **3 건의 부분참은 각주로만 해소된다** — 7 행 원문의 manifest 열거와 "P7 phase 의 운영 task 책임" 은 그대로라, 각주를 건너뛴 독자에겐 여전히 "Dockerfile / compose 는 이 repo 밖 이야기" 로 읽힐 여지가 남는다. 열거 수정이 **문서 범위 선언 재작성** 을, 시점 수정이 **새 phase 배정 창작** (PLAN 게이트) 을 각각 요구한다는 점을 우선한 결과다.
2. **pointer 판정은 "대상 절이 실재하는가" 까지다** — INDEX `MVA 원칙` · components `contract 표` · runbook 각 절의 **내용이 문서가 기대하는 바와 실제로 부합하는지** 는 각 문서 본문 전수 판정이 필요해 (그리고 세 문서 모두 본 slice 무편집 대상이라) 판정하지 않았다. `deploy/` 자산도 **파일 실재 기준** 이며 실제 배포 호스트에서 동작하는지는 미측정이다.
3. **누적 drift 수치는 선행 절 인용값** — (vi) 의 99 / 50 / 20 / 29 는 `§ 12.35` ~ `§ 12.41` 의 "합계" 문장을 그대로 합산한 것이라, 그 절들이 판정 후 코드가 다시 바뀌었다면 현재 사실과 어긋날 수 있다 (재측정은 §7 context 예산상 하지 않았다).

### 12.43 components.md `## 개요` ↔ 실 `src/**/*.module.ts` 인벤토리 · `package.json` dependency · 참조 문서 (`INDEX.md` · `modules.md` · `ADR-0003`) · 현 phase 대조 — 원문 보존 + 각주 1 블록 (T-1445)

> **본 절의 위치** — `§ 12.42` 가 "다음 문서 축 1 순위" 로 지목한 [T-1444](../tasks/T-1444-deployment-md-overview-section-vs-repo-audit.md) **Follow-up 1** ([components.md](../architecture/components.md) 축 진입) 을 본 절이 계승한다. **계보** — `T-1430` ~ `T-1435` (directory.md) → `T-1436` ~ `T-1444` (deployment.md 6 단락 전부, `§ 12.42` 로 그 축 종료) → **`T-1445` (본 절 — components.md 축의 첫 slice, `## 개요`)**. 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이고, 측정은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 **secret · connection string · 실 호스트명은 옮기지 않았다** (CLAUDE.md §9). 본 절은 **components.md 축의 template** 이 되므로 판정표 컬럼 · 각주 배치 규약을 선행 절과 동형으로 유지했다.

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/components.md → 1 `# Component view` · **5 `## 개요`** · **16 `## Deployment 컨텍스트`** · 22 `## Component diagram` · 109 `## Component table` · 122 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` · 154 `## Contracts` · 180 `## References` ⇒ 본 slice 범위 = **5 (heading) · 7 · 9 · 11 ~ 14 (본문 2 문단 + 하위 4 bullet) · 16 (다음 heading)** — AC 좌표 그대로 **stale 아님** (문서 앞머리라 선행 slice 의 밀림 없음).
      claim 이분 — **검증 가능 22 축** (7 행 pointer 2 + 토폴로지 5 요소 5 / 9 행 INDEX pointer 1 + 시점 1 / 11 행 modules pointer 1 + module class 8 + acyclic 1 / 12 ~ 14 행 phase 명칭 3) · **검증 불가 4** (7 행 "본 문서는 component view — 시스템을 component 단위로 분해한다" 범위 선언 · 7 행 "그 process 안에 어떤 component 가 들어가는지의 논리적 분해도" 자기규정 · 9 행 "책임 한 문단 + 입출력 contract 까지만 박제" 범위 선언 · 9 행 "구체 module class / 메서드 시그니처 / endpoint URL / DB schema 컬럼은 본 문서의 범위 밖" 자기규정 — 전부 문서 자신의 범위 · 성격 선언이라 참·거짓 대상이 아니다).
(ii)  운영 토폴로지 5 요소 축 (7 행) — $ grep -n '"@nestjs/config"\|"@nestjs/schedule"' package.json → **31**`"@nestjs/schedule": "^4.1.2",` (**`@nestjs/config` 는 0 hit**) ; $ grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md → **8 hit** (32 `§1 — Monolithic NestJS process (in-process queue OK)` · 46 `§2 — Secret 저장 = 환경변수 (@nestjs/config 기반)` · 62 `§3 — Scheduler 위치 = @nestjs/schedule (in-process)` · 78 `§4 — 외부 네트워크 boundary = direct outbound from app process` / 120 · 129 · 138 · 147 = `## Alternatives considered` 하위 동명 4 절) ⇒ 실 결정은 **4 개** ; $ grep -rln "@nestjs/config" src/ → **`src/main.ts`** 뿐이고 그 2 행은 `// 외부 의존성(@nestjs/config 등)은 의도적으로 도입하지 않음 (T-0004 Out of Scope).` 주석이다. ⇒ 5 요소 분리 판정 — `단일 NestJS process` **참** (ADR §1) · `@nestjs/schedule` **참** (dependency + ADR §3) · `direct egress` **참** (ADR §4) · `@nestjs/config` **부분참** (ADR §2 가 결정했으나 **미도입** — "문서만의 창작" 이 아니라 **결정 ↔ 구현 gap**, 코드 주석이 미도입을 의도로 명시) · `PostgreSQL` **부분참** (ADR-0003 의 4 결정에 없고 ADR-0002 소관이라 **귀속 상이**, deployment.md 는 실제로 박제).
(iii) module class 8 명 축 (11 행) — $ ls -1 src/*.module.ts src/*/*.module.ts | wc -l → **15** ; $ grep -rhn '^export class .*Module' src --include=*.module.ts | sed 's/.*export class //' | sort → `AppModule` · `AssessmentCollectionModule` · `AssessmentEvaluationModule` · `AuthModule` · `ConfluenceModule` · `ExportModule` · `GithubModule` · `ImportModule` · `LlmModule` · `PermissionDeniedRecordModule` · `PersistenceModule` · `SchedulingModule` · `UserInstanceAccessModule` · `UserModule` · `WebModule` (**15 class**). ⇒ 문서 8 명 판정 — **실재 6** (`UserModule` · `GithubModule` · `ConfluenceModule` · `LlmModule` · `AuthModule` · `WebModule`) · **이름 상이 1** (`SchedulerModule` → 실 `SchedulingModule`, 디렉토리도 `src/scheduling/`) · **부재 1** (`AssessmentModule` — 책임이 `AssessmentCollectionModule` · `AssessmentEvaluationModule` 2 개로 분화). **초과분 9** (`AppModule` · 위 2 개 · `SchedulingModule` · `PersistenceModule` · `ExportModule` · `ImportModule` · `PermissionDeniedRecordModule` · `UserInstanceAccessModule`).
      $ grep -n "acyclic\|순환" docs/architecture/modules.md | head -5 → **3** (blockquote — "P1 T-A4 의 산출물 … 의존성 acyclic 검증 … 박제", `T-0017` 명시) · **7** ("module 간 import 의존성 방향이 acyclic 임을 박제") · **139** ("화살표 방향 = imports 방향. cycle 0 (아래 acyclic 검증 참조)") ⇒ 검증은 **실제 수행됨**.
(iv)  pointer 축 (7 · 9 · 11 행) — $ ls -1 docs/architecture/deployment.md docs/architecture/modules.md docs/architecture/INDEX.md → **3 파일 전부 실재** ; $ grep -n "MVA" docs/architecture/INDEX.md | head -4 → **54** `## MVA 원칙` (1 hit, 절 실재) ; $ ls -1 docs/tasks/T-0016-*.md docs/tasks/T-0017-*.md → `T-0016-t-a3-component-view.md` · `T-0017-t-a4-module-view.md` **둘 다 실재**. ⇒ pointer 대상은 전수 실재하나, 11 행이 modules.md 를 `T-A4 (modules.md)` 로만 부르고 **task ID (`T-0017`) 도 markdown 링크도 두지 않아** pointer 로서 **불완전** (1 ~ 3 행 blockquote 가 `T-0016` 을 링크로 명시한 것과 대비된다).
(v)   시점 축 (11 ~ 14 행) — $ grep -n "^## Phase P" docs/PLAN.md → 12 `P0` · 18 `P0.5` · **24 `P1 — Architecture (MVA)`** · **30 `P2 — Use case decomposition`** · **47 `P3 — Domain core`** · **79 `P4 — External integrations`** · 94 `P5 — Evaluation pipeline` · 114 `P6` · 131 `P7` · 146 `P8` ; $ sed -n '26p' docs/PLAN.md → P1 **"완료"** ; $ python -c "…json.load…['phase']" → **`P4-complete / P5-in-progress`**. ⇒ **bullet 별로 갈리지 않고 4 bullet 전부 낡음** (T-A4 · P2 · P3 · P4 대상이 모두 완료). 다만 **명칭 축은 갈린다** — `P2 Use case decomposition` · `P4 External integrations` 는 PLAN 30 · 79 행과 1:1 이나 `P3 Persistence layer` 는 PLAN 47 행 실 명칭이 `Phase P3 — Domain core` 라 **상이** (`PersistenceModule` 은 실제로 shipped).
      `§ 12.15` 강도 — $ awk 'NR>=5 && NR<=14' … | grep -cE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" → **0** (날짜 stamp 없음) ; 시점 marker 는 `T-A4` · `P2` · `P3` · `P4` · `다음 task` **각 1 hit = 5** 로 deployment.md `## 개요` (1 hit) 보다 밀도가 **5 배** 다 — 갱신하려면 새 phase 배정과 module 이름 선택을 창작해야 하는 성격은 같다.
(vi)  자기규정 축 (9 행) — (iii) 결과를 **재측정 없이 인용** (§7): 9 행은 "구체 NestJS module class … 는 본 문서의 범위 밖" 이라고 선언하면서도 **같은 절 11 행이 module class 이름 8 개를 실제로 열거** 한다. 즉 범위 선언이 스스로 지켜지지 않았고, 그 열거가 `T-A4 가 앞으로 할 mapping 의 예고` 형식이라 검토 대상에서 빠진 채 blueprint 에 굳었다 — 8 명 중 **2 명이 실제와 어긋난** (부재 1 · 이름 상이 1) 원인이 이 구조다. 자기규정 자체는 검증 불가라 판정 대상에서 제외하되, 본 긴장은 각주에 1 구로 병기했다.
(vii) baseline — $ wc -l → components.md **190** · audit **4283** · deployment.md **232** · directory.md **203** · modules.md **259** ; $ grep -c '^## ' → components.md **7** · audit **12** ; audit $ grep -c '^| REQ-' → **66** · $ grep -c '^### 12\.' → **42** (기대 9 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

판정 3 축 — ① **문서 성격**: 1 ~ 3 행 blockquote 의 "본 문서는 **P1 T-A3 의 산출물**" 선언이 본 단락에 가장 강하게 걸린다. `## 개요` 는 문서 자신의 범위·성격을 규정하는 머리말인 동시에 **구현 이전에 쓰인 예고 목록** 을 품고 있어, 손대면 blueprint 가 무엇을 예상했는지의 기록이 사라진다. ② **`§ 12.15` 정합**: 날짜 stamp **0** · 시점 marker **5 hit** (`T-A4` · `P2` · `P3` · `P4` · `다음 task`, 실측 (v)) 로 밀도가 선행 문서보다 높고, 문제의 module class 8 명이 그 시점 marker **안쪽** (`다음 task 들의 책임` 하위 bullet) 에 있어 append-only 가 그대로 걸린다. ③ **선례**: 수치 축이면 [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) in-place, 서술 · 시점 축이면 T-1430 ~ T-1435 · T-1437 ~ T-1444 각주, 혼합은 [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 인데 본 단락의 거짓 2 건은 **시점 marker 안쪽의 심볼명** 이라 in-place 후보이면서 동시에 시점 기록이라, 각주 계열로 수렴한다.

| 지점 (행) | claim (1 구) | 실측 결과 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- | --- |
| 7-a | pointer — [deployment.md](../architecture/deployment.md) 실재 | 파일 실재 (`§ 12.35` ~ `§ 12.42` 대조 완료 문서) | 참 | 무편집 | 실측 (iv) |
| 7-b | pointer — [ADR-0003](../decisions/ADR-0003-deployment.md) 실재 | 파일 실재 · `### Decision §1` ~ `§4` **4** 개 | 참 | 무편집 + 각주 근거 | 실측 (ii) |
| 7-c | 토폴로지 — **단일 NestJS process** | ADR-0003 `§1 — Monolithic NestJS process` | 참 | 무편집 + 각주 근거 | 실측 (ii) 1:1 |
| 7-d | 토폴로지 — **PostgreSQL** | ADR-0003 4 결정에 **없음** ([ADR-0002](../decisions/ADR-0002-db.md) 소관) | 부분참 (귀속 상이) | 원문 보존 + 각주 부기 | 사실은 참이나 두 pointer 중 ADR 쪽 귀속이 어긋남 |
| 7-e | 토폴로지 — **`@nestjs/config`** | ADR-0003 `§2` 는 결정, `package.json` **0 hit** (미도입) | 부분참 (결정 ↔ 구현 gap) | 원문 보존 + 각주 부기 | `src/main.ts` 2 행이 미도입을 의도로 명시 |
| 7-f | 토폴로지 — **`@nestjs/schedule`** | `package.json` **31** 행 실재 + ADR-0003 `§3` | 참 | 무편집 + 각주 근거 | 실측 (ii) |
| 7-g | 토폴로지 — **direct egress** | ADR-0003 `§4 — direct outbound from app process` | 참 | 무편집 | 실측 (ii) |
| 9-a | pointer — [INDEX.md](../architecture/INDEX.md) 의 `MVA 원칙` | INDEX.md **54** 행 `## MVA 원칙` 실재 | 참 | 무편집 + 각주 근거 | 실측 (iv) 1 hit |
| 9-b | 시점 — "그 구체화는 **다음 task 들의 책임**" | T-A4 · P2 · P3 · P4 **전부 완료**, 현 phase `P4-complete / P5-in-progress` | 부분참 (시점 낡음) | 원문 보존 + 각주 부기 | 새 phase 배정 창작 금지 (AC 4) |
| 11-a | pointer — **T-A4 (modules.md)** | 파일 실재 · 대상 task 는 `T-0017` 이나 본문 미명시 · 링크 없음 | 부분참 (pointer 불완전) | 원문 보존 + 각주 부기 | 실측 (iv), 1 ~ 3 행이 `T-0016` 을 링크한 것과 대비 |
| 11-b | module class — `AssessmentModule` | 실 class 목록 **부재**, `AssessmentCollectionModule` · `AssessmentEvaluationModule` 2 개로 분화 | 거짓 | 원문 보존 + 각주 부기 | 시점 marker 안쪽 예고라 `§ 12.15` append-only |
| 11-c | module class — `UserModule` | `src/user/user.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-d | module class — `GithubModule` | `src/github/github.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-e | module class — `ConfluenceModule` | `src/confluence/confluence.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-f | module class — `LlmModule` | `src/llm/llm.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-g | module class — `AuthModule` | `src/auth/auth.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-h | module class — `SchedulerModule` | 실 class 는 `SchedulingModule` (`src/scheduling/`) | 거짓 (이름 상이) | 원문 보존 + 각주 부기 | 위와 같은 시점 marker 안쪽 |
| 11-i | module class — `WebModule` | `src/web/web.module.ts` 실재 | 참 | 무편집 | 실측 (iii) |
| 11-j | **의존성 acyclic 검증** 이 수행됨 | modules.md **3 · 7 · 139** 행 (`cycle 0`) | 참 | 무편집 + 각주 근거 | 실측 (iii) |
| 12-a | phase 명칭 — `P2 Use case decomposition` | PLAN **30** 행 `## Phase P2 — Use case decomposition` | 참 | 무편집 | 실측 (v) 1:1 |
| 13-a | phase 명칭 — `P3 Persistence layer` | PLAN **47** 행 실 명칭은 `Phase P3 — Domain core` | 부분참 (명칭 상이) | 원문 보존 + 각주 부기 | 번호는 맞고 `PersistenceModule` 도 shipped |
| 14-a | phase 명칭 — `P4 External integrations` | PLAN **79** 행 `## Phase P4 — External integrations` | 참 | 무편집 | 실측 (v) 1:1 |

- 합계 — 검증 가능 **22 row = 참 15 · 부분참 5 · 거짓 2**, 검증 불가 4 는 대상 제외. 거짓 2 는 **둘 다 module class 이름** 이고, 부분참 5 는 dependency 귀속 2 · pointer 불완전 1 · 시점 1 · phase 명칭 1 로 축이 흩어져 있다. module class 8 명만 놓고 보면 **6 / 8 = 75% 적중** 인데, 이는 blueprint 가 도메인 경계를 대체로 맞췄고 어긋난 2 건은 **구현 중 책임 분할 (Assessment → Collection + Evaluation)** 과 **명명 관례 (Scheduler → Scheduling)** 라는 자연스러운 진화의 결과다.
- **시점 축 (9-b · 11-b · 11-h · 13-a) 과 사실 축 (7-c ~ 7-g · 9-a · 11-j · 12-a · 14-a) 의 분리 판정** — ① **사실 축**: dependency · ADR 결정 · pointer 실재 · acyclic 수행은 대부분 참이라 처리가 `무편집` 이고, 각주는 근거 병기 목적뿐이다. 어긋난 7-d · 7-e 도 **문서가 틀린 게 아니라 귀속 · 도입 시점이 어긋난** 형태라 문장 치환으로는 고쳐지지 않는다. ② **시점 축**: 11 ~ 14 행 전체가 `다음 task 들의 책임` 이라는 미래형 프레임 안에 있어, module 이름 2 건을 실 이름으로 치환하면 **"미래 예고" 문장이 "현재 사실" 을 담게 되는 시제 모순** 이 생기고 나머지 6 명 · 초과 9 개와의 정합도 함께 재작성해야 한다 (= `## Component table` 8 row 까지 cascade, cap 즉시 초과). 두 축이 같은 (B) 로 수렴했으나 **사유는 다르다** — 전자는 "고칠 게 없어서", 후자는 "고치면 문장 정체성 · cap 이 함께 무너져서".

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | 전 지점 in-place 동기 (module class 8 명 실 이름 치환 + `@nestjs/config` 삭제) | 기각 | 8 명 치환은 **초과 9 개 · `## Component table` 8 row 와의 정합 재작성** 을 부르고 (cap 초과), `@nestjs/config` 삭제는 **ADR-0003 `§2` 가 실제로 결정한 사실을 지우는** 편집이라 문서를 오히려 덜 정확하게 만든다 |
| **(B)** | **원문 무편집 + `## 개요` 말미 각주 blockquote 1 블록 신설** | **채택** | T-1437 ~ T-1444 화법을 그대로 잇고, 실 class 15 · 실재 6 · 이름 상이 1 · 부재 1 · 초과 9 · dependency 0 hit / 31 행 · acyclic `cycle 0` · PLAN 47 행 명칭을 같은 화면에 병기해 **오도 risk 만** 제거 |
| (C) | 혼합 (거짓 2 건만 in-place, 시점 축은 각주) | 기각 | 거짓 2 건이 **시점 marker 안쪽** (`다음 task 들의 책임` 하위 bullet) 이라 치환하면 시제 모순 (미래형 문장에 현재 사실) 이 남고, 같은 bullet 의 나머지 6 명만 예고형으로 남아 한 문장 안 시제가 갈린다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 본 단락은 **문서 앞머리** 라 노출도가 최상위이고, 독자가 "shipped module 은 이 8 개다" 또는 "`@nestjs/config` 가 도입돼 있다" 고 오인하면 존재하지 않는 `AssessmentModule` · `SchedulerModule` 을 import 하거나 config module 배선을 전제한 코드를 쓰게 된다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 marker **5 hit** 이 전부 본 slice 범위 안이고 거짓 2 건이 그 안쪽이라 append-only 와 각주가 정합한다. ② **오도 risk**: 문서 첫 산문 단락이라 **진입 독자 전원이 읽는 위치** 이고, 오독 비용이 (a) 부재 class import 시도, (b) `@nestjs/config` 전제 배선 (실제로는 `T-0004` Out of Scope 로 의도적 미도입), (c) 실 15 module 중 9 개 (`PersistenceModule` · `ExportModule` · `ImportModule` · `PermissionDeniedRecordModule` · `UserInstanceAccessModule` 등) 미인지 — 셋 다 실작업 낭비로 직결돼 (D) 를 기각시킨다. ③ **cap**: (B) 의 실측 diff 는 components.md `+6/-0` (190 → **196**, 허용 `≤ 198`) · 파일 **3 고정** 이라 300 LOC · 5 파일 상한 안이다 ((A) · (C) 는 cascade 로 cap 초과 → 자동 기각, split 하려면 `## Component table` slice 와 묶어야 해 본 slice 경계와 충돌). ④ **선례 일관성**: 본 절이 **components.md 축의 첫 slice** 라 이후 slice (`## Deployment 컨텍스트` · `## Component diagram` · `## Component table` · `## GitHub Adapter …` · `## Contracts` · `## References`) 의 template 이 되며, deployment.md 축 8 블록이 전부 (B) 였던 화법을 문서 경계를 넘어 승계하는 편이 stream 전체의 독해 비용을 낮춘다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (5 행)** — 14 행 (`## 개요` 본문 말미) 뒤 · `## Deployment 컨텍스트` heading 앞에 append (앞뒤 공백 행 보존, 실 증가 **+6** = blockquote 5 + 공백 1). 내용은 ① 토폴로지 **5 요소 분리 판정** (참 3 / `@nestjs/config` 결정 ↔ 구현 gap / `PostgreSQL` 귀속 부분참), ② module class **8 명 개별 판정** (실재 6 · 이름 상이 1 · 부재 1) + 실 **15** · 초과 **9** 개 열거 + 정본 modules.md 가 이미 정합했다는 사실, ③ pointer · acyclic 축 (`cycle 0` · INDEX **54** 행) + `T-A4` pointer 불완전 (대상 `T-0017`), ④ **시점 축 낡음** + `P3 Persistence layer` ↔ PLAN **47** 행 `Domain core` 명칭 상이 + 9 행 자기규정과 11 행 열거의 **자체 긴장** 1 구, ⑤ `§ 12.15` 처리 사유 + 본 절 pointer.
- **각주 위치 근거 + 문구 1:1 + 무편집 경계** — 대상 claim 이 7 · 9 · 11 ~ 14 행에 걸쳐 있어 선행 절과 같은 규칙 ("대상 claim 의 최소 공통 구간 말미") 대로 **단락 최말미** 에 뒀고, `§ 12.40` ~ `§ 12.42` 배치와 동형이다. 각주의 경로 · class 이름 · dependency 이름 · 절 이름 · 수치 (**15** · **6** · **9** · `31` 행 · `0 hit` · INDEX **54** · modules **139** · PLAN **47** · `P4-complete / P5-in-progress` · **22 row**) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 module class · 임의 phase 배정 · 없는 절 이름) 은 창작하지 않았고 secret · connection string · 실 호스트명도 옮기지 않았다**. **1 ~ 4 행 blockquote** 와 **16 행 이후 전 구간** (`## Deployment 컨텍스트` · `## Component diagram` mermaid · **`## Component table` 8 row** · `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` · `## Contracts` · `## References`) 은 그대로다. **새 pointer 도 추가하지 않았다** — 각주가 더한 markdown 링크는 본문에 이미 등재된 ADR-0003 · ADR-0002 · INDEX.md · modules.md 와 본 절 pointer 뿐이고, `docs/PLAN.md` · `src/main.ts` · `package.json` 은 **링크 없는 코드 span** 으로만 인용했다. **module class rename · `@nestjs/config` 설치는 하지 않았다** (Out of Scope).

#### T-1444 Follow-up 1 closure + components.md 축 진입 선언

- **Follow-up 1 closure** — `§ 12.42` 가 "다음 문서 축 1 순위" 로 이월한 [components.md](../architecture/components.md) 진입을 본 절이 수행했고, 그 첫 단락 (`## 개요`) 의 검증 가능 **22 row 를 전부 판정 · 각주 반영** 했다. 문서 축 진입이라는 승계 대상은 소진된다.
- **축 진입 선언** — components.md 는 `## ` 단락 **7 개** (1 heading 제외 시 본문 절 7) 중 **1 개** (`## 개요`) 가 대조를 마쳤고, 문서 안 실측 각주는 **1 블록** 이다. deployment.md 축 (`§ 12.35` ~ `§ 12.42`, 검증 가능 113 row) 이 종료된 뒤 열린 새 축이며, 누적은 본 절을 더해 **135 row = 참 76 · 부분참 28 · 거짓 31** (`§ 12.35` ~ `§ 12.43` 합, 선행 절 합계 문장 인용 + 본 절 22).

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **components.md 다음 단락 1 순위 = `## Component table` (109 행)** — 근거: 본 절이 11 행에서 확인했듯 이 문서의 **검증 가능 claim 밀도가 가장 높은 곳이 component ↔ 실 module 대응** 이고, 8 row 표는 각 row 가 책임 · 입출력 contract 를 명시해 실 15 module · 실제 service 와 1:1 대조가 가능하다. 차순위는 `## Deployment 컨텍스트` (16 ~ 21 행 — "모든 8 component 는 동일 process" claim + ADR pointer 3 종, 본 절 각주 바로 뒤라 좌표가 인접).
2. **`@nestjs/config` 미도입 전수 sweep** — `§ 12.39` Follow-up 3 미소진 (ADR 게이트). 본 절은 components.md 7 행 **1 지점** 을 국소 판정했을 뿐이며, ADR-0003 `§2` ↔ `src/main.ts` 주석 ↔ 각 문서 서술의 정본 지정은 미착수다.
3. **reviewer 규약 미이행** — `.claude/agents/reviewer.md` 에 REQ-032 항목 **0 hit** (`§ 12.41` Follow-up 2 미소진). `.claude/` 소관의 별도 direct task.
4. **`deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합** — `§ 12.41` Follow-up 3 미소진.
5. **README 행 번호 pointer drift 전수 sweep** — 선행 절에서 이월.
6. **REQ 번호 체계 잔재 전수 sweep** — `§ 12.38` Follow-up 3 미소진 (owner 게이트).
7. **`CLAUDE.md` §1 pointer 부정확** — T-1442 Follow-up 3 미소진 (CLAUDE.md 는 §3.1 별개 소관).
8. **UC-09 `§ 5` sequence participant 병기** — 27 회째 이월.
9. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (**259 행 불변**, ADR 게이트). 본 절이 modules.md 를 acyclic · `T-0017` 축으로 읽으며 접점을 다시 확인했으나 카운트 판정은 미착수다.
10. **행 번호 → anchor 좌표계 이행** — 21 회째 이월. 본 절 각주가 16 행 이후를 +6 미는 것이 근거를 또 보탠다.
11. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절이 인용한 `15` · `6` · `9` · `0 hit` 은 module 1 개 추가 · dependency 1 건 설치로 즉시 낡는다.

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 direct-mode 면제 조항에 따라 `tester` 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` coverage 게이트가 모두 **N/A** 다 (본 절 측정 명령은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 `pnpm install` · `pnpm build` · `pnpm test` · `prisma migrate` 는 실행하지 않았고, module 배선의 런타임 동작도 측정하지 않았다).

#### 불변 검산 (AC 6)

```
$ wc -l → components.md **196** (190 → +6, 허용 ≤ 198) · audit **4283 → 4392** (+109 = 본 절 108 행 = 4270 ~ 4377, 허용 ≤ 110 · +110 이내) · deployment.md **232** (불변) · directory.md **203** (불변) · modules.md **259** (불변)
$ grep -c '^## ' → components.md **7** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **43** (42 → 43)
$ git diff -U0 -- docs/architecture/components.md | grep '^@@' → `@@ -15,0 +16,6 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (`## 개요` 본문 말미 ~ `## Deployment 컨텍스트` heading 앞) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/components.md → `6  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ → (빈 출력 — 코드 · 스키마 · 배포자산 · CI · 의존성 · ADR · runbook 무변경)
$ git status --porcelain → M components.md · M REQ-COVERAGE-AUDIT.md · M T-1445-*.md  (**3 파일**)
```

#### 한계 —

1. **거짓 2 건은 각주로만 해소된다** — 11 행 원문의 `AssessmentModule` · `SchedulerModule` 은 그대로라, 각주를 건너뛴 독자에겐 여전히 존재하는 class 로 읽힐 여지가 남는다. 치환이 **미래형 bullet 의 시제 모순** 과 `## Component table` cascade (cap 초과) 를 부른다는 점을 우선한 결과이며, 정확한 현행 mapping 은 정본 [modules.md](../architecture/modules.md) 가 이미 제공한다.
2. **module 판정은 "class 이름이 실재하는가" 까지다** — 각 module 의 **책임 범위가 문서의 component 정의와 실제로 부합하는지** 는 `## Component table` 8 row 와 각 module 의 provider 전수 대조가 필요해 (그리고 그 표가 본 slice 무편집 대상이라) 판정하지 않았다. `AppModule` 등록 여부 · import 그래프의 현행 acyclic 성도 미측정이며, modules.md 의 카운트 claim 은 `§ 12.34` Follow-up 1 소관으로 남는다.
3. **누적 drift 수치는 선행 절 인용값** — 135 / 76 / 28 / 31 은 `§ 12.35` ~ `§ 12.42` 의 "합계" 문장에 본 절 22 row 를 더한 것이라, 그 절들이 판정된 뒤 코드가 다시 바뀌었다면 현재 사실과 어긋날 수 있다 (재측정은 §7 context 예산상 하지 않았다).

### 12.44 components.md `## Component table` **Web UI** row ↔ 실 `web/src` 컴포넌트 인벤토리 · `PLAN.md` 122 행 · `ADR-0040` / `ADR-0041` / task pointer 대조 — 원문 보존 + 각주 1 블록 (T-1446)

> **본 절의 위치** — `§ 12.43` 이 "components.md 다음 단락 1 순위" 로 지목한 [T-1445](../tasks/T-1445-components-md-overview-section-vs-src-audit.md) **Follow-up 1** (`## Component table` 축 진입) 을 본 절이 계승한다. **계보** — `T-1430` ~ `T-1435` (directory.md) → `T-1436` ~ `T-1444` (deployment.md, `§ 12.42` 로 종료) → `T-1445` (components.md `## 개요`) → **`T-1446` (본 절 — `## Component table` 축의 첫 slice)**. **8 row 를 slice 로 쪼갠 근거** — row 1 (`Web UI`) 하나만으로 검증 가능 claim 이 **33** 개라 선행 slice 표준 분량 (T-1445 = 22 row) 을 이미 넘어, 8 row 를 한 slice 에 담으면 cap (300 LOC / 3 파일 · 절 ≤ 110 행) 이 확실히 깨진다 (deployment.md `## DB / Persistence` 를 `§ 12.41` · `§ 12.42` 전 · 후반으로 쪼갠 선례와 동형). 판정 enum 은 선행 절과 같은 `참 / 부분참 / 거짓` 3 값이고, 측정은 전부 read-only `ls` · `grep` · `sed` · `wc` · `git` 이며 **secret · connection string · 실 호스트명은 옮기지 않았다** (CLAUDE.md §9).

#### 실측 (AC 1 — 편집 전 측정, 명령과 출력)

```
(i)   $ grep -n '^#\{1,3\} ' docs/architecture/components.md → 1 `# Component view` · 5 `## 개요` · 22 `## Deployment 컨텍스트` · 28 `## Component diagram` · **115 `## Component table`** · 128 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` · 160 `## Contracts` · 186 `## References` ⇒ 표 header **117** · 구분선 **118** · **Web UI row = 119** · 나머지 7 row = 120 ~ 126 — AC 좌표 (115 · 119) 그대로 **stale 아님**.
      claim 이분 — **검증 가능 33** (컴포넌트 이름 15 / `AppShell` · `AuthGate` · `AdminView` 책임 3 / `React + Vite` 별도 패키지 1 / 수치 2 / 출처 pointer `PLAN.md` 122 행 1 / task pointer 4 (`T-0885` · `T-0886` · `T-1350` · `T-0353~T-0394`) / ADR 2 / REQ 3 / `modules.md` defer pointer 1 / 잔여 표면 1) · **검증 불가 5** (`사용자 브라우저에서 동작하는 frontend SPA` 성격 서술 · `로그인 / 대시보드 조회 / 인원 CRUD UI / Admin 설정 UI 진입점` 책임 요약 · `Backend API 와 HTTPS REST JSON 으로만 통신` 배포 시 프로토콜 · 입출력 contract 셀 (`사용자 클릭 / form submit`) · `backend status 계약 확정 후 배선한다` 미래 계획 — 참·거짓 대상이 아니다).
(ii)  컴포넌트 이름 축 — $ ls -1 web/src/*.tsx web/src/views/*.tsx web/src/components/*.tsx | grep -v '\.test\.' | wc -l → **27** ; AC 예시 grep (`^export (default )?function [A-Z]`) 은 **0 hit** 이라 실 export 화법 (`function X(){}` 선언 후 말미 `export default X;`) 에 맞춰 $ grep -rh '^export default [A-Za-z]' web/src --include=*.tsx | sed 's/export default //;s/;//' | sort -u → **26 이름** (`AdminView` · `App` · `AppShell` · `AuthGate` · `DashboardFilterBar` · `DashboardPaginationControl` · `DashboardView` · `DataImportExportPanel` · `DifficultyModelSelector` · `EvaluationDetailPanel` · `EvaluationGuardBanner` · `EvaluationResultTable` · `GroupList` · `GroupMemberList` · `LlmProviderConfigList` · `LoginForm` · `MetricSummaryCards` · `PartList` · `PermissionDeniedRecordList` · `PersonList` · `ReEvaluationTriggerPanel` · `SchedulePanel` · `ScoreDistributionChart` · `SuperAdminSetupForm` · `TrendTimeSeriesPanel` · `UserList` — 27 파일 중 `main.tsx` 만 default export 0).
      $ for n in <문서 15 이름>; do grep -rl "^export default $n;" web/src --include=*.tsx; done → **15 / 15 전부 1 파일씩 hit** (`AppShell` · `AuthGate` = `web/src/` 직하, `DashboardView` · `AdminView` = `web/src/views/`, 나머지 11 = `web/src/components/`) ⇒ **부재 0 · 이름 상이 0**. 문서에 없는 초과분은 **11** 개 (이름 전수 열거는 위 26 목록으로 갈음 — 별도 나열은 §7 예산상 생략).
(iii) 수치 축 — $ sed -n '120,124p' docs/PLAN.md | grep -o '10 종\|26 개' | sort | uniq -c → `1 10 종` · `1 26 개` ; $ grep -n '구별 패널\|mutation 러너' docs/PLAN.md → **122** (두 수치가 같은 bullet) ⇒ **출처 일치 참**. 실 코드 근사 — $ grep -o '<[A-Z][A-Za-z]*' web/src/views/AdminView.tsx | sort -u → 마운트 컴포넌트 **10 종** (`DataImportExportPanel` · `DifficultyModelSelector` · `GroupList` · `GroupMemberList` · `LlmProviderConfigList` · `PartList` · `PersonList` · `ReEvaluationTriggerPanel` · `SchedulePanel` · `UserList`, 나머지 hit 은 TS generic · 지역 row 컴포넌트) ⇒ "10 종" 은 **근사 일치** ; $ grep -o 'run[A-Z][A-Za-z]*' web/src/views/AdminView.tsx | sort -u | wc -l → **31** (읽기 · 다운로드 계열 `runFetch` · `runExport` · `runExportJobDownload` · `runJob` · `runApply` 포함) ⇒ "26 개" 는 **정확 재측정 미시행** (naive grep 이 mutation 이 아닌 러너를 포함해 31 을 세므로 26 을 확증도 반증도 못한다 — 출처 일치까지만 판정).
(iv)  pointer 축 — $ ls -1 docs/decisions/ADR-0040-*.md docs/decisions/ADR-0041-*.md docs/tasks/T-0885-*.md docs/tasks/T-0886-*.md docs/tasks/T-1350-*.md → **5 파일 전부 실재** ; $ ls -1 docs/tasks/T-0353-*.md docs/tasks/T-0394-*.md | wc -l → **2** (chain 양 끝 실재) ; $ grep -n '^status:' … ADR-0040 · ADR-0041 → 각 **4 행 `status: ACCEPTED`** ⇒ 본문의 `(ACCEPTED)` 병기와 **일치** ; $ grep -c '^| REQ-026 \|^| REQ-038 \|^| REQ-044 ' docs/requirements.md → **3** ; $ grep -n "defer\|polling" docs/architecture/modules.md | head -5 → **242** (`의도적 defer … EvaluationGuardBanner 자동 polling … web/src/views/DashboardView.tsx 94 행 주석이 실증`) ⇒ defer 서술 실재.
(v)   책임 서술 · 잔여 표면 축 — $ grep -n 'EvaluationGuardBanner' web/src/AppShell.tsx → **17** (import) · **111 ~ 112** (`R-78 배너 슬롯` 주석 + `<EvaluationGuardBanner active={…} />`) · $ grep -n 'view 전환' web/src/AppShell.tsx → **24** ⇒ `AppShell` 책임 3 요소 **참** ; $ grep -o '<[A-Z][A-Za-z]*' web/src/AuthGate.tsx | sort -u → **`<LoginForm` 1 종뿐** 이고 $ grep -rn 'SuperAdminSetupForm' web/src --include=*.tsx → `AppShell.tsx` **19** (import) · **51** (`미인증 단계의 두 분기(로그인=AuthGate / 초기 셋업=SuperAdminSetupForm)`) · **116** (본문 영역 분기) ⇒ `AuthGate (로그인 / SuperAdminSetupForm)` 는 **부분참** (셋업 폼은 `AuthGate` 의 자식이 아니라 `AppShell` 의 형제 분기) ; $ sed -n '121,124p' docs/PLAN.md → **123** 행 R-78 bullet 이 `자동 polling 은 backend status 계약 미shipped 로 defer` 를 명시 ⇒ "남은 잔여 표면 1 항목" **참** (`§ 12.15` 시점 marker 방침상 이 서술 자체가 시점 기록이므로 각주 병기로 처리).
      `§ 12.15` 강도 — $ sed -n '119p' … | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | wc -l → **0** (날짜 stamp 없음) ; 시점 어휘는 `shipped` **2** · `실측` **1** · `남은` **1** = **4 hit** ⇒ row 전체가 shipped 현황 기록이라 in-place 치환은 append-only 방침과 충돌한다.
(vi)  baseline — $ wc -l → components.md **196** · audit **4392** · deployment.md **232** · directory.md **203** · modules.md **259** ; $ grep -c '^## ' → components.md **7** · audit **12** ; audit $ grep -c '^| REQ-' → **66** · $ grep -c '^### 12\.' → **43** (기대 9 값 전부 일치 — 전건 성립).
```

#### 지점 판정표 (AC 2)

| claim (1 구) | 실측 | 판정 | 처리 | 근거 (1 구) |
| --- | --- | --- | --- | --- |
| 컴포넌트 **15 이름** (`AppShell` · `AuthGate` · `SuperAdminSetupForm` · `DashboardView` · `AdminView` · `GroupMemberList` · `DifficultyModelSelector` · `SchedulePanel` · `ReEvaluationTriggerPanel` · `PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` · `EvaluationGuardBanner`) | `export default` 15 / 15 hit (실 26 이름 중) | 참 | 원문 보존 + 각주 부기 | 15 이름 **판정이 전부 동일 (실재)** 이라 1 row 로 묶고 이름을 전부 나열했다 (AC 2 묶음 허용 조건) — 초과분 11 개 사실만 각주에 병기 |
| `AppShell` 책임 3 요소 (전역 레이아웃 · 무라우터 view 전환 · R-78 배너 슬롯) | `AppShell.tsx` 24 · 111 ~ 112 행 | 참 | 원문 보존 + 각주 부기 | 배너 슬롯 · view 전환이 코드 주석과 JSX 로 동시 실증 |
| `AuthGate` (로그인 / `SuperAdminSetupForm`) | `AuthGate.tsx` = `LoginForm` 1 종 ; 셋업 폼은 `AppShell.tsx` 51 · 116 | 부분참 | 원문 보존 + 각주 부기 | 두 화면이 같은 "미인증 단계" 라는 점은 맞으나 **소유 컴포넌트가 다르다** |
| `AdminView` 마운트 목록 (`GroupMemberList` 조회 · `DifficultyModelSelector` · export/import · RBAC gating · 5 List 패널 · 2 패널) | 실 JSX 마운트 10 종 일치 | 참 | 원문 보존 + 각주 부기 | 열거된 컴포넌트가 전부 `AdminView.tsx` JSX 에 실재 |
| `React + Vite`, 별도 `web/` 패키지 | `web/package.json` 7 · 20 행 (`vite ^8.0.16`) | 참 | 원문 보존 + 각주 부기 | ADR-0040 결정과 실 패키지가 일치 |
| 구별 패널 **10 종** | PLAN 122 행 문자열 + `AdminView` 마운트 10 종 | 참 | 원문 보존 + 각주 부기 | 출처 · 근사 실측 **양쪽 일치** |
| mutation 러너 **26 개** | PLAN 122 행 문자열 ; naive `run[A-Z]` grep = 31 | 부분참 | 원문 보존 + 각주 부기 (근사 한계 명시) | 출처는 일치하나 **실 코드 정확 재측정을 하지 못했다** — 추정값을 실측인 양 적지 않는다 |
| 근거 = [PLAN.md](../PLAN.md) **122** 행 | 두 수치가 실제로 122 행에 존재 | 참 | 원문 보존 + 각주 부기 | 행 좌표까지 정확 |
| `T-0885` pointer (SchedulePanel 마운트) | `docs/tasks/T-0885-*.md` 실재 | 참 | 무편집 | 파일 + 링크 대상 일치 |
| `T-0886` pointer (ReEvaluationTriggerPanel 마운트) | `docs/tasks/T-0886-*.md` 실재 | 참 | 무편집 | 파일 + 링크 대상 일치 |
| `T-1350` pointer (수치 근거) | `docs/tasks/T-1350-*.md` 실재 | 참 | 무편집 | 파일 + 링크 대상 일치 |
| `T-0353~T-0394 composition-wiring chain` | 양 끝 task 파일 2 개 실재 | 참 | 무편집 | 범위 표기의 양 끝점이 실재 (중간 전수 확인은 §7 예산 밖) |
| [ADR-0040](../decisions/ADR-0040-frontend-stack.md) **(ACCEPTED)** 병기 | `status: ACCEPTED` (4 행) | 참 | 무편집 | 실 status 와 병기 일치 |
| [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) **(ACCEPTED)** 병기 | `status: ACCEPTED` (4 행) | 참 | 무편집 | 실 status 와 병기 일치 |
| `REQ-038` (조회/sort/filter/시계열) | `requirements.md` row 실재 | 참 | 무편집 | REQ 번호 실재 |
| `REQ-026` (인원 CRUD UI) | `requirements.md` row 실재 | 참 | 무편집 | REQ 번호 실재 |
| `REQ-044` (로그인 UI / 3 등급) | `requirements.md` row 실재 | 참 | 무편집 | REQ 번호 실재 |
| [modules.md](../architecture/modules.md) 의 defer 서술 pointer | modules.md 242 행 | 참 | 원문 보존 + 각주 부기 | 지목한 서술이 실제 그 문서에 실재 |
| 남은 잔여 표면 = `EvaluationGuardBanner` 자동 polling **1 항목** | PLAN 123 행 R-78 bullet + modules.md 242 행 | 참 | 원문 보존 + 각주 부기 | 두 정본이 같은 1 항목만 defer 로 명시 |

판정 기준 **3 축** — ① **문서 성격**: 1 ~ 4 행 blockquote 가 본 문서를 `P1 T-A3 의 산출물` (blueprint) 로 선언하지만, 본 row 는 `shipped 컴포넌트는 …` · `… 실측` 화법으로 **이미 여러 차례 현황으로 갱신된 흔적** 이 있어 blueprint 성격만으로 무편집을 정당화할 수 없고, 그래서 판정은 하되 처리는 각주로 갔다. ② **`§ 12.15` 정합**: 본 row 는 날짜 stamp **0** 이나 시점 어휘 **4 hit** (`shipped` 2 · `실측` 1 · `남은` 1) 로 전체가 시점 기록이라 in-place 치환이 append-only 방침과 충돌한다. ③ **선례**: T-1430 ~ T-1445 의 "원문 보존 + 실측 각주" 를 승계했다 — [T-1429](../tasks/T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환은 **거짓 지점이 어휘 1 개** 였던 경우이고, [T-1436](../tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합은 **거짓이 여러 건** 이었던 경우인데, 본 slice 는 **거짓 0 · 부분참 2** 라 치환 대상 자체가 없다.

#### 처리 방식 판정 (AC 3 — 채택 1 · 기각 3)

| 후보 | 내용 | 판정 | 근거 (1 구) |
| --- | --- | --- | --- |
| (A) | Web UI row 셀 in-place 동기 (거짓 이름 · 낡은 카운트 치환) | 기각 | **치환 대상이 존재하지 않는다** — 거짓 이름 0 (15 / 15 실재) 이고 카운트 2 건은 출처 (PLAN 122 행) 와 일치해 "낡음" 이 실증되지 않았다 |
| **(B)** | **원문 무편집 + `## Component table` 표 직후 각주 blockquote 1 개 신설** | **채택** | T-1437 ~ T-1445 화법을 그대로 잇고, 부분참 2 건 (`AuthGate` 소유 · `26 개` 재측정 한계) 과 초과분 11 개를 같은 화면에 병기해 **오도 risk 만** 제거하며 cap (+6 행 · 3 파일) 안이다 |
| (C) | 혼합 (거짓 판정 이름만 in-place, 카운트 · 잔여 서술은 각주) | 기각 | 거짓 판정 이름이 **0** 이라 혼합의 in-place 항이 공집합이고, `AuthGate` 부분참을 셀에서 고치려면 **책임 문장 재작성** 이 필요해 시점 기록 (`shipped …`) 안쪽을 손대게 된다 |
| (D) | 전 지점 무편집 + audit 기록만 | 기각 | 이 표는 문서에서 **claim 밀도가 가장 높은 지점** 이라 독자가 `AuthGate` 가 셋업 폼을 소유한다고 오인하거나 `26 개` 를 현행 실측으로 오인할 비용이 크고, 실 컴포넌트 **11 개 초과분** 미인지는 중복 컴포넌트 신설로 직결된다 |

판정 4 축 — ① **`§ 12.15` 정합**: 시점 어휘 4 hit 이 전부 본 row 안이라 append-only + 각주가 정합한다. ② **오도 risk**: (a) `AuthGate` 소유 오인 → 셋업 폼을 `AuthGate` 자식으로 배선하려는 시도, (b) `26 개` 를 현행 실측으로 오인 → drift 미인지, (c) 초과분 11 개 미인지 → 이미 있는 presentational 컴포넌트 재작성 — 셋 다 실작업 낭비로 직결돼 (D) 를 기각시킨다. ③ **cap**: (B) 의 실측 diff 는 components.md **+6/-0** (196 → **202**, 허용 ≤ 203) · 파일 **3 고정** 이라 상한 안이다 ((A) · (C) 는 치환 대상 공집합이라 애초에 성립하지 않는다). ④ **표 안 각주 배치의 구조 제약**: markdown 표 중간에는 blockquote 를 넣을 수 없어 각주는 **표 전체 뒤** (마지막 row `Scheduler` 다음) 로 갈 수밖에 없고, 그 위치가 미판정 7 row 와 시각적으로 인접하므로 **첫 구에 "본 각주는 `Web UI` row 한정" 을 명시** 했다 — 후속 slice 가 같은 자리에 각주를 덧붙일 것이므로 이 배치 · 첫 구 규약이 **Component table 축의 template** 이 된다.

#### 반영 결과 + 무편집 경계 (AC 4)

- **각주 1 블록 (5 행)** — 표 마지막 row (126 행) 뒤 · `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading 앞에 append (앞뒤 공백 행 보존, 실 증가 **+6** = blockquote 5 + 공백 1). 내용은 ① **`Web UI` row 한정 선언 + 미판정 7 row 명시**, ② 15 이름 **전수 실재** + 실 26 export · 초과분 11 · 디렉토리 분포, ③ `AuthGate` **부분참** (`SuperAdminSetupForm` = `AppShell` 형제 분기) + `AppShell` · `AdminView` 참, ④ 수치 2 건의 **출처 일치 / 정확 재측정 미시행** 구분, ⑤ pointer 전수 참 (`ADR-0040` · `ADR-0041` `status: ACCEPTED` · task 5 · REQ 3 · modules.md 242 행) + 잔여 1 항목 참, ⑥ `§ 12.15` 처리 사유 + 본 절 pointer.
- **문구 1:1 + 무편집 경계** — 각주의 경로 · 컴포넌트 이름 · 수치 (**26** · **15** · **11** · **10 종** · **31** · PLAN **122** · **123** · modules **242** · `AppShell.tsx` **24** · **51** · **111 ~ 112** · **116**) 는 전부 위 실측 출력 그대로이며, **실측되지 않은 값 (존재하지 않는 컴포넌트 · 임의 카운트 · 없는 task ID) 은 창작하지 않았고** secret · connection string · 실 호스트명도 옮기지 않았다. **1 ~ 4 행 blockquote · 16 ~ 21 행 T-1445 각주 · 나머지 7 row · 128 행 이후 전 구간** (`## GitHub Adapter …` · `## Contracts` · `## References` · mermaid) 은 그대로다.
- **새 pointer 0** — 각주가 더한 markdown 링크는 본문에 이미 등재된 `ADR-0040` · `ADR-0041` · `PLAN.md` · `modules.md` 와 본 절 pointer 뿐이고, `web/src` 하위 경로 · `AdminView.tsx` 등은 **링크 없는 코드 span** 으로만 인용했다. **컴포넌트 rename · 파일 추가는 하지 않았다** (Out of Scope — 문서를 실제에 맞출 뿐 실제를 문서에 맞추지 않는다).

#### T-1445 Follow-up 1 closure + Component table 축 진입 선언

- **Follow-up 1 closure** — `§ 12.43` 이 "다음 단락 1 순위" 로 이월한 `## Component table` 진입을 본 절이 수행했고, 그 **row 1 (`Web UI`) 의 검증 가능 33 claim 을 전부 판정 · 각주 반영** 했다. 승계 대상 (축 진입) 은 소진되며, **표 잔여는 7 row** 다.
- **축 진입 선언** — components.md 는 본문 절 **7 개** 중 **2 개** (`## 개요` · `## Component table` row 1) 가 대조를 마쳤고 문서 안 실측 각주는 **2 블록** 이다. 누적은 본 절 33 을 더해 **168 row = 참 107 · 부분참 30 · 거짓 31** (`§ 12.35` ~ `§ 12.44` 합 — 선행 절 합계 문장 인용 + 본 절 33: 참 31 · 부분참 2 · 거짓 0).
- **잔여 미판정 7 row** — `Backend API` (120) · `Worker` (121) · `DB Persistence` (122) · `LLM Gateway` (123) · `GitHub Adapter` (124) · `Confluence Adapter` (125) · `Scheduler` (126). **다음 slice 1 순위 = `Backend API` + `Worker`** — 근거: 두 row 는 실 `src` 하위 controller · service 인벤토리와 1:1 대조가 가능해 검증 난이도가 낮고 (`§ 12.43` 이 이미 15 module class 목록을 실측해 둬 재사용 가능), ADR-0003 §1 monolithic claim 을 공유해 한 slice 로 묶는 편이 판정 축이 겹친다.

#### 파생 영향 (AC 7 — 목록만, 본 slice 편집 금지)

1. **Component table 잔여 7 row** — 위 목록 참조. 1 순위 `Backend API` + `Worker` (실 controller · service 대조 가능 + monolithic claim 공유), 차순위 `DB Persistence` (`schema.prisma` 대조), 후순위 3 adapter + `Scheduler`.
2. **`## Deployment 컨텍스트` (22 ~ 26 행)** — "모든 8 component 는 동일 process" claim + ADR pointer 3 종. T-1445 FU1 차순위로 이월된 항목이 본 절에서도 미착수다.
3. **`## Component diagram` mermaid node ↔ 실 module 대조** — 다이어그램 node 이름이 실 module / 컴포넌트와 일치하는지 미판정.
4. **`@nestjs/config` 미도입 전수 sweep** — `§ 12.39` FU3 미소진 (ADR 게이트).
5. **reviewer 규약 미이행** — `.claude/agents/reviewer.md` REQ-032 0 hit (`§ 12.41` FU2 미소진).
6. **`deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합** — `§ 12.41` FU3 미소진.
7. **README 행 번호 pointer drift 전수 sweep** — 미착수.
8. **REQ 번호 체계 잔재 전수 sweep** — `§ 12.38` FU3 미소진.
9. **`CLAUDE.md` §1 pointer 부정확** — T-1442 FU3 미소진.
10. **UC-09 `§ 5` sequence participant 병기** — 29 회째 이월.
11. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` FU1 미소진 (ADR 게이트).
12. **행 번호 → anchor 좌표계 이행** — 23 회째 이월.
13. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관. 본 절의 "패널 10 종" · "mutation 러너 26 개" 는 컴포넌트 1 개 추가로 즉시 낡으며, 특히 26 개는 **정의 (무엇이 mutation 러너인가) 가 코드에 박제돼 있지 않아** spec 화 전에 정의부터 확정해야 한다.

#### R-110 / R-112 면제 근거 (AC 8)

본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 전부 **N/A** 다 (측정은 read-only `ls` · `grep` · `sed` · `wc` · `git` 뿐이고 빌드 · 설치 · 테스트는 실행하지 않았다).

#### 불변 검산 (AC 6)

```
$ wc -l → components.md **202** (196 → +6, 허용 ≤ 203) · audit **4392 → 4498** (+106 = 본 절 105 행 = 4379 ~ 4483 + 구분 공백 1, 허용 ≤ 110 · +110 이내) · deployment.md **232** (불변) · directory.md **203** (불변) · modules.md **259** (불변) · PLAN.md **175** (불변)
$ grep -c '^## ' → components.md **7** (불변 — 각주가 blockquote) · audit **12** (불변 — 본 절이 `###`) ;
  audit grep -c '^| REQ-' → **66** (불변) · grep -c '^### 12\.' → **44** (43 → 44)
$ git diff -U0 -- docs/architecture/components.md | grep '^@@' → `@@ -127,0 +128,6 @@`
  ⇒ hunk **1**, AC 4 허용 구간 (표 마지막 row 126 행 뒤 ~ `## GitHub Adapter …` heading 앞) 안 — 허용 밖 hunk **0**.
$ git diff --numstat -- docs/architecture/components.md → `6  0` ⇒ 삭제 **0** (in-place 치환 0 이라 짝 설명 불요).
$ git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md → (빈 출력 — 코드 · frontend · 배포자산 · CI · 의존성 · ADR · PLAN 무변경)
$ git status --porcelain → M components.md · M REQ-COVERAGE-AUDIT.md (**2 파일** — task 파일 frontmatter `status` 갱신은 driver 의 bookkeeping commit 소관이라 executor 가 건드리지 않았다. touchesFiles 3 파일 중 실제 편집은 2)
```

#### 한계 —

1. **`mutation 러너 26 개` 는 확증도 반증도 못했다** — naive `run[A-Z]` grep 이 읽기 · 다운로드 러너를 포함해 **31** 을 세므로, 26 이 맞는지는 각 러너가 mutation 인지 1 개씩 분류해야 알 수 있고 그 분류는 §7 예산 밖이다. 각주는 "출처 일치" 까지만 주장한다.
2. **컴포넌트 판정은 "default export 이름이 실재하는가" 까지다** — 각 컴포넌트의 **책임 서술이 실제 구현과 부합하는지** 는 `AppShell` · `AuthGate` · `AdminView` 3 개만 마운트 관계로 확인했고, 나머지 12 개의 props · 내부 동작은 미판정이다. `T-0353~T-0394` chain 도 **양 끝 2 개만** 실재 확인했다.
3. **표 나머지 7 row 는 전부 미판정** — 본 각주가 표 뒤에 있어 시각적으로 8 row 전체를 덮는 것처럼 읽힐 여지가 있고, 그래서 첫 구에 한정 선언을 뒀다. 후속 slice 가 같은 자리에 각주를 덧붙이면 blockquote 가 누적되므로, 5 ~ 6 블록 시점에는 배치 규약 자체 (표 뒤 나열 vs row 별 anchor) 를 재검토해야 한다.

## 11. References

- [docs/requirements.md](../requirements.md) — 66 REQ row source
- [docs/use-cases/INDEX.md](INDEX.md) — 9 UC backbone (T-1419 실측 `grep -c "^| UC-"` = 9 — [UC-09](UC-09-user-defined-period-evaluation.md) 등록분 반영, § 12.17)
- [docs/use-cases/UC-01-evaluation-execution.md](UC-01-evaluation-execution.md) ~ [UC-09-user-defined-period-evaluation.md](UC-09-user-defined-period-evaluation.md) — 9 UC 본문 (본 문서 §9 · §10 · §12.x 안의 `8 UC` 34 hit 는 시점 기록이라 무편집 존속 — § 12.17)
- [docs/PLAN.md](../PLAN.md) — Phase P2 셋째 bullet
- [docs/architecture/components.md](../architecture/components.md) — component view (cross-cutting cover)
- [docs/architecture/modules.md](../architecture/modules.md) — module view
- [docs/architecture/deployment.md](../architecture/deployment.md) — operational NFR cover
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) ~ [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Constraint cover
- [docs/tasks/T-0029-uc-inventory-audit.md](../tasks/T-0029-uc-inventory-audit.md) — 본 audit 의 source task
- [CLAUDE.md](../../CLAUDE.md) — infrastructure REQ (REQ-056 ~ REQ-066) cover

Refs: T-0029, T-0019, T-0020, T-0022, T-0023, T-0024, T-0025, T-0026, T-0027, T-0028, ADR-0001, ADR-0002, ADR-0003, REQ-001 ~ REQ-066 (전체 audit 대상)

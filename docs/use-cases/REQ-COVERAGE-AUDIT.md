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

**audit 결과 요약** — 8 UC 의 `coversReq` 합집합이 functional REQ 의 거의 전부를 cover. **gap 1 건** (REQ-004 — 사용자 지정 기간 임의 평가문 요청 흐름) 검출. cross-cutting 4 건 / infrastructure 13 건 / uc-covered 48 건. P2 셋째 bullet closure 안전 — 단, REQ-004 gap 의 follow-up task 권장 (§6 참조). 2026-08-02 재판정: §9 참조.

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
- **`docs/use-cases/INDEX.md` 104 행** 의 audit closure 요약은 본 절과 동기화하지 않았다 (본 slice scope 밖 — task Follow-ups 참조).

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
| (e) | `docs/use-cases/INDEX.md` 118 행 | `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` | (c) · (d) 발동 후 그 결과 수치를 옮겨 적을 때 |
| (f) | `docs/PLAN.md` 36 행 | `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` + gap 1 건 서술 | (e) 와 동일. gap count 가 바뀌면 gap 서술 문장도 함께 |

§9.4 · §10 의 이전 요약 문장은 **cascade 갱신 대상이 아니다** — append-only 규약상 각 시점 판정을 그대로 보존하고 이후 상태는 새 bullet 이 가리킨다 (214 행이 200 · 209 행에 대해 쓴 시점 구분 화법이 정본).
2026-08-03 (T-1412): INDEX.md 의 UC-09 row · description 등록으로 (e) 지점 행 번호가 110 → 118 로 이동 (수치 문자열 무변). §12.6 ~ §12.10 본문의 `110 행` 표기는 시점 기록이라 append-only 규약대로 보존.
2026-08-03 (T-1413): §4 에 UC-09 bullet 1 행 삽입으로 편집 전 114 행 이하가 +1 (본 각주 이후 구간은 +2) 이동 — (b) · (c) · (d) 셀의 행 pointer 와 현재 값을 동기했다. §9 · §10 · §12.6 ~ §12.10 본문의 `115 행` · `121 ~ 127 행` · `L212` 등 옛 행 표기는 시점 기록이라 append-only 규약대로 보존.

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

## 11. References

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

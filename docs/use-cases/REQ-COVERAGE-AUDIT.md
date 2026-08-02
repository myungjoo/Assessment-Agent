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
| REQ-004 | FR | gap | — | 사용자 지정 기간 임의 평가문 — UC-01 cron / manual 둘 다 cover 안 함. §6 follow-up · 2026-08-02 재판정: §9 참조 |
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

8 UC 의 coversReq union: 33 REQ. envelope 잔차 15 REQ 포함 시 uc-covered 48 REQ. 합 = 33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66 (역산 일치 → §5 참조).

> 위 envelope 잔차 **15** 와 UC-01 bullet 이 나열한 envelope-cover **13** 건의 차이 2 건은 REQ-031 · REQ-034 다 — 106 행 bullet 은 이 둘을 `adjacent` 로 적었으나 §3 매트릭스는 `uc-covered` 로 분류한다. 즉 13 과 15 는 모순이 아니라 나열 기준 (bullet 서술 vs 매트릭스 분류) 의 차이이며, 본 요약 행의 anchor 는 **§3 매트릭스 실측** 이다. 2026-08-02 재판정 (T-1395) 결과 이 anchor 는 **유지** — 65 · 68 행이 `인접` 을 근거로 적으면서 분류는 `uc-covered` 로 두므로 `adjacent` 는 `uc-covered` 의 배제 사유가 아니라 하위 근거이며, bullet 의 `adjacent` 표기와 매트릭스 분류는 양립한다 (§10 참조).

## 5. 분류별 요약 통계

| 분류 | count | percentage | 비고 |
| --- | --- | --- | --- |
| `uc-covered` | 48 | 73 % | 33 REQ 가 1+ UC 의 coversReq 직접 명시 + 15 REQ 가 UC envelope 내부 algorithmic / data-model cover |
| `cross-cutting` | 4 | 6 % | REQ-002 (Web Interface) / REQ-003 (생성+저장+표시 meta) / REQ-029 (non-volatile NFR) / REQ-047 (perf NFR) |
| `infrastructure` | 13 | 20 % | REQ-001 / REQ-017 / REQ-056 ~ REQ-066 (운영·CI·agent 정책) |
| `gap` | 1 | 2 % | REQ-004 (사용자 지정 기간 임의 평가문) — §6 follow-up · 2026-08-02 재판정: §9 참조 |
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
- **미검증 축** (열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404) 갱신분이다 — 아래 214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형) — envelope-cover 판정의 **의미적** 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), `adjacent` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함) → **해소** (217 행 T-1395), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · coversReq union 33/33), §3 매트릭스 66 row 분류 자체의 재판정 → **미해소 — 유일 잔여 축** (cascade 설계 선행 필요), 위 수치 오차 3 건의 실제 정정 → **해소** (213 행 T-1394).
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
| (b) | §4 106 ~ 113 행 8 UC bullet | UC 별 coversReq / adjacent / envelope-cover 나열 8 줄 | `→ uc-covered` 또는 `uc-covered →` 전이일 때만 (해당 UC bullet 의 envelope · adjacent 나열 증감) |
| (c) | §4 115 행 정합식 | `33 + 15 + 4 + 13 + 1 = 66` | 4 항 중 하나라도 증감하는 전이 전부. 33 (frontmatter union) 은 UC frontmatter 를 고치지 않는 한 불변이라 실제로 움직이는 것은 15 / 4 / 13 / 1 항 |
| (d) | §5 121 ~ 127 행 표 count 4 값 + 합계 row | `48 / 4 / 13 / 1` · `73 / 6 / 20 / 2 %` · 합계 `**66**` · `**100 %**` + 비고 셀 | (c) 와 동일 트리거. 합계 66 · 100 % 는 row 수 불변이라 **항상 무변**, percentage 4 값은 반올림 재산출 필요 |
| (e) | `docs/use-cases/INDEX.md` 110 행 | `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` | (c) · (d) 발동 후 그 결과 수치를 옮겨 적을 때 |
| (f) | `docs/PLAN.md` 36 행 | `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` + gap 1 건 서술 | (e) 와 동일. gap count 가 바뀌면 gap 서술 문장도 함께 |

§9.4 · §10 의 이전 요약 문장은 **cascade 갱신 대상이 아니다** — append-only 규약상 각 시점 판정을 그대로 보존하고 이후 상태는 새 bullet 이 가리킨다 (214 행이 200 · 209 행에 대해 쓴 시점 구분 화법이 정본).

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

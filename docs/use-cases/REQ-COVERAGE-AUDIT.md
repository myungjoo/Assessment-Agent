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
- **미검증 축** — envelope-cover 판정의 **의미적** 타당성, `adjacent` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지, §3 매트릭스 66 row 분류 자체의 재판정, 위 수치 오차 3 건의 실제 정정.
- **2026-08-02 정정 반영 (T-1394)** — 위 수치 오차 3 건을 §3 매트릭스 66 row 실측 (uc-covered 48 / frontmatter unique union 33 → envelope 잔차 15) 을 유일한 anchor 로 정정했다: §4 요약 행 union `31 → 33` · envelope `13 → 15` (합산식도 `33 + 15 + 4 + 13 + 1 = 66` 으로 닫힘), §5 `uc-covered` 비고 셀 분해 `31 직접 + 17 envelope → 33 직접 + 15 envelope` (count 48 · 73 % 는 무수정).
- 따라서 위 200 행 blockquote 의 "정정도 하지 않았다" 와 209 행의 "정정은 Follow-up 으로 넘긴다" 는 **T-1393 시점 (정정 전) 서술** 이며, 본 bullet 이 그 이후 상태 (수치 정정 완료 · 분류 판정은 여전히 미변경) 를 가리킨다.
- **2026-08-02 귀속 재판정 (T-1395)** — 축 A (`grep -n "^coversReq" docs/use-cases/UC-0*.md`): UC-01 `adjacentReq` 4 건 중 REQ-008 → UC-08 · REQ-032 → UC-07 은 다른 UC 의 `coversReq` 에 직접 명시되고 REQ-031 · REQ-034 는 8 UC 어디에도 직접 명시가 **없다** (기대값과 일치). 축 B (UC-01 본문): REQ-031 은 71 · 80 행 (§5 Main flow 의 sequence Note 2 곳) + 173 행 (§10 관련 REQ 표) **3 건**, REQ-034 는 130 행 (§8 Postconditions) + 175 행 (§10 관련 REQ 표) **2 건** 으로 **양쪽 다 본문 근거 0 건이 아니다**. 축 C (§3 근거 셀 원문): `| REQ-031 | FR | uc-covered | UC-01 (인접, P5 알고리즘) | … — UC-01 adjacentReq + §5 step 9 |` · `| REQ-034 | FR | uc-covered | UC-01 (인접, P5 trigger) | … — UC-01 adjacentReq |` — 두 row 모두 **`인접`(adjacent) 을 근거로 제시한 채 분류는 `uc-covered`** 다.
- 종합 판정 **(가) 매트릭스 유지** — 축 C 가 보이듯 §3 분류 체계에서 `adjacent` 는 `uc-covered` 의 **배제 사유가 아니라 하위 근거** 이고 (축 A 의 REQ-032 가 대조군: adjacent 이면서 UC-07 coversReq 로도 uc-covered), 축 B 가 UC-01 본문 실 서술 근거를 확인해 envelope cover 를 뒷받침한다. 따라서 §4 106 행 bullet 의 `adjacent` 표기 (frontmatter 축) 와 §3 65 · 68 행의 `uc-covered` 분류 (cover 실체 축) 는 서로 다른 축의 표기이며 모순이 아니다 — 매트릭스 row · bullet · §4 115 행 정합식 · §5 count 전부 **무수정**, 117 행 blockquote 의 미판정 문장만 본 판정 결과로 교체했다.
- 위 두 bullet 로 212 행 "미검증 축" 이 열거한 항목 중 `adjacent 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함)` 은 **2026-08-02 부로 해소** 된다. 같은 행의 나머지 축 (envelope-cover 의 의미적 타당성 · UC 본문 §5/§6/§8 의 frontmatter 대비 전수 검증 · 66 row 분류 자체의 재판정) 은 **미해소로 존속** 하며, 수치 오차 3 건 정정은 213 행 (T-1394) 에서 이미 완료됐다.

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

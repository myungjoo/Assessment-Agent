# Requirements Traceability — README → REQ-NNN

본 문서는 [README.md](../README.md) 의 모든 지시사항을 **추적 가능한 REQ-NNN ID** 로 박제하고, 각 REQ 가 어느 phase / task / code / test 에서 구현·검증되는지 1:1 매핑하는 표다.

## 운영 룰

- **단일 source of truth**: README 의 새 지시 / 수정 / 삭제는 본 문서의 매핑에도 즉시 반영 (planner 가 README 변경을 감지하면 REQ row 갱신).
- **kind enum**: `FR` (Functional Requirement — 사용자 시나리오 / 기능 / 행동) / `NFR` (Non-Functional Requirement — 성능·보안·가용성·확장성·UX 품질) / `Constraint` (외부 제약 — 사용 가능 stack / 외부 시스템 / 정책 / 법적 / 운영).
- **상태 enum**: `PLANNED` (PLAN.md 에 bullet 으로 등록) / `IN_PROGRESS` (대응 task 진행 중) / `DONE` (대응 PR merge 됨) / `BLOCKED` (humanQuestion 발생) / `SUPERSEDED` (해당 REQ 가 다른 REQ 로 대체됨).
- **검증 위치 enum**: `unit` / `smoke` / `e2e` / `perf` / `policy` (정책 / 문서 / agent rule) / `manual` (사람 검증 필요) / `n/a`.
- **하나의 REQ 가 여러 task 에 분포 가능**: "구현 위치" 컬럼에 phase / task 목록을 comma 로.
- 본 표의 **본문은 P1 phase 의 첫 task (P1-Entry) 가 채운다** ([.claude/agents/planner.md](../.claude/agents/planner.md) "Phase entry task" 참조). 현재는 점검에서 발견된 핵심 REQ 와 빈 row 일부만 박혀있고, `kind` 컬럼은 빠져있다 — P1-Entry 가 채움.

## 매핑 표

**주의**: 현재 6 컬럼. P1-Entry task 가 `kind` 컬럼을 추가하여 7 컬럼으로 확장하고 모든 row 의 kind 를 채운다 (FR / NFR / Constraint 분류).

| REQ | README 행 | 요약 | 구현 위치 (phase/task) | 검증 위치 | 상태 |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | 1 | 본 문서는 Use Case 문서의 기본 | P1 | policy | PLANNED |
| REQ-002 | 6 | Web Interface 를 제공하는 Agent System | P5 / P2 | smoke + e2e | PLANNED |
| REQ-003 | 7 | 개발자 기여 양·질 평가 / 저장 / 표시 | P2 + P4 + P5 | unit + smoke | PLANNED |
| REQ-004 | 9 | 수치 지표 + LLM 평가 코멘트 (사용자 지정 기간) | P4 | unit + e2e | PLANNED |
| REQ-005 | 16 | github.com 평가 | P3 | unit (provider) + e2e | PLANNED |
| REQ-006 | 17 | github.sec.samsung.net 평가 | P3 | unit + e2e | PLANNED |
| REQ-007 | 18 | github.ecodesamsung.com 평가 | P3 | unit + e2e | PLANNED |
| REQ-008 | 20 | 접근 권한(read) 부족 시 인식·통지 | P3 | unit + smoke | PLANNED |
| REQ-009 | 21 | Fork/Rebase/Meld 중복 제거 + 시간적 중복 (earlier date 우선) | P4 | unit | PLANNED |
| REQ-010 | 24 | 코드 기여 양·질 평가 | P4 | unit | PLANNED |
| REQ-011 | 25 | 중요·어려운 기여 → 높은 점수 ("어렵고 남이 못할 일") | P4 | manual + unit | PLANNED |
| REQ-012 | 26 | 코드 abusing 방지 (commit/PR 숫자만 늘리기) | P4 | unit | PLANNED |
| REQ-013 | 27 | 저성과자 식별 | P4 | unit | PLANNED |
| REQ-014 | 30 | Issue 평가 (본인 follow-up 소비 제외) | P3 + P4 | unit | PLANNED |
| REQ-015 | 31 | Confluence 지정 SPACE 평가 | P3 | unit + e2e | PLANNED |
| REQ-016 | 33 | Confluence 접근 권한 부족 인식·통지 | P3 | unit | PLANNED |
| REQ-017 | 34 | Confluence SPACE crawling vs hierarchy 탐색 정책 (ADR) | P3 (ADR 필수) | policy | PLANNED |
| REQ-018 | 37 | 단순 보고·copy-paste 로그 = zero-contribution | P4 | unit | PLANNED |
| REQ-019 | 38 | 새 알고리즘·외부 연구 소개 = 높은 contribution | P4 | unit + manual | PLANNED |
| REQ-020 | 39 | 조직 기여 큰 인원 → 높은 점수 | P4 | manual + unit | PLANNED |
| REQ-021 | 40 | 문서 abusing 방지 (의미 없는 기여 단순 반복) | P4 | unit | PLANNED |
| REQ-022 | 41 | 문서 update 횟수 중립화 (advantage/disadvantage 둘 다 없음) | P4 | unit | PLANNED |
| REQ-023 | 45-46 | 서비스별 ID 매핑 (1 인물 ↔ N 서비스 ID) | P2 | unit | PLANNED |
| REQ-024 | 47 | Primary key 역할 ID 지정 (서비스 중 1개) | P2 (ADR 필수) | policy + unit | PLANNED |
| REQ-025 | 48 | 일부 서비스 ID NULL 허용 | P2 | unit | PLANNED |
| REQ-026 | 49 | 인원 CRUD + Deactivate/Activate (휴직 시 숨김) | P2 | unit + e2e | PLANNED |
| REQ-027 | 50 | 신규 인원 1년치 평가 1회 (일반은 1주 단위) | P6 + P4 | unit + e2e | PLANNED |
| REQ-028 | 51 | Group 정책 (다중 임의 group + 단일 조직도 파트) | P2 | unit | PLANNED |
| REQ-029 | 56 | 평가 자료 non-volatile 저장 | P2 | unit | PLANNED |
| REQ-030 | 57 | Export/backup + Restore | P6 | e2e | PLANNED |
| REQ-031 | 58 | 재수집 중복 방지 + 최근 1주 재수집 OK | P4 | unit | PLANNED |
| REQ-032 | 59 | 🔥 Raw data 저장 금지 — 평가 결과만 보유 | P2 (ADR 필수) | policy + reviewer 점검 | PLANNED |
| REQ-033 | 60 | commit/문서 별 기여도·난이도·양 보유 | P2 + P4 | unit | PLANNED |
| REQ-034 | 61 | 일별 활동 요약 평가문 (당일은 자정까지 안 함) | P4 | unit | PLANNED |
| REQ-035 | 62 | 주간/월간 요약 평가문 (다음주/다음달 시작 시) | P4 | unit | PLANNED |
| REQ-036 | 63 | 상대 비교 가능 + LLM 정성 + Metric 수치 | P2 + P4 | unit | PLANNED |
| REQ-037 | 64 | 평가 없는 부분 일괄 평가 + Reset & Reeval | P4 | e2e | PLANNED |
| REQ-038 | 68-71 | UI 조회 / sort / filter / 시계열 | P5 | smoke + e2e | PLANNED |
| REQ-039 | 72 | Admin cron 주기 지정 | P6 | unit + e2e | PLANNED |
| REQ-040 | 73 | Admin manual trigger | P6 | e2e | PLANNED |
| REQ-041 | 74 | Admin 최근 N일 결과 manual delete → 재수집 | P6 | unit + e2e | PLANNED |
| REQ-042 | 78 | 평가 진행 중 시각화 보호 (기존 자료 + 경고 배너) | P5 | smoke + e2e | PLANNED |
| REQ-043 | 83 | 모든 기능 ID/Password 보호 | P2 + P5 | e2e | PLANNED |
| REQ-044 | 84 | 첫 로그인 SuperAdmin / 3 등급 / 승급 / SuperAdmin 만 Admin→User | P2 + P5 | unit + e2e | PLANNED |
| REQ-045 | 85 | Admin 권한 (재작성/Reset/Import/Export/인원편집/Group편집) | P5 | e2e | PLANNED |
| REQ-046 | 86 | User read-only (조회/sort/filter) | P5 | e2e | PLANNED |
| REQ-047 | 91 | 100~200명 / 50~100 repo / ~1000 confluence / 1h 이내 | P6 | manual + perf test | PLANNED |
| REQ-048 | 92 | 조회·시각화 3초 이내 | P5 + P6 | perf test | PLANNED |
| REQ-049 | 96 | Admin 이 LLM 모델 지정 | P3 + P5 | e2e | PLANNED |
| REQ-050 | 97 | 3가지 난이도 모델 + 어떤 항목이 어떤 난이도인지 결정 | P3 (ADR 필수) | policy + unit | PLANNED |
| REQ-051 | 99 | custom LLM (OpenAI 호환, 내부 서버, proxy, 3 model 슬롯) | P3 | unit | PLANNED |
| REQ-052 | 100 | Azure OpenAI provider | P3 | unit | PLANNED |
| REQ-053 | 101 | Anthropic provider | P3 | unit | PLANNED |
| REQ-054 | 102 | Google Gemini provider | P3 | unit | PLANNED |
| REQ-055 | 103 | OpenAI provider | P3 | unit | PLANNED |
| REQ-056 | 108 | Well-known library / 중복 import 금지 / version mismatch 방지 | P0 + 모든 phase | policy + CI | PLANNED |
| REQ-057 | 109 | 한 commit = 한 주제 | (정책) CLAUDE.md §3 | policy | DONE |
| REQ-058 | 110 | commit/PR 후 코드 검토 + test 작성 + test 수행 | CLAUDE.md §3.2 R-110 + agents | policy | DONE |
| REQ-059 | 111 | 모든 test → CI 자동 실행, fail → CI error | CLAUDE.md §3.2 R-111 + ci.yml | policy + CI | DONE (T-0005 후 active) |
| REQ-060 | 112 | unit test (기능 + 예외 + flow + negative) | CLAUDE.md §3.2 R-112 + planner | policy + CI (T-0007/T-0008) | DONE |
| REQ-061 | 113 | smoke + e2e 도 CI 에서 수행 | CLAUDE.md §3.2 R-113 + T-0009/T-0010 | CI | PLANNED (P0.5) |
| REQ-062 | 114 | 활동 후 test 수행 + 종료 전 CI 수행 | CLAUDE.md §3.2 R-114 + LOOP §1 [5] | policy | DONE |
| REQ-063 | 115 | PR 만들면 다른 agent 가 review | integrator → reviewer | policy | DONE |
| REQ-064 | 116 | Reviewer + Committer 합의로 merge, 7 round | CLAUDE.md §3.3 + integrator | policy | DONE |
| REQ-065 | 117-128 | Reviewer 8 check | reviewer.md | policy | DONE |
| REQ-066 | 133 | 코드 commit = PR / 진행상황 doc = direct | CLAUDE.md §3.1 | policy | DONE |

## 매핑 표 갱신 룰

- 새 task 가 만들어질 때 task 파일 frontmatter 에 `coversReq: [REQ-NNN, REQ-MMM]` 명시.
- task merge 시 integrator 가 본 표의 해당 REQ row 상태를 `IN_PROGRESS` → `DONE` 으로 갱신 (직접 또는 follow-up doc-only direct commit).
- README 가 변경되면 planner 가 다음 호출에서 본 표를 동기화 (새 row 추가 또는 기존 row 갱신).
- 본 표의 row 가 phase 의 PLAN.md bullet 과 1:N 또는 N:1 일 수 있다. 그 경우 "구현 위치" 컬럼에 PLAN bullet 위치를 명시.

## 누락 검사 (정기 수행)

- planner 는 P 단위 phase 진입 시 본 표를 grep 하여 해당 phase 에 매핑된 REQ row 중 `PLANNED` 상태로 남은 것이 있는지 확인. 있으면 task 생성 후보로.
- reviewer 의 8 check (1) "주어진 주제 해결" 점검 시 PR 의 task frontmatter `coversReq` 가 본 표의 REQ 와 일치하는지 검증.

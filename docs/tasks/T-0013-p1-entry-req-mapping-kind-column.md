---
id: T-0013
title: P1-Entry — requirements.md 에 kind 컬럼 추가 + 66 REQ row 채움 + REQ-061 DONE 갱신
phase: P1
status: PENDING
commitMode: direct
coversReq: [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-062, REQ-063, REQ-064, REQ-065, REQ-066]
estimatedDiff: 140
estimatedFiles: 1
created: 2026-05-24
plannerNote: P1 phase 첫 task (P1-Entry) — README→REQ 매핑 표에 kind 컬럼 추가 + 66 row 채움 + REQ-061 DONE 반영. doc-only direct, R-110 면제.
dependsOn: []
blocks: [T-A2, T-A3, T-A4]
hqOrigin: null
---

# T-0013 — P1-Entry: requirements.md 에 kind 컬럼 추가 + 66 REQ row 채움

## Why

[docs/PLAN.md](../PLAN.md) Phase P1 의 첫 bullet 은 **P1-Entry** — "README → REQ 매핑 표 완성 ([docs/requirements.md](../requirements.md) 모든 row 검증). planner 가 자동 생성하는 P1 첫 task. commitMode: direct." 다.

현재 [docs/requirements.md](../requirements.md) 의 매핑 표는 6 컬럼이고 (L18: `| REQ | README 행 | 요약 | 구현 위치 (phase/task) | 검증 위치 | 상태 |`), L12·L16 에 "P1-Entry 가 채운다 / 현재 6 컬럼" 안내 문구가 박혀있다. 본 task 는:

1. 표를 6 컬럼 → 7 컬럼으로 확장 (`kind` 컬럼 신설, README 행과 요약 사이에 배치).
2. 66 REQ row 모두에 `kind` 값 채움 — `FR` (Functional Requirement) / `NFR` (Non-Functional Requirement) / `Constraint` 중 택일.
3. REQ-061 (smoke + e2e CI) 상태 갱신: `PLANNED (P0.5)` → `DONE (T-0009/T-0010)` — P0.5 phase 가 직전 session 에서 완료됐으므로 정합성 회복.
4. L12, L16 의 안내 문구 갱신 (이미 채워졌음을 반영, 컬럼 수 7 로).

본 task 가 끝나면 P1 의 후속 task (T-A2 deployment view / T-A3 component view / T-A4 module view) 가 매핑 표를 신뢰할 수 있는 source of truth 로 사용 가능. P2 (use case decomposition) 가 functional REQ 만 골라 use case 로 분해할 때도 `kind: FR` filter 가 필수.

## Required Reading

- [docs/requirements.md](../requirements.md) (전체 1–98 행) — 현 6 컬럼 표 + 운영 룰 + 갱신 룰 + 누락 검사
- [README.md](../../README.md) (1–135 행) — kind 분류 근거. 특히:
  - 1–94 행: Functional 영역 (평가 대상 / 저장 / 시각화 UI / 보안 / 성능 / LLM)
  - 88–92 행: Non-Functional (성능 — REQ-047, REQ-048)
  - 106–135 행: Constraint 영역 (구현 제약 / agent rule / commit mode)
- [docs/PLAN.md](../PLAN.md) L43–L67 (Phase P1 섹션) — P1-Entry / T-A1 / T-A2 / T-A3 / T-A4 bullet 위치 확인
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode 표) — `docs/` 갱신은 direct
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-110 본문 — "direct-mode doc-only commit 만 본 규칙 면제"

## Acceptance Criteria

### 표 schema 변경

- [ ] [docs/requirements.md](../requirements.md) 매핑 표 헤더가 7 컬럼: `| REQ | README 행 | 요약 | kind | 구현 위치 (phase/task) | 검증 위치 | 상태 |` (kind 는 요약과 구현 위치 사이).
- [ ] 헤더 직후 alignment row (`| --- | --- | ... |`) 도 7 컬럼.
- [ ] 표 본문의 모든 row 도 7 컬럼 (REQ-001 ~ REQ-066, 총 66 row).

### kind 컬럼 채움

- [ ] 66 REQ row 모두 `kind` 값이 빈칸 없이 채워짐 — `FR` / `NFR` / `Constraint` 중 하나.
- [ ] 분류 기준 (executor 가 따를 가이드라인):
  - **FR**: 사용자가 시스템에 요청하거나 시스템이 행동·기능으로 제공하는 것. 예: REQ-002 (Web Interface 제공), REQ-005 (github.com 평가), REQ-026 (인원 CRUD), REQ-038 (UI 조회 / sort / filter), REQ-044 (3 등급 권한 / 첫 로그인 SuperAdmin) 등.
  - **NFR**: 성능·가용성·UX 품질·보안 정책. 예: REQ-047 (100~200명 / 1h 이내 — perf), REQ-048 (3초 이내 — perf), REQ-029 (non-volatile 저장 — durability), REQ-043 (ID/Password 보호 — security policy).
  - **Constraint**: 외부 stack / 정책 / agent rule / 사용 가능 라이브러리. 예: REQ-056 (well-known library, 중복 import 금지), REQ-057~066 (commit/PR/test/CI/review 운영 정책 — CLAUDE.md/agents/policy 로 흡수된 것).
- [ ] 분류가 애매한 row (예: REQ-008 접근 권한 부족 인식·통지 — 기능이자 정책 양면) 는 1 차 분류를 적되, 본 task Follow-ups 섹션에 "분류 재검토 후보" 로 메모해 후속 phase 가 다시 본다.

### REQ-061 상태 갱신

- [ ] REQ-061 row 의 상태 컬럼이 `PLANNED (P0.5)` → `DONE` 으로 갱신 (괄호 안 정보는 `(T-0009/T-0010)` 형식 또는 비워둠 — 본 표의 다른 DONE row 와 스타일 통일).
- [ ] REQ-061 의 "구현 위치" 컬럼이 실제 머지된 task 를 가리킴 — 현재 `CLAUDE.md §3.2 R-113 + T-0009/T-0010` 으로 이미 채워져 있으므로 변경 불요 (단 sanity check).

### 안내 문구 갱신

- [ ] L12 의 "본 표의 **본문은 P1 phase 의 첫 task (P1-Entry) 가 채운다** ... 현재는 점검에서 발견된 핵심 REQ 와 빈 row 일부만 박혀있고, `kind` 컬럼은 빠져있다 — P1-Entry 가 채움." 문장을 갱신: "본 표의 본문은 P1-Entry (T-0013) 가 채웠다. kind 컬럼 포함 7 컬럼 — README 의 모든 지시 row 화 완료." 같은 톤으로 (정확한 문구는 executor 재량).
- [ ] L16 의 "**주의**: 현재 6 컬럼. P1-Entry task 가 `kind` 컬럼을 추가하여 7 컬럼으로 확장하고 모든 row 의 kind 를 채운다 (FR / NFR / Constraint 분류)." 를 갱신: "표는 7 컬럼이며 모든 row 의 `kind` 가 채워져 있다 (FR / NFR / Constraint)." 같은 톤 (정확한 문구는 executor 재량).

### 정합성 / non-regression

- [ ] 다른 row 의 의미 변경 없음 — `id`, `README 행 번호`, `요약`, `구현 위치 (phase/task)`, `검증 위치`, `상태` 컬럼의 값은 (REQ-061 의 상태 갱신 외에는) 그대로.
- [ ] 새 REQ row 추가 없음 — README 변경 없으면 row 개수는 그대로 66 개.
- [ ] doc-only — `src/`, `test/`, `package.json`, `tsconfig.json`, `.github/workflows/`, `.claude/` 변경 없음.
- [ ] 표의 markdown 렌더 점검 (육안) — 7 컬럼 alignment 가 깨지지 않음.

### R-110~114 면제 사유

본 task 는 `docs/requirements.md` 단일 doc 파일만 수정. production code 0 LOC 변경. CLAUDE.md §3.1 표 `direct` 컬럼에 해당. CLAUDE.md §3.2 R-110 본문 "direct-mode doc-only commit 만 본 규칙 면제" 에 따라 tester 호출 불요. R-111~114 (CI 자동 실행 / unit test 의무 / smoke+e2e / 종료 전 CI) 도 production code 없으므로 적용 없음. 단 main push 시 CI 가 자동 trigger 되어 lint/build/test/smoke/e2e/spec-presence 7 step 이 모두 green 이어야 함 (doc 변경이 기존 test 를 깨면 안 됨 — 검증은 push 직후 `gh run list` 로 한 줄 확인).

## Out of Scope

- 매핑 표 schema 변경 (컬럼 추가만 OK, 기존 컬럼 의미 변경 / 컬럼 삭제 / 컬럼 재배치 등 schema mutation 금지)
- 새 REQ row 추가 (README 변경 없으면 row 변동 없음 — README 자체 수정은 별도 phase / 별도 task)
- 다른 row 의 phase 진척 갱신 (P0.5 → P1 entry 전환 기록은 본 task DONE 후 별도 STATE 갱신 — driver 가 처리)
- T-A1 (Requirement 분리 — FR/NFR/Constraint 컬럼 추가) 의 후속 작업 (검증 위치 [test 종류] 와 결합) — 본 task 는 kind 만, 검증 위치는 이미 채워져 있고 본 task 가 변경 안 함. T-A1 의 "결합" 작업은 별도 task 또는 P1 후속.
- 다른 doc 파일 갱신 (deployment.md, components.md, modules.md 등) — P1 의 후속 T-A2 ~ T-A4 가 다룸
- 새 ADR 작성 — 본 task 는 단순 표 채우기, architecture 결정 아님
- PLAN.md L48 의 T-A1 bullet 자체를 본 task 로 흡수하거나 변경 — T-A1 은 별도 task, 본 task 는 P1-Entry 만
- code comment / src/ 코드의 README 행 인용 갱신 — production code 0 LOC

## Suggested Sub-agents

implementer (doc 편집만) — architect 불필요 (architecture 결정 아님, README 의 기존 지시를 분류만), tester 불필요 (direct doc-only, R-110 면제).

## Follow-ups

(작성 시점엔 비어있음. sub-agent 가 본 task 진행 중 분류 애매 row 또는 추후 재검토 필요 항목 발견 시 여기 1줄씩 append. 예: "REQ-NNN 의 kind 분류는 FR/NFR 경계상 1 차로 FR 로 두었으나 P2 phase 에서 NFR 재분류 후보로 재검토.")

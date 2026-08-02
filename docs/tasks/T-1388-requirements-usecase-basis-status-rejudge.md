---
id: T-1388
title: requirements.md 20 행 REQ-001 README = Use Case 문서의 기본·사용 안내 역할 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1388-requirements-usecase-basis-status-rejudge.md
plannerNote: "requirements-status-resync 34 번째 slice — T-1387 Out of Scope 가 남긴 마지막 PLANNED row REQ-001, UC 문서·역추적·안내·정책 4 축 정적 실측, doc-only direct"
---

# T-1388 — requirements.md 20 행 REQ-001 README = Use Case 문서의 기본·사용 안내 역할 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 20 행 REQ-001 (README 1 행 — 본 문서는 이 Software System 의 소개로서 Use Case 문서의 기본이 되는 Description 역할과 사용자들에게 어떠한 사용을 할 수 있는지 안내를 한다) 은 kind = `Constraint`, 구현 위치 = `P2`, 검증 위치 = `policy` 인데 상태 컬럼이 아직 `PLANNED` 다. 그 사이 main 에는 `docs/use-cases/` 아래 UC 문서 8 종 + `INDEX.md` + `REQ-COVERAGE-AUDIT.md` 가 실재하고 `.claude/agents/planner.md` 의 P2 entry 절이 "README → `docs/use-cases/UC-NN-*.md`" 파생 관계를 정책으로 박제하고 있어, 표가 저장소 사실보다 뒤처졌는지 확인이 필요하다. 직전 slice [T-1387](T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md) 는 Out of Scope 에 "REQ-001 (20 행) 등 남은 `PLANNED` row 재판정 — 별도 slice" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 34 번째 slice 로 **UC 문서 실재 축 · README 역추적 축 · 사용 안내 축 · 정책 박제 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 20 행 (REQ-001) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행), 검증 위치 enum (10 행). 인접 REQ-002 (21 행) 는 `|` 필드 수 비교용으로만 쓴다 (REQ-001 위에는 헤더뿐이라 아래 행만 비교 가능하다).
- `docs/tasks/T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` / `PLANNED` 유지 + 사유 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (dependency 개수 · CI step 행 번호 등) 을 본 task 근거로 복사하지 않는다** — 그것은 dependency 규율 축의 근거이고 본 task 는 문서 파생 관계 축이다. 처음부터 직접 실측한다.
- `README.md` 1 행 — REQ-001 원문. 축 분해 = (a) **UC 문서 실재 축**: README 를 기본으로 삼는 Use Case 문서가 실제로 저장소에 존재하는지, (b) **README 역추적 축**: 각 UC 문서가 README 행 번호 또는 REQ-NNN 을 인용해 파생 관계를 문서상 실증하는지, (c) **사용 안내 축**: README 본문에 "사용자들에게 어떠한 사용을 할 수 있는지" 안내하는 절이 실재하는지, (d) **정책 박제 축**: README → UC 파생을 강제하는 운영 규칙이 agent rule / 문서 운영 룰로 박제됐는지.
- `docs/use-cases/` 디렉토리 — `ls docs/use-cases/` 로 UC 파일 목록과 건수를 세어 적는다. `UC-NN-*.md` 패턴 파일 수와 부속 문서 (`INDEX.md` · `REQ-COVERAGE-AUDIT.md`) 를 구분해 적는다.
- `docs/use-cases/INDEX.md` — UC 목록 index 의 실재와 각 UC 행이 무엇을 가리키는지 (파일 링크 / 요약 컬럼 유무) 를 1~2 절로 적는다. 본문 전체 재서술은 하지 않는다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 상단 결론부 (REQ ↔ UC cover 판정 요약) 만 인용한다. 표 전체를 옮겨 적지 않는다.
- 역추적 축 실 근거용 — `grep -c "README" docs/use-cases/UC-*.md` 및 `grep -c "REQ-0" docs/use-cases/UC-*.md` 로 **UC 파일별 README 인용 / REQ 인용 건수** 를 실측한다. 0 건인 파일이 있으면 그 파일명을 명시한다.
- `.claude/agents/planner.md` — "P2 (Use case decomposition) entry sequence" 절의 "Use case 인벤토리 — README → `docs/use-cases/UC-NN-*.md`" 문장을 실제 행 번호와 함께 인용한다. 정책 축의 1 차 근거.
- `docs/requirements.md` 7 행 (`단일 source of truth`: README 의 새 지시 / 수정 / 삭제는 본 문서의 매핑에도 즉시 반영) — 정책 축의 2 차 근거. 행 번호와 함께 인용한다. **문서 서술은 그 자체로 자동 검증 근거가 아니다** — 검증 위치 컬럼이 `policy` 임을 감안해 "정책 박제 = 충족" 과 "자동 강제 = 별개" 를 구분해 적는다.
- `docs/PLAN.md` — Phase P2 절이 완료 상태로 마킹돼 있는지 (구현 위치 컬럼 `P2` 의 대응) 를 해당 행 번호와 함께 한 줄로 확인한다. P2 절 본문 재서술은 하지 않는다.

## Acceptance Criteria

- [ ] **UC 문서 실재 축** 을 실측한다 — `ls docs/use-cases/` 결과로 `UC-NN-*.md` 파일 수 (N 건) 와 파일명 목록, 부속 문서 (`INDEX.md` · `REQ-COVERAGE-AUDIT.md`) 실재 여부를 적는다.
- [ ] **README 역추적 축** 을 실측한다 — UC 파일별 `README` 문자열 인용 건수와 `REQ-0` 인용 건수를 grep 으로 세어 "N/8 파일이 README 인용, M/8 파일이 REQ 인용" 형태로 적는다. 0 건 파일이 있으면 파일명을 명시한다.
- [ ] **사용 안내 축** 을 실측한다 — README 본문에서 "사용자들에게 어떠한 사용을 할 수 있는지" 안내에 해당하는 절 (기능 소개 · 사용 흐름 서술 등) 이 실재하는지 확인해 해당 행 범위를 인용한다. 판정이 주관적이면 그 사실을 한계로 부기한다.
- [ ] **정책 박제 축** 을 실측한다 — `.claude/agents/planner.md` 의 P2 entry 문장과 `docs/requirements.md` 7 행 단일 source of truth 문장을 각각 행 번호와 함께 인용하고, 이 둘이 README → UC 파생 관계를 정책으로 강제하는지 판정한다. **자동 검증 (CI step / spec) 은 별개** 임을 한 절로 구분해 적는다.
- [ ] **검증 위치 컬럼 (`policy`) 의 실 근거** 와 **구현 위치 컬럼 (`P2`) 의 실 근거** 를 각각 확인한다 — `policy` 는 위 정책 축 인용으로, `P2` 는 `docs/PLAN.md` 의 Phase P2 절 마킹 (행 번호 포함) 으로 충족 / 부분 충족 / 부재를 명시한다.
- [ ] REQ-001 (20 행) 의 상태 컬럼을 실측 결과에 따라 `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. **어느 판정이든 근거에 실재하는 파일 경로 3 개 이상** 이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: "Description 역할" 의 충분성은 정성 판정이라 정적 실측 불가 · README ↔ UC 내용 정합은 문서 전수 대조 없이는 판정 불가 · 정책 문장은 CI 로 자동 강제되지 않음 등) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-001" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신 (또는 사유 부기) 됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-002) 및 헤더 행 (18 행) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 사고 재발 방지 — grep alternation `\|` 도 금지, 중점 나열로 치환).
- [ ] `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임을 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **README.md 수정** — 안내 절의 공백이나 표현 drift 를 발견해도 README 를 고치지 않는다 (요구사항 source of truth 는 불변에 가깝다 — CLAUDE.md §6). 발견 사항은 Follow-ups 에만 적는다.
- **UC 문서 (`docs/use-cases/*.md`) 수정** — README 인용 0 건인 UC 파일을 발견해도 그 파일에 인용을 추가하지 않는다. Follow-ups 에만 적는다.
- **`.claude/agents/planner.md` · `docs/PLAN.md` 수정** — 정책 서술 drift 를 발견해도 인용 · 부기만 한다.
- **REQ-001 ↔ UC 내용 정합 전수 대조** — 8 개 UC 문서 본문을 README 서술과 문장 단위로 맞춰보지 않는다. 파일 존재 · 인용 건수 · index 실재 수준의 정적 실측으로만 판정하고 나머지는 한계로 부기한다.
- **REQ-047 (66 행) 재판정** — [T-1386](T-1386-requirements-batch-scale-status-rejudge.md) 이 이미 4 축 실측 후 `PLANNED` 유지로 판정했다. 본 slice 에서 다시 건드리지 않는다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice.
- `src/` · `web/` · `test/` · `scripts/` 등 코드 · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1387 Follow-ups (중복 library CI step · transitive 감사 절차 · well-maintained 기준) 의 구현 또는 재서술.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)

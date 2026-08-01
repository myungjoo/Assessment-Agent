---
id: T-1363
title: requirements.md 48 · 51 행 REQ-029 · REQ-032 저장 정책 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-029, REQ-032]
estimatedDiff: 16
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1363-requirements-storage-policy-status-rejudge.md
plannerNote: "requirements-status-resync 9 번째 slice — P3 저장 정책 축 2 row(비휘발 저장 · raw 미저장), ADR-0006/0033 근거 공유로 1 slice 통합"
---

# T-1363 — requirements.md 48 · 51 행 REQ-029 · REQ-032 저장 정책 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 48 행 REQ-029 (평가 자료 non-volatile 저장) 과 51 행 REQ-032 (raw data 저장 금지) 는 아직 상태 컬럼이 `PLANNED` 이지만, ADR-0006 (raw 미저장 schema-level 강제) · ADR-0033 (평가 결과 영속화, ACCEPTED, 구현 chain T-0298~T-0302 머지 완료) 과 `prisma/schema.prisma` 의 Assessment / Contribution / Summary 3 model 이 이미 main 에 안착해 있어 표가 실제 코드베이스와 어긋난다. T-1362 Follow-ups 가 지목한 다음 slice 후보이며, 두 REQ 는 근거 파일 (schema + ADR) 이 겹쳐 1 slice 로 묶는 것이 중복 실측을 줄인다. `requirements-status-resync` stream 의 9 번째 slice 로, 표를 requirements 추적의 신뢰 가능한 single source of truth 로 되돌리는 작업이다.

## Required Reading

- `docs/requirements.md` — 48 행 (REQ-029) · 51 행 (REQ-032), 그리고 9 행의 상태 enum 정의
- `docs/tasks/T-1362-requirements-person-group-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (implemented-on-main + 근거 + 한계 부기) 을 그대로 따른다
- `docs/decisions/ADR-0006-assessment-data-model.md` — §Decision 4 (raw 본문 컬럼 0 의 schema-level 강제)
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — status / §Decision 2 (raw 미저장 재확인) / §Decision 1 (기존 3 entity 로의 write 매핑)
- `prisma/schema.prisma` — Assessment / Contribution / Summary model 정의 (raw 본문 컬럼 부재 실측)

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 의 Assessment / Contribution / Summary 3 model 을 실측해, 평가 결과 컬럼만 있고 raw 본문 (commit diff · 문서 원문 등) 컬럼이 0 임을 확인한 뒤 그 근거 (model 명 + 확인한 컬럼 성격) 를 상태 문자열에 1 회 인용한다.
- [ ] REQ-029 (48 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)` 또는 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 PostgreSQL 영속화 경로 (ADR-0002 · ADR-0033 의 write path) 와 실재하는 repository / spec 파일 경로가 각 1 개 이상 포함돼야 한다.
- [ ] REQ-032 (51 행) 의 상태 컬럼을 같은 방식으로 갱신한다. Constraint 이자 `P3 (ADR 필수)` 이므로 **대응 ADR 이 실재함** (ADR-0006, ADR-0033 §Decision 2) 을 근거로 명시한다.
- [ ] 실측 중 발견한 한계 (예: REQ-032 의 검증 위치 컬럼이 `policy + reviewer 점검` 이지만 `.claude/agents/reviewer.md` · `scripts/` 에 raw 미저장 자동 점검 항목이 실재하지 않는 점) 는 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다. 확인되지 않은 사실을 DONE 근거로 쓰지 않는다.
- [ ] `grep -n "REQ-029\|REQ-032" docs/requirements.md` 결과에서 두 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분) 가 다른 행과 동일하게 유지됨을 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · 구현 위치 · **검증 위치**) 수정 — 검증 위치 컬럼 재판정은 T-1362 Follow-ups 가 지목한 별도 slice 다.
- `prisma/schema.prisma` · `src/` · `test/` 등 코드 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-029 · REQ-032 외 다른 `PLANNED` row 재판정 (다음 slice 로 미룬다).
- reviewer / CI 에 raw 미저장 자동 점검 step 을 추가하는 일 (발견 시 Follow-ups 에만 적는다).

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

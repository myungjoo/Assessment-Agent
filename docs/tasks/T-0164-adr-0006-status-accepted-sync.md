---
id: T-0164
title: ADR-0006 status PROPOSED→ACCEPTED 동기화 (Assessment/Contribution/Summary 구현 완료 반영)
phase: P4
status: DONE
commitMode: direct
completedAt: 2026-06-02T13:35:00+09:00
coversReq: [REQ-029, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 doc-sync — ADR-0006 결정이 schema/repo/controller 로 main 에 전부 박제됐으나 status 가 PROPOSED stale. §3.1 rule 4 direct 한 줄 status 갱신. §5 미발화.
---

# T-0164 — ADR-0006 status PROPOSED→ACCEPTED 동기화

## Why

[ADR-0006](../decisions/ADR-0006-assessment-data-model.md) 은 Assessment / Contribution / Summary 3 entity 데이터 모델 + raw 미저장 (R-59) schema-level 강제를 박제한 결정 문서다. 그러나 ADR 의 `Consequences §후속 구현 task chain` 이 예고한 후속 구현 (T-0110/T-0111/T-0112 candidate: schema → service/repository → controller) 이 모두 main 에 머지됐음에도 ADR frontmatter `status` 가 여전히 `PROPOSED` 로 남아 stale 하다. CLAUDE.md §3.1 rule 4 ("ADR의 status 갱신(PROPOSED→ACCEPTED) 한 줄 수정은 `direct`") 정합 — 결정이 실 구현으로 안착됐으므로 ACCEPTED 로 status 를 동기화해 architecture 기록의 정확성을 회복한다. reviewer 가 후속 schema PR 의 R-59 위반 catch 시 ADR status 를 신뢰 근거로 삼으므로 (ADR-0006 Consequences §positive #1), stale PROPOSED 는 실제 운영 가치를 훼손한다.

## Required Reading

- `docs/decisions/ADR-0006-assessment-data-model.md` — 본 task 가 수정할 ADR (frontmatter `status` + 본문 transition note 추가 위치).
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` (L1~12) — PROPOSED→ACCEPTED 전이 note 의 박제 형식 precedent (frontmatter 아래 blockquote transition note 패턴 mirror).
- `prisma/schema.prisma` (L224~302, Assessment / Contribution / Summary model) — ADR 결정과 실 구현의 1:1 정합 재확인 근거 (planner 가 이미 §1~§6 전 컬럼·`@@unique`·`@@index`·cascade 일치 확인 — 본 task 는 재확인만, schema 수정 0).

## Acceptance Criteria

- [x] `docs/decisions/ADR-0006-assessment-data-model.md` frontmatter 의 `status: PROPOSED` 를 `status: ACCEPTED (2026-06-02)` 로 변경 (ADR-0009 의 `ACCEPTED (2026-06-01)` 형식 mirror).
- [x] ADR 본문 제목 (`# ADR-0006 — ...`) 바로 아래에 PROPOSED→ACCEPTED 전이 note 를 blockquote (`>`) 로 추가 — 구현 안착 증거 명시: schema (`prisma/schema.prisma` Assessment/Contribution/Summary 3 model, `@@unique([personId, period, scope, periodStart])` 포함) + repository/service/controller (`src/user/assessment.*`) 가 main 에 머지됨. ADR-0009 의 전이 note 형식 (gate 였던 후속 task 가 머지됐음을 1~3 줄로) 참조.
- [x] schema / 코드 파일은 **수정하지 않는다** — ADR 한 파일만 변경 (frontmatter status + 본문 note). 변경 LOC ≤ 20.
- [x] `git diff --stat` 로 변경 파일이 `docs/decisions/ADR-0006-assessment-data-model.md` 1 개뿐임을 확인.

## Out of Scope

- schema / repository / service / controller 코드 수정 (이미 main 박제 — 본 task 는 ADR status 동기화만).
- ADR 의 Decision / Consequences / Alternatives 본문 내용 변경 (status frontmatter + 전이 note 만 추가, 결정 내용 불변).
- ADR-0006 Consequences §후속 amend 후보 (data-model.md REQ-063→REQ-036 정정 / INDEX.md ADR 매핑 표 갱신) — 별도 follow-up task 책임. 본 task 에서 손대지 않는다.
- ADR-0006 외 다른 ADR (예: ADR-0009 는 이미 ACCEPTED) 의 status 검토.

## Suggested Sub-agents

direct doc-only — sub-agent 불요. driver 가 직접 Edit 수행 후 main 직접 commit·push (PR·reviewer 없음, §3.1 direct).

## Follow-ups

(없음 — 생성 시점)

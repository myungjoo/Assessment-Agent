---
id: T-0225
title: api.md + modules.md 의 non-Admin audit 동작을 own-instance 필터 reality 로 doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-016, REQ-044]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-06-04
completedAt: 2026-06-04T15:05:00+09:00
committedAs: e13365e
plannerNote: P4 — T-0221~T-0224 own-instance 필터 chain 머지로 api.md L124·modules.md L37 의 'binding 미박제/빈 배열 fallback' 서술이 stale, doc-vs-reality 정합
result: DONE — api.md L124 + modules.md L37 non-Admin audit 동작을 UserInstanceAccess allowlist own-instance 필터 reality 로 정합 + ADR-0024 §3 참조 추가(direct, e13365e). tasksCompleted 222→223.
---

# T-0225 — api.md + modules.md 의 non-Admin audit 동작을 own-instance 필터 reality 로 doc-sync

## Why

Q-0021 option (1) audit own-instance 필터 chain (T-0221 UserInstanceAccess schema+migration → T-0222 repository allowlist lookup → T-0223 PermissionDeniedRecordFilter instanceRefIn → T-0224 service 결선) 이 모두 merged 되면서, `GET /api/permission-denied-records` 의 non-Admin authenticated 동작이 **'User↔instance binding 미박제로 항상 빈 배열 fallback'** 에서 **'UserInstanceAccess allowlist 기반 own-instance 필터링된 record 조회'** 로 실제 바뀌었다. 그러나 `docs/architecture/api.md` L124 와 `docs/architecture/modules.md` L37 (PermissionDeniedRecordModule row) 은 여전히 stale 한 'binding 미박제 / 빈 배열 fallback' 서술을 박제하고 있어 doc-vs-reality 모순이다. 본 task 는 두 doc 의 해당 서술만 reality (ADR-0024 own-instance 필터) 로 정합한다 — T-0215/T-0217 이 확립한 api.md/modules.md doc-sync (direct) 패턴 동형.

## Required Reading

- `docs/architecture/api.md` — L122~126 (UC-08 권한 부족 통지 표 + `/api/permission-denied-records` row L124 + 합계 L126), L161 (UC-08 mapping row)
- `docs/architecture/modules.md` — L37 (PermissionDeniedRecordModule 표 row)
- `src/permission-denied/permission-denied-record.service.ts` — `list(actor, query?)` 의 실제 non-Admin own-instance 필터 동작 (Admin bypass / allowlist lookup / allowlist 공집합 빈 배열 / query.instanceRef ∩ allowlist 교집합) — 정확한 서술 source
- `docs/decisions/ADR-0024-user-instance-binding-data-model.md` — own-instance 필터 계약 (참조 링크 source). **ADR-0023/ADR-0024 본문은 immutable decision record 라 수정 대상 아님** — 본 task 는 api.md/modules.md 만 정합

## Acceptance Criteria

- [ ] `docs/architecture/api.md` L124 의 `/api/permission-denied-records` row 서술을 reality 로 정합: 'non-Admin authenticated = User↔instance binding **미박제**로 현재 빈 배열 fallback' → 'non-Admin authenticated = UserInstanceAccess allowlist 기반 **own-instance 필터** (자기 instance record 만 조회, allowlist 공집합이면 빈 배열, query.instanceRef ∩ allowlist 교집합)' 로 수정. '200 빈 배열 (매칭 0 또는 non-Admin binding 부재)' 의 binding 부재 표현도 'allowlist 공집합 (binding 0)' 로 정합. T-0221~T-0224 + ADR-0024 참조 추가.
- [ ] `docs/architecture/modules.md` L37 의 PermissionDeniedRecordModule row 의 'non-Admin 은 binding-부재 빈 배열 fallback' → 'non-Admin 은 UserInstanceAccess allowlist 기반 own-instance 필터 (ADR-0024)' 로 정합. ADR-0024 참조 링크 추가 (기존 ADR-0022/ADR-0023 옆).
- [ ] 두 doc 의 수정이 `src/permission-denied/permission-denied-record.service.ts` `list()` 의 실제 동작 (Admin bypass / own-instance 필터 / allowlist 공집합 빈 배열 / 교집합) 과 일치하는지 inspection 으로 확인 — 과장/누락 없이 reality 만 박제.
- [ ] 분기 없음 — 순수 doc 서술 정합이라 R-112 test 항목 (happy/error/branch/negative/coverage) 및 commit 후 CI test 검증은 본 task 에 적용 대상 아님 (direct doc-only commit, R-110 면제). 이 항목 생략 명시.

## Out of Scope

- ADR-0023 / ADR-0024 본문 수정 — immutable decision record. ADR-0023 §1/§2(b) 의 'binding 부재' 서술은 그 ADR 작성 시점의 사실로 그대로 둔다 (supersede/amend 가 필요하면 별도 ADR).
- 코드 변경 (`src/`, `test/`) — 본 task 는 doc-sync 만. 코드는 이미 reality.
- api.md 의 다른 endpoint row / 합계 재집계 변경 (endpoint 수 변동 0 — 서술만 정합).
- modules.md 의 module 개수 / mermaid / topology 변경 (T-0217 에서 이미 9-module 정합 완료).
- `/api/me/permission-denied`, `/api/admin/permission-denied` conceptual placeholder row 변경 (여전히 미구현 placeholder, 정확).

## Suggested Sub-agents

`implementer` (doc 편집만 — direct commit 이라 tester 불요, R-110 면제).

## Follow-ups

(없음)

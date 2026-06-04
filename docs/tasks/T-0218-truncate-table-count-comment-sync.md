---
id: T-0218
title: truncateAll 테이블 개수 주석 정합 (5→7, stale comment doc-sync)
phase: P4
status: DONE
commitMode: pr
prNumber: 190
mergedAs: f1f18ab
reviewRounds: 1
coversReq: [REQ-058]
estimatedDiff: 6
estimatedFiles: 5
created: 2026-06-04
completed: 2026-06-04
plannerNote: P4 residual nit closeout — TRUNCATE_TABLES 가 7개인데 5 test 파일 주석은 "5 테이블"로 stale (T-0087 User + T-0208 PermissionDeniedRecord 미반영). comment-only doc-sync.
---

# T-0218 — truncateAll 테이블 개수 주석 정합 (5→7, stale comment doc-sync)

## Why

`test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 배열은 현재 **7 테이블**(`"Person"`, `"ServiceIdentity"`, `"Group"`, `"Part"`, `"PersonGroupMembership"`, `"User"`, `"PermissionDeniedRecord"`)을 TRUNCATE 한다. `"User"` 는 T-0087, `"PermissionDeniedRecord"` 는 T-0208 머지로 추가됐다. 그러나 이 helper 를 참조하는 5 개 test 파일의 주석은 여전히 **"5 (도메인) 테이블"** 로 stale 하여 merged reality 와 불일치한다. Q-0020 context 가 `db-truncate.spec.ts` docstring stale 1 건을 "인접 PR nit-closure 로 흡수" 권장했으나 audit-query milestone (T-0213~T-0217) 이 전부 shipped 되어 흡수할 인접 PR 이 더 없으므로, 본 잔여 nit 을 단독 dependency-free task 로 정리한다. 순수 comment-only — 동작 변경 0, 새 dependency 0, schema 0, auth 모델 0 (§5 미발화).

## Required Reading

- `test/helpers/db-truncate.ts` — `TRUNCATE_TABLES` 배열 (현 7 entry) 과 helper 책임 주석. 변경 대상 아님 (이미 7 테이블 명단 + T-0087/T-0208 설명 정합). reference 로만 읽음.
- `test/helpers/db-truncate.spec.ts` — L7 주석 `5 테이블` (변경 대상). L35 test 설명은 이미 `7 도메인 테이블` 로 정합돼 있어 대비 reference.
- `test/smoke/persons.smoke-spec.ts` — L66 주석 `5 도메인 테이블` (변경 대상).
- `test/smoke/groups.smoke-spec.ts` — L63 주석 `5 도메인 테이블` (변경 대상).
- `test/smoke/parts.smoke-spec.ts` — L69 주석 `5 도메인 테이블` (변경 대상).
- `test/e2e/persons.e2e-spec.ts` — L80 주석 `5 도메인 테이블` (변경 대상).

## Acceptance Criteria

- [ ] `test/helpers/db-truncate.spec.ts` L7 의 `5 테이블 substring 검증` 을 `7 테이블 substring 검증` 으로 정정 (해당 happy-path 2 test 중 하나가 실제로 `TRUNCATE_TABLES` 7 entry 를 모두 substring 검증함 — L35~60 과 정합).
- [ ] `test/smoke/persons.smoke-spec.ts`, `test/smoke/groups.smoke-spec.ts`, `test/smoke/parts.smoke-spec.ts`, `test/e2e/persons.e2e-spec.ts` 각 파일의 `5 도메인 테이블` 주석을 `7 도메인 테이블` 로 정정.
- [ ] 정정 후 `git grep -n "5 도메인 테이블\|5 테이블" -- "test/**/*.ts"` 결과가 0 건임을 확인 (잔여 stale 주석 없음).
- [ ] 본 task 는 **주석(comment) 외 코드·동작·SQL·테이블 명단 변경 0** — `TRUNCATE_TABLES` 배열 / `truncateAll` 본문 / 어떤 test assertion 도 수정하지 않는다. diff 는 주석 5 줄 텍스트뿐.
- [ ] **happy-path / error-path / branch / negative 신규 test 항목 없음** — 본 task 는 production public symbol 추가/수정이 0 인 comment-only 변경이라 R-112 신규 test 4 종은 적용 대상 없음(분기 없음 — 이 항목 생략). 단 R-110 에 따라 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 기존 spec 이 여전히 green 임을 확인(주석 변경이 컴파일/test 를 깨지 않음 보증).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 주석 변경은 coverage 수치에 영향 0 이나 CI gate 통과 확인.

## Out of Scope

- `TRUNCATE_TABLES` 배열의 테이블 추가·삭제·순서 변경 (이미 7 entry 로 정합 — 손대지 않음).
- `truncateAll` 동작·SQL 문자열·시그니처 변경.
- 신규 도메인 테이블의 truncate 등록 (해당 entity 가 생기면 그 entity task 의 책임).
- non-Admin own-instance 실 필터 / User↔instance binding schema (§5 미승인 게이트 — 본 task 무관).
- ADR-0004 본문 또는 다른 doc 의 cleanup 정책 서술 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 생성 시점)

---
id: T-0089
title: ADR-0008 §6 retroactive amend — RBAC backbone 실현 시점 + cross-ref + within-round 2 fix push lesson 박제
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 35
estimatedFiles: 1
dependsOn: [T-0083, T-0086, T-0087, T-0088]
created: 2026-05-28
plannerNote: P3 88% — ADR-0008 §6 inline-amend (doc-only direct × 1.6 × 0.4 = × 0.64) cron-friendly task, ~35 LOC 1 파일.
---

# T-0089 — ADR-0008 §6 retroactive amend (RBAC backbone 실현 시점 박제)

## Why

[docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) §6 "후속 task chain 박제" 는 T-0080 → T-0083 4 candidate 로 박제됐고, 그 후 T-0083 (RBAC scaffold) / T-0086 (UserService.changeRole) / T-0087 (UserController PATCH /api/users/:id/role) 가 MERGED 되어 **RBAC backbone 의 첫 production endpoint 적용이 박제 완결**된 상태다. 그러나 ADR-0008 본문은 여전히 candidate-only 박제로 stale. 본 task 가 §6 (또는 인접 § 의 amendments 섹션 / 후속 chain 표) 를 retroactive 갱신해 (1) T-0083 + T-0086 + T-0087 cross-ref + 머지 sha + 머지 일자 + (2) within-round 2 fix push lesson (prettier auto-fix + cookie-parser middleware test-path 격차 catch) + (3) RBAC backbone 의 실현 시점 = T-0087 머지 박제로 source of truth 정합한다. doc-only direct inline-amend 패턴 → cron env 친화 (reviewer/integrator 4-게이트 우회 — CLAUDE.md §3.1 direct 컬럼).

## Required Reading

- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) L86-141 (§6 + 인접 § 후속 chain 표 + STATE.phase 박제)
- [docs/tasks/T-0083-rbac-auth-guard-roles-decorator.md](T-0083-rbac-auth-guard-roles-decorator.md) (RBAC scaffold 머지 sha + 완료 시각)
- [docs/tasks/T-0086-user-service-change-role-self-demote-invariant.md](T-0086-user-service-change-role-self-demote-invariant.md) (UserService.changeRole 5 invariant 머지 sha)
- [docs/tasks/T-0087-user-controller-change-role-endpoint.md](T-0087-user-controller-change-role-endpoint.md) (UserController PATCH endpoint 머지 sha + within-round 2 fix push lesson 본문)

## Acceptance Criteria

본 task 는 doc-only direct (production code 변경 0) 이므로 R-112 5 항목은 일부 N/A. inline-amend 의 검증 항목 4 개:

- [ ] ADR-0008 §6 (또는 인접 § amendments 섹션) 에 retroactive amend block 추가 — 다음 5 항목 박제:
  1. T-0083 RBAC scaffold 머지 sha + 완료 일자 (RolesGuard + @Roles decorator + JwtAuthGuard 박제)
  2. T-0086 UserService.changeRole 머지 sha + REQ-044 5 invariant (actor=SuperAdmin / role enum / target null / self-demote / P2025 변환)
  3. T-0087 UserController PATCH /api/users/:id/role 머지 sha + @Roles SuperAdmin 단일 적용 + e2e 7 it
  4. within-round 2 fix push lesson — (i) prettier lint auto-fix (ii) cookie-parser middleware test-path 격차 catch (production main.ts boot path 만 wire 의 Test.createTestingModule path 누락 첫 발견, 1 라인 wire 추가로 e2e 7/7 green)
  5. RBAC backbone 실현 시점 = T-0087 머지 (PR-82 fabeb40) 박제 — "scaffold (T-0083) → service (T-0086) → controller endpoint (T-0087) 3 chain closed"
- [ ] amend 본문이 §6 의 기존 후속 task chain 표 (T-0080~T-0083 candidate row) 와 충돌하지 않고 추가 박제만 — 기존 표는 candidate 시점의 사실로 보존. 별도 "## Amendments" 섹션 또는 §6 끝의 새 sub-§ 으로 부착.
- [ ] frontmatter `amendments: []` → `amendments: ["T-0089"]` 갱신 + amend 일자 + amend 사유 1 줄.
- [ ] 본 task scope 안에서 다른 ADR / architecture doc 변경 0 (분기 없음 — 이 항목 생략 가능, 단 명시).

## Out of Scope

- ADR-0008 의 Decision §1~§5 (token format / delivery / TTL / signing / secret 관리) 본문 변경 — 결정 자체는 불변.
- T-0080 / T-0081 / T-0082 amend (이미 머지된 ADR-0008 chain 의 다른 stage — 본 task 는 RBAC 만 박제, 별도 amend 후보로 분리).
- modules.md / api.md 추가 amend (T-0088 에서 이미 박제).
- 후속 task chain candidate (T-0089 RefreshToken / T-0090 production-test path fix 등) 자체 신설 — 본 task 는 ADR 갱신만.
- frontmatter status 변경 (ACCEPTED 유지).

## Suggested Sub-agents

`implementer` 만 — doc-only direct inline-amend, architect / tester 불요 (production code 0, test 0). executor 가 직접 Edit tool 로 ADR 본문 inline amend → driver 가 direct main commit.

## Follow-ups

- (planner) RefreshToken DB table + revocation task (T-0090 candidate, ADR-0008 §6 음의 (negative) #2 refresh rotation race mitigation 박제).
- (planner) production-test path 격차 영구 fix task (T-0091 candidate — cookie-parser middleware test-path 누락 catch lesson 의 systematic fix, T-0087 within-round 2 fix push 의 (ii) 박제).
- (planner) auth-e2e-helper 추출 task (T-0092 candidate — T-0087 e2e 의 inline JwtService 발급 패턴 추출).
